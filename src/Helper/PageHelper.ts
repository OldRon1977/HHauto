// PageHelper.ts
//
// Determines which game page the player is currently viewing. The game
// uses a root element's `page` attribute to identify the view, but the
// Activities page multiplexes sub-pages (Contests, Missions, Daily
// Goals, Place of Power) via tabs and query parameters.
//
// This helper resolves those ambiguities into a single canonical page
// ID that AutoLoop and modules can switch on. It also logs unknown
// page IDs to help detect game updates that add new pages.
//
// Why the complexity: The Activities page redesign merged several
// formerly separate pages into tabs, but automation still needs
// distinct IDs for each to route actions correctly.
//
// Used by: AutoLoop (page routing), StartService (initial setup),
//          PageNavigationService (navigation targets),
//          PlaceOfPower (uses getPopFallbackIndex to detect locked POPs)
import { logHHAuto } from "../Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK, TK } from "../config/StorageKeys";
import { ConfigHelper } from "./ConfigHelper";
import { getStoredJSON, setStoredValue } from "./StorageHelper";
import { queryStringGetParam } from "./UrlHelper";

/**
 * Halts the script by clearing master and autoLoop in storage.
 *
 * Previously, getPage() did this implicitly (and threw) when the game
 * root element was missing. That coupled a read with a hard-stop
 * side effect: any caller that hit a transient DOM state could disable
 * the entire script without realizing it. The kill switch lives here
 * now so callers opt into halting explicitly.
 *
 * Used by StartService when it bootstraps and finds no game root.
 */
export function haltScript(reason: string): void
{
    logHHAuto(`haltScript: ${reason}`);
    setStoredValue(HHStoredVarPrefixKey + SK.master, "false");
    setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
    logHHAuto("setting autoloop to false");
}

/**
 * Internal state of the Place-of-Power tab.
 *
 * - 'main': the main pop list is rendered (multiple POPs visible).
 * - 'specific': a single POP is selected; popId is the resolved index.
 * - 'unresolved': we're on /activities.html?tab=pop but neither the
 *   main list nor a specific POP could be detected. The game shows
 *   the daily_goals tab in this state when the URL points at a
 *   locked POP. Callers (PlaceOfPower) treat this as a lock signal.
 */
type PopState =
    | { kind: 'main' }
    | { kind: 'specific'; popId: string | number }
    | { kind: 'unresolved' };

function resolvePopState(): PopState
{
    // unsafeWindow.pop_list is the game-injected array of POP definitions
    // when the main pop menu is visible. An empty array `[]` is truthy in
    // JS but means no POPs unlocked, so we require an actual entry.
    const popListDom = $("div.pop_list").not('[style*="display:none"]').not('[style*="display: none"]');
    const popListGlobal = unsafeWindow.pop_list;
    const hasPopListGlobal = Array.isArray(popListGlobal) && popListGlobal.length > 0;
    if (popListDom.length >= 1 || hasPopListGlobal)
    {
        return { kind: 'main' };
    }

    const popThumb = $(".pop_thumb_selected[pop_id]");
    // `??` instead of `||`: pop_index = 0 would be a valid index in a
    // 0-based numbering scheme, the previous `||` would have routed it
    // to the popThumb fallback. Nullish-coalescing keeps 0 in place.
    const resolved = unsafeWindow.pop_index ?? (popThumb.length > 0 ? popThumb.attr('pop_id') : undefined);
    if (resolved !== undefined)
    {
        return { kind: 'specific', popId: resolved };
    }
    return { kind: 'unresolved' };
}

/**
 * If the player is on /activities.html?tab=pop&index=N but the page
 * could not resolve a specific POP (game silently redirects to daily
 * goals when the targeted POP is locked), returns the requested index
 * so callers can mark the POP as locked. Returns null in every other
 * state (happy path, different tab, no index in URL).
 *
 * Replaces the legacy `checkPop` parameter on getPage(): the caller
 * (Module/PlaceOfPower) now drives the lock-marking pathway instead
 * of PageHelper reaching into a Module from the Helper layer.
 */
export function getPopFallbackIndex(): string | null
{
    const tab = queryStringGetParam(window.location.search, 'tab');
    if (tab !== 'pop') return null;
    const index = queryStringGetParam(window.location.search, 'index');
    if (index === null) return null;
    if (resolvePopState().kind !== 'unresolved') return null;
    return index;
}

/**
 * Maps each Activities sub-tab to its canonical page-id storage key.
 * The four entries cover every sub-tab the game multiplexes onto
 * /activities.html. The `pop` entry is special-cased in
 * resolveActivitiesSubTab because the page id depends on which POP
 * (if any) is currently selected -- see resolvePopState.
 *
 * Pre-7.36.0 the sub-tab branch was four hand-rolled `else if`
 * blocks repeating the same selector geometry; the resolver below
 * uses this table instead so adding a sub-tab in the future is one
 * line, not four.
 */
const ACTIVITIES_SUB_TABS: ReadonlyArray<{ tabId: string; pageVarKey: string }> = [
    { tabId: 'contests',    pageVarKey: 'pagesIDContests' },
    { tabId: 'missions',    pageVarKey: 'pagesIDMissions' },
    { tabId: 'daily_goals', pageVarKey: 'pagesIDDailyGoals' },
];

function activitiesSubTabSelector(tabId: string): string
{
    return `#activities-tabs > div.switch-tab.underline-tab.tab-switcher-fade-in[data-tab='${tabId}']`;
}

/**
 * Resolves which Activities sub-tab is currently active and returns
 * the canonical page id for it.
 *
 * The URL `tab` query param is the authoritative source; we only fall
 * back to DOM `data-tab` matches when it is missing. Using sequential
 * `if`s without `else` caused a daily_goals/contests loop on issue
 * #1672: stale or transitional tab markers in the DOM made later
 * branches override the correct value derived from the URL. The
 * table-driven walk preserves that contract: the URL match short-
 * circuits before the DOM scan starts.
 *
 * Returns null when the page is on /activities.html but no sub-tab
 * could be identified (caller falls back to the page attribute).
 */
function resolveActivitiesSubTab(tab: string | null): string | null
{
    // 1. URL-driven match. Settles every case where the user navigated
    //    via gotoPage() and we put the tab into the query string.
    for (const entry of ACTIVITIES_SUB_TABS)
    {
        if (tab === entry.tabId)
        {
            return ConfigHelper.getHHScriptVars(entry.pageVarKey);
        }
    }
    if (tab === 'pop')
    {
        return resolvePopPageId();
    }

    // 2. DOM fallback only when the URL has no tab param. Same lookup
    //    pattern as before, just driven by the table.
    if (tab == null)
    {
        for (const entry of ACTIVITIES_SUB_TABS)
        {
            if ($(activitiesSubTabSelector(entry.tabId)).length > 0)
            {
                return ConfigHelper.getHHScriptVars(entry.pageVarKey);
            }
        }
        if ($(activitiesSubTabSelector('pop')).length > 0)
        {
            return resolvePopPageId();
        }
    }
    return null;
}

function resolvePopPageId(): string
{
    // unsafeWindow.pop_index can be a number from the game globals
    // while popThumb.attr('pop_id') returns a string -- the existing
    // concat 'powerplace'+t handles both, so we don't normalize here.
    const state = resolvePopState();
    if (state.kind === 'specific')
    {
        return "powerplace" + state.popId;
    }
    // 'main' and 'unresolved' both render the main page id. The
    // unresolved-with-index path is detected by callers via
    // getPopFallbackIndex(); see PlaceOfPower.collectAndUpdate.
    return "powerplacemain";
}

export function getPage(checkUnknown = false): string
{
    const ob = document.getElementById(ConfigHelper.getHHScriptVars("gameID"));
    if (ob === null)
    {
        // Pure read: report the page id as empty and let the caller decide
        // what to do. Bootstraps that need a hard halt call haltScript()
        // themselves; transient missing-root states (tab redraw, slow first
        // paint) are tolerated by callers that compare against pagesIDFoo.
        logHHAuto("PageHelper.getPage: game root element missing, returning empty page id");
        return "";
    }
    const activitiesMainPage = ConfigHelper.getHHScriptVars("pagesIDActivities");
    const tab = queryStringGetParam(window.location.search, 'tab');
    const p: string = ob.getAttribute('page');
    let page = p;
    if (p === activitiesMainPage)
    {
        page = resolveActivitiesSubTab(tab) ?? p;
    }
    if (checkUnknown)
    {
        const knownPages = ConfigHelper.getHHScriptVars("pagesKnownList");
        let isKnown = false;
        for (const knownPage of knownPages)
        {
            if (page === ConfigHelper.getHHScriptVars("pagesID" + knownPage))
            {
                isKnown = true;
            }
        }
        if (!isKnown && page)
        {
            const unknownPageList = getStoredJSON(HHStoredVarPrefixKey + TK.unkownPagesList, {});
            // Idempotent write: skip the JSON.stringify+setStoredValue round-trip
            // when this page was already recorded with the same pathname (avoids
            // a write per AutoLoop tick on long-running unknown pages).
            if (unknownPageList[page] !== window.location.pathname)
            {
                logHHAuto(`Page unkown for script : ${page} / ${window.location.pathname}`);
                unknownPageList[page] = window.location.pathname;
                setStoredValue(HHStoredVarPrefixKey + TK.unkownPagesList, JSON.stringify(unknownPageList));
            }
        }
    }
    return page;
}
