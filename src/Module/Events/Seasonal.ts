// Seasonal.ts -- Seasonal mega-events: collection and reward claiming.
//
// Seasonal events are large-scale, time-limited events that span multiple
// days. This module tracks seasonal event progress, collects available
// rewards at each milestone, and manages event timers and page navigation.
//
// Depends on: EventModule.ts (event detection and routing)
// Used by: EventModule.ts (called when Seasonal mega-event is active)
//
import {
    RewardHelper,
    checkTimer,
    convertTimeToInt,
    ConfigHelper,
    getLimitTimeBeforeEnd,
    getPage,
    getSecondsLeft,
    getStoredValue,
    getStoredJSON,
    getTextForUI,
    randomInterval,
    setStoredValue,
    setTimer,
    TimeHelper,
    getHHVars} from "../../Helper/index";
import { gotoPage } from "../../Service/index";
import { isJSON, logHHAuto } from "../../Utils/index";
import { HHStoredVarPrefixKey, SK, TK } from "../../config/index";

export class SeasonalEvent {
    static SEASONAL_REWARD_PATH = '.mega-tier.unclaimed';
    static SEASONAL_REWARD_MEGA_PATH = '.mega-tier-container:has(.free-slot button.mega-claim-reward)';

    static isMegaSeasonalEvent() {
        return $('#get_mega_pass_kobans_btn').length > 0
    }
    static isMegaPassPaid() {
        return $('#get_mega_pass_kobans_btn:visible').length <= 0
    }
    static isActiveEvent() {
        return unsafeWindow.seasonal_event_active || unsafeWindow.seasonal_time_remaining > 0 || unsafeWindow.mega_event_active || unsafeWindow.mega_event_time_remaining > 0
    }
    static getRemainingTime(){
        const seasonalEventTimerRequest = `.mega-event-panel .mega-event-container .mega-timer span[rel=expires]`

        if ( $(seasonalEventTimerRequest).length > 0 && (getSecondsLeft("SeasonalEventRemainingTime") === 0 || getStoredValue(HHStoredVarPrefixKey+TK.SeasonalEventEndDate) === undefined) )
        {
            const seasonalEventTimer = Number(convertTimeToInt($(seasonalEventTimerRequest).text()));
            setTimer("SeasonalEventRemainingTime",seasonalEventTimer);
            setStoredValue(HHStoredVarPrefixKey+TK.SeasonalEventEndDate,Math.ceil(new Date().getTime()/1000)+seasonalEventTimer);
        }
    }
    static getGlobalRankRemainingTime(){
        const rankTimerRequest = `#top_ranking_tab_container .ranking-timer-reset .ranking-timer span[rel=expires]`

        if ( $(rankTimerRequest).length > 0)
        {
            const rankTimer = Number(convertTimeToInt($(rankTimerRequest).text()));
            return rankTimer;
        }
        logHHAuto('ERROR: can\'t get seasonal rank timer, default to maxCollectionDelay');
        return ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60, 180);
    }
    static displayRemainingTime()
    {
        logHHAuto('Not implemented');
    }
    static getSeasonalNotClaimedRewards(){
        const arrayz = $(SeasonalEvent.SEASONAL_REWARD_PATH);
        const freeSlotSelectors = ".slot";
        const paidSlotSelectors = ""; // Not available

        return RewardHelper.computeRewardsCount(arrayz, freeSlotSelectors, paidSlotSelectors);
    }
    static getMegaSeasonalNotClaimedRewards(){
        const arrayz = $(SeasonalEvent.SEASONAL_REWARD_MEGA_PATH);
        const freeSlotSelectors = ".free-slot .slot";
        const paidSlotSelectors = SeasonalEvent.isMegaPassPaid() ? ".paid-unclaimed .slot" : "";

        return RewardHelper.computeRewardsCount(arrayz, freeSlotSelectors, paidSlotSelectors);
    }
    static goAndCollect(manualCollectAll = false)
    {
        const rewardsToCollect = getStoredJSON(HHStoredVarPrefixKey+SK.autoSeasonalEventCollectablesList, []);

        if (getPage() === ConfigHelper.getHHScriptVars("pagesIDSeasonalEvent"))
        {
            try{
            SeasonalEvent.getRemainingTime();
            const isMegaSeasonalEvent = SeasonalEvent.isMegaSeasonalEvent();
            const seasonalEventEnd = getSecondsLeft("SeasonalEventRemainingTime");
            // logHHAuto("Seasonal end in " + seasonalEventEnd);
            const needToCollect = (checkTimer('nextSeasonalEventCollectTime') && getStoredValue(HHStoredVarPrefixKey+SK.autoSeasonalEventCollect) === "true")
            const needToCollectAllBeforeEnd = (checkTimer('nextSeasonalEventCollectAllTime') && seasonalEventEnd < getLimitTimeBeforeEnd() && getStoredValue(HHStoredVarPrefixKey+SK.autoSeasonalEventCollectAll) === "true");

            const seasonalTierQuery = "#home_tab_container div.bottom-container div.right-part-container div.mega-progress-bar-tiers div.mega-tier.unclaimed";
            const megaSeasonalTierQuery = "#home_tab_container div.bottom-container div.right-part-container div.mega-progress-bar-section div.mega-tier-container:has(.free-slot button.mega-claim-reward)";
            const seasonalFreeSlotQuery = ".mega-slot .slot,.mega-slot .slot_girl_shards";
            const seasonalPaidSlotQuery = ""; // N/A
            const megaSeasonalFreeSlotQuery = ".free-slot .slot";
            const megaSeasonalPaidSlotQuery = ".pass-slot.paid-unclaimed .slot";

            if (needToCollect || needToCollectAllBeforeEnd || manualCollectAll)
            {
                if (needToCollect) logHHAuto("Checking SeasonalEvent for collectable rewards.");
                if (needToCollectAllBeforeEnd) logHHAuto("Going to collect all SeasonalEvent rewards.");
                if (manualCollectAll) logHHAuto("Going to collect all SeasonalEvent rewards after collect all button usage.");
                logHHAuto("setting autoloop to false");
                setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
                let buttonsToCollect:HTMLElement[] = [];

                const listSeasonalEventTiersToClaim = isMegaSeasonalEvent ? $(megaSeasonalTierQuery) : $(seasonalTierQuery);
                const freeSlotQuery =  isMegaSeasonalEvent ? megaSeasonalFreeSlotQuery : seasonalFreeSlotQuery;
                const paidSlotQuery =  isMegaSeasonalEvent ? megaSeasonalPaidSlotQuery : seasonalPaidSlotQuery;
                const isPassPaid = isMegaSeasonalEvent && SeasonalEvent.isMegaPassPaid();

                for (let currentTier = 0 ; currentTier < listSeasonalEventTiersToClaim.length ; currentTier++)
                {
                    const currentButton = $("button[rel='claim']", listSeasonalEventTiersToClaim[currentTier])[0];
                    const currentTierNb = currentButton.getAttribute("tier");
                    //console.log("checking tier : "+currentTierNb);
                    const freeSlotType = RewardHelper.getRewardTypeBySlot($(freeSlotQuery,listSeasonalEventTiersToClaim[currentTier])[0]);
                    if (rewardsToCollect.includes(freeSlotType) || needToCollectAllBeforeEnd || manualCollectAll)
                    {
                        
                        if (isPassPaid) {
                            // One button for both
                            const paidSlotType = RewardHelper.getRewardTypeBySlot($(paidSlotQuery, listSeasonalEventTiersToClaim[currentTier])[0]);
                            if (rewardsToCollect.includes(paidSlotType) || needToCollectAllBeforeEnd || manualCollectAll)
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

                if (buttonsToCollect.length >0)
                {

                    function closeRewardAndCollectagain(){
                        RewardHelper.closeRewardPopupIfAny(false);
                        setTimeout(collectSeasonalEventRewards, randomInterval(300, 500));
                    }

                    function collectSeasonalEventRewards()
                    {
                        if (buttonsToCollect.length >0)
                        {
                            logHHAuto("Collecting tier : "+buttonsToCollect[0].getAttribute('tier'));
                            buttonsToCollect[0].click();
                            buttonsToCollect.shift();
                            setTimeout(closeRewardAndCollectagain, randomInterval(300, 500));
                        }
                        else
                        {
                            logHHAuto("SeasonalEvent collection finished.");
                            setTimer('nextSeasonalEventCollectTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                            if (!manualCollectAll) {
                                gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                            }
                        }
                    }
                    collectSeasonalEventRewards();
                    return true;
                }
                else
                {
                    logHHAuto("No SeasonalEvent reward to collect.");
                    setTimer('nextSeasonalEventCollectTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                    setTimer('nextSeasonalEventCollectAllTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                    return false;
                }
            }
            } catch ({ errName, message }) {
                logHHAuto(`ERROR: Can't collect rewards retry later: ${errName}, ${message}`);
                setTimer('nextSeasonalEventCollectTime', ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60, 180));
            }
            return false;
        }
        else if (SeasonalEvent.isActiveEvent())
        {
            logHHAuto("Switching to SeasonalEvent screen.");
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDSeasonalEvent"));
            return true;
        }
        else
        {
            logHHAuto("No SeasonalEvent active.");
            setTimer('nextSeasonalEventCollectTime', 604800); // 1 week delay
            setTimer('nextSeasonalEventCollectAllTime', 604800); // 1 week delay
            return false;
        }
    }
    static styles(){
        if (getStoredValue(HHStoredVarPrefixKey +SK.AllMaskRewards) === "true")
        {
            SeasonalEvent.maskReward();
        }
        if (getStoredValue(HHStoredVarPrefixKey + SK.showRewardsRecap) === "true")
        {
            SeasonalEvent.displayRewardsSeasonalDiv();
            // SeasonalEvent.displayGirlsMileStones(); // TODO fixme
            SeasonalEvent.displayCollectAllButton()
        }

        GM_addStyle(`.mega-event-panel .mega-event-container .tabs-section #home_tab_container .bottom-container .right-part-container .mega-tiers-section .mega-progress-bar-section .mega-progress-bar-tiers.double-mega-event .mega-tier-container {
                width: 77px;}`
        );

        GM_addStyle(`.mega-event-panel .mega-event-container .tabs-section #home_tab_container .bottom-container .right-part-container .mega-tiers-section .mega-progress-bar-section .mega-progress-bar-tiers .double-tier .mega-tier {
                margin: 1rem 0 0;}`
        );
    }
    static hasUnclaimedRewards(): boolean{
        return $(SeasonalEvent.SEASONAL_REWARD_MEGA_PATH + ', ' + SeasonalEvent.SEASONAL_REWARD_PATH).length > 0
    }
    static maskReward(){

        var arrayz;
        let modified = false;
        
        const isMegaSeasonalEvent = SeasonalEvent.isMegaSeasonalEvent();
        const seasonalTierQuery = ".mega-progress-bar-tiers .mega-tier-container";
        const megaSeasonalTierQuery = ".mega-progress-bar-tiers .mega-tier-container";

        arrayz = $((isMegaSeasonalEvent ? megaSeasonalTierQuery : seasonalTierQuery) + ':not([style*="display:none"]):not([style*="display: none"])');
        var obj;
        if (arrayz.length > 0)
        {
            for (var i2 = arrayz.length - 1; i2 >= 0; i2--)
            {
                obj = $(arrayz[i2]).find('.claimed:not([style*="display:none"]):not([style*="display: none"])'); // TODO ".paid-claimed .slot"
                if (obj.length >= 1)
                {
                    arrayz[i2].style.display = "none";
                    modified = true;
                }
            }
        }
    
        if (modified)
        {
            let divToModify = $('.seasonal-progress-bar-section, .mega-progress-bar-section');
            if (divToModify.length > 0)
            {
                //(divToModify as any).getNiceScroll().resize();
    
                const width_px = 152.1;
                const start_px = 101;
                const rewards_unclaimed = $('.mega-tier.unclaimed, .free-slot:not(.claimed)').length;
                const scroll_width_hidden = Math.floor(start_px + (rewards_unclaimed - 1) * width_px);
                $('.seasonal-progress-bar-current, .mega-progress-bar').css('width', scroll_width_hidden + 'px');
    
                // try {
                //     (divToModify as any).getNiceScroll(0).doScrollLeft(0, 200);
                // } catch(err) {}
            }
        }
    }
    static displayCollectAllButton(){
        if (SeasonalEvent.hasUnclaimedRewards() && $('#SeasonalCollectAll').length == 0) {
            const button = $(`<button class="purple_button_L" id="SeasonalCollectAll">${getTextForUI("collectAllButton", "elementText")}</button>`);
            const divTooltip = $(`<div class="tooltipHH" style="position: absolute;top: 260px;width: 110px;font-size: small;"><span class="tooltipHHtext">${getTextForUI("collectAllButton", "tooltip")}</span></div>`);
            divTooltip.append(button);
            $('#home_tab_container .bottom-container').append(divTooltip);
            button.one('click', () => {
                SeasonalEvent.goAndCollect(true);
            });
        }
    }
    static displayGirlsMileStones() {
        if($('.HHGirlMilestone').length > 0) return;
        const $playerPoints = $('.player-shards .mega-event-currency');
        if($playerPoints.length == 0) {
            logHHAuto("ERROR: Can't find player points");
        }
        const playerPoints = $playerPoints.length ? Number($playerPoints.text()) : 0;

        const girlContainer = $('.girls-reward-container');

        const girlSlotRewards = $('#home_tab_container .bottom-container .slot.slot_girl_shards');
        girlSlotRewards.each(function(index, girlSlot) {
            const milestone = Number($('.tier-level p',$(girlSlot).parents('.mega-tier-container')).text());
            if(milestone > 0) {
                girlContainer.append(SeasonalEvent.getGirlMileStonesDiv(playerPoints, milestone, index+1))
            }
        });
    }
    static getGirlMileStonesDiv(playerPoints, girlPointsTarget, girlIndex) {
        const greeNitckHtml = '<img class="nc-claimed-reward-check" src="'+ConfigHelper.getHHScriptVars("baseImgPath")+'/clubs/ic_Tick.png">';
        const girlDiv = $('<div class="HHGirlMilestone girl-img-'+girlIndex+'"><div>Girl '+girlIndex+':'+playerPoints+'/'+girlPointsTarget+'</div></div>');
        if(playerPoints >= girlPointsTarget) {
            girlDiv.addClass('green');
            girlDiv.append($(greeNitckHtml));
        }
        return girlDiv;
    }
    static displayRewardsSeasonalDiv() {
        const target = $('.girls-reward-container'); // $('.event-resource-location');
        const hhRewardId = 'HHSeasonalRewards';
        const isMegaSeasonalEvent = SeasonalEvent.isMegaSeasonalEvent();
        try{
            if($('#' + hhRewardId).length <= 0) {
                const rewardCountByType = isMegaSeasonalEvent ? SeasonalEvent.getMegaSeasonalNotClaimedRewards() : SeasonalEvent.getSeasonalNotClaimedRewards();
                logHHAuto("Rewards seasonal event:", JSON.stringify(rewardCountByType));
                if (rewardCountByType['all'] > 0) {
                    // GM_addStyle('.seasonal-event-panel .seasonal-event-container .tabs-section #home_tab_container .middle-container .event-resource-location .buttons-container { height: 5rem; margin-top: 0;}'); 
                    // GM_addStyle('.seasonal-event-panel .seasonal-event-container .tabs-section #home_tab_container .middle-container .event-resource-location .buttons-container a { height: 2rem;}'); 

                    for (var i = 0; i < 4; i++) {
                        // move video down
                        GM_addStyle(`.mega-event-panel .mega-event-container .tabs-section #home_tab_container .middle-container .lse-container-${i} { z-index:3;}`);
                    }
                    const rewardsHtml = RewardHelper.getRewardsAsHtml(rewardCountByType);
                    target.append($('<div id='+hhRewardId+' class="HHRewardNotCollected"><h1 style="font-size: small;">'+getTextForUI('rewardsToCollectTitle',"elementText")+'</h1>' + rewardsHtml + '</div>'));
                } else {
                    target.append($('<div id='+hhRewardId+' style="display:none;"></div>'));
                }
            }
        } catch(err) {
            logHHAuto("ERROR:", err.message);
            target.append($('<div id='+hhRewardId+' style="display:none;"></div>'));
        }
    }
    static async goAndCollectMegaEventRankRewards():Promise<boolean> {
        if (getPage() === ConfigHelper.getHHScriptVars("pagesIDSeasonalEvent"))
        {
            const isMegaSeasonalEvent = SeasonalEvent.isMegaSeasonalEvent();
            const topRank = $('#mega-event-tabs #top_ranking_tab');
            const eventRank = $('#mega-event-tabs #event_ranking_tab');
            if(!isMegaSeasonalEvent && topRank.length === 0 && eventRank.length === 0) {
                logHHAuto('Not Mega Event');
                setTimer('nextMegaEventRankCollectTime', 604800); // 1 week delay
                return Promise.resolve(false);
            } else if(topRank.length > 0 || eventRank.length > 0) {
                logHHAuto('Not Mega Event but rank tab exist');
            }
            logHHAuto('Collect Mega Event Rank Rewards');
            // switch tabs
            if (topRank.length > 0) topRank.trigger("click");
            await TimeHelper.sleep(randomInterval(400, 600));
            RewardHelper.closeRewardPopupIfAny();
            if (eventRank.length > 0) eventRank.trigger("click");
            await TimeHelper.sleep(randomInterval(400, 600));
            RewardHelper.closeRewardPopupIfAny();

            setTimer('nextMegaEventRankCollectTime', SeasonalEvent.getGlobalRankRemainingTime() + randomInterval(3600,4000));
        }
        else if (SeasonalEvent.isActiveEvent())
        {
            logHHAuto("Switching to SeasonalEvent screen.");
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDSeasonalEvent"));
            return Promise.resolve(true);
        }
        else
        {
            logHHAuto("No SeasonalEvent active.");
            setTimer('nextMegaEventRankCollectTime', 604800); // 1 week delay
        }
        return Promise.resolve(false);
    }
    static async goAndCollectFreeCard():Promise<boolean> {

        var cardsOwned = getHHVars('mega_event_data.cards');
        if (cardsOwned && cardsOwned.indexOf('1')>=0) {
            logHHAuto(`Free cards already collected (${cardsOwned}), wait for next seasonal event`);
            setTimer('nextSeasonalCardCollectTime', getSecondsLeft("SeasonalEventRemainingTime") + randomInterval(3600, 4000));
        } else {
            if (getPage() === ConfigHelper.getHHScriptVars("pagesIDSeasonalEvent"))
            {
                const isMegaSeasonalEvent = SeasonalEvent.isMegaSeasonalEvent();
                const cardTabs = $('#mega-event-tabs #cards_tab');
                if(cardTabs.length > 0) {
                    logHHAuto('Collect free cards from Seasonal Event');
                    // switch tabs
                    cardTabs.trigger("click");
                    await TimeHelper.sleep(randomInterval(400, 600));

                    const freeCardClaimButton = $('#cards_tab_container .free-card:not([disabled])');
                    if (freeCardClaimButton.length > 0) freeCardClaimButton.trigger("click");
                    await TimeHelper.sleep(randomInterval(400, 600));
                    RewardHelper.closeRewardPopupIfAny(); // Close card popup
                    await TimeHelper.sleep(randomInterval(400, 600));
                    RewardHelper.closeRewardPopupIfAny(); // Close card reward popup
                    if (freeCardClaimButton.length > 1) {
                        logHHAuto('There is still free cards to collect, try again');
                        freeCardClaimButton.trigger("click");
                        await TimeHelper.sleep(randomInterval(400, 600));
                        RewardHelper.closeRewardPopupIfAny();
                    }
                }

                setTimer('nextSeasonalCardCollectTime', getSecondsLeft("SeasonalEventRemainingTime") + randomInterval(3600,4000));
            }
            else if (SeasonalEvent.isActiveEvent())
            {
                logHHAuto("Switching to SeasonalEvent screen.");
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDSeasonalEvent"));
                return Promise.resolve(true);
            }
            else
            {
                logHHAuto("No SeasonalEvent active.");
                setTimer('nextSeasonalCardCollectTime', 604800); // 1 week delay
            }
        }
        return Promise.resolve(false);
    }
}