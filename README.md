# HHauto

[English](https://github.com/OldRon1977/HHauto/wiki/English)

[Español](https://github.com/OldRon1977/HHauto/wiki/Espa%C3%B1ol)

[Français](https://github.com/OldRon1977/HHauto/wiki/Fran%C3%A7ais)

---

## 🎉 v8.0.0 is here

The first public release since **v7.29.19**. It bundles a large internal
refactoring with a long run of feature work:

- **Complete internal refactoring of the script** — large parts of the
  codebase rebuilt for stability:
  - Strict **TypeScript** type-checking (compiles with zero type errors)
  - **ESLint** integrated into the dev workflow and CI — the full lint run
    blocks the build; the warning ratchet (`lint:ci` in package.json) may
    only ever be lowered
  - Automated **test suite** expanded to 1000+ tests, run on every build
  - Old **dependency cycles** broken up
  - **Centralized navigation** and an **AJAX-mutex** against race conditions
  - New **block-based run pipeline**
- **Much more stable** — fewer navigation loops, "Forbidden" errors and
  stuck-script situations.
- **Smarter team building** — blessing- and synergy-aware League / Edit Team
  selection.
- **Better equipment** — optimized "Stuff Team", auto-equip boosters and
  smarter Sandalwood handling.
- **Gear for your hero** — three buttons on the market page pick the best
  armor for your six slots, put on the items worth developing, and level them
  with legendary and epic material.
- **More fight control** — independent Troll / Event / Raid clusters and a
  "+Raid Stars" grade filter.
- **Quality of life** — reorderable function blocks, Season Max Tier, a snappier
  menu.

Nothing you rely on was removed and **no settings are reset**. Full details in
[`CHANGELOG.md`](CHANGELOG.md).

## Installation instructions

a) Install browser addon TamperMonkey, Greasemonkey or Violentmonkey
b) Click the script URL: https://github.com/OldRon1977/HHauto/raw/main/HHAuto.user.js
c) TamperMonkey should automatically prompt you to install/update the script. If it doesn't, open up the TM Dashboard, go to the Utilities tab, scroll down to "Install from URL" and paste the above URL in there.

---

## Disclaimer

⚠ **Use at your own risk.** As with all automation features, there is always a risk of being banned by Kinkoid. The script uses randomized timing to reduce the risk of detection, but no automation can guarantee safety. By installing and using this script you accept that responsibility.

## Optional helper: automatic login

A small companion userscript at `bonus-scripts/HHAuto-Login.user.js` fills in
the ChibiPass login form for you and clicks through to the game. It is a pure
convenience helper and completely optional — HHAuto works fine without it.

**Read this before you install it.** The script asks you to write your e-mail
and password into two constants at the top of its source. That is plain-text
storage of your password inside your userscript manager, and it is the whole
security consideration around this script.

What it does *not* do: it sends nothing anywhere. Your credentials go into the
input fields of the official ChibiPass login page and nowhere else — exactly
where you would type them yourself. The script has no `fetch`, no
`XMLHttpRequest`, no `sendBeacon`, no WebSocket, declares `@grant none`, and
never touches cookies or storage. It is about 100 lines and you can read all of
it in a minute.

The risk is the file itself, not the traffic. Anything that can read your
userscript storage can read your password: another person on the same machine,
Tampermonkey or browser sync, a cloud backup, or a copy of the file you sent
somewhere. **Keep the filled-in file local and you are fine.**

1. Install the login userscript:
   <https://github.com/OldRon1977/HHauto/raw/main/bonus-scripts/HHAuto-Login.user.js>
2. Open it in the Tampermonkey editor and replace `YOUR_EMAIL` and
   `YOUR_PASSWORD` with your ChibiPass credentials.
3. Delete the `@match` lines for the games you do not play.
4. Turn **off** userscript and browser sync for this script, so the filled-in
   copy stays on this machine.
5. Use a password unique to the game, so even a leak cannot spread further.

Before you ever hand this file to anyone — including when attaching it to a bug
report — reset the two constants back to `YOUR_EMAIL` and `YOUR_PASSWORD`.

If that trade-off does not sit right with you, simply do not install it and log
in by hand.

## Capturing a useful log with Pipeline Diagnostics

If the script gets stuck, loops, or skips a feature, a plain debug log often
does not show *where* in a run things went wrong. HHAuto runs every feature
through an internal block-based pipeline, and the **Pipeline Diagnostics**
toggle makes that pipeline log its work in detail.

**Where to find it:** open the HHAuto menu and look in the **Global options**
section for the **Pipeline Diagnostics** switch. It is **off by default**.

**What it does:** the script always logs a lean `[PIPE]` trace (which block
ran, which was skipped and why, and when a run starts and completes). With
Pipeline Diagnostics **on**, it additionally records per-step detail for every
block — each individual step, the page it was on, and the decision it made. A
context header (script version, platform, the effective block order, and any
disabled blocks) is also attached to the log export.

**Why turn it on before reporting a bug:** loops, navigation problems and
"script got stuck" situations are exactly the cases where the lean trace is not
enough. The per-step detail shows the precise block and step the script was on
and why it chose to wait, skip, or move on — which usually turns a
hard-to-reproduce report into a quick diagnosis. So if your issue is about the
script looping, freezing, or not doing something it should: **enable Pipeline
Diagnostics, reproduce the problem, then save and attach the debug log.**

## How to file a bug with a dump

Bug reports are easier to investigate with a dump of the actual game state.
The repository ships an inspector userscript at
`bonus-scripts/HHAuto_debug_inspector.user.js` that produces such dumps,
including an opt-in **share mode** that anonymises the dump for public use.

1. Install the inspector userscript:
   <https://github.com/OldRon1977/HHauto/raw/main/bonus-scripts/HHAuto_debug_inspector.user.js>
2. Open the page where the bug occurs. Wait for it to load fully.
3. Click the orange **DUMP FOR SHARING** button in the inspector overlay
   (next to `DUMP THIS PAGE` and `AUTO TOUR`). The dump downloads as a
   single JSON file.
4. Attach the JSON file to your GitHub issue.

The share-mode pipeline removes hero nickname, chat_token, club details,
exact XP, browser fingerprint blocks, and most HHAuto settings. Harem
girls, event girls, opponents, and ids are pseudonymised with a fresh
salt per dump, so two dumps from the same player cannot be correlated.

To verify a dump went through the pipeline, look for `meta.pii.mode`
equal to `"share"` and an `audit` block at `meta.pii.layer_counts`.

Full reference: see `docs-internal/inspector-pii-share-mode.md` for the
list of fields kept, dropped, and pseudonymised.

### Network sniffer for "Access forbidden" reports

For network-level diagnostics ("Access forbidden" pages, suspected
race conditions, or any case where the regular HHAuto AjaxTracker is
not enough), a dedicated network-capture userscript is shipped at
`bonus-scripts/HHAuto_network_sniffer.user.js`. It hooks
every request channel a userscript can reach (XHR, fetch, sendBeacon,
WebSocket, EventSource, plus PerformanceObserver as a catch-all) and
shows a small live counter overlay in the top-right corner.

1. Install the sniffer userscript:
   <https://github.com/OldRon1977/HHauto/raw/main/bonus-scripts/HHAuto_network_sniffer.user.js>
2. Disable the main HHAuto userscript so it does not interfere with the
   capture (Tampermonkey dashboard or master switch off).
3. Reload the page where the Forbidden happens. Reproduce the click
   sequence that triggers it.
4. Open DevTools console and run `__x1598.stats()` for a summary,
   `__x1598.dumpAll()` for the full event table, or click the **CSV** /
   **JSON** buttons in the overlay to copy a dump to the clipboard.
5. Attach the dump to your GitHub issue. Strip session tokens
   (`sess=...`) before sharing.

---

## Release notes

See [`CHANGELOG.md`](CHANGELOG.md) for the full release history.
