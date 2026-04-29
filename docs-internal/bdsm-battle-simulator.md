---
last-verified: 2026-04-29
verified-against-version: 7.35.14
status: ok
---

# BDSM Battle Simulator — Technische Referenz

Battle Damage Simulation Model: Probabilistischer Kampfsimulator zur Vorhersage von PvP/PvE-Ergebnissen.
Letzte Aktualisierung: 2026-04-29 (verifiziert gegen v7.35.14; BDSMHelper-Logik unveraendert seit v7.35.10)

---

## Dateien

| Datei | Inhalt |
|-------|--------|
| `src/Helper/BDSMHelper.ts` | Hauptklasse, Domination, Crit-Berechnung, Skill-Schätzung |
| `src/model/BDSMPlayer.ts` | Kampf-Spieler-Modell |
| `src/model/BDSMSimu.ts` | Simulationsergebnis-Modell |

## Aufrufer

| Modul | Funktion | inLeague |
|-------|----------|----------|
| `Module/League.ts` | `getSimPowerOpponent()` | `true` |
| `Module/Events/Season.ts` | Gegner-Simulation (3 Gegner) | `false` |

---

## Datenmodelle

### BDSMPlayer

| Feld | Typ | Quelle | Beschreibung |
|------|-----|--------|--------------|
| `hp` | number | `remaining_ego` | Lebenspunkte (ggf. + Domination-Bonus) |
| `atk` | number | `damage` | Angriff (ggf. + Domination-Bonus) |
| `adv_def` | number | Gegner `defense` | Verteidigung des Gegners (ggf. - defReduce) |
| `critchance` | number | berechnet | Basis-Crit + Domination-Chance + Synergie-Chance |
| `bonuses` | object | `team.synergies` | `{critDamage, critChance, defReduce, healOnHit}` |
| `tier4` | {dmg, def} | geschaetzt | Pro-Runde Skalierungsfaktoren |
| `tier5` | {id, value} | geschaetzt | Leader-Skill (Stun/Shield/Reflect/Execute) |
| `critMultiplier` | number | berechnet | `2 + bonuses.critDamage` |
| `playerShield` | number | runtime | Aktiver Schildwert |
| `stunned` | number | runtime | Verbleibende Stun-Runden |
| `reflect` | number | runtime | Verbleibende Reflect-Runden |

### BDSMSimu

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `win` | number | Gewinnwahrscheinlichkeit (0.0 - 1.0) |
| `loss` | number | Verlustwahrscheinlichkeit (0.0 - 1.0) |
| `points` | {[punkt]: wahrscheinlichkeit} | Verteilung erwarteter Liga-Punkte |
| `scoreClass` | string | `'plus'` (>90%), `'close'` (50-90%), `'minus'` (<50%) |
| `expectedValue` | number | Erwartungswert der Punkte |

---

## Funktionen

### BDSMHelper.getBdsmPlayersData(heroData, opponentData, inLeague)

Baut zwei BDSMPlayer-Objekte aus Roh-Spieldaten.

**Ablauf:**
1. Stats lesen: `damage`, `remaining_ego`, `defense`, `chance`
2. Team-Elemente aus `team.theme_elements` extrahieren
3. Synergy-Boni via `fightBonues(team)` berechnen
4. Domination-Boni via `calculateDominationBonuses()` berechnen
5. Liga-Modifikationen anwenden (nur wenn `inLeague=true`)
6. Tier-4/5 Skills schaetzen

**Liga-spezifische Modifikationen:**

| Stat | Formel |
|------|--------|
| Player HP | `ego * (1 + dominanceBonuses.player.ego)` |
| Player Atk | `atk * (1 + dominanceBonuses.player.attack)` |
| Opponent Def | `playerDef * (1 - opponentBonuses.defReduce)` |

### BDSMHelper.fightBonues(team)

Extrahiert Synergy-Multiplikatoren aus `team.synergies`:

| Element | Synergie-Typ | Kampf-Effekt |
|---------|-------------|--------------|
| Fire (Eccentric) | `critDamage` | Erhoehter Crit-Multiplikator |
| Stone (Exhibitionist) | `critChance` | +% Crit-Chance |
| Sun (Sensual) | `defReduce` | Reduziert gegnerische Verteidigung |
| Water (Voyeur) | `healOnHit` | Heilung pro Treffer (% des Schadens) |

### calculateBattleProbabilities(player, opponent, debug)

Kern-Simulator. Rekursive Vollsimulation aller moeglichen Kampfverlaeufe.

**Algorithmus-Uebersicht:**
```
1. Setup
   - critMultiplier = 2 + critDamage
   - HP aufrunden
   - Tier-5 initialisieren (Runde 1)
     - Player Shield = tier5.value * hp (wenn Shield-Skill)
     - Opponent Stun = 2 Runden (wenn Player Stun-Skill)
     - Player Reflect = 2 Runden (wenn Reflect-Skill)

2. Rekursion: playerTurn -> playerAttack -> opponentTurn -> opponentAttack -> playerTurn...
   - Jede Runde splittet in 2 Aeste: baseAtk + critAtk
   - Ergebnisse probabilistisch gewichtet zusammengefuehrt
   - Max 50 Runden (Sicherung gegen Endlosrekursion)
```

### Schadensformel (calculateDmg)

```
dmg = atk * (1 + tier4.dmg)^turns - adv_def * (1 + tier4.def)^turns
```

- Tier-4-Skills skalieren **exponentiell** mit der Rundenzahl
- Base-Hit: `dmg` mit Wahrscheinlichkeit `(1 - critchance)`
- Crit-Hit: `dmg * critMultiplier` mit Wahrscheinlichkeit `critchance`

### Kampfablauf pro Angriff

```
1. Stun-Check: Wenn gestunnt -> Runde ueberspringen
2. Schaden berechnen: max(0, dmg - gegnerSchild)
3. Schild reduzieren
4. Execute-Check (Tier-5 #14): Gegner-HP unter Schwelle -> sofort tot
5. Reflect-Schaden (Tier-5 #13): % des eingehenden Schadens zurueck
6. Heal-on-Hit: min(maxHP, HP + healOnHit * zugefuegterSchaden)
7. Sieg/Niederlage pruefen oder naechste Runde
```

### Liga-Punkte-Berechnung

| Ergebnis | Formel | Bereich |
|----------|--------|---------|
| Sieg | `min(25, 15 + ceil(10 * verbleibendeHP / maxHP))` | 16-25 |
| Niederlage | `max(3, 3 + ceil(10 * zugefuegterSchaden / gegnerMaxHP))` | 3-13 |

---

## Element-System

### Domination (calculateDominationBonuses)

Jedes Element im Team wird gegen jedes Element des Gegners geprueft.

**Ego/Attack-Dreieck** (je +10% Ego und +10% Attack pro Match):
```
Fire -> Nature -> Stone -> Sun -> Water -> Fire
```

**Chance-Dreieck** (je +20% Crit-Chance pro Match):
```
Darkness -> Light -> Psychic -> Darkness
```

Boni stapeln sich bei mehreren Matches.

### Crit-Chance (calculateCritChanceShare)

```
baseCrit = 0.3 * ownHarmony / (ownHarmony + otherHarmony)
```

Gesamte Crit-Chance eines Spielers:
```
critChance = baseCrit + dominationChanceBonus + synergyCritChance
```

Maximum Basis: 30% (bei unendlich hoher Harmonie-Ueberlegenheit).

---

## Tier-4 Skills (estimateTier4SkillValue)

Geschaetzt aus `skill_tiers_info[4].skill_points_used`:

| Skill | Faktor pro SP | Anwendung |
|-------|--------------|-----------|
| Damage | +0.2% | Exponentiell pro Runde: `atk * (1.002*SP)^turns` |
| Defense | nicht implementiert | Immer 0 |

## Tier-5 Skills (estimateTier5SkillValue)

Nur **Leader** (Girl[0]). Element bestimmt den Skill:

| Element | Skill | ID | Faktor/SP | Effekt |
|---------|-------|----|-----------|--------|
| Sun/Darkness | Stun | 11 | 7% | Gegner verliert Runden |
| Stone/Light | Shield | 12 | 8% | % des Max-HP als Schild |
| Psychic/Nature | Reflect | 13 | 20% | % des Schadens zurueck |
| Fire/Water | Execute | 14 | 8% | Gegner stirbt unter X% HP |

Tier-5 des Gegners wird erst in Runde 1 aktiviert (opponentTurn).

---

## Hilfsfunktionen

### getSkillPercentage(team, id)

Summiert `skills[id].skill.percentage_value` aller Girls. Return: `1 + (Summe/100)`.

---

## Architektur-Hinweise

1. **Kein Monte-Carlo**: Vollstaendige Branch-Exploration mit Wahrscheinlichkeitsgewichtung. Exakt, aber exponentieller Aufwand.
2. **Cache deaktiviert**: Auskommentiert wegen komplexem State (Shield/Stun/Reflect).
3. **Tier-4 Defense ignoriert**: `def`-Wert ist immer 0, nur Damage wird geschaetzt.
4. **Skill-Schaetzung**: Exakte Skill-Daten nicht immer von der API verfuegbar, daher feste Faktoren pro Skill-Punkt.
5. **Asymmetrie Liga vs. Season**: Liga wendet Ego/Attack-Domination-Bonus auf den Player an, Season nicht.
6. **Typo im Original**: `fightBonues` statt `fightBonuses`.
