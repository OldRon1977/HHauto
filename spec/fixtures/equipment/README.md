# equipment fixtures

## Source

- Dump: `INPUT/hhauto_dump_www_hentaiheroes_com_tour_2026-08-17T13-13-52-547Z.json`
- Capture date: 2026-08-17T13:13Z, inspector v4.9.0
- `hero-armor.json` — `pages[<shop>].market_equipment.equipped_armor` and
  `.player_inventory.armor` (`/shop.html`)
- `girl-armor.json` — `pages[<edit-team>].girls_full["game.teamGirls"][n].armor[0]`

## Files

### `hero-armor.json`

Three entries out of 6 worn and 204 stocked items (104 mythic, 100 legendary,
all `wearer: "hero"`, evenly spread over the six slots):

- `equipped` — a worn capped mythic with both resonance axes. It carries
  `id_member_armor_equipped` and **no `id_member_armor` key at all**. That is
  the shape that dropped all six worn items in August, and the reason
  `parseArmorItem` has to be told which side an entry came from instead of
  sniffing for a field.
- `inventoryMythic` — a stocked mythic with both axes, the mirror case:
  `id_member_armor` and no equipped id.
- `inventoryLegendary` — a stocked legendary. Two things only real data shows:
  `caracs.chance` arrives as the **string** `"4635.10"`, and
  `resonance_bonuses` is **absent**, not an empty object. 100 of the 204
  stocked items look like this.

The capture also settles the two constants the optimiser's whole model rests
on, asserted in `the model against the capture`: a level-20 mythic really
carries 4000/4000/4000/4000/5000 (21,000 points), and resonance really grows
at 0.1 per level, doubled where the theme axis lands on the chance track.

### `girl-armor.json` — one equipped girl armor. Girl and hero equipment share the
inventory the optimiser reads, so this is the entry it has to drop. It is the
one shape that could not have been guessed: it carries
`id_girl_armor_equipped` and `id_girl_item_armor` and no hero id at all, plus
`skin.wearer === "girl"` and `skin.subtype === 3`.

## Redactions

`id_member` → `1`; asset urls dropped (`skin.ico` among them).

## Consumers

- `src/Service/EquipmentOptimizerService.ts` — `parseArmorItem`

## How to refresh

Both files come out of one auto-tour dump; inspector v4.9.0 or newer is
required, because capturing `equipped_armor` / `player_inventory` is what that
version added.

1. `hero-armor.json`: from the `/shop.html` page, take one entry out of
   `equipped_armor` that has both resonance axes, one mythic out of
   `player_inventory.armor` that has both, and one legendary whose
   `caracs.chance` is a string.
2. `girl-armor.json`: take any girl off the fielded team and keep her first
   armor entry whole.
3. Apply the redactions above.

If a refreshed capture makes `the model against the capture` fail, the game
rebalanced mythics — that is a finding about the optimiser's model, not a
broken test. Fix the model first, then the fixture.
