// MouseService.ts
//
// Pauses automation while the user is actively interacting with the
// page. Binds mousemove, scroll, and mouseup events that set a
// "mouseBusy" flag for a configurable timeout (default 5s).
//
// The in-memory mouseBusy flag does not survive a page reload. Because
// the game navigates via full page reloads, manual navigation used to
// give the bot a clean slate: the first scheduler tick fired before any
// fresh mouse event re-armed the pause, so the bot navigated away from
// the page the user had just opened (issue #1774). To fix this the
// last activity timestamp is persisted in sessionStorage (survives a
// same-tab reload) and a short startup grace period blocks automation
// right after every load while mouse-pause is enabled.
//
// While the pause is active (isUserPauseActive), AutoLoop and the
// Scheduler skip all actions to avoid interfering with manual gameplay.
//
// Used by: StartService (binds events), AutoLoop + Scheduler (check pause)
import { getStoredValue, setStoredValue } from "../Helper/StorageHelper";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK, TK } from "../config/StorageKeys";

// Timestamp of this script execution. Module evaluation happens once per
// page load (the userscript runs fresh on every navigation), so this
// approximates the page-load time and is used for the startup grace.
const SCRIPT_START_TS = Date.now();

// Startup grace period: while mouse-pause is enabled, automation is held
// for this long after each page load so a manual navigation is not
// immediately undone by the first scheduler tick (issue #1774).
const STARTUP_GRACE_MS = 2000;

// Minimum gap between persisted-activity writes. mousemove fires very
// frequently; without throttling every pixel of movement would hit
// sessionStorage.
const ACTIVITY_WRITE_THROTTLE_MS = 500;

const DEFAULT_MOUSE_TIMEOUT_MS = 5000;

export let mouseBusy:boolean = false;
export let mouseBusyTimeout:ReturnType<typeof setTimeout> | number = 0;
let lastActivityWrite = 0;

function getMouseTimeout(): number {
    const raw = Number(getStoredValue(HHStoredVarPrefixKey + SK.mousePauseTimeout));
    return Number.isInteger(raw) ? raw : DEFAULT_MOUSE_TIMEOUT_MS;
}

function persistActivity(now: number) {
    if (now - lastActivityWrite < ACTIVITY_WRITE_THROTTLE_MS) return;
    lastActivityWrite = now;
    setStoredValue(HHStoredVarPrefixKey + TK.mouseLastActivity, String(now));
}

export function makeMouseBusy(ms: number) {
    clearTimeout(mouseBusyTimeout);
    mouseBusy = true;
    mouseBusyTimeout = setTimeout(function(){mouseBusy = false;}, ms);
    persistActivity(Date.now());
};

/**
 * True while automation must stay paused for user activity. Only active
 * when the mouse-pause feature is enabled. Combines three signals:
 *  - the in-memory mouseBusy flag (recent activity on this page),
 *  - persisted activity from just before a reload (survives navigation),
 *  - the startup grace period right after a page load.
 */
export function isUserPauseActive(): boolean {
    if (getStoredValue(HHStoredVarPrefixKey + SK.mousePause) !== "true") return false;
    if (mouseBusy) return true;

    const now = Date.now();
    const lastActivity = Number(getStoredValue(HHStoredVarPrefixKey + TK.mouseLastActivity));
    if (Number.isFinite(lastActivity) && lastActivity > 0 && now - lastActivity < getMouseTimeout()) {
        return true;
    }
    if (now - SCRIPT_START_TS < STARTUP_GRACE_MS) return true;
    return false;
}

export function bindMouseEvents(){
    const mouseTimeoutVal = Number.isInteger(Number(getStoredValue(HHStoredVarPrefixKey+SK.mousePauseTimeout))) ? Number(getStoredValue(HHStoredVarPrefixKey+SK.mousePauseTimeout)) : DEFAULT_MOUSE_TIMEOUT_MS;
        document.onmousemove = function() { makeMouseBusy(mouseTimeoutVal); };
        document.onscroll = function() { makeMouseBusy(mouseTimeoutVal); };
        document.onmouseup = function() { makeMouseBusy(mouseTimeoutVal); };
}
