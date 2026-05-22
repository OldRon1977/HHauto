# Refactor-Linie nach main ausspielen (Squash-via-Diff)

Wenn ein groesserer Refactor-Schritt auf `refactor/v7.36.0-staging` test-frei ist und nach `main` fliessen soll: dieser Workflow.

## Wann anwenden

- Mehrere Cluster-Commits liegen auf `refactor/v7.36.0-staging`.
- Davon sind welche durch Reverts wieder rausgenommen (Cluster X+, X', ...).
- Versions-Bumps auf der staging-Linie (`7.35.59` ... `7.35.69`) sind diagnostische Patch-Bumps zwischen den Test-Iterationen, nicht das was main braucht.
- main hat seine eigene Versions-Reihe und braucht **eine** zusammenhaengende Aenderung mit **einem** Bump und **einem** CHANGELOG-Eintrag.

## Anti-Pattern: rebase oder Cherry-Pick aller Commits

- `git rebase --onto main` produziert sofort Konflikte, wenn dieselben Files in beiden Branches angefasst wurden (passiert bei jedem location.* Migration-Cluster).
- Cherry-Pick aller Commits packt 7+ kleine Bumps und CHANGELOG-Auseinandernehmungen in main; der Versionssprung-Salat wird unleserlich.

Stattdessen: **Squash-via-Diff**. Alle Source-Aenderungen aus staging in einen frischen Branch von main holen, auf main-Reihe bumpen, einen Commit, einen PR, ein CHANGELOG-Eintrag.

## Vorbereitung

```
git checkout main
git pull --ff-only

git checkout -b refactor/<step-name>
```

## Schritt 1 -- Files identifizieren

```
git diff main..origin/refactor/v7.36.0-staging --stat
```

Output zeigt alle geaenderten Files. Drei Files **NICHT** uebernehmen, weil main eigene Versions-Reihe hat:

- `package.json` (Versions-Bump frisch auf main-Reihe)
- `src/Service/FeaturePopupService.ts` (FEATURE_POPUP_TITLE frisch)
- `HHAuto.user.js` (Build-Output, wird beim `npm run build` neu erzeugt)

Alle anderen Files via `git checkout` aus staging holen.

## Schritt 2 -- Code-Files holen

PowerShell-Pattern (Liste anpassen je nach Diff-Stat-Output):

```
$files = @(
    "docs-internal/circular-baseline.json",
    "eslint.config.mjs",
    "spec/Service/PageNavigationService.spec.ts",
    "src/Module/Events/Season.ts"
    # ... alle Code-/Config-/Spec-Files aus dem Diff-Stat
)
foreach ($f in $files) {
    git checkout origin/refactor/v7.36.0-staging -- $f
}
git status -sb
```

Pruefen, dass alle erwarteten Files staged sind. `HHAuto.user.js` bleibt auf main-Stand, `package.json`/`FeaturePopupService.ts` bleiben auf main-Stand.

## Schritt 3 -- Versions-Bump auf main-Reihe

Naechster freier Patch-Bump auf main-Reihe (z.B. `7.35.52` -> `7.35.53`). Auf staging steht typischerweise eine viel hoehere Nummer (z.B. `7.35.69`) -- die spielt keine Rolle. main hat seine **eigene Reihe** und springt einfach um eins.

`package.json` aktualisieren:

- `"version": "<OLD>"` -> `"version": "<NEW>"`

`src/Service/FeaturePopupService.ts` aktualisieren:

- `const FEATURE_POPUP_TITLE = "HHAuto v<OLD>"` -> `const FEATURE_POPUP_TITLE = "HHAuto v<NEW>"`

Werkzeug: Python via `pathlib.Path.read_text` / `write_text` (Workspace-Workaround, siehe `~/.kiro/Arbeitsplatz/.kiro/steering/05_File_Write_Workaround.md`).

## Schritt 4 -- CHANGELOG-Eintrag

User-sichtbarer Effekt, kein Implementierungsdetail. Format wie bestehende Eintraege.

```
### v<NEW> - <Title>

- **<Effekt-Bullet 1>**.
- **<Effekt-Bullet 2>**.
- Optional: technische Notiz (1 Satz), wenn fuer Kontext relevant.
```

Eintrag oberhalb des bestehenden letzten Eintrags einfuegen.

KEINE Issue-Refs (Pflicht-Sweep nach jedem Edit):

```
Select-String -Path README.md,CHANGELOG.md -Pattern '#\d{3,5}'
Select-String -Path README.md,CHANGELOG.md -Pattern '\b(Refs|Closes|Fixes|Resolves|Addresses|Further addresses) #' -CaseSensitive
```

Beide muessen leer sein.

## Schritt 5 -- Build und volle Verifikation

```
npm run build
npm run typecheck
npx jest --runInBand --no-coverage
npm run lint
npm run deps:circular:check
```

Alle gruen erwartet. Lint-Errors muessen exakt der Phase-0-Baseline (62 Errors) entsprechen, sonst sind neue Probleme dazugekommen.

## Schritt 6 -- Stagen, commit, push

```
git add -A
git status -sb
```

Commit-Body: alle Cluster aus staging als Bullet-Points listen, mit Cluster-Hash und Inhalt. Beispiel siehe Commit `d562a93b` (PR #1727).

```
git commit -F "$env:TEMP\commit_msg.txt"
git push -u origin refactor/<step-name>
```

## Schritt 7 -- PR auf main

```
gh pr create --base main --head refactor/<step-name> --title "<title>" --body-file "$env:TEMP\pr_body.md"
```

PR-Body enthaelt:

- Ein-Satz-Zusammenfassung
- User-sichtbarer Effekt (verbatim aus CHANGELOG)
- Liste der geaenderten Files mit Zweck
- Verifikations-Resultate
- Hinweis auf reverted Experimente, wenn welche existieren
- `Refs #1722`

## Schritt 8 -- CI abwarten

```
gh pr checks <PR-Nummer> --watch
```

3/3 gruen erwartet (build-and-test, eslint, quality).

## Schritt 9 -- Merge

```
gh pr merge <PR-Nummer> --rebase --delete-branch
```

## Schritt 10 -- Refactor-Linie auf neues main reseten

Nach dem Merge ist die Refactor-Linie hinter main (die Cluster sind jetzt in main, die Diagnose-Bumps und reverteten Experimente nicht). Saubere Variante: hart reseten, sodass staging mit main synchron ist und neue Cluster ab dem main-Stand starten.

```
git checkout refactor/v7.36.0-staging
git reset --hard origin/main
git push --force-with-lease
```

Die naechsten Versions-Bumps auf staging starten ab dem main-Stand + 1 (z.B. `7.35.54`).

## Schritt 11 -- Issue-Kommentar updaten

Den Status-Kommentar auf #1722 aktualisieren (nicht neu posten, sondern editieren):

```
gh api -X PATCH "/repos/OldRon1977/HHauto/issues/comments/<comment-id>" -F body=@"INPUT/<draft>.md"
```

Inhalt: "shipped to main as v<NEW>", Verlinkung auf PR.

## Optional: lokale Branches aufraeumen

Test- und Diagnose-Branches loeschen, die nicht mehr gebraucht werden:

```
git branch -D <test-branch>
git push origin --delete <test-branch>
```

## Beispiel: Step 1 nach main (2026-05-22)

- Branch: `refactor/page-nav-step1` von main.
- 14 Files aus staging gezogen, 3 Files auf main-Reihe gebumped.
- Version: `7.35.52` -> `7.35.53`.
- CHANGELOG: `v7.35.53 - More robust page navigation and reload handling`.
- Commit: `d562a93b` (Squash der 7 Cluster A-G).
- PR #1727 -> rebase-merge -> `a42d330d` auf main.
- Reverted Experimente C+ und D' wandern **nicht** mit (heben sich auf staging eh auf).
- Refactor-Linie reseted auf neues main, naechster Bump ist `7.35.54`.