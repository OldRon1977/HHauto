/**
 * EventModule.ts -- Central coordinator for all time-limited game events.
 *
 * This is the backbone of event automation. It detects which events are active on the
 * game's home or event pages, routes parsing to the correct event-specific handler
 * (PlusEvent, MythicEvent, BossBang, etc.), and manages shared event state in
 * sessionStorage (event list, event girls, champion girls).
 *
 * Key responsibilities:
 * - Parse event pages to extract event data and girl reward information.
 * - Track event lifecycle: detect active events, mark completed events, and clean up
 *   expired event data.
 * - Prioritize event girls based on the user-configured troll order.
 * - Inject UI enhancements: completion badges on the home page, priority labels on
 *   girl reward tiles, a "collect all" button for event chests.
 * - Provide countdown timers on the home page for Path of Value / Path of Glory events.
 *
 * Called by AutoLoop on each tick. Individual event handlers (in sibling files) contain
 * the event-type-specific parsing and reward collection logic.
 */
import {
    TimeHelper,
    checkTimer,
    checkTimerMustExist,
    clearTimer,
    convertTimeToInt,
    ConfigHelper,
    getLimitTimeBeforeEnd,
    getPage,
    getSecondsLeft,
    getStoredJSON,
    getStoredValue,
    getTextForUI,
    getTimeLeft,
    getTimer,
    queryStringGetParam,
    randomInterval,
    setStoredValue,
    setTimer
} from "../../Helper/index";
import { gotoPage } from "../../Service/index";
import { logHHAuto } from "../../Utils/index";
import { HHStoredVarPrefixKey, SK, TK } from "../../config/index";
import {
    EventGirl,
    HHEvent,
    HHEventData,
    KKEventGirl
} from "../../model/index";
import { BossBang } from "./BossBang";
import { CumbackContests } from "./CumbackContests";
import { DoublePenetration } from "./DoublePenetration";
import { KinkyCumpetition } from "./KinkyCumpetition";
import { LivelyScene } from "./LivelyScene";
import { MythicEvent } from "./MythicEvent";
import { PathOfAttraction } from "./PathOfAttraction";
import { PlusEvent } from "./PlusEvents";
import { SultryMysteries } from "./SultryMysteries";

export class EventModule {
    /**
     * Remove stale event data from sessionStorage for the given event ID.
     * Also prunes expired events, disables timers when no mythic/regular events remain,
     * and cleans up associated girl and champion lists.
     */
    static clearEventData(inEventID:string)
    {
        //clearTimer('eventMythicNextWave');
        //clearTimer('eventRefreshExpiration');
        //sessionStorage.removeItem(HHStoredVarPrefixKey+'Temp_EventFightsBeforeRefresh');
        let eventList = getStoredJSON(HHStoredVarPrefixKey+TK.eventsList, {});
        let eventsGirlz: EventGirl[] = getStoredJSON<EventGirl[]>(HHStoredVarPrefixKey+TK.eventsGirlz, []);
        let eventGirl = EventModule.getEventGirl();
        let eventMythicGirl = EventModule.getEventMythicGirl();
        let eventChamps:EventGirl[] = getStoredJSON<EventGirl[]>(HHStoredVarPrefixKey+TK.autoChampsEventGirls, []);
        let hasMythic = false;
        let hasEvent = false;
        for (let prop of Object.keys(eventList))
        {
            if (
                eventList[prop]["seconds_before_end"]<new Date()
                ||
                (eventList[prop]["type"] === 'mythic' && getStoredValue(HHStoredVarPrefixKey+SK.plusEventMythic) !=="true")
                ||
                (eventList[prop]["type"] === 'event' && getStoredValue(HHStoredVarPrefixKey+SK.plusEvent) !=="true")
                ||
                (eventList[prop]["type"] === 'bossBang' && getStoredValue(HHStoredVarPrefixKey+SK.bossBangEvent) !=="true")
                ||
                (eventList[prop]["type"] === 'sultryMysteries' && getStoredValue(HHStoredVarPrefixKey+SK.sultryMysteriesEventRefreshShop) !=="true")
            )
            {
                delete eventList[prop];
            }
            else
            {
                if (! eventList[prop]["isCompleted"])
                {
                    if (eventList[prop]["isMythic"])
                    {
                        hasMythic = true;
                    }
                    else
                    {
                        hasEvent = true;
                    }
                }

            }
        }
        if (hasMythic === false)
        {
            clearTimer('eventMythicNextWave');
            clearTimer('eventMythicGoing');
        }
        if (hasEvent === false)
        {
            clearTimer('eventGoing');
        }
        if (Object.keys(eventList).length === 0)
        {
            sessionStorage.removeItem(HHStoredVarPrefixKey+TK.eventsGirlz);
            sessionStorage.removeItem(HHStoredVarPrefixKey+TK.eventGirl);
            sessionStorage.removeItem(HHStoredVarPrefixKey+TK.eventMythicGirl);
            sessionStorage.removeItem(HHStoredVarPrefixKey+TK.eventsList);
            sessionStorage.removeItem(HHStoredVarPrefixKey+TK.autoChampsEventGirls);
        }
        else
        {
            //console.log(JSON.stringify(eventChamps));
            eventChamps = eventChamps.filter(function (a) {
                if ( !eventList.hasOwnProperty(a.event_id) || a.event_id === inEventID)
                {
                    return false;
                }
                else
                {
                    return true;
                }
            });

            if(Object.keys(eventChamps).length === 0)
            {
                sessionStorage.removeItem(HHStoredVarPrefixKey+TK.autoChampsEventGirls);
            }
            else
            {
                setStoredValue(HHStoredVarPrefixKey+TK.autoChampsEventGirls, JSON.stringify(eventChamps));
            }


            eventsGirlz = eventsGirlz.filter(function (a) {
                if ( !eventList.hasOwnProperty(a.event_id) || a.event_id === inEventID)
                {
                    return false;
                }
                else
                {
                    return true;
                }
            });
            if(Object.keys(eventsGirlz).length === 0)
            {
                sessionStorage.removeItem(HHStoredVarPrefixKey+TK.eventsGirlz);
            }
            else
            {
                setStoredValue(HHStoredVarPrefixKey+TK.eventsGirlz, JSON.stringify(eventsGirlz));
            }

            if (!eventList.hasOwnProperty(eventGirl.event_id) || eventGirl.event_id ===inEventID)
            {
                sessionStorage.removeItem(HHStoredVarPrefixKey+TK.eventGirl);
            }

            if (!eventList.hasOwnProperty(eventMythicGirl.event_id) || eventMythicGirl.event_id === inEventID)
            {
                sessionStorage.removeItem(HHStoredVarPrefixKey+TK.eventMythicGirl);
            }

            setStoredValue(HHStoredVarPrefixKey+TK.eventsList, JSON.stringify(eventList));
        }
    }

    static getDisplayedIdEventPage(logging=true):string {
        let eventHref = $("#contains_all #events .events-list .event-title.active").attr("href") || '';
        if (!eventHref && logging) {
            logHHAuto('Error href not found for current event');
        }
        if (eventHref) {
            let parsedURL = new URL(eventHref,window.location.origin);
            return queryStringGetParam(parsedURL.search,'tab') || '';
        }
        return '';
    }

    static showCompletedEvent(){
        try {
            if($('img.eventCompleted').length <= 0) {
                let oneEventCompleted = false;
                if($(`#contains_all #homepage .event-widget a:not([href="#"])`).length > 0) {
                    const img = $(`<div class="tooltipHH" style="display: inline-block;">`
                                    +`<span class="tooltipHHtext">${getTextForUI('eventCompleted',"tooltip")}</span>`
                                    +`<img src=${ConfigHelper.getHHScriptVars("powerCalcImages")['plus']} class="eventCompleted" title="${getTextForUI('eventCompleted',"tooltip")}" />`
                                +`</div>`);

                    const eventList = getStoredJSON(HHStoredVarPrefixKey+TK.eventsList, {});
                    for (let eventID of Object.keys(eventList))
                    {
                        if (eventList[eventID]["isCompleted"])
                        {
                            const eventTimer = $(`#contains_all #homepage .event-widget a[href*="${eventID}"] .timer p`);
                            eventTimer.append(img.clone());
                            oneEventCompleted = true;
                        }
                    }
                }
                if(!oneEventCompleted) {
                    const eventTimer = $(`#contains_all #homepage`);
                    eventTimer.append($(`<img src=${ConfigHelper.getHHScriptVars("powerCalcImages")['minus']} class="eventCompleted" style="display:none" />`));
                }
            }
        } catch (error) { /* ignore errors */}
    }

    static async parseEventPage(inTab="global")
    {
        if(getPage() === ConfigHelper.getHHScriptVars("pagesIDEvent") )
        {
            let queryEventTabCheck=$("#contains_all #events");
            const eventID:string = EventModule.getDisplayedIdEventPage();
            if (inTab !== "global" && inTab !== eventID)
            {
                if(eventID == '') {
                    logHHAuto("ERROR: No event Id found in current page, clear event data and go to home");
                    EventModule.clearEventData(inTab);
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                } else {
                    logHHAuto("Wrong event opened, need to change event page");
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDEvent"),{tab:inTab});
                }
                return true;
            }

            const hhEvent = EventModule.getEvent(eventID);
            if (!hhEvent.eventTypeKnown)
            {
                if (queryEventTabCheck.attr('parsed') === undefined)
                {
                    logHHAuto("Not parsable event");
                    queryEventTabCheck[0].setAttribute('parsed', 'true');
                }
                return false;
            }
            if (queryEventTabCheck.attr('parsed') !== undefined)
            {
                if (!EventModule.checkEvent(eventID))
                {
                    //logHHAuto("Events already parsed.");
                    return false;
                }
            }
            queryEventTabCheck[0].setAttribute('parsed', 'true');
            const hhEventData: HHEventData = unsafeWindow.event_data || unsafeWindow.current_event;
            logHHAuto(`On event page : ${eventID} (${hhEventData?.event_name || ''})`);
            EventModule.clearEventData(eventID);
            //let eventsGirlz=[];
            let eventList = getStoredJSON(HHStoredVarPrefixKey+TK.eventsList, {});
            let eventsGirlz: EventGirl[] = getStoredJSON<EventGirl[]>(HHStoredVarPrefixKey+TK.eventsGirlz, []);
            let eventChamps: EventGirl[] = getStoredJSON<EventGirl[]>(HHStoredVarPrefixKey+TK.autoChampsEventGirls, []);
            let Priority: string[] =(getStoredValue(HHStoredVarPrefixKey+SK.eventTrollOrder) || '').split(";");
            if ((hhEvent.isPlusEvent || hhEvent.isPlusEventMythic) && !hhEventData) {
                logHHAuto("Error getting current event Data from HH.");
            }

            if (hhEvent.isPlusEvent)
            {
                logHHAuto("On going event, parsing...");
                PlusEvent.parse(hhEvent, eventList, hhEventData, eventsGirlz, eventChamps);
            }
            if (hhEvent.isPlusEventMythic)
            {
                logHHAuto("On going mythic event, parsing...");
                MythicEvent.parse(hhEvent, eventList, hhEventData, eventsGirlz, eventChamps);
            }
            if (hhEvent.isBossBangEvent)
            {
                logHHAuto("On going bossBang event, parsing...");
                BossBang.parse(hhEvent, eventList, hhEventData);
            }
            if (hhEvent.isSultryMysteriesEvent)
            {
                logHHAuto("On going sultry mysteries event.");
                SultryMysteries.parse(hhEvent, eventList, hhEventData);
            }
            if (hhEvent.isLivelyScene)
            {
                logHHAuto("On going lively scene event.");
                LivelyScene.parse(hhEvent, eventList, hhEventData);
            }
            if (hhEvent.isDPEvent)
            {
                logHHAuto("On going double penetration event.");
                DoublePenetration.parse(hhEvent, eventList, hhEventData);
            }
            if (hhEvent.isPoa)
            {
                logHHAuto("On going path of Attraction event.");
                PathOfAttraction.parse(hhEvent, eventList, hhEventData);
            }
            if (hhEvent.isCumback)
            {
                logHHAuto("On going cumback contest event.");
                CumbackContests.parse(hhEvent, eventList, hhEventData);
            }
            if (hhEvent.isKinky)
            {
                logHHAuto("On going kinky cumpetition event.");
                KinkyCumpetition.parse(hhEvent, eventList, hhEventData);
            }
            if(Object.keys(eventList).length >0)
            {
                setStoredValue(HHStoredVarPrefixKey+TK.eventsList, JSON.stringify(eventList));
            }
            else
            {
                sessionStorage.removeItem(HHStoredVarPrefixKey+TK.eventsList);
            }
            eventsGirlz = eventsGirlz.filter(function (a) {
                var a_weighted = Number(Priority.indexOf(''+a.troll_id));
                if ( a.is_mythic )
                {
                    return true;
                }
                else
                {
                    return a_weighted !== -1;
                }
            });

            if (eventsGirlz.length>0 || eventChamps.length>0)
            {
                if (eventsGirlz.length>0)
                {
                    if (Priority[0]!=='')
                    {
                        eventsGirlz.sort(function (a, b) {

                            var a_weighted = Number(Priority.indexOf(''+a.troll_id));
                            if ( a.is_mythic )
                            {
                                a_weighted=a_weighted-Priority.length;
                            }
                            var b_weighted = Number(Priority.indexOf(''+b.troll_id));
                            if ( b.is_mythic )
                            {
                                b_weighted=b_weighted-Priority.length;
                            }
                            return a_weighted-b_weighted;

                        });
                        //logHHAuto({log:"Sorted EventGirls",eventGirlz:eventsGirlz});
                    }

                    setStoredValue(HHStoredVarPrefixKey+TK.eventsGirlz, JSON.stringify(eventsGirlz));
                    EventModule.saveEventGirl(eventsGirlz[0]);
                }
                if (eventChamps.length>0)
                {
                    setStoredValue(HHStoredVarPrefixKey+TK.autoChampsEventGirls, JSON.stringify(eventChamps));
                }
                queryEventTabCheck[0].setAttribute('parsed', 'true');
                //setStoredValue(HHStoredVarPrefixKey+"Temp_EventFightsBeforeRefresh", "20000");
                //setTimer('eventRefreshExpiration', 3600);
            }
            else
            {
                queryEventTabCheck[0].setAttribute('parsed', 'true');
                EventModule.clearEventData(eventID);
            }
            return false;
        }
        else
        {
            if (inTab !== "global")
            {
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDEvent"),{tab:inTab});
            }
            else
            {
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDEvent"));
            }
            return true;
        }
    }

    static saveEventGirl(eventGirlz: EventGirl){
        var chosenTroll = Number(eventGirlz.troll_id)
        logHHAuto("ET: " + chosenTroll);
        if (!eventGirlz.is_mythic) {
            setStoredValue(HHStoredVarPrefixKey + TK.eventGirl, JSON.stringify(eventGirlz));
        } else {
            // setStoredValue(HHStoredVarPrefixKey + TK.eventGirl, JSON.stringify(eventGirlz)); // TODO remove when migration is done
            setStoredValue(HHStoredVarPrefixKey + TK.eventMythicGirl, JSON.stringify(eventGirlz));
        }
    }

    static getEventGirl(): EventGirl{
        return getStoredJSON<EventGirl>(HHStoredVarPrefixKey + TK.eventGirl, {} as EventGirl)
    }

    static getEventMythicGirl(): EventGirl{
        return getStoredJSON<EventGirl>(HHStoredVarPrefixKey + TK.eventMythicGirl, {} as EventGirl)
    }

    static getEventType(inEventID:string){
        if(inEventID.startsWith(ConfigHelper.getHHScriptVars('mythicEventIDReg'))) return "mythic";
        if(inEventID.startsWith(ConfigHelper.getHHScriptVars('eventIDReg'))) return "event";
        if(inEventID.startsWith(ConfigHelper.getHHScriptVars('bossBangEventIDReg'))) return "bossBang";
        if(inEventID.startsWith(ConfigHelper.getHHScriptVars('sultryMysteriesEventIDReg'))) return "sultryMysteries";
        if(inEventID.startsWith(ConfigHelper.getHHScriptVars('doublePenetrationEventIDReg'))) return "doublePenetration";
        if(inEventID.startsWith(ConfigHelper.getHHScriptVars('poaEventIDReg'))) return "poa";
        if(inEventID.startsWith(ConfigHelper.getHHScriptVars('livelySceneEventIDReg'))) return "livelyscene";
        if(inEventID.startsWith('cumback_contest_')) return "cumback";
        if(inEventID.startsWith('kinky_event_')) return "kinky";
    //    if(inEventID.startsWith('lively_scene_event_')) return "";
    //    if(inEventID.startsWith('legendary_contest_')) return "";
    //    if(inEventID.startsWith('dpg_event_')) return ""; // Double date
        return "";
    }

    static getEvent(inEventID:string): HHEvent {
        const eventType = EventModule.getEventType(inEventID);
        const isPlusEvent = inEventID.startsWith(ConfigHelper.getHHScriptVars('eventIDReg')) && getStoredValue(HHStoredVarPrefixKey+SK.plusEvent) ==="true";
        const isPlusEventMythic = inEventID.startsWith(ConfigHelper.getHHScriptVars('mythicEventIDReg')) && getStoredValue(HHStoredVarPrefixKey+SK.plusEventMythic) ==="true";
        const isBossBangEvent = inEventID.startsWith(ConfigHelper.getHHScriptVars('bossBangEventIDReg')) && getStoredValue(HHStoredVarPrefixKey+SK.bossBangEvent) ==="true";
        const isSultryMysteriesEvent = inEventID.startsWith(ConfigHelper.getHHScriptVars('sultryMysteriesEventIDReg')) && getStoredValue(HHStoredVarPrefixKey+SK.sultryMysteriesEventRefreshShop) === "true" && SultryMysteries.isEnabled();
        const isDPEvent = inEventID.startsWith(ConfigHelper.getHHScriptVars('doublePenetrationEventIDReg'));
        const isPoa = inEventID.startsWith(ConfigHelper.getHHScriptVars('poaEventIDReg'));
        const isLivelyScene = inEventID.startsWith(ConfigHelper.getHHScriptVars('livelySceneEventIDReg'));
        const isCumback = "cumback" === eventType;
        const isKinky = "kinky" === eventType;
        return {
            eventTypeKnown: eventType !== '',
            eventId: inEventID,
            eventType: eventType,
            isPlusEvent: isPlusEvent, // and activated
            isPlusEventMythic: isPlusEventMythic, // and activated
            isBossBangEvent: isBossBangEvent, // and activated
            isSultryMysteriesEvent: isSultryMysteriesEvent, // and activated
            isDPEvent: isDPEvent, // and activated
            isLivelyScene: isLivelyScene, // and activated
            isPoa: isPoa, // and activated
            isCumback: isCumback,
            isKinky: isKinky,
            isEnabled: isPlusEvent || isPlusEventMythic || isBossBangEvent || isSultryMysteriesEvent || isDPEvent || isPoa || isLivelyScene
        }
    }

    static getEventIDsByType(inType:string):string[] {
        let eventIDs:string[] = [];
        let eventList = getStoredJSON(HHStoredVarPrefixKey + TK.eventsList, {});
        for (let eventID of Object.keys(eventList))
        {
            if (eventList[eventID]["type"] === inType && !eventList[eventID]["isCompleted"]) {
                eventIDs.push(eventID);
            }
        }
        return eventIDs;
    }

    static isEventActive(inEventID:string)
    {
        let eventList = getStoredJSON(HHStoredVarPrefixKey + TK.eventsList, {});
        if (eventList.hasOwnProperty(inEventID) && !eventList[inEventID]["isCompleted"]) {
            return eventList[inEventID]["seconds_before_end"]>new Date()
        }
        return false;
    }

    static checkEvent(inEventID:string)
    {
        let eventList = getStoredJSON(HHStoredVarPrefixKey+TK.eventsList, {});
        const hhEvent = EventModule.getEvent(inEventID);
        if(!hhEvent.eventTypeKnown || hhEvent.eventTypeKnown && !hhEvent.isEnabled)
        {
            return false;
        }
        if (!eventList.hasOwnProperty(inEventID))
        {
            return true;
        }
        else
        {
            if (eventList[inEventID]["isCompleted"])
            {
                return false;
            }
            else
            {
            return (
                    eventList[inEventID]["next_refresh"]<new Date()
                    ||
                    (hhEvent.isPlusEventMythic && checkTimerMustExist('eventMythicNextWave'))
                    ||
                    (hhEvent.isSultryMysteriesEvent && checkTimerMustExist('eventSultryMysteryShopRefresh'))
                    ||
                    (hhEvent.isDPEvent && checkTimerMustExist('nextDpEventCollectTime'))
                    ||
                    (hhEvent.isLivelyScene && checkTimerMustExist('nextLivelySceneEventCollectTime'))
                    );
            }
        }
    }

    static displayPrioInDailyMissionGirl(baseQuery:string){
        let allEventGirlz = unsafeWindow.event_data ? unsafeWindow.event_data.girls : [];
        if(!allEventGirlz) return;
        for (let currIndex = 0;currIndex<allEventGirlz.length;currIndex++)
        {
            let girlData:KKEventGirl = allEventGirlz[currIndex];
            if (girlData.shards < 100 && girlData.source && girlData.source.name === 'event_dm') {

                let query=baseQuery+"[data-select-girl-id="+girlData.id_girl+"]";
                if ($(query).length >0 )
                {
                    let currentGirl=$(query).parent()[0];
                    $(query).prepend('<div class="HHEventPriority" title="'+getTextForUI('dailyMissionGirlTitle','elementText')+'">DM</div>');
                    $(query).css('position','relative');
                    $($(query)).parent().parent()[0].prepend(currentGirl);
                }
            }
        }
    }

    static hideOwnedGilrs() 
    {
        if (getStoredValue(HHStoredVarPrefixKey + SK.hideOwnedGirls) === "true") {
            if ($('.nc-event-list-reward.already-owned').length > 10 && $('.nc-event-list-reward.girl_ico').length > 30) {
                $('.nc-event-list-reward.already-owned').parent().hide();
            }
        }
    }

    static moduleDisplayEventPriority()
    {
        if ($('.HHEventPriority').length  > 0) {return}
        const baseQuery:string = "#events .scroll-area .nc-event-list-reward-container .nc-event-list-reward";
        EventModule.displayPrioInDailyMissionGirl(baseQuery);

        let eventGirlz:EventGirl[]=getStoredJSON<EventGirl[]>(HHStoredVarPrefixKey+TK.eventsGirlz, []);
        let eventChamps:EventGirl[] = getStoredJSON<EventGirl[]>(HHStoredVarPrefixKey+TK.autoChampsEventGirls, []);
        //$("div.event-widget div.widget[style='display: block;'] div.container div.scroll-area div.rewards-block-tape div.girl_reward div.HHEventPriority").each(function(){this.remove();});
        if ( eventGirlz.length >0 || eventChamps.length >0)
        {
            var girl;
            var prio;
            var idArray;
            var currentGirl;
            for ( var ec=eventChamps.length;ec>0;ec--)
            {
                idArray = Number(ec)-1;
                girl = Number(eventChamps[idArray].girl_id);
                let query=baseQuery+"[data-select-girl-id="+girl+"]";
                if ($(query).length >0 )
                {
                    currentGirl=$(query).parent()[0];
                    $(query).prepend('<div class="HHEventPriority">C'+eventChamps[idArray].champ_id+'</div>');
                    $(query).css('position','relative');
                    $($(query)).parent().parent()[0].prepend(currentGirl);
                }
            }
            for ( var e=eventGirlz.length;e>0;e--)
            {
                idArray = Number(e)-1;
                girl = Number(eventGirlz[idArray].girl_id);
                let query=baseQuery+"[data-select-girl-id="+girl+"]";
                if ($(query).length >0 )
                {
                    currentGirl=$(query).parent()[0];
                    $(query).prepend('<div class="HHEventPriority">'+e+'</div>');
                    $($(query)).parent().parent()[0].prepend(currentGirl);
                    $(query).css('position','relative');
                    $(query).trigger('click');
                }
            }
        }
    }

    
    static displayGenericRemainingTime(scriptId, aRel, hhtimerId, timerName, timerEndDateName)
    {
        const displayTimer = $(scriptId).length === 0;
        if(getTimer(timerName) !== -1)
        {
            const domSelector = '#homepage a[rel="'+aRel+'"] .notif-position > span';
            if ($("#"+hhtimerId).length === 0)
            {
                if (displayTimer)
                {
                    $(domSelector).prepend('<span id="'+hhtimerId+'"></span>')
                    GM_addStyle('#'+hhtimerId+'{position: absolute;top: 26px;left: 30px;width: 100px;font-size: .6rem ;z-index: 1;}');
                }
            }
            else
            {
                if (!displayTimer)
                {
                    $("#"+hhtimerId)[0].remove();
                }
            }
            if (displayTimer)
            {
                $("#"+hhtimerId)[0].innerText = getTimeLeft(timerName);
            }
        }
        else
        {
            if (getStoredValue(timerEndDateName) !== undefined)
            {
                setTimer(timerName,getStoredValue(timerEndDateName)-(Math.ceil(new Date().getTime())/1000));
            }
        }
    }
    static moduleSimPoVPogMaskReward(containerId)
    {
        var arrayz;
        var nbReward;
        let modified = false;
        arrayz = $('.potions-paths-tier:not([style*="display:none"]):not([style*="display: none"])');
        //doesn sure about  " .purchase-pov-pass"-button visibility
        if ($('#'+containerId+' .potions-paths-second-row .purchase-pass:not([style*="display:none"]):not([style*="display: none"])').length)
        {
            nbReward = 1;
        }
        else
        {
            nbReward = 2;
        }
        var obj;
        if (arrayz.length > 0)
        {
            for (var i2 = arrayz.length - 1; i2 >= 0; i2--)
            {
                obj = $(arrayz[i2]).find('.claimed-slot:not([style*="display:none"]):not([style*="display: none"])');
                if (obj.length >= nbReward)
                {
                    //console.log("width : "+arrayz[i2].offsetWidth);
                    //document.getElementById('rewards_cont_scroll').scrollLeft-=arrayz[i2].offsetWidth;
                    arrayz[i2].style.display = "none";
                    modified = true;
                }
            }
        }

        if (modified)
        {
            let divToModify = $('.potions-paths-progress-bar-section');
            if (divToModify.length > 0)
            {
                $('.potions-paths-progress-bar-section')[0].scrollTop = 0;
            }
        }
    }
    static collectEventChestIfPossible()
    {
        if (getStoredValue(HHStoredVarPrefixKey+SK.collectEventChest) === "true") {
            const eventChestId = "#extra-rewards-claim-btn:not([disabled])";
            if ($(eventChestId).length > 0) {
                logHHAuto("Collect event chest");
                $(eventChestId).click();
            }
        }
    }

    static parsePageForEventId()
    {
        function getEventQuery(event:string):string {
            return `#contains_all #homepage .event-widget a[rel="${event}"]:not([href="#"])`;
        }
        const eventQuery = getEventQuery("event");
        const mythicEventQuery = getEventQuery("mythic_event");
        const bossBangEventQuery = getEventQuery("boss_bang_event");
        const sultryMysteriesEventQuery = getEventQuery("sm_event");
        const dpEventQuery = getEventQuery("dp_event");
        const livelySceneEventQuery = getEventQuery("lively_scene_event");
        const seasonalEventQuery = '#contains_all #homepage .seasonal-event a, #contains_all #homepage .mega-event a';
        const povEventQuery = '#contains_all #homepage .event-container a[rel="path-of-valor"]';
        const pogEventQuery = '#contains_all #homepage .event-container a[rel="path-of-glory"]';
        const poaEventQuery = getEventQuery("path_event");
        let eventIDs:string[] =[];
        let ongoingEventIDs:string[] =[];
        let bossBangEventIDs:string[]=[];
        const currentPage = getPage();

        function parseForEventId(query:string, eventList:string[]){
            let parsedURL:URL;
            let eventId:string;
            let queryResults=$(query);
            for(let index = 0;index < queryResults.length;index++)
            {
                parsedURL = new URL(queryResults[index].getAttribute("href")||'',window.location.origin);
                eventId = queryStringGetParam(parsedURL.search,'tab') || '';
                const eventName = $(queryResults[index]).children().first().text();
                if (!eventName || eventName == '') {
                    logHHAuto(`Error: No name displayed for event ${eventId}, ignoring it.`);
                    continue;
                }
                if (eventId !== '' && EventModule.checkEvent(eventId))
                {
                    eventList.push(eventId);
                }
                if (eventId !== '') { ongoingEventIDs.push(eventId); }
            }
        }

        if (currentPage === ConfigHelper.getHHScriptVars("pagesIDEvent"))
        {
            const currentPageEventId: string = EventModule.getDisplayedIdEventPage();
            if (currentPageEventId !== null && EventModule.checkEvent(currentPageEventId))
            {
                eventIDs.push(currentPageEventId);
            }

            let parsedURL:URL;
            let eventId:string;
            let eventsQuery = '.events-list a.event-title:not(.active)';
            let queryResults=$(eventsQuery);
            for(let index = 0;index < queryResults.length;index++)
            {
                parsedURL = new URL(queryResults[index].getAttribute("href")||'',window.location.origin);
                eventId = queryStringGetParam(parsedURL.search,'tab') || '';
                if (eventId !== '' && EventModule.checkEvent(eventId))
                {
                    eventIDs.push(eventId);
                }
            }
        }
        else if (currentPage === ConfigHelper.getHHScriptVars("pagesIDHome"))
        {
            let queryResults:any;
            parseForEventId(eventQuery,eventIDs);
            parseForEventId(mythicEventQuery,eventIDs);
            parseForEventId(poaEventQuery,eventIDs);
            parseForEventId(bossBangEventQuery,bossBangEventIDs);
            parseForEventId(sultryMysteriesEventQuery,eventIDs);
            parseForEventId(getEventQuery("cumback_contest"),eventIDs);
            parseForEventId(getEventQuery("kinky_event"),eventIDs);
            if ($(sultryMysteriesEventQuery).length <= 0 && getTimer("eventSultryMysteryShopRefresh") !== -1)
            {
                // event is over
                clearTimer("eventSultryMysteryShopRefresh");
            }
            parseForEventId(dpEventQuery,eventIDs);

            if(getStoredValue(HHStoredVarPrefixKey+SK.autodpEventCollect) === "true" && $(dpEventQuery).length == 0)
            {
                logHHAuto("No double penetration event found, deactivate collect.");
                setStoredValue(HHStoredVarPrefixKey+SK.autodpEventCollect, "false");
            }
            // LivelyScene
            parseForEventId(livelySceneEventQuery,eventIDs);

            if (getStoredValue(HHStoredVarPrefixKey +SK.autoLivelySceneEventCollect) === "true" && $(livelySceneEventQuery).length == 0)
            {
                logHHAuto("No Lively Scene event found, deactivate collect.");
                setStoredValue(HHStoredVarPrefixKey +SK.autoLivelySceneEventCollect, "false");
            }
            queryResults=$(seasonalEventQuery);
            if((getStoredValue(HHStoredVarPrefixKey+SK.autoSeasonalEventCollect) === "true" || getStoredValue(HHStoredVarPrefixKey+SK.autoSeasonalEventCollectAll) === "true") && queryResults.length == 0)
            {
                logHHAuto("No seasonal event found, deactivate collect.");
                setStoredValue(HHStoredVarPrefixKey+SK.autoSeasonalEventCollect, "false");
                setStoredValue(HHStoredVarPrefixKey+SK.autoSeasonalEventCollectAll, "false");
            }
            queryResults=$(povEventQuery);
            if((getStoredValue(HHStoredVarPrefixKey+SK.autoPoVCollect) === "true" || getStoredValue(HHStoredVarPrefixKey+SK.autoPoVCollectAll) === "true") && queryResults.length == 0)
            {
                logHHAuto("No pov event found, deactivate collect.");
                setStoredValue(HHStoredVarPrefixKey+SK.autoPoVCollect, "false");
                setStoredValue(HHStoredVarPrefixKey+SK.autoPoVCollectAll, "false");
            }
            queryResults=$(pogEventQuery);
            if((getStoredValue(HHStoredVarPrefixKey+SK.autoPoGCollect) === "true" || getStoredValue(HHStoredVarPrefixKey+SK.autoPoGCollectAll) === "true") && queryResults.length == 0)
            {
                logHHAuto("No pog event found, deactivate collect.");
                setStoredValue(HHStoredVarPrefixKey+SK.autoPoGCollect, "false");
                setStoredValue(HHStoredVarPrefixKey+SK.autoPoGCollectAll, "false");
            }
        }
/*
        if (currentPage === ConfigHelper.getHHScriptVars("pagesIDEvent") || currentPage === ConfigHelper.getHHScriptVars("pagesIDHome")) {
            const eventList = isJSON(getStoredValue(HHStoredVarPrefixKey + TK.eventsList)) ? JSON.parse(getStoredValue(HHStoredVarPrefixKey + TK.eventsList)) : {};
            for (const eventIDStored of Object.keys(eventList)) {
                //console.log(eventID);
                if (!ongoingEventIDs.includes(eventIDStored)) {
                    logHHAuto(`Event ${eventIDStored} seems not available anymore, removing from store`);
                    EventModule.clearEventData(eventIDStored);
                }
            }
        }
*/
        return {eventIDs:eventIDs,bossBangEventIDs:bossBangEventIDs};
    }
}
