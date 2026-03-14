// Interface describing an active in-game event as returned by EventModule.getEvent().
// Contains the event type, boolean flags for every supported event kind
// (plus event, boss bang, DP, etc.), timing, and associated girl data.

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
