// Model representing a Love Raid event instance.
// Contains the raid target (girl), associated troll/champion/season module,
// timing (start/end), shard progress, and reward availability flags.

export class LoveRaid {
    id_girl: number;
    trollId: number;
    championId: number;
    raid_module_type: string; //  "champion", "season", "troll"
    start_datetime: string;
    end_datetime: string;
    event_name: string;
    girl_shards: number;
    seconds_until_event_start: number;
    seconds_until_event_end: number;
    event_duration_seconds: number;
    girl_to_win: boolean;
    skin_to_win: boolean;
    shards_left: number;
    girl_skin_shards: number;
    isMythic: boolean;
    girlGrade: number; // Star grade of the raid girl (e.g. 3=rare, 5=legendary, 6=mythic)
}