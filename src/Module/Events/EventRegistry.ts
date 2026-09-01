// EventRegistry.ts -- write access to the event registry (Temp_eventsList).
//
// The registry is the list handleEventParsing walks to pick the next event
// page to visit: one entry per event id, carrying next_refresh among other
// fields. EventModule owns filling it; the operations an individual event
// module needs live here instead, because EventModule imports those modules
// and the reverse import would be a new cycle (ARCH-001).
//
// Depends on: StorageHelper.ts, HHStoredVars.ts, StorageKeys.ts
// Used by: EventModule.ts, LivelyScene.ts
//
import { getStoredJSON, setStoredValue } from "../../Helper/StorageHelper";
import { HHStoredVarPrefixKey } from "../../config/HHStoredVars";
import { TK } from "../../config/StorageKeys";

/**
 * Mark one event as due for a re-read (#1843).
 *
 * handleEventParsing picks up any event whose next_refresh has passed, so
 * setting it to zero is enough to have the pipeline visit the event page on
 * its next pass -- no extra navigation.
 *
 * A no-op for an event that is not in the registry: the entry is created by
 * parseEventPage, and an id that is not there yet gets visited anyway
 * (getEventIDsToVisit).
 */
export function markEventStale(eventId: string): void {
    if (!eventId) return;
    const list = getStoredJSON<Record<string, any>>(HHStoredVarPrefixKey + TK.eventsList, {});
    if (!list || !list[eventId]) return;
    list[eventId]["next_refresh"] = 0;
    setStoredValue(HHStoredVarPrefixKey + TK.eventsList, JSON.stringify(list));
}
