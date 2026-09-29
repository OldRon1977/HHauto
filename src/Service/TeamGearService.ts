// TeamGearService.ts -- Pure planning for "Best gear" and "Possibly best
// gear": which item each team girl should wear in each of her six slots.
//
// The whole team is planned at once, slot by slot. For one slot the pool is
// every item in the inventory plus what the team girls wear there; items
// other girls wear are not in play (a player who wants them pressed Unequip
// All first). Two rules decide, in this order:
//
//   1. The stats go down the team in order. The girl in position 1 gets an
//      item of the highest stat sum in the pool, position 2 the next, and so
//      on -- so the girls get L10 mythics in team order, as many as there
//      are, and when they run out the later girls get legendaries, epics.
//      The stat sum is scoreItem's (HaremGirl.pure): all six stats added
//      up. Within one rarity and level every item has the same sum
//      (measured: every L10 mythic 1545), so rule 1 fixes which rarity and
//      level each girl gets.
//   2. Among the items of the same sum, the girls get the distribution with
//      the most resonance matches for the team. On a tie the earlier girls'
//      matches count first, then the higher real level (less to level up),
//      then keeping what a girl already wears.
//
// Rule 2 is why this is not decided girl by girl: every L10 mythic has the
// same stats, and a leader who takes the first one that fits her equally
// well takes the one a later girl would have matched on two axes.
//
// In "possibly best" every mythic sits in the level 10 tier, so resonance
// decides before the real level: a low mythic that fits an earlier girl
// better replaces her finished one, which goes to a later girl. That is the
// player's decision, not an oversight -- the plan is the team after Level-up
// gear, even if it is weaker until the material for that is there.
//
// "Possibly best" ranks a mythic below level 10 by the stats it will have at
// level 10, because Level-up gear takes worn mythics there. The game stores
// an item's base stats (`armor`) and shows base times level, rounded
// (measured: a legendary with damage 6.5 shows 7 at level 1 and 13 at level
// 2), so the level 10 value is the base times 10 -- not the shown level 1
// value times 10, which rounds a mythic's 7.5 damage up to 8 and made an L1
// mythic look 5 points better than a real L10 one. Every other rarity counts
// as it is: nothing in the script levels it.
//
// Used by: Module/TeamGear.ts

import { EquipmentItem, EquipmentScore, EquipmentWearer, scoreItem } from '../Module/harem/HaremGirl.pure';

export type TeamGearMode = 'best' | 'possible';

/** Level-up gear's cap on girl items (upgradeable_item_max_level). */
const GIRL_GEAR_CAP = 10;

export const GIRL_GEAR_SLOTS = [1, 2, 3, 4, 5, 6] as const;

type Stats = EquipmentItem['caracs'];

/** One piece of girl equipment as the game sends it. The inventory list
 *  (girl_equipment_list) and the worn armor (availableGirls[].armor) share
 *  these fields; only the id differs. */
export interface GirlGearItem extends EquipmentItem {
    /** Inventory item. */
    id_girl_armor?: number | string;
    /** Worn item. */
    id_girl_armor_equipped?: number | string;
    slot_index: number | string;
    level: number | string;
    rarity: string;
    /** Base stats: the shown stats are these times the level, rounded. */
    armor?: Stats;
    skin?: { name?: string };
}

export interface TeamGearGirl extends EquipmentWearer {
    id_girl: number;
    name: string;
    armor: GirlGearItem[];
}

/** Where a planned item is when the plan is made. */
export type GearSource =
    /** In the inventory, under this id_girl_armor. */
    | { kind: 'inventory'; id: number }
    /** Worn by a team girl in this slot. Its inventory id only exists once
     *  she has let go of it -- by putting on her own new item, or by taking
     *  it off. */
    | { kind: 'worn'; fromGirl: number; slot: number; idEquipped: number };

export interface SlotPlan {
    slot: number;
    current: GirlGearItem | null;
    /** The item she ends up with: her current one when she keeps it, null
     *  when her item goes to an earlier girl and nothing is left for her. */
    chosen: GirlGearItem | null;
    change: boolean;
    /** Where `chosen` comes from; set when change is true and chosen is not
     *  null. */
    source: GearSource | null;
    currentScore: EquipmentScore | null;
    chosenScore: EquipmentScore | null;
}

export interface GirlPlan {
    /** Team position, 0 = leader. */
    position: number;
    id_girl: number;
    name: string;
    slots: SlotPlan[];
}

/**
 * The item as the chosen mode ranks it. In 'possible' mode a mythic below
 * level 10 gets its level 10 stats; everything else is unchanged.
 */
export function rankedItem(item: GirlGearItem, mode: TeamGearMode): GirlGearItem {
    const level = Number(item.level);
    if (mode !== 'possible' || item.rarity !== 'mythic' || !(level > 0) || level >= GIRL_GEAR_CAP) return item;
    const base = item.armor;
    const at10 = (key: keyof Stats): number | undefined => {
        const b = base?.[key];
        if (typeof b === 'number') return Math.round(b * GIRL_GEAR_CAP);
        const shown = item.caracs?.[key];
        return shown === undefined ? undefined : shown * GIRL_GEAR_CAP / level;
    };
    return {
        ...item,
        caracs: {
            carac1: at10('carac1'), carac2: at10('carac2'), carac3: at10('carac3'),
            damage: at10('damage'), defense: at10('defense'), ego: at10('ego'),
        },
    };
}

interface PoolEntry {
    item: GirlGearItem;
    source: GearSource;
    /** Stat sum as the mode ranks it. */
    sum: number;
    order: number;
}

/**
 * The plan for the whole team.
 *
 * `girls` in team order, leader first, with what they wear now. `inventory`
 * is every item not worn by anyone, all six slots.
 */
export function planTeamGear(girls: TeamGearGirl[], inventory: GirlGearItem[], mode: TeamGearMode): GirlPlan[] {
    const plans: GirlPlan[] = girls.map((g, position) => ({ position, id_girl: g.id_girl, name: g.name, slots: [] }));
    for (const slot of GIRL_GEAR_SLOTS) {
        const worn = girls.map(g => (g.armor ?? []).find(a => Number(a.slot_index) === slot) ?? null);
        const chosen = planSlot(slot, girls, worn, inventory, mode);
        girls.forEach((girl, i) => {
            const current = worn[i];
            const pick = chosen[i];
            const keeps = pick !== null && pick.source.kind === 'worn' && pick.source.fromGirl === girl.id_girl;
            const change = keeps ? false : (pick !== null || current !== null);
            plans[i].slots.push({
                slot,
                current,
                chosen: pick ? pick.item : null,
                change,
                source: change && pick ? pick.source : null,
                currentScore: current ? scoreItem(rankedItem(current, mode), girl) : null,
                chosenScore: pick ? scoreItem(rankedItem(pick.item, mode), girl) : null,
            });
        });
    }
    return plans;
}

/** The item each girl gets in one slot, by the two rules in the file
 *  header; null where the pool has run out. */
function planSlot(
    slot: number,
    girls: TeamGearGirl[],
    worn: (GirlGearItem | null)[],
    inventory: GirlGearItem[],
    mode: TeamGearMode,
): (PoolEntry | null)[] {
    const pool: PoolEntry[] = [];
    const sumOf = (item: GirlGearItem) => {
        const c = rankedItem(item, mode).caracs ?? {};
        return (c.carac1 || 0) + (c.carac2 || 0) + (c.carac3 || 0) + (c.damage || 0) + (c.defense || 0) + (c.ego || 0);
    };
    for (const item of inventory) {
        if (Number(item.slot_index) !== slot) continue;
        pool.push({ item, source: { kind: 'inventory', id: Number(item.id_girl_armor) }, sum: sumOf(item), order: 0 });
    }
    worn.forEach((item, i) => {
        if (!item) return;
        pool.push({
            item, sum: sumOf(item), order: 0,
            source: { kind: 'worn', fromGirl: girls[i].id_girl, slot, idEquipped: Number(item.id_girl_armor_equipped) },
        });
    });
    // Rule 1: the i-th girl gets the i-th highest stat sum. Stable order for
    // the ties so the plan does not depend on the order the game sent.
    pool.sort((a, b) => b.sum - a.sum || sourceKey(a.source) - sourceKey(b.source));
    pool.forEach((p, i) => { p.order = i; });

    const result: (PoolEntry | null)[] = girls.map(() => null);
    const served = Math.min(girls.length, pool.length);
    let i = 0;
    while (i < served) {
        // One tier: the girls whose target sum is the same.
        const sum = pool[i].sum;
        let j = i;
        while (j < served && pool[j].sum === sum) j++;
        const tierGirls = Array.from({ length: j - i }, (_, k) => i + k);
        const tierItems = pool.filter(p => p.sum === sum);
        const picks = assignTier(tierGirls, tierItems, (g, p) => weight(girls[g], g, p, mode));
        tierGirls.forEach((g, k) => { result[g] = tierItems[picks[k]]; });
        i = j;
    }
    return result;
}

function sourceKey(s: GearSource): number {
    return s.kind === 'inventory' ? s.id : Number.MAX_SAFE_INTEGER - s.idEquipped;
}

/**
 * Rule 2 as one additive number, so the best assignment is the one with the
 * largest sum. The parts, from most to least important: resonance matches
 * (up to 3 per girl, 21 per team); the same matches weighted by position
 * with base 4 -- more than a later girl can make up, so the earlier girls
 * win a tie; the real level; keeping the own item. Each part's team total
 * stays below the step of the part above it, so they never mix.
 */
function weight(girl: TeamGearGirl, position: number, p: PoolEntry, mode: TeamGearMode): number {
    const res = scoreItem(rankedItem(p.item, mode), girl).resonanceMatches;
    const byPosition = res * Math.pow(4, Math.max(0, 6 - position));
    const level = Number(p.item.level) || 0;
    const keeps = p.source.kind === 'worn' && p.source.fromGirl === girl.id_girl ? 1 : 0;
    return res * 1e9 + byPosition * 1e4 + level * 10 + keeps;
}

/**
 * Best assignment of `girls` (at most 7) to distinct `items` by `w`, as a
 * dynamic program over the items with the set of served girls as state:
 * items x 2^girls x girls steps, a few hundred thousand for a full tier.
 * Returns, per girl, the index of her item. There are always at least as
 * many items as girls in a tier.
 */
function assignTier(girls: number[], items: PoolEntry[], w: (girl: number, p: PoolEntry) => number): number[] {
    const k = girls.length;
    const full = (1 << k) - 1;
    const states = 1 << k;
    const n = items.length;
    const dp = new Float64Array((n + 1) * states).fill(-Infinity);
    const from = new Int8Array((n + 1) * states).fill(-2);
    dp[0] = 0;
    const weights = girls.map(g => items.map(p => w(g, p)));
    for (let i = 0; i < n; i++) {
        for (let mask = 0; mask < states; mask++) {
            const here = dp[i * states + mask];
            if (here === -Infinity) continue;
            const skip = (i + 1) * states + mask;
            if (here > dp[skip]) { dp[skip] = here; from[skip] = -1; }
            for (let g = 0; g < k; g++) {
                if (mask & (1 << g)) continue;
                const next = (i + 1) * states + (mask | (1 << g));
                const v = here + weights[g][i];
                if (v > dp[next]) { dp[next] = v; from[next] = g; }
            }
        }
    }
    const picks = new Array<number>(k).fill(-1);
    let mask = full;
    for (let i = n; i > 0; i--) {
        const g = from[i * states + mask];
        if (g >= 0) { picks[g] = i - 1; mask &= ~(1 << g); }
    }
    return picks;
}

/** How many girl slots the plan changes. */
export function countChanges(plan: GirlPlan[]): number {
    return plan.reduce((n, g) => n + g.slots.filter(s => s.change).length, 0);
}
