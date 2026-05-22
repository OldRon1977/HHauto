import { getPage, getPopFallbackIndex, haltScript } from "../../src/Helper/PageHelper";
import { HHStoredVarPrefixKey } from "../../src/config/HHStoredVars";
import { SK, TK } from "../../src/config/StorageKeys";
import { MockHelper } from "../testHelpers/MockHelpers";

describe("Page Helper", function () {

    let restoreLocation: () => void;

    beforeEach(() => {
        document.body.innerHTML = `<!DOCTYPE html>`;
        restoreLocation = MockHelper.snapshotLocation();
        MockHelper.mockDomain();
        sessionStorage.removeItem(HHStoredVarPrefixKey + "Temp_unkownPagesList");
    });

    afterEach(() => {
        restoreLocation();
        delete (unsafeWindow as any).pop_list;
        delete (unsafeWindow as any).pop_index;
    });

    describe("getDisplayedIdEventPage", function () {
        // $("#contains_all #events .events-list .event-title.active").attr("href")

        it("default: missing game root returns empty string instead of throwing", function () {
            // getPage() is now a pure read. No game root means empty page id; bootstraps
            // call haltScript() themselves to opt into shutting the script down.
            expect(getPage()).toBe("");
        });
        it("empty", function () {
            MockHelper.mockPage('');
            expect(getPage()).toBe('');
        });
        it("Home", function () {
            MockHelper.mockPage('home');
            expect(getPage()).toBe('home');
        });

        it("contests", function () {
            MockHelper.mockDomain('www.hentaiheroes.com', 'activities.html', '?tab=contests');
            MockHelper.mockPage('activities');
            expect(getPage()).toBe('contests');
        });

        it("missions", function () {
            MockHelper.mockDomain('www.hentaiheroes.com', 'activities.html', '?tab=missions');
            MockHelper.mockPage('activities');
            expect(getPage()).toBe('missions');
        });

        it("daily_goals", function () {
            MockHelper.mockDomain('www.hentaiheroes.com', 'activities.html', '?tab=daily_goals');
            MockHelper.mockPage('activities');
            expect(getPage()).toBe('daily_goals');
        });

        it("pop", function () {
            MockHelper.mockDomain('www.hentaiheroes.com', 'activities.html', '?tab=pop');
            MockHelper.mockPage('activities');
            expect(getPage()).toBe('powerplacemain');
        });

        it("pop n", function () {
            MockHelper.mockDomain('www.hentaiheroes.com', 'activities.html', '?tab=pop&index=999');
            document.body.innerHTML = `<!DOCTYPE html><div id="hh_hentai" page="activities"><p>Hello world</p><div class="pop_list"><div class="pop_thumb_selected" pop_id="999"></div></div></div>`;
            expect(getPage()).toBe('powerplacemain');
        });

        it("pop n", function () {
            MockHelper.mockDomain('www.hentaiheroes.com', 'activities.html', '?tab=pop&index=999');
            document.body.innerHTML = `<!DOCTYPE html><div id="hh_hentai" page="activities"><p>Hello world</p><div class="pop_list" style="display:none"></div><div class="pop_thumb_selected"></div></div>`;
            expect(getPage()).toBe('powerplacemain');
        });

        it("pop n, pop_list hidden", function () {
            MockHelper.mockDomain('www.hentaiheroes.com', 'activities.html', '?tab=pop&index=999');
            document.body.innerHTML = `<!DOCTYPE html><div id="hh_hentai" page="activities"><p>Hello world</p><div class="pop_list" style="display:none"></div><div class="pop_thumb_selected" pop_id="999"></div></div>`;
            expect(getPage()).toBe('powerplace999');
        });

        it("checkUnknown known", function () {
            MockHelper.mockPage('home');
            expect(getPage(true)).toBe('home');
            expect(sessionStorage.getItem(HHStoredVarPrefixKey + "Temp_unkownPagesList")).toBeNull();
        });

        it("checkUnknown Unknown", function () {
            MockHelper.mockDomain('www.hentaiheroes.com', 'XXX-page.html');
            MockHelper.mockPage('XXX');
            expect(getPage(true)).toBe('XXX');
            expect(sessionStorage.getItem(HHStoredVarPrefixKey + "Temp_unkownPagesList")).toBe('{"XXX":"/XXX-page.html"}');
        });

        it("checkUnknown Unknown twice", function () {
            sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_unkownPagesList", '{"XXX":"/XXX-page.html"}')
            MockHelper.mockDomain('www.hentaiheroes.com', 'ZZZ-page.html');
            MockHelper.mockPage('ZZZ');
            expect(getPage(true)).toBe('ZZZ');
            expect(sessionStorage.getItem(HHStoredVarPrefixKey + "Temp_unkownPagesList")).toBe('{"XXX":"/XXX-page.html","ZZZ":"/ZZZ-page.html"}');
        });

        it("checkUnknown idempotent: does not rewrite when same page already recorded", function () {
            // Pre-populate the unknown list with the exact (page, pathname) pair
            // that the next call will see, with a sentinel JSON formatting that the
            // production code path would not emit (extra whitespace). If the function
            // re-serializes via JSON.stringify, the sentinel is lost and the value
            // changes; if the idempotency guard holds, the sentinel survives untouched.
            const sentinel = '{ "XXX" : "/XXX-page.html" }';
            sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_unkownPagesList", sentinel);

            MockHelper.mockDomain('www.hentaiheroes.com', 'XXX-page.html');
            MockHelper.mockPage('XXX');

            expect(getPage(true)).toBe('XXX');

            // The whitespace-laden sentinel is still byte-identical only if the code
            // skipped the JSON.stringify+setStoredValue round-trip.
            expect(sessionStorage.getItem(HHStoredVarPrefixKey + "Temp_unkownPagesList")).toBe(sentinel);
        });

        it("checkUnknown rewrites when pathname changes for a known page id", function () {
            // Same page id, different pathname -> must write.
            sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_unkownPagesList", '{"XXX":"/old-path.html"}');
            MockHelper.mockDomain('www.hentaiheroes.com', 'XXX-page.html');
            MockHelper.mockPage('XXX');

            expect(getPage(true)).toBe('XXX');
            expect(sessionStorage.getItem(HHStoredVarPrefixKey + "Temp_unkownPagesList")).toBe('{"XXX":"/XXX-page.html"}');
        });

        it("missing root element: getPage stays a pure read, haltScript opts into shutdown", function () {
            // getPage() must not touch storage anymore. Then haltScript()
            // does the master+autoLoop kill switch when callers want it.
            // SK.master is a Setting (localStorage), TK.autoLoop is a Temp value
            // (sessionStorage), so we read each from the matching backend.
            localStorage.setItem(HHStoredVarPrefixKey + SK.master, "true");
            sessionStorage.setItem(HHStoredVarPrefixKey + TK.autoLoop, "true");

            // Pure read: no throw, no storage mutation.
            expect(getPage()).toBe("");
            expect(localStorage.getItem(HHStoredVarPrefixKey + SK.master)).toBe("true");
            expect(sessionStorage.getItem(HHStoredVarPrefixKey + TK.autoLoop)).toBe("true");

            // Explicit halt clears both.
            haltScript("test");
            expect(localStorage.getItem(HHStoredVarPrefixKey + SK.master)).toBe("false");
            expect(sessionStorage.getItem(HHStoredVarPrefixKey + TK.autoLoop)).toBe("false");
        });

        it("pop tab uses unsafeWindow.pop_list as truthy fallback when DOM list is missing", function () {
            // No `.pop_list` div in the DOM -- only the unsafeWindow global drives the 'main' result.
            MockHelper.mockDomain('www.hentaiheroes.com', 'activities.html', '?tab=pop');
            MockHelper.mockPage('activities');
            (unsafeWindow as any).pop_list = [{}];
            expect(getPage()).toBe('powerplacemain');
        });

        it("pop tab uses unsafeWindow.pop_index when DOM popThumb is absent", function () {
            // No popThumb in the DOM -- the unsafeWindow.pop_index global supplies the value.
            MockHelper.mockDomain('www.hentaiheroes.com', 'activities.html', '?tab=pop&index=42');
            document.body.innerHTML = `<!DOCTYPE html><div id="hh_hentai" page="activities"><p>Hello world</p><div class="pop_list" style="display:none"></div></div>`;
            (unsafeWindow as any).pop_index = '42';
            expect(getPage()).toBe('powerplace42');
        });

        it("pop tab does not treat empty unsafeWindow.pop_list array as 'main'", function () {
            // Empty array is truthy in JS, so the previous `||` branch routed to 'main'.
            // With the array-content guard, an empty pop_list falls through to the popThumb
            // lookup; a thumb with pop_id=7 must produce 'powerplace7'.
            MockHelper.mockDomain('www.hentaiheroes.com', 'activities.html', '?tab=pop&index=7');
            document.body.innerHTML = `<!DOCTYPE html><div id="hh_hentai" page="activities"><p>Hello world</p><div class="pop_list" style="display:none"></div><div class="pop_thumb_selected" pop_id="7"></div></div>`;
            (unsafeWindow as any).pop_list = [];
            expect(getPage()).toBe('powerplace7');
        });

        it("pop tab keeps unsafeWindow.pop_index = 0 instead of falling through to popThumb", function () {
            // `??` semantics: pop_index = 0 is a defined value, so the popThumb fallback
            // must not run. The previous `||` would have routed to 'powerplace5'.
            MockHelper.mockDomain('www.hentaiheroes.com', 'activities.html', '?tab=pop&index=0');
            document.body.innerHTML = `<!DOCTYPE html><div id="hh_hentai" page="activities"><p>Hello world</p><div class="pop_list" style="display:none"></div><div class="pop_thumb_selected" pop_id="5"></div></div>`;
            (unsafeWindow as any).pop_index = 0;
            expect(getPage()).toBe('powerplace0');
        });
    });

    describe("getPopFallbackIndex", function () {
        it("returns null when not on a pop tab", function () {
            MockHelper.mockDomain('www.hentaiheroes.com', 'home.html');
            MockHelper.mockPage('home');
            expect(getPopFallbackIndex()).toBeNull();
        });

        it("returns null when pop tab has no index parameter", function () {
            MockHelper.mockDomain('www.hentaiheroes.com', 'activities.html', '?tab=pop');
            MockHelper.mockPage('activities');
            expect(getPopFallbackIndex()).toBeNull();
        });

        it("returns null when a specific POP resolves via popThumb", function () {
            // Happy path: tab=pop, index in URL, but the page rendered the targeted POP.
            // No lock signal needed.
            MockHelper.mockDomain('www.hentaiheroes.com', 'activities.html', '?tab=pop&index=999');
            document.body.innerHTML = `<!DOCTYPE html><div id="hh_hentai" page="activities"><p>Hello world</p><div class="pop_list" style="display:none"></div><div class="pop_thumb_selected" pop_id="999"></div></div>`;
            expect(getPopFallbackIndex()).toBeNull();
        });

        it("returns null when the main pop list is rendered", function () {
            MockHelper.mockDomain('www.hentaiheroes.com', 'activities.html', '?tab=pop&index=999');
            document.body.innerHTML = `<!DOCTYPE html><div id="hh_hentai" page="activities"><p>Hello world</p><div class="pop_list"><div class="pop_thumb" pop_id="1"></div></div></div>`;
            expect(getPopFallbackIndex()).toBeNull();
        });

        it("returns the URL index when no POP could be resolved (locked-pop signal)", function () {
            // tab=pop, index in URL, but no popThumb and no pop_list -- the game silently
            // redirected to a different sub-tab because the targeted POP is locked.
            MockHelper.mockDomain('www.hentaiheroes.com', 'activities.html', '?tab=pop&index=42');
            document.body.innerHTML = `<!DOCTYPE html><div id="hh_hentai" page="activities"><p>Hello world</p><div class="pop_list" style="display:none"></div></div>`;
            expect(getPopFallbackIndex()).toBe('42');
        });
    });

});
