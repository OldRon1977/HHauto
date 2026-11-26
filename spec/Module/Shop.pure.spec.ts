import {
    armorIdFromSlotData,
    CheckShopState,
    decideCheckShop,
    isSlotLocked,
    needsStoreContentsForBuying,
    parseSellMaxItems,
    pruneLockOverrides,
    readSellMenuPrefs,
    ruleKeyFromCellFilter,
    ruleKeyFromSlotData,
    setLockOverride,
    setLockRules,
} from "../../src/Module/Shop.pure";

/**
 * Pure-function tests for the market-visit trigger.
 *
 * The regression these guard: with only autoBuyBoosters enabled the gate
 * returned false, so the bot never navigated to /shop.html, storeContents
 * was never cached and Market.doShopping returned on its first guard --
 * the buy path was dead while the equip path (needBoosterStatus) worked.
 */
describe("decideCheckShop", () => {
    const buildState = (overrides: Partial<CheckShopState> = {}): CheckShopState => ({
        updateMarket: false,
        needBoosterStatus: false,
        autoBuyBoosters: false,
        autoBuyBoostersFilter: "B1:10;B2:10;B3:10;B4:10",
        paranoia: false,
        paranoiaSwitchReady: true,
        ...overrides,
    });

    it("returns false when no market consumer is enabled", () => {
        expect(decideCheckShop(buildState())).toBe(false);
    });

    it("returns true for the updateMarket reader alone", () => {
        expect(decideCheckShop(buildState({ updateMarket: true }))).toBe(true);
    });

    it("returns true for the booster-status readers alone (equip path)", () => {
        expect(decideCheckShop(buildState({ needBoosterStatus: true }))).toBe(true);
    });

    it("returns true for autoBuyBoosters alone (the regression)", () => {
        expect(decideCheckShop(buildState({ autoBuyBoosters: true }))).toBe(true);
    });

    it("stays false when autoBuyBoosters is on but the filter is empty", () => {
        expect(decideCheckShop(buildState({ autoBuyBoosters: true, autoBuyBoostersFilter: "" }))).toBe(false);
    });

    it("stays false when the filter holds only separators", () => {
        expect(decideCheckShop(buildState({ autoBuyBoosters: true, autoBuyBoostersFilter: ";; ;" }))).toBe(false);
    });

    it("accepts a single-code filter", () => {
        expect(decideCheckShop(buildState({ autoBuyBoosters: true, autoBuyBoostersFilter: "MB9:5" }))).toBe(true);
    });

    it("blocks the visit in paranoia mode while no burst window is pending", () => {
        expect(decideCheckShop(buildState({ autoBuyBoosters: true, paranoia: true, paranoiaSwitchReady: true }))).toBe(false);
    });

    it("allows the visit in paranoia mode inside a burst window", () => {
        expect(decideCheckShop(buildState({ autoBuyBoosters: true, paranoia: true, paranoiaSwitchReady: false }))).toBe(true);
    });

    it("keeps blocking in paranoia mode for the pre-existing readers too", () => {
        expect(decideCheckShop(buildState({ updateMarket: true, paranoia: true, paranoiaSwitchReady: true }))).toBe(false);
    });
});

describe("needsStoreContentsForBuying", () => {
    const buildState = (overrides: Partial<CheckShopState> = {}): CheckShopState => ({
        updateMarket: false,
        needBoosterStatus: false,
        autoBuyBoosters: false,
        autoBuyBoostersFilter: "B1:10",
        paranoia: false,
        paranoiaSwitchReady: true,
        ...overrides,
    });

    it("is false while the opt-in is off, whatever the filter says", () => {
        expect(needsStoreContentsForBuying(buildState({ autoBuyBoostersFilter: "B1:10;B2:10" }))).toBe(false);
    });

    it("is true once the opt-in is on and at least one code is listed", () => {
        expect(needsStoreContentsForBuying(buildState({ autoBuyBoosters: true }))).toBe(true);
    });
});

describe("Sell dialog presets (#1948)", function () {
    // data-d in the measured form: name_add and subtype are numbers followed by a comma.
    const dataD = (id: number, nameAdd: number | null, subtype: number, rarity: string) =>
        `{"id_member_armor":${id},"item":{${nameAdd === null ? '' : `"name_add":${nameAdd},`}"rarity":"${rarity}","type":"armor"},"skin":{"subtype":${subtype},"wearer":"hero"}}`;

    it("reads the amount to load as all or a whole number", function () {
        expect(parseSellMaxItems("all")).toBe(Number.POSITIVE_INFINITY);
        expect(parseSellMaxItems(" ALL ")).toBe(Number.POSITIVE_INFINITY);
        expect(parseSellMaxItems("100")).toBe(100);
        expect(parseSellMaxItems("0")).toBe(0);
        expect(parseSellMaxItems("")).toBeNull();
        expect(parseSellMaxItems("1e5")).toBeNull();
        expect(parseSellMaxItems("-3")).toBeNull();
    });

    it("fills missing or broken stored values with the defaults", function () {
        expect(readSellMenuPrefs(undefined)).toEqual({ maxItems: "all", sellNumber: 0, lockRules: [], lockOverrides: {} });
        expect(readSellMenuPrefs("x")).toEqual({ maxItems: "all", sellNumber: 0, lockRules: [], lockOverrides: {} });
        expect(readSellMenuPrefs({ maxItems: "abc", sellNumber: -1, lockRules: "rare", lockOverrides: { 5: "yes", 6: false } }))
            .toEqual({ maxItems: "all", sellNumber: 0, lockRules: [], lockOverrides: { 6: false } });
        expect(readSellMenuPrefs({ maxItems: "100", sellNumber: 12, lockRules: ["8;3;rare", "8;3;rare", 4], lockOverrides: {} }))
            .toEqual({ maxItems: "100", sellNumber: 12, lockRules: ["8;3;rare"], lockOverrides: {} });
    });

    it("keys a slot by the cell it is counted in", function () {
        expect(ruleKeyFromSlotData(dataD(1, 8, 3, "rare"))).toBe("8;3;rare");
        expect(ruleKeyFromSlotData(dataD(1, 16, 6, "legendary"))).toBe("16;6;legendary");
        expect(ruleKeyFromSlotData(dataD(1, null, 2, "mythic"))).toBe("mythic;2;mythic");
        expect(ruleKeyFromSlotData(dataD(1, 5, 2, "mythic"))).toBe("mythic;2;mythic");
        expect(ruleKeyFromCellFilter("c:8;t:3;r:rare")).toBe("8;3;rare");
        expect(ruleKeyFromCellFilter("c:*;t:*;r:rare")).toBeNull();
        expect(armorIdFromSlotData(dataD(1234, 8, 3, "rare"))).toBe("1234");
    });

    it("adds and removes rules for the cells of a click", function () {
        const rules = setLockRules([], ["1;1;rare", "1;2;rare"], true);
        expect(rules).toEqual(["1;1;rare", "1;2;rare"]);
        expect(setLockRules(rules, ["1;2;rare", "1;3;rare"], false)).toEqual(["1;1;rare"]);
    });

    it("lets the exception of one item win over its cell in both directions", function () {
        const prefs = readSellMenuPrefs({ lockRules: ["8;3;rare"], lockOverrides: { 1: false, 2: true } });
        expect(isSlotLocked(prefs, "8;3;rare", "1")).toBe(false);
        expect(isSlotLocked(prefs, "8;3;rare", "3")).toBe(true);
        expect(isSlotLocked(prefs, "1;1;epic", "2")).toBe(true);
        expect(isSlotLocked(prefs, "1;1;epic", "4")).toBe(false);
        expect(isSlotLocked(prefs, null, null)).toBe(false);
    });

    it("stores an exception only where the item differs from its cell", function () {
        const prefs = readSellMenuPrefs({ lockRules: ["8;3;rare"] });
        expect(setLockOverride(prefs, "8;3;rare", "1", true)).toEqual({});
        expect(setLockOverride(prefs, "8;3;rare", "1", false)).toEqual({ 1: false });
        expect(setLockOverride(prefs, "1;1;epic", "2", true)).toEqual({ 2: true });
        const withOne = readSellMenuPrefs({ lockRules: ["8;3;rare"], lockOverrides: { 1: false } });
        expect(setLockOverride(withOne, "8;3;rare", "1", true)).toEqual({});
    });

    it("drops exceptions of items that are gone", function () {
        expect(pruneLockOverrides({ 1: true, 2: false, 3: true }, ["1", "3", "9"])).toEqual({ 1: true, 3: true });
    });
});
