import {
    absentFromHome,
    EVENTS_GONE_MAX,
    expiredIds,
    forgetEventGone,
    isEventGone,
    markEventGone,
    NAV_ANSWER_WINDOW_MS,
    removeEventEntry,
    wasSentAway,
} from '../../../src/Module/Events/EventRegistry';
import { HHStoredVarPrefixKey } from "../../../src/config/HHStoredVars";

// Is the event still there (#1925)? The game sends a tab that no longer exists
// back to home.html, and shows a widget on home for every running event --
// both measured on the test account.
describe("EventRegistry: is the event still there", function () {
    const LOAD = 1_000_000;

    describe("wasSentAway", function () {
        const target = (over: Partial<{ page: string; tab: string | null; at: number }> = {}) =>
            ({ page: 'event', tab: 'sm_event_49', at: LOAD - 3000, ...over });

        it("the load right after asking for an event tab lands on home: the tab is gone", function () {
            expect(wasSentAway(target(), LOAD, 'home', 'event', 'home')).toBe('sm_event_49');
        });

        it("the event page was served: nothing is gone", function () {
            expect(wasSentAway(target(), LOAD, 'event', 'event', 'home')).toBeNull();
        });

        it("landing anywhere but home says nothing -- the logged-out intro, a maintenance page", function () {
            expect(wasSentAway(target(), LOAD, '', 'event', 'home')).toBeNull();
            expect(wasSentAway(target(), LOAD, 'shop', 'event', 'home')).toBeNull();
        });

        it("a clock rounded by the browser does not hide the answer", function () {
            // Firefox with resistFingerprinting rounds both clocks
            expect(wasSentAway(target({ at: LOAD + 50 }), LOAD, 'home', 'event', 'home')).toBe('sm_event_49');
        });

        it("only the load that answers the navigation counts", function () {
            expect(wasSentAway(target({ at: LOAD + 5000 }), LOAD, 'home', 'event', 'home')).toBeNull();
            // a load long after it
            expect(wasSentAway(target({ at: LOAD - NAV_ANSWER_WINDOW_MS - 1 }), LOAD, 'home', 'event', 'home')).toBeNull();
        });

        it("a navigation without a tab, or to another page, decides nothing", function () {
            expect(wasSentAway(null, LOAD, 'home', 'event', 'home')).toBeNull();
            expect(wasSentAway(target({ tab: null }), LOAD, 'home', 'event', 'home')).toBeNull();
            expect(wasSentAway(target({ page: '/shop.html', tab: null }), LOAD, 'home', 'event', 'home')).toBeNull();
        });
    });

    it("absentFromHome: the registry ids without a widget", function () {
        expect(absentFromHome(['sm_event_49', 'event_7'], ['event_7', 'legendary_contest_78'])).toEqual(['sm_event_49']);
        expect(absentFromHome(['sm_event_49'], [])).toEqual(['sm_event_49']);
    });

    it("expiredIds: past ends only; an entry without a usable end stays", function () {
        const list = {
            a: { seconds_before_end: LOAD - 1 },
            b: { seconds_before_end: LOAD + 1 },
            c: { seconds_before_end: 'x' },
            d: {},
        };
        expect(expiredIds(list, LOAD)).toEqual(['a']);
    });

    describe("gone ids", function () {
        beforeEach(() => sessionStorage.removeItem(HHStoredVarPrefixKey + "Temp_eventsGone"));

        it("hold without a time limit, until the game shows the event again", function () {
            markEventGone('sm_event_49', LOAD);
            expect(isEventGone('sm_event_49')).toBe(true);
            expect(isEventGone('event_7')).toBe(false);
            forgetEventGone('sm_event_49');
            expect(isEventGone('sm_event_49')).toBe(false);
        });

        it("keep only the newest ones", function () {
            for (let i = 0; i <= EVENTS_GONE_MAX; i++) markEventGone('event_' + i, LOAD + i);
            const stored = JSON.parse(sessionStorage.getItem(HHStoredVarPrefixKey + "Temp_eventsGone") || '{}');
            expect(Object.keys(stored).length).toBe(EVENTS_GONE_MAX);
            expect(isEventGone('event_0')).toBe(false);
            expect(isEventGone('event_' + EVENTS_GONE_MAX)).toBe(true);
        });
    });

    it("removeEventEntry drops one id and the whole key with the last one", function () {
        const key = HHStoredVarPrefixKey + "Temp_eventsList";
        sessionStorage.setItem(key, JSON.stringify({ a: { id: 'a' }, b: { id: 'b' } }));
        expect(removeEventEntry('a')).toBe(true);
        expect(JSON.parse(sessionStorage.getItem(key) || '{}')).toEqual({ b: { id: 'b' } });
        expect(removeEventEntry('a')).toBe(false);
        expect(removeEventEntry('b')).toBe(true);
        expect(sessionStorage.getItem(key)).toBeNull();
    });
});
