import {
    validateOrder,
    resolveOrder,
} from "../../src/Service/OrderResolver";
import { Block, BlockRegistry, OrderConstraint } from "../../src/Service/BlockTypes";

// Minimal block factory -- only id + constraints matter for ordering tests.
function blk(id: string, constraints?: OrderConstraint[]): Block {
    return {
        id,
        precondition: () => true,
        steps: [],
        userMovable: true,
        minIntervalMs: 0,
        constraints,
    };
}

function reg(...blocks: Block[]): BlockRegistry {
    const r: BlockRegistry = {};
    for (const b of blocks) r[b.id] = b;
    return r;
}

describe("OrderResolver.validateOrder", () => {
    it("accepts an order with no constraints", () => {
        const r = reg(blk("A"), blk("B"), blk("C"));
        expect(validateOrder(["A", "B", "C"], r).valid).toBe(true);
    });

    it("enforces a satisfied hard runsAfter constraint", () => {
        // B runsAfter A  -> A must be before B
        const r = reg(blk("A"), blk("B", [{ kind: "runsAfter", block: "A", hard: true }]));
        expect(validateOrder(["A", "B"], r).valid).toBe(true);
    });

    it("rejects a violated hard runsAfter constraint", () => {
        const r = reg(blk("A"), blk("B", [{ kind: "runsAfter", block: "A", hard: true }]));
        const res = validateOrder(["B", "A"], r);
        expect(res.valid).toBe(false);
        expect(res.errors.join(" ")).toContain("must run before");
    });

    it("enforces a satisfied hard runsBefore constraint", () => {
        const r = reg(blk("A", [{ kind: "runsBefore", block: "B", hard: true }]), blk("B"));
        expect(validateOrder(["A", "B"], r).valid).toBe(true);
        expect(validateOrder(["B", "A"], r).valid).toBe(false);
    });

    it("treats afterAll as last position", () => {
        const r = reg(blk("Home", [{ kind: "afterAll", hard: true }]), blk("A"), blk("B"));
        expect(validateOrder(["A", "B", "Home"], r).valid).toBe(true);
        expect(validateOrder(["Home", "A", "B"], r).valid).toBe(false);
    });

    it("treats beforeAll as first position", () => {
        const r = reg(blk("Parse", [{ kind: "beforeAll", hard: true }]), blk("A"), blk("B"));
        expect(validateOrder(["Parse", "A", "B"], r).valid).toBe(true);
        expect(validateOrder(["A", "Parse", "B"], r).valid).toBe(false);
    });

    it("flags two beforeAll blocks as a contradiction (cycle)", () => {
        const r = reg(
            blk("X", [{ kind: "beforeAll", hard: true }]),
            blk("Y", [{ kind: "beforeAll", hard: true }]),
            blk("A"),
        );
        const res = validateOrder(["X", "Y", "A"], r);
        expect(res.valid).toBe(false);
        expect(res.errors.join(" ")).toContain("cycle");
    });

    it("detects a runsAfter/runsBefore cycle", () => {
        const r = reg(
            blk("A", [{ kind: "runsAfter", block: "B", hard: true }]),
            blk("B", [{ kind: "runsAfter", block: "A", hard: true }]),
        );
        expect(validateOrder(["A", "B"], r).valid).toBe(false);
    });

    it("reports soft violations without failing validity", () => {
        const r = reg(blk("A"), blk("B", [{ kind: "runsAfter", block: "A", hard: false }]));
        const res = validateOrder(["B", "A"], r);
        expect(res.valid).toBe(true);
        expect(res.softViolations.length).toBe(1);
    });
});

describe("OrderResolver.resolveOrder", () => {
    const r = reg(blk("A"), blk("B"), blk("C"), blk("D"));
    const def = ["A", "B", "C", "D"];

    it("returns the default order when stored is empty/null", () => {
        expect(resolveOrder(null, r, def).order).toEqual(def);
        expect(resolveOrder([], r, def).order).toEqual(def);
    });

    it("drops unknown ids and warns (case b)", () => {
        const res = resolveOrder(["A", "ZZZ", "B", "C", "D"], r, def);
        expect(res.order).toEqual(["A", "B", "C", "D"]);
        expect(res.warnings.some(w => w.code === "dropped" && w.blockId === "ZZZ")).toBe(true);
    });

    it("inserts a missing registry block at its default position (case a)", () => {
        // stored omits B; default neighbour A precedes it -> [A,B,D,C]
        const res = resolveOrder(["A", "D", "C"], r, def);
        expect(res.order).toEqual(["A", "B", "D", "C"]);
        expect(res.warnings.some(w => w.code === "inserted" && w.blockId === "B")).toBe(true);
    });

    it("inserts a missing first block at the start when no predecessor present", () => {
        const res = resolveOrder(["B", "C", "D"], r, def); // A missing, no predecessor
        expect(res.order[0]).toBe("A");
    });

    it("falls back to default when the stored order violates a hard constraint (case c)", () => {
        const r2 = reg(blk("A"), blk("B", [{ kind: "runsAfter", block: "A", hard: true }]));
        const def2 = ["A", "B"];
        const res = resolveOrder(["B", "A"], r2, def2);
        expect(res.order).toEqual(["A", "B"]);
        expect(res.warnings.some(w => w.code === "fallback")).toBe(true);
    });

    it("de-duplicates repeated ids in a corrupt stored order", () => {
        const res = resolveOrder(["A", "A", "B", "C", "D"], r, def);
        expect(res.order).toEqual(["A", "B", "C", "D"]);
    });
});
