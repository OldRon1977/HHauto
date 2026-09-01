// BlockPipeline.ts -- wires the block scheduler into the running script.
//
// Adapts the HandlerConfig entries of Pipeline.config.ts into Blocks, builds the
// default order from their array order, and exposes the BlockScheduler singleton
// with its side-effecting ports. Handler internals (precondition + step fn) are
// used unchanged, so lastActionPerformed continuation keeps working.
//
// See docs/decisions/ADR-004-pipeline-block-architecture.md.
import { ConfigHelper } from "../Helper/ConfigHelper";
import { getPage } from "../Helper/PageHelper";
import { getStoredValue, getStoredJSON, setStoredValue } from "../Helper/StorageHelper";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK, TK } from "../config/StorageKeys";
import { logHHAuto } from "../Utils/LogUtils";
import { BlockScheduler, DisabledEntry, SchedulerPorts } from "./BlockScheduler";
import { Block, BlockFocus, BlockOrder, BlockRegistry, BlockRun, BlockStepResult, OrderConstraint } from "./BlockTypes";
import { gotoPage } from "./PageNavigationService";
import { resolveOrder } from "./OrderResolver";
import { loadBlockRun, saveBlockRun, clearBlockRun } from "./BlockRunStore";
import { logEvent, writeLogContext, isDiagnose, PipeFields } from "./PipeLogger";
import { HandlerConfig, pipeline } from "./Pipeline.config";

/**
 * Slot-hold decision after a handler step
 * (docs/decisions/ADR-005-block-slot-hold-until-home.md):
 *  - failure -> passed through, the watchdog aborts.
 *  - the handler acted (ctx.busy, typically navigated away) -> repeat: the
 *    BlockRun stays active, so the same block re-enters after the reload and
 *    finishes its excursion; no other block can grab the slot meanwhile.
 *  - the handler is idle (busy=false, ideally back on home) -> done: the slot
 *    is released.
 */
export function applySlotHold(r: BlockStepResult, busy: boolean, autoLoopOff = false): BlockStepResult {
  if (!r.ok) return r;
  // An explicit "done" wins over the navigated-so-hold rule, so a handler can
  // say "I went home BECAUSE I am finished": ctx.busy is set either way, and
  // without this the run would be held. PlaceOfPower does that when its list
  // is empty.
  if (r.done === true) {
    return (autoLoopOff || r.acted === true) ? { ...r, acted: true } : r;
  }
  // A handler that switched the auto-loop off is mid-action: gotoPage,
  // safeReload and the fight paths do that right before the page goes away.
  // It does not hold the slot by itself -- handleLeague releases it after
  // arming its timer, and holding on a battle-result page starves
  // handleGenericBattle (#1796) -- but it counts as activity, so the focus
  // survives it (#1841).
  const acted = autoLoopOff || r.acted === true;
  // An explicit repeat from the step holds the slot when busy is not set:
  // handleLeague right after launching a leaderboard navigation, handleSeason
  // waiting in-slot through the short inter-fight pause (#1796). Releasing the
  // slot there opens a one-tick window in which another block navigates away
  // mid-session.
  if (r.repeat) return acted ? { ...r, acted: true } : r;
  if (busy) return acted ? { ok: true, repeat: true, acted: true } : { ok: true, repeat: true };
  return acted ? { ok: true, acted: true } : { ok: true };
}

// Infra blocks are pinned: not user-reorderable.
const INFRA_BLOCKS = new Set<string>(["handleEventParsing", "handleGoHome"]);

/**
 * Blocks that may run while another activity holds the focus, and that never
 * take the focus themselves (#1841, Block.runsDuringFocus).
 *
 *  - the collect blocks: their rewards expire with the event they belong to
 *    (`...RemainingTime < getLimitTimeBeforeEnd()` in their preconditions), so
 *    they must never wait for a fight that runs until the energy is gone. Each
 *    sets its own next-time timer, so it cannot starve the activity.
 *  - handleGenericBattle: parses the reward popup on a battle-result page
 *    (#1740). A fight block hands that page over and is stuck there until the
 *    parse is done, so locking this out would deadlock the focus.
 */
const FOCUS_INTERRUPTERS = new Set<string>([
  "handleSeasonCollect",
  "handlePentaDrillCollect",
  "handleSeasonalEventCollect",
  "handleSeasonalRankCollect",
  "handlePoVCollect",
  "handlePoGCollect",
  "handleGenericBattle",
]);

/** Infra that serves other blocks and must not become the focused activity. */
const NEVER_FOCUS = new Set<string>([...INFRA_BLOCKS, ...FOCUS_INTERRUPTERS]);

// Hard ordering constraints declared on the block; OrderResolver.validateOrder
// enforces them on any user reorder. The default order already satisfies them,
// so they only constrain reordering. BossBang is two separate blocks, so the
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

/** Adapt one HandlerConfig into a Block; the handler logic is reused as is. */
function toBlock(c: HandlerConfig): Block {
  return {
    id: c.name,
    precondition: c.precondition,
    steps: c.steps.map(s => ({
      name: s.name,
      // The handler step, wrapped in the slot-hold rule so a navigating
      // handler holds the run until it goes idle.
      fn: async (ctx: Parameters<typeof s.fn>[0]) => {
        const result = await s.fn(ctx);
        const autoLoopOff = getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== "true";
        return applySlotHold(result, ctx.busy, autoLoopOff);
      },
      timeoutMs: s.timeoutMs,
    })),
    userMovable: !INFRA_BLOCKS.has(c.name),   // infra pinned, rest reorderable
    constraints: BLOCK_CONSTRAINTS[c.name],
    holdsFocus: !NEVER_FOCUS.has(c.name),     // #1841
    runsDuringFocus: FOCUS_INTERRUPTERS.has(c.name),
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

const blockPorts: SchedulerPorts = {
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
  getFocus: (): BlockFocus | null => {
    const v = getStoredJSON(HHStoredVarPrefixKey + TK.blockFocus, null);
    return (v && typeof v === "object" && typeof (v as BlockFocus).blockId === "string") ? (v as BlockFocus) : null;
  },
  setFocus: (v) => setStoredValue(HHStoredVarPrefixKey + TK.blockFocus, v === null ? "" : JSON.stringify(v)),
  // Structured [PIPE] logging through the existing log pipeline.
  log: (e: Record<string, unknown>) => logEvent(e as unknown as PipeFields),
};

function buildScheduler(): BlockScheduler {
  const { registry, defaultOrder } = buildRegistryAndOrder();
  const stored = getStoredJSON(HHStoredVarPrefixKey + TK.pipelineOrder, null) as BlockOrder | null;
  const resolved = resolveOrder(stored, registry, defaultOrder);
  for (const w of resolved.warnings) logHHAuto(`[Scheduler] order: ${w.message}`);
  // Refresh the non-rotating log context block: version, platform, effective
  // order, disabled blocks and the diagnose flag, prepended to the debug export.
  const disabledMap = blockPorts.getAutoDisabled();
  writeLogContext({
    version: blockPorts.scriptVersion(),
    platform: (typeof navigator !== "undefined" && navigator.userAgent) ? navigator.userAgent : "unknown",
    effectiveOrder: resolved.order,
    disabledBlocks: Object.keys(disabledMap).map((id) => ({ id, reason: disabledMap[id].reason, sinceVersion: disabledMap[id].sinceVersion })),
    diagnose: isDiagnose(),
  });
  // No-progress watchdog: a block runs all its tasks and sets its own timer
  // before releasing, so the watchdog aborts only after 5 min without progress
  // -- a genuinely hung block, never a long-but-working one.
  return new BlockScheduler(registry, resolved.order, blockPorts, { noProgressMs: 300_000 });
}

// Lazy singleton: built on the first tick from the boot path, not at module
// eval, so reading the `pipeline` array cannot hit a TDZ when the cyclic module
// graph evaluates BlockPipeline before Pipeline.config (lesson
// zirkulaerer-import-tdz-crash).
let _scheduler: BlockScheduler | null = null;
export function getBlockScheduler(): BlockScheduler {
  if (!_scheduler) _scheduler = buildScheduler();
  return _scheduler;
}
