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
import { gotoPage, safeReload } from '../../src/Service/PageNavigationService';
import { fillHHPopUp } from '../../src/Utils/HHPopup';
import { setMenuPorts } from '../../src/Helper/menu/MenuPorts';
import { MockHelper } from '../testHelpers/MockHelpers';
import { buildTestPorts } from '../Helper/menu/menuTestPorts';

// Mock navigation so off-page handling does not touch window.location.
jest.mock('../../src/Service/PageNavigationService', () => ({
  gotoPage: jest.fn().mockReturnValue(true),
  safeReload: jest.fn(),
  safeNavigateHref: jest.fn(),
  addNutakuSession: jest.fn((x: unknown) => x),
}));

const gotoPageMock = gotoPage as jest.Mock;
const safeReloadMock = safeReload as jest.Mock;

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
    // The prefix table (o_v / o_e / o_m / o_eq / o_g -> display name) was
    // removed in the spec triage (2026-08): the orb names are the game's,
    // and the test asserted them against the same table src/Module/Pachinko.ts
    // defines. Checked in scripts/live-check instead. The two fallback cases
    // above are ours and stay.
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

  describe("playXPachinko_func run-finished reload (issue 1799)", function() {
    // After a full auto-pachinko run, the played-games grid on the pachinko
    // page can stay out of sync with the server (games that were actually
    // played still render as playable until an F5). The run-finished branch
    // now issues a single safeReload() to clear that stale DOM, without
    // touching the issue-1745 orb bookkeeping (serverOrbsLeft / retry).
    const PACHINKO_PAGE = ConfigHelper.getHHScriptVars("pagesIDPachinko");
    const ORB_NAME = "o_m1";

    // Builds the minimal DOM for an in-progress X-run: the game's own orb
    // button/counter, and the HHAuto popup shown while playXPachinko_func is
    // polling (created lazily by fillHHPopUp, exactly like pachinkoPlayXTimes
    // does before it first schedules playXPachinko_func).
    function renderRunInProgress(domOrbsLeft: number) {
      document.body.innerHTML =
        `<!DOCTYPE html><div id="hh_hentai" page="${PACHINKO_PAGE}">` +
        `<div class="playing-zone"><div class="btns-section">` +
        `<button class="blue_button_L" orb_name="${ORB_NAME}"><span total_orbs>${domOrbsLeft}</span></button>` +
        `</div></div></div>`;

      fillHHPopUp("PachinkoPlay", "Pachinko", '<p id="PachinkoPlayedTimes">0/0</p>');

      const select = document.createElement('select');
      const option = document.createElement('option');
      option.value = ORB_NAME;
      select.appendChild(option);
      select.selectedIndex = 0;
      Pachinko.pachinkoSelector = select;
      Pachinko.stopFirstGirlChecked = false;
      Pachinko.ByPassNoGirlChecked = false;
    }

    beforeEach(() => {
      jest.useFakeTimers();
      localStorage.clear();
      sessionStorage.clear();
      document.body.innerHTML = "";
      safeReloadMock.mockClear();
      jest.spyOn(RewardHelper, "closeRewardPopupIfAny").mockReturnValue(false as never);
      // buildPachinkoSelectPopUp (called by the finished-run branch) renders
      // hhMenuSwitch rows, which read through MenuPorts.
      setMenuPorts(buildTestPorts({
        getTextForUI: (id: string, type: string) => `${id}:${type}`,
      }));
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
      localStorage.clear();
      sessionStorage.clear();
      document.body.innerHTML = "";
      Pachinko.serverOrbsLeft = undefined;
      Pachinko.retry = 0;
    });

    it("reloads the pachinko page exactly once when a run finishes on-page", async function() {
      renderRunInProgress(0);
      Pachinko.orbLeftOnAutoStart = 5;
      Pachinko.orbsToGo = 5;
      Pachinko.serverOrbsLeft = 0; // server-authoritative: all 5 orbs spent, 0 left.
      Pachinko.retry = 0;

      await Pachinko.playXPachinko_func();

      expect(safeReloadMock).toHaveBeenCalledTimes(1);
      // The issue-1745 orb bookkeeping must stay exactly as the server
      // reported it -- the display fix must not touch it.
      expect(Pachinko.serverOrbsLeft).toBe(0);
      expect(Pachinko.retry).toBe(0);
    });

    it("does not reload while the run is still pulling (target not reached)", async function() {
      renderRunInProgress(3);
      Pachinko.orbLeftOnAutoStart = 5;
      Pachinko.orbsToGo = 5;
      Pachinko.serverOrbsLeft = 3; // 2 spent so far, target 5 not reached -> continues.

      await Pachinko.playXPachinko_func();

      expect(safeReloadMock).not.toHaveBeenCalled();
    });

    it("does not reload when the run finishes off the pachinko page", async function() {
      renderRunInProgress(0);
      document.getElementById("hh_hentai")!.setAttribute("page", "home");
      Pachinko.orbLeftOnAutoStart = 5;
      Pachinko.orbsToGo = 5;
      Pachinko.serverOrbsLeft = 0;

      await Pachinko.playXPachinko_func();

      expect(safeReloadMock).not.toHaveBeenCalled();
    });

    it("does not reload when the retry-failure path is taken instead of a clean finish", function() {
      // Verifies the failure/retry path (stopXPachinkoFailure, issue-1799
      // ticket asked to confirm this is unrelated) never triggers the new
      // reload -- only the natural "run finished" branch does.
      Pachinko.retry = 0;
      Pachinko.stopXPachinkoFailure();

      expect(safeReloadMock).not.toHaveBeenCalled();
    });
  });
});