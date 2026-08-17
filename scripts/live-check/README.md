# Live check

What jsdom cannot hold: whether the selectors, page globals and API parameters
the script depends on are still the ones the game serves.

Run it by hand before a release. It is deliberately not wired into CI — CI has
no account, and a check that cannot log in either fails permanently or lies.

## Running it

```bash
npm i --no-save playwright && npx playwright install chromium   # once
HHAUTO_PROFILE=~/.config/hhauto-claude/profile node scripts/live-check/run.mjs
```

`VAR=value cmd` is bash syntax. In fish, or to stay shell-agnostic, use `env`:

```
env HHAUTO_PROFILE=$HOME/.config/hhauto-claude/profile node scripts/live-check/run.mjs
```

| Variable | |
|---|---|
| `HHAUTO_PROFILE` | **required** — a browser profile that is logged into the game. Keep it outside this repository; it holds session cookies. |
| `HHAUTO_CHROMIUM` | optional `executablePath`, e.g. `~/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome` |
| `HHAUTO_BASE_URL` | optional, defaults to the `baseUrl` in `checks.json` |
| `HHAUTO_HEADED=1` | optional, shows the browser |

Exit code `0` all clear, `1` at least one DRIFT, `2` could not measure at all
(no profile, no playwright, not logged in).

## Output

```
live check against https://www.hentaiheroes.com

  OK    session                  logged in (id=…, … kobans, 0 login anchors)
  OK    league-anchors           4 selectors present
  DRIFT shop-data-d-shape        missing keys: rarity (in 203 payloads)
  SKIP  pachinko-orb-names       [orb_name] matched nothing on this page state
```

A `DRIFT` is a claim the code still makes and the page no longer honours. It is
the start of an investigation, not a verdict: find the call site, name the page
and sub-state it runs in, and only then decide. A count of `0` without a stated
context is an unfinished measurement.

## Two traps, both paid for

**The logged-out page serves a plausible placeholder.** `window.shared.Hero`
exists on the intro page with 600 kobans and full energies. Every measurement
against it looks valid and is garbage. The runner therefore refuses to start
unless `shared.Hero.infos.id` is set **and**
`a[rel='phoenix_member_login']` matches nothing.

**The game allows one session per account.** A headless run and your own browser
evict each other, and the cookies stay locally valid while the server serves the
intro page. Stay logged out everywhere else while this runs.

Two more that this script does not hit but the injection harness does: cooldown
timers from an earlier run silence modules (all of them live in
`HHAuto_Temp_Timers`, local *and* session storage — clear it before a measured
phase), and the script may navigate away mid-measurement, which reads as
"0 elements". This checker never runs HHauto and never writes storage, so
neither applies here.

## Adding a check

Entries live in `checks.json`. Every entry names the claim and the call site it
comes from, so a DRIFT can be traced back to the code that believes it.

**Follow the selector to a live call site before adding it.** A grep hit is not
a claim. The first run of this checker, 2026-08-17, produced exactly one DRIFT
— `.league_content .data-list .data-column[sorting]` matched nothing — and the
cause was this file, not the game: the selector sat inside a commented-out
`_refreshSorting` block with no callers. The check asserted something the
script had stopped believing. Concretely, for each new entry:

1. `grep` the selector to find the reading code.
2. Check it is not inside `/* … */` and that something calls it.
3. Follow it up to the guard that decides when it runs — usually
   `getPage() === ConfigHelper.getHHScriptVars("pagesIDxxx")`, a block
   precondition in `Service/Pipeline.config.ts`, or a handler in
   `Service/AutoLoopPageHandlers.ts` — and name that page in `page`.

| `kind` | what it does |
|---|---|
| `selector` | counts each selector in `assert[]`, DRIFT below `min` (default 1). No visibility filter: `shop.html` renders two equipment trees and the one with the data is the hidden one. |
| `global` | reads dotted paths off `window`, DRIFT when a path is `undefined` |
| `harvest` | collects an attribute across matches. `extract: "value"` compares against the `allow` regexes and reports unknown values; `extract: "keys"` parses each payload as JSON and reports missing `expectKeys`. |
| `manual` | prints `instructions` and counts as SKIP — needed for popups, a specific girl, or anything that writes |

Writes stay manual on purpose. A checker that buys, equips or saves to prove the
API still accepts its parameters is not a checker, it is a bot with a different
name.

## Where this list came from

The spec triage of 2026-08 removed 42 jsdom tests that asserted these claims
against markup the tests had built themselves — green by construction, and
therefore silent when the game changed. The claims moved here; the tests did not
get a replacement, because a second jsdom test would have been the same nothing.

The removed tests are named in the commit `test: move live-only claims out of
jsdom`, each with the check id that replaced it.
