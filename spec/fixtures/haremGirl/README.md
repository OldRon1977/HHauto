# HaremGirl fixtures

## Source

- Dump: `INPUT/hhauto_dump_www_hentaiheroes_com_tour_2026-05-05T12-11-40-985Z.json`
- Capture date: 2026-05-05T12:11:40Z
- Page index: 19 (`/waifu.html`)

## Plan deviation

The strategy plan specified page index 0 (`/home.html`) and the path
`girls_full.game.shared.Hero` for the harem. The actual dump has the
harem on page 19 (`/waifu.html`) under the dotted-key path
`girls_full["game.girls_data_list"]`. Fields are extracted from the
real path; the plan task notes the substitution.

## Files

### `sample-girls.json`

- Source path: `pages[19].girls_full["game.girls_data_list"]`
- Selection: 3 girls covering the rarity / max-grade range used by the
  plan
  - `id_girl=118565805` (Untamed Levitya, mythic, `nb_grades=6`,
    `level=750`)
  - `id_girl=118816` (Fanny & Fione, legendary, `nb_grades=5`,
    `level=750`)
  - `id_girl=5` (Princess Agate, common, `nb_grades=5`, `level=750`)
- Fields kept per girl (whitelist):
  - Ids / classification: `id_girl`, `id_girl_ref`, `id_member`,
    `name`, `class`, `figure`, `element`, `rarity`
  - Progress: `level`, `xp`, `nb_grades`, `graded`, `graded2`,
    `Graded`, `shards`, `affection`, `awakening_level`, `armor`
  - Caracs: `carac1`, `carac2`, `carac3`, `caracs`, `caracs_sum`
  - Salary: `salary`, `salary_per_hour`, `salary_timer`, `pay_in`,
    `pay_time`, `ts_pay`, `orgasm`
  - Element / blessing: `element_data`, `blessed_attributes`,
    `blessing_bonuses`, `can_be_blessed`, `can_be_blessed_pvp4`
  - Skills / grade offsets: `skill_tiers_info`, `grade_offset_values`,
    `grade_offsets`
- Fields dropped (asset URLs and metadata without parser value):
  `avatar`, `default_avatar`, `black_avatar`, `ico`, `preview`,
  `images`, `position_img`, `scene_paths`, `grade_skins`,
  `animated_grades`, `eye_color1/2`, `hair_color1/2`, `style`,
  `zodiac`, `anniversary`, `release_date`, `date_added`, `id_world`,
  `id_quest_get`, `id_role`, `id_places_of_power`, `fav_graded`,
  `upgrade_quests`.
- Redactions: none. `name` is a character name (game asset), not the
  player. `id_member` is the same player id already kept in the league
  fixture.

## How to refresh

If a fresh dump is captured later:

1. Confirm the harem is still on the `/waifu.html` capture (page 19 in
   the 2026-05-05 dump).
2. Pick the same `id_girl` values if they are still owned. If a girl
   has rotated out of the harem, swap to the closest equivalent in the
   same rarity / max-grade slot and document the substitution here.
3. Apply the same field whitelist.
