---
last-verified: 2026-05-05
verified-against-version: 7.35.21
status: current
---

# HHAuto - Data Sources Inventory

Vollstaendige Inventarisierung aller Datenquellen, auf die das HHAuto-Skript zugreift.
Quelle: systematischer grep durch alle TypeScript-Dateien unter `src/`.

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
| `unsafeWindow.shared.animations.loadingAnimation.start` | Function | Shop-Page (`pagesIDShop`) | `Module/Shop.ts` | `appendMenuSell()` | Save/Replace/Restore: Loading-Animation waehrend Bulk-Sell-Aktion unterdruecken |
| `unsafeWindow.shared.animations.loadingAnimation.stop` | Function | Shop-Page | `Module/Shop.ts` | `appendMenuSell()` | Save/Replace/Restore (analog) |
| `unsafeWindow.is_cheat_click` | Function (Cheat-Detector) | jede Page (alte Pfad-Variante) | `Utils/Utils.ts` | `replaceCheatClick()` (auskommentiert) | Veraltete Override-Stelle |
| `unsafeWindow.hh_nutaku` | Boolean/Truthy | NHH/NPH Nutaku-Build | `Service/PageNavigationService.ts`, `Service/StartService.ts` | `addNutakuSession()`, `start()` | Nutaku-Spezialfall: Session-Token via `?sess=` injizieren; postMessage("ImAlive") an parent |
| `unsafeWindow.hh_prices` | Objekt (Preis-Map z.B. `fight_cost_per_minute`) | jede Page (?) | `Module/Troll.ts` | `Troll.canBuyFight()`, `Troll.canBuyFightLoveRaid()` | Berechnung von `pricePerFight` fuer Auto-Buy von Combats |
| `unsafeWindow.has_contests_datas` | Boolean | Activities-Tab `contests` | `Service/AutoLoopActions.ts` | Contest-Action `isReady` | Indikator dass Contest-Claims abholbar sind |
| `unsafeWindow.contests_timer.next_contest` | Number (sec) | Contests-Page | `Module/Contest.ts` | `Contest.collectAndSchedule()` | Naechster Contest-Wechsel |
| `unsafeWindow.contests_timer.duration` | Number (sec) | Contests-Page | `Module/Contest.ts` | `Contest.collectAndSchedule()` | Contest-Dauer |
| `unsafeWindow.contests_timer.remaining_time` | Number (sec) | Contests-Page | `Module/Contest.ts` | `Contest.collectAndSchedule()` | Restzeit aktueller Contest |
| `unsafeWindow.daily_goals_list` | Array (KKDailyGoal) | DailyGoals-Tab | `Module/DailyGoals.ts` | `DailyGoals.parse()` | Iteration ueber Daily-Goal-Tiers |
| `unsafeWindow.event_data` | Objekt (HHEventData) | Event-Page (`pagesIDEvent`) | `Module/Events/EventModule.ts` | `EventModule.run()`, `displayPrioInDailyMissionGirl()` | Event-Girls und Event-Metadaten |
| `unsafeWindow.event_data.girls` | Array (KKEventGirl) | Event-Page | `Module/Events/EventModule.ts` | `displayPrioInDailyMissionGirl()` | Liste der Event-Girls fuer Prioritaeten-UI |
| `unsafeWindow.current_event` | Objekt (HHEventData) | Event-Page (Fallback) | `Module/Events/EventModule.ts` | `EventModule.run()` | Fallback wenn `event_data` nicht gesetzt |
| `unsafeWindow.season_sec_untill_event_end` | Number (sec) | Season/SeasonArena-Page | `Module/Events/Season.ts` | `Season.getRemainingTime()` | Restzeit Season-Event |
| `unsafeWindow.hero_data` | Objekt | SeasonArena-Page | `Module/Events/Season.ts` | `Season.parseSeasonOpponents()` | Hero-Block fuer Arena-Reload |
| `unsafeWindow.opponents` | Array | SeasonArena-Page | `Module/Events/Season.ts` | `Season.parseSeasonOpponents()` | Aktuelle Arena-Gegner-Liste |
| `unsafeWindow.seasonal_event_active` | Boolean | jede Page (?) | `Module/Events/Seasonal.ts` | `Seasonal.isActiveEvent()` | Indikator: Seasonal-Event laeuft |
| `unsafeWindow.seasonal_time_remaining` | Number (sec) | jede Page (?) | `Module/Events/Seasonal.ts` | `Seasonal.isActiveEvent()` | Restzeit Seasonal |
| `unsafeWindow.mega_event_active` | Boolean | jede Page (?) | `Module/Events/Seasonal.ts` | `Seasonal.isActiveEvent()` | Indikator: Mega-Event laeuft |
| `unsafeWindow.mega_event_time_remaining` | Number (sec) | jede Page (?) | `Module/Events/Seasonal.ts` | `Seasonal.isActiveEvent()` | Restzeit Mega-Event |
| `unsafeWindow.mega_event_data` (via `getHHVars`) | Objekt mit `cards` | Seasonal-Page | `Module/Events/Seasonal.ts` | `Seasonal.run()` (`getHHVars(\"mega_event_data.cards\")`) | Owned Mega-Event-Karten |
| `unsafeWindow.current_tier_number` | Number | League-Page | `Module/League.ts` | `League.getLeagueCurrentLevel()` | Aktuelles League-Tier |
| `unsafeWindow.opponents_list` (typed `KKPentaDrillOpponents[]`) | Array | PentaDrill-Page | `Module/PentaDrill.ts` | `PentaDrill.run()` | Penta-Drill-Gegner-Liste |
| `unsafeWindow.penta_drill_data.cycle_data.seconds_until_event_end` | Number (sec) | PentaDrill-Page | `Module/PentaDrill.ts` | `PentaDrill.getRemainingTime()` | Restzeit Penta-Drill-Event |
| `unsafeWindow.girl_squad` | Array (Labyrinth-Squad-Girls mit `remaining_ego_percent`) | Labyrinth-Pre-Battle / Labyrinth-Page | `Module/Labyrinth.ts` | `Labyrinth.chooseOpponent()` | Erkennt verletzte Squad-Girls |
| `unsafeWindow.teams_data` | Array (Teams) | Battle-Teams-Page (`pagesIDBattleTeams`) | `Module/TeamModule.ts` | `TeamModule.getSelectedGirlsId()`, `getSelectedGirls()` | Team-Definitionen (girls_ids, girls) |
| `unsafeWindow.pop_list` | Boolean | Activities-Tab `pop` (Powerplace-Liste sichtbar) | `Helper/PageHelper.ts` | `getPage()` | Erkennt: sind wir auf der Pop-Listen-Page |
| `unsafeWindow.pop_index` | Number | Activities-Tab `pop` (Pop selektiert) | `Helper/PageHelper.ts` | `getPage()` | Aktuell selektierte Pop-Instanz |
| `unsafeWindow.harem.preselectedGirlId` (nur Kommentar-Hint) | Number | Harem-Page | `Module/harem/Harem.ts` | `fillCurrentGirlItem()` etc. | Im Code via `$('#harem_right .opened').attr('girl')` ersatzweise gelesen, der Kommentar dokumentiert die zugehoerige unsafeWindow-Variable |
| `unsafeWindow.girl` | Objekt (KKHaremGirl) | GirlPage (`pagesIDGirlPage`) | `Module/harem/HaremGirl.ts` | `HaremGirl.getCurrentGirl()` | Aktuell angezeigtes Harem-Girl |
| `unsafeWindow.id_girl` | Number/String | GirlPage | `Module/harem/HaremGirl.ts` | `HaremGirl` (Affection-Page-Back) | ID des Girls (fuer Navigation zurueck) |
| `unsafeWindow.player_gems_amount` | Map `{element: {amount: number}}` | GirlPage | `Module/harem/HaremGirl.ts` | `awakGirl()`, `canAwakGirl()`, `canGiftGirl()` | Gem-Bestand pro Element fuer Awakening-Pruefung |
| `unsafeWindow.Hero.currencies.soft_currency` (auskommentiert) | Number | jede Page | `Module/Market.ts` (Kommentar) | - | Veralteter Direktzugriff (heute via `Hero.update`) |

Zusaetzlich werden in `src/index.ts` (Window-Interface) folgende Properties typed - manche werden aktuell noch nicht ausgelesen, sind aber Teil der Bridge-Vertraege:
`championData`, `Collect`, `HHTimers`, `league_tag`, `server_now_ts`, `love_raids`.

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
| `availableGirls` | `unsafeWindow.availableGirls` | Map aller Girls (Variante 1) | `Module/TeamModule.ts`, `Module/harem/Harem.ts` | Girl-Daten-Quelle |
| `girlsDataList` | `unsafeWindow.girlsDataList` | Map aller Girls (Variante 2) | `Module/harem/Harem.ts` | Girl-Daten-Quelle |
| `girls_data_list` | `unsafeWindow.girls_data_list` | Map aller Girls (Variante 3 - PSH) | `Module/harem/Harem.ts` | Girl-Daten-Quelle (psh-Build) |
| `shared.GirlSalaryManager.girlsMap` | `unsafeWindow.shared.GirlSalaryManager.girlsMap` | Live-Girl-Map des Salary-Managers | `Module/harem/Harem.ts` | Salary-Manager-Bridge |
| `shared.GirlSalaryManager.girlsListSec` | `unsafeWindow.shared.GirlSalaryManager.girlsListSec` | Sekundaere Girl-Liste | `Module/harem/Harem.ts` | Salary-Manager-Bridge |
| `salary_collect` | `unsafeWindow.salary_collect` | Aufsummierte Salary | `Module/harem/HaremSalary.ts` | Salary-Tag |
| `current_event.event_data.puzzle_pieces` | `unsafeWindow.current_event.event_data.puzzle_pieces` | LivelyScene-Puzzle-Pieces | `Module/Events/LivelyScene.ts` | LivelyScene-Loesung |
| `mega_event_data.cards` | `unsafeWindow.mega_event_data.cards` | Owned Mega-Event-Karten | `Module/Events/Seasonal.ts` | Seasonal-Event-Status |

Hinweis: `getHHVars` liefert bei Nichtexistenz `null` und loggt (auf Wunsch unterdrueckbar via 2. Parameter `logging=false`). Beispiele dafuer im Code: `getHHVars("availableGirls", false)`, `getHHVars("Chat_vars.CLUB_INFO.id_club", false)`, `getHHVars("girlsDataList", false)`, `getHHVars("girls_data_list", false)`.


## 3. AJAX-Actions (Request-seitig)

Alle `action: "..."`-Strings, die der Skript-Code aktiv versendet.
Die meisten Calls laufen ueber `getHHAjax()` (delegiert an `shared.general.hh_ajax`); zwei laufen direkt ueber jQuery `$.ajax` (notiert).

> **Wichtig:** In `Service/AutoLoopActions.ts` werden Strings wie `action: "loveraid"`, `"contest"`, `"mission"`, `"champion"`, `"clubChampion"`, `"seasonal"`, `"bundle"`, `"dailyGoals"`, `"labyrinth"` NICHT als AJAX-Actions versendet, sondern sind interne Handler-Tags fuer `runStandardHandler` (-> `ctx.lastActionPerformed`-Sequenzlogik). Sie werden hier deshalb nicht gelistet.

### 3.1 Calls via `getHHAjax()`

| action-String | Weitere Parameter | Datei | Symbol/Funktion | Wofuer |
|---|---|---|---|---|
| `hero_update_stats` | `carac: "carac1"|"carac2"|"carac3"`, `nb: <mult>` (1/10/30/60) | `Helper/HeroHelper.ts` | `doStatUpgrades()` | Stat-Punkt-Upgrade |
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

### 3.2 Calls via jQuery `$.ajax` direkt

| action-String | Weitere Parameter | Datei | Symbol/Funktion | Wofuer |
|---|---|---|---|---|
| `girl_equipment_equip` | `id_girl`, `id_girl_armor`, `sort_by: "rarity"`, `sorting_order: "asc"` | `Module/harem/HaremGirl.ts` | `HaremGirl.equipItem()` | Einzelnes Equipment auf Girl (umgeht `getHHAjax()`-Bridge) |

Hinweis: viele weitere Game-Actions werden vom Spiel selbst gesendet (z.B. `do_battles_trolls`, `do_battles_seasons`, `start` (TempPlaceOfPower)). Diese werden in Sektion 4 ueber `onAjaxResponse`-Hooks abgegriffen.


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

| jQuery-Selector | Inhalt-Schema (Felder) | Page | Datei | Symbol |
|---|---|---|---|---|
| `#shops div.armor.merchant-inventory-item .slot` | `{quantity, item:{id_item, type:"armor", identifier, rarity, name_add, subtype, carac1..3, ...}}` | Shop (`pagesIDShop`) | `Module/Shop.ts` | `Shop.collectShopFromMarket()` |
| `#shops div.booster.merchant-inventory-item .slot` | `{quantity, item:{id_item, type:"booster", identifier, rarity, value, name, ...}}` | Shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` |
| `#shops div.gift.merchant-inventory-item .slot` | `{quantity, item:{id_item, type:"gift", value, ...}}` | Shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` |
| `#shops div.potion.merchant-inventory-item .slot` | `{quantity, item:{id_item, type:"potion", value, ...}}` | Shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` |
| `#shops div.gift.player-inventory-content .slot` | `{quantity, item:{value, ...}}` | Shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` (HaveAff-Akkumulation) |
| `#shops div.potion.player-inventory-content .slot` | `{quantity, item:{value, ...}}` | Shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` (HaveExp-Akkumulation) |
| `#shops div.booster.player-inventory-content .slot` | `{quantity, item:{id_item, identifier, name, rarity}}` | Shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` (HaveBooster + BoosterIdMap) |
| `#equiped .booster .slot:not(.empty):not(.mythic)` (jQ `.data('d')`) | Normal-Booster-Slot (mit `expiration`) | Shop | `Module/Booster.ts` | `Booster.collectBoostersFromMarket()` |
| `#equiped .booster .slot:not(.empty).mythic` (jQ `.data('d')`) | Mythic-Booster-Slot (mit `usages_remaining`, `lifetime`) | Shop | `Module/Booster.ts` | `Booster.collectBoostersFromMarket()` |
| `#player-inventory.armor .slot:not(.empty)[data-d*='"rarity":"mythic"']` (Selector-Inhalts-Match) | Filter ueber Substring-Match in `data-d` | Shop | `Module/Shop.ts` | `Shop.moduleShopActions()` |
| `[data-d*='"name_add":<X>']` (dyn. Filter) | Filter nach Stat | Shop | `Module/Shop.ts` | `Shop.moduleShopActions()` / `setSlotFilter()` |
| `[data-d*='"subtype":<X>']` (dyn. Filter) | Filter nach Item-Subtyp | Shop | `Module/Shop.ts` | `Shop.moduleShopActions()` / `setSlotFilter()` |
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
| `.data-column[column="power"] .matchRating-expected .matchRating-value` `.text()` | Erwartete Power | Leaderboard | `Module/League.ts` | (auskommentierter `getPowerOrPoints`-Block) |
| `.data-column[column="power"]` `.text()` (mit `parsePrice`) | Plain-Power | Leaderboard | `Module/League.ts` | (auskommentierter Block) |
| `.data-list .data-row.body-row a` `.length` | Noch zu kaempfende Gegner | Leaderboard | `Module/League.ts` | `parseOpponents()` Logging |
| `.data-list .data-row.body-row.player-row .data-column[column="place"]` `.text()` | Eigener Rank | Leaderboard | `Module/League.ts` | League-Stop-Logic |
| `.data-list .data-row.body-row.player-row .data-column[column="player_league_points"]` `.text()` | Eigener Score | Leaderboard | `Module/League.ts` | League-Stop-Logic |

### 6.6 Pantheon / Champion / Club Champion

| Selector | Was extrahiert | Page | Datei | Symbol |
|---|---|---|---|---|
| `#pre-battle .battle-buttons .green_button_L.battle-action-button.pantheon-single-battle-button[data-pantheon-id='<id>']` | Pantheon-Single-Battle-Button | PantheonPreBattle | `Module/Pantheon.ts` | `Pantheon.run()` |
| `.champions-over__champion-info.champions-animation .champion-pose` | Champion-Pose-Bilder fuer `getPoses()` | ChampionsPage / ChampionsMap | `Module/Champion.ts` | `Champion.run()` (Fallback wenn `championData.champion.poses` fehlt) |
| `div.club-champion-members-challenges .player-row .data-column:nth-of-type(3)` | Tickets-used pro Club-Member | ClubChampion | `Module/ClubChampion.ts` | `ClubChampion.run()` |

### 6.7 Pachinko

| Selector | Was extrahiert | Page | Datei | Symbol |
|---|---|---|---|---|
| `#playzone-replace-info button[data-free="true"].blue_button_L` | Free-Pachinko-Button | Pachinko | `Module/Pachinko.ts` | `Pachinko.selectPachinko()` |
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
| `#girls_list .g1 .nav_placement span:not([contenteditable])` | Shop-Girl-Count | Shop | `config/HHEnvVariables.ts` | Konstante `shopGirlCountRequest` |
| `#girls_list .g1 .nav_placement span[contenteditable]` | Aktueller Shop-Girl-Index | Shop | `config/HHEnvVariables.ts` | Konstante `shopGirlCurrentRequest` |

### 6.12 Sonstige UI-Lookups (Timer, Reward-Banner, etc.)

| Selector | Was extrahiert | Page | Datei | Symbol |
|---|---|---|---|---|
| `#contains_all header .currency .daily-reward-notif` | Daily-Reward-Notification | jede Page | `config/HHEnvVariables.ts` | Konstante `dailyRewardNotifRequest` |
| `#edit-team-page` (id-Selector) | EditTeam-Panel-Container | EditTeam | `config/HHEnvVariables.ts` | Konstante `IDpanelEditTeam` |
| `#claim-all:not([disabled]):visible:not([style*='visibility: hidden;'])` | 'Claim All'-Button | beliebig | `config/HHEnvVariables.ts` | Konstante `selectorClaimAllRewards` |
| `[PoVPoG-Slot].attr('data-time-stamp')` | Timestamp eines PoV/PoG-Tier-Slots | PoV / PoG | `config/HHEnvVariables.ts` | Konstante `PoVPoGTimestampAttributeName` |
| `[girl-tile].attr('data-new-girl-tooltip')` | New-Girl-Tooltip-Daten | beliebige Page mit Girl-Slots | `config/HHEnvVariables.ts` | Konstante `girlToolTipData` |
| `:not([style*="display:none"]):not([style*="display: none"])` | Filter 'nicht versteckt' (generisches Suffix) | jede Page | `config/HHEnvVariables.ts` | Konstante `selectorFilterNotDisplayNone` |

## 7. localStorage / Storage-Keys

getStoredValue / getStoredJSON lesen, setStoredValue schreibt, deleteStoredValue loescht.
Alle Keys sind mit HHStoredVarPrefixKey (Default: HHAuto_) praefixiert; das Praefix wird in den Tabellen unten weggelassen.
Wichtig: Nicht in HHStoredVars.ts registrierte Keys werden lautlos verworfen.

Storage-Backing (siehe HHStoredVars.ts): localStorage direkt, sessionStorage direkt, oder Storage() (gating ueber SK.settPerTab -> sessionStorage, sonst localStorage). Settings sind in der Regel Storage(), Temp-Vars meist sessionStorage.

Code-Referenzen unten sind Datei-Pfade ohne src/-Praefix. Lange Listen auf 4 Eintraege gekuerzt mit +N more.

### 7.1 SK (Settings) - 179 Keys

| Key | Storage-Name | Inhalt / Zweck | Wo geschrieben (set) | Wo gelesen (get) | Wo geloescht (delete) |
|---|---|---|---|---|---|
| SK.master | Setting_master | (no description) | Helper/PageHelper.ts, Service/InfoService.ts | Helper/HHMenuHelper.ts, Service/AutoLoop.ts, Service/InfoService.ts, Service/Scheduler.ts | - |
| SK.settPerTab | Setting_settPerTab | (no description) | - | Helper/StorageHelper.ts | - |
| SK.spendKobans0 | Setting_spendKobans0 | (no description) | - | - | - |
| SK.autoTrollBattle | Setting_autoTrollBattle | (no description) | Module/Troll.ts, Service/AutoLoopActions.ts | Module/Troll.ts, Service/AutoLoopActions.ts, Service/InfoService.ts, Service/ParanoiaService.ts | - |
| SK.autoTrollThreshold | Setting_autoTrollThreshold | (no description) | - | Module/Troll.ts, Service/AutoLoopActions.ts | - |
| SK.autoTrollRunThreshold | Setting_autoTrollRunThreshold | (no description) | - | Module/Troll.ts, Service/AutoLoopActions.ts | - |
| SK.autoTrollSelectedIndex | Setting_autoTrollSelectedIndex | (no description) | - | Module/Troll.ts | - |
| SK.autoTrollMythicByPassParanoia | Setting_autoTrollMythicByPassParanoia | (no description) | - | Service/ParanoiaService.ts | - |
| SK.autoTrollMythicByPassThreshold | Setting_autoTrollMythicByPassThreshold | (no description) | - | - | - |
| SK.eventTrollOrder | Setting_eventTrollOrder | (no description) | - | Module/Events/EventModule.ts, Module/Events/MythicEvent.ts, Module/Events/PlusEvents.ts | - |
| SK.useX10Fights | Setting_useX10Fights | (no description) | - | Module/Troll.ts | - |
| SK.useX10FightsAllowNormalEvent | Setting_useX10FightsAllowNormalEvent | (no description) | - | Module/Troll.ts | - |
| SK.useX50Fights | Setting_useX50Fights | (no description) | - | Module/Troll.ts | - |
| SK.useX50FightsAllowNormalEvent | Setting_useX50FightsAllowNormalEvent | (no description) | - | Module/Troll.ts | - |
| SK.minShardsX10 | Setting_minShardsX10 | (no description) | - | Module/Troll.ts | - |
| SK.minShardsX50 | Setting_minShardsX50 | (no description) | - | Module/Troll.ts | - |
| SK.sandalwoodMinShardsThreshold | Setting_sandalwoodMinShardsThreshold | (no description) | - | Module/Booster.ts | - |
| SK.kobanBank | Setting_kobanBank | (no description) | - | Module/Events/Season.ts, Module/Market.ts, Module/Troll.ts | - |
| SK.buyCombat | Setting_buyCombat | (no description) | - | Module/Troll.ts | - |
| SK.buyCombTimer | Setting_buyCombTimer | (no description) | - | Module/Troll.ts | - |
| SK.buyMythicCombat | Setting_buyMythicCombat | (no description) | - | Module/Troll.ts | - |
| SK.buyMythicCombTimer | Setting_buyMythicCombTimer | (no description) | - | Module/Troll.ts | - |
| SK.buyLoveRaidCombat | Setting_buyLoveRaidCombat | (no description) | - | Module/Troll.ts | - |
| SK.autoBuyTrollNumber | Setting_autoBuyTrollNumber | (no description) | - | Module/Troll.ts | - |
| SK.autoBuyMythicTrollNumber | Setting_autoBuyMythicTrollNumber | (no description) | - | Module/Troll.ts | - |
| SK.autoBuyLoveRaidTrollNumber | Setting_autoBuyLoveRaidTrollNumber | (no description) | - | Module/Troll.ts | - |
| SK.autoChamps | Setting_autoChamps | (no description) | - | Module/ClubChampion.ts, Service/AutoLoopActions.ts, Service/AutoLoopPageHandlers.ts, Service/InfoService.ts | - |
| SK.autoChampsFilter | Setting_autoChampsFilter | (no description) | - | Module/Champion.ts | - |
| SK.autoChampsForceStart | Setting_autoChampsForceStart | (no description) | - | Module/Champion.ts | - |
| SK.autoChampsForceStartEventGirl | Setting_autoChampsForceStartEventGirl | (no description) | - | Module/Champion.ts | - |
| SK.autoChampsGirlThreshold | Setting_autoChampsGirlThreshold | (no description) | - | Module/Champion.ts | - |
| SK.autoChampsTeamLoop | Setting_autoChampsTeamLoop | (no description) | - | Module/Champion.ts | - |
| SK.autoChampsTeamKeepSecondLine | Setting_autoChampsTeamKeepSecondLine | (no description) | - | Module/Champion.ts | - |
| SK.autoChampsUseEne | Setting_autoChampsUseEne | (no description) | - | Module/Champion.ts, Service/AutoLoopActions.ts | - |
| SK.autoChampAlignTimer | Setting_autoChampAlignTimer | (no description) | - | Module/Champion.ts, Module/ClubChampion.ts | - |
| SK.autoBuildChampsTeam | Setting_autoBuildChampsTeam | (no description) | - | Module/Champion.ts, Module/ClubChampion.ts | - |
| SK.autoClubChamp | Setting_autoClubChamp | (no description) | - | Module/Champion.ts, Module/ClubChampion.ts, Service/AutoLoopActions.ts, Service/InfoService.ts | - |
| SK.autoClubChampMax | Setting_autoClubChampMax | (no description) | - | Module/ClubChampion.ts | - |
| SK.autoClubForceStart | Setting_autoClubForceStart | (no description) | - | Module/ClubChampion.ts | - |
| SK.autoLeagues | Setting_autoLeagues | (no description) | - | Module/GenericBattle.ts, Module/League.ts, Service/InfoService.ts | - |
| SK.autoLeaguesCollect | Setting_autoLeaguesCollect | (no description) | - | Module/League.ts | - |
| SK.autoLeaguesThreshold | Setting_autoLeaguesThreshold | (no description) | - | Module/League.ts | - |
| SK.autoLeaguesSecurityThreshold | Setting_autoLeaguesSecurityThreshold | (no description) | - | Module/League.ts | - |
| SK.autoLeaguesRunThreshold | Setting_autoLeaguesRunThreshold | (no description) | - | Module/League.ts | - |
| SK.autoLeaguesBoostedOnly | Setting_autoLeaguesBoostedOnly | (no description) | - | Module/Booster.ts, Module/League.ts | - |
| SK.autoLeaguesForceOneFight | Setting_autoLeaguesForceOneFight | (no description) | - | Module/League.ts | - |
| SK.autoLeaguesSelectedIndex | Setting_autoLeaguesSelectedIndex | (no description) | - | Module/League.ts | - |
| SK.autoLeaguesSortIndex | Setting_autoLeaguesSortIndex | (no description) | - | Module/League.ts, Service/StartService.ts | - |
| SK.autoLeaguesAllowWinCurrent | Setting_autoLeaguesAllowWinCurrent | (no description) | - | Module/League.ts | - |
| SK.leagueListDisplayPowerCalc | Setting_leagueListDisplayPowerCalc | (no description) | - | Module/League.ts, Service/StartService.ts | - |
| SK.autoSeason | Setting_autoSeason | (no description) | - | Module/GenericBattle.ts, Service/AutoLoopActions.ts, Service/InfoService.ts, Service/ParanoiaService.ts | - |
| SK.autoSeasonThreshold | Setting_autoSeasonThreshold | (no description) | - | Module/Events/Season.ts | - |
| SK.autoSeasonRunThreshold | Setting_autoSeasonRunThreshold | (no description) | - | Module/Events/Season.ts | - |
| SK.autoSeasonBoostedOnly | Setting_autoSeasonBoostedOnly | (no description) | - | Module/Booster.ts, Module/Events/Season.ts | - |
| SK.autoSeasonCollect | Setting_autoSeasonCollect | (no description) | - | Module/Events/Season.ts, Service/AutoLoopActions.ts | - |
| SK.autoSeasonCollectAll | Setting_autoSeasonCollectAll | (no description) | - | Module/Events/Season.ts, Service/AutoLoopActions.ts | - |
| SK.autoSeasonCollectablesList | Setting_autoSeasonCollectablesList | (no description) | - | Module/Events/Season.ts | - |
| SK.autoSeasonIgnoreNoGirls | Setting_autoSeasonIgnoreNoGirls | (no description) | - | Module/Events/Season.ts, Service/ParanoiaService.ts | - |
| SK.autoSeasonPassReds | Setting_autoSeasonPassReds | (no description) | - | Module/Events/Season.ts | - |
| SK.autoSeasonSkipLowMojo | Setting_autoSeasonSkipLowMojo | (no description) | - | Module/Events/Season.ts | - |
| SK.seasonDisplayPowerCalc | Setting_seasonDisplayPowerCalc | (no description) | - | Module/Events/Season.ts | - |
| SK.autoSeasonMaxTier | Setting_autoSeasonMaxTier | (no description) | - | Module/Events/Season.ts | - |
| SK.autoSeasonMaxTierNb | Setting_autoSeasonMaxTierNb | (no description) | - | Module/Events/Season.ts | - |
| SK.autoPantheon | Setting_autoPantheon | (no description) | Module/Pantheon.ts | Module/GenericBattle.ts, Service/AutoLoopActions.ts, Service/InfoService.ts, Service/ParanoiaService.ts | - |
| SK.autoPantheonThreshold | Setting_autoPantheonThreshold | (no description) | - | Module/Pantheon.ts | - |
| SK.autoPantheonRunThreshold | Setting_autoPantheonRunThreshold | (no description) | - | Module/Pantheon.ts | - |
| SK.autoPantheonBoostedOnly | Setting_autoPantheonBoostedOnly | (no description) | - | Module/Booster.ts, Module/Pantheon.ts | - |
| SK.autoPentaDrill | Setting_autoPentaDrill | (no description) | - | Module/GenericBattle.ts, Service/AutoLoopActions.ts, Service/InfoService.ts | - |
| SK.autoPentaDrillThreshold | Setting_autoPentaDrillThreshold | (no description) | - | Module/PentaDrill.ts | - |
| SK.autoPentaDrillRunThreshold | Setting_autoPentaDrillRunThreshold | (no description) | - | Module/PentaDrill.ts | - |
| SK.autoPentaDrillBoostedOnly | Setting_autoPentaDrillBoostedOnly | (no description) | - | Module/PentaDrill.ts | - |
| SK.autoPentaDrillCollect | Setting_autoPentaDrillCollect | (no description) | - | Module/PentaDrill.ts, Service/AutoLoopActions.ts | - |
| SK.autoPentaDrillCollectAll | Setting_autoPentaDrillCollectAll | (no description) | - | Module/PentaDrill.ts, Service/AutoLoopActions.ts | - |
| SK.autoPentaDrillCollectablesList | Setting_autoPentaDrillCollectablesList | (no description) | - | Module/PentaDrill.ts | - |
| SK.autoQuest | Setting_autoQuest | (no description) | Module/Troll.ts, Service/AutoLoopActions.ts | Module/Quest.ts, Service/AutoLoopActions.ts, Service/ParanoiaService.ts | - |
| SK.autoQuestThreshold | Setting_autoQuestThreshold | (no description) | - | Service/AutoLoopActions.ts | - |
| SK.autoSideQuest | Setting_autoSideQuest | (no description) | Service/AutoLoopActions.ts | Module/Quest.ts, Service/AutoLoopActions.ts, Service/ParanoiaService.ts | - |
| SK.autoMission | Setting_autoMission | (no description) | - | Service/AutoLoopActions.ts, Service/InfoService.ts | - |
| SK.autoMissionCollect | Setting_autoMissionCollect | (no description) | - | Module/Missions.ts | - |
| SK.autoMissionKFirst | Setting_autoMissionKFirst | (no description) | - | Module/Missions.ts | - |
| SK.autoLabyrinth | Setting_autoLabyrinth | (no description) | Module/LabyrinthAuto.ts | Module/GenericBattle.ts, Service/AutoLoopActions.ts, Service/InfoService.ts | - |
| SK.autoLabyHard | Setting_autoLabyHard | (no description) | - | Module/Labyrinth.ts | - |
| SK.autoLabySweep | Setting_autoLabySweep | (no description) | - | Module/LabyrinthAuto.ts | - |
| SK.autoLabyDifficultyIndex | Setting_autoLabyDifficultyIndex | (no description) | - | Module/LabyrinthAuto.ts | - |
| SK.autoLabyCustomTeamBuilder | Setting_autoLabyCustomTeamBuilder | (no description) | - | Module/Labyrinth.ts, Module/LabyrinthAuto.ts | - |
| SK.autoPowerPlaces | Setting_autoPowerPlaces | (no description) | - | Module/PlaceOfPower.ts, Service/InfoService.ts | - |
| SK.autoPowerPlacesAll | Setting_autoPowerPlacesAll | (no description) | - | Module/PlaceOfPower.ts | - |
| SK.autoPowerPlacesIndexFilter | Setting_autoPowerPlacesIndexFilter | (no description) | Module/PlaceOfPower.ts | Module/PlaceOfPower.ts, Service/AutoLoopActions.ts | - |
| SK.autoPowerPlacesInverted | Setting_autoPowerPlacesInverted | (no description) | - | Module/PlaceOfPower.ts | - |
| SK.autoPowerPlacesPrecision | Setting_autoPowerPlacesPrecision | (no description) | - | Module/PlaceOfPower.ts | - |
| SK.autoPowerPlacesWaitMax | Setting_autoPowerPlacesWaitMax | (no description) | - | Module/PlaceOfPower.ts | - |
| SK.autoAff | Setting_autoAff | (no description) | - | Module/Market.ts | - |
| SK.autoAffW | Setting_autoAffW | (no description) | - | Module/Market.ts | - |
| SK.autoExp | Setting_autoExp | (no description) | - | Module/Market.ts | - |
| SK.autoExpW | Setting_autoExpW | (no description) | - | Module/Market.ts | - |
| SK.maxAff | Setting_maxAff | (no description) | - | Module/Market.ts | - |
| SK.maxExp | Setting_maxExp | (no description) | - | Module/Market.ts | - |
| SK.maxBooster | Setting_maxBooster | (no description) | - | Module/Market.ts | - |
| SK.autoBuyBoosters | Setting_autoBuyBoosters | (no description) | - | Module/Market.ts | - |
| SK.autoBuyBoostersFilter | Setting_autoBuyBoostersFilter | (no description) | - | Module/Market.ts | - |
| SK.autoEquipBoosters | Setting_autoEquipBoosters | (no description) | - | Module/Booster.ts, Service/AutoLoopActions.ts, Service/InfoService.ts | - |
| SK.autoEquipBoostersSlots | Setting_autoEquipBoostersSlots | (no description) | - | Module/Booster.ts | - |
| SK.updateMarket | Setting_updateMarket | (no description) | - | Module/Shop.ts, Service/InfoService.ts | - |
| SK.showMarketTools | Setting_showMarketTools | (no description) | - | Service/AutoLoopPageHandlers.ts | - |
| SK.autoSalary | Setting_autoSalary | (no description) | - | Service/AutoLoopActions.ts, Service/InfoService.ts | - |
| SK.autoSalaryMinSalary | Setting_autoSalaryMinSalary | (no description) | - | Module/harem/HaremSalary.ts | - |
| SK.autoStats | Setting_autoStats | (no description) | - | Helper/HeroHelper.ts | - |
| SK.autoStatsSwitch | Setting_autoStatsSwitch | (no description) | - | Service/StartService.ts | - |
| SK.hideOwnedGirls | Setting_hideOwnedGirls | (no description) | - | Module/Events/EventModule.ts | - |
| SK.showHaremAvatarMissingGirls | Setting_showHaremAvatarMissingGirls | (no description) | - | Module/harem/Harem.ts | - |
| SK.showHaremTools | Setting_showHaremTools | (no description) | - | Module/harem/Harem.ts, Module/harem/HaremGirl.ts | - |
| SK.showHaremSkillsButtons | Setting_showHaremSkillsButtons | (no description) | - | Module/harem/HaremGirl.ts | - |
| SK.autoFreePachinko | Setting_autoFreePachinko | (no description) | - | Service/AutoLoopActions.ts, Service/InfoService.ts | - |
| SK.autoDailyGoals | Setting_autoDailyGoals | (no description) | - | Module/DailyGoals.ts | - |
| SK.autoDailyGoalsCollect | Setting_autoDailyGoalsCollect | (no description) | - | Module/DailyGoals.ts, Service/AutoLoopActions.ts | - |
| SK.autoDailyGoalsCollectablesList | Setting_autoDailyGoalsCollectablesList | (no description) | - | Module/DailyGoals.ts | - |
| SK.autoContest | Setting_autoContest | (no description) | - | Service/AutoLoopActions.ts, Service/InfoService.ts | - |
| SK.waitforContest | Setting_waitforContest | (no description) | - | Helper/TimeHelper.ts, Module/Contest.ts, Service/AutoLoop.ts, Service/InfoService.ts | - |
| SK.safeSecondsForContest | Setting_safeSecondsForContest | (no description) | - | Helper/TimeHelper.ts | - |
| SK.paranoia | Setting_paranoia | (no description) | - | Module/Shop.ts, Service/AutoLoop.ts, Service/AutoLoopActions.ts, Service/InfoService.ts | - |
| SK.paranoiaSettings | Setting_paranoiaSettings | (no description) | - | Service/ParanoiaService.ts | - |
| SK.paranoiaSpendsBefore | Setting_paranoiaSpendsBefore | (no description) | - | Service/ParanoiaService.ts | - |
| SK.plusGirlSkins | Setting_plusGirlSkins | (no description) | - | Module/Events/LoveRaidManager.ts | - |
| SK.plusEvent | Setting_plusEvent | (no description) | - | Module/Booster.ts, Module/Events/EventModule.ts, Module/GenericBattle.ts, +3 more | - |
| SK.plusEventMythic | Setting_plusEventMythic | (no description) | - | Module/Booster.ts, Module/Events/EventModule.ts, Module/GenericBattle.ts, +4 more | - |
| SK.plusEventSandalWood | Setting_plusEventSandalWood | (no description) | - | Module/Booster.ts | - |
| SK.plusEventMythicSandalWood | Setting_plusEventMythicSandalWood | (no description) | - | Module/Booster.ts | - |
| SK.plusLoveRaid | Setting_plusLoveRaid | (no description) | - | Module/Events/LoveRaidManager.ts | - |
| SK.autoTrollLoveRaidByPassThreshold | Setting_autoTrollLoveRaidByPassThreshold | (no description) | - | Module/Troll.ts | - |
| SK.plusEventLoveRaidSandalWood | Setting_plusEventLoveRaidSandalWood | (no description) | - | Module/Booster.ts | - |
| SK.bossBangEvent | Setting_bossBangEvent | (no description) | Module/Events/BossBang.ts | Module/Events/EventModule.ts, Service/AutoLoopActions.ts, Service/AutoLoopPageHandlers.ts | - |
| SK.bossBangMinTeam | Setting_bossBangMinTeam | (no description) | - | Module/Events/BossBang.ts | - |
| SK.collectEventChest | Setting_collectEventChest | (no description) | - | Module/Events/EventModule.ts | - |
| SK.autoSeasonalBuyFreeCard | Setting_autoSeasonalBuyFreeCard | (no description) | - | Service/AutoLoopActions.ts | - |
| SK.autoSeasonalEventCollect | Setting_autoSeasonalEventCollect | (no description) | Module/Events/EventModule.ts | Module/Events/EventModule.ts, Module/Events/Seasonal.ts, Service/AutoLoopActions.ts | - |
| SK.autoSeasonalEventCollectAll | Setting_autoSeasonalEventCollectAll | (no description) | Module/Events/EventModule.ts | Module/Events/EventModule.ts, Module/Events/Seasonal.ts, Service/AutoLoopActions.ts | - |
| SK.autoSeasonalEventCollectablesList | Setting_autoSeasonalEventCollectablesList | (no description) | - | Module/Events/Seasonal.ts | - |
| SK.autodpEventCollect | Setting_autodpEventCollect | (no description) | Module/Events/EventModule.ts | Module/Events/DoublePenetration.ts, Module/Events/EventModule.ts | - |
| SK.autodpEventCollectAll | Setting_autodpEventCollectAll | (no description) | - | Module/Events/DoublePenetration.ts | - |
| SK.autodpEventCollectablesList | Setting_autodpEventCollectablesList | (no description) | - | Module/Events/DoublePenetration.ts | - |
| SK.autoLivelySceneEventCollect | Setting_autoLivelySceneEventCollect | (no description) | Module/Events/EventModule.ts | Module/Events/EventModule.ts, Module/Events/LivelyScene.ts | - |
| SK.autoLivelySceneEventCollectAll | Setting_autoLivelySceneEventCollectAll | (no description) | - | Module/Events/LivelyScene.ts | - |
| SK.autoLivelySceneEventCollectablesList | Setting_autoLivelySceneEventCollectablesList | (no description) | - | Module/Events/LivelyScene.ts | - |
| SK.autoPoACollect | Setting_autoPoACollect | (no description) | - | Module/Events/PathOfAttraction.ts | - |
| SK.autoPoACollectAll | Setting_autoPoACollectAll | (no description) | - | Module/Events/PathOfAttraction.ts | - |
| SK.autoPoACollectablesList | Setting_autoPoACollectablesList | (no description) | - | Module/Events/PathOfAttraction.ts | - |
| SK.autoPoGCollect | Setting_autoPoGCollect | (no description) | Module/Events/EventModule.ts | Module/Events/EventModule.ts, Module/Events/PathOfGlory.ts, Service/AutoLoopActions.ts, Service/InfoService.ts | - |
| SK.autoPoGCollectAll | Setting_autoPoGCollectAll | (no description) | Module/Events/EventModule.ts | Module/Events/EventModule.ts, Module/Events/PathOfGlory.ts, Service/AutoLoopActions.ts | - |
| SK.autoPoGCollectablesList | Setting_autoPoGCollectablesList | (no description) | - | Module/Events/PathOfGlory.ts | - |
| SK.autoPoVCollect | Setting_autoPoVCollect | (no description) | Module/Events/EventModule.ts | Module/Events/EventModule.ts, Module/Events/PathOfValue.ts, Service/AutoLoopActions.ts, Service/InfoService.ts | - |
| SK.autoPoVCollectAll | Setting_autoPoVCollectAll | (no description) | Module/Events/EventModule.ts | Module/Events/EventModule.ts, Module/Events/PathOfValue.ts, Service/AutoLoopActions.ts | - |
| SK.autoPoVCollectablesList | Setting_autoPoVCollectablesList | (no description) | - | Module/Events/PathOfValue.ts | - |
| SK.autoLoveRaidSelectedIndex | Setting_autoLoveRaidSelectedIndex | (no description) | Module/Events/LoveRaidManager.ts, Module/Troll.ts | Module/Events/LoveRaidManager.ts | config/HHStoredVars.ts |
| SK.plusLoveRaidMythic | Setting_autoLoveRaidMythicOnly | (no description) | Service/StartService.ts | Module/Events/LoveRaidManager.ts, Service/StartService.ts | - |
| SK.autoFreeBundlesCollect | Setting_autoFreeBundlesCollect | (no description) | - | Module/Bundles.ts, Service/AutoLoopActions.ts | - |
| SK.autoFreeBundlesCollectablesList | Setting_autoFreeBundlesCollectablesList | (no description) | - | - | - |
| SK.sultryMysteriesEventRefreshShop | Setting_sultryMysteriesEventRefreshShop | (no description) | - | Module/Events/EventModule.ts | - |
| SK.showInfo | Setting_showInfo | (no description) | - | Service/InfoService.ts | - |
| SK.showInfoLeft | Setting_showInfoLeft | (no description) | - | Service/InfoService.ts | - |
| SK.showCalculatePower | Setting_showCalculatePower | (no description) | - | Service/AutoLoopPageHandlers.ts | - |
| SK.showClubButtonInPoa | Setting_showClubButtonInPoa | (no description) | - | Module/Events/DoublePenetration.ts, Service/AutoLoopPageHandlers.ts | - |
| SK.showRewardsRecap | Setting_showRewardsRecap | (no description) | - | Module/Events/DoublePenetration.ts, Module/Events/LivelyScene.ts, Module/Events/PathOfAttraction.ts, +2 more | - |
| SK.showTooltips | Setting_showTooltips | (no description) | - | Service/TooltipService.ts | - |
| SK.showAdsBack | Setting_showAdsBack | (no description) | - | Service/AdsService.ts | - |
| SK.mousePause | Setting_mousePause | (no description) | - | Service/StartService.ts | - |
| SK.mousePauseTimeout | Setting_mousePauseTimeout | (no description) | - | Service/MouseService.ts | - |
| SK.collectAllTimer | Setting_collectAllTimer | (no description) | - | Helper/TimeHelper.ts | - |
| SK.compactDailyGoals | Setting_compactDailyGoals | (no description) | - | Module/DailyGoals.ts | - |
| SK.compactEndedContests | Setting_compactEndedContests | (no description) | - | Module/Contest.ts | - |
| SK.compactMissions | Setting_compactMissions | (no description) | - | Module/Missions.ts | - |
| SK.compactPowerPlace | Setting_compactPowerPlace | (no description) | - | Module/PlaceOfPower.ts | - |
| SK.invertMissions | Setting_invertMissions | (no description) | - | Module/Missions.ts | - |
| SK.saveDefaults | Setting_saveDefaults | (no description) | Helper/StorageHelper.ts | Helper/StorageHelper.ts | - |
| SK.AllMaskRewards | Setting_AllMaskRewards | (no description) | Service/StartService.ts | Module/Events/PathOfAttraction.ts, Module/Events/Season.ts, Module/Events/Seasonal.ts, +2 more | - |
| SK.PoAMaskRewards | Setting_PoAMaskRewards | (no description) | - | Service/StartService.ts | Service/StartService.ts |
| SK.PoGMaskRewards | Setting_PoGMaskRewards | (no description) | - | Service/StartService.ts | Service/StartService.ts |
| SK.PoVMaskRewards | Setting_PoVMaskRewards | (no description) | - | Service/StartService.ts | Service/StartService.ts |
| SK.SeasonMaskRewards | Setting_SeasonMaskRewards | (no description) | - | Service/StartService.ts | Service/StartService.ts |
| SK.SeasonalEventMaskRewards | Setting_SeasonalEventMaskRewards | (no description) | - | Service/StartService.ts | Service/StartService.ts |

### 7.2 TK (Temp/Runtime) - 90 Keys

| Key | Storage-Name | Inhalt / Zweck | Wo geschrieben (set) | Wo gelesen (get) | Wo geloescht (delete) |
|---|---|---|---|---|---|
| TK.autoLoop | Temp_autoLoop | (no description) | Helper/HeroHelper.ts, Helper/PageHelper.ts, Helper/RewardHelper.ts, +28 more | Service/AutoLoop.ts, Service/StartService.ts | - |
| TK.autoLoopTimeMili | Temp_autoLoopTimeMili | (no description) | - | Helper/HeroHelper.ts, Module/Bundles.ts, Module/Events/DoublePenetration.ts, +7 more | - |
| TK.Debug | Temp_Debug | (no description) | - | Helper/HHMenuHelper.ts, Module/Champion.ts, Module/Events/LoveRaidManager.ts, +12 more | - |
| TK.Logging | Temp_Logging | (no description) | Utils/LogUtils.ts | Utils/LogUtils.ts | - |
| TK.Timers | Temp_Timers | (no description) | Helper/TimerHelper.ts | Service/StartService.ts | - |
| TK.LastPageCalled | Temp_LastPageCalled | (no description) | Service/PageNavigationService.ts, Service/StartService.ts | Module/Shop.ts, Service/AutoLoopActions.ts, Service/StartService.ts | Service/AutoLoopActions.ts, Service/StartService.ts |
| TK.CheckSpentPoints | Temp_CheckSpentPoints | (no description) | Service/AutoLoop.ts | Service/AutoLoop.ts | - |
| TK.freshStart | Temp_freshStart | (no description) | - | Service/StartService.ts | - |
| TK.scriptversion | Temp_scriptversion | (no description) | Service/StartService.ts | Service/StartService.ts | - |
| TK.pinfo | Temp_pinfo | (no description) | Service/ParanoiaService.ts | Service/InfoService.ts | - |
| TK.HaremSize | Temp_HaremSize | (no description) | Module/harem/Harem.ts | Helper/BDSMHelper.ts, Module/harem/Harem.ts | - |
| TK.filteredGirlsList | Temp_filteredGirlsList | (no description) | Module/harem/Harem.ts | Module/harem/HaremGirl.ts | - |
| TK.haremGirlActions | Temp_haremGirlActions | (no description) | Module/TeamModule.ts, Module/harem/Harem.ts, Module/harem/HaremGirl.ts | Module/harem/Harem.ts, Module/harem/HaremGirl.ts, Service/AutoLoopPageHandlers.ts | Module/harem/Harem.ts |
| TK.haremGirlEnd | Temp_haremGirlEnd | (no description) | Module/harem/Harem.ts, Module/harem/HaremGirl.ts | Module/harem/HaremGirl.ts | Module/harem/Harem.ts |
| TK.haremGirlLimit | Temp_haremGirlLimit | (no description) | Module/harem/HaremGirl.ts | Module/harem/HaremGirl.ts | Module/harem/Harem.ts |
| TK.haremGirlMode | Temp_haremGirlMode | (no description) | Module/TeamModule.ts, Module/harem/Harem.ts, Module/harem/HaremGirl.ts | Module/harem/Harem.ts, Module/harem/HaremGirl.ts, Service/AutoLoopPageHandlers.ts, Service/StartService.ts | Module/harem/Harem.ts |
| TK.haremGirlPayLast | Temp_haremGirlPayLast | (no description) | Module/harem/Harem.ts, Module/harem/HaremGirl.ts | Module/harem/HaremGirl.ts | Module/harem/Harem.ts |
| TK.haremGirlSpent | Temp_haremGirlSpent | (no description) | - | - | Module/harem/Harem.ts |
| TK.haremMoneyOnStart | Temp_haremMoneyOnStart | (no description) | Module/harem/Harem.ts | Module/harem/Harem.ts, Module/harem/HaremGirl.ts | Module/harem/Harem.ts |
| TK.haremTeam | Temp_haremTeam | (no description) | Module/TeamModule.ts | Module/harem/Harem.ts, Module/harem/HaremGirl.ts | Module/harem/Harem.ts |
| TK.haremTeamScrolls | Temp_haremTeamScrolls | (no description) | Module/harem/Harem.ts | Module/harem/Harem.ts | Module/harem/Harem.ts |
| TK.haremTeamSettings | Temp_haremTeamSettings | (no description) | Module/TeamModule.ts | Module/harem/Harem.ts | Module/harem/Harem.ts |
| TK.blessingsCache | Temp_blessingsCache | (no description) | Service/BlessingService.ts | Service/BlessingService.ts | - |
| TK.haveAff | Temp_haveAff | (no description) | Module/Shop.ts | Module/Market.ts, Module/Shop.ts, Service/InfoService.ts | - |
| TK.haveBooster | Temp_haveBooster | (no description) | Module/Market.ts, Module/Shop.ts | Helper/HeroHelper.ts, Module/Booster.ts, Module/Market.ts | - |
| TK.haveExp | Temp_haveExp | (no description) | Module/Shop.ts | Module/Market.ts, Module/Shop.ts, Service/InfoService.ts | - |
| TK.charLevel | Temp_charLevel | (no description) | Module/Market.ts, Module/Shop.ts, Service/AutoLoopActions.ts | Service/AutoLoopActions.ts | - |
| TK.storeContents | Temp_storeContents | (no description) | Module/Market.ts, Module/Shop.ts | Module/Booster.ts, Module/Market.ts | - |
| TK.boosterStatus | Temp_boosterStatus | (no description) | Module/Booster.ts | Module/Booster.ts | - |
| TK.boosterStatusLastUpdate | Temp_boosterStatusLastUpdate | (no description) | Module/Booster.ts | Module/Booster.ts | Helper/HeroHelper.ts |
| TK.boosterIdMap | Temp_boosterIdMap | (no description) | Module/Shop.ts | Module/Booster.ts | - |
| TK.TrollHumanLikeRun | Temp_TrollHumanLikeRun | (no description) | Module/Troll.ts, Service/AutoLoopActions.ts | Service/AutoLoopActions.ts | - |
| TK.TrollInvalid | Temp_TrollInvalid | (no description) | Module/Troll.ts | Module/Troll.ts | - |
| TK.trollPoints | Temp_trollPoints | (no description) | Module/Troll.ts | Module/Troll.ts | - |
| TK.trollToFight | Temp_trollToFight | (no description) | - | - | - |
| TK.trollWithGirls | Temp_trollWithGirls | (no description) | Module/Troll.ts | Module/Troll.ts | - |
| TK.autoTrollBattleSaveQuest | Temp_autoTrollBattleSaveQuest | (no description) | Module/GenericBattle.ts, Service/AutoLoopActions.ts | Module/GenericBattle.ts, Module/Troll.ts, Service/AutoLoopActions.ts | - |
| TK.questRequirement | Temp_questRequirement | (no description) | Module/Quest.ts, Module/Troll.ts, Service/AutoLoop.ts, Service/AutoLoopActions.ts | Module/Troll.ts, Service/AutoLoop.ts, Service/AutoLoopActions.ts | config/HHStoredVars.ts |
| TK.MainAdventureWorldID | Temp_MainAdventureWorldID | (no description) | Service/StartService.ts | Service/StartService.ts | - |
| TK.SideAdventureWorldID | Temp_SideAdventureWorldID | (no description) | Service/StartService.ts | - | - |
| TK.battlePowerRequired | Temp_battlePowerRequired | (no description) | Module/Troll.ts, Service/AutoLoop.ts, Service/AutoLoopActions.ts | Service/AutoLoop.ts, Service/AutoLoopActions.ts | - |
| TK.burst | Temp_burst | (no description) | Service/ParanoiaService.ts | Service/AutoLoop.ts, Service/ParanoiaService.ts | - |
| TK.fought | Temp_fought | (no description) | - | - | - |
| TK.lastActionPerformed | Temp_lastActionPerformed | (no description) | Module/TeamModule.ts, Module/harem/Harem.ts, Module/harem/HaremGirl.ts, Service/AutoLoop.ts | Module/harem/Harem.ts, Service/AutoLoop.ts | - |
| TK.eventGirl | Temp_eventGirl | (no description) | Module/Events/EventModule.ts | - | - |
| TK.eventMythicGirl | Temp_eventMythicGirl | (no description) | Module/Events/EventModule.ts | - | - |
| TK.eventsGirlz | Temp_eventsGirlz | (no description) | Helper/RewardHelper.ts, Module/Events/EventModule.ts | Helper/RewardHelper.ts | - |
| TK.eventsList | Temp_eventsList | (no description) | Module/Events/EventModule.ts, Service/ParanoiaService.ts | Module/Events/EventModule.ts, Service/ParanoiaService.ts, Service/Pipeline.config.ts | - |
| TK.autoChampsEventGirls | Temp_autoChampsEventGirls | (no description) | Module/Events/EventModule.ts | Module/Champion.ts | - |
| TK.EventFightsBeforeRefresh | Temp_EventFightsBeforeRefresh | (no description) | - | - | - |
| TK.loveRaids | Temp_loveRaids | (no description) | Module/Events/LoveRaidManager.ts | Module/Events/LoveRaidManager.ts | config/HHStoredVars.ts |
| TK.raidGirls | Temp_raidGirls | (no description) | - | Module/Events/LoveRaidManager.ts | - |
| TK.bossBangTeam | Temp_bossBangTeam | (no description) | Module/Events/BossBang.ts | Module/Events/BossBang.ts | - |
| TK.lseManualCollectAll | Temp_lseManualCollectAll | (no description) | Module/Events/LivelyScene.ts | Module/Events/LivelyScene.ts | - |
| TK.poaManualCollectAll | Temp_poaManualCollectAll | (no description) | Module/Events/PathOfAttraction.ts | Module/Events/PathOfAttraction.ts | - |
| TK.champBuildTeam | Temp_champBuildTeam | (no description) | Module/Champion.ts, Module/ClubChampion.ts | Module/Champion.ts, Module/ClubChampion.ts | Module/Champion.ts, Module/ClubChampion.ts |
| TK.clubChampLimitReached | Temp_clubChampLimitReached | (no description) | Module/ClubChampion.ts | Module/Champion.ts | Module/ClubChampion.ts |
| TK.LeagueHumanLikeRun | Temp_LeagueHumanLikeRun | (no description) | Module/League.ts | Module/League.ts | - |
| TK.LeagueOpponentList | Temp_LeagueOpponentList | (no description) | Module/League.ts | - | Module/League.ts, Service/StartService.ts, Utils/LogUtils.ts, config/HHStoredVars.ts |
| TK.LeagueSavedData | Temp_LeagueSavedData | (no description) | - | - | - |
| TK.LeagueTempOpponentList | Temp_LeagueTempOpponentList | (no description) | - | - | - |
| TK.leaguesTarget | Temp_leaguesTarget | (no description) | - | - | - |
| TK.hideBeatenOppo | Temp_hideBeatenOppo | (no description) | Module/League.ts | Module/League.ts | - |
| TK.SeasonEndDate | Temp_SeasonEndDate | (no description) | Module/Events/Season.ts | Module/Events/Season.ts | - |
| TK.SeasonHumanLikeRun | Temp_SeasonHumanLikeRun | (no description) | Module/Events/Season.ts, Service/AutoLoopActions.ts | Module/Events/Season.ts, Service/AutoLoopActions.ts | - |
| TK.SeasonalEventEndDate | Temp_SeasonalEventEndDate | (no description) | Module/Events/Seasonal.ts | Module/Events/Seasonal.ts | - |
| TK.PantheonHumanLikeRun | Temp_PantheonHumanLikeRun | (no description) | Module/Pantheon.ts, Service/AutoLoopActions.ts | Module/Pantheon.ts, Service/AutoLoopActions.ts | - |
| TK.PentaDrillHumanLikeRun | Temp_PentaDrillHumanLikeRun | (no description) | Module/PentaDrill.ts, Service/AutoLoopActions.ts | Module/PentaDrill.ts, Service/AutoLoopActions.ts | - |
| TK.PopToStart | Temp_PopToStart | (no description) | Module/PlaceOfPower.ts | Module/PlaceOfPower.ts, Service/AutoLoopActions.ts | - |
| TK.PopTargeted | Temp_PopTargeted | (no description) | Module/PlaceOfPower.ts | Module/PlaceOfPower.ts | Module/PlaceOfPower.ts |
| TK.PopUnableToStart | Temp_PopUnableToStart | (no description) | Module/PlaceOfPower.ts | Module/PlaceOfPower.ts | - |
| TK.Totalpops | Temp_Totalpops | (no description) | Module/PlaceOfPower.ts | Module/PlaceOfPower.ts | - |
| TK.currentlyAvailablePops | Temp_currentlyAvailablePops | (no description) | Module/PlaceOfPower.ts | - | - |
| TK.PoAEndDate | Temp_PoAEndDate | (no description) | Module/Events/PathOfAttraction.ts | Module/Events/PathOfAttraction.ts | - |
| TK.PoGEndDate | Temp_PoGEndDate | (no description) | Module/Events/PathOfGlory.ts | Module/Events/PathOfGlory.ts | - |
| TK.PoVEndDate | Temp_PoVEndDate | (no description) | Module/Events/PathOfValue.ts | Module/Events/PathOfValue.ts | - |
| TK.dailyGoalsList | Temp_dailyGoalsList | (no description) | Module/DailyGoals.ts | Module/DailyGoals.ts | - |
| TK.NextSwitch | Temp_NextSwitch | (no description) | Service/ParanoiaService.ts | Service/ParanoiaService.ts | - |
| TK.paranoiaLeagueBlocked | Temp_paranoiaLeagueBlocked | (no description) | Module/League.ts | Service/ParanoiaService.ts | - |
| TK.paranoiaQuestBlocked | Temp_paranoiaQuestBlocked | (no description) | Service/AutoLoopActions.ts | Service/ParanoiaService.ts | - |
| TK.paranoiaSpendings | Temp_paranoiaSpendings | (no description) | Service/ParanoiaService.ts | Service/ParanoiaService.ts | - |
| TK.sandalwoodFailure | Temp_sandalwoodFailure | (no description) | Helper/HeroHelper.ts, Module/Booster.ts | Helper/HeroHelper.ts | - |
| TK.sandalwoodMaxUsages | Temp_sandalwoodMaxUsages | (no description) | Module/Booster.ts | - | - |
| TK.unkownPagesList | Temp_unkownPagesList | (no description) | Helper/PageHelper.ts | Helper/PageHelper.ts | - |
| TK.userLink | Temp_userLink | (no description) | - | - | - |
| TK.surveyShown | Temp_surveyShown | (no description) | Service/SurveyService.ts | Service/SurveyService.ts | - |
| TK.surveyDismissCount | Temp_surveyDismissCount | (no description) | Service/SurveyService.ts | Service/SurveyService.ts | - |
| TK.surveyLastHash | Temp_surveyLastHash | (no description) | Service/SurveyService.ts | Service/SurveyService.ts | - |
| TK.featurePopupShown | Temp_featurePopupShown | (no description) | Service/FeaturePopupService.ts | Service/FeaturePopupService.ts | - |
| TK.featurePopupDismissCount | Temp_featurePopupDismissCount | (no description) | Service/FeaturePopupService.ts | Service/FeaturePopupService.ts | - |

Beobachtungen:

- TK.autoLoop wird in vielen Dateien geschrieben (jeder Caller, der den Loop kurz pausieren muss). Lesend nur in wenigen Stellen.
- TK.autoLoopTimeMili wird nirgendwo explizit gesetzt - kommt aus dem Default in HHStoredVars.ts (1500 ms).
- TK.HaremSize, TK.boosterStatus, TK.LeagueOpponentList sind grosse JSON-Strukturen - bei storage-full fallen sie als erste in cleanLogsInStorage().
- TK.unkownPagesList ist ein Telemetrie-Map fuer noch nicht bekannte pagesIDXxx (siehe Sektion 6.1).


## 8. sessionStorage (direkter Zugriff, ohne getStoredValue-Wrapper)

Alle Stellen, an denen sessionStorage direkt verwendet wird (also nicht ueber getStoredValue/setStoredValue).
Hintergrund: Der Wrapper sucht den Key in HHStoredVars und delegiert je nach storage-Feld an localStorage / sessionStorage / Storage(). Direkte Zugriffe umgehen diese Pruefung.

| Datei | Symbol/Funktion | Operation | Key (mit Praefix) | Zweck |
|---|---|---|---|---|
| Helper/StorageHelper.ts | saveAllToFile (Log-Export) | read (getItem) | HHAuto_Temp_Logging (= HHStoredVarPrefixKey + Temp_Logging) | Log-Buffer zum Export einlesen (Bypass HHStoredVars-Wrapper) |
| Helper/StorageHelper.ts | migrateHHVars | read+write+remove | beliebige oldVar/newVar | Migration alter Praefixe (HHAuto_ -> custom) |
| Helper/StorageHelper.ts | debugDeleteAllVars | removeItem | alle Keys mit Praefix HHAuto_Setting_* und HHAuto_Temp_* (ausser TK.Logging) | Reset aller Vars |
| Helper/StorageHelper.ts | getLocalStorageSize | hasOwnProperty + Read | beliebig | zaehlt total |
| Module/PlaceOfPower.ts | cleanTempPopToStart, removePopFromPopToStart | removeItem | Temp_PopUnableToStart, Temp_PopToStart | Reset bei PoP-Setting-Change |
| Service/AutoLoopActions.ts | (PoP-Run-Cleanup) | removeItem | Temp_PopToStart | Reset wenn Pop-Run abgeschlossen |
| Service/ParanoiaService.ts | clearParanoiaSpendings | removeItem | Temp_paranoiaSpendings, Temp_NextSwitch, Temp_paranoiaQuestBlocked, Temp_paranoiaLeagueBlocked | Reset bei Paranoia-Disable |
| Module/Events/EventModule.ts | parseEvents (Cleanup-Pfade) | removeItem | Temp_eventsGirlz, Temp_eventGirl, Temp_eventMythicGirl, Temp_eventsList, Temp_autoChampsEventGirls | Cleanup nach Event-Ende, Reset bei Champ-Konfig-Wechsel |

Kein direkter Zugriff auf sessionStorage ausserhalb dieser Stellen.


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

	s
return unsafeWindow.shared?.general?.hh_ajax;


Liefert die interne AJAX-Funktion des Spiels mit Signatur (params, onSuccess, onError) => void.
params.action ist das spielinterne Action-Routing (siehe Sektion 3).
onSuccess(data), onError(err) sind die Callbacks.

### 9.3 getHero() (Helper/HeroHelper.ts)

	s
if (unsafeWindow.shared?.Hero === undefined) {
    setTimeout(autoLoop, Number(getStoredValue(HHStoredVarPrefixKey+TK.autoLoopTimeMili)) || 1000);
}
return unsafeWindow.shared?.Hero;


Liefert das Hero-Objekt direkt aus shared. Bei Nichtverfuegbarkeit: schedule autoLoop und gib undefined zurueck.

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
| getPage(checkUnknown, checkPop) | Helper/PageHelper.ts | resolved canonical Page-ID aus <body page>+Tab+Pop-Detection (siehe Sektion 6.1) |
| ConfigHelper.getEnvironnement() | Helper/ConfigHelper.ts | matched window.location.hostname gegen HHKnownEnvironnements |
| ConfigHelper.getHHScriptVars(id, logNotFound) | Helper/ConfigHelper.ts | env-spezifischer Lookup mit global als Fallback (siehe Sektion 11) |
| ConfigHelper.isPshEnvironnement() | Helper/ConfigHelper.ts | true fuer PH_prod und NPH_prod |


## 10. Page-spezifische Datenverfuegbarkeit

Fuer jede Page-ID (aus ConfigHelper.getHHScriptVars("pagesIDXxx")): welche unsafeWindow-Globals sind dort lesbar, welche DOM-Quellen relevant.

| Page-ID-Konstante (Wert) | Verfuegbare unsafeWindow-Globals | Verfuegbare DOM-Quellen |
|---|---|---|
| pagesIDHome (home) | shared.Hero, hh_prices (?) | #contains_all header .currency .daily-reward-notif, #blessings_popup .blessings_wrapper (nach get_girls_blessings) |
| pagesIDActivities (activities) | shared.Hero, pop_list, pop_index (wenn Pop-Tab) | #activities-tabs > div[data-tab=...], div.pop_list, .pop_thumb_selected[pop_id] |
| pagesIDMissions (missions) | shared.Hero | Mission-DOM (Module/Missions.ts) |
| pagesIDContests (contests) | contests_timer.{next_contest,duration,remaining_time}, has_contests_datas | Contest-Claim-Buttons |
| pagesIDDailyGoals (daily_goals) | daily_goals_list | Tier-DOM in DailyGoals |
| pagesIDPowerplacemain (powerplacemain) | pop_list, pop_index | div.pop_list, .pop_thumb_selected[pop_id] |
| pagesIDQuest (quest) | shared.Hero, Hero.infos.questing.{id_world,id_quest,current_url} | Quest-DOM |
| pagesIDHarem (harem) | shared.GirlSalaryManager.{girlsMap,girlsListSec}, availableGirls / girlsDataList / girls_data_list (variantenabhaengig) | #harem_right .opened .attr("girl"), .hhava, .select-group ... [data-index] |
| pagesIDGirlPage (girl) | girl (KKHaremGirl), id_girl, player_gems_amount | .right-section .slot[data-d], #girl-leveler-tabs .switch-tab[data-tab=...] |
| pagesIDMap (map) | shared.Hero | - |
| pagesIDPachinko (pachinko) | shared.Hero | #playzone-replace-info button[data-free="true"], [girlsRewards].attr("data-rewards") |
| pagesIDLeaderboard (leaderboard) | current_tier_number, opponents_list (League) | .league_content .data-list, .data-row.body-row, .data-column[column="..."] |
| pagesIDShop (shop) | shared.animations.loadingAnimation, hh_prices | #shops div.{armor,booster,gift,potion}.merchant-inventory-item .slot[data-d], #shops div.{gift,potion,booster}.player-inventory-content .slot[data-d], #equiped .booster .slot, .shop div.shop_count span[rel="expires"] |
| pagesIDClub (clubs) | Chat_vars.CLUB_INFO.id_club | Club-Status-UI |
| pagesIDPantheon (pantheon) | Hero.energies.worship.* | - |
| pagesIDPantheonPreBattle (pantheon-pre-battle) | Hero.energies.worship.* | #pre-battle .pantheon-single-battle-button[data-pantheon-id] |
| pagesIDPantheonBattle (pantheon-battle) | - | - |
| pagesIDLabyrinthEntrance (labyrinth-entrance) | - | - |
| pagesIDLabyrinthPoolSelect (labyrinth-pool-select) | - | - |
| pagesIDLabyrinth (labyrinth) | girl_squad | .team-hexagon .team-member-container[data-girl-id] |
| pagesIDLabyrinthPreBattle (labyrinth-pre-battle) | - | .opponent-power .opponent-power-text[data-power] |
| pagesIDLabyrinthBattle (labyrinth-battle) | - | - |
| pagesIDChampionsPage (champions) | championData.{team,champion.id,champion.poses,freeDrafts,hero_damage,fight.{active,participants}} | .champions-over__champion-info ... .champion-pose |
| pagesIDChampionsMap (champions_map) | championData.* | - |
| pagesIDClubChampion (club_champion) | championData.fight.{active,participants} | div.club-champion-members-challenges .player-row .data-column:nth-of-type(3) |
| pagesIDSeason (season) | season_sec_untill_event_end, Hero.energies.kiss.* | - |
| pagesIDSeasonArena (season_arena) | season_sec_untill_event_end, hero_data, opponents | .season_arena_opponent_container[data-opponent=...], .slot.girl_ico[data-rewards] |
| pagesIDSeasonBattle (season-battle) | Hero.energies.kiss.* | - |
| pagesIDLeaguePreBattle (leagues-pre-battle) | Hero.energies.challenge.* | - |
| pagesIDLeagueBattle (league-battle) | Hero.energies.challenge.* | - |
| pagesIDTrollPreBattle (troll-pre-battle) | Hero.energies.fight.*, Hero.infos.questing.*, Hero.infos.hc_confirm | #pre-battle .battle-buttons button.autofight[data-battles="10"] / [data-battles="50"], .opponent_rewards .rewards_list .slot.girl_ico[data-rewards] |
| pagesIDTrollBattle (troll-battle) | Hero.energies.fight.* | - |
| pagesIDPentaDrill (penta_drill) | penta_drill_data.cycle_data.seconds_until_event_end, Hero.energies.drill.* | - |
| pagesIDPentaDrillArena (penta_drill_arena) | opponents_list (KKPentaDrillOpponents[]) | - |
| pagesIDEditPentaDrillTeam (edit-penta-drill-team) | - | .team-member-container[data-girl-id] |
| pagesIDPentaDrillPreBattle (penta_drill_pre_battle) | - | - |
| pagesIDPentaDrillBattle (penta-drill-battle) | - | - |
| pagesIDEvent (event) | event_data (mit girls), current_event (Fallback) | [data-select-girl-id=...] |
| pagesIDPoV (path-of-valor) | - | [data-time-stamp], Reward-Slots |
| pagesIDPoG (path-of-glory) | - | [data-time-stamp], Reward-Slots |
| pagesIDPoA (path_of_attraction) | - | [data-nc-reward-id], #poa-content .buttons:has(button[data-href="/champions-map.html"]) |
| pagesIDSeasonalEvent (seasonal) | seasonal_event_active, seasonal_time_remaining, mega_event_active, mega_event_time_remaining, mega_event_data.cards | - |
| pagesIDBossBang (boss-bang-battle) | (?) | - |
| pagesIDSexGodPath (sex-god-path) | (?) | - |
| pagesIDLoveRaid (love_raids) | love_raids (KKLoveRaid[]) | - |
| pagesIDWaifu (waifu) | (?) | - |
| pagesIDBattleTeams (teams) | teams_data[selectedTeam].{girls,girls_ids} | .team-slot-container.selected-team[data-team-index], .team-member-container[data-team-member-position=N][data-girl-id] |
| pagesIDEditTeam (edit-team) | teams_data[...] | gleiche Selectoren wie BattleTeams + #edit-team-page |
| pagesIDEditLabyrinthTeam (edit-labyrinth-team) | - | .team-member-container.selectable[data-team-member-position=...][data-girl-id] |
| pagesIDMemberProgression (member-progression) | (?) | - |
| pagesIDHeroPage (hero_pages) | shared.Hero | - |
| pagesIDGirlEquipmentUpgrade (girl-equipment-upgrade) | (?) | .right-section .slot[data-d] |

Hinweis: (?) steht fuer "im Source nicht eindeutig nachweisbar".


## 11. Per-Game-Unterschiede

Erkennung: ConfigHelper.getEnvironnement() matched window.location.hostname gegen HHKnownEnvironnements.
Bekannte Hosts (aus den getEnv()-Methoden in src/config/game/):

| Hostname | Env-Name | gameID (HTML <body id>) | baseImgPath |
|---|---|---|---|
| www.hentaiheroes.com | HH_prod | hh_hentai | (default https://hh2.hh-content.com) |
| test.hentaiheroes.com | HH_test | hh_hentai | (default) |
| nutaku.haremheroes.com | NHH_prod | hh_hentai | (default) |
| thrix.hentaiheroes.com | THH_prod | hh_hentai | (default) |
| eroges.hentaiheroes.com | EHH_prod | hh_hentai | (default) |
| esprit.hentaiheroes.com | OGHH_prod | hh_hentai | (default) |
| www.comixharem.com | CH_prod | hh_comix | https://ch.hh-content.com |
| nutaku.comixharem.com | NCH_prod | hh_comix | (default) |
| www.gayharem.com | GH_prod | hh_gay | (default) |
| nutaku.gayharem.com | NGH_prod | hh_gay | (default) |
| eroges.gayharem.com | EGH_prod | hh_gay | (default) |
| www.pornstarharem.com | PH_prod | hh_star | https://th.hh-content.com |
| nutaku.pornstarharem.com | NPH_prod | hh_star | https://th.hh-content.com |
| www.transpornstarharem.com | TPH_prod | hh_startrans | https://images.hh-content.com/startrans |
| nutaku.transpornstarharem.com | NTPH_prod | hh_startrans | https://images.hh-content.com/startrans |
| www.gaypornstarharem.com | GPSH_prod | hh_stargay | https://images.hh-content.com/stargay |
| nutaku.gaypornstarharem.com | NGPSH_prod | hh_stargay | https://images.hh-content.com/stargay |
| www.mangarpg.com | MRPG_prod | hh_mangarpg | https://mh.hh-content.com |
| nutaku.mangarpg.com | NMRPG_prod | hh_mangarpg | https://mh.hh-content.com |
| www.amouragent.com | AA_prod | hh_amour | (default) |
| www.hornyheroes.com | SH_prod | hh_sexy | (default; manuell in HHEnvVariables.ts registriert, kein eigenes Game-File) |

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

- **Girl-Daten-Quelle**: HH-Family liest availableGirls oder girlsDataList; PSH-Build liefert die Liste unter girls_data_list (Module/harem/Harem.ts faellt auf alle drei Pfade in Reihenfolge zurueck).
- **shared.Hero vs Hero**: Auf modernen Builds aller Variants ist unsafeWindow.shared definiert -> getHHVars("Hero.x") haengt automatisch shared. davor (siehe Sektion 9.1).
- **Iframe**: Nutaku-Builds (unsafeWindow.hh_nutaku === true) leben in einem iframe; HHAuto sendet postMessage({ImAlive:true},"*") an window.top und haengt ?sess=... an interne Navigationen an.
- **Endpoint-Unterschiede**: AJAX-Endpoint ist immer derselbe Host wie das Spiel (relativ zur Hostname).


## 12. Cheat-Click-Hook (shared.general.is_cheat_click)

Im Spiel-Code ist shared.general.is_cheat_click eine Funktion, die bei verdaechtigen Klick-Mustern (zu schnelle Klicks, kein Mausweg, etc.) true zurueckgibt und Aktionen blockiert.

In HHAuto:

- Utils/Utils.ts enthaelt replaceCheatClick(). Body komplett auskommentiert:

  	s
  export function replaceCheatClick()
  {
      // unsafeWindow.is_cheat_click=function(e) {
      //     return false;
      // };
      // unsafeWindow.shared.general.is_cheat_click =function(e) {
      //     return false;
      // };
  }
  

- Service/StartService.ts ruft replaceCheatClick() einmalig in start() auf - aktuell ein No-Op.

Bedeutung: Override-Stelle ist im Code vorbereitet, aber **deaktiviert**. Eine fruehere Version ueberschrieb beide Pfade (unsafeWindow.is_cheat_click und unsafeWindow.shared.general.is_cheat_click) mit immer-false-Stub. Aktuell verlaesst sich HHAuto darauf, dass durch randomInterval(...) und Timing-Pausen kein Cheat-Detection-Trigger ausgeloest wird, und Aktionen werden bevorzugt direkt via getHHAjax()(params, ...) gesendet (statt synthetischer Klicks).

Window-Interface (src/index.ts) enthaelt is_cheat_click: any als declared property - Type-Hint fuer alte direkte Reads/Writes, die heute nicht mehr aktiv sind.

## 13. Race-Conditions / Timing

### 13.1 Skript-Start

src/index.ts ruft hardened_start() direkt nach Modul-Load. Tampermonkey injiziert den User-Script aber **vor** dem game-eigenen JS, daher sind globale Variablen wie shared.Hero zum Erst-Aufruf typisch noch nicht da.

Schritte in hardened_start() (Service/StartService.ts):

1. Registriert GM_registerMenuCommand("Save Debug Log", saveHHDebugLog).
2. Pruefung unsafeWindow.jQuery == undefined -> falls fehlt: ggf. "Forbidden"-Page erkennen (innerText der body); bei Forbidden: reload nach randomInterval(60, 300) Sekunden; sonst Abbruch (kein Crash).
3. started Lock + start()-Aufruf.

In start():

1. **Hero-Retry-Loop**: Wenn unsafeWindow.shared?.Hero === undefined:
   - heroRetryCount++. Maximal HERO_MAX_RETRIES = 15 Versuche, dann Abbruch ("Try reloading the page.").
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

- TK.Timers haelt eine JSON-Map name -> {endAt, startedAt}. Geschrieben von Helper/TimerHelper.ts, gelesen von StartService.ts beim Start (setTimers(...)).
- Beim Skript-Start wird setTimers(getStoredJSON(TK.Timers, {})) ausgefuehrt; persistierte Timer leben also ueber Reloads weg.
- getSecondsLeft(name) / setTimer(name, seconds) / clearTimer(name) / checkTimer(name) sind die Wrapper.
- convertTimeToInt(text) parsed das Game-DOM-Timer-Format (HH:MM:SS) z.B. fuer Shop-Refresh.

### 13.6 Bekannte Edge-Cases

- **Erstaufruf vor Game-Load**: 15x 5s-Retry-Loop (siehe oben).
- **Forbidden-Page**: 1-5min Random-Reload (Anti-Bot-Backoff).
- **Tab-Wechsel und SK.settPerTab=true**: Settings landen in sessionStorage, also pro Tab. Migration zwischen Tabs ist nicht implementiert.
- **boosterStatusLastUpdate TTL**: 10 Minuten (Booster.BOOSTER_STATUS_TTL_MS = 10 * 60 * 1000).
- **unsafeWindow.shared.GirlSalaryManager.girlsMap**: Kann erst nach Salary-Manager-Init genutzt werden. Code prueft mit getHHVars(..., false) (silent).
