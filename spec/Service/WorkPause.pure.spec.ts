import { decideWorkPause, WorkPauseInput, WorkPauseState } from '../../src/Service/WorkPause.pure';

const IDLE = 15 * 60_000;
const NOW = 1_000_000_000;

function input(over: Partial<WorkPauseInput> = {}, state: Partial<WorkPauseState> | null = {}): WorkPauseInput {
    return {
        state: state === null ? null : { since: NOW - 60_000, lastActivity: NOW - 1_000, zone: 'team', ...state },
        now: NOW,
        onZonePage: true,
        runActive: false,
        idleMs: IDLE,
        ...over,
    };
}

describe('decideWorkPause', () => {
    it('is no pause at all without a stored state', () => {
        expect(decideWorkPause(input({}, null))).toEqual({ kind: 'none' });
    });

    it('holds on a page of the zone -- the reloads of Apply, Team gear and the gear equip land there', () => {
        const d = decideWorkPause(input());
        expect(d.kind).toBe('hold');
        if (d.kind === 'hold') {
            expect(d.goToZone).toBe(false);
            expect(d.remainingMs).toBe(IDLE - 1_000);
        }
    });

    it('holds on any page while a run of the team work goes on', () => {
        const d = decideWorkPause(input({ onZonePage: false, runActive: true }));
        expect(d.kind).toBe('hold');
    });

    it('ends when the player leaves the zone with no run going', () => {
        expect(decideWorkPause(input({ onZonePage: false }))).toEqual({ kind: 'end', reason: 'left' });
    });

    it('ends after the idle time without work, on a page of the zone too', () => {
        expect(decideWorkPause(input({}, { lastActivity: NOW - IDLE }))).toEqual({ kind: 'end', reason: 'idle' });
    });

    it('ends a run that stopped making progress -- a left-over queue must not park the script', () => {
        expect(decideWorkPause(input({ onZonePage: false, runActive: true }, { lastActivity: NOW - IDLE - 1 })))
            .toEqual({ kind: 'end', reason: 'idle' });
    });

    it('sends a finished run back to its zone instead of ending', () => {
        const d = decideWorkPause(input({ onZonePage: false }, { returnToZone: true }));
        expect(d).toEqual({ kind: 'hold', remainingMs: IDLE - 1_000, goToZone: true, arrived: false });
    });

    it('reports the arrival in the zone so the way back is cleared', () => {
        const d = decideWorkPause(input({ onZonePage: true }, { returnToZone: true }));
        expect(d).toEqual({ kind: 'hold', remainingMs: IDLE - 1_000, goToZone: false, arrived: true });
    });

    it('does not send a run back while it is still running', () => {
        const d = decideWorkPause(input({ onZonePage: false, runActive: true }, { returnToZone: true }));
        expect(d.kind === 'hold' && d.goToZone).toBe(false);
    });

    it('decides the same for the gear zone -- the zone only says which pages count', () => {
        expect(decideWorkPause(input({}, { zone: 'gear' })).kind).toBe('hold');
        expect(decideWorkPause(input({ onZonePage: false }, { zone: 'gear' }))).toEqual({ kind: 'end', reason: 'left' });
    });

    it('treats a clock that went back as no idle time', () => {
        const d = decideWorkPause(input({}, { lastActivity: NOW + 5_000 }));
        expect(d.kind === 'hold' && d.remainingMs).toBe(IDLE);
    });
});
