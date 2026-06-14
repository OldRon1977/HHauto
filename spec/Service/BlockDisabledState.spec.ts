import { getAutoDisabledBlocks, reactivateBlock } from "../../src/Service/BlockDisabledState";
import { getStoredValue, setStoredValue } from "../../src/Helper/StorageHelper";
import { HHStoredVarPrefixKey } from "../../src/config/HHStoredVars";
import { TK } from "../../src/config/StorageKeys";

const DKEY = HHStoredVarPrefixKey + TK.blockAutoDisabled;
const FKEY = HHStoredVarPrefixKey + TK.blockFailureCount;

describe("BlockDisabledState", () => {
    beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

    it("returns an empty map when nothing is disabled", () => {
        expect(getAutoDisabledBlocks()).toEqual({});
    });

    it("reads auto-disabled blocks", () => {
        setStoredValue(DKEY, JSON.stringify({ handleQuest: { reason: "step-timeout:x", sinceVersion: "7.37.0" } }));
        const d = getAutoDisabledBlocks();
        expect(d.handleQuest.reason).toContain("timeout");
        expect(d.handleQuest.sinceVersion).toBe("7.37.0");
    });

    it("reactivateBlock drops the disable entry and the block's failure counts", () => {
        setStoredValue(DKEY, JSON.stringify({ handleQuest: { reason: "x", sinceVersion: "7.37.0" }, handleSeason: { reason: "y", sinceVersion: "7.37.0" } }));
        setStoredValue(FKEY, JSON.stringify({ "handleQuest:fail:x": 3, "handleSeason:fail:y": 3 }));
        reactivateBlock("handleQuest");
        const d = getAutoDisabledBlocks();
        expect(d.handleQuest).toBeUndefined();
        expect(d.handleSeason).toBeDefined();              // other block untouched
        const counts = JSON.parse(getStoredValue(FKEY));
        expect(counts["handleQuest:fail:x"]).toBeUndefined();
        expect(counts["handleSeason:fail:y"]).toBe(3);
    });

    it("reactivateBlock is a no-op for an unknown block", () => {
        setStoredValue(DKEY, JSON.stringify({ handleQuest: { reason: "x", sinceVersion: "7.37.0" } }));
        reactivateBlock("handleNope");
        expect(getAutoDisabledBlocks().handleQuest).toBeDefined();
    });
});
