import {
  Pachinko,
  setPachinkoAutoLoopKick
} from '../../src/Module/Pachinko';
import { ConfigHelper } from '../../src/Helper/ConfigHelper';
import { RewardHelper } from '../../src/Helper/RewardHelper';
import { TimeHelper } from '../../src/Helper/TimeHelper';
import { getStoredValue, setStoredValue } from '../../src/Helper/StorageHelper';
import { HHStoredVarPrefixKey } from '../../src/config/HHStoredVars';
import { TK } from '../../src/config/StorageKeys';
import { gotoPage } from '../../src/Service/PageNavigationService';
import { MockHelper } from '../testHelpers/MockHelpers';

// Mock navigation so off-page handling does not touch window.location.
jest.mock('../../src/Service/PageNavigationService', () => ({
  gotoPage: jest.fn().mockReturnValue(true),
  safeReload: jest.fn(),
  safeNavigateHref: jest.fn(),
  addNutakuSession: jest.fn((x: unknown) => x),
}));

const gotoPageMock = gotoPage as jest.Mock;

describe("Pachinko", function() {
  describe("getHumanPachinkoFromOrbName", function() {
    it("default", function() {
      expect(Pachinko.getHumanPachinkoFromOrbName(null as any)).toBe('Unknown');
      expect(Pachinko.getHumanPachinkoFromOrbName(undefined as any)).toBe('Unknown');
      expect(Pachinko.getHumanPachinkoFromOrbName('')).toBe('Unknown');
    });
    it("Unknown", function() {
      expect(Pachinko.getHumanPachinkoFromOrbName('o_xx')).toBe('Unknown');
      expect(Pachinko.getHumanPachinkoFromOrbName('o_x10')).toBe('Unknown');
      expect(Pachinko.getHumanPachinkoFromOrbName('ANY')).toBe('Unknown');
    });
    it("Event Pachinko", function () {
      expect(Pachinko.getHumanPachinkoFromOrbName('o_v4')).toBe('4');
    });
    it("Epic Pachinko", function () {
      expect(Pachinko.getHumanPachinkoFromOrbName('o_e1')).toBe('1');
      expect(Pachinko.getHumanPachinkoFromOrbName('o_e10')).toBe('10');
      expect(Pachinko.getHumanPachinkoFromOrbName('o_ed')).toBe('Draft');
    });
    it("Mythic Pachinko", function () {
      expect(Pachinko.getHumanPachinkoFromOrbName('o_m1')).toBe('1');
      expect(Pachinko.getHumanPachinkoFromOrbName('o_m3')).toBe('3');
      expect(Pachinko.getHumanPachinkoFromOrbName('o_m6')).toBe('6');
    });
    it("Equipment Pachinko", function () {
      expect(Pachinko.getHumanPachinkoFromOrbName('o_eq1')).toBe('1');
      expect(Pachinko.getHumanPachinkoFromOrbName('o_eq2')).toBe('2');
      expect(Pachinko.getHumanPachinkoFromOrbName('o_eq10')).toBe('10');
    });
    it("Great Pachinko", function () {
      expect(Pachinko.getHumanPachinkoFromOrbName('o_g1')).toBe('1');
      expect(Pachinko.getHumanPachinkoFromOrbName('o_g10')).toBe('10');
    });
  });

  describe("resolveStopOrbsLeft", function() {
    it("prefers the server count when it is a valid number", function() {
      // Server is authoritative even when the DOM lags behind (issue 1745).
      expect(Pachinko.resolveStopOrbsLeft(104, 109)).toBe(104);
    });
    it("accepts zero from the server", function() {
      expect(Pachinko.resolveStopOrbsLeft(0, 5)).toBe(0);
    });
    it("falls back to the DOM when the server count is undefined", function() {
      // First tick of a run, before any play-response has arrived.
      expect(Pachinko.resolveStopOrbsLeft(undefined, 123)).toBe(123);
    });
    it("falls back to the DOM when the server count is negative", function() {
      expect(Pachinko.resolveStopOrbsLeft(-1, 42)).toBe(42);
    });
  });

  describe("shouldContinuePachinkoRun", function() {
    // spent = orbLeftOnAutoStart - currentOrbsLeft. Continue only while
    // spent < orbsToGo AND orbs remain. Guards the issue-1745 over-consumption
    // boundary: the run must stop the moment the target is reached.
    it("continues while fewer than the target orbs have been spent", function() {
      // start 100, 95 left -> spent 5 < target 10, orbs remain.
      expect(Pachinko.shouldContinuePachinkoRun(100, 95, 10)).toBe(true);
    });
    it("continues on the very first pull (nothing spent yet)", function() {
      expect(Pachinko.shouldContinuePachinkoRun(10, 10, 5)).toBe(true);
    });
    it("stops exactly when the target is reached (issue 1745 boundary)", function() {
      // start 100, 90 left -> spent 10 == target 10 -> stop, do not over-pull.
      expect(Pachinko.shouldContinuePachinkoRun(100, 90, 10)).toBe(false);
    });
    it("stops once spending has passed the target", function() {
      expect(Pachinko.shouldContinuePachinkoRun(100, 89, 10)).toBe(false);
    });
    it("stops when no orbs remain even if the target was not reached", function() {
      expect(Pachinko.shouldContinuePachinkoRun(100, 0, 50)).toBe(false);
    });
  });
  describe("cancelXPachinkoRun", function() {
    beforeEach(() => {
      jest.useFakeTimers();
      localStorage.clear();
      sessionStorage.clear();
      document.body.innerHTML = "";
    });
    afterEach(() => {
      setPachinkoAutoLoopKick(null);
      jest.useRealTimers();
      jest.restoreAllMocks();
      localStorage.clear();
      sessionStorage.clear();
    });

    it("re-enables autoLoop and kicks the loop when an X-run is cancelled", function() {
      const kick = jest.fn();
      setPachinkoAutoLoopKick(kick);
      // Simulate a running X-run: pachinkoPlayXTimes had disabled autoLoop.
      setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
      Pachinko.autoPachinkoRunning = true;

      Pachinko.cancelXPachinkoRun();

      expect(Pachinko.autoPachinkoRunning).toBe(false);
      expect(getStoredValue(HHStoredVarPrefixKey + TK.autoLoop)).toBe("true");
      expect(kick).not.toHaveBeenCalled();

      jest.runAllTimers();
      expect(kick).toHaveBeenCalledTimes(1);
    });
  });

  describe("getFreePachinko autoLoop kick (LV-1)", function() {
    const PACHINKO_PAGE = ConfigHelper.getHHScriptVars("pagesIDPachinko");

    // Minimal pachinko-screen DOM. The free button presence toggles the
    // pull-vs-"Not ready yet" path; the timer span feeds setTimer.
    function renderPachinko(opts: { freeButton: boolean }) {
      const freeBtn = opts.freeButton
        ? '<button data-free="true" class="blue_button_L">Free</button>'
        : '';
      document.body.innerHTML =
        `<!DOCTYPE html><div id="hh_hentai" page="${PACHINKO_PAGE}">` +
        `<div id="pachinko_whole"><div class="playing-zone" type-panel="mythic"></div></div>` +
        `<div class="game-simple-block" type-pachinko="mythic"></div>` +
        `<div id="playzone-replace-info">${freeBtn}</div>` +
        `<div class="mythic-timer"><span rel="expires">23:28:02</span></div>` +
        `</div>`;
    }

    beforeEach(() => {
      MockHelper.mockDomain("www.hentaiheroes.com");
      jest.useFakeTimers();
      // getFreePachinko awaits sleep(); resolve it instantly so the async flow
      // does not hang on fake timers. Only the final kick setTimeout is a timer.
      jest.spyOn(TimeHelper, "sleep").mockResolvedValue(undefined as never);
      jest.spyOn(RewardHelper, "closeRewardPopupIfAny").mockImplementation((() => {}) as never);
      gotoPageMock.mockClear();
    });

    afterEach(() => {
      setPachinkoAutoLoopKick(null);
      jest.useRealTimers();
      jest.restoreAllMocks();
      localStorage.clear();
      sessionStorage.clear();
      document.body.innerHTML = "";
    });

    it("pulls the free pachinko and revives autoLoop via the decoupled kick", async function() {
      renderPachinko({ freeButton: true });
      const kick = jest.fn();
      setPachinkoAutoLoopKick(kick);

      const ret = await Pachinko.getFreePachinko("mythic", "nextPachinko2Time", "mythic-timer");

      expect(ret).toBe(true);
      // During the run autoLoop is paused; the revive runs in a setTimeout.
      expect(getStoredValue(HHStoredVarPrefixKey + TK.autoLoop)).toBe("false");
      expect(kick).not.toHaveBeenCalled();

      jest.runAllTimers();

      expect(getStoredValue(HHStoredVarPrefixKey + TK.autoLoop)).toBe("true");
      expect(kick).toHaveBeenCalledTimes(1);
    });

    it("still revives autoLoop when no free button is present (Not ready yet)", async function() {
      renderPachinko({ freeButton: false });
      const kick = jest.fn();
      setPachinkoAutoLoopKick(kick);

      const ret = await Pachinko.getFreePachinko("mythic", "nextPachinko2Time", "mythic-timer");

      expect(ret).toBe(true);
      jest.runAllTimers();

      expect(getStoredValue(HHStoredVarPrefixKey + TK.autoLoop)).toBe("true");
      expect(kick).toHaveBeenCalledTimes(1);
    });

    it("navigates to the pachinko page and returns true when off-page", async function() {
      document.body.innerHTML = `<!DOCTYPE html><div id="hh_hentai" page="home"><p>home</p></div>`;
      const kick = jest.fn();
      setPachinkoAutoLoopKick(kick);

      const ret = await Pachinko.getFreePachinko("mythic", "nextPachinko2Time", "mythic-timer");

      expect(ret).toBe(true);
      expect(gotoPageMock).toHaveBeenCalledWith(PACHINKO_PAGE);
      jest.runAllTimers();
      // Off-page path returns before scheduling the kick.
      expect(kick).not.toHaveBeenCalled();
    });
  });
});