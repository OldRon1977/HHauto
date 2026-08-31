import {
    CheckShopState,
    decideCheckShop,
    needsStoreContentsForBuying,
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
