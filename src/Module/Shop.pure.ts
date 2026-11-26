// Shop.pure.ts -- Pure decision logic for the market (shop) visit trigger,
// and the presets of the sell dialog.
//
// Extracted from Shop.isTimeToCheckShop so the "do we need to walk to
// /shop.html?" decision can be unit-tested without storage or timers.
//
// The gate has three reasons, not two: the reader opt-ins (updateMarket and
// the booster-status readers behind needBoosterStatusFromStore) plus the buyer
// opt-in autoBuyBoosters. Without the third, a user who enables only that
// switch never navigates to the market, storeContents stays undefined and
// Market.doShopping bails out on its first guard.

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
 * The visit decision behind Shop.isTimeToCheckShop:
 *
 *     (updateMarket || needBoosterStatus || needsStoreContentsForBuying)
 *     && (!paranoia || !paranoiaSwitchReady)
 *
 * The paranoia leg: while paranoia mode is on, the market
 * is only visited inside a burst window (a pending paranoiaSwitch timer).
 */
export function decideCheckShop(state: CheckShopState): boolean {
    const needsMarketData = state.updateMarket
        || state.needBoosterStatus
        || needsStoreContentsForBuying(state);
    return needsMarketData && (!state.paranoia || !state.paranoiaSwitchReady);
}

// ---------------------------------------------------------------------------
// Sell dialog presets (#1948)
//
// What the player set in the sell dialog is kept for the next visit: the
// amount of inventory to load, the amount to sell, and the locks.
//
// Locks are stored as rules, not as a snapshot of locked slots. A click on a
// table cell, row or column stores every (stat; slot; rarity) cell it covers,
// so items the market loads later -- the inventory is paged in as the list is
// scrolled -- are locked the moment they appear. The Lock button on a single
// item stores an exception for that item's id_member_armor, which wins over
// the rules in both directions.
// ---------------------------------------------------------------------------

export type SellMenuPrefs = {
    /** "all" or a whole number, exactly as the player typed it. */
    maxItems: string;
    sellNumber: number;
    /** Locked table cells as "stat;slot;rarity", e.g. "8;3;rare", "mythic;1;mythic". */
    lockRules: string[];
    /** id_member_armor -> locked, set by the Lock button on one item. */
    lockOverrides: Record<string, boolean>;
};

/** "all" (any case) or digits; the same rule the input field shows red against. */
export const SELL_MAX_ITEMS_PATTERN = "[Aa][Ll][Ll]|[0-9]+";

/** Amount of inventory to load: Infinity for "all", null when unreadable. */
export function parseSellMaxItems(raw: string): number | null {
    const v = String(raw ?? '').trim();
    if (/^all$/i.test(v)) return Number.POSITIVE_INFINITY;
    if (/^[0-9]+$/.test(v)) return Number(v);
    return null;
}

/** Whatever the store holds, turned into a complete SellMenuPrefs. */
export function readSellMenuPrefs(stored: unknown): SellMenuPrefs {
    const o = (stored && typeof stored === 'object' && !Array.isArray(stored)) ? stored as Record<string, unknown> : {};
    const maxItems = typeof o.maxItems === 'string' && parseSellMaxItems(o.maxItems) !== null ? o.maxItems.trim() : 'all';
    const sellNumber = typeof o.sellNumber === 'number' && Number.isInteger(o.sellNumber) && o.sellNumber >= 0 ? o.sellNumber : 0;
    const lockRules = Array.isArray(o.lockRules) ? [...new Set(o.lockRules.filter((r): r is string => typeof r === 'string'))] : [];
    const lockOverrides: Record<string, boolean> = {};
    if (o.lockOverrides && typeof o.lockOverrides === 'object' && !Array.isArray(o.lockOverrides)) {
        for (const [id, v] of Object.entries(o.lockOverrides as Record<string, unknown>)) {
            if (typeof v === 'boolean') lockOverrides[id] = v;
        }
    }
    return { maxItems, sellNumber, lockRules, lockOverrides };
}

/** The rule key of a table cell, from its menuSellFilter "c:8;t:3;r:rare". */
export function ruleKeyFromCellFilter(filter: string): string | null {
    const m = /^c:([^;]+);t:([^;]+);r:([^;]+)$/.exec(filter);
    if (!m || m[1] === '*' || m[2] === '*' || m[3] === '*') return null;
    return m[1] + ';' + m[2] + ';' + m[3];
}

/**
 * The rule key of an inventory slot, from its data-d. Read with the same
 * substrings the table counts with (Shop.menuSellListItems), so a slot is
 * locked by exactly the cell it is counted in. Mythics have their own row.
 */
export function ruleKeyFromSlotData(dataD: string): string | null {
    const rarity = /"rarity":"(\w+)"/.exec(dataD)?.[1];
    const subtype = /"subtype":(\d+),/.exec(dataD)?.[1];
    if (!rarity || !subtype) return null;
    if (rarity === 'mythic') return 'mythic;' + subtype + ';mythic';
    const stat = /"name_add":(\d+),/.exec(dataD)?.[1];
    return stat ? stat + ';' + subtype + ';' + rarity : null;
}

export function armorIdFromSlotData(dataD: string): string | null {
    return /"id_member_armor":(\d+)/.exec(dataD)?.[1] ?? null;
}

/** Rules after locking (lock=true) or unlocking the given cells. */
export function setLockRules(rules: string[], keys: string[], lock: boolean): string[] {
    const set = new Set(rules);
    for (const k of keys) {
        if (lock) set.add(k); else set.delete(k);
    }
    return [...set];
}

/** Whether a slot is locked: its own exception first, then the rule of its cell. */
export function isSlotLocked(prefs: SellMenuPrefs, ruleKey: string | null, id: string | null): boolean {
    if (id !== null && Object.prototype.hasOwnProperty.call(prefs.lockOverrides, id)) {
        return prefs.lockOverrides[id];
    }
    return ruleKey !== null && prefs.lockRules.includes(ruleKey);
}

/**
 * The exception for one item after the Lock button set it to `locked`. An
 * exception that only repeats its cell's rule is dropped, so the list holds
 * the items that really differ from their cell.
 */
export function setLockOverride(prefs: SellMenuPrefs, ruleKey: string | null, id: string, locked: boolean): Record<string, boolean> {
    const next = { ...prefs.lockOverrides };
    const byRule = ruleKey !== null && prefs.lockRules.includes(ruleKey);
    if (locked === byRule) delete next[id]; else next[id] = locked;
    return next;
}

/** Exceptions of items that are no longer in the (fully loaded) inventory are dropped. */
export function pruneLockOverrides(overrides: Record<string, boolean>, presentIds: Iterable<string>): Record<string, boolean> {
    const present = new Set(presentIds);
    const next: Record<string, boolean> = {};
    for (const [id, v] of Object.entries(overrides)) {
        if (present.has(id)) next[id] = v;
    }
    return next;
}
