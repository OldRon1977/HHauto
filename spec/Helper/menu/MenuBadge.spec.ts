import { areaState, blockState, countBlocks, formatBadge } from '../../../src/Helper/menu/MenuBadge';

/** A reader over a plain map, the way the panel reads its checkboxes. */
const reader = (state: Record<string, boolean>) => (key: string) => state[key];

describe("MenuBadge", function () {

    describe("blockState", function () {
        it("is on when any acting switch of the block is on", function () {
            // The pipeline gates collecting independently of fighting, so the
            // block runs even though the fight switch is off.
            const state = blockState(
                { masters: ['autoSeason', 'autoSeasonCollect', 'autoSeasonCollectAll'] },
                reader({ autoSeason: false, autoSeasonCollect: true, autoSeasonCollectAll: false }),
            );
            expect(state).toBe('on');
        });

        it("is off when none of them is, and ignores what else is ticked", function () {
            const state = blockState(
                { masters: ['autoLeagues', 'autoLeaguesCollect'] },
                reader({ autoLeagues: false, autoLeaguesCollect: false, autoLeaguesBoostedOnly: true }),
            );
            expect(state).toBe('off');
        });

        it("reports a conflict when the block is set up but its starter is off", function () {
            // The case a plain on/off marker gets wrong: +Event is configured
            // down to the buying, and nothing will ever run without the switch
            // that starts the fighting.
            const state = blockState(
                { masters: ['plusEvent'], requires: ['autoTrollBattle'], options: ['buyCombat'] },
                reader({ plusEvent: true, autoTrollBattle: false, buyCombat: true }),
            );
            expect(state).toBe('conflict');
        });

        it("is on once the prerequisite is on as well", function () {
            const state = blockState(
                { masters: ['plusEvent'], requires: ['autoTrollBattle'] },
                reader({ plusEvent: true, autoTrollBattle: true }),
            );
            expect(state).toBe('on');
        });

        it("reports a conflict when only the steering options were set", function () {
            // Labyrinth off, but hard mode and sweep are on: the user set this
            // up and then never armed it.
            const state = blockState(
                { masters: ['autoLabyrinth'], options: ['autoLabyHard', 'autoLabySweep'] },
                reader({ autoLabyrinth: false, autoLabyHard: false, autoLabySweep: true }),
            );
            expect(state).toBe('conflict');
        });

        it("stays off when a steering option is off too", function () {
            const state = blockState(
                { masters: ['autoLabyrinth'], options: ['autoLabyHard'] },
                reader({ autoLabyrinth: false, autoLabyHard: false }),
            );
            expect(state).toBe('off');
        });

        it("has no state at all when this build renders none of its switches", function () {
            // A debug-only or removed row reads as undefined. Marking the block
            // off would claim a capability the panel does not show.
            expect(blockState({ masters: ['goneInThisBuild'] }, () => undefined)).toBe('none');
        });

        it("has no state for a block that cannot act", function () {
            expect(blockState({ masters: [] }, () => true)).toBe('none');
        });

        it("does not let a prerequisite this build lacks block anything", function () {
            // A build without that row cannot have the user turn it on, so
            // treating it as off would mark a running block as a conflict.
            const state = blockState(
                { masters: ['plusEvent'], requires: ['droppedInThisBuild'] },
                key => (key === 'plusEvent' ? true : undefined),
            );
            expect(state).toBe('on');
        });
    });

    describe("countBlocks", function () {
        it("counts running blocks against the ones that can run", function () {
            expect(countBlocks(['on', 'off', 'on', 'none', 'conflict']))
                .toEqual({ on: 2, total: 4, conflicts: 1 });
        });

        it("leaves an area of nothing-to-count at zero", function () {
            expect(countBlocks(['none', 'none'])).toEqual({ on: 0, total: 0, conflicts: 0 });
        });
    });

    describe("areaState", function () {
        it("is on when something in the area runs", function () {
            expect(areaState({ on: 2, total: 9, conflicts: 0 })).toBe('on');
        });

        it("is off when nothing does", function () {
            expect(areaState({ on: 0, total: 9, conflicts: 0 })).toBe('off');
        });

        it("shows the conflict even while other blocks of the area run", function () {
            // The whole point of the rail marker: see the forgotten toggle
            // without opening the area first.
            expect(areaState({ on: 3, total: 9, conflicts: 1 })).toBe('conflict');
        });

        it("has no state for an area with nothing that can run", function () {
            expect(areaState({ on: 0, total: 0, conflicts: 0 })).toBe('none');
        });
    });

    describe("formatBadge", function () {
        it("renders on/total", function () {
            expect(formatBadge({ on: 2, total: 6, conflicts: 0 })).toEqual('2/6');
            expect(formatBadge({ on: 0, total: 4, conflicts: 1 })).toEqual('0/4');
        });

        it("renders nothing when there is nothing to count, so no empty pill appears", function () {
            expect(formatBadge({ on: 0, total: 0, conflicts: 0 })).toEqual('');
        });
    });
});
