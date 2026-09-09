import { PathOfGlory } from "../../../src/Module/Events/PathOfGlory";
import { PathOfValue } from "../../../src/Module/Events/PathOfValue";
import { ConfigHelper } from "../../../src/Helper/ConfigHelper";
import { Timers, setTimer } from "../../../src/Helper/TimerHelper";
import { HHStoredVarPrefixKey } from "../../../src/config/HHStoredVars";
import { SK } from "../../../src/config/StorageKeys";
import { MockHelper } from "../../testHelpers/MockHelpers";
import * as PageHelper from "../../../src/Helper/PageHelper";
import * as LogUtils from "../../../src/Utils/LogUtils";

jest.mock("../../../src/Service/PageNavigationService", () => ({
    gotoPage: jest.fn().mockReturnValue(true),
    safeReload: jest.fn(),
    safeNavigateHref: jest.fn(),
    addNutakuSession: jest.fn((x: unknown) => x),
}));

/**
 * Path of Glory and Path of Valor are the same feature twice: 148 and 150
 * lines that differ in identifiers and, until now, in two decisions.
 *
 * 1. The collect-all gate read `end < limitBeforeEnd` without asking whether
 *    the end was known at all. getSecondsLeft answers 0 both for "no such
 *    timer" and for "already expired", so an unknown remaining time opened
 *    the gate at any distance from the event end -- and collect-all bypasses
 *    the player's own tier filter. This is issue #1846, which Path of
 *    Attraction failed closed on and these two did not.
 *
 * 2. Path of Glory alone let `autoPoGCollectAll` trigger the *routine* round
 *    as well, so two identical switches behaved differently on two identical
 *    features. The tooltip describes the final-window sweep ("collect all
 *    items before end ... configured with Collect all timer"), and both Path
 *    of Valor and Path of Attraction implement that reading.
 *
 * The observable for the collect-all branch is its timer rather than a click:
 * `selectorClaimAllRewards` carries `:visible`, which jsdom cannot evaluate,
 * so the branch takes its else-path and re-arms the timer. Whether the timer
 * moved says exactly whether the branch was entered.
 */
type PathUnderTest = {
    label: string;
    page: string;
    run: () => unknown;
    remainingTimer: string;
    collectAllTimer: string;
    collectSetting: string;
    collectAllSetting: string;
    routineLog: string;
};

const PATHS: PathUnderTest[] = [
    {
        label: 'Path of Glory',
        page: 'pagesIDPoG',
        run: () => PathOfGlory.goAndCollect(),
        remainingTimer: 'PoGRemainingTime',
        collectAllTimer: 'nextPoGCollectAllTime',
        collectSetting: SK.autoPoGCollect,
        collectAllSetting: SK.autoPoGCollectAll,
        routineLog: 'Checking Path of Glory for collectable rewards.',
    },
    {
        label: 'Path of Valor',
        page: 'pagesIDPoV',
        run: () => PathOfValue.goAndCollect(),
        remainingTimer: 'PoVRemainingTime',
        collectAllTimer: 'nextPoVCollectAllTime',
        collectSetting: SK.autoPoVCollect,
        collectAllSetting: SK.autoPoVCollectAll,
        routineLog: 'Checking Path of Valor for collectable rewards.',
    },
];

const HOURS_BEFORE_END = 12;

describe.each(PATHS)("$label -- collecting", (path) => {
    let logged: string[];

    beforeEach(() => {
        MockHelper.mockDomain('www.hentaiheroes.com', '/event.html');
        jest.spyOn(PageHelper, 'getPage')
            .mockReturnValue(ConfigHelper.getHHScriptVars(path.page));
        logged = [];
        jest.spyOn(LogUtils, 'logHHAuto').mockImplementation((...args: unknown[]) => {
            logged.push(String(args[0]));
        });
        localStorage.clear();
        sessionStorage.clear();
        for (const name of Object.keys(Timers)) delete Timers[name];
        // getLimitTimeBeforeEnd reads this as hours.
        localStorage.setItem(HHStoredVarPrefixKey + SK.collectAllTimer, String(HOURS_BEFORE_END));
        // No timer element on the page, so getRemainingTime() leaves whatever
        // each test set -- that is how the three cases below are controlled.
        document.body.innerHTML = '';
    });

    afterEach(() => {
        jest.restoreAllMocks();
        localStorage.clear();
        sessionStorage.clear();
        for (const name of Object.keys(Timers)) delete Timers[name];
        document.body.innerHTML = '';
    });

    const enableCollectAllOnly = () => {
        localStorage.setItem(HHStoredVarPrefixKey + path.collectSetting, 'false');
        localStorage.setItem(HHStoredVarPrefixKey + path.collectAllSetting, 'true');
    };

    describe("the collect-all sweep", () => {
        it("stays shut while the remaining time is unknown (#1846)", () => {
            enableCollectAllOnly();
            // No PoXRemainingTime at all: getSecondsLeft answers 0, which used
            // to satisfy `0 < limitBeforeEnd`.
            expect(Timers[path.remainingTimer]).toBeUndefined();

            path.run();

            expect(Timers[path.collectAllTimer]).toBeUndefined();
        });

        it("opens inside the final window", () => {
            enableCollectAllOnly();
            setTimer(path.remainingTimer, (HOURS_BEFORE_END - 1) * 3600);

            path.run();

            expect(Timers[path.collectAllTimer]).toBeDefined();
        });

        it("stays shut outside the final window", () => {
            enableCollectAllOnly();
            setTimer(path.remainingTimer, (HOURS_BEFORE_END + 24) * 3600);

            path.run();

            expect(Timers[path.collectAllTimer]).toBeUndefined();
        });

        it("stays shut on an expired event, as it did before", () => {
            // getSecondsLeft answers 0 for an expired timer too. Failing
            // closed on 0 covers both readings of it.
            enableCollectAllOnly();
            setTimer(path.remainingTimer, -60);

            path.run();

            expect(Timers[path.collectAllTimer]).toBeUndefined();
        });
    });

    describe("the routine round", () => {
        it("does not run on 'collect all' alone, outside the final window", () => {
            enableCollectAllOnly();
            setTimer(path.remainingTimer, (HOURS_BEFORE_END + 24) * 3600);

            path.run();

            expect(logged).not.toContain(path.routineLog);
        });

        it("runs on the 'collect' switch", () => {
            localStorage.setItem(HHStoredVarPrefixKey + path.collectSetting, 'true');
            localStorage.setItem(HHStoredVarPrefixKey + path.collectAllSetting, 'false');
            setTimer(path.remainingTimer, (HOURS_BEFORE_END + 24) * 3600);

            path.run();

            expect(logged).toContain(path.routineLog);
        });

        it("stays out of the way with both switches off", () => {
            localStorage.setItem(HHStoredVarPrefixKey + path.collectSetting, 'false');
            localStorage.setItem(HHStoredVarPrefixKey + path.collectAllSetting, 'false');
            setTimer(path.remainingTimer, 3600);

            path.run();

            expect(logged).not.toContain(path.routineLog);
            expect(Timers[path.collectAllTimer]).toBeUndefined();
        });
    });
});
