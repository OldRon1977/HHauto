import { loadFixture } from "../../testHelpers/Fixtures";

/**
 * Redaction guard for the league fixtures.
 *
 * The shape assertions this file used to carry checked checked-in JSON
 * files against their own README -- no production code was involved, and
 * neither fixture has a consumer in src/. What remains is the part that
 * can actually fail: after a re-capture (see the sibling README), real
 * player nicknames must not come back in.
 */
describe("league fixtures", () => {
    describe("opponents-mid-tier", () => {
        it("redacts nicknames to the Player_<n> placeholder pattern", () => {
            const opponents = loadFixture("league", "opponents-mid-tier") as Array<{
                nickname: unknown;
            }>;
            expect(opponents.length).toBeGreaterThan(0);
            for (const o of opponents) {
                expect(typeof o.nickname).toBe("string");
                expect(o.nickname as string).toMatch(/^Player_\d+$/);
            }
        });
    });
});
