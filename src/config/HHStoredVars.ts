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

// ── Factory Functions ──────────────────────────────────────────────
function settingBool(key: string, defaultVal = "false", opts?: {
    kobanUsing?: boolean, onNew?: Function, events?: any
}) {
    HHStoredVars[HHStoredVarPrefixKey + key] = {
        default: defaultVal, storage: "Storage()", HHType: "Setting",
        valueType: "Boolean", getMenu: true, setMenu: true, menuType: "checked",
        kobanUsing: opts?.kobanUsing ?? false,
        ...(opts?.onNew && { newValueFunction: opts.onNew }),
        ...(opts?.events && { events: opts.events })
    };
}

function settingValue(key: string, defaultVal: string, valueType: string, opts?: {
    kobanUsing?: boolean, onNew?: Function, customMenuID?: string, isValid?: RegExp
}) {
    HHStoredVars[HHStoredVarPrefixKey + key] = {
        default: defaultVal, storage: "Storage()", HHType: "Setting",
        valueType, getMenu: true, setMenu: true, menuType: "value",
        kobanUsing: opts?.kobanUsing ?? false,
        ...(opts?.onNew && { newValueFunction: opts.onNew }),
        ...(opts?.customMenuID && { customMenuID: opts.customMenuID }),
        ...(opts?.isValid && { isValid: opts.isValid })
    };
}

function settingSelect(key: string, defaultVal: string, customMenuID: string, isValid: RegExp, onNew?: Function) {
    HHStoredVars[HHStoredVarPrefixKey + key] = {
        default: defaultVal, storage: "Storage()", HHType: "Setting",
        valueType: "Small Integer", getMenu: true, setMenu: true, menuType: "selectedIndex",
        kobanUsing: false, customMenuID, isValid,
        ...(onNew && { newValueFunction: onNew })
    };
}

function settingArray(key: string) {
    HHStoredVars[HHStoredVarPrefixKey + key] = {
        default: JSON.stringify([]), storage: "Storage()", HHType: "Setting", valueType: "Array"
    };
}

function settingCollect(key: string, collectListKey: string, timerName: string, extraLabel?: string) {
    settingBool(key, "false", {
        events: {"change": function() {
            if (this.checked) {
                if (extraLabel) {
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey + collectListKey, extraLabel);
                } else {
                    getAndStoreCollectPreferences(HHStoredVarPrefixKey + collectListKey);
                }
                clearTimer(timerName);
            }
        }}
    });
}

function tempSession(key: string, defaultVal?: string, valueType?: string) {
    HHStoredVars[HHStoredVarPrefixKey + key] = {
        ...(defaultVal !== undefined && { default: defaultVal }),
        storage: "sessionStorage", HHType: "Temp",
        ...(valueType && { valueType })
    };
}

function tempStorage(key: string, defaultVal?: string) {
    HHStoredVars[HHStoredVarPrefixKey + key] = {
        ...(defaultVal !== undefined && { default: defaultVal }),
        storage: "Storage()", HHType: "Temp"
    };
}

function tempLocal(key: string, opts?: {default?: string, isValid?: RegExp}) {
    HHStoredVars[HHStoredVarPrefixKey + key] = {
        ...(opts?.default !== undefined && { default: opts.default }),
        storage: "localStorage", HHType: "Temp",
        ...(opts?.isValid && { isValid: opts.isValid })
    };
}

// ── Settings ───────────────────────────────────────────────────────

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
settingValue("Setting_autoAff", "500000000", "Long Integer");
settingBool("Setting_autoAffW");
settingBool("Setting_autoBuyBoosters", "false", { kobanUsing: true });
settingValue("Setting_autoBuyBoostersFilter", "B1;B2;B3;B4", "List");
settingBool("Setting_autoEquipBoosters");
settingValue("Setting_autoEquipBoostersSlots", "B1;B1;B2;B4", "List");
settingBool("Setting_autoChamps", "false", { onNew: () => { clearTimer('nextChampionTime'); } });
settingBool("Setting_autoChampAlignTimer");
settingBool("Setting_autoChampsForceStart", "false", { onNew: () => { clearTimer('nextChampionTime'); } });
settingValue("Setting_autoChampsFilter", "1;2;3;4;5;6", "List", { onNew: () => { clearTimer('nextChampionTime'); } });
settingValue("Setting_autoChampsTeamLoop", "10", "Small Integer");
settingValue("Setting_autoChampsGirlThreshold", "0", "Long Integer");
settingBool("Setting_autoChampsTeamKeepSecondLine");
settingBool("Setting_autoChampsUseEne");
settingBool("Setting_autoBuildChampsTeam");
settingBool("Setting_showClubButtonInPoa", "true");
settingBool("Setting_autoClubChamp", "false", { onNew: () => { clearTimer('nextClubChampionTime'); } });
settingValue("Setting_autoClubChampMax", "999", "Small Integer");
settingBool("Setting_autoClubForceStart", "false", { onNew: () => { clearTimer('nextClubChampionTime'); } });
settingBool("Setting_autoContest", "false", { onNew: () => { clearTimer('nextContestCollectTime'); } });
settingBool("Setting_compactEndedContests");
settingValue("Setting_autoExp", "500000000", "Long Integer");
settingBool("Setting_autoExpW");
settingBool("Setting_autoFreePachinko", "false", { onNew: () => { clearTimer('nextPachinkoTime'); clearTimer('nextPachinko2Time'); clearTimer('nextPachinkoEquipTime'); } });
settingBool("Setting_autoLeagues", "false", { onNew: () => { clearTimer('nextLeaguesTime'); } });
settingBool("Setting_autoLeaguesAllowWinCurrent");
settingBool("Setting_autoLeaguesCollect");
settingBool("Setting_autoLeaguesBoostedOnly");
settingValue("Setting_autoLeaguesRunThreshold", "0", "Small Integer");
settingBool("Setting_autoLeaguesForceOneFight");
settingBool("Setting_leagueListDisplayPowerCalc", "false", { onNew: () => { deleteStoredValue(HHStoredVarPrefixKey+"Temp_LeagueOpponentList"); } });
settingSelect("Setting_autoLeaguesSelectedIndex", "0", "autoLeaguesSelector", /^[0-9]$/);
settingSelect("Setting_autoLeaguesSortIndex", "1", "autoLeaguesSortMode", /^[0-9]$/, () => { deleteStoredValue(HHStoredVarPrefixKey + "Temp_LeagueOpponentList"); });
settingValue("Setting_autoLeaguesThreshold", "0", "Small Integer");
settingValue("Setting_autoLeaguesSecurityThreshold", "40", "Small Integer");
settingBool("Setting_compactMissions");
settingBool("Setting_autoMission", "false", { onNew: () => { clearTimer('nextMissionTime'); } });
settingBool("Setting_autoMissionCollect");
settingBool("Setting_autoMissionKFirst");
settingBool("Setting_invertMissions");
settingBool("Setting_compactPowerPlace");
settingBool("Setting_autoPowerPlaces", "false", { onNew: () => { clearTimer('minPowerPlacesTime'); PlaceOfPower.cleanTempPopToStart(); } });
settingBool("Setting_autoPowerPlacesAll", "false", { onNew: () => { clearTimer('minPowerPlacesTime'); PlaceOfPower.cleanTempPopToStart(); } });
settingBool("Setting_autoPowerPlacesPrecision");
settingBool("Setting_autoPowerPlacesInverted");
settingBool("Setting_autoPowerPlacesWaitMax");
settingValue("Setting_autoPowerPlacesIndexFilter", "1;2;3", "List", { onNew: () => { clearTimer('minPowerPlacesTime'); PlaceOfPower.cleanTempPopToStart(); } });
settingBool("Setting_autoQuest");
settingBool("Setting_autoSideQuest");
settingValue("Setting_autoQuestThreshold", "0", "Small Integer");
settingBool("Setting_autoSalary", "false", { onNew: () => { clearTimer('nextSalaryTime'); } });
settingValue("Setting_autoSalaryMinSalary", "20000", "Long Integer", { onNew: () => { clearTimer('nextSalaryTime'); } });
settingBool("Setting_autoSeason", "false", { onNew: () => { clearTimer('nextSeasonTime'); } });
settingCollect("Setting_autoSeasonCollect", "Setting_autoSeasonCollectablesList", "nextSeasonCollectTime");
settingBool("Setting_autoSeasonCollectAll");
settingBool("Setting_autoSeasonIgnoreNoGirls");
settingBool("Setting_seasonDisplayPowerCalc", "true");
settingArray("Setting_autoSeasonCollectablesList");
settingBool("Setting_autoSeasonPassReds", "false", { kobanUsing: true });
settingValue("Setting_autoSeasonThreshold", "0", "Small Integer");
settingValue("Setting_autoSeasonRunThreshold", "0", "Small Integer");
settingBool("Setting_autoSeasonBoostedOnly");
settingBool("Setting_autoSeasonSkipLowMojo", "true");
settingBool("Setting_autoPentaDrill", "false", { onNew: () => { clearTimer('nextPentaDrillTime'); } });
settingCollect("Setting_autoPentaDrillCollect", "Setting_autoPentaDrillCollectablesList", "nextPentaDrillCollectTime");
settingBool("Setting_autoPentaDrillCollectAll");
settingArray("Setting_autoPentaDrillCollectablesList");
settingValue("Setting_autoPentaDrillThreshold", "0", "Small Integer");
settingValue("Setting_autoPentaDrillRunThreshold", "0", "Small Integer");
settingBool("Setting_autoPentaDrillBoostedOnly");
settingValue("Setting_autoStats", "500000000", "Long Integer");
settingBool("Setting_autoStatsSwitch");
settingBool("Setting_autoTrollBattle");
settingBool("Setting_autoTrollMythicByPassParanoia");
settingValue("Setting_autoTrollSelectedIndex", "0", "Small Integer", { customMenuID: "autoTrollSelector", isValid: /^[0-9]|1[0-5]|98|99$/ });
settingValue("Setting_autoTrollThreshold", "0", "Small Integer");
settingValue("Setting_autoTrollRunThreshold", "0", "Small Integer");
settingBool("Setting_autoChampsForceStartEventGirl");
settingBool("Setting_buyCombat", "false", { kobanUsing: true });
settingValue("Setting_buyCombTimer", "16", "Small Integer");
settingBool("Setting_buyMythicCombat", "false", { kobanUsing: true });
settingValue("Setting_buyMythicCombTimer", "16", "Small Integer");
settingCollect("Setting_autoFreeBundlesCollect", "Setting_autoFreeBundlesCollectablesList", "nextFreeBundlesCollectTime", getTextForUI("menuDailyCollectableText","elementText"));
settingArray("Setting_autoFreeBundlesCollectablesList");
settingBool("Setting_waitforContest", "true", { onNew: () => { clearTimer('contestRemainingTime'); clearTimer('nextContestTime'); } });
settingValue("Setting_safeSecondsForContest", "120", "Small Integer");
settingBool("Setting_mousePause");
settingValue("Setting_mousePauseTimeout", "5000", "Small Integer");
settingValue("Setting_collectAllTimer", "12", "Small Integer", { isValid: /^[1-9][0-9]|[1-9]$/ });
settingValue("Setting_eventTrollOrder", "1;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16;17;18;19;20", "List");
settingValue("Setting_autoBuyTrollNumber", "20", "List");
settingValue("Setting_autoBuyMythicTrollNumber", "20", "List");
settingBool("Setting_master");
settingValue("Setting_maxAff", "50000", "Long Integer");
settingValue("Setting_maxBooster", "10", "Long Integer");
settingValue("Setting_maxExp", "10000", "Long Integer");
settingValue("Setting_minShardsX10", "10", "Small Integer", { isValid: /^(\d)+$/ });
settingValue("Setting_minShardsX50", "50", "Small Integer");
settingBool("Setting_updateMarket", "true");
settingBool("Setting_paranoia", "true", { onNew: () => { clearTimer('paranoiaSwitch'); } });

// Special: no default valueType or menu
HHStoredVars[HHStoredVarPrefixKey+"Setting_paranoiaSettings"] =
    {
    default:"140-320/Sleep:28800-30400|Active:250-460|Casual:1500-2700/6:Sleep|8:Casual|10:Active|12:Casual|14:Active|18:Casual|20:Active|22:Casual|24:Sleep",
    storage:"Storage()",
    HHType:"Setting"
};

settingBool("Setting_paranoiaSpendsBefore", "true");
settingBool("Setting_plusLoveRaid", "false", { onNew: () => { clearTimer('nextLoveRaidTime'); deleteStoredValue(HHStoredVarPrefixKey + "Temp_loveRaids"); deleteStoredValue(HHStoredVarPrefixKey + "Setting_autoLoveRaidSelectedIndex"); } });
settingValue("Setting_autoLoveRaidSelectedIndex", "0", "Small Integer", { customMenuID: "loveRaidSelector", isValid: /^[0-9]|1[0-5]$/ });
settingBool("Setting_buyLoveRaidCombat", "false", { kobanUsing: true });
settingValue("Setting_autoBuyLoveRaidTrollNumber", "20", "List");
settingBool("Setting_plusEventLoveRaidSandalWood");
settingBool("Setting_plusEvent");
settingBool("Setting_plusEventMythic");
settingBool("Setting_plusEventMythicSandalWood");
settingCollect("Setting_autodpEventCollect", "Setting_autodpEventCollectablesList", "nextdpEventCollectTime");
settingArray("Setting_autodpEventCollectablesList");
settingBool("Setting_autodpEventCollectAll");
settingCollect("Setting_autoLivelySceneEventCollect", "Setting_autoLivelySceneEventCollectablesList", "nextLivelySceneEventCollectTime");
settingArray("Setting_autoLivelySceneEventCollectablesList");
settingBool("Setting_autoLivelySceneEventCollectAll");
settingBool("Setting_bossBangEvent");
settingValue("Setting_bossBangMinTeam", "5", "Small Integer");
settingBool("Setting_sultryMysteriesEventRefreshShop");
settingBool("Setting_collectEventChest");
settingBool("Setting_AllMaskRewards");
settingBool("Setting_autoSeasonalBuyFreeCard", "false", { onNew: () => { clearTimer('nextSeasonalCardCollectTime'); } });
settingBool("Setting_showCalculatePower", "true");
settingBool("Setting_showAdsBack", "true");
settingBool("Setting_showRewardsRecap", "true");
settingBool("Setting_hideOwnedGirls", "true");
settingBool("Setting_showInfo", "true");
settingBool("Setting_showInfoLeft");
settingBool("Setting_showMarketTools");
settingBool("Setting_showTooltips", "true");
settingBool("Setting_spendKobans0");
settingValue("Setting_kobanBank", "1000000", "Long Integer");
settingBool("Setting_useX10Fights", "false", { kobanUsing: true });
settingBool("Setting_useX10FightsAllowNormalEvent");
settingBool("Setting_useX50Fights", "false", { kobanUsing: true });
settingBool("Setting_useX50FightsAllowNormalEvent");

// Special: no default, no valueType, no menu, localStorage
HHStoredVars[HHStoredVarPrefixKey+"Setting_saveDefaults"] =
    {
    storage:"localStorage",
    HHType:"Setting"
};

settingBool("Setting_autoPantheon", "false", { onNew: () => { clearTimer('nextPantheonTime'); } });
settingValue("Setting_autoPantheonThreshold", "0", "Small Integer");
settingValue("Setting_autoPantheonRunThreshold", "0", "Small Integer");
settingBool("Setting_autoPantheonBoostedOnly");
settingBool("Setting_autoLabyrinth", "false", { onNew: () => { clearTimer('nextLabyrinthTime'); } });
settingBool("Setting_autoLabySweep");
settingBool("Setting_autoLabyCustomTeamBuilder");
settingBool("Setting_autoLabyHard");
settingSelect("Setting_autoLabyDifficultyIndex", "0", "autoLabyDifficulty", /^[0-9]$/, () => {});
settingCollect("Setting_autoSeasonalEventCollect", "Setting_autoSeasonalEventCollectablesList", "nextSeasonalEventCollectTime");
settingBool("Setting_autoSeasonalEventCollectAll");
settingArray("Setting_autoSeasonalEventCollectablesList");
settingCollect("Setting_autoPoVCollect", "Setting_autoPoVCollectablesList", "nextPoVCollectTime");
settingBool("Setting_autoPoVCollectAll");
settingArray("Setting_autoPoVCollectablesList");
settingCollect("Setting_autoPoGCollect", "Setting_autoPoGCollectablesList", "nextPoGCollectTime");
settingBool("Setting_autoPoGCollectAll");
settingArray("Setting_autoPoGCollectablesList");
settingCollect("Setting_autoPoACollect", "Setting_autoPoACollectablesList", "nextPoACollectTime");
settingBool("Setting_autoPoACollectAll");
settingArray("Setting_autoPoACollectablesList");
settingBool("Setting_autoDailyGoals", "false", { onNew: () => { /*clearTimer('nextLabyrinthTime');*/ } });
settingBool("Setting_compactDailyGoals");
settingCollect("Setting_autoDailyGoalsCollect", "Setting_autoDailyGoalsCollectablesList", "nextDailyGoalsCollectTime", getTextForUI("menuDailyCollectableText","elementText"));
settingArray("Setting_autoDailyGoalsCollectablesList");

// ── Temp Vars ──────────────────────────────────────────────────────

tempLocal("Temp_scriptversion", { default: "0" });
tempSession("Temp_autoLoop", "true");
tempSession("Temp_battlePowerRequired", "0");
tempSession("Temp_dailyGoalsList");
// DISABLED: tempSession("Temp_leaguesTarget", "9", "Small Integer")  // formerly active
tempSession("Temp_lastActionPerformed", "none");
tempSession("Temp_questRequirement", "none");
// DISABLED: tempSession("Temp_userLink", "none")  // formerly active
tempStorage("Temp_autoLoopTimeMili", "1000");
tempStorage("Temp_freshStart", "no");
tempSession("Temp_Logging");
tempSession("Temp_Debug", "false", "Boolean");
// DISABLED: tempSession("Temp_trollToFight")  // formerly active
tempSession("Temp_autoTrollBattleSaveQuest");
tempSession("Temp_burst");
tempSession("Temp_charLevel");
tempSession("Temp_filteredGirlsList");
tempSession("Temp_haremGirlActions");
tempSession("Temp_haremGirlMode");
tempSession("Temp_haremMoneyOnStart", "0");
tempSession("Temp_haremGirlPayLast");
tempSession("Temp_haremGirlEnd");
tempSession("Temp_haremGirlLimit");
tempSession("Temp_haremTeam");
tempSession("Temp_loveRaids");
tempSession("Temp_eventsGirlz");
tempSession("Temp_eventGirl");
tempSession("Temp_eventMythicGirl");
tempSession("Temp_autoChampsEventGirls");
tempSession("Temp_raidGirls");
tempSession("Temp_champBuildTeam");
tempSession("Temp_clubChampLimitReached", "false");
tempSession("Temp_trollWithGirls");
tempSession("Temp_fought");
tempSession("Temp_haveAff");
tempSession("Temp_haveExp");
tempSession("Temp_haveBooster");
tempSession("Temp_boosterIdMap");
tempStorage("Temp_hideBeatenOppo", "0");
tempSession("Temp_LeagueOpponentList");
// DISABLED: tempSession("Temp_LeagueTempOpponentList")  // formerly active
tempSession("Temp_paranoiaLeagueBlocked");
tempSession("Temp_paranoiaQuestBlocked");
tempSession("Temp_paranoiaSpendings");
tempSession("Temp_pinfo");
tempSession("Temp_PopTargeted");
tempSession("Temp_PopToStart");
tempSession("Temp_PopUnableToStart");
tempSession("Temp_storeContents");
tempSession("Temp_Timers");
tempSession("Temp_NextSwitch");
tempSession("Temp_Totalpops");
tempSession("Temp_currentlyAvailablePops");
tempSession("Temp_CheckSpentPoints");
tempSession("Temp_eventsList");
tempSession("Temp_bossBangTeam");
tempSession("Temp_boosterStatus");
tempSession("Temp_sandalwoodFailure", "0");
tempSession("Temp_LeagueSavedData");
tempSession("Temp_LeagueHumanLikeRun");
tempSession("Temp_TrollHumanLikeRun");
tempSession("Temp_TrollInvalid", "false");
tempLocal("Temp_MainAdventureWorldID", { default: "0" });
tempLocal("Temp_SideAdventureWorldID", { default: "0" });
tempSession("Temp_PantheonHumanLikeRun");
tempSession("Temp_SeasonHumanLikeRun");
tempSession("Temp_PentaDrillHumanLikeRun");
tempLocal("Temp_HaremSize", { isValid: /{"count":(\d)+,"count_date":(\d)+}/ });
tempSession("Temp_LastPageCalled");
tempLocal("Temp_PoAEndDate");
tempLocal("Temp_PoVEndDate");
tempLocal("Temp_PoGEndDate");
tempLocal("Temp_poaManualCollectAll", { default: "false" });
tempLocal("Temp_lseManualCollectAll", { default: "false" });
tempSession("Temp_unkownPagesList");
tempSession("Temp_trollPoints");
