import { applySlotHold } from "../../src/Service/BlockPipeline";
import { BlockStepResult } from "../../src/Service/BlockTypes";

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
