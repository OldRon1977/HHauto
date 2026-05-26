/**
 * StorageHelper.spec.ts -- direct spec for src/Helper/StorageHelper.ts.
 *
 * Created in cluster 4.2.A (REVIEW_StorageHelper.md C1, I1, I2-A).
 * Covers the previously-untested critical paths:
 *   - setStoredValue quota-error retry path (C1, I2-A)
 *   - setStoredValue robustness against primitive throws (C1)
 *   - getStoredValue kobanUsing master-switch read without recursion (I1)
 *   - getStoredValue kobanUsing toggling between stored value and "false"
 *
 * Notes on test setup:
 *   - jsdom\'s built-in localStorage / sessionStorage cannot be made to
 *     throw on demand without monkey-patching the prototypes. We
 *     swap the relevant storages with a Proxy-based fake just for the
 *     quota cases, and restore the originals between tests.
 *   - The HHStoredVars registry is module state we cannot easily mock,
 *     so we register / deregister test keys at runtime. The script\'s
 *     real registry (configured at import time) is untouched between
 *     runs because Jest re-uses the module instance within a file but
 *     each test cleans up the keys it added.
 */

import {
    getStoredValue,
    setStoredValue,
    deleteStoredValue,
    getStoredJSON,
} from "../../src/Helper/StorageHelper";
import { HHStoredVarPrefixKey, HHStoredVars } from "../../src/config/HHStoredVars";
import { SK } from "../../src/config/StorageKeys";

const TEST_KEY = HHStoredVarPrefixKey + "Setting_storageHelperSpecKey";
const TEST_KEY_KOBAN = HHStoredVarPrefixKey + "Setting_storageHelperSpecKobanKey";
const MASTER_KEY = HHStoredVarPrefixKey + SK.spendKobans0;

interface RegistryEntry {
    storage: string;
    HHType: string;
    valueType?: string;
    default?: string;
    kobanUsing?: boolean;
}

function registerKey(key: string, entry: RegistryEntry): void {
    (HHStoredVars as Record<string, RegistryEntry>)[key] = entry;
}

function deregisterKey(key: string): void {
    delete (HHStoredVars as Record<string, RegistryEntry>)[key];
}

describe("StorageHelper -- registered key gating", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        registerKey(TEST_KEY, { storage: "localStorage", HHType: "Setting" });
    });

    afterEach(() => {
        deregisterKey(TEST_KEY);
    });

    it("returns undefined for an unregistered key", () => {
        expect(getStoredValue("HHAuto_Setting_doesNotExist")).toBeUndefined();
    });

    it("silently drops writes for an unregistered key", () => {
        setStoredValue("HHAuto_Setting_doesNotExist", "value");
        expect(localStorage.getItem("HHAuto_Setting_doesNotExist")).toBeNull();
        expect(sessionStorage.getItem("HHAuto_Setting_doesNotExist")).toBeNull();
    });

    it("round-trips a registered key through localStorage", () => {
        setStoredValue(TEST_KEY, "hello");
        expect(getStoredValue(TEST_KEY)).toBe("hello");
        expect(localStorage.getItem(TEST_KEY)).toBe("hello");
    });

    it("deletes a registered key", () => {
        setStoredValue(TEST_KEY, "hello");
        deleteStoredValue(TEST_KEY);
        expect(getStoredValue(TEST_KEY)).toBeUndefined();
    });

    it("getStoredJSON returns default for an unregistered key", () => {
        expect(getStoredJSON("HHAuto_Setting_doesNotExist", { fallback: true })).toEqual({ fallback: true });
    });
});

describe("StorageHelper -- kobanUsing master-switch (I1)", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        registerKey(TEST_KEY_KOBAN, {
            storage: "localStorage",
            HHType: "Setting",
            kobanUsing: true,
        });
    });

    afterEach(() => {
        deregisterKey(TEST_KEY_KOBAN);
    });

    it("returns the stored value when the master switch is true", () => {
        // Master switch is registered globally with storage type "Storage()",
        // which resolves to localStorage by default (settPerTab unset == false).
        localStorage.setItem(MASTER_KEY, "true");
        setStoredValue(TEST_KEY_KOBAN, "real-value");
        expect(getStoredValue(TEST_KEY_KOBAN)).toBe("real-value");
    });

    it("returns 'false' literal when the master switch is unset (treated as off)", () => {
        setStoredValue(TEST_KEY_KOBAN, "real-value");
        expect(getStoredValue(TEST_KEY_KOBAN)).toBe("false");
    });

    it("returns 'false' literal when the master switch is explicitly false", () => {
        localStorage.setItem(MASTER_KEY, "false");
        setStoredValue(TEST_KEY_KOBAN, "real-value");
        expect(getStoredValue(TEST_KEY_KOBAN)).toBe("false");
    });

    it("does not infinite-recurse when the master switch is itself flagged kobanUsing (defensive)", () => {
        // Simulate a registry typo: someone marks Setting_spendKobans0
        // itself as kobanUsing. In the old implementation this caused
        // an unbounded call stack via getStoredValue. The patched
        // implementation short-circuits via a direct storage read on
        // the master key, so this case must NOT throw RangeError.
        const masterEntry = (HHStoredVars as Record<string, RegistryEntry>)[MASTER_KEY];
        const original = masterEntry ? { ...masterEntry } : undefined;
        registerKey(MASTER_KEY, { storage: "localStorage", HHType: "Setting", kobanUsing: true });
        try {
            localStorage.setItem(MASTER_KEY, "true");
            setStoredValue(TEST_KEY_KOBAN, "real-value");
            // No assertion on the return value beyond "did not throw":
            // semantics under that broken registry are not specified.
            expect(() => getStoredValue(TEST_KEY_KOBAN)).not.toThrow();
        } finally {
            if (original) {
                registerKey(MASTER_KEY, original);
            } else {
                deregisterKey(MASTER_KEY);
            }
        }
    });
});

describe("StorageHelper -- setStoredValue catch robustness (C1, I2-A)", () => {
    // setStoredValue performs a property-assignment
    // (storage[key] = value), not a setItem call. To make a write of
    // a SPECIFIC key throw on demand, we install an Object.defineProperty
    // setter on that exact key. The setter is per-key, so it does not
    // affect cleanLogsInStorage's deletes on TK.Logging /
    // TK.LeagueOpponentList.
    function installThrowingSetter(
        storage: Storage,
        key: string,
        decideThrow: (currentCallCount: number) => unknown | null,
    ): { calls: number; restore: () => void } {
        const tracker = { calls: 0 };
        let storedValue: string | undefined;
        Object.defineProperty(storage, key, {
            configurable: true,
            get() { return storedValue; },
            set(value: string) {
                tracker.calls += 1;
                const maybeThrow = decideThrow(tracker.calls);
                if (maybeThrow !== null) {
                    throw maybeThrow as Error;
                }
                storedValue = value;
            },
        });
        return {
            get calls() { return tracker.calls; },
            restore: () => {
                // Drop the custom property descriptor and replace with
                // a plain data slot so subsequent reads in the same
                // test (and future tests) work normally. delete is the
                // cleanest way; jsdom localStorage tolerates it.
                delete (storage as unknown as Record<string, unknown>)[key];
                if (storedValue !== undefined) {
                    storage.setItem(key, storedValue);
                }
            },
        };
    }

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        registerKey(TEST_KEY, { storage: "localStorage", HHType: "Setting" });
    });

    afterEach(() => {
        deregisterKey(TEST_KEY);
    });

    it("does NOT propagate a primitive throw out of setStoredValue", () => {
        // Old `catch ({ errName, message })` block crashed with
        // TypeError when the throw was a primitive string -- you cannot
        // destructure on a string. The new catch coerces via
        // `String(e)` and survives.
        const probe = installThrowingSetter(
            localStorage,
            TEST_KEY,
            (n) => (n === 1 ? "primitive boom" : null),
        );
        try {
            expect(() => setStoredValue(TEST_KEY, "value")).not.toThrow();
            // Retry path must still have completed once the setter
            // stopped throwing.
            expect(localStorage.getItem(TEST_KEY)).toBe("value");
            expect(probe.calls).toBeGreaterThanOrEqual(2);
        } finally {
            probe.restore();
        }
    });

    it("does NOT propagate a plain-object throw without errName/message keys", () => {
        const probe = installThrowingSetter(
            localStorage,
            TEST_KEY,
            (n) => (n === 1 ? { code: 22 } : null),
        );
        try {
            expect(() => setStoredValue(TEST_KEY, "value")).not.toThrow();
            expect(localStorage.getItem(TEST_KEY)).toBe("value");
            expect(probe.calls).toBeGreaterThanOrEqual(2);
        } finally {
            probe.restore();
        }
    });

    it("retries once after a QuotaExceededError-shaped throw and succeeds", () => {
        const probe = installThrowingSetter(
            localStorage,
            TEST_KEY,
            (n) => {
                if (n === 1) {
                    const err = new Error("QuotaExceededError: storage full") as Error & { name: string };
                    err.name = "QuotaExceededError";
                    return err;
                }
                return null;
            },
        );
        try {
            setStoredValue(TEST_KEY, "value");
            expect(localStorage.getItem(TEST_KEY)).toBe("value");
            expect(probe.calls).toBeGreaterThanOrEqual(2);
        } finally {
            probe.restore();
        }
    });

    it("gives up after the second throw without infinite recursion", () => {
        const probe = installThrowingSetter(
            localStorage,
            TEST_KEY,
            () => {
                const err = new Error("permanent quota") as Error & { name: string };
                err.name = "QuotaExceededError";
                return err;
            },
        );
        try {
            expect(() => setStoredValue(TEST_KEY, "value")).not.toThrow();
            // Two attempts: original write + one retry. No third call
            // because the catch with retry=true falls through.
            expect(probe.calls).toBe(2);
        } finally {
            probe.restore();
        }
    });
});
