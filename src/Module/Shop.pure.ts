// Shop.pure.ts -- Pure decision logic for the market (shop) visit trigger.
//
// Extracted from Shop.isTimeToCheckShop so the "do we need to walk to
// /shop.html?" decision can be unit-tested without storage or timers.
//
// The gate used to list only the two *reader* opt-ins (updateMarket and
// the booster-status readers behind needBoosterStatusFromStore). The
// *buyer* opt-in autoBuyBoosters was missing, so a user who enabled only
// that switch never navigated to the market: storeContents stayed
// undefined and Market.doShopping bailed out on its very first guard.
// decideCheckShop adds that third reason.

import { hasBuyableBoosters } from "./Market.pure";

export type CheckShopState = {
    /** Setting_updateMarket === "true". */
    updateMarket: boolean;
    /** Booster.needBoosterStatusFromStore(). */
    needBoosterStatus: boolean;
    /**
     * Setting_autoBuyBoosters === "true". Already resolves to false when
     * the spendKobans0 master switch is off (kobanUsing in HHStoredVars).
     */
    autoBuyBoosters: boolean;
    /** Raw Setting_autoBuyBoostersFilter value (";"-separated "code:amount" pairs). */
    autoBuyBoostersFilter: string;
    /** Setting_paranoia === "true". */
    paranoia: boolean;
    /** checkTimer("paranoiaSwitch") -- true while NO timer is pending. */
    paranoiaSwitchReady: boolean;
};

/**
 * True when the buy-boosters automation has something to shop for, i.e.
 * the opt-in is on AND the filter names at least one booster code. An
 * empty filter would make Market.doShopping loop over nothing, so there
 * is no point walking to the market for it.
 */
export function needsStoreContentsForBuying(state: CheckShopState): boolean {
    if (!state.autoBuyBoosters) return false;
    // An empty list has nothing to shop for, and an unreadable one buys
    // nothing either (#1844) -- walking to the market for either would be a
    // navigation per cycle with no purchase at the end of it.
    return hasBuyableBoosters(state.autoBuyBoostersFilter);
}

/**
 * Reproduce Shop.isTimeToCheckShop:
 *
 *     (updateMarket || needBoosterStatus || needsStoreContentsForBuying)
 *     && (!paranoia || !paranoiaSwitchReady)
 *
 * The paranoia leg is unchanged: while paranoia mode is on, the market
 * is only visited inside a burst window (a pending paranoiaSwitch timer).
 */
export function decideCheckShop(state: CheckShopState): boolean {
    const needsMarketData = state.updateMarket
        || state.needBoosterStatus
        || needsStoreContentsForBuying(state);
    return needsMarketData && (!state.paranoia || !state.paranoiaSwitchReady);
}
