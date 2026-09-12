# ADR-012: One table for all unlock conditions

## Status
Accepted

## Date
2026-09-09

## Context

Eight modules answered the same question -- *has this account unlocked the
feature at all?* -- with eight hand-written conditions:

| Module | Condition |
| --- | --- |
| `League` | `isEnabledLeagues && getLevel() >= LEVEL_MIN_LEAGUE` |
| `Pantheon` | the same, through `Pantheon.pure.decideIsEnabled` |
| `PathOfGlory`, `PathOfValue` | the same, written out |
| `SultryMysteries` | level only, without the flag |
| `DoublePenetration` | level only -- with the comment `// And 10 gilrs` beside it |
| `PlaceOfPower` | 10 girls and world > 2, plus its own log throttling |
| `PathOfAttraction` | 10 girls and world >= 2 |

They had drifted apart. `DoublePenetration` names a condition in a comment
that the code does not check. `LoveRaidManager` carries its level check
commented out. The ten stood twice as a literal in the code until v8.12.14.

Worse, every condition reads its numbers itself -- and **the numbers are the
part that goes wrong**. Two of the nine bugs from the 8.12.9-to-8.12.18 pass
sat in such a condition, not in the feature behind it:

- **v8.12.11**: `Harem.getGirlCount()` returned 24 on the harem page for an
  account with 9 girls. A gate on that basis opens wrongly.
- **v8.12.13/14**: the same number stood at 3 for a day while the page
  delivered 13. A gate on that basis stays wrongly shut, and Place of Power
  stayed closed to an account that met the condition.

## Decision

**One table names the condition per module, one place reads the numbers, one
pure function decides.**

- `Service/FeatureGate.pure.ts` -- the decision, without globals, storage or
  DOM: `decideUnlocked(requirement, state)`.
- `Service/FeatureGate.ts` -- the `GATES` table, resolved against
  `ConfigHelper` (the `LEVEL_MIN_*` thresholds are overridable per game
  variant and therefore stay keys, not numbers), and the access to
  `HeroHelper.getLevel()`, `Harem.getGirlCount()` and `id_world`.
- The eight `isEnabled()` only call `FeatureGate.isUnlocked(name)`.

Three rules the table carries:

1. **A value that is not an answer is not a low answer.** `0`, `NaN`,
   `undefined`, a negative value -- all become 0, and 0 satisfies no positive
   condition. The game delivers these numbers unevenly: `getLevel()` is 0
   before a page has been parsed, `getGirlCount()` is 0 for "no source on this
   page" too, and `id_world` is missing away from the quest pages.
2. **Read only what the condition needs.** A level check does not fetch the
   girl count -- that costs storage and, without a cache, the page globals.
3. **A locked feature says why, once.** Not per tick: the same line once filled
   692 of 2532 log lines (v8.12.12). The message names the condition and the
   actual value ("needs 10 girls, the harem holds 9").

The game variant's `isEnabledX` flags belong in the table too, but as their own
condition: they are checked **first**, and a feature that does not exist in
this game variant is not logged -- that would be constant noise on this variant
and not the account's fault.

### What deliberately does not go into the table

**A condition nobody measured.** `DoublePenetration` stays with the level
check. The comment `// And 10 gilrs` goes, and the question stands as an open
point in `docs/reference/adventure-quest-flow.md`. A test records that there is
no girl condition there, so that nobody adds one from the old comment.

**"Currently on the page" is not an unlock condition.** For `PlaceOfPower`
that clause stays in the module: it keeps a run that is already there from
being sent away mid-work.

## Rejected alternatives

### A global gate -- switch the script off, whole or in part, below level 30

The proposal that led to this ADR: instead of catching every case
individually, lock the script below a threshold.

Worked through against the nine bugs of the 8.12.9-to-8.12.18 pass, such a
gate would have covered **one** (v8.12.12, log spam), **one** it is itself
about (v8.12.13/14 -- it *is* the gate), and **one** it would have hidden
instead of fixed (v8.12.11). Six would remain:

- the bundle tab and button colour (8.12.9) -- hits every account
- a quest fight with `autoTrollBattle=false` (8.12.10) -- hangs on the switch
- the triple bundle run (8.12.15) -- level-independent
- `#skip-quest` (8.12.16) -- not shown to affect low levels
- the PoA timer (8.12.17) -- PoA already demands ten girls anyway
- a team below seven (8.12.18) -- **level 52, 13 girls, and still a team of
  three**

The last point is the decisive one: the wrong assumption was "seven", not
"level 30". A gate would have made it invisible until it hit an account at
level 300.

On top of that: a gate has to read a number, and exactly those numbers were
the bug twice. More gates on the same basis multiply the places where a wrong
number decides.

Rejected. What remains of the idea is this ADR: **fewer gates, better fed, in
one place.**

### Move the conditions into `HHEnvVariables` entirely

The thresholds are already there. But the *composition* ("level AND girls AND
world") is a decision, not a constant, and `HHEnvVariables` has no tests.

Rejected: the table sits next to the function that evaluates it, and both are
tested.

### One gate per module, only with a shared helper

Would have been the smaller intervention. But it would have left exactly what
went wrong: eight places where somebody adds or forgets a condition. The
`DoublePenetration` comment is the proof that this happens.

## Consequences

- A new feature with an unlock condition gets a line in `GATES`; a name in
  `FeatureName` without a line fails the test.
- The thresholds stand in one place in the test (`league` 20, `pathOfGlory`
  30, `placeOfPower` 10 girls and world 3 ...). If the game changes one, the
  place to look is unambiguous.
- New log lines: seven features that were silently locked before now say once
  per state change what is missing.
- `Pantheon.pure.decideIsEnabled` is gone; its cases live in
  `spec/Service/FeatureGate.pure.spec.ts`.
- No new import cycle: `deps:circular:check` stays at 84 against the frozen
  baseline.

## References
- `src/Service/FeatureGate.ts`, `src/Service/FeatureGate.pure.ts`
- `spec/Service/FeatureGate.spec.ts`, `spec/Service/FeatureGate.pure.spec.ts`
- `docs/reference/adventure-quest-flow.md` -- the unmeasured ten-girls question
  for Double Penetration
- `CHANGELOG.md`, v8.12.11 to v8.12.18 -- the bugs the rules come from
