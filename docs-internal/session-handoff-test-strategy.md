# Session handoff -- HHAuto test strategy, stage 3

Status: 2026-05-07. Stage 2 is finished and merged into main (final
commit e80e6cf closing the plan, last fixture commit 13c5f82 for
task 2.5 via PR #1632). Plan file `docs-internal/test-strategy.md`
is the source of truth and already contains the detailed entry point
for stage 3.

## Prompt for the new session (copy-paste into a fresh chat)

```
We continue the HHAuto test strategy. Stage 2 is finished and merged.
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
c:\\Users\\StephanMesser\\.kiro\\Arbeitsplatz\\HHAuto

== First action ==
1. Read `docs-internal/test-strategy.md`. The status block on top
   tells you where we are. Stage 2 is closed; stage 3 starts with
   task 3.1 (ClubChampion decision tests).
2. Read this handoff in full -- the stage-3 conventions, fixture
   inventory, and pure-function inventory are spelled out below to
   avoid a guessing round.
3. Confirm the proposed first slice (3.1) with the user before
   touching production code. Stage 3 changes are allowed under
   `src/` because the deferred parsers from stage 1 task 1.3 and
   the decision-logic functions for tasks 3.1-3.6 must be added
   somewhere -- but every src change still needs the user's sign-off.

== Stage 3 entry point: task 3.1 (ClubChampion) ==

Goal: cover the ClubChampion decision pipeline with focused tests:
default, boundaries, setting-off, hero-level too low, timer active,
energy edge, AJAX error. 4-8 tests per decision function.

Pre-condition (from the plan): stage 1 has produced pure functions
for the modules in stages 3 and 4. ClubChampion currently has none.
The first stage-3 PR therefore has two halves:

1. Pure-function extraction for ClubChampion.
   - Inspect `src/Module/ClubChampion.ts` first; identify the decision
     points (`isTimeToFight`, `getNextChampionTime` per the plan).
     If those names do not match the actual function names, document
     the substitution before extracting.
   - Extract decision logic into `src/Module/ClubChampion.pure.ts`,
     same pattern as stage 1 (data in, decision out, no globals,
     no jQuery, no storage).
2. Decision-logic tests for the new pure module.
   - Use the champion fixture from stage 2
     (`spec/fixtures/champion/active-champion.json`) where it
     applies. Other inputs (settings, hero level, timer state) come
     as plain literals or via the existing `MockHelpers.ts` builders.
   - Smoke checks for the fixture itself stay where they are; the
     parser-style tests added in stage 3 replace those at the parser
     boundary, not at the fixture boundary.

Acceptance criteria:
- Existing 633 tests stay green.
- New pure module + tests added; the impure adapter delegates to it
  bit-for-bit (structural diff only at the bundle level, same rule
  as stage 1).
- No DOM, no jQuery, no `unsafeWindow` in the new pure module or in
  any of the new tests.

Branch: `refactor/pure-functions-clubchampion` for the extraction +
tests bundle, mirroring stage 1's branch convention.

== Stage 3 ground rules ==

- Stage 3 IS allowed to change `src/`. Stage 1's pure-extraction
  pattern is the template: bit-for-bit equivalent extraction first,
  decision-logic tests second.
- Tests live next to the existing module specs
  (`spec/Module/<Module>.pure.spec.ts`) for parity with stage 1.
- Smoke tests under `spec/fixtures/<module>/Fixtures.spec.ts` stay.
  They confirm fixture shape, not parser behaviour.
- Each task in stage 3 ships as a separate fixture-set or refactor
  PR plus a docs PR, same workflow as stage 2.
- The deferred `parseGirlsFromGameData(rawData) -> Girl[]` parser is
  the natural pairing with task 3.x for HaremGirl-touching modules.
  Plan it into the earliest stage-3 task that needs it; until then,
  the haremGirl fixture is unused beyond its smoke tests.

== Reminder: deferrals carried into stage 3 ==

- `parseGirlsFromGameData(rawData) -> Girl[]` parser (deferred from
  stage 1 task 1.3). Fixture sized to feed it:
  `spec/fixtures/haremGirl/sample-girls.json`.
- Champion-map fixture (deferred from task 2.4). Page 8
  (`/champions-map.html`) carries no champion JSON in the dump --
  the map is rendered client-side from DOM. Reactivation depends on
  a different testing approach for DOM-derived state.
- League energy snapshot
  (`hero.shared.Hero.energies.challenge`) (deferred from task 2.2).
  Add when a League parser test needs it; not part of the league
  fixture today.

== Workflow per task ==

1. Branch (`refactor/pure-functions-<module>` for extraction +
   tests, `feat/test-decision-<module>` for test-only adds).
2. Implement.
3. `npm test` and `npm run build` locally. The build line-ending
   drift on `HHAuto.user.js` is discarded with
   `git checkout HHAuto.user.js` before commit.
4. Commit (no AI mention, no Co-Authored-By).
5. Push.
6. Wait for user approval.
7. Open PR, merge with `gh pr merge --rebase --delete-branch`.
8. Tick the checkboxes in `docs-internal/test-strategy.md`,
   update the status block, append to the change log via a
   separate `docs/...` PR.

== Important ==

- Plan file is the single source of truth. Update its status there.
- Every src/ change is a deviation from the stage 1/2 pattern --
  the user must sign off before code outside spec/ moves.
- For every fixture entry needed beyond what stage 2 produced:
  copy real shape, redact PII, keep size small. Never invent fields
  the dump does not have.

== Open reminders ==

- Issue #1614 "Coverage reporting in CI" -- not part of stage 3,
  picked up in stage 4 (reliability layer).
- HaremGirl pure module exports `findBestItem` which has no callers.
  Cleanup is independent of stage 3 and not blocking; can be
  collapsed when a HaremGirl-touching stage-3 task lands nearby.

== Data sources (unchanged from stage 2) ==

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
  dump). Parsing snapshots may show up here; storage-migration tests
  in stage 4 will mine these.
- If a fresh dump is needed: ask the user (inspector script:
  `bonus-scripts/HHAuto_debug_inspector.user.js` v4.5.0).

== Pre-flight checks before stage 3 ==

- `git status` clean, on `main`.
- `git fetch origin main` then `git log HEAD..origin/main --oneline`
  shows nothing (local main up to date).
- `git config user.email` shows `oldron1977@gmail.com`.
- `npm test` shows 633 passed / 0 skipped / 633 total / 47 suites.
- `npm run build` succeeds. `HHAuto.user.js` may show a line-ending
  diff after building -- discard with `git checkout HHAuto.user.js`
  before committing.

If any of these fails, stop and ask before starting stage 3.

== State summary at handoff ==

- main HEAD: e80e6cf ("docs(test): close stage 2")
- Tests: 633 passed (47 suites). Coverage: 29.53% / 18.19% / 24.67%
  / 30.12% (statements / branches / functions / lines).
- 4 fixture sets introduced in stage 2:
    spec/fixtures/league/         (3 files: opponents, rewards, README, plus the spec)
    spec/fixtures/haremGirl/      (3 files)
    spec/fixtures/champion/       (3 files)
    spec/fixtures/event/          (3 files)
- 1 shared loader: spec/testHelpers/Fixtures.ts (loadFixture).
- 4 stage-2 fixture-set PRs merged: #1626, #1628, #1630, #1632.
- 4 stage-2 doc PRs merged: #1627, #1629, #1631, #1633.
- 1 stage-2 closure PR merged: #1634.
```

## What was done in stage 2 (for context, not action)

- 4 fixture sets and one shared loader. League / haremGirl /
  champion / event each got a JSON fixture, a sibling README, and a
  smoke spec. The loader (`spec/testHelpers/Fixtures.ts`) is a
  six-line synchronous `fs.readFileSync` + `JSON.parse` returning
  `unknown`.
- 23 new smoke tests (5 + 6 + 7 + 5). Total moved from 610 to 633.
  Suite count: 43 -> 47.
- Three of the five fixture tasks were renegotiated mid-flight:
  - 2.2 (League): plan listed `member.id_country` / `member.lvl` /
    `team.theme_elements[]` / `team.girls[]` per opponent. The
    actual dump has those fields at top level and `team` is an HTML
    snippet; the field selection followed the dump.
  - 2.3 (HaremGirl): plan pointed at page 0
    (`girls_full.game.shared.Hero`). That path is hero-side data,
    not the harem. Harem actually lives on page 19
    (`girls_full["game.girls_data_list"]`).
  - 2.4 (Champion): plan listed page 8 and two files. Page 8
    carries no champion JSON in the dump; active-champion sourced
    from page 7. Champion-map fixture deferred (DOM-only data).
- Side findings to keep on the radar:
  - `parseGirlsFromGameData(rawData) -> Girl[]` deferred from stage
    1 task 1.3, naturally pairs with the first stage-3 task that
    touches HaremGirl decision logic.
  - `findBestItem` in HaremGirl.pure has no remaining callers.
  - Champion-map fixture deferral until DOM-derived state has its
    own testing approach.

## Stage 3 design notes (for the agent before the first action)

- Stage 3 is allowed to change production code under `src/`. The
  pattern is stage 1's pure-extraction model: each task adds (or
  reuses) one `<Module>.pure.ts`, then the impure adapter delegates
  to it bit-for-bit.
- Stage 1 already produced pure modules for League, Champion,
  HaremGirl, AutoLoop. Modules without a pure module yet:
  ClubChampion, Pantheon, MonthlyCard, LabyrinthAuto, Bundles,
  LivelyScene, BossBang. Stage 3 tasks 3.1-3.6 each cover one or
  two of these.
- Decision-logic tests are 4-8 per pure function (default,
  boundaries, setting-off, hero-level too low, timer active,
  energy edge, AJAX error). Less is fine if the function has fewer
  natural boundaries; more is fine if it has more.
- Fixtures from stage 2 are the input shape for parser tests.
  Fixture loading goes through `loadFixture(modulePath, name)`;
  no direct `fs.readFileSync` in production code.
- The parser deferred from task 1.3
  (`parseGirlsFromGameData(rawData) -> Girl[]`) belongs in the
  earliest stage-3 task that touches HaremGirl decision logic.
  Until then, the haremGirl fixture is unused beyond its smoke
  tests.
