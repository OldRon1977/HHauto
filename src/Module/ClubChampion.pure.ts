// ClubChampion.pure.ts -- Pure decision logic for the club-champion auto module.
//
// Extracted from ClubChampion.updateClubChampionTimer and
// ClubChampion._setTimer so the range selection and timer alignment can be
// unit-tested without DOM access, jQuery, randomInterval, or the timer
// helper.
//
// Two decisions live here:
//
// 1. decideNextClubChampionTime maps the scraped "seconds to next timer"
//    plus the autoClubForceStart setting onto the [min, max] window the
//    impure adapter then feeds into randomInterval. The girl-reward
//    substitution is deliberately NOT modelled here -- it happens at the
//    DOM-scrape boundary (getNextClubChampionTimer) and feeds a
//    pre-substituted secsToNextTimer into this function. That keeps the
//    pure layer uniform: input is one number, output is one window.
//
// 2. decideAlignedClubChampionTimer reproduces the small alignment branch
//    in _setTimer: if both autoChamps and autoChampAlignTimer are on AND
//    both timers fall into the alignment window, return max(proposed,
//    champTimeLeft); otherwise return the proposed value untouched.
//
// Bit-for-bit equivalence is the explicit goal -- thresholds (>7200, >10,
// <1200) keep their strict comparisons.

export type NextClubChampionTimerState = {
    /**
     * Seconds left on whichever rest timer the DOM scraped, AFTER the
     * girl-reward substitution. -1 means no timer was found.
     */
    secsToNextTimer: number;
    /**
     * Setting_autoClubForceStart. When true and the timer exceeds 7200s,
     * the window narrows to [115min, 125min] so the bot still runs in a
     * sensible cadence instead of waiting two hours.
     */
    autoClubForceStart: boolean;
};

export type NextClubChampionTimerReason =
    | 'no-timer'
    | 'force-start'
    | 'normal';

export type NextClubChampionTimerDecision = {
    minTime: number;
    maxTime: number;
    reason: NextClubChampionTimerReason;
};

/**
 * Map the scraped timer plus force-start flag to a [min, max] window for
 * randomInterval. Reproduces the three-branch cascade in
 * updateClubChampionTimer line by line:
 *
 *   secsToNextTimer === -1                     -> [15*60, 17*60]   no-timer
 *   secsToNextTimer >  7200 && force-start     -> [115*60, 125*60] force-start
 *   else                                       -> [secs, secs+180] normal
 *
 * The 7200s threshold is strict (>): a timer of exactly 7200 falls
 * through to the normal branch.
 */
export function decideNextClubChampionTime(
    state: NextClubChampionTimerState,
): NextClubChampionTimerDecision {
    if (state.secsToNextTimer === -1) {
        return { minTime: 15 * 60, maxTime: 17 * 60, reason: 'no-timer' };
    }
    if (state.secsToNextTimer > 7200 && state.autoClubForceStart) {
        return { minTime: 115 * 60, maxTime: 125 * 60, reason: 'force-start' };
    }
    return {
        minTime: state.secsToNextTimer,
        maxTime: 180 + state.secsToNextTimer,
        reason: 'normal',
    };
}

export type AlignClubChampionTimerState = {
    /**
     * The candidate value the adapter would otherwise hand to setTimer.
     */
    proposedTime: number;
    /**
     * Seconds remaining on the sibling 'nextChampionTime' timer.
     */
    champTimeLeft: number;
    /**
     * Setting_autoChamps -- the sibling auto module is enabled.
     */
    autoChamps: boolean;
    /**
     * Setting_autoChampAlignTimer -- align both timers when both are short.
     */
    autoChampAlignTimer: boolean;
};

/**
 * Reproduce the alignment branch in _setTimer:
 *
 *   if (autoChamps && autoChampAlignTimer
 *       && proposedTime > 10 && champTimeLeft < 1200 && proposedTime < 1200)
 *       proposedTime = max(proposedTime, champTimeLeft);
 *
 * All three threshold comparisons are strict on purpose:
 *   proposedTime > 10  -- skip near-immediate retries
 *   champTimeLeft < 1200, proposedTime < 1200 -- only align when both are
 *   below 20 minutes
 *
 * The intent of the alignment is to bundle club-champion and
 * single-champion runs onto the same wake-up: when both fire within the
 * next 20 minutes, the later one wins so the script does not page-cycle
 * twice in quick succession.
 */
export function decideAlignedClubChampionTimer(
    state: AlignClubChampionTimerState,
): number {
    if (
        state.autoChamps
        && state.autoChampAlignTimer
        && state.proposedTime > 10
        && state.champTimeLeft < 1200
        && state.proposedTime < 1200
    ) {
        return Math.max(state.proposedTime, state.champTimeLeft);
    }
    return state.proposedTime;
}