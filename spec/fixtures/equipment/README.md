# equipment fixtures

## Source

- Dump: `INPUT/hhauto_dump_www_hentaiheroes_com_tour_2026-08-17T09-42-21-877Z.json`
- Capture date: 2026-08-17T09:42Z, inspector v4.8.0
- Path: `pages[28].girls_full["game.teamGirls"][n].armor[0]` (`/edit-team.html`)

## Files

`girl-armor.json` — one equipped girl armor. Girl and hero equipment share the
inventory the optimiser reads, so this is the entry it has to drop. It is the
one shape that could not have been guessed: it carries
`id_girl_armor_equipped` and `id_girl_item_armor` and no hero id at all, plus
`skin.wearer === "girl"` and `skin.subtype === 3`.

## What is missing, and why

The hero's own armor is **not** in this dump. `equipped_armor` and
`player_inventory.armor` exist as page globals on `/shop.html` — the inspector
records their names and types in `globals_overview` but not their contents.
Until it captures them, the positive cases in
`spec/Service/EquipmentOptimizerService.spec.ts parseArmorItem` still run on a
hand-written entry transcribed from the live objects measured on 2026-08-16.

Capturing them is a small inspector change (add both globals to the captured
buckets on the market page) or a one-off console read on `/shop.html`:

```js
JSON.stringify({ equipped: equipped_armor, inventory: player_inventory.armor.slice(0, 4) })
```

Both entry kinds are needed, because they differ: an item under `#equiped`
carries only `id_member_armor_equipped`, an inventory entry only
`id_member_armor`. Sniffing on the field instead of being told which is which
is exactly what dropped all six worn items in August 2026.

## Redactions

`id_member` → `1`; asset urls dropped (`skin.ico` among them).

## Consumers

- `src/Service/EquipmentOptimizerService.ts` — `parseArmorItem`

## How to refresh

Take any girl off the fielded team in a fresh dump and keep her first armor
entry whole, minus the redactions above.
