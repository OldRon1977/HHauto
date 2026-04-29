---
last-verified: 2026-04-23
---

# Vision: HHauto v7.36.0 Architektur-Refactor

## Warum

Die aktuelle Architektur leidet unter drei strukturellen Problemen, die jeden neuen Bug und jedes neue Feature teurer machen.

### Problem 1 — Verstreuter State (192 Storage-Keys)

131 Setting-Keys (SK) + 61 Temp-Keys (TK) in [src/config/StorageKeys.ts](../../src/config/StorageKeys.ts). Jeder Handler liest/schreibt direkt via `getStoredValue()`. Nicht typisiert. Drift zwischen `StorageKeys.ts` und `HHStoredVars.ts` führt zu silent no-ops (siehe Memory `project_storage_keys_require_hhstoredvars`). Unmöglich zu überblicken, wer welchen State wann schreibt.

### Problem 2 — Starre Handler-Queue mit primitivem Mutex

34 Handler in [src/Service/AutoLoopActions.ts](../../src/Service/AutoLoopActions.ts) (1040 LoC). `ctx.busy = true` wird an 20 Stellen verstreut gesetzt. Reihenfolge ist hartcodiert. Kein Konzept von „atomarer Kette" — der Handler `Stuff Team` kann theoretisch zwischen Schritten unterbrochen werden, wenn ein anderer Handler aktiv wird. Konfiguration nur durch Code-Änderung.

### Problem 3 — DOM-Fragilität

Jede Spiel-UI-Änderung kann CSS-Selektoren brechen. Issue #1573 brauchte 14 Commits für einen Bug, weil die Architektur keinen zentralen Layer hat, der DOM-Staleness behandelt. Jeder Handler muss das Problem selbst lösen — und tut es meist nicht oder falsch.

---

## Was wir wollen

Drei strukturelle Bausteine, die diese Probleme an der Wurzel fassen:

1. **Declarative Scheduler mit Atomic-Block-Semantik** — Pipeline als Config-Datei, atomare Ketten explizit markiert, zwei Interrupt-Klassen (SOFT/HARD)
2. **Getypter State-Store** — Single Source of Truth, auto-serialisiert, Drift unmöglich
3. **Zentraler DOM-Adapter** — Re-Query-Logik einmal, gilt überall

Plus zwei unterstützende Bausteine:

4. **Erweiterter Event-Bus** — `onAjaxResponse` flächendeckend nutzen, Polling-Last reduzieren
5. **Game-API-Layer** — Getypter Wrapper um `unsafeWindow.*`, Spiel-Updates an einer Stelle abfangen

Detail-Design siehe [01-target-architecture.md](01-target-architecture.md).

---

## Non-Goals

Explizit NICHT Teil dieses Refactors:

- **Browser-Extension** statt Userscript — Tampermonkey bleibt Distributionsweg
- **WebAssembly für BDSM-Sim** — kann später nachgezogen werden, nicht jetzt
- **React/Preact für UI** — bleibt jQuery-basiert
- **Neue User-Features** — keine Funktionalität die der User vorher nicht hatte
- **UI-Redesign** — keine sichtbaren Änderungen am Settings-Menü oder pInfo-Panel
- **Build-Modernisierung** (Vite, ESM) — Webpack bleibt, da funktioniert
- **Test-Framework-Wechsel** — Jest bleibt
- **Multi-Bundle pro Spielvariante** — bleibt EIN .user.js für alle Spiele
- **Game-API-Wechsel** — wir hooken weiter jQuery-AJAX, keine Service-Worker-Lösung

---

## Erfolgskriterien (Refactor-Ende)

Der Refactor gilt als erfolgreich, wenn ALLE folgenden Punkte erfüllt sind:

1. **Functional Inventory komplett abgehakt** — jeder Eintrag in `10-functional-inventory.md` ist als „migriert" oder „bewusst entfernt" markiert (Credo „keine Funktion darf fehlen")
2. **Pipeline-Config in einer Datei** — Reihenfolge, Delays, Atomic-Flags pro Handler editierbar ohne Code-Änderung in Service-Dateien
3. **„Stuff Team" als atomare Kette** — wird strukturell nicht mehr durch andere Handler unterbrochen, nur durch SOFT-Interrupts (Master-Off, Maus-Pause)
4. **State-Store typisiert** — kein direkter `getStoredValue(SK.xxx)`-Call mehr in Modul-Code, nur über typisierten Accessor
5. **DOM-Adapter zentral** — alle DOM-Queries gehen über die zentrale Schicht, #1573-Pattern eingebaut
6. **Cross-Game-Validation** — HH, CH, PH alle drei manuell getestet, kein Regress gegenüber 7.35.10
7. **Versionsbump auf 7.36.0** in `app.json` und `package.json` synchron
8. **Alte `architecture.md` durch neue Doku abgelöst** und Komplettheit gegen Inventory verifiziert
9. **`npm run build` grün, `npm test` grün**
10. **User-Migration funktioniert** — Pop-Up-Sequenz erfolgreich, alte Settings werden in Backup-Slot gesichert

---

## Audience: drei Spielvarianten

Drei Spielvarianten parallel zu testen:
- **HH** (Hentai Heroes, hh_hentai) — Haupt-Test-Bed
- **CH** (Comix Harem, hh_comic)
- **PH** (Pornstar Harem)

Mechanik identisch, Design unterscheidet sich, einzelne Bezeichnungen weichen ab (z.B. Trolle haben unterschiedliche Namen). Jeder Refactor-Schritt muss auf allen drei verifiziert werden bevor er als „done" gilt.

---

## Distribution & User-Migration

### Versionsbump
- 7.35.x → 7.36.0
- Major-Bump trotz fehlender User-Features wegen Größe des internen Umbaus

### Pop-Up-Sequenz (via [src/Service/FeaturePopupService.ts](../../src/Service/FeaturePopupService.ts))

**Vor dem Update** (in der letzten 7.35.x Version, ein Release vor dem Refactor):
- Pop-Up: „Mit der nächsten Version (7.36.0) wird die interne Architektur grundlegend umgebaut. Deine Konfiguration wird auf Defaults zurückgesetzt. Plane 2-5 Minuten pro Spiel zum neu Einstellen ein."
- User kann nicht stillschweigend überrascht werden

**Nach dem Update** (beim ersten Start nach 7.36.0):
- Pop-Up: „Update auf 7.36.0 erfolgt. Deine alten Einstellungen wurden in einem Backup-Slot gesichert (für Rollback verfügbar bis Version X.X). Bitte überprüfe deine Settings."
- Anleitung wie auf alte Settings zugegriffen werden kann (für Vergleich beim neu Einstellen)

### Settings-Backup
- Alte Storage-Keys werden vor Migration in Backup-Slot kopiert: `Backup_v7.35_Setting_*`
- Bleiben für mindestens 3 Versionen (bis 7.39.0) verfügbar
- Dann werden sie bei Update entfernt (mit Pop-Up-Hinweis)
