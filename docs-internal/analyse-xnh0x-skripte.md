# Analyse: xnh0x HH-Skripte + HH++ vs. HHAuto - Architektur und Learnings

**Stand:** April 2026
**Analysierte Skripte:**
- HH-League-Tracker (xnh0x, v1.18.3, 117KB) - League-Tracking + GitHub-Sync
- HH-Leagues-Plus-Plus (xnh0x Fork, v0.16.5, 22KB) - League-UI + Direct Battle
- HH-suckless (xnh0x, v0.57.1, 103KB) - Multi-Feature inkl. Labyrinth-Path
- HH-tools (xnh0x, settings.js, 5KB) - Settings-Framework
- HH++ BDSM (zoop0kemon, v1.41.7) - Community-Standard-Erweiterung

---

## 1. Architektur-Vergleich

### HHAuto (unser Skript)
```
TypeScript -> Webpack -> single .user.js
src/Service/     Orchestrierung: AutoLoop, Navigation, Paranoia
src/Module/      Feature-Module: League, Labyrinth, Champion, etc.
src/Helper/      Utilities
src/config/      Konfiguration
src/model/       TypeScript-Interfaces
src/i18n/        Uebersetzungen
```
- Polling-Loop: autoLoop() laeuft periodisch, prueft Timers, ruft Handler in Reihenfolge
- State: localStorage via getStoredValue/setStoredValue mit Prefix-Keys
- Navigation: Zentral ueber PageNavigationService - navigiert zu Seiten, wartet, fuehrt aus
- API-Calls: Indirekt ueber Seitennavigation + DOM-Parsing (kein direkter hh_ajax)
- Fehlerbehandlung: Minimal

### HH++ BDSM (zoop0kemon)
```
JavaScript (ES6) -> Webpack -> single .user.js
src/modules/     Feature-Module (je Ordner: index.js + styles.lazy.scss)
src/common/      Helpers, Constants, Sheet
src/config/      Config-Panel mit Live-Toggle
src/i18n/        Uebersetzungen
src/data/        Statische Daten (Supporters, Relics)
```
- Modul-System: Jedes Feature ist ein CoreModule/STModule mit shouldRun()/run()
- Config: Live-Toggle ohne Reload (updateConfig -> runModule oder tearDown)
- Lazy Styles: SCSS wird nur geladen wenn Modul aktiv (styles.use()/styles.unuse())
- Deferred Execution: Helpers.defer() sammelt Callbacks, fuehrt nach DOM-Ready aus
- AJAX-Interception: onAjaxResponse() via jQuery.ajaxComplete
- Girl Dictionary: Komprimiert in localStorage (gzip + base64)

### xnh0x-Skripte (suckless, League-Tracker, Leagues++)
```
Plain JavaScript -> kein Build -> single .user.js (oder @require)
IIFE mit async/await
Feature-Funktionen (eine pro Seite)
Storage-Klasse (GM_setValue/GM_getValue)
Config via HH++ registerModule()
```
- Event-driven: Kein Polling. MutationObserver + onAjaxResponse + Keyboard
- State: GM_setValue/GM_getValue (ueberlebt Cache-Clearing)
- Navigation: Keine - reagiert nur auf aktuelle Seite
- API-Calls: Direkt ueber hh_ajax + GM.xmlHttpRequest (GitHub)
- Fehlerbehandlung: Graceful Degradation

---

## 2. Wie werden Game-Aktionen ausgeloest?

### HHAuto: Seitennavigation + DOM-Klick
```typescript
gotoPage(ConfigHelper.getHHScriptVars("pagesIDLeague"));
// wartet auf Seitenlade, sucht Button, klickt
```

### xnh0x (Leagues++): Direkter API-Call
```javascript
hh_ajax({
    action: "do_battles_leagues",
    id_opponent: opponent.player.id_fighter,
    number_of_battles: 3
}, function(response) {
    Reward.handlePopup(response.rewards);
    Hero.updates(response.hero_changes);
});
```

### HH++: Kein Kampf-Ausloesung (nur UI-Erweiterung)

**Learning:** Direkte API-Calls sind 10x schneller als Seitennavigation.

---

## 3. DOM-Reaktivitaet

### HHAuto: Timer-basiertes Polling
```typescript
if ($('.some-element').length > 0) { ... }
```

### HH++: doWhenSelectorAvailable (MutationObserver)
```javascript
static doWhenSelectorAvailable(selector, callback) {
    if ($(selector).length) { callback(); }
    else {
        const observer = new MutationObserver(() => {
            if ($(selector).length) { observer.disconnect(); callback(); }
        });
        observer.observe(document.documentElement, {childList: true, subtree: true});
    }
}
```

### xnh0x: doASAP (erweitert mit Condition)
```javascript
function doASAP(callback, selector, condition = (jQ) => jQ.length) {
    const $selected = $(selector);
    if (condition($selected)) { callback($selected); }
    else {
        const observer = new MutationObserver(() => {
            const $selected = $(selector);
            if (condition($selected)) { observer.disconnect(); callback($selected); }
        });
        observer.observe(document.documentElement, {childList: true, subtree: true});
    }
}
```

**Learning:** doASAP mit Condition ist flexibler. Beispiel: warte bis 4 Gegner da sind.

---

## 4. AJAX-Interception (HH++ Standard)

```javascript
static onAjaxResponse(pattern, callback) {
    $(document).ajaxComplete((evt, xhr, opt) => {
        if (opt && opt.data && opt.data.search && ~opt.data.search(pattern)) {
            const responseData = JSON.parse(xhr.responseText);
            if (responseData && responseData.success) {
                return callback(responseData, opt, xhr, evt);
            }
        }
    });
}
```

HHAuto hat das nicht. jQuery.ajaxComplete ist der Schluessel.

---

## 5. Storage-Strategien

| Aspekt | HHAuto | HH++ | xnh0x suckless | xnh0x League-Tracker |
|---|---|---|---|---|
| Backend | localStorage | localStorage | GM_setValue | localStorage + GitHub |
| Keys | String-Prefix | Typisierte lsKeys | Klasse mit Defaults | Feste Keys |
| Typen | Alles Strings | JSON.parse/stringify | Native Typen | JSON |
| Kompression | Nein | Ja (gzip+b64) | Nein | Nein |
| Cross-Device | Nein | Nein | Nein | Ja (GitHub) |
| Cache-sicher | Nein | Nein | Ja (GM_*) | Teilweise |

---

## 6. Labyrinth-Pathfinding

### xnh0x (suckless) - Dynamic Programming O(n):
- Rueckwaerts vom Boss: besten naechsten Schritt pro Hex berechnen
- 4 Strategien waehlbar (XP, Coins, Kisses, Fists)
- Datenquelle: labyrinth_grid (Game-Variable, kein DOM)
- Reaktiv: MutationObserver bei Bewegung

### HHAuto - Brute-Force DFS O(2^n):
- Alle Pfade generieren, filtern, sortieren
- 1 Strategie (leichtester mit Treasure)
- Datenquelle: DOM-Parsing
- Einmalig beim Laden

Der xnh0x-Algorithmus ist in jeder Hinsicht ueberlegen.

---

## 7. Prevent Throttling (xnh0x)

```javascript
function preventThrottling() {
    const context = new window.AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(20, context.currentTime);
    gain.gain.setValueAtTime(0.001, context.currentTime);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
}
```

Browser throttlen Tabs ohne Media-Playback. Fuer HHAuto im Hintergrund relevant.

---

## 8. HH++ Modul-System (Community-Standard)

```javascript
class ExampleModule extends CoreModule {
    constructor() {
        super({ baseKey: MODULE_KEY, label: '...', default: true, subSettings: [...] });
    }
    shouldRun() { return Helpers.isCurrentPage('leagues.html'); }
    run(subSettings) {
        if (this.hasRun || !this.shouldRun()) return;
        styles.use();
        Helpers.defer(() => { /* ... */ });
        this.hasRun = true;
    }
}
```

Alle xnh0x-Skripte registrieren sich bei HH++. HHAuto ist inkompatibel.

---

## 9. Adaptions-Prioritaeten

| Prio | Feature | Quelle | Aufwand | Impact |
|---|---|---|---|---|
| 1 | Labyrinth-Path via DP + Strategien | suckless | Mittel | Hoch |
| 1 | Direct Battle API (hh_ajax) | Leagues++ | Niedrig | Hoch |
| 1 | Prevent Throttling (AudioContext) | suckless | Niedrig | Hoch |
| 1 | onAjaxResponse Pattern | HH++ | Niedrig | Hoch |
| 2 | Booster-Timer-Logik (League) | League-Tracker | Niedrig | Mittel |
| 2 | Season Best-Pick mit Threshold | suckless | Niedrig | Mittel |
| 2 | serverNow() Pattern | suckless | Niedrig | Mittel |
| 2 | doASAP statt Polling | suckless/HH++ | Mittel | Mittel |
| 3 | Stat-Change-Detection | League-Tracker | Niedrig | Mittel |
| 3 | GitHub-Sync fuer Config | League-Tracker | Hoch | Niedrig |
| 3 | GM_setValue statt localStorage | suckless | Mittel | Niedrig |
| 3 | HH++ Config-Integration | HH++ | Hoch | Niedrig |

---

## 10. Offene Punkte

- [ ] Labyrinth-Path: xnh0x DP-Algorithmus in TypeScript portieren
- [ ] Direct Battle API: Welche Aktionen via hh_ajax?
- [ ] Prevent Throttling: AudioContext in HHAuto
- [ ] onAjaxResponse: Als Utility einbauen
- [ ] Season Best-Pick: Threshold-Logik
- [ ] Booster-Timer: Warte-Logik in League
- [ ] HH++ Kompatibilitaet pruefen
