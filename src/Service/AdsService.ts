// AdsService.ts
//
// Manages in-game advertisements that can interfere with automation.
// When the "show ads in background" setting is enabled, this service
// pushes ad containers behind the game UI via z-index overrides so
// they don't block click targets. On non-home pages, ads are
// repositioned further down the page to avoid overlap.
//
// Also detects cross-game promo popups and sex-friends ads that use
// a different DOM structure than regular ads.
//
// Reward-ad automation (issue #1746): the Home page shows one or more
// cross-promo reward ads, each a `<button>` whose onclick calls
// `shared.hh_crosspromo.redirectToCrosspromo(id, url, 1, 1)` and whose text
// is "Try it now". runAdCycle() (master switch autoAdsClick, off by default)
// handles the ads one per tick: it clicks a button, closes the ad tab it opens
// and then confirms the reward with the game's OK button
// (`button[confirm_blue_button]`), before moving on to the next ad shortly
// after. The tab is closed via the handle returned by a temporarily wrapped
// `unsafeWindow.open` -- a window a script opened may be closed again by its
// opener, cross-origin notwithstanding. A visible ad button is always
// clickable (the game removes used buttons itself and re-shows them when
// they are available again), so there is no own re-click bookkeeping. Every
// failure path (popup blocker, missing confirm button, no ad present) logs and
// arms a cooldown timer instead of retrying in a tight loop.
//
// Used by: StartService (on page load), Pipeline.config (handleKobanAds)

import { ConfigHelper } from "../Helper/ConfigHelper";
import { getStoredValue } from "../Helper/StorageHelper";
import { randomInterval } from "../Helper/TimeHelper";
import { setTimer } from "../Helper/TimerHelper";
import { safeReload } from "./PageNavigationService";
import { logHHAuto } from "../Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK } from "../config/StorageKeys";

/** Minimal shape of the global `open` used by the capture wrapper (testable). */
export interface WindowOpener {
    open: (...args: unknown[]) => Window | null;
}

// Cooldown windows (seconds). Never a tight retry loop (issue #1746 acceptance).
// RECHECK: normal pacing -- the reward ads appear in short bursts (several in
//          a row, then none until the next day), so the scan runs every few
//          seconds to catch the whole burst (maintainer requirement). The scan
//          itself is a cheap DOM query; the pipeline's minIntervalMs and this
//          timer keep it from busy-looping.
// BLOCKED: a popup blocker stopped the ad tab -- back off, retrying won't help
//          (fix is a browser popup exception for the game site).
const AD_COOLDOWN_RECHECK: [number, number] = [5, 10];
const AD_COOLDOWN_BLOCKED: [number, number] = [20 * 60, 30 * 60];

// The reward-ad "Try it now" button is identified by its onclick calling the
// game's cross-promo redirect. Matching the handler (not a wrapper class or the
// localized button text) keeps the selector stable across layout/locale changes
// and never matches the OK confirm button (which has no such onclick).
const AD_BUTTON_SELECTOR = 'button[onclick*="redirectToCrosspromo"]';
// The reward is confirmed back in the game tab with the OK button, marked by
// the `confirm_blue_button` attribute (locale-independent, unlike its text).
const AD_CONFIRM_SELECTOR = 'button[confirm_blue_button]';

/**
 * Temporarily wrap `win.open`, run `clickFn` and return the captured window
 * handle. The game's cross-promo redirect does NOT open the ad tab
 * synchronously inside the click (it fires a tracking request first), so the
 * wrapper stays installed for up to `timeoutMs` and resolves as soon as the
 * first `open` call happens. The original `open` is ALWAYS restored
 * (try/finally), even if `clickFn` throws or the timeout expires, so no other
 * window.open user is affected. Pure/host-agnostic so it can be unit-tested
 * with a mock opener.
 */
export async function captureOpenedWindow(win: WindowOpener, clickFn: () => void, timeoutMs = 8000, pollMs = 200): Promise<Window | null> {
    let handle: Window | null = null;
    const original = win.open;
    win.open = function (this: unknown, ...args: unknown[]): Window | null {
        const w = original.apply(win, args) as Window | null;
        if (!handle) handle = w;
        return w;
    } as WindowOpener["open"];
    try {
        clickFn();
        const deadline = Date.now() + timeoutMs;
        while (!handle && Date.now() < deadline) {
            await adsDelay(pollMs);
        }
    } finally {
        win.open = original;
    }
    return handle;
}

/**
 * Find every reward-ad "Try it now" button currently in the DOM, visible or
 * not. Exported for testing.
 */
export function findAdButtons(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>(AD_BUTTON_SELECTOR));
}

/**
 * The reward-ad buttons the user can actually see. The game keeps the markup
 * of its sliding cross-promo popups (`#crosspromo_show_ad` and friends) in the
 * DOM permanently and only toggles them with jQuery `.show()`/`.hide()`, so a
 * closed popup still carries a "Try it now" button of its own. Such a button
 * is a full selector match and can precede the visible tile in document order;
 * clicking it runs the game's redirect for a popup that is not open, which
 * claims no reward and never shows the OK confirm. The cycle then keeps
 * picking the same dead button on every recheck and the visible tile is never
 * clicked. Exported for testing.
 */
export function findVisibleAdButtons(): HTMLElement[] {
    return findAdButtons().filter(isElementDisplayed);
}

/**
 * True unless the element (or an ancestor) is explicitly hidden. Deliberately
 * tolerant -- only inline/computed `display:none` / `visibility:hidden` count
 * as hidden -- so it works both in the browser and in jsdom (which has no
 * layout, so offset-based visibility checks always report hidden there).
 * Exported for testing.
 */
export function isElementDisplayed(el: HTMLElement): boolean {
    let node: HTMLElement | null = el;
    while (node) {
        const style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") return false;
        node = node.parentElement;
    }
    return true;
}

/**
 * Find the game's VISIBLE reward-confirm ("OK") button, or null. The game can
 * keep hidden confirm-popup templates in the DOM, so the first selector match
 * is not necessarily the popup the user sees. Exported for testing.
 */
export function findConfirmButton(): HTMLElement | null {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(AD_CONFIRM_SELECTOR));
    return candidates.find(isElementDisplayed) ?? null;
}

function adsDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class AdsService {
    // There is deliberately NO own re-click bookkeeping (maintainer
    // decision): the game removes a reward-ad button once it is used and
    // only shows it again when it is clickable -- a visible button is
    // always fair game. Pacing comes solely from the nextAdsTime cooldowns.

    /** Timestamp of our most recent ad click (0 = none this page session). */
    static lastAdClickAt = 0;

    /** How long after an ad click a stray visible OK is treated as OUR
     *  pending reward confirm. Outside this window the generic confirm
     *  popup on screen belongs to something else and must not be clicked. */
    static PENDING_CONFIRM_WINDOW_MS = 10 * 60 * 1000;

    /** True when an ad was clicked recently enough that a visible confirm
     *  popup can be attributed to it. */
    static hasRecentAdClick(): boolean {
        return AdsService.lastAdClickAt > 0
            && Date.now() - AdsService.lastAdClickAt < AdsService.PENDING_CONFIRM_WINDOW_MS;
    }

    static closeHomeAds() {
        if ($('#ad_home close:visible').length) {
            setTimeout(() => {
                $('#ad_home close').trigger('click')
            }, randomInterval(3000, 5000));
        }
    }

    static isCrossGameAds(): boolean {
        return $("#sliding-popups #crosspromo_show_ad").length > 0;
    }

    static isSexFriendsAds(): boolean {
        return $("#sliding-popups #crosspromo_show_localreward").length > 0;
    }

    static moveAds(page: string):void {
        if (getStoredValue(HHStoredVarPrefixKey + SK.showAdsBack) === "true") {
            if (page == ConfigHelper.getHHScriptVars("pagesIDHome")) {
                if (!AdsService.isCrossGameAds() && !AdsService.isSexFriendsAds()) {
                    GM_addStyle('#sliding-popups#sliding-popups { z-index : 1}');
                    GM_addStyle('#ad_home { z-index : 1}');
                    GM_addStyle('.ad-revive-container { z-index : 1}');
                }
            }
            else {
                GM_addStyle('#ad_champions_map { top: 35rem !important; }');
                GM_addStyle('#ad_god-path { position: absolute !important; top: 35rem !important; }');
                GM_addStyle('#ad_battle { top: 32rem !important; }');
                GM_addStyle('#ad_activities { position: absolute !important; top: 32rem !important; }');
                GM_addStyle('#ad_quest { top: 25rem !important; }');
                GM_addStyle('#ad_labyrinth { top: 30rem !important; }');
                GM_addStyle('#ad_labyrinth-pre-battle { top: 30rem !important; }');
                GM_addStyle('#ad_shop { top: 35rem !important; }');
                GM_addStyle('#ad_season { top: 30rem !important; }');
                GM_addStyle('#ad_love_raids {margin-top: 0 !important; }');
                GM_addStyle('#ad_harem {margin-top: 5rem !important; }');
            }
        }
    }

    /** True when the reward-ad automation master switch is enabled. */
    static isAdClickActivated(): boolean {
        return getStoredValue(HHStoredVarPrefixKey + SK.autoAdsClick) === "true";
    }

    /**
     * Poll for the visible reward-confirm ("OK") button up to `timeoutMs`.
     * Resolves with the button once it appears, or null on timeout (never
     * loops forever). The OK button can show up well after the ad tab closes
     * (the reward is only credited server-side once the watch counted), so
     * the wait is generous.
     */
    static async waitForConfirmButton(timeoutMs = 60000, pollMs = 500): Promise<HTMLElement | null> {
        const deadline = Date.now() + timeoutMs;
        for (;;) {
            const btn = findConfirmButton();
            if (btn) return btn;
            if (Date.now() >= deadline) return null;
            await adsDelay(pollMs);
        }
    }

    /**
     * One reward-ad step on the Home page (issue #1746). Handles a single ad
     * per call and re-checks every few seconds, so a whole burst of ads is
     * worked through back to back:
     *   1. If an OK confirm button is already visible (from a previous step),
     *      click it and come back soon (more ads may follow).
     *   2. Otherwise pick the first visible "Try it now" button -- a visible
     *      button is always clickable (the game removes used ones itself).
     *   3. Wrap unsafeWindow.open, click it and capture the ad-tab handle --
     *      the game opens the tab AFTER a tracking round-trip, so the wrapper
     *      stays armed for a few seconds instead of only during the click.
     *   4. With a handle: wait 3-5 s, close the tab. Without one: keep going,
     *      the reward may still be credited (the tab may have opened through a
     *      path the wrapper cannot see).
     *   5. Wait (up to 60 s) for the visible OK button and click it.
     *   6. Arm the 1-3 min RECHECK -- except when neither a tab nor an OK was
     *      seen (popup blocker): then the long BLOCKED back-off.
     *
     * Every exit path arms `nextAdsTime`, so the caller's precondition
     * (checkTimer) rate-limits re-entry -- there is no unbounded retry loop.
     * Returns true when an action was taken (drives the pipeline slot-hold).
     */
    static async runAdCycle(): Promise<boolean> {
        if (!AdsService.isAdClickActivated()) return false;

        // Confirm a reward left over from an earlier (possibly interrupted)
        // step -- but ONLY shortly after one of our own ad clicks. The game
        // uses the same confirm_blue_button popup for many dialogs; a stray
        // visible OK long after any ad click belongs to something else and
        // must not be auto-confirmed.
        const pending = findConfirmButton();
        if (pending && AdsService.hasRecentAdClick()) {
            logHHAuto("Ads: confirming pending reward (OK).");
            pending.click();
            setTimer("nextAdsTime", randomInterval(...AD_COOLDOWN_RECHECK));
            AdsService.reloadForNextAd();
            return true;
        }

        const buttons = findVisibleAdButtons();
        if (buttons.length === 0) {
            logHHAuto("Ads: no reward ad on the page.");
            setTimer("nextAdsTime", randomInterval(...AD_COOLDOWN_RECHECK));
            return false;
        }

        const target = buttons[0];
        // Name the ad in the log (cross-promo id + target host from the
        // onclick) so a "was ad X clicked?" question is answerable from the
        // debug log alone.
        const onclick = target.getAttribute("onclick") || "";
        const adMatch = onclick.match(/redirectToCrosspromo\((\d+),\s*'([^']*)'/);
        let adName = adMatch ? adMatch[1] : "?";
        try {
            if (adMatch) adName += " -> " + new URL(adMatch[2]).host;
        } catch { /* keep the plain id when the URL does not parse */ }
        logHHAuto("Ads: clicking reward ad ('Try it now', id " + adName + "). "
            + (buttons.length - 1) + " more waiting.");
        AdsService.lastAdClickAt = Date.now();
        const handle = await captureOpenedWindow(unsafeWindow as unknown as WindowOpener, () => {
            target.click();
        });

        if (handle) {
            await adsDelay(randomInterval(3000, 5000));
            try {
                handle.close();
            } catch (err) {
                logHHAuto("Ads: could not close ad tab: " + String(err));
            }
        } else {
            // The tab may still have opened through a path the wrapper cannot
            // see (or a popup blocker stopped it) -- wait for the confirm
            // before deciding which of the two it was.
            logHHAuto("Ads: no ad-tab handle captured, waiting for the reward confirm anyway.");
        }

        const confirmBtn = await AdsService.waitForConfirmButton();

        if (!handle && !confirmBtn) {
            // Neither a tab we control nor a reward confirm: popup blocker.
            // Do NOT retry in a loop -- log and back off for a long cooldown.
            logHHAuto("Ads: no ad tab and no reward confirm (popup blocker?). Backing off.");
            setTimer("nextAdsTime", randomInterval(...AD_COOLDOWN_BLOCKED));
            return false;
        }

        if (confirmBtn) {
            logHHAuto("Ads: reward available, confirming (OK).");
            confirmBtn.click();
        } else {
            logHHAuto("Ads: reward confirm (OK) not visible yet, will retry shortly.");
        }

        // Come back soon: for the next ad, for a late OK (the pending-confirm
        // check at the top of the next step catches it), or to spot a newly
        // appearing ad quickly. Timer is armed BEFORE the reload so it
        // survives into the fresh page (timers live in sessionStorage).
        setTimer("nextAdsTime", randomInterval(...AD_COOLDOWN_RECHECK));

        if (confirmBtn) {
            AdsService.reloadForNextAd();
        }
        return true;
    }

    /**
     * The Home page only renders the next reward ad after a reload (maintainer
     * observation: one F5 is needed after "OK"). Routed through safeReload()
     * so any in-flight claim AJAX settles first -- never a direct
     * location.reload() (same guard as the champion/pachinko flows,
     * issue #1598).
     */
    static reloadForNextAd(): void {
        logHHAuto("Ads: reloading the page so the next reward ad can appear.");
        safeReload();
    }
}
