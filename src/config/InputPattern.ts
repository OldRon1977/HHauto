// Regex patterns used for input validation in the HHAuto settings menu.
// Each pattern constrains what the user can enter in a specific settings field
// (e.g., timers, thresholds, booster filters).

const thousandsSeparator = (11111).toLocaleString().replace(/1+/g, '');

export const HHAuto_inputPattern = {
    nWith1000sSeparator:"[0-9"+thousandsSeparator+"]+",

    //kobanBank:"[0-9]+",
    buyCombTimer:"[0-9]+",
    buyMythicCombTimer:"[0-9]+",
    autoBuyBoostersFilter:"(B[1-4]|MB[1-9]|MB1[1-2])(;B[1-4]|;MB[1-9]|;MB1[1-2])*",
    autoEquipBoostersSlots:"B[1-4](;B[1-4]){0,3}",
    //calculatePowerLimits:"(\-?[0-9]+;\-?[0-9]+)|default",
    mousePauseTimeout:"[0-9]+",
    safeSecondsForContest:"[0-9]+",
    collectAllTimer:"[1-9][0-9]|[1-9]",
    autoTrollThreshold:"[1]?[0-9]",
    autoTrollRunThreshold:"(20|[1]?[0-9])",
    eventTrollOrder:"([1-2][0-9]|[1-9])(;([1-2][0-9]|[1-9]))*",
    autoBuyTrollNumber:"200|1[0-9][0-9]|[1-9]?[0-9]",
    autoSeasonThreshold:"[0-9]",
    autoSeasonMaxTierNb:"[1-7][0-9]|[1-9]",
    autoSeasonRunThreshold:"10|[0-9]",
    autoPentaDrillThreshold:"[0-9]",
    autoPentaDrillRunThreshold:"10|[0-9]",
    autoPantheonThreshold:"[0-9]",
    autoPantheonRunThreshold:"10|[0-9]",
    bossBangMinTeam:"[1-5]",
    autoQuestThreshold:"[1-9]?[0-9]",
    autoLeaguesThreshold:"1[0-4]|[0-9]",
    autoLeaguesRunThreshold:"1[0-5]|[0-9]",
    autoLeaguesSecurityThreshold:"[0-9]+",
    autoPowerPlacesIndexFilter:"[1-9][0-9]{0,1}(;[1-9][0-9]{0,1})*",
    autoChampsFilter:"[1-6](;[1-6])*",
    autoChampsTeamLoop:"[1-9][0-9]|[1-9]",
    //autoStats:"[0-9]+",
    //autoExp:"[0-9]+",
    //maxExp:"[0-9]+",
    //autoAff:"[0-9]+",
    //maxAff:"[0-9]+",
    menuSellNumber:"[0-9]+",
    autoClubChampMax:"[0-9]+",
    menuExpLevel:"[1-4]?[0-9]?[0-9]",
    minShardsX:"(100|[1-9][0-9]|[0-9])"
}