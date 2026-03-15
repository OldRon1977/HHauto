// PathOfValue.ts -- Path of Value (PoV) event: tier collection and reward tracking.
//
// Path of Value is a tiered event similar to Path of Glory and Path of
// Attraction, with its own point-based tier progression. This module tracks
// progress through reward tiers, collects available rewards, and manages
// event-specific timers and energy.
//
// Depends on: EventModule.ts (event detection and routing)
// Used by: EventModule.ts (called when Path of Value event is active)
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

export class PathOfValue {
    static getRemainingTime(){
        const poVTimerRequest = '#pov_tab_container > div.potions-paths-first-row .potions-paths-timer span[rel=expires]';

        if ( $(poVTimerRequest).length > 0 && (getSecondsLeft("PoVRemainingTime") === 0 || getStoredValue(HHStoredVarPrefixKey+TK.PoVEndDate) === undefined) )
        {
            const poVTimer = Number(convertTimeToInt($(poVTimerRequest).text()));
            setTimer("PoVRemainingTime",poVTimer);
            setStoredValue(HHStoredVarPrefixKey+TK.PoVEndDate,Math.ceil(new Date().getTime()/1000)+poVTimer);
        }
    }
    static displayRemainingTime()
    {
        EventModule.displayGenericRemainingTime("#scriptPovTime", "path-of-valor", "HHAutoPoVTimer", "PoVRemainingTime", HHStoredVarPrefixKey+TK.PoVEndDate);
    }
    static isEnabled(){
        return ConfigHelper.getHHScriptVars("isEnabledPoV", false) && HeroHelper.getLevel() >= ConfigHelper.getHHScriptVars("LEVEL_MIN_POV");
    }
    static getRewardButtonToCollect(): HTMLElement[] {
        const rewardsToCollect = getStoredJSON(HHStoredVarPrefixKey + SK.autoPoVCollectablesList, []);

        let buttonsToCollect: HTMLElement[] = [];
        const listPoVTiersToClaim = $("#pov_tab_container div.potions-paths-second-row div.potions-paths-central-section div.potions-paths-tier.unclaimed");
        for (let currentTier = 0; currentTier < listPoVTiersToClaim.length; currentTier++) {
            const currentButton = $("button[rel='claim']", listPoVTiersToClaim[currentTier])[0];
            const currentTierNb = currentButton.getAttribute("tier");
            //console.log("checking tier : "+currentTierNb);
            const freeSlotType = RewardHelper.getRewardTypeBySlot($(".free-slot .slot,.free-slot .shards_girl_ico", listPoVTiersToClaim[currentTier])[0]);
            if (rewardsToCollect.includes(freeSlotType)) {
                const paidSlots = $(".paid-slots:not(.paid-locked) .slot,.paid-slots:not(.paid-locked) .shards_girl_ico", listPoVTiersToClaim[currentTier]);
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
        if (getPage() === ConfigHelper.getHHScriptVars("pagesIDPoV"))
        {
            PathOfValue.getRemainingTime();
            const povEnd = getSecondsLeft("PoVRemainingTime");
            logHHAuto("PoV end in " + TimeHelper.debugDate(povEnd));

            if (checkTimer('nextPoVCollectAllTime') && povEnd < getLimitTimeBeforeEnd() && getStoredValue(HHStoredVarPrefixKey+SK.autoPoVCollectAll) === "true")
            {
                if ($(ConfigHelper.getHHScriptVars("selectorClaimAllRewards")).length > 0)
                {
                    logHHAuto("Going to collect all POV item at once.");
                    setTimeout(function (){
                        $(ConfigHelper.getHHScriptVars("selectorClaimAllRewards"))[0].click();
                        setTimer('nextPoVCollectAllTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180)); // Add timer to check again later if there is new items to collect
                        setTimeout(function (){gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));},500);
                    },500);
                    return true;
                }
                else
                {
                    setTimer('nextPoVCollectAllTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                }
            }
            if (checkTimer('nextPoVCollectTime') && getStoredValue(HHStoredVarPrefixKey+SK.autoPoVCollect) === "true")
            {
                logHHAuto("Checking Path of Valor for collectable rewards.");
                logHHAuto("setting autoloop to false");
                setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
                let buttonsToCollect:HTMLElement[] = PathOfValue.getRewardButtonToCollect();

                if (buttonsToCollect.length >0)
                {
                    function collectPoVRewards()
                    {
                        if (buttonsToCollect.length >0)
                        {
                            logHHAuto("Collecting tier : "+buttonsToCollect[0].getAttribute('tier'));
                            buttonsToCollect[0].click();
                            buttonsToCollect.shift();
                            setTimeout(collectPoVRewards, randomInterval(300, 500));
                        }
                        else
                        {
                            logHHAuto("Path of Valor collection finished.");
                            setTimer('nextPoVCollectTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                            gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                        }
                    }
                    collectPoVRewards();
                    return true;
                }
                else
                {
                    logHHAuto("No Path of Valor reward to collect.");
                    setTimer('nextPoVCollectTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                    setTimer('nextPoVCollectAllTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                    return false;
                }
            }
            return false;
        }
        else
        {
            logHHAuto("Switching to Path of Valor screen.");
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDPoV"));
            return true;
        }
    }
    static styles(){

    }
    static maskReward(){
        EventModule.moduleSimPoVPogMaskReward('pov_tab_container');
    }

}