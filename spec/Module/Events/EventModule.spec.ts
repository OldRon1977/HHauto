import { setTimers } from "../../../src/Helper/TimerHelper";
import { EventModule } from '../../../src/Module/Events/EventModule';
import { HHStoredVarPrefixKey } from "../../../src/config/HHStoredVars";
import { MockHelper } from "../../testHelpers/MockHelpers";

describe("Event Module", function() {
    const HTML_START = `<!DOCTYPE html><div id="hh_hentai" page="event"><p>Hello world</p></div>`;

    function createEventTab(eventId: string) {
        document.body.innerHTML = HTML_START + `<div id="contains_all"><div id="events"><div class="events-list">
                <a class="event-title ${eventId != '' ? 'active' : ''}" href="/event.html?tab=event_${eventId}">Event Name</a>
                <a class="event-title" href="/event.html?tab=event_0">Event Name</a>
            </div></div></div>`;
    }

    let nextTime: number;
    let pastTime: number;
    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2020-03-01'));
        nextTime = (new Date('2020-03-02')).getTime();
        pastTime = (new Date('2020-02-01')).getTime();
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    beforeEach(() => {
        document.body.innerHTML = HTML_START;
        sessionStorage.removeItem(HHStoredVarPrefixKey + "Temp_eventsList");

        localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusEvent", 'false');
        localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusEventMythic", 'false');
        localStorage.setItem(HHStoredVarPrefixKey + "Setting_bossBangEvent", 'false');
        localStorage.setItem(HHStoredVarPrefixKey + "Setting_sultryMysteriesEventRefreshShop", 'false');
        localStorage.setItem(HHStoredVarPrefixKey + "Setting_autodpEventCollect", 'false');
        MockHelper.mockDomain();
    });
    


    describe("getDisplayedIdEventPage", function () {
        // $("#contains_all #events .events-list .event-title.active").attr("href")

        it("default", function () {
            expect(EventModule.getDisplayedIdEventPage()).toBe('');
        });

        it("Event 666", function () {
            createEventTab('666');
            expect(EventModule.getDisplayedIdEventPage()).toBe('event_666');
        });

        it("wrong event", function () {
            createEventTab('');
            expect(EventModule.getDisplayedIdEventPage()).toBe('');
        });
    });


    describe("isEventActive", function () {
        beforeEach(() => {
            sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_eventsList", JSON.stringify({}))
        });

        it("default", function () {
            expect(EventModule.isEventActive('')).toBeFalsy();
            expect(EventModule.isEventActive('event_666')).toBeFalsy();
            expect(EventModule.isEventActive('mythic_event_99')).toBeFalsy();
        });

        it("Event date", function () {
            sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_eventsList", `{"event_666":{"id":"event_666","type":"event","seconds_before_end":${nextTime},"next_refresh":${nextTime},"isCompleted":false},"mythic_event_99":{"id":"mythic_event_99","type":"mythic","isMythic":true,"seconds_before_end":${pastTime},"next_refresh":${nextTime},"isCompleted":false}}`);

            expect(EventModule.isEventActive('')).toBeFalsy();
            expect(EventModule.isEventActive('event_666')).toBeTruthy();
            expect(EventModule.isEventActive('mythic_event_99')).toBeFalsy();
        });

        it("Event completed", function () {
            sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_eventsList", `{"event_666":{"id":"event_666","type":"event","seconds_before_end":${nextTime},"next_refresh":${nextTime},"isCompleted":false},"mythic_event_99":{"id":"mythic_event_99","type":"mythic","isMythic":true,"seconds_before_end":${nextTime},"next_refresh":${nextTime},"isCompleted":true}}`)

            expect(EventModule.isEventActive('')).toBeFalsy();
            expect(EventModule.isEventActive('event_666')).toBeTruthy();
            expect(EventModule.isEventActive('mythic_event_99')).toBeFalsy();
        });
    });


    describe("getEventType", function () {
        it("default", function () {
            expect(EventModule.getEventType('event_x')).toBe('event');
            expect(EventModule.getEventType('mythic_event_x')).toBe('mythic');
            expect(EventModule.getEventType('boss_bang_event_x')).toBe('bossBang');
            expect(EventModule.getEventType('sm_event_x')).toBe('sultryMysteries');
            expect(EventModule.getEventType('dp_event_x')).toBe('doublePenetration');
            expect(EventModule.getEventType('path_event_x')).toBe('poa');
            expect(EventModule.getEventType('cumback_contest_x')).toBe('cumback');
            expect(EventModule.getEventType('legendary_contest_x')).toBe('');
            expect(EventModule.getEventType('dpg_event_x')).toBe('');
        });
        it("numbers", function () {
            expect(EventModule.getEventType('event_1')).toBe('event');
            expect(EventModule.getEventType('event_99999999999999999999999999999999999999999999')).toBe('event');
        });
    });


    describe("checkEvent", function () {

        beforeEach(() => {
            sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_eventsList", JSON.stringify({}))
        });

        it("default", function () {
            expect(EventModule.checkEvent('')).toBeFalsy();
            expect(EventModule.checkEvent('event_666')).toBeFalsy();
            expect(EventModule.checkEvent('mythic_event_99')).toBeFalsy();
            expect(EventModule.checkEvent('IDK_event_555')).toBeFalsy();
        });

        it("plusEvent activated and no event stored", function () {
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusEvent", 'true');
            expect(EventModule.checkEvent('')).toBeFalsy();
            expect(EventModule.checkEvent('event_666')).toBeTruthy();
            expect(EventModule.checkEvent('mythic_event_99')).toBeFalsy();
            expect(EventModule.checkEvent('IDK_event_555')).toBeFalsy();
        });

        it("mythic activated and no event stored", function () {
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusEventMythic", 'true');
            expect(EventModule.checkEvent('')).toBeFalsy();
            expect(EventModule.checkEvent('event_666')).toBeFalsy();
            expect(EventModule.checkEvent('mythic_event_99')).toBeTruthy();
            expect(EventModule.checkEvent('IDK_event_555')).toBeFalsy();
        });

        it("Event completed", function () {
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusEvent", 'true');
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusEventMythic", 'true');
            sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_eventsList", `{"mythic_event_99":{"id":"mythic_event_99","type":"mythic","isMythic":true,"seconds_before_end":${nextTime},"next_refresh":${nextTime},"isCompleted":true}}`)

            expect(EventModule.checkEvent('')).toBeFalsy();
            expect(EventModule.checkEvent('event_666')).toBeTruthy();
            expect(EventModule.checkEvent('mythic_event_99')).toBeFalsy();
        });

        it("Need refresh", function () {
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusEvent", 'true');
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusEventMythic", 'true');
            sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_eventsList", `{"event_666":{"id":"event_666","type":"event","seconds_before_end":${nextTime},"next_refresh":${nextTime},"isCompleted":false},"mythic_event_99":{"id":"mythic_event_99","type":"mythic","isMythic":true,"seconds_before_end":${nextTime},"next_refresh":${pastTime},"isCompleted":false}}`);

            expect(EventModule.checkEvent('')).toBeFalsy();
            expect(EventModule.checkEvent('event_666')).toBeFalsy();
            expect(EventModule.checkEvent('mythic_event_99')).toBeTruthy();
        });

        it("Mythic next wave", function () {
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusEventMythic", 'true');
            setTimers({ "eventMythicNextWave": pastTime});
            sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_eventsList", `{"mythic_event_99":{"id":"mythic_event_99","type":"mythic","isMythic":true,"seconds_before_end":${nextTime},"next_refresh":${nextTime},"isCompleted":false}}`);

            expect(EventModule.checkEvent('mythic_event_99')).toBeTruthy();
        });
    });


    describe("parsePageForEventId", function () {

        it("default", function () {
            const { eventIDs, bossBangEventIDs } = EventModule.parsePageForEventId();
            expect(eventIDs).toEqual([]);
            expect(bossBangEventIDs).toEqual([]);
        });

        it("No more event active but some saved", function () {
            sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_eventsList", `{"mythic_event_99":{"id":"mythic_event_99","type":"mythic","isMythic":true,"seconds_before_end":${nextTime},"next_refresh":${nextTime},"isCompleted":false}}`);

            const { eventIDs, bossBangEventIDs } = EventModule.parsePageForEventId();
            expect(eventIDs).toEqual([]);
            expect(bossBangEventIDs).toEqual([]);
        });

        it("New event active but not activated in settings", function () {
            createEventTab('666');
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusEvent", 'false');

            const { eventIDs, bossBangEventIDs } = EventModule.parsePageForEventId();
            expect(eventIDs).toEqual([]);
            expect(bossBangEventIDs).toEqual([]);
        });

        it("New event active but some saved", function () {
            createEventTab('666');
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusEvent", 'true');
            sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_eventsList", `{"event_99":{"id":"event_99","type":"event","isMythic":false,"seconds_before_end":${nextTime},"next_refresh":${nextTime},"isCompleted":false}}`);

            const { eventIDs, bossBangEventIDs } = EventModule.parsePageForEventId();
            expect(eventIDs).toEqual(['event_666', 'event_0']);
            expect(bossBangEventIDs).toEqual([]);
        });

        it("Event active and already saved", function () {
            createEventTab('666');
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusEvent", 'true');
            sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_eventsList", `{"event_666":{"id":"event_666","type":"event","isMythic":false,"seconds_before_end":${nextTime},"next_refresh":${nextTime},"isCompleted":false}}`);

            const { eventIDs, bossBangEventIDs } = EventModule.parsePageForEventId();
            expect(eventIDs).toEqual(['event_0']);
            expect(bossBangEventIDs).toEqual([]);
        });

        it("Event active and to be checked again", function () {
            createEventTab('666');
            localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusEvent", 'true');
            sessionStorage.setItem(HHStoredVarPrefixKey + "Temp_eventsList", `{"event_666":{"id":"event_666","type":"event","isMythic":false,"seconds_before_end":${nextTime},"next_refresh":${pastTime},"isCompleted":false}}`);

            const { eventIDs, bossBangEventIDs } = EventModule.parsePageForEventId();
            expect(eventIDs).toEqual(['event_666', 'event_0']);
            expect(bossBangEventIDs).toEqual([]);
        });
    });
});