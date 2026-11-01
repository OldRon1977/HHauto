import {
    installAjaxTracker,
    waitForGameAnswer,
    _resetAjaxTrackerForTests,
} from "../../src/Service/AjaxTracker";
import { HaremGirl } from "../../src/Module/harem/HaremGirl";

type XhrCtor = new (completeAfterMs?: number) => { open(m: string, u: string): void; send(): void };
const g = globalThis as unknown as { XMLHttpRequest: XhrCtor };

// Holds the timing both waits have today: a 150 ms lead, then the AJAX-idle
// wait bounded by the caller's budget, then a 250 ms settle. HaremGirl's wait
// takes its budget from GAME_DATA_TIMEOUT_MS, which the girl specs lower.
class FakeXhr {
    public status = 200;
    private listeners: { [k: string]: Array<() => void> } = {};
    constructor(private completeAfterMs = 0) {}
    addEventListener(name: string, cb: () => void): void {
        (this.listeners[name] = this.listeners[name] || []).push(cb);
    }
    open(_method: string, _url: string): void { /* hooked by the tracker */ }
    send(): void {
        setTimeout(() => (this.listeners["loadend"] || []).forEach((cb) => cb()), this.completeAfterMs);
    }
}

function startRequest(ms: number): void {
    const xhr = new g.XMLHttpRequest(ms);
    xhr.open("POST", "/ajax.php");
    xhr.send();
}

describe("waiting for the game's answer", () => {
    let realXhr: XhrCtor;
    let savedTimeout: number;

    beforeEach(() => {
        _resetAjaxTrackerForTests();
        realXhr = g.XMLHttpRequest;
        g.XMLHttpRequest = FakeXhr;
        installAjaxTracker();
        savedTimeout = HaremGirl.GAME_DATA_TIMEOUT_MS;
    });

    afterEach(() => {
        HaremGirl.GAME_DATA_TIMEOUT_MS = savedTimeout;
        g.XMLHttpRequest = realXhr;
        _resetAjaxTrackerForTests();
    });

    it("waitForGameAnswer: idle -> true after the lead and the settle", async () => {
        const start = Date.now();
        await expect(waitForGameAnswer()).resolves.toBe(true);
        expect(Date.now() - start).toBeGreaterThanOrEqual(390);
    });

    it("waitForGameData: idle -> true after the lead and the settle", async () => {
        const start = Date.now();
        await expect(HaremGirl.waitForGameData()).resolves.toBe(true);
        expect(Date.now() - start).toBeGreaterThanOrEqual(390);
    });

    it("waitForGameData: an answer inside the budget -> true", async () => {
        HaremGirl.GAME_DATA_TIMEOUT_MS = 1000;
        startRequest(300);
        await expect(HaremGirl.waitForGameData()).resolves.toBe(true);
    });

    it("waitForGameData: no answer inside GAME_DATA_TIMEOUT_MS -> false, bounded by it", async () => {
        HaremGirl.GAME_DATA_TIMEOUT_MS = 300;
        startRequest(5000);
        const start = Date.now();
        await expect(HaremGirl.waitForGameData()).resolves.toBe(false);
        const took = Date.now() - start;
        expect(took).toBeGreaterThanOrEqual(150 + 300 + 250 - 10);
        expect(took).toBeLessThan(2000);
    });
});
