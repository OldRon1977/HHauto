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

import {
    NumberHelper,
    ConfigHelper,
    getPage,
    getStoredValue,
    getTextForUI,
    getTimeLeft ,
    getTimer,
    setStoredValue,
    TimeHelper
} from '../Helper/index';
import { 
    Contest, 
    DailyGoals, 
    Labyrinth, 
    LeagueHelper, 
    LoveRaidManager, 
    Pantheon, 
    PentaDrill,
    Season, 
    Troll 
} from '../Module/index';
import { logHHAuto } from '../Utils/index';
import { HHStoredVarPrefixKey, SK, TK } from '../config/index';

export function createPInfo():JQuery<HTMLElement> {
    const pInfo = $('<div id="pInfo" ></div>');

    if(pInfo != null) {
        pInfo.on("dblclick", function() {
            let masterSwitch = <HTMLInputElement>document.getElementById("master");
            if (masterSwitch.checked === true) {
                setStoredValue(HHStoredVarPrefixKey+SK.master, "false");
                masterSwitch.checked = false;
                //console.log("Master switch off");
            } else {
                setStoredValue(HHStoredVarPrefixKey+SK.master, "true");
                masterSwitch.checked = true;
                //console.log("Master switch on");
            }
        });
    }
    
    if(getPage()==ConfigHelper.getHHScriptVars("pagesIDHome"))
    {
        GM_addStyle('#pInfo:hover {max-height : none} #pInfo { max-height : 220px} @media only screen and (max-width: 1025px) {#pInfo { ;top:17% }}');
    }
    else
    {
        GM_addStyle(''
                    +'#pInfo:hover {'
                    +'   padding-top : 22px;'
                    +'   height : auto;'
                    +'   left : 43%;'
                    +'}'
                    +'#pInfo {'
                    +'   left : 84%;'
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
    //logHHAuto("updating UI");
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
        if (getStoredValue(HHStoredVarPrefixKey+SK.paranoia) === "true")
        {
            Tegzd += '<li>'+getStoredValue(HHStoredVarPrefixKey+TK.pinfo)+': '+getTimeLeft('paranoiaSwitch')+'</li>';
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
            Tegzd += '<li>'+getTextForUI("autoSalary","elementText")+' : '+getTimeLeft('nextSalaryTime')+'</li>';
        }
        if (ConfigHelper.getHHScriptVars('isEnabledSeason',false) && getStoredValue(HHStoredVarPrefixKey+SK.autoSeason) =="true")
        {
            Tegzd += Season.getPinfo();
        }
        if (ConfigHelper.getHHScriptVars('isEnabledPentaDrill', false) && getStoredValue(HHStoredVarPrefixKey +SK.autoPentaDrill) =="true")
        {
            Tegzd += PentaDrill.getPinfo();
        }
        /*
        if (ConfigHelper.getHHScriptVars('isEnabledPoV',false) && getStoredValue(HHStoredVarPrefixKey+SK.autoPoVCollect) =="true")
        {
            Tegzd += '<li>Collect POV : '+getTimeLeft('nextPoVCollectTime')+'</li>';
        }
        if (ConfigHelper.getHHScriptVars('isEnabledPoG',false) && getStoredValue(HHStoredVarPrefixKey+SK.autoPoGCollect) =="true")
        {
            Tegzd += '<li>Collect POG : '+getTimeLeft('nextPoGCollectTime')+'</li>';
        }*/
        if (ConfigHelper.getHHScriptVars('isEnabledLeagues',false) && getStoredValue(HHStoredVarPrefixKey+SK.autoLeagues) =="true")
        {
            Tegzd += LeagueHelper.getPinfo();
        }
        if (ConfigHelper.getHHScriptVars("isEnabledChamps",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoChamps) =="true")
        {
            Tegzd += '<li>'+getTextForUI("autoChampsTitle","elementText")+' : '+getTimeLeft('nextChampionTime')+'</li>';
        }
        if (ConfigHelper.getHHScriptVars("isEnabledClubChamp",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoClubChamp) =="true")
        {
            Tegzd += '<li>'+getTextForUI("autoClubChamp","elementText")+' : '+getTimeLeft('nextClubChampionTime')+'</li>';
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
            Tegzd += '<li>'+getTextForUI("autoBuy","elementText")+' : '+getTimeLeft('nextShopTime')+'</li>';
        }
        if (getStoredValue(HHStoredVarPrefixKey+SK.autoEquipBoosters) =="true")
        {
            Tegzd += '<li>'+getTextForUI("autoEquipBoosters","elementText")+' : '+getTimeLeft('nextAutoEquipBoosterTime')+'</li>';
        }
        if (ConfigHelper.getHHScriptVars("isEnabledMission",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoMission) =="true")
        {
            Tegzd += '<li>'+getTextForUI("autoMission","elementText")+' : '+getTimeLeft('nextMissionTime')+'</li>';
        }
        if (ConfigHelper.getHHScriptVars("isEnabledContest",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoContest) =="true")
        {
            Tegzd += '<li>' + getTextForUI("autoContest", "elementText") + ' : ' + getTimeLeft('nextContestCollectTime')+'</li>';
        }
        if (ConfigHelper.getHHScriptVars("isEnabledPowerPlaces",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoPowerPlaces) =="true")
        {
            Tegzd += '<li>'+getTextForUI("powerPlacesTitle","elementText")+' : '+getTimeLeft('minPowerPlacesTime')+'</li>';
        }
        if ( ConfigHelper.getHHScriptVars("isEnabledPachinko",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoFreePachinko) =="true")
        {
            if (getTimer('nextPachinkoTime') !== -1)
            {
                Tegzd += '<li>'+getTextForUI("autoFreePachinko","elementText")+' : '+getTimeLeft('nextPachinkoTime')+'</li>';
            }
            if (getTimer('nextPachinko2Time') !== -1)
            {
                Tegzd += '<li>'+getTextForUI("autoMythicPachinko","elementText")+' : '+getTimeLeft('nextPachinko2Time')+'</li>';
            }
            if (getTimer('nextPachinkoEquipTime') !== -1)
            {
                Tegzd += '<li>'+getTextForUI("autoEquipmentPachinko","elementText")+' : '+getTimeLeft('nextPachinkoEquipTime')+'</li>';
            }
        }
        if (getTimer('eventMythicNextWave') !== -1)
        {
            Tegzd += '<li>'+getTextForUI("mythicGirlNext","elementText")+' : '+getTimeLeft('eventMythicNextWave')+'</li>';
        }
        if (getTimer('eventSultryMysteryShopRefresh') !== -1)
        {
            Tegzd += '<li>'+getTextForUI("sultryMysteriesEventRefreshShopNext","elementText")+' : '+getTimeLeft('eventSultryMysteryShopRefresh')+'</li>';
        }
        if (getStoredValue(HHStoredVarPrefixKey+TK.haveAff))
        {
            Tegzd += '<li>'+getTextForUI("autoAffW","elementText")+' : '+NumberHelper.add1000sSeparator(getStoredValue(HHStoredVarPrefixKey+TK.haveAff))+'</li>';
        }
        if (getStoredValue(HHStoredVarPrefixKey+TK.haveExp))
        {
            Tegzd += '<li>'+getTextForUI("autoExpW","elementText")+' : '+NumberHelper.add1000sSeparator(getStoredValue(HHStoredVarPrefixKey+TK.haveExp))+'</li>';
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