import { elementOf, keepKey, keepKeyFromRaw, pickKeepers } from '../../src/Service/EquipmentKeepService';
import type { ArmorItem } from '../../src/Service/EquipmentOptimizerService';

/** Minimal mythic. `cls`/`thm` are the resonance identifiers, `cr`/`tr` their targets. */
function item(o: {
    id: number; slot: number; level?: number; rarity?: string; skin?: string;
    cls?: string | null; cr?: string; thm?: string | null; tr?: string; equipped?: boolean;
}): ArmorItem {
    return {
        id_member_armor: o.id,
        id_member_armor_equipped: null,
        level: o.level ?? 20,
        slot: o.slot,
        rarity: o.rarity ?? 'mythic',
        skin: o.skin ?? ('SK' + o.id),
        name: 'item' + o.id,
        caracs: { carac1: 0, carac2: 0, carac3: 0, endurance: 0, chance: 0 },
        classResonance: o.cls === undefined ? null : { identifier: o.cls, resonance: (o.cr ?? 'damage') as never, bonus: 0 },
        themeResonance: o.thm === undefined ? null : { identifier: o.thm, resonance: (o.tr ?? 'defense') as never, bonus: 0 },
        equipped: o.equipped ?? false,
    } as ArmorItem;
}

describe('EquipmentKeepService', () => {

    describe('elementOf', () => {
        it('treats a null identifier as Balanced, not as "no element"', () => {
            expect(elementOf(item({ id: 1, slot: 1, thm: null }))).toEqual('balanced');
        });
        it('reports no element for a piece without theme resonance', () => {
            expect(elementOf(item({ id: 1, slot: 1 }))).toBeNull();
        });
    });

    describe('keepKey', () => {
        it('does not change when the piece is levelled', () => {
            const at = (level: number) => item({ id: 1, slot: 6, level, skin: 'EA23',
                cls: '3', cr: 'ego', thm: 'fire', tr: 'defense' });
            // The whole point: HH++ OCD's key carries level and stats, so a
            // levelled piece silently loses its mark. This one must not.
            expect(keepKey(at(1))).toEqual(keepKey(at(20)));
        });

        it('separates pieces that differ in any identity axis', () => {
            const base = { id: 1, slot: 6, skin: 'EA23', cls: '3', cr: 'ego', thm: 'fire', tr: 'defense' };
            const k = keepKey(item(base));
            expect(keepKey(item({ ...base, skin: 'EA22' }))).not.toEqual(k);
            expect(keepKey(item({ ...base, slot: 5 }))).not.toEqual(k);
            expect(keepKey(item({ ...base, cls: '1' }))).not.toEqual(k);
            expect(keepKey(item({ ...base, cr: 'damage' }))).not.toEqual(k);
            expect(keepKey(item({ ...base, thm: 'sun' }))).not.toEqual(k);
            expect(keepKey(item({ ...base, tr: 'chance' }))).not.toEqual(k);
        });

        it('ignores the id, so the same kind on two pages matches', () => {
            // The market and the upgrade page hand out different id spaces.
            const a = item({ id: 111, slot: 2, skin: 'EH4', cls: '3', cr: 'damage', thm: 'light', tr: 'chance' });
            const b = item({ id: 999, slot: 2, skin: 'EH4', cls: '3', cr: 'damage', thm: 'light', tr: 'chance' });
            expect(keepKey(a)).toEqual(keepKey(b));
        });
    });

    describe('keepKeyFromRaw', () => {
        const raw = {
            id_item: 6922185, level: 1,
            item: { rarity: 'mythic' },
            skin: { identifier: 'EF6', subtype: 5, wearer: 'hero' },
            resonance_bonuses: { class: { identifier: '1', resonance: 'ego' },
                                 theme: { identifier: 'fire', resonance: 'defense' } },
        };

        it('agrees with keepKey on the same piece', () => {
            // The market page goes through parseArmorItem, the upgrade page
            // cannot -- its objects have no id_member_armor at all, so
            // parseArmorItem rejects every one of them. Both paths must still
            // produce the same string or the marks never reappear.
            const typed = item({ id: 1, slot: 5, level: 1, skin: 'EF6',
                cls: '1', cr: 'ego', thm: 'fire', tr: 'defense' });
            expect(keepKeyFromRaw(raw)).toEqual(keepKey(typed));
        });

        it('reads a piece that carries no id_member_armor', () => {
            expect(raw).not.toHaveProperty('id_member_armor');
            expect(keepKeyFromRaw(raw)).toEqual('EF6_5_mythic_1_ego_fire_defense');
        });

        it('treats a null theme identifier as balanced, like the typed path', () => {
            const balanced = { ...raw, resonance_bonuses: { ...raw.resonance_bonuses,
                theme: { identifier: null, resonance: 'defense' } } };
            expect(keepKeyFromRaw(balanced)).toContain('_balanced_');
        });

        it('rejects girl equipment and anything without a hero slot', () => {
            expect(keepKeyFromRaw({ ...raw, skin: { ...raw.skin, wearer: 'girl' } })).toBeNull();
            expect(keepKeyFromRaw({ ...raw, skin: { identifier: 'X', subtype: 9 } })).toBeNull();
            expect(keepKeyFromRaw(null)).toBeNull();
        });
    });

    describe('pickKeepers', () => {
        it('keeps exactly one piece per slot and element', () => {
            const items = [
                item({ id: 1, slot: 6, cls: '3', cr: 'ego', thm: 'fire', tr: 'chance' }),
                item({ id: 2, slot: 6, cls: '3', cr: 'ego', thm: 'fire', tr: 'chance' }),
                item({ id: 3, slot: 6, cls: '3', cr: 'ego', thm: 'fire', tr: 'defense' }),
                item({ id: 4, slot: 6, cls: '3', cr: 'damage', thm: 'fire', tr: 'chance' }),
            ];
            const { keep } = pickKeepers(items, 3);
            // Variant A: one per element, so the whole fire group collapses to one.
            expect(keep.size).toEqual(1);
            expect(keep.has(4)).toBeTruthy(); // damage outranks ego
        });

        it('prefers the own class over a better resonance on a foreign class', () => {
            const items = [
                item({ id: 1, slot: 4, cls: '1', cr: 'damage', thm: 'water', tr: 'defense' }),
                item({ id: 2, slot: 4, cls: '3', cr: 'ego', thm: 'water', tr: 'chance' }),
            ];
            const { keep } = pickKeepers(items, 3);
            expect(keep.has(2)).toBeTruthy();
            expect(keep.has(1)).toBeFalsy();
        });

        it('keeps a foreign-class piece when it is the only one of its element', () => {
            // The maintainer's case: slot 4 has no darkness of his own class, so
            // the class-1 darkness stays rather than the element vanishing.
            const items = [
                item({ id: 1, slot: 4, cls: '1', cr: 'damage', thm: 'darkness', tr: 'chance' }),
                item({ id: 2, slot: 4, cls: '3', cr: 'damage', thm: 'water', tr: 'defense' }),
            ];
            const { keep } = pickKeepers(items, 3);
            expect(keep.has(1)).toBeTruthy();
            expect(keep.has(2)).toBeTruthy();
        });

        it('ranks damage over defense over ego over harmony', () => {
            const mk = (id: number, cr: string, tr: string) =>
                item({ id, slot: 1, cls: '3', cr, thm: 'sun', tr });
            // One element, four flavours -> the damage/defense one wins.
            const { keep } = pickKeepers(
                [mk(1, 'ego', 'chance'), mk(2, 'ego', 'defense'), mk(3, 'damage', 'chance'), mk(4, 'damage', 'defense')], 3);
            expect(keep.has(4)).toBeTruthy();
            expect(keep.size).toEqual(1);
        });

        it('falls back to the higher level, then to the lower id', () => {
            const same = (id: number, level: number) =>
                item({ id, slot: 2, level, cls: '3', cr: 'damage', thm: 'stone', tr: 'defense' });
            expect(pickKeepers([same(9, 1), same(8, 20)], 3).keep.has(8)).toBeTruthy();
            // Identical in every way -> the lower id, so the mark does not move
            // between page loads.
            expect(pickKeepers([same(9, 20), same(8, 20)], 3).keep.has(8)).toBeTruthy();
        });

        it('never marks legendary or epic -- they exist to be consumed', () => {
            const items = [
                item({ id: 1, slot: 3, rarity: 'legendary' }),
                item({ id: 2, slot: 3, rarity: 'epic' }),
            ];
            expect(pickKeepers(items, 3).keep.size).toEqual(0);
        });

        it('ignores equipped pieces -- they cannot be picked as material anyway', () => {
            const items = [
                item({ id: 1, slot: 5, equipped: true, cls: '3', cr: 'damage', thm: 'fire', tr: 'defense' }),
                item({ id: 2, slot: 5, cls: '3', cr: 'ego', thm: 'fire', tr: 'chance' }),
            ];
            const { keep } = pickKeepers(items, 3);
            expect(keep.has(1)).toBeFalsy();
            expect(keep.has(2)).toBeTruthy(); // still the best of what is in the bag
        });

        it('reports how many pieces each group frees up', () => {
            const items = [
                item({ id: 1, slot: 6, cls: '3', cr: 'damage', thm: 'fire', tr: 'chance' }),
                item({ id: 2, slot: 6, cls: '3', cr: 'ego', thm: 'fire', tr: 'chance' }),
                item({ id: 3, slot: 6, cls: '3', cr: 'ego', thm: 'fire', tr: 'chance' }),
                item({ id: 4, slot: 6, cls: '3', cr: 'damage', thm: 'sun', tr: 'defense' }),
            ];
            const { groups } = pickKeepers(items, 3);
            expect(groups).toEqual([
                { slot: 6, element: 'fire', keptId: 1, freed: 2 },
                { slot: 6, element: 'sun', keptId: 4, freed: 0 },
            ]);
        });
    });
});
