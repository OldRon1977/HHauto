---
last-verified: 2026-09-11
verified-against-version: 8.13.1
status: current
---

# Runtime architecture

How HHAuto actually runs in the browser: frames, game state, ajax, page
detection, start. What is marked as measured was measured (test account on
www.hentaiheroes.com, 2026-09-11); the rest is read from the code.

---

## 1. Frames: the shell and the game page

**Measured 2026-09-11** (logged in, `www.hentaiheroes.com`):

```
https://www.hentaiheroes.com/            <- shell: <body id="hh_hentai">, NO page attribute,
  |                                          no window.shared.Hero
  +-- <iframe id="hh_game" src="/home.html">   <- the game page
  +-- about:blank
```

The game pages themselves (`/home.html`, `/leagues.html`, ...) are standalone
documents with `<body id="hh_hentai" page="...">` and the full game state. They
can also be opened directly as the top document -- that is how all measurements
of that day ran, and the game behaved the same. The identifier `hh_hentai` is
therefore the `id` of the `<body>`, not of an iframe; the shell's iframe is
called `hh_game`.

The `gameID` per game variant is in `getEnv()` of the files under
`src/config/game/`; HornyHeroes is entered directly in `HHEnvVariables.ts`.
Only `hh_hentai` on www.hentaiheroes.com is measured. How the Nutaku pages
embed cannot be checked with the test account.

### How HHAuto.user.js deals with it

The script has no `@noframes` and therefore runs in **every** frame whose URL
matches an `@match` (ten domains, see the header of `HHAuto.user.js`).
`unsafeWindow` is that frame's window in each case.

Measured 2026-09-11 with the bundle in all three frames of the shell:

| Frame | Output |
|---|---|
| Shell `/` | `Not a game page (/), skipping init in this frame.` -- `StartService.start()` aborts at `location.pathname === '/'`, before it waits for `shared.Hero` |
| Iframe `/home.html` | a normal start (`Hero object available (page=/home.html)`) |
| `about:blank` | `HHAUTO WARNING: No jQuery found.` -- `hardened_start` ends there |

Header state 8.13.1: `@grant GM_addStyle`, `GM_registerMenuCommand`,
`GM_unregisterMenuCommand`, `GM_xmlhttpRequest`, `GM_setClipboard`; no
`@grant unsafeWindow` -- Tampermonkey provides `unsafeWindow` without the grant
too. `npm run check:gm-grants` holds the grants against the usage.

### The debug inspector

`bonus-scripts/HHAuto_debug_inspector.user.js` (4.11.0) has `@noframes`, so it
runs only in the top document, and finds the game state itself -- through known
frame IDs or a scan for `shared`/`Hero`/`availableGirls` -- and then switches to
that frame's `contentWindow`.

---

## 2. unsafeWindow.shared -- the game state

What used to be `window.Hero` lives under `window.shared.Hero`. Measured:
`window.Hero` exists on none of the 39 visited pages.

`HHHelper.getHHVars()` makes that transparent: `prefixIfNeeded` prepends
`shared.` to every path starting with `Hero.` as soon as `unsafeWindow.shared`
exists. Always use `getHHVars()`.

### Under `shared` (measured on every game page)

| Path | Content |
|---|---|
| `shared.Hero` | the player's stats, energies and currencies |
| `shared.general.hh_ajax` | the game's ajax wrapper |
| `shared.general.is_cheat_click` | the game's click check |
| `shared.GirlSalaryManager.girlsMap` | all owned girls (measured 24 of 24) |
| `shared.GirlSalaryManager.girlsListSec` | a partial list (measured 4) |
| `shared.animations.loadingAnimation.{start,stop}` | the loading animation |

### Directly on `unsafeWindow`

Which variable exists where is measured per page and stands in
`data-sources-inventory.md`, section 10. The rules of thumb from it:

- The girl list belongs to the page, not to the game: `availableGirls` on
  edit-team, `girlsDataList` on home and characters, `girls_data_list` on
  waifu.
- `teams_data` only on `/teams.html`, `opponents_list` on the league and in the
  penta drill arena (different shapes), `hero_data`/`opponents` in the season
  arena.
- `pop_list` is a boolean and `pop_index` always 0 -- which PoP is shown is what
  the URL says (`pop_id`), see `page-mapping.md`.
- `id_girl` exists on the quest page, not on `/girl/<id>`.
- `has_contests_datas`, `seasonal_event_active` and `seasonal_time_remaining`
  existed on no page on 2026-09-11 (a mega event was running).

---

## 3. Ajax

`getHHAjax()` in `Utils/Utils.ts` returns
`unsafeWindow.shared?.general?.hh_ajax`. There is no `unsafeWindow.hh_ajax`.
Direct `fetch`/`XMLHttpRequest` bypasses the game's session handling.

The exception: `HaremGirl.equipItem()` (`girl_equipment_equip`) calls jQuery
`$.ajax` directly.

### The Nutaku session

On Nutaku pages (`unsafeWindow.hh_nutaku` set; measured `null` on
www.hentaiheroes.com) `addNutakuSession()` appends the `sess` parameter to calls
and navigations.

### The referer before an ajax call

Before some calls the code sets, through `window.history.replaceState`, the URL
of the page the game expects the call from, and restores it afterwards. The
places are found with `grep -rln history.replaceState src` -- today
`HeroHelper.ts` (boosters), `Market.ts` (purchases), `TeamModule.ts` (stuff
team), `Harem.ts` (skill reset) and `League.ts`.

Which actions actually travel in the game, with parameters and answer shapes,
is in `data-sources-inventory.md`, section 3.3 (two captures, 2026-08-17 and
2026-09-11).

---

## 4. Page detection

`getPage()` in `PageHelper.ts` reads the `page` attribute of the element with
the ID `gameID` -- measured, the `<body>` of the game page. On
`/activities.html` the URL parameter `tab` decides. Details, measured values
and the PoP pages are in `page-mapping.md`.

`getPage(true)` records unknown IDs in `Temp_unknownPagesList`
(sessionStorage); measured, that only affects the single PoP IDs
(`powerplaceN`).

---

## 5. Start

`StartService.start()` (read from the code):

1. top document on `/`: abort (see section 1)
2. `shared.Hero` missing: `setTimeout(hardened_start, 5000)`, up to
   `HERO_MAX_RETRIES` = 15 attempts; then the page reloads itself, limited by
   `HERO_GIVEUP_MAX_RELOADS` (#1788), and only then does the start give up
3. the login anchor `a[rel='phoenix_member_login']` present: not logged in,
   abort

The logged-out page carries a `shared.Hero` with placeholder values (600
kobans, full energies) -- whoever measures checks `shared.Hero.infos.id` **and**
the login anchor (`live-verification-lessons.md`).

---

## 6. localStorage

The shell and the game page are on the same origin and therefore share the
storage. HHauto's own keys carry the prefix `HHStoredVarPrefixKey` (`HHAuto_`,
defined in `config/StorageKeys.ts`). Where each key lives is in
`storage-keys.md`; measured, 240 of 245 lay where the registry says.

---

## 7. Cheat click

`shared.general.is_cheat_click` checks in the game whether a click is real.
`Utils.replaceCheatClick()` has an empty body and is called by `StartService` --
a prepared place with no effect today.

---

## 8. Checklist for new scripts and tools

- [ ] Run in the game page's frame (or address its `contentWindow`), not in the
      shell
- [ ] Read data through `getHHVars()`
- [ ] Ajax through `getHHAjax()`
- [ ] On Nutaku, `addNutakuSession()` before ajax and navigation
- [ ] Before reading: `shared.Hero.infos.id` set and no login anchor
- [ ] Change pages through `gotoPage()`
