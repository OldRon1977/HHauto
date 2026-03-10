// Missions.ts -- Automates missions: collects completed missions and starts new ones.
//
// Missions are time-based tasks that yield rewards. This module checks for
// completed missions, collects their rewards, and starts the next available
// mission automatically. Tracks mission durations and schedules collection
// at the right time.
//
// Used by: Service/index.ts (main automation loop)
//
import {
    RewardHelper,
    TimeHelper,
    convertTimeToInt,
    deleteStoredValue,
    ConfigHelper,
    getPage,
    getStoredValue,
    randomInterval,
    setStoredValue,
    setTimer,
    checkTimer
} from '../Helper/index';
import { gotoPage } from '../Service/index';
import { logHHAuto } from '../Utils/index';
import { HHStoredVarPrefixKey, SK, TK } from '../config/index';
import { Mission, MissionRewards } from '../model/index';

export class Missions {
    /**
    * Recieves a list of mission objects and returns the mission object to use.
    * A mission object looks similar to this :-
    * Eg 1:   {"id_member_mission":"256160093","id_mission":"23","duration":"53","cost":"1","remaining_time":"-83057","rewards":[{"classList":{"0":"slot","1":"slot_xp"},"type":"xp","data":28},{"classList":{"0":"slot","1":"slot_SC"},"type":"money","data":277}]}
    * Eg 2:   {"id_member_mission":"256160095","id_mission":"10","duration":"53","cost":"1","remaining_time":"-81330","rewards":[{"classList":{"0":"slot","1":"slot_xp"},"type":"xp","data":28},{"classList":{"0":"slot","1":"rare"},"type":"item","data":{"id_item":"23","type":"gift","subtype":"0","identifier":"K3","rarity":"rare","value":"80","carac1":0,"carac2":0,"carac3":0,"endurance":0,"chance":0,"ego":0,"damage":0,"duration":0,"level_mini":"1","name":"Bracelet","Name":"Bracelet","ico":"https://content.haremheroes.com/pictures/items/K3.png","price_sell":5561,"count":1,"id_m_i":[]}}]}
    * Eg 3:   {"id_member_mission":"256822795","id_mission":"337","duration":"17172","cost":"144","remaining_time":null,"remaining_cost":"144","rewards":[{"classList":{"0":"slot","1":"slot_HC"},"type":"koban","data":11}]}
    * Eg 1 has mission rewards of xp and money.
    * Eg 2 has mission rewards of xp and item.
    * Eg 3 has mission rewards of koban/hard_currency.
    * cost is the koban price for instant complete.
    */
    static getSuitableMission(missionsList: Mission[]): Mission
    {
        var msn = missionsList[0];
        const kFirst = getStoredValue(HHStoredVarPrefixKey + SK.autoMissionKFirst) === "true";
        const invertOrder = getStoredValue(HHStoredVarPrefixKey + SK.invertMissions) === "true"; 
        try {   
            for(var m in missionsList)
            {
                if (JSON.stringify(missionsList[m].rewards).includes("koban") && kFirst)
                {
                    return missionsList[m];
                }
                if (Number(msn.duration) > Number(missionsList[m].duration) && !invertOrder)
                {
                    msn = missionsList[m];
                }
                else if (Number(msn.duration) < Number(missionsList[m].duration) && invertOrder)
                {
                    msn = missionsList[m];
                }
            }
        } catch (error) {
            logHHAuto("Something went wrong, starting first mission in the list ", error);
            msn = missionsList[0];
        }
        return msn;
    }
    static run() {
        // returns boolean to set busy
        if(getPage() !== ConfigHelper.getHHScriptVars("pagesIDMissions"))
        {
            logHHAuto("Navigating to missions page.");
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDMissions"));
            // return busy
            return true;
        }
        else
        {
            try {
                const debugEnabled = getStoredValue(HHStoredVarPrefixKey + TK.Debug) === 'true';
                logHHAuto("On missions page.");
                if(RewardHelper.closeRewardPopupIfAny()) {
                    return true;
                }
                let canCollect = getStoredValue(HHStoredVarPrefixKey+SK.autoMissionCollect) ==="true" && $(".mission_button button:visible[rel='claim']").length >0 && TimeHelper.canCollectCompetitionActive();
                var { allGood, missions, missionOngoing } = Missions.parseMissions(canCollect);
                if (debugEnabled) logHHAuto("Missions parsed, mission list is:", missions);
                if (debugEnabled && missionOngoing != null) logHHAuto("Mission missionOngoing:", missionOngoing);

                if (!allGood && checkTimer('nextMissionTime'))
                {
                    logHHAuto("Something went wrong, need to retry in 15secs.");
                    setTimer('nextMissionTime', randomInterval(15, 30));
                    return true;
                }
                if (missions.length > 0 && missionOngoing == null)
                {
                    var mission = Missions.getSuitableMission(missions);
                    logHHAuto(`Selected mission to be started (duration: ${mission.duration}sec):`);
                    if (debugEnabled) logHHAuto(mission);
                    var missionButton = $(mission.missionObject).find("button:visible[rel='mission_start']").first();
                    if(missionButton.length > 0) {
                        missionButton.trigger('click');
                        missionOngoing = mission;
                        missionOngoing.remaining_time = Number(mission.duration);
                    }
                    else {
                        logHHAuto("Something went wrong, no start button");
                        setTimer('nextMissionTime', randomInterval(15, 30));
                        return true;
                    }
                }

                if (canCollect) {
                    logHHAuto("Collecting finished mission's reward.");
                    $(".mission_button button:visible[rel='claim']").first().trigger('click');
                    return true;
                }
                if (missionOngoing != null) {
                    logHHAuto("Mission ongoing waiting it ends.");
                    if (checkTimer('nextMissionTime')) setTimer('nextMissionTime', missionOngoing.remaining_time + randomInterval(10, 20));
                    return true;
                }

                if (missions.length == 0 && missionOngoing == null)
                {
                    logHHAuto("No missions detected...!");
                    // get gift
                    const isAfterGift = $("#missions .end_gift:visible").length > 0;
                    if (isAfterGift) {
                        const buttonAfterGift = $("#missions .end_gift button:visible");
                        if (buttonAfterGift.length > 0) {
                            logHHAuto("Collecting gift.");
                            buttonAfterGift.trigger('click');
                        }
                        else{
                            logHHAuto("Refreshing to collect gift...");
                            location.reload();
                            return true;
                        }
                    }
                    let time = $('.end-gift-timer span[rel="expires"],.after_gift .new-missions-timer span[rel="expires"]').first().text()
                    if(time === undefined || time === null || time.length === 0) {
                        logHHAuto("New mission time was undefined... Setting it manually to 10min.");
                        setTimer('nextMissionTime', randomInterval(10*60, 12*60));
                    } else 
                        setTimer('nextMissionTime', Number(convertTimeToInt(time)) + randomInterval(1,5));
                }
            } catch ({ errName, message }) {
                logHHAuto(`ERROR during mission run: ${message}, retry in 10min`);
                setTimer('nextMissionTime', randomInterval(10 * 60, 12 * 60));
            }
            // not busy
            return false;
        }
    }

    static parseMissions(canCollect:boolean) {
        var missionOngoing:Mission = null;
        var missions:Mission[] = [];
        var lastMissionData:Mission = {} as any;
        var allGood = true;
        // parse missions
        const allMissions = $(".mission_object");
        logHHAuto("Found " + allMissions.length + " missions to be parsed.");

        try {
            allMissions.each((idx, missionObject:HTMLElement) => {
                var data: Mission = $.data(missionObject).d;
                lastMissionData = data;
                // Do not list completed missions
                var toAdd = true;
                if (data.remaining_time !== null) {
                    // This is not a fresh mission (ongoing)
                    if (data.remaining_time > 0) {
                        // allGood = false;
                        if ($('.finish_in_bar[style*="display:none;"], .finish_in_bar[style*="display: none;"]', missionObject).length === 0) {
                            logHHAuto("Unfinished mission detected...(" + data.remaining_time + "sec. remaining)");
                            missionOngoing = data;
                            data.finished = false;
                        } else {
                            gotoPage(ConfigHelper.getHHScriptVars("pagesIDMissions"), {}, randomInterval(300, 800));
                            allGood = false; // Need refresh
                        }
                    }
                    else {
                        data.finished = true;
                        toAdd = false;
                    }
                    return;
                }
                else if (data.remaining_cost === null) {
                    // Finished missioned
                    data.finished = true;
                    data.remaining_time = 0;
                    toAdd = false;
                }
                data.missionObject = missionObject;
                var rewards = Missions.getMissionRewards(missionObject);
                data.rewards = rewards;

                if (toAdd) missions.push(data);
            });
        } catch (error) {
            logHHAuto("Catched error : Couldn't parse missions (try again in 15min) : " + error);
            logHHAuto("Last mission parsed : " + JSON.stringify(lastMissionData));
            setTimer('nextMissionTime', randomInterval(15*60, 20*60));
            allGood = false;
        }
        return { allGood, missions, missionOngoing };
    }

    static getMissionRewards(missionObject: HTMLElement): MissionRewards[] {
        var rewards: MissionRewards[] = [];
        // set rewards
        try {
            // get Reward slots
            var slots = missionObject.querySelectorAll(".slot");
            // traverse slots
            $.each(slots, function (idx, slotDiv) {
                var reward = new MissionRewards();
                // get slot class list
                reward.classList = slotDiv.classList;
                // set reward type
                if (reward.classList.contains("slot_xp")) reward.type = "xp";
                else if (reward.classList.contains("slot_soft_currency")) reward.type = "money";
                else if (reward.classList.contains("slot_hard_currency")) reward.type = "koban";
                else reward.type = "item";
                // set value if xp
                if (reward.type === "xp" || reward.type === "money" || reward.type === "koban") {
                    // remove all non numbers and HTML tags
                    try {
                        reward.data = Number(slotDiv.innerHTML.replace(/<.*?>/g, '').replace(/\D/g, ''));
                    }
                    catch (e) {
                        logHHAuto("Catched error : Couldn't parse xp/money data : " + e);
                        logHHAuto(slotDiv);
                    }
                }

                // set item details if item
                else if (reward.type === "item") {
                    try {
                        reward.data = $.data(slotDiv).d;
                    }
                    catch (e) {
                        logHHAuto("Catched error : Couldn't parse item reward slot details : " + e);
                        logHHAuto(slotDiv);
                        reward.type = "unknown";
                    }
                }
                rewards.push(reward);
            });
        } catch(error) {
            logHHAuto("Catched error : Couldn't parse rewards for missions : " + error);
        }
        return rewards;
    }

    static styles() {
        if ($("#missions #ad_activities").length)
        {
            $("#missions .missions_wrap").removeClass('height-for-ad').removeClass('height-with-ad');
        }
        if(getStoredValue(HHStoredVarPrefixKey+SK.compactMissions) === "true")
        {
            GM_addStyle('#missions .missions_wrap  {'
                + 'display:flex;'
                + 'flex-wrap: wrap;'
                + 'align-content: baseline;'
            +'}');
            const missionsContainerPath = '#missions .missions_wrap .mission_object.mission_entry';
            GM_addStyle(missionsContainerPath + ' {'
                + 'height: 56px;'
                + 'margin-right:3px;'
                + 'width: 49%;'
            +'}');
            GM_addStyle(missionsContainerPath + ' .mission_reward {'
                + 'width: 110px;'
                + 'padding-left: 5px;'
                + 'padding-top: 5px;'
            +'}');
            GM_addStyle(missionsContainerPath + ' .mission_image {'
                + 'height: 50px;'
                + 'width: 50px;'
                + 'margin-top: 0;'
            +'}');
            GM_addStyle(missionsContainerPath + ' .mission_details {'
                + 'display:none;'
            +'}');
            GM_addStyle(missionsContainerPath + ' .mission_button {'
            + 'display:flex;'
            + 'flex-direction:inherit;'
            + 'width:245px;'
            +'}');
            GM_addStyle(missionsContainerPath + ' .mission_button .duration {'
                + 'top:5px;'
                + 'left:5px;'
                + 'width: auto;'
            +'}');
            GM_addStyle(missionsContainerPath + ' .mission_button button {'
                + 'margin:0;'
            +'}');
            GM_addStyle(missionsContainerPath + ' .mission_button button[rel="finish"] {'
                + 'height: 50px;'
                + 'top:0;'
                + 'left: 2rem;'
                + 'padding: 4px 4px;'
            +'}');
            GM_addStyle(missionsContainerPath + ' .mission_button button[rel="claim"] {'
                + 'left:0;'
            +'}');
            GM_addStyle(missionsContainerPath + ' .mission_button .hh_bar {'
                + 'left:5px;'
            +'}');
        }
    }
}
