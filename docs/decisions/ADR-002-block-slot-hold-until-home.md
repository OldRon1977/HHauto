# ADR-002: Block haelt den Run-Slot bis Home (gate-hold-return)

- Status: Accepted
- Datum: 2026-06-13
- Release-Linie: v7.37.0 (Roadmap Schritt 17)
- Verfeinert: ADR-001 (Pipeline-Block-Architektur)
- Ausloeser: zwei Live-Tests (v7.36.4/v7.36.5) zeigten pre-existing
  Ping-Pong-Loops (LV-28 Season fight<->collect, LV-29 PoP<->ClubChampion).

## Kontext

Nach der 1:1-Adapter-Verdrahtung (Task 6) sind alle 33 Handler single-step:
sie machen pro Invocation EINE Aktion (typisch: von Home zur Feature-Seite
navigieren) und melden sofort "fertig". Die eigentliche Arbeit passiert erst
bei der naechsten Invocation auf der Zielseite.

Zwei Handler, die gegensaetzliche Seiten wollen (Season:/season_arena vs
SeasonCollect:/season; PoP:/pop vs ClubChampion:/clubs), navigieren sich
gegenseitig weg. Die `lastActionPerformed`-Koordination greift nicht: der
AutoLoop-Reset (`ctx.busy===false -> lastActionPerformed='none'`) loescht den
Token auf dem busy-freien Tick zwischen zwei Reloads. Resultat: Mutual
Starvation, keiner erreicht seinen Arbeits-Step. (Lesson
pipeline-multireload-continuation-verlust.)

Cooldowns werden eingehalten -> kein Scheduler-Bug; die Loops sind
pre-existing (auch auf 7.36.x-main), der Adapter reproduziert sie faithfully.

## Entscheidung

Jeder Block durchlaeuft **gate -> hold -> return-home -> release**, vom
Scheduler verwaltet:

1. **Gate (claim):** Der Scheduler startet einen BlockRun -> der Block besitzt
   den einzigen aktiven Slot (R4.1/R4.2). Persistiert (sessionStorage),
   ueberlebt Reload.
2. **Hold:** Solange der Block agiert, behaelt er den Slot ueber Reloads
   hinweg. Kein anderer Block kann starten. Continuation lebt im persistenten
   BlockRun statt im `lastActionPerformed`-Token -> der Token-Reset wird
   irrelevant.
3. **Return + Release:** Der Run endet, wenn der Handler idle wird (nichts mehr
   zu tun) -- idealerweise zurueck auf Home.

### Mechanismus (Adapter-Wrapper, nutzt die BlockRun-`repeat`-Mechanik)

Der Adapter (BlockPipeline.toBlock) umhuellt jeden Legacy-Handler-Step:

```
const r = await originalStep.fn(ctx);
if (!r.ok) return r;                       // Fehler -> Abort (Watchdog)
return ctx.busy ? { ok: true, repeat: true }  // agiert -> Slot halten, nach Reload re-entern
                : { ok: true };               // idle -> Run beenden, Slot frei
```

`ctx.busy` (vom Handler gesetzt, wenn er navigiert/handelt) ist das Hold-Signal.
`repeat` haelt den BlockRun am selben Step; nach dem Reload re-entert der
Scheduler denselben Block und der Handler macht -- jetzt auf der neuen Seite --
den naechsten Schritt. Wird der Handler idle (busy=false), endet der Run.

### Konsequenz fuer den Restplan

- Der Slot-Hold loest die Ping-Pong-Klasse **flaechig** (alle Handler), nicht
  nur die 4 aus der Zerlegungsliste.
- **Buendelung (alt Task 8) und ein Grossteil der Multi-Step-Zerlegung (alt
  Task 10-13) sind fuer die KORREKTHEIT nicht mehr noetig** -- Season haelt den
  Slot durch fight->...->home, DANN laeuft SeasonCollect. Sie werden optionale
  Verfeinerungen (z.B. PoP-Per-Item-Repeat-Cursor, Quest-Sub-Pfade fuer feinere
  At-most-once/Reload-Sicherheit), kein Loop-Fix mehr.
- **Folge-Arbeit (R "alle Bloecke sauber gaten/holden/returnen"):** Handler,
  die ihre Arbeit beenden OHNE nach Home zu navigieren (sie verlassen sich auf
  handleGoHome), releasen mit diesem Mechanismus off-home. Diese muessen
  identifiziert und mit einem expliziten Home-Return versehen werden, damit
  jeder Block sauber daheim released. Bis dahin faengt handleGoHome / der
  naechste Block den off-home-Release ab (degradiert, aber sicher).

## Risiken / Sicherheitsnetze

- **Endlos-Hold** (Handler wird nie idle): faengt der Run-Total-Timeout
  (Watchdog R5.1) -> Abort -> Cooldown -> Home-Routing. totalTimeoutMs ggf.
  pro Block grosszuegiger setzen (z.B. PoP mit vielen Per-Item-Reloads).
- **Doppel-Aktion** bei einem busy=true-Handler ohne Navigation (re-entry auf
  derselben Seite): die Handler-internen Timer/State verhindern Re-Aktion in
  der Regel; pro Welle live verifizieren.
- Verhaltensaendernd (es IST der Bugfix) -> Live-Test pro Welle, Vergleich
  gegen 7.36.x.

## Alternativen

- **Pro-Handler-Zerlegung aller ~25 navigate-then-work-Handler:** sauber, aber
  Grossteil des Refactors; der generische Slot-Hold erreicht dieselbe
  Loop-Wirkung mit einer zentralen Aenderung. Zerlegung nur noch dort, wo
  feinere Schritt-Semantik gebraucht wird.
- **Bei `lastActionPerformed` bleiben + Reset reparieren:** behandelt nur das
  Symptom (Token-Reset) und nicht die fehlende reload-feste Continuation; der
  BlockRun-Slot-Hold ist die strukturelle Loesung.

## Validierung

Validiert Requirements 4.1/4.2 (at-most-one-run, ununterbrochen) und 4.4/4.11
(reload-feste Continuation ersetzt lastActionPerformed). Live-Verifikation:
PoP/ClubChampion und Season-Ping-Pong verschwinden; Happy-Path sonst identisch.
