// HaremGirl.pure.ts -- Pure equipment scoring/comparison helpers.
//
// Extracted from HaremGirl (private static methods) so the resonance and
// stat-sum logic can be unit-tested without DOM, jQuery, or globals.
// HaremGirl now imports these for optimizeEquipmentSlots and the (currently
// unused) findBestItem helper.
//
// The data shape is intentionally loose -- the game API uses untyped JSON
// and the original methods accepted `any`. We mirror that here and document
// the keys we read.

import { KKHaremGirl } from "../../model/index";

/**
 * Subset of an inventory item that the score uses.
 *
 * - caracs: stat block; caracN keys feed both caracSum and the secondary
 *   tiebreaker. damage/defense/ego only feed caracSum.
 * - resonance_bonuses: an object keyed by class/element/figure with an
 *   `identifier` field; an array (instead of object) means "no bonuses"
 *   in the game data and is treated as zero matches.
 */
export type EquipmentItem = {
    caracs: {
        carac1?: number;
        carac2?: number;
        carac3?: number;
        damage?: number;
        defense?: number;
        ego?: number;
    };
    resonance_bonuses?:
        | {
              class?: { identifier: string | number };
              element?: { identifier: string | number };
              figure?: { identifier: string | number };
          }
        | unknown[];
};

export type EquipmentScore = {
    caracSum: number;
    resonanceMatches: number;
};

/**
 * Sum of all stat fields plus the count of class/element/figure resonance
 * matches against the wearer.
 *
 * Matches the original implementation byte for byte:
 *   - missing carac fields default to 0
 *   - resonance_bonuses as an array is ignored (zero matches)
 *   - identifier comparison is stringified on both sides
 */
export function scoreItem(item: EquipmentItem, girl: KKHaremGirl): EquipmentScore {
    const c = item.caracs;
    const caracSum =
        (c.carac1 || 0) +
        (c.carac2 || 0) +
        (c.carac3 || 0) +
        (c.damage || 0) +
        (c.defense || 0) +
        (c.ego || 0);

    let resonanceMatches = 0;
    if (item.resonance_bonuses && !Array.isArray(item.resonance_bonuses)) {
        const rb = item.resonance_bonuses;
        if (rb.class && String(rb.class.identifier) === String(girl.class)) resonanceMatches++;
        if (rb.element && String(rb.element.identifier) === String(girl.element)) resonanceMatches++;
        if (rb.figure && String(rb.figure.identifier) === String(girl.figure)) resonanceMatches++;
    }

    return { caracSum, resonanceMatches };
}

/**
 * Pick the highest-scoring item from a list. Tiebreakers, in order:
 *   1. caracSum
 *   2. resonanceMatches
 *   3. carac1+carac2+carac3 (excluding damage/defense/ego)
 *
 * Returns null on an empty list. Currently unused in the codebase but kept
 * as part of the equipment helper trio for parity with the original module.
 */
export function findBestItem(items: EquipmentItem[], girl: KKHaremGirl): EquipmentItem | null {
    if (items.length === 0) return null;
    return items.slice().sort((a, b) => {
        const sa = scoreItem(a, girl);
        const sb = scoreItem(b, girl);
        if (sb.caracSum !== sa.caracSum) return sb.caracSum - sa.caracSum;
        if (sb.resonanceMatches !== sa.resonanceMatches) return sb.resonanceMatches - sa.resonanceMatches;
        const ca = a.caracs;
        const cb = b.caracs;
        return (
            ((cb.carac1 || 0) + (cb.carac2 || 0) + (cb.carac3 || 0)) -
            ((ca.carac1 || 0) + (ca.carac2 || 0) + (ca.carac3 || 0))
        );
    })[0];
}

/**
 * Decide whether `candidate` should replace `current`. Always true if no
 * current item is equipped (or current.caracs is missing). Otherwise the
 * candidate must beat the current on caracSum, or tie on caracSum and beat
 * on resonanceMatches.
 */
export function isBetter(
    candidate: EquipmentItem,
    current: EquipmentItem | null | undefined,
    girl: KKHaremGirl,
): boolean {
    if (!current || !current.caracs) return true;
    const sc = scoreItem(candidate, girl);
    const se = scoreItem(current, girl);
    if (sc.caracSum > se.caracSum) return true;
    if (sc.caracSum === se.caracSum && sc.resonanceMatches > se.resonanceMatches) return true;
    return false;
}
