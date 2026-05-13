import { SultryMysteries } from '../../../src/Module/Events/SultryMysteries';
import { MockHelper } from "../../testHelpers/MockHelpers";

describe("SultryMysteries event", function () {
    beforeEach(() => {
        MockHelper.mockDomain();
    });

    describe("isEnabled", function () {
        it("default", function () {
            expect(SultryMysteries.isEnabled()).toBeFalsy();
        });

        it("lower level", function () {
            MockHelper.mockHeroLevel(5);
            expect(SultryMysteries.isEnabled()).toBeFalsy();
        });

        it("higher level", function () {
            MockHelper.mockHeroLevel(500);
            expect(SultryMysteries.isEnabled()).toBeTruthy();
        });
    });

});