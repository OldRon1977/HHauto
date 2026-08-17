import { SeasonalEvent } from '../../../src/Module/Events/Seasonal';
import { ConfigHelper } from '../../../src/Helper/ConfigHelper';
import { TimeHelper } from '../../../src/Helper/TimeHelper';
import { logHHAuto } from '../../../src/Utils/LogUtils';
import { gotoPage } from '../../../src/Service/PageNavigationService';
import { MockHelper } from '../../testHelpers/MockHelpers';

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
});