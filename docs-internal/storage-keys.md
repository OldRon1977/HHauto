---
last-verified: 2026-08-20
verified-against-version: 8.10.11
status: current
---

# Storage Keys Referenz

Alle localStorage / sessionStorage Schluessel des HHauto Skripts.

**Code-Stand (2026-08-20, gegen v8.10.11 nachgezaehlt):** 186 SK- und 99
TK-Konstanten in `StorageKeys.ts`, 277 davon registriert; 8 sind nicht in
`HHStoredVars.ts` registriert. Am 2026-08-19 wurden die acht toten Keys
entfernt (siehe unten); die drei Keys des neuen Settings-Menue-Layouts
(`menuSingleColumn`, `menuOrder`, `menuTab`) sind seit v8.10.0 dazugekommen. Nachgezaehlt wurden Bestand, Storage-Typ, HHType und
Registrierung jedes Keys gegen den Code -- die Beschreibungstexte der vor
2026-08-19 bestehenden Zeilen stammen unveraendert aus der letzten
vollstaendigen Verifikation vom 2026-05-05 gegen v7.35.21.

---

## Architektur

### Dateien

- `src/config/StorageKeys.ts` -- SK und TK Konstanten (Definitionen)
- `src/config/HHStoredVars.ts` -- Registry mit Defaults, Validierung, UI-Metadaten
- `src/Helper/StorageHelper.ts` -- Storage-Abstraktionsschicht

### Prefix-System

- Alle Keys werden mit `HHStoredVarPrefixKey` (= `"HHAuto_"`) prefixed
- Beispiel: `HHStoredVarPrefixKey + SK.master` wird zu `"HHAuto_Setting_master"`

### Storage-Typ

Drei moegliche Werte fuer das `storage`-Feld in `HHStoredVars.ts`:

| Wert | Bedeutung |
|---|---|
| `"localStorage"` | persistent, ueberlebt Browser-Restart |
| `"sessionStorage"` | nur fuer aktuellen Tab |
| `"Storage()"` | Auswahl zur Laufzeit anhand `SK.settPerTab`: wenn aktiv -> sessionStorage, sonst localStorage |

Fakten aus dem Code-Stand v7.35.21:

| Storage-Typ | Anzahl Variablen |
|---|---|
| `Storage()` | 174 |
| `sessionStorage` | 68 |
| `localStorage` | 17 |

### HHType

| HHType | Bedeutung | Anzahl |
|---|---|---|
| `Setting` | Benutzer-Einstellung (auf der UI sichtbar) | 173 |
| `Temp` | Laufzeit-State (intern) | 86 |

### Kern-Funktionen (`StorageHelper.ts`)

- `getStoredValue(key)` -- Wert lesen. Gibt `undefined` zurueck wenn der Key nicht in `HHStoredVars` registriert ist.
- `setStoredValue(key, value)` -- Wert schreiben. Bei Storage-Voll-Fehler: einmaliger Cleanup-Retry. Unregistrierte Keys werden ohne Fehler verworfen.
- `deleteStoredValue(key)` -- Wert loeschen.
- `getStoredJSON<T>(key, default, reviver?)` -- JSON parsen mit Default-Fallback bei Parse-Fehler.
- `getStorage()` -- aktueller Default-Storage abhaengig von `SK.settPerTab`.
- `getStorageItem(type)` -- Auflöser fuer `"localStorage"` / `"sessionStorage"` / `"Storage()"`.

### Registrierungspflicht

Eine Konstante in `StorageKeys.ts` (SK oder TK) ist allein **nicht ausreichend**. Der zugehoerige Eintrag in `HHStoredVars.ts` mit `storage`, `HHType`, `default` etc. ist Pflicht. Fehlende Registrierung wird zur Laufzeit ohne Warnung silent ignoriert -- lesen liefert `undefined`, schreiben verfaellt.

Die `kobanUsing: true`-Flag bei einer Setting verknuepft sie zusaetzlich mit dem globalen Schalter `SK.spendKobans0`: wenn der Master-Switch aus ist, liest `getStoredValue` immer `"false"` zurueck, unabhaengig vom gespeicherten Wert.

### Migration

`migrateHHVars()` in `StorageHelper.ts` ist aktuell auskommentiert. Wenn ein Setting-Key umbenannt wird (z.B. `Setting_MaxAff` -> `Setting_maxAff`), kann hier ein Mapping eingetragen werden, damit alte Storage-Eintraege automatisch in den neuen Key kopiert werden.

---

> **Code-Referenzen:** Wo jeder Key gelesen, geschrieben oder geloescht wird, dokumentiert data-sources-inventory.md Sektion 7 (vollstaendige Read/Write/Delete-Tabelle, automatisch aus Code regeneriert).

## SK -- Setting Keys (186 Konstanten)

Vollstaendige Liste aller SK-Konstanten in der Reihenfolge wie in `StorageKeys.ts`. Quelle: Code, automatisch generiert. Beschreibungen aus der vorigen Doku-Version uebernommen.

Die Spalte "Storage" zeigt den Wert aus der Registry. `--` heisst: nicht in `HHStoredVars.ts` registriert (Key funktioniert nicht).

### Master switch

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `master` | `Setting_master` | `Storage()` | `Setting` | Hauptschalter ein/aus |
| `settPerTab` | `Setting_settPerTab` | `localStorage` | `Setting` | SessionStorage statt localStorage |
| `spendKobans0` | `Setting_spendKobans0` | `Storage()` | `Setting` | Hauptschalter Koban-Ausgaben |

### Troll

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoTrollBattle` | `Setting_autoTrollBattle` | `Storage()` | `Setting` | Troll-Kampf aktiviert |
| `autoTrollThreshold` | `Setting_autoTrollThreshold` | `Storage()` | `Setting` | Min. Energie-Schwelle |
| `autoTrollRunThreshold` | `Setting_autoTrollRunThreshold` | `Storage()` | `Setting` | Min. Runs |
| `autoTrollSelectedIndex` | `Setting_autoTrollSelectedIndex` | `Storage()` | `Setting` | Ausgewaehlter Troll |
| `autoTrollMythicByPassParanoia` | `Setting_autoTrollMythicByPassParanoia` | `Storage()` | `Setting` | Mythic ignoriert Paranoia |
| `eventTrollOrder` | `Setting_eventTrollOrder` | `Storage()` | `Setting` | Event-Troll-Reihenfolge |
| `useX10Fights` | `Setting_useX10Fights` | `Storage()` | `Setting` | x10 Kaempfe nutzen |
| `useX10FightsAllowNormalEvent` | `Setting_useX10FightsAllowNormalEvent` | `Storage()` | `Setting` | x10 auch bei normalen Events |
| `useX50Fights` | `Setting_useX50Fights` | `Storage()` | `Setting` | x50 Kaempfe nutzen |
| `useX50FightsAllowNormalEvent` | `Setting_useX50FightsAllowNormalEvent` | `Storage()` | `Setting` | x50 auch bei normalen Events |
| `minShardsX10` | `Setting_minShardsX10` | `Storage()` | `Setting` | Min. Shards fuer x10 |
| `minShardsX50` | `Setting_minShardsX50` | `Storage()` | `Setting` | Min. Shards fuer x50 |
| `sandalwoodMinShardsThreshold` | `Setting_sandalwoodMinShardsThreshold` | `Storage()` | `Setting` | Sandalwood-Mindest-Shard-Schwelle (ersetzt seit v7.35.x die vier alten `sandalwoodShardsX10Limit`, `sandalwoodShardsX1Limit`, `sandalwoodDosesX10Limit`, `sandalwoodDosesX1Limit` Keys; alte Keys sind in v7.35.10 nicht mehr im Code) |
| `kobanBank` | `Setting_kobanBank` | `Storage()` | `Setting` | Koban-Reserve |
| `buyCombat` | `Setting_buyCombat` | `Storage()` | `Setting` | Kampf-Energie kaufen |
| `buyCombTimer` | `Setting_buyCombTimer` | `Storage()` | `Setting` | Kauf-Timer |
| `buyMythicCombat` | `Setting_buyMythicCombat` | `Storage()` | `Setting` | Mythic Kampf-Energie kaufen |
| `buyMythicCombTimer` | `Setting_buyMythicCombTimer` | `Storage()` | `Setting` | Mythic Kauf-Timer |
| `buyLoveRaidCombat` | `Setting_buyLoveRaidCombat` | `Storage()` | `Setting` | Love Raid Energie kaufen |
| `autoBuyTrollNumber` | `Setting_autoBuyTrollNumber` | `Storage()` | `Setting` | Auto-Kauf Troll Anzahl |
| `autoBuyMythicTrollNumber` | `Setting_autoBuyMythicTrollNumber` | `Storage()` | `Setting` | Auto-Kauf Mythic Anzahl |
| `autoBuyLoveRaidTrollNumber` | `Setting_autoBuyLoveRaidTrollNumber` | `Storage()` | `Setting` | Auto-Kauf Love Raid Anzahl |

### Champion

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoChamps` | `Setting_autoChamps` | `Storage()` | `Setting` | Champion aktiviert |
| `autoChampsFilter` | `Setting_autoChampsFilter` | `Storage()` | `Setting` | Champion Filter |
| `autoChampsForceStart` | `Setting_autoChampsForceStart` | `Storage()` | `Setting` | Force Start |
| `autoChampsForceStartEventGirl` | `Setting_autoChampsForceStartEventGirl` | `Storage()` | `Setting` | Force Start Event-Girl |
| `autoChampsGirlThreshold` | `Setting_autoChampsGirlThreshold` | `Storage()` | `Setting` | Girl-Schwelle |
| `autoChampsTeamLoop` | `Setting_autoChampsTeamLoop` | `Storage()` | `Setting` | Team-Rotation |
| `autoChampsTeamKeepSecondLine` | `Setting_autoChampsTeamKeepSecondLine` | `Storage()` | `Setting` | Zweite Reihe behalten |
| `autoChampsUseEne` | `Setting_autoChampsUseEne` | `Storage()` | `Setting` | Energie nutzen |
| `autoChampAlignTimer` | `Setting_autoChampAlignTimer` | `Storage()` | `Setting` | Align Timer |
| `autoBuildChampsTeam` | `Setting_autoBuildChampsTeam` | `Storage()` | `Setting` | Auto-Team bauen |

### Club Champion

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoClubChamp` | `Setting_autoClubChamp` | `Storage()` | `Setting` | Club Champion aktiviert |
| `autoClubChampMax` | `Setting_autoClubChampMax` | `Storage()` | `Setting` | Max Kaempfe |
| `autoClubForceStart` | `Setting_autoClubForceStart` | `Storage()` | `Setting` | Force Start |

### League

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoLeagues` | `Setting_autoLeagues` | `Storage()` | `Setting` | Liga aktiviert |
| `autoLeaguesCollect` | `Setting_autoLeaguesCollect` | `Storage()` | `Setting` | Liga Rewards sammeln |
| `autoLeaguesThreshold` | `Setting_autoLeaguesThreshold` | `Storage()` | `Setting` | Min. Gewinnchance |
| `autoLeaguesSecurityThreshold` | `Setting_autoLeaguesSecurityThreshold` | `Storage()` | `Setting` | Sicherheits-Schwelle |
| `autoLeaguesRunThreshold` | `Setting_autoLeaguesRunThreshold` | `Storage()` | `Setting` | Min. Runs |
| `autoLeaguesBoostedOnly` | `Setting_autoLeaguesBoostedOnly` | `Storage()` | `Setting` | Nur mit Boost |
| `autoLeaguesForceOneFight` | `Setting_autoLeaguesForceOneFight` | `Storage()` | `Setting` | Min. 1 Kampf erzwingen |
| `autoLeaguesSelectedIndex` | `Setting_autoLeaguesSelectedIndex` | `Storage()` | `Setting` | Auswahl-Index |
| `autoLeaguesSortIndex` | `Setting_autoLeaguesSortIndex` | `Storage()` | `Setting` | Sortier-Index |
| `autoLeaguesAllowWinCurrent` | `Setting_autoLeaguesAllowWinCurrent` | `Storage()` | `Setting` | Aktuellen Sieg erlauben |
| `leagueListDisplayPowerCalc` | `Setting_leagueListDisplayPowerCalc` | `Storage()` | `Setting` | Power-Anzeige |

### Season

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoSeason` | `Setting_autoSeason` | `Storage()` | `Setting` | Season aktiviert |
| `autoSeasonThreshold` | `Setting_autoSeasonThreshold` | `Storage()` | `Setting` | Gewinnchance-Schwelle |
| `autoSeasonRunThreshold` | `Setting_autoSeasonRunThreshold` | `Storage()` | `Setting` | Min. Runs |
| `autoSeasonBoostedOnly` | `Setting_autoSeasonBoostedOnly` | `Storage()` | `Setting` | Nur mit Boost |
| `autoSeasonCollect` | `Setting_autoSeasonCollect` | `Storage()` | `Setting` | Rewards sammeln |
| `autoSeasonCollectAll` | `Setting_autoSeasonCollectAll` | `Storage()` | `Setting` | Alle Rewards |
| `autoSeasonCollectablesList` | `Setting_autoSeasonCollectablesList` | `Storage()` | `Setting` | Sammelbare Items |
| `autoSeasonFocus` | `Setting_autoSeasonIgnoreNoGirls` | `Storage()` | `Setting` | Season-Fokus (off/girl/girlAndSkin) |
| `autoSeasonPassReds` | `Setting_autoSeasonPassReds` | `Storage()` | `Setting` | Rote ueberspringen |
| `autoSeasonSkipLowMojo` | `Setting_autoSeasonSkipLowMojo` | `Storage()` | `Setting` | Niedrige Mojo ueberspringen |
| `seasonDisplayPowerCalc` | `Setting_seasonDisplayPowerCalc` | `Storage()` | `Setting` | Power-Anzeige |
| `autoSeasonMaxTier` | `Setting_autoSeasonMaxTier` | `Storage()` | `Setting` | Max Tier |
| `autoSeasonMaxTierNb` | `Setting_autoSeasonMaxTierNb` | `Storage()` | `Setting` | Max Tier Anzahl |
| `autoSeasonMaxTierHard` | `Setting_autoSeasonMaxTierHard` | `Storage()` | `Setting` | Max Tier harte Grenze |

### Pantheon

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoPantheon` | `Setting_autoPantheon` | `Storage()` | `Setting` | Pantheon aktiviert |
| `autoPantheonThreshold` | `Setting_autoPantheonThreshold` | `Storage()` | `Setting` | Schwelle |
| `autoPantheonRunThreshold` | `Setting_autoPantheonRunThreshold` | `Storage()` | `Setting` | Min. Runs |
| `autoPantheonBoostedOnly` | `Setting_autoPantheonBoostedOnly` | `Storage()` | `Setting` | Nur mit Boost |

### PentaDrill

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoPentaDrill` | `Setting_autoPentaDrill` | `Storage()` | `Setting` | Penta Drill aktiviert |
| `autoPentaDrillThreshold` | `Setting_autoPentaDrillThreshold` | `Storage()` | `Setting` | Schwelle |
| `autoPentaDrillDelay` | `Setting_autoPentaDrillDelay` | `Storage()` | `Setting` | Verzoegerung zwischen PentaDrill-Aktionen (3-20 s, Default 6) |
| `autoPentaDrillRunThreshold` | `Setting_autoPentaDrillRunThreshold` | `Storage()` | `Setting` | Min. Runs |
| `autoPentaDrillBoostedOnly` | `Setting_autoPentaDrillBoostedOnly` | `Storage()` | `Setting` | Nur mit Boost |
| `autoPentaDrillCollect` | `Setting_autoPentaDrillCollect` | `Storage()` | `Setting` | Sammeln |
| `autoPentaDrillCollectAll` | `Setting_autoPentaDrillCollectAll` | `Storage()` | `Setting` | Alles sammeln |
| `autoPentaDrillCollectablesList` | `Setting_autoPentaDrillCollectablesList` | `Storage()` | `Setting` | Sammelbare Items |

### Quest

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoQuest` | `Setting_autoQuest` | `Storage()` | `Setting` | Quest aktiviert |
| `autoQuestThreshold` | `Setting_autoQuestThreshold` | `Storage()` | `Setting` | Energie-Schwelle |
| `autoSideQuest` | `Setting_autoSideQuest` | `Storage()` | `Setting` | Side Quest |

### Mission

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoMission` | `Setting_autoMission` | `Storage()` | `Setting` | Mission aktiviert |
| `autoMissionCollect` | `Setting_autoMissionCollect` | `Storage()` | `Setting` | Missions sammeln |
| `autoMissionKFirst` | `Setting_autoMissionKFirst` | `Storage()` | `Setting` | K zuerst |

### Labyrinth

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoLabyrinth` | `Setting_autoLabyrinth` | `Storage()` | `Setting` | Labyrinth aktiviert |
| `autoLabyHard` | `Setting_autoLabyHard` | `Storage()` | `Setting` | Hard Mode |
| `autoLabySweep` | `Setting_autoLabySweep` | `Storage()` | `Setting` | Sweep |
| `autoLabyDifficultyIndex` | `Setting_autoLabyDifficultyIndex` | `Storage()` | `Setting` | Schwierigkeits-Index |
| `autoLabyCustomTeamBuilder` | `Setting_autoLabyCustomTeamBuilder` | `Storage()` | `Setting` | Custom Team Builder |

### Place of Power

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoPowerPlaces` | `Setting_autoPowerPlaces` | `Storage()` | `Setting` | PoP aktiviert |
| `autoPowerPlacesAll` | `Setting_autoPowerPlacesAll` | `Storage()` | `Setting` | Alle PoP |
| `autoPowerPlacesIndexFilter` | `Setting_autoPowerPlacesIndexFilter` | `Storage()` | `Setting` | Index-Filter |
| `autoPowerPlacesInverted` | `Setting_autoPowerPlacesInverted` | `Storage()` | `Setting` | Invertiert |
| `autoPowerPlacesPrecision` | `Setting_autoPowerPlacesPrecision` | `Storage()` | `Setting` | Praezision |
| `autoPowerPlacesWaitMax` | `Setting_autoPowerPlacesWaitMax` | `Storage()` | `Setting` | Max Wartezeit |

### Shop / Market

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoAff` | `Setting_autoAff` | `Storage()` | `Setting` | Auto Affection kaufen |
| `autoAffW` | `Setting_autoAffW` | `Storage()` | `Setting` | Affection Wert |
| `autoExp` | `Setting_autoExp` | `Storage()` | `Setting` | Auto Experience kaufen |
| `autoExpW` | `Setting_autoExpW` | `Storage()` | `Setting` | Experience Wert |
| `maxAff` | `Setting_maxAff` | `Storage()` | `Setting` | Max Affection |
| `maxExp` | `Setting_maxExp` | `Storage()` | `Setting` | Max Experience |
| `maxBooster` | `Setting_maxBooster` | `Storage()` | `Setting` | Max Booster |
| `autoBuyBoosters` | `Setting_autoBuyBoosters` | `Storage()` | `Setting` | Booster kaufen |
| `autoBuyBoostersFilter` | `Setting_autoBuyBoostersFilter` | `Storage()` | `Setting` | Booster-Filter |
| `autoEquipBoosters` | `Setting_autoEquipBoosters` | `Storage()` | `Setting` | Booster ausruesten |
| `autoEquipBoostersSlots` | `Setting_autoEquipBoostersSlots` | `Storage()` | `Setting` | Booster-Slots |
| `autoEquipMythicBooster` | `Setting_autoEquipMythicBooster` | `Storage()` | `Setting` | Prioritaetsliste der Mythic-Booster fuer die freien Mythic-Slots |
| `updateMarket` | `Setting_updateMarket` | `Storage()` | `Setting` | Markt aktualisieren |
| `showMarketTools` | `Setting_showMarketTools` | `Storage()` | `Setting` | Markt-Tools anzeigen |

### Harem / Salary

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoSalary` | `Setting_autoSalary` | `Storage()` | `Setting` | Auto Gehalt sammeln |
| `autoSalaryMinSalary` | `Setting_autoSalaryMinSalary` | `Storage()` | `Setting` | Min. Gehalt |
| `autoStats` | `Setting_autoStats` | `Storage()` | `Setting` | Auto Stats |
| `autoStatsSwitch` | `Setting_autoStatsSwitch` | `Storage()` | `Setting` | Stats Switch |
| `hideOwnedGirls` | `Setting_hideOwnedGirls` | `Storage()` | `Setting` | Eigene Girls ausblenden |
| `showHaremAvatarMissingGirls` | `Setting_showHaremAvatarMissingGirls` | `Storage()` | `Setting` | Fehlende Girls anzeigen |
| `showHaremTools` | `Setting_showHaremTools` | `Storage()` | `Setting` | Harem-Tools |
| `showHaremSkillsButtons` | `Setting_showHaremSkillsButtons` | `Storage()` | `Setting` | Skill-Buttons |

### Pachinko

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoFreePachinko` | `Setting_autoFreePachinko` | `Storage()` | `Setting` | Gratis Pachinko |

### Daily Goals

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoDailyGoals` | `Setting_autoDailyGoals` | `Storage()` | `Setting` | Daily Goals |
| `autoDailyGoalsCollect` | `Setting_autoDailyGoalsCollect` | `Storage()` | `Setting` | Goals sammeln |
| `autoDailyGoalsCollectablesList` | `Setting_autoDailyGoalsCollectablesList` | `Storage()` | `Setting` | Sammelbare Goals |

### Contest

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoContest` | `Setting_autoContest` | `Storage()` | `Setting` | Contest aktiviert |
| `waitforContest` | `Setting_waitforContest` | `Storage()` | `Setting` | Auf Contest warten |
| `safeSecondsForContest` | `Setting_safeSecondsForContest` | `Storage()` | `Setting` | Sicherheits-Sekunden |

### Paranoia

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `paranoia` | `Setting_paranoia` | `Storage()` | `Setting` | Paranoia aktiviert |
| `paranoiaSettings` | `Setting_paranoiaSettings` | `Storage()` | `Setting` | Paranoia-Einstellungen |
| `paranoiaSpendsBefore` | `Setting_paranoiaSpendsBefore` | `Storage()` | `Setting` | Ausgaben vor Pause |

### Girl Skins (applies to Events and Raids)

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `plusGirlSkins` | `Setting_plusGirlSkins` | `Storage()` | `Setting` | Girl Skins |

### Boosters / Events

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `plusEvent` | `Setting_plusEvent` | `Storage()` | `Setting` | Event aktiviert |
| `plusEventMythic` | `Setting_plusEventMythic` | `Storage()` | `Setting` | Mythic Event |
| `plusEventSandalWood` | `Setting_plusEventSandalWood` | `Storage()` | `Setting` | Sandalwood Event |
| `plusEventMythicSandalWood` | `Setting_plusEventMythicSandalWood` | `Storage()` | `Setting` | Mythic Sandalwood |
| `plusLoveRaid` | `Setting_plusLoveRaid` | `Storage()` | `Setting` | Love Raid |
| `autoTrollLoveRaidByPassThreshold` | `Setting_autoTrollLoveRaidByPassThreshold` | `Storage()` | `Setting` | Love Raid Bypass |
| `plusEventLoveRaidSandalWood` | `Setting_plusEventLoveRaidSandalWood` | `Storage()` | `Setting` | Love Raid Sandalwood |
| `bossBangEvent` | `Setting_bossBangEvent` | `Storage()` | `Setting` | Boss Bang |
| `bossBangMinTeam` | `Setting_bossBangMinTeam` | `Storage()` | `Setting` | Boss Bang Min Team |
| `collectEventChest` | `Setting_collectEventChest` | `Storage()` | `Setting` | Event Chest sammeln |

### Seasonal Event

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoSeasonalBuyFreeCard` | `Setting_autoSeasonalBuyFreeCard` | `Storage()` | `Setting` | Gratis-Karte kaufen |
| `autoSeasonalEventCollect` | `Setting_autoSeasonalEventCollect` | `Storage()` | `Setting` | Seasonal sammeln |
| `autoSeasonalEventCollectAll` | `Setting_autoSeasonalEventCollectAll` | `Storage()` | `Setting` | Alles sammeln |
| `autoSeasonalEventCollectablesList` | `Setting_autoSeasonalEventCollectablesList` | `Storage()` | `Setting` | Sammelbare Items |

### Double Penetration Event

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autodpEventCollect` | `Setting_autodpEventCollect` | `Storage()` | `Setting` | DP Event sammeln |
| `autodpEventCollectAll` | `Setting_autodpEventCollectAll` | `Storage()` | `Setting` | DP alles sammeln |
| `autodpEventCollectablesList` | `Setting_autodpEventCollectablesList` | `Storage()` | `Setting` | DP Items |

### Lively Scene Event

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoLivelySceneEventCollect` | `Setting_autoLivelySceneEventCollect` | `Storage()` | `Setting` | Lively Scene sammeln |
| `autoLivelySceneEventCollectAll` | `Setting_autoLivelySceneEventCollectAll` | `Storage()` | `Setting` | Lively alles sammeln |
| `autoLivelySceneEventCollectablesList` | `Setting_autoLivelySceneEventCollectablesList` | `Storage()` | `Setting` | Lively Items |

### Path Events

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoPoACollect` | `Setting_autoPoACollect` | `Storage()` | `Setting` | Path of Attraction sammeln |
| `autoPoACollectAll` | `Setting_autoPoACollectAll` | `Storage()` | `Setting` | PoA alles |
| `autoPoACollectablesList` | `Setting_autoPoACollectablesList` | `Storage()` | `Setting` | PoA Items |
| `autoPoGCollect` | `Setting_autoPoGCollect` | `Storage()` | `Setting` | Path of Glory sammeln |
| `autoPoGCollectAll` | `Setting_autoPoGCollectAll` | `Storage()` | `Setting` | PoG alles |
| `autoPoGCollectablesList` | `Setting_autoPoGCollectablesList` | `Storage()` | `Setting` | PoG Items |
| `autoPoVCollect` | `Setting_autoPoVCollect` | `Storage()` | `Setting` | Path of Valor sammeln |
| `autoPoVCollectAll` | `Setting_autoPoVCollectAll` | `Storage()` | `Setting` | PoV alles |
| `autoPoVCollectablesList` | `Setting_autoPoVCollectablesList` | `Storage()` | `Setting` | PoV Items |

### Love Raid

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoLoveRaidSelectedIndex` | `Setting_autoLoveRaidSelectedIndex` | `Storage()` | `Setting` | Love Raid Auswahl |
| `plusLoveRaidMythic` | `Setting_autoLoveRaidMythicOnly` | `Storage()` | `Setting` | now stores min grade (0=off, 3, 5, 6) instead of boolean |

### Bundles

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoFreeBundlesCollect` | `Setting_autoFreeBundlesCollect` | `Storage()` | `Setting` | Gratis Bundles |
| `autoFreeBundlesCollectablesList` | `Setting_autoFreeBundlesCollectablesList` | `Storage()` | `Setting` | Bundle Items |

### Sultry Mysteries

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `sultryMysteriesEventRefreshShop` | `Setting_sultryMysteriesEventRefreshShop` | `Storage()` | `Setting` | Sultry Mysteries Shop |
| `sultryMysteriesAutoOpen` | `Setting_sultryMysteriesAutoOpen` | `Storage()` | `Setting` | Auto-Mystery: Grid-Felder oeffnen (v8.6.0) |
| `sultryMysteriesAutoOpenCollectablesList` | `Setting_sultryMysteriesAutoOpenCollectablesList` | `Storage()` | `Setting` (Array) | Belohnungs-Typen, die vor einem Reroll gefunden sein muessen (v8.6.0) |

Timer: `eventSultryMysteryGoing` (Event-Restlaufzeit), `eventSultryMysteryShopRefresh`
(naechster Shop-Restock), `eventSultryMysteryAutoOpen` (naechste Key-Pruefung,
1 h nachdem die Keys leer waren -- im Info-Panel als "Auto-Mystery").

### Display / UI

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `showInfo` | `Setting_showInfo` | `Storage()` | `Setting` | Info-Panel anzeigen |
| `showInfoLeft` | `Setting_showInfoLeft` | `Storage()` | `Setting` | Info links |
| `showCalculatePower` | `Setting_showCalculatePower` | `Storage()` | `Setting` | Power-Berechnung |
| `showClubButtonInPoa` | `Setting_showClubButtonInPoa` | `Storage()` | `Setting` | Club-Button in PoA |
| `showRewardsRecap` | `Setting_showRewardsRecap` | `Storage()` | `Setting` | Reward-Zusammenfassung |
| `showTooltips` | `Setting_showTooltips` | `Storage()` | `Setting` | Tooltips anzeigen |
| `showAdsBack` | `Setting_showAdsBack` | `Storage()` | `Setting` | Ads-Hintergrund |
| `autoAdsClick` | `Setting_autoAdsClick` | `Storage()` | `Setting` | Reward-Ads der Home-Seite klicken und bestaetigen |
| `mousePause` | `Setting_mousePause` | `Storage()` | `Setting` | Maus-Pause |
| `mousePauseTimeout` | `Setting_mousePauseTimeout` | `Storage()` | `Setting` | Maus-Pause Timeout |
| `collectAllTimer` | `Setting_collectAllTimer` | `Storage()` | `Setting` | Sammel-Timer |
| `compactDailyGoals` | `Setting_compactDailyGoals` | `Storage()` | `Setting` | Kompakte Goals |
| `compactEndedContests` | `Setting_compactEndedContests` | `Storage()` | `Setting` | Kompakte Contests |
| `compactMissions` | `Setting_compactMissions` | `Storage()` | `Setting` | Kompakte Missions |
| `compactPowerPlace` | `Setting_compactPowerPlace` | `Storage()` | `Setting` | Kompakte PoP |
| `invertMissions` | `Setting_invertMissions` | `Storage()` | `Setting` | Missions invertieren |
| `saveDefaults` | `Setting_saveDefaults` | `localStorage` | `Setting` | Defaults speichern |
| `pipelineDiagnose` | `Setting_pipelineDiagnose` | `localStorage` | `Setting` | Zusaetzliche `[PIPE]`-Details je Schritt ins Log (Default aus) |

### Reward Masks

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `AllMaskRewards` | `Setting_AllMaskRewards` | `Storage()` | `Setting` | Globale Reward-Maske |
| `PoAMaskRewards` | `Setting_PoAMaskRewards` | `**--**` | `**--**` | PoA Maske |
| `PoGMaskRewards` | `Setting_PoGMaskRewards` | `**--**` | `**--**` | PoG Maske |
| `PoVMaskRewards` | `Setting_PoVMaskRewards` | `**--**` | `**--**` | PoV Maske |
| `SeasonMaskRewards` | `Setting_SeasonMaskRewards` | `**--**` | `**--**` | Season Maske |
| `SeasonalEventMaskRewards` | `Setting_SeasonalEventMaskRewards` | `**--**` | `**--**` | Seasonal Event Maske |

---

## TK -- Temp Keys (99 Konstanten)

### (unsorted)

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `autoLoop` | `Temp_autoLoop` | `sessionStorage` | `Temp` | AutoLoop aktiv |
| `autoLoopTimeMili` | `Temp_autoLoopTimeMili` | `Storage()` | `Temp` | Loop-Intervall (ms) |
| `Debug` | `Temp_Debug` | `sessionStorage` | `Temp` | Debug-Modus |
| `Logging` | `Temp_Logging` | `sessionStorage` | `Temp` | Logging aktiviert |
| `Timers` | `Temp_Timers` | `sessionStorage` | `Temp` | Timer-State (JSON) |
| `LastPageCalled` | `Temp_LastPageCalled` | `sessionStorage` | `Temp` | Letzte aufgerufene Seite |
| `CheckSpentPoints` | `Temp_CheckSpentPoints` | `sessionStorage` | `Temp` | Ausgegebene Punkte pruefen |
| `freshStart` | `Temp_freshStart` | `Storage()` | `Temp` | Erster Start |
| `scriptversion` | `Temp_scriptversion` | `localStorage` | `Temp` | Aktuelle Version |
| `pinfo` | `Temp_pinfo` | `sessionStorage` | `Temp` | pInfo Panel State |

### Harem

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `HaremSize` | `Temp_HaremSize` | `localStorage` | `Temp` | Harem-Groesse (JSON: {count}) |
| `filteredGirlsList` | `Temp_filteredGirlsList` | `sessionStorage` | `Temp` | Gefilterte Girls-Liste |
| `haremGirlActions` | `Temp_haremGirlActions` | `sessionStorage` | `Temp` | Aktive Girl-Aktionen |
| `haremGirlEnd` | `Temp_haremGirlEnd` | `sessionStorage` | `Temp` | Girl-Aktion Ende |
| `haremGirlLimit` | `Temp_haremGirlLimit` | `sessionStorage` | `Temp` | Girl-Limit |
| `haremGirlMode` | `Temp_haremGirlMode` | `sessionStorage` | `Temp` | Girl-Modus |
| `haremGirlPayLast` | `Temp_haremGirlPayLast` | `sessionStorage` | `Temp` | Letzte Zahlung |
| `haremGirlSpent` | `Temp_haremGirlSpent` | `**--**` | `**--**` | Ausgegebenes |
| `haremMoneyOnStart` | `Temp_haremMoneyOnStart` | `sessionStorage` | `Temp` | Geld bei Start |
| `haremTeam` | `Temp_haremTeam` | `sessionStorage` | `Temp` | Team-Daten (JSON) |
| `haremTeamScrolls` | `Temp_haremTeamScrolls` | `sessionStorage` | `Temp` | Team-Scrolls |
| `haremTeamSettings` | `Temp_haremTeamSettings` | `sessionStorage` | `Temp` | Team-Einstellungen |
| `blessingsCache` | `Temp_blessingsCache` | `localStorage` | `Temp` | Blessing-API-Cache (`BlessingData` JSON), 12 h Lebensdauer, gesetzt in `BlessingService.fetchAndCache` |
| `teamInfoCollapsed` | `Temp_teamInfoCollapsed` | `localStorage` | `Temp` | Team-Info-Panel eingeklappt (`TeamModule`) |
| `teamTheme` | `Temp_teamTheme` | `localStorage` | `Temp` | Thema des zuletzt gebauten Teams; der Gear-Optimizer braucht es auf der Market-Seite, wo das Team nicht verfuegbar ist |
| `gearSwapLog` | `Temp_gearSwapLog` | `localStorage` | `Temp` | Inventar-IDs der vom Gear-Optimizer abgelegten Items, damit ein Rollback moeglich bleibt (ID aendert sich bei jedem Unequip) |
| `gearUpgradeQueue` | `Temp_gearUpgradeQueue` | `localStorage` | `Temp` | Items, die "Upgrade Gear" noch leveln muss; ueber die Navigationen zur Upgrade-Seite hinweg abgearbeitet |

### Resources

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `haveAff` | `Temp_haveAff` | `sessionStorage` | `Temp` | Affection verfuegbar |
| `haveBooster` | `Temp_haveBooster` | `sessionStorage` | `Temp` | Booster verfuegbar |
| `haveExp` | `Temp_haveExp` | `sessionStorage` | `Temp` | Experience verfuegbar |
| `charLevel` | `Temp_charLevel` | `sessionStorage` | `Temp` | Charakter-Level |
| `storeContents` | `Temp_storeContents` | `sessionStorage` | `Temp` | Shop-Inhalt |
| `boosterStatus` | `Temp_boosterStatus` | `sessionStorage` | `Temp` | Booster-Status |
| `boosterStatusLastUpdate` | `Temp_boosterStatusLastUpdate` | `sessionStorage` | `Temp` | Timestamp des letzten Booster-Status-Updates |
| `boosterIdMap` | `Temp_boosterIdMap` | `sessionStorage` | `Temp` | Booster-ID Mapping |

### Troll

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `TrollHumanLikeRun` | `Temp_TrollHumanLikeRun` | `sessionStorage` | `Temp` | Human-Like Troll Runs |
| `TrollInvalid` | `Temp_TrollInvalid` | `sessionStorage` | `Temp` | Ungueltige Trolls |
| `trollPoints` | `Temp_trollPoints` | `sessionStorage` | `Temp` | Troll-Punkte |
| `trollWithGirls` | `Temp_trollWithGirls` | `sessionStorage` | `Temp` | Trolls mit Girls |
| `autoTrollBattleSaveQuest` | `Temp_autoTrollBattleSaveQuest` | `sessionStorage` | `Temp` | Quest-Save |

### Quest

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `questRequirement` | `Temp_questRequirement` | `sessionStorage` | `Temp` | Quest-Anforderungen |
| `MainAdventureWorldID` | `Temp_MainAdventureWorldID` | `localStorage` | `Temp` | Haupt-Welt ID |
| `SideAdventureWorldID` | `Temp_SideAdventureWorldID` | `localStorage` | `Temp` | Neben-Welt ID |

### Battle

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `battlePowerRequired` | `Temp_battlePowerRequired` | `sessionStorage` | `Temp` | Benoetigte Power |
| `burst` | `Temp_burst` | `sessionStorage` | `Temp` | Burst-Modus |
| `lastActionPerformed` | `Temp_lastActionPerformed` | `sessionStorage` | `Temp` | Letzte Aktion |

### Events

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `eventGirl` | `Temp_eventGirl` | `sessionStorage` | `Temp` | Aktuelles Event-Girl |
| `eventMythicGirl` | `Temp_eventMythicGirl` | `sessionStorage` | `Temp` | Mythic Event-Girl |
| `eventsGirlz` | `Temp_eventsGirlz` | `sessionStorage` | `Temp` | Event-Girls (JSON) |
| `eventsList` | `Temp_eventsList` | `sessionStorage` | `Temp` | Aktive Events |
| `autoChampsEventGirls` | `Temp_autoChampsEventGirls` | `sessionStorage` | `Temp` | Champion Event Girls |
| `loveRaids` | `Temp_loveRaids` | `sessionStorage` | `Temp` | Love Raid Daten |
| `raidGirls` | `Temp_raidGirls` | `sessionStorage` | `Temp` | Raid Girls |
| `bossBangTeam` | `Temp_bossBangTeam` | `sessionStorage` | `Temp` | Boss Bang Team |
| `lseManualCollectAll` | `Temp_lseManualCollectAll` | `localStorage` | `Temp` | LSE manuell sammeln |
| `poaManualCollectAll` | `Temp_poaManualCollectAll` | `localStorage` | `Temp` | PoA manuell sammeln |

### Champion

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `champBuildTeam` | `Temp_champBuildTeam` | `sessionStorage` | `Temp` | Champion Team bauen |
| `clubChampLimitReached` | `Temp_clubChampLimitReached` | `sessionStorage` | `Temp` | Club-Limit erreicht |

### League

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `LeagueHumanLikeRun` | `Temp_LeagueHumanLikeRun` | `sessionStorage` | `Temp` | Human-Like Liga Runs |
| `LeagueOpponentList` | `Temp_LeagueOpponentList` | `sessionStorage` | `Temp` | Gegner-Liste |
| `hideBeatenOppo` | `Temp_hideBeatenOppo` | `Storage()` | `Temp` | Besiegte ausblenden |

### Season

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `SeasonEndDate` | `Temp_SeasonEndDate` | `**--**` | `**--**` | Season-Ende |
| `SeasonHumanLikeRun` | `Temp_SeasonHumanLikeRun` | `sessionStorage` | `Temp` | Human-Like Season |
| `SeasonalEventEndDate` | `Temp_SeasonalEventEndDate` | `**--**` | `**--**` | Seasonal Event Ende |

### Pantheon / PentaDrill

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `PantheonHumanLikeRun` | `Temp_PantheonHumanLikeRun` | `sessionStorage` | `Temp` | Human-Like Pantheon |
| `PentaDrillHumanLikeRun` | `Temp_PentaDrillHumanLikeRun` | `sessionStorage` | `Temp` | Human-Like Penta |

### Place of Power

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `PopToStart` | `Temp_PopToStart` | `sessionStorage` | `Temp` | PoP zu starten |
| `PopTargeted` | `Temp_PopTargeted` | `sessionStorage` | `Temp` | Anvisierter PoP |
| `PopUnableToStart` | `Temp_PopUnableToStart` | `sessionStorage` | `Temp` | Nicht startbare PoP |
| `Totalpops` | `Temp_Totalpops` | `sessionStorage` | `Temp` | Gesamt PoP |
| `currentlyAvailablePops` | `Temp_currentlyAvailablePops` | `sessionStorage` | `Temp` | Verfuegbare PoP |

### Path Events

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `PoAEndDate` | `Temp_PoAEndDate` | `localStorage` | `Temp` | PoA Ende |
| `PoGEndDate` | `Temp_PoGEndDate` | `localStorage` | `Temp` | PoG Ende |
| `PoVEndDate` | `Temp_PoVEndDate` | `localStorage` | `Temp` | PoV Ende |

### Daily Goals

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `dailyGoalsList` | `Temp_dailyGoalsList` | `sessionStorage` | `Temp` | Daily Goals Liste |

### Paranoia

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `NextSwitch` | `Temp_NextSwitch` | `sessionStorage` | `Temp` | Naechster Switch |
| `paranoiaLeagueBlocked` | `Temp_paranoiaLeagueBlocked` | `sessionStorage` | `Temp` | Paranoia Liga blockiert |
| `paranoiaQuestBlocked` | `Temp_paranoiaQuestBlocked` | `sessionStorage` | `Temp` | Paranoia Quest blockiert |
| `paranoiaSpendings` | `Temp_paranoiaSpendings` | `sessionStorage` | `Temp` | Paranoia Ausgaben |

### Misc

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `sandalwoodFailure` | `Temp_sandalwoodFailure` | `sessionStorage` | `Temp` | Sandalwood Fehler |
| `sandalwoodMaxUsages` | `Temp_sandalwoodMaxUsages` | `sessionStorage` | `Temp` | Sandalwood Max |
| `mythicEquipConflicts` | `Temp_mythicEquipConflicts` | `sessionStorage` | `Temp` | Mythic-Slot-Konflikte beim Auto-Equip (`Booster.ts`, JSON-Map) |
| `unknownPagesList` | `Temp_unknownPagesList` | `sessionStorage` | `Temp` | Unbekannte Seiten |

### Survey

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `surveyShown` | `Temp_surveyShown` | `localStorage` | `Temp` | Survey angezeigt |
| `surveyDismissCount` | `Temp_surveyDismissCount` | `localStorage` | `Temp` | Survey Dismiss Count |
| `surveyLastHash` | `Temp_surveyLastHash` | `localStorage` | `Temp` | Survey Hash |

### Feature Popup (What's New)

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `featurePopupShown` | `Temp_featurePopupShown` | `localStorage` | `Temp` | Feature Popup angezeigt |
| `featurePopupDismissCount` | `Temp_featurePopupDismissCount` | `localStorage` | `Temp` | Feature Popup Dismiss |

### Mouse pause (issue #1774)

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `mouseLastActivity` | `Temp_mouseLastActivity` | `sessionStorage` | `Temp` | Zeitstempel der letzten Mausaktivitaet (`MouseService`) |

### Pipeline scheduler

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `pipelineLastRunAt` | `Temp_pipelineLastRunAt` | `sessionStorage` | `Temp` | `{blockId: ts}` letzter Lauf je Block (`BlockPipeline`) |

### Pipeline-Block-Architektur (v7.37.0, ADR-001)

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `activeBlockRun` | `Temp_activeBlockRun` | `sessionStorage` | `Temp` | BlockRun-Fortschritt (R4.4/R4.12) |
| `blockCooldownUntil` | `Temp_blockCooldownUntil` | `sessionStorage` | `Temp` | `{blockId: ts}` Cooldowns (R4.10/R5.2) |
| `blockAutoDisabled` | `Temp_blockAutoDisabled` | `localStorage` | `Temp` | `{blockId:{reason,sinceVersion}}` automatisch abgeschaltete Bloecke (R5.5) |
| `blockFailureCount` | `Temp_blockFailureCount` | `localStorage` | `Temp` | `{signature: count}` Fehlerzaehler (R5.3) |
| `pipelineOrder` | `Temp_pipelineOrder` | `localStorage` | `Setting` | Effektive Block-ID-Reihenfolge (R2.5/R7.1); trotz `Temp_`-Prefix als `Setting` registriert |
| `pipelineLogContext` | `Temp_pipelineLogContext` | `localStorage` | `Temp` | Nicht rotierender Log-Kontext-Block (R6.16) |

### Troll wait-marker (issue #1708)

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `trollWaitForEnergy` | `Temp_trollWaitForEnergy` | `sessionStorage` | `Temp` | Gesetzt, wenn `handleTrollBattle` auf Energie wartet, ein Kampfpfad aber feuern wuerde; `handleEventParsing` und `handleLeague` unterdruecken daraufhin ihre Navigation. Pro Tab. |

### Settings-Menue (Layout, ab 8.10.0)

| Konstante | Storage Key | Storage | HHType | Beschreibung |
|-----------|-------------|---------|--------|--------------|
| `menuSingleColumn` | `Setting_menuSingleColumn` | `localStorage` | `Setting` | Menue-Layout: `false` = Reiter-Leiste, `true` = alle Bereiche untereinander |
| `menuOrder` | `Temp_menuOrder` | `localStorage` | `Setting` | Vom Nutzer festgelegte Reihenfolge der Menue-Bereiche (JSON-Array von Bereichs-IDs) |
| `menuTab` | `Temp_menuTab` | `sessionStorage` | `Temp` | Zuletzt geoeffneter Bereich (nur Reiter-Layout) |

`menuOrder` traegt trotz `Temp_`-Praefix `HHType: "Setting"` -- gleiche Entscheidung wie
`Temp_pipelineOrder`: eine Nutzer-Entscheidung soll "Temp-Speicher loeschen" ueberleben und
im JSON-Settings-Export enthalten sein (`extractHHVars` filtert nach `HHType`, nicht nach
Key-Praefix).

---

## Bekannte nicht registrierte Keys

Folgende 8 Konstanten sind in `StorageKeys.ts` definiert, aber NICHT in `HHStoredVars.ts` registriert (nachgezaehlt 2026-08-19 gegen v8.9.0, nach dem Entfernen der toten Keys). Lesen liefert `undefined`, Schreiben verfaellt:

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


## Tote Keys (Cleanup-Kandidaten)

**Keine.** Die Analyse vom 2026-08-19 gegen v8.9.0 hatte acht Keys ohne jeden
Code-Zugriff gefunden; sie wurden am selben Tag entfernt:

| Key | war registriert | Befund |
|-----|-----------------|--------|
| SK.autoTrollMythicByPassThreshold | nein | Geparktes Feature: auskommentierter Block in `ParanoiaService.ts`, i18n-Eintraege in de/en/es ebenfalls auskommentiert (Versionsmarke 5.6.24) |
| TK.trollToFight | nein | Waise, kein Vorkommen ausser der Definition |
| TK.fought | ja | Nur die Registrierung, sonst nichts |
| TK.EventFightsBeforeRefresh | nein | Geparktes Feature: auskommentiert in `RewardHelper.ts` und `EventModule.ts` (2x) |
| TK.LeagueSavedData | ja | Nur die Registrierung, sonst nichts |
| TK.LeagueTempOpponentList | nein | Waise |
| TK.leaguesTarget | nein | Waise |
| TK.userLink | nein | Waise |

Die auskommentierten Bloecke der beiden geparkten Features blieben bewusst
stehen. Wer eines davon reaktiviert, muss die zugehoerige Konstante wieder
anlegen -- eine Zeile.

### Methode fuer die naechste Wiederholung

Ein Key gilt als tot, wenn ihn ausserhalb seiner Definition in
`StorageKeys.ts` und seiner Registrierung in `HHStoredVars.ts` kein Code
anfasst. Drei Fallen, die eine naive Suche stellt:

1. **Auskommentierter Code zaehlt nicht als Zugriff.** Ohne Kommentar-Stripping
   erscheinen geparkte Features faelschlich als lebendig.
2. **`HHStoredVars.ts` selbst muss durchsucht werden.** Dort stehen
   `events`-Handler mit echten Schreibzugriffen -- so wird zum Beispiel
   `SK.autoFreeBundlesCollectablesList` beschrieben.
3. **`setMenuValues` / `getMenuValues` iterieren ueber die gesamte Registry**
   und lesen bzw. schreiben jeden Eintrag mit `storage` und `HHType`. Ein
   registrierter Key wird also bei jedem Menue-Vorgang angefasst, auch wenn ihn
   kein Feature-Code kennt. Deshalb zuerst den `HHStoredVars`-Eintrag entfernen,
   dann die Konstante.

Zwei weitere dynamische Konsumenten wurden geprueft und sind unkritisch:
`SurveyService.buildSettingsExport` iteriert `Object.keys(SK)`, ueberspringt
aber unregistrierte Keys (`if (!varDef) continue`), und `debugDeleteAllVars`
iteriert die Registry statt SK/TK.
