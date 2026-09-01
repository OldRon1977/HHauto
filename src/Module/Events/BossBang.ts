// BossBang.ts -- Boss Bang event: cooperative boss fights with club members.
//
// Boss Bang is a club-wide cooperative event where members contribute damage
// to shared bosses. This module parses event page data, tracks boss HP and
// timers, and automates participation in boss fights when energy is available.
//
// Depends on: EventModule.ts (event detection and routing)
// Used by: EventModule.ts (called when Boss Bang event is active)
//
import { ConfigHelper } from "../../Helper/ConfigHelper";
import { getPage } from "../../Helper/PageHelper";
import { getStoredValue, setStoredValue } from "../../Helper/StorageHelper";
import { convertTimeToInt, randomInterval, TimeHelper } from "../../Helper/TimeHelper";
import { setTimer } from "../../Helper/TimerHelper";
import { addNutakuSession, gotoPage, safeNavigateHref } from "../../Service/PageNavigationService";
// >>> ADR-003 / issue #1598 - bossbang:imports begin
// CLEANUP-MODE (when stable): remove only the two marker comment lines.
// REVERT-MODE (if unstable): if no other ADR-003 block remains in this file,
// remove this import statement entirely.
import {
    waitForAjaxIdle,
    acquirePostMutex,
    releasePostMutex,
    awaitServerSettleAfterPost,
    AJAX_IDLE_TIMEOUT_MS,
    AJAX_IDLE_SETTLE_MS,
} from "../../Service/AjaxTracker";
// <<< ADR-003 / issue #1598 - bossbang:imports end
import { logHHAuto } from "../../Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../../config/HHStoredVars";
import { SK, TK } from "../../config/StorageKeys";
import { HHEvent, HHEventData, HHEventList } from "../../model/HHEvent";
import { EventModule } from "./EventModule";

export class BossBang {
    // Milestone/progress-bar reward claim buttons on the boss-bang event
    // page (tiered "Claim" buttons that unlock as the club deals damage,
    // issue #1455). Kept as a shared constant so handleBossBangFight can
    // gate on their presence with the exact same selector.
    static readonly PROGRESS_REWARD_SELECTOR = 'button[rel="claim"].progress-bar-claim-reward:not([disabled]):visible';

    static parse(hhEvent: HHEvent, eventList: HHEventList, hhEventData: HHEventData): any {
        const eventID = hhEvent.eventId;
        const refreshTimer = randomInterval(3600, 4000);

        const timeLeft = $('#contains_all #events .nc-panel .timer span[rel="expires"]').text();
        if (timeLeft !== undefined && timeLeft.length) {
            setTimer('eventBossBangGoing', Number(convertTimeToInt(timeLeft)));
        } else setTimer('eventBossBangGoing', refreshTimer);
        eventList[eventID] = {};
        eventList[eventID]["id"] = eventID;
        eventList[eventID]["type"] = hhEvent.eventType;
        eventList[eventID]["seconds_before_end"] = new Date().getTime() + Number(convertTimeToInt(timeLeft)) * 1000;
        eventList[eventID]["next_refresh"] = new Date().getTime() + refreshTimer * 1000;
        eventList[eventID]["isCompleted"] = $('#contains_all #events #boss_bang .completed-event').length > 0;
        const teamEventz = $('#contains_all #events #boss_bang .boss-bang-teams-container .boss-bang-team-slot');
        let teamFound = false;
        const firstTeamToStartWith = getStoredValue(HHStoredVarPrefixKey + SK.bossBangMinTeam);
        if ($('.boss-bang-team-ego', teamEventz[firstTeamToStartWith - 1]).length > 0) {
            // Do not trigger event if not all teams are set
            for (let currIndex = teamEventz.length - 1; currIndex >= 0 && !teamFound; currIndex--) {
                // start with last team first
                const teamz = $(teamEventz[currIndex]);
                const teamIndex = teamz.data('slot-index');
                const teamEgo = $('.boss-bang-team-ego', teamz);
                if (teamEgo.length > 0 && parseInt(teamEgo.text()) > 0) {
                    if (!teamFound) {
                        if (!teamz.hasClass('.selected-hero-team')) teamz.click();
                        teamFound = true;
                        logHHAuto("Select team " + (teamIndex + 1) + ", Ego: " + parseInt(teamEgo.text()));
                        setStoredValue(HHStoredVarPrefixKey + TK.bossBangTeam, teamIndex);
                        return true;
                    }
                } else {
                    logHHAuto("Team " + teamIndex + " not eligible");
                }
            }
            // setTimer('nextBossBangTime', randomInterval(30, 60) * 60); // 30 to 60 minutes
        }
        else if (eventList[eventID]["isCompleted"]) {
            // Keep the setting on while milestone rewards are still claimable, so
            // handleBossBangFight stays eligible to claim them after the boss is
            // defeated (issue #1455). Disable only once nothing is left to claim.
            const unclaimedRewards = $(BossBang.PROGRESS_REWARD_SELECTOR).length;
            if (unclaimedRewards > 0) {
                logHHAuto("Boss bang completed, " + unclaimedRewards + " progress reward(s) still to claim before disabling.");
            } else {
                logHHAuto("Boss bang completed, disabled boss bang event setting");
                setStoredValue(HHStoredVarPrefixKey + SK.bossBangEvent, false);
            }
        }
        else {
            logHHAuto(`No eligible team found for boss bang event, need team ${firstTeamToStartWith} or higher`);
        }
        if (!teamFound) {
            setStoredValue(HHStoredVarPrefixKey + TK.bossBangTeam, -1);
        }
    }

    // Drives one step of the boss-bang battle sequence: claim a pending reward
    // popup or click the next skip button. Returns true while the sequence is
    // still in progress (an action was taken, or a POST is deferred and should
    // be retried), false when neither button is present after AJAX idle -- i.e.
    // the sequence is finished. The handleBossBangFight pipeline block re-enters
    // this each tick and holds the scheduler slot on repeat (issue #1455), so
    // this does not set autoLoop=false and does not self-reschedule via setTimeout.
    static async skipFightPage(): Promise<boolean>
    {
        const rewardsButton = $('#rewards_popup .blue_button_L:not([disabled]):visible');
        const skipFightButton = $('#battle #new-battle-skip-btn:not([disabled]):visible');
        if(rewardsButton.length > 0)
        {
            // ADR-003 / issue #1598: serialize the claim POST via the global mutex
            // and wait for AJAX idle + server settle before yielding the tick.
            if (!acquirePostMutex('bossbang:rewards')) {
                logHHAuto('BossBang: another POST in flight, deferring rewards click');
                return true;
            }
            logHHAuto("Click get rewards bang fight");
            const claimStart = Date.now();
            rewardsButton.trigger('click');
            const idle = await waitForAjaxIdle(AJAX_IDLE_TIMEOUT_MS, AJAX_IDLE_SETTLE_MS);
            const claimDuration = Date.now() - claimStart;
            releasePostMutex();
            if (idle) await awaitServerSettleAfterPost(claimDuration);
            else logHHAuto('BossBang: rewards AJAX still busy after ' + AJAX_IDLE_TIMEOUT_MS + 'ms, skipping settle');
            return true;
        }
        else if(skipFightButton.length > 0)
        {
            // ADR-003 / issue #1598: serialize the skip POST via the global mutex
            // and wait for AJAX idle + server settle before yielding the tick.
            if (!acquirePostMutex('bossbang:skipFight')) {
                logHHAuto('BossBang: another POST in flight, deferring skip click');
                return true;
            }
            logHHAuto("Click skip boss bang fight");
            const claimStart = Date.now();
            skipFightButton.trigger('click');
            const idle = await waitForAjaxIdle(AJAX_IDLE_TIMEOUT_MS, AJAX_IDLE_SETTLE_MS);
            const claimDuration = Date.now() - claimStart;
            releasePostMutex();
            if (idle) await awaitServerSettleAfterPost(claimDuration);
            else logHHAuto('BossBang: skip AJAX still busy after ' + AJAX_IDLE_TIMEOUT_MS + 'ms, skipping settle');
            return true;
        }
        return false;
    }

    // Collects the boss-bang milestone/progress-bar rewards the same simple way
    // the other collectors do (PathOfValue / DailyGoals): click each claim
    // button in turn with a small delay, then go home. No slot-hold and no POST
    // mutex -- a plain click, like every other reward button (issue #1455).
    // Sets autoLoop=false while collecting (the scheduler pauses); the final
    // gotoPage(home) restores it. Returns true if a collection run was started.
    static collectProgressRewards(): boolean
    {
        const buttons = $(BossBang.PROGRESS_REWARD_SELECTOR).toArray();
        if (buttons.length === 0) return false;
        logHHAuto("Collecting boss bang progress rewards, " + buttons.length + " tier(s) available.");
        setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
        function collect() {
            if (buttons.length > 0) {
                const button = buttons.shift() as HTMLElement;
                logHHAuto("Collecting boss bang reward tier " + (button.getAttribute("tier") ?? "?"));
                button.click();
                setTimeout(collect, randomInterval(300, 500));
            } else {
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
            }
        }
        collect();
        return true;
    }

    static async goToFightPage(bossbangEventID: string) {
        if(getPage() === ConfigHelper.getHHScriptVars("pagesIDEvent") ){
            const teamIndexFound = parseInt(getStoredValue(HHStoredVarPrefixKey+TK.bossBangTeam));
            const bangButton = $('#contains_all #events #boss_bang .boss-bang-event-info #start-bang-button:not([disabled])');
            if(teamIndexFound >= 0 && bangButton.length > 0) {
                logHHAuto("Go to boss bang fight page");
                // Use safeNavigateHref so any in-flight game AJAX completes
                // before the URL change. Direct location.href = ... cancels
                // open XHRs with NS_BINDING_ABORTED, which can trigger the
                // server-side Forbidden race (issue #1598).
                const href = addNutakuSession(bangButton.attr('href')!) as string;
                safeNavigateHref(href);
                await TimeHelper.sleep(randomInterval(3000, 5000));
                return true;
            } else {
                logHHAuto(`Cannot go to boss bang fight page, no team selected ${teamIndexFound} or no bang button found`);
                setTimer('nextBossBangTime', randomInterval(30, 60) * 60); // 30 to 60 minutes
            }
        } else {
            if (bossbangEventID)
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDEvent"), { tab: bossbangEventID });
            else {
                const bossbangEventIDs = EventModule.getEventIDsByType('boss_bang');
                if(bossbangEventIDs.length > 0)
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDEvent"), { tab: bossbangEventIDs[0] });
                else {
                    logHHAuto("Cannot go to boss bang fight page, no boss bang event found");
                    setTimer('nextBossBangTime', randomInterval(30, 60) * 60); // 30 to 60 minutes
                }
            }
        }
        return false;
    }
}