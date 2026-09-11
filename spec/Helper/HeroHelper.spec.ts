import { HeroHelper } from "../../src/Helper/HeroHelper";
import { setStoredValue } from "../../src/Helper/StorageHelper";
import { SK } from "../../src/config/StorageKeys";
import { Booster } from "../../src/Module/Booster";
import { HHStoredVarPrefixKey } from "../../src/config/HHStoredVars";
import { MockHelper } from "../testHelpers/MockHelpers";

// Test fixtures for the booster objects.
const TEST_GINSENG = {id_item: "316", identifier: "B1", name: "Ginseng root", rarity: "legendary"};
const TEST_SANDALWOOD = {id_item: "632", identifier: "MB1", name: "Sandalwood perfume", rarity: "mythic"};

describe("HeroHelper", function() {

  beforeEach(function() {

  });

  // The game does not serve a consistent hero snapshot: measured 2026-09-09,
  // two page loads six seconds apart carried level 36 and level 17. Every
  // getLevel() >= LEVEL_MIN_* gate reads this, so a stale-low value silently
  // switches off Path of Valor, Path of Glory and League.
  describe("getLevel keeps the highest level it has seen", function() {
    const KEY = HHStoredVarPrefixKey + "Temp_heroMaxLevel";

    beforeEach(function() {
      localStorage.removeItem(KEY);
      unsafeWindow.shared!.Hero = { infos: { level: 36 } } as never;
    });

    afterEach(function() {
      localStorage.removeItem(KEY);
    });

    it("returns the live level and remembers it", function() {
      expect(HeroHelper.getLevel()).toBe(36);
      expect(localStorage.getItem(KEY)).toBe("36");
    });

    it("ignores a page that serves a lower level", function() {
      expect(HeroHelper.getLevel()).toBe(36);

      unsafeWindow.shared!.Hero = { infos: { level: 17 } } as never;

      expect(HeroHelper.getLevel()).toBe(36);
      expect(localStorage.getItem(KEY)).toBe("36");
    });

    it("follows a real level-up upwards", function() {
      HeroHelper.getLevel();
      unsafeWindow.shared!.Hero = { infos: { level: 37 } } as never;

      expect(HeroHelper.getLevel()).toBe(37);
      expect(localStorage.getItem(KEY)).toBe("37");
    });

    it("returns the live level when nothing has been remembered", function() {
      unsafeWindow.shared!.Hero = { infos: { level: 3 } } as never;

      expect(HeroHelper.getLevel()).toBe(3);
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
      expect(HeroHelper.haveBoosterInInventory('B1')).toBeFalsy();
      expect(HeroHelper.haveBoosterInInventory('MB1')).toBeFalsy();
    });

    it("Have sandalwood", function() {
      const boosters = '{"B1":0,"B2":0,"B3":0,"B4":0,"MB1":1,"MB2":0,"MB3":0,"MB4":0}';
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", boosters);
      expect(HeroHelper.haveBoosterInInventory('XX')).toBeFalsy();
      expect(HeroHelper.haveBoosterInInventory('B1')).toBeFalsy();
      expect(HeroHelper.haveBoosterInInventory('MB1')).toBeTruthy();
    });

    it("Have Ginsend", function() {
        const boosters = '{"B1":1,"B2":0,"B3":0,"B4":0,"MB1":0,"MB2":0,"MB3":0,"MB4":0}';
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", boosters);
      expect(HeroHelper.haveBoosterInInventory('XX')).toBeFalsy();
      expect(HeroHelper.haveBoosterInInventory('B1')).toBeTruthy();
      expect(HeroHelper.haveBoosterInInventory('MB1')).toBeFalsy();
    });

    it("Have many", function() {
      const boosters = '{"B1":123,"B2":123,"B3":123,"B4":123,"MB1":123,"MB2":123,"MB3":123,"MB4":123}';
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", boosters);
      expect(HeroHelper.haveBoosterInInventory('XX')).toBeFalsy();
      expect(HeroHelper.haveBoosterInInventory('B1')).toBeTruthy();
      expect(HeroHelper.haveBoosterInInventory('MB1')).toBeTruthy();
    });
  });

  describe("equipBooster", function() {
    beforeEach(() => {
      MockHelper.mockDomain();
        unsafeWindow.shared!.general!.hh_ajax = jest.fn();
        sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", '{}');
        sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_sandalwoodFailure", '0');
    });

    // Fixed mock: hh_ajax(params, successCb, errorCb) must invoke the callback
    function mockEquipeResponse(success:boolean) {
      unsafeWindow.shared!.general!.hh_ajax = jest.fn((params: any, successCb: any, errorCb: any) => {
            const fakeResponse = {
                success: success
            };
            successCb(fakeResponse);
        });
    }

    function mockEquipeError() {
      unsafeWindow.shared!.general!.hh_ajax = jest.fn((params: any, successCb: any, errorCb: any) => {
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
      const result1 = await HeroHelper.equipBooster(TEST_GINSENG);
      expect(result1).toBeFalsy();
      const result2 = await HeroHelper.equipBooster(TEST_SANDALWOOD);
      expect(result2).toBeFalsy();
    });

    it("Have booster in inventory and success", async function() {
        mockEquipeResponse(true);
      const boosters = '{"B1":10,"B2":0,"B3":0,"B4":0,"MB1":10,"MB2":0,"MB3":0,"MB4":0}';
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", boosters);
      const result1 = await HeroHelper.equipBooster(TEST_GINSENG);
      expect(result1).toBeTruthy();
      // Failure counter should NOT increase on success
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(0);
    });

    it("Have booster in inventory and server returns failure", async function() {
        mockEquipeResponse(false);
      const boosters = '{"B1":10,"B2":0,"B3":0,"B4":0,"MB1":10,"MB2":0,"MB3":0,"MB4":0}';
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", boosters);
      const result1 = await HeroHelper.equipBooster(TEST_SANDALWOOD);
      expect(result1).toBeFalsy();
      // Failure counter should increase
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(1);
    });

    it("AJAX network error returns false", async function() {
        mockEquipeError();
      const boosters = '{"B1":10,"B2":0,"B3":0,"B4":0,"MB1":10,"MB2":0,"MB3":0,"MB4":0}';
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", boosters);
      const result = await HeroHelper.equipBooster(TEST_SANDALWOOD);
      expect(result).toBeFalsy();
      // Failure counter should increase on AJAX error too
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(1);
    });

    // Three counted failures switch the user's Sandalwood setting off, so only
    // a refused Sandalwood may count -- a mythic-list entry the game rejects as
    // conflicting must not disable an unrelated setting (issue #1874).
    it("a failure on another booster leaves the Sandalwood counter alone", async function() {
        mockEquipeResponse(false);
      const boosters = '{"B1":10,"B2":0,"B3":0,"B4":0,"MB1":10,"MB2":0,"MB3":0,"MB4":0}';
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", boosters);

      const result = await HeroHelper.equipBooster(TEST_GINSENG);

      expect(result).toBeFalsy();
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(0);
    });

    it("an AJAX error on another booster leaves the Sandalwood counter alone", async function() {
        mockEquipeError();
      const boosters = '{"B1":10,"B2":0,"B3":0,"B4":0,"MB1":10,"MB2":0,"MB3":0,"MB4":0}';
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", boosters);

      await HeroHelper.equipBooster(TEST_GINSENG);

      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(0);
    });

    it("Multiple failures increment counter", async function() {
        mockEquipeResponse(false);
      const boosters = '{"B1":10,"B2":0,"B3":0,"B4":0,"MB1":10,"MB2":0,"MB3":0,"MB4":0}';
      sessionStorage.setItem(HHStoredVarPrefixKey+"Temp_haveBooster", boosters);
      await HeroHelper.equipBooster(TEST_SANDALWOOD);
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(1);
      await HeroHelper.equipBooster(TEST_SANDALWOOD);
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(2);
      await HeroHelper.equipBooster(TEST_SANDALWOOD);
      expect(HeroHelper.getSandalWoodEquipFailure()).toBe(3);
    });

    // The "hh_ajax is called with correct params" test that stood here
    // pinned action/id_item/type against a copy of the call it was
    // asserting. Whether the game accepts that payload is checked in
    // scripts/live-check (spec triage 2026-08).
  });

  describe("doStatUpgrades loop guard (issue #1735)", function() {
    async function loadDoStatUpgrades() {
      jest.resetModules();
      const mod = await import("../../src/Helper/HeroHelper");
      return mod.doStatUpgrades;
    }

    function setupHero() {
      // class 3 -> main stat carac3; carac1/2 already at the limit so only
      // carac3 is bought first deterministically. Limit = level*30 = 30000.
      const Hero: any = {
        infos: { class: 3, level: 1000, carac1: 29999, carac2: 29999, carac3: 100 },
        currencies: { soft_currency: 1e12 },
        update: jest.fn(),
      };
      unsafeWindow.shared!.Hero = Hero;
      setStoredValue(HHStoredVarPrefixKey + SK.autoStats, "0");
      return Hero;
    }

    /** hh_ajax stand-in that answers every buy with `data`. */
    function answering(data: object) {
      return jest.fn((...args: unknown[]) => (args[1] as (d: object) => void)(data));
    }
    const nbOf = (ajax: jest.Mock, call: number) => (ajax.mock.calls[call][0] as { nb: number }).nb;

    beforeEach(() => {
      MockHelper.mockDomain();
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
      localStorage.clear();
      sessionStorage.clear();
    });

    it("stops when a stat buy is never confirmed", async function() {
      setupHero();
      // No answer at all -- the issue-1735 condition (level-up reward screen).
      const ajax = jest.fn();
      unsafeWindow.shared!.general!.hh_ajax = ajax;

      const doStatUpgrades = await loadDoStatUpgrades();
      doStatUpgrades(); // first buy issued
      doStatUpgrades(); // nothing confirmed -> no-progress guard stops, no second buy
      expect(ajax).toHaveBeenCalledTimes(1);
    });

    it("stops after a buy the game refuses", async function() {
      setupHero();
      const ajax = answering({ success: false });
      unsafeWindow.shared!.general!.hh_ajax = ajax;

      const doStatUpgrades = await loadDoStatUpgrades();
      doStatUpgrades();
      doStatUpgrades();
      expect(ajax).toHaveBeenCalledTimes(1);
    });

    it("keeps buying after a confirmed buy although the game leaves shared.Hero as it was", async function() {
      // Measured 2026-09-11 on /waifu.html: success, money charged,
      // shared.Hero.infos.carac3 unchanged until the page was reloaded. The
      // old guard read that as "did not advance" after every single buy.
      const Hero = setupHero();
      const ajax = answering({ success: true });
      unsafeWindow.shared!.general!.hh_ajax = ajax;

      const doStatUpgrades = await loadDoStatUpgrades();
      doStatUpgrades();
      doStatUpgrades();
      expect(ajax).toHaveBeenCalledTimes(2);
      expect(Hero.infos.carac3).toBe(100 + nbOf(ajax, 0) + nbOf(ajax, 1));
    });

    it("takes the stat cap from the game's answer once it has one", async function() {
      // Cap = base stat + 30 per level (measured 575 + 30 x 115 = 4025); level * 30 alone is too low.
      const Hero = setupHero();
      Object.assign(Hero.infos, { level: 10, carac1: 0, carac2: 0, carac3: 250 });
      const ajax = answering({ success: true, statsPrices: { max: 400 } });
      unsafeWindow.shared!.general!.hh_ajax = ajax;

      const doStatUpgrades = await loadDoStatUpgrades();
      doStatUpgrades(); // level * 30 = 300: +60 would pass it, +30 does not
      doStatUpgrades(); // the answer said 400: +60 fits now
      expect(nbOf(ajax, 0)).toBe(30);
      expect(nbOf(ajax, 1)).toBe(60);
    });

    it("takes the balance from the game's answer and stops when it is spent", async function() {
      // Measured 2026-09-11: the local balance stayed at 31809 over three buys
      // while the answers said 22708, 13603, 4494; the fourth buy went out
      // without the money for it.
      const Hero = setupHero();
      const ajax = answering({ success: true, currency: { soft_currency: 0 } });
      unsafeWindow.shared!.general!.hh_ajax = ajax;

      const doStatUpgrades = await loadDoStatUpgrades();
      doStatUpgrades();
      doStatUpgrades();
      expect(ajax).toHaveBeenCalledTimes(1);
      expect(Hero.currencies.soft_currency).toBe(0);
    });

    it("counts the price down itself when the answer names no balance", async function() {
      const Hero = setupHero();
      const ajax = answering({ success: true });
      unsafeWindow.shared!.general!.hh_ajax = ajax;

      const doStatUpgrades = await loadDoStatUpgrades();
      doStatUpgrades();
      expect(Hero.currencies.soft_currency).toBeLessThan(1e12);
    });

    it("prices each point at the level it reaches (measured 2026-09-11)", async function() {
      jest.resetModules();
      const { statBuyPrice } = await import("../../src/Helper/HeroHelper");
      expect(statBuyPrice(2541, 1)).toBe(6173); // what 2541 -> 2542 cost
      expect(statBuyPrice(2542, 1)).toBe(6177); // what the answer quoted for the next point
      expect(statBuyPrice(2541, 2)).toBe(6173 + 6177);
    });

    it("keeps buying while the stat actually advances", async function() {
      const Hero = setupHero();
      // ajax applies the buy so the next read advances -> guard must not trip.
      const ajax = jest.fn((params: any, cb: any) => {
        Hero.infos["carac" + params.carac.slice(-1)] += params.nb;
        cb({ success: true });
      });
      unsafeWindow.shared!.general!.hh_ajax = ajax;

      const doStatUpgrades = await loadDoStatUpgrades();
      doStatUpgrades();
      doStatUpgrades();
      expect(ajax).toHaveBeenCalledTimes(2);
    });
  });

});
