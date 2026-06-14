// OrderResolver.ts -- pure resolution + validation of the block order
// (v7.37.0 pipeline-block architecture, ADR-001).
//
// No DOM, no storage: the stored order is passed in and the resolved order is
// returned, so this is fully unit-testable. Storage wiring (reading
// TK.pipelineOrder, settings export/import) lives in the scheduler/AutoLoop
// integration task.
//
// Requirements: 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
import { Block, BlockOrder, BlockRegistry, OrderConstraint } from "./BlockTypes";

export type OrderWarningCode = 'inserted' | 'dropped' | 'fallback';

export interface OrderWarning {
  code: OrderWarningCode;
  message: string;
  blockId?: string;
}

export interface ValidateResult {
  valid: boolean;
  /** Hard-constraint / cycle / contradiction problems (make the order illegal). */
  errors: string[];
  /** Soft-constraint violations (advisory only, R3.4). */
  softViolations: string[];
}

export interface ResolveResult {
  order: BlockOrder;
  warnings: OrderWarning[];
}

/** A directed "must come before" edge: index(from) < index(to). */
interface Edge { from: string; to: string; }

/**
 * Build the directed hard/soft edges implied by every block's constraints,
 * restricted to block ids that are actually present in `order`.
 */
function buildEdges(order: BlockOrder, registry: BlockRegistry, hard: boolean): Edge[] {
  const present = new Set(order);
  const edges: Edge[] = [];
  for (const id of order) {
    const block: Block | undefined = registry[id];
    if (!block || !block.constraints) continue;
    for (const c of block.constraints as OrderConstraint[]) {
      if (c.hard !== hard) continue;
      if (c.kind === 'runsAfter') {
        // this block runs after c.block  ->  c.block before this
        if (present.has(c.block)) edges.push({ from: c.block, to: id });
      } else if (c.kind === 'runsBefore') {
        if (present.has(c.block)) edges.push({ from: id, to: c.block });
      } else if (c.kind === 'beforeAll') {
        // this block before every other present block
        for (const other of order) if (other !== id) edges.push({ from: id, to: other });
      } else if (c.kind === 'afterAll') {
        for (const other of order) if (other !== id) edges.push({ from: other, to: id });
      }
    }
  }
  return edges;
}

/** Detect a cycle in the directed hard-edge graph (DFS), restricted to `order`. */
function hasCycle(order: BlockOrder, edges: Edge[]): { cycle: boolean; node?: string } {
  const adj = new Map<string, string[]>();
  for (const id of order) adj.set(id, []);
  for (const e of edges) {
    if (adj.has(e.from)) adj.get(e.from)!.push(e.to);
  }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const id of order) color.set(id, WHITE);
  let found: string | undefined;
  const stack: Array<{ id: string; i: number }> = [];
  for (const start of order) {
    if (color.get(start) !== WHITE) continue;
    stack.push({ id: start, i: 0 });
    color.set(start, GRAY);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const neighbors = adj.get(top.id) || [];
      if (top.i < neighbors.length) {
        const next = neighbors[top.i++];
        const nc = color.get(next);
        if (nc === GRAY) { found = next; stack.length = 0; break; }
        if (nc === WHITE) { color.set(next, GRAY); stack.push({ id: next, i: 0 }); }
      } else {
        color.set(top.id, BLACK);
        stack.pop();
      }
    }
    if (found) break;
  }
  return found ? { cycle: true, node: found } : { cycle: false };
}

/**
 * Validate an order against the registry's constraints (R3.3/3.4/3.6).
 * Hard violations / cycles / contradictions -> valid=false. Soft violations ->
 * advisory list only.
 */
export function validateOrder(order: BlockOrder, registry: BlockRegistry): ValidateResult {
  const errors: string[] = [];
  const softViolations: string[] = [];
  const idx = new Map<string, number>();
  order.forEach((id, i) => idx.set(id, i));

  const hardEdges = buildEdges(order, registry, true);

  // 1. cycle / contradiction (two beforeAll, beforeAll+afterAll on same set, ...)
  const cyc = hasCycle(order, hardEdges);
  if (cyc.cycle) {
    errors.push(`order contains a hard-constraint cycle/contradiction (at '${cyc.node}')`);
  }

  // 2. each hard edge must be satisfied by the given order
  for (const e of hardEdges) {
    const a = idx.get(e.from); const b = idx.get(e.to);
    if (a === undefined || b === undefined) continue;
    if (!(a < b)) errors.push(`hard constraint violated: '${e.from}' must run before '${e.to}'`);
  }

  // 3. soft edges -> advisory only
  const softEdges = buildEdges(order, registry, false);
  for (const e of softEdges) {
    const a = idx.get(e.from); const b = idx.get(e.to);
    if (a === undefined || b === undefined) continue;
    if (!(a < b)) softViolations.push(`soft constraint not met: '${e.from}' before '${e.to}'`);
  }

  return { valid: errors.length === 0, errors, softViolations };
}

/**
 * Insert each registry block missing from `known` at its default position,
 * using the "nearest preceding present default neighbour" heuristic (R7.3).
 */
function autoInsert(known: string[], missing: string[], defaultOrder: BlockOrder): string[] {
  const result = [...known];
  for (const id of defaultOrder) {
    if (!missing.includes(id)) continue;
    const dIdx = defaultOrder.indexOf(id);
    let insertAfter = -1;
    for (let i = dIdx - 1; i >= 0; i--) {
      const pos = result.indexOf(defaultOrder[i]);
      if (pos >= 0) { insertAfter = pos; break; }
    }
    if (insertAfter === -1) result.unshift(id);
    else result.splice(insertAfter + 1, 0, id);
  }
  return result;
}

/**
 * Resolve a (possibly stale/invalid) stored order against the current registry
 * and code default order. Always returns a valid, executable order (R7.7):
 *  (b) unknown ids -> dropped + warning (R7.4)
 *  (a) missing registry blocks -> inserted at default position + warning (R7.3)
 *  (c) still invalid (cycle/contradiction/hard violation) -> fallback to
 *      defaultOrder + warning (R7.5)
 */
export function resolveOrder(
  stored: BlockOrder | null | undefined,
  registry: BlockRegistry,
  defaultOrder: BlockOrder,
): ResolveResult {
  const warnings: OrderWarning[] = [];
  const base = (stored && stored.length > 0) ? stored : [...defaultOrder];

  // (b) drop unknown ids
  const known: string[] = [];
  for (const id of base) {
    if (registry[id]) known.push(id);
    else warnings.push({ code: 'dropped', blockId: id, message: `dropped unknown block id '${id}' from stored order` });
  }
  // de-duplicate (keep first occurrence) -- a corrupt stored order may repeat ids
  const seen = new Set<string>();
  const dedup = known.filter(id => (seen.has(id) ? false : (seen.add(id), true)));

  // (a) insert registry blocks missing from stored
  const missing = Object.keys(registry).filter(id => !dedup.includes(id));
  for (const id of missing) {
    warnings.push({ code: 'inserted', blockId: id, message: `inserted new block '${id}' at its default position` });
  }
  const reconciled = autoInsert(dedup, missing, defaultOrder);

  // (c) validate; fall back to default on hard failure
  const res = validateOrder(reconciled, registry);
  if (!res.valid) {
    warnings.push({ code: 'fallback', message: `stored order invalid (${res.errors.join('; ')}); falling back to default order` });
    return { order: [...defaultOrder], warnings };
  }
  return { order: reconciled, warnings };
}
