import { ConfigHelper } from "../Helper/ConfigHelper";
import { HeroHelper } from "../Helper/HeroHelper";
import { getHHVars } from "../Helper/HHHelper";
import { getStoredJSON, getStoredValue, setStoredValue } from "../Helper/StorageHelper";
import { randomInterval } from "../Helper/TimeHelper";
import { checkTimer, setTimer } from "../Helper/TimerHelper";
import { gotoPage, safeReload } from "../Service/PageNavigationService";
import { logHHAuto } from "../Utils/LogUtils";
import { isJSON, onAjaxResponse } from "../Utils/Utils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK, TK } from "../config/StorageKeys";
import { EventGirl } from '../model/EventGirl';
import { LoveRaid } from '../model/LoveRaid';
import { EventModule } from "./Events/EventModule";
import { isSkinPhase, shardTotalAfterFight, ShardDrop } from "./Events/GirlSkins.pure";
import { LoveRaidManager } from "./Events/LoveRaidManager";

const DEFAULT_BOOSTERS: { normal: any[]; mythic: any[] } = {normal: [], mythic:[]};

/**
 * Manages booster tracking, auto-equip, and Sandalwood Perfume logic for event farming.
 *
 * All methods are static. Booster state lives in browser storage, not on the class instance.
 */
export class Booster {
    /** Sandalwood identifier constant — id_item is resolved from market data or env config at runtime. */
    static SANDALWOOD_IDENTIFIER = "MB1";

    /** Number of mythic booster slots the game offers (one equipped booster per kind). */
    static MYTHIC_SLOT_COUNT = 5;

    /** Flag: true if AJAX response arrived before waitForBattleResponse() was called */
    private static _battleResponseReady: boolean = false;
    /** Resolver: set when waitForBattleResponse() is waiting; called by notifyBattleResponseProcessed() */
    private static _battleResponseResolve: (() => void) | null = null;

    /**
     * Waits for the AJAX battle response to be processed.
     * If the response already arrived (flag set), returns immediately.
     * Otherwise creates a Promise with 10s timeout.
     */
    static waitForBattleResponse(): Promise<void> {
        if (Booster._battleResponseReady) {
            Booster._battleResponseReady = false;
            logHHAuto('[SW-DEBUG] waitForBattleResponse: flag was already set, returning immediately');
            return Promise.resolve();
        }
        logHHAuto('[SW-DEBUG] waitForBattleResponse: waiting for AJAX response (10s timeout)...');
        return new Promise<void>((resolve, reject) => {
            Booster._battleResponseResolve = resolve;
            setTimeout(() => {
                if (Booster._battleResponseResolve === resolve) {
                    Booster._battleResponseResolve = null;
                    logHHAuto('[SW-DEBUG] waitForBattleResponse: TIMED OUT after 10s — proceeding anyway');
                    resolve(); // resolve anyway to avoid blocking
                }
            }, 10000);
        });
    }

    /**
     * Resets the battle response flag and resolver. Must be called BEFORE each battle button click.
     */
    static resetBattleResponseFlag(): void {
        logHHAuto('[SW-DEBUG] resetBattleResponseFlag: clearing flag and resolver before battle click');
        Booster._battleResponseReady = false;
        Booster._battleResponseResolve = null;
    }

    /**
     * Called at the end of the AJAX handler after processing battle results.
     * Either resolves a waiting promise or sets the flag for future waitForBattleResponse() calls.
     */
    static notifyBattleResponseProcessed(): void {
        if (Booster._battleResponseResolve) {
            logHHAuto('[SW-DEBUG] notifyBattleResponseProcessed: resolver waiting → resolving promise now');
            const resolve = Booster._battleResponseResolve;
            Booster._battleResponseResolve = null;
            resolve();
        } else {
            logHHAuto('[SW-DEBUG] notifyBattleResponseProcessed: no resolver waiting → setting flag for later');
            Booster._battleResponseReady = true;
        }
    }

    //all following lines credit:Tom208 OCD script
    static collectBoostersFromAjaxResponses () {
        onAjaxResponse(/(action|class)/, (response: any, opt: any, xhr: any, evt: any) => {
                (async function() {
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
                                // Track max usages for Sandalwood on equip
                                if (clonedData.item?.identifier === 'MB1' && clonedData.usages_remaining != null) {
                                    setStoredValue(HHStoredVarPrefixKey+TK.sandalwoodMaxUsages, String(clonedData.usages_remaining));
                                    logHHAuto(`[SW-DEBUG] Sandalwood equipped via AJAX: usages_remaining=${clonedData.usages_remaining}, saved to TK.sandalwoodMaxUsages`);
                                }
                            } else {
                                boosterStatus.normal.push({...clonedData, endAt: clonedData.lifetime})
                            }

                            setStoredValue(HHStoredVarPrefixKey+TK.boosterStatus, JSON.stringify(boosterStatus));
                            // Mirror the freshness stamp that collectBoostersFromMarket
                            // sets on a market-page DOM scrape. Without this the next
                            // autoEquipBoosters tick sees boosterStatusLastUpdate as
                            // missing/stale and forces a redundant market visit just
                            // to discover the slots are already filled. The AJAX
                            // payload contains the same equipped_booster data the
                            // market scrape would have read, so the stamp is honest.
                            setStoredValue(HHStoredVarPrefixKey+TK.boosterStatusLastUpdate, String(Date.now()));
                            //$(document).trigger('boosters:equipped', {id_item, isMythic, new_id: clonedData.id_member_booster_equipped})
                        }
                        return
                    }

                    let mythicUpdated = false
                    let sandalwoodEnded = false;

                    const sandalwood: any = boosterStatus.mythic.find((booster) => booster.item?.identifier === 'MB1');

                    // The girl's shard count comes back with every troll fight,
                    // but until #1843 it was only read when a Sandalwood was
                    // equipped -- the block below used to be the only reader.
                    // Without it the script kept fighting a girl it had already
                    // completed, because the stored count only refreshed on the
                    // next visit to the event page.
                    if (action === 'do_battles_trolls') {
                        Booster.updateEventGirlShards(response);
                    }

                    if (sandalwood && action === 'do_battles_trolls') {
                        const isMultibattle = parseInt(number_of_battles||'') > 1
                        const dosesBeforeFight = sandalwood.usages_remaining;
                        logHHAuto(`[SW-DEBUG] AJAX do_battles_trolls: isMultibattle=${isMultibattle}, number_of_battles=${number_of_battles}, dosesBeforeFight=${dosesBeforeFight}`);
                        const {rewards} = response
                        if (rewards && rewards.data && rewards.data.shards) {
                            let dosesConsumed = 0
                            rewards.data.shards.forEach(({previous_value, value}: { previous_value: number; value: number }, idx: number) => {
                                const shardsDropped = value - previous_value;
                                logHHAuto(`[SW-DEBUG] shard drop[${idx}]: previous=${previous_value}, value=${value}, shardsDropped=${shardsDropped}`);
                                if (isMultibattle) {
                                    const isOdd = shardsDropped % 2 === 1;
                                    if (isOdd) {
                                        logHHAuto(`[SW-DEBUG] shard drop[${idx}]: ODD (${shardsDropped}) → Sandalwood expired mid-batch, all ${dosesBeforeFight} doses consumed`);
                                        dosesConsumed = dosesBeforeFight;
                                    } else {
                                        const dosesDelta = Math.floor(shardsDropped / 2);
                                        logHHAuto(`[SW-DEBUG] shard drop[${idx}]: EVEN (${shardsDropped}) → ${dosesDelta} doses consumed`);
                                        dosesConsumed += dosesDelta;
                                    }
                                } else {
                                    logHHAuto(`[SW-DEBUG] shard drop[${idx}]: single battle → 1 dose consumed`);
                                    dosesConsumed++
                                }
                            })
                            // Cap at doses available before fight
                            const uncappedDoses = dosesConsumed;
                            dosesConsumed = Math.min(dosesConsumed, dosesBeforeFight);
                            if (uncappedDoses !== dosesConsumed) {
                                logHHAuto(`[SW-DEBUG] dose cap applied: uncapped=${uncappedDoses}, capped=${dosesConsumed}`);
                            }
                            sandalwood.usages_remaining -= dosesConsumed
                            logHHAuto(`[SW-DEBUG] Sandalwood dose tracking: before=${dosesBeforeFight}, consumed=${dosesConsumed}, remaining=${sandalwood.usages_remaining}, ended=${sandalwood.usages_remaining <= 0}`);
                            mythicUpdated = true
                            sandalwoodEnded = sandalwood.usages_remaining <= 0;
                        }
                    }
                    if (Booster.applyMythicUsageDecrements(boosterStatus, { action, className, number_of_battles, battles_amount })) {
                        mythicUpdated = true;
                    }

                    boosterStatus.mythic = boosterStatus.mythic.filter(({usages_remaining}) => usages_remaining > 0)

                    setStoredValue(HHStoredVarPrefixKey+TK.boosterStatus, JSON.stringify(boosterStatus));

                    /*if (mythicUpdated) {
                        $(document).trigger('boosters:updated-mythic')
                    }*/

                    try{
                        if (sandalwood && mythicUpdated && sandalwoodEnded) {
                            const isMultibattle = parseInt(number_of_battles||'') > 1
                            logHHAuto("[SW-DEBUG] sandalwood may be ended, need a new one");
                            const activatedEvent = getStoredValue(HHStoredVarPrefixKey + SK.plusEvent) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventSandalWood) === "true";
                            const activatedMythic = getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythic) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythicSandalWood) === "true";
                            const activatedLoveRaid = LoveRaidManager.isAnyActivated() && getStoredValue(HHStoredVarPrefixKey + SK.plusEventLoveRaidSandalWood) === "true";
                            if (activatedEvent && EventModule.getEventGirl()?.girl_id || activatedMythic && EventModule.getEventMythicGirl().is_mythic || activatedLoveRaid && LoveRaidManager.getRaidToFight()?.girl_to_win) {
                                if (isMultibattle) {
                                    // TODO go to market if sandalwood not ended, continue. If ended, buy a new one
                                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDShop"));
                                }
                            }
                        }
                    } catch(err) {
                        logHHAuto('Catch error during equip sandalwood for mythic' + err);
                    }

                    if (action === 'do_battles_trolls') {
                        Booster.notifyBattleResponseProcessed();
                    }
                })();
        })
    }

    /**
     * Live usage tracking for the mythic boosters whose consumption is a
     * plain per-action decrement (issue #1781). Unlike Sandalwood -- whose
     * consumption has to be derived from the shard drops in the battle
     * response, see collectBoostersFromAjaxResponses -- these boosters burn
     * one usage per battle of their game mode. Keeping the counters current
     * means an expired booster drops out of boosterStatus WITHOUT a market
     * visit: the equip logic sees the freed slot (and a remembered bonus
     * conflict clears) right away. MB6/MB10-MB12 have no known per-action
     * rule and stay market-scrape-only. Only entries with a numeric
     * usages_remaining are touched; everything else waits for the next
     * market scrape. Returns true when any counter changed.
     */
    static applyMythicUsageDecrements(
        boosterStatus: { mythic: any[] },
        params: { action?: string | null; className?: string | null; number_of_battles?: string | null; battles_amount?: string | null },
    ): boolean {
        const { action, className } = params;
        const battles = parseInt(params.number_of_battles || '');
        const teamBattles = parseInt(params.battles_amount || '');

        const costFor = (identifier: string): number => {
            switch (identifier) {
                case 'MB2': // All Mastery's Emblem: league AND season fights
                    return (action === 'do_battles_leagues' || action === 'do_battles_seasons') ? battles : 0;
                case 'MB3': // Headband of determination: pantheon + troll fights
                    return (action === 'do_battles_pantheon' || action === 'do_battles_trolls') ? battles : 0;
                case 'MB4': // Luxurious Watch: team battles
                    return className === 'TeamBattle' ? teamBattles : 0;
                case 'MB5': // Combative Cinnamon: season fights
                    return action === 'do_battles_seasons' ? battles : 0;
                case 'MB7': // Angels' semen scent: Place of Power starts
                    return (action === 'start' && className === 'TempPlaceOfPower') ? 1 : 0;
                case 'MB8': // Leagues mastery emblem: league fights
                    return action === 'do_battles_leagues' ? battles : 0;
                case 'MB9': // Seasons mastery emblem: season fights
                    return action === 'do_battles_seasons' ? battles : 0;
                default: // MB1 is shard-tracked; MB6/MB10-MB12 market-only.
                    return 0;
            }
        };

        let changed = false;
        for (const booster of boosterStatus.mythic) {
            if (typeof booster.usages_remaining !== 'number') continue;
            const cost = costFor(booster.item?.identifier ?? '');
            if (!Number.isFinite(cost) || cost <= 0) continue;
            booster.usages_remaining -= cost;
            changed = true;
            logHHAuto("Mythic usage tracking: " + booster.item?.identifier + " -" + cost + " -> " + booster.usages_remaining + " uses left.");
        }
        return changed;
    }

    static needBoosterStatusFromStore() {
        const isEventAutoSandalWood = getStoredValue(HHStoredVarPrefixKey+SK.plusEventSandalWood) === "true";
        const isMythicAutoSandalWood = getStoredValue(HHStoredVarPrefixKey+SK.plusEventMythicSandalWood) === "true";
        const isLoveRaidAutoSandalWood = getStoredValue(HHStoredVarPrefixKey+SK.plusEventLoveRaidSandalWood) === "true";
        const isLeagueWithBooster = getStoredValue(HHStoredVarPrefixKey+SK.autoLeaguesBoostedOnly) === "true";
        const isSeasonWithBooster = getStoredValue(HHStoredVarPrefixKey+SK.autoSeasonBoostedOnly) === "true";
        const isPantheonWithBooster = getStoredValue(HHStoredVarPrefixKey+SK.autoPantheonBoostedOnly) === "true";
        const isAutoEquipBoosters = getStoredValue(HHStoredVarPrefixKey+SK.autoEquipBoosters) === "true";
        const isAutoEquipMythicBooster = Booster.parseMythicBoosterList().length > 0;
        return isLeagueWithBooster || isSeasonWithBooster || isPantheonWithBooster || isEventAutoSandalWood || isMythicAutoSandalWood || isLoveRaidAutoSandalWood || isAutoEquipBoosters || isAutoEquipMythicBooster;
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
        setStoredValue(HHStoredVarPrefixKey+TK.boosterStatusLastUpdate, String(Date.now()));
    }

    /** TTL for boosterStatus freshness in milliseconds (10 minutes). */
    static BOOSTER_STATUS_TTL_MS = 10 * 60 * 1000;

    /**
     * Checks whether boosterStatus was refreshed from the market recently.
     * Used to detect stale state when another browser/tab changed the equipped boosters.
     * A missing timestamp is treated as stale (forces a market visit).
     */
    static hasFreshBoosterStatus(): boolean {
        const lastUpdateRaw = getStoredValue(HHStoredVarPrefixKey + TK.boosterStatusLastUpdate);
        if (!lastUpdateRaw) return false;
        const lastUpdate = parseInt(lastUpdateRaw, 10);
        if (isNaN(lastUpdate)) return false;
        return (Date.now() - lastUpdate) < Booster.BOOSTER_STATUS_TTL_MS;
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
        const storeData = getStoredJSON<any>(HHStoredVarPrefixKey + TK.storeContents, null);
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
        const boosterIdMap = getStoredJSON<Record<string, any>>(HHStoredVarPrefixKey + TK.boosterIdMap, {});
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
        const slots = normalized.split(';').map((s: string) => s.trim().toUpperCase());
        if (slots.length < 1 || slots.length > 4 || !slots.every((s: string) => /^B[1-4]$/.test(s))) {
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
     * Generates a random delay between 15 and 45 minutes (in seconds).
     * Added to booster expiry time to make auto-equip timing look human.
     */
    static getRandomEquipDelay(): number {
        return randomInterval(15 * 60, 45 * 60);
    }

    /**
     * Short re-check window (seconds) for still-equippable wanted mythics. Kept
     * above the 10-minute boosterStatus freshness TTL (see hasFreshBoosterStatus)
     * so a re-check does not force a fresh market visit every time, but far below
     * a normal booster's runtime so free mythic slots are filled promptly
     * instead of waiting for the normal boosters to expire (issue #1781).
     */
    static getMythicRecheckDelay(): number {
        return randomInterval(5 * 60, 8 * 60);
    }

    /**
     * Schedules the next auto-equip check based on the longest-running active booster
     * plus a random delay (15-45 min). If no boosters are active, schedules immediately
     * with just the random delay.
     *
     * When `mythicRecheckSoon` is true the delay is capped to a short window
     * (getMythicRecheckDelay): the mythic slots are an independent goal and must
     * not wait for the normal boosters to expire before they are filled.
     *
     * When `conflictWaiting` is true (a wanted mythic booster is blocked by a
     * remembered bonus conflict) the delay is capped to ~45-60 min: each check
     * refreshes boosterStatus from the market when stale, so an expired
     * clashing booster is noticed within the hour even when its expiry is not
     * live-tracked -- a safety net on top of applyMythicUsageDecrements.
     */
    static scheduleNextEquipCheck(mythicRecheckSoon = false, conflictWaiting = false): void {
        const longestRemaining = Booster.getLongestBoosterRemainingSeconds();
        const randomDelay = Booster.getRandomEquipDelay();
        const normalDelay = longestRemaining + randomDelay;

        let totalDelay = normalDelay;
        if (mythicRecheckSoon) {
            totalDelay = Math.min(normalDelay, Booster.getMythicRecheckDelay());
        } else if (conflictWaiting) {
            totalDelay = Math.min(normalDelay, randomInterval(45 * 60, 60 * 60));
        }

        if (mythicRecheckSoon && totalDelay < normalDelay) {
            logHHAuto("Auto-equip: Next check in " + Math.floor(totalDelay / 60)
                + " min (shortened: a wanted mythic booster is still equippable, not waiting for the normal boosters to expire).");
        } else if (conflictWaiting && totalDelay < normalDelay) {
            logHHAuto("Auto-equip: Next check in " + Math.floor(totalDelay / 60)
                + " min (capped: a wanted mythic booster waits on a bonus conflict; re-checking hourly).");
        } else {
            logHHAuto("Auto-equip: Next check in " + Math.floor(totalDelay / 60) + " min (booster expires in "
                + Math.floor(longestRemaining / 60) + " min + " + Math.floor(randomDelay / 60) + " min random delay).");
        }
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

        // The normal-slot auto-equip only runs when its own master switch is on.
        // The mythic-slot auto-equip is an independent setting (autoEquipMythicBooster).
        const normalAutoEquipOn = getStoredValue(HHStoredVarPrefixKey + SK.autoEquipBoosters) === "true";
        const mythicPriorityList = Booster.parseMythicBoosterList();

        // Ensure we have booster data from the market before trying to equip
        if (!Booster.hasBoosterDataFromMarket()) {
            logHHAuto("Auto-equip: No booster data from market. Navigating to market first.");
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDShop"));
            return true; // Signal busy — the market visit will cache the data, next loop will equip
        }

        // Also refresh boosterStatus if it's stale — another browser/tab may have changed
        // the equipped boosters. Without this, getBoostersToEquip() would use stale data
        // and repeatedly try to equip slots that are actually already occupied server-side.
        if (!Booster.hasFreshBoosterStatus()) {
            logHHAuto("Auto-equip: boosterStatus is stale or missing. Navigating to market to refresh.");
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDShop"));
            return true; // Signal busy — market visit will refresh boosterStatus via collectBoostersFromMarket
        }

        // Fill free mythic slots with the boosters from the user's priority
        // list (one equipped booster per kind). This is independent of the
        // normal-slot config: it only ever fills free slots, never replaces an
        // equipped booster, and leaves MB1 plus one reserved slot to the
        // Sandalwood automation while that is active (see autoEquipMythicBoosters).
        const mythicEquipped = mythicPriorityList.length > 0 ? await Booster.autoEquipMythicBoosters(mythicPriorityList) : false;

        // The mythic slots are an independent goal. If a wanted booster is
        // still equippable (owned, not equipped, and a usable free slot left
        // after the Sandalwood reservation), the next check must come soon
        // rather than being tied to the normal boosters' runtime (issue #1781).
        // The inventory check keeps us from short-polling (and re-visiting the
        // market) for boosters we do not own. Computed AFTER the equip pass so
        // freshly equipped boosters count as done.
        const mythicWantedStillEquippable = Booster.hasEquippableMythicWanted(mythicPriorityList);

        // A wanted booster blocked by a remembered bonus conflict: cap the
        // next check at ~1h so the market refresh notices the clashing
        // booster's expiry even when it is not live-tracked.
        const mythicConflictWaiting = mythicPriorityList.some((id) => Booster.isMythicConflictRemembered(id));

        if (!normalAutoEquipOn) {
            // Only the mythic-slot auto-equip was requested — skip normal slots.
            Booster.scheduleNextEquipCheck(mythicWantedStillEquippable, mythicConflictWaiting);
            return mythicEquipped;
        }

        const boostersToEquip = Booster.getBoostersToEquip();
        if (boostersToEquip.length === 0) {
            logHHAuto("Auto-equip: All booster slots active.");
            Booster.scheduleNextEquipCheck(mythicWantedStillEquippable, mythicConflictWaiting);
            return mythicEquipped;
        }

        logHHAuto("Auto-equip: Need to equip " + boostersToEquip.length + " booster(s): " + boostersToEquip.join(', '));

        let anyEquipped = mythicEquipped;
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
            Booster.scheduleNextEquipCheck(mythicWantedStillEquippable, mythicConflictWaiting);
        }
        return anyEquipped;
    }

    /**
     * Parses the mythic auto-equip setting into an ordered priority list of
     * booster identifiers (e.g. ["MB9", "MB2"]). The stored value is a
     * ";"-separated list of codes (MB1..MB12); surrounding whitespace is
     * trimmed, invalid codes are dropped, duplicates keep their first
     * position. An empty field means "off" and yields an empty list.
     *
     * The list is NOT capped at the number of slots (8.10.12). It used to be,
     * which conflated two different numbers: the game has MYTHIC_SLOT_COUNT
     * slots, but the list is a preference order -- "take whichever of these I
     * happen to own". Capping it meant a player who listed all twelve silently
     * lost the last seven. Order = priority: the walk down the list stops when
     * no slot is free.
     */
    static parseMythicBoosterList(): string[] {
        const raw = getStoredValue(HHStoredVarPrefixKey + SK.autoEquipMythicBooster);
        if (!raw || typeof raw !== "string" || raw.trim() === "") {
            return [];
        }
        const parsed = raw
            .split(";")
            .map((s: string) => s.trim().toUpperCase())
            .filter((s: string) => /^MB([1-9]|1[0-2])$/.test(s));
        if (parsed.length === 0) {
            logHHAuto("Auto-equip mythic: no valid codes in '" + raw + "', treating as off.");
        }
        return [...new Set(parsed)];
    }

    /**
     * True when any of the Sandalwood auto-equip automations is active. Mirrors
     * the exact activation checks used by needSandalWoodEquipped /
     * equipeSandalWoodIfNeeded. The Sandalwood automation keeps control of MB1,
     * so the priority-list auto-equip skips MB1 and keeps one mythic slot free
     * for Sandalwood while any of these automations is active.
     */
    static isSandalwoodAutomationActive(): boolean {
        const activatedEvent = getStoredValue(HHStoredVarPrefixKey + SK.plusEvent) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventSandalWood) === "true";
        const activatedMythic = getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythic) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythicSandalWood) === "true";
        const activatedLoveRaid = LoveRaidManager.isAnyActivated() && getStoredValue(HHStoredVarPrefixKey + SK.plusEventLoveRaidSandalWood) === "true";
        return activatedEvent || activatedMythic || activatedLoveRaid;
    }

    /** Identifiers of the currently equipped mythic boosters (defensive against missing item data). */
    static getEquippedMythicIdentifiers(): Set<string> {
        const boosterStatus = Booster.getBoosterFromStorage();
        return new Set(
            boosterStatus.mythic
                .map((b) => b.item?.identifier)
                .filter((id) => !!id)
        );
    }

    /**
     * Number of mythic slots the priority-list auto-equip may fill right now:
     * MYTHIC_SLOT_COUNT minus the equipped mythics, minus one slot reserved for
     * the Sandalwood automation when it is active and MB1 is not equipped yet
     * (Sandalwood has priority for that slot).
     */
    static getFreeMythicSlots(): number {
        const equipped = Booster.getEquippedMythicIdentifiers();
        let free = Booster.MYTHIC_SLOT_COUNT - Booster.getBoosterFromStorage().mythic.length;
        if (Booster.isSandalwoodAutomationActive() && !equipped.has(Booster.SANDALWOOD_IDENTIFIER)) {
            free -= 1; // keep one slot free for the Sandalwood automation
        }
        return Math.max(0, free);
    }

    /**
     * Signature of the currently equipped mythic loadout, used to key the
     * conflict memory: a booster the game refused as conflicting stays
     * skipped exactly as long as this signature is unchanged.
     */
    static getMythicLoadoutSignature(): string {
        return Array.from(Booster.getEquippedMythicIdentifiers()).sort().join(",");
    }

    /** Conflict memory (identifier -> loadout signature at refusal time). */
    static getMythicConflicts(): Record<string, string> {
        return getStoredJSON<Record<string, string>>(HHStoredVarPrefixKey + TK.mythicEquipConflicts, {});
    }

    /**
     * True when the game's refusal of this booster still applies.
     *
     * The refusal means "it clashes with something equipped at that moment".
     * Only the disappearance of a booster can lift that -- adding one to a free
     * slot cannot, because the clashing booster is still on. So the recorded
     * loadout is compared as a SUBSET of the current one, not for equality:
     * still contained means the refusal stands, something missing means re-try.
     *
     * Equality was the original rule and it churned. Every successful equip
     * changed the signature and thereby invalidated every conflict remembered
     * earlier in the same run, so those boosters were tried again on the next
     * pass, refused again, and each pass ended in another conflict popup and
     * another page reload. With a priority list longer than the five slots
     * (8.10.12) that turned into a visible loop.
     */
    static isMythicConflictRemembered(identifier: string): boolean {
        const conflicts = Booster.getMythicConflicts();
        if (!(identifier in conflicts)) return false;
        const recorded = conflicts[identifier] === '' ? [] : conflicts[identifier].split(",");
        const equipped = Booster.getEquippedMythicIdentifiers();
        if (recorded.every((id) => equipped.has(id))) return true;
        delete conflicts[identifier];
        setStoredValue(HHStoredVarPrefixKey + TK.mythicEquipConflicts, JSON.stringify(conflicts));
        return false;
    }

    /** Record a refused equip for the current loadout. */
    static rememberMythicConflict(identifier: string): void {
        const conflicts = Booster.getMythicConflicts();
        conflicts[identifier] = Booster.getMythicLoadoutSignature();
        setStoredValue(HHStoredVarPrefixKey + TK.mythicEquipConflicts, JSON.stringify(conflicts));
    }

    /**
     * True when at least one booster from the priority list could still be
     * equipped: not equipped yet, present in inventory, not refused as
     * conflicting under the current loadout, and a usable free mythic slot
     * remains (after the Sandalwood reservation). MB1 does not count while
     * the Sandalwood automation is active — it is handled there.
     * Used to schedule a soon re-check instead of the long cooldown.
     */
    static hasEquippableMythicWanted(priorityList: string[]): boolean {
        if (priorityList.length === 0) return false;
        if (Booster.getFreeMythicSlots() <= 0) return false;
        const sandalwoodActive = Booster.isSandalwoodAutomationActive();
        const equipped = Booster.getEquippedMythicIdentifiers();
        return priorityList.some((id) =>
            !(sandalwoodActive && id === Booster.SANDALWOOD_IDENTIFIER)
            && !equipped.has(id)
            && !Booster.isMythicConflictRemembered(id)
            && HeroHelper.haveBoosterInInventory(id));
    }

    /**
     * Equips the priority-list mythic boosters into free mythic slots. The game
     * offers MYTHIC_SLOT_COUNT slots with at most one equipped booster per
     * kind: every listed booster that is owned and not equipped yet is placed
     * into a free slot, in list order (order = priority). While the Sandalwood
     * automation is active it keeps control of MB1: the code is skipped here
     * and one slot is kept free for Sandalwood as long as MB1 is not equipped.
     * Equipped boosters are never replaced; equipping costs no Kobans and
     * purchasing stays the responsibility of autoBuyBoostersFilter.
     * Returns true when at least one booster was equipped.
     */
    static async autoEquipMythicBoosters(priorityList: string[]): Promise<boolean> {
        if (priorityList.length === 0) {
            return false;
        }

        const sandalwoodActive = Booster.isSandalwoodAutomationActive();
        const equippedNow = Booster.getEquippedMythicIdentifiers();
        let free = Booster.getFreeMythicSlots();

        if (free <= 0) {
            const reserved = sandalwoodActive && !equippedNow.has(Booster.SANDALWOOD_IDENTIFIER);
            logHHAuto("Auto-equip mythic: no free mythic slot"
                + (reserved ? " (one slot is reserved for the Sandalwood automation)" : "")
                + ", leaving equipped boosters untouched.");
            return false;
        }

        // Don't fight a recent equip failure.
        if (Booster.isEquipOnCooldown()) {
            logHHAuto("Auto-equip mythic: equip on cooldown, skipping.");
            return false;
        }

        let anyEquipped = false;
        let conflictSeen = false;
        let conflicts = 0;
        for (const identifier of priorityList) {
            if (free <= 0) {
                logHHAuto("Auto-equip mythic: no free slot left for the remaining list entries.");
                break;
            }
            if (sandalwoodActive && identifier === Booster.SANDALWOOD_IDENTIFIER) {
                logHHAuto("Auto-equip mythic: MB1 is managed by the Sandalwood automation, skipping.");
                continue;
            }
            if (equippedNow.has(identifier)) {
                logHHAuto("Auto-equip mythic: " + identifier + " already equipped, skipping.");
                continue;
            }
            if (Booster.isMythicConflictRemembered(identifier)) {
                logHHAuto("Auto-equip mythic: " + identifier + " conflicts with the current mythic loadout, skipping until the equipped mythics change.");
                continue;
            }
            if (!HeroHelper.haveBoosterInInventory(identifier)) {
                logHHAuto("Auto-equip mythic: " + identifier + " not in inventory, skipping.");
                continue;
            }
            const boosterObj = Booster.getBoosterByIdentifier(identifier);
            if (!boosterObj) {
                logHHAuto("Auto-equip mythic: could not resolve " + identifier + " from market data, skipping.");
                continue;
            }

            const equipped = await HeroHelper.equipBooster(boosterObj);
            if (equipped) {
                logHHAuto("Auto-equip mythic: successfully equipped " + boosterObj.name);
                anyEquipped = true;
                free--;
                equippedNow.add(identifier);
                // boosterStatus in storage only refreshes on the next market
                // visit; record the fresh equip immediately so this pass and
                // the follow-up scheduling see the slot as taken.
                Booster.markBoosterAsEquippedInStorage(boosterObj);
            } else if (await Booster.dismissMythicConflictPopup()) {
                // Differently named boosters can carry the SAME in-game bonus;
                // the game then refuses the equip with a conflict popup. Not an
                // error state: remember the refusal for the current loadout
                // (re-tried automatically once the equipped mythics change)
                // and keep equipping the rest of the list.
                Booster.rememberMythicConflict(identifier);
                conflictSeen = true;
                conflicts++;
                logHHAuto("Auto-equip mythic: " + boosterObj.name + " conflicts with an already equipped mythic booster, skipping it until the equipped mythics change.");
                if (conflicts >= Booster.MYTHIC_CONFLICTS_PER_PASS) {
                    logHHAuto("Auto-equip mythic: " + conflicts + " refusals this pass, stopping here."
                        + " The remaining list entries are tried on the next pass, with these refusals remembered.");
                    break;
                }
                continue;
            } else {
                logHHAuto("Auto-equip mythic: failed to equip " + boosterObj.name + ". Slot may be occupied server-side.");
                break;
            }
        }

        if (conflictSeen) {
            // The conflict popup ignores every synthetic close attempt (click,
            // jQuery trigger, pointer sequence, DOM removal of the matched
            // node) -- a reload is the one reliable way to clear it. Thanks to
            // the conflict memory this happens at most once per loadout
            // change, not every cycle. safeReload waits for in-flight AJAX
            // (e.g. the equips above) to settle first.
            logHHAuto("Auto-equip mythic: reloading the page to clear the conflict popup.");
            safeReload();
        }
        return anyEquipped;
    }

    /** Text the game's error popup shows when a mythic booster clashes with an
     *  equipped one that grants the same in-game bonus under another name. */
    static MYTHIC_CONFLICT_TEXT = /conflicts? with another mythic booster/i;

    /** How long to wait for the conflict popup to render after a refused
     *  equip. A class field so tests can shorten it. */
    static MYTHIC_CONFLICT_POPUP_WAIT_MS = 2000;

    /**
     * How many refusals one pass will provoke before it gives up and reloads.
     *
     * Every refusal costs a server request and a popup, and each one is
     * remembered, so the remaining candidates are picked up on the next pass
     * with the memory already in place -- nothing is lost by stopping early.
     * Without this a priority list longer than the five slots (8.10.12) could
     * fire a refusal for every remaining entry in a single pass.
     */
    static MYTHIC_CONFLICTS_PER_PASS = 3;

    /**
     * Detects the game's "you cannot equip this booster, it conflicts with
     * another mythic booster already equipped" popup after a refused equip,
     * dismisses it (so popups do not stack up) and reports whether the
     * failure was such a conflict. Polls briefly because the popup renders
     * asynchronously after the AJAX response.
     */
    static async dismissMythicConflictPopup(): Promise<boolean> {
        const deadline = Date.now() + Booster.MYTHIC_CONFLICT_POPUP_WAIT_MS;
        for (;;) {
            const textEl = Array.from(document.querySelectorAll<HTMLElement>("div.text"))
                .find((el) => Booster.MYTHIC_CONFLICT_TEXT.test(el.textContent || ""));
            if (textEl) {
                // This popup cannot be closed with synthetic clicks: native
                // .click(), jQuery trigger('click'), a full pointer/mouse
                // event sequence and an overlay click were all verified
                // ineffective in the field (the game seems to accept only
                // trusted user events on its "X"). The refusal already
                // happened server-side and the window is purely
                // informational, so remove it from the DOM instead.
                const box = textEl.closest<HTMLElement>('[class*="popup"], [id*="popup"], #sliding-popups > *')
                    ?? textEl.parentElement;
                logHHAuto("Auto-equip mythic: removing conflict popup ("
                    + (box ? box.tagName + (box.id ? "#" + box.id : "") + (box.className ? "." + String(box.className).split(" ").join(".") : "") : "?") + ").");
                box?.remove();
                return true;
            }
            if (Date.now() >= deadline) return false;
            await new Promise((resolve) => setTimeout(resolve, 400));
        }
    }

    /**
     * Resolves the Sandalwood Perfume booster object from market data.
     * Returns null if market data is not available.
     */
    static getSandalwoodBooster(): any {
        return Booster.getBoosterByIdentifier(Booster.SANDALWOOD_IDENTIFIER);
    }

    static needSandalWoodEquipped(nextTrollChoosen: number, eventMythicGirl: EventGirl = null as any, loveRaid: LoveRaid = null as any): boolean {
        const activatedEvent = getStoredValue(HHStoredVarPrefixKey + SK.plusEvent) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventSandalWood) === "true";
        const activatedMythic = getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythic) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythicSandalWood) === "true";
        const activatedLoveRaid = LoveRaidManager.isAnyActivated() && getStoredValue(HHStoredVarPrefixKey + SK.plusEventLoveRaidSandalWood) === "true";
        logHHAuto(`[SW-DEBUG] needSandalWoodEquipped: troll=${nextTrollChoosen}, activatedEvent=${activatedEvent}, activatedMythic=${activatedMythic}, activatedLoveRaid=${activatedLoveRaid}`);
        if(!activatedEvent && !activatedMythic && !activatedLoveRaid) {
            logHHAuto('[SW-DEBUG] needSandalWoodEquipped: no auto-sandalwood activated, skipping');
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

        let needForEvent = false, needForMythic = false, needForLoveRaid = false;
        if (activatedEvent) {
            needForEvent = Booster.needSandalWoodEvent(nextTrollChoosen);
        }
        if (activatedMythic) {
            if(!eventMythicGirl) {
                eventMythicGirl = EventModule.getEventMythicGirl();
            }
            needForMythic = Booster.needSandalWoodMythic(nextTrollChoosen, eventMythicGirl);

        }
        if(activatedLoveRaid) {
            if(!loveRaid) {
                loveRaid = LoveRaidManager.getRaidToFight() as LoveRaid;
            }
            needForLoveRaid = Booster.needSandalWoodLoveRaid(nextTrollChoosen, loveRaid);
        }


        logHHAuto(`[SW-DEBUG] needSandalWoodEquipped: needForEvent=${needForEvent}, needForMythic=${needForMythic}, needForLoveRaid=${needForLoveRaid}`);

        // Proactive depletion check: if Sandalwood is equipped but has 0 doses remaining,
        // remove it from boosterStatus so ownedSandalwoodAndNotEquiped() triggers re-equip.
        if (needForEvent || needForMythic || needForLoveRaid) {
            const dosesRemaining = Booster.getSandalwoodDosesRemaining();
            logHHAuto(`[SW-DEBUG] needSandalWoodEquipped: proactive depletion check, dosesRemaining=${dosesRemaining}`);
            if (dosesRemaining !== null && dosesRemaining <= 0) {
                logHHAuto('needSandalWoodEquipped: Sandalwood depleted (0 doses), removing from boosterStatus to trigger re-equip');
                const boosterStatus = Booster.getBoosterFromStorage();
                boosterStatus.mythic = boosterStatus.mythic.filter(b => b.item?.identifier !== 'MB1');
                setStoredValue(HHStoredVarPrefixKey+TK.boosterStatus, JSON.stringify(boosterStatus));
            }
        }

        return ((needForEvent || needForMythic || needForLoveRaid) && Booster.ownedSandalwoodAndNotEquiped());
    }

    static ownedSandalwoodAndNotEquiped(): boolean {
        const ownedSandalwood = HeroHelper.haveBoosterInInventory(Booster.SANDALWOOD_IDENTIFIER);
        const equipedSandalwood = Booster.haveBoosterEquiped(Booster.SANDALWOOD_IDENTIFIER);
        logHHAuto(`[SW-DEBUG] ownedSandalwoodAndNotEquiped: owned=${ownedSandalwood}, equipped=${equipedSandalwood}, result=${ownedSandalwood && !equipedSandalwood}`);
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
                // Restore the freshness stamp that equipBooster cleared on
                // success:false. Without this the next autoEquipBoosters
                // tick still treats the status as stale and navigates to
                // the shop just to confirm what we already wrote here.
                setStoredValue(HHStoredVarPrefixKey+TK.boosterStatusLastUpdate, String(Date.now()));
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
                setStoredValue(HHStoredVarPrefixKey+TK.boosterStatusLastUpdate, String(Date.now()));
                logHHAuto('Marked ' + booster.name + ' as equipped in storage (server says already equipped)');
            }
        }
    }

    /**
     * Returns the user-configured minimum shards threshold for Sandalwood.
     * When remaining shards fall to this value or below, Sandalwood won't be equipped.
     * Default 0 = always equip Sandalwood.
     */
    static getSandalwoodMinShardsThreshold(): number {
        return Number(getStoredValue(HHStoredVarPrefixKey + SK.sandalwoodMinShardsThreshold)) || 0;
    }

    static needSandalWoodEvent(nextTrollChoosen: number, eventGirl: EventGirl = null as any): boolean {
        if (!eventGirl) {
            eventGirl = EventModule.getEventGirl();
        }
        if (!eventGirl?.girl_id || eventGirl.is_mythic) return false;
        const activated = getStoredValue(HHStoredVarPrefixKey + SK.plusEvent) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventSandalWood) === "true";
        const correctTrollTargetted = eventGirl.troll_id == nextTrollChoosen;
        if (Booster.skinPhaseBlocksSandalwood(Number(eventGirl.shards))) return false;
        const remainingShards = Number(100 - Number(eventGirl.shards));
        const threshold = Booster.getSandalwoodMinShardsThreshold();
        if (remainingShards <= threshold) {
            logHHAuto(`[SW-DEBUG] Not equipping sandalwood for event, only ${remainingShards} shards remaining (threshold: ${threshold})`);
        }

        return activated && correctTrollTargetted && remainingShards > threshold;
    }

    /**
     * Write the shard count from a battle response back into the stored event
     * girl (#1843).
     *
     * The decision "is there still something to fight for here" reads that
     * stored object, and it was only ever refreshed by parsing the event page.
     * Fights happen on the troll pages, so between completing a girl and the
     * next event-page visit the script fought on -- five times in the log that
     * reported this, each one for nothing.
     *
     * When the girl is complete and the user wants skins, the event entry is
     * marked stale so the pipeline re-reads the event page: the battle
     * response says nothing about skin progress, so that is the only place the
     * "skin done" answer can come from.
     */
    static updateEventGirlShards(response: { rewards?: { data?: { shards?: readonly ShardDrop[] } } }): void {
        const drops = response?.rewards?.data?.shards;
        if (!Array.isArray(drops) || drops.length === 0) return;
        for (const [key, girl] of [
            [TK.eventMythicGirl, EventModule.getEventMythicGirl()],
            [TK.eventGirl, EventModule.getEventGirl()],
        ] as [string, EventGirl][]) {
            if (!girl?.girl_id) continue;
            const before = Number(girl.shards);
            const after = shardTotalAfterFight(drops, before);
            if (after === null) continue;
            if (after !== before) {
                girl.shards = after;
                setStoredValue(HHStoredVarPrefixKey + key, JSON.stringify(girl));
                logHHAuto(`[SKIN] girl ${girl.girl_id} shards ${before} -> ${after}`);
            }
            if (after < 100) continue;

            if (isSkinPhase(after, getStoredValue(HHStoredVarPrefixKey + SK.plusGirlSkins) === 'true')) {
                // Keep fighting, but only the event page knows whether a skin
                // is still outstanding -- the stored girl carries no skin data.
                EventModule.markEventStale(girl.event_id);
                logHHAuto(`[SKIN] girl ${girl.girl_id} complete, re-checking event ${girl.event_id} for skins`);
            } else {
                // Nothing left to win here. Drop the target now instead of
                // waiting for the next event-page visit (#1843).
                sessionStorage.removeItem(HHStoredVarPrefixKey + key);
                logHHAuto(`[SKIN] girl ${girl.girl_id} complete, dropping her as a fight target`);
            }
        }
    }

    /**
     * True when the only thing left here is a skin and the user has not asked
     * for a perfume in that phase (#1843).
     *
     * The three per-path Equip Sandalwood switches mean "while winning the
     * girl". Once she is won they no longer apply; plusSkinSandalWood is the
     * one that does, and it is off by default because a perfume is a mythic
     * booster.
     */
    static skinPhaseBlocksSandalwood(shards: number): boolean {
        const wantsSkins = getStoredValue(HHStoredVarPrefixKey + SK.plusGirlSkins) === 'true';
        if (!isSkinPhase(shards, wantsSkins)) return shards >= 100;   // girl done, skins off -> nothing to fight for
        return getStoredValue(HHStoredVarPrefixKey + SK.plusSkinSandalWood) !== 'true';
    }

    static needSandalWoodMythic(nextTrollChoosen: number, eventMythicGirl: EventGirl = null as any): boolean {
        const activated = getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythic) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythicSandalWood) === "true";
        const correctTrollTargetted = eventMythicGirl.is_mythic === true && eventMythicGirl.troll_id == nextTrollChoosen;
        // Skin phase: the girl is done and we only keep fighting for her skin.
        // No fresh perfume unless the user asked for it separately (#1843).
        if (Booster.skinPhaseBlocksSandalwood(Number(eventMythicGirl.shards))) return false;
        const remainingShards = Number(100 - Number(eventMythicGirl.shards));
        const threshold = Booster.getSandalwoodMinShardsThreshold();
        if (remainingShards <= threshold) {
            logHHAuto(`[SW-DEBUG] Not equipping sandalwood for mythic, only ${remainingShards} shards remaining (threshold: ${threshold})`);
        }

        return activated && correctTrollTargetted && remainingShards > threshold;
    }
    static needSandalWoodLoveRaid(nextTrollChoosen: number, loveRaid: LoveRaid = null as any): boolean {
        if (!loveRaid) return false;
        const activated = LoveRaidManager.isAnyActivated() && getStoredValue(HHStoredVarPrefixKey + SK.plusEventLoveRaidSandalWood) === "true";
        const correctTrollTargetted = loveRaid.girl_to_win && loveRaid.trollId == nextTrollChoosen;
        if (Booster.skinPhaseBlocksSandalwood(Number(loveRaid.girl_shards))) return false;
        const remainingShards = Number(100 - Number(loveRaid.girl_shards));
        const threshold = Booster.getSandalwoodMinShardsThreshold();
        if (remainingShards <= threshold) {
            logHHAuto(`[SW-DEBUG] Not equipping sandalwood for love raid, only ${remainingShards} shards remaining (threshold: ${threshold})`);
        }

        return activated && correctTrollTargetted && remainingShards > threshold;
    }

    static async equipeSandalWoodIfNeeded(nextTrollChoosen: number, settingKey: string = SK.plusEventMythicSandalWood): Promise<boolean> {
        logHHAuto(`[SW-DEBUG] equipeSandalWoodIfNeeded: called for troll ${nextTrollChoosen}, settingKey=${settingKey}`);
        const activatedEvent = getStoredValue(HHStoredVarPrefixKey + SK.plusEvent) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventSandalWood) === "true";
        const activatedMythic = getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythic) === "true" && getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythicSandalWood) === "true";
        const activatedLoveRaid = LoveRaidManager.isAnyActivated() && getStoredValue(HHStoredVarPrefixKey + SK.plusEventLoveRaidSandalWood) === "true";
        logHHAuto(`[SW-DEBUG] equipeSandalWoodIfNeeded: activatedEvent=${activatedEvent}, activatedMythic=${activatedMythic}, activatedLoveRaid=${activatedLoveRaid}`);
        let eventMythicGirl: EventGirl = null as any, loveRaid: LoveRaid = null as any;
        let needForEvent = false, needForMythic = false, needForLoveRaid = false;
        if (activatedEvent) {
            needForEvent = Booster.needSandalWoodEvent(nextTrollChoosen);
            if (needForEvent) {
                settingKey = SK.plusEventSandalWood;
            }
        }
        if (activatedMythic) {
            if (!eventMythicGirl) {
                eventMythicGirl = EventModule.getEventMythicGirl();
            }
            needForMythic = Booster.needSandalWoodMythic(nextTrollChoosen, eventMythicGirl);
            if (needForMythic) {
                settingKey = SK.plusEventMythicSandalWood;
            }
        }
        if (activatedLoveRaid) {
            if (!loveRaid) {
                loveRaid = LoveRaidManager.getRaidToFight() as LoveRaid;
            }
            needForLoveRaid = Booster.needSandalWoodLoveRaid(nextTrollChoosen, loveRaid);
            if (needForLoveRaid && !needForMythic && !needForEvent) {
                settingKey = SK.plusEventLoveRaidSandalWood;
            }
        }
        logHHAuto(`[SW-DEBUG] equipeSandalWoodIfNeeded: needForEvent=${needForEvent}, needForMythic=${needForMythic}, needForLoveRaid=${needForLoveRaid}`);
        try {
            if (((needForEvent || needForMythic || needForLoveRaid) && Booster.ownedSandalwoodAndNotEquiped())) {
                // Check cooldown before attempting equip
                if (Booster.isEquipOnCooldown()) {
                    logHHAuto("[SW-DEBUG] equipeSandalWoodIfNeeded: on cooldown, skipping equip attempt");
                    return false;
                }

                // Resolve Sandalwood booster from market data
                const sandalwoodBooster = Booster.getSandalwoodBooster();
                if (!sandalwoodBooster) {
                    logHHAuto("[SW-DEBUG] equipeSandalWoodIfNeeded: No market data for Sandalwood. Visit the market first.");
                    return false;
                }

                // Equip a new one
                logHHAuto("[SW-DEBUG] equipeSandalWoodIfNeeded: calling HeroHelper.equipBooster(Sandalwood)");
                const equiped: boolean = await HeroHelper.equipBooster(sandalwoodBooster);
                logHHAuto(`[SW-DEBUG] equipeSandalWoodIfNeeded: equipBooster returned ${equiped}`);
                if (!equiped) {
                    const numberFailure = HeroHelper.getSandalWoodEquipFailure();
                    logHHAuto(`[SW-DEBUG] equipeSandalWoodIfNeeded: failure #${numberFailure}`);
                    if (numberFailure >= 3) {
                        logHHAuto("[SW-DEBUG] equipeSandalWoodIfNeeded: 3rd failure, deactivating auto sandalwood settingKey=" + settingKey);
                        setStoredValue(HHStoredVarPrefixKey + settingKey, 'false');
                    } else {
                        logHHAuto("[SW-DEBUG] equipeSandalWoodIfNeeded: marking as already equipped + setting cooldown");
                        // Server says max boosters equipped - mark it as equipped to prevent retries
                        Booster.markBoosterAsEquippedInStorage(sandalwoodBooster);
                        // Set cooldown to prevent spamming equip attempts
                        Booster.setEquipCooldown(5 * 60);
                    }
                } else {
                    // Reset failure counter on success
                    logHHAuto("[SW-DEBUG] equipeSandalWoodIfNeeded: success, resetting failure counter");
                    setStoredValue(HHStoredVarPrefixKey + TK.sandalwoodFailure, 0);
                }
                return equiped;
            } else {
                logHHAuto(`[SW-DEBUG] equipeSandalWoodIfNeeded: conditions not met, no equip needed`);
            }
        } catch (error) {
            logHHAuto(`[SW-DEBUG] equipeSandalWoodIfNeeded: caught error: ${error}`);
            return Promise.resolve(false);
        }
        return Promise.resolve(false);
    }

    /**
     * Returns the number of remaining Sandalwood doses from boosterStatus.
     * Returns null if Sandalwood is not currently equipped.
     */
    static getSandalwoodDosesRemaining(): number | null {
        const boosterStatus = Booster.getBoosterFromStorage();
        const sandalwood = boosterStatus.mythic.find(b => b.item?.identifier === 'MB1');
        if (!sandalwood) return null;
        return sandalwood.usages_remaining;
    }

}
