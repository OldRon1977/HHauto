# ADR-006: Neither bundled nor split -- the handlers stay as they are

## Status
Accepted

## Date
2026-06-14

## Context

The plan for the block architecture (ADR-004) foresaw two rebuilds, neither of
which was built:

- **Bundling:** handlers that share a continuation token or a timer were to be
  merged into one block each -- Season (fight + collect), PentaDrill
  (+ collect), Seasonal (free card + event collect + rank collect), Champion
  (+ ticket), BossBang (parse + fight).
- **Multi-step split:** PlaceOfPower, Quest, BossBang and ChampionTicket were
  to be split into explicit multi-step blocks with a repeat cursor, an
  at-most-once marker and resume validation.

Both had the same purpose: a handler working across several reloads should not
be interrupted by others while it does.

## Decision

Both are dropped. The slot hold (ADR-005) solves the problem generically: the
one active BlockRun survives reloads until the block is idle. What the two
rebuilds were meant to achieve is achieved -- without touching the handlers.

## Why bundling would do additional harm

The members of a bundle are **not adjacent** in the pipeline:
`handleSeasonCollect` runs early, `handleSeason` late; `handleChampionTicket`
before `handleChampion`; the three Seasonal handlers at three different
positions. That is deliberate -- rewards first, fights later. Bundling would
force them next to each other and change the order.

Separate blocks have a second advantage: the reorder UI shows each one, so
collect and fight can be moved independently.

## Why the split would have gained nothing

A review of the four handlers showed their target properties already hold:

| Handler | instead of a multi-step block |
| --- | --- |
| PlaceOfPower | `doPoP` handles one power place per call through the busy guard, `TK.PopToStart` is effectively the repeat cursor, an empty list -> home |
| Quest | the sub-paths are branches with `routeHomeIfWaitingOnQuest()` as the guard |
| BossBang | is already two blocks (parse, fight), sequenced by preconditions plus reload plus slot hold |
| ChampionTicket | the double-purchase race is covered by `autoLoop=false` before the setTimeout window, `busy=true` and a precondition recheck on resume |

## Consequences

- Every handler is a self-contained single-step block. No extra code needed,
  because that is the state.
- The hard ordering constraints and the `userMovable` flags -- the other part of
  the same work package -- are implemented and untouched by this decision.
- Quest keeps the guard that was meant as an interim. That is cleanup debt, not
  a correction.
- Whoever wants to bundle or split later needs a new reason: the coordination
  that motivated both is what the slot hold does.

## References

- ADR-004 (block model), ADR-005 (slot hold)
