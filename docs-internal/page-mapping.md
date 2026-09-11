---
last-verified: 2026-09-11
verified-against-version: 8.13.1
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

```typescript
HHEnvVariables["global"].pagesIDHome = "home";
HHEnvVariables["global"].pagesURLHome = "/home.html";
HHEnvVariables["global"].pagesKnownList.push("Home");
```

Aufgerufen via `ConfigHelper.getHHScriptVars("pagesIDHome")`. Die Liste `pagesKnownList` wird bei der Seitenerkennung verwendet, um unbekannte Seiten zu erkennen.

### Erkennung

```typescript
getPage() = document.getElementById(gameID).getAttribute("page")
```

`gameID` ist die ID des Wurzelelements des jeweiligen Spiels (z. B. `hh_hentai`).
**Gemessen 2026-09-11 auf www.hentaiheroes.com:** dieses Element ist das
`<body>` der Seite selbst (`<body id="hh_hentai" page="home">`), kein Iframe.
Auf allen 46 besuchten Seiten, die es tragen, gab `getPage()` den Wert des
`page`-Attributs zurueck, auf `/activities.html` den Tab (siehe unten). Wie das
bei der Nutaku-Einbettung aussieht, ist mit dem Pruefkonto nicht pruefbar.

Ohne dieses Element -- `getPage()` liefert dann `""` -- sind die Kampfseiten und
die Vorkampfseiten, wenn sie ohne Parameter aufgerufen werden (etwa
`/troll-pre-battle.html` ohne `id_opponent`). Mit den Parametern, die die
Elternseite verlinkt, tragen sie es; gemessen fuer `troll-pre-battle`,
`leagues-pre-battle`, `pantheon-pre-battle`, `penta_drill_pre_battle`, `teams`
und `edit-team`. Die Kampfseiten selbst wurden nicht besucht, weil ihr Aufruf
einen Kampf ausloest.

Activities-Page multiplext mehrere Sub-Seiten via Tab-Parameter und Query-String -- siehe Activities Sub-Tabs weiter unten.

### Bekannte Code-Spezialitaeten

- **Doppelte Definition:** `pagesIDLabyrinthEntrance` und `pagesIDLabyrinthPoolSelect` werden in `HHEnvVariables.ts` zweimal zugewiesen, mit denselben Werten. Funktional ohne Auswirkung.
- **Tippfehler-URL:** Der URL-Konstanten-Name fuer LeaguePreBattle heisst `pagesURLLeaguPreBattle` (mit fehlendem "e"). `League.ts` referenziert genau diesen Tippfehler. Beim Refactor: Code und Doku ueberall gleichzeitig korrigieren oder garnicht.

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

Die Activities-Page hostet mehrere Sub-Seiten als Tabs. Sub-Seiten teilen sich URL und `page`-Attribut (`activities`) und werden ueber den Tab unterschieden. Gemessen 2026-09-11:

| URL | `getPage()` |
|---|---|
| `/activities.html?tab=contests` | `contests` |
| `/activities.html?tab=missions` | `missions` |
| `/activities.html?tab=daily_goals` | `daily_goals` |
| `/activities.html` (ohne Tab) | `daily_goals` -- das Spiel leitet auf `?tab=daily_goals` um |
| `/activities.html?tab=pop` | `powerplacemain` |
| `/activities.html?tab=pop&pop_id=1` | `powerplace1` |

Entschieden wird ueber den URL-Parameter `tab` (`ACTIVITIES_SUB_TABS` in
`PageHelper.ts`). Nur wenn er fehlt, sucht der Code den aktiven Reiter:
`#activities-tabs > div.switch-tab.underline-tab.tab-switcher-fade-in[data-tab='…']`.
Gemessen: dieser Selektor trifft auf jedem Tab genau den aktiven, das kuerzere
`[data-tab="…"]` dagegen auf jedem Tab alle vier Reiter -- es taugt nicht zur
Unterscheidung.

PoP generiert dynamische IDs: "powerplace" + pop_id. Die Konstante pagesIDPowerplacemain zeigt nur auf die uebergreifende Hauptseite.

Einzel-PoP-Seite: `/activities.html?tab=pop&pop_id=N` (vorher `&index=N`, Issue #1782). Die PoP-ID wird aus dem URL-Param `pop_id` gelesen. Gemessen 2026-09-11: `window.pop_index` ist auf Liste und Einzelseite `0`, und `window.pop_list` ist kein Array, sondern ein Boolean -- `true` auf der Liste, `false` auf der Einzelseite. `resolvePopState()` prueft `Array.isArray(pop_list)`, der Boolean faellt also durch, und die Entscheidung trifft die sichtbare `div.pop_list` (Liste: 1, Einzelseite: 0). Ist die Liste sichtbar trotz `pop_id` in der URL, gilt der PoP als gesperrt (zurueckgeworfen).

---

## Spiel-Varianten

Alle unterstuetzten Spiele teilen die gleichen Page-IDs. Varianten-spezifische Configs in src/config/game/*.ts aendern nur Feature-Flags wie isEnabledSpreadsheets, isEnabledSeason, nicht die Seitenstruktur.

Welche Domains es gibt und welche `gameID` jede hat, steht in `getEnv()` der
jeweiligen Datei in `src/config/game/` (www-, nutaku- und weitere Subdomains);
HornyHeroes (`hh_sexy`) ist direkt in `HHEnvVariables.ts` eingetragen. Live
geprueft ist nur `www.hentaiheroes.com` (`hh_hentai`).

---

## Unbekannte Seiten

`getPage(true)` traegt Page-IDs, die in keinem `pagesID<Name>` der
`pagesKnownList` stehen, in `TK.unknownPagesList` ein (sessionStorage, je ID
einmal) und schreibt `Page unknown for script : <id> / <pfad>` ins Log -- um
Spiel-Updates zu bemerken.

Gemessen 2026-09-11 ueber 38 verschiedene `getPage()`-Werte: unbekannt war nur
`powerplace1`. Die Einzel-PoP-IDs entstehen zur Laufzeit (`"powerplace" + id`)
und stehen deshalb in keiner Liste. `getPage(true)` nimmt `powerplace<N>` seit
8.13.1 aus; vorher landete jede besuchte Einzel-PoP einmal in
`unknownPagesList`, ohne dass sich am Spiel etwas geaendert haette.

