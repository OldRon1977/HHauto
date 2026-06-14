// BlockTypes.ts -- Core data types for the v7.37.0 pipeline-block architecture.
//
// Introduced in Roadmap step 17 (ADR-001). These types model the data-driven
// block pipeline with a reload-safe BlockRun, replacing the in-memory
// ActiveChain + lastActionPerformed continuation of the v7.36.x scheduler.
//
// This file is purely additive in task 2 (definitions + storage keys). The
// scheduler is rewired onto these types in task 5; until then the legacy
// HandlerConfig/ChainStep/ActiveChain types in Pipeline.config.ts and
// Scheduler.ts remain in use (safe coexistence per ADR-001).
//
// Requirements: 1.4, 2.1, 2.2, 3.1, 3.7
import { AutoLoopContext } from "./AutoLoopContext";

/**
 * Result of a single Step execution.
 *
 * On success, `repeat: true` re-runs the SAME step (reload-safe loop cursor,
 * R4.5); `done: true` ends the block early. On failure, `retryable` signals
 * whether the watchdog should treat the failure as transient.
 */
export type BlockStepResult =
  | { ok: true; done?: boolean; repeat?: boolean }
  | { ok: false; reason: string; retryable: boolean };

/**
 * How a Step relates to a page reload (R4.5):
 * - 'trigger': the step itself triggers a reload (gotoPage / safeReload).
 * - 'wait':    the step waits for AJAX idle in the same page context.
 * - 'none':    a plain in-page step (default).
 */
export type StepReloadKind = 'trigger' | 'wait' | 'none';

/**
 * Smallest execution unit of a Block (one AJAX call, one click, one reload
 * boundary). Receives the shared AutoLoop context and the active BlockRun so
 * it can read/write reload-persisted cursor state in `run.data`.
 */
export interface Step {
  /** Human-readable step name for structured logging (R6.5). */
  name: string;
  /** Performs the step. */
  fn: (ctx: AutoLoopContext, run: BlockRun) => Promise<BlockStepResult>;
  /** Reload relationship (R4.5). Default 'none'. */
  reload?: StepReloadKind;
  /** State-changing steps get an at-most-once dispatch marker (R4.9). */
  stateChanging?: boolean;
  /** Per-step timeout override in ms (R5.1). */
  timeoutMs?: number;
  /**
   * After a reload, checks that the expected page/state is present before this
   * step runs (R4.6). Returning false makes the scheduler abort the run instead
   * of executing the step in the wrong state. Absent = always valid (the step
   * guards itself).
   */
  resumeValid?: (ctx: AutoLoopContext, run: BlockRun) => boolean;
}

/**
 * A relative ordering constraint declared on a Block (R3.1). Hard constraints
 * (default) make an order illegal when violated; soft constraints only emit an
 * advisory log (R3.2/R3.4). `beforeAll`/`afterAll` pin a block to the
 * effective first/last position.
 */
export type OrderConstraint =
  | { kind: 'runsBefore' | 'runsAfter'; block: string; hard: boolean }
  | { kind: 'beforeAll' | 'afterAll'; hard: boolean };

/**
 * Static definition of a user-visible script function (League, Quest, Salary,
 * ...). Replaces HandlerConfig. Carries only its steps and declared metadata;
 * it never hard-codes a global order assumption (R1.4).
 */
export interface Block {
  /** Stable, unique id used by order list, enable state and logging (R2.2). */
  id: string;
  /** "Is this block due?" -- reads the existing feature settings. */
  precondition: (ctx: AutoLoopContext) => boolean;
  /** Ordered steps (R1.2). */
  steps: Step[];
  /** UI reorder visibility only, NOT legality (R3.7). Default false. */
  userMovable: boolean;
  /** Relative ordering constraints (R3.1). */
  constraints?: OrderConstraint[];
  /** Cool-down between two runs of this block, ms (like legacy lastRunAt). */
  minIntervalMs: number;
  /** Watchdog: max ms for a single step (R5.1). */
  stepTimeoutMs?: number;
  /** Watchdog: max ms for the whole block-run (R5.1). */
  totalTimeoutMs?: number;
}

/**
 * Runtime memory of a currently executing block. Replaces ActiveChain and is
 * now PERSISTENT (sessionStorage) so it survives planned and unplanned reloads
 * (R4.4/R4.12). Continuation lives here instead of the global
 * lastActionPerformed token.
 */
export interface BlockRun {
  /** Id of the block currently running. */
  blockId: string;
  /** Index of the next step to execute. */
  stepIdx: number;
  /** Run start timestamp (ms) -- run-total timeout (R5.1). */
  startedAt: number;
  /** Current step start timestamp (ms) -- step timeout (R5.1). */
  stepStartedAt: number;
  /** At-most-once marker for the current state-changing step (R4.9). */
  dispatched: boolean;
  /** Repeat cursor + cross-step state, persisted with the run (R4.5). */
  data: Record<string, unknown>;
}

/** Registry: all block definitions, keyed by stable id (R2.1). */
export type BlockRegistry = Record<string, Block>;

/** Order specification: an ordered list of block ids (R2.1). */
export type BlockOrder = string[];
