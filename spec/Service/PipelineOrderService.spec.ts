import { blockLabel, rebuildOrder } from "../../src/Service/PipelineOrderService";
import { Block, BlockRegistry } from "../../src/Service/BlockTypes";

function mkBlock(id: string, movable: boolean): Block {
  return { id, precondition: () => true, steps: [], userMovable: movable, minIntervalMs: 0 };
}
function reg(...defs: Array<[string, boolean]>): BlockRegistry {
  const r: BlockRegistry = {};
  for (const [id, m] of defs) r[id] = mkBlock(id, m);
  return r;
}

describe("PipelineOrderService.blockLabel", () => {
  it("strips the handle prefix and spaces camelCase words", () => {
    expect(blockLabel("handleSeasonCollect")).toBe("Season Collect");
    expect(blockLabel("handleShop")).toBe("Shop");
    expect(blockLabel("handleAutoEquipBoosters")).toBe("Auto Equip Boosters");
    expect(blockLabel("handleGoHome")).toBe("Go Home");
  });
  it("falls back to the id when empty", () => {
    expect(blockLabel("handle")).toBe("handle");
  });
});

describe("PipelineOrderService.rebuildOrder", () => {
  const registry = reg(["ep", false], ["a", true], ["b", true], ["c", true], ["home", false]);

  it("permutes only movable blocks, keeps pinned at their indices", () => {
    const effective = ["ep", "a", "b", "c", "home"];
    const result = rebuildOrder(effective, registry, ["c", "a", "b"]);
    expect(result).toEqual(["ep", "c", "a", "b", "home"]);
  });

  it("is identity when the movable sequence is unchanged", () => {
    const effective = ["ep", "a", "b", "c", "home"];
    expect(rebuildOrder(effective, registry, ["a", "b", "c"])).toEqual(effective);
  });

  it("keeps a pinned block fixed even if it sits between movable ones", () => {
    const registry2 = reg(["a", true], ["pin", false], ["b", true]);
    const effective = ["a", "pin", "b"];
    const result = rebuildOrder(effective, registry2, ["b", "a"]);
    expect(result).toEqual(["b", "pin", "a"]);
  });
});
