/**
 * ConfigHelper.ts - Environment detection and per-environment variable lookup
 *
 * The game runs on multiple domains (HH, PH, NPH, etc.), each with
 * slightly different page IDs, URLs, and feature flags. This helper
 * detects which environment the script is running on by matching the
 * current hostname against a known list, then resolves configuration
 * variables for that environment. When an environment-specific value is
 * not defined, it falls back to the "global" defaults.
 *
 * Almost every other helper and module depends on ConfigHelper to obtain
 * page IDs, URL paths, element selectors, and feature toggles.
 */
import { fillHHPopUp, logHHAuto } from '../Utils/index';
import { HHEnvVariables, HHKnownEnvironnements } from '../config/index';

export class ConfigHelper {

    static getEnvironnement()
    {
        let environnement = "global";
        if (HHKnownEnvironnements[window.location.hostname] !== undefined)
        {
            environnement= HHKnownEnvironnements[window.location.hostname].name;
        }
        else
        {
            fillHHPopUp("unknownURL","Game URL unknown",'<p>This HH URL is unknown to the script.<br>To add it please open an issue in <a href="https://github.com/Roukys/HHauto/issues" target="_blank">Github</a> with following informations : <br>Hostname : '+window.location.hostname+'<br>gameID : '+$('body[page][id]').attr('id')+'<br>You can also use this direct link : <a  target="_blank" href="https://github.com/Roukys/HHauto/issues/new?template=enhancement_request.md&title=Support%20for%20'+window.location.hostname+'&body=Please%20add%20new%20URL%20with%20these%20infos%20%3A%20%0A-%20hostname%20%3A%20'+window.location.hostname+'%0A-%20gameID%20%3A%20'+$('body[page][id]').attr('id')+'%0AThanks">Github issue</a></p>');
        }
        return environnement;
    }

    static isPshEnvironnement()
    {
        return ["PH_prod","NPH_prod"].includes(ConfigHelper.getEnvironnement());
    }

    static getHHScriptVars(id:string, logNotFound = true): any
    {
        const environnement = ConfigHelper.getEnvironnement();
        if (HHEnvVariables[environnement] !== undefined && HHEnvVariables[environnement][id] !== undefined)
        {
            return HHEnvVariables[environnement][id];
        }
        else
        {
            if (HHEnvVariables["global"] !== undefined && HHEnvVariables["global"][id] !== undefined )
            {
                return HHEnvVariables["global"][id];
            }
            else
            {
                if (logNotFound)
                {
                    logHHAuto("not found var for "+environnement+"/"+id);
                }
                return null;
            }
        }
    }
}