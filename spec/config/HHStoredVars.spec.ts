import { HHStoredVarPrefixKey, HHStoredVars } from "../../src/config/HHStoredVars";
import { SK } from "../../src/config/StorageKeys";

// Characterization tests for the two isValid regexes hardened in step 10.3-A.
// Both regexes previously used an ungrouped alternation, so the ^/$ anchors
// only bound to the first/last branch and the .test() guard (StartService /
// StorageHelper default validation) accepted any digit-prefixed garbage
// (e.g. "7abc"). These tests pin the corrected, fully-anchored domains and
// would fail against the old regexes.

type Entry = { isValid?: RegExp; default?: string };

function entryFor(key: string): Entry {
    return (HHStoredVars as Record<string, Entry>)[HHStoredVarPrefixKey + key];
}

describe("HHStoredVars isValid regexes", function () {
    describe("autoTrollSelectedIndex (valid domain 0-99)", function () {
        const entry = entryFor(SK.autoTrollSelectedIndex);

        it("accepts every index the troll selector can hold (0, 1-97, 98, 99)", function () {
            const valid = ["0", "1", "9", "10", "15", "16", "50", "97", "98", "99"];
            valid.forEach(function (v) { expect(entry.isValid!.test(v)).toBe(true); });
        });

        it("rejects out-of-range and non-numeric values", function () {
            const invalid = ["100", "-1", "7abc", "x99", "1.5", "", " ", "0a"];
            invalid.forEach(function (v) { expect(entry.isValid!.test(v)).toBe(false); });
        });

        it("accepts its registered default", function () {
            expect(entry.isValid!.test(entry.default!)).toBe(true);
        });
    });

    describe("collectAllTimer (valid domain 1-99 hours)", function () {
        const entry = entryFor(SK.collectAllTimer);

        it("accepts 1-99", function () {
            const valid = ["1", "9", "10", "12", "99"];
            valid.forEach(function (v) { expect(entry.isValid!.test(v)).toBe(true); });
        });

        it("rejects 0, >=100 and non-numeric values", function () {
            const invalid = ["0", "100", "12abc", "-5", "", ".5"];
            invalid.forEach(function (v) { expect(entry.isValid!.test(v)).toBe(false); });
        });

        it("accepts its registered default", function () {
            expect(entry.isValid!.test(entry.default!)).toBe(true);
        });
    });
});

describe("maxBooster -- the retired setting (#1844)", () => {
    const entry = () => (HHStoredVars as Record<string, Record<string, unknown>>)[HHStoredVarPrefixKey + SK.maxBooster];

    it("is still registered, so the migration can delete the stored value", () => {
        // deleteStoredValue is a no-op for an unregistered key. Removing the
        // entry outright would strand the old value in storage for good.
        expect(entry()).toBeDefined();
        expect(entry().storage).toBeDefined();
    });

    it("has no default, or setDefaults would re-create it on every page load", () => {
        // Measured in a live 8.11.0 log: with a default in place the migration
        // deleted the key and the setDefaults() call right after put it back,
        // once per page load, forever.
        expect(entry().default).toBeUndefined();
    });

    it("has no menu entry, since the amounts live in the buy list now", () => {
        expect(entry().getMenu).toBeUndefined();
        expect(entry().setMenu).toBeUndefined();
    });
});
