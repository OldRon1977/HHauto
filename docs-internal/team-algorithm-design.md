# Team-Algorithmus Design

Implementierung der verbesserten Team-Auswahl (Issue #1340, PR #1519).
Erstellt: 2026-03-24 | Implementiert: 2026-03-28 | Version: 7.34.0

---

## Uebersicht

Der neue Team-Algorithmus ersetzt das alte Top-16-Stat-Ranking durch eine
synergie-optimierte 7-Girl-Team-Komposition mit Leader-Skill-Bewertung.

```
Alter Algorithmus (v1):             Neuer Algorithmus (v2):
  Tooltip-Daten (11 Felder)          availableGirls (62 Felder)
  Score = Stat-Summe                  Score = Stats + Synergie-Bonus
  Top 16 nach Score                   Optimales 7er-Team
  Leader = hoechster Score            Leader = bester Tier-5-Skill
```

### Dateien

| Datei | Zweck |
|-------|-------|
| `src/Service/TeamScoringService.ts` | Scoring-Engine: Synergien, Tier-5, Stat-Formeln |
| `src/Service/TeamBuilderService.ts` | Greedy Team-Builder: Leader + Slot-Fill |
| `src/Module/TeamModule.ts` | Integration: Dispatch v2/Legacy, UI-Update |
| `spec/Service/TeamScoringService.spec.ts` | 27 Tests |
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
        2. TeamBuilderService.buildTeam(girls, mode, playerLevel)
           a. Filter (Mode 1: Mythic+Legendary | Mode 2: alle)
           b. Score alle Kandidaten
           c. Sortiere nach Score, nimm Top 50
           d. Leader aus Top 25 (Tier-5 Prioritaet)
           e. Slots 2-7: Greedy mit Synergie-Gewichtung
        3. updateTeamUI(deckID, teamResult)
```

### Phase 1: Scoring

#### Modus 1 — "Current Best"

```
Filter:  Nur mythic + legendary
Score:   caracs.carac1 + caracs.carac2 + caracs.carac3
         (bereits gesegnete Werte)
```

#### Modus 2 — "Best Possible"

```
Filter:  Alle Girls (inkl. Level 1)
Score:   currentStats / level * playerLevel
         / (1 + 0.3 * graded)
         * (1 + 0.3 * nb_grades)
```

### Phase 2: Leader-Auswahl

Aus den Top 25 nach Score wird der Leader nach Tier-5-Skill-Prioritaet
gewaehlt. Bei gleicher Prioritaet entscheidet der hoehere Score.

| Element | Tier-5 Skill | Prioritaet | ID |
|---------|-------------|------------|----|
| Fire / Water | Execute | 4 (hoechste) | 14 |
| Sun / Darkness | Stun | 3 | 11 |
| Stone / Light | Shield | 2 | 12 |
| Psychic / Nature | Reflect | 1 (niedrigste) | 13 |

**Konsequenz:** Der Leader kann weniger Stat-Punkte haben als andere
Team-Mitglieder. Ein Execute-Leader mit 29.000 Punkten ist staerker
als ein Reflect-Leader mit 31.000 Punkten.

### Phase 3: Greedy Slot-Fill (Positionen 2-7)

Fuer jeden freien Slot wird aus dem verbleibenden Pool (Top 50 minus
bereits gewaehlt) das Girl gewaehlt, das den hoechsten Combined-Score hat:

```
combinedScore = statScore + synergyWeight * synergyDelta
```

- `statScore`: Individueller Score (Mode 1 oder Mode 2)
- `synergyDelta`: Verbesserung des Team-Synergie-Werts durch dieses Girl
- `synergyWeight`: Default 0.05 (5%)

### Phase 4: UI-Anzeige

- Girls 1-7 mit Element-Emoji und Position
- Leader: `[emoji] ★ [Skill-Name]` (z.B. "🔥 ★ Execute")
- Synergie-Info-Panel mit Leader-Skill und Element-Verteilung

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
| `rarity` | string | Rarity-Filter |
| `level` | number | Potential-Berechnung |
| `graded` | number | Aktuelle Grades |
| `nb_grades` | number | Maximale Grades |
| `skill_tiers_info` | object | Skill-Daten (aktuell nicht genutzt) |

### Fallback: Tooltip-Daten

Bei fehlendem `availableGirls` greift der Legacy-Algorithmus auf
`data-new-girl-tooltip` zurueck (11 Felder, DOM-Parsing).

---

## Konfiguration

| Parameter | Default | Beschreibung |
|-----------|---------|-------------|
| `synergyWeight` | 0.05 | Gewichtung Synergie vs Stats (0-1) |
| `CANDIDATE_POOL_SIZE` | 50 | Anzahl Top-Kandidaten fuer Greedy |
| `LEADER_POOL_SIZE` | 25 | Anzahl Leader-Kandidaten |
| `TEAM_SIZE` | 7 | Team-Groesse |

Aktuell sind diese Werte als Konstanten in `TeamBuilderService.ts`
definiert. Spaeter koennen `synergyWeight` und `LEADER_POOL_SIZE`
per User-Setting konfigurierbar gemacht werden.

---

## Entscheidungen und Begruendungen

### Warum Greedy statt vollstaendige Suche?

Vollstaendige Kombinatorik: C(800, 7) = ~2.3 Billionen Kombinationen.
Greedy ueber 50 Kandidaten: 50+49+48+47+46+45 = 285 Iterationen.
Performance ist kein Problem.

### Warum Top 25 fuer Leader statt Top 10?

Urspruenglicher Entwurf hatte Top 10. Auf Nutzerwunsch auf 25 erhoeht,
damit mehr Element-Vielfalt bei der Leader-Auswahl beruecksichtigt wird.

### Warum 5% Synergie-Gewicht?

Bei 5% dominieren Stats noch klar (95%), aber bei aehnlichen Stats
kann die Synergie den Unterschied machen. Bei hoeherem Gewicht wuerden
schwache Girls nur wegen des Elements ins Team gewaehlt.

### Warum kein Domination-Bonus in der Bewertung?

Domination (Element-Dreieck gegen Gegner) erfordert Wissen ueber den
Gegner, das erst auf der Kampf-Seite verfuegbar ist. Die Team-Auswahl
erfolgt aber auf der Edit-Team-Seite, ohne Gegner-Kontext.

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
2. **Tier-5 Prioritaet konfigurierbar** — z.B. Stun > Execute je nach Liga
3. **Skill-Points in Bewertung** — `skill_tiers_info[5].skill_points_used`
   ist verfuegbar, wird aber noch nicht fuer die Tier-5-Effektstaerke genutzt
4. **Kampfmodus-spezifische Gewichtung** — Liga vs. Season vs. Troll koennten
   unterschiedliche Synergie-Gewichte haben
5. **Mehre Teams optimieren** — Battle Teams (alle 3) statt nur aktives Team
