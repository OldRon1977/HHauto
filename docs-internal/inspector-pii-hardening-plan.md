# Inspector PII Hardening Plan

Status: 2026-05-08. Plan only -- no implementation yet.

## Status

- Current stage: not started.
- Trigger: stage 4 closure carried this forward as a separate
  feature track. The inspector userscript currently emits dumps
  that contain hero-side PII, auth tokens, exact stat fingerprints,
  and personal data of opposing players (League opponents,
  Champion-fight participants, club hierarchy). These dumps are
  fine for local-only debugging but block any user-to-user dump
  sharing.
- Target: inspector userscript v4.8.0 with an opt-in
  ``PII_MODE = "anonymize"`` mode that runs every captured page
  through a five-layer redaction pipeline before download. Default
  stays ``"off"`` so existing local-only workflows are unchanged.

## Context

### Inventory result from the v4.7.0 dump

A search for the developer's nickname on a real tour bundle found
**69 plain-text occurrences** of the player name across 18 pages.
The PII surface goes beyond the name:

| Cluster | Examples in dump | Where |
|---|---|---|
| Hero name | ``hero_infos.infos.name``, ``hero.hero_data.nickname``, multiple ``girls_full.game.shared.Hero`` copies | every page |
| Hero numeric IDs | ``hero_infos.infos.id``, all ``id_member`` / ``id_fighter`` references | every page |
| Club identity | ``hero_infos.club.{id_club, name, leader_id, leader_name, co_leaders[]}`` | every page |
| Auth token | ``hero_infos.club.chat_token`` (a base64 JWT with member_id, nickname, club_id and a signature) | every page |
| Stat fingerprint | ``hero_infos.infos.{caracs.*, Xp.cur, level, harem_endurance}``, ``hero_infos.infos.questing.{step, id_quest, id_world}`` | every page |
| Other players' nicknames | ``pages[*].teams.opponents_list[*].{nickname, player.nickname, player.club}``, ``pages[*].battle.championData.fight.participants[*].nickname`` (and avatar URLs) | League page, Champion page |
| Other players' IDs | ``opponents_list[*].id_member``, ``opponents_list[*].player.id_fighter``, ``co_leaders[]`` | League / Club pages |
| Asset URLs personalised by ID | ``footer_image_path``, ``avatar`` URLs in fight participants | every page that exposes them |

Even with the hero name removed, the combination of
``caracs.carac1/2/3 + level + xp + club_name + questing.step``
identifies a single player in the game (verified during the stage 4
closure inventory). Re-identification therefore requires layered
redaction, not just name stripping.

### Constraints

- The inspector is a single-file userscript
  (``bonus-scripts/HHAuto_debug_inspector.user.js``). The
  redaction pipeline must live inside that file (no external
  module).
- Only ``unsafeWindow``, the iframe contentWindow, and the
  emitted JSON object are touched. The pipeline must never modify
  game state or persist anything visible to the game.
- Test fixtures captured under ``spec/fixtures/`` today come from a
  non-anonymised dump on the developer's machine and stay
  un-anonymised. Anonymisation is for *sharing* output only, not
  for *consumption* of test data.

### Out of scope (deliberate)

- Server-side / Cloudflare-Worker post-processing -- everything
  happens in-browser before download.
- Re-running the test suite on anonymised dumps -- fixtures stay
  on real values; the redaction pipeline does not target the
  Stage 2 / 4 fixtures themselves.
- Stripping game asset CDN URLs that are not personalised
  (icons, generic backgrounds). Those are public.

## Architecture

### Activation modes

A single top-of-script constant controls the pipeline:

```js
const PII_MODE = "off"; // "off" | "anonymize"
```

- ``off`` (default, current behaviour): no redaction. The
  inspector emits a verbatim dump.
- ``anonymize``: the redaction pipeline runs after
  ``dumpEverything`` + ``fetchBlessings`` and before
  ``safeStringify`` / ``downloadJson``.

A second activation surface is the UI: an additional button
``DUMP THIS PAGE (ANONYMISED)`` next to the existing
``DUMP THIS PAGE`` (and a parallel toggle in the AUTO TOUR flow).
Either path runs the same pipeline; the constant is the single
source of truth that the buttons forward to.

### Redaction pipeline (five layers)

The pipeline is a list of pure functions
``(dump: Dict, ctx: AnonymiseContext) -> Dict``. Each layer reads
and writes the same dump object in place. The context carries an
ID hashmap and a per-dump random salt:

```js
const ctx = {
  salt: hexRandom(16),
  idMap: new Map(),  // canonical_id -> short hash like "abc123"
};
```

#### Layer 1 -- Plain-text stripping

Replaces literal player and club names everywhere in the dump.
Performed via deep traversal that, for every string value,
substitutes:

- the captured hero nickname -> ``Player_<heroHash>``
- the captured club name -> ``Club_<clubHash>``
- a small list of personalised URL prefixes -> empty string or
  ``[redacted]`` (e.g. ``footer_image_path`` if it embeds a
  user-specific share token).

The hero nickname and club name are read once at pipeline start
from the canonical sources
(``hero_infos.infos.name`` / ``hero_infos.club.name``).

#### Layer 2 -- Auth and token stripping

Removes (sets to ``"[redacted]"`` or deletes the property):

- ``hero_infos.club.chat_token`` (JWT).
- Any property whose key matches
  ``/(token|secret|csrf|cookie)/i``.
- Any string value that matches a heuristic token pattern
  (``[A-Za-z0-9+/]{40,}={0,2}`` or a JWT three-segment shape) and
  appears in keys not whitelisted as plausible game-data
  (whitelist still TBD; default is conservative redaction).

Pure stripping -- no replacement with synthetic tokens. A removed
token is never restored.

#### Layer 3 -- Consistent ID hashing

Walks the dump again with a recursive replacer that, for every
key matching one of the documented player-identifier patterns,
runs the value through ``hashId``:

```js
function hashId(rawId, ctx) {
  if (!ctx.idMap.has(rawId)) {
    ctx.idMap.set(rawId, shortHash(rawId + ":" + ctx.salt));
  }
  return ctx.idMap.get(rawId);
}
```

Hashed key list (re-confirm against fresh dump before
implementation):

- ``id_member``, ``id_fighter``, ``id_player``
- ``id_club``, ``leader_id``
- ``co_leaders[]`` (array of player IDs)
- ``id_team`` (per-page TeamData)
- ``id_quest``, ``id_world`` (questing block)
- ``created_by``

**Not hashed** (intentional, to keep test fixtures meaningful):

- ``id_girl``, ``id_girl_ref`` -- these are global game
  identifiers shared across all players. Hashing them would
  break Stage 2 / 4 fixtures and serves no PII purpose.

The salt is generated per dump and **not persisted**, so two
shared dumps cannot be cross-correlated through their hashes.

#### Layer 4 -- Stat fingerprint bucketing (optional)

Gated by an additional flag ``PII_BUCKET_FINGERPRINTS``
(default: ``true`` when ``PII_MODE === "anonymize"``, false
otherwise). Rounds high-precision stat values to 5%-buckets so
that ``carac1=56821`` becomes ``carac1=57000``. Targets:

- ``hero_infos.infos.caracs.*``
- ``hero_infos.infos.Xp.{cur, min, max, next_max, left}``
- ``hero_infos.infos.harem_endurance``
- ``hero_infos.infos.questing.step`` (round to 100)

**Tradeoff**: bucketing changes the values the test suite would
compute against if a future fixture ever sourced from an
anonymised dump. Layer 4 is therefore opt-in and clearly
flagged in the resulting dump's meta block as
``meta.pii_buckets_applied: true``.

#### Layer 5 -- Other players' data

Same redaction rules applied to non-hero records:

- ``pages[*].teams.opponents_list[*].nickname`` ->
  ``Opponent_<hashedId>``
- ``pages[*].teams.opponents_list[*].player.nickname`` -> dito
- ``pages[*].teams.opponents_list[*].player.club`` -> remove
  property entirely (would otherwise leak another player's
  club ID and name)
- ``pages[*].battle.championData.fight.participants[*].nickname``
  -> ``Participant_<hashedId>``
- ``pages[*].battle.championData.fight.participants[*].avatar``
  -> remove property (URLs encode the player's avatar choice)
- ``co_leaders[]`` -> already covered by Layer 3 hashing

Keeps the structure intact so the dump is still parseable; only
identifying surface is replaced.

### Audit metadata

The pipeline writes a small ``meta.pii`` block into the bundle:

```js
dump.meta.pii = {
  mode: "anonymize",
  layers_applied: ["plain_text", "tokens", "ids", "buckets", "opponents"],
  layer_counts: {
    plain_text: 69,    // matches replaced
    tokens_removed: 1,
    ids_hashed: 41,
    bucketed_fields: 8,
    opponents_redacted: 100
  },
  salt_present: true,  // never the salt itself
  pii_buckets_applied: true,
  inspector_version: VERSION,
  pipeline_version: 1
};
```

This audit block is **the only way to verify after-the-fact** that
a shared dump was actually anonymised. A consumer (or CI tool)
can grep for ``meta.pii.mode === "anonymize"`` before accepting
the dump as a reproduction input.

## Roadmap (5 slices)

Each slice is its own branch + PR, mirroring the stage 2 / 3 / 4
convention.

### Slice 1 -- Skeleton + Layer 1 + Layer 2

Branch: ``feat/inspector-pii-anonymize-skeleton``

- Add ``PII_MODE`` constant + ``PII_BUCKET_FINGERPRINTS`` flag.
- Add the pipeline scaffolding (``redactDump(dump, ctx) ->
  redactedDump``), called from ``performStep`` and the
  ``DUMP THIS PAGE`` click handler when ``PII_MODE !== "off"``.
- Implement Layer 1 (plain-text) and Layer 2 (tokens). These two
  unblock the first level of safety.
- Add the ``meta.pii`` audit block (with empty / partial counts
  for layers not yet active).
- Bump inspector to ``v4.8.0-pii-1``.

Acceptance:

- A non-anonymised dump (current default) is byte-identical to
  v4.7.0 except for the inspector ``VERSION`` constant.
- An anonymised dump no longer contains the hero nickname or the
  club ``chat_token`` anywhere (verified by a Python search
  script reused from the stage 4 inventory).

### Slice 2 -- Layer 3 (consistent ID hashing)

Branch: ``feat/inspector-pii-id-hashing``

- Implement ``hashId`` with a per-dump random salt.
- Walk the dump and apply hashing to the documented key list.
- Update the audit block with ``ids_hashed`` count.
- Bump to ``v4.8.0-pii-2``.

Acceptance:

- Same ``id_member`` value always maps to the same hash within
  one dump.
- Two anonymised dumps (different runs) do not produce the same
  hash for the same source ID (per-dump salt).
- ``id_girl`` / ``id_girl_ref`` remain unchanged.

### Slice 3 -- Layer 5 (opponents / champion fight / club)

Branch: ``feat/inspector-pii-other-players``

- Implement opponent and participant redaction with hash-based
  pseudonyms (``Opponent_<hash>`` keyed off the hashed
  ``id_member`` from Layer 3, so opponent and player references
  stay linked across pages).
- Drop ``player.club`` and ``participants[*].avatar``.
- Update the audit block.
- Bump to ``v4.8.0-pii-3``.

Acceptance:

- League opponent list still has 100 entries with all
  numeric / structural fields intact, only nicknames replaced
  and ``player.club`` gone.
- Champion fight participants still have their power /
  carac fields, only nicknames replaced and avatars dropped.

### Slice 4 -- Layer 4 (fingerprint bucketing, opt-in)

Branch: ``feat/inspector-pii-fingerprint-bucketing``

- Add 5%-bucketing for the documented stat fields plus 100-bucket
  for ``questing.step``.
- Gated by ``PII_BUCKET_FINGERPRINTS``; off by default unless
  ``PII_MODE = "anonymize"``.
- Audit block: ``bucketed_fields`` count and a sample of
  before/after pairs (truncated to first three).
- Bump to ``v4.8.0-pii-4``.

Acceptance:

- ``carac1=56821`` -> ``carac1=57000`` (rounded to nearest 5%).
- Test runs against existing fixtures stay green
  (``npm test`` -- no fixture comes from an anonymised dump).

### Slice 5 -- Docs + closure

Branch: ``feat/inspector-pii-docs`` (or
``chore/inspector-pii-close``)

- Update inspector header ``@description`` to mention the
  anonymise mode.
- Add a section to the inspector userscript's leading comment
  explaining ``PII_MODE``, ``PII_BUCKET_FINGERPRINTS``, the
  audit block, and the per-dump salt design.
- Add a brief ``docs-internal/inspector-pii-hardening.md``
  closure note linking back to this plan.
- Update ``README.md`` if user-facing instructions are needed.
- Final inspector version: ``v4.8.0`` (drop the ``-pii-N``
  suffix).

Acceptance:

- All four prior slices merged.
- ``@version`` / ``VERSION`` constant aligned to ``4.8.0``.
- A round-trip test: emit one anonymised dump, run a Python
  script that asserts none of the documented PII patterns
  survive, and append the script's output to this plan as an
  audit example.

## Open questions (deliberate, decided in the implementing session)

- Should ``PII_MODE`` be a runtime-configurable Tampermonkey menu
  command instead of a top-of-script constant? Pro: easy to
  toggle without editing the source. Con: easy to forget which
  mode is active. Suggested default: keep the constant, add a
  Tampermonkey menu command in slice 5 if requested.
- Should anonymised dumps be saved into a separate IndexedDB
  store so that ``REVIEW BUNDLE`` always shows the un-anonymised
  source? Or should we always anonymise on download and keep the
  raw dump only in IndexedDB? Default proposal: anonymise on
  download only; the IndexedDB store always holds the raw dump
  so the developer can re-emit if needed.
- Bucketing granularity for ``Xp.cur`` (5% might still be too
  precise on a level-645 hero). Decide once we have a second
  data point.

## References

- Test strategy plan: ``docs-internal/test-strategy.md``,
  stage 4 carry-forward block.
- Inventory pass: stage 4 closure conversation, 2026-05-08.
- Inspector: ``bonus-scripts/HHAuto_debug_inspector.user.js``
  (current ``v4.7.0`` at ``main`` HEAD ``3b9eb4a``).

## Change log

| Date | Change |
|---|---|
| 2026-05-08 | Plan drafted. No implementation yet. |
