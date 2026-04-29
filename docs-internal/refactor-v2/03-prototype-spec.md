---
last-verified: 2026-04-29
status: nicht gestartet
---

# Phase 1: Prototyp-Spezifikation

Bevor der gesamte Refactor angegangen wird, beweist der Prototyp dass die Kern-Idee (Declarative Scheduler mit Atomic-Blocks) trägt. Wenn der Prototyp die Erfolgskriterien NICHT erfüllt, wird der Refactor abgebrochen oder neu konzipiert. KEIN halbherziges Weitermachen.

---

## Voraussetzung

Phase 0 (`10-functional-inventory.md`) ist abgeschlossen. Ohne die Inventarliste kann nicht garantiert werden dass Stuff Team korrekt erfasst ist.

---

## Was wird gebaut

### A. Minimaler Scheduler

Datei: `src/Service/Scheduler.ts`
Größe-Ziel: < 400 LoC (sonst K4 verletzt — siehe Erfolgskriterien)

Funktionalität:
- Liest Pipeline-Config
- State-Machine pro Handler (IDLE / PENDING / RUNNING / COMPLETED / FAILED / INTERRUPTED)
- SOFT-Interrupt-Check (Master-Off, MouseService, Paranoia)
- HARD-Interrupt-Logik nur für `interruptible: 'always' | 'never'` (nicht `betweenSteps` — kommt später)
- Atomic-Block-Garantie für `atomic: true` Handler
- `onFailure`-Callback bei Step-Failure
- Watchdog: `totalTimeoutMs` bricht hängende Ketten ab
- Min-Interval-Respektierung pro Handler

NICHT im Prototyp:
- Reactive Subscriptions (Store → Scheduler)
- `interruptible: { betweenSteps: [...] }`
- Auto-Disable nach 3 Failures (kommt in Phase 2)
- Cross-Handler-Dependency-Checks

### B. Pipeline-Config mit 2 Handlern

Datei: `src/Service/Pipeline.config.ts`

Genau zwei Handler aus dem alten System werden migriert:

#### Handler 1: handleLeague (Atomic-Beweis)
- `atomic: true`
- `interruptible: 'never'`
- Atomare Kette: `checkEnergy → navigateToLeague → selectOpponent → fight → collectRewards`
- Beweist Atomic-Block-Funktion (Kampf darf nicht unterbrochen werden, sonst geht Kontext verloren)
- Hat reale Failure-Modi (z.B. kein Gegner verfügbar, Energie leer → onFailure aufrufen)
- Heutige Implementierung: [src/Service/AutoLoopActions.ts:handleLeague](../../src/Service/AutoLoopActions.ts) + [src/Module/League.ts](../../src/Module/League.ts) (`LeagueHelper.doLeagueBattle()`)

**Warum handleLeague statt "Stuff Team":**
Die ursprüngliche Spec nannte "Stuff Team (Build Champion Team)" als Atomic-Handler. Code-Analyse zeigt: Stuff Team ist kein AutoLoop-Handler. Es ist ein manuelles UI-Feature (Button auf der Edit-Team-Seite). Es existiert kein `handleStuffTeam` in AutoLoopActions.ts. handleLeague ist ein existierender AutoLoop-Handler mit atomarer Kampf-Sequenz — ideal für den Atomic-Beweis.

**Zukünftiges Feature (NICHT im Prototyp):**
Ein automatischer `handleStuffTeam`-Handler (Team optimieren wenn neue Blessings kommen, z.B. wöchentlich) ist ein sinnvolles Feature für Phase 2+. Voraussetzung: Scheduler-Runtime steht und ist bewiesen.

#### Handler 2: handleEventParsing
- `atomic: false`
- `interruptible: 'always'`
- `priority: 1` (höchste, läuft in fast jedem Tick)
- Beweist dass Scheduler nicht-atomare Handler richtig sequenziert
- Heutige Implementierung: [src/Service/AutoLoopActions.ts:handleEventParsing](../../src/Service/AutoLoopActions.ts) → ruft `EventModule.parseEventPage()` auf

### C. Integration in AutoLoop

[src/Service/AutoLoop.ts](../../src/Service/AutoLoop.ts):
- Am Ende der bestehenden Action-Handler-Liste wird `await Scheduler.tick()` aufgerufen
- Die zwei migrierten Handler werden in der alten [src/Service/AutoLoopActions.ts](../../src/Service/AutoLoopActions.ts) entfernt
- KEIN Doppelbetrieb: pro Handler entweder alt ODER neu, niemals beides

### D. Tests

#### `spec/Service/Scheduler.spec.ts` (neu)
Mindestens:
- State-Machine-Transitionen (IDLE → RUNNING → COMPLETED)
- Atomic-Block bricht NICHT bei HARD-Interrupt
- Atomic-Block bricht bei SOFT-Interrupt am Safe-Point
- `onFailure` wird bei Step-Failure aufgerufen
- Watchdog killt hängende Kette nach `totalTimeoutMs`
- Min-Interval wird respektiert
- Pipeline-Reihenfolge folgt `priority` aufsteigend

#### `spec/Service/Pipeline.config.spec.ts` (neu)
- Pipeline-Config ist parsbar
- Alle Handler haben gültige `priority`, `minIntervalMs`, `precondition`, `steps`
- Keine Duplikate in `name`

---

## Erfolgskriterien (HART, MESSBAR)

Der Prototyp gilt nur dann als erfolgreich, wenn ALLE folgenden Kriterien erfüllt sind:

### K1 — Atomic-Block funktioniert
handleLeague läuft im Spiel ohne Unterbrechung durch andere Handler. Manuell verifizierbar: Im Spiel zeigt das pInfo-Panel während League-Kampf-Kette keine andere Handler-Aktivität.

**Messung:** Auf HH manuell League-Kampf auslösen (Energy vorhanden), beobachten dass die Kette komplett durchläuft ohne dass z.B. handleTroll oder handlePachinko dazwischen feuert. 3x reproduzieren.

### K2 — SOFT-Interrupt funktioniert
Während handleLeague läuft: User bewegt Maus → MouseService triggert SOFT → Kette bricht am Safe-Point ab (max 5s nach Maus-Bewegung).

**Messung:** Manuell auf HH League-Kampf auslösen, Maus bewegen, Stoppuhr. Maximaler Abbruch-Delay < 5s.

### K3 — Failure-Recovery funktioniert
Künstlich erzeugter Fehler in handleLeague (z.B. Gegner-Selektor temporär falsch) → `onFailure` läuft → State ist sauber → nächster Lauf startet wieder bei Step 1.

**Messung:** Test im Code (modifizierter Selektor), Beobachtung dass State zurückgesetzt wird, nächster Tick startet sauber.

### K4 — Scheduler-Runtime ist klein
`src/Service/Scheduler.ts` < 400 LoC. Wenn größer: zu viel Komplexität, Re-Design nötig.

**Messung:** `wc -l src/Service/Scheduler.ts`.

### K5 — Migration-Aufwand pro Handler
Migration eines (typischen) Handlers vom alten System ins Pipeline-Format dauert < 1 Tag (8 Stunden Arbeit, gemessen an handleLeague und handleEventParsing).

**Messung:** In `06-progress-log.md` dokumentierte Zeit pro Handler-Migration. Wenn der einfachere von beiden > 1 Tag braucht: K5 verletzt.

### K6 — Cross-Game-Validation
Prototyp läuft fehlerfrei auf HH, CH, PH (manueller Test, je 30min Beobachtung).

**Messung:** Pro Spiel ein Eintrag in `06-progress-log.md` mit „30min ohne Fehler" und Liste der beobachteten Aktionen.

### K7 — Keine Regression
Alle anderen 31 Handler (die nicht migriert wurden) funktionieren weiter wie vorher.

**Messung:**
- `npm run build` ohne Fehler
- `npm test` (Jest) alle Specs grün
- Manuelle Verifikation auf HH: Troll, Pachinko, Champion, Season laufen normal (je 5min Beobachtung)

---

## Abbruch-Kriterien

Wenn nach maximal 7 Sessions Arbeit der Prototyp NICHT alle Kriterien erfüllt:

- **Refactor wird abgebrochen** ODER
- **Architektur wird neu konzipiert** (zurück zu Vision-Phase)

NIEMALS halbherzig weitermachen. NIEMALS Hybrid-System dauerhaft akzeptieren.

Spezifische Abbruch-Trigger:
- **K4 verletzt** (Scheduler > 600 LoC) → zu komplex, nicht weiterbauen
- **K5 verletzt** (einfacher Handler > 2 Tage Migration) → Plan unrealistisch
- **K7 verletzt** (andere Handler brechen) → Integration zu invasiv

Bei Abbruch: Branch behalten oder taggen, `07-lessons-learned.md` ausführlich füllen, INDEX.md auf Status `Aborted` setzen.

---

## Zeit-Budget

- **Vorgesehen:** 5-7 Sessions
- **Soft-Limit:** 7 Sessions
- **Hard-Limit:** 10 Sessions → Abbruch-Entscheidung

Nicht eingerechnet: parallele Bug-Fixes für aktuelle 7.35.x Version, falls nötig.

### Session-Aufteilung (Plan)

| Session | Inhalt | Modell |
|---------|--------|--------|
| 1 | Scheduler-Skelett + State-Machine + Specs für State-Machine | Opus (min. 4.6, höher bevorzugt) |
| 2 | Pipeline-Config-Format + Pipeline-Specs | Opus (min. 4.6, höher bevorzugt) |
| 3 | Handler-Migration: handleEventParsing (nicht-atomic, einfacher Fall) | Sonnet (min. 4.6, höher bevorzugt) |
| 4 | Handler-Migration: handleLeague (atomic-Kette, Beweis K1/K2) | Opus (min. 4.6, höher bevorzugt) |
| 5 | Integration in AutoLoop, Build grün, Specs grün | Sonnet (min. 4.6, höher bevorzugt) |
| 6 | Cross-Game-Validation HH | Sonnet (min. 4.6, höher bevorzugt) |
| 7 | Cross-Game-Validation CH + PH, Erfolgskriterien-Verifikation | Sonnet (min. 4.6, höher bevorzugt) |

Plan ist nicht starr — wenn ein Schritt länger dauert, dokumentieren in `06-progress-log.md` und entsprechend anpassen.

**Modell-Richtlinie:**
- **Opus (min. 4.6, höher bevorzugt):** Architektur, Design, kritische Reviews, Scheduler-Runtime
- **Sonnet (min. 4.6, höher bevorzugt):** Routine-Migration, Tests, Doku, Handler-Migration einfacher Fälle
- **Haiku (min. 4.5, höher bevorzugt):** Triviale Aufgaben (Doku-Korrekturen, kleine String-Ersetzungen)

Immer die höchste verfügbare Version der jeweiligen Modell-Klasse verwenden.

---

## Definition of Done

- [ ] `src/Service/Scheduler.ts` implementiert (< 400 LoC)
- [ ] `src/Service/Pipeline.config.ts` mit 2 Handlern
- [ ] handleLeague komplett im neuen Format (atomic)
- [ ] handleEventParsing komplett im neuen Format (nicht-atomic)
- [ ] Beide Handler aus alter [AutoLoopActions.ts](../../src/Service/AutoLoopActions.ts) entfernt
- [ ] `spec/Service/Scheduler.spec.ts` grün
- [ ] `spec/Service/Pipeline.config.spec.ts` grün
- [ ] `npm run build` grün
- [ ] `npm test` grün
- [ ] Manuell HH getestet (30min, ohne Fehler)
- [ ] Manuell CH getestet (30min, ohne Fehler)
- [ ] Manuell PH getestet (30min, ohne Fehler)
- [ ] Alle 7 Erfolgskriterien (K1-K7) verifiziert und in `06-progress-log.md` dokumentiert
- [ ] User-Review der Ergebnisse: Go/No-Go für Phase 2

---

## Zukünftige Handler (nach Prototyp, Phase 2+)

### handleStuffTeam (neues Feature)
Automatische Team-Optimierung wenn neue Blessings kommen (wöchentlich). Aktuell ist Team-Zuweisung ein manuelles UI-Feature (Button auf Edit-Team-Seite). Als Pipeline-Handler könnte es zeitgesteuert laufen:
- Trigger: Blessing-Wechsel erkannt oder wöchentlicher Timer
- Atomare Kette: navigateToTeams → calculateOptimal → selectGirls → confirmSave → verifyTeamSaved
- Voraussetzung: Scheduler-Runtime steht und ist bewiesen (Phase 1 complete)
