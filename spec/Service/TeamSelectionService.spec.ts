import { TeamSelectionService, SnapshotOpponent, FighterData } from '../../src/Service/TeamSelectionService';
import { ElementType, GirlData } from '../../src/Service/TeamScoringService';

const noHarem = (over: Partial<Record<ElementType, number>> = {}): Record<ElementType, number> =>
    ({ fire: 0, water: 0, nature: 0, stone: 0, sun: 0, darkness: 0, light: 0, psychic: 0, ...over });

const girl = (id: number, sum: number, element: ElementType = 'fire', extra: Partial<GirlData> = {}): GirlData => ({
    id_girl: id, name: 'G' + id, carac1: sum / 3, carac2: sum / 3, carac3: sum / 3,
    caracs: { carac1: sum / 3, carac2: sum / 3, carac3: sum / 3 },
    level: 750, element, rarity: 'mythic', graded: 6, nb_grades: 6, ...extra,
} as GirlData);

const opponent = (openFights: number): SnapshotOpponent => ({
    openFights,
    player: { damage: 1, defense: 1, remaining_ego: 1, chance: 1, team: { theme_elements: [], synergies: [], girls: [] } },
});

describe('TeamSelectionService.buildSwapNeighbours', () => {
    const base = [1, 2, 3, 4, 5, 6, 7];
    const pool = [...base.map(id => girl(id, 1000)), girl(8, 900), girl(9, 800), girl(10, 700)];

    it('never touches position 1 (the leader)', () => {
        const teams = TeamSelectionService.buildSwapNeighbours(base, pool, 2);
        expect(teams.every(t => t[0] === 1)).toBe(true);
    });

    it('tries the N strongest girls outside the team on each of positions 2-7', () => {
        const teams = TeamSelectionService.buildSwapNeighbours(base, pool, 2);
        expect(teams).toHaveLength(6 * 2);
        const partners = new Set(teams.map((t, i) => t[1 + Math.floor(i / 2)]));
        expect([...partners].sort()).toEqual([8, 9]);
    });
});

describe('TeamSelectionService.openFights', () => {
    it('counts the null entries of match_history, three per opponent', () => {
        expect(TeamSelectionService.openFights([null, null, null])).toBe(3);
        expect(TeamSelectionService.openFights([{ w: 1 }, null, null])).toBe(2);
        expect(TeamSelectionService.openFights([{ w: 1 }, { w: 0 }, { w: 1 }])).toBe(0);
    });

    it('reads a missing history as no open fight', () => {
        expect(TeamSelectionService.openFights(undefined)).toBe(0);
        expect(TeamSelectionService.openFights(null)).toBe(0);
    });
});

describe('TeamSelectionService.scoreAgainstOpponents', () => {
    it('weighs every opponent by his open fights and skips those fought three times', () => {
        const calls: number[] = [];
        const sim = (_h: FighterData, p: FighterData) => { calls.push(p.damage); return { points: 20, win: 0.5 }; };
        const opps = [opponent(3), opponent(0), opponent(1)];
        const s = TeamSelectionService.scoreAgainstOpponents(opps[0].player, opps, sim);
        expect(calls).toHaveLength(2);
        expect(s.fights).toBe(4);
        expect(s.points).toBe(80);
        expect(s.winChance).toBeCloseTo(0.5);
    });
});

describe('TeamSelectionService.buildHeroFighter', () => {
    it('sets a theme from three girls of one element and keeps the leader first', () => {
        const girls = [girl(1, 900, 'stone'), girl(2, 900, 'darkness'), girl(3, 900, 'darkness'), girl(4, 900, 'darkness'),
            girl(5, 900, 'sun'), girl(6, 900, 'nature'), girl(7, 900, 'psychic')];
        const harem = noHarem({ darkness: 0.07 });
        const hero = TeamSelectionService.buildHeroFighter({ ego: 10, damage: 5, defense: 3, chance: 2 }, girls, harem);
        expect(hero.team.theme_elements).toEqual([{ type: 'darkness' }]);
        expect(hero.team.girls[0].girl.element_data.type).toBe('stone');
        const dark = hero.team.synergies.find(s => s.element.type === 'darkness');
        expect(dark?.bonus_multiplier).toBeCloseTo(3 * 0.02 + 0.07);
        expect(hero.remaining_ego).toBe(10);
    });
});

describe('TeamSelectionService next-week projection', () => {
    it('recovers the slopes of an exactly linear stat', () => {
        const samples = [];
        for (let i = 0; i < 12; i++) {
            const sums: [number, number, number] = [100000 + i * 3000, 90000 + (i % 4) * 5000, 80000 + (i % 3) * 7000];
            samples.push({ sums, value: 5000 + 2.3 * sums[0] + 1.1 * sums[1] + 0.4 * sums[2] });
        }
        const slopes = TeamSelectionService.fitCaracSlopes(samples)!;
        expect(slopes[0]).toBeCloseTo(2.3, 6);
        expect(slopes[1]).toBeCloseTo(1.1, 6);
        expect(slopes[2]).toBeCloseTo(0.4, 6);
    });

    it('refuses a fit it cannot carry', () => {
        expect(TeamSelectionService.fitCaracSlopes([])).toBeNull();
        const same = Array.from({ length: 8 }, () => ({ sums: [1, 1, 1] as [number, number, number], value: 1 }));
        expect(TeamSelectionService.fitCaracSlopes(same)).toBeNull();
    });

    it("adds only the change to today's measured stats, synergy included", () => {
        const harem = noHarem({ nature: 0.1 });
        const out = TeamSelectionService.projectCaracs(
            { ego: 1000, damage: 500, defense: 200, chance: 50 },
            [100, 100, 100], [110, 100, 100], { nature: 1 }, harem,
            { ego: [2, 0, 0], damage: null, defense: [0, 0, 0] },
        );
        // ego: 1000 + (1 + 0.03 + 0.1) * 2 * 10
        expect(out.ego).toBeCloseTo(1000 + 1.13 * 20);
        // damage without a fit: scaled with the total (310 / 300)
        expect(out.damage).toBeCloseTo(500 * 310 / 300);
        expect(out.chance).toBe(50);
    });
});
