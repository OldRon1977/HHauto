import { getTimer, setTimer, setTimers } from "../../../src/Helper/TimerHelper";
import { EventModule } from '../../../src/Module/Events/EventModule';
import { PathOfAttraction } from '../../../src/Module/Events/PathOfAttraction';
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
    


    // getDisplayedIdEventPage: the three tests that stood here built the
    // #contains_all #events .events-list .event-title.active markup
    // themselves and then asserted the selector that reads it. Whether the
    // event tab still carries those classes is checked in
    // scripts/live-check (spec triage 2026-08).


    // Measured 2026-09-11: with every auto* switch off except autoQuest the
    // run still went to a Path of Attraction, because getEvent counted it as
    // enabled on the unlock alone. The collect-only event types now need one
    // of their collect switches, or a pending manual collect-all.
    describe("getEvent: which collect-only events are worth a visit", function () {
        const setting = (key: string, value: string) => localStorage.setItem(HHStoredVarPrefixKey + key, value);
        afterEach(() => {
            jest.restoreAllMocks();
            for (const key of ["Setting_autoPoACollect", "Setting_autoPoACollectAll", "Temp_poaManualCollectAll",
                "Setting_autodpEventCollectAll", "Setting_autoLivelySceneEventCollect",
                "Setting_autoLivelySceneEventCollectAll", "Temp_lseManualCollectAll"]) {
                localStorage.removeItem(HHStoredVarPrefixKey + key);
            }
        });

        it("a Path of Attraction needs a PoA collect switch or a pending manual collect", function () {
            jest.spyOn(PathOfAttraction, 'isEnabled').mockReturnValue(true);
            expect(EventModule.getEvent('path_event_110').isEnabled).toBe(false);
            setting("Setting_autoPoACollect", 'true');
            expect(EventModule.getEvent('path_event_110').isEnabled).toBe(true);
            setting("Setting_autoPoACollect", 'false');
            setting("Temp_poaManualCollectAll", 'true');
            expect(EventModule.getEvent('path_event_110').isEnabled).toBe(true);
        });

        it("a Path of Attraction the account cannot enter stays off whatever the switches say", function () {
            jest.spyOn(PathOfAttraction, 'isEnabled').mockReturnValue(false);
            setting("Setting_autoPoACollect", 'true');
            expect(EventModule.getEvent('path_event_110').isEnabled).toBe(false);
        });

        it("Double Penetration and Lively Scene need their collect switch", function () {
            expect(EventModule.getEvent('dp_event_7').isEnabled).toBe(false);
            setting("Setting_autodpEventCollect", 'true');
            expect(EventModule.getEvent('dp_event_7').isEnabled).toBe(true);
            expect(EventModule.getEvent('lively_scene_event_3').isEnabled).toBe(false);
            setting("Setting_autoLivelySceneEventCollectAll", 'true');
            expect(EventModule.getEvent('lively_scene_event_3').isEnabled).toBe(true);
        });

        it("keeps the type flags without the switches, for the event page's own buttons", function () {
            jest.spyOn(PathOfAttraction, 'isEnabled').mockReturnValue(true);
            const ev = EventModule.getEvent('path_event_110');
            expect(ev.isPoa).toBe(true);
            expect(ev.isEnabled).toBe(false);
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

    // #1925: an SM entry outlived its event; the held Sultry Mysteries run
    // navigated to the dead tab, the game sent it home, for hours.
    describe("events the game no longer has", function () {
        const HOME_START = `<!DOCTYPE html><div id="hh_hentai" page="home"><p>Hello world</p></div>`;
        const LIST = HHStoredVarPrefixKey + "Temp_eventsList";
        const GONE = HHStoredVarPrefixKey + "Temp_eventsGone";
        const NAV = HHStoredVarPrefixKey + "Temp_lastNavTarget";
        const sm = (end: number) => `{"sm_event_49":{"id":"sm_event_49","type":"sultryMysteries","seconds_before_end":${end},"next_refresh":${end},"isCompleted":false}}`;

        // The widget markup as measured on home.html.
        function home(tabs: string[] | null) {
            document.body.innerHTML = HOME_START + `<div id="contains_all"><div id="homepage">`
                + (tabs === null ? `` : `<div class="event-widget special-fullscreen-view" rel="event_widget"><div class="event-thumbnail"><div class="event-timer bar-wrapper">`
                    + tabs.map(t => `<a class="over" rel="${t.replace(/_\d+$/, '')}" href="/event.html?tab=${t}"><p>Name</p>`
                        + `<div class="timer-box" data-type="x" data-ongoing="1" data-time="75996"></div></a>`).join('')
                    + `</div></div></div>`)
                + `</div></div>`;
        }

        beforeEach(() => {
            sessionStorage.removeItem(GONE);
            sessionStorage.removeItem(NAV);
        });

        it("the case from the report: an entry past its end is no Sultry Mysteries event any more", function () {
            sessionStorage.setItem(LIST, sm(pastTime));
            expect(EventModule.getEventIDsByType('sultryMysteries')).toEqual([]);
        });

        it("an entry the home page no longer shows is dropped there, whatever its stored end says", function () {
            sessionStorage.setItem(LIST, sm(nextTime));
            home(['legendary_contest_78']);
            EventModule.parsePageForEventId();
            expect(sessionStorage.getItem(LIST)).toBeNull();
            expect(EventModule.getEventIDsByType('sultryMysteries')).toEqual([]);
        });

        it("an entry the home page shows stays", function () {
            sessionStorage.setItem(LIST, sm(nextTime));
            home(['sm_event_49']);
            EventModule.parsePageForEventId();
            expect(EventModule.getEventIDsByType('sultryMysteries')).toEqual(['sm_event_49']);
        });

        it("a home page restored from the browser history decides nothing", function () {
            sessionStorage.setItem(LIST, sm(nextTime));
            home(['legendary_contest_78']);
            const spy = jest.spyOn(EventModule, 'pageFromHistory').mockReturnValue(true);
            EventModule.parsePageForEventId();
            spy.mockRestore();
            expect(EventModule.getEventIDsByType('sultryMysteries')).toEqual(['sm_event_49']);
        });

        it("a home page without the widget area decides nothing", function () {
            sessionStorage.setItem(LIST, sm(nextTime));
            home(null);
            EventModule.parsePageForEventId();
            expect(EventModule.getEventIDsByType('sultryMysteries')).toEqual(['sm_event_49']);
        });

        it("an expired entry is dropped on any page, not only on home", function () {
            sessionStorage.setItem(LIST, sm(pastTime));
            createEventTab('666');
            EventModule.parsePageForEventId();
            expect(sessionStorage.getItem(LIST)).toBeNull();
        });

        describe("the answer to a navigation", function () {
            const LOAD = (new Date('2020-03-01')).getTime();
            const asked = (tab: string) => sessionStorage.setItem(NAV, JSON.stringify({ page: 'event', tab, at: LOAD - 2000 }));

            afterEach(() => localStorage.removeItem(HHStoredVarPrefixKey + "Setting_sultryMysteriesAutoOpen"));

            it("sent back to home: the event is dropped, and the event page's list does not bring it back", function () {
                sessionStorage.setItem(LIST, sm(nextTime));
                asked('sm_event_49');
                home(['legendary_contest_78']);
                EventModule.checkNavigationAnswer(LOAD);
                expect(sessionStorage.getItem(LIST)).toBeNull();
                expect(sessionStorage.getItem(NAV)).toBeNull();

                localStorage.setItem(HHStoredVarPrefixKey + "Setting_sultryMysteriesAutoOpen", 'true');
                document.body.innerHTML = HTML_START + `<div id="contains_all"><div id="events"><div class="events-list">
                    <a class="event-title active" href="/event.html?tab=event_1">A</a>
                    <a class="event-title" href="/event.html?tab=sm_event_49">B</a></div></div></div>`;
                const { eventIDs } = EventModule.parsePageForEventId();
                expect(eventIDs).not.toContain('sm_event_49');
            });

            it("a wrong verdict: the home page still shows the event, so it counts again at once", function () {
                sessionStorage.setItem(LIST, `{"event_7":{"id":"event_7","type":"event","isMythic":false,"seconds_before_end":${nextTime},"next_refresh":${nextTime},"isCompleted":false}}`);
                asked('event_7');
                home(['event_7']);
                EventModule.checkNavigationAnswer(LOAD);
                expect(sessionStorage.getItem(GONE)).not.toBeNull();

                localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusEvent", 'true');
                const { eventIDs } = EventModule.parsePageForEventId();
                expect(eventIDs).toContain('event_7');
                expect(JSON.parse(sessionStorage.getItem(GONE) || '{}')).toEqual({});
            });

            it("served: nothing changes", function () {
                sessionStorage.setItem(LIST, sm(nextTime));
                asked('sm_event_49');
                createEventTab('666');
                EventModule.checkNavigationAnswer(LOAD);
                expect(EventModule.getEventIDsByType('sultryMysteries')).toEqual(['sm_event_49']);
                expect(sessionStorage.getItem(GONE)).toBeNull();
            });

            it("an event page that shows a refused id again lifts the refusal", function () {
                sessionStorage.setItem(GONE, JSON.stringify({ event_666: LOAD }));
                createEventTab('666');
                localStorage.setItem(HHStoredVarPrefixKey + "Setting_plusEvent", 'true');
                const { eventIDs } = EventModule.parsePageForEventId();
                expect(eventIDs).toContain('event_666');
            });
        });
    });

    describe("boss bang timer cleanup on the home page", function () {
        // The home page is what carries the event widgets; parsePageForEventId
        // only evaluates the widget queries there.
        const HOME_START = `<!DOCTYPE html><div id="hh_hentai" page="home"><p>Hello world</p></div>`;

        function homeWithBossBang(present: boolean) {
            document.body.innerHTML = HOME_START
                + `<div id="contains_all"><div id="homepage"><div class="event-widget">`
                + (present ? `<a rel="boss_bang_event" href="/event.html?tab=boss_bang_event_5"><span>Boss Bang</span></a>` : ``)
                + `</div></div></div>`;
        }

        it("clears nextBossBangTime once the event widget is gone", function () {
            homeWithBossBang(false);
            setTimer('nextBossBangTime', 1);
            setTimer('eventBossBangGoing', 1);

            EventModule.parsePageForEventId();

            expect(getTimer('nextBossBangTime')).toEqual(-1);
            expect(getTimer('eventBossBangGoing')).toEqual(-1);
        });

        it("leaves the DP, Lively Scene and seasonal collect switches on when their banners are gone", function () {
            homeWithBossBang(false);
            const keys = ['Setting_autodpEventCollect', 'Setting_autoLivelySceneEventCollect',
                'Setting_autoSeasonalEventCollect', 'Setting_autoSeasonalEventCollectAll'];
            keys.forEach(key => localStorage.setItem(HHStoredVarPrefixKey + key, 'true'));

            EventModule.parsePageForEventId();

            keys.forEach(key => expect(localStorage.getItem(HHStoredVarPrefixKey + key)).toEqual('true'));
        });

        it("keeps the timers while the event is still running", function () {
            homeWithBossBang(true);
            setTimer('nextBossBangTime', 3600);
            setTimer('eventBossBangGoing', 3600);

            EventModule.parsePageForEventId();

            expect(getTimer('nextBossBangTime')).not.toEqual(-1);
            expect(getTimer('eventBossBangGoing')).not.toEqual(-1);
        });

        it("leaves the PoV/PoG/Seasonal collect-all timers alone -- their own block re-arms them", function () {
            homeWithBossBang(false);
            setTimer('nextPoVCollectAllTime', 1);
            setTimer('nextPoGCollectAllTime', 1);
            setTimer('nextSeasonalEventCollectAllTime', 1);

            EventModule.parsePageForEventId();

            expect(getTimer('nextPoVCollectAllTime')).not.toEqual(-1);
            expect(getTimer('nextPoGCollectAllTime')).not.toEqual(-1);
            expect(getTimer('nextSeasonalEventCollectAllTime')).not.toEqual(-1);
        });
    });

});