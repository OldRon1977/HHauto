// Pipeline.config.ts -- Declarative pipeline configuration for the Scheduler.
//
// Defines the types and interfaces for handler configurations,
// plus concrete handler entries for migrated handlers.
//
// Used by: Scheduler.ts

import { LeagueHelper } from '../Module/index';
import { EventModule } from '../Module/Events/index';
import { ConfigHelper, getStoredValue } from '../Helper/index';
import { HHStoredVarPrefixKey, SK, TK } from '../config/index';
import { logHHAuto } from '../Utils/index';

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
  /** Async function that performs the step */
  fn: () => Promise<StepResult>;
  /** Per-step timeout in ms (optional, defaults to totalTimeoutMs / steps.length) */
  timeoutMs?: number;
}

/**
 * Complete configuration for a pipeline handler.
 */
export interface HandlerConfig {
  /** Unique handler name (used as key in state maps) */
  name: string;
  /** Execution priority: lower number = higher priority = runs first */
  priority: number;
  /** Minimum milliseconds between two runs of this handler */
  minIntervalMs: number;
  /** If true, the entire step chain runs as an uninterruptible unit */
  atomic: boolean;
  /** How this handler responds to HARD interrupts */
  interruptible: InterruptPolicy;
  /** Skip this handler if precondition returns false */
  precondition: () => boolean;
  /** Ordered list of steps to execute */
  steps: ChainStep[];
  /** Called when a step fails (for cleanup/recovery) */
  onFailure?: (failedStep: string, reason: string) => Promise<void>;
  /** Watchdog: max total ms for the entire chain (default: 30000) */
  totalTimeoutMs?: number;
}

// ---------------------------------------------------------------------------
//  Handler: handleEventParsing
//  Priority 1 (highest) -- runs nearly every tick.
//  Non-atomic, always interruptible.
//  Wraps: EventModule.parseEventPage()
// ---------------------------------------------------------------------------

const handleEventParsing: HandlerConfig = {
  name: 'handleEventParsing',
  priority: 1,
  minIntervalMs: 2_000,
  atomic: false,
  interruptible: 'always',
  precondition: () => {
    // Events feature must be enabled
    if (ConfigHelper.getHHScriptVars('isEnabledEvents', false) !== true) return false;

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
 */
export function getStaleEventIDs(now: number = Date.now()): string[] {
  try {
    const storedList = getStoredValue(HHStoredVarPrefixKey + TK.eventsList);
    const eventList = storedList ? JSON.parse(storedList) : {};
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

// ---------------------------------------------------------------------------
//  Handler: handleLeague
//  Priority 13 -- matches original AutoLoop ordering.
//  Atomic (fight sequence must not be interrupted).
//  Wraps: LeagueHelper.isTimeToFight() + LeagueHelper.doLeagueBattle()
// ---------------------------------------------------------------------------

const handleLeague: HandlerConfig = {
  name: 'handleLeague',
  priority: 13,
  minIntervalMs: 60_000,
  atomic: true,
  interruptible: 'never',
  precondition: () => {
    return LeagueHelper.isAutoLeagueActivated() && LeagueHelper.isTimeToFight();
  },
  steps: [
    {
      name: 'doLeagueBattle',
      fn: async (): Promise<StepResult> => {
        try {
          LeagueHelper.doLeagueBattle();
          return { ok: true };
        } catch (err) {
          return { ok: false, reason: String(err), retryable: true };
        }
      },
      timeoutMs: 25_000,
    },
  ],
  onFailure: async (failedStep: string, reason: string): Promise<void> => {
    logHHAuto('[Pipeline] handleLeague failed at ' + failedStep + ': ' + reason);
  },
  totalTimeoutMs: 30_000,
};

// ---------------------------------------------------------------------------
//  Pipeline: ordered list of all handler configurations.
//  Handlers are evaluated by priority (ascending) each tick.
// ---------------------------------------------------------------------------

export const pipeline: HandlerConfig[] = [
  handleEventParsing,
  handleLeague,
];
