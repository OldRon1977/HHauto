---
last-verified: 2026-04-29
verified-against-version: 7.35.14
status: major-drift-fixed
---

# HHauto Script Architecture

Reference document for the overall script structure, module system, and execution flow.
Last updated: 2026-04-29 (verified against v7.35.14; original deep-verify against v7.35.10 — delta to v7.35.14 is troll-fix #1582 in `Module/Troll.ts`, repo-transfer popup in `FeaturePopupService.ts`, and metadata; no impact on verified architecture facts)

---

## Entry Point & Initialization

**File:** `src/index.ts`

- IIFE calls `hardened_start()` immediately on script load
- Fallback `setTimeout(hardened_start, 5000)` if game JS hasn't loaded yet
- Declares global `Window` interface with game-specific properties (`championData`, `harem`, `hero_data`, `love_raids`, etc.) read via `unsafeWindow`

---

## Main Loop: AutoLoop

**File:** `src/Service/AutoLoop.ts`

Recursive `setTimeout` loop (~1 second interval):

1. **Burst check** — master switch on, menu closed, paranoia not resting
2. **Update context** — populates `AutoLoopContext` with current page, energy, event IDs
3. **Execute action handlers** in priority order — one per iteration to prevent conflicting navigation
4. **Run page-specific UI handlers** — display overlays regardless of burst state
5. **Manage paranoia** — anti-detection pauses
6. **Track energy** — detect manual purchases, reset timers
7. **Reschedule** — `setTimeout(autoLoop, interval)`

---

## Action Handler Execution Order

**File:** `src/Service/AutoLoopActions.ts` (1040 LoC). Definitions are imported into `AutoLoop.ts` and executed sequentially in `AutoLoop.ts:263-296`.

Each handler checks `ctx.busy` (skip if true), validates preconditions, executes module, sets `ctx.busy = true`. The fixed sequence guarantees that only one navigating handler runs per iteration.

Total: **33 handlers** (verified in v7.35.10).

| Priority | Handler | Purpose |
|----------|---------|---------|
| 1 | handleEventParsing | Parse event pages, populate `Temp_eventsList` |
| 2 | handleMythicWave | Mythic fight waves |
| 3 | handleShop | Shop inventory parse + auto-buy |
| 4 | handleAutoEquipBoosters | Booster equipping |
| 5 | handleHaremSize | Harem size cache |
| 6 | handlePlaceOfPower | Place of Power fights |
| 7 | handleGenericBattle | Generic battle dispatch (Pantheon/Penta/Labyrinth/etc.) |
| 8 | handleLoveRaid | Love raid fights |
| 9 | handleTrollBattle | Troll fights (incl. Mythic + Sandalwood) |
| 10 | handlePachinko | Free Pachinko spin |
| 11 | handleContest | Contest ranking + reward collect |
| 12 | handleMissions | Daily missions |
| 13 | handleQuest | Adventure quest stepper |
| 14 | handleLeague | League battles |
| 15 | handleSeason | Season battles |
| 16 | handlePentaDrill | Penta Drill battles |
| 17 | handlePantheon | Pantheon battles |
| 18 | handleChampionTicket | Champion ticket usage |
| 19 | handleChampion | Champion fights |
| 20 | handleClubChampion | Club Champion fights |
| 21 | handleSeasonCollect | Season reward collect |
| 22 | handlePentaDrillCollect | Penta Drill reward collect |
| 23 | handleSeasonalFreeCard | Seasonal free card claim |
| 24 | handleSeasonalEventCollect | Seasonal Event collect |
| 25 | handleSeasonalRankCollect | Seasonal rank reward collect |
| 26 | handlePoVCollect | Path of Valor reward collect |
| 27 | handlePoGCollect | Path of Glory reward collect |
| 28 | handleFreeBundles | Free Bundles claim |
| 29 | handleDailyGoals | Daily Goals collect |
| 30 | handleLabyrinth | Labyrinth runs |
| 31 | handleSalary | Harem salary collect |
| 32 | handleBossBangParse | Boss Bang event parsing |
| 33 | handleBossBangFight | Boss Bang fight |
| 34 | handleGoHome | Navigate back to home (loop end) |

Note: handleEventParsing through handleGoHome = 33 actual handlers despite indexing to 34 (handleGoHome is the navigation tail, not an "action" in the gameplay sense — it counts as #33 of the action handlers if handleEventParsing is #1).

---

## Page-Specific UI Handlers

**File:** `src/Service/AutoLoopPageHandlers.ts`

Run after action handlers every iteration via `handlePageSpecific(ctx)`. Read-only display operations:
- Parse visible page data, add HHAuto overlays
- Show reward previews, opponent info, timer displays
- Set up page-specific features (league simulations, labyrinth UI)
- Do NOT navigate away from current page

---

## Directory Structure

```
src/
  index.ts                    -- Entry point
  Service/                    -- 16 files
    index.ts                  -- Barrel export
    AutoLoop.ts               -- Main loop (335 LoC)
    AutoLoopActions.ts        -- Action handler implementations (1040 LoC, 33 handlers)
    AutoLoopContext.ts        -- Per-iteration context object (busy flag, page, energy, event IDs)
    AutoLoopPageHandlers.ts   -- Page-specific UI (read-only display)
    StartService.ts           -- One-time init, version migration, menu
    ParanoiaService.ts        -- Anti-detection pauses
    PageNavigationService.ts  -- In-game navigation
    InfoService.ts            -- pInfo panel (timers, resources)
    MouseService.ts           -- Pause on user interaction
    AdsService.ts             -- Ad suppression
    TooltipService.ts         -- Menu tooltips
    FeaturePopupService.ts    -- "What's New" popups
    SurveyService.ts          -- User surveys
    TeamScoringService.ts     -- Team scoring (Tier-3, synergies, Tier-5, rarity filter)
    TeamBuilderService.ts     -- Team builder (trait groups, leader, slot-fill)
  Module/                     -- 25 root files
    index.ts
    TeamModule.ts             -- Team management & selection (dispatch v3/Legacy)
    League.ts                 -- League battles
    Troll.ts                  -- Troll fights
    Labyrinth.ts              -- Labyrinth
    LabyrinthAuto.ts          -- Labyrinth automation
    Champion.ts               -- Champion fights
    ClubChampion.ts           -- Club Champion
    PentaDrill.ts             -- Penta drill
    Pantheon.ts               -- Pantheon
    Spreadsheet.ts            -- Spreadsheet links + get_girls_blessings API interception
    GenericBattle.ts          -- Battle dispatch shared logic
    Booster.ts                -- Booster auto-equip + status caching (uses onAjaxResponse)
    Bundles.ts                -- Free bundle collection
    Club.ts                   -- Club info
    Contest.ts                -- Contest reward collection
    DailyGoals.ts             -- Daily goal collection
    Market.ts                 -- Market / shop helpers
    Missions.ts               -- Mission stepper
    MonthlyCard.ts            -- Monthly card login bonus
    Pachinko.ts               -- Free Pachinko
    PlaceOfPower.ts           -- Place of Power
    Quest.ts                  -- Adventure quest
    RelicManager.ts           -- Relic system
    Shop.ts                   -- Shop inventory parsing
    harem/                    -- 5 files
      index.ts
      Harem.ts                -- Girl data loading & caching
      HaremGirl.ts            -- Individual girl operations
      HaremSalary.ts          -- Salary collection
      HaremFilter.ts          -- Harem filtering UI
    Events/                   -- 16 files (Events subsystem)
      index.ts
      EventModule.ts          -- Top-level event dispatcher
      Season.ts               -- Season event battles
      Seasonal.ts             -- Seasonal event collect
      MythicEvent.ts          -- Mythic event handling
      LoveRaidManager.ts      -- Love Raid logic
      BossBang.ts             -- Boss Bang event
      PathOfAttraction.ts     -- Path of Attraction
      PathOfGlory.ts          -- Path of Glory
      PathOfValue.ts          -- Path of Valor (file name typo: "Value")
      PlusEvents.ts           -- Generic +Event handler
      KinkyCumpetition.ts     -- Kinky Cumpetition event
      CumbackContests.ts      -- Cumback Contests
      DoublePenetration.ts    -- DP event
      LivelyScene.ts          -- Lively Scene event
      SultryMysteries.ts      -- Sultry Mysteries event
  Helper/                     -- 17 files
    index.ts
    StorageHelper.ts          -- localStorage/sessionStorage abstraction
    TimerHelper.ts            -- Timer management
    TimeHelper.ts              -- Date/time utilities
    PageHelper.ts             -- Page detection (`getPage()`)
    HeroHelper.ts             -- Hero stats (level, energy)
    HHHelper.ts               -- Game utility (`getHHVars` bridge to `unsafeWindow`)
    HHMenuHelper.ts           -- Settings menu UI
    BDSMHelper.ts             -- Battle simulation
    ConfigHelper.ts           -- Game variant config
    ButtonHelper.ts           -- DOM button helpers
    RewardHelper.ts           -- Reward parsing
    NumberHelper.ts           -- Number formatting
    LanguageHelper.ts         -- i18n loader
    PriceHelper.ts            -- Koban / cost helpers
    UrlHelper.ts              -- URL parsing
    WindowHelper.ts           -- `unsafeWindow` access wrappers
  Utils/
    index.ts
    Utils.ts                  -- `onAjaxResponse` (jQuery `ajaxComplete` hook), `logHHAuto`
  config/
    index.ts
    HHEnvVariables.ts         -- Singleton env (page IDs in lines 211-416, game config, feature flags) (543 LoC)
    HHStoredVars.ts           -- Storage key registry with defaults, validation, UI metadata
    StorageKeys.ts            -- 179 SK + 89 TK constants (385 LoC)
    game/                     -- 8 per-game-variant config files
      index.ts
      HentaiHeroesVars.ts     -- hh_hentai (HH, NHH, THH, EHH, OGHH, HH_test)
      ComixHaremVars.ts       -- hh_comix (CH, NCH)
      PornstarHaremVars.ts    -- hh_star (PH, NPH)
      TransPornstarHaremVars.ts -- hh_startrans (TPH, NTPH)
      GayHaremVars.ts         -- hh_gay (GH, NGH, EGH)
      GayPornstarHaremVars.ts -- hh_stargay (GPSH, NGPSH)
      MangaRpgVars.ts         -- hh_mangarpg (MRPG, NMRPG)
      AmourAgentVars.ts       -- hh_amour (AA)
      (HornyHeroes / hh_sexy / SH_prod is wired directly in HHEnvVariables.ts, not as a separate file)
  model/
    index.ts
    TeamData.ts               -- Team structure (7 girls + scroll counts)
    BDSMPlayer.ts             -- Battle player model
    BDSMSimu.ts               -- Battle simulation result
    KK/
      KKHaremGirl.ts          -- Girl data class (64 declared TS fields, raw API can have more)
      KKTeamGirl.ts           -- Team member wrapper
      KKHero.ts               -- Player/Hero model
      KKLeagueOpponent.ts     -- Opponent model (`girls_count_per_element`)
  i18n/
    en.ts, fr.ts, es.ts, ...  -- Translations (incl. tooltip texts)
```

Note: 37 spec files in `spec/` (`*.spec.ts`) with 510 total tests across all suites.

---

## Module Pattern

All modules are **static-only classes** (no instantiation):

```
IModuleStatic           -- Base: isEnabled(), isActivated()
  IRunnableModuleStatic -- Adds: run()
    IBattleModuleStatic -- Adds: isTimeToFight(), getEnergy(), getEnergyMax()
```

---

## Key Architectural Patterns

| Pattern | Description |
|---------|-------------|
| **Singleton Modules** | Static classes, no instances — single state throughout script lifetime |
| **Context-Driven Loop** | `AutoLoopContext` shared across handlers per iteration |
| **Priority Sequencing** | Fixed handler order; `ctx.busy` prevents multiple navigations per tick |
| **Storage-as-State** | All settings + runtime state in browser storage with prefix isolation |
| **Lazy Init** | Services/modules instantiated on first use (`callItOnce`) |
| **AJAX Interception** | `onAjaxResponse(regex, callback)` hooks into jQuery's `ajaxComplete` |
| **Game Variant System** | Per-domain config with feature flags and troll lists |

---

## Supported Games

| Game | Primary Domain | Game ID | Env Name |
|------|----------------|---------|----------|
| Hentai Heroes | www.hentaiheroes.com | hh_hentai | HH_prod |
| Comix Harem | www.comixharem.com | hh_comix | CH_prod |
| Pornstar Harem | www.pornstarharem.com | hh_star | PH_prod |
| Trans Pornstar Harem | www.transpornstarharem.com | hh_startrans | TPH_prod |
| Gay Harem | www.gayharem.com | hh_gay | GH_prod |
| Gay Pornstar Harem | www.gaypornstarharem.com | hh_stargay | GPSH_prod |
| Manga RPG | www.mangarpg.com | hh_mangarpg | MRPG_prod |
| Amour Agent | www.amouragent.com | hh_amour | AA_prod |
| Horny Heroes | www.hornyheroes.com | hh_sexy | SH_prod (reduced features) |

Additional alias / Nutaku / test domains share the same Game ID but differ in `name` (env). Examples:
- `nutaku.haremheroes.com` → name `NHH_prod`, id `hh_hentai`
- `test.hentaiheroes.com` → name `HH_test`, id `hh_hentai`
- `thrix.hentaiheroes.com`, `eroges.hentaiheroes.com`, `esprit.hentaiheroes.com` → all id `hh_hentai`
- `nutaku.comixharem.com` → name `NCH_prod`, id `hh_comix`
- `nutaku.pornstarharem.com`, `nutaku.transpornstarharem.com`, `nutaku.gayharem.com`, `eroges.gayharem.com`, `nutaku.gaypornstarharem.com`, `nutaku.mangarpg.com` — all share their respective Game IDs

Game ID is what `getPage()` reads from the DOM via `document.getElementById(gameID).getAttribute('page')`.
