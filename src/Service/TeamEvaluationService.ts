// TeamEvaluationService.ts -- Ranks candidate teams by effective battle
// power instead of by the raw stat sum.
//
// Why this exists
// ---------------
// The team builder ranks candidates by caracs_sum, which is exactly the
// "Total Power" the game prints on the edit-team screen. Measured against the
// live game, that number is literally the sum of the seven girls' caracs -- it
// contains none of the mechanics that decide a fight:
//
//   * Element synergies scale the WHOLE stat (hero base included), and they
//     are linear from the first girl of an element -- not from the third.
//     Live values from the game's own `synergies` payload:
//       darkness +2%/girl damage      nature  +3%/girl ego
//       light    +2%/girl defense     psychic +2%/girl harmony
//       fire    +10%/girl crit dmg    stone   +2%/girl crit chance
//       sun      +2%/girl def-reduce  water   +3%/girl heal-on-hit
//     Each capped at seven girls; the harem-wide share comes on top.
//   * Because the multiplier applies to hero base + girls, trading a little
//     caracs_sum for one more girl of the right element is usually a net win.
//
// How it ranks
// ------------
// The game exposes its own calculation as `action=team_calculate_caracs`
// (the edit-team screen fires it on every girl swap). We ask it for each
// candidate team and get back the authoritative {ego, damage, defense,
// chance}. Those measured stats are folded into one scalar:
//
//   effective = damage * (1 - critChance + critChance * critMultiplier)
//                      * (1 + sunSynergy)
//             * ego    * (1 + waterSynergy)
//
// i.e. expected damage per hit times how long the team survives -- the
// time-to-kill product. Against 135 teams measured on the live account and
// scored with HHauto's own battle simulator over 101 real league opponents,
// this scalar ranks Spearman 0.96 against simulated points and picks the
// true best team; caracs_sum alone ranks 0.85 and picks the 9th best.
//
// Everything network-facing is optional: without hh_ajax the caller keeps
// the caracs_sum winner.

import { getHHVars } from '../Helper/HHHelper';
import { logHHAuto } from '../Utils/LogUtils';
import { getHHAjax } from '../Utils/Utils';
import { ElementType } from './TeamScoringService';

/** Team-side synergy bonus per girl of that element (game payload). */
export const SYNERGY_PER_GIRL: Record<ElementType, number> = {
    darkness: 0.02, light: 0.02, psychic: 0.02, stone: 0.02, sun: 0.02,
    fire: 0.10, nature: 0.03, water: 0.03,
};

/** Cap on the team-side share (= seven girls of that element). */
export const SYNERGY_MAX: Record<ElementType, number> = {
    darkness: 0.14, light: 0.14, psychic: 0.14, stone: 0.14, sun: 0.14,
    fire: 0.70, nature: 0.21, water: 0.21,
};

// Harem-wide share, fully built (100+ girls of that element). Used only
// when the live `synergies` payload is unavailable; it is a per-account
// value that the page normally hands us.
const HAREM_SYNERGY_FALLBACK: Record<ElementType, number> = {
    darkness: 0.07, light: 0.07, psychic: 0.07, stone: 0.07, sun: 0.07,
    fire: 0.35, nature: 0.10, water: 0.10,
};

// Crit chance is a share of a fixed 30% pool split with the opponent, so a
// neutral opponent of equal harmony leaves 15%. The game caps the stat at
// 29%; the stone synergy adds on top of the share.
const NEUTRAL_CRIT_SHARE = 0.15;
const CRIT_CHANCE_CAP = 0.29;
// A critical hit deals double damage plus the fire (crit damage) synergy.
const CRIT_BASE_MULTIPLIER = 2;

const MEASURE_DELAY_MS = 350;

export interface TeamCaracs {
    ego: number;
    damage: number;
    defense: number;
    chance: number;
}

export interface MeasuredTeam<T> {
    candidate: T;
    caracs: TeamCaracs;
    totalPower: number;
    effectivePower: number;
}

export type ElementCounts = Partial<Record<ElementType, number>>;

export class TeamEvaluationService {

    /**
     * Harem-wide synergy share per element, read from the game's own
     * `synergies` payload on the edit-team page. Falls back to the
     * fully-built harem values when the page does not expose it.
     */
    static getHaremSynergies(): Record<ElementType, number> {
        const out = { ...HAREM_SYNERGY_FALLBACK };
        const live = getHHVars('synergies', false);
        if (!Array.isArray(live)) return out;
        for (const entry of live) {
            const type = entry?.element?.type as ElementType | undefined;
            if (!type || !(type in out)) continue;
            const harem = Number(entry.harem_bonus_multiplier);
            if (Number.isFinite(harem)) out[type] = harem;
        }
        return out;
    }

    /** Team + harem synergy share for one element, capped like the game does. */
    static getSynergy(
        counts: ElementCounts,
        element: ElementType,
        harem: Record<ElementType, number> = HAREM_SYNERGY_FALLBACK,
    ): number {
        const teamShare = Math.min(
            (counts[element] || 0) * SYNERGY_PER_GIRL[element],
            SYNERGY_MAX[element],
        );
        return teamShare + (harem[element] ?? 0);
    }

    /** Element histogram of a team. */
    static countElements(elements: ElementType[]): ElementCounts {
        const counts: ElementCounts = {};
        for (const e of elements) counts[e] = (counts[e] || 0) + 1;
        return counts;
    }

    /**
     * Time-to-kill scalar: expected damage per hit times survivability.
     * Pure -- takes the measured stats and the team's element histogram.
     */
    static computeEffectivePower(
        caracs: TeamCaracs,
        counts: ElementCounts,
        harem: Record<ElementType, number> = HAREM_SYNERGY_FALLBACK,
    ): number {
        const syn = (e: ElementType) => TeamEvaluationService.getSynergy(counts, e, harem);

        const critChance = Math.min(CRIT_CHANCE_CAP, NEUTRAL_CRIT_SHARE + syn('stone'));
        const critMultiplier = CRIT_BASE_MULTIPLIER + syn('fire');
        const expectedHit = 1 - critChance + critChance * critMultiplier;

        const offence = (Number(caracs.damage) || 0) * expectedHit * (1 + syn('sun'));
        const defence = (Number(caracs.ego) || 0) * (1 + syn('water'));
        return offence * defence;
    }

    /** Which battle type the current edit-team screen belongs to. */
    static getBattleType(): string {
        const fromPage = getHHVars('battle_type', false);
        if (typeof fromPage === 'string' && fromPage.length > 0) return fromPage;
        const fromUrl = new URLSearchParams(window.location.search).get('battle_type');
        return fromUrl || 'leagues';
    }

    /**
     * Ask the game to calculate one team's stats. Resolves null when hh_ajax
     * is missing or the call fails, so the caller can fall back.
     */
    static measureTeam(girlIds: number[], battleType: string): Promise<{ caracs: TeamCaracs; totalPower: number } | null> {
        const ajax = getHHAjax();
        if (!ajax) return Promise.resolve(null);
        return new Promise((resolve) => {
            let settled = false;
            const done = (value: { caracs: TeamCaracs; totalPower: number } | null) => {
                if (settled) return;
                settled = true;
                resolve(value);
            };
            setTimeout(() => done(null), 15000);
            try {
                ajax({
                    action: 'team_calculate_caracs',
                    girls: girlIds.map(String),
                    battle_type: battleType,
                }, (data: any) => {
                    if (!data || !data.caracs) return done(null);
                    done({
                        caracs: {
                            ego: Number(data.caracs.ego) || 0,
                            damage: Number(data.caracs.damage) || 0,
                            defense: Number(data.caracs.defense) || 0,
                            chance: Number(data.caracs.chance) || 0,
                        },
                        totalPower: Number(data.total_power) || 0,
                    });
                });
            } catch (err) {
                logHHAuto('TeamEvaluationService: team_calculate_caracs failed: ' + err);
                done(null);
            }
        });
    }

    /**
     * Measure every candidate and return them ranked by effective power.
     * Returns an empty array when the game calculation is unavailable --
     * the caller then keeps its caracs_sum ranking.
     */
    static async rankCandidates<T>(
        candidates: T[],
        girlIdsOf: (candidate: T) => number[],
        elementsOf: (candidate: T) => ElementType[],
    ): Promise<MeasuredTeam<T>[]> {
        if (candidates.length === 0 || !getHHAjax()) return [];

        const battleType = TeamEvaluationService.getBattleType();
        const harem = TeamEvaluationService.getHaremSynergies();
        const measured: MeasuredTeam<T>[] = [];

        for (const candidate of candidates) {
            const ids = girlIdsOf(candidate);
            const result = await TeamEvaluationService.measureTeam(ids, battleType);
            if (!result) {
                logHHAuto('TeamEvaluationService: no game calculation for a candidate, keeping stat-sum ranking');
                return [];
            }
            const counts = TeamEvaluationService.countElements(elementsOf(candidate));
            measured.push({
                candidate,
                caracs: result.caracs,
                totalPower: result.totalPower,
                effectivePower: TeamEvaluationService.computeEffectivePower(result.caracs, counts, harem),
            });
            await new Promise(r => setTimeout(r, MEASURE_DELAY_MS));
        }

        measured.sort((a, b) => b.effectivePower - a.effectivePower);
        return measured;
    }
}
