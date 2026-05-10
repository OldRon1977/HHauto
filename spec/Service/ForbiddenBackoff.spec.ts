import {
    nextForbiddenDelaySeconds,
    FORBIDDEN_BASE_SECONDS,
    FORBIDDEN_CAP_SECONDS,
    FORBIDDEN_MIN_DELAY_SECONDS,
    FORBIDDEN_JITTER_RANGE,
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
