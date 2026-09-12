# Working on HHauto

Kept short. Everything here cost time once.

## Before a change: read the document that covers it

Not all of them -- the one that covers it:

| You are changing | Read first |
| --- | --- |
| The scheduler, blocks, slot hold, focus | `docs/decisions/README.md` and the ADR it names |
| Storage keys | `docs-internal/storage-keys.md` |
| Page IDs, navigation | `src/config/HHEnvVariables.ts`, then `docs-internal/page-mapping.md` |
| Equipment, resonance | `docs-internal/equipment-resonance.md` |
| Team selection, scoring | `docs-internal/data-sources-team.md` |
| Measuring something against the running game | `docs-internal/live-verification-lessons.md` and `scripts/live-check/README.md` |

The file headers in the code carry the reasoning behind their rules. A proposal
that simplifies a rule has to have read that header first.

## What a finding is, and what is not

- **Measure at the call site.** A selector that returns 0 hits somewhere is
  only a finding once the page and the state the code reads it in are named. A
  count without context is an unfinished measurement.
- **A grep hit is not a claim.** `fromDescriptor` builds block names at
  runtime; whoever searches only for `name:` takes existing blocks for missing.
- **The DOM is not the JSON.** The game renamed the league column
  `match_history` in the DOM and kept it in the JSON. Carrying the DOM finding
  over to the data builds a silent bug: `numberOfFightAvailable` then reports 0
  fights.
- **Keep measured and inferred apart.** Reports and comments say which
  statement comes from a measurement and which from an inference.
- **No broad regex over source.** A regex meant to strip requirement IDs from
  comments took two import lines with it. Explicit replacements, then
  `npx tsc --noEmit`.

## Documentation is the current state

A file describes how things are today -- plus the decisions why something is
**not** done, or **no longer** done, so the same road is not walked twice. No
history, no stages, no task numbers.

- No copy of a list that lives in the code. Point at the code.
- No version and no date as an anchor, unless the version is a contract (a
  migration that reads exactly one old format).
- A comment that only retells the next line goes.

## After a change: what has to follow

| Changed | Has to follow |
| --- | --- |
| User-visible behaviour | `CHANGELOG.md` |
| A new or removed storage key | `docs-internal/storage-keys.md` |
| The menu, the debug flow, the operation | the wiki (`HHauto.wiki`, pages `The menu` / `Debugging`) |
| An earlier decision reversed | a new ADR in `docs/decisions` naming the old one; never reuse a number |
| Measured game mechanics | the `docs-internal` document that covers it, marked as measured |
| A file header's `Used by:` / `Depends on:` | that line, or `npm run check:headers` fails |

## The gates that check it

```
npm run typecheck        # blocking
npm run lint:ci          # blocking, a warning ratchet
npm test
npm run deps:circular:check  # cycles against the frozen baseline
npm run check:gm-grants  # the GM grants against the actual usage
npm run check:docs       # storage-keys.md and page-mapping.md against the code
npm run check:headers    # Used by / Depends on against the real imports
npm run check:player-data # no real player identifiers in the tree
npm run build            # HHAuto.user.js belongs in the same commit
```

`check:docs` and `check:headers` exist because both have drifted before:
`storage-keys.md` once stood nine keys behind the code, and 17 file headers
named modules the file no longer imports.

## Captures carry no real players

Fixtures and measurement notes are anonymised **as they are recorded**: your
own account `1`, other players from `1000` up, names `Player_N`. An account
number does not belong in a commit message, a PR text or a measurement report
either.

That went wrong twice and could only be undone by rewriting the history of a
public repository -- with a force push, 879 affected PR refs and a support
ticket. `npm run check:player-data` checks it, and the pre-commit hook stops it
before anything reaches GitHub. Set the hook up once on a fresh clone:

```
npm run hooks:install    # sets core.hooksPath to .githooks
```

`check:player-data` checks the **shape** such data arrives in: the person keys
of the game JSON with a number after them, a name field with a value, and in
Markdown files the word account with a number attached. A bare identifier
without such a key passes it. Whoever knows their own identifiers can have the
**value** checked as well:

```
HHAUTO_PRIVATE_IDS="123456 7890"    # directly
HHAUTO_PRIVATE_IDS_FILE=<path>      # one identifier per line, # is a comment
# otherwise $HHAUTO_HOME/private-ids.txt or ~/.config/hhauto/private-ids.txt
```

The list stays outside the repository; if the path does lie inside it and git
does not ignore it, the gate aborts. A finding names the file, the line and the
position in the list -- **never the value**, or the identifier would stand in
the terminal and in the CI log. Without a configured list the gate behaves as
before, so that somebody else's clone runs unchanged.

## Measuring live against the game

One session per account -- your own browser has to be logged out. The
logged-out page serves a placeholder hero with 600 kobans, against which every
measurement looks plausible and is rubbish: check `shared.Hero.infos.id` before
every measurement. On the maintainer's account, writing checks stay manual; a
checker that buys or saves there is a bot with another name. That no longer
applies to the dedicated test account -- see
[ADR-011](docs/decisions/ADR-011-a-dedicated-account-may-write.md). Its
credentials live outside the repository, in the local test-account directory
(`$HHAUTO_HOME/account/`; `HHAUTO_HOME` points at the harness directory).
