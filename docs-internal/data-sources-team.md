---
last-verified: 2026-09-11
verified-against-version: 8.13.1
status: current
---

# API Reference: Team Selection Inputs

Reference for the game-side data structures the team builder consumes.
The algorithm itself lives in the code -- ``TeamBuilderService.ts``
(candidate matrix, leader rule, cluster/Pos-2-7 fill) over
``TeamScoringService.ts`` (scoring, Tier-3/Tier-5, element coeff) and
``BlessingService.ts`` (blessing detection). This file documents only the
inputs (game API field shapes) so they can be looked up without diffing
the live game.

---

## ``availableGirls`` -- field list

Access: ``getHHVars("availableGirls")`` or ``unsafeWindow.availableGirls``.
Available on the Edit-Team page (``pagesIDEditTeam``).
Type: ``Array<GirlData>``.

Field list measured 2026-09-11 on ``/edit-team.html?battle_type=leagues``
(test account, 24 girls): an array of 24, each entry with 62 fields -- every
field listed below and no others. ``caracs`` carries ``carac1..3``,
``blessing_bonuses`` carries ``pvp_v3`` and ``pvp_v4``, and ``element_data``
the eight keys shown further down. ``availableGirls`` does not exist on
``/teams.html``, and ``teams_data`` does not exist on the edit-team page.

### Identity & basic info

| Field | Type | Notes |
|---|---|---|
| ``id_girl`` | number | Unique girl ID |
| ``id_girl_ref`` | number | Reference ID (base girl) |
| ``id_member`` | number | Player member ID |
| ``name`` | string | Display name |
| ``rarity`` | string | ``starting`` / ``common`` / ``rare`` / ``epic`` / ``legendary`` / ``mythic`` |
| ``class`` | number | ``1`` = Hardcore, ``2`` = Charm, ``3`` = Know-how |
| ``figure`` | number | Numeric figure index |
| ``level`` | number | Current level (cap = 750) |
| ``nb_grades`` | number | Maximum number of grades for this rarity |
| ``graded`` | number | Number of grades currently applied |
| ``Graded`` | string | Capital-G HTML string for UI rendering |
| ``graded2`` | string | HTML string with grade icons |
| ``fav_graded`` | number | |
| ``awakening_level`` | number | 0..10 |
| ``affection`` | number | |
| ``xp`` | number | |
| ``date_added`` | string | When the girl was added |
| ``release_date`` | string | |
| ``anniversary`` | string | |
| ``style`` | string | |
| ``id_world`` | number | |
| ``id_quest_get`` | number | |
| ``id_role`` | number | |
| ``id_places_of_power`` | number | |

### Stats (blessings AND equipment included)

| Field | Type | Notes |
|---|---|---|
| ``caracs`` | object | ``{carac1, carac2, carac3}`` -- blessed AND equipped, see below |
| ``carac1`` | number | Mirror of ``caracs.carac1`` |
| ``carac2`` | number | Mirror of ``caracs.carac2`` |
| ``carac3`` | number | Mirror of ``caracs.carac3`` |
| ``caracs_sum`` | number | Sum of the three caracs (game pre-computes) |
| ``orgasm`` | number | |

Verified by dump diff: ``teamGirls.blessed_caracs == availableGirls.caracs``.

**``caracs`` contains the girl's equipment.** This page previously claimed the
opposite ("equipment-free, no unequip needed before scoring"); measured on
2026-08-17 that is wrong. Two dumps of the same account, taken before and after
a Stuff Team run that moved gear between girls, with level, awakening and
blessing unchanged:

| Girl | Items | ``caracs_sum`` | Delta / (item caracs x blessing) |
|---|---|---|---|
| Undercover Valentina | 6 -> 0 | 39,448 -> 31,762 | 1.017 |
| Draconic Stacy | 6 -> 0 | 39,463 -> 31,777 | 1.017 |
| Oni Princess Yura | 0 -> 6 | 29,988 -> 39,463 | 1.253 |
| High Mage Arcana | 0 -> 6 | 29,988 -> 39,448 | 1.251 |

The same six-item set is worth ~23% more on some girls than on others -- that
is the mythic-equipment resonance bonus (``resonance_bonuses``: class, theme
and figure match), and it lands inside ``caracs`` too.

Consequences for team building:

- ``caracs_sum`` -- and therefore the "Total Power" the game prints -- ranks
  girls partly by who is currently wearing the good gear, not by who is the
  better girl.
- **Unequip All before building a team**, otherwise the current team wins the
  ranking simply for holding the equipment. Stuff Team afterwards moves the
  gear onto whoever was picked. Skipping the unequip creates a feedback loop:
  build -> stuff -> build again can yield a different team each round.
- ``action=team_calculate_caracs`` (TeamEvaluationService) reads the same
  equipped stats, so the same rule applies to the candidate ranking.

### Blessing data

| Field | Type | Notes |
|---|---|---|
| ``blessing_bonuses`` | object | Per-girl blessing percent lists, see structure below |
| ``can_be_blessed`` | boolean | League-blessed flag: true iff ``pvp_v3`` percents present. GirlData name: ``can_be_blessed_league`` |
| ``can_be_blessed_pvp4`` | boolean | Labyrinth-blessed flag: true iff ``pvp_v4`` percents present. GirlData name: ``can_be_blessed_labyrinth`` |
| ``blessed_attributes`` | object | Tooltip-side mirror |

#### ``blessing_bonuses`` structure

```jsonc
{
  "pvp_v3": {                    // LEAGUE: the two weekly league blessings
    "carac1": [20, 30],
    "carac2": [20, 30],
    "carac3": [20, 30]
  },
  "pvp_v4": {                    // LABYRINTH: league blessings + weekly Role blessing
    "carac1": [20, 30, 25],
    "carac2": [20, 30, 25],
    "carac3": [20, 30, 25]
  }
}
```

- Empty list ``[]`` / key absent -- girl matches no active blessing in that mode.
- ``[20]`` -- one blessing match.
- ``[20, 30]`` -- both active blessings match.
- Multipliers stack multiplicatively: ``(1 + 0.20) * (1 + 0.30) = 1.56``.

Context semantics (verified 2026-07-13 against the hh-bless-cluster
fixtures and a live dump; role blessing that week: "Week of the Bugger"
+25%):

- ``pvp_v3`` holds ONLY the two league-relevant blessings (slots 1+2).
- ``pvp_v4`` == ``pvp_v3`` plus the slot-3 Role blessing, which applies
  only in the Love Labyrinth. A girl with a ``pvp_v4``-only entry is
  role-blessed and counts as UNBLESSED for league team building
  (``can_be_blessed`` is ``false`` for her).
- ``BlessingService`` therefore takes a ``context`` parameter
  (``'league'`` -> ``pvp_v3``, ``'labyrinth'`` -> ``pvp_v4``) and never
  falls back across contexts.

### Element data

| Field | Type | Notes |
|---|---|---|
| ``element`` | string | Internal name |
| ``element_data`` | object | Full element info (see below) |

#### ``element_data`` structure

```jsonc
{
  "type": "stone",
  "weakness": "nature",
  "domination": "sun",
  "domination_ego_bonus_percent": 10,
  "domination_damage_bonus_percent": 10,
  "domination_critical_chance_bonus_percent": 20,
  "ico_url": "https://hh2.hh-content.com/pictures/girls_elements/Physical.png",
  "flavor": "Physical"
}
```

#### Element name mapping (internal -> display)

| Internal | Display (``flavor``) |
|---|---|
| ``fire`` | Eccentric |
| ``water`` | Sensual |
| ``nature`` | Exhibitionist |
| ``stone`` | Physical |
| ``sun`` | Playful |
| ``darkness`` | Dominatrix |
| ``psychic`` | Voyeur |
| ``light`` | Submissive |

Measured 2026-09-11 from ``element_data.flavor`` of all 24 girls on the
edit-team page -- this table had the last two rows swapped until then. Two
places in the code still carry the swapped pair: ``BlessingService.parseElement``
(``'submissive' -> 'psychic'``, ``'voyeur' -> 'light'``) and the display names in
``TeamModule.CLASS_NAME``.

### Trait data

| Field | Type | Notes |
|---|---|---|
| ``zodiac`` | string | Unicode glyph + English name; ``TraitMappings.resolveZodiac`` strips the glyph |
| ``hair_color1`` | string | Hex code without ``#`` |
| ``hair_color2`` | string | Secondary hair color (often empty) |
| ``eye_color1`` | string | Hex code without ``#`` |
| ``eye_color2`` | string | Secondary eye color |
| ``position_img`` | string | Favourite position as image filename, ``"3.png"`` etc. |

### Skills & equipment

| Field | Type | Notes |
|---|---|---|
| ``skill_tiers_info`` | object | Tier 1..5 skill point usage |
| ``armor`` | object | Equipped items |
| ``upgrade_quests`` | object | |

### Images & display

| Field | Type |
|---|---|
| ``images`` | object |
| ``ico`` | string |
| ``avatar`` | string |
| ``black_avatar`` | string |
| ``default_avatar`` | string |
| ``grade_skins`` | object |
| ``grade_offsets`` | object |
| ``grade_offset_values`` | object |
| ``animated_grades`` | object |
| ``scene_paths`` | object |

### Salary & economy

| Field | Type |
|---|---|
| ``salary`` | number |
| ``salary_timer`` | number |
| ``salary_per_hour`` | number |
| ``pay_time`` | number |
| ``pay_in`` | number |
| ``ts_pay`` | number |
| ``shards`` | number |

---

## ``teams_data`` -- the teams on the battle-teams page

Access: ``unsafeWindow.teams_data``. Available on ``/teams.html`` (page id
``teams``, ``pagesIDBattleTeams``), keyed by the slot index that the DOM
carries as ``.team-slot-container.selected-team[data-team-index]``.
Not present on the edit-team page -- ``TeamModule.getSelectedGirls`` reads
the hexagons there instead.

Measured 2026-09-09 on a live account with one unlocked team of three girls:

| Field | Value seen | Notes |
|---|---|---|
| ``girls_ids`` | ``[1, 4, 7]`` | the girls in the team, **occupancy** |
| ``girls`` | 3 entries, no nulls | same girls, full records |
| ``max_team_size`` | ``7`` | **capacity**, stated separately |
| ``total_power`` | ``2969.89`` | matches the page's "Total Power 2,970" |
| ``slot_index`` | | which of the team slots this is |
| further | ``caracs``, ``remaining_ego``, ``hitter_girl_id``, ``id_team``, ``theme``, ``synergies``, ``theme_elements``, ``power_display``, ``id_member``, ``locked``, ``min_team_size``, ``selected_for_battle_type`` | the last four measured 2026-09-11 |

The account had 30 entries in ``teams_data`` (one unlocked, the rest empty
with ``girls_ids: []``); the page shows 16 slots, 4 open and 12 padlocked
behind a Monthly Card. Re-measured 2026-09-11 on the same account: still 30
entries, 29 of them empty; the selected team now full (``girls_ids`` 7,
``girls`` 7, ``max_team_size`` 7), and 30 ``.team-slot-container`` in the DOM.
``teams_data`` is an object keyed by slot index, not an array.

**Capacity is not occupancy.** Reading a short ``girls`` array as a broken
team is what v8.12.18 fixed: the array is short because the team is not full,
and ``max_team_size`` is where the seven lives. A team with nothing in it has
``girls_ids: []``, and that is the only case with no answer to give.

Measured effect of the fix, same account, same team: ``#EquipAll`` went from
"can't get all team members, cancel action" to three successful equips, and
the team's Total Power from **2,970 to 3,459**.

---

## ``data-new-girl-tooltip`` -- legacy fallback (11 fields)

Access: ``$('.girl_img', element).attr('data-new-girl-tooltip')`` -> ``JSON.parse``.
Set by the game itself, available on Edit-Team-Page DOM elements with ``div[id_girl]``.
Used by ``setTopTeamLegacy`` when ``availableGirls`` is missing.
Measured 2026-09-11: 31 such attributes on the edit-team page, each with
exactly the eleven fields below.

| Field | Type |
|---|---|
| ``name`` | string |
| ``level`` | number |
| ``rarity`` | string |
| ``class`` | number |
| ``element`` | string |
| ``element_data`` | object (same shape as in ``availableGirls``) |
| ``caracs`` | object |
| ``graded2`` | string (HTML grade string) |
| ``skill_tiers_info`` | object |
| ``salary_per_hour`` | number |
| ``blessed_attributes`` | object |

Not in the tooltip: ``blessing_bonuses``, ``zodiac``, ``hair_color1/2``,
``eye_color1/2``, ``position_img``, ``id_girl``, ``armor``,
``awakening_level`` and around fifty others. The legacy fallback cannot
do trait matching or blessing detection.

---

## Blessing API: ``get_girls_blessings``

Endpoint: ``action=get_girls_blessings``. Intercepted in
``BlessingService.fetchAndCache()`` (manually triggered when the home
page is visited). Cache lifetime: 12 hours, key
``HHAuto_Temp_blessingsCache``.

Response shape:

```jsonc
{
  "active": [
    {
      "title": "Week of the Playful",
      "description": "All girls with <span class=\"blessing-condition\">Element Playful</span> gain <span class=\"blessing-bonus\">+ 20%</span> bonus on all attributes.",
      "remaining_time": 487876,
      "starts_in": -113323
    },
    {
      "title": "Week of the Sagittarius",
      "description": "...<span class=\"blessing-condition\">Zodiac sign Sagittarius</span>... <span class=\"blessing-bonus\">+ 30%</span>...",
      "remaining_time": 487876,
      "starts_in": -113323
    },
    {
      "title": "Week of the Corkscrewer",
      "description": "...<span class=\"blessing-condition\">Role Corkscrewer</span>... + 30%... in Love Labyrinth.",
      "remaining_time": 487876,
      "starts_in": -113323
    }
  ],
  "upcoming": [ ... ],
  "success": true
}
```

### Blessing slot conventions

| Slot | Type | League-relevant |
|---|---|---|
| 1 | Element OR Position OR Hair/Eye Color | yes |
| 2 | Zodiac, **or Rarity** (see below) | yes |
| 3 | Role | no -- Love-Labyrinth only |

Measured 2026-09-11 (``action=get_girls_blessings``, response keys
``active``, ``upcoming``, ``success``; three active, three upcoming, each
with ``title``, ``description``, ``remaining_time``, ``starts_in``): the
conditions that week were ``Favorite position 69`` (+25%), ``Rarity
Legendary`` (+25%) and ``Role Pleasurelock`` (+30%). Slot 2 is therefore not
always a zodiac. ``BlessingService.parseTraits`` and ``parseBlessedValues``
know eye colour, hair colour, zodiac and position (element through
``parseElement``), not rarity: the cache written that day held
``blessedTraits: ["position"]`` and nothing for the rarity blessing.
The per-girl numbers do carry it: all five legendary girls had
``pvp_v3.carac1 = [25]``, and ``can_be_blessed`` was true for exactly the
girls with a non-empty ``pvp_v3`` (24 of 24). Scoring that reads
``blessing_bonuses`` sees the rarity bonus; only the trait list built from the
API text does not.

Labyrinth-only blessings are filtered by ``BlessingService.parseTraits``
with ``!desc.includes('bonus on all attributes') || desc.includes('labyrinth')``.

### Parsing notes

- Condition type from ``<span class="blessing-condition">...</span>``.
- Bonus value from ``<span class="blessing-bonus">+ XX%</span>``.
- Observed condition kinds: ``Element ...``, ``Zodiac sign ...``,
  ``Favourite/Favorite position ...``, ``Role ...``, ``Rarity ...``
  (2026-09-11).
- Rarely observed: ``Hair color ...``, ``Eye color ...``.

---

## ``BlessingService`` cache shape

Returned by ``BlessingService.getCached()``:

| Field | Type | Example |
|---|---|---|
| ``timestamp`` | number | ``1714903123456`` |
| ``raw`` | object | Complete API response |
| ``blessedTraits`` | string[] | ``['eyeColor', 'zodiac']`` |
| ``blessedValues`` | object | ``{eyeColor: 'golden', zodiac: 'sagittarius'}`` |
| ``blessedElement`` | string | Optional, ``'fire'`` / ``'sun'`` / ... when an element blessing is active |

Measured 2026-09-11 in ``localStorage``: keys ``timestamp``, ``raw``,
``blessedTraits``, ``blessedValues`` (no ``blessedElement`` -- no element
blessing that week), five hours old, written on a home-page visit.
