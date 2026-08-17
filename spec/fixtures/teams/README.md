# teams fixtures

## Source

- Dump: `INPUT/hhauto_dump_www_hentaiheroes_com_tour_2026-08-17T09-42-21-877Z.json`
- Capture date: 2026-08-17T09:42Z, inspector v4.8.0
- `teams-data.json` — `pages[27].teams.teams_data` (`/teams.html`)
- `team-girls.json` — `pages[28].girls_full["game.teamGirls"]` (`/edit-team.html`)
- `available-girls.json` — `pages[28].girls_full["game.availableGirls"]`

## Files

### `teams-data.json`

Two of the 30 team slots, keyed by case:

- `themed` — the fielded team: `theme: "nature"`, eight `synergies` entries,
  `theme_elements` with the matching element.
- `emptySlot` — an unused slot: `id_team: null`, `theme: null`, no girls.
- `noTheme` is `null`. Every fielded team on the test account carries a theme,
  so there is no real example of a manned-but-themeless team. The one spec
  case that needs it builds it from `themed` by emptying the two theme fields,
  which is documented at that test.

`girls` is substituted: the game sends it as an HTML snippet string on this
endpoint, while every consumer treats it as the list. The substitute carries
`id_girl` only — the consumers read the length, not the contents.

### `team-girls.json`

Three girls off the fielded team, reduced to `id_girl` and `skills`. Each
skill record keeps `id_skill`, `tier` and `skill.{id_skill, tier, flat_value,
percentage_value}`.

Worth knowing: a flat skill carries `percentage_value: null`, not `0` and not
a missing key. That is the case `getSkillPercentage`'s nullish coalescing
exists for, and it only shows up in real data.

### `available-girls.json`

Three entries whitelisted to the 21 fields `TeamModule.mapAvailableGirl`
reads. Anything the mapper does not touch is dropped, so a renamed game field
surfaces as a missing key in the test rather than as a silent default.

## Redactions

- `id_member` / `id_member_ref` → `1` everywhere.
- Asset urls dropped: `ico`, `ico_url`, `avatar`, `default_avatar`,
  `black_avatar`, `preview`, `images`, `scene_paths`, `image`, `portrait`,
  `path`, `url`, `ico_path`.
- `power_display` (a rendered HTML string) dropped from the teams.

Girl ids are kept: they are the game's own references and carry no account
information beyond what `id_member` already covered.

## Consumers

- `src/Helper/BDSMHelper.ts` — `fightBonues` (synergies), `getSkillPercentage`
- `src/Module/TeamModule.ts` — `mapAvailableGirl`
- `src/Service/EquipmentOptimizerService.ts` — `themeFromTeamData`

## How to refresh

1. Capture a fresh dump with `bonus-scripts/HHAuto_debug_inspector.user.js`.
2. Re-run the extraction against the new file: teams from `/teams.html`
   `teams_data`, girls from `/edit-team.html` `girls_full`.
3. Pick the same three cases (themed team, empty slot, three team girls) and
   apply the same whitelist and redactions.
4. If a fielded team without a theme exists in the new capture, add it as
   `noTheme` and drop the synthetic case in
   `spec/Service/EquipmentOptimizerService.spec.ts`.
