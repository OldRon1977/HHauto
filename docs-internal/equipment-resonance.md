---
last-verified: 2026-08-17
status: current
---

# Equipment Resonance -- Grundlage fuer einen Item-Optimierer

Was ein automatischer Item-Optimierer wissen muss: wie die Resonanz-Boni
funktionieren, wie die Daten aussehen, welche Endpunkte man benutzen kann --
und welche Messwege **nicht** funktionieren (teuer gelernt, siehe unten).

Quellen: die beiden offiziellen Kinkoid-Artikel
[Mythic Equipment](https://blog.kinkoid.com/features/mythic-equipment/) (2022-11-17)
und [Recruit Equipment & Resonance](https://blog.kinkoid.com/features/recruit-equipment-resonance/)
(2023-05-05), plus eigene Messungen am 2026-08-17 (Account 1, Klasse
Know-how). Jede Angabe unten ist als *offiziell* oder *gemessen* markiert.

---

## 1. Die Mechanik

**Offiziell:** „Resonance is a bonus based on a **match** between the resonating
bonus and the hero." Ein mythisches Spieler-Item traegt **zwei** Resonanzen, die
der Spieler zu matchen versucht; man muss nicht beide treffen, um etwas zu
bekommen.

Die beiden Achsen bei Spieler-Ausruestung:

| Achse | matcht gegen | Werte |
|---|---|---|
| ``class`` | die **Klasse des Helden** | 1 Hardcore, 2 Charm, 3 Know-how |
| ``theme`` | das **Theme des Teams** | die 8 Elemente + **Balanced** |

**Balanced ist ein vollwertiges Theme.** Ein Team ohne drei Girls desselben
Elements ist nicht themenlos, sondern hat das Theme *Balanced* -- und es gibt
Items, die genau darauf resonieren (im Datenmodell ``theme.identifier: null``).

**Offiziell:** „Resonance bonuses are all summed up and then **applied
after/on top of all other bonuses**." Im Recruit-Artikel praeziser: die Boni
werden „given to the Hero **in the end calculation of stats**".

Bei Girl-Ausruestung haengt die Zahl der Achsen an der Seltenheit (offiziell):

| Rarity | Resonanzen |
|---|---|
| Epic | 1 (Class) |
| Legendary | 2 (Class + Element) |
| Mythic | 3 (Class + Element + Favorite position) |

Fuer Girl-Items nennt der Artikel eine feste Zuordnung: Class -> Ego,
Element -> Defense, Pose -> Attack. **Fuer Spieler-Items gilt das nicht**
(gemessen): dort traegt jedes Item seine eigene Zielgroesse, ``class`` zeigte
mal auf ``damage``, mal auf ``ego``; ``theme`` mal auf ``defense``, mal auf
``chance``. Ein Optimierer muss die Zielgroesse also pro Item aus den Daten
lesen und darf sie nicht aus der Achse ableiten.

---

## 2. Datenmodell (gemessen)

### Spieler-Items

Global ``hero_items`` auf ``/hero/profile.html``, Schluessel ``1``..``6`` =
Slots. Dieselben Objekte stecken auf ``shop.html`` in
``player_inventory.armor`` und in den ``data-d``-Attributen unter
``#equiped .armor div[id_item]``.

Ein Objekt traegt **entweder** die eine ID **oder** die andere, nie beide
(siehe „Zwei ID-Raeume" weiter unten):

```jsonc
{
  // angelegt: nur dieses Feld, `id_member_armor` fehlt ganz
  "id_member_armor_equipped": 2666196,
  // im Inventar stattdessen nur dieses (ID wechselt beim Ablegen!)
  // "id_member_armor": 6602031,
  "level": 20,
  "skin": { "subtype": 1, "wearer": "hero", "name": "Dragon Helmet" },
  "item": { "rarity": "mythic", "type": "armor" },
  "caracs": { "carac1": 4000, "carac2": 4000, "carac3": 4000,
              "endurance": 4000, "chance": 5000 },
  "resonance_bonuses": {
    "class": { "identifier": "1",     "resonance": "damage",  "bonus": 2 },
    "theme": { "identifier": "stone", "resonance": "defense", "bonus": 2 }
  }
}
```

- ``skin.subtype`` = Slot 1..6. Ein Item passt nur in seinen Slot.
- ``resonance.identifier``: bei ``class`` die Klassennummer als String, bei
  ``theme`` der Elementname oder ``null`` (= Balanced).
- ``resonance.resonance``: Zielgroesse (``damage`` | ``ego`` | ``defense`` |
  ``chance``).
- ``bonus``: Prozentpunkte.
- ``caracs.chance`` kommt mal als Zahl, mal als **String** (`"4634.57"`).
  Immer durch `Number()` schicken.

### Der Bonus skaliert mit dem Item-Level

Gemessen ueber Items derselben Art auf verschiedenen Leveln:

| Level | Bonus (damage/ego/defense) | Bonus (chance) |
|---|---|---|
| 1 | 0,1 | 0,2 |
| 7 | 0,7 | – |
| 20 | 2,0 | 4,0 |

Also 0,1 Prozentpunkte pro Level, auf der Chance-Schiene doppelt.

### Rohwerte sind bei gleicher Stufe identisch

| Level | carac1/2/3 | endurance | chance |
|---|---|---|---|
| 1 | 2100 | 2100 | 3100 |
| 20 | 4000 | 4000 | 5000 |

**Bei maximalem Level ist die Resonanz der einzige Unterschied zwischen zwei
mythischen Spieler-Items desselben Slots.** Das Hochleveln eines mythischen
Items kauft nichts als Resonanz.

---

## 3. Endpunkte

| Zweck | Aufruf |
|---|---|
| Anlegen | ``{action:'market_equip_armor', id_member_armor, rarity}`` |
| Inventar (Folgeseiten) | ``{action:'market_get_armor', id_member_armor: <letzte ID>}`` |
| Inventar (erste Seite) | Global ``player_inventory.armor`` auf ``shop.html`` |

Die Equip-Antwort liefert ``{unequipped_armor, equipped_armor, caracs,
success}``. ``unequipped_armor.id_member_armor`` ist noetig, um den
Ausgangszustand wiederherzustellen -- **die Inventar-ID eines Items aendert
sich jedes Mal, wenn es abgelegt wird.** Wer zurueckbauen will, muss die ID aus
der Antwort mitschreiben; ueber den Namen zu suchen reicht nicht, weil man
mehrere identische Items besitzen kann (am 2026-08-17 zwei „Dragon Helmet"
Lvl 20 mit *unterschiedlicher* Resonanz).

### Zwei ID-Raeume, und sie ueberlappen

Ein Item traegt **entweder** `id_member_armor` (im Inventar) **oder**
`id_member_armor_equipped` (angelegt) -- nie beides. Der Eintrag unter
`#equiped` hat den Schluessel `id_member_armor` gar nicht.

Beide Zahlenraeume ueberlappen (gemessen 2026-08-17: Inventar
567.162..2.136.163.515, angelegt 464.128..2.806.648). Wer beide Quellen in
eine Map ueber die blanke Zahl legt, verliert bei einer Kollision still ein
Item -- ohne Fehler, ohne Log. Der Schluessel muss die Quelle mitfuehren.

Dasselbe gilt fuer die Upgrade-Seite, die je nach Herkunft einen **anderen
Query-Parameter** erwartet:

```
Inventar-Item:  /mythic-equipment-upgrade.html?id_member_item=<id_member_armor>
angelegtes:     /mythic-equipment-upgrade.html?id_member_item_equipped=<id_member_armor_equipped>
```

Der falsche Parameter scheitert **nicht laut**: die Seite springt zum Markt
zurueck, und die Automatik sieht aus, als haette sie nichts getan.

---

## 4. Messfallen -- was NICHT funktioniert

Alle drei Wege wurden mit einer Kontrolle geprueft (Tausch eines Lvl-20-Items
gegen ein Lvl-1-Item, also 1900 Rohpunkte Unterschied pro Carac). Reagiert
ein Messwert darauf nicht, kann er erst recht keine 2 % Resonanz zeigen.

| Messwert | reagiert auf Item-Level? | brauchbar? |
|---|---|---|
| eigener Eintrag in ``opponents_list`` (Liga) | nein, Δ 0,00 % | nein, gecachter Schnappschuss |
| ``action=team_calculate_caracs`` | nein, Δ 0,00 % | nein, ignoriert Spieler-Ausruestung komplett |
| Anzeige auf ``/hero/profile.html`` | nein, Δ 0,00 % | nein, ebenfalls gecacht |
| ``caracs``-Block der Equip-Antwort | **ja** | nur Eingangswerte, keine Resonanz |

Der ``caracs``-Block ist der einzige Wert, der sich mit der Ausruestung
bewegt -- er enthaelt aber carac1/2/3, endurance und chance, also die
*Eingangs*-Werte vor der Endberechnung. Die Resonanz sitzt laut Kinkoid genau
dahinter („in the end calculation of stats") und taucht deshalb in keiner
client-seitigen Zahl auf. Der Client **rechnet Resonanz nie selbst**,
``shared.general.buildResonanceBonus()`` rendert nur den Tooltip.

**Konsequenz fuer den Optimierer:** Er kann seinen eigenen Gewinn nicht
nachmessen. Er muss aus den deklarierten ``resonance_bonuses`` rechnen und
darf sich nicht auf eine Vorher/Nachher-Messung stuetzen.

### `item_to_upgrade.level` bewegt sich nicht

Auf der Upgrade-Seite ist dieses Global ein Schnappschuss vom Seitenaufbau.
Nach **neunzehn** erfolgreichen Level-ups stand dort immer noch `1`. Eine
Abbruchbedingung, die daran haengt, greift nie -- der erste Lauf endete nur
deshalb, weil das Spiel bei Level 20 von selbst wegnavigierte. Das Level muss
aus dem Ladewert plus den ausgefuehrten Schritten gezaehlt werden.

Querverweis: [live-verification-lessons.md](live-verification-lessons.md).

---

## 5. Was ein Optimierer tun muesste

**Zielfunktion.** Summe der *aktiven* Resonanzen, also je Item:

- ``class``-Bonus zaehlt, wenn ``identifier == Heldenklasse``
- ``theme``-Bonus zaehlt, wenn ``identifier == Theme des aktuellen Teams``
  (``null`` matcht ein Balanced-Team)

Beide Achsen unabhaengig, Boni werden aufsummiert (offiziell).

**Nebenbedingungen.**

- Ein Item pro Slot (``skin.subtype`` 1..6), nur aus dem eigenen Bestand.
- **Nie Rohwerte gegen Resonanz tauschen.** Ein Lvl-1-Item statt Lvl-20
  kostet 1900 Rohpunkte pro Carac fuer maximal 2 Prozentpunkte Bonus. Nur
  Items gleicher Stufe gegeneinander tauschen.
- Zielgroesse pro Item aus den Daten lesen (siehe Abschnitt 1); ob ``damage``
  mehr wert ist als ``ego`` oder ``defense``, ist eine Gewichtungsfrage, die
  der Optimierer offenlegen sollte.

> **Historisch.** Dieser Abschnitt beschreibt den Planungsstand *vor* dem
> Bau. Die Gewichtungsfrage im letzten Punkt wurde nicht beantwortet, sondern
> **verworfen**: zwei Statmodelle sind daran gescheitert, und Abschnitt 5a
> ersetzt sie durch Prioritaetenstufen. Was dort steht, gilt.

**Reihenfolge: erst das Team, dann die Items.** Das Theme des Teams entscheidet,
welche Theme-Resonanzen aktiv sind -- die Abhaengigkeit laeuft also vom Team zur
Ausruestung und nicht umgekehrt. Der Optimierer haengt hinten an:

```
1. Team bauen        (TeamBuilderService + TeamEvaluationService)
2. Theme ablesen     (>= 3 Girls eines Elements, sonst Balanced)
3. Items darauf ausrichten
```

Das ist nicht nur die einfachere Reihenfolge, sondern unter der bestehenden
Unsicherheit auch die sichere: Der Item-Schritt ist ein **reiner Gewinn ohne
Gegenwert** -- Items gleicher Stufe haben identische Rohwerte, ein Tausch
kostet also nichts, egal wie stark die Resonanz am Ende wirkt. Das Team
umgekehrt an die Ausruestung anzupassen wuerde bedeuten, **gemessene** Rohstaerke
gegen einen **nicht messbaren** Bonus einzutauschen. Das waere eine Wette.

Wann sich die gemeinsame Optimierung trotzdem lohnen koennte: wenn der Builder
zwei Teams als praktisch gleichwertig ausweist (innerhalb der
Kandidaten-Fenster von 10 %) und der Spieler fuer eines der beiden Themes ein
vollstaendiges 6-Slot-Set besitzt. Dann ist die Theme-Wahl gratis und die
Resonanz der Tiebreak. Voraussetzung bleibt, dass jemand die Effektgroesse
kennt (siehe Abschnitt 6).

Ein Theme ist ohnehin nur voll nutzbar, wenn passende Items fuer **alle sechs
Slots** vorhanden sind. Beispiel vom Messtag (mythic Lvl 20 im Inventar des
Testaccounts):

```
sun 13 (alle 6 Slots)   fire 13 (kein Slot 4)   darkness 12 (kein Slot 5)
water 10 (kein Slot 2)  psychic 8   Balanced 8   light 7
nature 7 (kein Slot 5)  stone 2
```

Nur *sun* war auf allen sechs Slots bedienbar; das nature-Team des Messtags
liess sich zu 4/6 bedienen (Slot 5 fehlt, Slot 2 nur mit Klassenverlust).

---

## 5a. Was davon gebaut ist

`Service/EquipmentOptimizerService.ts` (Rangfolge) und
`Service/EquipmentUpgradeService.ts` (Ausbau) sind rein und testbar,
`Module/EquipmentGear.ts` macht die unreine Haelfte -- Globals lesen,
paginieren, Vorschau, Ajax. Alle drei Schritte stehen:

| Button | entspricht | Auswahl |
|---|---|---|
| Current Best Gear | Team 2a | Prioritaetenstufe nach heutigem Stand |
| Possible Best Gear | Team 2b | Prioritaetenstufe nach Stand bei Level 20 |
| Upgrade Gear | Team 3 | angelegte Mythics unter Level 20, beste Stufe zuerst |

### Die Wertung: Prioritaetenstufen, kein Statscore (2026-08-17)

Zwei Statmodelle wurden gebaut und beide empfahlen, Mythics gegen
Legendaries zu tauschen -- erst eine flache Carac-Summe (die ein Legendary
mit 43.301 Endurance und null auf allem anderen gewinnen liess), dann ein
Produkt aus Klassen-Carac und Endurance. Entschieden hat ein Crawl der
gesamten Liga ueber `/hero/<id_member>/profile.html`, wo `hero_items` fuer
**jeden** Spieler lesbar ist:

```
99 Spieler, 594 Slots:   mythic 582   legendary 12
576 der 582 Mythics auf Level 20
95 von 99 Spielern tragen 6/6 mythic; die Top 25 ausnahmslos
die vier mit Legendaries stehen auf Platz 49, 60, 80, 95
```

Ein Score, der dem widerspricht, ist falsch, wie gut er auch begruendet ist.
Und er ist hier auch nicht reparierbar: die theme-Achse zielt in **allen 582
Faellen** auf `defense` oder `chance` -- genau die beiden Groessen, die
client-seitig nicht messbar sind.

Die Rangfolge kodiert deshalb, was starke Spieler tun:

| Stufe | Bedingung |
|---|---|
| 1 | Mythic auf Level 20, Klasse **und** Theme passend |
| 2 | Mythic auf Level 20, Klasse passend |
| 3 | Mythic auf Level 20, Theme passend |
| 4 | Mythic auf Level 20 |
| 5 | alles andere -- nach Stats, dann Resonanz |

**Level 20 bedeutet je nach Button etwas anderes.** „Possible Best"
projiziert, dort qualifiziert ein ungelevelltes Mythic sofort fuer Stufe 1-4;
bei Level 20 haben alle Mythics eines Slots ohnehin identische Caracs
(gemessen: ein einziges Tupel `4000/4000/4000/4000/5000` ueber alle 576
Slots), weshalb dieser Button gar keine Statrechnung braucht. „Current Best"
urteilt ueber heute, dort faellt ein ungelevelltes Mythic auf Stufe 5 und
konkurriert mit seinen echten Werten -- sonst wuerde ein Level-1-Mythic
(11.500 Carac-Punkte) ein Legendary auf Spielerlevel (~18.600) verdraengen.

**Gleichstand innerhalb einer Stufe** entscheidet die Groesse der Resonanz.
Die class-Achse zahlt immer 2 pp, die theme-Achse 4 pp auf der
Chance-Schiene und 2 pp auf defense (279 gegen 297 der 576 Slots). Zwei
Stufe-1-Items koennen also 6 pp oder 4 pp wert sein.

**Stufe 5** ordnet nach dem geometrischen Mittel ueber die vier Achsen
(Klassen-Carac, Nebencaracs, Endurance, Chance). Das ist ausdruecklich eine
Heuristik und keine Messung -- sie kodiert nur „ausgewogen schlaegt
einseitig" und verhindert, dass ein Mono-Stat-Item gewinnt. Legendaries
tragen ueberhaupt keine Resonanz: von den 12 Legendary-Slots der Liga hatte
keiner einen class- oder theme-Bonus.

Gegenprobe am Messaccount: beide Buttons melden **„nothing to change"** --
vier Slots Stufe 1, zwei Slots Stufe 2 (fuer Slot 2 und 5 besitzt der
Account kein nature-Mythic).

### Wie Upgrade Gear das benutzt

Der Ablauf faehrt bewusst ueber die Spielseite statt ueber einen eigenen
Ajax-Aufruf: Warteschlange schreiben, zur Upgrade-Seite des ersten Ziels
navigieren, dort „Auto Select" und „Level-up" druecken, bis das Spiel den
Level-up-Knopf nicht mehr freigibt, dann zum naechsten Ziel.

Der Grund steht oben -- die Kostenkurve ist aus ihren eigenen Zahlen nicht
herleitbar (20 fuer 1->2, 23 fuer 2->3, aber 1.555 insgesamt ab Level 1; keine
arithmetische Reihe durch diese Punkte ergibt das). „Auto Select" waehlt das
Material nach den Regeln des Spiels, und der Level-up-Knopf ist genau dann
aktiv, wenn der Bedarf gedeckt ist. Ein deaktivierter Knopf **ist** die
Aussage „Material alle" -- der Automat zaehlt nichts selbst nach.

Sicherungen: Die Automatik tut nichts, solange die Warteschlange leer ist
(live geprueft: null Aufrufe). Stimmt `item_to_upgrade.id_member_armor` nicht
mit dem Kopf der Warteschlange ueberein, bricht sie ab, ohne etwas
auszugeben. Und es gilt eine harte Obergrenze von 30 Leveln je Seitenaufruf,
weil jedes Level Geld und Material kostet.

### Material fuer Upgrade Gear

**Mythics sind niemals Material.** Keine Ausnahme fuer Dopplungen, keine fuer
„richtiges Theme bei falscher Klasse", keine fuer verdraengte Items.
Verbraucht werden nur Legendaries und Epics -- im Testinventar 1.169 und 341
Stueck gegenueber 104 Mythics.

Das loest nebenbei den Zielkonflikt aus dem urspruenglichen Prompt auf: Items
mit richtigem Theme bei falscher Klasse sind jetzt Stufe 3 und werden
angelegt, statt zugleich Brennstoff sein zu sollen.

Die Sicherheitsregel „nie ein angelegtes Item verbrauchen" bleibt trotzdem
noetig, nur mit anderem Ziel: Wenn ein Slot kein Mythic hat, legt Stufe 5 ein
Legendary an -- und genau das darf der Upgrade-Schritt dann nicht einschmelzen.

### Der Upgrade-Endpunkt (gemessen 2026-08-17)

Er steckt nicht in `shop.js` oder `shared.js`, weil er auf einer **eigenen
Seite** liegt:

```
/mythic-equipment-upgrade.html?id_member_item=<id_member_armor>
```

Der „Level-up"-Knopf auf `shop.html` navigiert nur dorthin -- er sendet
nichts. Auf der Zielseite liegen die Globals `item_to_upgrade`,
`next_level_item`, `materials_items` (100 pro Seite) und
`upgradeable_item_max_level` (= 20).

**Der Aufruf:**

```
action=mythic_armor_level_up
items_data[0][item_ids][]  = <id_member_armor>   (wiederholt, ein Eintrag je Material)
items_data[0][rarity]      = epic
id_member_item             = <das Item, das steigen soll>
is_armor_equipped          = false
```

Die Gruppierung `items_data[0]` mit eigener `rarity` legt nahe, dass mehrere
Seltenheitsgruppen in einem Aufruf gehen (`[1]`, `[2]`, ...); gemessen wurde
nur eine. `is_armor_equipped` zeigt, dass das Spiel auch angelegte Items
aufwerten laesst.

**Die Antwort:**

```json
{"hero_updates":{"currency":{"soft_currency": 34299666244}},
 "next_level_item":{ ...level: 3, caracs, resonance_bonuses... },
 "success":true}
```

`next_level_item` ist die *naechste* Stufe, nicht die erreichte. Nach dem
Aufruf stand das Item auf Level 2 und `next_level_item.level` auf 3.

**Kosten, an einem echten Aufruf gemessen** (Eyepatch, mythic, Level 1 -> 2):

| | |
|---|---|
| Geld | 1.000.000 (soft currency), exakt |
| Kobans | 0 |
| Material | 7 Items, alle `epic` |
| Materialbedarf laut UI | „Until lvl.2: 20", danach „Until lvl.3: 23" |
| Restbedarf bis Level 20 | 1.555 vor dem Schritt, 1.535 danach |

Die 7 Items deckten einen Bedarf von 20 -- Material zaehlt also **nicht nach
Stueck, sondern nach Gewicht**. Plausibelster Traeger ist `skin.weight`, das
in der Materialliste Werte 1, 3, 5 und 6 annimmt (*vermutet*, nicht
nachgerechnet).

**Bei Level 20 leitet die Seite um.** Ein Aufruf fuer ein Item am Cap landet
wortlos auf `/shop.html`. Genau deshalb erreicht eine Automatik, die bis zum
Cap laeuft, ihr eigenes Aufraeumen nicht -- sie wird mitten im Lauf von der
Seite geworfen.

**Eine Stufe unter dem Cap steht die Bedarfszeile doppelt.** Auf Level 19
druckt die Seite zweimal „Until lvl.20: 204", weil naechste Stufe und Cap
dieselbe sind. Ein Parser, der die erste Zeile als „naechste Stufe" und die
20er-Zeile als „bis zum Cap" liest, muss beide aus demselben Treffer bedienen
koennen.

**Was das praktisch bedeutet:** Ein Mythic von 1 auf 20 kostet rund 1.555
Materialpunkte. Der Testaccount besitzt 1.169 Legendaries und 341 Epics --
also ungefaehr ein komplettes Inventar pro Item. Nicht das Geld ist die
Schranke (34,3 Mrd. vorhanden), sondern das Material. Ein „Upgrade
Gear"-Button sollte deshalb vorrechnen, wie weit der Bestand ueberhaupt
reicht, statt blind zu starten.

Nebenbei live bestaetigt: die Resonanz stieg mit dem Level von 0,1 auf 0,2
Prozentpunkte, exakt die 0,1 pro Level aus Abschnitt 2.

Das Pagineren des Inventars nutzt `{action:'market_get_armor',
id_member_armor}` und erwartet `{items: [...], success}`; leere `items`
beenden die Liste. Das ist derselbe Vertrag, auf dem `Shop.ts`
(`checkAjaxComplete`) schon laeuft, aber fuer den Optimierer nicht eigens
live nachgemessen.

---

## 6. Offen

- Wie gross der Effekt praktisch ist -- client-seitig nicht messbar (s.o.).
- Ob die Theme-Achse dieselbe Schwelle benutzt wie das Domination-System
  (gemessen: ``theme_elements`` ist ab 3 Girls eines Elements gesetzt, sonst
  leer = Balanced). Plausibel, aber fuer die Resonanz nicht bestaetigt.
- Ob Girl- und Spieler-Resonanzen in denselben Topf laufen. Der
  Recruit-Artikel sagt, die Boni der Girl-Ausruestung im aktuellen Team
  gehen „to the Hero in the end calculation" -- also vermutlich ja.
- Wie Material genau gewichtet wird. Sieben Epics deckten einen Bedarf von
  20, `skin.weight` nimmt Werte 1, 3, 5, 6 an -- plausibel, aber nicht
  nachgerechnet. Die Automatik braucht es nicht: sie liest den Bedarf von der
  Seite und laesst „Auto Select" waehlen.
- Was ein Level jenseits des ersten kostet. Gemessen ist nur 1 -> 2 mit
  1.000.000 Geld; ein Lauf von 1 auf 20 verbrauchte 1.206 Items
  (alle 334 Epics und 872 Legendaries).
