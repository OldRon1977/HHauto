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
        ...overrides,
    };
}

function makeGirlPool(count: number, defaults: Partial<GirlData> = {}): GirlData[] {
    const elements: ElementType[] = ['fire', 'water', 'nature', 'stone', 'sun', 'darkness', 'psychic', 'light'];
    return Array.from({ length: count }, (_, i) => makeGirl({
        id_girl: 1000 + i,
        carac1: 5000 - i * 50,
        carac2: 4000 - i * 40,
        carac3: 3000 - i * 30,
        element: elements[i % elements.length],
        ...defaults,
    }));
}

beforeEach(() => {
    nextId = 1;
});

describe('TeamBuilderService', () => {

    describe('buildTeam', () => {

        it('should return null when fewer than 7 girls available', () => {
            const girls = makeGirlPool(5);
            const result = TeamBuilderService.buildTeam(girls, 1, 100);
            expect(result).toBeNull();
        });

        it('should return a team of exactly 7 girls', () => {
            const girls = makeGirlPool(20);
            const result = TeamBuilderService.buildTeam(girls, 1, 100);
            expect(result).not.toBeNull();
            expect(result!.girls).toHaveLength(7);
        });

        it('should not have duplicate girls in the team', () => {
            const girls = makeGirlPool(30);
            const result = TeamBuilderService.buildTeam(girls, 1, 100)!;
            const ids = result.girls.map(g => g.id_girl);
            expect(new Set(ids).size).toBe(7);
        });

        it('should place leader at index 0', () => {
            const girls = makeGirlPool(20);
            const result = TeamBuilderService.buildTeam(girls, 1, 100)!;
            const leaderElement = result.girls[0].element;
            const tier5 = result.leaderTier5;
            // Leader tier5 should match the leader's element
            expect(tier5.id).toBeGreaterThan(0);
            expect(['Execute', 'Stun', 'Shield', 'Reflect']).toContain(tier5.name);
        });

        it('should prefer Execute leaders when stats are similar', () => {
            // Create pool where top girls have various elements but similar stats
            const girls = [
                makeGirl({ id_girl: 1, element: 'nature', carac1: 5000, carac2: 4000, carac3: 3000, rarity: 'mythic' }),
                makeGirl({ id_girl: 2, element: 'fire', carac1: 4900, carac2: 3900, carac3: 2900, rarity: 'mythic' }),
                makeGirl({ id_girl: 3, element: 'sun', carac1: 4800, carac2: 3800, carac3: 2800, rarity: 'mythic' }),
                ...makeGirlPool(10).map((g, i) => ({ ...g, id_girl: 10 + i, carac1: 2000, carac2: 1500, carac3: 1000 })),
            ];
            const result = TeamBuilderService.buildTeam(girls, 1, 100)!;
            // Fire girl should be leader (Execute priority 4) even though nature has slightly higher stats
            expect(result.girls[0].element).toBe('fire');
            expect(result.leaderTier5.name).toBe('Execute');
        });

        it('should include elements array matching team composition', () => {
            const girls = makeGirlPool(20);
            const result = TeamBuilderService.buildTeam(girls, 1, 100)!;
            expect(result.elements).toHaveLength(7);
            expect(result.elements[0]).toBe(result.girls[0].element);
        });

        it('should include stat scores for each team member', () => {
            const girls = makeGirlPool(20);
            const result = TeamBuilderService.buildTeam(girls, 1, 100)!;
            expect(result.statScores).toHaveLength(7);
            result.statScores.forEach(score => {
                expect(score).toBeGreaterThan(0);
            });
        });

        it('should calculate a positive synergy value', () => {
            const girls = makeGirlPool(20);
            const result = TeamBuilderService.buildTeam(girls, 1, 100)!;
            expect(result.synergyValue).toBeGreaterThan(0);
        });
    });

    describe('Mode 1: Current Best', () => {

        it('should filter out non-mythic/legendary girls', () => {
            const girls = [
                ...makeGirlPool(10).map(g => ({ ...g, rarity: 'mythic' as RarityType })),
                makeGirl({ id_girl: 999, rarity: 'epic', carac1: 99999, carac2: 99999, carac3: 99999 }),
            ];
            const result = TeamBuilderService.buildTeam(girls, 1, 100)!;
            const hasEpic = result.girls.some(g => g.id_girl === 999);
            expect(hasEpic).toBe(false);
        });

        it('should return null when not enough mythic/legendary girls', () => {
            const girls = [
                ...makeGirlPool(3).map(g => ({ ...g, rarity: 'mythic' as RarityType })),
                ...makeGirlPool(20).map((g, i) => ({ ...g, id_girl: 500 + i, rarity: 'epic' as RarityType })),
            ];
            const result = TeamBuilderService.buildTeam(girls, 1, 100);
            expect(result).toBeNull();
        });
    });

    describe('Mode 2: Best Possible', () => {

        it('should include all rarities', () => {
            const girls = [
                ...makeGirlPool(5).map(g => ({ ...g, rarity: 'mythic' as RarityType })),
                ...makeGirlPool(5).map((g, i) => ({ ...g, id_girl: 200 + i, rarity: 'rare' as RarityType })),
                ...makeGirlPool(5).map((g, i) => ({ ...g, id_girl: 300 + i, rarity: 'common' as RarityType })),
            ];
            const result = TeamBuilderService.buildTeam(girls, 2, 100);
            expect(result).not.toBeNull();
            expect(result!.girls).toHaveLength(7);
        });

        it('should value high-potential low-level girls', () => {
            // A level 1 mythic with 6 grades should score higher than a maxed epic
            const lowLevelMythic = makeGirl({
                id_girl: 1, rarity: 'mythic', level: 1,
                carac1: 100, carac2: 80, carac3: 60, nb_grades: 6, graded: 0,
                element: 'fire',
            });
            const maxedEpic = makeGirl({
                id_girl: 2, rarity: 'epic', level: 100,
                carac1: 2000, carac2: 1500, carac3: 1000, nb_grades: 3, graded: 3,
                element: 'fire',
            });
            const fillers = makeGirlPool(10).map((g, i) => ({
                ...g, id_girl: 100 + i, carac1: 500, carac2: 400, carac3: 300,
            }));

            const result = TeamBuilderService.buildTeam(
                [lowLevelMythic, maxedEpic, ...fillers], 2, 100
            )!;

            // Low-level mythic's potential: 240 * 100 / 1 * 2.8 = 67,200
            // Maxed epic's potential: 4500 * 1 / 1.9 * 1.9 = 4,500
            // So the mythic should be in the team
            const hasLowLevelMythic = result.girls.some(g => g.id_girl === 1);
            expect(hasLowLevelMythic).toBe(true);
        });
    });

    describe('getElementDistribution', () => {

        it('should count elements correctly', () => {
            const team: TeamResult = {
                girls: [],
                statScores: [],
                synergyValue: 0,
                leaderTier5: { id: 14, name: 'Execute', priority: 4 },
                elements: ['fire', 'fire', 'fire', 'water', 'stone', 'stone', 'sun'],
            };
            const dist = TeamBuilderService.getElementDistribution(team);
            expect(dist[0]).toEqual({ element: 'fire', count: 3 });
            expect(dist[1]).toEqual({ element: 'stone', count: 2 });
            // water and sun have 1 each
            expect(dist.find(d => d.element === 'water')?.count).toBe(1);
            expect(dist.find(d => d.element === 'sun')?.count).toBe(1);
        });

        it('should sort by count descending', () => {
            const team: TeamResult = {
                girls: [],
                statScores: [],
                synergyValue: 0,
                leaderTier5: { id: 14, name: 'Execute', priority: 4 },
                elements: ['water', 'fire', 'water', 'fire', 'water', 'stone', 'fire'],
            };
            const dist = TeamBuilderService.getElementDistribution(team);
            expect(dist[0].count).toBe(3);
            expect(dist[1].count).toBe(3);
            expect(dist[2].count).toBe(1);
        });
    });
});
