---
last-verified: 2026-05-05
verified-against-version: 7.35.20
status: new
---

# Runtime Architecture

Wie HHAuto im Browser tatsächlich läuft. Diese Datei dokumentiert Stolperfallen die im Code stecken aber nirgends sonst aufgeschrieben sind.

---

## 1. Iframe-Architektur (WICHTIG)

Das Spiel läuft NICHT direkt auf der Top-Domain. Der Browser lädt:

```
https://www.hentaiheroes.com/        <- Top-Window: Wrapper-HTML
  +-- <iframe id="hh_hentai">        <- Game-Window: Hier lebt der Spielzustand
        +-- window.shared.Hero       <- Daten
        +-- window.availableGirls    <- Daten
        +-- window.hh_ajax           <- API-Bridge
```

### Iframe-IDs pro Spiel

Aus `src/config/game/*.ts`:

| Spiel | Domain | Iframe-ID |
|-------|--------|-----------|
| HentaiHeroes | hentaiheroes.com / haremheroes.com | `hh_hentai` |
| ComixHarem | comixharem.com | `hh_comix` |
| PornstarHarem | pornstarharem.com | `hh_star` |
| GayPornstarHarem | gaypornstarharem.com | `hh_stargay` |
| TransPornstarHarem | transpornstarharem.com | `hh_startrans` |
| GayHarem | gayharem.com | `hh_gay` |
| AmourAgent | amouragent.com | `hh_amour` |
| MangaRpg | mangarpg.com | `hh_mangarpg` |
| HornyHeroes | hornyheroes.com | `hh_sexy` |

Die Iframe-IDs werden in `HHEnvVariables.ts` als `gameID` registriert.

### Konsequenzen für Skripte

- `unsafeWindow.shared` ist **leer** auf der Top-Window-Ebene
- Standalone-Userscripts brauchen entweder `@noframes` (laufen nur im Top-Window — sehen kein Spiel) oder die Iframe-Erkennung
- `document.getElementById(gameID)` sucht im Top-Window-DOM nach dem Iframe-Element selbst, NICHT im Iframe-Inhalt
- Der Body innerhalb des Iframes trägt `<body page=\"...\" id=\"hh_hentai\">` — das `page`-Attribut wird von `getPage()` ausgelesen

### Wie HHAuto.user.js es macht

Das Hauptskript läuft mit `@match` direkt auf `*.hentaiheroes.com/*` — Tampermonkey/Greasemonkey injiziert in **alle** matchenden Frames, inklusive Iframes. `unsafeWindow` zeigt dann automatisch auf das jeweilige Frame-Window.

### Wie der Debug-Inspector es macht

`HHAuto_debug_inspector.user.js` v3.1.0+ hat `@noframes` — läuft nur im Top-Window — und sucht aktiv nach dem Iframe via bekannte IDs oder per Scan auf `shared`/`Hero`/`availableGirls`. Schaltet dann auf `iframe.contentWindow` um.

---

## 2. unsafeWindow.shared — der eigentliche State

Was die Doku oft als `unsafeWindow.Hero` oder `Hero.energies.x` zeigt, ist tatsächlich:

```javascript
unsafeWindow.shared.Hero.energies.x
```

`HHHelper.getHHVars()` macht das transparent:

```typescript
function prefixIfNeeded(infoSearched) {
    if (!!unsafeWindow.shared && infoSearched.indexOf('Hero.') == 0) {
        infoSearched = 'shared.' + infoSearched;
    }
    return infoSearched;
}
```

Wer direkt auf `unsafeWindow.Hero` zugreift kriegt undefined. Immer `getHHVars()` benutzen.

### Was direkt auf unsafeWindow liegt (nicht in shared)

| Variable | Quelle |
|----------|--------|
| `availableGirls` | Edit-Team-Seite |
| `teams_data` | Battle-Teams-Seite |
| `girlsDataList`, `girls_data_list` | verschiedene Seiten |
| `opponents_list` | League-Seite |
| `daily_goals_list` | Daily-Goals-Seite |
| `girl_squad` | Labyrinth-Seite |
| `pop_list`, `pop_index` | Place-of-Power-Seite |
| `current_tier_number`, `league_tag` | League-Seite |
| `hh_prices` | Booster/Energy-Preise |
| `hh_nutaku` | nur auf Nutaku-Mirrors |
| `has_contests_datas` | Contest-Seite |

### Was unter shared liegt

| Pfad | Inhalt |
|------|--------|
| `shared.Hero` | Hauptobjekt mit allen Player-Stats, Energien, Currencies, Equipment |
| `shared.general.hh_ajax` | Game-eigener AJAX-Wrapper |
| `shared.general.is_cheat_click` | Anti-Cheat-Hook |
| `shared.GirlSalaryManager.girlsMap` | Voll-Daten aller Girls (Map: id_girl -> girl-object) |

---

## 3. AJAX-Wrapper

`getHHAjax()` aus `Utils.ts`:

```typescript
return unsafeWindow.shared?.general?.hh_ajax;
```

Nicht `unsafeWindow.hh_ajax` (existiert nicht). Direktes `fetch()`/`XMLHttpRequest` umgeht Anti-Cheat und Session-Handling und schlägt fehl.

### Nutaku-Session-Injection

Auf `nutaku.*`-Mirrors muss vor jedem AJAX-Call `addNutakuSession()` aufgerufen werden — sonst fehlt das Session-Token und der Server lehnt ab:

```typescript
if (unsafeWindow.hh_nutaku) {
    const hhSession = queryStringGetParam(window.location.search, 'sess');
    // hhSession an params hängen
}
```

Erkennen ob Nutaku: `unsafeWindow.hh_nutaku` ist gesetzt.

### Referer-Manipulation vor AJAX

Vor manchen AJAX-Calls macht der Code:

```typescript
window.history.replaceState(null, '', addNutakuSession('/shop.html'));
```

Kein Bug, kein Workaround — der Server prüft den Referer-Header. Beim Equip-All-Aufruf muss der Referer auf `/girl/<id>?resource=equipment` zeigen, sonst lehnt der Server ab. Nach dem Call wird der Referer zurückgesetzt.

---

## 4. Page-Detection

`getPage()` in `PageHelper.ts`:

```typescript
const ob = document.getElementById(ConfigHelper.getHHScriptVars(\"gameID\"));
const page = ob.getAttribute('page');
```

`gameID` ist die Iframe-ID (z.B. `hh_hentai`). Im Iframe-Document ist das `<body id=\"hh_hentai\" page=\"home\">`. Die Funktion liest also das `page`-Attribut vom Body innerhalb des Iframes.

### Activities-Page-Multiplexing

Mehrere logische Seiten teilen sich URL und Body-Page-Attribut. Sub-Seiten werden via Tab-Parameter unterschieden:

| URL/Tab | Logische Page |
|---------|--------------|
| `?tab=contests` | Contests |
| `?tab=missions` | Missions |
| `?tab=daily_goals` | Daily Goals |
| `?tab=pop` | Place of Power |

`getPage()` resolved das automatisch und liefert den kanonischen Page-Namen.

### Unbekannte Pages

`getPage(checkUnknown=true)` schreibt unbekannte Page-IDs nach `localStorage` unter dem `unkownPagesList`-Key. So werden Game-Updates erkannt die neue Pages einführen.

---

## 5. Race-Conditions beim Start

`StartService.start()` prüft:

```typescript
if (unsafeWindow.shared?.Hero === undefined) {
    heroRetryCount++;
    setTimeout(autoLoop, ...);
    return;
}
```

Das Spiel lädt asynchron. Wenn das Userscript zu früh startet ist `shared.Hero` noch nicht da. Daher der Retry-Loop. Userscripts sollten `@run-at document-idle` setzen UND zusätzlich auf `shared.Hero` warten bevor sie auf Daten zugreifen.

---

## 6. Tampermonkey-Sandbox vs. unsafeWindow

`@grant unsafeWindow` ist Pflicht. Ohne den Grant ist `unsafeWindow === window` (ein Sandbox-Proxy), und die Spielvariablen sind durch die Greasemonkey-Wrapper hindurch teilweise nicht oder nur partiell sichtbar.

Symptome ohne `unsafeWindow`-Grant:
- `unsafeWindow.shared` ist undefined obwohl Daten da sind
- Funktionen wie `hh_ajax` können nicht aufgerufen werden
- Setzen von Werten in Spielvariablen wird ignoriert

---

## 7. localStorage

Liegt **auf der Iframe-Domain**, nicht auf der Top-Domain. Auf `www.hentaiheroes.com` und im `iframe#hh_hentai` (gleiche Origin) ist es derselbe Storage. Auf Nutaku-Mirrors mit Cross-Origin-Iframes könnten zwei separate Storages existieren — der Inspector dumpt darum sicherheitshalber beide.

HHAuto-eigene Keys haben den Präfix `HHStoredVarPrefixKey` (definiert in `config/index.ts`).

---

## 8. Was wo extrahiert werden kann

| Daten | Beste Seite | Variable |
|-------|-------------|----------|
| Voll-Girls (alle 62 Felder, alle besessen) | Edit-Team / Harem | `availableGirls` (Edit-Team) oder `shared.GirlSalaryManager.girlsMap` (überall) |
| Hero-Stats | jede Seite | `shared.Hero` |
| Aktive Blessings | Home (nach Cache-Refresh) oder Live via `hh_ajax({action:'get_girls_blessings'})` | n/a |
| League-Gegner | League-Seite | `opponents_list` |
| Season-Gegner | Season-Seite | `season_opponents` |
| Penta-Drill-Gegner | Penta-Drill-Seite | `penta_opponents` |
| Equipment-Inventar | Edit-Team-Seite (Girl ausgewählt) | DOM `.inventory-slot` Elements |
| Booster-Inventar | Battle-Teams-Seite | im DOM, Top-Bar |
| Markt-Items | Market-Seite | `shop` Variable + DOM |
| Daily-Goals | Daily-Goals-Seite | `daily_goals_list` |
| Tower-of-Fame-Daten | Tower-Seite | `tower_data` |
| Champion-Daten | Champion-Seite | `championData` / `champion_data` |
| Labyrinth-Squad | Labyrinth-Seite | `girl_squad` |
| Place-of-Power | POP-Seite | `pop_list`, `pop_index` |

---

## 9. Cheat-Click-Detection

`shared.general.is_cheat_click` ist ein Hook den das Spiel aufruft um zu prüfen ob ein Click \"echt\" ist (echtes MouseEvent vs. simulated). Das Userscript hat eine auskommentierte Replace-Funktion in `Utils.ts`:

```typescript
// unsafeWindow.is_cheat_click = function(e) { return false; };
// unsafeWindow.shared.general.is_cheat_click = function(e) { return false; };
```

Aktuell deaktiviert. Wenn ein Click trotz korrekter DOM-Ansprache nicht greift, kann das hier liegen.

---

## 10. Checkliste für neue Skripte/Tools

- [ ] `@grant unsafeWindow` setzen
- [ ] Iframe-Awareness: ggf. `iframe.contentWindow` ansprechen oder `@match` so setzen dass das Skript IM Iframe läuft
- [ ] Daten via `getHHVars()` lesen, nicht direkt `unsafeWindow.x.y.z`
- [ ] AJAX via `getHHAjax()`, nicht via `fetch()`
- [ ] Auf Nutaku: `addNutakuSession()` vor jedem AJAX
- [ ] Vor Daten-Zugriff prüfen: `shared.Hero !== undefined`
- [ ] Page-Wechsel via `gotoPage()`, nicht `window.location.href = ...` direkt
