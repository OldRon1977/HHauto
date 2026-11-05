import { GirlGearItem } from '../../src/Service/TeamGearService';
import { GearWearerRaw, TeamGearTieBreakService, TieBreakPool } from '../../src/Service/TeamGearTieBreakService';
import { GirlData } from '../../src/Service/TeamScoringService';

// Fire girls: their Tier-3 trait is the eye colour, so the favourite
// position (figure) can differ between two girls the team model sees alike.
function girl(id: number, figure: number, extra: Partial<GirlData> = {}): GirlData & { figure: number } {
    const caracs = { carac1: 1000, carac2: 1000, carac3: 1000 };
    return {
        id_girl: id, name: `Girl ${id}`, ...caracs, caracs, level: 750, class: 1, element: 'fire',
        rarity: 'mythic', graded: 6, nb_grades: 6, eyeColor: `E${id}`, figure, ...extra,
    } as GirlData & { figure: number };
}

let nextId = 5000;
/** A level 10 mythic resonating on one favourite position. */
function mythic(slot: number, figure: number): GirlGearItem {
    return {
        id_girl_armor: nextId++, slot_index: slot, level: 10, rarity: 'mythic',
        caracs: { carac1: 300, carac2: 300, carac3: 300, damage: 75, defense: 120, ego: 450 },
        resonance_bonuses: { figure: { identifier: String(figure), resonance: 'damage', bonus: 0.5 } } as never,
    };
}
/** Seven items per slot, so every girl is served from the same tier; `hits` of them fit `figure`. */
function inventory(figure: number, hits = 1): GirlGearItem[] {
    const out: GirlGearItem[] = [];
    for (let slot = 1; slot <= 6; slot++) for (let i = 0; i < 7; i++) out.push(mythic(slot, i < hits ? figure : 99));
    return out;
}

const team = [1, 2, 3, 4, 5, 6, 7].map(id => girl(id, id));
const ids = team.map(g => g.id_girl);

function run(extra: (GirlData & { figure: number })[], inv: GirlGearItem[]) {
    const girls = [...team, ...extra];
    const pool: TieBreakPool = { base: girls, evaluated: girls };
    const wearers = new Map(girls.map(g => [g.id_girl, g as unknown as GearWearerRaw] as [number, GearWearerRaw]));
    return TeamGearTieBreakService.improve(ids, pool, 'now', t => TeamGearTieBreakService.tally(t, wearers, inv, 'best'));
}

describe('TeamGearTieBreakService.improve', () => {
    it('swaps a girl for an exact equal whose position the equipment fits', () => {
        const partner = girl(101, 9, { eyeColor: 'E7' });
        const res = run([partner], inventory(9));
        expect(res.swaps).toEqual([{ position: 6, from: 7, to: 101 }]);
        expect(res.before.matches).toBe(0);
        expect(res.after.figure).toBe(6);
        expect(res.after.bonus).toBeCloseTo(3);
    });

    it('leaves every input of the team model unchanged', () => {
        const girls = [...team, girl(101, 9, { eyeColor: 'E7' })];
        const pool: TieBreakPool = { base: girls, evaluated: girls };
        const res = run([girl(101, 9, { eyeColor: 'E7' })], inventory(9));
        expect(TeamGearTieBreakService.sameInputs(
            TeamGearTieBreakService.modelInputs(pool, res.ids, 'now'),
            TeamGearTieBreakService.modelInputs(pool, ids, 'now'))).toBe(true);
    });

    it('does not swap for a girl with one stat point more', () => {
        const res = run([girl(101, 9, { eyeColor: 'E7', carac1: 1001, caracs: { carac1: 1001, carac2: 1000, carac3: 1000 } })], inventory(9));
        expect(res.swaps).toEqual([]);
    });

    it('does not swap for a girl with another Tier-3 trait value', () => {
        const res = run([girl(101, 9, { eyeColor: 'E8' })], inventory(9));
        expect(res.swaps).toEqual([]);
    });

    it('does not swap for a girl of another element', () => {
        const res = run([girl(101, 9, { eyeColor: 'E7', element: 'water' })], inventory(9));
        expect(res.swaps).toEqual([]);
    });

    it('keeps the team when the equipment does not fit the partner better', () => {
        const res = run([girl(101, 9, { eyeColor: 'E7' })], inventory(42));
        expect(res.swaps).toEqual([]);
        expect(res.ids).toEqual(ids);
    });

    it('never swaps the leader', () => {
        const res = run([girl(101, 9, { eyeColor: 'E1' })], inventory(9));
        expect(res.swaps).toEqual([]);
    });

    it('takes the partner with the most matches', () => {
        // Partner 102 fits two items per slot, but only one girl can wear an
        // item, so both partners together are not more than one alone.
        const res = run([girl(101, 9, { eyeColor: 'E7' }), girl(102, 9, { eyeColor: 'E6' })], inventory(9, 2));
        expect(res.after.figure).toBe(12);
        expect(res.swaps.map(s => s.position).sort()).toEqual([5, 6]);
    });
});

describe('TeamGearTieBreakService.unequippedInventory', () => {
    it('adds what every girl wears, each worn piece with an id of its own', () => {
        const free = [mythic(1, 3)];
        const worn = { ...mythic(2, 4), id_girl_armor: undefined, id_girl_armor_equipped: 77 };
        const wearers: GearWearerRaw[] = [{ id_girl: 1, class: 1, element: 'fire', figure: 1, armor: [worn] }, { id_girl: 2, armor: [] }];
        const out = TeamGearTieBreakService.unequippedInventory(free, wearers);
        expect(out).toHaveLength(2);
        expect(out[1].id_girl_armor).toBe(-77);
    });
});
