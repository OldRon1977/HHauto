// DailyGoals.ts -- Automates daily goals: claims rewards and tracks refresh timers.
//
// The game offers daily goals with rewards upon completion. This module
// monitors goal completion status, claims available rewards, and manages
// the refresh timer so goals are checked at appropriate intervals.
//
// Used by: Service/index.ts (main automation loop)
//
import { ConfigHelper } from "../Helper/ConfigHelper";
import { getPage } from "../Helper/PageHelper";
import { RewardHelper } from "../Helper/RewardHelper";
import { getStoredJSON, getStoredValue, setStoredValue } from "../Helper/StorageHelper";
import { randomInterval, convertTimeToInt } from "../Helper/TimeHelper";
import { checkTimer, setTimer } from "../Helper/TimerHelper";
import { gotoPage } from "../Service/PageNavigationService";
import { logHHAuto } from "../Utils/LogUtils";
import { callItOnce, isJSON } from "../Utils/Utils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK, TK } from "../config/StorageKeys";
import { KKDailyGoal } from "../model/KK/kkDailyGoal";

export class DailyGoals {
    static isAutoDailyGoalsActivated(): boolean{
        return getStoredValue(HHStoredVarPrefixKey + SK.autoDailyGoals) === "true";
    }

    static getNewGoalsTimer() {
        const timerRequest = `#daily_goals .daily-goals-timer span[rel=expires]`;

        if ($(timerRequest).length > 0) {
            const goalsTimer = Number(convertTimeToInt($(timerRequest).text()));
            return goalsTimer;
        }
        logHHAuto('ERROR: can\'t get Daily goals timer, default to maxCollectionDelay');
        return ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60, 180);
    }
    static styles() {
        if ($("#daily_goals #ad_activities").length) {
            $("#daily_goals .daily-goals-objectives-container").removeClass('height-for-ad').removeClass('height-with-ad');
        }
        if(getStoredValue(HHStoredVarPrefixKey+SK.compactDailyGoals) === "true")
        {
            const dailGoalsContainerPath = '#daily_goals .daily-goals-container .daily-goals-left-part .daily-goals-objectives-container';
            GM_addStyle(dailGoalsContainerPath + ' {'
                + 'flex-wrap:wrap;'
                + 'padding: 5px;'
            +'}');
            GM_addStyle(dailGoalsContainerPath + ' .daily-goals-objective .daily-goals-objective-reward .daily_goals_potion_icn {'
                + 'background-size: 20px;'
                + 'height: 30px;'
            +'}');
            GM_addStyle(dailGoalsContainerPath + ' .daily-goals-objective .daily-goals-objective-reward > p {'
                + 'margin-top: 0;'
            +'}');

            GM_addStyle(dailGoalsContainerPath + ' .daily-goals-objective {'
                + 'width:49%;'
                + 'margin-bottom:5px;'
            +'}');

            GM_addStyle(dailGoalsContainerPath + ' .daily-goals-objective .daily-goals-objective-status .objective-progress-bar {'
                + 'height: 20px;'
                + 'width: 11.1rem;'
            +'}');

            GM_addStyle(dailGoalsContainerPath + ' .daily-goals-objective .daily-goals-objective-status .objective-progress-bar > p {'
                + 'font-size: 0.7rem;'
            +'}');

            GM_addStyle(dailGoalsContainerPath + ' .daily-goals-objective .daily-goals-objective-reward {'
                + 'height: 40px;'
                + 'width: 40px;'
            +'}');

            GM_addStyle(dailGoalsContainerPath + ' p {'
                + 'overflow: hidden;'
                + 'text-overflow: ellipsis;'
                + 'white-space: nowrap;'
                + 'max-width: 174px;'
                + 'font-size: 0.7rem;'
            +'}');
        }
        setTimeout(DailyGoalsIcon.styles, 500);
        
    }
    static goAndCollect(): boolean
    {
        const rewardsToCollect = getStoredJSON(HHStoredVarPrefixKey+SK.autoDailyGoalsCollectablesList, []);
        //console.log(rewardsToCollect.length);
        if (checkTimer('nextDailyGoalsCollectTime') && getStoredValue(HHStoredVarPrefixKey+SK.autoDailyGoalsCollect) === "true")
        {
            //console.log(getPage());
            if (getPage() === ConfigHelper.getHHScriptVars("pagesIDDailyGoals"))
            {
                try{
                    logHHAuto("Checking Daily Goals for collectable rewards. Setting autoloop to false");
                    setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
                    const nextDailyGoalsTimer = DailyGoals.getNewGoalsTimer();
                    let buttonsToCollect:HTMLElement[] = [];
                    const listDailyGoalsTiersToClaim = $("#daily_goals .progress-section .progress-bar-rewards-container .progress-bar-reward");
                    let potionsNum = Number($('.progress-section div.potions-total > div > p').text());
                    for (let currentTier = 0 ; currentTier < listDailyGoalsTiersToClaim.length ; currentTier++)
                    {
                        const currentButton = $("button[rel='claim']", listDailyGoalsTiersToClaim[currentTier]);
                        if(currentButton.length > 0 )
                        {
                            const currentTierNb = currentButton[0].getAttribute("tier");
                            const currentChest = $(".progress-bar-rewards-container", listDailyGoalsTiersToClaim[currentTier]);
                            const currentRewardsList = currentChest.length > 0 ? currentChest.data("rewards") : [];
                            //console.log("checking tier : "+currentTierNb);
                            if (nextDailyGoalsTimer <= ConfigHelper.getHHScriptVars("dailyRewardMaxRemainingTime") && nextDailyGoalsTimer > 0)
                            {
                                logHHAuto("Force adding for collection chest n° "+currentTierNb);
                                buttonsToCollect.push(currentButton[0]);
                            }
                            else
                            {
                                let validToCollect = true;
                                for (let reward of currentRewardsList)
                                {
                                    const rewardType = RewardHelper.getRewardTypeByData(reward);

                                    if (! rewardsToCollect.includes(rewardType))
                                    {
                                        logHHAuto(`Not adding for collection chest n° ${currentTierNb} because ${rewardType} is not in immediate collection list.`);
                                        validToCollect = false;
                                        break;
                                    }
                                }
                                if (validToCollect)
                                {
                                    buttonsToCollect.push(currentButton[0]);
                                    logHHAuto("Adding for collection chest n° "+currentTierNb);
                                }
                            }
                        }
                    }


                    if (buttonsToCollect.length >0 || potionsNum <100)
                    {
                        function collectDailyGoalsRewards()
                        {
                            if (buttonsToCollect.length >0)
                            {
                                logHHAuto("Collecting chest n° "+buttonsToCollect[0].getAttribute('tier'));
                                buttonsToCollect[0].click();
                                buttonsToCollect.shift();
                                setTimeout(collectDailyGoalsRewards, randomInterval(300, 500));
                            }
                            else
                            {
                                logHHAuto("Daily Goals collection finished.");
                                setTimer('nextDailyGoalsCollectTime', randomInterval(30*60, 35*60));
                                gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                            }
                        }
                        collectDailyGoalsRewards();
                        return true;
                    }
                    else
                    {
                        logHHAuto("No Daily Goals reward to collect.");
                        setTimer('nextDailyGoalsCollectTime', nextDailyGoalsTimer + randomInterval(3600, 4000));
                        gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                        return false;
                    }
                } catch (err) {
                    // Pre-fix this destructured `{ errName, message }` from the
                    // thrown value, which crashed on primitive throws (the
                    // destructure itself raised TypeError) and silently logged
                    // `undefined` on non-Error objects. Standard catch handles
                    // both safely; the message extraction stays defensive so a
                    // primitive throw still produces a readable log line.
                    const errMessage = err instanceof Error ? err.message : String(err);
                    logHHAuto(`ERROR during daily goals run: ${errMessage}, retry in 1h`);
                    setTimer('nextDailyGoalsCollectTime', randomInterval(3600, 4000));
                    return false;
                }
            }
            else
            {
                logHHAuto("Switching to Daily Goals screen.");
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDDailyGoals"));
                return true;
            }
        }
        // Default branch: timer not yet elapsed or autoDailyGoalsCollect
        // disabled. Pre-fix the function fell through with an implicit
        // `undefined` return that the Pipeline adapter coerced to falsy
        // (busy=false). Spell that out explicitly to match the declared
        // boolean return type and to survive a future strict-TS push.
        return false;
    }

    static parse(): KKDailyGoal[] {
        // parse() is registered as a page handler on the missions and
        // contests pages too (AutoLoopPageHandlers), not just on the
        // daily-goals page. On those pages unsafeWindow.daily_goals_list
        // is not populated, so the method used to fall through, log
        // "Can't parse Daily Goals", and then overwrite the dailyGoalsList
        // cache with an empty array. That wiped the cache between two real
        // daily-goals visits, so isPantheonDailyGoal() reported false and
        // the pantheon booster-override for an active daily goal never
        // fired. Guard with an early return that leaves the cache intact
        // and hands back whatever was last parsed.
        if (getPage() !== ConfigHelper.getHHScriptVars("pagesIDDailyGoals") || !unsafeWindow.daily_goals_list) {
            return getStoredJSON(HHStoredVarPrefixKey + TK.dailyGoalsList, []);
        }

        const supportedGoals: KKDailyGoal[] = [];
        for (let currentTier = 0; currentTier < unsafeWindow.daily_goals_list.length; currentTier++)
        {
            const goal = unsafeWindow.daily_goals_list[currentTier];
            if (goal && goal.progress_data.current < goal.progress_data.max )
                switch (goal.anchor){
                    // case ConfigHelper.getHHScriptVars("pagesURLLabyrinth"):
                    // case ConfigHelper.getHHScriptVars("pagesURLSeasonArena"):
                    // case ConfigHelper.getHHScriptVars("pagesURLHarem"):
                    case ConfigHelper.getHHScriptVars("pagesURLChampionsMap"):
                    case ConfigHelper.getHHScriptVars("pagesURLPantheon"):
                        supportedGoals.push(goal);
                    break;
                }
        }

        setStoredValue(HHStoredVarPrefixKey + TK.dailyGoalsList, JSON.stringify(supportedGoals));
        logHHAuto("Daily Goals", supportedGoals);
        return supportedGoals;
    }

    static _isDailyGoalType(anchor: string, update: boolean) {
        let dailyGoals: KKDailyGoal[] = getStoredJSON(HHStoredVarPrefixKey + TK.dailyGoalsList, []);
        let find = false;
        if (dailyGoals && dailyGoals.length > 0) {
            for (let currentTier = 0; currentTier < dailyGoals.length; currentTier++) {
                const goal = dailyGoals[currentTier];
                if (goal && goal.progress_data.current < goal.progress_data.max)
                    switch (goal.anchor) {
                        case anchor: 
                            if (update) goal.progress_data.current += 1;
                            find = true;
                            break;
                    }
            }
            if (find)
                setStoredValue(HHStoredVarPrefixKey + TK.dailyGoalsList, JSON.stringify(dailyGoals));
        }
        return find;
    }

    static isPantheonDailyGoal() {
        return DailyGoals.isAutoDailyGoalsActivated() && DailyGoals._isDailyGoalType(ConfigHelper.getHHScriptVars("pagesURLPantheon"), false);
    }

    static incrementPantheonDailyGoal() {
        return DailyGoals.isAutoDailyGoalsActivated() && DailyGoals._isDailyGoalType(ConfigHelper.getHHScriptVars("pagesURLPantheon"), true);
    }
}

export class DailyGoalsIcon {

    static getIcon(){
    //static getIcon(current: number, max: number){
        // TODO translation
        //return $(`<i class="daily_goals_potion_icn general_potion_icn hhauto" title="Have daily goal: ${current} / ${max}"></i>`);
        return $(`<i class="daily_goals_potion_icn general_potion_icn hhauto" title="Have daily goal"></i>`);
    }

    static displayPantheon(){
        const ocdhelp = $('#worship_data');
        if (ocdhelp.length > 0) {
            if ($('.daily_goals_potion_icn', ocdhelp).length <= 0){
                logHHAuto('displayPantheon');

                GM_addStyle('#worship_data .daily_goals_potion_icn.hhauto {'
                    + 'background-size: 15px;'
                    + 'width: 15px;'
                    + 'height: 15px;'
                    + 'left: 4px;'
                    + 'top: -4px;'
                    + 'position: absolute;'
                    + '}');

                ocdhelp.append(DailyGoalsIcon.getIcon());
            }
        }
    }
    static styles() {
        if (DailyGoals.isAutoDailyGoalsActivated() && DailyGoals._isDailyGoalType(ConfigHelper.getHHScriptVars("pagesURLPantheon"), false)) {
            DailyGoalsIcon.displayPantheon();
        }
    }
}
