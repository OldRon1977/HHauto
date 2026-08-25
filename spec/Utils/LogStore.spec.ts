import { appendLog, clearLog, flushLog, importLegacyLog, readLogAsObject, readLogText } from '../../src/Utils/LogStore';
import { HHStoredVarPrefixKey } from '../../src/config/HHStoredVars';

describe('LogStore', () => {
    beforeEach(() => {
        sessionStorage.clear();
        clearLog();
    });

    describe('writing', () => {
        it('keeps a line and gives it back', () => {
            appendLog(1_700_000_000_000, 'doBattle', 'On battle page.');
            flushLog();
            expect(readLogText()).toContain('doBattle\tOn battle page.');
        });

        it('does not write every line straight through to storage', () => {
            // The old buffer read, parsed, pruned, serialised and wrote the
            // whole log for every single line. Here the lines wait in memory
            // until a batch is worth writing, which is the whole point.
            for (let i = 0; i < 20; i++) appendLog(1_700_000_000_000 + i, 'fn', 'short line ' + i);
            const inStorage = Object.keys(sessionStorage)
                .filter(k => k.startsWith(HHStoredVarPrefixKey + 'Temp_Log') && !k.endsWith('Idx'))
                .map(k => (sessionStorage.getItem(k) ?? '').split('\n').length - 1)
                .reduce((a, b) => a + b, 0);
            expect(inStorage).toBeLessThan(20);
            flushLog();
            expect(Object.keys(readLogAsObject())).toHaveLength(20);
        });

        it('survives a line with newlines in it', () => {
            appendLog(1_700_000_000_000, 'fn', 'Troll:\n{\n "threshold": 0\n}');
            const out = readLogAsObject();
            expect(Object.values(out)[0]).toBe('Troll:\n{\n "threshold": 0\n}');
        });

        it('keeps a backslash a backslash', () => {
            appendLog(1_700_000_000_000, 'fn', 'C:\\path\\n not a newline');
            expect(Object.values(readLogAsObject())[0]).toBe('C:\\path\\n not a newline');
        });
    });

    describe('the export shape', () => {
        it('is the one every existing debug-log reader expects', () => {
            const ms = 1_700_000_000_123;
            appendLog(ms, 'getRaidToFight', 'LoveRaid troll fight: 14');
            const key = Object.keys(readLogAsObject())[0];
            const d = new Date(ms);
            expect(key).toBe(d.toLocaleString() + '.' + d.getMilliseconds() + ':getRaidToFight');
        });

        it('keeps both lines when two land in the same millisecond', () => {
            appendLog(1_700_000_000_000, 'fn', 'first');
            appendLog(1_700_000_000_000, 'fn', 'second');
            const out = readLogAsObject();
            expect(Object.keys(out)).toHaveLength(2);
            expect(Object.values(out)).toEqual(['first', 'second']);
        });

        it('is in order, oldest first', () => {
            for (let i = 0; i < 5; i++) appendLog(1_700_000_000_000 + i, 'fn', 'line ' + i);
            expect(Object.values(readLogAsObject())).toEqual(['line 0', 'line 1', 'line 2', 'line 3', 'line 4']);
        });
    });

    describe('the ring', () => {
        it('drops the oldest chunk instead of failing when storage is full', () => {
            // Every write throws once, as a full sessionStorage does; the store
            // must make room and keep going rather than lose the log.
            // jsdom has no quota, so the full store is simulated: the first
            // three chunk writes are refused, as a real browser refuses them.
            const real = window.sessionStorage;
            let throwsLeft = 3;
            const stub: Storage = Object.create(Object.getPrototypeOf(real));
            Object.assign(stub, {
                getItem: (k: string) => real.getItem(k),
                removeItem: (k: string) => real.removeItem(k),
                clear: () => real.clear(),
                key: (i: number) => real.key(i),
                get length() { return real.length; },
                setItem: (k: string, v: string) => {
                    if (throwsLeft > 0 && k.startsWith(HHStoredVarPrefixKey + 'Temp_Log') && !k.endsWith('Idx')) {
                        throwsLeft--;
                        throw new DOMException('QuotaExceededError');
                    }
                    real.setItem(k, v);
                },
            });
            Object.defineProperty(window, 'sessionStorage', { value: stub, configurable: true });
            try {
                // Two full chunks first, so there is something older to drop.
                for (let i = 0; i < 4_000; i++) appendLog(1_700_000_000_000 + i, 'fn', 'x'.repeat(80) + i);
                expect(() => { appendLog(Date.now(), 'fn', 'after the refusals'); flushLog(); }).not.toThrow();
                expect(readLogText()).toContain('after the refusals');
            } finally {
                Object.defineProperty(window, 'sessionStorage', { value: real, configurable: true });
            }
        });

        it('holds far more than the 5000 lines of the old buffer', () => {
            // The reason for the rewrite: 5000 lines were 30 minutes.
            for (let i = 0; i < 20_000; i++) appendLog(1_700_000_000_000 + i, 'fn', 'a line of roughly average length ' + i);
            flushLog();
            expect(Object.keys(readLogAsObject()).length).toBeGreaterThan(15_000);
        });
    });

    describe('taking over an old log', () => {
        it('carries the running session into the ring', () => {
            sessionStorage.setItem(HHStoredVarPrefixKey + 'Temp_Logging', JSON.stringify({
                '18/07/2026, 01:40:05.378:autoLoop': 'Mouse pause active, holding automation.',
                '18/07/2026, 01:40:06.406:logEvent': '[PIPE] tick=1 block=handleSeason ev=start',
            }));
            importLegacyLog();
            const values = Object.values(readLogAsObject());
            expect(values).toEqual([
                'Mouse pause active, holding automation.',
                '[PIPE] tick=1 block=handleSeason ev=start',
            ]);
            // and the old key is gone, so it is imported once, not on every load
            expect(sessionStorage.getItem(HHStoredVarPrefixKey + 'Temp_Logging')).toBeNull();
        });

        it('does nothing when there is no old log', () => {
            importLegacyLog();
            expect(readLogText()).toBe('');
        });
    });

    it('clearLog leaves nothing behind', () => {
        appendLog(Date.now(), 'fn', 'something');
        flushLog();
        clearLog();
        expect(readLogText()).toBe('');
    });
});
