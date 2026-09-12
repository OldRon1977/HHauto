---
last-verified: 2026-09-11
verified-against-version: 8.13.1 HHAuto, hentaiheroes.com
status: current
sources:
  - A live inventory on the test account (ADR-011), level 42, world 3, 8 girls
  - A re-check without clicks, level 115, world 5, 24 girls (2026-09-11)
  - Tool: $HHAUTO_HOME/tools/explore.js (not in the repository)
---

# Inventory of the game surface

Every reachable page, every control, and what pressing it does. Recorded on
2026-09-09 on an account in world 3: 23 pages, 303 elements pressed, 17
deliberately left out.

This is a **snapshot of one account**. What is locked depends on progress; a
row saying "no visible change" can mean there was nothing to collect, not that
the button does nothing.

## What was not pressed

Everything that costs resources was left out, by these features:

| Feature | Example |
|---|---|
| a price in the text of a purchase class | `orange_button_L` with "5,400" |
| a koban symbol in the element | `[class*=hard_currency]` |
| a purchase or a pass | "Get Path of Valor Pass", `purchase-pass` |
| a fight or energy | "Challenge!", "Perform!", `data-battles` |

The run aborts as soon as a click lowers the koban balance. It did not abort:
**not one of the 303 clicks cost a koban.**

## The re-check (2026-09-11, level 115, world 5, 24 girls)

Measured again without clicks, with HHauto 8.13.1: the `body[page=…]` of each
of the 23 pages still holds; `/labyrinth-entrance.html` redirects to
`/labyrinth.html` (`page=labyrinth`) while a labyrinth is running. Every
identifier from the tables below was counted on its page. Zero hits came only
from identifiers that depend on state: `.button-notification-icon` (on every
page except home -- the symbol only appears when there is something to report),
`.feature-locked` (clubs is unlocked), `.mission_button`, `.later`,
`.green_button_L` on pachinko, and on `/event.html`
`.nc-events-prize-locations-buttons-container` and `.redirect_button`. The
"effect" column was **not** re-clicked; it remains the recording of
2026-09-09.

## Pages that redirect to home

Locked pages deliver `body[page=home]`: whoever navigates there lands silently
at home; a module that looks for something there finds nothing and reports
nothing. At level 42 with 8 girls (2026-09-09) that affected `/clubs.html`
(clubs names 15 girls as the reason), `/champions-map.html`,
`/club-champion.html` and `/teams.html`. Measured 2026-09-11 with 24 girls:
`/clubs.html` leads to `?tab=members` (`page=clubs`), and
`/champions-map.html` and `/club-champion.html` carry their own page.
`/teams.html` and `/edit-team.html` redirect to home **without parameters**;
with `?battle_type=leagues` they deliver `page=teams` and `page=edit-team` --
that is not a lock but a missing parameter.

## Pages the inventory turned up in the first place

These targets were in no page list I had before, and are reachable through
buttons on the start page:

| Target | from where |
|---|---|
| `/adventures.html` | the start page, "Adventures" |
| `/world-boss-event.html?tab=perform_tab_container` | the start page, "World Boss Tournament" |
| `/referrals.html` | the start page, the referral button |
| `/characters/<id>` | the start page, "Harem" -- opens a single girl |
| `/hero/<account>/characters.html` | carries the account number in the path |
| `/season-arena.html` | season, "Find Opponents" |
| `/world/1` | the world map |

The last row is a place data can leak: the URL contains the membership number.
It belongs neither in an issue nor in a capture.

## One button that shows all energies at once

`#show-hero-resources` on the start page opens a window listing every energy
with its value, limit and regrowth time. For a measurement that is the densest
source in the interface -- the values themselves are in `shared.Hero.energies`
(see `adventure-quest-flow.md`).

## Controls per page

### `/home.html`  (`body[page=home]`, 40 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 42 104K / 104K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | dialog: Resources Energies 57/150 +1 in 4m 11s 3/30 +1 in 8m 41s 17/18 |
| blessings-button | `#blessings-button` | dialog: Resources Energies 57/150 +1 in 4m 09s 3/30 +1 in 8m 39s 17/18 |
| Adventures | /adventures.html | navigates -> /adventures.html |
| new_notif | `.new_notif` | navigates -> /adventures.html |
| round_blue_button | `.round_blue_button` /quest/320 | navigates -> /quest/320 |
| Harem | /characters.html | navigates -> /characters/1 |
| collect-button | `.collect-button` | no visible change |
| collect_all | `#collect_all` | no visible change |
| Activities | /activities.html | navigates -> /activities.html?tab=daily_goals |
| Lust Arena | /pvp-arena.html | navigates -> /pvp-arena.html |
| Market 1h 39m | /shop.html | navigates -> /shop.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /shop.html |
| Pachinko | /pachinko.html | navigates -> /pachinko.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /pachinko.html |
| Sex God Path | /god-path.html | navigates -> /god-path.html |
| Clubs You need 15 girls | `.feature-locked` # | no visible change |
| Damsels and Debauchery Recums Ends in  | /seasonal.html | navigates -> /seasonal.html?tab=home_tab_container |
| Path of Valor 6/10 Potions | `.pov-button` | no visible change |
| Path of Valor 6/10 Potions | `#pov_open` | navigates -> /path-of-valor.html |
| Path of Glory 35/40 Potions | `.pov-button` | no visible change |
| Path of Glory 35/40 Potions | `#pog_open` | navigates -> /path-of-glory.html |
| Love Raid 7 Raids Ongoing 22 Upcoming  | /love-raids.html | navigates -> /love-raids.html |
| World Boss Tournament Final Claim Ends | world-boss-event.html | navigates -> /world-boss-event.html?tab=perform_tab_container |
| Star Orgies Ends in 22h 31m | `.over` /event.html?tab=event_529 | navigates -> /event.html?tab=event_529 / dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| Mythic Revival Ends in 1d 22h | `.over` /event.html?tab=mythic_event_5 | navigates -> /event.html?tab=mythic_event_534 / dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| Path of Renaissance Ends in 2d 22h | `.over` /event.html?tab=path_event_110 | navigates -> /event.html?tab=path_event_110 / dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| Cumback Contests Ends in 22h 31m | `.over` /event.html?tab=cumback_contes | navigates -> /event.html?tab=cumback_contest_202 / dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| waifu-buttons-container | `.waifu-buttons-container` | no visible change |
| a | /waifu.html | navigates -> /waifu.html |
| referral | `#referral` /referrals.html | navigates -> /referrals.html |
| THANK YOU | `.blog_button_text` | dialog: Thanks for your support! A special big up to the ones who help |
| Follow us | `.social_links_buttons` | dialog: Thanks for your support! A special big up to the ones who help |
| redirect | `.redirect` https://www.gayharem.com/?ref_ | dialog: Thanks for your support! A special big up to the ones who help |
| redirect | `.redirect` https://www.comixharem.com/?re | dialog: Thanks for your support! A special big up to the ones who help |
| redirect | `.redirect` https://www.pornstarharem.com/ | dialog: Thanks for your support! A special big up to the ones who help |
| redirect | `.redirect` https://www.transpornstarharem | dialog: Thanks for your support! A special big up to the ones who help |
| redirect | `.redirect` https://www.gaypornstarharem.c | dialog: Thanks for your support! A special big up to the ones who help |

### `/activities.html`  (`body[page=activities]`, 11 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | navigates -> /activities.html?tab=daily_goals / dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 42 104K / 104K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | navigates -> /activities.html?tab=daily_goals / dialog: Resources Energies 57/150 +1 in 43s 3/30 +1 in 5m 13s 17/18 +1 |
| blessings-button | `#blessings-button` | navigates -> /activities.html?tab=daily_goals / dialog: What Are Blessings? Mother Angel has sex fantasies that she wa |
| close_cross | `.close_cross` /home.html | navigates -> /home.html |
| Check Path of Glory for more rewards | `.check-pog` /path-of-glory.html | navigates -> /path-of-glory.html |
| Go | `.blue_button_L` /shop.html | navigates -> /shop.html |
| Daily Goals | `.underline-tab` | navigates -> /activities.html?tab=daily_goals |
| Missions | `.switch-tab` | navigates -> /activities.html?tab=missions |
| Contests | `.switch-tab` | navigates -> /activities.html?tab=contests |

### `/activities.html?tab=daily_goals`  (`body[page=activities]`, 11 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 42 104K / 104K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | dialog: Resources Energies 58/150 +1 in 7m 02s 3/30 +1 in 4m 02s 17/18 |
| blessings-button | `#blessings-button` | dialog: Resources Energies 58/150 +1 in 7m 3/30 +1 in 4m 17/18 +1 in 9 |
| close_cross | `.close_cross` /home.html | navigates -> /home.html |
| Check Path of Glory for more rewards | `.check-pog` /path-of-glory.html | navigates -> /path-of-glory.html |
| Go | `.blue_button_L` /shop.html | navigates -> /shop.html |
| Daily Goals | `.underline-tab` | no visible change |
| Missions | `.switch-tab` | navigates -> /activities.html?tab=missions |
| Contests | `.switch-tab` | navigates -> /activities.html?tab=contests |

### `/activities.html?tab=missions`  (`body[page=activities]`, 25 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 42 104K / 104K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | dialog: Resources Energies 58/150 +1 in 6m 02s 3/30 +1 in 3m 02s 17/18 |
| blessings-button | `#blessings-button` | dialog: Resources Energies 58/150 +1 in 6m 3/30 +1 in 3m 17/18 +1 in 8 |
| close_cross | `.close_cross` /home.html | navigates -> /home.html |
| 3h 14m Accept | `.mission_button` | no visible change |
| Accept | `.blue_button_L` | no visible change |
| 3h 33m Accept | `.mission_button` | no visible change |
| 3h 26m Accept | `.mission_button` | no visible change |
| 3h 16m Accept | `.mission_button` | no visible change |
| 4h 19m Accept | `.mission_button` | no visible change |
| 4h 4m Accept | `.mission_button` | no visible change |
| 4h 33m Accept | `.mission_button` | no visible change |
| 3h 19m Accept | `.mission_button` | no visible change |
| 4h 36m Accept | `.mission_button` | no visible change |
| 4h 40m Accept | `.mission_button` | no visible change |
| 4h 2m Accept | `.mission_button` | no visible change |
| 3h 40m Accept | `.mission_button` | no visible change |
| 3h 12m Accept | `.mission_button` | no visible change |
| Claim Reward | `.mission_button` | no visible change |
| Claim Reward | `.purple_button_L` | no visible change |
| Daily Goals | `.switch-tab` | dialog: Rewards 689 250K 20 OK |
| Missions | `.switch-tab` | navigates -> /activities.html?tab=contests / dialog: Rewards 689 250K 20 OK |
| Contests | `.switch-tab` | the element is gone |

### `/characters.html`  (`body[page=harem]`, 26 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | navigates -> /characters/1 / dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | navigates -> /characters/1 / dialog: Resources Energies 68/150 +1 in 4m 32s 3/30 +1 in 1m 32s 17/18 |
| blessings-button | `#blessings-button` | navigates -> /characters/1 / dialog: What Are Blessings? Mother Angel has sex fantasies that she wa |
| close_cross | `.close_cross` /home.html | navigates -> /home.html |
| Reset Filters | `#reset-filters` | navigates -> /characters/1 |
| ▾ | `.button` | navigates -> /characters/1 |
| check-btn | `.check-btn` | navigates -> /characters/13 |
| x100 | `.check-btn` | navigates -> /characters/13 |
| x1-99 | `.check-btn` | no visible change |
| x0 | `.check-btn` | navigates -> /characters/13 |
| check-btn | `.check-btn` | navigates -> /characters/36 |
| filter_girls | `#filter_girls` | navigates -> /characters/36 |
| change_girls_view | `#change_girls_view` | navigates -> /characters/36 |
| Collect | `.collect_money` | navigates -> /characters/36 |
| Collect 51,600 Unequip All | `.buttons_container` | navigates -> /characters/36 |
| Collect 51,600 | `#collect_all` | navigates -> /characters/36 / dialog: This will remove all the equipment currently worn by all your  |
| Unequip All | `#unequip_all` | navigates -> /pachinko.html?type=event |
| ★☆☆☆☆ | `.later` | navigates -> /characters/36 / dialog: Christmas Arcana Poses Scenes 1 2 3 4 |
| ★★☆☆☆ | `.later` | navigates -> /characters/36 / the element is gone |
| ★★★☆☆ | `.later` | navigates -> /characters/36 / the element is gone |
| ★★★★☆ | `.later` | navigates -> /characters/36 / the element is gone |
| ★★★★★ | `.later` | navigates -> /characters/36 / the element is gone |
| girl-equip | `#girl-equip` | navigates -> /characters/36 / the element is gone |
| girl-unequip | `#girl-unequip` | navigates -> /characters/36 / the element is gone |

### `/map.html`  (`body[page=map]`, 12 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | dialog: Resources Energies 68/150 +1 in 1m 49s 4/30 +1 in 28m 49s 17/1 |
| blessings-button | `#blessings-button` | dialog: Resources Energies 68/150 +1 in 1m 47s 4/30 +1 in 28m 47s 17/1 |
| Town | `.back` /home.html | navigates -> /home.html / dialog: Payment Method Secured payment Starter Packs Step-Up Offers Sp |
| Adventures | `.back` /adventures.html | navigates -> /adventures.html |
| link-world | `.link-world` /world/1 | navigates -> /world/1 |
| Raid Starts in 5h 21m | `.love-raid-container` /love-raids.html?raid=4264 | navigates -> /love-raids.html?raid=4264 |
| Raid Starts in 1d 9h | `.love-raid-container` /love-raids.html?raid=4275 | navigates -> /love-raids.html?raid=4275 |
| round_blue_button | `.round_blue_button` /quest/320 | navigates -> /quest/320 |
| Side quests | `.side-quests-icon` # | no visible change |

### `/pachinko.html`  (`body[page=pachinko]`, 8 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | dialog: Resources Energies 68/150 +1 in 42s 4/30 +1 in 27m 42s 17/18 + |
| blessings-button | `#blessings-button` | dialog: Resources Energies 68/150 +1 in 40s 4/30 +1 in 27m 40s 17/18 + |
| close_cross | `.close_cross` /home.html | navigates -> /home.html |
| 1 game Free | `.blue_button_L` | dialog: Rewards 1 OK |
| 10 games 66.3K | `.green_button_L` | dialog: Path of Glory: Daily Goals: +15 Daily Goals: Spend money: +25, |

### `/leagues.html`  (`body[page=leaderboard]`, 14 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | dialog: Resources Energies 68/150 +1 in 03s 4/30 +1 in 27m 03s 17/18 + |
| blessings-button | `#blessings-button` | dialog: Resources Energies 68/150 +1 in 01s 4/30 +1 in 27m 01s 17/18 + |
| close_cross | `.close_cross` /pvp-arena.html | navigates -> /pvp-arena.html |
| toggle_columns | `#toggle_columns` | no visible change |
| button_icon | `.button_icon` | no visible change |
| Go | `.go_pre_battle` /leagues-pre-battle.html?id_op | not pressed: a fight or energy |
| Perform! 15x Cost 12 17/18 +1 in 3m 02 | `.league_buttons` | not pressed: a koban symbol |
| Perform! 15x Cost 12 | `.league_buttons_block` | not pressed: a koban symbol |
| Perform! 15x Cost 12 | `.orange_button_L` | not pressed: a price in the text |
| 2 | `.orange_button_L` | not pressed: a fight or energy |
| Change team | `#change_team` /teams.html?battle_type=league | navigates -> /teams.html?battle_type=leagues / dialog: Team Leagues You can unlock more team slots by purchasing a hi |

### `/shop.html`  (`body[page=shop]`, 13 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | dialog: Resources Energies 69/150 +1 in 6m 48s 4/30 +1 in 26m 18s 17/1 |
| blessings-button | `#blessings-button` | dialog: Resources Energies 69/150 +1 in 6m 46s 4/30 +1 in 26m 16s 17/1 |
| close_cross | `.close_cross` /home.html | navigates -> /home.html |
| button-notification-action | `.button-notification-action` | no visible change |
| My Hero | `.active` | no visible change |
| Equipment | `.market-menu-switch-tab` | no visible change |
| Boosters | `.market-menu-switch-tab` | no visible change |
| Books | `.market-menu-switch-tab` | no visible change |
| Gifts | `.market-menu-switch-tab` | no visible change |
| Boosters | `.active` | KOBANS -42 |

### `/pantheon.html`  (`body[page=pantheon]`, 11 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | dialog: Resources Energies 69/150 +1 in 5m 58s 4/30 +1 in 25m 28s 17/1 |
| blessings-button | `#blessings-button` | dialog: Resources Energies 69/150 +1 in 5m 56s 4/30 +1 in 25m 26s 17/1 |
| close_cross | `.close_cross` /god-path.html | navigates -> /god-path.html |
| button-notification-action | `.button-notification-action` | no visible change |
| Pantheon's Stairway | `#pantheon_tab` | no visible change |
| Rewards | `#rewards_tab` | no visible change |
| Leaderboard | `#leaderboard_tab` | no visible change |
| Enter | `.blue_button_L` /pantheon-pre-battle.html?id_o | not pressed: a fight or energy |

### `/labyrinth-entrance.html`  (`body[page=labyrinth-entrance]`, 7 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | dialog: Resources Energies 69/150 +1 in 5m 15s 4/30 +1 in 24m 45s 17/1 |
| blessings-button | `#blessings-button` | dialog: Resources Energies 69/150 +1 in 5m 13s 4/30 +1 in 24m 43s 17/1 |
| close_cross | `.close_cross` /god-path.html | navigates -> /god-path.html |
| OUR FORUMS | https://forum.kinkoid.com/inde | no visible change |

### `/season.html`  (`body[page=season]`, 14 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | dialog: Resources Energies 69/150 +1 in 4m 39s 4/30 +1 in 24m 09s 18/1 |
| blessings-button | `#blessings-button` | dialog: Resources Energies 69/150 +1 in 4m 37s 4/30 +1 in 24m 07s 18/1 |
| close_cross | `.close_cross` /pvp-arena.html | navigates -> /pvp-arena.html |
| button-notification-action | `.button-notification-action` | no visible change |
| Season | `#seasons_btn` | no visible change |
| Leaderboard | `#leaderboard_btn` | no visible change |
| Find Opponents | /season-arena.html | no visible change |
| Find Opponents | `.blue_button_L` | the element is gone |
| Claimed | `#claim_btn_s` | not pressed: disabled |
| Get Season Pass | `#get_seasons_pass_btn` | not pressed: a purchase or a pass |
| pass-reminder | `.pass-reminder` | not pressed: a purchase or a pass |

### `/penta-drill.html`  (`body[page=penta_drill]`, 14 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | dialog: Resources Energies 69/150 +1 in 3m 49s 4/30 +1 in 23m 19s 18/1 |
| blessings-button | `#blessings-button` | dialog: Resources Energies 69/150 +1 in 3m 47s 4/30 +1 in 23m 17s 18/1 |
| close_cross | `.close_cross` /pvp-arena.html | navigates -> /pvp-arena.html |
| button-notification-action | `.button-notification-action` | no visible change |
| Rewards | `#rewards_btn` | no visible change |
| Leaderboard | `#leaderboard_btn` | no visible change |
| See all Girls available | `#see_all_girls` | no visible change |
| Find Opponents | `.find_opponents` /penta-drill-arena.html | the element is gone |
| Claim All | `#claim-all` | the element is gone |
| Claim | `.purple_button_L` | the element is gone |
| Get Penta Drill Pass | `#get_penta_pass_btn` | not pressed: a purchase or a pass |

### `/event.html`  (`body[page=event]`, 12 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| blessings-button | `#blessings-button` | dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| Star Orgies | `.event-title` /event.html?tab=event_529 | navigates -> /event.html?tab=event_529 / dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| Mythic Revival | `.event-title` /event.html?tab=mythic_event_5 | navigates -> /event.html?tab=mythic_event_534 / dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| Path of Renaissance | `.event-title` /event.html?tab=path_event_110 | navigates -> /event.html?tab=path_event_110 / dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| Cumback Contests | `.event-title` /event.html?tab=cumback_contes | navigates -> /event.html?tab=cumback_contest_202 / dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| close_cross | `.close_cross` /home.html | navigates -> /home.html |
| Go | `.nc-events-prize-locations-buttons-container` | dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| Go | `.redirect_button` /activities.html?tab=contests | navigates -> /activities.html?tab=contests |

### `/path-of-valor.html`  (`body[page=path-of-valor]`, 13 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | dialog: Resources Energies 69/150 +1 in 1m 51s 4/30 +1 in 21m 21s 18/1 |
| blessings-button | `#blessings-button` | dialog: Resources Energies 69/150 +1 in 1m 49s 4/30 +1 in 21m 19s 18/1 |
| Path of Valor | `#pov_tab` | dialog: Resources Energies 69/150 +1 in 1m 46s 4/30 +1 in 21m 16s 18/1 |
| PoV Leaderboard | `#pov_leaderboard_tab` | dialog: Resources Energies 69/150 +1 in 1m 44s 4/30 +1 in 21m 14s 18/1 |
| Path of Glory | `#pog_tab` | navigates -> /path-of-glory.html |
| PoG Leaderboard | `#pog_leaderboard_tab` | no visible change |
| close_cross | `.close_cross` /home.html | navigates -> /home.html |
| button-notification-action | `.button-notification-action` | no visible change |
| potions-paths-more-info-button | `.potions-paths-more-info-button` | no visible change |
| Get Path of Valor Pass or Pass+ | `.orange_button_L` | not pressed: a purchase or a pass |

### `/path-of-glory.html`  (`body[page=path-of-glory]`, 14 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | dialog: Resources Energies 69/150 +1 in 58s 4/30 +1 in 20m 28s 18/18 2 |
| blessings-button | `#blessings-button` | dialog: Resources Energies 69/150 +1 in 56s 4/30 +1 in 20m 26s 18/18 2 |
| Path of Valor | `#pov_tab` | navigates -> /path-of-valor.html |
| PoV Leaderboard | `#pov_leaderboard_tab` | no visible change |
| Path of Glory | `#pog_tab` | no visible change |
| PoG Leaderboard | `#pog_leaderboard_tab` | no visible change |
| close_cross | `.close_cross` /home.html | navigates -> /home.html |
| button-notification-action | `.button-notification-action` | no visible change |
| Claim | `.purple_button_L` | dialog: You won! 1 OK |
| potions-paths-more-info-button | `.potions-paths-more-info-button` | dialog: You won! 1 OK |
| Get Path of Glory Pass or Pass+ | `.orange_button_L` | not pressed: a purchase or a pass |

### `/seasonal.html`  (`body[page=seasonal]`, 20 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | navigates -> /seasonal.html?tab=home_tab_container / dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | navigates -> /seasonal.html?tab=home_tab_container / dialog: Resources Energies 70/150 +1 in 7m 27s 4/30 +1 in 19m 27s 18/1 |
| blessings-button | `#blessings-button` | navigates -> /seasonal.html?tab=home_tab_container / dialog: What Are Blessings? Mother Angel has sex fantasies that she wa |
| button-notification-action | `.button-notification-action` | navigates -> /seasonal.html?tab=home_tab_container |
| close_cross | `.close_cross` /home.html | navigates -> /home.html |
| Home | `#home_tab` | navigates -> /seasonal.html?tab=home_tab_container |
| Event Cards | `#cards_tab` | navigates -> /seasonal.html?tab=cards_tab_container |
| Event Bundles | `#bundles_tab` | navigates -> /seasonal.html?tab=bundles_tab_container |
| Market | `#market_tab` | navigates -> /seasonal.html?tab=market_tab_container |
| Defeat Villains Season Leagues Daily G | `.buttons-container` | navigates -> /seasonal.html?tab=home_tab_container |
| Defeat Villains | `.blue_button_L` /troll-pre-battle.html?id_oppo | navigates -> /troll-pre-battle.html?id_opponent=2 |
| Season | `.blue_button_L` /season-arena.html | navigates -> /season-arena.html |
| Leagues | `.blue_button_L` /leagues.html?tab=leagues | navigates -> /leagues.html?tab=leagues |
| Daily Goals | `.blue_button_L` /activities.html?tab=daily_goa | navigates -> /activities.html?tab=daily_goals |
| play_button_icn | `.play_button_icn` | navigates -> /seasonal.html?tab=home_tab_container |
| Mega Pass 15600 | `#get_mega_pass_kobans_btn` | not pressed: a price in the text |
| Mega Pass in shop | `#get_mega_pass_shop_btn` | not pressed: a purchase or a pass |
| pass-reminder | `.pass-reminder` | not pressed: a purchase or a pass |

### `/waifu.html`  (`body[page=waifu]`, 11 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | dialog: Resources Energies 70/150 +1 in 5m 31s 4/30 +1 in 17m 31s 18/1 |
| blessings-button | `#blessings-button` | dialog: Resources Energies 70/150 +1 in 5m 29s 4/30 +1 in 17m 29s 18/1 |
| filter_girls | `#filter_girls` | dialog: Resources Energies 70/150 +1 in 5m 26s 4/30 +1 in 17m 26s 18/1 |
| Validate Cancel | `.button-container` | dialog: Resources Energies 70/150 +1 in 5m 23s 4/30 +1 in 17m 23s 18/1 |
| Validate | `#validate-team` | navigates -> /home.html |
| Cancel | `#cancel-change-team` | navigates -> /home.html |
| close_cross | `.close_cross` /home.html | navigates -> /home.html |
| ▾ | `.button` | no visible change |

### `/god-path.html`  (`body[page=god-path]`, 8 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | dialog: Resources Energies 70/150 +1 in 4m 38s 4/30 +1 in 16m 38s 18/1 |
| blessings-button | `#blessings-button` | dialog: Resources Energies 70/150 +1 in 4m 36s 4/30 +1 in 16m 36s 18/1 |
| Pantheon's Stairway | `.pantheon` /pantheon.html | navigates -> /pantheon.html |
| Love Labyrinth | `.labyrinth` /labyrinth-entrance.html | navigates -> /labyrinth-entrance.html |
| new_notif | `.new_notif` | navigates -> /labyrinth-entrance.html |

### `/member-progression.html`  (`body[page=member-progression]`, 12 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | no visible change |
| button-notification-icon | `.button-notification-icon` | no visible change |
| show-hero-resources | `#show-hero-resources` | dialog: Resources Energies 70/150 +1 in 4m 01s 4/30 +1 in 16m 01s 18/1 |
| blessings-button | `#blessings-button` | dialog: Resources Energies 70/150 +1 in 3m 59s 4/30 +1 in 15m 59s 18/1 |
| close_cross | `.close_cross` /home.html | navigates -> /home.html |
| button-notification-action | `.button-notification-action` | no visible change |
| Get Hero Pass | `.pass_holder_buttons` | not pressed: a purchase or a pass |
| Get Hero Pass | `#get_pass_btn` | not pressed: a purchase or a pass |
| herro-pass-reminder | `.herro-pass-reminder` | not pressed: a purchase or a pass |
| Claim | `.purple_button_L` | dialog: You won! 100 OK |
| Claim All | `#claim-all` | dialog: You won! 100 OK |

### `/hero/profile.html`  (`body[page=hero_pages]`, 9 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | dialog: Resources Energies 170/150 4/30 +1 in 15m 21s 18/18 21/20 9/15 |
| blessings-button | `#blessings-button` | dialog: Resources Energies 170/150 4/30 +1 in 15m 19s 18/18 21/20 9/15 |
| change-hero-page | `#change-hero-page` | navigates -> /hero/<konto>/characters.html |
| league_logo | `#league_logo` | navigates -> /leagues.html |
| a | ?edit | navigates -> /hero/profile.html?edit=&tab=character |
| div | - | dialog: Share profile Your profile link: Copy to clipboard Close |

### `/love-raids.html`  (`body[page=love_raids]`, 7 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | dialog: Resources Energies 170/150 4/30 +1 in 14m 33s 18/18 21/20 9/15 |
| blessings-button | `#blessings-button` | dialog: Resources Energies 170/150 4/30 +1 in 14m 31s 18/18 21/20 9/15 |
| button-notification-action | `.button-notification-action` | dialog: Resources Energies 170/150 4/30 +1 in 14m 28s 18/18 21/20 9/15 |
| close_cross | `.close_cross` /home.html | navigates -> /home.html |

### `/pvp-arena.html`  (`body[page=pvp-arena]`, 9 elements)

| Element | Identifier | Effect |
|---|---|---|
| chat_btn | `#chat_btn` | dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigates -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | dialog: Resources Energies 170/150 4/30 +1 in 13m 59s 18/18 21/20 9/15 |
| blessings-button | `#blessings-button` | dialog: Resources Energies 170/150 4/30 +1 in 13m 57s 18/18 21/20 9/15 |
| Leagues | `.leagues` /leagues.html | navigates -> /leagues.html |
| Season | `.season` /season.html | navigates -> /season.html |
| button-notification-icon | `.button-notification-icon` | navigates -> /season.html |
| Penta Drill | `.penta_drill` /penta-drill.html | navigates -> ? |


## The payment dialog and its free tiles

The tabbed box behind `#common-popups` is the only place in the interface where
kobans, money and energy are handed out **for nothing**. The inventory only
noted it as "dialog: Payment Method ..."; what is inside stands here.

It is opened through `header .currency .reversed_tooltip` -- the plus beside a
currency. It can also open by itself: observed once on the first `/home.html`
after logging in, and not on four later loads. That is an observation, not a
rate.

### Nine tabs, not four

`#common-popups .payments-wrapper .payment-tabs` carries nine tabs. The `type`
values in order:

| `type` | Label | Free tiles on the test account |
|---|---|---|
| `starter_offers` | Starter Packs | 1, **disabled** |
| `stepup_offers` | Step-Up Offers | 1 active, 8 disabled |
| `special_offers` | Special Offers | 16 active |
| `period_deal` | Period Deals | 1 active each in `daily`, `weekly`, `monthly` |
| `monthly_card` | Monthly Cards | 0 |
| `package` | Koban Packs | 0 |
| `passes` | Passes | 0 |
| `prestige` | Prestige | 0 |
| `recharge_bonus` | Recharge Bonuses | 0 |

`event_bundles` exists in the script's source; on this account the tab was not
in the bar that day.

Measured again 2026-09-11 (the plus beside the currency, nothing bought):
**eight** tabs -- the same ones without `stepup_offers` -- and 5 purchase
buttons, none free, all `paid-buy-button-shop.orange_button_L`. The bar
therefore depends on the account's state; the free tiles of the table above had
been collected by then.

`period_deal` has sub-tabs `.subtabs-container .card-container` with the
attribute `period_deal` (`daily`, `weekly`, `monthly`); `special_offers` has
exactly one.

### How to recognise a free button

Every purchase button carries `price`. The free ones carry `price="0.00"` and
the class `free-buy-button-shop`, the paid ones `paid-buy-button-shop`. The
**colour class belongs to the tab**, not to being free:

| Tab | Button |
|---|---|
| `special_offers`, `period_deal` | `button.free-buy-button-shop.blue_button_L` |
| `stepup_offers` | `button#free-reward.free-buy-button-shop.purple_button_L` |

A selector that goes by colour loses the step-up tab. That is why `Bundles.ts`
reads `free-buy-button-shop` since v8.12.9 (see the CHANGELOG).

The step-up ladder is a chain: the first rung is free, every further one is
unlocked only after a purchase. All eight later buttons stand in the page as
`disabled` -- `:enabled` is enough to leave them out.

### What one pass brought in

A run with `autoFreeBundlesCollect`, measured through `shared.Hero` before and
after:

| Field | before | after |
|---|---|---|
| `currencies.hard_currency` | 123 | 603 |
| `currencies.soft_currency` | 4.87 M | 5.87 M |
| `energies.fight.amount` | 8 | 43 |
| `energies.quest.amount` | 295 | 310 |

That adds one to the list of koban sources in `game-mechanics.md` 13a: **the
free tiles of the payment dialog.** They are one-off stocks, not a running
source -- the 16 special offers expired between 24 and 67 days out, and the
step-up rung within 20 hours.

### A side observation

`handleFreeBundles` started three times in the same tick ("Time to go and check
Free Bundles" 3x, the same run ID, `ev=resume`). Every start presses the plus
again. After that the script counted **32** free buttons instead of the 16 a
reading without the script showed, and the counter fell by 2 per click. The
doubling is measured; the cause is **inferred**, not measured -- a popup opened
again that hangs its content in a second time. Nothing was lost in the process:
the run ended with "Free bundle collection finished", and the tiles had been
collected.
