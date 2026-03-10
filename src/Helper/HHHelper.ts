/**
 * HHHelper.ts - Safe accessor for the game's global JavaScript variables
 *
 * The game exposes state on `unsafeWindow` (or `unsafeWindow.shared` in
 * some builds) as nested objects like `Hero.infos.id` or `Hero.currencies`.
 * This helper provides get/set access by dot-separated path strings,
 * automatically resolving environment-specific variable name overrides
 * through ConfigHelper and prepending the `shared.` prefix when needed.
 *
 * This is the primary bridge between the Tampermonkey sandbox and the
 * game's runtime state.
 */
import { logHHAuto } from '../Utils/index';
import { ConfigHelper } from "./ConfigHelper";

function prefixIfNeeded(infoSearched:string){
    if (!!unsafeWindow.shared && infoSearched.indexOf('Hero.')==0) {
        infoSearched = 'shared.' + infoSearched;
    }
    return infoSearched;
}

export function getHHVars(infoSearched:string, logging = true): any
{
    let returnValue:any = unsafeWindow;
    if (ConfigHelper.getHHScriptVars(infoSearched,false) !== null)
    {
        infoSearched = ConfigHelper.getHHScriptVars(infoSearched);
    }
    infoSearched = prefixIfNeeded(infoSearched);

    let splittedInfoSearched = infoSearched.split(".");

    for (let i=0;i<splittedInfoSearched.length;i++)
    {
        if (returnValue[splittedInfoSearched[i]] === undefined)
        {
            if (logging)
            {
                logHHAuto("HH var not found : "+infoSearched+" ("+splittedInfoSearched[i]+" not defined).");
            }
            return null;
        }
        else
        {
            returnValue = returnValue[splittedInfoSearched[i]];
        }
    }
    return returnValue;
}

export function setHHVars(infoSearched,newValue)
{
    let returnValue:any = unsafeWindow;
    if (ConfigHelper.getHHScriptVars(infoSearched,false) !== null)
    {
        infoSearched = ConfigHelper.getHHScriptVars(infoSearched);
    }
    infoSearched = prefixIfNeeded(infoSearched);

    let splittedInfoSearched = infoSearched.split(".");

    for (let i=0;i<splittedInfoSearched.length;i++)
    {
        if (returnValue[splittedInfoSearched[i]] === undefined)
        {
            logHHAuto("HH var not found : "+infoSearched+" ("+splittedInfoSearched[i]+" not defined).");
            return -1;
        }
        else if ( i === splittedInfoSearched.length - 1)
        {
            returnValue[splittedInfoSearched[i]] = newValue;
            return 0;
        }
        else
        {
            returnValue = returnValue[splittedInfoSearched[i]];
        }
    }
}
