# Session-Handover -- HHAuto Refactor

**Datum letzter Stand:** 2026-05-23 (Ende Schritt 3 main-Squash)
**Aktueller Branch:** `main` (Version 7.35.55)
**Refactor-Branch:** `refactor/v7.36.0-staging` (synchron mit `main` nach Schritt-3-Reset)

## Was abgeschlossen ist

### Schritt 3 -- AutoLoop-Cluster Code-Review (auf main)

Findings-File `docs-internal/REVIEW_AutoLoop_Findings.md` (gitignored) mit 25 Befunden ueber 5 Achsen (1 Critical, 9 Important, 9 Nit, 6 FYI). Cluster-Reihenfolge: C, B, X, Y, Z, A1, A2, D, E, F. Alle gemerged via PR #1733 (Commit `a94ad308`, Version 7.35.55). Issue #1722 hat den Step-3-Status-Kommentar (issuecomment-4526373767).

Cluster-Inhalt im einzelnen:

- **C** (`2d656a3f` staging) -- AutoLoop hygiene cleanup. ESLint 30 Warnings -> 0 auf den vier Core-Files, dead code blocks, DEBUG-Log entfernt.
- **B** (`e33abf3f` staging) -- `Scheduler.tick()` jetzt unter `if (!ctx.busy)`. Neuer Spec `Pipeline.integration.spec.ts` (8 Cases). Tests 803 -> 811.
- **X** (`5e3136f0` staging) -- Hotfix `nextLeaguesTime`. Timer beruecksichtigt verbleibende Energie nach Battle-Batch. Drei Branches: kurzer Cool-down, next_refresh_ts, Fallback.
- **Y** (`5899e21b` staging) -- League-Cool-down auf 2-5s gesenkt, Pipeline `minIntervalMs` von 60_000 auf 2_000.
- **Z** (`36c59596` staging) -- Hotfix `boosterStatusLastUpdate`. Freshness-Stempel auch bei AJAX-Equip-Erfolg und im "server says already equipped"-Fallback.
- **A1** (`033c98d4` staging) -- Korrektheits-Polish. Quest-Battle await, gotoPage-Rueckgabewert (3 Stellen), busy-Doppel-Set entfernt (5 Stellen).
- **A2** (`53d3708a` staging) -- `eventParsed` dead-code entfernt.
- **D** (`cc3c3420` staging) -- Module-level `export let busy` entfernt, alle Reads auf ctx.busy.
- **E** (`66ac56f0` staging) -- `wouldFightWithPower` JSDoc-Maintenance-Block.
- **F** (`43416a76` staging) -- `handleChampionTicket` setStoredValue-Ordering dokumentiert (kein Code-Change).

### Side-Effekte auf main seit Schritt 2

- Cycle-Baseline auf main: 381 (war 383 nach Schritt 2).
- Lint-Last: 60 Errors / 820 Warnings (war 60/850 nach Schritt 2). Reduktion durch Cluster C.
- Bundle: 1.43 MiB.
- Tests: 60 Suites / 811 Tests (war 56/803).

### Drift-Fixes in der lokalen Workflow-Spec

`docs-internal/REVIEW_AutoLoop.md` (gitignored) wurde lokal angepasst, um die Realitaet der Issue-#1700/#1708-Fixes zu spiegeln:

- Sub-Spec `handleTrollBattle` Wait-Marker beschreibt jetzt den Storage-Marker `trollWaitForEnergy` statt `ctx.busy`/`lastActionPerformed`.
- Pipeline-Tabelle nennt die `trollWaitForEnergy`-Gate fuer `handleEventParsing`.

Diese Doku-Korrekturen sind Voraussetzung fuer Pre-Phase-Re-Verify in 3.2.

## Was als naechstes ansteht

### Schritt 3.2.G -- 33-Handler-Migration in Scheduler-Pipeline

Das ist der naechste Sub-Schritt innerhalb von Schritt 3 der Roadmap. Aus dem Findings-File `REVIEW_AutoLoop_Findings.md` Synthese-Block:

> Schritt 3.2 (Migration in die Scheduler-Pipeline) sollte erst beginnen, wenn A-F durch sind. Reihenfolge der Migration: Handler nach Hot-Spot-Reihenfolge (Coverage-Schwaeche * Trigger-Frequenz). Vorschlag:
>
> - 3.2a: handleShop, handleAutoEquipBoosters (einfach, kein Cross-Handler-State).
> - 3.2b: handleContest, handleMissions, handleSeasonalFreeCard, handleSeasonalRankCollect, handleFreeBundles, handleDailyGoals, handleLabyrinth (alle bereits ueber `runStandardHandler`).
> - 3.2c: Collect-Handler (Season, PentaDrill, SeasonalEvent, PoV, PoG) -- N3 Datentabelle als gemeinsame Migrations-Vorlage.
> - 3.2d: Battle-Loops (Season, PentaDrill, Pantheon, Champion, ClubChampion) -- N4 Datentabelle.
> - 3.2e: Pachinko -- N2 Datentabelle.
> - 3.2f: handleTrollBattle (gross, mit I3 Variante A).
> - 3.2g: handleQuest (gross, 8 Sub-Pfade).
> - 3.2h: handleHaremSize, handlePlaceOfPower, handleGenericBattle, handleSalary, handleBossBang*, handleGoHome (atypische Handler).
> - 3.2i: handleChampionTicket (sondersten, mit I5 Cluster F vorab).

Pre-Phase-Re-Verify-Pflicht (aus `REVIEW_ROADMAP.md`): vor Beginn jeder Migration die im Sub-Cluster genannten Handler einzeln gegen den aktuellen Code pruefen, wie es das jeweils im Findings-File beschriebene Verhalten dokumentiert.

### Strategie-Entscheidung vor 3.2.a

Vor Beginn der Migration ist eine Architektur-Diskussion noetig:

1. **Pipeline-Handler-Signatur:** Sollen Pipeline-Handler `ctx` bekommen (siehe F5 im Findings-File)? Heute haben `step.fn`-Funktionen `() => Promise<StepResult>`-Signatur, ohne `ctx`. Pre-conditions lesen Storage und globale Module direkt. Bei der Migration koennten ctx-Reads (busy, eventIDs, currentPage, canCollectCompetitionActive) sinnvoll sein. Nachteil: Pipeline-Tests werden schwieriger zu mocken.

2. **`runStandardHandler`-Pattern verwerten:** Sieben Handler in 3.2.b nutzen schon `runStandardHandler` mit einem `ModuleHandlerDescriptor`-Objekt. Der naheste Pfad zur Pipeline waere: `runStandardHandler` ersetzen durch eine `convertToHandlerConfig(descriptor)`-Funktion, die einen `HandlerConfig` baut und in die `pipeline`-Liste pusht. Dann sind 3.2.b sieben One-Liner.

3. **`lastActionPerformed`-Mechanik:** Pipeline-Handler haben heute kein Pendant zum klassischen `lastActionPerformed`-Reset. Wenn ein Pipeline-Handler eine Multi-Step-Chain hat, die ueber Page-Reload laeuft, ist die Tick-Lebenszeit-Logik nicht direkt nutzbar. Migration eines Multi-Tick-Action-Handlers (z.B. `handlePlaceOfPower` in 3.2.h) braucht ein eigenes State-Modell. Vor 3.2.h diskutieren.

Empfohlener Plan fuer die naechste Session:

- **Erst 3.2.a** (Shop, AutoEquipBoosters) mit beiden architekturen ausprobieren -- entweder ohne ctx (heutiger Pipeline-Stil) oder mit ctx-Erweiterung. Das ist der einfachste Sub-Cluster, deshalb gut zum Testen der Strategie.
- Daraus Patterns ableiten und in den Findings-File / `REVIEW_AutoLoop.md` als Migration-Template nachziehen.
- Dann 3.2.b durch das `convertToHandlerConfig`-Pattern als Massen-Migration.
- 3.2.c-e ueber Datentabellen-Pattern (N2/N3/N4 aus Findings-File).
- 3.2.f-i einzeln, mit eigener Diskussion vor jedem.

### Roadmap-Reihenfolge (verbleibend nach Schritt 3 main-Squash)

1. **Schritt 3.2.G** (33-Handler-Migration -- Sub-Cluster a-i)
2. **Schritt 4** (StorageHelper-Review)
3. **Schritt 5** (Loop-Modul-Cluster: Quest, Contest, DailyGoals, Champion, PlaceOfPower)
4. weiter laut `REVIEW_ROADMAP.md`

## Wichtige Files fuer den Wiedereinstieg

| Datei | Zweck |
|---|---|
| `docs-internal/REVIEW_ROADMAP.md` | Steuerungsdatei, Schritt-Status (gitignored) |
| `docs-internal/REVIEW_AutoLoop_Findings.md` | Code-Review mit Synthese-Block und Cluster-Plan (gitignored) |
| `docs-internal/REVIEW_AutoLoop.md` | Workflow-Spec, Tick-Algorithmus, 33 Action-Handler (gitignored, lokal-korrigiert in 2026-05-23) |
| `docs-internal/REVIEW_HANDOVER.md` | Phase-2-Methodik (5-Achsen-Review, Severity-Schema) |
| `docs-internal/REVIEW_PHASE0.md` | Hot-Spot-Ranking, Coverage-Baseline |
| `docs-internal/REVIEW_BACKLOG.md` | Offene Backlog-Eintraege (handleGoHome-Bug eingetragen) |
| `src/Service/AutoLoop.ts` | Tick-Hauptschleife |
| `src/Service/AutoLoopActions.ts` | 33 klassische Action-Handler |
| `src/Service/AutoLoopPageHandlers.ts` | Page-spezifische UI-Handler |
| `src/Service/Scheduler.ts` | Pipeline-Singleton |
| `src/Service/Pipeline.config.ts` | Pipeline-Configs (heute: handleEventParsing, handleLeague) |
| `src/Service/AutoLoopContext.ts` | Shared Context-Interface |
| `src/Service/AutoLoop.pure.ts` | Pure-Helfer `decideBurst`, `shouldRunStandardHandler` |
| `spec/Service/Pipeline.config.spec.ts` | Praecondition-Tests fuer Pipeline-Handler |
| `spec/Service/Pipeline.integration.spec.ts` | Real-Scheduler + Real-Pipeline (8 Cases, neu in B) |
| `spec/Service/Scheduler.spec.ts` | Scheduler-State-Machine gegen synthetische Configs |
| `spec/Service/AutoLoopActions.trollWaitForEnergy.spec.ts` | Wait-Marker-Spec |
| `spec/Service/AutoLoopActions.wouldFightWithPower.spec.ts` | Pure-Helfer-Spec |

## Branch-Modell

Aus `REVIEW_ROADMAP.md` Sektion **Refactor-Branch-Modell** (unveraendert seit Schritt 1):

- Sammel-Branch: `refactor/v7.36.0-staging`. Aktuell synchron mit main (Reset 2026-05-23 nach Schritt 3).
- Pro Cluster ein Sub-Branch (`refactor/<modul>-<aspect>`), Direkt-Merge auf staging via fast-forward.
- Versionierung auf staging: patch-bumpen, weiter ab letzter staging-Version. Nach dem Schritt-3-Reset ist staging auf 7.35.55 (= aktuelle main-Version). **Naechster Bump auf staging: 7.35.56** (frisch ab main).
- Cherry-Pick / Squash nach main bei stabilem Stand (siehe Squash-Workflow unten).
- Hotfixes auf main: 9-von-10-Faellen direkt auf der Refactor-Linie bauen, mit naechstem stabilen Stand nach main.

## Workflow je Cluster (auf staging)

1. Pre-Phase Re-Verify (Pflicht, alle Befunde einzeln pruefen).
2. Branch von staging anlegen (`git checkout refactor/v7.36.0-staging; git checkout -b refactor/<sub-cluster>`).
3. Code-Aenderung + Spec-Erweiterung.
4. Verifikation: `npm run typecheck`, `npm run build`, `npx jest --runInBand --no-coverage`, `npm run lint`, `npm run deps:circular:check`.
5. Versions-Bump in `package.json` + `src/Service/FeaturePopupService.ts`, Build erneut, kein CHANGELOG.
6. Commit auf Cluster-Branch. **Dann FF-Merge + Push + Verify**:
   ```powershell
   git checkout refactor/v7.36.0-staging
   git merge --ff-only refactor/<cluster>
   git push origin refactor/v7.36.0-staging
   git ls-remote origin refactor/v7.36.0-staging
   git rev-parse refactor/v7.36.0-staging
   ```
   Stimmen die SHAs nicht ueberein: Push fehlgeschlagen, Cluster nicht weiterbauen. Lesson `_lessons/ff-merge-push-staging-pitfall.md`.
7. User-Test in Tampermonkey.
8. Roadmap mit Cluster-Status [x] aktualisieren.

## Squash-via-Diff: staging -> main (Schritt-Abschluss)

Wenn ein Schritt aus der Roadmap komplett auf staging stabil ist und nach main soll, **nicht** rebasen oder cherry-picken pro Cluster -- die Versionsspruenge auf staging passen nicht zur main-Reihe. Stattdessen Squash-via-Diff:

1. Branch von main:
   ```powershell
   git checkout main
   git pull --ff-only
   git checkout -b refactor/<step-name>
   ```

2. Diff anschauen:
   ```powershell
   git diff main..origin/refactor/v7.36.0-staging --stat
   ```

3. Code-Files holen, **NICHT** `package.json`, `src/Service/FeaturePopupService.ts`, `HHAuto.user.js` (Versionsstand auf main bleibt eigene Reihe):
   ```powershell
   $files = @(
       "docs-internal/circular-baseline.json",
       "<weitere Code-Files aus dem Diff-Stat>"
   )
   foreach ($f in $files) { git checkout origin/refactor/v7.36.0-staging -- $f }
   ```

4. Versions-Bump auf main-Reihe:
   - `package.json` und `src/Service/FeaturePopupService.ts` von der aktuellen main-Version auf die naechste Patch bumpen.
   - Staging-Version (z.B. 7.35.64) **ignorieren**.

5. CHANGELOG-Eintrag oben einfuegen, User-Sicht, keine Issue-Refs.

6. Sweep:
   ```powershell
   Select-String -Path README.md,CHANGELOG.md -Pattern '#\d{3,5}'
   Select-String -Path README.md,CHANGELOG.md -Pattern '\b(Refs|Closes|Fixes|Resolves|Addresses) #' -CaseSensitive
   ```
   Beide muessen leer sein.

7. Verifikation:
   ```powershell
   npm run build
   npm run typecheck
   npx jest --runInBand --no-coverage
   npm run lint    # (bzw. npx eslint <touched files> wenn die Repo-Baseline noisy ist)
   npm run deps:circular:check
   ```

8. Commit + Push + PR. Commit-Body listet alle Cluster aus staging mit Hash + Inhalt. PR-Body mit User-Effekt, Files, Verifikation, `Refs #1722`.

9. CI gruen abwarten, mergen:
   ```powershell
   gh pr checks <PR> --watch
   gh pr merge <PR> --rebase --delete-branch
   ```

10. Staging auf neues main reseten:
    ```powershell
    git checkout refactor/v7.36.0-staging
    git branch --show-current   # Pflicht-Check vor reset!
    git reset --hard origin/main
    git push --force-with-lease
    git ls-remote origin refactor/v7.36.0-staging   # Pflicht-Verify
    git rev-parse refactor/v7.36.0-staging
    ```

11. Issue #1722 Status-Kommentar posten:
    ```powershell
    $commentFile = Join-Path $env:TEMP 'step3_issue_comment.md'
    [IO.File]::WriteAllText($commentFile, $comment, [Text.UTF8Encoding]::new($false))
    gh issue comment 1722 --body-file $commentFile
    ```
    Inhalt: User-Sicht-Block + abschliessende Zeile `Shipped to main as v<NEW>`. Idempotenz-Check vorher: `gh api repos/.../issues/1722/comments --jq '.[].body' | Select-String "Step <N>"`.

## Bekannte Pitfalls

### FF-Merge ohne Push-Verifikation verliert Stand

Lesson `_lessons/ff-merge-push-staging-pitfall.md` hat die volle Begruendung. Kurzform: nach `git push origin refactor/v7.36.0-staging` IMMER `git ls-remote` plus `git rev-parse` vergleichen, bevor der naechste Cluster startet. `git reset --hard <ref>` ist HEAD-bezogen, nicht namens-bezogen.

### TDZ-Crash durch zirkulaeren Import

Lesson `_lessons/zirkulaerer-import-tdz-crash.md`. Bei der Migration koennten neue Imports zwischen Modulen entstehen (z.B. wenn ein Action-Handler in Pipeline.config.ts gezogen wird). **Pflicht:** `npm run deps:circular:check` vor jedem Push. Wenn neue Cycles auftauchen, erst strukturell pruefen (Setter-Pattern), nicht direkt Baseline refreshen.

### `wouldFightWithPower` synchron zu `handleTrollBattle` halten

Lesson `_lessons/mapping-fix-vollstaendig-pruefen.md`. Bei der Migration von `handleTrollBattle` (3.2.f) muss `wouldFightWithPower` mit-migriert oder mit der neuen Aktivierungs-Pfad-Liste synchronisiert werden. JSDoc-Block in `AutoLoopActions.ts:394-431` (post-Cluster E) gibt das Maintenance-Pattern vor.

### Pipeline-Handler-Cool-Down ueber Page-Reload

ADR-002 (`docs/decisions/ADR-002-pipeline-cooldown-persistence.md`). `Scheduler.lastRunAt`-Map wird in sessionStorage unter `TK.pipelineLastRunAt` persistiert. Bei der Migration eines Multi-Step-Chains (z.B. `handlePlaceOfPower`) muss der Page-Reload-Persistenz-Mechanismus respektiert werden, sonst kommt das #1700-Pattern zurueck.

### Issue-Refs nur in Commit/PR-Body

Nicht in CHANGELOG, README, Issue-Kommentaren oder Doku. Sweep-Regex steht in Schritt 6 oben.

### Refactor-Stille bis 7.36.0

Auf der Refactor-Linie kein CHANGELOG-Eintrag. Erst beim main-Squash kommt der CHANGELOG-Block (User-Sicht). Hotfix-PRs auf main duerfen einen Eintrag haben.

## Aufraeumen am Ende dieser Session

- 13 Sub-Branches geloescht (Cluster C, B, X, Y, Z, A1, A2, D, E, F + step-3-Squash-Branch + zwei Hotfix-Branches). Lokale Branch-Liste reduziert auf `main`, `refactor/v7.36.0-staging`, und ggf. `review/AutoLoop` (Doku-Branch).
- PR #1733 gemerged auf main als Commit `a94ad308`.
- Issue #1722 hat den Step-3-Status-Kommentar.
- Staging auf neues main resetted, Push verifiziert.
- Lessons unveraendert seit Session-Start.
- Roadmap mit Step-3-Squash-Eintrag aktualisiert.

## Prompt fuer naechste Session

```
Refactor an HHAuto fortsetzen.

Lies zuerst:
1. docs-internal/REVIEW_ROADMAP.md (Steuerungsdatei, Status der Schritte)
2. docs-internal/SESSION_HANDOVER_2026-05-23.md (dieser Handover)
3. docs-internal/REVIEW_AutoLoop_Findings.md (Synthese-Block, Cluster-Plan fuer 3.2)
4. docs-internal/REVIEW_AutoLoop.md (Workflow-Spec, Tick-Algorithmus, 33 Handler)

Naechster Schritt: Schritt 3.2.G -- 33-Handler-Migration in Scheduler-Pipeline.

Vor Beginn der Migration sind drei Architektur-Fragen zu klaeren (siehe
Handover-Sektion "Strategie-Entscheidung vor 3.2.a"):

1. Pipeline-Handler-Signatur: ctx-Argument oder ohne (heutiger Stil)?
2. runStandardHandler-Migrations-Pattern: convertToHandlerConfig-Helper?
3. lastActionPerformed-Mechanik fuer Multi-Tick-Action-Handler?

Empfohlener Einstieg: 3.2.a (Shop, AutoEquipBoosters) als Pilot, daraus
das Migrations-Pattern ableiten, dann 3.2.b als Massen-Migration ueber
runStandardHandler.

Branch-Modell: Sub-Cluster auf eigenem Branch, FF-Merge auf staging,
Versions-Bump fortlaufend ab 7.35.56. Bei stabilem Stand nach 3.2.a-i
Squash-via-Diff nach main wie in Step 3.

Beachte:
- KEINE ABKUERZUNGEN beim Re-Verify, jeder Befund einzeln gegen Code geprueft.
- Pause nach jedem Sub-Cluster, Test-Freigabe vom User abwarten.
- Refactor-Stille: kein CHANGELOG-Eintrag bis 7.36.0 (ausser bei Hotfix-PRs auf main).
- Issue-Refs nur in Commit-/PR-Body (Refs #1722), nicht in CHANGELOG/README.
- Versions-Bumps auf staging fortlaufend ab 7.35.56.
- FF-Merge/Push-Verify-Pflicht (Lesson ff-merge-push-staging-pitfall).
- Cycle-Check vor jedem Push (Lesson zirkulaerer-import-tdz-crash).
- wouldFightWithPower synchron zu handleTrollBattle halten (Lesson
  mapping-fix-vollstaendig-pruefen).
```

## Status-Kompakt

| Metrik | Wert |
|---|---|
| main HEAD | `a94ad308` |
| main Version | 7.35.55 |
| staging HEAD | `a94ad308` (= main) |
| staging Version | 7.35.55 (naechster Bump: 7.35.56) |
| Tests | 60 Suites, 811 Specs, alle gruen |
| Cycle-Baseline | 381 |
| Bundle | 1.43 MiB |
| Lint (full) | 60 errors / 820 warnings (Repo-Baseline, nicht von Schritt 3 verschlechtert) |
| Lint (touched files Schritt 3) | 0 errors / 59 warnings (alle pre-existing) |
