import { HaremGirl } from '../../../src/Module/harem/HaremGirl';
import { KKHaremGirl } from '../../../src/model/KK/KKHaremGirl';

describe("HaremGirl", function () {
    const HTML_START = `<!DOCTYPE html><div id="hh_hentai" page="event"><p>Hello world</p></div>`;
    const AFF_BUTTON = `<button id="girl-leveler-max-out-affection" class="blue_button_L">Max</button>`;

    function mockGirl(graded: number = 0, nb_grades: number = 0 , awakening_costs: number = 0, element: string= '') {
        unsafeWindow.girl = {
            name: 'GIRL',
            nb_grades: nb_grades,
            graded: graded,
            awakening_costs: awakening_costs,
            element: element,
        } as any
    }

    beforeEach(function () {
        document.body.innerHTML = HTML_START;
    });

    afterEach(function () {
        unsafeWindow.girl = undefined;
    });

    describe("canAwakeGirl", function () {
        it("default", function () {
            // No girl set -> getCurrentGirl() is undefined -> caught, falsy.
            expect(HaremGirl.canAwakeGirl()).toBeFalsy();
            // Real girl needing gems but with no player_gems_amount data loaded:
            // the hardened gems read yields 0, so 0 >= awakening_costs is false.
            mockGirl(1, 1, 123, 'fire');
            expect(HaremGirl.canAwakeGirl()).toBeFalsy();
        });

        it("Fire girl", function () {
            mockGirl(1,1,123,'fire');
            expect(HaremGirl.canAwakeGirl()).toBeFalsy();
            
            unsafeWindow.player_gems_amount = {
                'water': { amount: 150 }, 'fire': { amount: 50 }
            };
            mockGirl(1,1,123,'fire');
            expect(HaremGirl.canAwakeGirl()).toBeFalsy();

            unsafeWindow.player_gems_amount = {
                'water': { amount: 150 }, 'fire': { amount: 150 }
            };
            expect(HaremGirl.canAwakeGirl()).toBeTruthy();
        });
    });

    describe("canGiftGirl", function () {
        it("default", function () {
            expect(HaremGirl.canGiftGirl()).toBeFalsy();
            mockGirl();
            expect(HaremGirl.canGiftGirl()).toBeFalsy();
        });
        it("Button and no girl", function () {
            document.body.innerHTML = HTML_START + AFF_BUTTON;
            expect(HaremGirl.canGiftGirl()).toBeFalsy();
        });

        it("Upgraded girl", function () {
            mockGirl(1, 1);
            expect(HaremGirl.canGiftGirl()).toBeFalsy();
            mockGirl(3, 3);
            expect(HaremGirl.canGiftGirl()).toBeFalsy();
        });

        it("Upgradable girl", function () {
            mockGirl(1, 3);
            expect(HaremGirl.canGiftGirl()).toBeFalsy();
            document.body.innerHTML = HTML_START + AFF_BUTTON;
            expect(HaremGirl.canGiftGirl()).toBeTruthy();
            mockGirl(3, 5);
            expect(HaremGirl.canGiftGirl()).toBeTruthy();
        });
    });
});
// #1915: the girl page loads its popups and inventories by AJAX. These cases
// replay the measured order -- the click first, the game's answer later.
describe("HaremGirl waiting for the game (#1915)", function () {
    const POPUP = `<div id="girl_max_out_all_levels_popup">
        <div class="slot_soft_currency"><span class="amount">7 020 000</span></div>
        <button class="green_button_L" confirm_callback="1" currency="soft_currency">Cash</button>
        <button class="blue_button_L" confirm_callback="1">Gems</button></div>`;
    const girl = { name: 'GIRL', id_girl: 1 } as unknown as KKHaremGirl;
    let savedTimeout: number;
    let savedRects: typeof HTMLElement.prototype.getClientRects;

    beforeEach(function () {
        savedTimeout = HaremGirl.GAME_DATA_TIMEOUT_MS;
        HaremGirl.GAME_DATA_TIMEOUT_MS = 2000;
        // jsdom lays nothing out; jQuery's :visible needs a client rect.
        savedRects = HTMLElement.prototype.getClientRects;
        HTMLElement.prototype.getClientRects = function () { return [{}] as unknown as DOMRectList; };
        document.body.innerHTML = `<div id="hh_hentai"></div>
            <button id="girl-leveler-max-out-all-levels-affection">Max all</button>`;
    });

    afterEach(function () {
        HaremGirl.GAME_DATA_TIMEOUT_MS = savedTimeout;
        HTMLElement.prototype.getClientRects = savedRects;
        jest.restoreAllMocks();
    });

    it("pays with cash once the popup has loaded, not before", async function () {
        let cashClicks = 0;
        $('#girl-leveler-max-out-all-levels-affection').on('click', () => {
            // The popup arrives with the price request's answer: 1.5 s on the
            // test account at 1500 ms latency, longer than the old fixed pause.
            setTimeout(() => {
                $('#hh_hentai').append(POPUP);
                $('#girl_max_out_all_levels_popup .green_button_L').on('click', () => {
                    cashClicks++;
                    $('#girl_max_out_all_levels_popup').remove();
                });
            }, 1500);
        });

        const cost = await HaremGirl.maxOutAllButtonAndConfirm(HaremGirl.AFFECTION_TYPE, girl);

        expect(cashClicks).toBe(1);
        expect(cost).toBe(7020000);
    });

    it("reports failure instead of going on when the popup never appears", async function () {
        const cost = await HaremGirl.maxOutAllButtonAndConfirm(HaremGirl.AFFECTION_TYPE, girl);
        expect(cost).toBe(-1);
    });

    it("reports failure when the popup stays open after paying", async function () {
        $('#hh_hentai').append(POPUP);
        const cost = await HaremGirl.maxOutAllButtonAndConfirm(HaremGirl.AFFECTION_TYPE, girl);
        expect(cost).toBe(-1);
    });

    it("fillAllAffection reports no quest to go to when the payment failed", async function () {
        unsafeWindow.girl = { name: 'GIRL', id_girl: 1, graded: 0, nb_grades: 3 } as unknown as KKHaremGirl;
        sessionStorage.setItem('HHAuto_Temp_haremGirlPayLast', 'true');
        jest.spyOn(HaremGirl, 'openTab').mockResolvedValue(true);
        try {
            expect(await HaremGirl.fillAllAffection()).toBe(false);
        } finally {
            sessionStorage.removeItem('HHAuto_Temp_haremGirlPayLast');
            unsafeWindow.girl = undefined;
        }
    });

    it("waits for the decision until the inventory has loaded", async function () {
        // The max-out button only becomes enabled with the inventory answer.
        document.body.innerHTML = `<div id="hh_hentai"></div>
            <button id="girl-leveler-max-out-all-levels-affection" disabled>Max all</button>`;
        unsafeWindow.girl = { name: 'GIRL', id_girl: 1, graded: 0, nb_grades: 3 } as unknown as KKHaremGirl;
        sessionStorage.setItem('HHAuto_Temp_haremGirlPayLast', 'true');
        jest.spyOn(HaremGirl, 'openTab').mockImplementation(async () => {
            $('#girl-leveler-max-out-all-levels-affection').prop('disabled', false);
            return true;
        });
        const paid = jest.spyOn(HaremGirl, 'maxOutAllButtonAndConfirm').mockResolvedValue(100);
        try {
            expect(await HaremGirl.fillAllAffection()).toBe(true);
            expect(paid).toHaveBeenCalledTimes(1);
        } finally {
            sessionStorage.removeItem('HHAuto_Temp_haremGirlPayLast');
            unsafeWindow.girl = undefined;
        }
    });

    it("single max out: confirms the late popup and counts the answer, not the popup closing", async function () {
        document.body.innerHTML = `<div id="hh_hentai"></div>
            <button id="girl-leveler-max-out-affection">Max</button>`;
        let confirms = 0;
        $('#girl-leveler-max-out-affection').on('click', () => {
            setTimeout(() => {
                // Measured: this popup stays open after the game has answered.
                $('#hh_hentai').append(`<div id="girl_max_out_popup">
                    <button class="blue_button_L" confirm_callback="1">OK</button></div>`);
                $('#girl_max_out_popup button').on('click', () => { confirms++; });
            }, 1500);
        });

        expect(await HaremGirl.maxOutButtonAndConfirm(HaremGirl.AFFECTION_TYPE, girl)).toBe(true);
        expect(confirms).toBe(1);
    });

    it("does not click a shown tab that is still loading, and waits for its bar", async function () {
        // A second click while the inventory loads makes the game draw the
        // star bar twice (measured without the script).
        document.body.innerHTML = `<div id="girl-leveler-tabs"><div class="switch-tab" data-tab="affection"></div></div>
            <div id="affection"><div class="girl-resource-section"></div></div>`;
        let clicks = 0;
        $('#girl-leveler-tabs .switch-tab').on('click', () => { clicks++; });
        setTimeout(() => $('#affection .girl-resource-section').append('<div class="bar-section"></div>'), 500);

        expect(await HaremGirl.openTab(HaremGirl.AFFECTION_TYPE)).toBe(true);
        expect(clicks).toBe(0);
    });

    it("clicks a hidden tab once and waits for its data", async function () {
        document.body.innerHTML = `<div id="girl-leveler-tabs"><div class="switch-tab" data-tab="affection"></div></div>
            <div id="affection" class="hidden-tab"><div class="girl-resource-section"></div></div>`;
        const rects = HTMLElement.prototype.getClientRects;
        HTMLElement.prototype.getClientRects = function (this: HTMLElement) {
            return (this.closest('.hidden-tab') ? [] : [{}]) as unknown as DOMRectList;
        };
        let clicks = 0;
        $('#girl-leveler-tabs .switch-tab').on('click', () => {
            clicks++;
            $('#affection').removeClass('hidden-tab');
            setTimeout(() => $('#affection .girl-resource-section').append('<div class="bar-section"></div>'), 300);
        });
        try {
            expect(await HaremGirl.openTab(HaremGirl.AFFECTION_TYPE)).toBe(true);
            expect(clicks).toBe(1);
        } finally {
            HTMLElement.prototype.getClientRects = rects;
        }
    });

    it("reports a tab whose data never arrives", async function () {
        HaremGirl.GAME_DATA_TIMEOUT_MS = 300;
        document.body.innerHTML = `<div id="affection"><div class="girl-resource-section"></div></div>`;
        expect(await HaremGirl.openTab(HaremGirl.AFFECTION_TYPE)).toBe(false);
    });

    it("clicks the next skill only after the previous upgrade has answered", async function () {
        document.body.innerHTML = `<div id="skills"><div class="skill-upgrade">
            <div class="skill-upgrade-row" skill-id="2"><button class="blue_button_L">+</button></div></div></div>`;
        let inFlight = false;
        let overlapping = 0;
        let clicks = 0;
        $('#skills button').on('click', function () {
            if (inFlight) overlapping++;
            inFlight = true;
            if (++clicks >= 3) $(this).prop('disabled', true);
        });
        jest.spyOn(HaremGirl, 'waitForGameData').mockImplementation(async () => { inFlight = false; return true; });

        await HaremGirl.fullSkillsUpgrade();

        expect(clicks).toBe(3);
        expect(overlapping).toBe(0);
    });
});
