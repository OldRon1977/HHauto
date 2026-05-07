# Session handoff -- HHAuto test strategy, stage 1

Status: 2026-05-07. Stage 0 is finished and merged into main (PR #1615,
commit c4d6837). Plan file `docs-internal/test-strategy.md` is the source
of truth and already contains the detailed entry point for stage 1
task 1.1.

## Prompt for the new session (copy-paste into a fresh chat)

```
We continue the HHAuto test strategy. Stage 0 is finished and merged.
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
1. Read `docs-internal/test-strategy.md`. The status block on top tells
   you where we are. Stage 0 is closed; stage 1 task 1.1 has a
   detailed signature and acceptance criteria.
2. Read `src/Module/League.ts` `LeagueHelper.isTimeToFight` plus the
   existing `spec/Module/League.spec.ts` describe block `isTimeToFight`.
   That is the surgical area for task 1.1.
3. Confirm with the user before introducing new public API or breaking
   any existing test.

== Stage 1 entry point: task 1.1 (League pure function) ==

Goal: Extract the decision logic of `LeagueHelper.isTimeToFight` into a
pure function `decideShouldFight(state) -> bool` so the brittle
`jest.spyOn` tests on static methods (finding C-5) can be replaced by
direct unit tests of the pure function.

Proposed signature (see plan for the latest version):
```
type ShouldFightState = {
  heroLevel: number;
  energy: number;
  energyMax: number;
  threshold: number;
  runThreshold: number;
  timerLeft: number;
  leagueEndTime: number;
  paranoiaSpending: number;
  boosterRequired: boolean;
  boosterEquipped: boolean;
};
function decideShouldFight(state: ShouldFightState): boolean;
```

Public API stays: `LeagueHelper.isTimeToFight()` keeps reading globals
and storage, then delegates to the pure function.

Acceptance criteria:
- All existing 554 tests stay green.
- New pure-function tests cover 8-12 cases (default, low energy,
  active timer, paranoia, boosters required + equipped, last hour of
  the league + insufficient energy).
- No behaviour change in the bundle (`npm run build` succeeds, diff
  on `HHAuto.user.js` is purely structural).

Branch: `refactor/pure-functions-league`.

== Workflow per task ==
1. Branch.
2. Implement (code + tests + docs in the same commit if it changes
   behaviour or API).
3. `npm test` and `npm run build` locally.
4. Commit (no AI mention, no Co-Authored-By).
5. Push.
6. Wait for user approval.
7. Open PR, merge with `gh pr merge --rebase --delete-branch`.
8. Tick the checkbox in `docs-internal/test-strategy.md`,
   update the status block, append to the change log.

== Important ==
- Do NOT auto-add tests without a plan reference.
- For every claim about behaviour: provide evidence (file + line)
  before patching.
- When in doubt: ask the user, do not guess.
- Plan file is the single source of truth. Update its status there.

== Open reminders ==
- Issue #1614 \"Coverage reporting in CI\" -- not part of stage 1, just
  a tracker for stage 4 / a future CI sweep.

== Data sources (unchanged from stage 0) ==
- `INPUT/hhauto_dump_*.json` (41 MB, 2026-05-05, 30 pages).
- `INPUT/HH_DebugLog_*.log` (3 files, ~10h old at the time of capture).
- Inspector script if a fresh dump is needed:
  `bonus-scripts/HHAuto_debug_inspector.user.js` v4.5.0.
```

## What was done in stage 0 (for context, not action)

- 39 specs / 554 tests / coverage 28.92% statements.
- `fdescribe` removed from Champion.spec.ts (1 test surfaced).
- 7 `xit` tests handled: 2 empty stubs dropped, 5 reactivated and green.
- MockHelper extended: `mockBoosterInventory`, `mockSetting`,
  `mockTimer`, `mockAjaxSuccess`, `mockAjaxError`, `mockGameGlobals`.
- Coverage reporters set: text, text-summary, lcov, clover, html.
- Plan and session handoff documented.
- Issue #1614 opened for CI coverage reporting (deferred).
- Merged via PR #1615 (commit c4d6837).

## Pre-flight checks before stage 1

- `git status` clean, on `main`.
- `git pull` to be sure main is up to date.
- `git config user.email` shows `oldron1977@gmail.com`.
- `npm test` shows 554 passed / 0 skipped / 554 total.
- `npm run build` succeeds with `HHAuto.user.js` rebuilt without diff
  (apart from line endings).

If any of these fails, stop and ask before starting stage 1.
