import { SeasonalEvent } from '../../../src/Module/Events/Seasonal';

describe("SeasonalEvent", function () {
    describe("styles", function () {
        it("default", function () {
            expect(() => SeasonalEvent.styles()).not.toThrow()
        });
    });
});