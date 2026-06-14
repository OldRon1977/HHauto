# ADR-001: Pipeline-Block-Architektur (reload-feste Ablaufsteuerung)

- Status: Accepted
- Datum: 2026-06-12
- Release-Linie: v7.37.0 (Roadmap Schritt 17)
- Kontext-Spec: `.kiro/specs/pipeline-block-architecture/` (requirements/design/tasks)

## Kontext

HHAuto steuert ein Browser-Game ueber Seiten-Reloads. Die Ablauflogik startet
pro Reload praktisch bei null und merkt sich ihren Fortschritt nur ueber einen
einzigen globalen Token `lastActionPerformed`, der zwischen zwei Reloads
verloren gehen kann.

Stand vor diesem Refactor (Code `4524911`, v7.36.0, verifiziert):

- `Scheduler` (Service/Scheduler.ts) waehlt pro Tick einen Handler aus dem
  `pipeline`-Array (Array-Position = Prioritaet), prueft precondition +
  `minIntervalMs` und fuehrt Steps aus.
- Das Laufzeit-Gedaechtnis `ActiveChain { config, stepIdx, startedAt }` lebt
  NUR im Speicher. Nur `lastRunAt` wird in sessionStorage persistiert. Ein
  Page-Reload verliert den laufenden Chain-Fortschritt -- Wurzel der
  Multi-Reload-Bugs.
- Continuation laeuft ueber `ctx.lastActionPerformed` (in 13 Files
  referenziert), das am Tick-Ende auf `none` zurueckgesetzt wird.
- 33 Handler in `Pipeline.config.ts` (HandlerConfig + `fromDescriptor`-Wrapper).
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
   Handler werden 1:1 als Steps abgebildet und nach Token-/Timer-Kohaesion zu
   Bloecken gruppiert (Bundles: Season, PentaDrill, Seasonal, Pachinko,
   Champion, BossBang; Rest standalone; Infra: EventParsing, GoHome).

2. **Reihenfolge als Daten.** Eine `Registry` (alle Block-Definitionen) ist
   getrennt von einer `Order`-Liste (geordnete Block-IDs). Umordnen = nur die
   ID-Liste aendern. Default-Order im Code; effektive Order in der bestehenden
   Settings-Storage (Teil von Export/Import), Fallback auf Code-Default bei
   Cache-Leerung.

3. **Reload-fester Block-Run.** `ActiveChain` (in-memory) wird zu einem
   persistenten `BlockRun { blockId, stepIdx, startedAt, stepStartedAt,
   dispatched, data }` in sessionStorage. Er ueberlebt geplante UND ungeplante
   Reloads/Verbindungsabbrueche. Continuation lebt im BlockRun, nicht mehr im
   globalen `lastActionPerformed` (das zuletzt entfernt wird).

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
   2-MB-Ring-Buffer mit write-through, in die bestehende Log-Pipeline
   integriert. Lean immer aktiv, Diagnose per Menue-Toggle.

## Verhaltensneutralitaet

Dies ist ein **echter Refactor**, KEIN type-only/`@version`-Bundle-Invariant.
Die Migration ist verhaltensneutral am Happy-Path: gleiche Aktionen, gleiche
Reihenfolge bei Default-Order. Die EINZIGEN beabsichtigten
Verhaltensaenderungen sind die dokumentierten Continuation-Bug-Fixes
(Quest-Loop, Mythic-First-Visit, Stuck-on-Page). Verifikation ueber
Verhaltensvergleich + Tests + Live-Lauf, pro verhaltensnahem Cluster gegen
einen Production-Account. Keine bestehende Bot-Faehigkeit wird entfernt oder
hinzugefuegt. Die Pro-Feature-Timer-Anzeige (pInfo) bleibt erhalten.

## Migration (inkrementell, Koexistenz)

Eigene Linie `refactor/v7.37.0-staging` von main. Cluster-Reihenfolge:
Scheduler-Infra -> Logging -> Block-Mapping/Constraints -> Multi-Step-Zerlegung
(PoP/Quest/BossBang/ChampionTicket) -> `lastActionPerformed` entfernen ->
optional Reorder-UI (Ebene 17.2). Migrierte (BlockRun) und nicht-migrierte
(altes Token) Bloecke koexistieren sicher bis zur Entfernung des Tokens im
vorletzten Schritt.

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
durch die nachfolgenden Tasks 2-15 umgesetzt und je Cluster verifiziert.
