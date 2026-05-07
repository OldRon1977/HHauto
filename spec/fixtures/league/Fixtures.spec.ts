import { loadFixture } from "../../testHelpers/Fixtures";

/**
 * Smoke tests for the league fixtures.
 *
 * These confirm that the fixture files load and carry the shape promised
 * by the sibling README. They are not parser tests; once a real opponent
 * or reward parser exists (stage 3 decision-logic coverage), these checks
 * can be retired or merged into the parser test.
 */
describe("league fixtures", () => {
    describe("opponents-mid-tier", () => {
        it("loads as an array of three entries", () => {
            const fixture = loadFixture("league", "opponents-mid-tier") as unknown;
            expect(Array.isArray(fixture)).toBe(true);
            expect((fixture as unknown[]).length).toBe(3);
        });

        it("has numeric id_member, level, power, and place on every entry", () => {
            const opponents = loadFixture("league", "opponents-mid-tier") as Array<{
                id_member: unknown;
                level: unknown;
                power: unknown;
                place: unknown;
            }>;
            for (const o of opponents) {
                expect(typeof o.id_member).toBe("number");
                expect(typeof o.level).toBe("number");
                expect(typeof o.power).toBe("number");
                expect(typeof o.place).toBe("number");
            }
        });

        it("redacts nicknames to the Player_<n> placeholder pattern", () => {
            const opponents = loadFixture("league", "opponents-mid-tier") as Array<{
                nickname: unknown;
                player: { id_fighter: unknown };
            }>;
            for (const o of opponents) {
                expect(typeof o.nickname).toBe("string");
                expect(o.nickname as string).toMatch(/^Player_\d+$/);
                expect(typeof o.player.id_fighter).toBe("number");
            }
        });
    });

    describe("league-rewards-tier3", () => {
        it("loads with the expected rank brackets plus the tier name", () => {
            const tier = loadFixture("league", "league-rewards-tier3") as Record<string, unknown>;
            const expectedBrackets = ["1", "4", "15", "30", "45", "60", "75", "200"];
            for (const b of expectedBrackets) {
                expect(tier).toHaveProperty(b);
            }
            expect(tier).toHaveProperty("name");
        });

        it("carries a numeric rewards_segment in every rank bracket", () => {
            const tier = loadFixture("league", "league-rewards-tier3") as Record<string, unknown>;
            const expectedBrackets = ["1", "4", "15", "30", "45", "60", "75", "200"];
            for (const b of expectedBrackets) {
                const bracket = tier[b] as { rewards_segment: unknown };
                expect(typeof bracket.rewards_segment).toBe("number");
            }
        });
    });
});
