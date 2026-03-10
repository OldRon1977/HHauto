/**
 * ButtonHelper.ts - Reusable HTML button generators for the game UI
 *
 * Produces HTML strings for common action buttons injected into the game
 * page. These are used by automation modules that need to add navigation
 * shortcuts (e.g., "Change team" or "Go to Club Champion") to the DOM.
 */
import { ConfigHelper } from "./ConfigHelper";
import { getTextForUI } from "./LanguageHelper";

export function getGoToChangeTeamButton() {
    // TODO change href and translate
    return '<div class="change_team_container"><a id="change_team" href="/teams.html" class="blue_button_L" anim-step="afterStartButton"><div>Change team</div></a></div>';
}

export function getGoToClubChampionButton() {
    return `<button data-href="${ConfigHelper.getHHScriptVars("pagesURLClubChampion")}" class="blue_button_L hh-club-poa">${getTextForUI("goToClubChampions","elementText")}</button>`;
}