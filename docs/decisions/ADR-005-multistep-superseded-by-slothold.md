# ADR-005: Multi-Step-Zerlegung (Tasks 10-13) durch Slot-Hold abgeloest

## Status
Accepted

## Datum
2026-06-14

## Kontext
Die Schritt-17-Spec sah vier Handler-Zerlegungen vor (Tasks 10-13): PlaceOfPower,
Quest, BossBang und ChampionTicket sollten in explizite Multi-Step-Bloecke mit
Repeat-Cursor, at-most-once-Marker und Resume-Validierung aufgeteilt werden.

Diese Tasks wurden VOR ADR-002 (Slot-Hold) spezifiziert. Ihr Zweck war
reload-feste Continuation: ein Mehr-Reload-Handler sollte ueber Reloads hinweg
nicht von anderen Handlern unterbrochen werden (Ping-Pong, Mythic-First-Visit).

Stand 2026-06-14, nach ADR-002 + dem No-Progress-Watchdog-Fix (v7.36.11): der
generische Slot-Hold haelt den einzigen aktiven BlockRun ueber Reloads, bis der
Block idle ist; der Watchdog killt lange Arbeit nicht mehr. Eine Code-Pruefung
der vier Handler ergab, dass ihre Ziel-Outcomes bereits erreicht sind:

- **PlaceOfPower:** `doPoP` arbeitet ueber den busy-Guard genau einen Powerplace
  pro Aufruf ab; `TK.PopToStart` (Storage) ist faktisch der Repeat-Cursor; bei
  leerer Liste Home-Routing. Live: 28 Powerplaces am Stueck bis `done`, kein
  Doppel.
- **Quest:** alle Sub-Pfade ($/*/P/battle) sind Branches mit
  `routeHomeIfWaitingOnQuest()` als Interim-Guard. Live (LV-10): Energie-Wait-
  Home-Routing bestaetigt.
- **BossBang:** ist bereits zwei getrennte Single-Step-Bloecke (Parse, Fight),
  sequenziert ueber Preconditions + Reload + Slot-Hold.
- **ChampionTicket:** der Doppelkauf-Race ist ueber `autoLoop=false` VOR dem
  setTimeout-Fenster + `busy=true` + precondition-recheck-on-resume abgesichert
  (zwei Writes decken zwei Race-Fenster, REVIEW_AutoLoop_Findings F1).

## Entscheidung
Tasks 10-13 werden NICHT als explizite Multi-Step-Zerlegung umgesetzt. Sie sind
durch ADR-002 (Slot-Hold) + den Watchdog-Fix abgeloest. Die Ziel-Outcomes
(reload-feste Continuation, at-most-once, ein Schritt pro Reload) sind im
bestehenden Code + Slot-Hold erreicht und live belegt.

## Verworfene Alternativen

### Tasks 10-13 voll umsetzen (explizite Multi-Step-Bloecke)
- Pro: formal sauberer; der Quest-Interim-Guard und der PoP-PopToStart-Cursor
  wuerden durch deklarative Steps ersetzt.
- Contra: verhaltensnaher Eingriff in vier funktionierende Handler ohne
  Korrektheits-Gewinn (Outcomes bereits erreicht); zusaetzlicher Live-Test-
  Aufwand und Regressionsrisiko vor dem 7.37.0-Release.
- Verworfen: Aufwand + Risiko ohne belegbaren Nutzen.

### Nur Task 11 (Quest) umsetzen, Rest schliessen
- Pro: ersetzt den als "interim" markierten Quest-Guard durch saubere Steps.
- Contra: der Interim-Guard funktioniert (LV-10 live); es ist Cleanup, keine
  Korrektur. Vor einem Release nicht noetig.
- Verworfen fuer 7.37.0; als optionales Cleanup ins Bugfix-Release nach 7.37.0
  verschiebbar (zusammen mit Task 14, lastActionPerformed).

## Konsequenzen
- Schritt 17 ist mit dem 7.37.0-Release funktional abgeschlossen; Tasks 10-13
  entfallen ersatzlos.
- Quest behaelt seinen Interim-Guard; das ist eine kleine Cleanup-Schuld, die
  optional ins Bugfix-Release nach 7.37.0 wandert.
- Caveat: Quest-Geld-/Power-Wait ($/P, LV-11/LV-12) und ein BossBang-Fight sind
  aus dem Code geschlossen, aber noch nicht live in einem Log gesehen. Es ist
  praeexistierendes 7.36.x-Verhalten, kein neues Risiko.

## Referenzen
- ADR-002 (Slot-Hold), ADR-001 (Block-Modell).
- Live-Belege: PENDING_LIVE_VERIFICATION LV-29/LV-32 (Ping-Pong/Watchdog),
  v7.36.11-Log (PoP 28 Powerplaces -> done), LV-10 (Quest-Home-Routing).
- Spec: .kiro/specs/pipeline-block-architecture/tasks.md (Tasks 10-13).
