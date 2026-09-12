---
last-verified: 2026-09-11
verified-against-version: 8.13.1
status: current
---

# HHauto Script Architecture

The structure, the flow, and where to look things up. Lists that live in the
code (files, handlers, games) are not copied here: every copy in this file has
had to chase the code once -- most recently a table of 32 "classic" handlers
and a directory listing that did not know two thirds of today's files.

---

## Entry point and initialisation

**File:** `src/index.ts`

- calls `hardened_start()` when the script loads; `hardened_start` checks
  jQuery and the Forbidden page and starts `start()` in
  `Service/StartService.ts`
- extends the global `Window` interface with the game globals that are read
  through `unsafeWindow`
- wires up the AutoLoop callbacks that modules need without importing
  `AutoLoop`: `setPachinkoAutoLoopKick(autoLoop)` and
  `setHeroAutoLoopKick(autoLoop)`. A static import would have formed a
  module->service cycle (ADR-008); the entry point is the only place that
  knows this dependency.

---

## Main loop: AutoLoop

**File:** `src/Service/AutoLoop.ts`, function `autoLoop()`. A recursive
`setTimeout` loop with the interval `Temp_autoLoopTimeMili`. One pass:

1. `updateData()`, base values for `questRequirement` and
   `battlePowerRequired`
2. build the context (`AutoLoopContext`: current page from `getPage()`, fight
   energy, `lastActionPerformed`, `busy = false`)
3. only with `getBurst()` and without a mouse pause: clean up the paranoia
   plan, `CheckSpentPoints()`, contest timers, read the page's event IDs
   (`EventModule.parsePageForEventId`)
4. **Scheduler**: `blockTick(ctx)` -- every action handler runs here, as a
   block of the pipeline. Suspended while a POST to `ajax.php` is in flight
   (ADR-003)
5. **Page handlers**: `handlePageSpecific(ctx)`, on every pass, `master` or not
   (see below)
6. paranoia switch (`flipParanoia`) when nothing is busy
7. advance `lastActionPerformed`
8. schedule the next pass, as long as `Temp_autoLoop` is on

There is no classic handler pass beside the pipeline any more;
`Service/AutoLoopActions.ts` only exports `wouldFightWithPower`, which
`handleTrollBattle` uses.

---

## Scheduler pipeline

**Files:**
- `src/Service/Pipeline.config.ts` -- the blocks (`HandlerConfig`) and, at the
  end, the `pipeline` array that sets the default order
- `src/Service/BlockPipeline.ts` -- registry, order, `INFRA_BLOCKS`,
  `BLOCK_CONSTRAINTS`
- `src/Service/BlockScheduler.ts` -- runtime: preconditions, steps, slot hold,
  focus, watchdog
- `src/Service/PipeLogger.ts` -- the `[PIPE]` log lines

Every block is a `HandlerConfig` with `precondition`, steps, `minIntervalMs`,
`atomic` and `interruptible`. The decisions behind them are in the ADRs: block
architecture (ADR-004), slot hold until home (ADR-005), focus (ADR-009),
navigation is not a stop (ADR-010), cool-down persistence (ADR-002). Overview:
`docs/decisions/README.md`.

Two extremes for orientation (look the values up in the code):

| Block | Property |
|---|---|
| `handleEventParsing` | not atomic, `minIntervalMs` 2 s, pinned in `INFRA_BLOCKS` |
| `handleLeague` | `atomic: true`, `interruptible: 'never'` -- the fight sequence is not interrupted |

`BlockPipeline.buildRegistryAndOrder()` derives the registry and the default
order from the `pipeline` array. Every block is therefore visible and movable
in the block order UI, unless it is in `INFRA_BLOCKS` (`handleEventParsing`,
`handleGoHome`) or has hard constraints in `BLOCK_CONSTRAINTS`. A feature that
navigates on its own therefore belongs in the pipeline as its own block -- not
as a tail call inside a foreign block, or it never shows up in the UI (auto
mystery).

Which block is running shows in the log: `[PIPE] ... block=<name> page=<id>
ev=start|done|focus|skip`. Measured 2026-09-11: with `master=true` and only
`autoQuest` on, the first navigating block was `handleEventParsing`
(`live-verification-lessons.md`).

### The lastActionPerformed guard

`ctx.lastActionPerformed` (stored in `Temp_lastActionPerformed`) locks blocks
while another one holds a multi-page sequence: most preconditions demand `none`
or their own tag. The `navInFlight` mutex (#1598) prevents double navigation
within one pass; against ping-pong across several passes (#1664) this guard is
needed as well.

---

## Page handlers

**File:** `src/Service/AutoLoopPageHandlers.ts`, `handlePageSpecific(ctx)`.

They run on every pass after the scheduler and **outside** the `master`
switch: they insert displays and buttons, read page data, and count the harem
(`moduleHaremCountMax`), among other things. Some also act --
`PathOfAttraction.run()` collects on the event page when `autoPoACollect` is
on. `master=false` is therefore not a dry run
(`live-verification-lessons.md`).

---

## Directories

Which files exist shows with `ls src/*/`. The layers and their roles:

| Directory | Role |
|---|---|
| `Service/` | flow: AutoLoop, pipeline and scheduler, start, navigation, paranoia, team building and scoring |
| `Module/` | one game area per file (league, troll, quest, shop, ...), with `harem/` and `Events/` as subfolders |
| `Helper/` | access without decisions of its own: storage, timers, page detection, hero, simulator |
| `Utils/` | log, ajax hooks, popups |
| `config/` | `HHEnvVariables.ts` (page IDs, game constants), `StorageKeys.ts` + `HHStoredVars.ts` (the storage register, including `HHStoredVarPrefixKey`), `game/` (one file per game variant) |
| `model/` | data types, `model/KK/` for the shapes of the game data |
| `i18n/` | translations |

Barrel files (an `index.ts` per directory) are gone (ADR-001). Every file names
its `Used by:` and `Depends on:` in the header; `npm run check:headers` holds
that against the imports.

---

## Module pattern

Modules are static classes without instances. Most carry `isEnabled()`
(unlocked) and `isActivated()` (switched on by the user), fighting modules also
`getEnergy()`; there is no shared, compiler-checked interface for that -- the
two static interfaces `src/model/IModule.ts` used to carry were referenced
nowhere and are removed. The file holds only `ModuleHandlerDescriptor`
(`isReady`, `execute`) today. Unlock conditions (level, girl count) live in a
table in `Service/FeatureGate.ts` (ADR-012).

---

## Architecture patterns

| Pattern | Description |
|---|---|
| Static modules | one state per script lifetime |
| Context per pass | `AutoLoopContext` is shared between the blocks |
| Storage as state | settings and runtime state in browser storage, prefix `HHAuto_` |
| Lazy init | `callItOnce` for one-off calls per page load |
| Ajax interception | `onAjaxResponse(regex, callback)` on jQuery's `ajaxComplete` |
| Game variants | one configuration per domain with feature flags and troll lists |
| Declarative pipeline | blocks with precondition, steps, watchdog, interruption |

---

## Supported games

The domains and their `gameID` live in `getEnv()` of the files under
`src/config/game/`; HornyHeroes (`hh_sexy`) is entered directly in
`HHEnvVariables.ts`. `getPage()` reads the `page` attribute of the element with
that ID. Measured 2026-09-11 on www.hentaiheroes.com: that is the `<body>` of
the game page itself (`<body id="hh_hentai" page="...">`), see
`page-mapping.md` and `runtime-architecture.md`.
