/**
 * ConfigImport.spec.ts -- myfileLoad_onReaderLoad, #1846.
 *
 * saveHHVarsSettingsAsJSON exports every registered Setting, and extractHHVars
 * deliberately writes null for the ones the user never touched. Loading such a
 * file back used to assign that null straight into Web Storage, which
 * stringifies it to "null". JSON.parse("null") then succeeds, so a reward
 * filter read as an array came back as null and the next .includes() threw.
 *
 * These tests assert that the key is not written at all, not that it avoids
 * the text "null": jsdom's Storage does not apply the DOMString conversion a
 * real browser does, so `storage[key] = null` reads back as null here while it
 * reads back as "null" in Chrome. The stringification itself was verified in
 * the browser (issue #1846); what this spec guards is the write that feeds it.
 */
import { myfileLoad_onReaderLoad } from "../../src/Utils/Utils";
import { HHStoredVarPrefixKey, HHStoredVars } from "../../src/config/HHStoredVars";
import { SK } from "../../src/config/StorageKeys";

jest.mock("../../src/Service/PageNavigationService", () => ({
    safeReload: jest.fn(),
    gotoPage: jest.fn(),
    safeNavigateHref: jest.fn(),
    addNutakuSession: jest.fn((x: unknown) => x),
}));

const LIST_KEY = HHStoredVarPrefixKey + SK.autoPoACollectablesList;
const TIMER_KEY = HHStoredVarPrefixKey + SK.collectAllTimer;

function load(settings: Record<string, unknown>): void {
    document.body.innerHTML = '<p id="LoadConfError"></p>';
    myfileLoad_onReaderLoad({ target: { result: JSON.stringify(settings) } });
}

describe("config import -- null handling", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    afterEach(() => {
        document.body.innerHTML = "";
        localStorage.clear();
    });

    it("does not create a key for a setting the export left null", () => {
        load({ ["localStorage." + LIST_KEY]: null });
        expect(Object.keys(localStorage)).not.toContain(LIST_KEY);
        expect(localStorage.length).toBe(0);
    });

    it("leaves an existing value alone when the file carries null for that key", () => {
        localStorage.setItem(LIST_KEY, '["girl"]');
        load({ ["localStorage." + LIST_KEY]: null });
        expect(localStorage.getItem(LIST_KEY)).toBe('["girl"]');
    });

    it("still writes the values that are present", () => {
        load({
            ["localStorage." + LIST_KEY]: '["energy_fight"]',
            ["localStorage." + TIMER_KEY]: "6",
        });
        expect(localStorage.getItem(LIST_KEY)).toBe('["energy_fight"]');
        expect(localStorage.getItem(TIMER_KEY)).toBe("6");
    });

    it("reports a broken file instead of writing anything", () => {
        document.body.innerHTML = '<p id="LoadConfError"></p>';
        myfileLoad_onReaderLoad({ target: { result: "{not json" } });
        expect(document.getElementById("LoadConfError")?.innerText).toBe("Selected file broken!");
        expect(Object.keys(localStorage).length).toBe(0);
    });

    it("writes nothing at all for an export whose Settings are all null", () => {
        // The reported config had null for PoA, PoG, PoV, Season, Penta Drill,
        // DP, Lively Scene and Seasonal at once -- exactly the shape of an
        // export from a profile that never opened those menus.
        const file: Record<string, unknown> = {};
        let settingCount = 0;
        for (const key of Object.keys(HHStoredVars)) {
            if ((HHStoredVars as Record<string, { HHType?: string }>)[key].HHType !== "Setting") continue;
            file["localStorage." + key] = null;
            settingCount++;
        }
        expect(settingCount).toBeGreaterThan(50);
        load(file);
        expect(localStorage.length).toBe(0);
    });
});
