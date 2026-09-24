import { readFileSync } from 'fs';
import { join } from 'path';
import {
    RewardHelper
} from '../../src/Helper/RewardHelper';
import { ConfigHelper } from '../../src/Helper/ConfigHelper';

// One slot per type and class combination, as the reward paths render them:
// every tier of path-of-valor, path-of-glory, season, penta-drill and the
// seasonal event, measured on the test account. Tooltips and image URLs are
// stripped; data-d is kept, it carries the item type.
type SlotSample = { page: string, type: string, amountText: string | null, html: string };
const slotSamples: SlotSample[] = JSON.parse(readFileSync(join(__dirname, '../fixtures/rewards/reward-path-slots.json'), 'utf-8'));
const toElement = (html: string) => {
    const holder = document.createElement('div');
    holder.innerHTML = html;
    return holder.firstElementChild as HTMLElement;
};

/**
 * The class-to-type mapping is tested against slots the game rendered, not
 * against elements built here: a table that builds the element itself and
 * asserts the mapping src/Helper/RewardHelper.ts defines stays green through
 * any rename. When the game changes its markup, re-measure the fixture on
 * the same five pages.
 */
describe("RewardHelper", function() {

    describe("getRewardTypeBySlot", function() {
        it("returns 'undetected' for a missing element and for one with no reward class", function() {
            expect(RewardHelper.getRewardTypeBySlot(undefined)).toBe('undetected');
            const elem = document.createElement('div');
            expect(RewardHelper.getRewardTypeBySlot(elem)).toBe('undetected');
        });
    });

    describe("getRewardTypeBySlot on measured reward-path slots", function() {
        it.each(slotSamples.map(s => [s.type, s.html.slice(0, 70), s]))("%s: %s", (_type, _html, sample) => {
            expect(RewardHelper.getRewardTypeBySlot(toElement((sample as SlotSample).html))).toBe((sample as SlotSample).type);
        });

        it("reads a mythic booster by its data, not by its rarity class", function() {
            const booster = slotSamples.find(s => / mythic slot_item/.test(s.html) && s.type === 'booster');
            expect(booster).toBeDefined();
        });

        it("tells mythic random equipment from the other rarities", function() {
            expect(RewardHelper.getRewardTypeBySlot(toElement('<div class="slot size_xs mythic random_equipment mythic"></div>'))).toBe('mythic');
            expect(RewardHelper.getRewardTypeBySlot(toElement('<div class="slot size_xs legendary random_equipment legendary"></div>'))).toBe('equipment');
        });

        it("every measured type is one the collect popup offers", function() {
            const offered = Object.keys(ConfigHelper.getHHScriptVars('possibleRewardsList'));
            for (const sample of slotSamples) expect(offered).toContain(sample.type);
        });
    });

    describe("getRewardQuantityByType on measured reward-path slots", function() {
        it("reads the shards a tier adds, not the girl's count before it", function() {
            const withShards = slotSamples.find(s => s.type === 'girl_shards' && s.amountText)!;
            expect(RewardHelper.getRewardQuantityByType('girl_shards', toElement(withShards.html))).toBe(20);
        });

        it("reads amounts in K and with separators", function() {
            const xp = slotSamples.find(s => s.type === 'xp')!;
            const progressions = slotSamples.find(s => s.type === 'progressions')!;
            expect(RewardHelper.getRewardQuantityByType('xp', toElement(xp.html))).toBe(11100);
            expect(RewardHelper.getRewardQuantityByType('progressions', toElement(progressions.html))).toBe(1000);
        });
    });

    describe("getRewardsAsHtml", function() {
        it("renders every type with a count, and skips the tier total and undetected slots", function() {
            const counts: any = { all: 12, undetected: 3, girl_shards: 120, gems: 85, booster: 2, equipment: 1, lively_scene: 1, avatar: 1 };
            const holder = document.createElement('div');
            holder.innerHTML = RewardHelper.getRewardsAsHtml(counts);
            const slots = [...holder.querySelectorAll('.slot')];
            expect(slots).toHaveLength(6);
            expect(slots.map(s => s.querySelector('.amount')!.textContent)).toEqual(['120', '85', '2', '1', '1', '1']);
            expect(holder.querySelector('.slot_girl_shards .shard_icn')).not.toBeNull();
            expect(holder.querySelector('.slot_gems .gem_all_icn')).not.toBeNull();
        });

        it("renders nothing for a tier total alone", function() {
            expect(RewardHelper.getRewardsAsHtml({ all: 4 } as any)).toBe('');
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
