// Pantheon.ts -- Automates Pantheon fights: opponent selection and energy management.
//
// The Pantheon is a PvP arena with its own energy system. This module selects
// opponents, manages Pantheon-specific fight energy, and handles cooldown
// timers. Similar to League but uses a separate energy pool and ranking system.
//
// Depends on: TeamModule.ts (team selection)
// Used by: Service/index.ts (main automation loop), MonthlyCard.ts
//
import {
    RewardHelper,
    checkTimer,
    ConfigHelper,
    getHHVars,
    getPage,
    getStoredValue,
    getTextForUI,
    getTimeLeft,
    queryStringGetParam,
    randomInterval,
    setStoredValue,
    setTimer,
    HeroHelper
} from '../Helper/index';
import { gotoPage, ParanoiaService } from '../Service/index';
import { logHHAuto } from '../Utils/index';
import { HHStoredVarPrefixKey, SK, TK } from '../config/index';
import { Booster } from "./Booster";
import { DailyGoals } from './DailyGoals';

export class Pantheon {

    static getEnergy() {
        return Number(getHHVars('Hero.energies.worship.amount'));
    }

    static getEnergyMax() {
        return Number(getHHVars('Hero.energies.worship.max_regen_amount'));
    }

    static getPinfo() {
        const threshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoPantheonThreshold)) || 0;
        const runThreshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoPantheonRunThreshold)) || 0;

        let Tegzd = '';
        const boostLimited = getStoredValue(HHStoredVarPrefixKey+SK.autoPantheonBoostedOnly) === "true" && !Booster.haveBoosterEquiped();
        if(boostLimited) {
            Tegzd += '<li style="color:red!important;" title="'+getTextForUI("boostMissing","elementText")+'">';
        }else {
            Tegzd += '<li>';
        }
        Tegzd += getTextForUI("autoPantheonTitle","elementText")+' '+Pantheon.getEnergy()+'/'+Pantheon.getEnergyMax();
        if (runThreshold > 0) {
            Tegzd += ' ('+threshold+'<'+Pantheon.getEnergy()+'<='+runThreshold+')';
        }
        if(runThreshold > 0  && Pantheon.getEnergy() < runThreshold) {
            Tegzd += ' ' + getTextForUI("waitRunThreshold","elementText");
        }else {
            Tegzd += ' : ' + getTimeLeft('nextPantheonTime');
        }
        if (boostLimited) {
            Tegzd += ' ' + getTextForUI("boostMissing","elementText") + '</li>';
        } else {
            Tegzd += '</li>';
        }
        return Tegzd;
    }

    static isEnabled(){
        return ConfigHelper.getHHScriptVars("isEnabledPantheon", false) && HeroHelper.getLevel() >= ConfigHelper.getHHScriptVars("LEVEL_MIN_PANTHEON");
    }

    static isTimeToFight(){
        const threshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoPantheonThreshold)) || 0;
        const runThreshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoPantheonRunThreshold)) || 0;
        const humanLikeRun = getStoredValue(HHStoredVarPrefixKey+TK.PantheonHumanLikeRun) === "true";

        const energyAboveThreshold = humanLikeRun && Pantheon.getEnergy() > threshold || Pantheon.getEnergy() > Math.max(threshold, runThreshold-1);
        const paranoiaSpending = Pantheon.getEnergy() > 0 && ParanoiaService.checkParanoiaSpendings('worship') > 0;
        const needBoosterToFight = getStoredValue(HHStoredVarPrefixKey+SK.autoPantheonBoostedOnly) === "true";
        const haveBoosterEquiped = Booster.haveBoosterEquiped();

        const isDailyGoal = DailyGoals.isPantheonDailyGoal();

        if(checkTimer('nextPantheonTime') && energyAboveThreshold && needBoosterToFight && !haveBoosterEquiped) {
            logHHAuto('Time for pantheon but no booster equipped');
        }

        return (checkTimer('nextPantheonTime') && energyAboveThreshold && (needBoosterToFight && haveBoosterEquiped || !needBoosterToFight || isDailyGoal)) || paranoiaSpending;
    }

    static run()
    {
        logHHAuto("Performing auto Pantheon.");
        // Confirm if on correct screen.
        var page = getPage();
        var current_worship = Pantheon.getEnergy();
        if(page === ConfigHelper.getHHScriptVars("pagesIDPantheon"))
        {
            logHHAuto("On pantheon page.");
            logHHAuto("Remaining worship : "+ current_worship);
            if ( current_worship > 0 )
            {
                const runThreshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoPantheonRunThreshold)) || 0;
                if (runThreshold > 0) {
                    setStoredValue(HHStoredVarPrefixKey+TK.PantheonHumanLikeRun, "true");
                }
                let pantheonButton = $("#pantheon_tab_container .bottom-container .blue_button_L.pantheon-pre-battle-btn");
                let templeID = queryStringGetParam(new URL(pantheonButton[0].getAttribute("href")||'',window.location.origin).search, 'id_opponent');
                if (pantheonButton.length > 0 && templeID !== null )
                {
                    logHHAuto("Going to fight Temple : " + templeID);
                    if (DailyGoals.isAutoDailyGoalsActivated() && DailyGoals.incrementPantheonDailyGoal()) logHHAuto('Increment pantheon daily goals');
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDPantheonPreBattle"),{id_opponent:templeID});
                }
                else
                {
                    logHHAuto("Issue to find templeID retry in 60secs.");
                    setTimer('nextPantheonTime', randomInterval(60, 70));
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                }
            }
            else
            {
                if (getHHVars('Hero.energies.worship.next_refresh_ts') === 0)
                {
                    setTimer('nextPantheonTime', randomInterval(15*60, 17*60));
                }
                else
                {
                    const next_refresh = getHHVars('Hero.energies.worship.next_refresh_ts')
                    setTimer('nextPantheonTime', randomInterval(next_refresh+10, next_refresh + 180));
                }
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
            }
            return;
        }
        else if (page === ConfigHelper.getHHScriptVars("pagesIDPantheonPreBattle"))
        {
            logHHAuto("On pantheon-pre-battle page.");
            let templeID = queryStringGetParam(window.location.search,'id_opponent');
            logHHAuto("Go and fight temple :"+templeID);
            let pantheonTempleBattleButton =$("#pre-battle .battle-buttons .green_button_L.battle-action-button.pantheon-single-battle-button[data-pantheon-id='"+templeID+"']");
            if (pantheonTempleBattleButton.length >0)
            {
                //replaceCheatClick();
                setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
                logHHAuto("setting autoloop to false");
                pantheonTempleBattleButton[0].click();
            }
            else
            {
                logHHAuto("Issue to find temple battle button retry in 60secs. Disabling pantheon battle.");
                setStoredValue(HHStoredVarPrefixKey + SK.autoPantheon, "false");
                setTimer('nextPantheonTime', randomInterval(60, 70));
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
            }
        }
        else
        {
            // Switch to the correct screen
            logHHAuto("Remaining worship : "+ current_worship);
            if ( current_worship > 0 )
            {
                logHHAuto("Switching to pantheon screen.");
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDPantheon"));

                return;
            }
            else
            {
                if (getHHVars('Hero.energies.worship.next_refresh_ts') === 0)
                {
                    setTimer('nextPantheonTime', randomInterval(15*60, 17*60));
                }
                else
                {
                    const next_refresh = getHHVars('Hero.energies.worship.next_refresh_ts')
                    setTimer('nextPantheonTime', randomInterval(next_refresh+10, next_refresh + 180));
                }
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
            }
            return;
        }
    }
}