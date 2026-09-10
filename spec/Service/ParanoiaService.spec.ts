import { ParanoiaService } from '../../src/Service/ParanoiaService';
import { setStoredValue, getStoredValue } from '../../src/Helper/StorageHelper';
import { HHStoredVarPrefixKey } from '../../src/config/HHStoredVars';

describe("ParanoiaService", function () {
    describe("checkParanoiaSpendings", function () {
        beforeEach(() => {
            sessionStorage.clear();
        });

        it("should return -1 if paranoiaSpendings is not set", function () {
            const result = ParanoiaService.checkParanoiaSpendings();
            expect(result).toBe(-1);
        });

        it("should return the total remaining spendings if no specific spendingFunction is provided", function () {
            const spendings = new Map([
                ["quest", 10],
                ["challenge", 5],
                ["fight", 3]
            ]);
            setStoredValue(HHStoredVarPrefixKey + "Temp_paranoiaSpendings", JSON.stringify(spendings, replacerMap));

            const result = ParanoiaService.checkParanoiaSpendings();
            expect(result).toBe(18); // 10 + 5 + 3
        });

        it("should return the value for a specific spendingFunction if it exists", function () {
            const spendings = new Map([
                ["quest", 10],
                ["challenge", 5],
                ["fight", 3]
            ]);
            setStoredValue(HHStoredVarPrefixKey + "Temp_paranoiaSpendings", JSON.stringify(spendings, replacerMap));

            const result = ParanoiaService.checkParanoiaSpendings("challenge");
            expect(result).toBe(5);
        });

        it("should return -1 for a specific spendingFunction if it does not exist", function () {
            const spendings = new Map([
                ["quest", 10],
                ["challenge", 5]
            ]);
            setStoredValue(HHStoredVarPrefixKey + "Temp_paranoiaSpendings", JSON.stringify(spendings, replacerMap));

            const result = ParanoiaService.checkParanoiaSpendings("fight");
            expect(result).toBe(-1);
        });

        it("should exclude 'quest' spending if paranoiaQuestBlocked is set", function () {
            const spendings = new Map([
                ["quest", 10],
                ["challenge", 5]
            ]);
            setStoredValue(HHStoredVarPrefixKey + "Temp_paranoiaSpendings", JSON.stringify(spendings, replacerMap));
            setStoredValue(HHStoredVarPrefixKey + "Temp_paranoiaQuestBlocked", "true");

            const result = ParanoiaService.checkParanoiaSpendings();
            expect(result).toBe(5); // Only "challenge" remains
        });

        it("should exclude 'challenge' spending if paranoiaLeagueBlocked is set", function () {
            const spendings = new Map([
                ["quest", 10],
                ["challenge", 5]
            ]);
            setStoredValue(HHStoredVarPrefixKey + "Temp_paranoiaSpendings", JSON.stringify(spendings, replacerMap));
            setStoredValue(HHStoredVarPrefixKey + "Temp_paranoiaLeagueBlocked", "true");

            const result = ParanoiaService.checkParanoiaSpendings();
            expect(result).toBe(10); // Only "quest" remains
        });

        it("should reach zero once the last planned category is blocked", function () {
            // This is what the markers are for. flipParanoia treats a total of
            // 0 as "the spend-down is done" and goes into hiding; a module
            // that cannot act sets its marker, the category drops out here,
            // and the sum gets there without the energy ever being spent.
            //
            // Measured against main 8.12.4 on 2026-09-10: League logged "Can't
            // do league as could go above stay" and set the marker at
            // 08:39:43, plan [["challenge",2]]; the flip to rest followed at
            // 08:39:46.
            const spendings = new Map([
                ["challenge", 2]
            ]);
            setStoredValue(HHStoredVarPrefixKey + "Temp_paranoiaSpendings", JSON.stringify(spendings, replacerMap));
            setStoredValue(HHStoredVarPrefixKey + "Temp_paranoiaLeagueBlocked", "true");

            expect(ParanoiaService.checkParanoiaSpendings()).toBe(0);
        });
    });

    describe("clearParanoiaSpendings", function () {
        beforeEach(() => {
            sessionStorage.clear();
        });

        it("should forget the markers along with the plan", function () {
            // The markers are per spend-down window, not permanent: a module
            // blocked in one period has to be asked again in the next. Nothing
            // else resets them, so this clear is the whole lifetime.
            const spendings = new Map([
                ["quest", 10]
            ]);
            setStoredValue(HHStoredVarPrefixKey + "Temp_paranoiaSpendings", JSON.stringify(spendings, replacerMap));
            setStoredValue(HHStoredVarPrefixKey + "Temp_NextSwitch", String(Date.now() + 1000));
            setStoredValue(HHStoredVarPrefixKey + "Temp_paranoiaQuestBlocked", "true");
            setStoredValue(HHStoredVarPrefixKey + "Temp_paranoiaLeagueBlocked", "true");

            ParanoiaService.clearParanoiaSpendings();

            expect(getStoredValue(HHStoredVarPrefixKey + "Temp_paranoiaSpendings")).toBeUndefined();
            expect(getStoredValue(HHStoredVarPrefixKey + "Temp_NextSwitch")).toBeUndefined();
            expect(getStoredValue(HHStoredVarPrefixKey + "Temp_paranoiaQuestBlocked")).toBeUndefined();
            expect(getStoredValue(HHStoredVarPrefixKey + "Temp_paranoiaLeagueBlocked")).toBeUndefined();
        });
    });
});

function replacerMap(this: any, key: any, value: any) {
    const originalObject = this[key];
    if (originalObject instanceof Map) {
        return {
            dataType: 'Map',
            value: Array.from(originalObject.entries()),
        };
    } else {
        return value;
    }
}