import { Market } from "../../src/Module/Market";
import { getStoredJSON, getStoredValue, setStoredValue } from "../../src/Helper/StorageHelper";
import { HHStoredVarPrefixKey } from "../../src/config/HHStoredVars";
import { SK, TK } from "../../src/config/StorageKeys";
import { loadFixture } from "../testHelpers/Fixtures";
import { logHHAuto } from "../../src/Utils/LogUtils";

// PageNavigationService is mocked so the referer juggling in doShopping does
// not touch window.location. All four commonly-used exports are stubbed
// because transitive importers reference them at call time (see Shop.spec).
jest.mock("../../src/Service/PageNavigationService", () => ({
    gotoPage: jest.fn().mockReturnValue(true),
    safeReload: jest.fn(),
    safeNavigateHref: jest.fn(),
    addNutakuSession: jest.fn((x: unknown) => x),
}));

// LogUtils is mocked so the "no store contents cached yet" / "could not
// parse" distinction can be asserted without scraping the real log store.
jest.mock("../../src/Utils/LogUtils", () => ({
    logHHAuto: jest.fn(),
}));

// Anonymised market snapshot: shop[1] = koban boosters, shop[2] = gifts
// (400 ymens in "sc" items), shop[3] = potions (450 ymens in "sc" items).
const storeFixture = () => JSON.parse(JSON.stringify(loadFixture("market", "store-contents")));

describe("Market.doShopping", () => {

    let ajaxSpy: jest.Mock;

    function mockHero(money: number, kobans: number) {
        ajaxSpy = jest.fn((_params: any, successCb: (data: any) => void) => {
            successCb({ success: true, changes: {} });
        });
        unsafeWindow.shared = {
            Hero: {
                infos: { class: 1 },
                currencies: { soft_currency: money, hard_currency: kobans },
                updates: jest.fn(),
            },
            general: { hh_ajax: ajaxSpy },
        } as any;
    }

    function setBaseline() {
        setStoredValue(HHStoredVarPrefixKey + SK.autoBuyBoosters, "false");
        setStoredValue(HHStoredVarPrefixKey + SK.autoBuyBoostersFilter, "");
        setStoredValue(HHStoredVarPrefixKey + SK.autoAffW, "false");
        setStoredValue(HHStoredVarPrefixKey + SK.autoExpW, "false");
        setStoredValue(HHStoredVarPrefixKey + SK.autoAff, "0");
        setStoredValue(HHStoredVarPrefixKey + SK.autoExp, "0");
        setStoredValue(HHStoredVarPrefixKey + SK.maxAff, "0");
        setStoredValue(HHStoredVarPrefixKey + SK.maxExp, "0");
        setStoredValue(HHStoredVarPrefixKey + SK.maxBooster, "0");
        setStoredValue(HHStoredVarPrefixKey + SK.kobanBank, "0");
        setStoredValue(HHStoredVarPrefixKey + TK.haveAff, "0");
        setStoredValue(HHStoredVarPrefixKey + TK.haveExp, "0");
        setStoredValue(HHStoredVarPrefixKey + TK.storeContents, JSON.stringify(storeFixture()));
    }

    const storedShop = () => getStoredJSON<any>(HHStoredVarPrefixKey + TK.storeContents, {});
    const charLevel = () => getStoredValue(HHStoredVarPrefixKey + TK.charLevel);

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        jest.useFakeTimers();
        mockHero(10000, 10000);
        setBaseline();
        (logHHAuto as jest.Mock).mockClear();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    describe("precondition guards", () => {
        it("resets the shop scan silently when no store contents are cached yet", () => {
            // Never-visited-the-market is a normal startup state (see
            // Shop.pure.ts), not a parse error -- it must not be logged as one.
            setStoredValue(HHStoredVarPrefixKey + TK.storeContents, undefined);
            localStorage.removeItem(HHStoredVarPrefixKey + TK.storeContents);
            sessionStorage.removeItem(HHStoredVarPrefixKey + TK.storeContents);
            Market.doShopping();
            expect(Number(charLevel())).toBe(0);
            expect(ajaxSpy).not.toHaveBeenCalled();
            expect(logHHAuto).not.toHaveBeenCalled();
        });

        it("logs a parse error when store contents are cached but not valid JSON", () => {
            setStoredValue(HHStoredVarPrefixKey + TK.storeContents, "not json {{{");
            Market.doShopping();
            expect(logHHAuto).toHaveBeenCalledWith("Catched error : Could not parse store content.");
        });

        it("resets the shop scan when the inventory counters are missing", () => {
            sessionStorage.removeItem(HHStoredVarPrefixKey + TK.haveAff);
            localStorage.removeItem(HHStoredVarPrefixKey + TK.haveAff);
            Market.doShopping();
            expect(Number(charLevel())).toBe(0);
            expect(ajaxSpy).not.toHaveBeenCalled();
        });
    });

    describe("gift shopping (autoAffW)", () => {
        beforeEach(() => {
            setStoredValue(HHStoredVarPrefixKey + SK.autoAffW, "true");
        });

        it("bulk-buys all soft-currency gifts when the money covers them", () => {
            Market.doShopping();
            expect(ajaxSpy).toHaveBeenCalledWith(
                expect.objectContaining({ action: "market_auto_buy", type: "gift" }),
                expect.any(Function)
            );
            // Both "sc" gifts are removed from the cached shop; the koban gift stays.
            const shop = storedShop();
            expect(shop[2]).toHaveLength(1);
            expect(shop[2][0].item.currency).toBe("hc");
        });

        it("buys a single affordable gift and reschedules itself otherwise", () => {
            // 400 needed for all sc gifts; 250 affords only the 200 gift
            // (iteration starts at the end of the list).
            mockHero(250, 0);
            Market.doShopping();
            expect(ajaxSpy).toHaveBeenCalledTimes(1);
            expect(ajaxSpy).toHaveBeenCalledWith(
                expect.objectContaining({ action: "market_buy", type: "gift", id_item: "403" }),
                expect.any(Function)
            );
            // The bought gift is removed, the rest of the shop is kept.
            const shop = storedShop();
            expect(shop[2].map((g: any) => g.id_item)).toEqual(["401", "402"]);
            // A follow-up doShopping run is scheduled for the remaining items.
            expect(jest.getTimerCount()).toBeGreaterThan(0);
        });

        it("keeps the configured money reserve (autoAff) before buying", () => {
            mockHero(250, 0);
            setStoredValue(HHStoredVarPrefixKey + SK.autoAff, "100");
            // 250 < 100 reserve + 200 cheapest sc gift -> nothing affordable.
            Market.doShopping();
            expect(ajaxSpy).not.toHaveBeenCalled();
            expect(storedShop()[2]).toHaveLength(3);
        });

        it("skips gift shopping entirely once maxAff is reached", () => {
            setStoredValue(HHStoredVarPrefixKey + SK.maxAff, "500");
            setStoredValue(HHStoredVarPrefixKey + TK.haveAff, "500");
            Market.doShopping();
            expect(ajaxSpy).not.toHaveBeenCalled();
        });
    });

    describe("book shopping (autoExpW)", () => {
        beforeEach(() => {
            setStoredValue(HHStoredVarPrefixKey + SK.autoExpW, "true");
        });

        it("bulk-buys all soft-currency books when the money covers them", () => {
            Market.doShopping();
            expect(ajaxSpy).toHaveBeenCalledWith(
                expect.objectContaining({ action: "market_auto_buy", type: "potion" }),
                expect.any(Function)
            );
            expect(storedShop()[3]).toHaveLength(0);
        });

        it("buys a single affordable book otherwise", () => {
            // 450 needed for all books; 200 affords only the 150 book.
            mockHero(200, 0);
            Market.doShopping();
            expect(ajaxSpy).toHaveBeenCalledTimes(1);
            expect(ajaxSpy).toHaveBeenCalledWith(
                expect.objectContaining({ action: "market_buy", type: "potion", id_item: "502" }),
                expect.any(Function)
            );
            expect(storedShop()[3].map((p: any) => p.id_item)).toEqual(["501"]);
            expect(jest.getTimerCount()).toBeGreaterThan(0);
        });
    });

    describe("booster shopping (autoBuyBoosters)", () => {
        beforeEach(() => {
            // autoBuyBoosters is koban-gated: the spendKobans0 master switch
            // must be on for getStoredValue to report the real setting.
            setStoredValue(HHStoredVarPrefixKey + SK.spendKobans0, "true");
            setStoredValue(HHStoredVarPrefixKey + SK.autoBuyBoosters, "true");
            setStoredValue(HHStoredVarPrefixKey + SK.autoBuyBoostersFilter, "B1:10");
        });

        it("buys a filtered legendary koban booster and tracks the inventory", () => {
            Market.doShopping();
            expect(ajaxSpy).toHaveBeenCalledTimes(1);
            expect(ajaxSpy).toHaveBeenCalledWith(
                expect.objectContaining({ action: "market_buy", type: "booster", id_item: "316" }),
                expect.any(Function)
            );
            // Success callback increments the owned-booster counter.
            expect(getStoredJSON<any>(HHStoredVarPrefixKey + TK.haveBooster, {})).toEqual({ B1: 1 });
            // The booster is removed from the cached shop.
            expect(storedShop()[1].map((b: any) => b.id_item)).toEqual(["317"]);
            expect(jest.getTimerCount()).toBeGreaterThan(0);
        });

        it("respects the koban bank reserve", () => {
            // 1000 booster price + 9500 bank > 10000 kobans available.
            setStoredValue(HHStoredVarPrefixKey + SK.kobanBank, "9500");
            Market.doShopping();
            expect(ajaxSpy).not.toHaveBeenCalled();
            expect(storedShop()[1]).toHaveLength(2);
        });

        it("does not buy a booster that is not listed", () => {
            // MB5 is a real code, just not one the cached shop offers.
            setStoredValue(HHStoredVarPrefixKey + SK.autoBuyBoostersFilter, "MB5:10");
            Market.doShopping();
            expect(ajaxSpy).not.toHaveBeenCalled();
        });

        // ---------------------------------------------------------- #1844

        it("stops at the amount written behind the booster", () => {
            setStoredValue(HHStoredVarPrefixKey + SK.autoBuyBoostersFilter, "B1:2");
            setStoredValue(HHStoredVarPrefixKey + TK.haveBooster, JSON.stringify({ B1: 2 }));
            Market.doShopping();
            expect(ajaxSpy).not.toHaveBeenCalled();
        });

        it("buys while the inventory is still below that amount", () => {
            setStoredValue(HHStoredVarPrefixKey + SK.autoBuyBoostersFilter, "B1:2");
            setStoredValue(HHStoredVarPrefixKey + TK.haveBooster, JSON.stringify({ B1: 1 }));
            Market.doShopping();
            expect(ajaxSpy).toHaveBeenCalledTimes(1);
        });

        it("treats 0 as no limit, the way the old Max Booster field did", () => {
            setStoredValue(HHStoredVarPrefixKey + SK.autoBuyBoostersFilter, "B1:0");
            setStoredValue(HHStoredVarPrefixKey + TK.haveBooster, JSON.stringify({ B1: 500 }));
            Market.doShopping();
            expect(ajaxSpy).toHaveBeenCalledTimes(1);
        });

        it("applies each booster's own amount rather than one shared limit", () => {
            // The fixture's B2 is "rare" and the loop only takes legendary or
            // mythic, so it is promoted here to have a second buyable booster.
            const shop = storedShop();
            shop[1][1].item.rarity = "legendary";
            setStoredValue(HHStoredVarPrefixKey + TK.storeContents, JSON.stringify(shop));
            // B1 has reached its own amount, B2 has not: only B2 may be bought.
            setStoredValue(HHStoredVarPrefixKey + SK.autoBuyBoostersFilter, "B1:1;B2:5");
            setStoredValue(HHStoredVarPrefixKey + TK.haveBooster, JSON.stringify({ B1: 1, B2: 0 }));
            Market.doShopping();
            expect(ajaxSpy).toHaveBeenCalledTimes(1);
            expect(ajaxSpy).toHaveBeenCalledWith(
                expect.objectContaining({ action: "market_buy", id_item: "317" }),
                expect.any(Function)
            );
        });

        it("buys nothing at all when the list cannot be read", () => {
            setStoredValue(HHStoredVarPrefixKey + SK.autoBuyBoostersFilter, "B1:10;nonsense");
            Market.doShopping();
            expect(ajaxSpy).not.toHaveBeenCalled();
        });

        it("buys nothing when a booster is listed twice, because the amount is then unclear", () => {
            setStoredValue(HHStoredVarPrefixKey + SK.autoBuyBoostersFilter, "B1:10;B1:2");
            Market.doShopping();
            expect(ajaxSpy).not.toHaveBeenCalled();
        });

        it("buys nothing when the list is empty", () => {
            setStoredValue(HHStoredVarPrefixKey + SK.autoBuyBoostersFilter, "");
            Market.doShopping();
            expect(ajaxSpy).not.toHaveBeenCalled();
        });
    });
});
