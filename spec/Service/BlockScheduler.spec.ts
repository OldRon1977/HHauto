import { BlockScheduler, SchedulerPorts } from "../../src/Service/BlockScheduler";
import { Block, BlockRun, BlockStepResult, Step } from "../../src/Service/BlockTypes";
import { AutoLoopContext } from "../../src/Service/AutoLoopContext";

const CTX = {} as AutoLoopContext;

interface Ctl {
    time: number;
    masterOff: boolean;
    autoLoopOff: boolean;
    version: string;
    page: string;
}

function makePorts(initial: Partial<BlockRun> | null = null) {
    const ctl: Ctl = { time: 1000, masterOff: false, autoLoopOff: false, version: "v1", page: "home" };
    const state = {
        run: initial ? ({ blockId: "", stepIdx: 0, startedAt: 0, stepStartedAt: 0, dispatched: false, data: {}, ...initial } as BlockRun) : (null as BlockRun | null),
        cooldowns: {} as Record<string, number>,
        failures: {} as Record<string, number>,
        disabled: {} as Record<string, { reason: string; sinceVersion: string }>,
        lastRunAt: {} as Record<string, number>,
    };
    const logs: Record<string, unknown>[] = [];
    const routeHome = jest.fn(() => undefined);
    const ports: SchedulerPorts = {
        now: () => ctl.time,
        getCurrentPage: () => ctl.page,
        isMasterOff: () => ctl.masterOff,
        isAutoLoopOff: () => ctl.autoLoopOff,
        routeHome,
        scriptVersion: () => ctl.version,
        loadRun: () => (state.run ? JSON.parse(JSON.stringify(state.run)) : null),
        saveRun: (r) => { state.run = JSON.parse(JSON.stringify(r)); },
        clearRun: () => { state.run = null; },
        getCooldowns: () => state.cooldowns, setCooldowns: (v) => { state.cooldowns = v; },
        getFailureCounts: () => state.failures, setFailureCounts: (v) => { state.failures = v; },
        getAutoDisabled: () => state.disabled, setAutoDisabled: (v) => { state.disabled = v; },
        getLastRunAt: () => state.lastRunAt, setLastRunAt: (v) => { state.lastRunAt = v; },
        log: (e) => logs.push(e),
    };
    return { ctl, state, logs, ports, routeHome };
}

function step(name: string, result: BlockStepResult | (() => BlockStepResult), extra: Partial<Step> = {}): Step {
    return { name, fn: async () => (typeof result === "function" ? result() : result), ...extra };
}

function block(id: string, steps: Step[], over: Partial<Block> = {}): Block {
    return { id, precondition: () => true, steps, userMovable: true, minIntervalMs: 0, ...over };
}

function reg(...blocks: Block[]): Record<string, Block> {
    const r: Record<string, Block> = {};
    for (const b of blocks) r[b.id] = b;
    return r;
}

describe("BlockScheduler -- lifecycle", () => {
    it("runs a single-step block to completion and records lastRunAt", async () => {
        const h = makePorts();
        const A = block("A", [step("s1", { ok: true })]);
        const s = new BlockScheduler(reg(A), ["A"], h.ports);
        await s.tick(CTX);
        expect(s.getActiveRun()).toBeNull();          // completed -> cleared
        expect(h.state.lastRunAt["A"]).toBe(1000);
        expect(h.state.run).toBeNull();
    });

    it("advances through multiple steps across ticks", async () => {
        const h = makePorts();
        const A = block("A", [step("s1", { ok: true }), step("s2", { ok: true })]);
        const s = new BlockScheduler(reg(A), ["A"], h.ports);
        await s.tick(CTX);                            // starts + runs s1
        expect(s.getActiveRun()?.stepIdx).toBe(1);
        await s.tick(CTX);                            // runs s2 -> complete
        expect(s.getActiveRun()).toBeNull();
    });

    it("repeats the same step until it stops repeating", async () => {
        const h = makePorts();
        let n = 0;
        const A = block("A", [step("loop", () => (++n < 3 ? { ok: true, repeat: true } : { ok: true }))]);
        const s = new BlockScheduler(reg(A), ["A"], h.ports);
        await s.tick(CTX); expect(s.getActiveRun()?.stepIdx).toBe(0); // repeat
        await s.tick(CTX); expect(s.getActiveRun()?.stepIdx).toBe(0); // repeat
        await s.tick(CTX); expect(s.getActiveRun()).toBeNull();       // done
        expect(n).toBe(3);
    });

    it("keeps at most one active run (a second block does not start mid-run)", async () => {
        const h = makePorts();
        const A = block("A", [step("a1", { ok: true }), step("a2", { ok: true })]);
        const B = block("B", [step("b1", { ok: true })]);
        const s = new BlockScheduler(reg(A, B), ["A", "B"], h.ports);
        await s.tick(CTX);                            // starts A
        expect(s.getActiveRun()?.blockId).toBe("A");
        await s.tick(CTX);                            // continues A (not B)
        expect(h.state.lastRunAt["B"]).toBeUndefined();
    });
});

describe("BlockScheduler -- abort/watchdog", () => {
    it("aborts on step failure: clears run, sets cool-down, routes home, counts failure", async () => {
        const h = makePorts();
        const A = block("A", [step("bad", { ok: false, reason: "boom", retryable: true })]);
        const s = new BlockScheduler(reg(A), ["A"], h.ports);
        await s.tick(CTX);
        expect(s.getActiveRun()).toBeNull();
        expect(h.routeHome).toHaveBeenCalledTimes(1);
        expect(h.state.cooldowns["A"]).toBeGreaterThan(1000);
        expect(Object.values(h.state.failures)[0]).toBe(1);
    });

    it("auto-disables a block after reaching the failure threshold", async () => {
        const A = block("A", [step("bad", { ok: false, reason: "boom", retryable: true })]);
        // three independent runs with the same failure signature
        const h = makePorts();
        for (let i = 0; i < 3; i++) {
            const s = new BlockScheduler(reg(A), ["A"], h.ports, { cooldownMs: 0 });
            await s.tick(CTX);
        }
        expect(h.state.disabled["A"]).toBeDefined();
        expect(h.state.disabled["A"].sinceVersion).toBe("v1");
    });

    it("aborts on run-total timeout", async () => {
        const h = makePorts();
        const A = block("A", [step("loop", { ok: true, repeat: true })], { totalTimeoutMs: 5000 });
        const s = new BlockScheduler(reg(A), ["A"], h.ports);
        await s.tick(CTX);                  // starts at t=1000
        h.ctl.time = 1000 + 6000;           // exceed total timeout
        await s.tick(CTX);
        expect(s.getActiveRun()).toBeNull();
        expect(h.routeHome).toHaveBeenCalled();
    });

    it("aborts on step timeout across ticks", async () => {
        const h = makePorts();
        const A = block("A", [step("loop", { ok: true, repeat: true }, { timeoutMs: 2000 })], { totalTimeoutMs: 1_000_000 });
        const s = new BlockScheduler(reg(A), ["A"], h.ports);
        await s.tick(CTX);                  // repeat, stepStartedAt=1000
        h.ctl.time = 1000 + 3000;           // exceed step timeout
        await s.tick(CTX);
        expect(s.getActiveRun()).toBeNull();
    });
});

describe("BlockScheduler -- resume / at-most-once", () => {
    it("aborts when resume validation fails after reload", async () => {
        const h = makePorts({ blockId: "A", stepIdx: 0, startedAt: 900, stepStartedAt: 900 });
        const A = block("A", [step("s1", { ok: true }, { resumeValid: () => false })]);
        const s = new BlockScheduler(reg(A), ["A"], h.ports); // constructor restores run
        await s.tick(CTX);
        expect(s.getActiveRun()).toBeNull();
        expect(h.routeHome).toHaveBeenCalled();
    });

    it("skips a dispatched-but-unconfirmed step on resume (at-most-once)", async () => {
        const calls: string[] = [];
        const A = block("A", [
            { name: "send", stateChanging: true, fn: async () => { calls.push("send"); return { ok: true }; } },
            { name: "after", fn: async () => { calls.push("after"); return { ok: true }; } },
        ]);
        // persisted run as if a reload happened right after dispatching step 0
        const h = makePorts({ blockId: "A", stepIdx: 0, startedAt: 900, stepStartedAt: 900, dispatched: true });
        const s = new BlockScheduler(reg(A), ["A"], h.ports);
        await s.tick(CTX); // resume: skip step 0, run step 1
        expect(calls).toEqual(["after"]);             // "send" was NOT re-run
    });

    it("persist-before-act: a state-changing step is marked dispatched before fn runs", async () => {
        const h = makePorts();
        let dispatchedAtCall = false;
        const A = block("A", [{
            name: "send",
            stateChanging: true,
            fn: async () => { dispatchedAtCall = h.state.run?.dispatched === true; return { ok: true }; },
        }]);
        const s = new BlockScheduler(reg(A), ["A"], h.ports);
        await s.tick(CTX);
        expect(dispatchedAtCall).toBe(true);
    });
});

describe("BlockScheduler -- selection gating", () => {
    it("discards the run on master-off without routing home", async () => {
        const h = makePorts({ blockId: "A", stepIdx: 0, startedAt: 900, stepStartedAt: 900 });
        const A = block("A", [step("s1", { ok: true })]);
        h.ctl.masterOff = true;
        const s = new BlockScheduler(reg(A), ["A"], h.ports);
        await s.tick(CTX);
        expect(s.getActiveRun()).toBeNull();
        expect(h.state.run).toBeNull();
        expect(h.routeHome).not.toHaveBeenCalled();
    });

    it("does not pick a block while it is in cool-down", async () => {
        const h = makePorts();
        h.state.cooldowns["A"] = 5000; // future
        const A = block("A", [step("s1", { ok: true })]);
        const s = new BlockScheduler(reg(A), ["A"], h.ports);
        await s.tick(CTX);
        expect(s.getActiveRun()).toBeNull();
        expect(h.state.lastRunAt["A"]).toBeUndefined();
    });

    it("respects minIntervalMs since last run", async () => {
        const h = makePorts();
        h.state.lastRunAt["A"] = 1000;
        const A = block("A", [step("s1", { ok: true })], { minIntervalMs: 5000 });
        const s = new BlockScheduler(reg(A), ["A"], h.ports); // now=1000, elapsed 0 < 5000
        await s.tick(CTX);
        expect(s.getActiveRun()).toBeNull();
    });

    it("skips a block whose precondition is false and picks the next", async () => {
        const h = makePorts();
        const A = block("A", [step("a1", { ok: true })], { precondition: () => false });
        const B = block("B", [step("b1", { ok: true })]);
        const s = new BlockScheduler(reg(A, B), ["A", "B"], h.ports);
        await s.tick(CTX);
        expect(h.state.lastRunAt["B"]).toBe(1000);
        expect(h.state.lastRunAt["A"]).toBeUndefined();
    });

    it("does not pick an auto-disabled block", async () => {
        const h = makePorts();
        h.state.disabled["A"] = { reason: "x", sinceVersion: "v1" };
        const A = block("A", [step("a1", { ok: true })]);
        const s = new BlockScheduler(reg(A), ["A"], h.ports);
        await s.tick(CTX);
        expect(s.getActiveRun()).toBeNull();
    });
});

describe("BlockScheduler -- auto-disable reset", () => {
    it("clears stale auto-disable on a script version change (one retry)", async () => {
        const h = makePorts();
        h.state.disabled["A"] = { reason: "x", sinceVersion: "v0" };
        h.state.failures["A:step:x"] = 3;
        h.ctl.version = "v1";
        const A = block("A", [step("a1", { ok: true })]);
        // constructor reconciles version resets
        // eslint-disable-next-line no-new
        new BlockScheduler(reg(A), ["A"], h.ports);
        expect(h.state.disabled["A"]).toBeUndefined();
        expect(h.state.failures["A:step:x"]).toBeUndefined();
    });

    it("reactivate() clears auto-disable and the block's failure counts", async () => {
        const h = makePorts();
        h.state.disabled["A"] = { reason: "x", sinceVersion: "v1" };
        h.state.failures["A:step:x"] = 3;
        const A = block("A", [step("a1", { ok: true })]);
        const s = new BlockScheduler(reg(A), ["A"], h.ports);
        s.reactivate("A");
        expect(h.state.disabled["A"]).toBeUndefined();
        expect(h.state.failures["A:step:x"]).toBeUndefined();
    });
});
