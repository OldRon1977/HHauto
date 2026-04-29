---
last-verified: 2026-04-29
---

# Progress Log

Chronologisches Arbeitsprotokoll des Refactors v7.36.0. Jeder neue Eintrag wird oben angefuegt (jüngste Eintraege zuerst).
## 2026-04-29 — Phase 1 Session 5: Manuelle Verifikation K1/K2/K3 auf HH

**Phase:** 1 — Prototyp Scheduler (IN PROGRESS, Session 5 complete)
**Modell:** Opus 4.6

**Was gemacht wurde:**

1. **Session-Start-Workflow ausgefuehrt:**
   - INDEX.md gelesen
   - git fetch: keine neuen Commits in upstream/main oder origin/main
   - Progress-Log gelesen
   - Kein Rebase noetig

2. **Build committed und gepusht:**
   - npm run build ausgefuehrt (webpack compiled successfully)
   - HHAuto.user.js committed: 205e66f
   - Push zu origin/refactor/v7.36.0 erfolgreich

3. **K1 — Atomic-Block: PASS (3/3)**
   - Durchlauf 1 (17:26:51): Starting chain handleLeague -> Chain completed (Switching to leagues)
   - Durchlauf 2 (17:26:57): Starting chain handleLeague -> Chain completed (Switching to leagues)
   - Durchlauf 3 (17:27:02): Vollstaendiger Kampf gegen Viny21 (2525687) -> Chain completed
   - Kein anderer Handler hat dazwischengefeuert
   - Kein HARD interrupt
   - handleEventParsing lief nur VOR oder NACH handleLeague, nie dazwischen

4. **K2 — SOFT-Interrupt: PASS**
   - mousePause aktiviert
   - Maus ca. 20 Sekunden bewegt waehrend Script lief
   - Beobachtet: 22 Sekunden komplette Stille im Log (17:34:54 bis 17:35:16)
   - Kein Starting chain waehrend Maus-Bewegung
   - Nach Maus-Stillstand: Script resumed normal
   - Kein haengender State

5. **K3 — Failure-Recovery: PASS (via Unit-Tests)**
   - Manueller Test nicht moeglich: Tampermonkey-Sandbox verhindert Zugriff auf Module von der Console
   - window.LeagueHelper ist undefined (isolierte Sandbox)
   - Offline-Methode greift nicht: LeagueHelper.doLeagueBattle() faengt Netzwerk-Fehler intern ab
   - Failure-Recovery ist durch Scheduler.spec.ts (11/11 gruen) vollstaendig abgedeckt:
     - State-Machine IDLE -> RUNNING -> FAILED -> IDLE
     - onFailure-Callback wird aufgerufen
     - Watchdog killt haengende Ketten
     - Naechster Tick startet sauber nach Failure

**Zusaetzliche Beobachtungen:**
- Doppel-Instanz-Problem im ersten Testlauf: Altes Script (7.35.10) und neues (7.35.15) liefen parallel
  -> Geloest durch Deaktivierung des alten Scripts in Tampermonkey
- handleLeague-Precondition blockierte initial: Time for league but no booster equipped
  -> Geloest: Booster wurden nach Shop-Besuch erkannt
- battle.js anim_number ReferenceError: Bug im Spiel selbst, nicht im Script
- Version bleibt bei 7.35.15 (Bump auf 7.36.0 erst bei Refactor-Abschluss)

**Ergebnis-Zusammenfassung:**

| Kriterium | Status | Methode |
|-----------|--------|---------|
| K1 Atomic-Block | PASS | Manuell HH, 3x reproduziert |
| K2 SOFT-Interrupt | PASS | Manuell HH, 22s Pause beobachtet |
| K3 Failure-Recovery | PASS | Unit-Tests (11/11 gruen) |
| K4 Scheduler < 400 LoC | PASS | Bereits verifiziert |
| K5 Migration < 1 Tag | PASS | Dokumentiert (Session 3+4) |
| K6 Cross-Game HH 30min | OFFEN | Session 6 |
| K7 Keine Regression | OFFEN | Session 6 |

**Naechste Schritte:**
1. Session 6: Cross-Game-Validation (HH 30min, dann CH + PH)
2. K7: Regression-Check (andere Handler funktionieren weiter)
3. Falls K6+K7 bestanden: Phase 1 COMPLETE, Go/No-Go fuer Phase 2

---


## 2026-04-29 — Phase 1 Session 4: Handler-Migration handleLeague (Atomic-Beweis vorbereitet)

**Phase:** 1 — Prototyp Scheduler (IN PROGRESS, Session 4 complete)
**Modell:** Opus 4.6

**Was gemacht wurde:**

1. **Session-Start-Workflow ausgefuehrt:**
   - INDEX.md gelesen
   - git fetch --all: keine neuen Commits in upstream/main oder origin/main
   - Progress-Log gelesen
   - Kein Rebase noetig

2. **AutoLoop.ts modifiziert:**
   - handleLeague aus Import-Block entfernt
   - wait handleLeague(ctx) Aufruf entfernt (war nach handleQuest, vor handleSeason)

3. **AutoLoopActions.ts modifiziert:**
   - handleLeague Funktion komplett entfernt (33 Zeilen, inkl. Kommentar)
   - Kein Doppelbetrieb: Handler existiert nur noch in Pipeline.config.ts

4. **Verifikation:**
   - npm run build: gruen (webpack compiled successfully)
   - npx jest spec/Service/Scheduler.spec.ts: 11/11 gruen
   - npx jest spec/Service/Pipeline.config.spec.ts: 21/21 gruen
   - npx jest (alle Tests): 549 Tests (541 passed + 8 skipped), keine Regression
   - handleLeague existiert NICHT mehr in AutoLoopActions.ts
   - handleLeague wird NICHT mehr in AutoLoop.ts direkt aufgerufen
   - handleLeague existiert nur noch in Pipeline.config.ts (neuer Handler) + Pipeline.config.spec.ts (Tests)
   - scheduler.tick() fuehrt handleLeague ueber die Pipeline aus
   - Commit: d67ebdd

**Technische Entscheidungen:**
- Identisches Pattern wie Session 3 (handleEventParsing): Import entfernen, Aufruf entfernen, Funktion entfernen.
- LeagueHelper-Imports in AutoLoop.ts bleiben: CheckSpentPoints() nutzt LeagueHelper.getEnergy() weiterhin.
- Kein ctx-Passing an Pipeline-Handler: handleLeague in Pipeline.config.ts nutzt LeagueHelper direkt (Storage-basiert).

**Naechste Schritte:**
1. Doku-Update (INDEX.md, Progress-Log) + Push — DONE
2. Session 5: Manuelle Verifikation K1/K2 auf HH (Atomic-Block + SOFT-Interrupt)
3. Session 6: Cross-Game-Validation CH + PH

---

## 2026-04-29 — Phase 1 Session 3: Handler-Migration handleEventParsing (Integration in AutoLoop)

**Phase:** 1 — Prototyp Scheduler (IN PROGRESS, Session 3 complete)
**Modell:** Opus 4.6

**Was gemacht wurde:**

1. **Session-Start-Workflow ausgeführt:**
   - INDEX.md gelesen
   - git fetch --all: keine neuen Commits in upstream/main oder origin/main
   - Progress-Log gelesen
   - Kein Rebase nötig

2. **AutoLoop.ts modifiziert:**
   - `import { scheduler } from './Scheduler'` hinzugefügt
   - `handleEventParsing` aus Import-Block entfernt
   - `await handleEventParsing(ctx)` Aufruf entfernt (war erster Handler in der Liste)
   - `await scheduler.tick()` am Ende der Handler-Liste eingefügt (nach handleGoHome)
   - Kommentar `// --- Scheduler Pipeline (migrated handlers run here) ---` als Marker

3. **AutoLoopActions.ts modifiziert:**
   - `handleEventParsing` Funktion komplett entfernt (24 Zeilen)
   - Kein Doppelbetrieb: Handler existiert nur noch in Pipeline.config.ts

4. **Verifikation:**
   - npm run build: grün (webpack compiled successfully)
   - npx jest spec/Service/Scheduler.spec.ts: 11/11 grün
   - npx jest spec/Service/Pipeline.config.spec.ts: 21/21 grün
   - npx jest (alle Tests): 549 Tests (540 passed + 8 skipped + 1 flaky Champion-Timer)
   - Champion-Test: Timing-Drift (erwartet 123s, bekommt 122s) — bekannter Flaky, nicht durch Änderungen verursacht. Bei Einzellauf grün.
   - handleEventParsing existiert NICHT mehr in AutoLoopActions.ts
   - handleEventParsing wird NICHT mehr in AutoLoop.ts direkt aufgerufen
   - scheduler.tick() wird in AutoLoop.ts aufgerufen
   - Commit: b6457bd

**Technische Entscheidungen:**
- scheduler.tick() am ENDE der Handler-Liste (nach handleGoHome): Schrittweise Migration. Alte Handler laufen zuerst, Pipeline-Handler danach. Wenn alle Handler migriert sind, entfallen die alten Aufrufe komplett.
- Kein ctx-Passing an scheduler.tick(): Der Scheduler arbeitet unabhängig vom AutoLoopContext. Handler in der Pipeline nutzen Storage (TK.eventsList) statt ctx.eventIDs.
- EventModule.parsePageForEventId() bleibt in AutoLoop.ts: Andere Handler (handleBossBangParse etc.) nutzen ctx.eventIDs noch. Erst wenn alle Event-abhängigen Handler migriert sind, kann diese Logik in die Pipeline wandern.

**Was als Nächstes:**
1. Doku-Update (INDEX.md, Progress-Log) + Push
2. Session 4: Handler-Migration handleLeague (atomic-Kette, Beweis K1/K2)
3. Session 5: Integration + Cross-Game-Validation

---

## 2026-04-29 — Phase 1 Session 2: Pipeline-Config + Pipeline-Specs

**Phase:** 1 — Prototyp Scheduler (IN PROGRESS, Session 2 complete)
**Modell:** Opus 4.6

**Was gemacht wurde:**

1. **Session-Start-Workflow ausgefuehrt:**
   - INDEX.md gelesen
   - git fetch --all: keine neuen Commits in upstream/main oder origin/main
   - Progress-Log gelesen
   - Kein Rebase noetig

2. **Pipeline.config.ts mit konkreten Handler-Eintraegen gefuellt:**
   - handleEventParsing: priority 1, non-atomic, interruptible 'always', minInterval 2s
   - handleLeague: priority 13, atomic, interruptible 'never', minInterval 60s
   - Beide Handler als Wrapper um bestehende Funktionen (kein Rewrite der Logik)
   - handleEventParsing nutzt TK.eventsList + EventModule.parseEventPage()
   - handleLeague nutzt LeagueHelper.isAutoLeagueActivated() + doLeagueBattle()
   - onFailure-Callback fuer handleLeague implementiert

3. **spec/Service/Pipeline.config.spec.ts geschrieben (21 Tests):**
   - Pipeline-Array nicht leer
   - Alle Handler haben gueltige Felder (name, priority, minIntervalMs, atomic, interruptible, precondition, steps)
   - Keine Duplikate in Namen
   - Keine Duplikate in Priorities
   - Pipeline nach Priority sortiert
   - Steps haben gueltige name + fn
   - timeoutMs positiv wenn definiert
   - handleEventParsing: non-atomic, always interruptible, priority 1, precondition boolean, step returns StepResult
   - handleLeague: atomic, never interruptible, priority 13, minInterval 60s, onFailure vorhanden, step returns StepResult

4. **Verifikation:**
   - npm run build: gruen (webpack compiled successfully)
   - npx jest spec/Service/Pipeline.config.spec.ts: 21/21 gruen
   - npx jest (alle Tests): 549 Tests (541 passed + 8 skipped), 39 Suites, keine Regression
   - Commit: 61e893f

**Technische Entscheidungen:**
- TK.eventsList statt ctx.eventIDs: Pipeline-Handler haben keinen Zugriff auf AutoLoopContext. Events werden aus dem Storage gelesen (TK.eventsList), nicht aus dem DOM-geparsten Context.
- String-Concatenation statt Template-Literals in onFailure: Vermeidet Escape-Probleme beim Schreiben via Python.
- minIntervalMs 60s fuer handleLeague: Verhindert zu haeufige Kampf-Versuche, passt zum bestehenden Timer-Pattern.
- minIntervalMs 2s fuer handleEventParsing: Haeufig genug fuer Event-Detection, nicht zu aggressiv.

**Was als Naechstes:**
1. Doku-Update (INDEX.md, Progress-Log) + Push
2. Session 3: Handler-Migration handleEventParsing (Integration in AutoLoop, alter Handler entfernen)
3. Session 4: Handler-Migration handleLeague (atomic-Kette, Beweis K1/K2)

---


