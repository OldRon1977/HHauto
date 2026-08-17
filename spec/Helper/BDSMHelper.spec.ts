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
