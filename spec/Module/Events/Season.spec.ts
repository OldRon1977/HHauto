import { setTimer } from "../../../src/Helper/TimerHelper";
import { Booster, Season } from "../../../src/Module/index";
import { ParanoiaService } from "../../../src/Service/ParanoiaService";
import { HHStoredVarPrefixKey } from "../../../src/config/HHStoredVars";
import { BDSMSimu, SeasonOpponent } from "../../../src/model/index";
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

    describe("styles", function () {
        it("default", function () {
            expect(() => Season.styles()).not.toThrow();
            expect(() => Season.stylesBattle()).not.toThrow();
        });
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
            let result = Season.getBestOppo([OPPO_A, OPPO_AA, OPPO_AB]);
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
            let result = Season.getBestOppo([OPPO_A, OPPO_AA, OPPO_AB]);
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

    describe("getBestOppo low mojo", function () {
        it("low mojo", function () {
            mockSeasonTierLevel(20);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonSkipLowMojo", "true");
            const OPPO_AA = { ...OPPO_A };
            OPPO_AA.mojo = 5;
            let result = Season.getBestOppo([OPPO_AA, OPPO_AA, OPPO_AA]);
            expect(result.chosenIndex).toBe(-1);
        });

        it("low mojo and end season", function () {
            mockSeasonTierLevel(64);
            const OPPO_AA = { ...OPPO_A };
            OPPO_AA.mojo = 5;
            let result = Season.getBestOppo([OPPO_AA, OPPO_AA, OPPO_AA]);
            expect(result.chosenIndex).toBe(0);
        });

        it("low mojo, energy max", function () {
            mockSeasonTierLevel(20);
            const OPPO_AA = { ...OPPO_A };
            OPPO_AA.mojo = 5;
            let result = Season.getBestOppo([OPPO_AA, OPPO_AA, OPPO_AA], 10);
            expect(result.chosenIndex).toBe(0);
        });

        it("low mojo, energy not max with cards", function () {
            mockSeasonTierLevel(20);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoSeasonSkipLowMojo", "true");
            const OPPO_AA = { ...OPPO_A };
            OPPO_AA.mojo = 5;
            let result = Season.getBestOppo([OPPO_AA, OPPO_AA, OPPO_AA], 11, 15);
            expect(result.chosenIndex).toBe(-1);
        });

        it("low mojo, energy max with cards", function () {
            mockSeasonTierLevel(20);
            const OPPO_AA = { ...OPPO_A };
            OPPO_AA.mojo = 5;
            let result = Season.getBestOppo([OPPO_AA, OPPO_AA, OPPO_AA], 15, 15);
            expect(result.chosenIndex).toBe(0);
        });
    });

    describe("get kiss", function () {
        beforeEach(() => {
            MockHelper.mockHeroLevel(500);
            MockHelper.mockEnergiesKiss(0,0);
        });

        it("default", function () {
            expect(Season.getEnergy()).toBe(0);
            expect(Season.getEnergyMax()).toBe(0);
        });

        it("5kiss over 10", function () {
            MockHelper.mockEnergiesKiss(5, 10);
            expect(Season.getEnergy()).toBe(5);
            expect(Season.getEnergyMax()).toBe(10);
        });

        it("15kiss over 20", function () {
            MockHelper.mockEnergiesKiss(15, 20);
            expect(Season.getEnergy()).toBe(15);
            expect(Season.getEnergyMax()).toBe(20);
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
});