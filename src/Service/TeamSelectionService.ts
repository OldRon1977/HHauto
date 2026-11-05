// TeamSelectionService.ts -- Pure helpers behind the team selection rubrics
// of the Team optimization popup on the edit-team page: three groups (this
// week by stats, this week against the open league opponents, next week by
// stats), each as the best team now and the possibly best one.
//
// Why a wider candidate set: the builder ranks girls by caracs_sum, which
// weighs carac1, carac2 and carac3 alike, and so does the game's team
// calculation (below). What caracs_sum misses is the element synergy and the
// Tier-3 trait bonus; one round of single swaps around the stat-sum pick
// finds girls who win on those.
//
// Why the opponents are weighed by open fights: a league opponent can be
// fought exactly three times. One who has been fought three times no longer
// matters for the team, one with a single fight left matters a third.
//
// The team stats: the game's own calculation (team_calculate_caracs) is, per
// stat, linear in the sum of the seven girls' caracs, times the element
// synergy of that stat:
//
//   stat = (a + b x sum of carac1..3) x (1 + synergy)     damage also x (1 + Tier 3)
//
// Measured on two games, 200 and 70 teams of girls without gear: within
// 0.06 % and 0.09 %; carac1, carac2 and carac3 count alike, the hero class
// does not enter. a and b belong to the account and its boosters (the hero's
// stats, the boosters active) -- measured, an expiring booster moved ego by
// 18 % -- so they are fitted on teams the game calculates when the popup
// needs them (fitTeamModel), not fixed. Harmony (chance) does not depend on
// the girls (slope 0). Gear does not fit this formula: an item adds ego,
// damage and defense of its own on top of its caracs, with resonance -- the
// calibration teams therefore hold no girl with gear.
//
// With the model the girls can be scored in a state the game cannot
// calculate: without their gear and skills (BaseStatsService), fully
// developed, or with next week's blessings.
//
// Depends on: BDSMHelper.ts (league fight simulation), TeamEvaluationService.ts (synergies)
// Used by: TeamSelectionPopup.ts

import { BDSMHelper, calculateBattleProbabilities } from '../Helper/BDSMHelper';
import { TeamCaracs, TeamEvaluationService, ElementCounts } from './TeamEvaluationService';
import { ElementType, GirlData, TeamScoringService } from './TeamScoringService';

/** Swap partners tried per position around the stat-sum pick. */
export const SWAP_ALTERNATIVES = 15;

/** A league opponent can be fought this many times per league week. */
export const FIGHTS_PER_OPPONENT = 3;

const ELEMENTS: ElementType[] = ['fire', 'water', 'nature', 'stone', 'sun', 'darkness', 'light', 'psychic'];

/** Element whose team synergy multiplies each stat (game `synergies` payload). */
const STAT_SYNERGY: Record<keyof TeamCaracs, ElementType> = {
    ego: 'nature',
    damage: 'darkness',
    defense: 'light',
    chance: 'psychic',
};

/** Calibration teams the game calculates for the team model. */
export const CALIBRATION_TEAMS = 10;

/** Skill tiers as the game sends them, reduced to the points used. */
export type SkillTiers = Record<string, { skill_points_used?: number } | undefined>;

/** One side of a league fight in the shape BDSMHelper.getBdsmPlayersData reads. */
export interface FighterData {
    damage: number;
    defense: number;
    remaining_ego: number;
    chance: number;
    nickname?: string;
    team: {
        theme_elements: { type: string }[];
        synergies: { element: { type: string }; bonus_multiplier: number }[];
        girls: { skill_tiers_info: SkillTiers; girl: { element_data: { type: string } } }[];
    };
}

/** What the simulator needs from one opponent, nothing more. */
export interface SnapshotOpponent {
    openFights: number;
    player: FighterData;
}

/** Per stat: stat = (a + b x carac sum) x (1 + synergy); harmony has no slope. */
export interface TeamStatModel {
    ego: [number, number];
    damage: [number, number];
    defense: [number, number];
    chance: [number, number];
}

/** One team the game calculated, reduced to what the model is fitted on. */
export interface CalibrationSample {
    /** Sum of carac1..3 over the seven girls, as the game holds them today. */
    sum: number;
    counts: ElementCounts;
    /** Tier-3 bonus the girls hold today (it sits in the measured damage). */
    tier3: number;
    caracs: TeamCaracs;
}

export interface OpponentScore {
    /** Expected league points over all open fights. */
    points: number;
    /** Win chance averaged over the open fights. */
    winChance: number;
    /** Open fights the score covers. */
    fights: number;
}

export class TeamSelectionService {

    /** Order-independent identity of a team. */
    static teamKey(ids: number[]): string {
        return [...ids].sort((a, b) => a - b).join(',');
    }

    /**
     * Every team that differs from `base` in one of the positions 2-7, the
     * swap partner taken from the `alternatives` strongest girls of the pool
     * by caracs_sum that are not in the team. Position 1 stays: the leader
     * rule (Mythic with the Tier-5 Shield first) is not up for trade.
     */
    static buildSwapNeighbours(base: number[], pool: GirlData[], alternatives: number = SWAP_ALTERNATIVES): number[][] {
        const inTeam = new Set(base);
        const partners = pool
            .filter(g => !inTeam.has(g.id_girl))
            .sort((a, b) => TeamScoringService.caracsSum(b) - TeamScoringService.caracsSum(a))
            .slice(0, alternatives)
            .map(g => g.id_girl);
        const out: number[][] = [];
        for (let pos = 1; pos < base.length; pos++) {
            for (const partner of partners) {
                const team = [...base];
                team[pos] = partner;
                out.push(team);
            }
        }
        return out;
    }

    /**
     * Open fights against one opponent: the `null` entries of his
     * match_history record. Counted here rather than through
     * LeagueHelper.numberOfFightAvailable, which answers 1 for every
     * opponent while autoLeaguesForceOneFight is on -- right for the fight
     * loop, wrong for a count.
     */
    static openFights(history: unknown[] | undefined | null): number {
        if (!Array.isArray(history)) return 0;
        const open = history.filter(entry => entry === null || entry === undefined).length;
        return Math.max(0, Math.min(FIGHTS_PER_OPPONENT, open));
    }

    /** Element histogram of the girls. */
    static countElements(girls: GirlData[]): ElementCounts {
        return TeamEvaluationService.countElements(girls.map(g => g.element));
    }

    /**
     * The shape BDSMHelper.getBdsmPlayersData reads for our side, built from
     * the stats the game calculated for the team: team and harem synergy per
     * element, the theme from three girls of one element on, and the girls'
     * skill tiers for the Tier-4/Tier-5 estimate (leader first).
     */
    static buildHeroFighter(caracs: TeamCaracs, girls: GirlData[], harem: Record<ElementType, number>): FighterData {
        const counts = TeamSelectionService.countElements(girls);
        return {
            damage: caracs.damage,
            defense: caracs.defense,
            chance: caracs.chance,
            remaining_ego: caracs.ego,
            nickname: '',
            team: {
                theme_elements: ELEMENTS.filter(e => (counts[e] || 0) >= 3).map(type => ({ type })),
                synergies: ELEMENTS.map(e => ({
                    element: { type: e },
                    bonus_multiplier: TeamEvaluationService.getSynergy(counts, e, harem),
                })),
                girls: girls.map(g => ({
                    skill_tiers_info: (g.skill_tiers_info || {}) as SkillTiers,
                    girl: { element_data: { type: g.element } },
                })),
            },
        };
    }

    /** Expected league points and win chance of one simulated fight. */
    static simulateFight(hero: FighterData, opponent: FighterData): { points: number; win: number } {
        const players = BDSMHelper.getBdsmPlayersData(hero, opponent, true);
        // BDSMSimu declares points as number[]; at runtime it is a map from
        // point value to probability (see bdsm-battle-simulator.md).
        const simu = calculateBattleProbabilities(players.player, players.opponent) as unknown as
            { points?: Record<string, number>; win?: number } | undefined;
        let points = 0;
        if (simu && simu.points) {
            for (const [value, probability] of Object.entries(simu.points)) {
                points += Number(value) * Number(probability);
            }
        }
        return { points, win: Number(simu?.win) || 0 };
    }

    /**
     * Score one team against the snapshot: every opponent counts as often as
     * he can still be fought, opponents fought three times not at all.
     */
    static scoreAgainstOpponents(
        hero: FighterData,
        opponents: SnapshotOpponent[],
        simulate: (hero: FighterData, opponent: FighterData) => { points: number; win: number } = TeamSelectionService.simulateFight,
    ): OpponentScore {
        let points = 0;
        let wins = 0;
        let fights = 0;
        for (const opponent of opponents) {
            const weight = Math.max(0, Math.min(FIGHTS_PER_OPPONENT, opponent.openFights));
            if (weight === 0) continue;
            const result = simulate(hero, opponent.player);
            points += weight * result.points;
            wins += weight * result.win;
            fights += weight;
        }
        return { points, winChance: fights > 0 ? wins / fights : 0, fights };
    }

    /**
     * Hand the thread back to the page for one turn. Through a MessageChannel,
     * not setTimeout(0): browsers stretch zero timers (4 ms when nested, up to
     * a second in a tab that is not in front), and measured live the sliced
     * simulation had covered 37 of 96 teams after 88 seconds that way.
     */
    static yieldToPage(): Promise<void> {
        if (typeof MessageChannel === 'undefined') return new Promise(r => setTimeout(r, 0));
        return new Promise(resolve => {
            const channel = new MessageChannel();
            channel.port1.onmessage = () => { channel.port1.close(); resolve(); };
            channel.port2.postMessage(null);
        });
    }

    /**
     * scoreAgainstOpponents for the page: the same sums, but the thread is
     * handed back every `sliceMs`. Seventy-odd fights in one go froze the
     * tab ("page not responding") on a player's machine.
     */
    static async scoreAgainstOpponentsSliced(
        hero: FighterData,
        opponents: SnapshotOpponent[],
        sliceMs: number = 25,
        simulate: (hero: FighterData, opponent: FighterData) => { points: number; win: number } = TeamSelectionService.simulateFight,
    ): Promise<OpponentScore> {
        let points = 0;
        let wins = 0;
        let fights = 0;
        let sliceStart = Date.now();
        for (const opponent of opponents) {
            const weight = Math.max(0, Math.min(FIGHTS_PER_OPPONENT, opponent.openFights));
            if (weight === 0) continue;
            const result = simulate(hero, opponent.player);
            points += weight * result.points;
            wins += weight * result.win;
            fights += weight;
            if (Date.now() - sliceStart >= sliceMs) {
                await TeamSelectionService.yieldToPage();
                sliceStart = Date.now();
            }
        }
        return { points, winChance: fights > 0 ? wins / fights : 0, fights };
    }

    // ---- Team stat model ---------------------------------------------------

    /**
     * Teams for the calibration of the team model: from girls without gear
     * (Tier 2 and Tier 3 are fine -- Tier 2 sits in the caracs, Tier 3 is
     * divided out), strongest first. The strongest seven and the weakest
     * seven of the pool spread the carac sums; the rest are shuffled with a
     * fixed seed, so the same harem gives the same teams.
     */
    static calibrationTeams(pool: GirlData[], count: number = CALIBRATION_TEAMS): number[][] {
        if (pool.length < 7) return [];
        const sorted = [...pool].sort((a, b) => TeamScoringService.caracsSum(b) - TeamScoringService.caracsSum(a)).slice(0, 120);
        const ids = sorted.map(g => g.id_girl);
        const teams: number[][] = [ids.slice(0, 7), ids.slice(-7)];
        let seed = 12345;
        const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
        for (let tries = 0; teams.length < count && tries < count * 20; tries++) {
            const team = new Set<number>();
            while (team.size < 7) team.add(ids[Math.floor(next() * ids.length)]);
            teams.push([...team]);
        }
        const seen = new Set<string>();
        return teams.filter(t => { const k = TeamSelectionService.teamKey(t); if (seen.has(k)) return false; seen.add(k); return true; });
    }

    /**
     * Least-squares fit of the team model on teams the game calculated;
     * null when the samples cannot carry a slope (fewer than three, or all
     * with the same carac sum).
     */
    static fitTeamModel(samples: CalibrationSample[], harem: Record<ElementType, number>): TeamStatModel | null {
        if (samples.length < 3) return null;
        const fit = (stat: keyof TeamCaracs): [number, number] | null => {
            const el = STAT_SYNERGY[stat];
            const xs = samples.map(s => s.sum);
            const ys = samples.map(s => s.caracs[stat] / (1 + TeamEvaluationService.getSynergy(s.counts, el, harem))
                / (stat === 'damage' ? 1 + s.tier3 : 1));
            const n = xs.length;
            const mx = xs.reduce((a, b) => a + b, 0) / n;
            const my = ys.reduce((a, b) => a + b, 0) / n;
            let sxx = 0;
            let sxy = 0;
            for (let i = 0; i < n; i++) {
                sxx += (xs[i] - mx) * (xs[i] - mx);
                sxy += (xs[i] - mx) * (ys[i] - my);
            }
            if (stat === 'chance') return [my, 0];
            if (sxx <= 1e-9 * n * Math.max(1, mx * mx)) return null;
            const b = sxy / sxx;
            return [my - b * mx, b];
        };
        const ego = fit('ego');
        const damage = fit('damage');
        const defense = fit('defense');
        const chance = fit('chance');
        if (!ego || !damage || !defense || !chance) return null;
        return { ego, damage, defense, chance };
    }

    /** Largest relative miss of the model on the samples it was fitted on. */
    static modelError(model: TeamStatModel, samples: CalibrationSample[], harem: Record<ElementType, number>): number {
        let worst = 0;
        for (const s of samples) {
            const c = TeamSelectionService.modelCaracs(model, s.sum, s.counts, s.tier3, harem);
            for (const stat of ['ego', 'damage', 'defense'] as const) {
                if (s.caracs[stat] > 0) worst = Math.max(worst, Math.abs(c[stat] / s.caracs[stat] - 1));
            }
        }
        return worst;
    }

    /** Team stats for a carac sum, the team's elements and its Tier-3 bonus. */
    static modelCaracs(model: TeamStatModel, sum: number, counts: ElementCounts, tier3: number, harem: Record<ElementType, number>): TeamCaracs {
        const stat = (k: keyof TeamCaracs) =>
            (model[k][0] + model[k][1] * sum) * (1 + TeamEvaluationService.getSynergy(counts, STAT_SYNERGY[k], harem));
        return { ego: stat('ego'), damage: stat('damage') * (1 + tier3), defense: stat('defense'), chance: stat('chance') };
    }

    /** Sum of carac1..3 over the girls. */
    static caracSum(girls: GirlData[]): number {
        return girls.reduce((sum, g) => sum + TeamScoringService.caracsSum(g), 0);
    }
}
