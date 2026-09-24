// Champion.pure.ts -- Pure decision logic for the champions auto module.
//
// Extracted from Champion.findNextChamptionTime so the timer scan can be
// unit-tested without DOM access, jQuery, randomInterval, or the timer
// helper. Input = a list of champion decision rows + the relevant
// settings; output = the deterministic tuple (minTime, minTimeEnded)
// that the impure adapter feeds into randomInterval and _setTimer.
//
// Despite their names, both fields hold MAX values for the entries that
// match their respective bucket: minTime is the largest entry below 1800s,
// minTimeEnded is the largest known positive timer overall. The adapter
// relies on that contract.

export type ChampionTimerEntry = {
    /**
     * inFilter == false -> ignored entirely.
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
     * immediate-act result and ends the scan.
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
     *     on a ready/force-start entry (which deliberately drops this
     *     signal).
     * >0: the largest positive timer across all eligible entries.
     */
    minTimeEnded: number;
};

/**
 * The timer scan behind findNextChamptionTime. The input list is iterated
 * in order; the first ready (timer === 0) or force-start-eligible entry
 * short-circuits with minTime=0/minTimeEnded=-1. The > comparisons (a
 * maximum, not a minimum) and the early break are part of the contract.
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
            // Largest timer below 1800s.
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


/**
 * Parsed shape of a champion locked-stage "champion-rewards-tooltip"
 * attribute, reduced to the fields the event-girl availability check needs.
 */
export type LockedStageRewards = {
    stage?: { girl_shards?: Array<{ id_girl: number }> };
} | null;

/**
 * Decide whether an event girl is still obtainable on a champion, given the
 * parsed "champion-rewards-tooltip" of the champion's first locked stage and
 * the event girl ids targeted for that champion.
 *
 * Mirrors the availability check inside doChampionStuff (autoChampGirlOnChamp):
 * the girl counts as available only when the first locked stage lists
 * girl_shards that include one of the targeted girl ids. Used to gate the
 * timer=0 force in getChampionListFromMap so the timer scan does not flag a
 * champion as "ready now" when no event-girl fight will actually start.
 */
export function isEventGirlAvailableOnLockedStage(
    parsedFirstLockedStage: LockedStageRewards,
    targetGirlIds: number[],
): boolean {
    if (parsedFirstLockedStage === null) {
        return false;
    }
    const shards = parsedFirstLockedStage.stage?.girl_shards;
    if (!shards || shards.length === 0) {
        return false;
    }
    for (const shard of shards) {
        if (targetGirlIds.includes(shard.id_girl)) {
            return true;
        }
    }
    return false;
}
