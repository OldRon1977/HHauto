---
last-verified: 2026-09-11
verified-against-version: 8.13.1
status: current
---

# Runtime Architecture

Wie HHAuto im Browser tatsaechlich laeuft: Frames, Spielzustand, Ajax,
Seitenerkennung, Start. Gemessen ist, was als gemessen markiert ist (Pruefkonto
auf www.hentaiheroes.com, 2026-09-11); der Rest ist aus dem Code gelesen.

---

## 1. Frames: Huelle und Spielseite

**Gemessen 2026-09-11** (angemeldet, `www.hentaiheroes.com`):

```
https://www.hentaiheroes.com/            <- Huelle: <body id="hh_hentai">, KEIN page-Attribut,
  |                                          kein window.shared.Hero
  +-- <iframe id="hh_game" src="/home.html">   <- die Spielseite
  +-- about:blank
```

Die Spielseiten selbst (`/home.html`, `/leagues.html`, ...) sind eigenstaendige
Dokumente mit `<body id="hh_hentai" page="...">` und dem vollen Spielzustand.
Sie lassen sich auch direkt als oberstes Dokument oeffnen -- so liefen alle
Messungen dieses Tages, und das Spiel verhielt sich dabei gleich. Die Kennung
`hh_hentai` ist also die `id` des `<body>`, nicht die eines Iframes; das Iframe
der Huelle heisst `hh_game`.

Die `gameID` je Spielvariante steht in `getEnv()` der Dateien unter
`src/config/game/`; HornyHeroes ist direkt in `HHEnvVariables.ts` eingetragen.
Gemessen ist nur `hh_hentai` auf www.hentaiheroes.com. Wie die Nutaku-Seiten
einbetten, ist mit dem Pruefkonto nicht pruefbar.

### Wie HHAuto.user.js damit umgeht

Das Skript hat kein `@noframes` und laeuft deshalb in **jedem** Frame, dessen
URL auf ein `@match` passt (zehn Domains, siehe Kopf von `HHAuto.user.js`).
`unsafeWindow` ist dort jeweils das Fenster dieses Frames.

Gemessen 2026-09-11 mit dem Bundle in allen drei Frames der Huelle:

| Frame | Ausgabe |
|---|---|
| Huelle `/` | `Not a game page (/), skipping init in this frame.` -- `StartService.start()` bricht bei `location.pathname === '/'` ab, bevor es auf `shared.Hero` wartet |
| Iframe `/home.html` | normaler Start (`Hero object available (page=/home.html)`) |
| `about:blank` | `HHAUTO WARNING: No jQuery found.` -- `hardened_start` endet dort |

Kopf-Stand 8.13.1: `@grant GM_addStyle`, `GM_registerMenuCommand`,
`GM_unregisterMenuCommand`, `GM_xmlhttpRequest`, `GM_setClipboard`; kein
`@grant unsafeWindow` -- Tampermonkey stellt `unsafeWindow` auch ohne Grant
bereit. `npm run check:gm-grants` haelt die Grants gegen die Nutzung.

### Der Debug-Inspector

`bonus-scripts/HHAuto_debug_inspector.user.js` (4.11.0) hat `@noframes`,
laeuft also nur im obersten Dokument, und sucht den Spielzustand selbst -- ueber
bekannte Frame-IDs oder einen Scan nach `shared`/`Hero`/`availableGirls` -- und
schaltet dann auf dessen `contentWindow` um.

---

## 2. unsafeWindow.shared -- der Spielzustand

Was frueher `window.Hero` hiess, liegt unter `window.shared.Hero`. Gemessen:
`window.Hero` gibt es auf keiner der 39 besuchten Seiten.

`HHHelper.getHHVars()` macht das transparent: `prefixIfNeeded` haengt vor jeden
Pfad, der mit `Hero.` beginnt, `shared.` an, sobald `unsafeWindow.shared`
existiert. Immer `getHHVars()` benutzen.

### Unter `shared` (gemessen auf jeder Spielseite)

| Pfad | Inhalt |
|---|---|
| `shared.Hero` | Stats, Energien, Waehrungen des Spielers |
| `shared.general.hh_ajax` | der Ajax-Wrapper des Spiels |
| `shared.general.is_cheat_click` | Klick-Pruefung des Spiels |
| `shared.GirlSalaryManager.girlsMap` | alle besessenen Maedchen (gemessen 24 von 24) |
| `shared.GirlSalaryManager.girlsListSec` | Teilliste (gemessen 4) |
| `shared.animations.loadingAnimation.{start,stop}` | Lade-Animation |

### Direkt auf `unsafeWindow`

Wo welche Variable existiert, ist je Seite gemessen und steht in
`data-sources-inventory.md`, Abschnitt 10. Die Faustregeln daraus:

- Die Maedchenliste haengt an der Seite, nicht am Spiel: `availableGirls` auf
  edit-team, `girlsDataList` auf home und characters, `girls_data_list` auf
  waifu.
- `teams_data` nur auf `/teams.html`, `opponents_list` auf der Liga und in der
  Penta-Drill-Arena (verschiedene Formen), `hero_data`/`opponents` in der
  Season-Arena.
- `pop_list` ist ein Boolean und `pop_index` immer 0 -- welche PoP gezeigt wird,
  sagt die URL (`pop_id`), siehe `page-mapping.md`.
- `id_girl` gibt es auf der Questseite, nicht auf `/girl/<id>`.
- `has_contests_datas`, `seasonal_event_active` und `seasonal_time_remaining`
  gab es am 2026-09-11 auf keiner Seite (ein Mega-Event lief).

---

## 3. Ajax

`getHHAjax()` in `Utils/Utils.ts` liefert `unsafeWindow.shared?.general?.hh_ajax`.
Ein `unsafeWindow.hh_ajax` gibt es nicht. Direkte `fetch`/`XMLHttpRequest`
umgehen das Session-Handling des Spiels.

Ausnahme: `HaremGirl.equipItem()` (`girl_equipment_equip`) ruft jQuery `$.ajax`
direkt.

### Nutaku-Session

Auf Nutaku-Seiten (`unsafeWindow.hh_nutaku` gesetzt; auf www.hentaiheroes.com
gemessen `null`) haengt `addNutakuSession()` den `sess`-Parameter an Aufrufe
und Navigationen an.

### Referer vor Ajax

Vor einigen Aufrufen setzt der Code per `window.history.replaceState` die URL
der Seite, von der das Spiel den Aufruf erwartet, und stellt sie danach zurueck.
Die Stellen findet `grep -rln history.replaceState src` -- heute
`HeroHelper.ts` (Booster), `Market.ts` (Kaeufe), `TeamModule.ts` (Stuff Team),
`Harem.ts` (Skill-Reset) und `League.ts`.

Welche Aktionen im Spiel tatsaechlich unterwegs sind, mit Parametern und
Antwortform, steht in `data-sources-inventory.md`, Abschnitt 3.3 (zwei
Aufnahmen, 2026-08-17 und 2026-09-11).

---

## 4. Seitenerkennung

`getPage()` in `PageHelper.ts` liest das Attribut `page` des Elements mit der
ID `gameID` -- gemessen das `<body>` der Spielseite. Auf `/activities.html`
entscheidet der URL-Parameter `tab`. Einzelheiten, gemessene Werte und die
PoP-Seiten stehen in `page-mapping.md`.

`getPage(true)` traegt unbekannte IDs in `Temp_unknownPagesList`
(sessionStorage) ein; gemessen trifft das nur die Einzel-PoP-IDs
(`powerplaceN`).

---

## 5. Start

`StartService.start()` (gelesen):

1. oberstes Dokument auf `/`: abbrechen (siehe Abschnitt 1)
2. `shared.Hero` fehlt: `setTimeout(hardened_start, 5000)`, bis zu
   `HERO_MAX_RETRIES` = 15 Versuche; danach laedt die Seite sich selbst neu,
   begrenzt durch `HERO_GIVEUP_MAX_RELOADS` (#1788), und erst dann gibt der
   Start auf
3. Login-Anker `a[rel='phoenix_member_login']` vorhanden: nicht angemeldet,
   abbrechen

Die ausgeloggte Seite traegt ein `shared.Hero` mit Platzhalterwerten (600
Kobans, volle Energien) -- wer misst, prueft `shared.Hero.infos.id` **und** den
Login-Anker (`live-verification-lessons.md`).

---

## 6. localStorage

Huelle und Spielseite liegen auf derselben Origin, teilen also denselben
Storage. HHAuto-eigene Keys tragen das Praefix `HHStoredVarPrefixKey`
(`HHAuto_`, definiert in `config/StorageKeys.ts`). Wo jeder Key liegt, steht in
`storage-keys.md`; gemessen lagen 240 von 245 dort, wo die Registry sie
vorsieht.

---

## 7. Cheat-Click

`shared.general.is_cheat_click` prueft im Spiel, ob ein Klick echt ist.
`Utils.replaceCheatClick()` hat einen leeren Rumpf und wird von
`StartService` aufgerufen -- eine vorbereitete, heute wirkungslose Stelle.

---

## 8. Checkliste fuer neue Skripte und Werkzeuge

- [ ] Im Frame der Spielseite laufen (oder deren `contentWindow` ansprechen),
      nicht in der Huelle
- [ ] Daten ueber `getHHVars()` lesen
- [ ] Ajax ueber `getHHAjax()`
- [ ] Auf Nutaku `addNutakuSession()` vor Ajax und Navigation
- [ ] Vor dem Lesen: `shared.Hero.infos.id` gesetzt und kein Login-Anker
- [ ] Seitenwechsel ueber `gotoPage()`
