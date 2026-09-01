import {
    Booster
} from '../../src/Module/Booster'
import { HeroHelper } from '../../src/Helper/HeroHelper'
import { HHStoredVarPrefixKey } from '../../src/config/HHStoredVars';
import { Timers, setTimer, checkTimer, clearTimer, getSecondsLeft } from '../../src/Helper/TimerHelper';
import { safeReload } from '../../src/Service/PageNavigationService';
import { MockHelper } from "../testHelpers/MockHelpers";
import { EventGirl } from '../../src/model/EventGirl';

// Booster reloads the page after a mythic conflict (the game's conflict popup
// cannot be closed programmatically); mock navigation so tests never touch
// window.location.
jest.mock('../../src/Service/PageNavigationService', () => ({
    ...jest.requireActual('../../src/Service/PageNavigationService'),
    gotoPage: jest.fn(),
    safeReload: jest.fn(),
    safeNavigateHref: jest.fn(),
}));
const safeReloadMock = safeReload as jest.Mock;

// Test fixtures for the booster objects.
const TEST_GINSENG = {id_item: "316", identifier: "B1", name: "Ginseng root", rarity: "legendary"};
const TEST_SANDALWOOD = {id_item: "632", identifier: "MB1", name: "Sandalwood perfume", rarity: "mythic"};

/** Sets up boosterIdMap in sessionStorage so getBoosterByIdentifier can resolve boosters */
function setupBoosterIdMap(boosters: any[] = [TEST_GINSENG, TEST_SANDALWOOD]) {
    const map: Record<string, any> = {};
    for (const b of boosters) {
        map[b.identifier] = { id_item: b.id_item, identifier: b.identifier, name: b.name, rarity: b.rarity };
    }
    sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_boosterIdMap", JSON.stringify(map));
}

describe("Booster", function() {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // remove callback
    localStorage.itemInsertionCallback = null;
    // Clear all timers
    for (const key of Object.keys(Timers)) {
        delete Timers[key];
    }
  });
  const B4 = {item: {identifier:'B4'}, endAt:99999};
  const MB1 = {item: {identifier:'MB1', endAt:99999}};
  const XX = {item: {identifier:'XX', endAt:1}};

  describe("needBoosterStatusFromStore", function() {
    it("default", function() {
      expect(Booster.needBoosterStatusFromStore()).toBeFalsy();
    });
    it("plusEventMythicSandalWood", function() {
      localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythicSandalWood", 'true');
      expect(Booster.needBoosterStatusFromStore()).toBeTruthy();
    });
    it("autoLeaguesBoosted", function() {
      localStorage.setItem(HHStoredVarPrefixKey+"Setting_autoLeaguesBoostedOnly", 'true');
      expect(Booster.needBoosterStatusFromStore()).toBeTruthy();
    });
    it("autoSeasonBoosted", function() {
      localStorage.setItem(HHStoredVarPrefixKey+"Setting_autoSeasonBoostedOnly", 'true');
      expect(Booster.needBoosterStatusFromStore()).toBeTruthy();
    });
    it("autoPantheonBoosted", function() {
      localStorage.setItem(HHStoredVarPrefixKey+"Setting_autoPantheonBoostedOnly", 'true');
      expect(Booster.needBoosterStatusFromStore()).toBeTruthy();
    });
  });

  describe("getBoosterFromStorage", function() {
    it("default not stored", function() {
      expect(Booster.getBoosterFromStorage()).toEqual({normal: [], mythic:[]});
    });

    it("Stored", function() {
      const storedBooster = {normal: [XX], mythic:[XX]}
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_boosterStatus", JSON.stringify(storedBooster));
      expect(Booster.getBoosterFromStorage()).toEqual(storedBooster);
    });
  });

  describe("haveBoosterEquiped", function() {

    it("default not stored", function() {
      expect(Booster.haveBoosterEquiped()).toBeFalsy();
      expect(Booster.haveBoosterEquiped('B4')).toBeFalsy();
      expect(Booster.haveBoosterEquiped('MB1')).toBeFalsy();
    });

    it("Stored empty", function() {
        sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_boosterStatus", JSON.stringify({normal: [], mythic:[]}));
      expect(Booster.haveBoosterEquiped()).toBeFalsy();
      expect(Booster.haveBoosterEquiped('B4')).toBeFalsy();
      expect(Booster.haveBoosterEquiped('MB1')).toBeFalsy();
    });

    it("Have B4", function() {
        sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_boosterStatus", JSON.stringify({normal: [B4], mythic:[]}));
      expect(Booster.haveBoosterEquiped()).toBeTruthy();
      expect(Booster.haveBoosterEquiped('B4')).toBeTruthy();
      expect(Booster.haveBoosterEquiped('MB1')).toBeFalsy();
    });

    it("Have booster expired", function() {
        sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_boosterStatus", JSON.stringify({normal: [XX], mythic:[]}));
      expect(Booster.haveBoosterEquiped()).toBeFalsy();
      expect(Booster.haveBoosterEquiped('XX')).toBeFalsy();
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_boosterStatus", JSON.stringify({normal: [], mythic:[XX]}));
      expect(Booster.haveBoosterEquiped()).toBeFalsy();
      expect(Booster.haveBoosterEquiped('XX')).toBeTruthy(); // No expiry date on mythic booster
    });

    it("Have MB1", function() {
        sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_boosterStatus", JSON.stringify({normal: [], mythic:[MB1]}));
      expect(Booster.haveBoosterEquiped()).toBeFalsy();
      expect(Booster.haveBoosterEquiped('B4')).toBeFalsy();
      expect(Booster.haveBoosterEquiped('MB1')).toBeTruthy();
    });

    it("Have Many", function() {
        sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_boosterStatus", JSON.stringify({normal: [XX,B4], mythic:[MB1]}));
      expect(Booster.haveBoosterEquiped()).toBeTruthy();
      expect(Booster.haveBoosterEquiped('XX')).toBeFalsy();
      expect(Booster.haveBoosterEquiped('B4')).toBeTruthy();
      expect(Booster.haveBoosterEquiped('MB1')).toBeTruthy();
      expect(Booster.haveBoosterEquiped('ZZ')).toBeFalsy();
    });
  });

  describe("isEquipOnCooldown", function() {
    it("no cooldown by default", function() {
      expect(Booster.isEquipOnCooldown()).toBeFalsy();
    });

    it("on cooldown after setEquipCooldown", function() {
      Booster.setEquipCooldown(300);
      expect(Booster.isEquipOnCooldown()).toBeTruthy();
    });

    it("not on cooldown after timer expires", function() {
      // Set timer to 0 seconds (expires immediately)
      Timers['nextBoosterEquipTime'] = new Date(Date.now() - 1000);
      expect(Booster.isEquipOnCooldown()).toBeFalsy();
    });
  });

  describe("hasBoosterDataFromMarket", function() {
    it("returns false when no data cached", function() {
      expect(Booster.hasBoosterDataFromMarket()).toBeFalsy();
    });

    it("returns true when both boosterIdMap and haveBooster are cached", function() {
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_boosterIdMap", '{}');
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", '{}');
      expect(Booster.hasBoosterDataFromMarket()).toBeTruthy();
    });

    it("returns false when only one is cached", function() {
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_boosterIdMap", '{}');
      expect(Booster.hasBoosterDataFromMarket()).toBeFalsy();
    });
  });

  describe("getBoosterByIdentifier", function() {
    it("returns null when no market data", function() {
      expect(Booster.getBoosterByIdentifier('B1')).toBeNull();
    });

    it("resolves from boosterIdMap (new format)", function() {
      setupBoosterIdMap();
      const result = Booster.getBoosterByIdentifier('B1');
      expect(result).toBeDefined();
      expect(result.identifier).toBe('B1');
      expect(result.id_item).toBe('316');
      expect(result.rarity).toBe('legendary');
    });

    it("resolves mythic from boosterIdMap", function() {
      setupBoosterIdMap();
      const result = Booster.getBoosterByIdentifier('MB1');
      expect(result).toBeDefined();
      expect(result.identifier).toBe('MB1');
      expect(result.rarity).toBe('mythic');
    });

    it("handles old boosterIdMap format (string id_item)", function() {
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_boosterIdMap", JSON.stringify({B1: "316"}));
      const result = Booster.getBoosterByIdentifier('B1');
      expect(result).toBeDefined();
      expect(result.id_item).toBe('316');
      expect(result.identifier).toBe('B1');
    });
  });

  describe("markBoosterAsEquippedInStorage", function() {
    beforeEach(function() {
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_boosterStatus", JSON.stringify({normal: [], mythic:[]}));
    });

    it("marks mythic booster as equipped", function() {
      Booster.markBoosterAsEquippedInStorage(TEST_SANDALWOOD);
      const status = Booster.getBoosterFromStorage();
      expect(status.mythic.length).toBe(1);
      expect(status.mythic[0].item.identifier).toBe('MB1');
      expect(status.mythic[0].usages_remaining).toBe(99);
      expect(Booster.haveBoosterEquiped('MB1')).toBeTruthy();
    });

    it("marks normal booster as equipped", function() {
      Booster.markBoosterAsEquippedInStorage(TEST_GINSENG);
      const status = Booster.getBoosterFromStorage();
      expect(status.normal.length).toBe(1);
      expect(status.normal[0].item.identifier).toBe('B1');
      // endAt should be server_now_ts (1234) + 8*3600 = 30034
      expect(status.normal[0].endAt).toBe(1234 + 8 * 3600);
      expect(Booster.haveBoosterEquiped('B1')).toBeTruthy();
    });

    it("does not duplicate mythic booster", function() {
      Booster.markBoosterAsEquippedInStorage(TEST_SANDALWOOD);
      Booster.markBoosterAsEquippedInStorage(TEST_SANDALWOOD);
      const status = Booster.getBoosterFromStorage();
      expect(status.mythic.length).toBe(1);
    });

    it("does not duplicate normal booster", function() {
      Booster.markBoosterAsEquippedInStorage(TEST_GINSENG);
      Booster.markBoosterAsEquippedInStorage(TEST_GINSENG);
      const status = Booster.getBoosterFromStorage();
      expect(status.normal.length).toBe(1);
    });
  });

  describe("needSandalWoodEquipped", function() {
    it("returns false when no settings active", function() {
      expect(Booster.needSandalWoodEquipped(1)).toBeFalsy();
    });

    it("returns true when sandalwood activated but no market data cached", function() {
      localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythic", 'true');
      localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythicSandalWood", 'true');
      // No boosterIdMap or haveBooster in sessionStorage
      expect(Booster.needSandalWoodEquipped(1)).toBeTruthy();
    });

    it("returns false when on cooldown even without market data", function() {
      localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythic", 'true');
      localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythicSandalWood", 'true');
      Booster.setEquipCooldown(300);
      expect(Booster.needSandalWoodEquipped(1)).toBeFalsy();
    });
  });

  // #1843: the log showed five fights on a girl that already had 100/100 --
  // with +Girl Skins off, so there was nothing left to win. The shard count is
  // now read out of every battle response instead of only from the event page.
  describe("shard read-back after a fight (#1843)", function() {
    const MYTHIC_KEY = HHStoredVarPrefixKey + "Temp_eventMythicGirl";
    const response = (previous_value: number, value: number) => ({ rewards: { data: { shards: [{ previous_value, value }] } } });

    function storeMythicGirl(shards: number) {
      sessionStorage.setItem(MYTHIC_KEY, JSON.stringify({ girl_id: 42, troll_id: 7, shards, is_mythic: true, event_id: 'me_1' }));
      sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_eventsList", JSON.stringify({ me_1: { id: 'me_1', next_refresh: 999999 } }));
    }

    it("writes the new count into the stored girl", function() {
      storeMythicGirl(90);
      Booster.updateEventGirlShards(response(90, 94));
      expect(JSON.parse(sessionStorage.getItem(MYTHIC_KEY) as string).shards).toBe(94);
    });

    it("drops the girl as a target once she is complete and skins are off", function() {
      storeMythicGirl(98);
      Booster.updateEventGirlShards(response(98, 100));
      expect(sessionStorage.getItem(MYTHIC_KEY)).toBeNull();
    });

    it("drops her even when the fight added nothing, because she was already complete", function() {
      // This is the situation from the report: 100/100, and the script kept going.
      storeMythicGirl(100);
      Booster.updateEventGirlShards(response(100, 100));
      expect(sessionStorage.getItem(MYTHIC_KEY)).toBeNull();
    });

    it("keeps her and re-checks the event page when skins are wanted", function() {
      localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusGirlSkins", 'true');
      storeMythicGirl(98);
      Booster.updateEventGirlShards(response(98, 100));
      expect(sessionStorage.getItem(MYTHIC_KEY)).not.toBeNull();
      // next_refresh cleared -> the pipeline visits the event page, which is the
      // only place that knows whether a skin is still outstanding.
      expect(JSON.parse(sessionStorage.getItem(HHStoredVarPrefixKey + "Temp_eventsList") as string).me_1.next_refresh).toBe(0);
    });

    it("leaves everything alone when the response carries no shard data", function() {
      storeMythicGirl(90);
      Booster.updateEventGirlShards({ rewards: { data: {} } });
      expect(JSON.parse(sessionStorage.getItem(MYTHIC_KEY) as string).shards).toBe(90);
    });
  });

  describe("sandalwood in the skin phase (#1843)", function() {
    it("is blocked once the girl is complete", function() {
      localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusGirlSkins", 'true');
      expect(Booster.skinPhaseBlocksSandalwood(100)).toBe(true);
    });

    it("is allowed in the skin phase when Equip Sandalwood is switched on", function() {
      localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusGirlSkins", 'true');
      localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusSkinSandalWood", 'true');
      expect(Booster.skinPhaseBlocksSandalwood(100)).toBe(false);
    });

    it("stays blocked with skins off, whatever the new switch says", function() {
      localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusSkinSandalWood", 'true');
      expect(Booster.skinPhaseBlocksSandalwood(100)).toBe(true);
    });

    it("does not interfere while the girl is still incomplete", function() {
      expect(Booster.skinPhaseBlocksSandalwood(99)).toBe(false);
    });

    it("stops needSandalWoodMythic from equipping a perfume for a finished girl", function() {
      localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusEventMythic", 'true');
      localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusEventMythicSandalWood", 'true');
      localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusGirlSkins", 'true');
      const girl = { girl_id: 42, troll_id: 7, shards: 100, is_mythic: true, event_id: 'me_1' } as unknown as EventGirl;
      expect(Booster.needSandalWoodMythic(7, girl)).toBe(false);
    });
  });

  describe("equipeSandalWoodIfNeeded", function() {

    beforeEach(function() {
      MockHelper.mockDomain();
      // Fixed mock: hh_ajax(params, successCb, errorCb) must invoke the callback
      unsafeWindow.shared!.general!.hh_ajax = jest.fn((params: any, successCb: any, errorCb: any) => {
          const fakeResponse = { success: true };
          successCb(fakeResponse);
      });
      // Have boosters equipped none
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_boosterStatus", JSON.stringify({normal: [], mythic:[]}));
      // Have boosters
      const boosters = '{"B1":123,"B2":123,"B3":123,"B4":123,"MB1":123,"MB2":123,"MB3":123,"MB4":123}';
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", boosters);
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_sandalwoodFailure", '0');
      // Set up market data so Sandalwood can be resolved
      setupBoosterIdMap();
    });

    function setGirl(mythic:boolean, troll:number, shards:number){
      const girl = `{"girl_id":666,"troll_id":"${troll}","shards":${shards},"is_mythic":${mythic},"name":"NEXT_GIRL","event_id":"event_666"}`;
      if (mythic)
        sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_eventMythicGirl", girl);
      else
        sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_eventGirl", girl);
    }

    it("default - no settings active", async function() {
      const result = await Booster.equipeSandalWoodIfNeeded(1);
      expect(result).toBeFalsy();
    });

    it("No all active", async function() {
      setGirl(true, 99, 55);
      localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythic", 'false');
      localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythicSandalWood", 'true');
      const result1 = await Booster.equipeSandalWoodIfNeeded(1);
      expect(result1).toBeFalsy();

      localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythic", 'true');
      localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythicSandalWood", 'false');
      const result2 = await Booster.equipeSandalWoodIfNeeded(1);
      expect(result2).toBeFalsy();
    });

    it("Stored mythic girl - wrong troll", async function() {
      setGirl(true, 99, 55);
      localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythic", 'true');
      localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythicSandalWood", 'true');
      const result = await Booster.equipeSandalWoodIfNeeded(1);
      // wrong troll
      expect(result).toBeFalsy();
    });

    it("Stored mythic girl - correct troll - success", async function() {
      setGirl(true, 99, 55);
      localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythic", 'true');
      localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythicSandalWood", 'true');
      const result = await Booster.equipeSandalWoodIfNeeded(99);
      expect(result).toBeTruthy();
      // Failure counter should be reset on success
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(0);
    });

    it("No mythic girl", async function() {
      setGirl(false, 99, 55);
      localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythic", 'true');
      localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythicSandalWood", 'true');
      const result = await Booster.equipeSandalWoodIfNeeded(99);
      expect(result).toBeFalsy();
    });

    it("Ended mythic girl", async function() {
      setGirl(true, 99, 100);
      localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythic", 'true');
      localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythicSandalWood", 'true');
      const result = await Booster.equipeSandalWoodIfNeeded(99);
      expect(result).toBeFalsy();
    });

    describe("Failure equip call", function() {

      beforeEach(function() {
        // Mock failure case: server returns success:false
        unsafeWindow.shared!.general!.hh_ajax = jest.fn((params: any, successCb: any, errorCb: any) => {
            const fakeResponse = { success: false };
            successCb(fakeResponse);
        });
      });

      it("First failure returns false and increments counter", async function() {
        setGirl(true, 99, 55);
        localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythic", 'true');
        localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythicSandalWood", 'true');
        const result = await Booster.equipeSandalWoodIfNeeded(99);
        expect(result).toBeFalsy();
        // equipBooster increments to 1, equipeSandalWoodIfNeeded reads 1
        expect(HeroHelper.getSandalWoodEquipFailure()).toBe(1);
        // Setting should still be active
        expect(localStorage.getItem(HHStoredVarPrefixKey+"Setting_plusEventMythicSandalWood")).toBe('true');
        // Booster should be marked as equipped in storage
        expect(Booster.haveBoosterEquiped('MB1')).toBeTruthy();
        // Cooldown should be set
        expect(Booster.isEquipOnCooldown()).toBeTruthy();
      });

      it("Third failure deactivates setting", async function() {
        setGirl(true, 99, 55);
        localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythic", 'true');
        localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythicSandalWood", 'true');
        // Pre-set failure counter to 2 (equipBooster will increment to 3)
        sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_sandalwoodFailure", '2');
        // Clear the booster status so ownedSandalwoodAndNotEquiped() returns true
        sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_boosterStatus", JSON.stringify({normal: [], mythic:[]}));

        const result = await Booster.equipeSandalWoodIfNeeded(99);
        expect(result).toBeFalsy();
        // equipBooster increments 2->3, then equipeSandalWoodIfNeeded reads 3 -> deactivates
        expect(HeroHelper.getSandalWoodEquipFailure()).toBe(3);
        expect(localStorage.getItem(HHStoredVarPrefixKey+"Setting_plusEventMythicSandalWood")).toBe('false');
      });
    });

    describe("Cooldown behavior", function() {
      it("skips equip when on cooldown", async function() {
        setGirl(true, 99, 55);
        localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythic", 'true');
        localStorage.setItem(HHStoredVarPrefixKey+"Setting_plusEventMythicSandalWood", 'true');

        // Set cooldown
        Booster.setEquipCooldown(300);

        const result = await Booster.equipeSandalWoodIfNeeded(99);
        expect(result).toBeFalsy();
        // hh_ajax should NOT have been called
        expect(unsafeWindow.shared!.general!.hh_ajax).not.toHaveBeenCalled();
      });
    });
  });

  describe("parseMythicBoosterList", function() {
    it("returns empty list by default (off)", function() {
      expect(Booster.parseMythicBoosterList()).toEqual([]);
    });
    it("returns empty list for an empty field", function() {
      MockHelper.mockSetting('autoEquipMythicBooster', '');
      expect(Booster.parseMythicBoosterList()).toEqual([]);
    });
    it("parses a single code", function() {
      MockHelper.mockSetting('autoEquipMythicBooster', 'MB9');
      expect(Booster.parseMythicBoosterList()).toEqual(['MB9']);
    });
    it("parses an ordered priority list", function() {
      MockHelper.mockSetting('autoEquipMythicBooster', 'MB9;MB2;MB12');
      expect(Booster.parseMythicBoosterList()).toEqual(['MB9', 'MB2', 'MB12']);
    });
    it("trims whitespace around codes", function() {
      MockHelper.mockSetting('autoEquipMythicBooster', 'MB1; MB2 ;MB5');
      expect(Booster.parseMythicBoosterList()).toEqual(['MB1', 'MB2', 'MB5']);
    });
    it("drops invalid codes", function() {
      MockHelper.mockSetting('autoEquipMythicBooster', 'B1;MB2;MB13');
      expect(Booster.parseMythicBoosterList()).toEqual(['MB2']);
    });
    it("keeps every listed code -- the 5 is the number of slots, not the list length", function() {
      // Capping here used to silently drop everything past the fifth entry, so
      // a player who listed all twelve lost seven of them without being told.
      // The walk in autoEquipMythicBoosters stops when no slot is free, which
      // is where the 5 actually belongs.
      MockHelper.mockSetting('autoEquipMythicBooster', 'MB1;MB2;MB3;MB4;MB5;MB6;MB7;MB8;MB9;MB10;MB11;MB12');
      expect(Booster.parseMythicBoosterList()).toEqual(
        ['MB1', 'MB2', 'MB3', 'MB4', 'MB5', 'MB6', 'MB7', 'MB8', 'MB9', 'MB10', 'MB11', 'MB12']);
    });

    it("drops a repeated code instead of letting it take a second turn", function() {
      MockHelper.mockSetting('autoEquipMythicBooster', 'MB2;MB5;MB2');
      expect(Booster.parseMythicBoosterList()).toEqual(['MB2', 'MB5']);
    });
  });

  describe("isSandalwoodAutomationActive", function() {
    it("false by default", function() {
      expect(Booster.isSandalwoodAutomationActive()).toBeFalsy();
    });
    it("true when +Mythic Sandalwood active", function() {
      MockHelper.mockSetting('plusEventMythic', 'true');
      MockHelper.mockSetting('plusEventMythicSandalWood', 'true');
      expect(Booster.isSandalwoodAutomationActive()).toBeTruthy();
    });
    it("false when only the trigger is on but Sandalwood toggle off", function() {
      MockHelper.mockSetting('plusEventMythic', 'true');
      MockHelper.mockSetting('plusEventMythicSandalWood', 'false');
      expect(Booster.isSandalwoodAutomationActive()).toBeFalsy();
    });
  });

  describe("autoEquipMythicBoosters", function() {
    // 5 mythic slots, one equipped booster per kind: every listed booster that
    // is owned and not equipped yet goes into a free slot (list order =
    // priority). Sandalwood keeps MB1 plus one reserved slot while active.
    const TEST_SEASON_MASTERY = {id_item: "638", identifier: "MB9", name: "Seasons mastery emblem", rarity: "mythic"};
    const TEST_ALL_MASTERY = {id_item: "633", identifier: "MB2", name: "All Mastery's Emblem", rarity: "mythic"};
    let ajaxSpy: jest.Mock;

    function sentIdItems(): string[] {
      return ajaxSpy.mock.calls.map((c) => c[0].id_item);
    }

    beforeEach(function() {
      MockHelper.mockDomain();
      ajaxSpy = jest.fn((_params: unknown, successCb: (data: unknown) => void) => {
          successCb({ success: true });
      });
      unsafeWindow.shared!.general!.hh_ajax = ajaxSpy as (...args: unknown[]) => unknown;
      // Market data so getBoosterByIdentifier can resolve MB9 / MB2 / MB1
      setupBoosterIdMap([TEST_GINSENG, TEST_SANDALWOOD, TEST_SEASON_MASTERY, TEST_ALL_MASTERY]);
      // Inventory holds one MB9
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", '{"MB9":1}');
      // No mythic booster equipped
      MockHelper.mockBoosterInventory({ mythic: [] });
    });

    it("empty list -> no-op", async function() {
      const result = await Booster.autoEquipMythicBoosters([]);
      expect(result).toBeFalsy();
      expect(ajaxSpy).not.toHaveBeenCalled();
    });

    it("free slots + inventory present -> equips", async function() {
      const result = await Booster.autoEquipMythicBoosters(['MB9']);
      expect(result).toBeTruthy();
      expect(sentIdItems()).toEqual(['638']);
      // Fresh equip is tracked in storage right away (before the next market visit).
      expect(Booster.haveBoosterEquiped('MB9')).toBeTruthy();
    });

    it("equips EVERY listed booster that is owned and fits a free slot", async function() {
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", '{"MB9":1,"MB2":1}');
      const result = await Booster.autoEquipMythicBoosters(['MB9', 'MB2']);
      expect(result).toBeTruthy();
      // Both equipped, in priority order.
      expect(sentIdItems()).toEqual(['638', '633']);
      expect(Booster.haveBoosterEquiped('MB9')).toBeTruthy();
      expect(Booster.haveBoosterEquiped('MB2')).toBeTruthy();
    });

    it("skips codes already equipped (one booster per kind)", async function() {
      MockHelper.mockBoosterInventory({ mythic: ['MB9'] });
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", '{"MB9":1,"MB2":1}');
      const result = await Booster.autoEquipMythicBoosters(['MB9', 'MB2']);
      expect(result).toBeTruthy();
      // Only MB2 equipped; MB9 was already active.
      expect(sentIdItems()).toEqual(['633']);
    });

    it("skips codes not in inventory and continues down the list", async function() {
      // MB9 is first in the list but not in inventory; MB2 is owned -> equip MB2 only.
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", '{"MB2":1}');
      const result = await Booster.autoEquipMythicBoosters(['MB9', 'MB2']);
      expect(result).toBeTruthy();
      expect(sentIdItems()).toEqual(['633']);
    });

    it("all 5 mythic slots taken -> no-op (never replaces)", async function() {
      MockHelper.mockBoosterInventory({ mythic: ['MB3', 'MB4', 'MB5', 'MB10', 'MB11'] });
      const result = await Booster.autoEquipMythicBoosters(['MB9']);
      expect(result).toBeFalsy();
      expect(ajaxSpy).not.toHaveBeenCalled();
    });

    it("none of the list in inventory -> no-op", async function() {
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", '{}');
      const result = await Booster.autoEquipMythicBoosters(['MB9', 'MB2']);
      expect(result).toBeFalsy();
      expect(ajaxSpy).not.toHaveBeenCalled();
    });

    it("Sandalwood active and MB1 already equipped: the rest of the list fills the free slots", async function() {
      // NOTE: MB1 is already equipped here, so the loop skips it as "already
      // on" -- this case does NOT exercise the Sandalwood skip. The two tests
      // below are the ones that pin that rule down.
      MockHelper.mockSetting('plusEventMythic', 'true');
      MockHelper.mockSetting('plusEventMythicSandalWood', 'true');
      MockHelper.mockBoosterInventory({ mythic: ['MB1'] });
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", '{"MB1":1,"MB2":1,"MB9":1}');
      const result = await Booster.autoEquipMythicBoosters(['MB1', 'MB2', 'MB9']);
      expect(result).toBeTruthy();
      expect(sentIdItems()).toEqual(['633', '638']);
    });

    it("Sandalwood active: MB1 in the list is skipped even when it is NOT equipped yet", async function() {
      // The rule the maintainer wants kept: with a Sandalwood auto-equip on,
      // MB1 belongs to that automation. Listing it must not make the priority
      // list equip it -- the automation puts it on when a fight needs it, and
      // it only has 11 uses, so holding it permanently would spend them on
      // whatever happens to run.
      MockHelper.mockSetting('plusEventMythic', 'true');
      MockHelper.mockSetting('plusEventMythicSandalWood', 'true');
      MockHelper.mockBoosterInventory({ mythic: [] }); // MB1 not equipped
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", '{"MB1":1,"MB2":1}');

      const result = await Booster.autoEquipMythicBoosters(['MB1', 'MB2']);

      expect(result).toBeTruthy();
      expect(sentIdItems()).toEqual(['633']); // MB2 only; MB1 left to the automation
    });

    it("Sandalwood active: listing MB1 does not free up the reserved slot either", async function() {
      // 4 of 5 taken. The fifth stays held for Sandalwood whether or not MB1
      // appears in the list, so the list equips nothing here.
      MockHelper.mockSetting('plusEventMythic', 'true');
      MockHelper.mockSetting('plusEventMythicSandalWood', 'true');
      MockHelper.mockBoosterInventory({ mythic: ['MB3', 'MB4', 'MB5', 'MB10'] });
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", '{"MB1":1,"MB2":1}');

      const result = await Booster.autoEquipMythicBoosters(['MB1', 'MB2']);

      expect(result).toBeFalsy();
      expect(ajaxSpy).not.toHaveBeenCalled();
      expect(Booster.getFreeMythicSlots()).toBe(0); // 5 - 4 - 1 reserved
    });

    it("Sandalwood NOT active: MB1 is a normal list entry and all 5 slots are usable", async function() {
      // The reservation and the skip are both tied to the automation being on.
      // With every Sandalwood option off, MB1 is just another code: it is
      // equipped from the list in its position, and nothing is held back.
      // What the player gives up is the event-driven handling -- MB1 then sits
      // there permanently instead of being put on when a fight needs it.
      MockHelper.mockSetting('plusEventMythic', 'false');
      MockHelper.mockSetting('plusEventMythicSandalWood', 'false');
      MockHelper.mockSetting('plusEvent', 'false');
      MockHelper.mockSetting('plusEventSandalWood', 'false');
      MockHelper.mockBoosterInventory({ mythic: [] });
      sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_haveBooster", '{"MB1":1,"MB2":1}');

      expect(Booster.isSandalwoodAutomationActive()).toBeFalsy();
      expect(Booster.getFreeMythicSlots()).toBe(5); // no slot held back

      const result = await Booster.autoEquipMythicBoosters(['MB1', 'MB2']);

      expect(result).toBeTruthy();
      expect(sentIdItems().map(String)).toEqual(['632', '633']); // MB1 first, then MB2
    });

    it("Sandalwood NOT active: 4 already equipped leaves the fifth slot to the list", async function() {
      MockHelper.mockSetting('plusEventMythic', 'false');
      MockHelper.mockSetting('plusEventMythicSandalWood', 'false');
      MockHelper.mockBoosterInventory({ mythic: ['MB3', 'MB4', 'MB5', 'MB10'] });
      sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_haveBooster", '{"MB2":1}');

      const result = await Booster.autoEquipMythicBoosters(['MB2']);

      expect(result).toBeTruthy();
      expect(Booster.getFreeMythicSlots()).toBe(0); // the fifth was just taken
      expect(sentIdItems()).toEqual(['633']);
    });

    it("Sandalwood active + MB1 not equipped: one slot stays reserved", async function() {
      MockHelper.mockSetting('plusEventMythic', 'true');
      MockHelper.mockSetting('plusEventMythicSandalWood', 'true');
      // 4 of 5 slots taken, MB1 not among them -> the last slot is reserved
      // for Sandalwood, so nothing from the list may be equipped.
      MockHelper.mockBoosterInventory({ mythic: ['MB3', 'MB4', 'MB5', 'MB10'] });
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", '{"MB2":1}');
      const result = await Booster.autoEquipMythicBoosters(['MB2']);
      expect(result).toBeFalsy();
      expect(ajaxSpy).not.toHaveBeenCalled();
    });

    it("stops equipping when the free slots run out", async function() {
      // 4 of 5 slots taken, no Sandalwood -> exactly one usable slot for two
      // owned codes: only the first is equipped.
      MockHelper.mockBoosterInventory({ mythic: ['MB3', 'MB4', 'MB5', 'MB10'] });
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", '{"MB9":1,"MB2":1}');
      const result = await Booster.autoEquipMythicBoosters(['MB9', 'MB2']);
      expect(result).toBeTruthy();
      expect(sentIdItems()).toEqual(['638']);
    });

    it("skips while the equip cooldown is armed", async function() {
      Booster.setEquipCooldown(300);
      const result = await Booster.autoEquipMythicBoosters(['MB9']);
      expect(result).toBeFalsy();
      expect(ajaxSpy).not.toHaveBeenCalled();
      clearTimer('nextBoosterEquipTime');
    });

    it("a bonus conflict skips only that booster: popup dismissed, remembered until the loadout changes", async function() {
      // Maintainer's real case: MB2 (All Mastery) equips fine; MB9 then
      // clashes with it (same in-game bonus) -> server refuses, the game
      // shows its conflict popup (no OK button, only the "X" close element).
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", '{"MB9":1,"MB2":1}');
      ajaxSpy.mockImplementation((params: { id_item: string }, successCb: (data: unknown) => void) => {
        if (params.id_item === '638') {
          document.body.innerHTML =
            `<div class="popup"><div class="text">You cannot equip this booster, it conflicts with another mythic booster already equipped.</div>`
            + `<close id="conflictClose" class="closable"></close></div>`;
          successCb({ success: false });
        } else {
          successCb({ success: true });
        }
      });
      safeReloadMock.mockClear();
      const result = await Booster.autoEquipMythicBoosters(['MB2', 'MB9']);

      expect(result).toBeTruthy();
      expect(sentIdItems()).toEqual(['633', '638']); // MB2 equipped, MB9 attempted
      // The popup cannot be closed programmatically -> the page is reloaded
      // once to clear it (at most once per loadout change).
      expect(safeReloadMock).toHaveBeenCalledTimes(1);
      expect(Booster.haveBoosterEquiped('MB2')).toBeTruthy();
      expect(Booster.haveBoosterEquiped('MB9')).toBeFalsy();
      document.body.innerHTML = "";

      // The refusal is remembered for the current loadout: another pass does
      // NOT re-attempt MB9 (no popup flashing / reload churn every cycle)...
      ajaxSpy.mockClear();
      safeReloadMock.mockClear();
      await Booster.autoEquipMythicBoosters(['MB2', 'MB9']);
      expect(sentIdItems()).toEqual([]); // MB2 equipped, MB9 conflict-remembered
      expect(safeReloadMock).not.toHaveBeenCalled(); // no repeated reloads
      // ...and the short re-check no longer counts MB9 as equippable.
      expect(Booster.hasEquippableMythicWanted(['MB2', 'MB9'])).toBeFalsy();

      // Once the equipped mythic loadout changes, MB9 is re-tried.
      MockHelper.mockBoosterInventory({ mythic: ['MB5'] });
      expect(Booster.isMythicConflictRemembered('MB9')).toBeFalsy(); // memory pruned
      ajaxSpy.mockClear();
      ajaxSpy.mockImplementation((_params: unknown, successCb: (data: unknown) => void) => {
        successCb({ success: true });
      });
      await Booster.autoEquipMythicBoosters(['MB9']);
      expect(sentIdItems()).toEqual(['638']); // re-attempted after loadout change
    });

    it("stops after MYTHIC_CONFLICTS_PER_PASS refusals instead of walking the whole list", async function() {
      const savedWait = Booster.MYTHIC_CONFLICT_POPUP_WAIT_MS;
      Booster.MYTHIC_CONFLICT_POPUP_WAIT_MS = 50;
      try {
        // Six owned codes, all refused. Without the cap every one of them would
        // cost a server request and a popup in a single pass -- which is what a
        // priority list longer than the five slots made possible.
        const codes = ['MB2', 'MB9', 'MB3', 'MB4', 'MB5', 'MB6'];
        setupBoosterIdMap(codes.map((id, i) => (
          { id_item: String(700 + i), identifier: id, name: id, rarity: 'mythic' })));
        sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_haveBooster",
          JSON.stringify(Object.fromEntries(codes.map(c => [c, 1]))));
        MockHelper.mockBoosterInventory({ mythic: [] });
        ajaxSpy.mockImplementation((_params: unknown, successCb: (data: unknown) => void) => {
          document.body.innerHTML =
            `<div class="popup"><div class="text">You cannot equip this booster, it conflicts with another mythic booster already equipped.</div></div>`;
          successCb({ success: false });
        });
        safeReloadMock.mockClear();

        await Booster.autoEquipMythicBoosters(codes);

        expect(sentIdItems()).toHaveLength(Booster.MYTHIC_CONFLICTS_PER_PASS);
        expect(safeReloadMock).toHaveBeenCalledTimes(1); // one reload, not one per refusal
        // Nothing is lost: the three refusals are remembered, so the next pass
        // starts at the fourth entry.
        expect(Booster.isMythicConflictRemembered('MB2')).toBeTruthy();
        expect(Booster.isMythicConflictRemembered('MB4')).toBeFalsy();
        document.body.innerHTML = "";
      } finally {
        Booster.MYTHIC_CONFLICT_POPUP_WAIT_MS = savedWait;
      }
    });

    it("an unknown equip failure (no conflict popup) still stops the pass", async function() {
      const savedWait = Booster.MYTHIC_CONFLICT_POPUP_WAIT_MS;
      Booster.MYTHIC_CONFLICT_POPUP_WAIT_MS = 50; // don't wait 2s in the test
      try {
        sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", '{"MB9":1,"MB2":1}');
        ajaxSpy.mockImplementation((params: { id_item: string }, successCb: (data: unknown) => void) => {
          successCb({ success: params.id_item !== '638' });
        });
        const result = await Booster.autoEquipMythicBoosters(['MB9', 'MB2']);
        expect(result).toBeFalsy();
        expect(sentIdItems()).toEqual(['638']); // stopped, MB2 not attempted
      } finally {
        Booster.MYTHIC_CONFLICT_POPUP_WAIT_MS = savedWait;
      }
    });
  });

  describe("applyMythicUsageDecrements (live usage tracking, issue 1781)", function() {
    function status(mythic: any[]) { return { mythic }; }
    const entry = (id: string, uses: number | undefined) => ({ item: { identifier: id }, usages_remaining: uses });

    it("burns league fights on MB8 and MB2, but not MB9", function() {
      const s = status([entry('MB8', 10), entry('MB2', 5), entry('MB9', 7)]);
      const changed = Booster.applyMythicUsageDecrements(s, { action: 'do_battles_leagues', number_of_battles: '3' });
      expect(changed).toBe(true);
      expect(s.mythic.map(b => b.usages_remaining)).toEqual([7, 2, 7]);
    });

    it("burns season fights on MB9, MB2 and MB5", function() {
      const s = status([entry('MB9', 7), entry('MB2', 5), entry('MB5', 4), entry('MB8', 10)]);
      Booster.applyMythicUsageDecrements(s, { action: 'do_battles_seasons', number_of_battles: '2' });
      expect(s.mythic.map(b => b.usages_remaining)).toEqual([5, 3, 2, 10]);
    });

    it("burns one Place-of-Power start on MB7", function() {
      const s = status([entry('MB7', 3)]);
      Booster.applyMythicUsageDecrements(s, { action: 'start', className: 'TempPlaceOfPower' });
      expect(s.mythic[0].usages_remaining).toBe(2);
    });

    it("never touches MB1 (shard-tracked) or unmapped boosters", function() {
      const s = status([entry('MB1', 9), entry('MB10', 9)]);
      const changed = Booster.applyMythicUsageDecrements(s, { action: 'do_battles_trolls', number_of_battles: '5' });
      expect(changed).toBe(false);
      expect(s.mythic.map(b => b.usages_remaining)).toEqual([9, 9]);
    });

    it("skips entries without a numeric counter and unparsable battle counts", function() {
      const s = status([entry('MB8', undefined), entry('MB8', 10)]);
      const changed = Booster.applyMythicUsageDecrements(s, { action: 'do_battles_leagues', number_of_battles: null });
      expect(changed).toBe(false);
      expect(s.mythic[1].usages_remaining).toBe(10);
    });

    it("an expired counter changes the loadout signature -> a remembered conflict clears", function() {
      // MB2 equipped -> MB8 conflict remembered against that loadout.
      MockHelper.mockBoosterInventory({ mythic: ['MB2'] });
      Booster.rememberMythicConflict('MB8');
      expect(Booster.isMythicConflictRemembered('MB8')).toBeTruthy();

      // Battles burn MB2 down to 0; the interceptor's filter drops it. Here we
      // mirror that end state in storage: MB2 gone.
      MockHelper.mockBoosterInventory({ mythic: [] });
      expect(Booster.isMythicConflictRemembered('MB8')).toBeFalsy(); // pruned -> MB8 re-tried
    });

    it("equipping ANOTHER booster does not clear a remembered conflict", function() {
      // The refusal means "MB8 clashes with something equipped right now".
      // Adding MB5 to a free slot cannot resolve that -- the clashing booster
      // is still on. Keying the memory on exact loadout equality used to prune
      // here, so MB8 was re-tried on the next cycle, refused again, and the
      // popup plus its page reload came back on every pass. With a longer
      // priority list each successful equip invalidated every conflict
      // remembered earlier in the same run, which is what made it look
      // permanent.
      MockHelper.mockBoosterInventory({ mythic: ['MB2'] });
      Booster.rememberMythicConflict('MB8');

      MockHelper.mockBoosterInventory({ mythic: ['MB2', 'MB5'] });
      expect(Booster.isMythicConflictRemembered('MB8')).toBeTruthy();
    });

    it("clears once the booster it clashed with is gone, even if others were added since", function() {
      MockHelper.mockBoosterInventory({ mythic: ['MB2'] });
      Booster.rememberMythicConflict('MB8');

      // MB2 expired, MB5 arrived: the recorded loadout is no longer contained
      // in the current one, so the refusal may no longer hold -> re-try.
      MockHelper.mockBoosterInventory({ mythic: ['MB5'] });
      expect(Booster.isMythicConflictRemembered('MB8')).toBeFalsy();
    });
  });

  describe("scheduleNextEquipCheck conflict cap (issue 1781)", function() {
    beforeEach(function() {
      clearTimer('nextAutoEquipBoosterTime');
      // Normal boosters with ~3h left -> the uncapped delay is hours.
      MockHelper.mockBoosterInventory({ normal: [{ identifier: 'B1', secondsLeft: 3 * 3600 }] });
    });
    afterEach(function() {
      clearTimer('nextAutoEquipBoosterTime');
    });

    it("caps at ~1h while a wanted mythic waits on a bonus conflict", function() {
      Booster.scheduleNextEquipCheck(false, true);
      const secondsLeft = getSecondsLeft('nextAutoEquipBoosterTime');
      expect(secondsLeft).toBeGreaterThan(0);
      expect(secondsLeft).toBeLessThanOrEqual(60 * 60);
    });

    it("keeps the full booster-runtime delay without a waiting conflict", function() {
      Booster.scheduleNextEquipCheck(false, false);
      expect(getSecondsLeft('nextAutoEquipBoosterTime')).toBeGreaterThan(60 * 60);
    });

    it("the short mythic re-check wins over the conflict cap", function() {
      Booster.scheduleNextEquipCheck(true, true);
      expect(getSecondsLeft('nextAutoEquipBoosterTime')).toBeLessThanOrEqual(8 * 60);
    });
  });

  describe("scheduleNextEquipCheck mythic short re-check (issue 1781)", function() {
    // The mythic slot is an independent goal: an empty slot must not wait for
    // the normal boosters to expire before it is re-checked. When
    // mythicRecheckSoon is true the delay is capped to the short window.
    beforeEach(function() {
      clearTimer('nextAutoEquipBoosterTime');
      // One normal booster with ~3h left, so the normal delay would be far
      // longer than the short mythic re-check window.
      MockHelper.mockBoosterInventory({ normal: [{ identifier: 'B1', secondsLeft: 3 * 3600 }] });
    });
    afterEach(function() {
      clearTimer('nextAutoEquipBoosterTime');
    });

    it("caps the next check to the short window when the mythic slot is still open", function() {
      Booster.scheduleNextEquipCheck(true);
      const secondsLeft = getSecondsLeft('nextAutoEquipBoosterTime');
      // Short window is 5-8 min; must be far below the ~3h normal delay.
      expect(secondsLeft).toBeGreaterThan(0);
      expect(secondsLeft).toBeLessThanOrEqual(8 * 60);
    });

    it("uses the full booster-runtime delay when the mythic slot is not open", function() {
      Booster.scheduleNextEquipCheck(false);
      const secondsLeft = getSecondsLeft('nextAutoEquipBoosterTime');
      // Normal delay = ~3h remaining + 15-45 min random, well over an hour.
      expect(secondsLeft).toBeGreaterThan(60 * 60);
    });

    it("never lengthens the delay: with no active boosters the cap still applies", function() {
      // No active normal boosters -> normal delay is just the 15-45 min random,
      // but the short re-check must still shorten it to <= 8 min.
      MockHelper.mockBoosterInventory({ normal: [] });
      Booster.scheduleNextEquipCheck(true);
      const secondsLeft = getSecondsLeft('nextAutoEquipBoosterTime');
      expect(secondsLeft).toBeGreaterThan(0);
      expect(secondsLeft).toBeLessThanOrEqual(8 * 60);
    });
  });

  describe("autoEquipBoosters equippable-mythic scheduling (issue 1781)", function() {
    // End-to-end: when a wanted mythic booster is still equippable (owned, not
    // equipped, usable free slot) but was not equipped this cycle (e.g. equip
    // cooldown), the next auto-equip check must be scheduled soon rather than
    // tied to the normal boosters' 3h runtime.
    const TEST_SEASON_MASTERY = {id_item: "638", identifier: "MB9", name: "Seasons mastery emblem", rarity: "mythic"};
    let scheduleSpy: jest.SpyInstance;

    beforeEach(function() {
      MockHelper.mockDomain();
      unsafeWindow.shared!.general!.hh_ajax = jest.fn((_p: unknown, cb: (d: unknown) => void) => cb({ success: true })) as (...args: unknown[]) => unknown;
      // Market data present + fresh, so autoEquipBoosters does not bail out to
      // the market-navigation guards.
      setupBoosterIdMap([TEST_GINSENG, TEST_SANDALWOOD, TEST_SEASON_MASTERY]);
      sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_haveBooster", '{"MB9":1}');
      sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_boosterStatusLastUpdate", String(Date.now()));
      // No mythic equipped, one normal booster with ~3h left.
      MockHelper.mockBoosterInventory({ normal: [{ identifier: 'B1', secondsLeft: 3 * 3600 }], mythic: [] });
      // Mythic wanted, normal-slot auto-equip off (mythic-only path).
      MockHelper.mockSetting('autoEquipMythicBooster', 'MB9');
      MockHelper.mockSetting('autoEquipBoosters', 'false');
      scheduleSpy = jest.spyOn(Booster, 'scheduleNextEquipCheck').mockImplementation(() => {});
    });
    afterEach(function() {
      scheduleSpy.mockRestore();
      clearTimer('nextBoosterEquipTime');
    });

    it("schedules a soon re-check when the wanted mythic is only blocked by the equip cooldown", async function() {
      Booster.setEquipCooldown(300); // equip on cooldown -> mythic not equipped this cycle
      await Booster.autoEquipBoosters();
      expect(scheduleSpy).toHaveBeenCalledWith(true, expect.any(Boolean));
    });

    it("does not shorten when the wanted booster is not in inventory", async function() {
      sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_haveBooster", '{}');
      await Booster.autoEquipBoosters();
      expect(scheduleSpy).toHaveBeenCalledWith(false, expect.any(Boolean));
    });

    it("does not shorten when all 5 mythic slots are taken", async function() {
      Booster.setEquipCooldown(300); // block the equip so only slot accounting decides
      MockHelper.mockBoosterInventory({ normal: [{ identifier: 'B1', secondsLeft: 3 * 3600 }], mythic: ['MB3', 'MB4', 'MB5', 'MB10', 'MB11'] });
      await Booster.autoEquipBoosters();
      expect(scheduleSpy).toHaveBeenCalledWith(false, expect.any(Boolean));
    });

    it("does not shorten when the only free slot is reserved for Sandalwood", async function() {
      MockHelper.mockSetting('plusEventMythic', 'true');
      MockHelper.mockSetting('plusEventMythicSandalWood', 'true');
      // 4 of 5 slots taken, MB1 not equipped -> last slot reserved for Sandalwood.
      MockHelper.mockBoosterInventory({ normal: [{ identifier: 'B1', secondsLeft: 3 * 3600 }], mythic: ['MB3', 'MB4', 'MB5', 'MB10'] });
      await Booster.autoEquipBoosters();
      expect(scheduleSpy).toHaveBeenCalledWith(false, expect.any(Boolean));
    });

    it("shortens under active Sandalwood when a free slot remains for the wanted booster", async function() {
      MockHelper.mockSetting('plusEventMythic', 'true');
      MockHelper.mockSetting('plusEventMythicSandalWood', 'true');
      Booster.setEquipCooldown(300); // equip blocked this cycle -> MB9 stays wanted
      // MB1 equipped by Sandalwood, plenty of free slots left for MB9.
      MockHelper.mockBoosterInventory({ normal: [{ identifier: 'B1', secondsLeft: 3 * 3600 }], mythic: ['MB1'] });
      await Booster.autoEquipBoosters();
      expect(scheduleSpy).toHaveBeenCalledWith(true, expect.any(Boolean));
    });

    it("does not shorten once every wanted mythic has just been equipped", async function() {
      // No cooldown: MB9 is owned and a slot is free, so it equips this
      // cycle -> nothing wanted remains -> normal (long) schedule.
      clearTimer('nextBoosterEquipTime');
      await Booster.autoEquipBoosters();
      expect(scheduleSpy).toHaveBeenCalledWith(false, expect.any(Boolean));
    });

    it("does not shorten when owned-but-wanted codes have no free slot left after the pass", async function() {
      // 4 of 5 slots taken, list has two owned codes: MB9 fills the last
      // slot, MB2 stays wanted but no usable slot remains -> long schedule.
      clearTimer('nextBoosterEquipTime');
      MockHelper.mockSetting('autoEquipMythicBooster', 'MB9;MB2');
      sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_haveBooster", '{"MB9":1,"MB2":1}');
      MockHelper.mockBoosterInventory({ normal: [{ identifier: 'B1', secondsLeft: 3 * 3600 }], mythic: ['MB3', 'MB4', 'MB5', 'MB10'] });
      await Booster.autoEquipBoosters();
      expect(scheduleSpy).toHaveBeenCalledWith(false, expect.any(Boolean));
    });
  });

});
