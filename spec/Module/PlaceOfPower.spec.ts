import { PlaceOfPower } from "../../src/Module/PlaceOfPower";
import { setStoredValue, getStoredJSON } from "../../src/Helper/StorageHelper";
import { HHStoredVarPrefixKey } from "../../src/config/HHStoredVars";
import { TK } from "../../src/config/StorageKeys";
import { Harem } from "../../src/Module/harem/Harem";
import * as LogUtils from "../../src/Utils/LogUtils";

describe("PlaceOfPower", function () {
    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    // isActivated() calls isEnabled() on every pipeline tick. Measured over
    // one 12-minute run, the ten-girl notice filled 692 of 2532 log lines --
    // 27 percent of the log, across 24 page loads.
    describe("the ten-girl notice does not repeat on every tick", function () {
        // The memo lives at module scope and is not reset between tests, so
        // each case below uses a count the ones before it did not.
        let logged: string[];

        beforeEach(() => {
            logged = [];
            jest.spyOn(LogUtils, 'logHHAuto').mockImplementation((...args: unknown[]) => {
                logged.push(String(args[0]));
            });
        });

        afterEach(() => { jest.restoreAllMocks(); });

        it("says it once for a given count, however often it is asked", function () {
            jest.spyOn(Harem, 'getGirlCount').mockReturnValue(9);

            PlaceOfPower.isEnabled();
            PlaceOfPower.isEnabled();
            PlaceOfPower.isEnabled();

            const notices = logged.filter(l => l.includes('needs 10 girls'));
            expect(notices).toHaveLength(1);
            expect(notices[0]).toContain('the harem holds 9');
        });

        it("says it again once the count has moved", function () {
            jest.spyOn(Harem, 'getGirlCount').mockReturnValue(7);
            PlaceOfPower.isEnabled();
            jest.spyOn(Harem, 'getGirlCount').mockReturnValue(8);
            PlaceOfPower.isEnabled();

            expect(logged.filter(l => l.includes('needs 10 girls'))).toHaveLength(2);
        });

        it("says nothing once the harem is big enough", function () {
            jest.spyOn(Harem, 'getGirlCount').mockReturnValue(10);

            PlaceOfPower.isEnabled();

            expect(logged.filter(l => l.includes('needs 10 girls'))).toHaveLength(0);
        });
    });

    describe("removePopFromPopToStart", function () {
        it("removes a number index from the JSON array", function () {
            setStoredValue(HHStoredVarPrefixKey + TK.PopToStart, JSON.stringify([1, 2, 3, 5]));

            PlaceOfPower.removePopFromPopToStart(2);

            const result = getStoredJSON<number[]>(HHStoredVarPrefixKey + TK.PopToStart, []);
            expect(result).toEqual([1, 3, 5]);
        });

        it("removes a string index from the JSON array (Number coercion)", function () {
            setStoredValue(HHStoredVarPrefixKey + TK.PopToStart, JSON.stringify([1, 2, 3, 5]));

            // Pre-fix this would not match (epop != index used loose equality but
            // the post-fix uses strict comparison after Number coercion). Either
            // way, the canonical use case is stripping `index` from the list.
            PlaceOfPower.removePopFromPopToStart("3");

            const result = getStoredJSON<number[]>(HHStoredVarPrefixKey + TK.PopToStart, []);
            expect(result).toEqual([1, 2, 5]);
        });

        it("leaves the list unchanged when the index is not present", function () {
            setStoredValue(HHStoredVarPrefixKey + TK.PopToStart, JSON.stringify([1, 2, 3]));

            PlaceOfPower.removePopFromPopToStart(99);

            const result = getStoredJSON<number[]>(HHStoredVarPrefixKey + TK.PopToStart, []);
            expect(result).toEqual([1, 2, 3]);
        });

        it("leaves the list empty when the source is empty", function () {
            setStoredValue(HHStoredVarPrefixKey + TK.PopToStart, JSON.stringify([]));

            PlaceOfPower.removePopFromPopToStart(1);

            const result = getStoredJSON<number[]>(HHStoredVarPrefixKey + TK.PopToStart, []);
            expect(result).toEqual([]);
        });
    });

    describe("addPopToUnableToStart", function () {
        it("writes the index as a string when the list is empty", function () {
            PlaceOfPower.addPopToUnableToStart(5, "test message");

            // Storage round-trips numbers as strings; the stored value is the
            // semicolon-joined string form.
            expect(sessionStorage.getItem(HHStoredVarPrefixKey + TK.PopUnableToStart)).toBe("5");
        });

        it("appends to an existing list", function () {
            setStoredValue(HHStoredVarPrefixKey + TK.PopUnableToStart, "1;3");

            PlaceOfPower.addPopToUnableToStart(7, "test message");

            expect(sessionStorage.getItem(HHStoredVarPrefixKey + TK.PopUnableToStart)).toBe("1;3;7");
        });
    });

    describe("cleanTempPopToStart", function () {
        it("clears both temp keys", function () {
            setStoredValue(HHStoredVarPrefixKey + TK.PopUnableToStart, "1;2;3");
            setStoredValue(HHStoredVarPrefixKey + TK.PopToStart, JSON.stringify([4, 5]));

            PlaceOfPower.cleanTempPopToStart();

            expect(sessionStorage.getItem(HHStoredVarPrefixKey + TK.PopUnableToStart)).toBeNull();
            expect(sessionStorage.getItem(HHStoredVarPrefixKey + TK.PopToStart)).toBeNull();
        });
    });
});
