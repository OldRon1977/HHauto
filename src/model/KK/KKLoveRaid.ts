// Raw API model for a Love Raid as returned by the game's API.
// Contains raid IDs, module type (champion/season/troll), timing,
// girl data with shard progress, and event naming.

export class KKLoveRaid {
  id_raid: number | string;
  id_girl: number | string;
  raid_module_pk: number | string;
  raid_module_type: string; //  "champion", "season", "troll"
  start_datetime: string;
  end_datetime: string;
  event_name: string;
  girl_data: {
    Graded: number;
    shards: number;
    id_girl: number | string;
    name: string;
    source: {
      anchor_source: {
        url: string;
        label: string;
        disabled: boolean;
      }
      sentence: string;
      anchor_win_from: {
        url: string;
        label: string;
        disabled: boolean;
      }
    };
  };
  status: string; // upcoming, ongoing
  seconds_until_event_start: number;
  seconds_until_event_end: number;
  event_duration_seconds: number;
  all_is_owned: boolean;
  tranche_data: {
    shards_left: number;
  };
}
