import {
    AlignClubChampionTimerState,
    NextClubChampionTimerState,
    decideAlignedClubChampionTimer,
    decideNextClubChampionTime,
} from "../../src/Module/ClubChampion.pure";

/**
 * Pure-function tests for the club-champion timer decisions.
 *
 * decideNextClubChampionTime returns a deterministic [min, max] window
 * that the impure adapter in updateClubChampionTimer feeds into
 * randomInterval. decideAlignedClubChampionTimer returns the (possibly
 * aligned) seconds value the adapter then hands to setTimer.
 *
 * Threshold contracts preserved from the original code:
 *   secsToNextTimer === -1   -> no-timer window
 *   secsToNextTimer >  7200  AND autoClubForceStart -> force-start window
 *   else                                            -> normal window
 *
 * Alignment branch:
 *   autoChamps AND autoChampAlignTimer
 *     AND proposedTime > 10
 *     AND champTimeLeft < 1200
 *     AND proposedTime < 1200
 *   -> max(proposedTime, champTimeLeft); else proposedTime untouched.
 *
 * All threshold comparisons are strict on purpose; the equality cases
 * below assert that.
 */
describe("decideNextClubChampionTime", () => {
    const buildState = (
        overrides: Partial<NextClubChampionTimerState> = {},
    ): NextClubChampionTimerState => ({
        secsToNextTimer: -1,
        autoClubForceStart: false,
        ...overrides,
    });

    it("returns the no-timer window when no timer was scraped", () => {
        expect(decideNextClubChampionTime(buildState({ secsToNextTimer: -1 }))).toEqual({
            minTime: 15 * 60,
            maxTime: 17 * 60,
            reason: "no-timer",
        });
    });

    it("returns the normal window for short timers regardless of force-start", () => {
        expect(
            decideNextClubChampionTime(
                buildState({ secsToNextTimer: 600, autoClubForceStart: false }),
            ),
        ).toEqual({ minTime: 600, maxTime: 780, reason: "normal" });

        expect(
            decideNextClubChampionTime(
                buildState({ secsToNextTimer: 600, autoClubForceStart: true }),
            ),
        ).toEqual({ minTime: 600, maxTime: 780, reason: "normal" });
    });

    it("treats secsToNextTimer = 7200 as below the force-start threshold (strict >)", () => {
        expect(
            decideNextClubChampionTime(
                buildState({ secsToNextTimer: 7200, autoClubForceStart: true }),
            ),
        ).toEqual({ minTime: 7200, maxTime: 7380, reason: "normal" });
    });

    it("returns the force-start window for secsToNextTimer = 7201 with autoClubForceStart on", () => {
        expect(
            decideNextClubChampionTime(
                buildState({ secsToNextTimer: 7201, autoClubForceStart: true }),
            ),
        ).toEqual({ minTime: 115 * 60, maxTime: 125 * 60, reason: "force-start" });
    });

    it("ignores autoClubForceStart and falls back to the normal window when force-start is off", () => {
        expect(
            decideNextClubChampionTime(
                buildState({ secsToNextTimer: 8000, autoClubForceStart: false }),
            ),
        ).toEqual({ minTime: 8000, maxTime: 8180, reason: "normal" });
    });

    it("returns the normal window for a zero timer (immediate retry slot)", () => {
        expect(
            decideNextClubChampionTime(
                buildState({ secsToNextTimer: 0, autoClubForceStart: false }),
            ),
        ).toEqual({ minTime: 0, maxTime: 180, reason: "normal" });
    });
});

describe("decideAlignedClubChampionTimer", () => {
    const buildState = (
        overrides: Partial<AlignClubChampionTimerState> = {},
    ): AlignClubChampionTimerState => ({
        proposedTime: 0,
        champTimeLeft: 0,
        autoChamps: false,
        autoChampAlignTimer: false,
        ...overrides,
    });

    it("passes the proposed time through when both settings are off", () => {
        expect(
            decideAlignedClubChampionTimer(
                buildState({ proposedTime: 123, champTimeLeft: 456 }),
            ),
        ).toBe(123);
    });

    it("passes through when only autoChamps is on", () => {
        expect(
            decideAlignedClubChampionTimer(
                buildState({
                    proposedTime: 123,
                    champTimeLeft: 456,
                    autoChamps: true,
                    autoChampAlignTimer: false,
                }),
            ),
        ).toBe(123);
    });

    it("passes through when only autoChampAlignTimer is on", () => {
        expect(
            decideAlignedClubChampionTimer(
                buildState({
                    proposedTime: 123,
                    champTimeLeft: 456,
                    autoChamps: false,
                    autoChampAlignTimer: true,
                }),
            ),
        ).toBe(123);
    });

    it("aligns to champTimeLeft when both settings are on and the window matches", () => {
        // proposedTime 123 < 1200, champTimeLeft 456 < 1200, proposedTime > 10
        expect(
            decideAlignedClubChampionTimer(
                buildState({
                    proposedTime: 123,
                    champTimeLeft: 456,
                    autoChamps: true,
                    autoChampAlignTimer: true,
                }),
            ),
        ).toBe(456);
    });

    it("returns proposedTime when it is already greater than champTimeLeft", () => {
        expect(
            decideAlignedClubChampionTimer(
                buildState({
                    proposedTime: 800,
                    champTimeLeft: 200,
                    autoChamps: true,
                    autoChampAlignTimer: true,
                }),
            ),
        ).toBe(800);
    });

    it("does not align when proposedTime equals 10 (strict > on lower bound)", () => {
        expect(
            decideAlignedClubChampionTimer(
                buildState({
                    proposedTime: 10,
                    champTimeLeft: 456,
                    autoChamps: true,
                    autoChampAlignTimer: true,
                }),
            ),
        ).toBe(10);
    });

    it("does not align when proposedTime equals 1200 (strict < on upper bound)", () => {
        expect(
            decideAlignedClubChampionTimer(
                buildState({
                    proposedTime: 1200,
                    champTimeLeft: 456,
                    autoChamps: true,
                    autoChampAlignTimer: true,
                }),
            ),
        ).toBe(1200);
    });

    it("does not align when champTimeLeft equals 1200 (strict < on champ bound)", () => {
        expect(
            decideAlignedClubChampionTimer(
                buildState({
                    proposedTime: 123,
                    champTimeLeft: 1200,
                    autoChamps: true,
                    autoChampAlignTimer: true,
                }),
            ),
        ).toBe(123);
    });

    it("does not align when champTimeLeft is large even with both settings on", () => {
        expect(
            decideAlignedClubChampionTimer(
                buildState({
                    proposedTime: 123,
                    champTimeLeft: 3600,
                    autoChamps: true,
                    autoChampAlignTimer: true,
                }),
            ),
        ).toBe(123);
    });
});