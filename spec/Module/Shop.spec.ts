import { Shop } from "../../src/Module/Shop";
import { ConfigHelper } from "../../src/Helper/ConfigHelper";
import { HHStoredVarPrefixKey } from "../../src/config/HHStoredVars";
import { TK } from "../../src/config/StorageKeys";
import { getStoredValue, getStoredJSON } from "../../src/Helper/StorageHelper";
import { getSecondsLeft } from "../../src/Helper/TimerHelper";
import { gotoPage } from "../../src/Service/PageNavigationService";
import { MockHelper } from "../testHelpers/MockHelpers";

// PageNavigationService is mocked so updateShop's navigation branches do not
// touch window.location. All four commonly-used exports are stubbed because
// transitive importers (HeroHelper, Booster) reference them at call time.
jest.mock("../../src/Service/PageNavigationService", () => ({
    gotoPage: jest.fn().mockReturnValue(true),
    safeReload: jest.fn(),
    safeNavigateHref: jest.fn(),
    addNutakuSession: jest.fn((x: unknown) => x),
}));

const gotoPageMock = gotoPage as jest.Mock;

describe("Shop.updateShop", function () {

    const SHOP_PAGE = ConfigHelper.getHHScriptVars("pagesIDShop");
    const HOME_PAGE = ConfigHelper.getHHScriptVars("pagesIDHome");

    // Build the #shops scrape DOM. Each merchant/player section nests a
    // .slot[data-d=...] exactly like the live market markup updateShop reads.
    function shopBody(opts: {
        armor?: string[];
        booster?: string[];
        gift?: string[];
        potion?: string[];
        playerGift?: string[];
        playerPotion?: string[];
        playerBooster?: string[];
        frozen?: string;
    }) {
        const slots = (cls: string, items: string[] | undefined) =>
            (items ?? [])
                .map((d) => `<div class="${cls}"><div class="slot" data-d='${d}'></div></div>`)
                .join("");
        const frozen = opts.frozen
            ? `<div class="shop"><div class="shop_count"><span rel="expires">${opts.frozen}</span></div></div>`
            : "";
        return (
            `<div id="shops">` +
            slots("armor merchant-inventory-item", opts.armor) +
            slots("booster merchant-inventory-item", opts.booster) +
            slots("gift merchant-inventory-item", opts.gift) +
            slots("potion merchant-inventory-item", opts.potion) +
            slots("gift player-inventory-content", opts.playerGift) +
            slots("potion player-inventory-content", opts.playerPotion) +
            slots("booster player-inventory-content", opts.playerBooster) +
            `</div>` + frozen
        );
    }

    function renderShop(pageId: string, body = "") {
        document.body.innerHTML = `<!DOCTYPE html><div id="hh_hentai" page="${pageId}">${body}</div>`;
    }

    beforeEach(() => {
        // Set the hentaiheroes domain so ConfigHelper resolves gameID to the
        // real root id ("hh_hentai") that getPage() reads the page attr from.
        MockHelper.mockDomain("www.hentaiheroes.com");
        gotoPageMock.mockClear();
        unsafeWindow.shared!.Hero = { infos: { level: 321 } } as any;
    });

    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        document.body.innerHTML = "";
    });

    describe("off the market page", function () {
        it("navigates to the market and returns true without scraping", function () {
            renderShop(HOME_PAGE);
            const result = Shop.updateShop();
            expect(result).toBe(true);
            expect(gotoPageMock).toHaveBeenCalledWith(SHOP_PAGE);
            // No cache write happened.
            expect(getStoredValue(HHStoredVarPrefixKey + TK.haveAff)).toBeFalsy();
        });
    });

    describe("on the market page", function () {
        it("returns false and counts affection and experience from player inventory", function () {
            renderShop(
                SHOP_PAGE,
                shopBody({
                    playerGift: ['{"quantity":2,"item":{"value":5}}', '{"quantity":1,"item":{"value":10}}'],
                    playerPotion: ['{"quantity":3,"item":{"value":4}}'],
                })
            );
            const result = Shop.updateShop();
            expect(result).toBe(false);
            // 2*5 + 1*10 = 20 affection, 3*4 = 12 experience.
            expect(Number(getStoredValue(HHStoredVarPrefixKey + TK.haveAff))).toBe(20);
            expect(Number(getStoredValue(HHStoredVarPrefixKey + TK.haveExp))).toBe(12);
        });

        it("builds the booster inventory map and id map", function () {
            renderShop(
                SHOP_PAGE,
                shopBody({
                    playerBooster: [
                        '{"quantity":3,"item":{"identifier":"booster_a","id_item":316,"name":"Sandalwood","rarity":"legendary"}}',
                        '{"quantity":1,"item":{"identifier":"booster_b","id_item":317,"name":"Cordyceps","rarity":"mythic"}}',
                    ],
                })
            );
            Shop.updateShop();
            const haveBooster = getStoredJSON(HHStoredVarPrefixKey + TK.haveBooster, {});
            expect(haveBooster).toEqual({ booster_a: 3, booster_b: 1 });
            const idMap = getStoredJSON(HHStoredVarPrefixKey + TK.boosterIdMap, {}) as Record<string, any>;
            // id_item is coerced to a string on write.
            expect(idMap.booster_a).toEqual({
                id_item: "316",
                identifier: "booster_a",
                name: "Sandalwood",
                rarity: "legendary",
            });
            expect(idMap.booster_b.id_item).toBe("317");
        });

        it("stores the four merchant assortment buckets under storeContents", function () {
            renderShop(
                SHOP_PAGE,
                shopBody({
                    armor: ['{"id_item":1}', '{"id_item":2}'],
                    booster: ['{"id_item":3}'],
                    gift: ['{"id_item":4}'],
                    potion: ['{"id_item":5}'],
                })
            );
            Shop.updateShop();
            const contents = getStoredJSON(HHStoredVarPrefixKey + TK.storeContents, []);
            expect(contents).toHaveLength(4);
            expect(contents[0]).toEqual([{ id_item: 1 }, { id_item: 2 }]);
            expect(contents[1]).toEqual([{ id_item: 3 }]);
            expect(contents[2]).toEqual([{ id_item: 4 }]);
            expect(contents[3]).toEqual([{ id_item: 5 }]);
        });

        it("records the hero level under charLevel", function () {
            renderShop(SHOP_PAGE, shopBody({}));
            Shop.updateShop();
            expect(Number(getStoredValue(HHStoredVarPrefixKey + TK.charLevel))).toBe(321);
        });

        it("sets the nextShopTime timer", function () {
            renderShop(SHOP_PAGE, shopBody({}));
            Shop.updateShop();
            // Default branch (no frozen timer) seeds a positive cool-down.
            expect(getSecondsLeft("nextShopTime")).toBeGreaterThan(0);
        });

        it("skips slots with malformed data-d without throwing", function () {
            renderShop(
                SHOP_PAGE,
                shopBody({
                    playerGift: ['{not valid json', '{"quantity":2,"item":{"value":5}}'],
                })
            );
            let result: boolean | undefined;
            expect(() => {
                result = Shop.updateShop();
            }).not.toThrow();
            expect(result).toBe(false);
            // Only the valid slot contributes (2*5 = 10); the malformed one is dropped.
            expect(Number(getStoredValue(HHStoredVarPrefixKey + TK.haveAff))).toBe(10);
        });

        it("does not navigate home when LastPageCalled is unset", function () {
            renderShop(SHOP_PAGE, shopBody({}));
            Shop.updateShop();
            expect(gotoPageMock).not.toHaveBeenCalled();
        });
    });
});
describe("Shop.isTimeToCheckShop", function () {
    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it("is false when no market consumer is enabled", function () {
        expect(Shop.isTimeToCheckShop()).toBe(false);
    });

    it("is true when only autoBuyBoosters is enabled", function () {
        // autoBuyBoosters is koban-gated: getStoredValue resolves it to
        // "false" unless the spendKobans0 master switch is on.
        localStorage.setItem(HHStoredVarPrefixKey + "Setting_spendKobans0", "true");
        localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoBuyBoosters", "true");
        expect(Shop.isTimeToCheckShop()).toBe(true);
    });

    it("stays false when autoBuyBoosters is on but kobans may not be spent", function () {
        localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoBuyBoosters", "true");
        expect(Shop.isTimeToCheckShop()).toBe(false);
    });

    it("stays false when autoBuyBoosters is on but the filter is empty", function () {
        localStorage.setItem(HHStoredVarPrefixKey + "Setting_spendKobans0", "true");
        localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoBuyBoosters", "true");
        localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoBuyBoostersFilter", "");
        expect(Shop.isTimeToCheckShop()).toBe(false);
    });

    it("is true when only updateMarket is enabled", function () {
        localStorage.setItem(HHStoredVarPrefixKey + "Setting_updateMarket", "true");
        expect(Shop.isTimeToCheckShop()).toBe(true);
    });
});

// Shop sell-menu filter builders: the seven tests that stood here compared
// a built selector string against a copy of itself. Whether
// #player-inventory.armor .slot[data-d*='"name_add":"5"'] matches anything --
// and on which of the two equipment trees shop.html renders -- is a claim
// about the page, checked in scripts/live-check (spec triage 2026-08).
