// Champion.ts -- Automates the Champions game mode.
//
// Handles map navigation, ticket-based fights, and reward collection for the
// Champions feature. Manages fight energy (tickets), selects opponents, and
// tracks cooldown timers between rounds.
//
// Used by: Service/index.ts (main automation loop)
//
import { get } from 'jquery';
import {
    convertTimeToInt,
    ConfigHelper,
    getHHVars,
    getPage,
    getSecondsLeft,
    getStoredJSON,
    getStoredValue,
    getTextForUI,
    randomInterval,
    setStoredValue,
    setTimer,
    TimeHelper,
    hhButton,
    deleteStoredValue
} from '../Helper/index';
import { gotoPage } from "../Service/index";
import { getHHAjax, isJSON, logHHAuto, safeJsonParse } from '../Utils/index';
import { HHStoredVarPrefixKey, SK, TK } from '../config/index';
import { ChampionModel } from "../model/index";
import { EventModule } from "./Events/index";
import { QuestHelper } from "./Quest";

export class Champion {
    run(){
    }

    static ChampDisplayAutoTeamPopup(numberDone,numberEnd,remainingTime)
    {
        $(".champions-top__inner-wrapper").prepend('<div id="popup_message_champ" class="HHpopup_message" name="popup_message_champ" style="margin:0px;width:400px" ><a id="popup_message_champ_close" class="close">&times;</a>'
                        +getTextForUI("autoChampsTeamLoop","elementText")+' : <br>'+numberDone+'/'+numberEnd+' ('+remainingTime+'sec)</div>');
        $("#popup_message_champ_close").on("click", function() {location.reload();});
    }
    static ChampClearAutoTeamPopup()
    {
        $("#popup_message_champ").each(function(){this.remove();});
    }

    static ChamppUpdateAutoTeamPopup(numberDone,numberEnd,remainingTime)
    {
        Champion.ChampClearAutoTeamPopup();
        Champion.ChampDisplayAutoTeamPopup(numberDone,numberEnd,remainingTime);
    }

    static moduleSimChampions()
    {
        if ($('#updateChampTeamButton').length > 0 || $('#orderTeam').length > 0) {
            return;
        }

        var getPoses = function($images){
            var poses:string[]=[];
            $images.each(function(idx,pose){
                var imgSrc = $(pose).attr('src') || '';
                var poseNumber = imgSrc.substring(imgSrc.lastIndexOf('/')+1).replace(/\D/g, '');
                poses.push(poseNumber);
            });
            return poses;
        }
        var getChampMaxLoop = function() { return getStoredValue(HHStoredVarPrefixKey+SK.autoChampsTeamLoop) ?? 10; }
        var getMinGirlPower = function() { return getStoredValue(HHStoredVarPrefixKey+SK.autoChampsGirlThreshold) ?? 50000; }
        var getChampSecondLine = function(){return getStoredValue(HHStoredVarPrefixKey+SK.autoChampsTeamKeepSecondLine) === 'true';}

        //let champTeamButton = '<div style="position: absolute;left: 330px;top: 10px;width:90px;z-index:10" class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("ChampTeamButton","tooltip")+'</span><label class="myButton" id="ChampTeamButton">'+getTextForUI("ChampTeamButton","elementText")+'</label></div>';
        GM_addStyle('.girl-box__draggable.switching {background-color: #ffb827;}');

        var champTeam = getHHVars('championData.team');
        // const champTeamId = Number(getHHVars('championData.champion.id'));
        let freeDrafts = Number(getHHVars('championData.freeDrafts'));
        var counterLoop = 0;
        let maxLoops = getChampMaxLoop();
        const girlMinPower = getMinGirlPower();
        let keepSecondLineGirls = getChampSecondLine();
        const championRequiredPoses: number[] = getHHVars('championData.champion.poses') || getPoses($(".champions-over__champion-info.champions-animation .champion-pose"));
        const girlBoxesQuery = ".champions-middle__girl-selection.champions-animation .girl-selection__girl-box";
        const changeDraftButtonQuery =  ".champions-bottom__footer button.champions-bottom__draft-team";
        const newDraftButtonQuery =  ".champions-bottom__footer button.champions-bottom__make-draft";
        const confirmDraftButtonQuery =  ".champions-bottom__footer button.champions-bottom__confirm-team";

        const buttonStyles = 'position: absolute;width:90px;z-index:10;left: 330px';
        let updateChampTeamButton = '<div style="' + buttonStyles +';top: 10px" class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("updateChampTeamButton","tooltip")+'</span><label class="myButton" id="updateChampTeamButton">'+getTextForUI("updateChampTeamButton","elementText")+' x'+maxLoops+'</label></div>';
        $(".champions-top__inner-wrapper").append(updateChampTeamButton);
        if (freeDrafts == 0) $('#updateChampTeamButton').attr('disabled', 'disabled')

        const orderTeam = hhButton('orderTeam', 'orderTeam', buttonStyles + ';top: 30px');
        $(".champions-top__inner-wrapper").append(orderTeam);
        
        $("#orderTeam").on("click", () => Champion.orderTeam());

        var indicateBestTeam = function() {
            const girlBoxes = $(girlBoxesQuery);
            var girlsPerPose={};
            var girls:any[]=[];
            $(".hhgirlOrder").remove();

            girlBoxes.each(function(girlIndex,girlBox){
                const $girl = $('.girl-box__draggable ', $(girlBox));
                const girlData = champTeam[girlIndex];

                if (girlData.id_girl != $girl.attr('id_girl')) {
                    logHHAuto('Invalid girls ' + girlData.id_girl + 'vs' + $girl.attr('id_girl'));
                    return;
                }

                const poseNumber = girlData.figure;
                if(!girlsPerPose[poseNumber]) {girlsPerPose[poseNumber] = [];}
                girlsPerPose[poseNumber].push({data:girlData,htmlDom:$girl});
                girlsPerPose[poseNumber].sort((a,b) => b.data.damage - a.data.damage);
                girls.push({data:girlData,htmlDom:$girl});
                girls.sort((a,b) => a.data.damage - b.data.damage);
            });

            for(var i=0;i<10;i++) {
                var expectedPose = championRequiredPoses[i%5];
                if(girlsPerPose[expectedPose] && girlsPerPose[expectedPose].length > 0){
                    let color = 'gold'; // i >= 5 ? 'white' : 'gold';
                    girlsPerPose[expectedPose][0].htmlDom.append('<span class="hhgirlOrder best" title="'+getTextForUI("ChampGirlOrder","tooltip")+' '+(i+1)+'" style="position: absolute;top: 41px;left: 3px;z-index: 10;color:'+color+';">'+(i+1)+'</span>');
                    girlsPerPose[expectedPose].shift();
                }
                if(girls && girls[i])
                    girls[i].htmlDom.append('<span class="hhgirlOrder worst" title="'+getTextForUI("ChampGirlLowOrder","tooltip")+' '+(i+1)+'" style="position: absolute;top: 41px;left: 47px;z-index: 10;color:red;">'+(i+1)+'</span>');
            }
        };

        //document.getElementById("ChampTeamButton").addEventListener("click", indicateBestTeam);
        GM_registerMenuCommand(getTextForUI("ChampTeamButton","elementText"), indicateBestTeam);
        $(document).on('click', changeDraftButtonQuery, indicateBestTeam);
        $(document).on('click', newDraftButtonQuery, indicateBestTeam);
        $(document).on('click', confirmDraftButtonQuery, indicateBestTeam);

        var checkAjaxCompleteOnChampionPage = function(event,request,settings) {
            let match = settings.data.match(/action=champion_team_draft/);
            if (match === null) return;
            champTeam = request.responseJSON.teamArray;
            freeDrafts = request.responseJSON.freeDrafts

            setTimeout(indicateBestTeam, 1000);
        };

        var selectGirls = async function() {
            Champion.ChamppUpdateAutoTeamPopup(counterLoop+1,maxLoops, (maxLoops-counterLoop) * 5);
            $('#updateChampTeamButton').text( 'Loop ' + (counterLoop+1) + '/' + maxLoops);
            const girlBoxes = $(".champions-middle__girl-selection.champions-animation .girl-selection__girl-box");
            var girlsPerPose={};
            var girls:any[]=[];
            var teamGirls:any[]=[];
            var girlsClicked = false;

            girlBoxes.each(function(girlIndex,girlBox){
                const $girl = $('.girl-box__draggable ', $(girlBox));
                const girlData = champTeam[girlIndex];

                if (girlData.id_girl != $girl.attr('id_girl')) {
                    logHHAuto('Invalid girls ' + girlData.id_girl + 'vs' + $girl.attr('id_girl'));
                    return;
                }

                const poseNumber = girlData.figure;
                if(!girlsPerPose[poseNumber]) {girlsPerPose[poseNumber] = [];}
                girlsPerPose[poseNumber].push({data:girlData,htmlDom:$girl});
                girlsPerPose[poseNumber].sort((a,b) => b.data.damage - a.data.damage);
                girls.push({data:girlData,htmlDom:$girl});
                girls.sort((a,b) => a.data.damage - b.data.damage);
            });

            const hero_damage = Number(getHHVars('championData.hero_damage'));
            // Build team
            if (keepSecondLineGirls) {
                var teamGirlIndex = 0;
                for(var i=0;i<10;i++) {
                    var expectedPose = championRequiredPoses[i%5];
                    if(girlsPerPose[expectedPose] && girlsPerPose[expectedPose].length > 0 && teamGirlIndex < 5){
                        if((girlsPerPose[expectedPose][0].data.damage + hero_damage) >= girlMinPower) {
                            teamGirls[teamGirlIndex++] = girlsPerPose[expectedPose][0].data.id_girl;
                        }
                        girlsPerPose[expectedPose].shift();
                    }
                }
            } else {
                for(var i=0;i<5;i++) {
                    var expectedPose = championRequiredPoses[i%5];
                    teamGirls[i] = -1;
                    if(girlsPerPose[expectedPose] && girlsPerPose[expectedPose].length > 0){
                        if((girlsPerPose[expectedPose][0].data.damage + hero_damage) >= girlMinPower) {
                            teamGirls[i] = girlsPerPose[expectedPose][0].data.id_girl;
                        }
                        girlsPerPose[expectedPose].shift();
                    }
                }
            }
            logHHAuto('Team of girls ' + teamGirls);

            var toggleSelectGirl = function(girlId, girlDraggable, timer = 1000){
                setTimeout(function() {
                    console.log("click " + girlId, girlDraggable);
                    girlDraggable.click();
                }, timer);
            };
            // Unselect girls
            const selectedGirls = $(".champions-middle__girl-selection.champions-animation .girl-selection__girl-box .girl-box__draggable.selected");
            selectedGirls.each(function(girlIndex,girlBox){
                const selectedGirlId = $(girlBox).attr('id_girl');
                if(teamGirls.indexOf(selectedGirlId) < 0) {
                    girlsClicked = true;
                    logHHAuto("Unselected as out of the team :" + selectedGirlId);
                    toggleSelectGirl(selectedGirlId, $(girlBox), randomInterval(300,600));
                }
            });

            // Select girls
            for(var i=0;i<5;i++) {
                if(teamGirls[i] >=0) {
                    var girlDraggable = $('.girl-box__draggable[id_girl="'+teamGirls[i]+'"]');
                    if(!girlDraggable.hasClass('selected')) {
                        girlsClicked = true;
                        logHHAuto("Girl not selected :" + teamGirls[i]);
                        toggleSelectGirl(teamGirls[i], girlDraggable, randomInterval(800,1200));
                    } else {
                        logHHAuto("Girl already selected :" + teamGirls[i]);
                    }
                }
            }

            var newDraftInterval = girlsClicked ? randomInterval(1800,2500) : randomInterval(800,1500);
            setTimeout(function() {
                if ($(newDraftButtonQuery).length > 0) $(newDraftButtonQuery).trigger('click');
            }, newDraftInterval);

            logHHAuto("Free drafts remanings :" + freeDrafts);
            counterLoop++;
            if(freeDrafts > 0 && counterLoop <= maxLoops) {
                setTimeout(selectGirls, randomInterval(6000,9000)); // Wait animation
            } else {
                Champion.ChampClearAutoTeamPopup();
                $('#updateChampTeamButton').removeAttr('disabled').text( getTextForUI("updateChampTeamButton","elementText") +' x'+maxLoops);
                if ($(confirmDraftButtonQuery).length > 0) $(confirmDraftButtonQuery).trigger('click');

                if (getStoredValue(HHStoredVarPrefixKey+SK.autoBuildChampsTeam) === "true") {
                    logHHAuto('Auto team ended, sort girls after build');
                    await TimeHelper.sleep(randomInterval(800, 1200));
                    Champion.orderTeam(champTeam);
                } else {
                    logHHAuto("Auto team ended, refresh page, restarting autoloop");
                    location.reload();
                }
            }
        };

        var findBestTeam = function() {
            setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
            logHHAuto("setting autoloop to false");

            maxLoops = getChampMaxLoop();
            keepSecondLineGirls = getChampSecondLine();
            $('#updateChampTeamButton').attr('disabled', 'disabled').text( 'Starting soon...');
            Champion.ChamppUpdateAutoTeamPopup('Starting soon...',maxLoops, (maxLoops) * 2);
            logHHAuto("keep second line : " + keepSecondLineGirls);

            counterLoop = 0;
            if( $(changeDraftButtonQuery).length > 0) $(changeDraftButtonQuery).click();
            setTimeout(selectGirls, randomInterval(800,1300));
        };

        $(document).on('ajaxComplete',checkAjaxCompleteOnChampionPage);
        setTimeout(indicateBestTeam, randomInterval(800,1200));

        if(freeDrafts > 0) {
            if($('#updateChampTeamButton').length > 0)
                $("#updateChampTeamButton").on("click", findBestTeam);
            GM_registerMenuCommand(getTextForUI("updateChampTeamButton","elementText"), findBestTeam);
        } else {
            logHHAuto("No more free draft available");
        }
    }

    static getChampionListFromMap(): ChampionModel[] {
        const Filter = (getStoredValue(HHStoredVarPrefixKey+SK.autoChampsFilter)||'').split(';').map(s=>Number(s));
        const championMap: ChampionModel[] = [];
        // const autoChampsForceStart = getStoredValue(HHStoredVarPrefixKey + SK.autoChampsForceStart) === "true";
        const autoChampsForceStartEventGirl = getStoredValue(HHStoredVarPrefixKey + SK.autoChampsForceStartEventGirl) === "true";
        const autoChampsEventGirls = getStoredJSON(HHStoredVarPrefixKey + TK.autoChampsEventGirls, []);
        const championWithEventGirl = autoChampsEventGirls.map(a => Number(a.champ_id));
        $('span.stage-bar-tier').each(function(i, tier){    
            const champion = new ChampionModel(i, (tier.getAttribute("hh_title")||'').split('/')[0].replace(/[^0-9]/gi, ''), Filter.includes(i+1));

            let timerElm = $($('a.champion-lair div.champion-lair-name')[i+1]).find('span[rel=expires]').text();
            if (timerElm !== undefined && timerElm !== null && timerElm.length > 0) {
                champion.timer = Number(convertTimeToInt(timerElm));
            }
            champion.hasEventGirls = championWithEventGirl.includes(i + 1);
            if (autoChampsForceStartEventGirl && championWithEventGirl.includes(i+1) && champion.timer < 0) {
                champion.timer = 0;
            }
            // if (autoChampsForceStart && champion.timer < 0) {
            //     champion.timer = 0;
            // }
            championMap.push(champion);
        });
        return championMap;
    }

    static async orderTeam(champTeamArg = undefined) {
        var champTeam = champTeamArg || getHHVars('championData.team');
        const champTeamId = Number(getHHVars('championData.champion.id'));
        $("#orderTeam").attr('disabled', 'disabled');
        const isClub = getPage() == ConfigHelper.getHHScriptVars("pagesIDClubChampion");

        var switchGirls = function (targettedTeam: number[]) {
            return new Promise((resolve) => {
                const params = {
                    action: "champion_team_reorder",
                    team_order: targettedTeam,
                    id_champion: champTeamId,
                    champion_type: isClub ? "club_champion" : "champion"
                };
                getHHAjax()(params, function (data: any) {
                    if(data.success == false) {
                        logHHAuto('Error occured during champion team reorder', data);
                    }
                    resolve(data.success || true);

                }, function (err) {
                    logHHAuto('Error occured during champion team reorder', err);
                    resolve(false);
                });
            });
        };

        let currentGirlOrder = [...champTeam.map(g => g.id_girl)]; // To be stored as string
        logHHAuto('Ordering champion team', currentGirlOrder);
        let oneGirlSwitched = false;

        const getGirlId = (position: number): number | null => {
            const girlBox = $('.girl-box__draggable:has(".hhgirlOrder.best:contains(\'' + position + '\')")');
            if (girlBox.length > 0) {
                if(position == 1) {
                    // Avoid selecting girl with position 10
                    if (girlBox.first().find('.hhgirlOrder.best').text().trim() == '1')
                        return Number(girlBox.first().attr('id_girl'));

                    if (girlBox.last().find('.hhgirlOrder.best').text().trim() == '1')
                        return Number(girlBox.last().attr('id_girl'));
                } else {
                    return Number(girlBox.attr('id_girl'));
                }
            }
            return null;
        }

        for (let i = 1; i <= 10; i++) {
            const girlId = getGirlId(i);
            if (girlId && !isNaN(girlId)) {
                if (girlId != currentGirlOrder[i - 1]) {
                    $('div[id_girl="' + girlId + '"]').addClass('switching');
                    $('div[id_girl="' + currentGirlOrder[i - 1] + '"]').addClass('switching');
                    logHHAuto(`Switching girls to reorder team ${girlId} - ${currentGirlOrder[i - 1]}`);
                    const oldGirlIndex = currentGirlOrder.findIndex(g => g == girlId);
                    const targettedTeam = [...currentGirlOrder];
                    [targettedTeam[i - 1], targettedTeam[oldGirlIndex]] = [targettedTeam[oldGirlIndex], targettedTeam[i - 1]];
                    logHHAuto('Ordering champion targettedTeam', targettedTeam);
                    if(await switchGirls(targettedTeam)) {
                        oneGirlSwitched = true;
                        // Update current girls order after success switch
                        currentGirlOrder = targettedTeam;
                    } else {
                        logHHAuto('ERROR: Switch failed, try to continue');
                    }
                    $('div[id_girl]').removeClass('switching');
                    await TimeHelper.sleep(randomInterval(800, 1200));
                } else {
                    logHHAuto('Girl already in the right position :' + girlId);
                }
            } else {
                logHHAuto('Could not find girlId for position ' + i);
            }
        }

        logHHAuto('Finished ordering champion team');
        $("#orderTeam").removeAttr('disabled');
        //if(oneGirlSwitched) 
            location.reload();
    }

    static async doChampionStuff()
    {
        var page=getPage();
        if (page==ConfigHelper.getHHScriptVars("pagesIDChampionsPage"))
        {
            const champTeamId = Number(getHHVars('championData.champion.id'));
            logHHAuto('on champion ' + champTeamId +' page');
            if ($('button[rel=perform].blue_button_L').length==0)
            {
                logHHAuto('Something is wrong!');
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                return true;
            }
            else
            {
                // champion-healing-tooltip='{"amount":"1,123,123","impression_info":"9,123,123/99,999,999"}'
                // champion-healing-tooltip='{"impression_info":"0/99,999,999"}'
                const tooltipData = $('.stage-progress-bar-wrapper[champion-healing-tooltip]').attr('champion-healing-tooltip') || '{"impression_info":"0/1"}';
                const impressionDone = ((safeJsonParse<any>(tooltipData, {})).impression_info || '0/1').split('/')[0] || '0';
                var TCount=Number($('div.input-field > span')[1].innerText.split(' / ')[1]);
                var ECount= QuestHelper.getEnergy();
                logHHAuto("T:"+TCount+" E:"+ECount+" "+(getStoredValue(HHStoredVarPrefixKey+SK.autoChampsUseEne) ==="true")+" Imp:"+impressionDone);
                if ( TCount==0)
                {
                    logHHAuto("No tickets!");
                    const nextTime = randomInterval(3600, 4000);
                    setTimer('nextChampionTime', nextTime);
                    if (getStoredValue(HHStoredVarPrefixKey+SK.autoClubChamp) ==="true") {
                        // no ticket for both
                        setTimer('nextClubChampionTime', nextTime);
                    }
                    return false;
                }
                else
                {
                    if (impressionDone == 0 && getStoredValue(HHStoredVarPrefixKey + SK.autoBuildChampsTeam) === "true") {
                        const tempChampBuildTeam = getStoredValue(HHStoredVarPrefixKey + TK.champBuildTeam);
                        if (tempChampBuildTeam == "champ_" + champTeamId) {
                            deleteStoredValue(HHStoredVarPrefixKey + TK.champBuildTeam);
                        } else {
                            logHHAuto("Build team before start");
                            if ($("#updateChampTeamButton").length == 0) {
                                Champion.moduleSimChampions();
                                await TimeHelper.sleep(randomInterval(200, 500));
                            }
                            if ($("#updateChampTeamButton").attr("disabled") === "disabled") {
                                logHHAuto('Cannot build team, no free draft available. Starting champion without building team');
                            } else {
                                $("#updateChampTeamButton").trigger("click"); // Auto loop false
                                setStoredValue(HHStoredVarPrefixKey + TK.champBuildTeam, "champ_" + champTeamId);
                                await TimeHelper.sleep(randomInterval(2000, 5000));
                                return true; // In next loop started after team build, start champ without building team again
                            }
                        }
                    }
                    logHHAuto("Using ticket");
                    $('button[rel=perform].blue_button_L').trigger('click');
                    await TimeHelper.sleep(randomInterval(200, 500));
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDChampionsMap"));
                    return true;
                }
            }
        }
        else if (page==ConfigHelper.getHHScriptVars("pagesIDChampionsMap"))
        {
            logHHAuto('on champion map');

            const championMap = Champion.getChampionListFromMap();
            const autoChampsForceStartEventGirl = getStoredValue(HHStoredVarPrefixKey+SK.autoChampsForceStartEventGirl) === "true";
            const autoChampsEventGirls = getStoredJSON(HHStoredVarPrefixKey+TK.autoChampsEventGirls, []);
            const autoChampsForceStart = getStoredValue(HHStoredVarPrefixKey+SK.autoChampsForceStart) === "true";

            for (let i=0;i<championMap.length;i++)
            {
                let OnTimer= championMap[i].timer > 0;
                let autoChampGirlInEvent = false;
                let autoChampGirlOnChamp = false;
                let autoChampGirlsIds:number[] = [];
                let autoChampGirlsEventsID;
                if (autoChampsForceStartEventGirl)
                {
                    for (let ec=autoChampsEventGirls.length;ec>0;ec--)
                    {
                        let idArray = Number(ec)-1;
                        if ( Number(autoChampsEventGirls[idArray].champ_id) === i+1)
                        {
                            autoChampGirlInEvent = true;
                            autoChampGirlsIds.push(Number(autoChampsEventGirls[idArray].girl_id));
                            autoChampGirlsEventsID=autoChampsEventGirls[idArray].event_id;
                        }
                    }
                    let firstLockedLevelOfChampRequest ='a.champion-lair[href*=' + Number(i+1) +'] .stage-icon.locked';
                    if ( autoChampGirlInEvent && $(firstLockedLevelOfChampRequest).length > 0 )
                    {
                        let firstLockedLevelOfChamp = $(firstLockedLevelOfChampRequest)[0].getAttribute("champion-rewards-tooltip");
                        let parsedFirstLockedLevelOfChamp = safeJsonParse(firstLockedLevelOfChamp, null);
                        if
                            (
                                parsedFirstLockedLevelOfChamp !== null
                                && parsedFirstLockedLevelOfChamp.stage.girl_shards
                                && parsedFirstLockedLevelOfChamp.stage.girl_shards.length > 0
                            )
                        {
                            for (let girlIt = 0;girlIt < parsedFirstLockedLevelOfChamp.stage.girl_shards.length; girlIt++)
                            {
                                if (autoChampGirlsIds.includes(parsedFirstLockedLevelOfChamp.stage.girl_shards[girlIt].id_girl) )
                                {
                                    autoChampGirlOnChamp = true;
                                }
                            }
                            if (! autoChampGirlOnChamp)
                            {
                                logHHAuto("Seems Girl is no more available at Champion "+Number(i+1)+". Going to event page.");
                                EventModule.parseEventPage(autoChampGirlsEventsID);
                                return true;
                            }
                        }
                    }

                }
                const eventGirlForced=autoChampGirlOnChamp;
                logHHAuto("Champion "+(i+1)+" ["+championMap[i].impression+"]"
                    +(championMap[i].started?" Started;":" Not started;")
                    +(autoChampsForceStart?" Force start;":" Not force start;")
                    +(OnTimer?" on timer;":" not on timer;")
                    +(championMap[i].inFilter?" Included in filter;":" Excluded from filter;")
                    +(eventGirlForced?" Forced for event":" Not event forced"));

                if ((championMap[i].started || eventGirlForced || autoChampsForceStart) && !OnTimer && championMap[i].inFilter)
                {
                    logHHAuto("Let's do him!");
                    gotoPage('/champions/'+Number(i+1));
                    //window.location = window.location.origin + '/champions/'+(i+1);
                    return true;
                }
            }

            logHHAuto("No good candidate");
            Champion.findNextChamptionTime(championMap);
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
            return false;
        }
        else
        {
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDChampionsMap"));
            return true;
        }
    }

    static findNextChamptionTime(championMap: ChampionModel[]=undefined) {
        if (getPage() == ConfigHelper.getHHScriptVars("pagesIDChampionsMap")) {
            const debugEnabled = getStoredValue(HHStoredVarPrefixKey + TK.Debug) === 'true';
            const autoChampsForceStart = getStoredValue(HHStoredVarPrefixKey+SK.autoChampsForceStart) === "true";
            var minTime = -1; // less than 15min
            var minTimeEnded = -1;
            var currTime: number;

            if (championMap == undefined) {
                championMap = Champion.getChampionListFromMap();
            }
            // if (debugEnabled) logHHAuto('championMap: ', championMap);
            for (let i=0;i<championMap.length;i++)
            {
                if(championMap[i].inFilter) {
                    currTime = championMap[i].timer;
                    if(currTime === 0) {
                        minTime = 0;
                        minTimeEnded = -1; // end loop so value is not accurate
                        break;
                    }else if (currTime > 0) {
                        if (currTime > minTimeEnded) {minTimeEnded = currTime;}
                        if (currTime > minTime && currTime < 1800) {minTime = currTime;} // less than 30min
                    } else if (!championMap[i].started && autoChampsForceStart) {
                        minTime = 0;
                        minTimeEnded = -1; // end loop so value is not accurate
                        break;
                    }
                }
            }
            //fetching min
            let nextChampionTime: number;

            logHHAuto('minTimeEnded: ' + minTimeEnded + ', minTime:' + minTime);
            if (minTime === -1 && minTimeEnded === -1)
            {
                nextChampionTime = randomInterval(3600, 4000);
            }
            else if (minTime === -1)
            {
                logHHAuto('Champion ended, next time: ' + minTimeEnded);
                nextChampionTime = randomInterval(minTimeEnded, 180 + minTimeEnded);
            }
            else
            {
                logHHAuto('Champion next time: ' + minTime);
                const maxTime = minTime > 0 ? 180 + minTime : 0.5;
                nextChampionTime = randomInterval(minTime, maxTime);
            }
            Champion._setTimer(nextChampionTime);
        }
    }

    /**
     * 
     * @param {number} nextChampionTime 
     * @private
     */
    static _setTimer(nextChampionTime: number): void {
        if (getStoredValue(HHStoredVarPrefixKey+SK.autoClubChamp) === "true" 
            && getStoredValue(HHStoredVarPrefixKey+SK.autoChampAlignTimer) === "true" 
            && getStoredValue(HHStoredVarPrefixKey+TK.clubChampLimitReached) !== "true")
            {
            const champClubTimeLeft = getSecondsLeft('nextClubChampionTime');
            if(nextChampionTime > 10 && champClubTimeLeft < 1200 && nextChampionTime < 1200) { // align settings
                // 20 min for standard wait time
                nextChampionTime = Math.max(nextChampionTime, champClubTimeLeft);
            }
        }
        setTimer('nextChampionTime', nextChampionTime);
    }
}
