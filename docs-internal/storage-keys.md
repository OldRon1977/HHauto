---
last-verified: 2026-04-29
verified-against-version: 7.35.14
status: major-drift-fixed
---

# Storage Keys Referenz

Alle localStorage/sessionStorage-Schluessel des HHauto Scripts.
Letzte Aktualisierung: 2026-04-29 (verifiziert gegen v7.35.14; `StorageKeys.ts` unveraendert seit v7.35.10, daher gilt 179 SK + 89 TK weiterhin)

---

## Architektur

**Dateien:**
- `src/config/StorageKeys.ts` — SK und TK Konstanten
- `src/config/HHStoredVars.ts` — Registry mit Defaults, Validierung, UI-Metadaten
- `src/Helper/StorageHelper.ts` — Storage-Abstraktionsschicht

**Prefix-System:**
- Alle Keys werden mit `HHStoredVarPrefixKey` ("HHAuto_") prefixed
- Beispiel: `HHStoredVarPrefixKey + SK.master` = `"HHAuto_Setting_master"`

**Storage-Typ:**
- SK (Setting_*): localStorage (persistent) — Benutzereinstellungen
- TK (Temp_*): sessionStorage (pro Tab) — Laufzeit-State
- `SK.settPerTab`: Wenn aktiv, nutzen auch Settings sessionStorage

**Kern-Funktionen:**
- `getStoredValue(key)` — Wert lesen
- `setStoredValue(key, value)` — Wert schreiben (mit Retry bei Fehler)
- `deleteStoredValue(key)` — Wert loeschen
- `getStoredJSON<T>(key, default)` — JSON parsen

---

## SK — Setting Keys (179 Konstanten in v7.35.10)

Die folgenden Tabellen listen die wichtigsten Gruppen. Vollstaendige Liste siehe `src/config/StorageKeys.ts` (Zeilen 21-258). Quelle der Wahrheit: der Code, nicht diese Doku.

### Master Controls

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `master` | `Setting_master` | Hauptschalter ein/aus |
| `settPerTab` | `Setting_settPerTab` | SessionStorage statt localStorage |
| `spendKobans0` | `Setting_spendKobans0` | Hauptschalter Koban-Ausgaben |

### Troll Battle

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `autoTrollBattle` | `Setting_autoTrollBattle` | Troll-Kampf aktiviert |
| `autoTrollThreshold` | `Setting_autoTrollThreshold` | Min. Energie-Schwelle |
| `autoTrollRunThreshold` | `Setting_autoTrollRunThreshold` | Min. Runs |
| `autoTrollSelectedIndex` | `Setting_autoTrollSelectedIndex` | Ausgewaehlter Troll |
| `autoTrollMythicByPassParanoia` | `Setting_autoTrollMythicByPassParanoia` | Mythic ignoriert Paranoia |
| `autoTrollMythicByPassThreshold` | `Setting_autoTrollMythicByPassThreshold` | Mythic Bypass-Schwelle |
| `eventTrollOrder` | `Setting_eventTrollOrder` | Event-Troll-Reihenfolge |
| `useX10Fights` | `Setting_useX10Fights` | x10 Kaempfe nutzen |
| `useX10FightsAllowNormalEvent` | `Setting_useX10FightsAllowNormalEvent` | x10 auch bei normalen Events |
| `useX50Fights` | `Setting_useX50Fights` | x50 Kaempfe nutzen |
| `useX50FightsAllowNormalEvent` | `Setting_useX50FightsAllowNormalEvent` | x50 auch bei normalen Events |
| `minShardsX10` | `Setting_minShardsX10` | Min. Shards fuer x10 |
| `minShardsX50` | `Setting_minShardsX50` | Min. Shards fuer x50 |
| `sandalwoodMinShardsThreshold` | `Setting_sandalwoodMinShardsThreshold` | Sandalwood-Mindest-Shard-Schwelle (ersetzt seit v7.35.x die vier alten `sandalwoodShardsX10Limit`, `sandalwoodShardsX1Limit`, `sandalwoodDosesX10Limit`, `sandalwoodDosesX1Limit` Keys; alte Keys sind in v7.35.10 nicht mehr im Code) |

### Koban/Energie-Kauf

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `kobanBank` | `Setting_kobanBank` | Koban-Reserve |
| `buyCombat` | `Setting_buyCombat` | Kampf-Energie kaufen |
| `buyCombTimer` | `Setting_buyCombTimer` | Kauf-Timer |
| `buyMythicCombat` | `Setting_buyMythicCombat` | Mythic Kampf-Energie kaufen |
| `buyMythicCombTimer` | `Setting_buyMythicCombTimer` | Mythic Kauf-Timer |
| `buyLoveRaidCombat` | `Setting_buyLoveRaidCombat` | Love Raid Energie kaufen |
| `autoBuyTrollNumber` | `Setting_autoBuyTrollNumber` | Auto-Kauf Troll Anzahl |
| `autoBuyMythicTrollNumber` | `Setting_autoBuyMythicTrollNumber` | Auto-Kauf Mythic Anzahl |
| `autoBuyLoveRaidTrollNumber` | `Setting_autoBuyLoveRaidTrollNumber` | Auto-Kauf Love Raid Anzahl |

### Champion

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `autoChamps` | `Setting_autoChamps` | Champion aktiviert |
| `autoChampsFilter` | `Setting_autoChampsFilter` | Champion Filter |
| `autoChampsForceStart` | `Setting_autoChampsForceStart` | Force Start |
| `autoChampsForceStartEventGirl` | `Setting_autoChampsForceStartEventGirl` | Force Start Event-Girl |
| `autoChampsGirlThreshold` | `Setting_autoChampsGirlThreshold` | Girl-Schwelle |
| `autoChampsTeamLoop` | `Setting_autoChampsTeamLoop` | Team-Rotation |
| `autoChampsTeamKeepSecondLine` | `Setting_autoChampsTeamKeepSecondLine` | Zweite Reihe behalten |
| `autoChampsUseEne` | `Setting_autoChampsUseEne` | Energie nutzen |
| `autoChampAlignTimer` | `Setting_autoChampAlignTimer` | Align Timer |
| `autoBuildChampsTeam` | `Setting_autoBuildChampsTeam` | Auto-Team bauen |

### Club Champion

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `autoClubChamp` | `Setting_autoClubChamp` | Club Champion aktiviert |
| `autoClubChampMax` | `Setting_autoClubChampMax` | Max Kaempfe |
| `autoClubForceStart` | `Setting_autoClubForceStart` | Force Start |

### League

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `autoLeagues` | `Setting_autoLeagues` | Liga aktiviert |
| `autoLeaguesCollect` | `Setting_autoLeaguesCollect` | Liga Rewards sammeln |
| `autoLeaguesThreshold` | `Setting_autoLeaguesThreshold` | Min. Gewinnchance |
| `autoLeaguesSecurityThreshold` | `Setting_autoLeaguesSecurityThreshold` | Sicherheits-Schwelle |
| `autoLeaguesRunThreshold` | `Setting_autoLeaguesRunThreshold` | Min. Runs |
| `autoLeaguesBoostedOnly` | `Setting_autoLeaguesBoostedOnly` | Nur mit Boost |
| `autoLeaguesForceOneFight` | `Setting_autoLeaguesForceOneFight` | Min. 1 Kampf erzwingen |
| `autoLeaguesSelectedIndex` | `Setting_autoLeaguesSelectedIndex` | Auswahl-Index |
| `autoLeaguesSortIndex` | `Setting_autoLeaguesSortIndex` | Sortier-Index |
| `autoLeaguesAllowWinCurrent` | `Setting_autoLeaguesAllowWinCurrent` | Aktuellen Sieg erlauben |
| `leagueListDisplayPowerCalc` | `Setting_leagueListDisplayPowerCalc` | Power-Anzeige |

### Season

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `autoSeason` | `Setting_autoSeason` | Season aktiviert |
| `autoSeasonThreshold` | `Setting_autoSeasonThreshold` | Gewinnchance-Schwelle |
| `autoSeasonRunThreshold` | `Setting_autoSeasonRunThreshold` | Min. Runs |
| `autoSeasonBoostedOnly` | `Setting_autoSeasonBoostedOnly` | Nur mit Boost |
| `autoSeasonCollect` | `Setting_autoSeasonCollect` | Rewards sammeln |
| `autoSeasonCollectAll` | `Setting_autoSeasonCollectAll` | Alle Rewards |
| `autoSeasonCollectablesList` | `Setting_autoSeasonCollectablesList` | Sammelbare Items |
| `autoSeasonIgnoreNoGirls` | `Setting_autoSeasonIgnoreNoGirls` | Ignoriere ohne Girls |
| `autoSeasonPassReds` | `Setting_autoSeasonPassReds` | Rote ueberspringen |
| `autoSeasonSkipLowMojo` | `Setting_autoSeasonSkipLowMojo` | Niedrige Mojo ueberspringen |
| `seasonDisplayPowerCalc` | `Setting_seasonDisplayPowerCalc` | Power-Anzeige |
| `autoSeasonMaxTier` | `Setting_autoSeasonMaxTier` | Max Tier |
| `autoSeasonMaxTierNb` | `Setting_autoSeasonMaxTierNb` | Max Tier Anzahl |

### Pantheon / Penta Drill

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `autoPantheon` | `Setting_autoPantheon` | Pantheon aktiviert |
| `autoPantheonThreshold` | `Setting_autoPantheonThreshold` | Schwelle |
| `autoPantheonRunThreshold` | `Setting_autoPantheonRunThreshold` | Min. Runs |
| `autoPantheonBoostedOnly` | `Setting_autoPantheonBoostedOnly` | Nur mit Boost |
| `autoPentaDrill` | `Setting_autoPentaDrill` | Penta Drill aktiviert |
| `autoPentaDrillThreshold` | `Setting_autoPentaDrillThreshold` | Schwelle |
| `autoPentaDrillRunThreshold` | `Setting_autoPentaDrillRunThreshold` | Min. Runs |
| `autoPentaDrillBoostedOnly` | `Setting_autoPentaDrillBoostedOnly` | Nur mit Boost |
| `autoPentaDrillCollect` | `Setting_autoPentaDrillCollect` | Sammeln |
| `autoPentaDrillCollectAll` | `Setting_autoPentaDrillCollectAll` | Alles sammeln |
| `autoPentaDrillCollectablesList` | `Setting_autoPentaDrillCollectablesList` | Sammelbare Items |

### Quest / Mission

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `autoQuest` | `Setting_autoQuest` | Quest aktiviert |
| `autoQuestThreshold` | `Setting_autoQuestThreshold` | Energie-Schwelle |
| `autoSideQuest` | `Setting_autoSideQuest` | Side Quest |
| `autoMission` | `Setting_autoMission` | Mission aktiviert |
| `autoMissionCollect` | `Setting_autoMissionCollect` | Missions sammeln |
| `autoMissionKFirst` | `Setting_autoMissionKFirst` | K zuerst |

### Labyrinth

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `autoLabyrinth` | `Setting_autoLabyrinth` | Labyrinth aktiviert |
| `autoLabyHard` | `Setting_autoLabyHard` | Hard Mode |
| `autoLabySweep` | `Setting_autoLabySweep` | Sweep |
| `autoLabyDifficultyIndex` | `Setting_autoLabyDifficultyIndex` | Schwierigkeits-Index |
| `autoLabyCustomTeamBuilder` | `Setting_autoLabyCustomTeamBuilder` | Custom Team Builder |

### Place of Power

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `autoPowerPlaces` | `Setting_autoPowerPlaces` | PoP aktiviert |
| `autoPowerPlacesAll` | `Setting_autoPowerPlacesAll` | Alle PoP |
| `autoPowerPlacesIndexFilter` | `Setting_autoPowerPlacesIndexFilter` | Index-Filter |
| `autoPowerPlacesInverted` | `Setting_autoPowerPlacesInverted` | Invertiert |
| `autoPowerPlacesPrecision` | `Setting_autoPowerPlacesPrecision` | Praezision |
| `autoPowerPlacesWaitMax` | `Setting_autoPowerPlacesWaitMax` | Max Wartezeit |

### Shop/Market

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `autoAff` | `Setting_autoAff` | Auto Affection kaufen |
| `autoAffW` | `Setting_autoAffW` | Affection Wert |
| `autoExp` | `Setting_autoExp` | Auto Experience kaufen |
| `autoExpW` | `Setting_autoExpW` | Experience Wert |
| `maxAff` | `Setting_maxAff` | Max Affection |
| `maxExp` | `Setting_maxExp` | Max Experience |
| `maxBooster` | `Setting_maxBooster` | Max Booster |
| `autoBuyBoosters` | `Setting_autoBuyBoosters` | Booster kaufen |
| `autoBuyBoostersFilter` | `Setting_autoBuyBoostersFilter` | Booster-Filter |
| `autoEquipBoosters` | `Setting_autoEquipBoosters` | Booster ausruesten |
| `autoEquipBoostersSlots` | `Setting_autoEquipBoostersSlots` | Booster-Slots |
| `updateMarket` | `Setting_updateMarket` | Markt aktualisieren |
| `showMarketTools` | `Setting_showMarketTools` | Markt-Tools anzeigen |

### Harem/Salary

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `autoSalary` | `Setting_autoSalary` | Auto Gehalt sammeln |
| `autoSalaryMinSalary` | `Setting_autoSalaryMinSalary` | Min. Gehalt |
| `autoStats` | `Setting_autoStats` | Auto Stats |
| `autoStatsSwitch` | `Setting_autoStatsSwitch` | Stats Switch |
| `hideOwnedGirls` | `Setting_hideOwnedGirls` | Eigene Girls ausblenden |
| `showHaremAvatarMissingGirls` | `Setting_showHaremAvatarMissingGirls` | Fehlende Girls anzeigen |
| `showHaremTools` | `Setting_showHaremTools` | Harem-Tools |
| `showHaremSkillsButtons` | `Setting_showHaremSkillsButtons` | Skill-Buttons |

### Pachinko / Contest / Paranoia

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `autoFreePachinko` | `Setting_autoFreePachinko` | Gratis Pachinko |
| `autoContest` | `Setting_autoContest` | Contest aktiviert |
| `waitforContest` | `Setting_waitforContest` | Auf Contest warten |
| `safeSecondsForContest` | `Setting_safeSecondsForContest` | Sicherheits-Sekunden |
| `autoDailyGoals` | `Setting_autoDailyGoals` | Daily Goals |
| `autoDailyGoalsCollect` | `Setting_autoDailyGoalsCollect` | Goals sammeln |
| `autoDailyGoalsCollectablesList` | `Setting_autoDailyGoalsCollectablesList` | Sammelbare Goals |
| `paranoia` | `Setting_paranoia` | Paranoia aktiviert |
| `paranoiaSettings` | `Setting_paranoiaSettings` | Paranoia-Einstellungen |
| `paranoiaSpendsBefore` | `Setting_paranoiaSpendsBefore` | Ausgaben vor Pause |

### Events

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `plusEvent` | `Setting_plusEvent` | Event aktiviert |
| `plusEventMythic` | `Setting_plusEventMythic` | Mythic Event |
| `plusEventSandalWood` | `Setting_plusEventSandalWood` | Sandalwood Event |
| `plusEventMythicSandalWood` | `Setting_plusEventMythicSandalWood` | Mythic Sandalwood |
| `plusLoveRaid` | `Setting_plusLoveRaid` | Love Raid |
| `plusLoveRaidMythic` | `Setting_autoLoveRaidMythicOnly` | Love Raid Mythic (Min Grade) |
| `autoLoveRaidSelectedIndex` | `Setting_autoLoveRaidSelectedIndex` | Love Raid Auswahl |
| `autoTrollLoveRaidByPassThreshold` | `Setting_autoTrollLoveRaidByPassThreshold` | Love Raid Bypass |
| `plusEventLoveRaidSandalWood` | `Setting_plusEventLoveRaidSandalWood` | Love Raid Sandalwood |
| `bossBangEvent` | `Setting_bossBangEvent` | Boss Bang |
| `bossBangMinTeam` | `Setting_bossBangMinTeam` | Boss Bang Min Team |
| `collectEventChest` | `Setting_collectEventChest` | Event Chest sammeln |

### Seasonal / Path Events

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `autoSeasonalBuyFreeCard` | `Setting_autoSeasonalBuyFreeCard` | Gratis-Karte kaufen |
| `autoSeasonalEventCollect` | `Setting_autoSeasonalEventCollect` | Seasonal sammeln |
| `autoSeasonalEventCollectAll` | `Setting_autoSeasonalEventCollectAll` | Alles sammeln |
| `autoSeasonalEventCollectablesList` | `Setting_autoSeasonalEventCollectablesList` | Sammelbare Items |
| `autodpEventCollect` | `Setting_autodpEventCollect` | DP Event sammeln |
| `autodpEventCollectAll` | `Setting_autodpEventCollectAll` | DP alles sammeln |
| `autodpEventCollectablesList` | `Setting_autodpEventCollectablesList` | DP Items |
| `autoLivelySceneEventCollect` | `Setting_autoLivelySceneEventCollect` | Lively Scene sammeln |
| `autoLivelySceneEventCollectAll` | `Setting_autoLivelySceneEventCollectAll` | Lively alles sammeln |
| `autoLivelySceneEventCollectablesList` | `Setting_autoLivelySceneEventCollectablesList` | Lively Items |
| `autoPoACollect` | `Setting_autoPoACollect` | Path of Attraction sammeln |
| `autoPoACollectAll` | `Setting_autoPoACollectAll` | PoA alles |
| `autoPoACollectablesList` | `Setting_autoPoACollectablesList` | PoA Items |
| `autoPoGCollect` | `Setting_autoPoGCollect` | Path of Glory sammeln |
| `autoPoGCollectAll` | `Setting_autoPoGCollectAll` | PoG alles |
| `autoPoGCollectablesList` | `Setting_autoPoGCollectablesList` | PoG Items |
| `autoPoVCollect` | `Setting_autoPoVCollect` | Path of Valor sammeln |
| `autoPoVCollectAll` | `Setting_autoPoVCollectAll` | PoV alles |
| `autoPoVCollectablesList` | `Setting_autoPoVCollectablesList` | PoV Items |

### Display/UI

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `showInfo` | `Setting_showInfo` | Info-Panel anzeigen |
| `showInfoLeft` | `Setting_showInfoLeft` | Info links |
| `showCalculatePower` | `Setting_showCalculatePower` | Power-Berechnung |
| `showClubButtonInPoa` | `Setting_showClubButtonInPoa` | Club-Button in PoA |
| `showRewardsRecap` | `Setting_showRewardsRecap` | Reward-Zusammenfassung |
| `showTooltips` | `Setting_showTooltips` | Tooltips anzeigen |
| `showAdsBack` | `Setting_showAdsBack` | Ads-Hintergrund |
| `mousePause` | `Setting_mousePause` | Maus-Pause |
| `mousePauseTimeout` | `Setting_mousePauseTimeout` | Maus-Pause Timeout |
| `collectAllTimer` | `Setting_collectAllTimer` | Sammel-Timer |
| `compactDailyGoals` | `Setting_compactDailyGoals` | Kompakte Goals |
| `compactEndedContests` | `Setting_compactEndedContests` | Kompakte Contests |
| `compactMissions` | `Setting_compactMissions` | Kompakte Missions |
| `compactPowerPlace` | `Setting_compactPowerPlace` | Kompakte PoP |
| `invertMissions` | `Setting_invertMissions` | Missions invertieren |
| `saveDefaults` | `Setting_saveDefaults` | Defaults speichern |
| `plusGirlSkins` | `Setting_plusGirlSkins` | Girl Skins |
| `sultryMysteriesEventRefreshShop` | `Setting_sultryMysteriesEventRefreshShop` | Sultry Mysteries Shop |
| `autoFreeBundlesCollect` | `Setting_autoFreeBundlesCollect` | Gratis Bundles |
| `autoFreeBundlesCollectablesList` | `Setting_autoFreeBundlesCollectablesList` | Bundle Items |

### Reward Masks

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `AllMaskRewards` | `Setting_AllMaskRewards` | Globale Reward-Maske |
| `PoAMaskRewards` | `Setting_PoAMaskRewards` | PoA Maske |
| `PoGMaskRewards` | `Setting_PoGMaskRewards` | PoG Maske |
| `PoVMaskRewards` | `Setting_PoVMaskRewards` | PoV Maske |
| `SeasonMaskRewards` | `Setting_SeasonMaskRewards` | Season Maske |
| `SeasonalEventMaskRewards` | `Setting_SeasonalEventMaskRewards` | Seasonal Event Maske |

---

## TK — Temp Keys (89 Konstanten in v7.35.10)

Die folgenden Tabellen listen die wichtigsten Gruppen. Vollstaendige Liste siehe `src/config/StorageKeys.ts` (Zeilen 261-385).

### Core Runtime

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `autoLoop` | `Temp_autoLoop` | AutoLoop aktiv |
| `autoLoopTimeMili` | `Temp_autoLoopTimeMili` | Loop-Intervall (ms) |
| `Debug` | `Temp_Debug` | Debug-Modus |
| `Logging` | `Temp_Logging` | Logging aktiviert |
| `Timers` | `Temp_Timers` | Timer-State (JSON) |
| `LastPageCalled` | `Temp_LastPageCalled` | Letzte aufgerufene Seite |
| `CheckSpentPoints` | `Temp_CheckSpentPoints` | Ausgegebene Punkte pruefen |
| `freshStart` | `Temp_freshStart` | Erster Start |
| `scriptversion` | `Temp_scriptversion` | Aktuelle Version |
| `pinfo` | `Temp_pinfo` | pInfo Panel State |

### Harem Runtime

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `HaremSize` | `Temp_HaremSize` | Harem-Groesse (JSON: {count}) |
| `filteredGirlsList` | `Temp_filteredGirlsList` | Gefilterte Girls-Liste |
| `haremGirlActions` | `Temp_haremGirlActions` | Aktive Girl-Aktionen |
| `haremGirlEnd` | `Temp_haremGirlEnd` | Girl-Aktion Ende |
| `haremGirlLimit` | `Temp_haremGirlLimit` | Girl-Limit |
| `haremGirlMode` | `Temp_haremGirlMode` | Girl-Modus |
| `haremGirlPayLast` | `Temp_haremGirlPayLast` | Letzte Zahlung |
| `haremGirlSpent` | `Temp_haremGirlSpent` | Ausgegebenes |
| `haremMoneyOnStart` | `Temp_haremMoneyOnStart` | Geld bei Start |
| `haremTeam` | `Temp_haremTeam` | Team-Daten (JSON) |
| `haremTeamScrolls` | `Temp_haremTeamScrolls` | Team-Scrolls |
| `haremTeamSettings` | `Temp_haremTeamSettings` | Team-Einstellungen |

### Ressourcen

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `haveAff` | `Temp_haveAff` | Affection verfuegbar |
| `haveBooster` | `Temp_haveBooster` | Booster verfuegbar |
| `haveExp` | `Temp_haveExp` | Experience verfuegbar |
| `charLevel` | `Temp_charLevel` | Charakter-Level |
| `storeContents` | `Temp_storeContents` | Shop-Inhalt |
| `boosterStatus` | `Temp_boosterStatus` | Booster-Status |
| `boosterStatusLastUpdate` | `Temp_boosterStatusLastUpdate` | Timestamp des letzten Booster-Status-Updates |
| `boosterIdMap` | `Temp_boosterIdMap` | Booster-ID Mapping |

### Troll Runtime

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `TrollHumanLikeRun` | `Temp_TrollHumanLikeRun` | Human-Like Troll Runs |
| `TrollInvalid` | `Temp_TrollInvalid` | Ungueltige Trolls |
| `trollPoints` | `Temp_trollPoints` | Troll-Punkte |
| `trollToFight` | `Temp_trollToFight` | Naechster Troll |
| `trollWithGirls` | `Temp_trollWithGirls` | Trolls mit Girls |
| `autoTrollBattleSaveQuest` | `Temp_autoTrollBattleSaveQuest` | Quest-Save |

### Quest Runtime

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `questRequirement` | `Temp_questRequirement` | Quest-Anforderungen |
| `MainAdventureWorldID` | `Temp_MainAdventureWorldID` | Haupt-Welt ID |
| `SideAdventureWorldID` | `Temp_SideAdventureWorldID` | Neben-Welt ID |

### Battle Runtime

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `battlePowerRequired` | `Temp_battlePowerRequired` | Benoetigte Power |
| `burst` | `Temp_burst` | Burst-Modus |
| `fought` | `Temp_fought` | Gekämpft-Flag |
| `lastActionPerformed` | `Temp_lastActionPerformed` | Letzte Aktion |

### Event Runtime

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `eventGirl` | `Temp_eventGirl` | Aktuelles Event-Girl |
| `eventMythicGirl` | `Temp_eventMythicGirl` | Mythic Event-Girl |
| `eventsGirlz` | `Temp_eventsGirlz` | Event-Girls (JSON) |
| `eventsList` | `Temp_eventsList` | Aktive Events |
| `autoChampsEventGirls` | `Temp_autoChampsEventGirls` | Champion Event Girls |
| `EventFightsBeforeRefresh` | `Temp_EventFightsBeforeRefresh` | Kaempfe vor Refresh |
| `loveRaids` | `Temp_loveRaids` | Love Raid Daten |
| `raidGirls` | `Temp_raidGirls` | Raid Girls |
| `bossBangTeam` | `Temp_bossBangTeam` | Boss Bang Team |
| `lseManualCollectAll` | `Temp_lseManualCollectAll` | LSE manuell sammeln |
| `poaManualCollectAll` | `Temp_poaManualCollectAll` | PoA manuell sammeln |

### Champion Runtime

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `champBuildTeam` | `Temp_champBuildTeam` | Champion Team bauen |
| `clubChampLimitReached` | `Temp_clubChampLimitReached` | Club-Limit erreicht |

### League Runtime

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `LeagueHumanLikeRun` | `Temp_LeagueHumanLikeRun` | Human-Like Liga Runs |
| `LeagueOpponentList` | `Temp_LeagueOpponentList` | Gegner-Liste |
| `LeagueSavedData` | `Temp_LeagueSavedData` | Gespeicherte Liga-Daten |
| `LeagueTempOpponentList` | `Temp_LeagueTempOpponentList` | Temp Gegner-Liste |
| `leaguesTarget` | `Temp_leaguesTarget` | Liga-Ziel |
| `hideBeatenOppo` | `Temp_hideBeatenOppo` | Besiegte ausblenden |

### Season/Pantheon Runtime

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `SeasonEndDate` | `Temp_SeasonEndDate` | Season-Ende |
| `SeasonHumanLikeRun` | `Temp_SeasonHumanLikeRun` | Human-Like Season |
| `SeasonalEventEndDate` | `Temp_SeasonalEventEndDate` | Seasonal Event Ende |
| `PantheonHumanLikeRun` | `Temp_PantheonHumanLikeRun` | Human-Like Pantheon |
| `PentaDrillHumanLikeRun` | `Temp_PentaDrillHumanLikeRun` | Human-Like Penta |

### Place of Power Runtime

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `PopToStart` | `Temp_PopToStart` | PoP zu starten |
| `PopTargeted` | `Temp_PopTargeted` | Anvisierter PoP |
| `PopUnableToStart` | `Temp_PopUnableToStart` | Nicht startbare PoP |
| `Totalpops` | `Temp_Totalpops` | Gesamt PoP |
| `currentlyAvailablePops` | `Temp_currentlyAvailablePops` | Verfuegbare PoP |

### Path Events Runtime

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `PoAEndDate` | `Temp_PoAEndDate` | PoA Ende |
| `PoGEndDate` | `Temp_PoGEndDate` | PoG Ende |
| `PoVEndDate` | `Temp_PoVEndDate` | PoV Ende |

### Sonstiges

| Konstante | Storage Key | Beschreibung |
|-----------|-------------|--------------|
| `dailyGoalsList` | `Temp_dailyGoalsList` | Daily Goals Liste |
| `NextSwitch` | `Temp_NextSwitch` | Naechster Switch |
| `paranoiaLeagueBlocked` | `Temp_paranoiaLeagueBlocked` | Paranoia Liga blockiert |
| `paranoiaQuestBlocked` | `Temp_paranoiaQuestBlocked` | Paranoia Quest blockiert |
| `paranoiaSpendings` | `Temp_paranoiaSpendings` | Paranoia Ausgaben |
| `sandalwoodFailure` | `Temp_sandalwoodFailure` | Sandalwood Fehler |
| `sandalwoodMaxUsages` | `Temp_sandalwoodMaxUsages` | Sandalwood Max |
| `unkownPagesList` | `Temp_unkownPagesList` | Unbekannte Seiten |
| `userLink` | `Temp_userLink` | User Link |
| `surveyShown` | `Temp_surveyShown` | Survey angezeigt |
| `surveyDismissCount` | `Temp_surveyDismissCount` | Survey Dismiss Count |
| `surveyLastHash` | `Temp_surveyLastHash` | Survey Hash |
| `featurePopupShown` | `Temp_featurePopupShown` | Feature Popup angezeigt |
| `featurePopupDismissCount` | `Temp_featurePopupDismissCount` | Feature Popup Dismiss |
