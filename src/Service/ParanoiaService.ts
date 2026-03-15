// ParanoiaService.ts
//
// Anti-detection system that alternates between "burst" (active) and
// "rest" (idle) periods to mimic human play patterns. During rest,
// all actions stop and the script sits on the home page.
//
// Before entering rest, optionally spends remaining energy to avoid
// wasting regeneration during downtime. Mythic events can bypass
// paranoia to avoid missing time-limited waves.
//
// Used by: AutoLoop (checked every iteration when paranoia is on)

import {
    ConfigHelper,
    getHHVars,
    getHero,
    getSecondsLeft,
    getStoredJSON,
    getStoredValue,
    getTimer,
    randomInterval,
    setStoredValue,
    setTimer
} from '../Helper/index';
import { 
    EventModule,
    LeagueHelper,
    Pantheon,
    PlaceOfPower,
    QuestHelper,
    Season,
    Troll
} from '../Module/index';
import { logHHAuto } from '../Utils/index';
import { HHStoredVarPrefixKey, SK, TK } from '../config/index';
import { EventGirl } from '../model/index';
import { getBurst } from "./AutoLoop";
import { gotoPage } from "./PageNavigationService";

export class ParanoiaService {
    static MAX_LOOP = 10;
    static countParanoiaLoop = 0;
        static countParanoiaClear = 0;

    static checkParanoiaSpendings(spendingFunction:string|undefined=undefined): number
    {
        var pSpendings=new Map<string, number>([]);
        // not set
        if ( getStoredValue(HHStoredVarPrefixKey+TK.paranoiaSpendings) === undefined)
        {
            return -1;
        }
        else
        {
            pSpendings = getStoredJSON(HHStoredVarPrefixKey+TK.paranoiaSpendings, new Map(), reviverMap);
        }

        if ( getStoredValue(HHStoredVarPrefixKey+TK.paranoiaQuestBlocked) !== undefined && pSpendings.has('quest'))
        {
            pSpendings.delete('quest');
        }

        if ( getStoredValue(HHStoredVarPrefixKey+TK.paranoiaLeagueBlocked) !== undefined && pSpendings.has('challenge'))
        {
            pSpendings.delete('challenge');
        }

        // for all count remaining
        if (spendingFunction === undefined)
        {
            var spendingsRemaining=0;
            for (var i of pSpendings.values())
            {
                spendingsRemaining+=Number(i);
            }
            //logHHAuto("Paranoia spending remaining : "+JSON.stringify(pSpendings,replacerMap));
            return spendingsRemaining;
        }
        else
        {
            // return value if exist else -1
            return pSpendings.get(spendingFunction) || -1;
        }
    }

    static clearParanoiaSpendings() {
        ParanoiaService.countParanoiaLoop = 0;
        sessionStorage.removeItem(HHStoredVarPrefixKey + TK.paranoiaSpendings);
        sessionStorage.removeItem(HHStoredVarPrefixKey + TK.NextSwitch);
        sessionStorage.removeItem(HHStoredVarPrefixKey + TK.paranoiaQuestBlocked);
        sessionStorage.removeItem(HHStoredVarPrefixKey + TK.paranoiaLeagueBlocked);
    }

    static updatedParanoiaSpendings(inSpendingFunction, inSpent) {
        var currentPSpendings = new Map<string, number>([]);
        // not set
        if (getStoredValue(HHStoredVarPrefixKey + TK.paranoiaSpendings) === undefined) {
            return -1;
        }
        else {
            currentPSpendings = getStoredJSON(HHStoredVarPrefixKey + TK.paranoiaSpendings, new Map(), reviverMap);
            if (currentPSpendings.has(inSpendingFunction)) {
                let currValue = currentPSpendings.get(inSpendingFunction) || 0;
                currValue -= inSpent;

                if (currValue > 0) {
                    logHHAuto("Spent " + inSpent + " " + inSpendingFunction + ", remains " + currValue + " before Paranoia.");
                    currentPSpendings.set(inSpendingFunction, currValue);
                }
                else {
                    currentPSpendings.delete(inSpendingFunction);
                }
            }
            logHHAuto("Remains to spend before Paranoia : " + JSON.stringify(currentPSpendings, replacerMap));
            setStoredValue(HHStoredVarPrefixKey + TK.paranoiaSpendings, JSON.stringify(currentPSpendings, replacerMap));

        }
    }

    //sets spending to do before paranoia
    static setParanoiaSpendings() {
        var maxPointsDuringParanoia;
        var totalPointsEndParanoia;
        var paranoiaSpendings = new Map([]);
        var paranoiaSpend;
        var currentEnergy;
        var maxEnergy;
        var toNextSwitch;
        const tempNextSwitch = getStoredValue(HHStoredVarPrefixKey + TK.NextSwitch);
        if (tempNextSwitch !== undefined && getStoredValue(HHStoredVarPrefixKey + SK.paranoiaSpendsBefore) === "true") {
            toNextSwitch = Number((Number(tempNextSwitch) - new Date().getTime()) / 1000);

            //if autoLeague is on
            if (LeagueHelper.isAutoLeagueActivated()) {
                if (getStoredValue(HHStoredVarPrefixKey + TK.paranoiaLeagueBlocked) === undefined) {
                    maxPointsDuringParanoia = Math.ceil((toNextSwitch - Number(getHHVars('Hero.energies.challenge.next_refresh_ts'))) / Number(getHHVars('Hero.energies.challenge.seconds_per_point')));
                    currentEnergy = LeagueHelper.getEnergy();
                    maxEnergy = LeagueHelper.getEnergyMax();
                    totalPointsEndParanoia = currentEnergy + maxPointsDuringParanoia;
                    //if point refreshed during paranoia would go above max
                    if (totalPointsEndParanoia >= maxEnergy) {
                        paranoiaSpend = totalPointsEndParanoia - maxEnergy + 1;
                        paranoiaSpendings.set("challenge", paranoiaSpend);
                        logHHAuto("Setting Paranoia spendings for league : " + currentEnergy + "+" + maxPointsDuringParanoia + " max gained in " + toNextSwitch + " secs => (" + totalPointsEndParanoia + "/" + maxEnergy + ") spending " + paranoiaSpend);
                    }
                    else {
                        logHHAuto("Setting Paranoia spendings for league : " + currentEnergy + "+" + maxPointsDuringParanoia + " max gained in " + toNextSwitch + " secs => (" + totalPointsEndParanoia + "/" + maxEnergy + ") No spending ");
                    }
                }
            }
            //if autoquest is on
            if (ConfigHelper.getHHScriptVars('isEnabledQuest', false) && (getStoredValue(HHStoredVarPrefixKey + SK.autoQuest) === "true" || (ConfigHelper.getHHScriptVars("isEnabledSideQuest", false) && getStoredValue(HHStoredVarPrefixKey + SK.autoSideQuest) === "true"))) {
                if (getStoredValue(HHStoredVarPrefixKey + TK.paranoiaQuestBlocked) === undefined) {
                    maxPointsDuringParanoia = Math.ceil((toNextSwitch - Number(getHHVars('Hero.energies.quest.next_refresh_ts'))) / Number(getHHVars('Hero.energies.quest.seconds_per_point')));
                    currentEnergy = QuestHelper.getEnergy();
                    maxEnergy = QuestHelper.getEnergyMax();
                    totalPointsEndParanoia = currentEnergy + maxPointsDuringParanoia;
                    //if point refreshed during paranoia would go above max
                    if (totalPointsEndParanoia >= maxEnergy) {
                        paranoiaSpend = totalPointsEndParanoia - maxEnergy + 1;
                        paranoiaSpendings.set("quest", paranoiaSpend);
                        logHHAuto("Setting Paranoia spendings for quest : " + currentEnergy + "+" + maxPointsDuringParanoia + " max gained in " + toNextSwitch + " secs => (" + totalPointsEndParanoia + "/" + maxEnergy + ") spending " + paranoiaSpend);
                    }
                    else {
                        logHHAuto("Setting Paranoia spendings for quest : " + currentEnergy + "+" + maxPointsDuringParanoia + " max gained in " + toNextSwitch + " secs => (" + totalPointsEndParanoia + "/" + maxEnergy + ") No spending ");
                    }
                }
            }
            //if autoTrollBattle is on
            if (ConfigHelper.getHHScriptVars('isEnabledTrollBattle', false) && getStoredValue(HHStoredVarPrefixKey + SK.autoTrollBattle) === "true" && getHHVars('Hero.infos.questing.id_world') > 0) {
                maxPointsDuringParanoia = Math.ceil((toNextSwitch - Number(getHHVars('Hero.energies.fight.next_refresh_ts'))) / Number(getHHVars('Hero.energies.fight.seconds_per_point')));
                currentEnergy = Troll.getEnergy();
                maxEnergy = Troll.getEnergyMax();
                totalPointsEndParanoia = currentEnergy + maxPointsDuringParanoia;
                //if point refreshed during paranoia would go above max
                if (totalPointsEndParanoia >= maxEnergy) {
                    paranoiaSpend = totalPointsEndParanoia - maxEnergy + 1;
                    paranoiaSpendings.set("fight", paranoiaSpend);
                    logHHAuto("Setting Paranoia spendings for troll : " + currentEnergy + "+" + maxPointsDuringParanoia + " max gained in " + toNextSwitch + " secs => (" + totalPointsEndParanoia + "/" + maxEnergy + ") spending " + paranoiaSpend);
                }
                else {
                    logHHAuto("Setting Paranoia spendings for troll : " + currentEnergy + "+" + maxPointsDuringParanoia + " max gained in " + toNextSwitch + " secs => (" + totalPointsEndParanoia + "/" + maxEnergy + ") No spending ");
                }
            }
            //if autoSeason is on
            if (ConfigHelper.getHHScriptVars('isEnabledSeason', false) && getStoredValue(HHStoredVarPrefixKey + SK.autoSeason) === "true") {
                if (getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonIgnoreNoGirls) === "true") {
                    logHHAuto('Season auto is on but ignore fights when no girls to win, no spending kisses.')
                } else {
                maxPointsDuringParanoia = Math.ceil((toNextSwitch - Number(getHHVars('Hero.energies.kiss.next_refresh_ts'))) / Number(getHHVars('Hero.energies.kiss.seconds_per_point')));
                currentEnergy = Season.getEnergy();
                maxEnergy = Season.getEnergyMax();
                totalPointsEndParanoia = currentEnergy + maxPointsDuringParanoia;
                //if point refreshed during paranoia would go above max
                if (totalPointsEndParanoia >= maxEnergy) {
                    paranoiaSpend = totalPointsEndParanoia - maxEnergy + 1;
                    paranoiaSpendings.set("kiss", paranoiaSpend);
                    logHHAuto("Setting Paranoia spendings for Season : " + currentEnergy + "+" + maxPointsDuringParanoia + " max gained in " + toNextSwitch + " secs => (" + totalPointsEndParanoia + "/" + maxEnergy + ") spending " + paranoiaSpend);
                }
                else {
                    logHHAuto("Setting Paranoia spendings for Season : " + currentEnergy + "+" + maxPointsDuringParanoia + " max gained in " + toNextSwitch + " secs => (" + totalPointsEndParanoia + "/" + maxEnergy + ") No spending ");
                }
                }
            }
            //if autoPantheon is on
            if (ConfigHelper.getHHScriptVars('isEnabledPantheon', false) && getStoredValue(HHStoredVarPrefixKey + SK.autoPantheon) === "true") {
                maxPointsDuringParanoia = Math.ceil((toNextSwitch - Number(getHHVars('Hero.energies.worship.next_refresh_ts'))) / Number(getHHVars('Hero.energies.worship.seconds_per_point')));
                currentEnergy = Pantheon.getEnergy();
                maxEnergy = Pantheon.getEnergyMax();
                totalPointsEndParanoia = currentEnergy + maxPointsDuringParanoia;
                //if point refreshed during paranoia would go above max
                if (totalPointsEndParanoia >= maxEnergy) {
                    paranoiaSpend = totalPointsEndParanoia - maxEnergy + 1;
                    paranoiaSpendings.set("worship", paranoiaSpend);
                    logHHAuto("Setting Paranoia spendings for Pantheon : " + currentEnergy + "+" + maxPointsDuringParanoia + " max gained in " + toNextSwitch + " secs => (" + totalPointsEndParanoia + "/" + maxEnergy + ") spending " + paranoiaSpend);
                }
                else {
                    logHHAuto("Setting Paranoia spendings for Pantheon : " + currentEnergy + "+" + maxPointsDuringParanoia + " max gained in " + toNextSwitch + " secs => (" + totalPointsEndParanoia + "/" + maxEnergy + ") No spending ");
                }
            }

            logHHAuto("Setting paranoia spending to : " + JSON.stringify(paranoiaSpendings, replacerMap));
            setStoredValue(HHStoredVarPrefixKey + TK.paranoiaSpendings, JSON.stringify(paranoiaSpendings, replacerMap));
        }
    }

    static flipParanoia() {
        var burst = getBurst();

        var Setting = getStoredValue(HHStoredVarPrefixKey + SK.paranoiaSettings);

        var S1 = Setting.split('/').map(s => s.split('|').map(s => s.split(':')));

        var toNextSwitch;
        var period;
        var n = new Date().getHours();
        S1[2].some(x => { if (n < x[0]) { period = x[1]; return true; } });

        if (burst) {
            var periods = Object.assign({}, ...S1[1].map((d) => ({ [d[0]]: d[1].split('-') })));

            const nextSwitchVal = getStoredValue(HHStoredVarPrefixKey + TK.NextSwitch);
            toNextSwitch = nextSwitchVal ? Number((Number(nextSwitchVal) - new Date().getTime()) / 1000) : randomInterval(Number(periods[period][0]), Number(periods[period][1]));

            //match mythic new wave with end of sleep
            if (getStoredValue(HHStoredVarPrefixKey + SK.autoTrollMythicByPassParanoia) === "true" && getTimer("eventMythicNextWave") !== -1 && toNextSwitch > getSecondsLeft("eventMythicNextWave")) {
                logHHAuto("Forced rest only until next mythic wave.");
                toNextSwitch = getSecondsLeft("eventMythicNextWave");
            }

            //bypass Paranoia if ongoing mythic
            if (getStoredValue(HHStoredVarPrefixKey + SK.autoTrollMythicByPassParanoia) === "true") {
                const eventMythicGirl: EventGirl = EventModule.getEventMythicGirl();
                if (eventMythicGirl.girl_id && eventMythicGirl.is_mythic) {
                    //             var trollThreshold = Number(getStoredValue(HHStoredVarPrefixKey+SK.autoTrollThreshold));
                    //             if (getStoredValue(HHStoredVarPrefixKey+SK.buyMythicCombat) === "true" || getStoredValue(HHStoredVarPrefixKey+SK.autoTrollMythicByPassThreshold) === "true")
                    //             {
                    //                 trollThreshold = 0;
                    //             }
                    //mythic onGoing and still have some fight above threshold
                    if (Troll.getEnergy() > 0) //trollThreshold)
                    {
                        logHHAuto("Forced bypass Paranoia for mythic (can fight).");
                        setTimer('paranoiaSwitch', 60);
                        return;
                    }

                    //mythic ongoing and can buyCombat
                    // const Hero=getHero();
                    // var price=Hero.get_recharge_cost("fight");
                    if (Troll.canBuyFight(eventMythicGirl).canBuy && Troll.getEnergy() == 0) {

                        logHHAuto("Forced bypass Paranoia for mythic (can buy).");
                        setTimer('paranoiaSwitch', 60);
                        return;
                    }
                }
            }

            if (ParanoiaService.checkParanoiaSpendings() === -1 && getStoredValue(HHStoredVarPrefixKey + SK.paranoiaSpendsBefore) === "true") {
                setStoredValue(HHStoredVarPrefixKey + TK.NextSwitch, new Date().getTime() + toNextSwitch * 1000);
                ParanoiaService.setParanoiaSpendings();
                return;
            }

            if (ParanoiaService.checkParanoiaSpendings() === 0 || getStoredValue(HHStoredVarPrefixKey + SK.paranoiaSpendsBefore) === "false") {
                ParanoiaService.clearParanoiaSpendings();
                PlaceOfPower.cleanTempPopToStart();
                //going into hiding
                setStoredValue(HHStoredVarPrefixKey + TK.burst, "false");
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
            }
            else if (ParanoiaService.checkParanoiaSpendings() > 0 && getStoredValue(HHStoredVarPrefixKey + SK.paranoiaSpendsBefore) === "true") {
                // manage wrong values in storage to avoid infinite loop
                ParanoiaService.countParanoiaLoop++;
                // logHHAuto(`checkParanoiaSpendings() = ${checkParanoiaSpendings()}, reached ${ParanoiaService.countParanoiaLoop} times`);
                if (ParanoiaService.countParanoiaLoop > ParanoiaService.MAX_LOOP) {
                    logHHAuto(`10 times flip without actions, clearParanoiaSpending and update (count: ${ParanoiaService.countParanoiaClear++}) `);
                    ParanoiaService.clearParanoiaSpendings();
                    ParanoiaService.setParanoiaSpendings();
                }
                if (ParanoiaService.countParanoiaClear < ParanoiaService.MAX_LOOP)
                    return;
                else
                    logHHAuto(`10 times clearParanoiaSpending and update, let flip continue`);
            }
            else {
                //refresh remaining
                //setParanoiaSpendings(toNextSwitch);
                //let spending go before going in paranoia
                return;
            }
        }
        else {
            //if (getPage()!=ConfigHelper.getHHScriptVars("pagesIDHome")) return;
            //going to work
            setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
            logHHAuto("setting autoloop to false");
            setStoredValue(HHStoredVarPrefixKey + TK.burst, "true");
            var b = S1[0][0][0].split('-');
            toNextSwitch = randomInterval(Number(b[0]), Number(b[1]));
        }
        var ND = new Date().getTime() + toNextSwitch * 1000;
        var message = period + (burst ? " rest" : " burst");
        logHHAuto("PARANOIA: " + message);
        setStoredValue(HHStoredVarPrefixKey + TK.pinfo, message);

        setTimer('paranoiaSwitch', toNextSwitch);
        //force recheck non completed event after paranoia
        if (getStoredValue(HHStoredVarPrefixKey + TK.burst) == "true") {
            /*
            let eventList = getStoredJSON(HHStoredVarPrefixKey+TK.eventsList, {});
            for (let eventID of Object.keys(eventList))
            {
                //console.log(eventID);
                if (!eventList[eventID]["isCompleted"])
                {
                    eventList[eventID]["next_refresh"]=new Date().getTime()-1000;
                    //console.log("expire");
                    if(Object.keys(eventList).length >0)
                    {
                        setStoredValue(HHStoredVarPrefixKey+TK.eventsList, JSON.stringify(eventList));
                    }
                }
            }
            */
            //sessionStorage.removeItem(HHStoredVarPrefixKey+TK.eventsList);
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
        }
    }
}


function replacerMap(key, value) {
    const originalObject = this[key];
    if(originalObject instanceof Map) {
        return {
            dataType: 'Map',
            value: Array.from(originalObject.entries()), // or with spread: value: [...originalObject]
        };
    } else {
        return value;
    }
}

function reviverMap(key, value) {
    if(typeof value === 'object' && value !== null) {
        if (value.dataType === 'Map') {
            return new Map(value.value);
        }
    }
    return value;
}