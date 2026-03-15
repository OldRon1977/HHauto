// Club.ts -- Detects club membership and enables or disables club-related features.
//
// Checks whether the player is currently in a club and toggles visibility of
// club-specific UI elements (e.g. Club Champion buttons). This ensures that
// club features are only shown when the player has an active membership.
//
// Used by: Service/index.ts (main automation loop), ClubChampion.ts
//
import { ConfigHelper, getHHVars } from '../Helper/index';
import { logHHAuto } from '../Utils/index';
import { HHEnvVariables } from '../config/index';

export class Club {
    static run(){
        const onChampTab = $("div.club-champion-members-challenges:visible").length === 1;
        if(onChampTab) {
            $('button.orange_button_L.btn_skip_team_cooldown').css('display', 'none');
            if (!$('button.orange_button_L.btn_skip_champion_cooldown').length) {
                $('.challenge_container').css('display', 'block');
            }
        }
    }
    static checkClubStatus()
    {
        let chatVars = null;
        try {
            chatVars = getHHVars("Chat_vars.CLUB_INFO.id_club", false);
        } catch(e) {
            logHHAuto("Catched error : Couldn't parse CLUB_INFO : "+e);
        }
        if (chatVars === null || chatVars === false)
        {
            HHEnvVariables[ConfigHelper.getHHScriptVars("HHGameName")].isEnabledClubChamp = false;
        }
    }
}