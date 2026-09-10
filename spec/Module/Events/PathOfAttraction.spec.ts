/**
 * PathOfAttraction.spec.ts -- issue #1846.
 *
 * Two defects, both reproduced in the browser on path_event_109 before the
 * fix (26 tiers, one claimable free reward, ~3 h remaining):
 *
 *  1. Setting_autoPoACollectablesList can hold the JSON text "null". The
 *     collection condition dereferenced that filter before the two modes that
 *     do not need it, so collect-all-before-end and the manual Collect all
 *     button both threw "Cannot read properties of null (reading 'includes')"
 *     -- after goAndCollect had already set autoLoop to false, and inside an
 *     unrecovered promise.
 *
 *  2. getSecondsLeft returns 0 both for "no such timer" and for "expired", and
 *     run() never called getRemainingTime(), which only parse() does -- behind
 *     the plusEvent switch, off by default. An unknown remaining time therefore
 *     satisfied `poAEnd < limitBeforeEnd` and opened the collect-all gate at
 *     any distance from the event end.
 */
import { PathOfAttraction } from "../../../src/Module/Events/PathOfAttraction";
import { Harem } from "../../../src/Module/harem/Harem";
import { ConfigHelper } from "../../../src/Helper/ConfigHelper";
import { TimeHelper } from "../../../src/Helper/TimeHelper";
import { RewardHelper } from "../../../src/Helper/RewardHelper";
import { setTimer, Timers, getSecondsLeft } from "../../../src/Helper/TimerHelper";
import * as LogUtils from "../../../src/Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../../../src/config/HHStoredVars";
import { SK, TK } from "../../../src/config/StorageKeys";
import { MockHelper } from "../../testHelpers/MockHelpers";
import { EventModule } from "../../../src/Module/Events/EventModule";
import { getStaleEventIDs } from "../../../src/Service/Pipeline.config";
import { getStoredValue, setStoredValue } from "../../../src/Helper/StorageHelper";
import { HHEventData, HHEventList } from "../../../src/model/HHEvent";

jest.mock("../../../src/Service/PageNavigationService", () => ({
    gotoPage: jest.fn().mockReturnValue(true),
    safeReload: jest.fn(),
    safeNavigateHref: jest.fn(),
    addNutakuSession: jest.fn((x: unknown) => x),
}));

jest.mock("../../../src/Service/AutoLoop", () => ({
    autoLoop: jest.fn(),
}));

const EVENT_PAGE = ConfigHelper.getHHScriptVars("pagesIDEvent");

/**
 * The tape markup the module reads: a step indicator per tier plus a free and
 * a locked reward container, mirroring the live #nc-poa-tape-rewards.
 */
function renderPoaPage(opts: { tiers: number; claimableFreeTier?: number; rewardType?: string; timerText?: string; omitTimer?: boolean }) {
    const rewardType = opts.rewardType ?? "energy_fight";
    let pairs = "";
    for (let tier = 1; tier <= opts.tiers; tier++) {
        const claimable = tier === opts.claimableFreeTier ? " claimable" : " claimed";
        pairs += `<div class="nc-poa-reward-pair">
            <div class="nc-poa-step-indicator"></div>
            <div class="nc-poa-free-reward${claimable}" data-nc-reward-id="${tier}">
                <div class="slot" cur="${rewardType}"></div>
            </div>
            <div class="nc-poa-locked-reward claimed" data-nc-reward-id="${tier}">
                <div class="slot" cur="${rewardType}"></div>
            </div>
        </div>`;
    }
    // omitTimer drops the element entirely, which is not the same as an empty
    // one: getRemainingTime only reports the miss when the node itself is
    // absent, and an empty node routes through convertTimeToInt's failSafe
    // branch to 15-17 min instead.
    const timer = opts.omitTimer
        ? ""
        : `<div class="nc-panel-header"><div class="event-timer"><span rel="expires">${opts.timerText ?? "3h 10m"}</span></div></div>`;
    document.body.innerHTML = `<div id="hh_hentai" page="${EVENT_PAGE}">
        <div id="events">
            ${timer}
            <div id="poa-content"></div>
            <div id="nc-poa-tape-rewards">${pairs}</div>
        </div>
    </div>`;
}

function setSetting(key: string, value: string) {
    localStorage.setItem(HHStoredVarPrefixKey + key, value);
}

describe("PathOfAttraction -- #1846", () => {
    let restoreLocation: () => void;
    let getRewardSpy: jest.SpyInstance;

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        for (const name of Object.keys(Timers)) delete Timers[name];
        restoreLocation = MockHelper.snapshotLocation();
        MockHelper.mockDomain("www.hentaiheroes.com", "event.html", "tab=path_event_109");
        jest.spyOn(TimeHelper, "sleep").mockResolvedValue(undefined as never);
        // Stand-in for the click sequence, so no test ever drives the real
        // slot/confirm clicks. Spying on the popup closer is enough: it is the
        // step that would reload the page.
        getRewardSpy = jest.spyOn(RewardHelper, "closeRewardPopupIfAny").mockImplementation(() => undefined as never);
        setSetting(SK.showClubButtonInPoa, "false");
        setSetting(SK.collectAllTimer, "12");
        setSetting(TK.poaManualCollectAll, "false");
    });

    afterEach(() => {
        document.body.innerHTML = "";
        restoreLocation();
        jest.restoreAllMocks();
        localStorage.clear();
        sessionStorage.clear();
    });

    /** Did the run reach the point where it touches a reward slot? */
    function collected(): boolean {
        return getRewardSpy.mock.calls.length > 0;
    }

    describe("null reward filter", () => {
        it("collects with collect-all-before-end even when the stored filter is null", async () => {
            renderPoaPage({ tiers: 26, claimableFreeTier: 3, timerText: "2h 0m" });
            setSetting(SK.autoPoACollect, "false");
            setSetting(SK.autoPoACollectAll, "true");
            setSetting(SK.autoPoACollectablesList, "null");

            await expect(PathOfAttraction.run()).resolves.toBeUndefined();
            expect(collected()).toBe(true);
        });

        it("skips unselected rewards with selective collection when the stored filter is null", async () => {
            renderPoaPage({ tiers: 26, claimableFreeTier: 3, timerText: "2h 0m" });
            setSetting(SK.autoPoACollect, "true");
            setSetting(SK.autoPoACollectAll, "false");
            setSetting(SK.autoPoACollectablesList, "null");

            await expect(PathOfAttraction.run()).resolves.toBeUndefined();
            expect(collected()).toBe(false);
        });

        it("keeps the existing selective behaviour for a valid filter array", async () => {
            renderPoaPage({ tiers: 26, claimableFreeTier: 3, rewardType: "energy_fight", timerText: "2h 0m" });
            setSetting(SK.autoPoACollect, "true");
            setSetting(SK.autoPoACollectAll, "false");
            setSetting(SK.autoPoACollectablesList, '["energy_fight"]');

            await PathOfAttraction.run();
            expect(collected()).toBe(true);
        });

        it("leaves a reward of an unselected type alone", async () => {
            renderPoaPage({ tiers: 26, claimableFreeTier: 3, rewardType: "energy_fight", timerText: "2h 0m" });
            setSetting(SK.autoPoACollect, "true");
            setSetting(SK.autoPoACollectAll, "false");
            setSetting(SK.autoPoACollectablesList, '["girl_shards"]');

            await PathOfAttraction.run();
            expect(collected()).toBe(false);
        });
    });

    describe("final-window gate", () => {
        beforeEach(() => {
            setSetting(SK.autoPoACollect, "false");
            setSetting(SK.autoPoACollectAll, "true");
            setSetting(SK.autoPoACollectablesList, "[]");
        });

        it("does not run automatic collect-all when the timer is missing and no DOM timer is readable", async () => {
            renderPoaPage({ tiers: 26, claimableFreeTier: 3 });
            // No readable timer at all: getRemainingTime() finds nothing, so
            // the remaining time stays unknown and the gate must stay shut.
            document.querySelector("#events .nc-panel-header .event-timer")?.remove();

            await PathOfAttraction.run();
            expect(collected()).toBe(false);
        });

        it("does not run automatic collect-all at 22 h with a 12 h threshold", async () => {
            renderPoaPage({ tiers: 26, claimableFreeTier: 3, timerText: "22h 0m" });
            setSetting(SK.collectAllTimer, "12");

            await PathOfAttraction.run();
            expect(collected()).toBe(false);
        });

        it("runs automatic collect-all at 2 h with a 12 h threshold", async () => {
            renderPoaPage({ tiers: 26, claimableFreeTier: 3, timerText: "2h 0m" });
            setSetting(SK.collectAllTimer, "12");

            await PathOfAttraction.run();
            expect(collected()).toBe(true);
        });

        it("reads the remaining time from the page itself, without parse() having run", async () => {
            renderPoaPage({ tiers: 26, claimableFreeTier: 3, timerText: "22h 0m" });

            await PathOfAttraction.run();
            expect(Timers["PoARemainingTime"]).toBeDefined();
        });

        it("does not let an already-known long remaining time open the gate", async () => {
            renderPoaPage({ tiers: 26, claimableFreeTier: 3, timerText: "22h 0m" });
            setTimer("PoARemainingTime", 22 * 3600);

            await PathOfAttraction.run();
            expect(collected()).toBe(false);
        });
    });
});

// The game states its own gate on the locked page, measured 2026-09-09:
// "You need to be at least on the Second World of your adventure and have at
// least 10 girls in your Harem to participate in the Path of Attraction
// event." Without the check the event counted as enabled for an account that
// cannot enter it, and the run bounced onto that page every tick -- twelve of
// eighteen samples in one measured session.
// The timer element as the event page carries it, measured 2026-09-09 on
// path_event_110: "#events .nc-panel-header .event-timer span[rel=expires]"
// with the text "2d 17h", present 800 to 950 ms after navigation in four out
// of four direct page loads. In one measured session the module stored that
// value; in another it stored nothing three visits running, and the miss left
// no trace in the log to tell the two apart.
const EVENT_PAGE_WITH_TIMER = `
<div id="events" class="canvas main-event-container">
  <div class="nc-panel-container"><div class="nc-panel"><div class="nc-panel-header">
    <div class="nc-pull-right"><div class="event-timer nc-expiration-label timer">
      <p>Ends in <span rel="expires">2d 17h</span></p>
    </div></div>
  </div></div></div>
</div>`;
const EVENT_PAGE_WITHOUT_TIMER = `
<div id="events" class="canvas main-event-container">
  <div class="nc-panel-container"><div class="nc-panel"><div class="nc-panel-header">
  </div></div></div>
</div>`;

/**
 * The registry entry parse() writes, followed to the step that consumes it.
 *
 * getSecondsLeft answers 0 for "no timer stored" as well as for "expired"
 * (#1846), and parse() handed that 0 to seconds_before_end -- dating the entry
 * to the moment it was written. The consumer is pruneExpiredEvents, called by
 * getStaleEventIDs on every handleEventParsing precondition: it drops the
 * entry as expired, checkEvent() then reports the id as unregistered, so
 * parsePageForEventId puts it back into ctx.eventIDs and the same page is
 * parsed again. That is issue #1738's loop, re-entered through a producer that
 * can legitimately emit 0.
 *
 * Measured on a live account 2026-09-09: with "PoA end in {"days":0,...}" the
 * pipeline logged 43 handleEventParsing runs in four minutes, one every 2 s,
 * with a home<->event navigation round in between; with a readable timer, one.
 *
 * These tests therefore run parse -> getStaleEventIDs -> checkEvent rather
 * than asserting on the field parse writes: the field alone was measured
 * before and read as harmless.
 */
describe("PathOfAttraction.parse -- the entry that survives the next tick", function () {
    const EVENT_ID = "path_event_110";
    let restoreLocation: () => void;

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        for (const name of Object.keys(Timers)) delete Timers[name];
        restoreLocation = MockHelper.snapshotLocation();
        MockHelper.mockDomain("www.hentaiheroes.com", "event.html", `tab=${EVENT_ID}`);
        // getEvent() asks PathOfAttraction.isEnabled() whether the account can
        // enter the event at all; without that, checkEvent short-circuits on
        // isEnabled and the assertions below would hold for the wrong reason.
        jest.spyOn(Harem, "getGirlCount").mockReturnValue(13);
        unsafeWindow.shared!.Hero = { infos: { questing: { id_world: 4 } } } as never;
        setSetting(SK.collectAllTimer, "12");
        setSetting(SK.autoPoACollectAll, "false");
    });

    afterEach(() => {
        document.body.innerHTML = "";
        restoreLocation();
        jest.restoreAllMocks();
        localStorage.clear();
        sessionStorage.clear();
        for (const name of Object.keys(Timers)) delete Timers[name];
    });

    /** parse() as parseEventPage calls it, with the result persisted. */
    function parseAndStore(): void {
        const eventList: HHEventList = {};
        PathOfAttraction.parse(EventModule.getEvent(EVENT_ID), eventList, {} as HHEventData);
        setStoredValue(HHStoredVarPrefixKey + TK.eventsList, JSON.stringify(eventList));
    }

    function storedEntry(): Record<string, unknown> | undefined {
        return JSON.parse(getStoredValue(HHStoredVarPrefixKey + TK.eventsList) || "{}")[EVENT_ID];
    }

    it("is still in the registry after the next precondition prunes it", function () {
        // 26 tiers with one claimable free reward: an empty tape would make
        // isCompleted() true (0 >= 0), and checkEvent returns false for a
        // completed event whatever the end date says.
        renderPoaPage({ tiers: 26, claimableFreeTier: 3, omitTimer: true });

        parseAndStore();
        // The call handleEventParsing's precondition makes on every tick. It
        // runs pruneExpiredEvents and persists the pruned shape.
        getStaleEventIDs(Date.now() + 1000);

        expect(storedEntry()).toBeDefined();
        // ... and the id no longer reads as unregistered, which is what put it
        // back into ctx.eventIDs and started the next parse 2 s later.
        expect(EventModule.checkEvent(EVENT_ID)).toBe(false);
    });

    it("books a bounded stand-in for an unreadable timer, not an open end", function () {
        renderPoaPage({ tiers: 26, claimableFreeTier: 3, omitTimer: true });

        parseAndStore();

        const entry = storedEntry()!;
        const endsIn = Number(entry["seconds_before_end"]) - Date.now();
        expect(endsIn).toBeGreaterThan(0);
        expect(endsIn).toBeLessThanOrEqual(PathOfAttraction.unknownRemainingTimeSecs * 1000);
        // Re-parsed before it is pruned, so a timer that becomes readable is
        // picked up instead of the entry expiring into another parse round.
        expect(Number(entry["next_refresh"])).toBeLessThan(Number(entry["seconds_before_end"]));
    });

    it("keeps the end the page states when the timer is readable", function () {
        renderPoaPage({ tiers: 26, claimableFreeTier: 3, timerText: "2d 17h" });

        parseAndStore();
        getStaleEventIDs(Date.now() + 1000);

        const entry = storedEntry();
        expect(entry).toBeDefined();
        expect(Number(entry!["seconds_before_end"]) - Date.now()).toBeGreaterThan(2 * 86400 * 1000);
        expect(EventModule.checkEvent(EVENT_ID)).toBe(false);
    });
});

describe("PathOfAttraction.getRemainingTime", function () {
    let logged: string[];

    beforeEach(() => {
        logged = [];
        jest.spyOn(LogUtils, 'logHHAuto').mockImplementation((...args: unknown[]) => {
            logged.push(String(args[0]));
        });
        localStorage.clear();
        sessionStorage.clear();
        for (const name of Object.keys(Timers)) delete Timers[name];
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
        sessionStorage.clear();
        for (const name of Object.keys(Timers)) delete Timers[name];
        jest.restoreAllMocks();
    });

    it("stores the remaining time the page shows", function () {
        document.body.innerHTML = EVENT_PAGE_WITH_TIMER;

        PathOfAttraction.getRemainingTime();

        // 2d 17h
        expect(Timers["PoARemainingTime"]).toBeDefined();
        expect(getSecondsLeft("PoARemainingTime")).toBeGreaterThan(2 * 86400);
        expect(logged.some(l => l.includes('no expiry timer'))).toBe(false);
    });

    it("says so when the page carries no timer, instead of leaving a silent 0", function () {
        document.body.innerHTML = EVENT_PAGE_WITHOUT_TIMER;

        PathOfAttraction.getRemainingTime();

        expect(Timers["PoARemainingTime"]).toBeUndefined();
        expect(logged.some(l => l.includes('no expiry timer'))).toBe(true);
    });

    it("stays quiet when a remaining time is already known", function () {
        document.body.innerHTML = EVENT_PAGE_WITHOUT_TIMER;
        setTimer("PoARemainingTime", 3600);
        logged.length = 0;

        PathOfAttraction.getRemainingTime();

        expect(logged.some(l => l.includes('no expiry timer'))).toBe(false);
    });
});

describe("PathOfAttraction.isEnabled", function () {
    const setWorld = (id_world: number) => {
        unsafeWindow.shared!.Hero = { infos: { questing: { id_world } } } as never;
    };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("is off below ten girls", function () {
        jest.spyOn(Harem, 'getGirlCount').mockReturnValue(9);
        setWorld(3);

        expect(PathOfAttraction.isEnabled()).toBe(false);
    });

    it("is off in world 1 even with enough girls", function () {
        jest.spyOn(Harem, 'getGirlCount').mockReturnValue(25);
        setWorld(1);

        expect(PathOfAttraction.isEnabled()).toBe(false);
    });

    it("is on at ten girls from world 2", function () {
        jest.spyOn(Harem, 'getGirlCount').mockReturnValue(10);
        setWorld(2);

        expect(PathOfAttraction.isEnabled()).toBe(true);
    });

    it("is off on an account with no girls at all", function () {
        jest.spyOn(Harem, 'getGirlCount').mockReturnValue(0);
        setWorld(3);

        expect(PathOfAttraction.isEnabled()).toBe(false);
    });
});
