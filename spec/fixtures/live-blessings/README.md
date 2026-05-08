# live-blessings fixtures

## Source

- Dump: `INPUT/hhauto_dump_www_hentaiheroes_com_tour_2026-05-05T12-11-40-985Z.json`
- Capture date: 2026-05-05T12:11:40Z
- Source path per page: `pages[<idx>].live_blessings_api.live`
- Capture wrapper: the dump inspector wraps the AJAX response as
  `{ live: <response>, error: null }`. Stored fixture content is the
  inner `live` value -- the actual game-API response, the same shape
  `BlessingService.fetchAndCache()` receives in production.

## Files

- `page-00.json` -- snapshot from `pages[0].live_blessings_api.live`
- `page-14.json` -- snapshot from `pages[14].live_blessings_api.live`
- `page-29.json` -- snapshot from `pages[29].live_blessings_api.live`

## Selection rationale

All 30 dump pages carry the same `live_blessings_api.live` envelope
shape (`{ active[3], upcoming[3], success: true }`); the inspection
script confirmed identical structure across pages. The three captured
files are temporal snapshots from start, middle, and end of the dump
sequence (indices 0 / 14 / 29). Inhalt-Drift between them is limited to
the seconds-resolution `remaining_time` and `starts_in` counters --
the dump captures one tour through the game, so the active/upcoming
title set is the same across pages. The three files are kept anyway so
the schema test feeds three independent samples through every parser
branch (position, eye color, labyrinth-filter rejection, hair color
in upcoming, role/element in upcoming).

## Fields kept

Whole envelope, no field reduction:

- `active[]` -- 3 entries
- `upcoming[]` -- 3 entries
- `success` -- bool
- per entry: `title`, `description` (HTML snippet with
  `<span class="blessing-condition">` + `<span class="blessing-bonus">`),
  `remaining_time` (int seconds, may be negative),
  `starts_in` (int seconds, negative while active)

## Redactions

None. The endpoint carries no PII, no asset URLs, no numeric IDs --
only blessing titles and bonus descriptions in the game's own English
strings, plus second-resolution timers.

## Consumers

- `src/Service/BlessingService.ts`:
  - `parseTraits(response)` -- categorises active blessings by trait
    family; rejects "Love Labyrinth"-only blessings
  - `parseBlessedValues(response)` -- extracts the trait value from
    the `blessing-condition` span
  - `parseElement(response)` -- maps element blessings to one of the
    eight game elements
  - `parseBlessingPercent(response, category)` -- pulls the numeric
    percent from the `+ NN%` pattern in the description

All four are pure functions on `response.active` and import no DOM,
no jQuery, no `unsafeWindow`.

## How to refresh

If a fresh dump is captured later:

1. Re-pick three pages with the same indices (0 / 14 / 29). If the
   dump has fewer than 30 pages, adjust the indices and document the
   new selection here.
2. Each fixture file stores `pages[<idx>].live_blessings_api.live`
   verbatim -- no field selection, no redaction.
3. Verify the schema test still passes against the new files. If the
   game adds new top-level keys to the response, the parser tests
   continue to pass (they only assert no-crash plus type plausibility);
   if the game renames `active` / `upcoming`, the parsers fall back to
   their `Array.isArray` guards and return empty results, which the
   schema test still accepts.
