import { getSecondsLeft, setTimer } from '../../src/Helper/TimerHelper';
import {
    ClubChampion
} from '../../src/Module/ClubChampion'
import { HHStoredVarPrefixKey } from '../../src/config/HHStoredVars';
import { MockHelper } from '../testHelpers/MockHelpers';

describe("Club Champion module", function () {

    beforeEach(() => {
        unsafeWindow.server_now_ts = 1234;
        MockHelper.mockDomain('www.hentaiheroes.com', 'clubs.html');
        MockHelper.mockPage('clubs');
        setTimer('nextClubChampionTime',-1);
    });

    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });



    describe("getNextClubChampionTimer", function () {
        it("default", function () {
            expect(ClubChampion.getNextClubChampionTimer()).toBe(-1);
            MockHelper.mockPage('home');
            expect(ClubChampion.getNextClubChampionTimer()).toBe(0);
        });
        it("team rest", function () {
            const timerHtml = `<div class="club_champions_details_container">
                                <div class="team_rest_timer">
                                    <div class="text"> Girls rest: <span timer="897" property="team_rest" rel="timer"> 14m 37s </span></div>
                                </div>
                               </div>`;
            MockHelper.mockPage('clubs', timerHtml);
            expect(ClubChampion.getNextClubChampionTimer()).toBe(14*60+37);
        });
        it("champion rest", function () {
            const timerHtml = `<div class="club_champions_details_container">
                                <div class="champion_rest_timer">
                                    <div class="text">The champion will be back in : <span timer="21217" property="champion_rest" rel="expires">5h 53m</span></div>
                                </div>
                               </div>`;
            MockHelper.mockPage('clubs', timerHtml);
            expect(ClubChampion.getNextClubChampionTimer()).toBe(5 * 3600 + 53 * 60);
        });
    });

    describe("updateClubChampionTimer", function () {
        it("default home", function () {
            MockHelper.mockPage('home');
            expect(ClubChampion.updateClubChampionTimer()).toBeTruthy();
            const nextChampionTime = getSecondsLeft('nextClubChampionTime');
            expect(nextChampionTime).toBe(0);
        });
        it("default club page", function () {
            expect(ClubChampion.updateClubChampionTimer()).toBeTruthy();
            const nextChampionTime = getSecondsLeft('nextClubChampionTime');
            expect(nextChampionTime).toBeGreaterThanOrEqual(15*60);
            expect(nextChampionTime).toBeLessThanOrEqual(17*60);
        });
        it("team rest", function () {
            let nextChampionTime = getSecondsLeft('nextClubChampionTime');
            expect(nextChampionTime).toBe(0);

            const timerHtml = `<div class="club_champions_details_container">
                                <div class="team_rest_timer">
                                    <div class="text"> Girls rest: <span timer="897" property="team_rest" rel="timer"> 14m 37s </span></div>
                                </div>
                               </div>`;
            MockHelper.mockPage('clubs', timerHtml);
            expect(ClubChampion.updateClubChampionTimer()).toBeFalsy();

            nextChampionTime = getSecondsLeft('nextClubChampionTime');
            expect(nextChampionTime).toBeDefined();
            expect(nextChampionTime).toBeGreaterThanOrEqual(14 * 60 + 37);
            expect(nextChampionTime).toBeLessThanOrEqual(14 * 60 + 37 + 180);
        });
        it("champion rest", function () {
            let nextChampionTime = getSecondsLeft('nextClubChampionTime');
            expect(nextChampionTime).toBe(0);

            const timerHtml = `<div class="club_champions_details_container">
                                <div class="champion_rest_timer">
                                    <div class="text">The champion will be back in : <span timer="21217" property="champion_rest" rel="expires">5h 53m</span></div>
                                </div>
                               </div>`;
            MockHelper.mockPage('clubs', timerHtml);
            expect(ClubChampion.updateClubChampionTimer()).toBeFalsy();

            nextChampionTime = getSecondsLeft('nextClubChampionTime');
            expect(nextChampionTime).toBeDefined();
            expect(nextChampionTime).toBeGreaterThanOrEqual(5 * 3600 + 53 * 60);
            expect(nextChampionTime).toBeLessThanOrEqual(5 * 3600 + 53 * 60 + 180);
        });
        it("champion rest force start", function () {
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoClubForceStart", 'true');
            let nextChampionTime = getSecondsLeft('nextClubChampionTime');
            expect(nextChampionTime).toBe(0);

            const timerHtml = `<div class="club_champions_details_container">
                                <div class="champion_rest_timer">
                                    <div class="text">The champion will be back in : <span timer="21217" property="team_rest" rel="expires">5h 53m</span></div>
                                </div>
                               </div>`;
            MockHelper.mockPage('clubs', timerHtml);
            expect(ClubChampion.updateClubChampionTimer()).toBeFalsy();

            nextChampionTime = getSecondsLeft('nextClubChampionTime');
            expect(nextChampionTime).toBeDefined();
            expect(nextChampionTime).toBeGreaterThanOrEqual(115 * 60);
            expect(nextChampionTime).toBeLessThanOrEqual(125 * 60);
        });
        it("champion rest force start with girls", function () {
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoClubForceStart", 'true');
            let nextChampionTime = getSecondsLeft('nextClubChampionTime');
            expect(nextChampionTime).toBe(0);

            const timerHtml = `<div class="club_champions_details_container">
                                <div class="champion_rest_timer">
                                    <div class="text">The champion will be back in : <span timer="21217" property="team_rest" rel="expires">5h 53m</span></div>
                                </div>
                               </div>`
                            + `<div id="club_champions"><div class="club_champions_rewards_container"><div class="slot slot_girl_shards"></div></div></div>`;
            MockHelper.mockPage('clubs', timerHtml);
            expect(ClubChampion.updateClubChampionTimer()).toBeFalsy();

            nextChampionTime = getSecondsLeft('nextClubChampionTime');
            expect(nextChampionTime).toBeDefined();
            expect(nextChampionTime).toBeGreaterThanOrEqual(30 * 60);
            expect(nextChampionTime).toBeLessThanOrEqual(35 * 60 + 180);
        });
    });

    // _setTimer alignment: covered spy-free by ClubChampion.pure.spec.ts
    // (decideAlignedClubChampionTimer, nine cases including the strict
    // boundaries). The adapter wrapper was removed in the spec triage
    // (2026-08).
});
