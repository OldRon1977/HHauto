// PlusEvents.ts -- Plus Events: parsing and display for event overlay info.
//
// Plus Events are a category of events that overlay additional information
// and rewards on top of normal gameplay. This module parses event data,
// extracts girl shard progress and troll fight priorities, and displays
// event overlay information in the UI.
//
// Depends on: EventModule.ts (event detection and routing)
// Used by: EventModule.ts (called when Plus Events are active)
//
import { getStoredValue } from "../../Helper/StorageHelper";
import { convertTimeToInt, randomInterval } from "../../Helper/TimeHelper";
import { setTimer } from "../../Helper/TimerHelper";
import { logHHAuto } from "../../Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../../config/HHStoredVars";
import { SK, TK } from "../../config/StorageKeys";
import { EventGirl } from "../../model/EventGirl";
import { HHEvent, HHEventData, HHEventList } from "../../model/HHEvent";
import { KKEventGirl } from "../../model/KK/KKEventGirl";
import { EventModule } from "./EventModule";
import { GirlWithSkins, isStillWorthFighting } from "./GirlSkins.pure";

export class PlusEvent {
    static parse(hhEvent: HHEvent, eventList: HHEventList, hhEventData: HHEventData, eventsGirlz: EventGirl[], eventChamps: EventGirl[]) {
        const eventID = hhEvent.eventId;
        const Priority: string[] = (getStoredValue(HHStoredVarPrefixKey + SK.eventTrollOrder) || '').split(";");
        const refreshTimer = randomInterval(3600, 4000);

        const timeLeft = $('#contains_all #events .nc-panel .timer span[rel="expires"]').text();
        if (timeLeft !== undefined && timeLeft.length) {
            setTimer('eventGoing', Number(convertTimeToInt(timeLeft)));
        } else setTimer('eventGoing', refreshTimer);
        eventList[eventID] = {};
        eventList[eventID]["id"] = eventID;
        eventList[eventID]["type"] = hhEvent.eventType;
        eventList[eventID]["seconds_before_end"] = new Date().getTime() + Number(convertTimeToInt(timeLeft)) * 1000;
        eventList[eventID]["next_refresh"] = new Date().getTime() + refreshTimer * 1000;
        eventList[eventID]["isCompleted"] = true;
        const allEventGirlz = hhEventData ? hhEventData.girls as any[] : [];
        for (let currIndex = 0; currIndex < allEventGirlz.length; currIndex++) {
            const girlData: KKEventGirl = allEventGirlz[currIndex];
            // Same as the mythic path (#1842): an owned girl may still owe a
            // skin, and +Girl Skins says the user wants it.
            const wantsSkins = getStoredValue(HHStoredVarPrefixKey + SK.plusGirlSkins) === "true";
            if (isStillWorthFighting(girlData.shards, wantsSkins, girlData as unknown as GirlWithSkins)) {
                eventList[eventID]["isCompleted"] = false;
                const eventGirl = new EventGirl(girlData, eventID, eventList[eventID]["seconds_before_end"] as number);

                if (eventGirl.isOnTroll()) {
                    logHHAuto(`Event girl : ${eventGirl.toString()} with priority : ${Priority.indexOf('' + eventGirl.troll_id)}`, eventGirl);
                    eventsGirlz.push(eventGirl);
                }
                if (eventGirl.isOnChampion()) {
                    logHHAuto(`Event girl : ${eventGirl.toString()}`, eventGirl);
                    eventChamps.push(eventGirl);
                }
            }
        }
        if (eventList[eventID]["isCompleted"]) {
            EventModule.collectEventChestIfPossible();
        }
    }
}