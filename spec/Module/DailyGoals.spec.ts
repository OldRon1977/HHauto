import { DailyGoals } from "../../src/Module/DailyGoals";
import { setStoredValue, getStoredJSON } from "../../src/Helper/StorageHelper";
import { HHStoredVarPrefixKey } from "../../src/config/HHStoredVars";
import { TK } from "../../src/config/StorageKeys";
import { MockHelper } from "../testHelpers/MockHelpers";

describe("DailyGoals", function () {
    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        delete (unsafeWindow as any).daily_goals_list;
    });

    describe("parse", function () {
        it("parses supported goals (pantheon) on the daily-goals page", function () {
            MockHelper.mockDomain("www.hentaiheroes.com", "activities.html", "tab=daily_goals");
            MockHelper.mockPage("daily_goals");
            (unsafeWindow as any).daily_goals_list = [
                { anchor: "/pantheon.html", progress_data: { current: 0, max: 5 } },
                { anchor: "/some-other.html", progress_data: { current: 0, max: 5 } },
            ];

            const result = DailyGoals.parse();

            expect(result).toHaveLength(1);
            expect(result[0].anchor).toBe("/pantheon.html");
            // cache written with the parsed goals
            const cached = getStoredJSON<any[]>(HHStoredVarPrefixKey + TK.dailyGoalsList, []);
            expect(cached).toHaveLength(1);
        });

        it("does NOT overwrite the cache when called on a non-daily-goals page", function () {
            // Seed the cache as if a previous daily-goals visit had parsed a
            // pantheon goal.
            const seeded = [{ anchor: "/pantheon.html", progress_data: { current: 0, max: 5 } }];
            setStoredValue(HHStoredVarPrefixKey + TK.dailyGoalsList, JSON.stringify(seeded));

            // Now parse() fires as a page handler on the contests page, where
            // unsafeWindow.daily_goals_list is undefined.
            MockHelper.mockDomain("www.hentaiheroes.com", "contests.html");
            MockHelper.mockPage("contests");

            const result = DailyGoals.parse();

            // Pre-fix this returned [] and wrote [] to the cache, wiping the
            // pantheon goal so isPantheonDailyGoal() reported false. Post-fix
            // the cache is preserved and returned untouched.
            expect(result).toHaveLength(1);
            expect(result[0].anchor).toBe("/pantheon.html");
            const cached = getStoredJSON<any[]>(HHStoredVarPrefixKey + TK.dailyGoalsList, []);
            expect(cached).toHaveLength(1);
            expect(cached[0].anchor).toBe("/pantheon.html");
        });

        it("returns the empty cache when called off-page with no prior cache", function () {
            MockHelper.mockDomain("www.hentaiheroes.com", "contests.html");
            MockHelper.mockPage("contests");

            const result = DailyGoals.parse();

            expect(result).toEqual([]);
        });

        it("skips completed goals (current >= max)", function () {
            MockHelper.mockDomain("www.hentaiheroes.com", "activities.html", "tab=daily_goals");
            MockHelper.mockPage("daily_goals");
            (unsafeWindow as any).daily_goals_list = [
                { anchor: "/pantheon.html", progress_data: { current: 5, max: 5 } },
            ];

            const result = DailyGoals.parse();

            expect(result).toEqual([]);
        });
    });
});
