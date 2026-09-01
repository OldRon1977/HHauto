// BlockScheduler.ts -- reload-safe block execution engine.
//
// Runs one uninterrupted BlockRun at a time and persists its progress across
// reloads. All side-effecting dependencies (clock, storage, page, home-routing,
// version, logging) are injected as ports, so the engine is unit-testable
// without the DOM. BlockPipeline builds it and index.ts drives it, one tick per
// auto-loop iteration.
//
// See docs/decisions/ADR-004-pipeline-block-architecture.md.
import { AutoLoopContext } from "./AutoLoopContext";
import { Block, BlockFocus, BlockOrder, BlockRegistry, BlockRun, Step } from "./BlockTypes";

export interface DisabledEntry { reason: string; sinceVersion: string; }

/** Injected side-effecting dependencies; BlockPipeline supplies the real ones. */
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
  /** Focused activity (#1841); null = the pipeline is free to pick anything. */
  getFocus(): BlockFocus | null;
  setFocus(v: BlockFocus | null): void;
  /** Structured log sink; PipeLogger formats the [PIPE] lines. */
  log(event: Record<string, unknown>): void;
}

export interface SchedulerConfig {
  failureThreshold: number;
  // No-progress watchdog: a run is aborted only if it makes no progress (no
  // step advance, no repeat) for this long. There is deliberately no
  // per-invocation or total-runtime cap -- a continuously working block, such as
  // a 70-draft champion team build over many minutes, must run to completion and
  // set its own timer before releasing, and a fixed cap would abort that work
  // mid-flight and have it re-selected and re-done. A genuinely hung step (an
  // await that never resolves) parks the event loop and is recovered by
  // master-off or a reload.
  noProgressMs: number;
  cooldownMs: number;           // cool-down after an abort
  // Dormant-gap threshold: a gap between two ticks larger than this means the
  // scheduler was not running (mouse pause, frozen/backgrounded tab, OS sleep),
  // not that the active run made no progress. Used to rebase the no-progress
  // anchor so the watchdog measures only contiguous active ticking time. Set
  // well above the normal autoLoop cadence (~1s) so a healthy busy run is never
  // rebased; only real dormancy crosses it.
  dormantGapMs: number;
  // How long the pipeline waits for the focused block before giving the slot
  // back to the order (#1841). It only ever waits out a block's own
  // minInterval/cool-down -- 4 s for trolls, 2 s for most others -- so this is
  // a backstop, not the normal cadence. Too small and the switching returns;
  // too large and a block that quietly stopped being ready stalls everything.
  focusWaitMs: number;
  // Backstop against a focus that can never be served: an interrupter that
  // stays ready forever would keep being offered the slot and the activity
  // would never end. If the focused block has not managed a run in this long,
  // the focus is stale and the order takes over -- which is exactly the
  // behaviour before #1841, so the worst case degrades to the old one.
  focusStaleMs: number;
  /** How long a held run survives an autoLoop that a navigation switched off. */
  navigationGraceMs: number;
}

const DEFAULT_CONFIG: SchedulerConfig = {
  failureThreshold: 3,
  noProgressMs: 300_000,   // 5 min without any step progress -> treat as hung
  cooldownMs: 60_000,
  dormantGapMs: 30_000,    // 30s gap (>>1s cadence) = scheduler was dormant
  focusWaitMs: 30_000,     // backstop; real waits are the blocks' 2-4s intervals
  focusStaleMs: 300_000,   // 5 min without the focused block running = give up
  navigationGraceMs: 30_000,  // a navigation resolves in seconds; a paranoia rest does not
};

/** Short signature of a failure reason for the per-signature failure counter. */
function shortSig(reason: string): string {
  return reason.split(/\s|:/).slice(0, 3).join(":").slice(0, 48);
}

export class BlockScheduler {
  private run: BlockRun | null = null;
  private restoredFromStore = false;
  private tickCount = 0;  // log correlation: incremented once per tick()
  private lastTickAt = 0; // wall-clock of the previous tick(); 0 = no tick yet
  /** When this page context first saw the autoLoop flag off (0 = it is on). */
  private autoLoopOffSince = 0;
  private readonly cfg: SchedulerConfig;

  constructor(
    private readonly registry: BlockRegistry,
    private order: BlockOrder,
    private readonly ports: SchedulerPorts,
    cfg: Partial<SchedulerConfig> = {},
  ) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
    // Restore a run that survived a reload, and clear auto-disable entries
    // from an older script version so an updated script retries once.
    this.reconcileVersionResets();
    this.run = this.ports.loadRun();
    this.restoredFromStore = this.run !== null;
  }

  /** Update the effective order (e.g. after a settings change). */
  setOrder(order: BlockOrder): void { this.order = order; }

  getActiveRun(): BlockRun | null { return this.run; }

  /** Drop auto-disable entries from a previous script version. */
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

  /** Manual or version-triggered reactivation clears auto-disable + counter. */
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
    const now = this.ports.now();
    // Dormant-gap rebasing: autoLoop reschedules itself via setTimeout(~1s). When
    // the gap since the previous tick is far larger than that cadence, the
    // scheduler was dormant (mouse pause holds blockTick, a frozen/backgrounded
    // tab suspends the timer, the OS slept) -- the wall-clock advanced while no
    // ticking happened. That gap is not no-progress of the active run. Push the
    // active run's anchor forward by the gap so the no-progress watchdog measures
    // only contiguous active ticking time, not dormant wall-clock.
    const gap = this.lastTickAt === 0 ? 0 : now - this.lastTickAt;
    this.lastTickAt = now;
    // Stop-check: the script is off -> discard the run, no home routing. The
    // master switch is the user saying stop.
    if (this.ports.isMasterOff()) {
      this.autoLoopOffSince = 0;
      if (this.run) {
        this.emit({ ev: "abort", block: this.run.blockId, detail: "master-off" });
        this.run = null;
        this.ports.clearRun();
      }
      this.releaseFocus("master-off");
      return;
    }

    // The autoLoop flag is NOT the user saying stop: gotoPage, safeReload and
    // the fight paths switch it off themselves, right before the page goes
    // away. Discarding the run on that tick throws away work a block has
    // explicitly held, one scheduler tick after the script's own "setting
    // autoloop to false". A navigation resolves in seconds, so a held run gets
    // navigationGraceMs to be carried away by its reload. What keeps the flag
    // off for longer is a real stop -- the paranoia rest -- and there the run
    // is discarded.
    if (this.ports.isAutoLoopOff()) {
      if (this.autoLoopOffSince === 0) this.autoLoopOffSince = now;
      if (this.run && now - this.autoLoopOffSince <= this.cfg.navigationGraceMs) return;
      if (this.run) {
        this.emit({ ev: "abort", block: this.run.blockId, detail: "autoloop-off" });
        this.run = null;
        this.ports.clearRun();
      }
      this.releaseFocus("autoloop-off");
      return;
    }
    this.autoLoopOffSince = 0;

    if (!this.run) this.run = this.ports.loadRun();

    if (this.run) {
      if (gap > this.cfg.dormantGapMs) {
        this.run.stepStartedAt += gap;
        this.ports.saveRun(this.run);
        this.emit({ ev: "rebase", block: this.run.blockId, detail: "dormant-gap:" + gap });
      }
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

    // First handling after a reload: resume validation, and a dispatched step
    // is not run twice.
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
        run.acted = true;   // it dispatched before the reload (#1841)
        run.stepStartedAt = this.ports.now();
        this.ports.saveRun(run);
        if (run.stepIdx >= block.steps.length) { this.complete(block, run); return; }
      } else {
        // A valid resume after a reload IS progress for reload-based slot-hold
        // blocks (PoP: one powerplace per reload; Champion: one draft per reload).
        // Their step.fn navigates and triggers a reload, so it never returns
        // repeat/advance to the scheduler, so the executeStep resets below never
        // run. Bumping the anchor on every live re-entry keeps the no-progress
        // watchdog from measuring since run start and killing legit long work;
        // it then fires only when the block stops resuming.
        // Coming back after a reload is also proof that the block acted
        // (#1841): only navigating gets you a new page. For a fighting handler
        // this is the only place the flag can be set -- its step awaits the
        // battle POST, the response navigates, and the step never returns, so
        // the write in executeStep dies with the page and the run would come
        // back looking as if it had done nothing.
        run.acted = true;
        run.stepStartedAt = this.ports.now();
        this.ports.saveRun(run);
        this.emit({ ev: "resume", block: block.id, step: next?.name, detail: "valid" });
      }
    }

    // No-progress watchdog (checked AFTER the restore-resume handling above): a
    // valid resume after a reload IS progress and resets stepStartedAt, so the
    // watchdog must run after it -- otherwise the first tick after a reload that
    // followed a long dormant period (frozen/backgrounded tab, OS sleep) would
    // abort a healthy reload-based run on its stale persisted anchor before the
    // resume reset could refresh it. Such a false abort, repeated
    // failureThreshold times for the same signature, auto-disables the block. A working
    // block keeps resetting stepStartedAt (resume/advance/repeat), so it never
    // times out; only a genuinely stuck run (re-entered across ticks without
    // advancing) is aborted + routed home.
    if (this.ports.now() - run.stepStartedAt > this.cfg.noProgressMs) {
      await this.abort(run, "no-progress-timeout"); return;
    }

    // A held run continues only while the block
    // still WANTS to run. Re-check the precondition on every continuation; once
    // it no longer holds (e.g. a navigate-only block such as HaremSize has
    // reached its target page, so its precondition page-guard flips false),
    // release the slot instead of re-running the step -- otherwise the slot-hold
    // re-runs gotoPage(sameTarget) forever (the waifu->waifu loop). On a fresh
    // start the precondition was just verified true by findNext, so this is a
    // no-op there.
    if (!block.precondition(ctx)) {
      this.emit({ ev: "done", block: block.id, detail: "precondition no longer holds; releasing slot" });
      this.complete(block, run);
      return;
    }

    await this.executeStep(ctx, block, run);
  }

  private async executeStep(ctx: AutoLoopContext, block: Block, run: BlockRun): Promise<void> {
    const step = block.steps[run.stepIdx];
    if (!step) { this.complete(block, run); return; }

    if (step.stateChanging) {
      // Persist before acting: the dispatch marker survives the reload.
      run.dispatched = true;
      this.ports.saveRun(run);
      this.emit({ ev: "dispatch", block: block.id, step: step.name });
    }

    let result;
    try {
      // No per-invocation timeout: a long-but-legit handler call (e.g. a full
      // champion team build) must run to completion. A hung call is handled by
      // master-off/reload, not by aborting legit work.
      result = await step.fn(ctx, run);
    } catch (e) {
      await this.abort(run, "error:" + step.name + ":" + this.msg(e)); return;
    }

    if (result.ok) {
      run.dispatched = false;
      if (result.acted) run.acted = true;   // acted without holding the slot (#1841)
      if (result.repeat) {
        // Holding the slot is the handler saying it acted; that is
        // what makes this run worth keeping the focus for (#1841).
        run.acted = true;
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
    const now = this.ports.now();
    const last = this.ports.getLastRunAt();
    last[block.id] = now;
    this.ports.setLastRunAt(last);
    // #1841: finishing a run does not mean the activity is finished. A troll
    // run ends the moment the fight lands on the result page -- the block has
    // energy left and wants to go again. Keep the pipeline on it and let the
    // block's own precondition decide when it is really done (no energy,
    // threshold reached, timer set). Helpers never take the focus.
    //
    // Only a run that ACTED counts. A precondition says a block may run, not
    // that it has work: troll battle passes its gate and falls through when
    // the power is below the threshold. Such a run renewing the focus would
    // park the pipeline on a block that does nothing, every few seconds,
    // forever -- and the stale backstop could never fire, because the focus
    // kept being refreshed.
    if (block.holdsFocus !== false && run.acted === true) {
      // Logged, not just stored: without this the dump shows when the focus
      // was given up but never when it was taken, and "did the pipeline stay
      // on one activity" cannot be read out of it (#1841).
      if (this.ports.getFocus()?.blockId !== block.id) {
        this.emit({ ev: "focus", block: block.id, detail: "taken" });
      }
      this.ports.setFocus({ blockId: block.id, lastRunAt: now });
    } else if (this.ports.getFocus()?.blockId === block.id) {
      this.releaseFocus("ran without doing anything");
    }
    this.resetFailureCounts(block.id);  // success resets the block's counter
    this.run = null;
    this.ports.clearRun();
  }

  /** Abort path: clear run, count failure, set cool-down, route home. */
  private async abort(run: BlockRun, reason: string): Promise<void> {
    const blockId = run.blockId;
    this.emit({ ev: reason.startsWith("run-timeout") || reason.includes("timeout") ? "timeout" : "abort", block: blockId, detail: reason });

    // Persistent per-signature failure counter.
    const counts = this.ports.getFailureCounts();
    const sig = blockId + ":" + shortSig(reason);
    counts[sig] = (counts[sig] ?? 0) + 1;
    const count = counts[sig];
    this.ports.setFailureCounts(counts);

    // Auto-disable on threshold.
    if (count >= this.cfg.failureThreshold) {
      const disabled = this.ports.getAutoDisabled();
      disabled[blockId] = { reason, sinceVersion: this.ports.scriptVersion() };
      this.ports.setAutoDisabled(disabled);
      this.emit({ ev: "error", block: blockId, detail: "auto-disabled after " + count + " failures (" + reason + ")" });
    }

    // Cool-down.
    const cooldowns = this.ports.getCooldowns();
    cooldowns[blockId] = this.ports.now() + this.cfg.cooldownMs;
    this.ports.setCooldowns(cooldowns);

    this.run = null;
    this.ports.clearRun();
    this.releaseFocus("run aborted");
    await this.ports.routeHome();  // safe ground state
  }

  /**
   * Why a block cannot be picked right now.
   *  - 'ready'   -- go.
   *  - 'waiting' -- only its own clock is in the way (cool-down, minInterval).
   *                 It will be ready again shortly; worth waiting for.
   *  - 'no'      -- it is disabled or does not want to run. Nothing to wait for.
   * The three-way answer is what lets the focus tell "not yet" apart from
   * "finished" (#1841).
   */
  private eligibility(
    block: Block, ctx: AutoLoopContext, now: number,
    disabled: Record<string, DisabledEntry>,
    cooldowns: Record<string, number>,
    last: Record<string, number>,
  ): 'ready' | 'waiting' | 'no' {
    if (disabled[block.id]) return 'no';
    if ((cooldowns[block.id] ?? 0) > now) return 'waiting';
    if (now - (last[block.id] ?? 0) < block.minIntervalMs) return 'waiting';
    return block.precondition(ctx) ? 'ready' : 'no';
  }

  /** Drop the focused activity, so the order decides again. */
  private releaseFocus(reason: string): void {
    const focus = this.ports.getFocus();
    if (!focus) return;
    this.ports.setFocus(null);
    this.emit({ ev: "focus", block: focus.blockId, detail: "released: " + reason });
  }

  /**
   * Selection while one activity has the focus (#1841).
   *
   * Returns the block to run, `null` to wait a tick without giving the slot
   * away, or `undefined` for "no focus applies -- decide by the order".
   *
   * Without a focus the pipeline would leave an activity the moment one run
   * ends, which is every single fight: the fight lands on a battle-result page,
   * the block yields that page so the reward popup is parsed (#1740), and the
   * next block in the order takes the slot and navigates away. Holding the
   * focus keeps the pipeline on the same activity across that detour until the
   * block itself says it is done.
   */
  private pickUnderFocus(
    ctx: AutoLoopContext, focus: BlockFocus, now: number,
    disabled: Record<string, DisabledEntry>,
    cooldowns: Record<string, number>,
    last: Record<string, number>,
  ): Block | null | undefined {
    const block = this.registry[focus.blockId];
    if (!block) { this.releaseFocus("block gone"); return undefined; }
    if (now - focus.lastRunAt > this.cfg.focusStaleMs) {
      this.releaseFocus("stale");
      return undefined;
    }

    // Checked BEFORE the focused block, not only when it stalls: the collect
    // blocks gather rewards that expire with their event, and they must never
    // queue behind a fight that runs for as long as there is energy. They are
    // short, they set their own next-time timer, and they never take the focus,
    // so the activity continues right after. The other block marked this way is
    // handleGenericBattle -- the battle-result page a fight block hands over
    // (#1740) is exactly where the focused block is stuck, so the helper is
    // what puts it back on its feet.
    for (const id of this.order) {
      const helper = this.registry[id];
      if (!helper?.runsDuringFocus) continue;
      if (this.eligibility(helper, ctx, now, disabled, cooldowns, last) === 'ready') return helper;
    }

    const state = this.eligibility(block, ctx, now, disabled, cooldowns, last);
    if (state === 'ready') return block;

    // Only its own cool-down is in the way, and we have not waited long: hold
    // the slot idle rather than handing it to the next block for one tick and
    // taking it back -- that hand-over IS the switching being fixed.
    if (state === 'waiting' && now - focus.lastRunAt < this.cfg.focusWaitMs) return null;

    this.releaseFocus(state === 'waiting' ? "waited too long" : "nothing left to do");
    return undefined;
  }

  /** Idle block selection: order + not-disabled + cooldown + min-interval + precondition. */
  private findNext(ctx: AutoLoopContext): Block | null {
    const now = this.ports.now();
    const disabled = this.ports.getAutoDisabled();
    const cooldowns = this.ports.getCooldowns();
    const last = this.ports.getLastRunAt();

    const focus = this.ports.getFocus();
    if (focus) {
      const focused = this.pickUnderFocus(ctx, focus, now, disabled, cooldowns, last);
      if (focused !== undefined) return focused;
    }

    for (const id of this.order) {
      const block = this.registry[id];
      if (!block) continue;
      if (this.eligibility(block, ctx, now, disabled, cooldowns, last) !== 'ready') continue;
      return block;
    }
    return null;
  }

  /** Emit a structured log event with tick + run correlation. */
  private emit(fields: Record<string, unknown>): void {
    this.ports.log({
      tick: this.tickCount,
      run: this.run ? this.run.blockId + "@" + this.run.startedAt : undefined,
      ...fields,
    });
  }


  private msg(e: unknown): string {
    if (e instanceof Error) return e.message;
    return String(e);
  }
}
