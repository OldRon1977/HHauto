import { countActive, formatBadge } from '../../../src/Helper/menu/MenuBadge';

describe("MenuBadge", function () {

    describe("countActive", function () {
        it("counts only the switches it was given", function () {
            const state: Record<string, boolean> = {
                autoSeason: true, autoSeasonCollect: false, autoSeasonCollectAll: true,
                // A display toggle that happens to be on must not show up in the count.
                seasonDisplayPowerCalc: true,
            };
            const count = countActive(
                ['autoSeason', 'autoSeasonCollect', 'autoSeasonCollectAll'],
                key => state[key],
            );
            expect(count).toEqual({ on: 2, total: 3 });
        });

        it("leaves a switch the build does not render out of BOTH numbers", function () {
            // A debug-only or removed row reads as undefined. Counting it as off
            // would advertise a capability the panel does not show.
            const count = countActive(
                ['autoQuest', 'goneInThisBuild', 'autoSalary'],
                key => (key === 'goneInThisBuild' ? undefined : true),
            );
            expect(count).toEqual({ on: 2, total: 2 });
        });

        it("reports zero of n for an area where nothing is switched on", function () {
            const count = countActive(['autoLeagues', 'autoLeaguesCollect'], () => false);
            expect(count).toEqual({ on: 0, total: 2 });
        });

        it("reports zero of zero for a display-only area", function () {
            expect(countActive([], () => true)).toEqual({ on: 0, total: 0 });
        });
    });

    describe("formatBadge", function () {
        it("renders on/total", function () {
            expect(formatBadge({ on: 2, total: 6 })).toEqual('2/6');
            expect(formatBadge({ on: 0, total: 4 })).toEqual('0/4');
        });

        it("renders nothing when there is nothing to count, so no empty pill appears", function () {
            expect(formatBadge({ on: 0, total: 0 })).toEqual('');
        });
    });
});
