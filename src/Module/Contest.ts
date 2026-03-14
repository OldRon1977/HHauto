// Contest.ts -- Handles contest reward claiming and "wait for contest" logic.
//
// Contests are timed competitive events with milestone rewards. This module
// checks for claimable contest rewards, tracks contest end timers, and
// implements the "wait for contest" feature that pauses other automation
// when a contest requiring specific actions is active.
//
// Used by: Service/index.ts (main automation loop)
//
import {
    ConfigHelper,
    TimeHelper,
    checkTimer,
    checkTimerMustExist,
    convertTimeToInt,
    getPage,
    getStoredValue,
    getTimeLeft,
    setTimer
} from '../Helper/index';
import { gotoPage } from "../Service/index";
import { logHHAuto } from '../Utils/index';
import { HHStoredVarPrefixKey, SK } from '../config/index';

export class Contest {
    static getPinfo() {
        const color = getStoredValue(HHStoredVarPrefixKey + SK.waitforContest) !== "true" ? 'white' : TimeHelper.canCollectCompetitionActive() ? 'LimeGreen' : 'red';
        return `<li style='color:${color}'>Contest end : ${getTimeLeft('contestRemainingTime')}  / Next : ${getTimeLeft('nextContestTime')}</li>`;
    }
    static getClaimsButton(){
        return $(".contest .ended button[rel='claim']");
    }
    static run(): boolean {
        if(getPage() !== ConfigHelper.getHHScriptVars("pagesIDContests"))
        {
            logHHAuto("Navigating to contests page.");
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDContests"));
            // return busy
            return true;
        }
        else
        {
            logHHAuto("On contests page.");
            logHHAuto("Collecting finished contests's reward.");
            const contest_list = Contest.getClaimsButton();
            logHHAuto(`Found ${contest_list.length} contest to be collected`);
            if ( contest_list.length > 0)
            {
                const firstContestEnded = contest_list.first();
                logHHAuto(`Collected contest id : ${firstContestEnded.parents('.contest')?.attr('id_contest') }.`);
                firstContestEnded.trigger('click');
                if ( contest_list.length > 1 )
                {
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDContests"));
                    return true;
                }
            }

            return Contest.setTimers();
        }
    }
    static setTimers(): boolean {
        if (getPage() !== ConfigHelper.getHHScriptVars("pagesIDContests")) {
            logHHAuto("Navigating to contests page.");
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDContests"));
            // return busy
            return true;
        }
        else {
            try{
                let nextContestSelector = '#contests .next_contest .contest_timer span';
                let remainingTimeSelector = '#contests .contest .in_progress .contest_timer .text span';

                let nextContestTime = unsafeWindow.contests_timer.next_contest;
                const duration = unsafeWindow.contests_timer.duration;
                let remaining_time = unsafeWindow.contests_timer.remaining_time;
                const safeTime = TimeHelper.getContestSafeTime();

                if ($(nextContestSelector).length > 0) {
                    nextContestTime = Number(convertTimeToInt($(nextContestSelector).first().text()));
                    if (nextContestTime < 0) nextContestTime = unsafeWindow.contests_timer.next_contest;
                }
                if ($(remainingTimeSelector).length > 0) {
                    remaining_time = Number(convertTimeToInt($(remainingTimeSelector).first().text()));
                    if (remaining_time < 0) remaining_time = unsafeWindow.contests_timer.remaining_time;
                }

                if (remaining_time < duration) {
                    setTimer('contestRemainingTime', remaining_time);
                } else
                    setTimer('contestRemainingTime', -1);
                setTimer('nextContestTime', nextContestTime + safeTime);
                if (Contest.getClaimsButton().length > 0) {
                    setTimer('nextContestCollectTime', 0);
                } else {
                    setTimer('nextContestCollectTime', nextContestTime + safeTime);
                }
            } catch (err) {
                logHHAuto('ERROR getting next contest timers, ignore...');
                setTimer('contestRemainingTime', 3600);
                setTimer('nextContestTime', 4000);
                setTimer('nextContestCollectTime', 4000);
            }
            // Not busy
            return false;
        }
    }
    static waitContestActive(){
        return !checkTimerMustExist('contestRemainingTime') && checkTimerMustExist('nextContestTime');
    }
    static styles(){
        if(getStoredValue(HHStoredVarPrefixKey+SK.compactEndedContests) === "true")
        {
            const contestsContainerPath = '#contests > div > div.left_part > .scroll_area > .contest > .contest_header.ended';
            GM_addStyle(contestsContainerPath + ' {'
                + 'height: 50px;'
                + 'font-size: 0.7rem;'
            +'}');
            GM_addStyle(contestsContainerPath + ' > .contest_title {'
                + 'font-size: 14px;'
                + 'left: 140px;'
                + 'bottom: 24px;'
            +'}');
            GM_addStyle(contestsContainerPath + ' > .personal_rewards {'
                + 'height: 40px;'
                + 'margin-top: -42px;'
                + 'padding-top: 1px;'
                + 'width: 380px;'
            +'}');
            GM_addStyle(contestsContainerPath + ' > .personal_rewards > button {'
                + 'height: 23px;'
                + 'margin-right: 241px;'
                + 'margin-top: -6px;'
                + 'width: 120px;'
            +'}');
            GM_addStyle(contestsContainerPath + ' > .contest_expiration_timer {'
                + 'bottom: 95px;'
            +'}');
        }
    }
}