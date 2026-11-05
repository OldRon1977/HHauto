# HHauto

A Tampermonkey userscript that automates the repetitive parts of Hentai Heroes
and its sister games.

**[Install](https://github.com/OldRon1977/HHauto/raw/main/HHAuto.user.js)** ·
[Wiki](https://github.com/OldRon1977/HHauto/wiki) ·
[Installation](https://github.com/OldRon1977/HHauto/wiki/Installation) ·
[Debugging](https://github.com/OldRon1977/HHauto/wiki/Debugging) ·
[Reporting an issue](https://github.com/OldRon1977/HHauto/wiki/Reporting-an-issue)

The script menu speaks English, German, French and Spanish; the wiki is English only.

---

## What it does

- **Fights** — trolls, love raids, events, league, season, pantheon, champions,
  club champion, places of power, Penta Drill and the labyrinth, each with its
  own thresholds. A season target fights until a number of wins is reached.
- **Team building** — the Team optimization popup on the edit-team page scores
  teams by the game's own team formula: this week, against your league
  opponents, and for next week's blessings. Every girl is compared without the
  gear and skills she holds today, with the skills Stuff Team will give counted
  in -- nothing has to be reset for it. Level-up team, Stuff Team and the Team
  gear block finish the team.
- **Gear for your hero** — the HH Gear menu on the market page picks the best
  armor for your six slots, now or after levelling, levels the worn mythics
  and marks the mythics worth keeping.
- **Collecting** — salary, missions, daily goals, quests, pachinko, free
  bundles, and the rewards of every path and event, with a choice of what to
  collect and a collect-all window before an event ends.
- **Boosters and the market** — buys and equips boosters, mythic slots and
  Sandalwood included.
- **No interruptions while you work** — opening Team optimization or the HH
  Gear menu pauses the automation until you are done.
- **The menu** — in English, German, French and Spanish, one pane per game
  area, with reorderable function blocks. Every option has a tooltip.

## Installation

Install [Tampermonkey](https://www.tampermonkey.net/), then open
**[HHAuto.user.js](https://github.com/OldRon1977/HHauto/raw/main/HHAuto.user.js)**
and confirm. Tampermonkey offers new versions on its own. Details, updates and
the supported games: [wiki → Installation](https://github.com/OldRon1977/HHauto/wiki/Installation).

## Disclaimer

⚠ **Use at your own risk.** As with all automation, there is a risk of being
banned by Kinkoid. The script uses randomized timing to reduce the risk of
detection, but no automation can guarantee safety. By installing and using this
script you accept that responsibility.

## Helper scripts

Optional userscripts in [`bonus-scripts/`](bonus-scripts/). HHAuto does not need
any of them.

| Script | What it is for | How to use it |
|---|---|---|
| `HHAuto-Login.user.js` | fills in the ChibiPass login and enters the game; stores your password in plain text in the script | [wiki → Installation](https://github.com/OldRon1977/HHauto/wiki/Installation#optional-automatic-login) |
| `HHAuto_debug_inspector.user.js` | an anonymised dump of the game state for a bug report | [wiki → Debugging](https://github.com/OldRon1977/HHauto/wiki/Debugging#a-dump-of-the-game-state) |
| `HHAuto_network_sniffer.user.js` | a network capture for "Access forbidden" reports | [wiki → Debugging](https://github.com/OldRon1977/HHauto/wiki/Debugging#network-capture-for-access-forbidden) |

## Something does not work

[Debugging](https://github.com/OldRon1977/HHauto/wiki/Debugging) shows how to
save the debug log and when to switch on **Pipeline Diagnostics**.
[Reporting an issue](https://github.com/OldRon1977/HHauto/wiki/Reporting-an-issue)
says what a useful report contains.

---

## Contributing

Every commit passes the same gates CI runs:

```
npm run typecheck
npm run lint:ci
npm test
npm run deps:circular:check
npm run deps:toplevel-key
npm run check:gm-grants
npm run check:docs
npm run check:headers
npm run check:player-data
npm run build            # HHAuto.user.js belongs in the same commit
```

Test fixtures carry no real players: your own account is `1`, other players
start at `1000`, names are `Player_N`. `npm run hooks:install` sets up the
pre-commit hook that checks this.

---

## Release notes

See [`CHANGELOG.md`](CHANGELOG.md) for the full release history.
