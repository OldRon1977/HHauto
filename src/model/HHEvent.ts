// Types around the in-game events: HHEvent as returned by EventModule.getEvent()
// (the event type, a flag per supported event kind, and isEnabled), the stored
// event list, and the event data the event page carries.

import { KKEventGirl } from "./KK/KKEventGirl";

/** Return type of EventModule.getEvent() */
export interface HHEvent {
    eventTypeKnown: boolean;
    eventId: string;
    eventType: string;
    isPlusEvent: boolean;
    isPlusEventMythic: boolean;
    isBossBangEvent: boolean;
    isSultryMysteriesEvent: boolean;
    isDPEvent: boolean;
    isLivelyScene: boolean;
    isPoa: boolean;
    isCumback: boolean;
    isKinky: boolean;
    isEnabled: boolean;
}

/** Stored event list: eventID → event details */
export type HHEventList = Record<string, Record<string, unknown>>;

/** Event data from unsafeWindow.event_data or unsafeWindow.current_event */
export interface HHEventData {
    girls?: KKEventGirl[];
    event_name?: string;
    [key: string]: unknown;
}
