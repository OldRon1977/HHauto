// Spreadsheet.ts -- Adds the community blessing spreadsheet to the blessings
// popup.
//
// On the home page, once the game has loaded the blessings
// (get_girls_blessings), a link to this game's blessing spreadsheet goes into
// the blessings popup -- unless the BDSMPP script already put one there.
//
// Used by: Service/AutoLoopPageHandlers.ts
//
import { ConfigHelper } from "../Helper/ConfigHelper";
import { getTextForUI } from "../Helper/LanguageHelper";
import { getPage } from "../Helper/PageHelper";
import { onAjaxResponse } from "../Utils/Utils";

export class Spreadsheet {
    static LINK_CLASS = 'hhauto-spreadsheet-link';
    static BDSMPP_CLASS = 'script-blessing-spreadsheet-link';
    static POPUP_SELECTOR = '#blessings_popup .blessings_wrapper';

    static isEnabled() {
        return ConfigHelper.getHHScriptVars("isEnabledSpreadsheets", false);
    }

    static canRun(){
        return Spreadsheet.isEnabled() && $('.' + Spreadsheet.BDSMPP_CLASS).length === 0 && $('.' + Spreadsheet.LINK_CLASS).length === 0;
    }

    static run() {
        if (!Spreadsheet.canRun()) return;
        const page = getPage();
        if (page === ConfigHelper.getHHScriptVars("pagesIDHome")) {

            onAjaxResponse(/action=get_girls_blessings/i, (_response, _opt, _xhr, _evt) => {
                setTimeout(async function () {
                    if (!Spreadsheet.canRun()) return;
                    const href = ConfigHelper.getHHScriptVars("spreadsheet");
                    if (!href) return;

                    const $sheet_link = $(`<a class="${Spreadsheet.LINK_CLASS}" target="_blank" href="${href}"><span class="nav_grid_icn"></span><span>${getTextForUI("spreadsheet", "elementText")}</span></a>`)

                    $(Spreadsheet.POPUP_SELECTOR).append($sheet_link)
                }, 200);
            })



            GM_addStyle('.' + Spreadsheet.LINK_CLASS + ' {position: absolute; top: 5px; right: 60px;}');     
            GM_addStyle('.' + Spreadsheet.LINK_CLASS + ' .nav_grid_icn {display: inline-block;}');     
        }
    }
}