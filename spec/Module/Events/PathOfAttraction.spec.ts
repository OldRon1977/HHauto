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
import { ConfigHelper } from "../../../src/Helper/ConfigHelper";
import { TimeHelper } from "../../../src/Helper/TimeHelper";
import { RewardHelper } from "../../../src/Helper/RewardHelper";
import { setTimer, Timers } from "../../../src/Helper/TimerHelper";
import { HHStoredVarPrefixKey } from "../../../src/config/HHStoredVars";
import { SK, TK } from "../../../src/config/StorageKeys";
import { MockHelper } from "../../testHelpers/MockHelpers";

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
function renderPoaPage(opts: { tiers: number; claimableFreeTier?: number; rewardType?: string; timerText?: string }) {
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
    document.body.innerHTML = `<div id="hh_hentai" page="${EVENT_PAGE}">
        <div id="events">
            <div class="nc-panel-header"><div class="event-timer"><span rel="expires">${opts.timerText ?? "3h 10m"}</span></div></div>
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
