---
last-verified: 2026-09-11
verified-against-version: 8.13.1
status: current
---

# Storage keys reference

Every localStorage / sessionStorage key of the HHauto script.

**Cross-checked (2026-09-11, 8.13.1).** Every table row -- constant, storage
key, storage type, HHType -- agrees with `StorageKeys.ts` and `HHStoredVars.ts`;
`npm run check:docs` holds that every constant appears here. Counts
deliberately no longer stand here: they trailed the code every time, and
`check:docs` names them.

**Where they are stored, measured 2026-09-11** after a page tour with HHauto on
the test account: 233 `HHAuto_*` keys in the browser, 230 of them in the store
the registry prescribes (`Storage()` without `settPerTab` = localStorage). The
other three: `Temp_LogIdx` and `Temp_Log0` (the log ring, deliberately not
registered, see below) and `Temp_Debug` (see its row). The descriptions are
**not** checked individually against the behaviour; where a row makes a
checkable statement (a default, a range), it says whether that was measured or
read from the code.

---

## Architecture

### Files

- `src/config/StorageKeys.ts` -- the SK and TK constants (the definitions)
- `src/config/HHStoredVars.ts` -- the registry with defaults, validation and UI metadata
- `src/Helper/StorageHelper.ts` -- the storage abstraction layer

### The prefix system

- Every key is prefixed with `HHStoredVarPrefixKey` (= `"HHAuto_"`)
- Example: `HHStoredVarPrefixKey + SK.master` becomes `"HHAuto_Setting_master"`

### The storage type

Three possible values for the `storage` field in `HHStoredVars.ts`:

| Value | Meaning |
|---|---|
| `"localStorage"` | persistent, survives a browser restart |
| `"sessionStorage"` | the current tab only |
| `"Storage()"` | chosen at runtime by `SK.settPerTab`: when it is on -> sessionStorage, otherwise localStorage |

### HHType

| HHType | Meaning |
|---|---|
| `Setting` | a user setting (visible in the UI) |
| `Temp` | runtime state (internal) |

### The core functions (`StorageHelper.ts`)

- `getStoredValue(key)` -- read a value. Returns `undefined` when the key is not registered in `HHStoredVars`.
- `setStoredValue(key, value)` -- write a value. On a storage-full error: one cleanup retry. Unregistered keys are discarded without an error.
- `deleteStoredValue(key)` -- delete a value.
- `getStoredJSON<T>(key, default, reviver?)` -- parse JSON with a fallback to the default on a parse **error**. Careful: the type parameter is erased at runtime. `JSON.parse` also succeeds on `"null"`, `"5"` or `"{}"`, so a `<string[]>` read returns exactly those values instead of the default. The default only applies when the key is missing or the JSON is broken.
- `getStoredArray<T>(key)` -- read array-typed settings. Checks `Array.isArray()` and returns `[]` otherwise. Use it for every setting whose result has `.includes()` or the like called on it (see below).
- `getStorage()` -- the current default storage, depending on `SK.settPerTab`.
- `getStorageItem(type)` -- the resolver for `"localStorage"` / `"sessionStorage"` / `"Storage()"`.

### Array and list fields

For JSON arrays use `getStoredArray` (see above). For the `;`-separated text
lists: the syntax belongs defined **once** and read by the input field and the
runtime together. `autoBuyBoostersFilter` does that through `BUY_LIST_PATTERN`
in `Module/Market.pure.ts` since 8.11.0. Before that the field regex and the
parser stood apart, with the result that `MB10` could not be entered for years
although the tooltip listed it (#1844).

Careful with the red: `input[pattern]` is coloured red generically in
`StartService`, but saving does **not** check validity. Whoever wants a red
field to actually prevent something has to do that in the module itself --
`autoBuyBoostersFilter` is so far the only field that does, because kobans are
spent there.

### The value `"null"` (issue #1846)

`extractHHVars` deliberately serialises a key that was never written as `null`,
so that a debug log can tell "never set" from "not exported".
`saveHHVarsSettingsAsJSON` uses the same function, and the config import used to
write those null values straight into web storage -- which turns them into the
string `"null"`. A simple save/load round trip of the settings file was
therefore enough to set every untouched setting to `"null"`; `setDefaults` does
not repair that, because the list settings have no `isValid` regex.

Since 8.10.1 the importer (`myfileLoad_onReaderLoad`) and `debugDeleteTempVars`
skip null values, and the lists are read through `getStoredArray`. Whoever adds
a new array setting: use `getStoredArray`, not `getStoredJSON<T[]>(key, [])`.

### Registration is mandatory

A constant in `StorageKeys.ts` (SK or TK) alone is **not enough**. The matching
entry in `HHStoredVars.ts` with `storage`, `HHType`, `default` and so on is
required. A missing registration is silently ignored at runtime -- reading
returns `undefined`, writing is dropped.

The `kobanUsing: true` flag on a setting additionally ties it to the global
switch `SK.spendKobans0`: when the master switch is off, `getStoredValue`
always returns `"false"`, whatever the stored value is.

### Migration

`migrateHHVars()` in `StorageHelper.ts` is currently commented out. When a
setting key is renamed (`Setting_MaxAff` -> `Setting_maxAff`, say), a mapping
can be entered here so that old storage entries are copied into the new key
automatically.

---

> **Code references:** where a key is read or written is answered more reliably
> by a `grep` for the SK/TK constant than by a maintained table. Such a table
> stood in data-sources-inventory.md until 2026-09-01 and was nine keys behind
> at that point.

## SK -- Setting Keys

The complete list of SK constants, in the order of `StorageKeys.ts`. Source: the code, generated automatically. The descriptions are carried over from the previous version of this document.

The "Storage" column shows the value from the registry. `--` means: not registered in `HHStoredVars.ts` (the key does not work).

### Master switch

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `master` | `Setting_master` | `Storage()` | `Setting` | the master switch on/off |
| `settPerTab` | `Setting_settPerTab` | `localStorage` | `Setting` | sessionStorage instead of localStorage |
| `spendKobans0` | `Setting_spendKobans0` | `Storage()` | `Setting` | the master switch for koban spending |

### Troll

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoTrollBattle` | `Setting_autoTrollBattle` | `Storage()` | `Setting` | troll fights enabled |
| `autoTrollThreshold` | `Setting_autoTrollThreshold` | `Storage()` | `Setting` | the minimum energy threshold |
| `autoTrollRunThreshold` | `Setting_autoTrollRunThreshold` | `Storage()` | `Setting` | the minimum runs |
| `autoTrollSelectedIndex` | `Setting_autoTrollSelectedIndex` | `Storage()` | `Setting` | the selected troll |
| `autoTrollMythicByPassParanoia` | `Setting_autoTrollMythicByPassParanoia` | `Storage()` | `Setting` | mythic ignores paranoia |
| `eventTrollOrder` | `Setting_eventTrollOrder` | `Storage()` | `Setting` | the event troll order |
| `useX10Fights` | `Setting_useX10Fights` | `Storage()` | `Setting` | use x10 fights |
| `useX10FightsAllowNormalEvent` | `Setting_useX10FightsAllowNormalEvent` | `Storage()` | `Setting` | x10 on normal events too |
| `useX50Fights` | `Setting_useX50Fights` | `Storage()` | `Setting` | use x50 fights |
| `useX50FightsAllowNormalEvent` | `Setting_useX50FightsAllowNormalEvent` | `Storage()` | `Setting` | x50 on normal events too |
| `minShardsX10` | `Setting_minShardsX10` | `Storage()` | `Setting` | the minimum shards for x10 |
| `minShardsX50` | `Setting_minShardsX50` | `Storage()` | `Setting` | the minimum shards for x50 |
| `sandalwoodMinShardsThreshold` | `Setting_sandalwoodMinShardsThreshold` | `Storage()` | `Setting` | the Sandalwood minimum shard threshold (since v7.35.x it replaces the four old keys `sandalwoodShardsX10Limit`, `sandalwoodShardsX1Limit`, `sandalwoodDosesX10Limit`, `sandalwoodDosesX1Limit`; the old keys are gone from the code as of v7.35.10) |
| `kobanBank` | `Setting_kobanBank` | `Storage()` | `Setting` | the koban reserve |
| `buyCombat` | `Setting_buyCombat` | `Storage()` | `Setting` | buy fight energy |
| `buyCombTimer` | `Setting_buyCombTimer` | `Storage()` | `Setting` | the purchase timer |
| `buyMythicCombat` | `Setting_buyMythicCombat` | `Storage()` | `Setting` | buy mythic fight energy |
| `buyMythicCombTimer` | `Setting_buyMythicCombTimer` | `Storage()` | `Setting` | the mythic purchase timer |
| `buyLoveRaidCombat` | `Setting_buyLoveRaidCombat` | `Storage()` | `Setting` | buy love raid energy |
| `autoBuyTrollNumber` | `Setting_autoBuyTrollNumber` | `Storage()` | `Setting` | auto-buy troll count |
| `autoBuyMythicTrollNumber` | `Setting_autoBuyMythicTrollNumber` | `Storage()` | `Setting` | auto-buy mythic count |
| `autoBuyLoveRaidTrollNumber` | `Setting_autoBuyLoveRaidTrollNumber` | `Storage()` | `Setting` | auto-buy love raid count |

### Champion

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoChamps` | `Setting_autoChamps` | `Storage()` | `Setting` | champion enabled |
| `autoChampsFilter` | `Setting_autoChampsFilter` | `Storage()` | `Setting` | the champion filter |
| `autoChampsForceStart` | `Setting_autoChampsForceStart` | `Storage()` | `Setting` | force the start |
| `autoChampsForceStartEventGirl` | `Setting_autoChampsForceStartEventGirl` | `Storage()` | `Setting` | force the start for an event girl |
| `autoChampsGirlThreshold` | `Setting_autoChampsGirlThreshold` | `Storage()` | `Setting` | the girl threshold |
| `autoChampsTeamLoop` | `Setting_autoChampsTeamLoop` | `Storage()` | `Setting` | team rotation |
| `autoChampsTeamKeepSecondLine` | `Setting_autoChampsTeamKeepSecondLine` | `Storage()` | `Setting` | keep the second line |
| `autoChampsUseEne` | `Setting_autoChampsUseEne` | `Storage()` | `Setting` | use energy |
| `autoChampAlignTimer` | `Setting_autoChampAlignTimer` | `Storage()` | `Setting` | align the timer |
| `autoBuildChampsTeam` | `Setting_autoBuildChampsTeam` | `Storage()` | `Setting` | build the team automatically |

### Club Champion

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoClubChamp` | `Setting_autoClubChamp` | `Storage()` | `Setting` | club champion enabled |
| `autoClubChampMax` | `Setting_autoClubChampMax` | `Storage()` | `Setting` | max fights |
| `autoClubForceStart` | `Setting_autoClubForceStart` | `Storage()` | `Setting` | force the start |

### League

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoLeagues` | `Setting_autoLeagues` | `Storage()` | `Setting` | league enabled |
| `autoLeaguesCollect` | `Setting_autoLeaguesCollect` | `Storage()` | `Setting` | collect the league rewards |
| `autoLeaguesThreshold` | `Setting_autoLeaguesThreshold` | `Storage()` | `Setting` | the minimum win chance |
| `autoLeaguesSecurityThreshold` | `Setting_autoLeaguesSecurityThreshold` | `Storage()` | `Setting` | the safety threshold |
| `autoLeaguesRunThreshold` | `Setting_autoLeaguesRunThreshold` | `Storage()` | `Setting` | the minimum runs |
| `autoLeaguesBoostedOnly` | `Setting_autoLeaguesBoostedOnly` | `Storage()` | `Setting` | only with a boost |
| `autoLeaguesForceOneFight` | `Setting_autoLeaguesForceOneFight` | `Storage()` | `Setting` | force at least 1 fight |
| `autoLeaguesSelectedIndex` | `Setting_autoLeaguesSelectedIndex` | `Storage()` | `Setting` | the selection index |
| `autoLeaguesSortIndex` | `Setting_autoLeaguesSortIndex` | `Storage()` | `Setting` | the sort index |
| `autoLeaguesAllowWinCurrent` | `Setting_autoLeaguesAllowWinCurrent` | `Storage()` | `Setting` | allow the current win |
| `leagueListDisplayPowerCalc` | `Setting_leagueListDisplayPowerCalc` | `Storage()` | `Setting` | the power display |

### Season

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoSeason` | `Setting_autoSeason` | `Storage()` | `Setting` | season enabled |
| `autoSeasonThreshold` | `Setting_autoSeasonThreshold` | `Storage()` | `Setting` | the win chance threshold |
| `autoSeasonRunThreshold` | `Setting_autoSeasonRunThreshold` | `Storage()` | `Setting` | the minimum runs |
| `autoSeasonBoostedOnly` | `Setting_autoSeasonBoostedOnly` | `Storage()` | `Setting` | only with a boost |
| `autoSeasonCollect` | `Setting_autoSeasonCollect` | `Storage()` | `Setting` | collect rewards |
| `autoSeasonCollectAll` | `Setting_autoSeasonCollectAll` | `Storage()` | `Setting` | all rewards |
| `autoSeasonCollectablesList` | `Setting_autoSeasonCollectablesList` | `Storage()` | `Setting` | collectable items |
| `autoSeasonFocus` | `Setting_autoSeasonIgnoreNoGirls` | `Storage()` | `Setting` | the season focus (off/girl/girlAndSkin) |
| `autoSeasonPassReds` | `Setting_autoSeasonPassReds` | `Storage()` | `Setting` | skip the red ones |
| `autoSeasonSkipLowMojo` | `Setting_autoSeasonSkipLowMojo` | `Storage()` | `Setting` | skip low mojo |
| `autoSeasonPreferLowMojo` | `Setting_autoSeasonPreferLowMojo` | `Storage()` | `Setting` | pick the opponent with the least mojo |
| `seasonDisplayPowerCalc` | `Setting_seasonDisplayPowerCalc` | `Storage()` | `Setting` | the power display |
| `autoSeasonMaxTier` | `Setting_autoSeasonMaxTier` | `Storage()` | `Setting` | max tier |
| `autoSeasonMaxTierNb` | `Setting_autoSeasonMaxTierNb` | `Storage()` | `Setting` | the max tier count |
| `autoSeasonMaxTierHard` | `Setting_autoSeasonMaxTierHard` | `Storage()` | `Setting` | the hard limit for max tier |

### Pantheon

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoPantheon` | `Setting_autoPantheon` | `Storage()` | `Setting` | pantheon enabled |
| `autoPantheonThreshold` | `Setting_autoPantheonThreshold` | `Storage()` | `Setting` | the threshold |
| `autoPantheonRunThreshold` | `Setting_autoPantheonRunThreshold` | `Storage()` | `Setting` | the minimum runs |
| `autoPantheonBoostedOnly` | `Setting_autoPantheonBoostedOnly` | `Storage()` | `Setting` | only with a boost |

### PentaDrill

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoPentaDrill` | `Setting_autoPentaDrill` | `Storage()` | `Setting` | penta drill enabled |
| `autoPentaDrillThreshold` | `Setting_autoPentaDrillThreshold` | `Storage()` | `Setting` | the threshold |
| `autoPentaDrillDelay` | `Setting_autoPentaDrillDelay` | `Storage()` | `Setting` | the delay between penta drill actions (3-20 s, 6 by default) |
| `autoPentaDrillRunThreshold` | `Setting_autoPentaDrillRunThreshold` | `Storage()` | `Setting` | the minimum runs |
| `autoPentaDrillBoostedOnly` | `Setting_autoPentaDrillBoostedOnly` | `Storage()` | `Setting` | only with a boost |
| `autoPentaDrillCollect` | `Setting_autoPentaDrillCollect` | `Storage()` | `Setting` | collect |
| `autoPentaDrillCollectAll` | `Setting_autoPentaDrillCollectAll` | `Storage()` | `Setting` | collect everything |
| `autoPentaDrillCollectablesList` | `Setting_autoPentaDrillCollectablesList` | `Storage()` | `Setting` | collectable items |

### Quest

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoQuest` | `Setting_autoQuest` | `Storage()` | `Setting` | quest enabled |
| `autoQuestThreshold` | `Setting_autoQuestThreshold` | `Storage()` | `Setting` | the energy threshold |
| `autoSideQuest` | `Setting_autoSideQuest` | `Storage()` | `Setting` | side quest |

### Mission

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoMission` | `Setting_autoMission` | `Storage()` | `Setting` | missions enabled |
| `autoMissionCollect` | `Setting_autoMissionCollect` | `Storage()` | `Setting` | collect the missions |
| `autoMissionKFirst` | `Setting_autoMissionKFirst` | `Storage()` | `Setting` | K first |

### Labyrinth

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoLabyrinth` | `Setting_autoLabyrinth` | `Storage()` | `Setting` | labyrinth enabled |
| `autoLabyHard` | `Setting_autoLabyHard` | `Storage()` | `Setting` | hard mode |
| `autoLabySweep` | `Setting_autoLabySweep` | `Storage()` | `Setting` | sweep |
| `autoLabyDifficultyIndex` | `Setting_autoLabyDifficultyIndex` | `Storage()` | `Setting` | the difficulty index |
| `autoLabyCustomTeamBuilder` | `Setting_autoLabyCustomTeamBuilder` | `Storage()` | `Setting` | the custom team builder |

### Place of Power

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoPowerPlaces` | `Setting_autoPowerPlaces` | `Storage()` | `Setting` | PoP enabled |
| `autoPowerPlacesAll` | `Setting_autoPowerPlacesAll` | `Storage()` | `Setting` | all PoP |
| `autoPowerPlacesIndexFilter` | `Setting_autoPowerPlacesIndexFilter` | `Storage()` | `Setting` | the index filter |
| `autoPowerPlacesInverted` | `Setting_autoPowerPlacesInverted` | `Storage()` | `Setting` | inverted |
| `autoPowerPlacesPrecision` | `Setting_autoPowerPlacesPrecision` | `Storage()` | `Setting` | precision |
| `autoPowerPlacesWaitMax` | `Setting_autoPowerPlacesWaitMax` | `Storage()` | `Setting` | the maximum wait |

### Shop / Market

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoAff` | `Setting_autoAff` | `Storage()` | `Setting` | buy affection automatically |
| `autoAffW` | `Setting_autoAffW` | `Storage()` | `Setting` | the affection value |
| `autoExp` | `Setting_autoExp` | `Storage()` | `Setting` | buy experience automatically |
| `autoExpW` | `Setting_autoExpW` | `Storage()` | `Setting` | the experience value |
| `maxAff` | `Setting_maxAff` | `Storage()` | `Setting` | max affection |
| `maxExp` | `Setting_maxExp` | `Storage()` | `Setting` | max experience |
| `maxBooster` | `Setting_maxBooster` | `Storage()` | `Setting` | **Retired in 8.11.0** (#1844). Registered without a default and without a menu entry, so that the migration in `StartService` can delete the stored value -- `deleteStoredValue` is a no-op for unregistered keys. Without a `default`, `setDefaults` does not recreate it. Remove the entry entirely in the version after next. |
| `autoBuyBoosters` | `Setting_autoBuyBoosters` | `Storage()` | `Setting` | buy boosters |
| `autoBuyBoostersFilter` | `Setting_autoBuyBoostersFilter` | `Storage()` | `Setting` | "Boosters to buy": `code:amount` pairs, `;`-separated, no spaces, every code at most once. The amount is the inventory stock wanted (equipped boosters do not count), `0` = unlimited, not named = not bought, empty = buy nothing. Since 8.11.0 the amounts too, before that only the codes. The syntax and the runtime read `BUY_LIST_PATTERN` from `Module/Market.pure.ts` |
| `autoEquipBoosters` | `Setting_autoEquipBoosters` | `Storage()` | `Setting` | equip boosters |
| `autoEquipBoostersSlots` | `Setting_autoEquipBoostersSlots` | `Storage()` | `Setting` | booster slots |
| `autoEquipMythicBooster` | `Setting_autoEquipMythicBooster` | `Storage()` | `Setting` | the priority list of mythic boosters for the free mythic slots |
| `updateMarket` | `Setting_updateMarket` | `Storage()` | `Setting` | refresh the market |
| `showMarketTools` | `Setting_showMarketTools` | `Storage()` | `Setting` | show the market tools |

### Harem / Salary

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoSalary` | `Setting_autoSalary` | `Storage()` | `Setting` | collect salaries automatically |
| `autoSalaryMinSalary` | `Setting_autoSalaryMinSalary` | `Storage()` | `Setting` | the minimum salary |
| `autoStats` | `Setting_autoStats` | `Storage()` | `Setting` | auto stats |
| `autoStatsSwitch` | `Setting_autoStatsSwitch` | `Storage()` | `Setting` | the stats switch |
| `hideOwnedGirls` | `Setting_hideOwnedGirls` | `Storage()` | `Setting` | hide your own girls |
| `showHaremAvatarMissingGirls` | `Setting_showHaremAvatarMissingGirls` | `Storage()` | `Setting` | show missing girls |
| `showHaremTools` | `Setting_showHaremTools` | `Storage()` | `Setting` | harem tools |
| `showHaremSkillsButtons` | `Setting_showHaremSkillsButtons` | `Storage()` | `Setting` | skill buttons |

### Pachinko

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoFreePachinko` | `Setting_autoFreePachinko` | `Storage()` | `Setting` | free pachinko |

### Daily Goals

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoDailyGoals` | `Setting_autoDailyGoals` | `Storage()` | `Setting` | daily goals |
| `autoDailyGoalsCollect` | `Setting_autoDailyGoalsCollect` | `Storage()` | `Setting` | collect goals |
| `autoDailyGoalsCollectablesList` | `Setting_autoDailyGoalsCollectablesList` | `Storage()` | `Setting` | collectable goals |

### Contest

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoContest` | `Setting_autoContest` | `Storage()` | `Setting` | contest enabled |
| `waitforContest` | `Setting_waitforContest` | `Storage()` | `Setting` | wait for the contest |
| `safeSecondsForContest` | `Setting_safeSecondsForContest` | `Storage()` | `Setting` | the safety seconds |

### Paranoia

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `paranoia` | `Setting_paranoia` | `Storage()` | `Setting` | paranoia enabled |
| `paranoiaSettings` | `Setting_paranoiaSettings` | `Storage()` | `Setting` | the paranoia settings |
| `paranoiaSpendsBefore` | `Setting_paranoiaSpendsBefore` | `Storage()` | `Setting` | spending before the pause |

### Girl Skins (applies to Events and Raids)

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `plusGirlSkins` | `Setting_plusGirlSkins` | `Storage()` | `Setting` | girl skins |
| `plusSkinSandalWood` | `Setting_plusSkinSandalWood` | `Storage()` | `Setting` | equip Sandalwood when only the skin is left (v8.10.0, off by default) |

### Boosters / Events

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `plusEvent` | `Setting_plusEvent` | `Storage()` | `Setting` | event enabled |
| `plusEventMythic` | `Setting_plusEventMythic` | `Storage()` | `Setting` | mythic event |
| `plusEventSandalWood` | `Setting_plusEventSandalWood` | `Storage()` | `Setting` | Sandalwood event |
| `plusEventMythicSandalWood` | `Setting_plusEventMythicSandalWood` | `Storage()` | `Setting` | mythic Sandalwood |
| `plusLoveRaid` | `Setting_plusLoveRaid` | `Storage()` | `Setting` | love raid |
| `autoTrollLoveRaidByPassThreshold` | `Setting_autoTrollLoveRaidByPassThreshold` | `Storage()` | `Setting` | the love raid bypass |
| `plusEventLoveRaidSandalWood` | `Setting_plusEventLoveRaidSandalWood` | `Storage()` | `Setting` | love raid Sandalwood |
| `bossBangEvent` | `Setting_bossBangEvent` | `Storage()` | `Setting` | boss bang |
| `bossBangMinTeam` | `Setting_bossBangMinTeam` | `Storage()` | `Setting` | boss bang minimum team |
| `collectEventChest` | `Setting_collectEventChest` | `Storage()` | `Setting` | collect the event chest |

### Seasonal Event

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoSeasonalBuyFreeCard` | `Setting_autoSeasonalBuyFreeCard` | `Storage()` | `Setting` | take the free card |
| `autoSeasonalEventCollect` | `Setting_autoSeasonalEventCollect` | `Storage()` | `Setting` | collect the seasonal |
| `autoSeasonalEventCollectAll` | `Setting_autoSeasonalEventCollectAll` | `Storage()` | `Setting` | collect everything |
| `autoSeasonalEventCollectablesList` | `Setting_autoSeasonalEventCollectablesList` | `Storage()` | `Setting` | collectable items |

### Double Penetration Event

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autodpEventCollect` | `Setting_autodpEventCollect` | `Storage()` | `Setting` | collect the DP event |
| `autodpEventCollectAll` | `Setting_autodpEventCollectAll` | `Storage()` | `Setting` | DP collect all |
| `autodpEventCollectablesList` | `Setting_autodpEventCollectablesList` | `Storage()` | `Setting` | DP items |

### Lively Scene Event

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoLivelySceneEventCollect` | `Setting_autoLivelySceneEventCollect` | `Storage()` | `Setting` | collect the lively scene |
| `autoLivelySceneEventCollectAll` | `Setting_autoLivelySceneEventCollectAll` | `Storage()` | `Setting` | lively collect all |
| `autoLivelySceneEventCollectablesList` | `Setting_autoLivelySceneEventCollectablesList` | `Storage()` | `Setting` | lively items |

### Path Events

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoPoACollect` | `Setting_autoPoACollect` | `Storage()` | `Setting` | collect Path of Attraction |
| `autoPoACollectAll` | `Setting_autoPoACollectAll` | `Storage()` | `Setting` | PoA all |
| `autoPoACollectablesList` | `Setting_autoPoACollectablesList` | `Storage()` | `Setting` | PoA items |
| `autoPoGCollect` | `Setting_autoPoGCollect` | `Storage()` | `Setting` | collect Path of Glory |
| `autoPoGCollectAll` | `Setting_autoPoGCollectAll` | `Storage()` | `Setting` | PoG all |
| `autoPoGCollectablesList` | `Setting_autoPoGCollectablesList` | `Storage()` | `Setting` | PoG items |
| `autoPoVCollect` | `Setting_autoPoVCollect` | `Storage()` | `Setting` | collect Path of Valor |
| `autoPoVCollectAll` | `Setting_autoPoVCollectAll` | `Storage()` | `Setting` | PoV all |
| `autoPoVCollectablesList` | `Setting_autoPoVCollectablesList` | `Storage()` | `Setting` | PoV items |

### Love Raid

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoLoveRaidSelectedIndex` | `Setting_autoLoveRaidSelectedIndex` | `Storage()` | `Setting` | the love raid selection |
| `plusLoveRaidMythic` | `Setting_autoLoveRaidMythicOnly` | `Storage()` | `Setting` | the raid stars selection: `off`, `exact3`, `min3` or `exact5` (the registry's `isValid`, default `off`); `StartService` maps older values onto those at the start. Measured 2026-09-11: the profile holds `off`. The comment on the constant ("0=off, 3, 5, 6") is outdated |

### Bundles

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoFreeBundlesCollect` | `Setting_autoFreeBundlesCollect` | `Storage()` | `Setting` | free bundles |
| `autoFreeBundlesCollectablesList` | `Setting_autoFreeBundlesCollectablesList` | `Storage()` | `Setting` | bundle items |

### Sultry Mysteries

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `sultryMysteriesEventRefreshShop` | `Setting_sultryMysteriesEventRefreshShop` | `Storage()` | `Setting` | the sultry mysteries shop |
| `sultryMysteriesAutoOpen` | `Setting_sultryMysteriesAutoOpen` | `Storage()` | `Setting` | auto mystery: open grid fields (v8.6.0) |
| `sultryMysteriesAutoOpenCollectablesList` | `Setting_sultryMysteriesAutoOpenCollectablesList` | `Storage()` | `Setting` (Array) | reward types that must be found before a reroll (v8.6.0) |

Timers: `eventSultryMysteryGoing` (the event's remaining time),
`eventSultryMysteryShopRefresh` (the next shop restock),
`eventSultryMysteryAutoOpen` (the next key check, 1 h after the keys ran out --
shown in the info panel as "Auto-Mystery").

### Display / UI

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `showInfo` | `Setting_showInfo` | `Storage()` | `Setting` | show the info panel |
| `showInfoLeft` | `Setting_showInfoLeft` | `Storage()` | `Setting` | info on the left |
| `showCalculatePower` | `Setting_showCalculatePower` | `Storage()` | `Setting` | the power calculation |
| `showClubButtonInPoa` | `Setting_showClubButtonInPoa` | `Storage()` | `Setting` | the club button in PoA |
| `showRewardsRecap` | `Setting_showRewardsRecap` | `Storage()` | `Setting` | the rewards recap |
| `showTooltips` | `Setting_showTooltips` | `Storage()` | `Setting` | show tooltips |
| `showAdsBack` | `Setting_showAdsBack` | `Storage()` | `Setting` | the ads background |
| `autoAdsClick` | `Setting_autoAdsClick` | `Storage()` | `Setting` | click and confirm the reward ads on the home page |
| `mousePause` | `Setting_mousePause` | `Storage()` | `Setting` | the mouse pause |
| `mousePauseTimeout` | `Setting_mousePauseTimeout` | `Storage()` | `Setting` | the mouse pause timeout |
| `collectAllTimer` | `Setting_collectAllTimer` | `Storage()` | `Setting` | the collection timer |
| `compactDailyGoals` | `Setting_compactDailyGoals` | `Storage()` | `Setting` | compact goals |
| `compactEndedContests` | `Setting_compactEndedContests` | `Storage()` | `Setting` | compact contests |
| `compactMissions` | `Setting_compactMissions` | `Storage()` | `Setting` | compact missions |
| `compactPowerPlace` | `Setting_compactPowerPlace` | `Storage()` | `Setting` | compact PoP |
| `invertMissions` | `Setting_invertMissions` | `Storage()` | `Setting` | invert the missions |
| `saveDefaults` | `Setting_saveDefaults` | `localStorage` | `Setting` | store the defaults |
| `pipelineDiagnose` | `Setting_pipelineDiagnose` | `localStorage` | `Setting` | extra `[PIPE]` details per step in the log (off by default) |

### Reward Masks

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `AllMaskRewards` | `Setting_AllMaskRewards` | `Storage()` | `Setting` | the global reward mask |
| `PoAMaskRewards` | `Setting_PoAMaskRewards` | `**--**` | `**--**` | the PoA mask |
| `PoGMaskRewards` | `Setting_PoGMaskRewards` | `**--**` | `**--**` | the PoG mask |
| `PoVMaskRewards` | `Setting_PoVMaskRewards` | `**--**` | `**--**` | the PoV mask |
| `SeasonMaskRewards` | `Setting_SeasonMaskRewards` | `**--**` | `**--**` | the season mask |
| `SeasonalEventMaskRewards` | `Setting_SeasonalEventMaskRewards` | `**--**` | `**--**` | the seasonal event mask |

---

## TK -- Temp Keys

### (unsorted)

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `autoLoop` | `Temp_autoLoop` | `sessionStorage` | `Temp` | the auto loop is on |
| `autoLoopTimeMili` | `Temp_autoLoopTimeMili` | `Storage()` | `Temp` | the loop interval (ms) |
| `Debug` | `Temp_Debug` | `sessionStorage` | `Temp` | debug mode. No code writes it; it is set by hand in the console -- and into **sessionStorage**; a value in localStorage is not read. Measured 2026-09-11: in the test profile `HHAuto_Temp_Debug` sat in localStorage and therefore had no effect |
| `Logging` | `Temp_Logging` | `sessionStorage` | `Temp` | **An export name only.** Since 8.10.47 the log lives in the ring buffer (see below); the key itself is read once at the start and deleted. |
| `Timers` | `Temp_Timers` | `sessionStorage` | `Temp` | the timer state (JSON) |
| `LastPageCalled` | `Temp_LastPageCalled` | `sessionStorage` | `Temp` | the last page opened |
| `CheckSpentPoints` | `Temp_CheckSpentPoints` | `sessionStorage` | `Temp` | check the points spent |
| `freshStart` | `Temp_freshStart` | `Storage()` | `Temp` | the first start |
| `scriptversion` | `Temp_scriptversion` | `localStorage` | `Temp` | the current version |
| `pinfo` | `Temp_pinfo` | `sessionStorage` | `Temp` | the pInfo panel state |

### Harem

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `HaremSize` | `Temp_HaremSize` | `localStorage` | `Temp` | the harem size (JSON: {count}) |
| `filteredGirlsList` | `Temp_filteredGirlsList` | `sessionStorage` | `Temp` | the filtered girl list |
| `haremGirlActions` | `Temp_haremGirlActions` | `sessionStorage` | `Temp` | active girl actions |
| `haremGirlEnd` | `Temp_haremGirlEnd` | `sessionStorage` | `Temp` | the end of the girl action |
| `haremGirlLimit` | `Temp_haremGirlLimit` | `sessionStorage` | `Temp` | the girl limit |
| `haremGirlMode` | `Temp_haremGirlMode` | `sessionStorage` | `Temp` | the girl mode |
| `haremGirlPayLast` | `Temp_haremGirlPayLast` | `sessionStorage` | `Temp` | the last payment |
| `haremGirlSpent` | `Temp_haremGirlSpent` | `**--**` | `**--**` | what was spent |
| `haremMoneyOnStart` | `Temp_haremMoneyOnStart` | `sessionStorage` | `Temp` | the money at the start |
| `haremTeam` | `Temp_haremTeam` | `sessionStorage` | `Temp` | team data (JSON) |
| `haremTeamScrolls` | `Temp_haremTeamScrolls` | `sessionStorage` | `Temp` | team scrolls |
| `haremTeamSettings` | `Temp_haremTeamSettings` | `sessionStorage` | `Temp` | the team settings |
| `blessingsCache` | `Temp_blessingsCache` | `localStorage` | `Temp` | the blessing API cache (`BlessingData` JSON), 12 h lifetime, set in `BlessingService.fetchAndCache` |
| `teamInfoCollapsed` | `Temp_teamInfoCollapsed` | `localStorage` | `Temp` | the team info panel is collapsed (`TeamModule`) |
| `teamTheme` | `Temp_teamTheme` | `localStorage` | `Temp` | the theme of the team built last; the gear optimiser needs it on the market page, where the team is not available |
| `gearSwapLog` | `Temp_gearSwapLog` | `localStorage` | `Temp` | the inventory IDs of the items the gear optimiser took off, so a rollback stays possible (the ID changes on every unequip) |
| `gearUpgradeQueue` | `Temp_gearUpgradeQueue` | `localStorage` | `Temp` | the items "Upgrade Gear" still has to level; worked through across the navigations to the upgrade page |
| `gearKeepKeys` | `Temp_gearKeepKeys` | `localStorage` | `Setting` | the pieces chosen by "Mark Keepers" as level-independent identity keys; a `Setting` despite the `Temp_` prefix, because it is a user decision (from 8.10.22) |

### Resources

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `haveAff` | `Temp_haveAff` | `sessionStorage` | `Temp` | affection available |
| `haveBooster` | `Temp_haveBooster` | `sessionStorage` | `Temp` | boosters available |
| `haveExp` | `Temp_haveExp` | `sessionStorage` | `Temp` | experience available |
| `charLevel` | `Temp_charLevel` | `sessionStorage` | `Temp` | the character level |
| `heroMaxLevel` | `Temp_heroMaxLevel` | `localStorage` | `Temp` | the highest level ever seen; `HeroHelper.getLevel` never falls below it, because the game delivers a stale `Hero.infos.level` on some page loads |
| `storeContents` | `Temp_storeContents` | `sessionStorage` | `Temp` | the shop contents |
| `boosterStatus` | `Temp_boosterStatus` | `sessionStorage` | `Temp` | the booster status |
| `boosterStatusLastUpdate` | `Temp_boosterStatusLastUpdate` | `sessionStorage` | `Temp` | the timestamp of the last booster status update |
| `boosterIdMap` | `Temp_boosterIdMap` | `sessionStorage` | `Temp` | the booster ID mapping |

### Troll

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `TrollHumanLikeRun` | `Temp_TrollHumanLikeRun` | `sessionStorage` | `Temp` | human-like troll runs |
| `TrollInvalid` | `Temp_TrollInvalid` | `sessionStorage` | `Temp` | invalid trolls |
| `trollPoints` | `Temp_trollPoints` | `sessionStorage` | `Temp` | troll points |
| `trollWithGirls` | `Temp_trollWithGirls` | `sessionStorage` | `Temp` | trolls with girls |
| `autoTrollBattleSaveQuest` | `Temp_autoTrollBattleSaveQuest` | `sessionStorage` | `Temp` | the quest save |

### Quest

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `questRequirement` | `Temp_questRequirement` | `sessionStorage` | `Temp` | the quest requirements |
| `MainAdventureWorldID` | `Temp_MainAdventureWorldID` | `localStorage` | `Temp` | the main world ID |
| `SideAdventureWorldID` | `Temp_SideAdventureWorldID` | `localStorage` | `Temp` | the side world ID |

### Battle

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `battlePowerRequired` | `Temp_battlePowerRequired` | `sessionStorage` | `Temp` | the power needed |
| `burst` | `Temp_burst` | `sessionStorage` | `Temp` | burst mode |
| `lastActionPerformed` | `Temp_lastActionPerformed` | `sessionStorage` | `Temp` | the last action |

### Events

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `eventGirl` | `Temp_eventGirl` | `sessionStorage` | `Temp` | the current event girl |
| `eventMythicGirl` | `Temp_eventMythicGirl` | `sessionStorage` | `Temp` | the mythic event girl |
| `eventsGirlz` | `Temp_eventsGirlz` | `sessionStorage` | `Temp` | event girls (JSON) |
| `eventsList` | `Temp_eventsList` | `sessionStorage` | `Temp` | active events |
| `autoChampsEventGirls` | `Temp_autoChampsEventGirls` | `sessionStorage` | `Temp` | champion event girls |
| `loveRaids` | `Temp_loveRaids` | `sessionStorage` | `Temp` | love raid data |
| `raidGirls` | `Temp_raidGirls` | `sessionStorage` | `Temp` | raid girls |
| `bossBangTeam` | `Temp_bossBangTeam` | `sessionStorage` | `Temp` | the boss bang team |
| `lseManualCollectAll` | `Temp_lseManualCollectAll` | `localStorage` | `Temp` | collect LSE manually |
| `poaManualCollectAll` | `Temp_poaManualCollectAll` | `localStorage` | `Temp` | collect PoA manually |

### Champion

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `champBuildTeam` | `Temp_champBuildTeam` | `sessionStorage` | `Temp` | build the champion team |
| `clubChampLimitReached` | `Temp_clubChampLimitReached` | `sessionStorage` | `Temp` | the club limit is reached |

### League

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `LeagueHumanLikeRun` | `Temp_LeagueHumanLikeRun` | `sessionStorage` | `Temp` | human-like league runs |
| `LeagueOpponentList` | `Temp_LeagueOpponentList` | `sessionStorage` | `Temp` | the opponent list |
| `hideBeatenOppo` | `Temp_hideBeatenOppo` | `Storage()` | `Temp` | hide the ones already beaten |

### Season

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `SeasonEndDate` | `Temp_SeasonEndDate` | `**--**` | `**--**` | the season end |
| `SeasonHumanLikeRun` | `Temp_SeasonHumanLikeRun` | `sessionStorage` | `Temp` | human-like season |
| `SeasonalEventEndDate` | `Temp_SeasonalEventEndDate` | `**--**` | `**--**` | the seasonal event end |

### Pantheon / PentaDrill

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `PantheonHumanLikeRun` | `Temp_PantheonHumanLikeRun` | `sessionStorage` | `Temp` | human-like pantheon |
| `PentaDrillHumanLikeRun` | `Temp_PentaDrillHumanLikeRun` | `sessionStorage` | `Temp` | human-like penta |

### Place of Power

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `PopToStart` | `Temp_PopToStart` | `sessionStorage` | `Temp` | PoP to start |
| `PopTargeted` | `Temp_PopTargeted` | `sessionStorage` | `Temp` | the targeted PoP |
| `PopUnableToStart` | `Temp_PopUnableToStart` | `sessionStorage` | `Temp` | PoP that cannot be started |
| `Totalpops` | `Temp_Totalpops` | `sessionStorage` | `Temp` | PoP in total |
| `currentlyAvailablePops` | `Temp_currentlyAvailablePops` | `sessionStorage` | `Temp` | available PoP |

### Path Events

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `PoAEndDate` | `Temp_PoAEndDate` | `localStorage` | `Temp` | the PoA end |
| `PoGEndDate` | `Temp_PoGEndDate` | `localStorage` | `Temp` | the PoG end |
| `PoVEndDate` | `Temp_PoVEndDate` | `localStorage` | `Temp` | the PoV end |

### Daily Goals

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `dailyGoalsList` | `Temp_dailyGoalsList` | `sessionStorage` | `Temp` | the daily goals list |

### Paranoia

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `NextSwitch` | `Temp_NextSwitch` | `sessionStorage` | `Temp` | the next switch |
| `paranoiaLeagueBlocked` | `Temp_paranoiaLeagueBlocked` | `sessionStorage` | `Temp` | paranoia blocks the league |
| `paranoiaQuestBlocked` | `Temp_paranoiaQuestBlocked` | `sessionStorage` | `Temp` | paranoia blocks the quest |
| `paranoiaSpendings` | `Temp_paranoiaSpendings` | `sessionStorage` | `Temp` | paranoia spending |

### Misc

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `sandalwoodFailure` | `Temp_sandalwoodFailure` | `sessionStorage` | `Temp` | Sandalwood errors |
| `sandalwoodMaxUsages` | `Temp_sandalwoodMaxUsages` | `sessionStorage` | `Temp` | Sandalwood max |
| `mythicEquipConflicts` | `Temp_mythicEquipConflicts` | `localStorage` | `Temp` | learned mythic slot conflicts (`Booster.ts`, a JSON map: code -> the loadout at the refusal). `localStorage` from 8.10.13 on, so that what was learned survives the session |
| `unknownPagesList` | `Temp_unknownPagesList` | `sessionStorage` | `Temp` | unknown pages |

### Survey

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `surveyShown` | `Temp_surveyShown` | `localStorage` | `Temp` | the survey was shown |
| `surveyDismissCount` | `Temp_surveyDismissCount` | `localStorage` | `Temp` | the survey dismissal count |
| `surveyLastHash` | `Temp_surveyLastHash` | `localStorage` | `Temp` | the survey hash |

### Feature Popup (What's New)

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `featurePopupShown` | `Temp_featurePopupShown` | `localStorage` | `Temp` | the feature popup was shown |
| `featurePopupDismissCount` | `Temp_featurePopupDismissCount` | `localStorage` | `Temp` | the feature popup dismissal |

### Mouse pause (issue #1774)

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `mouseLastActivity` | `Temp_mouseLastActivity` | `sessionStorage` | `Temp` | the timestamp of the last mouse activity (`MouseService`) |

### Pipeline scheduler

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `pipelineLastRunAt` | `Temp_pipelineLastRunAt` | `sessionStorage` | `Temp` | `{blockId: ts}` the last run per block (`BlockPipeline`) |

### Pipeline-Block-Architektur (ADR-004)

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `activeBlockRun` | `Temp_activeBlockRun` | `sessionStorage` | `Temp` | BlockRun progress (R4.4/R4.12) |
| `blockCooldownUntil` | `Temp_blockCooldownUntil` | `sessionStorage` | `Temp` | `{blockId: ts}` cooldowns (R4.10/R5.2) |
| `blockFocus` | `Temp_blockFocus` | `sessionStorage` | `Temp` | `{blockId,lastRunAt}` the focused activity, keeps the pipeline on one block (#1841) |
| `forbiddenCount` | `Temp_forbiddenCount` | `sessionStorage` | `Temp` | consecutive 403 answers, drives the backoff (#1598) |
| `forbiddenLastAt` | `Temp_forbiddenLastAt` | `localStorage` | `Temp` | the time of the last 403; deliberately persistent, so that it is still in the debug export after a tab restart |
| `blockAutoDisabled` | `Temp_blockAutoDisabled` | `localStorage` | `Temp` | `{blockId:{reason,sinceVersion}}` automatically disabled blocks (R5.5) |
| `blockFailureCount` | `Temp_blockFailureCount` | `localStorage` | `Temp` | `{signature: count}` the error counter (R5.3) |
| `pipelineOrder` | `Temp_pipelineOrder` | `localStorage` | `Setting` | the effective block ID order (R2.5/R7.1); registered as a `Setting` despite the `Temp_` prefix |
| `pipelineLogContext` | `Temp_pipelineLogContext` | `localStorage` | `Temp` | the non-rotating log context block (R6.16) |

### Troll wait-marker (issue #1708)

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `trollWaitForEnergy` | `Temp_trollWaitForEnergy` | `sessionStorage` | `Temp` | set when `handleTrollBattle` waits for energy while a fight path would fire; `handleEventParsing` and `handleLeague` then suppress their navigation. Per tab. |

### Settings-Menue (Layout, ab 8.10.0)

| Constant | Storage key | Storage | HHType | Description |
|-----------|-------------|---------|--------|--------------|
| `menuSingleColumn` | `Setting_menuSingleColumn` | `localStorage` | `Setting` | the menu layout: `false` = a tab bar, `true` = all areas stacked |
| `menuCompact` | `Setting_menuCompact` | `localStorage` | `Setting` | density: `true` = tighter rows and smaller type (from 8.10.12) |
| `menuOrder` | `Temp_menuOrder` | `localStorage` | `Setting` | the order of the menu areas set by the user (a JSON array of area IDs) |
| `menuTab` | `Temp_menuTab` | `sessionStorage` | `Temp` | the area opened last (the tab layout only) |

`menuOrder` carries `HHType: "Setting"` despite the `Temp_` prefix -- the same
decision as `Temp_pipelineOrder`: a user decision should survive "delete temp
storage" and be part of the JSON settings export (`extractHHVars` filters by
`HHType`, not by key prefix).

---

## Known unregistered keys

The following 8 constants are defined in `StorageKeys.ts` but NOT registered in `HHStoredVars.ts` (cross-checked 2026-09-11 against 8.13.1). Reading returns `undefined`, writing is dropped:

**SK:**
- `SK.PoAMaskRewards`
- `SK.PoGMaskRewards`
- `SK.PoVMaskRewards`
- `SK.SeasonMaskRewards`
- `SK.SeasonalEventMaskRewards`

**TK:**
- `TK.haremGirlSpent`
- `TK.SeasonEndDate`
- `TK.SeasonalEventEndDate`


## Dead keys (cleanup candidates)

**None.** The analysis of 2026-08-19 against v8.9.0 had found eight keys with no
code access at all; they were removed the same day:

| Key | was registered | Finding |
|-----|-----------------|--------|
| SK.autoTrollMythicByPassThreshold | no | a parked feature: a commented-out block in `ParanoiaService.ts`, with the i18n entries in de/en/es commented out as well (version marker 5.6.24) |
| TK.trollToFight | no | an orphan, no occurrence besides the definition |
| TK.fought | yes | the registration only, nothing else |
| TK.EventFightsBeforeRefresh | no | a parked feature: commented out in `RewardHelper.ts` and `EventModule.ts` (twice) |
| TK.LeagueSavedData | yes | the registration only, nothing else |
| TK.LeagueTempOpponentList | no | an orphan |
| TK.leaguesTarget | no | an orphan |
| TK.userLink | no | an orphan |

The commented-out blocks of the two parked features were deliberately left in
place. Whoever reactivates one of them has to create the matching constant
again -- one line.

### The method for the next round

A key counts as dead when no code touches it outside its definition in
`StorageKeys.ts` and its registration in `HHStoredVars.ts`. Three traps a naive
search walks into:

1. **Commented-out code does not count as access.** Without stripping comments,
   parked features falsely look alive.
2. **`HHStoredVars.ts` itself has to be searched.** It holds `events` handlers
   with real writes -- that is how `SK.autoFreeBundlesCollectablesList` is
   written, for example.
3. **`setMenuValues` / `getMenuValues` iterate over the whole registry** and
   read or write every entry with `storage` and `HHType`. A registered key is
   therefore touched on every menu operation, even when no feature code knows
   it. So remove the `HHStoredVars` entry first, then the constant.

Two further dynamic consumers were checked and are harmless:
`SurveyService.buildSettingsExport` iterates `Object.keys(SK)` but skips
unregistered keys (`if (!varDef) continue`), and `debugDeleteAllVars` iterates
the registry instead of SK/TK.

## The log ring buffer (since 8.10.47)

The debug log no longer lives as one JSON object under `Temp_Logging` but as a
ring of text blocks. These keys are **deliberately not** registered in
`HHStoredVars`: they are not state of the script but the logger's own storage,
and the registry path (`setStoredValue`) clears exactly this log on a quota
error -- a loop `LogStore` avoids by writing to `sessionStorage` directly.

| Key | Storage | Content |
|---|---|---|
| `Temp_LogIdx` | `sessionStorage` | `{cur, used[]}` -- the current block and the age order |
| `Temp_Log0` .. `Temp_Log63` | `sessionStorage` | up to 128 KB of log text each, `<ms base36>\t<caller>\t<text>` per line |

The ring occupies 8 MB nominally and shrinks by itself: when the browser
refuses a write, the oldest block drops out and the write is retried. The debug
export rebuilds the old form from it (`{"<date>.<ms>:<caller>": text}`), so that
existing log readers keep working unchanged.

`clearLog()` (from the quota emergency path `cleanLogsInStorage`) empties the whole ring.
