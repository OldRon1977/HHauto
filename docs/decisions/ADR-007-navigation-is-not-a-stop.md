# ADR-007: Eine Navigation ist kein Stopp, und Heimgehen kann ein Abschluss sein

## Status
Accepted

## Datum
2026-08-26

## Release-Linie
v8.10.49, ausgeliefert mit v8.10.0 (Issue #1841)

## Verfeinert
ADR-002 (Slot-Hold) und ADR-006 (Fokussierte Aktivitaet).

## Kontext

Ein Block, der navigiert, haelt seinen Slot, damit er nach dem Reload
weitermachen kann (ADR-002). `gotoPage` und `safeReload` schalten dabei
`Temp_autoLoop` aus, unmittelbar bevor die Seite verschwindet. Der
Stop-Check am Anfang von `tick()` las genau dieses Flag als "das Skript
wurde gestoppt" und verwarf den laufenden Run:

```ts
if (this.ports.isMasterOff() || this.ports.isAutoLoopOff()) { ...abort... }
```

Gemessen an einem Nachtlauf auf 8.10.48 (16 h Log, 14.642 Zeilen):

| Befund | Wert |
|---|---|
| Abbrueche gesamt | 13 (12x `handlePlaceOfPower`, 1x `handleAutoEquipBoosters`) |
| letzter Schritt davor | 13x `detail=repeat` -- der Block hielt seinen Slot |
| Abstand zum vorherigen "setting autoloop to false" | 1,9-2,0 s (11x), einmal 1,1 s, einmal 5,0 s |
| `Setting_master` waehrend der Nacht | `true` |
| `handlePlaceOfPower` | 12 Starts, 0 `run complete`, 12 Abbrueche |

2,0 s ist genau ein Scheduler-Tick. Kein einziger dieser Abbrueche hatte
mit dem Master-Schalter zu tun, obwohl alle als `detail=master-off`
protokolliert wurden -- die Meldung nannte beide Bedingungen gleich.

Die zweite Haelfte zeigte sich im selben Log. `handlePlaceOfPower` macht
genau das Richtige, wenn nichts mehr zu starten ist: Liste loeschen, nach
Hause navigieren, `{ok: true}` zurueckgeben -- also *fertig*. Die
Slot-Hold-Regel kann eine abschliessende Navigation aber nicht von einer
Zwischennavigation unterscheiden: `ctx.busy` ist in beiden Faellen gesetzt,
also wurde daraus `repeat`, und der naechste Tick verwarf den gehaltenen
Run. In 5 der 12 Faelle ging es nach `home.html` (der Abschlussfall), in 7
auf eine `pop_id=N`-Seite (mitten in der Arbeit).

Der Schaden war begrenzt -- der Inline-Stop-Pfad zaehlt keinen Fehler,
setzt keinen Cooldown und loest kein Auto-Disable aus, und PoP hat in der
Nacht 36 Powerplaces gestartet. Verloren ging der Laufzustand: PoP baute
`popToStart` jedes Mal neu auf, statt seinen Durchgang fortzusetzen.

## Entscheidung

**Die beiden Stoppbedingungen werden getrennt.**

- `isMasterOff()` bleibt der Stopp: der Nutzer sagt Halt, der Run wird
  verworfen, der Fokus faellt. Unveraendert.
- `isAutoLoopOff()` ist **kein** Stopp mehr, sondern eine Pause. Haelt ein
  Run gerade den Slot, ueberspringt der Tick nur; der Run bleibt. Steht das
  Flag laenger als `navigationGraceMs` (30 s) auf aus, wird der Run
  verworfen wie bisher -- unter eigenem Namen (`detail=autoloop-off`).

Die 30 Sekunden trennen die beiden Faelle, die das Flag ausloesen: eine
Navigation ist in Sekunden vorbei, die Paranoia-Ruhephase dauert Minuten
bis Stunden.

**Ein Handler kann "fertig" sagen.** `{ok: true, done: true}` ueberlebt
`applySlotHold`, statt in `repeat` umgeschrieben zu werden.
`handlePlaceOfPower` gibt es zurueck, wenn seine Liste leer ist und es nach
Hause geht.

## Verworfene Alternativen

### Auf `run.dispatched` pruefen
Der naheliegende Weg: den Run nur schuetzen, solange er als navigierend
markiert ist.
- Contra: `dispatched` wird nur fuer Schritte mit `stateChanging: true`
  gesetzt, und **kein** Schritt ist so markiert -- im Nachtlauf steht
  `ev=dispatch` null Mal. Die Bedingung waere immer falsch gewesen.
- Verworfen: haette nichts geaendert. (Der Vorschlag stand kurz im Raum und
  wurde durch die Messung widerlegt, bevor er gebaut wurde.)

### Das Flag beim Navigieren gar nicht mehr ausschalten
- Contra: `Temp_autoLoop` bremst waehrend einer laufenden Navigation
  bewusst alles andere aus. Es zu behalten und nur seine *Deutung* im
  Scheduler zu korrigieren, aendert eine Stelle statt 45 Schreibstellen.
- Verworfen: groesserer Eingriff, gleiches Ergebnis.

### `applySlotHold` erkennen lassen, dass es nach Hause ging
Aus der Zielseite schliessen, ob die Navigation ein Abschluss war.
- Contra: eine Heimnavigation ist nicht immer ein Abschluss (Quest fuellt
  Ressourcen nach und kommt zurueck). Die Regel waere geraten, genau wie die
  `acted`-Heuristik, die ADR-006 schon drei Nachbesserungen gekostet hat.
- Verworfen: der Block weiss es, also soll er es sagen.

## Konsequenzen

- Ein gehaltener Run ueberlebt seine eigene Navigation.
- Die Logmeldung nennt die Ursache: `master-off` oder `autoloop-off`. Die
  Verwechslung, die diese Untersuchung um einen Tag verzoegert hat, kann im
  naechsten Nutzer-Log nicht mehr passieren.
- Bloecke, die nach getaner Arbeit heimgehen, koennen das ausdruecken. Wer
  `done` nicht setzt, verhaelt sich exakt wie vorher.
- Pruefstein fuer den naechsten Nachtlauf: `handlePlaceOfPower` muss
  `ev=done detail=run complete` zeigen statt `ev=abort`.

## Referenzen
- Issue #1841, ADR-002 (Slot-Hold), ADR-006 (Fokussierte Aktivitaet)
- `src/Service/BlockScheduler.ts` (`tick`, Stop-Check), `src/Service/BlockPipeline.ts` (`applySlotHold`)
- `docs-internal/exit-condition-concept.md` -- die offene Frage, ob die
  `acted`-Heuristik ganz durch ein Praedikat des Blocks ersetzt wird
