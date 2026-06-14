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
import { Block, BlockOrder, BlockRegistry, BlockRun, BlockStepResult, OrderConstraint } from "./BlockTypes";
import { gotoPage } from "./PageNavigationService";
import { resolveOrder } from "./OrderResolver";
import { loadBlockRun, saveBlockRun, clearBlockRun } from "./BlockRunStore";
import { logEvent, writeLogContext, isDiagnose, PipeFields } from "./PipeLogger";
import { HandlerConfig, pipeline } from "./Pipeline.config";

/**
 * Slot-hold decision (ADR-002, gate-hold-return). After a handler step:
 *  - failure -> pass through (watchdog aborts).
 *  - the handler acted (ctx.busy, typically navigated away) -> repeat: keep the
 *    BlockRun active so the same block re-enters after the reload and finishes
 *    its excursion uninterrupted (no other block can grab the slot, the
 *    lastActionPerformed reset becomes irrelevant).
 *  - the handler is idle (busy=false, nothing to do, ideally back on home) ->
 *    done: release the slot.
 */
export function applySlotHold(r: BlockStepResult, busy: boolean): BlockStepResult {
  if (!r.ok) return r;
  return busy ? { ok: true, repeat: true } : { ok: true };
}

// Infra blocks are pinned: not user-reorderable (R3.7, design "Infra-Bloecke").
const INFRA_BLOCKS = new Set<string>(["handleEventParsing", "handleGoHome"]);

// Hard ordering constraints (design.md "Abhaengigkeitsgraph", R3.1), declared on
// the block; OrderResolver.validateOrder enforces them on any user reorder
// (task 15). The current defaultOrder already satisfies all of these (build-test
// R3.6), so adding them changes NO runtime order -- they only constrain future
// user reorders. BossBang is still two un-bundled blocks here, so the
// EventParsing-before-consumers edge targets both halves.
const BLOCK_CONSTRAINTS: Record<string, OrderConstraint[]> = {
  handleAutoEquipBoosters: [
    { kind: "runsAfter", block: "handleShop", hard: true },        // inventory cache
    { kind: "runsAfter", block: "handleHaremSize", hard: true },   // synergy cache
  ],
  handleGoHome: [{ kind: "afterAll", hard: true }],
  handleEventParsing: [
    { kind: "runsBefore", block: "handleTrollBattle", hard: true },     // mythic first-visit
    { kind: "runsBefore", block: "handleBossBangParse", hard: true },
    { kind: "runsBefore", block: "handleBossBangFight", hard: true },
  ],
};

/** Adapt one legacy HandlerConfig into a Block (1:1, handler logic reused). */
function toBlock(c: HandlerConfig): Block {
  return {
    id: c.name,
    precondition: c.precondition,
    steps: c.steps.map(s => ({
      name: s.name,
      // Reuse the legacy step (ctx); wrap with the slot-hold rule so a
      // navigating handler holds the run until it goes idle (ADR-002).
      fn: async (ctx: Parameters<typeof s.fn>[0]) => applySlotHold(await s.fn(ctx), ctx.busy),
      timeoutMs: s.timeoutMs,
    })),
    userMovable: !INFRA_BLOCKS.has(c.name),   // R3.7: infra pinned, rest reorderable
    constraints: BLOCK_CONSTRAINTS[c.name],   // R3.1: hard ordering constraints
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
  // Structured [PIPE] logging through the existing log pipeline (task 7).
  log: (e: Record<string, unknown>) => logEvent(e as unknown as PipeFields),
};

function buildScheduler(): BlockScheduler {
  const { registry, defaultOrder } = buildRegistryAndOrder();
  const stored = getStoredJSON(HHStoredVarPrefixKey + TK.pipelineOrder, null) as BlockOrder | null;
  const resolved = resolveOrder(stored, registry, defaultOrder);
  for (const w of resolved.warnings) logHHAuto(`[Scheduler] order: ${w.message}`);
  // Refresh the non-rotating log context block (R6.16): version/platform/order/
  // disabled blocks/diagnose flag, prepended to the user debug export.
  const disabledMap = blockPorts.getAutoDisabled();
  writeLogContext({
    version: blockPorts.scriptVersion(),
    platform: (typeof navigator !== "undefined" && navigator.userAgent) ? navigator.userAgent : "unknown",
    effectiveOrder: resolved.order,
    disabledBlocks: Object.keys(disabledMap).map((id) => ({ id, reason: disabledMap[id].reason, sinceVersion: disabledMap[id].sinceVersion })),
    diagnose: isDiagnose(),
  });
  // No-progress watchdog only (ADR-002 follow-up): a block runs ALL its tasks and
  // sets its own timer before releasing; the watchdog aborts only after 5 min of
  // NO progress (genuinely hung), never a long-but-working build.
  return new BlockScheduler(registry, resolved.order, blockPorts, { noProgressMs: 300_000 });
}

// Lazy singleton: built on first tick from the boot path, NOT at module eval,
// so reading the `pipeline` array cannot hit a TDZ if the cyclic module graph
// evaluates BlockPipeline before Pipeline.config (lesson zirkulaerer-import-tdz-crash).
let _scheduler: BlockScheduler | null = null;
export function getBlockScheduler(): BlockScheduler {
  if (!_scheduler) _scheduler = buildScheduler();
  return _scheduler;
}
