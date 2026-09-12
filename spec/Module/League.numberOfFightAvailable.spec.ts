import { LeagueHelper } from "../../src/Module/League";
import { HHStoredVarPrefixKey } from "../../src/config/HHStoredVars";
import { SK } from "../../src/config/StorageKeys";
import type { KKLeagueOpponent } from "../../src/model/KK/KKLeagueOpponent";

/**
 * How many fights are left against one league opponent.
 *
 * This is the function `CONTRIBUTING.md` warns about by name: the game renamed the
 * `match_history` column **in the DOM** and kept the key **in the JSON**.
 * Reading the DOM finding into the data makes this return 0, and a 0 here is
 * silent -- no error, no log line, the league simply never fights. League
 * wins are one of the three koban sources the account has.
 *
 * So the fixtures below carry both `match_history` (the record the function
 * must read) and `match_history_sorting` (a number, the one it must not).
 */
const opponent = (history: (unknown | null)[] | undefined, idFighter = 42): KKLeagueOpponent => ({
    match_history: history === undefined ? {} : { [idFighter]: history },
    // The sort value the DOM column carries. A number, never the history.
    match_history_sorting: 3,
    player: { id_fighter: idFighter },
} as unknown as KKLeagueOpponent);

describe("LeagueHelper.numberOfFightAvailable", () => {
    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it("counts the empty slots in this player's own history", () => {
        // Three of five fights fought, two slots still null.
        expect(LeagueHelper.numberOfFightAvailable(
            opponent([{ won: true }, null, { won: false }, null, { won: true }]))).toBe(2);
    });

    it("returns 0 once every slot is filled", () => {
        expect(LeagueHelper.numberOfFightAvailable(
            opponent([{ won: true }, { won: false }, { won: true }]))).toBe(0);
    });

    it("returns the full count against an opponent never fought", () => {
        expect(LeagueHelper.numberOfFightAvailable(opponent([null, null, null]))).toBe(3);
    });

    it("returns 0 when the record holds no entry for this player", () => {
        expect(LeagueHelper.numberOfFightAvailable(opponent(undefined))).toBe(0);
    });

    it("returns 0 for no opponent at all", () => {
        expect(LeagueHelper.numberOfFightAvailable(null as unknown as KKLeagueOpponent)).toBe(0);
        expect(LeagueHelper.numberOfFightAvailable(undefined as unknown as KKLeagueOpponent)).toBe(0);
    });

    it("reads match_history, not the match_history_sorting number beside it", () => {
        // The whole point of that warning: an opponent carries both,
        // and only one of them is a history. Taking the other would throw or
        // yield 0 -- either way the league stops fighting without saying so.
        const withBoth = opponent([null, null]);
        expect((withBoth as unknown as { match_history_sorting: number }).match_history_sorting)
            .toEqual(expect.any(Number));

        expect(LeagueHelper.numberOfFightAvailable(withBoth)).toBe(2);
    });

    it("picks the history of this player, not of another fighter", () => {
        const shared = opponent([null, null], 42);
        (shared.match_history as Record<string, unknown[]>)['999'] = [null, null, null, null];

        expect(LeagueHelper.numberOfFightAvailable(shared)).toBe(2);
    });

    describe("the force-one-fight switch", () => {
        it("answers 1 whatever the history says", () => {
            localStorage.setItem(HHStoredVarPrefixKey + SK.autoLeaguesForceOneFight, 'true');

            expect(LeagueHelper.numberOfFightAvailable(
                opponent([{ won: true }, { won: true }, { won: true }]))).toBe(1);
        });

        it("still answers 0 for no opponent", () => {
            // The opponent guard comes first, and has to: the caller uses the
            // count to decide whether to open a fight page at all.
            localStorage.setItem(HHStoredVarPrefixKey + SK.autoLeaguesForceOneFight, 'true');

            expect(LeagueHelper.numberOfFightAvailable(null as unknown as KKLeagueOpponent)).toBe(0);
        });
    });
});
