// Bundles.pure.ts -- Pure decision logic for the free-bundle collector.
//
// Extracted from Bundles.getExpiryTime so the 24-hour threshold check
// can be unit-tested without DOM access, jQuery, or randomInterval.
//
// The impure adapter Bundles.getExpiryTime scrapes the popup timer
// from the DOM and falls back to maxCollectionDelay + jitter when the
// timer is missing or claims to be more than a day in the future
// (which happens with stale or malformed DOM state). This pure
// function captures only the threshold decision; the fallback value
// itself is computed by the adapter and passed in.

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