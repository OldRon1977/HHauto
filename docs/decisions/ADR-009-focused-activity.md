# ADR-009: A block keeps the pipeline until its work is done

## Status
Accepted

## Date
2026-08-22

## Release line
v8.10.27 (issue #1841)

## Refines
ADR-005 (slot hold) -- closes its open follow-up work.

## Context

Franck-75 reported in #1841 that the script jumps between activities: a troll
fight, a season fight, a pantheon fight, and around again. His log shows it:
262 runs, of which 143 `handleSeason`, 59 `handleTrollBattle`, 57
`handleGenericBattle` -- almost nothing but switching.

The cause is a double meaning of `precondition` in the scheduler. It answers
two different questions:

1. *"May this block start now?"* -- `findNext`. That is what it is for.
2. *"Is this block finished?"* -- `continueRun` frees the slot as soon as it
   turns false.

`handleTrollBattle` deliberately hands battle result pages to
`handleGenericBattle`, so that the reward popup is read (#1740):

```ts
if (isGenericBattleResultPage(ctx.currentPage)) return false;
```

After every fight the hero stands on exactly such a page. The block says "not
me" and means "again in a moment" -- the scheduler reads "finished", frees the
slot and picks from the top of the order again. `handleGenericBattle` sits at
the very back just before `handleGoHome`, `handleSeason` ahead of it: Season
wins and navigates away. The same pattern for every fighting activity.

ADR-005 had named exactly this as open follow-up work ("handlers that finish
their work WITHOUT navigating home release off-home ... until then handleGoHome
or the next block catches the off-home release -- degraded, but safe"). This
ADR closes it.

## Decision

The scheduler keeps a **focus**: the activity that is currently finishing the
pipeline's work. Persisted in `sessionStorage` (`Temp_blockFocus`), because the
interesting case runs across reloads.

- When a block ends a run, it becomes the focused block.
- While the focus stands, `findNext` prefers it; if it is blocked only by its
  own `minInterval`/cooldown, the pipeline waits (up to `focusWaitMs`) instead
  of giving the slot away for one tick -- that handover IS the jumping.
- The focus drops as soon as the block no longer wants to run for a reason
  other than its own clock: no energy, threshold reached, timer set. Then the
  order decides again, and the next block runs to its own end in turn.

Two kinds of block may come in between (`runsDuringFocus`, and they never take
the focus):

- **The six collect blocks.** Their rewards expire with the event
  (`...RemainingTime < getLimitTimeBeforeEnd()`), so they must not wait behind
  a fight that runs as long as there is energy. They are offered BEFORE the
  focused block. Each sets its own next timer and therefore cannot starve the
  activity. (User decision: "the collect-all buttons MUST be allowed to run".)
- **`handleGenericBattle`.** The battle result page is exactly where the
  focused block is stuck; locking it out would be a deadlock.

**Only a run that did something keeps the focus.** A precondition says a block
MAY run, not that it has work: `handleTrollBattle` passes its gate and falls
through when the fighting power is below the threshold or no event girl is
there -- measured live, 47 such ticks out of 75 (comment at the handler). Such
an idle run must not renew the focus. What counts as "did something" is that a
step held the slot (`repeat`) -- the slot-hold signal from ADR-005, with which
the handler says it navigated, fought or collected (`BlockRun.acted`).

This is not theoretical: without that condition, 8.10.27 parked the pipeline on
`handleTrollBattle`. The block started every four seconds, did nothing, renewed
the focus in the process -- which also kept `focusStaleMs` from ever taking
hold, since it hangs on exactly that timestamp -- and in the pauses between, no
other block was even offered the slot.

**Where `acted` is set is not arbitrary.** The obvious place -- after the step
returns -- is not enough: a fighting handler awaits the battle POST whose
answer navigates the page, and the step never returns. The write dies with the
page, the run comes back after the reload without the marker and is treated as
idle. Measured in 8.10.29: three troll runs released the focus as "ran without
doing anything" after a real fight, and exactly three foreign blocks (League,
Quest, Season) started afterwards on `troll-battle`.

The marker is therefore set in two places: on `repeat` (handlers that return
before they navigate) and **on a valid resume after a reload** -- because being
back proves that navigation happened. The second place writes on a fresh page
and therefore survives.

**A third place: the handler that acts and gives the slot away anyway.**
`handleLeague` starts its fights, sets `nextLeaguesTime` and then releases on
purpose -- holding on the battle result page would starve `handleGenericBattle`
(#1796). The run is over before the reload arrives, so there is no resume for
the marker to hang on either. Measured in 8.10.30: League started three fights,
released, and `handleSeason` navigated away from the leaderboard page.

The signal for it is the switched-off auto loop: `gotoPage`, `safeReload` and
the battle paths turn it off shortly before the page disappears. `applySlotHold`
reads it after the step and sets `acted` **without** changing the hold
decision -- the block still releases, but the activity survives it and the focus
brings it back after the reload.

Against a focus that can never be served there is also `focusStaleMs` (5 min
without a run of the focused block): the focus then drops, and the behaviour
degrades exactly to the state before this ADR.

## No special case for clock times

Checked, because the obvious worry is that a long focus misses something with a
deadline:

- `waitforContest` is a **brake, not a deadline**: `canCollectCompetitionActive`
  turns false when the running contest ends in less than `safeSecondsForContest`
  AND another one follows -- so "not yet, save it up". It works through the
  preconditions anyway; a braked block is not ready and loses the focus.
- The collect windows are real deadlines, but `getLimitTimeBeforeEnd()` is
  `collectAllTimer` in **hours** (12 by default). A focus lasts minutes. They
  may interrupt regardless, see above.

So the focus needs no time exception.

## Rejected alternatives

### Give every fighting block its own way back from the result page
The wording of the ADR-005 follow-up. The block would leave the result page
itself and therefore never free the slot.
- Against: it would have to read the reward popup there -- exactly the logic
  #1740 deliberately centralised in `handleGenericBattle`. Duplicating it into
  seven handlers brings back the bug #1740 closed.
- Rejected: wrong place. The release decision is a scheduler matter.

### Bundle blocks (fight + GenericBattle as one block)
- Against: ADR-006 rejected bundling, and the reasons still hold -- the members
  are not adjacent, and bundling forces an order change.
- Rejected: ADR-006 stays untouched, and the focus needs no bundling.

### Split `precondition` into two predicates per handler
An additional `wantsMore(ctx)` per block ("do I still have work"), separate from
"may I run now".
- For: states the intent most clearly.
- Against: every handler would need a second predicate mirroring its internal
  resource logic (energy, thresholds, timers) outward -- a copy that can drift.
  The focus does not need it: the existing precondition already answers the
  question, once one stops reading its "false" as "finished".
- Rejected: a second truth for no additional benefit.

## Consequences

- One activity runs to its own end, then the next.
- Fixed along the way: a foreign block could start on a battle result page and
  navigate away before the reward was read. Visible in the log of #1841
  (`handleSeason ... page=troll-battle ev=start`). Only `handleTrollBattle` had
  the page waiver from #1740; now the focus protects the page no matter which
  block is fighting.
- The pipeline can idle briefly while it waits out the `minInterval` of the
  focused block (4 s for trolls, 2 s otherwise). That is the price of not
  giving the slot away for one tick.
- A new log event `ev=focus` carries the reason for the release -- visible
  without the diagnostics switch, so the next user log shows whether the focus
  holds.

## References
- Issue #1841 (log: `HH_DebugLog_1787359678332.log`), issue #1740.
- ADR-004 (block model), ADR-005 (slot hold), ADR-006 (no bundling).
