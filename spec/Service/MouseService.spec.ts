import { SK, TK } from '../../src/config/StorageKeys';

// In-memory storage backing the mocked StorageHelper.
const store: Record<string, string> = {};

jest.mock('../../src/config/HHStoredVars', () => ({ HHStoredVarPrefixKey: 'HHAuto_' }));
jest.mock('../../src/Helper/StorageHelper', () => ({
  getStoredValue: (k: string) => store[k],
  setStoredValue: (k: string, v: string) => { store[k] = v; },
}));

const PREFIX = 'HHAuto_';
const START = 1_000_000;

// Load MouseService fresh so SCRIPT_START_TS is captured at the mocked
// "now". The grace period is measured from module evaluation time.
async function load() {
  jest.resetModules();
  return await import('../../src/Service/MouseService');
}

describe('MouseService.isUserPauseActive', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    jest.useFakeTimers();
    jest.setSystemTime(new Date(START));
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('is inactive when mouse pause is disabled, even within the grace window', async () => {
    const m = await load();
    expect(m.isUserPauseActive()).toBe(false);
  });

  it('is active within the startup grace when enabled', async () => {
    store[PREFIX + SK.mousePause] = 'true';
    const m = await load();
    expect(m.isUserPauseActive()).toBe(true);
    jest.setSystemTime(new Date(START + 1999));
    expect(m.isUserPauseActive()).toBe(true);
  });

  it('is inactive after the grace with no recorded activity', async () => {
    store[PREFIX + SK.mousePause] = 'true';
    const m = await load();
    jest.setSystemTime(new Date(START + 2500));
    expect(m.isUserPauseActive()).toBe(false);
  });

  it('stays active when persisted activity is within the timeout (survives reload)', async () => {
    store[PREFIX + SK.mousePause] = 'true';
    store[PREFIX + SK.mousePauseTimeout] = '10000';
    const m = await load();
    jest.setSystemTime(new Date(START + 3000));
    store[PREFIX + TK.mouseLastActivity] = String(START + 2000);
    expect(m.isUserPauseActive()).toBe(true);
  });

  it('is inactive when persisted activity is older than the timeout', async () => {
    store[PREFIX + SK.mousePause] = 'true';
    store[PREFIX + SK.mousePauseTimeout] = '10000';
    const m = await load();
    jest.setSystemTime(new Date(START + 30000));
    store[PREFIX + TK.mouseLastActivity] = String(START + 2000);
    expect(m.isUserPauseActive()).toBe(false);
  });

  it('makeMouseBusy activates the pause and persists the activity timestamp', async () => {
    store[PREFIX + SK.mousePause] = 'true';
    store[PREFIX + SK.mousePauseTimeout] = '10000';
    const m = await load();
    jest.setSystemTime(new Date(START + 5000));
    m.makeMouseBusy(5000);
    expect(m.isUserPauseActive()).toBe(true);
    expect(store[PREFIX + TK.mouseLastActivity]).toBe(String(START + 5000));
  });

  it('throttles persisted-activity writes within 500ms', async () => {
    store[PREFIX + SK.mousePause] = 'true';
    const m = await load();
    jest.setSystemTime(new Date(START + 5000));
    m.makeMouseBusy(5000);
    expect(store[PREFIX + TK.mouseLastActivity]).toBe(String(START + 5000));
    delete store[PREFIX + TK.mouseLastActivity];
    m.makeMouseBusy(5000); // same timestamp -> throttled, no write
    expect(store[PREFIX + TK.mouseLastActivity]).toBeUndefined();
  });
});
