/**
 * Market.pure.spec.ts -- the "Boosters to buy" list, issue #1844.
 *
 * The rules under test, as specified:
 *   - one field, "code:amount" pairs separated by ";"
 *   - 0 means no limit; a booster that is not listed is not bought
 *   - an empty field is valid and means "buy nothing" -- not an error
 *   - whitespace around the colon is allowed, around the semicolon it is not
 *   - a repeated code is invalid, because the wanted amount is then unclear
 *   - invalid input is never repaired: the caller buys nothing
 */
import {
    BOOSTER_CODES,
    BUY_LIST_PATTERN,
    buyListValidationMessage,
    hasBuyableBoosters,
    migrateBuyList,
    parseBuyList,
} from "../../src/Module/Market.pure";

const matchesField = (value: string) => new RegExp("^" + BUY_LIST_PATTERN + "$").test(value);

describe("Boosters to buy -- the codes", () => {
    it("knows the four legendary and the twelve mythic boosters", () => {
        expect(BOOSTER_CODES).toHaveLength(16);
        expect(BOOSTER_CODES).toContain("B1");
        expect(BOOSTER_CODES).toContain("MB12");
    });

    it("accepts MB10, which the old buy filter rejected outright", () => {
        // The previous pattern read MB[1-9]|MB1[1-2] and left a hole at MB10,
        // so the Gem Detector could not be entered at all.
        expect(matchesField("MB10:2")).toBe(true);
        expect(parseBuyList("MB10:2")).toEqual({ valid: true, entries: [{ code: "MB10", max: 2 }] });
    });
});

describe("Boosters to buy -- what the field accepts", () => {
    it.each([
        ["MB1:5;MB2:0;MB5:3", "the specified valid example"],
        ["", "an empty field, meaning buy nothing"],
        ["B1:10", "a single pair"],
        ["MB1 : 3;MB3 : 4", "spaces around the colon"],
        ["mb1:5", "lower case"],
        ["MB1:0", "zero, meaning no limit"],
        ["MB1:999", "the largest amount"],
    ])("accepts %p (%s)", (value) => {
        expect(matchesField(value)).toBe(true);
    });

    it.each([
        ["MB1:5;MB2;MB5:3", "a code without an amount"],
        ["MB1:5;MB2:;MB5:3", "an empty amount"],
        ["MB1:5;MB2:-3;MB5:3", "a negative amount"],
        ["MB1 : 3 ; MB3 : 4", "spaces around the semicolon"],
        ["MB13:5", "a booster the game does not have"],
        ["MB1:1000", "an amount of more than three digits"],
        ["B5:1", "a legendary booster that does not exist"],
        ["MB1:5;", "a trailing semicolon"],
    ])("rejects %p (%s)", (value) => {
        expect(matchesField(value)).toBe(false);
    });
});

describe("Boosters to buy -- parsing", () => {
    it("keeps the written order, because it decides who gets the kobans first", () => {
        const parsed = parseBuyList("MB5:3;B1:10;MB1:5");
        expect(parsed.valid).toBe(true);
        expect(parsed.valid && parsed.entries.map((e) => e.code)).toEqual(["MB5", "B1", "MB1"]);
    });

    it("upper-cases the codes", () => {
        const parsed = parseBuyList("mb1:5");
        expect(parsed.valid && parsed.entries).toEqual([{ code: "MB1", max: 5 }]);
    });

    it("reads 0 as no limit rather than as a refusal", () => {
        const parsed = parseBuyList("MB1:0");
        expect(parsed.valid && parsed.entries).toEqual([{ code: "MB1", max: 0 }]);
    });

    it("treats an empty field as a valid, empty list", () => {
        for (const value of ["", "   ", undefined, null]) {
            expect(parseBuyList(value as string)).toEqual({ valid: true, entries: [] });
        }
    });

    it("rejects a repeated code instead of guessing which amount was meant", () => {
        expect(parseBuyList("MB1:5;MB1:2")).toEqual({ valid: false, reason: "duplicate", detail: "MB1" });
    });

    it("catches a repeat that differs only in case", () => {
        expect(parseBuyList("mb1:5;MB1:2")).toEqual({ valid: false, reason: "duplicate", detail: "MB1" });
    });

    it("reports bad syntax rather than repairing it", () => {
        const parsed = parseBuyList("MB1:5;nonsense");
        expect(parsed).toEqual({ valid: false, reason: "syntax", detail: "MB1:5;nonsense" });
    });
});

describe("Boosters to buy -- the menu's extra check", () => {
    it("stays silent for anything the pattern already covers", () => {
        expect(buyListValidationMessage("MB1:5")).toBe("");
        expect(buyListValidationMessage("")).toBe("");
        // Syntax is the pattern attribute's job; no second red message for it.
        expect(buyListValidationMessage("nonsense")).toBe("");
    });

    it("names the repeated booster, which the pattern cannot see", () => {
        expect(buyListValidationMessage("MB1:5;MB1:2")).toContain("MB1");
    });
});

describe("Boosters to buy -- is there anything to buy", () => {
    it.each([
        ["MB1:5", true],
        ["MB1:0", true],
        ["", false],
        ["MB1:5;MB1:2", false],
        ["nonsense", false],
    ])("%p -> %p", (value, expected) => {
        expect(hasBuyableBoosters(value)).toBe(expected);
    });
});

describe("Boosters to buy -- migration from Filter + Max Booster", () => {
    it("converts the shipped defaults without changing what they did", () => {
        expect(migrateBuyList("B1;B2;B3;B4", "10")).toBe("B1:10;B2:10;B3:10;B4:10");
    });

    it("carries the old 'no limit' over as 0, which still means no limit", () => {
        expect(migrateBuyList("B1;B2", "0")).toBe("B1:0;B2:0");
    });

    it("leaves entries that already carry an amount alone", () => {
        // An old settings file writes the Max Booster key back, so the
        // conversion can meet an already-converted list. It must not rewrite it.
        expect(migrateBuyList("B1:3;B2", "10")).toBe("B1:3;B2:10");
        expect(migrateBuyList("B1:3;B2:7", "10")).toBe("B1:3;B2:7");
    });

    it("produces a value the field accepts", () => {
        expect(matchesField(migrateBuyList("B1;B2;B3;B4", "10"))).toBe(true);
    });

    it("keeps an empty filter empty -- nothing was bought before either", () => {
        expect(migrateBuyList("", "10")).toBe("");
    });

    it("leaves the filter untouched when the old amount is missing or not a number", () => {
        expect(migrateBuyList("B1;B2", "")).toBe("B1;B2");
        expect(migrateBuyList("B1;B2", "abc")).toBe("B1;B2");
    });
});
