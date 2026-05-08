// Pantheon.pure.ts -- Pure decision logic for the pantheon auto module.
//
// Extracted from Pantheon.isEnabled and Pantheon.isTimeToFight so the
// boolean cascades can be unit-tested without globals, storage, jQuery,
// or DOM access. Input = data, output = decision.
//
// The impure adapter Pantheon.isEnabled reads ConfigHelper plus
// HeroHelper, builds an IsEnabledState, and delegates here. The impure
// adapter Pantheon.isTimeToFight reads ConfigHelper, storage, the
// Hero energy global, ParanoiaService, Booster, and DailyGoals; it
// then builds a ShouldFightState and delegates here.

export type IsEnabledState = {
    /**
     * ConfigHelper.getHHScriptVars("isEnabledPantheon", false) -- the
     * pantheon module is currently advertised by the game variant.
     */
    enabled: boolean;
    heroLevel: number;
    /**
     * ConfigHelper.getHHScriptVars("LEVEL_MIN_PANTHEON") -- the level
     * gate the game enforces. >= comparison is preserved.
     */
    minLevel: number;
};

/**
 * Reproduce Pantheon.isEnabled bit by bit:
 *
 *   isEnabledPantheon AND heroLevel >= LEVEL_MIN_PANTHEON
 *
 * The level gate is non-strict (>=), matching the original.
 */
export function decideIsEnabled(state: IsEnabledState): boolean {
    return state.enabled && state.heroLevel >= state.minLevel;
}

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