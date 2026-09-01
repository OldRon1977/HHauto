/**
 * ButtonHelper.ts - Reusable HTML button generators for the game UI
 *
 * Produces HTML strings for common action buttons injected into the game
 * page. These are used by automation modules that need to add navigation
 * shortcuts (e.g., "Change team" or "Go to Club Champion") to the DOM.
 */
import { ConfigHelper } from "./ConfigHelper";
import { getTextForUI } from "./LanguageHelper";

/**
 * Link to the team page for one battle type.
 *
 * The battle type is not optional: measured, a bare /teams.html
 * redirects straight to home.html and `teams_data` never exists there. The
 * game's own links carry it too (leagues.html links to
 * ?battle_type=leagues, season-arena.html to ?battle_type=seasons). Landing on
 * home instead of the team page also meant the gear optimiser never got to
 * record the team's theme, which it does on that page.
 */
export function getGoToChangeTeamButton(battleType = 'leagues') {
    // TODO translate
    return '<div class="change_team_container"><a id="change_team" href="/teams.html?battle_type='
        + battleType + '" class="blue_button_L" anim-step="afterStartButton"><div>Change team</div></a></div>';
}

export function getGoToClubChampionButton() {
    return `<button data-href="${ConfigHelper.getHHScriptVars("pagesURLClubChampion")}" class="blue_button_L hh-club-poa">${getTextForUI("goToClubChampions","elementText")}</button>`;
}