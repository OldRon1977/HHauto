import {
    BDSMHelper,
    calculateDominationBonuses,
    calculateCritChanceShare,
    getSkillPercentage,
    calculateBattleProbabilities,
} from '../../src/Helper/BDSMHelper';
import { BDSMPlayer } from '../../src/model/BDSMPlayer';
import { loadFixture } from '../testHelpers/Fixtures';

jest.mock('../../src/Utils/LogUtils', () => ({
    logHHAuto: jest.fn(),
}));

jest.mock('../../src/config/HHStoredVars', () => ({
    HHStoredVarPrefixKey: 'HHAuto_',
    HHStoredVars: {},
}));

jest.mock('../../src/config/StorageKeys', () => ({
    SK: {},
    TK: {},
}));

jest.mock('../../src/Helper/StorageHelper', () => ({
    getStoredJSON: jest.fn(),
    setStoredValue: jest.fn(),
}));

jest.mock('../../src/Helper/ConfigHelper', () => ({
    ConfigHelper: {
        getHHScriptVars: jest.fn(),
    },
}));

describe('BDSMHelper', () => {

    describe('fightBonues', () => {
        // Real teams payload from /teams.html. The game's own
        // bonus_identifier per element confirms the mapping this reads:
        // fire = "critical hit damage", stone = "critical hit chance",
        // sun = "decrease defense of opponent", water = "Recover on hit".
        const themedTeam = (loadFixture('teams', 'teams-data') as any).themed;

        it('picks the four multipliers out of a real synergies list', () => {
            const byElement = Object.fromEntries(
                themedTeam.synergies.map((s: any) => [s.element.type, s.bonus_multiplier]));

            const result = BDSMHelper.fightBonues(themedTeam);

            expect(result.critDamage).toBe(byElement.fire);
            expect(result.critChance).toBe(byElement.stone);
            expect(result.defReduce).toBe(byElement.sun);
            expect(result.healOnHit).toBe(byElement.water);
        });

        it('carries the synergy for every element the game sends', () => {
            // Eight elements: a missing one would silently read as undefined
            // and poison the whole simulation.
            expect(themedTeam.synergies).toHaveLength(8);
            for (const s of themedTeam.synergies) {
                expect(typeof s.element.type).toBe('string');
                expect(typeof s.bonus_multiplier).toBe('number');
                expect(typeof s.bonus_identifier).toBe('string');
            }
        });

        it('should handle zero multipliers', () => {
            const team = {
                synergies: themedTeam.synergies.map((s: any) => ({ ...s, bonus_multiplier: 0 })),
            };
            const result = BDSMHelper.fightBonues(team);
            expect(result.critDamage).toBe(0);
            expect(result.critChance).toBe(0);
            expect(result.defReduce).toBe(0);
            expect(result.healOnHit).toBe(0);
        });
    });

    describe('calculateDominationBonuses', () => {
        it('should return zero bonuses when there is no overlap', () => {
            const player = ['fire', 'stone'];
            const opponent = ['darkness', 'light'];
            const result = calculateDominationBonuses(player, opponent);

            expect(result.player.ego).toBe(0);
            expect(result.player.attack).toBe(0);
            expect(result.player.chance).toBe(0);
            expect(result.opponent.ego).toBe(0);
            expect(result.opponent.attack).toBe(0);
            expect(result.opponent.chance).toBe(0);
        });

        it('should grant ego and attack bonus for a single egoDamage match', () => {
            // fire beats nature
            const player = ['fire'];
            const opponent = ['nature'];
            const result = calculateDominationBonuses(player, opponent);

            expect(result.player.ego).toBeCloseTo(0.1);
            expect(result.player.attack).toBeCloseTo(0.1);
            expect(result.player.chance).toBe(0);
            // nature beats stone, but opponent has no stone to beat
            expect(result.opponent.ego).toBe(0);
        });

        it('should grant chance bonus for a single chance match', () => {
            // darkness beats light
            const player = ['darkness'];
            const opponent = ['light'];
            const result = calculateDominationBonuses(player, opponent);

            expect(result.player.chance).toBeCloseTo(0.2);
            expect(result.player.ego).toBe(0);
            expect(result.player.attack).toBe(0);
        });

        it('should accumulate bonuses for multiple matches', () => {
            // fire beats nature, stone beats sun
            const player = ['fire', 'stone'];
            const opponent = ['nature', 'sun'];
            const result = calculateDominationBonuses(player, opponent);

            expect(result.player.ego).toBeCloseTo(0.2);
            expect(result.player.attack).toBeCloseTo(0.2);
        });

        it('should calculate bonuses for both sides symmetrically', () => {
            // fire beats nature (player advantage), nature beats stone (opponent advantage)
            const player = ['fire', 'sun'];
            const opponent = ['nature', 'water'];
            const result = calculateDominationBonuses(player, opponent);

            // player: fire > nature -> +0.1 ego/atk, sun > water -> +0.1 ego/atk
            expect(result.player.ego).toBeCloseTo(0.2);
            expect(result.player.attack).toBeCloseTo(0.2);
            // opponent: nature > stone? no stone in player. water > fire -> +0.1 ego/atk
            expect(result.opponent.ego).toBeCloseTo(0.1);
            expect(result.opponent.attack).toBeCloseTo(0.1);
        });

        it('should handle symmetrical teams with mutual advantages', () => {
            const player = ['fire', 'nature'];
            const opponent = ['fire', 'nature'];
            const result = calculateDominationBonuses(player, opponent);

            // Both sides: fire > nature -> +0.1 each
            expect(result.player.ego).toBeCloseTo(0.1);
            expect(result.player.attack).toBeCloseTo(0.1);
            expect(result.opponent.ego).toBeCloseTo(0.1);
            expect(result.opponent.attack).toBeCloseTo(0.1);
        });

        it('should handle empty arrays', () => {
            const result = calculateDominationBonuses([], []);
            expect(result.player.ego).toBe(0);
            expect(result.player.attack).toBe(0);
            expect(result.player.chance).toBe(0);
            expect(result.opponent.ego).toBe(0);
            expect(result.opponent.attack).toBe(0);
            expect(result.opponent.chance).toBe(0);
        });

        it('should handle one empty array', () => {
            const result = calculateDominationBonuses(['fire', 'darkness'], []);
            expect(result.player.ego).toBe(0);
            expect(result.player.chance).toBe(0);
        });

        it('should combine ego and chance bonuses from mixed elements', () => {
            // fire > nature (ego), darkness > light (chance)
            const player = ['fire', 'darkness'];
            const opponent = ['nature', 'light'];
            const result = calculateDominationBonuses(player, opponent);

            expect(result.player.ego).toBeCloseTo(0.1);
            expect(result.player.attack).toBeCloseTo(0.1);
            expect(result.player.chance).toBeCloseTo(0.2);
        });
    });

    describe('calculateCritChanceShare', () => {
        it('should return 0.15 for equal harmony values', () => {
            expect(calculateCritChanceShare(100, 100)).toBeCloseTo(0.15);
        });

        it('should return close to 0.3 when own harmony dominates', () => {
            const result = calculateCritChanceShare(10000, 1);
            expect(result).toBeCloseTo(0.3, 1);
            expect(result).toBeLessThan(0.3);
        });

        it('should return close to 0 when opponent harmony dominates', () => {
            const result = calculateCritChanceShare(1, 10000);
            expect(result).toBeCloseTo(0, 1);
            expect(result).toBeGreaterThan(0);
        });

        it('should scale proportionally', () => {
            // 3:1 ratio -> 0.3 * 3/4 = 0.225
            expect(calculateCritChanceShare(300, 100)).toBeCloseTo(0.225);
        });
    });

    describe('getSkillPercentage', () => {
        // Three real girls off the fielded team, reduced to their skills map.
        // The game keys skills by skill id and puts the number this reads
        // under skills[<id>].skill.percentage_value -- flat skills carry
        // null there, which is what the nullish coalescing is for.
        const girls = loadFixture('teams', 'team-girls') as Array<{
            skills: Record<string, { skill: { percentage_value: number | null } }>;
        }>;
        const team = { girls };

        /** The percent the game reports for this skill, summed over the team. */
        const realSum = (id: number) => girls.reduce(
            (acc, g) => acc + (g.skills[String(id)]?.skill?.percentage_value ?? 0), 0);

        it('sums the reported percent across the real team', () => {
            // Pick a skill id that at least one girl actually carries a
            // percent for, so this is not a test of the empty case.
            const id = Number(Object.keys(girls[0].skills)
                .find((k) => typeof girls[0].skills[k]?.skill?.percentage_value === 'number'));
            expect(Number.isFinite(id)).toBe(true);
            expect(getSkillPercentage(team, id)).toBeCloseTo(1 + realSum(id) / 100);
        });

        it('treats a flat skill (percentage_value null) as zero', () => {
            const id = Number(Object.keys(girls[0].skills)
                .find((k) => girls[0].skills[k]?.skill?.percentage_value === null));
            expect(Number.isFinite(id)).toBe(true);
            expect(getSkillPercentage(team, id)).toBeCloseTo(1 + realSum(id) / 100);
        });

        it('treats a girl without the skill as zero', () => {
            const id = Number(Object.keys(girls[0].skills)[0]);
            const mixed = { girls: [girls[0], { skills: {} }] };
            const expected = 1 + (girls[0].skills[String(id)]?.skill?.percentage_value ?? 0) / 100;
            expect(getSkillPercentage(mixed, id)).toBeCloseTo(expected);
        });

        it('returns 1 when no girl has the skill', () => {
            expect(getSkillPercentage(team, 9999)).toBeCloseTo(1.0);
        });
    });

    describe('calculateBattleProbabilities', () => {
        const noBonuses = { critDamage: 0, critChance: 0, defReduce: 0, healOnHit: 0 };
        const noTier4 = { dmg: 0, def: 0 };
        const noTier5 = { id: 0, value: 0 };

        it('should predict a strong player wins against a weak opponent', () => {
            const player = new BDSMPlayer(10000, 5000, 100, 0.15, noBonuses, noTier4, noTier5, 'StrongPlayer');
            const opponent = new BDSMPlayer(1000, 200, 100, 0.05, noBonuses, noTier4, noTier5, 'WeakOpponent');

            const result = calculateBattleProbabilities(player, opponent, false);

            expect(result.win).toBeGreaterThan(0.9);
            expect(result.loss).toBeLessThan(0.1);
            expect(result.scoreClass).toBe('plus');
        });

        it('should predict a weak player loses against a strong opponent', () => {
            const player = new BDSMPlayer(1000, 200, 100, 0.05, noBonuses, noTier4, noTier5, 'WeakPlayer');
            const opponent = new BDSMPlayer(10000, 5000, 100, 0.15, noBonuses, noTier4, noTier5, 'StrongOpponent');

            const result = calculateBattleProbabilities(player, opponent, false);

            expect(result.win).toBeLessThan(0.1);
            expect(result.loss).toBeGreaterThan(0.9);
            expect(result.scoreClass).toBe('minus');
        });

        it('should predict roughly 50/50 for equal players', () => {
            const player = new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, noTier5, 'PlayerA');
            const opponent = new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, noTier5, 'PlayerB');

            const result = calculateBattleProbabilities(player, opponent, false);

            expect(result.win).toBeGreaterThan(0.3);
            expect(result.win).toBeLessThan(0.7);
        });

        it('should set scoreClass to plus when win > 0.9', () => {
            const player = new BDSMPlayer(50000, 10000, 50, 0.2, noBonuses, noTier4, noTier5, 'Big');
            const opponent = new BDSMPlayer(500, 100, 50, 0.05, noBonuses, noTier4, noTier5, 'Small');

            const result = calculateBattleProbabilities(player, opponent, false);
            expect(result.scoreClass).toBe('plus');
        });

        it('should set scoreClass to minus when win < 0.5', () => {
            const player = new BDSMPlayer(500, 100, 50, 0.05, noBonuses, noTier4, noTier5, 'Small');
            const opponent = new BDSMPlayer(50000, 10000, 50, 0.2, noBonuses, noTier4, noTier5, 'Big');

            const result = calculateBattleProbabilities(player, opponent, false);
            expect(result.scoreClass).toBe('minus');
        });

        // These numbers come from the recursion before it gained a work budget
        // and an even-split exit. None of these fights comes near the budget,
        // so each result has to be bit-identical -- a mismatch means the exit
        // fired where the simulation could still have answered.
        describe('leaves a fight it can finish untouched', () => {
            const reference = loadFixture('bdsm', 'simulator-reference') as Record<string, {
                win: number; loss: number; scoreClass: string; points: Record<string, number>;
            }>;
            const bonuses = (over: Partial<typeof noBonuses> = {}) => ({ ...noBonuses, ...over });
            const cases: Record<string, [BDSMPlayer, BDSMPlayer]> = {
                evenMatch: [
                    new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, noTier5, 'A'),
                    new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, noTier5, 'B')],
                longFight: [
                    new BDSMPlayer(12000, 1000, 0, 0.25, noBonuses, noTier4, noTier5, 'A'),
                    new BDSMPlayer(12000, 1000, 0, 0.25, noBonuses, noTier4, noTier5, 'B')],
                healOnHit: [
                    new BDSMPlayer(8000, 1000, 0, 0.25, bonuses({ healOnHit: 0.10 }), noTier4, noTier5, 'A'),
                    new BDSMPlayer(8000, 1000, 0, 0.25, noBonuses, noTier4, noTier5, 'B')],
                tier5Stun: [
                    new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, { id: 11, value: 0.5 }, 'A'),
                    new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, noTier5, 'B')],
                tier5Shield: [
                    new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, { id: 12, value: 0.3 }, 'A'),
                    new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, noTier5, 'B')],
                tier5Reflect: [
                    new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, { id: 13, value: 0.4 }, 'A'),
                    new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, noTier5, 'B')],
                tier5Execute: [
                    new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, { id: 14, value: 0.2 }, 'A'),
                    new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, noTier5, 'B')],
                opponentStun: [
                    new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, noTier5, 'A'),
                    new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, { id: 11, value: 0.5 }, 'B')],
                tier4Damage: [
                    new BDSMPlayer(8000, 1000, 0, 0.25, noBonuses, { dmg: 0.04, def: 0 }, noTier5, 'A'),
                    new BDSMPlayer(8000, 1000, 0, 0.25, noBonuses, { dmg: 0.04, def: 0 }, noTier5, 'B')],
                critDamage: [
                    new BDSMPlayer(5000, 1000, 200, 0.30, bonuses({ critDamage: 0.5 }), noTier4, noTier5, 'A'),
                    new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, noTier5, 'B')],
            };

            it.each(Object.keys(cases))('%s', (name) => {
                const [player, opponent] = cases[name];
                const result = calculateBattleProbabilities(player, opponent, false);
                const want = reference[name];

                expect(result.win).toBeCloseTo(want.win, 12);
                expect(result.loss).toBeCloseTo(want.loss, 12);
                expect(result.scoreClass).toBe(want.scoreClass);
                const got = result.points as unknown as Record<string, number>;
                expect(Object.keys(got).sort()).toEqual(Object.keys(want.points).sort());
                for (const point of Object.keys(want.points)) {
                    expect(got[point]).toBeCloseTo(want.points[point], 12);
                }
            });
        });

        // This one is the memo's guard, not the budget's: an 18-exchange fight
        // visits 1,786 nodes with the memo and 7.4 million without, so the
        // budget never sees it and the bound is what the memo buys. Measured
        // at 19.0 s on the plain recursion against 9 ms here, for the very same
        // number asserted below. The bound has to
        // be asserted by hand -- calculateBattleProbabilities is synchronous,
        // so Jest's own timeout never interrupts it and a slow run passes.
        it('answers a long fight in a bound the plain recursion misses', () => {
            const player = new BDSMPlayer(18000, 1000, 0, 0.25, noBonuses, noTier4, noTier5, 'A');
            const opponent = new BDSMPlayer(18000, 1000, 0, 0.25, noBonuses, noTier4, noTier5, 'B');

            const startedAt = Date.now();
            const result = calculateBattleProbabilities(player, opponent, false);
            const elapsed = Date.now() - startedAt;

            expect(elapsed).toBeLessThan(2000);
            expect(result.win).toBeCloseTo(0.6069564547400814, 12);
        });

        describe('a fight it cannot finish', () => {
            // Neither side gets through the other's defence, so no branch ever
            // ends. Before the even-split exit this threw, calculateBattleProbabilities
            // handed back an empty {}, and the caller indexed into it.
            const stalemate = (): [BDSMPlayer, BDSMPlayer] => [
                new BDSMPlayer(50000, 8000, 9000, 0.15, noBonuses, noTier4, noTier5, 'A'),
                new BDSMPlayer(50000, 3000, 9000, 0.15, noBonuses, noTier4, noTier5, 'B')];

            it('is reported as undecided at 50%', () => {
                const [player, opponent] = stalemate();

                const result = calculateBattleProbabilities(player, opponent, false);

                expect(result.win).toBeCloseTo(0.5, 12);
                expect(result.loss).toBeCloseTo(0.5, 12);
            });

            it('still carries a point distribution the caller can read', () => {
                const [player, opponent] = stalemate();

                const result = calculateBattleProbabilities(player, opponent, false);

                expect(result.points).toBeDefined();
                const got = result.points as unknown as Record<string, number>;
                expect(Object.keys(got).length).toBeGreaterThan(0);
                const mass = Object.values(got).reduce((sum, p) => sum + p, 0);
                expect(mass).toBeCloseTo(1, 12);
            });

            // The depth cap alone does not bound the work: four branches per
            // round means depth 50 is 4^50 nodes. Measured on this pairing
            // without the budget, the call had not returned after 60 s.
            it('returns inside a bound the depth cap alone does not give', () => {
                const player = new BDSMPlayer(50000, 8000, 9000, 0.15, noBonuses, { dmg: 0.03, def: 0 }, noTier5, 'A');
                const opponent = new BDSMPlayer(50000, 3000, 9000, 0.15, noBonuses, { dmg: 0.03, def: 0 }, noTier5, 'B');

                const startedAt = Date.now();
                const result = calculateBattleProbabilities(player, opponent, false);
                const elapsed = Date.now() - startedAt;

                expect(elapsed).toBeLessThan(5000);
                expect(result.points).toBeDefined();
                expect(result.win + result.loss).toBeCloseTo(1, 12);
            });
        });

        it('should account for tier5 stun skill', () => {
            const stunTier5 = { id: 11, value: 0.5 };
            const player = new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, stunTier5, 'Stunner');
            const opponent = new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, noTier5, 'Target');

            const withStun = calculateBattleProbabilities(player, opponent, false);

            const playerNoStun = new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, noTier5, 'NoStun');
            const withoutStun = calculateBattleProbabilities(playerNoStun, opponent, false);

            // Stun gives an advantage: the stunner should win more often
            expect(withStun.win).toBeGreaterThan(withoutStun.win);
        });
    });
});
