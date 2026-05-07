# Session handoff -- HHAuto test strategy, stage 2

Status: 2026-05-07. Stage 1 is finished and merged into main (final
commit dbc8600 closing the plan, refactor commit 44aa97d for task 1.4
via PR #1623). Plan file `docs-internal/test-strategy.md` is the
source of truth and already contains the detailed entry point for
stage 2.

## Prompt for the new session (copy-paste into a fresh chat)

```
We continue the HHAuto test strategy. Stage 1 is finished and merged.
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
   tells you where we are. Stage 1 is closed; stage 2 starts with
   task 2.1 (create the fixture directory) and 2.2 (League fixtures).
2. Read this handoff in full -- the dump structure, fixture-loader
   shape, and test patterns are spelled out below to avoid a guessing
   round.
3. Confirm the proposed first slice (2.1 + 2.2 League) with the user
   before introducing new test infrastructure or fixtures, especially
   anything that touches the production code paths in
   `src/Module/League.ts`.

== Stage 2 entry point: tasks 2.1 + 2.2 ==

Goal: introduce the fixture infrastructure and ship the first concrete
fixture set (League opponents and league rewards). Future stage 2
tasks (HaremGirl, Champion, Event) and the loader helper plug into
the same shape.

The plan splits this across:
- 2.1 Create fixture directory `spec/fixtures/<module>/`
- 2.2 League fixtures from the dump page index 1 (`/leagues.html`)
- 2.6 Fixture loader helper `spec/testHelpers/Fixtures.ts`

Recommendation: bundle 2.1 + 2.2 + 2.6 into a single PR. The loader
is small (one or two functions), the directory is empty without
content, and the League fixture is the first real consumer of both.
This avoids shipping infrastructure with no consumer.

Proposed first slice:

1. `spec/fixtures/league/` (new)
   - `opponents-mid-tier.json` -- 3 entries from
     `dump.pages[1].teams.opponents_list` after redaction:
       * `id_member` (numeric ID), `username`, `nickname`,
         `id_team`, `member.id_country`, `member.lvl`, `power`,
         `team.theme_elements[]`, `team.girls[]` (truncate to 3
         girls per opponent, keep `caracs_sum`, `class`, `element`,
         `figure`, `rarity`, `level`)
       * Cross-check the dump first; the actual key path may be
         `dump.pages[1].game.teams.opponents_list` or
         `dump.pages[1].battle.opponents_list`. Document the path
         in a top-of-file comment in the JSON's sibling README.
   - `league-rewards-tier3.json` -- same approach for
     `league_rewards` / `battle.league_rewards`.

2. `spec/testHelpers/Fixtures.ts` (new)
   - Single function: `loadFixture(modulePath: string, name: string): unknown`
   - Implementation: read the JSON synchronously off disk via
     `fs.readFileSync(path.join(__dirname, '..', 'fixtures',
     modulePath, name + '.json'), 'utf-8')` and `JSON.parse`.
   - Optional: add `loadFixtureTyped<T>(...)` that returns the same
     value with a caller-supplied type assertion. Skip if not needed
     for the first slice.

3. `spec/fixtures/league/Fixtures.spec.ts` (new)
   - Smoke test: load each fixture, assert it has the expected
     top-level shape (e.g. opponents-mid-tier has 3 entries each
     with id_member numeric, team.girls array length >= 1).
   - This is the first concrete consumer; future parser tests will
     replace these smoke checks once a parser exists.

Acceptance criteria:
- All existing 610 tests stay green.
- New fixture(s) load without throwing.
- New smoke tests pass (estimate: 4-6).
- No changes to production code in stage 2 -- this stage only adds
  test infrastructure.
- No `unsafeWindow`, no DOM, no jQuery in the loader or in any
  fixture-driven test.

Branch: `feat/test-fixtures-league`.

== Privacy / data handling ==

The dump may contain personally identifying or account-identifying
data: usernames, club names, country IDs, and player IDs. For
fixtures:

- Replace real `username` / `nickname` with placeholders
  (`Player_1`, `Player_2`, ...). Keep the shape, drop the personal
  data.
- Real numeric IDs (id_member, id_team, id_girl, ...) can stay --
  they are not secrets and the parser tests need them to be numbers.
- Salt or remove `email`, `phone`, or anything obviously contact-
  related if it shows up. From a quick scan of the dump shape this
  is unlikely, but verify before committing.
- Keep fixtures small: 3 opponents, not 30. The point is to give
  parsers a realistic but minimal input.

== Workflow per task ==

1. Branch.
2. Implement (fixtures + loader + smoke tests; no production code
   changes in stage 2).
3. `npm test` and `npm run build` locally. Build is a no-op in stage
   2 because no source TypeScript changes, but run it to keep the
   plan's verification routine intact.
4. Commit (no AI mention, no Co-Authored-By).
5. Push.
6. Wait for user approval.
7. Open PR, merge with `gh pr merge --rebase --delete-branch`.
8. Tick the checkboxes (2.1, 2.2, and 2.6 if bundled) in
   `docs-internal/test-strategy.md`, update the status block,
   append to the change log via a separate `docs/...` PR.

== Important ==

- Stage 2 changes test code only. If you find yourself editing
  anything under `src/`, stop and reconcile with the user.
- For every fixture entry: copy real shape, redact PII, keep size
  small. Never invent fields the dump does not have.
- The plan said "3 opponents" and "3 girls (1 mythic 6/6, 1
  legendary 5/5, 1 common)" for HaremGirl -- treat these as
  guidance, not law. If the dump has no mythic 6/6 girl on this
  account, swap it for the closest real entry and note the
  substitution in the JSON sibling comment.
- Plan file is the single source of truth. Update its status there.

== Open reminders ==

- Issue #1614 "Coverage reporting in CI" -- not part of stage 2,
  just a tracker for stage 4 / a future CI sweep.
- Stage 1 task 1.3 deferred a girls parser
  `parseGirlsFromGameData(rawData) -> Girl[]` to stage 2. Stage 2
  task 2.3 (HaremGirl fixtures) is the natural place to revisit it,
  but this can wait until 2.2 is merged.
- HaremGirl pure module currently exports `findBestItem` which has
  no callers. Cleanup is independent of stage 2 and not blocking.

== Data sources (unchanged from stage 1) ==

- Dump: `INPUT/hhauto_dump_www_hentaiheroes_com_tour_2026-05-05T12-11-40-985Z.json`
  (41 MB, 30 pages, captured 2026-05-05).
  Page index reminder from the plan:
    0  /home.html
    1  /leagues.html
    2  /season-arena.html
    3  /penta-drill-arena.html
    4  /penta-drill.html
    5,6 /labyrinth.html (two captures)
    7  /club-champion.html
    8  /champions-map.html
    9  /shop.html
   10  /clubs.html
   11  /pantheon.html
   12  /season.html
   13  /event.html
   14  /seasonal.html
   15  /path-of-glory.html
   16  /path-of-valor.html
   17  /pachinko.html
   18  /map.html
   19  /waifu.html
   20-24 /activities (5 captures)
   25  /hero/profile.html
   26  /member-progression.html
   27  /teams.html
   28  /edit-team.html
   29  /characters/1.html
- Logs: `INPUT/HH_DebugLog_*.log` (3 files, ~10h old at capture time).
- If a fresh dump is needed: ask the user (inspector script:
  `bonus-scripts/HHAuto_debug_inspector.user.js` v4.5.0).

== Pre-flight checks before stage 2 ==

- `git status` clean, on `main`.
- `git fetch origin main` then `git log HEAD..origin/main --oneline`
  shows nothing (local main up to date).
- `git config user.email` shows `oldron1977@gmail.com`.
- `npm test` shows 610 passed / 0 skipped / 610 total / 43 suites.
- `npm run build` succeeds. `HHAuto.user.js` may show a line-ending
  diff after building -- discard with `git checkout HHAuto.user.js`
  before committing.

If any of these fails, stop and ask before starting stage 2.

== State summary at handoff ==

- main HEAD: dbc8600 ("docs(test): close stage 1")
- Tests: 610 passed (43 suites). Coverage: 28.92% / 17.11% / 24.10% /
  29.60% (statements / branches / functions / lines). Coverage went
  up only marginally between stages because stage 1 added pure
  modules with their own tests rather than expanding coverage on
  existing impure modules.
- 4 pure modules introduced in stage 1:
    src/Module/League.pure.ts
    src/Module/Champion.pure.ts
    src/Module/harem/HaremGirl.pure.ts
    src/Service/AutoLoop.pure.ts
- 4 stage-1 PRs merged: #1617 (League), #1619 (Champion), #1621
  (HaremGirl equipment), #1623 (AutoLoop).
- 4 stage-1 doc PRs merged: #1618, #1620, #1622, #1624.
```

## What was done in stage 1 (for context, not action)

- 4 pure modules extracted: League.pure, Champion.pure,
  HaremGirl.pure, AutoLoop.pure.
- 56 new tests added (12 + 10 + 16 + 18). Total moved from 554 to
  610. Suite count: 39 -> 43.
- Bundle diffs structural only across all four refactors.
- Two of the four tasks were renegotiated mid-flight:
  - 1.3: no `parseGirlsFromGameData` exists; equipment scoring trio
    extracted instead. Parser deferred to stage 2.
  - 1.4: AutoLoop is a handler pipeline, not a single picker;
    `decideBurst` and `shouldRunStandardHandler` extracted instead.
    Remaining ~30 hand-rolled handlers deferred to stage 3.
- Side findings to keep on the radar:
  - `findBestItem` in HaremGirl.pure has no remaining callers.
  - One ClubChampion test was a flaky outlier under heavy disk load
    during a parallel build; three subsequent test runs all green.

## Stage 2 design notes (for the agent before the first action)

- Stage 2 adds test infrastructure and fixtures. No production code
  changes are expected.
- The dump is 41 MB; do not commit it. Fixtures are extracted slices
  of the dump's interesting paths, redacted and small.
- The loader is intentionally synchronous (`fs.readFileSync`) -- Jest
  test setup runs in Node, not the browser, so this is fine and
  keeps the test code easy to reason about.
- Each fixture file should have a sibling `README.md` (one per
  module directory) that lists the source path inside the dump and
  any redactions applied. This is the audit trail for future fresh
  dumps.
- Smoke tests for fixtures should be cheap and only check the shape
  the fixture promises. Once a real parser exists (stage 1 deferred
  parser, or a stage 3 decision-logic test), the smoke test can be
  retired or merged into the parser test.
