import {
    TeamScoringService,
    ElementType,
    GirlData,
    RarityType,
} from '../../src/Service/TeamScoringService';

function makeGirl(overrides: Partial<GirlData> = {}): GirlData {
    return {
        id_girl: 1,
        name: 'TestGirl',
        carac1: 1000,
        carac2: 2000,
        carac3: 3000,
        level: 100,
        element: 'fire',
        rarity: 'mythic',
        graded: 0,
        nb_grades: 5,
        ...overrides,
    };
}

describe('TeamScoringService', () => {

    describe('getStatSum', () => {
        it('should sum carac1 + carac2 + carac3 from direct fields', () => {
            const girl = makeGirl({ carac1: 100, carac2: 200, carac3: 300 });
            expect(TeamScoringService.getStatSum(girl)).toBe(600);
        });

        it('should prefer caracs sub-object when available', () => {
            const girl = makeGirl({
                carac1: 100, carac2: 200, carac3: 300,
                caracs: { carac1: 500, carac2: 600, carac3: 700 },
            });
            expect(TeamScoringService.getStatSum(girl)).toBe(1800);
        });
    });

    describe('scoreCurrentBest', () => {
        it('should return the raw stat sum', () => {
            const girl = makeGirl({ carac1: 5000, carac2: 3000, carac3: 2000 });
            expect(TeamScoringService.scoreCurrentBest(girl)).toBe(10000);
        });
    });

    describe('scoreBestPossible', () => {
        it('should project stats for a fully graded girl at player level', () => {
            // Girl at level 50, player level 100, 0 grades applied, 5 max grades
            // Expected: 6000 * (100/50) / (1 + 0) * (1 + 1.5) = 6000 * 2 * 2.5 = 30000
            const girl = makeGirl({
                carac1: 1000, carac2: 2000, carac3: 3000,
                level: 50, graded: 0, nb_grades: 5,
            });
            expect(TeamScoringService.scoreBestPossible(girl, 100)).toBe(30000);
        });

        it('should account for existing grades reducing projected growth', () => {
            // Girl at level 50, player level 100, 3 grades applied, 5 max grades
            // Expected: 6000 * (100/50) / (1 + 0.9) * (1 + 1.5) = 6000 * 2 / 1.9 * 2.5
            const girl = makeGirl({
                carac1: 1000, carac2: 2000, carac3: 3000,
                level: 50, graded: 3, nb_grades: 5,
            });
            const expected = 6000 * 2 / 1.9 * 2.5;
            expect(TeamScoringService.scoreBestPossible(girl, 100)).toBeCloseTo(expected, 2);
        });

        it('should handle level 1 girls without division by zero', () => {
            const girl = makeGirl({ level: 1, carac1: 10, carac2: 20, carac3: 30 });
            const result = TeamScoringService.scoreBestPossible(girl, 100);
            expect(result).toBeGreaterThan(0);
            expect(isFinite(result)).toBe(true);
        });

        it('should handle level 0 gracefully', () => {
            const girl = makeGirl({ level: 0, carac1: 10, carac2: 20, carac3: 30 });
            const result = TeamScoringService.scoreBestPossible(girl, 100);
            expect(isFinite(result)).toBe(true);
        });
    });

    describe('filterHighRarity', () => {
        it('should keep only mythic and legendary girls', () => {
            const girls = [
                makeGirl({ id_girl: 1, rarity: 'mythic' }),
                makeGirl({ id_girl: 2, rarity: 'legendary' }),
                makeGirl({ id_girl: 3, rarity: 'epic' }),
                makeGirl({ id_girl: 4, rarity: 'rare' }),
                makeGirl({ id_girl: 5, rarity: 'common' }),
            ];
            const filtered = TeamScoringService.filterHighRarity(girls);
            expect(filtered).toHaveLength(2);
            expect(filtered.map(g => g.id_girl)).toEqual([1, 2]);
        });

        it('should return empty array when no high-rarity girls exist', () => {
            const girls = [
                makeGirl({ rarity: 'epic' }),
                makeGirl({ rarity: 'rare' }),
            ];
            expect(TeamScoringService.filterHighRarity(girls)).toHaveLength(0);
        });
    });

    describe('getTier5Skill', () => {
        it('should return Execute for fire and water elements', () => {
            expect(TeamScoringService.getTier5Skill('fire')).toEqual({ id: 14, name: 'Execute', priority: 4 });
            expect(TeamScoringService.getTier5Skill('water')).toEqual({ id: 14, name: 'Execute', priority: 4 });
        });

        it('should return Stun for sun and darkness elements', () => {
            expect(TeamScoringService.getTier5Skill('sun')).toEqual({ id: 11, name: 'Stun', priority: 3 });
            expect(TeamScoringService.getTier5Skill('darkness')).toEqual({ id: 11, name: 'Stun', priority: 3 });
        });

        it('should return Shield for stone and light elements', () => {
            expect(TeamScoringService.getTier5Skill('stone')).toEqual({ id: 12, name: 'Shield', priority: 2 });
            expect(TeamScoringService.getTier5Skill('light')).toEqual({ id: 12, name: 'Shield', priority: 2 });
        });

        it('should return Reflect for psychic and nature elements', () => {
            expect(TeamScoringService.getTier5Skill('psychic')).toEqual({ id: 13, name: 'Reflect', priority: 1 });
            expect(TeamScoringService.getTier5Skill('nature')).toEqual({ id: 13, name: 'Reflect', priority: 1 });
        });
    });

    describe('calculateSynergies', () => {
        it('should return zero bonuses for empty team', () => {
            const syn = TeamScoringService.calculateSynergies([]);
            expect(syn.critDamage).toBe(0);
            expect(syn.healOnHit).toBe(0);
            expect(syn.ego).toBe(0);
            expect(syn.critChance).toBe(0);
            expect(syn.defReduce).toBe(0);
            expect(syn.damage).toBe(0);
            expect(syn.defense).toBe(0);
            expect(syn.harmony).toBe(0);
        });

        it('should add 10% critDamage per fire girl', () => {
            const syn = TeamScoringService.calculateSynergies(['fire', 'fire', 'fire']);
            expect(syn.critDamage).toBeCloseTo(0.30, 5);
        });

        it('should add 3% healOnHit per water girl', () => {
            const syn = TeamScoringService.calculateSynergies(['water', 'water']);
            expect(syn.healOnHit).toBeCloseTo(0.06, 5);
        });

        it('should add 2% critChance per stone girl', () => {
            const syn = TeamScoringService.calculateSynergies(['stone']);
            expect(syn.critChance).toBeCloseTo(0.02, 5);
        });

        it('should accumulate bonuses from mixed elements', () => {
            const syn = TeamScoringService.calculateSynergies(['fire', 'water', 'stone', 'sun', 'darkness', 'psychic', 'light']);
            expect(syn.critDamage).toBeCloseTo(0.10, 5);    // 1 fire
            expect(syn.healOnHit).toBeCloseTo(0.03, 5);     // 1 water
            expect(syn.critChance).toBeCloseTo(0.02, 5);    // 1 stone
            expect(syn.defReduce).toBeCloseTo(0.02, 5);     // 1 sun
            expect(syn.damage).toBeCloseTo(0.02, 5);        // 1 darkness
            expect(syn.defense).toBeCloseTo(0.02, 5);       // 1 psychic
            expect(syn.harmony).toBeCloseTo(0.02, 5);       // 1 light
        });
    });

    describe('calculateSynergyValue', () => {
        it('should return 0 for empty team', () => {
            expect(TeamScoringService.calculateSynergyValue([])).toBe(0);
        });

        it('should value fire higher than psychic (same number of girls)', () => {
            const fireValue = TeamScoringService.calculateSynergyValue(['fire']);
            const psychicValue = TeamScoringService.calculateSynergyValue(['psychic']);
            expect(fireValue).toBeGreaterThan(psychicValue);
        });

        it('should increase with more girls', () => {
            const one = TeamScoringService.calculateSynergyValue(['fire']);
            const three = TeamScoringService.calculateSynergyValue(['fire', 'fire', 'fire']);
            expect(three).toBeGreaterThan(one);
        });
    });

    describe('scoreWithSynergy', () => {
        it('should add synergy bonus on top of raw stat score', () => {
            const girl = makeGirl({ element: 'fire', carac1: 5000, carac2: 3000, carac3: 2000 });
            const statScore = 10000;
            const maxStat = 10000;

            const withoutSynergy = statScore;
            const withSynergy = TeamScoringService.scoreWithSynergy(girl, [], statScore, maxStat);
            expect(withSynergy).toBeGreaterThan(withoutSynergy);
        });

        it('should return raw stat score when synergy weight is 0', () => {
            const girl = makeGirl({ element: 'fire' });
            const score = TeamScoringService.scoreWithSynergy(girl, [], 10000, 10000, 0);
            expect(score).toBe(10000);
        });

        it('should give diminishing returns for duplicate elements', () => {
            const girl = makeGirl({ element: 'fire' });
            // Adding fire to empty team
            const firstFire = TeamScoringService.scoreWithSynergy(girl, [], 10000, 10000);
            // Adding fire to team that already has 5 fire girls
            const sixthFire = TeamScoringService.scoreWithSynergy(
                girl, ['fire', 'fire', 'fire', 'fire', 'fire'], 10000, 10000
            );
            // Both should add the same synergy delta since it's linear per girl
            expect(firstFire).toBeCloseTo(sixthFire, 5);
        });
    });

    describe('rankLeaderCandidates', () => {
        it('should rank Execute elements first', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'nature' }),  // Reflect (1)
                makeGirl({ id_girl: 2, element: 'fire' }),    // Execute (4)
                makeGirl({ id_girl: 3, element: 'sun' }),     // Stun (3)
                makeGirl({ id_girl: 4, element: 'stone' }),   // Shield (2)
            ];
            const scores = new Map([[1, 1000], [2, 1000], [3, 1000], [4, 1000]]);
            const ranked = TeamScoringService.rankLeaderCandidates(girls, scores);
            expect(ranked[0].element).toBe('fire');
            expect(ranked[1].element).toBe('sun');
            expect(ranked[2].element).toBe('stone');
            expect(ranked[3].element).toBe('nature');
        });

        it('should break ties by stat score within same tier-5 priority', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'fire', name: 'WeakFire' }),
                makeGirl({ id_girl: 2, element: 'water', name: 'StrongWater' }),
            ];
            // Both have Execute (priority 4), but water girl has higher stats
            const scores = new Map([[1, 5000], [2, 9000]]);
            const ranked = TeamScoringService.rankLeaderCandidates(girls, scores);
            expect(ranked[0].id_girl).toBe(2);  // StrongWater first
            expect(ranked[1].id_girl).toBe(1);  // WeakFire second
        });

        it('should prefer higher tier-5 even with lower stats', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'nature' }),  // Reflect (1)
                makeGirl({ id_girl: 2, element: 'fire' }),    // Execute (4)
            ];
            // Nature has way higher stats but Reflect is worst tier-5
            const scores = new Map([[1, 50000], [2, 10000]]);
            const ranked = TeamScoringService.rankLeaderCandidates(girls, scores);
            expect(ranked[0].id_girl).toBe(2);  // Fire with Execute wins
        });
    });
});
