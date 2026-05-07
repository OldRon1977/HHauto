import { decideShouldFight, ShouldFightState } from "../../src/Module/League.pure";

/**
 * Pure-function tests for the league fight decision.
 *
 * These cover the same scenarios as the impure isTimeToFight tests in
 * League.spec.ts, plus a few edge cases the spy-based tests cannot reach
 * cleanly (humanLikeRun on/off, paranoia with zero energy).
 */
describe("decideShouldFight", () => {
    const baseState: ShouldFightState = {
        energy: 1,
        threshold: 5,
        runThreshold: 15,
        humanLikeRun: false,
        timerLeft: 0,
        paranoiaSpending: -1,
        boosterRequired: false,
        boosterEquipped: false,
    };

    const withState = (overrides: Partial<ShouldFightState>): ShouldFightState => ({
        ...baseState,
        ...overrides,
    });

    it("returns true when energy is above the threshold and the timer has expired", () => {
        const state = withState({ energy: 16, timerLeft: 0 });
        expect(decideShouldFight(state)).toBe(true);
    });

    it("returns false when energy is below the threshold", () => {
        const state = withState({ energy: 10, timerLeft: 0 });
        expect(decideShouldFight(state)).toBe(false);
    });

    it("returns false when the next-fight timer is still active", () => {
        const state = withState({ energy: 20, timerLeft: 10 });
        expect(decideShouldFight(state)).toBe(false);
    });

    it("returns true when paranoia spending is positive and energy is below threshold", () => {
        const state = withState({ energy: 10, paranoiaSpending: 1 });
        expect(decideShouldFight(state)).toBe(true);
    });

    it("returns true when paranoia spending is positive and energy is above threshold", () => {
        const state = withState({ energy: 16, paranoiaSpending: 1 });
        expect(decideShouldFight(state)).toBe(true);
    });

    it("ignores paranoia override when energy is zero", () => {
        const state = withState({ energy: 0, paranoiaSpending: 5 });
        expect(decideShouldFight(state)).toBe(false);
    });

    it("returns false when boosters are required but not equipped", () => {
        const state = withState({
            energy: 19,
            boosterRequired: true,
            boosterEquipped: false,
        });
        expect(decideShouldFight(state)).toBe(false);
    });

    it("returns false when boosters are required, energy is above max, but no booster is equipped", () => {
        const state = withState({
            energy: 21,
            boosterRequired: true,
            boosterEquipped: false,
        });
        expect(decideShouldFight(state)).toBe(false);
    });

    it("returns true when boosters are required and equipped", () => {
        const state = withState({
            energy: 16,
            boosterRequired: true,
            boosterEquipped: true,
        });
        expect(decideShouldFight(state)).toBe(true);
    });

    it("respects humanLikeRun: above plain threshold but at or below runThreshold-1 still allows a fight", () => {
        // Without humanLikeRun: energy must exceed max(5, 15-1) = 14, so 10 fails.
        const strict = withState({ energy: 10, humanLikeRun: false });
        expect(decideShouldFight(strict)).toBe(false);

        // With humanLikeRun: energy > threshold (5) is enough.
        const relaxed = withState({ energy: 10, humanLikeRun: true });
        expect(decideShouldFight(relaxed)).toBe(true);
    });

    it("returns false in the last league hour scenario when energy is insufficient", () => {
        // Mirrors the impure test "during the last hour ... if energy is insufficient":
        // threshold and runThreshold pulled up, energy at zero, no paranoia.
        const state = withState({
            energy: 0,
            threshold: 15,
            runThreshold: 20,
            paranoiaSpending: -1,
            timerLeft: 0,
        });
        expect(decideShouldFight(state)).toBe(false);
    });

    it("treats negative timerLeft as expired", () => {
        const state = withState({ energy: 16, timerLeft: -5 });
        expect(decideShouldFight(state)).toBe(true);
    });
});
