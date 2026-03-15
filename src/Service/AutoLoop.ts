// AutoLoop.ts
//
// The main automation loop that drives all periodic actions. Runs on
// a configurable interval (default ~1 second) via setTimeout recursion.
//
// Each iteration:
//   1. Checks if "burst" mode is active (master switch on, not in
//      paranoia rest, menu not open)
//   2. If active, runs through all action handlers in priority order
//      (defined in AutoLoopActions.ts). Only one action fires per
//      iteration to prevent conflicting navigations.
//   3. Runs page-specific UI handlers regardless of burst state
//   4. Manages paranoia flip if enabled
//   5. Schedules the next iteration
//
// Also tracks energy spending across iterations (CheckSpentPoints)
// to detect when the player manually buys energy, which resets the
// corresponding cooldown timer.
//
// Used by: StartService (initial call), self (recursive setTimeout)

import {
    TimeHelper,
    checkTimer,
    clearTimer,
    ConfigHelper,
    getPage,
    getStoredValue,
    getStoredJSON,
    setStoredValue,
    switchHHMenuButton,
    HeroHelper
} from '../Helper/index';
import { PentaDrill } from '../Module/PentaDrill';
import {
    Contest,
    EventModule,
    LeagueHelper,
    Pantheon,
    QuestHelper,
    Season,
    Troll
} from '../Module/index';
import {
    callItOnce,
    checkAndClosePopup,
    logHHAuto,
} from '../Utils/index';
import {
    HHStoredVarPrefixKey,
    SK,
    TK
} from '../config/index';
import {
    mouseBusy,
    ParanoiaService,
    setDefaults,
    updateData,
} from "./index";
import { AutoLoopContext } from './AutoLoopContext';
import {
    handleEventParsing,
    handleMythicWave,
    handleShop,
    handleAutoEquipBoosters,
    handleHaremSize,
    handlePlaceOfPower,
    handleGenericBattle,
    handleLoveRaid,
    handleTrollBattle,
    handlePachinko,
    handleContest,
    handleMissions,
    handleQuest,
    handleLeague,
    handleSeason,
    handlePentaDrill,
    handlePantheon,
    handleChampionTicket,
    handleChampion,
    handleClubChampion,
    handleSeasonCollect,
    handlePentaDrillCollect,
    handleSeasonalFreeCard,
    handleSeasonalEventCollect,
    handleSeasonalRankCollect,
    handlePoVCollect,
    handlePoGCollect,
    handleFreeBundles,
    handleDailyGoals,
    handleLabyrinth,
    handleSalary,
    handleBossBangParse,
    handleBossBangFight,
    handleGoHome,
} from './AutoLoopActions';
import { handlePageSpecific } from './AutoLoopPageHandlers';

export let busy = false;


export function getBurst()
{
    const sMenu = document.getElementById('sMenu');
    if (sMenu != null)
    {
        if (sMenu.style.display!=='none' )// && !document.getElementById("DebugDialog").open)
        {
            return false;
        }
    }
    if ($('#contains_all>nav>[rel=content]').length >0)
    {
        if ($('#contains_all>nav>[rel=content]')[0].style.display === "block")// && !document.getElementById("DebugDialog").open)
        {
            return false;
        }
    }
    return getStoredValue(HHStoredVarPrefixKey+SK.master) ==="true"&&(!(getStoredValue(HHStoredVarPrefixKey+SK.paranoia) ==="true") || getStoredValue(HHStoredVarPrefixKey+TK.burst) ==="true");
}


export function CheckSpentPoints()
{
    let oldValues=getStoredJSON(HHStoredVarPrefixKey+TK.CheckSpentPoints, -1);
    let newValues={};
    if (ConfigHelper.getHHScriptVars('isEnabledTrollBattle',false))
    {
        newValues['fight']=Troll.getEnergy();
    }
    if (ConfigHelper.getHHScriptVars('isEnabledSeason',false))
    {
        newValues['kiss']=Season.getEnergy();
    }
    if (ConfigHelper.getHHScriptVars('isEnabledQuest',false))
    {
        newValues['quest']=QuestHelper.getEnergy();
    }
    if (ConfigHelper.getHHScriptVars('isEnabledLeagues',false))
    {
        newValues['challenge']=LeagueHelper.getEnergy();
    }
    if (ConfigHelper.getHHScriptVars('isEnabledPantheon',false))
    {
        newValues['worship']=Pantheon.getEnergy();
    }
    if (ConfigHelper.getHHScriptVars('isEnabledPentaDrill',false))
    {
        newValues['drill']=PentaDrill.getEnergy();
    }

    if ( oldValues !== -1)
    {
        let spent= {};
        let hasSpend = false;

        for (let i of Object.keys(newValues))
        {
            //console.log(i);
            if (oldValues[i]-newValues[i] >0)
            {
                spent[i]=oldValues[i]-newValues[i];
                ParanoiaService.updatedParanoiaSpendings(i, spent[i]);
            }

        }
        setStoredValue(HHStoredVarPrefixKey+TK.CheckSpentPoints, JSON.stringify(newValues));

        if (ConfigHelper.getHHScriptVars('isEnabledLeagues',false) && newValues['challenge'] > (oldValues['challenge'] +1))
        {
            logHHAuto("Seems league point bought, resetting timer.");
            clearTimer('nextLeaguesTime');
        }
        if (ConfigHelper.getHHScriptVars('isEnabledSeason',false) && newValues['kiss'] > (oldValues['kiss'] +1))
        {
            logHHAuto("Seems season point bought, resetting timer.");
            clearTimer('nextSeasonTime');
        }
        if (ConfigHelper.getHHScriptVars('isEnabledPantheon',false) && newValues['worship'] > (oldValues['worship'] +1))
        {
            logHHAuto("Seems Pantheon point bought, resetting timer.");
            clearTimer('nextPantheonTime');
        }
        if (ConfigHelper.getHHScriptVars('isEnabledPentaDrill',false) && newValues['drill'] > (oldValues['drill'] +1))
        {
            logHHAuto("Seems Penta Drill point bought, resetting timer.");
            clearTimer('nextPentaDrillTime');
        }
    }
    else
    {
        setStoredValue(HHStoredVarPrefixKey+TK.CheckSpentPoints, JSON.stringify(newValues));
    }
}

export function isAutoLoopActive(): boolean{
    return getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) === "true";
}

export async function autoLoop()
{
    updateData();
    if (getStoredValue(HHStoredVarPrefixKey+TK.questRequirement) === undefined)
    {
        setStoredValue(HHStoredVarPrefixKey+TK.questRequirement, "none");
    }
    if (getStoredValue(HHStoredVarPrefixKey+TK.battlePowerRequired) === undefined)
    {
        setStoredValue(HHStoredVarPrefixKey+TK.battlePowerRequired, "0");
    }

    //var busy = false;
    busy = false;
    var page = window.location.href;
    var currentPower = Troll.getEnergy();

    var burst=getBurst();
    switchHHMenuButton(burst);
    //console.log("burst : "+burst);
    checkAndClosePopup(burst);
    let lastActionPerformed = getStoredValue(HHStoredVarPrefixKey+TK.lastActionPerformed);

    // Create shared context for action handlers
    const ctx: AutoLoopContext = {
        busy: false,
        lastActionPerformed: lastActionPerformed,
        eventParsed: null,
        currentPower: currentPower,
        canCollectCompetitionActive: false,
        eventIDs: [],
        bossBangEventIDs: [],
        currentPage: getPage(),
    };

    if (burst && !mouseBusy /*|| checkTimer('nextMissionTime')*/)
    {

        if (!checkTimer("paranoiaSwitch") )
        {
            ParanoiaService.clearParanoiaSpendings();
        }
        CheckSpentPoints();
        if (getStoredValue(HHStoredVarPrefixKey + SK.waitforContest) === "true" && checkTimer('nextContestTime')) {
            Contest.setTimers = callItOnce(Contest.setTimers);
            ctx.busy = Contest.setTimers();
        }
        ctx.canCollectCompetitionActive = TimeHelper.canCollectCompetitionActive();

        //check what happen to timer if no more wave before uncommenting
        /*if (getStoredValue(HHStoredVarPrefixKey+SK.plusEventMythic) ==="true" && checkTimerMustExist('eventMythicNextWave'))
        {
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
        }
        */
        //logHHAuto("lastActionPerformed " + lastActionPerformed);

        //if a new event is detected
        const {eventIDs, bossBangEventIDs} = EventModule.parsePageForEventId();
        ctx.eventIDs = eventIDs;
        ctx.bossBangEventIDs = bossBangEventIDs;

        // --- Action Handlers (executed in order, each checks ctx.busy) ---
        await handleEventParsing(ctx);
        await handleMythicWave(ctx);
        await handleShop(ctx);
        await handleAutoEquipBoosters(ctx);
        await handleHaremSize(ctx);
        await handlePlaceOfPower(ctx);
        await handleGenericBattle(ctx);
        await handleLoveRaid(ctx);
        await handleTrollBattle(ctx);
        await handlePachinko(ctx);
        await handleContest(ctx);
        await handleMissions(ctx);
        await handleQuest(ctx);
        await handleLeague(ctx);
        await handleSeason(ctx);
        await handlePentaDrill(ctx);
        await handlePantheon(ctx);
        await handleChampionTicket(ctx);
        await handleChampion(ctx);
        await handleClubChampion(ctx);
        await handleSeasonCollect(ctx);
        await handlePentaDrillCollect(ctx);
        await handleSeasonalFreeCard(ctx);
        await handleSeasonalEventCollect(ctx);
        await handleSeasonalRankCollect(ctx);
        await handlePoVCollect(ctx);
        await handlePoGCollect(ctx);
        await handleFreeBundles(ctx);
        await handleDailyGoals(ctx);
        await handleLabyrinth(ctx);
        await handleSalary(ctx);
        await handleBossBangParse(ctx);
        await handleBossBangFight(ctx);
        await handleGoHome(ctx);
    }

    // --- Page-specific UI handlers ---
    await handlePageSpecific(ctx);

    // Sync context back to module-level busy
    busy = ctx.busy;

    if (busy === false && !mouseBusy && getStoredValue(HHStoredVarPrefixKey + SK.paranoia) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.master) === "true" && isAutoLoopActive()) {
        if (checkTimer("paranoiaSwitch")) {
            ParanoiaService.flipParanoia();
        }
    }

    if (busy === false && burst && !mouseBusy && ctx.lastActionPerformed != "none") {
        ctx.lastActionPerformed = "none";
        // logHHAuto("no action performed in this loop, rest lastActionPerformed");
    }
    if (ctx.lastActionPerformed != getStoredValue(HHStoredVarPrefixKey + TK.lastActionPerformed)) {
        logHHAuto("lastActionPerformed changed to " + ctx.lastActionPerformed);
    }
    setStoredValue(HHStoredVarPrefixKey + TK.lastActionPerformed, ctx.lastActionPerformed);


    if(isNaN(getStoredValue(HHStoredVarPrefixKey+TK.autoLoopTimeMili)))
    {
        logHHAuto("AutoLoopTimeMili is not a number.");
        setDefaults(true);
    }
    else if (isAutoLoopActive())
    {
        setTimeout(autoLoop, Number(getStoredValue(HHStoredVarPrefixKey+TK.autoLoopTimeMili)));
    }
    else
    {
        logHHAuto("autoLoop Disabled");
    }

}
