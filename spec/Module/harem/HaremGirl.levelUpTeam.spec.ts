import { HaremGirl } from '../../../src/Module/harem/HaremGirl';
import { KKHaremGirl } from '../../../src/model/KK/KKHaremGirl';
import { getStoredJSON, setStoredValue } from '../../../src/Helper/StorageHelper';
import { HHStoredVarPrefixKey } from '../../../src/config/HHStoredVars';
import { TK } from '../../../src/config/StorageKeys';
import { gotoPage } from '../../../src/Service/PageNavigationService';

jest.mock('../../../src/Service/PageNavigationService', () => ({
    gotoPage: jest.fn().mockReturnValue(true),
    safeReload: jest.fn(),
    safeNavigateHref: jest.fn(),
    addNutakuSession: jest.fn((x: unknown) => x),
}));

const gotoPageMock = gotoPage as jest.Mock;

describe("HaremGirl: Max Level-up confirms either popup", function () {
    const girl = { name: 'GIRL', id_girl: 1 } as unknown as KKHaremGirl;
    let savedTimeout: number;
    let savedRects: typeof HTMLElement.prototype.getClientRects;

    beforeEach(function () {
        savedTimeout = HaremGirl.GAME_DATA_TIMEOUT_MS;
        HaremGirl.GAME_DATA_TIMEOUT_MS = 2000;
        savedRects = HTMLElement.prototype.getClientRects;
        HTMLElement.prototype.getClientRects = function () { return [{}] as unknown as DOMRectList; };
        document.body.innerHTML = `<div id="hh_hentai"></div>
            <button id="girl-leveler-max-out-all-levels-experience">Max Level-up</button>`;
    });

    afterEach(function () {
        HaremGirl.GAME_DATA_TIMEOUT_MS = savedTimeout;
        HTMLElement.prototype.getClientRects = savedRects;
        jest.restoreAllMocks();
    });

    it("an awakening ahead: pays the gems in the all-levels popup", async function () {
        let yes = 0;
        $('#girl-leveler-max-out-all-levels-experience').on('click', () => {
            $('#hh_hentai').append(`<div id="girl_max_out_all_levels_popup">
                <div class="slot_gems"><span class="amount">2,000</span></div>
                <button class="blue_button_L" confirm_callback="1">Yes</button>
                <button class="blue_button_L">No</button></div>`);
            $('#girl_max_out_all_levels_popup button[confirm_callback]').on('click', () => { yes++; });
        });

        expect(await HaremGirl.maxOutAllButtonAndConfirm(HaremGirl.EXPERIENCE_TYPE, girl)).toBe(2000);
        expect(yes).toBe(1);
    });

    it("no awakening left: confirms the books-only popup instead of waiting for one that never comes", async function () {
        // Measured: past the last awakening the same button opens
        // #girl_max_out_popup, and #girl_max_out_all_levels_popup never appears.
        let yes = 0;
        $('#girl-leveler-max-out-all-levels-experience').on('click', () => {
            $('#hh_hentai').append(`<div id="girl_max_out_popup">
                <button class="blue_button_L" confirm_callback="1">Yes</button>
                <button class="blue_button_L">No</button></div>`);
            $('#girl_max_out_popup button[confirm_callback]').on('click', () => { yes++; });
        });

        const started = Date.now();
        expect(await HaremGirl.maxOutAllButtonAndConfirm(HaremGirl.EXPERIENCE_TYPE, girl)).toBe(0);
        expect(yes).toBe(1);
        expect(Date.now() - started).toBeLessThan(HaremGirl.GAME_DATA_TIMEOUT_MS);
    });
});

describe("HaremGirl: Level-up team run", function () {
    const teamKey = HHStoredVarPrefixKey + TK.haremTeam;

    function startRun(girlIds: number[], trips?: Record<string, number>) {
        setStoredValue(HHStoredVarPrefixKey + TK.haremGirlActions, HaremGirl.LEVEL_UP_TYPE);
        setStoredValue(HHStoredVarPrefixKey + TK.haremGirlMode, 'team');
        setStoredValue(teamKey, JSON.stringify({ team: girlIds.map(id => ({ id_girl: id })), girlIds, levelUpTrips: trips }));
    }

    function onGirl(id: number, graded: number, nb_grades: number) {
        unsafeWindow.girl = { name: 'GIRL' + id, id_girl: id, level: 300, level_cap: 350, graded, nb_grades, Xp: { cur: 0 } } as unknown as KKHaremGirl;
    }

    beforeEach(function () {
        document.body.innerHTML = '<div id="hh_hentai"></div>';
        gotoPageMock.mockClear();
    });

    afterEach(function () {
        sessionStorage.clear();
        localStorage.clear();
        unsafeWindow.girl = undefined;
        jest.restoreAllMocks();
    });

    it("grades first: a girl short of grades goes to her quest, her levels wait", async function () {
        startRun([11, 12]);
        onGirl(11, 1, 3);
        const affection = jest.spyOn(HaremGirl, 'fillAllAffection').mockResolvedValue(true);
        const experience = jest.spyOn(HaremGirl, 'fillAllExperience').mockResolvedValue(true);

        expect(await HaremGirl.run()).toBe(true);

        expect(affection).toHaveBeenCalledTimes(1);
        expect(experience).not.toHaveBeenCalled();
        expect(gotoPageMock).not.toHaveBeenCalled();
        expect(getStoredJSON<{ levelUpTrips?: unknown }>(teamKey, {}).levelUpTrips).toEqual({ '11': 1 });
    });

    it("grades done: levels, then on to the next girl", async function () {
        startRun([11, 12]);
        onGirl(11, 3, 3);
        const affection = jest.spyOn(HaremGirl, 'fillAllAffection').mockResolvedValue(false);
        const experience = jest.spyOn(HaremGirl, 'fillAllExperience').mockResolvedValue(true);

        expect(await HaremGirl.run()).toBe(true);

        expect(affection).not.toHaveBeenCalled();
        expect(experience).toHaveBeenCalledTimes(1);
        expect(gotoPageMock).toHaveBeenCalledWith('/girl/12', expect.anything(), expect.anything());
    });

    it("no grade to be had (no gifts, no money): levels anyway, then on", async function () {
        startRun([11, 12]);
        onGirl(11, 1, 3);
        jest.spyOn(HaremGirl, 'fillAllAffection').mockResolvedValue(false);
        const experience = jest.spyOn(HaremGirl, 'fillAllExperience').mockResolvedValue(false);

        expect(await HaremGirl.run()).toBe(true);

        expect(experience).toHaveBeenCalledTimes(1);
        expect(gotoPageMock).toHaveBeenCalledWith('/girl/12', expect.anything(), expect.anything());
    });

    it("stops going to a quest that keeps not completing", async function () {
        startRun([11, 12], { '11': 4 });
        onGirl(11, 1, 3);
        const affection = jest.spyOn(HaremGirl, 'fillAllAffection').mockResolvedValue(true);
        const experience = jest.spyOn(HaremGirl, 'fillAllExperience').mockResolvedValue(true);

        expect(await HaremGirl.run()).toBe(true);

        expect(affection).not.toHaveBeenCalled();
        expect(experience).toHaveBeenCalledTimes(1);
        expect(gotoPageMock).toHaveBeenCalledWith('/girl/12', expect.anything(), expect.anything());
    });

    it("at her cap: awakened first, the reload brings the run back to her", async function () {
        startRun([11, 12]);
        onGirl(11, 3, 3);
        (unsafeWindow.girl as unknown as { level: number }).level = 350;
        jest.spyOn(HaremGirl, 'openTab').mockResolvedValue(true);
        const awaken = jest.spyOn(HaremGirl, 'awakGirlAndWait').mockResolvedValue(true);
        const experience = jest.spyOn(HaremGirl, 'fillAllExperience').mockResolvedValue(true);

        expect(await HaremGirl.run()).toBe(true);

        expect(awaken).toHaveBeenCalledTimes(1);
        expect(experience).not.toHaveBeenCalled();
        expect(gotoPageMock).not.toHaveBeenCalled();
    });

    it("last girl: the run ends and the stored work is cleared", async function () {
        startRun([11]);
        onGirl(11, 3, 3);
        jest.spyOn(HaremGirl, 'fillAllExperience').mockResolvedValue(true);

        await HaremGirl.run();

        expect(sessionStorage.getItem(HHStoredVarPrefixKey + TK.haremGirlMode)).toBeNull();
        expect(sessionStorage.getItem(teamKey)).toBeNull();
    });
});

describe("HaremGirl: Max Grade-up with too little money", function () {
    let savedTimeout: number;
    let savedRects: typeof HTMLElement.prototype.getClientRects;

    beforeEach(function () {
        savedTimeout = HaremGirl.GAME_DATA_TIMEOUT_MS;
        HaremGirl.GAME_DATA_TIMEOUT_MS = 2000;
        savedRects = HTMLElement.prototype.getClientRects;
        HTMLElement.prototype.getClientRects = function () { return [{}] as unknown as DOMRectList; };
        (unsafeWindow as unknown as { shared: unknown }).shared = { Hero: { currencies: { soft_currency: 8_000_000 } } };
    });

    afterEach(function () {
        HaremGirl.GAME_DATA_TIMEOUT_MS = savedTimeout;
        HTMLElement.prototype.getClientRects = savedRects;
        unsafeWindow.girl = undefined;
        sessionStorage.clear();
        jest.restoreAllMocks();
    });

    it("closes the popup with No instead of paying, then gives the gifts she can take", async function () {
        // Measured: 27,000,000 asked with 8.7 M owned, cash button enabled.
        document.body.innerHTML = `<div id="hh_hentai"></div>
            <button id="girl-leveler-max-out-all-levels-affection">Max Grade-up</button>
            <button id="girl-leveler-max-out-affection">Max out</button>`;
        let cash = 0;
        let no = 0;
        $('#girl-leveler-max-out-all-levels-affection').on('click', () => {
            $('#hh_hentai').append(`<div id="girl_max_out_all_levels_popup">
                <div class="slot_soft_currency"><span class="amount">27,000,000</span></div>
                <button class="green_button_L" confirm_callback="1" currency="soft_currency">Pay</button>
                <button class="orange_button_L" currency="hard_currency">Pay</button>
                <button class="blue_button_L">No</button></div>`);
            $('#girl_max_out_all_levels_popup .green_button_L').on('click', () => { cash++; });
            $('#girl_max_out_all_levels_popup .blue_button_L').on('click', () => { no++; $('#girl_max_out_all_levels_popup').remove(); });
        });
        unsafeWindow.girl = { name: 'GIRL', id_girl: 1, graded: 3, nb_grades: 5 } as unknown as KKHaremGirl;
        setStoredValue(HHStoredVarPrefixKey + TK.haremGirlPayLast, 'true');
        jest.spyOn(HaremGirl, 'openTab').mockResolvedValue(true);
        const single = jest.spyOn(HaremGirl, 'maxOutButtonAndConfirm').mockResolvedValue(true);
        jest.spyOn(HaremGirl, 'goToGirlQuest').mockReturnValue(true);

        expect(await HaremGirl.fillAllAffection()).toBe(true);
        expect(cash).toBe(0);
        expect(no).toBe(1);
        expect(single).toHaveBeenCalledTimes(1);
    });
});

describe("HaremGirl: Level-up team at an unpaid quest and a refused awakening", function () {
    let savedTimeout: number;
    let savedRects: typeof HTMLElement.prototype.getClientRects;

    beforeEach(function () {
        savedTimeout = HaremGirl.GAME_DATA_TIMEOUT_MS;
        HaremGirl.GAME_DATA_TIMEOUT_MS = 2000;
        savedRects = HTMLElement.prototype.getClientRects;
        HTMLElement.prototype.getClientRects = function () { return [{}] as unknown as DOMRectList; };
        gotoPageMock.mockClear();
    });

    afterEach(function () {
        HaremGirl.GAME_DATA_TIMEOUT_MS = savedTimeout;
        HTMLElement.prototype.getClientRects = savedRects;
        unsafeWindow.girl = undefined;
        unsafeWindow.player_gems_amount = undefined;
        sessionStorage.clear();
        jest.restoreAllMocks();
    });

    it("an awakening the game refuses: popup closed, false, the run is not ended", async function () {
        document.body.innerHTML = `<div id="hh_hentai"><plus id="awaken"></plus></div>`;
        let closed = 0;
        $('#awaken').on('click', () => {
            $('#hh_hentai').append(`<div class="popup_wrapper"><close class="closable"></close><div id="awakening_popup">
                You need 19 more Girls on level 350 in order to awaken
                <button class="awaken-btn green_button_L" disabled>Awaken 80/295</button></div></div>`);
            $('.popup_wrapper close').on('click', () => { closed++; });
        });
        unsafeWindow.player_gems_amount = { sun: { amount: 295 } } as unknown as typeof unsafeWindow.player_gems_amount;
        const girl = { name: 'GIRL', id_girl: 4, level: 350, level_cap: 350, awakening_costs: 80, element: 'sun' } as unknown as KKHaremGirl;
        setStoredValue(HHStoredVarPrefixKey + TK.haremGirlMode, 'team');

        expect(await HaremGirl.awakGirlAndWait(girl)).toBe(false);
        expect(closed).toBe(1);
        expect(sessionStorage.getItem(HHStoredVarPrefixKey + TK.haremGirlMode)).toBe('team');
    });

    it("a grade quest it cannot pay: back to the girl, her grades blocked, the run goes on", function () {
        document.body.innerHTML = `<div id="controls"><button class="grade-complete-button"><span class="price">6,500,000</span></button></div>`;
        // jsdom has no innerText; the code reads the price through it.
        Object.defineProperty(document.querySelector('.price'), 'innerText', { value: '6,500,000' });
        (unsafeWindow as unknown as { shared: unknown }).shared = { Hero: { currencies: { soft_currency: 1_000_000 } } };
        (unsafeWindow as unknown as { id_girl: number }).id_girl = 11;
        setStoredValue(HHStoredVarPrefixKey + TK.haremGirlActions, HaremGirl.LEVEL_UP_TYPE);
        setStoredValue(HHStoredVarPrefixKey + TK.haremGirlMode, 'team');
        setStoredValue(HHStoredVarPrefixKey + TK.haremTeam, JSON.stringify({ team: [{ id_girl: 11 }, { id_girl: 12 }], girlIds: [11, 12] }));

        expect(HaremGirl.payGirlQuest()).toBe(true);

        expect(gotoPageMock).toHaveBeenCalledWith('/girl/11', { resource: HaremGirl.EXPERIENCE_TYPE }, expect.anything());
        expect(sessionStorage.getItem(HHStoredVarPrefixKey + TK.haremGirlMode)).toBe('team');
        expect(getStoredJSON<{ levelUpTrips: Record<string, number> }>(HHStoredVarPrefixKey + TK.haremTeam, { levelUpTrips: {} }).levelUpTrips["11"]).toBeGreaterThan(5);
    });
});
