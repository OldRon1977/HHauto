import {
    nextForbiddenDelaySeconds,
    nextStreakCount,
    FORBIDDEN_BASE_SECONDS,
    FORBIDDEN_CAP_SECONDS,
    FORBIDDEN_MIN_DELAY_SECONDS,
    FORBIDDEN_JITTER_RANGE,
    FORBIDDEN_STREAK_WINDOW_MS,
    FORBIDDEN_COUNT_KEY,
    FORBIDDEN_LAST_AT_KEY,
    recordForbidden,
} from "../../src/Service/ForbiddenBackoff";

describe("nextForbiddenDelaySeconds", () => {
    // Pin random() so the jitter is deterministic per case.
    const fixedRandom = (value: number) => () => value;
    const noJitter = fixedRandom(0.5); // -> jitter factor 1.0
    const minJitter = fixedRandom(0.0); // -> 1 - range/2
    const maxJitter = fixedRandom(0.999999); // -> ~1 + range/2

    it("doubles the window per consecutive Forbidden, no jitter", () => {
        // count=1 -> base, count=2 -> 2*base, count=3 -> 4*base
        expect(nextForbiddenDelaySeconds(1, noJitter)).toBe(FORBIDDEN_BASE_SECONDS);
        expect(nextForbiddenDelaySeconds(2, noJitter)).toBe(FORBIDDEN_BASE_SECONDS * 2);
        expect(nextForbiddenDelaySeconds(3, noJitter)).toBe(FORBIDDEN_BASE_SECONDS * 4);
        expect(nextForbiddenDelaySeconds(4, noJitter)).toBe(FORBIDDEN_BASE_SECONDS * 8);
    });

    it("caps the delay at FORBIDDEN_CAP_SECONDS", () => {
        // 60 * 2^9 = 30720 > 1800. Even the highest jitter must stay at the cap.
        const big = nextForbiddenDelaySeconds(20, maxJitter);
        const expectedMax = Math.round(FORBIDDEN_CAP_SECONDS * (1 + FORBIDDEN_JITTER_RANGE / 2));
        expect(big).toBeLessThanOrEqual(expectedMax);
        expect(big).toBeGreaterThanOrEqual(FORBIDDEN_CAP_SECONDS * (1 - FORBIDDEN_JITTER_RANGE / 2));
    });

    it("never returns less than FORBIDDEN_MIN_DELAY_SECONDS", () => {
        // Even with low jitter and count=1, we should not drop below the floor.
        const v = nextForbiddenDelaySeconds(1, minJitter);
        expect(v).toBeGreaterThanOrEqual(FORBIDDEN_MIN_DELAY_SECONDS);
    });

    it("treats invalid counts as count=1", () => {
        expect(nextForbiddenDelaySeconds(0, noJitter)).toBe(FORBIDDEN_BASE_SECONDS);
        expect(nextForbiddenDelaySeconds(-5, noJitter)).toBe(FORBIDDEN_BASE_SECONDS);
        expect(nextForbiddenDelaySeconds(1.7, noJitter)).toBe(FORBIDDEN_BASE_SECONDS);
    });

    it("applies jitter symmetrically around the target", () => {
        const lo = nextForbiddenDelaySeconds(1, minJitter);
        const hi = nextForbiddenDelaySeconds(1, maxJitter);
        // Min jitter = 0.8 -> 60*0.8 = 48s, max = 1.2 -> 72s
        const expectedLo = Math.round(FORBIDDEN_BASE_SECONDS * (1 - FORBIDDEN_JITTER_RANGE / 2));
        const expectedHi = Math.round(FORBIDDEN_BASE_SECONDS * (1 + FORBIDDEN_JITTER_RANGE / 2));
        expect(lo).toBe(expectedLo);
        expect(hi).toBe(expectedHi);
    });

    it("default random produces values within the expected band", () => {
        // Sanity check on the live RNG path: 100 samples for count=2 must all
        // fall within [base*2*0.8, base*2*1.2].
        const target = FORBIDDEN_BASE_SECONDS * 2;
        const lo = Math.round(target * (1 - FORBIDDEN_JITTER_RANGE / 2));
        const hi = Math.round(target * (1 + FORBIDDEN_JITTER_RANGE / 2));
        for (let i = 0; i < 100; i++) {
            const v = nextForbiddenDelaySeconds(2);
            expect(v).toBeGreaterThanOrEqual(lo);
            expect(v).toBeLessThanOrEqual(hi);
        }
    });
});

describe("nextStreakCount", () => {
    it("returns 1 when there is no previous Forbidden", () => {
        expect(nextStreakCount(0, 0, 1_000_000)).toBe(1);
    });

    it("returns 1 when the previous count is invalid", () => {
        expect(nextStreakCount(-3, 1_000_000, 1_000_000)).toBe(1);
    });

    it("increments the count when previous Forbidden is recent", () => {
        const now = 10_000_000;
        const recent = now - 30_000; // 30s ago, well inside the window
        expect(nextStreakCount(1, recent, now)).toBe(2);
        expect(nextStreakCount(4, recent, now)).toBe(5);
    });

    it("resets to 1 when previous Forbidden is older than the streak window", () => {
        const now = 10_000_000;
        const old = now - FORBIDDEN_STREAK_WINDOW_MS - 1;
        expect(nextStreakCount(7, old, now)).toBe(1);
    });

    it("treats the streak as alive at exactly the window boundary", () => {
        const now = 10_000_000;
        const atBoundary = now - FORBIDDEN_STREAK_WINDOW_MS;
        // <= window means streak continues
        expect(nextStreakCount(2, atBoundary, now)).toBe(3);
    });
});

// The two counters were invisible in the debug export: extractHHVars walks
// HHStoredVars, so a key that is not registered there is never dumped, whatever
// prefix it carries. They are registered now, and the timestamp lives in
// localStorage so "when did this last happen" survives a tab restart.
describe('Forbidden counters are exportable', () => {
    it('records the streak and the timestamp in separate storages', () => {
        const session = new Map<string, string>();
        const local = new Map<string, string>();
        const wrap = (m: Map<string, string>) => ({
            getItem: (k: string) => m.get(k) ?? null,
            setItem: (k: string, v: string) => { m.set(k, v); },
        });

        const count = recordForbidden(wrap(session), () => 1_000_000, wrap(local));

        expect(count).toBe(1);
        expect(session.get(FORBIDDEN_COUNT_KEY)).toBe('1');
        expect(local.get(FORBIDDEN_LAST_AT_KEY)).toBe('1000000');
        expect(session.has(FORBIDDEN_LAST_AT_KEY)).toBe(false);
    });

    it('starts a fresh streak when the count is gone but the timestamp is not', () => {
        // Exactly what a tab restart looks like now: sessionStorage empty,
        // localStorage still holding the old timestamp. Must not resume a
        // streak, or the first Forbidden after a restart would wait far too
        // long.
        const session = new Map<string, string>();
        const local = new Map<string, string>([[FORBIDDEN_LAST_AT_KEY, '999000']]);
        const wrap = (m: Map<string, string>) => ({
            getItem: (k: string) => m.get(k) ?? null,
            setItem: (k: string, v: string) => { m.set(k, v); },
        });

        expect(recordForbidden(wrap(session), () => 1_000_000, wrap(local))).toBe(1);
    });
});
