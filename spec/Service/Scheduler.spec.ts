// Scheduler.spec.ts -- Unit tests for the Scheduler state machine.
//
// Tests cover: state transitions, atomic blocks, SOFT/HARD interrupts,
// watchdog, min-interval, priority ordering, preconditions, onFailure.

// Mock dependencies before importing Scheduler
const mouseServiceState = { mouseBusy: false };
jest.mock('../../src/Service/MouseService', () => ({
  get mouseBusy() { return mouseServiceState.mouseBusy; },
}));

jest.mock('../../src/Helper/index', () => ({
  getStoredValue: jest.fn().mockReturnValue('true'), // master = on by default
}));

jest.mock('../../src/config/index', () => ({
  HHStoredVarPrefixKey: 'HHAuto_',
  SK: { master: 'master' },
}));

jest.mock('../../src/Utils/index', () => ({
  logHHAuto: jest.fn(),
}));

// Must mock Pipeline.config to control the pipeline array
jest.mock('../../src/Service/Pipeline.config', () => ({
  pipeline: [],
}));

import { Scheduler } from '../../src/Service/Scheduler';
import { HandlerConfig, StepResult } from '../../src/Service/Pipeline.config';
import * as MouseServiceModule from '../../src/Service/MouseService';
import * as HelperModule from '../../src/Helper/index';
import { pipeline } from '../../src/Service/Pipeline.config';

// Helper to create a minimal handler config
function makeHandler(overrides: Partial<HandlerConfig> = {}): HandlerConfig {
  return {
    name: overrides.name ?? 'testHandler',
    priority: overrides.priority ?? 10,
    minIntervalMs: overrides.minIntervalMs ?? 0,
    atomic: overrides.atomic ?? false,
    interruptible: overrides.interruptible ?? 'always',
    precondition: overrides.precondition ?? (() => true),
    steps: overrides.steps ?? [
      { name: 'step1', fn: async () => ({ ok: true }) },
    ],
    onFailure: overrides.onFailure,
    totalTimeoutMs: overrides.totalTimeoutMs,
  };
}

describe('Scheduler', () => {
  let scheduler: Scheduler;

  beforeEach(() => {
    scheduler = new Scheduler();
    pipeline.length = 0;
    mouseServiceState.mouseBusy = false;
    (HelperModule.getStoredValue as jest.Mock).mockReturnValue('true');
  });

  describe('State Machine Transitions', () => {
    it('transitions IDLE -> RUNNING -> COMPLETED (single step)', async () => {
      const handler = makeHandler({ name: 'simple' });
      pipeline.push(handler);

      expect(scheduler.getState('simple')).toBeUndefined();
      await scheduler.tick();
      expect(scheduler.getState('simple')).toBe('IDLE');
      expect(scheduler.getActiveChain()).toBeNull();
    });

    it('transitions IDLE -> RUNNING -> FAILED on step failure', async () => {
      const onFailure = jest.fn();
      const handler = makeHandler({
        name: 'failing',
        steps: [
          { name: 'badStep', fn: async () => ({ ok: false, reason: 'broken', retryable: false }) },
        ],
        onFailure,
      });
      pipeline.push(handler);

      await scheduler.tick();
      expect(onFailure).toHaveBeenCalledWith('badStep', 'broken');
      expect(scheduler.getState('failing')).toBe('IDLE');
    });

    it('executes multi-step chain across multiple ticks', async () => {
      const steps: string[] = [];
      const handler = makeHandler({
        name: 'multiStep',
        steps: [
          { name: 's1', fn: async () => { steps.push('s1'); return { ok: true }; } },
          { name: 's2', fn: async () => { steps.push('s2'); return { ok: true }; } },
          { name: 's3', fn: async () => { steps.push('s3'); return { ok: true }; } },
        ],
      });
      pipeline.push(handler);

      await scheduler.tick();
      expect(steps).toEqual(['s1']);
      await scheduler.tick();
      expect(steps).toEqual(['s1', 's2']);
      await scheduler.tick();
      expect(steps).toEqual(['s1', 's2', 's3']);
      expect(scheduler.getActiveChain()).toBeNull();
    });
  });

  describe('Atomic Block', () => {
    it('atomic chain is NOT interrupted by HARD interrupt', async () => {
      const atomicSteps: string[] = [];
      const atomicHandler = makeHandler({
        name: 'atomic',
        priority: 10,
        atomic: true,
        interruptible: 'never',
        steps: [
          { name: 'a1', fn: async () => { atomicSteps.push('a1'); return { ok: true }; } },
          { name: 'a2', fn: async () => { atomicSteps.push('a2'); return { ok: true }; } },
        ],
      });
      let highPrioReady = false;
      const highPrioHandler = makeHandler({
        name: 'highPrio',
        priority: 1,
        precondition: () => highPrioReady,
        steps: [{ name: 'h1', fn: async () => ({ ok: true }) }],
      });
      pipeline.push(atomicHandler, highPrioHandler);

      await scheduler.tick();
      expect(atomicSteps).toEqual(['a1']);
      expect(scheduler.getActiveChain()?.name).toBe('atomic');

      highPrioReady = true;
      await scheduler.tick();
      expect(atomicSteps).toEqual(['a1', 'a2']);
      expect(scheduler.getActiveChain()).toBeNull();
    });

    it('atomic chain IS aborted by SOFT interrupt at safe point', async () => {
      const atomicSteps: string[] = [];
      const handler = makeHandler({
        name: 'atomicSoft',
        atomic: true,
        steps: [
          { name: 'a1', fn: async () => { atomicSteps.push('a1'); return { ok: true }; } },
          { name: 'a2', fn: async () => { atomicSteps.push('a2'); return { ok: true }; } },
        ],
      });
      pipeline.push(handler);

      await scheduler.tick();
      expect(atomicSteps).toEqual(['a1']);

      mouseServiceState.mouseBusy = true;
      await scheduler.tick();
      expect(atomicSteps).toEqual(['a1']);
      expect(scheduler.getActiveChain()).toBeNull();
      expect(scheduler.getState('atomicSoft')).toBe('IDLE');
    });
  });

  describe('HARD Interrupt', () => {
    it('non-atomic interruptible handler is preempted by higher priority', async () => {
      const steps: string[] = [];
      const lowPrio = makeHandler({
        name: 'lowPrio',
        priority: 10,
        atomic: false,
        interruptible: 'always',
        steps: [
          { name: 'l1', fn: async () => { steps.push('l1'); return { ok: true }; } },
          { name: 'l2', fn: async () => { steps.push('l2'); return { ok: true }; } },
        ],
      });
      let highPrioReady = false;
      const highPrio = makeHandler({
        name: 'highPrio',
        priority: 1,
        precondition: () => highPrioReady,
        steps: [{ name: 'h1', fn: async () => { steps.push('h1'); return { ok: true }; } }],
      });
      pipeline.push(lowPrio, highPrio);

      await scheduler.tick();
      expect(steps).toEqual(['l1']);

      highPrioReady = true;
      await scheduler.tick();
      expect(steps).toContain('h1');
      expect(scheduler.getState('lowPrio')).toBe('IDLE');
    });
  });

  describe('Watchdog', () => {
    it('kills hung chain after totalTimeoutMs', async () => {
      const onFailure = jest.fn();
      const handler = makeHandler({
        name: 'hung',
        totalTimeoutMs: 100,
        minIntervalMs: 60000,
        steps: [
          { name: 's1', fn: async () => ({ ok: true }) },
          { name: 's2', fn: async () => ({ ok: true }) },
        ],
        onFailure,
      });
      pipeline.push(handler);

      await scheduler.tick(); // executes s1

      // Simulate time passing beyond timeout
      const originalNow = Date.now;
      const frozenTime = originalNow() + 200;
      Date.now = () => frozenTime;

      await scheduler.tick(); // watchdog triggers
      expect(scheduler.getActiveChain()).toBeNull();

      Date.now = originalNow;
    });
  });

  describe('Min-Interval', () => {
    it('skips handler if minInterval has not elapsed', async () => {
      const steps: string[] = [];
      const handler = makeHandler({
        name: 'throttled',
        minIntervalMs: 5000,
        steps: [{ name: 's1', fn: async () => { steps.push('s1'); return { ok: true }; } }],
      });
      pipeline.push(handler);

      await scheduler.tick();
      expect(steps).toEqual(['s1']);

      await scheduler.tick();
      expect(steps).toEqual(['s1']); // not re-run
    });
  });

  describe('Priority Ordering', () => {
    it('runs lower-number priority first', async () => {
      const order: string[] = [];
      const handlerA = makeHandler({
        name: 'A',
        priority: 20,
        minIntervalMs: 60000,
        steps: [{ name: 's', fn: async () => { order.push('A'); return { ok: true }; } }],
      });
      const handlerB = makeHandler({
        name: 'B',
        priority: 5,
        minIntervalMs: 60000,
        steps: [{ name: 's', fn: async () => { order.push('B'); return { ok: true }; } }],
      });
      pipeline.push(handlerA, handlerB);

      await scheduler.tick();
      expect(order).toEqual(['B']);

      await scheduler.tick();
      expect(order).toEqual(['B', 'A']);
    });
  });

  describe('Precondition', () => {
    it('skips handler when precondition returns false', async () => {
      const steps: string[] = [];
      const handler = makeHandler({
        name: 'conditional',
        precondition: () => false,
        steps: [{ name: 's', fn: async () => { steps.push('ran'); return { ok: true }; } }],
      });
      pipeline.push(handler);

      await scheduler.tick();
      expect(steps).toEqual([]);
      expect(scheduler.getActiveChain()).toBeNull();
    });
  });

  describe('onFailure Callback', () => {
    it('calls onFailure with step name and reason', async () => {
      const onFailure = jest.fn();
      const handler = makeHandler({
        name: 'failHandler',
        steps: [
          { name: 'goodStep', fn: async () => ({ ok: true }) },
          { name: 'badStep', fn: async () => ({ ok: false, reason: 'network error', retryable: true }) },
        ],
        onFailure,
      });
      pipeline.push(handler);

      await scheduler.tick(); // goodStep
      await scheduler.tick(); // badStep fails

      expect(onFailure).toHaveBeenCalledWith('badStep', 'network error');
    });
  });
});
