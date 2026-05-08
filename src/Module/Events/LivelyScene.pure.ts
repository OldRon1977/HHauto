// LivelyScene.pure.ts -- Pure decision logic for the Lively Scene event.
//
// Extracted from LivelyScene.parse and LivelyScene.parseClaimableRewards
// so the collect-trigger cascade and the puzzle-piece filter can be
// unit-tested without DOM access, jQuery, storage, or game globals.
//
// Two decisions live here:
//
// 1. decideCollectTrigger -- the three-branch OR cascade in
//    LivelyScene.parse that decides whether to invoke goAndCollect at
//    all. Triggered by any of:
//      - autoCollect setting on (continuous polling)
//      - manualCollectAll flag on (user-initiated full sweep)
//      - autoCollectAll setting on AND remainingTime is below the
//        end-of-event threshold
//
// 2. selectClaimablePieces -- the loop in parseClaimableRewards that
//    walks the puzzle-piece list and keeps only the entries that are
//    unlocked-but-not-claimed AND match the per-piece eligibility
//    rule: matching rewardType under needToCollect, OR needToCollectAll
//    (any rewardType), OR manualCollectAll (any rewardType).

export type CollectTriggerState = {
    /**
     * Setting_autoLivelySceneEventCollect -- the per-poll auto-collect
     * setting.
     */
    autoCollect: boolean;
    /**
     * Temp_lseManualCollectAll -- user-initiated manual sweep flag,
     * persisted between adapter calls so a multi-piece sweep can run
     * to completion.
     */
    manualCollectAll: boolean;
    /**
     * Setting_autoLivelySceneEventCollectAll -- end-of-event sweep
     * setting. Only fires when remainingTime is below limitBeforeEnd.
     */
    autoCollectAll: boolean;
    /**
     * Seconds left on the event timer (parsed from the DOM by the
     * impure adapter; null is not modelled here -- the adapter passes
     * a default value when the timer is missing).
     */
    remainingTime: number;
    /**
     * getLimitTimeBeforeEnd() result. Strict < boundary: remainingTime
     * exactly equal to limitBeforeEnd does NOT trigger autoCollectAll.
     */
    limitBeforeEnd: number;
};

/**
 * Reproduce the OR cascade in LivelyScene.parse bit by bit:
 *
 *   autoCollect
 *   || manualCollectAll
 *   || (remainingTime < limitBeforeEnd && autoCollectAll)
 *
 * Operator precedence preserved: && binds tighter than ||, so the
 * end-of-event branch parses as one parenthesised conjunction.
 */
export function decideCollectTrigger(state: CollectTriggerState): boolean {
    return (
        state.autoCollect
        || state.manualCollectAll
        || (state.remainingTime < state.limitBeforeEnd && state.autoCollectAll)
    );
}

/**
 * Minimum subset of puzzle-piece fields the filter reads. The impure
 * adapter computes rewardType from the piece's reward.shards /
 * reward.rewards[0].type using optional chaining and passes the
 * result here.
 */
export interface PuzzlePieceLite {
    reward_unlocked: boolean;
    reward_claimed: boolean;
    rewardType: string;
}

export type SelectClaimableState = {
    /**
     * Setting_autoLivelySceneEventCollectablesList -- list of reward
     * types the user opted into collecting on the per-poll path.
     */
    rewardsToCollect: string[];
    /**
     * checkTimer('nextLivelySceneEventCollectTime') AND
     * Setting_autoLivelySceneEventCollect === "true". The adapter
     * computes both factors and hands in the conjunction.
     */
    needToCollect: boolean;
    /**
     * remainingTime < limitBeforeEnd AND
     * Setting_autoLivelySceneEventCollectAll === "true". The adapter
     * computes both factors and hands in the conjunction.
     */
    needToCollectAll: boolean;
    /**
     * Same flag as in CollectTriggerState; the user-initiated full
     * sweep ignores rewardsToCollect.
     */
    manualCollectAll: boolean;
};

/**
 * Reproduce the loop in LivelyScene.parseClaimableRewards bit by bit.
 * Walks the input list and keeps every piece for which:
 *
 *   reward_unlocked AND NOT reward_claimed
 *   AND (
 *     (rewardsToCollect.includes(rewardType) AND needToCollect)
 *     OR needToCollectAll
 *     OR manualCollectAll
 *   )
 *
 * Operator precedence preserved (&& binds tighter than ||): the per-
 * type allowlist only gates the per-poll branch; the two sweep modes
 * accept any rewardType.
 */
export function selectClaimablePieces<T extends PuzzlePieceLite>(
    pieces: T[],
    state: SelectClaimableState,
): T[] {
    const claimable: T[] = [];
    for (const piece of pieces) {
        if (piece.reward_unlocked && !piece.reward_claimed) {
            const allowedByType =
                state.rewardsToCollect.includes(piece.rewardType)
                && state.needToCollect;
            if (allowedByType || state.needToCollectAll || state.manualCollectAll) {
                claimable.push(piece);
            }
        }
    }
    return claimable;
}