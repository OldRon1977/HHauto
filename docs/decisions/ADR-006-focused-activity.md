# ADR-006: Ein Block behaelt die Pipeline, bis seine Arbeit getan ist

## Status
Accepted

## Datum
2026-08-22

## Release-Linie
v8.10.27 (Issue #1841)

## Verfeinert
ADR-002 (Slot-Hold) -- schliesst dessen offene Folgearbeit ab.

## Kontext

Franck-75 meldete in #1841, dass das Skript zwischen Aktivitaeten springt: ein
Troll-Kampf, ein Season-Kampf, ein Pantheon-Kampf, wieder von vorn. Sein Log
belegt es: 262 Runs, davon 143 `handleSeason`, 59 `handleTrollBattle`, 57
`handleGenericBattle` -- praktisch nur Wechsel.

Die Ursache ist eine Doppelbedeutung von `precondition` im Scheduler. Sie
beantwortet zwei verschiedene Fragen:

1. *"Darf dieser Block jetzt starten?"* -- `findNext`. Dafuer ist sie gedacht.
2. *"Ist dieser Block fertig?"* -- `continueRun` gibt den Slot frei, sobald sie
   false wird.

`handleTrollBattle` gibt Kampfergebnis-Seiten bewusst an `handleGenericBattle`
ab, damit das Belohnungs-Popup ausgelesen wird (#1740):

```ts
if (isGenericBattleResultPage(ctx.currentPage)) return false;
```

Nach jedem Kampf steht der Held auf genau so einer Seite. Der Block sagt "nicht
ich" und meint "gleich wieder" -- der Scheduler liest "fertig", gibt den Slot
frei und waehlt die Reihenfolge von oben neu. `handleGenericBattle` steht kurz
vor `handleGoHome` ganz hinten, `handleSeason` davor: Season gewinnt und
navigiert weg. Dasselbe Muster fuer jede Kampf-Aktivitaet.

ADR-002 hatte genau das als offene Folgearbeit benannt ("Handler, die ihre
Arbeit beenden OHNE nach Home zu navigieren, releasen off-home ... Bis dahin
faengt handleGoHome / der naechste Block den off-home-Release ab -- degradiert,
aber sicher"). Dieses ADR schliesst sie.

## Entscheidung

Der Scheduler fuehrt einen **Fokus**: die Aktivitaet, die die Pipeline gerade
zu Ende bringt. Persistiert in `sessionStorage` (`Temp_blockFocus`), weil der
interessante Fall ueber Reloads laeuft.

- Beendet ein Block einen Run, wird er der fokussierte Block.
- Solange der Fokus steht, waehlt `findNext` bevorzugt ihn; ist er nur durch
  sein eigenes `minInterval`/Cooldown blockiert, wartet die Pipeline (bis
  `focusWaitMs`), statt den Slot fuer einen Tick wegzugeben -- diese Uebergabe
  IST das Springen.
- Der Fokus faellt, sobald der Block aus einem anderen Grund als seiner eigenen
  Uhr nicht mehr laufen will: keine Energie, Schwelle erreicht, Timer gesetzt.
  Dann entscheidet wieder die Reihenfolge, und der naechste Block laeuft
  seinerseits bis zu seinem Ende durch.

Zwei Arten von Bloecken duerfen dazwischen (`runsDuringFocus`, und sie
uebernehmen den Fokus nie):

- **Die sechs Collect-Bloecke.** Ihre Belohnungen verfallen mit dem Event
  (`...RemainingTime < getLimitTimeBeforeEnd()`), sie duerfen nicht hinter einem
  Kampf warten, der laeuft, solange Energie da ist. Sie werden VOR dem
  fokussierten Block angeboten. Jeder setzt seinen eigenen Next-Timer, kann die
  Aktivitaet also nicht aushungern. (Nutzer-Entscheidung: "die collectall
  buttons MUeSSEN laufen duerfen".)
- **`handleGenericBattle`.** Die Kampfergebnis-Seite ist genau der Ort, an dem
  der fokussierte Block feststeckt; ihn auszusperren waere ein Deadlock.

**Nur ein Run, der etwas getan hat, haelt den Fokus.** Eine Precondition sagt,
dass ein Block laufen DARF, nicht dass er Arbeit hat: `handleTrollBattle` kommt
durch sein Tor und faellt durch, wenn die Kampfkraft unter der Schwelle liegt
oder kein Event-Maedchen da ist -- live gemessen 47 solche Ticks von 75
(Kommentar am Handler). Ein solcher Leerlauf-Run darf den Fokus nicht erneuern.
Als "getan" zaehlt, dass ein Step den Slot gehalten hat (`repeat`) -- das
Slot-Hold-Signal aus ADR-002, mit dem der Handler sagt, dass er navigiert,
gekaempft oder gesammelt hat (`BlockRun.acted`).

Das ist nicht theoretisch: ohne diese Bedingung parkte 8.10.27 die Pipeline auf
`handleTrollBattle`. Der Block lief alle vier Sekunden an, tat nichts, erneuerte
dabei den Fokus -- womit auch `focusStaleMs` nie greifen konnte, weil es an
genau diesem Zeitstempel haengt -- und in den Pausen dazwischen bekam kein
anderer Block den Slot ueberhaupt angeboten.

**Wo `acted` gesetzt wird, ist nicht beliebig.** Der naheliegende Ort -- nach
der Rueckkehr des Steps -- reicht nicht: ein kaempfender Handler `await`et den
Kampf-POST, dessen Antwort die Seite navigiert, und der Step kehrt nie zurueck.
Der Schreibvorgang stirbt mit der Seite, der Run kommt nach dem Reload ohne
Marker zurueck und wird als Leerlauf behandelt. Gemessen in 8.10.29: drei
Troll-Runs gaben nach einem echten Kampf den Fokus als "ran without doing
anything" frei, und genau drei fremde Bloecke (League, Quest, Season) starteten
danach auf `troll-battle`.

Deshalb wird der Marker an zwei Stellen gesetzt: beim `repeat` (Handler, die
zurueckkehren, bevor sie navigieren) und **beim gueltigen Resume nach einem
Reload** -- denn wieder da zu sein beweist, dass navigiert wurde. Die zweite
Stelle schreibt auf einer frischen Seite und ueberlebt daher.

Gegen einen Fokus, der nie bedient werden kann, gibt es zusaetzlich
`focusStaleMs` (5 min ohne Run des fokussierten Blocks): dann faellt der Fokus,
und das Verhalten degradiert exakt auf den Stand vor diesem ADR.

## Kein Sonderfall fuer Uhrzeiten

Geprueft, weil die naheliegende Sorge ist, dass ein langer Fokus etwas
Fristgebundenes verpasst:

- `waitforContest` ist eine **Bremse, keine Frist**: `canCollectCompetitionActive`
  wird false, wenn der laufende Contest in weniger als `safeSecondsForContest`
  endet UND ein naechster ansteht -- also "noch nicht, heb es auf". Sie wirkt
  ohnehin durch die Preconditions; ein gebremster Block ist nicht bereit und
  verliert den Fokus.
- Die Collect-Fenster sind echte Fristen, aber `getLimitTimeBeforeEnd()` ist
  `collectAllTimer` in **Stunden** (Standard 12). Ein Fokus dauert Minuten.
  Trotzdem duerfen sie unterbrechen, siehe oben.

Damit braucht der Fokus keine Zeit-Ausnahme.

## Verworfene Alternativen

### Jedem Kampf-Block einen eigenen Ruecklauf von der Ergebnisseite geben
Der Wortlaut der ADR-002-Folgearbeit. Der Block wuerde die Ergebnisseite selbst
verlassen und damit den Slot nie freigeben.
- Contra: Er muesste dort das Belohnungs-Popup auslesen -- genau die Logik, die
  #1740 bewusst in `handleGenericBattle` zentralisiert hat. Die Duplizierung in
  sieben Handlern holt den Bug zurueck, den #1740 geschlossen hat.
- Verworfen: falscher Ort. Die Freigabe-Entscheidung ist ein Scheduler-Thema.

### Bloecke buendeln (Kampf + GenericBattle als ein Block)
- Contra: ADR-004 hat Buendelung verworfen, und die Gruende gelten weiter --
  die Mitglieder stehen nicht nebeneinander, Buendeln erzwingt eine
  Reihenfolge-Aenderung.
- Verworfen: ADR-004 bleibt unangetastet, der Fokus braucht keine Buendelung.

### `precondition` in zwei Praedikate pro Handler aufteilen
Ein zusaetzliches `wantsMore(ctx)` je Block ("habe ich noch Arbeit"), getrennt
von "darf ich jetzt".
- Pro: sagt die Absicht am deutlichsten.
- Contra: 33 Handler muessten ein zweites Praedikat bekommen, das ihre interne
  Ressourcenlogik (Energie, Schwellen, Timer) nach aussen spiegelt -- eine
  Kopie, die auseinanderlaufen kann. Der Fokus braucht sie nicht: die
  bestehende Precondition beantwortet die Frage bereits, sobald man aufhoert,
  ihr "false" als "fertig" zu lesen.
- Verworfen: doppelte Wahrheit fuer keinen zusaetzlichen Nutzen.

## Konsequenzen

- Eine Aktivitaet laeuft bis zu ihrem eigenen Ende durch, dann die naechste.
- Nebenbei behoben: ein fremder Block konnte auf einer Kampfergebnis-Seite
  starten und wegnavigieren, bevor die Belohnung ausgelesen war. Im Log von
  #1841 zu sehen (`handleSeason ... page=troll-battle ev=start`). Nur
  `handleTrollBattle` hatte den Seiten-Verzicht aus #1740; jetzt schuetzt der
  Fokus die Seite unabhaengig davon, welcher Block kaempft.
- Die Pipeline kann kurz leerlaufen, waehrend sie das `minInterval` des
  fokussierten Blocks abwartet (4 s bei Trollen, 2 s sonst). Das ist der Preis
  dafuer, den Slot nicht fuer einen Tick wegzugeben.
- Neuer Log-Event `ev=focus` mit dem Grund der Freigabe -- ohne
  Diagnose-Schalter sichtbar, damit der naechste Nutzer-Log zeigt, ob der Fokus
  greift.

## Referenzen
- Issue #1841 (Log: `HH_DebugLog_1787359678332.log`), Issue #1740.
- ADR-001 (Block-Modell), ADR-002 (Slot-Hold), ADR-004 (keine Buendelung).
