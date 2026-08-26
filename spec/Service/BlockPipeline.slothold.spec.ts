import { applySlotHold, buildRegistryAndOrder } from "../../src/Service/BlockPipeline";
import { BlockStepResult } from "../../src/Service/BlockTypes";
import { validateOrder } from "../../src/Service/OrderResolver";

describe("applySlotHold (ADR-002 gate-hold-return)", () => {
    it("repeats (holds the slot) when the handler acted (busy)", () => {
        const r = applySlotHold({ ok: true }, true) as { ok: true; repeat?: boolean };
        expect(r.ok).toBe(true);
        expect(r.repeat).toBe(true);
    });

    it("completes (releases the slot) when the handler is idle (not busy)", () => {
        const r = applySlotHold({ ok: true }, false) as { ok: true; repeat?: boolean };
        expect(r.ok).toBe(true);
        expect(r.repeat).toBeUndefined();
    });

    it("marks a step that switched the auto-loop off as having acted", () => {
        // handleLeague launches its fights, arms its timer and deliberately
        // releases the slot -- holding it on a battle-result page would starve
        // handleGenericBattle (#1796). It still DID something, and the activity
        // has to survive it (#1841): measured live, the league block fought and
        // handleSeason then navigated off the leaderboard mid-session.
        const r = applySlotHold({ ok: true }, false, true) as { ok: true; repeat?: boolean; acted?: boolean };
        expect(r.acted).toBe(true);
        expect(r.repeat).toBeUndefined();      // released, as the handler intends
    });

    it("leaves an idle step alone while the auto-loop is running", () => {
        const r = applySlotHold({ ok: true }, false, false) as { ok: true; acted?: boolean };
        expect(r.acted).toBeUndefined();
    });

    it("passes a failure through unchanged (watchdog handles it)", () => {
        const fail: BlockStepResult = { ok: false, reason: "boom", retryable: true };
        expect(applySlotHold(fail, true)).toEqual(fail);
        expect(applySlotHold(fail, false)).toEqual(fail);
    });
});


describe("buildRegistryAndOrder -- constraints + userMovable (task 8, R3.6/R3.7)", () => {
    const { registry, defaultOrder } = buildRegistryAndOrder();

    it("default order satisfies all hard constraints (R3.6) -- no forced reorder", () => {
        const res = validateOrder(defaultOrder, registry);
        expect(res.errors).toEqual([]);
        expect(res.valid).toBe(true);
    });

    it("pins infra blocks as not user-movable, everything else movable (R3.7)", () => {
        expect(registry["handleEventParsing"].userMovable).toBe(false);
        expect(registry["handleGoHome"].userMovable).toBe(false);
        for (const id of defaultOrder) {
            if (id === "handleEventParsing" || id === "handleGoHome") continue;
            expect(registry[id].userMovable).toBe(true);
        }
    });

    it("declares the hard ordering constraints (design Abhaengigkeitsgraph)", () => {
        const boosters = registry["handleAutoEquipBoosters"].constraints ?? [];
        expect(boosters).toContainEqual({ kind: "runsAfter", block: "handleShop", hard: true });
        expect(boosters).toContainEqual({ kind: "runsAfter", block: "handleHaremSize", hard: true });
        expect(registry["handleGoHome"].constraints).toContainEqual({ kind: "afterAll", hard: true });
        const ep = registry["handleEventParsing"].constraints ?? [];
        expect(ep).toContainEqual({ kind: "runsBefore", block: "handleTrollBattle", hard: true });
        expect(ep).toContainEqual({ kind: "runsBefore", block: "handleBossBangParse", hard: true });
        expect(ep).toContainEqual({ kind: "runsBefore", block: "handleBossBangFight", hard: true });
    });
});

// A handler that navigates home BECAUSE it is finished used to be
// indistinguishable from one that navigates to carry on: ctx.busy is set in
// both cases, the run was held, and the next tick discarded it as a stop.
// PlaceOfPower did exactly that -- 12 runs over one night, 0 completions.
describe("applySlotHold and an explicit done", () => {
    it("lets the run complete even though the handler navigated", () => {
        expect(applySlotHold({ ok: true, done: true }, true)).toEqual({ ok: true, done: true });
    });

    it("keeps the acted mark, so the focus logic still sees the navigation", () => {
        expect(applySlotHold({ ok: true, done: true }, true, true)).toEqual({ ok: true, done: true, acted: true });
    });

    it("leaves the ordinary navigated-so-hold rule alone", () => {
        expect(applySlotHold({ ok: true }, true)).toEqual({ ok: true, repeat: true });
    });
});
