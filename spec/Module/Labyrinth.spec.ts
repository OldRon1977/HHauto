import { HHStoredVarPrefixKey } from "../../src/config/HHStoredVars";
import { Labyrinth } from "../../src/Module/Labyrinth";

describe("Labyrinth", function () {

    const LABY_EMPTY = {
        button: {} as any,
        cell: {} as any,
        type: 'N/A',
        isOpponent: false,
        opponentDifficulty: -1,
        isTreasure: false,
        isShrine: false,
        isNext: true,
        power: null
    } as any
    const LABY_TRESURE = Object.assign({}, LABY_EMPTY, { isTreasure: true });
    const LABY_SHRINE = Object.assign({}, LABY_EMPTY, { isShrine: true});
    const LABY_SUPER_EASY = Object.assign({}, LABY_EMPTY, { opponentDifficulty: 0, isOpponent: true, power:1 });
    const LABY_EASY = Object.assign({}, LABY_EMPTY, { opponentDifficulty: 1, isOpponent: true, power:10 });
    const LABY_MEDIUM = Object.assign({}, LABY_EMPTY, { opponentDifficulty: 2, isOpponent: true, power:100 });
    const LABY_HARD = Object.assign({}, LABY_EMPTY, { opponentDifficulty: 3, isOpponent: true, power:1000 });
    const LABY_BOSS = Object.assign({}, LABY_EMPTY, { opponentDifficulty: 4, isOpponent: true, power:10000 });
    

    const HTML_START = `<!DOCTYPE html><div id="hh_hentai" class="page-labyrinth lang-en" page="labyrinth"><p>Hello world</p></div>`;

    function createLabyFloor(floorNumber: string) {
        document.body.innerHTML = HTML_START + `<div id="labyrinth-tabs"><div class="tab-switcher-fade-in">
                <span class="floor-number-text">${floorNumber}</span>
            </div></div>`;
    }

    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    describe("findBetter easy mode", function () {

        beforeEach(() => {
            document.body.innerHTML = HTML_START;
            // MockHelper.mockDomain('www.hentaiheroes.com', 'champions-map.html');
            // MockHelper.mockPage('champions_map');
            localStorage.setItem(HHStoredVarPrefixKey + 'Setting_autoLabyHard', 'false');
            sessionStorage.setItem(HHStoredVarPrefixKey + 'Temp_Debug', 'true');

            unsafeWindow.girl_squad = [
                { remaining_ego_percent: 100 }
            ]
        });

        it("default", function () {
            expect(Labyrinth.findBetter([])).toBeNull()
        });
        it("floor 1 easy, opponent", function () {
            createLabyFloor('1');
            expect(Labyrinth.findBetter([LABY_SUPER_EASY, LABY_EASY])).toEqual(LABY_EASY);
            expect(Labyrinth.findBetter([LABY_EASY, LABY_MEDIUM])).toEqual(LABY_EASY);
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_HARD])).toEqual(LABY_MEDIUM);
            expect(Labyrinth.findBetter([LABY_HARD, LABY_MEDIUM])).toEqual(LABY_MEDIUM);
            expect(Labyrinth.findBetter([LABY_HARD, LABY_HARD])).toEqual(LABY_HARD);
            expect(Labyrinth.findBetter([LABY_HARD, LABY_BOSS])).toEqual(LABY_HARD);
        });
        it("floor 1 easy, shrine", function () {
            createLabyFloor('1');

            expect(Labyrinth.findBetter([LABY_SHRINE, LABY_EASY]).isOpponent).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_EASY, LABY_SHRINE]).isOpponent).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_SHRINE, LABY_MEDIUM]).isOpponent).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_SHRINE]).isOpponent).toBeTruthy();

            expect(Labyrinth.findBetter([LABY_SHRINE, LABY_SHRINE]).isShrine).toBeTruthy();
        });
        it("floor 1 easy, shrine, girl wonded", function () {
            createLabyFloor('1');

            unsafeWindow.girl_squad = [
                { remaining_ego_percent: 100 },
                { remaining_ego_percent: 50 }
            ]

            expect(Labyrinth.findBetter([LABY_SHRINE, LABY_EASY]).isOpponent).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_EASY, LABY_SHRINE]).isOpponent).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_SHRINE, LABY_MEDIUM]).isOpponent).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_SHRINE]).isOpponent).toBeTruthy();
        });

        it("floor 1 easy, treasure", function () {
            createLabyFloor('1');

            expect(Labyrinth.findBetter([LABY_TRESURE, LABY_MEDIUM]).isTreasure).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_TRESURE]).isTreasure).toBeTruthy();

            expect(Labyrinth.findBetter([LABY_TRESURE, LABY_MEDIUM]).isTreasure).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_TRESURE]).isTreasure).toBeTruthy();

            expect(Labyrinth.findBetter([LABY_TRESURE, LABY_TRESURE]).isTreasure).toBeTruthy();
        });

        it("floor 3 easy, opponent", function () {
            createLabyFloor('3');
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_HARD])).toEqual(LABY_MEDIUM);
            expect(Labyrinth.findBetter([LABY_HARD, LABY_BOSS])).toEqual(LABY_HARD);
        });

        it("floor 3 easy, shrine, no girl wonded", function () {
            createLabyFloor('3');

            expect(Labyrinth.findBetter([LABY_SHRINE, LABY_MEDIUM]).isOpponent).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_SHRINE]).isOpponent).toBeTruthy();
        });

        it("floor 3 easy, shrine, girl wonded", function () {
            createLabyFloor('3');

            unsafeWindow.girl_squad = [
                { remaining_ego_percent: 100 },
                { remaining_ego_percent: 50 }
            ]

            expect(Labyrinth.findBetter([LABY_SHRINE, LABY_MEDIUM]).isShrine).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_SHRINE]).isShrine).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_SHRINE, LABY_SHRINE]).isShrine).toBeTruthy();
        });

        it("floor 3 easy, treasure", function () {
            createLabyFloor('3');

            expect(Labyrinth.findBetter([LABY_TRESURE, LABY_MEDIUM]).isTreasure).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_TRESURE]).isTreasure).toBeTruthy();

            expect(Labyrinth.findBetter([LABY_TRESURE, LABY_MEDIUM]).isTreasure).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_TRESURE]).isTreasure).toBeTruthy();
        });
    });

    describe("findBetter Hard mode", function () {
        beforeEach(() => {
            document.body.innerHTML = HTML_START;
            // MockHelper.mockDomain('www.hentaiheroes.com', 'champions-map.html');
            // MockHelper.mockPage('champions_map');
            localStorage.setItem(HHStoredVarPrefixKey + 'Setting_autoLabyHard', 'true');
            sessionStorage.setItem(HHStoredVarPrefixKey + 'Temp_Debug', 'true');

            unsafeWindow.girl_squad = [
                { remaining_ego_percent: 100 }
            ]
        });

        it("default", function () {
            expect(Labyrinth.findBetter([])).toBeNull()
        });

        it("floor 1 hard, opponent", function () {
            createLabyFloor('1');
            expect(Labyrinth.findBetter([LABY_SUPER_EASY, LABY_EASY])).toEqual(LABY_EASY);
            expect(Labyrinth.findBetter([LABY_EASY, LABY_MEDIUM])).toEqual(LABY_MEDIUM);
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_HARD])).toEqual(LABY_HARD);
            expect(Labyrinth.findBetter([LABY_HARD, LABY_MEDIUM])).toEqual(LABY_HARD);
            expect(Labyrinth.findBetter([LABY_HARD, LABY_HARD])).toEqual(LABY_HARD);
            expect(Labyrinth.findBetter([LABY_HARD, LABY_BOSS])).toEqual(LABY_BOSS);
        });
        it("floor 1 hard, shrine", function () {
            createLabyFloor('1');

            expect(Labyrinth.findBetter([LABY_SHRINE, LABY_EASY]).isOpponent).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_EASY, LABY_SHRINE]).isOpponent).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_SHRINE, LABY_MEDIUM]).isOpponent).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_SHRINE]).isOpponent).toBeTruthy();

            expect(Labyrinth.findBetter([LABY_SHRINE, LABY_SHRINE]).isShrine).toBeTruthy();
        });
        it("floor 1 hard, shrine, girl wonded", function () {
            createLabyFloor('1');

            unsafeWindow.girl_squad = [
                { remaining_ego_percent: 100 },
                { remaining_ego_percent: 50 },
                { remaining_ego_percent: 100 }
            ]

            expect(Labyrinth.findBetter([LABY_SHRINE, LABY_EASY]).isOpponent).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_EASY, LABY_SHRINE]).isOpponent).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_SHRINE, LABY_MEDIUM]).isOpponent).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_SHRINE]).isOpponent).toBeTruthy();
        });

        it("floor 1 hard, treasure", function () {
            createLabyFloor('1');

            expect(Labyrinth.findBetter([LABY_TRESURE, LABY_MEDIUM]).isTreasure).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_TRESURE]).isTreasure).toBeTruthy();

            expect(Labyrinth.findBetter([LABY_TRESURE, LABY_MEDIUM]).isTreasure).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_TRESURE]).isTreasure).toBeTruthy();

            expect(Labyrinth.findBetter([LABY_TRESURE, LABY_TRESURE]).isTreasure).toBeTruthy();
        });

        it("floor 4 hard, opponent", function () {
            createLabyFloor('4');
            expect(Labyrinth.findBetter([LABY_SUPER_EASY, LABY_EASY])).toEqual(LABY_EASY);
            expect(Labyrinth.findBetter([LABY_EASY, LABY_MEDIUM])).toEqual(LABY_MEDIUM);
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_HARD])).toEqual(LABY_HARD);
            expect(Labyrinth.findBetter([LABY_HARD, LABY_MEDIUM])).toEqual(LABY_HARD);
            expect(Labyrinth.findBetter([LABY_HARD, LABY_HARD])).toEqual(LABY_HARD);
            expect(Labyrinth.findBetter([LABY_HARD, LABY_BOSS])).toEqual(LABY_BOSS);
        });

        it("floor 3 hard, shrine, no girl wonded", function () {
            createLabyFloor('3');

            expect(Labyrinth.findBetter([LABY_SHRINE, LABY_MEDIUM]).isOpponent).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_SHRINE]).isOpponent).toBeTruthy();
        });

        it("floor 3 hard, shrine, girl wonded", function () {
            createLabyFloor('3');

            unsafeWindow.girl_squad = [
                { remaining_ego_percent: 100 },
                { remaining_ego_percent: 50 }
            ]

            expect(Labyrinth.findBetter([LABY_SHRINE, LABY_MEDIUM]).isShrine).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_SHRINE]).isShrine).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_SHRINE, LABY_SHRINE]).isShrine).toBeTruthy();
        });

        it("floor 3 hard, treasure", function () {
            createLabyFloor('3');

            expect(Labyrinth.findBetter([LABY_TRESURE, LABY_MEDIUM]).isTreasure).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_TRESURE]).isTreasure).toBeTruthy();

            expect(Labyrinth.findBetter([LABY_TRESURE, LABY_MEDIUM]).isTreasure).toBeTruthy();
            expect(Labyrinth.findBetter([LABY_MEDIUM, LABY_TRESURE]).isTreasure).toBeTruthy();
        });
    });
});