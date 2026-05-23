// Pipeline.config.spec.ts -- Unit tests for the pipeline configuration.
//
// Tests cover: config parsability, valid fields, no duplicates,
// handler-specific properties (atomic, priority, interruptible).

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

jest.mock('../../src/Helper/ConfigHelper', () => ({
  ConfigHelper: {
    getHHScriptVars: jest.fn().mockReturnValue(true),
  },
}));

jest.mock('../../src/Helper/StorageHelper', () => ({
  getStoredValue: jest.fn().mockReturnValue('[]'),
}));

jest.mock('../../src/config/HHStoredVars', () => ({
  HHStoredVarPrefixKey: 'HHAuto_',
}));

jest.mock('../../src/config/StorageKeys', () => ({
  SK: { master: 'master' },
  TK: { eventsList: 'Temp_eventsList', trollWaitForEnergy: 'Temp_trollWaitForEnergy' },
}));

jest.mock('../../src/Utils/LogUtils', () => ({
  logHHAuto: jest.fn(),
}));

import { pipeline, HandlerConfig, getStaleEventIDs } from '../../src/Service/Pipeline.config';
import { getStoredValue } from '../../src/Helper/StorageHelper';
const getStoredValueMock = getStoredValue as jest.Mock;

describe('Pipeline.config', () => {
  describe('pipeline array', () => {
    it('is a non-empty array', () => {
      expect(Array.isArray(pipeline)).toBe(true);
      expect(pipeline.length).toBeGreaterThan(0);
    });

    it('contains only valid HandlerConfig objects', () => {
      for (const handler of pipeline) {
        expect(handler).toHaveProperty('name');
        expect(handler).toHaveProperty('priority');
        expect(handler).toHaveProperty('minIntervalMs');
        expect(handler).toHaveProperty('atomic');
        expect(handler).toHaveProperty('interruptible');
        expect(handler).toHaveProperty('precondition');
        expect(handler).toHaveProperty('steps');

        expect(typeof handler.name).toBe('string');
        expect(handler.name.length).toBeGreaterThan(0);
        expect(typeof handler.priority).toBe('number');
        expect(handler.priority).toBeGreaterThan(0);
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

    it('has no duplicate priorities', () => {
      const priorities = pipeline.map(h => h.priority);
      const uniquePriorities = new Set(priorities);
      expect(uniquePriorities.size).toBe(priorities.length);
    });

    it('is sorted by priority ascending', () => {
      for (let i = 1; i < pipeline.length; i++) {
        expect(pipeline[i].priority).toBeGreaterThan(pipeline[i - 1].priority);
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

    it('has highest priority (1)', () => {
      expect(handler.priority).toBe(1);
    });

    it('precondition returns boolean', () => {
      const result = handler.precondition();
      expect(typeof result).toBe('boolean');
    });

    it('step fn returns StepResult', async () => {
      const result = await handler.steps[0].fn();
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

    it('has priority 13', () => {
      expect(handler.priority).toBe(13);
    });

    it('has minIntervalMs of 2 seconds', () => {
      expect(handler.minIntervalMs).toBe(2_000);
    });

    it('has onFailure callback', () => {
      expect(handler.onFailure).toBeDefined();
      expect(typeof handler.onFailure).toBe('function');
    });

    it('precondition returns boolean', () => {
      const result = handler.precondition();
      expect(typeof result).toBe('boolean');
    });

    it('step fn returns StepResult', async () => {
      const result = await handler.steps[0].fn();
      expect(result).toHaveProperty('ok');
      expect(result.ok).toBe(true);
    });

    it('onFailure does not throw', async () => {
      await expect(
        handler.onFailure!('doLeagueBattle', 'test error')
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
      expect(handler.precondition()).toBe(false);
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
      expect(handler.precondition()).toBe(true);
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
      expect(handler.precondition()).toBe(true);
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
});
