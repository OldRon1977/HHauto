import {
    installAjaxTracker,
    pendingAjaxCount,
    waitForAjaxIdle,
    _resetAjaxTrackerForTests,
} from "../../src/Service/AjaxTracker";

// Minimal fake XHR matching the surface AjaxTracker hooks: send() + addEventListener.
// Each instance fires "loadend" after a configurable delay so tests can simulate
// long-running server requests deterministically.
class FakeXhr {
    private listeners: { [k: string]: Array<() => void> } = {};
    private completeAfterMs: number;

    constructor(completeAfterMs = 0) {
        this.completeAfterMs = completeAfterMs;
    }

    addEventListener(name: string, cb: () => void, _opts?: AddEventListenerOptions): void {
        if (!this.listeners[name]) this.listeners[name] = [];
        this.listeners[name].push(cb);
    }

    // Will be replaced by the original prototype.send swap performed in install().
    send(_body?: any): void {
        setTimeout(() => {
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
    });

    afterEach(() => {
        (global as any).XMLHttpRequest = realXhr;
        _resetAjaxTrackerForTests();
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
        xhr1.send();
        xhr2.send();
        expect(pendingAjaxCount()).toBe(2);
    });

    it("decrements on loadend", async () => {
        installAjaxTracker();
        const xhr = new (global as any).XMLHttpRequest(20);
        xhr.send();
        expect(pendingAjaxCount()).toBe(1);
        await new Promise((r) => setTimeout(r, 60));
        expect(pendingAjaxCount()).toBe(0);
    });

    it("waitForAjaxIdle resolves after pending requests complete", async () => {
        installAjaxTracker();
        const xhr = new (global as any).XMLHttpRequest(50);
        xhr.send();
        expect(pendingAjaxCount()).toBe(1);
        const ok = await waitForAjaxIdle(2000, 0);
        expect(ok).toBe(true);
        expect(pendingAjaxCount()).toBe(0);
    });

    it("waitForAjaxIdle returns false when timeout hits before idle", async () => {
        installAjaxTracker();
        const xhr = new (global as any).XMLHttpRequest(2000);
        xhr.send();
        const ok = await waitForAjaxIdle(150, 0);
        expect(ok).toBe(false);
        expect(pendingAjaxCount()).toBe(1);
    });

    it("install is idempotent (counter does not double)", async () => {
        installAjaxTracker();
        installAjaxTracker(); // second install must not re-wrap send
        const xhr = new (global as any).XMLHttpRequest(20);
        xhr.send();
        expect(pendingAjaxCount()).toBe(1);
        await new Promise((r) => setTimeout(r, 60));
        expect(pendingAjaxCount()).toBe(0);
    });
});
