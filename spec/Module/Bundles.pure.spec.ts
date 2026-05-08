import {
    ExpiryTimeState,
    decideExpiryTime,
} from "../../src/Module/Bundles.pure";

/**
 * Pure-function tests for the bundle expiry-time decision.
 *
 * decideExpiryTime returns the deterministic seconds value the
 * impure adapter then hands to setTimer. The 24-hour boundary is
 * strict (the original code reads `if (freeBundleTimer < 24 * 3600)`)
 * and exactly 24 * 3600 falls through to the fallback branch.
 */
describe("decideExpiryTime", () => {
    const buildState = (
        overrides: Partial<ExpiryTimeState> = {},
    ): ExpiryTimeState => ({
        scrapedSeconds: null,
        fallbackSeconds: 9999,
        ...overrides,
    });

    it("returns the fallback when no DOM timer was scraped", () => {
        expect(
            decideExpiryTime(buildState({ scrapedSeconds: null, fallbackSeconds: 1234 })),
        ).toBe(1234);
    });

    it("returns the scraped value when below the 24h cap", () => {
        expect(
            decideExpiryTime(
                buildState({ scrapedSeconds: 23 * 3600 + 59 * 60, fallbackSeconds: 1234 }),
            ),
        ).toBe(23 * 3600 + 59 * 60);
    });

    it("falls back at exactly 24h (strict < boundary)", () => {
        expect(
            decideExpiryTime(
                buildState({ scrapedSeconds: 24 * 3600, fallbackSeconds: 1234 }),
            ),
        ).toBe(1234);
    });

    it("falls back when the scraped value is well above the 24h cap", () => {
        expect(
            decideExpiryTime(
                buildState({ scrapedSeconds: 7 * 24 * 3600, fallbackSeconds: 1234 }),
            ),
        ).toBe(1234);
    });

    it("returns zero when the scraped timer is exactly zero", () => {
        // Edge: a popup timer that has just expired. 0 < 24*3600, so
        // the scraped value passes through unchanged.
        expect(
            decideExpiryTime(
                buildState({ scrapedSeconds: 0, fallbackSeconds: 1234 }),
            ),
        ).toBe(0);
    });

    it("returns the typical mid-range scraped value untouched", () => {
        expect(
            decideExpiryTime(
                buildState({ scrapedSeconds: 3600, fallbackSeconds: 1234 }),
            ),
        ).toBe(3600);
    });
});