# ADR-001: Keine Barrel-Dateien, direkte Importe

## Status
Accepted

## Datum
2026-05-13

## Kontext

Eine Zyklen-Untersuchung zählte 227 zirkuläre Import-Ketten in `src/`. Fast
jede lief über eine der elf `index.ts`-Barrels (`Helper/index.ts`,
`Module/index.ts`, `Utils/index.ts` …):

```
Helper/BDSMHelper.ts
  -> Helper/ConfigHelper.ts
  -> Utils/index.ts        (Barrel re-exportiert HHPopup, Utils, ...)
  -> Utils/HHPopup.ts
  -> Utils/Utils.ts
  -> Helper/index.ts       (Barrel re-exportiert BDSMHelper)
  -> zurueck zu Helper/BDSMHelper.ts
```

Der Grund ist das `export *`: es zieht jede Nachbardatei in den Importgraphen
jedes Konsumenten, der aus dem Ordner irgendetwas importiert. Damit koppeln
Barrels die gesamte Modulfläche, schwächen Tree-Shaking und verbergen, welche
Datei ein Symbol besitzt.

Zyklen sind in diesem Projekt nicht kosmetisch: wird ein Modul innerhalb eines
Zyklus früh erreicht, bevor `config/HHStoredVars` fertig initialisiert ist,
wirft es einen TDZ-ReferenceError und das ganze Userscript startet nicht
(Lesson `zirkulaerer-import-tdz-crash`).

## Entscheidung

Alle `index.ts`-Barrels unter `src/` löschen, jeden Import auf die Datei
zeigen lassen, die das Symbol deklariert, und die Rückkehr per ESLint
verbieten (`no-restricted-imports`, Gruppe `*/index` plus die Ordnerpfade).
Die Umschreibung hat ein einmaliger ts-morph-Codemod gemacht; er ist nach
getaner Arbeit wieder aus dem Baum geflogen.

## Verworfene Alternativen

**Einseitige Barrel-Hierarchie** (Barrels behalten, aber nur in eine Richtung
importieren): löst die Zyklen nur, solange sich alle an die Richtung halten,
und niemand sieht der Import-Zeile an, ob sie eingehalten ist.

**Nichts tun, Baseline einfrieren:** kein Refactor-Risiko, aber `export *`
bleibt zwischen Tree-Shaking und Lesbarkeit stehen, und `LanguageHelper.ts`
hinge weiter an der Export-Reihenfolge von `i18n/index.ts`, damit die
Übersetzungstabellen per Seiteneffekt gefüllt werden.

## Konsequenzen

- Jede Import-Zeile nennt die Datei, die das Symbol deklariert.
- `LanguageHelper.ts` lädt seine Sprachdateien explizit; die Ladereihenfolge
  ist ablesbar statt Konvention.
- Die ESLint-Regel verhindert neue Barrels, auch in neuen Ordnern.
- Die von madge gemeldete Zyklenzahl **stieg** dabei von 227 auf 544. Das ist
  keine Verschlechterung: dieselben Kanten existierten vorher, die Barrels
  fassten nur viele Pfade zu wenigen Ketten zusammen. Der eigentliche Abbau
  ist ADR-008.

## Referenzen

- ADR-008 (Zyklen-Abbau mit Baseline)
- `eslint.config.mjs` (`no-restricted-imports`)
