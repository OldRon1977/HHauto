import {
    HeroHelper,
    ConfigHelper,
    checkTimer,
    getHHVars,
    getStoredValue,
    setStoredValue,
    setTimer
} from '../Helper/index';
import { gotoPage } from '../Service/index';
import { isJSON, logHHAuto, onAjaxResponse } from '../Utils/index';
import { HHStoredVarPrefixKey } from '../config/index';
import { EventGirl } from '../model/EventGirl';
import { LoveRaid } from '../model/LoveRaid';
import { EventModule, LoveRaidManager } from './index';


const DEFAULT_BOOSTERS = {normal: [], mythic:[]};

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

                            setStoredValue(HHStoredVarPrefixKey+'Temp_boosterStatus', JSON.stringify(boosterStatus));
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

                    setStoredValue(HHStoredVarPrefixKey+'Temp_boosterStatus', JSON.stringify(boosterStatus));

                    /*if (mythicUpdated) {
                        $(document).trigger('boosters:updated-mythic')
                    }*/

                    try{
                        if (sandalwood && mythicUpdated && sandalwoodEnded) {
                            const isMultibattle = parseInt(number_of_battles||'') > 1
                            logHHAuto("sandalwood may be ended need a new one");
                            const activatedMythic = getStoredValue(HHStoredVarPrefixKey + "Setting_plusEventMythic") === "true" && getStoredValue(HHStoredVarPrefixKey + "Setting_plusEventMythicSandalWood") === "true";
                            const activatedLoveRaid = getStoredValue(HHStoredVarPrefixKey + "Setting_plusLoveRaid") === "true" && getStoredValue(HHStoredVarPrefixKey + "Setting_plusEventLoveRaidSandalWood") === "true";
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
        const isMythicAutoSandalWood = getStoredValue(HHStoredVarPrefixKey+"Setting_plusEventMythicSandalWood") === "true";
        const isLoveRaidAutoSandalWood = getStoredValue(HHStoredVarPrefixKey+"Setting_plusEventLoveRaidSandalWood") === "true";
        const isLeagueWithBooster = getStoredValue(HHStoredVarPrefixKey+"Setting_autoLeaguesBoostedOnly") === "true";
        const isSeasonWithBooster = getStoredValue(HHStoredVarPrefixKey+"Setting_autoSeasonBoostedOnly") === "true";
        const isPantheonWithBooster = getStoredValue(HHStoredVarPrefixKey+"Setting_autoPantheonBoostedOnly") === "true";
        return isLeagueWithBooster || isSeasonWithBooster || isPantheonWithBooster || isMythicAutoSandalWood || isLoveRaidAutoSandalWood;
    }

    static getBoosterFromStorage(){
        return isJSON(getStoredValue(HHStoredVarPrefixKey+"Temp_boosterStatus"))?JSON.parse(getStoredValue(HHStoredVarPrefixKey+"Temp_boosterStatus")):DEFAULT_BOOSTERS;
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

        logHHAuto(`collectBoostersFromMarket: found ${activeSlots.length} normal boosters, ${activeMythicSlots.length} mythic boosters equipped`);

        const boosterStatus = {
            normal: activeSlots.map((data) => ({...data, endAt: getHHVars('server_now_ts') + data.expiration})),
            mythic: activeMythicSlots,
        }

        setStoredValue(HHStoredVarPrefixKey+'Temp_boosterStatus', JSON.stringify(boosterStatus));
    }

    static needSandalWoodEquipped(nextTrollChoosen: number, eventMythicGirl: EventGirl=null, loveRaid: LoveRaid=null): boolean {
        const activatedMythic = getStoredValue(HHStoredVarPrefixKey + "Setting_plusEventMythic") === "true" && getStoredValue(HHStoredVarPrefixKey + "Setting_plusEventMythicSandalWood") === "true";
        const activatedLoveRaid = getStoredValue(HHStoredVarPrefixKey + "Setting_plusLoveRaid") === "true" && getStoredValue(HHStoredVarPrefixKey + "Setting_plusEventLoveRaidSandalWood") === "true";
        if(!activatedMythic && !activatedLoveRaid) {
            // if neither mythic nor love raid auto sandalwood is activated, no need to check
            return false;
        }

        // Don't try to equip if we're on cooldown from a recent failure
        if (Booster.isEquipOnCooldown()) {
            logHHAuto("needSandalWoodEquipped: skipping - equip on cooldown");
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
        logHHAuto(`ownedSandalwoodAndNotEquiped: owned=${ownedSandalwood}, equipped=${equipedSandalwood}, result=${ownedSandalwood && !equipedSandalwood}`);
        return ownedSandalwood && !equipedSandalwood;
    }

    static isEquipOnCooldown(): boolean {
        return !checkTimer('nextBoosterEquipTime');
    }

    static setEquipCooldown(seconds: number = 5 * 60) {
        setTimer('nextBoosterEquipTime', seconds);
        logHHAuto(`Booster equip cooldown set for ${seconds} seconds`);
    }

    static markBoosterAsEquippedInStorage(booster: any) {
        const boosterStatus = Booster.getBoosterFromStorage();
        const isMythic = parseInt(booster.id_item) >= 632;

        if (isMythic) {
            const alreadyTracked = boosterStatus.mythic.some(b => b.item?.identifier === booster.identifier);
            if (!alreadyTracked) {
                boosterStatus.mythic.push({
                    item: booster,
                    usages_remaining: 99 // Unknown, will be refreshed on next market visit
                });
                setStoredValue(HHStoredVarPrefixKey+'Temp_boosterStatus', JSON.stringify(boosterStatus));
                logHHAuto('Marked ' + booster.name + ' as equipped in storage (server says already equipped)');
            }
        } else {
            const serverNow = getHHVars('server_now_ts');
            const alreadyTracked = boosterStatus.normal.some(b => b.item?.identifier === booster.identifier && b.endAt > serverNow);
            if (!alreadyTracked) {
                boosterStatus.normal.push({
                    item: booster,
                    endAt: serverNow + 8 * 3600 // Assume 8 hours remaining, refreshed on next market visit
                });
                setStoredValue(HHStoredVarPrefixKey+'Temp_boosterStatus', JSON.stringify(boosterStatus));
                logHHAuto('Marked ' + booster.name + ' as equipped in storage (server says already equipped)');
            }
        }
    }

    static needSandalWoodMythic(nextTrollChoosen: number, eventMythicGirl: EventGirl = null): boolean {
        const activated = getStoredValue(HHStoredVarPrefixKey + "Setting_plusEventMythic") === "true" && getStoredValue(HHStoredVarPrefixKey + "Setting_plusEventMythicSandalWood") === "true";
        const correctTrollTargetted = eventMythicGirl.is_mythic && eventMythicGirl.troll_id == nextTrollChoosen;
        const remainingShards = Number(100 - Number(eventMythicGirl.shards));
        if (remainingShards <= 10) {
            logHHAuto(`Not equipping sandalwood for mythic, only ${remainingShards} shards remaining`);
        }

        return activated && correctTrollTargetted && remainingShards > 10;
    }
    static needSandalWoodLoveRaid(nextTrollChoosen: number, loveRaid: LoveRaid = null): boolean {
        const activated = getStoredValue(HHStoredVarPrefixKey + "Setting_plusLoveRaid") === "true" && getStoredValue(HHStoredVarPrefixKey + "Setting_plusEventLoveRaidSandalWood") === "true";
        const correctTrollTargetted = loveRaid.girl_to_win && loveRaid.trollId == nextTrollChoosen;
        const remainingShards = Number(100 - Number(loveRaid.girl_shards));
        if(remainingShards <= 10) {
            logHHAuto(`Not equipping sandalwood for love raid, only ${remainingShards} shards remaining`);
        }

        return activated && correctTrollTargetted && remainingShards > 10;
    }

    static async equipeSandalWoodIfNeeded(nextTrollChoosen: number, setting: string = 'plusEventMythicSandalWood'): Promise<boolean> {
        logHHAuto(`equipeSandalWoodIfNeeded: called for troll ${nextTrollChoosen}, setting=${setting}`);
        const activatedMythic = getStoredValue(HHStoredVarPrefixKey + "Setting_plusEventMythic") === "true" && getStoredValue(HHStoredVarPrefixKey + "Setting_plusEventMythicSandalWood") === "true";
        const activatedLoveRaid = getStoredValue(HHStoredVarPrefixKey + "Setting_plusLoveRaid") === "true" && getStoredValue(HHStoredVarPrefixKey + "Setting_plusEventLoveRaidSandalWood") === "true";
        logHHAuto(`equipeSandalWoodIfNeeded: activatedMythic=${activatedMythic}, activatedLoveRaid=${activatedLoveRaid}`);
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
        logHHAuto(`equipeSandalWoodIfNeeded: needForMythic=${needForMythic}, needForLoveRaid=${needForLoveRaid}`);
        try {
            if (((needForMythic || needForLoveRaid) && Booster.ownedSandalwoodAndNotEquiped())) {
                // Check cooldown before attempting equip
                if (Booster.isEquipOnCooldown()) {
                    logHHAuto("equipeSandalWoodIfNeeded: on cooldown, skipping equip attempt");
                    return false;
                }
                // Equip a new one
                logHHAuto("equipeSandalWoodIfNeeded: calling HeroHelper.equipBooster(SANDALWOOD_PERFUME)");
                const equiped: boolean = await HeroHelper.equipBooster(Booster.SANDALWOOD_PERFUME);
                logHHAuto(`equipeSandalWoodIfNeeded: equipBooster returned ${equiped}`);
                if (!equiped) {
                    const numberFailure = HeroHelper.getSandalWoodEquipFailure();
                    logHHAuto(`equipeSandalWoodIfNeeded: failure #${numberFailure}`);
                    if (numberFailure >= 3) {
                        logHHAuto("equipeSandalWoodIfNeeded: 3rd failure, deactivating auto sandalwood setting=" + setting);
                        setStoredValue(HHStoredVarPrefixKey + "Setting_" + setting, 'false');
                    } else {
                        logHHAuto("equipeSandalWoodIfNeeded: marking as already equipped + setting cooldown");
                        // Server says max boosters equipped - mark it as equipped to prevent retries
                        Booster.markBoosterAsEquippedInStorage(Booster.SANDALWOOD_PERFUME);
                        // Set cooldown to prevent spamming equip attempts
                        Booster.setEquipCooldown(5 * 60);
                    }
                } else {
                    // Reset failure counter on success
                    logHHAuto("equipeSandalWoodIfNeeded: success, resetting failure counter");
                    setStoredValue(HHStoredVarPrefixKey + "Temp_sandalwoodFailure", 0);
                }
                return equiped;
            } else {
                logHHAuto(`equipeSandalWoodIfNeeded: conditions not met, no equip needed`);
            }
        } catch (error) {
            logHHAuto(`equipeSandalWoodIfNeeded: caught error: ${error}`);
            return Promise.resolve(false);
        }
        return Promise.resolve(false);
    }
}