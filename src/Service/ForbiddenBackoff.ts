// ForbiddenBackoff.ts
//
// Exponential backoff calculator for the persistent Forbidden counter
// used by StartService.hardened_start() (issue #1598).
//
// Each consecutive Forbidden response doubles the random reload window,
// capped at FORBIDDEN_CAP_SECONDS. A jitter of +/- 20% is applied so
// multiple tabs hitting the same rate-limit do not all retry in lockstep.

export const FORBIDDEN_BASE_SECONDS = 60;
export const FORBIDDEN_CAP_SECONDS = 30 * 60;
export const FORBIDDEN_MIN_DELAY_SECONDS = 30;
export const FORBIDDEN_JITTER_RANGE = 0.4; // +/- 20%

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
