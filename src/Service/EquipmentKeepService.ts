// EquipmentKeepService.ts -- Which inventory mythics are worth keeping, so the
// rest can be spent by hand as upgrade material.
//
// The automation never feeds mythics to anything. This decides what to *show*
// the player: marked means "keep", unmarked means "safe to use as material".
//
// The rule, agreed with the maintainer against his own inventory (207 pieces,
// 107 of them mythic):
//
//   For each slot, for each element, keep exactly ONE piece.
//
// That one is picked in this order:
//   1. the player's own class before any other class -- a class bonus for a
//      class you do not play is worth nothing;
//   2. class resonance: damage before ego;
//   3. theme resonance: defense before chance;
//   4. the higher level;
//   5. the lower id, so the choice is stable across page loads rather than
//      following DOM order.
//
// Steps 2 and 3 are one preference list in the maintainer's words -- damage,
// then defence, then ego, then harmony. The two axes never overlap in
// practice: a class resonance is only ever damage or ego, a theme resonance
// only ever defense or chance (measured across all 107 mythics), so comparing
// the class axis first and the theme axis second reproduces that single list.
// "Harmony" is the game's name for what the API calls `chance`.
//
// Keeping one piece per ELEMENT, not one per resonance combination, is a
// deliberate choice (variant A): an element you cannot field at all is the
// real gap, a second bonus flavour of an element you already own is not.
// It also means an element covered only by a foreign class still keeps its
// best piece -- without that, an element could disappear from a slot entirely.
//
// Equipped pieces are not considered: they cannot be selected as material.
//
// Used by: Module/EquipmentGear.ts

import type { ArmorItem } from './EquipmentOptimizerService';
import type { PlayerClass } from './TeamScoringService';

/** Preference among resonance targets, best first. `chance` is "Harmony". */
const RESONANCE_RANK: Record<string, number> = {
    damage: 1,
    defense: 2,
    ego: 3,
    chance: 4,
};

function rank(target: string | undefined): number {
    return target === undefined ? 99 : (RESONANCE_RANK[target] ?? 99);
}

/**
 * The element an item resonates on. `identifier: null` is Balanced -- a real
 * element, not the absence of one -- so it gets its own group rather than
 * being lumped in with the untyped pieces.
 */
export function elementOf(item: ArmorItem): string | null {
    const res = item.themeResonance;
    if (!res) return null;
    return res.identifier === null ? 'balanced' : res.identifier;
}

/** Ordering inside one (slot, element) group. Lower sorts first = kept. */
export function compareKeepCandidates(
    a: ArmorItem,
    b: ArmorItem,
    playerClass: PlayerClass,
): number {
    const ownA = String(a.classResonance?.identifier) === String(playerClass) ? 0 : 1;
    const ownB = String(b.classResonance?.identifier) === String(playerClass) ? 0 : 1;
    if (ownA !== ownB) return ownA - ownB;

    const clsA = rank(a.classResonance?.resonance);
    const clsB = rank(b.classResonance?.resonance);
    if (clsA !== clsB) return clsA - clsB;

    const thmA = rank(a.themeResonance?.resonance);
    const thmB = rank(b.themeResonance?.resonance);
    if (thmA !== thmB) return thmA - thmB;

    if (a.level !== b.level) return b.level - a.level;
    return a.id_member_armor - b.id_member_armor;
}

/**
 * A stable identity for one piece, independent of its level.
 *
 * Level and every carac value are a pure function of the level (measured: at
 * level 1 all mythics read 2100/2100/2100/2100/3100, at 20 all read
 * 4000/4000/4000/4000/5000), so a key containing either would break the moment
 * the piece is levelled -- which is exactly what HH++ OCD's favourites do.
 * Skin, slot, rarity and the two resonance axes do not move.
 *
 * Measured against the maintainer's 107 mythics: 107 distinct keys, no
 * collisions. Two truly identical pieces would share one, and those are
 * interchangeable by definition.
 */
export function keepKey(item: ArmorItem): string {
    return [
        item.skin ?? '',
        item.slot,
        item.rarity,
        item.classResonance?.identifier ?? '',
        item.classResonance?.resonance ?? '',
        item.themeResonance?.identifier ?? 'balanced',
        item.themeResonance?.resonance ?? '',
    ].join('_');
}

/**
 * The same key straight off the game's raw item object.
 *
 * The upgrade page needs this: its item objects carry `id_item` and no
 * `id_member_armor` at all, so parseArmorItem rejects every one of them and the
 * typed path cannot be used there. None of the fields the key is built from
 * depend on the id, so reading them directly is exact rather than a
 * workaround -- keepKey and this must always agree, which a test pins down.
 *
 * Returns null for anything that is not hero armor.
 */
interface RawResonance { identifier?: string | null; resonance?: string }
interface RawArmor {
    skin?: { identifier?: string; subtype?: number; wearer?: string };
    item?: { rarity?: string };
    resonance_bonuses?: { class?: RawResonance; theme?: RawResonance };
}

export function keepKeyFromRaw(raw: unknown): string | null {
    if (raw === null || typeof raw !== 'object') return null;
    const a = raw as RawArmor;
    const slot = Number(a.skin?.subtype);
    if (!Number.isInteger(slot) || slot < 1 || slot > 6) return null;
    if (a.skin?.wearer !== undefined && a.skin.wearer !== 'hero') return null;
    const res = a.resonance_bonuses ?? {};
    return [
        String(a.skin?.identifier ?? ''),
        slot,
        String(a.item?.rarity ?? ''),
        res.class?.identifier ?? '',
        res.class?.resonance ?? '',
        res.theme?.identifier ?? 'balanced',
        res.theme?.resonance ?? '',
    ].join('_');
}

export interface KeepDecision {
    /** id_member_armor of every piece to mark. */
    keep: Set<number>;
    /** Per slot and element, what was chosen and how many it beat. */
    groups: Array<{
        slot: number;
        element: string;
        keptId: number;
        freed: number;
    }>;
}

/**
 * The pieces to mark as "keep". Everything mythic that is NOT in the returned
 * set is free for the player to spend as material.
 *
 * Non-mythic items are never marked: legendary and epic carry no resonance at
 * all and exist to be consumed.
 */
export function pickKeepers(items: ArmorItem[], playerClass: PlayerClass): KeepDecision {
    const groups = new Map<string, ArmorItem[]>();
    for (const item of items) {
        if (item.equipped) continue;
        if (item.rarity !== 'mythic') continue;
        const element = elementOf(item);
        if (element === null) continue;
        const key = item.slot + '|' + element;
        const bucket = groups.get(key);
        if (bucket === undefined) groups.set(key, [item]);
        else bucket.push(item);
    }

    const keep = new Set<number>();
    const report: KeepDecision['groups'] = [];
    for (const [key, bucket] of groups) {
        bucket.sort((a, b) => compareKeepCandidates(a, b, playerClass));
        const winner = bucket[0];
        keep.add(winner.id_member_armor);
        const [slot, element] = key.split('|');
        report.push({
            slot: Number(slot),
            element,
            keptId: winner.id_member_armor,
            freed: bucket.length - 1,
        });
    }
    report.sort((a, b) => a.slot - b.slot || a.element.localeCompare(b.element));
    return { keep, groups: report };
}
