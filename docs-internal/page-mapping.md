---
last-verified: 2026-09-01
verified-against-version: 8.11.0
status: current
---

# Page Mapping Referenz

Diese Datei beschreibt, wie Seiten erkannt werden und was dabei zu beachten
ist. Welche Seiten es gibt, steht im Code -- siehe unten.

Welche dieser Seiten je in einer Aufnahme vorkamen, ist eine andere Frage als
welche definiert sind: die Kampf- und Vorkampfseiten erreicht keine Seitentour,
weil man sie erspielen muss. `scripts/catalogue/run.mjs observe` haengt sich an
eine laufende Sitzung und sieht sie deshalb; eine Aufzeichnung vom 2026-08-17
hat die vollstaendige Labyrinth-Kette und alle fuenf `do_battles_*`-Varianten
erfasst.

---

## Architektur

### Dateien

- src/config/HHEnvVariables.ts -- Page-ID und URL-Definitionen als Properties auf HHEnvVariables["global"]
- src/Helper/PageHelper.ts -- Seitenerkennung (getPage())
- src/config/game/*.ts -- Spielvarianten-Configs (Feature-Flags, nicht Page-IDs)

Die Page-IDs sind keine export const-Werte, sondern werden zur Laufzeit auf das Singleton HHEnvVariables["global"] geschrieben:

typescript
HHEnvVariables["global"].pagesIDHome = "home";
HHEnvVariables["global"].pagesURLHome = "/home.html";
HHEnvVariables["global"].pagesKnownList.push("Home");


Aufgerufen via ConfigHelper.getHHScriptVars("pagesIDHome"). Die Liste pagesKnownList wird bei Page-Detection verwendet, um unbekannte Seiten zu erkennen.

### Erkennung

typescript
getPage() = document.getElementById(gameID).getAttribute("page")


gameID ist die Iframe-ID des aktuellen Spiels (z.B. "hh_hentai"). Das <body page="...">-Attribut innerhalb des Iframes liefert die ID.

Activities-Page multiplext mehrere Sub-Seiten via Tab-Parameter und Query-String -- siehe Activities Sub-Tabs weiter unten.

### Bekannte Code-Spezialitaeten

- **Doppelte Definition:** pagesIDLabyrinthEntrance und pagesIDLabyrinthPoolSelect werden zweimal zugewiesen (selbe Werte, einmal um Zeile 266 und nochmal um Zeile 390 in HHEnvVariables.ts). Funktional ohne Auswirkung.
- **Tippfehler-URL:** Der URL-Konstanten-Name fuer LeaguePreBattle heisst pagesURLLeaguPreBattle (mit fehlendem "e"). League.ts referenziert genau diesen Tippfehler. Beim Refactor: Code und Doku ueberall gleichzeitig korrigieren oder garnicht.

---

## Page-IDs

Die Liste steht in `src/config/HHEnvVariables.ts` -- je Seite drei Zeilen
(`pagesIDx`, `pagesURLx`, `pagesKnownList.push`). Eine Kopie hier hat sich als
Drift-Quelle erwiesen: sie stand zwei Eintraege hinter dem Code, ohne dass es
jemandem auffiel. Zum Nachsehen:

```bash
grep -n "pagesID[A-Za-z]* = \|pagesURL[A-Za-z]* = " src/config/HHEnvVariables.ts
```

Was der Code nicht sagt und deshalb hier steht: die Sub-Tabs, die
Spiel-Varianten und die beiden Eigenheiten oben.

## Activities Sub-Tabs

Die Activities-Page hostet mehrere Sub-Seiten als Tabs. Sub-Seiten teilen sich URL und page-Attribut, werden aber via Tab-Parameter unterschieden:

| URL/Tab | Logische Page | Selektor zur Erkennung |
|---------|--------------|------------------------|
| ?tab=missions | Missions | [data-tab="missions"] (im Activities-Tab-Switcher) |
| ?tab=contests | Contests | [data-tab="contests"] |
| ?tab=daily_goals | DailyGoals | [data-tab="daily_goals"] |
| ?tab=pop | PlaceOfPower | [data-tab="pop"] |

PoP generiert dynamische IDs: "powerplace" + pop_id. Die Konstante pagesIDPowerplacemain zeigt nur auf die uebergreifende Hauptseite.

Einzel-PoP-Seite: `/activities.html?tab=pop&pop_id=N` (seit dem 7.x-Optimierungs-Update des Spiels; vorher `&index=N`, Issue #1782). Die PoP-ID wird aus dem URL-Param `pop_id` gelesen, da die fruehere Globals (`window.pop_list`) entfallen sind und `window.pop_index` konstant 0 bleibt. `resolvePopState()` erkennt die Einzelseite, wenn keine sichtbare `div.pop_list` vorhanden ist; ist die Liste sichtbar trotz `pop_id` in der URL, gilt der PoP als gesperrt (zurueckgeworfen).

---

## Spiel-Varianten

Alle unterstuetzten Spiele teilen die gleichen Page-IDs. Varianten-spezifische Configs in src/config/game/*.ts aendern nur Feature-Flags wie isEnabledSpreadsheets, isEnabledSeason, nicht die Seitenstruktur.

| Spiel | Domain | gameID (Iframe) |
|-------|--------|-----------------|
| HentaiHeroes | hentaiheroes.com / haremheroes.com | hh_hentai |
| ComixHarem | comixharem.com | hh_comix |
| PornstarHarem | pornstarharem.com | hh_star |
| GayPornstarHarem | gaypornstarharem.com | hh_stargay |
| TransPornstarHarem | transpornstarharem.com | hh_startrans |
| GayHarem | gayharem.com | hh_gay |
| AmourAgent | amouragent.com | hh_amour |
| MangaRpg | mangarpg.com | hh_mangarpg |
| HornyHeroes | hornyheroes.com | hh_sexy |

---

## Unbekannte Seiten

Nicht erkannte Page-IDs werden in TK.unkownPagesList geloggt, um Game-Updates zu erkennen.

