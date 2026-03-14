// Raw API model for a league opponent as returned by the game's API.
// Contains boosters, match history, player stats, power, rewards,
// and team composition data.

export class KKLeagueOpponent {
    boosters: Record<string, unknown>;
    can_fight: boolean;
    country: string = '';
    country_text: string = '';
    girls_count_per_element: Record<string, number>;
    level: number = 0;
    match_history: Record<string | number, (unknown | null)[]>;
    match_history_sorting: number = 0
    nickname: string = '';
    place: number;
    player: { id_fighter: number; [key: string]: unknown };
    player_league_points: number;
    power: number;
    rewards: Record<string, unknown>;
    team: Record<string, unknown>[];
}
