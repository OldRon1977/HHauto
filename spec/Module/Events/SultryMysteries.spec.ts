import { SultryMysteries, SultryProgression } from "../../../src/Module/Events/SultryMysteries";
import { MockHelper } from "../../testHelpers/MockHelpers";

// Fresh grid: all 30 squares closed.
function freshGrid(keyAmount = 16): SultryProgression {
    const grid = [];
    for (let i = 1; i <= 30; i++) {
        grid.push({ id_square: i, is_opened: false, reward_index: 0, reward: [] });
    }
    return { key_amount: keyAmount, grid, grid_refresh_squares_required: 15 };
}

// Open N squares, each with the given sultry-coin value (0 = non-coin reward).
function openSquares(prog: SultryProgression, coinValues: number[]): SultryProgression {
    for (let i = 0; i < coinValues.length; i++) {
        const sq = prog.grid![i];
        sq.is_opened = true;
        sq.reward_index = i + 100;
        if (coinValues[i] > 0) {
            sq.reward = { loot: true, rewards: [{ type: 'sultry_coins', value: String(coinValues[i]) }] };
        } else {
            sq.reward = { loot: true, rewards: [{ type: 'gems', gem_type: 'fire', value: 20 }] };
        }
    }
    return prog;
}

describe("SultryMysteries event", function () {
    beforeEach(() => {
        MockHelper.mockDomain();
    });

    describe("isEnabled", function () {
        it("default", function () {
            expect(SultryMysteries.isEnabled()).toBeFalsy();
        });

        it("lower level", function () {
            MockHelper.mockHeroLevel(5);
            expect(SultryMysteries.isEnabled()).toBeFalsy();
        });

        it("higher level", function () {
            MockHelper.mockHeroLevel(500);
            expect(SultryMysteries.isEnabled()).toBeTruthy();
        });
    });

    describe("decide", function () {
        it("waits when no progression", function () {
            expect(SultryMysteries.decide(null as any, 0)).toEqual({ action: 'wait', reason: 'no grid data' });
        });

        it("waits when no keys available", function () {
            const prog = freshGrid(0);
            expect(SultryMysteries.decide(prog, 0)).toEqual({ action: 'wait', reason: 'no keys' });
        });

        it("clicks first locked square on a fresh grid", function () {
            const prog = freshGrid();
            const d = SultryMysteries.decide(prog, 0);
            expect(d).toEqual({ action: 'click', squareId: 1 });
        });

        it("below 15 opened: always clicks, never resets (game rule)", function () {
            // 14 opened, EV hypothetically terrible — still must click
            const prog = freshGrid();
            openSquares(prog, [10, 7, 5, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
            const d = SultryMysteries.decide(prog, 0);
            expect(d.action).toBe('click');
            if (d.action === 'click') expect(d.squareId).toBe(15);
        });

        it("15+ opened, top coins all found: resets", function () {
            const prog = freshGrid();
            openSquares(prog, [10, 7, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
            expect(SultryMysteries.decide(prog, 0)).toEqual({ action: 'reset' });
        });

        it("15+ opened, EV above baseline (no top coins found yet): continues", function () {
            // 15 non-coin squares opened → full coin pool still hidden → EV = 26/15 ≈ 1.73 >> 0.867
            const prog = freshGrid();
            openSquares(prog, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
            const d = SultryMysteries.decide(prog, 0);
            expect(d.action).toBe('click');
        });

        it("15+ opened, EV below baseline: resets", function () {
            // 15 opened, already got 10+7+1+3 = 21 of 26 coins. Remaining = 5 over 15 closed → EV = 0.333 < 0.867
            // But top coins (10,7,5) not all found → only rule B triggers.
            const prog = freshGrid();
            openSquares(prog, [10, 7, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
            expect(SultryMysteries.decide(prog, 0)).toEqual({ action: 'reset' });
        });

        it("resetAfterKeys=20 forces reset once 20 opened (EV still fine)", function () {
            // 20 non-coin squares: full pool still hidden, EV high — but user cap 20 triggers reset.
            const prog = freshGrid();
            openSquares(prog, new Array(20).fill(0));
            expect(SultryMysteries.decide(prog, 20)).toEqual({ action: 'reset' });
        });

        it("resetAfterKeys=10 gets clamped to 15 (game minimum)", function () {
            // 14 opened, non-coin → cap would be 10 but clamped up to 15 → continues clicking
            const prog = freshGrid();
            openSquares(prog, new Array(14).fill(0));
            const d = SultryMysteries.decide(prog, 10);
            expect(d.action).toBe('click');
        });

        it("resetAfterKeys=15 clamp: resets exactly at 15", function () {
            const prog = freshGrid();
            openSquares(prog, new Array(15).fill(0));
            expect(SultryMysteries.decide(prog, 15)).toEqual({ action: 'reset' });
        });

        it("resetAfterKeys=0 uses pure EV logic (EV fine → continues)", function () {
            const prog = freshGrid();
            openSquares(prog, new Array(15).fill(0));
            const d = SultryMysteries.decide(prog, 0);
            expect(d.action).toBe('click');
        });

        it("board fully opened: resets", function () {
            const prog = freshGrid();
            openSquares(prog, new Array(30).fill(0));
            expect(SultryMysteries.decide(prog, 0)).toEqual({ action: 'reset' });
        });

        it("extractFoundCoins ignores non-coin rewards", function () {
            const opened = [
                { reward: { rewards: [{ type: 'sultry_coins', value: '10' }] } },
                { reward: { rewards: [{ type: 'gems', value: 20 }] } },
                { reward: { rewards: [{ type: 'sultry_coins', value: '3' }] } },
                { reward: [] },
            ];
            expect(SultryMysteries.extractFoundCoins(opened)).toEqual([10, 3]);
        });
    });
});
