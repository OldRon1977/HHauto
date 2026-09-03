// InfoService.ts
//
// Renders the floating "pInfo" overlay panel that shows the current
// automation status at a glance: which modules are active, their
// next scheduled run times, energy counts, and paranoia state.
//
// The panel is positioned differently on the home page vs. other
// pages. On hover it expands to show the full status list. Double-
// clicking it toggles the master automation switch as a quick
// shortcut.
//
// updateData() is called every loop iteration to refresh the display
// with current timer values and module states.
//
// Used by: StartService (creates the panel), AutoLoop (refreshes it)
import { ConfigHelper } from "../Helper/ConfigHelper";
import { getTextForUI } from "../Helper/LanguageHelper";
import { NumberHelper } from "../Helper/NumberHelper";
import { getPage } from "../Helper/PageHelper";
import { getStoredValue, setStoredValue } from "../Helper/StorageHelper";
import { TimeHelper } from "../Helper/TimeHelper";
import { getTimeLeft, getTimer } from "../Helper/TimerHelper";
import { Contest } from "../Module/Contest";
import { DailyGoals } from "../Module/DailyGoals";
import { LoveRaidManager } from "../Module/Events/LoveRaidManager";
import { Season } from "../Module/Events/Season";
import { Labyrinth } from "../Module/Labyrinth";
import { LeagueHelper } from "../Module/League";
import { Pantheon } from "../Module/Pantheon";
import { PentaDrill } from "../Module/PentaDrill";
import { Troll } from "../Module/Troll";
import { logHHAuto } from "../Utils/LogUtils";
import { pInfoRow } from "../Utils/PInfoRow";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK, TK } from "../config/StorageKeys";
import { getAutoDisabledBlocks, reactivateBlock } from "./BlockDisabledState";

export function createPInfo():JQuery<HTMLElement> {
    const pInfo = $('<div id="pInfo" ></div>');

    if(pInfo != null) {
        pInfo.on("dblclick", function() {
            const masterSwitch = <HTMLInputElement>document.getElementById("master");
            if (masterSwitch.checked === true) {
                setStoredValue(HHStoredVarPrefixKey+SK.master, "false");
                masterSwitch.checked = false;
            } else {
                setStoredValue(HHStoredVarPrefixKey+SK.master, "true");
                masterSwitch.checked = true;
            }
        });
        // Reactivate an auto-disabled block when the user clicks its [reactivate]
        // affordance in the pInfo ERROR section. Delegated so it survives
        // the innerHTML refresh in updateData; stopPropagation keeps the panel
        // dblclick (master toggle) unaffected.
        pInfo.on("click", "[data-reactivate-block]", function(e) {
            e.stopPropagation();
            const id = $(this).attr("data-reactivate-block");
            if (id) reactivateBlock(id);
        });
    }
    
    if(getPage()==ConfigHelper.getHHScriptVars("pagesIDHome"))
    {
        GM_addStyle('#pInfo:hover {max-height : none} #pInfo { max-height : 460px} @media only screen and (max-width: 1025px) {#pInfo { ;top:17% }}');
    }
    else
    {
        GM_addStyle(''
                    +'#pInfo:hover {'
                    +'   padding-top : 22px;'
                    +'   height : auto;'
                    +'   left : auto;'
                    +'}'
                    +'#pInfo {'
                    +'   left : auto;'
                    +'   top : 8%;'
                    +'   z-index : 1000;'
                    +'   height : 22px;'
                    +'   padding-top : unset;'
                    +'}'
                    + '@media only screen and (max-width: 1025px) {'
                    + '   #pInfo { top : 14%;}'
                    + '   #pInfo.left { top : 14%;}'
                    +'}');
    }
    return pInfo;
}

export function updateData() {
    document.querySelectorAll("div#sMenu input[pattern]").forEach(currentInput =>
                                                                  {
        (<HTMLInputElement>currentInput).checkValidity();
    });
    const pInfo = document.getElementById('pInfo');
    if(pInfo == null) {
        logHHAuto('ERROR pInfo element not found');
        return;
    }
    if (getStoredValue(HHStoredVarPrefixKey+SK.showInfo) =="true") // && busy==false // && getPage()==ConfigHelper.getHHScriptVars("pagesIDHome")
    {
        let contest = '';
        if (!TimeHelper.canCollectCompetitionActive()) contest = " : Wait for contest";
        var Tegzd='';
        Tegzd+=(getStoredValue(HHStoredVarPrefixKey+SK.master) ==="true"?"<span style='color:LimeGreen'>HH auto ++ ON":"<span style='color:red'>HH auto ++ OFF")+'</span>';
        //Tegzd+=(getStoredValue(HHStoredVarPrefixKey+SK.master) ==="true"?"<span style='color:LimeGreen'>"+getTextForUI("master","elementText")+" : ON":"<span style='color:red'>"+getTextForUI("master","elementText")+" : OFF")+'</span>';
        //Tegzd+=getTextForUI("master","elementText")+' : '+(getStoredValue(HHStoredVarPrefixKey+SK.master) ==="true"?"<span style='color:LimeGreen'>ON":"<span style='color:red'>OFF")+'</span>';
        //Tegzd+=(getStoredValue(HHStoredVarPrefixKey+TK.autoLoop) ==="true"?"<span style='color:LimeGreen;float:right'>Loop ON":"<span style='color:red;float:right'>Loop OFF")+'</span>';
        Tegzd += '<ul>';
        // Watchdog ERROR markers: auto-disabled blocks. Shown red with an
        // <ERROR> prefix, the failure reason in the tooltip plus a request for a
        // logfile, and a clickable [reactivate] affordance.
        const disabledBlocks = getAutoDisabledBlocks();
        for (const blockId of Object.keys(disabledBlocks)) {
            const label = blockId.replace(/^handle/, '');
            const tip = disabledBlocks[blockId].reason + ' -- please share a debug logfile to report this.';
            Tegzd += pInfoRow('&lt;ERROR&gt; ' + label
                + ' <span data-reactivate-block="' + blockId + '" style="cursor:pointer;text-decoration:underline">[reactivate]</span>',
                '', { style: 'color:red', title: tip });
        }
        if (getStoredValue(HHStoredVarPrefixKey+SK.paranoia) === "true")
        {
            Tegzd += pInfoRow(String(getStoredValue(HHStoredVarPrefixKey+TK.pinfo)), getTimeLeft('paranoiaSwitch'));
        }
        if (getStoredValue(HHStoredVarPrefixKey + SK.waitforContest) === "true") {
            Tegzd += Contest.getPinfo();
        }
        if (ConfigHelper.getHHScriptVars('isEnabledTrollBattle',false) && getStoredValue(HHStoredVarPrefixKey+SK.autoTrollBattle) == "true")
        {
            Tegzd += Troll.getPinfo(contest);
        }
        if (ConfigHelper.getHHScriptVars("isEnabledSalary",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoSalary) =="true")
        {
            Tegzd += pInfoRow(getTextForUI("pinfoSalary","elementText"), getTimeLeft('nextSalaryTime'));
        }
        if (ConfigHelper.getHHScriptVars('isEnabledSeason',false) && getStoredValue(HHStoredVarPrefixKey+SK.autoSeason) =="true")
        {
            Tegzd += Season.getPinfo();
        }
        if (ConfigHelper.getHHScriptVars('isEnabledSeason',false) && getStoredValue(HHStoredVarPrefixKey+SK.autoSeasonCollectAll) === "true" && getTimer('nextSeasonCollectAllTime') !== -1)
        {
            Tegzd += pInfoRow(getTextForUI("pinfoSeasonCollect","elementText"), getTimeLeft('nextSeasonCollectAllTime'));
        }
        if (ConfigHelper.getHHScriptVars('isEnabledPentaDrill', false) && getStoredValue(HHStoredVarPrefixKey +SK.autoPentaDrill) =="true")
        {
            Tegzd += PentaDrill.getPinfo();
        }
        if (ConfigHelper.getHHScriptVars('isEnabledPentaDrill', false) && getStoredValue(HHStoredVarPrefixKey+SK.autoPentaDrillCollectAll) === "true" && getTimer('nextPentaDrillCollectAllTime') !== -1)
        {
            Tegzd += pInfoRow(getTextForUI("pinfoPentaDrillCollect","elementText"), getTimeLeft('nextPentaDrillCollectAllTime'));
        }
        if (ConfigHelper.getHHScriptVars('isEnabledLeagues',false) && getStoredValue(HHStoredVarPrefixKey+SK.autoLeagues) =="true")
        {
            Tegzd += LeagueHelper.getPinfo();
        }
        if (ConfigHelper.getHHScriptVars("isEnabledChamps",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoChamps) =="true")
        {
            Tegzd += pInfoRow(getTextForUI("autoChampsTitle","elementText"), getTimeLeft('nextChampionTime'));
        }
        if (ConfigHelper.getHHScriptVars("isEnabledClubChamp",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoClubChamp) =="true")
        {
            Tegzd += pInfoRow(getTextForUI("pinfoClubChamp","elementText"), getTimeLeft('nextClubChampionTime'));
        }
        if (ConfigHelper.getHHScriptVars('isEnabledPantheon', false) && (getStoredValue(HHStoredVarPrefixKey + SK.autoPantheon) == "true" || DailyGoals.isPantheonDailyGoal() ))
        {
            Tegzd += Pantheon.getPinfo();
        }
        if (Labyrinth.isEnabled() && getStoredValue(HHStoredVarPrefixKey + SK.autoLabyrinth) =="true")
        {
            Tegzd += Labyrinth.getPinfo();
        }
        if (LoveRaidManager.isActivated())
        {
            Tegzd += LoveRaidManager.getPinfo();
        }
        if (ConfigHelper.getHHScriptVars("isEnabledShop",false) && getStoredValue(HHStoredVarPrefixKey+SK.updateMarket) =="true")
        {
            Tegzd += pInfoRow(getTextForUI("autoBuy","elementText"), getTimeLeft('nextShopTime'));
        }
        if (getStoredValue(HHStoredVarPrefixKey+SK.autoEquipBoosters) =="true")
        {
            Tegzd += pInfoRow(getTextForUI("pinfoEquipBoosters","elementText"), getTimeLeft('nextAutoEquipBoosterTime'));
        }
        if (ConfigHelper.getHHScriptVars("isEnabledMission",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoMission) =="true")
        {
            Tegzd += pInfoRow(getTextForUI("pinfoMission","elementText"), getTimeLeft('nextMissionTime'));
        }
        if (ConfigHelper.getHHScriptVars("isEnabledDailyGoals",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoDailyGoalsCollect) === "true" && getTimer('nextDailyGoalsCollectTime') !== -1)
        {
            Tegzd += pInfoRow(getTextForUI("pinfoDailyGoals","elementText"), getTimeLeft('nextDailyGoalsCollectTime'));
        }
        if (ConfigHelper.getHHScriptVars("isEnabledFreeBundles",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoFreeBundlesCollect) === "true" && getTimer('nextFreeBundlesCollectTime') !== -1)
        {
            Tegzd += pInfoRow(getTextForUI("pinfoFreeBundles","elementText"), getTimeLeft('nextFreeBundlesCollectTime'));
        }
        if (ConfigHelper.getHHScriptVars("isEnabledContest",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoContest) =="true")
        {
            Tegzd += pInfoRow(getTextForUI("pinfoContestCollect", "elementText"), getTimeLeft('nextContestCollectTime'));
        }
        if (ConfigHelper.getHHScriptVars("isEnabledPowerPlaces",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoPowerPlaces) =="true")
        {
            Tegzd += pInfoRow(getTextForUI("powerPlacesTitle","elementText"), getTimeLeft('minPowerPlacesTime'));
        }
        if ( ConfigHelper.getHHScriptVars("isEnabledPachinko",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoFreePachinko) =="true")
        {
            if (getTimer('nextPachinkoTime') !== -1)
            {
                Tegzd += pInfoRow(getTextForUI("pinfoFreePachinko","elementText"), getTimeLeft('nextPachinkoTime'));
            }
            if (getTimer('nextPachinko2Time') !== -1)
            {
                Tegzd += pInfoRow(getTextForUI("autoMythicPachinko","elementText"), getTimeLeft('nextPachinko2Time'));
            }
            if (getTimer('nextPachinkoEquipTime') !== -1)
            {
                Tegzd += pInfoRow(getTextForUI("autoEquipmentPachinko","elementText"), getTimeLeft('nextPachinkoEquipTime'));
            }
        }
        if (getTimer('eventMythicNextWave') !== -1)
        {
            Tegzd += pInfoRow(getTextForUI("mythicGirlNext","elementText"), getTimeLeft('eventMythicNextWave'));
        }
        if (getTimer('eventSultryMysteryShopRefresh') !== -1)
        {
            Tegzd += pInfoRow(getTextForUI("sultryMysteriesEventRefreshShopNext","elementText"), getTimeLeft('eventSultryMysteryShopRefresh'));
        }
        if (getTimer('eventSultryMysteryAutoOpen') !== -1)
        {
            Tegzd += pInfoRow(getTextForUI("sultryMysteriesAutoOpenNext","elementText"), getTimeLeft('eventSultryMysteryAutoOpen'));
        }
        if (ConfigHelper.getHHScriptVars("isEnabledBossBangEvent",false) && getStoredValue(HHStoredVarPrefixKey+SK.bossBangEvent) === "true" && getTimer('nextBossBangTime') !== -1)
        {
            Tegzd += pInfoRow(getTextForUI("pinfoBossBang","elementText"), getTimeLeft('nextBossBangTime'));
        }
        if (ConfigHelper.getHHScriptVars("isEnabledSeasonalEvent",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoSeasonalEventCollectAll) === "true" && getTimer('nextSeasonalEventCollectAllTime') !== -1)
        {
            Tegzd += pInfoRow(getTextForUI("pinfoSeasonalEvent","elementText"), getTimeLeft('nextSeasonalEventCollectAllTime'));
        }
        if (ConfigHelper.getHHScriptVars("isEnabledPoV",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoPoVCollectAll) === "true" && getTimer('nextPoVCollectAllTime') !== -1)
        {
            Tegzd += pInfoRow(getTextForUI("pinfoPoVCollect","elementText"), getTimeLeft('nextPoVCollectAllTime'));
        }
        if (ConfigHelper.getHHScriptVars("isEnabledPoG",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoPoGCollectAll) === "true" && getTimer('nextPoGCollectAllTime') !== -1)
        {
            Tegzd += pInfoRow(getTextForUI("pinfoPoGCollect","elementText"), getTimeLeft('nextPoGCollectAllTime'));
        }
        if (getStoredValue(HHStoredVarPrefixKey+TK.haveAff))
        {
            Tegzd += pInfoRow(getTextForUI("pinfoAffOwned","elementText"), NumberHelper.add1000sSeparator(getStoredValue(HHStoredVarPrefixKey+TK.haveAff)));
        }
        if (getStoredValue(HHStoredVarPrefixKey+TK.haveExp))
        {
            Tegzd += pInfoRow(getTextForUI("pinfoExpOwned","elementText"), NumberHelper.add1000sSeparator(getStoredValue(HHStoredVarPrefixKey+TK.haveExp)));
        }
        Tegzd += '</ul>';

        pInfo.style.display='block';
        if (getStoredValue(HHStoredVarPrefixKey+SK.showInfoLeft) === 'true' && getPage() === ConfigHelper.getHHScriptVars("pagesIDHome")) {
            pInfo.className='left';
        }
        pInfo.innerHTML = Tegzd;
    }
    else
    {
        pInfo.style.display='none';
    }
}