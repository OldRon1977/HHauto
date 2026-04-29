---
last-verified: 2026-04-29
verified-against-version: 7.35.14
status: minor-drift-fixed
---

# Page Mapping Referenz

Alle Seiten-IDs und deren URL-Zuordnung im HHauto Script.
Letzte Aktualisierung: 2026-04-29 (verifiziert gegen v7.35.14; `HHEnvVariables.ts` unveraendert seit v7.35.10)

---

## Architektur

**Dateien:**
- `src/config/HHEnvVariables.ts` — Page ID Definitionen (Zeilen 211-416). Page IDs sind keine `export const`, sondern Properties auf dem Singleton `HHEnvVariables["global"]`, also `HHEnvVariables["global"].pagesIDxxx = "..."`.
- `src/Helper/PageHelper.ts` — Seitenerkennung (`getPage()`)
- `src/config/game/*.ts` — Spiel-Varianten-Configs (aendern nur Feature-Flags, nicht Page IDs)

**Bekannte Duplikate in HHEnvVariables.ts:** `pagesIDLabyrinthEntrance` und `pagesIDLabyrinthPoolSelect` werden zweimal definiert (Zeilen 266-272 und 390-396). Funktional ohne Auswirkung, weil die zweite Zuweisung dieselben Werte schreibt.

**Erkennung:**
```typescript
getPage() = document.getElementById(gameID).getAttribute('page')
```

Die Activities-Seite multiplext Sub-Seiten (Missions, Contests, Daily Goals, PoP) via Tabs und Query-Parameter.

---

## Page IDs

| Konstante | Page ID | URL-Pfad | Beschreibung |
|-----------|---------|----------|--------------|
| `pagesIDHome` | `"home"` | `/home.html` | Startseite |
| `pagesIDActivities` | `"activities"` | `/activities.html` | Aktivitaeten-Hub |
| `pagesIDMissions` | `"missions"` | (Sub-Tab) | Missionen |
| `pagesIDContests` | `"contests"` | (Sub-Tab) | Wettbewerbe |
| `pagesIDDailyGoals` | `"daily_goals"` | (Sub-Tab) | Tagesziele |

### Harem & Characters

| Konstante | Page ID | URL-Pfad | Beschreibung |
|-----------|---------|----------|--------------|
| `pagesIDHarem` | `"harem"` | `/characters.html` | Harem-Uebersicht |
| `pagesIDGirlPage` | `"girl"` | `/characters/{id}` | Einzelne Girl-Seite |
| `pagesIDWaifu` | `"waifu"` | `/waifu.html` | Waifu-Seite |
| `pagesIDMemberProgression` | `"member-progression"` | `/member-progression.html` | Fortschritt |
| `pagesIDGirlEquipmentUpgrade` | `"girl-equipment-upgrade"` | `/girl-equipment-upgrade.html` | Equipment |
| `pagesIDHeroPage` | `"hero_pages"` | `/hero/profile.html` | Held-Profil |

### Teams

| Konstante | Page ID | URL-Pfad | Beschreibung |
|-----------|---------|----------|--------------|
| `pagesIDBattleTeams` | `"teams"` | `/teams.html` | Team-Uebersicht |
| `pagesIDEditTeam` | `"edit-team"` | `/edit-team.html` | Team bearbeiten |

### Liga & PvP

| Konstante | Page ID | URL-Pfad | Beschreibung |
|-----------|---------|----------|--------------|
| `pagesIDLeaderboard` | `"leaderboard"` | `/leagues.html` | Liga-Rangliste |
| `pagesIDLeaguePreBattle` | `"leagues-pre-battle"` | `/leagues-pre-battle.html` | Liga Vorkampf |
| `pagesIDLeagueBattle` | `"league-battle"` | `/league-battle.html` | Liga Kampf |

### Season

| Konstante | Page ID | URL-Pfad | Beschreibung |
|-----------|---------|----------|--------------|
| `pagesIDSeason` | `"season"` | `/season.html` | Season-Uebersicht |
| `pagesIDSeasonArena` | `"season_arena"` | `/season-arena.html` | Season-Arena |
| `pagesIDSeasonBattle` | `"season-battle"` | `/season-battle.html` | Season-Kampf |

### Troll

| Konstante | Page ID | URL-Pfad | Beschreibung |
|-----------|---------|----------|--------------|
| `pagesIDTrollPreBattle` | `"troll-pre-battle"` | `/troll-pre-battle.html` | Troll Vorkampf |
| `pagesIDTrollBattle` | `"troll-battle"` | `/troll-battle.html` | Troll-Kampf |

### Pantheon

| Konstante | Page ID | URL-Pfad | Beschreibung |
|-----------|---------|----------|--------------|
| `pagesIDPantheon` | `"pantheon"` | `/pantheon.html` | Pantheon-Uebersicht |
| `pagesIDPantheonPreBattle` | `"pantheon-pre-battle"` | `/pantheon-pre-battle.html` | Pantheon Vorkampf |
| `pagesIDPantheonBattle` | `"pantheon-battle"` | `/pantheon-battle.html` | Pantheon-Kampf |

### Labyrinth

| Konstante | Page ID | URL-Pfad | Beschreibung |
|-----------|---------|----------|--------------|
| `pagesIDLabyrinthEntrance` | `"labyrinth-entrance"` | `/labyrinth-entrance.html` | Labyrinth-Eingang |
| `pagesIDLabyrinthPoolSelect` | `"labyrinth-pool-select"` | `/labyrinth-pool-select.html` | Pool-Auswahl |
| `pagesIDLabyrinth` | `"labyrinth"` | `/labyrinth.html` | Labyrinth |
| `pagesIDLabyrinthPreBattle` | `"labyrinth-pre-battle"` | `/labyrinth-pre-battle.html` | Labyrinth Vorkampf |
| `pagesIDLabyrinthBattle` | `"labyrinth-battle"` | `/labyrinth-battle.html` | Labyrinth-Kampf |
| `pagesIDEditLabyrinthTeam` | `"edit-labyrinth-team"` | `/edit-labyrinth-team.html` | Labyrinth-Team |

### Penta Drill

| Konstante | Page ID | URL-Pfad | Beschreibung |
|-----------|---------|----------|--------------|
| `pagesIDPentaDrill` | `"penta_drill"` | `/penta-drill.html` | Penta Drill |
| `pagesIDPentaDrillArena` | `"penta_drill_arena"` | `/penta-drill-arena.html` | Penta Arena |
| `pagesIDEditPentaDrillTeam` | `"edit-penta-drill-team"` | `/edit-penta-drill-team` | Penta Team |
| `pagesIDPentaDrillPreBattle` | `"penta_drill_pre_battle"` | `/penta-drill-pre-battle` | Penta Vorkampf |
| `pagesIDPentaDrillBattle` | `"penta-drill-battle"` | `/penta-drill-battle.html` | Penta-Kampf |

### Champion

| Konstante | Page ID | URL-Pfad | Beschreibung |
|-----------|---------|----------|--------------|
| `pagesIDChampionsPage` | `"champions"` | (embedded) | Champions-Seite |
| `pagesIDChampionsMap` | `"champions_map"` | `/champions-map.html` | Champions-Karte |
| `pagesIDClubChampion` | `"club_champion"` | `/club-champion.html` | Club-Champion |

### Events

| Konstante | Page ID | URL-Pfad | Beschreibung |
|-----------|---------|----------|--------------|
| `pagesIDEvent` | `"event"` | `/event.html` | Event-Seite |
| `pagesIDSeasonalEvent` | `"seasonal"` | `/seasonal.html` | Seasonal Event |
| `pagesIDBossBang` | `"boss-bang-battle"` | (embedded) | Boss Bang |
| `pagesIDLoveRaid` | `"love_raids"` | `/love-raids.html` | Love Raids |

### Pfad-Events

| Konstante | Page ID | URL-Pfad | Beschreibung |
|-----------|---------|----------|--------------|
| `pagesIDPoA` | `"path_of_attraction"` | (embedded) | Path of Attraction |
| `pagesIDPoG` | `"path-of-glory"` | `/path-of-glory.html` | Path of Glory |
| `pagesIDPoV` | `"path-of-valor"` | `/path-of-valor.html` | Path of Valor |
| `pagesIDSexGodPath` | `"sex-god-path"` | `/sex-god-path.html` | Sex God Path |

### Sonstiges

| Konstante | Page ID | URL-Pfad | Beschreibung |
|-----------|---------|----------|--------------|
| `pagesIDMap` | `"map"` | `/map.html` | Weltkarte |
| `pagesIDQuest` | `"quest"` | (embedded) | Quest |
| `pagesIDPachinko` | `"pachinko"` | `/pachinko.html` | Pachinko |
| `pagesIDShop` | `"shop"` | `/shop.html` | Shop |
| `pagesIDClub` | `"clubs"` | `/clubs.html` | Club |
| `pagesIDPowerplacemain` | `"powerplacemain"` | (dynamisch) | Place of Power |

---

## Spezialfaelle

### Activities-Multiplexing
Die Activities-Seite hostet mehrere Sub-Seiten als Tabs:
- Missions, Contests, Daily Goals werden ueber Query-Parameter erkannt
- Place of Power generiert dynamische IDs: `"powerplace" + index`

### Unbekannte Seiten
Nicht erkannte Page IDs werden in `TK.unkownPagesList` geloggt, um Game-Updates zu erkennen.

### Spiel-Varianten
Alle Spiele teilen die gleichen Page IDs. Varianten-spezifische Configs aendern nur Feature-Flags (z.B. `isEnabledSpreadsheets`, `isEnabledSeason`), nicht die Seitenstruktur.
