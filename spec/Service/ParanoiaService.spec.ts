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
    });
});

function replacerMap(key, value) {
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