// PipeLogger.ts -- structured [PIPE] logging for the block scheduler.
//
// One event per line, key=value, parseable, tagged [PIPE], emitted through the
// existing logHHAuto pipeline, so the lines land in the same persisted buffer
// and in the user debug export. A non-rotating context block (version,
// platform, effective order, disabled blocks, diagnose flag) is stored
// separately and travels with the export. Lean events are always emitted;
// per-step detail only when the diagnose toggle is on. Skip events are
// change-deduplicated, so a block parked on one reason logs once, not on every
// tick.
//
// Idle runs leave one line, not three. A run's lines are held back from its
// start until something else is logged -- the handler's own message, another
// block, a page change -- and written out then, in order. A run that ends
// without any of that and without having acted (run.acted) is dropped, and its
// block gets a single `ev=idle` line until it does something again. Measured on
// two user logs before this: about 9,000 idle troll runs in twelve hours, three
// lines each, two thirds of the log.
//
// A line carries no clock of its own: the log stores every line with its epoch
// milliseconds, and the export prints them in the player's local time. The
// block is named once -- `run=<block>@<start>` already holds it.
//
// See docs/decisions/ADR-004-pipeline-block-architecture.md.
import { getStoredValue, setStoredValue } from "../Helper/StorageHelper";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK, TK } from "../config/StorageKeys";
import { logHHAuto, setBeforeLogHook } from "../Utils/LogUtils";
import { flushLog } from "../Utils/LogStore";

export interface PipeFields {
  ev: string;
  tick?: number;
  run?: string;
  block?: string;
  step?: string;
  page?: string;
  result?: string;
  detail?: string;
  /** Whether the run acted (BlockRun.acted); only read on "run complete", never printed. */
  acted?: boolean;
}

export interface LogContext {
  version: string;
  platform: string;
  effectiveOrder: string[];
  disabledBlocks: Array<{ id: string; reason: string; sinceVersion: string }>;
  diagnose: boolean;
}

// Fixed field order for a stable, parseable line.
const FIELD_ORDER: Array<keyof PipeFields> = ["tick", "run", "block", "step", "page", "ev", "result", "detail"];

/** Collapse whitespace/newlines so a value never breaks the one-event-per-line contract. */
function sanitize(v: unknown): string {
  return String(v).replace(/\s+/g, " ").trim();
}

/** Format a [PIPE] line. Pure -- unit-testable. */
export function formatPipeLine(fields: PipeFields): string {
  const parts: string[] = ["[PIPE]"];
  const blockInRun = fields.run !== undefined && fields.block !== undefined
    && String(fields.run).startsWith(fields.block + "@");
  for (const key of FIELD_ORDER) {
    if (key === "block" && blockInRun) continue;
    const val = fields[key];
    if (val === undefined || val === null || val === "") continue;
    parts.push(key + "=" + sanitize(val));
  }
  return parts.join(" ");
}

/** Whether verbose diagnostic logging is enabled. */
export function isDiagnose(): boolean {
  return getStoredValue(HHStoredVarPrefixKey + SK.pipelineDiagnose) === "true";
}

// Skip-dedup state: last skip detail per block, so a block parked on one
// reason logs once instead of on every tick.
const lastSkipDetail: Record<string, string> = {};
// Blocks whose idle line is already in the log. Kept apart from the skip
// reasons, which would otherwise overwrite it, and cleared only when the block
// leaves real lines -- not by its focus bookkeeping. Measured on a user log
// with the first version of this filter: with one shared map and focus events clearing it, a block that
// idled the whole time still wrote its idle line five times in eight minutes.
const idleLogged = new Set<string>();

/** The block did something worth reading: forget its skip and idle lines. */
function forgetQuiet(block: string): void {
  delete lastSkipDetail[block];
  idleLogged.delete(block);
}

/** Reset dedup state (tests / cache clear). */
export function _resetPipeLoggerForTests(): void {
  for (const k of Object.keys(lastSkipDetail)) delete lastSkipDetail[k];
  idleLogged.clear();
  held = null;
  if (heldTimer !== null) { clearTimeout(heldTimer); heldTimer = null; }
}

// The lines of the run in progress, held back until the run shows it did
// something. Written out unchanged and in order by flushHeld().
interface HeldRun { run: string; block?: string; lines: string[]; }
let held: HeldRun | null = null;
let heldTimer: ReturnType<typeof setTimeout> | null = null;
let hooksInstalled = false;
/** A run still silent after this long is written out anyway (a slow await, a page change). */
const HOLD_MAX_MS = 3_000;

/** Write the held lines of the run in progress, if any. */
export function flushHeld(): void {
  if (heldTimer !== null) { clearTimeout(heldTimer); heldTimer = null; }
  if (held === null) return;
  const h = held;
  held = null;   // before writing: logHHAuto calls back into this hook
  if (h.block) forgetQuiet(h.block);
  for (const line of h.lines) logHHAuto(line);
}

function installHooks(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;
  // Any other line flushes first, so the run's start stays in front of it.
  setBeforeLogHook(flushHeld);
  if (typeof window !== "undefined" && window.addEventListener) {
    // The page is going: write what is held, then make the log store save it.
    window.addEventListener("pagehide", () => { flushHeld(); flushLog(); });
  }
}

function hold(fields: PipeFields, line: string): void {
  flushHeld();
  installHooks();
  held = { run: String(fields.run), block: fields.block, lines: [line] };
  if (typeof setTimeout === "function") heldTimer = setTimeout(flushHeld, HOLD_MAX_MS);
}

/**
 * Emit a structured event through the existing log pipeline.
 *  - skip: only when the reason changed for that block (change-dedup).
 *  - per-step done (ev=done without detail "run complete"): diagnose only.
 *  - everything else: always (lean lifecycle).
 */
export function logEvent(fields: PipeFields): void {
  const ev = fields.ev;
  const runComplete = ev === "done" && fields.detail === "run complete";

  // Per-step "done" is verbose; the run-complete "done" is lean.
  if (ev === "done" && !runComplete && !isDiagnose()) return;

  const line = formatPipeLine(fields);

  if (ev === "start" && fields.run !== undefined) { hold(fields, line); return; }

  if (held !== null && fields.run !== undefined && String(fields.run) === held.run) {
    if (runComplete && fields.acted !== true) {
      // Nothing logged and nothing done since the start: drop the run, and
      // say so once per block.
      const key = held.block ?? fields.block ?? "?";
      held = null;
      if (heldTimer !== null) { clearTimeout(heldTimer); heldTimer = null; }
      if (idleLogged.has(key)) return;
      idleLogged.add(key);
      logHHAuto(formatPipeLine({ block: key, ev: "idle", detail: "ran without doing anything; repeats are not logged" }));
      return;
    }
    held.lines.push(line);
    if (runComplete) flushHeld();
    return;
  }

  flushHeld();
  if (ev === "skip") {
    const key = fields.block ?? "?";
    const detail = fields.detail ?? "";
    if (lastSkipDetail[key] === detail) return;       // unchanged -> suppress
    lastSkipDetail[key] = detail;
  } else if (fields.block && ev !== "focus") {
    // a block that did something clears its dedup memory; taking or
    // releasing the focus is bookkeeping, not work
    forgetQuiet(fields.block);
  }
  logHHAuto(line);
}

/** Write/refresh the non-rotating context block. Prepended to the export via storage. */
export function writeLogContext(ctx: LogContext): void {
  setStoredValue(HHStoredVarPrefixKey + TK.pipelineLogContext, JSON.stringify(ctx));
}
