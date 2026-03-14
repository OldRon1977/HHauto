import {
    addEventsOnMenuItems,
    ConfigHelper,
    debugDeleteAllVars,
    debugDeleteTempVars,
    deleteStoredValue,
    doStatUpgrades,
    getHHVars,
    getMenu,
    getMenuValues,
    getPage,
    getStorageItem,
    getStoredValue,
    getTextForUI,
    getTimeLeft,
    HHMenu,
    manageTranslationPopUp,
    maskInactiveMenus,
    migrateHHVars,
    randomInterval,
    saveHHStoredVarsDefaults,
    saveHHVarsSettingsAsJSON,
    setHHStoredVarToDefault,
    setMenuValues,
    setStoredValue,
    setTimer,
    setTimers,
    Timers
 } from '../Helper/index';
import {
    Booster,
    Club,
    Contest,
    DailyGoals,
    LeagueHelper,
    Market,
    Missions,
    MonthlyCards,
    PlaceOfPower,
    Troll
} from '../Module/index';
import { 
    callItOnce,
    fillHHPopUp,
    isJSON,
    logHHAuto,
    maskHHPopUp,
    myfileLoad_onChange,
    replaceCheatClick, 
    saveHHDebugLog
} from '../Utils/index';
import {
    HHStoredVarPrefixKey,
    HHStoredVars
} from '../config/index';
import { AdsService } from './AdsService';
import { autoLoop, getBurst } from "./AutoLoop";
import { createPInfo } from "./InfoService";
import {
    bindMouseEvents
} from "./MouseService";
import { disableToolTipsDisplay, enableToolTipsDisplay, manageToolTipsDisplay } from "./TooltipService";

var started=false;
var debugMenuID;

export class StartService {
    static checkVersion()
    {
        let previousScriptVersion = getStoredValue(HHStoredVarPrefixKey + "Temp_scriptversion");
        if (previousScriptVersion != GM.info.script.version) {
            // run action on new script version
            logHHAuto(`New script version detected from ${previousScriptVersion} to ${GM.info.script.version}`);
            setStoredValue(HHStoredVarPrefixKey + "Temp_scriptversion", GM.info.script.version);

            if ('7.26.0' === GM.info.script.version) {
                // sett all mask rewards to true if any of the previous individual mask rewards where true
                let maskReward = false;
                if (getStoredValue(HHStoredVarPrefixKey + "Setting_PoAMaskRewards") === "true") maskReward = true;
                if (getStoredValue(HHStoredVarPrefixKey + "Setting_PoVMaskRewards") === "true") maskReward = true;
                if (getStoredValue(HHStoredVarPrefixKey + "Setting_PoGMaskRewards") === "true") maskReward = true;
                if (getStoredValue(HHStoredVarPrefixKey + "Setting_SeasonMaskRewards") === "true") maskReward = true;
                if (getStoredValue(HHStoredVarPrefixKey + "Setting_SeasonalEventMaskRewards") === "true") maskReward = true;
                setStoredValue(HHStoredVarPrefixKey + "Setting_AllMaskRewards", maskReward);

                // delete old individual mask rewards settings
                deleteStoredValue(HHStoredVarPrefixKey + "Setting_PoAMaskRewards");
                deleteStoredValue(HHStoredVarPrefixKey + "Setting_PoVMaskRewards");
                deleteStoredValue(HHStoredVarPrefixKey + "Setting_PoGMaskRewards");
                deleteStoredValue(HHStoredVarPrefixKey + "Setting_SeasonMaskRewards");
                deleteStoredValue(HHStoredVarPrefixKey + "Setting_SeasonalEventMaskRewards");
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
    if ((unsafeWindow as any).jQuery == undefined) {
        console.log("HHAUTO WARNING: No jQuery found.");

        try {
            const forbiddenWords = document.getElementsByTagName('body')[0].innerText === 'Forbidden';
            if (forbiddenWords) {
                const time = randomInterval(1*60, 5*60) ;
                logHHAuto('HHAUTO WARNING: "Forbidden" detected, reloading the page in '+time+' seconds');
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
        logHHAuto('???no Hero???');
        $('.hh_logo').trigger('click');
        setTimeout(hardened_start,5000);
        return;
    }
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
    if (isMainAdventure) setStoredValue(HHStoredVarPrefixKey + "Temp_MainAdventureWorldID", id_world); 
    else setStoredValue(HHStoredVarPrefixKey + "Temp_SideAdventureWorldID", id_world); 

    if (getStoredValue(HHStoredVarPrefixKey + "Setting_leagueListDisplayPowerCalc") !== "true" && getStoredValue(HHStoredVarPrefixKey + "Setting_autoLeaguesSortIndex") !== LeagueHelper.SORT_POWERCALC)
    {
        // remove big var not removed from previous version
        deleteStoredValue(HHStoredVarPrefixKey+"Temp_LeagueOpponentList");
    }

    $('.redirect.gay').hide();
    $('.redirect.comix').hide();

    $('#starter_offer').hide();
    $('#starter_offer_background').hide();

    if (getStoredValue(HHStoredVarPrefixKey+"Temp_Timers"))
    {
        setTimers(JSON.parse(getStoredValue(HHStoredVarPrefixKey+"Temp_Timers")));
    }
    // clearEventData("onlyCheckEventsHHScript");
    setDefaults();

    if (getStoredValue(HHStoredVarPrefixKey+"Setting_mousePause") === "true") {
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
        lastTrollIdAvailable = Troll.getLastTrollIdAvailable(false, Number(getStoredValue(HHStoredVarPrefixKey + "Temp_MainAdventureWorldID")));
    }
    hhAutoMenu.fillTrollSelectMenu(lastTrollIdAvailable);
    hhAutoMenu.fillLoveRaidSelectMenu();

    // Add league options
    hhAutoMenu.fillLeagueSelectMenu();
    hhAutoMenu.fillLeaguSortMenu();
    hhAutoMenu.fillLabyDifficultyMenu();

    setMenuValues();
    getMenuValues();
    manageToolTipsDisplay();

    $("#git").on("click", function(){ window.open("https://github.com/Roukys/HHauto/wiki"); });
    $("#ReportBugs").on("click", function(){ window.open("https://github.com/Roukys/HHauto/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc"); });
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
            //setStoredValue(HHStoredVarPrefixKey+"Setting_master", "false");
        });
        currentInput.checkValidity();
    });



    setStoredValue(HHStoredVarPrefixKey+"Temp_autoLoop", "true");
    if (typeof getStoredValue(HHStoredVarPrefixKey+"Temp_freshStart") == "undefined" || isNaN(Number(getStoredValue(HHStoredVarPrefixKey+"Temp_autoLoopTimeMili")))) {
        setDefaults(true);
    }

    if (getBurst())
    {
        Market.doShopping();
        if ( getStoredValue(HHStoredVarPrefixKey+"Setting_autoStatsSwitch") ==="true" )
        {
            doStatUpgrades();
        }
    }

    if (unsafeWindow.hh_nutaku && window.top)
    {
        function Alive()
        {
            if(window.top) window.top.postMessage({ImAlive:true},'*');
            if (getStoredValue(HHStoredVarPrefixKey+"Temp_autoLoop") =="true")
            {
                setTimeout(Alive,2000);
            }
        }
        Alive();
    }
    if (isJSON(getStoredValue(HHStoredVarPrefixKey+"Temp_LastPageCalled")) && JSON.parse(getStoredValue(HHStoredVarPrefixKey+"Temp_LastPageCalled")).page?.indexOf(".html") > 0 )
    {
        //console.log("testingHome : setting to : "+getPage());
        setStoredValue(HHStoredVarPrefixKey+"Temp_LastPageCalled", JSON.stringify({page:getPage(), dateTime:new Date().getTime()}));
    }
    if (isJSON(getStoredValue(HHStoredVarPrefixKey+"Temp_LastPageCalled")) && JSON.parse(getStoredValue(HHStoredVarPrefixKey+"Temp_LastPageCalled")).page === ConfigHelper.getHHScriptVars("pagesIDHome"))
    {
        //console.log("testingHome : delete");
        deleteStoredValue(HHStoredVarPrefixKey+"Temp_LastPageCalled");
    }
    getPage(true);
    setTimeout(autoLoop,1000);
    GM_registerMenuCommand(getTextForUI("translate","elementText"),manageTranslationPopUp);

};
