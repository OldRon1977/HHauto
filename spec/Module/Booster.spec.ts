import {
    Booster
} from '../../src/Module/Booster'
import { HeroHelper } from '../../src/Helper/HeroHelper'
import { HHStoredVarPrefixKey } from '../../src/config/HHStoredVars';
import { Timers, setTimer, checkTimer } from '../../src/Helper/TimerHelper';
import { MockHelper } from "../testHelpers/MockHelpers";

// Test fixtures — booster objects are no longer hardcoded statics on Booster class
const TEST_GINSENG = {id_item: "316", identifier: "B1", name: "Ginseng root", rarity: "legendary"};
const TEST_SANDALWOOD = {id_item: "632", identifier: "MB1", name: "Sandalwood perfume", rarity: "mythic"};

/** Sets up boosterIdMap in sessionStorage so getBoosterByIdentifier can resolve boosters */
function setupBoosterIdMap(boosters: any[] = [TEST_GINSENG, TEST_SANDALWOOD]) {
    const map = {};
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

  describe("equipeSandalWoodIfNeeded", function() {

    beforeEach(function() {
      MockHelper.mockDomain();
      // Fixed mock: hh_ajax(params, successCb, errorCb) must invoke the callback
      unsafeWindow.shared.general.hh_ajax = jest.fn((params, successCb, errorCb) => {
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
        unsafeWindow.shared.general.hh_ajax = jest.fn((params, successCb, errorCb) => {
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
        expect(unsafeWindow.shared.general.hh_ajax).not.toHaveBeenCalled();
      });
    });
  });

});
