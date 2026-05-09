# Inspector PII Share-Mode -- Canonical Reference

Status: 2026-05-09. Implemented in inspector v4.8.0
(`bonus-scripts/HHAuto_debug_inspector.user.js`).

This document is the canonical reference for issue triagers and
contributors who need to know what a public share-mode dump
contains, what is missing on purpose, and how to verify a dump
came through the pipeline.

For the design history and rationale see
`docs-internal/inspector-pii-hardening-plan.md`.

## What share-mode is

Share mode is an opt-in anonymisation pipeline that runs on the
inspector dump before it is downloaded. Default behaviour
(`PII_MODE = "off"`, button `DUMP THIS PAGE`, `AUTO TOUR`) is
unchanged: full local-only dump with hero PII, chat_token, full
HHAuto settings, opponent nicknames, browser fingerprint blocks.

Share mode is activated by either:

* the dedicated `DUMP FOR SHARING` button in the inspector overlay
  (forces share mode for that one click); or
* setting `PII_MODE = "share"` at the top of the userscript, which
  routes both `DUMP THIS PAGE` and `AUTO TOUR` through the share
  pipeline.

A share-mode dump is suitable for attaching to a public GitHub
issue. The default dump is not.

## Pipeline overview

The pipeline is a sequence of pure functions on the dump bundle.
Order inside `applyShareModePipeline()` per page:

| Order | Step | Purpose |
|---|---|---|
| 1 | Step 3 -- ID hashing + pseudonyms + shuffle | rewrites identity fields on the raw page before the whitelist drops them |
| 2 | Step 5 -- time / counter rounding | rounds timestamps and durations on the raw page |
| 3 | Step 0 -- top-level whitelist | drops everything outside the keep-list |
| 4 | Step 2 -- settings whitelist | filters `local_storage` to the per-domain HHAuto setting subset |
| 5 | Step 1 -- plain-text strip | recursive walk that catches nickname, JWT, and CDN-hash leaks as a backstop |
| 6 | Step 4 -- audit block | writes `meta.pii` describing what ran |

A fresh random salt is generated per dump from
`crypto.getRandomValues` and never persisted. Two consecutive
share-mode dumps from the same player produce decorrelated
hashes and a different harem permutation.

## Fields kept in a share-mode dump

Per page (top-level keep-list):

| Field | Notes |
|---|---|
| `tour_meta` | label, expected_page, actual_page, match |
| `meta` | timestamp rounded to the hour |
| `game_context.body_page` | only this sub-key |
| `hero_infos.infos.level` | |
| `hero_infos.infos.class` | |
| `hero_infos.infos.caracs` | full sub-object -- needed for team-selection bugs |
| `hero_infos.infos.questing.id_world` | only this sub-key |
| `girls_full` | full harem; girl `name` replaced with sequential pseudonyms (`Girl0001`, ...); `id_girl`, `id_girl_ref` hashed |
| `battle.daily_goals_list` | |
| `battle.contests_timer` | |
| `battle.event_data` | event girls have pseudonyms `EventGirl0001`, ... |
| `battle.current_event` | event girls have pseudonyms `EventGirl0001`, ... |
| `battle.mega_event_active` | |
| `battle.mega_event_time_remaining` | rounded to the minute |
| `battle.labyrinth_data` | |
| `battle.penta_drill_data` | |
| `battle.synergies` | |
| `battle.love_raids` | |
| `battle.championData` | `fight.participants[*].nickname` becomes `Participant_<hash>`; `.avatar` dropped |
| `battle.league_rewards` | |
| `battle.current_tier_number` | |
| `teams.opponents_list[*]` | only `level`, `power`, `place`, `country`, `can_fight`, `current_season_mojo`, `boosters`, `nickname`, `id_member`, `id_fighter`, `player`. `nickname` becomes `Opponent_<hash>`; `id_member`/`id_fighter` hashed; `player.club` dropped |
| `teams` other arrays | kept structurally; nicknames inside (e.g. `leaguesPlayersData`) get plain-text-stripped where they reference the hero, otherwise they pass through |
| `ajax_observed` | full request bodies kept; `timestamp_ms` and `duration_ms` set to null; nickname/JWT/CDN-hash leaks redacted by Step 1 |
| `local_storage` | only ~90 whitelisted `HHAuto_Setting_*` / `HHAuto_Temp_*` keys (timer/threshold/paranoia/per-domain auto-X toggles) |
| `meta.pii` | audit block, see below |

## Fields dropped or rewritten

Top-level page-cleanup drops:

| Field | Reason |
|---|---|
| `hero` | raw `window.Hero` copy -- redundant with `hero_infos`, leaks chat_token |
| `hh_namespace` | full game globals, runtime version fingerprint |
| `shared_namespace` | same |
| `dom_data_attributes` | page-render fingerprint |
| `globals_overview` | global-key listing, fingerprint |
| `girl_sources` | debug listing, redundant with `girls_full` |
| `market_equipment` | not needed for the recurring bug categories |
| `live_blessings_api` | server fingerprint, not needed for bug categories |

Inside `hero_infos`:

| Field | Reason |
|---|---|
| `hero_infos.club` (entire) | identifies the player at-rank-N in the club list, plus chat_token |
| `hero_infos.infos.name` | hero nickname |
| `hero_infos.infos.Xp` | exact XP is a strong fingerprint over time |
| `hero_infos.infos.questing.step` | quest progress fingerprint |
| `hero_infos.infos.questing.id_quest` | same |
| `hero_infos.infos.questing.num_step` | same |
| `hero_infos.infos.questing.current_url` | same |
| `hero_infos.infos.footer_image_path` | personalised CDN asset |
| `hero_infos.infos.wister_mobile_footer_image_path` | same |
| `hero_infos.infos.harem_endurance` | not needed |
| any other `hero_infos.infos.*` | not on the keep-list |

Plain-text strip (defence in depth, runs after the whitelist):

* hero nickname -> `[redacted]`
* JWT-shaped tokens (3 base64url-ish segments) -> `[redacted]`
* personalised CDN paths `/[a-f0-9]{32}\.(png|jpg|jpeg|webp|gif)` -> `/[redacted]`
* any property whose key matches `/(token|secret|csrf|cookie)/i` -> dropped

Settings whitelist (Step 2): see the inspector source for the
exact ~90 keys (`SHARE_SETTINGS_WHITELIST`). The list covers
threshold / timer / paranoia, plus all per-domain auto-X toggles
relevant for the seven recurring bug categories. UI-customisation
flags, persistence trackers, and per-user statistics are not
included.

## Pseudonym format

| Source | Pseudonym |
|---|---|
| harem girl name | `Girl0001`, `Girl0002`, ... (sequential per dump after a salt-seeded shuffle) |
| event girl name | `EventGirl0001`, `EventGirl0002`, ... |
| champion-team girl name | `TeamGirl0001`, `TeamGirl0002`, ... |
| opponent nickname (with id_member) | `Opponent_<12-hex-hash>` |
| opponent nickname (bot, id_member 0/null) | `Opponent_anon0001`, ... (per-dump counter) |
| participant nickname (with id_member) | `Participant_<12-hex-hash>` |
| participant nickname (bot) | `Participant_anon0001`, ... |
| `id_girl`, `id_girl_ref`, `id_member`, `id_fighter`, `id_team` | 12-hex FNV-1a hash |

The hash is FNV-1a 64-bit (BigInt-based, synchronous), keyed on
`salt + ":" + value`, output truncated to 12 hex chars. This is
not a cryptographic primitive; the threat boundary is the secrecy
of the salt, which is fresh per dump and not persisted.

## Audit block (`meta.pii`)

A receiver can grep for `meta.pii.mode === "share"` to confirm
a dump went through the pipeline.

Fields:

| Field | Type | Notes |
|---|---|---|
| `mode` | string | always `"share"` |
| `pipeline_version` | int | currently `2` |
| `inspector_version` | string | currently `"4.8.0"` |
| `pages_processed` | int | bundle.pages.length |
| `layers_applied` | string[] | `["top_level_whitelist", "plain_text_strip", "settings_whitelist", "id_hash_and_pseudonymise", "rounding"]` |
| `layer_counts.top_level_keys_dropped` | int | per-page top-level keys discarded by the whitelist |
| `layer_counts.plain_text_replacements` | int | strings touched by Step 1 |
| `layer_counts.token_keys_dropped` | int | properties whose key matched the token regex |
| `layer_counts.storage_keys_kept` | int | localStorage keys retained |
| `layer_counts.storage_keys_dropped` | int | localStorage keys discarded |
| `layer_counts.ids_hashed` | int | unique source ids that went through `shareHashId` |
| `layer_counts.girls_pseudonymised` | int | girls whose name was replaced with a pseudonym |
| `layer_counts.timestamps_rounded` | int | timestamp / duration fields touched by Step 5 |
| `warning_for_user` | string | `"Dump went through anonymisation. Suitable for public bug reports."` |
| `salt_present` | bool | always `true` for share-mode (the salt itself is never written) |

## Verifier

A Python verifier lives in `docs-internal/skripte/verify_share_dump.py`
(local-only, gitignored). It checks the audit block, runs the
plain-text and id-pseudonym patterns, validates rounding, and
exits non-zero on any violation.

Usage:

```
python docs-internal/skripte/verify_share_dump.py <dump.json> [--nickname NAME]
```

The `--nickname` argument is optional; pass it to also check that
the captured hero nickname does not appear anywhere as a
substring (catches plain-text leaks the regex patterns would not
otherwise detect).

## Out of scope

* Re-anonymising existing public dumps after the fact: anyone who
  shared a dump pre-v4.8.0 is on their own.
* Schema-only / pure-audit dumps (no payload): never asked for, not
  implemented.
* Round-trip parity with the local-only dump: the share dump is
  designed to be useful for bug triage, not equivalent to the full
  dump.