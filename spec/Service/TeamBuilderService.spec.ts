import { TeamBuilderService, TeamResult } from '../../src/Service/TeamBuilderService';
import { GirlData, ElementType, RarityType, PlayerClass } from '../../src/Service/TeamScoringService';

let nextId = 1;

function makeGirl(overrides: Partial<GirlData> = {}): GirlData {
    const id = overrides.id_girl ?? nextId++;
    return {
        id_girl: id,
        name: `Girl_${id}`,
        carac1: 1000 + Math.random() * 1000,
        carac2: 2000 + Math.random() * 1000,
        carac3: 3000 + Math.random() * 1000,
        level: 100,
        class: 3,
        element: 'fire' as ElementType,
        rarity: 'mythic' as RarityType,
        graded: 3,
        nb_grades: 5,
        eyeColor: 'blue',
        ...overrides,
    };
}

function makeTraitPool(count: number, defaults: Partial<GirlData> = {}): GirlData[] {
    const elements: ElementType[] = ['fire', 'darkness'];
    return Array.from({ length: count }, (_, i) => makeGirl({
        id_girl: 1000 + i,
        carac1: 2000 - i * 20,
        carac2: 3000 - i * 30,
        carac3: 5000 - i * 50,
        element: elements[i % elements.length],
        eyeColor: 'blue',
        rarity: 'mythic',
        class: 3,
        ...defaults,
    }));
}

beforeEach(() => {
    nextId = 1;
});

describe('TeamBuilderService', () => {

    describe('buildTeam', () => {

        it('should return null when fewer than 7 M+L girls of player class', () => {
            const girls = [
                ...makeTraitPool(5),
                makeGirl({ id_girl: 900, rarity: 'epic', carac3: 99999 }),
                makeGirl({ id_girl: 901, rarity: 'epic', carac3: 99999 }),
                makeGirl({ id_girl: 902, rarity: 'epic', carac3: 99999 }),
            ];
            const result = TeamBuilderService.buildTeam(girls, 1, 100, 3);
            expect(result).toBeNull();
        });

        it('should return a team of exactly 7 girls', () => {
            const girls = makeTraitPool(20);
            const result = TeamBuilderService.buildTeam(girls, 1, 100, 3);
            expect(result).not.toBeNull();
            expect(result!.girls).toHaveLength(7);
        });

        it('should not have duplicate girls in the team', () => {
            const girls = makeTraitPool(30);
            const result = TeamBuilderService.buildTeam(girls, 1, 100, 3)!;
            const ids = result.girls.map(g => g.id_girl);
            expect(new Set(ids).size).toBe(7);
        });

        it('should place leader at index 0 with a valid Tier 5 skill', () => {
            const girls = makeTraitPool(20);
            const result = TeamBuilderService.buildTeam(girls, 1, 100, 3)!;
            const tier5 = result.leaderTier5;
            expect(tier5.id).toBeGreaterThan(0);
            expect(['Execute', 'Stun', 'Shield', 'Reflect']).toContain(tier5.name);
        });

        it('should include elements array matching team composition', () => {
            const girls = makeTraitPool(20);
            const result = TeamBuilderService.buildTeam(girls, 1, 100, 3)!;
            expect(result.elements).toHaveLength(7);
            expect(result.elements[0]).toBe(result.girls[0].element);
        });

        it('should include stat scores for each team member', () => {
            const girls = makeTraitPool(20);
            const result = TeamBuilderService.buildTeam(girls, 1, 100, 3)!;
            expect(result.statScores).toHaveLength(7);
            result.statScores.forEach(score => {
                expect(score).toBeGreaterThan(0);
            });
        });

        it('should expose the player class on the result', () => {
            const girls = makeTraitPool(20);
            const result = TeamBuilderService.buildTeam(girls, 1, 100, 3)!;
            expect(result.playerClass).toBe(3);
        });
    });

    describe('Class filtering', () => {

        it('should exclude girls of a different class', () => {
            const girls = [
                ...makeTraitPool(10),
                // High-stat HC girl (class 1) -- must be filtered out for KH player (class 3)
                makeGirl({ id_girl: 999, rarity: 'mythic', class: 1, carac1: 99999, carac2: 99999, carac3: 99999, eyeColor: 'blue' }),
            ];
            const result = TeamBuilderService.buildTeam(girls, 1, 100, 3)!;
            const hasHC = result.girls.some(g => g.id_girl === 999);
            expect(hasHC).toBe(false);
        });
    });

    describe('Rarity filtering', () => {

        it('should filter out non-mythic/legendary girls in Mode 1', () => {
            const girls = [
                ...makeTraitPool(10),
                makeGirl({ id_girl: 999, rarity: 'epic', class: 3, carac3: 99999, eyeColor: 'blue' }),
            ];
            const result = TeamBuilderService.buildTeam(girls, 1, 100, 3)!;
            const hasEpic = result.girls.some(g => g.id_girl === 999);
            expect(hasEpic).toBe(false);
        });

        it('should filter out non-mythic/legendary girls in Mode 2', () => {
            const girls = [
                ...makeTraitPool(10),
                makeGirl({ id_girl: 999, rarity: 'epic', class: 3, carac3: 99999, eyeColor: 'blue' }),
            ];
            const result = TeamBuilderService.buildTeam(girls, 2, 100, 3)!;
            const hasEpic = result.girls.some(g => g.id_girl === 999);
            expect(hasEpic).toBe(false);
        });

        it('should return null when not enough mythic/legendary girls', () => {
            const girls = [
                ...makeTraitPool(3),
                ...Array.from({ length: 20 }, (_, i) => makeGirl({
                    id_girl: 500 + i, rarity: 'epic', class: 3,
                })),
            ];
            const result = TeamBuilderService.buildTeam(girls, 1, 100, 3);
            expect(result).toBeNull();
        });
    });

    describe('Trait-based team selection', () => {

        it('should include trait info in TeamResult', () => {
            const girls = makeTraitPool(20);
            const result = TeamBuilderService.buildTeam(girls, 1, 100, 3)!;

            expect(result.traitCategory).toBeDefined();
            expect(result.traitValue).toBeDefined();
            expect(result.tier3Bonus).toBeGreaterThanOrEqual(0);
            expect(result.traitMatchCount).toBeGreaterThanOrEqual(0);
        });

        it('should report correct traitMatchCount', () => {
            const girls = makeTraitPool(10);
            const result = TeamBuilderService.buildTeam(girls, 1, 100, 3)!;

            const fireOrDarknessInTeam = result.girls.filter(g =>
                g.element === 'fire' || g.element === 'darkness'
            ).length;
            expect(result.traitMatchCount).toBe(fireOrDarknessInTeam);
        });

        it('should expose effective power = main_sum * (1 + tier3Bonus)', () => {
            const girls = makeTraitPool(10);
            const result = TeamBuilderService.buildTeam(girls, 1, 100, 3)!;
            const sum = result.statScores.reduce((s, n) => s + n, 0);
            expect(result.effectivePower).toBe(Math.round(sum * (1 + result.tier3Bonus)));
        });
    });

    describe('Leader selection', () => {

        it('should prefer Shield (light/stone) leader when the chosen cluster matches', () => {
            // 7 light/nature girls with same hair color (strong hairColor cluster),
            // plus 3 fire/darkness fillers so the hair group dominates by main_sum.
            const hairCluster = Array.from({ length: 7 }, (_, i) => makeGirl({
                id_girl: 100 + i,
                element: i % 2 === 0 ? 'light' : 'nature',
                rarity: 'mythic',
                class: 3,
                carac3: 5000,
                hairColor: 'blonde',
            }));
            const eyeFillers = Array.from({ length: 3 }, (_, i) => makeGirl({
                id_girl: 200 + i,
                element: 'fire',
                rarity: 'mythic',
                class: 3,
                carac3: 4000,
                eyeColor: 'blue',
            }));
            const result = TeamBuilderService.buildTeam([...hairCluster, ...eyeFillers], 1, 100, 3)!;
            expect(result.traitCategory).toBe('hairColor');
            // Leader from light (Shield priority 4) beats nature (Reflect priority 1)
            expect(result.girls[0].element).toBe('light');
            expect(result.leaderTier5.name).toBe('Shield');
        });

        it('should use Mythic girls as leader even if legendary has higher stats', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'light', rarity: 'legendary', class: 3, carac3: 9000, hairColor: 'blonde' }),
                makeGirl({ id_girl: 2, element: 'stone', rarity: 'mythic', class: 3, carac3: 1000, zodiac: 'Aries' }),
                ...makeTraitPool(10).map((g, i) => ({ ...g, id_girl: 100 + i })),
            ];
            const result = TeamBuilderService.buildTeam(girls, 1, 100, 3)!;
            expect(result.girls[0].rarity).toBe('mythic');
        });

        it('should fall back when no light/stone mythic exists', () => {
            const girls = makeTraitPool(10);
            const result = TeamBuilderService.buildTeam(girls, 1, 100, 3)!;
            expect(result.girls[0]).toBeDefined();
            expect(['fire', 'darkness']).toContain(result.girls[0].element);
        });
    });

    describe('Mode 2: Best Possible', () => {

        it('should use projected stats for scoring', () => {
            const lowLevel = makeGirl({
                id_girl: 1, rarity: 'mythic', class: 3, level: 10,
                carac1: 200, carac2: 300, carac3: 500, nb_grades: 6, graded: 0,
                element: 'fire', eyeColor: 'blue',
            });
            const highLevel = makeGirl({
                id_girl: 2, rarity: 'mythic', class: 3, level: 100,
                carac1: 1000, carac2: 2000, carac3: 3000, nb_grades: 5, graded: 5,
                element: 'fire', eyeColor: 'blue',
            });
            const fillers = makeTraitPool(10).map((g, i) => ({
                ...g, id_girl: 100 + i, carac1: 1000, carac2: 1500, carac3: 2000,
            }));

            const result = TeamBuilderService.buildTeam(
                [lowLevel, highLevel, ...fillers], 2, 100, 3
            )!;

            const hasLowLevel = result.girls.some(g => g.id_girl === 1);
            expect(hasLowLevel).toBe(true);
        });

        it('should only include M+L girls (not all rarities)', () => {
            const girls = [
                ...makeTraitPool(8),
                makeGirl({ id_girl: 999, rarity: 'epic', class: 3, carac3: 99999, eyeColor: 'blue' }),
            ];
            const result = TeamBuilderService.buildTeam(girls, 2, 100, 3)!;
            const hasEpic = result.girls.some(g => g.rarity === 'epic');
            expect(hasEpic).toBe(false);
        });
    });

    describe('getElementDistribution', () => {

        const baseResult: TeamResult = {
            girls: [],
            statScores: [],
            synergyValue: 0,
            leaderTier5: { id: 12, name: 'Shield', priority: 4 },
            elements: [],
            traitCategory: 'eyeColor',
            traitValue: 'blue',
            tier3Bonus: 0,
            traitMatchCount: 0,
            blessedCategories: [],
            blessedGirlCount: 0,
            effectivePower: 0,
            alternatives: [],
            playerClass: 3,
        };

        it('should count elements correctly', () => {
            const team: TeamResult = {
                ...baseResult,
                elements: ['fire', 'fire', 'fire', 'darkness', 'darkness', 'light', 'stone'],
            };
            const dist = TeamBuilderService.getElementDistribution(team);
            expect(dist[0]).toEqual({ element: 'fire', count: 3 });
            expect(dist[1]).toEqual({ element: 'darkness', count: 2 });
            expect(dist.find(d => d.element === 'light')?.count).toBe(1);
            expect(dist.find(d => d.element === 'stone')?.count).toBe(1);
        });

        it('should sort by count descending', () => {
            const team: TeamResult = {
                ...baseResult,
                elements: ['fire', 'darkness', 'fire', 'darkness', 'fire', 'light', 'darkness'],
            };
            const dist = TeamBuilderService.getElementDistribution(team);
            expect(dist[0].count).toBe(3);
            expect(dist[1].count).toBe(3);
            expect(dist[2].count).toBe(1);
        });
    });
});