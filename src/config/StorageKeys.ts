/**
 * Centralized storage key constants.
 * Use these instead of raw strings like HHStoredVarPrefixKey+"Setting_autoTrollBattle"
 * to get autocomplete, refactoring safety, and typo prevention.
 *
 * Usage:
 *   import { SK } from '../config/StorageKeys';
 *   getStoredValue(HHStoredVarPrefixKey + SK.autoTrollBattle)
 */

// ── Setting_ keys (user settings) ─────────────────────────────────
export const SK = {
    // Master switch
    master: "Setting_master",
    settPerTab: "Setting_settPerTab",
    spendKobans0: "Setting_spendKobans0",

    // Troll
    autoTrollBattle: "Setting_autoTrollBattle",
    autoTrollThreshold: "Setting_autoTrollThreshold",
    autoTrollRunThreshold: "Setting_autoTrollRunThreshold",
    autoTrollSelectedIndex: "Setting_autoTrollSelectedIndex",
    autoTrollMythicByPassParanoia: "Setting_autoTrollMythicByPassParanoia",
    autoTrollMythicByPassThreshold: "Setting_autoTrollMythicByPassThreshold",
    eventTrollOrder: "Setting_eventTrollOrder",
    useX10Fights: "Setting_useX10Fights",
    useX10FightsAllowNormalEvent: "Setting_useX10FightsAllowNormalEvent",
    useX50Fights: "Setting_useX50Fights",
    useX50FightsAllowNormalEvent: "Setting_useX50FightsAllowNormalEvent",
    minShardsX10: "Setting_minShardsX10",
    minShardsX50: "Setting_minShardsX50",
    sandalwoodMinShardsThreshold: "Setting_sandalwoodMinShardsThreshold",
    kobanBank: "Setting_kobanBank",
    buyCombat: "Setting_buyCombat",
    buyCombTimer: "Setting_buyCombTimer",
    buyMythicCombat: "Setting_buyMythicCombat",
    buyMythicCombTimer: "Setting_buyMythicCombTimer",
    buyLoveRaidCombat: "Setting_buyLoveRaidCombat",
    autoBuyTrollNumber: "Setting_autoBuyTrollNumber",
    autoBuyMythicTrollNumber: "Setting_autoBuyMythicTrollNumber",
    autoBuyLoveRaidTrollNumber: "Setting_autoBuyLoveRaidTrollNumber",

    // Champion
    autoChamps: "Setting_autoChamps",
    autoChampsFilter: "Setting_autoChampsFilter",
    autoChampsForceStart: "Setting_autoChampsForceStart",
    autoChampsForceStartEventGirl: "Setting_autoChampsForceStartEventGirl",
    autoChampsGirlThreshold: "Setting_autoChampsGirlThreshold",
    autoChampsTeamLoop: "Setting_autoChampsTeamLoop",
    autoChampsTeamKeepSecondLine: "Setting_autoChampsTeamKeepSecondLine",
    autoChampsUseEne: "Setting_autoChampsUseEne",
    autoChampAlignTimer: "Setting_autoChampAlignTimer",
    autoBuildChampsTeam: "Setting_autoBuildChampsTeam",

    // Club Champion
    autoClubChamp: "Setting_autoClubChamp",
    autoClubChampMax: "Setting_autoClubChampMax",
    autoClubForceStart: "Setting_autoClubForceStart",

    // League
    autoLeagues: "Setting_autoLeagues",
    autoLeaguesCollect: "Setting_autoLeaguesCollect",
    autoLeaguesThreshold: "Setting_autoLeaguesThreshold",
    autoLeaguesSecurityThreshold: "Setting_autoLeaguesSecurityThreshold",
    autoLeaguesRunThreshold: "Setting_autoLeaguesRunThreshold",
    autoLeaguesBoostedOnly: "Setting_autoLeaguesBoostedOnly",
    autoLeaguesForceOneFight: "Setting_autoLeaguesForceOneFight",
    autoLeaguesSelectedIndex: "Setting_autoLeaguesSelectedIndex",
    autoLeaguesSortIndex: "Setting_autoLeaguesSortIndex",
    autoLeaguesAllowWinCurrent: "Setting_autoLeaguesAllowWinCurrent",
    leagueListDisplayPowerCalc: "Setting_leagueListDisplayPowerCalc",

    // Season
    autoSeason: "Setting_autoSeason",
    autoSeasonThreshold: "Setting_autoSeasonThreshold",
    autoSeasonRunThreshold: "Setting_autoSeasonRunThreshold",
    autoSeasonBoostedOnly: "Setting_autoSeasonBoostedOnly",
    autoSeasonCollect: "Setting_autoSeasonCollect",
    autoSeasonCollectAll: "Setting_autoSeasonCollectAll",
    autoSeasonCollectablesList: "Setting_autoSeasonCollectablesList",
    autoSeasonIgnoreNoGirls: "Setting_autoSeasonIgnoreNoGirls",
    autoSeasonPassReds: "Setting_autoSeasonPassReds",
    autoSeasonSkipLowMojo: "Setting_autoSeasonSkipLowMojo",
    seasonDisplayPowerCalc: "Setting_seasonDisplayPowerCalc",
    autoSeasonMaxTier: "Setting_autoSeasonMaxTier",
    autoSeasonMaxTierNb: "Setting_autoSeasonMaxTierNb",

    // Pantheon
    autoPantheon: "Setting_autoPantheon",
    autoPantheonThreshold: "Setting_autoPantheonThreshold",
    autoPantheonRunThreshold: "Setting_autoPantheonRunThreshold",
    autoPantheonBoostedOnly: "Setting_autoPantheonBoostedOnly",

    // PentaDrill
    autoPentaDrill: "Setting_autoPentaDrill",
    autoPentaDrillThreshold: "Setting_autoPentaDrillThreshold",
    autoPentaDrillRunThreshold: "Setting_autoPentaDrillRunThreshold",
    autoPentaDrillBoostedOnly: "Setting_autoPentaDrillBoostedOnly",
    autoPentaDrillCollect: "Setting_autoPentaDrillCollect",
    autoPentaDrillCollectAll: "Setting_autoPentaDrillCollectAll",
    autoPentaDrillCollectablesList: "Setting_autoPentaDrillCollectablesList",

    // Quest
    autoQuest: "Setting_autoQuest",
    autoQuestThreshold: "Setting_autoQuestThreshold",
    autoSideQuest: "Setting_autoSideQuest",

    // Mission
    autoMission: "Setting_autoMission",
    autoMissionCollect: "Setting_autoMissionCollect",
    autoMissionKFirst: "Setting_autoMissionKFirst",

    // Labyrinth
    autoLabyrinth: "Setting_autoLabyrinth",
    autoLabyHard: "Setting_autoLabyHard",
    autoLabySweep: "Setting_autoLabySweep",
    autoLabyDifficultyIndex: "Setting_autoLabyDifficultyIndex",
    autoLabyCustomTeamBuilder: "Setting_autoLabyCustomTeamBuilder",

    // Place of Power
    autoPowerPlaces: "Setting_autoPowerPlaces",
    autoPowerPlacesAll: "Setting_autoPowerPlacesAll",
    autoPowerPlacesIndexFilter: "Setting_autoPowerPlacesIndexFilter",
    autoPowerPlacesInverted: "Setting_autoPowerPlacesInverted",
    autoPowerPlacesPrecision: "Setting_autoPowerPlacesPrecision",
    autoPowerPlacesWaitMax: "Setting_autoPowerPlacesWaitMax",

    // Shop / Market
    autoAff: "Setting_autoAff",
    autoAffW: "Setting_autoAffW",
    autoExp: "Setting_autoExp",
    autoExpW: "Setting_autoExpW",
    maxAff: "Setting_maxAff",
    maxExp: "Setting_maxExp",
    maxBooster: "Setting_maxBooster",
    autoBuyBoosters: "Setting_autoBuyBoosters",
    autoBuyBoostersFilter: "Setting_autoBuyBoostersFilter",
    autoEquipBoosters: "Setting_autoEquipBoosters",
    autoEquipBoostersSlots: "Setting_autoEquipBoostersSlots",
    updateMarket: "Setting_updateMarket",
    showMarketTools: "Setting_showMarketTools",

    // Harem / Salary
    autoSalary: "Setting_autoSalary",
    autoSalaryMinSalary: "Setting_autoSalaryMinSalary",
    autoStats: "Setting_autoStats",
    autoStatsSwitch: "Setting_autoStatsSwitch",
    hideOwnedGirls: "Setting_hideOwnedGirls",
    showHaremAvatarMissingGirls: "Setting_showHaremAvatarMissingGirls",
    showHaremTools: "Setting_showHaremTools",
    showHaremSkillsButtons: "Setting_showHaremSkillsButtons",

    // Pachinko
    autoFreePachinko: "Setting_autoFreePachinko",

    // Daily Goals
    autoDailyGoals: "Setting_autoDailyGoals",
    autoDailyGoalsCollect: "Setting_autoDailyGoalsCollect",
    autoDailyGoalsCollectablesList: "Setting_autoDailyGoalsCollectablesList",

    // Contest
    autoContest: "Setting_autoContest",
    waitforContest: "Setting_waitforContest",
    safeSecondsForContest: "Setting_safeSecondsForContest",

    // Paranoia
    paranoia: "Setting_paranoia",
    paranoiaSettings: "Setting_paranoiaSettings",
    paranoiaSpendsBefore: "Setting_paranoiaSpendsBefore",

    // Girl Skins (applies to Events and Raids)
    plusGirlSkins: "Setting_plusGirlSkins",

    // Boosters / Events
    plusEvent: "Setting_plusEvent",
    plusEventMythic: "Setting_plusEventMythic",
    plusEventSandalWood: "Setting_plusEventSandalWood",
    plusEventMythicSandalWood: "Setting_plusEventMythicSandalWood",
    plusLoveRaid: "Setting_plusLoveRaid",
    autoTrollLoveRaidByPassThreshold: "Setting_autoTrollLoveRaidByPassThreshold",
    plusEventLoveRaidSandalWood: "Setting_plusEventLoveRaidSandalWood",
    bossBangEvent: "Setting_bossBangEvent",
    bossBangMinTeam: "Setting_bossBangMinTeam",
    collectEventChest: "Setting_collectEventChest",

    // Seasonal Event
    autoSeasonalBuyFreeCard: "Setting_autoSeasonalBuyFreeCard",
    autoSeasonalEventCollect: "Setting_autoSeasonalEventCollect",
    autoSeasonalEventCollectAll: "Setting_autoSeasonalEventCollectAll",
    autoSeasonalEventCollectablesList: "Setting_autoSeasonalEventCollectablesList",

    // Double Penetration Event
    autodpEventCollect: "Setting_autodpEventCollect",
    autodpEventCollectAll: "Setting_autodpEventCollectAll",
    autodpEventCollectablesList: "Setting_autodpEventCollectablesList",

    // Lively Scene Event
    autoLivelySceneEventCollect: "Setting_autoLivelySceneEventCollect",
    autoLivelySceneEventCollectAll: "Setting_autoLivelySceneEventCollectAll",
    autoLivelySceneEventCollectablesList: "Setting_autoLivelySceneEventCollectablesList",

    // Path Events
    autoPoACollect: "Setting_autoPoACollect",
    autoPoACollectAll: "Setting_autoPoACollectAll",
    autoPoACollectablesList: "Setting_autoPoACollectablesList",
    autoPoGCollect: "Setting_autoPoGCollect",
    autoPoGCollectAll: "Setting_autoPoGCollectAll",
    autoPoGCollectablesList: "Setting_autoPoGCollectablesList",
    autoPoVCollect: "Setting_autoPoVCollect",
    autoPoVCollectAll: "Setting_autoPoVCollectAll",
    autoPoVCollectablesList: "Setting_autoPoVCollectablesList",

    // Love Raid
    autoLoveRaidSelectedIndex: "Setting_autoLoveRaidSelectedIndex",
    plusLoveRaidMythic: "Setting_autoLoveRaidMythicOnly", // now stores min grade (0=off, 3, 5, 6) instead of boolean

    // Bundles
    autoFreeBundlesCollect: "Setting_autoFreeBundlesCollect",
    autoFreeBundlesCollectablesList: "Setting_autoFreeBundlesCollectablesList",

    // Sultry Mysteries
    sultryMysteriesEventRefreshShop: "Setting_sultryMysteriesEventRefreshShop",

    // Display / UI
    showInfo: "Setting_showInfo",
    showInfoLeft: "Setting_showInfoLeft",
    showCalculatePower: "Setting_showCalculatePower",
    showClubButtonInPoa: "Setting_showClubButtonInPoa",
    showRewardsRecap: "Setting_showRewardsRecap",
    showTooltips: "Setting_showTooltips",
    showAdsBack: "Setting_showAdsBack",
    mousePause: "Setting_mousePause",
    mousePauseTimeout: "Setting_mousePauseTimeout",
    collectAllTimer: "Setting_collectAllTimer",
    compactDailyGoals: "Setting_compactDailyGoals",
    compactEndedContests: "Setting_compactEndedContests",
    compactMissions: "Setting_compactMissions",
    compactPowerPlace: "Setting_compactPowerPlace",
    invertMissions: "Setting_invertMissions",
    saveDefaults: "Setting_saveDefaults",

    // Reward Masks
    AllMaskRewards: "Setting_AllMaskRewards",
    PoAMaskRewards: "Setting_PoAMaskRewards",
    PoGMaskRewards: "Setting_PoGMaskRewards",
    PoVMaskRewards: "Setting_PoVMaskRewards",
    SeasonMaskRewards: "Setting_SeasonMaskRewards",
    SeasonalEventMaskRewards: "Setting_SeasonalEventMaskRewards",
} as const;

// ── Temp_ keys (temporary / runtime data) ─────────────────────────
export const TK = {
    autoLoop: "Temp_autoLoop",
    autoLoopTimeMili: "Temp_autoLoopTimeMili",
    Debug: "Temp_Debug",
    Logging: "Temp_Logging",
    Timers: "Temp_Timers",
    LastPageCalled: "Temp_LastPageCalled",
    CheckSpentPoints: "Temp_CheckSpentPoints",
    freshStart: "Temp_freshStart",
    scriptversion: "Temp_scriptversion",
    pinfo: "Temp_pinfo",

    // Harem
    HaremSize: "Temp_HaremSize",
    filteredGirlsList: "Temp_filteredGirlsList",
    haremGirlActions: "Temp_haremGirlActions",
    haremGirlEnd: "Temp_haremGirlEnd",
    haremGirlLimit: "Temp_haremGirlLimit",
    haremGirlMode: "Temp_haremGirlMode",
    haremGirlPayLast: "Temp_haremGirlPayLast",
    haremGirlSpent: "Temp_haremGirlSpent",
    haremMoneyOnStart: "Temp_haremMoneyOnStart",
    haremTeam: "Temp_haremTeam",
    haremTeamScrolls: "Temp_haremTeamScrolls",
    haremTeamSettings: "Temp_haremTeamSettings",

    // Resources
    haveAff: "Temp_haveAff",
    haveBooster: "Temp_haveBooster",
    haveExp: "Temp_haveExp",
    charLevel: "Temp_charLevel",
    storeContents: "Temp_storeContents",
    boosterStatus: "Temp_boosterStatus",
    boosterIdMap: "Temp_boosterIdMap",

    // Troll
    TrollHumanLikeRun: "Temp_TrollHumanLikeRun",
    TrollInvalid: "Temp_TrollInvalid",
    trollPoints: "Temp_trollPoints",
    trollToFight: "Temp_trollToFight",
    trollWithGirls: "Temp_trollWithGirls",
    autoTrollBattleSaveQuest: "Temp_autoTrollBattleSaveQuest",

    // Quest
    questRequirement: "Temp_questRequirement",
    MainAdventureWorldID: "Temp_MainAdventureWorldID",
    SideAdventureWorldID: "Temp_SideAdventureWorldID",

    // Battle
    battlePowerRequired: "Temp_battlePowerRequired",
    burst: "Temp_burst",
    fought: "Temp_fought",
    lastActionPerformed: "Temp_lastActionPerformed",

    // Events
    eventGirl: "Temp_eventGirl",
    eventMythicGirl: "Temp_eventMythicGirl",
    eventsGirlz: "Temp_eventsGirlz",
    eventsList: "Temp_eventsList",
    autoChampsEventGirls: "Temp_autoChampsEventGirls",
    EventFightsBeforeRefresh: "Temp_EventFightsBeforeRefresh",
    loveRaids: "Temp_loveRaids",
    raidGirls: "Temp_raidGirls",
    bossBangTeam: "Temp_bossBangTeam",
    lseManualCollectAll: "Temp_lseManualCollectAll",
    poaManualCollectAll: "Temp_poaManualCollectAll",

    // Champion
    champBuildTeam: "Temp_champBuildTeam",
    clubChampLimitReached: "Temp_clubChampLimitReached",

    // League
    LeagueHumanLikeRun: "Temp_LeagueHumanLikeRun",
    LeagueOpponentList: "Temp_LeagueOpponentList",
    LeagueSavedData: "Temp_LeagueSavedData",
    LeagueTempOpponentList: "Temp_LeagueTempOpponentList",
    leaguesTarget: "Temp_leaguesTarget",
    hideBeatenOppo: "Temp_hideBeatenOppo",

    // Season
    SeasonEndDate: "Temp_SeasonEndDate",
    SeasonHumanLikeRun: "Temp_SeasonHumanLikeRun",
    SeasonalEventEndDate: "Temp_SeasonalEventEndDate",

    // Pantheon / PentaDrill
    PantheonHumanLikeRun: "Temp_PantheonHumanLikeRun",
    PentaDrillHumanLikeRun: "Temp_PentaDrillHumanLikeRun",

    // Place of Power
    PopToStart: "Temp_PopToStart",
    PopTargeted: "Temp_PopTargeted",
    PopUnableToStart: "Temp_PopUnableToStart",
    Totalpops: "Temp_Totalpops",
    currentlyAvailablePops: "Temp_currentlyAvailablePops",

    // Path Events
    PoAEndDate: "Temp_PoAEndDate",
    PoGEndDate: "Temp_PoGEndDate",
    PoVEndDate: "Temp_PoVEndDate",

    // Daily Goals
    dailyGoalsList: "Temp_dailyGoalsList",

    // Paranoia
    NextSwitch: "Temp_NextSwitch",
    paranoiaLeagueBlocked: "Temp_paranoiaLeagueBlocked",
    paranoiaQuestBlocked: "Temp_paranoiaQuestBlocked",
    paranoiaSpendings: "Temp_paranoiaSpendings",

    // Misc
    sandalwoodFailure: "Temp_sandalwoodFailure",
    sandalwoodMaxUsages: "Temp_sandalwoodMaxUsages",
    unkownPagesList: "Temp_unkownPagesList",
    userLink: "Temp_userLink",

    // Survey
    surveyShown: "Temp_surveyShown",
    surveyDismissCount: "Temp_surveyDismissCount",
    surveyLastHash: "Temp_surveyLastHash",

    // Feature Popup (What's New)
    featurePopupShown: "Temp_featurePopupShown",
    featurePopupDismissCount: "Temp_featurePopupDismissCount",
} as const;
