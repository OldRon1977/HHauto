import {
    ShouldFightState,
    decideShouldFight,
} from "../../src/Module/Pantheon.pure";

/**
 * Pure-function tests for the pantheon decisions.
 *
 * decideShouldFight covers the full
 * fight-now boolean cascade with energy/threshold/runThreshold,
 * humanLikeRun, the pantheon timer, paranoia spending, the booster
 * requirement, and the daily-goal override.
 *
 * The level gate that used to live here moved to FeatureGate.pure with the
 * seven other modules that wrote out the same cascade -- its cases are in
 * spec/Service/FeatureGate.pure.spec.ts now (ADR-012).
 *
 * Threshold contract preserved from the original code:
 *   - energy gate is strict (>) on both branches
 *   - runThreshold is consulted as `runThreshold - 1` (off-by-one is
 *     intentional in the original isTimeToFight)
 *   - paranoia override only triggers with energy > 0
 *   - && binds tighter than ||, so the booster branch is parsed as
 *     (needBoosterToFight AND haveBoosterEquipped) OR !needBoosterToFight
 *     OR isDailyGoal
 */
describe("decideShouldFight", () => {
    const buildState = (
        overrides: Partial<ShouldFightState> = {},
    ): ShouldFightState => ({
        energy: 0,
        threshold: 0,
        runThreshold: 0,
        humanLikeRun: false,
        timerExpired: true,
        paranoiaSpending: 0,
        needBoosterToFight: false,
        haveBoosterEquipped: false,
        isDailyGoal: false,
        ...overrides,
    });

    it("returns false on the default state (timer ready but no energy)", () => {
        expect(decideShouldFight(buildState())).toBe(false);
    });

    it("returns false when the timer has not expired even if energy is plentiful", () => {
        expect(
            decideShouldFight(
                buildState({ timerExpired: false, energy: 100, threshold: 0 }),
            ),
        ).toBe(false);
    });

    it("returns true when energy exceeds threshold and runThreshold is zero", () => {
        expect(
            decideShouldFight(
                buildState({ energy: 1, threshold: 0, runThreshold: 0 }),
            ),
        ).toBe(true);
    });

    it("returns false when energy equals threshold (strict >)", () => {
        expect(
            decideShouldFight(
                buildState({ energy: 5, threshold: 5, runThreshold: 0 }),
            ),
        ).toBe(false);
    });

    it("humanLikeRun lets a single-energy spend bypass a high runThreshold", () => {
        expect(
            decideShouldFight(
                buildState({
                    energy: 1,
                    threshold: 0,
                    runThreshold: 50,
                    humanLikeRun: true,
                }),
            ),
        ).toBe(true);
    });

    it("without humanLikeRun, runThreshold-1 acts as the upper energy gate", () => {
        // energy = runThreshold - 1 still fails the strict > check
        expect(
            decideShouldFight(
                buildState({
                    energy: 49,
                    threshold: 0,
                    runThreshold: 50,
                    humanLikeRun: false,
                }),
            ),
        ).toBe(false);

        // energy = runThreshold passes
        expect(
            decideShouldFight(
                buildState({
                    energy: 50,
                    threshold: 0,
                    runThreshold: 50,
                    humanLikeRun: false,
                }),
            ),
        ).toBe(true);
    });

    it("needBoosterToFight without an equipped booster blocks the fight", () => {
        expect(
            decideShouldFight(
                buildState({
                    energy: 10,
                    threshold: 0,
                    needBoosterToFight: true,
                    haveBoosterEquipped: false,
                }),
            ),
        ).toBe(false);
    });

    it("isDailyGoal overrides the missing booster", () => {
        expect(
            decideShouldFight(
                buildState({
                    energy: 10,
                    threshold: 0,
                    needBoosterToFight: true,
                    haveBoosterEquipped: false,
                    isDailyGoal: true,
                }),
            ),
        ).toBe(true);
    });

    it("needBoosterToFight with an equipped booster passes", () => {
        expect(
            decideShouldFight(
                buildState({
                    energy: 10,
                    threshold: 0,
                    needBoosterToFight: true,
                    haveBoosterEquipped: true,
                }),
            ),
        ).toBe(true);
    });

    it("paranoia override fires even when timer has not expired", () => {
        expect(
            decideShouldFight(
                buildState({
                    energy: 1,
                    threshold: 100,
                    runThreshold: 100,
                    timerExpired: false,
                    paranoiaSpending: 1,
                }),
            ),
        ).toBe(true);
    });

    it("paranoia override requires energy > 0", () => {
        expect(
            decideShouldFight(
                buildState({
                    energy: 0,
                    paranoiaSpending: 5,
                    timerExpired: false,
                }),
            ),
        ).toBe(false);
    });

    it("paranoia override requires paranoiaSpending > 0", () => {
        expect(
            decideShouldFight(
                buildState({
                    energy: 5,
                    threshold: 100,
                    runThreshold: 100,
                    timerExpired: false,
                    paranoiaSpending: 0,
                }),
            ),
        ).toBe(false);
    });
});