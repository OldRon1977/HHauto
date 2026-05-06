---
last-verified: 2026-05-05
verified-against-version: 7.35.21
status: current
---

# Page Mapping Referenz

Alle Seiten-IDs und ihre URL-Zuordnung im HHauto-Skript.
Quelle: src/config/HHEnvVariables.ts. Letzte vollstaendige Verifikation: 2026-05-05 gegen v7.35.21.

**Code-Stand:** 53 Page-IDs definiert, 54 Eintraege in pagesKnownList.

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

### Hauptmenü / Hub

| Konstante | Page-ID (page-Attribut) | URL-Pfad | Beschreibung |
|-----------|---------------------------|----------|--------------|
| pagesIDHome | "home" | /home.html | Startseite |
| pagesIDActivities | "activities" | /activities.html | Aktivitaeten-Hub |
| pagesIDMap | "map" | /map.html | Weltkarte |
| pagesIDShop | "shop" | /shop.html | Shop |
| pagesIDPachinko | "pachinko" | /pachinko.html | Pachinko |
| pagesIDClub | "clubs" | /clubs.html | Club |

### Activities Sub-Tabs (URL-Parameter)

| Konstante | Page-ID (page-Attribut) | URL-Pfad | Beschreibung |
|-----------|---------------------------|----------|--------------|
| pagesIDMissions | "missions" | *(keine URL)* | Missionen |
| pagesIDContests | "contests" | *(keine URL)* | Wettbewerbe |
| pagesIDDailyGoals | "daily_goals" | *(keine URL)* | Tagesziele |
| pagesIDPowerplacemain | "powerplacemain" | *(keine URL)* | Place of Power |

### Harem / Characters

| Konstante | Page-ID (page-Attribut) | URL-Pfad | Beschreibung |
|-----------|---------------------------|----------|--------------|
| pagesIDHarem | "harem" | /characters.html | Harem-Uebersicht |
| pagesIDGirlPage | "girl" | *(keine URL)* | Einzelne Girl-Seite |
| pagesIDWaifu | "waifu" | /waifu.html | Waifu-Seite |
| pagesIDMemberProgression | "member-progression" | /member-progression.html | Fortschritt |
| pagesIDGirlEquipmentUpgrade | "girl-equipment-upgrade" | /girl-equipment-upgrade.html | Equipment |
| pagesIDHeroPage | "hero_pages" | /hero/profile.html | Held-Profil |

### Teams

| Konstante | Page-ID (page-Attribut) | URL-Pfad | Beschreibung |
|-----------|---------------------------|----------|--------------|
| pagesIDBattleTeams | "teams" | /teams.html | Team-Uebersicht |
| pagesIDEditTeam | "edit-team" | /edit-team.html | Team bearbeiten |

### League / PvP

| Konstante | Page-ID (page-Attribut) | URL-Pfad | Beschreibung |
|-----------|---------------------------|----------|--------------|
| pagesIDLeaderboard | "leaderboard" | /leagues.html | Liga-Rangliste |
| pagesIDLeaguePreBattle | "leagues-pre-battle" | *(keine URL)* | Liga Vorkampf |
| pagesIDLeagueBattle | "league-battle" | /league-battle.html | Liga Kampf |

### Season

| Konstante | Page-ID (page-Attribut) | URL-Pfad | Beschreibung |
|-----------|---------------------------|----------|--------------|
| pagesIDSeason | "season" | /season.html | Season-Uebersicht |
| pagesIDSeasonArena | "season_arena" | /season-arena.html | Season-Arena |
| pagesIDSeasonBattle | "season-battle" | /season-battle.html | Season-Kampf |

### Troll

| Konstante | Page-ID (page-Attribut) | URL-Pfad | Beschreibung |
|-----------|---------------------------|----------|--------------|
| pagesIDTrollPreBattle | "troll-pre-battle" | /troll-pre-battle.html | Troll Vorkampf |
| pagesIDTrollBattle | "troll-battle" | /troll-battle.html | Troll-Kampf |

### Pantheon

| Konstante | Page-ID (page-Attribut) | URL-Pfad | Beschreibung |
|-----------|---------------------------|----------|--------------|
| pagesIDPantheon | "pantheon" | /pantheon.html | Pantheon-Uebersicht |
| pagesIDPantheonPreBattle | "pantheon-pre-battle" | /pantheon-pre-battle.html | Pantheon Vorkampf |
| pagesIDPantheonBattle | "pantheon-battle" | /pantheon-battle.html | Pantheon-Kampf |

### Labyrinth

| Konstante | Page-ID (page-Attribut) | URL-Pfad | Beschreibung |
|-----------|---------------------------|----------|--------------|
| pagesIDLabyrinthEntrance | "labyrinth-entrance" | /labyrinth-entrance.html | Labyrinth-Eingang |
| pagesIDLabyrinthPoolSelect | "labyrinth-pool-select" | /labyrinth-pool-select.html | Pool-Auswahl |
| pagesIDLabyrinth | "labyrinth" | /labyrinth.html | Labyrinth |
| pagesIDLabyrinthPreBattle | "labyrinth-pre-battle" | /labyrinth-pre-battle.html | Labyrinth Vorkampf |
| pagesIDLabyrinthBattle | "labyrinth-battle" | /labyrinth-battle.html | Labyrinth-Kampf |
| pagesIDEditLabyrinthTeam | "edit-labyrinth-team" | /edit-labyrinth-team.html | Labyrinth-Team |

### Penta Drill

| Konstante | Page-ID (page-Attribut) | URL-Pfad | Beschreibung |
|-----------|---------------------------|----------|--------------|
| pagesIDPentaDrill | "penta_drill" | /penta-drill.html | Penta Drill |
| pagesIDPentaDrillArena | "penta_drill_arena" | /penta-drill-arena.html | Penta Arena |
| pagesIDEditPentaDrillTeam | "edit-penta-drill-team" | /edit-penta-drill-team | Penta Team |
| pagesIDPentaDrillPreBattle | "penta_drill_pre_battle" | /penta-drill-pre-battle | Penta Vorkampf |
| pagesIDPentaDrillBattle | "penta-drill-battle" | /penta-drill-battle.html | Penta-Kampf |

### Champion

| Konstante | Page-ID (page-Attribut) | URL-Pfad | Beschreibung |
|-----------|---------------------------|----------|--------------|
| pagesIDChampionsPage | "champions" | *(keine URL)* | Champions-Seite |
| pagesIDChampionsMap | "champions_map" | /champions-map.html | Champions-Karte |
| pagesIDClubChampion | "club_champion" | /club-champion.html | Club-Champion |

### Events

| Konstante | Page-ID (page-Attribut) | URL-Pfad | Beschreibung |
|-----------|---------------------------|----------|--------------|
| pagesIDEvent | "event" | /event.html | Event-Seite |
| pagesIDSeasonalEvent | "seasonal" | /seasonal.html | Seasonal Event |
| pagesIDBossBang | "boss-bang-battle" | *(keine URL)* | Boss Bang |
| pagesIDLoveRaid | "love_raids" | /love-raids.html | Love Raids |

### Pfad-Events

| Konstante | Page-ID (page-Attribut) | URL-Pfad | Beschreibung |
|-----------|---------------------------|----------|--------------|
| pagesIDPoA | "path_of_attraction" | *(keine URL)* | Path of Attraction |
| pagesIDPoG | "path-of-glory" | /path-of-glory.html | Path of Glory |
| pagesIDPoV | "path-of-valor" | /path-of-valor.html | Path of Valor |
| pagesIDSexGodPath | "sex-god-path" | /sex-god-path.html | Sex God Path |

### Quest

| Konstante | Page-ID (page-Attribut) | URL-Pfad | Beschreibung |
|-----------|---------------------------|----------|--------------|
| pagesIDQuest | "quest" | *(keine URL)* | Quest |

### Sonstiges

| Konstante | Page-ID (page-Attribut) | URL-Pfad | Beschreibung |
|-----------|---------------------------|----------|--------------|
| pagesIDLeaguPreBattle | "?" | /leagues-pre-battle.html |  |

---

## Activities Sub-Tabs

Die Activities-Page hostet mehrere Sub-Seiten als Tabs. Sub-Seiten teilen sich URL und page-Attribut, werden aber via Tab-Parameter unterschieden:

| URL/Tab | Logische Page | Selektor zur Erkennung |
|---------|--------------|------------------------|
| ?tab=missions | Missions | [data-tab="missions"] (im Activities-Tab-Switcher) |
| ?tab=contests | Contests | [data-tab="contests"] |
| ?tab=daily_goals | DailyGoals | [data-tab="daily_goals"] |
| ?tab=pop | PlaceOfPower | [data-tab="pop"] |

PoP generiert dynamische IDs: "powerplace" + index. Die Konstante pagesIDPowerplacemain zeigt nur auf die uebergreifende Hauptseite.

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

