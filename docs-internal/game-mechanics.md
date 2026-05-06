---
last-verified: 2026-05-06
verified-against-version: HentaiHeroes BDSM (release 2021-07-21), v7.35.21 HHAuto
status: current
sources:
  - INPUT/Your Performance Handbook!*.pdf (Slynia, 2021-11-20+)
  - INPUT/Which elements are the strongest_*.pdf (Master-17 / community thread, 2022-09-08+)
  - https://kinkoid.com/bdsm/
  - HHAuto Code (BDSMHelper.ts, TeamScoringService.ts)
---

# Game Mechanics: BDSM (Battles, Development, Strategy and Mechanics)

Spielmechaniken-Referenz fuer das HentaiHeroes-BDSM-System.
Konsolidiert aus Community-Quellen und Code-Verifikation. Ergaenzt die HHAuto-eigenen Algorithmus-Dokus.

## Quellen

| Quelle | Inhalt |
|--------|--------|
| Slynias Performance Handbook (2021-11-20) | Stat-Formeln, Synergien, Counter-Bonus-Schema, Equipment-Hinweise |
| "Which elements are the strongest" Forum-Thread (2022-09-08) | Tier-Liste der Elemente aus Spieler-Statistiken |
| Kinkoid BDSM-Spec | Offizielle Mechanik-Beschreibung |
| HHAuto Code (Helper/BDSMHelper.ts, Service/TeamScoringService.ts) | Implementierte Werte fuer Validation |

Kinkoid hat seit 2021 mehrfach Anpassungen am System gemacht (Awakening 2021-11-17, neue Skills, neue Elemente). Die Inhalte sind auf den Stand 2026-05-06 gegen die HHAuto-Implementierung querverifiziert; Werte die das Spiel intern aendert (z.B. genaue Domination-Multiplier) koennen aktueller sein als hier dokumentiert.

---

## 1. Performance-Grundlagen

Eine "Performance" ist ein 1v1-Kampf zwischen zwei Spielern (oder Spieler vs. NPC).
Ablauf:

1. Angreifer (Klick auf "Perform!") schlaegt zuerst zu
2. Verteidiger schlaegt zurueck
3. Wechsel bis Ego einer Seite auf 0 ist
4. Erstschlagsrecht ist signifikant - jeder Hit kann durch Crit verdoppelt werden

Maximales Team: bis zu 7 Girls (vor BDSM-Update 2021-07-21 waren es 3).

---

## 2. Stats

### Vier Kern-Stats

| Stat | Bedeutung | Beeinflusst |
|------|-----------|-------------|
| Damage / Attack Power | Pro-Hit-Schaden, reduziert um Defense | Hauptangriff |
| Defense | Schadensreduktion pro Hit | Schadensvermeidung |
| Ego | HP / Lebenspunkte | Ueberleben |
| Harmony | Crit-Chance-Faktor | Crit-Chance gegen Gegner |

### Hero-Stats und Klassen

| Player-Klasse (class-Wert) | Symbol | Hauptstat | Sekundaerstats |
|------------------------------|--------|-----------|----------------|
| 1 - Hardcore (HC) | rotes Schild | carac1 | carac2, carac3 |
| 2 - Charm | Rose | carac2 | carac1, carac3 |
| 3 - Know-How (KH) | gelbe Birne | carac3 | carac1, carac2 |

Nur der Haupt-Stat erhoeht **Damage** und **Endurance** (Endurance = +1 Ego pro Punkt). Die anderen zwei erhoehen Defense und Harmony.

### Stat-Punkte kaufen

Pro Level: 30 zusaetzliche Stat-Punkte pro Stat (max Level 500 -> 15.000 pro Stat = 45.000 total).
Preis steigt mit jedem Kauf des selben Stats. Das Skript verwendet diesen Mechanismus in HeroHelper.doStatUpgrades() mit Multiplikatoren 1/10/30/60.

---

## 3. Stat-Formeln (verifiziert per Performance Handbook)

### Ego (HP)

`
Ego = Endurance + (2 * TeamPower)

VOLL: (Endurance + (2 * TeamPower))
      * (1 + ExhibitionistSynergy)
      * (1 + DominationEgoBonus)
      * (1 + ChlorellaBoosterBonus)
`

Endurance = Hauptstat-Punkte.
TeamPower = Summe aller Stats aller 7 Girls im Team.

### Damage (Attack Power)

`
Damage = MainStat + (0.25 * TeamPower)

VOLL: (MainStat + (0.25 * TeamPower))
      * (1 + DominatrixSynergy)
      * (1 + DominationAttackBonus)
      * (1 + CordycepsBoosterBonus)
`

### Defense

`
Defense = 0.25 * (Sec1 + Sec2) + (0.12 * TeamPower) * (1 + SubmissiveSynergy)
`

Booster-seitig nur durch Ginseng (erhoeht alle Stats).

### Harmony / Crit-Chance

`
CritChance = 0.30 * MyHarmony / (MyHarmony + OpponentHarmony)
`

Bounds: 0.01 <= CritChance <= 0.29.

Die 30%-Wahrscheinlichkeit wird zwischen den Spielern aufgeteilt - bei gleichem Harmony hat jeder 15%.

Maximale Crit-Chance (Team-Komposition):

| Quelle | Bonus |
|--------|-------|
| Harmony-Cap | 29% |
| Physical-Synergie (1 Girl + 100+ im Harem) | 9% |
| Double-Counter-Bonus (Physical-Cycle) | 40% |
| **Maximum theoretisch** | **78%** |

---

## 4. Elemente und Synergien

### Acht Elemente

| Element | Klassen-Name | Synergie-Bonus pro Girl im Team | Maximaler Harem-Bonus (100+ Girls) |
|---------|-------------|----------------------------------|-------------------------------------|
| Fire | Eccentric | +10% Crit Damage | (additiv) |
| Water | Sensual | +3% Heal on Hit | bis 10% |
| Nature | Exhibitionist | +3% Ego | bis 10% |
| Stone | Physical | +2% Crit Chance | bis 7% |
| Sun | Playful | +2% Defense Reduction | bis 7% |
| Darkness | Dominatrix | +2% Damage | bis 7% |
| Psychic | Submissive | +2% Defense | bis 7% |
| Light | Voyeur | +2% Harmony | bis 7% |

Synergie aktiv ab 3 Girls eines Elements im Team. Maximal 2 Synergien parallel (3+3 Girls). Bei weniger als 3 gleichen Elementen: "Balanced Team" -> keine Synergie aktiv und kein Counter moeglich/empfangbar.

### Zwei Domination-Cycles (egoDamage + chance)

#### egoDamage-Cycle (5 Elemente)

Bei Match: pro getroffenem Gegner-Element +10% Ego UND +10% Attack auf der eigenen Seite.

`
fire -> nature -> stone -> sun -> water -> fire
`

| Element | wird besiegt von |
|---------|------------------|
| fire | nature |
| nature | stone |
| stone | sun |
| sun | water |
| water | fire |

#### chance-Cycle (3 Elemente)

Bei Match: pro getroffenem Gegner-Element +20% Crit-Chance auf der eigenen Seite.

`
darkness -> light -> psychic -> darkness
`

Counter-Bonusse sind ADDITIV mit Synergie-Bonusen (laut Performance Handbook), beide werden mit anderen Boostern in den Endformeln multipliziert.

### Element-Tier-Liste (Community-Erkenntnisse)

Aus zwei voneinander unabhaengigen Quellen (Master-17, DvDivXXX, Kenrae - alle Forum-Moderatoren):

`
S-Tier:   Darkness, Water        # immer stark
A-Tier:   Sun, Nature            # situational stark
B-Tier:   Fire                   # ok
C-Tier:   Stone, Light           # mittel
D-Tier:   Psychic                # garbage-tier
`

**Wichtige Spielzeitabhaengigkeit:** Sensual (Water) ist nur bei aehnlich starken Gegnern dominant - gegen viel staerkere ist Heal-on-Hit wertlos. Dominatrix (Darkness) ist gegen High-Defense-Gegner staerker, Eccentric (Fire) schwaecher.

Die HHAuto-Team-Auswahl folgt diesen Erkenntnissen NICHT direkt - sie waehlt nach Spieler-Klassen-Hauptstat und Tier-3-Trait-Bonus, nicht nach Element-Tier.

---

## 5. Tier-3 Synergie-Bonus (Trait-Match)

Quelle: Tom-208-Userscript + HHAuto-Implementierung.

Wenn mehrere Girls im Team einen Trait-Wert teilen (z.B. mehrere mit blauen Augen, mehrere im selben Sternzeichen), erhalten alle Girls einen Stat-Boost:

| Rarity | Bonus pro matchenden Teammate |
|--------|-------------------------------|
| Mythic | +1.0% pro Match |
| Legendary | +0.8% pro Match |

Trait-Kategorien (gepaart mit Element):

| Element-Paar | Trait-Kategorie | Verarbeitung |
|--------------|----------------|--------------|
| Darkness + Fire | eyeColor | Hex (3-char) |
| Light + Nature | hairColor | Hex (3-char) |
| Stone + Psychic | zodiac | Glyph + Name |
| Water + Sun | position | Image-Index "1.png" - "12.png" |

Implementiert in TeamScoringService.calculateTier3TeamBonus() (Konstanten TIER3_BONUS_MYTHIC = 0.01, TIER3_BONUS_LEGENDARY = 0.008).

---

## 6. Tier-5 Leader-Skill

Mythic-Girls haben einen Leader-Skill mit ID 11-14 (Stun, Shield, Reflect, Execute). Wirkt wenn das Girl auf Position 0 (Leader-Slot) ist.

| Tier-5 ID | Skill | Leader-Element (im Code: BDSMHelper.estimateTier5SkillValue) | Effekt-Faktor pro skill_points_used | Effekt in BDSMHelper.calculateBattleProbabilities |
|-----------|-------|---------|---------|---|
| 11 | Stun | sun, darkness | * 0.07 | opponent.stunned = 2 (Runden) |
| 12 | Shield | stone, light | * 0.08 | playerShield = value * hp (in Runde 1 gesetzt) |
| 13 | Reflect | psychic, nature | * 0.20 | reflect = 2 (Runden) |
| 14 | Execute | fire, water | * 0.08 | wenn opponentHP/maxHP <= value -> opponentHP = 0 |

HHAuto's Leader-Priority bei der Team-Auswahl (verifiziert in TeamScoringService): Shield > Stun > Execute > Reflect.

---

## 7. Boosters

### Booster-Typen

| Booster | Effekt | Common +Wert | Rare +Wert | Epic +Wert | Legendary +% |
|---------|--------|--------------|-----------|-----------|--------------|
| Chlorella | Ego (HP) | +1200 | +4200 | +14700 | +10% |
| Ginseng root | HC + CH + KH | +100 | +350 | +1225 | +6% |
| Cordyceps | Damage | +300 | +1050 | +3675 | +10% |
| Jujubes | Harmony | +400 | +1400 | +4900 | +20% |

Common-Legendary-Booster halten 24h, Mythic Booster halten eine bestimmte Anzahl von Performances (Sandalwood / MB1 = 5 Uses).

### Mythic-Booster (Auswahl)

| Identifier | Wirkung |
|-----------|---------|
| MB1 (Sandalwood) | Mehr Girl-Shards pro Battle |
| MB2 (All Mastery's Emblem) | +15% Damage in League und Season fuer 100 Performances |

### Empfehlung (Performance Handbook)

`
Cordyceps > Ginseng root > Chlorella > Jujubes
`

Cordyceps gibt direkten Damage-Boost und ist meist am wertvollsten.

---

## 8. Equipment

### Multistat vs. Mono

- **Multistat (Rainbow):** boostet alle 5 Stats (carac1/2/3, Endurance, Harmony)
- **Mono:** boostet nur einen Stat - meist deutlich hoeher

Empfehlung: Multistat-Default, Mono nur fuer Hauptstat wenn das Mono-Item mindestens 50% des Multistat-Sek-Stat-Verlusts kompensiert. Mehr als 3 Mono-Items reduzieren Harmony zu sehr -> Crit-Anfaelligkeit.

Equipment ist NICHT in vailableGirls.caracs enthalten - dort stehen blessing-applied stats ohne Equipment. Daher: HHAuto's Team-Auswahl arbeitet equipment-frei und der User muss danach "Stuff Team" druecken.

---

## 9. Girl-Level und Grade

| Mechanik | Quelle |
|----------|--------|
| Level | Books (Market -> Books) - lift Stats linear |
| Grade | Affection (Market -> Gifts) - bringt Sterne, ueberproportional teurer |

Level-Cap pro Girl entspricht dem Player-Level - mit Awakening (Patch 2021-11-17) bis Level 750.
Player-Cap ist Level 500.

### Grade-Sterne

`
Starter:   1 Star -> 5 Stars
Common:    1 Star -> 5 Stars
Rare:      1 Star -> 5 Stars
Epic:      1 Star -> 5 Stars
Legendary: 1 Star -> 5 Stars (3-Star und 5-Star sind verbreitet)
Mythic:    1 Star -> 6 Stars
`

### Affection / XP per Battle

In Season-Battles erhalten alle Team-Girls XP und Affection abhaengig vom Level des Gegners:

| Gegner-Level | XP / Affection pro Win |
|--------------|------------------------|
| 1-50 | 1 |
| 51-100 | 2 |
| 101-150 | 3 |
| ... | ... |
| 451+ | 10 |

---

## 10. Awakening (seit 2021-11-17)

Awakening hebt das Level-Cap der Girls auf bis zu 750 - ueber das Player-Level hinaus.

Caps fuer Awakening: Level 50, 100, 150, 200 sind kostenlos. 250+ benoetigt Gems vom passenden Element.

### Gems-Bedarf (kumulativ Level 250-750 pro Rarity)

| Rarity | Gems gesamt |
|--------|-------------|
| Common | 1880 |
| Rare | 3760 |
| Epic | 5640 |
| Legendary | 7520 |
| Mythic | (in der Tabelle nicht gelistet, hoeher) |

Voraussetzung pro Stufe: bestimmte Anzahl Girls bereits am vorigen Cap. Z.B. min 100 Girls auf Level 700, bevor erstes Girl > 700 awakened werden kann.

---

## 11. Blessings

Blessings erhoehen Stats von Girls mit bestimmten Traits.

- Aktiv-Blessings sind sichtbar im Top-Right-Popup (UI-Button) und ueber den get_girls_blessings-AJAX-Endpoint.
- Wechsel: jeden Montag 13:00 UTC+1 (gleicher Zeitpunkt wie Daily-Missions-Reset).
- Blessing wird in vailableGirls.caracs direkt eingerechnet -> "blessed_caracs == caracs" gilt fuer's HHAuto-Skript.

Blessing-Typen:

| Typ | Bedeutung |
|-----|-----------|
| Common-Blessing | Standard wird gewuerfelt |
| Element-Blessing (PvP3 / pvp_v3) | Element-spezifischer Bonus, Array [20, 30] = 20% Element + 30% Trait |
| PvP4-Blessing | League-spezifischer Bonus |

lessing_bonuses Struktur in vailableGirls:

`json
{
  "pvp_v3": {
    "carac1": [20, 30],
    "carac2": [20, 30],
    "carac3": [20, 30]
  }
}
`

HHAuto-Skript bevorzugt blessed Trait-Kategorien beim Cluster-Score (BLESSED_CATEGORY_BOOST = 1.5 in TeamScoringService).

---

## 12. League (PvP)

| Aspekt | Wert |
|--------|------|
| Freischalt-Level | 20 |
| Saison-Dauer | 1 Woche (Donnerstag 13:00 UTC+1 reset) |
| Gruppengroesse | 100-199 Spieler |
| Anzahl Leagues | 9 (Wanker I/II/III, Sexpert I/II/III, Dicktator I/II/III) |
| Punkte pro Win | 15-25 (Skala mit Rest-Ego) |
| Punkte pro Loss | 3-13 |
| Token-Regen | 1 alle 35 Min, max 15 |
| 15x-Performance-Button | gegen Lowest-Level-noch-nicht-gefightete Gegner |

Promote: Top 15 in der Gruppe. Demote: Bottom 15 oder 0 Punkte. Ausnahme: Dicktator III hat keine Promote.

**Tie-Break:** wer Punkte zuerst erreicht hat. Sonst: niedrigstes Level priorisiert.

---

## 13. Season (PvP)

| Aspekt | Wert |
|--------|------|
| Saison-Dauer | 1 Monat (1. des Monats 13:00 UTC+1) |
| Currency | Kisses (1 pro Stunde, max 10) |
| Ranking | Mojo (Elo-System) |
| Mojo-Range pro Battle | -40 bis +40, abhaengig vom Mojo-Diff |

Wichtige Eigenschaften:
- Mojo wird am Ende jeder Season zurueckgesetzt; Start-Mojo der naechsten Saison reflektiert vorige Performance
- Season-Pass kann pro Saison gekauft werden, verdoppelt Rewards
- Buy-Refills early in season -> harte Gegner -> nicht empfehlenswert fuer neue Spieler

---

## 14. Cross-References

| Thema | HHAuto-Doku |
|-------|-------------|
| Battle-Simulation und Crit-Berechnung | dsm-battle-simulator.md |
| Team-Auswahl-Algorithmus (League) | team-algorithm-design.md |
| vailableGirls-Felder, API-Zugriff | technical-reference-team-selection.md |
| Storage-Keys fuer Settings (Boost-Filter, Threshold) | storage-keys.md |

---

## 15. Aenderungs-Historie

| Datum | Aenderung |
|-------|-----------|
| 2021-07-21 | BDSM-System released, 7-Girl-Team |
| 2021-11-17 | Awakening (Level 750) eingefuehrt |
| 2022-09-08 | Element-Tier-Liste community-validiert |

Die Mechaniken werden von Kinkoid laufend angepasst (Bonus-Faktoren, neue Booster, Skill-Aenderungen). Bei signifikanten Drift in der HHAuto-Auswahl: BDSMHelper.ts und TeamScoringService.ts pruefen.
