import {
    TeamScoringService,
    ElementType,
    GirlData,
    RarityType,
    PlayerClass,
} from '../../src/Service/TeamScoringService';

function makeGirl(overrides: Partial<GirlData> = {}): GirlData {
    return {
        id_girl: 1,
        name: 'TestGirl',
        carac1: 1000,
        carac2: 2000,
        carac3: 3000,
        level: 100,
        class: 1,
        element: 'fire',
        rarity: 'mythic',
        graded: 0,
        nb_grades: 5,
        ...overrides,
    };
}

describe('TeamScoringService', () => {

    describe('getMainCarac', () => {
        it('should return carac1 for class 1 (Hardcore)', () => {
            const girl = makeGirl({ carac1: 100, carac2: 200, carac3: 300 });
            expect(TeamScoringService.getMainCarac(girl, 1)).toBe(100);
        });

        it('should return carac2 for class 2 (Charm)', () => {
            const girl = makeGirl({ carac1: 100, carac2: 200, carac3: 300 });
            expect(TeamScoringService.getMainCarac(girl, 2)).toBe(200);
        });

        it('should return carac3 for class 3 (Know-how)', () => {
            const girl = makeGirl({ carac1: 100, carac2: 200, carac3: 300 });
            expect(TeamScoringService.getMainCarac(girl, 3)).toBe(300);
        });

        it('should prefer caracs sub-object when available', () => {
            const girl = makeGirl({
                carac1: 100, carac2: 200, carac3: 300,
                caracs: { carac1: 500, carac2: 600, carac3: 700 },
            });
            expect(TeamScoringService.getMainCarac(girl, 1)).toBe(500);
            expect(TeamScoringService.getMainCarac(girl, 2)).toBe(600);
            expect(TeamScoringService.getMainCarac(girl, 3)).toBe(700);
        });
    });

    describe('scoreCurrentBest', () => {
        it('should return the main-class carac for player class 3', () => {
            const girl = makeGirl({ carac1: 5000, carac2: 3000, carac3: 7000 });
            expect(TeamScoringService.scoreCurrentBest(girl, 3)).toBe(7000);
        });
    });

    describe('scoreBestPossible', () => {
        // Formula: projected = currentMain * (750/level) * (1+0.3*nb_grades) / (1+0.3*graded)
        // No max() guard. For voll-awakte girls (level=750, graded=nb_grades), projected == current.
        // For non-fully-developed girls, projected > current.

        it('should project a non-fully-developed girl to a higher value', () => {
            // class 3, girl carac3=3000 at level 50, 0/5 grades
            // projected = 3000 * (750/50) * (1 + 1.5) / 1 = 3000 * 15 * 2.5 = 112500
            const girl = makeGirl({
                carac1: 1000, carac2: 2000, carac3: 3000,
                level: 50, graded: 0, nb_grades: 5,
            });
            expect(TeamScoringService.scoreBestPossible(girl, 3)).toBe(112500);
        });

        it('should account for existing grades reducing projected growth', () => {
            // class 3, carac3=3000, level 50, 3/5 grades
            // projected = 3000 * 15 * (1 + 0.3*5) / (1 + 0.3*3) = 3000 * 15 * 2.5 / 1.9
            const girl = makeGirl({
                carac1: 1000, carac2: 2000, carac3: 3000,
                level: 50, graded: 3, nb_grades: 5,
            });
            const expected = 3000 * 15 * 2.5 / 1.9;
            expect(TeamScoringService.scoreBestPossible(girl, 3)).toBeCloseTo(expected, 2);
        });

        it('should return current carac when girl is voll-awakt (level=750, graded=max)', () => {
            // For a fully developed girl, projection factor is 1 -> projected == current.
            // No max() guard needed.
            const girl = makeGirl({
                carac1: 0, carac2: 0, carac3: 12397,
                level: 750, graded: 5, nb_grades: 5,
            });
            const result = TeamScoringService.scoreBestPossible(girl, 3);
            expect(result).toBeCloseTo(12397, 5);
        });

        it('should never return less than current main-carac with normal data', () => {
            // No max() in formula, but with level<=750 and graded<=nb_grades,
            // projected is mathematically >= current.
            const girl = makeGirl({
                carac1: 0, carac2: 0, carac3: 50000,
                level: 750, graded: 5, nb_grades: 5,
            });
            const result = TeamScoringService.scoreBestPossible(girl, 3);
            expect(result).toBeCloseTo(50000, 5);
        });

        it('should project low-level girls aggressively', () => {
            // New girl at level 1, no grades yet:
            // projected = 100 * 750 / 1 * (1 + 0.3*5) / 1 = 100 * 750 * 2.5 = 187500
            const girl = makeGirl({
                carac1: 0, carac2: 0, carac3: 100,
                level: 1, graded: 0, nb_grades: 5,
            });
            const result = TeamScoringService.scoreBestPossible(girl, 3);
            expect(result).toBe(187500);
        });
    });

    describe('filterEligible', () => {
        it('should keep mythic and 5-star legendary girls of the player class', () => {
            const girls = [
                makeGirl({ id_girl: 1, rarity: 'mythic', nb_grades: 6, class: 3 }),
                makeGirl({ id_girl: 2, rarity: 'legendary', nb_grades: 5, class: 3 }),
                makeGirl({ id_girl: 3, rarity: 'epic', class: 3 }),
                makeGirl({ id_girl: 4, rarity: 'rare', class: 3 }),
                makeGirl({ id_girl: 5, rarity: 'common', class: 3 }),
            ];
            const filtered = TeamScoringService.filterEligible(girls, 3);
            expect(filtered).toHaveLength(2);
            expect(filtered.map(g => g.id_girl)).toEqual([1, 2]);
        });

        it('should filter out girls of a different class', () => {
            const girls = [
                makeGirl({ id_girl: 1, rarity: 'mythic', nb_grades: 6, class: 1 }),
                makeGirl({ id_girl: 2, rarity: 'mythic', nb_grades: 6, class: 2 }),
                makeGirl({ id_girl: 3, rarity: 'mythic', nb_grades: 6, class: 3 }),
            ];
            const filtered = TeamScoringService.filterEligible(girls, 3);
            expect(filtered).toHaveLength(1);
            expect(filtered[0].id_girl).toBe(3);
        });

        it('should keep girls with no class field (treat as eligible)', () => {
            const girls = [
                makeGirl({ id_girl: 1, rarity: 'mythic', nb_grades: 6, class: undefined }),
                makeGirl({ id_girl: 2, rarity: 'mythic', nb_grades: 6, class: 3 }),
            ];
            const filtered = TeamScoringService.filterEligible(girls, 3);
            expect(filtered).toHaveLength(2);
        });

        it('should exclude 3-star legendary girls', () => {
            const girls = [
                makeGirl({ id_girl: 1, rarity: 'legendary', nb_grades: 3, class: 3 }),
                makeGirl({ id_girl: 2, rarity: 'legendary', nb_grades: 5, class: 3 }),
                makeGirl({ id_girl: 3, rarity: 'mythic', nb_grades: 6, class: 3 }),
            ];
            const filtered = TeamScoringService.filterEligible(girls, 3);
            expect(filtered).toHaveLength(2);
            expect(filtered.map(g => g.id_girl)).toEqual([2, 3]);
        });
    });

    describe('filterHighRarity (legacy)', () => {
        it('should still filter by rarity only (back-compat shim)', () => {
            const girls = [
                makeGirl({ id_girl: 1, rarity: 'mythic', nb_grades: 6, class: 1 }),
                makeGirl({ id_girl: 2, rarity: 'legendary', nb_grades: 5, class: 2 }),
                makeGirl({ id_girl: 3, rarity: 'epic', class: 3 }),
            ];
            const filtered = TeamScoringService.filterHighRarity(girls);
            expect(filtered).toHaveLength(2);
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

    describe('getLeaderBonus', () => {
        it('should give Shield the highest leader bonus', () => {
            expect(TeamScoringService.getLeaderBonus({ id: 12, name: 'Shield', priority: 4 })).toBeCloseTo(0.08, 5);
        });
        it('should give Stun the second highest', () => {
            expect(TeamScoringService.getLeaderBonus({ id: 11, name: 'Stun', priority: 3 })).toBeCloseTo(0.06, 5);
        });
        it('should give Execute', () => {
            expect(TeamScoringService.getLeaderBonus({ id: 14, name: 'Execute', priority: 2 })).toBeCloseTo(0.04, 5);
        });
        it('should give Reflect the lowest', () => {
            expect(TeamScoringService.getLeaderBonus({ id: 13, name: 'Reflect', priority: 1 })).toBeCloseTo(0.02, 5);
        });
        it('should return 0 when no tier5 is given', () => {
            expect(TeamScoringService.getLeaderBonus(undefined)).toBe(0);
        });
    });

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
            const girl = makeGirl({ element: 'fire' });
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
            const team = [
                makeGirl({ id_girl: 1, element: 'fire', eyeColor: 'blue', rarity: 'mythic' }),
                makeGirl({ id_girl: 2, element: 'fire', eyeColor: 'blue', rarity: 'mythic' }),
                makeGirl({ id_girl: 3, element: 'darkness', eyeColor: 'blue', rarity: 'mythic' }),
            ];
            expect(TeamScoringService.calculateTier3TeamBonus(team)).toBeCloseTo(0.06, 5);
        });

        it('should use lower bonus for legendary girls', () => {
            const team = [
                makeGirl({ id_girl: 1, element: 'fire', eyeColor: 'blue', rarity: 'legendary' }),
                makeGirl({ id_girl: 2, element: 'fire', eyeColor: 'blue', rarity: 'legendary' }),
            ];
            expect(TeamScoringService.calculateTier3TeamBonus(team)).toBeCloseTo(0.016, 5);
        });

        it('should handle mixed mythic and legendary bonuses', () => {
            const team = [
                makeGirl({ id_girl: 1, element: 'fire', eyeColor: 'blue', rarity: 'mythic' }),
                makeGirl({ id_girl: 2, element: 'darkness', eyeColor: 'blue', rarity: 'legendary' }),
            ];
            expect(TeamScoringService.calculateTier3TeamBonus(team)).toBeCloseTo(0.018, 5);
        });

        it('should calculate max bonus for full team of 7 matching mythics', () => {
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
            const team = [
                makeGirl({ id_girl: 1, element: 'fire', eyeColor: 'blue' }),
                makeGirl({ id_girl: 2, element: 'light', hairColor: 'blue' }),
            ];
            expect(TeamScoringService.calculateTier3TeamBonus(team)).toBe(0);
        });
    });

    describe('calculateElementSynergyMultiplier', () => {
        it('should return 0 for empty team', () => {
            expect(TeamScoringService.calculateElementSynergyMultiplier([])).toBe(0);
        });

        it('should give a 7-fire mono-team a 0.70 (capped) multiplier', () => {
            const team = Array.from({ length: 7 }, (_, i) =>
                makeGirl({ id_girl: i + 1, element: 'fire' })
            );
            expect(TeamScoringService.calculateElementSynergyMultiplier(team)).toBeCloseTo(0.70, 5);
        });

        it('should sum across multiple elements', () => {
            // 3 fire (3 * 0.10 = 0.30) + 2 stone (2 * 0.02 = 0.04) + 2 light (2 * 0.02 = 0.04)
            const team = [
                makeGirl({ id_girl: 1, element: 'fire' }),
                makeGirl({ id_girl: 2, element: 'fire' }),
                makeGirl({ id_girl: 3, element: 'fire' }),
                makeGirl({ id_girl: 4, element: 'stone' }),
                makeGirl({ id_girl: 5, element: 'stone' }),
                makeGirl({ id_girl: 6, element: 'light' }),
                makeGirl({ id_girl: 7, element: 'light' }),
            ];
            expect(TeamScoringService.calculateElementSynergyMultiplier(team)).toBeCloseTo(0.38, 5);
        });
    });

    describe('findTraitGroups', () => {
        it('should return empty array for no girls', () => {
            expect(TeamScoringService.findTraitGroups([], () => 0)).toHaveLength(0);
        });

        it('should group fire/darkness girls by eye color (HC player)', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'fire', eyeColor: 'blue', carac1: 5000, carac2: 3000, carac3: 2000 }),
                makeGirl({ id_girl: 2, element: 'fire', eyeColor: 'blue', carac1: 4000, carac2: 3000, carac3: 2000 }),
                makeGirl({ id_girl: 3, element: 'darkness', eyeColor: 'blue', carac1: 4500, carac2: 3000, carac3: 2000 }),
                makeGirl({ id_girl: 4, element: 'fire', eyeColor: 'green', carac1: 6000, carac2: 3000, carac3: 2000 }),
            ];
            const scoreFn = (g: GirlData) => TeamScoringService.getMainCarac(g, 1);
            const groups = TeamScoringService.findTraitGroups(girls, scoreFn);
            const blueGroup = groups.find(g => g.traitValue === 'blue');
            expect(blueGroup).toBeDefined();
            expect(blueGroup!.girls).toHaveLength(3);
            expect(blueGroup!.traitCategory).toBe('eyeColor');
        });

        it('should sort groups by score descending using main-carac', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'fire', eyeColor: 'blue', carac1: 5000, carac2: 3000, carac3: 3000 }),
                makeGirl({ id_girl: 2, element: 'fire', eyeColor: 'blue', carac1: 5000, carac2: 3000, carac3: 3000 }),
                makeGirl({ id_girl: 3, element: 'darkness', eyeColor: 'blue', carac1: 5000, carac2: 3000, carac3: 3000 }),
                makeGirl({ id_girl: 4, element: 'light', hairColor: 'blonde', carac1: 5000, carac2: 3000, carac3: 2000 }),
                makeGirl({ id_girl: 5, element: 'nature', hairColor: 'blonde', carac1: 5000, carac2: 3000, carac3: 2000 }),
            ];
            const scoreFn = (g: GirlData) => TeamScoringService.getMainCarac(g, 3);
            const groups = TeamScoringService.findTraitGroups(girls, scoreFn);
            expect(groups[0].traitCategory).toBe('eyeColor');
            expect(groups[0].girls).toHaveLength(3);
        });

        it('should skip girls without trait data', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'fire' }),
                makeGirl({ id_girl: 2, element: 'fire', eyeColor: 'blue' }),
            ];
            const scoreFn = (g: GirlData) => TeamScoringService.getMainCarac(g, 1);
            const groups = TeamScoringService.findTraitGroups(girls, scoreFn);
            const blueGroup = groups.find(g => g.traitValue === 'blue');
            expect(blueGroup).toBeDefined();
            expect(blueGroup!.girls).toHaveLength(1);
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

    describe('rankLeaderCandidates', () => {
        it('should rank Shield elements (light/stone) first', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'nature', rarity: 'mythic' }),
                makeGirl({ id_girl: 2, element: 'fire', rarity: 'mythic' }),
                makeGirl({ id_girl: 3, element: 'sun', rarity: 'mythic' }),
                makeGirl({ id_girl: 4, element: 'light', rarity: 'mythic' }),
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
                makeGirl({ id_girl: 1, element: 'fire', rarity: 'mythic' }),
                makeGirl({ id_girl: 2, element: 'light', rarity: 'mythic' }),
            ];
            const scores = new Map([[1, 50000], [2, 10000]]);
            const ranked = TeamScoringService.rankLeaderCandidates(girls, scores);
            expect(ranked[0].id_girl).toBe(2);
        });

        it('should prefer trait-matching leader as tiebreaker within same priority', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'light', rarity: 'mythic', hairColor: 'blonde' }),
                makeGirl({ id_girl: 2, element: 'stone', rarity: 'mythic', zodiac: 'Aries' }),
            ];
            const scores = new Map([[1, 10000], [2, 10000]]);
            const ranked = TeamScoringService.rankLeaderCandidates(girls, scores, 'hairColor', 'blonde');
            expect(ranked[0].id_girl).toBe(1);
        });

        it('should only consider mythic girls for leader', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'light', rarity: 'legendary' }),
                makeGirl({ id_girl: 2, element: 'fire', rarity: 'mythic' }),
            ];
            const scores = new Map([[1, 50000], [2, 10000]]);
            const ranked = TeamScoringService.rankLeaderCandidates(girls, scores);
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
            expect(ranked[0].element).toBe('light');
        });

        it('should break ties by stat score within same priority and trait match', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'light', rarity: 'mythic', name: 'WeakLight' }),
                makeGirl({ id_girl: 2, element: 'stone', rarity: 'mythic', name: 'StrongStone' }),
            ];
            const scores = new Map([[1, 5000], [2, 9000]]);
            const ranked = TeamScoringService.rankLeaderCandidates(girls, scores);
            expect(ranked[0].id_girl).toBe(2);
        });
    });
});
