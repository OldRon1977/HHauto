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

Zwei Zahlen pro Topf sind zu unterscheiden: `amount/max_amount` aus dem
Objekt und die Anzeige in der Kopfleiste. Die Kopfleiste zeigt eine kleinere
zweite Zahl (Beispiel: Objekt `85/1000`, Kopfleiste `85/58`). Welche Groesse
die Kopfleiste nennt, ist **nicht gemessen** -- vermutlich die
Regenerationsgrenze. Wer die Kopfleiste als Maximum liest, zieht falsche
Schluesse ueber verfallende Energie.

`fight` ist auf einem jungen Konto die knappe Ressource: sie regeneriert
langsam, und jeder Questkampf kostet davon. `quest` liegt deutlich hoeher.

## Zwei Messfallen

**Der Serverstand und die Anzeige koennen auseinanderlaufen.** Am 2026-09-09
zeigten laufende Sitzungen Level 30, waehrend vier unabhaengige Aufrufe --
Erstaufruf, Reload, Cache-Buster-Parameter und eine andere Seite, alle mit
abgeschaltetem Browser-Cache -- uebereinstimmend Level 17 lieferten.
Massgeblich ist der Server. **Nicht geklaert** ist, wodurch die Differenz
entsteht; solange das offen ist, gilt jede Aussage ueber Fortschritt nur mit
einer frischen Abfrage daneben.

**Eine Quest-URL aus einer alten Seite fuehrt ins Leere.** Navigiert man auf
eine bereits erledigte Quest, antwortet das Spiel mit "Something went wrong.
Please try again." und laesst den Weiter-Knopf ausgegraut. Der Questpfad
gehoert vor jedem Lauf frisch aus `Hero.infos.questing.current_url` gelesen.

## Verweise

- `src/Module/Quest.ts` -- Knopftypen, Popup-Behandlung, `questRequirement`
- `src/Module/Troll.ts` -- `getLastTrollIdAvailable`, `getTrollIdToFight`
- `src/config/game/HentaiHeroesVars.ts` -- `trollzList`, `trollIdMapping`
- `docs/decisions/ADR-011-a-dedicated-account-may-write.md` -- warum es ein
  Konto gibt, auf dem das gemessen werden darf
- `docs-internal/live-verification-lessons.md` -- warum eine Messung am
  falschen Ort einen Fehler erfindet
