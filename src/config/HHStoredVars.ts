// Registry of all stored variables (settings and temporary state) for HHAuto.
// Defines each variable's storage type (setting vs. temp), default value,
// validation regex, UI label, and type. Used by the settings menu and storage layer.

import {
    clearTimer,
    deleteStoredValue,
    getAndStoreCollectPreferences,
    getTextForUI
} from '../Helper/index';
import { PlaceOfPower } from '../Module/index';
import { SK, TK } from './StorageKeys';

export const HHStoredVars = {};
//Settings Vars
export const HHStoredVarPrefixKey: string = "HHAuto_"; // default HHAuto_
//Do not move, has to be first one
HHStoredVars[HHStoredVarPrefixKey + SK.settPerTab] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoAff] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoAffW] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoBuyBoosters] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoBuyBoostersFilter] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoEquipBoosters] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoEquipBoostersSlots] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoChamps] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoChampAlignTimer] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoChampsForceStart] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoChampsFilter] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoChampsTeamLoop] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoChampsGirlThreshold] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoChampsTeamKeepSecondLine] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoChampsUseEne] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoBuildChampsTeam] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.showClubButtonInPoa] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoClubChamp] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoClubChampMax] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoClubForceStart] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoContest] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.compactEndedContests] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoExp] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoExpW] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoFreePachinko] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoLeagues] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoLeaguesAllowWinCurrent] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoLeaguesCollect] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoLeaguesBoostedOnly] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoLeaguesRunThreshold] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoLeaguesForceOneFight] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.leagueListDisplayPowerCalc] =
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
        deleteStoredValue(HHStoredVarPrefixKey + TK.LeagueOpponentList);
    }
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoLeaguesSelectedIndex] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoLeaguesSortIndex] =
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
        deleteStoredValue(HHStoredVarPrefixKey + TK.LeagueOpponentList);
    }
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoLeaguesThreshold] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoLeaguesSecurityThreshold] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.compactMissions] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoMission] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoMissionCollect] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoMissionKFirst] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.invertMissions] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.compactPowerPlace] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoPowerPlaces] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoPowerPlacesAll] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoPowerPlacesPrecision] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoPowerPlacesInverted] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoPowerPlacesWaitMax] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoPowerPlacesIndexFilter] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoQuest] =
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
        deleteStoredValue(HHStoredVarPrefixKey + TK.questRequirement);
    }
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoSideQuest] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoQuestThreshold] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoSalary] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoSalaryMinSalary] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoSeason] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoSeasonCollect] =
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
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey + SK.autoSeasonCollectablesList);
                    clearTimer('nextSeasonCollectTime');
                }
            }
           }
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoSeasonCollectAll] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoSeasonIgnoreNoGirls] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.seasonDisplayPowerCalc] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoSeasonCollectablesList] =
    {
    default:JSON.stringify([]),
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Array"
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoSeasonPassReds] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoSeasonThreshold] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoSeasonRunThreshold] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoSeasonMaxTier] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoSeasonMaxTierNb] =
{
    default: "63",
    storage: "Storage()",
    HHType: "Setting",
    valueType: "Small Integer",
    getMenu: true,
    setMenu: true,
    menuType: "value"
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoSeasonBoostedOnly] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoSeasonSkipLowMojo] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoPentaDrill] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoPentaDrillCollect] =
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
                getAndStoreCollectPreferences(HHStoredVarPrefixKey + SK.autoPentaDrillCollectablesList);
                clearTimer('nextPentaDrillCollectTime');
            }
        }
    }
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoPentaDrillCollectAll] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoPentaDrillCollectablesList] =
{
    default: JSON.stringify([]),
    storage: "Storage()",
    HHType: "Setting",
    valueType: "Array"
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoPentaDrillThreshold] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoPentaDrillRunThreshold] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoPentaDrillBoostedOnly] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoStats] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoStatsSwitch] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoTrollBattle] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoTrollMythicByPassParanoia] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoTrollSelectedIndex] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoTrollThreshold] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoTrollRunThreshold] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoChampsForceStartEventGirl] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.buyCombat] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.buyCombTimer] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.buyMythicCombat] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.buyMythicCombTimer] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoFreeBundlesCollect] =
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
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey + SK.autoFreeBundlesCollectablesList, getTextForUI("menuDailyCollectableText","elementText"));
                    clearTimer('nextFreeBundlesCollectTime');
                }
            }
           }
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoFreeBundlesCollectablesList] =
    {
    default:JSON.stringify([]),
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Array"
};
HHStoredVars[HHStoredVarPrefixKey + SK.waitforContest] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.safeSecondsForContest] =
{
    default:"120",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value"
};
HHStoredVars[HHStoredVarPrefixKey + SK.mousePause] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.mousePauseTimeout] =
    {
    default:"5000",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    getMenu:true,
    setMenu:true,
    menuType:"value"
};
HHStoredVars[HHStoredVarPrefixKey + SK.collectAllTimer] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.eventTrollOrder] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoBuyTrollNumber] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoBuyMythicTrollNumber] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.master] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.maxAff] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.maxBooster] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.maxExp] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.minShardsX10] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.minShardsX50] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.sandalwoodMinShardsThreshold] =
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
HHStoredVars[HHStoredVarPrefixKey + TK.sandalwoodMaxUsages] =
    {
    default:"11",
    storage:"sessionStorage",
    HHType:"Temp",
    valueType:"Small Integer",
    getMenu:false,
    setMenu:false,
    menuType:"value",
    kobanUsing:false
};
HHStoredVars[HHStoredVarPrefixKey + SK.updateMarket] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.paranoia] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.paranoiaSettings] =
    {
    default:"140-320/Sleep:28800-30400|Active:250-460|Casual:1500-2700/6:Sleep|8:Casual|10:Active|12:Casual|14:Active|18:Casual|20:Active|22:Casual|24:Sleep",
    storage:"Storage()",
    HHType:"Setting"
};
HHStoredVars[HHStoredVarPrefixKey + SK.paranoiaSpendsBefore] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.plusGirlSkins] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoTrollLoveRaidByPassThreshold] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.plusLoveRaidMythic] =
    {
    default:"0",
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Small Integer",
    customMenuID:"raidStarsSelector",
    getMenu:true,
    setMenu:true,
    menuType:"value",
    kobanUsing:false,
    isValid: /^[0356]$/
};
HHStoredVars[HHStoredVarPrefixKey + SK.plusLoveRaid] =
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
        deleteStoredValue(HHStoredVarPrefixKey + TK.loveRaids);
        deleteStoredValue(HHStoredVarPrefixKey + SK.autoLoveRaidSelectedIndex);
    }
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoLoveRaidSelectedIndex] =
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
    isValid: /^(0|first|\d+_\d+)$/
};
HHStoredVars[HHStoredVarPrefixKey + SK.buyLoveRaidCombat] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoBuyLoveRaidTrollNumber] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.plusEventLoveRaidSandalWood] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.plusEvent] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.plusEventMythic] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.plusEventSandalWood] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.plusEventMythicSandalWood] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autodpEventCollect] =
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
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey + SK.autodpEventCollectablesList);
                    clearTimer('nextdpEventCollectTime');
                }
            }
           }
};
HHStoredVars[HHStoredVarPrefixKey + SK.autodpEventCollectablesList] =
    {
    default:JSON.stringify([]),
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Array"
};
HHStoredVars[HHStoredVarPrefixKey + SK.autodpEventCollectAll] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoLivelySceneEventCollect] =
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
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey + SK.autoLivelySceneEventCollectablesList);
                    clearTimer('nextLivelySceneEventCollectTime');
                }
            }
           }
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoLivelySceneEventCollectablesList] =
    {
    default:JSON.stringify([]),
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Array"
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoLivelySceneEventCollectAll] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.bossBangEvent] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.bossBangMinTeam] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.sultryMysteriesEventRefreshShop] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.collectEventChest] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.AllMaskRewards] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoSeasonalBuyFreeCard] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.showCalculatePower] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.showAdsBack] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.showRewardsRecap] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.hideOwnedGirls] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.showInfo] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.showInfoLeft] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.showHaremAvatarMissingGirls] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.showHaremTools] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.showHaremSkillsButtons] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.showMarketTools] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.showTooltips] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.spendKobans0] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.kobanBank] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.useX10Fights] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.useX10FightsAllowNormalEvent] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.useX50Fights] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.useX50FightsAllowNormalEvent] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.saveDefaults] =
    {
    storage:"localStorage",
    HHType:"Setting"
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoPantheon] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoPantheonThreshold] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoPantheonRunThreshold] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoPantheonBoostedOnly] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoLabyrinth] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoLabySweep] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoLabyCustomTeamBuilder] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoLabyHard] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoLabyDifficultyIndex] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoSeasonalEventCollect] =
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
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey + SK.autoSeasonalEventCollectablesList);
                    clearTimer('nextSeasonalEventCollectTime');
                }
            }
           }
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoSeasonalEventCollectAll] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoSeasonalEventCollectablesList] =
    {
    default:JSON.stringify([]),
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Array"
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoPoVCollect] =
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
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey + SK.autoPoVCollectablesList);
                    clearTimer('nextPoVCollectTime');
                }
            }
           }
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoPoVCollectAll] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoPoVCollectablesList] =
    {
    default:JSON.stringify([]),
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Array"
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoPoGCollect] =
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
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey + SK.autoPoGCollectablesList);
                    clearTimer('nextPoGCollectTime');
                }
            }
           }
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoPoGCollectAll] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoPoGCollectablesList] =
    {
    default:JSON.stringify([]),
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Array"
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoPoACollect] =
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
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey + SK.autoPoACollectablesList);
                    clearTimer('nextPoACollectTime');
                }
            }
           }
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoPoACollectAll] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoPoACollectablesList] =
    {
    default:JSON.stringify([]),
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Array"
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoDailyGoals] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.compactDailyGoals] =
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
HHStoredVars[HHStoredVarPrefixKey + SK.autoDailyGoalsCollect] =
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
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey + SK.autoDailyGoalsCollectablesList, getTextForUI("menuDailyCollectableText","elementText"));
                    clearTimer('nextDailyGoalsCollectTime');
                }
            }
           }
};
HHStoredVars[HHStoredVarPrefixKey + SK.autoDailyGoalsCollectablesList] =
    {
    default:JSON.stringify([]),
    storage:"Storage()",
    HHType:"Setting",
    valueType:"Array"
};
// Temp vars
HHStoredVars[HHStoredVarPrefixKey + TK.scriptversion] =
{
    default: "0",
    storage: "localStorage",
    HHType: "Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.autoLoop] =
    {
    default:"true",
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.battlePowerRequired] =
    {
    default:"0",
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.dailyGoalsList] =
{
    storage: "sessionStorage",
    HHType: "Temp"
};
/*HHStoredVars[HHStoredVarPrefixKey + TK.leaguesTarget] =
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
HHStoredVars[HHStoredVarPrefixKey + TK.lastActionPerformed] =
    {
    default:"none",
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.questRequirement] =
    {
    default:"none",
    storage:"sessionStorage",
    HHType:"Temp"
};
/*HHStoredVars[HHStoredVarPrefixKey + TK.userLink] =
    {
    default:"none",
    storage:"sessionStorage",
    HHType:"Temp"
};*/
HHStoredVars[HHStoredVarPrefixKey + TK.autoLoopTimeMili] =
    {
    default:"1000",
    storage:"Storage()",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.freshStart] =
    {
    default:"no",
    storage:"Storage()",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.Logging] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.Debug] =
    {
    default: "false",
    storage: "sessionStorage",
    valueType: "Boolean",
    HHType:"Temp"
};
/*HHStoredVars[HHStoredVarPrefixKey + TK.trollToFight] =
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
HHStoredVars[HHStoredVarPrefixKey + TK.autoTrollBattleSaveQuest] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.burst] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.charLevel] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.filteredGirlsList] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.haremGirlActions] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.haremGirlMode] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.haremMoneyOnStart] =
{
    default: "0",
    storage: "sessionStorage",
    HHType: "Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.haremGirlPayLast] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.haremGirlEnd] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.haremGirlLimit] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.haremTeam] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.haremTeamScrolls] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.haremTeamSettings] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.loveRaids] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.eventsGirlz] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.eventGirl] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.eventMythicGirl] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.autoChampsEventGirls] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
    //isValid:/^\[({"girl_id":"(\d)+","champ_id":"(\d)+","girl_shards":"(\d)+","girl_name":"([^"])+","event_id":"([^"])+"},?)+\]$/
};
HHStoredVars[HHStoredVarPrefixKey + TK.raidGirls] =
{
    storage: "sessionStorage",
    HHType: "Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.champBuildTeam] =
{
    storage: "sessionStorage",
    HHType: "Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.clubChampLimitReached] =
{
    default: "false",
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.trollWithGirls] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.fought] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.haveAff] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.haveExp] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.haveBooster] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.hideBeatenOppo] =
{
    default:"0",
    storage:"Storage()",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.LeagueOpponentList] =
    {
    storage:"sessionStorage",
    HHType:"Temp",
    //isValid:/^{"expirationDate":\d+,"opponentsList":{("\d+":{((("(win|loss|avgTurns)":\d*[.,]?\d+)|("scoreClass":"(minus|plus|close)")|("points":{("\d{1,3}":\d*[.,]?\d+,?)+})),?)+},?)+}}$/
};
/*
HHStoredVars[HHStoredVarPrefixKey + TK.LeagueTempOpponentList] =
    {
    storage:"sessionStorage",
    HHType:"Temp",
    isValid:/^{"expirationDate":\d+,"opponentsList":{("\d+":{((("(win|loss|avgTurns|expectedValue)":\d*[.,]?\d+)|("scoreClass":"(minus|plus|close)")|("points":{("\d{1,3}":\d*[.,]?\d+,?)+})),?)+},?)+}}$/
};*/
HHStoredVars[HHStoredVarPrefixKey + TK.paranoiaLeagueBlocked] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.paranoiaQuestBlocked] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.paranoiaSpendings] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.pinfo] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.PopTargeted] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.PopToStart] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.PopUnableToStart] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.storeContents] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.Timers] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.NextSwitch] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.Totalpops] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.currentlyAvailablePops] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.CheckSpentPoints] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.eventsList] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.bossBangTeam] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.boosterStatus] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.boosterIdMap] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.sandalwoodFailure] =
{
    default:"0",
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.LeagueSavedData] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.LeagueHumanLikeRun] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.TrollHumanLikeRun] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.TrollInvalid] =
    {
    default:"false",
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.MainAdventureWorldID] =
    {
    default:"0",
    storage:"localStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.SideAdventureWorldID] =
    {
    default:"0",
    storage:"localStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.PantheonHumanLikeRun] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.SeasonHumanLikeRun] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.PentaDrillHumanLikeRun] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.HaremSize] =
    {
    storage:"localStorage",
    HHType:"Temp",
    isValid:/{"count":(\d)+,"count_date":(\d)+}/
};
HHStoredVars[HHStoredVarPrefixKey + TK.LastPageCalled] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.PoAEndDate] =
    {
    storage:"localStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.PoVEndDate] =
    {
    storage:"localStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.PoGEndDate] =
    {
    storage:"localStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.poaManualCollectAll] =
{
    default: "false",
    storage: "localStorage",
    HHType: "Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.lseManualCollectAll] =
{
    default: "false",
    storage: "localStorage",
    HHType: "Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.unkownPagesList] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.trollPoints] =
    {
    storage:"sessionStorage",
    HHType:"Temp"
};
// Survey
HHStoredVars[HHStoredVarPrefixKey + TK.surveyShown] =
    {
    default: "0",
    storage: "localStorage",
    HHType: "Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.surveyDismissCount] =
    {
    default: "0",
    storage: "localStorage",
    HHType: "Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.surveyLastHash] =
    {
    storage: "localStorage",
    HHType: "Temp"
};
// Feature Popup (What's New)
HHStoredVars[HHStoredVarPrefixKey + TK.featurePopupShown] =
    {
    default: "0",
    storage: "localStorage",
    HHType: "Temp"
};
HHStoredVars[HHStoredVarPrefixKey + TK.featurePopupDismissCount] =
    {
    default: "0",
    storage: "localStorage",
    HHType: "Temp"
};
