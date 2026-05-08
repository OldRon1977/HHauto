// Labyrinth.ts -- Manages the labyrinth dungeon: floor navigation, team management,
// and timer tracking.
//
// The labyrinth is a multi-floor dungeon where the player progresses through
// rooms of enemies. This module handles navigating between floors, tracking
// remaining attempts and cooldowns, and coordinating with LabyrinthAuto.ts
// for the actual fight logic and RelicManager.ts for relic selection.
//
// Depends on: LabyrinthAuto.ts (auto-battle), RelicManager.ts (relic selection),
//             TeamModule.ts (team setup)
// Used by: Service/index.ts (main automation loop)
//
import {
    ConfigHelper,
    TimeHelper,
    convertTimeToInt,
    getPage,
    getStoredValue,
    getTextForUI,
    getTimeLeft,
    hhMenuSelect,
    randomInterval,
    setStoredValue
} from '../Helper/index';
import { logHHAuto, safeJsonParse } from '../Utils/index';
import { HHStoredVarPrefixKey, SK, TK } from '../config/index';
import {
    buildPathsFromMatrix,
    decideBetterOption,
    filterPathsWithTreasure,
    sortPathsByDifficulty as sortPathsByDifficultyPure,
} from './Labyrinth.pure';
import { RelicManager } from './RelicManager';

class LabyrinthOpponent{
    button: JQuery<HTMLElement> | null;
    cell: JQuery<HTMLElement> | null;
    type:string;
    isOpponent: boolean;
    opponentDifficulty: number;
    isTreasure: boolean;
    isShrine: boolean;
    isNext: boolean;
    power: number;
}

export class Labyrinth {
    static HAREM_SELECTED_GIRLS = '.harem-panel-girls .harem-girl-container.selected'; // in my squad
    static BUILD_BUTTON_ID = 'hhAutoLabyTeam';

    static isEnabled(){
        return ConfigHelper.getHHScriptVars("isEnabledLabyrinth",false); // more than 14 girls
    }
    static isEnded(){
        return $('.cleared-labyrinth-container').length > 0;
    }

    static getPinfo() {
        return '<li>' + getTextForUI("autoLabyrinthTitle", "elementText") + ' : ' + getTimeLeft('nextLabyrinthTime') + '</li>';
    }

    static getCurrentFloorNumber(): number {
        const floorDom = $('#labyrinth-tabs .tab-switcher-fade-in .floor-number-text');
        let floor = 0;
        if (floorDom.length > 0) {
            floor = Number($('#labyrinth-tabs .tab-switcher-fade-in .floor-number-text').text());
            if (isNaN(floor) || floor === 0) {
                logHHAuto("Error getting floor");
                floor = 0;
            }
        }
        return floor;
    }
    
    static getRemainingNumberOfGirl(): number {
        return $('.harem-panel-girls .harem-girl-container').length;
    }

    static moduleBuildTeam():void{
        const customTeamBuilder = getStoredValue(HHStoredVarPrefixKey + SK.autoLabyCustomTeamBuilder) == "true";
        if (customTeamBuilder && $(`.${Labyrinth.BUILD_BUTTON_ID}`).length == 0) {
            const divButtons = $('<div style="position:absolute;left:-55px;top:-310px;width:150%;display:flex;gap:4px;z-index:1"></div>');


            const options = '<option value="1">Tank</option><option value="2">Mage</option><option value="3">Attack</option>';
            ['Back', 'Mid', 'Front'].forEach((value, index) => {
                const select = hhMenuSelect('autoLabyrinthBuild' + value, '', options);
                divButtons.append(select);
            });

            ['Team'/*, 'Tank', 'Mage', 'Attack'*/].forEach((value, index) => {
                const button = $(`<button id="${Labyrinth.BUILD_BUTTON_ID + value}" class="blue_button_L ${Labyrinth.BUILD_BUTTON_ID}" style="padding: 5px;flex-grow: 1;"></button>`);
                button.text(getTextForUI("autoLabyrinthBuild" + value, "elementText"));
                button.on('click', Labyrinth._buildTeam);
                divButtons.append(button);
            });
            

            $('#edit-team-page .boss-bang-panel').append(divButtons);
            ['Front', 'Mid', 'Back'].forEach((value, index) => {
                $('#autoLabyrinthBuild' + value).val((index + 1)+ '').trigger('change');
            });

            GM_registerMenuCommand(getTextForUI("autoLabyrinthBuildTeam", "elementText"), Labyrinth._buildTeam);
        }
    }

    static async _removeLowPowerGirls(){
        const lowPowerGirls = Labyrinth.getLowPowerTeamMember();
        if (lowPowerGirls.length > 0) {
            try {
                const freeGirls = Labyrinth.getHaremGirl(0, true, lowPowerGirls.length);

                for (let i = 0; i < lowPowerGirls.length; i++) {
                    lowPowerGirls[i].trigger('click');
                    await TimeHelper.sleep(randomInterval(400, 700));
                    freeGirls[i].trigger('click');
                    await TimeHelper.sleep(randomInterval(400, 700));
                }
            } catch (err) {
                logHHAuto('Error during changing low power girls');
            }
        }
    }

    static async _buildTeam() {
        // Girl position
        //   1
        // 6   2
        //   0
        // 5   3
        //   4

        setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
        logHHAuto("setting autoloop to false");

        $(`.${Labyrinth.BUILD_BUTTON_ID}`).attr('disabled','disabled');
        if ($(Labyrinth.HAREM_SELECTED_GIRLS).length == 0) {
            $('#auto-fill-team:not([disabled])').trigger('click');
            await TimeHelper.sleep(randomInterval(200, 500));
        }

        // await Labyrinth._removeLowPowerGirls();

        const girlClassFront = Number($('#autoLabyrinthBuildFront').val());
        const frontGirls = Labyrinth.getHaremGirl(girlClassFront);
        let frontGirlIndex = 0;
        if (frontGirls.length >= 2) {
            // await Labyrinth._buildTwoGirlsRow(2, 3, frontGirls[frontGirlIndex++], frontGirls[frontGirlIndex++]);
        }
        if (frontGirls.length >= 1) await Labyrinth._selectGirl(2, frontGirls[frontGirlIndex++]);
        if (frontGirls.length >= 2) await Labyrinth._selectGirl(3, frontGirls[frontGirlIndex++]);

        const girlClassMid = Number($('#autoLabyrinthBuildMid').val());
        const midGirls = Labyrinth.getHaremGirl(girlClassMid, false, 5);
        let midGirlIndex = girlClassMid == girlClassFront ? frontGirlIndex : 0;
        if (midGirls.length >= (midGirlIndex + 1)) await Labyrinth._selectGirl(1, midGirls[midGirlIndex++]);
        if (midGirls.length >= (midGirlIndex + 1)) await Labyrinth._selectGirl(0, midGirls[midGirlIndex++]);
        if (midGirls.length >= (midGirlIndex + 1)) await Labyrinth._selectGirl(4, midGirls[midGirlIndex++]);

        const girlClassBack = Number($('#autoLabyrinthBuildBack').val());
        const backGirls = Labyrinth.getHaremGirl(girlClassBack, false, 7);
        let backGirlIndex = girlClassBack == girlClassMid ? midGirlIndex : girlClassBack == girlClassFront ? frontGirlIndex : 0;
        if (backGirls.length >= (backGirlIndex+2)) {
            //await Labyrinth._buildTwoGirlsRow(5, 6, backGirls[backGirlIndex++], backGirls[backGirlIndex++]);
        }
        if (backGirls.length >= (backGirlIndex + 1)) await Labyrinth._selectGirl(5, backGirls[backGirlIndex++]);
        if (backGirls.length >= (backGirlIndex + 1)) await Labyrinth._selectGirl(6, backGirls[backGirlIndex++]);

        $(`.${Labyrinth.BUILD_BUTTON_ID}`).removeAttr('disabled');

        setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "true");
        logHHAuto("setting autoloop to true");
    }

    static isSelectedGirl(girlId: string, position = 0) {
        if (position > 0) {
            return $(`.player-panel .team-hexagon .team-member-container[data-girl-id="${girlId}"][data-team-member-position="${position}"]`).length > 0;
        } else {
            return $(`.player-panel .team-hexagon .team-member-container[data-girl-id="${girlId}"]`).length > 0;
        }
    }

    static async _selectGirl(girlPosition: number, girlToBeSelected: JQuery<HTMLElement>) {
        const girl = $('.team-hexagon .team-member-container.selectable[data-team-member-position="' + girlPosition + '"]');
        if (girl.attr('data-girl-id') != girlToBeSelected.attr('id_girl')) {
            girl.trigger('click');
            await TimeHelper.sleep(randomInterval(400, 700));
            girlToBeSelected.trigger('click');
            await TimeHelper.sleep(randomInterval(400, 700));
        }
    }

    static async _buildTwoGirlsRow(posOne: number, posTwo: number, girlOne: JQuery<HTMLElement>, girlTwo: JQuery<HTMLElement>){
        const girlOneId = girlOne.attr('id_girl');
        if (!Labyrinth.isSelectedGirl(girlOneId)) {
            await Labyrinth._selectGirl(posOne, girlOne);
            await Labyrinth._selectGirl(posTwo, girlTwo);
        } else if (Labyrinth.isSelectedGirl(girlOneId, posOne)) {
            await Labyrinth._selectGirl(posTwo, girlTwo);
        } else if (Labyrinth.isSelectedGirl(girlOneId, posTwo)) {
            await Labyrinth._selectGirl(posOne, girlTwo);
        }
    }

    static getHaremGirl(girlClass: number = 0, excludeSelected = false, numberOfGirls: number = 2): JQuery<HTMLElement>[] {
        const haremGirlSelector = '.harem-panel-girls .harem-girl-container' + (excludeSelected ? ':not(.selected)' : '');
        const hardCoreGirls = [];

        let girls = $(haremGirlSelector);
        for (let i = 0; i < girls.length && hardCoreGirls.length <= numberOfGirls; i++) {
            const tooltipData = $('.girl_img', $(girls[i])).attr(<string>ConfigHelper.getHHScriptVars('girlToolTipData')) || '';
            if (tooltipData == '') {
                logHHAuto('ERROR, no girl information found');
                continue;
            }
            const obj = safeJsonParse(tooltipData, null);
            if (obj === null) {
                logHHAuto('ERROR, failed to parse girl information');
                continue;
            }
            const remainingEgo = Number($('.ego-bar-container span', $(girls[i])).text().replace('%', ''))
            if ((girlClass == 0 || obj.class == girlClass) && remainingEgo > 50) {
                hardCoreGirls.push($(girls[i]));
            }
        }
        return hardCoreGirls;
    }

    static getLowPowerTeamMember(): JQuery<HTMLElement>[] {
        const teamGirlSelector = '.team-hexagon .team-member-container';
        const lowPowerGirls = [];

        let haremGirls = $(Labyrinth.HAREM_SELECTED_GIRLS);
        for (let i = 0; i < haremGirls.length; i++) {
            const id_girl = $(haremGirls[i]).attr('id_girl');

            const remainingEgo = Number($('.ego-bar-container span', $(haremGirls[i])).text().replace('%', ''))
            if (remainingEgo > 0 && remainingEgo < 30) {
                logHHAuto(`Adding low power girl ${id_girl}`);
                lowPowerGirls.push($(teamGirlSelector + '[data-girl-id="' + id_girl + '"]'));
            }
        }
        return lowPowerGirls;
    }

    static sim(){
        if(getPage() === ConfigHelper.getHHScriptVars("pagesIDLabyrinth"))
        {
            if ($('#labyrinth_reward_popup .relic-container').length > 0 && $('.relicChosen').length == 0) {
                /* Reward to be selected */
                const relicManager = new RelicManager();

                const relics = relicManager.parseRelics();
                if (relics.length > 1) {
                    logHHAuto("relics",relics);
                    const relic = relicManager.chooseRelic(relics);
                    logHHAuto("relic", relic);

                    GM_addStyle('.relicChosen {width: 25px; top: 0px; position: absolute; left: 197px;}');
                    relic.slot.append(`<img class="relicChosen" src=${ConfigHelper.getHHScriptVars("powerCalcImages").chosen}>`);
                }
            }

            if ($('.labChosen').length > 0 || Labyrinth.isEnded()) {
                return;
            }
            logHHAuto("On Labyrinth page.");

            GM_addStyle('.labChosen {width: 25px; top: 55px; position: relative; left: 35px;}');
            GM_addStyle('.pathChosen {border: 1px solid green; border-radius: 40px;}');
    
            const NB_ROW = 11;
            for(let rowIndex = 1; rowIndex <= NB_ROW; rowIndex++) {
                const row = $('#row_'+rowIndex+'.row-hex-container');
                const currentLevel = row.attr('key');
                const items = $('.hex-container:has(.hex-type:not(.completed-hex):not(.hero))', row);
    
                const options:LabyrinthOpponent[] = [];
                if (items.length > 0) {
                    $.each(items,(hexIndex,hex) => {
                        const option = Labyrinth.parseHex(hexIndex,hex);
                        options.push(option);
                    });
                }

                const choosenOption = Labyrinth.findBetter(options);
                
                if(choosenOption) {
                    logHHAuto("Row " + currentLevel + ". chosen " + JSON.stringify(choosenOption));
                    Labyrinth.appendChoosenTag(choosenOption);
                    break;
                }
            }

            const allPaths = Labyrinth.buildPath();
            const bestPath = allPaths.length > 0 ? allPaths[0] : [];
            Labyrinth.showPath(bestPath);

        }
    }

    static showPath(path: LabyrinthOpponent[]){
        if(getPage() === ConfigHelper.getHHScriptVars("pagesIDLabyrinth")) {
            path.forEach((opponent) => {
                if (!opponent.cell.hasClass('hero')) opponent.cell.addClass('pathChosen');
            });
        }
    }

    static buildPath(){
        const matrix: LabyrinthOpponent[][] = [];

        const NB_ROW = 11;
        for (let rowIndex = 1; rowIndex <= NB_ROW; rowIndex++) {
            matrix[rowIndex - 1] = [];
            const row = $('#row_' + rowIndex + '.row-hex-container');
            const items = $('.hex-container:has(.hex-type)', row);

            const options: LabyrinthOpponent[] = [];
            if (items.length > 0) {
                $.each(items, (hexIndex, hex) => {
                    const option = Labyrinth.parseHex(hexIndex, hex);
                    options.push(option);
                    matrix[rowIndex - 1].push(option);
                });
            }
        }
        // remove first empty rows
        //matrix.shift();
        


        let paths: LabyrinthOpponent[][] = Labyrinth.createPathFromMatrix(matrix);
        let pathsWithTreasuer: LabyrinthOpponent[][] = Labyrinth.filterPathWithNoTreasue(paths);
        if(pathsWithTreasuer.length > 0) {
            paths = pathsWithTreasuer;
        }
        paths = Labyrinth.sortPathsByDifficulty(paths);
        return paths;
    }

    static filterPathWithNoTreasue(paths: LabyrinthOpponent[][]): LabyrinthOpponent[][] {
        return filterPathsWithTreasure(paths);
    }

    static sortPathsByDifficulty(paths: LabyrinthOpponent[][]): LabyrinthOpponent[][] {
        return sortPathsByDifficultyPure(paths);
    }

    static createPathFromMatrix(matrix: LabyrinthOpponent[][]): LabyrinthOpponent[][] {
        return buildPathsFromMatrix(matrix);
    }

    static getResetTime() {
        const timerRequest = `.cleared-labyrinth-container:visible .labyrinth-timer span[rel=expires]`;

        if ($(timerRequest).length > 0) {
            const labyrinthTimer = Number(convertTimeToInt($(timerRequest).text()));
            //logHHAuto('labyrinthTimer', labyrinthTimer);
            return labyrinthTimer;
        }
        logHHAuto('ERROR: can\'t get labyrinth reset time, default to maxCollectionDelay');
        return ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60, 180);
    }

    static findBetter(options: LabyrinthOpponent[]): LabyrinthOpponent{
        const chooseMoreReward = getStoredValue(HHStoredVarPrefixKey + SK.autoLabyHard) == "true";
        const haveGirlWounded = unsafeWindow.girl_squad.filter(girl => girl.remaining_ego_percent < 100).length > 0;
        const debugEnabled = getStoredValue(HHStoredVarPrefixKey + TK.Debug) === 'true';
        if (debugEnabled) logHHAuto("Options " + JSON.stringify(options));
        if (debugEnabled) logHHAuto("haveGirlWounded " + haveGirlWounded);
        if (debugEnabled) logHHAuto("chooseMoreReward " + chooseMoreReward);

        const liteOptions = options.map(option => ({
            opponentDifficulty: option.opponentDifficulty,
            isTreasure: option.isTreasure,
            isShrine: option.isShrine,
            isNext: option.isNext,
            isOpponent: option.isOpponent,
            power: option.power,
            hasButton: option.button !== null && option.button !== undefined,
            __orig: option,
        }));
        const chosen = decideBetterOption({
            options: liteOptions,
            chooseMoreReward,
            haveGirlWounded,
            floor: Labyrinth.getCurrentFloorNumber(),
        });
        if (debugEnabled) logHHAuto("Options after filter (handled by Labyrinth.pure)");
        return chosen === null ? null as unknown as LabyrinthOpponent : (chosen as { __orig: LabyrinthOpponent }).__orig;
    }

    static appendChoosenTag(option){
        option.button.append(`<img class="labChosen" src=${ConfigHelper.getHHScriptVars("powerCalcImages").chosen}>`);
    }

    static parseHex(hexIndex,hex): LabyrinthOpponent
    {
        // opponent_super_easy / opponent_easy / opponent_medium  / opponent_hard / opponent_boss  
        // shrine / treasure
        const type = $('.clickable-hex', hex).attr('hex_type') 
                    || ($('.hex-type', hex).attr('class') || '').replace('hex-type', '').replace('upcoming-hex', '').trim();
        const button = $('.clickable-hex', hex);
        const opponentDifficultyList = ['opponent_super_easy','opponent_easy','opponent_medium','opponent_hard','opponent_boss'];
        let opponentDifficulty = 0;
        for(let i=0; i<opponentDifficultyList.length; i++) {
            if(type.indexOf(opponentDifficultyList[i]) >=0) {
                opponentDifficulty = i;
            }
        }
        if (type.indexOf('treasure') >= 0) {
            opponentDifficulty = -3;
        }

        return {
            button: button.length > 0 ? button.first() : null,
            cell: $('.hex-type', hex).first(),
            type: type,
            isOpponent: type.indexOf('opponent_') >= 0,
            opponentDifficulty: opponentDifficulty,
            isTreasure: type.indexOf('treasure') >= 0,
            isShrine: type.indexOf('shrine') >= 0,
            isNext: type.indexOf('upcoming-hex') < 0,
            power: Number($('.opponent-power .opponent-power-text', hex).attr('data-power'))
        };
    }
}