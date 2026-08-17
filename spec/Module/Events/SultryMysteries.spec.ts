import { SultryMysteries } from '../../../src/Module/Events/SultryMysteries';
import { setTimer } from "../../../src/Helper/TimerHelper";
import { HHEvent, HHEventList } from "../../../src/model/HHEvent";
import { MockHelper } from "../../testHelpers/MockHelpers";

describe("SultryMysteries event", function () {
    beforeEach(() => {
        MockHelper.mockDomain();
    });

    describe("parse", function () {
        const hhEvent = { eventId: 'sm_event_47', eventType: 'sm_event' } as HHEvent;

        beforeEach(() => {
            document.body.innerHTML = '';
            delete (unsafeWindow as any).sm_event_data;
            // The grid tab (default view of /event.html) has no shop-timer
            // element in the DOM, matching the live-verified repro. Park the
            // shop-refresh timer far in the future so parse()'s tab-switch
            // branch (untouched by this fix) doesn't fire during these tests.
            setTimer('eventSultryMysteryShopRefresh', 999999);
        });

        it("regression #drift-2026-08: uses sm_event_data.seconds_until_event_end even though the grid tab has no timer element in the DOM", function () {
            (unsafeWindow as any).sm_event_data = { seconds_until_event_end: "319404" };
            const eventList: HHEventList = {};
            const before = new Date().getTime();

            SultryMysteries.parse(hhEvent, eventList, {} as any);

            const expected = before + 319404 * 1000;
            const secondsBeforeEnd = eventList[hhEvent.eventId]["seconds_before_end"] as number;
            expect(secondsBeforeEnd).toBeGreaterThanOrEqual(expected);
            expect(secondsBeforeEnd).toBeLessThanOrEqual(expected + 5000);
        });

        it("falls back to a full hour -- not 'now' -- when neither sm_event_data nor the DOM timer are available", function () {
            const eventList: HHEventList = {};
            const before = new Date().getTime();

            SultryMysteries.parse(hhEvent, eventList, {} as any);

            const expected = before + 3600 * 1000;
            const secondsBeforeEnd = eventList[hhEvent.eventId]["seconds_before_end"] as number;
            expect(secondsBeforeEnd).toBeGreaterThanOrEqual(expected);
            expect(secondsBeforeEnd).toBeLessThanOrEqual(expected + 5000);
        });
    });

});