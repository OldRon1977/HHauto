// Pipeline.config.ts -- Declarative pipeline configuration for the Scheduler.
//
// Defines the types and interfaces for handler configurations,
// plus concrete handler entries for migrated handlers.
//
// Order of handler execution is given by the position in the `pipeline`
// array below: first element runs first. Reordering = move a line.
//
// Used by: Scheduler.ts
import { LeagueHelper } from "../Module/League";
import { EventModule } from "../Module/Events/EventModule";
import { Shop } from "../Module/Shop";
import { Booster } from "../Module/Booster";
import { LoveRaidManager } from "../Module/Events/LoveRaidManager";
import { Contest } from "../Module/Contest";
import { Missions } from "../Module/Missions";
import { Champion } from "../Module/Champion";
import { ClubChampion } from "../Module/ClubChampion";
import { SeasonalEvent } from "../Module/Events/Seasonal";
import { Bundles } from "../Module/Bundles";
import { DailyGoals } from "../Module/DailyGoals";
import { Labyrinth } from "../Module/Labyrinth";
import { LabyrinthAuto } from "../Module/LabyrinthAuto";
import { Harem } from "../Module/harem/Harem";
import { HaremSalary } from "../Module/harem/HaremSalary";
import { PlaceOfPower } from "../Module/PlaceOfPower";
import { GenericBattle } from "../Module/GenericBattle";
import { Troll } from "../Module/Troll";
import { Pachinko } from "../Module/Pachinko";
import { QuestHelper } from "../Module/Quest";
import { Season } from "../Module/Events/Season";
import { PentaDrill } from "../Module/PentaDrill";
import { Pantheon } from "../Module/Pantheon";
import { PathOfValue } from "../Module/Events/PathOfValue";
import { PathOfGlory } from "../Module/Events/PathOfGlory";
import { BossBang } from "../Module/Events/BossBang";
import { ConfigHelper } from "../Helper/ConfigHelper";
import { getHHVars } from "../Helper/HHHelper";
import { getStoredValue, setStoredValue, getStoredJSON, deleteStoredValue } from "../Helper/StorageHelper";
import { checkTimer, setTimer, getTimer, getSecondsLeft } from "../Helper/TimerHelper";
import { getLimitTimeBeforeEnd, randomInterval } from "../Helper/TimeHelper";
import { ParanoiaService } from "./ParanoiaService";
import { gotoPage } from "./PageNavigationService";
import { safeReload } from "./PageNavigationService";
import { getHHAjax } from "../Utils/Utils";
import { EventGirl } from "../model/EventGirl";
import { LoveRaid } from "../model/LoveRaid";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK, TK } from "../config/StorageKeys";
import { logHHAuto } from "../Utils/LogUtils";
import { AutoLoopContext } from "./AutoLoopContext";
import { ModuleHandlerDescriptor } from "../model/IModule";
import { shouldRunStandardHandler } from "./AutoLoop.pure";

/**
 * How a handler responds to higher-priority interrupts.
 * - 'always': can be interrupted at any point
 * - 'never': runs to completion (only SOFT-interrupt at safe points)
 */
export type InterruptPolicy = 'always' | 'never';

/**
 * Result of a single pipeline step execution.
 */
export type StepResult =
  | { ok: true }
  | { ok: false; reason: string; retryable: boolean };

/**
 * A single step in a handler's execution chain.
 */
export interface ChainStep {
  /** Human-readable step name for logging/debugging */
  name: string;
  /** Async function that performs the step. Receives the shared AutoLoop context. */
  fn: (ctx: AutoLoopContext) => Promise<StepResult>;
  /** Per-step timeout in ms (optional, defaults to totalTimeoutMs / steps.length) */
  timeoutMs?: number;
}

/**
 * Complete configuration for a pipeline handler.
 *
 * Execution order is determined by the position of this handler inside the
 * `pipeline` array. To reorder handlers, move the entry within that array.
 */
export interface HandlerConfig {
  /** Unique handler name (used as key in state maps) */
  name: string;
  /** Minimum milliseconds between two runs of this handler */
  minIntervalMs: number;
  /** If true, the entire step chain runs as an uninterruptible unit */
  atomic: boolean;
  /** How this handler responds to HARD interrupts */
  interruptible: InterruptPolicy;
  /** Skip this handler if precondition returns false. Receives the shared AutoLoop context. */
  precondition: (ctx: AutoLoopContext) => boolean;
  /** Ordered list of steps to execute */
  steps: ChainStep[];
  /** Called when a step fails (for cleanup/recovery) */
  onFailure?: (ctx: AutoLoopContext, failedStep: string, reason: string) => Promise<void>;
  /** Watchdog: max total ms for the entire chain (default: 30000) */
  totalTimeoutMs?: number;
}

/**
 * Build a HandlerConfig from a legacy ModuleHandlerDescriptor. Used to migrate
 * handlers that already wrap a uniform `name + action + isReady + execute`
 * shape (the descriptors used by `runStandardHandler` in AutoLoopActions.ts).
 *
 * The returned config is single-step, non-atomic, always-interruptible, and
 * mirrors the cascade in `runStandardHandler`:
 *   ctx.busy guard -> autoLoop guard -> competition guard -> lastActionPerformed
 *   guard -> isReady guard -> execute -> set ctx.busy / ctx.lastActionPerformed.
 *
 * The `lastActionPerformed` continuation is preserved during the v7.36.0
 * migration. v7.37.0 will replace it with a scheduler-internal multi-step
 * model (see docs-internal/REVIEW_v7.37.0_Pipeline_Architecture.md).
 */
export function fromDescriptor(
  descriptor: ModuleHandlerDescriptor,
  opts: { minIntervalMs: number; atomic?: boolean; handlerName?: string },
): HandlerConfig {
  const atomic = opts.atomic ?? false;
  // The HandlerConfig.name is the technical identifier used as map key in
  // Scheduler.lastRunAt, Scheduler.states, sessionStorage TK.pipelineLastRunAt
  // and the [Scheduler] Starting chain '...' log line. Keep it short and
  // identifier-like (e.g. 'handleMissions'). It must NOT collide with the
  // descriptor.name, which is a user-facing log message ('Time to do
  // missions.'). The user message is logged inside step.fn via descriptor.name.
  // If opts.handlerName is omitted we fall back to descriptor.action so older
  // call sites keep a stable, dot-free key.
  const handlerName = opts.handlerName ?? descriptor.action;
  return {
    name: handlerName,
    minIntervalMs: opts.minIntervalMs,
    atomic,
    interruptible: atomic ? 'never' : 'always',
    precondition: (ctx) => shouldRunStandardHandler({
      ctxBusy: ctx.busy,
      autoLoopActive: getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) === "true",
      competitionActive: ctx.canCollectCompetitionActive,
      lastActionPerformed: ctx.lastActionPerformed,
      requiresAutoLoop: descriptor.requiresAutoLoop,
      requiresCompetition: descriptor.requiresCompetition,
      handlerAction: descriptor.action,
      isReady: descriptor.isReady(),
    }),
    steps: [{
      name: descriptor.action,
      fn: async (ctx): Promise<StepResult> => {
        try {
          logHHAuto(descriptor.name);
          const result = await descriptor.execute();
          ctx.busy = typeof result === 'boolean' ? result : true;
          ctx.lastActionPerformed = descriptor.action;
          return { ok: true };
        } catch (err) {
          return { ok: false, reason: String(err), retryable: true };
        }
      },
    }],
  };
}

// ---------------------------------------------------------------------------
//  Handler: handleEventParsing
//  Non-atomic, always interruptible.
//  Wraps: EventModule.parseEventPage()
// ---------------------------------------------------------------------------

const handleEventParsing: HandlerConfig = {
  name: 'handleEventParsing',
  minIntervalMs: 2_000,
  atomic: false,
  interruptible: 'always',
  precondition: () => {
    // Events feature must be enabled
    if (ConfigHelper.getHHScriptVars('isEnabledEvents', false) !== true) return false;

    // Suppress event-page navigation while handleTrollBattle is waiting
    // for an energy refill on a path that needs the same event data
    // (issue #1700, #1708). Re-evaluating the event page every tick in
    // that state collided with handleLeague and produced the ping-pong
    // loop between event.html and leagues.html.
    if (getStoredValue(HHStoredVarPrefixKey + TK.trollWaitForEnergy) === 'true') return false;

    // Trigger only if at least one stale event exists. Otherwise the handler
    // would navigate to the event page on every tick even though the event
    // data is still fresh, which collided with handleLeague (and any other
    // navigation-triggering handler) and produced a ping-pong loop between
    // the leagues and the event pages (issue #1598, #1673).
    return getStaleEventIDs().length > 0;
  },
  steps: [
    {
      name: 'parseEvents',
      fn: async (): Promise<StepResult> => {
        try {
          // Parse the first stale event. precondition + fn must agree on the
          // selection: parsing any non-stale event would leave the original
          // stale event untouched, so the precondition would keep firing on
          // the next tick (issue #1673 -- a stale Path of Attraction entry
          // kept the loop alive while a fresh Plus Event was being reparsed
          // every tick).
          const staleIDs = getStaleEventIDs();
          if (staleIDs.length === 0) {
            return { ok: true }; // nothing to parse
          }
          await EventModule.parseEventPage(staleIDs[0]);
          return { ok: true };
        } catch (err) {
          return { ok: false, reason: String(err), retryable: true };
        }
      },
      timeoutMs: 15_000,
    },
  ],
  totalTimeoutMs: 20_000,
};

/**
 * Return the IDs of all unfinished events whose `next_refresh` is missing,
 * non-finite, or already in the past. Exported for direct unit testing in
 * Pipeline.config.spec.ts.
 *
 * On unexpected storage shape this returns a single sentinel ID so that the
 * caller still triggers a parse cycle (preserves the previous fallback
 * behaviour where the precondition returned true on parse errors).
 *
 * Expired-event side effect: entries whose `seconds_before_end` is in the
 * past are events the game no longer hosts. parseEventPage cannot refresh
 * them (the in-game tab has been replaced by a successor or removed
 * entirely), so they would stay stale forever and drive
 * handleEventParsing into a permanent reload loop (issue #1738 -- a
 * lively_scene_event_12 entry kept the bot looping for 7+ minutes before
 * the user gave up). pruneExpiredEvents() removes them from the registry
 * BEFORE this filter runs so the loop terminates and storage stays
 * bounded.
 */
export function getStaleEventIDs(now: number = Date.now()): string[] {
  try {
    const storedList = getStoredValue(HHStoredVarPrefixKey + TK.eventsList);
    const eventList = storedList ? JSON.parse(storedList) : {};
    pruneExpiredEvents(eventList, now);
    return Object.keys(eventList).filter(id => {
      const ev = eventList[id];
      if (!ev || ev.isCompleted) return false;
      const nextRefresh = Number(ev.next_refresh);
      return !Number.isFinite(nextRefresh) || nextRefresh <= now;
    });
  } catch {
    // Unexpected storage shape: pretend a parse is needed so we don't
    // accidentally skip a refresh cycle. The actual parseEventPage call
    // tolerates an empty/garbage tab via its own "global" fallback.
    return ['__parse_error__'];
  }
}

/**
 * Drop event registry entries whose game-side end has already passed
 * (`seconds_before_end <= now`). Such entries cannot be refreshed by
 * parseEventPage (the in-game tab is gone), so leaving them in the
 * registry would keep handleEventParsing.precondition firing forever
 * (issue #1738).
 *
 * Mutates the input map AND persists the pruned shape so the next
 * read sees the cleaned state. Exported for direct unit testing in
 * Pipeline.config.spec.ts.
 *
 * Defensive: an entry without `seconds_before_end`, or with a
 * non-finite value, is left in place. parseEventPage handles those
 * via its existing "ERROR: No event Id found" path on the next visit.
 */
export function pruneExpiredEvents(eventList: Record<string, any>, now: number): void {
  let mutated = false;
  for (const id of Object.keys(eventList)) {
    const ev = eventList[id];
    if (!ev) continue;
    const end = Number(ev.seconds_before_end);
    if (Number.isFinite(end) && end <= now) {
      delete eventList[id];
      mutated = true;
    }
  }
  if (mutated) {
    if (Object.keys(eventList).length === 0) {
      deleteStoredValue(HHStoredVarPrefixKey + TK.eventsList);
    } else {
      setStoredValue(HHStoredVarPrefixKey + TK.eventsList, JSON.stringify(eventList));
    }
  }
}

// ---------------------------------------------------------------------------
//  Handler: handleLeague
//  Atomic (fight sequence must not be interrupted).
//  Wraps: LeagueHelper.isTimeToFight() + LeagueHelper.doLeagueBattle()
// ---------------------------------------------------------------------------

const handleLeague: HandlerConfig = {
  name: 'handleLeague',
  // Aligned with the short setTimer('nextLeaguesTime') value used in
  // LeagueHelper.doLeagueBattle when energy remains after a batch.
  // A larger Scheduler cool-down would silently extend the gap and
  // defeat the purpose of the short setTimer (the user wants the bot
  // to chain through all 15 battles, like a human emptying the league
  // tab in one sitting).
  minIntervalMs: 2_000,
  atomic: true,
  interruptible: 'never',
  precondition: (ctx) => {
    // Trigger logic in full (lesson pipeline-inner-trigger-in-precondition):
    //
    //   1. League auto-mode active and feature enabled at all?
    //   2. Bot not currently mid-action on a different module
    //      (legacy lastActionPerformed guard from doLeagueBattle, lifted
    //      out of step.fn so the chain doesn't fire just to log a skip).
    //   3. Either ready to fight (energy + threshold + booster check) OR
    //      the cool-down timer has expired and we still need to refresh
    //      the pInfo display with a default timer value (issue raised
    //      2026-05-26: pInfo stuck on 'No timer' when isTimeToFight is
    //      false because the only setTimer paths live behind a fight).
    //
    // Note (issue #1708 follow-up): handleLeague is intentionally NOT
    // gated on trollWaitForEnergy. League uses a separate energy pool
    // (challenge tokens) that is unrelated to troll combativity (fight
    // tokens). LeagueHelper.isTimeToFight() already checks challenge
    // energy, and the minIntervalMs caps re-entry. Blocking league
    // while troll waits for combativity (as v7.35.45 did) keeps league
    // fights from happening even though the user has the energy to do
    // them. handleEventParsing is gated separately because it ran every
    // 2 s and was the actual ping-pong driver in #1700.
    if (!LeagueHelper.isAutoLeagueActivated()) return false;
    const lastAction = ctx.lastActionPerformed;
    if (lastAction !== 'none' && lastAction !== 'league') return false;
    return LeagueHelper.isTimeToFight() || checkTimer('nextLeaguesTime');
  },
  steps: [
    {
      name: 'doLeagueBattleOrTimer',
      fn: async (ctx): Promise<StepResult> => {
        try {
          if (LeagueHelper.isTimeToFight()) {
            LeagueHelper.doLeagueBattle();
            ctx.lastActionPerformed = 'league';
            return { ok: true };
          }
          // Fight not possible right now (energy below threshold,
          // booster missing, etc.). Refresh the cool-down timer so the
          // pInfo display can show the next refresh time instead of
          // 'No timer'. Default fallback when the game has not yet
          // reported a next_refresh_ts is the same 15-17 min window
          // doLeagueBattle uses for similar idle paths.
          const next_refresh = Number(getHHVars('Hero.energies.challenge.next_refresh_ts'));
          if (Number.isFinite(next_refresh) && next_refresh > 0) {
            setTimer('nextLeaguesTime', randomInterval(next_refresh + 10, next_refresh + 180));
          } else {
            setTimer('nextLeaguesTime', randomInterval(15 * 60, 17 * 60));
          }
          return { ok: true };
        } catch (err) {
          return { ok: false, reason: String(err), retryable: true };
        }
      },
      timeoutMs: 25_000,
    },
  ],
  onFailure: async (_ctx, failedStep: string, reason: string): Promise<void> => {
    logHHAuto('[Pipeline] handleLeague failed at ' + failedStep + ': ' + reason);
  },
  totalTimeoutMs: 30_000,
};

// ---------------------------------------------------------------------------
//  Handler: handleShop
//  Migrated from AutoLoopActions.handleShop in 3.2.G.a.
//  Non-atomic, always interruptible. Logs and updates the shop only when
//  the inner trigger matches the legacy implementation: either the shop
//  cool-down timer has elapsed, or the cached character level is below the
//  current hero level (signals a level-up that should refresh shop offers).
// ---------------------------------------------------------------------------

const handleShop: HandlerConfig = {
  name: 'handleShop',
  // Cool-down for the pipeline scheduler. The Shop module also keeps its
  // own internal nextShopTime timer; both must elapse before a real shop
  // navigation happens. 5_000 ms keeps the handler responsive without
  // burning a tick slot every second.
  minIntervalMs: 5_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (ConfigHelper.getHHScriptVars('isEnabledShop', false) !== true) return false;
    if (!Shop.isTimeToCheckShop()) return false;
    if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') return false;
    // Legacy lastActionPerformed continuation gate. v7.37.0 will replace
    // this with a scheduler-internal multi-step model; see
    // docs-internal/REVIEW_v7.37.0_Pipeline_Architecture.md.
    if (ctx.lastActionPerformed !== 'none' && ctx.lastActionPerformed !== 'shop') return false;
    // Inner trigger -- belongs in precondition, not the step. The legacy
    // handler had a two-stage gate (outer if + inner if) inside one tick,
    // so a precondition-true / inner-false combination was a no-op.
    // In the pipeline model the scheduler logs "Starting" and bumps the
    // cool-down on every step.fn call, even silent ones. That bursts the
    // scheduler into a 5-second spam loop while Shop.isTimeToCheckShop()
    // stays true (updateMarket / needBoosterStatusFromStore flags persist
    // until the shop is actually scraped). Lesson: when migrating a
    // multi-stage if cascade, every gate must move to the precondition.
    // Initialise the cached level on first call -- mirrors the legacy
    // handler. Without this, getLevel-vs-stored comparison below would
    // always fire on a fresh install.
    if (getStoredValue(HHStoredVarPrefixKey + TK.charLevel) === undefined) {
      setStoredValue(HHStoredVarPrefixKey + TK.charLevel, 0);
    }
    const timerReady = checkTimer('nextShopTime');
    const levelChanged = getStoredValue(HHStoredVarPrefixKey + TK.charLevel) < getHHVars('Hero.infos.level');
    if (!timerReady && !levelChanged) return false;
    return true;
  },
  steps: [{
    name: 'updateShop',
    fn: async (ctx) => {
      try {
        logHHAuto('Time to check shop.');
        const result = Shop.updateShop();
        ctx.busy = result === true;
        ctx.lastActionPerformed = 'shop';
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

// ---------------------------------------------------------------------------
//  Handler: handleAutoEquipBoosters
//  Migrated from AutoLoopActions.handleAutoEquipBoosters in 3.2.G.a.
//  Non-atomic, always interruptible. Auto-equips legendary boosters when
//  slots are empty/expired and the user opted in.
// ---------------------------------------------------------------------------

const handleAutoEquipBoosters: HandlerConfig = {
  name: 'handleAutoEquipBoosters',
  // Boosters can expire mid-session; keep the scheduler cool-down short so
  // the next eligible tick reacts quickly. The internal Booster timer (and
  // the freshness stamp introduced in cluster Z) handles longer waits.
  minIntervalMs: 5_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (getStoredValue(HHStoredVarPrefixKey + SK.autoEquipBoosters) !== 'true') return false;
    if (!checkTimer('nextAutoEquipBoosterTime')) return false;
    if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') return false;
    // No lastActionPerformed gate in the legacy handler.
    return true;
  },
  steps: [{
    name: 'autoEquipBoosters',
    fn: async (ctx) => {
      try {
        const equipped = await Booster.autoEquipBoosters();
        if (equipped) {
          ctx.busy = true;
          ctx.lastActionPerformed = 'autoEquipBoosters';
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

// ---------------------------------------------------------------------------
//  Handlers migrated in 3.2.G.b via fromDescriptor.
//  Each one is a one-step wrapper around the legacy ModuleHandlerDescriptor.
//  isReady captures both outer and inner trigger -- the lesson
//  pipeline-inner-trigger-in-precondition warns against splitting them
//  between precondition and step.fn.
//  All eleven handlers are non-atomic, always interruptible, and use
//  minIntervalMs sized to match the legacy tick frequency for that module.
// ---------------------------------------------------------------------------

const handleLoveRaid = fromDescriptor({
  name: "Time to go and check raids.",
  action: "loveraid",
  requiresCompetition: true,
  isReady: () => LoveRaidManager.isAnyActivated() && checkTimer('nextLoveRaidTime'),
  execute: () => LoveRaidManager.parse(),
}, { minIntervalMs: 5_000, handlerName: "handleLoveRaid" });

const handleContest = fromDescriptor({
  name: "Time to get contest rewards.",
  action: "contest",
  isReady: () => ConfigHelper.getHHScriptVars("isEnabledContest", false)
    && getStoredValue(HHStoredVarPrefixKey + SK.autoContest) === "true"
    && (checkTimer('nextContestCollectTime') || unsafeWindow.has_contests_datas || Contest.getClaimsButton().length > 0),
  execute: () => Contest.run(),
}, { minIntervalMs: 5_000, handlerName: "handleContest" });

const handleMissions = fromDescriptor({
  name: "Time to do missions.",
  action: "mission",
  isReady: () => ConfigHelper.getHHScriptVars("isEnabledMission", false)
    && getStoredValue(HHStoredVarPrefixKey + SK.autoMission) === "true"
    && checkTimer('nextMissionTime'),
  execute: () => Missions.run(),
}, { minIntervalMs: 5_000, handlerName: "handleMissions" });

const handleChampion = fromDescriptor({
  name: "Time to check on champions!",
  action: "champion",
  isReady: () => ConfigHelper.getHHScriptVars("isEnabledChamps", false)
    && getStoredValue(HHStoredVarPrefixKey + SK.autoChamps) === "true"
    && checkTimer('nextChampionTime'),
  execute: () => Champion.doChampionStuff(),
}, { minIntervalMs: 5_000, handlerName: "handleChampion" });

const handleClubChampion = fromDescriptor({
  name: "Time to check on club champion!",
  action: "clubChampion",
  isReady: () => ConfigHelper.getHHScriptVars("isEnabledClubChamp", false)
    && getStoredValue(HHStoredVarPrefixKey + SK.autoClubChamp) === "true"
    && checkTimer('nextClubChampionTime'),
  execute: () => ClubChampion.doClubChampionStuff(),
}, { minIntervalMs: 5_000, handlerName: "handleClubChampion" });

const handleSeasonalFreeCard = fromDescriptor({
  name: "Time to go and check SeasonalEvent to buy free card.",
  action: "seasonal",
  requiresCompetition: true,
  isReady: () => ConfigHelper.getHHScriptVars("isEnabledSeasonalEvent", false)
    && getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonalBuyFreeCard) === "true"
    && checkTimer('nextSeasonalCardCollectTime'),
  execute: () => SeasonalEvent.goAndCollectFreeCard(),
}, { minIntervalMs: 5_000, handlerName: "handleSeasonalFreeCard" });

const handleSeasonalRankCollect = fromDescriptor({
  name: "Time to go and check SeasonalEvent for collecting rank reward.",
  action: "seasonal",
  requiresCompetition: true,
  isReady: () => ConfigHelper.getHHScriptVars("isEnabledSeasonalEvent", false)
    && getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonalEventCollect) === "true"
    && checkTimer('nextMegaEventRankCollectTime'),
  execute: () => SeasonalEvent.goAndCollectMegaEventRankRewards(),
}, { minIntervalMs: 5_000, handlerName: "handleSeasonalRankCollect" });

const handleFreeBundles = fromDescriptor({
  name: "Time to go and check Free Bundles for collecting reward.",
  action: "bundle",
  requiresCompetition: true,
  isReady: () => ConfigHelper.getHHScriptVars("isEnabledFreeBundles", false)
    && getStoredValue(HHStoredVarPrefixKey + SK.autoFreeBundlesCollect) === "true"
    && checkTimer('nextFreeBundlesCollectTime'),
  execute: () => { Bundles.goAndCollectFreeBundles(); },
}, { minIntervalMs: 5_000, handlerName: "handleFreeBundles" });

const handleDailyGoals = fromDescriptor({
  name: "Time to go and check daily Goals for collecting reward.",
  action: "dailyGoals",
  requiresCompetition: true,
  isReady: () => ConfigHelper.getHHScriptVars("isEnabledDailyGoals", false)
    && getStoredValue(HHStoredVarPrefixKey + SK.autoDailyGoalsCollect) === "true"
    && checkTimer('nextDailyGoalsCollectTime'),
  execute: () => DailyGoals.goAndCollect(),
}, { minIntervalMs: 5_000, handlerName: "handleDailyGoals" });

const handleLabyrinth = fromDescriptor({
  name: "Time to check on labyrinth.",
  action: "labyrinth",
  requiresCompetition: true,
  isReady: () => getStoredValue(HHStoredVarPrefixKey + SK.autoLabyrinth) === "true"
    && Labyrinth.isEnabled()
    && checkTimer('nextLabyrinthTime'),
  execute: () => (new LabyrinthAuto).run(),
}, { minIntervalMs: 5_000, handlerName: "handleLabyrinth" });

// ---------------------------------------------------------------------------
//  Handlers migrated in 3.2.G.complete (the remaining classic handlers).
//
//  These are the handlers that did not fit the runStandardHandler descriptor
//  shape used in 3.2.G.b. Each one keeps its full legacy logic in step.fn,
//  with all gates lifted into precondition (lesson
//  pipeline-inner-trigger-in-precondition).
//
//  handleMythicWave is intentionally NOT migrated. Its only effect was
//  setting ctx.lastActionPerformed = "troll" in the same tick to grant
//  handleTrollBattle the slot reservation. In the pipeline model the
//  scheduler picks one handler per tick, so the reservation has no
//  destination -- and handleTrollBattle's own gate already accepts
//  lastActionPerformed = "none" anyway. The function is kept in
//  AutoLoopActions.ts as deprecated, the AutoLoop.autoLoop() call site
//  is removed.
// ---------------------------------------------------------------------------

const handleHaremSize: HandlerConfig = {
  name: 'handleHaremSize',
  minIntervalMs: 5_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') return false;
    if (!Harem.HaremSizeNeedsRefresh(ConfigHelper.getHHScriptVars('HaremMaxSizeExpirationSecs'))) return false;
    if (ctx.currentPage === ConfigHelper.getHHScriptVars('pagesIDWaifu')) return false;
    if (ctx.currentPage === ConfigHelper.getHHScriptVars('pagesIDEditTeam')) return false;
    if (ctx.lastActionPerformed !== 'none') return false;
    return true;
  },
  steps: [{
    name: 'gotoWaifu',
    fn: async (ctx) => {
      try {
        ctx.busy = gotoPage(ConfigHelper.getHHScriptVars('pagesIDWaifu'));
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

const handlePlaceOfPower: HandlerConfig = {
  name: 'handlePlaceOfPower',
  minIntervalMs: 5_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (!PlaceOfPower.isActivated()) return false;
    if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') return false;
    if (ctx.lastActionPerformed !== 'none' && ctx.lastActionPerformed !== 'pop') return false;
    const popToStart = getStoredJSON(HHStoredVarPrefixKey + TK.PopToStart, []);
    if (popToStart.length === 0 && !checkTimer('minPowerPlacesTime')) return false;
    return true;
  },
  steps: [{
    name: 'doPoP',
    fn: async (ctx) => {
      try {
        let popToStart = getStoredJSON(HHStoredVarPrefixKey + TK.PopToStart, []);
        const popToStartExist = getStoredValue(HHStoredVarPrefixKey + TK.PopToStart) ? true : false;
        if (!popToStartExist) {
          logHHAuto('Go and collect pop');
          ctx.busy = await PlaceOfPower.collectAndUpdate();
        }
        const indexes = (getStoredValue(HHStoredVarPrefixKey + SK.autoPowerPlacesIndexFilter) as string).split(';');
        popToStart = getStoredJSON(HHStoredVarPrefixKey + TK.PopToStart, []);
        for (const pop of popToStart) {
          if (ctx.busy === false && !indexes.includes(String(pop))) {
            logHHAuto('PoP is no longer in list :' + pop + ' removing it from start list.');
            PlaceOfPower.removePopFromPopToStart(pop);
          }
        }
        popToStart = getStoredJSON(HHStoredVarPrefixKey + TK.PopToStart, []);
        for (const index of indexes) {
          if (ctx.busy === false && popToStart.includes(Number(index))) {
            logHHAuto('Time to do PowerPlace' + index + '.');
            ctx.busy = await PlaceOfPower.doPowerPlacesStuff(index);
            ctx.lastActionPerformed = 'pop';
          }
        }
        if (ctx.busy === false) {
          popToStart = getStoredJSON(HHStoredVarPrefixKey + TK.PopToStart, []);
          if (popToStart.length === 0) {
            deleteStoredValue(HHStoredVarPrefixKey + TK.PopToStart);
            ctx.busy = gotoPage(ConfigHelper.getHHScriptVars('pagesIDHome'));
          }
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

const handleGenericBattle: HandlerConfig = {
  name: 'handleGenericBattle',
  minIntervalMs: 2_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (!ctx.canCollectCompetitionActive) return false;
    if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') return false;
    const battlePages = [
      ConfigHelper.getHHScriptVars('pagesIDLeagueBattle'),
      ConfigHelper.getHHScriptVars('pagesIDTrollBattle'),
      ConfigHelper.getHHScriptVars('pagesIDSeasonBattle'),
      ConfigHelper.getHHScriptVars('pagesIDPentaDrillBattle'),
      ConfigHelper.getHHScriptVars('pagesIDPantheonBattle'),
      ConfigHelper.getHHScriptVars('pagesIDLabyrinthBattle'),
    ];
    return battlePages.includes(ctx.currentPage);
  },
  steps: [{
    name: 'doBattle',
    fn: async (ctx) => {
      try {
        ctx.busy = true;
        GenericBattle.doBattle();
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

const handleTrollBattle: HandlerConfig = {
  name: 'handleTrollBattle',
  // 7.35.61 live test on PH ran 75 [Scheduler] Starting chain 'handleTrollBattle'
  // logs in 30 minutes for 28 actual fights. The remaining 47 ticks were
  // legitimate skips (currentPower below threshold, no event girl, no raid):
  // the precondition matched but step.fn fell through. In the classic
  // implementation these were silent no-ops; the pipeline still emits
  // Starting/completed pairs which adds log noise. Doubling the cool-down
  // to 4 s halves the polling rate without affecting fight responsiveness
  // (the inner Troll battle sequence holds the autoLoop flag for several
  // seconds between fights anyway).
  minIntervalMs: 4_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (!Troll.isTrollFightActivated()) return false;
    if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') return false;
    if (!ctx.canCollectCompetitionActive) return false;
    if (ctx.lastActionPerformed !== 'none' && ctx.lastActionPerformed !== 'troll' && ctx.lastActionPerformed !== 'quest') return false;
    return true;
  },
  steps: [{
    name: 'trollBattleOrWait',
    fn: async (ctx) => {
      try {
        // Always clear the troll wait-marker up-front (issue #1708 / #1700).
        // Only the wait-branch below sets it back to "true" when this tick
        // decides to wait for an energy refill. Doing the clear unconditionally
        // avoids a stale marker when the user disables auto-troll mid-wait.
        setStoredValue(HHStoredVarPrefixKey + TK.trollWaitForEnergy, 'false');

        const threshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoTrollThreshold)) || 0;
        const runThreshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoTrollRunThreshold)) || 0;
        const humanLikeRun = getStoredValue(HHStoredVarPrefixKey + TK.TrollHumanLikeRun) === 'true';
        const energyAboveThreshold = humanLikeRun && ctx.currentPower > threshold || ctx.currentPower > Math.max(threshold, runThreshold - 1);
        const eventGirl: EventGirl = EventModule.getEventGirl();
        const eventMythicGirl: EventGirl = EventModule.getEventMythicGirl();
        const allTrollRaids = LoveRaidManager.isAnyActivated() ? LoveRaidManager.getTrollRaids() : [];
        const raidStarsFiltered = LoveRaidManager.filterByRaidStars(allTrollRaids);
        const raidStarsRaid: LoveRaid = LoveRaidManager.getRaidStarsRaidToFight(raidStarsFiltered);
        const loveRaid: LoveRaid = LoveRaidManager.isActivated()
          ? LoveRaidManager.getRaidToFight(allTrollRaids)
          : undefined;

        const shouldFight =
          (
            getStoredValue(HHStoredVarPrefixKey + SK.autoTrollBattle) === 'true'
            && ctx.currentPower >= Number(getStoredValue(HHStoredVarPrefixKey + TK.battlePowerRequired))
            && ctx.currentPower > 0
            && (energyAboveThreshold || getStoredValue(HHStoredVarPrefixKey + TK.autoTrollBattleSaveQuest) === 'true')
          )
          || (getStoredValue(HHStoredVarPrefixKey + SK.autoTrollBattle) === 'true' && ctx.currentPower > 0 && ParanoiaService.checkParanoiaSpendings('fight') > 0)
          || (
            (eventMythicGirl.girl_id && eventMythicGirl.is_mythic && getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythic) === 'true')
            && (ctx.currentPower > 0 || Troll.canBuyFight(eventMythicGirl, false).canBuy)
          )
          || (
            (raidStarsRaid?.id_girl)
            && (
              getStoredValue(HHStoredVarPrefixKey + SK.autoTrollLoveRaidByPassThreshold) === 'true'
                ? (ctx.currentPower > 0 || Troll.canBuyFightForRaid(raidStarsRaid, false).canBuy)
                : (energyAboveThreshold || Troll.canBuyFightForRaid(raidStarsRaid, false).canBuy)
            )
          )
          || (
            (eventGirl.girl_id && !eventGirl.is_mythic && getStoredValue(HHStoredVarPrefixKey + SK.plusEvent) === 'true')
            && (energyAboveThreshold || Troll.canBuyFight(eventGirl, false).canBuy)
          )
          || (
            (LoveRaidManager.isActivated() && loveRaid?.id_girl)
            && (
              getStoredValue(HHStoredVarPrefixKey + SK.autoTrollLoveRaidByPassThreshold) === 'true'
                ? (ctx.currentPower > 0 || Troll.canBuyFightForRaid(loveRaid, false).canBuy)
                : (energyAboveThreshold || Troll.canBuyFightForRaid(loveRaid, false).canBuy)
            )
          );

        if (shouldFight) {
          logHHAuto('Troll:', { threshold: threshold, runThreshold: runThreshold, TrollHumanLikeRun: humanLikeRun });
          setStoredValue(HHStoredVarPrefixKey + TK.battlePowerRequired, '0');
          ctx.busy = true;
          if (getStoredValue(HHStoredVarPrefixKey + SK.autoQuest) !== 'true' || (getStoredValue(HHStoredVarPrefixKey + TK.questRequirement) as string)[0] !== 'P') {
            ctx.busy = await Troll.doBossBattle();
            if (ctx.busy) ctx.lastActionPerformed = 'troll';
          } else if (getStoredValue(HHStoredVarPrefixKey + SK.autoTrollBattle) === 'true') {
            logHHAuto('AutoBattle disabled for power collection for AutoQuest.');
            (document.getElementById('autoTrollBattle') as HTMLInputElement).checked = false;
            setStoredValue(HHStoredVarPrefixKey + SK.autoTrollBattle, 'false');
            ctx.busy = false;
          } else {
            ctx.busy = await Troll.doBossBattle();
            if (ctx.busy) ctx.lastActionPerformed = 'troll';
          }
        } else {
          if (getStoredValue(HHStoredVarPrefixKey + TK.TrollHumanLikeRun) === 'true') {
            setStoredValue(HHStoredVarPrefixKey + TK.TrollHumanLikeRun, 'false');
          }
          if (ctx.currentPower === 0 && wouldFightWithPower(eventGirl, eventMythicGirl, raidStarsRaid, loveRaid)) {
            logHHAuto('Troll fight pending: waiting for energy refill.');
            setStoredValue(HHStoredVarPrefixKey + TK.trollWaitForEnergy, 'true');
          }
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

/**
 * Pure helper used by handleTrollBattle. Mirrors the OR-disjunction in the
 * trollBattleOrWait step.fn; if those activation paths drift, the wait-marker
 * either fires too often (blocking event-parsing) or too rarely (issue #1700
 * ping-pong returns). MAINTENANCE: keep in sync with trollBattleOrWait.
 *
 * Spec: spec/Service/AutoLoopActions.wouldFightWithPower.spec.ts (13 cases)
 *       spec/Service/AutoLoopActions.trollWaitForEnergy.spec.ts (5 cases)
 * Lesson: _lessons/mapping-fix-vollstaendig-pruefen.md
 */
function wouldFightWithPower(
  eventGirl: EventGirl,
  eventMythicGirl: EventGirl,
  raidStarsRaid: LoveRaid | undefined,
  loveRaid: LoveRaid | undefined,
): boolean {
  const autoTrollOn = getStoredValue(HHStoredVarPrefixKey + SK.autoTrollBattle) === 'true';
  const mythicEventReady = Boolean(eventMythicGirl?.girl_id) && eventMythicGirl?.is_mythic === true
    && getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythic) === 'true';
  const eventReady = Boolean(eventGirl?.girl_id) && eventGirl?.is_mythic !== true
    && getStoredValue(HHStoredVarPrefixKey + SK.plusEvent) === 'true';
  const raidStarsReady = Boolean(raidStarsRaid?.id_girl)
    && getStoredValue(HHStoredVarPrefixKey + SK.plusLoveRaid) === 'true';
  const loveRaidReady = LoveRaidManager.isActivated() && Boolean(loveRaid?.id_girl);
  return autoTrollOn || mythicEventReady || eventReady || raidStarsReady || loveRaidReady;
}

const handlePachinko: HandlerConfig = {
  name: 'handlePachinko',
  minIntervalMs: 2_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (getStoredValue(HHStoredVarPrefixKey + SK.autoFreePachinko) !== 'true') return false;
    if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') return false;
    if (!ctx.canCollectCompetitionActive) return false;
    if (ctx.lastActionPerformed !== 'none' && ctx.lastActionPerformed !== 'pachinko') return false;
    const myth = ConfigHelper.getHHScriptVars('isEnabledMythicPachinko', false) && checkTimer('nextPachinko2Time');
    const great = ConfigHelper.getHHScriptVars('isEnabledGreatPachinko', false) && checkTimer('nextPachinkoTime');
    const equip = ConfigHelper.getHHScriptVars('isEnabledEquipmentPachinko', false) && checkTimer('nextPachinkoEquipTime');
    return myth || great || equip;
  },
  steps: [{
    name: 'fetchPachinko',
    fn: async (ctx) => {
      try {
        if (ctx.busy === false && ConfigHelper.getHHScriptVars('isEnabledMythicPachinko', false) && checkTimer('nextPachinko2Time')) {
          logHHAuto('Time to fetch Mythic Pachinko.');
          ctx.busy = await Pachinko.getMythicPachinko();
          ctx.lastActionPerformed = 'pachinko';
        }
        if (ctx.busy === false && ConfigHelper.getHHScriptVars('isEnabledGreatPachinko', false) && checkTimer('nextPachinkoTime')) {
          logHHAuto('Time to fetch Great Pachinko.');
          ctx.busy = await Pachinko.getGreatPachinko();
          ctx.lastActionPerformed = 'pachinko';
        }
        if (ctx.busy === false && ConfigHelper.getHHScriptVars('isEnabledEquipmentPachinko', false) && checkTimer('nextPachinkoEquipTime')) {
          logHHAuto('Time to fetch Equipment Pachinko.');
          ctx.busy = await Pachinko.getEquipmentPachinko();
          ctx.lastActionPerformed = 'pachinko';
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

const handleQuest: HandlerConfig = {
  name: 'handleQuest',
  minIntervalMs: 2_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (ConfigHelper.getHHScriptVars('isEnabledQuest', false) !== true) return false;
    const autoQuest = getStoredValue(HHStoredVarPrefixKey + SK.autoQuest) === 'true';
    const autoSideQuest = ConfigHelper.getHHScriptVars('isEnabledSideQuest', false)
      && getStoredValue(HHStoredVarPrefixKey + SK.autoSideQuest) === 'true';
    if (!autoQuest && !autoSideQuest) return false;
    if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') return false;
    if (!ctx.canCollectCompetitionActive) return false;
    if (ctx.lastActionPerformed !== 'none' && ctx.lastActionPerformed !== 'quest') return false;
    return true;
  },
  steps: [{
    name: 'doQuest',
    fn: async (ctx) => {
      try {
        if (getStoredValue(HHStoredVarPrefixKey + TK.autoTrollBattleSaveQuest) === undefined) {
          setStoredValue(HHStoredVarPrefixKey + TK.autoTrollBattleSaveQuest, 'false');
        }
        const questRequirement = getStoredValue(HHStoredVarPrefixKey + TK.questRequirement) as string;
        if (questRequirement === 'battle') {
          if (ConfigHelper.getHHScriptVars('isEnabledTrollBattle', false) && getStoredValue(HHStoredVarPrefixKey + TK.autoTrollBattleSaveQuest) === 'false') {
            logHHAuto('Quest requires battle.');
            logHHAuto('prepare to save one battle for quest');
            setStoredValue(HHStoredVarPrefixKey + TK.autoTrollBattleSaveQuest, 'true');
            if (getStoredValue(HHStoredVarPrefixKey + SK.autoTrollBattle) !== 'true') {
              ctx.busy = await Troll.doBossBattle();
            }
          }
        } else if (questRequirement[0] === '$') {
          if (Number(questRequirement.substr(1)) < (getHHVars('Hero.currencies.soft_currency') as number)) {
            logHHAuto('Continuing quest, required money obtained.');
            setStoredValue(HHStoredVarPrefixKey + TK.questRequirement, 'none');
            QuestHelper.run();
            ctx.busy = true;
          } else {
            setStoredValue(HHStoredVarPrefixKey + TK.paranoiaQuestBlocked, 'true');
            if (isNaN(Number(questRequirement.substr(1)))) {
              logHHAuto(questRequirement);
              setStoredValue(HHStoredVarPrefixKey + TK.questRequirement, 'none');
              logHHAuto('Invalid money in session storage quest requirement !');
            }
            ctx.busy = false;
          }
        } else if (questRequirement[0] === '*') {
          const energyNeeded = Number(questRequirement.substr(1));
          const energyCurrent = QuestHelper.getEnergy();
          if (energyNeeded <= energyCurrent) {
            if (Number(energyCurrent) > Number(getStoredValue(HHStoredVarPrefixKey + SK.autoQuestThreshold)) || ParanoiaService.checkParanoiaSpendings('quest') > 0) {
              logHHAuto('Continuing quest, required energy obtained.');
              setStoredValue(HHStoredVarPrefixKey + TK.questRequirement, 'none');
              QuestHelper.run();
              ctx.busy = true;
            } else {
              ctx.busy = false;
            }
          } else {
            setStoredValue(HHStoredVarPrefixKey + TK.paranoiaQuestBlocked, 'true');
            ctx.busy = false;
          }
        } else if (questRequirement[0] === 'P') {
          const neededPower = Number(questRequirement.substr(1));
          if (ctx.currentPower < neededPower) {
            logHHAuto('Quest requires ' + neededPower + ' Battle Power for advancement. Waiting...');
            ctx.busy = false;
            setStoredValue(HHStoredVarPrefixKey + TK.paranoiaQuestBlocked, 'true');
          } else {
            logHHAuto('Battle Power obtained, resuming quest...');
            setStoredValue(HHStoredVarPrefixKey + TK.questRequirement, 'none');
            QuestHelper.run();
            ctx.busy = true;
          }
        } else if (questRequirement === 'unknownQuestButton') {
          setStoredValue(HHStoredVarPrefixKey + TK.paranoiaQuestBlocked, 'true');
          if (getStoredValue(HHStoredVarPrefixKey + SK.autoQuest) === 'true') {
            logHHAuto('AutoQuest disabled.HHAuto_Setting_AutoQuest cannot be performed due to unknown quest button. Please manually proceed the current quest screen.');
            (document.getElementById('autoQuest') as HTMLInputElement).checked = false;
            setStoredValue(HHStoredVarPrefixKey + SK.autoQuest, 'false');
          }
          if (getStoredValue(HHStoredVarPrefixKey + SK.autoSideQuest) === 'true') {
            logHHAuto('AutoQuest disabled.HHAuto_Setting_autoSideQuest cannot be performed due to unknown quest button. Please manually proceed the current quest screen.');
            (document.getElementById('autoSideQuest') as HTMLInputElement).checked = false;
            setStoredValue(HHStoredVarPrefixKey + SK.autoSideQuest, 'false');
          }
          setStoredValue(HHStoredVarPrefixKey + TK.questRequirement, 'none');
          ctx.busy = false;
        } else if (questRequirement === 'errorInAutoBattle') {
          setStoredValue(HHStoredVarPrefixKey + TK.paranoiaQuestBlocked, 'true');
          if (getStoredValue(HHStoredVarPrefixKey + SK.autoQuest) === 'true') {
            logHHAuto('AutoQuest disabled.HHAuto_Setting_AutoQuest cannot be performed due errors in AutoBattle. Please manually proceed the current quest screen.');
            (document.getElementById('autoQuest') as HTMLInputElement).checked = false;
            setStoredValue(HHStoredVarPrefixKey + SK.autoQuest, 'false');
          }
          if (getStoredValue(HHStoredVarPrefixKey + SK.autoSideQuest) === 'true') {
            logHHAuto('AutoQuest disabled.HHAuto_Setting_autoSideQuest cannot be performed due errors in AutoBattle. Please manually proceed the current quest screen.');
            (document.getElementById('autoSideQuest') as HTMLInputElement).checked = false;
            setStoredValue(HHStoredVarPrefixKey + SK.autoSideQuest, 'false');
          }
          setStoredValue(HHStoredVarPrefixKey + TK.questRequirement, 'none');
          ctx.busy = false;
        } else if (questRequirement === 'outfit') {
          // Quest step requires an outfit change. Quest.ts:215 writes the
          // 'outfit' marker but no else-if matched it before, so the
          // pipeline fell through to the catch-all 'Invalid quest
          // requirement' branch every tick: the marker was never reset,
          // so the bot stayed in an infinite log-spam loop on outfit-
          // gated quests until the user manually intervened. Auto-quest
          // also stayed enabled (unlike unknownQuestButton), so the
          // pInfo gave no hint that the bot was stuck.
          //
          // Mirror the unknownQuestButton path: disable autoQuest /
          // autoSideQuest, log a user-actionable message, reset the
          // marker, set paranoiaQuestBlocked so other handlers know not
          // to wait for quest progress.
          setStoredValue(HHStoredVarPrefixKey + TK.paranoiaQuestBlocked, 'true');
          if (getStoredValue(HHStoredVarPrefixKey + SK.autoQuest) === 'true') {
            logHHAuto('AutoQuest disabled. The current quest step requires an outfit change. Please manually proceed the current quest screen.');
            (document.getElementById('autoQuest') as HTMLInputElement).checked = false;
            setStoredValue(HHStoredVarPrefixKey + SK.autoQuest, 'false');
          }
          if (getStoredValue(HHStoredVarPrefixKey + SK.autoSideQuest) === 'true') {
            logHHAuto('AutoQuest disabled. The current side-quest step requires an outfit change. Please manually proceed the current quest screen.');
            (document.getElementById('autoSideQuest') as HTMLInputElement).checked = false;
            setStoredValue(HHStoredVarPrefixKey + SK.autoSideQuest, 'false');
          }
          setStoredValue(HHStoredVarPrefixKey + TK.questRequirement, 'none');
          ctx.busy = false;
        } else if (questRequirement === 'none') {
          if (checkTimer('nextMainQuestAttempt') && checkTimer('nextSideQuestAttempt')) {
            if (QuestHelper.getEnergy() > Number(getStoredValue(HHStoredVarPrefixKey + SK.autoQuestThreshold)) || ParanoiaService.checkParanoiaSpendings('quest') > 0) {
              ctx.busy = true;
              QuestHelper.run();
            }
          }
        } else {
          setStoredValue(HHStoredVarPrefixKey + TK.paranoiaQuestBlocked, 'true');
          logHHAuto('Invalid quest requirement : ' + questRequirement);
          ctx.busy = false;
        }
        if (ctx.busy) ctx.lastActionPerformed = 'quest';
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

const handleSeason: HandlerConfig = {
  name: 'handleSeason',
  minIntervalMs: 2_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (ConfigHelper.getHHScriptVars('isEnabledSeason', false) !== true) return false;
    if (getStoredValue(HHStoredVarPrefixKey + SK.autoSeason) !== 'true') return false;
    if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') return false;
    if (!ctx.canCollectCompetitionActive) return false;
    if (ctx.lastActionPerformed !== 'none' && ctx.lastActionPerformed !== 'season') return false;
    if (!Season.isTimeToFight() && !checkTimer('nextSeasonTime')) return false;
    return true;
  },
  steps: [{
    name: 'seasonBattleOrTimer',
    fn: async (ctx) => {
      try {
        if (Season.isTimeToFight()) {
          logHHAuto('Time to fight in Season.');
          ctx.busy = await Season.run();
          ctx.lastActionPerformed = 'season';
        } else if (checkTimer('nextSeasonTime')) {
          if (getStoredValue(HHStoredVarPrefixKey + TK.SeasonHumanLikeRun) === 'true') {
            setStoredValue(HHStoredVarPrefixKey + TK.SeasonHumanLikeRun, 'false');
          }
          if (getHHVars('Hero.energies.kiss.next_refresh_ts') === 0) {
            setTimer('nextSeasonTime', randomInterval(15 * 60, 17 * 60));
          } else {
            const next_refresh = getHHVars('Hero.energies.kiss.next_refresh_ts');
            setTimer('nextSeasonTime', randomInterval(next_refresh + 10, next_refresh + 180));
          }
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

const handlePentaDrill: HandlerConfig = {
  name: 'handlePentaDrill',
  minIntervalMs: 2_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (ConfigHelper.getHHScriptVars('isEnabledPentaDrill', false) !== true) return false;
    if (getStoredValue(HHStoredVarPrefixKey + SK.autoPentaDrill) !== 'true') return false;
    if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') return false;
    if (!ctx.canCollectCompetitionActive) return false;
    if (ctx.lastActionPerformed !== 'none' && ctx.lastActionPerformed !== 'pentaDrill') return false;
    if (!PentaDrill.isTimeToFight() && !checkTimer('nextPentaDrillTime')) return false;
    return true;
  },
  steps: [{
    name: 'pentaDrillBattleOrTimer',
    fn: async (ctx) => {
      try {
        if (PentaDrill.isTimeToFight()) {
          logHHAuto('Time to fight in PentaDrill.');
          PentaDrill.run();
          ctx.busy = true;
          ctx.lastActionPerformed = 'pentaDrill';
        } else if (checkTimer('nextPentaDrillTime')) {
          if (getStoredValue(HHStoredVarPrefixKey + TK.PentaDrillHumanLikeRun) === 'true') {
            setStoredValue(HHStoredVarPrefixKey + TK.PentaDrillHumanLikeRun, 'false');
          }
          if (getHHVars('Hero.energies.drill.next_refresh_ts') === 0) {
            setTimer('nextPentaDrillTime', randomInterval(15 * 60, 17 * 60));
          } else {
            const next_refresh = getHHVars('Hero.energies.drill.next_refresh_ts');
            setTimer('nextPentaDrillTime', randomInterval(next_refresh + 10, next_refresh + 180));
          }
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

const handlePantheon: HandlerConfig = {
  name: 'handlePantheon',
  minIntervalMs: 2_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    const autoPantheon = getStoredValue(HHStoredVarPrefixKey + SK.autoPantheon) === 'true';
    const dailyPantheon = DailyGoals.isPantheonDailyGoal();
    if (!autoPantheon && !dailyPantheon) return false;
    if (!Pantheon.isEnabled()) return false;
    if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') return false;
    if (!ctx.canCollectCompetitionActive) return false;
    if (ctx.lastActionPerformed !== 'none' && ctx.lastActionPerformed !== 'pantheon') return false;
    if (!Pantheon.isTimeToFight() && !checkTimer('nextPantheonTime')) return false;
    return true;
  },
  steps: [{
    name: 'pantheonBattleOrTimer',
    fn: async (ctx) => {
      try {
        if (Pantheon.isTimeToFight()) {
          logHHAuto('Time to do Pantheon.');
          Pantheon.run();
          ctx.busy = true;
          ctx.lastActionPerformed = 'pantheon';
        } else if (checkTimer('nextPantheonTime')) {
          if (getStoredValue(HHStoredVarPrefixKey + TK.PantheonHumanLikeRun) === 'true') {
            setStoredValue(HHStoredVarPrefixKey + TK.PantheonHumanLikeRun, 'false');
          }
          if (getHHVars('Hero.energies.worship.next_refresh_ts') === 0) {
            setTimer('nextPantheonTime', randomInterval(15 * 60, 17 * 60));
          } else {
            const next_refresh = getHHVars('Hero.energies.worship.next_refresh_ts');
            setTimer('nextPantheonTime', randomInterval(next_refresh + 10, next_refresh + 180));
          }
          ctx.lastActionPerformed = 'none';
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

const handleChampionTicket: HandlerConfig = {
  name: 'handleChampionTicket',
  minIntervalMs: 5_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (ConfigHelper.getHHScriptVars('isEnabledChamps', false) !== true) return false;
    if (getStoredValue(HHStoredVarPrefixKey + SK.autoChampsUseEne) !== 'true') return false;
    if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') return false;
    if (!ctx.canCollectCompetitionActive) return false;
    if (ctx.lastActionPerformed !== 'none' && ctx.lastActionPerformed !== 'champion') return false;
    const energy = QuestHelper.getEnergy();
    const ticketPrice = ConfigHelper.getHHScriptVars('CHAMP_TICKET_PRICE') as number;
    if (energy < ticketPrice) return false;
    if (energy <= Number(getStoredValue(HHStoredVarPrefixKey + SK.autoQuestThreshold))) return false;
    return true;
  },
  steps: [{
    name: 'buyChampionTicket',
    fn: async (ctx) => {
      try {
        // Avoid getHero() import: it lives in HeroHelper.ts which imports autoLoop,
        // closing a Module->Service->Module cycle (lesson zirkulaerer-import-tdz-crash).
        // unsafeWindow.shared?.Hero is the same object getHero() returns.
        const Hero = (unsafeWindow as { shared?: { Hero?: { updates: (data: Record<string, unknown>) => void } } }).shared?.Hero;
        if (!Hero) return { ok: false, reason: 'Hero unavailable', retryable: true };
        function buyTicket() {
          const params = {
            action: 'champion_buy_ticket',
            currency: 'energy_quest',
            amount: '1',
          };
          logHHAuto('Buying ticket with energy');
          getHHAjax()(params, function (data: { hero_changes: Record<string, unknown> }) {
            Hero.updates(data.hero_changes);
            // Route the post-purchase reload through safeReload so any
            // in-flight game AJAX gets to finish before the URL change.
            safeReload();
          });
        }
        // Set autoLoop=false BEFORE the setTimeout window so concurrent
        // AutoLoop ticks during the 800-1600ms wait cannot start a second
        // champion_buy_ticket AJAX. The safeReload() inside the AJAX
        // callback later sets autoLoop=false a second time -- the
        // second write is idempotent and serves the separate purpose of
        // suppressing ticks during the reload itself. See ChampionTicket
        // race-window discussion in REVIEW_AutoLoop_Findings.md F1.
        setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, 'false');
        logHHAuto('setting autoloop to false');
        ctx.busy = true;
        setTimeout(buyTicket, randomInterval(800, 1600));
        ctx.lastActionPerformed = 'champion';
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

const handleSeasonCollect: HandlerConfig = {
  name: 'handleSeasonCollect',
  minIntervalMs: 5_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (ConfigHelper.getHHScriptVars('isEnabledSeason', false) !== true) return false;
    if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') return false;
    if (ctx.lastActionPerformed !== 'none' && ctx.lastActionPerformed !== 'season') return false;
    const collectGate = checkTimer('nextSeasonCollectTime')
      && getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonCollect) === 'true'
      && ctx.canCollectCompetitionActive;
    const collectAllGate = getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonCollectAll) === 'true'
      && checkTimer('nextSeasonCollectAllTime')
      && (getTimer('SeasonRemainingTime') === -1 || getSecondsLeft('SeasonRemainingTime') < getLimitTimeBeforeEnd());
    return collectGate || collectAllGate;
  },
  steps: [{
    name: 'collectSeason',
    fn: async (ctx) => {
      try {
        logHHAuto('Time to go and check Season for collecting reward.');
        ctx.busy = Season.goAndCollect();
        ctx.lastActionPerformed = 'season';
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

const handlePentaDrillCollect: HandlerConfig = {
  name: 'handlePentaDrillCollect',
  minIntervalMs: 5_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (ConfigHelper.getHHScriptVars('isEnabledPentaDrill', false) !== true) return false;
    if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') return false;
    if (ctx.lastActionPerformed !== 'none' && ctx.lastActionPerformed !== 'pentaDrill') return false;
    const collectGate = checkTimer('nextPentaDrillCollectTime')
      && getStoredValue(HHStoredVarPrefixKey + SK.autoPentaDrillCollect) === 'true'
      && ctx.canCollectCompetitionActive;
    const collectAllGate = getStoredValue(HHStoredVarPrefixKey + SK.autoPentaDrillCollectAll) === 'true'
      && checkTimer('nextPentaDrillCollectAllTime')
      && (getTimer('pentaDrillRemainingTime') === -1 || getSecondsLeft('pentaDrillRemainingTime') < getLimitTimeBeforeEnd());
    return collectGate || collectAllGate;
  },
  steps: [{
    name: 'collectPentaDrill',
    fn: async (ctx) => {
      try {
        logHHAuto('Time to go and check PentaDrill for collecting reward.');
        ctx.busy = PentaDrill.goAndCollect();
        ctx.lastActionPerformed = 'pentaDrill';
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

const handleSeasonalEventCollect: HandlerConfig = {
  name: 'handleSeasonalEventCollect',
  minIntervalMs: 5_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (ConfigHelper.getHHScriptVars('isEnabledSeasonalEvent', false) !== true) return false;
    if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') return false;
    if (ctx.lastActionPerformed !== 'none' && ctx.lastActionPerformed !== 'seasonal') return false;
    const collectGate = checkTimer('nextSeasonalEventCollectTime')
      && getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonalEventCollect) === 'true'
      && ctx.canCollectCompetitionActive;
    const collectAllGate = getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonalEventCollectAll) === 'true'
      && checkTimer('nextSeasonalEventCollectAllTime')
      && (getTimer('SeasonalEventRemainingTime') === -1 || getSecondsLeft('SeasonalEventRemainingTime') < getLimitTimeBeforeEnd());
    return collectGate || collectAllGate;
  },
  steps: [{
    name: 'collectSeasonalEvent',
    fn: async (ctx) => {
      try {
        logHHAuto('Time to go and check SeasonalEvent for collecting reward.');
        ctx.busy = SeasonalEvent.goAndCollect();
        ctx.lastActionPerformed = 'seasonal';
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

const handlePoVCollect: HandlerConfig = {
  name: 'handlePoVCollect',
  minIntervalMs: 5_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') return false;
    if (!PathOfValue.isEnabled()) return false;
    if (ctx.lastActionPerformed !== 'none' && ctx.lastActionPerformed !== 'pov') return false;
    const collectGate = checkTimer('nextPoVCollectTime')
      && getStoredValue(HHStoredVarPrefixKey + SK.autoPoVCollect) === 'true'
      && ctx.canCollectCompetitionActive;
    const collectAllGate = getStoredValue(HHStoredVarPrefixKey + SK.autoPoVCollectAll) === 'true'
      && checkTimer('nextPoVCollectAllTime')
      && (getTimer('PoVRemainingTime') === -1 || getSecondsLeft('PoVRemainingTime') < getLimitTimeBeforeEnd());
    return collectGate || collectAllGate;
  },
  steps: [{
    name: 'collectPoV',
    fn: async (ctx) => {
      try {
        logHHAuto('Time to go and check Path of Valor for collecting reward.');
        ctx.busy = PathOfValue.goAndCollect();
        ctx.lastActionPerformed = 'pov';
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

const handlePoGCollect: HandlerConfig = {
  name: 'handlePoGCollect',
  minIntervalMs: 5_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') return false;
    if (!PathOfGlory.isEnabled()) return false;
    if (ctx.lastActionPerformed !== 'none' && ctx.lastActionPerformed !== 'pog') return false;
    const collectGate = checkTimer('nextPoGCollectTime')
      && getStoredValue(HHStoredVarPrefixKey + SK.autoPoGCollect) === 'true'
      && ctx.canCollectCompetitionActive;
    const collectAllGate = getStoredValue(HHStoredVarPrefixKey + SK.autoPoGCollectAll) === 'true'
      && checkTimer('nextPoGCollectAllTime')
      && (getTimer('PoGRemainingTime') === -1 || getSecondsLeft('PoGRemainingTime') < getLimitTimeBeforeEnd());
    return collectGate || collectAllGate;
  },
  steps: [{
    name: 'collectPoG',
    fn: async (ctx) => {
      try {
        logHHAuto('Time to go and check Path of Glory for collecting reward.');
        ctx.busy = PathOfGlory.goAndCollect();
        ctx.lastActionPerformed = 'pog';
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

const handleSalary: HandlerConfig = {
  name: 'handleSalary',
  minIntervalMs: 5_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (ConfigHelper.getHHScriptVars('isEnabledSalary', false) !== true) return false;
    if (getStoredValue(HHStoredVarPrefixKey + SK.autoSalary) !== 'true') return false;
    if (ctx.currentPage !== ConfigHelper.getHHScriptVars('pagesIDHome')) return false;
    if (getStoredValue(HHStoredVarPrefixKey + SK.paranoia) === 'true' && checkTimer('paranoiaSwitch')) return false;
    if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') return false;
    if (ctx.lastActionPerformed !== 'none' && ctx.lastActionPerformed !== 'salary') return false;
    if (!checkTimer('nextSalaryTime')) return false;
    return true;
  },
  steps: [{
    name: 'getSalary',
    fn: async (ctx) => {
      try {
        ctx.busy = await HaremSalary.getSalary();
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

const handleBossBangParse: HandlerConfig = {
  name: 'handleBossBangParse',
  minIntervalMs: 5_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (ConfigHelper.getHHScriptVars('isEnabledBossBangEvent', false) !== true) return false;
    if (getStoredValue(HHStoredVarPrefixKey + SK.bossBangEvent) !== 'true') return false;
    if (ctx.lastActionPerformed !== 'none' && ctx.lastActionPerformed !== 'event') return false;
    const onEvent = ctx.currentPage === ConfigHelper.getHHScriptVars('pagesIDEvent');
    const hasIncompleteOnPage = onEvent && $('#contains_all #events #boss_bang .completed-event').length === 0;
    const hasParseTarget = ctx.bossBangEventIDs.length > 0 && !onEvent;
    return hasParseTarget || hasIncompleteOnPage;
  },
  steps: [{
    name: 'parseBossBang',
    fn: async (ctx) => {
      try {
        logHHAuto('Going to parse boss bang event.');
        ctx.busy = await EventModule.parseEventPage(ctx.bossBangEventIDs[0]);
        ctx.lastActionPerformed = 'event';
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

const handleBossBangFight: HandlerConfig = {
  name: 'handleBossBangFight',
  minIntervalMs: 5_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (ConfigHelper.getHHScriptVars('isEnabledBossBangEvent', false) !== true) return false;
    if (getStoredValue(HHStoredVarPrefixKey + SK.bossBangEvent) !== 'true') return false;
    if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') return false;
    if (ctx.lastActionPerformed !== 'none' && ctx.lastActionPerformed !== 'bossBang') return false;
    if (!checkTimer('nextBossBangTime')) return false;
    const onEvent = ctx.currentPage === ConfigHelper.getHHScriptVars('pagesIDEvent');
    const hasIncompleteOnPage = onEvent && $('#contains_all #events #boss_bang .completed-event').length === 0;
    const hasFightTarget = ctx.bossBangEventIDs.length > 0 && !onEvent;
    return hasFightTarget || hasIncompleteOnPage;
  },
  steps: [{
    name: 'fightBossBang',
    fn: async (ctx) => {
      try {
        logHHAuto('Going to fight boss bang.');
        ctx.busy = await BossBang.goToFightPage(ctx.bossBangEventIDs[0]);
        ctx.lastActionPerformed = 'bossBang';
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

const handleGoHome: HandlerConfig = {
  name: 'handleGoHome',
  minIntervalMs: 2_000,
  atomic: false,
  interruptible: 'always',
  precondition: (ctx) => {
    if (ctx.busy) return false;
    if (ctx.currentPage === ConfigHelper.getHHScriptVars('pagesIDHome')) return false;
    const lastPageCalled = getStoredJSON(HHStoredVarPrefixKey + TK.LastPageCalled, { page: '', dateTime: 0 });
    if (ctx.currentPage !== lastPageCalled.page) return false;
    const cooldown = ConfigHelper.getHHScriptVars('minSecsBeforeGoHomeAfterActions') as number;
    if ((new Date().getTime() - lastPageCalled.dateTime) <= cooldown * 1000) return false;
    return true;
  },
  steps: [{
    name: 'gotoHome',
    fn: async (ctx) => {
      try {
        logHHAuto('Back to home page at the end of actions');
        deleteStoredValue(HHStoredVarPrefixKey + TK.LastPageCalled);
        ctx.busy = gotoPage(ConfigHelper.getHHScriptVars('pagesIDHome'));
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err), retryable: true };
      }
    },
  }],
};

// ---------------------------------------------------------------------------
//  Pipeline: ordered list of all handler configurations.
//
//  ORDER MATTERS: position in this array = priority. Earlier elements run
//  first. To reorder a handler (e.g. move PoP to the end, or place the Mythic
//  Wave handler at slot 3), move its entry within this array. No priority
//  numbers to keep in sync.
//
//  The Scheduler walks the list once per tick, picks the first ready handler
//  (precondition true, cool-down elapsed, state IDLE), and runs it.
//
//  Migration history: all 33 AutoLoop action handlers now live in this
//  array (3.2.G.a -> 3.2.G.complete). The classic handler block in
//  AutoLoop.autoLoop() is gone; the Scheduler is the sole driver.
//
//  Order is the agreed user-facing priority sequence: high-yield /
//  low-cost actions (salary, shop, missions) and resource collectors
//  before the long battle / quest / labyrinth blocks. handleEventParsing
//  is locked at slot 1 because it populates event/mythic-girl data that
//  later handlers (handleTrollBattle, the collect handlers) read.
//
//  Producer/consumer chain in the upper block (slots 2-5):
//   - slot 2 handleHaremSize: refreshes the TK.HaremSize cache (girl
//     count + timestamp) consumed by every battle handler's synergy
//     and team-power calculation.
//   - slot 3 handleSalary: cheap one-click action with no dependents,
//     parked here because it is essentially free.
//   - slot 4 handleShop: writes the storeContents / charLevel /
//     boosterStatus / boosterIdMap snapshot.
//   - slot 5 handleAutoEquipBoosters: reads the booster snapshot
//     produced by handleShop. Must run after handleShop in the same
//     tick so equip decisions see fresh inventory.
//
//  handleGoHome is locked at the tail because it closes the tick on a
//  non-home page. handleGenericBattle is kept just before handleGoHome
//  as a catch-all when the bot has landed on any battle page.
// ---------------------------------------------------------------------------

export const pipeline: HandlerConfig[] = [
  // handleMythicWave is intentionally not listed: it was a legacy slot
  // reservation used by the classic handleTrollBattle path and has no
  // effect in the pipeline model. The mythic girl is fully covered by
  // handleTrollBattle's activation paths.
  handleEventParsing,
  handleHaremSize,
  handleSalary,
  handleShop,
  handleAutoEquipBoosters,
  handleMissions,
  handlePachinko,
  handleSeasonalFreeCard,
  handleFreeBundles,
  handleSeasonCollect,
  handlePentaDrillCollect,
  handleSeasonalEventCollect,
  handleSeasonalRankCollect,
  handlePoVCollect,
  handlePoGCollect,
  handleContest,
  handleDailyGoals,
  handleChampionTicket,
  handlePlaceOfPower,
  handleClubChampion,
  handleChampion,
  handleLoveRaid,
  handleTrollBattle,
  handleBossBangParse,
  handleBossBangFight,
  handleLeague,
  handleSeason,
  handleQuest,
  handlePantheon,
  handlePentaDrill,
  handleLabyrinth,
  handleGenericBattle,
  handleGoHome,
];
