import { getSecondsLeft, setTimer } from "../../../src/Helper/TimerHelper";
import { Booster } from '../../../src/Module/Booster';
import { Season } from '../../../src/Module/Events/Season';
import { ParanoiaService } from "../../../src/Service/ParanoiaService";
import * as PageNavigationService from "../../../src/Service/PageNavigationService";
import { HHStoredVarPrefixKey } from "../../../src/config/HHStoredVars";
import { SK, TK } from "../../../src/config/StorageKeys";
import { BDSMSimu } from '../../../src/model/BDSMSimu';
import { SeasonOpponent } from '../../../src/model/SeasonOpponent';
import { MockHelper } from "../../testHelpers/MockHelpers";

describe("Season event", function () {

    const GOOD_SIMU: BDSMSimu = { win: 95, scoreClass: 'plus' } as BDSMSimu;
    const NEUTRAL_SIMU: BDSMSimu = { win: 65, scoreClass: 'close' } as BDSMSimu;
    const BAD_SIMU: BDSMSimu = { win: 5, scoreClass: 'minus' } as BDSMSimu;

    const OPPO_A: SeasonOpponent = new SeasonOpponent(
        123, 'OPPO_A',
        20, // mojo
        8,
        8,
        GOOD_SIMU
    );
    const OPPO_B: SeasonOpponent = new SeasonOpponent(
        456, 'OPPO_B',
        15, // mojo
        8,
        8,
        NEUTRAL_SIMU
    );
    const OPPO_C: SeasonOpponent = new SeasonOpponent(
        789, 'OPPO_C',
        10, // mojo
        8,
        8,
        BAD_SIMU
    );

    function mockSeasonTierLevel(tier:number = 1){
        MockHelper.mockPage('season_arena', '<div id="tier_indicator">'+tier+'</div>');
    }

    beforeEach(() => {
        MockHelper.mockDomain();
        mockSeasonTierLevel(63);
    });

    describe("getBestOppo", function () {

        it("Same oppo", function () {
            let result = Season.getBestOppo([OPPO_A, OPPO_A, OPPO_A]);
            expect(result.chosenIndex).toBe(0);
            expect(result.numberOfReds).toBe(0);

            result = Season.getBestOppo([OPPO_B, OPPO_B, OPPO_B]);
            expect(result.chosenIndex).toBe(0);
            expect(result.numberOfReds).toBe(0);

            result = Season.getBestOppo([OPPO_C, OPPO_C, OPPO_C]);
            expect(result.chosenIndex).toBe(0);
            expect(result.numberOfReds).toBe(3);
        });

        it("One good oppo", function () {
            expect(Season.getBestOppo([OPPO_A, OPPO_B, OPPO_C]).chosenIndex).toBe(0);
            expect(Season.getBestOppo([OPPO_A, OPPO_B, OPPO_C]).numberOfReds).toBe(1);
            expect(Season.getBestOppo([OPPO_B, OPPO_A, OPPO_C]).chosenIndex).toBe(1);
            expect(Season.getBestOppo([OPPO_C, OPPO_B, OPPO_A]).chosenIndex).toBe(2);
        });

        it("same orange flag but better score", function () {
            const OPPO_BA = { ...OPPO_B };
            OPPO_BA.simu = { ...OPPO_B.simu };
            OPPO_BA.simu.win = 70;
            let result = Season.getBestOppo([OPPO_B, OPPO_BA, OPPO_C]);
            expect(result.chosenIndex).toBe(1);
            expect(result.numberOfReds).toBe(1);
            const OPPO_BB = { ...OPPO_B };
            OPPO_BB.simu = { ...OPPO_B.simu };
            OPPO_BB.simu.win = 75;
            result = Season.getBestOppo([OPPO_B, OPPO_BA, OPPO_BB]);
            expect(result.chosenIndex).toBe(2);
            expect(result.numberOfReds).toBe(0);
        });

        it("same red flag but better mojo", function () {
            const OPPO_CA = { ...OPPO_C };
            OPPO_CA.mojo = 15;
            let result = Season.getBestOppo([OPPO_C, OPPO_CA, OPPO_C]);
            expect(result.chosenIndex).toBe(1);
            expect(result.numberOfReds).toBe(3);

            const OPPO_CB = { ...OPPO_C };
            OPPO_CB.mojo = 18;
            result = Season.getBestOppo([OPPO_C, OPPO_CA, OPPO_CB]);
            expect(result.chosenIndex).toBe(2);
            expect(result.numberOfReds).toBe(3);
        });

        it("same red flag same mojo but better score", function () {
            const OPPO_CA = { ...OPPO_C };
            OPPO_CA.simu = { ...OPPO_C.simu };
            OPPO_CA.simu.win = 15;
            let result = Season.getBestOppo([OPPO_C, OPPO_CA, OPPO_C]);
            expect(result.chosenIndex).toBe(1);
            expect(result.numberOfReds).toBe(3);

            const OPPO_CB = { ...OPPO_C };
            OPPO_CB.simu = { ...OPPO_C.simu };
            OPPO_CB.simu.win = 16;
            result = Season.getBestOppo([OPPO_C, OPPO_CA, OPPO_CB]);
            expect(result.chosenIndex).toBe(2);
            expect(result.numberOfReds).toBe(3);
        });

        it("same green flag but better mojo", function () {
            const OPPO_AA = { ...OPPO_A };
            OPPO_AA.mojo = 22;
            let result = Season.getBestOppo([OPPO_A, OPPO_AA, OPPO_A]);
            expect(result.chosenIndex).toBe(1);
            expect(result.numberOfReds).toBe(0);

            const OPPO_AB = { ...OPPO_A };
            OPPO_AB.mojo = 23;
            result = Season.getBestOppo([OPPO_A, OPPO_AA, OPPO_AB]);
            expect(result.chosenIndex).toBe(2);
            expect(result.numberOfReds).toBe(0);
        });

        it("same green flag same mojo but better gains", function () {
            const OPPO_AA = { ...OPPO_A };
            OPPO_AA.aff = 9
            let result = Season.getBestOppo([OPPO_A, OPPO_AA, OPPO_A]);
            expect(result.chosenIndex).toBe(1);
            expect(result.numberOfReds).toBe(0);

            const OPPO_AB = { ...OPPO_A };
            OPPO_AB.aff = 10;
            result = Season.getBestOppo([OPPO_A, OPPO_AA, OPPO_AB]);
            expect(result.chosenIndex).toBe(2);
            expect(result.numberOfReds).toBe(0);
        });

        it("same green flag same mojo same gains but better score", function () {
            const OPPO_AA = { ...OPPO_A };
            OPPO_AA.simu = { ...OPPO_A.simu };
            OPPO_AA.simu.win = 97;
            let result = Season.getBestOppo([OPPO_A, OPPO_AA, OPPO_A]);
            expect(result.chosenIndex).toBe(1);
            expect(result.numberOfReds).toBe(0);

            const OPPO_AB = { ...OPPO_A };
            OPPO_AB.simu = { ...OPPO_A.simu };
            OPPO_AB.simu.win = 98;
            result = Season.getBestOppo([OPPO_A, OPPO_AA, OPPO_AB]);
            expect(result.chosenIndex).toBe(2);
            expect(result.numberOfReds).toBe(0);
        });


        it("same green flag but better mojo and then better gains", function () {
            const OPPO_AA = { ...OPPO_A };
            OPPO_AA.mojo = 22;
            let result = Season.getBestOppo([OPPO_A, OPPO_AA, OPPO_A]);
            expect(result.chosenIndex).toBe(1);
            expect(result.numberOfReds).toBe(0);

            const OPPO_AB = { ...OPPO_A };
            OPPO_AB.mojo = 22;
            OPPO_AB.aff = 10;
            result = Season.getBestOppo([OPPO_A, OPPO_AA, OPPO_AB]);
            expect(result.chosenIndex).toBe(2);
            expect(result.numberOfReds).toBe(0);

            result = Season.getBestOppo([OPPO_A, OPPO_AB, OPPO_AA]);
            expect(result.chosenIndex).toBe(1);
        });

        it("same green flag but better gains and then better mojo", function () {
            const OPPO_AA = { ...OPPO_A };
            OPPO_AA.aff = 10;

            const OPPO_AB = { ...OPPO_A };
            OPPO_AB.mojo = 22;
            const result = Season.getBestOppo([OPPO_A, OPPO_AA, OPPO_AB]);
            expect(result.chosenIndex).toBe(2);
            expect(result.numberOfReds).toBe(0);
        });
    });

    describe("getBestOppo end season", function () {
        beforeEach(() => {
            mockSeasonTierLevel(64);
        });

        it("same green flag but better gains and then better mojo", function () {
            const OPPO_AA = { ...OPPO_A };
            OPPO_AA.aff = 10;

            const OPPO_AB = { ...OPPO_A };
            OPPO_AB.mojo = 22;
            const result = Season.getBestOppo([OPPO_A, OPPO_AA, OPPO_AB]);
            expect(result.chosenIndex).toBe(2);
            expect(result.numberOfReds).toBe(0);
        });

        it("same green flag same mojo same gains but better score", function () {
            const OPPO_AA = { ...OPPO_A };
            OPPO_AA.simu = { ...OPPO_A.simu };
            OPPO_AA.mojo = 25
            OPPO_AA.simu.win = 97;
            let result = Season.getBestOppo([OPPO_A, OPPO_AA, OPPO_A]);
            expect(result.chosenIndex).toBe(1);
            expect(result.numberOfReds).toBe(0);

            const OPPO_AB = { ...OPPO_A };
            OPPO_AB.simu = { ...OPPO_A.simu };
            OPPO_AA.mojo = 5
            OPPO_AB.simu.win = 98;
            result = Season.getBestOppo([OPPO_A, OPPO_AA, OPPO_AB]);
            expect(result.chosenIndex).toBe(2);
            expect(result.numberOfReds).toBe(0);
        });
    });

    /**
     * Low points (#1360): the flag order stays as it is -- the script still
     * only picks a fight it can win -- and the mojo tie-break turns around.
     * Each test pins the same case with the switch off, so a change that
     * moved the whole selection instead of the tie-break shows up here.
     */
    describe("getBestOppo prefer low mojo", function () {

        // The suite shares one localStorage, so a switch left on here would
        // decide the tests that follow.
        beforeEach(() => {
            MockHelper.mockSetting('autoSeasonPreferLowMojo', 'false');
        });
        afterEach(() => {
            localStorage.removeItem(HHStoredVarPrefixKey + SK.autoSeasonPreferLowMojo);
        });

        it("takes the green opponent worth the fewest mojo", function () {
            const OPPO_MORE = { ...OPPO_A };
            OPPO_MORE.mojo = 22;
            const OPPO_LESS = { ...OPPO_A };
            OPPO_LESS.mojo = 18;

            let result = Season.getBestOppo([OPPO_A, OPPO_MORE, OPPO_LESS]);
            expect(result.chosenIndex).toBe(1);

            MockHelper.mockSetting('autoSeasonPreferLowMojo', 'true');
            result = Season.getBestOppo([OPPO_A, OPPO_MORE, OPPO_LESS]);
            expect(result.chosenIndex).toBe(2);
            expect(result.numberOfReds).toBe(0);
        });

        it("still prefers a green opponent over an orange one", function () {
            // OPPO_B (orange) pays less than every green one on offer. The
            // flag order has to keep it out of the choice all the same.
            MockHelper.mockSetting('autoSeasonPreferLowMojo', 'true');
            const result = Season.getBestOppo([OPPO_A, OPPO_B, OPPO_C]);
            expect(result.chosenIndex).toBe(0);
            expect(result.numberOfReds).toBe(1);
        });

        it("keeps gains as the tie-break below mojo", function () {
            const OPPO_LESS = { ...OPPO_A };
            OPPO_LESS.mojo = 18;
            const OPPO_LESS_RICHER = { ...OPPO_A };
            OPPO_LESS_RICHER.mojo = 18;
            OPPO_LESS_RICHER.aff = 10;

            MockHelper.mockSetting('autoSeasonPreferLowMojo', 'true');
            const result = Season.getBestOppo([OPPO_A, OPPO_LESS, OPPO_LESS_RICHER]);
            expect(result.chosenIndex).toBe(2);
        });

        it("takes the red opponent worth the fewest mojo when all three are red", function () {
            const OPPO_MORE = { ...OPPO_C };
            OPPO_MORE.mojo = 12;
            const OPPO_LESS = { ...OPPO_C };
            OPPO_LESS.mojo = 8;

            let result = Season.getBestOppo([OPPO_C, OPPO_MORE, OPPO_LESS]);
            expect(result.chosenIndex).toBe(1);

            MockHelper.mockSetting('autoSeasonPreferLowMojo', 'true');
            result = Season.getBestOppo([OPPO_C, OPPO_MORE, OPPO_LESS]);
            expect(result.chosenIndex).toBe(2);
            expect(result.numberOfReds).toBe(3);
        });

        it("takes the fewest mojo behind the win chance after the season ended", function () {
            mockSeasonTierLevel(64);
            const OPPO_MORE = { ...OPPO_A };
            OPPO_MORE.mojo = 22;
            const OPPO_LESS = { ...OPPO_A };
            OPPO_LESS.mojo = 18;
            const OPPO_SAFER = { ...OPPO_A };
            OPPO_SAFER.mojo = 22;
            OPPO_SAFER.simu = { ...OPPO_A.simu };
            OPPO_SAFER.simu.win = 99;

            MockHelper.mockSetting('autoSeasonPreferLowMojo', 'true');
            let result = Season.getBestOppo([OPPO_MORE, OPPO_LESS, OPPO_SAFER]);
            expect(result.chosenIndex).toBe(2);

            result = Season.getBestOppo([OPPO_MORE, OPPO_LESS, OPPO_A]);
            expect(result.chosenIndex).toBe(1);
        });

        it("does not wait for more mojo while low points is on", function () {
            // Skip low mojo would hold out for the very opponents low points
            // is after, so it stands down instead of blocking every round.
            mockSeasonTierLevel(20);
            MockHelper.mockSetting('autoSeasonSkipLowMojo', 'true');
            const OPPO_POOR = { ...OPPO_A };
            OPPO_POOR.mojo = 5;

            let result = Season.getBestOppo([OPPO_POOR, OPPO_POOR, OPPO_POOR]);
            expect(result.chosenIndex).toBe(-1);

            MockHelper.mockSetting('autoSeasonPreferLowMojo', 'true');
            result = Season.getBestOppo([OPPO_POOR, OPPO_POOR, OPPO_POOR]);
            expect(result.chosenIndex).toBe(0);
        });
    });

    describe("getBestOppo low mojo", function () {
        it("low mojo", function () {
            mockSeasonTierLevel(20);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonSkipLowMojo", "true");
            const OPPO_AA = { ...OPPO_A };
            OPPO_AA.mojo = 5;
            const result = Season.getBestOppo([OPPO_AA, OPPO_AA, OPPO_AA]);
            expect(result.chosenIndex).toBe(-1);
        });

        it("low mojo and end season", function () {
            mockSeasonTierLevel(64);
            const OPPO_AA = { ...OPPO_A };
            OPPO_AA.mojo = 5;
            const result = Season.getBestOppo([OPPO_AA, OPPO_AA, OPPO_AA]);
            expect(result.chosenIndex).toBe(0);
        });

        it("low mojo, energy max", function () {
            mockSeasonTierLevel(20);
            const OPPO_AA = { ...OPPO_A };
            OPPO_AA.mojo = 5;
            const result = Season.getBestOppo([OPPO_AA, OPPO_AA, OPPO_AA], 10);
            expect(result.chosenIndex).toBe(0);
        });

        it("low mojo, energy not max with cards", function () {
            mockSeasonTierLevel(20);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonSkipLowMojo", "true");
            const OPPO_AA = { ...OPPO_A };
            OPPO_AA.mojo = 5;
            const result = Season.getBestOppo([OPPO_AA, OPPO_AA, OPPO_AA], 11, 15);
            expect(result.chosenIndex).toBe(-1);
        });

        it("low mojo, energy max with cards", function () {
            mockSeasonTierLevel(20);
            const OPPO_AA = { ...OPPO_A };
            OPPO_AA.mojo = 5;
            const result = Season.getBestOppo([OPPO_AA, OPPO_AA, OPPO_AA], 15, 15);
            expect(result.chosenIndex).toBe(0);
        });
    });

    describe("isTimeToFight", function () {
        beforeEach(() => {
            MockHelper.mockHeroLevel(500);
            MockHelper.mockEnergiesKiss(1, 10);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonThreshold", "1");
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonRunThreshold", "8");

            jest.spyOn(ParanoiaService, "checkParanoiaSpendings").mockReturnValue(-1);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonBoostedOnly", "false");
            setTimer('nextSeasonTime', -1); // Reset any existing timer
        });

        it("should return true if energy is above the threshold and timer has expired", function () {
            MockHelper.mockEnergiesKiss(9, 10);
            setTimer('nextSeasonTime', -1); // Ensure the timer is expired

            const result = Season.isTimeToFight();

            expect(result).toBeTruthy();
        });

        it("should return false if energy is below the threshold", function () {
            MockHelper.mockEnergiesKiss(5, 10);
            setTimer('nextSeasonTime', -1); // Ensure the timer is expired

            const result = Season.isTimeToFight();

            expect(result).toBeFalsy();
        });

        it("should return false if the timer for the next fight is still active", function () {
            MockHelper.mockEnergiesKiss(10, 10);
            setTimer('nextSeasonTime', 10); // Set a timer for 10 seconds

            const result = Season.isTimeToFight();

            expect(result).toBeFalsy();
        });

        it("should return true if paranoia spending is enabled and there is energy below threashold", function () {
            MockHelper.mockEnergiesKiss(5, 10);
            jest.spyOn(ParanoiaService, "checkParanoiaSpendings").mockReturnValue(1);

            const result = Season.isTimeToFight();

            expect(result).toBeTruthy();
        });

        it("should return true if paranoia spending is enabled and there is energy above threashold", function () {
            MockHelper.mockEnergiesKiss(9, 10);
            jest.spyOn(ParanoiaService, "checkParanoiaSpendings").mockReturnValue(1);

            const result = Season.isTimeToFight();

            expect(result).toBeTruthy();
        });

        it("should return false if boosters are required but not equipped", function () {
            MockHelper.mockEnergiesKiss(9, 10);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonBoostedOnly", "true");
            jest.spyOn(Booster, "haveBoosterEquiped").mockReturnValue(false);

            const result = Season.isTimeToFight();

            expect(result).toBeFalsy();
        });

        it("should return false if boosters are required but not equipped and energie above max", function () {
            MockHelper.mockEnergiesKiss(11, 10);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonBoostedOnly", "true");
            jest.spyOn(Booster, "haveBoosterEquiped").mockReturnValue(false);

            const result = Season.isTimeToFight();

            expect(result).toBeFalsy();
        });

        it("should return true if boosters are required and equipped", function () {
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonBoostedOnly", "true");
            MockHelper.mockEnergiesKiss(9, 10);
            jest.spyOn(Booster, "haveBoosterEquiped").mockReturnValue(true);

            const result = Season.isTimeToFight();

            expect(result).toBeTruthy();
        });
    });

    // isBlockedOnlyByMissingBooster: covered spy-free by Season.pure.spec.ts
    // (same six cases). The adapter wrapper was removed in the spec triage
    // (2026-08).

    describe("run defensive wall (issue #1722)", function () {
        beforeEach(() => {
            MockHelper.mockHeroLevel(500);
            MockHelper.mockPage('season_arena', '<div id="tier_indicator">1</div>');
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonMaxTier", "false");
            setTimer('nextSeasonTime', -1);
        });

        it("retries shortly instead of arming the 30 min timer when the sim returns undefined", async () => {
            jest.spyOn(Season, 'stylesBattle').mockImplementation(() => {});
            jest.spyOn(Season, 'moduleSimSeasonBattle').mockResolvedValue(undefined as any);

            const result = await Season.run();

            expect(result).toBe(false);
            const left = getSecondsLeft('nextSeasonTime');
            expect(left).toBeGreaterThan(0);
            expect(left).toBeLessThanOrEqual(11);

            jest.restoreAllMocks();
        });
    });

    describe("isRewardSkinOnly", function () {
        const LOVE_RAIDS_KEY = HHStoredVarPrefixKey + TK.loveRaids;

        function storeSeasonRaid(id_girl: number, girl_shards: number) {
            sessionStorage.setItem(LOVE_RAIDS_KEY, JSON.stringify([
                { id_girl, girl_shards, raid_module_type: 'season' },
                { id_girl: 111, girl_shards: 0, trollId: 4, raid_module_type: 'troll' }
            ]));
        }

        beforeEach(() => {
            sessionStorage.removeItem(LOVE_RAIDS_KEY);
        });

        it("returns false when no data-rewards are given", function () {
            storeSeasonRaid(4444, 100);
            expect(Season.isRewardSkinOnly([])).toBe(false);
        });

        it("returns false for malformed data-rewards", function () {
            storeSeasonRaid(4444, 100);
            expect(Season.isRewardSkinOnly(['not json'])).toBe(false);
        });

        it("returns false when no season raid data is stored", function () {
            expect(Season.isRewardSkinOnly(['[{"id_girl":4444}]'])).toBe(false);
        });

        it("returns false while the raid girl still misses shards", function () {
            storeSeasonRaid(4444, 50);
            expect(Season.isRewardSkinOnly(['[{"id_girl":4444}]'])).toBe(false);
        });

        it("returns false for a reward girl unknown to the raid data", function () {
            storeSeasonRaid(4444, 100);
            expect(Season.isRewardSkinOnly(['[{"id_girl":5555}]'])).toBe(false);
        });

        it("returns true when the reward girl is fully owned", function () {
            storeSeasonRaid(4444, 100);
            expect(Season.isRewardSkinOnly(['[{"id_girl":4444}]'])).toBe(true);
        });

        it("returns false when only one of two reward girls is fully owned", function () {
            sessionStorage.setItem(LOVE_RAIDS_KEY, JSON.stringify([
                { id_girl: 4444, girl_shards: 100, raid_module_type: 'season' },
                { id_girl: 5555, girl_shards: 20, raid_module_type: 'season' }
            ]));
            expect(Season.isRewardSkinOnly(['[{"id_girl":4444}]', '[{"id_girl":5555}]'])).toBe(false);
        });
    });

    describe("run season focus (issue #1793)", function () {
        const FOCUS_KEY = HHStoredVarPrefixKey + SK.autoSeasonFocus;
        const LOVE_RAIDS_KEY = HHStoredVarPrefixKey + TK.loveRaids;
        const CHOSEN_ID = 123;

        function opponentHtml(girlRewardSlot: string) {
            return '<div class="season_arena_opponent_container" data-opponent="' + CHOSEN_ID + '">'
                + girlRewardSlot
                + '<div class="opponent_perform_button_container"><a href="/season-battle.html?id_opponent=' + CHOSEN_ID + '">Fight</a></div>'
                + '<div class="personal_info"><div class="player-name">OPPO_A</div></div>'
                + '</div>';
        }
        const GIRL_SLOT = '<div class="slot girl_ico" data-rewards=\'[{"id_girl":4444}]\'></div>';

        function mockArena(girlRewardSlot: string) {
            MockHelper.mockPage('season_arena', '<div id="tier_indicator">1</div>' + opponentHtml(girlRewardSlot));
        }

        let navSpy: jest.SpyInstance;

        beforeEach(() => {
            MockHelper.mockHeroLevel(500);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonMaxTier", "false");
            localStorage.removeItem(HHStoredVarPrefixKey + "Setting_autoSeasonMaxTierNb");
            localStorage.removeItem(HHStoredVarPrefixKey + "Setting_autoSeasonMaxTierHard");
            sessionStorage.removeItem(LOVE_RAIDS_KEY);
            localStorage.removeItem(FOCUS_KEY);
            setTimer('nextSeasonTime', -1);
            jest.spyOn(Season, 'stylesBattle').mockImplementation(() => {});
            jest.spyOn(Season, 'moduleSimSeasonBattle').mockResolvedValue(CHOSEN_ID as any);
            navSpy = jest.spyOn(PageNavigationService, 'safeNavigateHref').mockImplementation(() => true);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("focus off fights an opponent without girl reward", async () => {
            localStorage.setItem(FOCUS_KEY, "off");
            mockArena('');

            const result = await Season.run();

            expect(result).toBe(true);
            expect(navSpy).toHaveBeenCalled();
        });

        it("girl focus skips an opponent without girl reward", async () => {
            localStorage.setItem(FOCUS_KEY, "girl");
            mockArena('');

            const result = await Season.run();

            expect(result).toBe(false);
            expect(navSpy).not.toHaveBeenCalled();
            const left = getSecondsLeft('nextSeasonTime');
            expect(left).toBeGreaterThan(29 * 60);
        });

        it("girl focus fights while the girl is not fully owned", async () => {
            localStorage.setItem(FOCUS_KEY, "girl");
            sessionStorage.setItem(LOVE_RAIDS_KEY, JSON.stringify([
                { id_girl: 4444, girl_shards: 50, raid_module_type: 'season' }
            ]));
            mockArena(GIRL_SLOT);

            const result = await Season.run();

            expect(result).toBe(true);
            expect(navSpy).toHaveBeenCalled();
        });

        it("girl focus skips a skin-only reward (girl fully owned)", async () => {
            localStorage.setItem(FOCUS_KEY, "girl");
            sessionStorage.setItem(LOVE_RAIDS_KEY, JSON.stringify([
                { id_girl: 4444, girl_shards: 100, raid_module_type: 'season' }
            ]));
            mockArena(GIRL_SLOT);

            const result = await Season.run();

            expect(result).toBe(false);
            expect(navSpy).not.toHaveBeenCalled();
            const left = getSecondsLeft('nextSeasonTime');
            expect(left).toBeGreaterThan(29 * 60);
        });

        it("girl focus fights when no raid data is stored (fallback)", async () => {
            localStorage.setItem(FOCUS_KEY, "girl");
            mockArena(GIRL_SLOT);

            const result = await Season.run();

            expect(result).toBe(true);
            expect(navSpy).toHaveBeenCalled();
        });

        it("girlAndSkin focus fights a skin-only reward", async () => {
            localStorage.setItem(FOCUS_KEY, "girlAndSkin");
            sessionStorage.setItem(LOVE_RAIDS_KEY, JSON.stringify([
                { id_girl: 4444, girl_shards: 100, raid_module_type: 'season' }
            ]));
            mockArena(GIRL_SLOT);

            const result = await Season.run();

            expect(result).toBe(true);
            expect(navSpy).toHaveBeenCalled();
        });

        it("focus off stops at max tier without fighting", async () => {
            localStorage.setItem(FOCUS_KEY, "off");
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonMaxTier", "true");
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonMaxTierNb", "1");
            mockArena(GIRL_SLOT);

            const result = await Season.run();

            expect(result).toBe(true);
            expect(navSpy).not.toHaveBeenCalled();
        });

        it("girl focus with MT hard stops at max tier even when a girl can be won", async () => {
            localStorage.setItem(FOCUS_KEY, "girl");
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonMaxTier", "true");
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonMaxTierNb", "1");
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonMaxTierHard", "true");
            sessionStorage.setItem(LOVE_RAIDS_KEY, JSON.stringify([
                { id_girl: 4444, girl_shards: 50, raid_module_type: 'season' }
            ]));
            mockArena(GIRL_SLOT);

            const result = await Season.run();

            expect(result).toBe(true);
            expect(navSpy).not.toHaveBeenCalled();
        });

        it("girl focus without MT hard keeps fighting past max tier for a girl", async () => {
            localStorage.setItem(FOCUS_KEY, "girl");
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonMaxTier", "true");
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonMaxTierNb", "1");
            sessionStorage.setItem(LOVE_RAIDS_KEY, JSON.stringify([
                { id_girl: 4444, girl_shards: 50, raid_module_type: 'season' }
            ]));
            mockArena(GIRL_SLOT);

            const result = await Season.run();

            expect(result).toBe(true);
            expect(navSpy).toHaveBeenCalled();
        });

        it("girl focus without MT hard skips past max tier when only the skin remains", async () => {
            localStorage.setItem(FOCUS_KEY, "girl");
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonMaxTier", "true");
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonMaxTierNb", "1");
            sessionStorage.setItem(LOVE_RAIDS_KEY, JSON.stringify([
                { id_girl: 4444, girl_shards: 100, raid_module_type: 'season' }
            ]));
            mockArena(GIRL_SLOT);

            const result = await Season.run();

            expect(result).toBe(false);
            expect(navSpy).not.toHaveBeenCalled();
        });

        it("girl focus without MT hard climbs below max tier without a girl reward", async () => {
            localStorage.setItem(FOCUS_KEY, "girl");
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonMaxTier", "true");
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonMaxTierNb", "50");
            mockArena('');

            const result = await Season.run();

            expect(result).toBe(true);
            expect(navSpy).toHaveBeenCalled();
        });

        it("girl focus with MT hard skips below max tier without a girl reward", async () => {
            localStorage.setItem(FOCUS_KEY, "girl");
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonMaxTier", "true");
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonMaxTierNb", "50");
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonMaxTierHard", "true");
            mockArena('');

            const result = await Season.run();

            expect(result).toBe(false);
            expect(navSpy).not.toHaveBeenCalled();
        });
    });
});