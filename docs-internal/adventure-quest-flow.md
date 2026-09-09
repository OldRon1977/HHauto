---
last-verified: 2026-09-09
verified-against-version: v8.12.6 HHAuto, hentaiheroes.com
status: current
sources:
  - Live-Messung auf einem eigenen Pruefkonto (ADR-011), Welt 1 bis 3, Level 5 bis 17
  - HHAuto Code (Module/Quest.ts, Module/Troll.ts, config/game/HentaiHeroesVars.ts)
---

# Adventure und Hauptquest, gemessen

Was der Ablauf "Adventure" auf einem jungen Konto wirklich liefert: welche
Knoepfe die Questseite traegt, welche Dialoge sie blockieren, und woran man
erkennt, ob ein Questgegenstand gefallen ist.

Alles hier ist **gemessen** am 2026-09-09, sofern nicht als Ableitung
gekennzeichnet. Kontokennungen und Spielernamen stehen nicht drin.

## Der Weiter-Knopf

`Quest.ts` liest den Typ als `id` des ersten Treffers von
`#controls button:not([class*='ad_'])`. Gemessene IDs:

| `id` | Bedeutung | Kosten |
|---|---|---|
| `free` | naechster Schritt ohne Kosten | - |
| `pay` | naechster Schritt gegen Ressource | Geld (100-250) oder 1 Quest-Energie |
| `use_item` | Questgegenstand einsetzen | der Gegenstand |
| `battle` | Questschritt verlangt einen Kampf | Kampfenergie |
| `end_play` | Quest zu Ende, danach Reward-Popup | - |
| `skip-quest` | in Welt 1 gesehen, wechselte sich mit `free` ab | 0-1 Quest-Energie |

### Was ein Schritt kostet

Ueber 342 protokollierte `pay`-Schritte:

| Welt | Schritte | Quest-Energie je Schritt |
|---|---|---|
| 1 | 4 | durchweg 1 |
| 2 | 137 | durchweg 1 |
| 3 | 201 | 1 bis 6, Schwerpunkt 2 bis 4 |

Die Zuordnung Quest-ID zu Welt ist aus den beobachteten IDs **abgeleitet**
(unter 200 Welt 1, unter 300 Welt 2, darueber Welt 3), nicht aus einem Feld
gelesen. Gemessen ist die Kostenverteilung.

Ab Welt 3 ist damit nicht mehr die Zahl der Schritte der Engpass, sondern die
Quest-Energie -- und sobald ein Schritt einen Kampf verlangt, die Kampfenergie,
die mit 1800 s je Punkt nachwaechst.

`skip-quest` kommt im Quelltext nicht vor (grep, 0 Treffer) und faellt damit in
den `else`-Zweig von `Quest.ts`, der `questRequirement=unknownQuestButton`
setzt. **Nicht gemessen** ist, ob dabei gleichzeitig ein bekannter Knopf im
`#controls` steht; nur dann waere der Zweig zwangslaeufig. Im `#controls` steht
neben dem Weiter-Knopf regelmaessig ein Werbeknopf
(`blue_text_button ad_quest`, Text "Go!") ohne `id` -- den filtert der
Selektor korrekt weg.

## Dialoge, die den Weiter-Knopf blockieren

Ein offener Dialog laesst den Weiter-Knopf ausgegraut zurueck. Wer nur auf den
Knopf schaut, meldet einen Haenger, der keiner ist.

| Dialog | Schliessen ueber |
|---|---|
| `#level_up.popup.hero_leveling` | **nur** `button.blue_button_L` ("Ok") -- kein `close`-Element, auch kein verstecktes |
| `#simple_text_popup.popup` (Wartungsmeldung) | `close.closable` |
| `#no_HC` | `close.closable` |
| `#rewards_popup` | `button.blue_button_L` / `button.purple_button_L` |

`close` als **Elementname** existiert also wirklich; die Selektoren in
`Quest.ts`, die danach suchen, sind kein Tippfehler. Fuer `#level_up` greifen
sie trotzdem ins Leere -- daher der Zusatzklick auf den Ok-Knopf (v8.12.6).

Ab Level 30 traegt `#level_up` **zwei** Knoepfe: "Ok" und "Go to Hero
Leveling", in dieser Reihenfolge. Der Fix nimmt `.first()` und trifft damit
"Ok". Kehrt das Spiel die Reihenfolge um, navigiert das Skript mitten in der
Quest weg. Nach Text zu greifen scheidet aus: die Oberflaeche ist mehrsprachig.

## Questgegenstand

Verlangt ein Schritt einen Gegenstand, zeigt die Seite oben rechts ein Feld
"You need" mit dem Gegenstand und einem Zaehler, daneben "Dropped by" mit dem
Gegner, der ihn fallen laesst.

Der Zaehler steht in `#controls .item span` -- derselbe Selektor, den
`Quest.ts` beim Typ `use_item` schon liest. Er ist die Rueckmeldung, ob der
Gegenstand da ist: vor dem Kampf `0`, nach einem erfolgreichen Kampf bietet die
Quest `use_item` an.

Gemessen: **ein** Kampf genuegte in allen vier beobachteten Faellen. Ob das
immer so ist, ist damit nicht gezeigt -- die Fallrate ist nicht gemessen.

## Troll-Freischaltung

`Troll.getLastTrollIdAvailable` leitet den letzten verfuegbaren Troll aus
`Hero.infos.questing.id_world` ab: ohne Eintrag in `trollIdMapping` gilt
`id_world - 1`. Die Namen stehen in `HentaiHeroesVars.getTrolls`, hier nicht
kopiert.

| Welt | letzter Troll | gemessen |
|---|---|---|
| 1 | 0, also keiner | `troll-pre-battle.html?id_opponent=1` antwortet "Troll not available yet!" |
| 2 | 1 | Kampf gegen Troll 1 laeuft, Gegnername laut `trollzList[1]` |

Die Seite ohne verfuegbaren Troll traegt **kein** `shared.Hero` und keine
Knoepfe; HHauto initialisiert dort nicht und kann sie nicht verlassen. Deshalb
darf kein Rueckfallpfad einen Troll erzwingen, wenn keiner frei ist (ADR-011,
v8.12.5, Issue #1875 fuer die Variante mit Seiten-Trollen).

## Energien

`shared.Hero.energies` traegt mehrere Toepfe. Auf dem Pruefkonto gemessen:
`quest`, `fight`, `challenge`, `kiss`, `worship`, `reply`, `drill`.

Jeder Topf traegt drei Zahlen: `amount`, `max_regen_amount` und `max_amount`.
Die Kopfleiste zeigt `amount / max_regen_amount`, nicht `max_amount`. Gemessen
in einer Ladung, fuer beide sichtbaren Balken gleichzeitig:

| Kopfleiste | `amount` | `max_regen_amount` | `max_amount` |
|---|---|---|---|
| `174/82` | 174 | 82 | 1000 |
| `3/13` | 3 | 13 | 200 |

`max_regen_amount` ist die Grenze, bis zu der von selbst nachwaechst; darueber
kommt Energie nur aus Aufstiegen und Gegenstaenden. Steht `amount` darueber
(174 von 82), ruht die Regeneration -- der Ueberschuss verfaellt nicht, waechst
aber auch nicht nach.

Das Skript liest an allen sechs Stellen `max_regen_amount`
(`Quest`, `Troll`, `League`, `Pantheon`, `PentaDrill`, `Season`);
`max_amount` steht nur im Typ `KKEnergy`. Es rechnet damit mit derselben
Grenze wie die Anzeige -- geprueft 2026-09-09, kein Handlungsbedarf.

`seconds_per_point` nennt die Nachwachszeit: Quest 450 s, Fight 1800 s,
Challenge 2100 s, Kiss 3600 s, Drill 3600 s, Worship 8640 s, Reply 10800 s.
`fight` ist damit auf einem jungen Konto die knappe Ressource, und jeder
Questkampf kostet davon.

## Zwei Messfallen

**Das Spiel liefert keinen einheitlichen Heldenzustand.** Zwei Seitenaufrufe
mit sechs Sekunden Abstand, beide mit abgeschaltetem Browser-Cache und beide
mit eigener `server_time`, trugen unterschiedliche Werte:

| Feld | Aufruf A | Aufruf B |
|---|---|---|
| `infos.level` | 36 | 17 |
| `infos.Xp.cur` | 83716 | 36389 |
| `infos.caracs.endurance` | 1418 | 734 |
| `infos.questing.step` | 310052 | 310052 |

Ueber zwei Messschleifen mit je eigener Browsersitzung pro Lesung:

| Schleife | Lesungen | frisch | veraltet | Anteil |
|---|---|---|---|---|
| 1 | 12 | 6 | 6 | 50 % |
| 2 | 16 | 8 | 8 | 50 % |
| zusammen | 28 | 14 | 14 | **50 %** |

Es ist kein Nachhinken, sondern **zwei feste Momentaufnahmen im Wechsel**: die
veralteten Lesungen tragen immer exakt dieselben Werte (Level 17, Xp 36389,
endurance 734), nie etwas dazwischen. Beide Seiten sind gleich betroffen, und
`questing.step` war in allen 28 Lesungen aktuell.

Gemessen ist die Verteilung. **Geschlossen**, nicht gemessen, ist die Ursache:
zwei Backend-Knoten mit unterschiedlichem Cache-Stand wuerden das Bild
erklaeren, geprueft ist das nicht.

Rohdaten liegen ausserhalb des Repos unter
`~/.config/hhauto-claude/account/measurements/`.

Fortschritt geht dabei **nicht** verloren; eine spaetere Abfrage bestaetigte
alle Stufen. Wer aber aus einem einzelnen Aufruf schliesst, misst unter
Umstaenden einen Stand von vor Stunden. Eine Aussage ueber den Kontostand
braucht mehr als eine Lesung.

Fuer das Skript hat das Folgen: `HeroHelper.getLevel()` speist die
`>= LEVEL_MIN_*`-Bedingungen von sechs Modulen -- Pantheon (15), Sultry
Mysteries (15), League (20), Path of Glory (30), Path of Valor (30) und
Double Penetration (40). Pantheon prueft ueber `decideIsEnabled` statt mit
einem direkten Vergleich; wer nur nach `getLevel() >=` sucht, uebersieht es. Bei einer Rate von 50 Prozent
trifft es im Schnitt jede zweite Seitenladung; eine Seite, die zu niedrig
ausliefert, behaelt diesen Wert fuer ihre gesamte Lebensdauer,
und die betroffenen Module melden `isEnabled() === false`, ohne Fehler und ohne
Logzeile. Seit v8.12.7 merkt sich `getLevel` deshalb den Hoechststand
(`Temp_heroMaxLevel`) und faellt nicht darunter.

**Eine Quest-URL aus einer alten Seite fuehrt ins Leere.** Navigiert man auf
eine bereits erledigte Quest, antwortet das Spiel mit "Something went wrong.
Please try again." und laesst den Weiter-Knopf ausgegraut. Der Questpfad
gehoert vor jedem Lauf frisch aus `Hero.infos.questing.current_url` gelesen.

## Ein gesperrtes Event sieht aus wie ein offenes

Ist ein Event fuer das Konto gesperrt, rendert das Spiel den Reiter trotzdem:
`.event-title.active` traegt den angeforderten Tab samt eigenem `href`. Fuer
`EventModule.getDisplayedIdEventPage()` ist das nicht von einem offenen Event
zu unterscheiden -- die Funktion liefert die Event-ID, nicht den leeren String,
auf den die Ausstiegsklappe prueft.

Gemessen ueber vier Reiter desselben Kontos (ein gesperrter, drei offene):

| Merkmal | gesperrt | offen |
|---|---|---|
| `.event-title.active` mit href | ja | ja |
| `#events .nc-panel` | 1 | 1 |

Das `nc-panel`, das die Sperrmeldung traegt, steht also auch auf jeder
spielbaren Seite. **Ein DOM-Merkmal, das die beiden Faelle trennt, ist nicht
gefunden.** Der Text der Meldung waere eines, ist aber uebersetzt.

Deshalb prueft das Skript seit v8.12.8 die Bedingung selbst, statt sie der
Seite anzusehen: `PathOfAttraction.isEnabled()` verlangt zehn Maedchen und
Welt 2, gleiche Bauart wie `PlaceOfPower.isEnabled()`. Ohne diese Pruefung
lief die Sitzung in eine Schleife -- zwoelf von achtzehn Samples standen auf
der Event-Seite.

## Zwei Nebenbeobachtungen am Code

- `Events/LoveRaidManager.ts:263`: die Levelpruefung ist auskommentiert
  (`// && HeroHelper.getLevel() >= LEVEL_MIN_POG`). Love Raids haben damit
  heute keine Levelschwelle. Ob das Absicht ist, steht nicht dabei.
- `Events/DoublePenetration.ts:30`: der Kommentar nennt "And 10 girls", die
  Bedingung wird aber nicht geprueft -- nur das Level. Dieselbe Bauart, die
  bei Place of Power zur toten Seite gefuehrt hat, dort allerdings mit
  vorhandener Pruefung. **Nicht gemessen**, was die DP-Seite auf einem Konto
  unter zehn Maedchen ausliefert.

## Verweise

- `src/Module/Quest.ts` -- Knopftypen, Popup-Behandlung, `questRequirement`
- `src/Module/Troll.ts` -- `getLastTrollIdAvailable`, `getTrollIdToFight`
- `src/config/game/HentaiHeroesVars.ts` -- `trollzList`, `trollIdMapping`
- `docs/decisions/ADR-011-a-dedicated-account-may-write.md` -- warum es ein
  Konto gibt, auf dem das gemessen werden darf
- `docs-internal/live-verification-lessons.md` -- warum eine Messung am
  falschen Ort einen Fehler erfindet
