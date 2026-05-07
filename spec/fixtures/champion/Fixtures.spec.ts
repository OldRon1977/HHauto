import { loadFixture } from "../../testHelpers/Fixtures";

/**
 * Smoke tests for the champion fixture.
 *
 * Confirms that active-champion.json loads and carries the shape
 * promised by the sibling README. Not a parser test; once a champion
 * decision module starts consuming the fixture (stage 3), these
 * checks can be merged into the parser test.
 */
describe("champion fixtures", () => {
    describe("active-champion", () => {
        it("loads as an object with the expected top-level keys", () => {
            const fixture = loadFixture("champion", "active-champion") as Record<string, unknown>;
            expect(typeof fixture).toBe("object");
            const expectedKeys = [
                "champion",
                "timers",
                "team",
                "canDraft",
                "freeDrafts",
                "priceEnergy",
                "hero_damage",
                "reward",
                "fight",
            ];
            for (const k of expectedKeys) {
                expect(fixture).toHaveProperty(k);
            }
        });

        it("has a champion sub-object with numeric ids and tier and a girl whitelist", () => {
            const f = loadFixture("champion", "active-champion") as {
                champion: {
                    id: unknown;
                    tier: unknown;
                    level: unknown;
                    bar: { current: unknown; max: unknown };
                    girl: { id_girl: unknown; rarity: unknown; nb_grades: unknown };
                };
            };
            expect(typeof f.champion.id).toBe("number");
            expect(typeof f.champion.tier).toBe("number");
            expect(typeof f.champion.level).toBe("number");
            expect(typeof f.champion.bar.current).toBe("number");
            expect(typeof f.champion.bar.max).toBe("number");
            expect(typeof f.champion.girl.id_girl).toBe("number");
            expect(typeof f.champion.girl.rarity).toBe("string");
            expect(typeof f.champion.girl.nb_grades).toBe("number");
        });

        it("strips visual asset urls and bubble/scene text from the champion", () => {
            const f = loadFixture("champion", "active-champion") as { champion: Record<string, unknown> };
            const dropped = ["image", "portrait", "endSceneImage", "bubbleText", "endSceneText"];
            for (const k of dropped) {
                expect(f.champion).not.toHaveProperty(k);
            }
        });

        it("carries timers with the three expected fields", () => {
            const f = loadFixture("champion", "active-champion") as {
                timers: { championFight: unknown; teamRest: unknown; championRest: unknown };
            };
            expect(typeof f.timers.championFight).toBe("number");
            // teamRest and championRest can legitimately be null (no rest active)
            expect(["object", "number"]).toContain(typeof f.timers.teamRest);
            expect(["object", "number"]).toContain(typeof f.timers.championRest);
        });

        it("has a 10-entry team substituted in (not the circular marker)", () => {
            const f = loadFixture("champion", "active-champion") as { team: unknown };
            expect(Array.isArray(f.team)).toBe(true);
            const team = f.team as Array<{ id_girl: unknown; rarity: unknown; damage: unknown; ico?: unknown }>;
            expect(team.length).toBe(10);
            for (const m of team) {
                expect(["string", "number"]).toContain(typeof m.id_girl);
                expect(typeof m.rarity).toBe("string");
                expect(typeof m.damage).toBe("number");
                expect(m).not.toHaveProperty("ico");
            }
        });

        it("redacts every fight participant nickname and drops avatars", () => {
            const f = loadFixture("champion", "active-champion") as {
                fight: {
                    id_fight: unknown;
                    participants: Array<{ id_member: unknown; nickname: unknown; avatar?: unknown }>;
                };
            };
            expect(typeof f.fight.id_fight).toBe("number");
            expect(f.fight.participants.length).toBeGreaterThan(0);
            for (const p of f.fight.participants) {
                expect(typeof p.id_member).toBe("number");
                expect(typeof p.nickname).toBe("string");
                expect(p.nickname as string).toMatch(/^Player_\d+$/);
                expect(p).not.toHaveProperty("avatar");
            }
        });

        it("preserves reward structure with item asset urls stripped", () => {
            const f = loadFixture("champion", "active-champion") as {
                reward: {
                    loot: unknown;
                    rewards: Array<{ type: unknown; value: { item?: Record<string, unknown> } }>;
                };
            };
            expect(typeof f.reward.loot).toBe("boolean");
            expect(f.reward.rewards.length).toBeGreaterThan(0);
            for (const r of f.reward.rewards) {
                expect(typeof r.type).toBe("string");
                if (r.value && r.value.item) {
                    expect(r.value.item).not.toHaveProperty("ico");
                }
            }
        });
    });
});
