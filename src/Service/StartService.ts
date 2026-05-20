// StartService.ts
//
// One-time initialization that runs when the script first loads on a
// game page. Responsibilities:
//
//   - Version migration: detects script version changes and runs
//     data migrations (e.g. consolidating mask reward settings)
//   - Environment checks: verifies jQuery is loaded, Hero object
//     exists, and the user is logged in before proceeding
//   - Menu setup: creates the HHAuto settings menu, populates
//     dynamic dropdowns (troll targets, league sort, labyrinth),
//     and binds all event handlers
//   - UI injection: adds the pInfo overlay, hides cross-game promo
//     banners, moves ads, and sets up the debug dialog
//   - Auto-loop start: restores timers from storage, applies
//     defaults, then kicks off the first autoLoop() call
//
// The hardened_start() function is the true entry point, called both
// immediately and after a 5-second delay as a fallback. It guards
// against missing jQuery and "Forbidden" error pages.
//
// Used by: src/index.ts (entry point)
import { ConfigHelper } from "../Helper/ConfigHelper";
import { doStatUpgrades } from "../Helper/HeroHelper";
import { getHHVars } from "../Helper/HHHelper";
import { addEventsOnMenuItems, getMenu, getMenuValues, HHMenu, maskInactiveMenus, setMenuValues } from "../Helper/HHMenuHelper";
import { getTextForUI, manageTranslationPopUp } from "../Helper/LanguageHelper";
import { getPage } from "../Helper/PageHelper";
import { debugDeleteAllVars, debugDeleteTempVars, deleteStoredValue, getStorageItem, getStoredJSON, getStoredValue, migrateHHVars, saveHHStoredVarsDefaults, saveHHVarsSettingsAsJSON, setHHStoredVarToDefault, setStoredValue } from "../Helper/StorageHelper";
import { randomInterval } from "../Helper/TimeHelper";
import { getTimeLeft, setTimer, setTimers, Timers } from "../Helper/TimerHelper";
import { Booster } from "../Module/Booster";
import { Club } from "../Module/Club";
import { Contest } from "../Module/Contest";
import { DailyGoals } from "../Module/DailyGoals";
import { LeagueHelper } from "../Module/League";
import { Market } from "../Module/Market";
import { Missions } from "../Module/Missions";
import { MonthlyCards } from "../Module/MonthlyCard";
import { PlaceOfPower } from "../Module/PlaceOfPower";
import { Troll } from "../Module/Troll";
import { fillHHPopUp, maskHHPopUp } from "../Utils/HHPopup";
import { logHHAuto, saveHHDebugLog } from "../Utils/LogUtils";
import { callItOnce, isJSON, myfileLoad_onChange, replaceCheatClick } from "../Utils/Utils";
import { HHStoredVarPrefixKey, HHStoredVars } from "../config/HHStoredVars";
import { SK, TK } from "../config/StorageKeys";
import { AdsService } from './AdsService';
import { autoLoop, getBurst } from "./AutoLoop";
import { createPInfo } from "./InfoService";
import { FeaturePopupService } from "./FeaturePopupService";
import { SurveyService } from "./SurveyService";
import {
    bindMouseEvents
} from "./MouseService";
import { disableToolTipsDisplay, enableToolTipsDisplay, manageToolTipsDisplay } from "./TooltipService";
import { installAjaxTracker, setOnAjaxForbidden } from './AjaxTracker';
import {
    nextForbiddenDelaySeconds,
    nextStreakCount,
    recordForbidden,
    FORBIDDEN_COUNT_KEY,
    FORBIDDEN_LAST_AT_KEY,
} from './ForbiddenBackoff';

var started=false;
var debugMenuID;
var heroRetryTimer: ReturnType<typeof setTimeout> | null = null;
var heroRetryCount = 0;
const HERO_MAX_RETRIES = 15;

// Persistent Forbidden backoff (issue #1598).
//
// The reload-delay formula lives in ForbiddenBackoff.ts so it can be
// unit-tested in isolation. The counter itself lives in sessionStorage
// so it survives location.reload() but resets when the user closes the
// tab. On a successful start() (Hero object available), the counter is
// cleared, so a single transient Forbidden does not penalise later runs.

// Cold-start delay (issue #1598).
//
// After a long inactivity (PC hibernation, tab in background, slow page
// load) the very first AJAX call from this script tab can hit a
// rate-limited server window. We delay the initial autoLoop tick by a
// few seconds when the last recorded activity is older than the
// threshold below, giving the page time to settle before any module
// fires a navigation.
const COLD_START_THRESHOLD_MS = 60 * 1000;
const COLD_START_DELAY_MS = 4000;
const NORMAL_START_DELAY_MS = 1000;

export class StartService {
    static checkVersion()
    {
        let previousScriptVersion = getStoredValue(HHStoredVarPrefixKey + TK.scriptversion);
        if (previousScriptVersion != GM.info.script.version) {
            // run action on new script version
            logHHAuto(`New script version detected from ${previousScriptVersion} to ${GM.info.script.version}`);
            setStoredValue(HHStoredVarPrefixKey + TK.scriptversion, GM.info.script.version);

            // +Raid Stars migration handled below (outside version check)

            if ('7.26.0' === GM.info.script.version) {
                // sett all mask rewards to true if any of the previous individual mask rewards where true
                let maskReward = false;
                if (getStoredValue(HHStoredVarPrefixKey + SK.PoAMaskRewards) === "true") maskReward = true;
                if (getStoredValue(HHStoredVarPrefixKey + SK.PoVMaskRewards) === "true") maskReward = true;
                if (getStoredValue(HHStoredVarPrefixKey + SK.PoGMaskRewards) === "true") maskReward = true;
                if (getStoredValue(HHStoredVarPrefixKey + SK.SeasonMaskRewards) === "true") maskReward = true;
                if (getStoredValue(HHStoredVarPrefixKey + SK.SeasonalEventMaskRewards) === "true") maskReward = true;
                setStoredValue(HHStoredVarPrefixKey + SK.AllMaskRewards, maskReward);

                // delete old individual mask rewards settings
                deleteStoredValue(HHStoredVarPrefixKey + SK.PoAMaskRewards);
                deleteStoredValue(HHStoredVarPrefixKey + SK.PoVMaskRewards);
                deleteStoredValue(HHStoredVarPrefixKey + SK.PoGMaskRewards);
                deleteStoredValue(HHStoredVarPrefixKey + SK.SeasonMaskRewards);
                deleteStoredValue(HHStoredVarPrefixKey + SK.SeasonalEventMaskRewards);
            }
        }
    }
}

export function setDefaults(force = false)
{
    for (let i of Object.keys(HHStoredVars))
    {
        if (HHStoredVars[i].storage !== undefined )
        {
            let storageItem = getStorageItem(HHStoredVars[i].storage);
            let isInvalid = false;
            //console.log(storageItem[i], storageItem[i] !== undefined);
            if (HHStoredVars[i].isValid !== undefined && storageItem[i] !== undefined)
            {
                isInvalid = !HHStoredVars[i].isValid.test(storageItem[i]);
                if (isInvalid)
                {
                    logHHAuto("HHStoredVar "+i+" is invalid, reseting.");
                    logHHAuto("HHStoredVar "+i+" current value : "+storageItem[i]);
                }
            }
            if (HHStoredVars[i].default !== undefined )
            {
                if (storageItem[i] === undefined || force || isInvalid)
                {
                    setHHStoredVarToDefault(i);
                }
            }
            else
            {
                if (force ||isInvalid)
                {
                    storageItem.removeItem(i);
                }
            }
        }
        else
        {
            logHHAuto("HHStoredVar "+i+" has no storage defined.");
        }
    }
}


export function hardened_start()
{
    debugMenuID = GM_registerMenuCommand(getTextForUI("saveDebug","elementText"), saveHHDebugLog);
    //GM_unregisterMenuCommand(debugMenuID);
    // Install the AJAX request counter as early as possible so any later
    // page-changing module call can wait for in-flight game POSTs to
    // finish (prevents NS_BINDING_ABORTED -> Forbidden race, issue #1598).
    try {
        installAjaxTracker();
        // Wire AjaxTracker's 403 hook to the persistent backoff counter.
        // Done here (not via a direct import inside AjaxTracker) to keep
        // AjaxTracker free of any HHStoredVars dependency: HHStoredVars
        // imports PlaceOfPower, which imports AjaxTracker, so a direct
        // import would form a TDZ cycle (issue #1598 follow-up).
        setOnAjaxForbidden(() => { try { recordForbidden(); } catch (e) {} });
    } catch (e) { /* tracker is best-effort */ }

    if ((unsafeWindow as any).jQuery == undefined) {
        console.log("HHAUTO WARNING: No jQuery found.");

        try {
            const forbiddenWords = document.getElementsByTagName('body')[0].innerText === 'Forbidden';
            if (forbiddenWords) {
                // Persistent backoff: each consecutive Forbidden doubles
                // the window. The counter only resets when no Forbidden
                // has been seen for FORBIDDEN_STREAK_WINDOW_MS, so
                // brief recoveries (e.g. one PoP claim succeeding
                // between two Forbiddens) do not reset the streak.
                let prevCount = 0;
                let prevAt = 0;
                try {
                    const rawCount = sessionStorage.getItem(FORBIDDEN_COUNT_KEY);
                    prevCount = rawCount ? parseInt(rawCount, 10) : 0;
                    if (!Number.isFinite(prevCount) || prevCount < 0) prevCount = 0;
                    const rawAt = sessionStorage.getItem(FORBIDDEN_LAST_AT_KEY);
                    prevAt = rawAt ? parseInt(rawAt, 10) : 0;
                    if (!Number.isFinite(prevAt) || prevAt < 0) prevAt = 0;
                } catch (e) { /* sessionStorage unavailable */ }

                const now = Date.now();
                const count = nextStreakCount(prevCount, prevAt, now);
                try {
                    sessionStorage.setItem(FORBIDDEN_COUNT_KEY, String(count));
                    sessionStorage.setItem(FORBIDDEN_LAST_AT_KEY, String(now));
                } catch (e) {}

                const time = nextForbiddenDelaySeconds(count);
                logHHAuto('HHAUTO WARNING: "Forbidden" detected (#' + count + '), reloading the page in ' + time + ' seconds');
                setTimeout(() => { location.reload(); }, time * 1000);
            }
        } catch (error) {}
        return;
    }
    if (!started)
    {
        started=true;
        start();
    }

}

export function start() {

    if (unsafeWindow.shared?.Hero === undefined)
    {
        heroRetryCount++;
        if (heroRetryCount > HERO_MAX_RETRIES) {
            logHHAuto('Hero object not available after ' + HERO_MAX_RETRIES + ' retries. Giving up. Try reloading the page.');
            return;
        }
        logHHAuto('???no Hero??? (attempt ' + heroRetryCount + '/' + HERO_MAX_RETRIES + ')');
        started = false;
        heroRetryTimer = setTimeout(hardened_start, 5000);
        return;
    }
    // Hero available, cancel any pending retry and reset counter
    if (heroRetryTimer !== null) {
        clearTimeout(heroRetryTimer);
        heroRetryTimer = null;
    }
    heroRetryCount = 0;
    if($("a[rel='phoenix_member_login']").length > 0)
    {    
        logHHAuto('Not logged in, please login first!');
        return;
    }

    StartService.checkVersion();
    Club.checkClubStatus();
    MonthlyCards.updateInputPattern();
    replaceCheatClick();
    migrateHHVars();
    
    const isMainAdventure = getHHVars('Hero.infos.questing.choices_adventure') == 0;
    const id_world = getHHVars('Hero.infos.questing.id_world');
    if (isMainAdventure) setStoredValue(HHStoredVarPrefixKey + TK.MainAdventureWorldID, id_world);
    else setStoredValue(HHStoredVarPrefixKey + TK.SideAdventureWorldID, id_world);

    if (getStoredValue(HHStoredVarPrefixKey + SK.leagueListDisplayPowerCalc) !== "true" && getStoredValue(HHStoredVarPrefixKey + SK.autoLeaguesSortIndex) !== LeagueHelper.SORT_POWERCALC)
    {
        // remove big var not removed from previous version
        deleteStoredValue(HHStoredVarPrefixKey+TK.LeagueOpponentList);
    }

    $('.redirect.gay').hide();
    $('.redirect.comix').hide();

    $('#starter_offer').hide();
    $('#starter_offer_background').hide();

    if (getStoredValue(HHStoredVarPrefixKey+TK.Timers))
    {
        setTimers(getStoredJSON(HHStoredVarPrefixKey+TK.Timers, {}));
    }
    // clearEventData("onlyCheckEventsHHScript");

    // Migrate +Raid Stars stored value to string-based selection (runs every load).
    // Handles: old boolean ("true"/"false"), old selectedIndex ("1"/"2"/"4"),
    // old grade-based ("0"/"3"/"5"/"6"), current string ("off"/"exact3"/"min3"/"exact5").
    const raidStarsVal = getStoredValue(HHStoredVarPrefixKey + SK.plusLoveRaidMythic);
    if (raidStarsVal !== undefined && raidStarsVal !== null) {
        const selectionMap: Record<string, string> = {
            "true": "exact5", "false": "off",                           // old boolean format
            "1": "exact3", "2": "exact5", "4": "exact5",                 // old selectedIndex format
            "0": "off", "3": "exact3", "5": "exact5", "6": "exact5"      // old grade-based format
            // "off","exact3","min3","exact5" are already valid
        };
        if (selectionMap[raidStarsVal] !== undefined) {
            setStoredValue(HHStoredVarPrefixKey + SK.plusLoveRaidMythic, selectionMap[raidStarsVal]);
            logHHAuto("Migrated +Raid Stars value '" + raidStarsVal + "' → '" + selectionMap[raidStarsVal] + "'");
        }
    }

    setDefaults();

    if (getStoredValue(HHStoredVarPrefixKey+SK.mousePause) === "true") {
        bindMouseEvents();
    }

    const hhAutoMenu = new HHMenu();
    $('#contains_all').prepend(getMenu());

    hhAutoMenu.createMenuButton();
    addEventsOnMenuItems();

    $("#showTooltips").on("change",() => {
        //console.log(this.checked);
        if ((<HTMLInputElement>$("#showTooltips")[0]).checked)
        {
            enableToolTipsDisplay(true);
        }
        else
        {
            disableToolTipsDisplay(true);
        }
    });

    const pInfoDiv = createPInfo();

    if(
        getPage()==ConfigHelper.getHHScriptVars("pagesIDMissions")
    || getPage()==ConfigHelper.getHHScriptVars("pagesIDContests")
    || getPage()==ConfigHelper.getHHScriptVars("pagesIDPowerplacemain")
    || getPage()==ConfigHelper.getHHScriptVars("pagesIDDailyGoals")
    )
    {
        Contest.styles();
        PlaceOfPower.styles();
        DailyGoals.styles();
        Missions.styles();
    }

    AdsService.moveAds(getPage());

    Booster.collectBoostersFromAjaxResponses();

    $('#contains_all').append(pInfoDiv);
    maskInactiveMenus();

    // Add auto troll options
    let lastTrollIdAvailable:number = -1;
    if (isMainAdventure) {
        lastTrollIdAvailable = Troll.getLastTrollIdAvailable();
    } else {
        lastTrollIdAvailable = Troll.getLastTrollIdAvailable(false, Number(getStoredValue(HHStoredVarPrefixKey + TK.MainAdventureWorldID)));
    }
    hhAutoMenu.fillTrollSelectMenu(lastTrollIdAvailable);
    hhAutoMenu.fillLoveRaidSelectMenu();
    hhAutoMenu.fillRaidStarsMenu();

    // Add league options
    hhAutoMenu.fillLeagueSelectMenu();
    hhAutoMenu.fillLeaguSortMenu();
    hhAutoMenu.fillLabyDifficultyMenu();

    setMenuValues();
    getMenuValues();
    manageToolTipsDisplay();

    $("#git").on("click", function(){ window.open("https://github.com/OldRon1977/HHauto/wiki"); });
    $("#ReportBugs").on("click", function(){ window.open("https://github.com/OldRon1977/HHauto/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc"); });
    $("#loadConfig").on("click", function(){
        let LoadDialog='<p>After you select the file the settings will be automatically updated.</p><p> If nothing happened, then the selected file contains errors.</p><p id="LoadConfError"style="color:#f53939;"></p><p><label><input type="file" id="myfile" accept=".json" name="myfile"> </label></p>';
        fillHHPopUp("loadConfig",getTextForUI("loadConfig","elementText"), LoadDialog);
        $('#myfile').on('change', myfileLoad_onChange);

    });
    $("#saveConfig").on("click", saveHHVarsSettingsAsJSON);
    $("#saveDefaults").on("click", saveHHStoredVarsDefaults);
    $("#DebugMenu").on("click", function(){
        let debugDialog =   '<div style="padding:10px; display:flex;flex-direction:column">'
        +    '<p>HHAuto : v'+GM_info.script.version+'</p>'
        +    '<p>'+getTextForUI("DebugFileText","elementText")+'</p>'
        +    '<div style="display:flex;flex-direction:row">'
        +     '<div class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("saveDebug","tooltip")+'</span><label class="myButton" id="saveDebug">'+getTextForUI("saveDebug","elementText")+'</label></div>'
        +    '</div>'
        +    '<p>'+getTextForUI("DebugResetTimerText","elementText")+'</p>'
        +    '<div style="display:flex;flex-direction:row">'
        +     '<div style="padding-right:30px"class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("timerResetButton","tooltip")+'</span><label class="myButton" id="timerResetButton">'+getTextForUI("timerResetButton","elementText")+'</label></div>'
        +     '<div style="padding-right:10px" class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("timerResetSelector","tooltip")+'</span><select id="timerResetSelector"></select></div>'
        +     '<div class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("timerLeftTime","tooltip")+'</span><span id="timerLeftTime">'+getTextForUI("timerResetNoTimer","elementText")+'</span></div>'
        +    '</div>'
        +    '<p>'+getTextForUI("DebugOptionsText","elementText")+'</p>'
        +    '<div style="display:flex;flex-direction:row">'
        +     '<div style="padding-right:30px" class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("DeleteTempVars","tooltip")+'</span><label class="myButton" id="DeleteTempVars">'+getTextForUI("DeleteTempVars","elementText")+'</label></div>'
        +     '<div class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("ResetAllVars","tooltip")+'</span><label class="myButton" id="ResetAllVars">'+getTextForUI("ResetAllVars","elementText")+'</label></div>'
        +    '</div>'
        +  '</div>'
        fillHHPopUp("DebugMenu",getTextForUI("DebugMenu","elementText"), debugDialog);
        $("#DeleteTempVars").on("click", function(){
            debugDeleteTempVars();
            location.reload();
        });
        $("#ResetAllVars").on("click", function(){
            debugDeleteAllVars();
            location.reload();
        });
        $("#saveDebug").on("click", saveHHDebugLog);

        $("#timerResetButton").on("click", function(){
            let timerSelector = <HTMLSelectElement>document.getElementById("timerResetSelector");
            if (timerSelector.options[timerSelector.selectedIndex].text !== getTextForUI("timerResetNoTimer","elementText") && timerSelector.options[timerSelector.selectedIndex].text !== getTextForUI("timerResetSelector","elementText"))
            {
                const sMenu = document.getElementById("sMenu");
                if(sMenu != null) sMenu.style.display = "none";
                maskHHPopUp();
                setTimer(timerSelector.options[timerSelector.selectedIndex].text,0);
                timerSelector.selectedIndex = 0;
            }
        });
        $(document).on('change',"#timerResetSelector", function() {
            let timerSelector = <HTMLSelectElement>document.getElementById("timerResetSelector");
            const timerLeftTime = document.getElementById("timerLeftTime");
            if (timerSelector.options[timerSelector.selectedIndex].text !== getTextForUI("timerResetNoTimer","elementText")  && timerSelector.options[timerSelector.selectedIndex].text !== getTextForUI("timerResetSelector","elementText"))
            {
                $("#timerLeftTime").text(getTimeLeft(timerSelector.options[timerSelector.selectedIndex].text));
            }
            else
            {
                $("#timerLeftTime").text( getTextForUI("timerResetNoTimer","elementText"));
            }
        });
        // Add Timer reset options //changed
        let timerOptions = <HTMLSelectElement>document.getElementById("timerResetSelector");
        var countTimers=0;
        let optionElement = document.createElement("option");
        optionElement.value = countTimers+'';
        optionElement.text = getTextForUI("timerResetSelector","elementText");
        countTimers++;
        timerOptions.add(optionElement);

        for (let i2 in Timers) {
            let optionElement = document.createElement("option");
            optionElement.value = countTimers+'';
            countTimers++;
            optionElement.text = i2;
            timerOptions.add(optionElement);
        };

        if(countTimers === 1)
        {
            let optionElement = document.createElement("option");
            optionElement.value = countTimers+'';
            optionElement.text = getTextForUI("timerResetNoTimer","elementText");
            timerOptions.add(optionElement);
        }

    });

    document.querySelectorAll("div#sMenu input[pattern]").forEach((currentInputElement) =>
                                                                  {
        const currentInput = <HTMLInputElement>currentInputElement;
        currentInput.addEventListener('input', () => {
            currentInput.style.backgroundColor = "";
            currentInput.checkValidity();
        });

        currentInput.addEventListener('invalid', () => {
            currentInput.style.backgroundColor = "red";
            //document.getElementById("master").checked = false;
            //setStoredValue(HHStoredVarPrefixKey+SK.master, "false");
        });
        currentInput.checkValidity();
    });



    // Don't re-enable autoLoop if a harem tool flow (Stuff Team, Give XP, etc.)
    // is in progress — these multi-page flows rely on autoLoop staying disabled
    // to prevent action handlers from interrupting with page navigations.
    const activeHaremFlow = getStoredValue(HHStoredVarPrefixKey + TK.haremGirlMode);
    if (!activeHaremFlow) {
        setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "true");
    }
    if (typeof getStoredValue(HHStoredVarPrefixKey+TK.freshStart) == "undefined" || isNaN(Number(getStoredValue(HHStoredVarPrefixKey+TK.autoLoopTimeMili)))) {
        setDefaults(true);
    }

    if (getBurst())
    {
        Market.doShopping();
        if ( getStoredValue(HHStoredVarPrefixKey+SK.autoStatsSwitch) ==="true" )
        {
            doStatUpgrades();
        }
    }

    if (unsafeWindow.hh_nutaku && window.top)
    {
        function Alive()
        {
            if(window.top) window.top.postMessage({ImAlive:true},'*');
            if (getStoredValue(HHStoredVarPrefixKey+TK.autoLoop) =="true")
            {
                setTimeout(Alive,2000);
            }
        }
        Alive();
    }
    if (getStoredJSON(HHStoredVarPrefixKey+TK.LastPageCalled, {page:'', dateTime:0}).page?.indexOf(".html") > 0 )
    {
        //console.log("testingHome : setting to : "+getPage());
        setStoredValue(HHStoredVarPrefixKey+TK.LastPageCalled, JSON.stringify({page:getPage(), dateTime:new Date().getTime()}));
    }
    if (getStoredJSON(HHStoredVarPrefixKey+TK.LastPageCalled, {page:'', dateTime:0}).page === ConfigHelper.getHHScriptVars("pagesIDHome"))
    {
        //console.log("testingHome : delete");
        deleteStoredValue(HHStoredVarPrefixKey+TK.LastPageCalled);
    }
    getPage(true);

    // Version-gated popups: show but don't block autoLoop
    if (FeaturePopupService.shouldShowPopup()) {
        FeaturePopupService.showPopup();
    }

    if (SurveyService.shouldShowSurvey()) {
        SurveyService.showSurveyPopup();
    }

    // Cold-start delay: if the script has been idle for a while (tab in
    // background, hibernation, slow first paint) give the page extra
    // time before the first navigation, otherwise the very first
    // gotoPage() can race the server's rate-limit window (issue #1598).
    let initialDelayMs: number = NORMAL_START_DELAY_MS;
    try {
        const last = getStoredJSON(HHStoredVarPrefixKey + TK.LastPageCalled, { page: '', dateTime: 0 });
        const lastTs = typeof last?.dateTime === 'number' ? last.dateTime : 0;
        if (lastTs > 0 && (Date.now() - lastTs) > COLD_START_THRESHOLD_MS) {
            initialDelayMs = COLD_START_DELAY_MS;
            logHHAuto('Cold start detected (last activity > ' + Math.round(COLD_START_THRESHOLD_MS/1000) + 's ago), delaying first autoLoop by ' + initialDelayMs + 'ms');
        }
    } catch (e) { /* fall back to normal delay */ }
    setTimeout(autoLoop, initialDelayMs);

    // Manual survey button
    $("#settingsSurvey").on("click", function() {
        SurveyService.showSurveyPopup();
    });

    GM_registerMenuCommand(getTextForUI("translate","elementText"),manageTranslationPopUp);

};
