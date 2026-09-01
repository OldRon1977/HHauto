// Bundles.pure.ts -- Pure decision logic for the free-bundle collector.
//
// Extracted from Bundles.getExpiryTime so the 24-hour threshold check
// can be unit-tested without DOM access, jQuery, or randomInterval.
//
// The impure adapter Bundles.getExpiryTime scrapes the popup timer(s)
// from the DOM and falls back to maxCollectionDelay + jitter when no
// timer is found, or when the scraped value is at or above the
// 24-hour cap. That cap is NOT a "this looks like garbage" check --
// live measurement confirmed values well past 24h are
// ordinary bundle durations (a period_deal timer read 1454400s, ~16.8
// days, in one run). The cap exists so the next free-bundle check
// still happens within maxCollectionDelay instead of waiting out the
// full bundle duration; classifyExpiryTime lets the caller log that
// case as routine rather than as an error. This module also exposes
// the pure helpers used to reduce several scraped timers to one value
// (minScrapedSeconds) and to strip the locale prose ("Expires in ")
// off the scraped text before it reaches convertTimeToInt
// (extractTimerText). The fallback value itself is computed by the
// adapter and passed in.

export type ExpiryTimeState = {
    /**
     * The seconds value scraped from the popup timer span. null when
     * the DOM lookup found no matching element. The original code
     * keyed on $(...).length > 0 -- that boolean maps to (scraped !==
     * null) here.
     */
    scrapedSeconds: number | null;
    /**
     * Pre-computed fallback seconds (maxCollectionDelay + jitter from
     * the impure adapter). Used both when the timer is missing and
     * when the scraped value is at-or-above the 24-hour cap.
     */
    fallbackSeconds: number;
};

/**
 * Reproduce Bundles.getExpiryTime bit by bit:
 *
 *   if scrapedSeconds === null            -> fallbackSeconds
 *   if scrapedSeconds >= 24 * 3600        -> fallbackSeconds
 *   otherwise                              -> scrapedSeconds
 *
 * The 24-hour boundary is strict (<): the original code reads
 * `if (freeBundleTimer < 24 * 3600) return freeBundleTimer`, so
 * exactly 24 * 3600 falls through to the fallback branch.
 */
export function decideExpiryTime(state: ExpiryTimeState): number {
    if (state.scrapedSeconds === null) return state.fallbackSeconds;
    if (state.scrapedSeconds >= 24 * 3600) return state.fallbackSeconds;
    return state.scrapedSeconds;
}

/**
 * Classifies why decideExpiryTime fell back to fallbackSeconds, so the
 * caller can log the two cases differently:
 *
 *   'missing' -- no timer was scraped at all, i.e. an actual read
 *                failure (selector drift, popup not open, ...).
 *   'capped'  -- a timer WAS read successfully, it's just a routine
 *                long-running bundle (>= 24h) that gets capped so the
 *                next check still happens within maxCollectionDelay.
 *   'scraped' -- the scraped value was used as-is, no fallback.
 *
 * Only 'missing' warrants an ERROR log; 'capped' is normal operation.
 */
export type ExpiryTimeOutcome = 'missing' | 'capped' | 'scraped';

export function classifyExpiryTime(scrapedSeconds: number | null): ExpiryTimeOutcome {
    if (scrapedSeconds === null) return 'missing';
    if (scrapedSeconds >= 24 * 3600) return 'capped';
    return 'scraped';
}

/**
 * The popup can show several bundle tiles under one visible tab at
 * once (e.g. multiple special_offers tiles, each with its own
 * countdown), so the DOM scrape yields one seconds value per tile.
 * The soonest one is what should drive the next free-bundle check.
 */
export function minScrapedSeconds(values: number[]): number | null {
    if (values.length === 0) return null;
    return values.reduce((min, value) => (value < min ? value : min), values[0]);
}

/**
 * The scraped timer text carries locale prose ahead of the actual
 * duration -- e.g. "Expires in 4d 21h" -- while convertTimeToInt only
 * understands duration tokens ("4d 21h"). Keep only the tokens that
 * contain a digit so words like "Expires"/"in" never reach it (each
 * would otherwise trip its "Timer symbol not recognized" branch).
 */
export function extractTimerText(rawText: string): string {
    return rawText
        .split(/\s+/)
        .filter(token => /\d/.test(token))
        .join(' ');
}