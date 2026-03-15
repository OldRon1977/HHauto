// GenericBattle.ts -- Handles the battle result page UI across all fight types.
//
// When a battle completes (troll, event, league, etc.), this module manages
// the result page: adds skip buttons, auto-skips fight animations, and parses
// reward drops. It acts as a shared handler for all battle outcomes rather
// than being specific to one game mode.
//
// Used by: Service/index.ts (main automation loop), Troll.ts, League.ts,
//          and other fight modules that navigate to battle pages
//
import {
    RewardHelper,
    ConfigHelper,
    getHHVars,
    getPage,
    getStoredValue,
    queryStringGetParam,
    randomInterval,
    setStoredValue
} from '../Helper/index';
import { gotoPage } from '../Service/index';
import { logHHAuto } from '../Utils/index';
import { HHStoredVarPrefixKey, SK, TK } from '../config/index';
import { EventGirl, LoveRaid } from '../model/index';
import { Troll } from "./Troll";
import { DailyGoals, EventModule, LoveRaidManager } from './index';

export class GenericBattle {
    static doBattle()
    {
        if (
            getPage() === ConfigHelper.getHHScriptVars("pagesIDLeagueBattle") 
            || getPage() === ConfigHelper.getHHScriptVars("pagesIDTrollBattle") 
            || getPage() === ConfigHelper.getHHScriptVars("pagesIDSeasonBattle") 
            || getPage() === ConfigHelper.getHHScriptVars("pagesIDPentaDrillBattle") 
            || getPage() === ConfigHelper.getHHScriptVars("pagesIDPantheonBattle")
            || getPage() === ConfigHelper.getHHScriptVars("pagesIDLabyrinthBattle") )
        {
            logHHAuto("On battle page.");
            if (getPage() === ConfigHelper.getHHScriptVars("pagesIDLeagueBattle") && getStoredValue(HHStoredVarPrefixKey+SK.autoLeagues) === "true")
            {
                logHHAuto("Reloading after league fight.");
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDLeaderboard"),{},randomInterval(4000,5000));
            }
            else if (getPage() === ConfigHelper.getHHScriptVars("pagesIDTrollBattle") )
            {
                const lastTrollIdAvailable = Troll.getLastTrollIdAvailable();
                let troll_id:string = queryStringGetParam(window.location.search,'id_opponent');
                //console.log(Number(troll_id),Number(getHHVars('Hero.infos.questing.id_world'))-1,Number(troll_id) === Number(getHHVars('Hero.infos.questing.id_world'))-1);
                if (getStoredValue(HHStoredVarPrefixKey+TK.autoTrollBattleSaveQuest) === "true" && (Number(troll_id) === lastTrollIdAvailable))
                {
                    setStoredValue(HHStoredVarPrefixKey+TK.autoTrollBattleSaveQuest, "false");
                }

                const eventGirl: EventGirl = EventModule.getEventGirl();
                const eventMythicGirl: EventGirl = EventModule.getEventMythicGirl();
                if(
                    getStoredValue(HHStoredVarPrefixKey + SK.plusEvent) === "true" && eventGirl?.girl_id && !eventGirl?.is_mythic
                    || 
                    getStoredValue(HHStoredVarPrefixKey + SK.plusEventMythic) === "true" && eventMythicGirl?.girl_id && eventMythicGirl?.is_mythic
                )
                {
                    logHHAuto("Event ongoing search for girl rewards in popup.");
                    RewardHelper.ObserveAndGetGirlRewards();
                }
                else
                {
                    LoveRaidManager.getTrollRaids().forEach(raid => {
                        if(raid.trollId === Number(troll_id))
                        {
                            logHHAuto("Event ongoing search for girl rewards in popup.");
                            RewardHelper.ObserveAndGetGirlRewards();
                            return true;
                        }
                    });

                    if (troll_id !== null)
                    {
                        logHHAuto("Go back to Troll after Troll fight.");
                        gotoPage(ConfigHelper.getHHScriptVars("pagesIDTrollPreBattle"),{id_opponent:troll_id},randomInterval(2000,4000));
                    }
                    else
                    {
                        logHHAuto("Go to home after unknown troll fight.");
                        gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"),{},randomInterval(2000,4000));
                    }
                }

            }
            else if (getPage() === ConfigHelper.getHHScriptVars("pagesIDSeasonBattle") && getStoredValue(HHStoredVarPrefixKey+SK.autoSeason) === "true")
            {
                logHHAuto("Go back to Season arena after Season fight.");
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDSeasonArena"),{},randomInterval(2000,4000));
            }
            else if (getPage() === ConfigHelper.getHHScriptVars("pagesIDPentaDrillBattle") && getStoredValue(HHStoredVarPrefixKey +SK.autoPentaDrill) === "true")
            {
                logHHAuto("Go back to Penta drill arena after fight.");
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDPentaDrillArena"),{},randomInterval(2000,4000));
            }
            else if (getPage() === ConfigHelper.getHHScriptVars("pagesIDPantheonBattle") && (getStoredValue(HHStoredVarPrefixKey + SK.autoPantheon) === "true" || DailyGoals.isPantheonDailyGoal()))
            {
                logHHAuto("Go back to Pantheon arena after Pantheon temple.");
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDPantheon"),{},randomInterval(2000,4000));
            }
            else if (getPage() === ConfigHelper.getHHScriptVars("pagesIDLabyrinthBattle") && getStoredValue(HHStoredVarPrefixKey+SK.autoLabyrinth) === "true")
            {
                logHHAuto("Go back to Labyrinth after fight.");
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDLabyrinth"),{},randomInterval(2000,4000));
            }
            return true;
        }
        else
        {
            logHHAuto('Unable to identify page.');
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
            return;
        }
    }

}