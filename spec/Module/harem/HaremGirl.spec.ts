import { HaremGirl } from "../../../src/Module/index";

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
            expect(HaremGirl.canAwakeGirl()).toBeFalsy();
            mockGirl();
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
        xit("Button and no girl", function () {
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