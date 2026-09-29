// TeamGearService.ts -- Pure planning for "Best gear" and "Possibly best
// gear": which item each team girl should wear in each of her six slots.
//
// The ranking is the one Stuff Team used on the girl page (HaremGirl.pure:
// scoreItem, isBetter): the sum of the six stats first, then the resonance
// matches with the wearer, then the three caracs. A girl only trades her
// item in when the candidate is better by that rule, so equal items do not
// cause a swap.
//
// "Possibly best" ranks a mythic by the stats it will have at level 10,
// because Level-up gear takes worn mythics there. The stats grow linearly
// with the level (measured: a mythic at level 1 carries 30/30/30 and ego 45,
// at level 10 300/300/300 and 450; a legendary goes from 26 to 52 between
// level 1 and 2). Every other rarity counts as it is: nothing in the script
// levels it.
//
// Girls are served in team order, the leader first, each through slots 1 to
// 6. A girl can get any item in the inventory, or keep what she wears in
// that slot herself. What other girls wear is not in play -- a player who
// wants it pressed Unequip All first. An item a girl trades in goes back to
// the pool for the girls after her. Each item goes to one girl only, so when
// the mythics run out the later girls get legendaries, epics and so on.
//
// Used by: Module/TeamGear.ts

import { EquipmentItem, EquipmentScore, EquipmentWearer, isBetter, scoreItem } from '../Module/harem/HaremGirl.pure';

export type TeamGearMode = 'best' | 'possible';

/** Level-up gear's cap on girl items (upgradeable_item_max_level). */
const GIRL_GEAR_CAP = 10;

export const GIRL_GEAR_SLOTS = [1, 2, 3, 4, 5, 6] as const;

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
    skin?: { name?: string };
}

export interface TeamGearGirl extends EquipmentWearer {
    id_girl: number;
    name: string;
    armor: GirlGearItem[];
}

/** Where a planned item is at the moment it is put on. */
export type GearSource =
    /** In the inventory, under this id_girl_armor. */
    | { kind: 'inventory'; id: number }
    /** Worn by an earlier team girl in this slot, who trades it in earlier in
     *  the same run; its inventory id is only known from that trade's
     *  answer. */
    | { kind: 'traded'; fromGirl: number; slot: number };

export interface SlotPlan {
    slot: number;
    current: GirlGearItem | null;
    /** The item she ends up with; the current one when she keeps it. */
    chosen: GirlGearItem | null;
    change: boolean;
    /** Set when change is true. */
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
 * level 10 gets its stats scaled to level 10; everything else is unchanged.
 */
export function rankedItem(item: GirlGearItem, mode: TeamGearMode): GirlGearItem {
    const level = Number(item.level);
    if (mode !== 'possible' || item.rarity !== 'mythic' || !(level > 0) || level >= GIRL_GEAR_CAP) return item;
    const f = GIRL_GEAR_CAP / level;
    const c = item.caracs ?? {};
    const scale = (v: number | undefined) => (v === undefined ? undefined : v * f);
    return {
        ...item,
        caracs: {
            carac1: scale(c.carac1), carac2: scale(c.carac2), carac3: scale(c.carac3),
            damage: scale(c.damage), defense: scale(c.defense), ego: scale(c.ego),
        },
    };
}

interface PoolEntry {
    item: GirlGearItem;
    source: GearSource;
}

/** The sort order of HaremGirl's slot optimiser, as a comparison: negative
 *  when `a` ranks before `b`. Ties fall to the inventory id so the plan does
 *  not depend on the order the game sent the list in. */
function compare(a: PoolEntry, b: PoolEntry, girl: EquipmentWearer, mode: TeamGearMode): number {
    const ra = rankedItem(a.item, mode);
    const rb = rankedItem(b.item, mode);
    const sa = scoreItem(ra, girl);
    const sb = scoreItem(rb, girl);
    if (sb.caracSum !== sa.caracSum) return sb.caracSum - sa.caracSum;
    if (sb.resonanceMatches !== sa.resonanceMatches) return sb.resonanceMatches - sa.resonanceMatches;
    const three = (i: GirlGearItem) => (i.caracs?.carac1 || 0) + (i.caracs?.carac2 || 0) + (i.caracs?.carac3 || 0);
    const d = three(rb) - three(ra);
    if (d !== 0) return d;
    return sourceOrder(a.source) - sourceOrder(b.source);
}

function sourceOrder(s: GearSource): number {
    return s.kind === 'inventory' ? s.id : Number.MAX_SAFE_INTEGER - s.fromGirl;
}

/**
 * The plan for the whole team, girl by girl in team order.
 *
 * `girls` in team order, leader first, with what they wear now. `inventory`
 * is every item not worn by anyone, all six slots.
 */
export function planTeamGear(girls: TeamGearGirl[], inventory: GirlGearItem[], mode: TeamGearMode): GirlPlan[] {
    const pool = new Map<number, PoolEntry[]>();
    for (const slot of GIRL_GEAR_SLOTS) pool.set(slot, []);
    for (const item of inventory) {
        const list = pool.get(Number(item.slot_index));
        if (!list) continue;
        list.push({ item, source: { kind: 'inventory', id: Number(item.id_girl_armor) } });
    }

    return girls.map((girl, position) => {
        const slots = GIRL_GEAR_SLOTS.map((slot): SlotPlan => {
            const current = (girl.armor ?? []).find(a => Number(a.slot_index) === slot) ?? null;
            const currentScore = current ? scoreItem(rankedItem(current, mode), girl) : null;
            const candidates = pool.get(slot)!;
            let bestIndex = -1;
            for (let i = 0; i < candidates.length; i++) {
                if (bestIndex < 0 || compare(candidates[i], candidates[bestIndex], girl, mode) < 0) bestIndex = i;
            }
            const best = bestIndex >= 0 ? candidates[bestIndex] : null;
            if (!best || (current && !isBetter(rankedItem(best.item, mode), rankedItem(current, mode), girl))) {
                return { slot, current, chosen: current, change: false, source: null, currentScore, chosenScore: currentScore };
            }
            candidates.splice(bestIndex, 1);
            if (current) candidates.push({ item: current, source: { kind: 'traded', fromGirl: girl.id_girl, slot } });
            return {
                slot, current, chosen: best.item, change: true, source: best.source,
                currentScore, chosenScore: scoreItem(rankedItem(best.item, mode), girl),
            };
        });
        return { position, id_girl: girl.id_girl, name: girl.name, slots };
    });
}

/** How many slots the plan changes. */
export function countChanges(plan: GirlPlan[]): number {
    return plan.reduce((n, g) => n + g.slots.filter(s => s.change).length, 0);
}
