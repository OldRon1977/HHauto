// LanguageHelper.ts
//
// Handles UI text localization for the HHAuto menu and tooltips.
// Detects the game's current language from the <html lang> attribute
// and resolves translated strings from the i18n dictionaries.
//
// Fallback strategy: If a translation is missing or outdated (version
// older than the English entry), English text is used. This ensures
// new menu items are always visible before translators catch up.
//
// Also provides a translation popup (manageTranslationPopUp) that lets
// community members contribute translations directly from the game UI,
// exporting them as a downloadable text file.
//
// Used by: Nearly every Helper and Module that renders UI text.

import { fillHHPopUp, logHHAuto } from '../Utils/index';
import { HHAuto_ToolTips } from "../i18n/index";

export function getLanguageCode()
{
    let HHAuto_Lang = 'en';
    try
    {
        if ($('html')[0].lang === 'en') {
            HHAuto_Lang = 'en';
        }
        else if ($('html')[0].lang === 'fr') {
            HHAuto_Lang = 'fr';
        }
        else if ($('html')[0].lang === 'es_ES') {
            HHAuto_Lang = 'es';
        }
        else if ($('html')[0].lang === 'de_DE') {
            HHAuto_Lang = 'de';
        }
        else if ($('html')[0].lang === 'it_IT') {
            HHAuto_Lang = 'it';
        }
        else if ($('html')[0].lang === 'ja_JP') {
            HHAuto_Lang = 'ja';
        }
        else if ($('html')[0].lang === 'ru_RU') {
            HHAuto_Lang = 'ru';
        }
    }
    catch
    {
    }
    return HHAuto_Lang;
}

/*
 0: version strings are equal
 1: version a is greater than b
-1: version b is greater than a
*/
function cmpVersions(a, b)
{
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) ;
}

export function getTextForUI(id,type)
{
    let HHAuto_Lang = getLanguageCode();
    let defaultLanguageText = null;
    let defaultLanguageVersion = "0";

    //console.log(id);
    if (HHAuto_ToolTips['en'] !== undefined && HHAuto_ToolTips['en'][id] !== undefined && HHAuto_ToolTips['en'][id][type] !== undefined)
    {
        defaultLanguageText = HHAuto_ToolTips['en'][id][type];
        defaultLanguageVersion = HHAuto_ToolTips['en'][id].version;
    }

    if (HHAuto_ToolTips[HHAuto_Lang] !== undefined && HHAuto_ToolTips[HHAuto_Lang][id] !== undefined && HHAuto_ToolTips[HHAuto_Lang][id][type] !== undefined && cmpVersions(HHAuto_ToolTips[HHAuto_Lang][id].version , defaultLanguageVersion) >= 0)
    {
        return HHAuto_ToolTips[HHAuto_Lang][id][type];
    }
    else
    {
        if (defaultLanguageText !== null)
        {
            return defaultLanguageText;
        }
        else
        {
            logHHAuto("not found text for "+HHAuto_Lang+"/"+id+"/"+type);
            return HHAuto_Lang+"/"+id+"/"+type+" not found.";
        }
    }
}

export function manageTranslationPopUp()
{
    const HtmlIdPrefix = "HH_TranslateTo_";
    GM_addStyle('.tItems {border-collapse: collapse;text-align:center;vertical-align:middle;} '
                +'.tItems td,th {border: 1px solid #1B4F72;} '
                +'.tItemsColGroup {border: 3px solid #1B4F72;} '
                +'.tItemsTh1 {background-color: #2874A6;color: #fff;} '
                +'.tItemsTh2 {width: 25%;background-color: #3498DB;color: #fff;} '
                +'.tItemsTBody tr:nth-child(odd) {background-color: #85C1E9;} '
                +'.tItemsTBody tr:nth-child(even) {background-color: #D6EAF8;} '
                +'.tReworkedCell {background-color: gray} '
                +'.tEditableDiv:Empty {background-color:blue}');
    let translatePopUpContent = '<div">'+getTextForUI("saveTranslationText","elementText")+'</div>'
    +'<table class="tItems">'
    +' <colgroup class="tItemsColGroup">'
    +'  <col class="tItemsColRarity" span="2">'
    +' </colgroup>'
    +' <colgroup class="tItemsColGroup">'
    +'  <col class="tItemsColRarity" span="2">'
    +' </colgroup>'
    +' <thead class="tItemsTHead">'
    +'  <tr>'
    +'   <th class="tItemsTh1" colspan="2">'+"Text"+'</th>'
    +'   <th class="tItemsTh1" colspan="2">'+"Tooltip"+'</th>'
    +'  </tr>'
    +'  <tr>'
    +'   <th class="tItemsTh2">'+"English"+'</th>'
    +'   <th class="tItemsTh2">'+$('html')[0].lang+'</th>'
    +'   <th class="tItemsTh2">'+"English"+'</th>'
    +'   <th class="tItemsTh2">'+$('html')[0].lang+'</th>'
    +'  </tr>'
    +' </thead>'
    +' <tbody class="tItemsTBody">';

    const currentLanguage = getLanguageCode();
    for ( let item of Object.keys(HHAuto_ToolTips.en))
    {
        let reworkedClass = "";
        translatePopUpContent +='  <tr id="'+HtmlIdPrefix+item+'">';
        let currentEnElementText = HHAuto_ToolTips.en[item].elementText;
        if (currentEnElementText === undefined || currentEnElementText === "")
        {
            currentEnElementText = "";
            translatePopUpContent +='   <td></td><td><div type="elementText"></div></td>';
        }
        else
        {
            translatePopUpContent +='   <td>'+currentEnElementText+'</td>';
            let currentElementText = HHAuto_ToolTips[currentLanguage][item]?HHAuto_ToolTips[currentLanguage][item].elementText:"";
            if (currentElementText === undefined)
            {
                currentElementText = "";
            }
            if (currentElementText !== getTextForUI(item,"elementText"))
            {
                reworkedClass = " tReworkedCell";
            }
            translatePopUpContent +='   <td><div type="elementText" class="tEditableDiv'+reworkedClass+'" contenteditable>'+currentElementText+'</div></td>';
        }
        reworkedClass = "";
        let currentEnTooltip = HHAuto_ToolTips.en[item].tooltip;
        if (currentEnTooltip === undefined || currentEnTooltip === "")
        {
            currentEnTooltip = "";
            translatePopUpContent +='   <td></td><td><div type="tooltip"></div></td>';
        }
        else
        {
            translatePopUpContent +='   <td>'+currentEnTooltip+'</td>';
            let currentTooltip = HHAuto_ToolTips[currentLanguage][item]?HHAuto_ToolTips[currentLanguage][item].tooltip:"";
            if (currentTooltip === undefined)
            {
                currentTooltip = "";
            }
            if (currentTooltip !== getTextForUI(item,"tooltip"))
            {
                reworkedClass = " tReworkedCell";
            }
            translatePopUpContent +='   <td><div type="tooltip" class="tEditableDiv'+reworkedClass+'" contenteditable>'+currentTooltip+'</div></td>';
        }
        translatePopUpContent +='  </tr>';
    }
    translatePopUpContent +=' </tbody>';
    translatePopUpContent +='</table>';
    translatePopUpContent +='<div style="margin:10px"><label style="width:80px" class="myButton" id="saveTranslationAsTxt">'+getTextForUI("saveTranslation","elementText")+'</label></div>';
    fillHHPopUp("translationPopUp",getTextForUI("translate","elementText"),translatePopUpContent);
    $("#saveTranslationAsTxt").on("click",saveTranslationAsTxt);

    function saveTranslationAsTxt()
    {
        //console.log("test");
        let translation = `Translated to : ${currentLanguage}\n`;
        translation += `From version : ${GM_info.version}\n`;
        let hasTranslation = false;
        for ( let item of Object.keys(HHAuto_ToolTips.en))
        {
            const currentTranslatedElementText = $(`#${HtmlIdPrefix+item} [type="elementText"]`)[0].innerHTML;
            const currentTranslatedTooltip = $(`#${HtmlIdPrefix+item} [type="tooltip"]`)[0].innerHTML;
            let currentElementText = HHAuto_ToolTips[currentLanguage][item]?HHAuto_ToolTips[currentLanguage][item].elementText:"";
            let currentTooltip = HHAuto_ToolTips[currentLanguage][item]?HHAuto_ToolTips[currentLanguage][item].tooltip:"";
            if (currentTooltip === undefined)
            {
                currentTooltip = "";
            }
            if (currentElementText === undefined)
            {
                currentElementText = "";
            }

            if (currentTranslatedElementText !== currentElementText || currentTranslatedTooltip !== currentTooltip)
            {
                //console.log(currentTranslatedElementText !== currentElementText, currentElementText, currentTranslatedElementText)
                //console.log(currentTranslatedTooltip !== currentTooltip, currentTooltip, currentTranslatedTooltip)
                const enVersion = HHAuto_ToolTips.en[item].version;
                translation += `HHAuto_ToolTips.${item} = { version: "${enVersion}"`;
                if (currentTranslatedElementText !== "" )
                {
                    translation += `, elementText: "${currentTranslatedElementText}"`;
                }
                if (currentTranslatedTooltip !== "" )
                {
                    translation += `, tooltip: "${currentTranslatedTooltip}"};\n`;
                }
                hasTranslation = true;
            }
        }
        if (hasTranslation)
        {
            const name=HtmlIdPrefix+currentLanguage+'_'+Date.now()+'.txt';
            const a = document.createElement('a');
            a.download = name;
            a.href = URL.createObjectURL(new Blob([translation], {type: 'text/plain'}));
            a.click();
        }
    }
}
