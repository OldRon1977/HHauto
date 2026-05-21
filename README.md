# HHauto

[English](https://github.com/OldRon1977/HHauto/wiki/English)

[Español](https://github.com/OldRon1977/HHauto/wiki/Espa%C3%B1ol)

[Français](https://github.com/OldRon1977/HHauto/wiki/Fran%C3%A7ais)

## Installation instructions

a) Install browser addon TamperMonkey, Greasemonkey or Violentmonkey
b) Click the script URL: https://github.com/OldRon1977/HHauto/raw/main/HHAuto.user.js
c) TamperMonkey should automatically prompt you to install/update the script. If it doesn't, open up the TM Dashboard, go to the Utilities tab, scroll down to "Install from URL" and paste the above URL in there.

---

## Disclaimer

⚠ **Use at your own risk.** As with all automation features, there is always a risk of being banned by Kinkoid. The script uses randomized timing to reduce the risk of detection, but no automation can guarantee safety. By installing and using this script you accept that responsibility.

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
