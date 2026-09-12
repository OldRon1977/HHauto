# ADR-004: Pipeline block architecture (reload-proof flow control)

- Status: Accepted
- Date: 2026-06-12
- Implemented in: `BlockTypes.ts`, `BlockScheduler.ts`, `BlockPipeline.ts`, `BlockRunStore.ts`, `OrderResolver.ts`

## Context

HHAuto drives a browser game through page reloads. The flow logic starts from
almost nothing on every reload and remembers its progress only through a single
global token, `lastActionPerformed`, which can be lost between two reloads.

State before this refactor (code `4524911`, v7.36.0, verified):

- The scheduler picks one handler per tick from the `pipeline` array (array
  position = priority), checks the precondition plus `minIntervalMs` and runs
  steps.
- The runtime memory `ActiveChain { config, stepIdx, startedAt }` lives in
  memory ONLY. Only `lastRunAt` is persisted to sessionStorage. A page reload
  loses the running chain's progress -- the root of the multi-reload bugs.
- Continuation runs through `ctx.lastActionPerformed` (referenced in 13 files),
  which is reset to `none` at the end of the tick.
- The handlers sit in `Pipeline.config.ts` (HandlerConfig plus the
  `fromDescriptor` wrapper).
- The scheduler has a SOFT/HARD interrupt path (shouldSoftAbort /
  findHigherPriorityReady / abortAtSafePoint).

Consequences (written up in the `_lessons/pipeline-*` files): multi-step
functions (Quest, PoP, BossBang, mythic first visit) lose their context across
reloads, start over, are displaced, or get stuck.

## Decision

Flow control is rebuilt as a **data-driven block model with a reload-proof
block run**. The core points:

1. **Block instead of handler.** Every user-visible function (league, quest,
   money, ...) is an encapsulated `Block` of named `Step`s with declared
   metadata (dependencies, the `userMovable` flag, timeouts). The 33 handlers
   of today map one to one onto steps.

   **Rejected in ADR-006:** the bundling planned here (Season, PentaDrill,
   Seasonal, Pachinko, Champion, BossBang) was never built. The slot hold from
   ADR-005 solves the ping-pong the bundles were meant for. Every handler is
   its own single-step block today.

2. **Order as data.** A `Registry` (all block definitions) is separate from an
   `Order` list (ordered block IDs). Reordering = changing the ID list only.
   The default order lives in the code; the effective order lives in the
   existing settings storage (part of export/import), falling back to the code
   default when the cache is cleared.

3. **A reload-proof block run.** `ActiveChain` (in memory) becomes a persistent
   `BlockRun { blockId, stepIdx, startedAt, stepStartedAt, dispatched, data }`
   in sessionStorage. It survives planned AND unplanned reloads and dropped
   connections. The continuation of a running block lives in the BlockRun.

   **Not carried out:** `lastActionPerformed` was to be removed afterwards. It
   is still in `AutoLoopContext` and serves as a gate at descriptor level (see
   ADR-006) -- the multi-step split that would have replaced it never happened.

4. **At most one active block run.** A block that has started runs
   uninterrupted to the end (the only exception: the watchdog). The SOFT/HARD
   interrupt path is removed.

5. **At-most-once semantics.** State-changing steps are marked `dispatched` and
   persisted before they are sent (persist before act); on resume, a dispatched
   but unconfirmed step counts as done (better to miss an action than to fire
   it twice).

6. **Declared, enforced dependencies.** Blocks declare hard ordering
   constraints (runsAfter/runsBefore, beforeAll/afterAll). A validator checks
   the effective order against hard constraints, cycles and contradictions; an
   invalid configuration falls back safely to the default order (never
   bricked).

7. **Watchdog.** Step and whole-run timeouts; a persistent error counter per
   error signature; automatic deactivation at a threshold (persistent, reset on
   a script version change or on reactivation); an `<ERROR>` marker on the home
   page.

8. **Structured, reload-proof logging.** The `[PIPE]` format (key=value, one
   event per line, correlation IDs), a non-rotating context block, a ring
   buffer with write-through, integrated into the existing log pipeline. Lean
   always on, diagnostics behind a menu toggle. (The ring holds 64 chunks of
   128 KB today, see `LogStore.ts`.)

## Behavioural neutrality

This is a **real refactor**, NOT a type-only or `@version` bundle invariant.
The migration is behaviour-neutral on the happy path: same actions, same order
under the default order. The ONLY intended behaviour changes are the documented
continuation bug fixes (quest loop, mythic first visit, stuck on page).
Verification through behaviour comparison, tests and a live run, per
behaviour-related cluster against a production account. No existing bot
capability is removed or added. The per-feature timer display (pInfo) stays.

## What of it was built

Points 2-8 are in the code (`BlockTypes`, `BlockScheduler`, `BlockPipeline`,
`BlockRunStore`, `OrderResolver`, `PipeLogger`), including the reorder UI. Not
built: the bundling (ADR-006), the multi-step split of
PoP/Quest/BossBang/ChampionTicket (also ADR-006) and the removal of
`lastActionPerformed`. The SOFT/HARD interrupt path left with the old
scheduler.

## Alternatives

- **Keep the status quo (`lastActionPerformed`).** Rejected: the multi-reload
  bugs are structural and solvable only with reload-proof continuation; the
  interim point fixes (see `_lessons/pipeline-*`) treat symptoms.
- **A complete rewrite of the flow control in one step.** Rejected: too large a
  blast radius, no incremental live verification, and it contradicts the
  behaviour-neutral migration requirement.
- **localStorage instead of sessionStorage for the block run.** Rejected:
  sessionStorage survives the reload in the same tab, which is enough; after a
  tab crash a fresh start is wanted, not the resume of a stale run. The
  diagnostic log deliberately lives in localStorage (it survives a tab
  restart).

## Consequences

Positive: multi-step functions survive reloads; no displacement or restart;
deterministic runs, reproducible from the log file; user control of the order
becomes possible later without an architectural rebuild; a single stuck block
no longer stops the bot.

Negative / cost: more complexity in the scheduler (resume validation,
at-most-once, repeat cursor, watchdog); additional storage keys; the
incremental migration needs a live test per behaviour-related cluster.

## Validation

Validates requirements 9.1 (behaviour-neutral happy path) and 9.3 (incremental
migration with coexistence). The remaining requirements are implemented and
verified per building block.
