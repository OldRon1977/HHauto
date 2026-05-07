# Test-Strategie HHAuto

Stand: 2026-05-07. Lebende Datei. Bei jeder erledigten Task Checkbox abhaken
und Datum + Commit-Hash im "Status"-Feld nachtragen.

## Status

- Aktuelle Stufe: **0 (Sofort-Hygiene)** -- in Arbeit
- Letzte abgeschlossene Task: 0.6 (GitHub-Issue #1612 fuer CI-Coverage-Reporting angelegt)
- Letzter Commit: 7f83ccd (Branch chore/test-hygiene, lokal -- Push offen)
- Naechster Schritt: Task 0.7 (Push, PR, Merge gemaess Workflow-Rules)

## Kontext

- Repo: OldRon1977/HHauto, Userscript fuer Browsergame.
- 28k LoC TypeScript, 39 Spec-Files / 556 Tests.
- Coverage: 30% Stmt / 17% Cond / 24% Methods.
- Test-Stack: Jest + ts-jest + jsdom + mock-local-storage.
- Pfad: `c:\Users\StephanMesser\.kiro\Arbeitsplatz\HHAuto`
- Datei-Schreiben NUR via Python+UTF8 (Workspace-Rule 05_File_Write_Workaround).

## Gremium-Konsens (5:1 oder besser)

### Geblockt
- Snapshot-Tests fuer HTML
- Mutation Testing (Stryker)
- Property-Based Testing als eigene Phase (max 1-2 Tests punktuell)
- Coverage-Threshold als CI-Gate (Reporting ja, Gate nein)
- 41-MB-Dump in 30 Page-JSONs aufsplitten
- Pre-Commit-Hook (stattdessen GitHub Action)
- Trivial-Tests fuer isEnabled-Einzeiler

### Akzeptiert
- Pure-Function-Extraktion vor Decision-Logic-Tests
- Kuratierte Mini-Fixtures aus Dump (1-2 pro Modul, 5-20 Zeilen JSON)
- AJAX-Schema-Tests gegen echte Dump-Responses
- Storage-Migration-Tests
- MockHelper erweitern (Welt-Setup-Funktion)

## Offene Fragen vor Stufe-0-Start

Diese Fragen MUSS der User vor Stufe 0 beantworten. Die Antworten landen
hier in dieser Datei und steuern, was passiert.

### Frage A -- Inventur der 8 xit-Tests

Sollen alle 8 deaktivierten `xit(...)` -Tests im Spec-Verzeichnis lokalisiert
und mit Datei/Zeile/Test-Name aufgelistet werden?

- Aufwand: 5 Min, reines Grep, kein Code-Change
- Bekannt: `spec/Service/PageNavigationService.spec.ts:84`,
  `spec/Module/League.spec.ts` (letzter Test in isTimeToFight)
- Offen: 6 weitere

**Antwort:** Inventarisiere

### Frage B -- Inventur der durch fdescribe versteckten Tests

Sollen die Test-Cases in `spec/Module/Champion.spec.ts` aufgelistet werden,
die wegen `fdescribe("_setTimer",...)` aktuell nicht laufen?

- Aufwand: 2 Min, reines Lesen, kein Code-Change
- Wirkt sich auf Stufe 0 Task 0.1 aus (was wird wieder gruen/rot beim Fix)

**Antwort:** Inventarisiere

### Frage C -- Umgang mit subjektiven Findings 3, 4, 5

#### C-3 Pachinko.spec.ts (String-Mapping-Tautologie, ~12 it-Cases)
- a) Streichen
- b) Behalten
- c) Spaeter beim Pachinko-Refactor

**Antwort:** c

#### C-4 Pipeline.config.spec.ts (Konfigwert-Asserts wie priority===13)
- a) Konkrete Wert-Asserts streichen, Schema-Asserts behalten
- b) Komplett behalten
- c) Spaeter beim Pipeline-Anfassen

**Antwort:** c

#### C-5 League.spec.ts::isTimeToFight (jest.spyOn auf statische Methoden)
- a) Streichen
- b) Behalten bis Stufe 1 (Pure-Function-Extraktion ersetzt sie)
- c) Sofort umschreiben auf Constructor-Injection / Funktions-Parameter

**Antwort:** b (urspruenglich c, revidiert wegen Konflikt mit Stufe 1 Task 1.1)

**Default-Empfehlung des Gremiums:** C-3a, C-4a, C-5b.

## Findings mit Belegen

| # | Finding | Beleg | Bewertung |
|---|---|---|---|
| 1 | `fdescribe` skippt 1 anderen describe-Block in derselben Datei | `spec/Module/Champion.spec.ts:39` | objektiver Bug |
| 2 | 8 xit-Tests in der Schwebe | Jest meldet `pendingTests=8` | objektiver Mangel |
| 3 | Pachinko String-Mapping-Tautologie | `spec/Module/Pachinko.spec.ts` komplett | subjektiv (Gremium-Konsens) |
| 4 | Pipeline.config Konfigwert-Asserts zementieren | `spec/Service/Pipeline.config.spec.ts` handler-spezifische Bloecke | subjektiv (Gremium-Konsens) |
| 5 | League jest.spyOn auf statische Methoden -- brittle | `spec/Module/League.spec.ts:71-73` | subjektiv (Refactoring-Architekt) |
| 6 | Coverage-Verteilung extrem ungleich | `coverage/clover.xml`: HaremGirl 5%, League 8%, Champion 4% | objektiv |
| 7 | Dump enthaelt 30 echte Spielseiten mit Game-State | `INPUT/hhauto_dump_*.json` | nutzbar fuer Mini-Fixtures |
| 8 | Logfiles enthalten Action-Traces (TeamModule, Generator.next) | `INPUT/HH_DebugLog_*.log` Schluessel `HHAuto_Temp_Logging` | Reliability-Hinweise |

## Roadmap mit Tasks

### Stufe 0 -- Sofort-Hygiene (1-2h, kein Risiko)

- [x] **0.1** `fdescribe` -> `describe` in `spec/Module/Champion.spec.ts:37` (commit 6fa1e64, 2026-05-07)
  - Vorbedingung: Frage B beantwortet, Liste der versteckten Tests bekannt
  - Verifikation: `npm test` zeigt mehr passed Tests als vorher
  - Wenn Tests rot werden: einzeln entscheiden (fix oder xit)
- [x] **0.2** xit-Tests behandeln gemaess Antwort A (commit 0d1aee3, 2026-05-07)
  - 7 xit-Tests inventarisiert, 5 reaktiviert (alle gruen), 2 leere Stubs entfernt
  - TimeHelper: canCollectCompetitionActive + getSecondsLeftBeforeNewCompetition (Stubs entfernt)
  - Season: 2 low-mojo-Tests reaktiviert + Setting autoSeasonSkipLowMojo=true im Test gesetzt
  - HaremGirl: "Button and no girl" reaktiviert, gruen ohne weitere Aenderung
  - League: "should return false during the last hour..." reaktiviert, gruen ohne weitere Aenderung
  - PageNavigationService: toHaveBeenCalledWith -> expect.stringContaining (Test-Bug, Zeitstempel-Praefix)
- [x] **0.3** Findings 3/4/5 gemaess Antwort C: in Stufe 0 nichts zu tun
  - C-3c (Pachinko String-Mapping): spaeter beim Pachinko-Refactor
  - C-4c (Pipeline.config Konfigwert-Asserts): spaeter beim Pipeline-Anfassen
  - C-5b (League jest.spyOn): bleibt bis Stufe 1 (Pure-Function-Extraktion ersetzt sie)
- [x] **0.4** MockHelper erweitert (commit 756004a, 2026-05-07)
  - `mockBoosterInventory({normal, mythic})` -- localStorage Temp_boosterStatus
  - `mockSetting(key, value)` -- localStorage Setting_*
  - `mockTimer(name, secondsLeft)` -- localStorage Temp_Timers; <=0 clears
  - `mockAjaxSuccess(response)` / `mockAjaxError(error)` -- shared.general.hh_ajax
  - `mockGameGlobals({heroLevel, energies, settings})` -- Welt-Setup
  - Datei: spec/testHelpers/MockHelpers.ts (143 Zeilen erweitert)
  - Anmerkung: Hartkodierte Storage-Praefixe abloest durch Imports aus src/config (HHStoredVarPrefixKey, TK)
- [x] **0.5** Coverage-Reporter aktiviert (commit 2b48603, 2026-05-07)
  - jest.config.ts: coverageReporters = text, text-summary, lcov, clover, html
  - Kein Threshold-Gate
  - text-summary erscheint am Ende jedes npm-test-Laufs
  - HTML-Report unter coverage/lcov-report/index.html
  - Aktuelle Werte: 28.92% Stmt / 17.11% Cond / 24.10% Methods / 29.60% Lines
- [x] **0.6** Coverage-Reporting via GitHub Action (Issue als Reminder, 2026-05-07)
  - Issue: https://github.com/OldRon1977/HHauto/issues/1612 ("Coverage-Reporting in CI")
  - Body referenziert diesen Plan
  - Nicht jetzt umsetzen, nur Reminder
- [ ] **0.7** Stufe 0 abgeschlossen -- Commit `chore(test): hygiene + mock-helper`
  - Kein Versions-Bump (nur Tests)
  - Branch: `chore/test-hygiene`
  - Push + PR + Merge gemaess Workflow-Rules

### Stufe 1 -- Pure-Function-Extraktion (2-3 Tage, hoher ROI)

Ziel: Aus den grossen Modulen die Entscheidungs-Logik in pure Funktionen
extrahieren. Eingabe = Daten, Ausgabe = Entscheidung. Keine Globals,
kein jQuery, kein Storage-Read im Kern.

- [ ] **1.1** League: `decideShouldFight(state) -> bool`
  - Aus `LeagueHelper.isTimeToFight` extrahieren
  - State-Type: `{ heroLevel, energy, energyMax, threshold, runThreshold,
    timerLeft, leagueEndTime, paranoia, boosterRequired, boosterEquipped }`
  - Public API der Klasse bleibt, ruft intern die pure Funktion
  - Tests: 8-12 konkrete Cases mit erwartetem bool
  - Wenn Frage C-5 mit "b" beantwortet: alte spy-Tests jetzt ersetzen
- [ ] **1.2** Champion: `selectNextChampion(champions, settings, level) -> champion?`
  - Filter + Sort-Logik aus Champion-Modul extrahieren
  - Tests: Filter-Settings durchspielen, Hero-Level-Schwellen
- [ ] **1.3** HaremGirl: `parseGirlsFromGameData(rawData) -> Girl[]`
  - Pure Parser aus `unsafeWindow.shared.Hero.girls` -> typed `Girl[]`
  - Eingabe-Fixtures aus Dump (Stufe 2 zieht das nach)
  - Tests: Mit synthetischen Mini-Eingaben (3 Girls, verschiedene Rarities)
- [ ] **1.4** AutoLoopActions: `pickNextAction(state) -> action`
  - State enthaelt: aktive Module, Timer, Energie-Werte, Settings
  - Output: einer der Action-Typen
  - Schwierigste Extraktion -- evtl in Teil-Funktionen splitten
- [ ] **1.5** Stufe 1 abgeschlossen -- Commit pro Modul, Branch je Modul
  - Branch: `refactor/pure-functions-<modulname>`

### Stufe 2 -- Mini-Fixtures aus Dump (3-4 Tage)

- [ ] **2.1** Fixture-Verzeichnis anlegen: `spec/fixtures/<modul>/`
- [ ] **2.2** League-Fixtures aus Dump extrahieren
  - Quelle: `INPUT/hhauto_dump_*.json` Page-Index 1 (`/leagues.html`)
  - Felder: `teams.opponents_list[0..2]`, `battle.league_rewards`, `hero.shared.Hero.energies.challenge`
  - Datei: `spec/fixtures/league/opponents-mid-tier.json`, `league-rewards-tier3.json`
  - Tests: `parseOpponents(fixture) -> Opponent[]`, `parseLeagueRewards(fixture) -> RewardTier[]`
- [ ] **2.3** HaremGirl-Fixtures
  - Quelle: Page-Index 0 (`/home.html`) `girls_full.game.shared.Hero`
  - Auswahl: 3 Girls (1 Mythic 6/6, 1 Legendary 5/5, 1 Common)
  - Datei: `spec/fixtures/haremGirl/sample-girls.json`
  - Tests: `parseGirlsFromGameData`, `calculateSalary`, Filter-Funktionen
- [ ] **2.4** Champion-Fixtures
  - Quelle: Page-Index 8 (`/champions-map.html`)
  - Datei: `spec/fixtures/champion/champion-map.json`, `active-champion.json`
- [ ] **2.5** EventModule-Fixtures
  - Quelle: Page-Index 13 (`/event.html`)
  - Datei: `spec/fixtures/event/event-detection.json`
- [ ] **2.6** Fixture-Loader-Helper
  - Datei: `spec/testHelpers/Fixtures.ts`
  - Funktion: `loadFixture(modul, name) -> any`
- [ ] **2.7** Stufe 2 abgeschlossen -- Commit pro Modul, Branch `feat/test-fixtures-<modul>`

### Stufe 3 -- Decision-Logic-Coverage (2-3 Tage)

Pro `isTimeToX` / `shouldRunY` / `getNextZTime`-Funktion: 4-8 Tests fuer
Default, Boundaries, Settings-Aus, Level-zu-niedrig, Timer-aktiv,
Energy-Grenze, AJAX-Error.

Vorbedingung: Stufe 1 hat den Refactor in pure Funktionen erledigt fuer
das jeweilige Modul.

- [ ] **3.1** ClubChampion -- isTimeToFight, getNextChampionTime
- [ ] **3.2** Pantheon -- isEnabled (echte Logik, nicht trivial), isTimeToFight
- [ ] **3.3** MonthlyCard -- shouldClaim, getNextClaimTime
- [ ] **3.4** LabyrinthAuto -- gesamte Decision-Pipeline
- [ ] **3.5** Bundles -- Sichtbarkeit/Trigger
- [ ] **3.6** LivelyScene, BossBang -- isAvailable, Timer-Reset
- [ ] **3.7** Stufe 3 abgeschlossen -- Branch `feat/test-decision-logic`

### Stufe 4 -- Reliability-Layer (1-2 Tage)

- [ ] **4.1** AJAX-Schema-Tests
  - Echte Responses aus dem Dump als Fixture (z.B. `live_blessings_api.live`)
  - Pro Response-Typ ein Validator-Test: `parseResponse(realResponse)` ohne Crash
- [ ] **4.2** Storage-Migration-Tests
  - Alte Storage-Werte aus frueheren Versionen als Fixtures
  - Test: Reader nicht crashen, Default-Wert greifen
  - Quelle: `INPUT/HH_DebugLog_*.log` enthaelt aktuelle Storage-Snapshots
- [ ] **4.3** Multi-Domain-Smoke
  - Pro Domain-Klon (hentaiheroes, gayharem, comixharem, mangarpg, ...) ein
    Test fuer `domain.includes()` und ConfigHelper-Domain-Erkennung
  - Datei: `spec/config/Domain.spec.ts`
- [ ] **4.4** Stufe 4 abgeschlossen -- Branch `feat/test-reliability`

## Bewusst gestrichen (nicht umsetzen)

- Snapshot-Tests fuer HTML
- Mutation Testing mit Stryker
- Property-Based Testing als ganze Phase
- Coverage-Threshold als CI-Gate
- 41-MB-Dump in 30 Page-JSONs aufsplitten
- Pre-Commit-Hook
- Trivial-Tests fuer isEnabled-Einzeiler

## xit-Inventar

(Wird gefuellt nach Frage A. Format: Datei | Zeile | Test-Name | letzter Commit)

Stand: 2026-05-07. 7 xit-Tests gefunden (Plan-Schaetzung war 8).

| # | Datei | Zeile | Test-Name |
|---|---|---|---|
| 1 | spec/Helper/TimeHelper.spec.ts | 70 | default |
| 2 | spec/Helper/TimeHelper.spec.ts | 76 | default |
| 3 | spec/Module/Events/Season.spec.ts | 231 | low mojo |
| 4 | spec/Module/Events/Season.spec.ts | 255 | low mojo, energy not max with cards |
| 5 | spec/Module/harem/HaremGirl.spec.ts | 55 | Button and no girl |
| 6 | spec/Module/League.spec.ts | 149 | should return false during the last hour of the league if energy is insufficient |
| 7 | spec/Service/PageNavigationService.spec.ts | 74 | should log an error if Nutaku is detected but no session is found |

## fdescribe-versteckte Tests

Stand: 2026-05-07. `fdescribe("_setTimer")` in Champion.spec.ts:37 fokussiert
auf 7 Tests innerhalb des _setTimer-Blocks und versteckt damit den
Schwester-Block findNextChamptionTime mit 1 Test.

| Datei | fdescribe-Block (Zeile) | versteckter describe-Block | Tests skipped |
|---|---|---|---|
| spec/Module/Champion.spec.ts | _setTimer (37) | findNextChamptionTime | 1: "default" |

## Datenlage

- `INPUT/hhauto_dump_*.json` (41 MB, 5.5.2026, 30 Pages)
  - Pages: home, leagues, season-arena, penta-drill-arena, penta-drill,
    labyrinth (2x), club-champion, champions-map, shop, clubs, pantheon,
    season, event, seasonal, path-of-glory, path-of-valor, pachinko, map,
    waifu, activities (5x), hero/profile, member-progression, teams,
    edit-team, characters/1
  - Felder pro Page: girls_full, hero, teams, battle, market_equipment,
    hh_namespace, shared_namespace, local_storage, dom_data_attributes,
    live_blessings_api
- `INPUT/HH_DebugLog_*.log` (3 Files, 0,4 Tage alt)
  - Settings-Snapshot pro File
  - Schluessel `HHAuto_Temp_Logging` enthaelt zeitgestempelte Action-Traces
    (TeamModule, Harem, Generator.next mit Slot-Equipment)
- Bei Bedarf: User um neuen Dump bitten (Inspector-Skript: `bonus-scripts/HHAuto_debug_inspector.user.js` v4.5.0)

## Workflow-Regeln (Erinnerung)

- Branch -> Implementieren -> Commit -> Push -> Test -> Freigabe -> PR -> Merge
- Identitaet: `oldron1977@gmail.com`, User: `OldRon1977`
- Keine KI-/Agenten-Erwaehnung in Commits
- Datei-Schreiben NUR via Python+UTF8 (Workspace-Rule 05)
- README-Eintrag bei Versions-Bump (nicht in dieser Stufe noetig)

## Aenderungs-Log dieser Datei

| Datum | Aenderung |
|---|---|
| 2026-05-07 | Erstanlage, Stand vor Stufe 0 |
| 2026-05-07 | Antworten A=Inv, B=Inv, C-3c/C-4c/C-5c eingetragen, xit/fdescribe inventarisiert |
| 2026-05-07 | C-5 revidiert auf b (Konflikt-Vermeidung mit Stufe 1) |
| 2026-05-07 | Task 0.1 erledigt: fdescribe -> describe (commit 6fa1e64). Tests: 549 passed / 7 skipped / 556 total |
| 2026-05-07 | Task 0.2 erledigt: alle xit behandelt (commit 0d1aee3). Tests: 554 passed / 0 skipped / 554 total |
| 2026-05-07 | Task 0.4 erledigt: MockHelper +5 Funktionen (commit 756004a). Tests bleiben 554 passed |
| 2026-05-07 | Task 0.5 erledigt: Coverage-Reporter aktiviert (commit 2b48603) |
| 2026-05-07 | Task 0.6 erledigt: Issue #1612 angelegt |