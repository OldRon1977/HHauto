// Scheduler.ts -- Declarative pipeline scheduler runtime.
//
// Manages handler execution via a state machine. Each tick evaluates
// which handler should run next based on priority, preconditions,
// and min-interval constraints. Supports atomic chains (uninterruptible)
// and SOFT/HARD interrupt semantics.
//
// Depends on: Pipeline.config.ts (types), MouseService (SOFT), ParanoiaService (SOFT)
// Used by: AutoLoop.ts (calls Scheduler.tick() each iteration)

import { HandlerConfig, StepResult, pipeline } from './Pipeline.config';
import { mouseBusy } from './MouseService';
import { getStoredValue } from '../Helper/index';
import { HHStoredVarPrefixKey, SK } from '../config/index';
import { logHHAuto } from '../Utils/index';

/** Possible states for each handler in the pipeline */
export type HandlerState = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'INTERRUPTED';

/** Internal tracking for a currently executing chain */
interface ActiveChain {
  config: HandlerConfig;
  stepIdx: number;
  startedAt: number;
}

/** Default watchdog timeout if not specified per handler */
const DEFAULT_TOTAL_TIMEOUT_MS = 30_000;

/**
 * The Scheduler is a singleton that manages pipeline handler execution.
 * Call `Scheduler.tick()` once per AutoLoop iteration.
 */
export class Scheduler {
  private states: Map<string, HandlerState> = new Map();
  private lastRunAt: Map<string, number> = new Map();
  private currentChain: ActiveChain | null = null;

  /**
   * Main entry point. Called once per AutoLoop iteration.
   * Evaluates SOFT-interrupts, watchdog, active chains, and next-ready handlers.
   */
  async tick(): Promise<void> {
    // 1. SOFT-Interrupt check (always takes precedence)
    if (this.shouldSoftAbort()) {
      if (this.currentChain) {
        await this.abortAtSafePoint();
      }
      return;
    }

    // 2. Watchdog: kill hung chains
    if (this.currentChain && this.isHung(this.currentChain)) {
      logHHAuto(`[Scheduler] Watchdog: chain '${this.currentChain.config.name}' timed out`);
      await this.failChain('watchdog timeout');
    }

    // 3. If an atomic chain is running, continue it
    if (this.currentChain) {
      if (this.currentChain.config.atomic) {
        await this.continueCurrentChain();
        return;
      }
      // Non-atomic chain running: check for HARD interrupt
      const higherPrio = this.findHigherPriorityReady(this.currentChain.config.priority);
      if (higherPrio && this.currentChain.config.interruptible === 'always') {
        const interruptedName = this.currentChain.config.name;
        logHHAuto(`[Scheduler] HARD interrupt: '${higherPrio.name}' preempts '${interruptedName}'`);
        this.currentChain = null;
        this.states.set(interruptedName, 'IDLE');
        await this.startChain(higherPrio);
        return;
      }
      // Continue current non-atomic chain
      await this.continueCurrentChain();
      return;
    }

    // 4. No active chain: find next ready handler
    const next = this.findNextReady();
    if (next) {
      await this.startChain(next);
    }
  }

  /**
   * SOFT-interrupt conditions: user activity, master off, paranoia rest.
   * These ALWAYS cause abort, even for atomic chains (at safe point).
   */
  private shouldSoftAbort(): boolean {
    const masterOff = getStoredValue(HHStoredVarPrefixKey + SK.master) !== 'true';
    return masterOff || mouseBusy;
  }

  /**
   * Find the highest-priority handler that is ready to run.
   */
  private findNextReady(): HandlerConfig | null {
    return pipeline
      .filter(h => this.isIdle(h.name))
      .filter(h => this.minIntervalElapsed(h))
      .filter(h => h.precondition())
      .sort((a, b) => a.priority - b.priority)[0] ?? null;
  }

  /**
   * Find a ready handler with higher priority than the given threshold.
   */
  private findHigherPriorityReady(currentPriority: number): HandlerConfig | null {
    return pipeline
      .filter(h => h.priority < currentPriority)
      .filter(h => this.isIdle(h.name))
      .filter(h => this.minIntervalElapsed(h))
      .filter(h => h.precondition())
      .sort((a, b) => a.priority - b.priority)[0] ?? null;
  }

  /**
   * Start executing a handler chain from step 0.
   */
  private async startChain(config: HandlerConfig): Promise<void> {
    logHHAuto(`[Scheduler] Starting chain '${config.name}'`);
    this.states.set(config.name, 'RUNNING');
    this.currentChain = { config, stepIdx: 0, startedAt: Date.now() };
    await this.executeCurrentStep();
  }

  /**
   * Continue executing the current chain from where it left off.
   */
  private async continueCurrentChain(): Promise<void> {
    if (!this.currentChain) return;
    await this.executeCurrentStep();
  }

  /**
   * Execute the current step of the active chain.
   */
  private async executeCurrentStep(): Promise<void> {
    if (!this.currentChain) return;

    const { config, stepIdx } = this.currentChain;
    const step = config.steps[stepIdx];

    if (!step) {
      // All steps completed
      this.completeChain();
      return;
    }

    // Execute step with optional per-step timeout
    const timeoutMs = step.timeoutMs ?? config.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS;
    let result: StepResult;

    try {
      result = await this.executeWithTimeout(step.fn, timeoutMs);
    } catch (err) {
      result = { ok: false, reason: `Exception: ${err}`, retryable: false };
    }

    if (result.ok) {
      // Advance to next step
      this.currentChain.stepIdx++;
      if (this.currentChain.stepIdx >= config.steps.length) {
        this.completeChain();
      }
      // If more steps remain, they execute on the next tick (non-blocking)
    } else {
      // Step failed — cast needed because TS cannot narrow through try/catch reassignment
      const failure = result as { ok: false; reason: string; retryable: boolean };
      logHHAuto(`[Scheduler] Step '${step.name}' failed in '${config.name}': ${failure.reason}`);
      await this.failChain(failure.reason, step.name);
    }
  }

  /**
   * Mark chain as completed, reset state to IDLE.
   */
  private completeChain(): void {
    if (!this.currentChain) return;
    const name = this.currentChain.config.name;
    logHHAuto(`[Scheduler] Chain '${name}' completed`);
    this.states.set(name, 'IDLE');
    this.lastRunAt.set(name, Date.now());
    this.currentChain = null;
  }

  /**
   * Handle chain failure: call onFailure callback, reset state.
   */
  private async failChain(reason: string, failedStep?: string): Promise<void> {
    if (!this.currentChain) return;
    const { config } = this.currentChain;

    this.states.set(config.name, 'FAILED');
    this.currentChain = null;

    if (config.onFailure && failedStep) {
      try {
        await config.onFailure(failedStep, reason);
      } catch (err) {
        logHHAuto(`[Scheduler] onFailure callback threw for '${config.name}': ${err}`);
      }
    }

    // Reset to IDLE so handler can retry on next eligible tick
    this.states.set(config.name, 'IDLE');
    this.lastRunAt.set(config.name, Date.now());
  }

  /**
   * Abort at safe point (after current step completes).
   * Used for SOFT-interrupts on atomic chains.
   */
  private async abortAtSafePoint(): Promise<void> {
    if (!this.currentChain) return;
    const name = this.currentChain.config.name;
    logHHAuto(`[Scheduler] SOFT abort at safe point for '${name}'`);
    this.states.set(name, 'INTERRUPTED');
    this.currentChain = null;
    // Reset to IDLE for next opportunity
    this.states.set(name, 'IDLE');
  }

  /**
   * Check if a chain has exceeded its total timeout.
   */
  private isHung(chain: ActiveChain): boolean {
    const timeout = chain.config.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS;
    return Date.now() - chain.startedAt > timeout;
  }

  /**
   * Check if enough time has passed since last run.
   */
  private minIntervalElapsed(config: HandlerConfig): boolean {
    const lastRun = this.lastRunAt.get(config.name);
    if (lastRun === undefined) return true;
    return Date.now() - lastRun >= config.minIntervalMs;
  }

  /**
   * Check if handler is in IDLE state (or never ran).
   */
  private isIdle(name: string): boolean {
    const state = this.states.get(name);
    return state === undefined || state === 'IDLE';
  }

  /**
   * Execute a function with a timeout. Rejects if timeout exceeded.
   */
  private executeWithTimeout(fn: () => Promise<StepResult>, timeoutMs: number): Promise<StepResult> {
    return new Promise<StepResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Step timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      fn().then(result => {
        clearTimeout(timer);
        resolve(result);
      }).catch(err => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  // --- Public API for testing and debugging ---

  /** Get current state of a handler */
  getState(name: string): HandlerState | undefined {
    return this.states.get(name);
  }

  /** Get the currently active chain (if any) */
  getActiveChain(): { name: string; stepIdx: number } | null {
    if (!this.currentChain) return null;
    return { name: this.currentChain.config.name, stepIdx: this.currentChain.stepIdx };
  }

  /** Reset all state (for testing) */
  reset(): void {
    this.states.clear();
    this.lastRunAt.clear();
    this.currentChain = null;
  }
}

/** Singleton instance */
export const scheduler = new Scheduler();
