// PipeLogger.ts -- structured [PIPE] logging for the block scheduler
// (v7.37.0 pipeline-block architecture, ADR-001, task 7).
//
// One event per line, key=value, parseable, tagged [PIPE], emitted through the
// existing logHHAuto pipeline (single system, R6.11) so the lines land in the
// same persisted/rotated buffer and the user debug export. A non-rotating
// context block (version, platform, effective order, disabled blocks, diagnose
// flag) is stored separately and travels with the export. Lean events are
// always emitted; per-step detail only when the diagnose toggle is on. Skip
// events are change-deduplicated so a block parked on one reason logs once, not
// every ~2s tick.
//
// Requirements: 6.1-6.14, 6.16, 6.17, 6.18
import { getStoredValue, setStoredValue } from "../Helper/StorageHelper";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK, TK } from "../config/StorageKeys";
import { logHHAuto } from "../Utils/LogUtils";

export interface PipeFields {
  ev: string;
  tick?: number;
  run?: string;
  block?: string;
  step?: string;
  page?: string;
  result?: string;
  detail?: string;
}

export interface LogContext {
  version: string;
  platform: string;
  effectiveOrder: string[];
  disabledBlocks: Array<{ id: string; reason: string; sinceVersion: string }>;
  diagnose: boolean;
}

// Fixed field order for a stable, parseable line (R6.10).
const FIELD_ORDER: Array<keyof PipeFields> = ["tick", "run", "block", "step", "page", "ev", "result", "detail"];

/** Collapse whitespace/newlines so a value never breaks the one-event-per-line contract (R6.10/R6.18). */
function sanitize(v: unknown): string {
  return String(v).replace(/\s+/g, " ").trim();
}

/** Format a [PIPE] line. Pure -- unit-testable (R6.10). */
export function formatPipeLine(fields: PipeFields): string {
  const parts: string[] = ["[PIPE]", "t=" + new Date().toISOString()];
  for (const key of FIELD_ORDER) {
    const val = fields[key];
    if (val === undefined || val === null || val === "") continue;
    parts.push(key + "=" + sanitize(val));
  }
  return parts.join(" ");
}

/** Whether verbose diagnostic logging is enabled (R6.14). */
export function isDiagnose(): boolean {
  return getStoredValue(HHStoredVarPrefixKey + SK.pipelineDiagnose) === "true";
}

// Skip-dedup state: last skip detail per block (R6.17 lean budget).
const lastSkipDetail: Record<string, string> = {};

/** Reset dedup state (tests / cache clear). */
export function _resetPipeLoggerForTests(): void {
  for (const k of Object.keys(lastSkipDetail)) delete lastSkipDetail[k];
}

/**
 * Emit a structured event through the existing log pipeline.
 *  - skip: only when the reason changed for that block (change-dedup).
 *  - per-step done (ev=done without detail "run complete"): diagnose only.
 *  - everything else: always (lean lifecycle).
 */
export function logEvent(fields: PipeFields): void {
  const ev = fields.ev;

  if (ev === "skip") {
    const key = fields.block ?? "?";
    const detail = fields.detail ?? "";
    if (lastSkipDetail[key] === detail) return;       // unchanged -> suppress
    lastSkipDetail[key] = detail;
  } else if (fields.block) {
    // a block that did something clears its skip-dedup memory
    delete lastSkipDetail[fields.block];
  }

  // Per-step "done" is verbose; the run-complete "done" is lean.
  if (ev === "done" && fields.detail !== "run complete" && !isDiagnose()) return;

  logHHAuto(formatPipeLine(fields));
}

/** Write/refresh the non-rotating context block (R6.16). Prepended to the export via storage. */
export function writeLogContext(ctx: LogContext): void {
  setStoredValue(HHStoredVarPrefixKey + TK.pipelineLogContext, JSON.stringify(ctx));
}
