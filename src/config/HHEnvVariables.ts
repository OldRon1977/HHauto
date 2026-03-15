// Per-environment (game variant) configuration for HHAuto.
// Detects the current game domain and loads the matching set of page IDs, URLs,
// CSS selectors, feature flags, and troll/quest data for that variant.

import { getLanguageCode } from "../Helper/LanguageHelper";
import { Harem } from '../Module/index';
import { 
    AmourAgent,
    ComixHarem,
    GayHarem,
    GayPornstarHarem,
    HentaiHeroes,
    MangaRpg,
    PornstarHarem,
    TransPornstarHarem
} from "./game/index";

const supportedGames = [
    HentaiHeroes,
    ComixHarem,
    GayHarem,
    GayPornstarHarem,
    MangaRpg,
    AmourAgent,
    PornstarHarem,
    TransPornstarHarem
];

export const HHKnownEnvironnements = {};
supportedGames.forEach(game => {
    if (game.hasOwnProperty('getEnv')) {
        for (var key in game.getEnv()) {
            HHKnownEnvironnements[key] = game.getEnv()[key];
        }
    }
});
HHKnownEnvironnements["www.hornyheroes.com"] = {name:"SH_prod",id:"hh_sexy"};


export const HHEnvVariables = {};
HHEnvVariables["global"] = {};
for (let i in HHKnownEnvironnements)
{
    HHEnvVariables[HHKnownEnvironnements[i].name] = {};
    HHEnvVariables[HHKnownEnvironnements[i].name].gameID = HHKnownEnvironnements[i].id;
    HHEnvVariables[HHKnownEnvironnements[i].name].HHGameName = HHKnownEnvironnements[i].name;
    let baseImgPath =  HHKnownEnvironnements[i].baseImgPath ? HHKnownEnvironnements[i].baseImgPath : 'https://hh2.hh-content.com';
    HHEnvVariables[HHKnownEnvironnements[i].name].baseImgPath = baseImgPath;
}

HHEnvVariables["global"].eventIDReg = "event_";
HHEnvVariables["global"].mythicEventIDReg = "mythic_event_";
HHEnvVariables["global"].bossBangEventIDReg = "boss_bang_event_";
HHEnvVariables["global"].sultryMysteriesEventIDReg = "sm_event_";
HHEnvVariables["global"].doublePenetrationEventIDReg = "dp_event_";
HHEnvVariables["global"].poaEventIDReg = "path_event_";
HHEnvVariables["global"].livelySceneEventIDReg = "lively_scene_event_";
HHEnvVariables["global"].girlToolTipData = "data-new-girl-tooltip";
HHEnvVariables["global"].dailyRewardNotifRequest = "#contains_all header .currency .daily-reward-notif";
HHEnvVariables["global"].IDpanelEditTeam = "#edit-team-page"
HHEnvVariables["global"].shopGirlCountRequest = '#girls_list .g1 .nav_placement span:not([contenteditable]';
HHEnvVariables["global"].shopGirlCurrentRequest = '#girls_list .g1 .nav_placement span[contenteditable]';
HHEnvVariables["global"].selectorFilterNotDisplayNone = ':not([style*="display:none"]):not([style*="display: none"])';
HHEnvVariables["global"].selectorClaimAllRewards = "#claim-all:not([disabled]):visible:not([style*='visibility: hidden;'])"; // KK use visibility: hidden or visibility: visible to display this button
HHEnvVariables["global"].HaremMaxSizeExpirationSecs = 7*24*60*60;//7 days
HHEnvVariables["global"].HaremMinSizeExpirationSecs = 24*60*60;//1 days
HHEnvVariables["global"].LeagueListExpirationSecs = 2*60;//2 min
HHEnvVariables["global"].minSecsBeforeGoHomeAfterActions = 10;
HHEnvVariables["global"].dailyRewardMaxRemainingTime = 2*60*60;
HHEnvVariables["global"].maxCollectionDelay = 6*60*60;
HHEnvVariables["global"].STOCHASTIC_SIM_RUNS = 10000;
HHEnvVariables["global"].PoVPoGTimestampAttributeName = "data-time-stamp";
HHEnvVariables["global"].CHAMP_TICKET_PRICE = 30;
HHEnvVariables["global"].LEVEL_MIN_POV = 30;
HHEnvVariables["global"].LEVEL_MIN_POG = 30;
HHEnvVariables["global"].LEVEL_MIN_LEAGUE = 20;
HHEnvVariables["global"].LEVEL_MIN_PANTHEON = 15;
HHEnvVariables["global"].LEVEL_MIN_EVENT_SM = 15;
HHEnvVariables["global"].LEVEL_MIN_EVENT_DP = 40;
HHEnvVariables["global"].boosterId_MB1 = 632;

HHEnvVariables["global"].powerCalcImages =
    {
    plus:   "https://i.postimg.cc/qgkpN0sZ/Opponent-green.png",
    close:  "https://i.postimg.cc/3JCgVBdK/Opponent-orange.png",
    minus:  "https://i.postimg.cc/PxgxrBVB/Opponent-red.png",
    chosen: "https://i.postimg.cc/MfKwNbZ8/Opponent-go.png"
};

HHEnvVariables["global"].possibleRewardsList = {'energy_kiss' : "Kisses",
                                                'energy_quest' : "Quest energy",
                                                'energy_fight' : "Fights",
                                                'energy_drill' : "Penta drill",
                                                'xp' : "Exp",
                                                'girl_shards' : "Girl shards",
                                                'random_girl_shards' : "Random girl shards",
                                                'soft_currency' : "Ymens",
                                                'hard_currency' : "Kobans",
                                                'gift':"Gifts",
                                                'potion' : "Potions",
                                                'booster' : "Boosters",
                                                'orbs': "Orbs",
                                                'gems' : "Gems",
                                                'scrolls' : "Light Bulbs",
                                                'mythic' : "Mythic Rquipment",
                                                'avatar': "Avatar",
                                                'ticket' : "Champions' tickets",
                                                'event_cash' : "Event cash",
                                                'rejuvenation_stone': "Rejuvenation Stones"};

HHEnvVariables["global"].trollzList = HentaiHeroes.getTrolls(getLanguageCode());
HHEnvVariables["global"].sideTrollzList = [];

HHEnvVariables["global"].trollIdMapping =  []; // Empty means no specific mapping
HHEnvVariables["global"].sideTrollIdMapping =  []; // Empty means no specific mapping

HHEnvVariables["global"].trollGirlsID = HentaiHeroes.getTrollGirlsId();
HHEnvVariables["global"].sideTrollGirlsID = [];

HHEnvVariables["global"].lastQuestId = -1; //  TODO update when new quest comes

HHEnvVariables["global"].leaguesList = ["Wanker I",
                                        "Wanker II",
                                        "Wanker III",
                                        "Sexpert I",
                                        "Sexpert II",
                                        "Sexpert III",
                                        "Dicktator I",
                                        "Dicktator II",
                                        "Dicktator III"];

switch (getLanguageCode())
{
    case "fr":
        HHEnvVariables["global"].leaguesList = ["Branleur I",
                                                "Branleur II",
                                                "Branleur III",
                                                "Sexpert I",
                                                "Sexpert II",
                                                "Sexpert III",
                                                "Dicktateur I",
                                                "Dicktateur II",
                                                "Dicktateur III"];
        break;
    default:

        break;
}

function compareOwnFirst(a, b, final_comparaison)
{
    if (a.is_owned && !b.is_owned) {
        return -1
    } else if (!a.is_owned && b.is_owned) {
        return 1
    }
    return final_comparaison
}

HHEnvVariables["global"].haremSortingFunctions = {};
HHEnvVariables["global"].haremSortingFunctions.date_recruited =
HHEnvVariables["global"].haremSortingFunctions.DateAcquired = function (a, b)
{
    if (a.gData.is_owned && b.gData.is_owned) {
        var dateA = new Date(a.gData.date_added).getTime();
        var dateB = new Date(b.gData.date_added).getTime();
        return dateA - dateB
    } else if (a.gData.is_owned && !b.gData.is_owned)
        return -1;
    else if (!a.gData.is_owned && b.gData.is_owned)
        return 1;
    else
        return b.shards - a.shards
};
HHEnvVariables["global"].haremSortingFunctions.Name = function sortByName(a, b)
{
    var nameA = a.gData.name.toUpperCase();
    var nameB = b.gData.name.toUpperCase();
    if (a.gData.is_owned == b.gData.is_owned) {
        if (nameA < nameB)
            return -1;
        if (nameA > nameB)
            return 1;
        return 0
    } else if (a.gData.is_owned && !b.gData.is_owned)
        return -1;
    else if (!a.gData.is_owned && b.gData.is_owned)
        return 1
};
HHEnvVariables["global"].haremSortingFunctions.Grade = function sortByGrade(a, b)
{
    return compareOwnFirst(a.gData, b.gData, b.gData.graded - a.gData.graded)
};
HHEnvVariables["global"].haremSortingFunctions.Level = function sortByLevel(a, b)
{
    return compareOwnFirst(a.gData, b.gData, b.gData.level - a.gData.level)
};
HHEnvVariables["global"].haremSortingFunctions.Power = function sortByPower(a, b)
{
    return compareOwnFirst(a.gData, b.gData, b.gData.caracs.carac1 + b.gData.caracs.carac2 + b.gData.caracs.carac3 - a.gData.caracs.carac1 - a.gData.caracs.carac2 - a.gData.caracs.carac3)
}
HHEnvVariables["global"].haremSortingFunctions.upgrade_cost = function sortByUpgradeCost(a, b)
{
    const aCost = (Number(a.gData.nb_grades) === Number(a.gData.graded) || !a.gData.is_owned ) ? 0 : Harem.getGirlUpgradeCost(a.gData.rarity, a.gData.graded + 1);
    const bCost = (Number(b.gData.nb_grades) === Number(b.gData.graded) || !b.gData.is_owned ) ? 0 : Harem.getGirlUpgradeCost(b.gData.rarity, b.gData.graded + 1);
    return compareOwnFirst(a.gData, b.gData, bCost - aCost )
}

HHEnvVariables["global"].pagesKnownList = [];

HHEnvVariables["global"].pagesIDHome = "home";
HHEnvVariables["global"].pagesURLHome = "/home.html";
HHEnvVariables["global"].pagesKnownList.push("Home");

HHEnvVariables["global"].pagesIDMissions = "missions";
HHEnvVariables["global"].pagesKnownList.push("Missions");

HHEnvVariables["global"].pagesIDContests = "contests";
HHEnvVariables["global"].pagesKnownList.push("Contests");

HHEnvVariables["global"].pagesIDDailyGoals = "daily_goals";
HHEnvVariables["global"].pagesKnownList.push("DailyGoals");

HHEnvVariables["global"].pagesIDQuest = "quest";
HHEnvVariables["global"].pagesKnownList.push("Quest");

HHEnvVariables["global"].pagesIDActivities = "activities";
HHEnvVariables["global"].pagesURLActivities = "/activities.html";
HHEnvVariables["global"].pagesKnownList.push("Activities");

HHEnvVariables["global"].pagesIDHarem = "harem";
HHEnvVariables["global"].pagesURLHarem = "/characters.html";
HHEnvVariables["global"].pagesKnownList.push("Harem");

HHEnvVariables["global"].pagesIDGirlPage = "girl";
HHEnvVariables["global"].pagesKnownList.push("GirlPage");

HHEnvVariables["global"].pagesIDMap = "map";
HHEnvVariables["global"].pagesURLMap = "/map.html";
HHEnvVariables["global"].pagesKnownList.push("Map");

HHEnvVariables["global"].pagesIDPachinko = "pachinko";
HHEnvVariables["global"].pagesURLPachinko = "/pachinko.html";
HHEnvVariables["global"].pagesKnownList.push("Pachinko");

HHEnvVariables["global"].pagesIDLeaderboard = "leaderboard";
HHEnvVariables["global"].pagesURLLeaderboard = "/leagues.html";
HHEnvVariables["global"].pagesKnownList.push("Leaderboard");

HHEnvVariables["global"].pagesIDShop = "shop";
HHEnvVariables["global"].pagesURLShop = "/shop.html";
HHEnvVariables["global"].pagesKnownList.push("Shop");

HHEnvVariables["global"].pagesIDClub = "clubs";
HHEnvVariables["global"].pagesURLClub = "/clubs.html";
HHEnvVariables["global"].pagesKnownList.push("Club");

HHEnvVariables["global"].pagesIDPantheon = "pantheon";
HHEnvVariables["global"].pagesURLPantheon = "/pantheon.html";
HHEnvVariables["global"].pagesKnownList.push("Pantheon");

HHEnvVariables["global"].pagesIDPantheonPreBattle = "pantheon-pre-battle";
HHEnvVariables["global"].pagesURLPantheonPreBattle = "/pantheon-pre-battle.html";
HHEnvVariables["global"].pagesKnownList.push("PantheonPreBattle");

HHEnvVariables["global"].pagesIDLabyrinthEntrance = "labyrinth-entrance";
HHEnvVariables["global"].pagesURLLabyrinthEntrance = "/labyrinth-entrance.html";
HHEnvVariables["global"].pagesKnownList.push("LabyrinthEntrance");

HHEnvVariables["global"].pagesIDLabyrinthPoolSelect = "labyrinth-pool-select";
HHEnvVariables["global"].pagesURLLabyrinthPoolSelect = "/labyrinth-pool-select.html";
HHEnvVariables["global"].pagesKnownList.push("LabyrinthPoolSelect");

HHEnvVariables["global"].pagesIDLabyrinth = "labyrinth";
HHEnvVariables["global"].pagesURLLabyrinth = "/labyrinth.html";
HHEnvVariables["global"].pagesKnownList.push("Labyrinth");

HHEnvVariables["global"].pagesIDLabyrinthPreBattle = "labyrinth-pre-battle";
HHEnvVariables["global"].pagesURLLabyrinthPreBattle = "/labyrinth-pre-battle.html";
HHEnvVariables["global"].pagesKnownList.push("LabyrinthPreBattle");

HHEnvVariables["global"].pagesIDLabyrinthBattle = "labyrinth-battle";
HHEnvVariables["global"].pagesURLLabyrinthBattle = "/labyrinth-battle.html";
HHEnvVariables["global"].pagesKnownList.push("LabyrinthBattle");

HHEnvVariables["global"].pagesIDChampionsPage = "champions";
HHEnvVariables["global"].pagesKnownList.push("ChampionsPage");

HHEnvVariables["global"].pagesIDChampionsMap = "champions_map";
HHEnvVariables["global"].pagesURLChampionsMap = "/champions-map.html";
HHEnvVariables["global"].pagesKnownList.push("ChampionsMap");

HHEnvVariables["global"].pagesIDSeason = "season";
HHEnvVariables["global"].pagesURLSeason = "/season.html";
HHEnvVariables["global"].pagesKnownList.push("Season");

HHEnvVariables["global"].pagesIDSeasonArena = "season_arena";
HHEnvVariables["global"].pagesURLSeasonArena = "/season-arena.html";
HHEnvVariables["global"].pagesKnownList.push("SeasonArena");

HHEnvVariables["global"].pagesIDClubChampion = "club_champion";
HHEnvVariables["global"].pagesURLClubChampion = "/club-champion.html";
HHEnvVariables["global"].pagesKnownList.push("ClubChampion");

HHEnvVariables["global"].pagesIDLeagueBattle = "league-battle";
HHEnvVariables["global"].pagesURLLeagueBattle = "/league-battle.html";
HHEnvVariables["global"].pagesKnownList.push("LeagueBattle");

HHEnvVariables["global"].pagesIDLeaguePreBattle = "leagues-pre-battle";
HHEnvVariables["global"].pagesURLLeaguPreBattle = "/leagues-pre-battle.html";
HHEnvVariables["global"].pagesKnownList.push("LeaguePreBattle");

HHEnvVariables["global"].pagesIDTrollBattle = "troll-battle";
HHEnvVariables["global"].pagesURLTrollBattle = "/troll-battle.html";
HHEnvVariables["global"].pagesKnownList.push("TrollBattle");

HHEnvVariables["global"].pagesIDSeasonBattle = "season-battle";
HHEnvVariables["global"].pagesURLSeasonBattle = "/season-battle.html";
HHEnvVariables["global"].pagesKnownList.push("SeasonBattle");

HHEnvVariables["global"].pagesIDPantheonBattle = "pantheon-battle";
HHEnvVariables["global"].pagesURLPantheonBattle = "/pantheon-battle.html";
HHEnvVariables["global"].pagesKnownList.push("PantheonBattle");

HHEnvVariables["global"].pagesIDTrollPreBattle = "troll-pre-battle";
HHEnvVariables["global"].pagesURLTrollPreBattle = "/troll-pre-battle.html";
HHEnvVariables["global"].pagesKnownList.push("TrollPreBattle");

HHEnvVariables["global"].pagesIDPentaDrill = "penta_drill";
HHEnvVariables["global"].pagesURLPentaDrill = "/penta-drill.html";
HHEnvVariables["global"].pagesKnownList.push("PentaDrill");

HHEnvVariables["global"].pagesIDPentaDrillArena = "penta_drill_arena";
HHEnvVariables["global"].pagesURLPentaDrillArena = "/penta-drill-arena.html";
HHEnvVariables["global"].pagesKnownList.push("PentaDrillArena");

HHEnvVariables["global"].pagesIDEditPentaDrillTeam = "edit-penta-drill-team";
HHEnvVariables["global"].pagesURLEditPentaDrillTeam = "/edit-penta-drill-team";
HHEnvVariables["global"].pagesKnownList.push("EditPentaDrillTeam");

HHEnvVariables["global"].pagesIDPentaDrillPreBattle = "penta_drill_pre_battle";
HHEnvVariables["global"].pagesURLPentaDrillPreBattle = "/penta-drill-pre-battle";
HHEnvVariables["global"].pagesKnownList.push("PentaDrillPreBattle");

HHEnvVariables["global"].pagesIDPentaDrillBattle = "penta-drill-battle";
HHEnvVariables["global"].pagesURLPentaDrillBattle = "/penta-drill-battle.html";
HHEnvVariables["global"].pagesKnownList.push("PentaDrillBattle");

HHEnvVariables["global"].pagesIDEvent = "event";
HHEnvVariables["global"].pagesURLEvent = "/event.html";
HHEnvVariables["global"].pagesKnownList.push("Event");

HHEnvVariables["global"].pagesIDPoV = "path-of-valor";
HHEnvVariables["global"].pagesURLPoV = "/path-of-valor.html";
HHEnvVariables["global"].pagesKnownList.push("PoV");

HHEnvVariables["global"].pagesIDPoG = "path-of-glory";
HHEnvVariables["global"].pagesURLPoG = "/path-of-glory.html";
HHEnvVariables["global"].pagesKnownList.push("PoG");

HHEnvVariables["global"].pagesIDSeasonalEvent = "seasonal";
HHEnvVariables["global"].pagesURLSeasonalEvent = "/seasonal.html";
HHEnvVariables["global"].pagesKnownList.push("SeasonalEvent");

HHEnvVariables["global"].pagesIDPowerplacemain = "powerplacemain";
HHEnvVariables["global"].pagesKnownList.push("Powerplacemain");

HHEnvVariables["global"].pagesIDWaifu = "waifu";
HHEnvVariables["global"].pagesURLWaifu = "/waifu.html";
HHEnvVariables["global"].pagesKnownList.push("Waifu");

HHEnvVariables["global"].pagesIDBattleTeams = "teams";
HHEnvVariables["global"].pagesURLBattleTeams = "/teams.html";
HHEnvVariables["global"].pagesKnownList.push("BattleTeams");

HHEnvVariables["global"].pagesIDEditTeam = "edit-team";
HHEnvVariables["global"].pagesURLEditTeam = "/edit-team.html";
HHEnvVariables["global"].pagesKnownList.push("EditTeam");

HHEnvVariables["global"].pagesIDPoA = "path_of_attraction";
HHEnvVariables["global"].pagesKnownList.push("PoA");

HHEnvVariables["global"].pagesIDBossBang = "boss-bang-battle";
HHEnvVariables["global"].pagesKnownList.push("BossBang");

HHEnvVariables["global"].pagesIDSexGodPath = "sex-god-path";
HHEnvVariables["global"].pagesURLSexGodPath = "/sex-god-path.html";
HHEnvVariables["global"].pagesKnownList.push("SexGodPath");

HHEnvVariables["global"].pagesIDLabyrinthEntrance = "labyrinth-entrance";
HHEnvVariables["global"].pagesURLLabyrinthEntrance = "/labyrinth-entrance.html";
HHEnvVariables["global"].pagesKnownList.push("LabyrinthEntrance");

HHEnvVariables["global"].pagesIDLabyrinthPoolSelect = "labyrinth-pool-select";
HHEnvVariables["global"].pagesURLLabyrinthPoolSelect = "/labyrinth-pool-select.html";
HHEnvVariables["global"].pagesKnownList.push("LabyrinthPoolSelect");

HHEnvVariables["global"].pagesIDEditLabyrinthTeam = "edit-labyrinth-team";
HHEnvVariables["global"].pagesURLEditLabyrinthTeam = "/edit-labyrinth-team.html";
HHEnvVariables["global"].pagesKnownList.push("EditLabyrinthTeam");

HHEnvVariables["global"].pagesIDMemberProgression = "member-progression";
HHEnvVariables["global"].pagesURLMemberProgression = "/member-progression.html"; 
HHEnvVariables["global"].pagesKnownList.push("MemberProgression");

HHEnvVariables["global"].pagesIDHeroPage = "hero_pages";
HHEnvVariables["global"].pagesURLHeroPage = "/hero/profile.html"; 
HHEnvVariables["global"].pagesKnownList.push("HeroPage");

HHEnvVariables["global"].pagesIDGirlEquipmentUpgrade = "girl-equipment-upgrade";
HHEnvVariables["global"].pagesURLGirlEquipmentUpgrade = "/girl-equipment-upgrade.html"; 
HHEnvVariables["global"].pagesKnownList.push("GirlEquipmentUpgrade");

HHEnvVariables["global"].pagesIDLoveRaid = "love_raids";
HHEnvVariables["global"].pagesURLLoveRaid = "/love-raids.html"; 
HHEnvVariables["global"].pagesKnownList.push("LoveRaid");

HHEnvVariables["global"].isEnabledEvents = true;
HHEnvVariables["global"].isEnabledTrollBattle = true;
HHEnvVariables["global"].isEnabledPachinko = true;
HHEnvVariables["global"].isEnabledGreatPachinko = true;
HHEnvVariables["global"].isEnabledMythicPachinko = true;
HHEnvVariables["global"].isEnabledEquipmentPachinko = true;
HHEnvVariables["global"].isEnabledContest = true;
HHEnvVariables["global"].isEnabledPowerPlaces = true;
HHEnvVariables["global"].isEnabledMission = true;
HHEnvVariables["global"].isEnabledQuest = true;
HHEnvVariables["global"].isEnabledSideQuest = true;
HHEnvVariables["global"].isEnabledSeason = true;
HHEnvVariables["global"].isEnabledPentaDrill = true;
HHEnvVariables["global"].isEnabledPantheon = true;
HHEnvVariables["global"].isEnabledLabyrinth = true;
HHEnvVariables["global"].isEnabledAllChamps = true;
HHEnvVariables["global"].isEnabledChamps = true;
HHEnvVariables["global"].isEnabledClubChamp = true;
HHEnvVariables["global"].isEnabledLeagues = true;
HHEnvVariables["global"].isEnabledDailyRewards = true;
HHEnvVariables["global"].isEnabledFreeBundles = true;
HHEnvVariables["global"].isEnabledShop = true;
HHEnvVariables["global"].isEnabledSalary = true;
HHEnvVariables["global"].isEnabledPoV = true;
HHEnvVariables["global"].isEnabledPoG = true;
HHEnvVariables["global"].isEnabledRaidOfLive = true;
HHEnvVariables["global"].isEnabledSeasonalEvent = true;
HHEnvVariables["global"].isEnabledBossBangEvent = true;
HHEnvVariables["global"].isEnabledDPEvent = true;
HHEnvVariables["global"].isEnabledLivelySceneEvent = true;
HHEnvVariables["global"].isEnabledSultryMysteriesEvent = true;
HHEnvVariables["global"].isEnabledDailyGoals = true;
HHEnvVariables["global"].isEnabledSpreadsheets = true;
HHEnvVariables["global"].spreadsheet = ''; // zoopokemon, Bella, Cuervos & Sandor. spreadsheets
HHEnvVariables["HH_test"].isEnabledDailyRewards = false;// to remove if daily rewards arrives in test
HHEnvVariables["HH_test"].isEnabledFreeBundles = false;// to remove if bundles arrives in test


for (var key in HentaiHeroes.getEnv()) {
    const element = HentaiHeroes.getEnv()[key].name;
    HHEnvVariables[element].spreadsheet = HentaiHeroes.spreadsheet;
    HHEnvVariables[element].trollIdMapping = HentaiHeroes.trollIdMapping;
    HHEnvVariables[element].sideTrollIdMapping = HentaiHeroes.sideTrollIdMapping;
    HHEnvVariables[element].sideTrollzList = HentaiHeroes.getSideTrolls(getLanguageCode());
    HHEnvVariables[element].sideTrollGirlsID = HentaiHeroes.getSideTrollGirlsId();
    HHEnvVariables[element].lastQuestId = HentaiHeroes.lastQuestId;
}

for (var key in GayHarem.getEnv()) {
    const element = GayHarem.getEnv()[key].name;
    HHEnvVariables[element].trollzList = GayHarem.getTrolls(getLanguageCode());
    HHEnvVariables[element].trollGirlsID = GayHarem.getTrollGirlsId();
    HHEnvVariables[element].trollIdMapping = GayHarem.trollIdMapping;
    HHEnvVariables[element].lastQuestId = GayHarem.lastQuestId;
};

for (var key in ComixHarem.getEnv()) {
    const element = ComixHarem.getEnv()[key].name;
    HHEnvVariables[element].trollzList = ComixHarem.getTrolls(getLanguageCode());
    HHEnvVariables[element].trollGirlsID = ComixHarem.getTrollGirlsId();
    HHEnvVariables[element].trollIdMapping = ComixHarem.trollIdMapping;
    HHEnvVariables[element].lastQuestId = ComixHarem.lastQuestId;
    HHEnvVariables[element].boosterId_MB1 = 2619;
};

HHEnvVariables["SH_prod"].isEnabledSideQuest = false;// to remove when SideQuest arrives in hornyheroes
HHEnvVariables["SH_prod"].isEnabledPowerPlaces = false;// to remove when PoP arrives in hornyheroes
HHEnvVariables["SH_prod"].isEnabledMythicPachinko = false;// to remove when Mythic Pachinko arrives in hornyheroes
HHEnvVariables["SH_prod"].isEnabledEquipmentPachinko = false;// to remove when Equipment Pachinko arrives in hornyheroes
HHEnvVariables["SH_prod"].isEnabledAllChamps = false;// to remove when Champs arrives in hornyheroes
HHEnvVariables["SH_prod"].isEnabledChamps = false;// to remove when Champs arrives in hornyheroes
HHEnvVariables["SH_prod"].isEnabledClubChamp = false;// to remove when Club Champs arrives in hornyheroes
HHEnvVariables["SH_prod"].isEnabledPantheon = false;// to remove when Pantheon arrives in hornyheroes
HHEnvVariables["SH_prod"].isEnabledLabyrinth = false;// to remove when Pantheon arrives in hornyheroes
HHEnvVariables["SH_prod"].isEnabledPoV = false;// to remove when PoV arrives in hornyheroes
HHEnvVariables["SH_prod"].isEnabledPoG = false;// to remove when PoG arrives in hornyheroes
HHEnvVariables["SH_prod"].lastQuestId = -1; //  TODO update when new quest comes

for (var key in MangaRpg.getEnv()) {
    const element = MangaRpg.getEnv()[key].name;
    HHEnvVariables[element].lastQuestId = -1; //  TODO update when new quest comes
    HHEnvVariables[element].trollzList = MangaRpg.getTrolls(getLanguageCode());
    HHEnvVariables[element].trollGirlsID = MangaRpg.getTrollGirlsId();
    HHEnvVariables[element].trollIdMapping = MangaRpg.trollIdMapping;
    HHEnvVariables[element].lastQuestId = MangaRpg.lastQuestId;
    MangaRpg.updateFeatures(HHEnvVariables[element]);
};

for (var key in AmourAgent.getEnv()) {
    const element = AmourAgent.getEnv()[key].name;
    HHEnvVariables[element].lastQuestId = -1; //  TODO update when new quest comes
    HHEnvVariables[element].trollzList = AmourAgent.getTrolls(getLanguageCode());
    HHEnvVariables[element].trollIdMapping = AmourAgent.trollIdMapping;
    HHEnvVariables[element].lastQuestId = AmourAgent.lastQuestId;
    AmourAgent.updateFeatures(HHEnvVariables[element]);
};

for (var key in PornstarHarem.getEnv()) {
    const element = PornstarHarem.getEnv()[key].name;
    HHEnvVariables[element].trollzList = PornstarHarem.getTrolls(getLanguageCode());
    HHEnvVariables[element].trollIdMapping = PornstarHarem.trollIdMapping;
    HHEnvVariables[element].lastQuestId = PornstarHarem.lastQuestId;
    HHEnvVariables[element].boosterId_MB1 = 2619;
    HHEnvVariables[element].trollGirlsID = PornstarHarem.getTrollGirlsId();
};

for (var key in TransPornstarHarem.getEnv()) {
    const element = TransPornstarHarem.getEnv()[key].name;
    HHEnvVariables[element].trollzList = TransPornstarHarem.getTrolls(getLanguageCode());
    TransPornstarHarem.updateFeatures(HHEnvVariables[element]);
    HHEnvVariables[element].trollGirlsID = TransPornstarHarem.getTrollGirlsId();
    HHEnvVariables[element].trollIdMapping = TransPornstarHarem.trollIdMapping;
    HHEnvVariables[element].lastQuestId = TransPornstarHarem.lastQuestId;
    HHEnvVariables[element].boosterId_MB1 = 2619;
};

for (var key in GayPornstarHarem.getEnv()) {
    const element = GayPornstarHarem.getEnv()[key].name;
    HHEnvVariables[element].trollzList = GayPornstarHarem.getTrolls(getLanguageCode());
    GayPornstarHarem.updateFeatures(HHEnvVariables[element]);
    HHEnvVariables[element].trollGirlsID = GayPornstarHarem.getTrollGirlsId();
    HHEnvVariables[element].trollIdMapping = GayPornstarHarem.trollIdMapping;
    HHEnvVariables[element].lastQuestId = GayPornstarHarem.lastQuestId;
    HHEnvVariables[element].boosterId_MB1 = 2619;
};
// Object.values(girlsDataList).filter(girl => girl.source?.name == "troll_tier" && girl.source?.group?.id == "7")
