# Test Strategy HHAuto

Status: 2026-05-07. Living document. When a task is finished, tick the checkbox
and add the date plus commit hash in the Status field.

## Status

- Current stage: **1 in progress** (pure-function extraction)
- Last completed task: 1.1 (League pure function `decideShouldFight`, merged via PR #1617 into main, commit 27b5e39)
- Open reminder: issue #1614 (CI coverage reporting)
- Next step: stage 1 task 1.2 (Champion `selectNextChampion`)

## Context

- Repo: OldRon1977/HHauto, userscript for a browser game.
- 28k LoC TypeScript, 39 spec files / 556 tests.
- Coverage: 30% statements / 17% branches / 24% functions.
- Test stack: Jest + ts-jest + jsdom + mock-local-storage.
- Path: `c:\\Users\\StephanMesser\\.kiro\\Arbeitsplatz\\HHAuto`
- File writes only via Python+UTF8 (workspace rule 05_File_Write_Workaround).

## Review consensus (5:1 or better)

### Blocked
- Snapshot tests for HTML
- Mutation testing (Stryker)
- Property-based testing as its own phase (one or two targeted tests at most)
- Coverage threshold as a CI gate (reporting yes, gate no)
- Splitting the 41 MB dump into 30 page JSONs
- Pre-commit hook (use a GitHub Action instead)
- Trivial tests for one-line `isEnabled` getters

### Accepted
- Pure-function extraction before decision-logic tests
- Curated mini fixtures from the dump (one or two per module, 5-20 lines of JSON)
- AJAX schema tests against real dump responses
- Storage migration tests
- Extended MockHelper (world setup helper)

## Decisions taken before stage 0 (archive)

- A: xit tests inventoried (7 found, all addressed in task 0.2).
- B: fdescribe-hidden tests inventoried (1 found, fixed in task 0.1).
- C-3 (Pachinko string-mapping tautology): defer to the Pachinko refactor.
- C-4 (Pipeline.config value asserts): defer to the next Pipeline change.
- C-5 (League jest.spyOn on static methods): keep until stage 1 task 1.1
  replaces them with the pure function.

Default recommendation from the review was: C-3a, C-4a, C-5b. Final answers:
C-3c, C-4c, C-5b.

## Findings with evidence

| # | Finding | Evidence | Verdict |
|---|---|---|---|
| 1 | `fdescribe` skips one sibling describe in the same file | `spec/Module/Champion.spec.ts:39` | objective bug |
| 2 | 8 xit tests in limbo | Jest reports `pendingTests=8` | objective gap |
| 3 | Pachinko string-mapping tautology | full `spec/Module/Pachinko.spec.ts` | subjective (consensus) |
| 4 | Pipeline.config asserts hardcode config values | `spec/Service/Pipeline.config.spec.ts` handler-specific blocks | subjective (consensus) |
| 5 | League `jest.spyOn` on static methods -- brittle | `spec/Module/League.spec.ts:71-73` | subjective (refactoring architect) |
| 6 | Coverage spread is highly uneven | `coverage/clover.xml`: HaremGirl 5%, League 8%, Champion 4% | objective |
| 7 | Dump contains 30 real game pages with game state | `INPUT/hhauto_dump_*.json` | usable for mini fixtures |
| 8 | Log files contain action traces (TeamModule, Generator.next) | `INPUT/HH_DebugLog_*.log` key `HHAuto_Temp_Logging` | reliability hints |

## Roadmap

### Stage 0 -- immediate hygiene (1-2h, no risk)

- [x] **0.1** `fdescribe` -> `describe` in `spec/Module/Champion.spec.ts:37` (2026-05-07)
  - Precondition: question B answered, hidden tests known
  - Verification: `npm test` shows more passing tests than before
  - If tests turn red: decide individually (fix or xit)
- [x] **0.2** Handle xit tests according to answer A (2026-05-07)
  - 7 xit tests inventoried, 5 reactivated (all green), 2 empty stubs removed
  - TimeHelper: canCollectCompetitionActive + getSecondsLeftBeforeNewCompetition (stubs removed)
  - Season: 2 low-mojo tests reactivated, with `Setting_autoSeasonSkipLowMojo=true` set in the tests
  - HaremGirl: \"Button and no girl\" reactivated, green without further changes
  - League: \"should return false during the last hour...\" reactivated, green without further changes
  - PageNavigationService: `toHaveBeenCalledWith` -> `expect.stringContaining` (test bug, timestamp prefix)
- [x] **0.3** Findings 3/4/5 per answer C: nothing to do in stage 0
  - C-3c (Pachinko string mapping): defer to the Pachinko refactor
  - C-4c (Pipeline.config value asserts): defer to the next Pipeline change
  - C-5b (League jest.spyOn): keep until stage 1 (pure-function extraction replaces them)
- [x] **0.4** MockHelper extended (2026-05-07)
  - `mockBoosterInventory({normal, mythic})` -- localStorage Temp_boosterStatus
  - `mockSetting(key, value)` -- localStorage Setting_*
  - `mockTimer(name, secondsLeft)` -- localStorage Temp_Timers; <=0 clears
  - `mockAjaxSuccess(response)` / `mockAjaxError(error)` -- shared.general.hh_ajax
  - `mockGameGlobals({ heroLevel, energies, settings })` -- world setup
  - File: spec/testHelpers/MockHelpers.ts (143 lines added)
  - Note: storage prefixes pulled from src/config (HHStoredVarPrefixKey, TK) instead of hardcoded literals
- [x] **0.5** Coverage reporters enabled (2026-05-07)
  - jest.config.ts: coverageReporters = text, text-summary, lcov, clover, html
  - No threshold gate
  - text-summary prints at the end of every npm test run
  - HTML report at coverage/lcov-report/index.html
  - Current values: 28.92% statements / 17.11% branches / 24.10% functions / 29.60% lines
- [x] **0.6** Coverage reporting via GitHub Action (issue as reminder, 2026-05-07)
  - Issue: https://github.com/OldRon1977/HHauto/issues/1614 (\"Coverage reporting in CI\")
  - Body references this plan
  - Do not implement now, just track
- [x] **0.7** Stage 0 finished (2026-05-07)
  - Branch: chore/test-hygiene with 7 commits
  - No version bump (tests only)
  - Push + PR + merge per workflow rules: in progress (PR pending)

### Stage 1 -- pure-function extraction (2-3 days, high ROI)

Goal: extract decision logic out of the large modules into pure functions.
Input = data, output = decision. No globals, no jQuery, no storage reads in
the core.

- [x] **1.1** League: `decideShouldFight(state) -> bool` (2026-05-07)
  - Source: `src/Module/League.ts` `LeagueHelper.isTimeToFight`
  - New module: `src/Module/League.pure.ts` exports `decideShouldFight` and `ShouldFightState`
  - Final signature drops `heroLevel`, `energyMax`, `leagueEndTime` (none used
    by the decision) and adds `humanLikeRun` (drives the energy threshold):
    ```ts
    type ShouldFightState = {
      energy: number;
      threshold: number;
      runThreshold: number;
      humanLikeRun: boolean;
      timerLeft: number;
      paranoiaSpending: number;
      boosterRequired: boolean;
      boosterEquipped: boolean;
    };
    function decideShouldFight(state: ShouldFightState): boolean;
    ```
  - `LeagueHelper.isTimeToFight()` builds the state and delegates. Public API
    unchanged. Existing `spec/Module/League.spec.ts isTimeToFight` block kept
    as is (still uses spies); the spec/Module/League.pure.spec.ts file
    contains 12 spy-free tests covering the same scenarios plus humanLikeRun
    on/off, paranoia at zero energy, and a negative timer.
  - Behaviour delta: `ParanoiaService.checkParanoiaSpendings('challenge')` is
    now called unconditionally; previously it was short-circuited away when
    energy was zero. Read-only call, no side effects.
  - Tests: 566 passed (554 + 12), 0 skipped, 40 suites.
  - Bundle diff: structural only.
  - Merged via PR #1617, commit 27b5e39.
- [ ] **1.2** Champion: `selectNextChampion(champions, settings, level) -> champion?`
  - Extract filter + sort logic from the Champion module
  - Tests: walk through filter settings, hero-level thresholds
- [ ] **1.3** HaremGirl: `parseGirlsFromGameData(rawData) -> Girl[]`
  - Pure parser from `unsafeWindow.shared.Hero.girls` -> typed `Girl[]`
  - Input fixtures from the dump (stage 2 backfills them)
  - Tests: synthetic mini inputs (3 girls, varied rarities)
- [ ] **1.4** AutoLoopActions: `pickNextAction(state) -> action`
  - State: active modules, timers, energy values, settings
  - Output: one of the action types
  - Hardest extraction -- may need to be split into sub-functions
- [ ] **1.5** Stage 1 finished -- one commit per module, branch per module
  - Branch: `refactor/pure-functions-<module>`

### Stage 2 -- mini fixtures from the dump (3-4 days)

- [ ] **2.1** Create fixture directory: `spec/fixtures/<module>/`
- [ ] **2.2** Extract League fixtures from the dump
  - Source: `INPUT/hhauto_dump_*.json` page index 1 (`/leagues.html`)
  - Fields: `teams.opponents_list[0..2]`, `battle.league_rewards`, `hero.shared.Hero.energies.challenge`
  - Files: `spec/fixtures/league/opponents-mid-tier.json`, `league-rewards-tier3.json`
  - Tests: `parseOpponents(fixture) -> Opponent[]`, `parseLeagueRewards(fixture) -> RewardTier[]`
- [ ] **2.3** HaremGirl fixtures
  - Source: page index 0 (`/home.html`) `girls_full.game.shared.Hero`
  - Selection: 3 girls (1 mythic 6/6, 1 legendary 5/5, 1 common)
  - File: `spec/fixtures/haremGirl/sample-girls.json`
  - Tests: `parseGirlsFromGameData`, `calculateSalary`, filter functions
- [ ] **2.4** Champion fixtures
  - Source: page index 8 (`/champions-map.html`)
  - Files: `spec/fixtures/champion/champion-map.json`, `active-champion.json`
- [ ] **2.5** EventModule fixtures
  - Source: page index 13 (`/event.html`)
  - File: `spec/fixtures/event/event-detection.json`
- [ ] **2.6** Fixture loader helper
  - File: `spec/testHelpers/Fixtures.ts`
  - Function: `loadFixture(module, name) -> any`
- [ ] **2.7** Stage 2 finished -- one commit per module, branch `feat/test-fixtures-<module>`

### Stage 3 -- decision-logic coverage (2-3 days)

For each `isTimeToX` / `shouldRunY` / `getNextZTime`: 4-8 tests covering
default, boundaries, setting-off, hero-level too low, timer active,
energy edge, AJAX error.

Precondition: stage 1 has produced a pure function for the respective
module.

- [ ] **3.1** ClubChampion -- isTimeToFight, getNextChampionTime
- [ ] **3.2** Pantheon -- isEnabled (real logic, not trivial), isTimeToFight
- [ ] **3.3** MonthlyCard -- shouldClaim, getNextClaimTime
- [ ] **3.4** LabyrinthAuto -- entire decision pipeline
- [ ] **3.5** Bundles -- visibility / trigger
- [ ] **3.6** LivelyScene, BossBang -- isAvailable, timer reset
- [ ] **3.7** Stage 3 finished -- branch `feat/test-decision-logic`

### Stage 4 -- reliability layer (1-2 days)

- [ ] **4.1** AJAX schema tests
  - Real responses from the dump as fixtures (e.g. `live_blessings_api.live`)
  - One validator test per response type: `parseResponse(realResponse)` does not crash
- [ ] **4.2** Storage migration tests
  - Old storage values from earlier versions as fixtures
  - Test: reader does not crash, default value kicks in
  - Source: `INPUT/HH_DebugLog_*.log` contains current storage snapshots
- [ ] **4.3** Multi-domain smoke
  - Per domain clone (hentaiheroes, gayharem, comixharem, mangarpg, ...) one
    test for `domain.includes()` and ConfigHelper domain detection
  - File: `spec/config/Domain.spec.ts`
- [ ] **4.4** Stage 4 finished -- branch `feat/test-reliability`

## Deliberately dropped (do not implement)

- Snapshot tests for HTML
- Mutation testing with Stryker
- Property-based testing as a whole phase
- Coverage threshold as a CI gate
- Splitting the 41 MB dump into 30 page JSONs
- Pre-commit hook
- Trivial tests for one-line `isEnabled` getters

## xit inventory

Status: 2026-05-07. 7 xit tests found (the plan's initial estimate was 8).

| # | File | Line | Test name |
|---|---|---|---|
| 1 | spec/Helper/TimeHelper.spec.ts | 70 | default |
| 2 | spec/Helper/TimeHelper.spec.ts | 76 | default |
| 3 | spec/Module/Events/Season.spec.ts | 231 | low mojo |
| 4 | spec/Module/Events/Season.spec.ts | 255 | low mojo, energy not max with cards |
| 5 | spec/Module/harem/HaremGirl.spec.ts | 55 | Button and no girl |
| 6 | spec/Module/League.spec.ts | 149 | should return false during the last hour of the league if energy is insufficient |
| 7 | spec/Service/PageNavigationService.spec.ts | 74 | should log an error if Nutaku is detected but no session is found |

## Tests hidden by fdescribe

Status: 2026-05-07. `fdescribe(\"_setTimer\")` in Champion.spec.ts:37 focuses
on 7 tests inside the _setTimer block and therefore hides the sibling block
findNextChamptionTime with 1 test.

| File | fdescribe block (line) | hidden describe block | tests skipped |
|---|---|---|---|
| spec/Module/Champion.spec.ts | _setTimer (37) | findNextChamptionTime | 1: \"default\" |

## Data sources

- `INPUT/hhauto_dump_*.json` (41 MB, 2026-05-05, 30 pages)
  - Pages: home, leagues, season-arena, penta-drill-arena, penta-drill,
    labyrinth (2x), club-champion, champions-map, shop, clubs, pantheon,
    season, event, seasonal, path-of-glory, path-of-valor, pachinko, map,
    waifu, activities (5x), hero/profile, member-progression, teams,
    edit-team, characters/1
  - Fields per page: girls_full, hero, teams, battle, market_equipment,
    hh_namespace, shared_namespace, local_storage, dom_data_attributes,
    live_blessings_api
- `INPUT/HH_DebugLog_*.log` (3 files, ~10h old)
  - Settings snapshot per file
  - Key `HHAuto_Temp_Logging` carries time-stamped action traces
    (TeamModule, Harem, Generator.next with slot equipment)
- If a fresh dump is needed: ask the user (inspector script:
  `bonus-scripts/HHAuto_debug_inspector.user.js` v4.5.0)

## Workflow reminder

- Branch -> implement -> commit -> push -> test -> approval -> PR -> merge
- Identity: `oldron1977@gmail.com`, user: `OldRon1977`
- No AI / agent mention in commits
- File writes only via Python+UTF8 (workspace rule 05)
- README entry on a version bump (not required for this stage)

## Change log

| Date | Change |
|---|---|
| 2026-05-07 | Initial draft, state before stage 0 |
| 2026-05-07 | Task 0.1 done: fdescribe -> describe. Tests: 549 passed / 7 skipped / 556 total |
| 2026-05-07 | Tasks 0.2 + 0.3 done: every xit handled. Tests: 554 passed / 0 skipped / 554 total |
| 2026-05-07 | Task 0.4 done: MockHelper +5 functions. Tests stay 554 passed |
| 2026-05-07 | Task 0.5 done: coverage reporters enabled |
| 2026-05-07 | Task 0.6 done: issue #1614 opened |
| 2026-05-07 | Stage 0 finished (tasks 0.1-0.7), branch ready for push |
| 2026-05-07 | Stage 0 merged via PR #1615 (commit c4d6837) |
| 2026-05-07 | Stage 1 prep: plan consolidated, task 1.1 detailed, session handoff rewritten for stage 1 |
| 2026-05-07 | Task 1.1 done: `decideShouldFight` extracted, 12 new pure tests (566 total), bundle diff structural, merged via PR #1617 (commit 27b5e39) |
