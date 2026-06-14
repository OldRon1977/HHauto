// BlockDisabledState.ts -- read/clear the watchdog auto-disable + failure-count
// state of the block scheduler (v7.37.0, ADR-001 R5.6).
//
// Leaf module (storage only, no scheduler import) so the pInfo UI can show
// auto-disabled blocks and offer reactivation without an InfoService ->
// BlockPipeline import cycle. The BlockScheduler reads the same keys fresh on
// every findNext, so clearing them here takes effect on the next tick.
import { getStoredJSON, setStoredValue } from "../Helper/StorageHelper";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { TK } from "../config/StorageKeys";

export interface DisabledEntry { reason: string; sinceVersion: string; }

// NOTE: the storage keys are computed inside the functions, NOT at module
// top level. A top-level `const X = HHStoredVarPrefixKey + ...` is evaluated at
// module load and throws a TDZ ReferenceError ("Cannot access
// 'HHStoredVarPrefixKey' before initialization") if this module is evaluated
// inside the import cycle before config/HHStoredVars finished initializing
// (lesson zirkulaerer-import-tdz-crash). This module is reachable early via
// InfoService, so it must stay TDZ-safe.

/** All blocks the watchdog has auto-disabled, keyed by block id (R5.4/R5.6). */
export function getAutoDisabledBlocks(): Record<string, DisabledEntry> {
  const v = getStoredJSON(HHStoredVarPrefixKey + TK.blockAutoDisabled, {});
  return (v && typeof v === "object") ? (v as Record<string, DisabledEntry>) : {};
}

/**
 * Reactivate a block: drop its auto-disable entry and reset its failure
 * counters (R5.7). The next scheduler tick will consider the block again.
 */
export function reactivateBlock(blockId: string): void {
  const disabled = getAutoDisabledBlocks();
  if (disabled[blockId]) {
    delete disabled[blockId];
    setStoredValue(HHStoredVarPrefixKey + TK.blockAutoDisabled, JSON.stringify(disabled));
  }
  const counts = getStoredJSON(HHStoredVarPrefixKey + TK.blockFailureCount, {}) as Record<string, number>;
  let changed = false;
  for (const sig of Object.keys(counts)) {
    if (sig.startsWith(blockId + ":")) { delete counts[sig]; changed = true; }
  }
  if (changed) setStoredValue(HHStoredVarPrefixKey + TK.blockFailureCount, JSON.stringify(counts));
}
