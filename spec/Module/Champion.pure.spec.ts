import {
    ChampionTimerEntry,
    decideNextChampionTime,
} from "../../src/Module/Champion.pure";

/**
 * Pure-function tests for the champion timer scan.
 *
 * The scan returns a deterministic (minTime, minTimeEnded) tuple. The
 * impure adapter in Champion.findNextChamptionTime feeds that tuple into
 * randomInterval and the timer helper -- those layers stay impure on
 * purpose, so this spec stops at the deterministic boundary.
 *
 * Naming oddity preserved from the original code: minTime holds the
 * LARGEST entry below 1800s, not the smallest. minTimeEnded holds the
 * largest known positive timer overall. The pure function is bit-for-bit
 * compatible with the original loop, including this contract.
 */
describe("decideNextChampionTime", () => {
    const entry = (overrides: Partial<ChampionTimerEntry>): ChampionTimerEntry => ({
        inFilter: true,
        timer: -1,
        started: false,
        ...overrides,
    });

    it("returns the empty result when no champions are eligible", () => {
        expect(decideNextChampionTime([], false)).toEqual({
            minTime: -1,
            minTimeEnded: -1,
        });
    });

    it("ignores entries that are not in the filter", () => {
        const champions = [
            entry({ inFilter: false, timer: 0 }),
            entry({ inFilter: false, timer: 600 }),
            entry({ inFilter: false, timer: -1 }),
        ];
        expect(decideNextChampionTime(champions, true)).toEqual({
            minTime: -1,
            minTimeEnded: -1,
        });
    });

    it("short-circuits to ready when any entry has timer 0", () => {
        const champions = [
            entry({ timer: 600 }),
            entry({ timer: 0 }),
            entry({ timer: 1500 }),
        ];
        expect(decideNextChampionTime(champions, false)).toEqual({
            minTime: 0,
            minTimeEnded: -1,
        });
    });

    it("returns minTime = -1 and minTimeEnded = max timer when every entry is above 1800s", () => {
        const champions = [
            entry({ timer: 1800 }),
            entry({ timer: 2400 }),
            entry({ timer: 5400 }),
        ];
        expect(decideNextChampionTime(champions, false)).toEqual({
            minTime: -1,
            minTimeEnded: 5400,
        });
    });

    it("captures the largest timer below 1800s as minTime", () => {
        // Original wording: largest, not smallest, despite the name.
        const champions = [
            entry({ timer: 300 }),
            entry({ timer: 1500 }),
            entry({ timer: 900 }),
        ];
        expect(decideNextChampionTime(champions, false)).toEqual({
            minTime: 1500,
            minTimeEnded: 1500,
        });
    });

    it("keeps minTimeEnded as the largest positive timer even when one is below 1800s", () => {
        const champions = [
            entry({ timer: 1500 }),
            entry({ timer: 3600 }),
        ];
        expect(decideNextChampionTime(champions, false)).toEqual({
            minTime: 1500,
            minTimeEnded: 3600,
        });
    });

    it("ignores negative timers when force-start is off", () => {
        const champions = [
            entry({ timer: -1, started: false }),
            entry({ timer: 1200, started: true }),
        ];
        expect(decideNextChampionTime(champions, false)).toEqual({
            minTime: 1200,
            minTimeEnded: 1200,
        });
    });

    it("force-starts an unstarted entry when autoChampsForceStart is on", () => {
        const champions = [
            entry({ timer: 1500, started: true }),
            entry({ timer: -1, started: false }),
        ];
        expect(decideNextChampionTime(champions, true)).toEqual({
            minTime: 0,
            minTimeEnded: -1,
        });
    });

    it("does not force-start an already-started but expired entry", () => {
        const champions = [
            entry({ timer: -1, started: true }),
            entry({ timer: 600, started: true }),
        ];
        expect(decideNextChampionTime(champions, true)).toEqual({
            minTime: 600,
            minTimeEnded: 600,
        });
    });

    it("ready short-circuit beats both force-start and large timers later in the list", () => {
        const champions = [
            entry({ timer: 0 }),
            entry({ timer: -1, started: false }),
            entry({ timer: 1200, started: true }),
        ];
        expect(decideNextChampionTime(champions, true)).toEqual({
            minTime: 0,
            minTimeEnded: -1,
        });
    });
});
