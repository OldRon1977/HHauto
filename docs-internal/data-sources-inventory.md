---
last-verified: 2026-09-11
verified-against-version: 8.13.1
status: current
---

# HHAuto - Data Sources Inventory

Vollstaendige Inventarisierung aller Datenquellen, auf die das HHAuto-Skript zugreift.
Quelle: systematischer grep durch alle TypeScript-Dateien unter `src/`.

Seit 2026-08-17 gibt es zwei Werkzeuge, die diese Datei gegen das laufende Spiel
pruefen, statt sie nur aus dem eigenen Quelltext abzuleiten:

- `scripts/catalogue/` -- `bundle` liest den Spiel-Quelltext ohne Login
  (Aktionsnamen, `shared.*`-API, `hh_*`-Globals), `observe` zeichnet echten
  AJAX-Verkehr als Form auf, `snapshot` greift die Globals der offenen Seite ab.
- `scripts/live-check/` -- prueft die Selektoren und API-Parameter, auf die sich
  der Code verlaesst, gegen die echte Seite.

Was hier steht, ist damit belegbar. Was noch nie live gemessen wurde, sollte auch
so gekennzeichnet sein.

**Nachgeprueft 2026-09-11** (8.13.1, Pruefkonto Level 115, 24 Maedchen, im
Club): auf 39 Seiten wurde jedes Global dieser Datei auf Existenz und Typ
gelesen (keine Werte) und jeder statische Selektor gezaehlt, ohne HHauto. Das
Ergebnis je Seite steht in Abschnitt 10. Wo eine Zeile davon abweicht, steht
es in der Zeile; "gemessen" meint diese Probe.

> Konventionen
>
> - "Datei" wird ohne `src/`-Praefix angegeben.
> - "Page-ID" entspricht den Konstanten aus `ConfigHelper.getHHScriptVars("pagesIDXxx")` bzw. dem `<body page="...">`-Attribut.
> - "Verfuegbar auf" ist - wenn nicht im Source eindeutig nachweisbar - mit *unklar* gekennzeichnet (Tag `(?)`).
> - localStorage/sessionStorage Keys sind mit dem Default-Praefix `HHAuto_` versehen (siehe `HHStoredVarPrefixKey`).
> - Code-Referenzen nennen Datei + Symbol/Funktion (statt Zeilennummern), um Doku-Drift bei Refactorings zu vermeiden.

## 1. unsafeWindow-Globals (direkter Zugriff)

Direkte `unsafeWindow.XXX`-Zugriffe (ohne `getHHVars`-Wrapper). Reads & Writes.
Siehe auch `src/index.ts` fuer die `Window`-Interface-Erweiterung, die alle hier genutzten Properties typed.

| Variablen-Pfad | Datentyp | Verfuegbar auf | Datei | Symbol/Funktion | Zweck |
|---|---|---|---|---|---|
| `unsafeWindow.shared` | Objekt (root container) | jede Page nach Game-JS-Load | `Helper/HHHelper.ts` | `prefixIfNeeded` | Existenz-Check fuer `prefixIfNeeded()` (legt fest, ob `Hero.x` zu `shared.Hero.x` umgeschrieben wird) |
| `unsafeWindow.shared.Hero` | Objekt (Hero-Daten) | jede Page nach Game-JS-Load | `Helper/HeroHelper.ts`, `Service/StartService.ts` | `getHero()`, `start()` | Existenz-Check + Retry-Loop; `getHero()` liefert dieses Objekt |
| `unsafeWindow.shared.general.hh_ajax` | Function `(params, onSuccess, onError) => void` | jede Page nach Game-JS-Load | `Utils/Utils.ts` | `getHHAjax()` | Bruecke zur internen AJAX-Funktion des Spiels |
| `unsafeWindow.shared.general.is_cheat_click` | Function (Cheat-Detector) | jede Page nach Game-JS-Load | `Utils/Utils.ts` | `replaceCheatClick()` (auskommentiert) | Vorbereitete Override-Stelle - aktuell deaktiviert (siehe Sektion 12) |
| `unsafeWindow.shared.animations.loadingAnimation.start` | Function | jede Seite (gemessen); gelesen auf der Shop-Page | `Module/Shop.ts` | `appendMenuSell()` | Save/Replace/Restore: Loading-Animation waehrend Bulk-Sell-Aktion unterdruecken |
| `unsafeWindow.shared.animations.loadingAnimation.stop` | Function | Shop-Page | `Module/Shop.ts` | `appendMenuSell()` | Save/Replace/Restore (analog) |
| `unsafeWindow.is_cheat_click` | Function (Cheat-Detector) | auf keiner der 39 Seiten vorhanden (gemessen) | `Utils/Utils.ts` | `replaceCheatClick()` (auskommentiert) | Veraltete Override-Stelle |
| `unsafeWindow.hh_nutaku` | Boolean/Truthy | NHH/NPH Nutaku-Build; auf www.hentaiheroes.com auf jeder Seite `null` (gemessen) | `Service/PageNavigationService.ts`, `Service/StartService.ts` | `addNutakuSession()`, `start()` | Nutaku-Spezialfall: Session-Token via `?sess=` injizieren; postMessage("ImAlive") an parent |
| `unsafeWindow.hh_prices` | Objekt (Preis-Map z.B. `fight_cost_per_minute`) | jede Seite (gemessen, 39 von 39) | `Module/Troll.ts` | `Troll.canBuyFight()`, `Troll.canBuyFightLoveRaid()` | Berechnung von `pricePerFight` fuer Auto-Buy von Combats |
| `unsafeWindow.has_contests_datas` | -- | **auf keiner Seite vorhanden** (gemessen, auch nicht auf `?tab=contests`) | `Service/Pipeline.config.ts` | Vorbedingung "Time to get contest rewards." | Eine von drei Oder-Bedingungen neben dem Timer `nextContestCollectTime` und `Contest.getClaimsButton()`; dieser Teil ist heute immer falsch, die beiden anderen tragen |
| `unsafeWindow.contests_timer.next_contest` | Number (sec) | alle Activities-Tabs (gemessen) | `Module/Contest.ts` | `Contest.collectAndSchedule()` | Naechster Contest-Wechsel |
| `unsafeWindow.contests_timer.duration` | Number (sec) | alle Activities-Tabs (gemessen) | `Module/Contest.ts` | `Contest.collectAndSchedule()` | Contest-Dauer |
| `unsafeWindow.contests_timer.remaining_time` | Number (sec) | alle Activities-Tabs (gemessen) | `Module/Contest.ts` | `Contest.collectAndSchedule()` | Restzeit aktueller Contest |
| `unsafeWindow.daily_goals_list` | Array (KKDailyGoal) | alle Activities-Tabs (gemessen, 11 Eintraege) | `Module/DailyGoals.ts` | `DailyGoals.parse()` | Iteration ueber Daily-Goal-Tiers |
| `unsafeWindow.event_data` | Objekt (HHEventData) | Event-Page (`pagesIDEvent`) | `Module/Events/EventModule.ts` | `EventModule.run()`, `displayPrioInDailyMissionGirl()` | Event-Girls und Event-Metadaten |
| `unsafeWindow.event_data.girls` | Array (KKEventGirl) | Event-Page mit Event-Maedchen (gemessen auf `event_533`: 2; auf dem PoA-Tab nicht vorhanden) | `Module/Events/EventModule.ts` | `displayPrioInDailyMissionGirl()` | Liste der Event-Girls fuer Prioritaeten-UI |
| `unsafeWindow.current_event` | Objekt (HHEventData) | Event-Page (Fallback) | `Module/Events/EventModule.ts` | `EventModule.run()` | Fallback wenn `event_data` nicht gesetzt |
| `unsafeWindow.season_sec_untill_event_end` | Number (sec) | `/season.html`; auf `/season-arena.html` nicht vorhanden (gemessen) | `Module/Events/Season.ts` | `Season.getRemainingTime()` | Restzeit Season-Event |
| `unsafeWindow.hero_data` | Objekt | SeasonArena-Page, ausserdem alle Vorkampfseiten und edit-team (gemessen) | `Module/Events/Season.ts` | `Season.parseSeasonOpponents()` | Hero-Block fuer Arena-Reload |
| `unsafeWindow.opponents` | Array | SeasonArena-Page | `Module/Events/Season.ts` | `Season.parseSeasonOpponents()` | Aktuelle Arena-Gegner-Liste |
| `unsafeWindow.seasonal_event_active` | Boolean | auf keiner Seite vorhanden, solange ein Mega-Event laeuft (gemessen); ohne Mega-Event nicht geprueft | `Module/Events/Seasonal.ts` | `Seasonal.isActiveEvent()` | Indikator: Seasonal-Event laeuft |
| `unsafeWindow.seasonal_time_remaining` | Number (sec) | wie `seasonal_event_active`: waehrend eines Mega-Events nirgends vorhanden (gemessen) | `Module/Events/Seasonal.ts` | `Seasonal.isActiveEvent()` | Restzeit Seasonal |
| `unsafeWindow.mega_event_active` | Boolean | jede Seite (gemessen) | `Module/Events/Seasonal.ts` | `Seasonal.isActiveEvent()` | Indikator: Mega-Event laeuft |
| `unsafeWindow.mega_event_time_remaining` | Number (sec) | jede Seite (gemessen) | `Module/Events/Seasonal.ts` | `Seasonal.isActiveEvent()` | Restzeit Mega-Event |
| `unsafeWindow.mega_event_data` (via `getHHVars`) | Objekt; `cards` ist ein **String** (gemessen), der Code liest ihn mit `indexOf('1')` | Seasonal-Page | `Module/Events/Seasonal.ts` | `Seasonal.run()` (`getHHVars(\"mega_event_data.cards\")`) | Owned Mega-Event-Karten |
| `unsafeWindow.current_tier_number` | Number | League-Page | `Module/League.ts` | `League.getLeagueCurrentLevel()` | Aktuelles League-Tier |
| `unsafeWindow.opponents_list` (typed `KKPentaDrillOpponents[]`) | Array | PentaDrill-Page | `Module/PentaDrill.ts` | `PentaDrill.run()` | Penta-Drill-Gegner-Liste |
| `unsafeWindow.penta_drill_data.cycle_data.seconds_until_event_end` | Number (sec) | PentaDrill-Page | `Module/PentaDrill.ts` | `PentaDrill.getRemainingTime()` | Restzeit Penta-Drill-Event |
| `unsafeWindow.girl_squad` | Array (Labyrinth-Squad-Girls mit `remaining_ego_percent`) | Labyrinth-Pre-Battle / Labyrinth-Page | `Module/Labyrinth.ts` | `Labyrinth.chooseOpponent()` | Erkennt verletzte Squad-Girls |
| `unsafeWindow.teams_data` | Objekt, nach Slot-Index geschluesselt (gemessen: 30 Eintraege) | Battle-Teams-Page (`pagesIDBattleTeams`) | `Module/TeamModule.ts` | `TeamModule.getSelectedGirlsId()`, `getSelectedGirls()` | Team-Definitionen (girls_ids, girls) |
| `unsafeWindow.pop_list` | Boolean | alle Activities-Tabs (gemessen: `true` auf der PoP-Liste, `false` auf der Einzelseite) | `Helper/PageHelper.ts` | `getPage()` | Erkennt: sind wir auf der Pop-Listen-Page |
| `unsafeWindow.pop_index` | Number | alle Activities-Tabs, gemessen immer `0`, auch auf der Einzelseite | `Helper/PageHelper.ts` | `getPage()` | Aktuell selektierte Pop-Instanz |
| `unsafeWindow.harem.preselectedGirlId` (nur Kommentar-Hint) | Number | Harem-Page | `Module/harem/Harem.ts` | `fillCurrentGirlItem()` etc. | Im Code via `$('#harem_right .opened').attr('girl')` ersatzweise gelesen, der Kommentar dokumentiert die zugehoerige unsafeWindow-Variable |
| `unsafeWindow.girl` | Objekt (KKHaremGirl) | GirlPage (`pagesIDGirlPage`) | `Module/harem/HaremGirl.ts` | `HaremGirl.getCurrentGirl()` | Aktuell angezeigtes Harem-Girl |
| `unsafeWindow.id_girl` | Number | Questseite `/quest/<id>` (gemessen); auf `/girl/<id>` **nicht** vorhanden, siehe `live-verification-lessons.md` | `Module/harem/HaremGirl.ts` | `HaremGirl` (Affection-Page-Back) | ID des Girls (fuer Navigation zurueck) |
| `unsafeWindow.player_gems_amount` | Map `{element: {amount: number}}` | GirlPage und `/characters.html` (gemessen, 8 Elemente) | `Module/harem/HaremGirl.ts` | `awakGirl()`, `canAwakGirl()`, `canGiftGirl()` | Gem-Bestand pro Element fuer Awakening-Pruefung |
| `unsafeWindow.Hero.currencies.soft_currency` (auskommentiert) | Number | jede Page | `Module/Market.ts` (Kommentar) | - | Veralteter Direktzugriff (heute via `Hero.update`) |
| `unsafeWindow.player_inventory.armor` | Array (Armor-Eintraege) | Market-Page (`pagesIDShop`) | `Module/EquipmentGear.ts` | `fetchInventory()` | Erste Seite des Ruestungs-Inventars; der Rest kommt ueber `market_get_armor`. Gemessen 2026-08-17: 204 Eintraege, 104 mythic / 100 legendary, alle `skin.wearer = "hero"`. Ein Eintrag traegt `id_member_armor` und **kein** `id_member_armor_equipped`. 2026-09-11 auf dem Pruefkonto: 65 Eintraege |
| `unsafeWindow.item_to_upgrade` | Objekt (Armor + `level`) | Mythic-Upgrade-Page (nicht nachgeprueft: die Seite braucht ein Teil als Parameter) | `Module/EquipmentGear.ts` | Upgrade-Schleife | **Falle:** `level` wird beim Seitenaufbau eingefroren und folgt einem Level-Up auf derselben Seite nicht. Das war einer der fuenf Fehler vom August 2026 |
| `unsafeWindow.equipped_armor` | Map `{slot: Armor-Eintrag}` | Market-Page (gemessen: 6 Eintraege) | (noch kein Konsument) | - | Die sechs getragenen Teile. Wird vom Skript heute ueber `#equiped .armor div[id_item]` aus dem DOM gelesen, nicht ueber dieses Global. Ein Eintrag traegt `id_member_armor_equipped` und **keinen** `id_member_armor`-Schluessel -- das Verwechseln der beiden Formen hat im August alle sechs getragenen Teile verworfen |

Zusaetzlich werden in `src/index.ts` (Window-Interface) folgende Properties typed - manche werden aktuell noch nicht ausgelesen, sind aber Teil der Bridge-Vertraege:
`championData`, `Collect`, `HHTimers`, `league_tag`, `server_now_ts`, `love_raids`.

Gemessen 2026-09-11: `Collect`, `HHTimers` und `league_tag` gibt es auf keiner
der 39 Seiten, `server_now_ts` auf jeder, `championData` nur auf
`/club-champion.html` (die Champion-Seite selbst war nicht erreichbar).
`love_raids` ist ein Array auf `/map.html` (24 Eintraege), `/champions-map.html`
und `/season.html`, auf `/love-raids.html` ein **leeres Objekt** und sonst nicht
vorhanden. `LoveRaidManager.parseRaids` laeuft ueber `.length` und liest auf
`/love-raids.html` deshalb 0 Raids.

`server_now_ts` wird ueber `getHHVars('server_now_ts')` (siehe Sektion 2) gelesen, nicht direkt ueber `unsafeWindow`.


## 2. shared-Namespace (Reads via `getHHVars`)

`getHHVars(path)` ruft `prefixIfNeeded(path)` auf: wenn `unsafeWindow.shared` existiert UND der Pfad mit `Hero.` beginnt, wird automatisch `shared.` davorgehaengt.
Daraus folgt: jeder `Hero.x`-Read erreicht effektiv `unsafeWindow.shared.Hero.x`.
Andere Pfade muessen explizit `shared.` angeben.
Zusaetzlich kann `ConfigHelper.getHHScriptVars(path,false)` einen Pfad-Override liefern (selten genutzt).

| Pfad (Input fuer getHHVars) | Effektiv resolved als | Inhalt | Datei | Zweck |
|---|---|---|---|---|
| `Hero.infos.id` | `shared.Hero.infos.id` | Player-ID | `Helper/HeroHelper.ts` | `HeroHelper.getPlayerId()` |
| `Hero.infos.class` | `shared.Hero.infos.class` | Hero-Klasse 1-3 | `Helper/HeroHelper.ts` | `HeroHelper.getClass()` |
| `Hero.infos.level` | `shared.Hero.infos.level` | Level | `Helper/HeroHelper.ts` | `HeroHelper.getLevel()` |
| `Hero.infos.carac1` | `shared.Hero.infos.carac1` | Stat 1 (Hardcore) | `Helper/HeroHelper.ts` | Stat-Upgrade-Berechnung in `doStatUpgrades()` |
| `Hero.infos.carac2` | `shared.Hero.infos.carac2` | Stat 2 (Charm) | `Helper/HeroHelper.ts` | Stat-Upgrade-Berechnung |
| `Hero.infos.carac3` | `shared.Hero.infos.carac3` | Stat 3 (Knowhow) | `Helper/HeroHelper.ts` | Stat-Upgrade-Berechnung |
| `Hero.infos.hc_confirm` | `shared.Hero.infos.hc_confirm` | Hardcore-Bestaetigung an/aus | `Module/Troll.ts` | Verhindert versehentliche Koban-Spends in `Troll.recharge()` |
| `Hero.infos.questing.id_world` | `shared.Hero.infos.questing.id_world` | Aktuelle Welt | `Service/StartService.ts`, `Module/Quest.ts`, `Module/Troll.ts`, `Module/PlaceOfPower.ts`, `Service/ParanoiaService.ts` | Welt-ID fuer Quest/Troll/POP-Logik |
| `Hero.infos.questing.id_quest` | `shared.Hero.infos.questing.id_quest` | Aktuelle Quest | `Module/Quest.ts` | Quest-Fortschritt in `Quest.getMainQuestUrl()` |
| `Hero.infos.questing.current_url` | `shared.Hero.infos.questing.current_url` | URL der aktuellen Quest | `Module/Quest.ts` | Direkt-Navigation zur aktuellen Quest |
| `Hero.infos.questing.choices_adventure` | `shared.Hero.infos.questing.choices_adventure` | 0 = Main, sonst Side | `Service/StartService.ts`, `Module/Troll.ts` | Erkennt Main vs Side Adventure |
| `Hero.currencies.soft_currency` | `shared.Hero.currencies.soft_currency` | Ymens | `Helper/HeroHelper.ts` | `HeroHelper.getMoney()` |
| `Hero.currencies.hard_currency` | `shared.Hero.currencies.hard_currency` | Kobans | `Helper/HeroHelper.ts` | `HeroHelper.getKoban()` |
| `Hero.energies.kiss.amount` | `shared.Hero.energies.kiss.amount` | Aktuelle Kisses | `Module/Events/Season.ts` | Season-Energy in `Season.getEnergy()` |
| `Hero.energies.kiss.max_regen_amount` | `shared.Hero.energies.kiss.max_regen_amount` | Max Kisses | `Module/Events/Season.ts` | Season-Energy-Cap |
| `Hero.energies.kiss.next_refresh_ts` | `shared.Hero.energies.kiss.next_refresh_ts` | Naechster Refresh | `Module/Events/Season.ts`, `Service/AutoLoopActions.ts`, `Service/ParanoiaService.ts` | Timer fuer Energy-Refill |
| `Hero.energies.kiss.seconds_per_point` | `shared.Hero.energies.kiss.seconds_per_point` | Regen-Rate | `Service/ParanoiaService.ts` | Berechnung 'Punkte vor Switch' |
| `Hero.energies.fight.amount` | `shared.Hero.energies.fight.amount` | Aktuelle Combats | `Module/Troll.ts` | Troll-Battles in `Troll.getEnergy()` |
| `Hero.energies.fight.max_regen_amount` | `shared.Hero.energies.fight.max_regen_amount` | Max Combats | `Module/Troll.ts` | Troll-Cap |
| `Hero.energies.fight.next_refresh_ts` | `shared.Hero.energies.fight.next_refresh_ts` | Naechster Combat-Refresh | `Service/ParanoiaService.ts` | Paranoia-Berechnung |
| `Hero.energies.fight.seconds_per_point` | `shared.Hero.energies.fight.seconds_per_point` | Combat-Regen-Rate | `Service/ParanoiaService.ts` | Paranoia-Berechnung |
| `Hero.energies.challenge.amount` | `shared.Hero.energies.challenge.amount` | Aktuelle Challenges (League) | `Module/League.ts` | League-Energy |
| `Hero.energies.challenge.max_regen_amount` | `shared.Hero.energies.challenge.max_regen_amount` | Max Challenges | `Module/League.ts` | League-Cap |
| `Hero.energies.challenge.next_refresh_ts` | `shared.Hero.energies.challenge.next_refresh_ts` | League-Refresh | `Module/League.ts`, `Service/ParanoiaService.ts` | Timer |
| `Hero.energies.challenge.seconds_per_point` | `shared.Hero.energies.challenge.seconds_per_point` | League-Regen | `Service/ParanoiaService.ts` | Paranoia |
| `Hero.energies.quest.amount` | `shared.Hero.energies.quest.amount` | Aktuelle Quest-Energy | `Module/Quest.ts` | Quest-Trigger |
| `Hero.energies.quest.max_regen_amount` | `shared.Hero.energies.quest.max_regen_amount` | Max Quest-Energy | `Module/Quest.ts` | Quest-Cap |
| `Hero.energies.quest.next_refresh_ts` | `shared.Hero.energies.quest.next_refresh_ts` | Quest-Refresh | `Service/ParanoiaService.ts` | Paranoia |
| `Hero.energies.quest.seconds_per_point` | `shared.Hero.energies.quest.seconds_per_point` | Quest-Regen | `Service/ParanoiaService.ts` | Paranoia |
| `Hero.energies.worship.amount` | `shared.Hero.energies.worship.amount` | Aktuelle Worship (Pantheon) | `Module/Pantheon.ts` | Pantheon-Energy |
| `Hero.energies.worship.max_regen_amount` | `shared.Hero.energies.worship.max_regen_amount` | Max Worship | `Module/Pantheon.ts` | Pantheon-Cap |
| `Hero.energies.worship.next_refresh_ts` | `shared.Hero.energies.worship.next_refresh_ts` | Worship-Refresh | `Module/Pantheon.ts`, `Service/AutoLoopActions.ts`, `Service/ParanoiaService.ts` | Timer |
| `Hero.energies.worship.seconds_per_point` | `shared.Hero.energies.worship.seconds_per_point` | Worship-Regen | `Service/ParanoiaService.ts` | Paranoia |
| `Hero.energies.drill.amount` | `shared.Hero.energies.drill.amount` | Drill-Energy (PentaDrill) | `Module/PentaDrill.ts` | PentaDrill |
| `Hero.energies.drill.max_regen_amount` | `shared.Hero.energies.drill.max_regen_amount` | Max Drill | `Module/PentaDrill.ts` | PentaDrill-Cap |
| `Hero.energies.drill.next_refresh_ts` | `shared.Hero.energies.drill.next_refresh_ts` | Drill-Refresh | `Module/PentaDrill.ts`, `Service/AutoLoopActions.ts` | Timer |
| `server_now_ts` | `unsafeWindow.server_now_ts` (kein Hero-Praefix - keine `shared.` Umschreibung) | Server-Zeitstempel (sec) | `Module/Booster.ts` | Booster-Endzeit-Berechnung |
| `championData.team` | `unsafeWindow.championData.team` | Aktuell selektiertes Champ-Team | `Module/Champion.ts` | Champion-Battle-Team-Logik |
| `championData.champion.id` | `unsafeWindow.championData.champion.id` | ID des aktuellen Champions | `Module/Champion.ts` | Team-Save-Slot |
| `championData.champion.poses` | `unsafeWindow.championData.champion.poses` | Erforderliche Posen-Liste | `Module/Champion.ts` | Team-Auswahl |
| `championData.freeDrafts` | `unsafeWindow.championData.freeDrafts` | Free-Reroll-Counter | `Module/Champion.ts` | Champion-Reroll |
| `championData.hero_damage` | `unsafeWindow.championData.hero_damage` | Schaden des Heroes | `Module/Champion.ts` | Champion-Battle-Resultat |
| `championData.fight.active` | `unsafeWindow.championData.fight.active` | Club-Champ-Fight aktiv | `Module/ClubChampion.ts` | ClubChamp-State |
| `championData.fight.participants` | `unsafeWindow.championData.fight.participants` | Liste Club-Champ-Teilnehmer | `Module/ClubChampion.ts` | ClubChamp-Logik |
| `Chat_vars.CLUB_INFO.id_club` | `unsafeWindow.Chat_vars.CLUB_INFO.id_club` | Club-ID des Spielers | `Module/Club.ts` | Club-Status |
| `opponents_list` | `unsafeWindow.opponents_list` | League-Gegner-Liste | `Module/League.ts` | League-Battle |
| `availableGirls` | `unsafeWindow.availableGirls` | Array aller Girls; gemessen nur auf `/edit-team.html` (24) | `Module/TeamModule.ts`, `Module/harem/Harem.ts` | Girl-Daten-Quelle |
| `girlsDataList` | `unsafeWindow.girlsDataList` | Objekt aller Girls, nach id; gemessen auf `/home.html` und `/characters.html` (je 24) | `Module/harem/Harem.ts` | Girl-Daten-Quelle |
| `girls_data_list` | `unsafeWindow.girls_data_list` | Array aller Girls; gemessen auf `/waifu.html` bei HentaiHeroes (24), also nicht nur im PSH-Build | `Module/harem/Harem.ts` | `getWaifuPageGirlsList()`, `moduleHaremCountMax()` |
| `shared.GirlSalaryManager.girlsMap` | `unsafeWindow.shared.GirlSalaryManager.girlsMap` | Live-Girl-Map des Salary-Managers; gemessen auf jeder Seite (24 Eintraege) | `Module/harem/Harem.ts` | Salary-Manager-Bridge |
| `shared.GirlSalaryManager.girlsListSec` | `unsafeWindow.shared.GirlSalaryManager.girlsListSec` | Sekundaere Girl-Liste; gemessen auf jeder Seite (4 Eintraege) | `Module/harem/Harem.ts` | Salary-Manager-Bridge |
| `salary_collect` | `unsafeWindow.salary_collect` | Aufsummierte Salary; gemessen nur auf `/home.html` | `Module/harem/HaremSalary.ts` | Salary-Tag |
| `current_event.event_data.puzzle_pieces` | `unsafeWindow.current_event.event_data.puzzle_pieces` | LivelyScene-Puzzle-Pieces; nicht geprueft (kein Lively-Scene-Event am 2026-09-11) | `Module/Events/LivelyScene.ts` | LivelyScene-Loesung |
| `mega_event_data.cards` | `unsafeWindow.mega_event_data.cards` | Owned Mega-Event-Karten | `Module/Events/Seasonal.ts` | Seasonal-Event-Status |

Hinweis: `getHHVars` liefert bei Nichtexistenz `null` und loggt (auf Wunsch unterdrueckbar via 2. Parameter `logging=false`). Beispiele dafuer im Code: `getHHVars("availableGirls", false)`, `getHHVars("Chat_vars.CLUB_INFO.id_club", false)`, `getHHVars("girlsDataList", false)`, `getHHVars("girls_data_list", false)`.


## 3. AJAX-Actions (Request-seitig)

Alle `action: "..."`-Strings, die der Skript-Code aktiv versendet.
Die meisten Calls laufen ueber `getHHAjax()` (delegiert an `shared.general.hh_ajax`); zwei laufen direkt ueber jQuery `$.ajax` (notiert).

> **Wichtig:** In `Service/AutoLoopActions.ts` werden Strings wie `action: "loveraid"`, `"contest"`, `"mission"`, `"champion"`, `"clubChampion"`, `"seasonal"`, `"bundle"`, `"dailyGoals"`, `"labyrinth"` NICHT als AJAX-Actions versendet, sondern sind interne Handler-Tags fuer `runStandardHandler` (-> `ctx.lastActionPerformed`-Sequenzlogik). Sie werden hier deshalb nicht gelistet.

### 3.1 Calls via `getHHAjax()`

| action-String | Weitere Parameter | Datei | Symbol/Funktion | Wofuer |
|---|---|---|---|---|
| `hero_update_stats` | `carac: "carac1"|"carac2"|"carac3"`, `nb: <mult>` (1/10/30/60) | `Helper/HeroHelper.ts` | `doStatUpgrades()` | Stat-Punkt-Upgrade. Antwort gemessen 2026-09-11 (nb=1): `{success, currency:{soft_currency}, carac<N>, endurance, chance, statsPrices:{prices:{x1,x10,x30,x60}, base_stat, max}}` -- `carac<N>` ist der Gesamtwert mit Boni, `x1` der Preis des **naechsten** Punkts. `shared.Hero.infos.carac<N>` bewegt sich im laufenden Dokument nicht, erst nach dem Neuladen |
| `market_equip_booster` | `id_item: <num>`, `type: "booster"` | `Helper/HeroHelper.ts` | `HeroHelper.equipBooster()` | Booster equippen (normal oder mythic) |
| `champion_team_reorder` | `champion_id`, weitere Team-Felder, `champion_type: "club_champion"|"champion"` | `Module/Champion.ts` | `Champion.setChampionTeam()` | Champion-Team neu setzen |
| `do_battles_leagues` | `opponent_id`, `number_of_battles` | `Module/League.ts` | `League` (Battle-Submit) | League-Battle starten (Mehrfach) |
| `market_buy` | `id_item`, `quantity`, `currency`, `type` (gift/potion/booster) | `Module/Market.ts` | `Market.maintainStack()` | Item kaufen |
| `market_auto_buy` | `id_item`, `quantity`, `type` | `Module/Market.ts` | `Market.maintainStack()` | Auto-Buy (Mass) |
| `girl_equipment_unequip_all_girls` | (kein Body) | `Module/TeamModule.ts` | `TeamModule.assignTopTeam()` | Bei "Stuff Team" alle Girls vor Equip leeren |
| `girl_equipment_equip_all` | `id_team` (selektiert), `id_girl` | `Module/TeamModule.ts` | `TeamModule` (Equip-Loop) | Equipment fuer alle Girls eines Teams |
| `champion_buy_ticket` | `currency: "energy_quest"`, `amount` | `Service/AutoLoopActions.ts` | `handleEnergyChampion()` (innere `buyTicket()`) | Champion-Ticket mit Quest-Energy kaufen |
| `get_girls_blessings` | (kein Body) | `Service/BlessingService.ts` | `BlessingService.fetchAndCache()` | Blessing-Daten anfragen + cachen |
| `arena_reload` | `opponent_id` (chosenID) | `Module/Events/Season.ts` | `Season` (Reroll-Logik) | Season-Arena-Reload (Reroll) |
| `girl_skills_reset` | `id_girl` | `Module/harem/Harem.ts` | `Harem.resetSkillsOnCurrentGirl()` | Skill-Reset eines Girls |
| `edit_team` | `class: "Hero"`, `girls[]` (als Strings), `battle_type`, `id_team` (falls vorhanden) | `Module/TeamModule.ts` | `TeamModule.saveTeamInPlace()` | Team speichern |
| `market_get_armor` | `id_member_armor` (letzte gesehene ID) | `Module/EquipmentGear.ts` | `fetchInventory()` | Naechste Seite des Ruestungs-Inventars; leeres `items` markiert das Ende |
| `market_equip_armor` | `id_member_armor` | `Module/EquipmentGear.ts` | Equip-Schleife | Ruestungsteil auf den Helden legen |
| `team_calculate_caracs` | `girls[]`, `battle_type` | `Service/TeamEvaluationService.ts` | Kandidaten-Ranking | Das Spiel selbst rechnen lassen, statt die Werte nachzubauen |

### 3.2 Calls via jQuery `$.ajax` direkt

| action-String | Weitere Parameter | Datei | Symbol/Funktion | Wofuer |
|---|---|---|---|---|
| `girl_equipment_equip` | `id_girl`, `id_girl_armor`, `sort_by: "rarity"`, `sorting_order: "asc"` | `Module/harem/HaremGirl.ts` | `HaremGirl.equipItem()` | Einzelnes Equipment auf Girl (umgeht `getHHAjax()`-Bridge) |

Hinweis: viele weitere Game-Actions werden vom Spiel selbst gesendet. Diese werden in Sektion 4 ueber `onAjaxResponse`-Hooks abgegriffen -- und in Sektion 3.3 sind sie jetzt gemessen statt geschaetzt.

### 3.3 Vom Spiel gesendet -- gemessen, nicht abgeleitet

Zwei Aufzeichnungen mit `scripts/catalogue/run.mjs observe` am 2026-08-17, zusammen rund 25 Minuten normales Spielen (Pachinko-Lauf, Labyrinth-Zug, Liga-, Season-, PentaDrill- und Troll-Kaempfe):

| Aktion | Klasse | beobachtet | im Spiel-Bundle als Literal | HHauto sendet sie |
|---|---|---|---|---|
| `play` | `Pachinko` | 281x | ja | nein |
| `process_rewards_queue` | - | 14x | ja | nein |
| `do_battles_leagues` | - | 3x | nein | ja |
| `labyrinth_hex_enter` | - | 3x | nein | nein |
| `seasonal_claim` | - | 6x | nein | nein |
| `contest_give_reward` | - | 2x | nein | nein |
| `get_girls_list` | - | 2x | nein | nein |
| `get_girl` | - | 2x | nein | nein |
| `do_battles_seasons` | - | 1x | nein | nein |
| `do_battles_penta_drill` | - | 1x | nein | nein |
| `do_battles_trolls` | - | 1x | nein | nein |
| `do_battles_labyrinth` | - | 1x | nein | nein |
| `labyrinth_pool_select` | - | 1x | nein | nein |
| `labyrinth_get_member_relics` | - | 1x | nein | nein |
| `labyrinth_pick_unclaimed_relic` | - | 1x | nein | nein |
| `adventure_switch` | - | 1x | nein | nein |
| `get_sweep_status` | - | 1x | nein | nein |
| `claim` | `Pachinko` | 1x | nein | nein |
| `claim_all_salaries` | - | 1x | ja | nein |
| `event_market_get_data` | - | 1x | nein | nein |
| `edit_team` | `Hero` | 1x | nein | ja |
| `team_calculate_caracs` | - | 1x | nein | ja |
| `get_girls_blessings` | - | 1x | ja | ja |
| (ohne `action`) | `TeamBattle` | 2x | - | - |

**Die Zahl, auf die es ankommt: 20 der 24 Aktionen stehen nirgends als Literal im Spiel-Bundle.** Das Spiel baut die Namen zur Laufzeit zusammen. Wer Aktionsnamen durch Lesen von Quelltext sucht -- unserem oder dem des Spiels -- findet sie nicht. Dazu gehoeren **alle fuenf** `do_battles_*`-Varianten; `live-verification-lessons.md` hatte zwei davon als Beispiel genannt, die Aufzeichnung belegt die ganze Familie.

Zwei Beobachtungen zur Form:

- **Nicht jeder Aufruf traegt ein `action`.** Der Team-Kampf-Submit identifiziert sich ueber `class: "TeamBattle"` plus `battle_type`, dazu `battles_amount`, `defender_id`, `attacker[team][]` -- und hat gar keinen `action`-Schluessel.
- `claim_all_salaries` nimmt `{action, where}` und antwortet `{money, girls[], upcoming_girl_salaries[{next_pay_in, value}], success}`. Ein Aufruf holt alle Gehaelter. HHauto nutzt ihn nicht.
  `money` ist der **eingesammelte Betrag**, nicht der neue Kontostand -- gemessen
  2026-09-11: Guthaben 838, Knopf 46.986, danach 47.824. Das Spiel rechnet den
  Betrag im Browser auf `Hero.currencies.soft_currency` drauf. Ein veralteter
  Hero-Schnappschuss bleibt damit veraltet, nur verschoben; als frischere
  Geldquelle taugt diese Antwort nicht.

Die vollstaendigen Anfrage- und Antwortformen stehen in `scripts/catalogue/out/observed-actions.md` (nur Schluessel und Typen, keine Werte -- die Ausgabe traegt keine Kontodaten). Zum Auffrischen: `node scripts/catalogue/run.mjs observe --seconds=900` waehrend einer Spielsitzung.

Was hier fehlt, fehlt aus einem Grund: es wurde in diesen 25 Minuten nicht gespielt. Champion, Club-Champion, Pantheon, Path-of-Attraction und die Event-Kaempfe sind noch nicht aufgezeichnet.

**Zweite Aufnahme, 2026-09-11** (8.13.1, Pruefkonto, 20 Minuten HHauto mit
`master=true` und den Einstellungen des Kontos, Mitschnitt im Harness). Elf
Aktionen, Parameter- und Antwortschluessel ohne Werte:

| Aktion | n | Parameter | Antwort |
|---|---|---|---|
| `do_battles_trolls` | 4 | `action, bb_team_index, id_opponent, number_of_battles` | `battle_result, hero_changes, objective_points, result, rewards, rounds, success` |
| `do_battles_seasons` | 4 | `action, bb_team_index, id_opponent, number_of_battles` | wie Troll, `rounds` je Kampf |
| `do_battles_penta_drill` | 1 | `action, id_opponent, number_of_battles` | `battle_result, hero_changes, multi_team_battles_result, result, rewards, team_rounds, success` |
| (ohne `action`) `class: TeamBattle` | 2 | `attacker[team][], battle_type, battles_amount, class, defender_id` | `attacker, battle, defender, end, final, positions, success` |
| `next` | 1 | `action, class, id_quest` | `adventure_name, adventure_type, changes, next_step, progress_to, redirect_to, should_be_registered, success` |
| `start_pop` | 1 | `action, id_place_of_power, selected_girls[]` | `success` |
| `claim_daily_goal_tier_reward` | 1 | `action, tier` | `objective_points, result, rewards, success` |
| `process_rewards_queue` | 12 | `action, get_shop_update, lsk[], product_type` | `rewards, success` |
| `load_payment_methods` | 3 | `action` | `data, success` |
| `show_specific_girl_grade` | 1 | `action, check_only, class, girl_grade, id_girl` | `ava, ico, success` |
| `tutorial_complete` | 3 | `action, tutorial` | `success` |

Neu gegenueber der ersten Aufnahme ist `bb_team_index` an den Troll- und
Season-Kaempfen. Kein `do_battles_leagues`: die Herausforderungsenergie stand
am Anfang und am Ende bei 2. Ueber `getHHAjax()` hat HHauto in diesen 20
Minuten nichts gesendet -- eine Markierung in `getHHAjax` blieb stumm; ob sie
griff, ist nicht gegengeprueft. Die Kaempfe und Sammelaktionen kamen damit von
den Spielseiten selbst, nach Klicks des Skripts.


## 4. AJAX-Response-Interceptors (`onAjaxResponse`)

`onAjaxResponse(pattern, callback)` aus `Utils/Utils.ts` haengt sich global an `\$(document).ajaxComplete`.
Trigger: `opt.data` (Request-Body) matched die uebergebene Regex.
Skip-Bedingungen: kein `xhr.responseText`, oder `responseData.success !== true`.

| Regex | Was wird getan | Wo gespeichert | Datei | Symbol |
|---|---|---|---|---|
| `/(action\|class)/` | Praktisch jede Game-AJAX-Antwort. Parsed `equipped_booster` bei `action='market_equip_booster'` (mit Mythic/Normal-Split anhand id_item-Schwelle 632). Bei Sandalwood-Equip (Identifier `MB1`) wird `usages_remaining` als `TK.sandalwoodMaxUsages` persistiert. Dekrementiert Sandalwood-`usages_remaining` bei `action='do_battles_trolls'` mit Sonderlogik fuer Multibattle (gerade/ungerade Shards entscheiden ob alle Doses verbraucht oder linearer Verbrauch). Filtert ausgelaufene Mythic-Booster. Bei beendetem Sandalwood + aktivem Plus-Event/Mythic/LoveRaid + Multibattle: navigiert zu Shop. Triggert `notifyBattleResponseProcessed()` bei `do_battles_trolls`. | `HHAuto_Temp_boosterStatus` (`{normal:[], mythic:[]}` JSON-stringified), `HHAuto_Temp_sandalwoodMaxUsages` | `Module/Booster.ts` | `Booster.collectBoostersFromAjaxResponses()` |
| `/action=get_girls_blessings/i` | Wartet 200 ms, dann injiziert externen Spreadsheet-Link `<a class="hhauto-spreadsheet-link">` in `#blessings_popup .blessings_wrapper` | DOM-Injection (kein Storage) | `Module/Spreadsheet.ts` | `Spreadsheet.run()` (Listener-Setup auf Home-Page) |
| Beliebig (Tool-Definition) | (Implementation) - gibt Pattern + Callback ans `ajaxComplete`-Hook | - | `Utils/Utils.ts` | `onAjaxResponse()` |

Hinweis: `Booster.collectBoostersFromAjaxResponses()` wird einmalig in `StartService.start()` registriert (`Booster.collectBoostersFromAjaxResponses();`); der Listener bleibt fuer alle nachfolgenden AJAX-Calls aktiv. `Spreadsheet`-Listener wird pro Home-Page-Seite installiert.


## 5. DOM-Quellen mit `data-d`-Attribut (JSON-Inhalt)

`data-d` ist die zentrale Konvention der Spielseite, JSON-Item-Daten direkt am DOM-Knoten zu speichern.
Felder im JSON: `quantity`, `item.{id_item, type, identifier, rarity, price, currency, value, carac1..3, endurance, chance, ego, damage, duration, skin, name, ico, display_price, name_add, subtype, ...}`.

Gemessen 2026-09-11 auf `/shop.html`: Booster, Gifts und Potions des Haendlers
tragen oben `id_item, id_member, index, item, price_buy, price_sell, quantity`,
im `item` u. a. `identifier, rarity, type, value, price, default_market_price`.
**Ruestung ist anders gebaut** (erste Tabellenzeile). Die Selektorzahlen je
Seite stehen in Abschnitt 10.

| jQuery-Selector | Inhalt-Schema (Felder) | Page | Datei | Symbol |
|---|---|---|---|---|
| `#shops div.armor.merchant-inventory-item .slot` | Gemessen 2026-09-11: oben `id_member_armor, id_member, id_item_equip, id_item_skin, index, level, name, price_buy, price_sell, skin, caracs, carac1_equip..carac3_equip, chance_equip, ego_equip, endurance_equip, item`; im `item` `id_equip, id_item_equip, type, rarity, name_add, carac1..3, chance, currency, damage, ego, endurance, name, weight`. **Kein** `quantity`, `identifier` oder `subtype` | Shop (`pagesIDShop`) | `Module/Shop.ts` | `Shop.collectShopFromMarket()` |
| `#shops div.booster.merchant-inventory-item .slot` | `{quantity, item:{id_item, type:"booster", identifier, rarity, value, name, ...}}` | Shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` |
| `#shops div.gift.merchant-inventory-item .slot` | `{quantity, item:{id_item, type:"gift", value, ...}}` | Shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` |
| `#shops div.potion.merchant-inventory-item .slot` | `{quantity, item:{id_item, type:"potion", value, ...}}` | Shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` |
| `#shops div.gift.player-inventory-content .slot` | `{quantity, item:{value, ...}}` | Shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` (HaveAff-Akkumulation) |
| `#shops div.potion.player-inventory-content .slot` | `{quantity, item:{value, ...}}` | Shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` (HaveExp-Akkumulation) |
| `#shops div.booster.player-inventory-content .slot` | `{quantity, item:{id_item, identifier, name, rarity}}` | Shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` (HaveBooster + BoosterIdMap) |
| `#equiped .booster .slot:not(.empty):not(.mythic)` (jQ `.data('d')`) | Normal-Booster-Slot (mit `expiration`) | Shop | `Module/Booster.ts` | `Booster.collectBoostersFromMarket()` |
| `#equiped .booster .slot:not(.empty).mythic` (jQ `.data('d')`) | Mythic-Booster-Slot (mit `usages_remaining`, `lifetime`) | Shop | `Module/Booster.ts` | `Booster.collectBoostersFromMarket()` |

**Gemessen (2026-09-07, laufende Marktseite):** Die Marktseite traegt die Klassen
`slot ... mythic` an **zwei** Element-Familien, die sich nur am Vorfahren
unterscheiden -- getragen unter `#equiped`, besitzt-aber-nicht-getragen unter
`#player-inventory-booster`. Die Nutzlasten sind verschieden:

| | getragen (`#equiped`) | Inventar (`#player-inventory-booster`) |
| --- | --- | --- |
| Schluessel | `id_member_booster_equipped`, `lifetime`, `expiration`, `usages_remaining`, `price_sell` | `price_buy`, `price_sell`, `id_item`, `id_member` |
| Dosenzahl | vorhanden | **fehlt ganz** |

Dieselbe Falle wie bei der Ruestung weiter oben: der Unterschied ist der
`..._equipped`-Schluessel, nicht die Klasse. Ein Inventar-Eintrag in
`boosterStatus` laesst `haveBoosterEquiped()` true sagen fuer einen Booster, der
nicht anliegt, und die fehlende Dosenzahl ist weder eine Zahl noch `null` --
`<= 0` greift dann nie (Issue #1874). `collectBoostersFromMarket()` filtert
seit 8.12.3 auf `id_member_booster_equipped`.

Die volle Dosenzahl steht als `item.default_usages` in derselben Nutzlast
(gemessen: MB1 11, MB2 100, MB5 100). Das Spiel selbst faellt darauf zurueck,
wenn `usages_remaining` fehlt oder 0 ist -- in `shared.js`:
`t.usages_remaining&&t.usages_remaining>0?t.usages_remaining:t.item.default_usages`.

| `#player-inventory.armor .slot:not(.empty)[data-d*='"rarity":"mythic"']` (Selector-Inhalts-Match) | Filter ueber Substring-Match in `data-d` | Shop | `Module/Shop.ts` | `Shop.moduleShopActions()` |
| `[data-d*='"name_add":<X>']` (dyn. Filter) | Filter nach Stat. Gemessen 2026-09-11 in `#player-inventory.armor` (65 Teile): `name_add` steht als Zahl ohne Anfuehrungszeichen (`"name_add":16`); `buildSlotFilter` sucht `"name_add":"<X>"` und trifft damit nichts, der Verkaufs-Loop ohne Anfuehrungszeichen trifft | Shop | `Module/Shop.ts` | `Shop.moduleShopActions()` / `setSlotFilter()` |
| `[data-d*='"subtype":<X>']` (dyn. Filter) | Filter nach Item-Subtyp. Gemessen 2026-09-11: `subtype` steht nur in `skin` und als Zahl (`"subtype":6`); `buildSlotFilter` sucht `"subtype":"<X>"` und trifft nichts, `rarity` steht als String und trifft | Shop | `Module/Shop.ts` | `Shop.moduleShopActions()` / `setSlotFilter()` |
| `[data-d*='"rarity":"<X>"']` (dyn. Filter) | Filter nach Rarity | Shop | `Module/Shop.ts` | `Shop.moduleShopActions()` / `setSlotFilter()` |
| `#equiped .armor .slot[data-d*=<typesOfSets[idx]>]` | Equipped-Armor mit Set-Match | Shop (Sell-Loop) | `Module/Shop.ts` | Sell-Loop in Shop |
| Sell-Loop: `availableItems.filter('.selected')[0].getAttribute('data-d')` | Selektiertes Item pruefen | Shop | `Module/Shop.ts` | Sell-Loop |
| `.right-section .slot[data-d]` (Girl-Equipment-Liste) | `{item:{...}}` Equipment der Girl-Page | GirlPage / Girl-Equipment-Upgrade | `Module/harem/HaremGirl.ts` | `HaremGirl.upgradeEquipment()` etc. |
| `inSlot.getAttribute("data-d")` (generisch in `RewardHelper.parseRewards`) | Reward-Item-JSON (`{item:{type, identifier, rarity, value, ...}, quantity}`) - Beispiel siehe Code-Kommentar | beliebige Page mit Reward-Slots | `Helper/RewardHelper.ts` | `RewardHelper.parseRewards()` / `computeRewardsCount()` |

JSON-Schema-Beispiel aus `Helper/RewardHelper.ts` (Code-Kommentar):
```
data-d='{"item":{"id_item":"323","type":"potion","identifier":"XP4","rarity":"legendary",
  "price":"500000","currency":"sc","value":"2500","carac1":"0","carac2":"0","carac3":"0",
  "endurance":"0","chance":"0.00","ego":"0","damage":"0","duration":"0",
  "skin":"hentai,gay,sexy","name":"Spell book",
  "ico":"https://hh.hh-content.com/pictures/items/XP4.png","display_price":500000},
  "quantity":"1"}'
```


## 6. Sonstige DOM-Quellen

Alle anderen relevanten DOM-Reads. Aufgeteilt nach Domain.

### 6.1 Page-Detection / Tab-Switching

| Selector | Was extrahiert | Page | Datei | Symbol |
|---|---|---|---|---|
| `document.getElementById(gameID)` mit `.getAttribute('page')` | Page-ID (`pagesIDXxx`) | jede Page | `Helper/PageHelper.ts` | `getPage()` |
| `body[page][id]` `.attr('id')` | gameID fuer 'unbekannte URL'-Popup | jede Page | `Helper/ConfigHelper.ts` | `getEnvironnement()` (Popup-Text) |
| `#activities-tabs > div.switch-tab.underline-tab.tab-switcher-fade-in[data-tab='contests']` | Erkennt Activities-Tab 'Contests' | Activities-Page | `Helper/PageHelper.ts` | `getPage()` |
| `[data-tab='missions']` (gleicher Container) | Erkennt Tab 'Missions' | Activities-Page | `Helper/PageHelper.ts` | `getPage()` |
| `[data-tab='daily_goals']` | Erkennt Tab 'DailyGoals' | Activities-Page | `Helper/PageHelper.ts` | `getPage()` |
| `[data-tab='pop']` | Erkennt Tab 'PlaceOfPower' | Activities-Page | `Helper/PageHelper.ts` | `getPage()` |
| `div.pop_list:not([style*="display:none"])` | Sichtbare PoP-Liste vorhanden | Activities/PoP | `Helper/PageHelper.ts` | `getPage()` |
| `.pop_thumb_selected[pop_id]` `.attr('pop_id')` | Selektierte Pop-Instanz-ID | Activities/PoP | `Helper/PageHelper.ts` | `getPage()` |

### 6.2 Login / Forbidden / Pre-Start Checks

| Selector | Was extrahiert | Page | Datei | Symbol |
|---|---|---|---|---|
| `document.getElementsByTagName('body')[0].innerText === 'Forbidden'` | 'Forbidden'-Errorpage erkennen | jede Page | `Service/StartService.ts` | `hardened_start()` |
| `a[rel='phoenix_member_login']` | Login-Link sichtbar -> nicht eingeloggt | jede Page | `Service/StartService.ts` | `start()` |

### 6.3 Team / Battle Teams

| Selector | Was extrahiert | Page | Datei | Symbol |
|---|---|---|---|---|
| `.team-member-container[data-team-member-position="0"]` `.attr('data-girl-id')` | ID des Girls auf Position 0 | EditTeam | `Module/TeamModule.ts` | `TeamModule.getFirstSelectedGirlId()` |
| `.team-slot-container.selected-team` `.attr('data-team-index')` | Index des selektierten Teams | BattleTeams / EditTeam | `Module/TeamModule.ts` | `getSelectedGirlsId()`, `getSelectedGirls()` |
| `#contains_all section .player-panel .player-team .team-hexagon .team-member-container.selectable[data-team-member-position="<N>"]` (N=0..6) | Slot per Position | EditTeam | `Module/TeamModule.ts` | `assignToTeam()` |
| `.team-member-container[data-girl-id="<girlId>"]` (addClass `selected`) | Girl per ID selektieren | EditTeam | `Module/TeamModule.ts` | Equip-Loop |

### 6.4 Labyrinth

| Selector | Was extrahiert | Page | Datei | Symbol |
|---|---|---|---|---|
| `.player-panel .team-hexagon .team-member-container[data-girl-id="<girlId>"][data-team-member-position="<pos>"]` | Pruefung 'Girl X auf Position Y' | EditLabyrinthTeam / Labyrinth | `Module/Labyrinth.ts` | `Labyrinth.isSelectedGirl()` |
| `.player-panel .team-hexagon .team-member-container[data-girl-id="<girlId>"]` | Pruefung 'Girl X im Squad' | Labyrinth | `Module/Labyrinth.ts` | `Labyrinth.isSelectedGirl()` |
| `.team-hexagon .team-member-container.selectable[data-team-member-position="<pos>"]` | Selektierbarer Squad-Slot | EditLabyrinthTeam | `Module/Labyrinth.ts` | `Labyrinth._selectGirl()` |
| `(...)[data-girl-id]` `.attr('data-girl-id')` vergleichen mit `.attr('id_girl')` | Aktuelle Position vs Ziel | EditLabyrinthTeam | `Module/Labyrinth.ts` | `Labyrinth._selectGirl()` |
| `.opponent-power .opponent-power-text[data-power]` `.attr('data-power')` | Gegner-Power (Hex) | LabyrinthPreBattle | `Module/Labyrinth.ts` | `Labyrinth.parseHex()` |
| `.player-panel .team-hexagon .team-member-container[data-girl-id]` `.length` | Squad-Groesse | Labyrinth | `Module/LabyrinthAuto.ts` | `LabyrinthAuto.getNumberSelectedGirl()` |

### 6.5 League

| Selector | Was extrahiert | Page | Datei | Symbol |
|---|---|---|---|---|
| `.league_content .data-list .data-column[sorting]` | Sortierbare Spalten-Header | Leaderboard | `Module/League.ts` | `League._refreshSorting()` (auskommentiert in Doku-Code, Live-DOM-Read) |
| `.league_content .data-list` | League-Tabelle Container | Leaderboard | `Module/League.ts` | `League.styles()`/Sort-UI |
| `.data-row.body-row:visible` (in League-Tabelle) | Sichtbare Gegner-Zeilen | Leaderboard | `Module/League.ts` | Sort-Click-Handler |
| `getElementsByClassName("data-list")[0]` | Tabellen-Root (DOM-API) | Leaderboard | `Module/League.ts` | `removeBeatenOpponents()`, `displayBeatenOpponents()` |
| `.data-row body-row` (innerhalb `getElementsByClassName`) | Gegner-Liste | Leaderboard | `Module/League.ts` | `removeBeatenOpponents()`, `displayBeatenOpponents()` |
| `.data-column.head-column` (querySelectorAll) | Header-Zellen | Leaderboard | `Module/League.ts` | Sort-Listener |
| `.body-row .data-column[column="power"]` `.first().html()/.text()` | Power-Spalte (matchRating-Erkennung) | Leaderboard | `Module/League.ts` | `League.hasVanillaPowerColumn()` |
| `.data-list .data-row.body-row` | Alle Body-Rows | Leaderboard | `Module/League.ts` | `parseOpponents()` |
| `.data-list .data-row.body-row a` `.length` | Noch zu kaempfende Gegner | Leaderboard | `Module/League.ts` | `parseOpponents()` Logging |

Entfernt am 2026-08-17: zwei Zeilen fuer `.matchRating-expected .matchRating-value` und die Plain-Power-Variante. Beide wurden ausschliesslich von einem auskommentierten `getPowerOrPoints`-Block gelesen; der Block ist geloescht (Commit `chore: delete commented-out code`), und ein `grep` bestaetigt, dass kein lebender Code die Selektoren anfasst.
| `.data-list .data-row.body-row.player-row .data-column[column="place"]` `.text()` | Eigener Rank | Leaderboard | `Module/League.ts` | League-Stop-Logic |
| `.data-list .data-row.body-row.player-row .data-column[column="player_league_points"]` `.text()` | Eigener Score | Leaderboard | `Module/League.ts` | League-Stop-Logic |

### 6.6 Pantheon / Champion / Club Champion

| Selector | Was extrahiert | Page | Datei | Symbol |
|---|---|---|---|---|
| `#pre-battle .battle-buttons .green_button_L.battle-action-button.pantheon-single-battle-button[data-pantheon-id='<id>']` | Pantheon-Single-Battle-Button | PantheonPreBattle | `Module/Pantheon.ts` | `Pantheon.run()` |
| `.champions-over__champion-info.champions-animation .champion-pose` | Champion-Pose-Bilder fuer `getPoses()` | ChampionsPage / ChampionsMap; gemessen auf `/club-champion.html` (5) | `Module/Champion.ts` | `Champion.run()` (Fallback wenn `championData.champion.poses` fehlt) |
| `div.club-champion-members-challenges .player-row .data-column:nth-of-type(3)` | Tickets-used pro Club-Member | Clubs-Seite, Champions-Reiter (`Club.ts`/`ClubChampion.ts` pruefen vorher `div.club-champion-members-challenges:visible`); auf `/club-champion.html` gemessen 0 Treffer. Am Aufrufort gemessen 2026-09-11: auf `/clubs.html` nach Klick auf `[data-tab=club_champions]` sichtbar 1 und `.player-row` 1, unveraendert von 12 ms bis 3 s; im Beobachtungslauf desselben Tages ging `handleClubChampion` von dort weiter und setzte ein Ticket ein | `Module/ClubChampion.ts` | `ClubChampion.run()` |

### 6.7 Pachinko

| Selector | Was extrahiert | Page | Datei | Symbol |
|---|---|---|---|---|
| `#playzone-replace-info button[data-free="true"].blue_button_L` | Free-Pachinko-Button. 2026-09-11 auf `/pachinko.html` 0 Treffer: kein Knopf trug `data-free`, das Freispiel des Tages war laut Timer schon genommen (derselbe Tag, `handlePachinko` im Beobachtungslauf). Ob der Knopf beim naechsten Freispiel `data-free="true"` traegt, ist offen | Pachinko | `Module/Pachinko.ts` | `Pachinko.selectPachinko()` |
| `[girlsRewards].attr("data-rewards")` (JSON) | Anzahl Girls als Reward | Pachinko | `Module/Pachinko.ts` | `Pachinko.run()` |

### 6.8 Troll-Battle / Pre-Battle

| Selector | Was extrahiert | Page | Datei | Symbol |
|---|---|---|---|---|
| `#pre-battle .battle-buttons button.autofight[data-battles="10"]` | x10-Fight-Button | TrollPreBattle / generisch | `Module/Troll.ts` | `Troll.run()` |
| `#pre-battle .battle-buttons button.autofight[data-battles="50"]` | x50-Fight-Button | TrollPreBattle | `Module/Troll.ts` | `Troll.run()` |
| `#pre-battle .battle-buttons .green_button_L.battle-action-button` | Standard-Battle-Button | TrollPreBattle | `Module/Troll.ts` | `Troll.run()` |
| `#pre-battle .oponnent-panel .opponent_rewards .rewards_list .slot.girl_ico[data-rewards]` | Girl-Reward-Slots | TrollPreBattle | `Module/Troll.ts` | `Troll.run()` |
| `[rewardGirlz].attr('data-rewards')` (JSON) | JSON-Liste Girl-Shards | TrollPreBattle | `Module/Troll.ts` | `Troll.run()` |
| `#pre-battle div.battle-buttons a.single-battle-button[disabled]` | Battle-Button disabled-Check | TrollPreBattle | `Module/Troll.ts` | `Troll.run()` (Force-Reload) |

### 6.9 Season / Seasonal / Events

| Selector | Was extrahiert | Page | Datei | Symbol |
|---|---|---|---|---|
| `.season_arena_opponent_container[data-opponent=<id_fighter>]` | Block des selektierten Arena-Gegners | SeasonArena | `Module/Events/Season.ts` | `Season.parseSeasonOpponents()`, `chooseOpponent()` |
| `.slot.girl_ico[data-rewards]` (im Opponent-Block) | Girl-Shards-Reward | SeasonArena | `Module/Events/Season.ts` | `Season.run()` |
| `[data-select-girl-id=<id_girl>]` (in Daily-Mission/Event-Page) | Girl-Tile | Event-Page / Mission | `Module/Events/EventModule.ts` | `displayPrioInDailyMissionGirl()` |
| `.hard-objective .redirect-buttons:has(button[data-href="/champions-map.html"])` | Champion-Goal-Block (Hard) | DoublePenetration-Event | `Module/Events/DoublePenetration.ts` | `DoublePenetration.run()` |
| `.easy-objective .redirect-buttons:has(button[data-href="/champions-map.html"])` | Champion-Goal-Block (Easy) | DP-Event | `Module/Events/DoublePenetration.ts` | `DoublePenetration.run()` |
| `#poa-content .buttons:has(button[data-href="/champions-map.html"])` | Champion-Goal-Block in PoA | PoA | `Module/Events/PathOfAttraction.ts` | `PathOfAttraction.run()` |
| `[data-nc-reward-id]` (PoA-Tier-Slots) | PoA-Tier-Reward-ID | PoA | `Module/Events/PathOfAttraction.ts` | `PathOfAttraction.goAndCollect()` |
| `.free-slot .slot,.free-slot .shards_girl_ico` (PoV/PoG) | Free-Slot-Reward-Type | PoV / PoG | `Module/Events/PathOfValue.ts`, `PathOfGlory.ts` | `goAndCollect()` |
| `.paid-slots:not(.paid-locked) .slot,.paid-slots:not(.paid-locked) .shards_girl_ico` | Paid-Slot-Reward-Type | PoV / PoG | `Module/Events/PathOfValue.ts`, `PathOfGlory.ts` | `goAndCollect()` |

### 6.10 Harem / Girl

| Selector | Was extrahiert | Page | Datei | Symbol |
|---|---|---|---|---|
| `#harem_right .opened` `.attr('girl')` | Aktuell ausgewaehltes Girl-ID (Side-Panel) | Harem | `Module/harem/Harem.ts` | `fillCurrentGirlItem()`, `addGoToGirlPageButton()`, `addGirlImages()` |
| `#harem_right .opened .avatar-box:visible` `.length` | Girl ist ownership-bestaetigt | Harem | `Module/harem/Harem.ts` | `addGoToGirlPageButton()`, `addGirlImages()` |
| `.select-group.<selector> .selectric-items li[data-index="<index>"]` (trigger click) | Selectric-Filter-Element | Harem | `Module/harem/HaremFilter.ts` | `HaremFilter.selectOption()` |
| `#girl-leveler-tabs .switch-tab[data-tab="<haremItem>"]` | Girl-Leveler-Tab | GirlPage | `Module/harem/HaremGirl.ts` | `HaremGirl.switchTabs()` |
| `.hhava` `.length` | Eigene Avatar-Marker bereits gerendert | Harem | `Module/harem/Harem.ts` | `addGirlImages()` |

### 6.11 Markt / Shop / Inventory (Timer + Toolbar)

| Selector | Was extrahiert | Page | Datei | Symbol |
|---|---|---|---|---|
| `.shop div.shop_count span[rel="expires"]` `.first().text()` | Shop-Refresh-Timer (HH:MM:SS) | Shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` (mit `convertTimeToInt`) |
| `#girls_list .g1 .nav_placement span:not([contenteditable])` | Shop-Girl-Count | Shop | `config/HHEnvVariables.ts` | Konstante `shopGirlCountRequest` -- von keinem Code gelesen; der Selektor im Code ist unvollstaendig (`span:not([contenteditable]` ohne `)`); gemessen 0 Treffer |
| `#girls_list .g1 .nav_placement span[contenteditable]` | Aktueller Shop-Girl-Index | Shop | `config/HHEnvVariables.ts` | Konstante `shopGirlCurrentRequest` |

### 6.12 Sonstige UI-Lookups (Timer, Reward-Banner, etc.)

| Selector | Was extrahiert | Page | Datei | Symbol |
|---|---|---|---|---|
| `#contains_all header .currency .daily-reward-notif` | Daily-Reward-Notification | jede Page (2026-09-11 auf keiner Seite getroffen; ob es an einer wartenden Tagesbelohnung haengt, ist nicht geprueft) | `config/HHEnvVariables.ts` | Konstante `dailyRewardNotifRequest` |
| `#edit-team-page` (id-Selector) | EditTeam-Panel-Container | EditTeam | `config/HHEnvVariables.ts` | Konstante `IDpanelEditTeam` |
| `#claim-all:not([disabled]):visible:not([style*='visibility: hidden;'])` | 'Claim All'-Button | beliebig | `config/HHEnvVariables.ts` | Konstante `selectorClaimAllRewards` |
| `[PoVPoG-Slot].attr('data-time-stamp')` | Timestamp eines PoV/PoG-Tier-Slots | PoV / PoG | `config/HHEnvVariables.ts` | Konstante `PoVPoGTimestampAttributeName` |
| `[girl-tile].attr('data-new-girl-tooltip')` | New-Girl-Tooltip-Daten | beliebige Page mit Girl-Slots | `config/HHEnvVariables.ts` | Konstante `girlToolTipData` |
| `:not([style*="display:none"]):not([style*="display: none"])` | Filter 'nicht versteckt' (generisches Suffix) | jede Page | `config/HHEnvVariables.ts` | Konstante `selectorFilterNotDisplayNone` |

## 7. localStorage / Storage-Keys

Die Keys selbst stehen in [storage-keys.md](storage-keys.md) -- Name, Storage-Typ,
Default, Beschreibung, je Key. Diese Datei hat sie eine Zeit lang ein zweites Mal
gefuehrt; die Kopie ist raus, weil zwei Listen desselben Registers immer
auseinanderlaufen.

Was hier bleibt, ist der Zugriffsweg: `getStoredValue` / `getStoredJSON` lesen,
`setStoredValue` schreibt, `deleteStoredValue` loescht. Array-typisierte Settings
ueber `getStoredArray` lesen -- `getStoredJSON` gibt bei gespeichertem `"null"`
null zurueck statt des Defaults (#1846). Alle Keys tragen das Praefix
`HHStoredVarPrefixKey` (Default `HHAuto_`). Ein Key, der nicht in
`HHStoredVars.ts` registriert ist, wird lautlos verworfen.

Storage-Backing: localStorage direkt, sessionStorage direkt, oder `Storage()`
(gating ueber `SK.settPerTab` -> sessionStorage, sonst localStorage). Settings
sind in der Regel `Storage()`, Temp-Vars meist sessionStorage.


## 8. sessionStorage (direkter Zugriff, ohne getStoredValue-Wrapper)

Alle Stellen, an denen sessionStorage direkt verwendet wird (also nicht ueber getStoredValue/setStoredValue).
Hintergrund: Der Wrapper sucht den Key in HHStoredVars und delegiert je nach storage-Feld an localStorage / sessionStorage / Storage(). Direkte Zugriffe umgehen diese Pruefung.

Die Stellen stehen im Code und sind mit einer Suche zu finden:

```
grep -rn 'sessionStorage\.\(getItem\|setItem\|removeItem\)\|sessionStorage\[' src
```

Stand 2026-09-11 sind es vier Gruppen, jede mit Grund: der Log-Ring in
`Utils/LogStore.ts` (absichtlich an der Registry vorbei, siehe
`storage-keys.md`), die Zaehler fuer Forbidden-Antworten und Hero-Neuladungen
in `Service/StartService.ts` (laufen, bevor das Spiel geladen ist), das
Aufraeumen der Event-Keys in `Module/Events/EventModule.ts` und eine
Loeschschleife in `Module/Booster.ts`; dazu die Groessenzaehlung in
`Helper/StorageHelper.ts`. Die fruehere Tabelle an dieser Stelle nannte
`PlaceOfPower`, `AutoLoopActions`, `ParanoiaService`, `migrateHHVars` und
`saveAllToFile` -- die gehen heute ueber den Wrapper, und die Tabelle war der
Grund, warum diese Liste nicht mehr kopiert wird.


## 9. Spielzustands-Bridge-Funktionen

### 9.1 getHHVars(infoSearched, logging=true) (Helper/HHHelper.ts)

Ablauf:

1. returnValue = unsafeWindow
2. Wenn ConfigHelper.getHHScriptVars(infoSearched, false) !== null: ueberschreibe infoSearched mit dem Per-Game-Override (selten genutzt).
3. infoSearched = prefixIfNeeded(infoSearched):
   - Wenn unsafeWindow.shared existiert UND infoSearched.indexOf("Hero.") == 0, wird "shared." + infoSearched davorgehaengt.
   - Effekt: Code kann konsistent "Hero.x" schreiben, egal ob das Spiel auf Legacy-Build (window.Hero.x) oder neuem Build (window.shared.Hero.x) laeuft.
4. Loop ueber infoSearched.split("."). Jeder Schritt: returnValue = returnValue[part]. Wenn ein Teil undefined ist: log + return null.

Counterpart: setHHVars(infoSearched, newValue) - gleicher Lookup-Algorithmus, am letzten Pfadelement wird zugewiesen. Wenn ein Zwischenpfad fehlt, wird -1 zurueckgegeben (kein Throw).

### 9.2 getHHAjax() (Utils/Utils.ts)

```ts
return unsafeWindow.shared?.general?.hh_ajax;
```

Liefert die interne AJAX-Funktion des Spiels mit Signatur (params, onSuccess, onError) => void.
params.action ist das spielinterne Action-Routing (siehe Sektion 3).
onSuccess(data), onError(err) sind die Callbacks.

### 9.3 getHero() (Helper/HeroHelper.ts)

```ts
if (unsafeWindow.shared?.Hero === undefined) {
    setTimeout(autoLoopKick, Number(getStoredValue(HHStoredVarPrefixKey+TK.autoLoopTimeMili)) || 1000);
}
return unsafeWindow.shared?.Hero as KKHero;
```

Liefert das Hero-Objekt direkt aus shared. Bei Nichtverfuegbarkeit: stoesst ueber `autoLoopKick` (vom Boot-Pfad per `setHeroAutoLoopKick` eingesetzt, statt eines Imports von AutoLoop) einen neuen Durchlauf an und gibt undefined zurueck.

Die Klasse HeroHelper (gleiches File) bietet getter-Wrapper:

| Methode | Liefert |
|---|---|
| HeroHelper.getPlayerId() | getHHVars("Hero.infos.id") |
| HeroHelper.getClass() | getHHVars("Hero.infos.class") |
| HeroHelper.getLevel() | getHHVars("Hero.infos.level") |
| HeroHelper.getMoney() | getHHVars("Hero.currencies.soft_currency") |
| HeroHelper.getKoban() | getHHVars("Hero.currencies.hard_currency") |
| HeroHelper.haveBoosterInInventory(id) | Lookup im TK.haveBooster-Storage-Cache |
| HeroHelper.equipBooster(booster) | sendet market_equip_booster (siehe Sektion 3) mit Timeout-Sicherung |

### 9.4 Weitere Bridge-Helper

| Funktion | Datei | Zweck |
|---|---|---|
| getLoadingAnimation() | Utils/Utils.ts | window.shared?.animations?.loadingAnimation mit Fallback auf no-op-Stubs |
| onAjaxResponse(pattern, callback) | Utils/Utils.ts | Globaler ajaxComplete-Hook (siehe Sektion 4) |
| getCurrentSorting() | Utils/Utils.ts | liest localStorage.sort_by (vom Spiel selbst gesetzt; nicht HHAuto) |
| getStoredValue/getStoredJSON/setStoredValue/deleteStoredValue | Helper/StorageHelper.ts | HHAuto-eigener Wrapper ueber HHStoredVars-Registry |
| getStorage() | Helper/StorageHelper.ts | gibt sessionStorage wenn SK.settPerTab=true, sonst localStorage (fuer Storage()-Vars) |
| getStorageItem(type) | Helper/StorageHelper.ts | resolved "localStorage" / "sessionStorage" / "Storage()"-Tag in echte Storage-API |
| addNutakuSession(togoto) | Service/PageNavigationService.ts | haengt ?sess=... an URL wenn unsafeWindow.hh_nutaku |
| queryStringGetParam(qs, name) | Helper/UrlHelper.ts | URLSearchParams-Wrapper |
| getPage(checkUnknown) | Helper/PageHelper.ts | resolved canonical Page-ID aus <body page>+Tab+Pop-Detection (siehe Sektion 6.1) |
| ConfigHelper.getEnvironnement() | Helper/ConfigHelper.ts | matched window.location.hostname gegen HHKnownEnvironnements |
| ConfigHelper.getHHScriptVars(id, logNotFound) | Helper/ConfigHelper.ts | env-spezifischer Lookup mit global als Fallback (siehe Sektion 11) |
| ConfigHelper.isPshEnvironnement() | Helper/ConfigHelper.ts | true fuer PH_prod und NPH_prod |


## 10. Page-spezifische Datenverfuegbarkeit

Fuer jede Page-ID (aus ConfigHelper.getHHScriptVars("pagesIDXxx")): welche unsafeWindow-Globals sind dort lesbar, welche DOM-Quellen relevant.

**Gemessen 2026-09-11** (Pruefkonto Level 115, 24 Maedchen, im Club; ein Mega-Event lief, kein Lively-Scene-, Sultry- oder Boss-Bang-Event). Je Seite: welche Globals aus den Abschnitten 1 und 2 existierten und welche statischen Selektoren aus den Abschnitten 5 und 6 trafen. Typen statt Werte.

Auf **jeder** der 39 Seiten vorhanden und deshalb unten nicht wiederholt: `shared`, `shared.Hero` samt allen hier genannten `infos`-, `currencies`- und `energies`-Feldern (kiss, fight, challenge, quest, worship, drill je mit `amount`, `max_regen_amount`, `next_refresh_ts`, `seconds_per_point`), `shared.general.hh_ajax`, `shared.general.is_cheat_click`, `shared.animations.loadingAnimation`, `hh_prices`, `hh_nutaku` (`null`), `server_now_ts`, `mega_event_active`, `mega_event_time_remaining`, `shared.GirlSalaryManager.girlsMap`/`girlsListSec`, `Chat_vars.CLUB_INFO.id_club`.

Auf **keiner** Seite: `is_cheat_click` (ohne `shared.general`), `Hero` (ohne `shared`), `league_tag`, `HHTimers`, `Collect`, `has_contests_datas`, `seasonal_event_active`, `seasonal_time_remaining`, `sm_event_data`, `current_event.event_data.puzzle_pieces`, `item_to_upgrade`. Nicht besucht: die Champion-Seite (kein Link auf der Karte), Kampfseiten (loesen einen Kampf aus), die Mythic-Upgrade-Seite (braucht Parameter).

| Seite (`body[page]`) | Globals ausser den ueberall vorhandenen | Selektoren aus Abschnitt 5/6 mit Treffern |
|---|---|---|
| `/home.html` (`home`) | `girlsDataList` Obj, `salary_collect` Zahl | -- |
| `/activities.html?tab=contests` (`activities`) | `contests_timer.next_contest` Zahl, `contests_timer.duration` Zahl, `contests_timer.remaining_time` Zahl, `daily_goals_list` Array[11], `pop_list` Bool, `pop_index` Zahl | -- |
| `/activities.html?tab=missions` (`activities`) | `contests_timer.next_contest` Zahl, `contests_timer.duration` Zahl, `contests_timer.remaining_time` Zahl, `daily_goals_list` Array[11], `pop_list` Bool, `pop_index` Zahl | -- |
| `/activities.html?tab=daily_goals` (`activities`) | `contests_timer.next_contest` Zahl, `contests_timer.duration` Zahl, `contests_timer.remaining_time` Zahl, `daily_goals_list` Array[11], `pop_list` Bool, `pop_index` Zahl | -- |
| `/activities.html?tab=pop` (`activities`) | `contests_timer.next_contest` Zahl, `contests_timer.duration` Zahl, `contests_timer.remaining_time` Zahl, `daily_goals_list` Array[11], `pop_list` Bool, `pop_index` Zahl | -- |
| `/activities.html?tab=pop&pop_id=1` (`activities`) | `contests_timer.next_contest` Zahl, `contests_timer.duration` Zahl, `contests_timer.remaining_time` Zahl, `daily_goals_list` Array[11], `pop_list` Bool, `pop_index` Zahl | -- |
| `/characters.html` (`harem`) | `player_gems_amount` Obj, `girlsDataList` Obj | `#harem_right .opened` 1 |
| `/girl/<n>` (`girl`) | `girl` Obj, `player_gems_amount` Obj | `#girl-leveler-tabs .switch-tab[data-tab]` 5, `.right-section .slot[data-d]` 17 |
| `/girl/<n>?resource=equipment` (`girl`) | `girl` Obj, `player_gems_amount` Obj | `#girl-leveler-tabs .switch-tab[data-tab]` 5 |
| `/map.html` (`map`) | `love_raids` Array[24] | -- |
| `/pachinko.html` (`pachinko`) | -- | -- |
| `/leagues.html` (`leaderboard`) | `current_tier_number` Zahl, `opponents_list` Array[141] | `.league_content .data-list` 1, `.data-list .data-row.body-row` 141, `.data-list .data-row.body-row a` 123, `.data-column.head-column` 10, `.body-row .data-column[column="power"]` 141, `.data-list .data-row.body-row.player-row .data-column[column="place"]` 1, `.data-list .data-row.body-row.player-row .data-column[column="player_league_points"]` 1 |
| `/shop.html` (`shop`) | `player_inventory.armor` Array[65], `player_inventory.booster` Array[4], `equipped_armor` Obj | `#shops div.armor.merchant-inventory-item .slot` 9, `#shops div.booster.merchant-inventory-item .slot` 9, `#shops div.gift.merchant-inventory-item .slot` 9, `#shops div.potion.merchant-inventory-item .slot` 9, `#shops div.gift.player-inventory-content .slot` 18, `#shops div.potion.player-inventory-content .slot` 18, `#shops div.booster.player-inventory-content .slot` 9, `#equiped .booster .slot:not(.empty):not(.mythic)` 4, `#equiped .booster .slot:not(.empty).mythic` 1, `#player-inventory-booster .slot` 9, `#equiped .armor div[id_item]` 6, `#equiped .armor .slot` 6, `.shop div.shop_count span[rel="expires"]` 4 |
| `/clubs.html` (`clubs`) | -- | `.data-list .data-row.body-row` 46, `.data-list .data-row.body-row a` 47, `.data-column.head-column` 5 |
| `/pantheon.html` (`pantheon`) | -- | -- |
| `/pantheon-pre-battle.html?id_opponent=26` (`pantheon-pre-battle`) | `hero_data` Obj | `.team-member-container[data-team-member-position="0"]` 2, `.player-panel .team-hexagon .team-member-container[data-girl-id]` 7, `#pre-battle .battle-buttons .green_button_L.battle-action-button` 1, `#pre-battle .battle-buttons button.autofight[data-battles="10"]` 1, `#pre-battle .battle-buttons .pantheon-single-battle-button[data-pantheon-id]` 1 |
| `/labyrinth.html` (`labyrinth`) | `girl_squad` Array[24] | -- |
| `/champions-map.html` (`champions_map`) | `love_raids` Array[1] | -- |
| `/club-champion.html` (`club_champion`) | `championData` Obj, `championData.team` Array[10], `championData.champion.id` Zahl, `championData.champion.poses` Array[5], `championData.freeDrafts` Zahl, `championData.hero_damage` Zahl, `championData.fight.active` Bool, `championData.fight.participants` Array[12] | `.champions-over__champion-info.champions-animation .champion-pose` 5 |
| `/season.html` (`season`) | `love_raids` Array[3], `season_sec_untill_event_end` Zahl | `#claim-all` 1 |
| `/season-arena.html` (`season_arena`) | `hero_data` Obj, `opponents` Array[3] | `.team-member-container[data-team-member-position="0"]` 4, `.season_arena_opponent_container[data-opponent]` 3, `.season_arena_opponent_container .slot.girl_ico[data-rewards]` 3 |
| `/leagues-pre-battle.html?id_opponent=<n>` (`leagues-pre-battle`) | `hero_data` Obj | `.team-member-container[data-team-member-position="0"]` 2, `.player-panel .team-hexagon .team-member-container[data-girl-id]` 7, `#pre-battle .battle-buttons .green_button_L.battle-action-button` 2 |
| `/troll-pre-battle.html?id_opponent=1` (`troll-pre-battle`) | `hero_data` Obj | `.team-member-container[data-team-member-position="0"]` 2, `.player-panel .team-hexagon .team-member-container[data-girl-id]` 7, `#pre-battle .battle-buttons .green_button_L.battle-action-button` 1, `#pre-battle .battle-buttons button.autofight[data-battles="10"]` 1, `#pre-battle .battle-buttons button.autofight[data-battles="50"]` 1, `#pre-battle .oponnent-panel .opponent_rewards .rewards_list .slot.girl_ico[data-rewards]` 1 |
| `/penta-drill.html` (`penta_drill`) | `penta_drill_data.cycle_data.seconds_until_event_end` Zahl | `#claim-all` 1 |
| `/penta-drill-arena.html` (`penta_drill_arena`) | `opponents_list` Array[4] | -- |
| `/penta-drill-pre-battle?<n>` (`penta_drill_pre_battle`) | `penta_drill_data.cycle_data.seconds_until_event_end` Zahl | `.team-member-container[data-team-member-position="0"]` 2, `.player-panel .team-hexagon .team-member-container[data-girl-id]` 7 |
| `/event.html?tab=event_533` (`event`) | `event_data` Obj, `event_data.girls` Array[2], `current_event` Obj | `[data-select-girl-id]` 2 |
| `/event.html?tab=path_event_110` (`event`) | `event_data` Obj, `current_event` Obj, `event_ends_in` String | `[data-nc-reward-id]` 52 |
| `/path-of-valor.html` (`path-of-valor`) | -- | `.free-slot .slot,.free-slot .shards_girl_ico` 53 |
| `/path-of-glory.html` (`path-of-glory`) | -- | `.free-slot .slot,.free-slot .shards_girl_ico` 65 |
| `/seasonal.html` (`seasonal`) | `mega_event_data.cards` String | `.free-slot .slot,.free-slot .shards_girl_ico` 115 |
| `/love-raids.html` (`love_raids`) | `love_raids` Obj | -- |
| `/waifu.html` (`waifu`) | `girls_data_list` Array[24] | -- |
| `/teams.html?battle_type=leagues` (`teams`) | `teams_data` Obj | `.team-member-container[data-team-member-position="0"]` 1, `.team-slot-container.selected-team` 1 |
| `/edit-team.html?battle_type=leagues` (`edit-team`) | `hero_data` Obj, `availableGirls` Array[24] | `.team-member-container[data-team-member-position="0"]` 1, `#contains_all section .player-panel .player-team .team-hexagon .team-member-container.selectable` 7, `#edit-team-page` 1, `.player-panel .team-hexagon .team-member-container[data-girl-id]` 7 |
| `/member-progression.html` (`member-progression`) | -- | `.free-slot .slot,.free-slot .shards_girl_ico` 50, `#claim-all` 2 |
| `/hero/profile.html` (`hero_pages`) | -- | -- |
| `/god-path.html` (`god-path`) | -- | -- |
| `/quest/<aktuell>` (`quest`) | `id_girl` Zahl | -- |



## 11. Per-Game-Unterschiede

Erkennung: ConfigHelper.getEnvironnement() matched window.location.hostname gegen HHKnownEnvironnements.
Die bekannten Hosts stehen in den `getEnv()`-Methoden der Dateien in `src/config/game/` (Name, `gameID`, optional `baseImgPath`); HornyHeroes ist direkt in `HHEnvVariables.ts` eingetragen. Eine Kopie der Liste stand hier und ist entfernt. `gameID` ist die `id` des `<body>` -- gemessen 2026-09-11 auf www.hentaiheroes.com (`hh_hentai`); die anderen Hosts sind nicht geprueft.

Folgende Felder werden in HHEnvVariables.ts per for (var key in <Game>.getEnv()) ueberschrieben:

| Feld | Quelle | Wirkung |
|---|---|---|
| gameID | HHKnownEnvironnements[host].id | Wert des <body id="..."> (von PageHelper.getPage() gelesen) |
| HHGameName | env-Name | als ID in HHEnvVariables-Map |
| baseImgPath | HHKnownEnvironnements[host].baseImgPath oder Default https://hh2.hh-content.com | Praefix fuer Bild-URLs |
| spreadsheet | nur HentaiHeroes-Family | Externer Link in Blessing-Popup |
| trollzList | <Game>.getTrolls(languageCode) | Lokalisierte Troll-Namen |
| sideTrollzList | nur HH | - |
| trollGirlsID | <Game>.getTrollGirlsId() | Mapping Troll-Index -> Girl-IDs |
| trollIdMapping / sideTrollIdMapping | spielspezifisches Remapping | - |
| lastQuestId | <Game>.lastQuestId | Letzte bekannte Quest-ID (Pause-Schwelle) |
| boosterId_MB1 | Default 632 (HH); 2619 fuer ComixHarem, PornstarHarem, TransPornstarHarem, GayPornstarHarem | Sandalwood-Item-ID |
| pagesIDXxx / pagesURLXxx | meist global; einzelne werden per <Game>.updateFeatures(env) ueberschrieben | Page-IDs / Page-URLs |
| isEnabledXxx | global; SH_prod (HornyHeroes) hat zahlreiche Features deaktiviert | Feature-Toggles |
| isPshEnvironnement() | true fuer PH_prod, NPH_prod | Generelle PSH-Sonderfaelle |

Datenzugriffs-Unterschiede:

- **Girl-Daten-Quelle**: welche der drei Listen es gibt, haengt an der Seite, nicht am Spiel -- gemessen bei HentaiHeroes: `availableGirls` auf edit-team, `girlsDataList` auf home und characters, `girls_data_list` auf waifu (Module/harem/Harem.ts faellt auf alle drei Pfade in Reihenfolge zurueck).
- **shared.Hero vs Hero**: Auf modernen Builds aller Variants ist unsafeWindow.shared definiert -> getHHVars("Hero.x") haengt automatisch shared. davor (siehe Sektion 9.1).
- **Iframe**: Nutaku-Builds (unsafeWindow.hh_nutaku === true) leben in einem iframe; HHAuto sendet postMessage({ImAlive:true},"*") an window.top und haengt ?sess=... an interne Navigationen an.
- **Endpoint-Unterschiede**: AJAX-Endpoint ist immer derselbe Host wie das Spiel (relativ zur Hostname).


## 12. Cheat-Click-Hook (shared.general.is_cheat_click)

Im Spiel-Code ist shared.general.is_cheat_click eine Funktion, die bei verdaechtigen Klick-Mustern (zu schnelle Klicks, kein Mausweg, etc.) true zurueckgibt und Aktionen blockiert.

In HHAuto:

- `Utils/Utils.ts` enthaelt `replaceCheatClick()` mit leerem Rumpf; die frueher auskommentierten Zeilen sind entfernt.

- Service/StartService.ts ruft replaceCheatClick() einmalig in start() auf - aktuell ein No-Op.

Bedeutung: Override-Stelle ist im Code vorbereitet, aber **deaktiviert**. Eine fruehere Version ueberschrieb beide Pfade (unsafeWindow.is_cheat_click und unsafeWindow.shared.general.is_cheat_click) mit immer-false-Stub. Aktuell verlaesst sich HHAuto darauf, dass durch randomInterval(...) und Timing-Pausen kein Cheat-Detection-Trigger ausgeloest wird, und Aktionen werden bevorzugt direkt via getHHAjax()(params, ...) gesendet (statt synthetischer Klicks).

Window-Interface (src/index.ts) enthaelt is_cheat_click: any als declared property - Type-Hint fuer alte direkte Reads/Writes, die heute nicht mehr aktiv sind.

## 13. Race-Conditions / Timing

### 13.1 Skript-Start

src/index.ts ruft hardened_start() direkt nach Modul-Load. Tampermonkey injiziert den User-Script aber **vor** dem game-eigenen JS, daher sind globale Variablen wie shared.Hero zum Erst-Aufruf typisch noch nicht da.

Schritte in hardened_start() (Service/StartService.ts):

1. Registriert GM_registerMenuCommand("Save Debug Log", saveHHDebugLog).
2. Pruefung unsafeWindow.jQuery == undefined -> falls fehlt: ggf. "Forbidden"-Page erkennen (innerText der body); bei Forbidden: Neuladen mit wachsendem Abstand (`ForbiddenBackoff.nextForbiddenDelaySeconds`, Zaehler in sessionStorage, #1598); sonst Abbruch (kein Crash).
3. started Lock + start()-Aufruf.

In start():

1. **Hero-Retry-Loop**: Wenn unsafeWindow.shared?.Hero === undefined:
   - heroRetryCount++. Maximal HERO_MAX_RETRIES = 15 Versuche; danach laedt die Seite sich selbst neu, begrenzt durch `HERO_GIVEUP_MAX_RELOADS` (Zaehler in sessionStorage, #1788), und erst wenn auch das ausgeschoepft ist, gibt der Start auf.
   - setTimeout(hardened_start, 5000) -> alle 5 Sekunden neu versuchen.
   - started = false zurueckgesetzt, damit ein erneuter Aufruf zaehlt.
   - Diese Loop entspraeche bis zu 75 Sekunden Wartezeit.
2. Sobald Hero verfuegbar: Timer-Cleanup (clearTimeout(heroRetryTimer); heroRetryCount = 0).
3. Login-Check: \a[rel=phoenix_member_login].length > 0 -> nicht eingeloggt, abbrechen.
4. StartService.checkVersion() migriert von previousScriptVersion (TK.scriptversion) auf GM.info.script.version.
5. migrateHHVars() migriert ggf. alten HHAuto_-Praefix auf einen custom Praefix (heute meist No-Op).
6. Liest Hero.infos.questing.choices_adventure und Hero.infos.questing.id_world, persistiert als TK.MainAdventureWorldID / TK.SideAdventureWorldID.
7. setDefaults() schreibt fehlende oder ungueltige Settings auf Defaults.
8. Menu, Timers, Listener, Ad-Move, Booster.collectBoostersFromAjaxResponses() registrieren.
9. setTimeout(autoLoop, 1000) schliesst den Init ab.

### 13.2 Module-spezifische Retries

Mehrere Module haben einen Retry-Pattern fuer den Fall, dass ihre erforderliche Game-Variable noch nicht da ist:

- HeroHelper.getHero(): Wenn shared.Hero === undefined, schedule autoLoop (mit TK.autoLoopTimeMili ms) und gib undefined zurueck.
- League.getLeagueCurrentLevel(): Wenn unsafeWindow.current_tier_number === undefined, schedule autoLoop (gleiches Muster).
- getHHVars(...) returns null bei jeder fehlenden Pfad-Komponente -> Caller muessen das pruefen.

### 13.3 AJAX-Race um Booster-Status

equipBooster() (Helper/HeroHelper.ts) hat einen kombinierten Race-Schutz:

- Vor dem Call: setStoredValue(TK.autoLoop, "false") -> Loop pausiert.
- 15-Sekunden-Timeout via setTimeout(...) als Safeguard wenn weder onSuccess noch onError vom Spiel kommen.
- settled-Flag verhindert doppelte Aufloesung.
- Bei Timeout: deleteStoredValue(TK.boosterStatusLastUpdate) invalidiert den 10-Min-TTL-Cache.
- Bei data.success === false: gleiches Invalidieren.
- Nach Settle: autoLoop mit randomInterval(500, 800) neu gestartet.

Booster.waitForBattleResponse() / Booster.notifyBattleResponseProcessed() (Module/Booster.ts): Lock-Pattern mit Promise + 10s-Timeout fuer den Fall, dass die Battle-AJAX-Response zu spaet kommt.

### 13.4 AutoLoop-Pause-Mechaniken

- TK.autoLoop = "false" schaltet die Hauptschleife aus. Wird von vielen Modulen waehrend Multi-Page-Flows gesetzt.
- SK.master = "false" -> Master-Switch off, Loop laeuft nicht.
- SK.mousePause = "true" + SK.mousePauseTimeout -> Loop pausiert bei Maus-Aktivitaet (Mechanik in MouseService.ts).

### 13.5 Timer-System

- TK.Timers haelt eine JSON-Map name -> Endzeitpunkt (`Timers[name] = ND` in `setTimer`). Geschrieben von Helper/TimerHelper.ts, gelesen von StartService.ts beim Start (setTimers(...)).
- Beim Skript-Start wird setTimers(getStoredJSON(TK.Timers, {})) ausgefuehrt; persistierte Timer leben also ueber Reloads weg.
- getSecondsLeft(name) / setTimer(name, seconds) / clearTimer(name) / checkTimer(name) sind die Wrapper.
- convertTimeToInt(text) parsed das Game-DOM-Timer-Format (HH:MM:SS) z.B. fuer Shop-Refresh.

### 13.6 Bekannte Edge-Cases

- **Erstaufruf vor Game-Load**: 15x 5-s-Retry, danach begrenztes automatisches Neuladen (siehe oben).
- **Forbidden-Page**: Neuladen mit verdoppeltem Abstand je weiterem Forbidden in Folge (`Service/ForbiddenBackoff.ts`).
- **Tab-Wechsel und SK.settPerTab=true**: Settings landen in sessionStorage, also pro Tab. Migration zwischen Tabs ist nicht implementiert.
- **boosterStatusLastUpdate TTL**: 10 Minuten (Booster.BOOSTER_STATUS_TTL_MS = 10 * 60 * 1000).
- **unsafeWindow.shared.GirlSalaryManager.girlsMap**: Kann erst nach Salary-Manager-Init genutzt werden. Code prueft mit getHHVars(..., false) (silent).
