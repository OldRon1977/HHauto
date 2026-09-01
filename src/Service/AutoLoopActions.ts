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

// handleMythicWave does nothing. Its only effect was to set
// ctx.lastActionPerformed = "troll" in the same tick, to grant handleTrollBattle
// a slot reservation. The scheduler picks one handler per tick, so the
// reservation has no destination, and handleTrollBattle's own gate accepts
// lastActionPerformed = "none". The export is kept for external callers.
export async function handleMythicWave(_ctx: AutoLoopContext): Promise<void> {
    return;
}

// Every other action handler lives in Pipeline.config.ts; what remains here are
// the helpers those handlers share.

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
 * (spec/Service/AutoLoopActions.wouldFightWithPower.spec.ts, 9 cases) and
 * a wait-marker spec (spec/Service/AutoLoopActions.trollWaitForEnergy.spec.ts,
 * 3 cases). New paths must be added to both specs. The lessons file
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

