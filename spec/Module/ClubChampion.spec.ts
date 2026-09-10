import { getSecondsLeft, setTimer } from '../../src/Helper/TimerHelper';
import * as AjaxTracker from '../../src/Service/AjaxTracker';

jest.mock('../../src/Service/PageNavigationService', () => ({
    ...jest.requireActual('../../src/Service/PageNavigationService'),
    gotoPage: jest.fn(),
}));
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

    /**
     * The champions tab fetches its content -- it is not hidden markup.
     * Measured on a live account 2026-09-10: on the members tab the club page
     * carries `div.club_champions_details_container` zero times, and
     * querySelectorAll counts hidden nodes, so the container is absent rather
     * than invisible. The reads used to follow the tab click in the same
     * synchronous block (12 ms apart by the log's timestamps) and found
     * nothing: "on clubs, next timer:-1", a 16-minute timer, home, repeat --
     * while /club-champion.html carried a live `button[rel=perform]`.
     */
    describe("the champions tab is fetched, not unhidden", function () {
        it("waits for the tab to load before reading it", async function () {
            // No .club-champion-members-challenges: the tab has not been opened,
            // which is the state the club page lands in.
            MockHelper.mockPage('clubs', '<div id="club_champions_tab"></div>');
            const order: string[] = [];
            const idle = jest.spyOn(AjaxTracker, 'waitForAjaxIdle')
                .mockImplementation(async () => { order.push('wait'); return true; });
            const timer = jest.spyOn(ClubChampion, 'getNextClubChampionTimer')
                .mockImplementation(() => { order.push('read'); return -1; });

            await ClubChampion.doClubChampionStuff();

            expect(idle).toHaveBeenCalled();
            // The read must not happen before the wait -- that ordering is the
            // whole defect. There are two reads per pass (doClubChampionStuff
            // reads once, updateClubChampionTimer again at the end), which is
            // why the live log carries "on clubs, next timer:-1" twice; both
            // have to come after the wait.
            expect(order[0]).toBe('wait');
            expect(order.filter(o => o === 'read').length).toBeGreaterThan(0);
            expect(order.indexOf('read')).toBeGreaterThan(order.indexOf('wait'));
            idle.mockRestore();
            timer.mockRestore();
        });

        it("reads the tab anyway when the load does not settle", async function () {
            MockHelper.mockPage('clubs', '<div id="club_champions_tab"></div>');
            const idle = jest.spyOn(AjaxTracker, 'waitForAjaxIdle').mockResolvedValue(false);
            const timer = jest.spyOn(ClubChampion, 'getNextClubChampionTimer').mockReturnValue(-1);

            await ClubChampion.doClubChampionStuff();

            // A tab that never settles must not stall the handler: it reads and
            // schedules the next check like any other pass.
            expect(timer).toHaveBeenCalled();
            idle.mockRestore();
            timer.mockRestore();
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
