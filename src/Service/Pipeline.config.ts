// Pipeline.config.ts -- Declarative pipeline configuration for the Scheduler.
//
// Defines the types and interfaces for handler configurations.
// Concrete handler implementations are added in later sessions.
//
// Used by: Scheduler.ts

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

/**
 * The pipeline: ordered list of all handler configurations.
 * Handlers are evaluated by priority (ascending) each tick.
 * Concrete entries are added as handlers are migrated.
 */
export const pipeline: HandlerConfig[] = [];
