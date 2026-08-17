import { loadFixture } from "../../testHelpers/Fixtures";

/**
 * Redaction guards for the champion fixture.
 *
 * The shape assertions this file used to carry checked a checked-in JSON
 * file against its own README -- no production code was involved, and the
 * fixture still has no consumer in src/. What remains is the part that can
 * actually fail: after a re-capture (see the sibling README), player
 * nicknames and asset urls must not come back in.
 */
describe("champion fixtures", () => {
    describe("active-champion", () => {
        it("strips visual asset urls and bubble/scene text from the champion", () => {
            const f = loadFixture("champion", "active-champion") as { champion: Record<string, unknown> };
            const dropped = ["image", "portrait", "endSceneImage", "bubbleText", "endSceneText"];
            for (const k of dropped) {
                expect(f.champion).not.toHaveProperty(k);
            }
        });

        it("redacts every fight participant nickname and drops avatars", () => {
            const f = loadFixture("champion", "active-champion") as {
                fight: {
                    participants: Array<{ id_member: unknown; nickname: unknown; avatar?: unknown }>;
                };
            };
            expect(f.fight.participants.length).toBeGreaterThan(0);
            for (const p of f.fight.participants) {
                expect(typeof p.nickname).toBe("string");
                expect(p.nickname as string).toMatch(/^Player_\d+$/);
                expect(p).not.toHaveProperty("avatar");
            }
        });
    });
});
