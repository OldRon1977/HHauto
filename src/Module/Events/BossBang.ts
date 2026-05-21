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
    static parse(hhEvent: HHEvent, eventList: HHEventList, hhEventData: HHEventData) {
        const eventID = hhEvent.eventId;
        let refreshTimer = randomInterval(3600, 4000);

        let timeLeft = $('#contains_all #events .nc-panel .timer span[rel="expires"]').text();
        if (timeLeft !== undefined && timeLeft.length) {
            setTimer('eventBossBangGoing', Number(convertTimeToInt(timeLeft)));
        } else setTimer('eventBossBangGoing', refreshTimer);
        eventList[eventID] = {};
        eventList[eventID]["id"] = eventID;
        eventList[eventID]["type"] = hhEvent.eventType;
        eventList[eventID]["seconds_before_end"] = new Date().getTime() + Number(convertTimeToInt(timeLeft)) * 1000;
        eventList[eventID]["next_refresh"] = new Date().getTime() + refreshTimer * 1000;
        eventList[eventID]["isCompleted"] = $('#contains_all #events #boss_bang .completed-event').length > 0;
        let teamEventz = $('#contains_all #events #boss_bang .boss-bang-teams-container .boss-bang-team-slot');
        let teamFound = false;
        const firstTeamToStartWith = getStoredValue(HHStoredVarPrefixKey + SK.bossBangMinTeam);
        if ($('.boss-bang-team-ego', teamEventz[firstTeamToStartWith - 1]).length > 0) {
            // Do not trigger event if not all teams are set
            for (let currIndex = teamEventz.length - 1; currIndex >= 0 && !teamFound; currIndex--) {
                // start with last team first
                let teamz = $(teamEventz[currIndex]);
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
            logHHAuto("Boss bang completed, disabled boss bang event setting");
            setStoredValue(HHStoredVarPrefixKey + SK.bossBangEvent, false);
        }
        else {
            logHHAuto(`No eligible team found for boss bang event, need team ${firstTeamToStartWith} or higher`);
        }
        if (!teamFound) {
            setStoredValue(HHStoredVarPrefixKey + TK.bossBangTeam, -1);
        }
    }

    static async skipFightPage()
    {
        const rewardsButton = $('#rewards_popup .blue_button_L:not([disabled]):visible');
        const skipFightButton = $('#battle #new-battle-skip-btn:not([disabled]):visible');
        if(rewardsButton.length > 0)
        {
            // >>> ADR-003 / issue #1598 - bossbang:rewards begin
            // CLEANUP-MODE (when stable): remove only the two marker comment lines.
            // REVERT-MODE (if unstable): replace this whole block, including the markers,
            // with the pre-fix code:
            //     logHHAuto("Click get rewards bang fight");
            //     rewardsButton.trigger('click');
            //     setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
            // and (if no other ADR-003 block remains) drop the imports/markers above.
            if (!acquirePostMutex('bossbang:rewards')) {
                logHHAuto('BossBang: another POST in flight, deferring rewards click');
                setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
                return;
            }
            logHHAuto("Click get rewards bang fight");
            const claimStart = Date.now();
            rewardsButton.trigger('click');
            const idle = await waitForAjaxIdle(AJAX_IDLE_TIMEOUT_MS, AJAX_IDLE_SETTLE_MS);
            const claimDuration = Date.now() - claimStart;
            releasePostMutex();
            setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
            if (idle) await awaitServerSettleAfterPost(claimDuration);
            else logHHAuto('BossBang: rewards AJAX still busy after ' + AJAX_IDLE_TIMEOUT_MS + 'ms, skipping settle');
            // <<< ADR-003 / issue #1598 - bossbang:rewards end
        }
        else if(skipFightButton.length > 0)
        {
            // >>> ADR-003 / issue #1598 - bossbang:skipFight begin
            // CLEANUP-MODE (when stable): remove only the two marker comment lines.
            // REVERT-MODE (if unstable): replace this whole block, including the markers,
            // with the pre-fix code:
            //     logHHAuto("Click skip boss bang fight");
            //     skipFightButton.trigger('click');
            //     setTimeout(BossBang.skipFightPage, randomInterval(1300, 1900));
            //     setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
            // and (if no other ADR-003 block remains) drop the imports/markers above.
            if (!acquirePostMutex('bossbang:skipFight')) {
                logHHAuto('BossBang: another POST in flight, deferring skip click');
                setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
                return;
            }
            logHHAuto("Click skip boss bang fight");
            const claimStart = Date.now();
            skipFightButton.trigger('click');
            const idle = await waitForAjaxIdle(AJAX_IDLE_TIMEOUT_MS, AJAX_IDLE_SETTLE_MS);
            const claimDuration = Date.now() - claimStart;
            releasePostMutex();
            setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
            if (idle) await awaitServerSettleAfterPost(claimDuration);
            else logHHAuto('BossBang: skip AJAX still busy after ' + AJAX_IDLE_TIMEOUT_MS + 'ms, skipping settle');
            setTimeout(BossBang.skipFightPage, randomInterval(1300, 1900));
            // <<< ADR-003 / issue #1598 - bossbang:skipFight end
        }
    }

    static async goToFightPage(bossbangEventID: string) {
        if(getPage() === ConfigHelper.getHHScriptVars("pagesIDEvent") ){
            const teamIndexFound = parseInt(getStoredValue(HHStoredVarPrefixKey+TK.bossBangTeam));
            let bangButton = $('#contains_all #events #boss_bang .boss-bang-event-info #start-bang-button:not([disabled])');
            if(teamIndexFound >= 0 && bangButton.length > 0) {
                logHHAuto("Go to boss bang fight page");
                // Use safeNavigateHref so any in-flight game AJAX completes
                // before the URL change. Direct location.href = ... cancels
                // open XHRs with NS_BINDING_ABORTED, which can trigger the
                // server-side Forbidden race (issue #1598).
                const href = addNutakuSession(bangButton.attr('href')) as string;
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