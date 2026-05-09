---
last-verified: 2026-05-05
verified-against-version: 7.35.21
status: current
---

# HHauto Script Architecture

Referenz-Doku zur Skript-Struktur, Modul-System und Execution-Flow.
Letzte vollstaendige Verifikation: 2026-05-05 gegen v7.35.21.

---

## Entry-Point & Initialisierung

**Datei:** `src/index.ts`

- IIFE ruft `hardened_start()` direkt beim Skript-Load auf
- Fallback `setTimeout(hardened_start, 5000)` falls das Game-JS noch nicht geladen ist
- Erweitert das globale `Window`-Interface um spielspezifische Properties (`championData`, `harem`, `hero_data`, `love_raids`, etc.) -- gelesen via `unsafeWindow`

---

## Main-Loop: AutoLoop

**Datei:** `src/Service/AutoLoop.ts` (335 LoC)

Rekursiver `setTimeout`-Loop (typisch ~1 Sekunde Intervall):

1. **Burst-Check** -- Master-Switch on, Menu zu, Paranoia nicht in Pause
2. **Update Context** -- befuellt `AutoLoopContext` mit aktueller Page, Energie, Event-IDs
3. **Action-Handler ausfuehren** in Prioritaets-Reihenfolge -- maximal ein Navigations-Handler pro Iteration ueber `ctx.busy`
4. **Page-Specific UI-Handler** -- Display-Overlays, unabhaengig vom Burst-State
5. **Scheduler-Pipeline** -- die neue, deklarative Handler-Pipeline fuer migrierte Handler (siehe unten)
6. **Paranoia managen** -- Anti-Detection-Pausen
7. **Energie tracken** -- manuelle Kaeufe erkennen, Timer zuruecksetzen
8. **Reschedule** -- `setTimeout(autoLoop, interval)`

---

## Action-Handler (klassisch)

**Datei:** `src/Service/AutoLoopActions.ts` (979 LoC). Definitionen werden in `AutoLoop.ts` importiert und sequenziell ausgefuehrt.

Jeder Handler prueft `ctx.busy` (skip wenn true), validiert Vorbedingungen, fuehrt sein Modul aus und setzt `ctx.busy = true`. Die feste Reihenfolge garantiert, dass nur ein navigierender Handler pro Iteration laeuft.

**Total: 32 Handler im klassischen Loop (verifiziert v7.35.21).**

| # | Handler | Zweck |
|---|---------|-------|
| 1 | handleMythicWave | Mythic-Fight-Wellen |
| 2 | handleShop | Shop-Inventory-Parse + Auto-Buy |
| 3 | handleAutoEquipBoosters | Booster equippen |
| 4 | handleHaremSize | Harem-Groesse-Cache |
| 5 | handlePlaceOfPower | Place-of-Power-Fights |
| 6 | handleGenericBattle | Generic-Battle-Dispatch (Pantheon/Penta/Labyrinth/...) |
| 7 | handleLoveRaid | Love-Raid-Fights |
| 8 | handleTrollBattle | Troll-Fights (inkl. Mythic + Sandalwood) |
| 9 | handlePachinko | Free-Pachinko-Spin |
| 10 | handleContest | Contest-Ranking + Reward-Collect |
| 11 | handleMissions | Daily-Missions |
| 12 | handleQuest | Adventure-Quest-Stepper |
| 13 | handleSeason | Season-Battles |
| 14 | handlePentaDrill | Penta-Drill-Battles |
| 15 | handlePantheon | Pantheon-Battles |
| 16 | handleChampionTicket | Champion-Ticket-Verbrauch |
| 17 | handleChampion | Champion-Fights |
| 18 | handleClubChampion | Club-Champion-Fights |
| 19 | handleSeasonCollect | Season-Reward-Collect |
| 20 | handlePentaDrillCollect | Penta-Drill-Reward-Collect |
| 21 | handleSeasonalFreeCard | Seasonal-Free-Card-Claim |
| 22 | handleSeasonalEventCollect | Seasonal-Event-Collect |
| 23 | handleSeasonalRankCollect | Seasonal-Rank-Reward-Collect |
| 24 | handlePoVCollect | Path-of-Valor-Reward-Collect |
| 25 | handlePoGCollect | Path-of-Glory-Reward-Collect |
| 26 | handleFreeBundles | Free-Bundles-Claim |
| 27 | handleDailyGoals | Daily-Goals-Collect |
| 28 | handleLabyrinth | Labyrinth-Runs |
| 29 | handleSalary | Harem-Salary-Collect |
| 30 | handleBossBangParse | Boss-Bang-Event-Parsing |
| 31 | handleBossBangFight | Boss-Bang-Fight |
| 32 | handleGoHome | Navigation zurueck zu Home (Loop-Ende) |

`handleGoHome` ist streng genommen kein "Action"-Handler im Gameplay-Sinn, sondern der Tail des Action-Loops, der die Navigation auf eine neutrale Seite zurueckfaehrt.

### Migrierte Handler -> Scheduler-Pipeline

Folgende Handler sind aus dem klassischen Loop **entfernt** und in die neue Scheduler-Pipeline (siehe naechster Abschnitt) verschoben:

- `handleEventParsing` -- Event-Pages parsen, `Temp_eventsList` befuellen (Priority 1)
- `handleLeague` -- League-Battles (Priority 13)

Beide laufen jetzt am Loop-Ende ueber `await scheduler.tick()`.

---

## Scheduler-Pipeline (deklarativ)

**Dateien:**
- `src/Service/Scheduler.ts` -- Runtime, State-Machine
- `src/Service/Pipeline.config.ts` -- Handler-Definitionen, Pipeline-Liste

Die Pipeline ist der Anfang einer schrittweisen Migration vom imperativen Action-Loop zu einem deklarativen, prioritaets-gesteuerten Scheduler. Jeder Handler ist eine `HandlerConfig`-Struktur mit Schritten, Prioritaet, Mindest-Intervall und Atomicitaets-Semantik.

State-Maschine pro Handler:

```
IDLE -> RUNNING -> COMPLETED|FAILED|INTERRUPTED -> IDLE
```

Aktuell migrierte Handler:

| Priority | Name | Atomicity | Notiz |
|----------|------|-----------|-------|
| 1 | handleEventParsing | non-atomic | laeuft fast jeden Tick, `minIntervalMs: 2000` |
| 13 | handleLeague | atomic | Fight-Sequenz darf nicht unterbrochen werden, `minIntervalMs: 60000`, `totalTimeoutMs: 30000` |

### Pipeline-vs-Klassische-Handler: lastActionPerformed-Guard

Pipeline-Handler haben (im Gegensatz zu klassischen AutoLoop-Handlern) **keinen Zugriff** auf `ctx.lastActionPerformed`. Sie reichern ihren Storage-Read selbst an.

Konkret in `LeagueHelper.doLeagueBattle()`: bevor von einer fremden Page (z.B. Quest) auf das Leaderboard navigiert wird, wird `Temp_lastActionPerformed` gelesen. Ist es weder `none` noch `league`, wird die Navigation unterdrueckt. Sonst wuerde ein klassischer Handler (z.B. `handleQuest`), der gerade auf seiner Page hantiert aber `ctx.busy=false` setzt (z.B. weil ein Button noch in einer Animation ist), die League-Pipeline triggern, die dann blind eine Gegen-Navigation startet -- klassischer Pingpong-Loop (issue #1664).

Der `navInFlight`-Mutex aus issue #1598 verhindert nur Doppelnavigationen im **selben** Heartbeat. Cross-Heartbeat-Pingpongs zwischen klassischen Handlern und Pipeline-Handlern brauchen den `lastActionPerformed`-Guard zusaetzlich.

Aufruf am Ende jeder AutoLoop-Iteration via `await scheduler.tick()`.

Watchdog: Ueberhaengende Chains werden nach `totalTimeoutMs` killed. SOFT/HARD Interrupts: `interruptible === 'always'`-Handler werden von hoeher-priorisierten Handlern preempted.

---

## Page-Specific UI-Handler

**Datei:** `src/Service/AutoLoopPageHandlers.ts`

Laufen nach den Action-Handlern in jeder Iteration via `handlePageSpecific(ctx)`. Read-only Display-Operationen:
- aktuelle Page-Daten parsen, HHAuto-Overlays hinzufuegen
- Reward-Previews, Gegner-Info, Timer-Anzeigen
- Page-spezifische Features einrichten (League-Simulationen, Labyrinth-UI)
- navigieren NICHT von der aktuellen Page weg

---

## Verzeichnisstruktur (verifiziert v7.35.21)

```
src/
  index.ts                           -- Entry-Point
  Service/                           -- 20 Dateien
    index.ts                         -- Barrel-Export
    AutoLoop.ts                      -- Main-Loop (336 LoC)
    AutoLoopActions.ts               -- Action-Handler-Implementierungen (980 LoC, 32 Handler)
    AutoLoopContext.ts               -- Per-Iteration-Context (busy, page, energy, event IDs)
    AutoLoopPageHandlers.ts          -- Page-spezifische UI (read-only)
    Scheduler.ts                     -- Pipeline-Scheduler-Runtime
    Pipeline.config.ts               -- Pipeline-Handler-Definitionen
    StartService.ts                  -- One-Time-Init, Version-Migration, Menu
    ParanoiaService.ts               -- Anti-Detection-Pausen
    PageNavigationService.ts         -- In-Game-Navigation
    InfoService.ts                   -- pInfo-Panel (Timers, Resources)
    MouseService.ts                  -- Pause bei User-Interaktion
    AdsService.ts                    -- Ad-Suppression
    TooltipService.ts                -- Menu-Tooltips
    FeaturePopupService.ts           -- "What's New"-Popups
    SurveyService.ts                 -- User-Surveys
    BlessingService.ts               -- Blessing-Daten-Abruf + 12h-Cache (TK.blessingsCache)
    TeamScoringService.ts            -- Team-Scoring (main_carac, Tier-3, Synergien, Tier-5, Klassen-Filter)
    TeamBuilderService.ts            -- Team-Builder (Cluster-Vergleich, Slot-Fill, Alternativen)
    TraitMappings.ts                 -- Hex/Position/Zodiac -> Klar-Namen via window.GT.design + Fallback

  Module/                            -- 25 Root-Dateien (24 Module + index.ts)
    index.ts
    TeamModule.ts                    -- Team-Management & -Auswahl (Dispatch v4/Legacy)
    League.ts                        -- League-Battles
    Troll.ts                         -- Troll-Fights
    Labyrinth.ts                     -- Labyrinth
    LabyrinthAuto.ts                 -- Labyrinth-Automation
    Champion.ts                      -- Champion-Fights
    ClubChampion.ts                  -- Club-Champion
    PentaDrill.ts                    -- Penta-Drill
    Pantheon.ts                      -- Pantheon
    Spreadsheet.ts                   -- Spreadsheet-Links + get_girls_blessings-API-Interception
    GenericBattle.ts                 -- Battle-Dispatch shared logic
    Booster.ts                       -- Booster-Auto-Equip + Status-Caching (nutzt onAjaxResponse)
    Bundles.ts                       -- Free-Bundle-Collection
    Club.ts                          -- Club-Info
    Contest.ts                       -- Contest-Reward-Collection
    DailyGoals.ts                    -- Daily-Goal-Collection
    Market.ts                        -- Market/Shop-Helpers
    Missions.ts                      -- Mission-Stepper
    MonthlyCard.ts                   -- Monthly-Card-Login-Bonus
    Pachinko.ts                      -- Free-Pachinko
    PlaceOfPower.ts                  -- Place-of-Power
    Quest.ts                         -- Adventure-Quest
    RelicManager.ts                  -- Relic-System
    Shop.ts                          -- Shop-Inventory-Parsing
    harem/                           -- 5 Dateien
      index.ts
      Harem.ts                      -- Girl-Daten-Loading & -Caching
      HaremGirl.ts                  -- Einzelne-Girl-Operationen
      HaremSalary.ts                -- Salary-Collection
      HaremFilter.ts                -- Harem-Filtering-UI
    Events/                          -- 16 Dateien (Events-Subsystem)
      index.ts
      EventModule.ts                 -- Top-Level-Event-Dispatcher
      Season.ts                      -- Season-Event-Battles
      Seasonal.ts                    -- Seasonal-Event-Collect
      MythicEvent.ts                 -- Mythic-Event-Handling
      LoveRaidManager.ts             -- Love-Raid-Logik
      BossBang.ts                    -- Boss-Bang-Event
      PathOfAttraction.ts            -- Path of Attraction
      PathOfGlory.ts                 -- Path of Glory
      PathOfValue.ts                 -- Path of Valor (Dateiname-Tippfehler: "Value")
      PlusEvents.ts                  -- Generischer +Event-Handler
      KinkyCumpetition.ts            -- Kinky-Cumpetition-Event
      CumbackContests.ts             -- Cumback-Contests
      DoublePenetration.ts           -- DP-Event
      LivelyScene.ts                 -- Lively-Scene-Event
      SultryMysteries.ts             -- Sultry-Mysteries-Event

  Helper/                            -- 17 Dateien
    index.ts
    StorageHelper.ts                 -- localStorage/sessionStorage-Abstraktion
    TimerHelper.ts                   -- Timer-Management
    TimeHelper.ts                    -- Date/Time-Utilities
    PageHelper.ts                    -- Page-Detection (`getPage()`)
    HeroHelper.ts                    -- Hero-Stats (Level, Energie)
    HHHelper.ts                      -- Game-Utility (`getHHVars` Bridge zu `unsafeWindow`)
    HHMenuHelper.ts                  -- Settings-Menu-UI
    BDSMHelper.ts                    -- Battle-Simulation
    ConfigHelper.ts                  -- Game-Variant-Config
    ButtonHelper.ts                  -- DOM-Button-Helpers
    RewardHelper.ts                  -- Reward-Parsing
    NumberHelper.ts                  -- Number-Formatting
    LanguageHelper.ts                -- i18n-Loader
    PriceHelper.ts                   -- Koban-/Cost-Helpers
    UrlHelper.ts                     -- URL-Parsing
    WindowHelper.ts                  -- `unsafeWindow`-Access-Wrappers

  Utils/                             -- 5 Dateien
    index.ts
    Utils.ts                         -- `onAjaxResponse` (jQuery `ajaxComplete`-Hook)
    LogUtils.ts                      -- `logHHAuto`
    BrowserUtils.ts                  -- Browser-Detection
    HHPopup.ts                       -- Popup-Display

  config/                            -- 5 Dateien (+ game/-Subordner)
    index.ts
    HHEnvVariables.ts                -- Singleton-Env (52 Page-IDs, Game-Config, Feature-Flags) (544 LoC)
    HHStoredVars.ts                  -- Storage-Key-Registry mit Defaults, Validation, UI-Metadaten
    StorageKeys.ts                   -- 179 SK + 90 TK Konstanten (387 LoC)
    InputPattern.ts                  -- Input-Validation-Patterns (Regex)
    game/                            -- 9 Per-Game-Variant-Config-Dateien
      index.ts
      HentaiHeroesVars.ts            -- hh_hentai (HH, NHH, THH, EHH, OGHH, HH_test)
      ComixHaremVars.ts              -- hh_comix (CH, NCH)
      PornstarHaremVars.ts           -- hh_star (PH, NPH)
      TransPornstarHaremVars.ts      -- hh_startrans (TPH, NTPH)
      GayHaremVars.ts                -- hh_gay (GH, NGH, EGH)
      GayPornstarHaremVars.ts        -- hh_stargay (GPSH, NGPSH)
      MangaRpgVars.ts                -- hh_mangarpg (MRPG, NMRPG)
      AmourAgentVars.ts              -- hh_amour (AA)
      (HornyHeroes / hh_sexy / SH_prod ist direkt in HHEnvVariables.ts verdrahtet)

  model/                             -- 12 Root-Dateien
    index.ts
    TeamData.ts                      -- Team-Struktur (7 Girls + Scroll-Counts)
    BDSMPlayer.ts                    -- Battle-Player-Modell
    BDSMSimu.ts                      -- Battle-Simulation-Resultat
    Champion.ts                      -- Champion-Modell
    EventGirl.ts                     -- Event-Girl-Wrapper
    HHEvent.ts                       -- HHEvent-Modell
    IModule.ts                       -- Modul-Interfaces
    LeagueOpponent.ts                -- League-Gegner-Wrapper
    LoveRaid.ts                      -- Love-Raid-Modell
    Mission.ts                       -- Mission-Modell
    SeasonOpponent.ts                -- Season-Gegner-Wrapper
    KK/                              -- 12 Game-API-Wrapper-Dateien
      index.ts
      KKHaremGirl.ts                 -- Girl-Daten-Klasse (62 Felder pro Girl im API)
      KKTeamGirl.ts                  -- Team-Member-Wrapper
      KKHero.ts                      -- Player/Hero-Modell
      KKLeagueOpponent.ts            -- League-Gegner-Modell (mit `girls_count_per_element`)
      KKHaremSalaryGirl.ts           -- Salary-Manager-Girl-Wrapper
      KKEventGirl.ts                 -- Event-Girl-Daten
      KKEnergy.ts                    -- Energie-Wrapper
      KKLoveRaid.ts                  -- Love-Raid-Daten
      KKPentaDrillOpponents.ts       -- Penta-Drill-Gegner
      KKPuzzlePieces.ts              -- LivelyScene-Puzzle-Pieces
      kkDailyGoal.ts                 -- DailyGoal-Daten

  i18n/                              -- 6 Dateien
    index.ts
    en.ts, de.ts, fr.ts, es.ts       -- Sprachen
    empty.ts                         -- Leeres-Default-Modell

spec/                                -- 39 Spec-Dateien (542 Tests, 8 skipped)
```

---

## Modul-Pattern

Alle Module sind **statische Klassen** (keine Instanziierung):

```
IModuleStatic           -- Basis: isEnabled(), isActivated()
  IRunnableModuleStatic -- erweitert: run()
    IBattleModuleStatic -- erweitert: isTimeToFight(), getEnergy(), getEnergyMax()
```

---

## Architektur-Patterns

| Pattern | Beschreibung |
|---------|-------------|
| **Singleton-Module** | statische Klassen, keine Instanzen -- ein State pro Skript-Lifetime |
| **Context-Driven Loop** | `AutoLoopContext` wird pro Iteration unter den Handlern geteilt |
| **Priority-Sequencing** | feste Handler-Reihenfolge; `ctx.busy` verhindert mehrere Navigationen pro Tick |
| **Storage-as-State** | alle Settings + Runtime-State im Browser-Storage mit Prefix-Isolation |
| **Lazy Init** | Services/Module werden bei Erstnutzung initialisiert (`callItOnce`) |
| **AJAX-Interception** | `onAjaxResponse(regex, callback)` haengt sich in jQuery `ajaxComplete` ein |
| **Game-Variant-System** | Per-Domain-Config mit Feature-Flags und Troll-Listen |
| **Declarative-Pipeline (neu)** | Scheduler + Pipeline.config -- migrierter Loop-Teil mit State-Machine, Watchdog, Interrupts |

---

## Unterstuetzte Spiele

| Spiel | Primaere Domain | Game-ID | Env-Name |
|-------|------------------|---------|----------|
| Hentai Heroes | www.hentaiheroes.com | hh_hentai | HH_prod |
| Comix Harem | www.comixharem.com | hh_comix | CH_prod |
| Pornstar Harem | www.pornstarharem.com | hh_star | PH_prod |
| Trans Pornstar Harem | www.transpornstarharem.com | hh_startrans | TPH_prod |
| Gay Harem | www.gayharem.com | hh_gay | GH_prod |
| Gay Pornstar Harem | www.gaypornstarharem.com | hh_stargay | GPSH_prod |
| Manga RPG | www.mangarpg.com | hh_mangarpg | MRPG_prod |
| Amour Agent | www.amouragent.com | hh_amour | AA_prod |
| Horny Heroes | www.hornyheroes.com | hh_sexy | SH_prod (reduzierte Features) |

Zusaetzliche Alias-, Nutaku- und Test-Domains teilen die Game-ID, unterscheiden sich aber im `name` (Env). Beispiele:

- `nutaku.haremheroes.com` -> name `NHH_prod`, id `hh_hentai`
- `test.hentaiheroes.com` -> name `HH_test`, id `hh_hentai`
- `thrix.hentaiheroes.com`, `eroges.hentaiheroes.com`, `esprit.hentaiheroes.com` -> id `hh_hentai`
- `nutaku.comixharem.com` -> name `NCH_prod`, id `hh_comix`
- `nutaku.pornstarharem.com`, `nutaku.transpornstarharem.com`, `nutaku.gayharem.com`, `eroges.gayharem.com`, `nutaku.gaypornstarharem.com`, `nutaku.mangarpg.com` -- jeweils mit ihrer Game-ID

Game-ID ist das, was `getPage()` aus dem DOM via `document.getElementById(gameID).getAttribute('page')` liest -- d.h. die Iframe-ID (siehe `runtime-architecture.md`).