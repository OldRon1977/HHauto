/**
 * Booster.ts -- Manages combat booster items (normal and mythic).
 *
 * Boosters are temporary power-ups that improve fight outcomes. This module handles:
 *   - Tracking which boosters are currently equipped via AJAX interception
 *   - Scraping equipped booster slots from the market page as a fallback
 *   - Auto-equipping normal boosters from inventory based on a user-configured slot layout
 *   - Equipping Sandalwood Perfume (mythic booster) before troll fights when farming
 *     mythic event girls or love raid girls, to double shard drops
 *
 * Booster IDs are resolved exclusively from market data (shop visit). No hardcoded
 * fallback IDs are used. The script navigates to the market first to read and cache
 * the player's booster inventory before attempting to equip.
 *
 * Each game variant (HentaiHeroes, ComixHarem, PornstarHarem, etc.) runs on its own
 * hostname, so browser localStorage is already isolated per game. No special multi-game
 * handling is needed beyond ensuring market data is cached before equipping.
 *
 * Credit: AJAX-based booster tracking logic adapted from Tom208's OCD script.
 *
 * Related modules:
 *   - Market (Shop.ts) -- provides shop booster data used by getBoosterByIdentifier()
 *   - EventModule / LoveRaidManager -- supply event girl and love raid state for
 *     Sandalwood decisions
 *   - HeroHelper -- performs the actual AJAX call to equip a booster
 */
import {
    HeroHelper,
    ConfigHelper,
    checkTimer,
    getHHVars,
    getStoredJSON,
    getStoredValue,
    setStoredValue,
    setTimer,
    randomInterval
} from '../Helper/index';
import { gotoPage } from '../Service/index';
import { isJSON, logHHAuto, onAjaxResponse } from '../Utils/index';
import { HHStoredVarPrefixKey, SK, TK } from '../config/index';
import { EventGirl } from '../model/EventGirl';
import { LoveRaid } from '../model/LoveRaid';
import { EventModule, LoveRaidManager } from './index';


const DEFAULT_BOOSTERS = {normal: [], mythic:[]};

/**
 * Manages booster tracking, auto-equip, and Sandalwood Perfume logic for event farming.
 *
 * All methods are static. Booster state lives in browser storage, not on the class instance.
 */
export class Booster {
    /** Sandalwood identifier constant — id_item is resolved from market data or env config at runtime. */
    static SANDALWOOD_IDENTIFIER = "MB1";

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

        logHHAuto(`collectBoostersFromMarket: found ${activeSlots.length} normal boosters, ${activeMythicSlots.length} mythic boosters equipped`);

        const boosterStatus = {
            normal: activeSlots.map((data) => ({...data, endAt: getHHVars('server_now_ts') + data.expiration})),
            mythic: activeMythicSlots,
        }

        setStoredValue(HHStoredVarPrefixKey+TK.boosterStatus, JSON.stringify(boosterStatus));
    }

    /**
     * Checks whether booster data from a market visit is available in cache.
     * Both boosterIdMap (player inventory IDs) and haveBooster (inventory counts)
     * must be populated for auto-equip to work reliably.
     */
    static hasBoosterDataFromMarket(): boolean {
        const boosterIdMap = getStoredJSON(HHStoredVarPrefixKey + TK.boosterIdMap, null);
        const haveBooster = getStoredJSON(HHStoredVarPrefixKey + TK.haveBooster, null);
        return boosterIdMap !== null && haveBooster !== null;
    }

    /**
     * Resolves a booster by its identifier (e.g. "B1", "MB1") using cached market data.
     * Returns null if no market data is available — NO hardcoded fallback IDs.
     *
     * Resolution order:
     *   1. Shop merchant inventory (storeContents) — full item data from shop page
     *   2. Player booster inventory (boosterIdMap) — full item data from player inventory
     */
    static getBoosterByIdentifier(identifier: string): any {
        // Try to resolve from shop merchant inventory (storeContents)
        const storeData = getStoredJSON(HHStoredVarPrefixKey + TK.storeContents, null);
        if (storeData && Array.isArray(storeData[1])) {
            const shopBooster = storeData[1].find(
                (b: any) => b.item && b.item.identifier === identifier
            );
            if (shopBooster) {
                const resolved = {
                    id_item: shopBooster.item.id_item || shopBooster.id_item,
                    identifier: shopBooster.item.identifier,
                    name: shopBooster.item.name,
                    rarity: shopBooster.item.rarity
                };
                logHHAuto(`getBoosterByIdentifier: "${identifier}" resolved from storeContents → id_item=${resolved.id_item}, name=${resolved.name}`);
                return resolved;
            }
        }

        // Try to resolve from player's booster inventory (boosterIdMap — now stores full item data)
        const boosterIdMap = getStoredJSON(HHStoredVarPrefixKey + TK.boosterIdMap, {});
        const entry = boosterIdMap[identifier];
        if (entry) {
            // boosterIdMap now stores { id_item, identifier, name, rarity }
            if (typeof entry === 'object' && entry.id_item) {
                logHHAuto(`getBoosterByIdentifier: "${identifier}" resolved from boosterIdMap → id_item=${entry.id_item}, name=${entry.name}`);
                return { ...entry };
            }
            // Backward compat: old format stored just the id_item string
            if (typeof entry === 'string') {
                return { id_item: entry, identifier, name: identifier, rarity: 'legendary' };
            }
        }

        // No market data available — do NOT fall back to hardcoded IDs
        logHHAuto(`getBoosterByIdentifier: No market data for "${identifier}". Visit the market first.`);
        return null;
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

    /**
     * Returns the longest remaining time (in seconds) among the given active boosters.
     * If no activeBoosters are passed, reads from storage.
     */
    static getLongestBoosterRemainingSeconds(activeBoosters?: any[]): number {
        const now = Math.floor(Date.now() / 1000);
        if (!activeBoosters) {
            const boosterStatus = Booster.getBoosterFromStorage();
            activeBoosters = boosterStatus.normal.filter((b: any) => b.endAt > now);
        }
        if (activeBoosters.length === 0) return 0;

        let longest = 0;
        for (const booster of activeBoosters) {
            const remaining = booster.endAt - now;
            if (remaining > longest) longest = remaining;
        }
        return Math.max(0, Math.floor(longest));
    }

    /**
     * Generates a random delay between 5 minutes and 2 hours (in seconds).
     * Added to booster expiry time to make auto-equip timing look human.
     */
    static getRandomEquipDelay(): number {
        return randomInterval(5 * 60, 2 * 60 * 60);
    }

    /**
     * Schedules the next auto-equip check based on the longest-running active booster
     * plus a random delay (5 min - 2 h). If no boosters are active, schedules immediately
     * with just the random delay.
     */
    static scheduleNextEquipCheck(): void {
        const longestRemaining = Booster.getLongestBoosterRemainingSeconds();
        const randomDelay = Booster.getRandomEquipDelay();
        const totalDelay = longestRemaining + randomDelay;

        const delayMin = Math.floor(totalDelay / 60);
        logHHAuto("Auto-equip: Next check in " + delayMin + " min (booster expires in "
            + Math.floor(longestRemaining / 60) + " min + " + Math.floor(randomDelay / 60) + " min random delay).");
        setTimer('nextAutoEquipBoosterTime', totalDelay);
    }

    /**
     * Main auto-equip entry point. First ensures market data is cached (navigates to
     * market if needed). Then equips all configured boosters that are missing from
     * active slots. Schedules the next check based on the longest active booster + random delay.
     */
    static async autoEquipBoosters(): Promise<boolean> {
        // Debug: dump cached booster inventory data
        const cachedIdMap = getStoredJSON(HHStoredVarPrefixKey + TK.boosterIdMap, {});
        const cachedInventory = getStoredJSON(HHStoredVarPrefixKey + TK.haveBooster, {});
        logHHAuto("Auto-equip: Cached boosterIdMap = " + JSON.stringify(cachedIdMap));
        logHHAuto("Auto-equip: Cached haveBooster (qty) = " + JSON.stringify(cachedInventory));

        // Ensure we have booster data from the market before trying to equip
        if (!Booster.hasBoosterDataFromMarket()) {
            logHHAuto("Auto-equip: No booster data from market. Navigating to market first.");
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDShop"));
            return true; // Signal busy — the market visit will cache the data, next loop will equip
        }

        const boostersToEquip = Booster.getBoostersToEquip();
        if (boostersToEquip.length === 0) {
            logHHAuto("Auto-equip: All booster slots active.");
            Booster.scheduleNextEquipCheck();
            return false;
        }

        logHHAuto("Auto-equip: Need to equip " + boostersToEquip.length + " booster(s): " + boostersToEquip.join(', '));

        let anyEquipped = false;
        try {
            for (const nextBoosterId of boostersToEquip) {
                const boosterObj = Booster.getBoosterByIdentifier(nextBoosterId);
                if (!boosterObj) {
                    logHHAuto("Auto-equip: Could not resolve booster " + nextBoosterId + " from market data, skipping.");
                    continue;
                }

                if (!HeroHelper.haveBoosterInInventory(boosterObj.identifier)) {
                    logHHAuto("Auto-equip: " + boosterObj.name + " (" + boosterObj.identifier + ") not in inventory, skipping.");
                    continue;
                }

                const equipped = await HeroHelper.equipBooster(boosterObj);
                if (equipped) {
                    logHHAuto("Auto-equip: Successfully equipped " + boosterObj.name);
                    anyEquipped = true;
                } else {
                    logHHAuto("Auto-equip: Failed to equip " + boosterObj.name + ". Slot may be occupied.");
                    break;
                }
            }
        } catch (error) {
            logHHAuto("Auto-equip: Error during equip loop: " + error);
        } finally {
            // Always schedule next check, even on error
            Booster.scheduleNextEquipCheck();
        }
        return anyEquipped;
    }

    /**
     * Resolves the Sandalwood Perfume booster object from market data.
     * Returns null if market data is not available.
     */
    static getSandalwoodBooster(): any {
        return Booster.getBoosterByIdentifier(Booster.SANDALWOOD_IDENTIFIER);
    }

    static needSandalWoodEquipped(nextTrollChoosen: number, eventMythicGirl: EventGirl=null, loveRaid: LoveRaid=null): boolean {
        const activatedMythic = getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythic) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythicSandalWood) === "true";
        const activatedLoveRaid = getStoredValue(HHStoredVarPrefixKey + SK.plusLoveRaid) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventLoveRaidSandalWood) === "true";
        if(!activatedMythic && !activatedLoveRaid) {
            // if neither mythic nor love raid auto sandalwood is activated, no need to check
            return false;
        }

        // Don't try to equip if we're on cooldown from a recent failure
        if (Booster.isEquipOnCooldown()) {
            logHHAuto("needSandalWoodEquipped: skipping - equip on cooldown");
            return false;
        }

        // If no market data cached yet, signal that we need a market visit first.
        // Troll.ts will navigate to the shop page, which caches booster data.
        if (!Booster.hasBoosterDataFromMarket()) {
            logHHAuto("needSandalWoodEquipped: No market data cached. Need market visit to check Sandalwood inventory.");
            return true;
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
        const ownedSandalwood = HeroHelper.haveBoosterInInventory(Booster.SANDALWOOD_IDENTIFIER);
        const equipedSandalwood = Booster.haveBoosterEquiped(Booster.SANDALWOOD_IDENTIFIER);
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
        const isMythic = booster.rarity === 'mythic' || (booster.identifier && booster.identifier.startsWith('MB'));

        if (isMythic) {
            const alreadyTracked = boosterStatus.mythic.some(b => b.item?.identifier === booster.identifier);
            if (!alreadyTracked) {
                boosterStatus.mythic.push({
                    item: booster,
                    usages_remaining: 99 // Unknown, will be refreshed on next market visit
                });
                setStoredValue(HHStoredVarPrefixKey+TK.boosterStatus, JSON.stringify(boosterStatus));
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
                setStoredValue(HHStoredVarPrefixKey+TK.boosterStatus, JSON.stringify(boosterStatus));
                logHHAuto('Marked ' + booster.name + ' as equipped in storage (server says already equipped)');
            }
        }
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

    static async equipeSandalWoodIfNeeded(nextTrollChoosen: number, settingKey: string = SK.plusEventMythicSandalWood): Promise<boolean> {
        logHHAuto(`equipeSandalWoodIfNeeded: called for troll ${nextTrollChoosen}, settingKey=${settingKey}`);
        const activatedMythic = getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythic) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythicSandalWood) === "true";
        const activatedLoveRaid = getStoredValue(HHStoredVarPrefixKey + SK.plusLoveRaid) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventLoveRaidSandalWood) === "true";
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
                settingKey = SK.plusEventLoveRaidSandalWood;
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

                // Resolve Sandalwood booster from market data
                const sandalwoodBooster = Booster.getSandalwoodBooster();
                if (!sandalwoodBooster) {
                    logHHAuto("equipeSandalWoodIfNeeded: No market data for Sandalwood. Visit the market first.");
                    return false;
                }

                // Equip a new one
                logHHAuto("equipeSandalWoodIfNeeded: calling HeroHelper.equipBooster(Sandalwood)");
                const equiped: boolean = await HeroHelper.equipBooster(sandalwoodBooster);
                logHHAuto(`equipeSandalWoodIfNeeded: equipBooster returned ${equiped}`);
                if (!equiped) {
                    const numberFailure = HeroHelper.getSandalWoodEquipFailure();
                    logHHAuto(`equipeSandalWoodIfNeeded: failure #${numberFailure}`);
                    if (numberFailure >= 3) {
                        logHHAuto("equipeSandalWoodIfNeeded: 3rd failure, deactivating auto sandalwood settingKey=" + settingKey);
                        setStoredValue(HHStoredVarPrefixKey + settingKey, 'false');
                    } else {
                        logHHAuto("equipeSandalWoodIfNeeded: marking as already equipped + setting cooldown");
                        // Server says max boosters equipped - mark it as equipped to prevent retries
                        Booster.markBoosterAsEquippedInStorage(sandalwoodBooster);
                        // Set cooldown to prevent spamming equip attempts
                        Booster.setEquipCooldown(5 * 60);
                    }
                } else {
                    // Reset failure counter on success
                    logHHAuto("equipeSandalWoodIfNeeded: success, resetting failure counter");
                    setStoredValue(HHStoredVarPrefixKey + TK.sandalwoodFailure, 0);
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
