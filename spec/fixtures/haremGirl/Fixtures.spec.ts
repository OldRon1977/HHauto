import { loadFixture } from "../../testHelpers/Fixtures";

/**
 * Redaction guard for the haremGirl fixture.
 *
 * The shape assertions this file used to carry checked a checked-in JSON
 * file against its own README; the parser they were sized to feed
 * (parseGirlsFromGameData) still does not exist. What remains is the part
 * that can actually fail: after a re-capture (see the sibling README),
 * asset urls and metadata must not come back in.
 */
describe("haremGirl fixtures", () => {
    describe("sample-girls", () => {
        it("strips asset urls and metadata that the whitelist drops", () => {
            const girls = loadFixture("haremGirl", "sample-girls") as Array<Record<string, unknown>>;
            expect(girls.length).toBeGreaterThan(0);
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
