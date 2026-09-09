import { PlaceOfPower } from "../../src/Module/PlaceOfPower";
import { setStoredValue, getStoredJSON } from "../../src/Helper/StorageHelper";
import { HHStoredVarPrefixKey } from "../../src/config/HHStoredVars";
import { TK } from "../../src/config/StorageKeys";
import { Harem } from "../../src/Module/harem/Harem";
import { FeatureGate } from "../../src/Service/FeatureGate";
import { ConfigHelper } from "../../src/Helper/ConfigHelper";
import * as PageHelper from "../../src/Helper/PageHelper";
import { MockHelper } from "../testHelpers/MockHelpers";

describe("PlaceOfPower", function () {
    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    // What is left of PlaceOfPower.isEnabled once the unlock condition moved
    // into the shared table (ADR-012): the clause that keeps a run which is
    // already standing on the Place of Power page from being sent away
    // mid-work. The condition itself, and the once-per-change notice that
    // used to live here, are covered in spec/Service/FeatureGate.spec.ts.
    describe("standing on the page is not an unlock condition", function () {
        beforeEach(() => {
            MockHelper.mockDomain("www.hentaiheroes.com", "/pop.html");
            FeatureGate.forgetReportedState();
            jest.spyOn(Harem, "getGirlCount").mockReturnValue(3);
        });

        afterEach(() => {
            jest.restoreAllMocks();
            FeatureGate.forgetReportedState();
            document.body.innerHTML = "";
        });

        it("stays enabled on the Place of Power page although the gate is shut", function () {
            jest.spyOn(PageHelper, "getPage")
                .mockReturnValue(ConfigHelper.getHHScriptVars("pagesIDPowerplacemain"));

            expect(FeatureGate.isUnlocked("placeOfPower")).toBe(false);
            expect(PlaceOfPower.isEnabled()).toBe(true);
        });

        it("is disabled anywhere else while the gate is shut", function () {
            jest.spyOn(PageHelper, "getPage").mockReturnValue("home");

            expect(PlaceOfPower.isEnabled()).toBe(false);
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
