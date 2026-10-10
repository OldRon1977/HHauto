import { SeasonalEvent } from '../../../src/Module/Events/Seasonal';
import { ConfigHelper } from '../../../src/Helper/ConfigHelper';
import { TimeHelper } from '../../../src/Helper/TimeHelper';
import { logHHAuto } from '../../../src/Utils/LogUtils';
import { gotoPage } from '../../../src/Service/PageNavigationService';
import { MockHelper } from '../../testHelpers/MockHelpers';
import { getSecondsLeft } from '../../../src/Helper/TimerHelper';
import * as AjaxTracker from '../../../src/Service/AjaxTracker';

// PageNavigationService is mocked so the navigation branch does not touch
// window.location (see Shop.spec.ts for the same pattern).
jest.mock("../../../src/Service/PageNavigationService", () => ({
    gotoPage: jest.fn().mockReturnValue(true),
    safeReload: jest.fn(),
    safeNavigateHref: jest.fn(),
    addNutakuSession: jest.fn((x: unknown) => x),
}));

jest.mock("../../../src/Utils/LogUtils", () => ({
    logHHAuto: jest.fn(),
}));

const gotoPageMock = gotoPage as jest.Mock;

describe("SeasonalEvent", function () {
    describe("goAndCollect without a running event", function () {
        beforeEach(() => {
            MockHelper.mockDomain("www.hentaiheroes.com");
            gotoPageMock.mockClear();
            document.body.innerHTML = `<!DOCTYPE html><div id="hh_hentai" page="${ConfigHelper.getHHScriptVars("pagesIDHome")}"></div>`;
            unsafeWindow.seasonal_event_active = false;
            unsafeWindow.seasonal_time_remaining = 0;
            unsafeWindow.mega_event_active = false;
            unsafeWindow.mega_event_time_remaining = 0;
        });

        it("stays on the page and looks again within about an hour, not a week", function () {
            expect(SeasonalEvent.goAndCollect()).toBe(false);
            expect(gotoPageMock).not.toHaveBeenCalled();
            for (const timer of ['nextSeasonalEventCollectTime', 'nextSeasonalEventCollectAllTime']) {
                expect(getSecondsLeft(timer)).toBeGreaterThanOrEqual(3500);
                expect(getSecondsLeft(timer)).toBeLessThanOrEqual(4200);
            }
        });
    });

    describe("goAndCollectFreeCard", function () {
        const SEASONAL_PAGE = ConfigHelper.getHHScriptVars("pagesIDSeasonalEvent");
        const HOME_PAGE = ConfigHelper.getHHScriptVars("pagesIDHome");

        function renderPage(pageId: string) {
            document.body.innerHTML = `<!DOCTYPE html><div id="hh_hentai" page="${pageId}"></div>`;
        }

        beforeEach(() => {
            MockHelper.mockDomain("www.hentaiheroes.com");
            gotoPageMock.mockClear();
            (logHHAuto as jest.Mock).mockClear();
            jest.spyOn(TimeHelper, "sleep").mockResolvedValue(undefined as never);
            unsafeWindow.mega_event_data = undefined;
            unsafeWindow.seasonal_event_active = false;
            unsafeWindow.seasonal_time_remaining = 0;
            unsafeWindow.mega_event_active = false;
            unsafeWindow.mega_event_time_remaining = 0;
        });

        afterEach(() => {
            document.body.innerHTML = "";
            jest.restoreAllMocks();
        });

        it("navigates to the SeasonalEvent page without reading mega_event_data, and without logging a spurious 'not found'", async () => {
            // Live-verified: window.mega_event_data does not exist on
            // /home.html at all, only on /seasonal.html. Reading it before
            // checking the page used to trigger getHHVars' "HH var not
            // found" log on every off-page call.
            renderPage(HOME_PAGE);
            unsafeWindow.seasonal_event_active = true;

            const result = await SeasonalEvent.goAndCollectFreeCard();

            expect(result).toBe(true);
            expect(gotoPageMock).toHaveBeenCalledWith(SEASONAL_PAGE);
            expect(logHHAuto).not.toHaveBeenCalledWith(expect.stringContaining("HH var not found"));
        });

        it("skips collection and reschedules when cards are already collected on the SeasonalEvent page", async () => {
            renderPage(SEASONAL_PAGE);
            unsafeWindow.mega_event_data = { cards: "1" };

            const result = await SeasonalEvent.goAndCollectFreeCard();

            expect(result).toBe(false);
            expect(gotoPageMock).not.toHaveBeenCalled();
            expect(logHHAuto).toHaveBeenCalledWith(
                expect.stringContaining("Free cards already collected")
            );
            expect(logHHAuto).not.toHaveBeenCalledWith(expect.stringContaining("HH var not found"));
        });

        it("does not use the 'already collected' shortcut when off the SeasonalEvent page, even if cards were previously seen as collected", async () => {
            // Regression guard for the fix: the decision must only be made
            // where mega_event_data actually exists (on the seasonal page).
            // Off page, mega_event_data is undefined in the live game, so
            // this also documents that we don't fabricate a decision from
            // stale/absent data.
            renderPage(HOME_PAGE);
            unsafeWindow.mega_event_active = true;

            const result = await SeasonalEvent.goAndCollectFreeCard();

            expect(result).toBe(true);
            expect(gotoPageMock).toHaveBeenCalledWith(SEASONAL_PAGE);
            expect(logHHAuto).not.toHaveBeenCalledWith(expect.stringContaining("Free cards already collected"));
        });

        it("reports no active event and reschedules when off page and no event is active", async () => {
            renderPage(HOME_PAGE);

            const result = await SeasonalEvent.goAndCollectFreeCard();

            expect(result).toBe(false);
            expect(gotoPageMock).not.toHaveBeenCalled();
            expect(logHHAuto).toHaveBeenCalledWith("No SeasonalEvent active.");
        });
    });

    describe("goAndCollectMegaEventRankRewards under a slow server (#1915)", function () {
        beforeEach(() => {
            MockHelper.mockDomain("www.hentaiheroes.com");
            jest.useFakeTimers();
        });
        afterEach(() => {
            jest.useRealTimers();
            jest.restoreAllMocks();
            document.body.innerHTML = '';
            localStorage.clear();
            sessionStorage.clear();
        });

        it("reads the rank timer after the board has loaded", async function () {
            // Measured with the server answering after 3 s: the timer was read
            // before the board arrived, and the next visit came after 7 h
            // instead of the 2 d 23 h left.
            document.body.innerHTML = `<!DOCTYPE html><div id="hh_hentai" page="${ConfigHelper.getHHScriptVars("pagesIDSeasonalEvent")}">
                <div id="mega-event-tabs"><div id="top_ranking_tab"></div></div><div id="top_ranking_tab_container"></div></div>`;
            jest.spyOn(SeasonalEvent, 'isMegaSeasonalEvent').mockReturnValue(true);
            let answered = true;
            $('#top_ranking_tab').on('click', () => {
                answered = false;
                setTimeout(() => {
                    $('#top_ranking_tab_container').append('<div class="ranking-timer-reset"><div class="ranking-timer"><span rel="expires">2d 23h</span></div></div>');
                    answered = true;
                }, 3000);
            });
            jest.spyOn(AjaxTracker, 'waitForGameAnswer').mockImplementation(async () => {
                while (!answered) await new Promise(r => setTimeout(r, 50));
                return true;
            });

            const done = SeasonalEvent.goAndCollectMegaEventRankRewards();
            await jest.advanceTimersByTimeAsync(10_000);
            await done;

            expect(getSecondsLeft('nextMegaEventRankCollectTime')).toBeGreaterThan(2 * 24 * 3600);
        });
    });
});
