# Live verification: how to test HHAuto against the running game

Status: 2026-09-10. Written after the v8.5.5 session, in which seven fixes were
verified against the live game and **three suspected defects turned out to be
measurement errors** -- one of them only after it had already been implemented
and had to be reverted. Extended after the 8.13.x session, which produced the
same outcome by a different route: three commits withdrawn because the
mechanism they changed was read at the wrong step, not on the wrong page. And
again at the end of that session, which added the quieter failure: a fix that
is right, ships, and does not move the symptom it was written for.

This document exists so the same mistakes are not repeated. It is not about
jest; it is about the class of testing that jsdom cannot do: checking whether
the selectors and game globals the script depends on still hold.

## The first root cause: measuring where the element is expected

All three retracted findings of the 8.5.5 session had the same shape:

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

## The second root cause: measuring the middle of a chain

Added 2026-09-10, after a fix was shipped, run live, and withdrawn again.

The 2026-08 lesson above is about measuring on the wrong **page**. This one is
about measuring at the wrong **step**, and it survives every check in the list
above: the call site was right, the page was right, the reading was correct.

`ParanoiaService` plans a spend-down before each rest period. A module that
cannot act -- league blocked by a rank threshold, quest out of energy -- sets a
`paranoia<X>Blocked` marker. It was measured that a marked category still ended
up in the plan, and concluded from that single true observation that the markers
had no effect. Three commits followed.

(Corrected 2026-09-10, by reading the code in `main`: `setParanoiaSpendings`
**does** check the marker -- `if (getStoredValue(...paranoiaLeagueBlocked) ===
undefined)`, and the same for quest. What was actually seen is the other
ordering: the category is planned while no marker is set yet, and the module
sets it afterwards. Two guards for two orderings, not a missing one. The
original note said the planning step ignores the marker, which is not true --
and getting that detail wrong is itself an instance of the rule below.)

The compensation sits one step further along. `checkParanoiaSpendings` removes
the marked category from the map, so the total drops, and `flipParanoia` reads
`ParanoiaService.checkParanoiaSpendings() === 0` as "the spend-down is done"
and goes into hiding. Measured against main 8.12.4 on the test account: League
set the marker at 08:39:43 with a plan of `[["challenge",2]]`, and the flip to
rest followed at 08:39:46. The mechanism works; the description of it in the
comments is what is imprecise.

The third of the three commits moved the per-tick reset off the full clear, and
that reset is what the working path depends on -- so the "fix" would have
broken the behaviour it was written to protect, in a way no unit test would
have caught, because the tests were written from the same wrong model.

**The rule:** a claim about a mechanism has to name the step that *consumes*
the value, not only the step that produces it. Follow the value to its last
reader before deciding it has no effect.

## Compare against `main`, not against your own last build

Corollary, from the same session. Whether a defect is real is decided against
the state before *all* of your own changes, not against your previous build --
otherwise a defect you introduced and then removed reads as a defect you fixed.

```
git show main:HHAuto.user.js > /tmp/main-bundle.user.js
$HHAUTO_HOME/tools/play-session.js --minutes 25 --bundle /tmp/main-bundle.user.js
```

Two things this produced that no static reading would have:

- the paranoia flip sequence above, which refuted the premise of three commits;
- four page exceptions (`t.forEach is not a function`, `reading 'daily'`) that
  had been attributed to a change of mine and turned out to predate it.

The static half is cheaper and comes first: for each claimed defect, show the
same code in `main` (`git show main:<file>`), and check with
`git diff main...<branch-start> -- <file>` that the file was not already
touched by your own earlier work. A defect that only exists after your
branch-start commit is a regression you caused, not a finding.

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

**A negative reading is not an outcome either.**
The companion to "a successful click is not an effected outcome". A club join
was clicked, confirmed, and `shared.Hero.infos.club` still read `false`
afterwards -- while `/clubs.html?tab=members` said "My club, 45/50 members".
The join had worked; the field was simply not the one that carries the answer.
The dangerous part is that the run *before* it, which had navigated away
without confirming the dialog and therefore changed nothing, produced the
identical reading. *Guard:* before using a field as proof, show that it moves
in the case where the action definitely succeeded. Where no such field is
known, the page is the source.

**A list that reorders between loads has no positional index.**
The club list (`#clubs_list .data-row.body-row`) came back in a different order
on two consecutive loads, and an index that hit a row on the first load was
missing entirely on the second. Anything addressed by position there is a
different row each time. *Guard:* address by content -- the page's own search
field, or a match on the row text -- and treat a positional index as a
debugging convenience, never as an access path.

**A raw dump of a game object carries identifiers.**
`player_inventory.booster` entries carry `id_member` beside the item data, so a
probe that prints the object prints the account id -- into the terminal, the
task log and any transcript of either. *Guard:* redact in the probe, before the
value is printed, not in the report afterwards. `check:player-data` can also be
given the identifiers to match on; see the repository guide.

**A single session at a time.**
The game appears to allow one active session per account. A headless session
and the maintainer's browser evict each other; cookies stay locally valid while
the server serves the intro page. Log in and run in **one** browser session,
and stay logged out elsewhere for the duration.

**Clearing the timers on every navigation manufactures the churn you want to measure.**
The guard above says to delete `HHAuto_Temp_Timers` before a measured phase.
Done inside an `addInitScript`, it runs on every page load: the script then
starts each page without cooldowns and bounces between modules. A performance
run measured 24 navigations a minute and a shop <-> contests ping-pong that way;
with the timers cleared once, the same run measured 5.3 a minute.
*Guard:* clear once per phase -- set a marker in sessionStorage and clear only
while it is missing.

**A fresh browser session runs every module before the one you want.**
Even without clearing anything, a new headless session started with a full
pass through contests, shop, season, penta drill, the paths, events, missions,
pachinko and daily goals; the quest block got its first tick after about four
minutes. A fixed 70-second window saw none of it.
*Guard:* poll for the state you are waiting for (a stored marker, a log line)
with a generous upper bound, instead of waiting a fixed time.

**The profile's HTTP cache hides a dead external host.**
The persistent profile showed images from a third-party host with status 200
while that host's TLS certificate had expired; a fresh context without a profile
got `net::ERR_CERT_DATE_INVALID` for every one of them, which is what users saw.
*Guard:* check the reachability of anything external in a fresh
`browser.newContext()`. Node's TLS (`ctx.request`, `curl`) reports an expired
certificate directly.

**Headless rendering makes animated pages look expensive.**
Headless Chromium draws canvas on the CPU (SwiftShader). Without any script,
`/home.html` measured 67 % main-thread load, `/season.html` 99 % and event pages
100 %, against 0.1-0.4 % for list pages such as the shop or the league.
In a visible window on the same machine -- `headless: false`, Playwright's
`--enable-unsafe-swiftshader` dropped via `ignoreDefaultArgs`, WebGL renderer
ANGLE on an NVIDIA GPU -- the same pages measured 1.1 % (home), 2.0 % (league)
and 5.7 % (season).
*Guard:* compare with and without the script on the same page, or measure in a
visible window; read the WebGL renderer first -- "SwiftShader" means the CPU is
still drawing.

**The script's own popup overlay swallows coordinate clicks.**
`#HHAutoPopupGlobal` covers the viewport, so a Playwright click on a button
underneath times out with "element intercepts pointer events".
*Guard:* the script's buttons hang on jQuery click handlers; trigger them on the
element (`$$eval(sel, n => n[0].click())`).

**Visibility checks have two blind spots.**
`offsetParent` is always `null` for a `position: fixed` element, so a fixed popup
that is on screen reads as hidden; check its bounding rectangle and computed
style instead. And an `<img>` without a `src` reports `complete` with
`naturalWidth` 0 -- Season uses one as an invisible spacer, 0 px high -- which a
broken-image count reads as a failure.

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

  **But measure before swapping — the advantage is tab-dependence, not
  earliness.** Path of Attraction has the same pair: the DOM timer
  (`#events .nc-panel-header .event-timer span[rel=expires]`) and the global
  `event_ends_in`. Measured 2026-09-10 over eight direct loads of the event
  page, sampling every 100 ms: both first appeared in the **same** 100 ms
  window every time (median 808 ms), and there was no load on which one was
  present and the other was not. The global agreed with the screen
  (`'183299'` against "Ends in 2d 2h"). Swapping the source there would have
  bought nothing — the PoA timer read fails intermittently *inside a script
  run*, and never on a direct load, so neither source explains it. Where a
  reading can fail, the fix is to make the unknown safe (a bounded fallback
  instead of a value the consumer reads as "expired"), not to pick a different
  place to read it from.

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
- **Saying when a fix did not move the outcome.** The club-champions tab was
  read 12 ms after the click that loads it, which is wrong on its own terms
  and was fixed. Re-run: the gap became 264 ms and the wait reported the tab
  settled -- and the reading did not change, because the walk on to the
  champion page is decided one condition further along. The changelog entry
  had been written as though the wait were what stood in the way; it was
  corrected to say what was measured. A fix that closes a real defect without
  moving the symptom is still worth having, and saying so is what keeps the
  next reader from trusting the wrong cause.
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
- [ ] The value followed to its **last** reader, not only to the step that
      produces it.
- [ ] The same code shown to exist in `main`, and the file shown to be
      untouched by your own branch before that point.
- [ ] The field used as proof shown to move when the action succeeds.

Before shipping a fix:

- [ ] Rebuilt (`npm run build`) -- the harness injects the built file.
- [ ] Observable difference named in advance, then observed.
- [ ] If the branch cannot be exercised live, say so explicitly rather than
      implying verification.
- [ ] If the fix was exercised and the symptom did not move, say that too.

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
profile): `$HHAUTO_HOME/tools/`, where `HHAUTO_HOME` is the local harness
directory outside the repository. `play-session.js` takes
`--bundle <path>`, which injects an arbitrary build instead of the working
tree's -- that is how a branch is compared against `main` under the same
account and the same settings. They inject the built
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

`$HHAUTO_HOME/tools/live-collect-verify.js` does this out of the
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
