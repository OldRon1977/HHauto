/**
 * Ring buffer for the debug log.
 *
 * The old buffer kept the log as one JSON object under a single key. Every
 * single line read that object back out of sessionStorage, parsed it, pruned
 * it, serialised it and wrote all of it again -- measured on the #1815 report:
 * 5000 lines, 525 KB, and roughly three lines a second, so half a megabyte of
 * JSON was parsed and rebuilt three times per second. The cost grew with the
 * buffer, which is why the cap had to stay at 5000 lines: 30 minutes. A night
 * of evidence for a pipeline question was impossible to collect.
 *
 * This store writes plain text into a ring of chunks:
 *
 *   - a line is pushed into an in-memory array (no storage access at all),
 *   - the array is flushed after 4 KB or one second, whichever comes first,
 *   - a flush appends to the CURRENT chunk only, so one write moves at most
 *     CHUNK_BYTES, not the whole log,
 *   - when a chunk is full the next one is taken and cleared. The oldest
 *     content falls out of the ring, exactly like the old line cap, but in
 *     chunk-sized steps instead of line by line.
 *
 * The buffer size is not a guess: the ring is generous, and a quota error
 * drops the oldest chunk and retries. The log therefore grows to whatever the
 * browser actually allows -- roughly 4-8 MB, six hours or more of a busy
 * session, against 30 minutes before.
 *
 * On disk a line is `<epoch-ms base36> TAB <caller> TAB <text>`, newlines in
 * the text escaped. That is about 60 bytes where the old format needed 108,
 * most of it a repeated, human-readable date string. The export rebuilds
 * exactly the old shape (`"<date>.<ms>:<caller>": text`), so every existing
 * debug log reader keeps working.
 *
 * Storage access here is deliberately direct rather than through
 * getStoredValue/setStoredValue: those route through the registry and the
 * quota-retry path, and the quota-retry path clears the log -- which is this
 * module. Keeping it out of that cycle is the point.
 */

import { HHStoredVarPrefixKey, TK } from "../config/StorageKeys";

/** Chunks in the ring. The ring shrinks by itself when the browser refuses. */
const MAX_CHUNKS = 64;
/** Bytes per chunk. One flush rewrites at most this much. */
const CHUNK_BYTES = 128_000;
/** Flush thresholds: whichever is reached first. */
const FLUSH_BYTES = 4_000;
const FLUSH_MS = 1_000;

// Both computed at call time, never at module scope: a top-level read of
// the prefix crashes on a circular import (lesson zirkulaerer-import-tdz-crash).
const idxKey = () => HHStoredVarPrefixKey + "Temp_LogIdx";
const chunkKey = (i: number) => HHStoredVarPrefixKey + "Temp_Log" + i;

interface RingIndex {
    /** Chunk currently being appended to. */
    cur: number;
    /** Chunks in use, oldest first. */
    used: number[];
}

/**
 * Local instead of Utils.safeJsonParse: that module reaches StorageHelper,
 * and the logger must not depend on the thing whose quota errors it recovers
 * from (it would also add an import cycle).
 */
function parseOr<T>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try { return JSON.parse(raw) as T; } catch { return fallback; }
}

let pending: string[] = [];
let pendingBytes = 0;
let hooked = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function readIndex(): RingIndex {
    const raw = sessionStorage.getItem(idxKey());
    const idx = parseOr<RingIndex>(raw, { cur: 0, used: [0] });
    if (!idx || typeof idx.cur !== "number" || !Array.isArray(idx.used) || idx.used.length === 0) {
        return { cur: 0, used: [0] };
    }
    return idx;
}

function writeIndex(idx: RingIndex): void {
    sessionStorage.setItem(idxKey(), JSON.stringify(idx));
}

/** Drop the oldest chunk. Returns false when only the current one is left. */
function dropOldest(idx: RingIndex): boolean {
    if (idx.used.length <= 1) return false;
    const oldest = idx.used.shift() as number;
    sessionStorage.removeItem(chunkKey(oldest));
    return true;
}

/**
 * Write `text` into the current chunk, making room by dropping older chunks
 * when the browser refuses. Returns false only when even an empty ring cannot
 * take the write -- then the log gives up rather than fighting the page for
 * storage.
 */
function writeChunk(idx: RingIndex, text: string): boolean {
    for (;;) {
        try {
            sessionStorage.setItem(chunkKey(idx.cur), text);
            return true;
        } catch {
            if (!dropOldest(idx)) {
                // Nothing left to sacrifice: keep the newest lines, lose the rest.
                try {
                    sessionStorage.setItem(chunkKey(idx.cur), text.slice(-FLUSH_BYTES));
                    return true;
                } catch {
                    return false;
                }
            }
            writeIndex(idx);
        }
    }
}

/** Move to the next chunk of the ring and clear it. */
function advance(idx: RingIndex): void {
    idx.cur = (idx.cur + 1) % MAX_CHUNKS;
    sessionStorage.removeItem(chunkKey(idx.cur));
    // A chunk that comes round again is both the newest and, until it is
    // written, no longer the old one: take it out of the age order first.
    idx.used = idx.used.filter(i => i !== idx.cur);
    idx.used.push(idx.cur);
    if (idx.used.length > MAX_CHUNKS) dropOldest(idx);
}

/** Push everything pending into storage. Called on a timer, and on page exit. */
export function flushLog(): void {
    if (flushTimer !== null) { clearTimeout(flushTimer); flushTimer = null; }
    if (pending.length === 0) return;
    const text = pending.join("");
    pending = [];
    pendingBytes = 0;

    const idx = readIndex();
    const current = sessionStorage.getItem(chunkKey(idx.cur)) ?? "";
    if (current.length + text.length > CHUNK_BYTES && current.length > 0) {
        advance(idx);
        writeChunk(idx, text);
    } else {
        writeChunk(idx, current + text);
    }
    writeIndex(idx);
}

/**
 * The page is about to go away -- and it goes away constantly, because the
 * script navigates. Without this the last second of lines would be lost on
 * every single page change, which is precisely where the interesting ones are.
 */
function installExitHook(): void {
    if (hooked || typeof window === "undefined" || !window.addEventListener) return;
    hooked = true;
    window.addEventListener("pagehide", flushLog);
    window.addEventListener("beforeunload", flushLog);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flushLog();
    });
}

/**
 * Append one line. This is the hot path: no storage access, no serialising.
 *
 * The one-second deadline is a real timer, not a check on the next call. A
 * context that logs a line and then goes quiet -- the game's own iframes do
 * exactly that -- would otherwise sit on it until it was unloaded, and the
 * line would land in the ring long after the ones around it. Measured on the
 * 8.10.47 night log: 14 lines out of 5588 arrived up to 53 minutes late.
 */
export function appendLog(epochMs: number, caller: string, text: string): void {
    installExitHook();
    const line = epochMs.toString(36) + "\t" + caller + "\t"
        + String(text).replace(/\\/g, "\\\\").replace(/\n/g, "\\n") + "\n";
    pending.push(line);
    pendingBytes += line.length;
    if (pendingBytes >= FLUSH_BYTES) { flushLog(); return; }
    if (flushTimer === null && typeof setTimeout === "function") {
        flushTimer = setTimeout(flushLog, FLUSH_MS);
    }
}

/** The whole ring as raw text, oldest line first. */
export function readLogText(): string {
    flushLog();
    const idx = readIndex();
    return idx.used.map(i => sessionStorage.getItem(chunkKey(i)) ?? "").join("");
}

/**
 * The log in the shape the debug export has always had:
 * `{ "<locale date>.<ms>:<caller>": text }`, duplicates within one
 * millisecond suffixed `-1`, `-2`, ... Existing readers of a debug log --
 * including the ones in the issue threads -- keep working unchanged.
 */
export function readLogAsObject(): Record<string, string> {
    const out: Record<string, string> = {};
    // Sorted by time, not by position in the ring: a frame that flushes late
    // would otherwise drop an old line in the middle of newer ones and make
    // the log look like it jumped backwards.
    const decoded: Array<[number, string, string]> = [];
    for (const line of readLogText().split("\n")) {
        if (!line) continue;
        const first = line.indexOf("\t");
        const second = line.indexOf("\t", first + 1);
        if (first < 0 || second < 0) continue;
        const ms = parseInt(line.slice(0, first), 36);
        if (!Number.isFinite(ms)) continue;
        const caller = line.slice(first + 1, second);
        // One pass, so an escaped backslash is not re-read as an escape.
        const text = line.slice(second + 1).replace(/\\(.)/g, (_m, c) => (c === "n" ? "\n" : c));
        decoded.push([ms, caller, text]);
    }
    decoded.sort((a, b) => a[0] - b[0]);
    for (const [ms, caller, text] of decoded) {
        const d = new Date(ms);
        const base = d.toLocaleString() + "." + d.getMilliseconds() + ":" + caller;
        let key = base;
        for (let n = 1; Object.prototype.hasOwnProperty.call(out, key) && n < 10; n++) key = base + "-" + n;
        out[key] = text;
    }
    return out;
}

/** Drop the whole log. Used by the quota-recovery path, which must not write. */
export function clearLog(): void {
    pending = [];
    pendingBytes = 0;
    const idx = readIndex();
    for (const i of idx.used) sessionStorage.removeItem(chunkKey(i));
    sessionStorage.removeItem(idxKey());
    sessionStorage.removeItem(HHStoredVarPrefixKey + TK.Logging);
}

/**
 * Carry a log written by 8.10.46 or older into the ring, once. The old buffer
 * lives in the same tab, so on the reload that brings the new version in, it
 * still holds the running session -- throwing it away would lose exactly the
 * history the user was collecting.
 */
export function importLegacyLog(): void {
    const legacyKey = HHStoredVarPrefixKey + TK.Logging;
    const raw = sessionStorage.getItem(legacyKey);
    if (!raw || !raw.startsWith("{")) return;
    const old = parseOr<Record<string, string>>(raw, {});
    sessionStorage.removeItem(legacyKey);
    if (!old) return;
    // Key shape: "<locale date>.<ms>:<caller>". The date is not worth
    // re-parsing across locales -- the order is what matters, so the imported
    // lines get synthetic stamps that keep their order and stay distinct,
    // ending just before now.
    const entries = Object.entries(old);
    const base = Date.now() - entries.length;
    entries.forEach(([key, text], i) => {
        const caller = key.slice(key.lastIndexOf(":") + 1);
        appendLog(base + i, caller || "imported", String(text));
    });
    flushLog();
}
