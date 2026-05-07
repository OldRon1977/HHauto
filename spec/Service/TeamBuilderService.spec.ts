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

        it('should pick a Shield mythic globally even if cluster is eyeColor (cross-cluster leader)', () => {
            // Cluster will be eyeColor=blue (lots of dark/fire girls).
            // A single light mythic (Shield) exists. The new logic must
            // pick it as leader despite being outside the cluster pair.
            const eyeCluster = Array.from({ length: 8 }, (_, i) => makeGirl({
                id_girl: 100 + i,
                element: i % 2 === 0 ? 'fire' : 'darkness',
                rarity: 'mythic',
                class: 3,
                carac3: 5000,
                eyeColor: 'blue',
            }));
            const lightShieldMythic = makeGirl({
                id_girl: 999,
                element: 'light',
                rarity: 'mythic',
                class: 3,
                carac3: 1000,        // lower stats, must still win
                hairColor: 'blonde',
            });
            const result = TeamBuilderService.buildTeam([...eyeCluster, lightShieldMythic], 1, 100, 3)!;
            expect(result.traitCategory).toBe('eyeColor');
            expect(result.girls[0].id_girl).toBe(999);
            expect(result.leaderTier5.name).toBe('Shield');
            expect(result.leaderInCluster).toBe(false);
        });

        it('should fill positions 2-7 from the cluster even when leader is cross-cluster', () => {
            const eyeCluster = Array.from({ length: 8 }, (_, i) => makeGirl({
                id_girl: 100 + i,
                element: i % 2 === 0 ? 'fire' : 'darkness',
                rarity: 'mythic',
                class: 3,
                carac3: 5000,
                eyeColor: 'blue',
            }));
            const lightShieldMythic = makeGirl({
                id_girl: 999,
                element: 'light',
                rarity: 'mythic',
                class: 3,
                carac3: 1000,
                hairColor: 'blonde',
            });
            const result = TeamBuilderService.buildTeam([...eyeCluster, lightShieldMythic], 1, 100, 3)!;
            // Slots 2-7 must all be from the eyeColor cluster (fire or darkness)
            for (let i = 1; i < 7; i++) {
                expect(['fire', 'darkness']).toContain(result.girls[i].element);
            }
        });

        it('should mark leaderInCluster=true when leader is from the chosen cluster pair', () => {
            const hairCluster = Array.from({ length: 8 }, (_, i) => makeGirl({
                id_girl: 100 + i,
                element: i % 2 === 0 ? 'light' : 'nature',
                rarity: 'mythic',
                class: 3,
                carac3: 5000,
                hairColor: 'blonde',
            }));
            const result = TeamBuilderService.buildTeam(hairCluster, 1, 100, 3)!;
            expect(result.traitCategory).toBe('hairColor');
            expect(result.leaderInCluster).toBe(true);
        });

        it('should fall back to legendaries for leader when no mythics exist (beginner pool)', () => {
            // 8 legendary 5* girls, no mythics. Leader must come from this pool.
            const legendaries = Array.from({ length: 8 }, (_, i) => makeGirl({
                id_girl: 100 + i,
                element: i % 2 === 0 ? 'fire' : 'darkness',
                rarity: 'legendary',
                class: 3,
                nb_grades: 5,
                graded: 5,
                carac3: 4000,
                eyeColor: 'blue',
            }));
            const result = TeamBuilderService.buildTeam(legendaries, 1, 100, 3);
            expect(result).not.toBeNull();
            expect(result!.girls[0].rarity).toBe('legendary');
        });

        it('should prefer cluster legendary as leader when no mythics exist', () => {
            // Cluster will be eyeColor=blue. Two legendary candidates with
            // identical (zero) tier-5 priority: one in cluster (fire), one
            // out of cluster (light). The cluster member must win.
            const eyeCluster = Array.from({ length: 7 }, (_, i) => makeGirl({
                id_girl: 100 + i,
                element: 'fire',
                rarity: 'legendary',
                class: 3,
                nb_grades: 5,
                graded: 5,
                carac3: 4000,
                eyeColor: 'blue',
            }));
            const lightLegendary = makeGirl({
                id_girl: 999,
                element: 'light',
                rarity: 'legendary',
                class: 3,
                nb_grades: 5,
                graded: 5,
                carac3: 4000,
                hairColor: 'blonde',
            });
            const result = TeamBuilderService.buildTeam([...eyeCluster, lightLegendary], 1, 100, 3)!;
            // No mythics, no tier-5 differentiation -> cluster tiebreaker decides
            expect(result.girls[0].element).toBe('fire');
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


    describe('Leader picked AFTER positions 2-7 (issue #1573)', () => {

        it('should not consume a strong cluster girl as leader if a weaker mythic exists for the leader role', () => {
            // 7 strong cluster mythics (eyeColor=blue, fire/darkness) plus
            // one weak Light/Shield mythic (out of cluster). The Light
            // mythic must lead, so the 7 cluster mythics should ALL appear
            // in positions 2-7 (only 6 fit, but the strongest 6 must be
            // there -- the weak one stays excluded).
            const strongCluster = Array.from({ length: 7 }, (_, i) => makeGirl({
                id_girl: 100 + i,
                element: i % 2 === 0 ? 'fire' : 'darkness',
                rarity: 'mythic',
                class: 3,
                carac3: 5000 + i,
                eyeColor: 'blue',
            }));
            const weakLightLeader = makeGirl({
                id_girl: 999,
                element: 'light',
                rarity: 'mythic',
                class: 3,
                carac3: 1000,
                hairColor: 'blonde',
            });
            const result = TeamBuilderService.buildTeam([...strongCluster, weakLightLeader], 1, 100, 3)!;

            // Leader must be the Light/Shield mythic (priority 4)
            expect(result.girls[0].id_girl).toBe(999);
            expect(result.leaderTier5.name).toBe('Shield');

            // Positions 2-7 must contain the 6 highest-stat cluster mythics
            const slotIds = result.girls.slice(1).map(g => g.id_girl).sort();
            expect(slotIds).toEqual([101, 102, 103, 104, 105, 106]);
        });
    });

    describe('Mythic pass for cross-cluster girls (issue #1603)', () => {

        it('should include cross-cluster mythics in positions 2-7 before any cross-cluster legendary', () => {
            // 4 cluster mythics (eyeColor=blue) -- not enough to fill 6 slots.
            // 3 cross-cluster mythics (hairColor=blonde, light/nature).
            // 5 cross-cluster legendaries (zodiac, stone/psychic).
            // Slots 2-7 must contain 4 cluster mythics + 2 cross-cluster mythics.
            // Legendaries must NOT enter the team unless mythics run out.
            const clusterMythics = Array.from({ length: 4 }, (_, i) => makeGirl({
                id_girl: 100 + i,
                element: i % 2 === 0 ? 'fire' : 'darkness',
                rarity: 'mythic',
                class: 3,
                carac3: 5000,
                eyeColor: 'blue',
            }));
            const crossClusterMythics = Array.from({ length: 3 }, (_, i) => makeGirl({
                id_girl: 200 + i,
                element: i % 2 === 0 ? 'light' : 'nature',
                rarity: 'mythic',
                class: 3,
                carac3: 4000 - i,
                hairColor: 'blonde',
            }));
            const crossClusterLegendaries = Array.from({ length: 5 }, (_, i) => makeGirl({
                id_girl: 300 + i,
                element: 'stone',
                rarity: 'legendary',
                class: 3,
                nb_grades: 5,
                graded: 5,
                carac3: 3000,           // weaker than the cluster mythics
                zodiac: 'Aries',
            }));

            const result = TeamBuilderService.buildTeam(
                [...clusterMythics, ...crossClusterMythics, ...crossClusterLegendaries],
                1, 100, 3
            )!;

            // Every mythic of the player's class must be either leader or in slots 2-7
            const teamIds = new Set(result.girls.map(g => g.id_girl));
            const mythicIds = [...clusterMythics, ...crossClusterMythics].map(g => g.id_girl);
            for (const id of mythicIds) {
                expect(teamIds.has(id)).toBe(true);
            }

            // No legendary should be in the team (we have exactly 7 mythics)
            const hasAnyLegendary = result.girls.some(g => g.rarity === 'legendary');
            expect(hasAnyLegendary).toBe(false);
        });

        it('should fall back to legendaries only after all mythics are placed', () => {
            // 3 cluster mythics + 2 cross-cluster mythics = 5 mythics total.
            // Cross-cluster mythics are strong enough that the mythic-first
            // variant beats cluster-first on Effective Power.
            // Need 7 slots. The remaining 2 must come from legendaries.
            const clusterMythics = Array.from({ length: 3 }, (_, i) => makeGirl({
                id_girl: 100 + i,
                element: 'fire',
                rarity: 'mythic',
                class: 3,
                carac3: 5000,
                eyeColor: 'blue',
            }));
            const crossClusterMythics = Array.from({ length: 2 }, (_, i) => makeGirl({
                id_girl: 200 + i,
                element: 'light',
                rarity: 'mythic',
                class: 3,
                carac3: 8000,           // strong enough to beat cluster-first
                hairColor: 'blonde',
            }));
            const legendaries = Array.from({ length: 10 }, (_, i) => makeGirl({
                id_girl: 300 + i,
                element: 'fire',
                rarity: 'legendary',
                class: 3,
                nb_grades: 5,
                graded: 5,
                carac3: 2000,           // weak legendaries
                eyeColor: 'blue',
            }));

            const result = TeamBuilderService.buildTeam(
                [...clusterMythics, ...crossClusterMythics, ...legendaries],
                1, 100, 3
            )!;

            // All 5 mythics must appear in the team
            const mythicIds = [...clusterMythics, ...crossClusterMythics].map(g => g.id_girl);
            const teamIds = new Set(result.girls.map(g => g.id_girl));
            for (const id of mythicIds) {
                expect(teamIds.has(id)).toBe(true);
            }

            // Exactly 2 legendaries fill the remaining slots
            const legendaryCount = result.girls.filter(g => g.rarity === 'legendary').length;
            expect(legendaryCount).toBe(2);
        });

        it('should NOT add weak cross-cluster mythics when cluster-only beats them on Effective Power', () => {
            // 7 strong cluster mythics + 1 weak cross-cluster mythic.
            // The cluster team has full Tier-3 chain; including the weak
            // cross-cluster mythic would dilute it. Must keep cluster-only.
            const clusterMythics = Array.from({ length: 7 }, (_, i) => makeGirl({
                id_girl: 100 + i,
                element: i % 2 === 0 ? 'fire' : 'darkness',
                rarity: 'mythic',
                class: 3,
                carac3: 5000,
                eyeColor: 'blue',
            }));
            const weakCross = makeGirl({
                id_girl: 999,
                element: 'light',
                rarity: 'mythic',
                class: 3,
                carac3: 100,           // very weak
                hairColor: 'blonde',
            });
            const result = TeamBuilderService.buildTeam([...clusterMythics, weakCross], 1, 100, 3)!;

            // Team must NOT include the weak cross-cluster mythic in slots 2-7
            const weakInTeam = result.girls.slice(1).some(g => g.id_girl === 999);
            // Weak mythic might be leader (only Shield-priority mythic),
            // which is the existing leader-priority behavior.
            // The point of this test: it must NOT take a slot 2-7.
            if (!weakInTeam && result.girls[0].id_girl === 999) {
                // Acceptable: weak mythic became leader (Shield > others), 6 cluster mythics in slots
                expect(result.girls.slice(1).every(g => g.element === 'fire' || g.element === 'darkness')).toBe(true);
            } else if (!weakInTeam) {
                // Acceptable: leader is a cluster mythic, weak excluded entirely
                expect(weakInTeam).toBe(false);
            } else {
                // Not acceptable: weak mythic stole a cluster slot
                throw new Error('Weak cross-cluster mythic stole a cluster slot');
            }
        });
    });

    describe('Mythic audit (issue #1573, #1603)', () => {

        it('should report status for every player-class mythic', () => {
            const girls = makeTraitPool(20);
            const result = TeamBuilderService.buildTeam(girls, 1, 100, 3)!;

            // makeTraitPool generates mythics. Audit must contain all of them.
            const mythicCount = girls.filter(g => g.rarity === 'mythic').length;
            expect(result.mythicAudit.length).toBe(mythicCount);

            // The 7 girls in the team must be marked leader/pos2to7
            const inTeamCount = result.mythicAudit.filter(e => e.status !== 'excluded').length;
            expect(inTeamCount).toBe(7);

            // The first audit entry must be the leader
            expect(result.mythicAudit[0].status).toBe('leader');
            expect(result.mythicAudit[0].position).toBe(1);
        });

        it('should give a reason for excluded mythics', () => {
            // Mix of cluster + cross-cluster mythics. With 8 cluster mythics,
            // one is excluded; the audit must explain why.
            const clusterMythics = Array.from({ length: 8 }, (_, i) => makeGirl({
                id_girl: 100 + i,
                element: 'fire',
                rarity: 'mythic',
                class: 3,
                carac3: 5000 - i,    // lower stats for higher i -> last is excluded
                eyeColor: 'blue',
            }));
            const result = TeamBuilderService.buildTeam(clusterMythics, 1, 100, 3)!;
            const excluded = result.mythicAudit.filter(e => e.status === 'excluded');
            expect(excluded).toHaveLength(1);
            expect(excluded[0].reason).toBeDefined();
            expect(excluded[0].reason!.length).toBeGreaterThan(0);
        });

        it('should flag wrong-class mythics in the audit', () => {
            // Player class 3 (KH). Add a class-1 mythic -- it must show up as
            // excluded with the wrong-class reason.
            const girls = [
                ...makeTraitPool(20),
                makeGirl({ id_girl: 999, rarity: 'mythic', class: 1, carac1: 99999, eyeColor: 'blue' }),
            ];
            const result = TeamBuilderService.buildTeam(girls, 1, 100, 3)!;
            const wrongClass = result.mythicAudit.find(e => e.id_girl === 999);
            expect(wrongClass).toBeDefined();
            expect(wrongClass!.status).toBe('excluded');
            expect(wrongClass!.reason).toMatch(/wrong class/i);
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
            leaderInCluster: true,
            mythicAudit: [],
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