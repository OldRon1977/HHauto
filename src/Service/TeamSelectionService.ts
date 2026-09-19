// TeamSelectionService.ts -- Pure helpers behind the three team selection
// modes of the edit-team popup (this week by stats, this week against the
// open league opponents, next week by stats).
//
// Why a wider candidate set: the builder ranks girls by caracs_sum, which
// weighs carac1, carac2 and carac3 alike. The game does not -- measured on a
// live account (2026-09-19), a class-1 mythic with 2,270 LESS caracs_sum
// raised the team's damage by 5,374, and the team with her won 80.3 % of the
// simulated league fights against 79.3 % for the stat-sum pick. She stood
// 14th by caracs_sum. One round of single swaps around the stat-sum pick,
// measured by the game, finds such girls; 373 measured teams found nothing a
// single swap could still improve.
//
// Why the opponents are weighed by open fights: a league opponent can be
// fought exactly three times. One who has been fought three times no longer
// matters for the team, one with a single fight left matters a third.
//
// Why next week and full development need a model: the game calculates the
// girls as they are today, with today's blessings. Ego is exactly additive in
// the girls' caracs (measured: 0.07 % over 173 teams); damage and defense are
// not (up to 5 %). The projection therefore starts from the stats the game
// measured TODAY for the same seven girls and adds only the change of their
// carac sum, times a slope fitted over all measured candidates (fitSumSlope).
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
const STAT_SYNERGY: Partial<Record<keyof TeamCaracs, ElementType>> = {
    ego: 'nature',
    damage: 'darkness',
    defense: 'light',
};

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

    // ---- Next-week projection -------------------------------------------

    /** Sum of each carac over the team. */
    static caracSums(girls: GirlData[]): [number, number, number] {
        const sums: [number, number, number] = [0, 0, 0];
        for (const g of girls) {
            const c = g.caracs ?? { carac1: g.carac1, carac2: g.carac2, carac3: g.carac3 };
            sums[0] += Number(c.carac1) || 0;
            sums[1] += Number(c.carac2) || 0;
            sums[2] += Number(c.carac3) || 0;
        }
        return sums;
    }

    /**
     * Least-squares slope of `stat / (1 + synergy)` against the team's carac
     * sum, over every team the game has measured; null when the samples
     * cannot carry it. One slope, not one per carac: the candidates are
     * single swaps of one another, so their carac1/2/3 sums move together and
     * three separate slopes came out unstable -- measured live, the same team
     * read 3 % weaker fully developed than as it is, because the slopes had
     * tipped when new candidates joined the fit. Never negative: more caracs
     * cannot cost stats.
     */
    static fitSumSlope(samples: { sum: number; value: number }[]): number | null {
        if (samples.length < 6) return null;
        const n = samples.length;
        const mx = samples.reduce((s, x) => s + x.sum, 0) / n;
        const my = samples.reduce((s, x) => s + x.value, 0) / n;
        let sxx = 0;
        let sxy = 0;
        for (const x of samples) {
            sxx += (x.sum - mx) * (x.sum - mx);
            sxy += (x.sum - mx) * (x.value - my);
        }
        if (sxx <= 1e-9 * n * Math.max(1, mx * mx)) return null;
        return Math.max(0, sxy / sxx);
    }

    /**
     * Next week's stats for a team: the stats the game measured today for
     * the same girls, plus the fitted effect of the carac change. Harmony
     * does not follow the girls' caracs (measured slope 0), so it stays.
     */
    static projectCaracs(
        measuredToday: TeamCaracs,
        sumsToday: [number, number, number],
        sumsNext: [number, number, number],
        counts: ElementCounts,
        harem: Record<ElementType, number>,
        slopes: Partial<Record<keyof TeamCaracs, number | null>>,
    ): TeamCaracs {
        const out: TeamCaracs = { ...measuredToday };
        for (const stat of ['ego', 'damage', 'defense'] as const) {
            const synergyElement = STAT_SYNERGY[stat]!;
            const multiplier = 1 + TeamEvaluationService.getSynergy(counts, synergyElement, harem);
            const slope = slopes[stat];
            if (slope !== null && slope !== undefined) {
                const delta = (sumsNext[0] + sumsNext[1] + sumsNext[2]) - (sumsToday[0] + sumsToday[1] + sumsToday[2]);
                out[stat] = measuredToday[stat] + multiplier * slope * delta;
            } else {
                // No fit: scale with the total, the rough share the girls carry.
                const today = sumsToday[0] + sumsToday[1] + sumsToday[2];
                const next = sumsNext[0] + sumsNext[1] + sumsNext[2];
                out[stat] = today > 0 ? measuredToday[stat] * (next / today) : measuredToday[stat];
            }
        }
        return out;
    }

    /**
     * Factor from today's caracs to a girl's caracs at full development
     * (level 750, every grade) -- the projection of "Best Possible"
     * (TeamScoringService.scoreBestPossible), as a multiplier on the caracs.
     */
    static developmentFactor(girl: GirlData): number {
        const today = TeamScoringService.caracsSum(girl);
        if (today <= 0) return 1;
        return TeamScoringService.scoreBestPossible(girl) / today;
    }

    /** Which stat a synergy element scales, for the fit in the popup. */
    static synergyElementOf(stat: keyof TeamCaracs): ElementType | undefined {
        return STAT_SYNERGY[stat];
    }
}
