/**
 * RewardHelper.closeReloadingRewardPopup -- issue #1908.
 *
 * Path of Attraction switched autoLoop off, clicked Claim and looked for the
 * reward popup twice, at fixed times. Measured on the PoA page with the claim
 * answer held back 3.5 s: the popup came at about 4 s, both looks had missed
 * it, and nothing closed it, reloaded the page or restarted the loop for the
 * 75 s watched. With the answer after 300 ms the popup was closed and the
 * page reloaded.
 *
 * The popup closer is stubbed: jQuery's :visible needs a layout jsdom does not
 * have. Each stubbed call stands for one poll, 250 ms apart.
 */
import { RewardHelper } from "../../src/Helper/RewardHelper";
import { TimeHelper } from "../../src/Helper/TimeHelper";
import { HHStoredVarPrefixKey } from "../../src/config/HHStoredVars";
import { TK } from "../../src/config/StorageKeys";
import { safeReload } from "../../src/Service/PageNavigationService";
import { kickAutoLoop } from "../../src/Service/AutoLoopKick";

jest.mock("../../src/Service/PageNavigationService", () => ({
    gotoPage: jest.fn().mockReturnValue(true),
    safeReload: jest.fn(),
    safeNavigateHref: jest.fn(),
    addNutakuSession: jest.fn((x: unknown) => x),
}));

jest.mock("../../src/Service/AutoLoopKick", () => ({
    kickAutoLoop: jest.fn(),
}));

describe("RewardHelper.closeReloadingRewardPopup -- #1908", () => {
    let closer: jest.SpyInstance;
    let sleep: jest.SpyInstance;

    /** The popup is there from the given poll on (0 = at once). */
    function popupFromPoll(firstVisiblePoll: number) {
        let calls = 0;
        closer = jest.spyOn(RewardHelper, "closeRewardPopupIfAny").mockImplementation(() => calls++ >= firstVisiblePoll);
    }

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        sessionStorage.setItem(HHStoredVarPrefixKey + TK.autoLoop, "false");
        sleep = jest.spyOn(TimeHelper, "sleep").mockResolvedValue(undefined as never);
        (safeReload as jest.Mock).mockClear();
        (kickAutoLoop as jest.Mock).mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        localStorage.clear();
        sessionStorage.clear();
    });

    it("closes a popup that is already there", async () => {
        popupFromPoll(0);
        await RewardHelper.closeReloadingRewardPopup();
        expect(closer).toHaveBeenCalledTimes(1);
        expect(kickAutoLoop).not.toHaveBeenCalled();
    });

    it("still closes a popup that comes 4 s after the claim, as measured", async () => {
        popupFromPoll(16);
        await RewardHelper.closeReloadingRewardPopup();
        expect(closer).toHaveBeenCalledTimes(17);
        expect(kickAutoLoop).not.toHaveBeenCalled();
    });

    it("reloads the page itself when closing the popup did not", async () => {
        popupFromPoll(0);
        await RewardHelper.closeReloadingRewardPopup();
        // The last sleep is the reload wait; a page that reloads never gets past it.
        expect(sleep).toHaveBeenLastCalledWith(10000);
        expect(safeReload).toHaveBeenCalledTimes(1);
    });

    it("restarts the loop when no popup appears, without reloading", async () => {
        popupFromPoll(Infinity);
        await RewardHelper.closeReloadingRewardPopup();
        expect(closer).toHaveBeenCalledTimes(60);
        expect(sessionStorage.getItem(HHStoredVarPrefixKey + TK.autoLoop)).toBe("true");
        expect(kickAutoLoop).toHaveBeenCalledTimes(1);
        expect(safeReload).not.toHaveBeenCalled();
    });
});
