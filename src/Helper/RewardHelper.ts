// RewardHelper.ts
//
// Detects, classifies, and renders in-game reward slots. The game
// displays rewards in DOM elements with CSS classes like "slot_soft_currency"
// or data attributes. This helper inspects those elements to determine
// the reward type (girl shards, currency, energy, equipment, etc.) and
// quantity, then can render summary HTML for the HHAuto overlay.
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

import { gotoPage } from '../Service/index';
import { isJSON, logHHAuto } from '../Utils/index';
import { parsePrice } from "./PriceHelper";
import { ConfigHelper } from "./ConfigHelper";
import { getTextForUI } from "./LanguageHelper";
import { NumberHelper } from "./NumberHelper";
import { getStoredJSON, getStoredValue, setStoredValue } from "./StorageHelper";
import { randomInterval } from "./TimeHelper";
import { EventModule, LoveRaidManager, SeasonalEvent } from '../Module/index';
import { queryStringGetParam } from "./UrlHelper";
import { HHStoredVarPrefixKey, TK } from '../config/index';
import { EventGirl } from '../model/EventGirl';

export class RewardHelper {
    static getRewardTypeBySlot(inSlot): string
    {
        let reward = "undetected";
        if (inSlot && inSlot.className?.indexOf('slot') >= 0)
        {
            if (inSlot.getAttribute("cur") !== null)
            {
                //console.log(currentIndicator+" : "+inSlot.getAttribute("cur"));
                reward = inSlot.getAttribute("cur");
            }
            else if (inSlot.className.indexOf('slot_avatar') >= 0)
            {
                //console.log(currentIndicator+" : avatar");
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
                reward = 'random_girl_shards'; // Random girl shards
            }
            else if (inSlot.className.indexOf('mythic') >= 0)
            {
                //console.log("mythic equipment");
                reward = 'mythic';
            }
            else if (inSlot.className.indexOf('slot_scrolls_') >= 0)
            {
                reward = 'scrolls';
            }
            else if (inSlot.className.indexOf('slot_seasonal_event_cash') >= 0)
            {
                reward = 'event_cash';
            }
            else if (inSlot.getAttribute("data-d") !== null && $(inSlot).data("d"))
            {
                let objectData = $(inSlot).data("d");
                //console.log(currentIndicator+" : "+inSlot.getAttribute("rarity")+" "+objectData.item.type+" "+objectData.item.value);
                reward = objectData.item.type;
            }else{
                const possibleRewards = ConfigHelper.getHHScriptVars("possibleRewardsList");
                for (let currentRewards of Object.keys(possibleRewards))
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
            //console.log(currentIndicator+" : shards_girl_ico");
            reward = 'girl_shards';
        }
        //console.log(reward);
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
        //console.log(reward);
        return reward;
    }

    static getRewardQuantityByType(rewardType:string, inSlot):number {
        // TODO update logic for potion / gift to be more accurate
        switch(rewardType)
        {
            case 'girl_shards' :    return Number($('.shards', inSlot).attr('shards'));
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
            case 'ticket' :         return parsePrice($('.amount', inSlot).text());
            case 'mythic' :         return 1;
            case 'avatar':          return 1;
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
    static computeRewardsCount(arrayz, freeSlotSelectors, paidSlotSelectors):Map<string,number> {
        const rewardCountByType:Map<string,number> = new Map();
        var rewardType:string, rewardSlot:any, rewardAmount:number;

// data-d='{"item":{"id_item":"323","type":"potion","identifier":"XP4","rarity":"legendary","price":"500000","currency":"sc","value":"2500","carac1":"0","carac2":"0","carac3":"0","endurance":"0","chance":"0.00","ego":"0","damage":"0","duration":"0","skin":"hentai,gay,sexy","name":"Spell book","ico":"https://hh.hh-content.com/pictures/items/XP4.png","display_price":500000},"quantity":"1"}'

        rewardCountByType['all'] = arrayz.length; 
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
                            rewardCountByType[rewardType] = rewardCountByType[rewardType] + rewardAmount;
                        }else{
                            rewardCountByType[rewardType] = rewardAmount;
                        }
                    }
                });
            }
        }
        return rewardCountByType;
    }
    static getRewardsAsHtml(rewardCountByType:Map<string,number>) {
        let html = '';
        if(rewardCountByType)
        //for (const [rewardType, rewardCount] of rewardCountByType.entries()) {
        for (const rewardType in rewardCountByType) {
            const rewardCount = rewardCountByType[rewardType];
            switch(rewardType)
            {
                // case 'girl_shards' :    return Number($('.shards', inSlot).attr('shards'));
                case 'random_girl_shards' : html += '<div class="slot slot_random_girl  size_xs"><span class="random_girl_icn"></span><div class="amount">'+NumberHelper.nRounding(rewardCount,0,-1)+'</div></div>'; break;
                case 'energy_kiss':     html += '<div class="slot slot_energy_kiss  size_xs"><span class="energy_kiss_icn"></span><div class="amount">'+NumberHelper.nRounding(rewardCount,0,-1)+'</div></div>'; break;
                case 'energy_quest':    html += '<div class="slot slot_energy_quest size_xs"><span class="energy_quest_icn"></span><div class="amount">'+NumberHelper.nRounding(rewardCount,0,-1)+'</div></div>'; break;
                case 'energy_fight' :   html += '<div class="slot slot_energy_fight  size_xs"><span class="energy_fight_icn"></span><div class="amount">'+NumberHelper.nRounding(rewardCount,0,-1)+'</div></div>'; break;
                case 'energy_drill' :   html += '<div class="slot slot_energy_drill  size_xs"><span class="energy_drill_icn"></span><div class="amount">'+NumberHelper.nRounding(rewardCount,0,-1)+'</div></div>'; break;
                case 'xp' :             html += '<div class="slot slot_xp size_xs"><span class="xp_icn"></span><div class="amount">'+NumberHelper.nRounding(rewardCount,1,-1)+'</div></div>'; break;
                case 'soft_currency' :  html += '<div class="slot slot_soft_currency size_xs"><span class="soft_currency_icn"></span><div class="amount">'+NumberHelper.nRounding(rewardCount,1,-1)+'</div></div>'; break;
                case 'hard_currency' :  html += '<div class="slot slot_hard_currency size_xs"><span class="hard_currency_icn"></span><div class="amount">'+NumberHelper.nRounding(rewardCount,0,-1)+'</div></div>'; break;
                case 'event_cash' :     html += '<div class="slot slot_seasonal_event_cash size_xs"><span class="mega_event_cash_icn"></span><div class="amount">'+NumberHelper.nRounding(rewardCount,0,-1)+'</div></div>'; break;
                // case 'gift':
                // case 'potion' :
                // case 'booster' :
                // case 'orbs':
                // case 'gems' :           html += '<div class="slot slot_gems size_xs"><span class="gem_all_icn"></span><div class="amount">'+nRounding(rewardCount,0,-1)+'</div></div>'; break;
                // case 'scrolls' :
                case 'ticket' :         html += '<div class="slot slot_ticket size_xs"><span class="ticket_icn"></span><div class="amount">'+NumberHelper.nRounding(rewardCount,0,-1)+'</div></div>'; break;
                // case 'mythic' :         html += '<div class="slot mythic random_equipment size_xs"><span class="mythic_equipment_icn"></span><div class="amount">'+nRounding(rewardCount,0,-1)+'</div></div>'; break;
                // case 'avatar':          return 1;
                default: 
            }
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
    static displayRewardsDiv(target,hhRewardId, rewardCountByType:Map<string,number> ) {
        const emptyRewardDiv = $('<div id='+hhRewardId+' style="display:none;"></div>');
        try{
            if($('#' + hhRewardId).length <= 0) {
                if (rewardCountByType['all'] > 0) {
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
            logHHAuto("ERROR:", err.message);
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
        let rewardQuery = `div#${popupId != '' ? popupId : 'rewards_popup'} button.blue_button_L:not([disabled]):visible`;
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
        let rewardQuery = `div#${popupId != '' ? popupId : 'rewards_popup'} button.purple_button_L:not([disabled]):visible`;
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
        let inCaseTimer = setTimeout(function(){gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));}, 60000); //in case of issue
        function parseReward()
        {
            let eventsGirlz: EventGirl[] = getStoredJSON(HHStoredVarPrefixKey + TK.eventsGirlz, []);
            let eventGirl: EventGirl = EventModule.getEventGirl();
            let eventMythicGirl: EventGirl = EventModule.getEventMythicGirl();
            if (!eventsGirlz || eventsGirlz.length == 0)
            {
                return -1;
            }
            let foughtTrollId:number = Number(queryStringGetParam(window.location.search,'id_opponent'));
            const loveRaid = LoveRaidManager.getAllRaids();
            const foughtTrollFromLoveRaid = loveRaid.find(raid => raid.trollId === foughtTrollId);
            if (eventMythicGirl.troll_id && foughtTrollId != eventMythicGirl.troll_id && eventGirl.troll_id && foughtTrollId != eventGirl.troll_id && !foughtTrollFromLoveRaid) {
                logHHAuto(`Troll from mythic event (${eventMythicGirl.troll_id}) or from event (${eventGirl.troll_id}) or from LoveRaid not fought, was (${foughtTrollId}) instead.
                Can be issue in event variable (mythic event finished: ${EventModule.isEventActive(eventMythicGirl.event_id)},  event finished: ${EventModule.isEventActive(eventGirl.event_id) })`);
                // TTF = foughtTrollId;
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
            let girlShardsWon = $('.shards_wrapper .slot_girl_shards');
            logHHAuto("Detected girl shard reward");
            for (var currGirl=0; currGirl <= girlShardsWon.length; currGirl++)
            {
                let girlIdSrc = $("img",girlShardsWon[currGirl]).attr("src") || '';
                let girlId = Number(girlIdSrc.split('/')[5]);
                const previousGirlShards = Math.min(Number($('.shards[shards]', girlShardsWon[currGirl]).attr('shards')), 100);
                let wonShards = Number($('.shards[shards]', girlShardsWon[currGirl]).text().replace(/^\D+/g, ''));
                if (!(wonShards > 0)) {
                    logHHAuto('ERROR: Unable to gate number of shards won, default 1 shard.');
                    wonShards = 1;
                }
                const girlShards = Math.min(previousGirlShards + wonShards, 100);
                if (eventsGirlz.length >0)
                {
                    let girlIndex = eventsGirlz.findIndex((element) =>element.girl_id === girlId);
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
                    raid.girl_shards = girlShards;
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
                //|| Number(getStoredValue(HHStoredVarPrefixKey+TK.EventFightsBeforeRefresh")) < 1
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

        let observerReward = new MutationObserver(function(mutations) {
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

        let observerPass = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation)
                            {
                let querySkip = '#contains_all #new_battle .new-battle-buttons-container #new-battle-skip-btn.blue_text_button[style]';
                if ($(querySkip).length === 0
                    && $(querySkip)[0].style.display!=="block"
                )
                {
                    return;
                }
                else
                {
                    //replaceCheatClick();
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
