// Raw API model for a girl assigned to the player's active team.
// Wraps the underlying KKHaremGirl with skill tier info and skill data.

import { KKHaremGirl } from "./KKHaremGirl";

export class KKTeamGirl {
    girl: KKHaremGirl;
    skill_tiers_info: any;
    skills: any;
    id_girl: any;
}