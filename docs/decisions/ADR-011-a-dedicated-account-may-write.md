# ADR-011: Ein eigenes Pruefkonto darf schreiben

## Status
Accepted

## Datum
2026-09-09

## Kehrt um
Die Regel im Abschnitt "Live gegen das Spiel messen" in `CLAUDE.md`:

> Schreibende Pruefungen bleiben Handarbeit; ein Pruefer, der kauft oder
> speichert, ist ein Bot mit anderem Namen.

Die Regel stand nie in einer ADR, deshalb benennt dieser Eintrag die
Textstelle statt einer Nummer.

## Kontext

Die Regel schuetzt das Konto des Maintainers. Sie kostet aber genau die
Pruefung, die am meisten wert waere: `scripts/live-check` liest nur, und
jsdom kennt keinen Spielserver. Damit bleibt jeder Pfad, der etwas
*veraendert*, bis zur Auslieferung ungeprueft -- Shop-Kauf, Ausruestung
anlegen, Booster ausruesten, Pachinko-Durchgang, Season-Belohnung.

Was das gekostet hat, steht in der Historie der letzten Releases. Fehler,
die nur ein schreibender Durchgang zeigt:

| Commit | Was erst im Spiel auffiel |
|---|---|
| `56d76a2` | ein abgelehnter Sandalwood-Equip wurde als getragen verbucht |
| `1a9ab49` | ein x-Durchgang am Pachinko lief weiter, obwohl keine Maedchen mehr zu gewinnen waren |
| `eb111b2` | die Upgrade-Warteschlange brach nach dem ersten Eintrag ab, weil das Material nicht gescrollt wurde |
| `ab30cc8` | das Einsammeln endete an dem Reload, den der Claim selbst ausloest |

Keiner dieser Fehler ist mit einem Lesetest zu finden. Alle vier zeigen
sich im zweiten Schritt einer Aktion, die den Serverzustand schon
geaendert hat.

`docs-internal/live-verification-lessons.md` haelt daneben die andere
Haelfte fest: eine Messung am falschen Ort erzeugt einen Fehler, den
niemand hat. Drei solcher Befunde wurden zurueckgezogen, einer erst nach
der Implementierung.

## Entscheidung

**Es gibt ein zweites Konto, das nur zum Pruefen existiert. Auf diesem
Konto ist schreibende Automatisierung erlaubt.**

- Das Konto des Maintainers bleibt unveraendert unter der alten Regel:
  dort wird gelesen, nicht geschrieben.
- Auf dem Pruefkonto laeuft HHauto mit `HHAuto_Setting_master=true` und
  entscheidet selbst -- Kaempfe, Missionen, Pachinko, Shop, Ausruestung,
  Einstellungen. Die Kobans dafuer erwirtschaftet es im Spiel.
- Der Zweck ist nicht Spielfortschritt. Der Fortschritt ist das Mittel:
  ein Konto ohne Ausruestung, ohne Season-Stufe und ohne volles Harem
  erreicht die Zustaende nicht, in denen die schreibenden Pfade laufen.

### Grenzen, die nicht verhandelbar sind

- **Kein echtes Geld.** Kobans werden erspielt. Ein Kauf gegen
  Zahlungsmittel findet nicht statt, auch wenn eine Strategie ihn
  nahelegt.
- **Zugangsdaten ausserhalb des Repos.** Sie liegen in
  `~/.config/hhauto-claude/account/`, nicht im Arbeitsbaum. Ein
  `.gitignore`-Eintrag waere schwaecher: er haelt `git add -f` nicht auf.
- **Die Konto-ID erscheint nirgends** -- nicht in Commits, PR-Texten,
  Issues, Messberichten oder Fixtures. Es gilt dieselbe Anonymisierung
  wie fuer Mitschnitte (eigenes Konto `1`, fremde ab `1000`).
- **Eine Sitzung pro Konto.** Das Pruefkonto laeuft im selben Spiel wie
  das des Maintainers. Beide duerfen nie gleichzeitig eingeloggt sein --
  die Cookies bleiben lokal gueltig, waehrend der Server die Intro-Seite
  ausliefert und jede Messung darauf plausibel und falsch ist.

### Was ein Befund vom Pruefkonto ist

Unveraendert das, was `CLAUDE.md` verlangt: am Aufrufort gemessen, Seite
und Zustand benannt, und getrennt notiert, welche Aussage aus der Messung
und welche aus einer Ableitung stammt. Ein schreibender Durchgang liefert
mehr Gelegenheiten fuer einen Fehlschluss, nicht weniger -- der
Serverzustand hat sich zwischen zwei Beobachtungen geaendert, und zwar
durch die eigene Aktion.

## Verworfene Alternativen

### Alles im Dry-Run (`master=false`)
Das Skript beobachten und protokollieren, was es tun *wuerde*.
- Contra: genau die vier Fehler oben zeigen sich im zweiten Schritt. Der
  erste Schritt sieht im Dry-Run korrekt aus; die Warteschlange bricht
  danach ab, der Reload kommt danach, die Ablehnung kommt vom Server.
- Verworfen: haette keinen der bekannten Fehler gefunden.

### Jede Koban-Ausgabe einzeln freigeben
- Contra: verlagert die Entscheidung, aendert das Risiko aber nicht --
  ausgegeben wird trotzdem. Und es macht genau den Teil unmoeglich, um
  den es geht: ob die *Haushaltslogik* des Skripts ueber Tage etwas
  Sinnvolles tut, zeigt sich nur, wenn sie sie selbst faellt.
- Verworfen: teuer in der Bedienung, ohne Gegenwert in der Aussage.

### Das Pruefkonto in ein anderes Spiel legen
Comix Harem statt Hentai Heroes -- getrenntes Konto, kein Zweitkonto im
selben Spiel.
- Contra: Fixtures, `docs-internal` und `scripts/live-check/checks.json`
  stammen von Hentai Heroes. Jede Abweichung waere erst zu messen, bevor
  ein Befund etwas ueber die ausgelieferte Konfiguration aussagt.
- Verworfen vom Maintainer zugunsten derselben Datenbasis. Das Risiko
  zweier Konten eines Betreibers ueber eine Adresse ist benannt und
  angenommen.

### Auf dem Konto des Maintainers schreiben
- Contra: ein Fehlgriff des Skripts trifft dann einen ueber Jahre
  gewachsenen Spielstand. Genau davor schuetzt die alte Regel, und dieser
  Teil von ihr bleibt.
- Verworfen: das Pruefkonto existiert, damit ein Fehlgriff nichts kostet.

## Konsequenzen

- Schreibende Pfade koennen vor der Auslieferung einmal gegen den echten
  Server gelaufen sein. Das ist eine Moeglichkeit, keine Zusage: geprueft
  ist, was jemand geprueft hat.
- `CLAUDE.md` traegt die Regel weiter, jetzt mit dem Zusatz, fuer welches
  Konto sie gilt, und mit Verweis auf diese ADR.
- Ein neuer Weg, Spielerdaten zu verlieren, ist entstanden: das Konto
  produziert Logs, Screenshots und Fixtures. `npm run check:player-data`
  und der Pre-Commit-Hook bleiben die Absicherung.
- Pruefstein: der naechste Fehler in einem schreibenden Pfad soll aus
  einem Durchgang auf dem Pruefkonto stammen und nicht aus einem
  Nutzer-Log nach dem Release.

## Referenzen
- `CLAUDE.md`, Abschnitt "Live gegen das Spiel messen"
- `docs-internal/live-verification-lessons.md` -- warum eine Messung am
  falschen Ort einen Fehler erfindet
- `scripts/live-check/README.md` -- der lesende Checker, der bleibt, was
  er ist
- `~/.config/hhauto-claude/account/README.md` (nicht im Repo) -- wo die
  Zugangsdaten liegen und warum dort
