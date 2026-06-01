// Pipeline.config.spec.ts -- Unit tests for the pipeline configuration.
//
// Tests cover: config parsability, valid fields, no duplicates,
// handler-specific properties (atomic, ordering, interruptible).

// Mock all external dependencies that Pipeline.config.ts imports
jest.mock('../../src/Module/League', () => ({
  LeagueHelper: {
    isAutoLeagueActivated: jest.fn().mockReturnValue(true),
    isTimeToFight: jest.fn().mockReturnValue(true),
    doLeagueBattle: jest.fn(),
  },
}));

jest.mock('../../src/Module/Events/EventModule', () => ({
  EventModule: {
    parseEventPage: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../../src/Module/Shop', () => ({
  Shop: {
    isTimeToCheckShop: jest.fn().mockReturnValue(false),
    updateShop: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('../../src/Module/Booster', () => ({
  Booster: {
    autoEquipBoosters: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../../src/Module/Quest', () => ({
  QuestHelper: {
    getEnergy: jest.fn().mockReturnValue(0),
    run: jest.fn(),
  },
}));

jest.mock('../../src/Service/ParanoiaService', () => ({
  ParanoiaService: {
    checkParanoiaSpendings: jest.fn().mockReturnValue(0),
  },
}));

jest.mock('../../src/Module/Troll', () => ({
  Troll: {
    doBossBattle: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../../src/Helper/HHHelper', () => ({
  getHHVars: jest.fn().mockReturnValue(100),
}));

jest.mock('../../src/Helper/TimerHelper', () => ({
  checkTimer: jest.fn().mockReturnValue(false),
}));

jest.mock('../../src/Helper/ConfigHelper', () => ({
  ConfigHelper: {
    getHHScriptVars: jest.fn().mockReturnValue(true),
  },
}));

jest.mock('../../src/Helper/StorageHelper', () => ({
  getStoredValue: jest.fn().mockReturnValue('[]'),
  setStoredValue: jest.fn(),
  deleteStoredValue: jest.fn(),
}));

jest.mock('../../src/config/HHStoredVars', () => ({
  HHStoredVarPrefixKey: 'HHAuto_',
}));

jest.mock('../../src/config/StorageKeys', () => ({
  SK: {
    master: 'master',
    autoEquipBoosters: 'Setting_autoEquipBoosters',
    autoQuest: 'Setting_autoQuest',
    autoSideQuest: 'Setting_autoSideQuest',
  },
  TK: {
    eventsList: 'Temp_eventsList',
    trollWaitForEnergy: 'Temp_trollWaitForEnergy',
    charLevel: 'Temp_charLevel',
    autoLoop: 'Temp_autoLoop',
    questRequirement: 'Temp_questRequirement',
    paranoiaQuestBlocked: 'Temp_paranoiaQuestBlocked',
  },
}));

jest.mock('../../src/Utils/LogUtils', () => ({
  logHHAuto: jest.fn(),
}));

import { pipeline, getStaleEventIDs, pruneExpiredEvents } from '../../src/Service/Pipeline.config';
import { getStoredValue, setStoredValue, deleteStoredValue } from '../../src/Helper/StorageHelper';
import { AutoLoopContext } from '../../src/Service/AutoLoopContext';
const getStoredValueMock = getStoredValue as jest.Mock;
const setStoredValueMock = setStoredValue as jest.Mock;
const deleteStoredValueMock = deleteStoredValue as jest.Mock;

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

describe('Pipeline.config', () => {
  describe('pipeline array', () => {
    it('is a non-empty array', () => {
      expect(Array.isArray(pipeline)).toBe(true);
      expect(pipeline.length).toBeGreaterThan(0);
    });

    it('contains only valid HandlerConfig objects', () => {
      for (const handler of pipeline) {
        expect(handler).toHaveProperty('name');
        expect(handler).toHaveProperty('minIntervalMs');
        expect(handler).toHaveProperty('atomic');
        expect(handler).toHaveProperty('interruptible');
        expect(handler).toHaveProperty('precondition');
        expect(handler).toHaveProperty('steps');

        expect(typeof handler.name).toBe('string');
        expect(handler.name.length).toBeGreaterThan(0);
        expect(typeof handler.minIntervalMs).toBe('number');
        expect(handler.minIntervalMs).toBeGreaterThanOrEqual(0);
        expect(typeof handler.atomic).toBe('boolean');
        expect(['always', 'never']).toContain(handler.interruptible);
        expect(typeof handler.precondition).toBe('function');
        expect(Array.isArray(handler.steps)).toBe(true);
        expect(handler.steps.length).toBeGreaterThan(0);
      }
    });

    it('has no duplicate handler names', () => {
      const names = pipeline.map(h => h.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('does not expose a numeric priority field (replaced by array order)', () => {
      for (const handler of pipeline) {
        expect((handler as unknown as Record<string, unknown>)['priority']).toBeUndefined();
      }
    });
  });

  describe('handler steps', () => {
    it('all steps have valid name and fn', () => {
      for (const handler of pipeline) {
        for (const step of handler.steps) {
          expect(typeof step.name).toBe('string');
          expect(step.name.length).toBeGreaterThan(0);
          expect(typeof step.fn).toBe('function');
        }
      }
    });

    it('step timeoutMs is positive when defined', () => {
      for (const handler of pipeline) {
        for (const step of handler.steps) {
          if (step.timeoutMs !== undefined) {
            expect(step.timeoutMs).toBeGreaterThan(0);
          }
        }
      }
    });

    it('totalTimeoutMs is positive when defined', () => {
      for (const handler of pipeline) {
        if (handler.totalTimeoutMs !== undefined) {
          expect(handler.totalTimeoutMs).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('handleEventParsing', () => {
    const handler = pipeline.find(h => h.name === 'handleEventParsing')!;

    it('exists in pipeline', () => {
      expect(handler).toBeDefined();
    });

    it('is non-atomic and always interruptible', () => {
      expect(handler.atomic).toBe(false);
      expect(handler.interruptible).toBe('always');
    });

    it('runs before handleLeague (earlier index in pipeline)', () => {
      const idxParsing = pipeline.findIndex(h => h.name === 'handleEventParsing');
      const idxLeague = pipeline.findIndex(h => h.name === 'handleLeague');
      expect(idxParsing).toBeLessThan(idxLeague);
    });

    it('precondition returns boolean', () => {
      const result = handler.precondition(makeCtx());
      expect(typeof result).toBe('boolean');
    });

    it('step fn returns StepResult', async () => {
      const result = await handler.steps[0].fn(makeCtx());
      expect(result).toHaveProperty('ok');
      expect(result.ok).toBe(true);
    });
  });

  describe('handleLeague', () => {
    const handler = pipeline.find(h => h.name === 'handleLeague')!;

    it('exists in pipeline', () => {
      expect(handler).toBeDefined();
    });

    it('is atomic and never interruptible', () => {
      expect(handler.atomic).toBe(true);
      expect(handler.interruptible).toBe('never');
    });

    it('has minIntervalMs of 2 seconds', () => {
      expect(handler.minIntervalMs).toBe(2_000);
    });

    it('has onFailure callback', () => {
      expect(handler.onFailure).toBeDefined();
      expect(typeof handler.onFailure).toBe('function');
    });

    it('precondition returns boolean', () => {
      const result = handler.precondition(makeCtx());
      expect(typeof result).toBe('boolean');
    });

    it('step fn returns StepResult', async () => {
      const result = await handler.steps[0].fn(makeCtx());
      expect(result).toHaveProperty('ok');
      expect(result.ok).toBe(true);
    });

    it('onFailure does not throw', async () => {
      await expect(
        handler.onFailure!(makeCtx(), 'doLeagueBattle', 'test error')
      ).resolves.toBeUndefined();
    });
  });


  describe('trollWaitForEnergy gate (issue #1700, #1708)', () => {
    afterEach(() => {
      getStoredValueMock.mockReset();
    });

    it('handleEventParsing precondition returns false when trollWaitForEnergy=true', () => {
      const handler = pipeline.find(h => h.name === 'handleEventParsing')!;
      getStoredValueMock.mockImplementation((key: string) => {
        if (key.endsWith('Temp_trollWaitForEnergy')) return 'true';
        if (key.endsWith('Temp_eventsList')) return JSON.stringify({
          ev1: { id: 'ev1', isCompleted: false, next_refresh: 0 },
        });
        return undefined;
      });
      expect(handler.precondition(makeCtx())).toBe(false);
    });

    it('handleEventParsing precondition still triggers when trollWaitForEnergy=false', () => {
      const handler = pipeline.find(h => h.name === 'handleEventParsing')!;
      getStoredValueMock.mockImplementation((key: string) => {
        if (key.endsWith('Temp_trollWaitForEnergy')) return 'false';
        if (key.endsWith('Temp_eventsList')) return JSON.stringify({
          ev1: { id: 'ev1', isCompleted: false, next_refresh: 0 },
        });
        return undefined;
      });
      expect(handler.precondition(makeCtx())).toBe(true);
    });

    it('handleLeague precondition is NOT blocked by trollWaitForEnergy=true', () => {
      // Issue #1708 follow-up: League uses challenge tokens, not troll
      // combativity. Gating it on trollWaitForEnergy kept league fights
      // from happening even though the user had challenge energy to spend.
      const handler = pipeline.find(h => h.name === 'handleLeague')!;
      getStoredValueMock.mockImplementation((key: string) => {
        if (key.endsWith('Temp_trollWaitForEnergy')) return 'true';
        return undefined;
      });
      // LeagueHelper.isAutoLeagueActivated and isTimeToFight default to true in
      // the file-level mock, so the precondition must return true even with
      // the troll wait flag set.
      expect(handler.precondition(makeCtx())).toBe(true);
    });
  });

  describe('handleShop (3.2.G.a)', () => {
    const handler = pipeline.find(h => h.name === 'handleShop')!;
    const Shop = jest.requireMock('../../src/Module/Shop').Shop as { isTimeToCheckShop: jest.Mock; updateShop: jest.Mock };
    const ConfigHelperMock = jest.requireMock('../../src/Helper/ConfigHelper').ConfigHelper as { getHHScriptVars: jest.Mock };
    const TimerHelperMock = jest.requireMock('../../src/Helper/TimerHelper') as { checkTimer: jest.Mock };
    const HHHelperMock = jest.requireMock('../../src/Helper/HHHelper') as { getHHVars: jest.Mock };

    afterEach(() => {
      getStoredValueMock.mockReset();
      Shop.isTimeToCheckShop.mockReturnValue(false);
      Shop.updateShop.mockReturnValue(false);
      ConfigHelperMock.getHHScriptVars.mockReturnValue(true);
      TimerHelperMock.checkTimer.mockReturnValue(false);
      HHHelperMock.getHHVars.mockReturnValue(100);
    });

    it('exists in pipeline', () => {
      expect(handler).toBeDefined();
    });

    it('runs after handleEventParsing and before handleLeague', () => {
      const idxParsing = pipeline.findIndex(h => h.name === 'handleEventParsing');
      const idxShop = pipeline.findIndex(h => h.name === 'handleShop');
      const idxLeague = pipeline.findIndex(h => h.name === 'handleLeague');
      expect(idxParsing).toBeLessThan(idxShop);
      expect(idxShop).toBeLessThan(idxLeague);
    });

    it('precondition false when isEnabledShop is off', () => {
      ConfigHelperMock.getHHScriptVars.mockImplementation((k: string) => k !== 'isEnabledShop');
      Shop.isTimeToCheckShop.mockReturnValue(true);
      getStoredValueMock.mockImplementation((k: string) => k.endsWith('Temp_autoLoop') ? 'true' : undefined);
      expect(handler.precondition(makeCtx())).toBe(false);
    });

    it('precondition false when Shop.isTimeToCheckShop returns false', () => {
      Shop.isTimeToCheckShop.mockReturnValue(false);
      getStoredValueMock.mockImplementation((k: string) => k.endsWith('Temp_autoLoop') ? 'true' : undefined);
      expect(handler.precondition(makeCtx())).toBe(false);
    });

    it('precondition false when autoLoop is off', () => {
      Shop.isTimeToCheckShop.mockReturnValue(true);
      getStoredValueMock.mockImplementation((k: string) => k.endsWith('Temp_autoLoop') ? 'false' : undefined);
      expect(handler.precondition(makeCtx())).toBe(false);
    });

    it('precondition false when ctx.busy is true', () => {
      Shop.isTimeToCheckShop.mockReturnValue(true);
      getStoredValueMock.mockImplementation((k: string) => k.endsWith('Temp_autoLoop') ? 'true' : undefined);
      expect(handler.precondition(makeCtx({ busy: true }))).toBe(false);
    });

    it('precondition false when lastActionPerformed is foreign', () => {
      Shop.isTimeToCheckShop.mockReturnValue(true);
      getStoredValueMock.mockImplementation((k: string) => k.endsWith('Temp_autoLoop') ? 'true' : undefined);
      expect(handler.precondition(makeCtx({ lastActionPerformed: 'troll' }))).toBe(false);
    });

    it('precondition true when all gates pass', () => {
      Shop.isTimeToCheckShop.mockReturnValue(true);
      // Inner trigger must also be true after 3.2.G.a-fix1 (timer or
      // level change). Otherwise the scheduler used to spam
      // "Starting chain 'handleShop'" every 5s without doing real work.
      TimerHelperMock.checkTimer.mockReturnValue(true);
      HHHelperMock.getHHVars.mockReturnValue(100);
      getStoredValueMock.mockImplementation((k: string) => {
        if (k.endsWith('Temp_autoLoop')) return 'true';
        if (k.endsWith('Temp_charLevel')) return 100;
        return undefined;
      });
      expect(handler.precondition(makeCtx())).toBe(true);
    });

    it('precondition false when neither nextShopTime elapsed nor hero level changed (3.2.G.a-fix1: prevents 5s scheduler spam)', () => {
      // Regression: in the original 3.2.G.a migration the inner timer/level
      // checks lived in step.fn with a silent "ok: true" return. Because
      // the scheduler logs "Starting"/"completed" and bumps lastRunAt on
      // every step.fn call, that produced 38 starts for 2 actual shop
      // accesses over the test session. Now the inner trigger lives in
      // the precondition where it belongs.
      Shop.isTimeToCheckShop.mockReturnValue(true);
      ConfigHelperMock.getHHScriptVars.mockReturnValue(true);
      TimerHelperMock.checkTimer.mockReturnValue(false);
      HHHelperMock.getHHVars.mockReturnValue(100);
      getStoredValueMock.mockImplementation((k: string) => {
        if (k.endsWith('Temp_autoLoop')) return 'true';
        if (k.endsWith('Temp_charLevel')) return 100;
        return undefined;
      });
      expect(handler.precondition(makeCtx())).toBe(false);
    });

    it('precondition true when nextShopTime elapsed', () => {
      Shop.isTimeToCheckShop.mockReturnValue(true);
      ConfigHelperMock.getHHScriptVars.mockReturnValue(true);
      TimerHelperMock.checkTimer.mockReturnValue(true);
      HHHelperMock.getHHVars.mockReturnValue(100);
      getStoredValueMock.mockImplementation((k: string) => {
        if (k.endsWith('Temp_autoLoop')) return 'true';
        if (k.endsWith('Temp_charLevel')) return 100;
        return undefined;
      });
      expect(handler.precondition(makeCtx())).toBe(true);
    });

    it('precondition true when hero level above cached level (level-up trigger)', () => {
      Shop.isTimeToCheckShop.mockReturnValue(true);
      ConfigHelperMock.getHHScriptVars.mockReturnValue(true);
      TimerHelperMock.checkTimer.mockReturnValue(false);
      HHHelperMock.getHHVars.mockReturnValue(102);
      getStoredValueMock.mockImplementation((k: string) => {
        if (k.endsWith('Temp_autoLoop')) return 'true';
        if (k.endsWith('Temp_charLevel')) return 100;
        return undefined;
      });
      expect(handler.precondition(makeCtx())).toBe(true);
    });

    it('step calls Shop.updateShop and persists ctx.busy from result', async () => {
      Shop.updateShop.mockReturnValue(true);
      const ctx = makeCtx();
      const result = await handler.steps[0].fn(ctx);
      expect(result.ok).toBe(true);
      expect(Shop.updateShop).toHaveBeenCalledTimes(1);
      expect(ctx.busy).toBe(true);
      expect(ctx.lastActionPerformed).toBe('shop');
    });
  });

  describe('handleAutoEquipBoosters (3.2.G.a)', () => {
    const handler = pipeline.find(h => h.name === 'handleAutoEquipBoosters')!;
    const Booster = jest.requireMock('../../src/Module/Booster').Booster as { autoEquipBoosters: jest.Mock };
    const TimerHelperMock = jest.requireMock('../../src/Helper/TimerHelper') as { checkTimer: jest.Mock };

    afterEach(() => {
      getStoredValueMock.mockReset();
      Booster.autoEquipBoosters.mockResolvedValue(false);
      TimerHelperMock.checkTimer.mockReturnValue(false);
    });

    it('exists in pipeline', () => {
      expect(handler).toBeDefined();
    });

    it('precondition false when autoEquipBoosters opt-in is off', () => {
      TimerHelperMock.checkTimer.mockReturnValue(true);
      getStoredValueMock.mockImplementation((k: string) => k.endsWith('Temp_autoLoop') ? 'true' : undefined);
      expect(handler.precondition(makeCtx())).toBe(false);
    });

    it('precondition false when nextAutoEquipBoosterTime is not yet elapsed', () => {
      TimerHelperMock.checkTimer.mockReturnValue(false);
      getStoredValueMock.mockImplementation((k: string) => {
        if (k.endsWith('Setting_autoEquipBoosters')) return 'true';
        if (k.endsWith('Temp_autoLoop')) return 'true';
        return undefined;
      });
      expect(handler.precondition(makeCtx())).toBe(false);
    });

    it('precondition true when all gates pass', () => {
      TimerHelperMock.checkTimer.mockReturnValue(true);
      getStoredValueMock.mockImplementation((k: string) => {
        if (k.endsWith('Setting_autoEquipBoosters')) return 'true';
        if (k.endsWith('Temp_autoLoop')) return 'true';
        return undefined;
      });
      expect(handler.precondition(makeCtx())).toBe(true);
    });

    it('precondition is NOT gated on lastActionPerformed', () => {
      TimerHelperMock.checkTimer.mockReturnValue(true);
      getStoredValueMock.mockImplementation((k: string) => {
        if (k.endsWith('Setting_autoEquipBoosters')) return 'true';
        if (k.endsWith('Temp_autoLoop')) return 'true';
        return undefined;
      });
      // The legacy handler has no lastActionPerformed gate. Preserve that.
      expect(handler.precondition(makeCtx({ lastActionPerformed: 'troll' }))).toBe(true);
    });

    it('step does not mutate ctx when Booster.autoEquipBoosters returns false', async () => {
      Booster.autoEquipBoosters.mockResolvedValue(false);
      const ctx = makeCtx();
      const result = await handler.steps[0].fn(ctx);
      expect(result.ok).toBe(true);
      expect(ctx.busy).toBe(false);
      expect(ctx.lastActionPerformed).toBe('none');
    });

    it('step sets ctx.busy and ctx.lastActionPerformed when equip succeeds', async () => {
      Booster.autoEquipBoosters.mockResolvedValue(true);
      const ctx = makeCtx();
      const result = await handler.steps[0].fn(ctx);
      expect(result.ok).toBe(true);
      expect(ctx.busy).toBe(true);
      expect(ctx.lastActionPerformed).toBe('autoEquipBoosters');
    });
  });

  describe('getStaleEventIDs (issue #1673)', () => {
    afterEach(() => {
      getStoredValueMock.mockReset();
    });

    it('returns empty list when storage is empty', () => {
      getStoredValueMock.mockReturnValue(undefined);
      expect(getStaleEventIDs(1000)).toEqual([]);
    });

    it('returns empty list when all events are fresh', () => {
      const eventList = {
        event_251: { id: 'event_251', isCompleted: false, next_refresh: 2000 },
        path_event_76: { id: 'path_event_76', isCompleted: false, next_refresh: 3000 },
      };
      getStoredValueMock.mockReturnValue(JSON.stringify(eventList));
      expect(getStaleEventIDs(1000)).toEqual([]);
    });

    it('skips completed events even if next_refresh is stale', () => {
      const eventList = {
        old_event: { id: 'old_event', isCompleted: true, next_refresh: 100 },
      };
      getStoredValueMock.mockReturnValue(JSON.stringify(eventList));
      expect(getStaleEventIDs(1000)).toEqual([]);
    });

    it('returns the stale event when fresh event is listed first (Issue #1673)', () => {
      // Reproduces issue #1673: event_251 (Plus event) was fresh, but a stale
      // path_event_76 (Path of Attraction) entry kept the precondition firing.
      // Without this fix, fn would parse event_251 (eventIDs[0]) and leave the
      // stale PoA entry untouched, looping forever.
      const eventList = {
        event_251: { id: 'event_251', isCompleted: false, next_refresh: 5000 },
        path_event_76: { id: 'path_event_76', isCompleted: false, next_refresh: 100 },
      };
      getStoredValueMock.mockReturnValue(JSON.stringify(eventList));
      expect(getStaleEventIDs(1000)).toEqual(['path_event_76']);
    });

    it('returns multiple stale events in insertion order', () => {
      const eventList = {
        a: { id: 'a', isCompleted: false, next_refresh: 100 },
        b: { id: 'b', isCompleted: false, next_refresh: 5000 },
        c: { id: 'c', isCompleted: false, next_refresh: 200 },
      };
      getStoredValueMock.mockReturnValue(JSON.stringify(eventList));
      expect(getStaleEventIDs(1000)).toEqual(['a', 'c']);
    });

    it('treats missing or non-finite next_refresh as stale', () => {
      const eventList = {
        no_refresh: { id: 'no_refresh', isCompleted: false },
        nan_refresh: { id: 'nan_refresh', isCompleted: false, next_refresh: 'oops' },
      };
      getStoredValueMock.mockReturnValue(JSON.stringify(eventList));
      expect(getStaleEventIDs(1000).sort()).toEqual(['nan_refresh', 'no_refresh']);
    });

    it('returns sentinel ID on malformed JSON to preserve fallback parse', () => {
      getStoredValueMock.mockReturnValue('not-json');
      const result = getStaleEventIDs(1000);
      expect(result).toEqual(['__parse_error__']);
    });
  });

  describe('expired-event cleanup (issue #1738)', () => {
    beforeEach(() => {
      getStoredValueMock.mockReset();
      setStoredValueMock.mockReset();
      deleteStoredValueMock.mockReset();
    });

    it('pruneExpiredEvents drops entries with seconds_before_end <= now and persists', () => {
      const now = 2_000_000;
      const eventList: Record<string, any> = {
        expired_event: { id: 'expired_event', seconds_before_end: 1_500_000, isCompleted: false },
        future_event: { id: 'future_event', seconds_before_end: 3_000_000, isCompleted: false },
      };
      pruneExpiredEvents(eventList, now);
      expect(eventList).toEqual({
        future_event: { id: 'future_event', seconds_before_end: 3_000_000, isCompleted: false },
      });
      expect(setStoredValueMock).toHaveBeenCalledTimes(1);
      expect(deleteStoredValueMock).not.toHaveBeenCalled();
    });

    it('pruneExpiredEvents deletes the storage key when every entry was expired', () => {
      const now = 2_000_000;
      const eventList: Record<string, any> = {
        expired_a: { id: 'expired_a', seconds_before_end: 1_000_000 },
        expired_b: { id: 'expired_b', seconds_before_end: 1_500_000 },
      };
      pruneExpiredEvents(eventList, now);
      expect(eventList).toEqual({});
      expect(deleteStoredValueMock).toHaveBeenCalledTimes(1);
      expect(setStoredValueMock).not.toHaveBeenCalled();
    });

    it('pruneExpiredEvents leaves entries without seconds_before_end alone', () => {
      const now = 2_000_000;
      const eventList: Record<string, any> = {
        partial_event: { id: 'partial_event', isCompleted: false },
        bad_value: { id: 'bad_value', seconds_before_end: 'not-a-number' },
      };
      pruneExpiredEvents(eventList, now);
      expect(eventList).toEqual({
        partial_event: { id: 'partial_event', isCompleted: false },
        bad_value: { id: 'bad_value', seconds_before_end: 'not-a-number' },
      });
      expect(setStoredValueMock).not.toHaveBeenCalled();
      expect(deleteStoredValueMock).not.toHaveBeenCalled();
    });

    it('pruneExpiredEvents is a no-op when no entry is expired', () => {
      const now = 2_000_000;
      const eventList: Record<string, any> = {
        future_event: { id: 'future_event', seconds_before_end: 3_000_000 },
      };
      pruneExpiredEvents(eventList, now);
      expect(setStoredValueMock).not.toHaveBeenCalled();
      expect(deleteStoredValueMock).not.toHaveBeenCalled();
    });

    it('getStaleEventIDs prunes expired entries before returning the stale list', () => {
      const now = 2_000_000;
      const eventList = {
        expired_event: { id: 'expired_event', seconds_before_end: 1_500_000, next_refresh: 100, isCompleted: false },
        stale_future_event: { id: 'stale_future_event', seconds_before_end: 3_000_000, next_refresh: 100, isCompleted: false },
      };
      getStoredValueMock.mockReturnValueOnce(JSON.stringify(eventList));
      const stale = getStaleEventIDs(now);
      expect(stale).toEqual(['stale_future_event']);
      // Persistence call from pruneExpiredEvents.
      expect(setStoredValueMock).toHaveBeenCalledTimes(1);
    });

    it('getStaleEventIDs does not include the expired event in the stale list (issue #1738 loop guard)', () => {
      const now = 2_000_000;
      const eventList = {
        // Mirrors the lively_scene_event_12 entry from the bug report.
        lively_scene_event_12: {
          id: 'lively_scene_event_12',
          seconds_before_end: 1_000_000,
          next_refresh: 1_500_000,
          isCompleted: false,
        },
      };
      getStoredValueMock.mockReturnValueOnce(JSON.stringify(eventList));
      const stale = getStaleEventIDs(now);
      expect(stale).toEqual([]);
      expect(deleteStoredValueMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleQuest', () => {
    const handler = pipeline.find(h => h.name === 'handleQuest')!;

    beforeEach(() => {
      getStoredValueMock.mockReset();
      setStoredValueMock.mockReset();
      deleteStoredValueMock.mockReset();
    });

    it('exists in pipeline', () => {
      expect(handler).toBeDefined();
    });

    it('outfit marker disables autoQuest, resets the marker, and sets paranoiaQuestBlocked', async () => {
      // Storage reads return 'true' for autoQuest, 'false' for autoSideQuest,
      // 'false' for autoTrollBattleSaveQuest, 'outfit' for the marker.
      // Order matches the reads inside step.fn.
      getStoredValueMock.mockImplementation((key: string) => {
        if (key.endsWith('autoTrollBattleSaveQuest')) return 'false';
        if (key.endsWith('Temp_questRequirement')) return 'outfit';
        if (key.endsWith('Setting_autoQuest')) return 'true';
        if (key.endsWith('Setting_autoSideQuest')) return 'false';
        return undefined;
      });
      // Provide a stub DOM input so the autoQuest checkbox toggle does not
      // throw. The handler reads document.getElementById('autoQuest').
      const stubInput = { checked: true } as unknown as HTMLInputElement;
      jest.spyOn(document, 'getElementById').mockImplementation((id: string) =>
        id === 'autoQuest' || id === 'autoSideQuest' ? (stubInput as unknown as HTMLElement) : null
      );

      const ctx = makeCtx({ canCollectCompetitionActive: true });
      await handler.steps[0].fn(ctx);

      // Marker reset to 'none', autoQuest disabled, paranoiaQuestBlocked set.
      const writes = setStoredValueMock.mock.calls.map(c => [c[0], c[1]]);
      expect(writes).toContainEqual([
        expect.stringContaining('Temp_paranoiaQuestBlocked'),
        'true',
      ]);
      expect(writes).toContainEqual([
        expect.stringContaining('Setting_autoQuest'),
        'false',
      ]);
      expect(writes).toContainEqual([
        expect.stringContaining('Temp_questRequirement'),
        'none',
      ]);
      // ctx.busy stays false (no continuation).
      expect(ctx.busy).toBe(false);

      jest.restoreAllMocks();
    });

    it('outfit marker also disables autoSideQuest when it is enabled', async () => {
      getStoredValueMock.mockImplementation((key: string) => {
        if (key.endsWith('autoTrollBattleSaveQuest')) return 'false';
        if (key.endsWith('Temp_questRequirement')) return 'outfit';
        if (key.endsWith('Setting_autoQuest')) return 'false';
        if (key.endsWith('Setting_autoSideQuest')) return 'true';
        return undefined;
      });
      const stubInput = { checked: true } as unknown as HTMLInputElement;
      jest.spyOn(document, 'getElementById').mockImplementation((id: string) =>
        id === 'autoQuest' || id === 'autoSideQuest' ? (stubInput as unknown as HTMLElement) : null
      );

      const ctx = makeCtx({ canCollectCompetitionActive: true });
      await handler.steps[0].fn(ctx);

      const writes = setStoredValueMock.mock.calls.map(c => [c[0], c[1]]);
      expect(writes).toContainEqual([
        expect.stringContaining('Setting_autoSideQuest'),
        'false',
      ]);
      expect(writes).toContainEqual([
        expect.stringContaining('Temp_questRequirement'),
        'none',
      ]);

      jest.restoreAllMocks();
    });
  });
});
