/**
 * cleanLogsInStorage -- the quota-recovery path.
 *
 * setStoredValue calls this when a write is refused and then retries once.
 * Both calls used to clear the whole log ring, so a single quota error on an
 * unrelated key cost the log a bug report is written from. Measured on a real
 * session: one such error at 09:34 left a log that began at 09:34, five hours
 * short of the run it was meant to document.
 *
 * The first call now sacrifices the oldest chunks only; the retry is the one
 * that clears everything.
 */
import { cleanLogsInStorage } from '../../src/Utils/LogUtils';
import { appendLog, clearLog, flushLog, readLogText } from '../../src/Utils/LogStore';

/** Enough lines to fill several chunks, so there is something older to drop. */
function fillRing(): void {
    for (let i = 0; i < 8_000; i++) appendLog(1_700_000_000_000 + i, 'fn', 'x'.repeat(80) + i);
    appendLog(1_700_000_099_999, 'fn', 'the newest line');
    flushLog();
}

describe('cleanLogsInStorage', () => {
    beforeEach(() => {
        sessionStorage.clear();
        localStorage.clear();
        clearLog();
    });

    it('keeps the newest lines on the first attempt', () => {
        fillRing();
        const before = readLogText().length;

        cleanLogsInStorage();

        const after = readLogText();
        expect(after).toContain('the newest line');
        expect(after.length).toBeLessThan(before);
    });

    it('clears the ring on the retry', () => {
        fillRing();

        cleanLogsInStorage(true);

        expect(readLogText()).toBe('');
    });

    it('clears the ring when there is nothing older to give', () => {
        // A single short line lives in the current chunk alone: dropping the
        // oldest would free nothing, so the caller's retry would fail for the
        // same reason it failed the first time.
        appendLog(1_700_000_000_000, 'fn', 'one short line');
        flushLog();

        cleanLogsInStorage();

        expect(readLogText()).toBe('');
    });
});
