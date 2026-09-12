---
last-verified: 2026-09-11
verified-against-version: 8.13.1
status: current
---

# Page mapping reference

This file describes how pages are recognised and what to watch out for. Which
pages exist is in the code -- see below.

Which of them ever appeared in a capture is a different question from which are
defined: no page tour reaches the battle and pre-battle pages, because you have
to play your way to them. `scripts/catalogue/run.mjs observe` attaches to a
running session and therefore sees them; a recording from 2026-08-17 caught the
complete labyrinth chain and all five `do_battles_*` variants.

---

## Architecture

### Files

- src/config/HHEnvVariables.ts -- page ID and URL definitions as properties on HHEnvVariables["global"]
- src/Helper/PageHelper.ts -- page detection (getPage())
- src/config/game/*.ts -- game variant configs (feature flags, not page IDs)

The page IDs are not export const values; they are written onto the singleton
HHEnvVariables["global"] at runtime:

```typescript
HHEnvVariables["global"].pagesIDHome = "home";
HHEnvVariables["global"].pagesURLHome = "/home.html";
HHEnvVariables["global"].pagesKnownList.push("Home");
```

Read through `ConfigHelper.getHHScriptVars("pagesIDHome")`. The list
`pagesKnownList` is used during page detection to recognise unknown pages.

### Detection

```typescript
getPage() = document.getElementById(gameID).getAttribute("page")
```

`gameID` is the ID of the root element of the game in question (`hh_hentai`,
for example). **Measured 2026-09-11 on www.hentaiheroes.com:** that element is
the page's own `<body>` (`<body id="hh_hentai" page="home">`), not an iframe.
On all 46 visited pages that carry it, `getPage()` returned the value of the
`page` attribute, and on `/activities.html` the tab (see below). What this
looks like in the Nutaku embedding cannot be checked with the test account.

Without that element -- `getPage()` then returns `""` -- are the battle pages
and the pre-battle pages when they are opened without parameters (say
`/troll-pre-battle.html` without `id_opponent`). With the parameters the parent
page links, they do carry it; measured for `troll-pre-battle`,
`leagues-pre-battle`, `pantheon-pre-battle`, `penta_drill_pre_battle`, `teams`
and `edit-team`. The battle pages themselves were not visited, because opening
them starts a fight.

The activities page multiplexes several sub-pages through a tab parameter and
the query string -- see activities sub-tabs below.

### Known peculiarities in the code

- **A double definition:** `pagesIDLabyrinthEntrance` and
  `pagesIDLabyrinthPoolSelect` are assigned twice in `HHEnvVariables.ts`, with
  the same values. No functional effect.
- **A typo in a URL name:** the URL constant for LeaguePreBattle is called
  `pagesURLLeaguPreBattle` (missing "e"). `League.ts` references exactly that
  typo. When refactoring: correct code and docs everywhere at once, or not at
  all.

---

## Page IDs

The list is in `src/config/HHEnvVariables.ts` -- three lines per page
(`pagesIDx`, `pagesURLx`, `pagesKnownList.push`). A copy here has proven to be
a source of drift: it stood two entries behind the code without anyone
noticing. To look it up:

```bash
grep -n "pagesID[A-Za-z]* = \|pagesURL[A-Za-z]* = " src/config/HHEnvVariables.ts
```

What the code does not say, and what therefore stands here: the sub-tabs, the
game variants, and the two peculiarities above.

## Activities sub-tabs

The activities page hosts several sub-pages as tabs. Sub-pages share the URL
and the `page` attribute (`activities`) and are told apart by the tab. Measured
2026-09-11:

| URL | `getPage()` |
|---|---|
| `/activities.html?tab=contests` | `contests` |
| `/activities.html?tab=missions` | `missions` |
| `/activities.html?tab=daily_goals` | `daily_goals` |
| `/activities.html` (no tab) | `daily_goals` -- the game redirects to `?tab=daily_goals` |
| `/activities.html?tab=pop` | `powerplacemain` |
| `/activities.html?tab=pop&pop_id=1` | `powerplace1` |

The decision runs through the URL parameter `tab` (`ACTIVITIES_SUB_TABS` in
`PageHelper.ts`). Only when it is missing does the code look for the active
tab:
`#activities-tabs > div.switch-tab.underline-tab.tab-switcher-fade-in[data-tab='…']`.
Measured: that selector hits exactly the active tab on every tab, while the
shorter `[data-tab="…"]` hits all four tabs on every tab -- it cannot tell them
apart.

PoP generates dynamic IDs: "powerplace" + pop_id. The constant
pagesIDPowerplacemain points only at the overarching main page.

The single PoP page: `/activities.html?tab=pop&pop_id=N` (previously `&index=N`,
issue #1782). The PoP ID is read from the URL parameter `pop_id`. Measured
2026-09-11: `window.pop_index` is `0` on both the list and the single page, and
`window.pop_list` is not an array but a boolean -- `true` on the list, `false`
on the single page. `resolvePopState()` checks `Array.isArray(pop_list)`, so the
boolean falls through, and the visible `div.pop_list` decides (list: 1, single
page: 0). If the list is visible despite a `pop_id` in the URL, the PoP counts
as locked (thrown back).

---

## Game variants

All supported games share the same page IDs. Variant-specific configs in
src/config/game/*.ts change only feature flags such as isEnabledSpreadsheets or
isEnabledSeason, not the page structure.

Which domains exist and which `gameID` each has is in `getEnv()` of the
respective file in `src/config/game/` (www, nutaku and further subdomains);
HornyHeroes (`hh_sexy`) is entered directly in `HHEnvVariables.ts`. Only
`www.hentaiheroes.com` (`hh_hentai`) has been checked live.

---

## Unknown pages

`getPage(true)` records page IDs that appear in no `pagesID<Name>` of
`pagesKnownList` in `TK.unknownPagesList` (sessionStorage, once per ID) and
writes `Page unknown for script : <id> / <path>` to the log -- to notice game
updates.

Measured 2026-09-11 across 38 different `getPage()` values: the only unknown
one was `powerplace1`. The single PoP IDs are built at runtime (`"powerplace" +
id`) and therefore appear in no list. `getPage(true)` has excluded
`powerplace<N>` since 8.13.1; before that, every visited single PoP landed in
`unknownPagesList` once, without anything having changed in the game.
