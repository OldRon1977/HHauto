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
    it('recovers the slope of an exactly linear stat', () => {
        const samples = Array.from({ length: 12 }, (_, i) => ({ sum: 200000 + i * 4000, value: 5000 + 2.33 * (200000 + i * 4000) }));
        expect(TeamSelectionService.fitSumSlope(samples)).toBeCloseTo(2.33, 6);
    });

    it('refuses a fit it cannot carry, and never answers a negative slope', () => {
        expect(TeamSelectionService.fitSumSlope([])).toBeNull();
        expect(TeamSelectionService.fitSumSlope(Array.from({ length: 8 }, () => ({ sum: 1000, value: 1 })))).toBeNull();
        const falling = Array.from({ length: 8 }, (_, i) => ({ sum: 1000 + i * 10, value: 500 - i }));
        expect(TeamSelectionService.fitSumSlope(falling)).toBe(0);
    });

    it("adds only the change to today's measured stats, synergy included", () => {
        const harem = noHarem({ nature: 0.1 });
        const out = TeamSelectionService.projectCaracs(
            { ego: 1000, damage: 500, defense: 200, chance: 50 },
            [100, 100, 100], [110, 100, 100], { nature: 1 }, harem,
            { ego: 2, damage: null, defense: 0 },
        );
        // ego: 1000 + (1 + 0.03 + 0.1) * 2 * 10
        expect(out.ego).toBeCloseTo(1000 + 1.13 * 20);
        // damage without a fit: scaled with the total (310 / 300)
        expect(out.damage).toBeCloseTo(500 * 310 / 300);
        expect(out.chance).toBe(50);
    });
});

describe('TeamSelectionService.developmentFactor', () => {
    it('is the Best Possible projection as a multiplier on the caracs', () => {
        // level 375 of 750, 2 of 6 grades: 2 * (1 + 0.3 * 6) / (1 + 0.3 * 2)
        const g = girl(1, 3000, 'fire', { level: 375, graded: 2, nb_grades: 6 });
        expect(TeamSelectionService.developmentFactor(g)).toBeCloseTo(2 * 2.8 / 1.6);
    });

    it('leaves a fully developed girl as she is', () => {
        expect(TeamSelectionService.developmentFactor(girl(1, 3000))).toBeCloseTo(1);
    });
});

describe('TeamSelectionService.scoreAgainstOpponentsSliced', () => {
    it('gives the same sums as the plain version', async () => {
        const sim = (_h: FighterData, p: FighterData) => ({ points: 10 + p.damage, win: 0.25 });
        const opps = [opponent(3), opponent(0), opponent(2)];
        const plain = TeamSelectionService.scoreAgainstOpponents(opps[0].player, opps, sim);
        const sliced = await TeamSelectionService.scoreAgainstOpponentsSliced(opps[0].player, opps, 0, sim);
        expect(sliced).toEqual(plain);
    });
});
