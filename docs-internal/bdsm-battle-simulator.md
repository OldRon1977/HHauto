---
last-verified: 2026-05-05
verified-against-version: 7.35.21
status: current
---

# BDSM Battle Simulator -- Technische Referenz

Battle Damage Simulation Model: Probabilistischer Kampfsimulator zur Vorhersage von League- und Season-Kampfausgaengen.
Letzte vollstaendige Verifikation: 2026-05-05 gegen v7.35.21.

---

## Dateien

| Datei | Inhalt |
|-------|--------|
| `src/Helper/BDSMHelper.ts` | Hauptklasse, Domination, Crit-Berechnung, Tier-4/5-Skill-Schaetzung, Battle-Simulation |
| `src/model/BDSMPlayer.ts` | Kampf-Spieler-Modell |
| `src/model/BDSMSimu.ts` | Simulationsergebnis-Modell |

## Aufrufer

| Modul | Funktion | inLeague-Flag |
|-------|----------|---------------|
| `Module/League.ts` | `getSimPowerOpponent()` | `true` |
| `Module/Events/Season.ts` | Gegner-Simulation (3 Gegner) | `false` (Default) |

Die Liga-Simulation wendet zusaetzlich Element-Domination-Boni auf Ego, Attack und Defense an. Im Season-Modus werden die Boni weggelassen -- die Roh-Stats werden direkt simuliert.

---

## Datenmodelle

### `BDSMPlayer`

Datei: `src/model/BDSMPlayer.ts`. Die im Konstruktor uebergebenen Werte werden 1:1 als Felder gespeichert.

| Feld | Typ | Quelle | Beschreibung |
|------|-----|--------|--------------|
| `hp` | number | `remaining_ego` (ggf. * Domination-Bonus) | Aktuelle Lebenspunkte |
| `atk` | number | `damage` (ggf. * Domination-Bonus) | Angriff |
| `adv_def` | number | Gegner-`defense` (ggf. * (1 - defReduce)) | Verteidigung der Gegenseite |
| `critchance` | number | `calculateCritChanceShare + dominationChance + synergyCritChance` | Crit-Chance |
| `bonuses` | any | `fightBonues(team)` | Synergie-Multiplikatoren `{critDamage, critChance, defReduce, healOnHit}` |
| `tier4` | any | `estimateTier4SkillValue` | Pro-Runde-Skalierungsfaktoren `{dmg, def}` |
| `tier5` | any | `estimateTier5SkillValue` | Leader-Skill `{id, value}` |
| `name` | string | `nickname` | Anzeigename |

Zusaetzliche Laufzeit-Felder werden in `calculateBattleProbabilities` initialisiert:

| Feld | Initialisierung | Bedeutung |
|------|-----------------|-----------|
| `playerShield` | `tier5.id == 12 ? tier5.value * hp : 0` | Shield-Wert (nur Leader-Element light/stone) |
| `opponentShield` | wird im `opponentTurn` (Runde 1) gesetzt | Schild des Gegners aus dessen Tier-5 |
| `stunned` | `tier5.id == 11 ? 2 : 0` (auf der Gegenseite) | verbleibende Stun-Runden |
| `alreadyStunned` | 0 | nicht aktiv genutzt |
| `reflect` | `tier5.id == 13 ? 2 : 0` | verbleibende Reflect-Runden |
| `critMultiplier` | `2 + bonuses.critDamage` | Crit-Schadensfaktor |

### `BDSMSimu`

Datei: `src/model/BDSMSimu.ts`. Der Konstruktor nimmt `(points, win, loss, scoreClass)` entgegen, das Feld `expectedValue` ist mit `0` initialisiert und wird vom Simulator aktuell **nicht gesetzt** -- Aufrufer berechnen es bei Bedarf selbst.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `points` | `{[punkt]: wahrscheinlichkeit}` | Verteilung erwarteter Liga-/Season-Punkte |
| `win` | number | Gewinnwahrscheinlichkeit (0.0 - 1.0) |
| `loss` | number | Verlustwahrscheinlichkeit (0.0 - 1.0) |
| `scoreClass` | string | `'plus'` (win > 0.9), `'close'` (0.5..0.9), `'minus'` (< 0.5) |
| `expectedValue` | number | Default 0; vom Simulator nicht populiert |

---

## Element-System

HHAuto kennt **8 Elemente** (kein `electric`). Die Domination-Logik in `BDSMHelper.ELEMENTS` arbeitet mit zwei separaten Cycles:

### `egoDamage`-Cycle (5 Elemente)

Bei Match: pro getroffenem Gegner-Element +10% Ego UND +10% Attack auf der eigenen Seite.

```
fire -> nature -> stone -> sun -> water -> fire
```

| Element dominiert -> | wird besiegt von |
|---|---|
| fire | nature |
| nature | stone |
| stone | sun |
| sun | water |
| water | fire |

### `chance`-Cycle (3 Elemente)

Bei Match: pro getroffenem Gegner-Element +20% Crit-Chance auf der eigenen Seite.

```
darkness -> light -> psychic -> darkness
```

| Element dominiert -> | wird besiegt von |
|---|---|
| darkness | light |
| light | psychic |
| psychic | darkness |

### Element -> Klassen-Anzeigename (aus `BlessingService.ts` / `TeamModule.ts`)

| Element | Klassen-Name (UI) |
|---------|--------------------|
| fire | Eccentric |
| water | Sensual |
| nature | Exhibitionist |
| stone | Physical |
| sun | Playful |
| darkness | Dominatrix |
| psychic | Submissive |
| light | Voyeur |

**Achtung Verwechslungsgefahr:** "Klasse" ist hier doppeldeutig. Es gibt zwei Begriffe:

- **Player-Klasse:** Hardcore (1) / Charm (2) / Know-how (3) -- wird von `Hero.infos.class` ausgelesen.
- **Girl-Element-Klasse:** Eccentric / Sensual / Exhibitionist / ... -- ist nur eine UI-Bezeichnung des Girl-Elements.

Die BDSM-Domination wirkt allein auf Element-Ebene, **nicht** auf Player-Klassen-Ebene. Bonus-Berechnung in `calculateDominationBonuses` zaehlt Matches zwischen Player-Team-Elementen und Gegner-Team-Elementen.

### Stacking

Boni stapeln sich linear, wenn mehrere Element-Matches existieren. Beispiel: Player-Team hat 3x fire, Gegner hat 2x nature -- der Bonus wird trotzdem nur einmal pro Player-Element-Vorkommen vergeben:

```javascript
a.forEach(element => {  // Player-Element
    if (b.includes(...)) {  // Gegner hat Counter
        bonuses[k].ego += 0.1
        bonuses[k].attack += 0.1
    }
})
```

`a.forEach` iteriert alle Player-Elemente einzeln, `b.includes` prueft nur auf Existenz. **Drei fire-Girls geben dreimal +10%, ein nature-Girl beim Gegner reicht.**

---

## Synergien (`fightBonues`)

> Hinweis: Die Methode heisst im Code wirklich `fightBonues` (Tippfehler -- `bon`**`ues`** statt `bon`**`uses`**). Bei Refactor ueberall gleichzeitig korrigieren.

Liest pro Element den Synergie-Multiplikator aus `team.synergies`:

| Element | Synergie-Feld in BDSM | Kampfeffekt |
|---------|-----------------------|-------------|
| fire | `critDamage` | erhoeht den Crit-Schadensfaktor |
| stone | `critChance` | additive Erhoehung der Crit-Chance |
| sun | `defReduce` | reduziert die gegnerische Verteidigung (nur League) |
| water | `healOnHit` | Heilung pro getroffenem Schadenstick (% des Schadens) |

Andere Elemente haben in dieser Engine keine direkt simulierte Synergie-Wirkung. Ihre Team-Synergien werden in den Roh-Stats des Spielers vom Game-Server bereits eingerechnet und kommen ueber `damage`, `defense`, `remaining_ego`, `chance` in die Simulation.

---

## Stat-Berechnung (`getBdsmPlayersData`)

### Player-seitig

```
playerCrit = chance
critChance = calculateCritChanceShare(playerCrit, opponentCrit)
           + dominationBonuses.player.chance
           + playerBonuses.critChance

if (inLeague):
    hp  = remaining_ego * (1 + dominationBonuses.player.ego)
    atk = damage        * (1 + dominationBonuses.player.attack)
    adv_def = opponentDef    // unmodifiziert in Player-Sicht
else:
    hp  = remaining_ego
    atk = damage
    adv_def = opponentDef
```

### Gegner-seitig (in Player-Sicht)

```
if (inLeague):
    opponent.adv_def = playerDef * (1 - opponentBonuses.defReduce)
else:
    opponent.adv_def = playerDef    // unmodifiziert
```

Die Asymmetrie ist gewollt: League wendet Domination-Bonus auf Player-Ego/Attack an UND gegner-`defReduce` auf Player-Defense -- Season nicht. Beide Modi addieren aber Domination-Crit-Boni.

### Crit-Chance-Formel

```typescript
calculateCritChanceShare(ownHarmony, otherHarmony)
    = 0.3 * ownHarmony / (ownHarmony + otherHarmony)
```

Maximum theoretischer Basis-Crit: 30% (bei `ownHarmony >> otherHarmony`).

---

## Tier-4 Skills (`estimateTier4SkillValue`)

Liest `team.girls[i].skill_tiers_info[4].skill_points_used`, summiert alle Punkte und multipliziert mit `0.002`.

| Skill | Faktor pro skill_points_used | Anwendung |
|-------|------------------------------|-----------|
| Damage | +0.2% | wird im Schadensfall **exponentiell** mit der Rundenzahl multipliziert: `atk * (1 + tier4.dmg)^turns` |
| Defense | nicht implementiert | Code initialisiert `def: 0` und addiert nichts -- Tier-4-Defense-Skills werden ignoriert |

Die alte `calculateTier4SkillValue`-Funktion (auskommentiert) haette beide Tier-4-Skills (Index 9 = dmg, Index 10 = def) gelesen, ist aber nicht aktiv.

---

## Tier-5 Skills (`estimateTier5SkillValue`)

Liest `skill_tiers_info[5].skill_points_used` der **ersten Girl im Team** (`team.girls[0]`, der Leader). Die Skill-Wirkung haengt vom Element des Leaders ab:

| Element des Leaders | Skill | id | Faktor pro skill_points_used | Effekt |
|---------------------|-------|----|-----------------------------:|--------|
| sun, darkness | Stun | 11 | 7% | Gegner verliert Runden (initial 2 Runden) |
| stone, light | Shield | 12 | 8% | % von max-HP als Schild (in Runde 1 gesetzt) |
| psychic, nature | Reflect | 13 | 20% | % des eingehenden Schadens zurueck (initial 2 Runden) |
| fire, water | Execute | 14 | 8% | Gegner stirbt sofort, wenn HP-Anteil <= Skill-Wert |

Das Tier-5 des Gegners wird erst in `opponentTurn(...turns=1)` initialisiert -- in Runde 1 wird der Gegner-Shield gesetzt, der Stun-Counter auf den Player gesetzt etc.

### Stilistischer Hinweis im Code

Im `estimateTier5SkillValue`-Block sind nur die ersten beiden Branches mit `else if` verkettet, die Reflect- und Execute-Branches mit `if`. Funktional unproblematisch (die Element-Strings koennen sich nicht ueberlappen), aber bei Refactor harmonisieren.

---

## Battle-Loop (`calculateBattleProbabilities`)

Vollstaendige rekursive Branch-Exploration aller moeglichen Kampfverlaeufe.

### Setup

1. `critMultiplier = 2 + bonuses.critDamage`
2. `hp` aufrunden (`Math.ceil`)
3. Tier-5 fuer Player initialisieren (`playerShield`, gegnerischer `stunned`, `reflect`)

### Rekursion

```
playerTurn(turns)
  -> playerAttack(baseAtk, turns)  -> opponentTurn(turns) oder Win
  -> playerAttack(critAtk, turns)  -> opponentTurn(turns) oder Win
  -> mergeResult(weighted by probability)

opponentTurn(turns)
  if turns == 1: Tier-5 des Gegners initialisieren
  -> opponentAttack(baseAtk, turns) -> playerTurn(turns+1) oder Loss
  -> opponentAttack(critAtk, turns) -> playerTurn(turns+1) oder Loss
  -> mergeResult
```

Cache-Logik ist im Code auskommentiert: ein simpler `_cache[playerHP][opponentHP]`-Lookup wuerde nicht zwischen Shield/Stun/Reflect-Zustaenden differenzieren und die Ergebnisse verfaelschen.

### Schadensformel (`calculateDmg`)

```
dmg = atk * (1 + tier4.dmg)^turns - adv_def * (1 + tier4.def)^turns
```

`tier4.def` ist immer 0, deswegen reduziert sich das praktisch zu:

```
dmg = atk * (1 + tier4.dmg)^turns - adv_def
```

Pro Aufruf entstehen zwei Aeste:

| Ast | Wahrscheinlichkeit | Schaden |
|-----|--------------------|---------|
| baseAtk | `1 - critchance` | `Math.ceil(dmg)` |
| critAtk | `critchance` | `Math.ceil(dmg * critMultiplier)` |

### Damage-Application (Reihenfolge im Code)

```
1. Stun-Check: wenn gestunnt -> Runde aussetzen (Counter -1, Gegner ist dran)
2. Schaden = max(0, attack.damageAmount - opponentShield)
   opponentShield -= attack.damageAmount   (clamped >= 0)
3. Execute-Check (Tier-5 #14): opponentHP/maxHP <= skill_value -> opponentHP = 0
4. Reflect (Tier-5 #13 des Gegners): wenn opponentReflect > 0 und opponentHP > 0,
   Reflect-Schaden = ceil(opponent.tier5.value * attack.damageAmount).
   playerHP -= max(0, reflectDmg - playerShield)
   playerShield -= reflectDmg   (clamped)
   opponentReflect -= 1
5. Heal-on-Hit: playerHP = min(playerMaxHP, playerHP + ceil(healOnHit * dealtDmg))
6. Win/Loss-Check: opponentHP <= 0 -> Win, sonst opponentTurn
```

Die symmetrische Variante laeuft im `opponentAttack` mit getauschten Rollen.

### Cap und Abbruch

`maxAllowedTurns = 50`. Wird das ueberschritten, wirft die Funktion einen Error. Der `try/catch` in `calculateBattleProbabilities` faengt ihn ab und liefert ein leeres `{}` als BDSMSimu-Stub. Aufrufer muessen also pruefen, ob `simu.win` definiert ist.

### Aggregation

Am Ende:

```
sum = ret.win + ret.loss
ret.win  /= sum
ret.loss /= sum
ret.scoreClass = win > 0.9 ? 'plus' : win < 0.5 ? 'minus' : 'close'
```

`scoreClass`-Boundaries inklusiv-ausschliessend:

| win-Wert | scoreClass |
|----------|------------|
| > 0.9 | `'plus'` |
| 0.5 .. 0.9 | `'close'` |
| < 0.5 | `'minus'` |

---

## Punkte-Verteilung

### Sieg

```
point = min(25, 15 + ceil(10 * playerHP / playerMaxHP))
```

Bereich: 16 (kein HP uebrig) .. 25 (volle HP). Cap auf 25 wegen `Math.min`.

### Niederlage

```
point = max(3, 3 + ceil(10 * (opponentMaxHP - opponentHP) / opponentMaxHP))
```

`(opponentMaxHP - opponentHP)` ist der dem Gegner zugefuegte Schaden. Bereich: 3 (kein Schaden) .. 13 (Gegner fast tot).

### Aggregation

Jede Endknoten-Auswertung tracked `points: {[point]: 1}` und wird ueber `mergeResult` mit Wahrscheinlichkeit gewichtet zu einer Punkte-Verteilung gemerged. Aufrufer berechnen den Erwartungswert selbst:

```typescript
expectedValue = Σ(point * probability) over points
```

---

## Hilfsfunktionen

### `getSkillPercentage(team, id)`

```typescript
return 1 + (team.girls.map(e => e.skills[id]?.skill.percentage_value ?? 0)
                       .reduce((a, b) => a + b, 0) / 100);
```

Summiert das `percentage_value`-Feld aller `team.girls[*].skills[id]` und gibt `1 + (Summe / 100)` zurueck. Wird von Aufrufern als Multiplikator verwendet (z.B. fuer `getSimPowerOpponent` Power-Boni).

---

## Bekannte Grenzen / Designentscheidungen

1. **Vollstaendige Branch-Exploration statt Monte-Carlo.** Der Simulator besucht jeden moeglichen Crit/Non-Crit-Pfad und gewichtet ihn -- exakt aber exponentiell in der Rundenzahl.
2. **Cache abgeschaltet.** Die HP-Tupel-Memoization wuerde Shield/Stun/Reflect-Zustaende nicht erfassen und falsche Ergebnisse cachen.
3. **Tier-4 Defense ignoriert.** Der `def`-Faktor wird nie populiert (`estimateTier4SkillValue` setzt `def: 0`). Tier-4-Defense-Skills haben keinen Sim-Effekt.
4. **Skill-Schaetzung statt API.** Da exakte Skill-Werte nicht zuverlaessig vom Game-API geliefert werden, werden feste Faktoren pro `skill_points_used` verwendet (Tier-4: 0.002; Tier-5: 0.07/0.08/0.2/0.08 je Element-Familie).
5. **Asymmetrie League vs. Season.** Liga rechnet Element-Domination auf Ego/Attack/Defense, Season nicht. Domination-Crit-Bonus gilt in beiden Modi.
6. **Tippfehler `fightBonues`.** Methodenname ist im Code verankert. Refactor: ueberall gleichzeitig oder garnicht.
7. **`else if` vs. `if` in `estimateTier5SkillValue`.** Die letzten beiden Branches (Reflect, Execute) sind als `if` statt `else if` geschrieben. Funktional unkritisch, stilistisch inkonsistent.
8. **`expectedValue` wird vom Simulator nicht gesetzt.** Aufrufer berechnen den Erwartungswert selbst aus `points`.