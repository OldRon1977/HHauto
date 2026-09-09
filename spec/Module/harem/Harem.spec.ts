import { Harem } from '../../../src/Module/harem/Harem';
import { ConfigHelper } from '../../../src/Helper/ConfigHelper';
import * as PageHelper from '../../../src/Helper/PageHelper';
import { HHStoredVarPrefixKey } from '../../../src/config/HHStoredVars';
import { TK } from '../../../src/config/StorageKeys';

/**
 * Harem.spec.ts -- first spec file for src/Module/harem/Harem.ts.
 *
 * Focus is the genuinely unit-testable surface:
 *   - getGirlUpgradeCost: pure cost-matrix calculation, no DOM/storage/window.
 *   - getGirlCount / getFilteredGirlList: the null-guard paths -- girlsListSec
 *     from getHHVars can be null.
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

    /**
     * Measured on a live account 2026-09-09, 9 girls owned:
     *
     *   /waifu.html      girls_data_list  9 entries, every one shards=100
     *   /characters.html girlsDataList   24 entries, no shards/level/graded
     *   /home.html       girlsDataList    9 entries of salary/pay_in only
     *
     * The harem page lists every *known* girl, and its records carry no field
     * that separates owned from known -- so counting them, as the old fallback
     * did, put the ten-girl gate at 24 on an account that owns 9.
     */
    describe("counting owned girls without a cached harem size", function () {
        // Typed access to the game globals instead of an `any` cast per line.
        type GameWindow = {
            girlsDataList?: unknown;
            girls_data_list?: unknown;
            availableGirls?: unknown;
            shared?: unknown;
        };
        const game = () => unsafeWindow as unknown as GameWindow;
        const waifuPage = ConfigHelper.getHHScriptVars('pagesIDWaifu');
        const teamPage = ConfigHelper.getHHScriptVars('pagesIDEditTeam');
        const haremPage = ConfigHelper.getHHScriptVars('pagesIDHarem');

        const ownedRecords = (n: number) =>
            Object.fromEntries(Array.from({ length: n }, (_, i) =>
                [String(i + 1), { id_girl: String(i + 1), shards: '100', level: '1', graded: '0' }]));
        const knownRecords = (n: number) =>
            Object.fromEntries(Array.from({ length: n }, (_, i) =>
                [String(i + 1), { id_girl: String(i + 1), nb_grades: '3', rarity: 'rare' }]));

        beforeEach(function () {
            localStorage.clear();
            sessionStorage.clear();
            delete game().shared;
            delete game().girlsDataList;
            delete game().availableGirls;
            delete game().girls_data_list;
        });

        afterEach(function () {
            localStorage.clear();
            sessionStorage.clear();
            delete game().shared;
            delete game().girlsDataList;
            delete game().availableGirls;
            delete game().girls_data_list;
            jest.restoreAllMocks();
        });

        it("counts girls_data_list on the waifu page", function () {
            jest.spyOn(PageHelper, 'getPage').mockReturnValue(waifuPage);
            game().girls_data_list = ownedRecords(9);

            expect(Harem.getGirlCount()).toBe(9);
        });

        it("counts availableGirls on the team-edit page", function () {
            jest.spyOn(PageHelper, 'getPage').mockReturnValue(teamPage);
            game().availableGirls = ownedRecords(9);

            expect(Harem.getGirlCount()).toBe(9);
        });

        it("does not count the harem page's list of known girls", function () {
            jest.spyOn(PageHelper, 'getPage').mockReturnValue(haremPage);
            game().girlsDataList = knownRecords(24);

            expect(Harem.getGirlCount()).toBe(0);
        });

        it("still prefers the cached size over any page", function () {
            jest.spyOn(PageHelper, 'getPage').mockReturnValue(haremPage);
            game().girlsDataList = knownRecords(24);
            localStorage.setItem(HHStoredVarPrefixKey + TK.HaremSize,
                JSON.stringify({ count: 9, count_date: Date.now() }));

            expect(Harem.getGirlCount()).toBe(9);
        });

        it("falls back to the salary list when the page carries no owned records", function () {
            jest.spyOn(PageHelper, 'getPage').mockReturnValue(haremPage);
            game().shared = { GirlSalaryManager: { girlsListSec: [1, 2, 3, 4, 5, 6, 7] } };

            expect(Harem.getGirlCount()).toBe(7);
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
