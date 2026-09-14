import { SultryMysteries } from '../../../src/Module/Events/SultryMysteries';
import { ConfigHelper } from "../../../src/Helper/ConfigHelper";
import { getTimer, setTimer } from "../../../src/Helper/TimerHelper";
import { HHStoredVarPrefixKey } from "../../../src/config/HHStoredVars";
import { TK } from "../../../src/config/StorageKeys";
import { HHEvent, HHEventList } from "../../../src/model/HHEvent";
import { gotoPage, safeReload } from "../../../src/Service/PageNavigationService";
import { MockHelper } from "../../testHelpers/MockHelpers";

jest.mock("../../../src/Service/PageNavigationService", () => ({
    gotoPage: jest.fn().mockReturnValue(true),
    safeReload: jest.fn(),
    safeNavigateHref: jest.fn(),
    addNutakuSession: jest.fn((x: unknown) => x),
}));

describe("SultryMysteries event", function () {
    beforeEach(() => {
        MockHelper.mockDomain();
    });

    describe("parse", function () {
        const hhEvent = { eventId: 'sm_event_47', eventType: 'sm_event' } as HHEvent;

        beforeEach(() => {
            document.body.innerHTML = '';
            delete (unsafeWindow as any).sm_event_data;
            // The grid tab (default view of /event.html) has no shop-timer
            // element in the DOM, matching the live-verified repro. Park the
            // shop-refresh timer far in the future so parse()'s tab-switch
            // branch (untouched by this fix) doesn't fire during these tests.
            setTimer('eventSultryMysteryShopRefresh', 999999);
        });

        it("regression #drift-2026-08: uses sm_event_data.seconds_until_event_end even though the grid tab has no timer element in the DOM", function () {
            (unsafeWindow as any).sm_event_data = { seconds_until_event_end: "319404" };
            const eventList: HHEventList = {};
            const before = new Date().getTime();

            SultryMysteries.parse(hhEvent, eventList, {} as any);

            const expected = before + 319404 * 1000;
            const secondsBeforeEnd = eventList[hhEvent.eventId]["seconds_before_end"] as number;
            expect(secondsBeforeEnd).toBeGreaterThanOrEqual(expected);
            expect(secondsBeforeEnd).toBeLessThanOrEqual(expected + 5000);
        });

        it("falls back to a full hour -- not 'now' -- when neither sm_event_data nor the DOM timer are available", function () {
            const eventList: HHEventList = {};
            const before = new Date().getTime();

            SultryMysteries.parse(hhEvent, eventList, {} as any);

            const expected = before + 3600 * 1000;
            const secondsBeforeEnd = eventList[hhEvent.eventId]["seconds_before_end"] as number;
            expect(secondsBeforeEnd).toBeGreaterThanOrEqual(expected);
            expect(secondsBeforeEnd).toBeLessThanOrEqual(expected + 5000);
        });
    });

    describe("autoOpenGrid on a square the server refuses", function () {
        const EVENT_ID = 'sm_event_49';
        const RELOAD_KEY = HHStoredVarPrefixKey + TK.smStaleGridReload;

        // The page as the reported run saw it: square 1 open, the rest locked,
        // 22 keys. jsdom runs no game handler, so a click leaves the square
        // locked -- the same DOM the refusal left behind.
        function renderGrid() {
            const grid = Array.from({ length: 30 }, (_, i) => ({ id_square: i + 1, is_opened: i === 0, reward_index: 0, reward: [] }));
            (unsafeWindow as any).sm_event_data = { event_data: { progression: { key_amount: 22, grid }, rewards_list: {}, grid_refresh_squares_required: 15 } };
            document.body.innerHTML = `<div id="hh_hentai" page="${ConfigHelper.getHHScriptVars("pagesIDEvent")}"><div id="contains_all"><div id="events">
                <div class="get-more-keys-section"><p>22</p></div>
                <div class="grid-slots">${grid.map(s => `<div class="grid-slot ${s.is_opened ? 'unlocked' : 'locked'}" id_square="${s.id_square}"></div>`).join('')}</div>
            </div></div></div>`;
        }

        function runUntilSettled() {
            SultryMysteries.autoOpenRunning = false;
            SultryMysteries.autoOpenGrid(EVENT_ID);
            jest.advanceTimersByTime(20_000);
        }

        beforeEach(() => {
            jest.useFakeTimers();
            MockHelper.mockDomain("www.hentaiheroes.com", "event.html", `tab=${EVENT_ID}`);
            renderGrid();
            sessionStorage.clear();
            localStorage.clear();
            (safeReload as jest.Mock).mockClear();
            (gotoPage as jest.Mock).mockClear();
        });
        afterEach(() => {
            jest.useRealTimers();
        });

        it("reloads the page once instead of pausing for an hour", function () {
            runUntilSettled();

            expect(safeReload).toHaveBeenCalledTimes(1);
            expect(gotoPage).not.toHaveBeenCalled();
            expect(getTimer('eventSultryMysteryAutoOpen')).toBe(-1);
        });

        it("pauses when the square is refused again right after the reload", function () {
            runUntilSettled();
            renderGrid();
            runUntilSettled();

            expect(safeReload).toHaveBeenCalledTimes(1);
            expect(gotoPage).toHaveBeenCalledTimes(1);
            expect(getTimer('eventSultryMysteryAutoOpen')).not.toBe(-1);
            expect(sessionStorage.getItem(RELOAD_KEY)).toBeNull();
        });
    });

});