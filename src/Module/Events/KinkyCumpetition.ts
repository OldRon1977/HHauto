// KinkyCumpetition.ts -- Kinky Cumpetition event handling.
//
// Kinky Cumpetition is a periodic competitive event. This module parses event
// page data, tracks timer countdowns and girl reward progress, and manages
// the event refresh schedule.
//
// Depends on: EventModule.ts (event detection and routing)
// Used by: EventModule.ts (called when Kinky Cumpetition event is active)
//
import { convertTimeToInt, randomInterval, setTimer } from "../../Helper/index";
import { HHEvent, HHEventData, HHEventList, KKEventGirl } from "../../model/index";

export class KinkyCumpetition {
    static parse(hhEvent: HHEvent, eventList: HHEventList, hhEventData: HHEventData) {
        const eventID = hhEvent.eventId;
        let refreshTimer = randomInterval(3600, 4000);

        let timeLeft = $('#contains_all #events .nc-panel .timer span[rel="expires"]').text();
        if (timeLeft !== undefined && timeLeft.length) {
            setTimer('eventKinkyCumpetitionGoing', Number(convertTimeToInt(timeLeft)));
        } else setTimer('eventKinkyCumpetitionGoing', refreshTimer);
        eventList[eventID] = {};
        eventList[eventID]["id"] = eventID;
        eventList[eventID]["type"] = hhEvent.eventType;
        eventList[eventID]["seconds_before_end"] = new Date().getTime() + Number(convertTimeToInt(timeLeft)) * 1000;
        eventList[eventID]["next_refresh"] = new Date().getTime() + refreshTimer * 1000;
        eventList[eventID]["isCompleted"] = true;
        let allEventGirlz = hhEventData ? hhEventData.girls : [];
        for (let currIndex = 0; currIndex < allEventGirlz.length; currIndex++) {
            let girlData: KKEventGirl = allEventGirlz[currIndex];
            if (girlData.shards < 100) {
                eventList[eventID]["isCompleted"] = false;
            }
        }
    }
}