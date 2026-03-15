// CumbackContests.ts -- Cumback Contest event handling and auto-collection.
//
// Cumback Contests are periodic events that reward returning players. This
// module parses event page data, tracks timer countdowns, and collects
// available rewards automatically.
//
// Depends on: EventModule.ts (event detection and routing)
// Used by: EventModule.ts (called when Cumback Contest event is active)
//
import { convertTimeToInt, randomInterval, setTimer } from "../../Helper/index";
import { HHEvent, HHEventData, HHEventList, KKEventGirl } from "../../model/index";

export class CumbackContests {
    static parse(hhEvent: HHEvent, eventList: HHEventList, hhEventData: HHEventData) {
        const eventID = hhEvent.eventId;
        let refreshTimer = randomInterval(3600, 4000);

        let timeLeft = $('#contains_all #events .nc-panel .timer span[rel="expires"]').text();
        if (timeLeft !== undefined && timeLeft.length) {
            setTimer('eventCumbackGoing', Number(convertTimeToInt(timeLeft)));
        } else setTimer('eventCumbackGoing', refreshTimer);
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