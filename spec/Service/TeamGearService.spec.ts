import {
    GirlGearItem,
    TeamGearGirl,
    countChanges,
    planTeamGear,
    rankedItem,
} from '../../src/Service/TeamGearService';

let nextId = 1000;

/** An item whose six stats are all `stat`, so the stat sum is 6 * stat. */
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

function worn(slot: number, rarity: string, level: number, stat: number, extra: Partial<GirlGearItem> = {}): GirlGearItem {
    const i = item(slot, rarity, level, stat, extra);
    delete i.id_girl_armor;
    return { ...i, id_girl_armor_equipped: nextId++ };
}

function girl(id: number, armor: GirlGearItem[] = [], axes: Partial<TeamGearGirl> = {}): TeamGearGirl {
    return { id_girl: id, name: `Girl ${id}`, class: 1, element: 'sun', figure: 1, armor, ...axes };
}

/** A mythic as the game sends it: base stats in `armor`, shown stats the base
 *  times the level, rounded (damage 7.5 shows 8 at level 1). */
function mythic(slot: number, level: number, extra: Partial<GirlGearItem> = {}): GirlGearItem {
    const base = { carac1: 30, carac2: 30, carac3: 30, damage: 7.5, defense: 12, ego: 45 };
    const shown = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Math.round(v * level)]));
    return item(slot, 'mythic', level, 0, { caracs: shown, armor: base, ...extra });
}

const chosenIn = (plan: ReturnType<typeof planTeamGear>, slot: number) => plan.map(g => g.slots[slot - 1].chosen);

describe('rankedItem', () => {
    // Measured: every L10 mythic sums to 1545; an L1 one shows 155, and
    // 155 x 10 = 1550 made it look better than a finished one.
    it('projects a mythic from its base stats, not the rounded level 1 values', () => {
        const sum = (i: GirlGearItem) => Object.values(i.caracs).reduce((a: number, b) => a + (b || 0), 0);
        expect(sum(mythic(1, 10))).toBe(1545);
        expect(sum(rankedItem(mythic(1, 1), 'possible'))).toBe(1545);
        expect(sum(rankedItem(mythic(1, 4), 'possible'))).toBe(1545);
    });

    it('falls back to the shown stats when the base is missing', () => {
        const r = rankedItem(item(1, 'mythic', 2, 30), 'possible');
        expect(r.caracs.carac1).toBe(150);
    });

    it('leaves every other rarity and the best mode alone', () => {
        expect(rankedItem(item(1, 'legendary', 1, 26), 'possible').caracs.carac1).toBe(26);
        expect(rankedItem(mythic(1, 1), 'best').caracs.carac1).toBe(30);
    });
});

describe('planTeamGear, rule 1: the stats go down the team in order', () => {
    it('gives the L10 mythics to the first girls and fills up with lower rarities', () => {
        const plan = planTeamGear([girl(1), girl(2), girl(3)],
            [item(3, 'legendary', 1, 26), mythic(3, 10), mythic(3, 10)], 'best');
        expect(chosenIn(plan, 3).map(c => c?.rarity)).toEqual(['mythic', 'mythic', 'legendary']);
    });

    it('moves an L10 mythic from a later girl to an earlier one', () => {
        const hers = mythic(4, 10, { id_girl_armor: undefined, id_girl_armor_equipped: 77 });
        const plan = planTeamGear([girl(1, [worn(4, 'legendary', 1, 26)]), girl(2), girl(3, [hers])], [], 'best');
        expect(plan[0].slots[3]).toMatchObject({ change: true, chosen: hers, source: { kind: 'worn', fromGirl: 3, slot: 4, idEquipped: 77 } });
        expect(plan[1].slots[3]).toMatchObject({ change: true, source: { kind: 'worn', fromGirl: 1 } });
        // Nothing is left for the third girl: her item went to the first.
        expect(plan[2].slots[3]).toMatchObject({ change: true, chosen: null, source: null });
    });

    it('keeps the slots apart', () => {
        const plan = planTeamGear([girl(1)], [mythic(5, 10)], 'best');
        expect(plan[0].slots.filter(s => s.change).map(s => s.slot)).toEqual([5]);
    });

    it('possible mode ranks a low mythic with the finished ones, above a finished legendary', () => {
        const low = mythic(6, 1);
        const legendary = item(6, 'legendary', 10, 222);
        expect(planTeamGear([girl(1)], [low, legendary], 'best')[0].slots[5].chosen).toBe(legendary);
        expect(planTeamGear([girl(1)], [low, legendary], 'possible')[0].slots[5].chosen).toBe(low);
    });

    it('possible mode does not project a legendary', () => {
        const legendary = item(6, 'legendary', 1, 26);
        const epic = item(6, 'epic', 10, 200);
        expect(planTeamGear([girl(1)], [legendary, epic], 'possible')[0].slots[5].chosen).toBe(epic);
    });
});

describe('planTeamGear, rule 2: the best distribution within a tier', () => {
    const g1 = () => girl(1, [], { class: 1, element: 'sun', figure: 1 });
    const g2 = () => girl(2, [], { class: 2, element: 'water', figure: 2 });

    // The case from the live account: the leader fits both equally well,
    // the second girl fits one of them on two axes.
    it('leaves the leader the item the second girl fits worse', () => {
        const a = mythic(3, 10, { resonance_bonuses: { class: { identifier: '1' } } });
        const b = mythic(3, 10, { resonance_bonuses: { element: { identifier: 'sun' }, class: { identifier: '2' }, figure: { identifier: '2' } } });
        const plan = planTeamGear([g1(), g2()], [b, a], 'best');
        expect(chosenIn(plan, 3)).toEqual([a, b]);
    });

    it('lets the earlier girl win a tie on the team total', () => {
        const fits = mythic(2, 10, { resonance_bonuses: { class: { identifier: '1' } } });
        const plain = mythic(2, 10);
        const plan = planTeamGear([g1(), girl(3, [], { class: 1 })], [plain, fits], 'best');
        expect(plan[0].slots[1].chosen).toBe(fits);
    });

    it('does not swap for an equal item', () => {
        const own = worn(1, 'rare', 1, 22);
        const plan = planTeamGear([girl(1, [own])], [item(1, 'rare', 1, 22)], 'best');
        expect(plan[0].slots[0].change).toBe(false);
        expect(countChanges(plan)).toBe(0);
    });

    it('possible mode keeps a finished mythic over a low one that fits no better', () => {
        const own = mythic(1, 10, { id_girl_armor: undefined, id_girl_armor_equipped: 5 });
        const plan = planTeamGear([girl(1, [own])], [mythic(1, 1)], 'possible');
        expect(plan[0].slots[0].change).toBe(false);
    });

    it('possible mode takes a low mythic that fits better', () => {
        const own = mythic(1, 10, { id_girl_armor: undefined, id_girl_armor_equipped: 5 });
        const better = mythic(1, 1, { resonance_bonuses: { class: { identifier: '1' } } });
        const plan = planTeamGear([girl(1, [own])], [better], 'possible');
        expect(plan[0].slots[0]).toMatchObject({ change: true, chosen: better, source: { kind: 'inventory' } });
    });

    it('reads levels and slots the game sends as strings', () => {
        const low = { ...mythic(2, 1), level: '1', slot_index: '2' };
        const legendary = item(2, 'legendary', 10, 222);
        expect(planTeamGear([girl(1)], [legendary, low], 'possible')[0].slots[1].chosen).toBe(low);
    });
});
