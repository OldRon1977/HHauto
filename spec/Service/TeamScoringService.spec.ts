import {
    TeamScoringService,
    ElementType,
    GirlData,
    RarityType,
    TraitCategory,
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
            const girl = makeGirl({
                carac1: 1000, carac2: 2000, carac3: 3000,
                level: 50, graded: 0, nb_grades: 5,
            });
            expect(TeamScoringService.scoreBestPossible(girl, 100)).toBe(30000);
        });

        it('should account for existing grades reducing projected growth', () => {
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
        it('should return Shield for light and stone elements (highest priority)', () => {
            expect(TeamScoringService.getTier5Skill('light')).toEqual({ id: 12, name: 'Shield', priority: 4 });
            expect(TeamScoringService.getTier5Skill('stone')).toEqual({ id: 12, name: 'Shield', priority: 4 });
        });

        it('should return Stun for sun and darkness elements', () => {
            expect(TeamScoringService.getTier5Skill('sun')).toEqual({ id: 11, name: 'Stun', priority: 3 });
            expect(TeamScoringService.getTier5Skill('darkness')).toEqual({ id: 11, name: 'Stun', priority: 3 });
        });

        it('should return Execute for fire and water elements', () => {
            expect(TeamScoringService.getTier5Skill('fire')).toEqual({ id: 14, name: 'Execute', priority: 2 });
            expect(TeamScoringService.getTier5Skill('water')).toEqual({ id: 14, name: 'Execute', priority: 2 });
        });

        it('should return Reflect for psychic and nature elements', () => {
            expect(TeamScoringService.getTier5Skill('psychic')).toEqual({ id: 13, name: 'Reflect', priority: 1 });
            expect(TeamScoringService.getTier5Skill('nature')).toEqual({ id: 13, name: 'Reflect', priority: 1 });
        });
    });

    // ─── Trait / Tier 3 Tests ────────────────────────────────────────

    describe('getTraitCategory', () => {
        it('should map fire and darkness to eyeColor', () => {
            expect(TeamScoringService.getTraitCategory('fire')).toBe('eyeColor');
            expect(TeamScoringService.getTraitCategory('darkness')).toBe('eyeColor');
        });

        it('should map light and nature to hairColor', () => {
            expect(TeamScoringService.getTraitCategory('light')).toBe('hairColor');
            expect(TeamScoringService.getTraitCategory('nature')).toBe('hairColor');
        });

        it('should map stone and psychic to zodiac', () => {
            expect(TeamScoringService.getTraitCategory('stone')).toBe('zodiac');
            expect(TeamScoringService.getTraitCategory('psychic')).toBe('zodiac');
        });

        it('should map water and sun to position', () => {
            expect(TeamScoringService.getTraitCategory('water')).toBe('position');
            expect(TeamScoringService.getTraitCategory('sun')).toBe('position');
        });
    });

    describe('getTraitValue', () => {
        it('should return eyeColor for fire girls', () => {
            const girl = makeGirl({ element: 'fire', eyeColor: 'blue' });
            expect(TeamScoringService.getTraitValue(girl)).toBe('blue');
        });

        it('should return hairColor for light girls', () => {
            const girl = makeGirl({ element: 'light', hairColor: 'blonde' });
            expect(TeamScoringService.getTraitValue(girl)).toBe('blonde');
        });

        it('should return zodiac for stone girls', () => {
            const girl = makeGirl({ element: 'stone', zodiac: 'Sagittarius' });
            expect(TeamScoringService.getTraitValue(girl)).toBe('Sagittarius');
        });

        it('should return position for water girls', () => {
            const girl = makeGirl({ element: 'water', position: '3' });
            expect(TeamScoringService.getTraitValue(girl)).toBe('3');
        });

        it('should return undefined when trait data is missing', () => {
            const girl = makeGirl({ element: 'fire' }); // no eyeColor set
            expect(TeamScoringService.getTraitValue(girl)).toBeUndefined();
        });
    });

    describe('calculateTier3TeamBonus', () => {
        it('should return 0 for an empty team', () => {
            expect(TeamScoringService.calculateTier3TeamBonus([])).toBe(0);
        });

        it('should return 0 when no girls share trait values', () => {
            const team = [
                makeGirl({ id_girl: 1, element: 'fire', eyeColor: 'blue' }),
                makeGirl({ id_girl: 2, element: 'light', hairColor: 'blonde' }),
                makeGirl({ id_girl: 3, element: 'stone', zodiac: 'Aries' }),
            ];
            expect(TeamScoringService.calculateTier3TeamBonus(team)).toBe(0);
        });

        it('should calculate bonus for matching fire/darkness girls (eye color)', () => {
            // 3 mythic fire girls with same eye color
            // Each matches 2 others → 3 × 2 × 0.01 = 0.06
            const team = [
                makeGirl({ id_girl: 1, element: 'fire', eyeColor: 'blue', rarity: 'mythic' }),
                makeGirl({ id_girl: 2, element: 'fire', eyeColor: 'blue', rarity: 'mythic' }),
                makeGirl({ id_girl: 3, element: 'darkness', eyeColor: 'blue', rarity: 'mythic' }),
            ];
            expect(TeamScoringService.calculateTier3TeamBonus(team)).toBeCloseTo(0.06, 5);
        });

        it('should use lower bonus for legendary girls', () => {
            // 2 legendary fire girls with same eye color
            // Each matches 1 other → 2 × 1 × 0.008 = 0.016
            const team = [
                makeGirl({ id_girl: 1, element: 'fire', eyeColor: 'blue', rarity: 'legendary' }),
                makeGirl({ id_girl: 2, element: 'fire', eyeColor: 'blue', rarity: 'legendary' }),
            ];
            expect(TeamScoringService.calculateTier3TeamBonus(team)).toBeCloseTo(0.016, 5);
        });

        it('should handle mixed mythic and legendary bonuses', () => {
            // 1 mythic + 1 legendary with same eye color
            // Mythic matches 1 → 0.01, Legendary matches 1 → 0.008
            const team = [
                makeGirl({ id_girl: 1, element: 'fire', eyeColor: 'blue', rarity: 'mythic' }),
                makeGirl({ id_girl: 2, element: 'darkness', eyeColor: 'blue', rarity: 'legendary' }),
            ];
            expect(TeamScoringService.calculateTier3TeamBonus(team)).toBeCloseTo(0.018, 5);
        });

        it('should calculate max bonus for full team of 7 matching mythics', () => {
            // 7 mythic girls, all fire/darkness, all same eye color
            // Each matches 6 others → 7 × 6 × 0.01 = 0.42
            const team = Array.from({ length: 7 }, (_, i) =>
                makeGirl({
                    id_girl: i + 1,
                    element: i % 2 === 0 ? 'fire' : 'darkness',
                    eyeColor: 'blue',
                    rarity: 'mythic',
                })
            );
            expect(TeamScoringService.calculateTier3TeamBonus(team)).toBeCloseTo(0.42, 5);
        });

        it('should not count cross-category matches', () => {
            // fire (eyeColor) and light (hairColor) — different categories, no match
            const team = [
                makeGirl({ id_girl: 1, element: 'fire', eyeColor: 'blue' }),
                makeGirl({ id_girl: 2, element: 'light', hairColor: 'blue' }),
            ];
            expect(TeamScoringService.calculateTier3TeamBonus(team)).toBe(0);
        });
    });

    describe('findTraitGroups', () => {
        it('should return empty array for no girls', () => {
            expect(TeamScoringService.findTraitGroups([])).toHaveLength(0);
        });

        it('should group fire/darkness girls by eye color', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'fire', eyeColor: 'blue', carac1: 5000, carac2: 3000, carac3: 2000 }),
                makeGirl({ id_girl: 2, element: 'fire', eyeColor: 'blue', carac1: 4000, carac2: 3000, carac3: 2000 }),
                makeGirl({ id_girl: 3, element: 'darkness', eyeColor: 'blue', carac1: 4500, carac2: 3000, carac3: 2000 }),
                makeGirl({ id_girl: 4, element: 'fire', eyeColor: 'green', carac1: 6000, carac2: 3000, carac3: 2000 }),
            ];
            const groups = TeamScoringService.findTraitGroups(girls);
            const blueGroup = groups.find(g => g.traitValue === 'blue');
            expect(blueGroup).toBeDefined();
            expect(blueGroup!.girls).toHaveLength(3);
            expect(blueGroup!.traitCategory).toBe('eyeColor');
        });

        it('should sort groups by score descending', () => {
            const girls = [
                // 3 fire girls with blue eyes (strong group)
                makeGirl({ id_girl: 1, element: 'fire', eyeColor: 'blue', carac1: 5000, carac2: 3000, carac3: 2000 }),
                makeGirl({ id_girl: 2, element: 'fire', eyeColor: 'blue', carac1: 5000, carac2: 3000, carac3: 2000 }),
                makeGirl({ id_girl: 3, element: 'darkness', eyeColor: 'blue', carac1: 5000, carac2: 3000, carac3: 2000 }),
                // 2 light girls with blonde hair (weaker group)
                makeGirl({ id_girl: 4, element: 'light', hairColor: 'blonde', carac1: 5000, carac2: 3000, carac3: 2000 }),
                makeGirl({ id_girl: 5, element: 'nature', hairColor: 'blonde', carac1: 5000, carac2: 3000, carac3: 2000 }),
            ];
            const groups = TeamScoringService.findTraitGroups(girls);
            expect(groups[0].traitCategory).toBe('eyeColor');
            expect(groups[0].girls).toHaveLength(3);
        });

        it('should apply position penalty', () => {
            const girls = [
                // 3 water girls with same position
                makeGirl({ id_girl: 1, element: 'water', position: '3', carac1: 5000, carac2: 3000, carac3: 2000 }),
                makeGirl({ id_girl: 2, element: 'water', position: '3', carac1: 5000, carac2: 3000, carac3: 2000 }),
                makeGirl({ id_girl: 3, element: 'sun', position: '3', carac1: 5000, carac2: 3000, carac3: 2000 }),
                // 3 fire girls with same eyes (should win due to no penalty)
                makeGirl({ id_girl: 4, element: 'fire', eyeColor: 'blue', carac1: 5000, carac2: 3000, carac3: 2000 }),
                makeGirl({ id_girl: 5, element: 'fire', eyeColor: 'blue', carac1: 5000, carac2: 3000, carac3: 2000 }),
                makeGirl({ id_girl: 6, element: 'darkness', eyeColor: 'blue', carac1: 5000, carac2: 3000, carac3: 2000 }),
            ];
            const groups = TeamScoringService.findTraitGroups(girls);
            // Eye color group should rank higher than position group (same stats, but position has penalty)
            expect(groups[0].traitCategory).toBe('eyeColor');
        });

        it('should skip girls without trait data', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'fire' }), // no eyeColor
                makeGirl({ id_girl: 2, element: 'fire', eyeColor: 'blue' }),
            ];
            const groups = TeamScoringService.findTraitGroups(girls);
            const blueGroup = groups.find(g => g.traitValue === 'blue');
            expect(blueGroup).toBeDefined();
            expect(blueGroup!.girls).toHaveLength(1);
        });
    });

    // ─── Synergy Tests ───────────────────────────────────────────────

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
            expect(syn.critDamage).toBeCloseTo(0.10, 5);
            expect(syn.healOnHit).toBeCloseTo(0.03, 5);
            expect(syn.critChance).toBeCloseTo(0.02, 5);
            expect(syn.defReduce).toBeCloseTo(0.02, 5);
            expect(syn.damage).toBeCloseTo(0.02, 5);
            expect(syn.defense).toBeCloseTo(0.02, 5);
            expect(syn.harmony).toBeCloseTo(0.02, 5);
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

        it('should give consistent returns for duplicate elements', () => {
            const girl = makeGirl({ element: 'fire' });
            const firstFire = TeamScoringService.scoreWithSynergy(girl, [], 10000, 10000);
            const sixthFire = TeamScoringService.scoreWithSynergy(
                girl, ['fire', 'fire', 'fire', 'fire', 'fire'], 10000, 10000
            );
            expect(firstFire).toBeCloseTo(sixthFire, 5);
        });
    });

    // ─── Leader Selection Tests ──────────────────────────────────────

    describe('rankLeaderCandidates', () => {
        it('should rank Shield elements (light/stone) first', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'nature', rarity: 'mythic' }),   // Reflect (1)
                makeGirl({ id_girl: 2, element: 'fire', rarity: 'mythic' }),     // Execute (2)
                makeGirl({ id_girl: 3, element: 'sun', rarity: 'mythic' }),      // Stun (3)
                makeGirl({ id_girl: 4, element: 'light', rarity: 'mythic' }),    // Shield (4)
            ];
            const scores = new Map([[1, 1000], [2, 1000], [3, 1000], [4, 1000]]);
            const ranked = TeamScoringService.rankLeaderCandidates(girls, scores);
            expect(ranked[0].element).toBe('light');
            expect(ranked[1].element).toBe('sun');
            expect(ranked[2].element).toBe('fire');
            expect(ranked[3].element).toBe('nature');
        });

        it('should prefer higher priority even with lower stats', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'fire', rarity: 'mythic' }),     // Execute (2)
                makeGirl({ id_girl: 2, element: 'light', rarity: 'mythic' }),    // Shield (4)
            ];
            // Fire has much higher stats but Shield priority is higher
            const scores = new Map([[1, 50000], [2, 10000]]);
            const ranked = TeamScoringService.rankLeaderCandidates(girls, scores);
            expect(ranked[0].id_girl).toBe(2);  // Light with Shield wins
        });

        it('should prefer trait-matching leader as tiebreaker within same priority', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'light', rarity: 'mythic', hairColor: 'blonde' }),
                makeGirl({ id_girl: 2, element: 'stone', rarity: 'mythic', zodiac: 'Aries' }),
            ];
            const scores = new Map([[1, 10000], [2, 10000]]);
            // Team trait is hairColor:blonde → light girl matches
            const ranked = TeamScoringService.rankLeaderCandidates(girls, scores, 'hairColor', 'blonde');
            expect(ranked[0].id_girl).toBe(1);  // light girl matches team trait
        });

        it('should only consider mythic girls for leader', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'light', rarity: 'legendary' }),
                makeGirl({ id_girl: 2, element: 'fire', rarity: 'mythic' }),
            ];
            const scores = new Map([[1, 50000], [2, 10000]]);
            const ranked = TeamScoringService.rankLeaderCandidates(girls, scores);
            // Only mythic girl should be returned
            expect(ranked).toHaveLength(1);
            expect(ranked[0].id_girl).toBe(2);
        });

        it('should fall back to all girls when no mythics available', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'light', rarity: 'legendary' }),
                makeGirl({ id_girl: 2, element: 'fire', rarity: 'legendary' }),
            ];
            const scores = new Map([[1, 10000], [2, 10000]]);
            const ranked = TeamScoringService.rankLeaderCandidates(girls, scores);
            expect(ranked).toHaveLength(2);
            expect(ranked[0].element).toBe('light'); // Shield priority
        });

        it('should break ties by stat score within same priority and trait match', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'light', rarity: 'mythic', name: 'WeakLight' }),
                makeGirl({ id_girl: 2, element: 'stone', rarity: 'mythic', name: 'StrongStone' }),
            ];
            const scores = new Map([[1, 5000], [2, 9000]]);
            const ranked = TeamScoringService.rankLeaderCandidates(girls, scores);
            expect(ranked[0].id_girl).toBe(2);  // StrongStone first (higher stats, same priority)
        });
    });
});
