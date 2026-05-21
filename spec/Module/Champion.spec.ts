import { getSecondsLeft, setTimer } from '../../src/Helper/TimerHelper';
import {
    Champion
} from '../../src/Module/Champion'
import { HHStoredVarPrefixKey } from '../../src/config/HHStoredVars';
import { MockHelper } from '../testHelpers/MockHelpers';

describe("Champion module", function () {

    beforeEach(() => {
        MockHelper.mockDomain('www.hentaiheroes.com', 'champions-map.html');
        MockHelper.mockPage('champions_map');
        sessionStorage.setItem(HHStoredVarPrefixKey + 'Setting_autoChampFilter', '1;2;3;4;5;6');
        sessionStorage.setItem(HHStoredVarPrefixKey + 'Temp_clubChampLimitReached', 'false');
        setTimer('nextChampionTime',-1);
    });

    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });



    describe("findNextChamptionTime", function () {
        it("default", function () {
            let nextChampionTime = getSecondsLeft('nextChampionTime');
            expect(nextChampionTime).toBe(0);
            Champion.findNextChamptionTime();
            nextChampionTime = getSecondsLeft('nextChampionTime');
            expect(nextChampionTime).toBeDefined();
            // findNextChamptionTime calls randomInterval(3600, 4000) when no
            // championMap is given. randomInterval is inclusive on both ends,
            // so a roll of exactly 3600 is legal. Use >= to keep the test
            // deterministic.
            expect(nextChampionTime).toBeGreaterThanOrEqual(3600);
            expect(nextChampionTime).toBeLessThanOrEqual(4000);
        });
    });


    describe("_setTimer", function () {
        const TIME_1 = 123;
        const TIME_2 = 456;
        const TIME_COOLDOWN = 3600;

        // getSecondsLeft uses Math.ceil on both the stored deadline and
        // the current time. A sub-second delay between Champion._setTimer(X)
        // and the subsequent read can therefore return X-1 when the wall
        // clock crosses a second boundary mid-roundtrip. CI runners are
        // slow enough to hit this; locally it does not reproduce. Allow a
        // 1-second downward slack on every assertion that expects a
        // positive timer value.
        const expectSecondsLeftAround = (actual: number, expected: number) => {
            expect(actual).toBeGreaterThanOrEqual(expected - 1);
            expect(actual).toBeLessThanOrEqual(expected);
        };
        it("default", function () {
            let nextChampionTime = getSecondsLeft('nextChampionTime');
            expect(nextChampionTime).toBe(0);
            Champion._setTimer(TIME_1);

            nextChampionTime = getSecondsLeft('nextChampionTime');
            expectSecondsLeftAround(nextChampionTime, TIME_1);
        });

        it("autoChamps not aligned", function () {
            setTimer('nextClubChampionTime', TIME_2);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoClubChamp", 'true');
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoChampAlignTimer", 'false');

            let nextChampionTime = getSecondsLeft('nextChampionTime');
            expect(nextChampionTime).toBe(0);
            Champion._setTimer(TIME_1);

            nextChampionTime = getSecondsLeft('nextChampionTime');
            expectSecondsLeftAround(nextChampionTime, TIME_1);
        });

        it("autoChampAlignTimer", function () {
            setTimer('nextClubChampionTime', TIME_2);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoClubChamp", 'false');
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoChampAlignTimer", 'true');

            let nextChampionTime = getSecondsLeft('nextChampionTime');
            expect(nextChampionTime).toBe(0);
            Champion._setTimer(TIME_1);

            nextChampionTime = getSecondsLeft('nextChampionTime');
            expectSecondsLeftAround(nextChampionTime, TIME_1);
        });

        it("autoChampAlignTimer and autoClubChamp", function () {
            setTimer('nextClubChampionTime', TIME_2);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoClubChamp", 'true');
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoChampAlignTimer", 'true');

            let nextChampionTime = getSecondsLeft('nextChampionTime');
            expect(nextChampionTime).toBe(0);
            Champion._setTimer(TIME_1);

            nextChampionTime = getSecondsLeft('nextChampionTime');
            expect(nextChampionTime).toBe(TIME_2);
        });

        it("autoChampAlignTimer and autoClubChamp limit reached", function () {
            setTimer('nextClubChampionTime', TIME_2);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoClubChamp", 'true');
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoChampAlignTimer", 'true');
            sessionStorage.setItem(HHStoredVarPrefixKey + 'Temp_clubChampLimitReached', 'true');

            let nextChampionTime = getSecondsLeft('nextChampionTime');
            expect(nextChampionTime).toBe(0);
            Champion._setTimer(TIME_1);

            nextChampionTime = getSecondsLeft('nextChampionTime');
            expectSecondsLeftAround(nextChampionTime, TIME_1);
        });

        it("autoChampAlignTimer and autoClubChamp cooldown", function () {
            setTimer('nextClubChampionTime', TIME_COOLDOWN);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoClubChamp", 'true');
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoChampAlignTimer", 'true');

            let nextChampionTime = getSecondsLeft('nextChampionTime');
            expect(nextChampionTime).toBe(0);
            Champion._setTimer(TIME_1);

            nextChampionTime = getSecondsLeft('nextChampionTime');
            expectSecondsLeftAround(nextChampionTime, TIME_1);
        });

        it("autoChampAlignTimer and autoClubChamp with champ cooldown", function () {
            setTimer('nextClubChampionTime', TIME_1);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoClubChamp", 'true');
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoChampAlignTimer", 'true');

            let nextChampionTime = getSecondsLeft('nextChampionTime');
            expect(nextChampionTime).toBe(0);
            Champion._setTimer(TIME_COOLDOWN);

            nextChampionTime = getSecondsLeft('nextChampionTime');
            expectSecondsLeftAround(nextChampionTime, TIME_COOLDOWN);
        });
    });
});