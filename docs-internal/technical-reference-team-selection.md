# Technical Reference: Team Selection Data & API

Reference document for Issue #1340 — Improved team selection.
Based on data analysis performed 2026-03-24. Last updated: 2026-04-07.

---

## 1. Data Sources Overview

| Source | When Available | Access Method | Fields | Used By Script |
|--------|---------------|---------------|--------|----------------|
| `availableGirls` | Edit Team page | `getHHVars("availableGirls")` | **62 per girl** | Only in `Harem.getGirlsList()` |
| `data-new-girl-tooltip` | Edit Team page (DOM) | `$('.girl_img').attr('data-new-girl-tooltip')` | **11 per girl** | `TeamModule.setTopTeam()` |
| `get_girls_blessings` API | Home page (Blessing popup) | `onAjaxResponse(/action=get_girls_blessings/)` | Active + Upcoming blessings | Only for Spreadsheet link injection |
| `shared.GirlSalaryManager.girlsMap` | Most pages | `getHHVars("shared.GirlSalaryManager.girlsMap")` | Full girl data | `Harem.getGirlMapSorted()` |
| `girlsDataList` | Various pages | `getHHVars("girlsDataList")` | Full girl data | `Harem.getGirlsList()` fallback |
| `girls_data_list` | Waifu page | `getHHVars("girls_data_list")` | Full girl data | `Harem.getGirlsList()` fallback |

---

## 2. availableGirls — Full Field List (62 fields)

Accessed via: `(unsafeWindow as any).availableGirls` or `getHHVars("availableGirls")`
Available on: Edit Team page (`pagesIDEditTeam`)
Type: Array of girl objects

### Identity & Base Info

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `id_girl` | number | `12345` | Unique girl ID |
| `id_girl_ref` | number | | Reference ID (base girl) |
| `id_member` | number | | Player's member ID |
| `name` | string | `"Maisie"` | Display name |
| `rarity` | string | `"legendary"` | `starting`, `common`, `rare`, `epic`, `legendary`, `mythic` |
| `class` | string | `"Hardcore"` | `Hardcore`, `Charm`, `Know-how` |
| `figure` | number | | |
| `level` | number | `750` | Current level |
| `level_cap` | number | | Maximum possible level |
| `nb_grades` | number | | Total grade slots (3 or 5 for legendary, 6 for mythic) |
| `graded` | number | | Current grade count |
| `graded2` | string | | HTML string with grade icons (contains `<g` and `grey` for counting) |
| `fav_graded` | number | | |
| `awakening_level` | number | | |
| `affection` | number | | |
| `xp` | number | | |
| `date_added` | string | | When player acquired this girl |
| `release_date` | string | | |
| `anniversary` | string | | |
| `style` | string | | |
| `id_world` | number | | |
| `id_quest_get` | number | | |
| `id_role` | number | | |
| `id_places_of_power` | number | | |

### Stats (INCLUDE BLESSINGS)

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `caracs` | object | `{carac1: 20446.345, carac2: 10658.7, carac3: 8026.2}` | **Already blessed!** Final values |
| `carac1` | number | `20446.345` | Same as `caracs.carac1` |
| `carac2` | number | `10658.7` | Same as `caracs.carac2` |
| `carac3` | number | `8026.2` | Same as `caracs.carac3` |
| `caracs_sum` | number | | Sum of all three caracs |
| `orgasm` | number | | |

### Blessing Data

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `blessing_bonuses` | object | see below | **Individual blessing %s** |
| `can_be_blessed` | boolean | | Whether girl can receive blessings |
| `can_be_blessed_pvp4` | boolean | | PvP4 blessing eligibility |
| `blessed_attributes` | unknown | | Present in tooltip too — needs further inspection |

#### `blessing_bonuses` Structure

```
{
  "pvp_v3": {                    // League blessings
    "carac1": [20, 30],          // Array of individual blessing %s
    "carac2": [20, 30],          // [20] = Element blessing, [30] = Zodiac blessing
    "carac3": [20, 30]
  },
  "pvp_v4": {                    // Other PvP mode
    "carac1": [20, 30],
    "carac2": [20, 30],
    "carac3": [20, 30]
  }
}
```

- Empty array `[]` = girl receives no blessings
- `[20]` = matches one blessing
- `[20, 30]` = matches both active blessings
- Blessings are **multiplicative**: total = (1 + 0.20) × (1 + 0.30) = 1.56

### Element Data

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `element` | string | `"sun"` | Internal element name |
| `element_data` | object | see below | Full element info |

#### `element_data` Structure

```
{
  "type": "sun",                              // Internal: sun, fire, stone, water, nature, light, darkness, psychic
  "flavor": "Playful",                        // Display name: Playful, Eccentric, Physical, Sensual, Exhibitionist, Dominatrix, Submissive, Voyeur
  "weakness": "stone",                        // This element is weak against
  "domination": "water",                      // This element dominates
  "domination_ego_bonus_percent": 10,
  "domination_damage_bonus_percent": 10,
  "domination_critical_chance_bonus_percent": 20,
  "ico_url": "https://hh2.hh-content.com/pictures/girls_elements/Playful.png"
}
```

#### Element Mapping (internal ↔ display)

| Internal Type | Display Flavor | Synergy Bonus (per girl in team) | Bonus Type |
|---------------|---------------|----------------------------------|------------|
| `darkness` | Dominatrix | 2% | Damage |
| `psychic` | Submissive | 2% | Defense |
| `light` | Voyeur | 2% | Harmony |
| `fire` | Eccentric | **10%** | Critical Hit Damage |
| `nature` | Exhibitionist | 3% | Ego |
| `stone` | Physical | 2% | Critical Hit Chance |
| `sun` | Playful | 2% | Decrease Defense of Opponent |
| `water` | Sensual | 3% | Recover on Hit |

Harem-wide bonus (per girl owned, not in team):

| Internal Type | Harem Bonus |
|---------------|-------------|
| `darkness`, `psychic`, `light`, `stone`, `sun` | 0.07% per girl |
| `fire` | 0.35% per girl |
| `nature`, `water` | 0.1% per girl |

### Trait Data

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `zodiac` | string | `"♐︎ Sagittarius"` | Full Unicode string with symbol |
| `hair_color1` | string | `"F99"` | Hex color code (without #) |
| `hair_color2` | string | | Second hair color (multicolored) |
| `eye_color1` | string | `"F90"` | Hex color code (without #) |
| `eye_color2` | string | | Second eye color |
| `position_img` | string | `"3.png"` | Favorite position as image filename |

### Skills & Equipment

| Field | Type | Notes |
|-------|------|-------|
| `skill_tiers_info` | object | Skill tier information |
| `armor` | object | Equipped items |
| `upgrade_quests` | object | |
| `can_upgrade` | boolean | |

### Images & Display

| Field | Type | Notes |
|-------|------|-------|
| `images` | object | `{ava: [], ico: []}` |
| `ico` | string | Icon URL |
| `avatar` | string | Avatar URL |
| `black_avatar` | string | |
| `default_avatar` | string | |
| `grade_skins` | object | |
| `grade_offsets` | object | |
| `grade_offset_values` | object | |
| `animated_grades` | object | |
| `scene_paths` | object | |
| `preview` | object | |

### Salary & Economy

| Field | Type | Notes |
|-------|------|-------|
| `salary` | number | |
| `salary_timer` | number | |
| `salary_per_hour` | number | |
| `pay_time` | number | |
| `pay_in` | number | |
| `ts_pay` | number | Timestamp of last pay |
| `salaries` | object | |
| `shards` | number | |

---

## 3. data-new-girl-tooltip — Field List (11 fields)

Accessed via: `$('.girl_img', element).attr('data-new-girl-tooltip')` → JSON.parse
Set by: **The game itself** (not HHauto)
Available on: Edit Team page (DOM elements with `div[id_girl]`)

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `name` | string | `"Karole"` | |
| `level` | number | `1` | |
| `rarity` | string | `"rare"` | |
| `class` | string | | |
| `element` | string | `"water"` | Internal type |
| `element_data` | object | Same structure as availableGirls | |
| `caracs` | object | `{carac1: 1.9, carac2: 2.2, carac3: 4.5}` | Stats at current level |
| `graded2` | string | | HTML grade string |
| `skill_tiers_info` | object | | |
| `salary_per_hour` | number | | |
| `blessed_attributes` | unknown | | Present but not yet inspected |

**NOT available in tooltip:** `blessing_bonuses`, `zodiac`, `hair_color1/2`, `eye_color1/2`, `position_img`, `id_girl`, `armor`, `awakening_level`, and ~50 other fields.

---

## 4. Blessing API Response

Endpoint: `action=get_girls_blessings`
Intercepted in: `src/Module/Spreadsheet.ts` line 34
Currently used for: Spreadsheet link injection only (response data discarded)

```
{
  "active": [
    {
      "title": "Week of the Playful",
      "description": "All girls with <span class=\"blessing-condition\">Element Playful</span> gain <span class=\"blessing-bonus\">+ 20%</span> bonus on all attributes.",
      "remaining_time": 487876,     // seconds until this blessing expires
      "starts_in": -113323          // negative = already started
    },
    {
      "title": "Week of the Sagittarius",
      "description": "All girls with <span class=\"blessing-condition\">Zodiac sign Sagittarius</span> gain <span class=\"blessing-bonus\">+ 30%</span> bonus on all attributes.",
      "remaining_time": 487876,
      "starts_in": -113323
    },
    {
      "title": "Week of the Corkscrewer",
      "description": "All girls with <span class=\"blessing-condition\">Role Corkscrewer</span> gain <span class=\"blessing-bonus\">+ 30%</span> bonus on all attributes in Love Labyrinth.",
      "remaining_time": 487876,
      "starts_in": -113323
    }
  ],
  "upcoming": [
    {
      "title": "Week of the Bridge",
      "description": "...Favorite position Bridge... + 25%...",
      "remaining_time": 1092676,
      "starts_in": 487877
    },
    {
      "title": "Week of the Capricorn",
      "description": "...Zodiac sign Capricorn... + 35%...",
      "remaining_time": 1092676,
      "starts_in": 487877
    },
    {
      "title": "Week of the Pleasurelock",
      "description": "...Role Pleasurelock... + 40%... in Love Labyrinth.",
      "remaining_time": 1092676,
      "starts_in": 487877
    }
  ],
  "success": true
}
```

### Blessing Slot Structure (per week)

| Slot | Type | League Relevant | Example |
|------|------|-----------------|---------|
| Slot 1 | Element OR Position OR Hair/Eye Color | **Yes** | "Week of the Playful" (+20%) |
| Slot 2 | Zodiac | **Yes** | "Week of the Sagittarius" (+30%) |
| Slot 3 | Role | **No** (Love Labyrinth only) | "Week of the Corkscrewer" (+30%) |

Labyrinth-only blessings can be identified by `"in Love Labyrinth"` in the description.

### Parsing Hints

- Condition type: extract from `<span class="blessing-condition">...</span>`
- Bonus value: extract from `<span class="blessing-bonus">+ XX%</span>`
- Condition categories seen: `"Element ..."`, `"Zodiac sign ..."`, `"Favorite position ..."`, `"Role ..."`
- Expected but not yet confirmed: `"Hair color ..."`, `"Eye color ..."`

---

## 5. Relevant Source Files

### Team Selection (v3 — current as of v7.34.13)

| File | Key Function | Purpose |
|------|-------------|---------|
| `src/Service/TeamScoringService.ts` | `filterHighRarity()` | Rarity filter: Mythic (6★) + Legendary (5★ only) |
| `src/Service/TeamScoringService.ts` | `scoreCurrentBest()`, `scoreBestPossible()` | Stat scoring for both modes |
| `src/Service/TeamScoringService.ts` | `calculateTier3TeamBonus()` | Tier 3 trait matching bonus |
| `src/Service/TeamScoringService.ts` | `estimateTier3Delta()` | Marginal tier 3 bonus for per-slot comparison |
| `src/Service/TeamScoringService.ts` | `findTraitGroups()` | Group girls by element pair + shared trait value |
| `src/Service/TeamScoringService.ts` | `calculateSynergies()`, `calculateSynergyValue()` | Element synergy calculation |
| `src/Service/TeamScoringService.ts` | `rankLeaderCandidates()` | Leader ranking: Mythic only, Tier-5 priority |
| `src/Service/TeamBuilderService.ts` | `buildTeam()` | Main entry: filter, trait groups, leader, slot-fill |
| `src/Service/TeamBuilderService.ts` | `getElementDistribution()` | Element count summary for UI |
| `src/Module/TeamModule.ts` | `setTopTeam()` | Dispatch: v3 if availableGirls present, else legacy |
| `src/Module/TeamModule.ts` | `setTopTeamV2()` | Maps game data to GirlData[], calls TeamBuilderService |
| `src/Module/TeamModule.ts` | `setTopTeamLegacy()` | Old tooltip-based algorithm (fallback) |
| `src/Module/TeamModule.ts` | `updateTeamUI()` | Shared UI logic with synergy + trait info overlay |
| `src/Module/TeamModule.ts` | `moduleChangeTeam()` | Button setup (Current Best, Possible Best, Unequip) |
| `src/Module/TeamModule.ts` | `assignTopTeam()` | Assigns selected top team |
| `src/Module/TeamModule.ts` | `getSelectedGirls()` | Reads current team members |

### Tests

| File | Tests | Purpose |
|------|-------|---------|
| `spec/Service/TeamScoringService.spec.ts` | 52 | Synergies, Tier-5, scoring, filtering, Tier-3 traits |
| `spec/Service/TeamBuilderService.spec.ts` | 14 | Team building, modes, leader selection |

### Girl Data Loading

| File | Key Function | Purpose |
|------|-------------|---------|
| `src/Module/harem/Harem.ts` | `getGirlsList()` | Loads girls from game globals — lines 93-112 |
| `src/Module/harem/Harem.ts` | `getGirlMapSorted()` | Sorted girl list — lines 59-90 |
| `src/Module/harem/Harem.ts` | `getHaremGirlsFromOcdIfExist()` | OCD script cache fallback — line 114 |
| `src/Module/harem/HaremGirl.ts` | | Individual girl data access |
| `src/Helper/HHHelper.ts` | `getHHVars(path)` | Bridge to `unsafeWindow` globals — lines 23-50 |

### Blessing & Spreadsheet

| File | Key Function | Purpose |
|------|-------------|---------|
| `src/Module/Spreadsheet.ts` | `run()` | Intercepts `get_girls_blessings` API — line 34 |
| `src/config/HHEnvVariables.ts` | | Config including `girlToolTipData` — line 58 |

### Battle Simulation

| File | Key Function | Purpose |
|------|-------------|---------|
| `src/Helper/BDSMHelper.ts` | | Battle simulation with element synergies |
| `src/model/BDSMPlayer.ts` | | Player battle model (hp, atk, crit, bonuses) |

### Models

| File | Purpose |
|------|---------|
| `src/model/KK/KKHaremGirl.ts` | Girl data model — 62 fields |
| `src/model/KK/KKTeamGirl.ts` | Team member wrapper (girl + skills) |
| `src/model/TeamData.ts` | Team structure (7 girls + scroll counts) |
| `src/model/KK/KKHero.ts` | Player/hero model |
| `src/model/KK/KKLeagueOpponent.ts` | Opponent model (has `girls_count_per_element`) |

### UI / i18n

| File | Key | Value |
|------|-----|-------|
| `src/i18n/en.ts` line 281 | `ChangeTeamButton` | "Current Best" |
| `src/i18n/en.ts` line 282 | `ChangeTeamButton2` | "Possible Best" |
| `src/i18n/en.ts` | `AssignTopTeam` | Button to assign the selected top team |

---

## 6. setTopTeam Logic

### v3 (active when `availableGirls` is available)

```
Data source: getHHVars("availableGirls") — 62 fields per girl

Rarity filter (both modes):
  Mythic (nb_grades = 6):    always included
  Legendary (nb_grades = 5): included
  Legendary (nb_grades = 3): excluded
  All other rarities:        excluded

Mode 1 ("Current Best"):
  Score:  caracs.carac1 + caracs.carac2 + caracs.carac3
          (already blessed values)

Mode 2 ("Best Possible"):
  Score:  (carac1 + carac2 + carac3) / level * playerLevel
          / (1 + 0.3 * graded) * (1 + 0.3 * nb_grades)

Process:
  1. Map availableGirls to GirlData[]
     (element via element_data.type, traits via zodiac/hair_color1/eye_color1/position_img)
  2. Filter to Mythic (6★) + Legendary (5★ only)
  3. Score all candidates, sort descending, take top 50
  4. Find best trait group (element pair + shared trait value, min 3 girls)
  5. Select leader from pool (Mythic only, Shield > Stun > Execute > Reflect)
  6. Fill slots 2-7: unified per-slot comparison (statScore + synergyDelta + tier3Delta)
     — trait-group and non-group girls compete directly on each slot
     — high-stat blessed girls can beat weak trait-group members
  7. Calculate Tier 3 bonus (1.0% Mythic / 0.8% Legendary per trait match)
  8. Show 7 girls with element emojis, leader skill, trait + synergy info panel
  9. Add "Assign Top Team" button
```

### Legacy (fallback when `availableGirls` is unavailable)

```
Data source: data-new-girl-tooltip — 11 fields per girl (DOM parsing)
No rarity filter, no trait matching, no leader skill optimization.

Process:
  1. Iterate all div[id_girl] elements on page
  2. Parse tooltip JSON from .girl_img child
  3. Calculate score per girl (same stat formulas as v3)
  4. Keep top 16 in sorted arrays (deckID, deckStat)
  5. Hide non-top girls, show top 16 with rank numbers
  6. Add "Assign Top Team" button
```

---

## 7. Element Counter Bonuses (from BDSMHelper.ts)

Two triangle systems for elemental advantage in battle:

**Triangle 1 — Critical Hit Chance (+20%):**
```
darkness (Dominatrix) → light (Voyeur) → psychic (Submissive) → darkness
```

**Triangle 2 — Damage (+10%) & Ego (+10%):**
```
fire (Eccentric) → nature (Exhibitionist) → stone (Physical) → sun (Playful) → water (Sensual) → fire
```

Extracted in BDSMHelper from `team.synergies`:
```
critDamage  = synergies.find(type === 'fire').bonus_multiplier
critChance  = synergies.find(type === 'stone').bonus_multiplier
defReduce   = synergies.find(type === 'sun').bonus_multiplier
healOnHit   = synergies.find(type === 'water').bonus_multiplier
```

---

## 8. Version History

| Version | Change |
|---------|--------|
| v7.34.0 | v2: synergy-aware greedy algorithm with leader Tier-5 optimization, element UI overlay, legacy fallback. PR #1519. |
| v7.34.7 | v3: Tier-3 trait-group optimization, trait matching with element pairs, trait info panel. |
| v7.34.13 | Rarity filter: exclude 3-star legendaries, only 5★ Legendary + 6★ Mythic considered. |
| v7.34.14 | Unified slot-fill: per-slot comparison with tier 3 delta, blessed girls can beat weak trait members. |
