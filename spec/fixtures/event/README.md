# Event fixtures

## Source

- Dump: `INPUT/hhauto_dump_www_hentaiheroes_com_tour_2026-05-05T12-11-40-985Z.json`
- Capture date: 2026-05-05T12:09:05Z
- Page index: 13 (`/event.html`)

## Files

### `event-detection.json`

Compound fixture combining the event header and the mega-event flag,
both consumed by event detection logic.

#### Top-level structure

```json
{
  "event_data": { ... event header from battle.event_data ... },
  "mega_event": { "active": true, "time_remaining": 2242260 }
}
```

#### `event_data`

- Source path: `pages[13].battle.event_data`
- `pages[13].battle.current_event` is an exact duplicate in the dump;
  only one of the two is fixtured. Keys:
  - `event_name`, `type`, `identifier` -- event identity
  - `seconds_until_event_end`, `event_duration_seconds` -- timers
  - `can_participate`, `participation_info` -- participation gate
  - `progression_href` -- link target
  - `girls` -- substituted in from
    `pages[13].girls_full["game.event_girls"]` (the inspector
    serialises that there to break the circular reference at
    `battle.event_data.girls`).
  - `event_data` -- empty list in this dump (event-type specific
    sub-payload, populated for some event types).
- Capture detail: the dump's event is `Cumback Contests`
  (`identifier=cumback_contest_188`).

#### `mega_event`

- Source paths:
  - `pages[13].battle.mega_event_active` -> `mega_event.active`
  - `pages[13].battle.mega_event_time_remaining` -> `mega_event.time_remaining`
- Captured snapshot has the mega event active.

#### Girl whitelist

Each entry under `event_data.girls` is reduced to the haremGirl
whitelist plus event-specific extensions:

- Ids / classification: `id_girl`, `id_girl_ref`, `id_member`, `name`,
  `class`, `figure`, `element`, `rarity`
- Progress: `level`, `xp`, `nb_grades`, `graded`, `graded2`, `Graded`,
  `shards`, `affection`, `awakening_level`, `armor`
- Caracs: `carac1`, `carac2`, `carac3`, `caracs`, `caracs_sum`
- Salary: `salary`, `salary_per_hour`, `salary_timer`, `pay_in`,
  `pay_time`, `ts_pay`, `orgasm`
- Element / blessing: `element_data`, `blessed_attributes`,
  `blessing_bonuses`, `can_be_blessed`, `can_be_blessed_pvp4`
- Skills / grade offsets: `skill_tiers_info`, `grade_offset_values`,
  `grade_offsets`
- Event-specific: `source`, `source_list`, `own`, `role_data`

Fields not present on a given girl entry are simply absent (e.g. the
single event girl in this capture has no `salary_timer` or
`skill_tiers_info`, both legitimately missing).

Fields dropped (asset URLs, decoration metadata): `avatar`,
`default_avatar`, `black_avatar`, `ico`, `preview`, `images`,
`position_img`, `scene_paths`, `grade_skins`, `animated_grades`,
`eye_color1/2`, `hair_color1/2`, `style`, `zodiac`, `anniversary`,
`release_date`, `date_added`, `id_world`, `id_quest_get`, `id_role`,
`id_places_of_power`, `fav_graded`, `upgrade_quests`.

PII: none. `name` is a character name (game asset), not the player.
`id_member` is the same player id already present in the league /
champion / haremGirl fixtures. `participation_info` is a server-side
hint string with no personal data. No redaction.

## How to refresh

If a fresh dump is captured later:

1. Confirm the event is on `/event.html` (page 13 in the 2026-05-05
   capture).
2. Re-run the extraction with the same field whitelist. The captured
   event in this dump is `cumback_contest_188`; a different event type
   may populate `event_data.event_data` with type-specific data --
   keep it as captured and document the change here.
3. Re-run the PII / asset-url scan in the extraction script before
   committing.
