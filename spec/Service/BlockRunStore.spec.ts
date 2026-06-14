import {
    saveBlockRun,
    loadBlockRun,
    clearBlockRun,
} from "../../src/Service/BlockRunStore";
import { HHStoredVarPrefixKey } from "../../src/config/HHStoredVars";
import { TK } from "../../src/config/StorageKeys";
import { BlockRun } from "../../src/Service/BlockTypes";

const KEY = HHStoredVarPrefixKey + TK.activeBlockRun;

function sampleRun(over: Partial<BlockRun> = {}): BlockRun {
    return {
        blockId: "Quest",
        stepIdx: 2,
        startedAt: 1000,
        stepStartedAt: 1500,
        dispatched: false,
        data: { cursor: 3 },
        ...over,
    };
}

describe("BlockRunStore", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it("returns null when nothing is stored", () => {
        expect(loadBlockRun()).toBeNull();
    });

    it("round-trips a BlockRun through save -> load (simulated reload)", () => {
        const run = sampleRun();
        saveBlockRun(run);
        // Simulate a reload: a new load() reads the same sessionStorage.
        const restored = loadBlockRun();
        expect(restored).toEqual(run);
    });

    it("preserves nested data (repeat cursor) across the round-trip", () => {
        saveBlockRun(sampleRun({ data: { cursor: 7, ids: ["a", "b"] } }));
        expect(loadBlockRun()!.data).toEqual({ cursor: 7, ids: ["a", "b"] });
    });

    it("clear() removes the stored run", () => {
        saveBlockRun(sampleRun());
        clearBlockRun();
        expect(loadBlockRun()).toBeNull();
    });

    it("returns null for a corrupt (non-JSON) stored value", () => {
        sessionStorage.setItem(KEY, "{not json");
        expect(loadBlockRun()).toBeNull();
    });

    it("returns null for a structurally invalid stored object", () => {
        sessionStorage.setItem(KEY, JSON.stringify({ blockId: "X" })); // missing fields
        expect(loadBlockRun()).toBeNull();
    });

    it("overwrites a previous run on save", () => {
        saveBlockRun(sampleRun({ stepIdx: 1 }));
        saveBlockRun(sampleRun({ stepIdx: 5 }));
        expect(loadBlockRun()!.stepIdx).toBe(5);
    });
});
