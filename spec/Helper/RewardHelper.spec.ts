import {
    RewardHelper
} from '../../src/Helper/RewardHelper';
import { ConfigHelper } from '../../src/Helper/ConfigHelper';

describe("RewardHelper", function() {
    beforeEach(() => {
      ConfigHelper.getHHScriptVars = jest.fn().mockReturnValue(
        {'POSSIBLE_REWARD_CLASS' : "POSSIBLE_REWARD_NAME"}
      )
    })

    describe("getRewardTypeBySlot", function() {
        it("default", function() {
            expect(RewardHelper.getRewardTypeBySlot(undefined)).toBe('undetected');
            const elem = document.createElement('div');
            expect(RewardHelper.getRewardTypeBySlot(elem)).toBe('undetected');
        });
        it("cur attribute", function() {
            const elem = document.createElement('div');
            elem.classList.add('slot');
            elem.setAttribute('cur','CUR_TYPE');
            expect(RewardHelper.getRewardTypeBySlot(elem)).toBe('CUR_TYPE');
        });
        it("girl shards shards_girl_ico", function() {
            const elem = document.createElement('div');
            elem.classList.add('shards_girl_ico');
            expect(RewardHelper.getRewardTypeBySlot(elem)).toBe('girl_shards');
        });
        it("girl shards girl_ico", function() {
            const elem = document.createElement('div');
            elem.classList.add('slot');
            elem.classList.add('slot_avatar');
            elem.classList.add('girl_ico');
            expect(RewardHelper.getRewardTypeBySlot(elem)).toBe('girl_shards');
        });
        it("girl avatar", function() {
            const elem = document.createElement('div');
            elem.classList.add('slot');
            elem.classList.add('slot_avatar');
            expect(RewardHelper.getRewardTypeBySlot(elem)).toBe('avatar');
        });
        it("girl shards girl-shards-slot", function() {
            const elem = document.createElement('div');
            elem.classList.add('slot');
            elem.classList.add('girl-shards-slot');
            expect(RewardHelper.getRewardTypeBySlot(elem)).toBe('girl_shards');
        });
        it("girl shards slot_girl_shards", function() {
            const elem = document.createElement('div');
            elem.classList.add('slot');
            elem.classList.add('slot_girl_shards');
            expect(RewardHelper.getRewardTypeBySlot(elem)).toBe('girl_shards');
        });
        it("random girl shards", function() {
            const elem = document.createElement('div');
            elem.classList.add('slot');
            elem.classList.add('slot_random_girl');
            expect(RewardHelper.getRewardTypeBySlot(elem)).toBe('random_girl_shards');
        });
        it("mythic equipment", function() {
            const elem = document.createElement('div');
            elem.classList.add('slot');
            elem.classList.add('mythic');
            expect(RewardHelper.getRewardTypeBySlot(elem)).toBe('mythic');
        });
        it("scrolls", function() {
            const elem = document.createElement('div');
            elem.classList.add('slot');
            elem.classList.add('slot_scrolls_XXX');
            expect(RewardHelper.getRewardTypeBySlot(elem)).toBe('scrolls');
        });
        it("event_cash", function() {
            const elem = document.createElement('div');
            elem.classList.add('slot');
            elem.classList.add('slot_seasonal_event_cash');
            expect(RewardHelper.getRewardTypeBySlot(elem)).toBe('event_cash');
        });
        it("Data D", function() {
            const elem = document.createElement('div');
            elem.classList.add('slot');
            // Booster for example
            elem.setAttribute('data-d','{"item":{"type":"DATA_D_TYPE"}}');
            expect(RewardHelper.getRewardTypeBySlot(elem)).toBe('DATA_D_TYPE');
        });
        it("Data D", function() {
            const elem = document.createElement('div');
            elem.classList.add('slot');
            // Booster for example
            elem.setAttribute('data-d','{"item":{"type":"DATA_D_TYPE"}}');
            expect(RewardHelper.getRewardTypeBySlot(elem)).toBe('DATA_D_TYPE');
        });
        it("Look in possible rewards list", function() {
            const elem = document.createElement('div');
            elem.classList.add('slot');
            elem.classList.add('slot_POSSIBLE_REWARD_CLASS');
            expect(RewardHelper.getRewardTypeBySlot(elem)).toBe('POSSIBLE_REWARD_CLASS');
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
        it("default", function() {
          expect(RewardHelper.getRewardQuantityByType(undefined as any, undefined as any)).toBe(0);
          expect(RewardHelper.getRewardQuantityByType(null as any, {})).toBe(0);
          expect(RewardHelper.getRewardQuantityByType('', {})).toBe(0);
        });
        it("mythic equipment", function() {
          expect(RewardHelper.getRewardQuantityByType('mythic', undefined)).toBe(1);
        });
        it("avatar", function() {
          expect(RewardHelper.getRewardQuantityByType('avatar', undefined)).toBe(1);
        });
        it("Girl shards", function() {
          var div = document.createElement('div');
          div.innerHTML = '<div class="shards" shards="99" >123</div>';
          expect(RewardHelper.getRewardQuantityByType('girl_shards', div)).toBe(99);
        });
        it("energy", function() {
          var div = document.createElement('div');
          div.innerHTML = '<div class="amount" >123</div>';
          expect(RewardHelper.getRewardQuantityByType('energy_kiss', div)).toBe(123);
          expect(RewardHelper.getRewardQuantityByType('energy_quest', div)).toBe(123);
          expect(RewardHelper.getRewardQuantityByType('energy_fight', div)).toBe(123);
        });
        it("Currency", function() {
          var div = document.createElement('div');
          div.innerHTML = '<div class="amount">1,0M</div>';
          expect(RewardHelper.getRewardQuantityByType('soft_currency', div)).toBe(1000000);
          div.innerHTML = '<div class="amount">1,0K</div>';
          expect(RewardHelper.getRewardQuantityByType('hard_currency', div)).toBe(1000);
        });
    });
});