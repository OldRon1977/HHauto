// League.ts -- Automates league fights: opponent selection, win probability, and
// power calculation display.
//
// Leagues are the primary PvP mode. This module selects optimal opponents by
// calculating win probability using the BDSM (Battle Data Simulation Model)
// system from BDSMHelper, manages fight energy, and displays power calculations
// in the UI. Supports both regular and boosted fights.
//
// Depends on: BDSMHelper (win probability), TeamModule.ts (team selection)
// Used by: Service/index.ts (main automation loop), MonthlyCard.ts
//
import {
    BDSMHelper,
    calculateBattleProbabilities,
    checkTimer,
    ConfigHelper,
    convertTimeToInt,
    deleteStoredValue,
    getGoToChangeTeamButton,
    getHero,
    getHHVars,
    getPage,
    getStoredValue,
    getStoredJSON,
    getTextForUI,
    getTimeLeft,
    HeroHelper,
    NumberHelper,
    parsePrice,
    queryStringGetParam,
    randomInterval,
    RewardHelper,
    setStoredValue,
    setTimer,
    TimeHelper
} from '../Helper/index';
import {
    addNutakuSession,
    autoLoop,
    gotoPage,
    ParanoiaService
} from '../Service/index';
import { getHHAjax, isJSON, logHHAuto } from '../Utils/index';
import { HHStoredVarPrefixKey, SK, TK } from '../config/index';
import { BDSMSimu, KKLeagueOpponent, LeagueOpponent } from "../model/index";
import { Booster } from "./Booster";

export class LeagueHelper {

    static SORT_DISPLAYED = '0';
    static SORT_POWER = '1';
    static SORT_POWERCALC = '2';

    /* get time in sec */
    static getLeagueEndTime(){
        let league_end = -1;
        const league_end_in = $('#leagues .league_end_in .timer span[rel="expires"]').text();
        if(league_end_in !== undefined && league_end_in !== null && league_end_in.length > 0)
        {
            league_end = Number(convertTimeToInt(league_end_in));
        }
        return league_end;
    }
    static numberOfFightAvailable(opponent:KKLeagueOpponent) {
        if (!opponent) return 0;
        const forceOneFight = getStoredValue(HHStoredVarPrefixKey+SK.autoLeaguesForceOneFight) === 'true';
        if(forceOneFight) return 1;
        // remove match_history after w32 update
        const matchs = opponent.match_history ? opponent.match_history[opponent.player.id_fighter]: opponent.match_history_sorting[opponent.player.id_fighter];
        return matchs ? matchs.filter(match=>match == null).length : 0
    }
    static getLeagueCurrentLevel()
    {
        if(unsafeWindow.current_tier_number === undefined)
        {
            setTimeout(autoLoop, Number(getStoredValue(HHStoredVarPrefixKey+TK.autoLoopTimeMili)))
        }
        return unsafeWindow.current_tier_number;
    }
    static styles(){
        
        GM_addStyle('#leagues .league_content .league_table .data-list .data-row .data-column[column="can_fight"] {'
            + 'min-width: 8.5rem;}'
        );

        GM_addStyle('@media only screen and (min-width: 1026px) {'
            + '.matchRatingNew {'
            + 'display: flex;'
            + 'flex-wrap: nowrap;'
            + 'align-items: center;'
            + 'justify-content: center;'
            + 'text-shadow: 1px 1px 0 #000, -1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000; '
            + 'line-height: 17px; '
            + 'max-width: 65px; '
            + 'font-size: 12px;}}'
        );

        GM_addStyle('@media only screen and (max-width: 1025px) {'
            + '.matchRatingNew {'
            + 'width: auto;'
            + 'display: flex;'
            + 'flex-wrap: nowrap;'
            + 'align-items: center;'
            + 'justify-content: center;'
            + 'text-shadow: 1px 1px 0 #000, -1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000; '
            + 'line-height: 17px; '
            + 'max-width: 65px; '
            + 'font-size: 12px;}}'
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

        GM_addStyle('.powerLevelScouter {'
                + 'width: 25px;}'
            );
        GM_addStyle('#leagues .league_content .league_table .data-list .data-row .data-column[column="nickname"].clubmate .nickname { color: #00CC00 }');
    }

    static addChangeTeamButton() {

        $('.league_buttons_block').append(getGoToChangeTeamButton());
        
        GM_addStyle('#leagues .league_content .league_buttons {'
            + 'max-width: none;}'
        );
        GM_addStyle('#leagues .league_content .league_buttons .league_buttons_block {'
            + 'width: auto;}'
        );
    }

    static getSimPowerOpponent(heroFighter, opponents): BDSMSimu {
        const debugEnabled = getStoredValue(HHStoredVarPrefixKey + TK.Debug) === 'true';
        let leaguePlayers = BDSMHelper.getBdsmPlayersData(heroFighter, opponents.player, true);
        let simu = calculateBattleProbabilities(leaguePlayers.player, leaguePlayers.opponent, debugEnabled);

        const oppoPoints = simu.points;
        let expectedValue = 0;
        for (let i=25; i>=3; i--) {
            if (oppoPoints[i]) {
                expectedValue += i*oppoPoints[i];
            }
        }
        simu.expectedValue = expectedValue;
        return simu;
    }
    
    static displayOppoSimuOnButton(id_fighter: number, simu: BDSMSimu, force=0) {
        const opponentGoButton = $('a[href*="id_opponent='+id_fighter+'"]');
        if((opponentGoButton.length <= 0 || $('.powerLevelScouter',opponentGoButton).length > 0) && !force) {
            return;
        }
        // logHHAuto('powerLevelScouter not present adding it ' + id_fighter);

        const percentage = NumberHelper.nRounding(100*simu.win, 2, -1);
        const points = NumberHelper.nRounding(simu.expectedValue, 1, -1);
        const pointText = `${percentage}% (${points})` +
        `<span style="margin:0;display:none;" id="HHPowerCalcScore">${percentage}</span>
        <span style="margin:0;display:none;" id="HHPowerCalcPoints">${points}</span>`;
        // const opponentRow = opponentGoButton.parent().parent();
        opponentGoButton.html(`<div class="matchRatingNew ${simu.scoreClass}"><img class="powerLevelScouter" src=${ConfigHelper.getHHScriptVars("powerCalcImages")[simu.scoreClass]}>${pointText}</div>`);
    }

    static getEnergy() {
        return Number(getHHVars('Hero.energies.challenge.amount'));
    }

    static getEnergyMax() {
        return Number(getHHVars('Hero.energies.challenge.max_regen_amount'));
    }

    static isEnabled(){
        return ConfigHelper.getHHScriptVars("isEnabledLeagues", false) && HeroHelper.getLevel() >= ConfigHelper.getHHScriptVars("LEVEL_MIN_LEAGUE");
    }

    static isAutoLeagueActivated(){
        return getStoredValue(HHStoredVarPrefixKey+SK.autoLeagues) === "true" && LeagueHelper.isEnabled();
    }

    static getPinfo() {
        const threshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoLeaguesThreshold)) || 0;
        const runThreshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoLeaguesRunThreshold)) || 0;

        let Tegzd = '';
        const boostLimited = getStoredValue(HHStoredVarPrefixKey+SK.autoLeaguesBoostedOnly) === "true" && !Booster.haveBoosterEquiped();
        if (boostLimited) {
            Tegzd += '<li style="color:red!important;" title="'+getTextForUI("boostMissing","elementText")+'">';
        } else {
            Tegzd += '<li>';
        }
        Tegzd += getTextForUI("autoLeaguesTitle","elementText")+' ' + LeagueHelper.getEnergy()+'/'+LeagueHelper.getEnergyMax();
        if (runThreshold > 0) {
            Tegzd += ' ('+threshold+'<'+LeagueHelper.getEnergy()+'<='+runThreshold+')';
        }
        if(runThreshold > 0  && LeagueHelper.getEnergy() < runThreshold) {
            Tegzd += ' ' + getTextForUI("waitRunThreshold","elementText");
        }else {
            Tegzd += ' : ' + getTimeLeft('nextLeaguesTime');
        }
        if (boostLimited) {
            Tegzd += ' ' + getTextForUI("boostMissing","elementText") + '</li>';
        } else {
            Tegzd += '</li>';
        }
        return Tegzd;
    }

    static isTimeToFight(){
        const threshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoLeaguesThreshold)) || 0;
        const runThreshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoLeaguesRunThreshold)) || 0;
        const humanLikeRun = getStoredValue(HHStoredVarPrefixKey+TK.LeagueHumanLikeRun) === "true";
        const league_end = LeagueHelper.getLeagueEndTime();
        if (league_end > 0 && league_end <= (60*60)) {
            // Last league hour //TODO
            logHHAuto("Last League hour");
        }
        const energyAboveThreshold = humanLikeRun && LeagueHelper.getEnergy() > threshold || LeagueHelper.getEnergy() > Math.max(threshold, runThreshold-1);
        const paranoiaSpending = LeagueHelper.getEnergy() > 0 && ParanoiaService.checkParanoiaSpendings('challenge') > 0;
        const needBoosterToFight = getStoredValue(HHStoredVarPrefixKey+SK.autoLeaguesBoostedOnly) === "true";
        const haveBoosterEquiped = Booster.haveBoosterEquiped();
        // logHHAuto('League:', {threshold: threshold, runThreshold:runThreshold, energyAboveThreshold: energyAboveThreshold});

        if(checkTimer('nextLeaguesTime') && energyAboveThreshold && needBoosterToFight && !haveBoosterEquiped) {
            logHHAuto('Time for league but no booster equipped');
        }

        return (checkTimer('nextLeaguesTime') && energyAboveThreshold && (needBoosterToFight && haveBoosterEquiped || !needBoosterToFight)) || paranoiaSpending;
    }

    /* static async _refreshSorting(){
        const columnHeadSelector = '.league_content .data-list .data-column[sorting]';
        if ($(columnHeadSelector).length > 0 && $(columnHeadSelector+"[column='can_fight']").length == 0) {
            // No need of it in case HH++OCD sorting
            await TimeHelper.sleep(randomInterval(200, 400));
            logHHAuto("Click sort");
            $(columnHeadSelector).trigger('click');
            await TimeHelper.sleep(randomInterval(200, 400));
            $(columnHeadSelector).trigger('click');
            await TimeHelper.sleep(randomInterval(200, 400));
        }
    }*/

    static moduleSimLeague() {
        try {
        LeagueHelper.moduleSimLeagueHideBeatenOppo();
        if($('.change_team_container').length <= 0) {
            LeagueHelper.addChangeTeamButton();
        }

        if ($("#popup_message_league").length >0 || getStoredValue(HHStoredVarPrefixKey+SK.leagueListDisplayPowerCalc) !== "true")
        {
            return;
        }

        const opponentButtons = $('a.go_pre_battle.blue_button_L');
        const opponentSim = $("div.matchRatingNew img.powerLevelScouter");
        const allOpponentsSimDisplayed = (opponentSim.length >= opponentButtons.length);
        const Hero=getHero();
        const debugEnabled = getStoredValue(HHStoredVarPrefixKey+TK.Debug)==='true';

        const opponents_list = getHHVars("opponents_list");
        if(!opponents_list)
        {
            logHHAuto('ERROR: Can\'t find opponent list');
            return;
        } else {
            const heroFighter = opponents_list.find((el) => el.player.id_fighter == HeroHelper.getPlayerId()).player;

            const containsSimuScore = function(opponents) { return $('a[href*="id_opponent='+opponents.player.id_fighter+'"] .matchRatingNew').length > 0;}
            const containsOcdScore = function(opponents) { return $('.matchRating', $('a[href*="id_opponent='+opponents.player.id_fighter+'"]').parent()).length > 0;}
            const opponentsToSimulate = opponents_list.filter(opponents => LeagueHelper.numberOfFightAvailable(opponents) > 0 && !containsSimuScore(opponents) && !containsOcdScore(opponents));

            let SimPower = async function()
            {
                if (allOpponentsSimDisplayed)
                {
                    // logHHAuto("Stop simu");
                    return;
                }
                if (debugEnabled) logHHAuto('Simulating league opponents, remaining to simulate: ' + opponentsToSimulate.length);

                let opponentsPowerList = LeagueHelper._getTempLeagueOpponentList();
                let opponentsPowerListChanged = false;

                for(let opponentIndex = 0;opponentIndex < opponentsToSimulate.length ; opponentIndex++)
                {
                    let opponents:KKLeagueOpponent = opponentsToSimulate[opponentIndex];
                    let simu;
                    let leagueOpponent;
                    if (debugEnabled) logHHAuto(`Simulating opponent ${opponentIndex+1}/${opponentsToSimulate.length} - id: ${opponents.player.id_fighter}, nickname: ${opponents.nickname}`);
                    if(opponentsPowerList && opponentsPowerList.opponentsList.length > 0) {
                        try{
                            leagueOpponent = opponentsPowerList.opponentsList.find((el) => el.opponent_id == opponents.player.id_fighter);
                            if(leagueOpponent) simu = leagueOpponent.simu;
                        }catch(error){
                            logHHAuto("Error when getting oppo " + opponents.player.id_fighter +"from storage");
                            if(debugEnabled) logHHAuto(error);
                        }
                    }
                    if(!simu) {
                        simu = LeagueHelper.getSimPowerOpponent(heroFighter, opponents); 
                        leagueOpponent = new LeagueOpponent(
                            opponents.player.id_fighter,
                            // opponents.place,
                            opponents.nickname,
                            // opponents.level,
                            opponents.power,
                            // opponents.player_league_points,
                            Number(NumberHelper.nRounding(simu.expectedValue, 1, -1)),
                            // 0, // Boster numbers?
                            // opponents,
                            simu
                        );

                        opponentsPowerList.opponentsList.push(leagueOpponent);
                        opponentsPowerListChanged = true;
                    }

                    LeagueHelper.displayOppoSimuOnButton(opponents.player.id_fighter, simu);
                    await TimeHelper.sleep(randomInterval(10, 30)); // Allow browser to render
                }

                if(opponentsPowerListChanged) {
                    logHHAuto('Save opponent list for later');
                    setStoredValue(HHStoredVarPrefixKey+TK.LeagueOpponentList, JSON.stringify(opponentsPowerList));
                }
            }

            SimPower();
        }

        let listUpdateStatus='<div style="position: absolute;left: 720px;top: 0px;width:100px;" class="tooltipHH" id="HHListUpdate"></div>';
        if (document.getElementById("HHListUpdate") === null) {
            $(".leagues_middle_header_script").append(listUpdateStatus);
        }

        if(allOpponentsSimDisplayed || opponentSim.length <=1) {
            let buttonLaunchList='<span class="tooltipHHtext">'+getTextForUI("RefreshOppoList","tooltip")+'</span><label style="width:100%;" class="myButton" id="RefreshOppoList">'+getTextForUI("RefreshOppoList","elementText")+'</label>';
            if (document.getElementById("RefreshOppoList") === null)
            {
                $("#HHListUpdate").html('').append(buttonLaunchList);
                $("#RefreshOppoList").on("click", function()
                {
                    $("#RefreshOppoList").remove();
                    $('a[href*="id_opponent"]').each(function () {
                        $(this).html('Go'); // TODO translate
                    });
                });
            }
        } else {
            $("#HHListUpdate").html('Building:' + opponentSim.length +"/"+ opponentButtons.length);
        }

        let buttonSortList='<div style="position: absolute;left: 780px;top: 14px;width:75px;" class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("sortPowerCalc","tooltip")+'</span><label style="width:100%;" class="myButton" id="sortPowerCalc">'+getTextForUI("sortPowerCalc","elementText")+'</label></div>';
        const league_table = $('.league_content .data-list');
        if (document.getElementById("sortPowerCalc") === null && $('.matchRatingNew',league_table).length >0)
        {
            $('.leagues_middle_header_script').append(buttonSortList);
            $("#sortPowerCalc").on("click", function ()
            {
                let items = $('.data-row.body-row:visible',league_table).map((i, el) => el).toArray();
                items.sort(function(a, b)
                        {
                    //console.log($('#HHPowerCalcScore',$(a)));
                    const score_a = $('#HHPowerCalcScore',$(a)).length===0?0:Number($('#HHPowerCalcScore',$(a))[0].innerText);
                    const score_b = $('#HHPowerCalcScore',$(b)).length===0?0:Number($('#HHPowerCalcScore',$(b))[0].innerText);
                    const points_a = $('#HHPowerCalcPoints',$(a)).length===0?0:Number($('#HHPowerCalcPoints',$(a))[0].innerText);
                    const points_b = $('#HHPowerCalcPoints',$(b)).length===0?0:Number($('#HHPowerCalcPoints',$(b))[0].innerText);
                    //console.log(score_a,score_b,points_a,points_b);
                    if (score_b === score_a)
                    {
                        return points_b-points_a;
                    }
                    else
                    {
                        return score_b-score_a;
                    }
                });

                for (let item in items)
                {
                    $(items[item]).detach();
                    league_table.append(items[item]);
                }
                $('.league_content .league_table').animate({scrollTop: 0});
            });
        }

        } catch ({ errName, message }) {
            logHHAuto(`Error module Sim League: ${errName}, ${message}`);
        }
    }

    static moduleSimLeagueHideBeatenOppo()
    {
        const beatenOpponents ='<div style="position: absolute;left: 190px;top: 14px;width:100px;"  class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("HideBeatenOppo","tooltip")+'</span><label style="width:100%;" class="myButton" id="HideBeatenOppo">'+getTextForUI("HideBeatenOppo","elementText")+'</label></div>';
        if (
            (document.getElementById("beaten_opponents") === null && document.getElementById("league_filter") === null ) // button from HH OCD script
            &&  document.getElementById("HideBeatenOppo") === null
        )
        {
            if($(".leagues_middle_header_script").length == 0) {
                $('#leagues-tabs').append('<div class="leagues_middle_header_script"></div>');
                
                GM_addStyle('.leagues_middle_header_script {'
                    + 'display: flow-root;'
                    + 'margin-top: 4px;}'
                );
            }
            function removeBeatenOpponents() {
                var board = document.getElementsByClassName("data-list")[0];
                if(!board) return;
                var opponents = board.getElementsByClassName("data-row body-row");
                for (var i=0; i<opponents.length; i++) {
                    try {
                        if (!opponents[i].className.includes("player-row")) {
                            let hide = true;
                            let results = $(opponents[i]).find('div[column = "match_history"], div[column = "match_history_sorting"]')[0].children; // remove match_history after w32 update
                            for (let j=0; j<results.length; j++) {
                                if (results[j].className == "result ") hide = false;
                            }
                            if (hide) (<HTMLElement>opponents[i]).style.display="none";
                        }
                    } catch(e) {}
                }
                //($('#leagues .league_content .league_table') as any).getNiceScroll().resize()
            }

            function displayBeatenOpponents() {
                var board = document.getElementsByClassName("data-list")[0];
                if(!board) return;
                var opponents = board.getElementsByClassName("data-row body-row");
                for (var i=0; i<opponents.length; i++) {
                    try {
                        if (!opponents[i].className.includes("player-row")) {
                            let hide = true;
                            let results = $(opponents[i]).find('div[column = "match_history"], div[column = "match_history_sorting"]')[0].children; // remove match_history after w32 update
                            for (let j=0; j<results.length; j++) {
                                if (results[j].className == "result ") hide = false;
                            }
                            if (hide) (<HTMLElement>opponents[i]).style.display="";
                        }
                    } catch(e) {}
                }
                //($('#leagues .league_content .league_table') as any).getNiceScroll().resize()
            }

            $(".leagues_middle_header_script").append(beatenOpponents);

            let hideBeatenOppo = getStoredValue(HHStoredVarPrefixKey+TK.hideBeatenOppo);
            if (!hideBeatenOppo) {
                hideBeatenOppo = 0;
                setStoredValue(HHStoredVarPrefixKey+TK.hideBeatenOppo, hideBeatenOppo);
            }

            if (hideBeatenOppo == 1) {
                removeBeatenOpponents();
                $('#HideBeatenOppo').html(getTextForUI("display","elementText"));
            }
            else {
                $('#HideBeatenOppo').html(getTextForUI("HideBeatenOppo","elementText"));
            }

            $("#HideBeatenOppo").on('click', function(){
                if (hideBeatenOppo == 0) {
                    removeBeatenOpponents();
                    hideBeatenOppo = 1;
                    setStoredValue(HHStoredVarPrefixKey+TK.hideBeatenOppo, hideBeatenOppo);
                    $('#HideBeatenOppo').html(getTextForUI("display","elementText"));
                }
                else {
                    displayBeatenOpponents();
                    hideBeatenOppo = 0;
                    setStoredValue(HHStoredVarPrefixKey+TK.hideBeatenOppo, hideBeatenOppo);
                    $('#HideBeatenOppo').html(getTextForUI("HideBeatenOppo","elementText"));
                }
            });

            let sort_by = document.querySelectorAll('.data-column.head-column');
            for (var sort of sort_by) {
                sort.addEventListener('click', function() {
                    if (hideBeatenOppo == 1) removeBeatenOpponents();
                });
            }
        }
    }

    static _getTempLeagueOpponentList() {
        const maxLeagueListDurationSecs = ConfigHelper.getHHScriptVars("LeagueListExpirationSecs");
        let opponentsPowerList = getStoredJSON<any>(HHStoredVarPrefixKey+TK.LeagueOpponentList, {expirationDate:0,opponentsList:[]});
        if (Object.keys(opponentsPowerList.opponentsList).length === 0 ||  opponentsPowerList.expirationDate < new Date())
        {
            deleteStoredValue(HHStoredVarPrefixKey+TK.LeagueOpponentList);
            opponentsPowerList.expirationDate = new Date().getTime() + maxLeagueListDurationSecs * 1000;
        } else {
            logHHAuto('Found valid opponent list in storage, reuse it');
        }
        return opponentsPowerList;
    }

    static hasVanillaPowerColumn(): boolean{
        return $('.body-row .data-column[column="power"]').first().html() == $('.body-row .data-column[column="power"]').first().text()
    }

    static getLeagueOpponentListData(isFirstCall = true): LeagueOpponent[]
    { 
        let Data:LeagueOpponent[] = [];
        let opponent_id;
        let fightButton;
        let opponentsPowerList;

        const sortMode:string = getStoredValue(HHStoredVarPrefixKey + SK.autoLeaguesSortIndex);
        let usePowerCalc = sortMode === LeagueHelper.SORT_POWERCALC;
        const debugEnabled = getStoredValue(HHStoredVarPrefixKey+TK.Debug)==='true';
        if (debugEnabled) logHHAuto(`Storting method: ${sortMode}`);
        const hasScriptChangedPowerBefore = !LeagueHelper.hasVanillaPowerColumn();
        if (hasScriptChangedPowerBefore) logHHAuto('Power columned changed from vanilla game, can be HH++ BDSM or other script');

        const tableRow = $(".data-list .data-row.body-row");

        /*var getPowerOrPoints = function (hasHHBdsmChangeBefore, oppoRow)
        {
            if(hasHHBdsmChangeBefore) {
                // HH++ BDSM script exist
                // As power information is removed and replaced by simulation score, we need to use the score
                return Number($('.data-column[column="power"] .matchRating-expected .matchRating-value', oppoRow).text().replace(',', '.'));
            } else {
                return parsePrice($('.data-column[column="power"]', oppoRow).text());
            }
        }*/

        logHHAuto('Number of player in league:' + tableRow.length + '. Number of opponent not fought in league:' + $('.data-list .data-row.body-row a').length);

        const opponents_list = getHHVars("opponents_list");
        let heroFighter;
        if (usePowerCalc) {
            opponentsPowerList = LeagueHelper._getTempLeagueOpponentList()

            try {
                heroFighter = opponents_list?.find((el) => el.player.id_fighter == HeroHelper.getPlayerId()).player
            } catch (error) {
                logHHAuto('Error, falback to not use powercalc');
                if(debugEnabled) logHHAuto(error);
                usePowerCalc = false;
            }
        }

        let opponentsPowerListChanged = false;
        let canUseSimu = usePowerCalc && !!opponents_list && !!heroFighter;
        tableRow.each(function()
        {
            fightButton = $('a', $(this));
            if(fightButton.length > 0) {
                opponent_id = queryStringGetParam(new URL(fightButton.attr("href"),window.location.origin).search, 'id_opponent');

                let leagueOpponent;
                if(opponentsPowerList && opponentsPowerList.opponentsList.length > 0) {
                    try{
                        leagueOpponent = opponentsPowerList.opponentsList.find((el) => el.opponent_id == opponent_id);
                    }catch(error){
                        logHHAuto("Error when getting oppo " + opponent_id +" from storage");
                    }
                }
                if(!leagueOpponent) {
                    let expectedPoints = 0;
                    const opponents: KKLeagueOpponent = opponents_list.find((el) => el.player.id_fighter == opponent_id)
                    let simu:BDSMSimu = {} as any;
                    if(canUseSimu) {
                        try{
                            simu = LeagueHelper.getSimPowerOpponent(heroFighter, opponents); 
                            expectedPoints = Number(NumberHelper.nRounding(simu.expectedValue, 1, -1));
                        }catch(error){
                            logHHAuto("Error in simu for oppo " + opponent_id +", falback to not use powercalc");
                            canUseSimu = false;
                        }
                    }

                    leagueOpponent = new LeagueOpponent(
                        opponent_id,
                        // Number($('.data-column[column="place"]', $(this)).text()),
                        $('.nickname', $(this)).text(),
                        // Number($('.data-column[column="level"]', $(this)).text()),
                        opponents.power, // getPowerOrPoints(hasHHBdsmChangeBefore, $(this)),
                        // Number($('.data-column[column="player_league_points"]', $(this)).text().replace(/\D/g, '')),
                        expectedPoints,
                        // $('.boosters', $(this)).children().length,
                        // opponents,
                        simu
                    );

                    if (opponentsPowerList && opponentsPowerList.opponentsList) {
                        opponentsPowerList.opponentsList.push(leagueOpponent);
                        opponentsPowerListChanged = true;
                    }
                }
                Data.push(leagueOpponent);
            }
        });

        if(opponentsPowerListChanged) {
            logHHAuto('Save updated opponent list for later');
            setStoredValue(HHStoredVarPrefixKey+TK.LeagueOpponentList, JSON.stringify(opponentsPowerList));
        }

        const hasScriptChangedPowerAfter = !LeagueHelper.hasVanillaPowerColumn();
        if (!hasScriptChangedPowerBefore && hasScriptChangedPowerAfter) {
            if(isFirstCall) {
                logHHAuto('User script edited power column during computation, try again');
                return LeagueHelper.getLeagueOpponentListData(false);
            }else {
                logHHAuto('User script edited power column during computation twice, stop');
                return [];
            }
        }

        if (canUseSimu) { // sortMode === LeagueHelper.SORT_POWERCALC
            Data.sort((a,b) => (b.simuPoints > a.simuPoints) ? 1 : ((a.simuPoints > b.simuPoints) ? -1 : 0)); // sort by higher score
        } else if (sortMode === LeagueHelper.SORT_POWER){
            Data.sort((a, b) => {
                const aValue =  Math.abs(26 - a.power);
                const bValue =  Math.abs(26 - b.power);
                return (aValue > bValue) ? 1 : ((bValue > aValue) ? -1 : 0)
            }); // sort by lower power
        } // sortMode === LeagueHelper.SORT_DISPLAYED // No sorting, keep html order
        //}
        if (usePowerCalc) {
            logHHAuto('Save opponent list for later');
            setStoredValue(HHStoredVarPrefixKey+TK.LeagueOpponentList, JSON.stringify({expirationDate:opponentsPowerList.expirationDate,opponentsList:Data}));
        }
        return Data;
    }

    static doLeagueBattle() {
        try{
        //logHHAuto("Performing auto leagues.");
        // Confirm if on correct screen.
        const currentPower = LeagueHelper.getEnergy();
        const maxLeagueRegen = LeagueHelper.getEnergyMax();
        const leagueThreshold = Number(getStoredValue(HHStoredVarPrefixKey+SK.autoLeaguesThreshold));
        const debugEnabled = getStoredValue(HHStoredVarPrefixKey+TK.Debug)==='true';
        let leagueScoreSecurityThreshold = getStoredValue(HHStoredVarPrefixKey+SK.autoLeaguesSecurityThreshold);
        if (leagueScoreSecurityThreshold) {
            leagueScoreSecurityThreshold = Number(leagueScoreSecurityThreshold);
        }else{
            leagueScoreSecurityThreshold = 40;
        }

        var page = getPage();
        const Hero=getHero();
        if(page===ConfigHelper.getHHScriptVars("pagesIDLeagueBattle"))
        {
            // On the battle screen.
            // CrushThemFights(); // TODO ??? // now managed by doBattle
        }
        else if(page === ConfigHelper.getHHScriptVars("pagesIDLeaderboard"))
        {
            logHHAuto("On leaderboard page.");
            if (getStoredValue(HHStoredVarPrefixKey+SK.autoLeaguesCollect) === "true")
            {
                if ($('#leagues .forced_info button[rel="claim"]').length >0)
                {
                    $('#leagues .forced_info button[rel="claim"]').trigger('click'); //click reward
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDLeaderboard"))
                }
            }

            logHHAuto('parsing enemies');
            var Data=LeagueHelper.getLeagueOpponentListData();
            const league_end = LeagueHelper.getLeagueEndTime();

            if(currentPower < 1 && Data.length > 0)
            {
                logHHAuto("No power for leagues.");
                //prevent paranoia to wait for league
                setStoredValue(HHStoredVarPrefixKey+TK.paranoiaLeagueBlocked, "true");
                const next_refresh = getHHVars('Hero.energies.challenge.next_refresh_ts')
                setTimer('nextLeaguesTime', randomInterval(next_refresh+10, next_refresh + 3*60));
                return;
            }

            if (Data.length==0)
            {
                logHHAuto('No valid targets!');
                //prevent paranoia to wait for league
                setStoredValue(HHStoredVarPrefixKey+TK.paranoiaLeagueBlocked, "true");
                if ($('#leagues .forced_info').length > 0) {
                    setTimer('nextLeaguesTime', randomInterval(30*60, 35*60));
                } else {
                    logHHAuto('Set timer to league ends.');
                    setTimer('nextLeaguesTime', randomInterval(league_end - 5*60, league_end));
                }
            }
            else
            {
                var getPlayerCurrentLevel = LeagueHelper.getLeagueCurrentLevel();

                if (isNaN(getPlayerCurrentLevel))
                {
                    logHHAuto("Could not get current Rank, stopping League.");
                    //prevent paranoia to wait for league
                    setStoredValue(HHStoredVarPrefixKey+TK.paranoiaLeagueBlocked, "true");
                    setTimer('nextLeaguesTime', randomInterval(30*60, 35*60));
                    return;
                }
                var currentRank = Number($('.data-list .data-row.body-row.player-row .data-column[column="place"]').text());
                var currentScore = Number($('.data-list .data-row.body-row.player-row .data-column[column="player_league_points"]').text().replace(/\D/g, ''));
                let leagueTargetValue = Number(getStoredValue(HHStoredVarPrefixKey+SK.autoLeaguesSelectedIndex))+1;
                if (leagueTargetValue < Number(getPlayerCurrentLevel))
                {
                    var totalOpponents = Number($('.data-list .data-row.body-row').length)+1;
                    var maxDemote = 0;
                    if (screen.width < 1026)
                    {
                        totalOpponents = totalOpponents+1;
                    }
                    var rankDemote = totalOpponents - 14;
                    if (currentRank > (totalOpponents - 15))
                    {
                        rankDemote = totalOpponents - 15;
                    }
                    logHHAuto("Current league above target ("+Number(getPlayerCurrentLevel)+"/"+leagueTargetValue+"), needs to demote. max rank : "+rankDemote+"/"+totalOpponents);
                    let getRankDemote = $(".data-list .data-row.body-row .data-column[column='place']:contains("+rankDemote+")").filter(function()
                                                                                                                {
                        return Number($(this).text().trim()) === rankDemote;
                    });
                    if (getRankDemote.length > 0 )
                    {
                        maxDemote = Number( $(".data-column[column='player_league_points']", getRankDemote.parent()).text().replace(/\D/g, ''));
                    }
                    else
                    {
                        maxDemote = 0;
                    }

                    logHHAuto("Current league above target ("+Number(getPlayerCurrentLevel)+"/"+leagueTargetValue+"), needs to demote. Score should not be higher than : "+maxDemote);
                    if ( currentScore + leagueScoreSecurityThreshold >= maxDemote )
                    {
                        if (league_end <= (60*60)) {
                            logHHAuto("Can't do league as could go above demote, as last hour setting timer to 5 mins"); 
                            setTimer('nextLeaguesTime', randomInterval(5*60, 8*60));
                        } else {
                            logHHAuto("Can't do league as could go above demote, setting timer to 30 mins");
                            setTimer('nextLeaguesTime', randomInterval(30*60, 35*60));
                        }
                        //prevent paranoia to wait for league
                        setStoredValue(HHStoredVarPrefixKey+TK.paranoiaLeagueBlocked, "true");
                        gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                        return;
                    }
                }

                const leagues = ConfigHelper.getHHScriptVars("leaguesList");
                var maxStay = -1
                var maxLeague = $("div.tier_icons img").length;
                if ( maxLeague === undefined )
                {
                    maxLeague = leagues.length;
                }

                if (leagueTargetValue === Number(getPlayerCurrentLevel) && leagueTargetValue < maxLeague)
                {
                    var rankStay = 16;
                    if (currentRank > 15)
                    {
                        rankStay = 15;
                    }
                    logHHAuto("Current league is target ("+Number(getPlayerCurrentLevel)+"/"+leagueTargetValue+"), needs to stay. max rank : "+rankStay);
                    let getRankStay = $(".data-list .data-row.body-row .data-column[column='place']:contains("+rankStay+")").filter(function()
                                                                                                            {
                        return Number($(this).text().trim()) === rankStay;
                    });
                    if (getRankStay.length > 0 )
                    {
                        maxStay = Number( $(".data-column[column='player_league_points']", getRankStay.parent()).text().replace(/\D/g, ''));
                    }
                    else
                    {
                        maxStay = 0;
                    }

                    logHHAuto("Current league is target ("+Number(getPlayerCurrentLevel)+"/"+leagueTargetValue+"), needs to stay. Score should not be higher than : "+maxStay);
                    if ( currentScore + leagueScoreSecurityThreshold >= maxStay && getStoredValue(HHStoredVarPrefixKey+SK.autoLeaguesAllowWinCurrent) !== "true")
                    {
                        logHHAuto("Can't do league as could go above stay, setting timer to 30 mins");
                        setTimer('nextLeaguesTime', randomInterval(30*60, 35*60));
                        //prevent paranoia to wait for league
                        setStoredValue(HHStoredVarPrefixKey+TK.paranoiaLeagueBlocked, "true");
                        gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                        return;
                    }
                }
                logHHAuto(Data.length+' valid targets!');
                setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
                logHHAuto("setting autoloop to false");

                const runThreshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoLeaguesRunThreshold)) || 0;
                if (runThreshold > 0) {
                    setStoredValue(HHStoredVarPrefixKey+TK.LeagueHumanLikeRun, "true");
                }
                const nextOpponent: LeagueOpponent = Data[0];
                const opponents_list = getHHVars("opponents_list");
                const opponentDataFromList: KKLeagueOpponent = opponents_list?.find(obj => obj.player.id_fighter == nextOpponent.opponent_id);
                if (debugEnabled && opponentDataFromList) logHHAuto("opponentDataFromList ", JSON.stringify(opponentDataFromList));
                if (!opponentDataFromList) logHHAuto(`ERROR opponent ${nextOpponent.opponent_id} not found in JS list`);

                logHHAuto(`Going to fight ${nextOpponent.nickname} (${nextOpponent.opponent_id}) with power ${nextOpponent.power}. Can fight: ${opponentDataFromList?.can_fight}`);
                if (debugEnabled) logHHAuto(JSON.stringify(nextOpponent));
                // change referer
                window.history.replaceState(null, '', addNutakuSession(ConfigHelper.getHHScriptVars("pagesURLLeaguPreBattle") + '?id_opponent=' + nextOpponent.opponent_id) as string);

                const numberOfFightAvailable = LeagueHelper.numberOfFightAvailable(opponentDataFromList)
                let numberOfBattle = 1;
                if(numberOfFightAvailable > 1 && currentPower >= (numberOfFightAvailable + leagueThreshold)){
                    if(maxStay > 0 && currentScore + ( numberOfFightAvailable * leagueScoreSecurityThreshold) >= maxStay) logHHAuto('Can\'t do '+numberOfFightAvailable+' fights in league as could go above stay');
                    else numberOfBattle = numberOfFightAvailable;
                }
                logHHAuto("Going to fight " + numberOfBattle + " times (Number fights available from opponent:" + numberOfFightAvailable + ")");

                if(numberOfBattle <= 1) {
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDLeagueBattle"),{number_of_battles:1,id_opponent:nextOpponent.opponent_id});
                } else {
                    var params1: Record<string, unknown> = {
                        action: "do_battles_leagues",
                        id_opponent: nextOpponent.opponent_id,
                        number_of_battles: numberOfBattle
                    };
                    params1 = addNutakuSession(params1) as Record<string, unknown>;
                    getHHAjax()(params1, function(data) {
                        // change referer
                        window.history.replaceState(null, '', addNutakuSession(ConfigHelper.getHHScriptVars("pagesURLLeaderboard")) as string);

                        RewardHelper.closeRewardPopupIfAny();

                        // gotoPage(ConfigHelper.getHHScriptVars("pagesIDLeaderboard"));
                        location.reload();
                        Hero.updates(data.hero_changes);
                    });
                }
                
            }
        }
        else
        {
            // Switch to the correct screen
            logHHAuto("Switching to leagues screen.");
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDLeaderboard"));
            return;
        }
        } catch ({ errName, message }) {
            logHHAuto(`Error do League: ${errName}, ${message}`);
            setTimer('nextLeaguesTime', randomInterval(30 * 60, 35 * 60));
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
        }
    }

    static LeagueDisplayGetOpponentPopup(numberDone,remainingTime)
    {
        $("#leagues #leagues_middle").prepend('<div id="popup_message_league" class="HHpopup_message" name="popup_message_league" ><a id="popup_message_league_close" class="close">&times;</a>'+getTextForUI("OpponentListBuilding","elementText")+' : <br>'+numberDone+' '+getTextForUI("OpponentParsed","elementText")+' ('+remainingTime+')</div>');
        $("#popup_message_league_close").on("click", () => {location.reload();});
    }

    static LeagueClearDisplayGetOpponentPopup()
    {
        $("#popup_message_league").each(function(){this.remove();});
    }

    static LeagueUpdateGetOpponentPopup(numberDone,remainingTime)
    {
        LeagueHelper.LeagueClearDisplayGetOpponentPopup();
        LeagueHelper.LeagueDisplayGetOpponentPopup(numberDone,remainingTime);
    }
}