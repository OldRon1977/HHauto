import {
    GirlGearItem,
    TeamGearGirl,
    countChanges,
    planTeamGear,
    rankedItem,
} from '../../src/Service/TeamGearService';

let nextId = 1000;

/** An item whose six stats are all `stat`, so caracSum = 6 * stat. */
function item(slot: number, rarity: string, level: number, stat: number, extra: Partial<GirlGearItem> = {}): GirlGearItem {
    return {
        id_girl_armor: nextId++,
        slot_index: slot,
        level,
        rarity,
        caracs: { carac1: stat, carac2: stat, carac3: stat, damage: stat, defense: stat, ego: stat },
        resonance_bonuses: [],
        skin: { name: `${rarity}-${slot}-${stat}` },
        ...extra,
    };
}

function worn(slot: number, rarity: string, level: number, stat: number): GirlGearItem {
    const i = item(slot, rarity, level, stat);
    delete i.id_girl_armor;
    return { ...i, id_girl_armor_equipped: nextId++ };
}

function girl(id: number, armor: GirlGearItem[] = [], axes: Partial<TeamGearGirl> = {}): TeamGearGirl {
    return { id_girl: id, name: `Girl ${id}`, class: 1, element: 'sun', figure: 1, armor, ...axes };
}

describe('rankedItem', () => {
    it('scales a mythic below level 10 to level 10 in possible mode', () => {
        const r = rankedItem(item(1, 'mythic', 2, 30), 'possible');
        expect(r.caracs.carac1).toBe(150);
        expect(r.caracs.ego).toBe(150);
    });

    it('leaves every other rarity as it is', () => {
        expect(rankedItem(item(1, 'legendary', 1, 26), 'possible').caracs.carac1).toBe(26);
    });

    it('leaves everything as it is in best mode', () => {
        expect(rankedItem(item(1, 'mythic', 1, 30), 'best').caracs.carac1).toBe(30);
    });
});

describe('planTeamGear', () => {
    it('keeps what a girl wears when nothing in the inventory is better', () => {
        const plan = planTeamGear([girl(1, [worn(1, 'legendary', 1, 26)])], [item(1, 'rare', 1, 22)], 'best');
        expect(plan[0].slots[0]).toMatchObject({ change: false });
        expect(countChanges(plan)).toBe(0);
    });

    it('does not swap for an equal item', () => {
        const plan = planTeamGear([girl(1, [worn(1, 'rare', 1, 22)])], [item(1, 'rare', 1, 22)], 'best');
        expect(plan[0].slots[0].change).toBe(false);
    });

    it('fills an empty slot from the inventory', () => {
        const inv = item(2, 'common', 1, 20);
        const plan = planTeamGear([girl(1)], [inv], 'best');
        expect(plan[0].slots[1]).toMatchObject({ change: true, source: { kind: 'inventory', id: inv.id_girl_armor } });
    });

    it('gives each item to one girl only, the leader first, and fills up with lower rarities', () => {
        const mythic = item(3, 'mythic', 10, 300);
        const legendary = item(3, 'legendary', 1, 26);
        const plan = planTeamGear([girl(1), girl(2), girl(3)], [legendary, mythic], 'best');
        expect(plan.map(g => g.slots[2].chosen?.rarity ?? null)).toEqual(['mythic', 'legendary', null]);
    });

    it('hands an item a girl trades in to the girls after her', () => {
        const old = worn(4, 'epic', 1, 24);
        const plan = planTeamGear([girl(1, [old]), girl(2)], [item(4, 'mythic', 10, 300)], 'best');
        expect(plan[0].slots[3]).toMatchObject({ change: true, source: { kind: 'inventory' } });
        expect(plan[1].slots[3]).toMatchObject({ change: true, chosen: old, source: { kind: 'traded', fromGirl: 1, slot: 4 } });
    });

    it('never hands a traded item to a girl before the one who traded it', () => {
        const old = worn(4, 'epic', 1, 24);
        const plan = planTeamGear([girl(1), girl(2, [old])], [item(4, 'mythic', 10, 300)], 'best');
        expect(plan[0].slots[3].chosen?.rarity).toBe('mythic');
        expect(plan[1].slots[3].change).toBe(false);
    });

    it('keeps the slots apart', () => {
        const plan = planTeamGear([girl(1)], [item(5, 'mythic', 10, 300)], 'best');
        expect(plan[0].slots.filter(s => s.change).map(s => s.slot)).toEqual([5]);
    });

    it('possible mode prefers a low mythic over a finished legendary', () => {
        const mythic = item(6, 'mythic', 1, 30);      // at level 10: 300
        const legendary = item(6, 'legendary', 10, 260);
        expect(planTeamGear([girl(1)], [mythic, legendary], 'best')[0].slots[5].chosen).toBe(legendary);
        expect(planTeamGear([girl(1)], [mythic, legendary], 'possible')[0].slots[5].chosen).toBe(mythic);
    });

    it('possible mode does not project a legendary', () => {
        const legendary = item(6, 'legendary', 1, 26);
        const epic = item(6, 'epic', 10, 200);
        expect(planTeamGear([girl(1)], [legendary, epic], 'possible')[0].slots[5].chosen).toBe(epic);
    });

    it('breaks a stat tie on resonance with the wearer', () => {
        const plain = item(1, 'legendary', 1, 26);
        const matching = item(1, 'legendary', 1, 26, { resonance_bonuses: { element: { identifier: 'sun' } } });
        expect(planTeamGear([girl(1)], [plain, matching], 'best')[0].slots[0].chosen).toBe(matching);
    });

    it('reads levels and slots the game sends as strings', () => {
        const mythic = { ...item(2, 'mythic', 1, 30), level: '1', slot_index: '2' };
        const legendary = item(2, 'legendary', 10, 260);
        expect(planTeamGear([girl(1)], [legendary, mythic], 'possible')[0].slots[1].chosen).toBe(mythic);
    });
});
