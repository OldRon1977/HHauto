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
import { deleteStoredValue, getStoredJSON, setStoredValue } from "../../Helper/StorageHelper";
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

// ---------------------------------------------------------------------------
// Is the event still there? (#1925)
//
// The registry keeps an event until something removes it. Its end time is the
// countdown the event page showed on the last visit, turned into a ms epoch --
// right as long as the game keeps to it, and never re-checked otherwise. When
// the entry outlived the event, a block that navigates to the event tab
// looped: the game sends a tab that no longer exists straight back to
// home.html (measured: sm_event_, boss_bang_event_ and event_ alike, a server
// redirect, event.html never loads), the block ran again on home, and so on
// for hours, because no block's precondition but handleEventParsing's ever
// pruned the registry -- and that one is never asked while another block holds
// the slot.
//
// So the game decides, from two things it shows on every visit:
//   - the redirect itself: a navigation to event.html?tab=X whose next page
//     load is not that event page means X is gone (wasSentAway);
//   - the home page: every running event has its widget there, an
//     a[href*="tab=<id>"] inside .event-widget, with its time left
//     (measured on home.html). A registry entry without one is gone
//     (absentFromHome).
// The home page also takes a refusal back: an event it shows is running,
// whatever the redirect seemed to say. The stored end time stays as the
// fallback for every other page.
// ---------------------------------------------------------------------------

/**
 * What a navigation leaves behind: the page id, the tab argument, the time.
 * PageNavigationService writes it (recordNavTarget) -- with its own import of
 * the storage helper, because importing this file there closes a cycle.
 */
export interface NavTarget { page: string; tab: string | null; at: number; }

/**
 * Refused ids kept at most. No time limit: a refusal holds until the home page
 * or the event page shows the event again (forgetEventGone) -- the game says
 * it is there, so a wrong verdict costs one home visit, not hours. The cap
 * only keeps the list from growing over a long session.
 */
export const EVENTS_GONE_MAX = 50;
/** The page load that answers a navigation starts within this window. */
export const NAV_ANSWER_WINDOW_MS = 30_000;
/**
 * How far the target may lie after the load start. Firefox with
 * resistFingerprinting rounds Date.now() and timeOrigin, so the target can
 * read as a few milliseconds later than the load it caused.
 */
export const NAV_CLOCK_TOLERANCE_MS = 2_000;

/**
 * The event tab the game refused, or null.
 *
 * Only the first page load after the navigation answers it: the target was
 * written around the start of this document -- the check runs once, as the
 * script starts, before this page can navigate itself -- and not longer ago
 * than the window. A later load -- the player clicking around, a reload an
 * hour on -- says nothing about that tab. And only home.html is the
 * refusal: that is where the game sends a dead tab. Landing anywhere else --
 * the logged-out intro, a maintenance page -- says nothing about the event.
 */
export function wasSentAway(
    target: NavTarget | null,
    loadStart: number,
    currentPage: string,
    eventPage: string,
    homePage: string,
): string | null {
    if (!target || !target.tab || target.page !== eventPage) return null;
    if (target.at - loadStart > NAV_CLOCK_TOLERANCE_MS || loadStart - target.at > NAV_ANSWER_WINDOW_MS) return null;
    return currentPage === homePage ? target.tab : null;
}

/** Registry ids the home page no longer shows a widget for. */
export function absentFromHome(registryIds: string[], homeTabs: string[]): string[] {
    const shown = new Set(homeTabs);
    return registryIds.filter(id => !shown.has(id));
}

/** Registry ids whose stored end lies in the past. */
export function expiredIds(eventList: Record<string, { seconds_before_end?: unknown } | undefined>, now: number): string[] {
    return Object.keys(eventList).filter(id => {
        const end = Number(eventList[id]?.seconds_before_end);
        return Number.isFinite(end) && end <= now;
    });
}

export function readNavTarget(): NavTarget | null {
    const t = getStoredJSON<NavTarget | null>(HHStoredVarPrefixKey + TK.lastNavTarget, null);
    return t && typeof t.at === 'number' ? t : null;
}

export function clearNavTarget(): void {
    deleteStoredValue(HHStoredVarPrefixKey + TK.lastNavTarget);
}

export function markEventGone(eventId: string, now: number = Date.now()): void {
    const gone = getStoredJSON<Record<string, number>>(HHStoredVarPrefixKey + TK.eventsGone, {});
    gone[eventId] = now;
    const newestFirst = Object.keys(gone).sort((a, b) => gone[b] - gone[a]);
    for (const id of newestFirst.slice(EVENTS_GONE_MAX)) delete gone[id];
    setStoredValue(HHStoredVarPrefixKey + TK.eventsGone, JSON.stringify(gone));
}

export function isEventGone(eventId: string): boolean {
    const gone = getStoredJSON<Record<string, number>>(HHStoredVarPrefixKey + TK.eventsGone, {});
    return Object.prototype.hasOwnProperty.call(gone, eventId);
}

/** The game serves the event again: forget that it once refused it. */
export function forgetEventGone(eventId: string): void {
    const gone = getStoredJSON<Record<string, number>>(HHStoredVarPrefixKey + TK.eventsGone, {});
    if (!Object.prototype.hasOwnProperty.call(gone, eventId)) return;
    delete gone[eventId];
    setStoredValue(HHStoredVarPrefixKey + TK.eventsGone, JSON.stringify(gone));
}

/** Remove one entry. The caller tidies what hangs off it (clearEventData). */
export function removeEventEntry(eventId: string): boolean {
    const list = getStoredJSON<Record<string, unknown>>(HHStoredVarPrefixKey + TK.eventsList, {});
    if (!list || !Object.prototype.hasOwnProperty.call(list, eventId)) return false;
    delete list[eventId];
    if (Object.keys(list).length === 0) deleteStoredValue(HHStoredVarPrefixKey + TK.eventsList);
    else setStoredValue(HHStoredVarPrefixKey + TK.eventsList, JSON.stringify(list));
    return true;
}
