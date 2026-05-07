# Champion fixtures

## Source

- Dump: `INPUT/hhauto_dump_www_hentaiheroes_com_tour_2026-05-05T12-11-40-985Z.json`
- Capture date: 2026-05-05T12:08:27Z
- Page index: 7 (`/club-champion.html`)

## Plan deviation

The strategy plan listed page index 8 (`/champions-map.html`) and two
files (`champion-map.json`, `active-champion.json`). Reality from the
dump:

- Page 8 (`/champions-map.html`) carries no champion data. The map is
  rendered client-side from DOM only; the dump's
  `dom_data_attributes` payload for that page is the page chrome,
  not parser-relevant.
- Page 7 (`/club-champion.html`) carries the active-champion data
  under `battle.championData`, plus the champion's team under
  `girls_full["game.championData.team"]` (the inspector serialises
  the team there to break the circular reference that would otherwise
  appear at `battle.championData.team`).

Stage 2 ships only `active-champion.json` (one file, page 7).
A `champion-map.json` is intentionally not produced -- there is
nothing in the dump to extract for it. The map decision logic
(`Champion.pure.ts decideNextChampionTime` from stage 1 task 1.2)
operates on a DOM-derived list and would need an HTML fixture, which
the strategy plan blocks ("snapshot tests for HTML"). Champion-map
fixtures are therefore deferred until a different testing approach
for DOM-derived state is in scope.

## Files

### `active-champion.json`

- Source paths:
  - `pages[7].battle.championData` (everything except `team`)
  - `pages[7].girls_full["game.championData.team"]` (substituted in
    for the circular `team` field)
- Contents:
  - `champion` -- id, name, lairName, tier, poses, class, bar
    `{current,max}`, currentTickets, maxMultipleBattles,
    battlePriceIncrease, level, plus `girl` reduced to a parser
    whitelist (id_girl, id_girl_ref, name, class, figure, element,
    rarity, level, nb_grades, carac1..3).
  - `timers` -- `championFight`, `teamRest`, `championRest`.
  - `team` -- 10 entries from the separate dump path; each entry
    keeps `id_girl`, `class`, `figure`, `rarity`, `damage`.
  - `canDraft`, `freeDrafts`, `priceEnergy`, `hero_damage` -- as-is.
  - `reward` -- `loot` flag and the four `rewards` entries; each
    `value.item` keeps the parser-relevant fields, the `ico` asset
    url is dropped.
  - `fight` -- `id_fight`, `start_time`, `active`, plus 19
    `participants`. Per participant: `id_member`, `level`,
    `challenge_impression_done`, `challenge_count`. `nickname`
    is replaced with `Player_<n>`, `avatar` is dropped.
- Asset urls dropped (champion-level): `image`, `portrait`,
  `endSceneImage`, `bubbleText`, `endSceneText` (the last two are
  flavour text that frequently echoes player-facing localisation
  drift; not parser-relevant).
- Asset urls dropped (item / team / participant level): `item.ico`,
  `team[].ico`, `participants[].avatar`.
- PII redactions: `participants[].nickname` -> `Player_1..19`.
  `champion.lairName` is preserved (it identifies the in-game club's
  champion lair, which is semi-public information visible to anyone
  fighting the champion; redacting it would change the parser shape).

## How to refresh

If a fresh dump is captured later:

1. Confirm the active champion is on page 7 (`/club-champion.html`).
2. Re-run the extraction with the same field whitelists. If the
   shape drifts (e.g. new keys added to `championData`), document
   the choice here.
3. Re-redact `participants[].nickname` and drop new asset URLs.
4. Run the PII / asset-url scan in the extraction script before
   committing.
