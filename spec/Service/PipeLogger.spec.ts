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
import { clearLog, readLogAsObject } from '../../src/Utils/LogStore';
import { logHHAuto } from '../../src/Utils/LogUtils';

function loggedLines(): string[] {
    // The log lives in the ring buffer since 8.10.47; readLogAsObject is the
    // way to read it, and it returns the same shape the export always had.
    return Object.values(readLogAsObject());
}
function pipeLines(): string[] {
    return loggedLines().filter((l) => l.includes("[PIPE]"));
}

describe("PipeLogger.formatPipeLine", () => {
    it("emits a [PIPE] line with fields in fixed order and no clock of its own", () => {
        const line = formatPipeLine({ ev: "start", tick: 5, block: "Quest", page: "home" });
        expect(line.startsWith("[PIPE] tick=")).toBe(true);
        expect(line).not.toContain("t=2");
        // order: tick, run, block, step, page, ev, result, detail
        expect(line).toContain("block=Quest");
        expect(line).toContain("page=home");
        expect(line).toContain("ev=start");
        expect(line.indexOf("tick=")).toBeLessThan(line.indexOf("block="));
        expect(line.indexOf("block=")).toBeLessThan(line.indexOf("ev="));
    });

    it("names the block once when the run id already carries it", () => {
        const line = formatPipeLine({ ev: "start", tick: 5, run: "Quest@1000", block: "Quest" });
        expect(line).toBe("[PIPE] tick=5 run=Quest@1000 ev=start");
        expect(formatPipeLine({ ev: "focus", run: "Quest@1000", block: "Other" })).toContain("block=Other");
    });

    it("never prints the acted flag", () => {
        expect(formatPipeLine({ ev: "done", block: "A", detail: "run complete", acted: true })).not.toContain("acted");
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
        clearLog();
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

describe("PipeLogger idle runs", () => {
    const run = (id: string, block: string, acted = false, between?: () => void) => {
        logEvent({ ev: "start", run: id, block });
        between?.();
        logEvent({ ev: "done", run: id, block, detail: "run complete", acted });
    };

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        clearLog();
        _resetPipeLoggerForTests();
        setStoredValue(HHStoredVarPrefixKey + SK.pipelineDiagnose, "false");
    });

    it("drops a run that neither logged nor acted, and says so once per block", () => {
        run("Troll@1", "Troll");
        run("Troll@2", "Troll");
        run("Troll@3", "Troll");
        const lines = pipeLines();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain("block=Troll ev=idle");
    });

    it("keeps a run that logged something, with its start in front of the message", () => {
        run("Salary@1", "Salary", false, () => logHHAuto("nextSalaryTime set"));
        const lines = loggedLines();
        expect(lines).toHaveLength(3);
        expect(lines[0]).toContain("run=Salary@1 ev=start");
        expect(lines[1]).toBe("nextSalaryTime set");
        expect(lines[2]).toContain("detail=run complete");
    });

    it("keeps a run that acted without logging", () => {
        run("Troll@1", "Troll", true);
        expect(pipeLines()).toHaveLength(2);
    });

    it("logs idle again after the block did something in between", () => {
        run("Troll@1", "Troll");
        run("Troll@2", "Troll", true);
        run("Troll@3", "Troll");
        const idle = pipeLines().filter(l => l.includes("ev=idle"));
        expect(idle).toHaveLength(2);
    });

    it("keeps the idle line single across focus releases and skip reasons", () => {
        run("Quest@1", "Quest");
        logEvent({ ev: "focus", run: "Quest@1", block: "Quest", detail: "released: ran without doing anything" });
        logEvent({ ev: "skip", block: "Quest", detail: "busy" });
        run("Quest@2", "Quest");
        run("Quest@3", "Quest");
        expect(pipeLines().filter(l => l.includes("ev=idle"))).toHaveLength(1);
    });

    it("writes a held start when another block logs first", () => {
        logEvent({ ev: "start", run: "A@1", block: "A" });
        logEvent({ ev: "skip", block: "B", detail: "busy" });
        const lines = pipeLines();
        expect(lines[0]).toContain("run=A@1 ev=start");
        expect(lines[1]).toContain("block=B");
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
