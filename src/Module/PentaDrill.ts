// PentaDrill.ts -- Automates the Penta Drill game mode: fights, energy tracking,
// and reward collection.
//
// Penta Drill is a combat mode with its own energy and reward system. This
// module manages fight scheduling, tracks available energy, selects opponents,
// and collects milestone rewards. Handles the time-limited nature of Penta
// Drill events.
//
// Used by: Service/index.ts (main automation loop), MonthlyCard.ts
//
import {
    checkTimer,
    ConfigHelper,
    getHHVars,
    getLimitTimeBeforeEnd,
    getPage,
    getSecondsLeft,
    getStoredValue,
    getStoredJSON,
    getTextForUI,
    getTimeLeft,
    randomInterval,
    RewardHelper,
    setStoredValue,
    setTimer,
    TimeHelper
} from '../Helper/index';
import {
    addNutakuSession,
    gotoPage,
    ParanoiaService
} from "../Service/index";
import { getHHAjax, isJSON, logHHAuto } from "../Utils/index";
import { HHStoredVarPrefixKey, SK, TK } from "../config/index";
import { KKPentaDrillOpponents } from '../model/index';
import { Booster } from "./Booster";

export class PentaDrill {

    static LAST_PentaDrill_LEVEL = 63;
    static MIN_MOJO_FIGHT = 8;
    static getRemainingTime(){
        const pentaDrillTimer = unsafeWindow.penta_drill_data.cycle_data?.seconds_until_event_end;

        if ( pentaDrillTimer != undefined && getSecondsLeft("pentaDrillRemainingTime") === 0 )
        {
            setTimer("pentaDrillRemainingTime",pentaDrillTimer);
        }
    }

    static getEnergy() {
        return Number(getHHVars('Hero.energies.drill.amount'));
    }

    static getEnergyMax() {
        return Number(getHHVars('Hero.energies.drill.max_regen_amount'));
    }

    static getPinfo() {
        const threshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoPentaDrillThreshold)) || 0;
        const runThreshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoPentaDrillRunThreshold)) || 0;

        let Tegzd = '';
        const boostLimited = getStoredValue(HHStoredVarPrefixKey +SK.autoPentaDrillBoostedOnly) === "true" && !Booster.haveBoosterEquiped();
        if(boostLimited) {
            Tegzd += '<li style="color:red!important;" title="'+getTextForUI("boostMissing","elementText")+'">';
        }else {
            Tegzd += '<li>';
        }
        Tegzd += getTextForUI("autoPentaDrillTitle", "elementText") + ' ' + PentaDrill.getEnergy() + '/' + PentaDrill.getEnergyMax();
        if (runThreshold > 0) {
            Tegzd += ' (' + threshold + '<' + PentaDrill.getEnergy()+'<='+runThreshold+')';
        }
        if (runThreshold > 0 && PentaDrill.getEnergy() < runThreshold) {
            Tegzd += ' ' + getTextForUI("waitRunThreshold","elementText");
        }else {
            Tegzd += ' : ' + getTimeLeft('nextPentaDrillTime');
        }
        if (boostLimited) {
            Tegzd += ' ' + getTextForUI("boostMissing","elementText") + '</li>';
        } else {
            Tegzd += '</li>';
        }
        return Tegzd;
    }

    static isTimeToFight() {
        const threshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoPentaDrillThreshold)) || 0;
        const runThreshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoPentaDrillRunThreshold)) || 0;
        const humanLikeRun = getStoredValue(HHStoredVarPrefixKey+TK.PentaDrillHumanLikeRun) === "true";

        const energyAboveThreshold = humanLikeRun && PentaDrill.getEnergy() > threshold || PentaDrill.getEnergy() > Math.max(threshold, runThreshold-1);
        const paranoiaSpending = PentaDrill.getEnergy() > 0 && ParanoiaService.checkParanoiaSpendings('drill') > 0;
        const needBoosterToFight = getStoredValue(HHStoredVarPrefixKey+SK.autoPentaDrillBoostedOnly) === "true";
        const haveBoosterEquiped = Booster.haveBoosterEquiped();

        if(checkTimer('nextPentaDrillTime') && energyAboveThreshold && needBoosterToFight && !haveBoosterEquiped) {
            logHHAuto('Time for PentaDrill but no booster equipped');
        }

        return (checkTimer('nextPentaDrillTime') && energyAboveThreshold && (needBoosterToFight && haveBoosterEquiped || !needBoosterToFight)) || paranoiaSpending;
    }

    static moduleSimPentaDrillBattle(): KKPentaDrillOpponents | undefined
    {
        const debugEnabled = getStoredValue(HHStoredVarPrefixKey + TK.Debug) === 'true';
        try
        {
            const opponents:KKPentaDrillOpponents[] = unsafeWindow.opponents_list as KKPentaDrillOpponents[];

            const lowestPowerOpponent = opponents.sort((a, b) => a.player.total_power - b.player.total_power)[0];
            if (debugEnabled) {
                logHHAuto(`Lowest Penta drill opponent is ${lowestPowerOpponent.player.nickname} with power ${lowestPowerOpponent.player.total_power}`);
            }
            const opponentButton = $('.opponent-info-container .change-team-container a[href*=' + lowestPowerOpponent.player?.id_fighter + ']');
            const opponentBlock = opponentButton.parent().parent();
            PentaDrill.stylesBattle();

            opponentBlock.append(`<img id="powerLevelScouterChosen" src=${ConfigHelper.getHHScriptVars("powerCalcImages").chosen}>`);
            return lowestPowerOpponent;
        }
        catch(err)
        {
            logHHAuto("Catched error : Could not display season score : "+err);
        }
        return undefined;
    }
    
    static async run(){
        logHHAuto("Performing auto PentaDrill.");
        // Confirm if on correct screen.
        //const Hero = getHero();
        var page = getPage();
        if (page === ConfigHelper.getHHScriptVars("pagesIDPentaDrillArena"))
        {
            logHHAuto("On PentaDrill arena page.");
    
            const chosenOpponent:KKPentaDrillOpponents = PentaDrill.moduleSimPentaDrillBattle();
            if (chosenOpponent === undefined )
            {
                logHHAuto("PentaDrill : was not able to choose opponent.");
                setTimer('nextPentaDrillTime',randomInterval(30*60, 35*60));
            }
            else
            {
                const chosenID = chosenOpponent.player.id_fighter;
                const runThreshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoPentaDrillRunThreshold)) || 0;
                const opponentButton = $('.opponent-info-container a[href*=' + chosenID + ']');
                if (runThreshold > 0) {
                    setStoredValue(HHStoredVarPrefixKey+TK.PentaDrillHumanLikeRun, "true");
                }
                const toGoTo: string = opponentButton.attr('href') || ''
                if(toGoTo=='') {
                    logHHAuto('PentaDrill : Error getting opponent location');
                    setTimer('nextPentaDrillTime',randomInterval(30*60, 35*60));
                    return false;
                }
                setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
                logHHAuto("setting autoloop to false");
                logHHAuto(`Going to crush : ${chosenOpponent.player.nickname} (${chosenID})`);
                location.href = addNutakuSession(toGoTo) as string;
                await TimeHelper.sleep(randomInterval(4000, 8000));
                return true;
            }
        }
        else if (page === ConfigHelper.getHHScriptVars("pagesIDPentaDrillPreBattle"))
        {
            logHHAuto("On PentaDrill pre battle page.");
            const performButton = $('#perform_opponent:not([disabled])');
            if(performButton.length == 0) {
                logHHAuto('PentaDrill : Perform button is disabled, can\'t fight now.');
                setTimer('nextPentaDrillTime',randomInterval(30*60, 35*60));
                return false;
            }
            performButton.trigger('click');
            setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
            logHHAuto("setting autoloop to false");
            await TimeHelper.sleep(randomInterval(2000, 3000));
            //setTimer('nextPentaDrillTime',10);
            return true;
        }
        else
        {
            const current_drill = PentaDrill.getEnergy();
            // Switch to the correct screen
            logHHAuto("Remaining drill : "+ current_drill);
            if ( current_drill > 0 )
            {
                logHHAuto("Switching to PentaDrill Arena screen.");
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDPentaDrillArena"));
            }
            else
            {
                let next_refresh = getHHVars('Hero.energies.drill.next_refresh_ts')
                if (next_refresh == 0) {
                    next_refresh = 15*60;
                }
                setTimer('nextPentaDrillTime', randomInterval(next_refresh+10, next_refresh + 180));
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
            }
            return;
        }
    }

    static displayRewardsDiv() {
        try{
            const target = $('#rewards_tab_container .pd-controls');
            const hhRewardId = 'HHPentaDrillRewards';
            if ($('#' + hhRewardId).length <= 0) {
                const rewardCountByType = PentaDrill.getNotClaimedRewards();
                RewardHelper.displayRewardsDiv(target, hhRewardId, rewardCountByType);
            }
        } catch({ errName, message }) {
            logHHAuto(`ERROR in display PentaDrill rewards: ${message}`);
        }
    }

    static getNotClaimedRewards() {
        const arrayz = $('.rewards_pair');
        const freeSlotSelectors = ".free_reward.reward_is_claimable .slot";
        let paidSlotSelectors = "";
        if ($("#get_penta_pass_btn[style='display: none;']").length) {
            // PentaDrill pass paid
            paidSlotSelectors = ".pass_reward.reward_is_claimable .slot";
        }
        return RewardHelper.computeRewardsCount(arrayz, freeSlotSelectors, paidSlotSelectors);
    }

    static goAndCollect()
    {
        const rewardsToCollect = getStoredJSON(HHStoredVarPrefixKey+SK.autoPentaDrillCollectablesList, []);

        if (getPage() === ConfigHelper.getHHScriptVars("pagesIDPentaDrill"))
        {
            PentaDrill.getRemainingTime();
            const PentaDrillEnd = getSecondsLeft("pentaDrillRemainingTime");
            logHHAuto("PentaDrill end in " + TimeHelper.debugDate(PentaDrillEnd));

            if (checkTimer('nextPentaDrillCollectAllTime') && PentaDrillEnd < getLimitTimeBeforeEnd() && getStoredValue(HHStoredVarPrefixKey+SK.autoPentaDrillCollectAll) === "true")
            {
                if($(ConfigHelper.getHHScriptVars("selectorClaimAllRewards")).length > 0)
                {
                    logHHAuto("Going to collect all PentaDrill item at once.");
                    setTimeout(function (){
                        $(ConfigHelper.getHHScriptVars("selectorClaimAllRewards"))[0].click();
                        setTimer('nextPentaDrillCollectAllTime', ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180)); // Add timer to check again later if there is new items to collect
                        setTimeout(function (){gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));},500);
                    },500);
                    return true;
                }
                else
                {
                    setTimer('nextPentaDrillCollectAllTime', ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                }
            }
            if (checkTimer('nextPentaDrillCollectTime') && getStoredValue(HHStoredVarPrefixKey+SK.autoPentaDrillCollect) === "true")
            {
                logHHAuto("Going to collect PentaDrill.");
                logHHAuto("setting autoloop to false");
                setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");

                const isPassPaid = $("#get_penta_pass_btn:visible").length === 0;
                const freeSlotQuery = ".free_reward .slot";
                const paidSlotQuery = ".pass_reward .slot";

                let buttonsToCollect: HTMLElement[] = [];
                const listPentaDrillTiersToClaim = $(".rewards_container_penta_drill .rewards_pair:has(.btn_claim)");
                logHHAuto('Found ' + listPentaDrillTiersToClaim.length + ' rewards available for collection before filtering');

                for (let currentTier = 0; currentTier < listPentaDrillTiersToClaim.length; currentTier++) {
                    const currentButton = $("button[rel='claim']", listPentaDrillTiersToClaim[currentTier])[0];
                    const currentTierNb = currentButton.getAttribute("tier");
                    //console.log("checking tier : "+currentTierNb);
                    const freeSlotType = RewardHelper.getRewardTypeBySlot($(freeSlotQuery, listPentaDrillTiersToClaim[currentTier])[0]);
                    if (rewardsToCollect.includes(freeSlotType)) {

                        if (isPassPaid) {
                            // One button for both
                            const paidSlotType = RewardHelper.getRewardTypeBySlot($(paidSlotQuery, listPentaDrillTiersToClaim[currentTier])[0]);
                            if (rewardsToCollect.includes(paidSlotType)) {
                                buttonsToCollect.push(currentButton);
                                logHHAuto("Adding for collection tier (free + paid) : " + currentTierNb);
                            } else {
                                logHHAuto("Can't add tier " + currentTierNb + " as paid reward isn't to be colled");
                            }
                        } else {
                            buttonsToCollect.push(currentButton);
                            logHHAuto("Adding for collection tier (only free) : " + currentTierNb);
                        }
                    }
                }

                if (buttonsToCollect.length >0)
                {
                    function collectPentaDrillRewards()
                    {
                        function collectionFinished() {
                            logHHAuto("PentaDrill collection finished.");
                            setTimer('nextPentaDrillCollectTime', ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60, 180));
                            gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                        }

                        if (buttonsToCollect.length >0)
                        {
                            function closeRewardAndCollectagain() {
                                RewardHelper.closeRewardPopupIfAny(false);
                                setTimeout(collectPentaDrillRewards, randomInterval(300, 500));
                            }

                            function collectPentaDrillRewards() {
                                if (buttonsToCollect.length > 0) {
                                    logHHAuto("Collecting tier : " + buttonsToCollect[0].getAttribute('tier'));
                                    buttonsToCollect[0].click();
                                    buttonsToCollect.shift();
                                    setTimeout(closeRewardAndCollectagain, randomInterval(300, 500));
                                }
                                else collectionFinished();
                            }
                            collectPentaDrillRewards();
                            return true;
                        }
                        else collectionFinished();
                    }
                    collectPentaDrillRewards();
                    return true;
                }
                else
                {
                    logHHAuto("No PentaDrill collection to do.");
                    setTimer('nextPentaDrillCollectTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                    setTimer('nextPentaDrillCollectAllTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                    return false;
                }
            }
            return false;
        }
        else
        {
            logHHAuto("Switching to PentaDrill Rewards screen.");
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDPentaDrill"));
            return true;
        }
    }
    static styles() {
        if (getStoredValue(HHStoredVarPrefixKey +SK.AllMaskRewards) === "true")
        {
            PentaDrill.maskReward();
        }
    }

    static stylesBattle() {

        GM_addStyle('#powerLevelScouterChosen {'
            + 'position: absolute;'
            + 'top: 10.7rem;'
            + 'left: 15rem;'
            + 'width: 25px;}'
        );
    }
    static maskReward()
    {
        if($('.HHaHidden').length > 0 || $('.script-hide-claimed').length > 0  /*OCD*/) {
            return;
        }
        // TODO maksk all claimed rewards in PentaDrill
    }
}