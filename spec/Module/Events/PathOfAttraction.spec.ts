import { PathOfAttraction } from '../../../src/Module/Events/PathOfAttraction';
import { HHStoredVarPrefixKey } from "../../../src/config/HHStoredVars";

describe("PathOfAttraction", function () {
    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    describe("styles", function () {
        it("default", function () {
            expect(() => PathOfAttraction.styles()).not.toThrow()
        });
        it("PoAMaskRewards", function () {
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusEventMythicSandalWood", 'true');
            expect(() => PathOfAttraction.styles()).not.toThrow()
        });
        it("showRewardsRecap", function () {
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusEventMythicSandalWood", 'true');
            expect(() => PathOfAttraction.styles()).not.toThrow()
        });
    });
});