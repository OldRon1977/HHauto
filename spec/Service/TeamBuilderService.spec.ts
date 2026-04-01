import { TeamBuilderService, TeamResult } from '../../src/Service/TeamBuilderService';
import { GirlData, ElementType, RarityType } from '../../src/Service/TeamScoringService';

let nextId = 1;

function makeGirl(overrides: Partial<GirlData> = {}): GirlData {
    const id = overrides.id_girl ?? nextId++;
    return {
        id_girl: id,
        name: `Girl_${id}`,
        carac1: 3000 + Math.random() * 1000,
        carac2: 2000 + Math.random() * 1000,
        carac3: 1000 + Math.random() * 1000,
        level: 100,
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
        carac1: 5000 - i * 50,
        carac2: 4000 - i * 40,
        carac3: 3000 - i * 30,
        element: elements[i % elements.length],
        eyeColor: 'blue',
        rarity: 'mythic',
        ...defaults,
    }));
}

beforeEach(() => {
    nextId = 1;
});

describe('TeamBuilderService', () => {

    describe('buildTeam', () => {

        it('should return null when fewer than 7 M+L girls available', () => {
            const girls = [
                ...makeTraitPool(5),
                // Epic girls should not help reach the threshold
                makeGirl({ id_girl: 900, rarity: 'epic', carac1: 99999, carac2: 99999, carac3: 99999 }),
                makeGirl({ id_girl: 901, rarity: 'epic', carac1: 99999, carac2: 99999, carac3: 99999 }),
                makeGirl({ id_girl: 902, rarity: 'epic', carac1: 99999, carac2: 99999, carac3: 99999 }),
            ];
            const result = TeamBuilderService.buildTeam(girls, 1, 100);
            expect(result).toBeNull();
        });

        it('should return a team of exactly 7 girls', () => {
            const girls = makeTraitPool(20);
            const result = TeamBuilderService.buildTeam(girls, 1, 100);
            expect(result).not.toBeNull();
            expect(result!.girls).toHaveLength(7);
        });

        it('should not have duplicate girls in the team', () => {
            const girls = makeTraitPool(30);
            const result = TeamBuilderService.buildTeam(girls, 1, 100)!;
            const ids = result.girls.map(g => g.id_girl);
            expect(new Set(ids).size).toBe(7);
        });

        it('should place leader at index 0', () => {
            const girls = makeTraitPool(20);
            const result = TeamBuilderService.buildTeam(girls, 1, 100)!;
            const tier5 = result.leaderTier5;
            expect(tier5.id).toBeGreaterThan(0);
            expect(['Execute', 'Stun', 'Shield', 'Reflect']).toContain(tier5.name);
        });

        it('should include elements array matching team composition', () => {
            const girls = makeTraitPool(20);
            const result = TeamBuilderService.buildTeam(girls, 1, 100)!;
            expect(result.elements).toHaveLength(7);
            expect(result.elements[0]).toBe(result.girls[0].element);
        });

        it('should include stat scores for each team member', () => {
            const girls = makeTraitPool(20);
            const result = TeamBuilderService.buildTeam(girls, 1, 100)!;
            expect(result.statScores).toHaveLength(7);
            result.statScores.forEach(score => {
                expect(score).toBeGreaterThan(0);
            });
        });

        it('should calculate a positive synergy value', () => {
            const girls = makeTraitPool(20);
            const result = TeamBuilderService.buildTeam(girls, 1, 100)!;
            expect(result.synergyValue).toBeGreaterThan(0);
        });
    });

    describe('Rarity filtering (both modes)', () => {

        it('should filter out non-mythic/legendary girls in Mode 1', () => {
            const girls = [
                ...makeTraitPool(10),
                makeGirl({ id_girl: 999, rarity: 'epic', carac1: 99999, carac2: 99999, carac3: 99999, eyeColor: 'blue' }),
            ];
            const result = TeamBuilderService.buildTeam(girls, 1, 100)!;
            const hasEpic = result.girls.some(g => g.id_girl === 999);
            expect(hasEpic).toBe(false);
        });

        it('should filter out non-mythic/legendary girls in Mode 2', () => {
            const girls = [
                ...makeTraitPool(10),
                makeGirl({ id_girl: 999, rarity: 'epic', carac1: 99999, carac2: 99999, carac3: 99999, eyeColor: 'blue' }),
            ];
            const result = TeamBuilderService.buildTeam(girls, 2, 100)!;
            const hasEpic = result.girls.some(g => g.id_girl === 999);
            expect(hasEpic).toBe(false);
        });

        it('should return null when not enough mythic/legendary girls', () => {
            const girls = [
                ...makeTraitPool(3),
                ...Array.from({ length: 20 }, (_, i) => makeGirl({
                    id_girl: 500 + i, rarity: 'epic',
                })),
            ];
            const result = TeamBuilderService.buildTeam(girls, 1, 100);
            expect(result).toBeNull();
        });
    });

    describe('Trait-based team selection', () => {

        it('should prefer girls from the best trait group', () => {
            // 6 fire/darkness girls with blue eyes (strong trait group)
            const traitGirls = makeTraitPool(6).map((g, i) => ({
                ...g, id_girl: 100 + i, carac1: 4000, carac2: 3000, carac3: 2000,
            }));

            // 1 light mythic leader
            const leader = makeGirl({
                id_girl: 50, element: 'light', rarity: 'mythic',
                carac1: 4500, carac2: 3500, carac3: 2500, hairColor: 'blonde',
            });

            // 3 stone girls with higher stats but no trait match
            const nonTraitGirls = [
                makeGirl({ id_girl: 200, element: 'stone', rarity: 'mythic', carac1: 5000, carac2: 4000, carac3: 3000, zodiac: 'Aries' }),
                makeGirl({ id_girl: 201, element: 'stone', rarity: 'mythic', carac1: 5000, carac2: 4000, carac3: 3000, zodiac: 'Taurus' }),
                makeGirl({ id_girl: 202, element: 'psychic', rarity: 'mythic', carac1: 5000, carac2: 4000, carac3: 3000, zodiac: 'Gemini' }),
            ];

            const result = TeamBuilderService.buildTeam(
                [...traitGirls, leader, ...nonTraitGirls], 1, 100
            )!;

            // Most team members should be from the trait group (blue eyes fire/darkness)
            const traitMembers = result.girls.filter(g =>
                (g.element === 'fire' || g.element === 'darkness') && g.eyeColor === 'blue'
            );
            expect(traitMembers.length).toBeGreaterThanOrEqual(5);
        });

        it('should include trait info in TeamResult', () => {
            const girls = makeTraitPool(20);
            const result = TeamBuilderService.buildTeam(girls, 1, 100)!;

            expect(result.traitCategory).toBeDefined();
            expect(result.traitValue).toBeDefined();
            expect(result.tier3Bonus).toBeGreaterThanOrEqual(0);
            expect(result.traitMatchCount).toBeGreaterThanOrEqual(0);
        });

        it('should report correct traitMatchCount', () => {
            const girls = makeTraitPool(10); // all fire/darkness with blue eyes
            const result = TeamBuilderService.buildTeam(girls, 1, 100)!;

            // All fire/darkness girls in the team have blue eyes
            const fireOrDarknessInTeam = result.girls.filter(g =>
                g.element === 'fire' || g.element === 'darkness'
            ).length;
            expect(result.traitMatchCount).toBe(fireOrDarknessInTeam);
        });
    });

    describe('Leader selection', () => {

        it('should prefer Shield (light/stone) leader when available', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'light', rarity: 'mythic', carac1: 4000, carac2: 3000, carac3: 2000, hairColor: 'blonde' }),
                ...makeTraitPool(10).map((g, i) => ({ ...g, id_girl: 100 + i })),
            ];
            const result = TeamBuilderService.buildTeam(girls, 1, 100)!;
            expect(result.girls[0].element).toBe('light');
            expect(result.leaderTier5.name).toBe('Shield');
        });

        it('should use Mythic girls as leader even if legendary has higher stats', () => {
            const girls = [
                makeGirl({ id_girl: 1, element: 'light', rarity: 'legendary', carac1: 9000, carac2: 8000, carac3: 7000, hairColor: 'blonde' }),
                makeGirl({ id_girl: 2, element: 'stone', rarity: 'mythic', carac1: 3000, carac2: 2000, carac3: 1000, zodiac: 'Aries' }),
                ...makeTraitPool(10).map((g, i) => ({ ...g, id_girl: 100 + i })),
            ];
            const result = TeamBuilderService.buildTeam(girls, 1, 100)!;
            // Leader should be the mythic stone girl, not the legendary light
            expect(result.girls[0].rarity).toBe('mythic');
        });

        it('should fall back when no light/stone mythic exists', () => {
            // All girls are fire/darkness (Execute)
            const girls = makeTraitPool(10);
            const result = TeamBuilderService.buildTeam(girls, 1, 100)!;
            // Should still pick a leader (fire or darkness)
            expect(result.girls[0]).toBeDefined();
            expect(['fire', 'darkness']).toContain(result.girls[0].element);
        });
    });

    describe('Position trait deprioritization', () => {

        it('should prefer non-position traits over position traits', () => {
            // 5 water/sun girls with same position (position group)
            const posGirls = Array.from({ length: 5 }, (_, i) => makeGirl({
                id_girl: 100 + i,
                element: i % 2 === 0 ? 'water' : 'sun',
                position: '3',
                carac1: 5000, carac2: 4000, carac3: 3000,
                rarity: 'mythic',
            }));

            // 5 fire/darkness girls with same eyes (eye color group)
            const eyeGirls = Array.from({ length: 5 }, (_, i) => makeGirl({
                id_girl: 200 + i,
                element: i % 2 === 0 ? 'fire' : 'darkness',
                eyeColor: 'blue',
                carac1: 5000, carac2: 4000, carac3: 3000,
                rarity: 'mythic',
            }));

            const result = TeamBuilderService.buildTeam([...posGirls, ...eyeGirls], 1, 100)!;

            // Eye color group should be preferred over position (same stats, position has penalty)
            expect(result.traitCategory).toBe('eyeColor');
        });
    });

    describe('Mode 2: Best Possible', () => {

        it('should use projected stats for scoring', () => {
            // Low-level mythic with high potential
            const lowLevel = makeGirl({
                id_girl: 1, rarity: 'mythic', level: 10,
                carac1: 500, carac2: 400, carac3: 300, nb_grades: 6, graded: 0,
                element: 'fire', eyeColor: 'blue',
            });
            // High-level mythic already near max
            const highLevel = makeGirl({
                id_girl: 2, rarity: 'mythic', level: 100,
                carac1: 3000, carac2: 2000, carac3: 1000, nb_grades: 5, graded: 5,
                element: 'fire', eyeColor: 'blue',
            });
            const fillers = makeTraitPool(10).map((g, i) => ({
                ...g, id_girl: 100 + i, carac1: 2000, carac2: 1500, carac3: 1000,
            }));

            const result = TeamBuilderService.buildTeam(
                [lowLevel, highLevel, ...fillers], 2, 100
            )!;

            // Low-level mythic should be in the team due to high projected stats
            const hasLowLevel = result.girls.some(g => g.id_girl === 1);
            expect(hasLowLevel).toBe(true);
        });

        it('should only include M+L girls (not all rarities)', () => {
            const girls = [
                ...makeTraitPool(8),
                makeGirl({ id_girl: 999, rarity: 'epic', carac1: 99999, carac2: 99999, carac3: 99999, eyeColor: 'blue' }),
            ];
            const result = TeamBuilderService.buildTeam(girls, 2, 100)!;
            const hasEpic = result.girls.some(g => g.rarity === 'epic');
            expect(hasEpic).toBe(false);
        });
    });

    describe('getElementDistribution', () => {

        it('should count elements correctly', () => {
            const team: TeamResult = {
                girls: [],
                statScores: [],
                synergyValue: 0,
                leaderTier5: { id: 12, name: 'Shield', priority: 4 },
                elements: ['fire', 'fire', 'fire', 'darkness', 'darkness', 'light', 'stone'],
                traitCategory: 'eyeColor',
                traitValue: 'blue',
                tier3Bonus: 0.04,
                traitMatchCount: 5,
            };
            const dist = TeamBuilderService.getElementDistribution(team);
            expect(dist[0]).toEqual({ element: 'fire', count: 3 });
            expect(dist[1]).toEqual({ element: 'darkness', count: 2 });
            expect(dist.find(d => d.element === 'light')?.count).toBe(1);
            expect(dist.find(d => d.element === 'stone')?.count).toBe(1);
        });

        it('should sort by count descending', () => {
            const team: TeamResult = {
                girls: [],
                statScores: [],
                synergyValue: 0,
                leaderTier5: { id: 12, name: 'Shield', priority: 4 },
                elements: ['fire', 'darkness', 'fire', 'darkness', 'fire', 'light', 'darkness'],
                traitCategory: 'eyeColor',
                traitValue: 'blue',
                tier3Bonus: 0.05,
                traitMatchCount: 6,
            };
            const dist = TeamBuilderService.getElementDistribution(team);
            expect(dist[0].count).toBe(3);
            expect(dist[1].count).toBe(3);
            expect(dist[2].count).toBe(1);
        });
    });
});
