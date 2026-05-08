# Test Strategy HHAuto

Status: 2026-05-07. Living document. When a task is finished, tick the checkbox
and add the date plus commit hash in the Status field.

## Status

- Current stage: **4 in progress** (reliability layer)
- Last completed task: 4.3 (multi-domain smoke)
- Open reminder: issue #1614 (CI coverage reporting; will be picked up in stage 4 task 4.4)
- Next step: stage 4 task 4.4 (closure). Pick up issue #1614 here -- enable coverage reporting in CI via a GitHub Action, no threshold gate (per the strategy plan).
- Carried-forward reminders for stage 4:
  - `parseGirlsFromGameData(rawData) -> Girl[]` (deferred from stage 1 task 1.3): the haremGirl / event fixtures are sized to feed this parser. Stage 3 did not need it; reactivate when a haremGirl-touching parser test lands.
  - Champion-map fixture deferral: page 8 (`/champions-map.html`) carries no champion JSON in the dump (DOM-only). Needs a different testing approach for DOM-derived state before a map fixture can be produced.
  - League energy snapshot (`hero.shared.Hero.energies.challenge`) deferred from task 2.2: not added until a League parser test needs it.
  - Inspector-observed AJAX endpoints without an HHAuto consumer (audit hint, no test follow-up):
    - `process_rewards_queue` (page 0 / Home, response `{ rewards, success }`, ~29 bytes)
    - `show_specific_girl_grade` (class=`Hero`, page 19 / Waifu, response `{ ava, ico, success }`, ~245 bytes)
    Both are game-internal UI calls. If HHAuto starts consuming them later, an AJAX schema test belongs in the same `spec/fixtures/<endpoint>/` layout as the live-blessings slice.

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
- [x] **2.5** EventModule fixtures (2026-05-07)
  - Source: page index 13 (`/event.html`)
  - File: `spec/fixtures/event/event-detection.json` -- compound
    fixture combining the event header and the mega-event flag, both
    consumed by event detection logic.
  - Plan note: plan listed one file without further specification.
    The compound shape combines the two sources of event detection
    that real consumers use together (event header and mega-event
    flag); both are sourced from the same page.
    `battle.event_data` and `battle.current_event` are exact
    duplicates in this dump; only one is fixtured.
  - Contents:
    * `event_data` -- header from `pages[13].battle.event_data`
      (`event_name`, `type`, `identifier`, timers,
      `can_participate`, `participation_info`, `progression_href`).
      The `girls` field is substituted in from
      `pages[13].girls_full["game.event_girls"]` to break the
      inspector's circular marker. Each girl is reduced to the
      haremGirl whitelist plus event-specific extensions
      (`source`, `source_list`, `own`, `role_data`); avatar urls
      and decoration metadata are dropped. Captured event:
      `cumback_contest_188` ("Cumback Contests").
    * `mega_event` -- `{ active, time_remaining }` from
      `battle.mega_event_active` /
      `battle.mega_event_time_remaining`. Captured snapshot has the
      mega event active.
  - Tests: 5 smoke tests in `spec/fixtures/event/Fixtures.spec.ts`
    covering top-level shape, event_data identity / timers /
    participation gate types, the substituted girls list with the
    whitelist applied, dropped asset urls / decoration metadata, and
    the mega_event shape. 633 total (628 + 5).
  - Merged via PR #1632 (commit 13c5f82).
- [x] **2.6** Fixture loader helper (2026-05-07)
  - File: `spec/testHelpers/Fixtures.ts`
  - Function: `loadFixture(modulePath: string, name: string): unknown`
  - Implementation: synchronous `fs.readFileSync` + `JSON.parse`. Returns `unknown`; callers narrow types at the use site (preferred over `any` per workspace rule 08).
  - Bundled with 2.1 + 2.2 in PR #1626. The League fixture is the first concrete consumer; future module fixtures (haremGirl, champion, event) reuse the same loader.
- [x] **2.7** Stage 2 finished (2026-05-07)
  - Branch per fixture set as planned (`feat/test-fixtures-<module>`):
    `feat/test-fixtures-league` (PR #1626), `feat/test-fixtures-haremgirl`
    (PR #1628), `feat/test-fixtures-champion` (PR #1630),
    `feat/test-fixtures-event` (PR #1632). Each fixture-set PR was
    followed by its own `docs/test-strategy-stage2-task<n>` doc PR
    (PR #1627 / #1629 / #1631 / #1633). Closure on
    `chore/test-strategy-stage2-close`.
  - 4 fixture sets and the shared loader introduced; 23 new smoke
    tests (5 + 6 + 7 + 5) bring the suite from 610 to 633 total.
    Suite count: 43 -> 47.
  - No production code changes in stage 2; per the stage rule the
    deferred `parseGirlsFromGameData` parser stays deferred to
    stage 3 alongside the parser tests the fixtures are sized to feed.
  - Two of the five fixture tasks were renegotiated mid-flight when
    the plan's pre-inspection guesses did not match the dump:
    - 2.2 (League): plan listed `member.id_country`, `member.lvl`,
      `team.theme_elements[]`, `team.girls[]`. Dump has those at top
      level and `team` is an HTML snippet; the field selection
      followed the dump.
    - 2.3 (HaremGirl): plan pointed at page 0
      (`girls_full.game.shared.Hero`), which is hero-side data. The
      harem actually lives on page 19
      (`girls_full["game.girls_data_list"]`).
    - 2.4 (Champion): plan listed page 8 and two files; page 8
      carries no champion JSON. Active-champion sourced from page 7
      under `battle.championData`. Champion-map fixture deferred
      (DOM-only data, no JSON to extract).
  - Task 2.5 (Event): no plan deviation; compound shape
    (`event_data` + `mega_event`) chosen as a documented design call
    and recorded in the fixture README.

### Stage 3 -- decision-logic coverage (2-3 days)

For each `isTimeToX` / `shouldRunY` / `getNextZTime`: 4-8 tests covering
default, boundaries, setting-off, hero-level too low, timer active,
energy edge, AJAX error.

Precondition: stage 1 has produced a pure function for the respective
module.

- [x] **3.1** ClubChampion -- pure decision logic extracted (2026-05-08)
  - Plan deviation (agreed with the user before implementation): the
    plan listed `isTimeToFight` + `getNextChampionTime`. ClubChampion
    has no `isTimeToFight` equivalent that fits the pure pattern --
    the fight decision in `doClubChampionStuff` is interleaved with
    DOM scraping, ajax clicks, and `gotoPage` navigation, so
    extracting it would move more code than it tests.
    `getNextChampionTime` is renamed to `decideNextClubChampionTime`
    to match the actual concern (range selection) and to avoid the
    name clash with `Champion.pure.decideNextChampionTime` from
    stage 1 task 1.2. A second small decision,
    `decideAlignedClubChampionTimer`, is split out of `_setTimer`
    because it is the only other piece of pure logic in the module.
  - New module: `src/Module/ClubChampion.pure.ts` exports
    `decideNextClubChampionTime`, `decideAlignedClubChampionTimer`,
    and the typed `NextClubChampionTimerState` /
    `NextClubChampionTimerDecision` /
    `AlignClubChampionTimerState` shapes.
  - `ClubChampion.updateClubChampionTimer` builds the input state
    and delegates the range to `decideNextClubChampionTime`. The
    `[min, max]` tuple goes back into `randomInterval`, same as
    before.
  - `ClubChampion._setTimer` builds the input state and delegates
    the alignment to `decideAlignedClubChampionTimer`. The result
    is handed to `setTimer`, same as before.
  - Bit-for-bit equivalent: all threshold comparisons (`>7200`,
    `>10`, `<1200`) keep their strict semantics. Bundle diff is
    structural only.
  - Tests: 648 passed (633 + 15), 0 skipped, 48 suites.
  - Merged via PR #1636, commit d6e4e38.
- [x] **3.2** Pantheon -- pure decision logic extracted (2026-05-08)
  - No plan deviation in scope: both `isEnabled` and
    `isTimeToFight` extracted as pure functions. Naming follows the
    stage-1 convention (`decideIsEnabled`, `decideShouldFight`); the
    `decideShouldFight` symbol shadows the same name in
    `League.pure` only at the file boundary, callers import from
    `Pantheon.pure` directly so no global collision.
  - New module: `src/Module/Pantheon.pure.ts` exports
    `decideIsEnabled`, `decideShouldFight`, and the typed
    `IsEnabledState` / `ShouldFightState` shapes.
  - `Pantheon.isEnabled` builds the state and delegates.
  - `Pantheon.isTimeToFight` builds the state and delegates. The
    impure adapter recomputes `energyAboveThreshold` locally only
    because the existing diagnostic log line ("Time for pantheon
    but no booster equipped") still depends on it; the pure
    function recomputes the same expression independently.
  - Bit-for-bit equivalent: `>=` on the level gate, strict `>` on
    the energy gate, `runThreshold - 1` off-by-one preserved,
    operator precedence preserved on the booster branch
    (`(needBoosterToFight && haveBoosterEquipped) || !needBooster
    ToFight || isDailyGoal`).
  - Behaviour delta: `ParanoiaService.checkParanoiaSpendings(
    'worship')` is now called unconditionally; previously it was
    short-circuited away when energy was zero. Read-only call,
    no side effects. Same delta accepted in League stage 1
    task 1.1.
  - Tests: 664 passed (648 + 16), 0 skipped, 49 suites.
  - Merged via PR #1638, commit e54db73.
- [x] **3.3** MonthlyCard -- skipped after inspection, no decision-logic candidate (2026-05-08)
  - Plan deviation (agreed with the user before any change): the
    plan listed `shouldClaim` + `getNextClaimTime`. The module has
    neither. Despite the name, `MonthlyCard.ts` does not handle
    monthly-card claiming or timers; its single public method
    `updateInputPattern()` builds regex strings for the settings-
    UI input validators (`HHAuto_inputPattern.*`) based on
    `getEnergyMax()` of League / Season / Pantheon / PentaDrill /
    Quest / Troll. There is no claim flow, no timer, no AJAX call,
    no hero-level gate.
  - Stage-3 acceptance criteria (default / boundaries / setting-
    off / hero-level too low / timer active / energy edge / AJAX
    error) do not map onto string-building. The existing
    `spec/Module/MonthlyCards.spec.ts` already covers all 6
    energy-type tier mappings with 24 tests; the function is
    additionally wrapped in a try/catch which addresses the
    "AJAX error" class without extra tests.
  - Decision: skip 3.3 as a no-op stage-3 task. No code change,
    no pure module, no new tests. Tests stay at 664 / 49 suites.
  - Singleton-mutation cleanup of `updateInputPattern` (replacing
    the in-place `HHAuto_inputPattern.*` writes with a returned
    object) is style refactoring, not test-strategy work, and
    will be filed separately if the user decides to pursue it.
- [x] **3.4** Labyrinth path pipeline -- pure decision logic extracted (2026-05-08)
  - Plan deviation (agreed with the user before implementation):
    plan listed `LabyrinthAuto -- entire decision pipeline`.
    `LabyrinthAuto.run()` is a DOM / click / navigation sequence
    with no isolatable decision logic. The actual pure logic lives
    one module over, in `Labyrinth.ts`: `createPathFromMatrix`,
    `filterPathWithNoTreasue`, `sortPathsByDifficulty`, and
    `findBetter`. The extraction targets those four functions.
  - New module: `src/Module/Labyrinth.pure.ts` exports
    `getNextIndices`, `buildPathsFromMatrix`,
    `filterPathsWithTreasure`, `sortPathsByDifficulty`,
    `decideBetterOption`, plus the typed `LabyrinthPathOpponent` /
    `LabyrinthOpponentLite` / `FindBetterState` shapes. The
    path-pipeline functions are generic over
    `LabyrinthPathOpponent` (only `opponentDifficulty` +
    `isTreasure` are read); `decideBetterOption` is generic over
    `LabyrinthOpponentLite` (adds `isShrine`, `isNext`,
    `isOpponent`, `power`, `hasButton`).
  - `Labyrinth.createPathFromMatrix`,
    `Labyrinth.filterPathWithNoTreasue` (typo retained at the
    adapter boundary; pure function uses corrected name),
    `Labyrinth.sortPathsByDifficulty`, and `Labyrinth.findBetter`
    delegate to the pure functions. `findBetter` projects the
    DOM-bound `LabyrinthOpponent[]` onto `LabyrinthOpponentLite[]`
    (mapping `option.button` truthiness onto `hasButton`,
    attaching `__orig` as a back-reference) before delegating, and
    returns the original record afterwards.
  - Bit-for-bit equivalent: all filter cascades, the strict
    comparisons (`==`, `<`, `>`), and the fallback to
    `firstOption` when no eligible option survives are preserved.
  - Behaviour delta: the five inner debug-log lines inside
    `findBetter` ("first", "More reward: higher difficulty
    group", "More reward: Powerless opponent", "Not
    opponent", "Powerless opponent") are gone. They only fired
    when `debugEnabled === true` and never affected game state.
    The three outer debug logs and the post-filter log are kept;
    the post-filter log now reads "Options after filter (handled
    by Labyrinth.pure)".
  - Tests: 692 passed (664 + 28), 0 skipped, 50 suites.
  - Merged via PR #1641, commit c16adc2.
- [x] **3.5** Bundles -- pure decision logic extracted (2026-05-08)
  - Plan deviation (agreed with the user before implementation):
    plan listed "visibility / trigger". Bundles has no
    visibility check (the trigger is
    `getSecondsLeft('nextFreeBundlesCollectTime')` external to
    the module). `Bundles.goAndCollectFreeBundles` is a DOM /
    click / `setTimeout` pipeline with no isolatable pure logic.
    The only piece of pure logic in the module is the 24-hour
    threshold check inside `Bundles.getExpiryTime`; the
    extraction targets that single function.
  - New module: `src/Module/Bundles.pure.ts` exports
    `decideExpiryTime` and the typed `ExpiryTimeState` shape.
    Three-branch cascade: `null` -> fallback, `>= 24*3600` ->
    fallback (strict `<` boundary), otherwise -> scraped.
  - `Bundles.getExpiryTime` scrapes the DOM, computes the
    fallback value, and delegates the threshold decision. The
    original ERROR log is preserved and now fires whenever the
    fallback branch is taken (matching the original fallthrough
    behaviour).
  - Bit-for-bit equivalent: the 24-hour boundary stays strict
    `<`; exactly `24 * 3600` falls through to the fallback.
  - Behaviour delta: `randomInterval(60, 180)` is now called
    unconditionally as part of computing `fallbackSeconds`;
    previously it was only called in the fallback branch.
    `randomInterval` is read-only and has no game-state effect.
    Same delta type as League stage 1 task 1.1 and Pantheon
    stage 3 task 3.2.
  - Tests: 698 passed (692 + 6), 0 skipped, 51 suites.
  - Merged via PR #1643, commit cc8c80c.
- [x] **3.6** LivelyScene + BossBang -- partial extraction, BossBang skipped (2026-05-08)
  - Plan deviation (agreed with the user before implementation):
    plan listed "isAvailable, timer reset" for both modules.
    Reality:
    * LivelyScene: `isEnabled` is a trivial Config-flag wrapper
      (matches the strategy's "no trivial getters" rule). The
      "timer reset" path in `goAndCollect` is a single
      `setTimer + setStoredValue` pair with no branching.
      What is pure: the two OR cascades inside `parse`
      (`decideCollectTrigger`) and `parseClaimableRewards`
      (`selectClaimablePieces`).
    * BossBang: `parse()` is a DOM-driven team-search loop with
      `click()` side effects in the loop body. `goToFightPage`
      and `skipFightPage` are DOM / click / navigation. There is
      no `isAvailable` check; the timer is unconditional from
      the DOM with no reset branch. No isolatable pure logic.
      Skipped (same rationale class as 3.3 MonthlyCard).
  - New module: `src/Module/Events/LivelyScene.pure.ts` exports
    `decideCollectTrigger` and `selectClaimablePieces`, plus the
    typed `CollectTriggerState` / `PuzzlePieceLite` /
    `SelectClaimableState` shapes.
  - `LivelyScene.parse` builds the input state and delegates the
    OR cascade. `LivelyScene.parseClaimableRewards` projects each
    puzzle-piece onto `PuzzlePieceLite` (mapping the
    optional-chained `reward.shards`/`.rewards[0].type` onto a
    single `rewardType` string, attaching `__orig` as a
    back-reference) and delegates the loop.
  - Bit-for-bit equivalent: operator precedence preserved
    (`&&` binds tighter than `||`), strict `<` boundary on
    `remainingTime` vs `limitBeforeEnd` preserved.
  - Tests: 711 passed (698 + 13), 0 skipped, 52 suites.
  - Merged via PR #1645, commit 546df93.
- [x] **3.7** Stage 3 finished (2026-05-08)
  - Branch per task held: `refactor/pure-functions-clubchampion`
    (PR #1636), `refactor/pure-functions-pantheon` (PR #1638),
    `refactor/pure-functions-labyrinth` (PR #1641),
    `refactor/pure-functions-bundles` (PR #1643),
    `refactor/pure-functions-livelyscene` (PR #1645). Each
    refactor PR was followed by its own
    `docs/test-strategy-stage3-task<n>` doc PR (PR #1637 /
    #1640 / #1642 / #1644 / #1646). Task 3.3 (MonthlyCard)
    shipped as a doc-only skip
    (`docs/test-strategy-stage3-task33-skip`, PR #1640).
    Closure on `chore/test-strategy-stage3-close`. Plan's
    suggested unified branch `feat/test-decision-logic` was
    not used: the per-module branch convention from stage 1
    survived stage 3 unchanged because each task ships its
    own pure module.
  - 5 new pure modules produced (`ClubChampion.pure`,
    `Pantheon.pure`, `Labyrinth.pure`, `Bundles.pure`,
    `LivelyScene.pure`) with 76 new tests across 5 refactor
    PRs (3.1 - 3.2, 3.4 - 3.6); tests went from 633 to 711.
    Suite count: 47 -> 52.
  - Two of the seven sub-tasks shipped as documented skips:
    * 3.3 (MonthlyCard): module name is misleading -- the
      single public method `updateInputPattern()` only builds
      regex strings for the settings UI from the six energy-
      type `getEnergyMax()` values. No claim flow, no timer,
      no AJAX, no hero-level gate. The existing
      `MonthlyCards.spec.ts` already covers all six tier
      mappings with 24 tests, and the function is wrapped in
      a try/catch. Stage-3 acceptance criteria do not map
      onto string-building. Singleton-mutation cleanup
      (replacing in-place `HHAuto_inputPattern.*` writes with
      a returned object) is style refactoring and is filed
      separately if pursued.
    * 3.6 (BossBang half): `parse()` is a DOM-driven team-
      search loop with `click()` side effects in the loop
      body; the rest is DOM / click / navigation. There is
      no `isAvailable` check; the timer is unconditional from
      the DOM with no reset branch. No isolatable pure logic.
  - Six of the seven sub-tasks were renegotiated mid-flight
    when the plan's `isTimeToFight` / `getNextChampionTime` /
    `shouldClaim` / `getNextClaimTime` / `entire decision
    pipeline` / `visibility / trigger` / `isAvailable, timer
    reset` headings did not match the actual code; see the
    individual task notes. Net result: every module that had
    real pure decision logic now has a `<Module>.pure.ts`
    module.
  - Behaviour deltas accepted across stage 3, all read-only and
    without game-state effects (same class as League stage 1
    task 1.1):
    * 3.2 (Pantheon): `ParanoiaService.checkParanoiaSpendings(
      'worship')` now called unconditionally.
    * 3.5 (Bundles): `randomInterval(60, 180)` now called
      unconditionally as part of computing `fallbackSeconds`.
    * 3.4 (Labyrinth): five inner debug-log lines inside
      `findBetter` removed; all gated by `debugEnabled`.
    * Side-finding from 3.1 (ClubChampion): the impure
      adapter calls `randomInterval(decision.minTime,
      decision.maxTime)` once where the original called it
      three times across mutually exclusive branches; same
      number of random draws per call site, no behaviour
      change.
  - Stage 4 (reliability layer) inherits three deferrals from
    stage 1/2: `parseGirlsFromGameData` parser, the champion-
    map fixture, and the League energy snapshot. None of
    these blocked stage 3.

### Stage 4 -- reliability layer (1-2 days)

- [x] **4.1** AJAX schema tests (2026-05-08)
  - First endpoint slice (live-blessings) landed:
    - Source: `pages[*].live_blessings_api.live` (action=`get_girls_blessings`).
      All 30 dump pages carry the same envelope shape; three temporal
      snapshots persisted as `page-00.json` / `page-14.json` /
      `page-29.json` to feed every parser branch (position, eyeColor,
      labyrinth-filter rejection in active; hairColor / element / role
      in upcoming).
    - Inspector wraps the AJAX response as `{ live: <response>, error
      }`; stored fixture content is the inner `live` value, i.e. the
      actual game-API response that `BlessingService.fetchAndCache()`
      consumes. No PII, no asset URLs, no IDs in this endpoint --
      fixtures are stored verbatim.
    - Schema test: `spec/fixtures/live-blessings/Schema.spec.ts` calls
      every BlessingService parser (`parseTraits`, `parseBlessedValues`,
      `parseElement`, `parseBlessingPercent`) on each snapshot and
      asserts no-crash plus type plausibility. Private statics
      (`parseTraits`, `parseElement`) accessed through a typed
      `BlessingParserSurface` view; no `any`.
    - No `src/` change in this slice; existing parsers are pure on
      `response.active`.
    - Tests: 717 passed (711 + 6), 53 suites.
    - Merged via PR #1648, commit 3e647be.
  - Inspector inventory pass (active capture, observer enhancements):
    - v4.6.0 added a per-step XHR observer (PR #1650).
    - v4.6.1 added auto-update URLs (PR #1651).
    - v4.7.0 fixed the install-too-late bug: hooks now install at
      script start via `startHookSweep()` and persist for the inspector
      lifetime; `window.fetch` is patched too; per-step buffer slicing
      via `ajaxBufferMark()` / `ajaxBufferSliceFrom()` (PR #1652).
    - Fresh tour bundle captured 2026-05-08T13:35:50Z with v4.7.0:
      `INPUT/hhauto_dump_www_hentaiheroes_com_tour_2026-05-08T13-35-50-669Z.json`.
  - Inventory result: only one observed read-only AJAX endpoint with
    an HHAuto consumer (`get_girls_blessings`, already covered above).
    Two additional observed endpoints have no consumer in `src/`:
    - `process_rewards_queue` (page 0 / Home, ~29 bytes)
    - `show_specific_girl_grade` (class=`Hero`, page 19 / Waifu,
      ~245 bytes)
    Both are game-internal UI calls; HHAuto neither sends nor parses
    them today. Recorded as audit hints in the Status block.
  - Plan deviation (closing 4.1 with one schema test set instead of
    multiple): the strategy plan listed `pages[*].battle.*` and
    `pages[*].girls_full.*` as additional candidates. After re-reading
    the data sources inventory and the inspector capture, those paths
    are page-injected game globals (already covered as fixtures in
    stage 2: league / haremGirl / champion / event), not AJAX
    responses. Adding "page-global schema tests" would extend stage 2
    rather than stage 4 task 4.1. The remaining 12 AJAX call sites in
    `src/` are all writes (do_battles_leagues, market_buy, etc.) and
    cannot be exercised in the inspector without game-state effects.
    4.1 is therefore closed at one slice with an explicit no-consumer
    note for the two extra observed endpoints.
- [x] **4.2** Storage migration tests (2026-05-08)
  - Helpers slice (only slice):
    - `spec/Service/StorageMigration.spec.ts` -- 26 new tests covering
      `safeJsonParse` / `isJSON` / `getStoredJSON` edge cases plus a
      smoke pass over a real settings snapshot.
    - `spec/fixtures/storage-snapshot/setting-snapshot.json` -- 21
      keys curated from `INPUT/HH_DebugLog_1778140621437.log` covering
      boolean / integer / semicolon-list / JSON-array / custom-format /
      sessionStorage payloads.
    - Plan deviation documented in the spec: `isJSON` is intentionally
      a liberal regex pre-check; `safeJsonParse` remains the hard
      no-throw guard.
    - No `src/` change.
    - Tests: 743 passed (717 + 26), 54 suites.
    - Coverage: 30.62 statements / 19.75 branches / 26.22 functions /
      31.12 lines (was 30.55 / 19.67 / 26.15 / 31.06).
    - Merged via PR #1654, commit 3d1f208.
  - Closure rationale (plan deviation, agreed with the user before
    closing): the plan listed module-level migration tests for the
    four sites that combine `isJSON` with `JSON.parse` on stored
    values. After re-reading the live source:
    - `BDSMHelper.ts:428` and `AutoLoopActions.ts:169` are commented
      out (`by const ...` / `//console.log(...)`); not live code.
    - `Market.ts:38` only uses `isJSON` for a defensive log line; the
      actual parse goes through `getStoredJSON` (already covered).
    - `Shop.ts:101` uses `isJSON` + `getStoredJSON`; both already
      covered.
    - `EventModule.ts:792` is inside a `/* ... */` block; not live.
    There is no remaining ungauarded `JSON.parse(getStoredValue(...))`
    site in live code that the helpers slice does not already cover.
    A `setDefaults` boot-path test was offered as an alternative slice
    and explicitly declined; defaults flow through the same
    `getStoredValue` reader the helpers slice covers.
  - Optional follow-up slices recorded for future reference (not
    blocking 4.2):
    - `extractHHVars` with corrupted `Temp_Logging` (defensive parse
      already in place, so test value is small).
    - `setDefaults` boot path coverage (every registered key -> the
      registry default after a `localStorage.clear()`).
- [x] **4.3** Multi-domain smoke (2026-05-08)
  - Append-only update to `spec/Helper/ConfigHelper.spec.ts` -- 22
    new tests covering all 21 hostnames registered in
    `HHKnownEnvironnements`, plus a sanity guard that fires if a new
    hostname is added to `src/config/game/*Vars.ts:getEnv()` without
    extending the table.
  - Per case: `getEnvironnement()`, `getHHScriptVars('gameID')`,
    `isPshEnvironnement()`.
  - Plan deviation (documented in the spec describe block):
    - The plan listed `domain.includes()` as a thing to assert.
      `ConfigHelper` does not use `includes` -- it uses exact-match
      against `HHKnownEnvironnements[hostname]`. Smoke uses exact
      hostnames accordingly.
    - The plan called for a new file `spec/config/Domain.spec.ts`.
      Per user direction: appended to the existing
      `spec/Helper/ConfigHelper.spec.ts` instead, to avoid a new
      directory and keep all ConfigHelper tests together.
    - The handoff mentioned a `tour` subdomain captured in the dump.
      That was a filename artefact -- the actual host in the dump is
      `www.hentaiheroes.com` (the tour is a path, not a host). No
      extra entry needed.
  - No `src/` change.
  - Tests: 765 passed (743 + 22), 54 suites.
  - Coverage unchanged (ConfigHelper was already covered by the
    existing 10 tests).
  - Merged via PR #1657, commit d191c47.
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
| 2026-05-07 | Task 2.5 done: Event fixture (event-detection from page 13, compound event_data + mega_event) + 5 new smoke tests (633 total), no src changes, no plan deviation (plan specified only the file name), merged via PR #1632 (commit 13c5f82) |
| 2026-05-07 | Stage 2 finished: 4 fixture sets (league / haremGirl / champion / event) + shared loader, 23 new smoke tests across 4 fixture PRs (1626/1628/1630/1632) and 4 doc PRs (1627/1629/1631/1633), 633 total, no src changes; three plan deviations documented in the affected fixture READMEs; deferrals for stage 3 (parseGirlsFromGameData) and beyond (champion-map needs a different testing approach for DOM-derived state) carried forward in the status block |
| 2026-05-08 | Task 3.1 done: ClubChampion pure-function extraction (`decideNextClubChampionTime`, `decideAlignedClubChampionTimer`) + 15 new pure tests (648 total), bundle diff structural, plan deviation in extracted scope documented in the task entry (no `isTimeToFight` equivalent in the module; `getNextChampionTime` renamed to `decideNextClubChampionTime` for clarity and to avoid the name clash with `Champion.pure.decideNextChampionTime`), merged via PR #1636 (commit d6e4e38) |
| 2026-05-08 | Task 3.2 done: Pantheon pure-function extraction (`decideIsEnabled`, `decideShouldFight`) + 16 new pure tests (664 total), bundle diff structural, no plan deviation in scope; behaviour delta documented (`ParanoiaService.checkParanoiaSpendings` now called unconditionally, mirroring League stage 1 task 1.1), merged via PR #1638 (commit e54db73) |
| 2026-05-08 | Task 3.3 skipped: MonthlyCard has no claim flow / timer / hero-level gate -- its single public method `updateInputPattern()` only builds regex strings for the settings UI, fully covered by the existing `MonthlyCards.spec.ts` (24 tests). No code change, no PR, only doc update; tests stay at 664 / 49 suites. |
| 2026-05-08 | Task 3.4 done: Labyrinth path pipeline pure-function extraction (`getNextIndices`, `buildPathsFromMatrix`, `filterPathsWithTreasure`, `sortPathsByDifficulty`, `decideBetterOption`) + 28 new pure tests (692 total), bundle diff structural, plan deviation in module choice documented in the task entry (`LabyrinthAuto.run()` has no isolatable pure logic; the actual decision pipeline lives in `Labyrinth.ts`); behaviour delta documented (five inner debug-log lines inside `findBetter` removed, all under `debugEnabled === true` and without game-state effects), merged via PR #1641 (commit c16adc2) |
| 2026-05-08 | Task 3.5 done: Bundles `getExpiryTime` pure-function extraction (`decideExpiryTime`) + 6 new pure tests (698 total), bundle diff structural, plan deviation in scope documented in the task entry (no visibility/trigger logic in the module; only the 24-hour threshold check is pure); behaviour delta documented (`randomInterval(60, 180)` now called unconditionally, mirroring League stage 1 task 1.1 and Pantheon stage 3 task 3.2), merged via PR #1643 (commit cc8c80c) |
| 2026-05-08 | Task 3.6 done: LivelyScene pure-function extraction (`decideCollectTrigger`, `selectClaimablePieces`) + 13 new pure tests (711 total), bundle diff structural; BossBang skipped (no isolatable pure logic, same rationale class as 3.3 MonthlyCard); plan deviation in scope documented in the task entry (`isAvailable` / `timer reset` headings did not map onto either module's actual code), merged via PR #1645 (commit 546df93) |
| 2026-05-08 | Stage 3 finished: 5 pure modules (ClubChampion / Pantheon / Labyrinth / Bundles / LivelyScene), 76 new tests across 5 refactor PRs (1636/1638/1641/1643/1645) and 6 doc PRs (1637/1640/1642/1644/1646 plus the 3.3 skip-only doc PR), 711 total; six of seven sub-tasks renegotiated mid-flight when the plan's symbol names did not match the actual code; two sub-tasks shipped as documented skips (3.3 MonthlyCard -- module name is misleading; 3.6 BossBang half -- DOM-only); behaviour deltas documented per task, all read-only and without game-state effects |
| 2026-05-08 | Task 4.1 first endpoint slice: live-blessings AJAX schema fixtures (3 temporal snapshots) + parser smoke test (`parseTraits` / `parseBlessedValues` / `parseElement` / `parseBlessingPercent` on real payloads via a typed `BlessingParserSurface` view; no `any`); fixture content is the inner `live_blessings_api.live` value (= actual game-API response BlessingService consumes); 6 new tests (717 total, 53 suites); coverage 30.13->30.55 statements / 18.94->19.67 branches / 25.79->26.15 functions / 30.69->31.06 lines; no plan deviation; merged via PR #1648 (commit 3e647be) |
| 2026-05-08 | Task 4.1 closed: inspector inventory pass via v4.7.0 (PRs #1650/#1651/#1652 -- per-step XHR observer, auto-update URLs, persistent XHR + fetch hooks). Fresh tour bundle (`hhauto_dump_..._2026-05-08T13-35-50-669Z.json`, inspector v4.7.0) shows three observed endpoints across all 32 pages: `get_girls_blessings` (covered by the live-blessings slice), `process_rewards_queue`, `show_specific_girl_grade`. The latter two have no HHAuto consumer; recorded as audit hints. Plan deviation documented (closing 4.1 with one schema test set; remaining `pages[*].battle.*` / `pages[*].girls_full.*` paths are page-globals already covered in stage 2 fixtures, not AJAX responses; remaining 12 src/ AJAX call sites are writes and not testable from the inspector). Next step: stage 4 task 4.2 (storage migration tests) |
| 2026-05-08 | Task 4.2 first slice: storage-migration helpers spec (`safeJsonParse` / `isJSON` / `getStoredJSON` edge cases) plus a real settings snapshot smoke pass; `spec/fixtures/storage-snapshot/setting-snapshot.json` curated from `INPUT/HH_DebugLog_1778140621437.log` (21 keys covering boolean / integer / semicolon-list / JSON-array / custom-format / sessionStorage payloads). 26 new tests (743 total, 54 suites). Coverage 30.55->30.62 statements / 19.67->19.75 branches / 26.15->26.22 functions / 31.06->31.12 lines. Plan deviation documented (`isJSON` is intentionally a liberal regex pre-check; `safeJsonParse` remains the hard no-throw guard). No `src/` change. Merged via PR #1654 (commit 3d1f208) |
| 2026-05-08 | Task 4.2 closed (helpers slice only): plan deviation documented after re-reading live source -- the four module-level `JSON.parse(getStored...)` sites the plan listed are either commented out (`BDSMHelper:428`, `AutoLoopActions:169`, `EventModule:792`) or already covered by the helpers slice (`Market:38` defensive log + `getStoredJSON`, `Shop:101` `isJSON` + `getStoredJSON`); no remaining ungauarded `JSON.parse` site in live code. Optional follow-up slices recorded but not blocking (`extractHHVars` corrupted `Temp_Logging`; `setDefaults` boot-path). Next step: stage 4 task 4.3 (multi-domain smoke) |
| 2026-05-08 | Task 4.3 done: multi-domain smoke covering all 21 hostnames in `HHKnownEnvironnements` (HentaiHeroes 6 / ComixHarem 2 / GayHarem 3 / GayPornstarHarem 2 / MangaRpg 2 / PornstarHarem 2 / TransPornstarHarem 2 / AmourAgent 1 / SexyHeroes 1) plus a sanity guard against new hostnames; appended to existing `spec/Helper/ConfigHelper.spec.ts` (per user direction, instead of new `spec/config/Domain.spec.ts` file). 22 new tests (765 total, 54 suites). Plan deviations documented (exact-match instead of `domain.includes()`; appended instead of new file; `tour` subdomain in handoff was a filename artefact). No `src/` change. Merged via PR #1657 (commit d191c47) |
