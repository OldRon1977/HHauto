// Troll.ts -- Automates troll battles: energy management, fight selection,
// reward handling, and mythic event support.
//
// Trolls are PvE bosses that cost fight energy to battle. This module manages
// troll fight scheduling, selects which troll to fight (including event-specific
// trolls during mythic events), tracks energy regeneration, and processes
// fight rewards. Coordinates with MythicEvent.ts for event troll priorities.
//
// Depends on: TeamModule.ts (team selection), MythicEvent.ts (event troll routing)
// Used by: Service/index.ts (main automation loop)
//
import {
    checkTimer,
    clearTimer,
    ConfigHelper,
    deleteStoredValue,
    getHero,
    getHHVars,
    getPage,
    getSecondsLeft,
    getStoredJSON,
    getStoredValue,
    getTextForUI,
    HeroHelper,
    queryStringGetParam,
    RewardHelper,
    setHHVars,
    setStoredValue,
} from '../Helper/index';
import { gotoPage } from '../Service/index';
import { isJSON, logHHAuto } from '../Utils/index';
import { HHStoredVarPrefixKey, SK, TK } from '../config/index';
import { EventGirl } from '../model/EventGirl';
import { LoveRaid } from '../model/LoveRaid';
import { Booster } from './Booster';
import { EventModule, LoveRaidManager } from "./Events/index";
import { Harem } from "./harem/Harem";

export class Troll {

    static getEnergy() {
        return Number(getHHVars('Hero.energies.fight.amount'));
    }

    static getEnergyMax() {
        return Number(getHHVars('Hero.energies.fight.max_regen_amount'));
    }

    static getTrollWithGirls() {
        const girlDictionary = Harem.getGirlsList();
        const trollGirlsID = ConfigHelper.getHHScriptVars("trollGirlsID");
        const sideTrollGirlsID = ConfigHelper.getHHScriptVars("sideTrollGirlsID");
        const trollWithGirls:number[] = [];
    
        if (girlDictionary) {
            for (var tIdx = 0; tIdx < trollGirlsID.length; tIdx++) {
                trollWithGirls[tIdx] = 0;
                for (var pIdx = 0; pIdx < trollGirlsID[tIdx].length; pIdx++) {
                    for (var gIdx = 0; gIdx < trollGirlsID[tIdx][pIdx].length; gIdx++) {
                        var idGirl = parseInt(trollGirlsID[tIdx][pIdx][gIdx], 10);
                        if (idGirl != 0 && (girlDictionary.get(""+idGirl) == undefined || girlDictionary.get(""+idGirl).shards < 100)) {
                            trollWithGirls[tIdx] += 1;
                        }
                    }
                }
            }

            if (Object.keys(sideTrollGirlsID).length > 0) {
                for (let tIdx of Object.keys(sideTrollGirlsID)) {
                    trollWithGirls[Number(tIdx)-1] = 0;
                    for (var pIdx = 0; pIdx < sideTrollGirlsID[tIdx].length; pIdx++) {
                        for (var gIdx = 0; gIdx < sideTrollGirlsID[tIdx][pIdx].length; gIdx++) {
                            var idGirl = parseInt(sideTrollGirlsID[tIdx][pIdx][gIdx], 10);
                            if (idGirl != 0 && (girlDictionary.get("" + idGirl) == undefined || girlDictionary.get("" + idGirl).shards < 100)) {
                                trollWithGirls[Number(tIdx) -1] += 1;
                            }
                        }
                    }
                }
            }
        }
        return trollWithGirls;
    }

    static getPinfo(contest) {
        const threshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoTrollThreshold)) || 0;
        const runThreshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoTrollRunThreshold)) || 0;

        let Tegzd = '<li>';
        Tegzd += getTextForUI("autoTrollTitle","elementText")+' ' + Troll.getEnergy()+'/'+Troll.getEnergyMax()+contest;
        if (runThreshold > 0) {
            Tegzd += ' ('+threshold+'<'+Troll.getEnergy()+'<='+runThreshold+')';
            if(Troll.getEnergy() < runThreshold)  Tegzd += ' ' + getTextForUI("waitRunThreshold","elementText");
        }
        Tegzd += '</li>';

        const debugEnabled = getStoredValue(HHStoredVarPrefixKey + TK.Debug) === 'true';
        if (debugEnabled) Tegzd += '<li>'+Troll.debugNextTrollToFight() + '</li>';
        return Tegzd;
    }

    static isEnabled(){
        return ConfigHelper.getHHScriptVars("isEnabledTrollBattle", false) && getHHVars('Hero.infos.questing.id_world') > 0
    }

    static isTrollFightActivated(){
        return Troll.isEnabled() &&
        (
            getStoredValue(HHStoredVarPrefixKey + SK.autoTrollBattle) === "true"
            || getStoredValue(HHStoredVarPrefixKey + TK.autoTrollBattleSaveQuest) === "true"
            || getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythic) === "true"
            || getStoredValue(HHStoredVarPrefixKey + SK.plusEvent) === "true"
            || LoveRaidManager.isAnyActivated()
        )
    }

    static getLastTrollIdAvailable(logging = false, id_world: number = undefined): number {
        const isMainAdventure = getHHVars('Hero.infos.questing.choices_adventure') == 0;
        if (!id_world) {
            id_world = Number(getHHVars('Hero.infos.questing.id_world'));
        } else if (id_world <= 0) {
            logHHAuto(`id_world given ${id_world} must be wrong, default to current world`);
            id_world = Number(getHHVars('Hero.infos.questing.id_world'));
        }
        let trollIdMapping = [];

        if (isMainAdventure) {
            trollIdMapping = ConfigHelper.getHHScriptVars("trollIdMapping");
            if(ConfigHelper.isPshEnvironnement() && id_world > 10) {
                if (trollIdMapping.hasOwnProperty(id_world)) {
                    return trollIdMapping[id_world] // PSH parallel adventures
                }
                if (logging) logHHAuto(`Error Troll ID mapping need to be updated with world ${id_world}`);
            }
        } else {
            if (logging) logHHAuto(`Side adventure detected with world ${id_world}`);
            trollIdMapping = ConfigHelper.getHHScriptVars("sideTrollIdMapping");
        }

        if (Object.keys(trollIdMapping).length > 0 && trollIdMapping.hasOwnProperty(id_world)) {
            if (logging) logHHAuto(`Troll ID mapping (${trollIdMapping[id_world]}) found for world ${id_world}`);
            return trollIdMapping[id_world];
        }
        return id_world - 1;
    }

    static getTrollIdFromEvent(eventGirl:EventGirl){
        if(eventGirl && EventModule.isEventActive(eventGirl.event_id)) {
            return eventGirl.troll_id;
        }else {
            if(eventGirl) EventModule.clearEventData(eventGirl.event_id);
            logHHAuto("Event troll completed, clear event and get new troll ID");
            return Troll.getTrollIdToFight();
        }
    }

    static getTrollSelectedIndex(){
        let autoTrollSelectedIndex = getStoredValue(HHStoredVarPrefixKey + SK.autoTrollSelectedIndex);
        if (autoTrollSelectedIndex === undefined || isNaN(autoTrollSelectedIndex)) {
            autoTrollSelectedIndex = -1;
        } else {
            autoTrollSelectedIndex = Number(autoTrollSelectedIndex);
        }
        return autoTrollSelectedIndex;
    }

    static getTrollIdToFight(logging=true): number {

        const debugEnabled = getStoredValue(HHStoredVarPrefixKey + TK.Debug) === 'true';
        let trollWithGirls = getStoredJSON(HHStoredVarPrefixKey+TK.trollWithGirls, []);
        const autoTrollSelectedIndex = Troll.getTrollSelectedIndex();

        let TTF: number = 0;
        // const isMainAdventure = getHHVars('Hero.infos.questing.choices_adventure') == 0;
        const lastTrollIdAvailable = Troll.getLastTrollIdAvailable(logging);
        const eventGirl = EventModule.getEventGirl();
        const eventMythicGirl = EventModule.getEventMythicGirl();
        const allTrollRaids:LoveRaid[] = LoveRaidManager.isAnyActivated() ? LoveRaidManager.getTrollRaids() : [];
        const minRaidStars = LoveRaidManager.getMinRaidStars();
        const raidStarsRaids:LoveRaid[] = minRaidStars > 0 ? allTrollRaids.filter(raid => raid.girlGrade >= minRaidStars) : [];
        // +Raid: user-selected girl bypasses grade filter, auto-mode ("first") respects it
        const loveRaids:LoveRaid[] = LoveRaidManager.isActivated() ? allTrollRaids : [];
        if (debugEnabled && logging) {
            logHHAuto('eventGirl', eventGirl);
            logHHAuto('eventMythicGirl', eventMythicGirl);
            logHHAuto('loveRaids', loveRaids);
        }
        if (getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythic) === "true" && !checkTimer("eventMythicGoing") && eventMythicGirl.girl_id && eventMythicGirl.is_mythic)
        {
            if (logging) logHHAuto("Mythic Event troll fight");
            TTF = Troll.getTrollIdFromEvent(eventMythicGirl);
        }
        else if (raidStarsRaids.length > 0){
            if (logging) logHHAuto("Raid Stars troll fight (min grade " + minRaidStars + ")");
            const loveRaid = LoveRaidManager.getRaidToFight(raidStarsRaids, logging);
            if (loveRaid) {
                TTF = loveRaid.trollId;
            }
        }
        else if (getStoredValue(HHStoredVarPrefixKey + SK.plusEvent) === "true" && !checkTimer("eventGoing") && eventGirl.girl_id && !eventGirl.is_mythic) {
            if (logging) logHHAuto("Event troll fight");
            TTF = Troll.getTrollIdFromEvent(eventGirl);
        }
        else if (getStoredValue(HHStoredVarPrefixKey + SK.autoTrollBattle) === "true" && (autoTrollSelectedIndex === 98 || autoTrollSelectedIndex === 99)) {
            if (trollWithGirls === undefined || trollWithGirls.length === 0) {
                if (logging) logHHAuto("No troll with girls from storage, parsing game info ...");
                trollWithGirls = Troll.getTrollWithGirls();
                if (trollWithGirls.length === 0) {
                    if (logging) logHHAuto("Need girls list, going to Waifu page to get them");
                    setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDWaifu"));
                    return -1;
                }
                setStoredValue(HHStoredVarPrefixKey+TK.trollWithGirls, JSON.stringify(trollWithGirls));
            }

            if (trollWithGirls !== undefined && trollWithGirls.length > 0) {
                if (autoTrollSelectedIndex === 98) {
                    if (debugEnabled && logging) logHHAuto("First troll with girls from storage");
                    TTF = trollWithGirls.findIndex((troll: number) => troll > 0) + 1;
                }
                else if (autoTrollSelectedIndex === 99) {
                    if (debugEnabled && logging) logHHAuto("Last troll with girls from storage");
                    TTF = trollWithGirls.findLastIndex((troll: number) => troll > 0) + 1;
                    if(TTF > lastTrollIdAvailable) {
                        TTF=lastTrollIdAvailable;
                    }
                }
            } else if(getPage()!==ConfigHelper.getHHScriptVars("pagesIDHome")) {
                if (logging) logHHAuto("Can't get troll with girls, going to home page to get girl list.");
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
            } else {
                if (logging) logHHAuto("Can't get troll with girls, going to last troll.");
                TTF=lastTrollIdAvailable;
            }
        }
        else if (LoveRaidManager.isActivated() && loveRaids.length > 0){
            const loveRaid = LoveRaidManager.getRaidToFight(loveRaids, logging);
            if (loveRaid) {
                TTF = loveRaid.trollId;
            }
        }
        else if(getStoredValue(HHStoredVarPrefixKey + SK.autoTrollBattle) === "true" && autoTrollSelectedIndex > 0 && autoTrollSelectedIndex < 98)
        {
            TTF=autoTrollSelectedIndex;
            if (logging) logHHAuto("Custom troll fight.");
        }
        else if(getStoredValue(HHStoredVarPrefixKey + SK.autoTrollBattle) === "true")
        {
            TTF = lastTrollIdAvailable;
            if (logging) logHHAuto("Last troll fight: " + TTF);
        }

        if (getStoredValue(HHStoredVarPrefixKey + SK.autoTrollBattle) === "true"
            && getStoredValue(HHStoredVarPrefixKey+TK.autoTrollBattleSaveQuest) === "true" && logging)
        {
            TTF = lastTrollIdAvailable;
            logHHAuto("Last troll fight for quest item: " + TTF);
            //setStoredValue(HHStoredVarPrefixKey+TK.autoTrollBattleSaveQuest, "false");
            setStoredValue(HHStoredVarPrefixKey+TK.questRequirement, "none");
        }
        const trollz = ConfigHelper.getHHScriptVars("trollzList");
        const sideTrollz = ConfigHelper.getHHScriptVars("sideTrollzList");

        // Check if selected troll is actually unlocked (love raid girls can be on locked trolls)
        if (TTF > 0 && TTF > lastTrollIdAvailable) {
            logHHAuto(`Troll ${TTF} (${trollz[Number(TTF)]}) not unlocked (last available: ${lastTrollIdAvailable}), resetting raid selector to "Choose a girl".`);
            setStoredValue(HHStoredVarPrefixKey + SK.autoLoveRaidSelectedIndex, "0");
            TTF = 0;
        }

        if (TTF <= 0) {
            if (getStoredValue(HHStoredVarPrefixKey + SK.autoTrollBattle) === "true") {
                // Only fallback to last troll if normal troll fighting is enabled
                TTF = lastTrollIdAvailable > 0 ? lastTrollIdAvailable : 1;
                if (logging) logHHAuto(`Error: wrong troll target found. Backup to ${TTF}`);
            } else {
                // Events/Raids only mode — no target available, skip fight
                if (logging) logHHAuto("No event/raid troll target available, skipping.");
                return 0;
            }
        }
        if (TTF > 0 && !trollz.hasOwnProperty(TTF) && !sideTrollz.hasOwnProperty(TTF)) {
            if (logging) logHHAuto("Error: New troll implemented '"+TTF+"' (List to be updated) or wrong troll target found");
            if (getStoredValue(HHStoredVarPrefixKey + SK.autoTrollBattle) === "true") {
                TTF = 1;
            } else {
                return 0;
            }
        }
        return TTF;
    }

    static debugNextTrollToFight() {
        let TTF = Troll.getTrollIdToFight(false);
        const trollz = ConfigHelper.getHHScriptVars("trollzList");
        const sideTrollz = ConfigHelper.getHHScriptVars("sideTrollzList");
        return `Next troll: ${trollz[Number(TTF)] ? trollz[Number(TTF)] : sideTrollz[Number(TTF)]} (${TTF})`;
    }

    static async doBossBattle()
    {
        var currentPower = Troll.getEnergy();
        if(currentPower < 1)
        {
            const eventGirl = EventModule.getEventGirl();
            const eventMythicGirl = EventModule.getEventMythicGirl();
            const loveRaid = LoveRaidManager.isAnyActivated() ? LoveRaidManager.getRaidToFight(LoveRaidManager.getTrollRaids(), false) : undefined;
            //logHHAuto("No power for battle.");
            if (
                !Troll.canBuyFight(eventGirl).canBuy && !Troll.canBuyFight(eventMythicGirl).canBuy &&
                !Troll.canBuyFightForRaid(loveRaid).canBuy)
            {
                return false;
            }
        }

        const runThreshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoTrollRunThreshold)) || 0;
        if (runThreshold > 0 && currentPower == runThreshold) {
            setStoredValue(HHStoredVarPrefixKey+TK.TrollHumanLikeRun, "true");
        }

        let TTF = Troll.getTrollIdToFight();
        const trollz = ConfigHelper.getHHScriptVars("trollzList");
        const currentPage = getPage();

        if (!TTF || TTF <= 0) {
            if (getStoredValue(HHStoredVarPrefixKey + SK.autoTrollBattle) === "true") {
                if (getStoredValue(HHStoredVarPrefixKey + TK.TrollInvalid) === "true") {
                    logHHAuto(`ERROR: Invalid troll N°${TTF}, again, going to first troll`);
                    TTF = 1;
                } else {
                    logHHAuto(`ERROR: Invalid troll N°${TTF}, do not fight, retry...`);
                    setStoredValue(HHStoredVarPrefixKey + TK.TrollInvalid, "true");
                    return true;
                }
            } else {
                logHHAuto("No troll target found (events/raids only mode), skipping fight.");
                return false;
            }
        }

        const needSW = Booster.needSandalWoodEquipped(TTF);
        logHHAuto(`[SW-DEBUG] Troll fight entry: TTF=${TTF}, needSandalWoodEquipped=${needSW}, currentPage=${currentPage}`);
        if (needSW)
        {
            if (currentPage !== ConfigHelper.getHHScriptVars("pagesIDShop")) {
                logHHAuto('[SW-DEBUG] Go to Shop page to update booster status');
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDShop"));
                return true;
            } else {
                logHHAuto('[SW-DEBUG] On shop page, collecting boosters from market');
                Booster.collectBoostersFromMarket();
                logHHAuto('[SW-DEBUG] Attempting to equip Sandalwood...');
                const equipped = await Booster.equipeSandalWoodIfNeeded(TTF);
                logHHAuto(`[SW-DEBUG] equipeSandalWoodIfNeeded returned: ${equipped}`);
                if(equipped) {
                    logHHAuto('[SW-DEBUG] Sandalwood newly equipped, refreshing booster status from market');
                    Booster.collectBoostersFromMarket();
                }
            }
        }

        logHHAuto(`Fighting troll N°${TTF}, ${trollz[Number(TTF)]}`);

        // Battles the latest boss.
        // Navigate to latest boss.
        //console.log(getPage());
        if (currentPage === ConfigHelper.getHHScriptVars("pagesIDTrollPreBattle") && window.location.search.includes("id_opponent=" + TTF))
        {
            // On the battle screen.
            await Troll.CrushThemFights();
            return true;
        }
        else
        {
            logHHAuto("Navigating to chosen Troll.");
            setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
            logHHAuto("setting autoloop to false");
            //week 28 new battle modification
            //location.href = "/battle.html?id_troll=" + TTF;
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDTrollPreBattle"),{id_opponent:TTF});
            //End week 28 new battle modification
            return true;
        }
    }

    static async CrushThemFights()
    {
        if (getPage() === ConfigHelper.getHHScriptVars("pagesIDTrollPreBattle")) {
            // On battle page.
            logHHAuto("On Pre battle page.");
            let TTF:number = Number(queryStringGetParam(window.location.search,'id_opponent'));
            const trollz = ConfigHelper.getHHScriptVars("trollzList");

            let battleButton = $('#pre-battle .battle-buttons .green_button_L.battle-action-button');
            let battleButtonX10 = $('#pre-battle .battle-buttons button.autofight[data-battles="10"]');
            let battleButtonX50 = $('#pre-battle .battle-buttons button.autofight[data-battles="50"]');
            let battleButtonX10Price = Number(battleButtonX10.attr('price'));
            let battleButtonX50Price = Number(battleButtonX50.attr('price'));
            // let Hero=getHero();
            let hcConfirmValue = getHHVars('Hero.infos.hc_confirm');
            let previousPower = getStoredValue(HHStoredVarPrefixKey+TK.trollPoints) ?? 0;
            let currentPower = Troll.getEnergy();

            var checkPreviousFightDone = function(){
                // The goal of this function is to detect slow server response to avoid loop without fight
                if(previousPower > 0 && previousPower == currentPower) {
                    setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
                    logHHAuto("Server seems slow to reply, setting autoloop to false to wait for troll page to load");
                }
            }

            //check if girl still available at troll in case of event
            if (TTF !== null)
            {
                let eventTrollGirl:EventGirl;
                const eventGirl = EventModule.getEventGirl();
                const eventMythicGirl = EventModule.getEventMythicGirl();
                let loveRaid: LoveRaid = null;
                const rewardGirlz = $("#pre-battle .oponnent-panel .opponent_rewards .rewards_list .slot.girl_ico[data-rewards]");
                const trollGirlRewards = rewardGirlz.attr('data-rewards') || '';
                const autoTrollSelectedIndex = Troll.getTrollSelectedIndex();
                if (eventMythicGirl.girl_id && TTF === eventMythicGirl.troll_id && eventMythicGirl.is_mythic && getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythic) === "true")
                {
                    eventTrollGirl = eventMythicGirl;
                    if (rewardGirlz.length === 0 || !trollGirlRewards.includes('"id_girl":' + eventMythicGirl.girl_id))
                    {
                        logHHAuto(`Seems ${eventMythicGirl.name} is no more available at troll ${trollz[Number(TTF)]}. Going to event page.`);
                        EventModule.parseEventPage(eventMythicGirl.event_id);
                        return true;
                    }
                }
                if (eventGirl.girl_id && TTF === eventGirl.troll_id && !eventGirl.is_mythic && getStoredValue(HHStoredVarPrefixKey + SK.plusEvent) === "true")
                {
                    eventTrollGirl = eventGirl;
                    if (rewardGirlz.length === 0 || !trollGirlRewards.includes('"id_girl":' + eventGirl.girl_id)) {
                        logHHAuto(`Seems ${eventGirl.name} is no more available at troll ${trollz[Number(TTF)]}. Going to event page.`);
                        EventModule.parseEventPage(eventGirl.event_id);
                        return true;
                    }
                }
                if (rewardGirlz.length === 0 && (autoTrollSelectedIndex === 98 || autoTrollSelectedIndex === 99))
                {
                    logHHAuto(`Seems no more girls available at troll ${trollz[Number(TTF)]}, looking for next troll.`);
                    let trollWithGirls = getStoredJSON(HHStoredVarPrefixKey + TK.trollWithGirls, []);
                    trollWithGirls[TTF] = 0;
                    setStoredValue(HHStoredVarPrefixKey + TK.trollWithGirls, JSON.stringify(trollWithGirls));
                    const newTroll = Troll.getTrollIdToFight();
                    if (TTF != newTroll) {
                        gotoPage(ConfigHelper.getHHScriptVars("pagesIDTrollPreBattle"), { id_opponent: newTroll });
                        return true;
                    } else {
                        logHHAuto(`Same troll found, go for it.`);
                    }
                }
                let canBuyFightsResult = Troll.canBuyFight(eventTrollGirl);
                if (
                    (canBuyFightsResult.canBuy && currentPower === 0)
                    ||
                    (
                        canBuyFightsResult.canBuy
                        && currentPower < 50
                        && canBuyFightsResult.max === 50
                        && getStoredValue(HHStoredVarPrefixKey+SK.useX50Fights) === "true"
                        && (eventTrollGirl?.is_mythic || getStoredValue(HHStoredVarPrefixKey+SK.useX50FightsAllowNormalEvent) === "true")
                        && TTF === eventTrollGirl?.troll_id
                    )
                    ||
                    (
                        canBuyFightsResult.canBuy
                        && currentPower < 10
                        && canBuyFightsResult.max === 20
                        && getStoredValue(HHStoredVarPrefixKey + SK.useX10Fights) === "true"
                        && (eventTrollGirl?.is_mythic || getStoredValue(HHStoredVarPrefixKey+SK.useX10FightsAllowNormalEvent) === "true")
                        && TTF === eventTrollGirl?.troll_id
                    )
                )
                {
                    Troll.RechargeCombat(canBuyFightsResult);
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDTrollPreBattle"),{id_opponent:TTF});
                    return true;
                }

                if (LoveRaidManager.isAnyActivated()) {
                    const trollRaids = LoveRaidManager.getTrollRaids();
                    loveRaid = trollRaids.find(raid => raid.trollId === TTF);
                    if (loveRaid && (rewardGirlz.length === 0 || !trollGirlRewards.includes('"id_girl":' + loveRaid.id_girl))) {
                        logHHAuto(`Seems girl ${loveRaid.id_girl} is no more available at troll ${trollz[Number(TTF)]}. Going to love Raid.`);
                        clearTimer('nextLoveRaidTime');
                        gotoPage(ConfigHelper.getHHScriptVars("pagesIDLoveRaid"));
                        return true;
                    }
                    const canBuyFightsResultLoveRaid = Troll.canBuyFightForRaid(loveRaid);
                    if (
                        (canBuyFightsResultLoveRaid.canBuy && currentPower === 0)
                        ||
                        (
                            canBuyFightsResultLoveRaid.canBuy
                            && currentPower < 50
                            && canBuyFightsResultLoveRaid.max === 50
                            && getStoredValue(HHStoredVarPrefixKey + SK.useX50Fights) === "true"
                            && getStoredValue(HHStoredVarPrefixKey + SK.useX50FightsAllowNormalEvent) === "true"
                            && TTF === loveRaid?.id_girl
                        )
                        ||
                        (
                            canBuyFightsResultLoveRaid.canBuy
                            && currentPower < 10
                            && canBuyFightsResultLoveRaid.max === 20
                            && getStoredValue(HHStoredVarPrefixKey + SK.useX10Fights) === "true"
                            && getStoredValue(HHStoredVarPrefixKey + SK.useX10FightsAllowNormalEvent) === "true"
                            && TTF === loveRaid?.id_girl
                        )
                    )
                    {
                        Troll.RechargeCombat(canBuyFightsResultLoveRaid);
                        gotoPage(ConfigHelper.getHHScriptVars("pagesIDTrollPreBattle"), { id_opponent: TTF });
                        return true;
                    }
                }


                if
                    (
                        (Number.isInteger(eventTrollGirl?.shards) || loveRaid?.girl_to_win)
                        && battleButtonX10.length > 0
                        && battleButtonX50.length > 0
                        && getStoredValue(HHStoredVarPrefixKey+TK.autoTrollBattleSaveQuest) !== "true"
                    )
                {

                    const remainingEventShards: number = eventTrollGirl ? Number(100 - eventTrollGirl?.shards): 0;
                    const remainingLoveRaidShards: number = loveRaid ? Number(100 - loveRaid?.girl_shards) : 0;
                    const remainingShards = remainingEventShards + remainingLoveRaidShards; // If Troll have both
                    let bypassThreshold = (
                        (eventTrollGirl?.is_mythic
                        && canBuyFightsResult.canBuy
                        ) // eventGirl available and buy comb true
                        || (eventTrollGirl?.is_mythic && getStoredValue(HHStoredVarPrefixKey+SK.plusEventMythic) ==="true"
                        )
                        || (loveRaid?.girl_to_win && getStoredValue(HHStoredVarPrefixKey+SK.autoTrollLoveRaidByPassThreshold) === "true"
                        )
                    );

                    // Sandalwood batch-sizing: compute recommended batch based on doses + shards
                    const dosesRemaining = Booster.getSandalwoodDosesRemaining();
                    logHHAuto(`[SW-DEBUG] CrushThemFights: eventShards=${remainingEventShards}, raidShards=${remainingLoveRaidShards}, totalRemaining=${remainingShards}, dosesRemaining=${dosesRemaining}, isMythic=${eventTrollGirl?.is_mythic}, power=${currentPower}`);
                    const recommendedBatch = Booster.getRecommendedBatchSize(
                        Math.min(remainingEventShards || 100, remainingLoveRaidShards || 100),
                        dosesRemaining,
                        {
                            useX50: getStoredValue(HHStoredVarPrefixKey+SK.useX50Fights) === "true",
                            useX10: getStoredValue(HHStoredVarPrefixKey+SK.useX10Fights) === "true",
                            sandalwoodShardsX10Limit: Number(getStoredValue(HHStoredVarPrefixKey+SK.sandalwoodShardsX10Limit)) || 80,
                            sandalwoodShardsX1Limit: Number(getStoredValue(HHStoredVarPrefixKey+SK.sandalwoodShardsX1Limit)) || 95,
                            sandalwoodDosesX10Limit: Number(getStoredValue(HHStoredVarPrefixKey+SK.sandalwoodDosesX10Limit)) || 6,
                            sandalwoodDosesX1Limit: Number(getStoredValue(HHStoredVarPrefixKey+SK.sandalwoodDosesX1Limit)) || 3,
                        }
                    );
                    logHHAuto(`[SW-DEBUG] CrushThemFights: recommendedBatch=${recommendedBatch}`);

                    const minShardsx50 = getStoredValue(HHStoredVarPrefixKey + SK.minShardsX50);
                    if (getStoredValue(HHStoredVarPrefixKey+SK.useX50Fights) === "true"
                        && minShardsx50 && Number.isInteger(Number(minShardsx50)) && remainingShards >= Number(minShardsx50)
                        && (battleButtonX50Price === 0 || HeroHelper.getKoban()>=battleButtonX50Price+Number(getStoredValue(HHStoredVarPrefixKey+SK.kobanBank)))
                        && currentPower >= 50
                        && (currentPower >= (Number(getStoredValue(HHStoredVarPrefixKey+SK.autoTrollThreshold)) + 50)
                            || bypassThreshold
                        )
                        && (eventTrollGirl?.is_mythic || getStoredValue(HHStoredVarPrefixKey+SK.useX50FightsAllowNormalEvent) === "true")
                        && recommendedBatch >= 50
                    )
                    {
                        logHHAuto("Going to crush 50 times: "+trollz[Number(TTF)]+' for '+battleButtonX50Price+' kobans.');

                        setHHVars('Hero.infos.hc_confirm',true);
                        // We have the power.
                        //replaceCheatClick();
                        Booster.resetBattleResponseFlag();
                        battleButtonX50[0].click();
                        setHHVars('Hero.infos.hc_confirm',hcConfirmValue);
                        //setStoredValue(HHStoredVarPrefixKey+TK.EventFightsBeforeRefresh", Number(getStoredValue(HHStoredVarPrefixKey+TK.EventFightsBeforeRefresh")) - 50);
                        logHHAuto(`Crushed 50 times: ${trollz[Number(TTF)]} for ${battleButtonX50Price} kobans.`);
                        if (getStoredValue(HHStoredVarPrefixKey+TK.questRequirement) === "battle") {
                            // Battle Done.
                            setStoredValue(HHStoredVarPrefixKey+TK.questRequirement, "none");
                        }
                        RewardHelper.ObserveAndGetGirlRewards();
                        logHHAuto('[SW-DEBUG] x50: waiting for battle response...');
                        await Booster.waitForBattleResponse();
                        logHHAuto('[SW-DEBUG] x50: battle response received, done');
                        return;
                    }
                    else
                    {
                        if (getStoredValue(HHStoredVarPrefixKey+SK.useX50Fights) === "true")
                        {
                            const x50BlockedBy = recommendedBatch < 50 ? ` (SW batch cap: ${recommendedBatch})` : '';
                            logHHAuto(`Unable to use x50 for ${battleButtonX50Price} kobans,fights : ${Troll.getEnergy()}/50, remaining shards : ${remainingShards}/${getStoredValue(HHStoredVarPrefixKey + SK.minShardsX50)}, kobans : ${HeroHelper.getKoban()}/${Number(getStoredValue(HHStoredVarPrefixKey + SK.kobanBank))}${x50BlockedBy}`);
                        }
                    }

                    const minShardsX10 = getStoredValue(HHStoredVarPrefixKey + SK.minShardsX10);
                    if (getStoredValue(HHStoredVarPrefixKey+SK.useX10Fights) === "true"
                        && minShardsX10 && Number.isInteger(Number(minShardsX10)) && remainingShards >= Number(minShardsX10)
                        && (battleButtonX10Price === 0 || HeroHelper.getKoban()>=battleButtonX10Price+Number(getStoredValue(HHStoredVarPrefixKey+SK.kobanBank)))
                        && currentPower >= 10
                        && (currentPower >= (Number(getStoredValue(HHStoredVarPrefixKey+SK.autoTrollThreshold)) + 10)
                            || bypassThreshold
                        )
                        && (eventTrollGirl?.is_mythic || getStoredValue(HHStoredVarPrefixKey+SK.useX10FightsAllowNormalEvent) === "true")
                        && recommendedBatch >= 10
                    )
                    {
                        logHHAuto(`Going to crush 10 times: ${trollz[Number(TTF)]} for ${battleButtonX10Price} kobans.`);

                        setHHVars('Hero.infos.hc_confirm',true);
                        // We have the power.
                        //replaceCheatClick();
                        Booster.resetBattleResponseFlag();
                        battleButtonX10[0].click();
                        setHHVars('Hero.infos.hc_confirm',hcConfirmValue);
                        //setStoredValue(HHStoredVarPrefixKey+TK.EventFightsBeforeRefresh", Number(getStoredValue(HHStoredVarPrefixKey+TK.EventFightsBeforeRefresh")) - 10);
                        logHHAuto(`Crushed 10 times: ${trollz[Number(TTF)]} for ${battleButtonX10Price} kobans.`);
                        if (getStoredValue(HHStoredVarPrefixKey+TK.questRequirement) === "battle") {
                            // Battle Done.
                            setStoredValue(HHStoredVarPrefixKey+TK.questRequirement, "none");
                        }
                        RewardHelper.ObserveAndGetGirlRewards();
                        logHHAuto('[SW-DEBUG] x10: waiting for battle response...');
                        await Booster.waitForBattleResponse();
                        logHHAuto('[SW-DEBUG] x10: battle response received, done');
                        return;
                    }
                    else
                    {
                        if (getStoredValue(HHStoredVarPrefixKey+SK.useX10Fights) === "true")
                        {
                            const x10BlockedBy = recommendedBatch < 10 ? ` (SW batch cap: ${recommendedBatch})` : '';
                            logHHAuto(`Unable to use x10 for ${battleButtonX10Price} kobans,fights : ${Troll.getEnergy()}/10, remaining shards : ${remainingShards}/${getStoredValue(HHStoredVarPrefixKey + SK.minShardsX10)}, kobans : ${HeroHelper.getKoban()}/${Number(getStoredValue(HHStoredVarPrefixKey + SK.kobanBank))}${x10BlockedBy}`);
                        }
                    }
                }

                //Crushing one by one


                if (currentPower > 0)
                {
                    if ($('#pre-battle div.battle-buttons a.single-battle-button[disabled]').length>0)
                    {
                        logHHAuto("Battle Button seems disabled, force reload of page.");
                        gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                        return;
                    }
                    if(battleButton === undefined || battleButton.length === 0)
                    {
                        logHHAuto("Battle Button was undefined. Disabling all auto-battle.");
                        (<HTMLInputElement>document.getElementById("autoTrollBattle")).checked = false;
                        setStoredValue(HHStoredVarPrefixKey+SK.autoTrollBattle, "false");

                        //document.getElementById("autoArenaCheckbox").checked = false;
                        if (getStoredValue(HHStoredVarPrefixKey+TK.questRequirement) === "battle")
                        {
                            (<HTMLInputElement>document.getElementById("autoQuest")).checked = false;
                            setStoredValue(HHStoredVarPrefixKey+SK.autoQuest, "false");

                            logHHAuto("Auto-quest disabled since it requires battle and auto-battle has errors.");
                        }
                        return;
                    }
                    logHHAuto("Crushing: "+trollz[Number(TTF)]);
                    //console.log(battleButton);
                    //replaceCheatClick();
                    checkPreviousFightDone();
                    setStoredValue(HHStoredVarPrefixKey+TK.trollPoints, currentPower);
                    battleButton[0].click();
                }
                else
                {
                    // We need more power.
                    const battle_price = 1; // TODO what is the expected value here ?
                    logHHAuto(`Battle requires ${battle_price} power, having ${currentPower}.`);
                    setStoredValue(HHStoredVarPrefixKey+TK.battlePowerRequired, battle_price);
                    if(getStoredValue(HHStoredVarPrefixKey+TK.questRequirement) === "battle")
                    {
                        setStoredValue(HHStoredVarPrefixKey+TK.questRequirement, "P"+battle_price);
                    }
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                    return;
                }
            }
            else
            {
                checkPreviousFightDone();
                setStoredValue(HHStoredVarPrefixKey+TK.trollPoints, currentPower);
                //replaceCheatClick();
                battleButton[0].click();
            }
        }
        else
        {
            logHHAuto('Unable to identify page.');
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
            return;
        }
        return;
    }

    static RechargeCombat(canBuyResult:{canBuy:boolean, price:number, max:number, toBuy:number, event_mythic:string, type:string})
    {
        const Hero=getHero();

        //let canBuyResult = Troll.canBuyFight(eventTrollGirl);
        if (canBuyResult.canBuy)
        {
            logHHAuto('Recharging '+canBuyResult.toBuy+' fights for '+canBuyResult.price+' kobans.');
            let hcConfirmValue = getHHVars('Hero.infos.hc_confirm');
            setHHVars('Hero.infos.hc_confirm',true);
            // We have the power.
            //replaceCheatClick();
            //console.log($("plus[type='energy_fight']"), canBuyResult.price,canBuyResult.type, canBuyResult.max);
            Hero.recharge($("button.orange_text_button.manual-recharge"), canBuyResult.type, canBuyResult.toBuy, canBuyResult.price);
            setHHVars('Hero.infos.hc_confirm',hcConfirmValue);
            logHHAuto('Recharged up to '+canBuyResult.max+' fights for '+canBuyResult.price+' kobans.');
        }
    }

    
    static canBuyFight(eventGirl:EventGirl, logging=true)
    {
        const type="fight";
        let hero=getHero();
        let result = {canBuy:false, price:0, max:0, toBuy:0, event_mythic:"false", type:type};
        const MAX_BUY = 200;
        let maxx50 = 50;
        let maxx20 = 20;
        const currentFight = Troll.getEnergy();
        const eventAutoBuy =  Math.min(Number(getStoredValue(HHStoredVarPrefixKey+SK.autoBuyTrollNumber))       || maxx20, MAX_BUY-currentFight);
        const mythicAutoBuy = Math.min(Number(getStoredValue(HHStoredVarPrefixKey+SK.autoBuyMythicTrollNumber)) || maxx20, MAX_BUY-currentFight);
        const pricePerFight = hero.energies[type].seconds_per_point * (unsafeWindow.hh_prices[type + '_cost_per_minute'] / 60);
        let remainingShards:number;

        if (Number.isInteger(eventGirl?.shards))
        {
            if (
                (
                    getStoredValue(HHStoredVarPrefixKey+SK.buyCombat) =="true"
                    && getStoredValue(HHStoredVarPrefixKey+SK.plusEvent) ==="true"
                    && getSecondsLeft("eventGoing") !== 0
                    && !Number.isNaN(Number(getStoredValue(HHStoredVarPrefixKey + SK.buyCombTimer)))
                    && getSecondsLeft("eventGoing") < getStoredValue(HHStoredVarPrefixKey+SK.buyCombTimer)*3600
                    && eventGirl.girl_id && !eventGirl.is_mythic
                )
                ||
                (
                    getStoredValue(HHStoredVarPrefixKey+SK.plusEventMythic) ==="true"
                    && getStoredValue(HHStoredVarPrefixKey+SK.buyMythicCombat) === "true"
                    && getSecondsLeft("eventMythicGoing") !== 0
                    && !Number.isNaN(Number(getStoredValue(HHStoredVarPrefixKey + SK.buyMythicCombTimer)))
                    && getSecondsLeft("eventMythicGoing") < getStoredValue(HHStoredVarPrefixKey+SK.buyMythicCombTimer)*3600
                    && eventGirl.is_mythic
                )
            )
            {
                result.event_mythic = eventGirl.is_mythic.toString();
            }
            else
            {
                return result;
            }

            maxx50 = result.event_mythic === "true" ? Math.max(maxx50, mythicAutoBuy) : Math.max(maxx50, eventAutoBuy);
            maxx20 = result.event_mythic === "true" ? mythicAutoBuy : eventAutoBuy;

            //console.log(result);
            remainingShards = Number(100 - eventGirl.shards);
            const minShardsx50 = getStoredValue(HHStoredVarPrefixKey + SK.minShardsX50);
            if
                (
                    minShardsx50 !== undefined && Number.isInteger(Number(minShardsx50)) && remainingShards >= Number(minShardsx50)
                    && HeroHelper.getKoban()>= (pricePerFight * maxx50)+Number(getStoredValue(HHStoredVarPrefixKey+SK.kobanBank))
                    && getStoredValue(HHStoredVarPrefixKey+SK.useX50Fights) === "true"
                    && currentFight < maxx50
                    && ( result.event_mythic === "true" || getStoredValue(HHStoredVarPrefixKey+SK.useX50FightsAllowNormalEvent) === "true")
                )
            {
                result.max = maxx50;
                result.canBuy = true;
                result.price = pricePerFight * maxx50;
                result.toBuy = maxx50;
            }
            else
            {

                if (logging && getStoredValue(HHStoredVarPrefixKey+SK.useX50Fights) === "true")
                {
                    logHHAuto(`Unable to recharge up to ${maxx50} for ${pricePerFight * maxx50} kobans : current energy : ${currentFight}, remaining shards : ${remainingShards}/${getStoredValue(HHStoredVarPrefixKey + SK.minShardsX50)}, kobans : ${HeroHelper.getKoban()}/${Number(getStoredValue(HHStoredVarPrefixKey + SK.kobanBank))}`);
                }
                if (HeroHelper.getKoban()>=(pricePerFight * maxx20)+Number(getStoredValue(HHStoredVarPrefixKey+SK.kobanBank)))
                {
                    result.max = maxx20;
                    result.canBuy = true;
                    result.price = pricePerFight * maxx20;
                    result.toBuy = maxx20;
                }
                else if (logging)
                {
                    logHHAuto(`Unable to recharge up to ${maxx20} for ${pricePerFight * maxx20} kobans : current energy : ${currentFight}, kobans : ${HeroHelper.getKoban()}/${Number(getStoredValue(HHStoredVarPrefixKey + SK.kobanBank))}`);
                }
            }
        }

        return result;
    }

    static canBuyFightForRaid(raid:LoveRaid, logging=true)
    {
        const type="fight";
        let hero=getHero();
        let result = {canBuy:false, price:0, max:0, toBuy:0, event_mythic:"false", type:type};
        const MAX_BUY = 200;
        const maxx20 = 20;
        const currentFight = Troll.getEnergy();
        const eventAutoBuy = Math.min(Number(getStoredValue(HHStoredVarPrefixKey + SK.autoBuyLoveRaidTrollNumber)) || maxx20, MAX_BUY - currentFight);
        const maxx50 = Math.max(50, eventAutoBuy);
        const pricePerFight = hero.energies[type].seconds_per_point * (unsafeWindow.hh_prices[type + '_cost_per_minute'] / 60);
        let remainingShards:number;

        if (Number.isInteger(raid?.girl_shards))
        {
            if (
                    getStoredValue(HHStoredVarPrefixKey +SK.buyLoveRaidCombat) =="true"
                    && LoveRaidManager.isAnyActivated()
                    && raid.seconds_until_event_end > 0 // new Date() < new Date(raid.end_datetime)
                    && raid.id_girl
                )
            {
                //
            }
            else
            {
                return result;
            }

            //console.log(result);
            remainingShards = Number(100 - raid.girl_shards);
            const minShardsx50 = getStoredValue(HHStoredVarPrefixKey + SK.minShardsX50);
            if (
                minShardsx50 !== undefined && Number.isInteger(Number(minShardsx50)) && remainingShards >= Number(minShardsx50)
                && HeroHelper.getKoban() >= (pricePerFight * maxx50) + Number(getStoredValue(HHStoredVarPrefixKey + SK.kobanBank))
                && getStoredValue(HHStoredVarPrefixKey + SK.useX50Fights) === "true"
                && currentFight < maxx50
                //&& (result.event_mythic === "true" || getStoredValue(HHStoredVarPrefixKey + SK.useX50FightsAllowNormalEvent) === "true")
            ) {
                result.max = maxx50;
                result.canBuy = true;
                result.price = pricePerFight * maxx50;
                result.toBuy = maxx50;
            }
            else {

                if (logging && getStoredValue(HHStoredVarPrefixKey + SK.useX50Fights) === "true") {
                    logHHAuto(`Unable to recharge up to ${maxx50} for ${pricePerFight * maxx50} kobans : current energy : ${currentFight}, remaining shards : ${remainingShards}/${getStoredValue(HHStoredVarPrefixKey + SK.minShardsX50)}, kobans : ${HeroHelper.getKoban()}/${Number(getStoredValue(HHStoredVarPrefixKey + SK.kobanBank))}`);
                }
                if (HeroHelper.getKoban() >= (pricePerFight * eventAutoBuy) + Number(getStoredValue(HHStoredVarPrefixKey + SK.kobanBank)))
                {
                    result.max = maxx20;
                    result.canBuy = true;
                    result.price = pricePerFight * eventAutoBuy;
                    result.toBuy = eventAutoBuy;
                }
                else if (logging) {
                    logHHAuto(`Unable to recharge up to ${eventAutoBuy} for ${pricePerFight * eventAutoBuy} kobans : current energy : ${currentFight}, kobans : ${HeroHelper.getKoban()}/${Number(getStoredValue(HHStoredVarPrefixKey + SK.kobanBank))}`);
                }
            }
        }

        return result;
    }
}