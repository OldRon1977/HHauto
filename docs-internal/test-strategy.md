# Test Strategy HHAuto

Status: 2026-05-07. Living document. When a task is finished, tick the checkbox
and add the date plus commit hash in the Status field.

## Status

- Current stage: **2 in progress** (mini fixtures from the dump)
- Last completed task: 2.4 (Champion fixtures from page index 7, merged into main via PR #1630, commit b2ab9d7)
- Open reminder: issue #1614 (CI coverage reporting; tracked, not in stage 2 scope)
- Next step: stage 2 task 2.5 (EventModule fixtures from page index 13 / `/event.html`). Reuses spec/testHelpers/Fixtures.ts.
- Stage 2 scoping note: per the stage rule (test code only), the `parseGirlsFromGameData` parser deferred from stage 1 task 1.3 stays deferred. It moves to stage 3 alongside the parser tests the haremGirl / champion fixtures are sized to feed.
- Champion-map fixture deferred: page 8 (`/champions-map.html`) carries no champion JSON in the dump (the map is DOM-only). A map fixture would need an HTML snippet, which the plan blocks ("snapshot tests for HTML"). Champion-map fixtures stay deferred until a different testing approach for DOM-derived state is in scope.

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
- [x] **1.2** Champion: timer scan extracted as `decideNextChampionTime` (2026-05-07)
  - Plan deviation (agreed with the user before implementation): the
    Champion module does not select a champion. It scans the existing
    map and decides when the adapter should look again. The pure
    function reflects that.
  - New module: `src/Module/Champion.pure.ts` exports `decideNextChampionTime` and `ChampionTimerEntry` / `ChampionTimerDecision`.
  - Signature:
    ```ts
    type ChampionTimerEntry = { inFilter: boolean; timer: number; started: boolean };
    type ChampionTimerDecision = { minTime: number; minTimeEnded: number };
    function decideNextChampionTime(
      champions: ChampionTimerEntry[],
      autoChampsForceStart: boolean,
    ): ChampionTimerDecision;
    ```
  - `Champion.findNextChamptionTime` builds the input list from
    `getChampionListFromMap()` (still impure, DOM-bound) and feeds the
    deterministic decision into `randomInterval` plus `_setTimer`.
  - Bit-for-bit equivalent to the original loop, including the
    misleading variable names: `minTime` keeps the LARGEST timer
    below 1800s, not the smallest. Refactor, not a bug fix.
  - Side-clean: drop an unused `debugEnabled` local the loop no
    longer references.
  - Tests: 576 passed (566 + 10), 0 skipped, 41 suites.
  - Bundle diff: structural only.
  - Merged via PR #1619, commit 524bde0.
- [x] **1.3** HaremGirl equipment scoring helpers extracted (2026-05-07)
  - Plan deviation (agreed with the user before implementation): no
    `parseGirlsFromGameData` exists in the module. The decision logic
    that fits stage 1 is the equipment helper trio, which previously
    had zero unit tests. A girls parser belongs in stage 2 alongside
    the dump fixtures and is deferred there.
  - New module: `src/Module/harem/HaremGirl.pure.ts` exports
    `scoreItem`, `findBestItem`, `isBetter`, plus the typed
    `EquipmentItem` and `EquipmentScore` shapes.
  - `HaremGirl.optimizeEquipmentSlots` now imports the module
    functions instead of calling private static methods. The three
    private methods are removed from the class.
  - Bit-for-bit equivalent to the original code, including the
    stringified identifier comparison and the array-shaped
    `resonance_bonuses` no-op contract.
  - Side-finding: `findBestItem` has no remaining callers. It stays
    in the pure module for parity with the trio; a separate cleanup
    can drop it later.
  - Tests: 592 passed (576 + 16), 0 skipped, 42 suites.
  - Bundle diff: structural only.
  - Merged via PR #1621, commit dfa13f5.
  - Original plan signature deferred to stage 2:
    ```ts
    function parseGirlsFromGameData(rawData: unknown): Girl[];
    ```
- [x] **1.4** AutoLoop: `decideBurst` and `shouldRunStandardHandler` (2026-05-07)
  - Plan deviation (agreed with the user before implementation): the
    plan suggested a single `pickNextAction(state)` selector, but
    AutoLoop is a sequential handler pipeline, not a one-shot picker.
    Each handler has its own pre-conditions; only the unified
    `runStandardHandler` entry has a guard cascade worth extracting
    today. The remaining ~30 hand-rolled handlers each follow a
    slightly different pattern and are deferred to stage 3.
  - New module: `src/Service/AutoLoop.pure.ts` exports `decideBurst`,
    `shouldRunStandardHandler`, and the typed `BurstState` /
    `StandardHandlerGuard` shapes.
  - `getBurst()` (in AutoLoop.ts) now reads the DOM overlays itself
    and delegates the decision to `decideBurst`.
  - `runStandardHandler()` (in AutoLoopActions.ts) now builds a
    `StandardHandlerGuard` and delegates to
    `shouldRunStandardHandler`. Affects 9 callsites that already
    register handlers via the descriptor pattern.
  - Bit-for-bit equivalent: same guard order, same
    `requiresAutoLoop=undefined -> default-true` semantics, same
    overlay-beats-settings short-circuit.
  - Tests: 610 passed (592 + 18), 0 skipped, 43 suites.
  - Bundle diff: structural only.
  - Merged via PR #1623, commit 44aa97d.
- [x] **1.5** Stage 1 finished (2026-05-07)
  - Branch per module convention held: `refactor/pure-functions-league`,
    `refactor/pure-functions-champion`,
    `refactor/pure-functions-haremgirl-equipment`,
    `refactor/pure-functions-autoloop`.
  - 4 new pure modules (League, Champion, HaremGirl, AutoLoop) with 56
    new tests; tests went from 554 to 610.
  - Two of the four tasks (1.3, 1.4) were renegotiated with the user
    when the planned signature did not fit the actual code; see the
    individual task notes.

### Stage 2 -- mini fixtures from the dump (3-4 days)

- [x] **2.1** Create fixture directory: `spec/fixtures/<module>/` (2026-05-07)
  - Created `spec/fixtures/league/` as the first module directory, with sibling `README.md` audit trail
  - Future module directories (haremGirl, champion, event) follow the same pattern
  - Merged via PR #1626 (commit 7395a0a)
- [x] **2.2** Extract League fixtures from the dump (2026-05-07)
  - Source: `INPUT/hhauto_dump_*.json` page index 1 (`/leagues.html`)
  - Plan deviation (documented in fixture README): plan listed
    `member.id_country`, `member.lvl`, `team.theme_elements[]`,
    `team.girls[]` per opponent. The dump has those fields at top
    level (`level`, `power`, `country`, `nickname`) and `team` is
    an HTML snippet string, not an object. Field selection follows
    the real dump shape.
  - Files written:
    * `spec/fixtures/league/opponents-mid-tier.json` -- 3 entries
      (places 50-52, mid-tier by league place) extracted from
      `pages[1].teams.opponents_list[49:52]`. Nicknames redacted
      to `Player_1..3`, `player.club` removed. Fields kept:
      top-level `id_member`/`level`/`power`/`place`/`country`/
      `can_fight`/`nickname` plus `player.{id_fighter, level,
      class, current_season_mojo}`.
    * `spec/fixtures/league/league-rewards-tier3.json` -- tier 3
      of `pages[1].battle.league_rewards` in full (rank brackets
      1, 4, 15, 30, 45, 60, 75, 200, plus `name`).
    * `spec/fixtures/league/README.md` -- audit trail (source,
      selection, redactions, refresh procedure).
  - Tests: 5 smoke tests in `spec/fixtures/league/Fixtures.spec.ts`
    confirming entry count, numeric ID fields, redaction pattern,
    and expected rank brackets. Parser tests deferred to a stage 3
    decision-logic PR -- no parser exists yet.
  - Energy snapshot (`hero.shared.Hero.energies.challenge`) deferred:
    not needed for this fixture set, will be added when a League
    parser test needs it.
  - Merged via PR #1626 (commit 7395a0a).
- [x] **2.3** HaremGirl fixtures (2026-05-07)
  - Plan deviation (documented in fixture README): plan listed page
    index 0 (`/home.html`) and the path `girls_full.game.shared.Hero`.
    The actual dump has the harem on page index 19 (`/waifu.html`)
    under the dotted-key path `girls_full["game.girls_data_list"]`.
    `girls_full.game.shared.Hero` on page 0 contains 28 hero-side
    records, not the harem. Field selection follows the real dump.
  - Source: `pages[19].girls_full["game.girls_data_list"]`
  - Selection: 3 girls covering the rarity / max-grade range
    * `id_girl=118565805` (Untamed Levitya, mythic, `nb_grades=6`)
    * `id_girl=118816` (Fanny & Fione, legendary, `nb_grades=5`)
    * `id_girl=5` (Princess Agate, common, `nb_grades=5`)
    All three are owned with `shards=100` and `level=750`.
  - Files written:
    * `spec/fixtures/haremGirl/sample-girls.json` -- 3 girls,
      whitelisted to parser-relevant fields (ids, classification,
      progress, caracs, salary, element/blessing, skill tiers, grade
      offsets); avatar urls and decoration metadata dropped.
    * `spec/fixtures/haremGirl/README.md` -- audit trail.
  - Tests: 6 smoke tests in `spec/fixtures/haremGirl/Fixtures.spec.ts`
    confirming entry count, rarity slot coverage, numeric ids and
    progress fields, the caracs object, salary fields, and the absence
    of dropped metadata. 621 total (615 + 6).
  - Scoping: per stage 2 rule (test code only), the deferred parser
    `parseGirlsFromGameData` from stage 1 task 1.3 stays deferred. It
    will land in stage 3 alongside the parser tests this fixture is
    sized to feed.
  - Merged via PR #1628 (commit ab78a5a).
- [x] **2.4** Champion fixtures (2026-05-07)
  - Plan deviation (documented in fixture README): plan listed page
    index 8 (`/champions-map.html`) and two files
    (`champion-map.json`, `active-champion.json`). Reality:
    * Page 8 carries no champion data; the map is rendered
      client-side from DOM only. The dump's `dom_data_attributes`
      payload for that page is page chrome, not parser-relevant.
    * Page 7 (`/club-champion.html`) carries the active champion
      under `battle.championData`, plus the team side-channel
      under `girls_full["game.championData.team"]` that breaks
      the inspector's circular marker.
  - `champion-map.json` is intentionally not produced. The
    `Champion.pure.ts decideNextChampionTime` function from stage 1
    task 1.2 operates on DOM-derived state; an HTML fixture is what
    it would consume, and the strategy plan blocks "snapshot tests
    for HTML". Champion-map fixtures stay deferred.
  - Source: `pages[7].battle.championData` plus
    `pages[7].girls_full["game.championData.team"]` for the team
    substitution.
  - Files written:
    * `spec/fixtures/champion/active-champion.json` -- champion
      with girl whitelist (id_girl, id_girl_ref, name, class,
      figure, element, rarity, level, nb_grades, carac1..3),
      timers, canDraft/freeDrafts/priceEnergy/hero_damage, reward
      (with `item.ico` stripped), fight (with `participants[].nickname`
      redacted to `Player_1..19` and `participants[].avatar` dropped),
      and the 10-member team (with `team[].ico` dropped).
    * `spec/fixtures/champion/README.md` -- audit trail with the
      PII / asset-url scan procedure.
  - Tests: 7 smoke tests in `spec/fixtures/champion/Fixtures.spec.ts`
    covering top-level keys, champion sub-object types, dropped
    asset urls and bubble/scene text, timers shape (`championRest`
    and `teamRest` legitimately nullable), team length, redacted
    participants, and reward structure. 628 total (621 + 7).
  - Merged via PR #1630 (commit b2ab9d7).
- [ ] **2.5** EventModule fixtures
  - Source: page index 13 (`/event.html`)
  - File: `spec/fixtures/event/event-detection.json`
- [x] **2.6** Fixture loader helper (2026-05-07)
  - File: `spec/testHelpers/Fixtures.ts`
  - Function: `loadFixture(modulePath: string, name: string): unknown`
  - Implementation: synchronous `fs.readFileSync` + `JSON.parse`. Returns `unknown`; callers narrow types at the use site (preferred over `any` per workspace rule 08).
  - Bundled with 2.1 + 2.2 in PR #1626. The League fixture is the first concrete consumer; future module fixtures (haremGirl, champion, event) reuse the same loader.
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
| 2026-05-07 | Task 1.2 done: `decideNextChampionTime` extracted, 10 new pure tests (576 total), bundle diff structural, signature changed from plan (no champion is selected, only the next check time), merged via PR #1619 (commit 524bde0) |
| 2026-05-07 | Task 1.3 done: equipment scoring helpers (`scoreItem`/`findBestItem`/`isBetter`) extracted, 16 new pure tests (592 total), bundle diff structural, scope changed from plan (no parser exists; girls parser deferred to stage 2), merged via PR #1621 (commit dfa13f5) |
| 2026-05-07 | Task 1.4 done: `decideBurst` and `shouldRunStandardHandler` extracted, 18 new pure tests (610 total), bundle diff structural, signature changed from plan (handler pipeline has no single picker; remaining handlers deferred to stage 3), merged via PR #1623 (commit 44aa97d) |
| 2026-05-07 | Stage 1 finished: 4 pure modules, 56 new tests across 4 PRs (1.1-1.4) |
| 2026-05-07 | Tasks 2.1 + 2.2 + 2.6 done (bundled): League fixtures (3 mid-tier opponents, tier-3 rewards) + shared loader `Fixtures.ts`, 5 new smoke tests (615 total), no src changes, plan deviation in opponent field set documented in fixture README, merged via PR #1626 (commit 7395a0a) |
| 2026-05-07 | Task 2.3 done: HaremGirl fixture (3 girls -- mythic 6/6 + legendary 5/5 + common 5/5) + 6 new smoke tests (621 total), no src changes, plan deviation in source path documented in fixture README (page 19 /waifu.html instead of plan's page 0 /home.html), `parseGirlsFromGameData` parser stays deferred to stage 3 per stage 2 rule, merged via PR #1628 (commit ab78a5a) |
| 2026-05-07 | Task 2.4 done: Champion fixture (active-champion from page 7 with redacted participants and stripped asset urls) + 7 new smoke tests (628 total), no src changes, plan deviation in source path documented in fixture README (page 7 /club-champion.html instead of plan's page 8 /champions-map.html), champion-map fixture deferred (DOM-only data, no JSON to extract), merged via PR #1630 (commit b2ab9d7) |
