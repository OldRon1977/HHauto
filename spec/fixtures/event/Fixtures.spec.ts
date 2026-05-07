import { loadFixture } from "../../testHelpers/Fixtures";

/**
 * Smoke tests for the event-detection fixture.
 *
 * Confirms that event-detection.json loads and carries the shape
 * promised by the sibling README. Not a parser test; once an event
 * detection module starts consuming the fixture (stage 3), these
 * checks can be merged into the parser test.
 */
describe("event fixtures", () => {
    describe("event-detection", () => {
        it("loads as a compound object with event_data and mega_event", () => {
            const fixture = loadFixture("event", "event-detection") as Record<string, unknown>;
            expect(typeof fixture).toBe("object");
            expect(fixture).toHaveProperty("event_data");
            expect(fixture).toHaveProperty("mega_event");
        });

        it("event_data carries identity, timers, and the participation gate", () => {
            const f = loadFixture("event", "event-detection") as {
                event_data: {
                    event_name: unknown;
                    type: unknown;
                    identifier: unknown;
                    seconds_until_event_end: unknown;
                    event_duration_seconds: unknown;
                    can_participate: unknown;
                    participation_info: unknown;
                    progression_href: unknown;
                };
            };
            expect(typeof f.event_data.event_name).toBe("string");
            expect(typeof f.event_data.type).toBe("string");
            expect(typeof f.event_data.identifier).toBe("string");
            expect(typeof f.event_data.seconds_until_event_end).toBe("number");
            expect(typeof f.event_data.event_duration_seconds).toBe("number");
            expect(typeof f.event_data.can_participate).toBe("boolean");
            expect(typeof f.event_data.participation_info).toBe("string");
            expect(typeof f.event_data.progression_href).toBe("string");
        });

        it("event_data.girls is substituted in (not the circular marker) and uses the whitelist", () => {
            const f = loadFixture("event", "event-detection") as {
                event_data: { girls: unknown };
            };
            expect(Array.isArray(f.event_data.girls)).toBe(true);
            const girls = f.event_data.girls as Array<Record<string, unknown>>;
            expect(girls.length).toBeGreaterThan(0);
            for (const g of girls) {
                expect(typeof g.id_girl).toBe("number");
                expect(typeof g.rarity).toBe("string");
                expect(typeof g.nb_grades).toBe("number");
                expect(g).toHaveProperty("source");
                expect(g).toHaveProperty("source_list");
            }
        });

        it("strips asset urls and decoration metadata from the event girl", () => {
            const f = loadFixture("event", "event-detection") as {
                event_data: { girls: Array<Record<string, unknown>> };
            };
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

        it("mega_event carries the active flag and the time-remaining counter", () => {
            const f = loadFixture("event", "event-detection") as {
                mega_event: { active: unknown; time_remaining: unknown };
            };
            expect(typeof f.mega_event.active).toBe("boolean");
            expect(typeof f.mega_event.time_remaining).toBe("number");
        });
    });
});
