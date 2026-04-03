// Season.ts -- Season (Kiss) game mode: automated fights, opponent selection,
// and energy tracking.
//
// The Season (also known as Kiss) mode is a PvP competition with its own
// energy system and ranking. This module selects opponents based on win
// probability (using BDSM calculations), manages season-specific energy,
// tracks timers, and handles fight automation within the seasonal ladder.
//
// Depends on: BDSMHelper (win probability), TeamModule.ts (team selection),
//             EventModule.ts (event detection)
// Used by: Service/index.ts (main automation loop), MonthlyCard.ts
//
import {
    BDSMHelper,
    calculateBattleProbabilities,
    checkTimer,
    ConfigHelper,
    convertTimeToInt,
    getHero,
    getHHVars,
    getLimitTimeBeforeEnd,
    getPage,
    getSecondsLeft,
    getStoredValue,
    getStoredJSON,
    getTextForUI,
    getTimeLeft,
    HeroHelper,
    NumberHelper,
    randomInterval,
    RewardHelper,
    setStoredValue,
    setTimer,
    TimeHelper
} from '../../Helper/index';
import {
    addNutakuSession,
    gotoPage,
    ParanoiaService
} from "../../Service/index";
import { getHHAjax, isJSON, logHHAuto } from "../../Utils/index";
import { HHStoredVarPrefixKey, SK, TK } from "../../config/index";
import { SeasonOpponent } from '../../model/index';
import { Booster } from "../Booster";
import { EventModule } from "./EventModule";

export class Season {
    static LAST_SEASON_LEVEL = 63;
    static MIN_MOJO_FIGHT = 8;
    static getRemainingTime(){
        const seasonTimer = unsafeWindow.season_sec_untill_event_end;

        if ( seasonTimer != undefined && (getSecondsLeft("SeasonRemainingTime") === 0 || getStoredValue(HHStoredVarPrefixKey+TK.SeasonEndDate) === undefined) )
        {
            setTimer("SeasonRemainingTime",seasonTimer);
            setStoredValue(HHStoredVarPrefixKey+TK.SeasonEndDate,Math.ceil(new Date().getTime()/1000)+seasonTimer);
        }
    }
    static displayRemainingTime()
    {
        EventModule.displayGenericRemainingTime("#scriptSeasonTime", "season", "HHAutoSeasonTimer", "SeasonRemainingTime", HHStoredVarPrefixKey+TK.SeasonEndDate);
    }

    static getEnergy() {
        return Number(getHHVars('Hero.energies.kiss.amount'));
    }

    static getEnergyMax() {
        return Number(getHHVars('Hero.energies.kiss.max_regen_amount'));
    }

    static getTierLevel() {
        return Number($('#tier_indicator').text());
    }

    static getPinfo() {
        const threshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonThreshold)) || 0;
        const runThreshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonRunThreshold)) || 0;

        let Tegzd = '';
        const boostLimited = getStoredValue(HHStoredVarPrefixKey+SK.autoSeasonBoostedOnly) === "true" && !Booster.haveBoosterEquiped();
        if(boostLimited) {
            Tegzd += '<li style="color:red!important;" title="'+getTextForUI("boostMissing","elementText")+'">';
        }else {
            Tegzd += '<li>';
        }
        Tegzd += getTextForUI("autoSeasonTitle","elementText")+' '+Season.getEnergy()+'/'+Season.getEnergyMax();
        if (runThreshold > 0) {
            Tegzd += ' ('+threshold+'<'+Season.getEnergy()+'<='+runThreshold+')';
        }
        const isMaxTierSet = getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonMaxTier) === "true";
        const maxTierNb = getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonMaxTierNb) || Season.LAST_SEASON_LEVEL;
        if(runThreshold > 0  && Season.getEnergy() < runThreshold) {
            Tegzd += ' ' + getTextForUI("waitRunThreshold","elementText");
        }else {
            const timeLeft = getTimeLeft('nextSeasonTime');
            Tegzd += ' : ' + timeLeft;
            if (isMaxTierSet && timeLeft === "Time's up!") {
                Tegzd += ' (Max Tier ' + maxTierNb + ')';
            }
        }
        if (isMaxTierSet) {
            Tegzd += ' [≤T' + maxTierNb + ']';
        }
        if (boostLimited) {
            Tegzd += ' ' + getTextForUI("boostMissing","elementText") + '</li>';
        } else {
            Tegzd += '</li>';
        }
        return Tegzd;
    }

    static isTimeToFight() {
        const threshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonThreshold)) || 0;
        const runThreshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonRunThreshold)) || 0;
        const humanLikeRun = getStoredValue(HHStoredVarPrefixKey+TK.SeasonHumanLikeRun) === "true";

        const energyAboveThreshold = humanLikeRun && Season.getEnergy() > threshold || Season.getEnergy() > Math.max(threshold, runThreshold-1);
        const paranoiaSpending = Season.getEnergy() > 0 && ParanoiaService.checkParanoiaSpendings('kiss') > 0;
        const needBoosterToFight = getStoredValue(HHStoredVarPrefixKey+SK.autoSeasonBoostedOnly) === "true";
        const haveBoosterEquiped = Booster.haveBoosterEquiped();

        if(checkTimer('nextSeasonTime') && energyAboveThreshold && needBoosterToFight && !haveBoosterEquiped) {
            logHHAuto('Time for season but no booster equipped');
        }

        return (checkTimer('nextSeasonTime') && energyAboveThreshold && (needBoosterToFight && haveBoosterEquiped || !needBoosterToFight)) || paranoiaSpending;
    }

    static async moduleSimSeasonBattle(autoRun=false)
    {
        const dispalyPowerCalc = getStoredValue(HHStoredVarPrefixKey + SK.seasonDisplayPowerCalc) === "true";
        const debugEnabled = getStoredValue(HHStoredVarPrefixKey + TK.Debug) === 'true';
        if (!autoRun && !dispalyPowerCalc) {
            if (debugEnabled) logHHAuto("Auto season : Display power calc is disabled, not simulating fight.");
            return -1;
        }
        const hero_data = unsafeWindow.hero_data;
        const opponentDatas = unsafeWindow.opponents;
        let doDisplay=false;
        let seasonOpponents:SeasonOpponent[]=[];
        try
        {
            // TODO update
            if ($("div.matchRatingNew img#powerLevelScouter").length != 3)
            {
                doDisplay=true;
            }
            const powerCalcImages = ConfigHelper.getHHScriptVars("powerCalcImages");

            for (let index=0;index<3;index++)
            {
                const { player, opponent } = BDSMHelper.getBdsmPlayersData(hero_data, opponentDatas[index].player);
                const opponentBlock = $('.season_arena_opponent_container[data-opponent=' + opponentDatas[index].player?.id_fighter + ']');

                if (doDisplay)
                {
                    // logHHAuto("Simulating fight vs "+opponent.name+" (ID:"+opponentDatas[index].player?.id_fighter+")");
                    // console.log("HH simuFight",JSON.stringify(player),JSON.stringify(opponent), opponentBonuses);
                }
                //console.time('calculateBattleProbabilities' + index);
                const simu = calculateBattleProbabilities(player, opponent, debugEnabled)
                //console.timeEnd('calculateBattleProbabilities' + index);

                seasonOpponents[index] = new SeasonOpponent(
                    opponentDatas[index].player?.id_fighter, 
                    opponent.name, 
                    Number($(".slot_victory_points .amount", opponentBlock).text()), // mojo
                    Number($(".slot_season_xp_girl .amount", opponentBlock).text()),
                    Number($(".slot_season_affection_girl .amount", opponentBlock).text()), 
                    simu
                );

                const seasonButton = $('.player-panel-buttons .opponent_perform_button_container .green_button_L.btn_season_perform', opponentBlock);
                seasonButton.contents().filter(function() {return this.nodeType===3;}).remove();
                seasonButton.find('span').remove();
                $('.energy_kiss_icn.kiss_icon_s', seasonButton).remove();

                if (doDisplay)
                {
                    seasonButton.prepend(`<div class="matchRatingNew ${simu.scoreClass}"><img id="powerLevelScouter" src=${powerCalcImages[simu.scoreClass]}>${NumberHelper.nRounding(100*simu.win, 2, -1)}%</div>`);
                }
                await TimeHelper.sleep(randomInterval(10, 30)); // avoid blocking UI thread and let it update with new elements
            }

            var { numberOfReds, chosenIndex } = Season.getBestOppo(seasonOpponents, Season.getEnergy(), Season.getEnergyMax());
            const chosenID = chosenIndex >= 0 ? opponentDatas[chosenIndex].player?.id_fighter : chosenIndex;

            var price=Number($("div.opponents_arena button#refresh_villains").attr('price'));
            if (isNaN(price))
            {
                price = 12;
            }
            if (numberOfReds === 3 && getStoredValue(HHStoredVarPrefixKey+SK.autoSeasonPassReds) === "true" && HeroHelper.getKoban()>=price+Number(getStoredValue(HHStoredVarPrefixKey+SK.kobanBank)))
            {
                chosenIndex = -2;
            }

            $($('div.season_arena_opponent_container div.matchRatingNew')).append(`<img id="powerLevelScouterNonChosen">`);

            //logHHAuto("Best opportunity opponent : "+oppoName+'('+chosenRating+')');
            if (doDisplay && chosenIndex >= 0 && chosenIndex < 3)
            {
                try {
                    const opponentBlock = $('.season_arena_opponent_container[data-opponent=' + chosenID + ']');
                    $('.matchRatingNew #powerLevelScouterNonChosen', opponentBlock).remove();
                    $('div.matchRatingNew', opponentBlock).append(`<img id="powerLevelScouterChosen" src=${ConfigHelper.getHHScriptVars("powerCalcImages").chosen}>`);
                }catch(err){
                    logHHAuto('Error when dispaly chosen opponent');
                }
            }

            return chosenIndex < 0 ? chosenIndex : chosenID;
        }
        catch(err)
        {
            logHHAuto("Catched error : Could not display season score : "+err);
            return -1;
        }
    }

//    static getBestOppo(scoreOppo: BDSMSimu[], mojoOppo: number[], expOppo: number[], affOppo: number[], nameOppo: string[]) {
    static getBestOppo(seasonOpponents: SeasonOpponent[], current_kisses=1, max_kisses=10) {
        var chosenIndex = -1;
        var chosenRating = -1;
        var chosenFlag = -1;
        var chosenMojo = -1;
        let currentExp:number;
        let currentAff:number;
        var currentFlag;
        var currentScore:number;
        var currentMojo:number;
        var numberOfReds = 0;
        let currentGains;
        //let oppoName;
        const seasonEnded = Season.getTierLevel() > Season.LAST_SEASON_LEVEL;

        for (let index = 0; index < 3; index++) {
            let isBetter = false;
            currentScore = Number(seasonOpponents[index].simu.win);
            currentFlag = seasonOpponents[index].simu.scoreClass;
            currentMojo = Number(seasonOpponents[index].mojo);
            currentExp = Number(seasonOpponents[index].exp);
            currentAff = Number(seasonOpponents[index].aff);
            switch (currentFlag) {
                case 'plus':
                    currentFlag = 1;
                    break;
                case 'close':
                    currentFlag = 0;
                    break;
                case 'minus':
                    currentFlag = -1;
                    numberOfReds++;
                    break;
            }
            //logHHAuto({OppoName:nameOppo[index],OppoFlag:currentFlag,OppoScore:currentScore,OppoMojo:currentMojo});
            //not chosen or better flag
            if (chosenRating == -1 || chosenFlag < currentFlag) {
                //logHHAuto('first');
                isBetter = true;
                currentGains = currentAff + currentExp;
            }

            //same orange flag but better score
            else if (chosenFlag == currentFlag && currentFlag == 0 && chosenRating < currentScore) {
                //logHHAuto('second');
                isBetter = true;
            }
            else if (chosenFlag == currentFlag && currentFlag == -1) {
                //same red flag but better mojo
                if (chosenMojo < currentMojo) {
                    //logHHAuto('second');
                    isBetter = true;
                }
                // same red flag same mojo but better score
                else if (chosenMojo == currentMojo && currentScore > chosenRating) {
                    //logHHAuto('second');
                    isBetter = true;
                }
            }
            else if (chosenFlag == currentFlag && currentFlag == 1 && !seasonEnded) {
                //same green flag but better mojo
                if (chosenMojo < currentMojo) {
                    //logHHAuto('third');
                    isBetter = true;
                }

                //same green flag same mojo but better gains
                else if (chosenMojo == currentMojo && currentGains < currentAff + currentExp) {
                    //logHHAuto('third');
                    isBetter = true;
                    currentGains = currentAff + currentExp;
                }

                //same green flag same mojo same gains but better score
                else if (chosenMojo == currentMojo && currentGains === currentAff + currentExp && currentScore > chosenRating) {
                    //logHHAuto('third');
                    isBetter = true;
                }
            }
            else if (chosenFlag == currentFlag && currentFlag == 1) {
                // End season
                if (currentScore > chosenRating) {
                    //logHHAuto('third');
                    isBetter = true;
                }

                else if (currentScore == chosenRating && chosenMojo < currentMojo) {
                    //logHHAuto('third');
                    isBetter = true;
                    currentGains = currentAff + currentExp;
                }

                else if (currentScore == chosenRating && chosenMojo == currentMojo && currentGains < currentAff + currentExp) {
                    //logHHAuto('third');
                    isBetter = true;
                    currentGains = currentAff + currentExp;
                }
            }
            if (isBetter) {
                chosenRating = currentScore;
                chosenFlag = currentFlag;
                chosenIndex = index;
                chosenMojo = currentMojo;
                //oppoName = seasonOpponents[index].nickname;
            }
        }
        if (getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonSkipLowMojo) === "true" && chosenMojo < Season.MIN_MOJO_FIGHT && !seasonEnded && current_kisses < (max_kisses-1) ) {
            chosenIndex = -1; // wait more mojo
        }
        return { numberOfReds, chosenIndex };
    }

    static async run(){
        logHHAuto("Performing auto Season.");
        // Confirm if on correct screen.
        const Hero = getHero();
        var page = getPage();
        if (page === ConfigHelper.getHHScriptVars("pagesIDSeasonArena"))
        {
            logHHAuto("On season arena page.");
            Season.stylesBattle();

            const isMaxTierSet = getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonMaxTier) === "true";
            const maxTier = getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonMaxTierNb) || Season.LAST_SEASON_LEVEL;
            const stopIfNoEventGirl = getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonIgnoreNoGirls) === "true";
            const maxTierReached = isMaxTierSet && Season.getTierLevel() >= maxTier;
            if (maxTierReached && !stopIfNoEventGirl) {
                logHHAuto(`Max tier reached (${Season.getTierLevel()} >= ${maxTier}), not fighting anymore in season.`);
                setTimer('nextSeasonTime', randomInterval(30*60, 35*60));
                return true;
            }
            if (maxTierReached && stopIfNoEventGirl) {
                logHHAuto(`Max tier reached (${Season.getTierLevel()} >= ${maxTier}) but "Stop if no event girl" enabled, will check for event girls.`);
            }

            var chosenID = await Season.moduleSimSeasonBattle(true);
            if (chosenID === -2 )
            {
                //change opponents and reload
    
                function refreshOpponents()
                {
                    var params = {
                        namespace: 'h\\Season',
                        class: 'Arena',
                        action: 'arena_reload'
                    };
                    logHHAuto("Three red opponents, paying for refresh.");
                    getHHAjax()(params, function(data){
                        Hero.update("hard_currency", data.hard_currency, false);
                        location.reload();
                    })
                }
                setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
                logHHAuto("setting autoloop to false");
                setTimer('nextSeasonTime',5);
                setTimeout(refreshOpponents,randomInterval(800,1600));
    
                return true;
            }
            else if (chosenID === -1 )
            {
                logHHAuto("Season : was not able to choose opponent.");
                setTimer('nextSeasonTime',randomInterval(30*60, 35*60));
            }
            else
            {
                const runThreshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonRunThreshold)) || 0;
                const opponentBlock = $('.season_arena_opponent_container[data-opponent=' + chosenID + ']');

                const girlShardsReward = $(".slot.girl_ico[data-rewards]", opponentBlock);
                if (girlShardsReward.length > 0) { logHHAuto("Girl shard reward found for chosen opponent"); }
                if (stopIfNoEventGirl && girlShardsReward.length <= 0) {
                    if (!isMaxTierSet || maxTierReached) {
                        logHHAuto("Ignoring season fights as no girl to win on fight reward");
                        setTimer('nextSeasonTime', randomInterval(30 * 60, 35 * 60));
                        return false;
                    } else {
                        logHHAuto("Below max tier, fighting regardless of event girls.");
                    }
                }

                if (runThreshold > 0) {
                    setStoredValue(HHStoredVarPrefixKey+TK.SeasonHumanLikeRun, "true");
                }
                const toGoTo: string = $(".opponent_perform_button_container :first-child", opponentBlock).first().attr('href') || ''
                if(toGoTo=='') {
                    logHHAuto('Season : Error getting opponent location');
                    setTimer('nextSeasonTime',randomInterval(30*60, 35*60));
                    return false;
                }
                location.href = addNutakuSession(toGoTo) as string;
                setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
                logHHAuto("setting autoloop to false");
                logHHAuto(`Going to crush : ${$(".personal_info div.player-name", opponentBlock).text()} (${chosenID})`);
                setTimer('nextSeasonTime',5);
                return true;
            }
        }
        else
        {
            const current_kisses = Season.getEnergy();
            // Switch to the correct screen
            logHHAuto("Remaining kisses : "+ current_kisses);
            if ( current_kisses > 0 )
            {
                logHHAuto("Switching to Season Arena screen.");
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDSeasonArena"));
            }
            else
            {
                let next_refresh = getHHVars('Hero.energies.kiss.next_refresh_ts')
                if (next_refresh == 0) {
                    next_refresh = 15*60;
                }
                setTimer('nextSeasonTime', randomInterval(next_refresh+10, next_refresh + 180));
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
            }
            return;
        }
    }

    static displayRewardsDiv() {
        try{
            const target = $('.seasons_controls_holder_global');
            const hhRewardId = 'HHSeasonRewards';
            if ($('#' + hhRewardId).length <= 0) {
                const rewardCountByType = Season.getNotClaimedRewards();
                RewardHelper.displayRewardsDiv(target, hhRewardId, rewardCountByType);
            }
        } catch({ errName, message }) {
            logHHAuto(`ERROR in display Season rewards: ${message}`);
        }
    }

    static getNotClaimedRewards() {
        const arrayz = $('.rewards_pair');
        const freeSlotSelectors = ".free_reward.reward_is_claimable .slot";
        let paidSlotSelectors = "";
        if ($("div#gsp_btn_holder[style='display: none;']").length) {
            // Season pass paid
            paidSlotSelectors = ".pass_reward.reward_is_claimable .slot";
        }
        return RewardHelper.computeRewardsCount(arrayz, freeSlotSelectors, paidSlotSelectors);
    }

    static goAndCollect()
    {
        const rewardsToCollect = getStoredJSON(HHStoredVarPrefixKey+SK.autoSeasonCollectablesList, []);

        if (getPage() === ConfigHelper.getHHScriptVars("pagesIDSeason"))
        {
            Season.getRemainingTime();
            const seasonEnd = getSecondsLeft("SeasonRemainingTime");
            logHHAuto("Season end in " + TimeHelper.debugDate(seasonEnd));

            if (checkTimer('nextSeasonCollectAllTime') && seasonEnd < getLimitTimeBeforeEnd() && getStoredValue(HHStoredVarPrefixKey+SK.autoSeasonCollectAll) === "true")
            {
                if($(ConfigHelper.getHHScriptVars("selectorClaimAllRewards")).length > 0)
                {
                    logHHAuto("Going to collect all Season item at once.");
                    setTimeout(function (){
                        $(ConfigHelper.getHHScriptVars("selectorClaimAllRewards"))[0].click();
                        setTimer('nextSeasonCollectAllTime', ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180)); // Add timer to check again later if there is new items to collect
                        setTimeout(function (){gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));},500);
                    },500);
                    return true;
                }
                else
                {
                    setTimer('nextSeasonCollectAllTime', ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                }
            }
            if (checkTimer('nextSeasonCollectTime') && getStoredValue(HHStoredVarPrefixKey+SK.autoSeasonCollect) === "true")
            {
                logHHAuto("Going to collect Season.");
                logHHAuto("setting autoloop to false");
                setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");

                let limitClassPass = "";
                if ($("div#gsp_btn_holder:visible").length)
                {
                    limitClassPass = ".free_reward"; // without season pass
                }

                let buttonsToCollect:{reward: string; button: HTMLElement; tier: string; paid: boolean}[] = [];
                const listSeasonTiersToClaim = $("#seasons_tab_container .rewards_pair .reward_wrapper.reward_is_claimable"+limitClassPass);
                logHHAuto('Found ' + listSeasonTiersToClaim.length + ' rewards available for collection before filtering');
                for (let currentReward = 0 ; currentReward < listSeasonTiersToClaim.length ; currentReward++)
                {
                    const currentRewardSlot = RewardHelper.getRewardTypeBySlot($(".slot, .shards_girl_ico",listSeasonTiersToClaim[currentReward])[0]);
                    const currentTier = $(".tier_number",$(listSeasonTiersToClaim[currentReward]).parent())[0].innerText;
                    //console.log(currentRewardSlot);
                    if (rewardsToCollect.includes(currentRewardSlot))
                    {
                        if (listSeasonTiersToClaim[currentReward].className.indexOf('pass-reward') > 0)
                        {
                            logHHAuto("Adding for collection tier n°"+currentTier+" reward (paid) : "+currentRewardSlot);
                            buttonsToCollect.push({reward : currentRewardSlot, button : listSeasonTiersToClaim[currentReward], tier : currentTier, paid:true});
                        }
                        else
                        {
                            logHHAuto("Adding for collection n°"+currentTier+" reward (free) : "+currentRewardSlot);
                            buttonsToCollect.push({reward : currentRewardSlot, button : listSeasonTiersToClaim[currentReward], tier : currentTier, paid:false});
                        }
                    }
                }

                //console.log(JSON.stringify(buttonsToCollect));
                if (buttonsToCollect.length >0)
                {
                    function collectSeasonRewards(inHasSelected = false)
                    {
                        if (buttonsToCollect.length >0)
                        {
                            const currentToCollect = buttonsToCollect[0];
                            if (inHasSelected)
                            {
                                const rewardPlaceHolder = $("#preview_placeholder .reward_wrapper.reward_is_claimable, #preview_placeholder .reward_wrapper.reward_is_next");
                                const currentSelectedRewardType = RewardHelper.getRewardTypeBySlot($(".slot, .shards_girl_ico",rewardPlaceHolder)[0]);
                                const currentTier = $("#preview_tier")[0].innerText.split(" ")[1];
                                if (
                                    rewardPlaceHolder.length >0
                                    && rewardsToCollect.includes(currentSelectedRewardType)
                                    && currentSelectedRewardType === currentToCollect.reward
                                    && currentTier === currentToCollect.tier
                                )
                                {
                                    logHHAuto("Collecting tier n°"+currentToCollect.tier+" : "+currentSelectedRewardType);
                                    setTimeout(function (){$("#claim_btn_s")[0].click();},500);
                                }
                                else
                                {
                                    logHHAuto(`Issue collecting n°${currentToCollect.tier} : ${currentToCollect.reward} : \n`
                                            +`rewardPlaceHolder.length : ${rewardPlaceHolder.length}\n`
                                            +`rewardsToCollect.includes(currentSelectedRewardType) : ${rewardsToCollect.includes(currentSelectedRewardType)}\n`
                                            +`currentSelectedRewardType : ${currentSelectedRewardType} / currentToCollect.reward : ${currentToCollect.reward} => ${currentSelectedRewardType === currentToCollect.reward}\n`
                                            +`currentTier : ${currentTier} / currentToCollect.tier : ${currentToCollect.tier} => ${currentTier === currentToCollect.tier}`);

                                    logHHAuto("Proceeding with next one.");
                                }

                                buttonsToCollect.shift();
                                setTimeout(collectSeasonRewards,1000);
                                return;
                            }
                            else
                            {
                                logHHAuto("Selecting reward n°"+currentToCollect.tier+" : "+currentToCollect.reward);
                                currentToCollect.button.click();
                                setTimeout(function () {collectSeasonRewards(true);}, randomInterval(300, 500));
                            }
                        }
                        else
                        {
                            logHHAuto("Season collection finished.");
                            setTimer('nextSeasonCollectTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                            gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                        }
                    }
                    collectSeasonRewards();
                    return true;
                }
                else
                {
                    logHHAuto("No season collection to do.");
                    setTimer('nextSeasonCollectTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                    setTimer('nextSeasonCollectAllTime',ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60,180));
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                    return false;
                }
            }
            return false;
        }
        else
        {
            logHHAuto("Switching to Season Rewards screen.");
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDSeason"));
            return true;
        }
    }
    static styles() {
        if (getStoredValue(HHStoredVarPrefixKey +SK.AllMaskRewards) === "true")
        {
            Season.maskReward();
        }
    }

    static stylesBattle() {
        GM_addStyle('#season-arena .opponents_arena .opponent_perform_button_container {'
            + 'width: 200px;}'
        );

        GM_addStyle('.green_button_L.btn_season_perform, .leagues_team_block .challenge button.blue_button_L {'
            + 'background-image: linear-gradient(to top,#008ed5 0,#05719c 100%);'
            + '-webkit-box-shadow: 0 3px 0 rgb(13 22 25 / 35%), inset 0 3px 0 #6df0ff;'
            + '-moz-box-shadow: 0 3px 0 rgba(13,22,25,.35),inset 0 3px 0 #6df0ff;'
            + 'box-shadow: 0 3px 0 rgb(13 22 25 / 35%), inset 0 3px 0 #6df0ff;}'
        );

        GM_addStyle('#season-arena .matchRatingNew {'
            + 'display: flex;'
            + 'align-items: center;'
            + 'justify-content: space-between;}'
        );

        GM_addStyle('#powerLevelScouterChosen, #powerLevelScouterNonChosen {'
            + 'width: 25px;}'
        );

        GM_addStyle('.matchRatingNew {'
            + 'text-align: center; '
            + 'text-shadow: 1px 1px 0 #000, -1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000; '
            + 'line-height: 17px; '
            + 'font-size: 14px;}'
        );

        GM_addStyle('.plus {'
            + 'color: #66CD00;}'
        );

        GM_addStyle('.minus {'
            + 'color: #FF2F2F;}'
        );

        GM_addStyle('.close {'
            + 'color: #FFA500;}'
        );

        GM_addStyle('#powerLevelScouter {'
            + 'width: 25px;}'
        );
        GM_addStyle('#powerLevelScouterChosen {'
            + 'width: 25px;}'
        );
    }
    static maskReward()
    {
        if($('.HHaHidden').length > 0 || $('.script-hide-claimed').length > 0  /*OCD*/) {
            return;
        }
        var arrayz;
        var nbReward;
        let modified=false;
        arrayz = $('.rewards_pair:not([style*="display:none"]):not([style*="display: none"])');
        if ($("div#gsp_btn_holder[style='display: none;']").length)
        {
            nbReward=2;
        }
        else
        {
            nbReward=1;
        }

        var obj;
        if (arrayz.length > 0) {
            for (var i2 = arrayz.length - 1; i2 >= 0; i2--) {
                obj = $(arrayz[i2]).find('.tick_s:not([style*="display:none"]):not([style*="display: none"])');
                if (obj.length >= nbReward) {
                    //console.log("width : "+arrayz[i2].offsetWidth);
                    //document.getElementById('rewards_cont_scroll').scrollLeft-=arrayz[i2].offsetWidth;
                    arrayz[i2].style.display = "none";
                    $(arrayz[i2]).addClass('HHaHidden');
                    modified = true;
                }
            }
        }
        if (modified)
        {
            $('.rewards_seasons_row').css('width', 'max-content');
            // const $rowScroll = $('.rewards_container_seasons');
            // if ($rowScroll.length && ($rowScroll as any).getNiceScroll(0).doScrollLeft) {
            //     ($rowScroll as any).getNiceScroll().resize();
            //     ($rowScroll as any).getNiceScroll(0).doScrollLeft(0,200);
            // }
        }
    }
}