/**
 * LivelyScene.spec.ts -- issue #1857.
 *
 * Reported: automatic and manual "Collect all" claim one reward, the page
 * reloads, and nothing continues. Measured in the reporter's 8.11.0 log
 * (2026-09-01, lively_scene_event_14 on Nutaku):
 *
 *   5:40:13.612  run(): icons for pieces 2,3,5,8,11,14,15,26   (8 open)
 *   5:40:14.619  "On going lively scene event."                (parse, from
 *                 handleEventParsing -- the only caller with plusEvent off)
 *   5:40:14.628  handleEventParsing ev=done                    (collect still
 *                 running: parse does not await goAndCollect)
 *   5:40:15.630  reward popup closed                           -> reload
 *   5:40:17.807  run(): icons for 3,5,8,11,14,15,26            (7 open)
 *                 and no "On going lively scene event." at all
 *   5:40:18.815  the pipeline navigates to the missions page
 *
 * Two causes behind that, both covered here:
 *
 *  1. Only parse() ever reached goAndCollect, and parse() runs from
 *     parseEventPage -- which AutoLoopPageHandlers calls only when plusEvent
 *     or plusEventMythic is on (both "false" in the reported profile), so
 *     after the reload nobody picked the sweep up. run(), which does run on
 *     every event-page load, only drew the button and the icons. It now
 *     continues the sweep, the way PathOfAttraction.run() does (#1816).
 *
 *  2. parse() books next_refresh 3600-4000 s ahead before collecting, and
 *     handleEventParsing selects on next_refresh alone, so the pipeline did
 *     not come back to the page either -- the event ended 19 minutes later.
 *     A claim now marks the event stale again, and the refresh delay stays
 *     inside the event.
 *
 * Fixture note: in the game the side-panel collect button becomes claimable
 * only after the puzzle piece is clicked. jsdom does not run the game's
 * handlers, so the button is rendered claimable from the start; the click on
 * the piece is still made and is what the claim path needs to find.
 */
import { LivelyScene } from "../../../src/Module/Events/LivelyScene";
import { ConfigHelper } from "../../../src/Helper/ConfigHelper";
import { TimeHelper } from "../../../src/Helper/TimeHelper";
import { RewardHelper } from "../../../src/Helper/RewardHelper";
import { Timers } from "../../../src/Helper/TimerHelper";
import { HHStoredVarPrefixKey } from "../../../src/config/HHStoredVars";
import { SK, TK } from "../../../src/config/StorageKeys";
import { HHEvent, HHEventData, HHEventList } from "../../../src/model/HHEvent";
import { KKPuzzlePieces } from "../../../src/model/KK/KKPuzzlePieces";
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
const EVENT_ID = "lively_scene_event_14";

/** One claimable piece, shaped like the entries in the reported log. */
function piece(idPiece: number, opts: { unlocked?: boolean; claimed?: boolean; type?: string } = {}): KKPuzzlePieces {
    return {
        id_piece: idPiece,
        id_objective: 1,
        reward: { loot: true, rewards: [{ type: opts.type ?? "energy_fight", value: "4" }] },
        reward_unlocked: opts.unlocked ?? true,
        reward_claimed: opts.claimed ?? false,
        objective: { id_objective: 1, identifier: "spend_nrj", name: "Spend energy", anchors: {} },
        current_points: 150,
        target_points: 150,
    } as unknown as KKPuzzlePieces;
}

/**
 * The part of the event page the module reads: the panel timer, one puzzle
 * piece per entry, and the side panel with the collect button.
 */
function renderLivelyScenePage(pieces: KKPuzzlePieces[], timerText: string) {
    const svg = pieces
        .map((p) => `<g id="puzzle_piece_${p.id_piece}" class="puzzle_piece ${p.reward_claimed ? "claimed" : "claimable"}"><image x="10" y="20"/></g>`)
        .join("");
    document.body.innerHTML = `<div id="hh_hentai" page="${EVENT_PAGE}">
        <div id="contains_all">
            <div id="events">
                <div class="nc-panel"><div class="timer"><span rel="expires">${timerText}</span></div></div>
                <div id="lse_content">
                    <div id="puzzle_template">${svg}</div>
                    <div class="lse_side_panel"><button class="purple_button_L claimable">Collect</button></div>
                </div>
            </div>
        </div>
    </div>`;
    (unsafeWindow as any).current_event = { event_data: { puzzle_pieces: pieces } };
}

function setSetting(key: string, value: string) {
    localStorage.setItem(HHStoredVarPrefixKey + key, value);
}

/** The registry entry handleEventParsing selects on. */
function seedRegistry(nextRefreshInMs: number) {
    sessionStorage.setItem(HHStoredVarPrefixKey + TK.eventsList, JSON.stringify({
        [EVENT_ID]: {
            id: EVENT_ID,
            type: "livelyscene",
            seconds_before_end: Date.now() + 20 * 60 * 1000,
            next_refresh: Date.now() + nextRefreshInMs,
            isCompleted: false,
        },
    }));
}

function registryEntry(): Record<string, any> {
    return JSON.parse(sessionStorage.getItem(HHStoredVarPrefixKey + TK.eventsList) || "{}")[EVENT_ID];
}

const livelySceneEvent = {
    eventTypeKnown: true,
    eventId: EVENT_ID,
    eventType: "livelyscene",
    isLivelyScene: true,
    isEnabled: true,
} as HHEvent;

describe("LivelyScene -- #1857", () => {
    let restoreLocation: () => void;
    let claimSpy: jest.SpyInstance;

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        for (const name of Object.keys(Timers)) delete Timers[name];
        LivelyScene.collecting = false;
        restoreLocation = MockHelper.snapshotLocation();
        MockHelper.mockDomain("www.hentaiheroes.com", "event.html", `tab=${EVENT_ID}`);
        jest.spyOn(TimeHelper, "sleep").mockResolvedValue(undefined as never);
        // Closing the reward popup is the step that reloads the page: it marks
        // "a reward was claimed" without driving a real claim.
        claimSpy = jest.spyOn(RewardHelper, "closeRewardPopupIfAny").mockImplementation(() => undefined as never);
        setSetting(SK.showRewardsRecap, "false");
        setSetting(SK.collectAllTimer, "12");
        setSetting(SK.autoLivelySceneEventCollect, "false");
        setSetting(SK.autoLivelySceneEventCollectAll, "false");
        setSetting(SK.autoLivelySceneEventCollectablesList, "null");
        setSetting(TK.lseManualCollectAll, "false");
    });

    afterEach(() => {
        document.body.innerHTML = "";
        delete (unsafeWindow as any).current_event;
        restoreLocation();
        jest.restoreAllMocks();
        localStorage.clear();
        sessionStorage.clear();
    });

    const claimed = () => claimSpy.mock.calls.length;

    describe("continuing after the reload", () => {
        it("collects on a plain event-page load when the end-of-event sweep is due", async () => {
            renderLivelyScenePage([piece(2), piece(3)], "19m 47s");
            setSetting(SK.autoLivelySceneEventCollectAll, "true");

            await LivelyScene.run();

            expect(claimed()).toBe(1);
        });

        it("resumes a manual sweep from the stored flag, with every setting off", async () => {
            renderLivelyScenePage([piece(2), piece(3)], "19m 47s");
            setSetting(TK.lseManualCollectAll, "true");

            await LivelyScene.run();

            expect(claimed()).toBe(1);
        });

        it("collects nothing on a page load when no collect mode is on", async () => {
            renderLivelyScenePage([piece(2), piece(3)], "19m 47s");

            await LivelyScene.run();

            expect(claimed()).toBe(0);
        });

        it("leaves the sweep closed while the event is outside the final window", async () => {
            renderLivelyScenePage([piece(2), piece(3)], "5h 0m");
            setSetting(SK.autoLivelySceneEventCollectAll, "true");
            setSetting(SK.collectAllTimer, "1");

            await LivelyScene.run();

            expect(claimed()).toBe(0);
        });

        it("claims once when parse() and run() both fire on the same page load", async () => {
            renderLivelyScenePage([piece(2), piece(3)], "19m 47s");
            setSetting(SK.autoLivelySceneEventCollectAll, "true");
            const eventList: HHEventList = {};

            const both = LivelyScene.run();
            LivelyScene.parse(livelySceneEvent, eventList, {} as HHEventData);
            await both;

            expect(claimed()).toBe(1);
        });
    });

    describe("bringing the pipeline back", () => {
        it("marks the event stale after a claim, so handleEventParsing returns", async () => {
            renderLivelyScenePage([piece(2), piece(3)], "19m 47s");
            seedRegistry(3600 * 1000);
            setSetting(SK.autoLivelySceneEventCollectAll, "true");

            await LivelyScene.run();

            expect(claimed()).toBe(1);
            expect(registryEntry().next_refresh).toBe(0);
        });

        it("leaves the registry alone when nothing was claimed", async () => {
            renderLivelyScenePage([piece(2, { claimed: true })], "19m 47s");
            seedRegistry(3600 * 1000);
            setSetting(SK.autoLivelySceneEventCollectAll, "true");

            await LivelyScene.run();

            expect(claimed()).toBe(0);
            expect(registryEntry().next_refresh).toBeGreaterThan(Date.now());
        });

        it("keeps the next refresh inside an event that ends within the hour", () => {
            renderLivelyScenePage([piece(2)], "19m 47s");
            const eventList: HHEventList = {};

            LivelyScene.parse(livelySceneEvent, eventList, {} as HHEventData);

            const entry = eventList[EVENT_ID] as Record<string, number>;
            const refreshInS = (entry["next_refresh"] - Date.now()) / 1000;
            const endInS = (entry["seconds_before_end"] - Date.now()) / 1000;
            expect(refreshInS).toBeLessThan(endInS);
            expect(refreshInS).toBeGreaterThan(0);
        });

        it("keeps the hourly refresh for a long-running event", () => {
            renderLivelyScenePage([piece(2)], "2d 5h 30m");
            const eventList: HHEventList = {};

            LivelyScene.parse(livelySceneEvent, eventList, {} as HHEventData);

            const entry = eventList[EVENT_ID] as Record<string, number>;
            const refreshInS = (entry["next_refresh"] - Date.now()) / 1000;
            expect(refreshInS).toBeGreaterThanOrEqual(3600);
            expect(refreshInS).toBeLessThanOrEqual(4000);
        });
    });
});
