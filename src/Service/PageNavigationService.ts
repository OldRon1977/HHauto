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
// Used by: Every module that needs to navigate to a game page.

import { ConfigHelper, getPage, queryStringGetParam, randomInterval, setStoredValue, setTimer, url_add_param } from '../Helper/index';
import { QuestHelper } from '../Module/index';
import { logHHAuto } from '../Utils/index';
import { HHStoredVarPrefixKey, SK, TK } from '../config/index';

// Returns true if on correct page.
export function gotoPage(page,inArgs={},delay = -1)
{
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
        setTimeout(function () {window.location.href = window.location.origin + togoto;},delay);
    }
    else
    {
        logHHAuto("Couldn't find page path. Page was undefined...");
        setTimeout(function () {location.reload();},delay);
    }
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