import {
    HeroHelper,
    ConfigHelper,
    getHHVars,
    getStoredJSON,
    getStoredValue,
    setStoredValue,
    setTimer
} from '../Helper/index';
import { gotoPage } from '../Service/index';
import { isJSON, logHHAuto, onAjaxResponse } from '../Utils/index';
import { HHStoredVarPrefixKey, SK, TK } from '../config/index';
import { EventGirl } from '../model/EventGirl';
import { LoveRaid } from '../model/LoveRaid';
import { EventModule, LoveRaidManager } from './index';


const DEFAULT_BOOSTERS = {normal: [], mythic:[]};
const AUTO_EQUIP_ALLOWED_IDS = [183406, 4739, 1909];

export class Booster {
    static GINSENG_ROOT = {"id_item":"316","identifier":"B1","name":"Ginseng root", "rarity":"legendary"};
    static JUJUBES = {"id_item":"317","identifier":"B2","name":"Jujubes","rarity": "legendary"};
    static CHLORELLA = {"id_item":"318","identifier":"B3","name":"Chlorella","rarity": "legendary"};
    static CURDYCEPS = {"id_item":"319","identifier":"B4","name":"Cordyceps","rarity": "legendary" };
    static SANDALWOOD_PERFUME = {"id_item":"632","identifier":"MB1","name":"Sandalwood perfume","rarity":"mythic"};
    
    //all following lines credit:Tom208 OCD script  
    static collectBoostersFromAjaxResponses () {
        onAjaxResponse(/(action|class)/, (response, opt, xhr, evt) => {
                setTimeout(async function() {
                    const boosterStatus = Booster.getBoosterFromStorage();

                    const searchParams = new URLSearchParams(opt.data)
                    const mappedParams = ['action', 'class', 'type', 'id_item', 'number_of_battles', 'battles_amount'].map(key => ({[key]: searchParams.get(key)})).reduce((a,b)=>Object.assign(a,b),{})
                    const {action, class: className, type, id_item, number_of_battles, battles_amount} = mappedParams
                    const {success, equipped_booster} = response

                    if (!success) {
                        return
                    }

                    if (action === 'market_equip_booster' && type === 'booster') {
                        const idItemParsed = parseInt(id_item || '')
                        //const isMythic = idItemParsed >= 632 && idItemParsed <= 638
                        const isMythic = idItemParsed >= 632

                        const boosterData = equipped_booster

                        if (boosterData) {
                            const clonedData = {...boosterData}

                            if (isMythic) {
                                boosterStatus.mythic.push(clonedData)
                            } else {
                                boosterStatus.normal.push({...clonedData, endAt: clonedData.lifetime})
                            }

                            setStoredValue(HHStoredVarPrefixKey+TK.boosterStatus, JSON.stringify(boosterStatus));
                            //$(document).trigger('boosters:equipped', {id_item, isMythic, new_id: clonedData.id_member_booster_equipped})
                        }
                        return
                    }

                    let mythicUpdated = false
                    let sandalwoodEnded = false;

                    let sandalwood, allMastery, leagueMastery, seasonMastery, headband, watch, cinnamon, perfume;
                    boosterStatus.mythic.forEach(booster => {
                        switch (booster.item.identifier){
                            case 'MB1':
                                sandalwood = booster;
                                break;
                                /*
                            case 'MB2':
                                allMastery = booster;
                                break;
                            case 'MB3':
                                headband = booster;
                                break;
                            case 'MB4':
                                watch = booster;
                                break;
                            case 'MB5':
                                cinnamon = booster;
                                break;
                            case 'MB7':
                                perfume = booster;
                                break;
                            case 'MB8':
                                leagueMastery = booster;
                                break;
                            case 'MB9':
                                seasonMastery = booster;
                                break;*/
                        }
                    })

                    if (sandalwood && action === 'do_battles_trolls') {
                        const isMultibattle = parseInt(number_of_battles||'') > 1
                        const {rewards} = response
                        if (rewards && rewards.data && rewards.data.shards) {
                            let drops = 0
                            rewards.data.shards.forEach(({previous_value, value}) => {
                                if (isMultibattle) {
                                    // Can't reliably determine how many drops, assume MD where each drop would be 1 shard.
                                    const shardsDropped = value - previous_value
                                    drops += Math.floor(shardsDropped/2)
                                } else {
                                    drops++
                                }
                            })
                            sandalwood.usages_remaining -= drops
                            mythicUpdated = true
                            sandalwoodEnded = sandalwood.usages_remaining <= 0;
                        }
                    }
/*
                    if (allMastery && (action === 'do_battles_leagues' || action === 'do_battles_seasons')) {
                        allMastery.usages_remaining -= parseInt(number_of_battles)
                        mythicUpdated = true
                    }

                    if (leagueMastery && (action === 'do_battles_leagues')) {
                        leagueMastery.usages_remaining -= parseInt(number_of_battles)
                        mythicUpdated = true
                    }

                    if (seasonMastery && (action === 'do_battles_seasons')) {
                        seasonMastery.usages_remaining -= parseInt(number_of_battles)
                        mythicUpdated = true
                    }

                    if (headband && (action === 'do_battles_pantheon' || action === 'do_battles_trolls')) {
                        headband.usages_remaining -= parseInt(number_of_battles)
                        mythicUpdated = true
                    }

                    if (watch && className === 'TeamBattle') {
                        watch.usages_remaining -= parseInt(battles_amount)
                        mythicUpdated = true
                    }

                    if (cinnamon && action === 'do_battles_seasons') {
                        cinnamon.usages_remaining -= parseInt(number_of_battles)
                        mythicUpdated = true
                    }

                    if (perfume && action === 'start' && className === 'TempPlaceOfPower') {
                        perfume.usages_remaining--
                        mythicUpdated = true
                    }
*/
                    boosterStatus.mythic = boosterStatus.mythic.filter(({usages_remaining}) => usages_remaining > 0)

                    setStoredValue(HHStoredVarPrefixKey+TK.boosterStatus, JSON.stringify(boosterStatus));

                    /*if (mythicUpdated) {
                        $(document).trigger('boosters:updated-mythic')
                    }*/

                    try{
                        if (sandalwood && mythicUpdated && sandalwoodEnded) {
                            const isMultibattle = parseInt(number_of_battles||'') > 1
                            logHHAuto("sandalwood may be ended need a new one");
                            const activatedMythic = getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythic) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythicSandalWood) === "true";
                            const activatedLoveRaid = getStoredValue(HHStoredVarPrefixKey + SK.plusLoveRaid) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventLoveRaidSandalWood) === "true";
                            if (activatedMythic && EventModule.getEventMythicGirl().is_mythic || activatedLoveRaid && LoveRaidManager.getRaidToFight().girl_to_win) {
                                if (isMultibattle) {
                                    // TODO go to market if sandalwood not ended, continue. If ended, buy a new one
                                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDShop"));
                                }
                            }
                        }
                    } catch(err) {
                        logHHAuto('Catch error during equip sandalwood for mythic' + err);
                    }
                }, 200);
        })
    }

    static needBoosterStatusFromStore() {
        const isMythicAutoSandalWood = getStoredValue(HHStoredVarPrefixKey+SK.plusEventMythicSandalWood) === "true";
        const isLoveRaidAutoSandalWood = getStoredValue(HHStoredVarPrefixKey+SK.plusEventLoveRaidSandalWood) === "true";
        const isLeagueWithBooster = getStoredValue(HHStoredVarPrefixKey+SK.autoLeaguesBoostedOnly) === "true";
        const isSeasonWithBooster = getStoredValue(HHStoredVarPrefixKey+SK.autoSeasonBoostedOnly) === "true";
        const isPantheonWithBooster = getStoredValue(HHStoredVarPrefixKey+SK.autoPantheonBoostedOnly) === "true";
        const isAutoEquipBoosters = getStoredValue(HHStoredVarPrefixKey+SK.autoEquipBoosters) === "true";
        return isLeagueWithBooster || isSeasonWithBooster || isPantheonWithBooster || isMythicAutoSandalWood || isLoveRaidAutoSandalWood || isAutoEquipBoosters;
    }

    static getBoosterFromStorage(){
        return getStoredJSON(HHStoredVarPrefixKey+TK.boosterStatus, DEFAULT_BOOSTERS);
    }

    static haveBoosterEquiped(boosterCode:string='') {
        const boosterStatus = Booster.getBoosterFromStorage();
        const serverNow = getHHVars('server_now_ts');
        if(boosterCode == '') {
            // have at least one
            return /*boosterStatus.mythic.length > 0 ||*/ boosterStatus.normal.some((booster) => booster.endAt > serverNow)
        }else {
            return boosterStatus.mythic.some((booster) => booster.item.identifier === boosterCode)
            || boosterStatus.normal.some((booster) => booster.item.identifier === boosterCode && booster.endAt > serverNow) 
        }
    }

    static collectBoostersFromMarket() {
        const activeSlots = $('#equiped .booster .slot:not(.empty):not(.mythic)').map((i, el)=> $(el).data('d')).toArray()
        const activeMythicSlots = $('#equiped .booster .slot:not(.empty).mythic').map((i, el)=> $(el).data('d')).toArray()

        const boosterStatus = {
            normal: activeSlots.map((data) => ({...data, endAt: getHHVars('server_now_ts') + data.expiration})),
            mythic: activeMythicSlots,
        }

        setStoredValue(HHStoredVarPrefixKey+TK.boosterStatus, JSON.stringify(boosterStatus));
    }

    static getBoosterByIdentifier(identifier: string): any {
        // Try to resolve from shop data first (site-specific id_item)
        const storeData = getStoredJSON(HHStoredVarPrefixKey + TK.storeContents, null);
        if (storeData && Array.isArray(storeData[1])) {
            const shopBooster = storeData[1].find(
                (b: any) => b.item && b.item.identifier === identifier && b.item.rarity === 'legendary'
            );
            if (shopBooster) {
                return {
                    id_item: shopBooster.item.id_item || shopBooster.id_item,
                    identifier: shopBooster.item.identifier,
                    name: shopBooster.item.name,
                    rarity: shopBooster.item.rarity
                };
            }
        }

        // Fallback to hardcoded defaults (HentaiHeroes IDs)
        switch (identifier) {
            case 'B1': return Booster.GINSENG_ROOT;
            case 'B2': return Booster.JUJUBES;
            case 'B3': return Booster.CHLORELLA;
            case 'B4': return Booster.CURDYCEPS;
            default: return null;
        }
    }

    static parseEquipSlotConfig(): string[] {
        const raw = getStoredValue(HHStoredVarPrefixKey + SK.autoEquipBoostersSlots) || "B1;B1;B2;B4";
        const normalized = raw.replace(/,/g, ';');
        const slots = normalized.split(';').map(s => s.trim().toUpperCase());
        if (slots.length < 1 || slots.length > 4 || !slots.every(s => /^B[1-4]$/.test(s))) {
            logHHAuto("Auto-equip booster config invalid: " + raw + ", falling back to B1;B1;B2;B4");
            return ['B1', 'B1', 'B2', 'B4'];
        }
        return slots;
    }

    static getBoostersToEquip(): string[] {
        const slotConfig = Booster.parseEquipSlotConfig();
        const boosterStatus = Booster.getBoosterFromStorage();
        const serverNow = getHHVars('server_now_ts');

        const activeBoosters = boosterStatus.normal.filter(
            (booster: any) => booster.endAt > serverNow
        );

        // All physical slots occupied — nothing can be equipped
        if (activeBoosters.length >= slotConfig.length) {
            return [];
        }

        const activeCountByIdentifier: Record<string, number> = {};
        activeBoosters.forEach((booster: any) => {
            const id = booster.item?.identifier;
            if (id) {
                activeCountByIdentifier[id] = (activeCountByIdentifier[id] || 0) + 1;
            }
        });

        const freeSlots = slotConfig.length - activeBoosters.length;
        const boostersToEquip: string[] = [];
        const remainingActive = { ...activeCountByIdentifier };

        for (const desiredId of slotConfig) {
            if ((remainingActive[desiredId] || 0) > 0) {
                remainingActive[desiredId]--;
            } else {
                boostersToEquip.push(desiredId);
            }
        }

        // Only return as many as there are free slots
        return boostersToEquip.slice(0, freeSlots);
    }

    static getShortestBoosterRemainingSeconds(): number {
        const slotConfig = Booster.parseEquipSlotConfig();
        const boosterStatus = Booster.getBoosterFromStorage();
        const serverNow = getHHVars('server_now_ts');

        const activeBoosters = boosterStatus.normal.filter(
            (booster: any) => booster.endAt > serverNow
        );

        if (activeBoosters.length === 0) return 0;

        // Find the shortest remaining time among active boosters matching our config
        let shortest = Infinity;
        for (const booster of activeBoosters) {
            const id = booster.item?.identifier;
            if (id && slotConfig.includes(id)) {
                const remaining = booster.endAt - serverNow;
                if (remaining < shortest) {
                    shortest = remaining;
                }
            }
        }

        return shortest === Infinity ? 0 : Math.max(0, Math.floor(shortest));
    }

    static isAutoEquipAllowed(): boolean {
        const playerId = HeroHelper.getPlayerId();
        return AUTO_EQUIP_ALLOWED_IDS.includes(playerId);
    }

    static async autoEquipBoosters(): Promise<boolean> {
        const isEnabled = getStoredValue(HHStoredVarPrefixKey + SK.autoEquipBoosters) === "true";
        if (!isEnabled) return false;
        if (!Booster.isAutoEquipAllowed()) return false;

        const boostersToEquip = Booster.getBoostersToEquip();
        if (boostersToEquip.length === 0) {
            // All slots filled – set timer to shortest remaining booster time + small buffer
            const shortestRemaining = Booster.getShortestBoosterRemainingSeconds();
            if (shortestRemaining > 0) {
                setTimer('nextAutoEquipBoosterTime', shortestRemaining + 10);
                logHHAuto("Auto-equip: All booster slots active. Next check in " + shortestRemaining + "s.");
            }
            return false;
        }

        logHHAuto("Auto-equip: Need to equip " + boostersToEquip.length + " booster(s): " + boostersToEquip.join(', '));

        const nextBoosterId = boostersToEquip[0];
        const boosterObj = Booster.getBoosterByIdentifier(nextBoosterId);
        if (!boosterObj) {
            logHHAuto("Auto-equip: Unknown booster identifier: " + nextBoosterId);
            setTimer('nextAutoEquipBoosterTime', 300); // retry in 5 min
            return false;
        }

        if (!HeroHelper.haveBoosterInInventory(boosterObj.identifier)) {
            logHHAuto("Auto-equip: " + boosterObj.name + " (" + boosterObj.identifier + ") not in inventory, skipping.");
            setTimer('nextAutoEquipBoosterTime', 900); // retry in 15 min
            return false;
        }

        const equipped = await HeroHelper.equipBooster(boosterObj);
        if (equipped) {
            logHHAuto("Auto-equip: Successfully equipped " + boosterObj.name);
            // Short timer to check if more boosters need equipping
            setTimer('nextAutoEquipBoosterTime', 30);
        } else {
            logHHAuto("Auto-equip: Failed to equip " + boosterObj.name + ". Slots may be full. Next retry in 30 min.");
            // Likely all slots are already full — long cooldown to prevent spam.
            // The booster status in storage is stale; force refresh next time we visit the market page.
            setTimer('nextAutoEquipBoosterTime', 1800); // retry in 30 min
        }
        return equipped;
    }

    static needSandalWoodEquipped(nextTrollChoosen: number, eventMythicGirl: EventGirl=null, loveRaid: LoveRaid=null): boolean {
        const activatedMythic = getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythic) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythicSandalWood) === "true";
        const activatedLoveRaid = getStoredValue(HHStoredVarPrefixKey + SK.plusLoveRaid) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventLoveRaidSandalWood) === "true";
        if(!activatedMythic && !activatedLoveRaid) {
            // if neither mythic nor love raid auto sandalwood is activated, no need to check
            return false;
        }

        let needForMythic = false, needForLoveRaid = false;
        if (activatedMythic) {
            if(!eventMythicGirl) {
                eventMythicGirl = EventModule.getEventMythicGirl();
            }
            needForMythic = Booster.needSandalWoodMythic(nextTrollChoosen, eventMythicGirl);

        }
        if(activatedLoveRaid) {
            if(!loveRaid) {
                loveRaid = LoveRaidManager.getRaidToFight();
            }
            needForLoveRaid = Booster.needSandalWoodLoveRaid(nextTrollChoosen, loveRaid);
        }
        
        
        return ((needForMythic || needForLoveRaid) && Booster.ownedSandalwoodAndNotEquiped());
    }

    static ownedSandalwoodAndNotEquiped(): boolean {
        const ownedSandalwood = HeroHelper.haveBoosterInInventory(Booster.SANDALWOOD_PERFUME.identifier);
        const equipedSandalwood = Booster.haveBoosterEquiped(Booster.SANDALWOOD_PERFUME.identifier);
        return ownedSandalwood && !equipedSandalwood;
    }

    static needSandalWoodMythic(nextTrollChoosen: number, eventMythicGirl: EventGirl = null): boolean {
        const activated = getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythic) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythicSandalWood) === "true";
        const correctTrollTargetted = eventMythicGirl.is_mythic && eventMythicGirl.troll_id == nextTrollChoosen;
        const remainingShards = Number(100 - Number(eventMythicGirl.shards));
        if (remainingShards <= 10) {
            logHHAuto(`Not equipping sandalwood for mythic, only ${remainingShards} shards remaining`);
        }

        return activated && correctTrollTargetted && remainingShards > 10;
    }
    static needSandalWoodLoveRaid(nextTrollChoosen: number, loveRaid: LoveRaid = null): boolean {
        const activated = getStoredValue(HHStoredVarPrefixKey + SK.plusLoveRaid) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventLoveRaidSandalWood) === "true";
        const correctTrollTargetted = loveRaid.girl_to_win && loveRaid.trollId == nextTrollChoosen;
        const remainingShards = Number(100 - Number(loveRaid.girl_shards));
        if(remainingShards <= 10) {
            logHHAuto(`Not equipping sandalwood for love raid, only ${remainingShards} shards remaining`);
        }

        return activated && correctTrollTargetted && remainingShards > 10;
    }

    static async equipeSandalWoodIfNeeded(nextTrollChoosen: number, setting: string = 'plusEventMythicSandalWood'): Promise<boolean> {
        const activatedMythic = getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythic) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythicSandalWood) === "true";
        const activatedLoveRaid = getStoredValue(HHStoredVarPrefixKey + SK.plusLoveRaid) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventLoveRaidSandalWood) === "true";
        let eventMythicGirl: EventGirl = null, loveRaid: LoveRaid = null;
        let needForMythic = false, needForLoveRaid = false;
        if (activatedMythic) {
            if (!eventMythicGirl) {
                eventMythicGirl = EventModule.getEventMythicGirl();
            }
            needForMythic = Booster.needSandalWoodMythic(nextTrollChoosen, eventMythicGirl);
        }
        if (activatedLoveRaid) {
            if (!loveRaid) {
                loveRaid = LoveRaidManager.getRaidToFight();
            }
            needForLoveRaid = Booster.needSandalWoodLoveRaid(nextTrollChoosen, loveRaid);
            if (needForLoveRaid && !needForMythic) {
                setting = 'plusEventLoveRaidSandalWood';
            }
        }
        try {
            if (((needForMythic || needForLoveRaid) && Booster.ownedSandalwoodAndNotEquiped())) {
                // Equip a new one
                const equiped: boolean = await HeroHelper.equipBooster(Booster.SANDALWOOD_PERFUME);
                if (!equiped) {
                    const numberFailure = HeroHelper.getSandalWoodEquipFailure();
                    if (numberFailure >= 3) {
                        logHHAuto("Failure when equip Sandalwood for mythic for the third time, deactivated auto sandalwood");
                        setStoredValue(HHStoredVarPrefixKey + "Setting_" + setting, 'false');

                    } else logHHAuto("Failure when equip Sandalwood for mythic");
                }
                return equiped;
            }
        } catch (error) {
            return Promise.resolve(false);
        }
        return Promise.resolve(false);
    }
}