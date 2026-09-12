---
last-verified: 2026-09-11
verified-against-version: HentaiHeroes BDSM (release 2021-07-21), v8.13.1 HHAuto
status: current
sources:
  - INPUT/Your Performance Handbook!*.pdf (Slynia, 2021-11-20+)
  - INPUT/Which elements are the strongest_*.pdf (Master-17 / community thread, 2022-09-08+)
  - https://kinkoid.com/bdsm/
  - HHAuto code (BDSMHelper.ts, TeamScoringService.ts)
---

# Game mechanics: BDSM (Battles, Development, Strategy and Mechanics)

A reference for the HentaiHeroes BDSM system, consolidated from community
sources and verified against the code. It complements HHauto's own algorithm
docs.

## Sources

| Source | Content |
|--------|--------|
| Slynia's Performance Handbook (2021-11-20) | stat formulas, synergies, the counter bonus scheme, equipment notes |
| The "Which elements are the strongest" forum thread (2022-09-08) | an element tier list from player statistics |
| The Kinkoid BDSM spec | the official description of the mechanics |
| HHauto code (Helper/BDSMHelper.ts, Service/TeamScoringService.ts) | the implemented values, for validation |

Kinkoid has adjusted the system several times since 2021 (awakening
2021-11-17, new skills, new elements). The contents are cross-verified against
the HHauto implementation as of 2026-05-06; values the game changes internally
(the exact domination multipliers, say) can be more current than documented
here.

---

## 1. Performance basics

A "performance" is a 1v1 fight between two players (or player against NPC).
The flow:

1. the attacker (who clicked "Perform!") strikes first
2. the defender strikes back
3. alternating until one side's ego is at 0
4. striking first matters -- every hit can be doubled by a crit

The maximum team: up to 7 girls (before the BDSM update of 2021-07-21 it was
3).

---

## 2. Stats

### The four core stats

| Stat | Meaning | Affects |
|------|-----------|-------------|
| Damage / attack power | damage per hit, reduced by defense | the main attack |
| Defense | damage reduction per hit | avoiding damage |
| Ego | HP / hit points | survival |
| Harmony | the crit chance factor | the crit chance against the opponent |

### Hero stats and classes

| Player class (class value) | Symbol | Main stat | Secondary stats |
|------------------------------|--------|-----------|----------------|
| 1 - Hardcore (HC) | a red shield | carac1 | carac2, carac3 |
| 2 - Charm | a rose | carac2 | carac1, carac3 |
| 3 - Know-How (KH) | a yellow bulb | carac3 | carac1, carac2 |

Only the main stat raises **damage** and **endurance** (endurance = +1 ego per
point). The other two raise defense and harmony.

### Buying stat points

Per level: 30 additional stat points per stat (max level 500 -> 15,000 per
stat = 45,000 in total). The price rises with every purchase of the same stat.
The script uses this mechanism in HeroHelper.doStatUpgrades() with the
multipliers 1/10/30/60.

**Measured 2026-09-11** (test account, level 115, one purchase of carac3
2541 -> 2542): the answer to `hero_update_stats` names `statsPrices.base_stat`
575 and `statsPrices.max` 4025. 575 + 30 x 115 = 4025 -- the cap per stat is
therefore the base value plus 30 per level (concluded from this one
measurement). The point cost 6,173, the curve value of the level reached, 2542;
`statsPrices.prices.x1` (6,177) is the price of the **next** point.
`shared.Hero.infos.carac3` stayed at 2541 in the running document, and only
after a reload did it read 2542. Since 8.13.1 `doStatUpgrades` prices every
point at the value of the level it reaches (`statBuyPrice`), takes the cap from
`statsPrices.max` as soon as an answer has arrived (before that `level * 30`,
without the base value), and counts a confirmed purchase itself, because the
game does not do so in the document. It takes the balance from
`currency.soft_currency` of the answer: `Hero.update("soft_currency", -price,
true)` left `currencies.soft_currency` unchanged when measured (31,809 across
three purchases, while the game stood at 4,494 afterwards), and the fourth
purchase went out without cover. The game did not answer it; the guard against
unconfirmed purchases stopped the loop. Measured again with the balance from
the answer: eight purchases in a row, the counted balance agreed with every
answer, and the loop stopped when the next point would have gone below the
configured money limit.

---

## 3. Stat formulas (verified against the Performance Handbook)

### Ego (HP)

`
Ego = Endurance + (2 * TeamPower)

FULL: (Endurance + (2 * TeamPower))
      * (1 + ExhibitionistSynergy)
      * (1 + DominationEgoBonus)
      * (1 + ChlorellaBoosterBonus)
`

Endurance = main stat points.
TeamPower = the sum of all stats of all 7 girls in the team.

### Damage (attack power)

`
Damage = MainStat + (0.25 * TeamPower)

FULL: (MainStat + (0.25 * TeamPower))
      * (1 + DominatrixSynergy)
      * (1 + DominationAttackBonus)
      * (1 + CordycepsBoosterBonus)
`

### Defense

`
Defense = 0.25 * (Sec1 + Sec2) + (0.12 * TeamPower) * (1 + SubmissiveSynergy)
`

On the booster side only Ginseng (which raises all stats).

### Harmony / crit chance

`
CritChance = 0.30 * MyHarmony / (MyHarmony + OpponentHarmony)
`

Bounds: 0.01 <= CritChance <= 0.29.

The 30 % probability is split between the players -- with equal harmony each
has 15 %.

The maximum crit chance (team composition):

| Source | Bonus |
|--------|-------|
| the harmony cap | 29% |
| the physical synergy (1 girl + 100 or more in the harem) | 9% |
| the double counter bonus (physical cycle) | 40% |
| **theoretical maximum** | **78%** |

---

## 4. Elements and synergies

### Eight elements

Verified 2026-08-16 against the `synergies` payload of the edit-team page
(fields `bonus_identifier`, `team_bonus_per_girl`, `team_bonus_max_amount`,
`harem_bonus_multiplier`) -- including the class names from `ico_url`.

| Element | Class name | Synergy bonus per girl in the team | Team maximum (7 girls) | Maximum harem bonus (100+ girls) |
|---------|-------------|----------------------------------|------------------------|-------------------------------------|
| Fire | Eccentric | +10% crit damage | 70% | up to 35% |
| Water | Sensual | +3% heal on hit | 21% | up to 10% |
| Nature | Exhibitionist | +3% ego | 21% | up to 10% |
| Stone | Physical | +2% crit chance | 14% | up to 7% |
| Sun | Playful | +2% defense reduction | 14% | up to 7% |
| Darkness | Dominatrix | +2% damage | 14% | up to 7% |
| Light | Submissive | +2% defense | 14% | up to 7% |
| Psychic | Voyeur | +2% harmony | 14% | up to 7% |

Measured again 2026-09-11 against the `synergies` payload of a team on
`/teams.html` (fields `bonus_identifier`, `bonus_multiplier`, `element`,
`team_bonus_per_girl`, `team_bonus_max_amount`, `team_bonus_multiplier`,
`team_girls_count` and the same four with `harem_`): the values per girl and
the team caps as in the table; the harem share per girl is fire 0.0035, water
and nature 0.001, the rest 0.0007, capped at 35 %, 10 % and 7 %. The mapping
element -> class name (`element_data.flavor`) agrees with the table, including
light = Submissive and psychic = Voyeur.

**The synergy works linearly from the FIRST girl** -- not only from three on.
Two darkness girls give `team_bonus_multiplier = 0.04`, seven give 0.14 (the
cap). The team and harem shares are additive (`bonus_multiplier`).

What takes hold from 3 girls of one element on is the **theme**: only then does
the team carry a `theme_element` and can give and receive domination bonuses in
the league. Below 3 equal elements the team is "balanced" -- no domination in
either direction, while the synergies still run.

The multiplier works on the ENTIRE stat (the hero's base values included),
while caracs_sum only moves the girls' share. That is why it usually pays to
trade some caracs_sum for a third girl of the right element -- which is exactly
what TeamEvaluationService does.

### Two domination cycles (egoDamage + chance)

#### The egoDamage cycle (5 elements)

On a match: +10% ego AND +10% attack on your own side per opposing element hit.

`
fire -> nature -> stone -> sun -> water -> fire
`

| Element | dominates |
|---------|------------------|
| fire | nature |
| nature | stone |
| stone | sun |
| sun | water |
| water | fire |

#### The chance cycle (3 elements)

On a match: +20% crit chance on your own side per opposing element hit.

`
darkness -> light -> psychic -> darkness
`

Counter bonuses are ADDITIVE with the synergy bonuses (per the Performance
Handbook), and both are multiplied with the other boosters in the final
formulas.

### The element tier list (community findings)

From two independent sources (Master-17, DvDivXXX, Kenrae -- all forum
moderators):

`
S tier:   Darkness, Water        # always strong
A tier:   Sun, Nature            # situationally strong
B tier:   Fire                   # okay
C tier:   Stone, Light           # middling
D tier:   Psychic                # garbage tier
`

**An important dependency on play time:** Sensual (water) only dominates
against opponents of similar strength -- against much stronger ones, heal on hit
is worthless. Dominatrix (darkness) is stronger against high-defense opponents,
Eccentric (fire) weaker.

HHauto's team selection does NOT follow these findings directly -- it lines up
candidates by caracs_sum (plus one theme candidate per element) and then lets
the game compute the order itself (`team_calculate_caracs`), scored by expected
damage per hit times survival time.

---

## 5. The tier-3 synergy bonus (trait match)

Source: Tom-208's userscript plus the HHauto implementation.

When several girls in the team share a trait value (several with blue eyes,
several in the same zodiac sign), all girls receive a stat boost:

| Rarity | Bonus per matching team mate |
|--------|-------------------------------|
| Mythic | +1.0% per match |
| Legendary | +0.8% per match |

The trait categories (paired with an element):

| Element pair | Trait category | Processing |
|--------------|----------------|--------------|
| Darkness + Fire | eyeColor | hex (3 chars) |
| Light + Nature | hairColor | hex (3 chars) |
| Stone + Psychic | zodiac | glyph plus name |
| Water + Sun | position | image index "1.png" to "12.png" |

Implemented in TeamScoringService.calculateTier3TeamBonus() (constants
TIER3_BONUS_MYTHIC = 0.01, TIER3_BONUS_LEGENDARY = 0.008).

---

## 6. The tier-5 leader skill

Mythic girls have a leader skill with ID 11-14 (stun, shield, reflect,
execute). It works when the girl is at position 0 (the leader slot).

| Tier-5 ID | Skill | The leader's element (in the code: BDSMHelper.estimateTier5SkillValue) | Effect factor per skill_points_used | Effect in BDSMHelper.calculateBattleProbabilities |
|-----------|-------|---------|---------|---|
| 11 | Stun | sun, darkness | * 0.07 | opponent.stunned = 2 (rounds) |
| 12 | Shield | stone, light | * 0.08 | playerShield = value * hp (set in round 1) |
| 13 | Reflect | psychic, nature | * 0.20 | reflect = 2 (rounds) |
| 14 | Execute | fire, water | * 0.08 | when opponentHP/maxHP <= value -> opponentHP = 0 |

HHauto's leader priority in team selection (verified in TeamScoringService):
shield > stun > execute > reflect.

---

## 7. Boosters

### Booster types

| Booster | Effect | Common + value | Rare + value | Epic + value | Legendary +% |
|---------|--------|--------------|-----------|-----------|--------------|
| Chlorella | ego (HP) | +1200 | +4200 | +14700 | +10% |
| Ginseng root | HC + CH + KH | +100 | +350 | +1225 | +6% |
| Cordyceps | damage | +300 | +1050 | +3675 | +10% |
| Jujubes | harmony | +400 | +1400 | +4900 | +20% |

Common to legendary boosters last 24 h; mythic boosters last a set number of
performances.

Measured in the market (2026-09-11): Ginseng rare +350, Chlorella rare +4200
and epic +14700, Ginseng legendary 6 (%), Chlorella and Cordyceps legendary 10
(%) -- as in the table; `duration` 1440 minutes = 24 h. Common and Jujubes were
not on offer. The number of uses of a mythic stands as `item.default_usages` in
the payload: MB2 100 (2026-09-11), MB1 (Sandalwood) 11 (2026-09-07,
`data-sources-inventory.md`). The earlier claim "MB1 = 5 uses" was therefore
wrong.

### Mythic boosters (a selection)

| Identifier | Effect |
|-----------|---------|
| MB1 (Sandalwood) | more girl shards per battle |
| MB2 (All Mastery's Emblem) | +15% damage in league and season for 100 performances. Measured 2026-09-12 in a league fight: the hit was `damage x 1.15 - the opponent's defense`, and the `damage` the league list shows does **not** include it |

### The recommendation (Performance Handbook)

`
Cordyceps > Ginseng root > Chlorella > Jujubes
`

Cordyceps gives a direct damage boost and is usually the most valuable.

---

## 8. Equipment

### Multistat vs. mono

- **Multistat (rainbow):** boosts all 5 stats (carac1/2/3, endurance, harmony)
- **Mono:** boosts one stat only -- usually much higher

The recommendation: multistat by default, mono only for the main stat when the
mono item compensates at least 50 % of the multistat's secondary stat loss.
More than 3 mono items reduce harmony too far -> vulnerable to crits.

**Equipment IS included in ``availableGirls.caracs``** (measured 2026-08-17,
the derivation in ``data-sources-team.md``). The sentence that used to stand
here, "equipment is NOT included", was wrong.

The practical consequence: ``caracs_sum`` -- and with it the "total power" the
game displays -- also rates a girl by who currently wears the good items. An
**"Unequip All"** therefore belongs before a team build, or the current team
wins the selection through its equipment alone; "Stuff Team" then distributes
it across the new selection. Without that unequip a feedback loop arises:
build -> stuff -> build again can deliver a different team every time.

The same set of items is worth different amounts on different girls (measured:
a factor of 1.02 to 1.25) -- that is the resonance bonus of mythic equipment
(``resonance_bonuses``: class, theme, figure), which also lands in ``caracs``.

The resonance mechanic (player and girl equipment, the match rules, the scaling
with the item level, the measurement traps and what an item optimiser needs) is
in [equipment-resonance.md](equipment-resonance.md).

---

## 9. Girl level and grade

| Mechanic | Source |
|----------|--------|
| Level | books (market -> books) -- raise stats linearly |
| Grade | affection (market -> gifts) -- brings stars, disproportionately more expensive |

The level cap per girl equals the player level -- with awakening (patch
2021-11-17) up to level 750. The player cap is level 500.

### Grade stars

`
Starter:   1 star -> 5 stars
Common:    1 star -> 5 stars
Rare:      1 star -> 5 stars
Epic:      1 star -> 5 stars
Legendary: 1 star -> 5 stars (3-star and 5-star are common)
Mythic:    1 star -> 6 stars
`

A girl's number of stars (`nb_grades`) belongs to the girl, not to the rarity.
Measured 2026-09-11 in `girls_data_list` (24 girls): common with 1, 3 and 5
stars, starting with 3 and 5, rare with 3, legendary with 3. The list above
names the maximum per rarity. The comment in `LoveRaidManager.parseRaids`
("3=rare, 5=legendary, 6=mythic") describes that same maximum, not the
individual case.

### Affection / XP per battle

In season battles all team girls receive XP and affection depending on the
opponent's level:

| Opponent level | XP / affection per win |
|--------------|------------------------|
| 1-50 | 1 |
| 51-100 | 2 |
| 101-150 | 3 |
| ... | ... |
| 451+ | 10 |

---

## 10. Awakening (since 2021-11-17)

Awakening raises the girls' level cap to up to 750 -- beyond the player level.

The caps for awakening: levels 50, 100, 150 and 200 are free. 250 and above
need gems of the matching element.

### Gem requirement (cumulative, level 250-750 per rarity)

| Rarity | Gems in total |
|--------|-------------|
| Common | 1880 |
| Rare | 3760 |
| Epic | 5640 |
| Legendary | 7520 |
| Mythic | (not listed in the table, higher) |

A condition per tier: a certain number of girls already at the previous cap.
For example, at least 100 girls at level 700 before the first girl can be
awakened past 700.

---

## 11. Blessings

Blessings raise the stats of girls with certain traits.

- Active blessings are visible in the top-right popup (a UI button) and through
  the get_girls_blessings ajax endpoint.
- They change every Monday at 13:00 UTC+1 (the same time as the daily missions
  reset).
- A blessing is worked directly into availableGirls.caracs, so
  "blessed_caracs == caracs" holds for the HHauto script.

Blessing types:

| Type | Meaning |
|-----|-----------|
| Common blessing | the standard roll |
| League blessings (``pvp_v3``) | the two weekly league blessings, an array [20, 30] = 20% + 30%. Measured 2026-09-11: the conditions "Favorite position 69" and "Rarity Legendary", +25 % each; the five legendary girls carried `pvp_v3` = [25] |
| The labyrinth set (``pvp_v4``) | == ``pvp_v3`` PLUS the slot-3 role blessing (applies only in the Love Labyrinth) |

Verified 2026-07-13 (fixture diff plus a live dump): ``pvp_v4`` is not a league
format of its own but the labyrinth set. For league teams only ``pvp_v3``
applies; ``can_be_blessed`` is the league flag, ``can_be_blessed_pvp4`` the
labyrinth flag. Details: ``data-sources-team.md``.

The blessing_bonuses structure in availableGirls:

`json
{
  "pvp_v3": {
    "carac1": [20, 30],
    "carac2": [20, 30],
    "carac3": [20, 30]
  }
}
`

HHauto builds blessing-aware candidate teams per recognised blessing (the
candidate matrix in TeamBuilderService, since v7.35.61); the
``BLESSED_CATEGORY_BOOST`` mentioned here earlier has not existed since the
v7.35.39 rewrite.

---

## 12. League (PvP)

| Aspect | Value |
|--------|------|
| Unlock level | 20 |
| Season length | 1 week (Thursday 13:00 UTC+1 reset) |
| Group size | 100-199 players |
| Number of leagues | 9 (Wanker I/II/III, Sexpert I/II/III, Dicktator I/II/III) |
| Points per win | 15-25 (scaling with the remaining ego); measured 2026-09-11 on one win: +22, the simulator's expectation 22.1 (`bdsm-battle-simulator.md`) |
| Points per loss | 3-13 |
| Token regeneration | 1 every 35 min (`seconds_per_point` 2100, measured); the limit measured 2026-09-11 on the test account: `max_regen_amount` 18, not 15 |
| The 15x performance button | against the lowest-level opponents not yet fought |

Promotion: the top 15 in the group. Demotion: the bottom 15 or 0 points. The
exception: Dicktator III has no promotion.

**The tiebreak:** whoever reached the points first. Otherwise the lowest level
is prioritised.

---

## 13. Season (PvP)

| Aspect | Value |
|--------|------|
| Season length | 1 month (the 1st of the month, 13:00 UTC+1) |
| Currency | kisses (1 per hour, `seconds_per_point` 3600); the limit measured 2026-09-11 on the test account: `max_regen_amount` 20, not 10 |
| Ranking | mojo (an Elo system) |
| Mojo range per battle | -40 to +40, depending on the mojo difference |

Important properties:
- mojo is reset at the end of every season; the starting mojo of the next
  season reflects the previous performance
- a season pass can be bought once per season and doubles the rewards
- buying refills early in a season -> hard opponents -> not advisable for new
  players

---

## 13a. Kobans: where they come from (as of 2026-09-09)

The documentation used to know only the *place* of the value
(`Hero.currencies.hard_currency`, `HeroHelper.getKoban()`), not its sources.
Without those, no budget can be planned and no loss can be placed.

**Sources** (stated by the maintainer, not measured by us):

- tasks and achievements
- daily goals
- wins in the league and comparable competitions

**Quests are not a source.** Measured across 342 logged `pay` steps: a quest
step costs quest energy or soft currency, never kobans, and it pays out none.

**One more source, measured by us (2026-09-09):** the free tiles of the payment
dialog. One pass of `autoFreeBundlesCollect` brought `hard_currency` 123 -> 603,
plus 1 M soft currency and 35 fight energy. That is a one-off stock, not a
running source: the tiles expired between 20 hours and 67 days out and only
come back with new offers. What stands in that box and how to recognise a free
button is in `game-surface-inventory.md`.

**The starter card.** A new account is given a Silver Card for a limited time,
which otherwise costs real money; it pays out kobans. Whoever watches the
balance without knowing that attributes the increase to the wrong cause -- which
happened on 2026-09-09, when a rise from 105 to 165 during a quest run was read
as "quests give kobans". Wrong.

`MonthlyCard.ts`, by the way, collects nothing: it only adjusts
`HHAuto_inputPattern`, because a card raises the energy maxima. Its only caller
is `StartService`. Whether HHauto picks up the card's daily payout at all is
**open**.

**For the choice of modules that means:** on an account that is meant to earn
kobans, `autoDailyGoals` + `autoDailyGoalsCollect` and `autoMission` +
`autoMissionCollect` are the source, not `autoQuest`. The league joins them as
soon as the level (`LEVEL_MIN_LEAGUE` = 20) and a viable team are there.

---

## 13b. Levelling and grading girls (measured 2026-09-09)

Two different things that are often confused.

| | Means | Effect |
|---|---|---|
| **Level** | books (the books tab) | experience, `level`, `xp`. Does **not** change the caracs directly. |
| **Grade** | gifts (the gifts tab) plus money | `graded` +1, all three caracs and `orgasm` **+30 %**, the salary rises |

### The flow, step by step

1. Load `/girl/<id>` and **click the gifts tab**. The direct call
   `/girl/<id>?resource=affection` shows the same view, but a click on the gift
   button stays **without effect** there -- measured across two runs with an
   identical selector.
2. At `affection = 0` the page offers only **Market** and **Use**, and `Use` is
   greyed out while no stock slot is selected. The buttons **One Grade-Up** and
   **Max Grade-up** only appear once affection is there.
3. Stock slots are `.inventory-slot.filled-slot`; the click is a **toggle**
   (`sel`). Clicking twice deselects again. Then `Use`.
4. **One Grade-Up** fills the bar to the next tier and opens a confirmation
   naming the price: *"Filling your Xp/Affection bar will cost you 2. Do you
   want to proceed?"* -- **without a click on Yes nothing happens.**
5. Once the bar is full, `can_upgrade` stands at `true` and `.upgrade_girl`
   points to `/quest/<n>?grade=<k>`.
6. There stand two `.grade-complete-button`: **the green one pays with money**,
   the orange one with kobans. The green one is the right one.

### What a grade costs and brings

Three measurements, each before and after across all fields of the `girl`
object:

| Girl | Cost (money) | Caracs | `orgasm` |
|---|---|---|---|
| A | 36,000 | +30 % | +30 % |
| B | 36,000 | +30 % | +30 % |
| C | 72,000 | +30 % | +30 % |

The **+30 % is constant**, the cost is not -- it depends on the girl.
`upgrade_link` moves on to the next quest number afterwards.

The salary total across `girlsDataList` on `/home.html`: 51,600 before the
first grade, 116,600 after two.

**The game names the future salary nowhere** (measured 2026-09-11 on a girl
with grade 2 of 5 and `can_upgrade = true`). The `girl` object carries only the
current `salary`, `salary_per_hour` and `pay_time`; `grade_offset_values` are
image offsets, not salaries. The gifts tab shows only the affection needed
(*Until grade 5 : 6719*), and the payment page `/quest/<n>?grade=<k>` only the
two prices -- here 450K money or 18 kobans. How much salary a grade brings can
therefore only be measured before and after a real upgrade.

### `salary` is not a rate

`salary` and the display *Income: N/h* are two different quantities. Measured
2026-09-09 across all 13 girls of an account, `girls_data_list` on
`/waifu.html`:

```
salary_per_hour = salary / pay_time * 3600
```

exactly, for each of the 13 girls. Where

| Field | Meaning |
|---|---|
| `salary` | the amount **per payout** |
| `pay_time` | the length of a payout cycle in seconds |
| `salary_per_hour` | the resulting rate -- that is *Income: N/h* |
| `pay_in` | seconds until the next payout |

`pay_in` runs down: two readings 13 seconds apart gave 6503 and 6490.

**The cycles are not equally long.** Cycles of 1800, 5400 and 16200 seconds
occurred there. Measured again 2026-09-11 with 24 girls: the formula holds
for all 24, and the cycles were 1800 (15 girls), 5400 (5), 16200 (1) and 25200
(3). A sum over `salary` mixes them and is therefore not income per time:
451,125 as the sum of the payouts stands against 210,250 per hour, and the two
girls with a 4.5-hour cycle make up 70 % of the `salary` sum but only 33 % of
the hourly income.

The script computes with none of those fields: `HaremSalary` reads the button
and `salary_collect`. The distinction therefore concerns reports, not the code.

### How many girls you have

Four sources, four meanings. Measured 2026-09-09 on an account with **9** owned
girls, each page in its own load:

| Page | Variable | Entries | what is in it |
|---|---|---|---|
| `/waifu.html` | `girls_data_list` | 9 | full records, all `shards` = 100 |
| `/characters.html` | `girlsDataList` | 24 | catalogue data of all *known* girls |
| `/home.html` | `girlsDataList` | 9 | only `salary` and `pay_in` |
| `/teams.html` | none | - | the page carries no list |
| everywhere | `shared.GirlSalaryManager.girlsListSec` | 7 | counts too low |

Measured again 2026-09-11 on the same account with **24** owned girls:
`girls_data_list` 24 (64 fields per entry), `girlsDataList` on
`/characters.html` 24, on `/home.html` 24 with 2 fields each -- complete in five
loads from the moment it first appeared (130 to 235 ms after loading) --,
`shared.GirlSalaryManager.girlsMap` 24 on every page, `girlsListSec` 4.

Decisive for any count: the records on `/characters.html` carry **no** `shards`,
`level` or `graded` -- there a known girl cannot be told from an owned one. On
`/waifu.html` they carry both, and `shards` = 100 marks ownership (the same
threshold `Troll.getTrollWithGirls` uses).

The consequence for `Harem.getGirlCount()`: taking the 24 of the harem page as
the girl count set the ten-girls condition of `PlaceOfPower.isEnabled()` and
`PathOfAttraction.isEnabled()` to satisfied on an account with 9 girls. Since
v8.12.11 only the two pages with complete ownership records answer; otherwise
the salary list, otherwise 0. The number is cached in `Temp_HaremSize`, written
by `Harem.moduleHaremCountMax` on exactly those pages.

`window.girl` also carries `id_member` -- the membership number. Whoever copies
that object into a report publishes it.

---

## 14. Cross-references

| Topic | HHauto doc |
|-------|-------------|
| Battle simulation and crit calculation | bdsm-battle-simulator.md |
| The team selection algorithm (league) | code: `TeamBuilderService.ts` / `TeamScoringService.ts` |
| availableGirls fields, the blessing API | data-sources-team.md |
| Storage keys for settings (boost filter, threshold) | storage-keys.md |
| Button types and dialogs of the quest page, energy costs | adventure-quest-flow.md |

---

## 15. Change history

| Date | Change |
|-------|-----------|
| 2021-07-21 | the BDSM system released, the 7-girl team |
| 2021-11-17 | awakening (level 750) introduced |
| 2022-09-08 | the element tier list validated by the community |

Kinkoid adjusts the mechanics continuously (bonus factors, new boosters, skill
changes). On significant drift in HHauto's selection: check BDSMHelper.ts and
TeamScoringService.ts.
