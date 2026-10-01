// WorkPause.ts -- Keep the pipeline out while the player works on the team.
//
// Working on a team is a sequence, not one click: calculate, Apply (the page
// reloads), Team gear (it reloads again), Level-up gear or Stuff Team (they
// leave for the upgrade, harem and girl pages and come back). Measured on a
// live account (#1888): the in-memory hold of AutoLoopHold.ts covered the
// calculation itself, but one second after it ended a due League block left
// edit-team, and Apply pressed a second later saved the team while the page
// was already going -- the team fought without gear and skills. After every
// reload the first tick runs the pipeline before HHauto's own button is even
// on the page again, so nothing that lives in memory or in the popup can
// cover this.
//
// The pause therefore lives in sessionStorage (Temp_workPause) and is asked
// every tick before the pipeline, the first tick after a reload included. It
// starts when the team popup opens, and holds
//   - on edit-team and the team list,
//   - on every page of a running Stuff Team, Level-up gear or Upgrade Gear,
//   - on the way back to edit-team after such a run finished.
// It ends when the player leaves the team pages by their own hand, presses
// "Resume automation" on the notice every held page shows, after
// WORK_PAUSE_IDLE_MS without any sign of work, or when a run gives up -- the
// run then sends the player home.
//
// The decision is WorkPause.pure.ts; this file reads its input and acts.
//
// Stuff Team's end sets returnToTeam on the stored state itself, in the
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
import { WORK_PAUSE_IDLE_MS, WorkPauseState, decideWorkPause } from "./WorkPause.pure";

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
const GO_TO_TEAM_RETRY_MS = 10_000;

let lastTouch = 0;
let lastHoldLog = 0;
/** When the way back was last asked for; gotoPage refuses while another
 *  navigation is in flight, so the next tick may have to ask again. */
let goToTeamAt = 0;
let activityBound = false;
let stylesAdded = false;

function readState(): WorkPauseState | null {
    const state = getStoredJSON<WorkPauseState | null>(stateKey(), null);
    return state && typeof state.lastActivity === 'number' ? state : null;
}

function writeState(state: WorkPauseState): void {
    setStoredValue(stateKey(), JSON.stringify(state));
}

function isTeamPage(page: string): boolean {
    return page === ConfigHelper.getHHScriptVars('pagesIDEditTeam')
        || page === ConfigHelper.getHHScriptVars('pagesIDBattleTeams');
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
        && (page === cfg('pagesIDWaifu') || page === cfg('pagesIDHarem') || page === cfg('pagesIDGirlPage'))) {
        return true;
    }
    if (queued(TK.girlGearUpgradeQueue) && (onUpgradePage || page === cfg('pagesIDGirlPage'))) return true;
    if (queued(TK.gearUpgradeQueue) && (onUpgradePage || page === cfg('pagesIDShop'))) return true;
    return false;
}

/** Begin the pause, or keep the one already running and count this as work. */
export function startWorkPause(): void {
    const now = Date.now();
    const state = readState();
    const teamUrl = isTeamPage(getPage()) ? window.location.pathname + window.location.search : state?.teamUrl;
    writeState({ since: state?.since ?? now, lastActivity: now, teamUrl, returnToTeam: false });
    lastTouch = now;
    if (state === null) logHHAuto('Work pause: started -- the automation waits while the team is being worked on.');
}

/** A sign of work: the idle limit counts from here. No-op without a pause. */
export function touchWorkPause(): void {
    const now = Date.now();
    if (now - lastTouch < TOUCH_THROTTLE_MS) return;
    const state = readState();
    if (state === null) return;
    lastTouch = now;
    writeState({ ...state, lastActivity: now });
}

/** A run finished: hold on until the player is back on the team page.
 *  Stuff Team's end writes the same field directly (see the file head). */
export function workPauseReturnToTeam(): void {
    const state = readState();
    if (state === null) return;
    writeState({ ...state, lastActivity: Date.now(), returnToTeam: true });
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
 * wait. Also keeps the notice up to date, sends a finished run back to the
 * team page, and ends the pause when the decision says so.
 */
export function workPauseHolds(page: string): boolean {
    // A calculation holds the loop in memory; its minutes are work too.
    if (autoLoopHolder() !== null) touchWorkPause();
    const state = readState();
    if (state === null) {
        $('#hhWorkPause').remove();
        return false;
    }
    const now = Date.now();
    const onTeamPage = isTeamPage(page);
    const active = runActive(page);
    const decision = decideWorkPause({ state, now, onTeamPage, runActive: active, idleMs: WORK_PAUSE_IDLE_MS });
    if (decision.kind === 'none') return false;
    if (decision.kind === 'end') {
        endWorkPause(decision.reason === 'idle'
            ? `${WORK_PAUSE_IDLE_MS / 60_000} minutes without work on the team`
            : 'the team page was left and no run is going');
        return false;
    }
    if (active) touchWorkPause();
    if (decision.arrived) writeState({ ...state, lastActivity: now, returnToTeam: false });
    if (decision.goToTeam && now - goToTeamAt >= GO_TO_TEAM_RETRY_MS) {
        goToTeamAt = now;
        logHHAuto('Work pause: the run is done, back to the team page.');
        goToTeamPage(state.teamUrl);
    }
    if (onTeamPage) bindActivity();
    if (now - lastHoldLog >= HOLD_LOG_EVERY_MS) {
        lastHoldLog = now;
        logHHAuto(`Work pause: holding the automation, ${Math.ceil(decision.remainingMs / 60_000)} min left without work.`);
    }
    showNotice(decision.remainingMs);
    return true;
}

/**
 * On the team pages, the player's hand is the sign of work. Listeners of
 * their own, in the capture phase: MouseService owns document.onmousemove,
 * and the popup's buttons stop nothing from reaching the document this way.
 */
function bindActivity(): void {
    if (activityBound) return;
    activityBound = true;
    for (const type of ['mousemove', 'mouseup', 'keydown', 'scroll', 'touchstart']) {
        document.addEventListener(type, () => touchWorkPause(), { capture: true, passive: true });
    }
}

/**
 * Back to the edit-team page the work started on. gotoPage takes a page id,
 * not a path -- measured: '/edit-team.html?battle_type=leagues' came back
 * as "Unknown goto page request" and the run stayed on the last girl page --
 * so the query of the stored URL goes in as arguments, which keeps the team
 * slot the player had open.
 */
function goToTeamPage(teamUrl: string | undefined): void {
    const args: Record<string, string> = {};
    if (teamUrl) {
        // `sess` is Nutaku's session parameter; gotoPage adds its own.
        new URLSearchParams(teamUrl.split('?')[1] ?? '').forEach((value, key) => { if (key !== 'sess') args[key] = value; });
    }
    gotoPage(ConfigHelper.getHHScriptVars('pagesIDEditTeam'), args);
}

function showNotice(remainingMs: number): void {
    const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
    const text = getTextForUI('workPause', 'elementText').replace('{minutes}', String(minutes));
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
