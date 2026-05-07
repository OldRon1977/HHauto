import { addNutakuSession } from "../../src/Service/PageNavigationService";

describe("PageNavigationService", function () {
    
    beforeEach(() => {
    });
    
    afterEach(() => {
        unsafeWindow.hh_nutaku = undefined;
    });

    describe("addNutakuSession", function () {

        it("should add 'sess' parameter to a URL string if Nutaku session exists", function () {
            const originalUrl = "/some/path";
            const session = "test-session";
            Object.defineProperty(window, 'location', {
                value: {
                    search: `?sess=${session}`
                }
            });
            unsafeWindow.hh_nutaku = {}; // Simulate Nutaku environment

            const result = addNutakuSession(originalUrl);

            expect(result).toContain(`sess=${session}`);
        });

        it("should not modify the URL string if 'sess' parameter already exists", function () {
            const originalUrl = "/some/path?sess=existing-session";
            const session = "test-session";
            Object.defineProperty(window, 'location', {
                value: {
                    search: `?sess=${session}`
                }
            });
            unsafeWindow.hh_nutaku = {}; // Simulate Nutaku environment

            const result = addNutakuSession(originalUrl);

            expect(result).toBe(originalUrl);
        });

        it("should add 'sess' parameter to an object if Nutaku session exists", function () {
            const originalObject = { key: "value" };
            const session = "test-session";
            Object.defineProperty(window, 'location', {
                value: {
                    search: `?sess=${session}`
                }
            });
            unsafeWindow.hh_nutaku = {}; // Simulate Nutaku environment

            const result = addNutakuSession(originalObject);

            expect(result).toHaveProperty("sess", session);
        });

        it("should not modify the object if 'sess' parameter already exists", function () {
            const originalObject = { key: "value", sess: "existing-session" };
            const session = "test-session";
            Object.defineProperty(window, 'location', {
                value: {
                    search: `?sess=${session}`
                }
            });
            unsafeWindow.hh_nutaku = {}; // Simulate Nutaku environment

            const result = addNutakuSession(originalObject);

            expect(result).toEqual(originalObject);
        });

        it("should log an error if Nutaku is detected but no session is found", function () {
            const originalUrl = "/some/path";
            Object.defineProperty(window, 'location', {
                value: {
                    search: ""
                }
            });
            unsafeWindow.hh_nutaku = {}; // Simulate Nutaku environment

            const logSpy = jest.spyOn(console, 'log').mockImplementation();

            addNutakuSession(originalUrl);

            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("ERROR Nutaku detected and no session found"));

            logSpy.mockRestore();
        });

        it("should return the original input if Nutaku is not detected", function () {
            const originalUrl = "/some/path";

            const result = addNutakuSession(originalUrl);

            expect(result).toBe(originalUrl);
        });
    });
});