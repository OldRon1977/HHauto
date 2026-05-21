import {
    addNutakuSession,
    gotoPage,
    safeReload,
    safeNavigateHref,
    _resetPageNavigationServiceForTests,
} from "../../src/Service/PageNavigationService";

jest.mock("../../src/Helper/PageHelper", () => ({
    getPage: jest.fn(() => "/test"),
}));

jest.mock("../../src/Helper/StorageHelper", () => ({
    setStoredValue: jest.fn(),
    getStoredValue: jest.fn(() => null),
}));

jest.mock("../../src/Helper/TimerHelper", () => ({
    setTimer: jest.fn(),
    getTimer: jest.fn(() => 0),
}));

jest.mock("../../src/Service/AjaxTracker", () => ({
    waitForAjaxIdle: jest.fn(() => Promise.resolve(true)),
    AJAX_IDLE_TIMEOUT_MS: 5000,
    AJAX_IDLE_SETTLE_MS: 100,
}));

const PAGE_VAR_LOOKUP: Record<string, string | undefined> = {
    pagesIDHome: "home",
    pagesURLHome: "/home.html",
};

jest.mock("../../src/Helper/ConfigHelper", () => ({
    ConfigHelper: {
        getHHScriptVars: jest.fn((id: string) => {
            if (id in PAGE_VAR_LOOKUP) {
                return PAGE_VAR_LOOKUP[id];
            }
            return `MOCK_${id}`;
        }),
    },
}));

describe("PageNavigationService", function () {

    let originalLocation: PropertyDescriptor | undefined;

    beforeAll(() => {
        originalLocation = Object.getOwnPropertyDescriptor(window, "location");
    });

    beforeEach(() => {
        _resetPageNavigationServiceForTests();
    });

    afterEach(() => {
        unsafeWindow.hh_nutaku = undefined;
        if (originalLocation) {
            Object.defineProperty(window, "location", originalLocation);
        }
    });

    function mockLocation(props: Partial<Location>): void {
        Object.defineProperty(window, "location", {
            configurable: true,
            value: { ...originalLocation?.value, ...props },
        });
    }

    describe("addNutakuSession", function () {

        it("should add 'sess' parameter to a URL string if Nutaku session exists", function () {
            const originalUrl = "/some/path";
            const session = "test-session";
            mockLocation({ search: `?sess=${session}` });
            unsafeWindow.hh_nutaku = {};

            const result = addNutakuSession(originalUrl);

            expect(result).toContain(`sess=${session}`);
        });

        it("should not modify the URL string if 'sess' parameter already exists", function () {
            const originalUrl = "/some/path?sess=existing-session";
            const session = "test-session";
            mockLocation({ search: `?sess=${session}` });
            unsafeWindow.hh_nutaku = {};

            const result = addNutakuSession(originalUrl);

            expect(result).toBe(originalUrl);
        });

        it("should add 'sess' parameter to an object if Nutaku session exists", function () {
            const originalObject: Record<string, unknown> = { key: "value" };
            const session = "test-session";
            mockLocation({ search: `?sess=${session}` });
            unsafeWindow.hh_nutaku = {};

            const result = addNutakuSession(originalObject);

            expect(result).toHaveProperty("sess", session);
        });

        it("should not modify the object if 'sess' parameter already exists", function () {
            const originalObject: Record<string, unknown> = { key: "value", sess: "existing-session" };
            const session = "test-session";
            mockLocation({ search: `?sess=${session}` });
            unsafeWindow.hh_nutaku = {};

            const result = addNutakuSession(originalObject);

            expect(result).toEqual(originalObject);
        });

        it("should log an error if Nutaku is detected but no session is found", function () {
            const originalUrl = "/some/path";
            mockLocation({ search: "" });
            unsafeWindow.hh_nutaku = {};

            const logSpy = jest.spyOn(console, "log").mockImplementation();

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

    describe("navigation mutex (I6 / I11)", function () {

        beforeEach(() => {
            mockLocation({ origin: "https://example.com", search: "" });
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("safeReload returns true on first call and false on subsequent calls within the same tick", function () {
            const first = safeReload(0);
            const second = safeReload(0);

            expect(first).toBe(true);
            expect(second).toBe(false);
        });

        it("safeNavigateHref returns true on first call and false on subsequent calls within the same tick", function () {
            const first = safeNavigateHref("/foo", 0);
            const second = safeNavigateHref("/bar", 0);

            expect(first).toBe(true);
            expect(second).toBe(false);
        });

        it("_resetPageNavigationServiceForTests releases the mutex", function () {
            safeReload(0);

            const blocked = safeReload(0);
            expect(blocked).toBe(false);

            _resetPageNavigationServiceForTests();

            const unblocked = safeReload(0);
            expect(unblocked).toBe(true);
        });
    });

    describe("regex passthrough (I9)", function () {

        beforeEach(() => {
            mockLocation({ origin: "https://example.com", search: "" });
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("accepts champion battle paths", function () {
            const result = gotoPage("/champions/3");
            expect(result).not.toBe(false);
        });

        it("accepts character detail paths", function () {
            const result = gotoPage("/characters/12345");
            expect(result).not.toBe(false);
        });

        it("accepts girl detail paths", function () {
            const result = gotoPage("/girl/42");
            expect(result).not.toBe(false);
        });

        it("accepts quest paths with query parameters", function () {
            const result = gotoPage("/quest/100?foo=bar");
            expect(result).not.toBe(false);
        });
    });

    describe("default branch and return value (I1 / I2 / N7)", function () {

        beforeEach(() => {
            mockLocation({ origin: "https://example.com", search: "" });
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("returns false for unknown page-id without scheduling a reload", function () {
            const result = gotoPage("totally-unknown-page");
            expect(result).toBe(false);
            // No reload was scheduled: advancing all timers must not trigger a navigation.
            jest.runAllTimers();
        });

        it("returns true when the resolver maps the page-id to a URL", function () {
            const result = gotoPage("home");
            expect(result).toBe(true);
        });

        it("returns true when a regex passthrough path resolves", function () {
            const result = gotoPage("/champions/3");
            expect(result).toBe(true);
        });

        it("does not resolve the legacy 'quest' page-id (Cluster C: callers resolve quest URLs themselves)", function () {
            // Cluster C of the page-nav refactor moved Quest URL resolution
            // out of the service. The service no longer knows about the
            // Quest module, so a literal 'quest' page-id falls through to
            // the regex-passthrough check, finds no match, and returns false.
            const result = gotoPage("quest");
            expect(result).toBe(false);
        });
    });
});
