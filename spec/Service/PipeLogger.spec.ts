import {
    formatPipeLine,
    logEvent,
    writeLogContext,
    isDiagnose,
    _resetPipeLoggerForTests,
} from "../../src/Service/PipeLogger";
import { getStoredValue, setStoredValue } from "../../src/Helper/StorageHelper";
import { HHStoredVarPrefixKey } from "../../src/config/HHStoredVars";
import { SK, TK } from "../../src/config/StorageKeys";

function loggedLines(): string[] {
    const raw = getStoredValue(HHStoredVarPrefixKey + TK.Logging);
    if (!raw || !String(raw).startsWith("{")) return [];
    const obj = JSON.parse(raw);
    return Object.values(obj) as string[];
}
function pipeLines(): string[] {
    return loggedLines().filter((l) => l.includes("[PIPE]"));
}

describe("PipeLogger.formatPipeLine", () => {
    it("emits a [PIPE] line with t= and fields in fixed order", () => {
        const line = formatPipeLine({ ev: "start", tick: 5, run: "Quest@1000", block: "Quest", page: "home" });
        expect(line.startsWith("[PIPE] t=")).toBe(true);
        // order: tick, run, block, step, page, ev, result, detail
        expect(line).toContain("tick=5");
        expect(line).toContain("run=Quest@1000");
        expect(line).toContain("block=Quest");
        expect(line).toContain("page=home");
        expect(line).toContain("ev=start");
        expect(line.indexOf("tick=")).toBeLessThan(line.indexOf("block="));
        expect(line.indexOf("block=")).toBeLessThan(line.indexOf("ev="));
    });

    it("omits empty/undefined fields", () => {
        const line = formatPipeLine({ ev: "done" });
        expect(line).toContain("ev=done");
        expect(line).not.toContain("block=");
        expect(line).not.toContain("step=");
    });

    it("collapses whitespace/newlines in values (one event per line)", () => {
        const line = formatPipeLine({ ev: "error", detail: "boom\nat line\t2" });
        expect(line.split("\n").length).toBe(1);
        expect(line).toContain("detail=boom at line 2");
    });
});

describe("PipeLogger.logEvent", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        _resetPipeLoggerForTests();
    });

    it("always logs lifecycle events (start)", () => {
        logEvent({ ev: "start", block: "A" });
        expect(pipeLines().length).toBe(1);
    });

    it("change-deduplicates skip events", () => {
        logEvent({ ev: "skip", block: "A", detail: "energy=0" });
        logEvent({ ev: "skip", block: "A", detail: "energy=0" }); // same -> suppressed
        expect(pipeLines().length).toBe(1);
        logEvent({ ev: "skip", block: "A", detail: "busy" });      // changed -> logged
        expect(pipeLines().length).toBe(2);
    });

    it("resets skip-dedup once the block does real work", () => {
        logEvent({ ev: "skip", block: "A", detail: "energy=0" });
        logEvent({ ev: "start", block: "A" });                     // real work clears memory
        logEvent({ ev: "skip", block: "A", detail: "energy=0" });  // same detail but logged again
        expect(pipeLines().length).toBe(3);
    });

    it("suppresses per-step done in lean mode but keeps run-complete done", () => {
        setStoredValue(HHStoredVarPrefixKey + SK.pipelineDiagnose, "false");
        logEvent({ ev: "done", block: "A", step: "s1" });          // per-step -> suppressed
        expect(pipeLines().length).toBe(0);
        logEvent({ ev: "done", block: "A", detail: "run complete" }); // lean -> logged
        expect(pipeLines().length).toBe(1);
    });

    it("logs per-step done when diagnose is on", () => {
        setStoredValue(HHStoredVarPrefixKey + SK.pipelineDiagnose, "true");
        expect(isDiagnose()).toBe(true);
        logEvent({ ev: "done", block: "A", step: "s1" });
        expect(pipeLines().length).toBe(1);
    });
});

describe("PipeLogger.writeLogContext", () => {
    beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
    it("persists the non-rotating context block", () => {
        writeLogContext({ version: "7.37.0", platform: "test", effectiveOrder: ["A", "B"], disabledBlocks: [], diagnose: false });
        const raw = getStoredValue(HHStoredVarPrefixKey + TK.pipelineLogContext);
        const ctx = JSON.parse(raw);
        expect(ctx.version).toBe("7.37.0");
        expect(ctx.effectiveOrder).toEqual(["A", "B"]);
    });
});
