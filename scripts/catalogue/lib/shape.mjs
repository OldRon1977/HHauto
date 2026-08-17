/**
 * Reduces a value to its skeleton: keys and types, no values.
 *
 * Two reasons this matters. A shape answers the question the catalogue is
 * for -- what does the game call this field and what type is it -- without
 * carrying a single byte of account data, so the output can be read, shared
 * and diffed freely. And shapes collapse: a hundred responses to the same
 * action produce one shape, which is what makes the index readable.
 */

const MAX_DEPTH = 6;
const MAX_KEYS = 60;
const MAX_ARRAY_PROBE = 3;

/** Merges b into a so an optional key seen in only one sample survives. */
export function mergeShapes(a, b) {
    if (a === undefined) return b;
    if (b === undefined) return a;
    if (a === b) return a;
    if (typeof a === 'string' && typeof b === 'string') {
        // "number" plus "string" for the same field is a real finding: the
        // game sends caracs.chance both ways.
        return a === b ? a : [...new Set([...a.split('|'), ...b.split('|')])].sort().join('|');
    }
    if (Array.isArray(a) && Array.isArray(b)) return [mergeShapes(a[0], b[0])];
    if (isObj(a) && isObj(b)) {
        const out = {};
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
            out[k] = mergeShapes(a[k], b[k]);
        }
        return out;
    }
    return 'mixed';
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function shapeOf(value, depth = 0) {
    if (value === null) return 'null';
    if (Array.isArray(value)) {
        if (value.length === 0) return [];
        if (depth >= MAX_DEPTH) return ['…'];
        // Probe a few entries: a list is often heterogeneous at the edges.
        let s;
        for (const v of value.slice(0, MAX_ARRAY_PROBE)) s = mergeShapes(s, shapeOf(v, depth + 1));
        return [s];
    }
    if (typeof value === 'object') {
        if (depth >= MAX_DEPTH) return '{…}';
        const out = {};
        const keys = Object.keys(value);
        for (const k of keys.slice(0, MAX_KEYS)) out[k] = shapeOf(value[k], depth + 1);
        if (keys.length > MAX_KEYS) out['…'] = `+${keys.length - MAX_KEYS} more`;
        return out;
    }
    return typeof value;
}

/** Flattens a shape into one `path: type` line per leaf, sorted. */
export function shapeLines(shape, prefix = '') {
    if (Array.isArray(shape)) {
        if (shape.length === 0) return [`${prefix}[]: empty array`];
        return shapeLines(shape[0], `${prefix}[]`);
    }
    if (isObj(shape)) {
        return Object.entries(shape).flatMap(([k, v]) =>
            shapeLines(v, prefix ? `${prefix}.${k}` : k));
    }
    return [prefix ? `${prefix}: ${shape}` : String(shape)];
}

/**
 * Names a call the way the game identifies it.
 *
 * Most calls carry `action`. Some carry only `class` -- the team-battle
 * submit sends class/battle_type/battles_amount/defender_id/attacker[team][]
 * and no action at all. Calling that "(unknown)" reads as a failure of this
 * tool when it is a fact about the request, so it gets said plainly.
 *
 * `battle_type` is kept by value because it is the discriminator between
 * otherwise identical calls, and its values are game words (leagues, seasons)
 * rather than anything about the account. Nothing else is.
 */
export function labelCall(params, url) {
    const fromUrl = () => {
        try { return new URL(url).searchParams.get('action'); } catch { return null; }
    };
    const action = params.action || fromUrl();
    const cls = params.class || null;
    const variant = params.battle_type ? `[${params.battle_type}]` : '';

    if (action) return { key: (cls ? cls + '.' : '') + action + variant, action, class: cls, actionless: false };
    if (cls) return { key: cls + variant + ' (no action key)', action: null, class: cls, actionless: true };
    return { key: '(unidentified)' + variant, action: null, class: null, actionless: true };
}
