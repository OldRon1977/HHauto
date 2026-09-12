# Test Strategy HHAuto

What a test in this repository has to prove, and where a claim belongs when a
unit test cannot hold it. The staged plan that produced this (pure-function
extraction, fixtures, spec triage) is in the git history of this file.

## What a test is for

Coverage counts lines a test *entered*, not lines it *checked*. The equipment
optimizer shipped five real defects with its file at 91.5 % statement coverage:
every branch ran, every assertion agreed with the same wrong model of the game.

| Defect | would have been caught by |
|---|---|
| equipped items carry no `id_member_armor` | a fixture of a real `#equiped` object |
| wrong query parameter for worn items | fixture / contract test |
| buttons in a DOM tree that is never rendered | **live only** |
| `item_to_upgrade.level` freezes after page build | **live only** |
| ranking by a home-grown stat score | **no kind of test** -- it took a data comparison against 99 real players |

So a test is judged by what it would catch, not by the lines it touches.

The `coverageThreshold` in `jest.config.ts` stays as a floor against silent
rot, not as an argument. When removing a worthless test drops the number below
it, the number moves -- not the decision.

## Where a claim belongs

Every test belongs in exactly one of four classes. Two of them are kept, one
moves elsewhere, one is not written.

- **Real logic** -- rankings, thresholds, state machines, parsers with error
  handling. A unit test with synthetic input; synthetic input is the point.
- **Takes game data** -- anything that parses a game payload. Runs on a
  fixture cut from a real capture (see below), not on a hand-built object.
  Where no capture exists yet, the test says so.
- **A claim about the game** -- selectors, CSS classes, page globals, API
  parameters. jsdom holds these against evidence the test built itself, so
  they are green by construction and silent when the game changes. They go
  into `scripts/live-check/`, not into `spec/`.
- **Tautological** -- not written: config literals read back out of the
  registry that defines them, constructors read back through their getters,
  mocked values read back through the getter that returned them, markup held
  against its own template, `styles()` smoke tests, fixture files checked
  against their own README.

An adapter whose decision is covered spy-free by its `.pure` spec is not tested
again through spies. Where such a block was removed, a comment naming the
`.pure` spec stands in its place, so it is not re-added.

## Pure modules

Decision logic lives in `<Module>.pure.ts` files (`ls src/**/*.pure.ts`): data
in, decision out, no globals, no jQuery, no storage reads. The module itself
builds the input state from the page and delegates. That split is why a file
like `EquipmentGear.ts` or `Champion.ts` shows low coverage without being an
untested decision -- what is left in them is DOM and rendering.

Not every module has one, on purpose:

- `MonthlyCard.updateInputPattern()` only builds regex strings for the settings
  inputs; there is no claim flow, timer or level gate to extract.
- `BossBang` is a DOM-driven team search with clicks inside the loop, and
  `LabyrinthAuto.run()` a click and navigation sequence; the labyrinth
  decisions sit in `Labyrinth.pure.ts` instead.

An accepted kind of behaviour change from the extraction: a read-only call that
used to be short-circuited now runs unconditionally
(`ParanoiaService.checkParanoiaSpendings`, `randomInterval`). None of them
touches game state.

## Fixtures

`spec/fixtures/<topic>/`, each set with a README naming source, selection,
redactions, consumers and the refresh procedure. `loadFixture()` in
`spec/testHelpers/Fixtures.ts` returns `unknown`; the caller narrows the type.

Captures come from the inspector userscript
(`bonus-scripts/HHAuto_debug_inspector.user.js`); the dumps themselves are not
in the repository. Player data is anonymised when the fixture is cut -- own
account `1`, other players from `1000`, names `Player_N` -- and
`npm run check:player-data` checks the form.

What real captures settled that hand-built objects had not:

- a worn item has `id_member_armor_equipped` and **no** `id_member_armor` key;
  `caracs.chance` arrives as a string on legendaries; `resonance_bonuses` is
  absent rather than empty on most items
- a flat skill carries `percentage_value: null`, not `0` and not a missing key
- a Role-blessed girl carries no `pvp_v3` key and `can_be_blessed: false`
- the game's own `bonus_identifier` per synergy confirms the element mapping
  in `fightBonues`

Not produced, and why:

- A champion-map fixture: that page carries no champion JSON, only DOM, and
  HTML snapshots are ruled out below.
- A `parseGirlsFromGameData` parser: none exists; `spec/fixtures/haremGirl/`
  is sized for it if one is written.

## The live check

`scripts/live-check/` holds the claims about the game. `checks.json` names each
claim together with the call site that relies on it; `run.mjs` is a read-only
Playwright runner printing `OK` / `DRIFT` / `SKIP` per claim. It refuses to
measure unless `shared.Hero.infos.id` is set and no
`a[rel='phoenix_member_login']` exists -- the logged-out page serves a
plausible placeholder hero. Writes and popup states stay manual with printed
instructions; a checker that buys and equips to prove the API still works is a
bot. `playwright` is not a devDependency: CI has no account and must never
download a browser for this.

The rule its first run taught: follow a selector to a live call site before
adding a check. Its only DRIFT then was a selector lifted from a commented-out
block with no callers -- a grep hit, not a claim. Details in the README there
and in `live-verification-lessons.md`.

## Where untested decisions still are

The write paths ADR-011 keeps a game account for were checked for that:

- `LeagueHelper.numberOfFightAvailable` is tested, including the trap
  `CONTRIBUTING.md` names: the game renamed the `match_history` column in the
  DOM and kept the key in the JSON. The fixtures carry both, so the trap is in
  the test.
- `PlaceOfPower.girlPower` / `chooseGirlsTeam` are tested, including that
  `girlPower` **empties the array it is handed**; `chooseGirlsTeam` only gets
  away with it by passing a slice.
- The largest remaining decision code without tests: `ParanoiaService` (when
  the bot rests and what it spends first) and the rest of `BlessingService`.

## Traps when writing a test

**A negative assertion is vacuous until the positive one runs.** A test for
"the script must not click `#skip-quest`" passed before the fix, because
`QuestHelper.run()` clicks from a `setTimeout` and the test had no fake timers
-- nothing was clicked at all. Assert in the same test that the button which
*should* be pressed was pressed.

**A test that asserts new behaviour must be run against the old code.**
`git stash push -- <one source file>` and re-running the spec is the cheap
proof that a test would have caught the defect. Two TeamModule tests failed
that check for the wrong reason (a page guard the fixture did not satisfy) and
were passing without exercising anything.

**Module-level state outlives a test.** `Bundles` remembers when its popup
walk started, `FeatureGate` the last verdict it reported; both survive
`afterEach`. Either advance the fake clock per test so the memo ages out
(`Bundles.spec`), or expose a narrow reset the spec calls
(`FeatureGate.forgetReportedState`). Relying on test order hides a broken memo.

**A time limit in wall-clock milliseconds describes the machine.**
`AjaxTracker`'s uninstalled path was pinned to 50 ms, failed at 54 ms under
parallel load and passed alone. It is measured against its own timeout budget.

**The lint ceiling is the real count.** `lint:ci` allows exactly the warnings
the tree carries and moves down as they go. New code, specs included, adds
none: type a fixture or a mock (`unknown` plus a cast at the use site) instead
of reaching for `any`.

### Table-driven where the code is table-driven

ADR-012 replaced eight hand-written `isEnabled` conditions with one table, and
`spec/Service/FeatureGate.pure.spec.ts` follows that shape: every case against
every kind of condition (level / girls / world), so a new kind cannot arrive
with tests for only one of them. The eight getters have no tests of their own;
the shared decision behind them does.

Checked by hand mutation when it was written -- each introduced, the suite run,
reverted:

| Mutation | Failing tests |
|---|---|
| threshold of 1 ignored | 21 |
| `knownValue` accepts numeric strings | 10 |
| obstacle order swapped | 9 |
| a row loses its condition | 2 |

## Open decisions

- `RewardHelper.getRewardTypeByData` detects some reward types from the `ico`
  url (`items/K`, `items/XP`). No captured reward payload carries that url --
  the inspector does not collect reward payloads with icons, and the
  redaction rule would strip it. Before the next capture: either the inspector
  keeps `ico` for reward fixtures, or the parser detects on `type` alone.
- AJAX endpoints the game uses without an HHauto consumer:
  `node scripts/catalogue/run.mjs observe` records them with their shapes into
  `scripts/catalogue/out/observed-actions.md` (generated, not committed).
  When HHauto starts sending one, its schema test goes into
  `spec/fixtures/<endpoint>/`, laid out like `live-blessings/`.

## Why the suite still runs on jest 29

jest 30 was tried on 2026-09-12 and rolled back: it brings jsdom 26, where
`window.location` can no longer be redefined, and 395 of 1724 tests fail with
`TypeError: Cannot redefine property: location`. Only two files cause it --
`spec/testHelpers/MockHelpers.ts` and `spec/Service/PageNavigationService.spec.ts`
-- but the helper sits in nearly every suite. Whoever takes the upgrade on
replaces the redefinition there (a navigation facade the tests can stub, or
`jest.replaceProperty`) and the rest follows.

TypeScript 7 was tried the same day and rolled back for a different reason: the
tooling is not there yet. `ts-loader` aborts the build and madge crashes the
cycle check.

## Deliberately not done

- Snapshot tests for HTML.
- Mutation-testing tooling (Stryker). A hand mutation run on a new decision
  table, as above, is fine.
- Property-based testing as its own phase; one or two targeted tests at most.
- Coverage as a target. The threshold exists as a floor (see above).
- Splitting a full dump into per-page JSON files. Curated mini fixtures of
  5-20 lines per case instead.
- A pre-commit hook that runs the suite; CI does that. The hook in `.githooks`
  only stops player data, for the reason `CONTRIBUTING.md` gives.
- Tests for one-line `isEnabled` getters.
- A live checker that writes.
