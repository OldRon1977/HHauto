// MenuTabs.ts
//
// DOM construction (layout): the tabbed body of the #sMenu panel — a rail of
// area buttons on the left and one pane per area on the right. Replaces the
// three fixed-width columns (MenuColumnLeft/Middle/Right, removed in 8.10.0),
// which sized their labels for English and let longer translations overlap.
//
// Two rules keep that from coming back:
//   - a row is a two-column grid (label | control, see the #sMenu CSS in
//     build/HHAuto.template.js), so a label may wrap to any length and can
//     never run under its control;
//   - every group carries a visible heading. That is not decoration: 23 label
//     texts are reused across the menu ("Collect" alone appears eleven times),
//     and the heading is what tells them apart.
//
// Element ids are unchanged from the column layout — MenuSettings binds values
// by id, maskInactiveMenus() hides by id, and feature modules look rows up by
// id. Only the arrangement moved.
//
// Reads its storage/translation helpers from MenuPorts so this file stays a
// graph leaf (see MenuPorts.ts).

import { HHAuto_inputPattern } from "../../config/InputPattern";
import { TK } from "../../config/StorageKeys";
import { MenuPorts } from "./MenuPorts";
import { hhMenuInput, hhMenuInputWithImg, hhMenuSelect, hhMenuSwitch, hhMenuSwitchWithImg } from "./MenuWidgets";

const t = (key: string): string => MenuPorts.getTextForUI(key, "elementText");

/**
 * One settings group. `maskId` goes on the group element so the existing
 * maskInactiveMenus() can hide the whole group on games without that feature.
 * `wide` makes the group span the full pane and lay its rows out in columns —
 * used where a row holds a dropdown or a long text field that will not fit
 * beside a label in a single narrow column.
 */
function group(titleKey: string, rows: string, maskId = '', wide = false): string {
    return `<div class="menuGroup${wide ? ' wide' : ''}"${maskId ? ` id="${maskId}"` : ''}>`
        + `<div class="menuGroupTitle">${t(titleKey)}</div>`
        + `<div class="menuGroupRows">${rows}</div>`
        + `</div>`;
}

/** A row the widgets cannot build: a switch with its own number field next to it. */
function switchWithInput(switchId: string, inputId: string, pattern: string, width: string): string {
    return `<div class="labelAndButton">`
        + `<span class="HHMenuItemName">${t(switchId)}</span>`
        + `<div class="tooltipHH menuPair">`
            + `<span class="tooltipHHtext">${MenuPorts.getTextForUI(switchId, "tooltip")}</span>`
            + `<label class="switch"><input id="${switchId}" type="checkbox"><span class="slider round"></span></label>`
            + `<input style="text-align:center; width:${width}" id="${inputId}" required pattern="${pattern}" type="text">`
        + `</div>`
    + `</div>`;
}

/** Rows hidden unless Debug is on — #1533, 0% usage in a 168-response survey. */
function debugOnly(enabled: boolean, rows: string): string {
    return `<div${enabled ? '' : ' style="display:none;"'}>${rows}</div>`;
}

interface TabDef {
    id: string;
    icon: string;
    nameKey: string;
    titleKey: string;
    groups: string;
}

function tabs(debugEnabled: boolean): TabDef[] {
    const P = HHAuto_inputPattern;
    return [
    {
        id: 'global', icon: '⚙️', nameKey: 'menuTabGlobal', titleKey: 'globalTitle',
        groups:
            group('menuSecBasics',
                hhMenuSwitch('paranoia')
                + switchWithInput('mousePause', 'mousePauseTimeout', P.mousePauseTimeout, '40px')
                + hhMenuSwitch('settPerTab')
                + hhMenuSwitch('showTooltips'))
            + group('menuSecTiming',
                hhMenuInput('collectAllTimer', P.collectAllTimer, 'text-align:center; width:30px')
                + switchWithInput('waitforContest', 'safeSecondsForContest', P.safeSecondsForContest, '40px')
                + hhMenuSwitch('paranoiaSpendsBefore')
                + hhMenuInput('autoPentaDrillDelay', P.autoPentaDrillDelay, 'text-align:center; width:30px')
                + hhMenuSwitch('pipelineDiagnose'))
            + group('menuSecKobans',
                hhMenuSwitchWithImg('spendKobans0', 'design/menu/affil_prog.svg', true)
                + hhMenuInputWithImg('kobanBank', P.nWith1000sSeparator, 'text-align:right; width:60px', 'pictures/design/ic_hard_currency.png'))
            + group('menuSecAutoCollect',
                hhMenuSwitch('autoFreeBundlesCollect', 'isEnabledFreeBundles')
                + hhMenuSwitch('collectEventChest')),
    },
    {
        id: 'display', icon: '👁️', nameKey: 'menuTabDisplay', titleKey: 'displayTitle',
        groups:
            group('menuSecInfoPanel',
                hhMenuSwitch('showInfo')
                + hhMenuSwitch('showInfoLeft', '', false, true)
                + hhMenuSwitch('showCalculatePower'))
            + group('menuSecRewards',
                hhMenuSwitch('showRewardsRecap')
                + hhMenuSwitch('AllMaskRewards', '', false, true))
            + group('menuSecAds',
                hhMenuSwitch('showAdsBack', '', false, true)
                + hhMenuSwitch('autoAdsClick')),
    },
    {
        id: 'daily', icon: '📅', nameKey: 'menuTabDaily', titleKey: 'menuTabDaily',
        groups:
            group('autoActivitiesTitle',
                hhMenuSwitch('autoMission')
                + hhMenuSwitch('autoMissionCollect')
                + hhMenuSwitch('autoMissionKFirst')
                + hhMenuSwitch('compactMissions', '', false, true)
                + hhMenuSwitch('invertMissions', '', false, true), 'isEnabledMission')
            + group('menuSecContests',
                hhMenuSwitch('autoContest')
                + hhMenuSwitch('compactEndedContests', '', false, true), 'isEnabledContest')
            + group('dailyGoalsTitle',
                debugOnly(debugEnabled, hhMenuSwitch('autoDailyGoals'))
                + hhMenuSwitch('autoDailyGoalsCollect')
                + hhMenuSwitch('compactDailyGoals', '', false, true), 'isEnabledDailyGoals')
            + group('menuSecPachinko',
                hhMenuSwitch('autoFreePachinko'), 'isEnabledPachinko')
            + group('menuSecSalary',
                hhMenuSwitch('autoSalary')
                + hhMenuInput('autoSalaryMinSalary', P.nWith1000sSeparator, 'text-align:right; width:60px'), 'isEnabledSalary')
            + group('powerPlacesTitle',
                hhMenuSwitch('autoPowerPlaces')
                + hhMenuInput('autoPowerPlacesIndexFilter', P.autoPowerPlacesIndexFilter, 'width:100px')
                + hhMenuSwitch('autoPowerPlacesAll')
                + hhMenuSwitch('autoPowerPlacesPrecision')
                + hhMenuSwitch('autoPowerPlacesInverted')
                + hhMenuSwitch('autoPowerPlacesWaitMax')
                + hhMenuSwitch('compactPowerPlace', '', false, true), 'isEnabledPowerPlaces', true)
            + group('menuSecQuests',
                hhMenuSwitch('autoQuest')
                + hhMenuSwitch('autoSideQuest', 'isEnabledSideQuest')
                + hhMenuInputWithImg('autoQuestThreshold', P.autoQuestThreshold, 'text-align:center; width:34px', 'pictures/design/ic_energy_quest.png', 'numeric'), 'isEnabledQuest')
            + group('povTitle',
                hhMenuSwitch('autoPoVCollect')
                + hhMenuSwitch('autoPoVCollectAll'), 'isEnabledPoV')
            + group('pogTitle',
                hhMenuSwitch('autoPoGCollect')
                + hhMenuSwitch('autoPoGCollectAll'), 'isEnabledPoG'),
    },
    {
        id: 'adventure', icon: '🗺️', nameKey: 'menuTabAdventure', titleKey: 'autoTrollTitle',
        groups:
            group('menuSecStandardTroll',
                hhMenuSwitch('autoTrollBattle')
                + hhMenuSelect('autoTrollSelector', 'max-width:170px;')
                + hhMenuInputWithImg('autoTrollThreshold', P.autoTrollThreshold, 'text-align:center; width:34px', 'pictures/design/ic_energy_fight.png', 'numeric')
                + hhMenuInputWithImg('autoTrollRunThreshold', P.autoTrollRunThreshold, 'text-align:center; width:34px', 'pictures/design/ic_energy_fight.png', 'numeric'), 'isEnabledTrollBattle', true)
            + group('menuSecEventTrolls',
                hhMenuSwitch('plusEvent')
                + hhMenuInput('eventTrollOrder', P.eventTrollOrder, 'width:150px')
                + hhMenuSwitch('buyCombat', '', true)
                + hhMenuInput('buyCombTimer', P.buyCombTimer, 'text-align:center; width:44px', '', 'numeric')
                + hhMenuInput('autoBuyTrollNumber', P.autoBuyTrollNumber, 'text-align:center; width:44px')
                + hhMenuSwitch('plusEventSandalWood'), '', true)
            + group('menuSecMythicEvent',
                hhMenuSwitch('plusEventMythic')
                + hhMenuSwitch('autoTrollMythicByPassParanoia')
                + hhMenuSwitch('buyMythicCombat', '', true)
                + hhMenuInput('autoBuyMythicTrollNumber', P.autoBuyTrollNumber, 'text-align:center; width:44px')
                + hhMenuInput('buyMythicCombTimer', P.buyMythicCombTimer, 'text-align:center; width:44px', '', 'numeric')
                + hhMenuSwitch('plusEventMythicSandalWood'), '', true)
            + group('loveRaidTitle',
                hhMenuSwitch('plusLoveRaid')
                + hhMenuSelect('loveRaidSelector', 'max-width:170px;')
                + hhMenuSwitch('autoTrollLoveRaidByPassThreshold')
                + hhMenuSelect('raidStarsSelector', 'max-width:90px;')
                + hhMenuSwitch('buyLoveRaidCombat', '', true)
                + hhMenuInput('autoBuyLoveRaidTrollNumber', P.autoBuyTrollNumber, 'text-align:center; width:44px')
                + hhMenuSwitch('plusEventLoveRaidSandalWood'), '', true)
            + group('menuSecShardsSkins',
                hhMenuSwitch('plusGirlSkins')
                + hhMenuInput('sandalwoodMinShardsThreshold', P.sandalwoodLimit, 'text-align:center; width:90px'))
            + debugOnly(debugEnabled, group('menuSecMultiFights',
                hhMenuSwitch('useX10Fights', '', true)
                + hhMenuSwitch('useX10FightsAllowNormalEvent')
                + hhMenuInput('minShardsX10', P.minShardsX, 'text-align:center; width:90px')
                + hhMenuSwitch('useX50Fights', '', true)
                + hhMenuSwitch('useX50FightsAllowNormalEvent')
                + hhMenuInput('minShardsX50', P.minShardsX, 'text-align:center; width:90px'), '', true)),
    },
    {
        id: 'season', icon: '❄️', nameKey: 'menuTabSeason', titleKey: 'autoSeasonTitle',
        groups:
            group('menuSecFightCollect',
                hhMenuSwitch('autoSeason')
                + hhMenuSwitch('autoSeasonCollect')
                + hhMenuSwitch('autoSeasonCollectAll')
                + hhMenuSelect('seasonFocusSelector', 'max-width:130px;'), 'isEnabledSeason', true)
            + group('menuSecOpponents',
                hhMenuSwitch('autoSeasonBoostedOnly')
                + hhMenuSwitch('autoSeasonSkipLowMojo')
                + switchWithInput('autoSeasonMaxTier', 'autoSeasonMaxTierNb', P.autoSeasonMaxTierNb, '34px')
                + hhMenuSwitch('autoSeasonMaxTierHard')
                + debugOnly(debugEnabled, hhMenuSwitch('autoSeasonPassReds', '', true)))
            + group('menuSecThresholds',
                hhMenuInputWithImg('autoSeasonThreshold', P.autoSeasonThreshold, 'text-align:center; width:34px', 'pictures/design/ic_kiss.png', 'numeric')
                + hhMenuInputWithImg('autoSeasonRunThreshold', P.autoSeasonRunThreshold, 'text-align:center; width:34px', 'pictures/design/ic_kiss.png', 'numeric')
                + hhMenuSwitch('seasonDisplayPowerCalc')),
    },
    {
        id: 'leagues', icon: '🏆', nameKey: 'menuTabLeagues', titleKey: 'autoLeaguesTitle',
        groups:
            group('menuSecFightCollect',
                hhMenuSwitch('autoLeagues')
                + hhMenuSwitch('autoLeaguesCollect')
                + hhMenuSelect('autoLeaguesSelector', 'max-width:150px;'), 'isEnabledLeagues', true)
            + group('menuSecOpponents',
                hhMenuSelect('autoLeaguesSortMode', 'max-width:130px;')
                + hhMenuSwitch('autoLeaguesBoostedOnly')
                + hhMenuSwitch('autoLeaguesAllowWinCurrent')
                + hhMenuSwitch('autoLeaguesForceOneFight')
                + hhMenuSwitch('leagueListDisplayPowerCalc'), '', true)
            + group('menuSecThresholds',
                hhMenuInputWithImg('autoLeaguesThreshold', P.autoLeaguesThreshold, 'text-align:center; width:34px', 'pictures/design/league_points.png', 'numeric')
                + hhMenuInputWithImg('autoLeaguesRunThreshold', P.autoLeaguesRunThreshold, 'text-align:center; width:34px', 'pictures/design/league_points.png', 'numeric')
                + hhMenuInput('autoLeaguesSecurityThreshold', P.autoLeaguesSecurityThreshold, 'text-align:center; width:34px', '', 'numeric')),
    },
    {
        id: 'champions', icon: '🥊', nameKey: 'menuTabChampions', titleKey: 'autoChampsTitle',
        groups:
            group('autoChampsTitle',
                hhMenuSwitch('autoChamps')
                + hhMenuSwitch('autoChampsForceStart')
                + hhMenuSwitchWithImg('autoChampsUseEne', 'pictures/design/ic_energy_quest.png')
                + hhMenuInput('autoChampsFilter', P.autoChampsFilter, 'text-align:center; width:70px')
                + hhMenuSwitch('autoChampsForceStartEventGirl'), 'isEnabledChamps')
            + group('menuSecClubChamp',
                hhMenuSwitch('autoClubChamp')
                + hhMenuSwitch('autoClubForceStart')
                + hhMenuInputWithImg('autoClubChampMax', P.autoClubChampMax, 'text-align:center; width:50px', 'pictures/design/champion_ticket.png', 'numeric')
                + hhMenuSwitch('showClubButtonInPoa')
                + hhMenuSwitch('autoChampAlignTimer'), 'isEnabledClubChamp')
            + group('menuSecTeam',
                hhMenuInput('autoChampsTeamLoop', P.autoChampsTeamLoop, 'text-align:center; width:34px', '', 'numeric')
                + hhMenuInput('autoChampsGirlThreshold', P.nWith1000sSeparator, 'text-align:right; width:60px')
                + hhMenuSwitch('autoChampsTeamKeepSecondLine')
                + hhMenuSwitch('autoBuildChampsTeam'))
            + group('autoPantheonTitle',
                hhMenuSwitch('autoPantheon')
                + hhMenuInputWithImg('autoPantheonThreshold', P.autoPantheonThreshold, 'text-align:center; width:34px', 'pictures/design/ic_worship.svg', 'numeric')
                + hhMenuInputWithImg('autoPantheonRunThreshold', P.autoPantheonRunThreshold, 'text-align:center; width:34px', 'pictures/design/ic_worship.svg', 'numeric')
                + hhMenuSwitch('autoPantheonBoostedOnly'), 'isEnabledPantheon'),
    },
    {
        id: 'labyrinth', icon: '🌀', nameKey: 'menuTabLabyrinth', titleKey: 'autoLabyrinthTitle',
        groups:
            group('autoLabyrinthTitle',
                hhMenuSwitch('autoLabyrinth')
                + hhMenuSelect('autoLabyDifficulty', 'max-width:110px;')
                + hhMenuSwitch('autoLabyHard')
                + hhMenuSwitch('autoLabySweep')
                + hhMenuSwitch('autoLabyCustomTeamBuilder'), 'isEnabledLabyrinth', true),
    },
    {
        id: 'shop', icon: '🛒', nameKey: 'menuTabShop', titleKey: 'autoBuy',
        groups:
            group('menuSecStats',
                hhMenuSwitchWithImg('autoStatsSwitch', 'design/ic_plus.svg')
                + hhMenuInput('autoStats', P.nWith1000sSeparator, '', 'maxMoneyInputField'), 'isEnabledShop')
            + group('menuSecBooks',
                hhMenuSwitchWithImg('autoExpW', 'design/ic_books_gray.svg')
                + hhMenuInput('maxExp', P.nWith1000sSeparator, '', 'maxMoneyInputField')
                + hhMenuInput('autoExp', P.nWith1000sSeparator, '', 'maxMoneyInputField'))
            + group('menuSecGifts',
                hhMenuSwitchWithImg('autoAffW', 'design/ic_gifts_gray.svg')
                + hhMenuInput('maxAff', P.nWith1000sSeparator, '', 'maxMoneyInputField')
                + hhMenuInput('autoAff', P.nWith1000sSeparator, '', 'maxMoneyInputField'))
            + group('menuSecBoosters',
                hhMenuSwitchWithImg('autoBuyBoosters', 'design/ic_boosters_gray.svg', true)
                + hhMenuInput('maxBooster', P.nWith1000sSeparator, 'text-align:right; width:60px')
                + hhMenuInput('autoBuyBoostersFilter', P.autoBuyBoostersFilter, 'text-align:center; width:90px')
                + hhMenuSwitch('autoEquipBoosters')
                + hhMenuInput('autoEquipBoostersSlots', P.autoEquipBoostersSlots, 'text-align:center; width:90px')
                + hhMenuInput('autoEquipMythicBooster', P.autoEquipMythicBooster, 'text-align:center; width:90px'), '', true)
            + group('menuSecMarketTools',
                hhMenuSwitchWithImg('showMarketTools', 'design/menu/panel.svg')
                + hhMenuSwitch('updateMarket')),
    },
    {
        id: 'events', icon: '🎪', nameKey: 'menuTabEvents', titleKey: 'eventTitle',
        groups:
            group('menuSecEventDisplay',
                hhMenuSwitch('hideOwnedGirls', '', false, true), 'isEnabledEvents')
            + group('autoPentaDrillTitle',
                hhMenuSwitch('autoPentaDrill')
                + hhMenuSwitch('autoPentaDrillCollect')
                + hhMenuSwitch('autoPentaDrillCollectAll')
                + hhMenuSwitch('autoPentaDrillBoostedOnly')
                + hhMenuInputWithImg('autoPentaDrillThreshold', P.autoPentaDrillThreshold, 'text-align:center; width:34px', 'images/penta_drill/penta_drill.png', 'numeric')
                + hhMenuInputWithImg('autoPentaDrillRunThreshold', P.autoPentaDrillRunThreshold, 'text-align:center; width:34px', 'images/penta_drill/penta_drill.png', 'numeric'), 'isEnabledPentaDrill', true)
            + group('seasonalEventTitle',
                hhMenuSwitch('autoSeasonalEventCollect')
                + hhMenuSwitch('autoSeasonalEventCollectAll')
                + hhMenuSwitch('autoSeasonalBuyFreeCard'), 'isEnabledSeasonalEvent')
            + group('doublePenetrationEventTitle',
                hhMenuSwitch('autodpEventCollect')
                + hhMenuSwitch('autodpEventCollectAll'), 'isEnabledDPEvent')
            + group('livelySceneEventTitle',
                hhMenuSwitch('autoLivelySceneEventCollect')
                + hhMenuSwitch('autoLivelySceneEventCollectAll'), 'isEnabledLivelySceneEvent')
            + group('sultryMysteriesEventTitle',
                hhMenuSwitch('sultryMysteriesEventRefreshShop')
                + hhMenuSwitch('sultryMysteriesAutoOpen'), 'isEnabledSultryMysteriesEvent')
            + group('bossBangEventTitle',
                hhMenuSwitch('bossBangEvent')
                + hhMenuInput('bossBangMinTeam', P.bossBangMinTeam, 'text-align:center; width:34px', '', 'numeric'), 'isEnabledBossBangEvent')
            + group('poaTitle',
                hhMenuSwitch('autoPoACollect')
                + hhMenuSwitch('autoPoACollectAll'), 'isEnabledPoa'),
    },
    {
        id: 'harem', icon: '💕', nameKey: 'menuTabHarem', titleKey: 'haremTitle',
        groups:
            group('haremTitle',
                hhMenuSwitch('showHaremAvatarMissingGirls', '', false, true)
                + hhMenuSwitchWithImg('showHaremTools', 'design/menu/panel.svg')
                + hhMenuSwitchWithImg('showHaremSkillsButtons', 'design/menu/panel.svg')),
    },
    ];
}

/** The rail of area buttons plus one pane per area. */
export function buildTabbedBody(debugEnabled: boolean): string {
    const defs = tabs(debugEnabled);
    const rail = defs.map(tab =>
        `<div class="menuTab" data-tab="${tab.id}">`
            + `<span class="menuTabIcon">${tab.icon}</span>`
            + `<span class="menuTabName">${t(tab.nameKey)}</span>`
        + `</div>`).join('');
    const panes = defs.map(tab =>
        `<div class="menuPane" data-pane="${tab.id}">`
            + `<div class="menuPaneTitle">${t(tab.titleKey)}</div>`
            + `<div class="menuGroups">${tab.groups}</div>`
        + `</div>`).join('');
    return `<div class="menuBody">`
        + `<div class="menuTabs" id="sMenuTabs">${rail}</div>`
        + `<div class="menuPanes" id="sMenuPanes">${panes}</div>`
    + `</div>`;
}

/** Computed at call time, never at module top level (see StorageKeys guard). */
function tabStorageKey(): string {
    return MenuPorts.storedVarPrefix + TK.menuTab;
}

function selectTab(id: string): void {
    for (const el of document.querySelectorAll('#sMenuTabs .menuTab')) {
        el.classList.toggle('active', (el as HTMLElement).dataset.tab === id);
    }
    for (const el of document.querySelectorAll('#sMenuPanes .menuPane')) {
        el.classList.toggle('active', (el as HTMLElement).dataset.pane === id);
    }
    const panes = document.getElementById('sMenuPanes');
    if (panes !== null) panes.scrollTop = 0;
}

/**
 * Wires the tab rail and restores the area that was open before.
 *
 * Must run AFTER maskInactiveMenus(): a game without champions has every group
 * of that pane hidden, and an area with nothing left in it should not offer a
 * button at all. If the remembered area is one of those, the first remaining
 * one is opened instead.
 */
export function initMenuTabs(): void {
    const rail = document.getElementById('sMenuTabs');
    if (rail === null) return;

    const available: string[] = [];
    for (const tabEl of Array.from(rail.querySelectorAll('.menuTab')) as HTMLElement[]) {
        const id = tabEl.dataset.tab;
        if (id === undefined) continue;
        const pane = document.querySelector(`#sMenuPanes .menuPane[data-pane="${id}"]`);
        const groups = pane === null ? [] : Array.from(pane.querySelectorAll('.menuGroup'));
        const anyVisible = groups.some(g => (g as HTMLElement).style.display !== 'none');
        if (anyVisible) {
            available.push(id);
            tabEl.addEventListener('click', () => {
                selectTab(id);
                MenuPorts.setStoredValue(tabStorageKey(), id);
            });
        } else {
            tabEl.style.display = 'none';
        }
    }
    if (available.length === 0) return;

    const remembered = String(MenuPorts.getStoredValue(tabStorageKey()) ?? '');
    selectTab(available.includes(remembered) ? remembered : available[0]);
}
