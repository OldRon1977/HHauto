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
  - **ESLint** integrated into the dev workflow
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
