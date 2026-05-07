import { HHStoredVarPrefixKey } from "../../src/config/HHStoredVars";
import { setTimer } from "../../src/Helper/TimerHelper";
import { Booster } from "../../src/Module/Booster";
import { LeagueHelper } from "../../src/Module/League";
import { ParanoiaService } from "../../src/Service/ParanoiaService";
import { MockHelper } from "../testHelpers/MockHelpers";

describe("League", function () {

    beforeEach(() => {
        MockHelper.mockDomain();
        MockHelper.mockHeroLevel(0);
    });

    describe("styles", function () {
        it("default", function () {
            expect(() => LeagueHelper.styles()).not.toThrow()
        });
    });

    describe("get challenge", function () {
        beforeEach(() => {
            MockHelper.mockHeroLevel(500);
            MockHelper.mockEnergiesChallenge(0, 0);
        });

        it("default", function () {
            expect(LeagueHelper.getEnergy()).toBe(0);
            expect(LeagueHelper.getEnergyMax()).toBe(0);
        });

        it("5kiss over 10", function () {
            MockHelper.mockEnergiesChallenge(5, 10);
            expect(LeagueHelper.getEnergy()).toBe(5);
            expect(LeagueHelper.getEnergyMax()).toBe(10);
        });

        it("15kiss over 20", function () {
            MockHelper.mockEnergiesChallenge(15, 20);
            expect(LeagueHelper.getEnergy()).toBe(15);
            expect(LeagueHelper.getEnergyMax()).toBe(20);
        });
    });

    describe("isEnabled", function () {
        it("default", function () {
            expect(LeagueHelper.isEnabled()).toBeFalsy();
        });

        it("lower level", function () {
            MockHelper.mockHeroLevel(5);
            expect(LeagueHelper.isEnabled()).toBeFalsy();
        });

        it("higher level", function () {
            MockHelper.mockHeroLevel(500);
            expect(LeagueHelper.isEnabled()).toBeTruthy();
        });
    });

    describe("isTimeToFight", function () {
        beforeEach(() => {
            MockHelper.mockHeroLevel(500);
            MockHelper.mockEnergiesChallenge(1, 20);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoLeaguesThreshold", "5");
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoLeaguesRunThreshold", "15");

            jest.spyOn(LeagueHelper, "getLeagueEndTime").mockReturnValue(50000); // Default to more than 1 hour left
            jest.spyOn(ParanoiaService, "checkParanoiaSpendings").mockReturnValue(-1);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoLeaguesBoostedOnly", "false");
            setTimer('nextLeaguesTime', -1); // Reset any existing timer
        });

        it("should return true if energy is above the threshold and timer has expired", function () {
            MockHelper.mockEnergiesChallenge(16, 20);
            setTimer('nextLeaguesTime', -1); // Ensure the timer is expired

            const result = LeagueHelper.isTimeToFight();

            expect(result).toBeTruthy();
        });

        it("should return false if energy is below the threshold", function () {
            MockHelper.mockEnergiesChallenge(10, 20);
            setTimer('nextLeaguesTime', -1); // Ensure the timer is expired

            const result = LeagueHelper.isTimeToFight();

            expect(result).toBeFalsy();
        });

        it("should return false if the timer for the next fight is still active", function () {
            MockHelper.mockEnergiesChallenge(20, 20);
            setTimer('nextLeaguesTime', 10); // Set a timer for 10 seconds

            const result = LeagueHelper.isTimeToFight();

            expect(result).toBeFalsy();
        });

        it("should return true if paranoia spending is enabled and there is energy below threashold", function () {
            MockHelper.mockEnergiesChallenge(10, 20);
            jest.spyOn(ParanoiaService, "checkParanoiaSpendings").mockReturnValue(1);

            const result = LeagueHelper.isTimeToFight();

            expect(result).toBeTruthy();
        });

        it("should return true if paranoia spending is enabled and there is energy above threashold", function () {
            MockHelper.mockEnergiesChallenge(16, 20);
            jest.spyOn(ParanoiaService, "checkParanoiaSpendings").mockReturnValue(1);

            const result = LeagueHelper.isTimeToFight();

            expect(result).toBeTruthy();
        });

        it("should return false if boosters are required but not equipped", function () {
            MockHelper.mockEnergiesChallenge(19, 20);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoLeaguesBoostedOnly", "true");
            jest.spyOn(Booster, "haveBoosterEquiped").mockReturnValue(false);

            const result = LeagueHelper.isTimeToFight();

            expect(result).toBeFalsy();
        });

        it("should return false if boosters are required but not equipped and energie above max", function () {
            MockHelper.mockEnergiesChallenge(21, 20);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoLeaguesBoostedOnly", "true");
            jest.spyOn(Booster, "haveBoosterEquiped").mockReturnValue(false);

            const result = LeagueHelper.isTimeToFight();

            expect(result).toBeFalsy();
        });

        it("should return true if boosters are required and equipped", function () {
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoLeaguesBoostedOnly", "true");
            MockHelper.mockEnergiesChallenge(16, 20);
            jest.spyOn(Booster, "haveBoosterEquiped").mockReturnValue(true);

            const result = LeagueHelper.isTimeToFight();

            expect(result).toBeTruthy();
        });

        it("should return false during the last hour of the league if energy is insufficient", function () {
            jest.spyOn(LeagueHelper, "getLeagueEndTime").mockReturnValue(3500); // 1 hour left
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoLeaguesThreshold", "15");
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoLeaguesRunThreshold", "20");
            jest.spyOn(LeagueHelper, "getEnergy").mockReturnValue(0);

            const result = LeagueHelper.isTimeToFight();

            expect(result).toBeFalsy();
        });
    });

});