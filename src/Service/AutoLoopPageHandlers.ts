// AutoLoopPageHandlers.ts
//
// Handles page-specific UI enhancements that run on every loop
// iteration regardless of whether the automation is "busy". These
// are read-only or display-only operations that enrich the current
// page with HHAuto overlays (reward previews, opponent info, timer
// displays, etc.) without navigating away.
//
// Unlike AutoLoopActions (which fire one-at-a-time and navigate),
// page handlers run unconditionally based on the current page ID.
// They add informational elements, parse visible data, and set up
// page-specific features like the league opponent list or labyrinth
// auto-battle.
//
// Used by: AutoLoop.autoLoop() (called after action handlers)

import { AutoLoopContext } from './AutoLoopContext';
import { ConfigHelper } from "../Helper/ConfigHelper";
import { RewardHelper } from "../Helper/RewardHelper";
import { getStoredValue } from "../Helper/StorageHelper";
import { randomInterval } from "../Helper/TimeHelper";
import { checkTimer, getTimer } from "../Helper/TimerHelper";
import { PentaDrill } from '../Module/PentaDrill';
import { Spreadsheet } from '../Module/Spreadsheet';
import { BlessingService } from './BlessingService';
import { Booster } from "../Module/Booster";
import { Champion } from "../Module/Champion";
import { Club } from "../Module/Club";
import { ClubChampion } from "../Module/ClubChampion";
import { Contest } from "../Module/Contest";
import { DailyGoals, DailyGoalsIcon } from "../Module/DailyGoals";
import { BossBang } from "../Module/Events/BossBang";
import { DoublePenetration } from "../Module/Events/DoublePenetration";
import { EventModule } from "../Module/Events/EventModule";
import { LivelyScene } from "../Module/Events/LivelyScene";
import { LoveRaidManager } from "../Module/Events/LoveRaidManager";
import { PathOfAttraction } from "../Module/Events/PathOfAttraction";
import { PathOfGlory } from "../Module/Events/PathOfGlory";
import { PathOfValue } from "../Module/Events/PathOfValue";
import { Season } from "../Module/Events/Season";
import { SeasonalEvent } from "../Module/Events/Seasonal";
import { Harem } from "../Module/harem/Harem";
import { HaremGirl } from "../Module/harem/HaremGirl";
import { Labyrinth } from "../Module/Labyrinth";
import { LeagueHelper } from "../Module/League";
import { Pachinko } from "../Module/Pachinko";
import { PlaceOfPower } from "../Module/PlaceOfPower";
import { Shop } from "../Module/Shop";
import { TeamModule } from "../Module/TeamModule";
import { logHHAuto } from "../Utils/LogUtils";
import { callItOnce } from "../Utils/Utils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK, TK } from "../config/StorageKeys";
import { AdsService } from "./AdsService";

export async function handlePageSpecific(ctx: AutoLoopContext): Promise<void> {
    switch (ctx.currentPage)
    {
        case ConfigHelper.getHHScriptVars("pagesIDLeaderboard"):
            if (getStoredValue(HHStoredVarPrefixKey+SK.showCalculatePower) === "true")
            {
                LeagueHelper.moduleSimLeague = callItOnce(LeagueHelper.moduleSimLeague);
                LeagueHelper.moduleSimLeague();
                LeagueHelper.styles = callItOnce(LeagueHelper.styles);
                LeagueHelper.styles();
            }
            break;
        case ConfigHelper.getHHScriptVars("pagesIDSeasonArena"):
            if (getStoredValue(HHStoredVarPrefixKey+SK.showCalculatePower) === "true" && $("div.matchRatingNew img#powerLevelScouter").length < 3)
            {
                if (ctx.lastActionPerformed != "season") {
                    // Avoid double call when coming from Season.run()
                    Season.stylesBattle = callItOnce(Season.stylesBattle);
                    Season.stylesBattle();
                    Season.moduleSimSeasonBattle = callItOnce(Season.moduleSimSeasonBattle);
                    Season.moduleSimSeasonBattle();
                }
            }
            break;
        case ConfigHelper.getHHScriptVars("pagesIDSeason"):
            Season.styles = callItOnce(Season.styles);
            Season.styles();
            Season.getRemainingTime = callItOnce(Season.getRemainingTime);
            Season.getRemainingTime();
            if (getStoredValue(HHStoredVarPrefixKey+SK.showRewardsRecap) === "true")
            {
                Season.displayRewardsDiv();
            }
            break;
        case ConfigHelper.getHHScriptVars("pagesIDPentaDrillArena"):
            if (getStoredValue(HHStoredVarPrefixKey + SK.showCalculatePower) === "true" && $("img#powerLevelScouterChosen").length == 0)
            {
                PentaDrill.stylesBattle = callItOnce(PentaDrill.stylesBattle);
                PentaDrill.stylesBattle();
                PentaDrill.moduleSimPentaDrillBattle();
            }
            break;
        case ConfigHelper.getHHScriptVars("pagesIDPentaDrill"):
            PentaDrill.styles = callItOnce(PentaDrill.styles);
            PentaDrill.styles();
            PentaDrill.getRemainingTime = callItOnce(PentaDrill.getRemainingTime);
            PentaDrill.getRemainingTime();
            if (getStoredValue(HHStoredVarPrefixKey+SK.showRewardsRecap) === "true")
            {
                PentaDrill.displayRewardsDiv();
            }
            break;
        case ConfigHelper.getHHScriptVars("pagesIDEvent"):
            const eventID = EventModule.getDisplayedIdEventPage(false);
            if (eventID != '') {
                if (getStoredValue(HHStoredVarPrefixKey+SK.plusEvent) === "true" || getStoredValue(HHStoredVarPrefixKey+SK.plusEventMythic) ==="true")
                {
                    if(ctx.eventParsed == null) {
                        EventModule.parseEventPage(eventID);
                    }
                    EventModule.moduleDisplayEventPriority();
                    EventModule.hideOwnedGilrs();
                }

                if (getStoredValue(HHStoredVarPrefixKey+SK.bossBangEvent) === "true" && EventModule.getEvent(eventID).isBossBangEvent)
                {
                    if(ctx.eventParsed == null) {
                        EventModule.parseEventPage(eventID);
                    }
                    setTimeout(BossBang.goToFightPage, randomInterval(500,1500));
                }

                if (EventModule.getEvent(eventID).isPoa)
                {
                    PathOfAttraction.styles();
                    if (getStoredValue(HHStoredVarPrefixKey+SK.showClubButtonInPoa) === "true")
                    {
                        PathOfAttraction.run = callItOnce(PathOfAttraction.run);
                        PathOfAttraction.run();
                    }
                }

                if (EventModule.getEvent(eventID).isDPEvent && DoublePenetration.isEnabled())
                {
                    DoublePenetration.run  = callItOnce(DoublePenetration.run);
                    DoublePenetration.run();
                }

                if (EventModule.getEvent(eventID).isLivelyScene && LivelyScene.isEnabled())
                {
                    LivelyScene.run = callItOnce(LivelyScene.run);
                    LivelyScene.run();
                }
            }
            break;
        case ConfigHelper.getHHScriptVars("pagesIDBossBang"):
            if (getStoredValue(HHStoredVarPrefixKey+SK.bossBangEvent) === "true")
            {
                setTimeout(BossBang.skipFightPage, randomInterval(500,1500));
            }
            break;
        case ConfigHelper.getHHScriptVars("pagesIDPoA"):
            if (getStoredValue(HHStoredVarPrefixKey +SK.AllMaskRewards) === "true")
            {
                setTimeout(PathOfAttraction.runOld,500);
            }
            break;
        case ConfigHelper.getHHScriptVars("pagesIDPowerplacemain"):
            PlaceOfPower.moduleDisplayPopID();
            break;
        case ConfigHelper.getHHScriptVars("pagesIDDailyGoals"):
            DailyGoals.parse = callItOnce(DailyGoals.parse);
            setTimeout(DailyGoals.parse, 500);
            break;
        case ConfigHelper.getHHScriptVars("pagesIDMissions"):
            DailyGoals.parse = callItOnce(DailyGoals.parse);
            setTimeout(DailyGoals.parse, 500);
            break;
        case ConfigHelper.getHHScriptVars("pagesIDShop"):
            if (getStoredValue(HHStoredVarPrefixKey+SK.showMarketTools) === "true")
            {
                Shop.moduleShopActions();
            }
            if(Booster.needBoosterStatusFromStore()) {
                Booster.collectBoostersFromMarket = callItOnce(Booster.collectBoostersFromMarket);
                setTimeout(Booster.collectBoostersFromMarket,200);
            }
            if(!Booster.hasBoosterDataFromMarket()) {
                setTimeout(() => Shop.updateShop(),300);
            }
            break;
        case ConfigHelper.getHHScriptVars("pagesIDHome"):
            setTimeout(Season.displayRemainingTime,500);
            setTimeout(PathOfValue.displayRemainingTime,500);
            setTimeout(PathOfGlory.displayRemainingTime,500);
            EventModule.showCompletedEvent = callItOnce(EventModule.showCompletedEvent);
            setTimeout(EventModule.showCompletedEvent,500);
            Spreadsheet.run = callItOnce(Spreadsheet.run);
            Spreadsheet.run();
            BlessingService.loadIfExpired();
            DailyGoalsIcon.styles()

            Harem.clearHaremToolVariables = callItOnce(Harem.clearHaremToolVariables); // Avoid wired loop, if user reach home page, ensure temp var from harem are cleared
            Harem.clearHaremToolVariables();

            AdsService.closeHomeAds();

/*
            if ($('#no_HC close:visible').length) {
                setTimeout(() => {
                    $('#no_HC close:visible').trigger('click')
                }, randomInterval(3000, 5000));
            }*/
            break;
        case ConfigHelper.getHHScriptVars("pagesIDHarem"):
            Harem.moduleHarem();
            Harem.run = callItOnce(Harem.run);
            ctx.busy = await Harem.run();
            break;
        case ConfigHelper.getHHScriptVars("pagesIDGirlPage"):
            HaremGirl.moduleHaremGirl = callItOnce(HaremGirl.moduleHaremGirl);
            HaremGirl.moduleHaremGirl();
            HaremGirl.showSkillButtons();
            HaremGirl.run = callItOnce(HaremGirl.run);
            ctx.busy = await HaremGirl.run();
            break;
        case ConfigHelper.getHHScriptVars("pagesIDPachinko"):
            Pachinko.modulePachinko();
            break;
        case ConfigHelper.getHHScriptVars("pagesIDEditTeam"):
            TeamModule.moduleChangeTeam();
            Harem.moduleHaremExportGirlsData();
            Harem.moduleHaremCountMax();
            break;
        case ConfigHelper.getHHScriptVars("pagesIDBattleTeams"):
            TeamModule.moduleEquipTeam();
            Harem.moduleHaremExportGirlsData();
            Harem.moduleHaremCountMax();
            break;
        case ConfigHelper.getHHScriptVars("pagesIDWaifu"):
            Harem.moduleHaremExportGirlsData();
            Harem.moduleHaremCountMax();
            Harem.run = callItOnce(Harem.run);
            ctx.busy = await Harem.run();
            break;
        case ConfigHelper.getHHScriptVars("pagesIDContests"):
            DailyGoals.parse = callItOnce(DailyGoals.parse);
            setTimeout(DailyGoals.parse, 500);
            if (getTimer('nextContestTime') === -1) {
                Contest.setTimers = callItOnce(Contest.setTimers);
                Contest.setTimers();
            }
            break;
        case ConfigHelper.getHHScriptVars("pagesIDPoV"):
            if (getStoredValue(HHStoredVarPrefixKey +SK.AllMaskRewards) === "true")
            {
                PathOfValue.maskReward();
            }
            PathOfValue.getRemainingTime = callItOnce(PathOfValue.getRemainingTime);
            PathOfValue.getRemainingTime();
            if (getStoredValue(HHStoredVarPrefixKey+SK.showRewardsRecap) === "true")
            {
                RewardHelper.displayRewardsPovPogDiv();
            }
            break;
        case ConfigHelper.getHHScriptVars("pagesIDPoG"):
            if (getStoredValue(HHStoredVarPrefixKey +SK.AllMaskRewards) === "true")
            {
                PathOfGlory.maskReward();
            }
            PathOfGlory.getRemainingTime = callItOnce(PathOfGlory.getRemainingTime);
            PathOfGlory.getRemainingTime();
            if (getStoredValue(HHStoredVarPrefixKey+SK.showRewardsRecap) === "true")
            {
                RewardHelper.displayRewardsPovPogDiv();
            }
            break;
        case ConfigHelper.getHHScriptVars("pagesIDSeasonalEvent"):
            SeasonalEvent.styles();

            SeasonalEvent.getRemainingTime = callItOnce(SeasonalEvent.getRemainingTime);
            SeasonalEvent.getRemainingTime();
            break;
        case ConfigHelper.getHHScriptVars("pagesIDChampionsMap"):
            if (getStoredValue(HHStoredVarPrefixKey+SK.autoChamps) ==="true") {
                Champion.findNextChamptionTime = callItOnce(Champion.findNextChamptionTime);
                setTimeout(Champion.findNextChamptionTime,500);
            }
            break;
        case ConfigHelper.getHHScriptVars("pagesIDChampionsPage"):
            Champion.moduleSimChampions();
            break;
        case ConfigHelper.getHHScriptVars("pagesIDClubChampion"):
            Champion.moduleSimChampions();
            ClubChampion.resetTimerIfNeeded = callItOnce(ClubChampion.resetTimerIfNeeded);
            ClubChampion.resetTimerIfNeeded();
            break;
        case ConfigHelper.getHHScriptVars("pagesIDQuest"):
            const haremItem = getStoredValue(HHStoredVarPrefixKey+TK.haremGirlActions);
            const haremGirlMode = getStoredValue(HHStoredVarPrefixKey+TK.haremGirlMode);
            if(haremGirlMode && haremItem === HaremGirl.AFFECTION_TYPE) {
                HaremGirl.payGirlQuest = callItOnce(HaremGirl.payGirlQuest);
                ctx.busy = HaremGirl.payGirlQuest();
            }
            break;
        case ConfigHelper.getHHScriptVars("pagesIDClub"):
            Club.run();
            break;
        case ConfigHelper.getHHScriptVars("pagesIDLoveRaid"):
            LoveRaidManager.styles = callItOnce(LoveRaidManager.styles);
            LoveRaidManager.styles();
            if (checkTimer('nextLoveRaidTime')) {
                LoveRaidManager.parse = callItOnce(LoveRaidManager.parse);
                LoveRaidManager.parse();
            }
            break;
        case ConfigHelper.getHHScriptVars("pagesIDLabyrinth"):
            if (getStoredValue(HHStoredVarPrefixKey+SK.showCalculatePower) === "true")
            {
                Labyrinth.sim();
            }
            break;
        case ConfigHelper.getHHScriptVars("pagesIDEditLabyrinthTeam"):
            Labyrinth.moduleBuildTeam = callItOnce(Labyrinth.moduleBuildTeam);
            Labyrinth.moduleBuildTeam();
            break;
    }
}
