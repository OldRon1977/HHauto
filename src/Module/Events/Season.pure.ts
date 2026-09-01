// Season.pure.ts -- Pure decision logic extracted from Season.isTimeToFight
// for the "fight blocked only by a missing booster" fast-retry case.
//
// Observed live: when Season.isTimeToFight() returns false
// solely because autoSeasonBoostedOnly requires a booster and none is
// equipped, the generic Pipeline.config.ts fallback (handleSeason's
// seasonBattleOrTimer step) would otherwise arm the same long "wait for
// energy" timer (15-17 min) as every other reason to wait. Since
// handleAutoEquipBoosters fixes a missing booster within a couple of minutes,
// most of that wait is lost fight time. This module decides when a short retry
// is warranted instead of the long one.
//
// Extracted so the boolean cascade can be unit-tested without globals,
// storage, or DOM access. Input = data, output = decision. The impure
// adapter Season.isBlockedOnlyByMissingBooster builds the state from
// storage/Booster/checkTimer and delegates here.

export type BoosterWaitState = {
    /** checkTimer('nextSeasonTime') -- the season timer has actually expired. */
    timerExpired: boolean;
    /** Season.isTimeToFight's energyAboveThreshold computation. */
    energyAboveThreshold: boolean;
    /** Setting_autoSeasonBoostedOnly -- a booster is required to fight. */
    needBoosterToFight: boolean;
    /** Booster.haveBoosterEquiped() -- a booster is currently equipped. */
    haveBoosterEquipped: boolean;
    /**
     * Setting_autoEquipBoosters -- auto-equip is switched on. Without it a
     * missing booster will never fix itself, so a short retry would just be
     * wasted polling; the long timer is the correct behavior in that case.
     */
    autoEquipBoostersEnabled: boolean;
};

/**
 * True when the ONLY thing stopping a season fight right now is a missing
 * booster, and auto-equip is on to (probably) fix it shortly. Every other
 * blocker -- timer still running, energy too low, no booster requirement --
 * must fall through to the caller's normal long-timer path.
 */
export function isBlockedOnlyByMissingBooster(state: BoosterWaitState): boolean {
    return state.timerExpired
        && state.energyAboveThreshold
        && state.needBoosterToFight
        && !state.haveBoosterEquipped
        && state.autoEquipBoostersEnabled;
}
