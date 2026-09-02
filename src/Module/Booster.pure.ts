// Booster.pure.ts -- syntax of the "Mythic Slot" priority list.
//
// Pure: no DOM, no storage, no imports. The impure half lives in Booster.ts.
//
// The one definition of what may stand in that field, so the menu's pattern
// attribute, the isValid check setDefaults runs against the stored value on
// every page load, and the runtime parser cannot state different rules. They
// did: the field was widened to all twelve codes while isValid kept a cap of
// five, so a longer list was accepted, saved, and then wiped on the next load
// (issue #1865). The same lesson had already been written down for the buy
// list in Market.pure.ts (#1844).
//
// The list is a preference order, not a slot assignment -- "take whichever of
// these I happen to own". Its length and Booster.MYTHIC_SLOT_COUNT are two
// different numbers, so the syntax caps nothing; the walk down the list stops
// when no slot is free.
//
// Used by: config/InputPattern.ts, config/HHStoredVars.ts, Module/Booster.ts
//

/** One mythic booster code, MB1..MB12. MB1 is the Sandalwood perfume. */
const MYTHIC_CODE = "MB(?:[1-9]|1[0-2])";

/**
 * Written without anchors because that is what an HTML `pattern` attribute
 * expects; every other caller anchors it itself.
 *
 * Whitespace around a code is tolerated because the parser trims before it
 * compares -- an entry the parser reads must not paint the field red. An empty
 * value is valid and means "off".
 */
export const MYTHIC_LIST_PATTERN =
    "(?:\\s*" + MYTHIC_CODE + "\\s*(?:;\\s*" + MYTHIC_CODE + "\\s*)*)?";

/** Anchored form, for checking a whole stored value. */
export const MYTHIC_LIST_RE = new RegExp("^" + MYTHIC_LIST_PATTERN + "$");

/** Anchored form of a single code, for checking one entry of a split list. */
export const MYTHIC_CODE_RE = new RegExp("^" + MYTHIC_CODE + "$");
