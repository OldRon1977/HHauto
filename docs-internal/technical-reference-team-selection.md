---
last-verified: 2026-05-05
verified-against-version: 7.35.21
status: current
---

# Technical Reference: Team Selection Data & API

Referenz-Doku zur Team-Auswahl. Adressiert Issues #1340 und #1573.
Letzte vollstaendige Verifikation: 2026-05-05 gegen v7.35.21.

---

## 1. Datenquellen-Uebersicht

| Quelle | Verfuegbar auf | Zugriffsweg | Felder | Aufrufer im Skript |
|--------|----------------|-------------|--------|---------------------|
| `availableGirls` | Edit-Team-Page | `getHHVars("availableGirls")` | **62 pro Girl** | `TeamModule.setTopTeamV2()`, `Harem.getGirlsList()`, `Harem.haremCountMax()` |
| `data-new-girl-tooltip` | Edit-Team-Page (DOM) | `$('.girl_img').attr('data-new-girl-tooltip')` | **11 pro Girl** | `TeamModule.setTopTeamLegacy()` (Fallback) |
| `get_girls_blessings`-API | Home-Page (Blessing-Popup) | AJAX-Call via `getHHAjax()`; Response wird im `BlessingService` geparst und gecacht | `active[]`, `upcoming[]` | `BlessingService` (Cache fuer Team-UI), `Spreadsheet` (Link-Injection) |
| `shared.GirlSalaryManager.girlsMap` | Salary-Manager-Pages | `getHHVars("shared.GirlSalaryManager.girlsMap")` | volle Girl-Daten | `Harem.getGirlMapSorted()` |
| `girlsDataList` | verschiedene Pages | `getHHVars("girlsDataList")` | volle Girl-Daten | `Harem.getGirlsList()` Fallback |
| `girls_data_list` | Waifu-Page | `getHHVars("girls_data_list")` | volle Girl-Daten | `Harem.getGirlsList()` Fallback |

---

## 2. `availableGirls` -- Vollstaendige Feldliste (62 Felder)

Zugriff: `(unsafeWindow as any).availableGirls` oder `getHHVars("availableGirls")`.
Verfuegbar auf: Edit-Team-Page (`pagesIDEditTeam`).
Typ: `Array<GirlData>` mit 62 Feldern pro Girl.

Die folgende Liste ist gegen den Live-Dump (HentaiHeroes, 2026-05-05) verifiziert.

### Identitaet & Basis-Info

| Feld | Typ | Beispiel | Notiz |
|------|-----|----------|-------|
| `id_girl` | number | `12345` | eindeutige Girl-ID |
| `id_girl_ref` | number | | Referenz-ID (Basis-Girl) |
| `id_member` | number | | Member-ID des Spielers |
| `name` | string | `"Maisie"` | Anzeigename |
| `rarity` | string | `"mythic"` | `starting`/`common`/`rare`/`epic`/`legendary`/`mythic` |
| `class` | **number** | `1` | **1 = Hardcore, 2 = Charm, 3 = Know-how** -- KEIN String |
| `figure` | number | `1` | numerischer Figur-Index |
| `level` | number | `750` | aktuelles Level |
| `nb_grades` | number | | maximale Grade-Plaetze (3 oder 5 fuer Legendary, 6 fuer Mythic) |
| `graded` | number | | aktuelle Grade-Anzahl |
| `Graded` | string | | mit grossem `G` -- HTML-String fuer UI-Anzeige |
| `graded2` | string | | HTML mit Grade-Icons (`<g`-Tags und `grey`-Klasse fuer Counting) |
| `fav_graded` | number | | |
| `awakening_level` | number | | |
| `affection` | number | | |
| `xp` | number | | |
| `date_added` | string | | wann das Girl hinzugefuegt wurde |
| `release_date` | string | | |
| `anniversary` | string | | |
| `style` | string | | |
| `id_world` | number | | |
| `id_quest_get` | number | | |
| `id_role` | number | | |
| `id_places_of_power` | number | | |

### Stats (INKLUSIVE BLESSINGS, OHNE EQUIPMENT)

| Feld | Typ | Beispiel | Notiz |
|------|-----|----------|-------|
| `caracs` | object | `{carac1: 20446.345, carac2: 10658.7, carac3: 8026.2}` | **bereits gesegnet, equipment-frei** -- direkt verwendbarer Final-Wert |
| `carac1` | number | `20446.345` | identisch zu `caracs.carac1` |
| `carac2` | number | `10658.7` | identisch zu `caracs.carac2` |
| `carac3` | number | `8026.2` | identisch zu `caracs.carac3` |
| `caracs_sum` | number | `39131.245` | Summe der drei caracs (vorberechnet vom Spiel) |
| `orgasm` | number | | |

**Verifiziert per Dump-Vergleich (2026-05-05):**

```
teamGirls.blessed_caracs == availableGirls.caracs
```

`caracs` ist gesegnet aber **ohne** Equipment. Daher kein Unequip vor Score noetig.

### Blessing-Daten

| Feld | Typ | Beispiel | Notiz |
|------|-----|----------|-------|
| `blessing_bonuses` | object | siehe unten | individuelle Blessing-Prozente fuer dieses Girl |
| `can_be_blessed` | boolean | | ob Girl Blessings erhalten kann |
| `can_be_blessed_pvp4` | boolean | | PvP4-Blessing-Berechtigung |
| `blessed_attributes` | object | | im Tooltip ebenfalls vorhanden |

#### `blessing_bonuses` Struktur

```jsonc
{
  "pvp_v3": {                    // League-Blessings
    "carac1": [20, 30],          // Array individueller Blessing-%
    "carac2": [20, 30],          // [20] = Element-Blessing, [30] = Zodiac-Blessing
    "carac3": [20, 30]
  },
  "pvp_v4": {                    // anderes PvP-Mode
    "carac1": [20, 30],
    "carac2": [20, 30],
    "carac3": [20, 30]
  }
}
```

- Leeres Array `[]` -- Girl trifft keine Blessing
- `[20]` -- ein Blessing-Match
- `[20, 30]` -- beide aktiven Blessings
- Blessings sind **multiplikativ**: total = (1 + 0.20) * (1 + 0.30) = 1.56

### Element-Daten

| Feld | Typ | Beispiel | Notiz |
|------|-----|----------|-------|
| `element` | string | `"sun"` | interner Element-Name |
| `element_data` | object | siehe unten | volle Element-Info |

#### `element_data` Struktur (8 Keys)

```jsonc
{
  "type": "stone",                              // intern: fire/water/nature/stone/sun/darkness/psychic/light
  "weakness": "nature",                         // dieses Element wird besiegt von ...
  "domination": "sun",                          // dieses Element dominiert ...
  "domination_ego_bonus_percent": 10,
  "domination_damage_bonus_percent": 10,
  "domination_critical_chance_bonus_percent": 20,
  "ico_url": "https://hh2.hh-content.com/pictures/girls_elements/Physical.png",
  "flavor": "Physical"                          // UI-Anzeigename: Eccentric/Sensual/Exhibitionist/Physical/Playful/Dominatrix/Submissive/Voyeur
}
```

#### Element-Mapping (intern <-> Anzeige)

| Interner Typ | Anzeigename (`flavor`) | Synergie-Bonus pro Team-Girl | Bonus-Typ |
|--------------|------------------------|------------------------------|-----------|
| `fire` | Eccentric | **+10%** | Critical Hit Damage |
| `water` | Sensual | +3% | Recover on Hit |
| `nature` | Exhibitionist | +3% | Ego (HP) |
| `stone` | Physical | +2% | Critical Hit Chance |
| `sun` | Playful | +2% | Decrease Defense of Opponent |
| `darkness` | Dominatrix | +2% | Damage |
| `psychic` | Submissive | +2% | Defense |
| `light` | Voyeur | +2% | Harmony |

Quelle: `TeamScoringService.ELEMENT_SYNERGY_PER_GIRL` und `BlessingService` Klassen-Mapping.

### Trait-Daten

| Feld | Typ | Beispiel | Notiz |
|------|-----|----------|-------|
| `zodiac` | string | `"\u2650 Sagittarius"` | Unicode-Glyph + englischer Name. `TraitMappings.resolveZodiac` strippt das Glyph. |
| `hair_color1` | string | `"F99"` | Hex-Code (ohne `#`). Map siehe `TraitMappings.ts` |
| `hair_color2` | string | | zweiter Haarton (multicoloriert), oft leer |
| `eye_color1` | string | `"F90"` | Hex-Code |
| `eye_color2` | string | | zweite Augenfarbe |
| `position_img` | string | `"3.png"` | Lieblings-Position als Bilddateiname |

### Skills & Equipment

| Feld | Typ | Notiz |
|------|-----|-------|
| `skill_tiers_info` | object | Skill-Tier-Info (Tier 1 bis 5; Tier 4/5 nutzt der BDSM-Sim) |
| `armor` | object | aktuell ausgeruestete Items |
| `upgrade_quests` | object | |

### Bilder & Anzeige

| Feld | Typ |
|------|-----|
| `images` | object |
| `ico` | string |
| `avatar` | string |
| `black_avatar` | string |
| `default_avatar` | string |
| `grade_skins` | object |
| `grade_offsets` | object |
| `grade_offset_values` | object |
| `animated_grades` | object |
| `scene_paths` | object |

### Salary & Wirtschaft

| Feld | Typ |
|------|-----|
| `salary` | number |
| `salary_timer` | number |
| `salary_per_hour` | number |
| `pay_time` | number |
| `pay_in` | number |
| `ts_pay` | number |
| `shards` | number |

---

## 3. `data-new-girl-tooltip` -- Feldliste (11 Felder)

Zugriff: `$('.girl_img', element).attr('data-new-girl-tooltip')` -> `JSON.parse`.
Gesetzt durch: das Spiel selbst (nicht HHauto).
Verfuegbar auf: Edit-Team-Page (DOM-Elemente mit `div[id_girl]`).

Wird vom Legacy-Algorithmus genutzt, wenn `availableGirls` nicht verfuegbar ist.

| Feld | Typ | Beispiel |
|------|-----|----------|
| `name` | string | `"Karole"` |
| `level` | number | `1` |
| `rarity` | string | `"rare"` |
| `class` | number | `1` |
| `element` | string | `"water"` |
| `element_data` | object | gleiche Struktur wie in availableGirls |
| `caracs` | object | `{carac1: 1.9, carac2: 2.2, carac3: 4.5}` |
| `graded2` | string | HTML-Grade-String |
| `skill_tiers_info` | object | |
| `salary_per_hour` | number | |
| `blessed_attributes` | object | |

**NICHT im Tooltip:** `blessing_bonuses`, `zodiac`, `hair_color1/2`, `eye_color1/2`, `position_img`, `id_girl`, `armor`, `awakening_level` und ~50 weitere Felder.

Konsequenz: der Legacy-Algorithmus kann keine Tier-3-Trait-Matches berechnen und keinen Klassenfilter ueber `class` machen (DOM-Element-Wrapper bietet `id_girl` in einem anderen Attribut).

---

## 4. Blessing-API-Response

Endpoint: `action=get_girls_blessings`.
Intercepted in `BlessingService.fetchAndCache()` (manuell ausgeloest beim Home-Page-Besuch). Cache-Lebensdauer: 12 Stunden.
Zusaetzlich: `Spreadsheet.run()` injiziert einen Spreadsheet-Link in das Blessing-Popup.

Response-Struktur:

```jsonc
{
  "active": [
    {
      "title": "Week of the Playful",
      "description": "All girls with <span class=\"blessing-condition\">Element Playful</span> gain <span class=\"blessing-bonus\">+ 20%</span> bonus on all attributes.",
      "remaining_time": 487876,     // Sekunden bis Ablauf
      "starts_in": -113323          // negativ = bereits gestartet
    },
    {
      "title": "Week of the Sagittarius",
      "description": "...<span class=\"blessing-condition\">Zodiac sign Sagittarius</span>... <span class=\"blessing-bonus\">+ 30%</span>...",
      "remaining_time": 487876,
      "starts_in": -113323
    },
    {
      "title": "Week of the Corkscrewer",
      "description": "...<span class=\"blessing-condition\">Role Corkscrewer</span>... + 30%... in Love Labyrinth.",
      "remaining_time": 487876,
      "starts_in": -113323
    }
  ],
  "upcoming": [ ... ],
  "success": true
}
```

### Slot-Struktur (pro Woche)

| Slot | Typ | League-Relevant | Beispiel |
|------|-----|------------------|----------|
| Slot 1 | Element ODER Position ODER Hair/Eye Color | **ja** | "Week of the Playful" (+20%) |
| Slot 2 | Zodiac | **ja** | "Week of the Sagittarius" (+30%) |
| Slot 3 | Role | **nein** (Love-Labyrinth-Only) | "Week of the Corkscrewer" (+30%) |

Labyrinth-only-Blessings erkennbar an `"in Love Labyrinth"` in der Description. `BlessingService.parseTraits` filtert sie via:

```typescript
if (!desc.includes('bonus on all attributes') || desc.includes('labyrinth')) continue;
```

### `BlessingService` Cache-Felder

`BlessingService.getCached()` liefert ein Objekt:

| Feld | Typ | Beispiel |
|------|-----|----------|
| `timestamp` | number | `1714903123456` |
| `raw` | object | komplette API-Response |
| `blessedTraits` | string[] | `['eyeColor', 'zodiac']` (kategoriale Match) |
| `blessedValues` | object | `{eyeColor: 'golden', zodiac: 'sagittarius'}` (konkreter Wert) |
| `blessedElement` | string | optional, falls Element-Blessing aktiv (`'fire'`, `'sun'`, ...) |

### Parsing-Hinweise

- Condition-Type aus `<span class="blessing-condition">...</span>`
- Bonus-Wert aus `<span class="blessing-bonus">+ XX%</span>`
- Gesehene Condition-Kategorien: `"Element ..."`, `"Zodiac sign ..."`, `"Favourite position ..."`, `"Favorite position ..."`, `"Role ..."`
- Erwartet aber selten beobachtet: `"Hair color ..."`, `"Eye color ..."`

---

## 5. Equipment

`availableGirls.caracs` ist **equipment-free**. Dieses Faktum wird per Dump-Vergleich verifiziert (2026-05-05):

```
teamGirls.blessed_caracs == availableGirls.caracs
```

Der Team-Builder liest `caracs` direkt. **Kein Unequip noetig vor Score.** Ein UI-Hinweis erinnert den User, dass Equipment nicht enthalten ist und empfiehlt `Stuff Team` nach dem Anlegen des Teams.

---

## 6. Relevante Source-Files (v7.35.21)

### Team-Selection (v4 -- aktiv)

| Datei | Schluessel-Funktion | Zweck |
|-------|---------------------|-------|
| `src/Service/TeamScoringService.ts` | `filterEligible(girls, playerClass)` | Hard-Filter: Mythic/Legendary 5* AND class === playerClass |
| `src/Service/TeamScoringService.ts` | `getMainCarac(girl, playerClass)` | gibt carac1/2/3 anhand Player-Klasse zurueck |
| `src/Service/TeamScoringService.ts` | `scoreCurrentBest()`, `scoreBestPossible()` | Score (main_carac) fuer beide Modi |
| `src/Service/TeamScoringService.ts` | `calculateTier3TeamBonus()` | Tier-3 Trait-Match-Bonus |
| `src/Service/TeamScoringService.ts` | `findTraitGroups(girls, class, blessed?)` | gruppiere nach Element-Paar + gemeinsamem Trait-Wert |
| `src/Service/TeamScoringService.ts` | `calculateSynergies()`, `calculateSynergyValue()` | Synergie-Berechnung (informational) |
| `src/Service/TeamScoringService.ts` | `rankLeaderCandidates()` | Leader-Ranking: Mythic only, Tier-5-Prioritaet |
| `src/Service/TeamBuilderService.ts` | `buildTeam(girls, mode, level, playerClass)` | Haupt-Eintritt: Filter, Cluster-Vergleich, Leader, Slot-Fill |
| `src/Service/TeamBuilderService.ts` | `getElementDistribution()` | Element-Counts fuer UI |
| `src/Service/TraitMappings.ts` | `resolve(category, value)` | Hex/Position/Zodiac -> lesbares Label, Runtime + Fallback |
| `src/Module/TeamModule.ts` | `setTopTeam()` | Dispatch: v4 wenn availableGirls vorhanden, sonst Legacy |
| `src/Module/TeamModule.ts` | `setTopTeamV2()` | resolved Player-Klasse via HeroHelper.getClass(), mappt Daten, ruft TeamBuilderService |
| `src/Module/TeamModule.ts` | `setTopTeamLegacy()` | alte Tooltip-basierte Auswahl (Fallback) |
| `src/Module/TeamModule.ts` | `updateTeamUI()` | gemeinsame UI-Logik mit Synergie- + Trait-Info-Box |
| `src/Module/TeamModule.ts` | `moduleChangeTeam()` | Button-Setup (Current Best, Possible Best, Unequip) |
| `src/Module/TeamModule.ts` | `assignTopTeam()` | weist das ausgewaehlte Top-Team zu |
| `src/Module/TeamModule.ts` | `getSelectedGirls()` | liest aktuelle Team-Mitglieder |

### Tests

| Datei | Tests | Zweck |
|-------|-------|-------|
| `spec/Service/TeamScoringService.spec.ts` | 53 | Synergien, Tier-5, Scoring, Filter (Klasse + Rarity), Tier-3-Traits |
| `spec/Service/TeamBuilderService.spec.ts` | 20 | Team-Building, Klassen-Filter, Modi, Leader-Selection |

### Girl-Daten-Loading

| Datei | Schluessel-Funktion | Zweck |
|-------|---------------------|-------|
| `src/Module/harem/Harem.ts` | `getGirlsList()` | laedt Girls aus Game-Globals -- liest erst OCD-Cache, dann availableGirls/girlsDataList/girls_data_list |
| `src/Module/harem/Harem.ts` | `getGirlMapSorted()` | sortierte Girl-Liste aus `shared.GirlSalaryManager.girlsMap` |
| `src/Module/harem/Harem.ts` | `getHaremGirlsFromOcdIfExist()` | OCD-Skript-Cache als Fallback |
| `src/Module/harem/HaremGirl.ts` | | Einzelner-Girl-Daten-Zugriff |
| `src/Helper/HHHelper.ts` | `getHHVars(path)` | Bridge zu `unsafeWindow`-Globals |

### Blessing & Spreadsheet

| Datei | Schluessel-Funktion | Zweck |
|-------|---------------------|-------|
| `src/Service/BlessingService.ts` | `fetchAndCache()` | manueller Pull der Blessings, 12h-Cache in `TK.blessingsCache` |
| `src/Service/BlessingService.ts` | `parseBlessedValues()` | extrahiert konkrete Blessing-Werte aus den Descriptions |
| `src/Module/Spreadsheet.ts` | `run()` | injiziert Spreadsheet-Link ins Blessing-Popup |

### Battle-Simulation (siehe `bdsm-battle-simulator.md`)

| Datei | Zweck |
|-------|-------|
| `src/Helper/BDSMHelper.ts` | Battle-Simulation mit Element-Synergien, Domination, Crit, Tier-4/5-Skills |
| `src/model/BDSMPlayer.ts` | Player-Modell (HP, Atk, Crit, Bonuses, Tier-4/5) |
| `src/model/BDSMSimu.ts` | Simulationsergebnis (win, loss, points, scoreClass) |

### Modelle

| Datei | Zweck |
|-------|-------|
| `src/model/KK/KKHaremGirl.ts` | Girl-Daten-Modell -- 62 Felder |
| `src/model/KK/KKTeamGirl.ts` | Team-Member-Wrapper (Girl + Skills) |
| `src/model/TeamData.ts` | Team-Struktur (7 Girls + Scroll-Counts) |
| `src/model/KK/KKHero.ts` | Player/Hero-Modell |
| `src/model/KK/KKLeagueOpponent.ts` | League-Gegner-Modell (mit `girls_count_per_element`) |

### UI / i18n

| Datei | Key | Wert |
|-------|-----|------|
| `src/i18n/en.ts` | `ChangeTeamButton` | "Current Best" |
| `src/i18n/en.ts` | `ChangeTeamButton2` | "Possible Best" |
| `src/i18n/en.ts` | `AssignTopTeam` | Button zum Anwenden des Top-Teams |

---

## 7. `setTopTeam` Logik (v4, aktuell)

Datenquelle: `getHHVars("availableGirls")` -- 62 Felder pro Girl auf Edit-Team-Page.

```
Filter (beide Modi):
  Klasse:    g.class === playerClass         (1=HC, 2=Charm, 3=KH; HARD)
  Rarity:    Mythic immer
             Legendary nur wenn nb_grades >= 5
             alles andere: raus

Score:
  Mode 1 ("Current Best"):
    score = caracs.caracN              (N = playerClass; bereits gesegnet)

  Mode 2 ("Best Possible"):
    score = max(
      caracs.caracN,
      caracs.caracN / max(level,1) * playerLevel
                    / (1 + 0.3 * graded)
                    * (1 + 0.3 * nb_grades)
    )

Process:
  1. Map availableGirls -> GirlData[]
     (element via element_data.type, Traits via zodiac/hair_color1/eye_color1/position_img,
      class als integer durchreichen)
  2. filterEligible(girls, playerClass)        -- Klasse + Rarity-Filter
  3. Score alle Kandidaten, sortiere desc, KEIN Pool-Cap (alle eligible)
  4. detectBlessedTraits(...)                  -- aktive Blessing-Kategorien aus blessing_bonuses
  5. findTraitGroups(...)                      -- Cluster nach Element-Paar + Trait-Wert,
                                                  blessed Cluster bekommen x1.5 Score-Boost
  6. Top 5 Cluster + alle blessed Cluster evaluieren
  7. Pro Cluster: Team mit Leader + 6 Slot-Fills bauen
     - Leader: Mythic, Tier-5 Shield(4) > Stun(3) > Execute(2) > Reflect(1)
     - Slot 2-7 in 3 Passes:
       Pass 1: Element-Paar + Trait-Match
       Pass 2: Element-Paar (irgendein Trait)
       Pass 3: irgendein Element by Score
  8. Vergleiche Cluster nach effective Power = main_sum * (1 + tier3Bonus)
  9. Beste Cluster gewinnt; alle Alternativen werden in result.alternatives aufgelistet
  10. UI-Box: Klar-Namen, Klassen-Hinweis, Equipment-Hinweis, Power-Vergleich
```

### Legacy-Fallback (aktiv, wenn `availableGirls` nicht da)

Datenquelle: `data-new-girl-tooltip` -- 11 Felder pro Girl per DOM-Parsing.
Kein Klassen-Filter, kein Trait-Matching, keine Leader-Skill-Optimierung.

```
1. Iteriere alle div[id_girl] auf der Seite
2. Parse Tooltip-JSON aus .girl_img child
3. Score pro Girl (Mode 1: caracs_sum, Mode 2: caracs_sum projiziert)
4. Halte Top 16 in sortierten Arrays (deckID, deckStat)
5. Verstecke Nicht-Top-Girls, zeige Top 16 mit Rang-Nummern
6. "Assign Top Team"-Button hinzufuegen
```

Die Legacy-Logik kann den Klassen-Filter nicht anwenden (das `class`-Feld ist im Tooltip zwar present, der Filter ist aber im `setTopTeamLegacy` nie implementiert worden) und liefert deshalb potenziell schlechtere Teams.

---

## 8. Element-Counter-Boni (siehe `bdsm-battle-simulator.md`)

Zwei separate Cycles fuer elementare Vorteile im Kampf:

**Cycle 1 -- Crit-Chance (+20%):**
```
darkness (Dominatrix) -> light (Voyeur) -> psychic (Submissive) -> darkness
```

**Cycle 2 -- Damage (+10%) UND Ego (+10%):**
```
fire (Eccentric) -> nature (Exhibitionist) -> stone (Physical) -> sun (Playful) -> water (Sensual) -> fire
```

Die Cycles sind in `BDSMHelper.ELEMENTS` als `chance` (3 Elemente) und `egoDamage` (5 Elemente) definiert. Der Team-Algorithmus verwendet diese Counter-Logik aktuell **nicht** -- weil der Gegner zur Auswahl-Zeit nicht bekannt ist.

---

## 9. Versionshistorie

| Version | Aenderung |
|---------|-----------|
| v7.34.0 | v2: synergy-aware Greedy mit Leader-Tier-5-Optimierung, Element-UI-Overlay, Legacy-Fallback. PR #1519. |
| v7.34.7 | v3: Tier-3-Trait-Gruppen-Optimierung, Trait-Matching mit Element-Paaren, Trait-Info-Panel. |
| v7.34.13 | Rarity-Filter: 3-Sterne-Legendaries ausgeschlossen, nur 5* Legendary + 6* Mythic. |
| v7.34.14 | Unified Slot-Fill mit Tier-3-Delta. |
| v7.35.x | Hex-Mapping-Bug, BlessingService-Cache (`Temp_blessingsCache`), kleinere UI-Korrekturen. |
| v7.35.20 | Interim-Versuch: simpler "Top 7 by stats with element-cluster tiebreaker". Wurde durch v7.35.21 ersetzt. |
| v7.35.21 | v4-Algorithmus: main_carac-Score, Klassen-Filter, Klar-Namen via TraitMappings, Cluster-Vergleich nach effective Power, kein Pool-Cap, Equipment-Hinweis (Issues #1340, #1573). |