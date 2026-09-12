# ADR-011: A dedicated test account may write

## Status
Accepted

## Date
2026-09-09

## Reverses

The rule in the section "Measuring live against the game" of the repository
guide:

> Writing checks stay manual; a checker that buys or saves is a bot with
> another name.

The rule was never in an ADR, so this entry names the passage instead of a
number.

## Context

The rule protects the maintainer's account. But it costs exactly the check
that would be worth the most: `scripts/live-check` only reads, and jsdom
knows no game server. Every path that *changes* something therefore stays
unchecked until release -- a shop purchase, equipping gear, equipping a
booster, a pachinko round, a season reward.

What that has cost is in the history of the last releases. Bugs that only a
writing pass shows:

| Commit | What only showed up in the game |
|---|---|
| `56d76a2` | a rejected Sandalwood equip was booked as worn |
| `1a9ab49` | an x-round at the pachinko kept going although no girls were left to win |
| `eb111b2` | the upgrade queue broke off after the first entry, because the material was not scrolled |
| `ab30cc8` | collecting ended at the reload the claim itself triggers |

None of these is findable with a reading test. All four show up in the
second step of an action that has already changed the server state.

`docs-internal/live-verification-lessons.md` holds the other half: a
measurement in the wrong place invents a bug nobody has. Three such
findings were withdrawn, one of them only after it had been implemented.

## Decision

**There is a second account that exists only for checking. On that account
writing automation is allowed.**

- The maintainer's account stays under the old rule: read there, do not
  write.
- On the test account HHauto runs with `HHAuto_Setting_master=true` and
  decides for itself -- fights, missions, pachinko, shop, gear, settings.
  It earns the kobans for that in the game.
- The purpose is not game progress. Progress is the means: an account
  without gear, without a season tier and without a full harem never
  reaches the states in which the writing paths run.

### Limits that are not negotiable

- **No real money.** Kobans are earned in game. A purchase with means of
  payment does not happen, even where a strategy suggests it.
- **Credentials outside the repository.** They live in
  `$HHAUTO_HOME/account/`, not in the working tree. A `.gitignore` entry
  would be weaker: it does not stop `git add -f`.
- **The account ID appears nowhere** -- not in commits, PR texts, issues,
  measurement reports or fixtures. The same anonymisation applies as for
  captures (own account `1`, others from `1000`).
- **One session per account.** The test account plays the same game as the
  maintainer's. The two must never be logged in at the same time -- the
  cookies stay valid locally while the server serves the intro page, and
  every measurement on it looks plausible and is wrong.

### What a finding from the test account is

Unchanged, what the repository guide demands: measured at the call site,
page and state named, and noted separately which statement comes from the
measurement and which from an inference. A writing pass offers more
opportunities for a wrong conclusion, not fewer -- the server state has
changed between two observations, and by your own action at that.

## Rejected alternatives

### Everything as a dry run (`master=false`)
Watch the script and log what it *would* do.
- Against: the four bugs above show up in the second step. The first step
  looks correct in a dry run; the queue breaks off afterwards, the reload
  comes afterwards, the rejection comes from the server.
- Rejected: would have found none of the known bugs.

### Approve every koban expense individually
- Against: moves the decision without changing the risk -- it is spent
  either way. And it makes exactly the part impossible that this is
  about: whether the script's *budgeting* does something sensible over
  days only shows when it makes those calls itself.
- Rejected: expensive to operate, with no gain in what it tells you.

### Put the test account in a different game
Comix Harem instead of Hentai Heroes -- a separate account, not a second
account in the same game.
- Against: fixtures, `docs-internal` and `scripts/live-check/checks.json`
  come from Hentai Heroes. Every difference would have to be measured
  before a finding says anything about the shipped configuration.
- Rejected by the maintainer in favour of the same data base. The risk of
  two accounts of one operator behind one address is named and accepted.

### Write on the maintainer's account
- Against: a misstep of the script then hits a save game grown over
  years. That is what the old rule protects, and that part of it stays.
- Rejected: the test account exists so that a misstep costs nothing.

## Consequences

- Writing paths can have run against the real server once before release.
  That is a possibility, not a promise: what is checked is what someone
  checked.
- The repository guide keeps the rule, now with the addition of which
  account it applies to, and a pointer to this ADR.
- A new way to lose player data has appeared: the account produces logs,
  screenshots and fixtures. `npm run check:player-data` and the pre-commit
  hook remain the safeguard.
- The test: the next bug in a writing path should come from a pass on the
  test account and not from a user log after the release.

## References
- The repository guide, section "Measuring live against the game"
- `docs-internal/live-verification-lessons.md` -- why a measurement in the
  wrong place invents a bug
- `scripts/live-check/README.md` -- the reading checker, which stays what
  it is
- `$HHAUTO_HOME/account/README.md` (not in the repository) -- where the
  credentials live and why there
