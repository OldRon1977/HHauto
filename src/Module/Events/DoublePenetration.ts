// DoublePenetration.ts -- Double Penetration event: fight tracking and rewards.
//
// Double Penetration is a time-limited competitive event with its own fight
// mechanics. This module tracks event progress, manages fight energy, collects
// milestone rewards, and handles the event-specific UI interactions.
//
// Depends on: EventModule.ts (event detection and routing)
// Used by: EventModule.ts (called when Double Penetration event is active)
//
import {
    RewardHelper,
    checkTimer,
    getGoToClubChampionButton,
    ConfigHelper,
    getPage,
    getLimitTimeBeforeEnd,
    getStoredValue,
    getStoredJSON,
    randomInterval,
    setStoredValue,
    setTimer,
    getTextForUI,
    convertTimeToInt,
    HeroHelper,
} from "../../Helper/index";
import { autoLoop, gotoPage } from "../../Service/index";
import { isJSON, logHHAuto } from "../../Utils/index";
import { HHStoredVarPrefixKey, SK, TK } from "../../config/index";
import { HHEvent, HHEventData, HHEventList } from "../../model/index";

export class DoublePenetration {

    static isEnabled() {
        return ConfigHelper.getHHScriptVars("isEnabledDPEvent", false) && HeroHelper.getLevel() >= ConfigHelper.getHHScriptVars("LEVEL_MIN_EVENT_DP"); // And 10 gilrs
    }

    static parse(hhEvent: HHEvent, eventList: HHEventList, hhEventData: HHEventData) {
        const eventID = hhEvent.eventId;
        let refreshTimer = randomInterval(3600, 4000);

        let timeLeft = $('#contains_all #events .nc-panel .timer span[rel="expires"]').text();
        let dpRemainingTime = 3600;
        if (timeLeft !== undefined && timeLeft.length) {
            dpRemainingTime = Number(convertTimeToInt(timeLeft));
        }
        setTimer('eventDPGoing', dpRemainingTime);

        eventList[eventID] = {};
        eventList[eventID]["id"] = eventID;
        eventList[eventID]["type"] = hhEvent.eventType;
        eventList[eventID]["seconds_before_end"] = new Date().getTime() + dpRemainingTime * 1000;
        eventList[eventID]["next_refresh"] = new Date().getTime() + refreshTimer * 1000;
        eventList[eventID]["isCompleted"] = false;

        if (getStoredValue(HHStoredVarPrefixKey + SK.autodpEventCollect) === "true" || dpRemainingTime < getLimitTimeBeforeEnd() && getStoredValue(HHStoredVarPrefixKey + SK.autodpEventCollectAll) === "true") {
            DoublePenetration.goAndCollect(dpRemainingTime);
        }
    }

    static goAndCollect(dpRemainingTime: number, manualCollectAll = false)
    {
        try {
            const rewardsToCollect = getStoredJSON(HHStoredVarPrefixKey+SK.autodpEventCollectablesList, []);

            const needToCollectAll =  dpRemainingTime < getLimitTimeBeforeEnd() && getStoredValue(HHStoredVarPrefixKey+SK.autodpEventCollectAll) === "true";
            const needToCollect = (checkTimer('nextDpEventCollectTime') && getStoredValue(HHStoredVarPrefixKey+SK.autodpEventCollect) === "true");

            const dPTierQuery = "#dp-content .tiers-container .player-progression-container .tier-container:has(button.display-block)";
            const dPFreeSlotQuery = ".free-slot .slot,.free-slot .slot_girl_shards";
            const dPPaidSlotQuery = ".paid-slot .slot,.paid-slot .slot_girl_shards";
            const isPassPaid = $("#nc-poa-tape-blocker button.unlock-poa-bonus-rewards:visible").length <= 0;

            if (needToCollect || needToCollectAll || manualCollectAll)
            {
                logHHAuto("Checking double penetration event for collectable rewards.");
                logHHAuto("setting autoloop to false");
                setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
                let buttonsToCollect:HTMLElement[] = [];
                const listDpEventTiersToClaim = $(dPTierQuery);

                for (let currentTier = 0 ; currentTier < listDpEventTiersToClaim.length ; currentTier++)
                {
                    const currentButton = $("button[rel='reward-claim']", listDpEventTiersToClaim[currentTier])[0];
                    const currentTierNb = currentButton.getAttribute("tier");
                    //console.log("checking tier : "+currentTierNb);
                    if(needToCollectAll) {
                        logHHAuto("Adding for collection tier before end of event: "+currentTierNb);
                        buttonsToCollect.push(currentButton);
                    } else if (manualCollectAll) {
                        logHHAuto("Adding for collection tier from manual collect all: "+currentTierNb);
                        buttonsToCollect.push(currentButton);
                    } else {
                        const freeSlotType = RewardHelper.getRewardTypeBySlot($(dPFreeSlotQuery,listDpEventTiersToClaim[currentTier])[0]);
                        if (rewardsToCollect.includes(freeSlotType))
                        {
                            
                            if (isPassPaid) {
                                // One button for both
                                const paidSlotType = RewardHelper.getRewardTypeBySlot($(dPPaidSlotQuery, listDpEventTiersToClaim[currentTier])[0]);
                                if (rewardsToCollect.includes(paidSlotType))
                                {
                                    buttonsToCollect.push(currentButton);
                                    logHHAuto("Adding for collection tier (free + paid) : "+currentTierNb);
                                } else {
                                    logHHAuto("Can't add tier " + currentTierNb + " as paid reward isn't to be colled");
                                }
                            } else {
                                buttonsToCollect.push(currentButton);
                                logHHAuto("Adding for collection tier (only free) : "+currentTierNb);
                            }
                        }
                    }
                }

                if (buttonsToCollect.length >0)
                {
                    function collectDpEventRewards()
                    {
                        if (buttonsToCollect.length >0)
                        {
                            logHHAuto("Collecting tier : "+buttonsToCollect[0].getAttribute('tier'));
                            buttonsToCollect[0].click();
                            buttonsToCollect.shift();
                            setTimeout(RewardHelper.closeRewardPopupIfAny, randomInterval(300, 500));
                            setTimeout(collectDpEventRewards, randomInterval(500,800));
                        }
                        else
                        {
                            logHHAuto("Double penetration collection finished.");
                            setTimer('nextDpEventCollectTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                            //gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                            setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "true");
                            setTimeout(autoLoop, Number(getStoredValue(HHStoredVarPrefixKey+TK.autoLoopTimeMili)));
                        }
                    }
                    collectDpEventRewards();
                    return true;
                }
                else
                {
                    logHHAuto("No double penetration reward to collect.");
                    setTimer('nextDpEventCollectTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                    //gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                    setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "true");
                    setTimeout(autoLoop, Number(getStoredValue(HHStoredVarPrefixKey+TK.autoLoopTimeMili)));
                    return false;
                }
            }
            return true;
        } catch ({ errName, message }) {
            logHHAuto(`ERROR during collect DP rewards: ${message}`);
        }
        return false;
    }
    static run(){
        if (getPage() === ConfigHelper.getHHScriptVars("pagesIDEvent") && window.location.search.includes("tab="+ConfigHelper.getHHScriptVars('doublePenetrationEventIDReg')))
        {
            logHHAuto("On Double penetration event.");
            if (getStoredValue(HHStoredVarPrefixKey + SK.showClubButtonInPoa) === "true" && ConfigHelper.getHHScriptVars("isEnabledClubChamp", false))
            {
                GM_addStyle('#dp-content .left-container .objectives-container .hard-objective .nc-sub-panel div.buttons .redirect-buttons {flex-direction: column;}');
                if($(".hard-objective .hh-club-poa").length <= 0) {
                    const championsGoal = $('.hard-objective .redirect-buttons:has(button[data-href="/champions-map.html"])');
                    championsGoal.append(getGoToClubChampionButton());
                }
                if($(".easy-objective .hh-club-poa").length <= 0) {
                    const championsGoal = $('.easy-objective .redirect-buttons:has(button[data-href="/champions-map.html"])');
                    championsGoal.append(getGoToClubChampionButton());
                }
            }
            if (getStoredValue(HHStoredVarPrefixKey + SK.showRewardsRecap) === "true") {
                DoublePenetration.displayRewardsDiv();
                DoublePenetration.displayCollectAllButton();
            }
        }
    }

    static hasUnclaimedRewards(): boolean {
        return $(".tier-container button.purple_button_L:visible").length > 0
    }

    static displayRewardsDiv() {
        try {
            const target = $('#dp-content .right-container');
            const hhRewardId = 'HHDpRewards';
            if ($('#' + hhRewardId).length <= 0) {
                const rewardCountByType = DoublePenetration.getNotClaimedRewards();
                RewardHelper.displayRewardsDiv(target, hhRewardId, rewardCountByType);
            }
        } catch({ errName, message }) {
            logHHAuto(`ERROR in display DP rewards: ${message}`);
        }
    }

    static getNotClaimedRewards() {
        const arrayz = $('#dp-content .tier-container:has(.tier-level button[rel="reward-claim"]:visible)');
        const freeSlotSelectors = ".free-slot .slot";
        let paidSlotSelectors = "";
        if ($("div#nc-poa-tape-blocker").length == 0) {
            // Season pass paid
            paidSlotSelectors = ".paid-slot  .slot";
        }
        return RewardHelper.computeRewardsCount(arrayz, freeSlotSelectors, paidSlotSelectors);
    }

    static displayCollectAllButton() {
        if (DoublePenetration.hasUnclaimedRewards() && $('#dpCollectAll').length == 0) {

            const button = $(`<button class="purple_button_L" style="padding:0px 5px" id="dpCollectAll">${getTextForUI("collectAllButton", "elementText")}</button>`);
            const divTooltip = $(`<div class="tooltipHH" style="position: absolute;top: 135px;width: 80px;font-size: small; z-index:5"><span class="tooltipHHtext">${getTextForUI("collectAllButton", "tooltip")}</span></div>`);
            divTooltip.append(button);
            $('#dp-content .tiers-container .player-potions').append(divTooltip);
            button.one('click', () => {
                DoublePenetration.goAndCollect(Infinity,true);
            });
        }
    }
}