import {
    chooseTargetOpponent, countFight, decideKiss, fightOutcome, isTargetReached, KissInput, mayCountFight, parseTarget,
    SeasonTargetPending, SeasonTargetState,
} from '../../../src/Module/Events/SeasonTarget.pure';

const pending: SeasonTargetPending = { opponentId: '1000', mojoBefore: 1641, kissBefore: 9, at: 1 };

function state(over: Partial<SeasonTargetState> = {}): SeasonTargetState {
    return { mode: 'wins', target: 3, buyKisses: false, wins: 0, fights: 0, since: 0, ...over };
}

describe('fightOutcome', () => {
    // Measured on the test account: +20 and +21 mojo for two wins, -7 for a loss.
    it('reads more mojo as a win', () => {
        expect(fightOutcome(pending, 1662, 8)).toBe('won');
    });

    it('reads less mojo as a loss', () => {
        expect(fightOutcome(pending, 1634, 8)).toBe('lost');
    });

    it('reads unchanged mojo with a kiss gone as a fight of unknown outcome', () => {
        expect(fightOutcome(pending, 1641, 8)).toBe('unknown');
    });

    it('reads unchanged mojo and no kiss gone as no fight at all', () => {
        expect(fightOutcome(pending, 1641, 9)).toBe('none');
    });
});

describe('countFight', () => {
    it('counts a win as a win and a fight, and drops the pending fight', () => {
        const next = countFight(state({ pending }), 'won');
        expect(next).toMatchObject({ wins: 1, fights: 1 });
        expect(next.pending).toBeUndefined();
    });

    it('counts a loss and an unknown outcome as a fight only', () => {
        expect(countFight(state(), 'lost')).toMatchObject({ wins: 0, fights: 1 });
        expect(countFight(state(), 'unknown')).toMatchObject({ wins: 0, fights: 1 });
    });

    it('counts nothing for a fight that never ran', () => {
        const next = countFight(state({ pending, wins: 2, fights: 5 }), 'none');
        expect(next).toMatchObject({ wins: 2, fights: 5 });
        expect(next.pending).toBeUndefined();
    });
});

describe('isTargetReached', () => {
    it('counts wins for a wins target, not fights', () => {
        expect(isTargetReached(state({ mode: 'wins', target: 3, wins: 2, fights: 7 }))).toBe(false);
        expect(isTargetReached(state({ mode: 'wins', target: 3, wins: 3, fights: 7 }))).toBe(true);
    });

    it('counts every fight for a fights target', () => {
        expect(isTargetReached(state({ mode: 'fights', target: 3, wins: 0, fights: 3 }))).toBe(true);
        expect(isTargetReached(state({ mode: 'fights', target: 3, wins: 2, fights: 2 }))).toBe(false);
    });
});

describe('chooseTargetOpponent', () => {
    it('takes the best chance to win, even against more mojo', () => {
        expect(chooseTargetOpponent([
            { win: 0.80, mojo: 30 },
            { win: 0.95, mojo: 10 },
            { win: 0.90, mojo: 25 },
        ])).toBe(1);
    });

    it('takes the most mojo among equal chances', () => {
        expect(chooseTargetOpponent([
            { win: 1, mojo: 12 },
            { win: 1, mojo: 21 },
            { win: 0.5, mojo: 40 },
        ])).toBe(1);
    });

    it('compares chances at the precision the arena shows -- 99.996 % and 100 % are one tie', () => {
        expect(chooseTargetOpponent([
            { win: 1, mojo: 10 },
            { win: 0.99996, mojo: 20 },
        ])).toBe(1);
    });

    it('returns -1 for no opponents', () => {
        expect(chooseTargetOpponent([])).toBe(-1);
    });
});

describe('decideKiss', () => {
    const base: KissInput = { kisses: 0, buyKisses: true, spendAllowed: true, kobans: 1000, kobanBank: 500, price: 22 };

    it('fights while kisses are there, whatever the buying', () => {
        expect(decideKiss({ ...base, kisses: 1, buyKisses: false, spendAllowed: false })).toEqual({ kind: 'fight' });
    });

    it('ends without kisses when buying is off', () => {
        expect(decideKiss({ ...base, buyKisses: false })).toEqual({ kind: 'end', reason: 'noKisses' });
    });

    it('ends when Spend Kobans is off, even with buying on', () => {
        expect(decideKiss({ ...base, spendAllowed: false })).toEqual({ kind: 'end', reason: 'spendOff' });
    });

    it('buys while the reserve stays whole -- down to exactly the reserve', () => {
        expect(decideKiss(base)).toEqual({ kind: 'buy' });
        expect(decideKiss({ ...base, kobans: 522 })).toEqual({ kind: 'buy' });
    });

    it('ends when one kiss would cut into the reserve', () => {
        expect(decideKiss({ ...base, kobans: 521 })).toEqual({ kind: 'end', reason: 'reserve' });
    });

    it('ends when the price is unknown', () => {
        expect(decideKiss({ ...base, price: Infinity })).toEqual({ kind: 'end', reason: 'reserve' });
    });
});

describe('parseTarget', () => {
    it('takes whole numbers from 1 to 999', () => {
        expect(parseTarget('1')).toBe(1);
        expect(parseTarget(' 40 ')).toBe(40);
        expect(parseTarget('999')).toBe(999);
    });

    it('refuses everything else', () => {
        for (const value of ['', '0', '-3', '1000', '2.5', 'abc']) {
            expect(parseTarget(value)).toBeNull();
        }
    });
});

// #1801: counting used to compare the arena page's performance.timeOrigin with
// the launch time; in a Firefox log 34 of 36 fights went uncounted that way.
describe('mayCountFight', () => {
    it('does not count a fight that has not reached its battle page', () => {
        expect(mayCountFight(pending)).toBe(false);
    });

    it('counts a fight once its battle page was seen, whatever the page clocks say', () => {
        expect(mayCountFight({ ...pending, at: Date.now() + 60_000, fought: true })).toBe(true);
    });

    it('has nothing to count without a pending fight', () => {
        expect(mayCountFight(undefined)).toBe(false);
    });
});
