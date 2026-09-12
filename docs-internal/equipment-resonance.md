---
last-verified: 2026-09-11
status: current
---

# Equipment resonance -- the basis for an item optimiser

What an automatic item optimiser needs to know: how the resonance bonuses work,
what the data looks like, which endpoints can be used -- and which ways of
measuring **do not** work (learned the expensive way, see below).

Sources: the two official Kinkoid articles
[Mythic Equipment](https://blog.kinkoid.com/features/mythic-equipment/) (2022-11-17)
and [Recruit Equipment & Resonance](https://blog.kinkoid.com/features/recruit-equipment-resonance/)
(2023-05-05), plus our own measurements on 2026-08-17 (own account, class
Know-how). Every statement below is marked as *official* or *measured*.

---

## 1. The mechanic

**Official:** "Resonance is a bonus based on a **match** between the resonating
bonus and the hero." A mythic player item carries **two** resonances that the
player tries to match; you do not have to hit both to get something.

The two axes on player equipment:

| Axis | matches against | Values |
|---|---|---|
| ``class`` | the **hero's class** | 1 Hardcore, 2 Charm, 3 Know-how |
| ``theme`` | the **team's theme** | the 8 elements plus **Balanced** |

**Balanced is a theme in its own right.** A team without three girls of the
same element is not themeless; it has the theme *Balanced* -- and there are
items that resonate on exactly that (in the data model
``theme.identifier: null``).

**Official:** "Resonance bonuses are all summed up and then **applied
after/on top of all other bonuses**." More precisely in the recruit article:
the bonuses are "given to the Hero **in the end calculation of stats**".

On girl equipment the number of axes depends on the rarity (official):

| Rarity | Resonances |
|---|---|
| Epic | 1 (class) |
| Legendary | 2 (class + element) |
| Mythic | 3 (class + element + favourite position) |

For girl items the article names a fixed mapping: class -> ego, element ->
defense, pose -> attack. **For player items that does not hold** (measured):
there every item carries its own target value, ``class`` pointed sometimes at
``damage``, sometimes at ``ego``; ``theme`` sometimes at ``defense``, sometimes
at ``chance``. An optimiser must therefore read the target per item from the
data and must not derive it from the axis.

---

## 2. The data model (measured)

### Player items

The global ``hero_items`` on ``/hero/profile.html``, keys ``1``..``6`` = slots.
The same objects sit on ``shop.html`` in ``player_inventory.armor`` and in the
``data-d`` attributes under ``#equiped .armor div[id_item]``.

An object carries **either** the one ID **or** the other, never both (see "Two
ID spaces" below):

```jsonc
{
  // equipped: only this field, `id_member_armor` is absent entirely
  "id_member_armor_equipped": 2666196,
  // in the inventory this one instead (the ID changes when it is taken off!)
  // "id_member_armor": 6602031,
  "level": 20,
  "skin": { "subtype": 1, "wearer": "hero", "name": "Dragon Helmet" },
  "item": { "rarity": "mythic", "type": "armor" },
  "caracs": { "carac1": 4000, "carac2": 4000, "carac3": 4000,
              "endurance": 4000, "chance": 5000 },
  "resonance_bonuses": {
    "class": { "identifier": "1",     "resonance": "damage",  "bonus": 2 },
    "theme": { "identifier": "stone", "resonance": "defense", "bonus": 2 }
  }
}
```

- ``skin.subtype`` = slot 1..6. An item fits only into its slot.
- ``resonance.identifier``: for ``class`` the class number as a string, for
  ``theme`` the element name or ``null`` (= Balanced).
- ``resonance.resonance``: the target value (``damage`` | ``ego`` | ``defense``
  | ``chance``).
- ``bonus``: percentage points.
- ``caracs.chance`` comes sometimes as a number, sometimes as a **string**
  (`"4634.57"`). Always send it through `Number()`.

Measured again 2026-09-11 on the test account (level 115): ``hero_items``
carries the keys ``1``..``6``, every entry with ``id_member_armor_equipped``
and without ``id_member_armor``, ``skin.subtype`` 1..6; ``caracs`` additionally
carries ``ego``; ``caracs.chance`` was a string in all 71 pieces (equipped and
inventory). The account owns **no** mythic piece -- six legendary equipped
(level 61 to 84, without ``resonance_bonuses``), and in the inventory 32
legendary, 14 epic, 25 rare. The rules of the following two sections (bonus per
level, raw values per tier) are therefore not checkable on this account; they
need a mythic player item.

### The bonus scales with the item level

Measured across items of the same kind at different levels:

| Level | Bonus (damage/ego/defense) | Bonus (chance) |
|---|---|---|
| 1 | 0.1 | 0.2 |
| 7 | 0.7 | – |
| 20 | 2.0 | 4.0 |

So 0.1 percentage points per level, and double on the chance track.

### Raw values are identical at the same tier

| Level | carac1/2/3 | endurance | chance |
|---|---|---|---|
| 1 | 2100 | 2100 | 3100 |
| 20 | 4000 | 4000 | 5000 |

**At maximum level the resonance is the only difference between two mythic
player items of the same slot.** Levelling a mythic item up buys nothing but
resonance.

---

## 3. Endpoints

| Purpose | Call |
|---|---|
| Equip | ``{action:'market_equip_armor', id_member_armor, rarity}`` |
| Inventory (further pages) | ``{action:'market_get_armor', id_member_armor: <last ID>}`` |
| Inventory (first page) | the global ``player_inventory.armor`` on ``shop.html`` |

The equip answer delivers ``{unequipped_armor, equipped_armor, caracs,
success}``. ``unequipped_armor.id_member_armor`` is needed to restore the
starting state -- **an item's inventory ID changes every time it is taken
off.** Whoever wants to undo has to record the ID from the answer; searching by
name is not enough, because you can own several identical items (on 2026-08-17
two "Dragon Helmet" level 20 with *different* resonance).

### Two ID spaces, and they overlap

An item carries **either** `id_member_armor` (in the inventory) **or**
`id_member_armor_equipped` (equipped) -- never both. The entry under `#equiped`
does not have the key `id_member_armor` at all.

Both number spaces overlap (measured 2026-08-17: inventory
567,162..2,136,163,515, equipped 464,128..2,806,648). Whoever puts both sources
into one map keyed on the bare number silently loses an item on a collision --
no error, no log. The key has to carry the source.

The same holds for the upgrade page, which expects a **different query
parameter** depending on the origin:

```
inventory item:  /mythic-equipment-upgrade.html?id_member_item=<id_member_armor>
equipped one:    /mythic-equipment-upgrade.html?id_member_item_equipped=<id_member_armor_equipped>
```

The wrong parameter does **not** fail loudly: the page jumps back to the
market, and the automation looks as if it had done nothing.

**Only mythics reach that page** (measured 2026-09-11 on an account with six
worn legendary and epic pieces): with a valid ``id_member_armor_equipped`` of a
legendary piece the call lands on ``/shop.html`` in **both** parameter forms,
and ``item_to_upgrade`` stays unset. A proposal to level the worn non-mythic
pieces instead therefore has no endpoint behind it.

---

## 4. Measurement traps -- what does NOT work

All three ways were checked with a control (swapping a level-20 item for a
level-1 item, so 1900 raw points of difference per carac). A value that does not
react to that certainly cannot show 2 % of resonance.

| Measurement | reacts to the item level? | usable? |
|---|---|---|
| your own entry in ``opponents_list`` (league) | no, Δ 0.00 % | no, a cached snapshot |
| ``action=team_calculate_caracs`` | no, Δ 0.00 % | no, it ignores player equipment entirely |
| the display on ``/hero/profile.html`` | no, Δ 0.00 % | no, cached as well |
| the ``caracs`` block of the equip answer | **yes** | input values only, no resonance |

The ``caracs`` block is the only value that moves with the equipment -- but it
holds carac1/2/3, endurance and chance, that is, the *input* values before the
end calculation. According to Kinkoid the resonance sits behind exactly that
("in the end calculation of stats") and therefore appears in no client-side
number. The client **never calculates resonance itself**;
``shared.general.buildResonanceBonus()`` only renders the tooltip.

**The consequence for the optimiser:** it cannot measure its own gain. It has
to compute from the declared ``resonance_bonuses`` and must not rely on a
before/after measurement.

### `item_to_upgrade.level` does not move

On the upgrade page that global is a snapshot from the page build. After
**nineteen** successful level-ups it still stood at `1`. A stop condition that
hangs on it never fires -- the first run only ended because the game navigated
away by itself at level 20. The level has to be counted from the loaded value
plus the steps performed.

Cross-reference: [live-verification-lessons.md](live-verification-lessons.md).

---

## 5. What an optimiser would have to do

**The objective.** The sum of the *active* resonances, per item:

- the ``class`` bonus counts when ``identifier == the hero's class``
- the ``theme`` bonus counts when ``identifier == the current team's theme``
  (``null`` matches a Balanced team)

Both axes independently, and the bonuses are summed (official).

**Constraints.**

- One item per slot (``skin.subtype`` 1..6), only from your own stock.
- **Never trade raw values for resonance.** A level-1 item instead of level-20
  costs 1900 raw points per carac for at most 2 percentage points of bonus.
  Only swap items of the same tier against each other.
- Read the target value per item from the data (see section 1); whether
  ``damage`` is worth more than ``ego`` or ``defense`` is a weighting question
  the optimiser should state openly.

> **Historic.** This section describes the planning state *before* the build.
> The weighting question in the last point was not answered but **rejected**:
> two stat models failed on it, and section 5a replaces them with priority
> tiers. What stands there applies.

**Order: the team first, the items second.** The team's theme decides which
theme resonances are active -- so the dependency runs from the team to the
equipment and not the other way round. The optimiser hangs on at the end:

```
1. build the team    (TeamBuilderService + TeamEvaluationService)
2. read the theme    (>= 3 girls of one element, otherwise Balanced)
3. align the items with it
```

That is not only the simpler order but, under the existing uncertainty, the
safe one: the item step is a **pure gain at no cost** -- items of the same tier
have identical raw values, so a swap costs nothing, however strongly the
resonance works in the end. Adapting the team to the equipment instead would
mean trading **measured** raw strength for a **not measurable** bonus. That
would be a bet.

When joint optimisation might pay off anyway: when the builder rates two teams
as practically equal (within the 10 % candidate window) and the player owns a
complete 6-slot set for one of the two themes. Then the choice of theme is free
and the resonance is the tiebreak. It still requires somebody to know the size
of the effect (see section 6).

A theme is only fully usable when matching items exist for **all six slots**.
An example from the measurement day (mythic level 20 in the test account's
inventory):

```
sun 13 (all 6 slots)    fire 13 (no slot 4)     darkness 12 (no slot 5)
water 10 (no slot 2)    psychic 8   Balanced 8  light 7
nature 7 (no slot 5)    stone 2
```

Only *sun* could be served on all six slots; the nature team of the measurement
day could be served 4/6 (slot 5 missing, slot 2 only with a loss of class).

---

## 5a. What of it is built

`Service/EquipmentOptimizerService.ts` (the ranking) and
`Service/EquipmentUpgradeService.ts` (the levelling) are pure and testable,
`Module/EquipmentGear.ts` does the impure half -- reading globals, paginating,
the preview, ajax. All three steps are in place:

| Button | corresponds to | Selection |
|---|---|---|
| Current Best Gear | team 2a | priority tier by today's state |
| Possible Best Gear | team 2b | priority tier by the state at level 20 |
| Upgrade Gear | team 3 | equipped mythics below level 20, the best tier first |

### The scoring: priority tiers, not a stat score (2026-08-17)

Two stat models were built and both recommended trading mythics for
legendaries -- first a flat carac sum (which let a legendary with 43,301
endurance and zero on everything else win), then a product of the class carac
and endurance. What decided it was a crawl of the whole league through
`/hero/<id_member>/profile.html`, where `hero_items` is readable for **every**
player:

```
99 players, 594 slots:   mythic 582   legendary 12
576 of the 582 mythics at level 20
95 of 99 players wear 6/6 mythic; the top 25 without exception
the four with legendaries stand at rank 49, 60, 80, 95
```

A score that contradicts that is wrong, however well argued. And it is not
repairable here either: the theme axis targets `defense` or `chance` in **all
582 cases** -- exactly the two values that cannot be measured client-side.

The ranking therefore encodes what strong players do:

| Tier | Condition |
|---|---|
| 1 | mythic at level 20, class **and** theme matching |
| 2 | mythic at level 20, class matching |
| 3 | mythic at level 20, theme matching |
| 4 | mythic at level 20 |
| 5 | everything else -- by stats, then resonance |

**Level 20 means something different per button.** "Possible Best" projects, so
there an unlevelled mythic qualifies for tiers 1-4 at once; at level 20 all
mythics of a slot have identical caracs anyway (measured: one single tuple
`4000/4000/4000/4000/5000` across all 576 slots), which is why that button
needs no stat calculation at all. "Current Best" judges today, so there an
unlevelled mythic falls to tier 5 and competes with its real values --
otherwise a level-1 mythic (11,500 carac points) would displace a legendary at
player level (~18,600).

**A tie within a tier** is decided by the size of the resonance. The class axis
always pays 2 pp, the theme axis 4 pp on the chance track and 2 pp on defense
(279 against 297 of the 576 slots). Two tier-1 items can therefore be worth
6 pp or 4 pp.

**Tier 5** orders by the geometric mean over the four axes (class carac,
secondary caracs, endurance, chance). That is explicitly a heuristic and not a
measurement -- it only encodes "balanced beats lopsided" and prevents a
mono-stat item from winning. Legendaries carry no resonance at all: of the 12
legendary slots in the league, none had a class or theme bonus.

A counter-check on the measurement account: both buttons report **"nothing to
change"** -- four slots at tier 1, two slots at tier 2 (for slots 2 and 5 the
account owns no nature mythic).

### How Upgrade Gear uses it

The flow deliberately goes through the game page instead of an ajax call of its
own: write the queue, navigate to the upgrade page of the first target, press
"Auto Select" and "Level-up" there until the game stops enabling the level-up
button, then on to the next target.

The reason stands above -- the cost curve cannot be derived from its own numbers
(20 for 1->2, 23 for 2->3, but 1,555 in total from level 1; no arithmetic
series through those points produces it). "Auto Select" picks the material by
the game's rules, and the level-up button is active exactly when the need is
covered. A disabled button **is** the statement "material exhausted" -- the
automation counts nothing itself.

Safeguards: the automation does nothing while the queue is empty (checked live:
zero calls). If `item_to_upgrade.id_member_armor` does not match the head of the
queue, it aborts without spending anything. And a hard limit of 30 levels per
page load applies, because every level costs money and material.

### Material for Upgrade Gear

**Mythics are never material.** No exception for duplicates, none for "right
theme, wrong class", none for displaced items. Only legendaries and epics are
consumed -- in the test inventory 1,169 and 341 pieces against 104 mythics.

That also resolves the conflict of goals from the original prompt: items with
the right theme and the wrong class are tier 3 now and get equipped, instead of
being fuel at the same time.

The safety rule "never consume an equipped item" is still needed, only with a
different aim: when a slot has no mythic, tier 5 equips a legendary -- and that
is exactly what the upgrade step must not melt down.

### The upgrade endpoint (measured 2026-08-17)

It is not in `shop.js` or `shared.js`, because it lives on a **page of its
own**:

```
/mythic-equipment-upgrade.html?id_member_item=<id_member_armor>
```

The "Level-up" button on `shop.html` only navigates there -- it sends nothing.
On the target page live the globals `item_to_upgrade`, `next_level_item`,
`materials_items` (100 per page) and `upgradeable_item_max_level` (= 20).

**The call:**

```
action=mythic_armor_level_up
items_data[0][item_ids][]  = <id_member_armor>   (repeated, one entry per material)
items_data[0][rarity]      = epic
id_member_item             = <the item that should rise>
is_armor_equipped          = false
```

The grouping `items_data[0]` with its own `rarity` suggests that several rarity
groups fit into one call (`[1]`, `[2]`, ...); only one was measured.
`is_armor_equipped` shows that the game also lets equipped items be upgraded.

**The answer:**

```json
{"hero_updates":{"currency":{"soft_currency": 34299666244}},
 "next_level_item":{ ...level: 3, caracs, resonance_bonuses... },
 "success":true}
```

`next_level_item` is the *next* tier, not the one reached. After the call the
item stood at level 2 and `next_level_item.level` at 3.

**Costs, measured on a real call** (Eyepatch, mythic, level 1 -> 2):

| | |
|---|---|
| Money | 1,000,000 (soft currency), exactly |
| Kobans | 0 |
| Material | 7 items, all `epic` |
| Material need per the UI | "Until lvl.2: 20", then "Until lvl.3: 23" |
| Remaining need to level 20 | 1,555 before the step, 1,535 after |

The 7 items covered a need of 20 -- material therefore counts **not by piece
but by weight**. The most plausible carrier is `skin.weight`, which takes the
values 1, 3, 5 and 6 in the material list (*suspected*, not recomputed).

**At level 20 the page redirects.** A call for an item at the cap lands
silently on `/shop.html`. That is exactly why an automation that runs to the
cap never reaches its own cleanup -- it is thrown off the page mid-run.

**One tier below the cap the need line stands twice.** At level 19 the page
prints "Until lvl.20: 204" twice, because the next tier and the cap are the
same. A parser that reads the first line as "next tier" and the 20 line as "to
the cap" has to serve both from the same hit.

**What that means in practice:** a mythic from 1 to 20 costs around 1,555
material points. The test account owns 1,169 legendaries and 341 epics -- so
roughly one full inventory per item. The limit is not the money (34.3 billion
available), it is the material. An "Upgrade Gear" button should therefore work
out in advance how far the stock reaches, instead of starting blindly.

Confirmed live along the way: the resonance rose with the level from 0.1 to 0.2
percentage points, exactly the 0.1 per level from section 2.

Paginating the inventory uses `{action:'market_get_armor', id_member_armor}`
and expects `{items: [...], success}`; empty `items` end the list. That is the
same contract `Shop.ts` (`checkAjaxComplete`) already runs on. Measured live
2026-09-11: with the last ID of the first inventory page (65 pieces) the call
answers `{items: [], success: true}`.

---

## 6. Open

- How large the effect is in practice -- not measurable client-side (see above).
- Whether the theme axis uses the same threshold as the domination system
  (measured: ``theme_elements`` is set from 3 girls of one element on,
  otherwise empty = Balanced). Plausible, but not confirmed for the resonance.
- Whether girl and player resonances go into the same pot. The recruit article
  says the bonuses of the girl equipment in the current team go "to the Hero in
  the end calculation" -- so probably yes.
- Exactly how material is weighted. Seven epics covered a need of 20, and
  `skin.weight` takes the values 1, 3, 5, 6 -- plausible, but not recomputed.
  The automation does not need it: it reads the need off the page and lets
  "Auto Select" choose.
- What a level beyond the first costs. Only 1 -> 2 is measured, with 1,000,000
  money; a run from 1 to 20 consumed 1,206 items (all 334 epics and 872
  legendaries).

---

## Girl equipment (measured 2026-09-01)

The recruit page was measured on its own, not derived from the player
equipment. Not measured again on 2026-09-11: on the equipment tabs of three
equipped girls of the test account there was no link to the upgrade page.

**Axes.** A mythic girl item carries **three** resonances, a legendary one
**two**:

| Axis | matches against | Example (measured) |
|---|---|---|
| `class` | `girl.class` | `{identifier: "3", resonance: "ego", bonus: 0.5}` |
| `element` | `girl.element` | `{identifier: "sun", resonance: "defense", bonus: 0.5}` |
| `figure` | `girl.figure` | `{identifier: "11", resonance: "damage", bonus: 0.5}` -- mythic only |

Each axis is hit individually: the measured piece sat on Bunny (class 1,
element sun, figure 1) and hit only the element axis.

**The level drives the bonus.** The same mythic piece, only upgraded:

| Level | Bonus per axis | caracs | Ego |
|---|---|---|---|
| 1 | 0.05 | 30/30/30 | 45 |
| 10 | 0.50 | 300/300/300 | 450 |

Legendary at level 1: 0.04 per axis, 26/26/26, ego 39.

**The maximum level is 10** (`upgradeable_item_max_level`), not 20 as with
player equipment.

**Costs** (`material_costs_map`, the value per target tier):

| Target | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|
| Value | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 |

The sum 1 -> 10: **270**. A fully equipped team (7 girls x 6 slots) therefore
costs 11,340 of material value.

**Material value** (`materials_per_rarity`), the value of a feeder piece by its
rarity and its own level:

| Rarity | Lv1 | Lv5 | Lv10 |
|---|---|---|---|
| common | 1 | 8 | 28 |
| rare | 1 | 15 | 55 |
| epic | 2 | 23 | 83 |
| legendary | 2 | 30 | 110 |
| mythic | 3 | 38 | 138 |

Unlike with the player equipment, the weighting here is known client-side and
can be recomputed.

**The call** (one POST = one tier):

```
action=girl_equipment_level_up
id_girl_armor_equipped=<the worn piece>
materials_ids[]=<id_girl_armor>   (repeated)
```

The answer: `hero_updates.currency.soft_currency` and `next_level_item` -- the
piece at the next tier, with `level`, `caracs`, `armor`, `skin`.

**A trap.** `materials_items` only ever holds **100 pieces**; the list loads
more on scrolling. Whoever reads only the first batch takes the stock for
exhausted -- measured, a reload of the page after every tier helped.
