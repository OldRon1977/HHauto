// RewardHelper.ts
//
// Detects, classifies, and renders in-game reward slots. The game
// displays rewards in DOM elements with CSS classes like "slot_soft_currency"
// or data attributes. This helper inspects those elements to determine
// the reward type (girl shards, currency, energy, equipment, etc.) and
// quantity, then can render summary HTML for the HHAuto overlay. The type
// is also what the collect lists are matched against: a tier is collected
// only when the type of each of its slots is ticked.
//
// Also handles the post-battle reward popup: after a troll fight that
// drops girl shards, ObserveAndGetGirlRewards() uses a MutationObserver
// to detect the popup, parse which girl received shards, update stored
// event progress, and navigate to the next appropriate page.
//
// Why MutationObserver: The reward popup is rendered asynchronously by
// the game after the battle animation. Polling would be wasteful and
// unreliable; observing attribute changes catches it immediately.
//
// Used by: Event modules (progress tracking), PlaceOfPower, Season,
//          Troll module (post-fight navigation)
import { gotoPage } from "../Service/PageNavigationService";
import { logHHAuto } from "../Utils/LogUtils";
import { parsePrice } from "./PriceHelper";
import { ConfigHelper } from "./ConfigHelper";
import { getTextForUI } from "./LanguageHelper";
import { NumberHelper } from "./NumberHelper";
import { getStoredJSON, setStoredValue } from "./StorageHelper";
import { randomInterval } from "./TimeHelper";
import { EventModule } from "../Module/Events/EventModule";
import { LoveRaidManager } from "../Module/Events/LoveRaidManager";
import { queryStringGetParam } from "./UrlHelper";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { TK } from "../config/StorageKeys";
import { EventGirl } from '../model/EventGirl';

export class RewardHelper {
    static getRewardTypeBySlot(inSlot: any): string
    {
        let reward = "undetected";
        if (inSlot && inSlot.className?.indexOf('slot') >= 0)
        {
            if (inSlot.getAttribute("cur") !== null)
            {
                reward = inSlot.getAttribute("cur");
            }
            else if (inSlot.className.indexOf('slot_avatar') >= 0)
            {
                if (inSlot.className.indexOf('girl_ico') >= 0)
                {
                    reward = 'girl_shards';
                }
                else
                {
                    reward = 'avatar';
                }
            }
            else if (inSlot.className.indexOf('girl-shards-slot') >= 0 || inSlot.className.indexOf('slot_girl_shards') >= 0)
            {
                reward = 'girl_shards';
            }
            else if (inSlot.className.indexOf('slot_random_girl') >= 0)
            {
                reward = 'random_girl_shards';
            }
            // Rarity is a bare class next to the type ("mythic slot_item" is a
            // mythic booster, "slot_scrolls_mythic" mythic bulbs), so the
            // type checks must not read it. Random equipment is the exception:
            // there the rarity decides, mythic counts as "mythic", every other
            // rarity as "equipment".
            else if (inSlot.className.indexOf('slot_scrolls_') >= 0)
            {
                reward = 'scrolls';
            }
            else if (inSlot.className.indexOf('random_equipment') >= 0 || inSlot.className.indexOf('slot_mythic_equipment') >= 0)
            {
                reward = /(^| )mythic( |$)|slot_mythic_equipment/.test(inSlot.className) ? 'mythic' : 'equipment';
            }
            else if (inSlot.className.indexOf('slot_seasonal_event_cash') >= 0)
            {
                reward = 'event_cash';
            }
            else if (inSlot.className.indexOf('slot_progressions') >= 0)
            {
                reward = 'progressions';
            }
            else if (inSlot.className.indexOf('slot_lively_scene') >= 0)
            {
                reward = 'lively_scene';
            }
            // Items carry their type in data-d, e.g.
            // {"item":{"id_item":"323","type":"potion","identifier":"XP4","rarity":"legendary",...},"quantity":"1"}
            else if (inSlot.getAttribute("data-d") !== null && $(inSlot).data("d"))
            {
                const objectData = $(inSlot).data("d");
                reward = objectData.item.type;
            }else{
                const possibleRewards = ConfigHelper.getHHScriptVars("possibleRewardsList");
                for (const currentRewards of Object.keys(possibleRewards))
                {
                    if (inSlot.className.indexOf('slot_'+currentRewards) >= 0)
                    {
                        reward = currentRewards;
                    }
                }
            }
        }
        else if (inSlot && inSlot.className?.indexOf('shards_girl_ico') >= 0)
        {
            reward = 'girl_shards';
        }
        return reward;
    }

    static getRewardTypeByData(inData:any)
    {
        let reward = "undetected";
        if (inData?.hasOwnProperty("type"))
        {
            reward = inData.type;
        }
        else if (inData?.hasOwnProperty("ico"))
        {
            if ( inData.ico?.indexOf("items/K") > 0 )
            {
                reward = "gift";
            }
            else if ( inData.ico?.indexOf("items/XP") > 0 )
            {
                reward = "potion";
            }
        }
        return reward;
    }

    static getRewardQuantityByType(rewardType:string, inSlot: any):number {
        switch(rewardType)
        {
            // The "shards" attribute holds the girl's shard count before the
            // reward; what the tier adds stands in "x<span>N</span>".
            case 'girl_shards' :    return parsePrice($('.shards p span', inSlot).first().text().trim()) || 0;
            case 'random_girl_shards' :
            case 'energy_kiss':
            case 'energy_quest':
            case 'energy_fight' :
            case 'energy_drill' :
            case 'xp' :
            case 'soft_currency' :
            case 'hard_currency' :
            case 'event_cash' :
            case 'gift':
            case 'potion' :
            case 'booster' :
            case 'orbs':
            case 'gems' :
            case 'scrolls' :
            case 'ticket' :
            case 'rejuvenation_stone' :
            case 'progressions' :
            case 'mythic' :
            case 'equipment' :      return parsePrice($('.amount', inSlot).first().text().trim()) || 1;
            case 'avatar':
            case 'lively_scene':    return 1;
            default: logHHAuto('Error: reward type unknown ' + rewardType);
            return 0;
        }
    }
    static getPovNotClaimedRewards(){
        const arrayz = $('.potions-paths-tiers-section .potions-paths-tier.unclaimed');
        const freeSlotSelectors = ".free-slot:not(.claimed-locked) .slot,.free-slot:not(.claimed-locked) .shards_girl_ico";
        const paidSlotSelectors = ".paid-slots:not(.paid-locked):not(.claimed-locked) .slot,.paid-slots:not(.paid-locked):not(.claimed-locked) .shards_girl_ico";

        return RewardHelper.computeRewardsCount(arrayz, freeSlotSelectors, paidSlotSelectors);
    }
    static computeRewardsCount(arrayz: any, freeSlotSelectors: string, paidSlotSelectors: string):Map<string,number> {
        const rewardCountByType:Map<string,number> = new Map();
        var rewardType:string, rewardSlot:any, rewardAmount:number;

        (rewardCountByType as any)['all'] = arrayz.length; 
        if (arrayz.length > 0)
        {
            for (var slotIndex = arrayz.length - 1; slotIndex >= 0; slotIndex--)
            {
                [freeSlotSelectors, paidSlotSelectors].forEach((selector) => {
                    rewardSlot = $(selector,arrayz[slotIndex]);
                    if(rewardSlot.length > 0) {
                        rewardType = RewardHelper.getRewardTypeBySlot(rewardSlot[0]);
                        rewardAmount = RewardHelper.getRewardQuantityByType(rewardType, rewardSlot[0]);
                        if(rewardCountByType.hasOwnProperty(rewardType)) {
                            (rewardCountByType as any)[rewardType] = (rewardCountByType as any)[rewardType] + rewardAmount;
                        }else{
                            (rewardCountByType as any)[rewardType] = rewardAmount;
                        }
                    }
                });
            }
        }
        return rewardCountByType;
    }
    // The icon of each type, as the game draws it in its own reward slots
    // (the slot renderer in shared.js). Types that group several kinds --
    // gifts, books, boosters, orbs, bulbs, equipment -- show one of them; the
    // amount is the sum. A type missing here still shows, with its name from
    // possibleRewardsList.
    static getRewardSlotIcon(rewardType: string): string {
        const img = (path: string) => `<img src="${ConfigHelper.getHHScriptVars('baseImgPath')}/${path}">`;
        switch (rewardType) {
            case 'random_girl_shards': return '<span class="random_girl_icn"></span>';
            case 'girl_shards':        return '<span class="shard_icn"></span>';
            case 'energy_kiss':        return '<span class="energy_kiss_icn"></span>';
            case 'energy_quest':       return '<span class="energy_quest_icn"></span>';
            case 'energy_fight':       return '<span class="energy_fight_icn"></span>';
            case 'energy_drill':       return '<span class="energy_drill_icn"></span>';
            case 'xp':                 return '<span class="xp_icn"></span>';
            case 'soft_currency':      return '<span class="soft_currency_icn"></span>';
            case 'hard_currency':      return '<span class="hard_currency_icn"></span>';
            case 'event_cash':         return '<span class="mega_event_cash_icn"></span>';
            case 'ticket':             return '<span class="ticket_icn"></span>';
            case 'gems':               return '<span class="gem_all_icn"></span>';
            case 'orbs':               return '<span class="orb_icon o_m1"></span>';
            case 'scrolls':            return '<span class="scrolls_legendary_icn"></span>';
            case 'mythic':
            case 'equipment':          return '<span class="mythic_equipment_icn"></span>';
            case 'rejuvenation_stone': return '<span class="rejuvenation_stone_icn"></span>';
            case 'progressions':       return `<span class="progressions_icn ${unsafeWindow.mega_event_theme ?? ''}"></span>`;
            case 'lively_scene':       return '<span class="play_button_icn"></span>';
            case 'gift':               return img('design/ic_gift.png');
            case 'potion':             return img('pictures/items/XP1.png');
            case 'booster':            return img('pictures/items/B1.png');
            default: {
                const names = ConfigHelper.getHHScriptVars('possibleRewardsList', false) || {};
                return `<span class="HHRewardName">${names[rewardType] ?? rewardType}</span>`;
            }
        }
    }
    static getRewardsAsHtml(rewardCountByType:Map<string,number>) {
        // Classes the game gives the slot itself: its background, and for
        // items and equipment a rarity frame.
        const slotClass: Record<string, string> = {
            random_girl_shards: 'slot_random_girl', girl_shards: 'slot_girl_shards',
            event_cash: 'slot_seasonal_event_cash', scrolls: 'slot_scrolls_legendary',
            mythic: 'mythic random_equipment', equipment: 'legendary random_equipment',
            gift: 'legendary', potion: 'legendary', booster: 'legendary',
        };
        // XP and ymens run into the millions; one decimal keeps "2.2M" apart from "2M".
        const decimals = (rewardType: string) => rewardType === 'xp' || rewardType === 'soft_currency' ? 1 : 0;
        let html = '';
        if(rewardCountByType)
        for (const rewardType in rewardCountByType) {
            if (rewardType === 'all' || rewardType === 'undetected') continue;
            const rewardCount = (rewardCountByType as any)[rewardType];
            if (!(rewardCount > 0)) continue;
            html += `<div class="slot ${slotClass[rewardType] ?? 'slot_' + rewardType} size_xs">`
                + RewardHelper.getRewardSlotIcon(rewardType)
                + `<div class="amount">${NumberHelper.nRounding(rewardCount, decimals(rewardType), -1)}</div></div>`;
        }
        return html;
    }

    static getRewardsIconHref(rewardType: string) {
        let html = '';
        if (rewardType) {
            switch (rewardType) {
                case 'girl_shards': html += '/images/pictures/design/shards.png' ; break;
                case 'energy_kiss': html += '/images/pictures/design/ic_kiss.png'; break;
                case 'energy_quest': html += '/images/pictures/design/ic_energy_quest.png'; break;
                case 'energy_fight': html += '/images/pictures/design/ic_energy_fight.png'; break;
                case 'energy_drill': html += '/images/penta_drill/penta_drill.png'; break;
                case 'xp': html += ''; break;
                case 'soft_currency': html += '/images/pictures/design/ic_topbar_soft_currency.png'; break;
                case 'hard_currency': html += '/images/pictures/design/ic_topbar_hard_currency.png'; break;
                case 'event_cash': html += ''; break;
                case 'ticket': html += '/images//pictures/design/champion_ticket.png'; break;
                default:
            }
        }
        return html;
    }
    static displayRewardsDiv(target: any, hhRewardId: string, rewardCountByType:Map<string,number> ) {
        const emptyRewardDiv = $('<div id='+hhRewardId+' style="display:none;"></div>');
        try{
            if($('#' + hhRewardId).length <= 0) {
                if ((rewardCountByType as any)['all'] > 0) {
                    const rewardsHtml = RewardHelper.getRewardsAsHtml(rewardCountByType);
                    if(rewardsHtml && rewardsHtml != '') {
                        target.append($('<div id='+hhRewardId+' class="HHRewardNotCollected"><h1 style="font-size: small;">'+getTextForUI('rewardsToCollectTitle',"elementText")+'</h1>' + rewardsHtml + '</div>'));
                    } else {
                        target.append(emptyRewardDiv);
                    }
                } else {
                    target.append(emptyRewardDiv);
                }
            }
        } catch(err) {
            logHHAuto("ERROR:", (err as any).message);
            target.append(emptyRewardDiv);
        }
    }
    static displayRewardsPovPogDiv() {
        const target = $('.potions-paths-first-row');
        const hhRewardId = 'HHPovPogRewards';
        
        if($('#' + hhRewardId).length <= 0) {
            const rewardCountByType = RewardHelper.getPovNotClaimedRewards();
            RewardHelper.displayRewardsDiv(target, hhRewardId, rewardCountByType);
        }
    }
    static closeRewardPopupIfAny(logging=true, popupId='') {
        const rewardQuery = `div#${popupId != '' ? popupId : 'rewards_popup'} button.blue_button_L:not([disabled]):visible`;
        if ($(rewardQuery).length >0 )
        {
            if ($(rewardQuery).attr('id') === 'redirect-to-harem') {
                logHHAuto("Redirect to harem button detected.");
                return RewardHelper.closeGirlRewardPopupIfAny(logging, popupId);
            }
            if (logging) logHHAuto(`Close reward popup ${popupId != '' ? popupId : 'rewards_popup'}.`);
            $(rewardQuery).trigger('click');
            return true;
        }
        return false;
    }
    static closeGirlRewardPopupIfAny(logging=true, popupId='') {
        const rewardQuery = `div#${popupId != '' ? popupId : 'rewards_popup'} button.purple_button_L:not([disabled]):visible`;
        if ($(rewardQuery).length >0 )
        {
            if (logging) logHHAuto(`Close girl reward popup ${popupId != '' ? popupId : 'rewards_popup'}.`);
            $(rewardQuery).trigger('click');
            return true;
        }
        return false;
    }
    static ObserveAndGetGirlRewards()
    {
        const inCaseTimer = setTimeout(function(){gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));}, 60000); //in case of issue
        function parseReward()
        {
            const eventsGirlz: EventGirl[] = getStoredJSON(HHStoredVarPrefixKey + TK.eventsGirlz, []);
            const eventGirl: EventGirl = EventModule.getEventGirl();
            const eventMythicGirl: EventGirl = EventModule.getEventMythicGirl();
            if (!eventsGirlz || eventsGirlz.length == 0)
            {
                return -1;
            }
            const foughtTrollId:number = Number(queryStringGetParam(window.location.search,'id_opponent'));
            const loveRaid = LoveRaidManager.getAllRaids();
            const foughtTrollFromLoveRaid = loveRaid.find(raid => raid.trollId === foughtTrollId);
            if (eventMythicGirl.troll_id && foughtTrollId != eventMythicGirl.troll_id && eventGirl.troll_id && foughtTrollId != eventGirl.troll_id && !foughtTrollFromLoveRaid) {
                logHHAuto(`Troll from mythic event (${eventMythicGirl.troll_id}) or from event (${eventGirl.troll_id}) or from LoveRaid not fought, was (${foughtTrollId}) instead.
                Can be issue in event variable (mythic event finished: ${EventModule.isEventActive(eventMythicGirl.event_id)},  event finished: ${EventModule.isEventActive(eventGirl.event_id) })`);
            }
            if ($('#rewards_popup #reward_holder .shards_wrapper').length === 0)
            {
                clearTimeout(inCaseTimer);
                logHHAuto("No girl in reward going back to Troll");
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDTrollPreBattle"), { id_opponent: foughtTrollId });
                return;
            }
            let renewEvent = "";
            let needLoveRaidUpdate = false;
            let loveRaidGirlWon = false;
            const girlShardsWon = $('.shards_wrapper .slot_girl_shards');
            logHHAuto("Detected girl shard reward");
            for (var currGirl=0; currGirl <= girlShardsWon.length; currGirl++)
            {
                const girlIdSrc = $("img",girlShardsWon[currGirl]).attr("src") || '';
                const girlId = Number(girlIdSrc.split('/')[5]);
                const previousGirlShards = Math.min(Number($('.shards[shards]', girlShardsWon[currGirl]).attr('shards')), 100);
                let wonShards = Number($('.shards[shards]', girlShardsWon[currGirl]).text().replace(/^\D+/g, ''));
                if (!(wonShards > 0)) {
                    logHHAuto('ERROR: Unable to gate number of shards won, default 1 shard.');
                    wonShards = 1;
                }
                const girlShards = Math.min(previousGirlShards + wonShards, 100);
                if (eventsGirlz.length >0)
                {
                    const girlIndex = eventsGirlz.findIndex((element) =>element.girl_id === girlId);
                    if (girlIndex !==-1)
                    {
                        eventsGirlz[girlIndex].shards = girlShards;
                        if (girlShards === 100)
                        {
                            renewEvent = eventsGirlz[girlIndex].event_id;
                        }
                        if (wonShards > 0)
                        {
                            logHHAuto("Won "+wonShards+" event shards for "+eventsGirlz[girlIndex].name);
                        }
                    }
                }
                if (eventMythicGirl.girl_id === girlId)
                {
                    eventMythicGirl.shards = girlShards;
                    if (girlShards === 100)
                    {
                        renewEvent = eventMythicGirl.event_id;
                    }
                }
                else if (eventGirl.girl_id === girlId)
                {
                    eventGirl.shards = girlShards;
                    if (girlShards === 100)
                    {
                        renewEvent = eventGirl.event_id;
                    }
                }

                else if(loveRaid.some(raid => raid.id_girl === girlId)) {
                    needLoveRaidUpdate = true;
                    const raid = loveRaid.find(raid => raid.id_girl === girlId);
                    raid!.girl_shards = girlShards;
                    if (girlShards === 100) {
                        loveRaidGirlWon = true;
                    }
                }
            }
            if (needLoveRaidUpdate) {
                LoveRaidManager.saveLoveRaids(loveRaid);
            }
            setStoredValue(HHStoredVarPrefixKey+TK.eventsGirlz, JSON.stringify(eventsGirlz));
            if (eventGirl?.girl_id) EventModule.saveEventGirl(eventGirl);
            if (eventMythicGirl?.girl_id) EventModule.saveEventGirl(eventMythicGirl);
            if (renewEvent !== ""
                || eventGirl?.girl_id && EventModule.checkEvent(eventGirl.event_id)
                || eventMythicGirl?.girl_id && EventModule.checkEvent(eventMythicGirl.event_id)
            )
            {
                clearTimeout(inCaseTimer);
                logHHAuto(`Need to check back event page: '${renewEvent}' or '${eventGirl?.event_id ?? ''}' or '${eventMythicGirl?.event_id ?? ''}' `);
                if (renewEvent !== "")
                {
                    EventModule.parseEventPage(renewEvent);
                }
                else if (eventMythicGirl?.girl_id && EventModule.checkEvent(eventMythicGirl.event_id))
                {
                    EventModule.parseEventPage(eventMythicGirl.event_id);
                }
                else if (eventGirl?.girl_id && EventModule.checkEvent(eventGirl.event_id)) {
                    EventModule.parseEventPage(eventGirl.event_id);
                }
                return;
            } else if (loveRaidGirlWon) {
                clearTimeout(inCaseTimer);
                logHHAuto("Parse again love Raid.");
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDLoveRaid"));
                return;
            }
            else
            {
                clearTimeout(inCaseTimer);
                logHHAuto("Go back to troll after troll fight.");
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDTrollPreBattle"), { id_opponent: foughtTrollId });
                return;
            }
        }

        const observerReward = new MutationObserver(function(mutations) {
            mutations.forEach(parseReward);
        });

        if ($('#rewards_popup').length >0)
        {
            if ($('#rewards_popup')[0].style.display !== "block" && $('#rewards_popup')[0].style.display !== "")
            {
                setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
                logHHAuto("setting autoloop to false to wait for troll rewards");
                observerReward.observe($('#rewards_popup')[0], {
                    childList: false
                    , subtree: false
                    , attributes: true
                    , characterData: false
                });
            }
            else
            {
                parseReward();
            }
        }

        const observerPass = new MutationObserver(function(mutations) {
            mutations.forEach(function(_mutation)
                            {
                const querySkip = '#contains_all #new_battle .new-battle-buttons-container #new-battle-skip-btn.blue_text_button[style]';
                if ($(querySkip).length === 0
                    || $(querySkip)[0].style.display!=="block"
                )
                {
                    return;
                }
                else
                {
                    setTimeout(function()
                            {
                        $(querySkip)[0].click();
                        logHHAuto("Clicking on pass battle.");
                    }, randomInterval(800,1200));
                }
            })
        });

        observerPass.observe($('#contains_all .new-battle-buttons-container #new-battle-skip-btn.blue_text_button')[0], {
            childList: false
            , subtree: false
            , attributes: true
            , characterData: false
        });
    }
}
