// Model representing a girl obtainable during an in-game event.
// Wraps the raw KKEventGirl API data and extracts the girl ID, troll/champion
// association, shard count, event timing, and mythic status.

import { queryStringGetParam } from "../Helper/UrlHelper";
import { logHHAuto } from "../Utils/LogUtils";
import { KKEventGirl } from "./index";

export class EventGirl {
    girl_id: number;
    troll_id: number;
    champ_id: number;
    shards: number;
    seconds_before_end: number;
    is_mythic: boolean;
    name: string = '';
    event_id: string = '';

    constructor(girlData: KKEventGirl, eventId: string, seconds_before_end: number, is_mythic=false, parseSource: boolean = true) {
        this.girl_id = girlData.id_girl;
        this.shards = girlData.shards;
        this.seconds_before_end = seconds_before_end;
        this.is_mythic = is_mythic;
        this.name = girlData.name;
        this.event_id = eventId;
        if (parseSource) {
            this.parseSource(girlData);
        }
    }
    /*
    constructor(girl_id: number, troll_id: number, champ_id: number, girl_shards: number, girl_name: string, event_id: string, is_mythic: boolean = false) {
        this.girl_id = girl_id;
        this.troll_id = troll_id;
        this.champ_id = champ_id;
        this.girl_shards = girl_shards;
        this.is_mythic = is_mythic;
        this.girl_name = girl_name;
        this.event_id = event_id;
    }*/

    isOnTroll() : boolean {
        return this.troll_id > 0;
    }

    isOnChampion() : boolean {
        return this.champ_id > 0;
    }

    toString(): string {
        if (this.isOnTroll()) {
            return `Event girl : ${this.name} (${this.shards}/100) at troll ${this.troll_id} on event : ${this.event_id}`;
        } else if (this.isOnChampion()) {
            return `Event girl : ${this.name} (${this.shards}/100) at champ ${this.champ_id} on event : ${this.event_id}`;
        }
        return `Event girl : ${this.name} (${this.shards}/100) on event : ${this.event_id}`;
    }

    parseSource(girlData: KKEventGirl){
        if (girlData.source) {
            if (girlData.source.name === 'event_troll') {
                try {
                    let parsedURL = new URL(girlData.source.anchor_source.url, window.location.origin);
                    this.troll_id = Number(queryStringGetParam(parsedURL.search, 'id_opponent'));
                    if (girlData.source.anchor_source.disabled) {
                        logHHAuto(`Troll ${this.troll_id} is not available for ${this.is_mythic ? 'mythic ' : ''}girl ${this.name} (${this.girl_id}) ignoring`);
                        this.troll_id = undefined;
                    }
                } catch (error) {
                    try {
                        let parsedURL = new URL(girlData.source.anchor_win_from[0].url, window.location.origin);
                        this.troll_id = Number(queryStringGetParam(parsedURL.search, 'id_opponent'));
                        if (girlData.source.anchor_win_from.disabled) {
                            logHHAuto(`Troll ${this.troll_id} is not available for ${this.is_mythic ? 'mythic ' : ''}girl ${this.name} (${this.girl_id}) ignoring`);
                            this.troll_id = undefined;
                        }
                    } catch (error) {
                        logHHAuto(`Can't get troll from girl ${this.name} (${this.girl_id})`);
                    }
                }
            } else if (girlData.source.name === 'event_champion_girl') {
                try {
                    this.champ_id = Number(girlData.source.anchor_source.url.split('/champions/')[1]);
                    if (girlData.source.anchor_source.disabled) {
                        logHHAuto(`Champion ${this.champ_id} is not available for ${this.is_mythic ? 'mythic ' : ''}girl ${this.name} (${this.girl_id}) ignoring`);
                        this.champ_id = undefined;
                    }
                } catch (error) {
                    try {
                        this.champ_id = Number(girlData.source.anchor_win_from[0].url.split('/champions/')[1]);
                        if (girlData.source.anchor_win_from.disabled) {
                            logHHAuto(`Champion ${this.champ_id} is not available for ${this.is_mythic ? 'mythic ' : ''}girl ${this.name} (${this.girl_id}) ignoring`);
                            this.champ_id = undefined;
                        }
                    } catch (error) {
                        logHHAuto(`Can't get champion from girl ${this.name} (${this.girl_id})`);
                    }
                }
            } else if (girlData.source.name === 'event_dm') {
                // Daily missions girl
            } else if (girlData.source.name === 'pachinko_event') {
                // pachinko event girl
            } else {
                logHHAuto(`Other source found ${girlData.source.name}`);
            }
        }
    }
}