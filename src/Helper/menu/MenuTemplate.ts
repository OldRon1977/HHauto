// MenuTemplate.ts
//
// DOM construction (layout): assembles the full settings panel (div#sMenu) —
// a fixed header (name, version, master switch), the tabbed body built by
// MenuTabs, and a fixed footer with the save/load and tool buttons.
// `debugEnabled` (read from storage) gates rows that were hidden by survey
// feedback. Pure string production; the returned markup is injected by
// StartService.
//
// The master switch lives in the header rather than in the Global tab: it is
// the one control that has to be reachable from every area. There is still
// exactly one of it — a second copy would mean a duplicate DOM id and break
// MenuSettings.
//
// Reads its storage/translation helpers from MenuPorts so this file stays a
// graph leaf (see MenuPorts.ts).

import { TK } from "../../config/StorageKeys";
import { MenuPorts } from "./MenuPorts";
import { buildTabbedBody } from "./MenuTabs";
import { hhButton, hhMenuSwitch } from "./MenuWidgets";

export function getMenu() {
    const { getTextForUI, getStoredValue, storedVarPrefix } = MenuPorts;
    const debugEnabled = getStoredValue(storedVarPrefix + TK.Debug) === 'true';

    const header = `<div class="menuHead">`
        + `<div class="menuBrand">`
            + `<span class="menuName">HH Automatic ++</span>`
            + `<span class="menuVer">${GM.info.script.version}</span>`
        + `</div>`
        + `<div class="menuMaster">${hhMenuSwitch('master')}</div>`
        + `<div class="menuWarn">${getTextForUI("noOtherScripts", "elementText")}</div>`
    + `</div>`;

    const footer = `<div class="menuFoot">`
        + hhButton('saveConfig', 'saveConfig')
        + hhButton('loadConfig', 'loadConfig')
        + hhButton('saveDefaults', 'saveDefaults')
        + hhButton('blockOrder', 'blockOrder')
        + `<div class="menuFootRight">`
            + hhButton('settingsSurvey', 'settingsSurvey')
            + hhButton('gitHub', 'git')
            + hhButton('ReportBugs', 'ReportBugs')
            + hhButton('DebugMenu', 'DebugMenu')
        + `</div>`
    + `</div>`;

    return `<div id="sMenu" class="HHAutoScriptMenu" style="display: none;">`
        + header
        + buildTabbedBody(debugEnabled)
        + footer
    + `</div>`;
}
