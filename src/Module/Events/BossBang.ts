// BossBang.ts -- Boss Bang event: build the five teams, fight, claim the chests.
//
// A Boss Bang runs build -> fight -> claim, and every step reads its state
// from the page it is on, never from a stored cursor. A reload anywhere --
// on the event page, the team page or the battle page -- therefore resumes
// where the event stands: the event page shows how many teams exist, which
// are tired, how many potions are in and which chests wait.
//
// Measured on the event page (#boss_bang, 2026-10-15):
//   - a team slot is `.boss-bang-team-slot`; an empty one holds a link to
//     /add-boss-bang-team.html, a built one `.boss-bang-team-first-girl`,
//     a tired one (ego spent) `.boss-bang-team-tired-girl` as well;
//   - clicking a built slot makes the game point #start-bang-button at
//     /boss-bang-battle.html?number_of_battles=1&bb_team_index=<slot>;
//   - an account below the requirements sees `.boss-bang-requirements-row`
//     instead of slots;
//   - at 100 potions the slots and the Bang button go and
//     `.boss-bang-event-info.completed-event` appears, next to one claim
//     button per chest still waiting.
// On the team page the game fills the hexagons itself with the strongest
// girls not yet in a Boss Bang team; Validate asks once more
// (#confirm-boss-bang-team-creation) and then saves with create_bb_team. A
// team cannot be changed afterwards. The battle page fights on load; the
// result popup's OK leads back to the event page.
//
// A tired team is never revived: that costs kobans. When every team is tired
// before the 100 potions, the event ends there and the chests reached so far
// are claimed.
//
// Depends on: EventModule.ts (event routing and the event list)
// Used by: EventModule.ts (parse, when the Boss Bang tab is open),
//          Pipeline.config.ts (the parse and fight blocks)
//
import { ConfigHelper } from "../../Helper/ConfigHelper";
import { getPage } from "../../Helper/PageHelper";
import { deleteStoredValue, getStoredJSON, getStoredValue, setStoredValue } from "../../Helper/StorageHelper";
import { convertTimeToInt, randomInterval } from "../../Helper/TimeHelper";
import { setTimer } from "../../Helper/TimerHelper";
import { addNutakuSession, gotoPage, safeNavigateHref } from "../../Service/PageNavigationService";
import {
    waitForAjaxIdle,
    acquirePostMutex,
    releasePostMutex,
    awaitServerSettleAfterPost,
    AJAX_IDLE_TIMEOUT_MS,
    AJAX_IDLE_SETTLE_MS,
} from "../../Service/AjaxTracker";
import { logHHAuto } from "../../Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../../config/HHStoredVars";
import { SK, TK } from "../../config/StorageKeys";
import { HHEvent, HHEventData, HHEventList } from "../../model/HHEvent";
import { EventModule } from "./EventModule";

/** One entry of the stored event list (TK.eventsList), as far as this module reads it. */
type EventListEntry = { isCompleted?: boolean; [key: string]: unknown };

/** What the event page asks for next. */
export type BossBangStep = 'blocked' | 'claim' | 'build' | 'fight' | 'done';

const TEAM_COUNT = 5;
const TEAM_SIZE = 7;
// A battle page that shows neither the result popup nor the skip button this
// long after loading is stuck; the event page is asked again.
const BATTLE_PAGE_STUCK_MS = 30_000;
// A team page this module opened and has not confirmed after this long is
// left to the player.
const TEAM_BUILD_MAX_MS = 10 * 60_000;

export class BossBang {
    static readonly EVENT_SELECTOR = '#contains_all #events #boss_bang';
    // One claim button per chest that can be opened (issue #1455).
    static readonly PROGRESS_REWARD_SELECTOR = 'button[rel="claim"].progress-bar-claim-reward:not([disabled]):visible';
    static readonly REWARD_POPUP_OK_SELECTOR = '#rewards_popup .blue_button_L:not([disabled]):visible';

    /** The Boss Bang tab is the one open on the event page. */
    static isOnEventTab(): boolean {
        return getPage() === ConfigHelper.getHHScriptVars("pagesIDEvent") && $(BossBang.EVENT_SELECTOR).length > 0;
    }

    /**
     * The order the teams fight in, as slot indexes (0 = team 1). The
     * setting names the team to start with: 1 goes up (1, 2, 3, 4, 5), any
     * other number goes down from there and then on from the last team
     * (5: 5, 4, 3, 2, 1 -- 3: 3, 2, 1, 5, 4).
     */
    static teamOrder(firstTeam: number, count = TEAM_COUNT): number[] {
        const first = Math.min(Math.max(Math.trunc(Number(firstTeam)) || count, 1), count);
        const order: number[] = [];
        if (first === 1) {
            for (let team = 1; team <= count; team++) order.push(team - 1);
        } else {
            for (let team = first; team >= 1; team--) order.push(team - 1);
            for (let team = count; team > first; team--) order.push(team - 1);
        }
        return order;
    }

    /** Slot index of the next team to fight with, or -1 when none can fight. */
    static pickTeam(firstTeam: number): number {
        const ready = new Set<number>();
        $(`${BossBang.EVENT_SELECTOR} .boss-bang-team-slot`).each(function () {
            const slot = $(this);
            if (slot.find('.boss-bang-team-first-girl').length > 0 && slot.find('.boss-bang-team-tired-girl').length === 0) {
                ready.add(Number(slot.attr('data-slot-index')));
            }
        });
        for (const index of BossBang.teamOrder(firstTeam)) {
            if (ready.has(index)) return index;
        }
        return -1;
    }

    /** Read the open Boss Bang tab and say what comes next. */
    static nextStep(): BossBangStep {
        const page = $(BossBang.EVENT_SELECTOR);
        if (page.find('.boss-bang-requirements-row').length > 0) return 'blocked';
        if ($(BossBang.PROGRESS_REWARD_SELECTOR).length > 0) return 'claim';
        if (page.find('.completed-event').length > 0) return 'done';
        if (page.find('.boss-bang-team-slot a[href*="add-boss-bang-team"]').length > 0) return 'build';
        const firstTeam = Number(getStoredValue(HHStoredVarPrefixKey + SK.bossBangMinTeam));
        if (BossBang.pickTeam(firstTeam) >= 0 && $('#start-bang-button').length > 0) return 'fight';
        return 'done';
    }

    static parse(hhEvent: HHEvent, eventList: HHEventList, _hhEventData: HHEventData): void {
        const eventID = hhEvent.eventId;
        const refreshTimer = randomInterval(3600, 4000);

        const timeLeft = $('#contains_all #events .nc-panel .timer span[rel="expires"]').text();
        if (timeLeft !== undefined && timeLeft.length) {
            setTimer('eventBossBangGoing', Number(convertTimeToInt(timeLeft)));
        } else setTimer('eventBossBangGoing', refreshTimer);
        const step = BossBang.nextStep();
        eventList[eventID] = {};
        eventList[eventID]["id"] = eventID;
        eventList[eventID]["type"] = hhEvent.eventType;
        eventList[eventID]["seconds_before_end"] = new Date().getTime() + Number(convertTimeToInt(timeLeft)) * 1000;
        eventList[eventID]["next_refresh"] = new Date().getTime() + refreshTimer * 1000;
        // Finished means nothing is left to do here this event: the chests
        // are claimed and no team can fight, or the account cannot take part.
        eventList[eventID]["isCompleted"] = step === 'done' || step === 'blocked';
        if (step === 'blocked') {
            logHHAuto("Boss bang: this account does not meet the requirements, skipping the event.");
        } else {
            logHHAuto("Boss bang: next step " + step + ".");
        }
    }

    /** Mark the event as finished in the event list, so it is not visited again. */
    static markCompleted(eventID: string): void {
        if (!eventID) return;
        const eventList = getStoredJSON<Record<string, EventListEntry>>(HHStoredVarPrefixKey + TK.eventsList, {});
        eventList[eventID] = { ...(eventList[eventID] ?? { id: eventID, type: 'bossBang' }), isCompleted: true };
        setStoredValue(HHStoredVarPrefixKey + TK.eventsList, JSON.stringify(eventList));
    }

    static isMarkedCompleted(eventID: string): boolean {
        const eventList = getStoredJSON<Record<string, EventListEntry>>(HHStoredVarPrefixKey + TK.eventsList, {});
        return eventList[eventID]?.isCompleted === true;
    }

    /**
     * The team page was opened by this module, not by the player. Set when
     * the event page sends the run there, cleared once the team is confirmed;
     * kept in sessionStorage so a reload of the team page still knows it.
     */
    static isBuildingTeam(): boolean {
        const since = Number(getStoredValue(HHStoredVarPrefixKey + TK.bossBangTeamBuild));
        return Number.isFinite(since) && since > 0 && Date.now() - since < TEAM_BUILD_MAX_MS;
    }

    /** The Boss Bang event to work on: the open tab, else the first one known. */
    static targetEventID(fallback = ''): string {
        if (BossBang.isOnEventTab()) {
            const shown = EventModule.getDisplayedIdEventPage(false);
            if (shown) return shown;
        }
        return fallback || EventModule.getEventIDsByType('bossBang')[0] || '';
    }

    static goToEvent(eventID: string): boolean {
        if (!eventID) {
            logHHAuto("Boss bang: no boss bang event known, nothing to open.");
            setTimer('nextBossBangTime', randomInterval(30, 60) * 60);
            return false;
        }
        logHHAuto("Boss bang: going to the event page.");
        gotoPage(ConfigHelper.getHHScriptVars("pagesIDEvent"), { tab: eventID });
        return true;
    }

    /**
     * One step on the event tab. Returns true while the event goes on (the
     * caller holds the scheduler slot), false once it is finished or there
     * is nothing this run may do -- fighting and building need the setting,
     * claiming does not.
     */
    static async workEventPage(fightEnabled: boolean): Promise<boolean> {
        const step = BossBang.nextStep();
        const eventID = BossBang.targetEventID();
        switch (step) {
            case 'claim':
                return BossBang.claimNextChest();
            case 'build':
                if (!fightEnabled) return false;
                return BossBang.goToAddTeam();
            case 'fight':
                if (!fightEnabled) return false;
                return BossBang.startFight();
            case 'blocked':
            case 'done':
            default:
                logHHAuto(step === 'blocked'
                    ? "Boss bang: this account does not meet the requirements."
                    : "Boss bang finished: chests claimed, no team left to fight.");
                BossBang.markCompleted(eventID);
                return false;
        }
    }

    /**
     * Claim one chest, or close the reward popup the previous claim opened.
     * One action per call: the popup covers the next button, and a reload
     * between two claims starts again from what the page shows.
     */
    static async claimNextChest(): Promise<boolean> {
        const popupOk = $(BossBang.REWARD_POPUP_OK_SELECTOR);
        if (popupOk.length > 0) {
            logHHAuto("Boss bang: closing the chest reward.");
            popupOk.first().trigger('click');
            return true;
        }
        const button = $(BossBang.PROGRESS_REWARD_SELECTOR).first();
        if (button.length === 0) return false;
        // Serialise the claim POST through the global mutex (#1598,
        // docs/decisions/ADR-003-ajax-post-mutex.md).
        if (!acquirePostMutex('bossbang:claim')) {
            logHHAuto('BossBang: another POST in flight, deferring the chest claim');
            return true;
        }
        logHHAuto("Boss bang: claiming chest " + (button.attr('tier') ?? '?') + ".");
        const start = Date.now();
        button.trigger('click');
        const idle = await waitForAjaxIdle(AJAX_IDLE_TIMEOUT_MS, AJAX_IDLE_SETTLE_MS);
        releasePostMutex();
        if (idle) await awaitServerSettleAfterPost(Date.now() - start);
        return true;
    }

    static goToAddTeam(): boolean {
        const link = $(`${BossBang.EVENT_SELECTOR} .boss-bang-team-slot a[href*="add-boss-bang-team"]`).first();
        const href = link.attr('href');
        if (!href) return false;
        logHHAuto("Boss bang: building team " + ($(`${BossBang.EVENT_SELECTOR} .boss-bang-team-first-girl`).length + 1) + ".");
        setStoredValue(HHStoredVarPrefixKey + TK.bossBangTeamBuild, String(Date.now()));
        safeNavigateHref(addNutakuSession(href) as string);
        return true;
    }

    /** Select the team the setting asks for and open its battle. */
    static startFight(): boolean {
        const firstTeam = Number(getStoredValue(HHStoredVarPrefixKey + SK.bossBangMinTeam));
        const slotIndex = BossBang.pickTeam(firstTeam);
        if (slotIndex < 0) return false;
        // The game's own slot handler points the Bang button at this team.
        $(`${BossBang.EVENT_SELECTOR} .boss-bang-team-slot[data-slot-index="${slotIndex}"]`).trigger('click');
        const button = $('#start-bang-button');
        const href = button.attr('href') || '';
        if (button.attr('disabled') === 'disabled' || !new RegExp('bb_team_index=' + slotIndex + '(\\D|$)').test(href)) {
            logHHAuto("Boss bang: the Bang button did not take team " + (slotIndex + 1) + " (" + href + "), trying again later.");
            setTimer('nextBossBangTime', randomInterval(10, 20) * 60);
            return false;
        }
        logHHAuto("Boss bang: fighting with team " + (slotIndex + 1) + ".");
        // safeNavigateHref lets in-flight game AJAX finish before the URL
        // change; a direct location change aborts open XHRs (issue #1598).
        safeNavigateHref(addNutakuSession(href) as string);
        return true;
    }

    /**
     * One step on the team page: fill the hexagons if the game left them
     * short, press Validate, then confirm. Returns true while the team is on
     * its way; after the confirmation the game saves and returns to the event.
     */
    static async buildTeamStep(): Promise<boolean> {
        const confirm = $('#confirm-boss-bang-team-creation:visible');
        if (confirm.length > 0) {
            if (!acquirePostMutex('bossbang:createTeam')) {
                logHHAuto('BossBang: another POST in flight, deferring the team confirmation');
                return true;
            }
            logHHAuto("Boss bang: confirming the team.");
            deleteStoredValue(HHStoredVarPrefixKey + TK.bossBangTeamBuild);
            const start = Date.now();
            confirm.trigger('click');
            const idle = await waitForAjaxIdle(AJAX_IDLE_TIMEOUT_MS, AJAX_IDLE_SETTLE_MS);
            releasePostMutex();
            if (idle) await awaitServerSettleAfterPost(Date.now() - start);
            return true;
        }
        const placed = $('.team-hexagon .team-member-container[data-girl-id]').length;
        if (placed < TEAM_SIZE) {
            const autoFill = $('#auto-fill-team:not([disabled])');
            if (autoFill.length > 0 && placed === 0) {
                logHHAuto("Boss bang: filling the team.");
                autoFill.trigger('click');
                return true;
            }
            logHHAuto("Boss bang: only " + placed + " girls for the team, trying again later.");
            setTimer('nextBossBangTime', randomInterval(30, 60) * 60);
            return BossBang.goToEvent(BossBang.targetEventID());
        }
        const validate = $('#validate-team:not([disabled])');
        if (validate.length > 0) {
            logHHAuto("Boss bang: validating the team.");
            validate.trigger('click');
        }
        // Without an enabled Validate the confirmation is on its way; the
        // next call finds it.
        return true;
    }

    /**
     * One step on the battle page: close the result with OK (or skip the
     * fight animation). Returns true while the page is still busy. A page
     * that shows neither for too long goes back to the event.
     */
    static async battlePageStep(): Promise<boolean> {
        const rewardsButton = $(BossBang.REWARD_POPUP_OK_SELECTOR);
        const skipFightButton = $('#battle #new-battle-skip-btn:not([disabled]):visible');
        if (rewardsButton.length > 0 || skipFightButton.length > 0) {
            const button = rewardsButton.length > 0 ? rewardsButton : skipFightButton;
            // Serialise through the global mutex (#1598,
            // docs/decisions/ADR-003-ajax-post-mutex.md).
            if (!acquirePostMutex('bossbang:battle')) {
                logHHAuto('BossBang: another POST in flight, deferring the battle page click');
                return true;
            }
            logHHAuto(rewardsButton.length > 0 ? "Boss bang: fight over, OK." : "Boss bang: skipping the fight.");
            const start = Date.now();
            button.first().trigger('click');
            const idle = await waitForAjaxIdle(AJAX_IDLE_TIMEOUT_MS, AJAX_IDLE_SETTLE_MS);
            releasePostMutex();
            if (idle) await awaitServerSettleAfterPost(Date.now() - start);
            return true;
        }
        if (performance.now() > BATTLE_PAGE_STUCK_MS) {
            logHHAuto("Boss bang: battle page shows no result, back to the event.");
            return BossBang.goToEvent(BossBang.targetEventID());
        }
        return true;
    }
}
