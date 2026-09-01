# Architekturentscheidungen

Eine Ablage, durchnummeriert nach Datum. Jede Datei hält eine Entscheidung fest:
was entschieden wurde, warum, und was verworfen wurde.

| # | Entscheidung | Datum | Wofür man sie liest |
| --- | --- | --- | --- |
| [001](ADR-001-drop-barrels.md) | Keine `index.ts`-Barrels, direkte Dateiimporte | 2026-05-13 | die Begründung hinter der ESLint-Regel `no-restricted-imports` (Gruppe `*/index`) |
| [002](ADR-002-pipeline-cooldown-persistence.md) | Cool-down des Schedulers übersteht Reloads (`Temp_pipelineLastRunAt`) | 2026-05-19 | warum `minIntervalMs` in sessionStorage landet statt nur im Speicher |
| [003](ADR-003-ajax-post-mutex.md) | Globaler Mutex auf state-changing `/ajax.php`-POSTs | 2026-05-20 | warum PlaceOfPower, BossBang und AutoLoop ihre POSTs serialisieren (#1598) |
| [004](ADR-004-pipeline-block-architecture.md) | Reload-feste Blöcke statt `lastActionPerformed` | 2026-06-12 | das Modell hinter `BlockScheduler`, `BlockTypes`, `BlockRunStore` |
| [005](ADR-005-block-slot-hold-until-home.md) | Ein Block hält den Slot, bis er im Leerlauf ist | 2026-06-13 | warum `applySlotHold` einen navigierenden Handler festhält |
| [006](ADR-006-nothing-bundled-nothing-split.md) | Weder gebündelt noch zerlegt — die Handler bleiben einzeln | 2026-06-14 | bevor jemand Season + SeasonCollect zusammenlegt oder PoP in Multi-Step-Blöcke zerlegt |
| [008](ADR-008-import-cycle-reduction.md) | Zyklen-Abbau mit eingefrorener Baseline | 2026-07-05 | warum `npm run deps:circular:check` in der CI steht und was ein neuer Zyklus kostet |
| [009](ADR-009-focused-activity.md) | Eine Aktivität behält die Pipeline, bis ihre Arbeit getan ist | 2026-08-22 | warum ein Block nach jedem Kampf den Fokus behält (#1841) |
| [010](ADR-010-navigation-is-not-a-stop.md) | Navigation verwirft den laufenden Run nicht | 2026-08-26 | warum ein ausgeschalteter Auto-Loop den Run nicht sofort killt |

Offen daneben: [`docs-internal/exit-condition-concept.md`](../../docs-internal/exit-condition-concept.md)
schlägt vor, den schwächsten Teil von ADR-009 abzulösen — drei Entscheidungsfragen,
noch nicht entschieden.

## Konventionen

- Eine Nummer wird nicht wiederverwendet. Neue Entscheidung, nächste freie
  Nummer. 007 ist frei geblieben: dieser Eintrag ist in 006 aufgegangen.
- Der Dateiname trägt die Nummer und ein kurzes Stichwort; Code-Kommentare
  verweisen auf den Dateinamen, nicht auf die Nummer allein.
- Eine überholte Entscheidung wird nicht gelöscht, sondern von der neuen ADR
  benannt, die sie ablöst.
