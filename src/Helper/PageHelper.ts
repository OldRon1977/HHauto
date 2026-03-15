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
//          PageNavigationService (navigation targets)

import { PlaceOfPower } from '../Module/index';
import { isJSON, logHHAuto } from '../Utils/index';
import { HHStoredVarPrefixKey, SK, TK } from '../config/index';
import { ConfigHelper } from "./ConfigHelper";
import { getStoredJSON, getStoredValue, setStoredValue } from "./StorageHelper";
import { queryStringGetParam } from "./UrlHelper";

export function getPage(checkUnknown = false, checkPop = false):string
{
    var ob = document.getElementById(ConfigHelper.getHHScriptVars("gameID"));
    if(ob===undefined || ob === null)
    {
        logHHAuto("Unable to find page attribute, stopping script");
        setStoredValue(HHStoredVarPrefixKey+SK.master, "false");
        setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
        logHHAuto("setting autoloop to false");
        throw new Error("Unable to find page attribute, stopping script.");
        return "";
    }
    //var p=ob.className.match(/.*page-(.*) .*/i)[1];
    let activitiesMainPage = ConfigHelper.getHHScriptVars("pagesIDActivities");
    var tab = queryStringGetParam(window.location.search,'tab');
    var p:string=ob.getAttribute('page');
    let page = p;
    if (p==activitiesMainPage)
    {
        if (tab === 'contests' || $("#activities-tabs > div.switch-tab.underline-tab.tab-switcher-fade-in[data-tab='contests']").length>0)
        {
            page = ConfigHelper.getHHScriptVars("pagesIDContests");
        }
        if (tab === 'missions' || $("#activities-tabs > div.switch-tab.underline-tab.tab-switcher-fade-in[data-tab='missions']").length>0)
        {
            page = ConfigHelper.getHHScriptVars("pagesIDMissions");
        }
        if (tab === 'daily_goals' || $("#activities-tabs > div.switch-tab.underline-tab.tab-switcher-fade-in[data-tab='daily_goals']").length>0)
        {
            page = ConfigHelper.getHHScriptVars("pagesIDDailyGoals");

            if (checkPop && tab === 'pop') {
                // Wrong POP targetted
                var index = queryStringGetParam(window.location.search,'index');
                if (index !== null)
                {
                    PlaceOfPower.addPopToUnableToStart(index,"Unable to go to Pop "+index+" as it is locked.");
                    PlaceOfPower.removePopFromPopToStart(index);
                }
            }
        }
        if (tab === 'pop' || $("#activities-tabs > div.switch-tab.underline-tab.tab-switcher-fade-in[data-tab='pop']").length>0)
        {
            // if on Pop menu
            var t;
            var popList= $("div.pop_list").not('[style*="display:none"]').not('[style*="display: none"]');
            if (popList.length >= 1 || unsafeWindow.pop_list)
            {
                t = 'main';
            }
            else
            {
                var popThumb = $(".pop_thumb_selected[pop_id]");
                t = unsafeWindow.pop_index || (popThumb.length > 0 ? popThumb.attr('pop_id') : undefined);
                checkUnknown = false;
                if (t === undefined)
                {
                    // Keep this but not triggered anymore. When Wrong POP is targetted, daily goals is highlighted
                    t='main';
                    var index = queryStringGetParam(window.location.search,'index');
                    if (checkPop && index !== null)
                    {
                        PlaceOfPower.addPopToUnableToStart(index,"Unable to go to Pop "+index+" as it is locked.");
                        PlaceOfPower.removePopFromPopToStart(index);
                    }
                }
            }
            page = "powerplace"+t;
        }
    }
    if (checkUnknown)
    {
        const knownPages = ConfigHelper.getHHScriptVars("pagesKnownList");
        let isKnown = false;
        for (let knownPage of knownPages)
        {
            //console.log(knownPage)
            if (page === ConfigHelper.getHHScriptVars("pagesID"+knownPage))
            {
                isKnown = true;
            }
        }
        if (!isKnown && page )
        {
            let unknownPageList = getStoredJSON(HHStoredVarPrefixKey+TK.unkownPagesList, {});
            logHHAuto("Page unkown for script : "+page+" / "+window.location.pathname);
            unknownPageList[page] = window.location.pathname;
            //console.log(unknownPageList);
            setStoredValue(HHStoredVarPrefixKey+TK.unkownPagesList, JSON.stringify(unknownPageList));
        }
    }
    return page;
}