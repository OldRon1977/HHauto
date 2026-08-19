import { setMenuPorts } from '../../../src/Helper/menu/MenuPorts';
import { getMenu } from '../../../src/Helper/menu/MenuTemplate';
import { buildTabbedBody } from '../../../src/Helper/menu/MenuTabs';
import { buildTestPorts } from './menuTestPorts';

/**
 * Every input/select id the three-column menu rendered, taken from
 * MenuColumnLeft/Middle/Right before they were replaced by the tab layout in
 * 8.10.0. The rearrangement must not lose a single setting: MenuSettings binds
 * stored values to these ids, so a missing one silently stops saving.
 */
const CONTROL_IDS_BEFORE_8_10 = [
    'AllMaskRewards', 'autoAdsClick', 'autoAff', 'autoAffW',
    'autoBuildChampsTeam', 'autoBuyBoosters', 'autoBuyBoostersFilter', 'autoBuyLoveRaidTrollNumber',
    'autoBuyMythicTrollNumber', 'autoBuyTrollNumber', 'autoChampAlignTimer', 'autoChamps',
    'autoChampsFilter', 'autoChampsForceStart', 'autoChampsForceStartEventGirl', 'autoChampsGirlThreshold',
    'autoChampsTeamKeepSecondLine', 'autoChampsTeamLoop', 'autoChampsUseEne', 'autoClubChamp',
    'autoClubChampMax', 'autoClubForceStart', 'autoContest', 'autoDailyGoals',
    'autoDailyGoalsCollect', 'autoEquipBoosters', 'autoEquipBoostersSlots', 'autoEquipMythicBooster',
    'autoExp', 'autoExpW', 'autoFreeBundlesCollect', 'autoFreePachinko',
    'autoLabyCustomTeamBuilder', 'autoLabyDifficulty', 'autoLabyHard', 'autoLabySweep',
    'autoLabyrinth', 'autoLeagues', 'autoLeaguesAllowWinCurrent', 'autoLeaguesBoostedOnly',
    'autoLeaguesCollect', 'autoLeaguesForceOneFight', 'autoLeaguesRunThreshold', 'autoLeaguesSecurityThreshold',
    'autoLeaguesSelector', 'autoLeaguesSortMode', 'autoLeaguesThreshold', 'autoLivelySceneEventCollect',
    'autoLivelySceneEventCollectAll', 'autoMission', 'autoMissionCollect', 'autoMissionKFirst',
    'autoPantheon', 'autoPantheonBoostedOnly', 'autoPantheonRunThreshold', 'autoPantheonThreshold',
    'autoPentaDrill', 'autoPentaDrillBoostedOnly', 'autoPentaDrillCollect', 'autoPentaDrillCollectAll',
    'autoPentaDrillDelay', 'autoPentaDrillRunThreshold', 'autoPentaDrillThreshold', 'autoPoACollect',
    'autoPoACollectAll', 'autoPoGCollect', 'autoPoGCollectAll', 'autoPoVCollect',
    'autoPoVCollectAll', 'autoPowerPlaces', 'autoPowerPlacesAll', 'autoPowerPlacesIndexFilter',
    'autoPowerPlacesInverted', 'autoPowerPlacesPrecision', 'autoPowerPlacesWaitMax', 'autoQuest',
    'autoQuestThreshold', 'autoSalary', 'autoSalaryMinSalary', 'autoSeason',
    'autoSeasonBoostedOnly', 'autoSeasonCollect', 'autoSeasonCollectAll', 'autoSeasonMaxTier',
    'autoSeasonMaxTierHard', 'autoSeasonMaxTierNb', 'autoSeasonPassReds', 'autoSeasonRunThreshold',
    'autoSeasonSkipLowMojo', 'autoSeasonThreshold', 'autoSeasonalBuyFreeCard', 'autoSeasonalEventCollect',
    'autoSeasonalEventCollectAll', 'autoSideQuest', 'autoStats', 'autoStatsSwitch',
    'autoTrollBattle', 'autoTrollLoveRaidByPassThreshold', 'autoTrollMythicByPassParanoia', 'autoTrollRunThreshold',
    'autoTrollSelector', 'autoTrollThreshold', 'autodpEventCollect', 'autodpEventCollectAll',
    'bossBangEvent', 'bossBangMinTeam', 'buyCombTimer', 'buyCombat',
    'buyLoveRaidCombat', 'buyMythicCombTimer', 'buyMythicCombat', 'collectAllTimer',
    'collectEventChest', 'compactDailyGoals', 'compactEndedContests', 'compactMissions',
    'compactPowerPlace', 'eventTrollOrder', 'hideOwnedGirls', 'invertMissions',
    'kobanBank', 'leagueListDisplayPowerCalc', 'loveRaidSelector', 'master',
    'maxAff', 'maxBooster', 'maxExp', 'minShardsX10',
    'minShardsX50', 'mousePause', 'mousePauseTimeout', 'paranoia',
    'paranoiaSpendsBefore', 'pipelineDiagnose', 'plusEvent', 'plusEventLoveRaidSandalWood',
    'plusEventMythic', 'plusEventMythicSandalWood', 'plusEventSandalWood', 'plusGirlSkins',
    'plusLoveRaid', 'raidStarsSelector', 'safeSecondsForContest', 'sandalwoodMinShardsThreshold',
    'seasonDisplayPowerCalc', 'seasonFocusSelector', 'settPerTab', 'showAdsBack',
    'showCalculatePower', 'showClubButtonInPoa', 'showHaremAvatarMissingGirls', 'showHaremSkillsButtons',
    'showHaremTools', 'showInfo', 'showInfoLeft', 'showMarketTools',
    'showRewardsRecap', 'showTooltips', 'spendKobans0', 'sultryMysteriesAutoOpen',
    'sultryMysteriesEventRefreshShop', 'updateMarket', 'useX10Fights', 'useX10FightsAllowNormalEvent',
    'useX50Fights', 'useX50FightsAllowNormalEvent', 'waitforContest',
];

/**
 * Controls added after the tab layout landed. Kept separate from the list above
 * so that stays a faithful record of the three-column menu.
 */
const CONTROL_IDS_ADDED_IN_8_10 = [
    'menuSingleColumn',
];

/** Buttons wired by StartService via $("#id"). */
const BUTTON_IDS = [
    'saveConfig', 'loadConfig', 'saveDefaults', 'blockOrder', 'menuOrder',
    'settingsSurvey', 'git', 'ReportBugs', 'DebugMenu',
];

describe('MenuTemplate', () => {
    let storedValues: Record<string, string>;

    beforeEach(() => {
        // setup-jest.js provides `global.GM = {}`; give it the shape the header reads.
        (global as { GM?: unknown }).GM = { info: { script: { version: '0.0.0-test' } } };
        storedValues = {};
        setMenuPorts(buildTestPorts({
            getTextForUI: (id: string, type: string) => `${id}:${type}`,
            getHHScriptVars: (id: string) => (id === 'baseImgPath' ? 'https://img.example' : ''),
            getStoredValue: (name: string) => storedValues[name] ?? null,
            storedVarPrefix: 'HHAuto_',
        }));
    });

    const parse = (html: string): HTMLElement => {
        const container = document.createElement('div');
        container.innerHTML = html;
        expect(container.children).toHaveLength(1);
        return container.firstElementChild as HTMLElement;
    };

    // Debug-gated rows are rendered but hidden, so read the menu with debug on
    // to see the complete inventory.
    const fullMenu = (): HTMLElement => {
        storedValues['HHAuto_Temp_Debug'] = 'true';
        return parse(getMenu());
    };

    describe('getMenu', () => {
        it('produces parse-stable markup (no dangling elements)', () => {
            const menu = parse(getMenu());
            const ids = Array.from(menu.querySelectorAll('input, select')).map((el) => el.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('still renders every control the three-column menu had', () => {
            const ids = Array.from(fullMenu().querySelectorAll('input, select')).map((el) => el.id);
            for (const id of CONTROL_IDS_BEFORE_8_10) {
                expect(ids).toContain(id);
            }
        });

        it('adds only the controls 8.10.0 introduced', () => {
            const ids = Array.from(fullMenu().querySelectorAll('input, select')).map((el) => el.id);
            const added = ids.filter((id) => !CONTROL_IDS_BEFORE_8_10.includes(id));
            expect(added.sort()).toEqual([...CONTROL_IDS_ADDED_IN_8_10].sort());
        });

        it('renders each header and footer button exactly once', () => {
            const menu = fullMenu();
            for (const id of BUTTON_IDS) {
                expect(menu.querySelectorAll(`#${id}`)).toHaveLength(1);
            }
        });

        it('hides survey-hidden rows unless debug is enabled', () => {
            const hidden = parse(getMenu());
            expect(hidden.querySelector('#useX10Fights')!.closest('div[style*="display:none"]'))
                .not.toBeNull();

            storedValues['HHAuto_Temp_Debug'] = 'true'; // TK.Debug
            const debug = parse(getMenu());
            expect(debug.querySelector('#useX10Fights')!.closest('div[style*="display:none"]'))
                .toBeNull();
        });
    });

    describe('buildTabbedBody', () => {
        it('gives every tab a matching pane', () => {
            const body = parse(buildTabbedBody(true));
            const tabs = Array.from(body.querySelectorAll('.menuTab'))
                .map((el) => (el as HTMLElement).dataset.tab);
            const panes = Array.from(body.querySelectorAll('.menuPane'))
                .map((el) => (el as HTMLElement).dataset.pane);
            expect(tabs).toEqual(panes);
            expect(tabs.length).toBeGreaterThan(0);
            expect(new Set(tabs).size).toBe(tabs.length);
        });

        it('gives every group a heading', () => {
            const body = parse(buildTabbedBody(true));
            for (const grp of Array.from(body.querySelectorAll('.menuGroup'))) {
                const title = grp.querySelector('.menuGroupTitle');
                expect(title).not.toBeNull();
                expect(title!.textContent!.trim()).not.toBe('');
            }
        });

        it('keeps the masking ids maskInactiveMenus() switches on', () => {
            const body = parse(buildTabbedBody(true));
            for (const id of ['isEnabledMission', 'isEnabledPoV', 'isEnabledPantheon',
                'isEnabledLabyrinth', 'isEnabledSideQuest', 'isEnabledBossBangEvent']) {
                expect(body.querySelector(`#${id}`)).not.toBeNull();
            }
        });

        it('gates debug-only rows on its parameter', () => {
            const noDebug = parse(buildTabbedBody(false));
            expect(noDebug.querySelector('#useX10Fights')!.closest('div[style*="display:none"]'))
                .not.toBeNull();
            const withDebug = parse(buildTabbedBody(true));
            expect(withDebug.querySelector('#useX10Fights')!.closest('div[style*="display:none"]'))
                .toBeNull();
            expect(withDebug.querySelector('#autoLeaguesSelector')).not.toBeNull();
        });
    });
});
