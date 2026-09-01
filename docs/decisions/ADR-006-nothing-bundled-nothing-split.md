# ADR-006: Weder gebündelt noch zerlegt — die Handler bleiben, wie sie sind

## Status
Accepted

## Datum
2026-06-14

## Kontext

Der Plan zur Block-Architektur (ADR-004) sah zwei Umbauten vor, die beide nicht
gebaut wurden:

- **Bündelung:** Handler, die sich ein Continuation-Token oder einen Timer
  teilen, sollten zu je einem Block zusammengefasst werden — Season
  (Fight + Collect), PentaDrill (+ Collect), Seasonal (FreeCard + EventCollect +
  RankCollect), Champion (+ Ticket), BossBang (Parse + Fight).
- **Multi-Step-Zerlegung:** PlaceOfPower, Quest, BossBang und ChampionTicket
  sollten in explizite Mehrschritt-Blöcke mit Repeat-Cursor,
  at-most-once-Marker und Resume-Validierung aufgeteilt werden.

Beide hatten denselben Zweck: ein Handler, der über mehrere Reloads arbeitet,
sollte dabei nicht von anderen unterbrochen werden.

## Entscheidung

Beides entfällt. Der Slot-Hold (ADR-005) löst das Problem generisch: der eine
aktive BlockRun überlebt Reloads, bis der Block idle ist. Was die beiden
Umbauten erreichen sollten, ist damit erreicht — ohne die Handler anzufassen.

## Warum die Bündelung zusätzlich schadet

Die Bündel-Mitglieder stehen in der Pipeline **nicht nebeneinander**:
`handleSeasonCollect` läuft früh, `handleSeason` spät; `handleChampionTicket`
vor `handleChampion`; die drei Seasonal-Handler auf drei verschiedenen
Positionen. Das ist Absicht — Belohnungen zuerst, Kämpfe später. Eine Bündelung
müsste sie zwangsweise benachbart machen und damit die Reihenfolge ändern.

Die getrennten Blöcke haben einen zweiten Vorteil: das Reorder-UI zeigt jeden
einzeln, Collect und Fight also getrennt verschiebbar.

## Warum die Zerlegung nichts gebracht hätte

Eine Prüfung der vier Handler ergab, dass ihre Ziel-Eigenschaften bereits
gelten:

| Handler | statt eines Multi-Step-Blocks |
| --- | --- |
| PlaceOfPower | `doPoP` arbeitet über den busy-Guard einen Powerplace pro Aufruf ab, `TK.PopToStart` ist faktisch der Repeat-Cursor, leere Liste → Home |
| Quest | die Sub-Pfade sind Branches mit `routeHomeIfWaitingOnQuest()` als Guard |
| BossBang | ist bereits zwei Blöcke (Parse, Fight), sequenziert über Preconditions + Reload + Slot-Hold |
| ChampionTicket | der Doppelkauf-Race ist über `autoLoop=false` vor dem setTimeout-Fenster, `busy=true` und Precondition-Recheck beim Resume abgesichert |

## Konsequenzen

- Jeder Handler ist ein eigenständiger Single-Step-Block. Kein zusätzlicher
  Code nötig, weil das der Zustand ist.
- Die harten Ordnungs-Constraints und die `userMovable`-Flags — der andere Teil
  desselben Arbeitspakets — sind umgesetzt und von dieser Entscheidung
  unberührt.
- Quest behält seinen als „interim" gedachten Guard. Das ist Cleanup-Schuld,
  keine Korrektur.
- Wer später bündeln oder zerlegen will, braucht einen neuen Grund: die
  Koordination, die beides motiviert hat, macht der Slot-Hold.

## Referenzen

- ADR-004 (Block-Modell), ADR-005 (Slot-Hold)
