// Model representing the player's team composition and scroll inventory.
// Contains the list of team girls and counts for each scroll rarity tier.

import { KKTeamGirl } from "./KK/KKTeamGirl";

export class TeamData {
    team: KKTeamGirl[] = [];
    girlIds: number[] = [];
    scrolls_common: number;
    scrolls_epic: number;
    scrolls_legendary: number;
    scrolls_mythic: number;
    scrolls_rare: number;
    /** Level-up team: trips to a girl's quest, by girl id -- the stop for a
     *  grade the game keeps offering but does not complete. */
    levelUpTrips?: Record<string, number>;
}