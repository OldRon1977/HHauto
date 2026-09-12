# ADR-005: A block holds the run slot until home (gate-hold-return)

- Status: Accepted
- Date: 2026-06-13
- Implemented in: `applySlotHold` (`BlockPipeline.ts`)
- Refines: ADR-004 (pipeline block architecture)
- Trigger: two live tests (v7.36.4/v7.36.5) showed pre-existing ping-pong loops
  (LV-28 Season fight<->collect, LV-29 PoP<->ClubChampion).

## Context

The handlers are single-step: per invocation they perform ONE action
(typically: navigate from home to the feature page) and report "done" at once.
The actual work happens on the next invocation, on the target page.

Two handlers that want opposite pages (Season:/season_arena vs
SeasonCollect:/season; PoP:/pop vs ClubChampion:/clubs) navigate each other
away. The `lastActionPerformed` coordination does not help: the AutoLoop reset
(`ctx.busy===false -> lastActionPerformed='none'`) clears the token on the
busy-free tick between two reloads. The result is mutual starvation, neither
reaching its working step. (Lesson
pipeline-multireload-continuation-verlust.)

Cooldowns are respected, so this is no scheduler bug; the loops are
pre-existing (on 7.36.x main too), and the adapter reproduces them faithfully.

## Decision

Every block goes through **gate -> hold -> return home -> release**, managed by
the scheduler:

1. **Gate (claim):** the scheduler starts a BlockRun, and the block owns the
   only active slot. Persisted (sessionStorage), survives a reload.
2. **Hold:** while the block acts, it keeps the slot across reloads. No other
   block can start. The continuation lives in the persistent BlockRun instead
   of the `lastActionPerformed` token, which makes the token reset irrelevant.
3. **Return and release:** the run ends when the handler goes idle (nothing
   left to do) -- ideally back on home.

### Mechanism (adapter wrapper, using the BlockRun `repeat` mechanics)

The adapter (BlockPipeline.toBlock) wraps every legacy handler step:

```
const r = await originalStep.fn(ctx);
if (!r.ok) return r;                       // error -> abort (watchdog)
return ctx.busy ? { ok: true, repeat: true }  // acting -> hold the slot, re-enter after the reload
                : { ok: true };               // idle -> end the run, free the slot
```

`ctx.busy` (set by the handler when it navigates or acts) is the hold signal.
`repeat` keeps the BlockRun on the same step; after the reload the scheduler
re-enters the same block and the handler -- now on the new page -- takes the
next step. Once the handler goes idle (busy=false), the run ends.

### Consequence for the rest of the plan

- The slot hold solves the ping-pong class **across the board** (all handlers),
  not only the 4 on the split list.
- **Bundling and most of the multi-step split are not needed for
  CORRECTNESS** -- Season holds the slot through fight->...->home, and THEN
  SeasonCollect runs. They become optional refinements (a per-item repeat
  cursor for PoP, quest sub-paths for finer at-most-once and reload safety),
  no longer a loop fix.
- **Follow-up work (R "gate/hold/return every block cleanly"):** handlers that
  finish their work WITHOUT navigating home (they rely on handleGoHome) release
  off-home with this mechanism. Those have to be found and given an explicit
  return home, so that every block releases at home. Until then handleGoHome or
  the next block catches the off-home release (degraded, but safe).

## Risks / safety nets

- **An endless hold** (a handler that never goes idle) is caught by the total
  run timeout (watchdog) -> abort -> cooldown -> home routing. Set
  totalTimeoutMs more generously per block where needed (PoP with many
  per-item reloads, say).
- **A double action** with a busy=true handler that does not navigate
  (re-entry on the same page): the handler's own timers and state usually
  prevent a repeated action; verify live per wave.
- Behaviour-changing (it IS the bug fix) -> a live test per wave, compared
  against 7.36.x.

## Alternatives

- **Splitting all ~25 navigate-then-work handlers per handler:** clean, but the
  bulk of the refactor; the generic slot hold has the same effect on loops with
  one central change. Split only where finer step semantics are needed.
- **Stay with `lastActionPerformed` and repair the reset:** treats the symptom
  (the token reset) and not the missing reload-proof continuation; the BlockRun
  slot hold is the structural answer.

## Validation

Validates requirements 4.1/4.2 (at most one run, uninterrupted) and 4.4/4.11
(reload-proof continuation replaces lastActionPerformed). Live verification:
the PoP/ClubChampion and Season ping-pong disappear; the happy path is
otherwise identical.
