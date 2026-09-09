// Pantheon.pure.ts -- Pure decision logic for the pantheon auto module.
//
// Extracted from Pantheon.isTimeToFight so the boolean cascade can be
// unit-tested without globals, storage, jQuery, or DOM access.
// Input = data, output = decision.
//
// The impure adapter Pantheon.isTimeToFight reads ConfigHelper, storage,
// the Hero energy global, ParanoiaService, Booster, and DailyGoals; it
// then builds a ShouldFightState and delegates here.
//
// The level gate that used to live here as decideIsEnabled moved into the
// shared table in Service/FeatureGate.ts -- it was the same "advertised by
// the game AND level high enough" cascade seven other modules wrote out by
// hand (ADR-012).

export type ShouldFightState = {
    energy: number;
    threshold: number;
    runThreshold: number;
    humanLikeRun: boolean;
    /**
     * checkTimer('nextPantheonTime') -- boolean for the pantheon
     * cooldown. true when the timer has expired.
     */
    timerExpired: boolean;
    /**
     * ParanoiaService.checkParanoiaSpendings('worship'). The pure
     * function gates it on energy > 0 itself, mirroring the original.
     */
    paranoiaSpending: number;
    /**
     * Setting_autoPantheonBoostedOnly -- only fight when boosters are
     * equipped (unless the daily-goal override fires).
     */
    needBoosterToFight: boolean;
    /**
     * Booster.haveBoosterEquiped() -- a booster is currently equipped.
     */
    haveBoosterEquipped: boolean;
    /**
     * DailyGoals.isPantheonDailyGoal() -- a pantheon daily goal is
     * active. Overrides the booster requirement.
     */
    isDailyGoal: boolean;
};

/**
 * Reproduce Pantheon.isTimeToFight bit by bit. Original line:
 *
 *   (checkTimer('nextPantheonTime') && energyAboveThreshold &&
 *    (needBoosterToFight && haveBoosterEquiped || !needBoosterToFight
 *     || isDailyGoal)) || paranoiaSpending
 *
 * with
 *
 *   energyAboveThreshold = humanLikeRun && energy > threshold
 *                          || energy > max(threshold, runThreshold - 1)
 *   paranoiaSpending     = energy > 0 && paranoiaCheck > 0
 *
 * Operator precedence is preserved: && binds tighter than ||, so the
 * three OR-ed booster branches keep their natural structure
 * (booster-required-and-equipped OR booster-not-required OR daily-goal).
 *
 * Threshold comparisons are strict (>) on the lower bound and the
 * runThreshold-1 expression keeps the off-by-one the original code uses.
 */
export function decideShouldFight(state: ShouldFightState): boolean {
    const {
        energy,
        threshold,
        runThreshold,
        humanLikeRun,
        timerExpired,
        paranoiaSpending,
        needBoosterToFight,
        haveBoosterEquipped,
        isDailyGoal,
    } = state;

    const energyAboveThreshold =
        (humanLikeRun && energy > threshold)
        || energy > Math.max(threshold, runThreshold - 1);
    const paranoiaOverride = energy > 0 && paranoiaSpending > 0;
    const boosterCheck =
        (needBoosterToFight && haveBoosterEquipped)
        || !needBoosterToFight
        || isDailyGoal;

    return (timerExpired && energyAboveThreshold && boosterCheck) || paranoiaOverride;
}