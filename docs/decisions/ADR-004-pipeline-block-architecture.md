# ADR-004: Pipeline-Block-Architektur (reload-feste Ablaufsteuerung)

- Status: Accepted
- Datum: 2026-06-12
- Umgesetzt in: `BlockTypes.ts`, `BlockScheduler.ts`, `BlockPipeline.ts`, `BlockRunStore.ts`, `OrderResolver.ts`

## Kontext

HHAuto steuert ein Browser-Game ueber Seiten-Reloads. Die Ablauflogik startet
pro Reload praktisch bei null und merkt sich ihren Fortschritt nur ueber einen
einzigen globalen Token `lastActionPerformed`, der zwischen zwei Reloads
verloren gehen kann.

Stand vor diesem Refactor (Code `4524911`, v7.36.0, verifiziert):

- Der Scheduler waehlt pro Tick einen Handler aus dem
  `pipeline`-Array (Array-Position = Prioritaet), prueft precondition +
  `minIntervalMs` und fuehrt Steps aus.
- Das Laufzeit-Gedaechtnis `ActiveChain { config, stepIdx, startedAt }` lebt
  NUR im Speicher. Nur `lastRunAt` wird in sessionStorage persistiert. Ein
  Page-Reload verliert den laufenden Chain-Fortschritt -- Wurzel der
  Multi-Reload-Bugs.
- Continuation laeuft ueber `ctx.lastActionPerformed` (in 13 Files
  referenziert), das am Tick-Ende auf `none` zurueckgesetzt wird.
- Die Handler in `Pipeline.config.ts` (HandlerConfig + `fromDescriptor`-Wrapper).
- Der Scheduler hat einen SOFT/HARD-Interrupt-Pfad (shouldSoftAbort /
  findHigherPriorityReady / abortAtSafePoint).

Folgeprobleme (dokumentiert in den `_lessons/pipeline-*`-Files): mehrstufige
Funktionen (Quest, PoP, BossBang, Mythic-First-Visit) verlieren ueber Reloads
ihren Kontext, starten neu, werden verdraengt oder bleiben haengen.

## Entscheidung

Die Ablaufsteuerung wird auf ein **daten-getriebenes Block-Modell mit
reload-festem Block-Run** umgebaut. Kernpunkte:

1. **Block statt Handler.** Jede user-sichtbare Funktion (Liga, Quest, Geld,
   ...) ist ein gekapselter `Block` aus benannten `Step`s mit deklarierten
   Metadaten (Abhaengigkeiten, `userMovable`-Flag, Timeouts). Die heutigen 33
   Handler werden 1:1 als Steps abgebildet.

   **Verworfen in ADR-006:** die hier geplante Buendelung (Season,
   PentaDrill, Seasonal, Pachinko, Champion, BossBang) wurde nie gebaut. Der
   Slot-Hold aus ADR-005 loest das Ping-Pong, fuer das die Buendel gedacht
   waren. Jeder Handler ist heute ein eigener Single-Step-Block.

2. **Reihenfolge als Daten.** Eine `Registry` (alle Block-Definitionen) ist
   getrennt von einer `Order`-Liste (geordnete Block-IDs). Umordnen = nur die
   ID-Liste aendern. Default-Order im Code; effektive Order in der bestehenden
   Settings-Storage (Teil von Export/Import), Fallback auf Code-Default bei
   Cache-Leerung.

3. **Reload-fester Block-Run.** `ActiveChain` (in-memory) wird zu einem
   persistenten `BlockRun { blockId, stepIdx, startedAt, stepStartedAt,
   dispatched, data }` in sessionStorage. Er ueberlebt geplante UND ungeplante
   Reloads/Verbindungsabbrueche. Die Continuation eines laufenden Blocks lebt
   im BlockRun.

   **Nicht umgesetzt:** `lastActionPerformed` sollte danach entfernt werden.
   Es steht weiter im `AutoLoopContext` und dient als Gate auf
   Descriptor-Ebene (siehe ADR-006) -- die Multi-Step-Zerlegung, die es
   ersetzt haette, entfiel.

4. **Hoechstens ein aktiver Block-Run.** Ein begonnener Block laeuft
   ununterbrochen bis zum Ende (einzige Ausnahme: Watchdog). Der SOFT/HARD-
   Interrupt-Pfad wird abgebaut.

5. **At-most-once-Semantik.** Zustandsaendernde Steps werden vor dem Absenden
   als `dispatched` markiert + persistiert (persist-before-act); beim Resume
   gilt ein dispatched-aber-unbestaetigter Step als erledigt (lieber eine
   Aktion verpassen als doppelt feuern).

6. **Deklarierte, durchgesetzte Abhaengigkeiten.** Bloecke deklarieren harte
   Ordnungs-Constraints (runsAfter/runsBefore, beforeAll/afterAll). Ein
   Validator prueft die effektive Order gegen harte Constraints + Zyklen/
   Widersprueche; ungueltige Konfiguration faellt sicher auf die Default-Order
   zurueck (nie gebrickt).

7. **Watchdog.** Step- und Run-Gesamt-Timeout; persistenter Fehlerzaehler pro
   Fehler-Signatur; Auto-Deaktivierung bei Schwelle (persistent, Reset bei
   Skript-Versionswechsel oder Reaktivierung); `<ERROR>`-Markierung auf der
   Home-Seite.

8. **Strukturiertes, reload-festes Logging.** `[PIPE]`-Format (key=value, ein
   Ereignis pro Zeile, Korrelations-IDs), nicht-rotierender Kontext-Block,
   Ring-Buffer mit write-through, in die bestehende Log-Pipeline integriert.
   Lean immer aktiv, Diagnose per Menue-Toggle. (Der Ring liegt heute bei 64
   Chunks a 128 KB, siehe `LogStore.ts`.)

## Verhaltensneutralitaet

Dies ist ein **echter Refactor**, KEIN type-only/`@version`-Bundle-Invariant.
Die Migration ist verhaltensneutral am Happy-Path: gleiche Aktionen, gleiche
Reihenfolge bei Default-Order. Die EINZIGEN beabsichtigten
Verhaltensaenderungen sind die dokumentierten Continuation-Bug-Fixes
(Quest-Loop, Mythic-First-Visit, Stuck-on-Page). Verifikation ueber
Verhaltensvergleich + Tests + Live-Lauf, pro verhaltensnahem Cluster gegen
einen Production-Account. Keine bestehende Bot-Faehigkeit wird entfernt oder
hinzugefuegt. Die Pro-Feature-Timer-Anzeige (pInfo) bleibt erhalten.

## Was davon gebaut wurde

Punkte 2-8 stehen im Code (`BlockTypes`, `BlockScheduler`, `BlockPipeline`,
`BlockRunStore`, `OrderResolver`, `PipeLogger`), einschliesslich des
Reorder-UI. Nicht gebaut wurden die Buendelung (ADR-006), die Multi-Step-
Zerlegung von PoP/Quest/BossBang/ChampionTicket (beide ADR-006) und die Entfernung
von `lastActionPerformed`. Der SOFT/HARD-Interrupt-Pfad ist mit dem alten
Scheduler aus dem Lauf verschwunden.

## Alternativen

- **Status quo behalten (`lastActionPerformed`).** Verworfen: die
  Multi-Reload-Bugs sind strukturell und nur mit reload-fester Continuation
  loesbar; punktuelle Interim-Fixes (siehe `_lessons/pipeline-*`) behandeln nur
  Symptome.
- **Vollstaendiger Rewrite der Ablaufsteuerung in einem Schritt.** Verworfen:
  zu hoher Blast-Radius, keine inkrementelle Live-Verifikation moeglich,
  widerspricht der verhaltensneutralen Migrationsvorgabe.
- **localStorage statt sessionStorage fuer den Block-Run.** Verworfen:
  sessionStorage ueberlebt den Reload im selben Tab (ausreichend); bei
  Tab-Crash ist ein frischer Start gewuenscht, nicht das Resume eines veralteten
  Runs. Das Diagnose-Log liegt bewusst in localStorage (ueberlebt Tab-Neustart).

## Konsequenzen

Positiv: mehrstufige Funktionen ueberleben Reloads; kein Verdraengen/Neustart;
deterministische, aus dem Logfile reproduzierbare Ablaeufe; spaetere
User-Steuerung der Reihenfolge ohne Architektur-Umbau moeglich; ein einzelner
haengender Block stoppt den Bot nicht mehr.

Negativ/Kosten: hoehere Komplexitaet im Scheduler (Resume-Validierung,
At-most-once, Repeat-Cursor, Watchdog); zusaetzliche Storage-Keys; die
inkrementelle Migration erfordert pro verhaltensnahem Cluster einen Live-Test.

## Validierung

Validiert Requirements 9.1 (verhaltensneutraler Happy-Path) und 9.3
(inkrementelle Migration mit Koexistenz). Die uebrigen Requirements werden
umgesetzt und je Baustein verifiziert.
