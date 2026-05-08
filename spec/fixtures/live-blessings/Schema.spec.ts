import { loadFixture } from "../../testHelpers/Fixtures";
import { BlessingService } from "../../../src/Service/BlessingService";

/**
 * Schema test for the `live_blessings_api` AJAX endpoint
 * (`action=get_girls_blessings`).
 *
 * Captures three temporal snapshots from the dump and feeds each through
 * every BlessingService parser. The test asserts only:
 *   1. the envelope still has the documented shape, and
 *   2. no parser throws when handed the real payload.
 *
 * Stage 4 task 4.1 acceptance criterion: per response type, one parser
 * test that calls the actual parser on a captured payload and asserts
 * it returns without throwing.
 */

interface LiveBlessingEntry {
    title: string;
    description: string;
    remaining_time: number;
    starts_in: number;
}

interface LiveBlessingResponse {
    active: LiveBlessingEntry[];
    upcoming: LiveBlessingEntry[];
    success: boolean;
}

/**
 * Typed view onto the four BlessingService parsers. Two are public
 * statics, two are private; bracket access via this surface keeps the
 * test strongly typed without an `any` escape hatch.
 */
interface BlessingParserSurface {
    parseTraits(response: unknown): string[];
    parseBlessedValues(response: unknown): Record<string, string>;
    parseElement(response: unknown): string | undefined;
    parseBlessingPercent(response: unknown, category: string): number | undefined;
}

const parsers = BlessingService as unknown as BlessingParserSurface;

const FIXTURES = ["page-00", "page-14", "page-29"] as const;
const PARSE_PERCENT_CATEGORIES = ["eyeColor", "hairColor", "position", "zodiac"] as const;

describe("live-blessings AJAX schema", () => {
    describe.each(FIXTURES)("snapshot %s", (name) => {
        const response = loadFixture("live-blessings", name) as LiveBlessingResponse;

        it("carries the documented envelope shape", () => {
            expect(typeof response.success).toBe("boolean");
            expect(Array.isArray(response.active)).toBe(true);
            expect(Array.isArray(response.upcoming)).toBe(true);
            expect(response.active.length).toBe(3);
            expect(response.upcoming.length).toBe(3);
            for (const blessing of [...response.active, ...response.upcoming]) {
                expect(typeof blessing.title).toBe("string");
                expect(typeof blessing.description).toBe("string");
                expect(typeof blessing.remaining_time).toBe("number");
                expect(typeof blessing.starts_in).toBe("number");
            }
        });

        it("does not crash any BlessingService parser", () => {
            const traits = parsers.parseTraits(response);
            expect(Array.isArray(traits)).toBe(true);
            for (const t of traits) {
                expect(typeof t).toBe("string");
            }

            const values = parsers.parseBlessedValues(response);
            expect(values).not.toBeNull();
            expect(typeof values).toBe("object");
            for (const v of Object.values(values)) {
                expect(typeof v).toBe("string");
            }

            const element = parsers.parseElement(response);
            if (element !== undefined) {
                expect(typeof element).toBe("string");
            }

            for (const category of PARSE_PERCENT_CATEGORIES) {
                const pct = parsers.parseBlessingPercent(response, category);
                if (pct !== undefined) {
                    expect(typeof pct).toBe("number");
                    expect(pct).toBeGreaterThan(0);
                }
            }
        });
    });
});
