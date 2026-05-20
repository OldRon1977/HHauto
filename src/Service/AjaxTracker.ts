// AjaxTracker.ts
//
// XHR tracker plus a global mutex for state-changing /ajax.php POSTs.
// Installed once at script start.
//
// Why the counter exists:
//   window.location.href = ... cancels any in-flight XHR with
//   NS_BINDING_ABORTED. When the cancelled request is a state-changing
//   POST (e.g. PoP claim), the server can answer the next request with
//   HTTP Forbidden. waitForAjaxIdle() lets the navigation layer wait
//   for the queue to drain before changing pages.
//
// Why the mutex exists (issue 1598, ADR-003):
//   On accounts with very large rosters the server takes 5-7s per POST,
//   while AutoLoop ticks every ~1s. Multiple handlers each fire their
//   own POST per tick, and the server bot-detection rate-limits the
//   resulting burst with HTTP Forbidden. The mutex serialises script-
//   triggered POSTs and gives the server time to settle before the
//   next action.
//
// Why awaitServerSettleAfterPost lives here:
//   The HTTP loadend marks "response received", but the server-side
//   write (DB, world state) keeps running for some time after that.
//   Acting on the next request before the write completes also
//   triggers Forbidden. The settle helper pauses long enough for the
//   write to finish, sized off the actual XHR duration so it stays
//   short on small accounts and long on large ones.
//
// Public API:
//   installAjaxTracker()              -- call once at script start
//   pendingAjaxCount()                -- in-flight XHR count
//   waitForAjaxIdle(timeoutMs, settleMs)
//   acquirePostMutex(holderName?)     -- explicit caller mutex
//   releasePostMutex()
//   isPostInFlight()                  -- any tracked POST or held mutex
//   awaitServerSettleAfterPost(durMs) -- post-claim pause
//
// Used by:
//   PageNavigationService (idle wait), PlaceOfPower (claim path),
//   AutoLoop (tick-gate).
import { logHHAuto } from "../Utils/LogUtils";

// Shared timing budget for all callers that wait on the game's AJAX
// before navigating. Keeping these constants here means
// PageNavigationService and individual modules cannot drift apart
// (issue 1598: the PoP path used a tighter cap than gotoPage and
// ignored timeouts, which re-introduced the cancel-mid-POST race).
//
// 15s is a conservative cap that covers the worst case observed in
// Firefox Private Browsing (10-12s claim responses). The wait
// short-circuits as soon as the queue is empty, so the typical path
// stays fast.
export const AJAX_IDLE_TIMEOUT_MS = 15000;
// Extra delay after AJAX idle before navigating, to let synchronous
// follow-up code (DOM updates, popup handling) finish.
export const AJAX_IDLE_SETTLE_MS = 250;

// Stale-lock timeout for the explicit POST mutex. If a holder forgets
// to call releasePostMutex(), the mutex is force-released after this
// many milliseconds so the script does not deadlock. 30s covers the
// worst observed claim XHR + settle pause on the 2400-girls account.
export const POST_MUTEX_STALE_MS = 30_000;

// Server-settle minimum pause and amplification factor for
// awaitServerSettleAfterPost(). Frank-Capture: claim XHR 6.7s,
// observed safe gap before next request ~25-30s -> factor 4.
// Math.max keeps small accounts fast (a 200ms claim still gets a 2s
// pause, large accounts get the longer wait).
export const POST_SETTLE_MIN_MS = 2000;
export const POST_SETTLE_FACTOR = 4;

// Optional callback invoked when /ajax.php returns HTTP 403. Decoupled
// via setter to avoid a circular import between AjaxTracker and
// ForbiddenBackoff (ForbiddenBackoff -> HHStoredVars -> PlaceOfPower
// -> AjaxTracker). StartService wires recordForbidden in here right
// after installAjaxTracker() so the dependency edge runs in the right
// direction.
let onAjaxForbidden: (() => void) | null = null;

let pending = 0;
let installed = false;
let restoreSend: (() => void) | null = null;
let restoreOpen: (() => void) | null = null;

// Explicit POST mutex state. Acquired by callers (e.g. PoP claim) to
// serialise their state-changing POSTs. The auto-tracking path below
// never sets postMutexHeld -- it only feeds isPostInFlight() via the
// pending counter.
let postMutexHeld = false;
let postMutexHolder = "";
let postMutexAcquiredAt = 0;

// Track POSTs to /ajax.php separately from the general pending counter.
// AutoLoop uses isPostInFlight() to skip its tick when a state-changing
// POST is still being processed. GET-only XHRs (asset preloads, etc.)
// must not gate the tick.
let pendingAjaxPosts = 0;

const AJAX_POST_PATH = "/ajax.php";

/** Returns true if `url` looks like an /ajax.php request. */
function isAjaxPostUrl(url: unknown): boolean {
    if (typeof url !== "string") return false;
    // Match relative ("/ajax.php"), query ("/ajax.php?..."), and
    // absolute ("https://.../ajax.php") forms. Case-sensitive: the
    // game always uses lowercase.
    return url.indexOf(AJAX_POST_PATH) !== -1;
}

/**
 * Install the XHR counter hook. Idempotent.
 * Hooks XMLHttpRequest.prototype.open and send to:
 *   - count in-flight requests for waitForAjaxIdle()
 *   - track /ajax.php POSTs separately for isPostInFlight()
 *   - detect HTTP 403 responses on /ajax.php for ForbiddenBackoff
 *
 * Returns true if the hook was installed (or was already installed),
 * false if no XMLHttpRequest constructor is available in this scope.
 */
export function installAjaxTracker(): boolean {
    if (installed) return true;

    // Resolve the constructor lazily so tests can swap the global
    // XMLHttpRequest before calling install().
    const xhrCtor: any = (typeof window !== 'undefined' && (window as any).XMLHttpRequest)
        || (typeof globalThis !== 'undefined' && (globalThis as any).XMLHttpRequest)
        || (typeof XMLHttpRequest !== 'undefined' ? XMLHttpRequest : undefined);
    if (!xhrCtor || !xhrCtor.prototype || typeof xhrCtor.prototype.send !== 'function') {
        return false;
    }

    const origOpen = xhrCtor.prototype.open;
    const origSend = xhrCtor.prototype.send;

    xhrCtor.prototype.open = function (
        this: XMLHttpRequest,
        method: string,
        url: string,
        ...rest: any[]
    ): void {
        try {
            (this as any).__hhMethod = typeof method === 'string' ? method.toUpperCase() : '';
            (this as any).__hhUrl = url;
            (this as any).__hhIsAjaxPost =
                (this as any).__hhMethod === 'POST' && isAjaxPostUrl(url);
        } catch (e) { /* ignore */ }
        return origOpen.apply(this, [method, url, ...rest] as any);
    };

    xhrCtor.prototype.send = function (this: XMLHttpRequest, ...args: any[]): void {
        pending++;
        const isAjaxPost = !!(this as any).__hhIsAjaxPost;
        if (isAjaxPost) pendingAjaxPosts++;

        let decremented = false;
        const decrement = (): void => {
            if (decremented) return;
            decremented = true;
            if (pending > 0) pending--;
            if (isAjaxPost && pendingAjaxPosts > 0) pendingAjaxPosts--;
        };

        // loadend fires once for both success and failure paths
        this.addEventListener('loadend', () => {
            try {
                if (isAjaxPost && this.status === 403 && onAjaxForbidden) {
                    onAjaxForbidden();
                }
            } catch (e) { /* ignore */ }
            decrement();
        }, { once: true });

        return origSend.apply(this, args);
    };

    restoreOpen = (): void => {
        try { xhrCtor.prototype.open = origOpen; } catch (e) { /* ignore */ }
    };
    restoreSend = (): void => {
        try { xhrCtor.prototype.send = origSend; } catch (e) { /* ignore */ }
    };
    installed = true;
    logHHAuto('[AjaxTracker] installed');
    return true;
}

/**
 * Register a callback invoked when an /ajax.php POST returns HTTP 403.
 * Pass null to clear. The callback receives no arguments.
 *
 * Decoupled via setter (instead of importing recordForbidden from
 * ForbiddenBackoff directly) because ForbiddenBackoff transitively
 * imports HHStoredVars, which imports PlaceOfPower, which imports
 * this module. A direct import would create a TDZ cycle that crashes
 * the bundle at boot ("Cannot access 'HHStoredVarPrefixKey' before
 * initialization").
 */
export function setOnAjaxForbidden(cb: (() => void) | null): void {
    onAjaxForbidden = cb;
}

/** Number of in-flight XMLHttpRequests. Returns 0 if tracker is not installed. */
export function pendingAjaxCount(): number {
    return pending;
}

/**
 * Resolve when AJAX is idle (no pending XHRs) or after timeoutMs.
 * After idle is detected, wait an extra settleMs to let synchronous
 * follow-up code (e.g. DOM updates triggered by the response) finish.
 *
 * Polls every 50ms. Returns true if idle was reached, false on timeout.
 */
export async function waitForAjaxIdle(
    timeoutMs: number = 8000,
    settleMs: number = 250,
): Promise<boolean> {
    if (!installed) {
        // Tracker not installed -> behave like immediate idle, just settle.
        await sleep(settleMs);
        return true;
    }

    const deadline = Date.now() + timeoutMs;
    while (pending > 0 && Date.now() < deadline) {
        await sleep(50);
    }

    const reachedIdle = pending === 0;
    if (!reachedIdle) {
        logHHAuto(`[AjaxTracker] waitForAjaxIdle timeout, ${pending} request(s) still pending`);
    }
    if (settleMs > 0) {
        await sleep(settleMs);
    }
    return reachedIdle;
}

// --- POST mutex ----------------------------------------------------

/**
 * Acquire the explicit POST mutex. Returns true when the caller now
 * holds the lock, false if another caller still holds it. Stale locks
 * (older than POST_MUTEX_STALE_MS) are force-released so a forgotten
 * release does not freeze the script.
 *
 * Holder name is purely for logs; pass a short identifier such as
 * "pop:claim" so the log line tells you who is blocking.
 */
export function acquirePostMutex(holderName: string = "anonymous"): boolean {
    if (postMutexHeld) {
        const heldFor = Date.now() - postMutexAcquiredAt;
        if (heldFor > POST_MUTEX_STALE_MS) {
            logHHAuto(
                '[AjaxTracker] POST mutex stale-released after ' + heldFor +
                'ms (was held by ' + (postMutexHolder || 'unknown') + ')',
            );
            postMutexHeld = false;
        } else {
            return false;
        }
    }
    postMutexHeld = true;
    postMutexHolder = holderName;
    postMutexAcquiredAt = Date.now();
    return true;
}

/** Release the explicit POST mutex. Idempotent: safe to call when not held. */
export function releasePostMutex(): void {
    postMutexHeld = false;
    postMutexHolder = "";
    postMutexAcquiredAt = 0;
}

/**
 * True when either the explicit mutex is held OR a /ajax.php POST is
 * currently in-flight (auto-tracked). AutoLoop uses this to skip its
 * tick so handlers do not stack new POSTs on top of one already in
 * progress.
 */
export function isPostInFlight(): boolean {
    if (postMutexHeld) {
        // Stale-lock release path also runs here so AutoLoop is not
        // pinned by a forgotten holder.
        const heldFor = Date.now() - postMutexAcquiredAt;
        if (heldFor > POST_MUTEX_STALE_MS) {
            logHHAuto(
                '[AjaxTracker] POST mutex stale-released after ' + heldFor +
                'ms (was held by ' + (postMutexHolder || 'unknown') + ')',
            );
            releasePostMutex();
        } else {
            return true;
        }
    }
    return pendingAjaxPosts > 0;
}

/**
 * Pause after a state-changing POST so the server can finish its
 * write before the next request hits. Empirically sized off the
 * just-completed XHR duration: claim XHR 6.7s -> settle ~27s on the
 * 2400-girls account, claim XHR 200ms -> settle 2s (floor) on small
 * accounts.
 *
 * Caller measures the XHR duration and passes it in. If the caller
 * does not have one, pass 0 to get the minimum pause.
 */
export async function awaitServerSettleAfterPost(claimXhrDurationMs: number): Promise<void> {
    const durationMs = Number.isFinite(claimXhrDurationMs) && claimXhrDurationMs > 0
        ? claimXhrDurationMs
        : 0;
    const settle = Math.max(POST_SETTLE_MIN_MS, Math.round(durationMs * POST_SETTLE_FACTOR));
    logHHAuto('[AjaxTracker] server-settle pause ' + settle + 'ms (claim ' + Math.round(durationMs) + 'ms)');
    await sleep(settle);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Reset internal state and remove the prototype hook. Test-only. */
export function _resetAjaxTrackerForTests(): void {
    if (restoreSend) {
        try { restoreSend(); } catch (e) { /* ignore */ }
    }
    if (restoreOpen) {
        try { restoreOpen(); } catch (e) { /* ignore */ }
    }
    restoreSend = null;
    restoreOpen = null;
    pending = 0;
    pendingAjaxPosts = 0;
    postMutexHeld = false;
    postMutexHolder = "";
    postMutexAcquiredAt = 0;
    onAjaxForbidden = null;
    installed = false;
}