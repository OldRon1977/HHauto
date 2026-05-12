// AjaxTracker.ts
//
// Lightweight pending-XHR counter. Installed once at script start.
// Wraps XMLHttpRequest.send to count in-flight requests so the
// navigation layer can wait for the game to finish its current
// AJAX work before changing pages.
//
// Why: window.location.href = ... cancels any in-flight XHR with
// NS_BINDING_ABORTED. When the cancelled request is a state-changing
// POST (e.g. PoP claim), the server can answer the next request with
// HTTP Forbidden. Waiting for AJAX idle before navigating prevents
// that race.
//
// Public API:
//   installAjaxTracker()  -- call once at script start
//   pendingAjaxCount()    -- current number of in-flight XHRs
//   waitForAjaxIdle(timeoutMs, settleMs) -- resolves when idle
//
// Used by: PageNavigationService.gotoPage(), PlaceOfPower module.

import { logHHAuto } from '../Utils/index';

// Shared timing budget for all callers that wait on the game's AJAX
// before navigating. Keeping these constants here means
// PageNavigationService and individual modules cannot drift apart
// (issue #1598: the PoP path used a tighter cap than gotoPage and
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

let pending = 0;
let installed = false;
let restoreSend: (() => void) | null = null;

/**
 * Install the XHR counter hook. Idempotent.
 * Hooks XMLHttpRequest.prototype.send to count in-flight requests
 * via a single loadend listener (covers success, error, abort, timeout).
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

    const origSend = xhrCtor.prototype.send;

    xhrCtor.prototype.send = function (this: XMLHttpRequest, ...args: any[]): void {
        pending++;
        const decrement = (): void => {
            if (pending > 0) pending--;
        };
        // loadend fires once for both success and failure paths
        this.addEventListener('loadend', decrement, { once: true });
        return origSend.apply(this, args);
    };

    restoreSend = (): void => {
        try { xhrCtor.prototype.send = origSend; } catch (e) { /* ignore */ }
    };
    installed = true;
    logHHAuto('[AjaxTracker] installed');
    return true;
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

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Reset internal state and remove the prototype hook. Test-only. */
export function _resetAjaxTrackerForTests(): void {
    if (restoreSend) {
        try { restoreSend(); } catch (e) { /* ignore */ }
    }
    restoreSend = null;
    pending = 0;
    installed = false;
}
