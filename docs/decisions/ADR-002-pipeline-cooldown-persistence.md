# ADR-002: The scheduler's cool-down survives a reload

## Status
Accepted

## Date
2026-05-19

## Context

Every handler carries a `minIntervalMs` that keeps it from running again right
away. If that clock lives in memory only, it dies with the page -- and every
`gotoPage()` reloads the script. The first tick after the reload then sees the
handler as if it had never worked.

In #1700 that produced a ping-pong between `handleEventParsing` and
`handleLeague`: every navigation reset the cool-down, both preconditions fired
on the next tick, both navigated, and it started over every 3-5 seconds.

The classic timers (`Helper/TimerHelper.ts`) had long solved the same problem
for the imperative handlers, by writing to sessionStorage on every `setTimer`.
When the semantics moved into the pipeline, the persistence did not come along.

## Decision

The `lastRunAt` map is kept in sessionStorage under `Temp_pipelineLastRunAt`:
read at start, written after every run, format `{handlerName: epochMs}`.
Broken entries are dropped silently -- the handler then behaves as after a
fresh script start, which is the safe default. Handler authors still declare
only `minIntervalMs` and need to know nothing about storage.

**Where this lives today:** `BlockPipeline.blockPorts` reads and writes the key
(`getLastRunAt` / `setLastRunAt`), and `BlockScheduler` asks for it in
`eligibility`. The decision outlived the class it was written for:
`Scheduler.ts` has since been deleted.

## Rejected alternatives

**Use the classic timers per handler:** one uniform mechanism, but the
cool-down logic moves out of the declarative configuration back into every
handler body. `minIntervalMs` is a field of the configuration and belongs
resolved in one place.

**Manage cool-downs in the AutoLoop tick:** moves the problem, because AutoLoop
is itself a function whose memory the reload takes away.

**Persistence only for handlers that ask for it:** two cool-down models side by
side, with no known case that needs the in-memory one.

## Consequences

- `minIntervalMs` holds across reloads; the ping-pong from #1700 is gone
  structurally.
- One more write per completed run.
- Should the entries become unreadable, the scheduler reads `{}` and writes
  again on the next tick. No fallback into the loop.

## References

- Issue #1700
- `Helper/TimerHelper.ts` (the model for the sessionStorage persistence)
