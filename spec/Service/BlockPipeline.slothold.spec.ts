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
