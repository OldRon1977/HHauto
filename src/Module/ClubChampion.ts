// ClubChampion.ts -- Automates Club Champion cooperative fights.
//
// Club Champions are cooperative boss battles shared among club members. This
// module manages fight scheduling, energy tracking, and automatic participation
// in club champion rounds. Requires active club membership (see Club.ts).
//
// Depends on: Club.ts (membership check), TeamModule.ts (team selection)
// Used by: Service/index.ts (main automation loop)
//
import {
    TimeHelper,
    convertTimeToInt,
    deleteStoredValue,
    ConfigHelper,
    getHHVars,
    getPage,
    getSecondsLeft,
    getStoredValue,
    randomInterval,
    setStoredValue,
    setTimer,
    HeroHelper
} from '../Helper/index';
import { gotoPage } from "../Service/index";
import { logHHAuto } from '../Utils/index';
import { HHStoredVarPrefixKey, SK, TK } from '../config/index';
import { Champion } from './index';
import { QuestHelper } from "./Quest";

export class ClubChampion {

    static getNextClubChampionTimer()
    {
        var page=getPage();
        if (page==ConfigHelper.getHHScriptVars("pagesIDClub"))
        {
            let SecsToNextTimer = -1;
            let restTeamFilter = 'div.club_champions_details_container div.team_rest_timer span[rel="timer"]';
            let restChampionFilter = 'div.club_champions_details_container div.champion_rest_timer span[rel="expires"]';

            if ($(restTeamFilter).length > 0)
            {
                SecsToNextTimer = Number(convertTimeToInt($(restTeamFilter).text()));
                logHHAuto("Team is resting for : "+TimeHelper.toHHMMSS(SecsToNextTimer));
            }
            else if ($(restChampionFilter).length > 0)
            {
                SecsToNextTimer = Number(convertTimeToInt($(restChampionFilter).text()));
                logHHAuto("Champion is resting for : " + TimeHelper.toHHMMSS(SecsToNextTimer));
                if(ClubChampion.hasGirlReward()) {
                    SecsToNextTimer = randomInterval(30 * 60, 35 * 60);
                    logHHAuto("Champion has girl reward");
                }
            }
            else {
                logHHAuto('No timer found');
            }
            logHHAuto('on clubs, next timer:'+ SecsToNextTimer);
            return SecsToNextTimer;
        }
        return 0; // -1 is only when no timer on club page
    }
    
    static updateClubChampionTimer()
    {
        var page=getPage();
        if (page==ConfigHelper.getHHScriptVars("pagesIDClub"))
        {
            logHHAuto('on clubs');
            let secsToNextTimer = ClubChampion.getNextClubChampionTimer();
            let noTimer = (secsToNextTimer === -1);
            let nextClubChampionTime: number;

            if (secsToNextTimer === -1)
            {
                nextClubChampionTime = randomInterval(15*60, 17*60);
            }
            else if (secsToNextTimer > 7200 && getStoredValue(HHStoredVarPrefixKey+SK.autoClubForceStart) === "true")
            {
                nextClubChampionTime = randomInterval(115*60, 125*60);
            }
            else
            {
                nextClubChampionTime = randomInterval(secsToNextTimer, 180 + secsToNextTimer);
            }
            ClubChampion._setTimer(nextClubChampionTime);
            return noTimer;
        }
        return true;
    }

    /** From club champion page */
    static getRemainingRestTime(): number{
        let remainingRestTime = 0;
        
        let timerElm = $('.champions-bottom__rest .timer span[rel=expires]').text();
        if (timerElm !== undefined && timerElm !== null && timerElm.length > 0) {
            remainingRestTime = Number(convertTimeToInt(timerElm));
        }
        return remainingRestTime;
    }

    static hasGirlReward(): boolean{
        return $('#club_champions .club_champions_rewards_container .slot.slot_girl_shards').length > 0
    }

    static resetTimerIfNeeded(): void{
        if ($('button[rel=perform].blue_button_L').length>0 && $('.champions-bottom__rest').length == 0
            && getStoredValue(HHStoredVarPrefixKey+SK.autoClubChamp) === "true") {
            const champTimeLeft = getSecondsLeft('nextClubChampionTime');
            if (champTimeLeft > 60) {
                logHHAuto("Club champion seems available, reduce next timer to 30-60s.");
                ClubChampion._setTimer(randomInterval(30, 60));
            }
        }
    }

    static async doClubChampionStuff(): Promise<boolean>
    {
        var page=getPage();
        if (page==ConfigHelper.getHHScriptVars("pagesIDClubChampion"))
        {
            logHHAuto('on club_champion page');
            if ($('button[rel=perform].blue_button_L').length==0)
            {
                if($('.champions-bottom__rest').length > 0) {
                    logHHAuto('Girls are resting');
                    const restTime = ClubChampion.getRemainingRestTime();
                    ClubChampion._setTimer(randomInterval(restTime + 10, restTime + 2*60));
                } else {
                    logHHAuto('Something is wrong!');
                    ClubChampion._setTimer(randomInterval(15*60, 17*60));
                }
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                return true;
            }
            else
            {
                const clubChamptionFightActive: boolean = getHHVars('championData.fight.active') || false;
                const clubChamptionParticipants:{id_member: number | string; challenge_count: number; [key: string]: unknown}[] = getHHVars('championData.fight.participants') || {};
                const playerId = HeroHelper.getPlayerId();
                const userStarted = clubChamptionParticipants.find(participant => participant.id_member == playerId)
                const playerStarted = clubChamptionFightActive && userStarted && userStarted.challenge_count > 0;

                var TCount=Number($('div.input-field > span')[1].innerText.split(' / ')[1]);
                var ECount= QuestHelper.getEnergy();
                logHHAuto(`T:${TCount} E:${ECount} Player challenge :${userStarted?.challenge_count || 0}`);
                if ( TCount==0)
                {
                    logHHAuto("No tickets!");
                    const nextTime = randomInterval(3600, 4000);
                    if (getStoredValue(HHStoredVarPrefixKey+SK.autoChamps) ==="true") {
                        // No ticket for boths
                        setTimer('nextChampionTime', nextTime);
                    }
                    setTimer('nextClubChampionTime', nextTime);
                    return false;
                }
                else
                {
                    if ((!clubChamptionFightActive || !playerStarted) && getStoredValue(HHStoredVarPrefixKey + SK.autoBuildChampsTeam) === "true") {
                        const tempChampBuildTeam = getStoredValue(HHStoredVarPrefixKey + TK.champBuildTeam);
                        if (tempChampBuildTeam == "club") {
                            deleteStoredValue(HHStoredVarPrefixKey + TK.champBuildTeam);
                        } else {
                            logHHAuto("Build team before start");
                            if ($("#updateChampTeamButton").length == 0) {
                                Champion.moduleSimChampions();
                                await TimeHelper.sleep(randomInterval(200, 500));
                            }
                            if ($("#updateChampTeamButton").attr("disabled") === "disabled") {
                                logHHAuto('Cannot build team, no free draft available. Starting champion without building team');
                            } else {
                                $("#updateChampTeamButton").trigger("click"); // Auto loop false
                                setStoredValue(HHStoredVarPrefixKey + TK.champBuildTeam, "club");
                                await TimeHelper.sleep(randomInterval(2000, 5000));
                                return true; // In next loop started after team build, start champ without building team again
                            }
                        }
                    }
                    if (TCount!=0)
                    {
                        logHHAuto("Using ticket");
                        $('button[rel=perform].blue_button_L').trigger('click');
                        ClubChampion._setTimer(randomInterval(15*60, 17*60));
                    }
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDClub"));
                    return true;
                }
            }
        }
        else if (page==ConfigHelper.getHHScriptVars("pagesIDClub"))
        {
            deleteStoredValue(HHStoredVarPrefixKey+TK.clubChampLimitReached);
            logHHAuto('on clubs');
            const onChampTab = $("div.club-champion-members-challenges:visible").length === 1;
            if (!onChampTab) {
                logHHAuto('Click champions tab');
                $("#club_champions_tab").trigger('click');
            }
    
            let Started = $("div.club-champion-members-challenges .player-row").length === 1;
            let secsToNextTimer = ClubChampion.getNextClubChampionTimer();
            let noTimer = secsToNextTimer === -1;
    
            if ((Started || getStoredValue(HHStoredVarPrefixKey+SK.autoClubForceStart) === "true") && noTimer)
            {
                let ticketUsed = 0;
                let ticketsUsedRequest = "div.club-champion-members-challenges .player-row .data-column:nth-of-type(3)";
                if ($(ticketsUsedRequest).length >0)
                {
                    ticketUsed = Number($(ticketsUsedRequest)[0].innerText.replace(/[^0-9]/gi, ''));
                }
                let maxTickets = Number(getStoredValue(HHStoredVarPrefixKey+SK.autoClubChampMax));
                //console.log(maxTickets, ticketUsed);
                if (maxTickets > ticketUsed )
                {
                    logHHAuto("Let's do him!");
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDClubChampion"));
                    return true;
                }
                else
                {
                    logHHAuto("Max tickets to use on Club Champ reached.");
                    setStoredValue(HHStoredVarPrefixKey+TK.clubChampLimitReached, "true");
                    setTimer('nextClubChampionTime', randomInterval(4*60*60, 5*60*60));
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                    return false;
                }
            }
            ClubChampion.updateClubChampionTimer();
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
            return false;
        }
        else
        {
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDClub"));
            return true;
        }
    }

    /**
     * 
     * @param {number} nextClubChampionTime 
     * @private
     */
    static _setTimer(nextClubChampionTime: number): void {
        if (getStoredValue(HHStoredVarPrefixKey+SK.autoChamps) ==="true" && getStoredValue(HHStoredVarPrefixKey+SK.autoChampAlignTimer) === "true") {
            const champTimeLeft = getSecondsLeft('nextChampionTime');
            if(nextClubChampionTime > 10 && champTimeLeft < 1200 && nextClubChampionTime < 1200) { // align settings
                // 20 min for standard wait time
                nextClubChampionTime = Math.max(nextClubChampionTime, champTimeLeft);
            }
        }
        setTimer('nextClubChampionTime', nextClubChampionTime);
    }
}