// Pipeline.integration.spec.ts -- Integration tests that drive the
// real Scheduler against the real pipeline configuration. Validates
// priority ordering, cool-down behaviour, and the interaction between
// the two production handlers (handleEventParsing, handleLeague).
//
// Unit tests for the individual handlers' preconditions live in
// Pipeline.config.spec.ts. Unit tests for the Scheduler state machine
// (against synthetic handler configs) live in Scheduler.spec.ts.
// This file fills the gap between the two: real Scheduler + real
// pipeline + mocked module side-effects.

// Mocks must be declared before Scheduler / Pipeline.config import.

const leagueState = {
  isAutoLeagueActivated: true,
  isTimeToFight: true,
  doLeagueBattle: jest.fn(),
};

const eventModuleState = {
  parseEventPage: jest.fn().mockResolvedValue(true),
};

jest.mock('../../src/Module/League', () => ({
  LeagueHelper: {
    isAutoLeagueActivated: () => leagueState.isAutoLeagueActivated,
    isTimeToFight: () => leagueState.isTimeToFight,
    doLeagueBattle: (...args: unknown[]) => leagueState.doLeagueBattle(...args),
  },
}));

jest.mock('../../src/Module/Events/EventModule', () => ({
  EventModule: {
    parseEventPage: (...args: unknown[]) => eventModuleState.parseEventPage(...args),
    getEventGirl: jest.fn().mockReturnValue({}),
    getEventMythicGirl: jest.fn().mockReturnValue({}),
    parsePageForEventId: jest.fn().mockReturnValue({ eventIDs: [], bossBangEventIDs: [] }),
  },
}));

// Mocks for the 19 additional Pipeline.config handlers added in 3.2.G.complete.
// These keep Pipeline.integration.spec light: every handler precondition that
// touches a domain module short-circuits to false in this default-state world,
// so the integration test still focuses on handleEventParsing vs handleLeague
// (the only two handlers whose mocks fully exercise their step.fn).

jest.mock('../../src/Helper/HHHelper', () => ({
  getHHVars: jest.fn().mockReturnValue(0),
}));

jest.mock('../../src/Helper/HeroHelper', () => ({
  HeroHelper: { getMoney: jest.fn().mockReturnValue(0), getLevel: jest.fn().mockReturnValue(1) },
  getHero: jest.fn().mockReturnValue({ updates: jest.fn() }),
}));

jest.mock('../../src/Module/Shop', () => ({
  Shop: { isTimeToCheckShop: jest.fn().mockReturnValue(false), updateShop: jest.fn() },
}));

jest.mock('../../src/Module/Booster', () => ({
  Booster: { autoEquipBoosters: jest.fn().mockResolvedValue(false) },
}));

jest.mock('../../src/Module/harem/Harem', () => ({
  Harem: { HaremSizeNeedsRefresh: jest.fn().mockReturnValue(false) },
}));

jest.mock('../../src/Module/harem/HaremSalary', () => ({
  HaremSalary: { getSalary: jest.fn().mockResolvedValue(false) },
}));

jest.mock('../../src/Module/PlaceOfPower', () => ({
  PlaceOfPower: {
    isActivated: jest.fn().mockReturnValue(false),
    collectAndUpdate: jest.fn().mockResolvedValue(false),
    doPowerPlacesStuff: jest.fn().mockResolvedValue(false),
    removePopFromPopToStart: jest.fn(),
  },
}));

jest.mock('../../src/Module/GenericBattle', () => ({
  GenericBattle: { doBattle: jest.fn() },
}));

jest.mock('../../src/Module/Troll', () => ({
  Troll: {
    isTrollFightActivated: jest.fn().mockReturnValue(false),
    doBossBattle: jest.fn().mockResolvedValue(false),
    canBuyFight: jest.fn().mockReturnValue({ canBuy: false }),
    canBuyFightForRaid: jest.fn().mockReturnValue({ canBuy: false }),
  },
}));

jest.mock('../../src/Module/Pachinko', () => ({
  Pachinko: {
    getMythicPachinko: jest.fn().mockResolvedValue(false),
    getGreatPachinko: jest.fn().mockResolvedValue(false),
    getEquipmentPachinko: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../../src/Module/Quest', () => ({
  QuestHelper: { getEnergy: jest.fn().mockReturnValue(0), run: jest.fn() },
}));

jest.mock('../../src/Module/Events/Season', () => ({
  Season: {
    isTimeToFight: jest.fn().mockReturnValue(false),
    run: jest.fn().mockResolvedValue(false),
    goAndCollect: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('../../src/Module/PentaDrill', () => ({
  PentaDrill: {
    isTimeToFight: jest.fn().mockReturnValue(false),
    run: jest.fn(),
    goAndCollect: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('../../src/Module/Pantheon', () => ({
  Pantheon: {
    isEnabled: jest.fn().mockReturnValue(false),
    isTimeToFight: jest.fn().mockReturnValue(false),
    run: jest.fn(),
  },
}));

jest.mock('../../src/Module/DailyGoals', () => ({
  DailyGoals: {
    isPantheonDailyGoal: jest.fn().mockReturnValue(false),
    goAndCollect: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('../../src/Module/Events/SeasonalEvent', () => ({}), { virtual: true });

jest.mock('../../src/Module/Events/Seasonal', () => ({
  SeasonalEvent: {
    goAndCollect: jest.fn().mockReturnValue(false),
    goAndCollectFreeCard: jest.fn(),
    goAndCollectMegaEventRankRewards: jest.fn(),
  },
}));

jest.mock('../../src/Module/Events/PathOfValue', () => ({
  PathOfValue: {
    isEnabled: jest.fn().mockReturnValue(false),
    goAndCollect: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('../../src/Module/Events/PathOfGlory', () => ({
  PathOfGlory: {
    isEnabled: jest.fn().mockReturnValue(false),
    goAndCollect: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('../../src/Module/Events/BossBang', () => ({
  BossBang: { goToFightPage: jest.fn().mockResolvedValue(false) },
}));

jest.mock('../../src/Module/Events/LoveRaidManager', () => ({
  LoveRaidManager: {
    isActivated: jest.fn().mockReturnValue(false),
    isAnyActivated: jest.fn().mockReturnValue(false),
    parse: jest.fn(),
    getTrollRaids: jest.fn().mockReturnValue([]),
    filterByRaidStars: jest.fn().mockReturnValue([]),
    getRaidStarsRaidToFight: jest.fn().mockReturnValue(undefined),
    getRaidToFight: jest.fn().mockReturnValue(undefined),
  },
}));

jest.mock('../../src/Module/Contest', () => ({
  Contest: {
    getClaimsButton: jest.fn().mockReturnValue([]),
    run: jest.fn(),
  },
}));

jest.mock('../../src/Module/Missions', () => ({
  Missions: { run: jest.fn() },
}));

jest.mock('../../src/Module/Champion', () => ({
  Champion: { doChampionStuff: jest.fn() },
}));

jest.mock('../../src/Module/ClubChampion', () => ({
  ClubChampion: { doClubChampionStuff: jest.fn() },
}));

jest.mock('../../src/Module/Bundles', () => ({
  Bundles: { goAndCollectFreeBundles: jest.fn() },
}));

jest.mock('../../src/Module/Labyrinth', () => ({
  Labyrinth: { isEnabled: jest.fn().mockReturnValue(false) },
}));

jest.mock('../../src/Module/LabyrinthAuto', () => ({
  LabyrinthAuto: jest.fn().mockImplementation(() => ({ run: jest.fn() })),
}));

jest.mock('../../src/Service/ParanoiaService', () => ({
  ParanoiaService: { checkParanoiaSpendings: jest.fn().mockReturnValue(0) },
}));

jest.mock('../../src/Service/PageNavigationService', () => ({
  gotoPage: jest.fn().mockReturnValue(true),
  safeReload: jest.fn(),
}));

jest.mock('../../src/Helper/TimeHelper', () => ({
  getLimitTimeBeforeEnd: jest.fn().mockReturnValue(0),
  randomInterval: jest.fn().mockReturnValue(60),
}));

jest.mock('../../src/Utils/Utils', () => ({
  getHHAjax: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../src/Helper/ConfigHelper', () => ({
  ConfigHelper: {
    getHHScriptVars: jest.fn().mockReturnValue(true),
  },
}));

const persistedStore: Record<string, string> = {};
const eventsListState = {
  raw: JSON.stringify({
    'event-1': { isCompleted: false, next_refresh: 0 }, // stale
  }),
};

jest.mock('../../src/Helper/StorageHelper', () => ({
  getStoredValue: jest.fn().mockImplementation((key: string) => {
    if (key === 'HHAuto_master') return 'true';
    if (key === 'HHAuto_Temp_autoLoop') return 'true';
    if (key === 'HHAuto_Temp_trollWaitForEnergy') return 'false';
    if (key === 'HHAuto_Temp_eventsList') return eventsListState.raw;
    if (key in persistedStore) return persistedStore[key];
    return undefined;
  }),
  getStoredJSON: jest.fn().mockImplementation((key: string, defaultValue: unknown) => {
    const raw = persistedStore[key];
    if (raw === undefined) return defaultValue;
    try { return JSON.parse(raw); } catch { return defaultValue; }
  }),
  setStoredValue: jest.fn().mockImplementation((key: string, value: unknown) => {
    persistedStore[key] = String(value);
  }),
}));

jest.mock('../../src/Service/MouseService', () => ({
  get mouseBusy() { return false; },
}));

jest.mock('../../src/config/HHStoredVars', () => ({
  HHStoredVarPrefixKey: 'HHAuto_',
}));

jest.mock('../../src/config/StorageKeys', () => ({
  SK: { master: 'master' },
  TK: {
    autoLoop: 'Temp_autoLoop',
    eventsList: 'Temp_eventsList',
    trollWaitForEnergy: 'Temp_trollWaitForEnergy',
    pipelineLastRunAt: 'Temp_pipelineLastRunAt',
  },
}));

jest.mock('../../src/Utils/LogUtils', () => ({
  logHHAuto: jest.fn(),
}));

// Real imports come last so the mocks above are in place.
import { Scheduler } from '../../src/Service/Scheduler';
import { pipeline } from '../../src/Service/Pipeline.config';
import { AutoLoopContext } from '../../src/Service/AutoLoopContext';

function makeCtx(overrides: Partial<AutoLoopContext> = {}): AutoLoopContext {
  return {
    busy: false,
    lastActionPerformed: 'none',
    currentPower: 0,
    canCollectCompetitionActive: false,
    eventIDs: [],
    bossBangEventIDs: [],
    currentPage: 'home.html',
    ...overrides,
  };
}

describe('Pipeline integration (real Scheduler + real pipeline)', () => {
  let scheduler: Scheduler;
  let ctx: AutoLoopContext;

  beforeEach(() => {
    for (const key of Object.keys(persistedStore)) delete persistedStore[key];
    scheduler = new Scheduler();
    ctx = makeCtx();
    leagueState.isAutoLeagueActivated = true;
    leagueState.isTimeToFight = true;
    leagueState.doLeagueBattle.mockClear();
    eventModuleState.parseEventPage.mockClear();
    eventModuleState.parseEventPage.mockResolvedValue(true);
    eventsListState.raw = JSON.stringify({
      'event-1': { isCompleted: false, next_refresh: 0 },
    });
  });

  describe('priority ordering', () => {
    it('runs handleEventParsing (priority 1) before handleLeague (priority 13) when both are ready', async () => {
      await scheduler.tick(ctx);
      expect(eventModuleState.parseEventPage).toHaveBeenCalledTimes(1);
      expect(leagueState.doLeagueBattle).not.toHaveBeenCalled();
    });

    it('runs handleLeague when handleEventParsing has nothing stale to parse', async () => {
      eventsListState.raw = JSON.stringify({
        'event-1': { isCompleted: true, next_refresh: 0 }, // not stale
      });
      await scheduler.tick(ctx);
      expect(eventModuleState.parseEventPage).not.toHaveBeenCalled();
      expect(leagueState.doLeagueBattle).toHaveBeenCalledTimes(1);
    });

    it('skips handleLeague when League is not activated', async () => {
      eventsListState.raw = JSON.stringify({});
      leagueState.isAutoLeagueActivated = false;
      await scheduler.tick(ctx);
      expect(leagueState.doLeagueBattle).not.toHaveBeenCalled();
    });
  });

  describe('cool-down', () => {
    it('honours handleEventParsing minIntervalMs of 2000 between consecutive ticks', async () => {
      await scheduler.tick(ctx);
      expect(eventModuleState.parseEventPage).toHaveBeenCalledTimes(1);

      // Immediately ticking again must not re-run handleEventParsing.
      // handleLeague would run because its cool-down is independent,
      // but we re-stub doLeagueBattle to a no-op so the assertion focuses
      // on the cool-down for handleEventParsing.
      await scheduler.tick(ctx);
      expect(eventModuleState.parseEventPage).toHaveBeenCalledTimes(1);
    });

    it('persists lastRunAt across Scheduler instances (sessionStorage hydration)', async () => {
      await scheduler.tick(ctx);
      expect(eventModuleState.parseEventPage).toHaveBeenCalledTimes(1);

      // Construct a fresh Scheduler in the same session (mimicking a
      // gotoPage reload). The constructor restores lastRunAt from the
      // mocked sessionStorage so the cool-down still applies.
      const fresh = new Scheduler();
      await fresh.tick(ctx);
      expect(eventModuleState.parseEventPage).toHaveBeenCalledTimes(1);
    });
  });

  describe('failure handling', () => {
    it('records lastRunAt even when the handleLeague step throws', async () => {
      eventsListState.raw = JSON.stringify({}); // skip handleEventParsing
      leagueState.doLeagueBattle.mockImplementation(() => { throw new Error('boom'); });

      await scheduler.tick(ctx);

      // After failure the chain reset to IDLE and lastRunAt was bumped.
      // Calling tick() again immediately must therefore not re-run the
      // failing step.
      leagueState.doLeagueBattle.mockClear();
      await scheduler.tick(ctx);
      expect(leagueState.doLeagueBattle).not.toHaveBeenCalled();
    });
  });

  describe('SOFT-abort', () => {
    it('does not start any chain when autoLoop is disabled', async () => {
      // Disable autoLoop via the mocked StorageHelper.
      const helper = jest.requireMock('../../src/Helper/StorageHelper') as { getStoredValue: jest.Mock };
      const original = helper.getStoredValue.getMockImplementation();
      helper.getStoredValue.mockImplementation((key: string) => {
        if (key === 'HHAuto_Temp_autoLoop') return 'false';
        return original ? original(key) : undefined;
      });

      await scheduler.tick(ctx);
      expect(eventModuleState.parseEventPage).not.toHaveBeenCalled();
      expect(leagueState.doLeagueBattle).not.toHaveBeenCalled();

      helper.getStoredValue.mockImplementation(original);
    });
  });

  describe('pipeline shape', () => {
    it('contains both production handlers in the expected order', () => {
      const names = pipeline.map((h) => h.name);
      expect(names).toContain('handleEventParsing');
      expect(names).toContain('handleLeague');
      // Pipeline order = array position. handleEventParsing must come first
      // because it populates the event data that handleLeague's wait-gate
      // (and other future handlers) consult. See Pipeline.config.ts header.
      const idxParsing = names.indexOf('handleEventParsing');
      const idxLeague = names.indexOf('handleLeague');
      expect(idxParsing).toBeLessThan(idxLeague);
    });
  });
});
