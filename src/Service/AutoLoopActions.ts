// AutoLoopActions.ts
//
// Contains all discrete action handlers called by the AutoLoop. Each
// handler checks whether its preconditions are met (feature enabled,
// timer expired, energy available, not busy) and if so, triggers the
// corresponding module action and marks the loop as busy.
//
// Handlers are executed in a fixed priority order defined in AutoLoop.ts.
// Only one action fires per loop iteration (once ctx.busy is true, all
// subsequent handlers skip). This serialization prevents conflicting
// navigation and ensures the game page is in a known state.
//
// Handler naming convention: handle<Feature>(ctx) where ctx is the
// shared AutoLoopContext carrying busy state, event data, and energy.
//
// Used by: AutoLoop.autoLoop()

import { AutoLoopContext } from './AutoLoopContext';
import { ModuleHandlerDescriptor } from '../model/IModule';
import { shouldRunStandardHandler } from './AutoLoop.pure';
import { LoveRaidManager } from "../Module/Events/LoveRaidManager";
import { getStoredValue } from "../Helper/StorageHelper";
import { logHHAuto } from "../Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK } from "../config/StorageKeys";
import { EventGirl } from '../model/EventGirl';
import { LoveRaid } from '../model/LoveRaid';
import { isAutoLoopActive } from './AutoLoop';

// ---------------------------------------------------------------------------
//  Standard handler utility – reduces boilerplate for simple module handlers
// ---------------------------------------------------------------------------

/**
 * Executes a standard module handler if all preconditions are met.
 * Handles the common pattern: check busy → check autoLoop → check competition
 * → check lastAction → check isReady → log → execute → update busy & lastAction.
 */
export async function runStandardHandler(ctx: AutoLoopContext, d: ModuleHandlerDescriptor): Promise<void> {
    const shouldRun = shouldRunStandardHandler({
        ctxBusy: ctx.busy,
        autoLoopActive: isAutoLoopActive(),
        competitionActive: ctx.canCollectCompetitionActive,
        lastActionPerformed: ctx.lastActionPerformed,
        requiresAutoLoop: d.requiresAutoLoop,
        requiresCompetition: d.requiresCompetition,
        handlerAction: d.action,
        isReady: d.isReady(),
    });
    if (!shouldRun) return;

    logHHAuto(d.name);
    const result = await d.execute();
    ctx.busy = typeof result === 'boolean' ? result : true;
    ctx.lastActionPerformed = d.action;
}

// ---------------------------------------------------------------------------
//  Action handlers – called in order from autoLoop()
// ---------------------------------------------------------------------------

// handleMythicWave: deprecated since 3.2.G.complete. Its only effect was to
// set ctx.lastActionPerformed = "troll" in the same tick to grant
// handleTrollBattle the slot reservation. In the pipeline model the scheduler
// picks one handler per tick, so the reservation has no destination -- and
// handleTrollBattle's own gate already accepts lastActionPerformed = "none".
// Kept as exported function for any external caller, slated for removal in
// v7.37.0.
export async function handleMythicWave(_ctx: AutoLoopContext): Promise<void> {
    return;
}

// handleShop, handleAutoEquipBoosters: migrated to Pipeline.config.ts in 3.2.G.a.

// 4. handleHaremSize - lines 276-288
// handleHaremSize: migrated to Pipeline.config.ts in 3.2.G.complete.


// 5. handlePlaceOfPower - lines 290-344
// handlePlaceOfPower: migrated to Pipeline.config.ts in 3.2.G.complete.


// 6. handleGenericBattle - lines 346-363
// handleGenericBattle: migrated to Pipeline.config.ts in 3.2.G.complete.


// handleLoveRaid: migrated to Pipeline.config.ts in 3.2.G.b.

// 8. handleTrollBattle - lines 374-462 (includes the outer if-block and the else at 459-462)
// handleTrollBattle: migrated to Pipeline.config.ts in 3.2.G.complete.


/**
 * Pure helper: would handleTrollBattle have fired a fight if combativity were
 * available? Mirrors the activation paths in the main if-block, but without
 * the power/buy checks. Used by the wait-marker branch in handleTrollBattle
 * to detect "only blocker is power=0" situations.
 *
 * Returns true if any of the following holds:
 * - autoTrollBattle is on (would fight last unlocked troll once power > 0)
 * - plusEventMythic is on AND a mythic event girl is currently parsed
 * - plusEvent is on AND a non-mythic event girl is currently parsed
 * - a raid stars raid with id_girl exists AND plusLoveRaid is on
 * - a user-selected LoveRaid with id_girl exists
 *
 * MAINTENANCE -- KEEP IN SYNC WITH handleTrollBattle:
 *
 * Whenever the OR-disjunction in handleTrollBattle gains, drops or refines
 * an activation path, this helper MUST mirror the change. If they drift,
 * the wait-marker either fires too often (blocking event-parsing without
 * cause) or too rarely (the issue #1700 ping-pong returns).
 *
 * Before editing handleTrollBattle's activation block:
 *
 *   git grep -n "wouldFightWithPower\|isTrollFightActivated" src/
 *
 * The activation paths are guarded by a Pure-spec
 * (spec/Service/AutoLoopActions.wouldFightWithPower.spec.ts, 13 cases) and
 * a wait-marker spec (spec/Service/AutoLoopActions.trollWaitForEnergy.spec.ts,
 * 5 cases). New paths must be added to both specs. The lessons file
 * c:\Users\StephanMesser\.kiro\Arbeitsplatz\.kiro\steering\_lessons\
 * mapping-fix-vollstaendig-pruefen.md captures the cost of skipping this
 * pruning step.
 */
export function wouldFightWithPower(
    eventGirl: EventGirl,
    eventMythicGirl: EventGirl,
    raidStarsRaid: LoveRaid | undefined,
    loveRaid: LoveRaid | undefined,
): boolean {
    const autoTrollOn = getStoredValue(HHStoredVarPrefixKey + SK.autoTrollBattle) === "true";
    const mythicEventReady = Boolean(eventMythicGirl?.girl_id) && eventMythicGirl?.is_mythic === true
        && getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythic) === "true";
    const eventReady = Boolean(eventGirl?.girl_id) && eventGirl?.is_mythic !== true
        && getStoredValue(HHStoredVarPrefixKey + SK.plusEvent) === "true";
    const raidStarsReady = Boolean(raidStarsRaid?.id_girl)
        && getStoredValue(HHStoredVarPrefixKey + SK.plusLoveRaid) === "true";
    const loveRaidReady = LoveRaidManager.isActivated() && Boolean(loveRaid?.id_girl);
    return autoTrollOn || mythicEventReady || eventReady || raidStarsReady || loveRaidReady;
}

// 9. handlePachinko - lines 465-487 (all 3 pachinko types)
// handlePachinko: migrated to Pipeline.config.ts in 3.2.G.complete.


// handleContest: migrated to Pipeline.config.ts in 3.2.G.b.

// handleMissions: migrated to Pipeline.config.ts in 3.2.G.b.

// 12. handleQuest - lines 509-663 (includes the else-if at 660-663)
// handleQuest: migrated to Pipeline.config.ts in 3.2.G.complete.


// 14. handleSeason - lines 699-724
// handleSeason: migrated to Pipeline.config.ts in 3.2.G.complete.


// 15. handlePentaDrill - lines 726-753
// handlePentaDrill: migrated to Pipeline.config.ts in 3.2.G.complete.


// 16. handlePantheon - lines 755-784
// handlePantheon: migrated to Pipeline.config.ts in 3.2.G.complete.


// 17. handleChampionTicket - lines 786-810 (includes the nested buyTicket function)
// handleChampionTicket: migrated to Pipeline.config.ts in 3.2.G.complete.


// handleChampion: migrated to Pipeline.config.ts in 3.2.G.b.

// handleClubChampion: migrated to Pipeline.config.ts in 3.2.G.b.

// 20. handleSeasonCollect - lines 828-841
// handleSeasonCollect: migrated to Pipeline.config.ts in 3.2.G.complete.


// 21. handlePentaDrillCollect - lines 843-855
// handlePentaDrillCollect: migrated to Pipeline.config.ts in 3.2.G.complete.


// handleSeasonalFreeCard: migrated to Pipeline.config.ts in 3.2.G.b.

// 23. handleSeasonalEventCollect - lines 867-879
// handleSeasonalEventCollect: migrated to Pipeline.config.ts in 3.2.G.complete.


// handleSeasonalRankCollect: migrated to Pipeline.config.ts in 3.2.G.b.

// 25. handlePoVCollect - lines 892-905
// handlePoVCollect: migrated to Pipeline.config.ts in 3.2.G.complete.


// 26. handlePoGCollect - lines 907-920
// handlePoGCollect: migrated to Pipeline.config.ts in 3.2.G.complete.


// handleFreeBundles: migrated to Pipeline.config.ts in 3.2.G.b.

// handleDailyGoals: migrated to Pipeline.config.ts in 3.2.G.b.

// handleLabyrinth: migrated to Pipeline.config.ts in 3.2.G.b.

// 30. handleSalary - lines 948-958
// handleSalary: migrated to Pipeline.config.ts in 3.2.G.complete.


// 31. handleBossBangParse - lines 960-980
// handleBossBangParse: migrated to Pipeline.config.ts in 3.2.G.complete.


// 32. handleBossBangFight - lines 982-1002
// handleBossBangFight: migrated to Pipeline.config.ts in 3.2.G.complete.


// 33. handleGoHome - lines 1004-1016
// handleGoHome: migrated to Pipeline.config.ts in 3.2.G.complete.

