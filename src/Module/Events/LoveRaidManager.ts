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
        // Backfill girlGrade for raids stored before v7.32.2
        // Old event_name format: "GirlName <Graded>" e.g. "Luna 5" or "Luna 3★"
        for (const raid of raids) {
            if (raid.girlGrade === undefined || raid.girlGrade === 0) {
                const trailingMatch = raid.event_name?.match(/(\d+)\s*★?\s*$/);
                const trailingNumber = trailingMatch ? Number(trailingMatch[1]) : 0;
                if (trailingNumber > 0) {
                    raid.girlGrade = trailingNumber;
                } else if (raid.isMythic) {
                    raid.girlGrade = 6;
                }
            }
        }
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

        const plusGirlSkins = getStoredValue(HHStoredVarPrefixKey + SK.plusGirlSkins) === "true";
        let raid: LoveRaid | undefined = undefined;

        let autoRaidSelectedIndex: string = getStoredValue(HHStoredVarPrefixKey + SK.autoLoveRaidSelectedIndex);
        logHHAuto(`getRaidToFight: selector="${autoRaidSelectedIndex}", raids=${raids.length}, raidIds=[${raids.map(r=>r.trollId+'_'+r.id_girl).join(',')}]`);
        if (autoRaidSelectedIndex === undefined || autoRaidSelectedIndex === '') {
            autoRaidSelectedIndex = '0';
        } else if(autoRaidSelectedIndex !== '0' && autoRaidSelectedIndex !== 'first') {
            const autoRaidSelectedIndexArray = autoRaidSelectedIndex.split('_');
            if (autoRaidSelectedIndexArray.length !== 2) {
                if (logging) logHHAuto('Saved raid index is malformed, resetting to default');
                autoRaidSelectedIndex = '0';
            } else {
                const selectedTrollId = Number(autoRaidSelectedIndexArray[0]);
                const selectedGirlId = autoRaidSelectedIndexArray[1];
                raid = raids.find(raid => raid.trollId === selectedTrollId && String(raid.id_girl) === selectedGirlId);
                if (!raid) {
                    // Girl not in this filtered list — check ALL troll raids before resetting
                    const allRaids = LoveRaidManager.getTrollRaids();
                    const existsElsewhere = allRaids.find(r => r.trollId === selectedTrollId && String(r.id_girl) === selectedGirlId);
                    if (!existsElsewhere) {
                        if (logging) logHHAuto('Saved raid is no longer valid, resetting to default');
                        autoRaidSelectedIndex = '0';
                    } else {
                        if (logging) logHHAuto('Selected raid girl not in this filtered list, skipping (not resetting)');
                    }
                }
            }
        }

        // Check if selected raid's girl is done (shards complete + skins done or not wanted)
        if (raid && raid.girl_shards >= 100) {
            const skinsDone = !raid.skin_to_win;
            if (!plusGirlSkins || skinsDone) {
                if (logging) logHHAuto(`Raid girl ${raid.id_girl} completed (shards: ${raid.girl_shards}, skins done: ${skinsDone}, +Girl Skins: ${plusGirlSkins}), resetting selector`);
                setStoredValue(HHStoredVarPrefixKey + SK.autoLoveRaidSelectedIndex, "0");
                autoRaidSelectedIndex = '0';
                raid = undefined;
            } else {
                if (logging) logHHAuto(`Raid girl ${raid.id_girl} won but still has skins to collect (+Girl Skins ON)`);
            }
        }

        if (logging && raid) {
            logHHAuto(`LoveRaid troll fight: ${raid.trollId} selected with girl ${raid.id_girl} to win`);
        }

        // "first" = First ending raid (old default behavior)
        if (autoRaidSelectedIndex === 'first') {
            const raidWithGirls = raids.filter(raid => raid.girl_shards < 100);
            if (raidWithGirls.length > 0) {
                raid = raidWithGirls[0];
            } else if (plusGirlSkins) {
                raid = raids.find(r => r.skin_to_win) || undefined;
            }
            if (logging && raid) {
                logHHAuto(`LoveRaid first ending raid: troll ${raid.trollId} with girl ${raid.id_girl}`);
            }
        }

        // Default "Choose a girl" (0) = no automatic fight
        if (autoRaidSelectedIndex === '0') {
            if (logging) logHHAuto('Raid selector is "Choose a girl" — no automatic raid fight');
            raid = undefined;
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
                    // nb_grades = number of star slots (3=rare, 5=legendary, 6=mythic)
                    // Graded is a string of star symbols (e.g. "☆☆☆"), graded = completed awakenings
                    raid.girlGrade = Number(kkRaid.girl_data?.nb_grades) || 0;
                    raid.isMythic = kkRaid.girl_data?.rarity === 'mythic' || raid.girlGrade >= 6;
                    raid.event_name = (kkRaid.girl_data?.name || kkRaid.event_name || kkRaid.id_girl) + ' ' + raid.girlGrade + '★';
                    raid.raid_module_type = kkRaid.raid_module_type;
                    raid.seconds_until_event_end = Number(kkRaid.seconds_until_event_end);
                    raid.seconds_until_event_start = Number(kkRaid.seconds_until_event_start);
                    raid.event_duration_seconds = Number(kkRaid.event_duration_seconds);
                    raid.start_datetime = kkRaid.start_datetime;
                    raid.end_datetime = kkRaid.end_datetime;
                    raid.shards_left = Number(kkRaid.tranche_data.shards_left);

                    if (kkRaid.status == 'ongoing' && (kkRaid.girl_data?.source?.anchor_source?.disabled || kkRaid.girl_data?.source?.anchor_win_from?.disabled)) {
                        logHHAuto(`Raid source display disabled, still parsing raid (${kkRaid.girl_data?.source?.sentence})`);
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
    /**
     * Returns the +Raid Stars selection. Stored as string:
     * "off" = disabled, "exact3" = only 3★, "min3" = 3★ and up, "exact5" = only 5★.
     */
    static getRaidStarsSelection(): string {
        if (!LoveRaidManager.isEnabled()) return "off";
        const val = getStoredValue(HHStoredVarPrefixKey + SK.plusLoveRaidMythic);
        return val || "off";
    }
    static isRaidStarsActivated(): boolean {
        return LoveRaidManager.getRaidStarsSelection() !== "off";
    }
    /**
     * Filters raids according to the +Raid Stars selection.
     */
    static filterByRaidStars(raids: LoveRaid[]): LoveRaid[] {
        const selection = LoveRaidManager.getRaidStarsSelection();
        switch (selection) {
            case "exact3": return raids.filter(r => r.girlGrade === 3);
            case "min3":   return raids.filter(r => r.girlGrade >= 3);
            case "exact5": return raids.filter(r => r.girlGrade === 5);
            default:       return [];
        }
    }
    /**
     * Picks a raid for +Raid Stars. Independent from the +Raid "Raid selector"
     * dropdown: uses "first ending raid" logic (first raid in list with shards
     * left; when +Girl Skins is ON, falls back to first raid with skin to win).
     */
    static getRaidStarsRaidToFight(raids: LoveRaid[], logging = false): LoveRaid | undefined {
        if (!raids || raids.length === 0) return undefined;
        const plusGirlSkins = getStoredValue(HHStoredVarPrefixKey + SK.plusGirlSkins) === "true";
        let raid: LoveRaid | undefined = raids.find(r => r.girl_shards < 100);
        if (!raid && plusGirlSkins) {
            raid = raids.find(r => r.skin_to_win);
        }
        if (logging && raid) {
            logHHAuto(`+Raid Stars picked troll ${raid.trollId} with girl ${raid.id_girl} (grade ${raid.girlGrade})`);
        }
        return raid;
    }
    static isAnyActivated(){
        return LoveRaidManager.isActivated() || LoveRaidManager.isRaidStarsActivated();
    }
    static styles(){
        $('.love-raids-container').removeClass('height-for-ad');
    }

    static getPinfo() {
        return '<li>' + getTextForUI("loveRaidTitle", "elementText") + ' : ' + getTimeLeft('nextLoveRaidTime') + '</li>';
    }
}