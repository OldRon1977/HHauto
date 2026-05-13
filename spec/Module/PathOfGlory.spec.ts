import { PathOfGlory } from '../../src/Module/Events/PathOfGlory';
import { MockHelper } from "../testHelpers/MockHelpers";

describe("PathOfGlory", function () {
    describe("styles", function () {
        it("default", function () {
            expect(() => PathOfGlory.styles()).not.toThrow()
        });
    });

    describe("isEnabled", function () {
        it("default", function () {
            expect(PathOfGlory.isEnabled()).toBeFalsy();
        });

        it("lower level", function () {
            MockHelper.mockHeroLevel(29);
            expect(PathOfGlory.isEnabled()).toBeFalsy();
        });

        it("min level", function () {
            MockHelper.mockHeroLevel(30);
            expect(PathOfGlory.isEnabled()).toBeTruthy();
        });

        it("higher level", function () {
            MockHelper.mockHeroLevel(500);
            expect(PathOfGlory.isEnabled()).toBeTruthy();
        });
    });
});