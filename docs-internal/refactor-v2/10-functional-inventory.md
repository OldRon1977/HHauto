---
last-verified: 2026-04-29
verified-against-version: 7.35.14
status: in-progress
---

# Functional Inventory — HHAuto v7.35.14

Master-Checkliste fuer "keine Funktion darf fehlen". Quelle der Wahrheit: Code.
Jeder Eintrag muss am Ende des Refactors als "migriert" oder "bewusst entfernt" markiert sein.

**Migration-Status-Legende:**
- `open` — noch nicht angefasst
- `in-progress` — Migration laeuft
- `migrated` — fertig migriert
- `removed` — bewusst entfernt (mit Begruendung)
- `deferred` — auf spaetere Phase verschoben

---

## 1. Action-Handlers (33 Handler in AutoLoop-Sequenz)

Quelle: `src/Service/AutoLoop.ts:263-296`
Implementierung: `src/Service/AutoLoopActions.ts` (1040 LoC)

| # | Handler-Funktion | Modul-Datei | Beschreibung | Status |
|---|---|---|---|---|
| 1 | handleEventParsing | AutoLoopActions.ts | Events parsen und ctx.events befuellen | open |
| 2 | handleMythicWave | Events/MythicEvent.ts | Mythic-Wave-Kaempfe ausfuehren | open |
| 3 | handleShop | Module/Shop.ts | Auto-Shop (Booster, Items kaufen) | open |
| 4 | handleAutoEquipBoosters | Module/Booster.ts | Booster automatisch ausruesten | open |
| 5 | handleHaremSize | harem/Harem.ts | Harem-Groesse tracken | open |
| 6 | handlePlaceOfPower | Module/PlaceOfPower.ts | Place of Power Kaempfe | open |
| 7 | handleGenericBattle | Module/GenericBattle.ts | Generische Kaempfe (Energy verbrauchen) | open |
| 8 | handleLoveRaid | Events/LoveRaidManager.ts | Love-Raid-Event-Kaempfe | open |
| 9 | handleTrollBattle | Module/Troll.ts | Troll-Kaempfe (Hauptkampf-Loop) | open |
| 10 | handlePachinko | Module/Pachinko.ts | Pachinko-Spiel (Gratis-Spins) | open |
| 11 | handleContest | Module/Contest.ts | Contest-Teilnahme | open |
| 12 | handleMissions | Module/Missions.ts | Missionen starten/einsammeln | open |
| 13 | handleQuest | Module/Quest.ts | Quest-Fortschritt | open |
| 14 | handleLeague | Module/League.ts | League-Kaempfe | open |
| 15 | handleSeason | Events/Season.ts | Season-Kaempfe | open |
| 16 | handlePentaDrill | Module/PentaDrill.ts | Penta-Drill-Kaempfe | open |
| 17 | handlePantheon | Module/Pantheon.ts | Pantheon-Kaempfe | open |
| 18 | handleChampionTicket | Module/Champion.ts | Champion-Ticket einloesen | open |
| 19 | handleChampion | Module/Champion.ts | Champion-Kaempfe | open |
| 20 | handleClubChampion | Module/ClubChampion.ts | Club-Champion-Kaempfe | open |
| 21 | handleSeasonCollect | Events/Season.ts | Season-Rewards einsammeln | open |
| 22 | handlePentaDrillCollect | Module/PentaDrill.ts | PentaDrill-Rewards einsammeln | open |
| 23 | handleSeasonalFreeCard | Events/Seasonal.ts | Seasonal-Event Gratis-Karte | open |
| 24 | handleSeasonalEventCollect | Events/Seasonal.ts | Seasonal-Event-Rewards | open |
| 25 | handleSeasonalRankCollect | Events/Seasonal.ts | Seasonal-Rang-Rewards | open |
| 26 | handlePoVCollect | Events/PathOfValue.ts | Path of Value Rewards | open |
| 27 | handlePoGCollect | Events/PathOfGlory.ts | Path of Glory Rewards | open |
| 28 | handleFreeBundles | Module/Bundles.ts | Gratis-Bundles einsammeln | open |
| 29 | handleDailyGoals | Module/DailyGoals.ts | Daily Goals einsammeln | open |
| 30 | handleLabyrinth | Module/Labyrinth.ts | Labyrinth-Navigation + Kaempfe | open |
| 31 | handleSalary | harem/HaremSalary.ts | Gehalt einsammeln | open |
| 32 | handleBossBangParse | Events/BossBang.ts | Boss-Bang-Event parsen | open |
| 33 | handleBossBangFight | Events/BossBang.ts | Boss-Bang-Kaempfe | open |

**Zusaetzlich (nicht in der 33er-Sequenz):**

| Handler | Datei | Beschreibung | Status |
|---|---|---|---|
| handlePageSpecific | AutoLoopPageHandlers.ts | Seitenspezifische UI-Handler (laeuft NACH der Sequenz) | open |
| handleGoHome | AutoLoopActions.ts | Zurueck zur Home-Seite navigieren | open |

---

## 2. Services (16 Dateien in src/Service/)

| Service | Datei | Beschreibung | Status |
|---|---|---|---|
| AutoLoop | AutoLoop.ts | Haupt-Loop (setTimeout ~1s), orchestriert Handler | open |
| AutoLoopActions | AutoLoopActions.ts | Implementierung der 33 Handler-Funktionen | open |
| AutoLoopContext | AutoLoopContext.ts | Context-Struct fuer einen Loop-Durchlauf | open |
| AutoLoopPageHandlers | AutoLoopPageHandlers.ts | Seitenspezifische UI-Handler | open |
| AdsService | AdsService.ts | Werbung-Handling (Gratis-Rewards via Ads) | open |
| FeaturePopupService | FeaturePopupService.ts | Feature-Popups bei Updates anzeigen | open |
| InfoService | InfoService.ts | pInfo-Panel (Status-Anzeige im Spiel) | open |
| MouseService | MouseService.ts | Maus-Aktivitaet erkennen -> Pause | open |
| PageNavigationService | PageNavigationService.ts | Zentrale Seitennavigation | open |
| ParanoiaService | ParanoiaService.ts | Anti-Detection (Pausen, Randomisierung) | open |
| StartService | StartService.ts | Initialisierung beim Skript-Start | open |
| SurveyService | SurveyService.ts | Umfrage-Handling | open |
| TeamBuilderService | TeamBuilderService.ts | Team-Zusammenstellung (Algorithmus) | open |
| TeamScoringService | TeamScoringService.ts | Team-Bewertung (Scoring-Algorithmus) | open |
| TooltipService | TooltipService.ts | Tooltip-Anzeige im UI | open |

---

## 3. Modules (25 Root + 16 Events + 5 Harem)

### 3.1 Module Root (src/Module/)

| Modul | Datei | Beschreibung | Status |
|---|---|---|---|
| Booster | Booster.ts | Booster-Management (equip, track, onAjaxResponse) | open |
| Bundles | Bundles.ts | Gratis-Bundle-Erkennung und -Einsammlung | open |
| Champion | Champion.ts | Champion-Kaempfe + Ticket-Logik | open |
| Club | Club.ts | Club-Funktionen | open |
| ClubChampion | ClubChampion.ts | Club-Champion-Kaempfe | open |
| Contest | Contest.ts | Contest-Teilnahme-Logik | open |
| DailyGoals | DailyGoals.ts | Daily-Goals-Einsammlung | open |
| GenericBattle | GenericBattle.ts | Generische Kampf-Logik (Energy-Verbrauch) | open |
| Labyrinth | Labyrinth.ts | Labyrinth-Pathfinding + Navigation | open |
| LabyrinthAuto | LabyrinthAuto.ts | Labyrinth-Automatisierung | open |
| League | League.ts | League-Kaempfe + Gegner-Auswahl | open |
| Market | Market.ts | Markt-Interaktionen | open |
| Missions | Missions.ts | Missions-Start und -Einsammlung | open |
| MonthlyCard | MonthlyCard.ts | Monthly-Card-Einsammlung | open |
| Pachinko | Pachinko.ts | Pachinko-Gratis-Spins | open |
| Pantheon | Pantheon.ts | Pantheon-Kaempfe | open |
| PentaDrill | PentaDrill.ts | Penta-Drill-Kaempfe + Collect | open |
| PlaceOfPower | PlaceOfPower.ts | Place-of-Power-Kaempfe | open |
| Quest | Quest.ts | Quest-Fortschritt-Logik | open |
| RelicManager | RelicManager.ts | Relic-Verwaltung | open |
| Shop | Shop.ts | Auto-Shop-Logik | open |
| Spreadsheet | Spreadsheet.ts | Spreadsheet-Export (onAjaxResponse) | open |
| TeamModule | TeamModule.ts | Team-UI und -Verwaltung | open |
| Troll | Troll.ts | Troll-Kampf-Logik | open |

### 3.2 Events (src/Module/Events/)

| Modul | Datei | Beschreibung | Status |
|---|---|---|---|
| EventModule | EventModule.ts | Event-Dispatcher (erkennt aktive Events) | open |
| BossBang | BossBang.ts | Boss-Bang-Event-Logik | open |
| CumbackContests | CumbackContests.ts | Cumback-Contest-Event | open |
| DoublePenetration | DoublePenetration.ts | Double-Penetration-Event | open |
| KinkyCumpetition | KinkyCumpetition.ts | Kinky-Cumpetition-Event | open |
| LivelyScene | LivelyScene.ts | Lively-Scene-Event | open |
| LoveRaidManager | LoveRaidManager.ts | Love-Raid-Event (RaidStars) | open |
| MythicEvent | MythicEvent.ts | Mythic-Wave-Event | open |
| PathOfAttraction | PathOfAttraction.ts | Path-of-Attraction-Event | open |
| PathOfGlory | PathOfGlory.ts | Path-of-Glory-Event | open |
| PathOfValue | PathOfValue.ts | Path-of-Value-Event | open |
| PlusEvents | PlusEvents.ts | Plus-Events (generisch) | open |
| Season | Season.ts | Season-Kaempfe + Collect | open |
| Seasonal | Seasonal.ts | Seasonal-Events (FreeCard, Collect, Rank) | open |
| SultryMysteries | SultryMysteries.ts | Sultry-Mysteries-Event | open |

### 3.3 Harem (src/Module/harem/)

| Modul | Datei | Beschreibung | Status |
|---|---|---|---|
| Harem | Harem.ts | Harem-Hauptlogik (Groesse, Navigation) | open |
| HaremFilter | HaremFilter.ts | Harem-Filter-UI | open |
| HaremGirl | HaremGirl.ts | Girl-Detail-Logik | open |
| HaremSalary | HaremSalary.ts | Gehalt-Einsammlung | open |

---

## 4. Helpers (17 Dateien in src/Helper/)

| Helper | Datei | Beschreibung | Status |
|---|---|---|---|
| BDSMHelper | BDSMHelper.ts | BDSM-Kampf-Berechnungen | open |
| ButtonHelper | ButtonHelper.ts | Button-Erstellung und -Handling | open |
| ConfigHelper | ConfigHelper.ts | Konfigurationszugriff (Game-Vars) | open |
| HeroHelper | HeroHelper.ts | Hero-Daten-Zugriff | open |
| HHHelper | HHHelper.ts | Allgemeine HH-Hilfsfunktionen | open |
| HHMenuHelper | HHMenuHelper.ts | Menu-UI-Hilfsfunktionen | open |
| LanguageHelper | LanguageHelper.ts | Sprach-Erkennung und -Auswahl | open |
| NumberHelper | NumberHelper.ts | Zahlen-Formatierung und -Parsing | open |
| PageHelper | PageHelper.ts | Seiten-Erkennung und -Navigation | open |
| PriceHelper | PriceHelper.ts | Preis-Berechnung und -Vergleich | open |
| RewardHelper | RewardHelper.ts | Reward-Parsing und -Anzeige | open |
| StorageHelper | StorageHelper.ts | localStorage get/set mit Prefix | open |
| TimeHelper | TimeHelper.ts | Zeit-Berechnungen und -Formatierung | open |
| TimerHelper | TimerHelper.ts | Timer-Verwaltung (Cooldowns) | open |
| UrlHelper | UrlHelper.ts | URL-Parsing und -Konstruktion | open |
| WindowHelper | WindowHelper.ts | unsafeWindow-Zugriff | open |

---

## 5. Utils (src/Utils/)

| Utility | Datei | Beschreibung | Status |
|---|---|---|---|
| Utils | Utils.ts | Allgemeine Utilities (onAjaxResponse, Formatierung) | open |
| BrowserUtils | BrowserUtils.ts | Browser-spezifische Utilities | open |
| HHPopup | HHPopup.ts | Popup-Erstellung und -Anzeige | open |
| LogUtils | LogUtils.ts | Logging-Utilities (logHHAuto) | open |

---

## 6. Config (src/config/)

| Datei | Beschreibung | Status |
|---|---|---|
| StorageKeys.ts | 179 Settings-Keys (SK) + 89 Temp-Keys (TK) | open |
| HHStoredVars.ts | Stored-Vars-Definitionen (Source of Truth fuer Store) | open |
| HHEnvVariables.ts | Game-Environment-Variablen (Page-IDs, URLs, Feature-Flags) | open |
| InputPattern.ts | Input-Validation-Patterns fuer Settings-UI | open |

### 6.1 Game-Varianten (src/config/game/)

| Datei | Game-ID | Beschreibung | Status |
|---|---|---|---|
| HentaiHeroesVars.ts | hh_hentai | Hentai Heroes (Haupt-Spiel) | open |
| ComixHaremVars.ts | hh_comix | Comix Harem | open |
| PornstarHaremVars.ts | hh_star | Pornstar Harem | open |
| TransPornstarHaremVars.ts | hh_startrans | Trans Pornstar Harem | open |
| GayHaremVars.ts | hh_gay | Gay Harem | open |
| GayPornstarHaremVars.ts | hh_stargay | Gay Pornstar Harem | open |
| MangaRpgVars.ts | hh_mangarpg | Manga RPG | open |
| AmourAgentVars.ts | hh_amour | Amour Agent | open |

**Hinweis:** Sexy Heroes (hh_sexy / SH_prod) hat keine eigene Datei — reduzierte Features direkt in HHEnvVariables.ts definiert.

---

## 7. Models (src/model/)

| Model | Datei | Beschreibung | Status |
|---|---|---|---|
| BDSMPlayer | BDSMPlayer.ts | BDSM-Spieler-Datenstruktur | open |
| BDSMSimu | BDSMSimu.ts | BDSM-Simulation-Datenstruktur | open |
| Champion | Champion.ts | Champion-Datenstruktur | open |
| EventGirl | EventGirl.ts | Event-Girl-Datenstruktur | open |
| HHEvent | HHEvent.ts | Event-Datenstruktur | open |
| IModule | IModule.ts | Modul-Interface | open |
| LeagueOpponent | LeagueOpponent.ts | League-Gegner-Datenstruktur | open |
| LoveRaid | LoveRaid.ts | Love-Raid-Datenstruktur | open |
| Mission | Mission.ts | Mission-Datenstruktur | open |
| SeasonOpponent | SeasonOpponent.ts | Season-Gegner-Datenstruktur | open |
| TeamData | TeamData.ts | Team-Datenstruktur | open |
### 7.1 KK-Models (src/model/KK/) — 12 Dateien

| Model | Datei | Beschreibung | Status |
|---|---|---|---|
| kkDailyGoal | kkDailyGoal.ts | Daily-Goal-Datenstruktur | open |
| KKEnergy | KKEnergy.ts | Energy-Datenstruktur | open |
| KKEventGirl | KKEventGirl.ts | Event-Girl-Datenstruktur | open |
| KKHaremGirl | KKHaremGirl.ts | Harem-Girl-Datenstruktur (64 Felder) | open |
| KKHaremSalaryGirl | KKHaremSalaryGirl.ts | Salary-Girl-Datenstruktur | open |
| KKHero | KKHero.ts | Hero-Datenstruktur | open |
| KKLeagueOpponent | KKLeagueOpponent.ts | League-Gegner-Datenstruktur | open |
| KKLoveRaid | KKLoveRaid.ts | Love-Raid-Datenstruktur | open |
| KKPentaDrillOpponents | KKPentaDrillOpponents.ts | PentaDrill-Gegner-Datenstruktur | open |
| KKPuzzlePieces | KKPuzzlePieces.ts | Puzzle-Pieces-Datenstruktur | open |
| KKTeamGirl | KKTeamGirl.ts | Team-Girl-Datenstruktur | open |

---

## 8. i18n (src/i18n/) — 6 Sprachen

| Datei | Sprache | Status |
|---|---|---|
| en.ts | Englisch (Basis) | open |
| de.ts | Deutsch | open |
| fr.ts | Franzoesisch | open |
| es.ts | Spanisch | open |
| empty.ts | Fallback (leere Strings) | open |

---

## 9. Storage-Keys (179 SK + 89 TK)

Vollstaendige Auflistung in `src/config/StorageKeys.ts`. Hier nur Kategorien:

### 9.1 Settings-Keys (SK) — 179 Keys

| Kategorie | Anzahl (ca.) | Beispiele |
|---|---|---|
| Master/Global | ~10 | master, settPerTab, spendKobans0 |
| Troll | ~15 | autoTrollBattle, trollMaxFights, trollMinEnergy |
| League | ~10 | autoLeague, leagueMaxFights, leagueMinEnergy |
| Season | ~8 | autoSeason, seasonMaxFights |
| Champion | ~8 | autoChampion, championTicket |
| Missions | ~5 | autoMissions, missionDuration |
| Pachinko | ~5 | autoPachinko, pachinkoType |
| Labyrinth | ~5 | autoLabyrinth, labyrinthStrategy |
| Events | ~20 | autoMythic, autoLoveRaid, autoBossBang |
| Shop | ~10 | autoShop, shopBuyBooster |
| Harem | ~10 | autoSalary, haremFilter |
| Paranoia | ~10 | paranoiaEnabled, paranoiaMinPause |
| PentaDrill | ~5 | autoPentaDrill |
| Pantheon | ~5 | autoPantheon |
| DailyGoals | ~3 | autoDailyGoals |
| Bundles | ~3 | autoFreeBundles |
| Contest | ~3 | autoContest |
| Club | ~5 | autoClubChampion |
| Booster | ~5 | autoEquipBoosters |
| PlaceOfPower | ~5 | autoPlaceOfPower |
| GenericBattle | ~5 | autoGenericBattle |
| Sonstige | ~20 | diverse Feature-Flags |

### 9.2 Temp-Keys (TK) — 89 Keys

| Kategorie | Anzahl (ca.) | Beispiele |
|---|---|---|
| Timer/Cooldowns | ~30 | trollNextFight, leagueNextFight |
| Status-Tracking | ~25 | lastSeasonRank, lastLeagueScore |
| Cache | ~20 | boosterStatusLastUpdate, haremSizeCache |
| Event-State | ~14 | currentEventType, bossBangProgress |

---

## 10. UI-Komponenten

| Komponente | Ort | Beschreibung | Status |
|---|---|---|---|
| pInfo-Panel | InfoService.ts | Status-Anzeige (oben rechts im Spiel) | open |
| Settings-Panel | AutoLoopPageHandlers.ts | Einstellungs-UI (179 Settings) | open |
| Tooltip-System | TooltipService.ts | Hover-Tooltips fuer Buttons | open |
| HH-Menu-Erweiterung | HHMenuHelper.ts | Zusaetzliche Menu-Eintraege | open |
| Feature-Popup | FeaturePopupService.ts | Update-Hinweise nach Version-Bump | open |
| Spreadsheet-Export | Spreadsheet.ts | Daten-Export-UI | open |
| Team-Selection-UI | TeamModule.ts | Team-Auswahl-Interface | open |
| Harem-Filter-UI | HaremFilter.ts | Filter-Optionen im Harem | open |
| BDSM-Simulator-UI | (in BDSMHelper) | Kampf-Simulation-Anzeige | open |

---

## 11. Cross-Cutting Concerns

| Concern | Dateien | Beschreibung | Status |
|---|---|---|---|
| Anti-Detection | ParanoiaService.ts | Randomisierte Pausen, Human-like Delays | open |
| Logging | LogUtils.ts | logHHAuto (console.log mit Prefix) | open |
| Error-Handling | verstreut | try/catch in Handlern, minimal | open |
| Game-Variant-Detection | ConfigHelper.ts + HHEnvVariables.ts | Erkennung welches Spiel laeuft | open |
| Page-Detection | PageHelper.ts + HHEnvVariables.ts | Erkennung welche Seite aktiv ist | open |
| Storage-Prefix | StorageHelper.ts | Key-Prefix pro Spiel-Account | open |
| onAjaxResponse | Utils.ts | jQuery.ajaxComplete-Interception | open |
| Navigation-Lock | PageNavigationService.ts | Verhindert parallele Navigationen | open |

---

## 12. Tests (37 Spec-Files, 510 Tests)

| Test-Suite | Datei | Tests | Status |
|---|---|---|---|
| TeamScoringService | spec/Service/TeamScoringService.spec.ts | 58 | open |
| TeamBuilderService | spec/Service/TeamBuilderService.spec.ts | 22 | open |
| (weitere 35 Spec-Files) | spec/**/*.spec.ts | 430 | open |

**Hinweis:** Vollstaendige Test-Auflistung wird bei Bedarf ergaenzt. Alle Tests muessen nach Refactor weiterhin gruen sein.

---

## 13. Build-System

| Datei | Beschreibung | Status |
|---|---|---|
| package.json | Dependencies, Scripts, Version (7.35.14) | open |
| webpack.config.js | Webpack-Konfiguration (single .user.js Output) | open |
| build/BannerBuilder.js | Generiert Userscript-Header (@name, @version etc.) | open |
| build/HHAuto.template.js | Template fuer den Userscript-Header | open |
| tsconfig.json | TypeScript-Konfiguration | open |

---

## Zusammenfassung

| Kategorie | Anzahl |
|---|---|
| Action-Handlers | 33 + 2 |
| Services | 16 |
| Module (Root) | 25 |
| Module (Events) | 16 |
| Module (Harem) | 5 |
| Helpers | 17 |
| Utils | 5 |
| Config-Files | 5 + 8 Game-Vars |
| Models | 12 + 12 KK |
| i18n | 6 |
| Storage-Keys | 179 SK + 89 TK |
| Tests | 510 in 37 Files |
| **Gesamt-Eintraege** | **~430** |