import { setTimer } from "../../src/Helper/TimerHelper";
import { Booster } from '../../src/Module/Booster';
import { PentaDrill } from '../../src/Module/PentaDrill';
import { ParanoiaService } from "../../src/Service/ParanoiaService";
import { HHStoredVarPrefixKey } from "../../src/config/HHStoredVars";
import { MockHelper } from "../testHelpers/MockHelpers";

describe("PentaDrill event", function () {

    beforeEach(() => {
        MockHelper.mockDomain();
    });

    describe("isTimeToFight", function () {
        beforeEach(() => {
            MockHelper.mockHeroLevel(500);
            MockHelper.mockEnergiesDrill(1, 10);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoPentaDrillThreshold", "1");
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoPentaDrillRunThreshold", "8");

            jest.spyOn(ParanoiaService, "checkParanoiaSpendings").mockReturnValue(-1);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoPentaDrillBoostedOnly", "false");
            setTimer('nextPentaDrillTime', -1); // Reset any existing timer
        });

        it("should return true if energy is above the threshold and timer has expired", function () {
            MockHelper.mockEnergiesDrill(9, 10);
            setTimer('nextPentaDrillTime', -1); // Ensure the timer is expired

            const result = PentaDrill.isTimeToFight();

            expect(result).toBeTruthy();
        });

        it("should return false if energy is below the threshold", function () {
            MockHelper.mockEnergiesDrill(5, 10);
            setTimer('nextPentaDrillTime', -1); // Ensure the timer is expired

            const result = PentaDrill.isTimeToFight();

            expect(result).toBeFalsy();
        });

        it("should return false if the timer for the next fight is still active", function () {
            MockHelper.mockEnergiesDrill(10, 10);
            setTimer('nextPentaDrillTime', 10); // Set a timer for 10 seconds

            const result = PentaDrill.isTimeToFight();

            expect(result).toBeFalsy();
        });

        it("should return true if paranoia spending is enabled and there is energy below threashold", function () {
            MockHelper.mockEnergiesDrill(5, 10);
            jest.spyOn(ParanoiaService, "checkParanoiaSpendings").mockReturnValue(1);

            const result = PentaDrill.isTimeToFight();

            expect(result).toBeTruthy();
        });

        it("should return true if paranoia spending is enabled and there is energy above threashold", function () {
            MockHelper.mockEnergiesDrill(9, 10);
            jest.spyOn(ParanoiaService, "checkParanoiaSpendings").mockReturnValue(1);

            const result = PentaDrill.isTimeToFight();

            expect(result).toBeTruthy();
        });

        it("should return false if boosters are required but not equipped", function () {
            MockHelper.mockEnergiesDrill(9, 10);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoPentaDrillBoostedOnly", "true");
            jest.spyOn(Booster, "haveBoosterEquiped").mockReturnValue(false);

            const result = PentaDrill.isTimeToFight();

            expect(result).toBeFalsy();
        });

        it("should return false if boosters are required but not equipped and energie above max", function () {
            MockHelper.mockEnergiesDrill(11, 10);
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoPentaDrillBoostedOnly", "true");
            jest.spyOn(Booster, "haveBoosterEquiped").mockReturnValue(false);

            const result = PentaDrill.isTimeToFight();

            expect(result).toBeFalsy();
        });

        it("should return true if boosters are required and equipped", function () {
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_autoPentaDrillBoostedOnly", "true");
            MockHelper.mockEnergiesDrill(9, 10);
            jest.spyOn(Booster, "haveBoosterEquiped").mockReturnValue(true);

            const result = PentaDrill.isTimeToFight();

            expect(result).toBeTruthy();
        });
    });
});