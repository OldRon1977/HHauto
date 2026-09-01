// AutoLoopActions.ts
//
// What is left of the old action-handler file: the shared predicate
// `wouldFightWithPower`. The handlers themselves live in Pipeline.config.ts.
//
// Used by: Pipeline.config.ts (handleTrollBattle's wait-marker branch)
import { LoveRaidManager } from "../Module/Events/LoveRaidManager";
import { getStoredValue } from "../Helper/StorageHelper";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK } from "../config/StorageKeys";
import { EventGirl } from '../model/EventGirl';
import { LoveRaid } from '../model/LoveRaid';

// ---------------------------------------------------------------------------
//  Standard handler utility – reduces boilerplate for simple module handlers
// ---------------------------------------------------------------------------

/**
 * Executes a standard module handler if all preconditions are met.
 * Handles the common pattern: check busy → check autoLoop → check competition
 * → check lastAction → check isReady → log → execute → update busy & lastAction.
 */

// ---------------------------------------------------------------------------
//  Action handlers – called in order from autoLoop()
// ---------------------------------------------------------------------------

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

