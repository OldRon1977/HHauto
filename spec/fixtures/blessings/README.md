# blessings fixtures

## Source

- Dump: `INPUT/hhauto_dump_www_hentaiheroes_com_tour_2026-08-17T13-13-52-547Z.json`
- Capture date: 2026-08-17T13:13Z, inspector v4.9.0
- Path: `girls_full["game.availableGirls"]` on `/edit-team.html` (`/edit-team.html`), 1783
  entries, filtered down to one girl per case.

## Files

`blessed-girls.json` — three girls, one per case the context split has to tell
apart:

| key | `pvp_v3` | `pvp_v4` | `can_be_blessed` | `can_be_blessed_pvp4` |
|---|---|---|---|---|
| `leagueBlessed` | `[40, 40]` | `[40, 40]` | `true` | `true` |
| `roleOnly` | **key absent** | `[40]` | `false` | `true` |
| `unblessed` | absent | absent | `false` | `false` |

The captured week confirms the semantics the spec had been asserting since
July: a Role-blessed girl carries **no `pvp_v3` key at all** — not an empty
one — and her `can_be_blessed` flag is `false`. That is the distinction the
pre-fix cross-context fallback got wrong.

## Fields kept

`id_girl`, `id_girl_ref`, `name`, `rarity`, `element`, `class`, `eye_color1`,
`hair_color1`, `zodiac`, `position_img`, `id_role`, `blessing_bonuses`,
`can_be_blessed`, `can_be_blessed_pvp4`, `blessed_attributes`.

## Redactions

`id_member` → `1`; asset urls dropped. Girl names are the game's own catalogue
names, not player data, and are kept.

## Consumers

- `src/Service/BlessingService.ts` — `getEffectiveMultiplier`,
  `getActivePercents`, `detectActiveBlessings`

The spec uses the fixture two ways: the last describe block feeds the three
girls in unmodified, and the earlier blocks reuse their trait fields while
varying the percents, because the arithmetic cases need values this particular
week does not contain.

## How to refresh

Blessings rotate weekly, so a refresh changes the percents and usually the
traits. That is fine — the tests derive their expectations from the fixture.
What must survive the refresh is the case coverage:

1. Filter `availableGirls` for a girl with `blessing_bonuses.pvp_v3` and
   `can_be_blessed === true` → `leagueBlessed`.
2. Filter for one with `pvp_v4` but **no** `pvp_v3` key and
   `can_be_blessed === false` → `roleOnly`.
3. Filter for one with neither → `unblessed`.
4. If a week has no Role blessing, `roleOnly` will not exist. Keep the previous
   fixture in that case rather than shipping a two-case file, and note the
   capture date here.
