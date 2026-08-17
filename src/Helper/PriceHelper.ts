// PriceHelper.ts
//
// Parses human-readable price strings from the game UI back into raw
// numbers. The game displays large values with suffixes (e.g. "105K",
// "6.38M", "2.1B"), and this helper reverses that formatting so the
// script can do arithmetic on actual values.
//
// Handles locale differences by treating commas as decimal separators
// (common in European localizations).
//
// Used by: RewardHelper (reward value calculation), Market module

import { NumberHelper } from "./NumberHelper";

/** Converts a compact price string like "105K" or "6.38M" back to a number. */
export function parsePrice(princeStr:string):number {
    // Parse price to number 105K to 105000, 6.38M to 6380000
    // Replace comma by dots for local supports
    let ret = Number.NaN;
    if(princeStr && princeStr.indexOf('B')>0) {
        ret = Number(princeStr.replace(/B/g, '').replace(',', '.')) * 1000000000;
    } else if(princeStr && princeStr.indexOf('M')>0) {
        ret = Number(princeStr.replace(/M/g, '').replace(',', '.')) * 1000000;
    } else if(princeStr && princeStr.indexOf('K')>0) {
        ret = Number(princeStr.replace(/K/g, '').replace(',', '.')) * 1000;
    } else {
        ret = NumberHelper.remove1000sSeparator(princeStr);
    }
    return ret;
}