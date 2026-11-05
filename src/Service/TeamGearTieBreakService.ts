// TeamGearTieBreakService.ts -- Among the teams the team calculation cannot
// tell apart, the one Best gear can give the most resonance.
//
// The team calculation scores girls without gear (TeamSelectionPopup), so
// it does not see which girls the player's equipment fits. Many girls are
// exactly alike for it: same stats, same element, same Tier-3 trait value.
// Swapping one of them for another leaves every input of the team model
// unchanged -- the stat sum, the element counts, the Tier-3 bonus -- and so
// the score. Which of them is picked was left to candidate order. Here it is
// the one for which Best gear (TeamGearService.planTeamGear) hands out the
// most resonance matches.
//
// Measured on one account: in one week the positions 6 and 7 had five to six
// such partners each and the swaps raised the matches from 37 to 47; in the
// next week no position had any partner and nothing changed.
//
// Two rules that are not obvious:
//
//   1. Only an exact tie counts. How much a resonance percent is worth
//      against stats is not measurable client-side (equipment-resonance.md:
//      every before/after path reads 0.00 %), so resonance never outweighs
//      any stat difference. A swap whose model inputs differ at all is
//      rejected, whatever the prefilter said.
//   2. The gear is planned as after Unequip All: every item any girl wears
//      is in the pool and the team girls wear nothing. The team calculation
//      itself scores the girls as Unequip & Unskill would leave them.
//
// The objective is planTeamGear's own: the count of resonance matches, then
// the sum of their bonus percent. The leader stays.
//
// Depends on: TeamGearService.ts, TeamScoringService.ts, TeamSelectionService.ts,
//   SkillModelService.ts
// Used by: Module/TeamSelectionPopup.ts

import { GirlGearItem, TeamGearGirl, TeamGearMode, planTeamGear } from './TeamGearService';
import { GirlData, TeamScoringService } from './TeamScoringService';
import { TeamSelectionService } from './TeamSelectionService';
import { SkillHorizon, SkillModelService } from './SkillModelService';

/** The girls of one rubric, as TeamSelectionPopup scores them. */
export interface TieBreakPool {
    /** Without gear and skills (Tier-3 points are read from these). */
    base: GirlData[];
    /** With the Tier-2 stats Stuff Team gives (the stat sum is read from these). */
    evaluated: GirlData[];
}

/** One availableGirls entry as far as the gear plan reads it. */
export interface GearWearerRaw extends Partial<Pick<TeamGearGirl, 'class' | 'element' | 'figure'>> {
    id_girl: number | string;
    name?: string;
    armor?: unknown;
}

export interface GearTally {
    matches: number;
    /** Matches per axis: favourite position, class, element. */
    figure: number;
    cls: number;
    element: number;
    /** Sum of the matched bonuses in percent. */
    bonus: number;
}

export interface TieBreakSwap {
    /** Team position, 0 = leader. */
    position: number;
    from: number;
    to: number;
}

export interface TieBreakResult {
    ids: number[];
    swaps: TieBreakSwap[];
    before: GearTally;
    after: GearTally;
}

interface ModelInputs { sum: number; counts: string; tier3: number }

/** Rounds of single swaps at most; each round tries every partner on every position. */
const MAX_ROUNDS = 10;

export class TeamGearTieBreakService {

    /** What the team model reads of a team (TeamSelectionPopup.statsOf). */
    static modelInputs(pool: TieBreakPool, ids: number[], horizon: SkillHorizon): ModelInputs {
        const evaluated = ids.map(id => pool.evaluated.find(g => g.id_girl === id)!);
        const base = ids.map(id => pool.base.find(g => g.id_girl === id)!);
        return {
            sum: TeamSelectionService.caracSum(evaluated),
            counts: JSON.stringify(TeamSelectionService.countElements(evaluated)),
            tier3: SkillModelService.tier3Bonus(base, g => SkillModelService.targetPoints(g, 3, horizon)),
        };
    }

    static sameInputs(a: ModelInputs, b: ModelInputs): boolean {
        return Math.abs(a.sum - b.sum) <= 1e-9 * Math.max(1, Math.abs(a.sum))
            && a.counts === b.counts
            && Math.abs(a.tier3 - b.tier3) <= 1e-12;
    }

    /**
     * Girls outside the team that could stand on `position` without changing
     * anything the team model reads: same element, rarity, stat sum, Tier-3
     * trait value and Tier-3 points. Only the eligible pool counts.
     */
    static partners(pool: TieBreakPool, ids: number[], position: number, horizon: SkillHorizon): number[] {
        const x = pool.evaluated.find(g => g.id_girl === ids[position]);
        const xb = pool.base.find(g => g.id_girl === ids[position]);
        if (!x || !xb) return [];
        const xSum = TeamScoringService.caracsSum(x);
        const xTrait = TeamScoringService.getTraitValue(xb);
        const xPoints = SkillModelService.targetPoints(xb, 3, horizon);
        const baseById = new Map(pool.base.map(g => [g.id_girl, g] as [number, GirlData]));
        return TeamScoringService.filterEligible(pool.evaluated)
            .filter(y => !ids.includes(y.id_girl)
                && y.element === x.element
                && y.rarity === x.rarity
                && Math.abs(TeamScoringService.caracsSum(y) - xSum) <= 1e-9 * Math.max(1, xSum))
            .filter(y => {
                const yb = baseById.get(y.id_girl);
                return !!yb && TeamScoringService.getTraitValue(yb) === xTrait
                    && SkillModelService.targetPoints(yb, 3, horizon) === xPoints;
            })
            .map(y => y.id_girl);
    }

    /**
     * The pool after Unequip All: the free items plus every item any girl
     * wears. A worn item has only id_girl_armor_equipped; it gets a negative
     * id_girl_armor of its own so the plan can tell the pieces apart.
     */
    static unequippedInventory(free: GirlGearItem[], wearers: GearWearerRaw[]): GirlGearItem[] {
        const out = free.slice();
        for (const w of wearers) {
            const armor = Array.isArray(w.armor) ? w.armor as GirlGearItem[] : [];
            for (const a of armor) out.push({ ...a, id_girl_armor: -Math.abs(Number(a.id_girl_armor_equipped) || 0) });
        }
        return out;
    }

    /** The matches Best gear hands this team out of `inventory`, the girls wearing nothing. */
    static tally(ids: number[], wearers: Map<number, GearWearerRaw>, inventory: GirlGearItem[], mode: TeamGearMode): GearTally {
        const girls: TeamGearGirl[] = ids.map(id => {
            const w = wearers.get(id);
            return { id_girl: id, name: String(w?.name ?? id), class: w?.class, element: w?.element, figure: w?.figure, armor: [] } as TeamGearGirl;
        });
        const t: GearTally = { matches: 0, figure: 0, cls: 0, element: 0, bonus: 0 };
        planTeamGear(girls, inventory, mode).forEach((plan, i) => {
            const girl = girls[i];
            for (const s of plan.slots) {
                const rb = s.chosen?.resonance_bonuses as Record<string, { identifier?: unknown; bonus?: unknown }> | unknown[] | undefined;
                if (!rb || Array.isArray(rb)) continue;
                if (rb.figure && String(rb.figure.identifier) === String(girl.figure)) { t.figure++; t.bonus += Number(rb.figure.bonus) || 0; }
                if (rb.class && String(rb.class.identifier) === String(girl.class)) { t.cls++; t.bonus += Number(rb.class.bonus) || 0; }
                if (rb.element && String(rb.element.identifier) === String(girl.element)) { t.element++; t.bonus += Number(rb.element.bonus) || 0; }
            }
        });
        t.matches = t.figure + t.cls + t.element;
        return t;
    }

    static better(a: GearTally, b: GearTally): boolean {
        return a.matches > b.matches || (a.matches === b.matches && a.bonus > b.bonus + 1e-9);
    }

    /**
     * Single swaps against exact partners, kept while Best gear gets more
     * out of them, until no swap helps. `gearOf` scores a team.
     */
    static improve(ids: number[], pool: TieBreakPool, horizon: SkillHorizon, gearOf: (ids: number[]) => GearTally): TieBreakResult {
        const reference = TeamGearTieBreakService.modelInputs(pool, ids, horizon);
        const partners = ids.map((_, pos) => (pos === 0 ? [] : TeamGearTieBreakService.partners(pool, ids, pos, horizon)));
        const before = gearOf(ids);
        let bestIds = ids.slice();
        let best = before;
        for (let round = 0; round < MAX_ROUNDS; round++) {
            let changed = false;
            for (let pos = 1; pos < ids.length; pos++) {
                for (const candidate of [ids[pos], ...partners[pos]]) {
                    if (candidate === bestIds[pos] || bestIds.includes(candidate)) continue;
                    const team = bestIds.slice();
                    team[pos] = candidate;
                    if (!TeamGearTieBreakService.sameInputs(TeamGearTieBreakService.modelInputs(pool, team, horizon), reference)) continue;
                    const g = gearOf(team);
                    if (TeamGearTieBreakService.better(g, best)) { best = g; bestIds = team; changed = true; }
                }
            }
            if (!changed) break;
        }
        const swaps = bestIds.map((to, position) => ({ position, from: ids[position], to })).filter(s => s.from !== s.to);
        return { ids: bestIds, swaps, before, after: best };
    }
}
