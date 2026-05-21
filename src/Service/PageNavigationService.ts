// PageNavigationService.ts
//
// Centralized page navigation. Translates abstract page IDs into
// actual URL paths using ConfigHelper, then navigates via
// window.location after a randomized delay (300-500ms) to look
// more human-like. Handles Nutaku session token injection.
//
// Before navigating, AutoLoop is disabled to prevent firing during
// the page transition. It re-enables after the new page loads, or
// after waitForAjaxIdle times out (in which case the navigation is
// deferred and the next AutoLoop tick can retry).
//
// Navigation mutex: only one navigation can be scheduled at a time.
// Subsequent calls within the same tick are dropped to prevent the
// browser from firing two window.location changes a few ms apart
// (which the game rejects with HTTP Forbidden). The flag resets
// automatically once the page has loaded and the script restarts,
// or when waitForAjaxIdle times out and the navigation is aborted.
//
// Used by: Every module that needs to navigate to a page.
import { ConfigHelper } from "../Helper/ConfigHelper";
import { getPage } from "../Helper/PageHelper";
import { setStoredValue } from "../Helper/StorageHelper";
import { randomInterval } from "../Helper/TimeHelper";
import { queryStringGetParam, url_add_param } from "../Helper/UrlHelper";
import { logHHAuto } from "../Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { TK } from "../config/StorageKeys";
import { waitForAjaxIdle, AJAX_IDLE_TIMEOUT_MS, AJAX_IDLE_SETTLE_MS } from './AjaxTracker';

// Module-level mutex: true while a navigation has been scheduled but the
// browser hasn't fully transitioned yet. Reset implicitly on page reload
// and explicitly on waitForAjaxIdle timeout.
let navInFlight = false;

// Throttle the "navigation already in flight" log line so a slow AJAX
// wait does not flood the log with one entry per AutoLoop tick (issue
// #1598 follow-up). Only emit once per NAV_BLOCKED_LOG_INTERVAL_MS.
const NAV_BLOCKED_LOG_INTERVAL_MS = 5000;
let lastNavBlockedLogAt = 0;

// Pre-resolved regex passes for paths that gotoPage forwards verbatim
// (champion battle screens, character/girl detail pages, quest pages).
// Replaces the (page.match(...) || {}).input switch trick.
const REGEX_PASSTHROUGH: ReadonlyArray<RegExp> = [
    /^\/champions\/[1-6]$/,
    /^\/characters\/\d+$/,
    /^\/girl\/\d+$/,
    /^\/quest\/\d+(\?.*)?$/,
];

// Page-ID -> URL resolver. Map lookup replaces the ~30-case switch.
// Resolvers are evaluated lazily because ConfigHelper values can change
// between game variants (HH/CH/PH).
type PageResolver = () => string | undefined;
type PageResolverEntry = [string, PageResolver];

function buildResolverMap(): Map<string, PageResolver> {
    const cfg = (id: string): string | undefined => ConfigHelper.getHHScriptVars(id);
    const tabbed = (urlId: string, tabId: string): string | undefined => {
        const url = cfg(urlId);
        const tab = cfg(tabId);
        return url ? url_add_param(url, "tab", tab) : undefined;
    };
    const entries: PageResolverEntry[] = [
        [cfg("pagesIDHome") ?? "", () => cfg("pagesURLHome")],
        [cfg("pagesIDActivities") ?? "", () => cfg("pagesURLActivities")],
        [cfg("pagesIDMissions") ?? "", () => tabbed("pagesURLActivities", "pagesIDMissions")],
        [cfg("pagesIDPowerplacemain") ?? "", () => {
            const url = cfg("pagesURLActivities");
            return url ? url_add_param(url, "tab", "pop") : undefined;
        }],
        [cfg("pagesIDContests") ?? "", () => tabbed("pagesURLActivities", "pagesIDContests")],
        [cfg("pagesIDDailyGoals") ?? "", () => tabbed("pagesURLActivities", "pagesIDDailyGoals")],
        [cfg("pagesIDHarem") ?? "", () => cfg("pagesURLHarem")],
        [cfg("pagesIDMap") ?? "", () => cfg("pagesURLMap")],
        [cfg("pagesIDPachinko") ?? "", () => cfg("pagesURLPachinko")],
        [cfg("pagesIDLeaderboard") ?? "", () => cfg("pagesURLLeaderboard")],
        [cfg("pagesIDShop") ?? "", () => cfg("pagesURLShop")],
        [cfg("pagesIDPantheon") ?? "", () => cfg("pagesURLPantheon")],
        [cfg("pagesIDPantheonPreBattle") ?? "", () => cfg("pagesURLPantheonPreBattle")],
        [cfg("pagesIDLabyrinth") ?? "", () => cfg("pagesURLLabyrinth")],
        [cfg("pagesIDEditLabyrinthTeam") ?? "", () => cfg("pagesURLEditLabyrinthTeam")],
        [cfg("pagesIDChampionsMap") ?? "", () => cfg("pagesURLChampionsMap")],
        [cfg("pagesIDSeason") ?? "", () => cfg("pagesURLSeason")],
        [cfg("pagesIDSeasonArena") ?? "", () => cfg("pagesURLSeasonArena")],
        [cfg("pagesIDPentaDrill") ?? "", () => cfg("pagesURLPentaDrill")],
        [cfg("pagesIDPentaDrillArena") ?? "", () => cfg("pagesURLPentaDrillArena")],
        [cfg("pagesIDPentaDrillPreBattle") ?? "", () => cfg("pagesURLPentaDrillPreBattle")],
        [cfg("pagesIDPentaDrillBattle") ?? "", () => cfg("pagesURLPentaDrillBattle")],
        [cfg("pagesIDClubChampion") ?? "", () => cfg("pagesURLClubChampion")],
        [cfg("pagesIDLeagueBattle") ?? "", () => cfg("pagesURLLeagueBattle")],
        [cfg("pagesIDTrollPreBattle") ?? "", () => cfg("pagesURLTrollPreBattle")],
        [cfg("pagesIDEvent") ?? "", () => cfg("pagesURLEvent")],
        [cfg("pagesIDClub") ?? "", () => cfg("pagesURLClub")],
        [cfg("pagesIDPoV") ?? "", () => cfg("pagesURLPoV")],
        [cfg("pagesIDPoG") ?? "", () => cfg("pagesURLPoG")],
        [cfg("pagesIDSeasonalEvent") ?? "", () => cfg("pagesURLSeasonalEvent")],
        [cfg("pagesIDEditTeam") ?? "", () => cfg("pagesURLEditTeam")],
        [cfg("pagesIDWaifu") ?? "", () => cfg("pagesURLWaifu")],
        [cfg("pagesIDLoveRaid") ?? "", () => cfg("pagesURLLoveRaid")],
    ];
    const map = new Map<string, PageResolver>();
    for (const [key, resolver] of entries) {
        if (key) {
            map.set(key, resolver);
        }
    }
    return map;
}

function resolveByRegexPassthrough(page: string): string | undefined {
    return REGEX_PASSTHROUGH.some((r) => r.test(page)) ? page : undefined;
}

// Schedule a navigation action after waitForAjaxIdle reports the channel
// is quiet. Centralises the navInFlight + waitForAjaxIdle + setTimeout
// boilerplate that gotoPage / safeReload / safeNavigateHref share.
//
// On AJAX-idle timeout the action is dropped and AutoLoop is re-enabled
// so the next tick can retry. navInFlight is reset in both branches.
function scheduleAfterIdle(
    delay: number,
    logContext: string,
    action: () => void,
): void {
    navInFlight = true;
    setTimeout(() => {
        waitForAjaxIdle(AJAX_IDLE_TIMEOUT_MS, AJAX_IDLE_SETTLE_MS).then((idle) => {
            if (!idle) {
                logHHAuto(`${logContext}: AJAX still busy after ${AJAX_IDLE_TIMEOUT_MS}ms, deferring`);
                setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "true");
                navInFlight = false;
                return;
            }
            action();
        });
    }, delay);
}

function logBlockedNavigation(prefix: string, detail: string): void {
    const now = Date.now();
    if (now - lastNavBlockedLogAt > NAV_BLOCKED_LOG_INTERVAL_MS) {
        lastNavBlockedLogAt = now;
        logHHAuto(`${prefix}: navigation already in flight, ignoring ${detail}`);
    }
}

function resolveDelay(delay: number): number {
    return typeof delay === 'number' && delay !== -1 ? delay : randomInterval(300, 500);
}

// Schedule navigation to `page`. Returns true when a navigation has
// been scheduled, false when blocked by the navigation mutex or when
// `page` does not resolve to a known URL (unknown page-id, no regex
// passthrough match). Callers that need an explicit reload fallback
// should call safeReload() themselves; this function never reloads
// the current page on its own.
export function gotoPage(
    page: string,
    inArgs: Record<string, unknown> = {},
    delay: number = -1,
): boolean {
    if (navInFlight) {
        logBlockedNavigation('gotoPage', page);
        return false;
    }
    const cp = getPage();
    logHHAuto(`going ${cp}->${page}`);

    delay = resolveDelay(delay);

    const resolverMap = buildResolverMap();
    let togoto: string | undefined;

    const resolver = resolverMap.get(page);
    if (resolver) {
        togoto = resolver();
    } else {
        togoto = resolveByRegexPassthrough(page);
        if (togoto === undefined) {
            logHHAuto(`Unknown goto page request. No page '${page}' defined.`);
            return false;
        }
    }

    if (togoto === undefined) {
        // resolveByRegexPassthrough already logged and returned false.
        // This branch is defensive for resolver functions that yield
        // undefined despite the page-id being in the resolver map.
        logHHAuto(`Couldn't resolve URL for page '${page}', skipping.`);
        return false;
    }

    setLastPageCalled(togoto);
    if (typeof inArgs === 'object' && Object.keys(inArgs).length > 0) {
        for (const arg of Object.keys(inArgs)) {
            togoto = url_add_param(togoto, arg, inArgs[arg]);
        }
    }

    togoto = addNutakuSession(togoto);

    setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
    logHHAuto("setting autoloop to false");
    logHHAuto(`GotoPage : ${togoto} in ${delay}ms.`);
    const targetUrl: string = togoto;
    scheduleAfterIdle(delay, 'gotoPage', () => {
        // Wait for any in-flight game AJAX (e.g. PoP claim POSTs) to
        // finish before changing the URL. Setting window.location.href
        // cancels open XHRs with NS_BINDING_ABORTED, and an aborted
        // state-changing request can make the server answer Forbidden
        // on the next call (issue #1598).
        window.location.href = window.location.origin + targetUrl;
    });
    return true;
}

/**
 * Reload the current page after waiting for any in-flight game AJAX
 * to finish. Equivalent to `location.reload()` but with the same
 * NS_BINDING_ABORTED guard as gotoPage (see issue #1598).
 *
 * Honors the navInFlight mutex so concurrent callers cannot fire two
 * reloads within the same tick. On AJAX-idle timeout, the reload is
 * deferred and AutoLoop is re-enabled so the next tick can retry.
 */
export function safeReload(delay: number = -1): boolean {
    if (navInFlight) {
        logBlockedNavigation('safeReload', 'reload');
        return false;
    }
    delay = resolveDelay(delay);
    setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
    logHHAuto(`safeReload: scheduled in ${delay}ms`);
    scheduleAfterIdle(delay, 'safeReload', () => {
        location.reload();
    });
    return true;
}

/**
 * Navigate to an arbitrary URL after waiting for any in-flight game
 * AJAX to finish. Use when gotoPage's page-ID switch cannot be used
 * (e.g. event links provided as raw href). Same NS_BINDING_ABORTED
 * guard as gotoPage (see issue #1598).
 */
export function safeNavigateHref(url: string, delay: number = -1): boolean {
    if (navInFlight) {
        logBlockedNavigation('safeNavigateHref', url);
        return false;
    }
    delay = resolveDelay(delay);
    setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
    logHHAuto(`safeNavigateHref: ${url} in ${delay}ms`);
    scheduleAfterIdle(delay, 'safeNavigateHref', () => {
        location.href = url;
    });
    return true;
}

// addNutakuSession appends a `sess=...` URL parameter or object key
// when running inside the Nutaku embed. String inputs return strings,
// object inputs return objects. Array inputs are not supported -- no
// caller passes an array and the previous Array branch wrote to a
// numeric-indexed slot which never round-tripped through URL building.
export function addNutakuSession(togoto: string): string;
// eslint-disable-next-line no-redeclare
export function addNutakuSession(togoto: Record<string, unknown>): Record<string, unknown>;
// eslint-disable-next-line no-redeclare
export function addNutakuSession(
    togoto: string | Record<string, unknown>,
): string | Record<string, unknown> {
    if (!unsafeWindow.hh_nutaku) {
        return togoto;
    }
    const hhSession = queryStringGetParam(window.location.search, 'sess');
    if (!hhSession) {
        logHHAuto('ERROR Nutaku detected and no session found');
        return togoto;
    }
    if (typeof togoto === 'string') {
        return togoto.includes("sess=") ? togoto : url_add_param(togoto, 'sess', hhSession);
    }
    if (typeof togoto === 'object' && togoto !== null && !Object.prototype.hasOwnProperty.call(togoto, 'sess')) {
        togoto['sess'] = hhSession;
    }
    return togoto;
}

function setLastPageCalled(inPage: string): void {
    setStoredValue(
        HHStoredVarPrefixKey + TK.LastPageCalled,
        JSON.stringify({ page: inPage, dateTime: new Date().getTime() }),
    );
}

/**
 * Test-only hook. Resets the module-level mutex and throttle state so
 * each spec can exercise `gotoPage` / `safeReload` / `safeNavigateHref`
 * in isolation without `jest.resetModules()` overhead. Naming follows
 * the convention of `_resetAjaxTrackerForTests` in `AjaxTracker.ts`.
 */
export function _resetPageNavigationServiceForTests(): void {
    navInFlight = false;
    lastNavBlockedLogAt = 0;
}
