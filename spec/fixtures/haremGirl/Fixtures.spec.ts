import { loadFixture } from "../../testHelpers/Fixtures";

/**
 * Smoke tests for the haremGirl fixture.
 *
 * Confirms that the fixture file loads and carries the shape promised
 * by the sibling README. These are not parser tests; once
 * parseGirlsFromGameData (deferred from stage 1 task 1.3) lands in
 * stage 3, these checks can be retired or merged into the parser test.
 */
describe("haremGirl fixtures", () => {
    describe("sample-girls", () => {
        it("loads as an array of three entries", () => {
            const fixture = loadFixture("haremGirl", "sample-girls") as unknown;
            expect(Array.isArray(fixture)).toBe(true);
            expect((fixture as unknown[]).length).toBe(3);
        });

        it("covers the rarity slots required by the plan", () => {
            const girls = loadFixture("haremGirl", "sample-girls") as Array<{
                rarity: unknown;
                nb_grades: unknown;
            }>;
            const summaries = girls.map((g) => ({
                rarity: g.rarity,
                nb_grades: g.nb_grades,
            }));
            expect(summaries).toEqual(
                expect.arrayContaining([
                    { rarity: "mythic", nb_grades: 6 },
                    { rarity: "legendary", nb_grades: 5 },
                    { rarity: "common", nb_grades: 5 },
                ]),
            );
        });

        it("has numeric core ids and progress fields on every entry", () => {
            const girls = loadFixture("haremGirl", "sample-girls") as Array<{
                id_girl: unknown;
                id_girl_ref: unknown;
                level: unknown;
                xp: unknown;
                shards: unknown;
                caracs_sum: unknown;
            }>;
            for (const g of girls) {
                expect(typeof g.id_girl).toBe("number");
                expect(typeof g.id_girl_ref).toBe("number");
                expect(typeof g.level).toBe("number");
                expect(typeof g.xp).toBe("number");
                expect(typeof g.shards).toBe("number");
                expect(typeof g.caracs_sum).toBe("number");
            }
        });

        it("carries a caracs object with the three primary stats", () => {
            const girls = loadFixture("haremGirl", "sample-girls") as Array<{
                carac1: unknown;
                carac2: unknown;
                carac3: unknown;
                caracs: Record<string, unknown>;
            }>;
            for (const g of girls) {
                expect(typeof g.carac1).toBe("number");
                expect(typeof g.carac2).toBe("number");
                expect(typeof g.carac3).toBe("number");
                expect(typeof g.caracs).toBe("object");
                expect(g.caracs).not.toBeNull();
            }
        });

        it("carries the salary fields needed by future parser tests", () => {
            const girls = loadFixture("haremGirl", "sample-girls") as Array<{
                salary: unknown;
                salary_per_hour: unknown;
                pay_time: unknown;
            }>;
            for (const g of girls) {
                expect(typeof g.salary).toBe("number");
                expect(typeof g.salary_per_hour).toBe("number");
                expect(typeof g.pay_time).toBe("number");
            }
        });

        it("strips asset urls and metadata that the whitelist drops", () => {
            const girls = loadFixture("haremGirl", "sample-girls") as Array<Record<string, unknown>>;
            const dropped = [
                "avatar",
                "default_avatar",
                "black_avatar",
                "ico",
                "preview",
                "images",
                "scene_paths",
                "release_date",
                "date_added",
            ];
            for (const g of girls) {
                for (const f of dropped) {
                    expect(g).not.toHaveProperty(f);
                }
            }
        });
    });
});
