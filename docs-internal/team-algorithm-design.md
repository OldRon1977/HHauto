---
last-verified: 2026-05-06
verified-against-version: 7.35.24
status: current
---

# Team-Algorithmus Design

Implementierung der League-Team-Auswahl (Issues #1340, #1573).
Letzte grosse Aenderung: 2026-05-05, v7.35.21 (v4-Algorithmus).

---

## Uebersicht

Der Team-Algorithmus baut ein optimales 7-Girl-Team. Quellen sind die
Kinkoid-Performance-Handbooks (Forum-Topics 21217 und 24008), das
HH-Wiki und das Tom-208-Userscript. Anforderungen sind in
`INPUT/league-team-algorithmus-spec.md` konsolidiert.

```
v3 (bis 7.35.19):             v4 (ab 7.35.21):
  Score = caracs_sum            Score = main_carac (HC=c1, Charm=c2, KH=c3)
  Position-Penalty 0.80         entfaellt
  5%-Synergie-Tiebreaker        entfaellt
  Hex-Werte in UI               Klar-Namen via window.GT.design.colors
  Hard-Filter nur Rarity        Hard-Filter Rarity + Klasse
  Trait-Cluster vs Stats        main_sum * (1 + tier3Bonus)
```

### Dateien

| Datei | Zweck |
|-------|-------|
| `src/Service/TeamScoringService.ts` | Scoring, Klassen-Filter, Tier-3-Bonus, Synergien, Tier-5, Leader-Ranking |
| `src/Service/TeamBuilderService.ts` | Team-Builder: Cluster-Vergleich, Slot-Fill, Alternativen-Liste |
| `src/Service/TraitMappings.ts` | Hex/Position/Zodiac -> Klar-Namen mit Runtime + Hardcoded Fallback |
| `src/Module/TeamModule.ts` | Integration: Dispatch v4/Legacy, Daten-Mapping, UI-Box |
| `spec/Service/TeamScoringService.spec.ts` | Unit-Tests Scoring |
| `spec/Service/TeamBuilderService.spec.ts` | Unit-Tests Builder |

---

## Anforderungen (aus League-Spec)

| Punkt | Regel |
|-------|-------|
| Pool-Filter | Mythic (6*) + Legendary 5* |
| Klassen-Filter | Hart auf player.class (1=HC, 2=Charm, 3=KH); cross-class wird verworfen |
| Score | main_carac der Spielerklasse, nicht caracs_sum |
| Trait-Cluster | Bestes Element-Paar nach `main_sum * (1 + tier3Bonus)` |
| Leader | Mythic, Tier-5 Shield > Stun > Execute > Reflect, Tiebreaker = Trait-Match |
| Blessing-Heuristik | Aktiv-blessed Trait-Kategorie kriegt x1.5 fuer fruehere Auswahl |
| Tier-3-Bonus | 1.0% Mythic / 0.8% Legendary pro Trait-Match-Teammate |
| Mono-Element-Synergie | linear pro Girl im Team (informational, nicht im Score) |
| Equipment | KEIN Unequip noetig: `availableGirls.caracs` ist equipment-frei |
| UI-Hinweis | "Stats are equipment-free. Hit Stuff Team after applying." |
| Klar-Namen | window.GT.design.colors mit Hardcoded EN-Fallback |

---

## Algorithmus

### Ablauf

```
setTopTeam(mode)
  |
  +- availableGirls vorhanden?
  |    JA  -> setTopTeamV2(mode, girls)
  |    NEIN -> setTopTeamLegacy(mode)  [DOM-basierter Fallback]
  |
  +- setTopTeamV2:
      1. HeroHelper.getClass() -> playerClass (1, 2 oder 3)
      2. Map availableGirls -> GirlData[]
         (zodiac roh halten, Position als Nummer, Hex-Werte 1:1)
      3. TeamBuilderService.buildTeam(girls, mode, playerLevel, playerClass)
         a. filterEligible: Mythic/Legendary 5* AND class === playerClass
         b. Score alle Kandidaten ueber main_carac (Mode 1 oder 2)
         c. Sortiere alle eligible Girls (kein Cap)
         d. detectBlessedTraits ueber blessing_bonuses
         e. findTraitGroups (mit Blessed-Boost x1.5)
         f. Top 5 Gruppen + alle blessed Gruppen evaluieren
         g. Pro Gruppe Team bauen, vergleiche `main_sum * (1 + tier3Bonus)`
         h. Beste Gruppe gewinnt
      4. updateTeamUI(deckID, teamResult): Klar-Namen, Klasse, Equipment-Hinweis
```

### Phase 1: Filter

```
class === playerClass?         hart, sonst raus
rarity === 'mythic'             ja
rarity === 'legendary' 5*       ja
sonst                            raus
```

### Phase 2: Scoring

#### Modus 1 -- "Current Best"

```
score = caracs.caracN     (N = playerClass)
        // bereits gesegnet, equipment-frei
```

#### Modus 2 -- "Best Possible"

Projektion auf den Awakening-Cap (`PROJECTION_LEVEL_CAP = 750`), nicht auf das aktuelle Spieler-Level. Per Kinkoid-Patchnotes kann jedes Girl ab Level 1 bis 750 awakened werden -- der Modus beantwortet "was waere die Girl wert, wenn sie voll entwickelt waere", unabhaengig davon was der Spieler aktuell erreichen kann.

```
projected = caracN / level * 750
            / (1 + 0.3 * graded)
            * (1 + 0.3 * nb_grades)

score = max(projected, current_caracN)
        // Schutz gegen blessing-inflated current > projected
```

`playerLevel` ist nicht mehr Teil der Formel. Vor v7.35.24 wurde
`playerLevel` als Projektions-Ziel verwendet, was bei awakened
Girls (`level == 750`) und Spielern unter Cap (`playerLevel < 750`)
dazu fuehrte dass `projected < current` und der `max()`-Guard
zurueck auf `current` snappte -- der Modus kollabierte zu Mode 1
(Issue #1603).

### Phase 3: Trait-Gruppen

Aus allen eligible Girls (kein Pool-Cap) werden Girls nach Element-Paar und gemeinsamem
Trait-Wert gruppiert. Gruppen-Score:

```
score = anzahlGirls * avg(main_carac)
score *= 1.5  wenn traitCategory in blessedCategories
```

#### Element-Paare und Trait-Kategorien

| Element-Paar | Trait-Kategorie | Hex-Beispiele |
|-------------|----------------|---------------|
| Darkness + Fire | eyeColor | 00F, A55, F00 |
| Light + Nature | hairColor | FFF, 0F0, B62 |
| Stone + Psychic | zodiac | "Aries", "Cancer" |
| Water + Sun | position | 1, 2, ... 12 |

### Phase 4: Cluster-Vergleich

Fuer jede Top-Gruppe wird ein vollstaendiges Team gebaut und
nach effektiver Power verglichen:

```
effectivePower = round(main_sum * (1 + tier3Bonus))

main_sum     = Summe der main_carac-Scores aller 7 Team-Mitglieder
tier3Bonus   = Summe ueber alle Mitglieder von:
                 matchCount(member) * (member.rarity === 'mythic' ? 0.01 : 0.008)
```

Die Gruppe mit hoechster `effectivePower` gewinnt. Alle evaluierten
Alternativen landen in `result.alternatives` fuer die UI-Anzeige.

### Phase 5: Slot-Fill (innerhalb einer Gruppe)

Drei Pass-Strategie pro Cluster:

| Pass | Filter | Sortiert nach |
|------|--------|---------------|
| 1 | Element gehoert zum Cluster-Paar UND traitValue matcht | main_carac desc |
| 2 | Element gehoert zum Cluster-Paar (beliebiger trait) | main_carac desc |
| 3 | beliebiges Element | main_carac desc |

Pass 1 maximiert Tier-3-Match. Pass 2 haelt das Mono-Element-Bonus.
Pass 3 ist nur Reserve, falls die Gruppe weniger als 7 Girls hat.

### Phase 6: Leader (ab v7.35.23: global)

Leader (Position 1) wird **global** gepickt, nicht Cluster-gebunden. Tier-5-Prio gilt fuer alle Mythics, unabhaengig von der Cluster-Wahl. Slots 2-7 bleiben weiterhin Cluster-gebunden (Phase 5).

| Prioritaet | Kriterium |
|-----------|----------|
| 1 (primaer) | Mythic-Filter (mit Legendary-Fallback fuer Beginner-Pools) |
| 2 (sekundaer) | Tier-5-Skill: Shield(4) > Stun(3) > Execute(2) > Reflect(1) - **GLOBAL** ueber alle Elemente |
| 3 (tertiaer) | Cluster-Mitgliedschaft (Leader-Element gehoert zum Cluster-Paar) - Tiebreaker bei gleicher Tier-5-Prio |
| 4 (quartaer) | Trait-Match (Leader teilt Cluster-Trait-Wert) |
| 5 (final) | main_carac-Score |

Beispiel: Cluster ist `eyeColor=Blue` (Element-Paar darkness+fire). Spieler hat eine Light-Mythic (Shield, Prio 4). Leader wird die Light-Mythic, obwohl sie nicht im Cluster ist - der Shield-Skill ist im Combat wichtiger als ein zusaetzlicher Trait-Match. Slots 2-7 bleiben darkness/fire-Girls aus dem Cluster.

#### Sonderfall: Beginner-Pool ohne Mythics

Wenn 0 Mythics existieren, faellt das Skript auf Legendary 5*-Girls zurueck. Da Legendaries praktisch nie aktive Tier-5-Skills haben (`skill_points_used == 0`), waere die Tier-5-Sortierung wirkungslos. Stattdessen gilt fuer Legendary-Leader:

| Prioritaet | Kriterium |
|-----------|----------|
| 1 | Cluster-Mitgliedschaft |
| 2 | Trait-Match |
| 3 | main_carac-Score |

| Element | Tier-5 Skill | Prioritaet |
|---------|-------------|------------|
| Light, Stone | Shield | 4 |
| Sun, Darkness | Stun | 3 |
| Fire, Water | Execute | 2 |
| Psychic, Nature | Reflect | 1 |

### Phase 7: UI

Info-Box (oben mittig, dunkel, halbtransparent):

- Klassen-Hinweis: "Class: <Hardcore/Charm/Know-how> -- only X girls considered"
- Trait optimiert: "[emoji] eyeColor = 'Blue' (4/7 girls match)"
- Tier-3-Bonus: "+X.X% total stat boost"
- Leader-Block (Position 1): Name + Tier-5-Skill + Element-Klasse + Hinweis bei Cross-Cluster
- Cluster-Block (Positions 2-7): Trait, Element-Paar, Tier-3-Bonus, Effective Power
- Element-Verteilung: "Eccentric x3, Sensual x2, ..."
- Effective Power
- Active Blessings + Match-Indikator
- Compared: Liste der evaluierten Cluster-Alternativen mit Power
- Equipment-Hinweis: "Stats are equipment-free. Hit Stuff Team after applying."
- Mode-Hinweis: aktueller Modus (Current Best vs. Best Possible)
- Mode-Diff: Hinweis "Best Possible matches Current Best" wenn beide Modi dieselben Top-7-Girls liefern (Pool ist bereits voll entwickelt)

Klar-Namen via `TraitMappings.resolve(category, value)`. Wenn der
Runtime-Lookup fehlschlaegt (z.B. GT nicht geladen), erscheint ein
Hinweis "Trait label uses fallback dictionary -- may be inaccurate
for new color codes".

---

## Klar-Namen-Mapping (TraitMappings)

Quelle: Tom-208-Userscript (`gist a5c7065866fe1de5032aabbbd1ed9eff`),
identisch mit `window.GT.design.colors`.

### Lookup-Reihenfolge

1. `unsafeWindow.GT.design.colors[hex]` (live, immer aktuell)
2. Hardcoded EN-Fallback in `TraitMappings.ts`
3. `'#' + hex` als letzter Fallback (z.B. `#765` wenn neue Farbe)

### Fallback-Tabelle (Eye + Hair Colors)

```
F99 -> Pink         B06 -> Dark Pink     F00 -> Red
B62 -> Dark blond   FFF -> White         321 -> Dark
00F -> Blue         FF0 -> Blond         0F0 -> Green
A55 -> Brown        000 -> Black         CCC -> Silver
F0F -> Purple       F90 -> Orange        EB8 -> Strawberry blonde
888 -> Grey         FD0 -> Golden        D83 -> Bronze
765 -> Ash brown    XXX -> Unknown
```

### Position

```
position_img = "1.png" .. "12.png"
-> Runtime: window.GT.design.figures[1..12]  ("Doggy", "69", ...)
-> Fallback: "Pose 1" .. "Pose 12"
```

### Zodiac

`"♈︎ Aries"` -> strip leading non-letters -> `"Aries"`. Keine Hex-Werte,
daher Fallback identisch zur Live-Variante.

---

## Element-Synergien (informational)

Mono-Element-Bonus pro Girl im Team. Wird im Score nicht angewendet
(der Klar-Filter auf main_carac und Tier-3-Bonus genuegen), aber im
UI angezeigt:

| Element | Klassen-Name | Bonus pro Girl | Effekt |
|---------|-------------|----------------|--------|
| Fire | Eccentric | +10% | Crit Damage |
| Water | Sensual | +3% | Heal on Hit |
| Nature | Exhibitionist | +3% | Ego (HP) |
| Stone | Physical | +2% | Crit Chance |
| Sun | Playful | +2% | Defense Reduction |
| Darkness | Dominatrix | +2% | Damage |
| Psychic | Submissive | +2% | Defense |
| Light | Voyeur | +2% | Harmony |

Quelle: Performance Handbook, bestaetigt durch Tom-208 Battle-Sim
(`hero_data.team_synergies` Live-Werte).

---

## Datenfelder

### `availableGirls` Felder

Verfuegbar nur auf der Edit-Team-Seite. Zugriff via `getHHVars("availableGirls")`.

| Feld | Typ | Verwendung in v4 |
|------|-----|------------------|
| `id_girl` | number | Identifikation |
| `name` | string | UI/Log |
| `caracs.carac1/2/3` | number | Score (equipment-frei) |
| `class` | number | Klassen-Filter (1, 2, 3) |
| `element_data.type` | string | Element-Cluster |
| `rarity` | string | Rarity-Filter |
| `level`, `graded`, `nb_grades` | number | Best-Possible-Projektion |
| `eye_color1` | string | eyeColor-Trait (3-char Hex) |
| `hair_color1` | string | hairColor-Trait (3-char Hex) |
| `zodiac` | string | zodiac-Trait (Glyph + Name) |
| `position_img` | string | position-Trait ("N.png") |
| `blessing_bonuses` | object | Blessed-Categories-Erkennung |

### Equipment-Status

Verifiziert per Dump-Vergleich (2026-05-05):

```
teamGirls.blessed_caracs == availableGirls.caracs
```

`caracs` ist gesegnet aber **ohne Equipment**. Daher ist KEIN Unequip
vor der Berechnung noetig. Stuff-Team danach ist trotzdem sinnvoll
(Equipment fuegt 20-40% obendrauf).

---

## Konfiguration

| Parameter | Default | Datei | Beschreibung |
|-----------|---------|-------|-------------|
| (kein Pool-Cap) | -- | TeamBuilderService.ts | Alle eligible Girls werden bewertet; der Klassen+Rarity-Filter ist bereits scharf (max ~170 pro Klasse spielweit) |
| `TEAM_SIZE` | 7 | TeamBuilderService.ts | Team-Groesse |
| `TIER3_BONUS_MYTHIC` | 0.01 | TeamScoringService.ts | 1.0% Bonus pro Match |
| `TIER3_BONUS_LEGENDARY` | 0.008 | TeamScoringService.ts | 0.8% Bonus pro Match |
| `BLESSED_CATEGORY_BOOST` | 1.5 | TeamScoringService.ts | Heuristik-Multiplikator fuer blessed Cluster |
| `PROJECTION_LEVEL_CAP` | 750 | TeamScoringService.ts | Projektions-Ziel fuer Mode 2 (Awakening-Cap, ab v7.35.24) |

---

## Entscheidungen und Begruendungen

### Warum hard class filter?

Wiki und Tom-208 sind eindeutig: niemals quer-bauen. Fuer einen
KH-Spieler (class=3) ist nur carac3 relevant. KH-Mythics (z.B. Elphiba
sum=22698, c3=12128) schlagen Cross-Class HC-Mythics (Cumkai sum=36644,
c3=10985) bei der KH-relevanten Bewertung.

Datenbasis: KH-only main_sum 82120 vs. cross-class 54351 (+57%).

### Warum main_carac statt caracs_sum?

caracs_sum ueberbewertet Cross-Class-Stats. Ein KH-Spieler profitiert
nicht von hohen carac1/c2-Werten -- die werden im Kampf gegen die
gleiche Klasse vom Gegner ueberbietbar. Der spielrelevante Wert ist
allein der Klassen-Hauptstat.

### Warum kein Position-Penalty mehr?

Der Penalty kompensierte falsche Cluster-Vergleiche im alten Algorithmus.
v4 vergleicht Cluster direkt nach effektiver Power -- wenn Position
schlechter ist, gewinnt sie nicht. Wenn sie besser ist (z.B. weil dort
viele Mythics sind), darf sie gewinnen.

### Warum kein 5% Synergie-Tiebreaker?

Mono-Element-Synergie ist linear: jede Fire-Girl gibt +10% Crit-Damage.
Diese Information ist im Cluster-Vergleich implizit enthalten (gleicher
Element-Cluster = gleiche Synergie). Im Score brauchen wir das nicht.

### Warum kein Unequip vor der Berechnung?

`availableGirls.caracs` ist im Dump verifiziert equipment-frei. Ein
Unequip wuerde nur Reload-Zeit kosten, ohne die Auswahl zu aendern.

### Warum Klar-Namen aus window.GT statt Hardcode-Only?

Patches koennten neue Farben (z.B. `765 = Ash brown`) einfuehren.
Runtime-Lookup deckt das automatisch ab. Hardcode dient nur als
Fallback fuer Spec-Tests und den Fall dass GT noch nicht geladen ist.

---

## Nicht im Scope

| Ausgeschlossen | Grund |
|----------------|-------|
| Gegner-adaptive Auswahl | Gegner erst auf Battle-Seite bekannt |
| BDSM-Simulation pro Kombo | Zu langsam, Gegner-Info fehlt |
| Domination-Optimierung | Gegner-Klasse erst nach Seitenwechsel |
| Equipment-Optimierung | Separates Feature (StuffTeam) |
| Battle-Teams (alle 3) | Nur aktives Team wird optimiert |
| Booster-Auswahl | Separates Feature |

---

## Versionshistorie

| Version | Aenderung |
|---------|-----------|
| 7.34.0 | v2: Synergie-Greedy + Leader Tier-5 (PR #1519) |
| 7.34.7 | v3: Trait-Gruppen-Optimierung, Trait-Info-Panel |
| 7.34.13 | Rarity-Filter: 3-Sterne-Legendaries ausgeschlossen |
| 7.34.14 | Unified Slot-Fill mit Tier-3-Delta |
| 7.35.x | Hex-Mapping-Bug, BlessingService-Cache |
| 7.35.21 | v4: main_carac-Score, Klassen-Filter, Klar-Namen, Equipment-Hinweis (Issues #1340, #1573) |
| 7.35.23 | Leader global gepickt (Tier-5 ueber alle Mythics), Mode-Diff-Detection, Beginner-Pool ohne Mythics (Issues #1573, #1603) |
| 7.35.24 | Best-Possible projiziert auf Awakening-Cap 750 statt playerLevel (Issue #1603) |