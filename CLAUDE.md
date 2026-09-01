# Arbeit an HHauto

Kurz gehalten. Was hier steht, hat einmal Zeit gekostet.

## Vor einer Änderung: das zuständige Dokument lesen

Nicht alle — das zuständige. Die Zuordnung:

| Du änderst | Lies vorher |
| --- | --- |
| Scheduler, Blöcke, Slot-Hold, Fokus | `docs/decisions/README.md` und die dort genannte ADR |
| Storage-Keys | `docs-internal/storage-keys.md` |
| Seiten-IDs, Navigation | `src/config/HHEnvVariables.ts`, dann `docs-internal/page-mapping.md` |
| Ausrüstung, Resonanz | `docs-internal/equipment-resonance.md` |
| Teamauswahl, Scoring | `docs-internal/data-sources-team.md` |
| Etwas gegen das laufende Spiel messen | `docs-internal/live-verification-lessons.md` und `scripts/live-check/README.md` |

Die Dateiköpfe im Code tragen die Begründung ihrer Regeln. Ein Vorschlag, der eine
Regel vereinfacht, muss zuerst deren Kopf gelesen haben.

## Was ein Befund ist und was nicht

- **Am Aufrufort messen.** Ein Selektor, der nirgends 0 Treffer liefert, ist erst
  ein Befund, wenn die Seite und der Zustand benannt sind, in dem der Code ihn
  liest. Eine Zählung ohne Kontext ist eine unfertige Messung.
- **Ein Grep-Treffer ist keine Behauptung.** `fromDescriptor` erzeugt Blocknamen
  zur Laufzeit; wer nur nach `name:` sucht, hält vorhandene Blöcke für fehlend.
- **DOM ist nicht JSON.** Das Spiel hat die Liga-Spalte `match_history` im DOM
  umbenannt und im JSON behalten. Wer den DOM-Befund auf die Daten überträgt,
  baut einen stillen Fehler: `numberOfFightAvailable` meldet dann 0 Kämpfe.
- **Gemessen und geschlossen trennen.** In Berichten und Kommentaren gehört
  dazu, welche Aussage aus einer Messung stammt und welche aus einer Ableitung.
- **Keine breite Regex über Quelltext.** Eine Regex, die Requirement-IDs aus
  Kommentaren entfernen sollte, hat zwei Import-Zeilen mitgenommen. Explizite
  Ersetzungen, danach `npx tsc --noEmit`.

## Doku ist Ist-Zustand

Eine Datei beschreibt, wie es heute ist — plus Entscheidungen, warum etwas
**nicht** oder **nicht mehr** gemacht wird, damit derselbe Weg nicht zweimal
gegangen wird. Kein Verlauf, keine Etappen, keine Task-Nummern.

- Keine Kopie einer Liste, die im Code steht. Verweise auf den Code.
- Keine Version, kein Datum als Anker, außer die Version ist Vertrag (eine
  Migration, die genau ein altes Format liest).
- Ein Kommentar, der nur die nächste Zeile nacherzählt, kommt weg.

## Nach einer Änderung: was mitziehen muss

| Geändert | Mitziehen |
| --- | --- |
| Nutzersichtbares Verhalten | `CHANGELOG.md` |
| Neuer oder entfernter Storage-Key | `docs-internal/storage-keys.md` |
| Menü, Debug-Ablauf, Bedienung | das Wiki (`HHauto.wiki`, Seiten `The menu` / `Debugging`) |
| Eine frühere Entscheidung umgekehrt | neue ADR in `docs/decisions`, die die alte benennt; Nummer nie wiederverwenden |
| Gemessene Spielmechanik | das zuständige `docs-internal`-Dokument, mit „gemessen" gekennzeichnet |
| Datei-Kopf `Used by:` / `Depends on:` betroffen | die Zeile, sonst schlägt `npm run check:headers` fehl |

## Tore, die das prüfen

```
npm run typecheck        # blockierend
npm run lint:ci          # blockierend, Warnungs-Ratsche
npm test
npm run deps:circular:check  # Zyklen gegen die eingefrorene Baseline
npm run check:gm-grants  # GM-Grants gegen die tatsächliche Nutzung
npm run check:docs       # storage-keys.md und page-mapping.md gegen den Code
npm run check:headers    # Used by / Depends on gegen die echten Importe
npm run build            # HHAuto.user.js gehört in denselben Commit
```

Die letzten beiden gibt es, weil beides schon auseinandergelaufen ist:
`storage-keys.md` stand einmal neun Keys hinter dem Code, und 17 Dateiköpfe
nannten Module, die die Datei nicht mehr importieren.

## Live gegen das Spiel messen

Eine Sitzung pro Konto — der eigene Browser muss ausgeloggt sein. Die
ausgeloggte Seite liefert einen Platzhalter-Hero mit 600 Kobans, gegen den jede
Messung plausibel aussieht und Müll ist: vor jeder Messung `shared.Hero.infos.id`
prüfen. Schreibende Prüfungen bleiben Handarbeit; ein Prüfer, der kauft oder
speichert, ist ein Bot mit anderem Namen.
