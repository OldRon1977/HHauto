// PathOfAttraction.ts -- Path of Attraction (PoA) event: tier collection and
// reward tracking.
//
// Path of Attraction is a tiered event where the player collects points to
// unlock reward tiers. This module tracks tier progress, collects available
// rewards, and manages the event page navigation and timer scheduling.
//
// Depends on: EventModule.ts (event detection and routing)
// Used by: EventModule.ts (called when Path of Attraction event is active)
//
import {
    ConfigHelper,
    getStoredValue,
    getStoredJSON,
    getPage,
    getGoToClubChampionButton,
    RewardHelper,
    setStoredValue,
    TimeHelper,
    randomInterval,
    getSecondsLeft,
    setTimer,
    convertTimeToInt,
    getTextForUI,
    getLimitTimeBeforeEnd
} from "../../Helper/index";
import { autoLoop } from "../../Service/index";
import { isJSON, logHHAuto } from "../../Utils/index";
import { HHStoredVarPrefixKey, SK, TK } from "../../config/index";
import { HHEvent, HHEventData, HHEventList } from "../../model/index";

class PoaReward {
    tier=0;
    type='';
    slot=$();

    constructor(tier: number, type: string, slot: JQuery<HTMLElement>) {
        this.tier = tier;
        this.type = type;
        this.slot = slot;
    }
}

export class PathOfAttraction {

    static rewardPairTierPath = "#nc-poa-tape-rewards .nc-poa-reward-pair .nc-poa-step-indicator";
    static freeSlotPath = "#nc-poa-tape-rewards .nc-poa-reward-pair .nc-poa-free-reward";
    static paidSlotPath = "#nc-poa-tape-rewards .nc-poa-reward-pair .nc-poa-locked-reward";
    static getRewardButtonPath = "#poa-content .objective .reward button.purple_button_L";

    static getRemainingTime(){
        const poATimerRequest = '#events .nc-panel-header .event-timer span[rel=expires]';
    
        if ( $(poATimerRequest).length > 0 && (getSecondsLeft("PoARemainingTime") === 0 || getStoredValue(HHStoredVarPrefixKey+TK.PoAEndDate) === undefined) )
        {
            const poATimer = Number(convertTimeToInt($(poATimerRequest).text()));
            setTimer("PoARemainingTime",poATimer);
            setStoredValue(HHStoredVarPrefixKey+TK.PoAEndDate,Math.ceil(new Date().getTime()/1000)+poATimer);
        }
    }
    static runOld(){
        //https://nutaku.haremheroes.com/path-of-attraction.html"
        let array = $('#path_of_attraction div.poa.container div.all-objectives .objective.completed');
        if (array.length == 0) {
            return
        }
        let lengthNeeded = $('.golden-block.locked').length > 0 ? 1 : 2;
        for (let i = array.length - 1; i >= 0; i--) {
            if ($(array[i]).find('.picked-reward').length == lengthNeeded) {
                array[i].style.display = "none";
            }
        }
    }

    static parse(hhEvent: HHEvent, eventList: HHEventList, hhEventData: HHEventData) {
        const eventID = hhEvent.eventId;

        PathOfAttraction.getRemainingTime();
        const poAEnd = getSecondsLeft("PoARemainingTime");
        logHHAuto("PoA end in " + TimeHelper.debugDate(poAEnd));

        let refreshTimerPoa = ConfigHelper.getHHScriptVars('maxCollectionDelay');
        if (poAEnd < Math.max(refreshTimerPoa, getLimitTimeBeforeEnd()) && getStoredValue(HHStoredVarPrefixKey + SK.autoPoACollectAll) === "true") {
            refreshTimerPoa = Math.min(refreshTimerPoa, getLimitTimeBeforeEnd());
        }
        logHHAuto("PoA next refres in " + TimeHelper.debugDate(refreshTimerPoa));

        eventList[eventID] = {};
        eventList[eventID]["id"] = eventID;
        eventList[eventID]["type"] = hhEvent.eventType;
        eventList[eventID]["seconds_before_end"] = new Date().getTime() + poAEnd * 1000;
        eventList[eventID]["next_refresh"] = new Date().getTime() + refreshTimerPoa * 1000;
        eventList[eventID]["isCompleted"] = PathOfAttraction.isCompleted();
    }

    static async run(){
        if (getPage() === ConfigHelper.getHHScriptVars("pagesIDEvent") && window.location.search.includes("tab="+ConfigHelper.getHHScriptVars('poaEventIDReg')))
        {
            logHHAuto("On path of attraction event.");
            if (ConfigHelper.getHHScriptVars("isEnabledClubChamp", false)) {
                if($(".hh-club-poa").length <= 0) {
                    const championsGoal = $('#poa-content .buttons:has(button[data-href="/champions-map.html"])');
                    championsGoal.append(getGoToClubChampionButton());
                }
            }

            const manualCollectAll = getStoredValue(HHStoredVarPrefixKey + TK.poaManualCollectAll) === 'true';
            const poAEnd = getSecondsLeft("PoARemainingTime");
            if (getStoredValue(HHStoredVarPrefixKey + SK.autoPoACollect) === "true" || manualCollectAll || poAEnd < getLimitTimeBeforeEnd() && getStoredValue(HHStoredVarPrefixKey + SK.autoPoACollectAll) === "true") {
                await PathOfAttraction.goAndCollect(manualCollectAll);
            }
        }
    }
    static styles(){
        if (getStoredValue(HHStoredVarPrefixKey +SK.AllMaskRewards) === "true")
        {
            setTimeout(PathOfAttraction.Hide,500);
        }
        if (getStoredValue(HHStoredVarPrefixKey + SK.showRewardsRecap) === "true")
        {
            PathOfAttraction.displayRewardsDiv();
        }
        PathOfAttraction.displayCollectAllButton();
    }

    static displayCollectAllButton() {
        if (PathOfAttraction.hasUnclaimedRewards() && $('#PoaCollectAll').length == 0) {

            const button = $(`<button class="purple_button_L" style="padding:0px 5px" id="PoaCollectAll">${getTextForUI("collectAllButton", "elementText")}</button>`);
            const divTooltip = $(`<div class="tooltipHH" style="position: absolute;top: -30px;left: 730px;width: 110px;font-size: small; z-index:5"><span class="tooltipHHtext">${getTextForUI("collectAllButton", "tooltip")}</span></div>`);
            divTooltip.append(button);
            $('#poa-content').append(divTooltip);
            button.one('click', () => {
                PathOfAttraction.goAndCollect(true);
            });
        }
    }

    static displayRewardsDiv() {
        try{
            const target = $('#poa-content .girls');
            const hhRewardId = 'HHPoaRewards';
            if ($('#' + hhRewardId).length <= 0) {
                const rewardCountByType = PathOfAttraction.getNotClaimedRewards();
                RewardHelper.displayRewardsDiv(target, hhRewardId, rewardCountByType);
            }
        } catch({ errName, message }) {
            logHHAuto(`ERROR in display POA rewards: ${message}`);
        }
    }

    static getNotClaimedRewards() {
        const arrayz = $('.nc-poa-reward-pair');
        const freeSlotSelectors = ".nc-poa-free-reward.claimable .slot";
        let paidSlotSelectors = "";
        if ($("div#nc-poa-tape-blocker").length == 0) {
            // Season pass paid
            paidSlotSelectors = ".nc-poa-locked-reward.claimable .slot";
        }
        return RewardHelper.computeRewardsCount(arrayz, freeSlotSelectors, paidSlotSelectors);
    }

    static _getClaimableRewards(path: string): PoaReward[] {
        const rewards: PoaReward[] = [];
        const listPoATiersToClaim = $(path);
        for (let currentTier = 0 ; currentTier < listPoATiersToClaim.length ; currentTier++)
        {
            const currentRewardTierNb = listPoATiersToClaim[currentTier].getAttribute("data-nc-reward-id");
            const slotElement = $('.slot',listPoATiersToClaim[currentTier]);
            const slotType = RewardHelper.getRewardTypeBySlot(slotElement[0]);
            rewards[currentRewardTierNb] = new PoaReward(Number(currentRewardTierNb), slotType, slotElement);
        }
        return rewards;
    }

    static hasUnclaimedRewards(): boolean {
        return $(PathOfAttraction.freeSlotPath + ".claimable" + ', ' + PathOfAttraction.paidSlotPath + ".claimable").length > 0
    }

    static getFreeClaimableRewards(): PoaReward[] {
        return PathOfAttraction._getClaimableRewards(PathOfAttraction.freeSlotPath + ".claimable");
    }

    static getPaidClaimableRewards(): PoaReward[] {
        if($("#nc-poa-tape-blocker").length) {
            return [];
        }else {
            return PathOfAttraction._getClaimableRewards(PathOfAttraction.paidSlotPath+ ".claimable");
        }
    }

    static isCompleted():boolean {
        const numberTiers = $(PathOfAttraction.rewardPairTierPath).length;
        const numberClaimedFree = $(PathOfAttraction.freeSlotPath + ".claimed").length;
        const numberClaimedPaid = $(PathOfAttraction.paidSlotPath + ".claimed").length;
        if($("#nc-poa-tape-blocker").length) {
            return numberClaimedFree >= numberTiers;
        }else {
            return numberClaimedFree >= numberTiers && numberClaimedPaid >= numberTiers;
        }
    }

    static async goAndCollect(manualCollectAll = false)
    {
        const debugEnabled = getStoredValue(HHStoredVarPrefixKey + TK.Debug) === 'true';
        const needToCollect = getStoredValue(HHStoredVarPrefixKey + SK.autoPoACollect) === "true";
        const needToCollectAllBeforeEnd = getStoredValue(HHStoredVarPrefixKey + SK.autoPoACollectAll) === "true";
        if (manualCollectAll) setStoredValue(HHStoredVarPrefixKey + TK.poaManualCollectAll, 'true');

        if (needToCollect || needToCollectAllBeforeEnd || manualCollectAll)
        {
            const rewardsToCollect = getStoredJSON(HHStoredVarPrefixKey+SK.autoPoACollectablesList, []);
    
            logHHAuto("Checking Path of Attraction for collectable rewards.");
            
            const numberTiers = $(PathOfAttraction.rewardPairTierPath).length;
            const freeClaimableRewards = PathOfAttraction.getFreeClaimableRewards();
            const paidClaimableRewards = PathOfAttraction.getPaidClaimableRewards();

            async function getReward(reward: PoaReward) {
                logHHAuto("Going to get " + JSON.stringify(reward))
                reward.slot.trigger('click');
                await TimeHelper.sleep(randomInterval(300,800));
                $(PathOfAttraction.getRewardButtonPath).trigger('click');
                await TimeHelper.sleep(randomInterval(300,800));
                RewardHelper.closeRewardPopupIfAny(); // Will refresh the page
                await TimeHelper.sleep(randomInterval(1000,1500)); // Do not collect before page refresh

                RewardHelper.closeRewardPopupIfAny(); // Close reward popup
                await TimeHelper.sleep(randomInterval(1000, 1500));
            }

            logHHAuto("numberTiers: " +  numberTiers);
            if (debugEnabled) {
                logHHAuto("freeClaimableRewards", freeClaimableRewards);
                logHHAuto("paidClaimableRewards", paidClaimableRewards);
            }
            const freeClaimableTiers = Object.keys(freeClaimableRewards);
            const paidClaimableTiers = Object.keys(paidClaimableRewards);

            if(numberTiers > 0 && (freeClaimableTiers.length > 0 || paidClaimableTiers.length > 0))
            {
                logHHAuto(`Collecting rewards, ${freeClaimableTiers.length + paidClaimableTiers.length} rewards to collect , setting autoloop to false`);
                setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
                $(".scroll-area.poa").animate({scrollLeft: 0});
                await TimeHelper.sleep(randomInterval(300,800));

                for (let currentTier = 1 ; currentTier <= numberTiers; currentTier++)
                {
                    if(freeClaimableTiers.includes(''+currentTier)) {
                        if (rewardsToCollect.includes(freeClaimableRewards[currentTier].type) || needToCollectAllBeforeEnd || manualCollectAll)
                        {
                            await getReward(freeClaimableRewards[currentTier]);
                            return true;
                        }
                    }

                    if(paidClaimableTiers.includes(''+currentTier)) {
                        if (rewardsToCollect.includes(paidClaimableRewards[currentTier].type) || needToCollectAllBeforeEnd || manualCollectAll)
                        {
                            await getReward(paidClaimableRewards[currentTier]);
                            return true;
                        }
                    }
                }

                logHHAuto("Path of Attraction collection finished.");
                setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "true");
                setTimeout(autoLoop, Number(getStoredValue(HHStoredVarPrefixKey+TK.autoLoopTimeMili)));
                return true;
            }
            else
            {
                logHHAuto("No Path of Attraction reward to collect.");
                setStoredValue(HHStoredVarPrefixKey + TK.poaManualCollectAll, 'false');
            }
        }
        return false;
    }

    static Hide(){
        if (getPage() === ConfigHelper.getHHScriptVars("pagesIDEvent") && window.location.search.includes("tab=" + ConfigHelper.getHHScriptVars('poaEventIDReg')) && getStoredValue(HHStoredVarPrefixKey +SK.AllMaskRewards) === "true")
        {
            let arrayz;
            let nbReward;
            let modified=false;
            arrayz = $('.nc-poa-reward-pair:not([style*="display:none"]):not([style*="display: none"])');
            if ($("#nc-poa-tape-blocker").length)
            {
                nbReward=1;
            }
            else
            {
                nbReward=2;
            }
    
            var obj;
            if (arrayz.length > 0) {
                for (var i2 = arrayz.length - 1; i2 >= 0; i2--) {
                    obj = $(arrayz[i2]).find('.nc-poa-reward-container.claimed');
                    if (obj.length >= nbReward) {
                        //console.log("scroll before : "+document.getElementById('rewards_cont_scroll').scrollLeft);
                        //console.log("width : "+arrayz[i2].offsetWidth);
                        $("#events .nc-panel-body .scroll-area")[0].scrollLeft-=arrayz[i2].offsetWidth;
                        //console.log("scroll after : "+document.getElementById('rewards_cont_scroll').scrollLeft);arrayz[i2].style.display = "none";
                        arrayz[i2].style.display = "none";
                        modified = true;
                    }
                }
            }
        }
    }

}
