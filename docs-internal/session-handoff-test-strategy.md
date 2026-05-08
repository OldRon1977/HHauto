# Session handoff -- HHAuto test strategy, stage 4

Status: 2026-05-08. Stage 3 is finished and merged into main (final
closure commit will land via this branch). Plan file
`docs-internal/test-strategy.md` is the source of truth and already
contains the detailed entry point for stage 4.

## Prompt for the new session (copy-paste into a fresh chat)

```
We continue the HHAuto test strategy. Stage 3 is finished and merged.
Plan file: `docs-internal/test-strategy.md` is the source of truth.

== Language and style ==
German output, terse, no filler. Direct and factual responses.
Workspace rules apply: Git identity oldron1977@gmail.com, workflow
(branch -> implement -> commit -> push -> approval -> PR -> rebase
merge), agent anonymity (no AI / Co-Authored-By in commits, branches,
PR text, or code), file writes via Python+UTF8 only (workspace rule
05_File_Write_Workaround).

Repository content (commits, PR/issue text, code comments,
docs-internal) is in English.

== Path ==
c:\Users\StephanMesser\.kiro\Arbeitsplatz\HHAuto

== First action ==
1. Read `docs-internal/test-strategy.md`. The status block on top
   tells you where we are. Stage 3 is closed; stage 4 starts with
   task 4.1 (AJAX schema tests).
2. Read this handoff in full -- the stage-4 conventions, fixture
   inventory, pure-function inventory, and parking lot are spelled
   out below to avoid a guessing round.
3. Confirm the proposed first slice (4.1) with the user before
   touching production code. Stage 4 changes are allowed under
   `src/` only when an AJAX validator or a storage-migration helper
   is being added; everything else must stay in `spec/`.

== Stage 4 entry point: task 4.1 (AJAX schema tests) ==

Goal: per AJAX response shape, capture one redacted real payload
from the dump and add a parser test that asserts the parser does
not crash on it. The strategy plan calls out
`live_blessings_api.live` as the canonical first candidate.

Pre-condition (from the plan): real responses live in the dump under
`pages[*].live_blessings_api`, and similar structures appear at
`pages[*].battle.*` and `pages[*].girls_full.*`. Pick one shape, copy
a small redacted sample to `spec/fixtures/<endpoint>/`, and add the
test.

Acceptance criteria:
- Existing 711 tests stay green.
- Per response type, exactly one parser test that calls the actual
  parser on the captured payload and asserts it returns without
  throwing.
- No DOM, no jQuery, no `unsafeWindow` in the new tests.

Branch: `feat/test-ajax-schema-<endpoint>` (e.g.
`feat/test-ajax-schema-live-blessings`) for each endpoint set.

== Stage 4 ground rules ==

- The same separation as stage 2: parser tests live next to fixture
  tests under `spec/fixtures/<endpoint>/Schema.spec.ts`. Smoke tests
  for fixture shape stay separate.
- Each task in stage 4 ships as a fixture-set or test-only PR plus a
  docs PR, same workflow as stages 2 and 3.
- `loadFixture(modulePath, name)` from `spec/testHelpers/Fixtures.ts`
  is the loader; module path is `<endpoint>` (e.g. `live-blessings`).
- The deferred `parseGirlsFromGameData(rawData) -> Girl[]` parser
  belongs in stage 4 if it is what produces the schema-validated
  output for a haremGirl AJAX response. Otherwise it stays deferred.

== Stage 4 task list (from the plan) ==

- 4.1 AJAX schema tests -- one validator test per response type.
- 4.2 Storage migration tests -- old storage values from earlier
  versions as fixtures, assert the reader does not crash.
  `INPUT/HH_DebugLog_*.log` carries current storage snapshots.
- 4.3 Multi-domain smoke -- per domain clone (hentaiheroes,
  gayharem, comixharem, mangarpg, ...) one test for
  `domain.includes()` and ConfigHelper domain detection. New file
  `spec/config/Domain.spec.ts`.
- 4.4 Stage 4 finished -- closure task. Pick up issue #1614 (CI
  coverage reporting) here.

== Reminder: deferrals carried into stage 4 ==

- `parseGirlsFromGameData(rawData) -> Girl[]` (deferred from stage 1
  task 1.3). Fixture sized to feed it:
  `spec/fixtures/haremGirl/sample-girls.json`. Stage 3 did not need
  it; reactivate when a haremGirl-touching parser test lands in
  stage 4.
- Champion-map fixture (deferred from stage 2 task 2.4). Page 8
  (`/champions-map.html`) carries no champion JSON in the dump --
  the map is rendered client-side from DOM. Reactivation depends
  on a different testing approach for DOM-derived state.
- League energy snapshot (`hero.shared.Hero.energies.challenge`)
  (deferred from stage 2 task 2.2). Add when a League parser test
  needs it; not part of the league fixture today.

== Workflow per task ==

1. Branch (`feat/test-ajax-schema-<endpoint>`,
   `feat/test-storage-migration-<area>`, etc.).
2. Implement (fixture + spec + maybe a thin validator under `src/`).
3. `npm test` and `npm run build` locally. Discard the
   `HHAuto.user.js` rebuild drift before commit
   (`git checkout HHAuto.user.js`).
4. Commit (no AI mention, no Co-Authored-By).
5. Push.
6. Wait for user approval.
7. Open PR, merge with `gh pr merge --rebase --delete-branch`.
8. Tick the checkboxes in `docs-internal/test-strategy.md`,
   update the status block, append to the change log via a
   separate `docs/...` PR.

== Important ==

- Plan file is the single source of truth. Update its status there.
- Every src/ change is a deviation from the stage 4 baseline (test-
  only) -- the user must sign off before code outside spec/ moves.
- For every fixture entry: copy real shape, redact PII / asset URLs,
  keep size small. Never invent fields the dump does not have.

== Open reminders ==

- Issue #1614 "Coverage reporting in CI" -- not yet implemented.
  Stage 4 task 4.4 (closure) is the latest reasonable point to
  pick this up.
- HaremGirl pure module exports `findBestItem` which has no callers.
  Cleanup is independent of stage 4 and not blocking; can be
  collapsed when a HaremGirl-touching stage-4 task lands nearby.

== Data sources (unchanged from stages 2 + 3) ==

- Dump: `INPUT/hhauto_dump_www_hentaiheroes_com_tour_2026-05-05T12-11-40-985Z.json`
  (41 MB, 30 pages, captured 2026-05-05).
- Fixtures already extracted (loadable via
  `loadFixture(modulePath, name)` from
  `spec/testHelpers/Fixtures.ts`):
    spec/fixtures/league/opponents-mid-tier.json
    spec/fixtures/league/league-rewards-tier3.json
    spec/fixtures/haremGirl/sample-girls.json
    spec/fixtures/champion/active-champion.json
    spec/fixtures/event/event-detection.json
- Logs: `INPUT/HH_DebugLog_*.log` (3 files, captured alongside the
  dump). Storage-migration tests in stage 4 task 4.2 will mine these
  for old `Setting_*` / `Temp_*` snapshots.
- If a fresh dump is needed: ask the user (inspector script:
  `bonus-scripts/HHAuto_debug_inspector.user.js` v4.5.0).

== Pure module inventory at end of stage 3 ==

- src/Module/League.pure.ts -- `decideShouldFight`
- src/Module/Champion.pure.ts -- `decideNextChampionTime`
- src/Module/harem/HaremGirl.pure.ts -- `scoreItem`,
  `findBestItem` (orphaned -- no callers), `isBetter`
- src/Service/AutoLoop.pure.ts -- `decideBurst`,
  `shouldRunStandardHandler`
- src/Module/ClubChampion.pure.ts -- `decideNextClubChampionTime`,
  `decideAlignedClubChampionTimer`
- src/Module/Pantheon.pure.ts -- `decideIsEnabled`,
  `decideShouldFight`
- src/Module/Labyrinth.pure.ts -- `getNextIndices`,
  `buildPathsFromMatrix`, `filterPathsWithTreasure`,
  `sortPathsByDifficulty`, `decideBetterOption`
- src/Module/Bundles.pure.ts -- `decideExpiryTime`
- src/Module/Events/LivelyScene.pure.ts -- `decideCollectTrigger`,
  `selectClaimablePieces`

Modules without a pure module yet (deferred to either stage 4
parser work or as out-of-scope refactoring): MonthlyCard
(string-building only), BossBang (DOM-only), every module not
listed above.

== Pre-flight checks before stage 4 ==

- `git status` clean, on `main`.
- `git fetch origin main` then `git log HEAD..origin/main --oneline`
  shows nothing (local main up to date).
- `git config user.email` shows `oldron1977@gmail.com`.
- `npm test` shows 711 passed / 0 skipped / 711 total / 52 suites.
- `npm run build` succeeds. `HHAuto.user.js` may show a line-ending
  diff after building -- discard with `git checkout HHAuto.user.js`
  before committing.

If any of these fails, stop and ask before starting stage 4.

== State summary at handoff ==

- main HEAD: <to be filled in once the closure PR is merged>
- Tests: 711 passed (52 suites). Coverage: ~30.7% statements /
  ~18.7% branches / ~25.7% functions / ~30.7% lines (approximate;
  exact values land in the closure run).
- 5 stage-3 refactor PRs merged: #1636 (ClubChampion), #1638
  (Pantheon), #1641 (Labyrinth), #1643 (Bundles), #1645
  (LivelyScene).
- 5 stage-3 doc PRs merged: #1637, #1640 (skip-only for 3.3 with
  no code PR), #1642, #1644, #1646.
- 1 stage-3 closure PR merged: <to be filled in by the closure PR>.
```

## What was done in stage 3 (for context, not action)

- 5 new pure modules and 76 new tests across 5 refactor PRs
  (3.1 ClubChampion, 3.2 Pantheon, 3.4 Labyrinth, 3.5 Bundles,
  3.6 LivelyScene). Total moved from 633 to 711. Suite count:
  47 -> 52.
- Two of the seven sub-tasks shipped as documented skips:
  - 3.3 MonthlyCard: module is misleadingly named -- the single
    public method only builds regex strings for the settings UI;
    no claim flow, no timer, no AJAX, no hero-level gate. Existing
    spec already covers all six tier mappings with 24 tests.
  - 3.6 BossBang half: DOM-driven team-search loop with `click()`
    side effects; no isolatable pure logic. The other half of 3.6
    (LivelyScene) shipped normally.
- Six of the seven sub-tasks were renegotiated mid-flight when the
  plan's pre-inspection guesses (`isTimeToFight` /
  `getNextChampionTime` / `shouldClaim` / `getNextClaimTime` /
  `entire decision pipeline` / `visibility / trigger` /
  `isAvailable, timer reset`) did not match the actual code:
  - 3.1 (ClubChampion): no `isTimeToFight` equivalent fits the pure
    pattern; `getNextChampionTime` renamed to
    `decideNextClubChampionTime` to avoid the name clash with
    `Champion.pure.decideNextChampionTime`.
  - 3.2 (Pantheon): scope held; only naming follows stage 1
    convention.
  - 3.3 (MonthlyCard): see above (skipped).
  - 3.4 (Labyrinth): `LabyrinthAuto.run` has no isolatable pure
    logic; the actual decision pipeline lives in `Labyrinth.ts`
    (createPathFromMatrix, filterPathWithNoTreasue,
    sortPathsByDifficulty, findBetter). All four extracted.
  - 3.5 (Bundles): no visibility / trigger logic; only the 24-hour
    threshold check inside `getExpiryTime` is pure. Mini-extraction.
  - 3.6 (LivelyScene): `isAvailable` is trivial, `timer reset` has
    no branch; the actual pure logic is the two OR cascades inside
    `parse` and `parseClaimableRewards`.
- Behaviour deltas accepted, all read-only and without game-state
  effects (same class as League stage 1 task 1.1):
  - 3.2 (Pantheon): `ParanoiaService.checkParanoiaSpendings(
    'worship')` now called unconditionally.
  - 3.5 (Bundles): `randomInterval(60, 180)` now called
    unconditionally as part of computing `fallbackSeconds`.
  - 3.4 (Labyrinth): five inner debug-log lines inside `findBetter`
    removed; all gated by `debugEnabled`.
- Side findings to keep on the radar:
  - `parseGirlsFromGameData(rawData) -> Girl[]` deferred from stage
    1 task 1.3 stays deferred. Stage 4 (parser tests) is the
    natural slot.
  - `findBestItem` in `HaremGirl.pure` still has no callers.
    Cleanup is independent.
  - Champion-map fixture deferral (stage 2 task 2.4) carries
    forward; needs a different approach for DOM-derived state.

## Stage 4 design notes (for the agent before the first action)

- Stage 4 is allowed to change production code under `src/` only
  when an AJAX validator or a storage-migration helper is being
  added. The default is test-only.
- 4.1 (AJAX schema tests): one validator test per response type
  asserts that the parser does not crash on a real payload from the
  dump. Pick one endpoint per PR; do not bundle.
- 4.2 (Storage migration tests): mine `INPUT/HH_DebugLog_*.log` for
  old `Setting_*` / `Temp_*` snapshots. The test should set the
  storage to the old shape, call the reader, and assert that no
  exception escapes (default value falls in if necessary).
- 4.3 (Multi-domain smoke): one test per domain clone exercising
  `ConfigHelper.getHHScriptVars` domain detection. New file
  `spec/config/Domain.spec.ts`. Domains: `hentaiheroes.com`,
  `gayharem.com`, `comixharem.com`, `mangarpg.com`, plus the
  `tour` subdomain captured in the dump.
- 4.4 (Closure): same shape as 2.7 / 3.7; pick up issue #1614 (CI
  coverage reporting) at this point if not earlier.