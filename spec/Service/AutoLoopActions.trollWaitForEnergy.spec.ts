// AutoLoopActions.trollWaitForEnergy.spec.ts -- Verifies that
// handleTrollBattle sets and clears the trollWaitForEnergy storage flag
// (issue #1708). The flag replaces the old ctx.busy / lastAction="troll"
// wait-marker which blocked every classic AutoLoop handler that gates on
// lastAction === "none" (League self-skip, Season, Quest, Champion, ...).
//
// Only the wait-branch path is exercised here because the four positive
// battle paths are covered by AutoLoopActions.wouldFightWithPower.spec.ts.

jest.mock("../../src/Helper/StorageHelper", () => ({
    getStoredValue: jest.fn(),
    setStoredValue: jest.fn(),
    deleteStoredValue: jest.fn(),
    getStoredJSON: jest.fn().mockReturnValue({}),
}));

jest.mock("../../src/Helper/HeroHelper", () => ({
    getHero: jest.fn(),
    HeroHelper: {},
}));

jest.mock("../../src/Helper/HHHelper", () => ({
    getHHVars: jest.fn(),
}));

jest.mock("../../src/Helper/ConfigHelper", () => ({
    ConfigHelper: { getHHScriptVars: jest.fn().mockReturnValue(undefined) },
}));

jest.mock("../../src/Helper/TimeHelper", () => ({
    getLimitTimeBeforeEnd: jest.fn().mockReturnValue(0),
    randomInterval: jest.fn().mockReturnValue(60),
}));

jest.mock("../../src/Helper/TimerHelper", () => ({
    checkTimer: jest.fn().mockReturnValue(false),
    checkTimerMustExist: jest.fn().mockReturnValue(false),
    getSecondsLeft: jest.fn().mockReturnValue(0),
    getTimer: jest.fn().mockReturnValue(0),
    setTimer: jest.fn(),
}));

jest.mock("../../src/Module/Troll", () => ({
    Troll: {
        isTrollFightActivated: jest.fn().mockReturnValue(true),
        doBossBattle: jest.fn(),
        canBuyFight: jest.fn().mockReturnValue({ canBuy: false }),
        canBuyFightForRaid: jest.fn().mockReturnValue({ canBuy: false }),
        getLastTrollIdAvailable: jest.fn().mockReturnValue(undefined),
        getTrollIdToFight: jest.fn().mockReturnValue(undefined),
    },
}));

jest.mock("../../src/Module/Events/EventModule", () => ({
    EventModule: {
        getEventGirl: jest.fn().mockReturnValue({}),
        getEventMythicGirl: jest.fn().mockReturnValue({}),
        parsePageForEventId: jest.fn().mockReturnValue({ eventIDs: [], bossBangEventIDs: [] }),
    },
}));

jest.mock("../../src/Module/Events/LoveRaidManager", () => ({
    LoveRaidManager: {
        isActivated: jest.fn().mockReturnValue(false),
        isAnyActivated: jest.fn().mockReturnValue(false),
        getTrollRaids: jest.fn().mockReturnValue([]),
        filterByRaidStars: jest.fn().mockReturnValue([]),
        getRaidStarsRaidToFight: jest.fn().mockReturnValue(undefined),
        getRaidToFight: jest.fn().mockReturnValue(undefined),
    },
}));

jest.mock("../../src/Service/AutoLoop", () => ({
    isAutoLoopActive: jest.fn().mockReturnValue(true),
}));

jest.mock("../../src/Service/ParanoiaService", () => ({
    ParanoiaService: { checkParanoiaSpendings: jest.fn().mockReturnValue(0) },
}));

jest.mock("../../src/Utils/LogUtils", () => ({
    logHHAuto: jest.fn(),
}));

jest.mock("../../src/config/HHStoredVars", () => ({
    HHStoredVarPrefixKey: "HHAuto_",
}));

jest.mock("../../src/config/StorageKeys", () => ({
    SK: {
        autoTrollBattle: "Setting_autoTrollBattle",
        autoTrollThreshold: "Setting_autoTrollThreshold",
        autoTrollRunThreshold: "Setting_autoTrollRunThreshold",
        autoTrollLoveRaidByPassThreshold: "Setting_autoTrollLoveRaidByPassThreshold",
        autoQuest: "Setting_autoQuest",
        plusEvent: "Setting_plusEvent",
        plusEventMythic: "Setting_plusEventMythic",
        plusLoveRaid: "Setting_plusLoveRaid",
    },
    TK: {
        battlePowerRequired: "Temp_battlePowerRequired",
        autoTrollBattleSaveQuest: "Temp_autoTrollBattleSaveQuest",
        questRequirement: "Temp_questRequirement",
        TrollHumanLikeRun: "Temp_TrollHumanLikeRun",
        trollWaitForEnergy: "Temp_trollWaitForEnergy",
    },
}));

import { handleTrollBattle } from "../../src/Service/AutoLoopActions";
import { getStoredValue, setStoredValue } from "../../src/Helper/StorageHelper";
import { EventModule } from "../../src/Module/Events/EventModule";
import { AutoLoopContext } from "../../src/Service/AutoLoopContext";

const getStoredValueMock = getStoredValue as jest.Mock;
const setStoredValueMock = setStoredValue as jest.Mock;
const getEventGirlMock = EventModule.getEventGirl as jest.Mock;

function makeCtx(overrides: Partial<AutoLoopContext> = {}): AutoLoopContext {
    return {
        busy: false,
        lastActionPerformed: "none",
        eventParsed: null,
        currentPower: 0,
        canCollectCompetitionActive: true,
        eventIDs: [],
        bossBangEventIDs: [],
        currentPage: "home.html",
        ...overrides,
    } as AutoLoopContext;
}

describe("handleTrollBattle wait-marker (issue #1708)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        getStoredValueMock.mockReturnValue("false");
        getEventGirlMock.mockReturnValue({});
    });

    it("clears trollWaitForEnergy at function entry", async () => {
        // Pre-condition: outer guard fails (busy=true) so we never reach the
        // wait-branch -- but the pre-clear must still run.
        const ctx = makeCtx({ busy: true });
        await handleTrollBattle(ctx);

        const clearCalls = setStoredValueMock.mock.calls.filter(
            ([key, value]) => key === "HHAuto_Temp_trollWaitForEnergy" && value === "false",
        );
        expect(clearCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('does NOT mutate ctx.busy or ctx.lastActionPerformed in the wait-branch', async () => {
        // Force the wait-branch: power=0, autoTrollBattle=true (would fire if power>0)
        getStoredValueMock.mockImplementation((key: string) => {
            if (key.endsWith("Setting_autoTrollBattle")) return "true";
            if (key.endsWith("Temp_battlePowerRequired")) return "0";
            return "false";
        });
        const ctx = makeCtx({ currentPower: 0 });
        await handleTrollBattle(ctx);

        // Marker set to true
        const setTrueCalls = setStoredValueMock.mock.calls.filter(
            ([key, value]) => key === "HHAuto_Temp_trollWaitForEnergy" && value === "true",
        );
        expect(setTrueCalls.length).toBeGreaterThanOrEqual(1);

        // ctx unchanged: this is the regression fix from issue #1708
        expect(ctx.busy).toBe(false);
        expect(ctx.lastActionPerformed).toBe("none");
    });

    it("keeps trollWaitForEnergy=false when no battle path would match", async () => {
        // Outer guard true (autoTrollBattle off, no event, no raid) -> wait-branch
        // skipped because wouldFightWithPower=false. Marker stays at the
        // entry-clear value ("false"), no "true" write.
        getStoredValueMock.mockReturnValue("false");
        const ctx = makeCtx({ currentPower: 0 });
        await handleTrollBattle(ctx);

        const setTrueCalls = setStoredValueMock.mock.calls.filter(
            ([key, value]) => key === "HHAuto_Temp_trollWaitForEnergy" && value === "true",
        );
        expect(setTrueCalls.length).toBe(0);
    });
});
