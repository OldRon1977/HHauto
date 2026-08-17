import {
    RewardHelper
} from '../../src/Helper/RewardHelper';

/**
 * Spec triage (2026-08): the class-to-reward-type table (13 cases) and the
 * quantity readers were removed. They built the element themselves and then
 * asserted the mapping src/Helper/RewardHelper.ts defines -- a renamed game
 * class stayed green by construction. Those class names and the .amount /
 * shards markup are checked in scripts/live-check instead.
 *
 * What remains: the null-guards, which are ours and not the game's, and the
 * icon-url parsing, whose input should become a fixture from a real reward
 * payload (class D, still open).
 */
describe("RewardHelper", function() {

    describe("getRewardTypeBySlot", function() {
        it("returns 'undetected' for a missing element and for one with no reward class", function() {
            expect(RewardHelper.getRewardTypeBySlot(undefined)).toBe('undetected');
            const elem = document.createElement('div');
            expect(RewardHelper.getRewardTypeBySlot(elem)).toBe('undetected');
        });
    });

    describe("getRewardTypeByData", function() {
        it("default", function() {
            expect(RewardHelper.getRewardTypeByData(undefined)).toBe('undetected');
            expect(RewardHelper.getRewardTypeByData({})).toBe('undetected');
            expect(RewardHelper.getRewardTypeByData({
                ico:null
            })).toBe('undetected');
            expect(RewardHelper.getRewardTypeByData({
                ico:'https://hh2.hh-content.com/pictures/items/B4.png'
            })).toBe('undetected');
        });
        it("Gifts", function() {
            expect(RewardHelper.getRewardTypeByData({
                ico:'https://hh2.hh-content.com/pictures/items/K4.png'
            })).toBe('gift');
            expect(RewardHelper.getRewardTypeByData({
                ico:'https://hh2.hh-content.com/pictures/items/K999.png'
            })).toBe('gift');
        });
        it("Potions", function() {
            expect(RewardHelper.getRewardTypeByData({
                ico:'https://hh2.hh-content.com/pictures/items/XP4.png'
            })).toBe('potion');
            expect(RewardHelper.getRewardTypeByData({
                ico:'https://hh2.hh-content.com/pictures/items/XP999.png'
            })).toBe('potion');
        });
        it("By type", function() {
            expect(RewardHelper.getRewardTypeByData({
                type:'soft_currency'
            })).toBe('soft_currency');
            expect(RewardHelper.getRewardTypeByData({
                type:'xp'
            })).toBe('xp');
            expect(RewardHelper.getRewardTypeByData({
                type:'ONE_TYPE'
            })).toBe('ONE_TYPE');
        });
    });

    describe("getRewardQuantityByType", function() {
        it("returns 0 for a missing or empty type", function() {
          expect(RewardHelper.getRewardQuantityByType(undefined as any, undefined as any)).toBe(0);
          expect(RewardHelper.getRewardQuantityByType(null as any, {})).toBe(0);
          expect(RewardHelper.getRewardQuantityByType('', {})).toBe(0);
        });
    });
});
