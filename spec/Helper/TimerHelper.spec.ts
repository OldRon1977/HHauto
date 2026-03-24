import {
    setTimer,
    clearTimer,
    checkTimer,
    checkTimerMustExist,
    getTimer,
    getSecondsLeft,
    setTimers,
    getTimeLeft,
    Timers,
} from '../../src/Helper/TimerHelper';

jest.mock('../../src/Helper/StorageHelper', () => ({
    setStoredValue: jest.fn(),
}));

jest.mock('../../src/Utils/index', () => ({
    logHHAuto: jest.fn(),
}));

jest.mock('../../src/config/index', () => ({
    HHStoredVarPrefixKey: 'HHAuto_',
    TK: { Timers: 'Temp_Timers' },
}));

jest.mock('../../src/Helper/TimeHelper', () => ({
    TimeHelper: {
        toHHMMSS: jest.fn((seconds: number) => {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }),
        canCollectCompetitionActive: jest.fn(() => true),
    },
}));

import { setStoredValue } from '../../src/Helper/StorageHelper';
import { TimeHelper } from '../../src/Helper/TimeHelper';

describe('TimerHelper', () => {

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2025-06-15T12:00:00.000Z'));
        // Reset the Timers object before each test
        setTimers({});
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('setTimer', () => {
        it('should set a timer to Date.now() + seconds*1000', () => {
            setTimer('testTimer', 60);

            const now = Date.now();
            const expected = now + 60 * 1000;
            expect(getTimer('testTimer')).toBe(expected);
        });

        it('should call setStoredValue with serialized Timers', () => {
            setTimer('myTimer', 120);

            expect(setStoredValue).toHaveBeenCalledWith(
                'HHAuto_Temp_Timers',
                expect.any(String)
            );
            const storedJson = (setStoredValue as jest.Mock).mock.calls[0][1];
            const parsed = JSON.parse(storedJson);
            expect(parsed.myTimer).toBeDefined();
        });

        it('should overwrite an existing timer with the same name', () => {
            setTimer('dup', 30);
            const first = getTimer('dup');

            jest.advanceTimersByTime(5000);
            setTimer('dup', 60);
            const second = getTimer('dup');

            expect(second).toBeGreaterThan(first);
        });
    });

    describe('clearTimer', () => {
        it('should remove the named timer', () => {
            setTimer('toRemove', 100);
            expect(getTimer('toRemove')).not.toBe(-1);

            clearTimer('toRemove');
            expect(getTimer('toRemove')).toBe(-1);
        });

        it('should call setStoredValue after clearing', () => {
            setTimer('toClear', 50);
            jest.clearAllMocks();

            clearTimer('toClear');
            expect(setStoredValue).toHaveBeenCalled();
        });

        it('should not throw when clearing a non-existent timer', () => {
            expect(() => clearTimer('nonExistent')).not.toThrow();
        });
    });

    describe('checkTimer', () => {
        it('should return true if the timer does not exist', () => {
            expect(checkTimer('missing')).toBe(true);
        });

        it('should return true if the timer has expired', () => {
            setTimer('expired', 10);
            // Advance past the timer
            jest.advanceTimersByTime(15000);
            expect(checkTimer('expired')).toBe(true);
        });

        it('should return false if the timer has not yet expired', () => {
            setTimer('active', 60);
            // Only advance 5 seconds
            jest.advanceTimersByTime(5000);
            expect(checkTimer('active')).toBe(false);
        });
    });

    describe('checkTimerMustExist', () => {
        it('should return false if the timer does not exist', () => {
            expect(checkTimerMustExist('missing')).toBe(false);
        });

        it('should return true if the timer exists and has expired', () => {
            setTimer('exists', 10);
            jest.advanceTimersByTime(15000);
            expect(checkTimerMustExist('exists')).toBe(true);
        });

        it('should return false if the timer exists but has not expired', () => {
            setTimer('notYet', 60);
            jest.advanceTimersByTime(5000);
            expect(checkTimerMustExist('notYet')).toBe(false);
        });
    });

    describe('getTimer', () => {
        it('should return -1 if the timer does not exist', () => {
            expect(getTimer('noSuchTimer')).toBe(-1);
        });

        it('should return the timer timestamp when it exists', () => {
            setTimer('exists', 30);
            const value = getTimer('exists');
            expect(value).toBe(Date.now() + 30 * 1000);
        });
    });

    describe('getSecondsLeft', () => {
        it('should return 0 if the timer does not exist', () => {
            expect(getSecondsLeft('missing')).toBe(0);
        });

        it('should return 0 if the timer has expired', () => {
            setTimer('past', 10);
            jest.advanceTimersByTime(15000);
            expect(getSecondsLeft('past')).toBe(0);
        });

        it('should return the correct number of seconds remaining', () => {
            setTimer('future', 120);
            jest.advanceTimersByTime(20000);
            expect(getSecondsLeft('future')).toBe(100);
        });

        it('should return exact seconds when no time has passed', () => {
            setTimer('exact', 60);
            expect(getSecondsLeft('exact')).toBe(60);
        });
    });

    describe('setTimers', () => {
        it('should replace the entire Timers object', () => {
            const newTimers = {
                timerA: Date.now() + 10000,
                timerB: Date.now() + 20000,
            };
            setTimers(newTimers);

            expect(getTimer('timerA')).toBe(newTimers.timerA);
            expect(getTimer('timerB')).toBe(newTimers.timerB);
        });

        it('should clear old timers when replacing', () => {
            setTimer('old', 100);
            setTimers({ fresh: Date.now() + 5000 });

            expect(getTimer('old')).toBe(-1);
            expect(getTimer('fresh')).not.toBe(-1);
        });
    });

    describe('getTimeLeft', () => {
        it('should return "No timer" when timer does not exist and competition is active', () => {
            (TimeHelper.canCollectCompetitionActive as jest.Mock).mockReturnValue(true);
            expect(getTimeLeft('someTimer')).toBe('No timer');
        });

        it('should return "Time\'s up!" when timer has expired and competition is active', () => {
            (TimeHelper.canCollectCompetitionActive as jest.Mock).mockReturnValue(true);
            setTimer('done', 5);
            jest.advanceTimersByTime(10000);
            expect(getTimeLeft('done')).toBe("Time's up!");
        });

        it('should return formatted time string when timer is still running', () => {
            setTimer('running', 3661);
            const result = getTimeLeft('running');
            expect(TimeHelper.toHHMMSS).toHaveBeenCalledWith(3661);
            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
        });

        it('should return "Wait for contest" for competition timer when competition is not active and timer is missing', () => {
            (TimeHelper.canCollectCompetitionActive as jest.Mock).mockReturnValue(false);
            const competTimerNames = [
                'nextPachinkoTime',
                'nextPachinko2Time',
                'nextPachinkoEquipTime',
                'nextSeasonTime',
                'nextLeaguesTime',
                'nextChampionTime',
                'nextClubChampionTime',
                'nextLabyrinthTime',
                'nextPentaDrillTime',
                'nextPantheonTime',
            ];

            competTimerNames.forEach(name => {
                expect(getTimeLeft(name)).toBe('Wait for contest');
            });
        });

        it('should return "Wait for contest" for competition timer when competition is not active and timer expired', () => {
            (TimeHelper.canCollectCompetitionActive as jest.Mock).mockReturnValue(false);
            setTimer('nextLeaguesTime', 5);
            jest.advanceTimersByTime(10000);
            expect(getTimeLeft('nextLeaguesTime')).toBe('Wait for contest');
        });

        it('should return "No timer" for non-competition timer when competition is not active and timer is missing', () => {
            (TimeHelper.canCollectCompetitionActive as jest.Mock).mockReturnValue(false);
            expect(getTimeLeft('someRandomTimer')).toBe('No timer');
        });

        it('should return "Time\'s up!" for non-competition timer when competition is not active and timer expired', () => {
            (TimeHelper.canCollectCompetitionActive as jest.Mock).mockReturnValue(false);
            setTimer('nonCompetTimer', 5);
            jest.advanceTimersByTime(10000);
            expect(getTimeLeft('nonCompetTimer')).toBe("Time's up!");
        });

        it('should return formatted time for competition timer that has not expired yet, even if competition is inactive', () => {
            (TimeHelper.canCollectCompetitionActive as jest.Mock).mockReturnValue(false);
            setTimer('nextLeaguesTime', 300);
            jest.advanceTimersByTime(100000);
            const result = getTimeLeft('nextLeaguesTime');
            // 200 seconds left, so toHHMMSS should be called
            expect(TimeHelper.toHHMMSS).toHaveBeenCalledWith(200);
        });
    });
});
