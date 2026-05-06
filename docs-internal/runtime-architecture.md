---
last-verified: 2026-05-06
verified-against-version: 7.35.21
status: current
---

# Runtime Architecture

Wie HHAuto im Browser tatsaechlich laeuft. Diese Datei dokumentiert Stolperfallen die im Code stecken aber nirgends sonst aufgeschrieben sind.

---

## 1. Iframe-Architektur (WICHTIG)

Das Spiel laeuft NICHT direkt auf der Top-Domain. Der Browser laedt:


https://www.hentaiheroes.com/        <- Top-Window: Wrapper-HTML
  +-- <iframe id="hh_hentai">        <- Game-Window: Hier lebt der Spielzustand
        +-- window.shared.Hero       <- Daten
        +-- window.availableGirls    <- Daten
        +-- window.shared.general.hh_ajax  <- API-Bridge


### Iframe-IDs pro Spiel

Aus src/config/game/*.ts (verifiziert):

| Spiel | Hostnames | Iframe-ID |
|-------|-----------|-----------|
| HentaiHeroes | hentaiheroes.com (www/test/thrix/eroges/esprit), nutaku.haremheroes.com | hh_hentai |
| ComixHarem | www.comixharem.com, nutaku.comixharem.com | hh_comix |
| GayHarem | www.gayharem.com, nutaku.gayharem.com, eroges.gayharem.com | hh_gay |
| PornstarHarem | www.pornstarharem.com, nutaku.pornstarharem.com | hh_star |
| GayPornstarHarem | www.gaypornstarharem.com, nutaku.gaypornstarharem.com | hh_stargay |
| TransPornstarHarem | www.transpornstarharem.com, nutaku.transpornstarharem.com | hh_startrans |
| MangaRpg | www.mangarpg.com, nutaku.mangarpg.com | hh_mangarpg |
| AmourAgent | www.amouragent.com | hh_amour |
| HornyHeroes | www.hornyheroes.com (manuell registriert in HHEnvVariables.ts, kein eigenes Game-File) | hh_sexy |

Die Iframe-IDs werden in HHEnvVariables.ts als gameID registriert.

### Konsequenzen fuer Skripte

- unsafeWindow.shared ist **leer** auf der Top-Window-Ebene
- Standalone-Userscripts brauchen entweder @noframes (laufen nur im Top-Window - sehen kein Spiel) oder die Iframe-Erkennung
- document.getElementById(gameID) sucht im Top-Window-DOM nach dem Iframe-Element selbst, NICHT im Iframe-Inhalt
- Der Body innerhalb des Iframes traegt <body page="..." id="hh_hentai"> - das page-Attribut wird von getPage() ausgelesen

### Wie HHAuto.user.js es macht

Das Hauptskript laeuft mit @match direkt auf *.hentaiheroes.com/* (und alle anderen Spiele) - Tampermonkey/Greasemonkey injiziert in **alle** matchenden Frames, inklusive Iframes. unsafeWindow zeigt dann automatisch auf das jeweilige Frame-Window. KEIN @noframes im Header.

Header-Stand v7.35.21 (verifiziert in HHAuto.user.js):


@match http*://*.hentaiheroes.com/*  (+ 9 weitere Domains)
@grant GM_addStyle
@grant GM_registerMenuCommand
@grant GM_unregisterMenuCommand


KEIN @grant unsafeWindow - HHAuto verlaesst sich darauf, dass unsafeWindow auch ohne expliziten Grant nutzbar ist (Tampermonkey-Default). Im generierten Bundle gibt es einen Fallback in der Build-Output-Datei: const w = (typeof unsafeWindow == "undefined") ? window : unsafeWindow; (nur fuer Lokale-i18n).

### Wie der Debug-Inspector es macht

bonus-scripts/HHAuto_debug_inspector.user.js v4.5.0 hat @noframes - laeuft nur im Top-Window - und sucht aktiv nach dem Iframe via bekannte IDs oder per Scan auf shared/Hero/availableGirls. Schaltet dann auf iframe.contentWindow um.

---

## 2. unsafeWindow.shared - der eigentliche State

Was die Doku oft als unsafeWindow.Hero oder Hero.energies.x zeigt, ist tatsaechlich:

javascript
unsafeWindow.shared.Hero.energies.x


HHHelper.getHHVars() macht das transparent:

	ypescript
function prefixIfNeeded(infoSearched) {
    if (!!unsafeWindow.shared && infoSearched.indexOf("Hero.") == 0) {
        infoSearched = "shared." + infoSearched;
    }
    return infoSearched;
}


Wer direkt auf unsafeWindow.Hero zugreift kriegt undefined (auf modernen Builds). Immer getHHVars() benutzen.

### Was direkt auf unsafeWindow liegt (nicht in shared)

| Variable | Quelle |
|----------|--------|
| availableGirls | Edit-Team-Seite |
| teams_data | Battle-Teams-Seite |
| girlsDataList, girls_data_list | verschiedene Seiten |
| opponents_list | League-Seite und PentaDrill-Seite (verschiedene Strukturen) |
| daily_goals_list | Daily-Goals-Seite |
| girl_squad | Labyrinth-Seite |
| pop_list, pop_index | Place-of-Power-Seite |
| current_tier_number | League-Seite |
| hh_prices | Booster/Energy-Preise |
| hh_nutaku | nur auf Nutaku-Mirrors |
| has_contests_datas | Contest-Seite |
| contests_timer | Contest-Seite |
| event_data, current_event | Event-Seite |
| season_sec_untill_event_end | Season-Seite |
| hero_data, opponents | SeasonArena-Seite |
| seasonal_event_active, seasonal_time_remaining, mega_event_active, mega_event_time_remaining | Seasonal-Seite |
| penta_drill_data | PentaDrill-Seite |
| girl, id_girl, player_gems_amount | GirlPage |

### Was unter shared liegt

| Pfad | Inhalt |
|------|--------|
| shared.Hero | Hauptobjekt mit allen Player-Stats, Energien, Currencies, Equipment |
| shared.general.hh_ajax | Game-eigener AJAX-Wrapper |
| shared.general.is_cheat_click | Anti-Cheat-Hook |
| shared.GirlSalaryManager.girlsMap | Voll-Daten aller Girls (Map: id_girl -> girl-object) |
| shared.GirlSalaryManager.girlsListSec | Sekundaere Girl-Liste |
| shared.animations.loadingAnimation.{start,stop} | Loading-Spinner |

---

## 3. AJAX-Wrapper

getHHAjax() aus Utils.ts:

	ypescript
return unsafeWindow.shared?.general?.hh_ajax;


Nicht unsafeWindow.hh_ajax (existiert nicht). Direktes fetch()/XMLHttpRequest umgeht Anti-Cheat und Session-Handling und schlaegt fehl.

Ausnahme: HaremGirl.equipItem() (girl_equipment_equip) verwendet jQuery $.ajax direkt - umgeht damit shared.general.hh_ajax.

### Nutaku-Session-Injection

Auf Nutaku-Mirrors (hh_nutaku-Flag gesetzt) muss vor jedem AJAX-Call/Navigation addNutakuSession() aufgerufen werden - sonst fehlt das Session-Token und der Server lehnt ab:

	ypescript
if (unsafeWindow.hh_nutaku) {
    const hhSession = queryStringGetParam(window.location.search, "sess");
    // hhSession an params haengen
}


Erkennen ob Nutaku: unsafeWindow.hh_nutaku ist gesetzt.

### Referer-Manipulation vor AJAX

Vor manchen AJAX-Calls macht der Code:

	ypescript
window.history.replaceState(null, "", addNutakuSession("/shop.html"));


Kein Bug, kein Workaround - der Server prueft den Referer-Header. Verifiziert verwendet in:

| Modul | Wofuer |
|---|---|
| Helper/HeroHelper.ts (equipBooster) | Referer auf /shop.html fuer market_equip_booster |
| Module/Market.ts (Buy-Loops) | Referer auf /shop.html vor market_buy/market_auto_buy |
| Module/TeamModule.ts (Stuff Team) | Referer auf /characters/<id> bzw. /girl/<id>?resource=equipment |
| Module/harem/Harem.ts (girl_skills_reset) | Referer auf /girl/<id>?resource=skills |
| Module/League.ts | Referer auf leagues-pre-battle oder leaderboard |

Nach dem Call wird der Referer zurueckgesetzt.

---

## 4. Page-Detection

getPage() in PageHelper.ts:

	ypescript
const ob = document.getElementById(ConfigHelper.getHHScriptVars("gameID"));
const page = ob.getAttribute("page");


gameID ist die Iframe-ID (z.B. hh_hentai). Im Iframe-Document ist das <body id="hh_hentai" page="home">. Die Funktion liest also das page-Attribut vom Body innerhalb des Iframes.

### Activities-Page-Multiplexing

Mehrere logische Seiten teilen sich URL und Body-Page-Attribut. Sub-Seiten werden via Tab-Parameter unterschieden:

| URL/Tab | Logische Page |
|---------|--------------|
| ?tab=contests | Contests |
| ?tab=missions | Missions |
| ?tab=daily_goals | Daily Goals |
| ?tab=pop | Place of Power |

getPage() resolved das automatisch und liefert den kanonischen Page-Namen.

### Unbekannte Pages

getPage(checkUnknown=true) schreibt unbekannte Page-IDs nach localStorage unter dem unkownPagesList-Key. So werden Game-Updates erkannt die neue Pages einfuehren.

---

## 5. Race-Conditions beim Start

StartService.start() prueft:

	ypescript
if (unsafeWindow.shared?.Hero === undefined) {
    heroRetryCount++;
    setTimeout(autoLoop, ...);
    return;
}


Das Spiel laedt asynchron. Wenn das Userscript zu frueh startet ist shared.Hero noch nicht da. Daher der Retry-Loop. Userscripts sollten @run-at document-idle setzen UND zusaetzlich auf shared.Hero warten bevor sie auf Daten zugreifen.

---

## 6. Tampermonkey-Sandbox vs. unsafeWindow

HHAuto.user.js verwendet KEIN @grant unsafeWindow. Tampermonkey stellt unsafeWindow im Default-Modus auch ohne expliziten Grant bereit. Im generierten Bundle existiert ein Fallback fuer den i18n-Layer:

	ypescript
const w = (typeof unsafeWindow == "undefined") ? window : unsafeWindow;


Der Rest des Codes verwendet unsafeWindow direkt ohne Fallback - funktioniert also, weil Tampermonkey die Variable im Code-Kontext bereitstellt.

Symptome wenn unsafeWindow doch nicht verfuegbar (z.B. bei einer anderen Userscript-Engine):
- unsafeWindow.shared ist undefined obwohl Daten da sind
- Funktionen wie hh_ajax koennen nicht aufgerufen werden
- Setzen von Werten in Spielvariablen wird ignoriert

---

## 7. localStorage

Liegt **auf der Iframe-Domain**, nicht auf der Top-Domain. Auf www.hentaiheroes.com und im iframe#hh_hentai (gleiche Origin) ist es derselbe Storage. Auf Nutaku-Mirrors mit Cross-Origin-Iframes koennten zwei separate Storages existieren - der Inspector dumpt darum sicherheitshalber beide.

HHAuto-eigene Keys haben den Praefix HHStoredVarPrefixKey (Default: HHAuto_, definiert in config/index.ts).

---

## 8. Was wo extrahiert werden kann

| Daten | Beste Seite | Variable |
|-------|-------------|----------|
| Voll-Girls (alle Felder, alle besessen) | Edit-Team / Harem | availableGirls (Edit-Team) oder shared.GirlSalaryManager.girlsMap (ueberall) |
| Hero-Stats | jede Seite | shared.Hero |
| Aktive Blessings | Home (nach Cache-Refresh) oder Live via hh_ajax({action:"get_girls_blessings"}) | n/a |
| League-Gegner | League-Seite | opponents_list |
| Season-Gegner | Season-Seite | opponents (in hero_data-Kontext) |
| Penta-Drill-Gegner | Penta-Drill-Seite | opponents_list (KKPentaDrillOpponents-Struktur) |
| Equipment-Inventar | Edit-Team-Seite (Girl ausgewaehlt) | DOM .right-section .slot[data-d] |
| Booster-Inventar | Shop-Seite (Inventory-Tab) | DOM #shops div.booster.player-inventory-content .slot |
| Markt-Items | Shop-Seite | DOM #shops div.{armor,booster,gift,potion}.merchant-inventory-item .slot |
| Daily-Goals | Daily-Goals-Tab | daily_goals_list |
| Champion-Daten | Champion-Seite | championData |
| Labyrinth-Squad | Labyrinth-Seite | girl_squad |
| Place-of-Power | POP-Seite | pop_list, pop_index |
| Event-Girls | Event-Seite | event_data.girls |

---

## 9. Cheat-Click-Detection

shared.general.is_cheat_click ist ein Hook den das Spiel aufruft um zu pruefen ob ein Click "echt" ist (echtes MouseEvent vs. simulated). Das Userscript hat eine auskommentierte Replace-Funktion in Utils.ts:

	ypescript
export function replaceCheatClick()
{
    // unsafeWindow.is_cheat_click=function(e) { return false; };
    // unsafeWindow.shared.general.is_cheat_click=function(e) { return false; };
}


Aktuell deaktiviert (Body komplett auskommentiert), wird aber von StartService.start() aufgerufen. Wenn ein Click trotz korrekter DOM-Ansprache nicht greift, kann das hier liegen.

Window-Interface (src/index.ts) deklariert is_cheat_click: any und shared.general.is_cheat_click? als Type-Hints.

---

## 10. Checkliste fuer neue Skripte/Tools

- [ ] Iframe-Awareness: ggf. iframe.contentWindow ansprechen oder @match so setzen dass das Skript IM Iframe laeuft
- [ ] Daten via getHHVars() lesen, nicht direkt unsafeWindow.x.y.z
- [ ] AJAX via getHHAjax(), nicht via fetch()
- [ ] Auf Nutaku: addNutakuSession() vor jedem AJAX/Navigation
- [ ] Vor Daten-Zugriff pruefen: shared.Hero !== undefined
- [ ] Page-Wechsel via gotoPage(), nicht window.location.href = ... direkt
