// League.pure.ts -- Pure decision logic for league automation.
//
// Extracted from LeagueHelper.isTimeToFight to enable direct unit tests
// without spying on static methods. No globals, no storage, no jQuery,
// no DOM. Input = data, output = decision.
//
// The impure adapter LeagueHelper.isTimeToFight reads globals and storage,
// builds a ShouldFightState, and delegates here.

export type ShouldFightState = {
    energy: number;
    threshold: number;
    runThreshold: number;
    humanLikeRun: boolean;
    timerLeft: number;
    paranoiaSpending: number;
    boosterRequired: boolean;
    boosterEquipped: boolean;
};

/**
 * Decide whether the league module should fight right now.
 *
 * Mirrors the original logic of LeagueHelper.isTimeToFight bit by bit:
 *   - timerExpired:        timerLeft <= 0 (checkTimer returns true once it has
 *                          run out)
 *   - energyAboveThreshold: humanLikeRun loosens the upper bound, otherwise
 *                          energy must exceed max(threshold, runThreshold - 1)
 *   - paranoiaOverride:    spend any positive amount of paranoia energy as
 *                          long as energy > 0
 *   - boosterCheck:        either boosters are not required, or they are
 *                          required AND equipped
 *
 * Returns true if (timer expired AND energy ok AND booster ok) OR paranoia
 * spending is active.
 */
export function decideShouldFight(state: ShouldFightState): boolean {
    const {
        energy,
        threshold,
        runThreshold,
        humanLikeRun,
        timerLeft,
        paranoiaSpending,
        boosterRequired,
        boosterEquipped,
    } = state;

    const timerExpired = timerLeft <= 0;
    const energyAboveThreshold =
        (humanLikeRun && energy > threshold) ||
        energy > Math.max(threshold, runThreshold - 1);
    const paranoiaOverride = energy > 0 && paranoiaSpending > 0;
    const boosterCheck = (boosterRequired && boosterEquipped) || !boosterRequired;

    return (
        (timerExpired && energyAboveThreshold && boosterCheck) || paranoiaOverride
    );
}
