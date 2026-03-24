import {
    BDSMHelper,
    calculateDominationBonuses,
    calculateCritChanceShare,
    getSkillPercentage,
    calculateBattleProbabilities,
} from '../../src/Helper/BDSMHelper';
import { BDSMPlayer } from '../../src/model/BDSMPlayer';

jest.mock('../../src/Utils/LogUtils', () => ({
    logHHAuto: jest.fn(),
}));

jest.mock('../../src/config/index', () => ({
    HHStoredVarPrefixKey: 'HHAuto_',
    HHStoredVars: {},
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

    describe('ELEMENTS', () => {
        it('should have egoDamage lookup with 5 element matchups', () => {
            const ego = BDSMHelper.ELEMENTS.egoDamage;
            expect(ego.fire).toBe('nature');
            expect(ego.nature).toBe('stone');
            expect(ego.stone).toBe('sun');
            expect(ego.sun).toBe('water');
            expect(ego.water).toBe('fire');
            expect(Object.keys(ego)).toHaveLength(5);
        });

        it('should have chance lookup with 3 element matchups', () => {
            const chance = BDSMHelper.ELEMENTS.chance;
            expect(chance.darkness).toBe('light');
            expect(chance.light).toBe('psychic');
            expect(chance.psychic).toBe('darkness');
            expect(Object.keys(chance)).toHaveLength(3);
        });
    });

    describe('fightBonues', () => {
        it('should extract synergy multipliers from team object', () => {
            const team = {
                synergies: [
                    { element: { type: 'fire' }, bonus_multiplier: 0.35 },
                    { element: { type: 'stone' }, bonus_multiplier: 0.07 },
                    { element: { type: 'sun' }, bonus_multiplier: 0.08 },
                    { element: { type: 'water' }, bonus_multiplier: 0.12 },
                ],
            };
            const result = BDSMHelper.fightBonues(team);
            expect(result.critDamage).toBe(0.35);
            expect(result.critChance).toBe(0.07);
            expect(result.defReduce).toBe(0.08);
            expect(result.healOnHit).toBe(0.12);
        });

        it('should handle zero multipliers', () => {
            const team = {
                synergies: [
                    { element: { type: 'fire' }, bonus_multiplier: 0 },
                    { element: { type: 'stone' }, bonus_multiplier: 0 },
                    { element: { type: 'sun' }, bonus_multiplier: 0 },
                    { element: { type: 'water' }, bonus_multiplier: 0 },
                ],
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
        it('should return 1 + sum/100 for a single girl with a matching skill', () => {
            const team = {
                girls: [
                    { skills: { 5: { skill: { percentage_value: 20 } } } },
                ],
            };
            expect(getSkillPercentage(team, 5)).toBeCloseTo(1.2);
        });

        it('should sum across multiple girls', () => {
            const team = {
                girls: [
                    { skills: { 3: { skill: { percentage_value: 10 } } } },
                    { skills: { 3: { skill: { percentage_value: 15 } } } },
                    { skills: { 3: { skill: { percentage_value: 25 } } } },
                ],
            };
            // 1 + (10+15+25)/100 = 1.5
            expect(getSkillPercentage(team, 3)).toBeCloseTo(1.5);
        });

        it('should treat missing skill as 0 via nullish coalescing', () => {
            const team = {
                girls: [
                    { skills: { 3: { skill: { percentage_value: 10 } } } },
                    { skills: {} }, // no skill id 3
                ],
            };
            // 1 + (10+0)/100 = 1.1
            expect(getSkillPercentage(team, 3)).toBeCloseTo(1.1);
        });

        it('should return 1 when no girls have the skill', () => {
            const team = {
                girls: [
                    { skills: {} },
                    { skills: {} },
                ],
            };
            expect(getSkillPercentage(team, 7)).toBeCloseTo(1.0);
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

        it('should return a points distribution object', () => {
            const player = new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, noTier5, 'A');
            const opponent = new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, noTier5, 'B');

            const result = calculateBattleProbabilities(player, opponent, false);
            expect(result.points).toBeDefined();
            expect(typeof result.points).toBe('object');
        });

        it('should handle debug mode without errors', () => {
            const player = new BDSMPlayer(5000, 1000, 200, 0.15, noBonuses, noTier4, noTier5, 'DebugP');
            const opponent = new BDSMPlayer(3000, 800, 200, 0.1, noBonuses, noTier4, noTier5, 'DebugO');

            expect(() => {
                calculateBattleProbabilities(player, opponent, true);
            }).not.toThrow();
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
