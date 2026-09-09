---
last-verified: 2026-09-09
verified-against-version: v8.12.10 HHAuto, hentaiheroes.com
status: current
sources:
  - Live-Inventur auf dem Pruefkonto (ADR-011), Level 42, Welt 3, 8 Maedchen
  - Werkzeug: ~/.config/hhauto-claude/tools/explore.js (nicht im Repo)
---

# Inventar der Spieloberflaeche

Jede erreichbare Seite, jedes Bedienelement, und was ein Druck darauf bewirkt.
Aufgenommen am 2026-09-09 auf einem Konto in Welt 3: 23 Seiten, 303 gedrueckte
Elemente, 17 bewusst ausgelassene.

Das ist eine **Momentaufnahme eines Kontos**. Was gesperrt ist, haengt am
Fortschritt; eine Zeile "keine sichtbare Aenderung" kann daran liegen, dass
nichts abzuholen war, nicht daran, dass der Knopf nichts tut.

## Was nicht gedrueckt wurde

Ausgelassen wurde alles, was Ressourcen kostet, und zwar nach diesen Merkmalen:

| Merkmal | Beispiel |
|---|---|
| Preis im Text bei Kauf-Klasse | `orange_button_L` mit "5,400" |
| Koban-Symbol im Element | `[class*=hard_currency]` |
| Kauf oder Pass | "Get Path of Valor Pass", `purchase-pass` |
| Kampf oder Energie | "Challenge!", "Perform!", `data-battles` |

Der Lauf bricht ab, sobald ein Klick den Kobanstand senkt. Er hat nicht
abgebrochen: **kein einziger der 303 Klicks hat Kobans gekostet.**

## Seiten, die auf home umleiten

`/clubs.html`, `/champions-map.html`, `/club-champion.html` und `/teams.html`
liefern `body[page=home]`. Fuer dieses Konto sind sie nicht erreichbar --
Clubs nennt als Grund 15 Maedchen. Wer dorthin navigiert, landet
stillschweigend zu Hause; ein Modul, das dort etwas sucht, findet nichts und
meldet nichts.

## Seiten, die erst die Inventur zutage gefoerdert hat

Diese Ziele standen in keiner Seitenliste, die ich vorher hatte, und sind
ueber Knoepfe der Startseite erreichbar:

| Ziel | von wo |
|---|---|
| `/adventures.html` | Startseite, "Adventures" |
| `/world-boss-event.html?tab=perform_tab_container` | Startseite, "World Boss Tournament" |
| `/referrals.html` | Startseite, Empfehlungs-Knopf |
| `/characters/<id>` | Startseite, "Harem" -- oeffnet ein einzelnes Maedchen |
| `/hero/<konto>/characters.html` | traegt die Kontonummer im Pfad |
| `/season-arena.html` | Season, "Find Opponents" |
| `/world/1` | Weltkarte |

Die letzte Zeile ist eine Fundstelle fuer Datenlecks: die URL enthaelt die
Mitgliedsnummer. Sie gehoert weder in ein Issue noch in einen Mitschnitt.

## Ein Knopf, der alle Energien auf einmal zeigt

`#show-hero-resources` auf der Startseite oeffnet ein Fenster, das jede
Energie mit Stand, Grenze und Nachwachszeit auflistet. Fuer eine Messung ist
das die dichteste Quelle der Oberflaeche -- die Werte selbst stehen in
`shared.Hero.energies` (siehe `adventure-quest-flow.md`).

## Bedienelemente je Seite

### `/home.html`  (`body[page=home]`, 40 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 42 104K / 104K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | Dialog: Resources Energies 57/150 +1 in 4m 11s 3/30 +1 in 8m 41s 17/18 |
| blessings-button | `#blessings-button` | Dialog: Resources Energies 57/150 +1 in 4m 09s 3/30 +1 in 8m 39s 17/18 |
| Adventures | /adventures.html | navigiert -> /adventures.html |
| new_notif | `.new_notif` | navigiert -> /adventures.html |
| round_blue_button | `.round_blue_button` /quest/320 | navigiert -> /quest/320 |
| Harem | /characters.html | navigiert -> /characters/1 |
| collect-button | `.collect-button` | keine sichtbare Aenderung |
| collect_all | `#collect_all` | keine sichtbare Aenderung |
| Activities | /activities.html | navigiert -> /activities.html?tab=daily_goals |
| Lust Arena | /pvp-arena.html | navigiert -> /pvp-arena.html |
| Market 1h 39m | /shop.html | navigiert -> /shop.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /shop.html |
| Pachinko | /pachinko.html | navigiert -> /pachinko.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /pachinko.html |
| Sex God Path | /god-path.html | navigiert -> /god-path.html |
| Clubs You need 15 girls | `.feature-locked` # | keine sichtbare Aenderung |
| Damsels and Debauchery Recums Ends in  | /seasonal.html | navigiert -> /seasonal.html?tab=home_tab_container |
| Path of Valor 6/10 Potions | `.pov-button` | keine sichtbare Aenderung |
| Path of Valor 6/10 Potions | `#pov_open` | navigiert -> /path-of-valor.html |
| Path of Glory 35/40 Potions | `.pov-button` | keine sichtbare Aenderung |
| Path of Glory 35/40 Potions | `#pog_open` | navigiert -> /path-of-glory.html |
| Love Raid 7 Raids Ongoing 22 Upcoming  | /love-raids.html | navigiert -> /love-raids.html |
| World Boss Tournament Final Claim Ends | world-boss-event.html | navigiert -> /world-boss-event.html?tab=perform_tab_container |
| Star Orgies Ends in 22h 31m | `.over` /event.html?tab=event_529 | navigiert -> /event.html?tab=event_529 / Dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| Mythic Revival Ends in 1d 22h | `.over` /event.html?tab=mythic_event_5 | navigiert -> /event.html?tab=mythic_event_534 / Dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| Path of Renaissance Ends in 2d 22h | `.over` /event.html?tab=path_event_110 | navigiert -> /event.html?tab=path_event_110 / Dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| Cumback Contests Ends in 22h 31m | `.over` /event.html?tab=cumback_contes | navigiert -> /event.html?tab=cumback_contest_202 / Dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| waifu-buttons-container | `.waifu-buttons-container` | keine sichtbare Aenderung |
| a | /waifu.html | navigiert -> /waifu.html |
| referral | `#referral` /referrals.html | navigiert -> /referrals.html |
| THANK YOU | `.blog_button_text` | Dialog: Thanks for your support! A special big up to the ones who help |
| Follow us | `.social_links_buttons` | Dialog: Thanks for your support! A special big up to the ones who help |
| redirect | `.redirect` https://www.gayharem.com/?ref_ | Dialog: Thanks for your support! A special big up to the ones who help |
| redirect | `.redirect` https://www.comixharem.com/?re | Dialog: Thanks for your support! A special big up to the ones who help |
| redirect | `.redirect` https://www.pornstarharem.com/ | Dialog: Thanks for your support! A special big up to the ones who help |
| redirect | `.redirect` https://www.transpornstarharem | Dialog: Thanks for your support! A special big up to the ones who help |
| redirect | `.redirect` https://www.gaypornstarharem.c | Dialog: Thanks for your support! A special big up to the ones who help |

### `/activities.html`  (`body[page=activities]`, 11 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | navigiert -> /activities.html?tab=daily_goals / Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 42 104K / 104K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | navigiert -> /activities.html?tab=daily_goals / Dialog: Resources Energies 57/150 +1 in 43s 3/30 +1 in 5m 13s 17/18 +1 |
| blessings-button | `#blessings-button` | navigiert -> /activities.html?tab=daily_goals / Dialog: What Are Blessings? Mother Angel has sex fantasies that she wa |
| close_cross | `.close_cross` /home.html | navigiert -> /home.html |
| Check Path of Glory for more rewards | `.check-pog` /path-of-glory.html | navigiert -> /path-of-glory.html |
| Go | `.blue_button_L` /shop.html | navigiert -> /shop.html |
| Daily Goals | `.underline-tab` | navigiert -> /activities.html?tab=daily_goals |
| Missions | `.switch-tab` | navigiert -> /activities.html?tab=missions |
| Contests | `.switch-tab` | navigiert -> /activities.html?tab=contests |

### `/activities.html?tab=daily_goals`  (`body[page=activities]`, 11 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 42 104K / 104K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | Dialog: Resources Energies 58/150 +1 in 7m 02s 3/30 +1 in 4m 02s 17/18 |
| blessings-button | `#blessings-button` | Dialog: Resources Energies 58/150 +1 in 7m 3/30 +1 in 4m 17/18 +1 in 9 |
| close_cross | `.close_cross` /home.html | navigiert -> /home.html |
| Check Path of Glory for more rewards | `.check-pog` /path-of-glory.html | navigiert -> /path-of-glory.html |
| Go | `.blue_button_L` /shop.html | navigiert -> /shop.html |
| Daily Goals | `.underline-tab` | keine sichtbare Aenderung |
| Missions | `.switch-tab` | navigiert -> /activities.html?tab=missions |
| Contests | `.switch-tab` | navigiert -> /activities.html?tab=contests |

### `/activities.html?tab=missions`  (`body[page=activities]`, 25 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 42 104K / 104K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | Dialog: Resources Energies 58/150 +1 in 6m 02s 3/30 +1 in 3m 02s 17/18 |
| blessings-button | `#blessings-button` | Dialog: Resources Energies 58/150 +1 in 6m 3/30 +1 in 3m 17/18 +1 in 8 |
| close_cross | `.close_cross` /home.html | navigiert -> /home.html |
| 3h 14m Accept | `.mission_button` | keine sichtbare Aenderung |
| Accept | `.blue_button_L` | keine sichtbare Aenderung |
| 3h 33m Accept | `.mission_button` | keine sichtbare Aenderung |
| 3h 26m Accept | `.mission_button` | keine sichtbare Aenderung |
| 3h 16m Accept | `.mission_button` | keine sichtbare Aenderung |
| 4h 19m Accept | `.mission_button` | keine sichtbare Aenderung |
| 4h 4m Accept | `.mission_button` | keine sichtbare Aenderung |
| 4h 33m Accept | `.mission_button` | keine sichtbare Aenderung |
| 3h 19m Accept | `.mission_button` | keine sichtbare Aenderung |
| 4h 36m Accept | `.mission_button` | keine sichtbare Aenderung |
| 4h 40m Accept | `.mission_button` | keine sichtbare Aenderung |
| 4h 2m Accept | `.mission_button` | keine sichtbare Aenderung |
| 3h 40m Accept | `.mission_button` | keine sichtbare Aenderung |
| 3h 12m Accept | `.mission_button` | keine sichtbare Aenderung |
| Claim Reward | `.mission_button` | keine sichtbare Aenderung |
| Claim Reward | `.purple_button_L` | keine sichtbare Aenderung |
| Daily Goals | `.switch-tab` | Dialog: Rewards 689 250K 20 OK |
| Missions | `.switch-tab` | navigiert -> /activities.html?tab=contests / Dialog: Rewards 689 250K 20 OK |
| Contests | `.switch-tab` | Element verschwunden |

### `/characters.html`  (`body[page=harem]`, 26 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | navigiert -> /characters/1 / Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | navigiert -> /characters/1 / Dialog: Resources Energies 68/150 +1 in 4m 32s 3/30 +1 in 1m 32s 17/18 |
| blessings-button | `#blessings-button` | navigiert -> /characters/1 / Dialog: What Are Blessings? Mother Angel has sex fantasies that she wa |
| close_cross | `.close_cross` /home.html | navigiert -> /home.html |
| Reset Filters | `#reset-filters` | navigiert -> /characters/1 |
| ▾ | `.button` | navigiert -> /characters/1 |
| check-btn | `.check-btn` | navigiert -> /characters/13 |
| x100 | `.check-btn` | navigiert -> /characters/13 |
| x1-99 | `.check-btn` | keine sichtbare Aenderung |
| x0 | `.check-btn` | navigiert -> /characters/13 |
| check-btn | `.check-btn` | navigiert -> /characters/36 |
| filter_girls | `#filter_girls` | navigiert -> /characters/36 |
| change_girls_view | `#change_girls_view` | navigiert -> /characters/36 |
| Collect | `.collect_money` | navigiert -> /characters/36 |
| Collect 51,600 Unequip All | `.buttons_container` | navigiert -> /characters/36 |
| Collect 51,600 | `#collect_all` | navigiert -> /characters/36 / Dialog: This will remove all the equipment currently worn by all your  |
| Unequip All | `#unequip_all` | navigiert -> /pachinko.html?type=event |
| ★☆☆☆☆ | `.later` | navigiert -> /characters/36 / Dialog: Christmas Arcana Poses Scenes 1 2 3 4 |
| ★★☆☆☆ | `.later` | navigiert -> /characters/36 / Element verschwunden |
| ★★★☆☆ | `.later` | navigiert -> /characters/36 / Element verschwunden |
| ★★★★☆ | `.later` | navigiert -> /characters/36 / Element verschwunden |
| ★★★★★ | `.later` | navigiert -> /characters/36 / Element verschwunden |
| girl-equip | `#girl-equip` | navigiert -> /characters/36 / Element verschwunden |
| girl-unequip | `#girl-unequip` | navigiert -> /characters/36 / Element verschwunden |

### `/map.html`  (`body[page=map]`, 12 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | Dialog: Resources Energies 68/150 +1 in 1m 49s 4/30 +1 in 28m 49s 17/1 |
| blessings-button | `#blessings-button` | Dialog: Resources Energies 68/150 +1 in 1m 47s 4/30 +1 in 28m 47s 17/1 |
| Town | `.back` /home.html | navigiert -> /home.html / Dialog: Payment Method Secured payment Starter Packs Step-Up Offers Sp |
| Adventures | `.back` /adventures.html | navigiert -> /adventures.html |
| link-world | `.link-world` /world/1 | navigiert -> /world/1 |
| Raid Starts in 5h 21m | `.love-raid-container` /love-raids.html?raid=4264 | navigiert -> /love-raids.html?raid=4264 |
| Raid Starts in 1d 9h | `.love-raid-container` /love-raids.html?raid=4275 | navigiert -> /love-raids.html?raid=4275 |
| round_blue_button | `.round_blue_button` /quest/320 | navigiert -> /quest/320 |
| Side quests | `.side-quests-icon` # | keine sichtbare Aenderung |

### `/pachinko.html`  (`body[page=pachinko]`, 8 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | Dialog: Resources Energies 68/150 +1 in 42s 4/30 +1 in 27m 42s 17/18 + |
| blessings-button | `#blessings-button` | Dialog: Resources Energies 68/150 +1 in 40s 4/30 +1 in 27m 40s 17/18 + |
| close_cross | `.close_cross` /home.html | navigiert -> /home.html |
| 1 game Free | `.blue_button_L` | Dialog: Rewards 1 OK |
| 10 games 66.3K | `.green_button_L` | Dialog: Path of Glory: Daily Goals: +15 Daily Goals: Spend money: +25, |

### `/leagues.html`  (`body[page=leaderboard]`, 14 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | Dialog: Resources Energies 68/150 +1 in 03s 4/30 +1 in 27m 03s 17/18 + |
| blessings-button | `#blessings-button` | Dialog: Resources Energies 68/150 +1 in 01s 4/30 +1 in 27m 01s 17/18 + |
| close_cross | `.close_cross` /pvp-arena.html | navigiert -> /pvp-arena.html |
| toggle_columns | `#toggle_columns` | keine sichtbare Aenderung |
| button_icon | `.button_icon` | keine sichtbare Aenderung |
| Go | `.go_pre_battle` /leagues-pre-battle.html?id_op | nicht gedrueckt: Kampf/Energie |
| Perform! 15x Cost 12 17/18 +1 in 3m 02 | `.league_buttons` | nicht gedrueckt: Koban-Symbol |
| Perform! 15x Cost 12 | `.league_buttons_block` | nicht gedrueckt: Koban-Symbol |
| Perform! 15x Cost 12 | `.orange_button_L` | nicht gedrueckt: Preis im Text |
| 2 | `.orange_button_L` | nicht gedrueckt: Kampf/Energie |
| Change team | `#change_team` /teams.html?battle_type=league | navigiert -> /teams.html?battle_type=leagues / Dialog: Team Leagues You can unlock more team slots by purchasing a hi |

### `/shop.html`  (`body[page=shop]`, 13 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | Dialog: Resources Energies 69/150 +1 in 6m 48s 4/30 +1 in 26m 18s 17/1 |
| blessings-button | `#blessings-button` | Dialog: Resources Energies 69/150 +1 in 6m 46s 4/30 +1 in 26m 16s 17/1 |
| close_cross | `.close_cross` /home.html | navigiert -> /home.html |
| button-notification-action | `.button-notification-action` | keine sichtbare Aenderung |
| My Hero | `.active` | keine sichtbare Aenderung |
| Equipment | `.market-menu-switch-tab` | keine sichtbare Aenderung |
| Boosters | `.market-menu-switch-tab` | keine sichtbare Aenderung |
| Books | `.market-menu-switch-tab` | keine sichtbare Aenderung |
| Gifts | `.market-menu-switch-tab` | keine sichtbare Aenderung |
| Boosters | `.active` | KOBANS -42 |

### `/pantheon.html`  (`body[page=pantheon]`, 11 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | Dialog: Resources Energies 69/150 +1 in 5m 58s 4/30 +1 in 25m 28s 17/1 |
| blessings-button | `#blessings-button` | Dialog: Resources Energies 69/150 +1 in 5m 56s 4/30 +1 in 25m 26s 17/1 |
| close_cross | `.close_cross` /god-path.html | navigiert -> /god-path.html |
| button-notification-action | `.button-notification-action` | keine sichtbare Aenderung |
| Pantheon's Stairway | `#pantheon_tab` | keine sichtbare Aenderung |
| Rewards | `#rewards_tab` | keine sichtbare Aenderung |
| Leaderboard | `#leaderboard_tab` | keine sichtbare Aenderung |
| Enter | `.blue_button_L` /pantheon-pre-battle.html?id_o | nicht gedrueckt: Kampf/Energie |

### `/labyrinth-entrance.html`  (`body[page=labyrinth-entrance]`, 7 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | Dialog: Resources Energies 69/150 +1 in 5m 15s 4/30 +1 in 24m 45s 17/1 |
| blessings-button | `#blessings-button` | Dialog: Resources Energies 69/150 +1 in 5m 13s 4/30 +1 in 24m 43s 17/1 |
| close_cross | `.close_cross` /god-path.html | navigiert -> /god-path.html |
| OUR FORUMS | https://forum.kinkoid.com/inde | keine sichtbare Aenderung |

### `/season.html`  (`body[page=season]`, 14 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | Dialog: Resources Energies 69/150 +1 in 4m 39s 4/30 +1 in 24m 09s 18/1 |
| blessings-button | `#blessings-button` | Dialog: Resources Energies 69/150 +1 in 4m 37s 4/30 +1 in 24m 07s 18/1 |
| close_cross | `.close_cross` /pvp-arena.html | navigiert -> /pvp-arena.html |
| button-notification-action | `.button-notification-action` | keine sichtbare Aenderung |
| Season | `#seasons_btn` | keine sichtbare Aenderung |
| Leaderboard | `#leaderboard_btn` | keine sichtbare Aenderung |
| Find Opponents | /season-arena.html | keine sichtbare Aenderung |
| Find Opponents | `.blue_button_L` | Element verschwunden |
| Claimed | `#claim_btn_s` | nicht gedrueckt: deaktiviert |
| Get Season Pass | `#get_seasons_pass_btn` | nicht gedrueckt: Kauf/Pass |
| pass-reminder | `.pass-reminder` | nicht gedrueckt: Kauf/Pass |

### `/penta-drill.html`  (`body[page=penta_drill]`, 14 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | Dialog: Resources Energies 69/150 +1 in 3m 49s 4/30 +1 in 23m 19s 18/1 |
| blessings-button | `#blessings-button` | Dialog: Resources Energies 69/150 +1 in 3m 47s 4/30 +1 in 23m 17s 18/1 |
| close_cross | `.close_cross` /pvp-arena.html | navigiert -> /pvp-arena.html |
| button-notification-action | `.button-notification-action` | keine sichtbare Aenderung |
| Rewards | `#rewards_btn` | keine sichtbare Aenderung |
| Leaderboard | `#leaderboard_btn` | keine sichtbare Aenderung |
| See all Girls available | `#see_all_girls` | keine sichtbare Aenderung |
| Find Opponents | `.find_opponents` /penta-drill-arena.html | Element verschwunden |
| Claim All | `#claim-all` | Element verschwunden |
| Claim | `.purple_button_L` | Element verschwunden |
| Get Penta Drill Pass | `#get_penta_pass_btn` | nicht gedrueckt: Kauf/Pass |

### `/event.html`  (`body[page=event]`, 12 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | Dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| blessings-button | `#blessings-button` | Dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| Star Orgies | `.event-title` /event.html?tab=event_529 | navigiert -> /event.html?tab=event_529 / Dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| Mythic Revival | `.event-title` /event.html?tab=mythic_event_5 | navigiert -> /event.html?tab=mythic_event_534 / Dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| Path of Renaissance | `.event-title` /event.html?tab=path_event_110 | navigiert -> /event.html?tab=path_event_110 / Dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| Cumback Contests | `.event-title` /event.html?tab=cumback_contes | navigiert -> /event.html?tab=cumback_contest_202 / Dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| close_cross | `.close_cross` /home.html | navigiert -> /home.html |
| Go | `.nc-events-prize-locations-buttons-container` | Dialog: Star Orgies Mythic Revival Path of Renaissance Cumback Contest |
| Go | `.redirect_button` /activities.html?tab=contests | navigiert -> /activities.html?tab=contests |

### `/path-of-valor.html`  (`body[page=path-of-valor]`, 13 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | Dialog: Resources Energies 69/150 +1 in 1m 51s 4/30 +1 in 21m 21s 18/1 |
| blessings-button | `#blessings-button` | Dialog: Resources Energies 69/150 +1 in 1m 49s 4/30 +1 in 21m 19s 18/1 |
| Path of Valor | `#pov_tab` | Dialog: Resources Energies 69/150 +1 in 1m 46s 4/30 +1 in 21m 16s 18/1 |
| PoV Leaderboard | `#pov_leaderboard_tab` | Dialog: Resources Energies 69/150 +1 in 1m 44s 4/30 +1 in 21m 14s 18/1 |
| Path of Glory | `#pog_tab` | navigiert -> /path-of-glory.html |
| PoG Leaderboard | `#pog_leaderboard_tab` | keine sichtbare Aenderung |
| close_cross | `.close_cross` /home.html | navigiert -> /home.html |
| button-notification-action | `.button-notification-action` | keine sichtbare Aenderung |
| potions-paths-more-info-button | `.potions-paths-more-info-button` | keine sichtbare Aenderung |
| Get Path of Valor Pass or Pass+ | `.orange_button_L` | nicht gedrueckt: Kauf/Pass |

### `/path-of-glory.html`  (`body[page=path-of-glory]`, 14 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | Dialog: Resources Energies 69/150 +1 in 58s 4/30 +1 in 20m 28s 18/18 2 |
| blessings-button | `#blessings-button` | Dialog: Resources Energies 69/150 +1 in 56s 4/30 +1 in 20m 26s 18/18 2 |
| Path of Valor | `#pov_tab` | navigiert -> /path-of-valor.html |
| PoV Leaderboard | `#pov_leaderboard_tab` | keine sichtbare Aenderung |
| Path of Glory | `#pog_tab` | keine sichtbare Aenderung |
| PoG Leaderboard | `#pog_leaderboard_tab` | keine sichtbare Aenderung |
| close_cross | `.close_cross` /home.html | navigiert -> /home.html |
| button-notification-action | `.button-notification-action` | keine sichtbare Aenderung |
| Claim | `.purple_button_L` | Dialog: You won! 1 OK |
| potions-paths-more-info-button | `.potions-paths-more-info-button` | Dialog: You won! 1 OK |
| Get Path of Glory Pass or Pass+ | `.orange_button_L` | nicht gedrueckt: Kauf/Pass |

### `/seasonal.html`  (`body[page=seasonal]`, 20 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | navigiert -> /seasonal.html?tab=home_tab_container / Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | navigiert -> /seasonal.html?tab=home_tab_container / Dialog: Resources Energies 70/150 +1 in 7m 27s 4/30 +1 in 19m 27s 18/1 |
| blessings-button | `#blessings-button` | navigiert -> /seasonal.html?tab=home_tab_container / Dialog: What Are Blessings? Mother Angel has sex fantasies that she wa |
| button-notification-action | `.button-notification-action` | navigiert -> /seasonal.html?tab=home_tab_container |
| close_cross | `.close_cross` /home.html | navigiert -> /home.html |
| Home | `#home_tab` | navigiert -> /seasonal.html?tab=home_tab_container |
| Event Cards | `#cards_tab` | navigiert -> /seasonal.html?tab=cards_tab_container |
| Event Bundles | `#bundles_tab` | navigiert -> /seasonal.html?tab=bundles_tab_container |
| Market | `#market_tab` | navigiert -> /seasonal.html?tab=market_tab_container |
| Defeat Villains Season Leagues Daily G | `.buttons-container` | navigiert -> /seasonal.html?tab=home_tab_container |
| Defeat Villains | `.blue_button_L` /troll-pre-battle.html?id_oppo | navigiert -> /troll-pre-battle.html?id_opponent=2 |
| Season | `.blue_button_L` /season-arena.html | navigiert -> /season-arena.html |
| Leagues | `.blue_button_L` /leagues.html?tab=leagues | navigiert -> /leagues.html?tab=leagues |
| Daily Goals | `.blue_button_L` /activities.html?tab=daily_goa | navigiert -> /activities.html?tab=daily_goals |
| play_button_icn | `.play_button_icn` | navigiert -> /seasonal.html?tab=home_tab_container |
| Mega Pass 15600 | `#get_mega_pass_kobans_btn` | nicht gedrueckt: Preis im Text |
| Mega Pass in shop | `#get_mega_pass_shop_btn` | nicht gedrueckt: Kauf/Pass |
| pass-reminder | `.pass-reminder` | nicht gedrueckt: Kauf/Pass |

### `/waifu.html`  (`body[page=waifu]`, 11 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | Dialog: Resources Energies 70/150 +1 in 5m 31s 4/30 +1 in 17m 31s 18/1 |
| blessings-button | `#blessings-button` | Dialog: Resources Energies 70/150 +1 in 5m 29s 4/30 +1 in 17m 29s 18/1 |
| filter_girls | `#filter_girls` | Dialog: Resources Energies 70/150 +1 in 5m 26s 4/30 +1 in 17m 26s 18/1 |
| Validate Cancel | `.button-container` | Dialog: Resources Energies 70/150 +1 in 5m 23s 4/30 +1 in 17m 23s 18/1 |
| Validate | `#validate-team` | navigiert -> /home.html |
| Cancel | `#cancel-change-team` | navigiert -> /home.html |
| close_cross | `.close_cross` /home.html | navigiert -> /home.html |
| ▾ | `.button` | keine sichtbare Aenderung |

### `/god-path.html`  (`body[page=god-path]`, 8 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | Dialog: Resources Energies 70/150 +1 in 4m 38s 4/30 +1 in 16m 38s 18/1 |
| blessings-button | `#blessings-button` | Dialog: Resources Energies 70/150 +1 in 4m 36s 4/30 +1 in 16m 36s 18/1 |
| Pantheon's Stairway | `.pantheon` /pantheon.html | navigiert -> /pantheon.html |
| Love Labyrinth | `.labyrinth` /labyrinth-entrance.html | navigiert -> /labyrinth-entrance.html |
| new_notif | `.new_notif` | navigiert -> /labyrinth-entrance.html |

### `/member-progression.html`  (`body[page=member-progression]`, 12 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | keine sichtbare Aenderung |
| button-notification-icon | `.button-notification-icon` | keine sichtbare Aenderung |
| show-hero-resources | `#show-hero-resources` | Dialog: Resources Energies 70/150 +1 in 4m 01s 4/30 +1 in 16m 01s 18/1 |
| blessings-button | `#blessings-button` | Dialog: Resources Energies 70/150 +1 in 3m 59s 4/30 +1 in 15m 59s 18/1 |
| close_cross | `.close_cross` /home.html | navigiert -> /home.html |
| button-notification-action | `.button-notification-action` | keine sichtbare Aenderung |
| Get Hero Pass | `.pass_holder_buttons` | nicht gedrueckt: Kauf/Pass |
| Get Hero Pass | `#get_pass_btn` | nicht gedrueckt: Kauf/Pass |
| herro-pass-reminder | `.herro-pass-reminder` | nicht gedrueckt: Kauf/Pass |
| Claim | `.purple_button_L` | Dialog: You won! 100 OK |
| Claim All | `#claim-all` | Dialog: You won! 100 OK |

### `/hero/profile.html`  (`body[page=hero_pages]`, 9 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | Dialog: Resources Energies 170/150 4/30 +1 in 15m 21s 18/18 21/20 9/15 |
| blessings-button | `#blessings-button` | Dialog: Resources Energies 170/150 4/30 +1 in 15m 19s 18/18 21/20 9/15 |
| change-hero-page | `#change-hero-page` | navigiert -> /hero/<konto>/characters.html |
| league_logo | `#league_logo` | navigiert -> /leagues.html |
| a | ?edit | navigiert -> /hero/profile.html?edit=&tab=character |
| div | - | Dialog: Share profile Your profile link: Copy to clipboard Close |

### `/love-raids.html`  (`body[page=love_raids]`, 7 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | Dialog: Resources Energies 170/150 4/30 +1 in 14m 33s 18/18 21/20 9/15 |
| blessings-button | `#blessings-button` | Dialog: Resources Energies 170/150 4/30 +1 in 14m 31s 18/18 21/20 9/15 |
| button-notification-action | `.button-notification-action` | Dialog: Resources Energies 170/150 4/30 +1 in 14m 28s 18/18 21/20 9/15 |
| close_cross | `.close_cross` /home.html | navigiert -> /home.html |

### `/pvp-arena.html`  (`body[page=pvp-arena]`, 9 Elemente)

| Element | Kennung | Wirkung |
|---|---|---|
| chat_btn | `#chat_btn` | Dialog: Fix the Chat Your current URL doesn't allow you to use the cha |
| Level 43 104K / 107K | `.link-member-progression` /member-progression.html | navigiert -> /member-progression.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /member-progression.html |
| show-hero-resources | `#show-hero-resources` | Dialog: Resources Energies 170/150 4/30 +1 in 13m 59s 18/18 21/20 9/15 |
| blessings-button | `#blessings-button` | Dialog: Resources Energies 170/150 4/30 +1 in 13m 57s 18/18 21/20 9/15 |
| Leagues | `.leagues` /leagues.html | navigiert -> /leagues.html |
| Season | `.season` /season.html | navigiert -> /season.html |
| button-notification-icon | `.button-notification-icon` | navigiert -> /season.html |
| Penta Drill | `.penta_drill` /penta-drill.html | navigiert -> ? |


## Die Zahlungs-Rueckfrage und ihre kostenlosen Kacheln

Der Reiter-Kasten hinter `#common-popups` ist die einzige Stelle der
Oberflaeche, an der Kobans, Geld und Energie **ohne Gegenleistung** ausgegeben
werden. Die Inventur hat ihn nur als "Dialog: Payment Method ..." vermerkt; hier
steht, was drinsteht.

Geoeffnet wird er ueber `header .currency .reversed_tooltip` -- das Plus neben
einer Waehrung. Er kann auch von selbst aufgehen: einmal beobachtet auf dem
ersten `/home.html` nach der Anmeldung, bei vier spaeteren Ladungen nicht. Das
ist eine Beobachtung, keine Rate.

### Neun Reiter, nicht vier

`#common-popups .payments-wrapper .payment-tabs` traegt neun Reiter. Die
`type`-Werte in Reihenfolge:

| `type` | Beschriftung | freie Kacheln auf dem Pruefkonto |
|---|---|---|
| `starter_offers` | Starter Packs | 1, **deaktiviert** |
| `stepup_offers` | Step-Up Offers | 1 aktiv, 8 deaktiviert |
| `special_offers` | Special Offers | 16 aktiv |
| `period_deal` | Period Deals | je 1 aktiv in `daily`, `weekly`, `monthly` |
| `monthly_card` | Monthly Cards | 0 |
| `package` | Koban Packs | 0 |
| `passes` | Passes | 0 |
| `prestige` | Prestige | 0 |
| `recharge_bonus` | Recharge Bonuses | 0 |

`event_bundles` gibt es im Quelltext des Skripts, auf diesem Konto stand der
Reiter an dem Tag nicht in der Leiste.

`period_deal` hat Unterreiter `.subtabs-container .card-container` mit dem
Attribut `period_deal` (`daily`, `weekly`, `monthly`); `special_offers` hat
genau einen.

### Woran ein freier Knopf zu erkennen ist

Jeder Kaufknopf traegt `price`. Die freien tragen `price="0.00"` und die Klasse
`free-buy-button-shop`, die bezahlten `paid-buy-button-shop`. Die **Farbklasse
haengt am Reiter**, nicht an der Kostenlosigkeit:

| Reiter | Knopf |
|---|---|
| `special_offers`, `period_deal` | `button.free-buy-button-shop.blue_button_L` |
| `stepup_offers` | `button#free-reward.free-buy-button-shop.purple_button_L` |

Ein Selektor, der auf die Farbe geht, verliert den Step-Up-Reiter. Deshalb liest
`Bundles.ts` seit v8.12.9 `free-buy-button-shop` (siehe CHANGELOG).

Die Step-Up-Leiter ist eine Kette: die erste Sprosse ist frei, jede weitere
wird erst nach einem Kauf freigeschaltet. Alle acht spaeteren Knoepfe stehen als
`disabled` in der Seite -- `:enabled` reicht, um sie auszulassen.

### Was ein Durchgang eingebracht hat

Ein Lauf mit `autoFreeBundlesCollect`, gemessen ueber `shared.Hero` vorher und
nachher:

| Feld | vorher | nachher |
|---|---|---|
| `currencies.hard_currency` | 123 | 603 |
| `currencies.soft_currency` | 4,87 M | 5,87 M |
| `energies.fight.amount` | 8 | 43 |
| `energies.quest.amount` | 295 | 310 |

Damit ist die Liste der Kobanquellen in `game-mechanics.md` 13a um eine
ergaenzt: **die freien Kacheln der Zahlungs-Rueckfrage.** Das sind einmalige
Bestaende, keine laufende Quelle -- die 16 Special Offers liefen zwischen 24
und 67 Tagen, die Step-Up-Sprosse in 20 Stunden ab.

### Eine Nebenbeobachtung

`handleFreeBundles` startete im selben Tick dreimal ("Time to go and check Free
Bundles" 3x, gleiche Lauf-ID, `ev=resume`). Jeder Start drueckt das Plus erneut.
Danach zaehlte das Skript **32** freie Knoepfe statt der 16, die eine Lesung
ohne Skript zeigte, und der Zaehler fiel je Klick um 2. Gemessen ist die
Verdopplung; **geschlossen**, nicht gemessen, ist die Ursache -- ein erneut
geoeffnetes Popup, das seinen Inhalt ein zweites Mal einhaengt. Verloren ging
dabei nichts: der Lauf endete mit "Free bundle collection finished", und die
Kacheln waren abgeholt.
