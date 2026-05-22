# Session-Handover -- HHAuto Refactor

**Datum letzter Stand:** 2026-05-22 (Ende Schritt 2)
**Aktueller Branch:** `main` (Version 7.35.54)
**Refactor-Branch:** `refactor/v7.36.0-staging` (synchron mit `main` nach Schritt-2-Reset)

## Was abgeschlossen ist

### Schritt 1 -- PageNavigationService Refactor (komplett auf main)

7 Cluster, gemerged via PR #1727 (Commit `a42d330d`, Version 7.35.53). Issue #1722 hat den aktualisierten Status-Kommentar fuer Schritt 1.

### Schritt 2 -- PageHelper Refactor + League-Timer-Hotfix (komplett auf main)

5 Cluster A-E plus Hotfix, gemerged via PR #1730 (Commit `03d22fd5`, Version 7.35.54). Im einzelnen:

- A: Internal cleanup (I5, I6, N1-N5, F1, I8 Spec-Erweiterung, I9 mockDomain-Restore)
- B: Pop-Tab Edge-Cases (I3 Array-Inhaltspruefung, I4 `??` statt `||`)
- C: getPage detoxify (I1, neuer `haltScript`-Helper)
- D: PoP-Coupling aufgeloest via `getPopFallbackIndex` (I7 + C1, Variante C)
- E: Activities-Sub-Tab-Datentabelle (N6)
- Hotfix: `nextLeaguesTime` wird nach Battle-Trigger gesetzt -- Liga-Timer wieder im Popup, Debug-Reset moeglich

CHANGELOG-Eintrag `v7.35.54 - PageHelper review and league timer fix`.
Issue #1722 hat den editierten Step-2-Status-Kommentar mit "Shipped to main as v7.35.54".

### Side-Effekte auf main seit Schritt 1

- Cycle-Baseline auf main: 383 (war 509 nach Schritt 1).
- Lint-Last: 60 Errors / 850 Warnings (war 72/857).
- Bundle: 1.43 MiB.

### Reverted Experimente in Schritt 1 (haengen unveraendert im Backlog)

- Cluster C+ -- setLastPageCalled mit page-id statt URL. Reverted.
- Cluster D' -- handleGoHome Self-Heal mid-session. Reverted.
- Beide tracken den praeexistenten **handleGoHome-Bug**: ctx.currentPage (page-id) vs lastPageCalled.page (URL) -- Equality-Check schlaegt nie an. In `REVIEW_BACKLOG.md` als Phase-2-Hot-Spot eingetragen.

## Was als naechstes ansteht

### Schritt 3 (Roadmap) -- AutoLoop-Cluster Code-Review

`AutoLoop.ts` + `AutoLoopActions.ts` + `AutoLoopPageHandlers.ts`.
Workflow-Spec existiert bereits (`REVIEW_AutoLoop.md`), das ist kein Code-Review-File.

Aus `REVIEW_ROADMAP.md`:

> 3.1 Code-Review-Datei erweitern (`REVIEW_AutoLoop.md` oder neues Findings-File).
> 3.2 Migration der 33 Action-Handler in die Scheduler-Pipeline -- ein Handler pro PR, Pattern aus Phase-1-Sessions 3+4.

Hot-Spot-Begruendung aus `REVIEW_PHASE0.md` Abschnitt 4: das Scheduling-Hirn, 990 LoC allein in AutoLoopActions, 14 setTimeout-Aufrufe in PageHandlers. Coverage-Werte aus Phase 0: AutoLoop 12.05%, AutoLoopActions 12.05%, AutoLoopPageHandlers tief.

### Vorbereitung fuer Schritt 3

- Bei einem **Code-Review-File** (anders als Workflow-Spec): Format wie `REVIEW_PageHelper.md` -- 5 Achsen, Severity Critical/Important/Nit/FYI.
- Branch fuer das Code-Review-File: `review/AutoLoop` (nur Doku, gitignored, kein PR auf main, kein Versions-Bump).
- Pre-Phase Re-Verify-Pflicht aus Roadmap entfaellt fuer 3.1, weil **kein bestehendes Code-Review** existiert. 3.2 wird die Pre-Verify auf das in 3.1 erstellte File anwenden.

### Roadmap-Reihenfolge (verbleibend)

1. Schritt 3 (AutoLoop-Cluster: AutoLoop.ts + AutoLoopActions.ts + AutoLoopPageHandlers.ts)
2. Schritt 4 (StorageHelper)
3. weiter laut Roadmap

## Wichtige Files fuer den Wiedereinstieg

| Datei | Zweck |
|---|---|
| `docs-internal/REVIEW_ROADMAP.md` | Steuerungsdatei, Schritt-Status |
| `docs-internal/REVIEW_HANDOVER.md` | Phase-2-Methodik (5-Achsen-Review, Severity-Schema) |
| `docs-internal/REVIEW_PHASE0.md` | Hot-Spot-Ranking, Coverage-Baseline |
| `docs-internal/REVIEW_BACKLOG.md` | Offene Backlog-Eintraege (handleGoHome-Bug eingetragen) |
| `docs-internal/REVIEW_PageHelper.md` | Vorbild fuer das naechste Code-Review-File (Schritt 3.1) |
| `docs-internal/REVIEW_AutoLoop.md` | Bestehende Workflow-Spec, gibt Soll-Verhalten vor (Quelle fuer Re-Verify in 3.2) |

## Branch-Modell

Aus `REVIEW_ROADMAP.md` Sektion **Refactor-Branch-Modell**:

- Sammel-Branch: `refactor/v7.36.0-staging`. Aktuell synchron mit main (Reset 2026-05-22 nach Schritt 2).
- Pro Cluster ein Sub-Branch (`refactor/<modul>-<aspect>`), Direkt-Merge auf staging via fast-forward.
- Versionierung auf staging: patch-bumpen, weiter ab letzter staging-Version. Nach dem Schritt-2-Reset ist staging auf 7.35.54. **Naechster Bump auf staging: 7.35.55** (frisch ab main).
- Cherry-Pick / Squash nach main bei stabilem Stand (siehe Squash-Workflow unten).
- Hotfixes auf main: 9-von-10-Faellen direkt auf der Refactor-Linie bauen, mit naechstem stabilen Stand nach main.

## Workflow je Cluster (auf staging)

1. Pre-Phase Re-Verify (Pflicht, alle Befunde einzeln pruefen).
2. Branch von staging anlegen.
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

3. Code-Files holen, **NICHT** package.json/FeaturePopupService.ts/HHAuto.user.js (Versionsstand auf main bleibt eigene Reihe):
   ```powershell
   $files = @(
       "docs-internal/circular-baseline.json",
       "<weitere Code-Files aus dem Diff-Stat>"
   )
   foreach ($f in $files) { git checkout origin/refactor/v7.36.0-staging -- $f }
   ```

4. Versions-Bump auf main-Reihe:
   - `package.json` und `src/Service/FeaturePopupService.ts` von der aktuellen main-Version auf die naechste Patch bumpen.
   - Staging-Version (z.B. 7.35.59) **ignorieren**.

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
   npm run lint
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
    git reset --hard origin/main
    git push --force-with-lease
    git ls-remote origin refactor/v7.36.0-staging
    ```

11. Issue #1722 Status-Kommentar editieren:
    ```powershell
    gh api -X PATCH "/repos/OldRon1977/HHauto/issues/comments/<id>" -F body=@"INPUT/<draft>.md"
    ```
    Inhalt: bestehender User-Sicht-Block + abschliessende Zeile `Shipped to main as v<NEW>`.

## Bekannte Pitfalls

### FF-Merge ohne Push-Verifikation verliert Stand

Lesson `_lessons/ff-merge-push-staging-pitfall.md` hat die volle Begruendung. Kurzform: nach `git push origin refactor/v7.36.0-staging` IMMER `git ls-remote` plus `git rev-parse` vergleichen, bevor der naechste Cluster startet. `git reset --hard <ref>` ist HEAD-bezogen, nicht namens-bezogen.

### Issue-Refs nur in Commit/PR-Body

Nicht in CHANGELOG, README, Issue-Kommentaren oder Doku. Sweep-Regex steht in Schritt 6 oben.

### Refactor-Stille bis 7.36.0

Auf der Refactor-Linie kein CHANGELOG-Eintrag. Erst beim main-Squash kommt der CHANGELOG-Block (User-Sicht). Hotfix-PRs auf main duerfen einen Eintrag haben (Beispiel: 7.35.54 hat den PageHelper-Eintrag plus den Liga-Timer-Hotfix in einem Block).

## Aufraeumen am Ende dieser Session

- 7 Sub-Branches geloescht (alle PageHelper-Cluster + Hotfix + Review-Doc-Branch). Lokale Branch-Liste reduziert auf `main` und `refactor/v7.36.0-staging`.
- Lesson `_lessons/ff-merge-push-staging-pitfall.md` angelegt im Workspace-Steering.
- Dieser Handover ueberschreibt den vorherigen `SESSION_HANDOVER_2026-05-22.md` (kein Datums-Suffix, weil keine Historie noetig).

## Prompt fuer naechste Session

```
Refactor an HHAuto fortsetzen.

Lies zuerst:
1. docs-internal/REVIEW_ROADMAP.md (Steuerungsdatei, Status der Schritte)
2. docs-internal/SESSION_HANDOVER_2026-05-22.md (dieser Handover)
3. docs-internal/REVIEW_PHASE0.md (Hot-Spot-Begruendung fuer Schritt 3)

Naechster Schritt: Schritt 3.1 -- Erstelle docs-internal/REVIEW_AutoLoop_Findings.md
(neues Code-Review-File, NICHT die bestehende Workflow-Spec REVIEW_AutoLoop.md
ueberschreiben). Format wie docs-internal/REVIEW_PageHelper.md (5 Achsen, Severity
Critical/Important/Nit/FYI). Quelldateien:
- src/Service/AutoLoop.ts
- src/Service/AutoLoopActions.ts
- src/Service/AutoLoopPageHandlers.ts
- src/Service/Scheduler.ts (kontextuell, weil 33-Handler-Migration parallel laeuft)
Aktive Tests: spec/Service/AutoLoop*.spec.ts.

Branch fuer das Review: review/AutoLoop (nur Doku, gitignored, kein PR auf
main, kein Versions-Bump).

Findings am Ende mit mir besprechen, dann nach Severity in Cluster aufteilen
und auf der Refactor-Linie umsetzen (Sammel-Branch refactor/v7.36.0-staging).

Beachte:
- KEINE ABKUERZUNGEN beim Re-Verify, jeder Befund einzeln gegen Code geprueft.
- Pause nach jedem Cluster, Test-Freigabe vom User abwarten.
- Refactor-Stille: kein CHANGELOG-Eintrag bis 7.36.0 (ausser bei Hotfix-PRs auf main).
- Issue-Refs nur in Commit-/PR-Body, nicht in CHANGELOG/README.
- Versions-Bumps auf staging fortlaufend ab 7.35.55.
- FF-Merge/Push-Verify-Pflicht (siehe Workflow-Schritt 6 im Handover, Lesson
  ff-merge-push-staging-pitfall).
```
