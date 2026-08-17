import { loadFixture } from "../../testHelpers/Fixtures";

/**
 * Redaction guard for the event-detection fixture.
 *
 * The shape assertions this file used to carry checked a checked-in JSON
 * file against its own README. What remains is the part that can actually
 * fail: after a re-capture (see the sibling README), asset urls and
 * decoration metadata must not come back in.
 */
describe("event fixtures", () => {
    describe("event-detection", () => {
        it("strips asset urls and decoration metadata from the event girl", () => {
            const f = loadFixture("event", "event-detection") as {
                event_data: { girls: Array<Record<string, unknown>> };
            };
            expect(f.event_data.girls.length).toBeGreaterThan(0);
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
            for (const g of f.event_data.girls) {
                for (const k of dropped) {
                    expect(g).not.toHaveProperty(k);
                }
            }
        });
    });
});
