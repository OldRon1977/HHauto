import {
    clearTimer,
    deleteStoredValue,
    getAndStoreCollectPreferences,
    getTextForUI
} from '../Helper/index';
import { PlaceOfPower } from '../Module/index';

export const HHStoredVars = {};
//Settings Vars
export const HHStoredVarPrefixKey: string = "HHAuto_"; // default HHAuto_
//Do not move, has to be first one
HHStoredVars[HHStoredVarPrefixKey+"Setting_settPerTab"] =
    {
    default:"false",
    storage:"localStorage",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
// Rest of settings vars
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoAff"] =
    {
    default:"500000000",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Long Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoAffW"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoBuyBoosters"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:true
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoBuyBoostersFilter"] =
    {
    default:"B1;B2;B3;B4",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"List",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoChamps"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    newValueFunction:function()
    {
        clearTimer('nextChampionTime');
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoChampAlignTimer"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoChampsForceStart"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    newValueFunction:function()
    {
        clearTimer('nextChampionTime');
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoChampsFilter"] =
    {
    default:"1;2;3;4;5;6",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"List",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false,
    newValueFunction:function()
    {
        clearTimer('nextChampionTime');
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoChampsTeamLoop"] =
    {
    default:"10",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoChampsGirlThreshold"] =
    {
    default:"0",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Long Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoChampsTeamKeepSecondLine"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoChampsUseEne"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoBuildChampsTeam"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_showClubButtonInPoa"] =
    {
    default:"true",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoClubChamp"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    newValueFunction:function()
    {
        clearTimer('nextClubChampionTime');
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoClubChampMax"] =
    {
    default:"999",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoClubForceStart"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    newValueFunction:function()
    {
        clearTimer('nextClubChampionTime');
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoContest"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing: false,
    newValueFunction: function () {
        clearTimer('nextContestCollectTime');
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_compactEndedContests"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoExp"] =
    {
    default:"500000000",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Long Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoExpW"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoFreePachinko"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing: false,
    newValueFunction: function () {
        clearTimer('nextPachinkoTime');
        clearTimer('nextPachinko2Time');
        clearTimer('nextPachinkoEquipTime');
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoLeagues"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    newValueFunction:function()
    {
        clearTimer('nextLeaguesTime');
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoLeaguesAllowWinCurrent"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoLeaguesCollect"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoLeaguesBoostedOnly"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoLeaguesRunThreshold"] =
    {
    default:"0",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoLeaguesForceOneFight"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_leagueListDisplayPowerCalc"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    newValueFunction:function()
    {
        deleteStoredValue(HHStoredVarPrefixKey+"Temp_LeagueOpponentList");
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoLeaguesSelectedIndex"] =
    {
    default:"0",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"selectedIndex",
    kobanUsing:false,
    customMenuID:"autoLeaguesSelector",
    isValid:/^[0-9]$/
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoLeaguesSortIndex"] =
    {
    default:"1",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"selectedIndex",
    kobanUsing:false,
    customMenuID:"autoLeaguesSortMode",
    isValid:/^[0-9]$/,
    newValueFunction: function () {
        deleteStoredValue(HHStoredVarPrefixKey + "Temp_LeagueOpponentList");
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoLeaguesThreshold"] =
    {
    default:"0",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoLeaguesSecurityThreshold"] =
    {
    default:"40",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_compactMissions"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoMission"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    newValueFunction: function () {
        clearTimer('nextMissionTime');
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoMissionCollect"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoMissionKFirst"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey + "Setting_invertMissions"] =
{
    default: "false",
    storage: "Storage()",
    HHType: "Setting",
    valueType: "Boolean",
    getMenu: true,
    setMenu: true,
    menuType: "checked",
    kobanUsing: false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_compactPowerPlace"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoPowerPlaces"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    newValueFunction: function () {
        clearTimer('minPowerPlacesTime');
        PlaceOfPower.cleanTempPopToStart();
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoPowerPlacesAll"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    newValueFunction:function()
    {
        clearTimer('minPowerPlacesTime');
        PlaceOfPower.cleanTempPopToStart();
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoPowerPlacesPrecision"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoPowerPlacesInverted"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoPowerPlacesWaitMax"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoPowerPlacesIndexFilter"] =
    {
    default:"1;2;3",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"List",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false,
    newValueFunction:function()
    {
        clearTimer('minPowerPlacesTime');
        PlaceOfPower.cleanTempPopToStart();
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoQuest"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoSideQuest"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoQuestThreshold"] =
    {
    default:"0",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoSalary"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    newValueFunction:function()
    {
        clearTimer('nextSalaryTime');
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoSalaryMinSalary"] =
    {
    default:"20000",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Long Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false,
    newValueFunction:function()
    {
        clearTimer('nextSalaryTime');
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoSeason"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    newValueFunction:function()
    {
        clearTimer('nextSeasonTime');
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoSeasonCollect"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    events:{"change":function()
            {
                if (this.checked)
                {
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey+"Setting_autoSeasonCollectablesList");
                    clearTimer('nextSeasonCollectTime');
                }
            }
           }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoSeasonCollectAll"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey +"Setting_autoSeasonIgnoreNoGirls"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey + "Setting_seasonDisplayPowerCalc"] =
{
    default: "true",
    storage: "Storage()",
    HHType: "Setting",
    valueType: "Boolean",
    getMenu: true,
    setMenu: true,
    menuType: "checked",
    kobanUsing: false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoSeasonCollectablesList"] =
    {
    default:JSON.stringify([]),
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Array"
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoSeasonPassReds"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:true
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoSeasonThreshold"] =
    {
    default:"0",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoSeasonRunThreshold"] =
    {
    default:"0",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoSeasonBoostedOnly"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoSeasonSkipLowMojo"] =
    {
    default:"true",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey + "Setting_autoPentaDrill"] =
{
    default: "false",
    storage: "Storage()",
    HHType: "Setting",
    valueType: "Boolean",
    getMenu: true,
    setMenu: true,
    menuType: "checked",
    kobanUsing: false,
    newValueFunction: function () {
        clearTimer('nextPentaDrillTime');
    }
};
HHStoredVars[HHStoredVarPrefixKey + "Setting_autoPentaDrillCollect"] =
{
    default: "false",
    storage: "Storage()",
    HHType: "Setting",
    valueType: "Boolean",
    getMenu: true,
    setMenu: true,
    menuType: "checked",
    kobanUsing: false,
    events: {
        "change": function () {
            if (this.checked) {
                getAndStoreCollectPreferences(HHStoredVarPrefixKey + "Setting_autoPentaDrillCollectablesList");
                clearTimer('nextPentaDrillCollectTime');
            }
        }
    }
};
HHStoredVars[HHStoredVarPrefixKey + "Setting_autoPentaDrillCollectAll"] =
{
    default: "false",
    storage: "Storage()",
    HHType: "Setting",
    valueType: "Boolean",
    getMenu: true,
    setMenu: true,
    menuType: "checked",
    kobanUsing: false
};
HHStoredVars[HHStoredVarPrefixKey + "Setting_autoPentaDrillCollectablesList"] =
{
    default: JSON.stringify([]),
    storage: "Storage()",
    HHType: "Setting",
    valueType: "Array"
};
HHStoredVars[HHStoredVarPrefixKey + "Setting_autoPentaDrillThreshold"] =
{
    default: "0",
    storage: "Storage()",
    HHType: "Setting",
    valueType: "Small Integer",
    getMenu: true,
    setMenu: true,
    menuType: "value",
    kobanUsing: false
};
HHStoredVars[HHStoredVarPrefixKey + "Setting_autoPentaDrillRunThreshold"] =
{
    default: "0",
    storage: "Storage()",
    HHType: "Setting",
    valueType: "Small Integer",
    getMenu: true,
    setMenu: true,
    menuType: "value",
    kobanUsing: false
};
HHStoredVars[HHStoredVarPrefixKey + "Setting_autoPentaDrillBoostedOnly"] =
{
    default: "false",
    storage: "Storage()",
    HHType: "Setting",
    valueType: "Boolean",
    getMenu: true,
    setMenu: true,
    menuType: "checked",
    kobanUsing: false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoStats"] =
    {
    default:"500000000",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Long Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoStatsSwitch"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoTrollBattle"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoTrollMythicByPassParanoia"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoTrollSelectedIndex"] =
    {
    default:"0",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false,
    customMenuID:"autoTrollSelector",
    isValid:/^[0-9]|1[0-5]|98|99$/
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoTrollThreshold"] =
    {
    default:"0",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoTrollRunThreshold"] =
    {
    default:"0",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoChampsForceStartEventGirl"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_buyCombat"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:true
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_buyCombTimer"] =
    {
    default:"16",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_buyMythicCombat"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:true
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_buyMythicCombTimer"] =
    {
    default:"16",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoFreeBundlesCollect"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    events:{"change":function()
            {
                if (this.checked)
                {
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey+"Setting_autoFreeBundlesCollectablesList", getTextForUI("menuDailyCollectableText","elementText"));
                    clearTimer('nextFreeBundlesCollectTime');
                }
            }
           }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoFreeBundlesCollectablesList"] =
    {
    default:JSON.stringify([]),
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Array"
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_waitforContest"] =
    {
    default:"true",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing: false,
    newValueFunction: function () {
        clearTimer('contestRemainingTime');
        clearTimer('nextContestTime');
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_safeSecondsForContest"] =
{
    default:"120",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value"
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_mousePause"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_mousePauseTimeout"] =
    {
    default:"5000",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value"
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_collectAllTimer"] =
    {
    default:"12",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    isValid:/^[1-9][0-9]|[1-9]$/
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_eventTrollOrder"] =
    {
    default:"1;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16;17;18;19;20",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"List",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoBuyTrollNumber"] =
    {
    default:"20",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"List",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoBuyMythicTrollNumber"] =
    {
    default:"20",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"List",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_master"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_maxAff"] =
    {
    default:"50000",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Long Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_maxBooster"] =
    {
    default:"10",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Long Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_maxExp"] =
    {
    default:"10000",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Long Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_minShardsX10"] =
    {
    default:"10",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false,
    isValid:/^(\d)+$/
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_minShardsX50"] =
    {
    default:"50",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_updateMarket"] =
    {
    default:"true",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_paranoia"] =
    {
    default:"true",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing: false,
    newValueFunction: function () {
        clearTimer('paranoiaSwitch');
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_paranoiaSettings"] =
    {
    default:"140-320/Sleep:28800-30400|Active:250-460|Casual:1500-2700/6:Sleep|8:Casual|10:Active|12:Casual|14:Active|18:Casual|20:Active|22:Casual|24:Sleep",
    storage:"Storage()",
    HHType:"Setting"
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_paranoiaSpendsBefore"] =
    {
    default:"true",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey +"Setting_plusLoveRaid"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing: false,
    newValueFunction: function () {
        clearTimer('nextLoveRaidTime');
        deleteStoredValue(HHStoredVarPrefixKey + "Temp_loveRaids");
        deleteStoredValue(HHStoredVarPrefixKey + "Setting_autoLoveRaidSelectedIndex");
    }
};
HHStoredVars[HHStoredVarPrefixKey + "Setting_autoLoveRaidSelectedIndex"] =
{
    default: "0",
    storage: "Storage()",
    HHType: "Setting",
    valueType: "Small Integer",
    getMenu: true,
    setMenu: true,
    menuType: "value",
    kobanUsing: false,
    customMenuID: "loveRaidSelector",
    isValid: /^[0-9]|1[0-5]$/
};
HHStoredVars[HHStoredVarPrefixKey + "Setting_buyLoveRaidCombat"] =
{
    default: "false",
    storage: "Storage()",
    HHType: "Setting",
    valueType: "Boolean",
    getMenu: true,
    setMenu: true,
    menuType: "checked",
    kobanUsing: true
};
HHStoredVars[HHStoredVarPrefixKey + "Setting_autoBuyLoveRaidTrollNumber"] =
{
    default: "20",
    storage: "Storage()",
    HHType: "Setting",
    valueType: "List",
    getMenu: true,
    setMenu: true,
    menuType: "value",
    kobanUsing: false
};
HHStoredVars[HHStoredVarPrefixKey + "Setting_plusEventLoveRaidSandalWood"] =
{
    default: "false",
    storage: "Storage()",
    HHType: "Setting",
    valueType: "Boolean",
    getMenu: true,
    setMenu: true,
    menuType: "checked",
    kobanUsing: false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_plusEvent"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_plusEventMythic"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_plusEventMythicSandalWood"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autodpEventCollect"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    events:{"change":function()
            {
                if (this.checked)
                {
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey+"Setting_autodpEventCollectablesList");
                    clearTimer('nextdpEventCollectTime');
                }
            }
           }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autodpEventCollectablesList"] =
    {
    default:JSON.stringify([]),
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Array"
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autodpEventCollectAll"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoLivelySceneEventCollect"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    events:{"change":function()
            {
                if (this.checked)
                {
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey+"Setting_autoLivelySceneEventCollectablesList");
                    clearTimer('nextLivelySceneEventCollectTime');
                }
            }
           }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoLivelySceneEventCollectablesList"] =
    {
    default:JSON.stringify([]),
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Array"
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoLivelySceneEventCollectAll"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_bossBangEvent"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_bossBangMinTeam"] =
    {
    default:"5",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_sultryMysteriesEventRefreshShop"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_collectEventChest"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey +"Setting_AllMaskRewards"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey +"Setting_autoSeasonalBuyFreeCard"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    newValueFunction: function () {
        clearTimer('nextSeasonalCardCollectTime');
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_showCalculatePower"] =
    {
    default:"true",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_showAdsBack"] =
    {
    default:"true",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_showRewardsRecap"] =
    {
    default:"true",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_hideOwnedGirls"] =
    {
    default:"true",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_showInfo"] =
    {
    default:"true",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_showInfoLeft"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_showHaremAvatarMissingGirls"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_showHaremTools"] =
    {
    default:"true",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey +"Setting_showHaremSkillsButtons"] =
    {
    default:"true",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_showMarketTools"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_showTooltips"] =
    {
    default:"true",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_spendKobans0"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_kobanBank"] =
    {
    default:"1000000",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Long Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_useX10Fights"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:true
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_useX10FightsAllowNormalEvent"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_useX50Fights"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:true
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_useX50FightsAllowNormalEvent"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_saveDefaults"] =
    {
    storage:"localStorage",
    HHType:"Setting"
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoPantheon"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    newValueFunction: function () {
        clearTimer('nextPantheonTime');
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoPantheonThreshold"] =
    {
    default:"0",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoPantheonRunThreshold"] =
    {
    default:"0",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoPantheonBoostedOnly"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoLabyrinth"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing: false,
    newValueFunction: function () {
        clearTimer('nextLabyrinthTime');
    }
};
HHStoredVars[HHStoredVarPrefixKey + "Setting_autoLabySweep"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing: false
};
HHStoredVars[HHStoredVarPrefixKey + "Setting_autoLabyCustomTeamBuilder"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing: false
};
HHStoredVars[HHStoredVarPrefixKey + "Setting_autoLabyHard"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing: false
};
HHStoredVars[HHStoredVarPrefixKey + "Setting_autoLabyDifficultyIndex"] =
{
    default: "0",
    storage: "Storage()",
    HHType: "Setting",
    valueType: "Small Integer",
    getMenu: true,
    setMenu: true,
    menuType: "selectedIndex",
    kobanUsing: false,
    customMenuID: "autoLabyDifficulty",
    isValid: /^[0-9]$/,
    newValueFunction: function () {
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoSeasonalEventCollect"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    events:{"change":function()
            {
                if (this.checked)
                {
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey+"Setting_autoSeasonalEventCollectablesList");
                    clearTimer('nextSeasonalEventCollectTime');
                }
            }
           }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoSeasonalEventCollectAll"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoSeasonalEventCollectablesList"] =
    {
    default:JSON.stringify([]),
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Array"
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoPoVCollect"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    events:{"change":function()
            {
                if (this.checked)
                {
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey+"Setting_autoPoVCollectablesList");
                    clearTimer('nextPoVCollectTime');
                }
            }
           }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoPoVCollectAll"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoPoVCollectablesList"] =
    {
    default:JSON.stringify([]),
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Array"
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoPoGCollect"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    events:{"change":function()
            {
                if (this.checked)
                {
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey+"Setting_autoPoGCollectablesList");
                    clearTimer('nextPoGCollectTime');
                }
            }
           }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoPoGCollectAll"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoPoGCollectablesList"] =
    {
    default:JSON.stringify([]),
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Array"
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoPoACollect"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    events:{"change":function()
            {
                if (this.checked)
                {
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey+"Setting_autoPoACollectablesList");
                    clearTimer('nextPoACollectTime');
                }
            }
           }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoPoACollectAll"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoPoACollectablesList"] =
    {
    default:JSON.stringify([]),
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Array"
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoDailyGoals"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    newValueFunction: function () {
        //clearTimer('nextLabyrinthTime');
    }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_compactDailyGoals"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoDailyGoalsCollect"] =
    {
    default:"false",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Boolean",
    getMenu:true,
    setMenu:true,
    menuType:"checked",
    kobanUsing:false,
    events:{"change":function()
            {
                if (this.checked)
                {
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey+"Setting_autoDailyGoalsCollectablesList", getTextForUI("menuDailyCollectableText","elementText"));
                    clearTimer('nextDailyGoalsCollectTime');
                }
            }
           }
};
HHStoredVars[HHStoredVarPrefixKey+"Setting_autoDailyGoalsCollectablesList"] =
    {
    default:JSON.stringify([]),
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Array"
};
// Temp vars
HHStoredVars[HHStoredVarPrefixKey+"Temp_scriptversion"] =
{
    default: "0",
    storage: "localStorage",
    HHType: "Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_autoLoop"] =
    {
    default:"true",
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_battlePowerRequired"] =
    {
    default:"0",
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + "Temp_dailyGoalsList"] =
{
    storage: "sessionStorage",
    HHType: "Temp"
};
/*HHStoredVars[HHStoredVarPrefixKey+"Temp_leaguesTarget"] =
    {
    default:"9",
    storage:"sessionStorage",
    HHType:"Temp",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:false,
    menuType:"value",
    kobanUsing:false,
    customMenuID:"autoLeaguesSelector"
};*/
HHStoredVars[HHStoredVarPrefixKey+"Temp_lastActionPerformed"] =
    {
    default:"none",
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_questRequirement"] =
    {
    default:"none",
    storage:"sessionStorage",
    HHType:"Temp"
};
/*HHStoredVars[HHStoredVarPrefixKey+"Temp_userLink"] =
    {
    default:"none",
    storage:"sessionStorage",
    HHType:"Temp"
};*/
HHStoredVars[HHStoredVarPrefixKey+"Temp_autoLoopTimeMili"] =
    {
    default:"1000",
    storage:"Storage()",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_freshStart"] =
    {
    default:"no",
    storage:"Storage()",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_Logging"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_Debug"] =
    {
    default: "false",
    storage: "sessionStorage",
    valueType: "Boolean",
    HHType:"Temp"
};
/*HHStoredVars[HHStoredVarPrefixKey+"Temp_trollToFight"] =
    {
    storage:"sessionStorage",
    HHType:"Temp",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:false,
    menuType:"value",
    kobanUsing:false,
    customMenuID:"autoTrollSelector"
};*/
HHStoredVars[HHStoredVarPrefixKey+"Temp_autoTrollBattleSaveQuest"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_burst"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_charLevel"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_filteredGirlsList"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_haremGirlActions"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_haremGirlMode"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_haremMoneyOnStart"] =
{
    default: "0",
    storage: "sessionStorage",
    HHType: "Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_haremGirlPayLast"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_haremGirlEnd"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_haremGirlLimit"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey +"Temp_haremTeam"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey +"Temp_haremTeamScrolls"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey +"Temp_haremTeamSettings"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey +"Temp_loveRaids"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_eventsGirlz"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_eventGirl"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_eventMythicGirl"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_autoChampsEventGirls"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
    //isValid:/^\[({"girl_id":"(\d)+","champ_id":"(\d)+","girl_shards":"(\d)+","girl_name":"([^"])+","event_id":"([^"])+"},?)+\]$/
};
HHStoredVars[HHStoredVarPrefixKey + "Temp_raidGirls"] =
{
    storage: "sessionStorage",
    HHType: "Temp"
};
HHStoredVars[HHStoredVarPrefixKey + "Temp_champBuildTeam"] =
{
    storage: "sessionStorage",
    HHType: "Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_clubChampLimitReached"] =
{
    default: "false",
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_trollWithGirls"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_fought"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_haveAff"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_haveExp"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_haveBooster"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_hideBeatenOppo"] =
{
    default:"0",
    storage:"Storage()",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_LeagueOpponentList"] =
    {
    storage:"sessionStorage",
    HHType:"Temp",
    //isValid:/^{"expirationDate":\d+,"opponentsList":{("\d+":{((("(win|loss|avgTurns)":\d*[.,]?\d+)|("scoreClass":"(minus|plus|close)")|("points":{("\d{1,3}":\d*[.,]?\d+,?)+})),?)+},?)+}}$/
};
/*
HHStoredVars[HHStoredVarPrefixKey+"Temp_LeagueTempOpponentList"] =
    {
    storage:"sessionStorage",
    HHType:"Temp",
    isValid:/^{"expirationDate":\d+,"opponentsList":{("\d+":{((("(win|loss|avgTurns|expectedValue)":\d*[.,]?\d+)|("scoreClass":"(minus|plus|close)")|("points":{("\d{1,3}":\d*[.,]?\d+,?)+})),?)+},?)+}}$/
};*/
HHStoredVars[HHStoredVarPrefixKey+"Temp_paranoiaLeagueBlocked"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_paranoiaQuestBlocked"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_paranoiaSpendings"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_pinfo"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_PopTargeted"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_PopToStart"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_PopUnableToStart"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_storeContents"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_Timers"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_NextSwitch"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_Totalpops"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_currentlyAvailablePops"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_CheckSpentPoints"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_eventsList"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_bossBangTeam"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_boosterStatus"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_sandalwoodFailure"] =
{
    default:"0",
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_LeagueSavedData"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_LeagueHumanLikeRun"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_TrollHumanLikeRun"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey +"Temp_TrollInvalid"] =
    {
    default:"false",
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey +"Temp_MainAdventureWorldID"] =
    {
    default:"0",
    storage:"localStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey +"Temp_SideAdventureWorldID"] =
    {
    default:"0",
    storage:"localStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_PantheonHumanLikeRun"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_SeasonHumanLikeRun"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey +"Temp_PentaDrillHumanLikeRun"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_HaremSize"] =
    {
    storage:"localStorage",
    HHType:"Temp",
    isValid:/{"count":(\d)+,"count_date":(\d)+}/
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_LastPageCalled"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_PoAEndDate"] =
    {
    storage:"localStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_PoVEndDate"] =
    {
    storage:"localStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_PoGEndDate"] =
    {
    storage:"localStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + "Temp_poaManualCollectAll"] =
{
    default: "false",
    storage: "localStorage",
    HHType: "Temp"
};
HHStoredVars[HHStoredVarPrefixKey + "Temp_lseManualCollectAll"] =
{
    default: "false",
    storage: "localStorage",
    HHType: "Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_unkownPagesList"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey+"Temp_trollPoints"] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
