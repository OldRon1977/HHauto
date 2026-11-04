// PathOfGlory.ts -- Path of Glory (PoG) event: tier collection and reward tracking.
//
// Path of Glory is a tiered event: points the game counts elsewhere unlock
// reward tiers. This module reads the remaining time, collects the claimable
// tiers the collect list allows, and sweeps everything in the final window
// when "Collect all" is on.
//
// Used by: AutoLoopPageHandlers.ts (the event page) and Pipeline.config.ts
//          (the collect block)
//
import { ConfigHelper } from "../../Helper/ConfigHelper";
import { getPage } from "../../Helper/PageHelper";
import { RewardHelper } from "../../Helper/RewardHelper";
import { getStoredValue, getStoredArray, setStoredValue } from "../../Helper/StorageHelper";
import { TimeHelper, convertTimeToInt, getLimitTimeBeforeEnd, randomInterval, collectAllDelay } from "../../Helper/TimeHelper";
import { checkTimer, getSecondsLeft, setTimer } from "../../Helper/TimerHelper";
import { gotoPage } from "../../Service/PageNavigationService";
import { logHHAuto } from "../../Utils/LogUtils";
import { FeatureGate } from "../../Service/FeatureGate";
import { HHStoredVarPrefixKey } from "../../config/HHStoredVars";
import { SK, TK } from "../../config/StorageKeys";
import { EventModule } from "./EventModule";
import { PassHelper } from "../../Helper/PassHelper";

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
        return FeatureGate.isUnlocked('pathOfGlory');
    }
    static getRewardButtonToCollect(): HTMLElement[] {
        const rewardsToCollect = getStoredArray<string>(HHStoredVarPrefixKey + SK.autoPoGCollectablesList);

        const buttonsToCollect: HTMLElement[] = [];
        const listPoGTiersToClaim = $("#pog_tab_container div.potions-paths-second-row div.potions-paths-central-section div.potions-paths-tier.unclaimed");
        const halves = PassHelper.TRACK_HALVES.potionsPath;
        const ownsPass = PassHelper.ownsPass('potionsPath');
        for (let currentTier = 0; currentTier < listPoGTiersToClaim.length; currentTier++) {
            const currentButton: HTMLElement = $("button[rel='claim']", listPoGTiersToClaim[currentTier])[0];
            if (RewardHelper.pickTier(listPoGTiersToClaim[currentTier], halves, ownsPass, rewardsToCollect, false, currentButton.getAttribute("tier"))) {
                buttonsToCollect.push(currentButton);
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

            // `pogEnd > 0` is the guard from #1846: getSecondsLeft returns 0
            // both for "no such timer" and for "already expired", so without
            // it an unknown remaining time opened the collect-all gate at any
            // distance from the event end -- and collect-all bypasses the
            // player's own tier filter.
            //
            // No check of the collect-all timer here: that timer only
            // schedules the script's own visit. Once on the page inside the
            // final window, the sweep runs whatever brought the script here
            // -- the collect round used to arrive seconds before that timer
            // ran out and push it back 6 h.
            if (pogEnd > 0 && pogEnd < getLimitTimeBeforeEnd() && getStoredValue(HHStoredVarPrefixKey+SK.autoPoGCollectAll) === "true")
            {
                if ($(ConfigHelper.getHHScriptVars("selectorClaimAllRewards")).length > 0)
                {
                    logHHAuto("Going to collect all POG item at once.");
                    setTimeout(function (){
                        $(ConfigHelper.getHHScriptVars("selectorClaimAllRewards"))[0].click();
                        setTimer('nextPoGCollectAllTime', collectAllDelay(ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180), pogEnd)); // Add timer to check again later if there is new items to collect
                        setTimeout(function (){gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));},500);
                    },500);
                    return true;
                }
                else
                {
                    setTimer('nextPoGCollectAllTime', collectAllDelay(ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180), pogEnd));
                }
            }
            // "Collect all" is the final-window sweep above, not a second
            // switch for the routine round -- that is what its tooltip says
            // ("collect all items before end ... configured with Collect all
            // timer") and what PathOfValue and PathOfAttraction do. Path of
            // Glory alone carried `|| autoPoGCollectAll` here, from the commit
            // that first brought both files over, so the same two switches
            // behaved differently on two otherwise identical features.
            if (checkTimer('nextPoGCollectTime') && getStoredValue(HHStoredVarPrefixKey+SK.autoPoGCollect) === "true")
            {
                logHHAuto("Checking Path of Glory for collectable rewards.");
                logHHAuto("setting autoloop to false");
                setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
                const buttonsToCollect: HTMLElement[] = PathOfGlory.getRewardButtonToCollect();

                if (buttonsToCollect.length >0)
                {
                    RewardHelper.claimInTurn(buttonsToCollect, () => {
                        logHHAuto("Path of Glory collection finished.");
                        setTimer('nextPoGCollectTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                        gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                    });
                    return true;
                }
                else
                {
                    logHHAuto("No Path of Glory reward to collect.");
                    setTimer('nextPoGCollectTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                    setTimer('nextPoGCollectAllTime', collectAllDelay(ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180), pogEnd));
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