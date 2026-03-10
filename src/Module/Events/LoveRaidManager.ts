// LoveRaidManager.ts -- Love Raid event: manages raids and tracks girl shards.
//
// Love Raids are cooperative events where players raid together for girl shard
// rewards. This module manages raid participation, tracks collected shards,
// monitors raid timers, and handles the event page interactions.
//
// Depends on: EventModule.ts (event detection and routing)
// Used by: EventModule.ts (called when Love Raid event is active)
//
import {
    checkTimer,
    ConfigHelper,
    getPage,
    getStoredValue,
    getStoredJSON,
    randomInterval,
    setStoredValue,
    setTimer,
    getTextForUI,
    getTimeLeft,
    clearTimer} from "../../Helper/index";
    import { gotoPage } from "../../Service/index";
    import { isJSON, logHHAuto } from "../../Utils/index";
import { HHStoredVarPrefixKey, SK, TK } from "../../config/index";
import { EventGirl } from "../../model/EventGirl";
import { LoveRaid } from "../../model/LoveRaid";
import { KKLoveRaid } from "../../model/index";

export class LoveRaidManager {
    static parse() {
        if (getPage() === ConfigHelper.getHHScriptVars("pagesIDLoveRaid")) {
            try{
                const raids: LoveRaid[] = LoveRaidManager.parseRaids();
                LoveRaidManager.saveLoveRaids(raids);

                const firstEndingRaid = LoveRaidManager.getFirstEndingRaid(raids);
                const firstRaidToStart = LoveRaidManager.getFirstRaidToStart();
                const nextEndingRaidInSeconds = firstEndingRaid ? firstEndingRaid.seconds_until_event_end : Number.MAX_VALUE;
                const nextRaidStartInSeconds = firstRaidToStart ? firstRaidToStart.seconds_until_event_start : Number.MAX_VALUE;
                const nextTime = Math.min(nextEndingRaidInSeconds, nextRaidStartInSeconds);

                if (nextTime !== Number.MAX_VALUE && !Number.isNaN(nextTime)) {
                    setTimer('nextLoveRaidTime', nextTime + randomInterval(10, 300));
                } else {
                    setTimer('nextLoveRaidTime', randomInterval(3600, 4000));
                }
            } catch ({ errName, message }) {
                logHHAuto(`ERROR during Love raid run: ${message}, retry in 1h`);
                setTimer('nextLoveRaidTime', randomInterval(3600, 4000));
                return false;
            }
        }
        else {
            logHHAuto("Switching to Love raid screen.");
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDLoveRaid"));
            return true;
        }
    }
    static getFirstEndingRaid(raids: LoveRaid[]): LoveRaid | null {
        return raids.sort((a, b) => (a.seconds_until_event_end - b.seconds_until_event_end))[0] || null;
    }
    static getAllRaids(): LoveRaid[] {
        let raids: LoveRaid[] = getStoredJSON(HHStoredVarPrefixKey + TK.loveRaids, []);
        return raids;
    }
    static getTrollRaids(): LoveRaid[]{
        return LoveRaidManager.getAllRaids().filter(raid => raid.trollId !== undefined);
    }
    static getChampionRaids(): LoveRaid[] {
        return LoveRaidManager.getAllRaids().filter(raid => raid.championId !== undefined);
    }
    static getSeasonRaids(): LoveRaid[] {
        return LoveRaidManager.getAllRaids().filter(raid => raid.raid_module_type === 'season');
    }
    static saveLoveRaids(raids: LoveRaid[]){
        setStoredValue(HHStoredVarPrefixKey + TK.loveRaids, JSON.stringify(raids));
    }

    static getRaidToFight(raids: LoveRaid[]=[], logging=false): LoveRaid | undefined {
        if(!raids || raids.length === 0) {
            raids = LoveRaidManager.getTrollRaids();
        }
        let raid: LoveRaid | undefined = undefined;

        let autoRaidSelectedIndex = getStoredValue(HHStoredVarPrefixKey + SK.autoLoveRaidSelectedIndex);
        if (autoRaidSelectedIndex === undefined || autoRaidSelectedIndex === '') {
            autoRaidSelectedIndex = 0;
        } else if(autoRaidSelectedIndex != 0) {
            const autoRaidSelectedIndexArray = autoRaidSelectedIndex.split('_');
            if (autoRaidSelectedIndexArray.length !== 2) {
                if (logging) logHHAuto('Saved raid index is malformed, resetting to default');
                autoRaidSelectedIndex = 0;
            } else {
                autoRaidSelectedIndex = Number(autoRaidSelectedIndexArray[0]);
                raid = raids.find(raid => raid.trollId === autoRaidSelectedIndex);
                if (!raid || raid.id_girl != autoRaidSelectedIndexArray[1]) {
                    if (logging) logHHAuto('Saved raid is no longer valid or new girl, resetting to default');
                    autoRaidSelectedIndex = 0;
                }
            }
        }
        if (logging && raid) {
            logHHAuto(`LoveRaid troll fight: ${raid.trollId} selected  with girl ${raid.id_girl} to win`);
        }

        if (autoRaidSelectedIndex == 0) {
            const raidWithGirls = raids.filter(raid => raid.girl_shards < 100);
            if (raidWithGirls.length > 0) {
                raid = raidWithGirls[0];
            } else raid = raids[0];

            if (logging) {
                if (raidWithGirls) {
                    logHHAuto(`LoveRaid troll fight: ${raid.trollId} with girl ${raid.id_girl} to win`);
                } else {
                    logHHAuto(`LoveRaid troll fight: ${raid.trollId} with skin for girl ${raid.id_girl} to win`);
                }
            }
        }

        return raid;
    }
    static parseRaids(raidNotStarted = false): LoveRaid[] {
        const debugEnabled = getStoredValue(HHStoredVarPrefixKey + TK.Debug) === 'true';
        const raids: LoveRaid[] = [];
        const kkRaids: KKLoveRaid[] = love_raids != undefined ? love_raids : [];

        for (let index = 0; index < kkRaids.length; index++) {
            const kkRaid = kkRaids[index];
            try {
                if ((kkRaid.status == 'ongoing' && !raidNotStarted) || (raidNotStarted && kkRaid.status == 'upcoming')) {
                    if (debugEnabled) logHHAuto(`parsing raid ${kkRaid.status} ${kkRaid.event_name} module ${kkRaid.raid_module_type}`);
                    if (kkRaid.all_is_owned == true) {
                        if (debugEnabled) logHHAuto(`nothing to win, ignoring raid`);
                        continue;
                    }
                    const raid: LoveRaid = new LoveRaid();
                    raid.id_girl = Number(kkRaid.id_girl);
                    raid.girl_shards = Number(kkRaid.girl_data?.shards);
                    raid.girl_to_win = kkRaid.girl_data?.shards < 100;
                    if (debugEnabled && kkRaid.girl_data?.shards >= 100) {
                        logHHAuto(`Girl won, may have skin to win, ignore for now`);
                    }
                    raid.event_name = (kkRaid.girl_data?.name || kkRaid.event_name || kkRaid.id_girl) + ' ' + (kkRaid.girl_data?.Graded || '');
                    raid.raid_module_type = kkRaid.raid_module_type;
                    raid.seconds_until_event_end = Number(kkRaid.seconds_until_event_end);
                    raid.seconds_until_event_start = Number(kkRaid.seconds_until_event_start);
                    raid.event_duration_seconds = Number(kkRaid.event_duration_seconds);
                    raid.start_datetime = kkRaid.start_datetime;
                    raid.end_datetime = kkRaid.end_datetime;
                    raid.shards_left = Number(kkRaid.tranche_data.shards_left);

                    if (kkRaid.status == 'ongoing' && (kkRaid.girl_data?.source?.anchor_source?.disabled || kkRaid.girl_data?.source?.anchor_win_from?.disabled)) {
                        logHHAuto(`Raid source not yet available, ignoring raid (${kkRaid.girl_data?.source?.sentence})`);
                        continue;
                    }

                    if ($('.raid-card')[index].classList.contains('multiple-girl')) {
                        let girlSkinShards = parseInt($($($('.raid-card')[index].getElementsByClassName('shards'))[1]).attr('skins-shard'), 10);
                        raid.skin_to_win = girlSkinShards < 33;
                        raid.girl_skin_shards = girlSkinShards; // owned
                    }

                    switch (kkRaid.raid_module_type) {
                        case 'troll':
                            raid.trollId = Number(kkRaid.raid_module_pk);
                            break;
                        case 'champion':
                            raid.championId = Number(kkRaid.raid_module_pk);
                            break;
                        case 'season':
                            // Find ongoing season raid, clear nextSeasonTime timer
                            if (kkRaid.status == 'ongoing' && raid.shards_left > 0 && !checkTimer('nextSeasonTime')) clearTimer('nextSeasonTime');
                            break;
                        default:
                            if (debugEnabled) logHHAuto('Unknown raid type, ingoring raid');
                            continue;
                    }

                    raids.push(raid);
                }
            } catch (error) {
                logHHAuto('Error parsing raid', kkRaid, error);
            }
        }
        // console.log('raids', raids);
        // Sort by troll Id
        // raids.sort((a, b) => {
        //     return Number(a.trollId) - Number(b.trollId);
        // });
        // console.log('raids sorted', raids);

        return raids;
    }
    static getFirstRaidToStart(): LoveRaid | undefined {
        const raids: LoveRaid[] = LoveRaidManager.parseRaids(true);
        return raids.length > 0 ? raids.sort((a, b) => (a.seconds_until_event_start - b.seconds_until_event_start))[0] : undefined;
    }
    static getRaidGirls(): EventGirl[]{
        let raidsGirls: EventGirl[] = getStoredJSON(HHStoredVarPrefixKey + TK.raidGirls, []);
        return raidsGirls;
    }
    static isEnabled(){
        return ConfigHelper.getHHScriptVars("isEnabledRaidOfLive", false);// && HeroHelper.getLevel() >= ConfigHelper.getHHScriptVars("LEVEL_MIN_POG");
    }
    static isActivated(){
        return LoveRaidManager.isEnabled() && getStoredValue(HHStoredVarPrefixKey + SK.plusLoveRaid) === "true";
    }
    static styles(){
        $('.love-raids-container').removeClass('height-for-ad');
    }

    static getPinfo() {
        return '<li>' + getTextForUI("loveRaidTitle", "elementText") + ' : ' + getTimeLeft('nextLoveRaidTime') + '</li>';
    }
}