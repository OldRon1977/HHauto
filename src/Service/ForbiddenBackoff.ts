// ForbiddenBackoff.ts
//
// Persistent Forbidden counter and exponential backoff calculator
// for issue #1598. Two layers:
//
// 1. Pure helpers (nextForbiddenDelaySeconds, nextStreakCount):
//    deterministic math, unit-tested in isolation. Used by the
//    StartService reload path that also needs to read the current
//    counter and pick a delay before reloading.
//
// 2. recordForbidden(): the side-effecting "I just saw a 403"
//    notifier. Called by AjaxTracker when a /ajax.php XHR ends with
//    HTTP 403. It bumps the streak counter in sessionStorage so the
//    next StartService reload picks a longer delay. It does NOT
//    schedule a reload itself -- the actual reload still happens in
//    StartService when the next page renders the "Forbidden" body.

import { logHHAuto } from "../Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";

export const FORBIDDEN_BASE_SECONDS = 60;
export const FORBIDDEN_CAP_SECONDS = 30 * 60;
export const FORBIDDEN_MIN_DELAY_SECONDS = 30;
export const FORBIDDEN_JITTER_RANGE = 0.4; // +/- 20%

// Storage keys for the persistent counter. Shared between
// AjaxTracker.recordForbidden() (writer on XHR-403) and StartService
// (reader on Forbidden-page reload). Same prefix as the rest of the
// script's sessionStorage so the dump-tool sees them.
export const FORBIDDEN_COUNT_KEY = HHStoredVarPrefixKey + 'Temp_forbiddenCount';
export const FORBIDDEN_LAST_AT_KEY = HHStoredVarPrefixKey + 'Temp_forbiddenLastAt';

/**
 * Compute the next reload delay in seconds for a given consecutive
 * Forbidden count.
 *
 * count is 1-based: the 1st Forbidden produces FORBIDDEN_BASE_SECONDS,
 * the 2nd doubles it, and so on, up to FORBIDDEN_CAP_SECONDS.
 *
 * @param count    number of consecutive Forbidden responses (>= 1)
 * @param random   RNG returning a value in [0, 1). Defaults to Math.random.
 *                 Injected so unit tests can produce deterministic results.
 */
export function nextForbiddenDelaySeconds(
    count: number,
    random: () => number = Math.random,
): number {
    const safeCount = Math.max(1, Math.floor(count));
    const factor = Math.pow(2, safeCount - 1);
    const target = Math.min(FORBIDDEN_BASE_SECONDS * factor, FORBIDDEN_CAP_SECONDS);
    const jitter = (1 - FORBIDDEN_JITTER_RANGE / 2) + random() * FORBIDDEN_JITTER_RANGE;
    return Math.max(FORBIDDEN_MIN_DELAY_SECONDS, Math.round(target * jitter));
}

/**
 * Window during which consecutive Forbidden responses are treated as the
 * same streak (and therefore keep escalating the backoff). If the gap
 * between two Forbiddens is larger than this window, the counter resets
 * to 1 because the script clearly recovered for a while in between.
 */
export const FORBIDDEN_STREAK_WINDOW_MS = 5 * 60 * 1000;

/**
 * Decide the next streak count given the previous count and the time
 * since the previous Forbidden.
 *
 * - If there was no previous Forbidden, the new count is 1.
 * - If the previous Forbidden is older than FORBIDDEN_STREAK_WINDOW_MS,
 *   the streak counts as broken and the new count is 1.
 * - Otherwise, the new count is the previous count + 1.
 *
 * Pure function so it can be unit-tested without sessionStorage.
 *
 * @param prevCount      previous stored count (>= 0)
 * @param prevTimestamp  ms epoch of previous Forbidden, or 0 if none
 * @param now            current ms epoch
 */
export function nextStreakCount(
    prevCount: number,
    prevTimestamp: number,
    now: number,
): number {
    if (!prevTimestamp || prevCount < 1) return 1;
    if (now - prevTimestamp > FORBIDDEN_STREAK_WINDOW_MS) return 1;
    return prevCount + 1;
}

/**
 * Minimal storage shape we need for recordForbidden(). sessionStorage
 * fits, and tests can pass a plain object stub.
 */
export interface ForbiddenStreakStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

/**
 * Record one Forbidden observation. Updates the persistent streak
 * counter and timestamp so the next StartService reload picks a delay
 * derived from the new count.
 *
 * Does NOT schedule a reload. The reload itself is handled by the
 * existing path in StartService when the next page actually renders
 * the "Forbidden" body. Calling recordForbidden() on an XHR-level 403
 * lets that delay be picked up by the very next reload, instead of
 * waiting for the script to bump the counter from a Forbidden-page
 * encounter.
 *
 * Storage and now() are injected so unit tests can drive the function
 * without needing real sessionStorage or wall-clock time.
 *
 * Returns the new streak count (or -1 if storage was unavailable and
 * the counter could not be updated).
 */
export function recordForbidden(
    storage: ForbiddenStreakStorage | null = defaultStorage(),
    now: () => number = Date.now,
): number {
    if (!storage) {
        logHHAuto('[ForbiddenBackoff] storage unavailable, Forbidden not recorded');
        return -1;
    }
    let prevCount = 0;
    let prevAt = 0;
    try {
        const rawCount = storage.getItem(FORBIDDEN_COUNT_KEY);
        prevCount = rawCount ? parseInt(rawCount, 10) : 0;
        if (!Number.isFinite(prevCount) || prevCount < 0) prevCount = 0;
        const rawAt = storage.getItem(FORBIDDEN_LAST_AT_KEY);
        prevAt = rawAt ? parseInt(rawAt, 10) : 0;
        if (!Number.isFinite(prevAt) || prevAt < 0) prevAt = 0;
    } catch (e) {
        // proceed with zeros; we still want to record this Forbidden
    }

    const t = now();
    const count = nextStreakCount(prevCount, prevAt, t);
    try {
        storage.setItem(FORBIDDEN_COUNT_KEY, String(count));
        storage.setItem(FORBIDDEN_LAST_AT_KEY, String(t));
    } catch (e) {
        logHHAuto('[ForbiddenBackoff] storage write failed, Forbidden not persisted');
        return -1;
    }
    logHHAuto('[ForbiddenBackoff] XHR 403 recorded (streak #' + count + ')');
    return count;
}

function defaultStorage(): ForbiddenStreakStorage | null {
    try {
        if (typeof sessionStorage !== 'undefined') return sessionStorage;
    } catch (e) { /* sessionStorage may throw in restricted contexts */ }
    return null;
}