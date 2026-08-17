// MenuWidgets.ts
//
// Options rendering: small, reusable HTML builders that turn a text/input id
// into a labelled menu row (button, toggle switch, dropdown, text input,
// optionally with an icon). These are pure string-producing helpers shared by
// the menu DOM template (MenuTemplate) and by feature modules that inject their
// own rows (Champion, Pachinko, Labyrinth, TeamModule).
//
// Split out of HHMenuHelper as part of WART-002 (behavior-neutral). Reads
// getTextForUI / config lookups from MenuPorts so this file stays a graph leaf
// (see MenuPorts.ts).

import { MenuPorts } from "./MenuPorts";

/**
 * `labelPrefix` is prepended to the translated label, e.g. "1 " to number a
 * button inside a step-by-step workflow. Kept out of the translations on
 * purpose: a step number reads the same in every language.
 */
export function hhButton(textKeyId: string, buttonId: string, mainStyle='', labelSyle='', labelPrefix=''){
    const { getTextForUI } = MenuPorts;
    return `<div ${mainStyle ? 'style="' + mainStyle + '"' : '' } class="tooltipHH" >`
                +`<span class="tooltipHHtext">${getTextForUI(textKeyId,"tooltip")}</span>`
                + `<label ${labelSyle ? 'style="' + labelSyle + '"' : '' } class="myButton" id="${buttonId}">${labelPrefix}${getTextForUI(textKeyId,"elementText")}</label>`
            +`</div>`;
}

export function hhMenuSwitch(textKeyAndInputId: string, isEnabledDivId='', isKobanSwitch=false, isStylingSwitch=false){
    const { getTextForUI } = MenuPorts;
    return `<div ${isEnabledDivId ? 'id="'+isEnabledDivId+'"' : '' } class="labelAndButton">`
        +`<span class="HHMenuItemName">${getTextForUI(textKeyAndInputId,"elementText")}</span>`
        +`<div class="tooltipHH">`
            +`<span class="tooltipHHtext">${getTextForUI(textKeyAndInputId,"tooltip")}</span>`
            +`<label class="switch"><input id="${textKeyAndInputId}" type="checkbox"><span class="slider round ${isKobanSwitch ? 'kobans' : ''} ${isStylingSwitch ? 'styling' : ''}"></span></label>`
        +`</div>`
    +`</div>`;
}

export function hhMenuSwitchWithImg(textKeyAndInputId: string, imgPath: string, isKobanSwitch=false) {
    const { getTextForUI, getHHScriptVars } = MenuPorts;
    return `<div class="labelAndButton">`
        +`<span class="HHMenuItemName">${getTextForUI(textKeyAndInputId,"elementText")}</span>`
        +`<div class="imgAndObjectRow">`
            +`<img class="iconImg" src="${getHHScriptVars("baseImgPath")}/${imgPath}" />`
            +`<div style="padding-left:5px">`
                +`<div class="tooltipHH">`
                    +`<span class="tooltipHHtext">${getTextForUI(textKeyAndInputId,"tooltip")}</span>`
                    +`<label class="switch"><input id="${textKeyAndInputId}" type="checkbox"><span class="slider round ${isKobanSwitch ? 'kobans' : ''}"></span></label>`
                +`</div>`
            +`</div>`
        +`</div>`
    +`</div>`;
}

export function hhMenuSelect(textKeyAndInputId: string, inputStyle = '', options = '') {
    const { getTextForUI } = MenuPorts;
    return `<div class="labelAndButton">`
        +`<span class="HHMenuItemName">${getTextForUI(textKeyAndInputId,"elementText")}</span>`
        +`<div class="tooltipHH">`
            + `<span class="tooltipHHtext">${getTextForUI(textKeyAndInputId,"tooltip")}</span>`
            + `<select id="${textKeyAndInputId}" style="${inputStyle}" >${options}</select>`
        +`</div>`
    +`</div>`;
}

export function hhMenuInput(textKeyAndInputId: string, inputPattern: string, inputStyle='', inputClass='', inputMode='text') {
    const { getTextForUI } = MenuPorts;
    return `<div class="labelAndButton">`
        +`<span class="HHMenuItemName">${getTextForUI(textKeyAndInputId,"elementText")}</span>`
        +`<div class="tooltipHH">`
            +`<span class="tooltipHHtext">${getTextForUI(textKeyAndInputId,"tooltip")}</span>`
            +`<input id="${textKeyAndInputId}" class="${inputClass}" style="${inputStyle}" required pattern="${inputPattern}" type="text" inputMode="${inputMode}">`
        +`</div>`
    +`</div>`;
}

export function hhMenuInputWithImg(textKeyAndInputId: string, inputPattern: string, inputStyle: string, imgPath: string, inputMode='text', inputClass='') {
    const { getTextForUI, getHHScriptVars } = MenuPorts;
    let htmlRet = `<div class="labelAndButton">`
        +`<span class="HHMenuItemName">${getTextForUI(textKeyAndInputId,"elementText")}</span>`
        +`<div class="imgAndObjectRow">`;
    if (imgPath && imgPath.indexOf('images/') >= 0) {
    htmlRet +=`<img class="iconImg" src="/${imgPath}" />`
    }else {
    htmlRet += `<img class="iconImg" src="${getHHScriptVars("baseImgPath")}/${imgPath}" />`
    }
    htmlRet +=
            `<div style="padding-left:5px">`
                +`<div class="tooltipHH">`
                    +`<span class="tooltipHHtext">${getTextForUI(textKeyAndInputId,"tooltip")}</span>`
                    +`<input class="${inputClass}" style="${inputStyle}" id="${textKeyAndInputId}" required pattern="${inputPattern}" type="text" inputMode="${inputMode}">`
                +`</div>`
            +`</div>`
        +`</div>`
    +`</div>`;
    return htmlRet;
}
