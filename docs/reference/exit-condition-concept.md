---
title: "Concept: when is a block finished?"
status: draft for decision
last-verified: 2026-09-11
concerns: "Issue #1841, ADR-009 (focused activity), ADR-010 (navigation is not a stop)"
---

# Concept: when is a block finished?

A draft for decision. It does not replace ADR-009; it replaces its weakest
part: the question of how the scheduler recognises that an activity is over.
Today it guesses from three indications; this concept lets the block say it.

## 1. What the scheduler decides today

Three questions, but only two hooks:

| Question | answered by | meant for it |
|---|---|---|
| May this block start here and now? | `precondition(ctx)` | yes |
| Does this block still have work? | `precondition(ctx)` | no |
| Did the last run do anything at all? | `BlockRun.acted` | a stand-in |

The first two collide whenever the answer to question 1 is "not on this page".
That is exactly the case from #1841: `handleTrollBattle` deliberately hands over
battle result pages (#1740), and the scheduler reads that as "finished".
ADR-009 fixed it by introducing a focus -- but the focus in turn needs an answer
to question 3, and the model does not have one. It is inferred.

## 2. What `acted` has cost

`acted` means "this run did something". The scheduler cannot measure that, it
infers it from indications. Every indication was added after practice had shown
a hole:

| Version | Hole | indication added |
|---|---|---|
| 8.10.27 | idle runs renewed the focus too -- the pipeline parked on `handleTrollBattle`, which did nothing every 4 s | `acted` introduced at all: only `repeat` (slot hold) counts |
| 8.10.29 | a fighting handler never returns (the battle answer navigates), the marker died with the page | a valid resume after a reload counts as `acted` |
| 8.10.31 | `handleLeague` acts and gives the slot away on purpose; the run ends before the reload, so there is no resume | a switched-off auto loop counts as `acted` |

Three indications for a fact the block itself knows. The pattern is the
problem, not the individual rule: every indication is a stand-in, and stand-ins
have edges.

One edge I see in the code (**read, not measured**): `acted` is set as soon as
the auto loop was switched off -- which every `gotoPage` does, including one
that only navigates home because there was nothing to do. `handleQuest` has
exactly such a path (`routeHomeIfWaitingOnQuest`: the quest waits for
resources, so back home). That run achieved nothing for the activity and still
counts as acting.

## 3. Finding: the precondition already says the right thing almost everywhere

ADR-009 rejected a second predicate with the argument that "33 handlers would
have to mirror their internal resource logic outward -- a copy that can drift".
I went through all 35 blocks of the pipeline. The argument does not hold:

**Only twelve blocks are activities at all** (they run repeatedly until a
resource or a goal is exhausted). The rest are tasks (do once, set a timer),
helpers or infrastructure -- for those the answer to "do I still have work" is
always *no* as soon as the run is done.

**And for nine of the twelve the answer is already in the precondition:**

| Block | Role | Trigger today | lives in |
|---|---|---|---|
| `handleLeague` | activity | `isTimeToFight() \|\| checkTimer('nextLeaguesTime')` | precondition |
| `handleSeason` | activity | `isTimeToFight() \|\| checkTimer \|\| interFightPause()` | precondition |
| `handlePantheon` | activity | `isTimeToFight() \|\| checkTimer('nextPantheonTime')` | precondition |
| `handlePentaDrill` | activity | `isTimeToFight() \|\| checkTimer('nextPentaDrillTime')` | precondition |
| `handleSultryMysteries` | activity | `autoOpenRunning \|\| open events` | precondition |
| `handleChampion` | activity | `descriptor.isReady()` | module descriptor |
| `handleClubChampion` | activity | `descriptor.isReady()` | module descriptor |
| `handleLabyrinth` | activity | `descriptor.isReady()` | module descriptor |
| `handlePlaceOfPower` | activity | `PopToStart.length \|\| checkTimer` | precondition |
| `handleBossBangFight` | activity | partly DOM (`$('.completed-event')`) | precondition, **page-dependent** |
| `handleTrollBattle` | activity | `shouldFight` -- energy, threshold, event girl, raid | **in the step**, and discarded |
| `handleQuest` | activity | no trigger, the precondition is "on and not busy elsewhere" | **missing** |

The tasks (14): `handleHaremSize`, `handleSalary`, `handleShop`,
`handleAutoEquipBoosters`, `handleMissions`, `handlePachinko`,
`handleSeasonalFreeCard`, `handleFreeBundles`, `handleContest`,
`handleDailyGoals`, `handleChampionTicket`, `handleLoveRaid`,
`handleBossBangParse`, `handleKobanAds`.
The helpers (7): the six collect blocks and `handleGenericBattle`
(`runsDuringFocus`, they never take the focus).
The infrastructure (2): `handleEventParsing`, `handleGoHome`.

So the task is not "write 33 predicates", but: **name a function that already
exists nine times, sits in the wrong place once, and is missing once.**

## 4. Proposal

An optional second predicate on the block:

```ts
interface Block {
  /** May I start here and now? Place, switches, loop state. */
  precondition(ctx: AutoLoopContext): boolean;
  /**
   * Do I still have work? Resource, goal, timer -- NEVER the current page.
   * Without the predicate the answer is false: the block is a task and is
   * finished when its run ends.
   */
  wantsMore?(ctx: AutoLoopContext): boolean;
}
```

**The dividing line is the actual decision:**

| belongs in the gate (`precondition`) | belongs in `wantsMore` |
|---|---|
| the current page (`ctx.currentPage`) | energy, kisses, tickets, fighting power |
| switches, the game's feature flags | thresholds from the settings |
| `ctx.busy`, `lastActionPerformed`, auto loop | timers (`checkTimer('next...')`) |
| `canCollectCompetitionActive` (a brake) | an open goal (event girl, raid, skin) |
| DOM queries | -- |

The reason for "never the page": `wantsMore` is evaluated when a run ends -- and
that is regularly on a battle result page. Exactly the page the gate rightly
closes.

**The focus rule becomes one line:**

```ts
// today
if (block.holdsFocus !== false && run.acted === true) setFocus(...)
// in future
if (block.wantsMore?.(ctx)) setFocus(...) else releaseFocus("finished")
```

No more inference. The block says it.

### No second truth

The counter-argument from ADR-009 only counts if `wantsMore` were a *copy*. It
is not, if it is the same function:

- Where the trigger is already in the precondition (9 blocks), it is pulled out
  as a named function and the precondition calls it. One function, two readers.
- `handleTrollBattle`: pull `shouldFight` out of the step, and the step calls
  `wantsMore(ctx)`. Again one function, two readers -- and the idle runs
  disappear along the way. How many those are stands in two user logs by now:

  | Log | starts of `handleTrollBattle` | real fights | idle |
  |---|---|---|---|
  | handler comment, 7.35.61 | 75 | 28 | 47 (63 %) |
  | night 2026-08-25, 8.10.47 | 253 | 9 | 244 (96 %) |
  | night 2026-08-26, 8.10.48 | 577 | 12 | 565 (98 %) |

  The block passes its gate and falls through in the step, because the actual
  question is only asked there.

  Measured again 2026-09-11 (8.13.1, test account, 20 minutes with the
  account's settings): `handleTrollBattle` 251 starts with 4 fights
  (`do_battles_trolls`), `handleQuest` 480 starts with one quest step (`next`)
  -- one start every 2.5 s, although the quest was waiting for resources after
  the first minute. Together 731 of the run's 769 block starts.
- `handleQuest`: here new logic really does arise, because there is none today.
  It is the only block where "a copy that drifts" would be an issue at all --
  and the reason to do it last.
- `handleBossBangFight`: its trigger reads the DOM. `wantsMore` must not.
  Proposal: only the page-independent part (`checkTimer('nextBossBangTime')`
  plus open event IDs) becomes `wantsMore`, the DOM part stays in the gate.

## 5. What becomes of `acted`

It falls out of the focus decision and is removed without replacement -- all
three places that set it (`repeat`, resume after a reload, auto loop off) and
the field in `BlockRun`. The no-progress watchdog hangs on `stepStartedAt`, not
on `acted`, and is untouched.

The question of who *takes* the focus answers itself too: whoever has
`wantsMore` and answers it with *yes*. Tasks do not have it and never take the
focus -- the `NEVER_FOCUS` list becomes documentation, not a rule.

## 6. Safety nets

A wrong `wantsMore` parks the pipeline -- exactly the damage of 8.10.27. Two
nets therefore stay:

1. **`focusStaleMs` stays** (5 min without a run of the focused block). It will
   take hold more reliably, because the timestamp is no longer renewed by idle
   runs.
2. **New: an idle counter.** If a focused block says *yes* n times in a row
   without its run going into the slot hold or changing a page, the focus drops
   with `ev=focus detail="says yes, does nothing"`. That is the old `acted`
   question -- but as an emergency brake with a log entry, not as the basis of
   the decision. Proposal: n = 5.

In addition: the `ev=focus` log line carries the result of `wantsMore`. Then
the next user log says why the pipeline stayed or left -- today it only says
that it did.

## 7. Implementation in stages

| Stage | Content | Risk |
|---|---|---|
| 1 | The type, the default, the scheduler reads `wantsMore`; `acted` stays as the fallback (`wantsMore?.(ctx) ?? run.acted`). Only `handleTrollBattle` and `handleSeason` get the predicate. | small: nothing changes for any other block |
| 2 | The remaining ten activities, `handleQuest` last. | medium: one test case per block |
| 3 | Remove `acted` and its three write sites, reduce `NEVER_FOCUS` to documentation. | small, once stage 2 is proven |

Stages 1 and 2 are one PATCH version each in the running line, stage 3 can go
with the next MINOR.

## 8. Tests

- One unit test per predicate with the edge cases it is supposed to decide
  (energy exactly on the threshold, a timer just expired, a goal just reached).
- Scheduler test: the focus stays exactly as long as `wantsMore` says *yes*,
  and drops in the tick in which it says *no* -- regardless of what the run did.
- Scheduler test: helpers may still come in between without taking the focus.
- Regression test for 8.10.27: a block that says *yes* and does nothing loses
  the focus after n runs.

## 9. What has happened since

Two of the three `acted` holes from section 2 were closed with ADR-010, without
introducing the predicate: the scheduler no longer discards a held run when the
script switches off its own autoLoop flag while navigating, and a block can
report a closing navigation as `done`. This concept is untouched by that -- it
answers the other question: how the focus recognises that an activity is over.
The measurement from the 8.10.48 night run still speaks for it: 80 focus
episodes, 144 releases "nothing left to do", 9 "ran without doing anything" --
and on close inspection none of those nine was a misjudgement of the heuristic.

All of it shipped with release v8.10.0 (2026-08-28). The concept is therefore
not settled, but postponed.

## 10. Measurement: energies on every page

The precondition for "wantsMore is page-independent" is that `Hero.energies.*`
is readable on every game page. Measured 2026-09-11 (8.13.1, test account,
without HHauto): on all 39 visited pages that carry the game's root element,
`shared.Hero.energies.{kiss, fight, challenge, quest, worship, drill}` each
stood there with `amount`, `max_regen_amount`, `next_refresh_ts` and
`seconds_per_point` -- among them pre-battle pages, event tabs, the harem, the
market and the quest page. The exceptions are only pages without that element
(battle pages, pre-battle pages without parameters); HHauto does not start
there either. The list per page is in `data-sources-inventory.md`, section 10.

## 11. To decide

1. Stages as proposed, or all twelve activities in one go?
2. Does `wantsMore` also filter the *selection* (`findNext`), or only the
   focus? With the filter the idle runs disappear (less log noise, fewer
   ticks), but the selection gains a second condition that can be wrong.
   Recommendation: the focus first, the filter as its own step afterwards.
3. `handleQuest`: what does "still have work" mean there? Today the block runs
   as long as it is switched on. A candidate: quest energy above the threshold
   OR a requirement that was just met. That is a game decision, not a code
   decision.

## References

- ADR-009 (focused activity), ADR-005 (slot hold), ADR-006 (no bundling)
- Issue #1841, issue #1740, issue #1796
- `src/Service/BlockScheduler.ts` (`complete`, `pickUnderFocus`, `eligibility`)
- `src/Service/BlockPipeline.ts` (`applySlotHold`, `FOCUS_INTERRUPTERS`)
