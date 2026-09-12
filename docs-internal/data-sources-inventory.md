---
last-verified: 2026-09-11
verified-against-version: 8.13.1
status: current
---

# HHAuto - data sources inventory

A complete inventory of every data source the HHauto script reads.
Source: a systematic grep through all TypeScript files under `src/`.

Since 2026-08-17 there are two tools that check this file against the running
game, instead of deriving it from our own source alone:

- `scripts/catalogue/` -- `bundle` reads the game's source without logging in
  (action names, the `shared.*` API, `hh_*` globals), `observe` records real
  AJAX traffic as shapes, `snapshot` grabs the globals of the open page.
- `scripts/live-check/` -- checks the selectors and API parameters the code
  relies on against the real page.

What stands here is therefore verifiable. What has never been measured live
should be marked as such.

**Re-checked 2026-09-11** (8.13.1, test account level 115, 24 girls, in a
club): on 39 pages every global of this file was read for existence and type
(no values) and every static selector counted, without HHauto. The result per
page is in section 10. Where a row differs from it, the row says so;
"measured" means this probe.

> Conventions
>
> - "File" is given without the `src/` prefix.
> - "Page ID" corresponds to the constants from
>   `ConfigHelper.getHHScriptVars("pagesIDXxx")` or the `<body page="...">`
>   attribute.
> - "Available on" is marked *unclear* (tag `(?)`) when it cannot be shown
>   unambiguously from the source.
> - localStorage/sessionStorage keys carry the default prefix `HHAuto_` (see
>   `HHStoredVarPrefixKey`).
> - Code references name file plus symbol/function (instead of line numbers),
>   to avoid documentation drift on refactorings.

## 1. unsafeWindow globals (direct access)

Direct `unsafeWindow.XXX` accesses (without the `getHHVars` wrapper), reads and
writes. See also `src/index.ts` for the `Window` interface extension that types
every property used here.

| Variable path | Data type | Available on | File | Symbol/function | Purpose |
|---|---|---|---|---|---|
| `unsafeWindow.shared` | object (the root container) | every page after the game JS has loaded | `Helper/HHHelper.ts` | `prefixIfNeeded` | the existence check for `prefixIfNeeded()` (decides whether `Hero.x` is rewritten to `shared.Hero.x`) |
| `unsafeWindow.shared.Hero` | object (hero data) | every page after the game JS has loaded | `Helper/HeroHelper.ts`, `Service/StartService.ts` | `getHero()`, `start()` | the existence check plus the retry loop; `getHero()` returns this object |
| `unsafeWindow.shared.general.hh_ajax` | function `(params, onSuccess, onError) => void` | every page after the game JS has loaded | `Utils/Utils.ts` | `getHHAjax()` | the bridge to the game's internal AJAX function |
| `unsafeWindow.shared.general.is_cheat_click` | function (the cheat detector) | every page after the game JS has loaded | `Utils/Utils.ts` | `replaceCheatClick()` (commented out) | a prepared override point -- currently disabled (see section 12) |
| `unsafeWindow.shared.animations.loadingAnimation.start` | function | every page (measured); read on the shop page | `Module/Shop.ts` | `appendMenuSell()` | save/replace/restore: suppress the loading animation during a bulk sell |
| `unsafeWindow.shared.animations.loadingAnimation.stop` | function | the shop page | `Module/Shop.ts` | `appendMenuSell()` | save/replace/restore (likewise) |
| `unsafeWindow.is_cheat_click` | function (the cheat detector) | on none of the 39 pages (measured) | `Utils/Utils.ts` | `replaceCheatClick()` (commented out) | an outdated override point |
| `unsafeWindow.hh_nutaku` | boolean/truthy | the NHH/NPH Nutaku build; on www.hentaiheroes.com `null` on every page (measured) | `Service/PageNavigationService.ts`, `Service/StartService.ts` | `addNutakuSession()`, `start()` | the Nutaku special case: inject the session token through `?sess=`; postMessage("ImAlive") to the parent |
| `unsafeWindow.hh_prices` | object (a price map, e.g. `fight_cost_per_minute`) | every page (measured, 39 of 39) | `Module/Troll.ts` | `Troll.canBuyFight()`, `Troll.canBuyFightLoveRaid()` | computing `pricePerFight` for auto-buying combats |
| `unsafeWindow.has_contests_datas` | -- | **on no page** (measured, not on `?tab=contests` either; the name occurs in none of the 33 game scripts and in no inline script of the home, map, raid and contest pages) | `Service/Pipeline.config.ts` | the precondition "Time to get contest rewards." | one of three OR conditions beside the timer `nextContestCollectTime` and `Contest.getClaimsButton()`; this part is always false today, the other two carry it |
| `unsafeWindow.contests_timer.next_contest` | number (sec) | all activities tabs (measured) | `Module/Contest.ts` | `Contest.collectAndSchedule()` | the next contest change |
| `unsafeWindow.contests_timer.duration` | number (sec) | all activities tabs (measured) | `Module/Contest.ts` | `Contest.collectAndSchedule()` | the contest duration |
| `unsafeWindow.contests_timer.remaining_time` | number (sec) | all activities tabs (measured) | `Module/Contest.ts` | `Contest.collectAndSchedule()` | the time left in the current contest |
| `unsafeWindow.daily_goals_list` | array (KKDailyGoal) | all activities tabs (measured, 11 entries) | `Module/DailyGoals.ts` | `DailyGoals.parse()` | iterating over the daily goal tiers |
| `unsafeWindow.event_data` | object (HHEventData) | the event page (`pagesIDEvent`) | `Module/Events/EventModule.ts` | `EventModule.run()`, `displayPrioInDailyMissionGirl()` | event girls and event metadata |
| `unsafeWindow.event_data.girls` | array (KKEventGirl) | the event page with event girls (measured on `event_533`: 2; not present on the PoA tab) | `Module/Events/EventModule.ts` | `displayPrioInDailyMissionGirl()` | the list of event girls for the priority UI |
| `unsafeWindow.current_event` | object (HHEventData) | the event page (fallback) | `Module/Events/EventModule.ts` | `EventModule.run()` | the fallback when `event_data` is not set |
| `unsafeWindow.season_sec_untill_event_end` | number (sec) | `/season.html`; not present on `/season-arena.html` (measured) | `Module/Events/Season.ts` | `Season.getRemainingTime()` | the time left in the season event |
| `unsafeWindow.hero_data` | object | the season arena page, plus all pre-battle pages and edit-team (measured) | `Module/Events/Season.ts` | `Season.parseSeasonOpponents()` | the hero block for the arena reload |
| `unsafeWindow.opponents` | array | the season arena page | `Module/Events/Season.ts` | `Season.parseSeasonOpponents()` | the current list of arena opponents |
| `unsafeWindow.seasonal_event_active` | boolean | on no page while a mega event is running (measured); not checked without a mega event | `Module/Events/Seasonal.ts` | `Seasonal.isActiveEvent()` | the indicator that a seasonal event is running |
| `unsafeWindow.seasonal_time_remaining` | number (sec) | like `seasonal_event_active`: nowhere during a mega event (measured) | `Module/Events/Seasonal.ts` | `Seasonal.isActiveEvent()` | the time left in the seasonal |
| `unsafeWindow.mega_event_active` | boolean | every page (measured) | `Module/Events/Seasonal.ts` | `Seasonal.isActiveEvent()` | the indicator that a mega event is running |
| `unsafeWindow.mega_event_time_remaining` | number (sec) | every page (measured) | `Module/Events/Seasonal.ts` | `Seasonal.isActiveEvent()` | the time left in the mega event |
| `unsafeWindow.mega_event_data` (through `getHHVars`) | object; `cards` is a **string** (measured), which the code reads with `indexOf('1')` | the seasonal page | `Module/Events/Seasonal.ts` | `Seasonal.run()` (`getHHVars(\"mega_event_data.cards\")`) | the mega event cards owned |
| `unsafeWindow.current_tier_number` | number | the league page | `Module/League.ts` | `League.getLeagueCurrentLevel()` | the current league tier |
| `unsafeWindow.opponents_list` (typed `KKPentaDrillOpponents[]`) | array | the penta drill page | `Module/PentaDrill.ts` | `PentaDrill.run()` | the list of penta drill opponents |
| `unsafeWindow.penta_drill_data.cycle_data.seconds_until_event_end` | number (sec) | the penta drill page | `Module/PentaDrill.ts` | `PentaDrill.getRemainingTime()` | the time left in the penta drill event |
| `unsafeWindow.girl_squad` | array (labyrinth squad girls with `remaining_ego_percent`) | the labyrinth pre-battle / labyrinth page | `Module/Labyrinth.ts` | `Labyrinth.chooseOpponent()` | recognises injured squad girls |
| `unsafeWindow.teams_data` | object, keyed by slot index (measured: 30 entries) | the battle teams page (`pagesIDBattleTeams`) | `Module/TeamModule.ts` | `TeamModule.getSelectedGirlsId()`, `getSelectedGirls()` | the team definitions (girls_ids, girls) |
| `unsafeWindow.pop_list` | boolean | all activities tabs (measured: `true` on the PoP list, `false` on the single page) | `Helper/PageHelper.ts` | `getPage()` | recognises whether we are on the PoP list page |
| `unsafeWindow.pop_index` | number | all activities tabs, measured always `0`, on the single page too | `Helper/PageHelper.ts` | `getPage()` | the currently selected PoP instance |
| `unsafeWindow.harem.preselectedGirlId` (a comment hint only) | number | the harem page | `Module/harem/Harem.ts` | `fillCurrentGirlItem()` etc. | read in the code through `$('#harem_right .opened').attr('girl')` instead; the comment documents the corresponding unsafeWindow variable |
| `unsafeWindow.girl` | object (KKHaremGirl) | the girl page (`pagesIDGirlPage`) | `Module/harem/HaremGirl.ts` | `HaremGirl.getCurrentGirl()` | the harem girl currently shown |
| `unsafeWindow.id_girl` | number | the quest page `/quest/<id>` (measured); **not** present on `/girl/<id>`, see `live-verification-lessons.md` | `Module/harem/HaremGirl.ts` | `HaremGirl` (the affection page back link) | the girl's ID (for navigating back) |
| `unsafeWindow.player_gems_amount` | map `{element: {amount: number}}` | the girl page and `/characters.html` (measured, 8 elements) | `Module/harem/HaremGirl.ts` | `awakGirl()`, `canAwakGirl()`, `canGiftGirl()` | the gem stock per element for the awakening check |
| `unsafeWindow.Hero.currencies.soft_currency` (commented out) | number | every page | `Module/Market.ts` (a comment) | - | outdated direct access (today through `Hero.update`) |
| `unsafeWindow.player_inventory.armor` | array (armor entries) | the market page (`pagesIDShop`) | `Module/EquipmentGear.ts` | `fetchInventory()` | the first page of the armor inventory; the rest comes through `market_get_armor`. Measured 2026-08-17: 204 entries, 104 mythic / 100 legendary, all `skin.wearer = "hero"`. An entry carries `id_member_armor` and **no** `id_member_armor_equipped`. 2026-09-11 on the test account: 65 entries |
| `unsafeWindow.item_to_upgrade` | object (armor plus `level`) | the mythic upgrade page (not re-checked: the page needs an item as a parameter) | `Module/EquipmentGear.ts` | the upgrade loop | **A trap:** `level` is frozen at page build and does not follow a level-up on the same page. That was one of the five bugs of August 2026 |
| `unsafeWindow.equipped_armor` | map `{slot: armor entry}` | the market page (measured: 6 entries) | (no consumer yet) | - | the six worn pieces. The script reads them from the DOM today through `#equiped .armor div[id_item]`, not through this global. An entry carries `id_member_armor_equipped` and **no** `id_member_armor` key -- confusing the two forms discarded all six worn pieces in August |

In addition, `src/index.ts` (the Window interface) types the following
properties -- some are not read at present, but they are part of the bridge
contracts: `championData`, `Collect`, `HHTimers`, `league_tag`,
`server_now_ts`, `love_raids`.

Measured 2026-09-11: `Collect`, `HHTimers` and `league_tag` exist on none of
the 39 pages, `server_now_ts` on every one, and `championData` only on
`/club-champion.html` (the champion page itself was not reachable).
`love_raids` is an array on `/map.html` (24 entries), `/champions-map.html` and
`/season.html` -- declared there as a `var`, so a window property. On
`/love-raids.html`, the only page `LoveRaidManager.parse()` reads on, it stands
measured as `const love_raids = [...]` in an inline script: an array in the
page scope (26 raids, troll, season and champion; `/map.html` held 23 at the
same time, troll only), but **no** window property. `window.love_raids` there
is the empty module object of the game script `love_raids.js` (0 keys). A
userscript with `@grant` reaches only window properties; `parseRaids` read the
bare name until 8.13.1 and saw (inferred) the empty object there.
`LoveRaidManager.readPageRaids()` takes `unsafeWindow.love_raids` when it is an
array, and otherwise reads the array from the page's inline script.

`server_now_ts` is read through `getHHVars('server_now_ts')` (see section 2),
not directly through `unsafeWindow`.


## 2. The shared namespace (reads through `getHHVars`)

`getHHVars(path)` calls `prefixIfNeeded(path)`: when `unsafeWindow.shared`
exists AND the path starts with `Hero.`, `shared.` is prepended automatically.
It follows that every `Hero.x` read effectively reaches
`unsafeWindow.shared.Hero.x`. Other paths have to say `shared.` explicitly.
`ConfigHelper.getHHScriptVars(path,false)` can additionally deliver a path
override (rarely used).

| Path (input to getHHVars) | Effectively resolved as | Content | File | Purpose |
|---|---|---|---|---|
| `Hero.infos.id` | `shared.Hero.infos.id` | the player ID | `Helper/HeroHelper.ts` | `HeroHelper.getPlayerId()` |
| `Hero.infos.class` | `shared.Hero.infos.class` | the hero class 1-3 | `Helper/HeroHelper.ts` | `HeroHelper.getClass()` |
| `Hero.infos.level` | `shared.Hero.infos.level` | the level | `Helper/HeroHelper.ts` | `HeroHelper.getLevel()` |
| `Hero.infos.carac1` | `shared.Hero.infos.carac1` | stat 1 (Hardcore) | `Helper/HeroHelper.ts` | the stat upgrade calculation in `doStatUpgrades()` |
| `Hero.infos.carac2` | `shared.Hero.infos.carac2` | stat 2 (Charm) | `Helper/HeroHelper.ts` | the stat upgrade calculation |
| `Hero.infos.carac3` | `shared.Hero.infos.carac3` | stat 3 (Know-how) | `Helper/HeroHelper.ts` | the stat upgrade calculation |
| `Hero.infos.hc_confirm` | `shared.Hero.infos.hc_confirm` | the hardcore confirmation on/off | `Module/Troll.ts` | prevents accidental koban spending in `Troll.recharge()` |
| `Hero.infos.questing.id_world` | `shared.Hero.infos.questing.id_world` | the current world | `Service/StartService.ts`, `Module/Quest.ts`, `Module/Troll.ts`, `Module/PlaceOfPower.ts`, `Service/ParanoiaService.ts` | the world ID for quest/troll/PoP logic |
| `Hero.infos.questing.id_quest` | `shared.Hero.infos.questing.id_quest` | the current quest | `Module/Quest.ts` | quest progress in `Quest.getMainQuestUrl()` |
| `Hero.infos.questing.current_url` | `shared.Hero.infos.questing.current_url` | the URL of the current quest | `Module/Quest.ts` | direct navigation to the current quest |
| `Hero.infos.questing.choices_adventure` | `shared.Hero.infos.questing.choices_adventure` | 0 = main, otherwise a side adventure | `Service/StartService.ts`, `Module/Troll.ts` | recognises main vs side adventure |
| `Hero.currencies.soft_currency` | `shared.Hero.currencies.soft_currency` | Ymens | `Helper/HeroHelper.ts` | `HeroHelper.getMoney()` |
| `Hero.currencies.hard_currency` | `shared.Hero.currencies.hard_currency` | kobans | `Helper/HeroHelper.ts` | `HeroHelper.getKoban()` |
| `Hero.energies.kiss.amount` | `shared.Hero.energies.kiss.amount` | the current kisses | `Module/Events/Season.ts` | the season energy in `Season.getEnergy()` |
| `Hero.energies.kiss.max_regen_amount` | `shared.Hero.energies.kiss.max_regen_amount` | max kisses | `Module/Events/Season.ts` | the season energy cap |
| `Hero.energies.kiss.next_refresh_ts` | `shared.Hero.energies.kiss.next_refresh_ts` | the next refresh | `Module/Events/Season.ts`, `Service/AutoLoopActions.ts`, `Service/ParanoiaService.ts` | the timer for the energy refill |
| `Hero.energies.kiss.seconds_per_point` | `shared.Hero.energies.kiss.seconds_per_point` | the regeneration rate | `Service/ParanoiaService.ts` | computing "points before the switch" |
| `Hero.energies.fight.amount` | `shared.Hero.energies.fight.amount` | the current combats | `Module/Troll.ts` | troll battles in `Troll.getEnergy()` |
| `Hero.energies.fight.max_regen_amount` | `shared.Hero.energies.fight.max_regen_amount` | max combats | `Module/Troll.ts` | the troll cap |
| `Hero.energies.fight.next_refresh_ts` | `shared.Hero.energies.fight.next_refresh_ts` | the next combat refresh | `Service/ParanoiaService.ts` | the paranoia calculation |
| `Hero.energies.fight.seconds_per_point` | `shared.Hero.energies.fight.seconds_per_point` | the combat regeneration rate | `Service/ParanoiaService.ts` | the paranoia calculation |
| `Hero.energies.challenge.amount` | `shared.Hero.energies.challenge.amount` | the current challenges (league) | `Module/League.ts` | league energy |
| `Hero.energies.challenge.max_regen_amount` | `shared.Hero.energies.challenge.max_regen_amount` | max challenges | `Module/League.ts` | the league cap |
| `Hero.energies.challenge.next_refresh_ts` | `shared.Hero.energies.challenge.next_refresh_ts` | the league refresh | `Module/League.ts`, `Service/ParanoiaService.ts` | the timer |
| `Hero.energies.challenge.seconds_per_point` | `shared.Hero.energies.challenge.seconds_per_point` | the league regeneration | `Service/ParanoiaService.ts` | paranoia |
| `Hero.energies.quest.amount` | `shared.Hero.energies.quest.amount` | the current quest energy | `Module/Quest.ts` | the quest trigger |
| `Hero.energies.quest.max_regen_amount` | `shared.Hero.energies.quest.max_regen_amount` | max quest energy | `Module/Quest.ts` | the quest cap |
| `Hero.energies.quest.next_refresh_ts` | `shared.Hero.energies.quest.next_refresh_ts` | the quest refresh | `Service/ParanoiaService.ts` | paranoia |
| `Hero.energies.quest.seconds_per_point` | `shared.Hero.energies.quest.seconds_per_point` | the quest regeneration | `Service/ParanoiaService.ts` | paranoia |
| `Hero.energies.worship.amount` | `shared.Hero.energies.worship.amount` | the current worship (pantheon) | `Module/Pantheon.ts` | pantheon energy |
| `Hero.energies.worship.max_regen_amount` | `shared.Hero.energies.worship.max_regen_amount` | max worship | `Module/Pantheon.ts` | the pantheon cap |
| `Hero.energies.worship.next_refresh_ts` | `shared.Hero.energies.worship.next_refresh_ts` | the worship refresh | `Module/Pantheon.ts`, `Service/AutoLoopActions.ts`, `Service/ParanoiaService.ts` | the timer |
| `Hero.energies.worship.seconds_per_point` | `shared.Hero.energies.worship.seconds_per_point` | the worship regeneration | `Service/ParanoiaService.ts` | paranoia |
| `Hero.energies.drill.amount` | `shared.Hero.energies.drill.amount` | drill energy (penta drill) | `Module/PentaDrill.ts` | penta drill |
| `Hero.energies.drill.max_regen_amount` | `shared.Hero.energies.drill.max_regen_amount` | max drill | `Module/PentaDrill.ts` | the penta drill cap |
| `Hero.energies.drill.next_refresh_ts` | `shared.Hero.energies.drill.next_refresh_ts` | the drill refresh | `Module/PentaDrill.ts`, `Service/AutoLoopActions.ts` | the timer |
| `server_now_ts` | `unsafeWindow.server_now_ts` (no hero prefix -- no `shared.` rewrite) | the server timestamp (sec) | `Module/Booster.ts` | computing the booster end time |
| `championData.team` | `unsafeWindow.championData.team` | the champion team currently selected | `Module/Champion.ts` | champion battle team logic |
| `championData.champion.id` | `unsafeWindow.championData.champion.id` | the ID of the current champion | `Module/Champion.ts` | the team save slot |
| `championData.champion.poses` | `unsafeWindow.championData.champion.poses` | the list of required poses | `Module/Champion.ts` | team selection |
| `championData.freeDrafts` | `unsafeWindow.championData.freeDrafts` | the free reroll counter | `Module/Champion.ts` | the champion reroll |
| `championData.hero_damage` | `unsafeWindow.championData.hero_damage` | the hero's damage | `Module/Champion.ts` | the champion battle result |
| `championData.fight.active` | `unsafeWindow.championData.fight.active` | a club champion fight is active | `Module/ClubChampion.ts` | the club champion state |
| `championData.fight.participants` | `unsafeWindow.championData.fight.participants` | the list of club champion participants | `Module/ClubChampion.ts` | club champion logic |
| `Chat_vars.CLUB_INFO.id_club` | `unsafeWindow.Chat_vars.CLUB_INFO.id_club` | the player's club ID | `Module/Club.ts` | the club status |
| `opponents_list` | `unsafeWindow.opponents_list` | the list of league opponents | `Module/League.ts` | league battles |
| `availableGirls` | `unsafeWindow.availableGirls` | an array of all girls; measured only on `/edit-team.html` (24) | `Module/TeamModule.ts`, `Module/harem/Harem.ts` | the girl data source |
| `girlsDataList` | `unsafeWindow.girlsDataList` | an object of all girls, keyed by id; measured on `/home.html` and `/characters.html` (24 each) | `Module/harem/Harem.ts` | the girl data source |
| `girls_data_list` | `unsafeWindow.girls_data_list` | an array of all girls; measured on `/waifu.html` at HentaiHeroes (24), so not only in the PSH build | `Module/harem/Harem.ts` | `getWaifuPageGirlsList()`, `moduleHaremCountMax()` |
| `shared.GirlSalaryManager.girlsMap` | `unsafeWindow.shared.GirlSalaryManager.girlsMap` | the salary manager's live girl map; measured on every page (24 entries) | `Module/harem/Harem.ts` | the salary manager bridge |
| `shared.GirlSalaryManager.girlsListSec` | `unsafeWindow.shared.GirlSalaryManager.girlsListSec` | a secondary girl list; measured on every page (4 entries) | `Module/harem/Harem.ts` | the salary manager bridge |
| `salary_collect` | `unsafeWindow.salary_collect` | the summed salary; measured only on `/home.html` | `Module/harem/HaremSalary.ts` | the salary tag |
| `current_event.event_data.puzzle_pieces` | `unsafeWindow.current_event.event_data.puzzle_pieces` | the lively scene puzzle pieces; not checked (no lively scene event on 2026-09-11) | `Module/Events/LivelyScene.ts` | solving the lively scene |
| `mega_event_data.cards` | `unsafeWindow.mega_event_data.cards` | the mega event cards owned | `Module/Events/Seasonal.ts` | the seasonal event state |

Note: `getHHVars` returns `null` when nothing exists and logs (which can be
suppressed through the second parameter `logging=false`). Examples in the code:
`getHHVars("availableGirls", false)`, `getHHVars("Chat_vars.CLUB_INFO.id_club",
false)`, `getHHVars("girlsDataList", false)`, `getHHVars("girls_data_list",
false)`.


## 3. AJAX actions (the request side)

Every `action: "..."` string the script's code actively sends. Most calls run
through `getHHAjax()` (which delegates to `shared.general.hh_ajax`); two run
directly through jQuery `$.ajax` (noted).

> **Important:** in `Service/AutoLoopActions.ts` strings such as
> `action: "loveraid"`, `"contest"`, `"mission"`, `"champion"`,
> `"clubChampion"`, `"seasonal"`, `"bundle"`, `"dailyGoals"`, `"labyrinth"` are
> NOT sent as AJAX actions; they are internal handler tags for
> `runStandardHandler` (-> the `ctx.lastActionPerformed` sequence logic). They
> are therefore not listed here.

### 3.1 Calls through `getHHAjax()`

| action string | Further parameters | File | Symbol/function | What for |
|---|---|---|---|---|
| `hero_update_stats` | `carac: "carac1"|"carac2"|"carac3"`, `nb: <mult>` (1/10/30/60) | `Helper/HeroHelper.ts` | `doStatUpgrades()` | a stat point upgrade. The answer measured 2026-09-11 (nb=1): `{success, currency:{soft_currency}, carac<N>, endurance, chance, statsPrices:{prices:{x1,x10,x30,x60}, base_stat, max}}` -- `carac<N>` is the total value including bonuses, `x1` the price of the **next** point. `shared.Hero.infos.carac<N>` does not move in the running document, only after a reload; `doStatUpgrades` therefore counts a confirmed purchase itself, takes `statsPrices.max` as the cap and `currency.soft_currency` as the balance (since 8.13.1). A purchase without cover got no answer when measured |
| `market_equip_booster` | `id_item: <num>`, `type: "booster"` | `Helper/HeroHelper.ts` | `HeroHelper.equipBooster()` | equip a booster (normal or mythic) |
| `champion_team_reorder` | `champion_id`, further team fields, `champion_type: "club_champion"|"champion"` | `Module/Champion.ts` | `Champion.setChampionTeam()` | set the champion team anew |
| `do_battles_leagues` | `opponent_id`, `number_of_battles` | `Module/League.ts` | `League` (the battle submit) | start a league battle (several) |
| `market_buy` | `id_item`, `quantity`, `currency`, `type` (gift/potion/booster) | `Module/Market.ts` | `Market.maintainStack()` | buy an item |
| `market_auto_buy` | `id_item`, `quantity`, `type` | `Module/Market.ts` | `Market.maintainStack()` | auto-buy (in bulk) |
| `girl_equipment_unequip_all_girls` | (no body) | `Module/TeamModule.ts` | `TeamModule.assignTopTeam()` | on "Stuff Team", clear all girls before equipping |
| `girl_equipment_equip_all` | `id_team` (selected), `id_girl` | `Module/TeamModule.ts` | `TeamModule` (the equip loop) | equipment for all girls of a team |
| `champion_buy_ticket` | `currency: "energy_quest"`, `amount` | `Service/AutoLoopActions.ts` | `handleEnergyChampion()` (the inner `buyTicket()`) | buy a champion ticket with quest energy |
| `get_girls_blessings` | (no body) | `Service/BlessingService.ts` | `BlessingService.fetchAndCache()` | request and cache the blessing data |
| `arena_reload` | `opponent_id` (chosenID) | `Module/Events/Season.ts` | `Season` (the reroll logic) | a season arena reload (reroll) |
| `girl_skills_reset` | `id_girl` | `Module/harem/Harem.ts` | `Harem.resetSkillsOnCurrentGirl()` | reset a girl's skills |
| `edit_team` | `class: "Hero"`, `girls[]` (as strings), `battle_type`, `id_team` (where present) | `Module/TeamModule.ts` | `TeamModule.saveTeamInPlace()` | save a team |
| `market_get_armor` | `id_member_armor` (the last ID seen) | `Module/EquipmentGear.ts` | `fetchInventory()` | the next page of the armor inventory; empty `items` marks the end |
| `market_equip_armor` | `id_member_armor` | `Module/EquipmentGear.ts` | the equip loop | put an armor piece on the hero |
| `team_calculate_caracs` | `girls[]`, `battle_type` | `Service/TeamEvaluationService.ts` | candidate ranking | let the game do the maths instead of rebuilding the values |

### 3.2 Calls directly through jQuery `$.ajax`

| action string | Further parameters | File | Symbol/function | What for |
|---|---|---|---|---|
| `girl_equipment_equip` | `id_girl`, `id_girl_armor`, `sort_by: "rarity"`, `sorting_order: "asc"` | `Module/harem/HaremGirl.ts` | `HaremGirl.equipItem()` | a single piece of equipment onto a girl (bypassing the `getHHAjax()` bridge) |

Note: many more game actions are sent by the game itself. Those are picked up
in section 4 through `onAjaxResponse` hooks -- and in section 3.3 they are now
measured instead of guessed.

### 3.3 Sent by the game -- measured, not derived

Two recordings with `scripts/catalogue/run.mjs observe` on 2026-08-17, together
around 25 minutes of normal play (a pachinko run, a labyrinth move, league,
season, penta drill and troll fights):

| Action | Class | observed | as a literal in the game bundle | HHauto sends it |
|---|---|---|---|---|
| `play` | `Pachinko` | 281x | yes | no |
| `process_rewards_queue` | - | 14x | yes | no |
| `do_battles_leagues` | - | 3x | no | yes |
| `labyrinth_hex_enter` | - | 3x | no | no |
| `seasonal_claim` | - | 6x | no | no |
| `contest_give_reward` | - | 2x | no | no |
| `get_girls_list` | - | 2x | no | no |
| `get_girl` | - | 2x | no | no |
| `do_battles_seasons` | - | 1x | no | no |
| `do_battles_penta_drill` | - | 1x | no | no |
| `do_battles_trolls` | - | 1x | no | no |
| `do_battles_labyrinth` | - | 1x | no | no |
| `labyrinth_pool_select` | - | 1x | no | no |
| `labyrinth_get_member_relics` | - | 1x | no | no |
| `labyrinth_pick_unclaimed_relic` | - | 1x | no | no |
| `adventure_switch` | - | 1x | no | no |
| `get_sweep_status` | - | 1x | no | no |
| `claim` | `Pachinko` | 1x | no | no |
| `claim_all_salaries` | - | 1x | yes | no |
| `event_market_get_data` | - | 1x | no | no |
| `edit_team` | `Hero` | 1x | no | yes |
| `team_calculate_caracs` | - | 1x | no | yes |
| `get_girls_blessings` | - | 1x | yes | yes |
| (without `action`) | `TeamBattle` | 2x | - | - |

**The number that matters: 20 of the 24 actions appear nowhere as a literal in
the game bundle.** The game assembles the names at runtime. Whoever looks for
action names by reading source -- ours or the game's -- does not find them. That
includes **all five** `do_battles_*` variants;
`live-verification-lessons.md` had named two of them as an example, and the
recording proves the whole family.

Two observations about the shape:

- **Not every call carries an `action`.** The team battle submit identifies
  itself through `class: "TeamBattle"` plus `battle_type`, along with
  `battles_amount`, `defender_id`, `attacker[team][]` -- and has no `action` key
  at all.
- `claim_all_salaries` takes `{action, where}` and answers `{money, girls[],
  upcoming_girl_salaries[{next_pay_in, value}], success}`. One call collects
  every salary. HHauto does not use it.
  `money` is the **amount collected**, not the new balance -- measured
  2026-09-11: a balance of 838, the button 46,986, and 47,824 afterwards. The
  game adds the amount to `Hero.currencies.soft_currency` in the browser. A
  stale
  hero snapshot therefore stays stale, only shifted; as a fresher source of the
  money balance this answer is no good.

The complete request and answer shapes are in
`scripts/catalogue/out/observed-actions.md` (keys and types only, no values --
the output carries no account data). To refresh: `node
scripts/catalogue/run.mjs observe --seconds=900` during a play session.

What is missing here is missing for one reason: it was not played in those 25
minutes. Champion, club champion, pantheon, Path of Attraction and the event
fights are not recorded yet.

**A second recording, 2026-09-11** (8.13.1, test account, 20 minutes of HHauto
with `master=true` and the account's settings, captured in the harness). Eleven
actions, parameter and answer keys without values:

| Action | n | Parameters | Answer |
|---|---|---|---|
| `do_battles_trolls` | 4 | `action, bb_team_index, id_opponent, number_of_battles` | `battle_result, hero_changes, objective_points, result, rewards, rounds, success` |
| `do_battles_seasons` | 4 | `action, bb_team_index, id_opponent, number_of_battles` | as for troll, `rounds` per fight |
| `do_battles_penta_drill` | 1 | `action, id_opponent, number_of_battles` | `battle_result, hero_changes, multi_team_battles_result, result, rewards, team_rounds, success` |
| (without `action`) `class: TeamBattle` | 2 | `attacker[team][], battle_type, battles_amount, class, defender_id` | `attacker, battle, defender, end, final, positions, success` |
| `next` | 1 | `action, class, id_quest` | `adventure_name, adventure_type, changes, next_step, progress_to, redirect_to, should_be_registered, success` |
| `start_pop` | 1 | `action, id_place_of_power, selected_girls[]` | `success` |
| `claim_daily_goal_tier_reward` | 1 | `action, tier` | `objective_points, result, rewards, success` |
| `process_rewards_queue` | 12 | `action, get_shop_update, lsk[], product_type` | `rewards, success` |
| `load_payment_methods` | 3 | `action` | `data, success` |
| `show_specific_girl_grade` | 1 | `action, check_only, class, girl_grade, id_girl` | `ava, ico, success` |
| `tutorial_complete` | 3 | `action, tutorial` | `success` |

New against the first recording is `bb_team_index` on the troll and season
fights. A league single fight triggered by hand on the same day ("Challenge!
x1" on the pre-battle page) sent `do_battles_leagues` with `action,
id_opponent, bb_team_index, number_of_battles` (=1); the answer carried
`rewards, result, hero_changes, battle_result, rounds, objective_points,
success` -- the same shape as troll and season. No `do_battles_leagues` from the
script: the challenge energy stood at 2 at the beginning and at the end.
HHauto sent nothing through `getHHAjax()` in those 20 minutes -- a marker in
`getHHAjax` stayed silent; whether it worked was not cross-checked. The fights
and collection actions therefore came from the game pages themselves, after
clicks by the script.


## 4. AJAX response interceptors (`onAjaxResponse`)

`onAjaxResponse(pattern, callback)` from `Utils/Utils.ts` hooks globally into
`\$(document).ajaxComplete`. The trigger: `opt.data` (the request body) matches
the regex passed in. Skip conditions: no `xhr.responseText`, or
`responseData.success !== true`.

| Regex | What is done | Where it is stored | File | Symbol |
|---|---|---|---|---|
| `/(action\|class)/` | practically every game AJAX answer. Parses `equipped_booster` on `action='market_equip_booster'` (with a mythic/normal split at the id_item threshold 632). On a Sandalwood equip (identifier `MB1`), `usages_remaining` is persisted as `TK.sandalwoodMaxUsages`. Decrements Sandalwood's `usages_remaining` on `action='do_battles_trolls'`, with special logic for multi-battles (an even or odd number of shards decides whether all doses are used up or consumption is linear). Filters expired mythic boosters. When Sandalwood has run out with an active plus event / mythic / love raid and multi-battles: navigates to the shop. Triggers `notifyBattleResponseProcessed()` on `do_battles_trolls`. | `HHAuto_Temp_boosterStatus` (`{normal:[], mythic:[]}`, JSON stringified), `HHAuto_Temp_sandalwoodMaxUsages` | `Module/Booster.ts` | `Booster.collectBoostersFromAjaxResponses()` |
| `/action=get_girls_blessings/i` | waits 200 ms, then injects an external spreadsheet link `<a class="hhauto-spreadsheet-link">` into `#blessings_popup .blessings_wrapper` | a DOM injection (no storage) | `Module/Spreadsheet.ts` | `Spreadsheet.run()` (the listener setup on the home page) |
| Any (the tool definition) | (the implementation) -- passes the pattern plus callback to the `ajaxComplete` hook | - | `Utils/Utils.ts` | `onAjaxResponse()` |

Note: `Booster.collectBoostersFromAjaxResponses()` is registered once in
`StartService.start()` (`Booster.collectBoostersFromAjaxResponses();`); the
listener stays active for all following AJAX calls. The `Spreadsheet` listener
is installed per home page load.


## 5. DOM sources with a `data-d` attribute (JSON content)

`data-d` is the game page's central convention for storing JSON item data
directly on the DOM node. Fields in the JSON: `quantity`, `item.{id_item, type,
identifier, rarity, price, currency, value, carac1..3, endurance, chance, ego,
damage, duration, skin, name, ico, display_price, name_add, subtype, ...}`.

Measured 2026-09-11 on `/shop.html`: the merchant's boosters, gifts and potions
carry `id_item, id_member, index, item, price_buy, price_sell, quantity` at the
top, and inside `item` among others `identifier, rarity, type, value, price,
default_market_price`. **Armor is built differently** (the first table row). The
selector counts per page are in section 10.

| jQuery selector | Content schema (fields) | Page | File | Symbol |
|---|---|---|---|---|
| `#shops div.armor.merchant-inventory-item .slot` | measured 2026-09-11: at the top `id_member_armor, id_member, id_item_equip, id_item_skin, index, level, name, price_buy, price_sell, skin, caracs, carac1_equip..carac3_equip, chance_equip, ego_equip, endurance_equip, item`; inside `item` `id_equip, id_item_equip, type, rarity, name_add, carac1..3, chance, currency, damage, ego, endurance, name, weight`. **No** `quantity`, `identifier` or `subtype` | shop (`pagesIDShop`) | `Module/Shop.ts` | `Shop.collectShopFromMarket()` |
| `#shops div.booster.merchant-inventory-item .slot` | `{quantity, item:{id_item, type:"booster", identifier, rarity, value, name, ...}}` | shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` |
| `#shops div.gift.merchant-inventory-item .slot` | `{quantity, item:{id_item, type:"gift", value, ...}}` | shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` |
| `#shops div.potion.merchant-inventory-item .slot` | `{quantity, item:{id_item, type:"potion", value, ...}}` | shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` |
| `#shops div.gift.player-inventory-content .slot` | `{quantity, item:{value, ...}}` | shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` (the HaveAff accumulation) |
| `#shops div.potion.player-inventory-content .slot` | `{quantity, item:{value, ...}}` | shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` (the HaveExp accumulation) |
| `#shops div.booster.player-inventory-content .slot` | `{quantity, item:{id_item, identifier, name, rarity}}` | shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` (HaveBooster plus BoosterIdMap) |
| `#equiped .booster .slot:not(.empty):not(.mythic)` (jQuery `.data('d')`) | a normal booster slot (with `expiration`) | shop | `Module/Booster.ts` | `Booster.collectBoostersFromMarket()` |
| `#equiped .booster .slot:not(.empty).mythic` (jQuery `.data('d')`) | a mythic booster slot (with `usages_remaining`, `lifetime`) | shop | `Module/Booster.ts` | `Booster.collectBoostersFromMarket()` |

**Measured (2026-09-07, on a running market page):** the market page carries the
classes `slot ... mythic` on **two** families of elements that differ only in
their ancestor -- worn under `#equiped`, owned-but-not-worn under
`#player-inventory-booster`. The payloads differ:

| | worn (`#equiped`) | inventory (`#player-inventory-booster`) |
| --- | --- | --- |
| Keys | `id_member_booster_equipped`, `lifetime`, `expiration`, `usages_remaining`, `price_sell` | `price_buy`, `price_sell`, `id_item`, `id_member` |
| Dose count | present | **absent entirely** |

The same trap as with the armor above: the difference is the `..._equipped`
key, not the class. An inventory entry in `boosterStatus` makes
`haveBoosterEquiped()` say true for a booster that is not on, and the missing
dose count is neither a number nor `null` -- `<= 0` then never applies (issue
#1874). `collectBoostersFromMarket()` filters on
`id_member_booster_equipped` since 8.12.3.

The full dose count stands as `item.default_usages` in the same payload
(measured: MB1 11, MB2 100, MB5 100). The game itself falls back on it when
`usages_remaining` is missing or 0 -- in `shared.js`:
`t.usages_remaining&&t.usages_remaining>0?t.usages_remaining:t.item.default_usages`.

| `#player-inventory.armor .slot:not(.empty)[data-d*='"rarity":"mythic"']` (a selector matching on content) | a filter through a substring match in `data-d` | shop | `Module/Shop.ts` | `Shop.moduleShopActions()` |
| `[data-d*='"name_add":<X>']` (a dynamic filter) | filter by stat. Measured 2026-09-11 in `#player-inventory.armor` (65 pieces): `name_add` stands as a number without quotes (`"name_add":16`), always followed by a comma. `buildSlotFilter` and the sell loop have searched for `"name_add":<X>,` since 8.13.1; before that the filter with quotes hit nothing, and the loop without the comma counted stat 1 together with 10 to 16 | shop | `Module/Shop.ts` | `Shop.moduleShopActions()` / `setSlotFilter()` |
| `[data-d*='"subtype":<X>']` (a dynamic filter) | filter by item subtype. Measured 2026-09-11: `subtype` appears only in `skin` and as a number (`"subtype":6`); `buildSlotFilter` searches for `"subtype":<X>,` since 8.13.1 (before that in quotes, with no hits); `rarity` stands as a string | shop | `Module/Shop.ts` | `Shop.moduleShopActions()` / `setSlotFilter()` |
| `[data-d*='"rarity":"<X>"']` (a dynamic filter) | filter by rarity | shop | `Module/Shop.ts` | `Shop.moduleShopActions()` / `setSlotFilter()` |
| `#equiped .armor .slot[data-d*=<typesOfSets[idx]>]` | equipped armor with a set match | shop (the sell loop) | `Module/Shop.ts` | the sell loop in Shop |
| The sell loop: `availableItems.filter('.selected')[0].getAttribute('data-d')` | check the selected item | shop | `Module/Shop.ts` | the sell loop |
| `.right-section .slot[data-d]` (the girl equipment list) | `{item:{...}}`, the equipment of the girl page | girl page / girl equipment upgrade | `Module/harem/HaremGirl.ts` | `HaremGirl.upgradeEquipment()` etc. |
| `inSlot.getAttribute("data-d")` (generic, in `RewardHelper.parseRewards`) | the reward item JSON (`{item:{type, identifier, rarity, value, ...}, quantity}`) -- an example is in the code comment | any page with reward slots | `Helper/RewardHelper.ts` | `RewardHelper.parseRewards()` / `computeRewardsCount()` |

A JSON schema example from `Helper/RewardHelper.ts` (a code comment):
```
data-d='{"item":{"id_item":"323","type":"potion","identifier":"XP4","rarity":"legendary",
  "price":"500000","currency":"sc","value":"2500","carac1":"0","carac2":"0","carac3":"0",
  "endurance":"0","chance":"0.00","ego":"0","damage":"0","duration":"0",
  "skin":"hentai,gay,sexy","name":"Spell book",
  "ico":"https://hh.hh-content.com/pictures/items/XP4.png","display_price":500000},
  "quantity":"1"}'
```


## 6. Other DOM sources

All the other relevant DOM reads, split by domain.

### 6.1 Page detection / tab switching

| Selector | What is extracted | Page | File | Symbol |
|---|---|---|---|---|
| `document.getElementById(gameID)` with `.getAttribute('page')` | the page ID (`pagesIDXxx`) | every page | `Helper/PageHelper.ts` | `getPage()` |
| `body[page][id]` `.attr('id')` | the gameID for the "unknown URL" popup | every page | `Helper/ConfigHelper.ts` | `getEnvironnement()` (the popup text) |
| `#activities-tabs > div.switch-tab.underline-tab.tab-switcher-fade-in[data-tab='contests']` | recognises the activities tab "Contests" | the activities page | `Helper/PageHelper.ts` | `getPage()` |
| `[data-tab='missions']` (the same container) | recognises the tab "Missions" | the activities page | `Helper/PageHelper.ts` | `getPage()` |
| `[data-tab='daily_goals']` | recognises the tab "DailyGoals" | the activities page | `Helper/PageHelper.ts` | `getPage()` |
| `[data-tab='pop']` | recognises the tab "PlaceOfPower" | the activities page | `Helper/PageHelper.ts` | `getPage()` |
| `div.pop_list:not([style*="display:none"])` | a visible PoP list is present | activities/PoP | `Helper/PageHelper.ts` | `getPage()` |
| `.pop_thumb_selected[pop_id]` `.attr('pop_id')` | the selected PoP instance ID | activities/PoP | `Helper/PageHelper.ts` | `getPage()` |

### 6.2 Login / forbidden / pre-start checks

| Selector | What is extracted | Page | File | Symbol |
|---|---|---|---|---|
| `document.getElementsByTagName('body')[0].innerText === 'Forbidden'` | recognises the "Forbidden" error page | every page | `Service/StartService.ts` | `hardened_start()` |
| `a[rel='phoenix_member_login']` | the login link is visible -> not logged in | every page | `Service/StartService.ts` | `start()` |

### 6.3 Team / battle teams

| Selector | What is extracted | Page | File | Symbol |
|---|---|---|---|---|
| `.team-member-container[data-team-member-position="0"]` `.attr('data-girl-id')` | the ID of the girl in position 0 | edit-team | `Module/TeamModule.ts` | `TeamModule.getFirstSelectedGirlId()` |
| `.team-slot-container.selected-team` `.attr('data-team-index')` | the index of the selected team | battle teams / edit-team | `Module/TeamModule.ts` | `getSelectedGirlsId()`, `getSelectedGirls()` |
| `#contains_all section .player-panel .player-team .team-hexagon .team-member-container.selectable[data-team-member-position="<N>"]` (N=0..6) | the slot by position | edit-team | `Module/TeamModule.ts` | `assignToTeam()` |
| `.team-member-container[data-girl-id="<girlId>"]` (addClass `selected`) | select a girl by ID | edit-team | `Module/TeamModule.ts` | the equip loop |

### 6.4 Labyrinth

| Selector | What is extracted | Page | File | Symbol |
|---|---|---|---|---|
| `.player-panel .team-hexagon .team-member-container[data-girl-id="<girlId>"][data-team-member-position="<pos>"]` | the check "girl X in position Y" | edit labyrinth team / labyrinth | `Module/Labyrinth.ts` | `Labyrinth.isSelectedGirl()` |
| `.player-panel .team-hexagon .team-member-container[data-girl-id="<girlId>"]` | the check "girl X in the squad" | labyrinth | `Module/Labyrinth.ts` | `Labyrinth.isSelectedGirl()` |
| `.team-hexagon .team-member-container.selectable[data-team-member-position="<pos>"]` | a selectable squad slot | edit labyrinth team | `Module/Labyrinth.ts` | `Labyrinth._selectGirl()` |
| `(...)[data-girl-id]` `.attr('data-girl-id')` compared with `.attr('id_girl')` | the current position against the target | edit labyrinth team | `Module/Labyrinth.ts` | `Labyrinth._selectGirl()` |
| `.opponent-power .opponent-power-text[data-power]` `.attr('data-power')` | the opponent's power (hex) | labyrinth pre-battle | `Module/Labyrinth.ts` | `Labyrinth.parseHex()` |
| `.player-panel .team-hexagon .team-member-container[data-girl-id]` `.length` | the squad size | labyrinth | `Module/LabyrinthAuto.ts` | `LabyrinthAuto.getNumberSelectedGirl()` |

### 6.5 League

| Selector | What is extracted | Page | File | Symbol |
|---|---|---|---|---|
| `.league_content .data-list .data-column[sorting]` | sortable column headers | the leaderboard | `Module/League.ts` | `League._refreshSorting()` (commented out in the doc code, a live DOM read) |
| `.league_content .data-list` | the league table container | the leaderboard | `Module/League.ts` | `League.styles()` / the sort UI |
| `.data-row.body-row:visible` (in the league table) | the visible opponent rows | the leaderboard | `Module/League.ts` | the sort click handler |
| `getElementsByClassName("data-list")[0]` | the table root (the DOM API) | the leaderboard | `Module/League.ts` | `removeBeatenOpponents()`, `displayBeatenOpponents()` |
| `.data-row body-row` (inside `getElementsByClassName`) | the opponent list | the leaderboard | `Module/League.ts` | `removeBeatenOpponents()`, `displayBeatenOpponents()` |
| `.data-column.head-column` (querySelectorAll) | the header cells | the leaderboard | `Module/League.ts` | the sort listener |
| `.body-row .data-column[column="power"]` `.first().html()/.text()` | the power column (detecting matchRating) | the leaderboard | `Module/League.ts` | `League.hasVanillaPowerColumn()` |
| `.data-list .data-row.body-row` | all body rows | the leaderboard | `Module/League.ts` | `parseOpponents()` |
| `.data-list .data-row.body-row a` `.length` | the opponents still to be fought | the leaderboard | `Module/League.ts` | `parseOpponents()` logging |

Removed on 2026-08-17: two rows for `.matchRating-expected .matchRating-value`
and the plain power variant. Both were read exclusively by a commented-out
`getPowerOrPoints` block; that block is deleted (commit `chore: delete
commented-out code`), and a `grep` confirms no living code touches the
selectors.

| `.data-list .data-row.body-row.player-row .data-column[column="place"]` `.text()` | your own rank | the leaderboard | `Module/League.ts` | the league stop logic |
| `.data-list .data-row.body-row.player-row .data-column[column="player_league_points"]` `.text()` | your own score | the leaderboard | `Module/League.ts` | the league stop logic |

The league pre-battle page (`/leagues-pre-battle.html?id_opponent=<n>`),
measured 2026-09-11: the fight buttons are `div`s, not `button`s --
`div.green_button_L.battle-action-button.league-single-battle-button`
("Challenge! x1") and `...league-multiple-battle-button` ("Challenge! x3"),
both with `data-league-id`; they stand there 66 ms after the DOM has loaded.
HHauto does not click them: the single fight runs through
`gotoPage(pagesIDLeagueBattle, {number_of_battles: 1, id_opponent})` and the
multi fight through `do_battles_leagues` (`League.ts`).

### 6.6 Pantheon / champion / club champion

| Selector | What is extracted | Page | File | Symbol |
|---|---|---|---|---|
| `#pre-battle .battle-buttons .green_button_L.battle-action-button.pantheon-single-battle-button[data-pantheon-id='<id>']` | the pantheon single battle button | pantheon pre-battle | `Module/Pantheon.ts` | `Pantheon.run()` |
| `.champions-over__champion-info.champions-animation .champion-pose` | the champion pose images for `getPoses()` | the champions page / champions map; measured on `/club-champion.html` (5) | `Module/Champion.ts` | `Champion.run()` (the fallback when `championData.champion.poses` is missing) |
| `div.club-champion-members-challenges .player-row .data-column:nth-of-type(3)` | tickets used per club member | the clubs page, champions tab (`Club.ts`/`ClubChampion.ts` check `div.club-champion-members-challenges:visible` first); measured 0 hits on `/club-champion.html`. Measured at the call site 2026-09-11: on `/clubs.html` after clicking `[data-tab=club_champions]`, visible 1 and `.player-row` 1, unchanged from 12 ms to 3 s; in the observation run of the same day `handleClubChampion` continued from there and spent a ticket | `Module/ClubChampion.ts` | `ClubChampion.run()` |

### 6.7 Pachinko

| Selector | What is extracted | Page | File | Symbol |
|---|---|---|---|---|
| `#playzone-replace-info button[data-free="true"].blue_button_L` | the free pachinko button. 0 hits on `/pachinko.html` on 2026-09-11: no button carried `data-free`, and per the timer the day's free spin had already been taken (the same day, `handlePachinko` in the observation run). Whether the button carries `data-free="true"` at the next free spin is open | pachinko | `Module/Pachinko.ts` | `Pachinko.selectPachinko()` |
| `[girlsRewards].attr("data-rewards")` (JSON) | the number of girls as a reward | pachinko | `Module/Pachinko.ts` | `Pachinko.run()` |

### 6.8 Troll battle / pre-battle

| Selector | What is extracted | Page | File | Symbol |
|---|---|---|---|---|
| `#pre-battle .battle-buttons button.autofight[data-battles="10"]` | the x10 fight button | troll pre-battle / generic | `Module/Troll.ts` | `Troll.run()` |
| `#pre-battle .battle-buttons button.autofight[data-battles="50"]` | the x50 fight button | troll pre-battle | `Module/Troll.ts` | `Troll.run()` |
| `#pre-battle .battle-buttons .green_button_L.battle-action-button` | the standard battle button | troll pre-battle | `Module/Troll.ts` | `Troll.run()` |
| `#pre-battle .oponnent-panel .opponent_rewards .rewards_list .slot.girl_ico[data-rewards]` | the girl reward slots | troll pre-battle | `Module/Troll.ts` | `Troll.run()` |
| `[rewardGirlz].attr('data-rewards')` (JSON) | the JSON list of girl shards | troll pre-battle | `Module/Troll.ts` | `Troll.run()` |
| `#pre-battle div.battle-buttons a.single-battle-button[disabled]` | the disabled check on the battle button | troll pre-battle | `Module/Troll.ts` | `Troll.run()` (a forced reload) |

### 6.9 Season / seasonal / events

| Selector | What is extracted | Page | File | Symbol |
|---|---|---|---|---|
| `.season_arena_opponent_container[data-opponent=<id_fighter>]` | the block of the selected arena opponent | season arena | `Module/Events/Season.ts` | `Season.parseSeasonOpponents()`, `chooseOpponent()` |
| `.slot.girl_ico[data-rewards]` (inside the opponent block) | the girl shards reward | season arena | `Module/Events/Season.ts` | `Season.run()` |
| `[data-select-girl-id=<id_girl>]` (in the daily mission / event page) | a girl tile | the event page / mission | `Module/Events/EventModule.ts` | `displayPrioInDailyMissionGirl()` |
| `.hard-objective .redirect-buttons:has(button[data-href="/champions-map.html"])` | the champion goal block (hard) | the double penetration event | `Module/Events/DoublePenetration.ts` | `DoublePenetration.run()` |
| `.easy-objective .redirect-buttons:has(button[data-href="/champions-map.html"])` | the champion goal block (easy) | the DP event | `Module/Events/DoublePenetration.ts` | `DoublePenetration.run()` |
| `#poa-content .buttons:has(button[data-href="/champions-map.html"])` | the champion goal block in PoA | PoA | `Module/Events/PathOfAttraction.ts` | `PathOfAttraction.run()` |
| `[data-nc-reward-id]` (PoA tier slots) | the PoA tier reward ID | PoA | `Module/Events/PathOfAttraction.ts` | `PathOfAttraction.goAndCollect()` |
| `.free-slot .slot,.free-slot .shards_girl_ico` (PoV/PoG) | the free slot reward type | PoV / PoG | `Module/Events/PathOfValue.ts`, `PathOfGlory.ts` | `goAndCollect()` |
| `.paid-slots:not(.paid-locked) .slot,.paid-slots:not(.paid-locked) .shards_girl_ico` | the paid slot reward type | PoV / PoG | `Module/Events/PathOfValue.ts`, `PathOfGlory.ts` | `goAndCollect()` |

### 6.10 Harem / girl

| Selector | What is extracted | Page | File | Symbol |
|---|---|---|---|---|
| `#harem_right .opened` `.attr('girl')` | the ID of the girl currently selected (the side panel) | harem | `Module/harem/Harem.ts` | `fillCurrentGirlItem()`, `addGoToGirlPageButton()`, `addGirlImages()` |
| `#harem_right .opened .avatar-box:visible` `.length` | ownership of the girl is confirmed | harem | `Module/harem/Harem.ts` | `addGoToGirlPageButton()`, `addGirlImages()` |
| `.select-group.<selector> .selectric-items li[data-index="<index>"]` (trigger click) | a selectric filter element | harem | `Module/harem/HaremFilter.ts` | `HaremFilter.selectOption()` |
| `#girl-leveler-tabs .switch-tab[data-tab="<haremItem>"]` | a girl leveler tab | the girl page | `Module/harem/HaremGirl.ts` | `HaremGirl.switchTabs()` |
| `.hhava` `.length` | our own avatar marker is already rendered | harem | `Module/harem/Harem.ts` | `addGirlImages()` |

### 6.11 Market / shop / inventory (the timer plus the toolbar)

| Selector | What is extracted | Page | File | Symbol |
|---|---|---|---|---|
| `.shop div.shop_count span[rel="expires"]` `.first().text()` | the shop refresh timer (HH:MM:SS) | shop | `Module/Shop.ts` | `Shop.collectShopFromMarket()` (with `convertTimeToInt`) |

### 6.12 Other UI lookups (timers, reward banners, etc.)

| Selector | What is extracted | Page | File | Symbol |
|---|---|---|---|---|
| `#contains_all header .currency .daily-reward-notif` | the daily reward notification | every page (hit on no page on 2026-09-11; whether it depends on a waiting daily reward is not checked) | `config/HHEnvVariables.ts` | the constant `dailyRewardNotifRequest` |
| `#edit-team-page` (an id selector) | the edit-team panel container | edit-team | `config/HHEnvVariables.ts` | the constant `IDpanelEditTeam` |
| `#claim-all:not([disabled]):visible:not([style*='visibility: hidden;'])` | the "Claim All" button | any | `config/HHEnvVariables.ts` | the constant `selectorClaimAllRewards` |
| `[PoVPoG slot].attr('data-time-stamp')` | the timestamp of a PoV/PoG tier slot | PoV / PoG | `config/HHEnvVariables.ts` | the constant `PoVPoGTimestampAttributeName` |
| `[girl tile].attr('data-new-girl-tooltip')` | the new-girl tooltip data | any page with girl slots | `config/HHEnvVariables.ts` | the constant `girlToolTipData` |
| `:not([style*="display:none"]):not([style*="display: none"])` | the filter "not hidden" (a generic suffix) | every page | `config/HHEnvVariables.ts` | the constant `selectorFilterNotDisplayNone` |

## 7. localStorage / storage keys

The keys themselves are in [storage-keys.md](storage-keys.md) -- name, storage
type, default and description, per key. This file carried them a second time
for a while; the copy is gone, because two lists of the same register always
drift apart.

What stays here is the access path: `getStoredValue` / `getStoredJSON` read,
`setStoredValue` writes, `deleteStoredValue` deletes. Read array-typed settings
through `getStoredArray` -- `getStoredJSON` returns null instead of the default
for a stored `"null"` (#1846). All keys carry the prefix
`HHStoredVarPrefixKey` (`HHAuto_` by default). A key not registered in
`HHStoredVars.ts` is discarded silently.

The storage backing: localStorage directly, sessionStorage directly, or
`Storage()` (gated through `SK.settPerTab` -> sessionStorage, otherwise
localStorage). Settings are usually `Storage()`, temp vars mostly
sessionStorage.


## 8. sessionStorage (direct access, without the getStoredValue wrapper)

Every place that uses sessionStorage directly (that is, not through
getStoredValue/setStoredValue). The background: the wrapper looks the key up in
HHStoredVars and delegates by the storage field to localStorage /
sessionStorage / Storage(). Direct access bypasses that check.

The places are in the code and can be found with a search:

```
grep -rn 'sessionStorage\.\(getItem\|setItem\|removeItem\)\|sessionStorage\[' src
```

As of 2026-09-11 there are four groups, each with a reason: the log ring in
`Utils/LogStore.ts` (deliberately past the registry, see `storage-keys.md`),
the counters for forbidden answers and hero reloads in
`Service/StartService.ts` (they run before the game has loaded), the cleanup of
the event keys in `Module/Events/EventModule.ts` and a deletion loop in
`Module/Booster.ts`; plus the size count in `Helper/StorageHelper.ts`. The
earlier table in this place named `PlaceOfPower`, `AutoLoopActions`,
`ParanoiaService`, `migrateHHVars` and `saveAllToFile` -- those go through the
wrapper today, and that table is the reason this list is no longer copied.


## 9. The game state bridge functions

### 9.1 getHHVars(infoSearched, logging=true) (Helper/HHHelper.ts)

The flow:

1. returnValue = unsafeWindow
2. If ConfigHelper.getHHScriptVars(infoSearched, false) !== null: overwrite
   infoSearched with the per-game override (rarely used).
3. infoSearched = prefixIfNeeded(infoSearched):
   - When unsafeWindow.shared exists AND infoSearched.indexOf("Hero.") == 0,
     "shared." is prepended to infoSearched.
   - The effect: the code can consistently write "Hero.x", whether the game
     runs on the legacy build (window.Hero.x) or the new one
     (window.shared.Hero.x).
4. A loop over infoSearched.split("."). Each step: returnValue =
   returnValue[part]. If a part is undefined: log and return null.

The counterpart: setHHVars(infoSearched, newValue) -- the same lookup
algorithm, with the assignment at the last path element. When an intermediate
path is missing, -1 is returned (no throw).

### 9.2 getHHAjax() (Utils/Utils.ts)

```ts
return unsafeWindow.shared?.general?.hh_ajax;
```

Returns the game's internal AJAX function with the signature (params,
onSuccess, onError) => void. params.action is the game's internal action
routing (see section 3). onSuccess(data) and onError(err) are the callbacks.

### 9.3 getHero() (Helper/HeroHelper.ts)

```ts
if (unsafeWindow.shared?.Hero === undefined) {
    setTimeout(autoLoopKick, Number(getStoredValue(HHStoredVarPrefixKey+TK.autoLoopTimeMili)) || 1000);
}
return unsafeWindow.shared?.Hero as KKHero;
```

Returns the hero object directly from shared. When it is unavailable it kicks
off another pass through `autoLoopKick` (installed from the boot path through
`setHeroAutoLoopKick`, instead of an import of AutoLoop) and returns undefined.

The class HeroHelper (in the same file) offers getter wrappers:

| Method | Returns |
|---|---|
| HeroHelper.getPlayerId() | getHHVars("Hero.infos.id") |
| HeroHelper.getClass() | getHHVars("Hero.infos.class") |
| HeroHelper.getLevel() | getHHVars("Hero.infos.level") |
| HeroHelper.getMoney() | getHHVars("Hero.currencies.soft_currency") |
| HeroHelper.getKoban() | getHHVars("Hero.currencies.hard_currency") |
| HeroHelper.haveBoosterInInventory(id) | a lookup in the TK.haveBooster storage cache |
| HeroHelper.equipBooster(booster) | sends market_equip_booster (see section 3) with a timeout safeguard |

### 9.4 Further bridge helpers

| Function | File | Purpose |
|---|---|---|
| getLoadingAnimation() | Utils/Utils.ts | window.shared?.animations?.loadingAnimation with a fallback to no-op stubs |
| onAjaxResponse(pattern, callback) | Utils/Utils.ts | the global ajaxComplete hook (see section 4) |
| getCurrentSorting() | Utils/Utils.ts | reads localStorage.sort_by (set by the game itself, not by HHauto) |
| getStoredValue/getStoredJSON/setStoredValue/deleteStoredValue | Helper/StorageHelper.ts | HHauto's own wrapper over the HHStoredVars registry |
| getStorage() | Helper/StorageHelper.ts | returns sessionStorage when SK.settPerTab=true, otherwise localStorage (for Storage() vars) |
| getStorageItem(type) | Helper/StorageHelper.ts | resolves the "localStorage" / "sessionStorage" / "Storage()" tag into the real storage API |
| addNutakuSession(togoto) | Service/PageNavigationService.ts | appends ?sess=... to the URL when unsafeWindow.hh_nutaku is set |
| queryStringGetParam(qs, name) | Helper/UrlHelper.ts | a URLSearchParams wrapper |
| getPage(checkUnknown) | Helper/PageHelper.ts | resolves the canonical page ID from `<body page>` plus the tab plus PoP detection (see section 6.1) |
| ConfigHelper.getEnvironnement() | Helper/ConfigHelper.ts | matches window.location.hostname against HHKnownEnvironnements |
| ConfigHelper.getHHScriptVars(id, logNotFound) | Helper/ConfigHelper.ts | an env-specific lookup with global as the fallback (see section 11) |
| ConfigHelper.isPshEnvironnement() | Helper/ConfigHelper.ts | true for PH_prod and NPH_prod |


## 10. Data availability per page

For every page ID (from ConfigHelper.getHHScriptVars("pagesIDXxx")): which
unsafeWindow globals are readable there, and which DOM sources are relevant.

**Measured 2026-09-11** (test account level 115, 24 girls, in a club; a mega
event was running, and no lively scene, sultry or boss bang event). Per page:
which globals from sections 1 and 2 existed and which static selectors from
sections 5 and 6 hit. Types instead of values.

Present on **every** one of the 39 pages and therefore not repeated below:
`shared`, `shared.Hero` with all the `infos`, `currencies` and `energies`
fields named here (kiss, fight, challenge, quest, worship, drill, each with
`amount`, `max_regen_amount`, `next_refresh_ts`, `seconds_per_point`),
`shared.general.hh_ajax`, `shared.general.is_cheat_click`,
`shared.animations.loadingAnimation`, `hh_prices`, `hh_nutaku` (`null`),
`server_now_ts`, `mega_event_active`, `mega_event_time_remaining`,
`shared.GirlSalaryManager.girlsMap`/`girlsListSec`,
`Chat_vars.CLUB_INFO.id_club`.

On **no** page: `is_cheat_click` (without `shared.general`), `Hero` (without
`shared`), `league_tag`, `HHTimers`, `Collect`, `has_contests_datas`,
`seasonal_event_active`, `seasonal_time_remaining`, `sm_event_data`,
`current_event.event_data.puzzle_pieces`, `item_to_upgrade`. Not visited: the
champion page (no link on the map), the battle pages (they start a fight), the
mythic upgrade page (it needs parameters).

| Page (`body[page]`) | Globals besides the ones present everywhere | Selectors from sections 5/6 with hits |
|---|---|---|
| `/home.html` (`home`) | `girlsDataList` obj, `salary_collect` number | -- |
| `/activities.html?tab=contests` (`activities`) | `contests_timer.next_contest` number, `contests_timer.duration` number, `contests_timer.remaining_time` number, `daily_goals_list` array[11], `pop_list` bool, `pop_index` number | -- |
| `/activities.html?tab=missions` (`activities`) | `contests_timer.next_contest` number, `contests_timer.duration` number, `contests_timer.remaining_time` number, `daily_goals_list` array[11], `pop_list` bool, `pop_index` number | -- |
| `/activities.html?tab=daily_goals` (`activities`) | `contests_timer.next_contest` number, `contests_timer.duration` number, `contests_timer.remaining_time` number, `daily_goals_list` array[11], `pop_list` bool, `pop_index` number | -- |
| `/activities.html?tab=pop` (`activities`) | `contests_timer.next_contest` number, `contests_timer.duration` number, `contests_timer.remaining_time` number, `daily_goals_list` array[11], `pop_list` bool, `pop_index` number | -- |
| `/activities.html?tab=pop&pop_id=1` (`activities`) | `contests_timer.next_contest` number, `contests_timer.duration` number, `contests_timer.remaining_time` number, `daily_goals_list` array[11], `pop_list` bool, `pop_index` number | -- |
| `/characters.html` (`harem`) | `player_gems_amount` obj, `girlsDataList` obj | `#harem_right .opened` 1 |
| `/girl/<n>` (`girl`) | `girl` obj, `player_gems_amount` obj | `#girl-leveler-tabs .switch-tab[data-tab]` 5, `.right-section .slot[data-d]` 17 |
| `/girl/<n>?resource=equipment` (`girl`) | `girl` obj, `player_gems_amount` obj | `#girl-leveler-tabs .switch-tab[data-tab]` 5 |
| `/map.html` (`map`) | `love_raids` array[24] | -- |
| `/pachinko.html` (`pachinko`) | -- | -- |
| `/leagues.html` (`leaderboard`) | `current_tier_number` number, `opponents_list` array[141] | `.league_content .data-list` 1, `.data-list .data-row.body-row` 141, `.data-list .data-row.body-row a` 123, `.data-column.head-column` 10, `.body-row .data-column[column="power"]` 141, `.data-list .data-row.body-row.player-row .data-column[column="place"]` 1, `.data-list .data-row.body-row.player-row .data-column[column="player_league_points"]` 1 |
| `/shop.html` (`shop`) | `player_inventory.armor` array[65], `player_inventory.booster` array[4], `equipped_armor` obj | `#shops div.armor.merchant-inventory-item .slot` 9, `#shops div.booster.merchant-inventory-item .slot` 9, `#shops div.gift.merchant-inventory-item .slot` 9, `#shops div.potion.merchant-inventory-item .slot` 9, `#shops div.gift.player-inventory-content .slot` 18, `#shops div.potion.player-inventory-content .slot` 18, `#shops div.booster.player-inventory-content .slot` 9, `#equiped .booster .slot:not(.empty):not(.mythic)` 4, `#equiped .booster .slot:not(.empty).mythic` 1, `#player-inventory-booster .slot` 9, `#equiped .armor div[id_item]` 6, `#equiped .armor .slot` 6, `.shop div.shop_count span[rel="expires"]` 4 |
| `/clubs.html` (`clubs`) | -- | `.data-list .data-row.body-row` 46, `.data-list .data-row.body-row a` 47, `.data-column.head-column` 5 |
| `/pantheon.html` (`pantheon`) | -- | -- |
| `/pantheon-pre-battle.html?id_opponent=26` (`pantheon-pre-battle`) | `hero_data` obj | `.team-member-container[data-team-member-position="0"]` 2, `.player-panel .team-hexagon .team-member-container[data-girl-id]` 7, `#pre-battle .battle-buttons .green_button_L.battle-action-button` 1, `#pre-battle .battle-buttons button.autofight[data-battles="10"]` 1, `#pre-battle .battle-buttons .pantheon-single-battle-button[data-pantheon-id]` 1 |
| `/labyrinth.html` (`labyrinth`) | `girl_squad` array[24] | -- |
| `/champions-map.html` (`champions_map`) | `love_raids` array[1] | -- |
| `/club-champion.html` (`club_champion`) | `championData` obj, `championData.team` array[10], `championData.champion.id` number, `championData.champion.poses` array[5], `championData.freeDrafts` number, `championData.hero_damage` number, `championData.fight.active` bool, `championData.fight.participants` array[12] | `.champions-over__champion-info.champions-animation .champion-pose` 5 |
| `/season.html` (`season`) | `love_raids` array[3], `season_sec_untill_event_end` number | `#claim-all` 1 |
| `/season-arena.html` (`season_arena`) | `hero_data` obj, `opponents` array[3] | `.team-member-container[data-team-member-position="0"]` 4, `.season_arena_opponent_container[data-opponent]` 3, `.season_arena_opponent_container .slot.girl_ico[data-rewards]` 3 |
| `/leagues-pre-battle.html?id_opponent=<n>` (`leagues-pre-battle`) | `hero_data` obj | `.team-member-container[data-team-member-position="0"]` 2, `.player-panel .team-hexagon .team-member-container[data-girl-id]` 7, `#pre-battle .battle-buttons .green_button_L.battle-action-button` 2 |
| `/troll-pre-battle.html?id_opponent=1` (`troll-pre-battle`) | `hero_data` obj | `.team-member-container[data-team-member-position="0"]` 2, `.player-panel .team-hexagon .team-member-container[data-girl-id]` 7, `#pre-battle .battle-buttons .green_button_L.battle-action-button` 1, `#pre-battle .battle-buttons button.autofight[data-battles="10"]` 1, `#pre-battle .battle-buttons button.autofight[data-battles="50"]` 1, `#pre-battle .oponnent-panel .opponent_rewards .rewards_list .slot.girl_ico[data-rewards]` 1 |
| `/penta-drill.html` (`penta_drill`) | `penta_drill_data.cycle_data.seconds_until_event_end` number | `#claim-all` 1 |
| `/penta-drill-arena.html` (`penta_drill_arena`) | `opponents_list` array[4] | -- |
| `/penta-drill-pre-battle?<n>` (`penta_drill_pre_battle`) | `penta_drill_data.cycle_data.seconds_until_event_end` number | `.team-member-container[data-team-member-position="0"]` 2, `.player-panel .team-hexagon .team-member-container[data-girl-id]` 7 |
| `/event.html?tab=event_533` (`event`) | `event_data` obj, `event_data.girls` array[2], `current_event` obj | `[data-select-girl-id]` 2 |
| `/event.html?tab=path_event_110` (`event`) | `event_data` obj, `current_event` obj, `event_ends_in` string | `[data-nc-reward-id]` 52 |
| `/path-of-valor.html` (`path-of-valor`) | -- | `.free-slot .slot,.free-slot .shards_girl_ico` 53 |
| `/path-of-glory.html` (`path-of-glory`) | -- | `.free-slot .slot,.free-slot .shards_girl_ico` 65 |
| `/seasonal.html` (`seasonal`) | `mega_event_data.cards` string | `.free-slot .slot,.free-slot .shards_girl_ico` 115 |
| `/love-raids.html` (`love_raids`) | `window.love_raids` obj (empty); `const love_raids` array[26] in the page scope only | -- |
| `/waifu.html` (`waifu`) | `girls_data_list` array[24] | -- |
| `/teams.html?battle_type=leagues` (`teams`) | `teams_data` obj | `.team-member-container[data-team-member-position="0"]` 1, `.team-slot-container.selected-team` 1 |
| `/edit-team.html?battle_type=leagues` (`edit-team`) | `hero_data` obj, `availableGirls` array[24] | `.team-member-container[data-team-member-position="0"]` 1, `#contains_all section .player-panel .player-team .team-hexagon .team-member-container.selectable` 7, `#edit-team-page` 1, `.player-panel .team-hexagon .team-member-container[data-girl-id]` 7 |
| `/member-progression.html` (`member-progression`) | -- | `.free-slot .slot,.free-slot .shards_girl_ico` 50, `#claim-all` 2 |
| `/hero/profile.html` (`hero_pages`) | -- | -- |
| `/god-path.html` (`god-path`) | -- | -- |
| `/quest/<current>` (`quest`) | `id_girl` number | -- |



## 11. Differences per game

Detection: ConfigHelper.getEnvironnement() matches window.location.hostname
against HHKnownEnvironnements. The known hosts are in the `getEnv()` methods of
the files in `src/config/game/` (name, `gameID`, optionally `baseImgPath`);
HornyHeroes is entered directly in `HHEnvVariables.ts`. A copy of the list
stood here and has been removed. `gameID` is the `id` of the `<body>` --
measured 2026-09-11 on www.hentaiheroes.com (`hh_hentai`); the other hosts are
not checked.

The following fields are overwritten in HHEnvVariables.ts through
for (var key in <Game>.getEnv()):

| Field | Source | Effect |
|---|---|---|
| gameID | HHKnownEnvironnements[host].id | the value of `<body id="...">` (read by PageHelper.getPage()) |
| HHGameName | the env name | the ID in the HHEnvVariables map |
| baseImgPath | HHKnownEnvironnements[host].baseImgPath or the default https://hh2.hh-content.com | the prefix for image URLs |
| spreadsheet | the HentaiHeroes family only | the external link in the blessing popup |
| trollzList | <Game>.getTrolls(languageCode) | localised troll names |
| sideTrollzList | HH only | - |
| trollGirlsID | <Game>.getTrollGirlsId() | the mapping troll index -> girl IDs |
| trollIdMapping / sideTrollIdMapping | game-specific remapping | - |
| lastQuestId | <Game>.lastQuestId | the last known quest ID (the pause threshold) |
| boosterId_MB1 | 632 by default (HH); 2619 for ComixHarem, PornstarHarem, TransPornstarHarem, GayPornstarHarem | the Sandalwood item ID |
| pagesIDXxx / pagesURLXxx | mostly global; single ones are overwritten through <Game>.updateFeatures(env) | page IDs / page URLs |
| isEnabledXxx | global; SH_prod (HornyHeroes) has numerous features disabled | feature toggles |
| isPshEnvironnement() | true for PH_prod, NPH_prod | the general PSH special cases |

Differences in data access:

- **The girl data source**: which of the three lists exists depends on the
  page, not on the game -- measured at HentaiHeroes: `availableGirls` on
  edit-team, `girlsDataList` on home and characters, `girls_data_list` on waifu
  (Module/harem/Harem.ts falls back through all three paths in order).
- **shared.Hero vs Hero**: on modern builds of every variant
  unsafeWindow.shared is defined, so getHHVars("Hero.x") automatically prepends
  shared. (see section 9.1).
- **The iframe**: Nutaku builds (unsafeWindow.hh_nutaku === true) live in an
  iframe; HHauto sends postMessage({ImAlive:true},"*") to window.top and
  appends ?sess=... to internal navigations.
- **Endpoint differences**: the AJAX endpoint is always the same host as the
  game (relative to the hostname).


## 12. The cheat-click hook (shared.general.is_cheat_click)

In the game's code shared.general.is_cheat_click is a function that returns
true on suspicious click patterns (clicks too fast, no mouse movement, and so
on) and blocks actions.

In HHauto:

- `Utils/Utils.ts` contains `replaceCheatClick()` with an empty body; the lines
  that used to be commented out are removed.

- Service/StartService.ts calls replaceCheatClick() once in start() -- a no-op
  today.

What that means: the override point is prepared in the code but **disabled**.
An earlier version overwrote both paths (unsafeWindow.is_cheat_click and
unsafeWindow.shared.general.is_cheat_click) with an always-false stub. Today
HHauto relies on randomInterval(...) and timing pauses not triggering the cheat
detection, and actions are preferably sent directly through
getHHAjax()(params, ...) instead of synthetic clicks.

The Window interface (src/index.ts) contains is_cheat_click: any as a declared
property -- a type hint for old direct reads and writes that are no longer
active.

## 13. Race conditions / timing

### 13.1 The script start

src/index.ts calls hardened_start() right after the module loads. Tampermonkey
injects the userscript **before** the game's own JS, so globals such as
shared.Hero are typically not there yet at the first call.

The steps in hardened_start() (Service/StartService.ts):

1. Registers GM_registerMenuCommand("Save Debug Log", saveHHDebugLog).
2. Checks unsafeWindow.jQuery == undefined -> if it is missing: recognise a
   "Forbidden" page where applicable (the body's innerText); on Forbidden:
   reload with a growing interval (`ForbiddenBackoff.nextForbiddenDelaySeconds`,
   the counter in sessionStorage, #1598); otherwise abort (no crash).
3. The started lock plus the call to start().

In start():

1. **The hero retry loop**: when unsafeWindow.shared?.Hero === undefined:
   - heroRetryCount++. At most HERO_MAX_RETRIES = 15 attempts; then the page
     reloads itself, limited by `HERO_GIVEUP_MAX_RELOADS` (the counter in
     sessionStorage, #1788), and only when that too is exhausted does the start
     give up.
   - setTimeout(hardened_start, 5000) -> try again every 5 seconds.
   - started = false is reset so that another call counts.
   - That loop would amount to up to 75 seconds of waiting.
2. As soon as Hero is available: timer cleanup (clearTimeout(heroRetryTimer);
   heroRetryCount = 0).
3. The login check: \a[rel=phoenix_member_login].length > 0 -> not logged in,
   abort.
4. StartService.checkVersion() migrates from previousScriptVersion
   (TK.scriptversion) to GM.info.script.version.
5. migrateHHVars() migrates an old HHAuto_ prefix to a custom prefix where
   needed (mostly a no-op today).
6. Reads Hero.infos.questing.choices_adventure and
   Hero.infos.questing.id_world, persisted as TK.MainAdventureWorldID /
   TK.SideAdventureWorldID.
7. setDefaults() writes missing or invalid settings to their defaults.
8. Registers the menu, timers, listeners, the ad move and
   Booster.collectBoostersFromAjaxResponses().
9. setTimeout(autoLoop, 1000) completes the init.

### 13.2 Module-specific retries

Several modules have a retry pattern for the case that the game variable they
need is not there yet:

- HeroHelper.getHero(): when shared.Hero === undefined, schedule autoLoop (with
  TK.autoLoopTimeMili ms) and return undefined.
- League.getLeagueCurrentLevel(): when unsafeWindow.current_tier_number ===
  undefined, schedule autoLoop (the same pattern).
- getHHVars(...) returns null on any missing path component -> callers have to
  check it.

### 13.3 The AJAX race around the booster status

equipBooster() (Helper/HeroHelper.ts) has a combined race guard:

- Before the call: setStoredValue(TK.autoLoop, "false") -> the loop pauses.
- A 15-second timeout through setTimeout(...) as a safeguard when neither
  onSuccess nor onError arrives from the game.
- A settled flag prevents a double resolution.
- On a timeout: deleteStoredValue(TK.boosterStatusLastUpdate) invalidates the
  10-minute TTL cache.
- On data.success === false: the same invalidation.
- After settling: autoLoop is restarted with randomInterval(500, 800).

Booster.waitForBattleResponse() / Booster.notifyBattleResponseProcessed()
(Module/Booster.ts): a lock pattern with a promise plus a 10 s timeout, for the
case that the battle AJAX response arrives too late.

### 13.4 The AutoLoop pause mechanics

- TK.autoLoop = "false" switches the main loop off. Many modules set it during
  multi-page flows.
- SK.master = "false" -> the master switch is off, the loop does not run.
- SK.mousePause = "true" plus SK.mousePauseTimeout -> the loop pauses on mouse
  activity (the mechanics are in MouseService.ts).

### 13.5 The timer system

- TK.Timers holds a JSON map name -> end time (`Timers[name] = ND` in
  `setTimer`). Written by Helper/TimerHelper.ts, read by StartService.ts at the
  start (setTimers(...)).
- At script start setTimers(getStoredJSON(TK.Timers, {})) runs; persisted
  timers therefore live across reloads.
- getSecondsLeft(name) / setTimer(name, seconds) / clearTimer(name) /
  checkTimer(name) are the wrappers.
- convertTimeToInt(text) parses the game's DOM timer format (HH:MM:SS), for the
  shop refresh among others.

### 13.6 Known edge cases

- **A first call before the game has loaded**: 15 retries at 5 s, then a
  limited automatic reload (see above).
- **A Forbidden page**: reload with the interval doubled for every further
  Forbidden in a row (`Service/ForbiddenBackoff.ts`).
- **Switching tabs with SK.settPerTab=true**: settings land in sessionStorage,
  so per tab. Migration between tabs is not implemented.
- **The boosterStatusLastUpdate TTL**: 10 minutes
  (Booster.BOOSTER_STATUS_TTL_MS = 10 * 60 * 1000).
- **unsafeWindow.shared.GirlSalaryManager.girlsMap**: usable only after the
  salary manager has initialised. The code checks with getHHVars(..., false)
  (silent).
