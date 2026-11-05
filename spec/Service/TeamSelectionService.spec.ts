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

describe('TeamSelectionService team model', () => {
    // A game that follows the measured shape exactly: per stat (a + b x sum) x (1 + synergy),
    // damage also x (1 + Tier 3).
    const game = { ego: [336771, 2.0], damage: [64932, 0.28], defense: [27774, 0.12], chance: [104631, 0] } as const;
    const harem = noHarem({ nature: 0.1, darkness: 0.07, light: 0.07, psychic: 0.07 });
    const sample = (sum: number, counts: Partial<Record<ElementType, number>>, tier3: number) => {
        const syn = (e: ElementType, per: number, cap: number) => 1 + Math.min((counts[e] || 0) * per, cap) + harem[e];
        return {
            sum, counts, tier3,
            caracs: {
                ego: (game.ego[0] + game.ego[1] * sum) * syn('nature', 0.03, 0.21),
                damage: (game.damage[0] + game.damage[1] * sum) * syn('darkness', 0.02, 0.14) * (1 + tier3),
                defense: (game.defense[0] + game.defense[1] * sum) * syn('light', 0.02, 0.14),
                chance: game.chance[0] * syn('psychic', 0.02, 0.14),
            },
        };
    };
    const samples = [
        sample(150000, { nature: 3, fire: 4 }, 0), sample(220000, { darkness: 7 }, 0.04),
        sample(90000, { light: 2, psychic: 2, sun: 3 }, 0.01), sample(180000, { water: 7 }, 0),
    ];

    it('recovers a and b of every stat, with synergy and Tier 3 divided out', () => {
        const model = TeamSelectionService.fitTeamModel(samples, harem)!;
        expect(model.ego[0]).toBeCloseTo(336771, 0);
        expect(model.ego[1]).toBeCloseTo(2.0, 6);
        expect(model.damage[1]).toBeCloseTo(0.28, 6);
        expect(model.defense[1]).toBeCloseTo(0.12, 6);
        expect(model.chance).toEqual([expect.closeTo(104631, 0), 0]);
        expect(TeamSelectionService.modelError(model, samples, harem)).toBeLessThan(1e-9);
    });

    it('calculates a team the game did not see', () => {
        const model = TeamSelectionService.fitTeamModel(samples, harem)!;
        const other = sample(200000, { nature: 4, darkness: 3 }, 0.05);
        const c = TeamSelectionService.modelCaracs(model, other.sum, other.counts, other.tier3, harem);
        expect(c.ego).toBeCloseTo(other.caracs.ego, 3);
        expect(c.damage).toBeCloseTo(other.caracs.damage, 3);
        expect(c.defense).toBeCloseTo(other.caracs.defense, 3);
    });

    it('refuses a fit without a spread of carac sums', () => {
        expect(TeamSelectionService.fitTeamModel(samples.slice(0, 2), harem)).toBeNull();
        const same = [sample(1000, {}, 0), sample(1000, { fire: 1 }, 0), sample(1000, { water: 1 }, 0)];
        expect(TeamSelectionService.fitTeamModel(same, harem)).toBeNull();
    });
});

describe('TeamSelectionService.calibrationTeams', () => {
    it('gives distinct teams of seven, the strongest and the weakest seven among them', () => {
        const pool = Array.from({ length: 40 }, (_, i) => girl(i + 1, 10000 - i * 100));
        const teams = TeamSelectionService.calibrationTeams(pool);
        expect(teams.length).toBe(10);
        expect(teams.every(t => t.length === 7 && new Set(t).size === 7)).toBe(true);
        expect(new Set(teams.map(t => TeamSelectionService.teamKey(t))).size).toBe(teams.length);
        expect(teams[0]).toEqual([1, 2, 3, 4, 5, 6, 7]);
        expect(teams[1]).toEqual([34, 35, 36, 37, 38, 39, 40]);
        expect(TeamSelectionService.calibrationTeams(pool)).toEqual(teams);
    });

    it('needs seven girls', () => {
        expect(TeamSelectionService.calibrationTeams([girl(1, 1), girl(2, 1)])).toEqual([]);
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
