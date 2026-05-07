// Champion.pure.ts -- Pure decision logic for the champions auto module.
//
// Extracted from Champion.findNextChamptionTime so the timer scan can be
// unit-tested without DOM access, jQuery, randomInterval, or the timer
// helper. Input = a list of champion decision rows + the relevant
// settings; output = the deterministic tuple (minTime, minTimeEnded)
// that the impure adapter feeds into randomInterval and _setTimer.
//
// The variable naming is preserved from the original implementation:
// despite the name, both fields hold MAX values for the entries that
// match their respective bucket. minTime is the largest entry below
// 1800s, minTimeEnded is the largest known positive timer overall.
// We do not change this contract here -- only extract it.

export type ChampionTimerEntry = {
    /**
     * inFilter == false -> ignored entirely (matches original behaviour).
     */
    inFilter: boolean;
    /**
     * timer === 0      -> ready right now
     * timer >  0       -> running, with that many seconds left
     * timer <  0       -> no timer (encounter never started or already over)
     */
    timer: number;
    /**
     * started == false combined with autoChampsForceStart triggers an
     * immediate-act result, mirroring the original break.
     */
    started: boolean;
};

export type ChampionTimerDecision = {
    /**
     * -1: no eligible champion is ready or running below 1800s.
     *  0: at least one entry is ready right now (or force-start applies).
     * >0: the largest running timer below 1800s.
     */
    minTime: number;
    /**
     * -1: either no entry has a positive timer, or the loop short-circuited
     *     on a ready/force-start entry (in which case the original code
     *     intentionally drops this signal).
     * >0: the largest positive timer across all eligible entries.
     */
    minTimeEnded: number;
};

/**
 * Reproduce the existing findNextChamptionTime scan bit by bit. The input
 * list is iterated in order; the first ready (timer === 0) or
 * force-start-eligible entry short-circuits with minTime=0/minTimeEnded=-1.
 *
 * Bit-for-bit equivalence to the in-place loop is the explicit goal -- the
 * inner > comparison (instead of <) and the early break are preserved on
 * purpose so that the adapter behaviour does not shift.
 */
export function decideNextChampionTime(
    champions: ChampionTimerEntry[],
    autoChampsForceStart: boolean,
): ChampionTimerDecision {
    let minTime = -1;
    let minTimeEnded = -1;

    for (const champion of champions) {
        if (!champion.inFilter) {
            continue;
        }
        const currTime = champion.timer;
        if (currTime === 0) {
            return { minTime: 0, minTimeEnded: -1 };
        }
        if (currTime > 0) {
            if (currTime > minTimeEnded) {
                minTimeEnded = currTime;
            }
            // Original wording (preserved): largest timer below 1800s.
            if (currTime > minTime && currTime < 1800) {
                minTime = currTime;
            }
            continue;
        }
        // currTime < 0
        if (!champion.started && autoChampsForceStart) {
            return { minTime: 0, minTimeEnded: -1 };
        }
    }

    return { minTime, minTimeEnded };
}
