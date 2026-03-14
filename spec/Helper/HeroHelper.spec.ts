import { HeroHelper, getHero } from "../../src/Helper/HeroHelper";
import { Booster } from "../../src/Module/Booster";
import { HHStoredVarPrefixKey } from "../../src/config/HHStoredVars";
import { MockHelper } from "../testHelpers/MockHelpers";

describe("HeroHelper", function() {

  beforeEach(function() {
    
  });

  describe("getHero", function() {
    it("No Hero", function() {
      expect(getHero()).toBeUndefined();
    });
    it("Test with string", function() {
        unsafeWindow.shared.Hero = "TOTO";
      expect(getHero()).toBe("TOTO");
    });
    it("Test with object", function() {
        unsafeWindow.shared.Hero = {
            name:"TOTO"
        };
      expect(getHero()).toBeDefined();
      expect(getHero().name).toBe("TOTO");
    });
  });

  describe("getSandalWoodEquipFailure", function() {
    it("default", function() {
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(0);
    });

    it("wrong stored value", function() {
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_sandalwoodFailure", '');
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(0);
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_sandalwoodFailure", 'null');
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(0);
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_sandalwoodFailure", 'undefined');
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(0);
    });

    it("wrong stored value and increase", function() {
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_sandalwoodFailure", '');
      expect(HeroHelper.getSandalWoodEquipFailure(true)).toBe(1);
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_sandalwoodFailure", 'null');
      expect(HeroHelper.getSandalWoodEquipFailure(true)).toBe(1);
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_sandalwoodFailure", 'undefined');
      expect(HeroHelper.getSandalWoodEquipFailure(true)).toBe(1);
    });

    it("Number stored value", function() {
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_sandalwoodFailure", '1');
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(1);
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_sandalwoodFailure", '999');
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(999);
    });

    it("Number stored value and increase", function() {
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_sandalwoodFailure", '1');
      expect(HeroHelper.getSandalWoodEquipFailure(true)).toBe(2);
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_sandalwoodFailure", '999');
      expect(HeroHelper.getSandalWoodEquipFailure(true)).toBe(1000);
    });
  });

  describe("haveBoosterInInventory", function() {
    it("default", function() {
      expect(HeroHelper.haveBoosterInInventory('XX')).toBeFalsy();
      expect(HeroHelper.haveBoosterInInventory(Booster.GINSENG_ROOT.identifier)).toBeFalsy();
      expect(HeroHelper.haveBoosterInInventory(Booster.SANDALWOOD_PERFUME.identifier)).toBeFalsy();
    });

    it("Have sandalwood", function() {
      const boosters = '{"B1":0,"B2":0,"B3":0,"B4":0,"MB1":1,"MB2":0,"MB3":0,"MB4":0}';
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", boosters);
      expect(HeroHelper.haveBoosterInInventory('XX')).toBeFalsy();
      expect(HeroHelper.haveBoosterInInventory(Booster.GINSENG_ROOT.identifier)).toBeFalsy();
      expect(HeroHelper.haveBoosterInInventory(Booster.SANDALWOOD_PERFUME.identifier)).toBeTruthy();
    });

    it("Have Ginsend", function() {
        const boosters = '{"B1":1,"B2":0,"B3":0,"B4":0,"MB1":0,"MB2":0,"MB3":0,"MB4":0}';
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", boosters);
      expect(HeroHelper.haveBoosterInInventory('XX')).toBeFalsy();
      expect(HeroHelper.haveBoosterInInventory(Booster.GINSENG_ROOT.identifier)).toBeTruthy();
      expect(HeroHelper.haveBoosterInInventory(Booster.SANDALWOOD_PERFUME.identifier)).toBeFalsy();
    });

    it("Have many", function() {
      const boosters = '{"B1":123,"B2":123,"B3":123,"B4":123,"MB1":123,"MB2":123,"MB3":123,"MB4":123}';
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", boosters);
      expect(HeroHelper.haveBoosterInInventory('XX')).toBeFalsy();
      expect(HeroHelper.haveBoosterInInventory(Booster.GINSENG_ROOT.identifier)).toBeTruthy();
      expect(HeroHelper.haveBoosterInInventory(Booster.SANDALWOOD_PERFUME.identifier)).toBeTruthy();
    });
  });

  describe("equipBooster", function() {
    beforeEach(() => {
      MockHelper.mockDomain();
        unsafeWindow.shared.general.hh_ajax = jest.fn();
        sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", '{}');
        sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_sandalwoodFailure", '0');
    });

    // Fixed mock: hh_ajax(params, successCb, errorCb) must invoke the callback
    function mockEquipeResponse(success:boolean) {
      unsafeWindow.shared.general.hh_ajax = jest.fn((params, successCb, errorCb) => {
            const fakeResponse = {
                success: success
            };
            successCb(fakeResponse);
        });
    }

    function mockEquipeError() {
      unsafeWindow.shared.general.hh_ajax = jest.fn((params, successCb, errorCb) => {
            errorCb(new Error('AJAX network error'));
        });
    }

    it("default", async function() {
      const result1 = await HeroHelper.equipBooster(null);
      expect(result1).toBeFalsy();
      const result2 = await HeroHelper.equipBooster({});
      expect(result2).toBeFalsy();
    });

    it("No booster in inventory", async function() {
      const result1 = await HeroHelper.equipBooster(Booster.GINSENG_ROOT);
      expect(result1).toBeFalsy();
      const result2 = await HeroHelper.equipBooster(Booster.SANDALWOOD_PERFUME);
      expect(result2).toBeFalsy();
    });

    it("Have booster in inventory and success", async function() {
        mockEquipeResponse(true);
      const boosters = '{"B1":10,"B2":0,"B3":0,"B4":0,"MB1":10,"MB2":0,"MB3":0,"MB4":0}';
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", boosters);
      const result1 = await HeroHelper.equipBooster(Booster.GINSENG_ROOT);
      expect(result1).toBeTruthy();
      // Failure counter should NOT increase on success
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(0);
    });

    it("Have booster in inventory and server returns failure", async function() {
        mockEquipeResponse(false);
      const boosters = '{"B1":10,"B2":0,"B3":0,"B4":0,"MB1":10,"MB2":0,"MB3":0,"MB4":0}';
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", boosters);
      const result1 = await HeroHelper.equipBooster(Booster.GINSENG_ROOT);
      expect(result1).toBeFalsy();
      // Failure counter should increase
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(1);
    });

    it("AJAX network error returns false", async function() {
        mockEquipeError();
      const boosters = '{"B1":10,"B2":0,"B3":0,"B4":0,"MB1":10,"MB2":0,"MB3":0,"MB4":0}';
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", boosters);
      const result = await HeroHelper.equipBooster(Booster.GINSENG_ROOT);
      expect(result).toBeFalsy();
      // Failure counter should increase on AJAX error too
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(1);
    });

    it("Multiple failures increment counter", async function() {
        mockEquipeResponse(false);
      const boosters = '{"B1":10,"B2":0,"B3":0,"B4":0,"MB1":10,"MB2":0,"MB3":0,"MB4":0}';
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", boosters);
      await HeroHelper.equipBooster(Booster.SANDALWOOD_PERFUME);
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(1);
      await HeroHelper.equipBooster(Booster.SANDALWOOD_PERFUME);
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(2);
      await HeroHelper.equipBooster(Booster.SANDALWOOD_PERFUME);
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(3);
    });

    it("hh_ajax is called with correct params", async function() {
        mockEquipeResponse(true);
      const boosters = '{"B1":10,"B2":0,"B3":0,"B4":0,"MB1":10,"MB2":0,"MB3":0,"MB4":0}';
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", boosters);
      await HeroHelper.equipBooster(Booster.SANDALWOOD_PERFUME);
      expect(unsafeWindow.shared.general.hh_ajax).toHaveBeenCalledWith(
        {action: "market_equip_booster", id_item: 632, type: "booster"},
        expect.any(Function),
        expect.any(Function)
      );
    });
  });
});