// WorkPause.ts -- Keep the pipeline out while the player works on a team or
// on the hero's gear.
//
// Working on a team is a sequence, not one click: calculate, Apply (the page
// reloads), Team gear (it reloads again), Level-up gear, Level-up team or
// Stuff Team (they leave for the upgrade, harem, girl and quest pages and
// come back). Measured on a
// live account (#1888): the in-memory hold of AutoLoopHold.ts covered the
// calculation itself, but one second after it ended a due League block left
// edit-team, and Apply pressed a second later saved the team while the page
// was already going -- the team fought without gear and skills. After every
// reload the first tick runs the pipeline before HHauto's own button is even
// on the page again, so nothing that lives in memory or in the popup can
// cover this.
//
// The pause therefore lives in sessionStorage (Temp_workPause) and is asked
// every tick before the pipeline, the first tick after a reload included.
//
// It has a zone: the team pages (edit-team and the team list), started by the
// team popup, or the market, started by the HH Gear menu -- the gear work on
// the market is the same kind of sequence: preview, Equip (the page reloads),
// Upgrade Gear over the upgrade pages and back. The pause holds
//   - on the pages of its zone,
//   - on every page of a running Level-up team (the grade quests included),
//     Stuff Team, Level-up gear or Upgrade Gear,
//   - on the way back to the zone after such a run finished.
// It ends when the player leaves the zone by their own hand, presses
// "Resume automation" on the notice every held page shows, after
// WORK_PAUSE_IDLE_MS without any sign of work, or when a run gives up -- the
// run then sends the player home.
//
// The decision is WorkPause.pure.ts; this file reads its input and acts.
//
// The end of Stuff Team and Level-up team sets returnToZone on the stored state itself, in the
// harem girl module: importing this file there would close new import cycles.
//
// Used by: AutoLoop.ts (asks it every tick), TeamModule.ts,
//   TeamSelectionPopup.ts, TeamGear.ts, EquipmentGear.ts

import { ConfigHelper } from "../Helper/ConfigHelper";
import { getTextForUI } from "../Helper/LanguageHelper";
import { getPage } from "../Helper/PageHelper";
import { deleteStoredValue, getStoredJSON, getStoredValue, setStoredValue } from "../Helper/StorageHelper";
import { logHHAuto } from "../Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { TK } from "../config/StorageKeys";
import { autoLoopHolder } from "./AutoLoopHold";
import { kickAutoLoop } from "./AutoLoopKick";
import { GIRL_UPGRADE_PATH, UPGRADE_PATH } from "./EquipmentUpgradeService";
import { gotoPage } from "./PageNavigationService";
import { WORK_PAUSE_IDLE_MS, WorkPauseState, WorkZone, decideWorkPause } from "./WorkPause.pure";

/** Built at call time: a top-level read of HHStoredVarPrefixKey can hit the
 *  temporal dead zone inside an import cycle (deps:toplevel-key). */
function stateKey(): string {
    return HHStoredVarPrefixKey + TK.workPause;
}

/** mousemove fires constantly; one storage write per this many ms is plenty
 *  against a limit counted in minutes. */
const TOUCH_THROTTLE_MS = 2000;
/** The tick runs every second; the log hears from the pause once a minute. */
const HOLD_LOG_EVERY_MS = 60_000;
const GO_TO_ZONE_RETRY_MS = 10_000;
/** Below this, a sign of work is not worth a log line. */
const QUIET_LOG_MS = 60_000;
/** A mousemove counts only when the pointer really moved this far. */
const POINTER_MOVE_MIN_PX = 3;

let lastTouch = 0;
let lastHoldLog = 0;
/** When the way back was last asked for; gotoPage refuses while another
 *  navigation is in flight, so the next tick may have to ask again. */
let goToZoneAt = 0;
let activityBound = false;
let stylesAdded = false;

function readState(): WorkPauseState | null {
    const state = getStoredJSON<WorkPauseState | null>(stateKey(), null);
    if (!state || typeof state.lastActivity !== 'number') return null;
    if (state.zone) return state;
    // A pause 8.17.0 left in a tab knew only the team zone, under other names.
    const old = state as WorkPauseState & { teamUrl?: string; returnToTeam?: boolean };
    return { since: old.since, lastActivity: old.lastActivity, zone: 'team', zoneUrl: old.teamUrl, returnToZone: old.returnToTeam };
}

function writeState(state: WorkPauseState): void {
    setStoredValue(stateKey(), JSON.stringify(state));
}

function isZonePage(zone: WorkZone, page: string): boolean {
    const cfg = (key: string) => ConfigHelper.getHHScriptVars(key);
    if (zone === 'gear') return page === cfg('pagesIDShop');
    return page === cfg('pagesIDEditTeam') || page === cfg('pagesIDBattleTeams');
}

/** The zone's own name for the notice: the label of the button that opened it. */
function zoneLabel(zone: WorkZone): string {
    return getTextForUI(zone === 'gear' ? 'HHGearMenu' : 'teamSelOpen', 'elementText');
}

function queued(key: string): boolean {
    const queue = getStoredJSON<unknown[]>(HHStoredVarPrefixKey + key, []);
    return Array.isArray(queue) && queue.length > 0;
}

/**
 * A run has work stored AND the page is one of its own. Both, because the
 * stored work outlives the run when the player walks away from it; on a
 * page of their choosing the pause must not hold for a run that is not
 * running.
 */
function runActive(page: string): boolean {
    const cfg = (key: string) => ConfigHelper.getHHScriptVars(key);
    const path = window.location.pathname;
    const onUpgradePage = path.indexOf(UPGRADE_PATH) !== -1 || path.indexOf(GIRL_UPGRADE_PATH) !== -1;
    if (getStoredValue(HHStoredVarPrefixKey + TK.haremGirlMode) === 'team'
        && (page === cfg('pagesIDWaifu') || page === cfg('pagesIDHarem') || page === cfg('pagesIDGirlPage')
            || page === cfg('pagesIDQuest'))) {
        return true;
    }
    if (queued(TK.girlGearUpgradeQueue) && (onUpgradePage || page === cfg('pagesIDGirlPage'))) return true;
    if (queued(TK.gearUpgradeQueue) && (onUpgradePage || page === cfg('pagesIDShop'))) return true;
    return false;
}

/** Begin the pause for a zone, or keep the one already running there and
 *  count this as work. Work in the other zone replaces it. */
export function startWorkPause(zone: WorkZone): void {
    const now = Date.now();
    const state = readState();
    const same = state !== null && state.zone === zone;
    const zoneUrl = isZonePage(zone, getPage()) ? window.location.pathname + window.location.search
        : (same ? state.zoneUrl : undefined);
    writeState({ since: same ? state.since : now, lastActivity: now, zone, zoneUrl, returnToZone: false });
    lastTouch = now;
    if (!same) logHHAuto(`Work pause: started (${zone}) -- the automation waits while the player works.`);
}

/**
 * A sign of work: the idle limit counts from here. No-op without a pause.
 *
 * `source` says what it was. After a quiet minute or more the log names it:
 * a player reported the minutes falling and then jumping back to 15 with
 * nobody at the page, and Chromium, measured, sends nothing of the kind --
 * the line is what tells the cause in the browser where it happens.
 */
export function touchWorkPause(source = 'work'): void {
    const now = Date.now();
    if (now - lastTouch < TOUCH_THROTTLE_MS) return;
    const state = readState();
    if (state === null) return;
    lastTouch = now;
    const quietMs = now - state.lastActivity;
    if (quietMs >= QUIET_LOG_MS) {
        logHHAuto(`Work pause: activity after ${Math.round(quietMs / 1000)} s quiet -- ${source}; back to ${WORK_PAUSE_IDLE_MS / 60_000} min.`);
    }
    writeState({ ...state, lastActivity: now });
}

/** A run finished: hold on until the player is back in the zone.
 *  Stuff Team's end writes the same field directly (see the file head). */
export function workPauseReturnToZone(): void {
    const state = readState();
    if (state === null) return;
    writeState({ ...state, lastActivity: Date.now(), returnToZone: true });
}

/** Whether a pause is stored -- a run asks before it decides where to end. */
export function isWorkPauseActive(): boolean {
    return readState() !== null;
}

/** End the pause and take the notice away. */
export function endWorkPause(reason: string): void {
    if (readState() === null) return;
    deleteStoredValue(stateKey());
    $('#hhWorkPause').remove();
    logHHAuto('Work pause: ended -- ' + reason + '.');
}

/**
 * Asked by every tick, before the pipeline. True while the pipeline has to
 * wait. Also keeps the notice up to date, sends a finished run back to its
 * zone, and ends the pause when the decision says so.
 */
export function workPauseHolds(page: string): boolean {
    // A calculation holds the loop in memory; its minutes are work too.
    const holder = autoLoopHolder();
    if (holder !== null) touchWorkPause(holder);
    const state = readState();
    if (state === null) {
        $('#hhWorkPause').remove();
        return false;
    }
    const now = Date.now();
    const onZonePage = isZonePage(state.zone, page);
    const active = runActive(page);
    const decision = decideWorkPause({ state, now, onZonePage, runActive: active, idleMs: WORK_PAUSE_IDLE_MS });
    if (decision.kind === 'none') return false;
    if (decision.kind === 'end') {
        endWorkPause(decision.reason === 'idle'
            ? `${WORK_PAUSE_IDLE_MS / 60_000} minutes without work (${state.zone})`
            : `the ${state.zone} page was left and no run is going`);
        return false;
    }
    if (active) touchWorkPause('a step of a run');
    if (decision.arrived) writeState({ ...state, lastActivity: now, returnToZone: false });
    if (decision.goToZone && now - goToZoneAt >= GO_TO_ZONE_RETRY_MS) {
        goToZoneAt = now;
        logHHAuto(`Work pause: the run is done, back to the ${state.zone} page.`);
        goToZonePage(state.zone, state.zoneUrl);
    }
    if (onZonePage) bindActivity();
    if (now - lastHoldLog >= HOLD_LOG_EVERY_MS) {
        lastHoldLog = now;
        logHHAuto(`Work pause: holding the automation, ${Math.ceil(decision.remainingMs / 60_000)} min left without work.`);
    }
    showNotice(state.zone, decision.remainingMs);
    return true;
}

/**
 * On the zone's pages, the player's hand is the sign of work. Listeners of
 * their own, in the capture phase: MouseService owns document.onmousemove,
 * and the popup's buttons stop nothing from reaching the document this way.
 *
 * Only the hand: an event a script dispatched (isTrusted false) does not
 * count, a mousemove counts only when the pointer moved -- browsers send
 * mousemove without movement when the page changes under a resting pointer
 * -- and the wheel stands for scrolling, because a scroll event fires for
 * every element the page scrolls by itself.
 */
function bindActivity(): void {
    if (activityBound) return;
    activityBound = true;
    let lastX: number | null = null;
    let lastY = 0;
    const describe = (e: Event): string => {
        const t = e.target as Element | null;
        const name = t && t.nodeType === 1 ? t.tagName.toLowerCase() + (t.id ? '#' + t.id : '') : 'document';
        return `${e.type} on ${name}`;
    };
    document.addEventListener('mousemove', (e: MouseEvent) => {
        if (!e.isTrusted) return;
        const moved = lastX === null ? Infinity : Math.max(Math.abs(e.screenX - lastX), Math.abs(e.screenY - lastY));
        if (moved < POINTER_MOVE_MIN_PX) return;
        lastX = e.screenX;
        lastY = e.screenY;
        touchWorkPause(`${describe(e)}, moved ${moved === Infinity ? 'in' : moved + ' px'}`);
    }, { capture: true, passive: true });
    for (const type of ['mousedown', 'keydown', 'wheel', 'touchstart']) {
        document.addEventListener(type, (e) => { if (e.isTrusted) touchWorkPause(describe(e)); }, { capture: true, passive: true });
    }
}

/**
 * Back to the page of the zone the work started on. gotoPage takes a page
 * id, not a path -- measured: '/edit-team.html?battle_type=leagues' came back
 * as "Unknown goto page request" and the run stayed on the last girl page --
 * so the query of the stored URL goes in as arguments, which keeps the team
 * slot the player had open.
 */
function goToZonePage(zone: WorkZone, zoneUrl: string | undefined): void {
    const args: Record<string, string> = {};
    if (zoneUrl) {
        // `sess` is Nutaku's session parameter; gotoPage adds its own.
        new URLSearchParams(zoneUrl.split('?')[1] ?? '').forEach((value, key) => { if (key !== 'sess') args[key] = value; });
    }
    gotoPage(ConfigHelper.getHHScriptVars(zone === 'gear' ? 'pagesIDShop' : 'pagesIDEditTeam'), args);
}

function showNotice(zone: WorkZone, remainingMs: number): void {
    const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
    const text = getTextForUI('workPause', 'elementText')
        .replace('{what}', zoneLabel(zone)).replace('{minutes}', String(minutes));
    if (document.getElementById('hhWorkPause') === null) {
        if (!stylesAdded) {
            stylesAdded = true;
            // Red, so it is seen over any page: the same red the team popup
            // uses for a warning, with white text (contrast about 6.5:1).
            GM_addStyle('#hhWorkPause{position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:6000;'
                + 'display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;'
                + 'max-width:calc(100vw - 32px);box-sizing:border-box;padding:5px 12px;border-radius:6px;'
                + 'background:#b3261e;border:1px solid #ffd2cc;box-shadow:0 2px 8px rgba(0,0,0,0.5);'
                + 'color:#fff;font-size:13px;font-weight:600;}'
                + '#hhWorkPause .myButton{margin:0;padding:2px 10px;font-size:12px;font-weight:normal;}');
        }
        $('body').append(`<div id="hhWorkPause"><span class="hhWorkPauseText"></span>`
            + `<label class="myButton" id="hhWorkPauseResume">${getTextForUI('workPauseResume', 'elementText')}</label></div>`);
        $('#hhWorkPauseResume').on('click', () => {
            endWorkPause('resumed by the player');
            // A run switches the loop flag off for its own pages; then no
            // tick is scheduled and one has to be started. With the flag on
            // a tick is coming anyway, and a kick would start a second chain.
            if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') kickAutoLoop(500);
        });
    }
    $('#hhWorkPause .hhWorkPauseText').text(text);
}
