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
import { ConfigHelper } from "../Helper/ConfigHelper";
import { switchHHMenuButton } from "../Helper/HHMenuHelper";
import { getPage } from "../Helper/PageHelper";
import { getStoredValue, getStoredJSON, setStoredValue } from "../Helper/StorageHelper";
import { TimeHelper } from "../Helper/TimeHelper";
import { checkTimer, clearTimer } from "../Helper/TimerHelper";
import { PentaDrill } from '../Module/PentaDrill';
import { Contest } from "../Module/Contest";
import { EventModule } from "../Module/Events/EventModule";
import { Season } from "../Module/Events/Season";
import { LeagueHelper } from "../Module/League";
import { Pantheon } from "../Module/Pantheon";
import { QuestHelper } from "../Module/Quest";
import { Troll } from "../Module/Troll";
import { checkAndClosePopup } from "../Utils/HHPopup";
import { logHHAuto } from "../Utils/LogUtils";
import { callItOnce } from "../Utils/Utils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK, TK } from "../config/StorageKeys";
import { updateData } from "./InfoService";
import { isUserPauseActive } from "./MouseService";
import { isPostInFlight } from './AjaxTracker';
import { ParanoiaService } from "./ParanoiaService";
import { setDefaults } from "./StartService";
import { AutoLoopContext } from './AutoLoopContext';
import {
} from './AutoLoopActions';
import { decideBurst } from './AutoLoop.pure';
import { handlePageSpecific } from './AutoLoopPageHandlers';


export function getBurst()
{
    const sMenu = document.getElementById('sMenu');
    const sMenuVisible = sMenu != null && sMenu.style.display !== 'none';

    const $navContent = $('#contains_all>nav>[rel=content]');
    const navContentBlock = $navContent.length > 0 && ($navContent[0] as HTMLElement).style.display === 'block';

    return decideBurst({
        sMenuVisible,
        navContentBlock,
        master: getStoredValue(HHStoredVarPrefixKey + SK.master) === "true",
        paranoia: getStoredValue(HHStoredVarPrefixKey + SK.paranoia) === "true",
        burst: getStoredValue(HHStoredVarPrefixKey + TK.burst) === "true",
    });
}


export function CheckSpentPoints()
{
    const oldValues=getStoredJSON<any>(HHStoredVarPrefixKey+TK.CheckSpentPoints, -1);
    const newValues: Record<string, number> = {};
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
        const spent: Record<string, number> = {};

        for (const i of Object.keys(newValues))
        {
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

// Block-scheduler tick is injected from the boot path (index.ts) instead of a
// static import, to avoid an AutoLoop->BlockPipeline->Pipeline.config->...->
// AutoLoop import cycle (lesson zirkulaerer-import-tdz-crash). Same pattern as
// setPachinkoAutoLoopKick.
let blockTick: ((ctx: AutoLoopContext) => Promise<void>) | null = null;
export function setBlockTick(fn: (ctx: AutoLoopContext) => Promise<void>): void {
    blockTick = fn;
}

// Throttle for the mouse-pause log so the polled gate does not flood the log.
let lastMousePauseLog = 0;

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

    const currentPower = Troll.getEnergy();

    var burst=getBurst();
    switchHHMenuButton(burst);
    checkAndClosePopup(burst);
    const lastActionPerformed = getStoredValue(HHStoredVarPrefixKey+TK.lastActionPerformed);

    // Create shared context for action handlers
    const ctx: AutoLoopContext = {
        busy: false,
        lastActionPerformed: lastActionPerformed,
        currentPower: currentPower,
        canCollectCompetitionActive: false,
        eventIDs: [],
        bossBangEventIDs: [],
        currentPage: getPage(),
    };

    const userPaused = isUserPauseActive();
    if (burst && userPaused && Date.now() - lastMousePauseLog >= 2000) {
        lastMousePauseLog = Date.now();
        logHHAuto("Mouse pause active, holding automation.");
    }
    if (burst && !userPaused /*|| checkTimer('nextMissionTime')*/)
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

        //if a new event is detected
        const {eventIDs, bossBangEventIDs} = EventModule.parsePageForEventId();
        ctx.eventIDs = eventIDs;
        ctx.bossBangEventIDs = bossBangEventIDs;

        // Skip the action handlers while a POST is in flight (#1598,
        // docs/decisions/ADR-003-ajax-post-mutex.md): they are state-changing
        // POST sources such as PoP claim, BossBang fight, Champion reorder
        // etc.) while a /ajax.php POST is still in flight or another
        // caller holds the explicit mutex. UI updates and page-specific
        // handlers below keep running so the script stays responsive
        // (issue #1598 follow-up: an earlier patch gated the whole
        // autoLoop tick and starved the menu UI).
        if (isPostInFlight()) {
            logHHAuto('AutoLoop: POST in flight, deferring action handlers this tick');
        } else {
        // --- Scheduler Pipeline (every action handler runs here) ---
        // Only trigger the scheduler when no classic action handler has
        // already started an action this tick. Without this gate the
        // pipeline runs preconditions and step.fn even when the
        // navigation mutex in PageNavigationService will swallow the
        // resulting gotoPage / safeReload call. The gate also prevents
        // lastRunAt from being bumped on a tick where no real work was
        // possible, which kept the cool-down counting from a wasted run.
        if (!ctx.busy && blockTick) {
            await blockTick(ctx);
        }
        }
    }

    // --- Page-specific UI handlers ---
    await handlePageSpecific(ctx);

    if (ctx.busy === false && !isUserPauseActive() && getStoredValue(HHStoredVarPrefixKey + SK.paranoia) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.master) === "true" && isAutoLoopActive()) {
        if (checkTimer("paranoiaSwitch")) {
            ParanoiaService.flipParanoia();
        }
    }

    if (ctx.busy === false && burst && !isUserPauseActive() && ctx.lastActionPerformed !== "none") {
        ctx.lastActionPerformed = "none";
    }
    if (ctx.lastActionPerformed !== getStoredValue(HHStoredVarPrefixKey + TK.lastActionPerformed)) {
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
