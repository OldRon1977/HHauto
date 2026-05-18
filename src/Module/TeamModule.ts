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
import { ConfigHelper } from "../Helper/ConfigHelper";
import { HeroHelper, getHero } from "../Helper/HeroHelper";
import { getHHVars } from "../Helper/HHHelper";
import { hhButton, hhMenuSwitch } from "../Helper/HHMenuHelper";
import { getTextForUI } from "../Helper/LanguageHelper";
import { getPage } from "../Helper/PageHelper";
import { setStoredValue } from "../Helper/StorageHelper";
import { randomInterval } from "../Helper/TimeHelper";
import { addNutakuSession, gotoPage } from '../Service/PageNavigationService';
import { TeamBuilderService, ScoringMode, TeamResult } from '../Service/TeamBuilderService';
import { BlessingService } from '../Service/BlessingService';
import { GirlData, ElementType, PlayerClass } from '../Service/TeamScoringService';
import { TraitMappings } from '../Service/TraitMappings';
import { fillHHPopUp } from "../Utils/HHPopup";
import { logHHAuto } from "../Utils/LogUtils";
import { getHHAjax } from "../Utils/Utils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { TK } from "../config/StorageKeys";
import { KKTeamGirl } from "../model/KK/KKTeamGirl";
import { TeamData } from "../model/TeamData";
import { Harem } from "./harem/Harem";
import { HaremGirl } from "./harem/HaremGirl";

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
            setTimeout(function () { assignToTeam(1, true); }, randomInterval(300, 600)); // wait for clear-team UI to settle before assigning
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
        const rawClass = Number(HeroHelper.getClass());
        const playerClass: PlayerClass = (rawClass === 1 || rawClass === 2 || rawClass === 3) ? rawClass as PlayerClass : 1;

        // Map availableGirls to GirlData interface
        const girls: GirlData[] = availableGirls.map(g => ({
            id_girl: Number(g.id_girl),
            name: g.name || '',
            carac1: Number(g.carac1 || 0),
            carac2: Number(g.carac2 || 0),
            carac3: Number(g.carac3 || 0),
            level: Number(g.level || 1),
            class: typeof g.class === 'number' ? g.class : undefined,
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
            // Keep raw zodiac glyph; TraitMappings.resolveZodiac strips it for display
            zodiac: g.zodiac || undefined,
            hairColor: g.hair_color1 || undefined,
            eyeColor: g.eye_color1 || undefined,
            position: g.position_img ? String(g.position_img).replace('.png', '') : undefined,
            blessingBonuses: g.blessing_bonuses || undefined,
            // Pass through can_be_blessed so detectActiveBlessings has
            // an authoritative blessed-or-not flag (issue 1679 phase 2).
            // The flag is added as a non-typed bonus property; the type
            // signature stays GirlData.
            ...(typeof g.can_be_blessed === 'boolean' ? { can_be_blessed: g.can_be_blessed } : {}),
            ...(typeof g.can_be_blessed_pvp4 === 'boolean' ? { can_be_blessed_pvp4: g.can_be_blessed_pvp4 } : {}),
        }) as GirlData);

        // Build BOTH modes so we can detect when "Best Possible" produces
        // the same team as "Current Best" — this happens when the top 7
        // girls are already at full development potential (max level + max
        // grades). We then surface that fact in the info box instead of
        // letting the user think the buttons are broken (issue #1603).
        const resultMode1 = TeamBuilderService.buildTeam(girls, 1, playerLevel, playerClass);
        const resultMode2 = TeamBuilderService.buildTeam(girls, 2, playerLevel, playerClass);
        const result = mode === 1 ? resultMode1 : resultMode2;

        if (!result) {
            logHHAuto('Not enough girls for team selection v2 (mode ' + mode + '), falling back to legacy');
            TeamModule.setTopTeamLegacy(mode);
            return;
        }

        // Mode-diff detection: identical top-7 (any order) means the pool
        // is already maximised and Best Possible cannot improve on Current
        // Best. We set this flag on BOTH results so the UI can show it
        // regardless of which mode the user clicked.
        let modesIdentical = false;
        if (resultMode1 && resultMode2) {
            const ids1 = new Set(resultMode1.girls.map(g => g.id_girl));
            const ids2 = new Set(resultMode2.girls.map(g => g.id_girl));
            modesIdentical = ids1.size === ids2.size && [...ids1].every(id => ids2.has(id));
        }
        (result as any).modesIdentical = modesIdentical;

        // Remember main sum per mode so the info box can show a
        // mode-vs-mode delta (Current Best vs Best Possible). The
        // previous-call sum is persisted on the class until reload.
        const previousMainSumOtherMode = TeamModule.lastMainSum[mode === 1 ? 2 : 1];
        const previousMainSumSameMode = TeamModule.lastMainSum[mode];
        TeamModule.lastMainSum[mode] = result.mainSum;
        // Stash delta context on the result so updateTeamUI can render it.
        (result as any).previousMainSumSameMode = previousMainSumSameMode;
        (result as any).previousMainSumOtherMode = previousMainSumOtherMode;
        (result as any).currentModeName = mode === 1 ? 'Current Best' : 'Best Possible';
        (result as any).otherModeName = mode === 1 ? 'Best Possible' : 'Current Best';

        // poolStats is built by TeamBuilderService and exposed on the
        // result. Read it for the info box (no recomputation here).

        const deckID = result.girls.map(g => g.id_girl);
        const modeName = mode === 1 ? 'Current Best' : 'Best Possible';
        const dist = TeamBuilderService.getElementDistribution(result);
        const distStr = dist.map(d => `${d.count}x ${d.element}`).join(', ');
        const inClusterStr = result.leaderInCluster ? 'in-cluster' : 'cross-cluster';
        const identStr = modesIdentical ? ', modes identical' : '';
        const playerClassNameLog = TeamModule.PLAYER_CLASS_NAME[result.playerClass] || ('class ' + result.playerClass);
        const mainCaracLabel = result.playerClass === 1 ? 'carac1' : (result.playerClass === 2 ? 'carac2' : 'carac3');
        const synStr = (result.elementSynergyMultiplier * 100).toFixed(1);
        const ldrStr = (result.leaderBonus * 100).toFixed(0);
        const epStr = result.effectivePower.toLocaleString();
        const ps = result.poolStats;
        const psStr = ps ? `pool: ${ps.ownClass}/own (${ps.ownClassMythics} M, ${ps.ownClassMythicsAtCap} cap, ${ps.ownClassMythicsBlessed} blessed)` : '';
        const leaderReasonStr = result.leaderReason ? `, LeaderReason="${result.leaderReason}"` : '';
        // Mode 2 = "Best Possible at full development": ProjectedSum is the
        // headline value because the user picks girls to develop (mainSum
        // is intentionally lower since some picks are still levelling up).
        // Mode 1 = "Current Best": mainSum is the headline.
        const sumLabel = mode === 2
            ? `ProjSum=${result.projectedSum.toLocaleString()}, MainSum=${result.mainSum.toLocaleString()}`
            : `MainSum=${result.mainSum.toLocaleString()}, ProjSum=${result.projectedSum.toLocaleString()}`;
        logHHAuto(`Team v2 [${modeName}]: Class=${playerClassNameLog} (${mainCaracLabel}), EffPower=${epStr}, ${sumLabel}, Synergy=${synStr}%, Tier3=${(result.tier3Bonus * 100).toFixed(1)}%, LeaderBonus=${ldrStr}%, Leader=${result.girls[0].name} (${result.leaderTier5.name}, ${result.girls[0].rarity}, ${inClusterStr})${leaderReasonStr}, Trait: ${result.traitCategory}=${result.traitValue} (${result.traitMatchCount}/7), Elements: ${distStr}, ${psStr}${identStr}`);

        // Per-slot detail line for diagnosis: tells the issue reporter
        // exactly which 7 girls were picked, with level/awakening/grades/score
        // and any active blessing percent. Cross-checks against the game UI
        // and against the pool stats above.
        if (result.slotInfo && result.slotInfo.length > 0) {
            const slotsStr = result.slotInfo.map((s, i) => {
                const blStr = s.blessingPercents.length > 0 ? ` +${s.blessingPercents.join('/')}%` : '';
                const tvStr = s.traitValue ? ` tv=${s.traitValue}` : '';
                const cl = s.inCluster ? '*' : '';
                return `[${i + 1}${cl}] ${s.name} (${s.rarity}/${s.element} lvl${s.level} aw${s.awakening_level ?? '?'} ${s.graded}/${s.nb_grades}${tvStr}${blStr} score=${Math.round(s.score)})`;
            }).join(' | ');
            logHHAuto(`Team v2 [${modeName}] slots: ${slotsStr}`);
        }

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

    private static readonly TRAIT_EMOJI: Record<string, string> = {
        eyeColor: '👁', hairColor: '💇', zodiac: '♋', position: '🔄',
    };

    private static readonly CLASS_NAME: Record<string, string> = {
        fire: 'Eccentric', water: 'Sensual', nature: 'Exhibitionist', stone: 'Physical',
        sun: 'Playful', darkness: 'Dominatrix', psychic: 'Submissive', light: 'Voyeur',
    };

    private static readonly PLAYER_CLASS_NAME: Record<number, string> = {
        1: 'Hardcore',
        2: 'Charm',
        3: 'Know-how',
    };

    /**
     * Last MainSum per mode, kept in memory so the info box can show
     * "+X% vs Current Best / Best Possible" when the user clicks the
     * other mode button. Cleared on page reload.
     */
    private static lastMainSum: { [mode: number]: number } = {};

    private static updateTeamUI(deckID: number[], teamResult?: TeamResult) {
        const arr = $('div[id_girl]');
        // Remove all existing topNumber elements to prevent stale entries
        // from a previous team calculation (e.g. Current Best) interfering
        // with the current one (e.g. Best Possible) during assignTopTeam.
        $('.topNumber').remove();

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

        // Show team selection info panel
        $('.hhTeamSynergyInfo').remove();
        if (teamResult) {
            const dist = TeamBuilderService.getElementDistribution(teamResult);
            const distHtml = dist.map(d => {
                const className = TeamModule.CLASS_NAME[d.element] || d.element;
                return `${className} x${d.count}`;
            }).join(', ');

            const traitEmoji = TeamModule.TRAIT_EMOJI[teamResult.traitCategory] || '';
            const tier3Pct = (teamResult.tier3Bonus * 100).toFixed(1);
            const playerClassName = TeamModule.PLAYER_CLASS_NAME[teamResult.playerClass] || ('class ' + teamResult.playerClass);

            // Resolve trait value to a human label
            const traitResolved = TraitMappings.resolve(teamResult.traitCategory, teamResult.traitValue);
            const traitDisplay = traitResolved.label;
            const traitFromRuntime = traitResolved.fromRuntime;

            // Use cached blessings from BlessingService (loaded on Home page)
            let cachedBlessings: any = null;
            try { cachedBlessings = BlessingService.getCached(); } catch { /* cache not ready */ }
            const blessedVals = cachedBlessings?.blessedValues || {};
            const blessedStr = cachedBlessings && cachedBlessings.blessedTraits.length > 0
                ? cachedBlessings.blessedTraits.map((c: string) => (TeamModule.TRAIT_EMOJI[c] || '') + ' ' + c + (blessedVals[c] ? '=' + blessedVals[c] : '')).join(', ')
                    + (cachedBlessings.blessedElement ? ' + ' + (TeamModule.CLASS_NAME[cachedBlessings.blessedElement] || cachedBlessings.blessedElement) : '')
                : (cachedBlessings ? 'none parsed (check logs)' : 'not loaded yet (visit Home)');
            const blessedIsActive = cachedBlessings && cachedBlessings.blessedTraits.includes(teamResult.traitCategory);
            const blessedValueMatch = blessedIsActive && blessedVals[teamResult.traitCategory] && traitDisplay.toLowerCase() === blessedVals[teamResult.traitCategory].toLowerCase();
            const blessedNote = blessedValueMatch ? ' (PERFECT match!)' : (blessedIsActive ? ' (category match, value differs)' : (cachedBlessings ? ' (not matching)' : ''));

            const mainCaracLabel = teamResult.playerClass === 1 ? 'carac1' : (teamResult.playerClass === 2 ? 'carac2' : 'carac3');

            // Class explainer: show why only own-class girls are used,
            // including pool size and per-class breakdown of what gets
            // filtered out. Cross-class girls are intentionally never
            // considered because the league/season formulas reward only
            // the player's main class carac, so the script optimizes for
            // that single stat (Performance Handbook, Slynia 2021;
            // Wiki: 'never build cross-class').
            const poolStats = teamResult.poolStats;
            let classExplainerHtml = '';
            if (poolStats) {
                const otherClassParts: string[] = [];
                for (const c of [1, 2, 3]) {
                    if (c === teamResult.playerClass) continue;
                    const n = poolStats.otherClass[c];
                    if (!n) continue;
                    otherClassParts.push(`${n} ${TeamModule.PLAYER_CLASS_NAME[c] || ('class ' + c)}`);
                }
                const otherTotal = otherClassParts.length > 0 ? ' (skipped: ' + otherClassParts.join(', ') + ')' : '';
                const atCap = (poolStats as any).ownClassMythicsAtCap;
                const blessedM = (poolStats as any).ownClassMythicsBlessed;
                const mythicDetail = (typeof atCap === 'number' && typeof blessedM === 'number')
                    ? `${poolStats.ownClassMythics} mythic (${atCap} at level cap, ${blessedM} blessed)`
                    : `${poolStats.ownClassMythics} mythic`;
                classExplainerHtml = `<br/><span style="color:#bbb; font-size:10px;">Eligible pool: <b>${poolStats.ownClass}</b> ${playerClassName} girls (Mythic + Legendary 5*), of which ${mythicDetail}. Cross-class girls ignored${otherTotal} -- league math rewards only your main class stat (${mainCaracLabel}), so cross-class girls cannot win on the metric that counts.</span>`;
                if (poolStats.ownClass < 7) {
                    classExplainerHtml += `<br/><span style="color:#fc6; font-size:10px;"><b>WARNING:</b> Fewer than 7 own-class Mythic/Legendary-5* girls available. Script falls back to legacy team selection (no Tier-3 / cluster optimization). Build up your ${playerClassName} roster to enable the full algorithm.</span>`;
                }
            }

            // Read delta info that setTopTeamV2 attached to the result
            // (previous mainSum for the same mode or the other mode, if any).
            const fmtPct = (current: number, prev: number): string => {
                if (!prev || prev === current) return '';
                const diff = current - prev;
                const pct = (diff / prev) * 100;
                const sign = diff >= 0 ? '+' : '';
                const colour = diff >= 0 ? '#7f7' : '#f77';
                return `<span style="color:${colour}; font-size:10px;"> (${sign}${diff.toLocaleString()}, ${sign}${pct.toFixed(1)}%)</span>`;
            };
            const prevSame = (teamResult as any).previousMainSumSameMode as number | undefined;
            const prevOther = (teamResult as any).previousMainSumOtherMode as number | undefined;
            const currentModeName = (teamResult as any).currentModeName as string | undefined;
            const otherModeName = (teamResult as any).otherModeName as string | undefined;
            let mainSumDeltaHtml = '';
            if (prevSame && prevSame !== teamResult.mainSum && currentModeName) {
                mainSumDeltaHtml += ' ' + fmtPct(teamResult.mainSum, prevSame) + ` vs previous ${currentModeName}`;
            }
            if (prevOther && otherModeName) {
                mainSumDeltaHtml += ' ' + fmtPct(teamResult.mainSum, prevOther) + ` vs ${otherModeName}`;
            }

            // Mythic audit (issue #1573, #1603): show every mythic in the
            // player's class with its team status. Excluded mythics get a
            // reason so the user can confirm whether the algorithm or the
            // data is at fault.
            const auditEntries = teamResult.mythicAudit || [];
            const auditInTeam = auditEntries.filter((e: any) => e.status !== 'excluded');
            const auditExcluded = auditEntries.filter((e: any) => e.status === 'excluded');
            const auditTotalLine = `${auditEntries.length} mythics in your harem (player class): ${auditInTeam.length} in team, ${auditExcluded.length} excluded`;
            const formatBlessingHint = (e: any): string => {
                if (!e.blessingPercents || e.blessingPercents.length === 0) return '';
                return ' <span style="color:#9f9;">+' + e.blessingPercents.join('/') + '%</span>';
            };
            const auditExcludedHtml = auditExcluded.length > 0
                ? '<div style="color:#aaa; font-size:10px; margin-top:2px; max-height:120px; overflow-y:auto; border:1px solid #444; padding:3px;">'
                    + '<b>Excluded mythics:</b><br/>'
                    + auditExcluded.slice(0, 20).map((e: any) => `&bull; ${e.name} (${e.element}, stat=${Math.round(e.mainCarac)}${formatBlessingHint(e)}): ${e.reason || 'unknown'}`).join('<br/>')
                    + (auditExcluded.length > 20 ? `<br/>... and ${auditExcluded.length - 20} more` : '')
                    + '</div>'
                : '';

            const altsHtml = teamResult.alternatives && teamResult.alternatives.length > 1
                ? '<b>Compared:</b> ' + teamResult.alternatives.map((a: { traitCategory: string; traitValue: string; effectivePower: number }) => {
                        const r = TraitMappings.resolve(a.traitCategory as any, a.traitValue);
                        return a.traitCategory + '=' + r.label + ' (' + a.effectivePower.toLocaleString() + ')';
                    }).join(' | ')
                : '';

            const fallbackNote = traitFromRuntime ? '' : '<div style="color:#fc6; font-size:10px;">Trait label uses fallback dictionary (game runtime not yet loaded -- may be inaccurate for new color codes).</div>';

            const leaderClassName = TeamModule.CLASS_NAME[teamResult.girls[0].element] || teamResult.girls[0].element;
            const leaderClusterNote = teamResult.leaderInCluster
                ? ''
                : '<div style="color:#fc6; font-size:10px;">Leader is from a different element pair than positions 2-7. The cluster constraint applies to slots 2-7 only; the leader is picked globally by tier-5 priority (Shield &gt; Stun &gt; Execute &gt; Reflect).</div>';
            const modesIdenticalNote = (teamResult as any).modesIdentical
                ? '<div style="color:#fc6; font-size:10px;">Best Possible matches Current Best -- your top 7 girls are already at full development potential (max level + max grades).</div>'
                : '';

            const synergyInfo = $(`<div class="hhTeamSynergyInfo" style="
                position: absolute; top: 60px; left: 50%; transform: translateX(-50%); width: 320px; z-index: 10;
                background: rgba(0,0,0,0.85); color: #fff; padding: 6px 10px;
                border-radius: 4px; font-size: 11px; line-height: 1.5;
            ">
                <div style="font-weight:bold; margin-bottom: 3px; color: #ffb827;">Team Selection Info</div>
                <div style="color:#aaa; font-size:10px; margin-bottom:3px;">Class: <b>${playerClassName}</b> ${classExplainerHtml}</div>

                <div style="color:#ffb827; font-weight:bold; margin-top:4px;">Leader (Position 1)</div>
                <div><b>${teamResult.girls[0].name}</b> (${teamResult.leaderTier5.name} / ${leaderClassName}, ${teamResult.girls[0].rarity})</div>
                <div style="color:#aaa; font-size:10px;">Picked by tier-5 priority Shield &gt; Stun &gt; Execute &gt; Reflect, then mainCarac (Variante C).</div>
                ${teamResult.leaderReason ? `<div style="color:#fc6; font-size:10px;"><b>Leader is not Mythic Shield:</b> ${teamResult.leaderReason}.</div>` : ''}
                ${leaderClusterNote}

                <div style="color:#ffb827; font-weight:bold; margin-top:4px;">Cluster (Positions 2-7)</div>
                <div><b>Trait optimized:</b> ${traitEmoji} ${teamResult.traitCategory} = "${traitDisplay}" (${teamResult.traitMatchCount}/7 girls match)</div>
                <div style="color:#aaa; font-size:10px;">Tier 3 gives +stat% per teammate sharing this trait</div>
                <div><b>Tier 3 bonus:</b> +${tier3Pct}% total stat boost</div>
                <div><b>Elements:</b> ${distHtml}</div>
                <div><b>Effective Power:</b> ${teamResult.effectivePower?.toLocaleString() || 'N/A'}</div>
                ${currentModeName === 'Best Possible' ? `
                <div><b>Projected Sum (${mainCaracLabel} at full development):</b> ${teamResult.projectedSum?.toLocaleString() || 'N/A'}</div>
                <div style="color:#aaa; font-size:10px;">Mode 2 headline: total stat value when every picked girl is fully awakened (level 750, max grades). Picks may currently be at lower stats; develop them to reach this potential.</div>
                <div><b>Main Sum now:</b> ${teamResult.mainSum?.toLocaleString() || 'N/A'}${mainSumDeltaHtml}</div>
                ` : `
                <div><b>Main Sum (${mainCaracLabel}):</b> ${teamResult.mainSum?.toLocaleString() || 'N/A'}${mainSumDeltaHtml}</div>
                <div style="color:#aaa; font-size:10px;">Sum of your main class stat across the 7 picked girls. League-relevant headline number.</div>
                <div><b>Projected Sum:</b> ${teamResult.projectedSum?.toLocaleString() || 'N/A'} <span style="color:#aaa; font-size:10px;">(if all girls were at level 750 with max grades)</span></div>
                `}

                <hr style="border-color:#555; margin:4px 0"/>
                <div style="color:#ffb827; font-weight:bold;">Mythic Audit</div>
                <div style="color:#aaa; font-size:10px;">${auditTotalLine}</div>
                ${auditExcludedHtml}

                <hr style="border-color:#555; margin:4px 0"/>
                <div><b>Active Blessings:</b> ${blessedStr}${blessedNote}</div>
                <div style="color:#aaa; font-size:10px;">${cachedBlessings ? "Cache: " + new Date(cachedBlessings.timestamp).toLocaleString() : "No cache - go to Home page to load"}</div>
                ${altsHtml ? `<div style="color:#aaa; font-size:10px; margin-top:2px;">${altsHtml}</div>` : ''}
                ${fallbackNote}
                ${modesIdenticalNote}
                <hr style="border-color:#555; margin:4px 0"/>
                <div style="color:#fc6; font-size:10px;"><b>Note:</b> Stats are equipment-free. Hit "Stuff Team" after applying.</div>
                <div style="color:#aaa; font-size:10px; margin-top:2px;">Mode 1 (Current Best) uses today's stats, Mode 2 (Best Possible) projects to max level / grades.</div>
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