import { PathOfGlory } from "../../../src/Module/Events/PathOfGlory";
import { PathOfValue } from "../../../src/Module/Events/PathOfValue";
import { Season } from "../../../src/Module/Events/Season";
import { SeasonalEvent } from "../../../src/Module/Events/Seasonal";
import { PentaDrill } from "../../../src/Module/PentaDrill";
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
 * The collect timer and the collect-all timer of an event are both armed for
 * 6 h plus 60-180 s, so they run out within a few minutes of each other. The
 * collect-all gate on the event page also asked for its own timer, so a visit
 * brought by the collect timer seconds earlier skipped the sweep although the
 * event was inside the final window -- and its "nothing to collect" branch
 * then pushed the collect-all timer back 6 h. Read on a user log for Path of
 * Valor: 9 h 34 min left with a 12 h window, collect-all due 21 s later,
 * moved to 6 h later.
 *
 * The claim-all selector carries `:visible`, which jsdom cannot evaluate, so
 * it is replaced by a plain id here and the sweep is read from its log line.
 */
type ModuleUnderTest = {
    label: string;
    page: string;
    run: () => unknown;
    remainingTimer: string;
    collectTimer: string;
    collectAllTimer: string;
    collectSetting: string;
    collectAllSetting: string;
    nothingLog: string;
    sweepLog: string;
};

const MODULES: ModuleUnderTest[] = [
    {
        label: 'Path of Valor',
        page: 'pagesIDPoV',
        run: () => PathOfValue.goAndCollect(),
        remainingTimer: 'PoVRemainingTime',
        collectTimer: 'nextPoVCollectTime',
        collectAllTimer: 'nextPoVCollectAllTime',
        collectSetting: SK.autoPoVCollect,
        collectAllSetting: SK.autoPoVCollectAll,
        nothingLog: 'No Path of Valor reward to collect.',
        sweepLog: 'Going to collect all POV item at once.',
    },
    {
        label: 'Path of Glory',
        page: 'pagesIDPoG',
        run: () => PathOfGlory.goAndCollect(),
        remainingTimer: 'PoGRemainingTime',
        collectTimer: 'nextPoGCollectTime',
        collectAllTimer: 'nextPoGCollectAllTime',
        collectSetting: SK.autoPoGCollect,
        collectAllSetting: SK.autoPoGCollectAll,
        nothingLog: 'No Path of Glory reward to collect.',
        sweepLog: 'Going to collect all POG item at once.',
    },
    {
        label: 'Season',
        page: 'pagesIDSeason',
        run: () => Season.goAndCollect(),
        remainingTimer: 'SeasonRemainingTime',
        collectTimer: 'nextSeasonCollectTime',
        collectAllTimer: 'nextSeasonCollectAllTime',
        collectSetting: SK.autoSeasonCollect,
        collectAllSetting: SK.autoSeasonCollectAll,
        nothingLog: 'No season collection to do.',
        sweepLog: 'Going to collect all Season item at once.',
    },
    {
        label: 'Seasonal event',
        page: 'pagesIDSeasonalEvent',
        run: () => SeasonalEvent.goAndCollect(),
        remainingTimer: 'SeasonalEventRemainingTime',
        collectTimer: 'nextSeasonalEventCollectTime',
        collectAllTimer: 'nextSeasonalEventCollectAllTime',
        collectSetting: SK.autoSeasonalEventCollect,
        collectAllSetting: SK.autoSeasonalEventCollectAll,
        nothingLog: 'No SeasonalEvent reward to collect.',
        sweepLog: 'Going to collect all SeasonalEvent rewards.',
    },
    {
        label: 'Penta Drill',
        page: 'pagesIDPentaDrill',
        run: () => PentaDrill.goAndCollect(),
        remainingTimer: 'pentaDrillRemainingTime',
        collectTimer: 'nextPentaDrillCollectTime',
        collectAllTimer: 'nextPentaDrillCollectAllTime',
        collectSetting: SK.autoPentaDrillCollect,
        collectAllSetting: SK.autoPentaDrillCollectAll,
        nothingLog: 'No PentaDrill collection to do.',
        sweepLog: 'Going to collect all PentaDrill item at once.',
    },
];

const HOURS_BEFORE_END = 12;

describe.each(MODULES)("$label -- the final-window sweep", (mod) => {
    let logged: string[];

    beforeEach(() => {
        jest.useFakeTimers();
        MockHelper.mockDomain('www.hentaiheroes.com', '/event.html');
        jest.spyOn(PageHelper, 'getPage')
            .mockReturnValue(ConfigHelper.getHHScriptVars(mod.page));
        const realVars = ConfigHelper.getHHScriptVars.bind(ConfigHelper);
        jest.spyOn(ConfigHelper, 'getHHScriptVars').mockImplementation((id: string, logNotFound?: boolean) =>
            id === 'selectorClaimAllRewards' ? '#claim-all' : realVars(id, logNotFound));
        logged = [];
        jest.spyOn(LogUtils, 'logHHAuto').mockImplementation((...args: unknown[]) => {
            logged.push(String(args[0]));
        });
        localStorage.clear();
        sessionStorage.clear();
        for (const name of Object.keys(Timers)) delete Timers[name];
        localStorage.setItem(HHStoredVarPrefixKey + SK.collectAllTimer, String(HOURS_BEFORE_END));
        localStorage.setItem(HHStoredVarPrefixKey + mod.collectSetting, 'true');
        localStorage.setItem(HHStoredVarPrefixKey + mod.collectAllSetting, 'true');
        // A claim-all button and no tiers. Seasonal has no claim-all button
        // and logs its sweep before looking for tiers.
        document.body.innerHTML = '<button id="claim-all"></button>';
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
        localStorage.clear();
        sessionStorage.clear();
        for (const name of Object.keys(Timers)) delete Timers[name];
        document.body.innerHTML = '';
    });

    it("runs when the collect round brings the script there before the collect-all timer is due", () => {
        setTimer(mod.remainingTimer, Math.round(9.5 * 3600));
        setTimer(mod.collectAllTimer, 21);

        mod.run();

        expect(logged).toContain(mod.sweepLog);
    });

    it("does not run outside the final window", () => {
        setTimer(mod.remainingTimer, (HOURS_BEFORE_END + 24) * 3600);

        mod.run();

        expect(logged).not.toContain(mod.sweepLog);
    });

    it("does not run on an unknown end while the collect-all timer is pending", () => {
        setTimer(mod.collectAllTimer, 21);

        mod.run();

        expect(logged).not.toContain(mod.sweepLog);
    });

    describe("re-arming the collect-all timer", () => {
        beforeEach(() => {
            // Nothing to claim: the collect round ends in its "nothing" branch.
            document.body.innerHTML = '';
        });

        const dueIn = () => Number(Timers[mod.collectAllTimer]) - Date.now();

        it("does not schedule it past the opening of the window", () => {
            setTimer(mod.remainingTimer, (HOURS_BEFORE_END + 2) * 3600);
            setTimer(mod.collectAllTimer, -60);

            mod.run();

            expect(logged).toContain(mod.nothingLog);
            expect(dueIn()).toBeGreaterThanOrEqual(2 * 3600 * 1000);
            expect(dueIn()).toBeLessThanOrEqual((2 * 3600 + 180) * 1000);
        });

        it("schedules a last sweep 10 to 15 minutes before the end, inside the window", () => {
            // Rewards can still arrive after a sweep -- a league fight
            // reaching the next tier -- so the next look is before the end,
            // not 6 h later. Further from the end the 6 h delay comes first
            // and the re-arm after it lands here.
            setTimer(mod.remainingTimer, 3 * 3600);

            mod.run();

            expect(dueIn()).toBeGreaterThanOrEqual((3 * 3600 - 15 * 60) * 1000);
            expect(dueIn()).toBeLessThanOrEqual((3 * 3600 - 10 * 60) * 1000);
        });

        it("does not look again every few minutes in the last 20 minutes", () => {
            setTimer(mod.remainingTimer, 15 * 60);

            mod.run();

            expect(dueIn()).toBeGreaterThanOrEqual(6 * 3600 * 1000);
        });

        it("keeps the 6 h delay while the window is further away", () => {
            setTimer(mod.remainingTimer, (HOURS_BEFORE_END + 24) * 3600);
            setTimer(mod.collectAllTimer, -60);

            mod.run();

            expect(logged).toContain(mod.nothingLog);
            expect(dueIn()).toBeGreaterThanOrEqual(6 * 3600 * 1000);
        });
    });
});
