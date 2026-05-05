---
last-verified: 2026-05-05
verified-against-version: 7.35.20
status: new
---

# HHAuto - Data Sources Inventory

Vollstaendige Inventarisierung aller Datenquellen, auf die das HHAuto-Skript zugreift.
Quelle: systematischer grep durch alle 132 TypeScript-Dateien unter `src/`.

> Konventionen
>
> - "Datei" wird ohne `src/`-Praefix angegeben.
> - "Page-ID" entspricht den Konstanten aus `ConfigHelper.getHHScriptVars("pagesIDXxx")` bzw. dem `<body page="...">`-Attribut.
> - "Verfuegbar auf" ist - wenn nicht im Source eindeutig nachweisbar - mit *unklar* gekennzeichnet (Tag `(?)`).
> - localStorage/sessionStorage Keys sind mit dem Default-Praefix `HHAuto_` versehen (siehe `HHStoredVarPrefixKey`).

## 1. unsafeWindow-Globals (direkter Zugriff)

Direkte `unsafeWindow.XXX`-Zugriffe (ohne `getHHVars`-Wrapper). Reads & Writes.
Siehe auch `src/index.ts` fuer die `Window`-Interface-Erweiterung, die alle hier genutzten Properties typed.

| Variablen-Pfad | Datentyp | Verfuegbar auf | Datei | Zweck |
|---|---|---|---|---|
| `unsafeWindow.shared` | Objekt (root container) | jede Page nach Game-JS-Load | `Helper/HHHelper.ts:17` | Existenz-Check fuer `prefixIfNeeded()` (legt fest, ob `Hero.x` zu `shared.Hero.x` umgeschrieben wird) |
| `unsafeWindow.shared.Hero` | Objekt (Hero-Daten) | jede Page nach Game-JS-Load | `Helper/HeroHelper.ts:27,32`, `Service/StartService.ts:198` | Existenz-Check; `getHero()` liefert dieses Objekt; Startup-Retry-Loop |
| `unsafeWindow.shared.general.hh_ajax` | Function `(params, onSuccess, onError) => void` | jede Page nach Game-JS-Load | `Utils/Utils.ts:20` | `getHHAjax()` - Bruecke zur internen AJAX-Funktion des Spiels |
| `unsafeWindow.shared.general.is_cheat_click` | Function (Cheat-Detector) | jede Page nach Game-JS-Load | `Utils/Utils.ts:112` (auskommentiert) | Vorbereitete Override-Stelle - aktuell deaktiviert (siehe Sektion 12) |
| `unsafeWindow.shared.animations.loadingAnimation.start` | Function | Shop-Page (`pagesIDShop`) | `Module/Shop.ts:393,520,585` | Save/Replace/Restore: Loading-Animation waehrend Bulk-Sell-Aktion unterdruecken |
| `unsafeWindow.shared.animations.loadingAnimation.stop` | Function | Shop-Page | `Module/Shop.ts:394,521,586` | Save/Replace/Restore (analog) |
| `unsafeWindow.is_cheat_click` | Function (Cheat-Detector) | jede Page (alte Pfad-Variante) | `Utils/Utils.ts:109` (auskommentiert) | Veraltete Override-Stelle |
| `unsafeWindow.hh_nutaku` | Boolean/Truthy | NHH/NPH Nutaku-Build | `Service/PageNavigationService.ts:191`, `Service/StartService.ts:462` | Nutaku-Spezialfall: Session-Token via `?sess=` injizieren; postMessage("ImAlive") an parent |
| `unsafeWindow.hh_prices` | Objekt (Preis-Map z.B. `fight_cost_per_minute`) | jede Page (?) | `Module/Troll.ts:760,845` | Berechnung von `pricePerFight` fuer Auto-Buy von Combats |
| `unsafeWindow.has_contests_datas` | Boolean | Activities-Tab `contests` (Contests-Page) | `Service/AutoLoopActions.ts:420` | Indikator dass Contest-Claims abholbar sind |
| `unsafeWindow.contests_timer.next_contest` | Number (sec) | Contests-Page | `Module/Contest.ts:78,85` | Naechster Contest-Wechsel |
| `unsafeWindow.contests_timer.duration` | Number (sec) | Contests-Page | `Module/Contest.ts:79` | Contest-Dauer |
| `unsafeWindow.contests_timer.remaining_time` | Number (sec) | Contests-Page | `Module/Contest.ts:80,89` | Restzeit aktueller Contest |
| `unsafeWindow.daily_goals_list` | Array (KKDailyGoal) | DailyGoals-Tab | `Module/DailyGoals.ts:189,190,192` | Iteration ueber Daily-Goal-Tiers |
| `unsafeWindow.event_data` | Objekt (HHEventData) | Event-Page (`pagesIDEvent`) | `Module/Events/EventModule.ts:263,516` | Event-Girls und Event-Metadaten |
| `unsafeWindow.event_data.girls` | Array (KKEventGirl) | Event-Page | `Module/Events/EventModule.ts:516` | Liste der Event-Girls fuer Prioritaeten-UI |
| `unsafeWindow.current_event` | Objekt (HHEventData) | Event-Page (Fallback) | `Module/Events/EventModule.ts:263` | Fallback wenn `event_data` nicht gesetzt |
| `unsafeWindow.season_sec_untill_event_end` | Number (sec) | Season/SeasonArena-Page | `Module/Events/Season.ts:51` | Restzeit Season-Event |
| `unsafeWindow.hero_data` | Objekt | SeasonArena-Page | `Module/Events/Season.ts:138` | Hero-Block fuer Arena-Reload |
| `unsafeWindow.opponents` | Array | SeasonArena-Page | `Module/Events/Season.ts:139` | Aktuelle Arena-Gegner-Liste |
| `unsafeWindow.seasonal_event_active` | Boolean | jede Page (?) | `Module/Events/Seasonal.ts:41` | Indikator: Seasonal-Event laeuft |
| `unsafeWindow.seasonal_time_remaining` | Number (sec) | jede Page (?) | `Module/Events/Seasonal.ts:41` | Restzeit Seasonal |
| `unsafeWindow.mega_event_active` | Boolean | jede Page (?) | `Module/Events/Seasonal.ts:41` | Indikator: Mega-Event laeuft |
| `unsafeWindow.mega_event_time_remaining` | Number (sec) | jede Page (?) | `Module/Events/Seasonal.ts:41` | Restzeit Mega-Event |
| `unsafeWindow.mega_event_data` (via `getHHVars`) | Objekt mit `cards` | Seasonal-Page | `Module/Events/Seasonal.ts:390` (`getHHVars('mega_event_data.cards')`) | Owned Mega-Event-Karten |
| `unsafeWindow.current_tier_number` | Number | League-Page | `Module/League.ts:74,78` | Aktuelles League-Tier |
| `unsafeWindow.opponents_list` (typed `KKPentaDrillOpponents[]`) | Array | PentaDrill-Page | `Module/PentaDrill.ts:109` | Penta-Drill-Gegner-Liste |
| `unsafeWindow.penta_drill_data.cycle_data.seconds_until_event_end` | Number (sec) | PentaDrill-Page | `Module/PentaDrill.ts:43` | Restzeit Penta-Drill-Event |
| `unsafeWindow.girl_squad` | Array (Labyrinth-Squad-Girls mit `remaining_ego_percent`) | Labyrinth-Pre-Battle / Labyrinth-Page | `Module/Labyrinth.ts:449` | Erkennt verletzte Squad-Girls |
| `unsafeWindow.teams_data` | Array (Teams) | Battle-Teams-Page (`pagesIDBattleTeams`) | `Module/TeamModule.ts:394,409` | Team-Definitionen (girls_ids, girls) |
| `unsafeWindow.pop_list` | Boolean | Activities-Tab `pop` (Powerplace-Liste sichtbar) | `Helper/PageHelper.ts:72` | Erkennt: Sind wir auf der Pop-Listen-Page |
| `unsafeWindow.pop_index` | Number | Activities-Tab `pop` (Pop selektiert) | `Helper/PageHelper.ts:79` | Aktuell selektierte Pop-Instanz |
| `unsafeWindow.harem` (impliziert via Kommentaren) | Objekt mit `preselectedGirlId` | Harem-Page | `Module/harem/Harem.ts:476,503,513,528` (Kommentar-Hint - effektiv via DOM gelesen) | Im Code wird via `$('#harem_right .opened').attr('girl')` ersatzweise gelesen, der Kommentar dokumentiert die zugehoerige unsafeWindow-Variable |
| `unsafeWindow.girl` | Objekt (KKHaremGirl) | GirlPage (`pagesIDGirlPage`) | `Module/harem/HaremGirl.ts:66` (`HaremGirl.getCurrentGirl()`) | Aktuell angezeigtes Harem-Girl |
| `unsafeWindow.id_girl` | Number/String | GirlPage | `Module/harem/HaremGirl.ts:237` | ID des Girls (fuer Navigation zurueck) |
| `unsafeWindow.player_gems_amount` | Map `{element: {amount: number}}` | GirlPage | `Module/harem/HaremGirl.ts:176,498,512` | Gem-Bestand pro Element fuer Awakening-Pruefung |
| `unsafeWindow.Hero.currencies.soft_currency` | Number | jede Page (auskommentiert) | `Module/Market.ts:266` (Kommentar) | Veralteter Direktzugriff (heute via `Hero.update`) |

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
| `Hero.infos.id` | `shared.Hero.infos.id` | Player-ID | `Helper/HeroHelper.ts:88` | `HeroHelper.getPlayerId()` |
| `Hero.infos.class` | `shared.Hero.infos.class` | Hero-Klasse 1-3 | `Helper/HeroHelper.ts:92` | `HeroHelper.getClass()` |
| `Hero.infos.level` | `shared.Hero.infos.level` | Level | `Helper/HeroHelper.ts:96` | `HeroHelper.getLevel()` |
| `Hero.infos.carac1` | `shared.Hero.infos.carac1` | Stat 1 (Hardcore) | `Helper/HeroHelper.ts:40` | Stat-Upgrade-Berechnung |
| `Hero.infos.carac2` | `shared.Hero.infos.carac2` | Stat 2 (Charm) | `Helper/HeroHelper.ts:40` | Stat-Upgrade |
| `Hero.infos.carac3` | `shared.Hero.infos.carac3` | Stat 3 (Knowhow) | `Helper/HeroHelper.ts:40` | Stat-Upgrade |
| `Hero.infos.hc_confirm` | `shared.Hero.infos.hc_confirm` | Hardcore-Bestaetigung an/aus | `Module/Troll.ts:439,737` | Verhindert versehentliche Koban-Spends |
| `Hero.infos.questing.id_world` | `shared.Hero.infos.questing.id_world` | Aktuelle Welt | `Service/StartService.ts:229`, `Module/Quest.ts:55`, `Module/Troll.ts:103,120,123`, `Module/PlaceOfPower.ts:46`, `Service/ParanoiaService.ts:170`, `Module/GenericBattle.ts:49` | Welt-ID fuer Quest/Troll/POP-Logik |
| `Hero.infos.questing.id_quest` | `shared.Hero.infos.questing.id_quest` | Aktuelle Quest | `Module/Quest.ts:56` | Quest-Fortschritt |
| `Hero.infos.questing.current_url` | `shared.Hero.infos.questing.current_url` | URL der aktuellen Quest | `Module/Quest.ts:54` | Direkt-Navigation |
| `Hero.infos.questing.choices_adventure` | `shared.Hero.infos.questing.choices_adventure` | 0 = Main, sonst Side | `Service/StartService.ts:228`, `Module/Troll.ts:118,174` | Erkennt Main vs Side Adventure |
| `Hero.currencies.soft_currency` | `shared.Hero.currencies.soft_currency` | Ymens | `Helper/HeroHelper.ts:100` | `HeroHelper.getMoney()` |
| `Hero.currencies.hard_currency` | `shared.Hero.currencies.hard_currency` | Kobans | `Helper/HeroHelper.ts:104` | `HeroHelper.getKoban()` |
| `Hero.energies.kiss.amount` | `shared.Hero.energies.kiss.amount` | Aktuelle Kisses | `Module/Events/Season.ts:65` | Season-Energy |
| `Hero.energies.kiss.max_regen_amount` | `shared.Hero.energies.kiss.max_regen_amount` | Max Kisses | `Module/Events/Season.ts:69` | Season-Energy-Cap |
| `Hero.energies.kiss.next_refresh_ts` | `shared.Hero.energies.kiss.next_refresh_ts` | Naechster Refresh | `Module/Events/Season.ts:434`, `Service/AutoLoopActions.ts:613,619`, `Service/ParanoiaService.ts:190` | Timer fuer Energy-Refill |
| `Hero.energies.kiss.seconds_per_point` | `shared.Hero.energies.kiss.seconds_per_point` | Regen-Rate | `Service/ParanoiaService.ts:190` | Berechnung "Punkte vor Switch" |
| `Hero.energies.fight.amount` | `shared.Hero.energies.fight.amount` | Aktuelle Combats | `Module/Troll.ts:42` | Troll-Battles |
| `Hero.energies.fight.max_regen_amount` | `shared.Hero.energies.fight.max_regen_amount` | Max Combats | `Module/Troll.ts:46` | Troll-Cap |
| `Hero.energies.fight.next_refresh_ts` | `shared.Hero.energies.fight.next_refresh_ts` | Naechster Combat-Refresh | `Service/ParanoiaService.ts:171` | Paranoia-Berechnung |
| `Hero.energies.fight.seconds_per_point` | `shared.Hero.energies.fight.seconds_per_point` | Combat-Regen-Rate | `Service/ParanoiaService.ts:171` | Paranoia-Berechnung |
| `Hero.energies.challenge.amount` | `shared.Hero.energies.challenge.amount` | Aktuelle Challenges (League) | `Module/League.ts:174` | League-Energy |
| `Hero.energies.challenge.max_regen_amount` | `shared.Hero.energies.challenge.max_regen_amount` | Max Challenges | `Module/League.ts:178` | League-Cap |
| `Hero.energies.challenge.next_refresh_ts` | `shared.Hero.energies.challenge.next_refresh_ts` | League-Refresh | `Module/League.ts:685`, `Service/ParanoiaService.ts:136` | Timer |
| `Hero.energies.challenge.seconds_per_point` | `shared.Hero.energies.challenge.seconds_per_point` | League-Regen | `Service/ParanoiaService.ts:136` | Paranoia |
| `Hero.energies.quest.amount` | `shared.Hero.energies.quest.amount` | Aktuelle Quest-Energy | `Module/Quest.ts:31` | Quest-Trigger |
| `Hero.energies.quest.max_regen_amount` | `shared.Hero.energies.quest.max_regen_amount` | Max Quest-Energy | `Module/Quest.ts:35` | Quest-Cap |
| `Hero.energies.quest.next_refresh_ts` | `shared.Hero.energies.quest.next_refresh_ts` | Quest-Refresh | `Service/ParanoiaService.ts:154` | Paranoia |
| `Hero.energies.quest.seconds_per_point` | `shared.Hero.energies.quest.seconds_per_point` | Quest-Regen | `Service/ParanoiaService.ts:154` | Paranoia |
| `Hero.energies.worship.amount` | `shared.Hero.energies.worship.amount` | Aktuelle Worship (Pantheon) | `Module/Pantheon.ts:34` | Pantheon-Energy |
| `Hero.energies.worship.max_regen_amount` | `shared.Hero.energies.worship.max_regen_amount` | Max Worship | `Module/Pantheon.ts:38` | Pantheon-Cap |
| `Hero.energies.worship.next_refresh_ts` | `shared.Hero.energies.worship.next_refresh_ts` | Worship-Refresh | `Module/Pantheon.ts:125,131,172,178`, `Service/AutoLoopActions.ts:677,683`, `Service/ParanoiaService.ts:207` | Timer |
| `Hero.energies.worship.seconds_per_point` | `shared.Hero.energies.worship.seconds_per_point` | Worship-Regen | `Service/ParanoiaService.ts:207` | Paranoia |
| `Hero.energies.drill.amount` | `shared.Hero.energies.drill.amount` | Drill-Energy (PentaDrill) | `Module/PentaDrill.ts:52` | PentaDrill |
| `Hero.energies.drill.max_regen_amount` | `shared.Hero.energies.drill.max_regen_amount` | Max Drill | `Module/PentaDrill.ts:56` | PentaDrill-Cap |
| `Hero.energies.drill.next_refresh_ts` | `shared.Hero.energies.drill.next_refresh_ts` | Drill-Refresh | `Module/PentaDrill.ts:194`, `Service/AutoLoopActions.ts:645,651` | Timer |
| `server_now_ts` | `unsafeWindow.server_now_ts` (kein Hero-Praefix - keine `shared.` Umschreibung) | Server-Zeitstempel (sec) | `Module/Booster.ts:310,327,423,670` | Booster-Endzeit-Berechnung |
| `championData.team` | `unsafeWindow.championData.team` | Aktuell selektiertes Champ-Team | `Module/Champion.ts:76,312` | Champion-Battle-Team-Logik |
| `championData.champion.id` | `unsafeWindow.championData.champion.id` | ID des aktuellen Champions | `Module/Champion.ts:313,398` | Team-Save-Slot |
| `championData.champion.poses` | `unsafeWindow.championData.champion.poses` | Erforderliche Posen-Liste | `Module/Champion.ts:83` | Team-Auswahl |
| `championData.freeDrafts` | `unsafeWindow.championData.freeDrafts` | Free-Reroll-Counter | `Module/Champion.ts:78` | Champion-Reroll |
| `championData.hero_damage` | `unsafeWindow.championData.hero_damage` | Schaden des Heroes | `Module/Champion.ts:175` | Champion-Battle-Resultat |
| `championData.fight.active` | `unsafeWindow.championData.fight.active` | Club-Champ-Fight aktiv | `Module/ClubChampion.ts:139` | ClubChamp-State |
| `championData.fight.participants` | `unsafeWindow.championData.fight.participants` | Liste Club-Champ-Teilnehmer | `Module/ClubChampion.ts:140` | ClubChamp-Logik |
| `Chat_vars.CLUB_INFO.id_club` | `unsafeWindow.Chat_vars.CLUB_INFO.id_club` | Club-ID des Spielers | `Module/Club.ts:27` | Club-Status |
| `opponents_list` | `unsafeWindow.opponents_list` | League-Gegner-Liste | `Module/League.ts:270,543,810` | League-Battle |
| `availableGirls` | `unsafeWindow.availableGirls` | Map aller Girls (Variante 1) | `Module/TeamModule.ts:458`, `Module/harem/Harem.ts:99,179,641` | Girl-Daten-Quelle |
| `girlsDataList` | `unsafeWindow.girlsDataList` | Map aller Girls (Variante 2) | `Module/harem/Harem.ts:105,135,241,265` | Girl-Daten-Quelle |
| `girls_data_list` | `unsafeWindow.girls_data_list` | Map aller Girls (Variante 3 - PSH) | `Module/harem/Harem.ts:102,179,289,641` | Girl-Daten-Quelle (psh-Build) |
| `shared.GirlSalaryManager.girlsMap` | `unsafeWindow.shared.GirlSalaryManager.girlsMap` | Live-Girl-Map des Salary-Managers | `Module/harem/Harem.ts:64,240,339` | Salary-Manager-Bridge |
| `shared.GirlSalaryManager.girlsListSec` | `unsafeWindow.shared.GirlSalaryManager.girlsListSec` | Sekundaere Girl-Liste | `Module/harem/Harem.ts:242,266` | Salary-Manager-Bridge |
| `salary_collect` | `unsafeWindow.salary_collect` | Aufsummierte Salary | `Module/harem/HaremSalary.ts:33` | Salary-Tag |
| `current_event.event_data.puzzle_pieces` | `unsafeWindow.current_event.event_data.puzzle_pieces` | LivelyScene-Puzzle-Pieces | `Module/Events/LivelyScene.ts:65,158` | LivelyScene-Loesung |
| `mega_event_data.cards` | `unsafeWindow.mega_event_data.cards` | Owned Mega-Event-Karten | `Module/Events/Seasonal.ts:390` | Seasonal-Event-Status |

Hinweis: `getHHVars` liefert bei Nichtexistenz `null` und loggt (auf Wunsch unterdrueckbar via 2. Parameter `logging=false`). Beispiele dafuer im Code: `getHHVars("availableGirls", false)`, `getHHVars("Chat_vars.CLUB_INFO.id_club", false)`, `getHHVars("girlsDataList", false)`, `getHHVars("girls_data_list", false)`.

## 3. AJAX-Actions (Request-seitig)

Alle `action: "..."` Strings, die der Skript-Code aktiv versendet (via `getHHAjax()` oder gleichwertigen Wrappern).
Es ist NICHT Liste der von der Webseite selbst gesendeten Actions - dafuer siehe Sektion 4.

| action-String | Weitere Parameter | Datei | Wofuer |
|---|---|---|---|
| `hero_update_stats` | `carac: "carac1"\|"carac2"\|"carac3"`, `nb: <mult>` (1/10/30/60) | `Helper/HeroHelper.ts:69-73` | Stat-Punkt-Upgrade |
| `market_equip_booster` | `id_item: <num>`, `type: "booster"` | `Helper/HeroHelper.ts:126-128` | Booster equippen (normal oder mythic) |
| `champion_team_reorder` | `champion_id`, weitere Team-Felder (siehe `setChampionTeam()`) | `Module/Champion.ts:319-321` | Champion-Team neu setzen |
| `do_battles_leagues` | `opponent_id`, `number_of_battles` | `Module/League.ts:830-834` | League-Battle starten (Mehrfach) |
| `market_buy` | `id_item`, `quantity`, `currency` | `Module/Market.ts:84,165,240` | Item kaufen (gift/potion/booster) |
| `market_auto_buy` | `id_item`, `quantity` | `Module/Market.ts:133,208` | Auto-Buy (Mass) |
| `girl_equipment_unequip_all_girls` | (kein Body) | `Module/TeamModule.ts:103` | Bei "Stuff Team" alle Girls vor Equip leeren |
| `girl_equipment_equip_all` | `id_team` (selektiert) | `Module/TeamModule.ts:351-353` | Equipment fuer alle Girls eines Teams |
| `loveraid` | (Submit-Wrapper - exakte Felder aus `LoveRaid.start()`) | `Service/AutoLoopActions.ts:254` | LoveRaid auslosen |
| `contest` | (Wrapper - Claim-Loop) | `Service/AutoLoopActions.ts:417` | Contest claim |
| `mission` | (Wrapper) | `Service/AutoLoopActions.ts:429` | Mission claim |
| `champion_buy_ticket` | `cost`/`quantity` (siehe `Champion.buyTicket()`) | `Service/AutoLoopActions.ts:702-704` | Champion-Ticket kaufen |
| `champion` | (Wrapper) | `Service/AutoLoopActions.ts:726` | Champion-Action |
| `clubChampion` | (Wrapper) | `Service/AutoLoopActions.ts:738` | Club-Champ-Action |
| `seasonal` | (Wrapper - Buy/Free-Card und Collect getrennt; siehe Sektion `pipeline`) | `Service/AutoLoopActions.ts:785,815` | Seasonal-Event-Aktionen |
| `bundle` | (Wrapper) | `Service/AutoLoopActions.ts:864` | Free-Bundles claim |
| `dailyGoals` | (Wrapper) | `Service/AutoLoopActions.ts:877` | DailyGoals claim |
| `labyrinth` | (Wrapper) | `Service/AutoLoopActions.ts:890` | Labyrinth-Action |
| `get_girls_blessings` | (kein Body) | `Service/BlessingService.ts:41` | Blessing-Daten anfragen + cachen |
| `arena_reload` | `opponent_id` (chosenID) | `Module/Events/Season.ts:368` | Season-Arena-Reload (Reroll) |
| `girl_skills_reset` | `id_girl` | `Module/harem/Harem.ts:432` | Skill-Reset eines Girls |
| `girl_equipment_equip` | `id_girl_equipment`, `id_girl` | `Module/harem/HaremGirl.ts:834` | Einzelnes Equipment auf Girl |

Zusaetzlich werden viele weitere Game-Actions vom Spiel selbst gesendet (z.B. `do_battles_trolls`, `do_battles_seasons`, `start` (TempPlaceOfPower), `market_equip_booster` ohne unsere Initiierung). Diese werden in Sektion 4 ueber `onAjaxResponse`-Hooks abgegriffen.

## 4. AJAX-Response-Interceptors (`onAjaxResponse`)

`onAjaxResponse(pattern, callback)` aus `Utils/Utils.ts:25-37` haengt sich global an `$(document).ajaxComplete`.
Trigger: `opt.data` (Request-Body) matched die uebergebene Regex.
Skip-Bedingungen: kein `xhr.responseText`, oder `responseData.success !== true`.
Definition: einziger Aufruf in `Utils/Utils.ts:26`.

| Regex | Was wird getan | Wo gespeichert | Datei |
|---|---|---|---|
| `/(action\|class)/` | Praktisch jede Game-AJAX-Antwort. Parsed `equipped_booster` bei `action='market_equip_booster'`, dekrementiert Sandalwood `usages_remaining` bei `action='do_battles_trolls'`, filtert auslaufende Mythic-Booster, triggert `notifyBattleResponseProcessed()`. Bei beendetem Sandalwood + aktivierter SandalWood-Option: navigiert zu Shop. | `HHAuto_Temp_boosterStatus` (`{normal:[], mythic:[]}` JSON-stringified) und `HHAuto_Temp_sandalwoodMaxUsages` | `Module/Booster.ts:113-289` (`Booster.collectBoostersFromAjaxResponses`) |
| `/action=get_girls_blessings/i` | Wartet 200 ms, dann injiziert externen Spreadsheet-Link `<a class="hhauto-spreadsheet-link">` in `#blessings_popup .blessings_wrapper` | DOM-Injection (kein Storage) | `Module/Spreadsheet.ts:34-45` |
| Beliebig (Definition) | (Implementation) - gibt Pattern + Callback ans `ajaxComplete`-Hook | - | `Utils/Utils.ts:26` |

Hinweis: `Booster.collectBoostersFromAjaxResponses()` wird einmalig in `StartService.start()` (Zeile mit `Booster.collectBoostersFromAjaxResponses();`) registriert; der Listener bleibt fuer alle nachfolgenden AJAX-Calls aktiv.

## 5. DOM-Quellen mit `data-d`-Attribut (JSON-Inhalt)

`data-d` ist die zentrale Konvention der Spielseite, JSON-Item-Daten direkt am DOM-Knoten zu speichern.
Felder im JSON: `quantity`, `item.{id_item, type, identifier, rarity, price, currency, value, carac1..3, endurance, chance, ego, damage, duration, skin, name, ico, display_price, name_add, subtype, ...}`.

| jQuery-Selector | Inhalt-Schema (Felder) | Page | Datei |
|---|---|---|---|
| `#shops div.armor.merchant-inventory-item .slot` | `{quantity, item:{id_item, type:"armor", identifier, rarity, name_add, subtype, carac1..3, ...}}` | Shop (`pagesIDShop`) | `Module/Shop.ts:52` |
| `#shops div.booster.merchant-inventory-item .slot` | `{quantity, item:{id_item, type:"booster", identifier, rarity, value, name, ...}}` | Shop | `Module/Shop.ts:53` |
| `#shops div.gift.merchant-inventory-item .slot` | `{quantity, item:{id_item, type:"gift", value, ...}}` | Shop | `Module/Shop.ts:54` |
| `#shops div.potion.merchant-inventory-item .slot` | `{quantity, item:{id_item, type:"potion", value, ...}}` | Shop | `Module/Shop.ts:55` |
| `#shops div.gift.player-inventory-content .slot` | `{quantity, item:{value, ...}}` | Shop | `Module/Shop.ts:60` |
| `#shops div.potion.player-inventory-content .slot` | `{quantity, item:{value, ...}}` | Shop | `Module/Shop.ts:61` |
| `#shops div.booster.player-inventory-content .slot` | `{quantity, item:{id_item, identifier, name, rarity}}` | Shop | `Module/Shop.ts:64` |
| `#equiped .booster .slot:not(.empty):not(.mythic)` (jQ `.data('d')`) | Normal-Booster-Slot (mit `expiration`) | Shop | `Module/Booster.ts:298` |
| `#equiped .booster .slot:not(.empty).mythic` (jQ `.data('d')`) | Mythic-Booster-Slot (mit `usages_remaining`, `lifetime`) | Shop | `Module/Booster.ts:299` |
| `#player-inventory.armor .slot:not(.empty)[data-d*='"rarity":"mythic"']` (Selector-Inhalts-Match) | Filter ueber Substring-Match in `data-d` | Shop | `Module/Shop.ts:171` |
| `[data-d*='"name_add":<X>']` (dyn. Filter) | Filter nach Stat | Shop | `Module/Shop.ts:173,296` |
| `[data-d*='"subtype":<X>']` (dyn. Filter) | Filter nach Item-Subtyp | Shop | `Module/Shop.ts:179,300` |
| `[data-d*='"rarity":"<X>"']` (dyn. Filter) | Filter nach Rarity | Shop | `Module/Shop.ts:183,304` |
| `#equiped .armor .slot[data-d*=<typesOfSets[idx]>]` | Equipped-Armor mit Set-Match | Shop (Sell-Loop) | `Module/Shop.ts:707` |
| Sell-Loop: `availableItems.filter('.selected')[0].getAttribute('data-d')` | Selektiertes Item pruefen | Shop | `Module/Shop.ts:673,716` |
| `.right-section .slot[data-d]` (Girl-Equipment-Liste) | `{item:{...}}` Equipment der Girl-Page | GirlPage / Girl-Equipment-Upgrade | `Module/harem/HaremGirl.ts:894,952,961,1017,1073` |
| `inSlot.getAttribute("data-d")` (generisch in `RewardHelper.parseRewards`) | Reward-Item-JSON (`{item:{type, identifier, rarity, value, ...}, quantity}`) - Beispiel siehe Code-Kommentar | beliebige Page mit Reward-Slots | `Helper/RewardHelper.ts:78` |

JSON-Schema-Beispiel aus `Helper/RewardHelper.ts:163` (Kommentar):
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

| Selector | Was extrahiert | Page | Datei |
|---|---|---|---|
| `document.getElementById(gameID)` mit `.getAttribute('page')` | Page-ID (`pagesIDXxx`) | jede Page | `Helper/PageHelper.ts:21,27` |
| `body[page][id]` `.attr('id')` | gameID fuer "unbekannte URL"-Popup | jede Page | `Helper/ConfigHelper.ts:23` (im Popup-Text) |
| `#activities-tabs > div.switch-tab.underline-tab.tab-switcher-fade-in[data-tab='contests']` | Erkennt Activities-Tab "Contests" | Activities-Page | `Helper/PageHelper.ts:45` |
| `[data-tab='missions']` (gleicher Container) | Erkennt Tab "Missions" | Activities-Page | `Helper/PageHelper.ts:49` |
| `[data-tab='daily_goals']` | Erkennt Tab "DailyGoals" | Activities-Page | `Helper/PageHelper.ts:53` |
| `[data-tab='pop']` | Erkennt Tab "PlaceOfPower" | Activities-Page | `Helper/PageHelper.ts:67` |
| `div.pop_list:not([style*="display:none"])` | Sichtbare PoP-Liste vorhanden | Activities/PoP | `Helper/PageHelper.ts:69-70` |
| `.pop_thumb_selected[pop_id]` `.attr('pop_id')` | Selektierte Pop-Instanz-ID | Activities/PoP | `Helper/PageHelper.ts:78` |

### 6.2 Login / Forbidden / Pre-Start Checks

| Selector | Was extrahiert | Page | Datei |
|---|---|---|---|
| `body[innerText='Forbidden']` | "Forbidden"-Errorpage erkennen | jede Page | `Service/StartService.ts:182` |
| `a[rel='phoenix_member_login']` | Login-Link sichtbar -> nicht eingeloggt | jede Page | `Service/StartService.ts:217` |

### 6.3 Team / Battle Teams

| Selector | Was extrahiert | Page | Datei |
|---|---|---|---|
| `.team-member-container[data-team-member-position="0"]` `.attr('data-girl-id')` | ID des Girls auf Position 0 | EditTeam | `Module/TeamModule.ts:380,383` |
| `.team-slot-container.selected-team` `.attr('data-team-index')` | Index des selektierten Teams | BattleTeams / EditTeam | `Module/TeamModule.ts:389,404` |
| `.team-member-container[data-team-member-position=N]` (N=0..6) | Slot per Position | EditTeam | `Module/TeamModule.ts:443` |
| `.team-member-container[data-girl-id="${girlId}"]` (addClass `selected`) | Girl per ID selektieren | EditTeam | `Module/TeamModule.ts:348` |

### 6.4 Labyrinth

| Selector | Was extrahiert | Page | Datei |
|---|---|---|---|
| `.player-panel .team-hexagon .team-member-container[data-girl-id="${girlId}"][data-team-member-position="${pos}"]` | Pruefung "Girl X auf Position Y" | EditLabyrinthTeam / Labyrinth | `Module/Labyrinth.ts:172` |
| `.player-panel .team-hexagon .team-member-container[data-girl-id="${girlId}"]` | Pruefung "Girl X im Squad" | Labyrinth | `Module/Labyrinth.ts:174` |
| `.team-hexagon .team-member-container.selectable[data-team-member-position="${pos}"]` | Selektierbarer Squad-Slot | EditLabyrinthTeam | `Module/Labyrinth.ts:179` |
| `(...)[data-girl-id]` `.attr('data-girl-id')` vergleichen mit `.attr('id_girl')` | Aktuelle Position vs Ziel | EditLabyrinthTeam | `Module/Labyrinth.ts:180` |
| `.opponent-power .opponent-power-text[data-power]` `.attr('data-power')` | Gegner-Power (Hex) | LabyrinthPreBattle | `Module/Labyrinth.ts:550` |
| `.player-panel .team-hexagon .team-member-container[data-girl-id]` `.length` | Squad-Groesse | Labyrinth | `Module/LabyrinthAuto.ts:219` |

### 6.5 League

| Selector | Was extrahiert | Page | Datei |
|---|---|---|---|
| `.league_content .data-list .data-column[sorting]` | Sortierbare Spalten-Header | Leaderboard | `Module/League.ts:240` |
| `.league_content .data-list` | League-Tabelle Container | Leaderboard | `Module/League.ts:364` |
| `.data-row.body-row:visible` (in League-Tabelle) | Sichtbare Gegner-Zeilen | Leaderboard | `Module/League.ts:370` |
| `getElementsByClassName("data-list")[0]` | Tabellen-Root (DOM-API) | Leaderboard | `Module/League.ts:420,439` |
| `.data-row body-row` (innerhalb) | Gegner-Liste | Leaderboard | `Module/League.ts:422,441` |
| `.data-column.head-column` (querySelectorAll) | Header-Zellen | Leaderboard | `Module/League.ts:488` |
| `.body-row .data-column[column="power"]` `.first().html()/.text()` | Power-Spalte (matchRating-Erkennung) | Leaderboard | `Module/League.ts:511` |
| `.data-list .data-row.body-row` | Alle Body-Rows | Leaderboard | `Module/League.ts:528` |
| `.data-column[column="power"] .matchRating-expected .matchRating-value` `.text()` | Erwartete Power | Leaderboard | `Module/League.ts:535` |
| `.data-column[column="power"]` `.text()` (mit `parsePrice`) | Plain-Power | Leaderboard | `Module/League.ts:537` |
| `.data-list .data-row.body-row a` `.length` | Noch zu kaempfende Gegner | Leaderboard | `Module/League.ts:541` |
| `.data-list .data-row.body-row.player-row .data-column[column="place"]` `.text()` | Eigener Rank | Leaderboard | `Module/League.ts:714` |
| `.data-list .data-row.body-row.player-row .data-column[column="player_league_points"]` `.text()` | Eigener Score | Leaderboard | `Module/League.ts:715` |
| `.data-list .data-row.body-row` `.length+1` | Total Players | Leaderboard | `Module/League.ts:719` |
| `.data-column[column="place"]:contains(N)` (filter) | Spezifischer Rang-Selector | Leaderboard | `Module/League.ts:731,777` |
| `.data-column[column="player_league_points"]` (parent.text) | Score zu Rang | Leaderboard | `Module/League.ts:737,783` |

### 6.6 Pantheon / Champion / Club Champion

| Selector | Was extrahiert | Page | Datei |
|---|---|---|---|
| `#pre-battle .battle-buttons .green_button_L.battle-action-button.pantheon-single-battle-button[data-pantheon-id='${id}']` | Pantheon-Single-Battle-Button | PantheonPreBattle | `Module/Pantheon.ts:143` |
| `.champions-over__champion-info.champions-animation .champion-pose` | Champion-Pose-Bilder fuer `getPoses()` | ChampionsPage / ChampionsMap | `Module/Champion.ts:83` |
| `div.club-champion-members-challenges .player-row .data-column:nth-of-type(3)` | Tickets-used pro Club-Member | ClubChampion | `Module/ClubChampion.ts:209` |

### 6.7 Pachinko

| Selector | Was extrahiert | Page | Datei |
|---|---|---|---|
| `#playzone-replace-info button[data-free="true"].blue_button_L` | Free-Pachinko-Button | Pachinko | `Module/Pachinko.ts:66` |
| `[girlsRewards].attr("data-rewards")` (JSON) | Anzahl Girls als Reward | Pachinko | `Module/Pachinko.ts:121` |

### 6.8 Troll-Battle / Pre-Battle

| Selector | Was extrahiert | Page | Datei |
|---|---|---|---|
| `#pre-battle .battle-buttons button.autofight[data-battles="10"]` | x10-Fight-Button | TrollPreBattle / generisch | `Module/Troll.ts:434` |
| `#pre-battle .battle-buttons button.autofight[data-battles="50"]` | x50-Fight-Button | TrollPreBattle | `Module/Troll.ts:435` |
| `#pre-battle .oponnent-panel .opponent_rewards .rewards_list .slot.girl_ico[data-rewards]` | Girl-Reward-Slots | TrollPreBattle | `Module/Troll.ts:458` |
| `[rewardGirlz].attr('data-rewards')` (JSON) | JSON-Liste Girl-Shards | TrollPreBattle | `Module/Troll.ts:459` |

### 6.9 Season / Seasonal / Events

| Selector | Was extrahiert | Page | Datei |
|---|---|---|---|
| `.season_arena_opponent_container[data-opponent=${id_fighter}]` | Block des selektierten Arena-Gegners | SeasonArena | `Module/Events/Season.ts:154,205,391` |
| `.slot.girl_ico[data-rewards]` (im Opponent-Block) | Girl-Shards-Reward | SeasonArena | `Module/Events/Season.ts:393` |
| `[data-select-girl-id=${id_girl}]` (in Daily-Mission/Event-Page) | Girl-Tile | Event-Page / Mission | `Module/Events/EventModule.ts:523,563,576` |
| `.hard-objective .redirect-buttons:has(button[data-href="/champions-map.html"])` | Champion-Goal-Block (Hard) | DoublePenetration-Event | `Module/Events/DoublePenetration.ts:163` |
| `.easy-objective .redirect-buttons:has(button[data-href="/champions-map.html"])` | Champion-Goal-Block (Easy) | DP-Event | `Module/Events/DoublePenetration.ts:167` |
| `#poa-content .buttons:has(button[data-href="/champions-map.html"])` | Champion-Goal-Block in PoA | PoA | `Module/Events/PathOfAttraction.ts:102` |
| `listPoATiersToClaim[i].getAttribute("data-nc-reward-id")` | PoA-Tier-Reward-ID | PoA | `Module/Events/PathOfAttraction.ts:168` |

### 6.10 Harem / Girl

| Selector | Was extrahiert | Page | Datei |
|---|---|---|---|
| `#harem_right .opened` `.attr('girl')` | Aktuell ausgewaehltes Girl-ID (Side-Panel) | Harem | `Module/harem/Harem.ts:476,503,513,528` |
| `#harem_right .opened .avatar-box:visible` `.length` | Girl ist ownership-bestaetigt | Harem | `Module/harem/Harem.ts:505,530` |
| `.select-group.${selector} .selectric-items li[data-index="${index}"]` (trigger click) | Selectric-Filter-Element | Harem | `Module/harem/HaremFilter.ts:35` |
| `#girl-leveler-tabs .switch-tab[data-tab="${haremItem}"]` | Girl-Leveler-Tab | GirlPage | `Module/harem/HaremGirl.ts:78` |
| `.hhava` `.length` | Eigene Avatar-Marker bereits gerendert | Harem | `Module/harem/Harem.ts:527` |

### 6.11 Markt / Shop / Inventory (Timer + Toolbar)

| Selector | Was extrahiert | Page | Datei |
|---|---|---|---|
| `.shop div.shop_count span[rel="expires"]` `.first().text()` | Shop-Refresh-Timer (HH:MM:SS) | Shop | `Module/Shop.ts:81` (siehe `convertTimeToInt`) |
| `#girls_list .g1 .nav_placement span:not([contenteditable])` | Shop-Girl-Count | Shop | `HHEnvVariables.ts:62` (`shopGirlCountRequest`) |
| `#girls_list .g1 .nav_placement span[contenteditable]` | Aktueller Shop-Girl-Index | Shop | `HHEnvVariables.ts:63` (`shopGirlCurrentRequest`) |

### 6.12 Sonstige UI-Lookups (Timer, Reward-Banner, etc.)

| Selector | Was extrahiert | Page | Datei |
|---|---|---|---|
| `#contains_all header .currency .daily-reward-notif` | Daily-Reward-Notification | jede Page | `HHEnvVariables.ts:57` (`dailyRewardNotifRequest`) |
| `#edit-team-page` (id-Selector) | EditTeam-Panel-Container | EditTeam | `HHEnvVariables.ts:60` (`IDpanelEditTeam`) |
| `#claim-all:not([disabled]):visible:not([style*='visibility: hidden;'])` | "Claim All"-Button | beliebig | `HHEnvVariables.ts:65` (`selectorClaimAllRewards`) |
| `[PoVPoG-Slot].attr('data-time-stamp')` | Timestamp eines PoV/PoG-Tier-Slots | PoV / PoG | `HHEnvVariables.ts:73` (`PoVPoGTimestampAttributeName`) |
| `[girl-tile].attr('data-new-girl-tooltip')` | New-Girl-Tooltip-Daten | beliebige Page mit Girl-Slots | `HHEnvVariables.ts:58` (`girlToolTipData`) |
| `:not([style*="display:none"]):not([style*="display: none"])` | Filter "nicht versteckt" (generisches Suffix) | jede Page | `HHEnvVariables.ts:64` (`selectorFilterNotDisplayNone`) |

## 7. localStorage / Storage-Keys

 `getStoredValue` / `getStoredJSON` lesen, `setStoredValue` schreibt, `deleteStoredValue` loescht.
  Alle Keys sind mit `HHStoredVarPrefixKey` (Default: `HHAuto_`) praefixiert; das Praefix wird in den Tabellen unten weggelassen.
  Wichtig: Nicht in `HHStoredVars.ts` registrierte Keys werden lautlos verworfen - siehe Hinweis im File.

  Storage-Backing (siehe `HHStoredVars.ts`): `localStorage` direkt, `sessionStorage` direkt, oder `Storage()` (gating ueber `SK.settPerTab` -> sessionStorage, sonst localStorage). Settings sind in der Regel `Storage()`, Temp-Vars meist `sessionStorage`.

  | Key (SK.x oder TK.x) | Inhalt / Zweck | Wo geschrieben (set) | Wo geloescht (delete) | Wo gelesen (get) |
  |---|---|---|---|---|
| `SK.AllMaskRewards` | Master-Toggle: alle Reward-Masken (PoA/PoG/PoV/Season/Seasonal) global an/aus | Service/StartService.ts | - | Module/Events/PathOfAttraction.ts, Module/Events/Season.ts, Module/Events/Seasonal.ts, Module/PentaDrill.ts, Service/AutoLoopPageHandlers.ts |
| `SK.PoAMaskRewards` | Veraltet (vor 7.26.0). Wird beim Migrieren in AllMaskRewards aufgeloest. | (nur init/storage-Helper) | Service/StartService.ts | Service/StartService.ts |
| `SK.PoGMaskRewards` | Veraltet (vor 7.26.0). | (nur init/storage-Helper) | Service/StartService.ts | Service/StartService.ts |
| `SK.PoVMaskRewards` | Veraltet (vor 7.26.0). | (nur init/storage-Helper) | Service/StartService.ts | Service/StartService.ts |
| `SK.SeasonMaskRewards` | Veraltet (vor 7.26.0). | (nur init/storage-Helper) | Service/StartService.ts | Service/StartService.ts |
| `SK.SeasonalEventMaskRewards` | Veraltet (vor 7.26.0). | (nur init/storage-Helper) | Service/StartService.ts | Service/StartService.ts |
| `SK.autoAff` | Schwelle Affection-Auto-Use (Ymen-Limit) | (nur init/storage-Helper) | - | Module/Market.ts |
| `SK.autoAffW` | Auto-Aff-Switch (an/aus) | (nur init/storage-Helper) | - | Module/Market.ts |
| `SK.autoBuildChampsTeam` | Champion-Team automatisch aufbauen | (nur init/storage-Helper) | - | Module/Champion.ts, Module/ClubChampion.ts |
| `SK.autoBuyBoosters` | Auto-Buy normale Booster | (nur init/storage-Helper) | - | Module/Market.ts |
| `SK.autoBuyBoostersFilter` | Filter, welche Booster-Typen gekauft werden duerfen | (nur init/storage-Helper) | - | Module/Market.ts |
| `SK.autoBuyLoveRaidTrollNumber` | Anzahl LoveRaid-Combats pro Buy | (nur init/storage-Helper) | - | Module/Troll.ts |
| `SK.autoBuyMythicTrollNumber` | Anzahl Mythic-Combats pro Buy | (nur init/storage-Helper) | - | Module/Troll.ts |
| `SK.autoBuyTrollNumber` | Anzahl normale Combats pro Buy | (nur init/storage-Helper) | - | Module/Troll.ts |
| `SK.autoChampAlignTimer` | Champion-Timer mit Battle-Timer ausrichten | (nur init/storage-Helper) | - | Module/Champion.ts, Module/ClubChampion.ts |
| `SK.autoChamps` | Auto-Champions aktiviert | (nur init/storage-Helper) | - | Module/ClubChampion.ts, Service/AutoLoopActions.ts, Service/AutoLoopPageHandlers.ts, Service/InfoService.ts |
| `SK.autoChampsFilter` | Champion-Filter (welche Champs) | (nur init/storage-Helper) | - | Module/Champion.ts |
| `SK.autoChampsForceStart` | Champion-Force-Start ohne Timer | (nur init/storage-Helper) | - | Module/Champion.ts |
| `SK.autoChampsForceStartEventGirl` | Force-Start nur bei Event-Girl | (nur init/storage-Helper) | - | Module/Champion.ts |
| `SK.autoChampsGirlThreshold` | Mindest-Girl-Threshold fuer Champ-Run | (nur init/storage-Helper) | - | Module/Champion.ts |
| `SK.autoChampsTeamKeepSecondLine` | 2. Team-Line beibehalten | (nur init/storage-Helper) | - | Module/Champion.ts |
| `SK.autoChampsTeamLoop` | Team-Loop-Anzahl | (nur init/storage-Helper) | - | Module/Champion.ts |
| `SK.autoChampsUseEne` | Energy verwenden | (nur init/storage-Helper) | - | Module/Champion.ts, Service/AutoLoopActions.ts |
| `SK.autoClubChamp` | Auto-Club-Champ aktiviert | (nur init/storage-Helper) | - | Module/Champion.ts, Module/ClubChampion.ts, Service/AutoLoopActions.ts, Service/InfoService.ts |
| `SK.autoClubChampMax` | Max Tickets pro Run | (nur init/storage-Helper) | - | Module/ClubChampion.ts |
| `SK.autoClubForceStart` | Force-Start Club-Champ | (nur init/storage-Helper) | - | Module/ClubChampion.ts |
| `SK.autoContest` | Auto-Contest aktiviert | (nur init/storage-Helper) | - | Service/AutoLoopActions.ts, Service/InfoService.ts |
| `SK.autoDailyGoals` | Auto-DailyGoals aktiviert | (nur init/storage-Helper) | - | Module/DailyGoals.ts |
| `SK.autoDailyGoalsCollect` | DailyGoals-Rewards einsammeln | (nur init/storage-Helper) | - | Module/DailyGoals.ts, Service/AutoLoopActions.ts |
| `SK.autoDailyGoalsCollectablesList` | Welche Reward-Typen einsammeln (JSON-Array) | (nur init/storage-Helper) | - | Module/DailyGoals.ts |
| `SK.autoEquipBoosters` | Boosters automatisch ausruesten | (nur init/storage-Helper) | - | Module/Booster.ts, Service/AutoLoopActions.ts, Service/InfoService.ts |
| `SK.autoEquipBoostersSlots` | Slot-Reihenfolge (z.B. B1;B2;B3;B4) | (nur init/storage-Helper) | - | Module/Booster.ts |
| `SK.autoExp` | Schwelle XP-Auto-Use | (nur init/storage-Helper) | - | Module/Market.ts |
| `SK.autoExpW` | Auto-XP-Switch | (nur init/storage-Helper) | - | Module/Market.ts |
| `SK.autoFreeBundlesCollect` | Freie Bundles einsammeln | (nur init/storage-Helper) | - | Module/Bundles.ts, Service/AutoLoopActions.ts |
| `SK.autoFreePachinko` | Auto-Free-Pachinko | (nur init/storage-Helper) | - | Service/AutoLoopActions.ts, Service/InfoService.ts |
| `SK.autoLabyCustomTeamBuilder` | Labyrinth-Custom-Team-Builder verwenden | (nur init/storage-Helper) | - | Module/Labyrinth.ts, Module/LabyrinthAuto.ts |
| `SK.autoLabyDifficultyIndex` | Labyrinth-Schwierigkeit (selectedIndex) | (nur init/storage-Helper) | - | Module/LabyrinthAuto.ts |
| `SK.autoLabyHard` | Labyrinth-Hard-Mode (Reward-Wahl haerter) | (nur init/storage-Helper) | - | Module/Labyrinth.ts |
| `SK.autoLabySweep` | Labyrinth-Sweep-Mode | (nur init/storage-Helper) | - | Module/LabyrinthAuto.ts |
| `SK.autoLabyrinth` | Auto-Labyrinth aktiviert | Module/LabyrinthAuto.ts | - | Module/GenericBattle.ts, Service/AutoLoopActions.ts, Service/InfoService.ts |
| `SK.autoLeagues` | Auto-Leagues aktiviert | (nur init/storage-Helper) | - | Module/GenericBattle.ts, Module/League.ts, Service/InfoService.ts |
| `SK.autoLeaguesAllowWinCurrent` | Sieg im aktuellen Tier zulassen | (nur init/storage-Helper) | - | Module/League.ts |
| `SK.autoLeaguesBoostedOnly` | Nur mit Boostern kaempfen | (nur init/storage-Helper) | - | Module/Booster.ts, Module/League.ts |
| `SK.autoLeaguesCollect` | League-Reward einsammeln | (nur init/storage-Helper) | - | Module/League.ts |
| `SK.autoLeaguesForceOneFight` | Mindestens 1 Fight erzwingen | (nur init/storage-Helper) | - | Module/League.ts |
| `SK.autoLeaguesRunThreshold` | Run-Threshold Leagues | (nur init/storage-Helper) | - | Module/League.ts |
| `SK.autoLeaguesSecurityThreshold` | Security-Threshold Leagues | (nur init/storage-Helper) | - | Module/League.ts |
| `SK.autoLeaguesSelectedIndex` | Selektierter Tier-Index | (nur init/storage-Helper) | - | Module/League.ts |
| `SK.autoLeaguesSortIndex` | League-Sort-Mode (Index) | (nur init/storage-Helper) | - | Module/League.ts, Service/StartService.ts |
| `SK.autoLeaguesThreshold` | Threshold Leagues | (nur init/storage-Helper) | - | Module/League.ts |
| `SK.autoLivelySceneEventCollect` | LivelyScene Reward sammeln | Module/Events/EventModule.ts | - | Module/Events/EventModule.ts, Module/Events/LivelyScene.ts |
| `SK.autoLivelySceneEventCollectAll` | LivelyScene Alle Rewards | (nur init/storage-Helper) | - | Module/Events/LivelyScene.ts |
| `SK.autoLivelySceneEventCollectablesList` | Welche LivelyScene-Rewards (JSON) | (nur init/storage-Helper) | - | Module/Events/LivelyScene.ts |
| `SK.autoLoveRaidSelectedIndex` | Selektierte LoveRaid-Variante | Module/Events/LoveRaidManager.ts, Module/Troll.ts | config/HHStoredVars.ts | Module/Events/LoveRaidManager.ts |
| `SK.autoMission` | Auto-Mission aktiviert | (nur init/storage-Helper) | - | Service/AutoLoopActions.ts, Service/InfoService.ts |
| `SK.autoMissionCollect` | Mission-Rewards einsammeln | (nur init/storage-Helper) | - | Module/Missions.ts |
| `SK.autoMissionKFirst` | KFirst-Mission-Mode | (nur init/storage-Helper) | - | Module/Missions.ts |
| `SK.autoPantheon` | Auto-Pantheon aktiviert | Module/Pantheon.ts | - | Module/GenericBattle.ts, Service/AutoLoopActions.ts, Service/InfoService.ts, Service/ParanoiaService.ts |
| `SK.autoPantheonBoostedOnly` | Nur mit Booster | (nur init/storage-Helper) | - | Module/Booster.ts, Module/Pantheon.ts |
| `SK.autoPantheonRunThreshold` | Pantheon Run-Threshold | (nur init/storage-Helper) | - | Module/Pantheon.ts |
| `SK.autoPantheonThreshold` | Pantheon Threshold | (nur init/storage-Helper) | - | Module/Pantheon.ts |
| `SK.autoPentaDrill` | Auto-PentaDrill aktiviert | (nur init/storage-Helper) | - | Module/GenericBattle.ts, Service/AutoLoopActions.ts, Service/InfoService.ts |
| `SK.autoPentaDrillBoostedOnly` | Nur mit Booster | (nur init/storage-Helper) | - | Module/PentaDrill.ts |
| `SK.autoPentaDrillCollect` | PentaDrill-Rewards einsammeln | (nur init/storage-Helper) | - | Module/PentaDrill.ts, Service/AutoLoopActions.ts |
| `SK.autoPentaDrillCollectAll` | PentaDrill alle Rewards | (nur init/storage-Helper) | - | Module/PentaDrill.ts, Service/AutoLoopActions.ts |
| `SK.autoPentaDrillCollectablesList` | Welche PentaDrill-Rewards (JSON) | (nur init/storage-Helper) | - | Module/PentaDrill.ts |
| `SK.autoPentaDrillRunThreshold` | PentaDrill Run-Threshold | (nur init/storage-Helper) | - | Module/PentaDrill.ts |
| `SK.autoPentaDrillThreshold` | PentaDrill Threshold | (nur init/storage-Helper) | - | Module/PentaDrill.ts |
| `SK.autoPoACollect` | PoA Rewards einsammeln | (nur init/storage-Helper) | - | Module/Events/PathOfAttraction.ts |
| `SK.autoPoACollectAll` | PoA alle Rewards | (nur init/storage-Helper) | - | Module/Events/PathOfAttraction.ts |
| `SK.autoPoACollectablesList` | Welche PoA-Rewards (JSON) | (nur init/storage-Helper) | - | Module/Events/PathOfAttraction.ts |
| `SK.autoPoGCollect` | PoG Rewards einsammeln | Module/Events/EventModule.ts | - | Module/Events/EventModule.ts, Module/Events/PathOfGlory.ts, Service/AutoLoopActions.ts, Service/InfoService.ts |
| `SK.autoPoGCollectAll` | PoG alle Rewards | Module/Events/EventModule.ts | - | Module/Events/EventModule.ts, Module/Events/PathOfGlory.ts, Service/AutoLoopActions.ts |
| `SK.autoPoGCollectablesList` | Welche PoG-Rewards (JSON) | (nur init/storage-Helper) | - | Module/Events/PathOfGlory.ts |
| `SK.autoPoVCollect` | PoV Rewards einsammeln | Module/Events/EventModule.ts | - | Module/Events/EventModule.ts, Module/Events/PathOfValue.ts, Service/AutoLoopActions.ts, Service/InfoService.ts |
| `SK.autoPoVCollectAll` | PoV alle Rewards | Module/Events/EventModule.ts | - | Module/Events/EventModule.ts, Module/Events/PathOfValue.ts, Service/AutoLoopActions.ts |
| `SK.autoPoVCollectablesList` | Welche PoV-Rewards (JSON) | (nur init/storage-Helper) | - | Module/Events/PathOfValue.ts |
| `SK.autoPowerPlaces` | Auto-PoP aktiviert | (nur init/storage-Helper) | - | Module/PlaceOfPower.ts, Service/InfoService.ts |
| `SK.autoPowerPlacesAll` | Alle Pops automatisch starten | (nur init/storage-Helper) | - | Module/PlaceOfPower.ts |
| `SK.autoPowerPlacesIndexFilter` | Pop-Filter (Index-Liste, semicolon) | Module/PlaceOfPower.ts | - | Module/PlaceOfPower.ts, Service/AutoLoopActions.ts |
| `SK.autoPowerPlacesInverted` | Filter-Logik invertiert | (nur init/storage-Helper) | - | Module/PlaceOfPower.ts |
| `SK.autoPowerPlacesPrecision` | Praezisions-Modus | (nur init/storage-Helper) | - | Module/PlaceOfPower.ts |
| `SK.autoPowerPlacesWaitMax` | Auf max. Wartezeit warten | (nur init/storage-Helper) | - | Module/PlaceOfPower.ts |
| `SK.autoQuest` | Auto-Quest aktiviert | Module/Troll.ts, Service/AutoLoopActions.ts | - | Module/Quest.ts, Service/AutoLoopActions.ts, Service/ParanoiaService.ts |
| `SK.autoQuestThreshold` | Quest-Threshold | (nur init/storage-Helper) | - | Service/AutoLoopActions.ts |
| `SK.autoSalary` | Auto-Salary aktiviert | (nur init/storage-Helper) | - | Service/AutoLoopActions.ts, Service/InfoService.ts |
| `SK.autoSalaryMinSalary` | Minimal-Salary fuer Auto-Run | (nur init/storage-Helper) | - | Module/harem/HaremSalary.ts |
| `SK.autoSeason` | Auto-Season aktiviert | (nur init/storage-Helper) | - | Module/GenericBattle.ts, Service/AutoLoopActions.ts, Service/InfoService.ts, Service/ParanoiaService.ts |
| `SK.autoSeasonBoostedOnly` | Season nur mit Booster | (nur init/storage-Helper) | - | Module/Booster.ts, Module/Events/Season.ts |
| `SK.autoSeasonCollect` | Season-Reward sammeln | (nur init/storage-Helper) | - | Module/Events/Season.ts, Service/AutoLoopActions.ts |
| `SK.autoSeasonCollectAll` | Season alle Rewards | (nur init/storage-Helper) | - | Module/Events/Season.ts, Service/AutoLoopActions.ts |
| `SK.autoSeasonCollectablesList` | Welche Season-Rewards (JSON) | (nur init/storage-Helper) | - | Module/Events/Season.ts |
| `SK.autoSeasonIgnoreNoGirls` | Season-Gegner ohne Girls ignorieren | (nur init/storage-Helper) | - | Module/Events/Season.ts, Service/ParanoiaService.ts |
| `SK.autoSeasonMaxTier` | Max-Tier-Stop verwenden | (nur init/storage-Helper) | - | Module/Events/Season.ts |
| `SK.autoSeasonMaxTierNb` | Max-Tier-Wert | (nur init/storage-Helper) | - | Module/Events/Season.ts |
| `SK.autoSeasonPassReds` | Rote (zu schwere) Gegner ueberspringen | (nur init/storage-Helper) | - | Module/Events/Season.ts |
| `SK.autoSeasonRunThreshold` | Season Run-Threshold | (nur init/storage-Helper) | - | Module/Events/Season.ts |
| `SK.autoSeasonSkipLowMojo` | Skip Gegner mit niedrigem Mojo | (nur init/storage-Helper) | - | Module/Events/Season.ts |
| `SK.autoSeasonThreshold` | Season Threshold | (nur init/storage-Helper) | - | Module/Events/Season.ts |
| `SK.autoSeasonalBuyFreeCard` | Seasonal: Free-Card kaufen | (nur init/storage-Helper) | - | Service/AutoLoopActions.ts |
| `SK.autoSeasonalEventCollect` | Seasonal Reward sammeln | Module/Events/EventModule.ts | - | Module/Events/EventModule.ts, Module/Events/Seasonal.ts, Service/AutoLoopActions.ts |
| `SK.autoSeasonalEventCollectAll` | Seasonal alle Rewards | Module/Events/EventModule.ts | - | Module/Events/EventModule.ts, Module/Events/Seasonal.ts, Service/AutoLoopActions.ts |
| `SK.autoSeasonalEventCollectablesList` | Welche Seasonal-Rewards (JSON) | (nur init/storage-Helper) | - | Module/Events/Seasonal.ts |
| `SK.autoSideQuest` | Auto-SideQuest aktiviert | Service/AutoLoopActions.ts | - | Module/Quest.ts, Service/AutoLoopActions.ts, Service/ParanoiaService.ts |
| `SK.autoStats` | Stat-Spend-Limit (Ymens) | (nur init/storage-Helper) | - | Helper/HeroHelper.ts |
| `SK.autoStatsSwitch` | Auto-Stats an/aus | (nur init/storage-Helper) | - | Service/StartService.ts |
| `SK.autoTrollBattle` | Auto-Troll aktiviert | Module/Troll.ts, Service/AutoLoopActions.ts | - | Module/Troll.ts, Service/AutoLoopActions.ts, Service/InfoService.ts, Service/ParanoiaService.ts, config/StorageKeys.ts |
| `SK.autoTrollLoveRaidByPassThreshold` | Bypass-Threshold fuer LoveRaid | (nur init/storage-Helper) | - | Module/Troll.ts |
| `SK.autoTrollMythicByPassParanoia` | Mythic-Bypass von Paranoia erlauben | (nur init/storage-Helper) | - | Service/ParanoiaService.ts |
| `SK.autoTrollMythicByPassThreshold` | Mythic-Bypass-Threshold | (nur init/storage-Helper) | - | Service/ParanoiaService.ts |
| `SK.autoTrollRunThreshold` | Troll Run-Threshold | (nur init/storage-Helper) | - | Module/Troll.ts, Service/AutoLoopActions.ts |
| `SK.autoTrollSelectedIndex` | Selektierter Troll (Index) | (nur init/storage-Helper) | - | Module/Troll.ts |
| `SK.autoTrollThreshold` | Troll Threshold | (nur init/storage-Helper) | - | Module/Troll.ts, Service/AutoLoopActions.ts, Service/ParanoiaService.ts |
| `SK.autodpEventCollect` | DP-Event Reward sammeln | Module/Events/EventModule.ts | - | Module/Events/DoublePenetration.ts, Module/Events/EventModule.ts |
| `SK.autodpEventCollectAll` | DP-Event alle Rewards | (nur init/storage-Helper) | - | Module/Events/DoublePenetration.ts |
| `SK.autodpEventCollectablesList` | Welche DP-Event-Rewards (JSON) | (nur init/storage-Helper) | - | Module/Events/DoublePenetration.ts |
| `SK.bossBangEvent` | BossBang Auto aktiviert | Module/Events/BossBang.ts | - | Module/Events/EventModule.ts, Service/AutoLoopActions.ts, Service/AutoLoopPageHandlers.ts |
| `SK.bossBangMinTeam` | Mindest-Team fuer BossBang | (nur init/storage-Helper) | - | Module/Events/BossBang.ts |
| `SK.buyCombTimer` | Auto-Buy-Combat Timer | (nur init/storage-Helper) | - | Module/Troll.ts |
| `SK.buyCombat` | Auto-Buy-Combat aktiviert | (nur init/storage-Helper) | - | Module/Troll.ts |
| `SK.buyLoveRaidCombat` | Auto-Buy LoveRaid-Combat | (nur init/storage-Helper) | - | Module/Troll.ts |
| `SK.buyMythicCombTimer` | Auto-Buy Mythic-Combat-Timer | (nur init/storage-Helper) | - | Module/Troll.ts |
| `SK.buyMythicCombat` | Auto-Buy Mythic-Combat | (nur init/storage-Helper) | - | Module/Troll.ts, Service/ParanoiaService.ts |
| `SK.collectAllTimer` | ClaimAll-Timer (Sekunden) | (nur init/storage-Helper) | - | Helper/TimeHelper.ts |
| `SK.collectEventChest` | Event-Chest abholen | (nur init/storage-Helper) | - | Module/Events/EventModule.ts |
| `SK.compactDailyGoals` | DailyGoals-UI kompakt | (nur init/storage-Helper) | - | Module/DailyGoals.ts |
| `SK.compactEndedContests` | Beendete Contests kompakt | (nur init/storage-Helper) | - | Module/Contest.ts |
| `SK.compactMissions` | Missions kompakt | (nur init/storage-Helper) | - | Module/Missions.ts |
| `SK.compactPowerPlace` | PoP kompakt | (nur init/storage-Helper) | - | Module/PlaceOfPower.ts |
| `SK.eventTrollOrder` | Reihenfolge der Event-Trolls | (nur init/storage-Helper) | - | Module/Events/EventModule.ts, Module/Events/MythicEvent.ts, Module/Events/PlusEvents.ts |
| `SK.hideOwnedGirls` | Owned Girls in Event-UI verstecken | (nur init/storage-Helper) | - | Module/Events/EventModule.ts |
| `SK.invertMissions` | Mission-Reihenfolge invertieren | (nur init/storage-Helper) | - | Module/Missions.ts |
| `SK.kobanBank` | Koban-Bank-Threshold (was nicht ausgegeben werden darf) | (nur init/storage-Helper) | - | Module/Events/Season.ts, Module/Market.ts, Module/Troll.ts |
| `SK.leagueListDisplayPowerCalc` | PowerCalc-Spalte in League-Liste anzeigen | (nur init/storage-Helper) | - | Module/League.ts, Service/StartService.ts |
| `SK.master` | Globaler Master-Switch (alles an/aus) | Helper/PageHelper.ts, Service/InfoService.ts, Service/StartService.ts | - | Helper/HHMenuHelper.ts, Service/AutoLoop.ts, Service/InfoService.ts, Service/Scheduler.ts |
| `SK.maxAff` | Max Aff Stack | (nur init/storage-Helper) | - | Module/Market.ts |
| `SK.maxBooster` | Max Booster im Storage | (nur init/storage-Helper) | - | Module/Market.ts |
| `SK.maxExp` | Max Exp Stack | (nur init/storage-Helper) | - | Module/Market.ts |
| `SK.minShardsX10` | Mindest-Shards fuer x10-Fight | (nur init/storage-Helper) | - | Module/Troll.ts |
| `SK.minShardsX50` | Mindest-Shards fuer x50-Fight | (nur init/storage-Helper) | - | Module/Troll.ts |
| `SK.mousePause` | Maus-Pause aktivieren | (nur init/storage-Helper) | - | Service/StartService.ts |
| `SK.mousePauseTimeout` | Maus-Pause-Timeout (ms) | (nur init/storage-Helper) | - | Service/MouseService.ts |
| `SK.paranoia` | Paranoia-Mode aktiv | (nur init/storage-Helper) | - | Module/Shop.ts, Service/AutoLoop.ts, Service/AutoLoopActions.ts, Service/InfoService.ts |
| `SK.paranoiaSettings` | Paranoia-Einstellungen JSON | (nur init/storage-Helper) | - | Service/ParanoiaService.ts |
| `SK.paranoiaSpendsBefore` | Paranoia-Spend-Verzeichnis JSON | (nur init/storage-Helper) | - | Service/ParanoiaService.ts |
| `SK.plusEvent` | +Event Bonus aktiv | (nur init/storage-Helper) | - | Module/Booster.ts, Module/Events/EventModule.ts, Module/GenericBattle.ts, Module/Troll.ts, Service/AutoLoopActions.ts, Service/AutoLoopPageHandlers.ts |
| `SK.plusEventLoveRaidSandalWood` | +LoveRaid Sandalwood-Modus | (nur init/storage-Helper) | - | Module/Booster.ts |
| `SK.plusEventMythic` | +Event Mythic-Bonus | (nur init/storage-Helper) | - | Module/Booster.ts, Module/Events/EventModule.ts, Module/GenericBattle.ts, Module/Troll.ts, Service/AutoLoop.ts, Service/AutoLoopActions.ts, Service/AutoLoopPageHandlers.ts |
| `SK.plusEventMythicSandalWood` | +Mythic-Sandalwood | (nur init/storage-Helper) | - | Module/Booster.ts |
| `SK.plusEventSandalWood` | +Event-Sandalwood | (nur init/storage-Helper) | - | Module/Booster.ts |
| `SK.plusGirlSkins` | Girl-Skins-Pruefung in Events/Raids | (nur init/storage-Helper) | - | Module/Events/LoveRaidManager.ts |
| `SK.plusLoveRaid` | +LoveRaid aktiv | (nur init/storage-Helper) | - | Module/Events/LoveRaidManager.ts |
| `SK.plusLoveRaidMythic` | +LoveRaid Mythic-Mode (off/exact3/min3/exact5) | Service/StartService.ts | - | Module/Events/LoveRaidManager.ts, Service/StartService.ts |
| `SK.safeSecondsForContest` | Sicherheits-Sekunden Contest-Submission | (nur init/storage-Helper) | - | Helper/TimeHelper.ts |
| `SK.sandalwoodMinShardsThreshold` | Mindest-Shards um Sandalwood einzusetzen | (nur init/storage-Helper) | - | Module/Booster.ts |
| `SK.saveDefaults` | Benutzer-Default-Werte fuer Settings (JSON-Map) | Helper/StorageHelper.ts | - | Helper/StorageHelper.ts |
| `SK.seasonDisplayPowerCalc` | PowerCalc-Anzeige Season | (nur init/storage-Helper) | - | Module/Events/Season.ts |
| `SK.settPerTab` | Settings pro Tab (sessionStorage statt localStorage) | (nur init/storage-Helper) | - | Helper/StorageHelper.ts |
| `SK.showAdsBack` | Ads im Layout zeigen | (nur init/storage-Helper) | - | Service/AdsService.ts |
| `SK.showCalculatePower` | Power-Calc-UI anzeigen | (nur init/storage-Helper) | - | Service/AutoLoopPageHandlers.ts |
| `SK.showClubButtonInPoa` | Club-Button in PoA | (nur init/storage-Helper) | - | Module/Events/DoublePenetration.ts, Service/AutoLoopPageHandlers.ts |
| `SK.showHaremAvatarMissingGirls` | Avatar-Marker fuer fehlende Girls in Harem | (nur init/storage-Helper) | - | Module/harem/Harem.ts |
| `SK.showHaremSkillsButtons` | Skill-Reset-Button in Harem | (nur init/storage-Helper) | - | Module/harem/HaremGirl.ts |
| `SK.showHaremTools` | Harem-Tools UI | (nur init/storage-Helper) | - | Module/harem/Harem.ts, Module/harem/HaremGirl.ts |
| `SK.showInfo` | Info-Overlay anzeigen | (nur init/storage-Helper) | - | Service/InfoService.ts |
| `SK.showInfoLeft` | Info-Overlay links | (nur init/storage-Helper) | - | Service/InfoService.ts |
| `SK.showMarketTools` | Markt-Tools | (nur init/storage-Helper) | - | Service/AutoLoopPageHandlers.ts |
| `SK.showRewardsRecap` | Reward-Recap-Anzeige | (nur init/storage-Helper) | - | Module/Events/DoublePenetration.ts, Module/Events/LivelyScene.ts, Module/Events/PathOfAttraction.ts, Module/Events/Seasonal.ts, Service/AutoLoopPageHandlers.ts |
| `SK.showTooltips` | Tooltips an | (nur init/storage-Helper) | - | Service/TooltipService.ts |
| `SK.sultryMysteriesEventRefreshShop` | SultryMysteries: Shop-Refresh erlauben | (nur init/storage-Helper) | - | Module/Events/EventModule.ts |
| `SK.updateMarket` | Markt aktiv updaten | (nur init/storage-Helper) | - | Module/Shop.ts, Service/InfoService.ts |
| `SK.useX10Fights` | x10-Fights nutzen | (nur init/storage-Helper) | - | Module/Troll.ts |
| `SK.useX10FightsAllowNormalEvent` | x10 auch in normalem Event | (nur init/storage-Helper) | - | Module/Troll.ts |
| `SK.useX50Fights` | x50-Fights nutzen | (nur init/storage-Helper) | - | Module/Troll.ts |
| `SK.useX50FightsAllowNormalEvent` | x50 auch in normalem Event | (nur init/storage-Helper) | - | Module/Troll.ts |
| `SK.waitforContest` | Contest-Ende abwarten | (nur init/storage-Helper) | - | Helper/TimeHelper.ts, Module/Contest.ts, Service/AutoLoop.ts, Service/InfoService.ts |
| `TK.CheckSpentPoints` | Marker: 'Punkte schon gespendet?' | Service/AutoLoop.ts | - | Service/AutoLoop.ts |
| `TK.Debug` | Debug-Mode flag | (nur init/storage-Helper) | - | Helper/HHMenuHelper.ts, Module/Champion.ts, Module/Events/LoveRaidManager.ts, Module/Events/PathOfAttraction.ts, Module/Events/Season.ts, Module/Labyrinth.ts, Module/LabyrinthAuto.ts, Module/League.ts, Module/Missions.ts, Module/Pachinko.ts, Module/PentaDrill.ts, Module/PlaceOfPower.ts, Module/RelicManager.ts, Module/Troll.ts, Module/harem/Harem.ts, Module/harem/HaremGirl.ts |
| `TK.EventFightsBeforeRefresh` | Counter Fights bis Event-Refresh | Module/Troll.ts | - | Helper/RewardHelper.ts, Module/Troll.ts |
| `TK.HaremSize` | Aktuelle Harem-Groesse + Timestamp | Module/harem/Harem.ts | - | Helper/BDSMHelper.ts, Module/harem/Harem.ts, Service/AutoLoopActions.ts |
| `TK.LastPageCalled` | Zuletzt aufgerufene Seite (Loop-Detection) | Service/PageNavigationService.ts, Service/StartService.ts | Service/AutoLoopActions.ts, Service/StartService.ts | Module/Shop.ts, Service/AutoLoopActions.ts, Service/StartService.ts |
| `TK.LeagueHumanLikeRun` | League: Human-Like-Run-Daten | Module/League.ts | - | Module/League.ts |
| `TK.LeagueOpponentList` | Cache der League-Gegner-Liste | Module/League.ts | Module/League.ts, Service/StartService.ts, Utils/LogUtils.ts, config/HHStoredVars.ts | (?) |
| `TK.Logging` | In-Browser-Log-Buffer (sessionStorage) | Utils/LogUtils.ts | - | Utils/LogUtils.ts |
| `TK.MainAdventureWorldID` | Welt-ID im Main-Adventure | Service/StartService.ts | - | Service/StartService.ts |
| `TK.NextSwitch` | Naechster Paranoia-Switch-Zeitpunkt | Service/ParanoiaService.ts | - | Service/ParanoiaService.ts |
| `TK.PantheonHumanLikeRun` | Pantheon HumanLike-State | Module/Pantheon.ts, Service/AutoLoopActions.ts | - | Module/Pantheon.ts, Service/AutoLoopActions.ts |
| `TK.PentaDrillHumanLikeRun` | PentaDrill HumanLike-State | Module/PentaDrill.ts, Service/AutoLoopActions.ts | - | Module/PentaDrill.ts, Service/AutoLoopActions.ts |
| `TK.PoAEndDate` | PoA Event-Endzeit | Module/Events/PathOfAttraction.ts | - | Module/Events/PathOfAttraction.ts |
| `TK.PoGEndDate` | PoG Event-Endzeit | Module/Events/PathOfGlory.ts | - | Module/Events/PathOfGlory.ts |
| `TK.PoVEndDate` | PoV Event-Endzeit | Module/Events/PathOfValue.ts | - | Module/Events/PathOfValue.ts |
| `TK.PopTargeted` | Aktuell anvisierter Pop | Module/PlaceOfPower.ts | Module/PlaceOfPower.ts | Module/PlaceOfPower.ts |
| `TK.PopToStart` | Liste der zu startenden Pops | Module/PlaceOfPower.ts | - | Module/PlaceOfPower.ts, Service/AutoLoopActions.ts |
| `TK.PopUnableToStart` | Liste 'kann nicht starten' | Module/PlaceOfPower.ts | - | Module/PlaceOfPower.ts |
| `TK.SeasonEndDate` | Season Event-Endzeit | Module/Events/Season.ts | - | Module/Events/Season.ts |
| `TK.SeasonHumanLikeRun` | Season HumanLike-State | Module/Events/Season.ts, Service/AutoLoopActions.ts | - | Module/Events/Season.ts, Service/AutoLoopActions.ts |
| `TK.SeasonalEventEndDate` | Seasonal-Endzeit | Module/Events/Seasonal.ts | - | Module/Events/Seasonal.ts |
| `TK.SideAdventureWorldID` | Welt-ID Side-Adventure | Service/StartService.ts | - | (?) |
| `TK.Timers` | Map aller laufenden HHAuto-Timer (JSON) | Helper/TimerHelper.ts | - | Service/StartService.ts |
| `TK.Totalpops` | Gesamtzahl Pops | Module/PlaceOfPower.ts | - | Module/PlaceOfPower.ts |
| `TK.TrollHumanLikeRun` | Troll HumanLike-State | Module/Troll.ts, Service/AutoLoopActions.ts | - | Service/AutoLoopActions.ts |
| `TK.TrollInvalid` | Markierung: Troll-State ungueltig | Module/Troll.ts | - | Module/Troll.ts |
| `TK.autoChampsEventGirls` | Liste Event-Girls fuer Champ-Force-Start | Module/Events/EventModule.ts | - | Module/Champion.ts |
| `TK.autoLoop` | Globaler 'autoLoop laeuft' Switch | Helper/HeroHelper.ts, Helper/PageHelper.ts, Helper/RewardHelper.ts, Module/Bundles.ts, Module/Champion.ts, Module/DailyGoals.ts, Module/Events/BossBang.ts, Module/Events/DoublePenetration.ts, Module/Events/LivelyScene.ts, Module/Events/PathOfAttraction.ts, Module/Events/PathOfGlory.ts, Module/Events/PathOfValue.ts, Module/Events/Season.ts, Module/Events/Seasonal.ts, Module/Labyrinth.ts, Module/LabyrinthAuto.ts, Module/League.ts, Module/Pachinko.ts, Module/Pantheon.ts, Module/PentaDrill.ts, Module/PlaceOfPower.ts, Module/Quest.ts, Module/Shop.ts, Module/TeamModule.ts, Module/Troll.ts, Module/harem/Harem.ts, Module/harem/HaremGirl.ts, Service/AutoLoopActions.ts, Service/PageNavigationService.ts, Service/ParanoiaService.ts, Service/StartService.ts | - | Service/AutoLoop.ts, Service/InfoService.ts, Service/StartService.ts |
| `TK.autoLoopTimeMili` | AutoLoop-Intervall in ms | (nur init/storage-Helper) | - | Helper/HeroHelper.ts, Module/Bundles.ts, Module/Events/DoublePenetration.ts, Module/Events/LivelyScene.ts, Module/Events/PathOfAttraction.ts, Module/League.ts, Module/Pachinko.ts, Module/PlaceOfPower.ts, Module/Shop.ts, Service/AutoLoop.ts, Service/StartService.ts |
| `TK.autoTrollBattleSaveQuest` | Trolls vor Quest sichern | Module/GenericBattle.ts, Module/Troll.ts, Service/AutoLoopActions.ts | - | Module/GenericBattle.ts, Module/Troll.ts, Service/AutoLoopActions.ts |
| `TK.battlePowerRequired` | Power-Anforderung fuer naechsten Kampf | Module/Troll.ts, Service/AutoLoop.ts, Service/AutoLoopActions.ts | - | Service/AutoLoop.ts, Service/AutoLoopActions.ts |
| `TK.blessingsCache` | Blessing-Daten-Cache (von /get_girls_blessings) | Service/BlessingService.ts | - | Service/BlessingService.ts |
| `TK.boosterIdMap` | Map identifier->id_item (vom Shop gescraped) | Module/Shop.ts | - | Module/Booster.ts |
| `TK.boosterStatus` | JSON {normal:[], mythic:[]} der equippten Booster | Module/Booster.ts | - | Module/Booster.ts |
| `TK.boosterStatusLastUpdate` | Timestamp der letzten Markt-Refresh fuer boosterStatus (TTL 10min) | Module/Booster.ts | Helper/HeroHelper.ts | Module/Booster.ts |
| `TK.bossBangTeam` | BossBang Team-Snapshot | Module/Events/BossBang.ts | - | Module/Events/BossBang.ts |
| `TK.burst` | Burst-Mode aktiv (kurzes High-Speed-Run-Window) | Service/ParanoiaService.ts | - | Service/AutoLoop.ts, Service/ParanoiaService.ts |
| `TK.champBuildTeam` | Aktuell aufzubauendes Champ-Team | Module/Champion.ts, Module/ClubChampion.ts | Module/Champion.ts, Module/ClubChampion.ts | Module/Champion.ts, Module/ClubChampion.ts |
| `TK.charLevel` | Letzter bekannter Hero-Level (fuer Shop-Refresh-Trigger) | Module/Market.ts, Module/Shop.ts, Service/AutoLoopActions.ts | - | Service/AutoLoopActions.ts |
| `TK.clubChampLimitReached` | ClubChamp Limit erreicht | Module/ClubChampion.ts | Module/ClubChampion.ts | Module/Champion.ts |
| `TK.currentlyAvailablePops` | Aktuell verfuegbare Pops (Schreib-only) | Module/PlaceOfPower.ts | - | (?) |
| `TK.dailyGoalsList` | Geparste DailyGoals-Liste | Module/DailyGoals.ts | - | Module/DailyGoals.ts |
| `TK.eventGirl` | Aktuell anvisiertes Event-Girl (Schreib-only) | Module/Events/EventModule.ts | - | (?) |
| `TK.eventMythicGirl` | Aktuell anvisiertes Mythic-Event-Girl | Module/Events/EventModule.ts | - | (?) |
| `TK.eventsGirlz` | Liste Event-Girls fuer Reward-Recap | Helper/RewardHelper.ts, Module/Events/EventModule.ts | - | Helper/RewardHelper.ts |
| `TK.eventsList` | Liste aller laufenden Events | Module/Events/EventModule.ts, Service/ParanoiaService.ts | - | Module/Events/EventModule.ts, Service/ParanoiaService.ts, Service/Pipeline.config.ts |
| `TK.featurePopupDismissCount` | Feature-Popup Dismiss-Zaehler | Service/FeaturePopupService.ts | - | Service/FeaturePopupService.ts |
| `TK.featurePopupShown` | Feature-Popup wurde gezeigt | Service/FeaturePopupService.ts | - | Service/FeaturePopupService.ts |
| `TK.filteredGirlsList` | Aktuell gefilterte Girls-Liste fuer Harem-Tools | Module/harem/Harem.ts | - | Module/harem/HaremGirl.ts |
| `TK.freshStart` | Marker fuer ersten Start (kein Default-Reset) | (nur init/storage-Helper) | - | Service/StartService.ts |
| `TK.haremGirlActions` | Action-Queue fuer Harem-Girl-Multi-Page-Flows | Module/TeamModule.ts, Module/harem/Harem.ts, Module/harem/HaremGirl.ts | Module/harem/Harem.ts | Module/harem/Harem.ts, Module/harem/HaremGirl.ts, Service/AutoLoopPageHandlers.ts |
| `TK.haremGirlEnd` | Endzeitpunkt des Harem-Girl-Flows | Module/harem/Harem.ts, Module/harem/HaremGirl.ts | Module/harem/Harem.ts | Module/harem/HaremGirl.ts |
| `TK.haremGirlLimit` | Limit fuer Harem-Girl-Flow | Module/harem/HaremGirl.ts | Module/harem/Harem.ts | Module/harem/HaremGirl.ts |
| `TK.haremGirlMode` | Aktiver Harem-Girl-Mode (sperrt autoLoop) | Module/TeamModule.ts, Module/harem/Harem.ts, Module/harem/HaremGirl.ts | Module/harem/Harem.ts | Module/harem/Harem.ts, Module/harem/HaremGirl.ts, Service/AutoLoopPageHandlers.ts, Service/StartService.ts |
| `TK.haremGirlPayLast` | Last-Pay-Marker | Module/harem/Harem.ts, Module/harem/HaremGirl.ts | Module/harem/Harem.ts | Module/harem/HaremGirl.ts |
| `TK.haremGirlSpent` | Bisher ausgegeben (nur Delete in HHStoredVars) | (nur init/storage-Helper) | Module/harem/Harem.ts | (?) |
| `TK.haremMoneyOnStart` | Geld zu Beginn des Harem-Flows | Module/harem/Harem.ts | Module/harem/Harem.ts | Module/harem/Harem.ts, Module/harem/HaremGirl.ts |
| `TK.haremTeam` | Snapshot des Harem-Teams | Module/TeamModule.ts | Module/harem/Harem.ts | Module/harem/Harem.ts, Module/harem/HaremGirl.ts |
| `TK.haremTeamScrolls` | Snapshot Team-Scrolls | Module/harem/Harem.ts | Module/harem/Harem.ts | Module/harem/Harem.ts |
| `TK.haremTeamSettings` | Team-Settings Snapshot | Module/TeamModule.ts | Module/harem/Harem.ts | Module/harem/Harem.ts |
| `TK.haveAff` | Aff-Vorrat (Sum) | Module/Shop.ts | - | Module/Market.ts, Module/Shop.ts, Service/InfoService.ts |
| `TK.haveBooster` | Map identifier->Anzahl Booster im Inventory | Module/Market.ts, Module/Shop.ts | - | Helper/HeroHelper.ts, Module/Booster.ts, Module/Market.ts |
| `TK.haveExp` | Exp-Vorrat (Sum) | Module/Shop.ts | - | Module/Market.ts, Module/Shop.ts, Service/InfoService.ts |
| `TK.hideBeatenOppo` | Bereits besiegte League-Gegner verstecken | Module/League.ts | - | Module/League.ts |
| `TK.lastActionPerformed` | Letzte ausgefuehrte Action | Module/TeamModule.ts, Module/harem/Harem.ts, Module/harem/HaremGirl.ts, Service/AutoLoop.ts | - | Module/harem/Harem.ts, Service/AutoLoop.ts |
| `TK.loveRaids` | Aktive LoveRaids-Liste | Module/Events/LoveRaidManager.ts | config/HHStoredVars.ts | Module/Events/LoveRaidManager.ts |
| `TK.lseManualCollectAll` | LivelyScene Manual-Collect-Marker | Module/Events/LivelyScene.ts | - | Module/Events/LivelyScene.ts |
| `TK.paranoiaLeagueBlocked` | Paranoia: League blockiert | Module/League.ts | - | Service/ParanoiaService.ts |
| `TK.paranoiaQuestBlocked` | Paranoia: Quest blockiert | Service/AutoLoopActions.ts | - | Service/ParanoiaService.ts |
| `TK.paranoiaSpendings` | Paranoia: aktuelle Spendings | Service/ParanoiaService.ts | - | Service/ParanoiaService.ts |
| `TK.pinfo` | PInfo-Overlay-Daten | Service/ParanoiaService.ts | - | Service/InfoService.ts |
| `TK.poaManualCollectAll` | PoA Manual-Collect-Marker | Module/Events/PathOfAttraction.ts | - | Module/Events/PathOfAttraction.ts |
| `TK.questRequirement` | Quest-Anforderung (next-step) | Module/Quest.ts, Module/Troll.ts, Service/AutoLoop.ts, Service/AutoLoopActions.ts | config/HHStoredVars.ts | Module/Troll.ts, Service/AutoLoop.ts, Service/AutoLoopActions.ts |
| `TK.raidGirls` | Raid-Girls-Liste | (nur init/storage-Helper) | - | Module/Events/LoveRaidManager.ts |
| `TK.sandalwoodFailure` | Counter fehlgeschlagene Sandalwood-Equip-Versuche | Helper/HeroHelper.ts, Module/Booster.ts | - | Helper/HeroHelper.ts |
| `TK.sandalwoodMaxUsages` | Max-Usages des aktuellen Sandalwood (sessionStorage) | Module/Booster.ts | - | (?) |
| `TK.scriptversion` | Letzte gespeicherte Skript-Version (fuer Migrations-Check) | Service/StartService.ts | - | Service/StartService.ts |
| `TK.storeContents` | Cache des Shop-Inhalts (4-Listen-Tuple JSON) | Module/Market.ts, Module/Shop.ts | - | Module/Booster.ts, Module/Market.ts |
| `TK.surveyDismissCount` | Survey Dismiss-Zaehler | Service/SurveyService.ts | - | Service/SurveyService.ts |
| `TK.surveyLastHash` | Hash der zuletzt gezeigten Umfrage | Service/SurveyService.ts | - | Service/SurveyService.ts |
| `TK.surveyShown` | Survey wurde gezeigt | Service/SurveyService.ts | - | Service/SurveyService.ts |
| `TK.trollPoints` | Troll-Points-Snapshot | Module/Troll.ts | - | Module/Troll.ts |
| `TK.trollWithGirls` | Trolls mit Girls (Snapshot) | Module/Troll.ts | - | Module/Troll.ts |
| `TK.unkownPagesList` | Liste unbekannter Pages (Telemetrie fuer Skript-Updates) | Helper/PageHelper.ts | - | Helper/PageHelper.ts |

Beobachtungen:

- `TK.autoLoop` wird in 31 Dateien geschrieben (jeder, der den Loop kurz pausieren muss). Lesend nur in 3 Stellen.
- `TK.autoLoopTimeMili` wird nirgendwo explizit gesetzt - kommt aus dem Default in `HHStoredVars.ts` (1500 ms).
- `TK.HaremSize`, `TK.boosterStatus`, `TK.LeagueOpponentList` sind grosse JSON-Strukturen - bei storage-full fallen sie als erste in `cleanLogsInStorage()`.
- `TK.unkownPagesList` ist ein Telemetrie-Map fuer noch nicht bekannte `pagesIDXxx` (siehe Sektion 6.1).

## 8. sessionStorage (direkter Zugriff, ohne `getStoredValue`-Wrapper)

Alle Stellen, an denen `sessionStorage` direkt verwendet wird (also nicht ueber `getStoredValue`/`setStoredValue`).
Hintergrund: Der Wrapper sucht den Key in `HHStoredVars` und delegiert je nach `storage`-Feld an `localStorage` / `sessionStorage` / `Storage()`. Direkte Zugriffe umgehen diese Pruefung.

| Datei:Zeile | Operation | Key (mit Praefix) | Zweck |
|---|---|---|---|
| `Helper/StorageHelper.ts:115` | read (`getItem`) | `HHAuto_Temp_Logging` (= `HHStoredVarPrefixKey + 'Temp_Logging'`) | Log-Buffer zum Export einlesen (Bypass HHStoredVars-Wrapper) |
| `Helper/StorageHelper.ts:159-162` | read+write+remove | beliebige `oldVar`/`newVar` | Migration alter Praefixe (`HHAuto_` -> custom) - siehe `migrateHHVars` |
| `Helper/StorageHelper.ts:280,287,294,301` | removeItem | alle Keys mit Praefix `HHAuto_Setting_*` und `HHAuto_Temp_*` | `debugDeleteAllVars()` Reset |
| `Helper/StorageHelper.ts:393,398` | hasOwnProperty + Read (`localStorage[key]`/`sessionStorage[key]`) | beliebig | `getLocalStorageSize()` zaehlt total |
| `Module/PlaceOfPower.ts:142,143,293` | removeItem | `Temp_PopUnableToStart`, `Temp_PopToStart` | Reset bei PoP-Setting-Change |
| `Service/AutoLoopActions.ts:220` | removeItem | `Temp_PopToStart` | Reset wenn Pop-Run abgeschlossen |
| `Service/ParanoiaService.ts:88-91` | removeItem | `Temp_paranoiaSpendings`, `Temp_NextSwitch`, `Temp_paranoiaQuestBlocked`, `Temp_paranoiaLeagueBlocked` | Reset bei Paranoia-Disable |
| `Service/ParanoiaService.ts:347` | (auskommentiert) | `Temp_eventsList` | - |
| `Module/Events/EventModule.ts:70` | (auskommentiert) | `Temp_EventFightsBeforeRefresh` | - |
| `Module/Events/EventModule.ts:121-125` | removeItem | `Temp_eventsGirlz`, `Temp_eventGirl`, `Temp_eventMythicGirl`, `Temp_eventsList`, `Temp_autoChampsEventGirls` | Cleanup nach Event-Ende |
| `Module/Events/EventModule.ts:143` | removeItem | `Temp_autoChampsEventGirls` | Reset wenn Event-Champ-Konfig wechselt |
| `Module/Events/EventModule.ts:163,172,177,326` | removeItem | `Temp_eventsGirlz`, `Temp_eventGirl`, `Temp_eventMythicGirl`, `Temp_eventsList` | Diverse Event-Resets |

Kein direkter Zugriff auf `sessionStorage` ausserhalb dieser Stellen.

## 9. Spielzustands-Bridge-Funktionen

### 9.1 `getHHVars(infoSearched, logging=true)` (`Helper/HHHelper.ts:21`)

Ablauf:

1. `returnValue = unsafeWindow`
2. Wenn `ConfigHelper.getHHScriptVars(infoSearched, false) !== null`: ueberschreibe `infoSearched` mit dem Per-Game-Override (selten genutzt - kein aktueller Treffer in HHEnvVariables.ts).
3. `infoSearched = prefixIfNeeded(infoSearched)`:
   - **Trick**: Wenn `unsafeWindow.shared` existiert UND `infoSearched.indexOf('Hero.') == 0`, wird `'shared.' + infoSearched` davorgehaengt.
   - Effekt: Code kann konsistent `'Hero.x'` schreiben, egal ob das Spiel auf Legacy-Build (`window.Hero.x`) oder neuem Build (`window.shared.Hero.x`) laeuft. Wenn `shared` fehlt, faellt der Pfad auf `unsafeWindow.Hero.x` zurueck.
4. Loop ueber `infoSearched.split(".")`. Jeder Schritt: `returnValue = returnValue[part]`. Wenn ein Teil `undefined` ist: log + return `null`.

Counterpart: `setHHVars(infoSearched, newValue)` (`Helper/HHHelper.ts:51`) - gleicher Lookup-Algorithmus, am letzten Pfadelement wird zugewiesen. Wenn ein Zwischenpfad fehlt, wird `-1` zurueckgegeben (kein Throw).

### 9.2 `getHHAjax()` (`Utils/Utils.ts:19`)

```ts
return unsafeWindow.shared?.general?.hh_ajax;
```

Liefert die interne AJAX-Funktion des Spiels mit Signatur `(params, onSuccess, onError) => void`.
`params.action` ist das spielinterne Action-Routing (siehe Sektion 3).
`onSuccess(data)`, `onError(err)` sind die Callbacks.
Wird in fast allen Modulen benutzt um Spielaktionen wie Stat-Upgrade, Booster-Equip, League-Battle, etc. zu triggern.

### 9.3 `getHero()` (`Helper/HeroHelper.ts:23-30`)

```ts
if (unsafeWindow.shared?.Hero === undefined) {
    setTimeout(autoLoop, Number(getStoredValue(HHStoredVarPrefixKey+TK.autoLoopTimeMili)) || 1000);
}
return unsafeWindow.shared?.Hero;
```

Liefert das Hero-Objekt direkt aus `shared`. Bei Nichtverfuegbarkeit: schedule autoLoop und gib `undefined` zurueck. Wird relativ selten direkt benutzt - die meisten Reads gehen ueber `getHHVars('Hero.x')`.

Die Klasse `HeroHelper` (gleiches File) bietet getter-Wrapper:

| Methode | Liefert |
|---|---|
| `HeroHelper.getPlayerId()` | `getHHVars('Hero.infos.id')` |
| `HeroHelper.getClass()` | `getHHVars('Hero.infos.class')` |
| `HeroHelper.getLevel()` | `getHHVars('Hero.infos.level')` |
| `HeroHelper.getMoney()` | `getHHVars('Hero.currencies.soft_currency')` |
| `HeroHelper.getKoban()` | `getHHVars('Hero.currencies.hard_currency')` |
| `HeroHelper.haveBoosterInInventory(id)` | Lookup im `TK.haveBooster`-Storage-Cache |
| `HeroHelper.equipBooster(booster)` | sendet `market_equip_booster` (siehe Sektion 3) mit Timeout-Sicherung |

### 9.4 Weitere Bridge-Helper

| Funktion | Datei | Zweck |
|---|---|---|
| `getLoadingAnimation()` | `Utils/Utils.ts:22` | `window.shared?.animations?.loadingAnimation` mit Fallback auf no-op-Stubs |
| `onAjaxResponse(pattern, callback)` | `Utils/Utils.ts:25` | Globaler `ajaxComplete`-Hook (siehe Sektion 4) |
| `getCurrentSorting()` | `Utils/Utils.ts:118` | liest `localStorage.sort_by` (vom Spiel selbst gesetzt; nicht HHAuto) |
| `getStoredValue/getStoredJSON/setStoredValue/deleteStoredValue` | `Helper/StorageHelper.ts` | HHAuto-eigener Wrapper ueber HHStoredVars-Registry |
| `getStorage()` | `Helper/StorageHelper.ts:39` | gibt `sessionStorage` wenn `SK.settPerTab=true`, sonst `localStorage` (fuer `Storage()`-Vars) |
| `getStorageItem(type)` | `Helper/StorageHelper.ts:131` | resolved `'localStorage'` / `'sessionStorage'` / `'Storage()'`-Tag in echte Storage-API |
| `addNutakuSession(togoto)` | `Service/PageNavigationService.ts:191` | haengt `?sess=...` an URL wenn `unsafeWindow.hh_nutaku` |
| `queryStringGetParam(qs, name)` | `Helper/UrlHelper.ts:13` | URLSearchParams-Wrapper |
| `getPage(checkUnknown, checkPop)` | `Helper/PageHelper.ts:14` | resolved canonical Page-ID aus `<body page>`+Tab+Pop-Detection (siehe Sektion 6.1) |
| `ConfigHelper.getEnvironnement()` | `Helper/ConfigHelper.ts:12` | matched `window.location.hostname` gegen `HHKnownEnvironnements` |
| `ConfigHelper.getHHScriptVars(id, logNotFound)` | `Helper/ConfigHelper.ts:30` | env-spezifischer Lookup mit `global` als Fallback (siehe Sektion 11) |
| `ConfigHelper.isPshEnvironnement()` | `Helper/ConfigHelper.ts:25` | true fuer `PH_prod` und `NPH_prod` |

## 10. Page-spezifische Datenverfuegbarkeit

Fuer jede Page-ID (aus `ConfigHelper.getHHScriptVars("pagesIDXxx")`): welche `unsafeWindow`-Globals sind dort lesbar, welche DOM-Quellen relevant.

| Page-ID-Konstante (Wert) | Verfuegbare unsafeWindow-Globals | Verfuegbare DOM-Quellen |
|---|---|---|
| `pagesIDHome` (`home`) | `shared.Hero`, `hh_prices` (?) | `#contains_all header .currency .daily-reward-notif`, `#blessings_popup .blessings_wrapper` (nach `get_girls_blessings`) |
| `pagesIDActivities` (`activities`) | `shared.Hero`, `pop_list`, `pop_index` (wenn Pop-Tab) | `#activities-tabs > div[data-tab=...]`, `div.pop_list`, `.pop_thumb_selected[pop_id]` |
| `pagesIDMissions` (`missions`) (Activities-Tab `missions`) | `shared.Hero` | Mission-DOM (`Module/Missions.ts`) |
| `pagesIDContests` (`contests`) (Activities-Tab `contests`) | `contests_timer.{next_contest,duration,remaining_time}`, `has_contests_datas` | Contest-Claim-Buttons (`Contest.getClaimsButton()`) |
| `pagesIDDailyGoals` (`daily_goals`) (Activities-Tab `daily_goals`) | `daily_goals_list` | Tier-DOM in DailyGoals |
| `pagesIDPowerplacemain` (`powerplacemain`) (Activities-Tab `pop`, Liste sichtbar) | `pop_list`, `pop_index` | `div.pop_list`, `.pop_thumb_selected[pop_id]` |
| `pagesIDQuest` (`quest`) | `shared.Hero`, `Hero.infos.questing.{id_world,id_quest,current_url}` | Quest-DOM (`Module/Quest.ts`) |
| `pagesIDHarem` (`harem`) | `shared.GirlSalaryManager.{girlsMap,girlsListSec}`, `availableGirls` / `girlsDataList` / `girls_data_list` (variantenabhaengig) | `#harem_right .opened` `.attr('girl')`, `.hhava`, `.select-group ... [data-index]` |
| `pagesIDGirlPage` (`girl`) | `girl` (KKHaremGirl), `id_girl`, `player_gems_amount` | `.right-section .slot[data-d]`, `#girl-leveler-tabs .switch-tab[data-tab=...]` |
| `pagesIDMap` (`map`) | `shared.Hero` | - |
| `pagesIDPachinko` (`pachinko`) | `shared.Hero` | `#playzone-replace-info button[data-free="true"]`, `[girlsRewards].attr("data-rewards")` |
| `pagesIDLeaderboard` (`leaderboard`) | `current_tier_number`, `opponents_list` (League) | `.league_content .data-list`, `.data-row.body-row`, `.data-column[column="..."]` |
| `pagesIDShop` (`shop`) | `shared.animations.loadingAnimation`, `hh_prices` | `#shops div.{armor,booster,gift,potion}.merchant-inventory-item .slot[data-d]`, `#shops div.{gift,potion,booster}.player-inventory-content .slot[data-d]`, `#equiped .booster .slot`, `.shop div.shop_count span[rel="expires"]` |
| `pagesIDClub` (`clubs`) | `Chat_vars.CLUB_INFO.id_club` | Club-Status-UI |
| `pagesIDPantheon` (`pantheon`) | `Hero.energies.worship.*` | - |
| `pagesIDPantheonPreBattle` (`pantheon-pre-battle`) | `Hero.energies.worship.*` | `#pre-battle .pantheon-single-battle-button[data-pantheon-id]` |
| `pagesIDPantheonBattle` (`pantheon-battle`) | - | - |
| `pagesIDLabyrinthEntrance` (`labyrinth-entrance`) | - | - |
| `pagesIDLabyrinthPoolSelect` (`labyrinth-pool-select`) | - | - |
| `pagesIDLabyrinth` (`labyrinth`) | `girl_squad` | `.team-hexagon .team-member-container[data-girl-id]` |
| `pagesIDLabyrinthPreBattle` (`labyrinth-pre-battle`) | - | `.opponent-power .opponent-power-text[data-power]` |
| `pagesIDLabyrinthBattle` (`labyrinth-battle`) | - | - |
| `pagesIDChampionsPage` (`champions`) | `championData.{team,champion.id,champion.poses,freeDrafts,hero_damage,fight.{active,participants}}` | `.champions-over__champion-info ... .champion-pose` |
| `pagesIDChampionsMap` (`champions_map`) | `championData.*` | - |
| `pagesIDClubChampion` (`club_champion`) | `championData.fight.{active,participants}` | `div.club-champion-members-challenges .player-row .data-column:nth-of-type(3)` |
| `pagesIDSeason` (`season`) | `season_sec_untill_event_end`, `Hero.energies.kiss.*` | - |
| `pagesIDSeasonArena` (`season_arena`) | `season_sec_untill_event_end`, `hero_data`, `opponents` | `.season_arena_opponent_container[data-opponent=...]`, `.slot.girl_ico[data-rewards]` |
| `pagesIDSeasonBattle` (`season-battle`) | `Hero.energies.kiss.*` | - |
| `pagesIDLeaguePreBattle` (`leagues-pre-battle`) | `Hero.energies.challenge.*` | - |
| `pagesIDLeagueBattle` (`league-battle`) | `Hero.energies.challenge.*` | - |
| `pagesIDTrollPreBattle` (`troll-pre-battle`) | `Hero.energies.fight.*`, `Hero.infos.questing.*`, `Hero.infos.hc_confirm` | `#pre-battle .battle-buttons button.autofight[data-battles="10"]` / `[data-battles="50"]`, `.opponent_rewards .rewards_list .slot.girl_ico[data-rewards]` |
| `pagesIDTrollBattle` (`troll-battle`) | `Hero.energies.fight.*` | - |
| `pagesIDPentaDrill` (`penta_drill`) | `penta_drill_data.cycle_data.seconds_until_event_end`, `Hero.energies.drill.*` | - |
| `pagesIDPentaDrillArena` (`penta_drill_arena`) | `opponents_list` (KKPentaDrillOpponents[]) | - |
| `pagesIDEditPentaDrillTeam` (`edit-penta-drill-team`) | - | `.team-member-container[data-girl-id]` |
| `pagesIDPentaDrillPreBattle` (`penta_drill_pre_battle`) | - | - |
| `pagesIDPentaDrillBattle` (`penta-drill-battle`) | - | - |
| `pagesIDEvent` (`event`) | `event_data` (mit `girls`), `current_event` (Fallback) | `[data-select-girl-id=...]` |
| `pagesIDPoV` (`path-of-valor`) | - | `[data-time-stamp]`, Reward-Slots |
| `pagesIDPoG` (`path-of-glory`) | - | `[data-time-stamp]`, Reward-Slots |
| `pagesIDPoA` (`path_of_attraction`) | - | `[data-nc-reward-id]`, `#poa-content .buttons:has(button[data-href="/champions-map.html"])` |
| `pagesIDSeasonalEvent` (`seasonal`) | `seasonal_event_active`, `seasonal_time_remaining`, `mega_event_active`, `mega_event_time_remaining`, `mega_event_data.cards` | - |
| `pagesIDBossBang` (`boss-bang-battle`) | (?) | - |
| `pagesIDSexGodPath` (`sex-god-path`) | (?) | - |
| `pagesIDLoveRaid` (`love_raids`) | `love_raids` (KKLoveRaid[]) | - |
| `pagesIDWaifu` (`waifu`) | (?) | - |
| `pagesIDBattleTeams` (`teams`) | `teams_data[selectedTeam].{girls,girls_ids}` | `.team-slot-container.selected-team[data-team-index]`, `.team-member-container[data-team-member-position=N][data-girl-id]` |
| `pagesIDEditTeam` (`edit-team`) | `teams_data[...]` | gleiche Selectoren wie BattleTeams + `#edit-team-page` |
| `pagesIDEditLabyrinthTeam` (`edit-labyrinth-team`) | - | `.team-member-container.selectable[data-team-member-position=...][data-girl-id]` |
| `pagesIDMemberProgression` (`member-progression`) | (?) | - |
| `pagesIDHeroPage` (`hero_pages`) | `shared.Hero` | - |
| `pagesIDGirlEquipmentUpgrade` (`girl-equipment-upgrade`) | (?) | `.right-section .slot[data-d]` |

Hinweis: `(?)` steht fuer "im Source nicht eindeutig nachweisbar".

## 11. Per-Game-Unterschiede

Erkennung: `ConfigHelper.getEnvironnement()` matched `window.location.hostname` gegen `HHKnownEnvironnements`.
Bekannte Hosts (aus den `getEnv()`-Methoden in `src/config/game/`):

| Hostname | Env-Name | gameID (HTML `<body id>`) | baseImgPath (Default `https://hh2.hh-content.com`) |
|---|---|---|---|
| `www.hentaiheroes.com` | `HH_prod` | `hh_hentai` | (default) |
| `test.hentaiheroes.com` | `HH_test` | `hh_hentai` | (default) |
| `nutaku.haremheroes.com` | `NHH_prod` | `hh_hentai` | (default) |
| `thrix.hentaiheroes.com` | `THH_prod` | `hh_hentai` | (default) |
| `eroges.hentaiheroes.com` | `EHH_prod` | `hh_hentai` | (default) |
| `esprit.hentaiheroes.com` | `OGHH_prod` | `hh_hentai` | (default) |
| `www.comixharem.com` | `CH_prod` | `hh_comix` | `https://ch.hh-content.com` |
| `nutaku.comixharem.com` | `NCH_prod` | `hh_comix` | (default) |
| `www.gayharem.com` | `GH_prod` | `hh_gay` | (siehe `GayHaremVars.ts`) |
| `www.gaypornstarharem.com` | `GPSH_prod` | `hh_gay` (?) | (siehe `GayPornstarHaremVars.ts`) |
| `www.pornstarharem.com` | `PSH_prod` (?) | (siehe `PornstarHaremVars.ts`) | (siehe ebd.) |
| `www.transpornstarharem.com` | `TPSH_prod` (?) | (siehe `TransPornstarHaremVars.ts`) | (siehe ebd.) |
| `www.mangarpg.com` | `MR_prod` (?) | (siehe `MangaRpgVars.ts`) | (siehe ebd.) |
| `www.amouragent.com` | `AA_prod` (?) | (siehe `AmourAgentVars.ts`) | (siehe ebd.) |
| `www.hornyheroes.com` | `SH_prod` | `hh_sexy` | (default) |

`(?)` = exakter Env-Name muss in der jeweiligen `getEnv()`-Methode des Game-Files nachgelesen werden.

Folgende Felder werden in `HHEnvVariables.ts` per `for (var key in <Game>.getEnv())` ueberschrieben:

| Feld | Quelle | Wirkung |
|---|---|---|
| `gameID` | `HHKnownEnvironnements[host].id` | Wert des `<body id="...">` (von `PageHelper.getPage()` gelesen) |
| `HHGameName` | env-Name | als ID in HHEnvVariables-Map |
| `baseImgPath` | `HHKnownEnvironnements[host].baseImgPath` oder Default `https://hh2.hh-content.com` | Praefix fuer Bild-URLs |
| `spreadsheet` | `HentaiHeroes.spreadsheet` (HH-Family), leer fuer andere | Externer Link in Blessing-Popup |
| `trollzList` | `<Game>.getTrolls(languageCode)` | Lokalisierte Troll-Namen |
| `sideTrollzList` | nur HH: `HentaiHeroes.getSideTrolls(...)` | - |
| `trollGirlsID` | `<Game>.getTrollGirlsId()` | Mapping Troll-Index -> Girl-IDs |
| `sideTrollGirlsID` | nur HH | - |
| `trollIdMapping` / `sideTrollIdMapping` | spielspezifisches Remapping (z.B. `{21:19}` in HH) | - |
| `lastQuestId` | `<Game>.lastQuestId` | Letzte bekannte Quest-ID (Pause-Schwelle) |
| `boosterId_MB1` | Default 632 (HH); 2619 fuer ComixHarem, PornstarHarem, TransPornstarHarem, GayPornstarHarem | Sandalwood-Item-ID |
| `pagesIDXxx` / `pagesURLXxx` | meist global; einzelne werden per `<Game>.updateFeatures(env)` ueberschrieben (siehe `MangaRpgVars`, `AmourAgentVars`, `TransPornstarHaremVars`, `GayPornstarHaremVars`) | Page-IDs / Page-URLs |
| `isEnabledXxx` | global; SH_prod hat z.B. viele Features deaktiviert (Champs, Pantheon, Labyrinth, PoV, PoG, MythicPachinko, EquipmentPachinko, Side-Quest, Power-Places) | Feature-Toggles |
| `isPshEnvironnement()` | true fuer `PH_prod`, `NPH_prod` | Generelle PSH-Sonderfaelle (siehe Code) |

Build-spezifische Sonderwerte (Auszug aus `HHEnvVariables.ts`):

- `HH_test.isEnabledDailyRewards = false` (vor Test-Rollout)
- `HH_test.isEnabledFreeBundles = false`
- `SH_prod`: zahlreiche Features deaktiviert (siehe Liste oben)
- `boosterId_MB1`: Comix/PSH/TPSH/GPSH = 2619; HH = 632 (`HHEnvVariables["global"].boosterId_MB1 = 632`)

Datenzugriffs-Unterschiede:

- **Girl-Daten-Quelle**: HH-Family liest meist `availableGirls` oder `girlsDataList`; PSH-Build liefert die Liste unter `girls_data_list` (Module/harem/Harem.ts faellt auf alle drei Pfade nach Reihenfolge zurueck).
- **`shared.Hero` vs `Hero`**: Auf modernen Builds aller Variants ist `unsafeWindow.shared` definiert -> `getHHVars('Hero.x')` haengt automatisch `shared.` davor (siehe Sektion 9.1).
- **Iframe**: Nutaku-Builds (`unsafeWindow.hh_nutaku === true`) leben in einem iframe; HHAuto sendet `postMessage({ImAlive:true},'*')` an `window.top` (StartService.ts:464-468) und haengt `?sess=...` an interne Navigationen an.
- **Endpoint-Unterschiede**: AJAX-Endpoint ist immer derselbe Host wie das Spiel (relativ zur Hostname). Unterschiede ergeben sich indirekt durch `pagesURLXxx`-Konstanten, die bei Game-Builds via `updateFeatures(env)` umgesetzt werden.

## 12. Cheat-Click-Hook (`shared.general.is_cheat_click`)

Im Spiel-Code ist `shared.general.is_cheat_click` eine Funktion, die bei "verdaechtigen" Klick-Mustern (zu schnelle Klicks, kein Mausweg, etc.) `true` zurueckgibt und Aktionen blockiert. Sie wird vom Spiel selbst beim Schicken bestimmter Aktionen ausgewertet.

In HHAuto:

- `Utils/Utils.ts:108-115` enthaelt die Funktion `replaceCheatClick()`. Sie ist **leer** (Body komplett auskommentiert):

  ```ts
  export function replaceCheatClick()
  {
      // unsafeWindow.is_cheat_click=function(e) {
      //     return false;
      // };
      // unsafeWindow.shared.general.is_cheat_click =function(e) {
      //     return false;
      // };
  }
  ```

- `Service/StartService.ts:223` ruft `replaceCheatClick()` einmalig in `start()` auf - aktuell ein No-Op, weil der Body auskommentiert ist.

Bedeutung: Die Override-Stelle ist im Code vorbereitet, wurde aber **deaktiviert**. Eine fruehere Version ueberschrieb beide Pfade (`unsafeWindow.is_cheat_click` und `unsafeWindow.shared.general.is_cheat_click`) mit einer immer-`false`-Stub. Aktuell verlaesst sich HHAuto darauf, dass durch `randomInterval(...)` und Timing-Pausen kein Cheat-Detection-Trigger ausgeloest wird.

Wann wuerde ein echter Cheat-Click triggern (Spielseite)? Wenn der Spielcode bei einem Action-Submit `is_cheat_click(event)` aufruft und dieses `true` liefert -> Action wird verworfen. HHAuto mitigiert das, indem es `getHHAjax()(params, ...)` direkt aufruft (statt synthetischer Klicks) und Buttons nur dort triggert, wo sie tatsaechlich noetig sind. Trotzdem zeigt der bewusste Verzicht auf den Override, dass aktuell **kein** synthetischer Klick-Pfad mehr Cheat-Detection ausloesen sollte.

Window-Interface (`src/index.ts:62`) enthaelt `is_cheat_click: any` als declared property - das ist das Type-Hint fuer alte direkte Reads/Writes, die heute nicht mehr aktiv sind.

## 13. Race-Conditions / Timing

### 13.1 Skript-Start

`src/index.ts:88` ruft `hardened_start()` direkt nach Modul-Load. Tampermonkey injiziert den User-Script aber **vor** dem game-eigenen JS, daher sind globale Variablen wie `shared.Hero` zum Erst-Aufruf typisch noch nicht da.

Schritte in `hardened_start()` (`Service/StartService.ts:175`):

1. Registriert `GM_registerMenuCommand("Save Debug Log", saveHHDebugLog)`.
2. Pruefung `unsafeWindow.jQuery == undefined` -> falls fehlt: ggf. "Forbidden"-Page erkennen (innerText der `body`); bei Forbidden: reload nach `randomInterval(60, 300)` Sekunden; sonst Abbruch (kein Crash).
3. `started` Lock + `start()`-Aufruf.

In `start()` (`Service/StartService.ts:197`):

1. **Hero-Retry-Loop**: Wenn `unsafeWindow.shared?.Hero === undefined`:
   - `heroRetryCount++`. Maximal `HERO_MAX_RETRIES = 15` Versuche, dann Abbruch ("Try reloading the page.").
   - `setTimeout(hardened_start, 5000)` -> alle 5 Sekunden neu versuchen.
   - `started = false` zurueckgesetzt, damit ein erneuter Aufruf zaehlt.
   - Diese Loop entspraeche bis zu 75 Sekunden Wartezeit.
2. Sobald Hero verfuegbar: Timer-Cleanup (`clearTimeout(heroRetryTimer); heroRetryCount = 0`).
3. Login-Check: `$("a[rel='phoenix_member_login']").length > 0` -> nicht eingeloggt, abbrechen.
4. `StartService.checkVersion()` migriert von `previousScriptVersion` (`TK.scriptversion`) auf `GM.info.script.version`.
5. `migrateHHVars()` migriert ggf. alten `HHAuto_`-Praefix auf einen custom Praefix (heute meist No-Op).
6. Liest `Hero.infos.questing.choices_adventure` und `Hero.infos.questing.id_world`, persistiert als `TK.MainAdventureWorldID` / `TK.SideAdventureWorldID`.
7. `setDefaults()` schreibt fehlende oder ungueltige Settings auf Defaults.
8. Menu, Timers, Listener, Ad-Move, `Booster.collectBoostersFromAjaxResponses()` registrieren.
9. `setTimeout(autoLoop, 1000)` schliesst den Init ab.

### 13.2 Module-spezifische Retries

Mehrere Module haben einen Retry-Pattern fuer den Fall, dass ihre erforderliche Game-Variable noch nicht da ist:

- `HeroHelper.getHero()` (`Helper/HeroHelper.ts:23`): Wenn `shared.Hero === undefined`, schedule `autoLoop` (mit `TK.autoLoopTimeMili` ms) und gib `undefined` zurueck.
- `League.getLeagueCurrentLevel()` (`Module/League.ts:73-78`): Wenn `unsafeWindow.current_tier_number === undefined`, schedule `autoLoop` (gleiches Muster).
- `getHHVars(...)` returns `null` bei jeder fehlenden Pfad-Komponente -> Caller muessen das pruefen. Die meisten Caller akzeptieren `null` und logen.

### 13.3 AJAX-Race um Booster-Status

`equipBooster()` (`Helper/HeroHelper.ts:108-176`) hat einen kombinierten Race-Schutz:

- Vor dem Call: `setStoredValue(TK.autoLoop, "false")` -> Loop pausiert.
- 15-Sekunden-Timeout via `setTimeout(...)` als Safeguard wenn weder `onSuccess` noch `onError` vom Spiel kommen.
- `settled`-Flag verhindert doppelte Auflosung.
- Bei Timeout: `deleteStoredValue(TK.boosterStatusLastUpdate)` invalidiert den 10-Min-TTL-Cache, sodass beim naechsten Auto-Equip-Cycle der Markt-Refresh gefordert wird.
- Bei `data.success === false`: gleiches Invalidieren (Annahme: anderer Tab hat in der Zwischenzeit equipped).
- Nach Settle: `autoLoop` mit `randomInterval(500, 800)` neu gestartet.

`Booster.waitForBattleResponse()` / `Booster.notifyBattleResponseProcessed()` (`Module/Booster.ts:52-99`): Lock-Pattern mit Promise + 10s-Timeout fuer den Fall, dass die Battle-AJAX-Response zu spaet kommt - resolveiert dann anyway, um den Loop nicht zu blockieren.

### 13.4 AutoLoop-Pause-Mechaniken

- `TK.autoLoop = "false"` schaltet die Hauptschleife aus. Wird gesetzt von:
  - 31 Modulen (siehe Sektion 7) waehrend Multi-Page-Flows (Stuff Team, Give XP, Equip Booster, Page-Navigation).
  - `Service/StartService.ts:441-449`: `setStoredValue(TK.autoLoop, "true")` nur, wenn KEIN aktiver `TK.haremGirlMode` laeuft - sonst wird der Loop nach Reload bewusst pausiert gelassen.
- `SK.master = "false"` -> Master-Switch off, Loop laeuft nicht (gepfueft in `Scheduler.ts`, `AutoLoop.ts`, `HHMenuHelper.ts`).
- `SK.mousePause = "true"` + `SK.mousePauseTimeout` -> Loop pausiert bei Maus-Aktivitaet (Mechanik in `MouseService.ts`).

### 13.5 Timer-System

- `TK.Timers` haelt eine JSON-Map `name -> {endAt, startedAt}`. Geschrieben von `Helper/TimerHelper.ts`, gelesen von `StartService.ts:266` beim Start (`setTimers(...)`).
- Beim Skript-Start wird `setTimers(getStoredJSON(TK.Timers, {}))` ausgefuehrt; persistierte Timer leben also ueber Reloads weg.
- `getSecondsLeft(name)` / `setTimer(name, seconds)` / `clearTimer(name)` / `checkTimer(name)` sind die Wrapper.
- Hint: `convertTimeToInt(text)` parsed das Game-DOM-Timer-Format (HH:MM:SS) z.B. fuer Shop-Refresh.

### 13.6 Bekannte Edge-Cases

- **Erstaufruf vor Game-Load**: 15x 5s-Retry-Loop (siehe oben).
- **Forbidden-Page**: 1-5min Random-Reload (Anti-Bot-Backoff).
- **Tab-Wechsel und SK.settPerTab=true**: Settings landen in `sessionStorage`, also pro Tab. Migration zwischen Tabs ist nicht implementiert - User muss bewusst exportieren.
- **boosterStatusLastUpdate TTL**: 10 Minuten (`Booster.BOOSTER_STATUS_TTL_MS = 10 * 60 * 1000`). Nach Ablauf wird Markt erneut gescraped, bevor equipt wird.
- **`unsafeWindow.shared.GirlSalaryManager.girlsMap`**: Fuer Salary aktiv - kann erst nach Salary-Manager-Init genutzt werden. Code prueft mit `getHHVars(..., false)` (silent).

