// BlockPipeline.ts -- wiring of the v7.37.0 block scheduler into the running
// script (ADR-001, Roadmap step 17 task 6).
//
// Adapts the existing 33 HandlerConfig entries (Pipeline.config.ts) 1:1 into
// single-/multi-step Blocks (all current handlers are single-step), builds the
// default order from the current pipeline array order, and exposes a configured
// BlockScheduler singleton with real side-effecting ports. This REPLACES the
// legacy Scheduler in AutoLoop while keeping behaviour identical on the happy
// path: handler internals (precondition + step fn) are reused unchanged, so
// lastActionPerformed continuation keeps working (coexistence, R9.3). Block
// bundling, constraints and reload-safe multi-step decomposition come in later
// tasks.
//
// Requirements: 1.1, 1.2, 1.3, 9.1, 9.3, 9.4, 9.5
import { ConfigHelper } from "../Helper/ConfigHelper";
import { getPage } from "../Helper/PageHelper";
import { getStoredValue, getStoredJSON, setStoredValue } from "../Helper/StorageHelper";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK, TK } from "../config/StorageKeys";
import { logHHAuto } from "../Utils/LogUtils";
import { BlockScheduler, DisabledEntry, SchedulerPorts } from "./BlockScheduler";
import { Block, BlockOrder, BlockRegistry, BlockRun } from "./BlockTypes";
import { gotoPage } from "./PageNavigationService";
import { resolveOrder } from "./OrderResolver";
import { loadBlockRun, saveBlockRun, clearBlockRun } from "./BlockRunStore";
import { HandlerConfig, pipeline } from "./Pipeline.config";

/** Adapt one legacy HandlerConfig into a Block (1:1, handler logic reused). */
function toBlock(c: HandlerConfig): Block {
  return {
    id: c.name,
    precondition: c.precondition,
    steps: c.steps.map(s => ({
      name: s.name,
      // ChainStep.fn(ctx) returns StepResult, assignable to BlockStepResult.
      fn: (ctx: Parameters<typeof s.fn>[0]) => s.fn(ctx),
      timeoutMs: s.timeoutMs,
    })),
    userMovable: false,            // real flags assigned in the constraints task
    minIntervalMs: c.minIntervalMs,
    totalTimeoutMs: c.totalTimeoutMs,
  };
}

export function buildRegistryAndOrder(): { registry: BlockRegistry; defaultOrder: BlockOrder } {
  const registry: BlockRegistry = {};
  const defaultOrder: BlockOrder = [];
  for (const c of pipeline) {
    registry[c.name] = toBlock(c);
    defaultOrder.push(c.name);
  }
  return { registry, defaultOrder };
}

// --- real ports -----------------------------------------------------------

function loadMap<T>(key: string): Record<string, T> {
  const v = getStoredJSON(HHStoredVarPrefixKey + key, {});
  return (v && typeof v === "object") ? (v as Record<string, T>) : {};
}
function saveMap(key: string, v: Record<string, unknown>): void {
  setStoredValue(HHStoredVarPrefixKey + key, JSON.stringify(v));
}

export const blockPorts: SchedulerPorts = {
  now: () => Date.now(),
  getCurrentPage: () => getPage(),
  isMasterOff: () => getStoredValue(HHStoredVarPrefixKey + SK.master) !== "true",
  isAutoLoopOff: () => getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== "true",
  routeHome: () => { gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome")); },
  scriptVersion: () => String(getStoredValue(HHStoredVarPrefixKey + TK.scriptversion) ?? ""),
  loadRun: (): BlockRun | null => loadBlockRun(),
  saveRun: (r: BlockRun) => saveBlockRun(r),
  clearRun: () => clearBlockRun(),
  getCooldowns: () => loadMap<number>(TK.blockCooldownUntil),
  setCooldowns: (v) => saveMap(TK.blockCooldownUntil, v),
  getFailureCounts: () => loadMap<number>(TK.blockFailureCount),
  setFailureCounts: (v) => saveMap(TK.blockFailureCount, v),
  getAutoDisabled: () => loadMap<DisabledEntry>(TK.blockAutoDisabled),
  setAutoDisabled: (v) => saveMap(TK.blockAutoDisabled, v),
  getLastRunAt: () => loadMap<number>(TK.pipelineLastRunAt),
  setLastRunAt: (v) => saveMap(TK.pipelineLastRunAt, v),
  // Legacy-compatible 2-line log so the live test stays comparable to v7.36.x.
  // Structured [PIPE] logging replaces this in the logging task.
  log: (e: Record<string, unknown>) => {
    const ev = e.ev;
    const block = e.block;
    if (ev === "start") logHHAuto(`[Scheduler] Starting chain '${block}'`);
    else if (ev === "done" && e.detail === "run complete") logHHAuto(`[Scheduler] Chain '${block}' completed`);
    else if (ev === "abort" || ev === "timeout" || ev === "error") logHHAuto(`[Scheduler] ${ev} '${block}': ${e.detail}`);
    // per-step done / resume / dispatch / reset are suppressed in this interim
    // adapter (single-step blocks do not exercise them); see the logging task.
  },
};

function buildScheduler(): BlockScheduler {
  const { registry, defaultOrder } = buildRegistryAndOrder();
  const stored = getStoredJSON(HHStoredVarPrefixKey + TK.pipelineOrder, null) as BlockOrder | null;
  const resolved = resolveOrder(stored, registry, defaultOrder);
  for (const w of resolved.warnings) logHHAuto(`[Scheduler] order: ${w.message}`);
  return new BlockScheduler(registry, resolved.order, blockPorts);
}

// Lazy singleton: built on first tick from the boot path, NOT at module eval,
// so reading the `pipeline` array cannot hit a TDZ if the cyclic module graph
// evaluates BlockPipeline before Pipeline.config (lesson zirkulaerer-import-tdz-crash).
let _scheduler: BlockScheduler | null = null;
export function getBlockScheduler(): BlockScheduler {
  if (!_scheduler) _scheduler = buildScheduler();
  return _scheduler;
}
