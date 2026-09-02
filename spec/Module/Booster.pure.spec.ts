/**
 * Booster.pure.spec.ts -- the "Mythic Slot" priority list, issue #1865.
 *
 * The bug under test: the field accepted up to twelve codes while the
 * isValid check on the stored value still capped at five, so a longer list
 * was saved and then wiped by setDefaults on the next page load. The list is
 * a preference order, not a slot assignment -- its length and the five mythic
 * slots are two different numbers -- so nothing here caps it.
 */
import { HHStoredVars, HHStoredVarPrefixKey } from "../../src/config/HHStoredVars";
import { HHAuto_inputPattern } from "../../src/config/InputPattern";
import { SK } from "../../src/config/StorageKeys";
import { MYTHIC_CODE_RE, MYTHIC_LIST_PATTERN, MYTHIC_LIST_RE } from "../../src/Module/Booster.pure";

const ALL_TWELVE = "MB1;MB2;MB3;MB4;MB5;MB6;MB7;MB8;MB9;MB10;MB11;MB12";
/** What the reporter typed: everything but MB1, which the event owns. */
const REPORTED = "MB2;MB3;MB4;MB5;MB6;MB7;MB8;MB9;MB10;MB11;MB12";

const matchesField = (value: string) =>
    new RegExp("^" + HHAuto_inputPattern.autoEquipMythicBooster + "$").test(value);
const storedIsValid = (value: string) =>
    HHStoredVars[HHStoredVarPrefixKey + SK.autoEquipMythicBooster].isValid.test(value);

describe("Mythic Slot list -- the field and the stored value agree", () => {
    it.each([
        ["", "empty means off"],
        ["MB1", "a single code"],
        ["MB1;MB2;MB5;MB8;MB12", "the five of the tooltip example"],
        [REPORTED, "the eleven of issue #1865"],
        [ALL_TWELVE, "all twelve"],
        [" MB1 ; MB10 ", "whitespace the parser trims away"],
    ])("accepts %s (%s) in both checks", (value) => {
        expect(matchesField(value)).toBe(true);
        expect(storedIsValid(value)).toBe(true);
    });

    it.each([
        ["MB0", "there is no MB0"],
        ["MB13", "there is no MB13"],
        ["B1", "a legendary code belongs in the buy list"],
        ["mb1", "the parser upper-cases, but the field never accepted lower case"],
        ["MB1,MB2", "the separator is a semicolon"],
        ["MB1;", "a trailing separator names no code"],
    ])("rejects %s (%s) in both checks", (value) => {
        expect(matchesField(value)).toBe(false);
        expect(storedIsValid(value)).toBe(false);
    });

    it("is literally the same definition on both sides", () => {
        expect(HHAuto_inputPattern.autoEquipMythicBooster).toBe(MYTHIC_LIST_PATTERN);
        expect(HHStoredVars[HHStoredVarPrefixKey + SK.autoEquipMythicBooster].isValid).toBe(MYTHIC_LIST_RE);
    });

    it("caps nothing, because the list is a priority order and not a slot count", () => {
        const twentyFour = (ALL_TWELVE + ";" + ALL_TWELVE);
        expect(matchesField(twentyFour)).toBe(true);
        expect(storedIsValid(twentyFour)).toBe(true);
    });
});

describe("Mythic Slot list -- a single code", () => {
    it.each(["MB1", "MB9", "MB10", "MB12"])("accepts %s", (code) => {
        expect(MYTHIC_CODE_RE.test(code)).toBe(true);
    });

    it.each(["MB0", "MB13", "MB1;MB2", "B4", ""])("rejects %s", (code) => {
        expect(MYTHIC_CODE_RE.test(code)).toBe(false);
    });
});
