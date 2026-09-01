# Live verification: how to test HHAuto against the running game

Status: 2026-08-15. Written after the v8.5.5 session, in which seven fixes were
verified against the live game and **three suspected defects turned out to be
measurement errors** -- one of them only after it had already been implemented
and had to be reverted.

This document exists so the same mistakes are not repeated. It is not about
jest; it is about the class of testing that jsdom cannot do: checking whether
the selectors and game globals the script depends on still hold.

## The one root cause behind every false finding

All three retracted findings had the same shape:

> The element/global was measured **where it was expected to exist**,
> not **where the code actually reads it**.

| Claimed defect | Measured on | Code actually runs on | Truth |
|---|---|---|---|
| `hh_prices` no longer exists | logged-out intro page | any page, logged in | exists; the game uses it identically |
| `.equipment_slot` is gone (`optimizeEquipmentSlots` a no-op) | `/girl/N` books tab | `/girl/N?resource=equipment` | 6 slots exist, `slot="1".."6"` |
| `id_girl` global removed | `/girl/N` | `/quest/<id>` (the upgrade quest page) | exists on the quest page |

The `id_girl` case is the expensive one: the wrong premise was handed to an
agent, which implemented it faithfully. The result replaced a working global
with `window.girl.id_girl`, which does **not** exist on the quest page -- so the
"fix" turned a working flow into an abort. It was caught only because the fix
was tested live before shipping, and reverted (`3db03f1`).

### The rule that prevents it

**Before measuring anything, find the call site and determine its page and
state.** Concretely:

1. `grep` for the selector/global to find the reading code.
2. Follow it up to the guard that decides when it runs -- usually
   `getPage() === ConfigHelper.getHHScriptVars("pagesIDxxx")`, a pipeline
   block precondition in `Service/Pipeline.config.ts`, or a page-specific
   handler in `Service/AutoLoopPageHandlers.ts`.
3. Reproduce **that** page and **that** sub-state (tab, popup open/closed).
4. Only then is a count of `0` evidence of anything.

A `0` without a stated context is not a finding. It is an unfinished
measurement.

## Harness pitfalls, each observed in this session

**The logged-out page serves a plausible-looking placeholder.**
`window.shared.Hero` exists on the intro page with 600 kobans and "full"
energies (fight 10/10, quest 50/50). The real account had 147,259 kobans and
741 fight energy. Measurements taken there look valid and are garbage.
*Guard:* require `shared.Hero.infos.id` **and**
`document.querySelectorAll("a[rel='phoenix_member_login']").length === 0`
before measuring anything. Abort loudly otherwise.

**Cooldown timers from an earlier run silence modules.**
All module timers live in one key, `HHAuto_Temp_Timers`. A previous run had set
`nextShopTime` over an hour ahead; the next run read "module does nothing" and
almost recorded it as a defect.
*Guard:* delete `HHAuto_Temp_Timers` (local **and** session storage) before
each measured phase.

**The script navigates away mid-measurement.**
Twice a measurement reported "0 elements" because the automation had already
left the page: the League check ran on `league-battle.html` after `autoLeagues`
started a fight, and a Sultry check ran after the loop moved to another event
tab.
*Guard:* capture console logs across navigations rather than reading the final
DOM, or disable the setting that triggers navigation. The League UI injection,
for instance, is gated on `showCalculatePower`, not on `autoLeagues` -- so the
UI can be verified without fighting.

**Suppressing a block is not the same as idling it.**
Setting `autoTrollThreshold` to a huge value to observe "idle ticks" made the
precondition fail, so the block was skipped entirely (1 start in 90s instead of
the ~15/min seen in a real log). Different phenomenon, useless number.

**A single session at a time.**
The game appears to allow one active session per account. A headless session
and the maintainer's browser evict each other; cookies stay locally valid while
the server serves the intro page. Log in and run in **one** browser session,
and stay logged out elsewhere for the duration.

## Where the ground truth actually lives

Two sources settled questions that DOM inspection could not:

- **The game's own bundles.** `build/build/shared.js` (~4.4 MB, minified) is
  fetchable without login. It proved `hh_prices` is alive by showing the game
  computing `hh_prices[type + "_cost_per_minute"] / 60` exactly the way HHAuto
  does. It also carries the action names sent to `/ajax.php` -- the single
  endpoint the game uses.
- **Game globals over DOM scraping.** `sm_event_data.seconds_until_event_end`
  is available on either tab of the Sultry page and made the tab-dependent DOM
  timer scrape unnecessary. Prefer a global that the game maintains over a
  selector that depends on which tab happens to be open.

Caveat that also applies here: the *runtime* AJAX capture is more reliable than
static extraction. Grepping `action:` out of `src/` missed `do_battles_trolls`
and `do_battles_seasons` because they are assembled at runtime; the live
network log had them.

**Measured since (2026-08-17).** Two recordings with
`scripts/catalogue/run.mjs observe`, 25 minutes of ordinary play, put a number
on that caveat: 24 distinct actions went over the wire and **20 of them appear
nowhere in the game's own bundle as literals** -- including all five
`do_battles_*` variants, not just the two named above. Static extraction is not
a weaker method here, it is the wrong one. Grep the bundle for names it spells
out; record traffic for the rest.

One more thing the recording settled about shape: not every call carries an
`action` at all. The team-battle submit identifies itself by `class:
"TeamBattle"` plus `battle_type`. Code that keys on `action` alone will not see
it.

## Delegating to agents

- **Agents inherit your errors.** Label every premise in the brief as either
  *measured* or *assumed*. In this session, briefs that said "I could not
  determine X -- find it yourself, do not trust my guess" produced the two best
  results: the agent located the real Bundles timer path and the real
  15-17 minute Season timer in `Pipeline.config.ts`, neither of which was where
  the brief guessed.
- **Give agents an explicit stop condition.** "If this turns out to be a
  behaviour change rather than a selector fix, stop and report instead of
  deciding" made one agent halt and disprove the premise instead of
  implementing a non-existent bug.
- **Do not take agent reports at face value.** Every claim in this session was
  re-measured independently. One agent correctly corrected a premise
  (`convertTimeToInt('')` returns a random 15-17 min via its failSafe branch,
  not `0`); another's proposed selector worked but was reported with a wrong
  explanation of *why* the first run had failed.

## What worked and should be kept

- **Verify both directions.** For the shop fix: with a booster filter set, the
  chain runs through to the parsed assortment; with the filter emptied, no
  navigation happens at all. One direction alone proves much less.
- **Independent second source for safety-critical state.** Mythic protection
  was confirmed by two agreeing sources (CSS class `.mythic` and the
  `"rarity":"mythic"` field in `data-d`): 203 items, 103 mythics by both counts,
  zero mythics in the set HHAuto sells from.
- **Hard runtime guards, not just intent.** A budget brake polling
  `shared.Hero` every 3s, and a mythic counter that aborts the whole run on any
  decrease. The brake fired correctly (kiss 20/20) and kobans came out net
  positive over the full-module sweep.
- **Refusing to fix what cannot be verified.** `.mega-tier.unclaimed` is the
  non-mega Seasonal selector and cannot be measured while a mega event runs;
  changing it "because it matches nothing today" would have repeated the
  `id_girl` mistake.

## Verification checklist

Before claiming a defect:

- [ ] Call site located; page and sub-state named.
- [ ] Session verified logged in (`infos.id` present, no login anchor).
- [ ] `HHAuto_Temp_Timers` cleared for the measured phase.
- [ ] Measured in the state the code runs in, not where the element is expected.
- [ ] A count of `0` has a stated explanation.
- [ ] Both directions checked where a toggle exists.

Before shipping a fix:

- [ ] Rebuilt (`npm run build`) -- the harness injects the built file.
- [ ] Observable difference named in advance, then observed.
- [ ] If the branch cannot be exercised live, say so explicitly rather than
      implying verification.

## Tooling

Two tools now live in the repo, and they cover most of what the outside harness
was used for:

- `scripts/live-check/` -- checks the selectors, globals and API parameters the
  code depends on against the running game, one line per claim as
  `OK / DRIFT / SKIP`. First run 2026-08-17: 11 of 12 held, and the one DRIFT
  was a dead claim in the checker rather than a change in the game.
- `scripts/catalogue/` -- `bundle` reads the game's own source without a login,
  `observe` records ajax traffic as shapes while you play, `snapshot` dumps the
  globals of the open page. `observe` and `snapshot` attach to a browser you
  are already using over CDP, which is how they reach battle pages and popups:
  those states exist only because you played them, and a second session would
  evict yours trying.

The older harness scripts live outside the repo (they carry a logged-in browser
profile): `~/.config/hhauto-claude/tools/`. They inject the built
`HHAuto.user.js` with Tampermonkey shims (`GM_addStyle`, `GM.info`,
`unsafeWindow`) via `addInitScript`, so the script survives navigations the way
it does under Tampermonkey.

`HHAuto_Setting_master = "false"` is **not** a complete dry-run switch, contrary
to what this document said until 2026-08-31. `handlePageSpecific` runs outside
the master gate in `AutoLoop.ts`, so the page handlers fire regardless:
`PathOfAttraction.run()` reaches `goAndCollect()` and clicks real rewards away
in the account you are testing with. The gate covers the action pipeline, not
the page-specific UI handlers.

To measure a collection routine without collecting, wrap `jQuery.fn.trigger`
**before** injecting the bundle and swallow `click` on elements below the
containers in question (`#events`, `#poa-content`), logging them instead. The
bundle carries no jQuery of its own and uses the page's, so patching the
prototype is reliable. You then see whether the script *wanted* to collect,
without it collecting. Used this way in the #1846 verification: the run logged
`Going to get {"tier":3,...}` and two intercepted clicks, and the reward stayed
where it was.

**Pin `Temp_scriptversion` to the bundle you inject.** Two builds in one run
means the version changes on every switch, and `StartService.checkVersion` then
calls `debugDeleteTempVars()` -- which wipes exactly the Temp vars a case just
wrote, `Temp_lseManualCollectAll` and `Temp_eventsList` among them. Write the
injected bundle's `@version` into `HHAuto_Temp_scriptversion` with the rest of
the case setup and the wipe never fires.

**A gate in shared code can be measured on another page.** The `plusEvent`
switch in front of `parseEventPage` sits in `AutoLoopPageHandlers`, not in an
event module, so it was measurable on a running Star Orgies event while no
Lively Scene event existed (#1857): setting off, no `parsed` attribute on
`#contains_all #events`; setting on, `parsed=true`, on both builds. What does
*not* transfer that way is anything the event module itself reads -- its
selectors, its collect path. Name which of the two a measurement covered.

`~/.config/hhauto-claude/tools/live-collect-verify.js` does this out of the
box: it opens a visible window, waits for the login, then runs a list of cases
against two builds on the same live page with the click interception in place,
and reports per case whether the collection gate was entered and whether a
reward was touched. `lse-collect-verify.js` beside it is the same idea for the
Lively Scene page: it looks the event tab up itself and falls back to the
shared-code measurement above (`FALLBACK_TAB`) when no such event runs.
Both verdicts are derived from the console output rather
than from page variables, so a navigation mid-run does not silently produce an
empty result -- it is reported instead. Bundles, page URL and the containers to
block are environment variables; build the comparison bundle with
`git show <ref>:HHAuto.user.js > /tmp/HHAuto.baseline.user.js`.
