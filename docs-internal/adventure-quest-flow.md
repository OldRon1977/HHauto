---
last-verified: 2026-09-11
verified-against-version: 8.13.1 HHAuto, hentaiheroes.com
status: current
sources:
  - Live measurement on a dedicated test account (ADR-011), worlds 1 to 3, levels 5 to 17
  - A second measurement on the same account in world 5, level 115 (2026-09-11)
  - HHAuto code (Module/Quest.ts, Module/Troll.ts, config/game/HentaiHeroesVars.ts)
---

# Adventure and the main quest, measured

What the "adventure" flow really delivers on a young account: which buttons the
quest page carries, which dialogs block them, and how to tell whether a quest
item has dropped.

Everything here is **measured** on 2026-09-09 unless marked as an inference.
No account IDs and no player names are in it.

## The proceed button

`Quest.ts` reads the type as the `id` of the first hit of
`#controls button:not([class*='ad_'])`. Measured IDs:

| `id` | Meaning | Cost |
|---|---|---|
| `free` | next step at no cost | - |
| `pay` | next step against a resource | money (100-250 in worlds 1-3; measured 12.0K on `/quest/420`, 13.0K on `/quest/433`, 17.0K on `/quest/505`) or quest energy |
| `use_item` | use a quest item | the item |
| `battle` | the quest step demands a fight | fight energy |
| `end_play` | the quest is over, the reward popup follows | - |
| `skip-quest` | skip steps; only there with `skippable` | kobans (`skip_cost.hard_currency`) |

### What a step costs

Across 342 logged `pay` steps:

| World | Steps | Quest energy per step |
|---|---|---|
| 1 | 4 | 1 throughout |
| 2 | 137 | 1 throughout |
| 3 | 201 | 1 to 6, mostly 2 to 4 |

The mapping of quest ID to world is **inferred** from the observed IDs (below
200 world 1, below 300 world 2, above that world 3), not read from a field. The
cost distribution is measured.

From world 3 on, the bottleneck is no longer the number of steps but the quest
energy -- and as soon as a step demands a fight, the fight energy, which grows
back at 1800 s per point.

`skip-quest` does not appear in this repository's source (grep, 0 hits). **It
does appear in the game's source.** Read from `build/quest.js` on 2026-09-09:

- The button sits **inside** `#controls`, next to the proceed button. The
  game's own cleanup line names both in one selector:
  `$("#controls a, #controls .grade-controls, #controls .win img, #controls #skip-quest").remove()`.
- It exists only while the step reports `skippable`; otherwise the game removes
  it itself:
  `!this.is_skippable && $("#skip-quest").length>0 && $("#skip-quest").remove()`.
- Its click handler reads `this.skip_cost.hard_currency` and calls
  `shared.general.hc_confirm(n, ...)`, then
  `hh_ajax({action:"skip_quest_steps"})`. **It costs kobans**, behind a
  confirmation.

That answers the question that used to be open: the button stands in
`#controls` at the same time as a known proceed button. For `Quest.ts` that
meant two things -- `attr("id")` takes the first hit, so the script read
`skip-quest` and ended up in the `unknownQuestButton` branch, which switches
`autoQuest` off; and `proceedButtonMatch.click()` clicks the **whole** hit set,
so a skip button behind it would have been pressed too and would have left its
koban confirmation standing over the quest. Since v8.12.16 both selectors
exclude `#skip-quest`.

Beside the proceed button, `#controls` regularly holds an ad button
(`blue_text_button ad_quest`, text "Go!") without an `id` -- the selector
filters that out correctly.

## Dialogs that block the proceed button

An open dialog leaves the proceed button greyed out. Whoever looks only at the
button reports a hang that is none.

| Dialog | Closed through |
|---|---|
| `#level_up.popup.hero_leveling` | **only** `button.blue_button_L` ("Ok") -- no `close` element, not even a hidden one |
| `#simple_text_popup.popup` (maintenance notice) | `close.closable` |
| `#no_HC` | `close.closable` |
| `#rewards_popup` | `button.blue_button_L` / `button.purple_button_L` |
| `#not_enough_SC_popup.popup` (not enough money) | `close.closable` -- the button stays grey afterwards, see below |

So `close` really does exist as an **element name**; the selectors in
`Quest.ts` that look for it are not a typo. For `#level_up` they still find
nothing -- hence the extra click on the Ok button (v8.12.6).

From level 30 on, `#level_up` carries **two** buttons: "Ok" and "Go to Hero
Leveling", in that order. The fix takes `.first()` and thereby hits "Ok". If the
game reverses the order, the script navigates away mid-quest. Matching on text
is out: the interface is multilingual.

### Not enough money

`quest.js` checks before sending. `gradeQuestNext` compares
`shared.Hero.currencies.soft_currency` with the **exact** cost
`currentStepData.cost.$` and calls, when there is too little money,
`shared.general.notEnoughSoftCurrency(shortfall)`; otherwise `hc_confirm` and
inside it `startLoading()` along with the request to the server.

Measured 2026-09-11 with a real click on a money step (17.0K against a balance
of 7,063): the browser refuses on its own, and **no** request goes to the
server. `#not_enough_SC_popup` appears in `#common-popups`, the shortfall
stands in `span[rel="money"]` (`9,937`), and the only control besides the harem
link is `close.closable`. The proceed button is grey along with the popup and
stays grey after it closes; the popup is then gone from the DOM. Only a page
change restores the button.

A grey button under this popup therefore says nothing about whether the server
was asked. The pre-check in `Quest.ts` reads the same balance as the game; if
the popup comes anyway, that value was wrong -- a stale hero snapshot (see "Two
measurement traps") explains it. `Quest.ts` therefore checks the popup before
the grey button, closes it, remembers the full step fee as `$<cost>` and lets
the quest rest for 20 minutes (`QuestHelper.NO_MONEY_TIMER`). Because the
button stays grey, the bot must not wait on the page: the `$` branch in
`handleQuest` sends it home on the next tick.

What stands in the game meanwhile, measured 2026-09-11 on `/quest/505` (17.0K
price, 7,063 balance, English interface):

| What | Selector or variable | Value |
|---|---|---|
| Proceed button | `#controls button#pay` | text `Use 17.0K` |
| Price | `#controls button#pay .action-cost .price` | `17.0K` -- abbreviated, `parsePrice` makes 17000 of it |
| Currency | `.action-cost .soft_currency_icn` (money), `.action-cost .energy_quest_icn` (quest energy) | exactly one of the two in the button |
| Button locked | the `disabled` attribute on the button | `false` before the click, `true` from the click on, also after closing |
| Balance | `shared.Hero.currencies.soft_currency` | `7063`; can be stale on page load |
| Popup | `#not_enough_SC_popup` | appears on the click, without a request to `ajax.php` |
| Shortfall | `#not_enough_SC_popup span[rel="money"]` | `9,937` -- with a thousands comma, `parsePrice` makes 9937 of it |
| Popup text | the popup's text | `You lack 9,937 to complete this action! You can collect from the harem, do missions, battles and contests - ...` |
| Closing | `close.closable` in the popup | `$('close.closable', popup).trigger('click')` (the line from `Quest.ts`) closes it; the popup is gone from the DOM afterwards |

What HHauto does in this state. An HHauto run on 2026-09-11 showed the
pre-check path against exactly this state (measured: on `/quest/505` "Need
17000 Money to proceed.", `$17000` stored, no click, a good second later home,
balance unchanged). The script needs the popup path only with a stale hero
snapshot; the lines below are from the code for it, while the closing line
itself was measured on the real popup above:

| What | Place | Value |
|---|---|---|
| Requirement | `HHAuto_Temp_questRequirement` (sessionStorage) | `$17000` -- the full step fee, not the shortfall |
| Lock | timer `nextQuestMoneyAttempt` in `HHAuto_Temp_Timers` | `QuestHelper.NO_MONEY_BACKOFF_SECS` = 1200 s; only on the popup path |
| Log, pre-check catches it | `Quest.ts` | `Need 17000 Money to proceed.` |
| Log, the popup came | `Quest.ts` | `Quest step refused for money: 9937 missing, need 17000. Not trying again for 20 minutes.` |
| Log, the way home | `handleQuest` in `Pipeline.config.ts` | `Quest waiting for resources, returning home.` |
| Onward | the `$` branch in `handleQuest` | only once the lock has expired **and** the balance is above `$<cost>` |

## The quest item

When a step demands an item, the page shows a "You need" field at the top right
with the item and a counter, and beside it "Dropped by" with the opponent that
drops it.

The counter is in `#controls .item span` -- the same selector `Quest.ts`
already reads for the type `use_item`. It is the feedback on whether the item
is there: `0` before the fight, and after a successful fight the quest offers
`use_item`.

Measured: **one** fight was enough in all four observed cases. Whether that is
always so is not shown -- the drop rate is not measured.

## Troll unlocking

`Troll.getLastTrollIdAvailable` derives the last available troll from
`Hero.infos.questing.id_world`: without an entry in `trollIdMapping`,
`id_world - 1` applies. The names are in `HentaiHeroesVars.getTrolls`, not
copied here.

| World | Last troll | Measured |
|---|---|---|
| 1 | 0, so none | `troll-pre-battle.html?id_opponent=1` answers "Troll not available yet!" |
| 2 | 1 | the fight against troll 1 runs, the opponent named per `trollzList[1]` |
| 5 | 4 | 2026-09-11: `id_opponent` 1 to 4 deliver the pre-battle page with `shared.Hero` and three fight buttons, 5 to 7 "Troll not available yet!" without `shared.Hero` |

The page without an available troll carries **no** `shared.Hero` and no
buttons; HHauto does not initialise there and cannot leave it. No fallback path
may therefore force a troll when none is free (ADR-011, v8.12.5, issue #1875
for the variant with page trolls).

## Energies

`shared.Hero.energies` carries several pots. Measured on the test account:
`quest`, `fight`, `challenge`, `kiss`, `worship`, `reply`, `drill`.

Every pot carries three numbers: `amount`, `max_regen_amount` and `max_amount`.
The header shows `amount / max_regen_amount`, not `max_amount`. Measured in one
load, for both visible bars at once:

| Header | `amount` | `max_regen_amount` | `max_amount` |
|---|---|---|---|
| `174/82` | 174 | 82 | 1000 |
| `3/13` | 3 | 13 | 200 |

`max_regen_amount` is the limit up to which energy grows back by itself; above
it, energy only comes from level-ups and items. When `amount` stands above it
(174 of 82), regeneration rests -- the excess does not expire, but does not
grow either.

The script reads `max_regen_amount` in all six places (`Quest`, `Troll`,
`League`, `Pantheon`, `PentaDrill`, `Season`); `max_amount` appears only in the
type `KKEnergy`. It therefore uses the same limit as the display -- checked
2026-09-09, nothing to do.

`seconds_per_point` names the regrowth time: quest 450 s, fight 1800 s,
challenge 2100 s, kiss 3600 s, drill 3600 s, worship 8640 s, reply 10800 s.
Measured again 2026-09-11 in world 5, level 115: the same seven pots and the
same times; `max_regen_amount` quest 150, fight 30, challenge 18, kiss 20,
worship 15, reply 10, drill 20 (`max_amount` 1000/200/60/100/100/50/100). The
header showed `15/150` and `2/30`, so again `amount / max_regen_amount`. All
six pots the script reads stood ready on all 39 visited pages
(`data-sources-inventory.md`, section 10). On a young account `fight` is
therefore the scarce resource, and every quest fight costs some of it.

## Two measurement traps

**The game does not deliver a consistent hero state.** Two page loads six
seconds apart, both with the browser cache off and both with their own
`server_time`, carried different values:

| Field | Load A | Load B |
|---|---|---|
| `infos.level` | 36 | 17 |
| `infos.Xp.cur` | 83716 | 36389 |
| `infos.caracs.endurance` | 1418 | 734 |
| `infos.questing.step` | 310052 | 310052 |

Across measurement loops with their own browser session per reading:

| Loop | Readings | fresh | stale | Share |
|---|---|---|---|---|
| 1 | 12 | 6 | 6 | 50 % |
| 2 | 16 | 8 | 8 | 50 % |
| 3 (2026-09-11, level 115) | 12 | 4 | 8 | 67 % |
| together | 40 | 18 | 22 | **55 %** |

Loop 3 showed the same pattern: the eight stale readings all carried the same
state (level 115 and the money right after a stat purchase a good hour
earlier), the four fresh ones the current one (level 116).

It is not a lag but **two fixed snapshots in alternation**: the stale readings
always carry exactly the same values (level 17, Xp 36389, endurance 734), never
anything in between. Both pages are affected equally, and `questing.step` was
current in all 28 readings.

The distribution is measured. **Inferred**, not measured, is the cause: two
backend nodes with different cache states would explain the picture, but that
is not verified.

The raw data live outside the repository under
`$HHAUTO_HOME/account/measurements/`.

Progress is **not** lost in the process; a later query confirmed every level.
But whoever concludes from a single load may be measuring a state from hours
ago. A statement about the account's state needs more than one reading.

That has consequences for the script: `HeroHelper.getLevel()` feeds the
`>= LEVEL_MIN_*` conditions of six modules -- Pantheon (15), Sultry Mysteries
(15), League (20), Path of Glory (30), Path of Valor (30) and Double
Penetration (40). Pantheon checks through `decideIsEnabled` instead of a direct
comparison; whoever only greps for `getLevel() >=` misses it. At a rate of 50
per cent it hits every second page load on average; a page that delivers too
low a value keeps it for its whole lifetime, and the affected modules report
`isEnabled() === false`, without an error and without a log line. Since v8.12.7
`getLevel` therefore remembers the highest value seen (`Temp_heroMaxLevel`) and
does not fall below it.

**A quest URL from an old page leads nowhere.** Navigating to an already
finished quest, the game answered on 2026-09-09 with "Something went wrong.
Please try again." and left the proceed button greyed out. On 2026-09-11
`/quest/320` (long finished on an account in world 5) showed an archive view
instead: `page=quest`, no error message, and in `#controls` only `archive-back`
and `archive-next`. Neither case makes progress through an old URL; the quest
path belongs read fresh from `Hero.infos.questing.current_url` before every
run.

Measured 2026-09-11 on the current quest page in world 5: the first button
`pay`, text `Use 15`, currency quest energy (`.energy_quest_icn`), counter
`#controls .item span` `0`.

## A locked event looks like an open one

If an event is locked for the account, the game renders the tab anyway:
`.event-title.active` carries the requested tab with its own `href`. For
`EventModule.getDisplayedIdEventPage()` that is indistinguishable from an open
event -- the function returns the event ID, not the empty string the exit
condition checks for.

Measured across four tabs of the same account (one locked, three open):

| Feature | locked | open |
|---|---|---|
| `.event-title.active` with href | yes | yes |
| `#events .nc-panel` | 1 | 1 |

The `nc-panel` that carries the locked message therefore stands on every
playable page too. **No DOM feature that separates the two cases was found.**
The text of the message would be one, but it is translated.

Since v8.12.8 the script therefore checks the condition itself instead of
reading it off the page: `PathOfAttraction.isEnabled()` demands ten girls and
world 2, built like `PlaceOfPower.isEnabled()`. Without that check the session
ran into a loop -- twelve of eighteen samples stood on the event page.

## Two side observations on the code

- **Love raids without a level threshold.** `LoveRaidManager.isEnabled` carried
  a commented-out level check against `LEVEL_MIN_POG`. It is removed, and the
  behaviour stays: love raids have no level threshold today, which is why they
  are not in the table from ADR-012. **Still to be measured**: whether the game
  knows a threshold -- that is, whether the commented-out line was ever right.
- **Double Penetration and the ten girls.** The comment on
  `DoublePenetration.isEnabled` said "And 10 girls", but only the level was
  checked. Since ADR-012 the condition lives in the table in
  `Service/FeatureGate.ts` -- **without** a girl condition, because that one is
  unmeasured. A test records it, so that nobody adds it from the old comment.
  **Still to be measured**: what the DP page delivers on an account below ten
  girls; only then does the line belong in the table. The same construction led
  to the dead page at Place of Power, though there with the check in place.

## References

- `src/Module/Quest.ts` -- button types, popup handling, `questRequirement`
- `src/Module/Troll.ts` -- `getLastTrollIdAvailable`, `getTrollIdToFight`
- `src/config/game/HentaiHeroesVars.ts` -- `trollzList`, `trollIdMapping`
- `docs/decisions/ADR-011-a-dedicated-account-may-write.md` -- why there is an
  account this may be measured on
- `docs-internal/live-verification-lessons.md` -- why a measurement in the
  wrong place invents a bug
