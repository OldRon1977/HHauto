# Session-Handoff Test-Strategie HHAuto

Stand: 2026-05-07. Vorherige Session hat Test-Bestand analysiert,
Gremium-Review durchgefuehrt, Plan erstellt. Plan-Datei liegt unter
`docs-internal/test-strategy.md` und ist die Source-of-Truth.

## Prompt fuer neue Session (kopieren und einfuegen)

```
Wir setzen die HHAuto-Test-Strategie um. Vorarbeit aus Vorgaenger-Session ist
abgeschlossen, Plan liegt unter `docs-internal/test-strategy.md`.

== Sprache und Stil ==
Deutsch, knackig, keine Floskeln. Antwort direkt und sachlich.
Workspace-Rules gelten (Git-Identitaet oldron1977@gmail.com, Workflow,
Anonymitaet, Datei-Schreiben NUR via Python+UTF8 -- siehe Workspace-Rule
05_File_Write_Workaround).

== Pfad ==
c:\Users\StephanMesser\.kiro\Arbeitsplatz\HHAuto

== Erste Aktion ==
1. Lies `docs-internal/test-strategy.md`. Status-Block oben sagt, wo wir stehen.
2. Pruefe ob die offenen Fragen A, B, C im Abschnitt "Offene Fragen" beantwortet
   sind. Falls Felder leer: vom User Antworten einholen, Plan-Datei aktualisieren,
   dann erst Stufe 0 starten.
3. Wenn alle Fragen beantwortet: weiter mit erster nicht-abgehakter Task.

== Ausstehende Antworten (User muss beantworten falls noch offen) ==

A) xit-Tests inventarisieren? Aufwand 5min, kein Code-Change.
   Antwort: "Inventarisiere" oder "Skip"

B) fdescribe-versteckte Tests in Champion.spec.ts inventarisieren?
   Aufwand 2min, kein Code-Change.
   Antwort: "Inventarisiere" oder "Skip"

C) Subjektive Findings 3, 4, 5 -- jeweils:
   - C-3 Pachinko String-Mapping-Tests: a streichen / b behalten / c spaeter
   - C-4 Pipeline.config Konfigwert-Asserts: a Werte raus + Schema bleibt /
         b komplett behalten / c spaeter
   - C-5 League jest.spyOn auf statische Methoden: a streichen /
         b behalten bis Stufe 1 ersetzt sie / c sofort umschreiben

   Default-Empfehlung des Gremiums: C-3a, C-4a, C-5b.

== Workflow pro Task ==
1. Branch anlegen (`chore/test-hygiene`, `refactor/pure-functions-<modul>`,
   `feat/test-fixtures-<modul>` etc.)
2. Implementieren
3. `npm test` und ggf. `npm run build` lokal ausfuehren
4. Commit (ohne KI-Erwaehnung, ohne Co-Authored-By)
5. Push
6. Auf User-Freigabe warten
7. PR erstellen, mergen via `gh pr merge --rebase --delete-branch`
8. In `docs-internal/test-strategy.md` Checkbox abhaken,
   Status-Block aktualisieren, Aenderungs-Log ergaenzen

== Wichtig ==
- KEINE Tests automatisch hinzufuegen ohne Plan-Bezug.
- Bei jedem Finding den Beleg liefern (Datei + Zeile), bevor gepatcht wird.
- Bei Unsicherheit: Frage stellen, nicht raten.
- Plan-Datei ist single source of truth. Status dort aktualisieren.

== Datenlage ==
- `INPUT/hhauto_dump_*.json` (41 MB, 5.5.2026, 30 Pages)
- `INPUT/HH_DebugLog_*.log` (3 Files, 0,4 Tage alt)
- Inspector-Skript falls neuer Dump noetig:
  `bonus-scripts/HHAuto_debug_inspector.user.js` v4.5.0
```

## Was diese Session geleistet hat

- Test-Bestand analysiert: 39 Specs, 556 Tests, Coverage 30/17/24%.
- Gremium-Review mit 6 Sub-Agenten (3 Pro / 3 Contra).
- Roadmap mit 5 Stufen (0-4) erarbeitet, geblockt: Snapshots, Stryker,
  fast-check als Phase, Coverage-Gate, voller Dump-Split.
- 8 Findings mit Belegen dokumentiert (Champion.spec.ts fdescribe als
  schwerwiegendster).
- Plan-Datei `docs-internal/test-strategy.md` erstellt mit Tasks,
  Checkboxen, offenen Fragen, xit-Inventar-Tabelle, fdescribe-Inventar-Tabelle.

## Offen vor Stufe-0-Start

1. Frage A: xit inventarisieren ja/nein
2. Frage B: fdescribe-versteckte Tests inventarisieren ja/nein
3. Frage C: 3 Sub-Entscheidungen zu Pachinko / Pipeline.config / League

Erst nach Beantwortung kann Stufe 0 starten.