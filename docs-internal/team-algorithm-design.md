# Team-Algorithmus Design

Implementierung der verbesserten Team-Auswahl (Issue #1340).
Erstellt: 2026-03-24 | Letzte Aktualisierung: 2026-04-07 | Version: 7.34.14

---

## Uebersicht

Der Team-Algorithmus (v3) baut ein optimales 7-Girl-Team mit
Tier-3-Trait-Gruppen-Optimierung, Element-Synergien und Leader-Skill-Bewertung.

```
Legacy-Algorithmus (Fallback):      Aktueller Algorithmus (v3):
  Tooltip-Daten (11 Felder)          availableGirls (62 Felder)
  Score = Stat-Summe                  Score = Stats + Synergie + Trait-Matching
  Top 16 nach Score                   Optimales 7er-Team
  Kein Rarity-Filter                  Nur Mythic (6★) + Legendary (5★)
  Leader = hoechster Score            Leader = bester Tier-5-Skill (Mythic only)
```

### Dateien

| Datei | Zweck |
|-------|-------|
| `src/Service/TeamScoringService.ts` | Scoring-Engine: Tier-3 Traits, Synergien, Tier-5, Stat-Formeln, Rarity-Filter |
| `src/Service/TeamBuilderService.ts` | Team-Builder: Trait-Gruppen, Leader, Slot-Fill |
| `src/Module/TeamModule.ts` | Integration: Dispatch v3/Legacy, Daten-Mapping, UI-Update |
| `spec/Service/TeamScoringService.spec.ts` | 52 Tests |
| `spec/Service/TeamBuilderService.spec.ts` | 14 Tests |

---

## Algorithmus

### Ablauf

```
setTopTeam(mode)
  |
  +-- availableGirls vorhanden?
  |     JA  --> setTopTeamV2(mode, girls)
  |     NEIN -> setTopTeamLegacy(mode)  [alter Code als Fallback]
  |
  +-- setTopTeamV2:
        1. Map availableGirls -> GirlData[]
           (zodiac: substring(3).trim(), hairColor: hair_color1,
            eyeColor: eye_color1, position: position_img ohne .png)
        2. TeamBuilderService.buildTeam(girls, mode, playerLevel)
           a. Filter: Mythic (6★) + Legendary (nur 5★, nicht 3★)
           b. Score alle Kandidaten (Mode 1 oder Mode 2)
           c. Sortiere nach Score, nimm Top 50
           d. Finde beste Trait-Gruppe (Element-Paar + gemeinsamer Trait-Wert)
           e. Leader aus Pool (nur Mythic, Tier-5 Prioritaet)
           f. Slots 2-7: unified Vergleich (Stats + Synergie + Tier-3-Delta)
        3. updateTeamUI(deckID, teamResult)
```

### Phase 1: Rarity-Filter (beide Modi)

```
Mythic (nb_grades = 6):    immer beruecksichtigt
Legendary (nb_grades = 5): beruecksichtigt
Legendary (nb_grades = 3): ausgeschlossen
Alle anderen Raritaeten:   ausgeschlossen
```

### Phase 2: Scoring

#### Modus 1 — "Current Best"

```
Score:   caracs.carac1 + caracs.carac2 + caracs.carac3
         (bereits gesegnete Werte)
```

#### Modus 2 — "Best Possible"

```
Score:   currentStats / level * playerLevel
         / (1 + 0.3 * graded)
         * (1 + 0.3 * nb_grades)
```

Projiziert Stats auf Player-Level mit vollen Grades.

### Phase 3: Trait-Gruppen-Optimierung (Tier 3)

Aus dem Top-50-Pool werden Girls nach Element-Paaren und gemeinsamen
Trait-Werten gruppiert. Die beste Gruppe (mindestens 3 Girls) wird
bevorzugt ins Team aufgenommen.

#### Element-Paare und Trait-Kategorien

| Element-Paar | Trait-Kategorie | Farbe |
|-------------|----------------|-------|
| Darkness + Fire | eyeColor | Schwarz + Rot |
| Light + Nature | hairColor | Weiss + Gruen |
| Stone + Psychic | zodiac | Orange + Lila |
| Water + Sun | position | Blau + Gelb |

#### Trait-Gruppen-Score

```
score = anzahlGirls * durchschnittStats
```

Position-Gruppen erhalten einen Penalty-Faktor von 0.80 (Position-Trait
reduziert Angriffs-Stats durch Equipment).

Fallback: Wenn keine Gruppe mit >= 3 Girls gefunden wird, wird
die groesste eyeColor-Gruppe verwendet.

### Phase 4: Tier-3-Bonus-Berechnung

Jedes Girl im Team prueft, wie viele Teammates den gleichen Trait-Wert
innerhalb des gleichen Element-Paars teilen:

```
Mythic:    1.0% Bonus pro Match
Legendary: 0.8% Bonus pro Match
```

Der Bonus wird pro Girl berechnet und fuer das Team summiert (bis zu ~7%).

### Phase 5: Leader-Auswahl

Leader muss Mythic sein. Ausnahme: wenn keine Mythics vorhanden sind,
werden alle Girls als Fallback betrachtet.

Sortierung der Leader-Kandidaten:

| Prioritaet | Kriterium |
|-----------|----------|
| 1 (primaer) | Tier-5-Skill-Prioritaet (siehe Tabelle) |
| 2 (sekundaer) | Trait-Match (Leader teilt Team-Trait) |
| 3 (tertiaer) | Stat-Score |

| Element | Tier-5 Skill | Prioritaet | ID |
|---------|-------------|------------|----|
| Light / Stone | Shield | 4 (hoechste) | 12 |
| Sun / Darkness | Stun | 3 | 11 |
| Fire / Water | Execute | 2 | 14 |
| Psychic / Nature | Reflect | 1 (niedrigste) | 13 |

**Konsequenz:** Der Leader kann weniger Stat-Punkte haben als andere
Team-Mitglieder. Ein Shield-Leader mit 29.000 Punkten ist staerker
als ein Reflect-Leader mit 31.000 Punkten.

### Phase 6: Unified Slot-Fill (Positionen 2-7)

Fuer jeden Slot werden **alle** verbleibenden Kandidaten im Pool bewertet.
Trait-Gruppen-Girls und Nicht-Gruppen-Girls konkurrieren direkt:

```
combinedScore = synergyScore + tier3Delta

synergyScore  = statScore + synergyWeight * synergyDelta
tier3Delta    = marginalPct * teamStatTotal
```

#### Tier-3-Delta-Berechnung (estimateTier3Delta)

Berechnet den Stat-aequivalenten Wert des marginalen Tier-3-Bonus:

```
existingTraitCount = Anzahl Team-Mitglieder die traitCategory + traitValue matchen
K = existingTraitCount

newGirlBonus  = K * bonusPerMatch(candidate.rarity)
existingBoost = Summe(bonusPerMatch(teammate.rarity)) fuer jeden Trait-Teammate

marginalPct   = newGirlBonus + existingBoost
tier3Delta    = marginalPct * teamStatTotal
```

- Kandidaten die nicht zur Trait-Gruppe gehoeren: `tier3Delta = 0`
- `teamStatTotal` wird pro Slot neu berechnet
- Trait-Girls haben einen Vorteil der mit der Anzahl bestehender
  Trait-Matches quadratisch waechst

**Konsequenz:** Eine Girl mit +40% Blessing-Bonus (z.B. 14.000 Stats)
schlaegt eine Trait-Girl mit 10.000 Stats, wenn der Tier-3-Bonus den
Stat-Gap nicht kompensiert. Umgekehrt gewinnt die Trait-Girl bei
ausreichend vielen Trait-Matches im Team.

**Cold-Start:** Die erste Trait-Girl hat `tier3Delta = 0` (keine
bestehenden Trait-Teammates). Sie muss rein auf Stats und Synergie
konkurrieren. Ab der zweiten Trait-Girl waechst der Bonus.

### Phase 7: UI-Anzeige

- Girls 1-7 mit Element-Emoji und Position
- Leader: `[emoji] ★ [Skill-Name]` (z.B. "✨ ★ Shield")
- Synergie-Info-Panel mit:
  - Trait-Kategorie und -Wert (z.B. "👁 Blue (4/7)")
  - Tier-3-Bonus in Prozent
  - Leader-Skill und Element
  - Element-Verteilung

---

## Element-Synergien

Bonus pro Girl des jeweiligen Elements im Team:

| Element | Anzeige-Name | Bonus pro Girl | Effekt |
|---------|-------------|----------------|--------|
| Fire | Eccentric | **+10%** | Critical Hit Damage |
| Water | Sensual | +3% | Heal on Hit |
| Nature | Exhibitionist | +3% | Ego (HP) |
| Stone | Physical | +2% | Critical Hit Chance |
| Sun | Playful | +2% | Gegner-Defense senken |
| Darkness | Dominatrix | +2% | Damage |
| Psychic | Submissive | +2% | Defense |
| Light | Voyeur | +2% | Harmony |

Fire hat den hoechsten Einzel-Impact (10% vs 2-3%), daher bevorzugt
der Algorithmus Fire-Girls bei aehnlichen Stats.

### Synergie-Value-Berechnung

```typescript
synergyValue = critDamage * 1.0   // Fire: 10% * 1.0
             + critChance * 2.0   // Stone: 2% * 2.0
             + defReduce  * 2.0   // Sun: 2% * 2.0
             + healOnHit  * 1.5   // Water: 3% * 1.5
             + damage     * 1.5   // Darkness: 2% * 1.5
             + ego        * 1.0   // Nature: 3% * 1.0
             + defense    * 1.0   // Psychic: 2% * 1.0
             + harmony    * 1.0   // Light: 2% * 1.0
```

Nur der Team-variable Anteil wird betrachtet. Der Harem-weite Anteil
(basierend auf Gesamtzahl besessener Girls pro Element) ist konstant
und beeinflusst die Team-Optimierung nicht.

---

## Datenquellen

### Primaer: `availableGirls` (Edit Team Page)

Zugriff via `getHHVars("availableGirls")`. 62 Felder pro Girl.
Nur auf der Edit-Team-Seite verfuegbar.

Relevante Felder fuer Team-Selection:

| Feld | Typ | Verwendung |
|------|-----|------------|
| `id_girl` | number | Identifikation |
| `name` | string | Log-Ausgabe |
| `carac1`, `carac2`, `carac3` | number | Stats (gesegnet) |
| `caracs` | object | Alternative Stats-Quelle |
| `element_data.type` | string | Element-Typ |
| `element` | string | Element-Typ (Fallback) |
| `rarity` | string | Rarity-Filter (mythic, legendary) |
| `level` | number | Potential-Berechnung |
| `graded` | number | Aktuelle Grades |
| `nb_grades` | number | Maximale Grades (3, 5 oder 6) — Filterkriterium |
| `zodiac` | string | Tier-3-Trait (Zodiac-Kategorie) |
| `hair_color1` | string | Tier-3-Trait (Hair-Color-Kategorie) |
| `eye_color1` | string | Tier-3-Trait (Eye-Color-Kategorie) |
| `position_img` | string | Tier-3-Trait (Position-Kategorie) |
| `skill_tiers_info` | object | Skill-Daten (aktuell nicht fuer Scoring genutzt) |

### Fallback: Tooltip-Daten

Bei fehlendem `availableGirls` greift der Legacy-Algorithmus auf
`data-new-girl-tooltip` zurueck (11 Felder, DOM-Parsing).
Der Legacy-Algorithmus hat keinen Rarity-Filter und kein Trait-Matching.

---

## Konfiguration

| Parameter | Default | Beschreibung |
|-----------|---------|-------------|
| `synergyWeight` | 0.05 | Gewichtung Synergie vs Stats (0-1) |
| `CANDIDATE_POOL_SIZE` | 50 | Anzahl Top-Kandidaten fuer Greedy |
| `TEAM_SIZE` | 7 | Team-Groesse |
| `POSITION_TRAIT_PENALTY` | 0.80 | Penalty fuer Position-Trait-Gruppen |
| `TIER3_BONUS_MYTHIC` | 0.01 | 1.0% Tier-3-Bonus pro Match (Mythic) |
| `TIER3_BONUS_LEGENDARY` | 0.008 | 0.8% Tier-3-Bonus pro Match (Legendary) |
| `FALLBACK_TRAIT_CATEGORY` | eyeColor | Fallback wenn keine gute Trait-Gruppe gefunden |

Aktuell sind diese Werte als Konstanten in `TeamScoringService.ts` und
`TeamBuilderService.ts` definiert.

---

## Entscheidungen und Begruendungen

### Warum Greedy statt vollstaendige Suche?

Vollstaendige Kombinatorik: C(800, 7) = ~2.3 Billionen Kombinationen.
Greedy ueber 50 Kandidaten: 50+49+48+47+46+45 = 285 Iterationen.
Performance ist kein Problem.

### Warum 5% Synergie-Gewicht?

Bei 5% dominieren Stats noch klar (95%), aber bei aehnlichen Stats
kann die Synergie den Unterschied machen. Bei hoeherem Gewicht wuerden
schwache Girls nur wegen des Elements ins Team gewaehlt.

### Warum kein Domination-Bonus in der Bewertung?

Domination (Element-Dreieck gegen Gegner) erfordert Wissen ueber den
Gegner, das erst auf der Kampf-Seite verfuegbar ist. Die Team-Auswahl
erfolgt aber auf der Edit-Team-Seite, ohne Gegner-Kontext.

### Warum 3-Sterne-Legendaries ausschliessen?

Legendary Girls gibt es mit max 3 oder max 5 Sternen. 3-Sterne-Legendaries
haben deutlich weniger Stat-Potential als 5-Sterne-Legendaries und Mythics.
Sie wuerden nie realistisch in ein optimales Team kommen und vergroessern
nur den Kandidaten-Pool unnoetig.

### Warum Trait-Gruppen vor Stats priorisieren?

Der Tier-3-Bonus (bis zu ~7%) ist ein Team-weiter multiplikativer Bonus.
Ein Team mit guter Trait-Uebereinstimmung kann trotz niedrigerer Einzel-Stats
staerker sein als ein Team mit maximalen Einzel-Stats ohne Trait-Match.

---

## Nicht im Scope (bewusst ausgeschlossen)

| Ausgeschlossen | Grund |
|----------------|-------|
| Gegner-adaptive Team-Auswahl | Gegner nicht im Voraus bekannt |
| BDSM-Simulation pro Kombination | Zu langsam |
| Domination-Optimierung | Gegner-Info erst nach Seitenwechsel |
| Blessing-Vorhersage | Daten verfuegbar, aber Nutzen unklar |
| Equipment-Optimierung | Separates Feature (StuffTeam) |
| Battle-Teams (alle 3 Teams) | Erstmal nur aktives Team |

---

## Offene Punkte / Moegliche Erweiterungen

1. **Synergie-Gewicht konfigurierbar** — per User-Setting (0-20%)
2. **Tier-5 Prioritaet konfigurierbar** — z.B. Stun > Shield je nach Liga
3. **Skill-Points in Bewertung** — `skill_tiers_info[5].skill_points_used`
   ist verfuegbar, wird aber noch nicht fuer die Tier-5-Effektstaerke genutzt
4. **Kampfmodus-spezifische Gewichtung** — Liga vs. Season vs. Troll koennten
   unterschiedliche Synergie-Gewichte haben
5. **Mehrere Teams optimieren** — Battle Teams (alle 3) statt nur aktives Team

---

## Versionshistorie

| Version | Aenderung |
|---------|-----------|
| v7.34.0 | v2: Synergie-optimierter Greedy-Algorithmus mit Leader Tier-5 (PR #1519) |
| v7.34.7 | v3: Tier-3-Trait-Gruppen-Optimierung, Trait-Matching, Trait-Info-Panel |
| v7.34.13 | Rarity-Filter: 3-Sterne-Legendaries ausgeschlossen, nur 5★ Legendary + 6★ Mythic |
| v7.34.14 | Unified Slot-Fill: Trait-Girls vs Nicht-Gruppen-Girls per-Slot-Vergleich mit Tier-3-Delta |
