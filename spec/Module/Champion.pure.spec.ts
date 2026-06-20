import {
    ChampionTimerEntry,
    decideNextChampionTime,
    isEventGirlAvailableOnLockedStage,
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


/**
 * Availability gate for the event-girl timer=0 force in getChampionListFromMap.
 *
 * Regression guard for issue #1771: forcing timer=0 for a champion that merely
 * appears in the event-girl snapshot -- without checking the girl is still on
 * the first locked stage -- made the timer scan flag a phantom-ready champion.
 * doChampionStuff then refused the fight and nextChampionTime was re-armed
 * every tick, producing an endless home<->champions-map navigation loop.
 */
describe("isEventGirlAvailableOnLockedStage", () => {
    it("returns false when the parsed locked stage is null", () => {
        expect(isEventGirlAvailableOnLockedStage(null, [911527332])).toBe(false);
    });

    it("returns false when the stage has no girl_shards", () => {
        expect(isEventGirlAvailableOnLockedStage({ stage: {} }, [911527332])).toBe(false);
        expect(isEventGirlAvailableOnLockedStage({ stage: { girl_shards: [] } }, [911527332])).toBe(false);
    });

    it("returns false when none of the shard girls match the targets (issue #1771 loop case)", () => {
        const parsed = { stage: { girl_shards: [{ id_girl: 123 }, { id_girl: 456 }] } };
        expect(isEventGirlAvailableOnLockedStage(parsed, [911527332])).toBe(false);
    });

    it("returns true when a shard girl matches a target id", () => {
        const parsed = { stage: { girl_shards: [{ id_girl: 123 }, { id_girl: 911527332 }] } };
        expect(isEventGirlAvailableOnLockedStage(parsed, [911527332])).toBe(true);
    });

    it("returns false when there are no target girl ids", () => {
        const parsed = { stage: { girl_shards: [{ id_girl: 911527332 }] } };
        expect(isEventGirlAvailableOnLockedStage(parsed, [])).toBe(false);
    });
});
