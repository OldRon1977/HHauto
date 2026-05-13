# HHAuto Code Review - Session-Uebergabe (Phase 2 Start)

**Datum:** 2026-05-13 (Update)
**Branch:** ``main`` (alle Vorbereitungen sind gemerged)
**Letzter Commit auf main:** ``2f0ee684 fix(scripts): use madge programmatic API in check-circular-deps``
**Naechste Aufgabe:** Phase 2 starten -- Modul-Review von ``Service/PageNavigationService.ts``

## Was abgeschlossen ist

### Vorbereitungs-Phasen (alle gemerged in main)

1. **Tooling-Setup (PR #1686)** -- ESLint, madge, knip, depcheck, jscpd, webpack-bundle-analyzer.
2. **Phase 0 -- Inventory** -- ``docs-internal/REVIEW_PHASE0.md``. LoC, Coverage, Risiko-Heatmap, Hot-Spot-Ranking.
3. **Phase 1 -- CI Gates (PR #1687)** -- typecheck, eslint-on-diff via reviewdog, circular-baseline gate.
4. **CI Lockfile-Resync (PR #1688)** -- typescript-Versions-Drift im Lockfile gefixt, CI lief vorher rot.
5. **ADR-001 + Refactor (PR #1689)** -- alle Barrel-Files gedropped, ``no-restricted-imports`` ESLint-Regel, Bundle 1.40 MiB -> 1.39 MiB.

### Architekturentscheidung

ADR-001 (``docs/decisions/ADR-001-drop-barrels.md``) ist akzeptiert: barrel ``index.ts``-Files sind dauerhaft verboten, durch Direktimports ersetzt.

Wichtig fuer Phase 2 zu verstehen:

- **227 Cycles vorher / 544 Cycles nachher** ist KEIN Rueckschritt, sondern Mess-Praezision. Vorher wurden viele File-zu-File-Edges durch die Barrels collapsiert; jetzt zeigt madge sie alle einzeln. Echter File-zu-File-Cycle-Pool ist ueberschaubar (~30 Stueck der 2-File-Cycles), die anderen ~500 sind kombinatorische Pfad-Variationen.
- ``LanguageHelper.ts`` hat jetzt **explizite Side-Effect-Imports** der i18n-Sprach-Files (``de``, ``en``, ``es``, ``fr``). Das war vorher implizit ueber den Barrel und fragil.

### Aktuelle Baselines

| Metrik | Wert |
|---|---|
| Source-Files | 132 (war 144 -- Differenz sind die geloeschten 11 Barrels + 1 Wert) |
| Test-Files | 56 |
| Tests | 807, alle gruen |
| Coverage Statements | 32.96% (war 31.31%, leicht hoch durch i18n-Side-Effect-Loads) |
| Coverage Branches | 20.45% |
| ESLint Errors / Warnings | 72 / 857 (Phase-0-Baseline; keine durch ADR-001-Refactor neu eingefuehrten) |
| Strict-TS-Errors | 2192 (unveraendert, advisory) |
| Circular Cycles | 544 (Baseline ist committed) |
| Bundle | 1.39 MiB |
| ``unsafeWindow`` | 76 |
| ``$()`` jQuery | 969 |
| ``as any`` | 45 |
| Karma-Stack-Vulnerabilities | 5C / 12H / 8M / 9L (alle devDeps, Phase-5-Cleanup-Job) |

### Aktive CI-Gates (auf jedem PR)

Blocking:
- ``npm test``
- ``npm run build``
- ``npm run typecheck``
- ``npm run deps:circular:check`` (vergleicht gegen ``docs-internal/circular-baseline.json``)
- ESLint via reviewdog auf geaenderten Zeilen, errors-only

Advisory:
- ``npm run deps:dead`` (knip)

Lokal verfuegbar, nicht in CI:
- ``npm run typecheck:strict``, ``npm run deps:unused``, ``npm run dup:check``, ``npm audit``

## Was als naechstes ansteht: Phase 2 Modul-Review

Hot-Spot-Reihenfolge (aus ``REVIEW_PHASE0.md`` Abschnitt 4):

1. **``Service/PageNavigationService.ts``** -- core routing, 11.34% Coverage, 194 Statements, 3x ``location.reload``, 3x ``location.href``, Nav-Mutex
2. ``Helper/PageHelper.ts`` -- 35-LoC-Patch in 7.35.36, sub-tab routing
3. ``Service/AutoLoop.ts`` + ``AutoLoopActions.ts`` (990 LoC) + ``AutoLoopPageHandlers.ts`` (14 ``setTimeout``)
4. ``Helper/StorageHelper.ts``
5. Loop-Modul-Cluster: ``Quest.ts``, ``Contest.ts``, ``DailyGoals.ts``, ``Champion.ts``, ``PlaceOfPower.ts``
6. ``TeamModule.ts`` + ``TeamBuilderService.ts`` + ``TeamScoringService.ts``
7. ``HaremGirl.ts`` + ``Harem.ts``
8. ``Module/Events/*``
9. ``League.ts``, ``Troll.ts``, ``Shop.ts``, ``Pachinko.ts``, ``Labyrinth.ts``, ``PentaDrill.ts``
10. ``config/HHStoredVars.ts`` (2551 LoC, zuletzt)

### Vorgehen pro Modul

Pro Modul fuenf Review-Achsen:

1. **Korrektheit** -- Logik, Edge Cases, Error Pfade
2. **Lesbarkeit** -- Naming, Doku, Funktionsgroessen
3. **Architektur** -- Verantwortlichkeit, Coupling, Imports (jetzt direkt sichtbar dank ADR-001)
4. **Security** -- ``unsafeWindow`` Daten, untrusted Input
5. **Performance** -- Hot Loops, jQuery-Selektoren, Reflows

Findings mit Severity:

- **Critical** -- Bug oder Security-Issue, Fix vor Merge eines anderen Features
- **Important** -- Architektur- oder Korrektheits-Issue, Fix in absehbarer Zeit
- **Nit** -- Lesbarkeit, kleine Verbesserung
- **FYI** -- Hinweis ohne Action-Item

Output je Modul: ``docs-internal/REVIEW_<modul-pfad>.md``. Beispiel: ``docs-internal/REVIEW_PageNavigationService.md``.

Nach jedem Review:

- Findings sammeln, mit User durchsprechen
- **Critical/Important**: eigener Fix-PR pro Befund (oder gebuendelt wenn klein und logisch zusammenhaengend)
- **Nit/FYI**: in der REVIEW-Notiz dokumentieren, optional spaeter

## Wichtige Conventions fuer Phase 2

### Workflow (siehe ``.kiro/steering/06_Git_Workflow_HHAuto.md``)

- Branch-basiert, kein direkter Push auf ``main``
- Englisch fuer Commits, PR, README, Issue-Kommentare
- Versions-Bump nur wenn User-sichtbarer Code-Pfad beruehrt
- Issue-Refs nur in Commit/PR-Body, nicht in README/CHANGELOG/Issue-Kommentaren

### Branch-Naming

- Review-Phase: ``review/<modul-pfad>`` (Doku-Aenderung im Repo)
- Findings-Fix: ``fix/<finding-stichwort>``

### Doku im selben Commit

ADRs (``docs/decisions/ADR-NNN-...``), wenn Phase 2 weitere Architekturentscheidungen ausloest, im selben PR wie die Implementierung.

### Files OHNE BOM

Im Workspace alle Schreibvorgaenge ueber Python + ``pathlib.Path.write_text(content, encoding=\'utf-8\')``. Siehe ``05_File_Write_Workaround.md``.

### Tool-Output-Pruning

``gh pr create``, ``gh pr merge``, ``git push``: isoliert ausfuehren mit ``skipPruning: true``. Vor Re-Trigger Idempotenz-Check. Siehe ``04_Tool_Output_Pruning.md``.

## Lessons aus dieser Session

### CI Lockfile-Drift (PR #1688)

Symptom: ``npm ci`` schlug fehl mit ``Invalid: lock file\'s typescript@5.3.3 does not satisfy typescript@5.9.3``. Root Cause: madge\'s Subtree-Pakete ``dependency-tree``, ``filing-cabinet``, ``precinct`` haben TypeScript ``^5.9.3`` als regular dep. Top-Level war ``^5.3.3``. ``npm install`` akzeptiert das, ``npm ci`` ist strikt.

Fix: ``npm install --package-lock-only`` deduplizierte das, TypeScript wurde auf 5.9.3 gehoben (innerhalb ``^5.3.3`` semver-konform).

Lesson: nach jedem Tooling-PR ``npm ci`` lokal verifizieren, nicht nur ``npm install``.

### i18n Side-Effect-Loads via Barrel (ADR-001)

Symptom: Nach Codemod-Migration brach ``ButtonHelper.spec.ts``: ``getTextForUI`` lieferte ``"en/goToClubChampions/elementText not found"`` statt ``"Go To Club Champion"``.

Root Cause: ``HHAuto_ToolTips`` wird in ``i18n/empty.ts`` deklariert und in ``de.ts``, ``en.ts``, ``fr.ts``, ``es.ts`` per Side-Effect mit Texten befuellt. Frueher zog ``LanguageHelper.ts`` per ``import ... from "../i18n/index"`` den Barrel ein, der per ``export *`` ALLE Sprach-Files transitiv lud. Direkter Import auf ``empty.ts`` allein laedt die Sprach-Files nicht.

Fix: explizite Side-Effect-Imports in ``LanguageHelper.ts``:

```typescript
import { HHAuto_ToolTips } from "../i18n/empty";
import "../i18n/empty";
import "../i18n/en";
import "../i18n/fr";
import "../i18n/de";
import "../i18n/es";
```

Lesson: bei Refactor-Codemods auf Side-Effect-Imports pruefen, nicht nur Symbol-Aufloesung. Mein Codemod-Skript reportet jetzt jeden Side-Effect-Import und Default-Import als "skipped" und ist damit detektierbar.

### Madge stdout buffering auf Linux CI

Symptom: ``check-circular-deps.mjs`` failte auf Linux CI mit ``Failed to parse madge JSON: Unexpected end of JSON input`` -- aber nur auf CI, lokal auf Windows nie.

Root Cause: ``child.on("close", ...)`` feuert manchmal vor dem letzten stdout-Chunk. Bei kleinen Outputs nicht, bei ~30 KB JSON regelmaessig.

Fix: madge nicht mehr ueber ``spawn(npx)`` aufrufen, stattdessen die programmatic API ``import madge``. Kein Child-Process, kein Buffering-Risiko.

Lesson: bei groesseren Tool-Outputs lieber API als Subprocess.

## Pflichtlektuere fuer naechste Session

In dieser Reihenfolge:

1. **``docs-internal/REVIEW_HANDOVER.md``** (dieses File) -- komplett.
2. **``docs-internal/REVIEW_PHASE0.md``** -- mind. Abschnitt 4 (Hot-Spot-Ranking) und Abschnitt 3 (Risiko-Marker-Heatmap fuer ``PageNavigationService``).
3. **``docs/decisions/ADR-001-drop-barrels.md``** -- Architektur-Kontext fuer Imports im Code-Review.
4. **``.kiro/steering/06_Git_Workflow_HHAuto.md``** -- Workflow-Spezifika.
5. **``src/Service/PageNavigationService.ts``** -- das eigentliche Review-Subjekt.
6. **``spec/Service/PageNavigationService.spec.ts``** -- bestehende Test-Coverage.

## Nuetzliche Befehle

```powershell
# Repo
cd c:\Users\StephanMesser\.kiro\Arbeitsplatz\HHAuto

# Status
git status -sb
git log --oneline -5

# Build / Tests
npm run build
npm test

# Quality Gates
npm run lint
npm run typecheck
npm run typecheck:strict
npm run deps:circular:check
npm run deps:dead
npm run dup:check

# Bundle-Analyse
npm run bundle:stats
npm run bundle:analyze
```

## Skills aktivieren

Phase 2 zieht zwei Skills, die eingebunden gehoeren:

- **``code-review-and-quality``** -- bei jedem Modul-Review, vor Findings-Listung.
- **``adr-architecture-decision-records``** -- falls Phase 2 weitere Architekturentscheidungen sichtbar macht.

Optional bei knifflingen Stellen:

- **``doubt-driven-development``** -- adversarial Fresh-Context-Review, wenn ein Finding Stakes hat (Auth, Storage, Race Conditions).

## Prompt-Vorlage fuer naechste Session

Folgenden Block kann der User in eine neue Kiro-Session kopieren:

```text
HHAuto-Code-Review Phase 2 starten.

Aktueller Stand:
- main HEAD: 2f0ee684 (Variante A des ADR-001-Refactors gemerged).
- Phase 0 + Phase 1 + ADR-001 abgeschlossen.
- Detaillierte Uebergabe in docs-internal/REVIEW_HANDOVER.md.

Was du als erstes tun sollst:
1. Lies docs-internal/REVIEW_HANDOVER.md komplett.
2. Lies docs-internal/REVIEW_PHASE0.md, mindestens Abschnitt 3
   (Risiko-Marker fuer PageNavigationService) und Abschnitt 4
   (Hot-Spot-Ranking).
3. Lies docs/decisions/ADR-001-drop-barrels.md.
4. Lies .kiro/steering/06_Git_Workflow_HHAuto.md.
5. Aktiviere den Skill code-review-and-quality.
6. Lies src/Service/PageNavigationService.ts und
   spec/Service/PageNavigationService.spec.ts.
7. Ohne Code-Aenderung: Findings entlang der fuenf Review-Achsen
   (Korrektheit, Lesbarkeit, Architektur, Security, Performance)
   sammeln, Severity-Labels (Critical/Important/Nit/FYI) vergeben,
   Output in docs-internal/REVIEW_PageNavigationService.md ablegen.
8. Mit mir die Befunde durchsprechen, bevor irgendein Fix-PR
   entsteht.
```

## Risiken / Offene Punkte

### Karma-Stack

5 Critical, 12 High Vulnerabilities aus den Karma-Pakages. Phase 5 ist der Cleanup-Job. Bis dahin: ``npm audit`` bleibt rot, ist aber nicht in CI als Gate aktiv.

### ESLint-Errors auf main

72 vorbestehende Errors. Reviewdog blockt auf neue Errors auf veraenderten Zeilen, lasst die alten unangetastet. Phase 6 (Doku & Steering) oder eine spezielle Lint-Cleanup-Phase kann das angehen.

### Test-Coverage 32.96%

Niedrig, besonders in Modules wie ``Harem.ts`` (1.83%), ``Shop.ts`` (1.66%), ``PlaceOfPower.ts`` (5.83%). Phase 2 wird das modulweise heben durch gezielte Tests fuer die hot-spots-Branches.

### Strict-TS-Backlog

2192 Strict-TS-Errors. ``typecheck:strict`` ist advisory. File-by-file-Migration als laufender Task neben Phase 2 moeglich, sobald ein Modul gereviewed ist.
