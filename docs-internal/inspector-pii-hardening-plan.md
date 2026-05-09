# Inspector PII Hardening Plan

Status: 2026-05-09. Implementation complete -- inspector v4.8.0 (slices 1, 2, 3 merged).

## Status

- Current stage: complete (slice 3 of 3 merged).
- Inspector version: v4.8.0.
- Reference for issue triagers and contributors:
  ``docs-internal/inspector-pii-share-mode.md`` (canonical
  field-by-field listing of what is kept, dropped, and
  pseudonymised in a share-mode dump).
- User-facing entry point: README section "How to file a bug
  with a dump".

## Use case (single source of truth)

Public dumps end up as attachments on GitHub issues. They must
support investigation of the bugs users actually file. The
private repo dumps (``PII_MODE = "off"``) remain available to
the maintainer for cases that need full state.

### What public dumps must support

A scan of 200 issues (open + closed, 2023-09 to 2026-05) ranks
the recurring topics:

| # | Topic | Bug-labeled hits | What the data needs to show |
|---|---|---|---|
| 1 | Troll battles / bosses | 38 | Hero caracs, harem girls, equipment, energy levels, troll list |
| 2 | Harem-girl / equipment / Stuff Team | 34 | Full harem (girlsMap), equipment data, blessings, salary |
| 3 | New domains / boss names | 20 | (no dump needed -- handled via env config updates) |
| 4 | Events (Mythic, LoveRaid, Sultry, DP, Pass) | 19 | event_data, mega_event_*, event girls, sandalwood booster state |
| 5 | Navigation / loops / stuck | 15 | tour_meta, current page, HHAuto setting subset |
| 6 | Season + Season-Arena | 14 | opponents_list, league_rewards, synergies, energies |
| 7 | UI / menu / settings | 12 | (small subset of HHAuto settings) |

Roughly 70% of bugs need hero caracs + harem + battle game-state.
Roughly 30% additionally need a small slice of HHAuto settings
(timer / threshold / event-toggle keys). Re-identification-relevant
fields (Club, Quest, XP, league points, opponent nicknames,
chat_token, browser locale) are needed for none of the bug
categories.

### Non-goals

- Schema-only / pure-audit dumps. The previous draft listed an
  ``"anonymize"`` mode for that; dropped because no user has
  ever asked for it.
- Round-trip parity with the local-only dump. The shared dump
  should be useful, not equivalent.
- Re-anonymising existing public dumps after the fact. Anyone
  who shared a dump pre-v4.8.0 is on their own.

## Architecture

### Activation

A single top-of-script constant controls the pipeline:

```js
const PII_MODE = "off"; // "off" | "share"
```

- ``off`` (default, current behaviour): no redaction, full
  dump.
- ``share``: the share pipeline runs after ``dumpEverything`` +
  ``fetchBlessings`` and before ``safeStringify`` /
  ``downloadJson``.

A second activation surface is the UI: an additional button
``DUMP FOR SHARING`` next to the existing ``DUMP THIS PAGE``.
Either path runs the same pipeline; the constant is the single
source of truth.

### Share pipeline (whitelist + four steps)

The pipeline is a sequence of pure functions
``(dump: Dict, ctx: ShareContext) -> Dict``. The context carries
the per-dump random salt and an ID hashmap:

```js
const ctx = {
  salt: hexRandom(16),
  idMap: new Map(),  // id_girl -> short hash like "g_abc123"
};
```

#### Step 0 -- Top-level whitelist

The whitelist defines which top-level keys of each ``page``
survive. Everything else is dropped before any other step runs.

Per ``page`` keys kept:

- ``tour_meta`` (label, expected_page, actual_page, match)
- ``game_context.body_page`` (only this sub-key)
- ``meta`` (full -- per-page meta)
- ``hero_infos`` (heavily filtered, see below)
- ``girls_full`` (full -- contains the harem)
- ``battle`` (heavily filtered, see below)
- ``teams`` (filtered to numeric / structural fields only)
- ``ajax_observed`` (full -- already redactable in v4.7.0
  format)
- ``local_storage`` (filtered to a settings whitelist)

Per ``page.hero_infos`` keys kept:

- ``infos.level``
- ``infos.class``
- ``infos.caracs`` (full sub-object)
- ``infos.questing.id_world``  (only -- step / id_quest /
  num_step / current_url are redacted)

Per ``page.battle`` keys kept:

- ``daily_goals_list``
- ``contests_timer``
- ``event_data`` (with ``girls`` whitelisted -- see Step 3)
- ``current_event``
- ``mega_event_active``
- ``mega_event_time_remaining`` (rounded to nearest minute --
  see Step 5)
- ``labyrinth_data``
- ``penta_drill_data``
- ``synergies``
- ``love_raids``
- ``championData`` (with ``fight.participants`` redacted -- see
  Step 3)
- ``league_rewards``
- ``current_tier_number``

Per ``page.teams`` keys kept:

- ``opponents_list[*]`` keeps ``level``, ``power``, ``place``,
  ``country``, ``can_fight``, ``current_season_mojo`` from
  ``player``, ``boosters`` if present.
- All ``nickname`` / ``player.nickname`` / ``player.club`` /
  ``id_member`` / ``id_fighter`` / ``match_history`` /
  ``player_league_points`` are dropped or redacted in Step 3.

Top-level keys to drop entirely (page-level cleanup):

- ``hero`` (raw window globals copy -- redundant with
  ``hero_infos``)
- ``hh_namespace`` and ``shared_namespace`` (full game globals;
  re-identifying via runtime versions / browser state)
- ``dom_data_attributes`` (page-render fingerprint)
- ``girl_sources`` (debug listing)
- ``hero_infos.infos.footer_image_path`` and similar
  asset-personalisation fields
- ``hero_infos.club`` (entirely -- Club identifies the player
  at-rank-N in the club list)
- ``hero_infos.infos.Xp`` (entirely -- exact XP is a strong
  fingerprint over time)
- ``hero_infos.infos.harem_endurance`` and other infos fields
  not in the keep-list

#### Step 1 -- Plain-text and asset-URL stripping

Recursive walk over the post-whitelist dump. For every string
value:

- Replace the captured hero nickname with ``[redacted]``.
- Replace any string that matches a personalised CDN URL
  pattern (``/[a-f0-9]{32}\.png``, JWT-shaped tokens, etc.) with
  ``[redacted]``.
- Drop ``hero_infos.club.chat_token`` and any property whose key
  matches ``/(token|secret|csrf|cookie)/i`` (defence in depth --
  the whitelist already removes ``hero_infos.club``).

The hero nickname is read once at pipeline start from the
canonical source (``hero_infos.infos.name``) before Step 0 runs.

#### Step 2 -- Settings whitelist

The Inspector currently captures every ``HHAuto_Setting_*`` and
``HHAuto_Temp_*`` key (~188 entries). Only a small subset is
relevant for the recurring bug categories. Replace the
``local_storage`` block with a filtered copy that retains only:

**Threshold / timer / paranoia**

- ``HHAuto_Setting_paranoia``, ``HHAuto_Setting_paranoiaSettings``
- ``HHAuto_Setting_paranoiaSpendsBefore``
- ``HHAuto_Setting_safeSecondsForContest``
- ``HHAuto_Setting_collectAllTimer``
- ``HHAuto_Setting_buyCombat``, ``HHAuto_Setting_buyCombTimer``
- ``HHAuto_Setting_buyMythicCombat``,
  ``HHAuto_Setting_buyMythicCombTimer``

**Auto-X domain toggles + thresholds (per HHAuto domain)**

- League: ``autoLeagues``, ``autoLeaguesCollect``,
  ``autoLeaguesAllowWinCurrent``,
  ``autoLeaguesBoostedOnly``, ``autoLeaguesRunThreshold``,
  ``autoLeaguesForceOneFight``,
  ``autoLeaguesSelectedIndex``, ``autoLeaguesSortIndex``,
  ``autoLeaguesThreshold``, ``autoLeaguesSecurityThreshold``
- Season: ``autoSeason``, ``autoSeasonCollect``,
  ``autoSeasonCollectAll``, ``autoSeasonIgnoreNoGirls``,
  ``autoSeasonPassReds``, ``autoSeasonThreshold``,
  ``autoSeasonRunThreshold``, ``autoSeasonMaxTier``,
  ``autoSeasonMaxTierNb``, ``autoSeasonBoostedOnly``,
  ``autoSeasonSkipLowMojo``
- PentaDrill: ``autoPentaDrill``,
  ``autoPentaDrillCollect``, ``autoPentaDrillCollectAll``,
  ``autoPentaDrillThreshold``,
  ``autoPentaDrillRunThreshold``,
  ``autoPentaDrillBoostedOnly``
- Champion: ``autoChamps``,
  ``autoChampAlignTimer``,
  ``autoChampsForceStart``, ``autoChampsFilter``,
  ``autoChampsTeamLoop``, ``autoChampsGirlThreshold``,
  ``autoChampsTeamKeepSecondLine``,
  ``autoChampsUseEne``, ``autoBuildChampsTeam``,
  ``autoChampsForceStartEventGirl``, ``autoClubChamp``,
  ``autoClubChampMax``, ``autoClubForceStart``
- Troll: ``autoTrollBattle``,
  ``autoTrollMythicByPassParanoia``,
  ``autoTrollSelectedIndex``, ``autoTrollThreshold``,
  ``autoTrollRunThreshold``,
  ``autoTrollLoveRaidByPassThreshold``,
  ``eventTrollOrder``, ``autoBuyTrollNumber``,
  ``autoBuyMythicTrollNumber``
- LoveRaid: ``autoLoveRaidMythicOnly``, ``plusLoveRaid``,
  ``autoLoveRaidSelectedIndex``,
  ``buyLoveRaidCombat``,
  ``autoBuyLoveRaidTrollNumber``
- Bundles: ``autoFreeBundlesCollect``,
  ``autoFreeBundlesCollectablesList``
- Events: ``plusEventSandalWood``,
  ``plusEventMythicSandalWood``,
  ``plusEventLoveRaidSandalWood``, ``plusGirlSkins``
- Pantheon: ``autoPantheonBoostedOnly``
- Pachinko: ``autoFreePachinko``
- Boosters: ``autoBuyBoosters``, ``autoBuyBoostersFilter``,
  ``autoEquipBoosters``, ``autoEquipBoostersSlots``,
  ``maxBooster``, ``minShardsX10``, ``minShardsX50``,
  ``sandalwoodMinShardsThreshold``, ``useX10Fights``,
  ``useX50Fights``
- Salary: ``autoSalary``, ``autoSalaryMinSalary``
- Stats: ``autoStats``, ``autoStatsSwitch``
- General: ``mousePause``, ``mousePauseTimeout``,
  ``waitforContest``, ``master``, ``updateMarket``

**Temp values worth keeping for diagnosis**

- ``HHAuto_Temp_sandalwoodMaxUsages``
- ``HHAuto_Temp_boosterStatus`` (post Step 1 redaction --
  contains item IDs only)

All other ``HHAuto_*`` storage keys are dropped. UI-customisation
toggles, persistence flags, and per-user statistics are not
needed for the bug categories above.

#### Step 3 -- ID hashing and pseudonymisation

Walk the dump and apply ``hashId`` to:

- ``id_girl`` and ``id_girl_ref`` (every occurrence) -- with
  per-dump salt for cross-dump non-correlation.
- ``id_member``, ``id_fighter`` in opponents lists / champion
  participants.
- ``id_team`` (per-page TeamData).

For every entry in the harem (``girlsMap`` / ``availableGirls``)
plus every event-girl listing (``current_event.girls``,
``event_data.girls``, ``event_girls``), replace the ``name`` field
with a sequential pseudonym:

- The harem list is randomly shuffled (per-dump random
  permutation, not persisted) so that two dumps from the same
  player do not produce the same ``GirlNNNN`` ordering.
- After shuffling, names become ``Girl0001``, ``Girl0002``,
  ... ``GirlNNNN``.
- Event-girl lists get ``EventGirl0001``, ``EventGirl0002``, ...
- Champion-team lists get ``TeamGirl0001``, ``TeamGirl0002``, ...

The pseudonym is keyed off the position in the (shuffled) list,
so the dump still carries usable structure ("the team picked
girl 3 of the harem in slot 1") without revealing which
canonical girl was meant.

For opponent / participant nicknames:

- ``opponents_list[*].nickname`` and ``.player.nickname`` ->
  ``Opponent_<hashId>``
- ``participants[*].nickname`` -> ``Participant_<hashId>``
- ``participants[*].avatar`` -> drop entirely
- ``opponents_list[*].player.club`` -> drop entirely

Hash references stay consistent within one dump (an opponent
referenced by ``id_member`` in two pages produces the same
``Opponent_<hashId>`` both times).

#### Step 4 -- Audit block

The pipeline writes a small ``meta.pii`` block into the bundle:

```js
dump.meta.pii = {
  mode: "share",
  pipeline_version: 1,
  inspector_version: VERSION,
  pages_processed: pages.length,
  layers_applied: [
    "top_level_whitelist",
    "plain_text_strip",
    "settings_whitelist",
    "id_hash_and_pseudonymise",
  ],
  layer_counts: {
    top_level_keys_dropped: 7,
    plain_text_replacements: 87,
    storage_keys_dropped: 138,
    storage_keys_kept: 50,
    ids_hashed: 41,
    girls_pseudonymised: 1716,
  },
  salt_present: true, // never the salt itself
};
```

This audit block is the only way for a consumer (issue triager,
CI tool) to verify that a shared dump went through the share
pipeline. A receiver can grep for ``meta.pii.mode === "share"``
before accepting the dump.

#### Step 5 -- Time / counter rounding (small but important)

Two values that turn into a fingerprint over multiple dumps:

- ``meta.timestamp`` (Inspector's own dump timestamp) ->
  rounded to the hour.
- ``mega_event_time_remaining`` -> rounded to the minute.
- All ``timestamp_ms`` / ``duration_ms`` fields inside
  ``ajax_observed`` -> redacted to ``null``.
- ``server_time``, ``starts_in``, ``remaining_time`` from
  blessings live and event timers are kept (already public-data
  ranges).

## Roadmap (3 slices)

Each slice is its own branch + PR, mirroring the stage 2 / 3 / 4
convention.

### Slice 1 -- Whitelist + Steps 1, 2

Branch: ``feat/inspector-pii-share-skeleton``

- Add ``PII_MODE`` constant + UI button ``DUMP FOR SHARING``.
- Implement Step 0 (top-level whitelist), Step 1 (plain-text +
  token strip), Step 2 (settings whitelist).
- Add the ``meta.pii`` audit block (with empty / partial counts
  for steps not yet active).
- Bump inspector to ``v4.8.0-share-1``.

Acceptance:

- An ``off``-mode dump is byte-identical to v4.7.0 except for
  the ``VERSION`` constant.
- A ``share``-mode dump no longer contains the hero nickname,
  the ``chat_token``, the entire ``hero_infos.club`` block, the
  full ``HHAuto_Setting_*`` export, ``hero_infos.infos.Xp``,
  ``hero_infos.infos.questing.{step, id_quest, num_step,
  current_url}``, ``hh_namespace``, ``shared_namespace``,
  or ``dom_data_attributes``.
- A Python verifier script (reused from the stage 4 inventory
  pass) confirms zero remaining occurrences of the captured
  hero nickname.

### Slice 2 -- Step 3 (ID hashing + pseudonyms + shuffle) + Step 5 (rounding)

Branch: ``feat/inspector-pii-share-pseudonyms``

- Implement ``hashId`` with a per-dump random salt.
- Walk every harem / event-girl / champion-team list, shuffle,
  pseudonymise.
- Hash opponent / participant ``id_member`` references and
  drop nicknames + avatars.
- Round ``meta.timestamp`` to the hour and
  ``mega_event_time_remaining`` to the minute. Strip
  ``ajax_observed[*].{timestamp_ms, duration_ms}``.
- Update the audit block.
- Bump to ``v4.8.0-share-2``.

Acceptance:

- Same ``id_girl`` value always maps to the same hash within
  one dump. Two share-mode dumps from the same player produce
  different hashes for the same source ID (per-dump salt).
- Harem ordering differs between two share-mode dumps of the
  same player (shuffle).
- ``Girl0001`` does not correspond to the same canonical girl
  across two dumps.

### Slice 3 -- Docs + closure

Branch: ``feat/inspector-pii-share-docs``

- Update inspector header ``@description`` to mention the
  share mode.
- Add a section to the inspector userscript's leading comment
  explaining ``PII_MODE``, the audit block, and the per-dump
  salt design.
- Add ``docs-internal/inspector-pii-share-mode.md`` -- a short
  closure note linking back to this plan and listing the
  fields kept / dropped in the share dump (the canonical
  reference for issue triagers).
- Update ``README.md`` with a short "How to file a bug with a
  dump" section.
- Final inspector version: ``v4.8.0`` (drop the
  ``-share-N`` suffix).

Acceptance:

- All two prior slices merged.
- ``@version`` / ``VERSION`` constant aligned to ``4.8.0``.
- Round-trip test: emit one share-mode dump, run a Python
  verifier that asserts none of the documented PII patterns
  survive, and append the verifier's output to this plan as
  an audit example.

## Open questions (deliberate, decided in the implementing session)

- Should the share-mode harem shuffle be deterministic on
  ``salt`` so that re-running on the same dump produces the
  same pseudonyms? Pro: stable diffs between two anonymisation
  runs of the same source. Con: makes the share pipeline a
  pure function of ``(dump, salt)``, which is easier to verify
  but a known property an attacker can exploit. Default
  proposal: yes, deterministic on salt; the salt is randomised
  per dump anyway.
- Should ``ajax_observed`` carry full request bodies or only
  endpoint metadata? Some issue categories (Mythic event loop)
  benefit from the bodies. Default proposal: keep bodies, run
  Step 1 plain-text strip over them so any leaked PII is
  caught.
- Should we add an explicit ``meta.pii.warning_for_user``
  field that says "this dump went through anonymisation;
  contact the maintainer privately if you need full state"?
  Default proposal: yes, makes the share dump self-documenting.

## References

- Test strategy plan: ``docs-internal/test-strategy.md``,
  stage 4 carry-forward block.
- Inventory pass: stage 4 closure conversation, 2026-05-08.
- Issue topic analysis: 200 issues sampled 2026-05-08 (top 7
  bug clusters listed above).
- Inspector: ``bonus-scripts/HHAuto_debug_inspector.user.js``
  (current ``v4.7.0`` at ``main`` HEAD ``3b9eb4a``).

## Change log

| Date | Change |
|---|---|
| 2026-05-08 | Plan drafted -- 5-layer pipeline, 5 slices. |
| 2026-05-08 | Plan rewritten after issue topic scan and tighter use-case definition. Single ``share`` mode. Whitelist-based instead of layer-based. 3 slices instead of 5. Caracs intentionally NOT bucketed (Team-Auswahl-Logik braucht echte Werte). |
| 2026-05-08 | Slice 1 merged (PR #1663). PII_MODE constant + DUMP FOR SHARING button + Steps 0/1/2 + audit block. Inspector v4.8.0-share-1. |
| 2026-05-09 | Slice 2 merged (PR #1665). Step 3 (FNV-1a 64-bit + per-dump salt + mulberry32 shuffle + pseudonyms) and Step 5 (rounding). Inspector v4.8.0-share-2. |
| 2026-05-09 | Slice 3 merged. Doku closure: header @description, leading comment block, ``docs-internal/inspector-pii-share-mode.md``, README "How to file a bug with a dump". Final inspector v4.8.0. |
