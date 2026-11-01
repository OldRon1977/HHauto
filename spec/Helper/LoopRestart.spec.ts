/**
 * Holds how a place that switched the auto-loop off starts it again: flag
 * on, then one kick after the player's loop interval (Temp_autoLoopTimeMili).
 * Taken at RewardHelper's "no popup" path, one of the places that do exactly
 * this.
 */
import { RewardHelper } from "../../src/Helper/RewardHelper";
import { TimeHelper } from "../../src/Helper/TimeHelper";
import { kickAutoLoop } from "../../src/Service/AutoLoopKick";
import { HHStoredVarPrefixKey, TK } from "../../src/config/StorageKeys";

jest.mock("../../src/Service/PageNavigationService", () => ({
    gotoPage: jest.fn().mockReturnValue(true),
    safeReload: jest.fn(),
    safeNavigateHref: jest.fn(),
    addNutakuSession: jest.fn((x: unknown) => x),
}));

jest.mock("../../src/Service/AutoLoopKick", () => ({
    kickAutoLoop: jest.fn(),
}));

describe("restarting the auto-loop after an action", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        sessionStorage.setItem(HHStoredVarPrefixKey + TK.autoLoop, "false");
        localStorage.setItem(HHStoredVarPrefixKey + TK.autoLoopTimeMili, "1234");
        jest.spyOn(TimeHelper, "sleep").mockResolvedValue(undefined as never);
        jest.spyOn(RewardHelper, "closeRewardPopupIfAny").mockReturnValue(false);
        (kickAutoLoop as jest.Mock).mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        localStorage.clear();
        sessionStorage.clear();
    });

    it("switches the flag on and kicks once with the loop interval", async () => {
        await RewardHelper.closeReloadingRewardPopup();
        expect(sessionStorage.getItem(HHStoredVarPrefixKey + TK.autoLoop)).toBe("true");
        expect(kickAutoLoop).toHaveBeenCalledTimes(1);
        expect(kickAutoLoop).toHaveBeenCalledWith(1234);
    });
});
