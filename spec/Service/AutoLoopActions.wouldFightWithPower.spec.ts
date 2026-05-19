// AutoLoopActions.wouldFightWithPower.spec.ts -- Unit tests for the
// wait-marker helper that decides whether handleTrollBattle should
// hold the tick at lastAction="troll" while combativity is empty.
//
// Background: issue #1700 -- with power=0 + plusLoveRaid=true and a
// raid girl still pending, no battle path in handleTrollBattle fires,
// and the AutoLoop reverts lastAction="troll" to "none" at tick end.
// Pipeline handlers (handleEventParsing, handleLeague) then navigate
// every tick, producing a ping-pong loop. wouldFightWithPower is the
// purely-positive predicate ("would a battle path fire IF power were
// available?") that gates the new wait-marker.

jest.mock('../../src/Helper/StorageHelper', () => ({
    getStoredValue: jest.fn(),
}));

jest.mock('../../src/Module/Events/LoveRaidManager', () => ({
    LoveRaidManager: {
        isActivated: jest.fn(),
    },
}));

import { wouldFightWithPower } from '../../src/Service/AutoLoopActions';
import { getStoredValue } from '../../src/Helper/StorageHelper';
import { LoveRaidManager } from '../../src/Module/Events/LoveRaidManager';
import { EventGirl } from '../../src/model/EventGirl';
import { LoveRaid } from '../../src/model/LoveRaid';

const getStoredValueMock = getStoredValue as jest.Mock;
const loveRaidIsActivatedMock = LoveRaidManager.isActivated as jest.Mock;

function defaultStorage(map: Record<string, string>): jest.Mock {
    return getStoredValueMock.mockImplementation((key: string) => {
        for (const [suffix, value] of Object.entries(map)) {
            if (key.endsWith(suffix)) return value;
        }
        return 'false';
    });
}

const emptyEventGirl: EventGirl = {
    girl_id: undefined,
    troll_id: undefined,
    champ_id: undefined,
    shards: undefined,
    name: undefined,
    event_id: undefined,
    is_mythic: undefined,
} as unknown as EventGirl;

describe('wouldFightWithPower', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        loveRaidIsActivatedMock.mockReturnValue(false);
    });

    it('returns true when autoTrollBattle is on (Trivial-Auto-Path)', () => {
        defaultStorage({ Setting_autoTrollBattle: 'true' });
        const result = wouldFightWithPower(emptyEventGirl, emptyEventGirl, undefined, undefined);
        expect(result).toBe(true);
    });

    it('returns true for Mythic Event Girl with plusEventMythic on', () => {
        defaultStorage({ Setting_plusEventMythic: 'true' });
        const mythicGirl = { ...emptyEventGirl, girl_id: 12345, is_mythic: true } as unknown as EventGirl;
        const result = wouldFightWithPower(emptyEventGirl, mythicGirl, undefined, undefined);
        expect(result).toBe(true);
    });

    it('returns false when Mythic Event Girl exists but plusEventMythic is off', () => {
        defaultStorage({});
        const mythicGirl = { ...emptyEventGirl, girl_id: 12345, is_mythic: true } as unknown as EventGirl;
        const result = wouldFightWithPower(emptyEventGirl, mythicGirl, undefined, undefined);
        expect(result).toBe(false);
    });

    it('returns true for normal Event Girl with plusEvent on', () => {
        defaultStorage({ Setting_plusEvent: 'true' });
        const eventGirl = { ...emptyEventGirl, girl_id: 67890, is_mythic: false } as unknown as EventGirl;
        const result = wouldFightWithPower(eventGirl, emptyEventGirl, undefined, undefined);
        expect(result).toBe(true);
    });

    it('does not confuse mythic girl as normal-event-girl path', () => {
        defaultStorage({ Setting_plusEvent: 'true' });
        const mythicGirl = { ...emptyEventGirl, girl_id: 11111, is_mythic: true } as unknown as EventGirl;
        const result = wouldFightWithPower(mythicGirl, emptyEventGirl, undefined, undefined);
        // mythic flag set, plusEvent (non-mythic flag) is on: must NOT match the non-mythic path
        expect(result).toBe(false);
    });

    it('returns true for raid stars raid with plusLoveRaid on', () => {
        defaultStorage({ Setting_plusLoveRaid: 'true' });
        const raidStars = { id_girl: 22222, trollId: 5 } as unknown as LoveRaid;
        const result = wouldFightWithPower(emptyEventGirl, emptyEventGirl, raidStars, undefined);
        expect(result).toBe(true);
    });

    it('returns true for user-selected LoveRaid when LoveRaidManager.isActivated()', () => {
        defaultStorage({});
        loveRaidIsActivatedMock.mockReturnValue(true);
        const userRaid = { id_girl: 33333, trollId: 7 } as unknown as LoveRaid;
        const result = wouldFightWithPower(emptyEventGirl, emptyEventGirl, undefined, userRaid);
        expect(result).toBe(true);
    });

    it('returns false when LoveRaidManager.isActivated() but raid undefined', () => {
        defaultStorage({});
        loveRaidIsActivatedMock.mockReturnValue(true);
        // mirrors A6 in REVIEW: girl_to_win=false -> getRaidToFight() returned undefined
        const result = wouldFightWithPower(emptyEventGirl, emptyEventGirl, undefined, undefined);
        expect(result).toBe(false);
    });

    it('returns false when no path matches', () => {
        defaultStorage({});
        const result = wouldFightWithPower(emptyEventGirl, emptyEventGirl, undefined, undefined);
        expect(result).toBe(false);
    });
});