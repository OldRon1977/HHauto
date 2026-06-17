import { handlePageSpecific } from "../../src/Service/AutoLoopPageHandlers";
import { AutoLoopContext } from "../../src/Service/AutoLoopContext";
import { Season } from "../../src/Module/Events/Season";
import { ConfigHelper } from "../../src/Helper/ConfigHelper";
import { MockHelper } from "../testHelpers/MockHelpers";

// Regression guard for issue #1722.
//
// The season_arena page handler used to do:
//   Season.moduleSimSeasonBattle = callItOnce(Season.moduleSimSeasonBattle);
//   Season.moduleSimSeasonBattle();
// callItOnce REPLACED the shared static method. Season.run() calls the very
// same method to pick an opponent; once the display preview had consumed the
// single allowed call, run() received undefined, fell into the fight branch
// with [data-opponent=undefined], found no fight link and armed a ~30 min
// timer -- Season looked like it stopped after one fight.
//
// The handler must run the preview WITHOUT poisoning the shared method.

function makeCtx(page: string, lastAction: string): AutoLoopContext {
    return {
        busy: false,
        lastActionPerformed: lastAction,
        currentPower: 0,
        canCollectCompetitionActive: true,
        eventIDs: [],
        bossBangEventIDs: [],
        currentPage: page,
    };
}

describe("handlePageSpecific season_arena (issue #1722)", function () {

    beforeEach(() => {
        MockHelper.mockDomain();
        MockHelper.mockPage("season_arena");
        MockHelper.mockSetting("showCalculatePower", "true");
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("does not poison Season.moduleSimSeasonBattle: run() still gets a real result", async () => {
        const simSpy = jest.spyOn(Season, "moduleSimSeasonBattle").mockResolvedValue(42 as any);
        jest.spyOn(Season, "stylesBattle").mockImplementation(() => {});

        const ctx = makeCtx(ConfigHelper.getHHScriptVars("pagesIDSeasonArena"), "none");
        await handlePageSpecific(ctx); // display preview -> call #1

        // Simulate Season.run() asking for the chosen opponent afterwards.
        const result = await Season.moduleSimSeasonBattle(true); // call #2

        expect(simSpy).toHaveBeenCalledTimes(2);
        expect(result).toBe(42);
    });

    it("skips the preview when arriving straight from a Season fight", async () => {
        const simSpy = jest.spyOn(Season, "moduleSimSeasonBattle").mockResolvedValue(7 as any);
        jest.spyOn(Season, "stylesBattle").mockImplementation(() => {});

        const ctx = makeCtx(ConfigHelper.getHHScriptVars("pagesIDSeasonArena"), "season");
        await handlePageSpecific(ctx);

        expect(simSpy).not.toHaveBeenCalled();
    });
});
