# HHAuto Code Review - Session-Uebergabe

**Datum:** 2026-05-13
**Branch:** `chore/dev-tooling-setup` (gepusht zu origin)
**Letzter Commit:** `511d95f chore(tooling): add lint, dep-graph, dead-code, audit gates`
**Naechster Workflow-Schritt:** 10 (Freigabe-Gate). Steht noch aus.

## Was bisher gelaufen ist

### Aktueller Auftrag

Code Review fuer das HHAuto-Repo. In der vorigen Session abgesteckt
auf einen mehrphasigen Plan, weil 144 Source-Files nicht in einem
Schwung review-bar sind.

### Bereits abgeschlossen

1. **Initial-Review** der letzten Release-Kette (`5ebacf8` ->
   `818d301`, v7.35.36, Issue #1672 Loop-Fixes). Findings:
   - Critical: toter Wrong-POP-Recovery-Block in
     `PageHelper.getPage` nach dem if->else-if-Refactor.
   - Important: keine Regressionstests fuer den Subtab-Konflikt.
   - Verdict: approve mit zwei Follow-ups, Fix selbst korrekt.
2. **Tooling-Setup** auf eigenem Branch `chore/dev-tooling-setup`:
   - Pinned devDependencies installiert (eslint, typescript-eslint,
     globals, madge, knip, depcheck, jscpd, webpack-bundle-analyzer).
   - Configs angelegt: `eslint.config.mjs`, `tsconfig.strict.json`,
     `knip.json`.
   - `tsconfig.json` um `skipLibCheck: true` erweitert
     (build-neutral).
   - `.gitignore` um `stats.json` erweitert.
   - 9 neue npm-Scripts: lint, typecheck, typecheck:strict, deps:*,
     dup:check, bundle:*.
   - Smoke-Tests aller Tools gruen.
3. **Phase 0 (Inventory)** abgeschlossen, Output in
   `docs-internal/REVIEW_PHASE0.md`. Enthaelt LoC-Tabellen,
   Coverage-Gap, Lint-Baseline, Strict-TS-Baseline, Risiko-
   Heatmap, Hot-Spot-Ranking fuer Phase 2, architektonische
   Befunde.

### Wichtigste Phase-0-Zahlen

| Metrik | Wert |
| --- | --- |
| Source-Files (TS) | 144 |
| Test-Files (TS) | 56 |
| Test-Coverage Statements / Branches | 31.31% / 20.43% |
| ESLint Errors / Warnings | 72 / 857 |
| Strict-TS-Errors | 2192 |
| Circular Dependencies (madge) | 227 |
| Knip Unused Exports | 31 |
| jQuery `$()` Aufrufe | 969 |
| `unsafeWindow` Stellen | 76 |
| `as any` Casts | 45 |
| npm-audit | 5C / 12H / 8M / 9L (alle devDeps) |

### Top-3 architektonische Findings

1. **227 Circular Imports** durch barrel-Files (`index.ts` in jedem
   Modulordner re-exportiert alles, schafft transitive Zyklen).
2. **Karma-Stack ist Dead Code** in devDependencies, Quelle der
   meisten npm-audit-Vulnerabilities.
3. **969 jQuery-Selektoren** ohne zentralen Layer, Site-Update-
   Risiko hoch.

## Wo der Code gerade steht

- Branch `chore/dev-tooling-setup` ist gepusht und steht zum PR
  bereit.
- `main` ist unveraendert seit `818d301` (v7.35.36).
- **Schritt 10 des Workflow (Freigabe-Gate) wartet auf User-Test.**
  Der User soll lokal pruefen:
  - `npm test` -> 56/56 grun, 807/807 Tests passen
  - `npm run build` -> 1.4 MiB Bundle, kein Diff zu vorher
  - `HHAuto.user.js` ist nicht im Commit (bewusst, war nur
    CRLF-Normalisierung)
- Erst nach Freigabe: PR oeffnen, CI abwarten, Rebase-Merge,
  Branch loeschen.

## Plan, wie es weitergeht

### Ausstehende Workflow-Schritte fuer diesen Branch

11. PR erstellen via `gh pr create --base main --head chore/dev-tooling-setup`. Body nur kurze Beschreibung; **kein** `Refs #N` (keine Issue-Verknuepfung, weil rein internes Tooling).
12. CI abwarten.
13. `gh pr merge --rebase --delete-branch`.
14. Lokal `git checkout main && git pull --rebase && git branch -d chore/dev-tooling-setup`.

Kein Versions-Bump (Schritt 3) noetig: rein internes Tooling, kein
User-sichtbarer Code-Pfad. Kein Release-Notes-Eintrag (Schritt 6).
Kein Issue-Kommentar (Schritt 7/15), weil kein Issue.

### Nach Merge: Phase-Plan

Detail in `REVIEW_PHASE0.md` Abschnitt 4 und 7. Kurzfassung:

**Phase 1 - Quality-Gate-Entscheidung (1 Sitzung):**
- Festlegen, welche neuen Gates CI-pflichtig werden:
  - `npm test`: pflicht (ist sie schon)
  - `npm run lint` mit `--max-warnings 0` auf Errors: pflicht?
  - `npm run typecheck`: pflicht?
  - `npm run typecheck:strict`: nur advisory waehrend der Migration?
  - `npm run deps:circular`: empfehlung neue PRs blocken, die
    neue Zyklen einfuehren.
- Entscheidung in `.github/workflows/` umsetzen (CI existiert
  bereits, evtl. erweitern).

**Phase 2 - Module-by-Module-Review (Wochen):**
Reihenfolge gemaess Hot-Spot-Ranking aus `REVIEW_PHASE0.md`:

1. `Service/PageNavigationService.ts`
2. `Helper/PageHelper.ts`
3. `Service/AutoLoop.ts` + AutoLoopActions + AutoLoopPageHandlers
4. `Helper/StorageHelper.ts`
5. `Module/Quest.ts`, `Contest.ts`, `DailyGoals.ts`, `Champion.ts`,
   `PlaceOfPower.ts`
6. `Module/TeamModule.ts` + TeamBuilderService + TeamScoringService
7. `Module/harem/HaremGirl.ts` + Harem.ts
8. `Module/Events/*`
9. `Module/League.ts`, `Troll.ts`, `Shop.ts`, `Pachinko.ts`,
   `Labyrinth.ts`, `PentaDrill.ts`
10. `config/HHStoredVars.ts`

Pro Modul: fuenf Achsen (Korrektheit, Lesbarkeit, Architektur,
Security, Performance) durchgehen, Findings mit Severity-Labels
(Critical / Important / Nit / FYI) sammeln, Output je Modul
in `docs-internal/REVIEW_<modul>.md` ablegen.

**Phase 3 - Querschnittsthemen (1 Woche):**
- Race Conditions
- State Machines (autoLoop / navInFlight)
- Storage-Schluessel-Hygiene
- DOM-Selektor-Audit
- Tampermonkey-Spezifika
- Error-Pfade
- Security: untrusted unsafeWindow-Daten

**Phase 4 - Test-Strategie (1-3 Tage):**
- Coverage-Karte mappen.
- Bug-Bash-Liste der letzten 6 Monate auf Regressions-Tests
  pruefen.
- Tests fuer hot-spot-Module ergaenzen.

**Phase 5 - Dependencies und Build (1/2 Tag):**
- Karma-Stack droppen (entfernt 20+ Vulnerabilities).
- Bundle-Analyzer auswerten.
- depcheck-False-Positives klaeren.

**Phase 6 - Doku und Steering (1/2 Tag):**
- Project-Index pflegen.
- README/`docs-internal` mit dem Code abgleichen.

### Architekturelle Vorab-Entscheidung empfohlen

Vor Phase 2 sinnvoll: ADR (Architecture Decision Record) zu den
227 Circular Imports anlegen. Kandidat-ADR-Pfad:
`docs/decisions/ADR-001-circular-imports.md`. Optionen:
1. Direkte Pfad-Imports einfuehren, barrels droppen.
2. Barrel-Hierarchie strikt einseitig (Helper -> Utils,
   Module -> Helper+Utils, Service -> alle).
3. Status quo dulden, neue Zyklen blocken.

Skill `adr-architecture-decision-records` aktivieren, wenn diese
Entscheidung ansteht.

## Nuetzliche Befehle (Kurzreferenz)

```powershell
# Repo-Pfad
cd c:\Users\StephanMesser\.kiro\Arbeitsplatz\HHAuto

# Branch-Status
git status -sb
git log --oneline -5

# Build / Tests
npm run build
npm test

# Quality Gates (alle in dieser Session installiert)
npm run lint
npm run typecheck
npm run typecheck:strict
npm run deps:circular
npm run deps:dead
npm run deps:unused
npm run dup:check

# Bundle-Analyse (oeffnet Browser)
npm run bundle:stats
npm run bundle:analyze
```

## Steering-Reminder fuer die naechste Session

- HHAuto ist **Branch-basiert**, kein direkter Push auf `main`.
- Sprache: Englisch fuer Commits, PR, README, Issue-Kommentare.
  Deutsch fuer interne Doku/Reasoning.
- Versions-Bump im selben PR wie Code-Aenderung, sobald
  User-Pfad beruehrt (siehe `06_Git_Workflow_HHAuto.md`).
- Issue-Refs nur in Commit/PR-Body, nie in README/CHANGELOG/Issue-
  Kommentaren.
- Files OHNE BOM schreiben - im Workspace immer ueber Python
  + `pathlib.Path.write_text(content, encoding='utf-8')` (siehe
  `05_File_Write_Workaround.md`).
- Bei `gh issue comment` / `gh pr create` / `git push`: isoliert
  ausfuehren, `skipPruning: true`. Vor Re-Trigger Idempotenz-
  Check (siehe global `04_Tool_Output_Pruning.md`).
- Pflicht-Reaktion auf Korrekturen: Pattern erkennen, Lesson in
  `_lessons/` ablegen (siehe `11_Self_Improvement_Loop.md`).

## Prompt fuer die naechste Session

Folgenden Block kann der User in eine neue Kiro-Session kopieren,
wenn er den Review fortsetzen will. Anpassen: was am Ziel sein
soll (PR aufmachen, Phase 2 starten, etc.).

```text
Wir setzen den HHAuto-Code-Review aus der letzten Session fort.

Stand:
- Branch chore/dev-tooling-setup (commit 511d95f) ist gepusht.
- Phase 0 (Inventory) abgeschlossen, dokumentiert in
  docs-internal/REVIEW_PHASE0.md.
- Detaillierte Uebergabe in
  docs-internal/REVIEW_HANDOVER.md.
- Naechster Workflow-Schritt: 10 (Freigabe-Gate fuer
  chore/dev-tooling-setup steht aus).

Was du als erstes tun sollst:
1. Lies docs-internal/REVIEW_HANDOVER.md komplett.
2. Lies docs-internal/REVIEW_PHASE0.md, mindestens Abschnitte
   4 (Hot-Spot-Ranking) und 5 (Architectural Findings).
3. Lies .kiro/steering/06_Git_Workflow_HHAuto.md (Workflow-
   Spezifika fuer dieses Repo).
4. Frage mich, was als naechstes ansteht. Optionen:
   a) PR fuer chore/dev-tooling-setup oeffnen (Workflow-
      Schritte 11-14 nach erteilter Freigabe).
   b) ADR-001 zu den 227 Circular Imports erstellen
      (Skill adr-architecture-decision-records).
   c) Phase 2 starten mit
      Service/PageNavigationService.ts.
   d) Phase 1 (CI-Gate-Entscheidung) zuerst.
5. Erst nach meiner Antwort handeln.
```
