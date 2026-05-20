import {
    installAjaxTracker,
    pendingAjaxCount,
    waitForAjaxIdle,
    acquirePostMutex,
    releasePostMutex,
    isPostInFlight,
    awaitServerSettleAfterPost,
    setOnAjaxForbidden,
    POST_MUTEX_STALE_MS,
    POST_SETTLE_MIN_MS,
    POST_SETTLE_FACTOR,
    _resetAjaxTrackerForTests,
} from "../../src/Service/AjaxTracker";
import {
    recordForbidden,
    FORBIDDEN_COUNT_KEY,
    FORBIDDEN_LAST_AT_KEY,
} from "../../src/Service/ForbiddenBackoff";

// `global` is provided by Jest (jsdom env) but the project's lint config
// does not declare it, so keep this ambient declaration alongside the
// existing one in this file's predecessors.
declare const global: any;

// Minimal fake XHR matching the surface AjaxTracker hooks: open(),
// send() and addEventListener. Each instance fires "loadend" after a
// configurable delay so tests can simulate long-running server
// requests deterministically. The status property is settable by the
// test so we can drive the 403 detection path.
class FakeXhr {
    public status: number = 200;
    private listeners: { [k: string]: Array<() => void> } = {};
    private completeAfterMs: number;
    private finalStatus: number;

    constructor(completeAfterMs = 0, finalStatus = 200) {
        this.completeAfterMs = completeAfterMs;
        this.finalStatus = finalStatus;
    }

    addEventListener(name: string, cb: () => void, _opts?: any): void {
        if (!this.listeners[name]) this.listeners[name] = [];
        this.listeners[name].push(cb);
    }

    // Replaced by the prototype hook installed in installAjaxTracker().
    open(_method: string, _url: string): void { /* no-op */ }
    send(_body?: any): void {
        setTimeout(() => {
            this.status = this.finalStatus;
            (this.listeners["loadend"] || []).forEach((cb) => cb());
        }, this.completeAfterMs);
    }
}

describe("AjaxTracker", () => {
    let realXhr: typeof XMLHttpRequest;

    beforeEach(() => {
        _resetAjaxTrackerForTests();
        realXhr = (global as any).XMLHttpRequest;
        // Patch the global XMLHttpRequest with our fake before installing the tracker.
        (global as any).XMLHttpRequest = FakeXhr as any;
        try { sessionStorage.clear(); } catch (e) { /* ignore */ }
        // Wire the production-equivalent forbidden listener (StartService
        // does this at boot time; tests need to do it explicitly).
        setOnAjaxForbidden(() => { recordForbidden(); });
    });

    afterEach(() => {
        (global as any).XMLHttpRequest = realXhr;
        _resetAjaxTrackerForTests();
        try { sessionStorage.clear(); } catch (e) { /* ignore */ }
    });

    it("returns 0 pending when not installed", () => {
        expect(pendingAjaxCount()).toBe(0);
    });

    it("waitForAjaxIdle resolves immediately when not installed", async () => {
        const start = Date.now();
        const ok = await waitForAjaxIdle(1000, 0);
        expect(ok).toBe(true);
        expect(Date.now() - start).toBeLessThan(50);
    });

    it("counts in-flight requests after install", () => {
        installAjaxTracker();
        const xhr1 = new (global as any).XMLHttpRequest(1000);
        const xhr2 = new (global as any).XMLHttpRequest(1000);
        xhr1.open("POST", "/ajax.php");
        xhr2.open("POST", "/ajax.php");
        xhr1.send();
        xhr2.send();
        expect(pendingAjaxCount()).toBe(2);
    });

    it("decrements on loadend", async () => {
        installAjaxTracker();
        const xhr = new (global as any).XMLHttpRequest(20);
        xhr.open("POST", "/ajax.php");
        xhr.send();
        expect(pendingAjaxCount()).toBe(1);
        await new Promise((r) => setTimeout(r, 60));
        expect(pendingAjaxCount()).toBe(0);
    });

    it("waitForAjaxIdle resolves after pending requests complete", async () => {
        installAjaxTracker();
        const xhr = new (global as any).XMLHttpRequest(50);
        xhr.open("GET", "/some/asset.png");
        xhr.send();
        expect(pendingAjaxCount()).toBe(1);
        const ok = await waitForAjaxIdle(2000, 0);
        expect(ok).toBe(true);
        expect(pendingAjaxCount()).toBe(0);
    });

    it("waitForAjaxIdle returns false when timeout hits before idle", async () => {
        installAjaxTracker();
        const xhr = new (global as any).XMLHttpRequest(2000);
        xhr.open("GET", "/slow");
        xhr.send();
        const ok = await waitForAjaxIdle(150, 0);
        expect(ok).toBe(false);
        expect(pendingAjaxCount()).toBe(1);
    });

    it("install is idempotent (counter does not double)", async () => {
        installAjaxTracker();
        installAjaxTracker(); // second install must not re-wrap send
        const xhr = new (global as any).XMLHttpRequest(20);
        xhr.open("POST", "/ajax.php");
        xhr.send();
        expect(pendingAjaxCount()).toBe(1);
        await new Promise((r) => setTimeout(r, 60));
        expect(pendingAjaxCount()).toBe(0);
    });

    describe("POST mutex", () => {
        it("acquire/release roundtrip works", () => {
            expect(isPostInFlight()).toBe(false);
            expect(acquirePostMutex("test")).toBe(true);
            expect(isPostInFlight()).toBe(true);
            releasePostMutex();
            expect(isPostInFlight()).toBe(false);
        });

        it("second acquire fails while held", () => {
            expect(acquirePostMutex("first")).toBe(true);
            expect(acquirePostMutex("second")).toBe(false);
            releasePostMutex();
        });

        it("release is idempotent", () => {
            releasePostMutex();
            releasePostMutex();
            expect(isPostInFlight()).toBe(false);
        });

        it("stale lock is released after POST_MUTEX_STALE_MS", () => {
            const realNow = Date.now;
            try {
                let fakeNow = 1_000_000;
                Date.now = () => fakeNow;

                expect(acquirePostMutex("stale-holder")).toBe(true);
                expect(acquirePostMutex("contender")).toBe(false);

                // Advance past the stale-lock threshold.
                fakeNow += POST_MUTEX_STALE_MS + 1;

                // Either acquirePostMutex or isPostInFlight may release
                // the stale lock; both code paths must agree.
                expect(acquirePostMutex("new-holder")).toBe(true);
                releasePostMutex();
            } finally {
                Date.now = realNow;
            }
        });

        it("isPostInFlight reports tracked POSTs separately from explicit mutex", () => {
            installAjaxTracker();
            const xhr = new (global as any).XMLHttpRequest(50);
            xhr.open("POST", "/ajax.php");
            xhr.send();
            expect(isPostInFlight()).toBe(true);
            return new Promise<void>((resolve) => setTimeout(() => {
                expect(isPostInFlight()).toBe(false);
                resolve();
            }, 80));
        });

        it("GET requests do not flag isPostInFlight", () => {
            installAjaxTracker();
            const xhr = new (global as any).XMLHttpRequest(2000);
            xhr.open("GET", "/some/asset.png");
            xhr.send();
            expect(pendingAjaxCount()).toBe(1);
            expect(isPostInFlight()).toBe(false);
        });

        it("non-/ajax.php POSTs do not flag isPostInFlight", () => {
            installAjaxTracker();
            const xhr = new (global as any).XMLHttpRequest(2000);
            xhr.open("POST", "/leagues/refresh");
            xhr.send();
            expect(pendingAjaxCount()).toBe(1);
            expect(isPostInFlight()).toBe(false);
        });
    });

    describe("403 detection", () => {
        it("records a Forbidden in sessionStorage when /ajax.php POST returns 403", async () => {
            installAjaxTracker();
            const xhr = new (global as any).XMLHttpRequest(20, 403);
            xhr.open("POST", "/ajax.php?case=foo");
            xhr.send();
            await new Promise((r) => setTimeout(r, 60));
            const stored = sessionStorage.getItem(FORBIDDEN_COUNT_KEY);
            expect(stored).toBe("1");
            const ts = sessionStorage.getItem(FORBIDDEN_LAST_AT_KEY);
            expect(ts).not.toBeNull();
        });

        it("does not record Forbidden for 200 responses", async () => {
            installAjaxTracker();
            const xhr = new (global as any).XMLHttpRequest(20, 200);
            xhr.open("POST", "/ajax.php");
            xhr.send();
            await new Promise((r) => setTimeout(r, 60));
            expect(sessionStorage.getItem(FORBIDDEN_COUNT_KEY)).toBeNull();
        });

        it("does not record Forbidden for 403 on non-ajax URLs", async () => {
            installAjaxTracker();
            const xhr = new (global as any).XMLHttpRequest(20, 403);
            xhr.open("GET", "/something/else");
            xhr.send();
            await new Promise((r) => setTimeout(r, 60));
            expect(sessionStorage.getItem(FORBIDDEN_COUNT_KEY)).toBeNull();
        });
    });

    describe("awaitServerSettleAfterPost", () => {
        it("floors below the minimum on small claim durations", async () => {
            const start = Date.now();
            await awaitServerSettleAfterPost(100);
            const elapsed = Date.now() - start;
            expect(elapsed).toBeGreaterThanOrEqual(POST_SETTLE_MIN_MS - 50); // some scheduler slack
            expect(elapsed).toBeLessThan(POST_SETTLE_MIN_MS + 500);
        });

        it("scales with the claim duration via POST_SETTLE_FACTOR", async () => {
            // Choose a claim duration that puts factor * claim above the
            // minimum but well below the Jest default timeout (5s) so
            // this test stays fast.
            const claimMs = 700;
            const expected = claimMs * POST_SETTLE_FACTOR; // 2800ms
            expect(expected).toBeGreaterThan(POST_SETTLE_MIN_MS);
            expect(expected).toBeLessThan(4500);
            const start = Date.now();
            await awaitServerSettleAfterPost(claimMs);
            const elapsed = Date.now() - start;
            expect(elapsed).toBeGreaterThanOrEqual(expected - 100);
            expect(elapsed).toBeLessThan(expected + 1000);
        });

        it("treats invalid input as zero duration", async () => {
            const start = Date.now();
            await awaitServerSettleAfterPost(NaN);
            const elapsed = Date.now() - start;
            expect(elapsed).toBeGreaterThanOrEqual(POST_SETTLE_MIN_MS - 50);
            expect(elapsed).toBeLessThan(POST_SETTLE_MIN_MS + 500);
        });
    });
});
