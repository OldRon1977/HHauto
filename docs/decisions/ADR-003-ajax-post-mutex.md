# ADR-003: Globaler Mutex auf state-changing /ajax.php-POSTs

## Status

Proposed

## Datum

2026-05-20

## Kontext

Issue #1598 beschreibt 403 Forbidden auf Place of Power und anderen Modulen, vor allem auf Konten mit grossen Rostern (Reporter Franck-75, 2400+ girls). Vier Fix-Iterationen sind bereits in main gemerged (v7.35.22, v7.35.29, v7.35.30, v7.35.35), die 403-Rate sinkt schrittweise, der Bug ist aber nicht weg. Drei eigene Fix-Versuche (v7.35.48, v7.35.49 lokal) sind durch Sniffer-Daten widerlegt worden.

Die volle Diagnose liegt in `docs-internal/REVIEW_issue_1598_pop_forbidden.md`. Kurzfassung:

- Server-side Bot-Detection bestraft mehrere ueberlappende state-changing POSTs auf `/ajax.php`.
- Auf kleinen Konten dauert ein POST <1s; AutoLoop-Tick (~1s) holt selten zwei in eine Verarbeitung.
- Auf 2400-girls-Konto dauert ein POST 5-7s; AutoLoop-Tick laeuft mehrfach durch, mehrere Handler feuern parallele POSTs (Capture: drei Stueck `closeHomeAds`-POSTs in 1.1s).
- Server antwortet auf alle parallelen POSTs mit 403; Skript bekommt das nicht aktiv mit, feuert weiter Requests in einen rate-limit-gehaltenen Server.
- User reproduziert den 403 manuell durch Doppelclick (Home, dann Home waehrend Page-Load).

Bestehende Schutzmechanismen sind nicht ausreichend:

| Mechanismus | Was er macht | Was er nicht macht |
|---|---|---|
| `navInFlight` (PageNavigationService.ts) | Schuetzt vor zweiter Page-Navigation im selben Tick | Schuetzt nicht vor `/ajax.php`-POSTs |
| `waitForAjaxIdle` (AjaxTracker.ts) | Wartet bis kein XHR mehr pending | Wartet nicht, bis Server-Verarbeitung server-seitig fertig (HTTP-loadend kommt frueher als DB-Write) |
| Forbidden-Backoff (StartService.ts) | Reagiert auf `<body>Forbidden</body>` Page | Reagiert nicht auf `403`-Status auf XHR-Antworten |

Sechs+ Code-Pfade triggern state-changing POSTs ohne globale Koordination:

- `closeHomeAds` (handlePageSpecific)
- `pop_thumb_claim`, `pop_action`, `pop_auto_assign` (PlaceOfPower)
- `troll_battle`, `season_battle`, `pantheon_worship`, `penta_drill_battle`
- `champion_reorder`, `champion_team_build`, BossBang
- `boost_equip`, `harem_pay`

Eine Punkt-Loesung pro Modul (z.B. nur PoP-Pause) deckt das Pattern nicht ab. Die naechste Forbidden-Welle traefe einen anderen Pfad.

## Entscheidung

Ein globaler Mutex auf state-changing `/ajax.php`-POSTs in `Service/AjaxTracker.ts`, plus drei begleitende Aenderungen.

### Komponenten

1. **Mutex-API in AjaxTracker:**
   ```ts
   acquirePostMutex(): boolean    // true wenn frei, false wenn schon held
   releasePostMutex(): void
   isPostInFlight(): boolean
   ```
   Stale-Lock-Release nach 30s, falls ein Holder die Release-Funktion vergessen hat.

2. **AjaxTracker-Hook erkennt POSTs zu `/ajax.php`** und ruft Mutex automatisch an `send` und `loadend`. Damit werden auch Spiel-eigene Game-XHRs (die das Skript nicht selbst feuert) als "in-flight" registriert -- aber sie werden nicht geblockt. Geblockt werden nur Skript-Aufrufe, die explizit `acquirePostMutex` vor ihrem trigger aufrufen.

3. **Helper `awaitServerSettleAfterPost(claimXhrDurationMs)`** in einer neuen Service-Datei. Pause = `max(2000, claimXhrDurationMs * 4)`. Empirisch aus Frank-Capture: claim-XHR 6.7s -> Settle 27s. Auf kleinen Konten 0.3s -> 2s Mindest-Cap.

4. **AutoLoop-Tick-Mutex** am Anfang von `autoLoop()`: wenn `isPostInFlight() === true`, naechster Tick statt Action-Handler-Durchlauf. Verhindert Burst von 3-4 Handlern in einer Tick-Verarbeitung.

5. **XHR-403-Detection im AjaxTracker:** wenn `loadend` mit Status 403, sofort `ForbiddenBackoff.recordForbidden()` und Master-Switch in `Backoff`-Mode. Verhindert, dass das Skript in einen brennenden Server weiter Requests pumpt.

### Pflicht-Aufrufe in den Modulen

Module, die einen state-changing POST triggern, muessen vor dem Trigger den Mutex erwerben:

```ts
if (!ajaxTracker.acquirePostMutex()) {
    // ein anderer Pfad haelt den Mutex, naechster Tick versucht erneut
    return true; // busy=true, AutoLoop-Tick zaehlt fertig
}
const claimStart = Date.now();
$(button).trigger('click');
await waitForAjaxIdle(15s, 250ms);
const claimDuration = Date.now() - claimStart;
ajaxTracker.releasePostMutex();
await awaitServerSettleAfterPost(claimDuration);
```

Erste Iteration: PlaceOfPower. Zweite Iteration (separater PR): BossBang, Champion, Troll, Booster.

## Verworfene Alternativen

### Alternative 1: Per-Modul-Pause nach POST

Jede `state-changing`-Stelle bekommt einen `await sleep(2000)` vor der naechsten Aktion.

- Pro: minimal-invasiv, einfach zu reviewen.
- Contra: Pause-Wert muss pro Modul gepflegt werden, Drift sicher. Schuetzt nicht vor parallelen POSTs aus zwei verschiedenen Modulen im selben Tick (z.B. PoP-Claim und gleichzeitig closeHomeAds aus handlePageSpecific). Auf 2400-girls-Konto reicht 2s nicht; Capture zeigt 27s noetig.
- Verworfen: Pattern-Fix muss in der Architektur sein, nicht punktuell.

### Alternative 2: Manuelle Tick-Drosselung (autoLoopTimeMili hoch)

`autoLoopTimeMili` von 1000 auf 5000 setzen, kein Code-Change.

- Pro: kein neuer Code. User kann das selbst machen.
- Contra: bremst auf kleinen Konten unnoetig, bremst auf grossen Konten zu wenig (Claim dauert 7s, Tick mit 5s laeuft trotzdem dazwischen). Loest das Problem nicht, schiebt es nur. Mehrere Module pro Tick koennen weiter parallel feuern.
- Verworfen: behandelt Symptom, nicht Ursache.

### Alternative 3: Pause nur in PoP-Modul, keine Architektur

Den Fix in `PlaceOfPower.collectAndUpdate` einbauen, andere Module ignorieren.

- Pro: kleiner Patch, weniger Reviewlast.
- Contra: Capture zeigt: 403 entsteht in `closeHomeAds` schon **vor** PoP-Touch. Die naechste Forbidden-Welle wuerde aus `handleSeason`, `handleTrollBattle` oder `handlePoVCollect` kommen und der Reporter waere zurueck im Loop.
- Verworfen: das Pattern ist universell, der Fix muss universell sein.

### Alternative 4: Komplett auf jQuery's `$.ajax`-Queue umstellen

jQuery hat eine eingebaute Request-Queue. Alle Skript-eigenen XHRs gehen darueber.

- Pro: built-in, keine Eigenentwicklung.
- Contra: Spiel-internes JavaScript verwendet eigene XHRs, die nicht durch jQuery gehen. Die wuerden den Mutex nicht respektieren. Refactoring-Aufwand fuer alle bestehenden XHR-Stellen ist erheblich.
- Verworfen: Aufwand-Nutzen-Verhaeltnis schlecht, deckt zudem Game-eigene XHRs nicht ab.

## Konsequenzen

### Positiv

- Eine einzige Stelle (AjaxTracker) verwaltet POST-Concurrency.
- Funktioniert fuer alle bestehenden und neuen Module ohne weitere Code-Aenderungen.
- Server-Settle-Wait macht das Skript "human-shaped": Pausen nach state-changing Aktionen analog zu User-Klickverhalten.
- 403-Detection auf XHR-Ebene macht das Skript ehrlich-reaktiv. Kein Weiter-Pumpen in einen brennenden Server.

### Negativ / Trade-Offs

- **Performance auf grossen Konten:** PoP-Phase 1 dauert mit Settle-Wait laenger. Bei 5 PoPs und 27s Settle: ~3 Minuten zusaetzlich. Acceptable.
- **Performance auf kleinen Konten:** Mindest-Cap 2s nach jedem POST kostet ~10s pro Phase. Bei 5 PoPs und 2s Settle: ~10s zusaetzlich, kaum merkbar.
- **Architektur-Komplexitaet:** AjaxTracker wird vom passiven Counter zu aktivem Mutex-Manager. Test-Surface waechst.
- **Mutex-Stale-Risiko:** wenn ein Holder vergisst, `releasePostMutex` zu rufen, blockiert Skript fuer 30s. Mitigation: Stale-Lock-Release.

### Skill-Anforderungen

Keine. Erweitert bestehenden TypeScript / JavaScript / Jest-Skill-Set des Repos.

## Verifikation

1. **Unit-Tests** in `spec/Service/AjaxTracker.spec.ts`:
   - Mutex-Akquise/Release roundtrip.
   - Stale-Detection nach 30s.
   - 403-Detection ruft ForbiddenBackoff.
2. **Frank-Account-Capture (Sniffer aktiv):**
   - 0 Forbidden ueber 5+ PoP-Claims in einer Phase.
   - XHR-Sequenz zeigt **keine** Ueberlappung von POST-Starts.
   - Nach Claim erscheinen 25-30s Pausen vor naechster Aktion (Log: `awaitServerSettle`).
3. **Klein-Account-Test (kein 2400-girls-Konto):**
   - Skript-Performance nicht spuerbar verschlechtert.
   - Cap-Pausen <= 2s pro POST.
4. **Andere Module-Pfade:** wenn der erste Branch (PoP) sauber ist, zweiter Branch fuer Champion / BossBang / Troll. Capture nach jedem Branch.

## Risiken

| Risiko | Mitigation |
|---|---|
| Mutex zu aggressiv, blockt legitime Concurrency | Stale-Lock-Release, Logging, schrittweise Module-Migration |
| 27s Settle-Wait fuehlt sich fuer User langsam an | UI-Indikator im Sniffer/Inspector, dass Skript in "Settle" ist |
| Game-internes JavaScript reagiert auf den Mutex (durch geaendertes XHR-Timing) | Game-XHRs werden nicht geblockt, nur registriert |
| Settle-Wait-Faktor (4) zu niedrig | Empirisch in zweitem Capture nachjustieren |
| 403-Detection greift bei normalem User-Pause-Verhalten | Detection nur auf XHR-Status 403, nicht auf Page-Load 403 (vorhandener Pfad) |

## Referenzen

- Issue: https://github.com/OldRon1977/HHauto/issues/1598
- Diagnose-Doku: `docs-internal/REVIEW_issue_1598_pop_forbidden.md`
- Sniffer-Tool: `bonus-scripts/HHAuto_issue_1598_network_sniffer.user.js` (PR #1712, gemerged in main)
- Bestehende verwandte Files:
  - `src/Service/AjaxTracker.ts`
  - `src/Service/PageNavigationService.ts`
  - `src/Service/ForbiddenBackoff.ts`
  - `src/Service/StartService.ts`
  - `src/Module/PlaceOfPower.ts`
