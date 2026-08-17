// HHMenuHelper.ts
//
// The HHAuto settings menu. Historically one ~1000-line class; split by
// responsibility into src/Helper/menu/ (WART-002, behavior-neutral):
//
//   - menu/MenuWidgets  — options rendering: labelled row builders (button,
//                         switch, select, input, image variants)
//   - menu/MenuTemplate — DOM construction (layout): the full #sMenu HTML
//   - menu/MenuSettings — settings binding: reading/writing stored settings
//                         from the menu inputs and wiring input events
//   - menu/MenuPorts    — dependency-injection ports that let the leaf menu
//                         files reach cycle-bound helpers without importing them
//
// This module keeps the pieces that are tightly bound to many feature modules
// (the toggle button + dynamic <select> population, section masking and the
// button colour state) and re-exports the extracted symbols so existing
// importers keep working.
//
// Used by: StartService (on init), AutoLoop (button state refresh),
// StorageHelper (getMenuValues), and feature modules that inject menu rows.

import { LABY_DIFFICULTY } from '../Module/LabyrinthDifficulty';
import { LEAGUE_SORT } from '../Module/LeagueSortModes';
import { Troll } from '../Module/Troll';
import { LoveRaidManager } from "../Module/Events/LoveRaidManager";
import { logHHAuto } from "../Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK } from "../config/StorageKeys";
import { LoveRaid } from '../model/LoveRaid';
import { ConfigHelper } from "./ConfigHelper";
import { getTextForUI } from "./LanguageHelper";
import { getPage } from './PageHelper';
import { getStoredValue } from "./StorageHelper";
import { getMenuValues, setMenuValues } from "./menu/MenuSettings";

export { getMenu } from "./menu/MenuTemplate";
export {
    hhButton,
    hhMenuInput,
    hhMenuInputWithImg,
    hhMenuSelect,
    hhMenuSwitch,
    hhMenuSwitchWithImg,
} from "./menu/MenuWidgets";
export {
    addEventsOnMenuItems,
    getMenuValues,
    preventKobanUsingSwitchUnauthorized,
    setMenuValues,
} from "./menu/MenuSettings";

export class HHMenu {
    static BUTTON_MENU_ID = 'sMenuButton';

    createMenuButton() {
        if ($('#' + HHMenu.BUTTON_MENU_ID).length > 0) return;
        if (getPage() == ConfigHelper.getHHScriptVars("pagesIDHome")) {
            GM_addStyle(''
                + '#sMenuButton {'
                + '   position: absolute;'
                + '   top: 65px;'
                + '   right: 15px;'
                + '   z-index:5000;'
                + '}'
                + '@media only screen and (max-width: 1025px) {'
                + '#sMenuButton {'
                + '   width: 40px;'
                + '   height: 40px;'
                + '   top: 55px;'
                + '   right: 40px;'
                + '}}'
            );
        } else {
            GM_addStyle(''
                + '#sMenuButton {'
                + '   position: absolute;'
                + '   top: 45px;'
                + '   right: 15px;'
                + '   z-index:5000;'
                + '}'
                + '@media only screen and (max-width: 1025px) {'
                + '#sMenuButton {'
                + '   width: 40px;'
                + '   height: 40px;'
                + '   top: 60px;'
                + '   right: 10px;'
                + '}}'
            );
        }
        $("#contains_all nav").prepend('<div class="square_blue_btn" id="' + HHMenu.BUTTON_MENU_ID + '" ><img src="https://i.postimg.cc/bv7n83z3/script-Icon2.png"></div>');
        $("#sMenuButton").on("click", () => {
            const sMenu = document.getElementById("sMenu");
            if (sMenu != null) {
                if (sMenu.style.display === "none") {
                    setMenuValues();
                    sMenu.style.display = "flex";
                    $('#contains_all')[0].style.zIndex = '9';
                }
                else {
                    getMenuValues();
                    sMenu.style.display = "none"
                    $('#contains_all')[0].style.zIndex = "";
                }
            }
        });
    }

    _createHtmlOption(value: string, text: string) {
        var option = document.createElement("option");
        option.value = value;
        option.text = text;
        return option;
    }

    _createHtmlSeparator(text: string) {
        var option = document.createElement("option");
        option.disabled = true;
        option.text = text;
        return option;
    }

    fillTrollSelectMenu(lastTrollIdAvailable: number) {
        var trollOptions = <HTMLSelectElement>document.getElementById("autoTrollSelector");
        try {
            trollOptions.add(this._createHtmlSeparator(getTextForUI("mainAdventure", "elementText")));
            trollOptions.add(this._createHtmlOption('0', getTextForUI("latestTroll", "elementText")));
            const trollz = ConfigHelper.getHHScriptVars("trollzList");
            for (var i = 1; i <= lastTrollIdAvailable; i++) {
                const option = this._createHtmlOption(i + '', trollz[i]);
                if (option.text !== 'EMPTY' && trollz[i]) {
                    // Supports for PH and missing trols or parallel advantures (id world "missing")
                    trollOptions.add(option);
                }
            }
            const sideTrollz = ConfigHelper.getHHScriptVars("sideTrollzList");
            if (Object.keys(sideTrollz).length > 0) {
                trollOptions.add(this._createHtmlSeparator(getTextForUI("sideAdventure", "elementText")));
                for (const i of Object.keys(sideTrollz)) {
                    const option = this._createHtmlOption(i + '', sideTrollz[i]);
                    if (option.text !== 'EMPTY' && sideTrollz[i]) {
                        trollOptions.add(option);
                    }
                }
            }

        } catch ({ errName, message }: any) {
            trollOptions.add(this._createHtmlSeparator('Error!'));
            logHHAuto(`Error filling trolls: ${errName}, ${message}`);
        }

        trollOptions.add(this._createHtmlSeparator(getTextForUI("otherTrollOption", "elementText")));
        trollOptions.add(this._createHtmlOption('98', getTextForUI("firstTrollWithGirls", "elementText")));
        trollOptions.add(this._createHtmlOption('99', getTextForUI("lastTrollWithGirls", "elementText")));
    }

    fillLoveRaidSelectMenu() {
        var loveRaidOptions = <HTMLSelectElement>document.getElementById("loveRaidSelector");
        try {
            loveRaidOptions.add(this._createHtmlOption('0', getTextForUI("chooseARaid", "elementText")));
            loveRaidOptions.add(this._createHtmlOption('first', getTextForUI("firstEndingRaid", "elementText")));

            const lastTrollIdAvailable = Troll.getLastTrollIdAvailable();
            LoveRaidManager.getTrollRaids().forEach((raid:LoveRaid) => {
                if (raid.trollId > lastTrollIdAvailable) {
                    return; // Skip raids on locked trolls
                }
                const option = this._createHtmlOption(raid.trollId + '_' + raid.id_girl, raid.event_name);
                loveRaidOptions.add(option);
            });

        } catch ({ errName, message }: any) {
            loveRaidOptions.add(this._createHtmlSeparator('Error!'));
            logHHAuto(`Error filling love raids: ${errName}, ${message}`);
        }
    }

    fillLeagueSelectMenu() {
        var leaguesOptions = <HTMLSelectElement>document.getElementById("autoLeaguesSelector");
        try{
            const leagues = ConfigHelper.getHHScriptVars("leaguesList");

            for (var j in leagues) {
                leaguesOptions.add(this._createHtmlOption((Number(j) + 1) + '', leagues[j]));
            };
        } catch ({ errName, message }: any) {
            leaguesOptions.add(this._createHtmlOption('0', 'Error!'));
            logHHAuto(`Error filling leagues: ${errName}, ${message}`);
        }
    }

    fillLeaguSortMenu() {
        var sortsOptions = <HTMLSelectElement>document.getElementById("autoLeaguesSortMode");
        sortsOptions.add(this._createHtmlOption(LEAGUE_SORT.DISPLAYED, getTextForUI("autoLeaguesdisplayedOrder", "elementText")));
        sortsOptions.add(this._createHtmlOption(LEAGUE_SORT.POWER, getTextForUI("autoLeaguesPower", "elementText")));
        sortsOptions.add(this._createHtmlOption(LEAGUE_SORT.POWERCALC, getTextForUI("autoLeaguesPowerCalc", "elementText")));
    }

    fillRaidStarsMenu() {
        var raidStarsOptions = <HTMLSelectElement>document.getElementById("raidStarsSelector");
        raidStarsOptions.add(this._createHtmlOption('off', getTextForUI("raidStarsOff", "elementText")));
        raidStarsOptions.add(this._createHtmlOption('exact3', getTextForUI("raidStarsExact3", "elementText")));
        raidStarsOptions.add(this._createHtmlOption('min3', getTextForUI("raidStarsMin3", "elementText")));
        raidStarsOptions.add(this._createHtmlOption('exact5', getTextForUI("raidStarsExact5", "elementText")));
    }

    fillSeasonFocusMenu() {
        var focusOptions = <HTMLSelectElement>document.getElementById("seasonFocusSelector");
        focusOptions.add(this._createHtmlOption('off', getTextForUI("seasonFocusAll", "elementText")));
        focusOptions.add(this._createHtmlOption('girl', getTextForUI("seasonFocusGirl", "elementText")));
        focusOptions.add(this._createHtmlOption('girlAndSkin', getTextForUI("seasonFocusGirlSkin", "elementText")));
    }

    fillLabyDifficultyMenu() {
        var sortsOptions = <HTMLSelectElement>document.getElementById("autoLabyDifficulty");
        sortsOptions.add(this._createHtmlOption(LABY_DIFFICULTY.EASY, getTextForUI("autoLabyDifficultyEasy", "elementText")));
        sortsOptions.add(this._createHtmlOption(LABY_DIFFICULTY.NORMAL, getTextForUI("autoLabyDifficultyNormal", "elementText")));
        sortsOptions.add(this._createHtmlOption(LABY_DIFFICULTY.HARD, getTextForUI("autoLabyDifficultyHard", "elementText")));
    }

    // replaceMenuIconWithWarning() {
    //     $('#' + HHMenu.BUTTON_MENU_ID + ' img')
    //         .attr('src', 'https://i.postimg.cc/3JCgVBdK/Opponent-orange.png')
    //         .attr('title', getTextForUI("scriptWarning", "tooltip"));
    // }
}

export function maskInactiveMenus()
{
    const menuIDList = ["isEnabledDailyGoals", "isEnabledPoV", "isEnabledPoG", "isEnabledPentaDrill",
                    "isEnabledSeasonalEvent" , "isEnabledBossBangEvent" , "isEnabledSultryMysteriesEvent",
                    "isEnabledDailyRewards", "isEnabledFreeBundles", "isEnabledMission","isEnabledContest",
                    "isEnabledTrollBattle","isEnabledPowerPlaces","isEnabledSalary","isEnabledPachinko","isEnabledQuest","isEnabledSideQuest","isEnabledSeason","isEnabledLeagues",
                    "isEnabledAllChamps","isEnabledChamps","isEnabledClubChamp","isEnabledPantheon","isEnabledShop"];
    for (const menu of menuIDList)
    {
        const menuElement = document.getElementById(menu);
        if ( menuElement !== null && ConfigHelper.getHHScriptVars(menu,false) !== null && !ConfigHelper.getHHScriptVars(menu,false) )
        {
            menuElement.style.display = "none";
        }
    }
}

export function switchHHMenuButton(isActive: boolean)
{
    var element = document.getElementById("sMenuButton");
    if(element !== null)
    {
        if (getStoredValue(HHStoredVarPrefixKey+SK.master) === "false")
        {
            (element.style as any)["background-color"] = "red";
            (element.style as any)["background-image"] = "none";
        }
        else if (isActive)
        {
            (element.style as any)["background-color"] = "green";
            (element.style as any)["background-image"] = "none";
        }
        else
        {
            element.style.removeProperty('background-color');
            element.style.removeProperty('background-image');
        }
    }
}
