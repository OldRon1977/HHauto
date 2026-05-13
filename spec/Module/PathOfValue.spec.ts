import { PathOfValue } from '../../src/Module/Events/PathOfValue';
import { MockHelper } from "../testHelpers/MockHelpers";

describe("PathOfValue", function () {
    describe("styles", function () {
        it("default", function () {
            expect(() => PathOfValue.styles()).not.toThrow()
        });
    });

    describe("isEnabled", function () {
        it("default", function () {
            expect(PathOfValue.isEnabled()).toBeFalsy();
        });

        it("lower level", function () {
            MockHelper.mockHeroLevel(29);
            expect(PathOfValue.isEnabled()).toBeFalsy();
        });

        it("min level", function () {
            MockHelper.mockHeroLevel(30);
            expect(PathOfValue.isEnabled()).toBeTruthy();
        });

        it("higher level", function () {
            MockHelper.mockHeroLevel(500);
            expect(PathOfValue.isEnabled()).toBeTruthy();
        });
    });
});