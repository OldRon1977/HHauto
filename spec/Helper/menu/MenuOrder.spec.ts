// Unit tests for the pure settings-area order resolution (#1834).
//
// The cases that matter are the ones a user hits after an update: an area was
// added, an area was removed, or the stored value is garbage. All three have to
// leave a usable menu behind.
import { isDefaultMenuOrder, resolveMenuOrder } from "../../../src/Helper/menu/MenuOrder";

const DEFAULTS = ["global", "display", "daily", "adventure", "season", "harem"];

describe("resolveMenuOrder", () => {
    it("returns the default order when nothing is stored", () => {
        expect(resolveMenuOrder(null, DEFAULTS)).toEqual(DEFAULTS);
        expect(resolveMenuOrder(undefined, DEFAULTS)).toEqual(DEFAULTS);
    });

    it("returns the default order for unusable values", () => {
        expect(resolveMenuOrder("global,display", DEFAULTS)).toEqual(DEFAULTS);
        expect(resolveMenuOrder({}, DEFAULTS)).toEqual(DEFAULTS);
        expect(resolveMenuOrder([], DEFAULTS)).toEqual(DEFAULTS);
        expect(resolveMenuOrder([1, 2, 3], DEFAULTS)).toEqual(DEFAULTS);
    });

    it("keeps a complete stored order as it is", () => {
        const stored = ["harem", "season", "adventure", "daily", "display", "global"];
        expect(resolveMenuOrder(stored, DEFAULTS)).toEqual(stored);
    });

    it("drops ids this build does not have any more", () => {
        const stored = ["harem", "labyrinth", "global"];
        const result = resolveMenuOrder(stored, DEFAULTS);
        expect(result).not.toContain("labyrinth");
        // The two ids the user did keep stay where they are, and the areas the
        // stored order never mentioned follow their predecessor "global".
        expect(result).toEqual(["harem", "global", "display", "daily", "adventure", "season"]);
    });

    it("drops duplicates", () => {
        const result = resolveMenuOrder(["harem", "harem", "global"], DEFAULTS);
        expect(result.filter((id) => id === "harem")).toHaveLength(1);
        expect(result).toHaveLength(DEFAULTS.length);
    });

    it("inserts a new area after its default predecessor, not at the end", () => {
        // "season" is what a stored order from the previous build lacks.
        const stored = ["global", "display", "daily", "adventure", "harem"];
        expect(resolveMenuOrder(stored, DEFAULTS))
            .toEqual(["global", "display", "daily", "adventure", "season", "harem"]);
    });

    it("keeps the relative order of several new areas", () => {
        const stored = ["global", "harem"];
        expect(resolveMenuOrder(stored, DEFAULTS)).toEqual(DEFAULTS);
    });

    it("puts a new first area first", () => {
        const stored = ["display", "daily", "adventure", "season", "harem"];
        expect(resolveMenuOrder(stored, DEFAULTS)[0]).toBe("global");
    });

    it("follows the stored position of the predecessor, not the default one", () => {
        // User moved "harem" to the top; "season" is new and belongs after
        // "adventure", wherever the user put that.
        const stored = ["harem", "adventure", "global", "display", "daily"];
        expect(resolveMenuOrder(stored, DEFAULTS))
            .toEqual(["harem", "adventure", "season", "global", "display", "daily"]);
    });

    it("never invents ids", () => {
        const result = resolveMenuOrder(["harem"], DEFAULTS);
        expect(new Set(result)).toEqual(new Set(DEFAULTS));
    });
});

describe("isDefaultMenuOrder", () => {
    it("is true for the default order", () => {
        expect(isDefaultMenuOrder([...DEFAULTS], DEFAULTS)).toBe(true);
    });

    it("is false for a different order or length", () => {
        expect(isDefaultMenuOrder(["display", "global", "daily", "adventure", "season", "harem"], DEFAULTS)).toBe(false);
        expect(isDefaultMenuOrder(["global"], DEFAULTS)).toBe(false);
    });
});
