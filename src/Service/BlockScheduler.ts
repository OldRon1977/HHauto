// BlockScheduler.ts -- reload-safe block execution engine
// (v7.37.0 pipeline-block architecture, ADR-001).
//
// Replaces the in-memory ActiveChain + SOFT/HARD-interrupt logic of the legacy
// Scheduler with a single ununterrupted BlockRun (R4.1/R4.2) whose progress is
// persisted across reloads. All side-effecting dependencies (clock, storage,
// page, home-routing, version, logging) are injected as ports so the engine is
// fully unit-testable without the DOM. The engine is wired into AutoLoop with
// the real registry/order in a later task; until then it is dead code and the
// legacy Scheduler stays in production (safe coexistence per ADR-001).
//
// Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10,
//               5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 5.8, 5.9
import { AutoLoopContext } from "./AutoLoopContext";
import { Block, BlockOrder, BlockRegistry, BlockRun, Step } from "./BlockTypes";

export interface DisabledEntry { reason: string; sinceVersion: string; }

/** Injected side-effecting dependencies. Task 6 supplies the real impls. */
export interface SchedulerPorts {
  now(): number;
  getCurrentPage(): string;
  isMasterOff(): boolean;
  isAutoLoopOff(): boolean;
  routeHome(): void | Promise<void>;
  scriptVersion(): string;
  loadRun(): BlockRun | null;
  saveRun(run: BlockRun): void;
  clearRun(): void;
  getCooldowns(): Record<string, number>;
  setCooldowns(v: Record<string, number>): void;
  getFailureCounts(): Record<string, number>;
  setFailureCounts(v: Record<string, number>): void;
  getAutoDisabled(): Record<string, DisabledEntry>;
  setAutoDisabled(v: Record<string, DisabledEntry>): void;
  getLastRunAt(): Record<string, number>;
  setLastRunAt(v: Record<string, number>): void;
  /** Structured log sink. Task 7 supplies the [PIPE] formatter. */
  log(event: Record<string, unknown>): void;
}

export interface SchedulerConfig {
  failureThreshold: number;     // R5.4
  stepTimeoutMs: number;        // R5.1 default
  totalTimeoutMs: number;       // R5.1 default
  cooldownMs: number;           // R4.10/R5.2 abort cool-down
}

const DEFAULT_CONFIG: SchedulerConfig = {
  failureThreshold: 3,
  stepTimeoutMs: 30_000,
  totalTimeoutMs: 120_000,
  cooldownMs: 60_000,
};

/** Short signature of a failure reason for the per-signature failure counter. */
function shortSig(reason: string): string {
  return reason.split(/\s|:/).slice(0, 3).join(":").slice(0, 48);
}

export class BlockScheduler {
  private run: BlockRun | null = null;
  private restoredFromStore = false;
  private tickCount = 0;  // R6.3 correlation: incremented once per tick()
  private readonly cfg: SchedulerConfig;

  constructor(
    private readonly registry: BlockRegistry,
    private order: BlockOrder,
    private readonly ports: SchedulerPorts,
    cfg: Partial<SchedulerConfig> = {},
  ) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
    // Restore a run that survived a reload (R4.4) and reconcile version-gated
    // auto-disable (R5.5: one retry after a script update).
    this.reconcileVersionResets();
    this.run = this.ports.loadRun();
    this.restoredFromStore = this.run !== null;
  }

  /** Update the effective order (e.g. after a settings change). */
  setOrder(order: BlockOrder): void { this.order = order; }

  getActiveRun(): BlockRun | null { return this.run; }

  /** R5.5: drop auto-disable entries from a previous script version. */
  private reconcileVersionResets(): void {
    const disabled = this.ports.getAutoDisabled();
    const version = this.ports.scriptVersion();
    let changed = false;
    for (const id of Object.keys(disabled)) {
      if (disabled[id].sinceVersion !== version) {
        delete disabled[id];
        this.resetFailureCounts(id);
        changed = true;
        this.emit({ ev: "reset", block: id, detail: "auto-disable cleared on version change" });
      }
    }
    if (changed) this.ports.setAutoDisabled(disabled);
  }

  /** R5.7: manual (or version) reactivation clears auto-disable + counter. */
  reactivate(blockId: string): void {
    const disabled = this.ports.getAutoDisabled();
    if (disabled[blockId]) {
      delete disabled[blockId];
      this.ports.setAutoDisabled(disabled);
    }
    this.resetFailureCounts(blockId);
    this.emit({ ev: "reset", block: blockId, detail: "block reactivated" });
  }

  private resetFailureCounts(blockId: string): void {
    const counts = this.ports.getFailureCounts();
    let changed = false;
    for (const sig of Object.keys(counts)) {
      if (sig.startsWith(blockId + ":")) { delete counts[sig]; changed = true; }
    }
    if (changed) this.ports.setFailureCounts(counts);
  }

  async tick(ctx: AutoLoopContext): Promise<void> {
    this.tickCount++;
    // 1. Stop-check: master/autoLoop off -> discard run, NO home routing (R4 / design).
    if (this.ports.isMasterOff() || this.ports.isAutoLoopOff()) {
      if (this.run) {
        this.emit({ ev: "abort", block: this.run.blockId, detail: "master-off" });
        this.run = null;
        this.ports.clearRun();
      }
      return;
    }

    if (!this.run) this.run = this.ports.loadRun();

    if (this.run) {
      await this.continueRun(ctx);
      return;
    }

    // 4. Idle: pick the next ready block.
    const block = this.findNext(ctx);
    if (!block) return;
    this.startRun(block);
    await this.continueRun(ctx);
  }

  private async continueRun(ctx: AutoLoopContext): Promise<void> {
    const run = this.run!;
    const block = this.registry[run.blockId];
    if (!block) { await this.abort(run, "block-missing"); return; }

    // Run-total timeout (R5.1).
    if (this.ports.now() - run.startedAt > (block.totalTimeoutMs ?? this.cfg.totalTimeoutMs)) {
      await this.abort(run, "run-timeout"); return;
    }

    // First handling after a reload: resume validation + at-most-once (R4.6/R4.9).
    if (this.restoredFromStore) {
      this.restoredFromStore = false;
      const next: Step | undefined = block.steps[run.stepIdx];
      if (next?.resumeValid && !next.resumeValid(ctx, run)) {
        this.emit({ ev: "resume", block: block.id, step: next.name, detail: "invalid" });
        await this.abort(run, "resume-invalid"); return;
      }
      if (run.dispatched) {
        this.emit({ ev: "resume", block: block.id, detail: "dispatched step skipped" });
        run.stepIdx++;
        run.dispatched = false;
        run.stepStartedAt = this.ports.now();
        this.ports.saveRun(run);
        if (run.stepIdx >= block.steps.length) { this.complete(block, run); return; }
      } else {
        this.emit({ ev: "resume", block: block.id, step: next?.name, detail: "valid" });
      }
    }

    await this.executeStep(ctx, block, run);
  }

  private async executeStep(ctx: AutoLoopContext, block: Block, run: BlockRun): Promise<void> {
    const step = block.steps[run.stepIdx];
    if (!step) { this.complete(block, run); return; }

    // Step timeout across ticks/reloads (R5.1).
    const stepTimeout = step.timeoutMs ?? block.stepTimeoutMs ?? this.cfg.stepTimeoutMs;
    if (this.ports.now() - run.stepStartedAt > stepTimeout) {
      await this.abort(run, "step-timeout:" + step.name); return;
    }

    if (step.stateChanging) {
      // persist-before-act (R6.13): the dispatch marker survives the reload.
      run.dispatched = true;
      this.ports.saveRun(run);
      this.emit({ ev: "dispatch", block: block.id, step: step.name });
    }

    let result;
    try {
      result = await this.withTimeout(() => step.fn(ctx, run), stepTimeout, step.name);
    } catch (e) {
      await this.abort(run, "error:" + step.name + ":" + this.msg(e)); return;
    }

    if (result.ok) {
      run.dispatched = false;
      if (result.repeat) {
        run.stepStartedAt = this.ports.now();
        this.ports.saveRun(run);
        this.emit({ ev: "done", block: block.id, step: step.name, detail: "repeat" });
        return;
      }
      run.stepIdx++;
      run.stepStartedAt = this.ports.now();
      this.ports.saveRun(run);
      this.emit({ ev: "done", block: block.id, step: step.name });
      if (result.done || run.stepIdx >= block.steps.length) this.complete(block, run);
    } else {
      await this.abort(run, "fail:" + step.name + ":" + result.reason);
    }
  }

  private startRun(block: Block): void {
    const now = this.ports.now();
    this.run = {
      blockId: block.id,
      stepIdx: 0,
      startedAt: now,
      stepStartedAt: now,
      dispatched: false,
      data: {},
    };
    this.restoredFromStore = false;
    this.ports.saveRun(this.run);
    this.emit({ ev: "start", block: block.id, page: this.ports.getCurrentPage() });
  }

  private complete(block: Block, run: BlockRun): void {
    this.emit({ ev: "done", block: block.id, detail: "run complete" });
    const last = this.ports.getLastRunAt();
    last[block.id] = this.ports.now();
    this.ports.setLastRunAt(last);
    this.resetFailureCounts(block.id);  // success resets the block's counter
    this.run = null;
    this.ports.clearRun();
  }

  /** Abort path (R4.10): clear run, count failure, cool-down, route home. */
  private async abort(run: BlockRun, reason: string): Promise<void> {
    const blockId = run.blockId;
    this.emit({ ev: reason.startsWith("run-timeout") || reason.includes("timeout") ? "timeout" : "abort", block: blockId, detail: reason });

    // Persistent per-signature failure counter (R5.3).
    const counts = this.ports.getFailureCounts();
    const sig = blockId + ":" + shortSig(reason);
    counts[sig] = (counts[sig] ?? 0) + 1;
    const count = counts[sig];
    this.ports.setFailureCounts(counts);

    // Auto-disable on threshold (R5.4).
    if (count >= this.cfg.failureThreshold) {
      const disabled = this.ports.getAutoDisabled();
      disabled[blockId] = { reason, sinceVersion: this.ports.scriptVersion() };
      this.ports.setAutoDisabled(disabled);
      this.emit({ ev: "error", block: blockId, detail: "auto-disabled after " + count + " failures (" + reason + ")" });
    }

    // Cool-down (R4.10/R5.2).
    const cooldowns = this.ports.getCooldowns();
    cooldowns[blockId] = this.ports.now() + this.cfg.cooldownMs;
    this.ports.setCooldowns(cooldowns);

    this.run = null;
    this.ports.clearRun();
    await this.ports.routeHome();  // safe ground state (R4.10)
  }

  /** Idle block selection (R4.3): order + enabled + not-disabled + cooldown + min-interval + precondition. */
  private findNext(ctx: AutoLoopContext): Block | null {
    const now = this.ports.now();
    const disabled = this.ports.getAutoDisabled();
    const cooldowns = this.ports.getCooldowns();
    const last = this.ports.getLastRunAt();
    for (const id of this.order) {
      const block = this.registry[id];
      if (!block) continue;
      if (disabled[id]) continue;
      if ((cooldowns[id] ?? 0) > now) continue;
      if (now - (last[id] ?? 0) < block.minIntervalMs) continue;
      if (!block.precondition(ctx)) continue;
      return block;
    }
    return null;
  }

  /** Emit a structured log event with tick + run correlation (R6.3). */
  private emit(fields: Record<string, unknown>): void {
    this.ports.log({
      tick: this.tickCount,
      run: this.run ? this.run.blockId + "@" + this.run.startedAt : undefined,
      ...fields,
    });
  }

  private withTimeout<T>(fn: () => Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("step-timeout:" + label));
      }, ms);
      fn().then(
        (v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } },
        (e) => { if (!settled) { settled = true; clearTimeout(timer); reject(e); } },
      );
    });
  }

  private msg(e: unknown): string {
    if (e instanceof Error) return e.message;
    return String(e);
  }
}
