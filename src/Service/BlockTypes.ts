// BlockTypes.ts -- core data types of the block pipeline.
//
// These types model the data-driven pipeline with a reload-safe BlockRun: the
// run and its progress live in storage, not in memory, so a page reload does
// not lose them.
//
// See docs/decisions/ADR-004-pipeline-block-architecture.md.
import { AutoLoopContext } from "./AutoLoopContext";

/**
 * Result of a single Step execution.
 *
 * On success, `repeat: true` re-runs the SAME step (reload-safe loop cursor);
 * `done: true` ends the block early. On failure, `retryable` signals
 * whether the watchdog should treat the failure as transient.
 */
export type BlockStepResult =
  | { ok: true; done?: boolean; repeat?: boolean; acted?: boolean }
  | { ok: false; reason: string; retryable: boolean };

/**
 * How a Step relates to a page reload:
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
  /** Human-readable step name for structured logging. */
  name: string;
  /** Performs the step. */
  fn: (ctx: AutoLoopContext, run: BlockRun) => Promise<BlockStepResult>;
  /** Reload relationship. Default 'none'. */
  reload?: StepReloadKind;
  /** State-changing steps get an at-most-once dispatch marker. */
  stateChanging?: boolean;
  /** Per-step timeout override in ms. */
  timeoutMs?: number;
  /**
   * After a reload, checks that the expected page/state is present before this
   * step runs. Returning false makes the scheduler abort the run instead
   * of executing the step in the wrong state. Absent = always valid (the step
   * guards itself).
   */
  resumeValid?: (ctx: AutoLoopContext, run: BlockRun) => boolean;
}

/**
 * A relative ordering constraint declared on a Block. Hard constraints
 * (default) make an order illegal when violated; soft constraints only emit an
 * advisory log. `beforeAll`/`afterAll` pin a block to the
 * effective first/last position.
 */
export type OrderConstraint =
  | { kind: 'runsBefore' | 'runsAfter'; block: string; hard: boolean }
  | { kind: 'beforeAll' | 'afterAll'; hard: boolean };

/**
 * Static definition of a user-visible script function (League, Quest, Salary,
 * ...). Replaces HandlerConfig. Carries only its steps and declared metadata;
 * it never hard-codes a global order assumption.
 */
export interface Block {
  /** Stable, unique id used by order list, enable state and logging. */
  id: string;
  /** "Is this block due?" -- reads the existing feature settings. */
  precondition: (ctx: AutoLoopContext) => boolean;
  /** Ordered steps. */
  steps: Step[];
  /** UI reorder visibility only, not legality. Default false. */
  userMovable: boolean;
  /** Relative ordering constraints. */
  constraints?: OrderConstraint[];
  /** Cool-down between two runs of this block, in ms. */
  minIntervalMs: number;
  /** Watchdog: max ms for a single step. */
  stepTimeoutMs?: number;
  /** Watchdog: max ms for the whole block-run. */
  totalTimeoutMs?: number;
  /**
   * Whether finishing a run makes this block the focused activity (#1841).
   * Default true: a block that just did a piece of work keeps the pipeline's
   * attention until it has nothing left to do, so one activity is finished
   * before the next is started. False for infra that only serves other blocks
   * (go-home, event parsing, the battle-result handler) -- letting those take
   * the focus would park the pipeline on a helper.
   */
  holdsFocus?: boolean;
  /**
   * Whether this block may run while ANOTHER block holds the focus (#1841),
   * and is offered the slot before the focused block itself.
   *
   * Two kinds qualify. The collect blocks gather rewards that expire when
   * their event ends, so they must not queue behind a fight that runs for as
   * long as there is energy. And handleGenericBattle parses the reward popup
   * on a battle-result page (#1740) -- the page a fight block hands over, and
   * therefore exactly where the focused block is stuck.
   *
   * Everything marked this way must also set `holdsFocus: false`, or it would
   * take the focus from the activity it just interrupted.
   */
  runsDuringFocus?: boolean;
}

/**
 * The activity the pipeline is currently seeing through (#1841).
 *
 * Persisted (sessionStorage) because the interesting case spans reloads: a
 * fight ends on a battle-result page, the page reloads, and the focus is what
 * brings the same block back afterwards instead of letting the next one in the
 * order take over.
 */
export interface BlockFocus {
  /** Id of the focused block. */
  blockId: string;
  /** When that block last completed a run -- bounds how long the focus waits. */
  lastRunAt: number;
}

/**
 * Runtime memory of a currently executing block. Replaces ActiveChain and is
 * now PERSISTENT (sessionStorage) so it survives planned and unplanned reloads
 *. Continuation lives here instead of the global
 * lastActionPerformed token.
 */
export interface BlockRun {
  /** Id of the block currently running. */
  blockId: string;
  /** Index of the next step to execute. */
  stepIdx: number;
  /** Run start timestamp (ms) -- run-total timeout. */
  startedAt: number;
  /** Current step start timestamp (ms) -- step timeout. */
  stepStartedAt: number;
  /** At-most-once marker for the current state-changing step. */
  dispatched: boolean;
  /** Repeat cursor + cross-step state, persisted with the run. */
  data: Record<string, unknown>;
  /**
   * Whether this run ever actually did something (#1841).
   *
   * A block's precondition says it MAY run, not that it has work: troll battle
   * passes its gate and then falls through when the power is below the
   * threshold or there is no event girl, which on a live session is the
   * majority of its ticks. Such a run must not keep the pipeline's focus, or
   * a block that has nothing to do parks the whole pipeline on itself.
   *
   * Set when a step holds the slot (`repeat`), which is the slot-hold signal
   * that the handler acted -- navigated, fought, collected.
   */
  acted?: boolean;
}

/** Registry: all block definitions, keyed by stable id. */
export type BlockRegistry = Record<string, Block>;

/** Order specification: an ordered list of block ids. */
export type BlockOrder = string[];
