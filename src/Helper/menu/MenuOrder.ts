// MenuOrder.ts
//
// Pure order resolution for the settings-menu areas (#1834). No DOM, no
// storage, no imports: the stored order goes in, the effective order comes out,
// so this is fully unit-testable (spec/Helper/menu/MenuOrder.spec.ts) and stays
// a graph leaf.
//
// The contract mirrors OrderResolver for the pipeline blocks, minus the
// constraints -- settings areas may sit in any order:
//   - an id the build does not know any more is dropped (an area removed in a
//     later version must not leave a hole in the menu);
//   - an id the stored order does not mention is inserted after its nearest
//     preceding neighbour from the default order (a NEW area shows up next to
//     where it was designed to be, not appended at the bottom where nobody
//     looks);
//   - anything unusable (no array, wrong element types, empty after filtering)
//     falls back to the default order.

/**
 * Effective area order from a stored order and the build's default order.
 * `stored` is deliberately `unknown`: it comes from localStorage via
 * JSON.parse and may be anything at all.
 */
export function resolveMenuOrder(stored: unknown, defaultIds: readonly string[]): string[] {
    const known = new Set(defaultIds);
    const placed = new Set<string>();
    const result: string[] = [];

    if (Array.isArray(stored)) {
        for (const raw of stored) {
            if (typeof raw !== "string") continue;
            if (!known.has(raw) || placed.has(raw)) continue;
            placed.add(raw);
            result.push(raw);
        }
    }
    if (result.length === 0) return [...defaultIds];

    // Walking the default order forwards means a run of new areas keeps its
    // relative order, because each one is already placed when the next looks
    // for its preceding neighbour.
    for (let i = 0; i < defaultIds.length; i++) {
        const id = defaultIds[i];
        if (placed.has(id)) continue;
        let at = 0;
        for (let j = i - 1; j >= 0; j--) {
            const idx = result.indexOf(defaultIds[j]);
            if (idx !== -1) { at = idx + 1; break; }
        }
        result.splice(at, 0, id);
        placed.add(id);
    }
    return result;
}

/** True when `order` is the build default -- then nothing needs to be stored. */
export function isDefaultMenuOrder(order: readonly string[], defaultIds: readonly string[]): boolean {
    return order.length === defaultIds.length && order.every((id, i) => id === defaultIds[i]);
}
