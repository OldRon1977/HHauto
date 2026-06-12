// BlockRunStore.ts -- reload-safe persistence of the active BlockRun
// (v7.37.0 pipeline-block architecture, ADR-001).
//
// The BlockRun lives in sessionStorage (TK.activeBlockRun): it survives a
// page reload in the same tab and is intentionally lost on tab close/crash
// (R4.12), so a fresh start begins cleanly. Continuity that used to depend on
// the in-memory ActiveChain + lastActionPerformed now lives here (R4.4).
//
// Requirements: 4.4, 4.12
import { getStoredValue, setStoredValue, deleteStoredValue } from "../Helper/StorageHelper";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { TK } from "../config/StorageKeys";
import { BlockRun } from "./BlockTypes";

const KEY = HHStoredVarPrefixKey + TK.activeBlockRun;

/** Narrow an unknown parsed value to a structurally valid BlockRun. */
function isBlockRun(v: unknown): v is BlockRun {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.blockId === "string"
    && typeof o.stepIdx === "number"
    && typeof o.startedAt === "number"
    && typeof o.stepStartedAt === "number"
    && typeof o.dispatched === "boolean"
    && typeof o.data === "object" && o.data !== null;
}

/** Persist the active BlockRun (write-through to sessionStorage). */
export function saveBlockRun(run: BlockRun): void {
  setStoredValue(KEY, JSON.stringify(run));
}

/**
 * Restore the active BlockRun after a (planned or unplanned) reload. Returns
 * null when nothing is stored or the stored value is corrupt -- the caller
 * then starts fresh rather than resuming an invalid run.
 */
export function loadBlockRun(): BlockRun | null {
  const raw = getStoredValue(KEY);
  if (raw === undefined || raw === null || raw === "") return null;
  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  return isBlockRun(parsed) ? parsed : null;
}

/** Drop the active BlockRun (run finished, aborted, or master-off). */
export function clearBlockRun(): void {
  deleteStoredValue(KEY);
}
