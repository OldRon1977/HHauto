// Pipeline.config.spec.ts -- Unit tests for the pipeline configuration.
//
// Tests cover: config parsability, valid fields, no duplicates,
// handler-specific properties (atomic, priority, interruptible).

// Mock all external dependencies that Pipeline.config.ts imports
jest.mock('../../src/Module/index', () => ({
  LeagueHelper: {
    isAutoLeagueActivated: jest.fn().mockReturnValue(true),
    isTimeToFight: jest.fn().mockReturnValue(true),
    doLeagueBattle: jest.fn(),
  },
}));

jest.mock('../../src/Module/Events/index', () => ({
  EventModule: {
    parseEventPage: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../../src/Helper/index', () => ({
  ConfigHelper: {
    getHHScriptVars: jest.fn().mockReturnValue(true),
  },
  getStoredValue: jest.fn().mockReturnValue('[]'),
}));

jest.mock('../../src/config/index', () => ({
  HHStoredVarPrefixKey: 'HHAuto_',
  SK: { master: 'master' },
  TK: { eventIDs: 'eventIDs' },
}));

jest.mock('../../src/Utils/index', () => ({
  logHHAuto: jest.fn(),
}));

import { pipeline, HandlerConfig } from '../../src/Service/Pipeline.config';

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

    it('has minIntervalMs of 60 seconds', () => {
      expect(handler.minIntervalMs).toBe(60_000);
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
});
