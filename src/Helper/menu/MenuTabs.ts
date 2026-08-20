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
// Two layouts share this markup (#1834): the tab rail, and -- with
// SK.menuSingleColumn on -- every area stacked in one scrolling list, for
// players who want the whole configuration under one pair of eyes. The stacked
// layout is CSS only (#sMenu.menuStacked), so switching costs no rebuild and no
// reload. The area order is the user's (TK.menuOrder) in both.
//
// Reads its storage/translation helpers from MenuPorts so this file stays a
// graph leaf (see MenuPorts.ts).

import { HHAuto_inputPattern } from "../../config/InputPattern";
import { SK, TK } from "../../config/StorageKeys";
import { MenuPorts } from "./MenuPorts";
import { resolveMenuOrder } from "./MenuOrder";
import { countActive, formatBadge } from "./MenuBadge";
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
    /**
     * The switches in this area that make the script *act*, for the rail badge
     * (see MenuBadge.ts for why a count and not a red/green marker).
     *
     * Curated on purpose, not derived by a name rule -- `autoLeagues` and
     * `autoSeasonSkipLowMojo` both start with "auto" and only one of them does
     * anything on its own. Seeded from the settings the pipeline actually gates
     * its blocks on (`SK.` reads in Pipeline.config.ts) and then trimmed:
     *
     *   - modifiers are out. `plusEvent`, `useX10Fights`, `autoChampsUseEne`,
     *     `autoLeaguesBoostedOnly` only steer a run the master switch starts.
     *   - limiters are out. `paranoia` and `mousePause` restrain the script,
     *     they never make it do something.
     *   - display is out. Every `show*` / `hide*` / `compact*` / `invert*`.
     *   - the `…CollectAll` variants are IN: the pipeline preconditions gate
     *     them independently of their `…Collect` sibling, so either one alone
     *     is enough to make the block run.
     *
     * An area with nothing to count (Harem is display-only) gets no badge.
     */
    masters: readonly string[];
    groups: string;
}

function tabs(debugEnabled: boolean): TabDef[] {
    const P = HHAuto_inputPattern;
    return [
    {
        id: 'global', icon: '⚙️', nameKey: 'menuTabGlobal', titleKey: 'globalTitle',
        masters: [
            'autoFreeBundlesCollect',
            'collectEventChest',
        ],
        groups:
            group('menuSecBasics',
                hhMenuSwitch('paranoia')
                + switchWithInput('mousePause', 'mousePauseTimeout', P.mousePauseTimeout, '40px')
                + hhMenuSwitch('settPerTab')
                + hhMenuSwitch('showTooltips')
                + hhMenuSwitch('menuSingleColumn', '', false, true)
                + hhMenuSwitch('menuCompact', '', false, true))
            + group('menuSecTiming',
                hhMenuInput('collectAllTimer', P.collectAllTimer, 'text-align:center; width:30px')
                + switchWithInput('waitforContest', 'safeSecondsForContest', P.safeSecondsForContest, '40px')
                + hhMenuSwitch('paranoiaSpendsBefore')
                + hhMenuInput('autoPentaDrillDelay', P.autoPentaDrillDelay, 'text-align:center; width:30px')
                + hhMenuSwitch('pipelineDiagnose'))
            + group('menuSecKobans',
                hhMenuSwitchWithImg('spendKobans0', 'design/menu/affil_prog.svg', true)
                + hhMenuInputWithImg('kobanBank', P.nWith1000sSeparator, '', 'pictures/design/ic_hard_currency.png', 'text', 'maxMoneyInputField'))
            + group('menuSecAutoCollect',
                hhMenuSwitch('autoFreeBundlesCollect', 'isEnabledFreeBundles')
                + hhMenuSwitch('collectEventChest')),
    },
    {
        id: 'display', icon: '👁️', nameKey: 'menuTabDisplay', titleKey: 'displayTitle',
        masters: [
            'autoAdsClick',
        ],
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
        masters: [
            'autoMission',
            'autoMissionCollect',
            'autoContest',
            'autoDailyGoals',
            'autoDailyGoalsCollect',
            'autoFreePachinko',
            'autoSalary',
            'autoPowerPlaces',
            'autoQuest',
            'autoSideQuest',
            'autoPoVCollect',
            'autoPoVCollectAll',
            'autoPoGCollect',
            'autoPoGCollectAll',
        ],
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
                + hhMenuInput('autoSalaryMinSalary', P.nWith1000sSeparator, '', 'maxMoneyInputField'), 'isEnabledSalary')
            + group('powerPlacesTitle',
                hhMenuSwitch('autoPowerPlaces')
                + hhMenuInput('autoPowerPlacesIndexFilter', P.autoPowerPlacesIndexFilter, '', 'menuListInput menuListWide')
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
        masters: [
            'autoTrollBattle',
        ],
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
        masters: [
            'autoSeason',
            'autoSeasonCollect',
            'autoSeasonCollectAll',
        ],
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
        masters: [
            'autoLeagues',
            'autoLeaguesCollect',
        ],
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
        masters: [
            'autoChamps',
            'autoClubChamp',
            'autoPantheon',
        ],
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
                + hhMenuInput('autoChampsGirlThreshold', P.nWith1000sSeparator, '', 'maxMoneyInputField')
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
        masters: [
            'autoLabyrinth',
        ],
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
        masters: [
            'autoStatsSwitch',
            'autoBuyBoosters',
            'autoEquipBoosters',
        ],
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
                + hhMenuInput('maxBooster', P.nWith1000sSeparator, '', 'maxMoneyInputField')
                + hhMenuInput('autoBuyBoostersFilter', P.autoBuyBoostersFilter, '', 'menuListInput')
                + hhMenuSwitch('autoEquipBoosters')
                + hhMenuInput('autoEquipBoostersSlots', P.autoEquipBoostersSlots, '', 'menuListInput')
                + hhMenuInput('autoEquipMythicBooster', P.autoEquipMythicBooster, '', 'menuListInput'), '', true)
            + group('menuSecMarketTools',
                hhMenuSwitchWithImg('showMarketTools', 'design/menu/panel.svg')
                + hhMenuSwitch('updateMarket')),
    },
    {
        id: 'events', icon: '🎪', nameKey: 'menuTabEvents', titleKey: 'eventTitle',
        masters: [
            'autoPentaDrill',
            'autoPentaDrillCollect',
            'autoPentaDrillCollectAll',
            'autoSeasonalEventCollect',
            'autoSeasonalEventCollectAll',
            'autoSeasonalBuyFreeCard',
            'autodpEventCollect',
            'autodpEventCollectAll',
            'autoLivelySceneEventCollect',
            'autoLivelySceneEventCollectAll',
            'sultryMysteriesEventRefreshShop',
            'sultryMysteriesAutoOpen',
            'bossBangEvent',
            'autoPoACollect',
            'autoPoACollectAll',
        ],
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
        masters: [],
        groups:
            group('haremTitle',
                hhMenuSwitch('showHaremAvatarMissingGirls', '', false, true)
                + hhMenuSwitchWithImg('showHaremTools', 'design/menu/panel.svg')
                + hhMenuSwitchWithImg('showHaremSkillsButtons', 'design/menu/panel.svg')),
    },
    ];
}

/** Ids of every area this build has, in the order the code declares them. */
export function menuAreaIds(): string[] {
    return tabs(false).map(tab => tab.id);
}

/** Stored area order, or null when nothing was ever saved / the value is junk. */
function storedMenuOrder(): unknown {
    const raw = MenuPorts.getStoredValue(MenuPorts.storedVarPrefix + TK.menuOrder);
    if (typeof raw !== "string" || raw === "") return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/** The order to render in: the user's, repaired against this build's areas. */
export function effectiveMenuOrder(defaultIds: readonly string[]): string[] {
    return resolveMenuOrder(storedMenuOrder(), defaultIds);
}

/** True when the menu should render as one stacked list instead of tabs. */
export function isMenuStacked(): boolean {
    return MenuPorts.getStoredValue(MenuPorts.storedVarPrefix + SK.menuSingleColumn) === "true";
}

/** The rail of area buttons plus one pane per area. */
export function buildTabbedBody(debugEnabled: boolean): string {
    const declared = tabs(debugEnabled);
    const order = effectiveMenuOrder(declared.map(tab => tab.id));
    const defs = order
        .map(id => declared.find(tab => tab.id === id))
        .filter((tab): tab is TabDef => tab !== undefined);
    // The badge is filled in by refreshTabBadges() once the checkboxes carry
    // their stored state; rendering it here would always read "0/n".
    const rail = defs.map(tab =>
        `<div class="menuTab" data-tab="${tab.id}">`
            + `<span class="menuTabIcon">${tab.icon}</span>`
            + `<span class="menuTabName">${t(tab.nameKey)}</span>`
            + (tab.masters.length > 0 ? `<span class="menuTabBadge" data-badge="${tab.id}"></span>` : ``)
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
            // The stacked layout shows every pane, so an area with all groups
            // hidden has to be taken out there as well -- otherwise it renders
            // as a heading with nothing underneath it.
            if (pane !== null) pane.classList.add('menuPaneEmpty');
        }
    }
    if (available.length === 0) return;

    const remembered = String(MenuPorts.getStoredValue(tabStorageKey()) ?? '');
    selectTab(available.includes(remembered) ? remembered : available[0]);
}

/**
 * Switch between the tab rail and the stacked list. CSS-only, so no rebuild and
 * no reload: the panes keep their DOM, their bound inputs and their values. The
 * remembered area stays selected underneath, which is what makes switching back
 * land where the user left off.
 */
/** Denser rows and smaller type. CSS-only, like applyMenuLayout. */
export function applyMenuDensity(compact: boolean): void {
    const menu = document.getElementById('sMenu');
    if (menu === null) return;
    menu.classList.toggle('menuCompact', compact);
}

export function applyMenuLayout(stacked: boolean): void {
    const menu = document.getElementById('sMenu');
    if (menu === null) return;
    menu.classList.toggle('menuStacked', stacked);
    const panes = document.getElementById('sMenuPanes');
    if (panes !== null) panes.scrollTop = 0;
}

/**
 * Re-order rail and panes in place. appendChild on an element that is already a
 * child moves it, so walking the order once leaves the DOM in exactly that
 * sequence. Ids the DOM does not have (an area this game hides) are skipped.
 */
export function applyMenuOrder(order: readonly string[]): void {
    const rail = document.getElementById('sMenuTabs');
    const panes = document.getElementById('sMenuPanes');
    if (rail === null || panes === null) return;
    for (const id of order) {
        const tab = rail.querySelector(`.menuTab[data-tab="${id}"]`);
        if (tab !== null) rail.appendChild(tab);
        const pane = panes.querySelector(`.menuPane[data-pane="${id}"]`);
        if (pane !== null) panes.appendChild(pane);
    }
}

export interface MenuAreaRow {
    id: string;
    label: string;
}

/**
 * The areas the reorder popup lists: the ones actually on screen, in their
 * current order. An area this game has no features for is left out -- offering
 * a row for something the user cannot see would be noise. It is not lost
 * either: resolveMenuOrder puts any unmentioned area back at its default
 * position the next time the menu is built.
 */
export function visibleMenuAreas(): MenuAreaRow[] {
    const rail = document.getElementById('sMenuTabs');
    if (rail === null) return [];
    const rows: MenuAreaRow[] = [];
    for (const tabEl of Array.from(rail.querySelectorAll('.menuTab')) as HTMLElement[]) {
        const id = tabEl.dataset.tab;
        if (id === undefined || tabEl.style.display === 'none') continue;
        const iconEl = tabEl.querySelector('.menuTabIcon');
        const nameEl = tabEl.querySelector('.menuTabName');
        const icon = iconEl === null ? '' : String(iconEl.textContent ?? '');
        const name = nameEl === null ? id : String(nameEl.textContent ?? id);
        rows.push({ id, label: (icon + ' ' + name).trim() });
    }
    return rows;
}

/**
 * Read a switch straight from the panel rather than from storage, so the badge
 * follows a click immediately -- before the value is written. `undefined` means
 * the row is not in this build's markup (see countActive).
 */
function switchState(key: string): boolean | undefined {
    const el = document.getElementById(key);
    return el === null ? undefined : (el as HTMLInputElement).checked;
}

/** Repaint every badge from the current checkbox states. */
export function refreshTabBadges(debugEnabled = false): void {
    for (const tab of tabs(debugEnabled)) {
        if (tab.masters.length === 0) continue;
        const el = document.querySelector(`[data-badge="${tab.id}"]`);
        if (el === null) continue;
        const count = countActive(tab.masters, switchState);
        el.textContent = formatBadge(count);
        el.classList.toggle('idle', count.on === 0);
    }
}

let badgeHandlersBound = false;

/**
 * Keep the badges in step with the panel. Delegated on the panes container, so
 * it survives a layout switch and covers rows built later; the debug flag is
 * read per event because turning Debug on adds rows.
 */
export function bindTabBadgeUpdates(): void {
    if (badgeHandlersBound) return;
    const panes = document.getElementById('sMenuPanes');
    if (panes === null) return;
    badgeHandlersBound = true;
    panes.addEventListener('change', (event) => {
        const target = event.target as HTMLElement | null;
        if (target === null || (target as HTMLInputElement).type !== 'checkbox') return;
        refreshTabBadges(MenuPorts.getStoredValue(MenuPorts.storedVarPrefix + TK.Debug) === "true");
    });
}
