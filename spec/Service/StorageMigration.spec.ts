import { isJSON, safeJsonParse } from "../../src/Utils/index";
import { getStoredJSON, getStoredValue, setStoredValue } from "../../src/Helper/StorageHelper";
import { HHStoredVarPrefixKey, SK, TK } from "../../src/config/index";
import { loadFixture } from "../testHelpers/Fixtures";

/**
 * Storage migration spec -- stage 4 task 4.2.
 *
 * Stage-4 reliability: when an HHAuto release reads a storage value
 * that was written by an older release (different format, different
 * type, missing key, broken JSON), the reader must not throw. The
 * default value falls in if the input cannot be parsed.
 *
 * The spec exercises three layers:
 *   1. `safeJsonParse` -- the central try/catch + default-value helper
 *   2. `isJSON` -- the regex-based pre-check used as a guard before
 *      direct `JSON.parse` calls in modules
 *   3. `getStoredJSON` -- the public reader that delegates to
 *      `safeJsonParse`
 *
 * Plus a smoke pass over a real settings snapshot from
 * `INPUT/HH_DebugLog_*.log` to confirm that current production
 * payloads survive the readers without crashing.
 */

interface SettingSnapshot {
    [prefixedKey: string]: string;
}

describe("storage migration -- safeJsonParse", () => {
    it("returns the default for undefined input", () => {
        expect(safeJsonParse(undefined, "fallback")).toBe("fallback");
    });

    it("returns the default for null input", () => {
        expect(safeJsonParse(null, "fallback")).toBe("fallback");
    });

    it("returns the default for an empty string", () => {
        expect(safeJsonParse("", { ok: false })).toEqual({ ok: false });
    });

    it("returns the default for malformed JSON", () => {
        expect(safeJsonParse("{not: json}", [])).toEqual([]);
        expect(safeJsonParse("[1,2,", [])).toEqual([]);
        expect(safeJsonParse("undefined", null)).toBeNull();
    });

    it("parses well-formed JSON arrays", () => {
        expect(safeJsonParse("[]", null)).toEqual([]);
        expect(safeJsonParse("[1,2,3]", null)).toEqual([1, 2, 3]);
    });

    it("parses well-formed JSON objects", () => {
        expect(safeJsonParse('{"a":1,"b":"x"}', null)).toEqual({ a: 1, b: "x" });
    });

    it("parses JSON primitives", () => {
        expect(safeJsonParse("true", null)).toBe(true);
        expect(safeJsonParse("false", null)).toBe(false);
        expect(safeJsonParse("42", null)).toBe(42);
        expect(safeJsonParse('"hello"', null)).toBe("hello");
    });

    it("supports a reviver callback", () => {
        const result = safeJsonParse<{ x: number }>(
            '{"x":3}',
            { x: 0 },
            (key, value) => (key === "x" ? value * 2 : value),
        );
        expect(result.x).toBe(6);
    });

    it("falls back if the reviver throws", () => {
        const result = safeJsonParse(
            '{"x":1}',
            { fallback: true },
            () => { throw new Error("boom"); },
        );
        expect(result).toEqual({ fallback: true });
    });
});

describe("storage migration -- isJSON", () => {
    it.each([
        [undefined, false],
        [null, false],
        ["", false],
        ["   ", false],
    ])("rejects empty/whitespace-ish input %p", (input, expected) => {
        expect(isJSON(input)).toBe(expected);
    });

    it("recognises JSON arrays and objects", () => {
        expect(isJSON("[]")).toBe(true);
        expect(isJSON("[1,2,3]")).toBe(true);
        expect(isJSON('{"a":1}')).toBe(true);
    });

    it("recognises JSON primitives", () => {
        expect(isJSON("true")).toBe(true);
        expect(isJSON("false")).toBe(true);
        expect(isJSON("null")).toBe(true);
        expect(isJSON("42")).toBe(true);
        expect(isJSON('"hello"')).toBe(true);
    });

    it("rejects clearly malformed JSON", () => {
        // isJSON is the pre-check used in front of `JSON.parse` calls
        // in modules. It is intentionally regex-based and not as strict
        // as `JSON.parse` itself -- some malformed payloads slip through
        // (e.g. `"[1,2,"`). The hard guard against malformed input
        // remains `safeJsonParse`, which catches the real `JSON.parse`
        // exception. The cases below are the unambiguous rejects.
        expect(isJSON("{not: json}")).toBe(false);
        expect(isJSON("undefined")).toBe(false);
        expect(isJSON("not-json-at-all")).toBe(false);
    });

    it("documents the known liberal-regex behavior", () => {
        // Trailing-comma input slips through the regex pre-check.
        // Callers must still wrap the parse in safeJsonParse (try/catch).
        expect(isJSON("[1,2,")).toBe(true);
        // The matching safeJsonParse call must not blow up:
        expect(safeJsonParse("[1,2,", null)).toBeNull();
    });
});

describe("storage migration -- getStoredJSON", () => {
    const KEY = HHStoredVarPrefixKey + SK.autoSeasonCollectablesList;

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it("returns the default when the key is missing from storage", () => {
        expect(getStoredJSON(KEY, ["default-marker"])).toEqual(["default-marker"]);
    });

    it("returns the default when the key is the empty string", () => {
        setStoredValue(KEY, "");
        expect(getStoredJSON(KEY, ["default-marker"])).toEqual(["default-marker"]);
    });

    it("returns the default when the stored value is malformed JSON", () => {
        setStoredValue(KEY, "{not: json}");
        expect(getStoredJSON(KEY, ["default-marker"])).toEqual(["default-marker"]);
    });

    it("returns the default for an unregistered key (getStoredValue -> undefined)", () => {
        expect(getStoredJSON("HHAuto_Setting_does_not_exist", { ok: false })).toEqual({ ok: false });
    });

    it("parses a well-formed JSON-array stored value", () => {
        setStoredValue(KEY, "[1,2,3]");
        expect(getStoredJSON<number[]>(KEY, [])).toEqual([1, 2, 3]);
    });

    it("parses a well-formed JSON-object stored value", () => {
        // pick a key that accepts an object payload via the storage round-trip
        const haremSizeKey = HHStoredVarPrefixKey + TK.HaremSize;
        setStoredValue(haremSizeKey, JSON.stringify({ count: 1716, count_date: 1715000000 }));
        const result = getStoredJSON<{ count: number; count_date: number }>(haremSizeKey, { count: 0, count_date: 0 });
        expect(result).toEqual({ count: 1716, count_date: 1715000000 });
    });
});

describe("storage migration -- real snapshot smoke", () => {
    let snapshot: SettingSnapshot;

    beforeAll(() => {
        snapshot = loadFixture("storage-snapshot", "setting-snapshot") as SettingSnapshot;
    });

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it("loads with at least one localStorage and one sessionStorage entry", () => {
        const localKeys = Object.keys(snapshot).filter(k => k.startsWith("localStorage."));
        const sessionKeys = Object.keys(snapshot).filter(k => k.startsWith("sessionStorage."));
        expect(localKeys.length).toBeGreaterThan(0);
        expect(sessionKeys.length).toBeGreaterThan(0);
    });

    it("hydrates every snapshot entry into the matching storage and reads it back via getStoredValue", () => {
        for (const [prefixedKey, value] of Object.entries(snapshot)) {
            const [bucket, ...rest] = prefixedKey.split(".");
            const key = rest.join(".");
            if (bucket === "localStorage") {
                window.localStorage.setItem(key, value);
            } else if (bucket === "sessionStorage") {
                window.sessionStorage.setItem(key, value);
            } else {
                throw new Error(`Unexpected bucket prefix: ${bucket}`);
            }
        }
        for (const prefixedKey of Object.keys(snapshot)) {
            const key = prefixedKey.split(".").slice(1).join(".");
            // Some keys are not registered in HHStoredVars -- getStoredValue then returns undefined.
            // The contract under test is no-throw; both undefined and the original value are acceptable.
            expect(() => getStoredValue(key)).not.toThrow();
        }
    });

    it("forces every snapshot value through getStoredJSON without throwing", () => {
        for (const [prefixedKey, value] of Object.entries(snapshot)) {
            const [bucket, ...rest] = prefixedKey.split(".");
            const key = rest.join(".");
            if (bucket === "localStorage") {
                window.localStorage.setItem(key, value);
            } else if (bucket === "sessionStorage") {
                window.sessionStorage.setItem(key, value);
            }
            // Default is an empty array; the call must return either the parsed value
            // (for the JSON-array payloads in the fixture) or the default for the
            // non-JSON entries -- never throw.
            expect(() => getStoredJSON(key, [] as unknown[])).not.toThrow();
        }
    });
});
