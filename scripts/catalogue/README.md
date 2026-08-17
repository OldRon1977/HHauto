# Game catalogue

What the game calls things, and what it sends. This exists to answer one
question: *what is this variable / response / stat actually named, so I can
address it correctly in the script.*

Three ways to ask, because no single one is complete.

```
node scripts/catalogue/run.mjs bundle                    # the game's own source
node scripts/catalogue/run.mjs browser                   # a browser to attach to
node scripts/catalogue/run.mjs observe --seconds=300     # what it sends while you play
node scripts/catalogue/run.mjs snapshot                  # what is on the page right now
```

Output lands in `scripts/catalogue/out/` (gitignored — it goes stale fast) as
JSON to diff and Markdown to read, plus a summary on stdout.

## `bundle` — what the source declares

Fetches `https://www.hentaiheroes.com/build/build/shared.js` (~4.2 MB) and
reads it. **No login, no session, nothing touched.** Run it any time.

It yields the AJAX action names, the `class` values that ride along, and — the
part that makes it worth reading — the `shared.*` API surface, which survives
minification. `shared.general.hh_ajax`, `shared.Hero.energies`,
`shared.PopupQueueManager.add`, `shared.general.waitForElement`: these are the
game's real names for its own machinery, not guesses.

Its limit is stated in every report it writes, because it is severe: **of the
25 action names HHauto sends, 2 appear here as literals.** The rest the game
assembles at runtime. Static reading finds what the source spells out and
nothing else, which is exactly why `observe` exists.

## `observe` — what actually goes over the wire

Attaches to a browser **you are already using** and records every `ajax.php`
call while you play. Requests and responses are reduced to shapes — keys and
types, never values — so one file describes a hundred calls, and nothing in it
carries account data.

This is the mode that sees what nothing else can: battle pages, pre-battle
screens, popups mid-flow. A separate headless session would have to fight an
actual battle to reach them, and would evict your own session doing it — the
game allows one per account. Attaching sidesteps that entirely: it is your
session, you are simply playing.

## `snapshot` — what is on this page

Attaches the same way and dumps the globals of the open page, with the
`shared` tree resolved three levels deep and function signatures intact.

The browser's own globals are subtracted using a same-origin blank iframe
created inside the page. That detail matters: `about:blank` in its own tab is
an opaque origin with a smaller API surface, and subtracting *that* leaves two
hundred entries of browser inventory behind. Against the iframe the
subtraction is exact — on a stand-in page defining four globals, the snapshot
contains four globals.

## Attaching

`observe` and `snapshot` need a browser with the DevTools port open. An
already-running browser will not pick the flag up — it has to be *started*
with it, which is what `browser` does:

```
node scripts/catalogue/run.mjs browser
```

It uses its own profile (`~/.config/hhauto-catalogue`), so nothing you have
open is disturbed, and it waits until the port actually answers rather than
reporting success on a spawn. Log into the game in that window, then run
`observe` or `snapshot` from another terminal. Neither clicks, submits or
navigates — they read.

Finding the binary, in order: `HHAUTO_CHROMIUM` if set, then the browser
Playwright ships, then `/usr/bin/chromium` and its usual siblings.

It has to be Chromium-based. **Firefox cannot do this** — Playwright's CDP
connection is Chromium-only — so on a machine carrying only Firefox the
Playwright browser is the answer, and it is an ordinary Chromium that takes
the same flags. One wrinkle worth knowing: `chromium.executablePath()` names
the revision *this* Playwright version wants, which is not always the one
installed. The finder falls back to whatever is really in the Playwright
cache, because any of them speaks CDP.

`--port=N` if 9222 is taken. `--headless` on `browser` if you only want to
prove the plumbing works.

## Why this and not the inspector

`bonus-scripts/HHAuto_debug_inspector.user.js` does an overlapping job from
inside the page, and it is frozen as of 2026-08-17 — kept, not developed. Most
of its 2000 lines exist because a userscript cannot do what a driver does for
free: tour state survives page reloads through `localStorage`, results are
chunked into IndexedDB, and XHR plus `fetch` are monkey-patched to see traffic.
That last one took three versions to get right, and here it is a native event
that also catches the requests fired before any script could install a hook.

What the inspector still has and this does not: a PII share-mode pipeline, so a
*player* can attach an anonymised dump to a public bug report. That path has
never produced an attachment in the issue tracker — reporters send
`HH_DebugLog_*.log` instead — but it is real, and it is the reason the
inspector was kept rather than deleted.

## Reading the output honestly

The same rule as `scripts/live-check`: a name in here is a name the game
*mentions*, which is not the same as a name it *uses*, which is not the same
as one it *accepts*. `bundle` lists 63 live actions; several are dead branches
in the game's own code. Before addressing one from HHauto, confirm it with
`observe` — that it goes over the wire is the only evidence that counts.
