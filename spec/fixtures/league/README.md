# League fixtures

## Source

- Dump: `INPUT/hhauto_dump_www_hentaiheroes_com_tour_2026-05-05T12-11-40-985Z.json`
- Capture date: 2026-05-05T12:11:40Z
- Page index: 1 (`/leagues.html`)

## Files

### `opponents-mid-tier.json`

- Source path: `pages[1].teams.opponents_list`
- Selection: indices 49-51 (3 entries, mid-tier by league place 50-52, total 100 entries)
- Fields kept per entry:
  - Top-level: `id_member` (= `player.id_fighter`), `nickname` (redacted), `level`, `power`, `place`, `country`, `can_fight`
  - `player`: `{ id_fighter, level, class, current_season_mojo }`
- Redactions:
  - `nickname` and `player.nickname` replaced with `Player_1..3`
  - `player.club` removed (contains club name and member ids)
- Plan deviation: the strategy plan listed `member.id_country`, `member.lvl`, `team.theme_elements[]`, `team.girls[]`. The actual dump has top-level `level`/`power`/`country`/`nickname` and `team` is an HTML snippet string, not an object. Field selection follows the dump.

### `league-rewards-tier3.json`

- Source path: `pages[1].battle.league_rewards["3"]`
- Selection: tier 3 in full -- rank brackets `1`, `4`, `15`, `30`, `45`, `60`, `75`, `200`, plus the `name` key
- Redactions: none (no PII; `shards` arrives as the string sentinel `"[circular]"` from the dump's circular-reference replacer)

## How to refresh

If a fresh dump is captured later:

1. Run the inspection helper from `docs-internal/test-strategy.md` "Data sources" to confirm key paths still match.
2. Reuse the same indices (49-51) and tier (3). If structural drift breaks that, document the new selection here.
3. Apply the same redactions: `nickname` -> `Player_<n>`, drop `player.club`.
