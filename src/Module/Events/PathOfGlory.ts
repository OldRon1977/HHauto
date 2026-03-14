// PathOfGlory.ts -- Path of Glory (PoG) event: tier collection and reward tracking.
//
// Path of Glory is a tiered event where the player earns points through
// battles to unlock progressive reward tiers. This module tracks tier
// progress, checks for claimable rewards, and manages fight energy and
// timer scheduling for the event.
//
// Depends on: EventModule.ts (event detection and routing)
// Used by: EventModule.ts (called when Path of Glory event is active)
//
import {
    RewardHelper,
    TimeHelper,
    checkTimer,
    convertTimeToInt,
    ConfigHelper,
    getHHVars,
    getLimitTimeBeforeEnd,
    getPage,
    getSecondsLeft,
    getStoredValue,
    getStoredJSON,
    randomInterval,
    setStoredValue,
    setTimer,
    HeroHelper} from "../../Helper/index";
    import { gotoPage } from "../../Service/index";
    import { isJSON, logHHAuto } from "../../Utils/index";
import { HHStoredVarPrefixKey, SK, TK } from "../../config/index";
import { EventModule } from "./EventModule";

export class PathOfGlory {
    static getRemainingTime(){
        const poGTimerRequest = '#pog_tab_container > div.potions-paths-first-row .potions-paths-timer span[rel=expires]';
    
        if ( $(poGTimerRequest).length > 0 && (getSecondsLeft("PoGRemainingTime") === 0 || getStoredValue(HHStoredVarPrefixKey+TK.PoGEndDate) === undefined) )
        {
            const poGTimer = Number(convertTimeToInt($(poGTimerRequest).text()));
            setTimer("PoGRemainingTime",poGTimer);
            setStoredValue(HHStoredVarPrefixKey+TK.PoGEndDate,Math.ceil(new Date().getTime()/1000)+poGTimer);
        }
    }
    static displayRemainingTime()
    {
        EventModule.displayGenericRemainingTime("#scriptPogTime", "path-of-glory", "HHAutoPoGTimer", "PoGRemainingTime", HHStoredVarPrefixKey+TK.PoGEndDate);
    }
    static isEnabled(){
        return ConfigHelper.getHHScriptVars("isEnabledPoG", false) && HeroHelper.getLevel() >= ConfigHelper.getHHScriptVars("LEVEL_MIN_POG");
    }
    static getRewardButtonToCollect(): HTMLElement[] {
        const rewardsToCollect = getStoredJSON(HHStoredVarPrefixKey + SK.autoPoGCollectablesList, []);

        let buttonsToCollect: HTMLElement[] = [];
        const listPoGTiersToClaim = $("#pog_tab_container div.potions-paths-second-row div.potions-paths-central-section div.potions-paths-tier.unclaimed");
        for (let currentTier = 0; currentTier < listPoGTiersToClaim.length; currentTier++) {
            const currentButton: HTMLElement = $("button[rel='claim']", listPoGTiersToClaim[currentTier])[0];
            const currentTierNb = currentButton.getAttribute("tier");
            //console.log("checking tier : "+currentTierNb);
            const freeSlotType = RewardHelper.getRewardTypeBySlot($(".free-slot .slot,.free-slot .shards_girl_ico", listPoGTiersToClaim[currentTier])[0]);
            if (rewardsToCollect.includes(freeSlotType)) {
                const paidSlots = $(".paid-slots:not(.paid-locked) .slot,.paid-slots:not(.paid-locked) .shards_girl_ico", listPoGTiersToClaim[currentTier]);
                if (paidSlots.length > 0) {
                    const passSlotType = RewardHelper.getRewardTypeBySlot(paidSlots[0]);
                    const passPlusSlotType = RewardHelper.getRewardTypeBySlot(paidSlots[1]);

                    if (rewardsToCollect.includes(passSlotType) && (paidSlots.length > 1 ? rewardsToCollect.includes(passPlusSlotType) : true)) {
                        buttonsToCollect.push(currentButton);
                        logHHAuto(`Adding for collection tier (with paid) : ${currentTierNb} (Free: ${freeSlotType}, Pass: ${passSlotType}, Pass+: ${paidSlots.length > 1 ? passPlusSlotType : 'locked'})`);
                    }
                }
                else {
                    buttonsToCollect.push(currentButton);
                    logHHAuto(`Adding for collection tier (only free) : ${currentTierNb} (${freeSlotType})`);
                }
            }
        }
        return buttonsToCollect;
    }
    static goAndCollect()
    {
        if (getPage() === ConfigHelper.getHHScriptVars("pagesIDPoG"))
        {
            PathOfGlory.getRemainingTime();
            const pogEnd = getSecondsLeft("PoGRemainingTime");
            logHHAuto("PoG end in " + TimeHelper.debugDate(pogEnd));

            if (checkTimer('nextPoGCollectAllTime') && pogEnd < getLimitTimeBeforeEnd() && getStoredValue(HHStoredVarPrefixKey+SK.autoPoGCollectAll) === "true")
            {
                if ($(ConfigHelper.getHHScriptVars("selectorClaimAllRewards")).length > 0)
                {
                    logHHAuto("Going to collect all POG item at once.");
                    setTimeout(function (){
                        $(ConfigHelper.getHHScriptVars("selectorClaimAllRewards"))[0].click();
                        setTimer('nextPoGCollectAllTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180)); // Add timer to check again later if there is new items to collect
                        setTimeout(function (){gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));},500);
                    },500);
                    return true;
                }
                else
                {
                    setTimer('nextPoGCollectAllTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                }
            }
            if (checkTimer('nextPoGCollectTime') && (getStoredValue(HHStoredVarPrefixKey+SK.autoPoGCollect) === "true" || getStoredValue(HHStoredVarPrefixKey+SK.autoPoGCollectAll) === "true"))
            {
                logHHAuto("Checking Path of Glory for collectable rewards.");
                logHHAuto("setting autoloop to false");
                setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
                let buttonsToCollect: HTMLElement[] = PathOfGlory.getRewardButtonToCollect();

                if (buttonsToCollect.length >0)
                {
                    function collectPoGRewards()
                    {
                        if (buttonsToCollect.length >0)
                        {
                            logHHAuto("Collecting tier : "+buttonsToCollect[0].getAttribute('tier'));
                            buttonsToCollect[0].click();
                            buttonsToCollect.shift();
                            setTimeout(collectPoGRewards, randomInterval(300, 500));
                        }
                        else
                        {
                            logHHAuto("Path of Glory collection finished.");
                            setTimer('nextPoGCollectTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                            gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                        }
                    }
                    collectPoGRewards();
                    return true;
                }
                else
                {
                    logHHAuto("No Path of Glory reward to collect.");
                    setTimer('nextPoGCollectTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                    setTimer('nextPoGCollectAllTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                    return false;
                }
            }
            return false;
        }
        else
        {
            logHHAuto("Switching to Path of Glory screen.");
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDPoG"));
            return true;
        }
    }
    static maskReward(){
        EventModule.moduleSimPoVPogMaskReward('pog_tab_container');
    }
    static styles(){

    }
}