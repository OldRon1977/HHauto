import { Harem } from '../../../src/Module/harem/Harem';

/**
 * Harem.spec.ts -- first spec file for src/Module/harem/Harem.ts.
 *
 * Created in cluster 7.2.H-D (REVIEW_Harem.md). Harem.ts had 0% coverage
 * before this. Focus is the genuinely unit-testable surface:
 *   - getGirlUpgradeCost: pure cost-matrix calculation, no DOM/storage/window.
 *   - getGirlCount / getFilteredGirlList: the null-guard paths hardened in
 *     cluster 7.2.H-A (I1/I2) -- girlsListSec from getHHVars can be null.
 *
 * The DOM/jQuery/AJAX-heavy methods (run, moduleHarem, addGirl*Menu,
 * moduleHaremExportGirlsData) are out of scope here; they belong to the
 * Schritt-11 coverage push once the run() mode-split (I5) lands.
 *
 * Note on getHHVars: it reads unsafeWindow.<path> and returns null when a
 * path segment is missing. Leaving unsafeWindow without the relevant keys
 * is therefore the "no game data loaded" scenario the guards must survive.
 */
describe("Harem", function () {
    describe("getGirlUpgradeCost", function () {
        // Values verified empirically against the cost-matrix formula
        // (cost11=36000, rarityFactors, gradeFactors).
        it("computes the base starting-rarity cost", function () {
            expect(Harem.getGirlUpgradeCost("starting", 0)).toBe(36000);
            expect(Harem.getGirlUpgradeCost("starting", 1)).toBe(90000);
        });

        it("scales the grade-0 cost by the rarity factor", function () {
            // common grade 0 = starting grade 0 (36000) * rarityFactor 2
            expect(Harem.getGirlUpgradeCost("common", 0)).toBe(72000);
            // mythic grade 0 = 36000 * 50
            expect(Harem.getGirlUpgradeCost("mythic", 0)).toBe(1800000);
            expect(Harem.getGirlUpgradeCost("legendary", 0)).toBe(720000);
        });

        it("applies the grade factors cumulatively", function () {
            expect(Harem.getGirlUpgradeCost("mythic", 1)).toBe(4500000);
            expect(Harem.getGirlUpgradeCost("mythic", 5)).toBe(90000000);
            expect(Harem.getGirlUpgradeCost("epic", 2)).toBe(3150000);
        });
    });

    describe("null-safety with no game data loaded", function () {
        beforeEach(function () {
            // Ensure no GirlSalaryManager / girls list is present on the
            // game window -> getHHVars returns null for every harem path.
            delete (unsafeWindow as any).shared;
            delete (unsafeWindow as any).girlsDataList;
            delete (unsafeWindow as any).availableGirls;
            delete (unsafeWindow as any).girls_data_list;
        });

        afterEach(function () {
            delete (unsafeWindow as any).shared;
            delete (unsafeWindow as any).girlsDataList;
            delete (unsafeWindow as any).availableGirls;
            delete (unsafeWindow as any).girls_data_list;
        });

        it("getGirlCount returns 0 instead of throwing on null girlsListSec", function () {
            // I2 guard: girlCount==0, girlsDataList null, girlsListSec null.
            expect(Harem.getGirlCount()).toBe(0);
        });

        it("getFilteredGirlList returns [] instead of throwing on null girlsListSec", function () {
            // I1 guard: all three sources falsy -> the else-if must not
            // dereference null.length.
            expect(Harem.getFilteredGirlList()).toEqual([]);
        });
    });
});
