// Market.pure.ts -- parsing and validation of the "Boosters to buy" setting.
//
// Pure: no DOM, no storage, no imports. The impure half lives in Market.ts.
//
// The field replaces the former pair "Filter" (which boosters) and "Max
// Booster" (how many of each) with one list of code:amount pairs, so the two
// halves of one decision cannot contradict each other any more (issue #1844).
//
// Deliberately strict, unlike the two sibling parsers in Booster.ts: this
// field spends kobans, and both of the lenient behaviours available there --
// dropping the bad entries (parseMythicBoosterList) or falling back to a
// built-in default (parseEquipSlotConfig) -- would buy something other than
// what the user wrote. An unreadable list buys nothing instead.

/** Legendary boosters the game offers, in the order the tooltip lists them. */
export const LEGENDARY_BOOSTER_CODES = ["B1", "B2", "B3", "B4"] as const;

/** Mythic boosters, MB1..MB12. MB1 is the Sandalwood perfume. */
export const MYTHIC_BOOSTER_CODES = [
    "MB1", "MB2", "MB3", "MB4", "MB5", "MB6",
    "MB7", "MB8", "MB9", "MB10", "MB11", "MB12",
] as const;

export const BOOSTER_CODES: readonly string[] = [
    ...LEGENDARY_BOOSTER_CODES,
    ...MYTHIC_BOOSTER_CODES,
];

/**
 * The one syntax definition, shared by the menu field and the runtime.
 *
 * Written without anchors because that is what an HTML `pattern` attribute
 * expects; parseBuyList anchors it itself. Both letter cases are accepted
 * because the parser upper-cases before it compares -- a lower-case entry
 * that the parser would happily read must not paint the field red.
 *
 * Whitespace is allowed around the colon and NOT around the semicolon, as
 * specified: "MB1 : 3;MB3 : 4" is valid, "MB1 : 3 ; MB3 : 4" is not.
 *
 * An empty value is valid and means "buy nothing" -- a deliberate state, not
 * an error, so it must not be painted red either.
 */
const CODE = "(?:[Bb][1-4]|[Mm][Bb](?:[1-9]|1[0-2]))";
const AMOUNT = "(?:0|[1-9][0-9]{0,2})";
const PAIR = CODE + "\\s*:\\s*" + AMOUNT;
export const BUY_LIST_PATTERN = "(?:" + PAIR + "(?:;" + PAIR + ")*)?";

/** One booster and the number of it to keep in the inventory. */
export interface BuyListEntry {
    code: string;
    /** 0 means no limit, matching what the old "Max Booster" field did. */
    max: number;
}

export type BuyListResult =
    | { valid: true; entries: BuyListEntry[] }
    | { valid: false; reason: "syntax" | "duplicate"; detail: string };

/**
 * Read the stored value. Returns the entries in the order they were written --
 * the order decides who gets the kobans first while they last.
 *
 * Invalid input is reported, never repaired: the caller is expected to buy
 * nothing at all. A repeated code is invalid too, because "MB1:5;MB1:2" does
 * not say whether five or two was meant, and a regex cannot express that.
 */
export function parseBuyList(raw: string | undefined | null): BuyListResult {
    if (raw === undefined || raw === null || raw.trim() === "") {
        return { valid: true, entries: [] };
    }
    if (!new RegExp("^" + BUY_LIST_PATTERN + "$").test(raw)) {
        return { valid: false, reason: "syntax", detail: raw };
    }
    const entries: BuyListEntry[] = [];
    const seen = new Set<string>();
    for (const part of raw.split(";")) {
        const [rawCode, rawMax] = part.split(":");
        const code = rawCode.trim().toUpperCase();
        if (seen.has(code)) {
            return { valid: false, reason: "duplicate", detail: code };
        }
        seen.add(code);
        entries.push({ code, max: Number(rawMax.trim()) });
    }
    return { valid: true, entries };
}

/**
 * The menu's extra check for this field: "" when it is fine, otherwise the
 * message that turns the input red. The syntax half is already covered by the
 * pattern attribute; only the duplicate needs saying out loud.
 */
export function buyListValidationMessage(raw: string): string {
    const parsed = parseBuyList(raw);
    if (parsed.valid) return "";
    if (parsed.reason === "duplicate") {
        return "Each booster may appear only once -- " + parsed.detail + " is listed twice.";
    }
    return "";
}

/**
 * True when the list names at least one booster and can be read. Used both to
 * decide whether walking to the market for buying is worth it and whether the
 * buying itself may run at all.
 */
export function hasBuyableBoosters(raw: string | undefined | null): boolean {
    const parsed = parseBuyList(raw);
    return parsed.valid && parsed.entries.length > 0;
}

/**
 * Convert the pre-8.10.2 pair of settings into the merged syntax (#1844).
 *
 * Per entry, not wholesale: an entry that already carries a colon is left
 * alone. That keeps the conversion harmless if the old "Max Booster" key ever
 * reappears -- importing an old settings file writes it back, and a wholesale
 * conversion would then overwrite a carefully edited list with itself.
 */
export function migrateBuyList(filter: string | undefined | null, oldMax: string | undefined | null): string {
    if (filter === undefined || filter === null || filter.trim() === "") return "";
    const max = String(oldMax ?? "").trim();
    if (max === "" || !/^[0-9]+$/.test(max)) return filter;
    return filter
        .split(";")
        .map((part) => (part.includes(":") ? part : part.trim() === "" ? part : part.trim() + ":" + max))
        .join(";");
}

/**
 * The same conversion for the user's own saved defaults (#1844).
 *
 * setHHStoredVarToDefault consults that snapshot whenever a key is missing, so
 * a snapshot left in the old shape kept resurrecting the deleted "Max Booster"
 * key -- the migration then ran again on every page load -- and a reset to
 * defaults would have written the old bare-code shape back into a field that
 * now refuses it. Seen in a live 8.11.0 upgrade log.
 *
 * Returns the updated snapshot, or null when there is nothing to do.
 */
export function migrateSavedDefaults(
    defaults: Record<string, string> | null | undefined,
    filterKey: string,
    maxKey: string,
): Record<string, string> | null {
    if (!defaults || defaults[maxKey] === undefined) return null;
    const updated: Record<string, string> = { ...defaults };
    const savedList = updated[filterKey];
    if (savedList !== undefined) {
        updated[filterKey] = migrateBuyList(savedList, updated[maxKey]);
    }
    delete updated[maxKey];
    return updated;
}
