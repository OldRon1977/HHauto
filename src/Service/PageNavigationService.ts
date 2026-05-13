// PageNavigationService.ts
//
// Centralized page navigation. Translates abstract page IDs into
// actual URL paths using ConfigHelper, then navigates via
// window.location after a randomized delay (300-500ms) to look
// more human-like. Handles Nutaku session token injection.
//
// Before navigating, AutoLoop is disabled to prevent firing during
// the page transition. It re-enables after the new page loads.
//
// Navigation mutex: only one navigation can be scheduled at a time.
// Subsequent calls within the same tick are dropped to prevent the
// browser from firing two window.location changes a few ms apart
// (which the game rejects with HTTP Forbidden). The flag resets
// automatically once the page has loaded and the script restarts.
//
// Used by: Every module that needs to navigate to a page.
import { ConfigHelper } from "../Helper/ConfigHelper";
import { getPage } from "../Helper/PageHelper";
import { setStoredValue } from "../Helper/StorageHelper";
import { randomInterval } from "../Helper/TimeHelper";
import { setTimer } from "../Helper/TimerHelper";
import { queryStringGetParam, url_add_param } from "../Helper/UrlHelper";
import { QuestHelper } from "../Module/Quest";
import { logHHAuto } from "../Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK, TK } from "../config/StorageKeys";
import { waitForAjaxIdle, AJAX_IDLE_TIMEOUT_MS, AJAX_IDLE_SETTLE_MS } from './AjaxTracker';

// Module-level mutex: true while a navigation has been scheduled but the
// browser hasn't fully transitioned yet. Reset implicitly on page reload.
let navInFlight = false;

// Throttle the "navigation already in flight" log line so a slow AJAX
// wait does not flood the log with one entry per AutoLoop tick (issue
// #1598 follow-up). Only emit once per NAV_BLOCKED_LOG_INTERVAL_MS.
const NAV_BLOCKED_LOG_INTERVAL_MS = 5000;
let lastNavBlockedLogAt = 0;

// Returns true if on correct page.
export function gotoPage(page,inArgs={},delay = -1)
{
    if (navInFlight) {
        const now = Date.now();
        if (now - lastNavBlockedLogAt > NAV_BLOCKED_LOG_INTERVAL_MS) {
            lastNavBlockedLogAt = now;
            logHHAuto('gotoPage: navigation already in flight, ignoring '+page);
        }
        return false;
    }
    var cp=getPage();
    logHHAuto('going '+cp+'->'+page);

    if (typeof delay != 'number' || delay === -1)
    {
        delay = randomInterval(300,500);
    }

    var togoto:string|undefined = undefined;

    // get page path
    switch(page)
    {
        case ConfigHelper.getHHScriptVars("pagesIDHome"):
            togoto = ConfigHelper.getHHScriptVars("pagesURLHome");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDActivities"):
            togoto = ConfigHelper.getHHScriptVars("pagesURLActivities");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDMissions"):
            togoto = ConfigHelper.getHHScriptVars("pagesURLActivities");
            togoto = url_add_param(togoto, "tab",ConfigHelper.getHHScriptVars("pagesIDMissions"));
            break;
        case ConfigHelper.getHHScriptVars("pagesIDPowerplacemain"):
            togoto = ConfigHelper.getHHScriptVars("pagesURLActivities");
            togoto = url_add_param(togoto, "tab","pop");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDContests"):
            togoto = ConfigHelper.getHHScriptVars("pagesURLActivities");
            togoto = url_add_param(togoto, "tab",ConfigHelper.getHHScriptVars("pagesIDContests"));
            break;
        case ConfigHelper.getHHScriptVars("pagesIDDailyGoals"):
            togoto = ConfigHelper.getHHScriptVars("pagesURLActivities");
            togoto = url_add_param(togoto, "tab",ConfigHelper.getHHScriptVars("pagesIDDailyGoals"));
            break;
        case ConfigHelper.getHHScriptVars("pagesIDHarem"):
            togoto = ConfigHelper.getHHScriptVars("pagesURLHarem");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDMap"):
            togoto = ConfigHelper.getHHScriptVars("pagesURLMap");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDPachinko"):
            togoto = ConfigHelper.getHHScriptVars("pagesURLPachinko");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDLeaderboard"):
            togoto = ConfigHelper.getHHScriptVars("pagesURLLeaderboard");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDShop"):
            togoto = ConfigHelper.getHHScriptVars("pagesURLShop");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDQuest"):
            togoto = QuestHelper.getNextQuestLink();
            if(togoto === undefined) {
                logHHAuto("All quests finished, setting timer to check back later!");
                setTimer('nextMainQuestAttempt', 604800); // 1 week delay
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                return false;
            }
            logHHAuto("Current quest page: "+togoto);
            break;
        case ConfigHelper.getHHScriptVars("pagesIDPantheon"):
            togoto = ConfigHelper.getHHScriptVars("pagesURLPantheon");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDPantheonPreBattle"):
            togoto = ConfigHelper.getHHScriptVars("pagesURLPantheonPreBattle");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDLabyrinth"):
            togoto = ConfigHelper.getHHScriptVars("pagesURLLabyrinth");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDEditLabyrinthTeam"):
            togoto = ConfigHelper.getHHScriptVars("pagesURLEditLabyrinthTeam");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDChampionsMap"):
            togoto = ConfigHelper.getHHScriptVars("pagesURLChampionsMap");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDSeason") :
            togoto = ConfigHelper.getHHScriptVars("pagesURLSeason");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDSeasonArena") :
            togoto = ConfigHelper.getHHScriptVars("pagesURLSeasonArena");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDPentaDrill") :
            togoto = ConfigHelper.getHHScriptVars("pagesURLPentaDrill");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDPentaDrillArena") :
            togoto = ConfigHelper.getHHScriptVars("pagesURLPentaDrillArena");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDPentaDrillPreBattle") :
            togoto = ConfigHelper.getHHScriptVars("pagesURLPentaDrillPreBattle");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDPentaDrillBattle") :
            togoto = ConfigHelper.getHHScriptVars("pagesURLPentaDrillBattle");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDClubChampion") :
            togoto = ConfigHelper.getHHScriptVars("pagesURLClubChampion");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDLeagueBattle") :
            togoto = ConfigHelper.getHHScriptVars("pagesURLLeagueBattle");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDTrollPreBattle") :
            togoto = ConfigHelper.getHHScriptVars("pagesURLTrollPreBattle");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDEvent") :
            togoto = ConfigHelper.getHHScriptVars("pagesURLEvent");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDClub") :
            togoto = ConfigHelper.getHHScriptVars("pagesURLClub");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDPoV") :
            togoto = ConfigHelper.getHHScriptVars("pagesURLPoV");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDPoG") :
            togoto = ConfigHelper.getHHScriptVars("pagesURLPoG");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDSeasonalEvent") :
            togoto = ConfigHelper.getHHScriptVars("pagesURLSeasonalEvent");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDEditTeam") :
            togoto = ConfigHelper.getHHScriptVars("pagesURLEditTeam");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDWaifu") :
            togoto = ConfigHelper.getHHScriptVars("pagesURLWaifu");
            break;
        case ConfigHelper.getHHScriptVars("pagesIDLoveRaid") :
            togoto = ConfigHelper.getHHScriptVars("pagesURLLoveRaid");
            break;
        case (page.match(/^\/champions\/[123456]$/) || {}).input:
            togoto = page;
            break;
        case (page.match(/^\/characters\/\d+$/) || {}).input:
            togoto = page;
            break;
        case (page.match(/^\/girl\/\d+$/) || {}).input:
            togoto = page;
            break;
        case (page.match(/^\/quest\/\d+$/) || {}).input:
            togoto = page;
            break;
        case (page.match(/^\/quest\/\d+.*$/) || {}).input:
            togoto = page;
            break;
        default:
            logHHAuto("Unknown goto page request. No page \'"+page+"\' defined.");
    }
    if(togoto != undefined)
    {
        setLastPageCalled(togoto);
        if (typeof inArgs === 'object' && Object.keys(inArgs).length > 0)
        {
            for (let arg of Object.keys(inArgs))
            {
                togoto = url_add_param(togoto, arg,inArgs[arg]);
            }
        }

        togoto = addNutakuSession(togoto) as string;

        setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
        logHHAuto("setting autoloop to false");
        logHHAuto('GotoPage : '+togoto+' in '+delay+'ms.');
        navInFlight = true;
        const targetUrl = togoto;
        setTimeout(function () {
            // Wait for any in-flight game AJAX (e.g. PoP claim POSTs) to
            // finish before changing the URL. Setting window.location.href
            // cancels open XHRs with NS_BINDING_ABORTED, and an aborted
            // state-changing request can make the server answer Forbidden
            // on the next call (issue #1598). If the wait times out (the
            // server is genuinely slow), abort the navigation and let
            // AutoLoop retry on the next tick instead of cancelling the
            // open request.
            waitForAjaxIdle(AJAX_IDLE_TIMEOUT_MS, AJAX_IDLE_SETTLE_MS).then(function (idle) {
                if (!idle) {
                    logHHAuto('gotoPage: AJAX still busy after '+AJAX_IDLE_TIMEOUT_MS+'ms, deferring navigation to '+targetUrl);
                    setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "true");
                    navInFlight = false;
                    return;
                }
                window.location.href = window.location.origin + targetUrl;
            });
        }, delay);
    }
    else
    {
        logHHAuto("Couldn't find page path. Page was undefined...");
        navInFlight = true;
        setTimeout(function () {
            waitForAjaxIdle(AJAX_IDLE_TIMEOUT_MS, AJAX_IDLE_SETTLE_MS).then(function (idle) {
                if (!idle) {
                    logHHAuto('gotoPage: AJAX still busy after '+AJAX_IDLE_TIMEOUT_MS+'ms, deferring reload');
                    setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "true");
                    navInFlight = false;
                    return;
                }
                location.reload();
            });
        }, delay);
    }
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
export function safeReload(delay = -1): boolean {
    if (navInFlight) {
        const now = Date.now();
        if (now - lastNavBlockedLogAt > NAV_BLOCKED_LOG_INTERVAL_MS) {
            lastNavBlockedLogAt = now;
            logHHAuto('safeReload: navigation already in flight, ignoring reload');
        }
        return false;
    }
    if (typeof delay !== 'number' || delay === -1) {
        delay = randomInterval(300, 500);
    }
    setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
    logHHAuto('safeReload: scheduled in ' + delay + 'ms');
    navInFlight = true;
    setTimeout(function () {
        waitForAjaxIdle(AJAX_IDLE_TIMEOUT_MS, AJAX_IDLE_SETTLE_MS).then(function (idle) {
            if (!idle) {
                logHHAuto('safeReload: AJAX still busy after ' + AJAX_IDLE_TIMEOUT_MS + 'ms, deferring reload');
                setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "true");
                navInFlight = false;
                return;
            }
            location.reload();
        });
    }, delay);
    return true;
}

/**
 * Navigate to an arbitrary URL after waiting for any in-flight game
 * AJAX to finish. Use when gotoPage's page-ID switch cannot be used
 * (e.g. event links provided as raw href). Same NS_BINDING_ABORTED
 * guard as gotoPage (see issue #1598).
 */
export function safeNavigateHref(url: string, delay = -1): boolean {
    if (navInFlight) {
        const now = Date.now();
        if (now - lastNavBlockedLogAt > NAV_BLOCKED_LOG_INTERVAL_MS) {
            lastNavBlockedLogAt = now;
            logHHAuto('safeNavigateHref: navigation already in flight, ignoring ' + url);
        }
        return false;
    }
    if (typeof delay !== 'number' || delay === -1) {
        delay = randomInterval(300, 500);
    }
    setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
    logHHAuto('safeNavigateHref: ' + url + ' in ' + delay + 'ms');
    navInFlight = true;
    setTimeout(function () {
        waitForAjaxIdle(AJAX_IDLE_TIMEOUT_MS, AJAX_IDLE_SETTLE_MS).then(function (idle) {
            if (!idle) {
                logHHAuto('safeNavigateHref: AJAX still busy after ' + AJAX_IDLE_TIMEOUT_MS + 'ms, deferring navigation to ' + url);
                setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "true");
                navInFlight = false;
                return;
            }
            location.href = url;
        });
    }, delay);
    return true;
}

export function addNutakuSession(togoto: string | Array<string> | Object): string | Array<string> | Object{
    if (unsafeWindow.hh_nutaku) {
        const hhSession = queryStringGetParam(window.location.search, 'sess');
        if (hhSession) {
            if (typeof togoto === 'string' && !togoto.includes("sess=")) {
                togoto = url_add_param(togoto, 'sess', hhSession);
            }
            else if (Array.isArray(togoto) && !(togoto['sess'])) {
                togoto['sess'] = hhSession;
            }
            else if (typeof togoto === 'object' && togoto.hasOwnProperty('sess') === false) {
                togoto['sess'] = hhSession;
            }
        }
        else {
            logHHAuto('ERROR Nutaku detected and no session found');
        }
    }
    return togoto;
}

function setLastPageCalled(inPage: string)
{
    //console.log("testingHome : setting to : "+JSON.stringify({page:inPage, dateTime:new Date().getTime()}));
    setStoredValue(HHStoredVarPrefixKey+TK.LastPageCalled, JSON.stringify({page:inPage, dateTime:new Date().getTime()}));
}