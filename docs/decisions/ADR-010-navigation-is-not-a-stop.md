# ADR-010: A navigation is not a stop, and going home can be a finish

## Status
Accepted

## Date
2026-08-26

## Release line
v8.10.49, shipped with v8.10.0 (issue #1841)

## Refines
ADR-005 (slot hold) and ADR-009 (focused activity).

## Context

A block that navigates holds its slot so that it can carry on after the
reload (ADR-005). `gotoPage` and `safeReload` switch `Temp_autoLoop` off in
the process, right before the page disappears. The stop check at the start
of `tick()` read exactly that flag as "the script was stopped" and
discarded the running run:

```ts
if (this.ports.isMasterOff() || this.ports.isAutoLoopOff()) { ...abort... }
```

Measured on a night run of 8.10.48 (16 h log, 14,642 lines):

| Finding | Value |
|---|---|
| Aborts in total | 13 (12x `handlePlaceOfPower`, 1x `handleAutoEquipBoosters`) |
| Last step before | 13x `detail=repeat` -- the block was holding its slot |
| Distance from the previous "setting autoloop to false" | 1.9-2.0 s (11x), once 1.1 s, once 5.0 s |
| `Setting_master` during the night | `true` |
| `handlePlaceOfPower` | 12 starts, 0 `run complete`, 12 aborts |

2.0 s is exactly one scheduler tick. Not one of these aborts had anything
to do with the master switch, although all were logged as
`detail=master-off` -- the message named both conditions the same way.

The second half showed up in the same log. `handlePlaceOfPower` does
exactly the right thing when there is nothing left to start: clear the
list, navigate home, return `{ok: true}` -- that is, *finished*. But the
slot-hold rule cannot tell a closing navigation from an intermediate one:
`ctx.busy` is set in both cases, so it became `repeat`, and the next tick
discarded the held run. In 5 of the 12 cases it went to `home.html` (the
closing case), in 7 to a `pop_id=N` page (mid-work).

The damage was limited -- the inline stop path counts no error, sets no
cooldown and triggers no auto-disable, and PoP started 36 power places
during the night. What was lost is the run state: PoP rebuilt `popToStart`
every time instead of continuing its pass.

## Decision

**The two stop conditions are separated.**

- `isMasterOff()` stays the stop: the user says halt, the run is
  discarded, the focus drops. Unchanged.
- `isAutoLoopOff()` is **no longer** a stop, but a pause. If a run is
  holding the slot, the tick merely skips; the run stays. If the flag
  stays off for longer than `navigationGraceMs` (30 s), the run is
  discarded as before -- under its own name (`detail=autoloop-off`).

The 30 seconds separate the two cases that turn the flag off: a
navigation is over in seconds, the paranoia rest lasts minutes to hours.

**A handler can say "finished".** `{ok: true, done: true}` survives
`applySlotHold` instead of being rewritten into `repeat`.
`handlePlaceOfPower` returns it when its list is empty and it goes home.

## Rejected alternatives

### Check `run.dispatched`
The obvious route: protect the run only while it is marked as navigating.
- Against: `dispatched` is set only for steps with `stateChanging: true`,
  and **no** step is marked that way -- `ev=dispatch` appears zero times in
  the night run. The condition would always have been false.
- Rejected: would have changed nothing. (The proposal was on the table
  briefly and the measurement refuted it before it was built.)

### Stop switching the flag off during navigation at all
- Against: `Temp_autoLoop` deliberately holds everything else back during
  a running navigation. Keeping it and correcting only its *reading* in
  the scheduler changes one place instead of 45 write sites.
- Rejected: a bigger intervention for the same result.

### Let `applySlotHold` detect that it went home
Infer from the target page whether the navigation was a finish.
- Against: a navigation home is not always a finish (Quest refills
  resources and comes back). The rule would be guessing, exactly like the
  `acted` heuristic that has already cost ADR-009 three corrections.
- Rejected: the block knows, so let the block say it.

## Consequences

- A held run survives its own navigation.
- The log message names the cause: `master-off` or `autoloop-off`. The
  confusion that delayed this investigation by a day cannot happen again
  in the next user log.
- Blocks that go home after their work is done can express that. Whoever
  does not set `done` behaves exactly as before.
- The test for the next night run: `handlePlaceOfPower` must show
  `ev=done detail=run complete` instead of `ev=abort`.

## References
- Issue #1841, ADR-005 (slot hold), ADR-009 (focused activity)
- `src/Service/BlockScheduler.ts` (`tick`, stop check), `src/Service/BlockPipeline.ts` (`applySlotHold`)
- `docs/reference/exit-condition-concept.md` -- the open question whether the
  `acted` heuristic is replaced entirely by a predicate of the block
