// TeamModule.ts -- Team management: auto-selects optimal teams for different
// battle modes.
//
// Different game modes (league, troll, labyrinth, etc.) benefit from different
// team compositions. This module automatically selects and switches to the
// optimal team configuration before each fight type, saving the player from
// manual team management.
//
// Used by: League.ts, Troll.ts, Labyrinth.ts, Season.ts, and other fight modules
//
import {
    ConfigHelper,
    HeroHelper,
    getHero,
    getHHVars,
    getPage,
    getTextForUI,
    hhButton,
    hhMenuSwitch,
    randomInterval,
    setStoredValue
} from '../Helper/index';
import { addNutakuSession, gotoPage } from '../Service/PageNavigationService';
import { TeamBuilderService, ScoringMode, TeamResult } from '../Service/TeamBuilderService';
import { GirlData, ElementType } from '../Service/TeamScoringService';
import { fillHHPopUp, getHHAjax, logHHAuto } from '../Utils/index';
import { HHStoredVarPrefixKey, TK } from '../config/index';
import { KKTeamGirl, TeamData } from '../model/index';
import { Harem, HaremGirl } from './index';

export class TeamModule {

    static resetTeam() {
        $('#clear-team').trigger('click');
    }
    static validateTeam() {
        $('#validate-team').trigger('click');
    }
    
    static moduleChangeTeam()
    {
        if (document.getElementById("ChangeTeamButton") !== null || document.getElementById("ChangeTeamButton2") !== null)
        {
            return;
        }
        const buttonStyles = 'position: absolute;left: 60%;width:60px;z-index:10';
        const ChangeTeamButton = hhButton('ChangeTeamButton', 'ChangeTeamButton', buttonStyles + ';top: 110px', 'font-size:small');
        const ChangeTeamButton2 = hhButton('ChangeTeamButton2', 'ChangeTeamButton2', buttonStyles + ';top: 160px', 'font-size:small');
        const UnequipAll = hhButton('UnequipAll', 'UnequipAll', buttonStyles + ';top: 210px', 'font-size:small');

        GM_addStyle('.topNumber{top: 2px;left: 12px;width: 100%;position: absolute;text-shadow: 1px 1px 1px black, -1px -1px 1px black;}');

        $("#contains_all section").append(ChangeTeamButton);
        $("#contains_all section").append(ChangeTeamButton2);
        $("#contains_all section").append(UnequipAll);

        $("#ChangeTeamButton" ).on("click", () => { TeamModule.setTopTeam(1) });
        $("#ChangeTeamButton2").on("click", () => { TeamModule.setTopTeam(2) });
        $("#UnequipAll").on("click", TeamModule.unequipAllGirls);
    }
    
    static moduleEquipTeam()
    {
        if (document.getElementById("EquipAll") !== null)
        {
            return;
        }

        GM_addStyle('.team-hexagon-container .team-hexagon .team-member-container.selected .team-member-border {background-color: #ffb827;}');

        const buttonStyles = 'position: absolute;top: 420px;z-index:10';
        const UnequipAll = hhButton('UnequipAll', 'UnequipAll', buttonStyles + ';left: 68%', 'font-size:small');
        const EquipAll = hhButton('EquipAll', 'EquipAll', buttonStyles + ';left: 78%', 'font-size:small');
        const StuffTeam = hhButton('StuffTeam', 'StuffTeam', buttonStyles + ';left: 88%', 'font-size:small');

        $("#contains_all section").append(EquipAll);
        $("#contains_all section").append(UnequipAll);
        $("#contains_all section").append(StuffTeam);

        $("#EquipAll").on("click", TeamModule.equipAllGirls);
        $("#UnequipAll").on("click", TeamModule.unequipAllGirls);
        $("#StuffTeam").on("click", TeamModule.buildStuffTeamSelectPopUp);

        $('.team-slot-container').on('click', TeamModule.manageSkillScrollTooltip);
        TeamModule.manageSkillScrollTooltip();
    }

    static unequipAllGirls(callback: any = null) {
        if (getPage() === ConfigHelper.getHHScriptVars("pagesIDEditTeam") || getPage() === ConfigHelper.getHHScriptVars("pagesIDBattleTeams")) {
            logHHAuto('Unequip from edit team');
            $("#UnequipAll").attr('disabled', 'disabled');
            const girlId = TeamModule.getFirstSelectedGirlId();
            if (isNaN(girlId) || girlId < 0) {
                logHHAuto('Error: can\'t get mandatory girl id, cancel action');
                return;
            }
            const currentPage = window.location.pathname + window.location.search;
            // change referer
            //logHHAuto('change referer to ' + '/characters/' + girlId);
            window.history.replaceState(null, '', addNutakuSession('/characters/' + girlId) as string);
            var params1 = {
                action: "girl_equipment_unequip_all_girls"
            };
            getHHAjax()(params1, function(data:any) {
                $("#UnequipAll").removeAttr('disabled');
                // change referer
                //logHHAuto('change referer back to ' + currentPage);
                window.history.replaceState(null, '', addNutakuSession(currentPage) as string);
                if(callback && typeof callback === 'function') {
                    callback();
                } else {
                    setTimeout(function () { location.reload(); }, randomInterval(200, 500));
                }
            });
        } 
        // else if (getPage().match(/^\/characters\/\d+$/)) {
        // TODO unequip from harem page
        //     logHHAuto('Unequip from harem page');
        //     if ($('#unequip_all').length > 0) {
        //         $('#unequip_all').trigger('click');
        //     }
        // }
    }

    static manageSkillScrollTooltip() {
        $('.hhScrollTooltip').remove();
        setTimeout(() => {
            const teamGirls = TeamModule.getSelectedGirls();
            if (teamGirls.length == 7) {
                TeamModule.createSkillScrollTooltip(teamGirls);
            }
        },100);
    }

    static createSkillScrollTooltip(teamGirls: KKTeamGirl[]=null, displayTooltip: boolean=true): TeamData {
        // if (!teamGirls || teamGirls.length != 7) {
        //     teamGirls = TeamModule.getSelectedGirls();
        //     if (teamGirls.length != 7) {
        //         return;
        //     }
        // }
        const teamGirlWithoutMain = teamGirls.slice(1);
        const heroCurrencies = getHero().currencies;
        let scrollTooltipDetail = '';
        const mainGirl = teamGirls[0];
        const team = new TeamData();
        team.team = teamGirls;

        const neededMythicScrolls = TeamModule.getSkillNeededScrolls(mainGirl, teamGirlWithoutMain, 'mythic', 6);
        if (neededMythicScrolls > 0) {
            team.scrolls_mythic = neededMythicScrolls;
            scrollTooltipDetail += `<span class="scrolls_mythic_icn" style="width: 25px;height: 25px;"></span> Mythic: ${neededMythicScrolls}/${heroCurrencies.scrolls_mythic} <br/>`;
        }
        let neededLegendaryScrolls = TeamModule.getSkillNeededScrolls(mainGirl, teamGirlWithoutMain, 'legendary', 5);
        neededLegendaryScrolls += TeamModule.getSkillNeededScrolls(mainGirl, teamGirlWithoutMain, 'legendary', 3);
        if (neededLegendaryScrolls > 0) {
            team.scrolls_legendary = neededLegendaryScrolls;
            scrollTooltipDetail += `<span class="scrolls_legendary_icn" style="width: 25px;height: 25px;"></span> Legendary: ${neededLegendaryScrolls}/${heroCurrencies.scrolls_legendary} <br/>`;
        }
        let neededEpicScrolls = TeamModule.getSkillNeededScrolls(mainGirl, teamGirlWithoutMain, 'epic', 5);
        neededEpicScrolls += TeamModule.getSkillNeededScrolls(mainGirl, teamGirlWithoutMain, 'epic', 3);
        if (neededEpicScrolls > 0) {
            team.scrolls_epic = neededEpicScrolls;
            scrollTooltipDetail += `<span class="scrolls_epic_icn" style="width: 25px;height: 25px;"></span> Epic: ${neededEpicScrolls}/${heroCurrencies.scrolls_epic} <br/>`;
        }
        let neededRareScrolls = TeamModule.getSkillNeededScrolls(mainGirl, teamGirlWithoutMain, 'rare', 5);
        neededRareScrolls += TeamModule.getSkillNeededScrolls(mainGirl, teamGirlWithoutMain, 'rare', 3);
        if (neededRareScrolls > 0) {
            team.scrolls_rare = neededRareScrolls;
            scrollTooltipDetail += `<span class="scrolls_rare_icn" style="width: 25px;height: 25px;"></span> Rare: ${neededRareScrolls}/${heroCurrencies.scrolls_rare} <br/>`;
        }
        let neededCommonScrolls = TeamModule.getSkillNeededScrolls(mainGirl, teamGirlWithoutMain, 'common', 5);
        neededCommonScrolls += TeamModule.getSkillNeededScrolls(mainGirl, teamGirlWithoutMain, 'common', 3);
        neededCommonScrolls += TeamModule.getSkillNeededScrolls(mainGirl, teamGirlWithoutMain, 'common', 1);
        if (neededCommonScrolls > 0) {
            team.scrolls_common = neededCommonScrolls;
            scrollTooltipDetail += `<span class="scrolls_common_icn" style="width: 25px;height: 25px;"></span> Common: ${neededCommonScrolls}/${heroCurrencies.scrolls_common} <br/>`;
        }
        logHHAuto(`Needed ${neededMythicScrolls} mythic scrolls, ${neededLegendaryScrolls} legendary scrolls, ${neededEpicScrolls} epic scrolls, ${neededRareScrolls} rare scrolls and ${neededCommonScrolls} common scrolls for the current team`);


        const scrollTooltip = $('<div class="hhScrollTooltip"><span class="scrolls_common_icn" style="width: 25px;height: 25px;"></span></div>');
        scrollTooltip.css('position', 'absolute').css('top', '110px').css('right', '30px');
        scrollTooltip.attr('tooltip', `<div style="max-width: 290px;">${getTextForUI("skillPointTooltipTitle", "elementText") }<br />
                            ${scrollTooltipDetail}<br />${getTextForUI("skillPointTooltipDescription", "elementText") }</div>`);

        
        if (displayTooltip) $('.team-right-part-container').append(scrollTooltip);
        return team;
    }

    static stuffAllGirls() {
        if (getPage() === ConfigHelper.getHHScriptVars("pagesIDBattleTeams")) {
        }
    }

    static buildStuffTeamSelectPopUp() {
        const teamGirls = TeamModule.getSelectedGirls();
        if (teamGirls.length == 0) {
            return;
        }
        const team = TeamModule.createSkillScrollTooltip(teamGirls, false);
        team.girlIds = teamGirls.map(girl => girl.id_girl);
        const heroCurrencies = getHero().currencies;

        const displayScrollSwitch = function(rarity:string){
            const showToggle = team['scrolls_' + rarity.toLowerCase()] > heroCurrencies['scrolls_' + rarity.toLowerCase()];
            return `<span><span class="scrolls_${rarity.toLowerCase()}_icn" style="width: 25px;height: 25px;" title="${rarity} bulbs"></span>${rarity} bulbs:</span> 
            <div ${showToggle ? '' : 'style="display:none;"'}> ${hhMenuSwitch('stuffTeamReset' + rarity + 'Girls')} </div>
            <div ${!showToggle ? '' : 'style="display:none;"'}>${getTextForUI("enoughBulbsOwned", "elementText")}</div>
            <span>Needed: ${team['scrolls_' + rarity.toLowerCase()]}/Owned: ${heroCurrencies['scrolls_'+rarity.toLowerCase()]} <span><br/>`;
        };

        const estimatedCost = 5 * (team.scrolls_mythic || 0 + team.scrolls_legendary || 0 + team.scrolls_epic || 0 + team.scrolls_rare || 0 + team.scrolls_common || 0);

        let stuffTeamMenu = `<div style="padding:5px; display:flex;flex-direction:column;font-size:15px; max-width:550px" class="HHAutoScriptMenu">
            <div class="rowLine">
                <p>${getTextForUI("StuffTeam", "tooltip")}</p>
            </div>
            <div class="rowLine">
                ${getTextForUI("stuffTeaEstimatedCost", "elementText")}<span class="hudSC_mix_icn"></span>${Math.round(estimatedCost)}M
            </div>
            <hr style="border: 1px solid #ffa23e; width:100%"/>
            <div class="rowLine">
                ${hhMenuSwitch('unequipGirlsBefore')}
                ${hhMenuSwitch('StuffTeamEquipment')}
                ${hhMenuSwitch('StuffTeamSkills')}
            </div>
            <hr/>
            <div class="rowLine" ${team.scrolls_mythic > 0    ? '' : 'style="display:none;"' }>${displayScrollSwitch('Mythic')}</div>
            <div class="rowLine" ${team.scrolls_legendary > 0 ? '' : 'style="display:none;"' }>${displayScrollSwitch('Legendary')}</div>
            <div class="rowLine" ${team.scrolls_epic > 0      ? '' : 'style="display:none;"' }>${displayScrollSwitch('Epic')}</div>
            <div class="rowLine" ${team.scrolls_rare > 0      ? '' : 'style="display:none;"' }>${displayScrollSwitch('Rare')}</div>
            <div class="rowLine" ${team.scrolls_common > 0    ? '' : 'style="display:none;"' }>${displayScrollSwitch('Common')}</div>
            <hr/>
            <div class="rowLine">
                <span class="hudSC_mix_icn"></span>
                <div style="padding:10px;" class="tooltipHH">
                    <span class="tooltipHHtext">${getTextForUI("StuffTeamMoney", "tooltip")}</span>
                    <label for"moneyToKeep">${getTextForUI("StuffTeamMoney", "elementText")}</label>
                    <input id="moneyToKeep" class="maxMoneyInputField" style="width:150px;height:20px" required pattern="[0-9 ]+" type="text" value="500000000">
                </div>
            </div>
            <hr style="border: 1px solid #ffa23e; width:100%"/>
            <div class="rowLine">
                <div style="padding:10px;width:50%" class="tooltipHH">
                    <span class="tooltipHHtext">${getTextForUI("Launch", "tooltip")}</span>
                    <label class="myButton" id="stuffTeamSubmit" style="font-size:15px; width:100%;text-align:center">${getTextForUI("Launch", "elementText")}</label>
                </div>
            </div>
            <p style="color: red;" id="stuffTeamError"></p>
        </div>`;
        fillHHPopUp("stuffTeamMenu", getTextForUI("StuffTeam", "elementText"), stuffTeamMenu);

        (<HTMLInputElement>document.getElementById("unequipGirlsBefore")).checked = true;
        (<HTMLInputElement>document.getElementById("StuffTeamEquipment")).checked = true;
        (<HTMLInputElement>document.getElementById("StuffTeamSkills")).checked = true;


        $("#stuffTeamSubmit").on("click", function() {
            logHHAuto('Stuff from edit team');
            //$("#StuffTeam").attr('disabled', 'disabled');
            const saveAndGo = function () {

                const teamSettings = {
                    moneyToKeep: (<HTMLInputElement>document.getElementById("moneyToKeep")).value,
                    resetMythicGirls: (<HTMLInputElement>document.getElementById("stuffTeamResetMythicGirls")).checked,
                    resetLegendaryGirls: (<HTMLInputElement>document.getElementById("stuffTeamResetLegendaryGirls")).checked,
                    resetEpicGirls: (<HTMLInputElement>document.getElementById("stuffTeamResetEpicGirls")).checked,
                    resetRareGirls: (<HTMLInputElement>document.getElementById("stuffTeamResetRareGirls")).checked,
                    resetCommonGirls: (<HTMLInputElement>document.getElementById("stuffTeamResetCommonGirls")).checked,
                };
                logHHAuto('Team settings: ' + JSON.stringify(teamSettings));
                
                setStoredValue(HHStoredVarPrefixKey + TK.haremTeam, JSON.stringify(team));
                setStoredValue(HHStoredVarPrefixKey + TK.haremGirlActions, HaremGirl.SKILLS_TYPE + '_' + HaremGirl.EQUIPMENT_TYPE);
                setStoredValue(HHStoredVarPrefixKey + TK.haremGirlMode, 'team');
                setStoredValue(HHStoredVarPrefixKey + TK.haremTeamSettings, JSON.stringify(teamSettings));
                setStoredValue(HHStoredVarPrefixKey + TK.lastActionPerformed, Harem.HAREM_UPGRADE_LAST_ACTION);
                
                if(teamSettings.resetCommonGirls || teamSettings.resetRareGirls || teamSettings.resetEpicGirls || teamSettings.resetLegendaryGirls || teamSettings.resetMythicGirls) {
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDWaifu"));
                } else {
                    logHHAuto('No skill to reset, going to harem.');
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDHarem"));
                }
            }
            const unequipBefore = (<HTMLInputElement>document.getElementById("unequipGirlsBefore")).checked;
            if (unequipBefore) {
                // First un-equip all
                TeamModule.unequipAllGirls(saveAndGo);
            } else {
                saveAndGo();
            }
        });
    }

    // static getSkillNeededScrollsOneGirl(girl: KKTeamGirl): number {
    //     const rarity = girl.girl.rarity;
    //     const nbGrades = girl.girl.nb_grades;
    //     const skills: any[] = Object.values(girl.skill_tiers_info);
    //     const usedScrolls = Number(skills.reduce((accumulator, skill) => accumulator + (skill.skill_points_used || 0), 0));

    //     const fullNeededScrolls = HaremGirl.SCROLLS_NEED_5[rarity + '_' + nbGrades];
    //     logHHAuto(`Total skill points used by ${girl.girl.name}: ${usedScrolls}/${fullNeededScrolls}`);
    //     return fullNeededScrolls - usedScrolls;
    // }

    static getSkillNeededScrolls(mainGirl: KKTeamGirl, teamGirls: KKTeamGirl[], rarity: string, nbGrades: number): number {
        const girls = teamGirls.filter(girl => girl.girl && girl.girl.rarity === rarity && girl.girl.nb_grades == nbGrades);
        if (girls.length > 0) logHHAuto(`Found ${girls.length} ${rarity} girls with ${nbGrades} grades in the team.`);
        let usedScrolls = 0;
        for (const girl of girls) {
            const skills: any[] = Object.values(girl.skill_tiers_info);
            usedScrolls += Number(skills.reduce((accumulator, skill) => accumulator + (skill.skill_points_used || 0), 0));
        }
        let fullNeededScrolls = girls.length * HaremGirl.SCROLLS_NEED_4[rarity + '_' + nbGrades];

        if (mainGirl.girl.rarity === rarity && mainGirl.girl.nb_grades == nbGrades) {
            fullNeededScrolls += HaremGirl.SCROLLS_NEED_5[rarity + '_' + nbGrades];
            const skills: any[] = Object.values(mainGirl.skill_tiers_info);
            usedScrolls += Number(skills.reduce((accumulator, skill) => accumulator + (skill.skill_points_used || 0), 0));
        }

        if (girls.length > 0) logHHAuto(`Total skill points used by ${rarity}_${nbGrades} girls in the team: ${usedScrolls}/${fullNeededScrolls}`);
        return Math.max(0, fullNeededScrolls - usedScrolls);
    }

    static equipAllGirls() {
        if (getPage() === ConfigHelper.getHHScriptVars("pagesIDBattleTeams")) {
            setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
            logHHAuto("Setting autoloop to false to let the equip action complete without interruptions.");

            logHHAuto('Equip team');
            $("#EquipAll").attr('disabled', 'disabled');
            const girlIds = TeamModule.getSelectedGirlsId();
            if (girlIds.length == 0) {
                return
            }
            
            const currentPage = window.location.pathname + window.location.search;
            let index = 0;

            const equipGirl = (girlId: number) => {
                logHHAuto(`Performing equip action for girl ${girlId} (${index + 1}/${girlIds.length})`);

                $(`.team-member-container[data-girl-id="${girlId}"]`).addClass('selected');
                // change referer
                //logHHAuto('change referer to ' + '/characters/' + girlId);
                window.history.replaceState(null, '', addNutakuSession('/girl/' + girlId + '?resource=equipment') as string);
                var params1 = {
                    action: "girl_equipment_equip_all",
                    id_girl: girlId
                };
                getHHAjax()(params1, function (data: any) {
                    $('.team-member-container').removeClass('selected');
                    if (data && data.success){
                        logHHAuto(`Successfully equip girl ${girlId}`);
                    } else logHHAuto(`Failed to equip girl ${girlId}`);
                    index++;

                    if(index <= (girlIds.length - 1)){
                        setTimeout(function () { equipGirl(girlIds[index]) }, randomInterval(800, 1000));
                    } else {
                        $("#EquipAll").removeAttr('disabled');
                        // change referer
                        //logHHAuto('change referer back to ' + currentPage);
                        window.history.replaceState(null, '', addNutakuSession(currentPage) as string);
                        setTimeout(function () { location.reload(); }, randomInterval(200, 500));
                    }
                });
            }
            equipGirl(girlIds[index]);
        } 
    }

    static getFirstSelectedGirlId(): number{
        //const selectedPosition = $('#contains_all section .player-panel .player-team .team-hexagon .team-member-container.selectable[data-team-member-position="0"]');
        const selectedPosition = $('.team-member-container[data-team-member-position="0"]');

        if (selectedPosition.length > 0) {
            return Number(selectedPosition.attr('data-girl-id'));
        }
        return -1;
    }

    static getSelectedGirlsId(): number[]{
        const selectedTeam = $('.team-slot-container.selected-team').attr('data-team-index');
        if (isNaN(Number(selectedTeam))) {
            logHHAuto('Error: can\'t get selected team index, cancel action');
            return;
        }
        const girlIds = [...unsafeWindow.teams_data[selectedTeam].girls_ids];
        if (girlIds.length != 7) {
            logHHAuto('Error: can\'t get all team members, cancel action');
            return [];
        }
        logHHAuto('Selected team: ' + selectedTeam + ', Team members to equip: ' + girlIds.join(', '));
        return girlIds;
    }

    static getSelectedGirls(): KKTeamGirl[]{
        const selectedTeam = $('.team-slot-container.selected-team').attr('data-team-index');
        if (isNaN(Number(selectedTeam))) {
            logHHAuto('Error: can\'t get selected team index, cancel action');
            return [];
        }
        const girls = [...unsafeWindow.teams_data[selectedTeam].girls];
        if (girls.length != 7) {
            logHHAuto('Error: can\'t get all team members, cancel action');
            return [];
        }
        logHHAuto('Selected team: ' + selectedTeam + ', Team members to equip: ' + girls.map(girl => girl.girl.name).join(', '));
        return girls;
    }

    static assignTopTeam() {
        setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
        logHHAuto("setting autoloop to false");
        function selectFromHaremBest(i, best) {
            let girlToSelect = best ? i : i + 7;
            //console.log(i,girlToSelect,best);
            let selectedGirl = $('#contains_all section ' + ConfigHelper.getHHScriptVars("IDpanelEditTeam") + ' .harem-panel .panel-body .topNumber[position="' + girlToSelect + '"]');
            selectedGirl.click();
            //console.log(selectedGirl);
            if ($('.topNumber').length > girlToSelect && i < 7) {
                setTimeout(function () { assignToTeam(i + 1, best) }, randomInterval(300, 600));
            }
            else {
                if (!best) {
                    assignToTeam(1, true);
                }
                else {
                    TeamModule.validateTeam();
                }
            }

        }

        function assignToTeam(i = 1, best = false) {
            let position = i - 1;
            let selectedPosition = $('#contains_all section .player-panel .player-team .team-hexagon .team-member-container.selectable[data-team-member-position="' + position + '"]');
            selectedPosition.click();
            //console.log(selectedPosition);
            setTimeout(function () { selectFromHaremBest(i, best) }, randomInterval(300, 600));

        }

        let topNumbers = $('.topNumber')
        if (topNumbers.length > 0) {
            TeamModule.resetTeam();
            assignToTeam(1, true); // true = jump to best team directly
        }
    }

    static setTopTeam(sumFormulaType: number) {
        const availableGirls = getHHVars("availableGirls", false);

        if (availableGirls && Array.isArray(availableGirls) && availableGirls.length > 0) {
            TeamModule.setTopTeamV2(sumFormulaType as ScoringMode, availableGirls);
        } else {
            logHHAuto('availableGirls not found, falling back to legacy team selection');
            TeamModule.setTopTeamLegacy(sumFormulaType);
        }
    }

    private static setTopTeamV2(mode: ScoringMode, availableGirls: any[]) {
        const playerLevel = Number(HeroHelper.getLevel());

        // Map availableGirls to GirlData interface
        const girls: GirlData[] = availableGirls.map(g => ({
            id_girl: Number(g.id_girl),
            name: g.name || '',
            carac1: Number(g.carac1 || 0),
            carac2: Number(g.carac2 || 0),
            carac3: Number(g.carac3 || 0),
            level: Number(g.level || 1),
            element: (g.element_data?.type || g.element || 'fire') as ElementType,
            rarity: (g.rarity || 'common') as any,
            graded: Number(g.graded || 0),
            nb_grades: Number(g.nb_grades || 0),
            caracs: g.caracs ? {
                carac1: Number(g.caracs.carac1 || 0),
                carac2: Number(g.caracs.carac2 || 0),
                carac3: Number(g.caracs.carac3 || 0),
            } : undefined,
            skill_tiers_info: g.skill_tiers_info,
        }));

        const result = TeamBuilderService.buildTeam(girls, mode, playerLevel);

        if (!result) {
            logHHAuto('Not enough girls for team selection v2 (mode ' + mode + '), falling back to legacy');
            TeamModule.setTopTeamLegacy(mode);
            return;
        }

        const deckID = result.girls.map(g => g.id_girl);
        const modeName = mode === 1 ? 'Current Best' : 'Best Possible';
        const dist = TeamBuilderService.getElementDistribution(result);
        const distStr = dist.map(d => `${d.count}x ${d.element}`).join(', ');
        logHHAuto(`Team v2 [${modeName}]: Leader=${result.girls[0].name} (${result.leaderTier5.name}), Elements: ${distStr}, Synergy: ${result.synergyValue.toFixed(3)}`);

        // UI update: same approach as legacy — hide non-selected, show + number selected
        TeamModule.updateTeamUI(deckID, result);
    }

    private static setTopTeamLegacy(sumFormulaType: number) {
        let arr = $('div[id_girl]');
        let numTop = 16;
        if (numTop > arr.length) numTop = arr.length;
        let deckID: number[] = [];
        let deckStat: number[] = [];
        for (let z = 0; z < numTop; z++) {
            deckID.push(-1);
            deckStat.push(-1);
        }
        let levelPlayer = Number(HeroHelper.getLevel());
        for (let i = arr.length - 1; i > -1; i--) {
            let gID = Number($(arr[i]).attr('id_girl'));
            const tooltipData = $('.girl_img', $(arr[i])).attr(<string>ConfigHelper.getHHScriptVars('girlToolTipData')) || '';
            if (tooltipData == '') {
                logHHAuto('ERROR, no girl information found');
                return;
            }
            let obj = JSON.parse(tooltipData);
            let tempGrades = obj.graded2;
            let countTotalGrades = (tempGrades.match(/<g/g) || []).length;
            let countFreeGrades = (tempGrades.match(/grey/g) || []).length;
            let currentStat = obj.caracs.carac1 + obj.caracs.carac2 + obj.caracs.carac3;
            if (sumFormulaType == 1) {
                currentStat = obj.caracs.carac1 + obj.caracs.carac2 + obj.caracs.carac3;
            } else if (sumFormulaType == 2) {
                currentStat = (obj.caracs.carac1 + obj.caracs.carac2 + obj.caracs.carac3) / obj.level * levelPlayer / (1 + 0.3 * (countTotalGrades - countFreeGrades)) * (1 + 0.3 * (countTotalGrades));
            }
            let lowNum = 0;
            let lowStat = deckStat[0];
            for (let j = 1; j < deckID.length; j++) {
                if (deckStat[j] < lowStat) {
                    lowNum = j;
                    lowStat = deckStat[j];
                }
            }
            if (lowStat < currentStat) {
                deckID[lowNum] = gID;
                deckStat[lowNum] = currentStat;
            }
        }
        let tmpID = 0;
        let tmpStat = 0;
        for (let i = 0; i < deckStat.length; i++) {
            for (let j = i; j < deckStat.length; j++) {
                if (deckStat[j] > deckStat[i]) {
                    tmpID = deckID[i];
                    tmpStat = deckStat[i];
                    deckID[i] = deckID[j];
                    deckStat[i] = deckStat[j];
                    deckID[j] = tmpID;
                    deckStat[j] = tmpStat;
                }
            }
        }

        TeamModule.updateTeamUI(deckID);
    }

    private static readonly ELEMENT_EMOJI: Record<string, string> = {
        fire: '🔥', water: '💧', nature: '🌿', stone: '🪨',
        sun: '☀️', darkness: '🌑', psychic: '🔮', light: '✨',
    };

    private static updateTeamUI(deckID: number[], teamResult?: TeamResult) {
        const arr = $('div[id_girl]');
        for (let i = arr.length - 1; i > -1; i--) {
            let gID = Number($(arr[i]).attr('id_girl'));
            if (!deckID.includes(gID)) {
                arr[i].style.display = "none";
            } else {
                arr[i].style.display = "";
            }
        }
        let mainTeamPanel = $(ConfigHelper.getHHScriptVars("IDpanelEditTeam") + ' .change-team-panel .panel-body > .harem-panel-girls');
        for (let j = 0; j < deckID.length; j++) {
            let newDiv;
            let arrSort = $('div[id_girl=' + deckID[j] + ']');
            if ($(arrSort[0]).find('.topNumber').length == 0) {
                newDiv = document.createElement("div");
                newDiv.className = "topNumber";
                arrSort[0].prepend(newDiv);
            } else {
                newDiv = $(arrSort[0]).find('.topNumber')[0];
            }
            $(arrSort[0]).find('.topNumber')[0];

            // Show position label with element emoji and leader skill
            if (teamResult && j < teamResult.girls.length) {
                const girl = teamResult.girls[j];
                const emoji = TeamModule.ELEMENT_EMOJI[girl.element] || '';
                if (j === 0) {
                    newDiv.innerText = `${emoji} ★ ${teamResult.leaderTier5.name}`;
                } else {
                    newDiv.innerText = `${j + 1} ${emoji}`;
                }
            } else {
                newDiv.innerText = j + 1;
            }

            newDiv.setAttribute('position', j + 1);
            newDiv.setAttribute("ondblclick", "window.location.href='/characters/" + deckID[j] + "'");
            mainTeamPanel.append(arrSort[0]);
        }

        // Show team synergy info panel
        $('.hhTeamSynergyInfo').remove();
        if (teamResult) {
            const dist = TeamBuilderService.getElementDistribution(teamResult);
            const distHtml = dist.map(d => {
                const emoji = TeamModule.ELEMENT_EMOJI[d.element] || '';
                return `${emoji}${d.count}`;
            }).join(' ');

            const synergyInfo = $(`<div class="hhTeamSynergyInfo" style="
                position: absolute; top: 60px; left: 50%; transform: translateX(-50%); width: 160px; z-index: 10;
                background: rgba(0,0,0,0.7); color: #fff; padding: 4px 8px;
                border-radius: 4px; font-size: 11px; line-height: 1.4;
            ">
                <div style="font-weight:bold; margin-bottom: 2px;">Team Synergy</div>
                <div>Leader: ${teamResult.leaderTier5.name} (${TeamModule.ELEMENT_EMOJI[teamResult.girls[0].element] || ''} ${teamResult.girls[0].element})</div>
                <div>Elements: ${distHtml}</div>
            </div>`);
            $("#contains_all section").append(synergyInfo);
        }

        if (document.getElementById("AssignTopTeam") !== null) {
            return;
        }
        else {
            let AssignTopTeam = '<div style="position: absolute;top: 92px;width:100px;z-index:10;margin-left:90px" class="tooltipHH"><span class="tooltipHHtext">' + getTextForUI("AssignTopTeam", "tooltip") + '</span><label style="font-size:small" class="myButton" id="AssignTopTeam">' + getTextForUI("AssignTopTeam", "elementText") + '</label></div>'
            $("#contains_all section " + ConfigHelper.getHHScriptVars("IDpanelEditTeam") + " .harem-panel .panel-body").append(AssignTopTeam);
            $("#AssignTopTeam").on("click", TeamModule.assignTopTeam);
        }
    }
}