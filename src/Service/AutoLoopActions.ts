// AutoLoopActions.ts
//
// Contains all discrete action handlers called by the AutoLoop. Each
// handler checks whether its preconditions are met (feature enabled,
// timer expired, energy available, not busy) and if so, triggers the
// corresponding module action and marks the loop as busy.
//
// Handlers are executed in a fixed priority order defined in AutoLoop.ts.
// Only one action fires per loop iteration (once ctx.busy is true, all
// subsequent handlers skip). This serialization prevents conflicting
// navigation and ensures the game page is in a known state.
//
// Handler naming convention: handle<Feature>(ctx) where ctx is the
// shared AutoLoopContext carrying busy state, event data, and energy.
//
// Used by: AutoLoop.autoLoop()

import { AutoLoopContext } from './AutoLoopContext';
import { ModuleHandlerDescriptor } from '../model/IModule';
import {
    checkTimer,
    checkTimerMustExist,
    deleteStoredValue,
    ConfigHelper,
    getHHVars,
    getHero,
    getLimitTimeBeforeEnd,
    getSecondsLeft,
    getStoredValue,
    getStoredJSON,
    getTimer,
    randomInterval,
    setStoredValue,
    setTimer,
    HeroHelper
} from '../Helper/index';
import { PentaDrill } from '../Module/PentaDrill';
import {
    Booster,
    BossBang,
    Bundles,
    Champion,
    ClubChampion,
    Contest,
    DailyGoals,
    EventModule,
    GenericBattle,
    Harem,
    HaremSalary,
    Labyrinth,
    LabyrinthAuto,
    LeagueHelper,
    Missions,
    Pachinko,
    Pantheon,
    PathOfGlory,
    PathOfValue,
    PlaceOfPower,
    QuestHelper,
    LoveRaidManager,
    Season,
    SeasonalEvent,
    Shop,
    Troll
} from '../Module/index';
import {
    getHHAjax,
    logHHAuto,
} from '../Utils/index';
import {
    HHStoredVarPrefixKey,
    SK,
    TK
} from '../config/index';
import { EventGirl } from '../model/EventGirl';
import { LoveRaid } from '../model/LoveRaid';
import {
    gotoPage,
    mouseBusy,
    ParanoiaService,
} from "./index";
import { isAutoLoopActive } from './AutoLoop';

// ---------------------------------------------------------------------------
//  Standard handler utility – reduces boilerplate for simple module handlers
// ---------------------------------------------------------------------------

/**
 * Executes a standard module handler if all preconditions are met.
 * Handles the common pattern: check busy → check autoLoop → check competition
 * → check lastAction → check isReady → log → execute → update busy & lastAction.
 */
export async function runStandardHandler(ctx: AutoLoopContext, d: ModuleHandlerDescriptor): Promise<void> {
    if (ctx.busy) return;
    if (d.requiresAutoLoop !== false && !isAutoLoopActive()) return;
    if (d.requiresCompetition && !ctx.canCollectCompetitionActive) return;
    if (ctx.lastActionPerformed !== "none" && ctx.lastActionPerformed !== d.action) return;
    if (!d.isReady()) return;

    logHHAuto(d.name);
    const result = await d.execute();
    ctx.busy = typeof result === 'boolean' ? result : true;
    ctx.lastActionPerformed = d.action;
}

// ---------------------------------------------------------------------------
//  Action handlers – called in order from autoLoop()
// ---------------------------------------------------------------------------

// 1. handleEventParsing - lines 234-253
export async function handleEventParsing(ctx: AutoLoopContext): Promise<void> {
    if(
        ctx.busy === false && ConfigHelper.getHHScriptVars("isEnabledEvents",false) && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "event" || (getStoredValue(HHStoredVarPrefixKey+SK.autoTrollBattle) === "true" && getStoredValue(HHStoredVarPrefixKey+SK.plusEventMythic) ==="true") )
        &&
        (
            (ctx.eventIDs.length > 0 && ctx.currentPage !== ConfigHelper.getHHScriptVars("pagesIDEvent"))
            ||
            (ctx.currentPage===ConfigHelper.getHHScriptVars("pagesIDEvent") && $("#contains_all #events[parsed]").length < ctx.eventIDs.length)
        )
    )
    {
        logHHAuto("Going to check on events.");
        ctx.busy = true;
        ctx.busy = await EventModule.parseEventPage(ctx.eventIDs[0]);
        ctx.eventParsed = ctx.eventIDs[0];
        ctx.lastActionPerformed = "event";
        if (ctx.eventIDs.length > 1) {
            logHHAuto("More events to be parsed.", JSON.stringify(ctx.eventIDs));
            ctx.busy = true;
        }
    }
}

// 2. handleMythicWave - lines 255-261
export async function handleMythicWave(ctx: AutoLoopContext): Promise<void> {
    if (ctx.busy === false && isAutoLoopActive() && ctx.canCollectCompetitionActive
        && getStoredValue(HHStoredVarPrefixKey+SK.plusEventMythic) ==="true" && checkTimerMustExist('eventMythicNextWave') && getSecondsLeft("eventMythicGoing") > 0
        && Troll.isEnabled())
    {
        logHHAuto("Mythic wave !");
        ctx.lastActionPerformed = "troll";
    }
}

// 3. handleShop - lines 263-274
export async function handleShop(ctx: AutoLoopContext): Promise<void> {
    if (ctx.busy===false && ConfigHelper.getHHScriptVars("isEnabledShop",false) && Shop.isTimeToCheckShop() && isAutoLoopActive() && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "shop"))
    {
        if (getStoredValue(HHStoredVarPrefixKey+TK.charLevel) ===undefined)
        {
            setStoredValue(HHStoredVarPrefixKey+TK.charLevel, 0);
        }
        if (checkTimer('nextShopTime') || getStoredValue(HHStoredVarPrefixKey + TK.charLevel) < HeroHelper.getLevel()) {
            logHHAuto("Time to check shop.");
            ctx.busy = Shop.updateShop();
            ctx.lastActionPerformed = "shop";
        }
    }
}

// 3b. handleAutoEquipBoosters - auto-equip legendary boosters when slots are empty/expired
export async function handleAutoEquipBoosters(ctx: AutoLoopContext): Promise<void> {
    if (ctx.busy === false
        && getStoredValue(HHStoredVarPrefixKey + SK.autoEquipBoosters) === "true"
        && checkTimer('nextAutoEquipBoosterTime')
        && isAutoLoopActive()
    ) {
        const equipped = await Booster.autoEquipBoosters();
        if (equipped) {
            ctx.busy = true;
            ctx.lastActionPerformed = "autoEquipBoosters";
        }
    }
}

// 4. handleHaremSize - lines 276-288
export async function handleHaremSize(ctx: AutoLoopContext): Promise<void> {
    if (
        ctx.busy === false
        && isAutoLoopActive()
        && Harem.HaremSizeNeedsRefresh(ConfigHelper.getHHScriptVars("HaremMaxSizeExpirationSecs"))
        && ctx.currentPage !== ConfigHelper.getHHScriptVars("pagesIDWaifu")
        && ctx.currentPage !== ConfigHelper.getHHScriptVars("pagesIDEditTeam")
        && (ctx.lastActionPerformed === "none")
    ) {
        //console.log(! isJSON(getStoredValue(HHStoredVarPrefixKey+TK.HaremSize)),JSON.parse(getStoredValue(HHStoredVarPrefixKey+TK.HaremSize)).count_date,new Date().getTime() + ConfigHelper.getHHScriptVars("HaremSizeExpirationSecs") * 1000);
        // Update girl count
        ctx.busy = true;
        gotoPage(ConfigHelper.getHHScriptVars("pagesIDWaifu"));
    }
}

// 5. handlePlaceOfPower - lines 290-344
export async function handlePlaceOfPower(ctx: AutoLoopContext): Promise<void> {
    if(ctx.busy === false && PlaceOfPower.isActivated()
    && isAutoLoopActive() && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "pop"))
    {

        var popToStart = getStoredJSON(HHStoredVarPrefixKey+TK.PopToStart, []);
        if (popToStart.length != 0 || checkTimer('minPowerPlacesTime'))
        {
            //if PopToStart exist bypass function
            var popToStartExist = getStoredValue(HHStoredVarPrefixKey+TK.PopToStart)?true:false;
            //logHHAuto("startcollect : "+popToStartExist);
            if (! popToStartExist)
            {
                //logHHAuto("pop1:"+popToStart);
                logHHAuto("Go and collect pop");
                ctx.busy = true;
                ctx.busy = await PlaceOfPower.collectAndUpdate();
            }
            var indexes=(getStoredValue(HHStoredVarPrefixKey+SK.autoPowerPlacesIndexFilter)).split(";");

            popToStart = getStoredJSON(HHStoredVarPrefixKey+TK.PopToStart, []);
            //console.log(indexes, popToStart);
            for(var pop of popToStart)
            {
                if (ctx.busy === false && ! indexes.includes(String(pop)))
                {
                    logHHAuto("PoP is no longer in list :"+pop+" removing it from start list.");
                    PlaceOfPower.removePopFromPopToStart(pop);
                }
            }
            popToStart = getStoredJSON(HHStoredVarPrefixKey+TK.PopToStart, []);
            //logHHAuto("pop2:"+popToStart);
            for(var index of indexes)
            {
                if (ctx.busy === false && popToStart.includes(Number(index)))
                {
                    logHHAuto("Time to do PowerPlace"+index+".");
                    ctx.busy = true;
                    ctx.busy = await PlaceOfPower.doPowerPlacesStuff(index);
                    ctx.lastActionPerformed = "pop";
                }
            }
            if (ctx.busy === false)
            {
                //logHHAuto("pop3:"+getStoredValue(HHStoredVarPrefixKey+TK.PopToStart));
                popToStart = getStoredJSON(HHStoredVarPrefixKey+TK.PopToStart, []);
                //logHHAuto("pop3:"+popToStart);
                if (popToStart.length === 0)
                {
                    //logHHAuto("removing popToStart");
                    sessionStorage.removeItem(HHStoredVarPrefixKey+TK.PopToStart);
                    gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                }
            }
        }
    }
}

// 6. handleGenericBattle - lines 346-363
export async function handleGenericBattle(ctx: AutoLoopContext): Promise<void> {
    if
        (
            ctx.busy === false
            &&
            (
                ctx.currentPage === ConfigHelper.getHHScriptVars("pagesIDLeagueBattle")
                || ctx.currentPage === ConfigHelper.getHHScriptVars("pagesIDTrollBattle")
                || ctx.currentPage === ConfigHelper.getHHScriptVars("pagesIDSeasonBattle")
                || ctx.currentPage === ConfigHelper.getHHScriptVars("pagesIDPentaDrillBattle")
                || ctx.currentPage === ConfigHelper.getHHScriptVars("pagesIDPantheonBattle")
                || ctx.currentPage === ConfigHelper.getHHScriptVars("pagesIDLabyrinthBattle")
            )
            && isAutoLoopActive() && ctx.canCollectCompetitionActive
        )
    {
        ctx.busy = true;
        GenericBattle.doBattle();
    }
}

// 7. handleLoveRaid - lines 365-372
export async function handleLoveRaid(ctx: AutoLoopContext): Promise<void> {
    await runStandardHandler(ctx, {
        name: "Time to go and check raids.",
        action: "loveraid",
        requiresCompetition: true,
        isReady: () => LoveRaidManager.isAnyActivated() && checkTimer('nextLoveRaidTime'),
        execute: () => LoveRaidManager.parse(),
    });
}

// 8. handleTrollBattle - lines 374-462 (includes the outer if-block and the else at 459-462)
export async function handleTrollBattle(ctx: AutoLoopContext): Promise<void> {
    // DEBUG: log preconditions for troll battle
    logHHAuto(`handleTrollBattle preconditions: busy=${ctx.busy}, isTrollFightActivated=${Troll.isTrollFightActivated()}, autoLoop=${isAutoLoopActive()}, competition=${ctx.canCollectCompetitionActive}, lastAction=${ctx.lastActionPerformed}, power=${ctx.currentPower}`);
    if(ctx.busy === false && Troll.isTrollFightActivated()
    && isAutoLoopActive() && ctx.canCollectCompetitionActive
    && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "troll" || ctx.lastActionPerformed === "quest"))
    {
        const threshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoTrollThreshold)) || 0;
        const runThreshold = Number(getStoredValue(HHStoredVarPrefixKey + SK.autoTrollRunThreshold)) || 0;
        const humanLikeRun = getStoredValue(HHStoredVarPrefixKey+TK.TrollHumanLikeRun) === "true";
        const energyAboveThreshold = humanLikeRun && ctx.currentPower > threshold || ctx.currentPower > Math.max(threshold, runThreshold-1);
        //logHHAuto("fight amount: "+currentPower+" troll threshold: "+threshold+" paranoia fight: "+Number(checkParanoiaSpendings('fight')));
        const eventGirl: EventGirl = EventModule.getEventGirl();
        const eventMythicGirl: EventGirl = EventModule.getEventMythicGirl();
        const allTrollRaids = LoveRaidManager.isAnyActivated() ? LoveRaidManager.getTrollRaids() : [];
        const raidStarsFiltered = LoveRaidManager.filterByRaidStars(allTrollRaids);
        const raidStarsRaid: LoveRaid = LoveRaidManager.getRaidStarsRaidToFight(raidStarsFiltered);
        // +Raid: user-selected girl bypasses grade filter, auto-mode respects it
        const loveRaid: LoveRaid = LoveRaidManager.isActivated()
            ? LoveRaidManager.getRaidToFight(allTrollRaids)
            : undefined;
        if
            (
                //normal case (only when autoTrollBattle is ON)
                (
                    getStoredValue(HHStoredVarPrefixKey + SK.autoTrollBattle) === "true"
                    && ctx.currentPower >= Number(getStoredValue(HHStoredVarPrefixKey+TK.battlePowerRequired))
                    && ctx.currentPower > 0
                    &&
                    (
                        energyAboveThreshold
                        || getStoredValue(HHStoredVarPrefixKey+TK.autoTrollBattleSaveQuest) === "true"
                    )
                )
                || getStoredValue(HHStoredVarPrefixKey + SK.autoTrollBattle) === "true" && ctx.currentPower > 0 && ParanoiaService.checkParanoiaSpendings('fight') > 0 //paranoiaspendings to do
                ||
                (
                    // mythic Event Girl available and fights available
                    (eventMythicGirl.girl_id && eventMythicGirl.is_mythic && getStoredValue(HHStoredVarPrefixKey+SK.plusEventMythic) ==="true")
                    &&
                    (
                        ctx.currentPower > 0 //has fight => bypassing paranoia
                        || Troll.canBuyFight(eventMythicGirl, false).canBuy // can buy fights
                    )
                )
                ||
                (
                    // Raid Stars: raid with girl grade >= configured minimum (independent, bypasses threshold)
                    (raidStarsRaid?.id_girl)
                    &&
                    (
                        ctx.currentPower > 0
                        || Troll.canBuyFightForRaid(raidStarsRaid, false).canBuy
                    )
                )
                ||
                (
                    // normal Event Girl available
                    (eventGirl.girl_id && !eventGirl.is_mythic && getStoredValue(HHStoredVarPrefixKey+SK.plusEvent) ==="true")
                    &&
                    (
                        energyAboveThreshold
                        || Troll.canBuyFight(eventGirl, false).canBuy // can buy fights
                    )
                )
                ||
                (
                    // +Raid: user-selected Love raid (independent from troll threshold)
                    (LoveRaidManager.isActivated() && loveRaid?.id_girl)
                    &&
                    (
                        ctx.currentPower > 0
                        || Troll.canBuyFightForRaid(loveRaid, false).canBuy
                    )
                )
            )
        {
            logHHAuto('Troll:', {threshold: threshold, runThreshold:runThreshold, TrollHumanLikeRun: humanLikeRun});
            setStoredValue(HHStoredVarPrefixKey+TK.battlePowerRequired, "0");
            ctx.busy = true;
            if (getStoredValue(HHStoredVarPrefixKey+SK.autoQuest) !== "true" || getStoredValue(HHStoredVarPrefixKey+TK.questRequirement)[0] !== 'P')
            {
                ctx.busy = await Troll.doBossBattle();
                if (ctx.busy) {
                    ctx.lastActionPerformed = "troll";
                }
            }
            else if (getStoredValue(HHStoredVarPrefixKey+SK.autoTrollBattle) === "true")
            {
                logHHAuto("AutoBattle disabled for power collection for AutoQuest.");
                (<HTMLInputElement>document.getElementById("autoTrollBattle")).checked = false;
                setStoredValue(HHStoredVarPrefixKey+SK.autoTrollBattle, "false");
                ctx.busy = false;
            }
            else
            {
                // Events/Raids only mode — quest power collection does not block
                ctx.busy = await Troll.doBossBattle();
                if (ctx.busy) {
                    ctx.lastActionPerformed = "troll";
                }
            }
        }
        else
        {
            if(getStoredValue(HHStoredVarPrefixKey+TK.TrollHumanLikeRun) === "true") {
                // end run
                setStoredValue(HHStoredVarPrefixKey+TK.TrollHumanLikeRun, "false");
            }
            /*if (ctx.currentPage === ConfigHelper.getHHScriptVars("pagesIDTrollPreBattle"))
            {
                logHHAuto("Go to home after troll fight");
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));

            }*/
        }

    }
    else
    {
        setStoredValue(HHStoredVarPrefixKey+TK.battlePowerRequired, "0");
    }
}

// 9. handlePachinko - lines 465-487 (all 3 pachinko types)
export async function handlePachinko(ctx: AutoLoopContext): Promise<void> {
    if (ctx.busy === false && ConfigHelper.getHHScriptVars("isEnabledMythicPachinko",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoFreePachinko) === "true"
        && isAutoLoopActive() && checkTimer("nextPachinko2Time") && ctx.canCollectCompetitionActive
        && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "pachinko")) {
        logHHAuto("Time to fetch Mythic Pachinko.");
        ctx.busy = await Pachinko.getMythicPachinko();
        ctx.lastActionPerformed = "pachinko";
    }

    if (ctx.busy === false && ConfigHelper.getHHScriptVars("isEnabledGreatPachinko",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoFreePachinko) === "true"
        && isAutoLoopActive() && checkTimer("nextPachinkoTime") && ctx.canCollectCompetitionActive
        && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "pachinko")) {
        logHHAuto("Time to fetch Great Pachinko.");
        ctx.busy = await Pachinko.getGreatPachinko();
        ctx.lastActionPerformed = "pachinko";
    }

    if (ctx.busy === false && ConfigHelper.getHHScriptVars("isEnabledEquipmentPachinko",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoFreePachinko) === "true"
        && isAutoLoopActive() && checkTimer("nextPachinkoEquipTime") && ctx.canCollectCompetitionActive
        && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "pachinko")) {
        logHHAuto("Time to fetch Equipment Pachinko.");
        ctx.busy = await Pachinko.getEquipmentPachinko();
        ctx.lastActionPerformed = "pachinko";
    }
}

// 10. handleContest - lines 489-497
export async function handleContest(ctx: AutoLoopContext): Promise<void> {
    await runStandardHandler(ctx, {
        name: "Time to get contest rewards.",
        action: "contest",
        isReady: () => ConfigHelper.getHHScriptVars("isEnabledContest", false)
            && getStoredValue(HHStoredVarPrefixKey + SK.autoContest) === "true"
            && (checkTimer('nextContestCollectTime') || unsafeWindow.has_contests_datas || Contest.getClaimsButton().length > 0),
        execute: () => Contest.run(),
    });
}

// 11. handleMissions - lines 499-507
export async function handleMissions(ctx: AutoLoopContext): Promise<void> {
    await runStandardHandler(ctx, {
        name: "Time to do missions.",
        action: "mission",
        isReady: () => ConfigHelper.getHHScriptVars("isEnabledMission", false)
            && getStoredValue(HHStoredVarPrefixKey + SK.autoMission) === "true"
            && checkTimer('nextMissionTime'),
        execute: () => Missions.run(),
    });
}

// 12. handleQuest - lines 509-663 (includes the else-if at 660-663)
export async function handleQuest(ctx: AutoLoopContext): Promise<void> {
    if (ctx.busy === false && ConfigHelper.getHHScriptVars("isEnabledQuest",false)
        && (getStoredValue(HHStoredVarPrefixKey+SK.autoQuest) === "true" || (ConfigHelper.getHHScriptVars("isEnabledSideQuest",false)
        && getStoredValue(HHStoredVarPrefixKey+SK.autoSideQuest) === "true")) && isAutoLoopActive()
        && ctx.canCollectCompetitionActive && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "quest"))
    {
        if (getStoredValue(HHStoredVarPrefixKey+TK.autoTrollBattleSaveQuest) === undefined)
        {
            setStoredValue(HHStoredVarPrefixKey+TK.autoTrollBattleSaveQuest, "false");
        }
        let questRequirement = getStoredValue(HHStoredVarPrefixKey+TK.questRequirement);
        if (questRequirement === "battle")
        {
            if (ConfigHelper.getHHScriptVars("isEnabledTrollBattle",false) && getStoredValue(HHStoredVarPrefixKey+TK.autoTrollBattleSaveQuest) === "false")
            {
                logHHAuto("Quest requires battle.");
                logHHAuto("prepare to save one battle for quest");
                setStoredValue(HHStoredVarPrefixKey+TK.autoTrollBattleSaveQuest, "true");
                if(getStoredValue(HHStoredVarPrefixKey+SK.autoTrollBattle) !== "true") {
                    Troll.doBossBattle();
                    ctx.busy = true;
                }
            }
        }
        else if (questRequirement[0] === '$')
        {
            if (Number(questRequirement.substr(1)) < HeroHelper.getMoney()) {
                // We have enough money... requirement fulfilled.
                logHHAuto("Continuing quest, required money obtained.");
                setStoredValue(HHStoredVarPrefixKey+TK.questRequirement, "none");
                QuestHelper.run();
                ctx.busy = true;
            }
            else
            {
                //prevent paranoia to wait for quest
                setStoredValue(HHStoredVarPrefixKey+TK.paranoiaQuestBlocked, "true");
                if(isNaN(questRequirement.substr(1)))
                {
                    logHHAuto(questRequirement);
                    setStoredValue(HHStoredVarPrefixKey+TK.questRequirement, "none");
                    logHHAuto("Invalid money in session storage quest requirement !");
                }
                ctx.busy = false;
            }
        }
        else if (questRequirement[0] === '*')
        {
            var energyNeeded = Number(questRequirement.substr(1));
            var energyCurrent = QuestHelper.getEnergy();
            if (energyNeeded <= energyCurrent)
            {
                if (Number(energyCurrent) > Number(getStoredValue(HHStoredVarPrefixKey + SK.autoQuestThreshold)) || ParanoiaService.checkParanoiaSpendings('quest') > 0 )
                {
                    // We have enough energy... requirement fulfilled.
                    logHHAuto("Continuing quest, required energy obtained.");
                    setStoredValue(HHStoredVarPrefixKey+TK.questRequirement, "none");
                    QuestHelper.run();
                    ctx.busy = true;
                }
                else
                {
                    ctx.busy = false;
                }
            }
            // Else we need energy, just wait.
            else
            {
                //prevent paranoia to wait for quest
                setStoredValue(HHStoredVarPrefixKey+TK.paranoiaQuestBlocked, "true");
                ctx.busy = false;
                //logHHAuto("Replenishing energy for quest.(" + energyNeeded + " needed)");
            }
        }
        else if (questRequirement[0] === 'P')
        {
            // Battle power required.
            var neededPower = Number(questRequirement.substr(1));
            if(ctx.currentPower < neededPower)
            {
                logHHAuto("Quest requires "+neededPower+" Battle Power for advancement. Waiting...");
                ctx.busy = false;
                //prevent paranoia to wait for quest
                setStoredValue(HHStoredVarPrefixKey+TK.paranoiaQuestBlocked, "true");
            }
            else
            {
                logHHAuto("Battle Power obtained, resuming quest...");
                setStoredValue(HHStoredVarPrefixKey+TK.questRequirement, "none");
                QuestHelper.run();
                ctx.busy = true;
            }
        }
        else if (questRequirement === "unknownQuestButton")
        {
            //prevent paranoia to wait for quest
            setStoredValue(HHStoredVarPrefixKey+TK.paranoiaQuestBlocked, "true");
            if (getStoredValue(HHStoredVarPrefixKey+SK.autoQuest) === "true")
            {
                logHHAuto("AutoQuest disabled.HHAuto_Setting_AutoQuest cannot be performed due to unknown quest button. Please manually proceed the current quest screen.");
                (<HTMLInputElement>document.getElementById("autoQuest")).checked = false;
                setStoredValue(HHStoredVarPrefixKey+SK.autoQuest, "false");
            }
            if (getStoredValue(HHStoredVarPrefixKey+SK.autoSideQuest) === "true")
            {
                logHHAuto("AutoQuest disabled.HHAuto_Setting_autoSideQuest cannot be performed due to unknown quest button. Please manually proceed the current quest screen.");
                (<HTMLInputElement>document.getElementById("autoSideQuest")).checked = false;
                setStoredValue(HHStoredVarPrefixKey+SK.autoSideQuest, "false");
            }
            setStoredValue(HHStoredVarPrefixKey+TK.questRequirement, "none");
            ctx.busy = false;
        }
        else if (questRequirement === "errorInAutoBattle")
        {
            //prevent paranoia to wait for quest
            setStoredValue(HHStoredVarPrefixKey+TK.paranoiaQuestBlocked, "true");
            if (getStoredValue(HHStoredVarPrefixKey+SK.autoQuest) === "true")
            {
                logHHAuto("AutoQuest disabled.HHAuto_Setting_AutoQuest cannot be performed due errors in AutoBattle. Please manually proceed the current quest screen.");
                (<HTMLInputElement>document.getElementById("autoQuest")).checked = false;
                setStoredValue(HHStoredVarPrefixKey+SK.autoQuest, "false");
            }
            if (getStoredValue(HHStoredVarPrefixKey+SK.autoSideQuest) === "true")
            {
                logHHAuto("AutoQuest disabled.HHAuto_Setting_autoSideQuest cannot be performed due errors in AutoBattle. Please manually proceed the current quest screen.");
                (<HTMLInputElement>document.getElementById("autoSideQuest")).checked = false;
                setStoredValue(HHStoredVarPrefixKey+SK.autoSideQuest, "false");
            }
            setStoredValue(HHStoredVarPrefixKey+TK.questRequirement, "none");
            ctx.busy = false;
        }
        else if(questRequirement === "none")
        {
            if (checkTimer('nextMainQuestAttempt') && checkTimer('nextSideQuestAttempt'))
            {
                if (QuestHelper.getEnergy() > Number(getStoredValue(HHStoredVarPrefixKey + SK.autoQuestThreshold)) || ParanoiaService.checkParanoiaSpendings('quest') > 0 )
                {
                    //logHHAuto("NONE req.");
                    ctx.busy = true;
                    QuestHelper.run();
                }
            }
        }
        else
        {
            //prevent paranoia to wait for quest
            setStoredValue(HHStoredVarPrefixKey+TK.paranoiaQuestBlocked, "true");
            logHHAuto("Invalid quest requirement : "+questRequirement);
            ctx.busy=false;
        }
        if(ctx.busy) ctx.lastActionPerformed = "quest";
    }
    else if(getStoredValue(HHStoredVarPrefixKey+SK.autoQuest) === "false" && getStoredValue(HHStoredVarPrefixKey+SK.autoSideQuest) === "false")
    {
        setStoredValue(HHStoredVarPrefixKey+TK.questRequirement, "none");
    }
}

// 13. handleLeague - lines 665-697
export async function handleLeague(ctx: AutoLoopContext): Promise<void> {
    if (ctx.busy === false && LeagueHelper.isAutoLeagueActivated() && isAutoLoopActive()
        && ctx.canCollectCompetitionActive && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "league")) {
        // Navigate to leagues
        if (LeagueHelper.isTimeToFight()) {
            logHHAuto("Time to fight in Leagues.");
            LeagueHelper.doLeagueBattle();
            ctx.busy = true;
            ctx.lastActionPerformed = "league";
        }
        else {
            if (getStoredValue(HHStoredVarPrefixKey + TK.LeagueHumanLikeRun) === "true") {
                // end run
                setStoredValue(HHStoredVarPrefixKey + TK.LeagueHumanLikeRun, "false");
            }
            if (checkTimer('nextLeaguesTime')) {
                if (getHHVars('Hero.energies.challenge.next_refresh_ts') === 0) {
                    setTimer('nextLeaguesTime', randomInterval(15 * 60, 17 * 60));
                }
                else {
                    const next_refresh = getHHVars('Hero.energies.challenge.next_refresh_ts')
                    setTimer('nextLeaguesTime', randomInterval(next_refresh + 10, next_refresh + 180));
                }
            }
            //logHHAuto("reset lastActionPerformed from league");
            ctx.lastActionPerformed = "none";
            /*if (ctx.currentPage === ConfigHelper.getHHScriptVars("pagesIDLeaderboard"))
            {
                logHHAuto("Go to home after league fight");
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));

            }*/
        }
    }
}

// 14. handleSeason - lines 699-724
export async function handleSeason(ctx: AutoLoopContext): Promise<void> {
    if(ctx.busy === false && ConfigHelper.getHHScriptVars("isEnabledSeason",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoSeason) === "true"
        && isAutoLoopActive() && ctx.canCollectCompetitionActive && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "season"))
    {
        if (Season.isTimeToFight())
        {
            logHHAuto("Time to fight in Season.");
            ctx.busy = await Season.run();
            ctx.lastActionPerformed = "season";
        }
        else if (checkTimer('nextSeasonTime'))
        {
            if(getStoredValue(HHStoredVarPrefixKey+TK.SeasonHumanLikeRun) === "true") {
                // end run
                setStoredValue(HHStoredVarPrefixKey+TK.SeasonHumanLikeRun, "false");
            }
            if (getHHVars('Hero.energies.kiss.next_refresh_ts') === 0)
            {
                setTimer('nextSeasonTime', randomInterval(15*60, 17*60));
            }
            else
            {
                const next_refresh = getHHVars('Hero.energies.kiss.next_refresh_ts')
                setTimer('nextSeasonTime', randomInterval(next_refresh+10, next_refresh + 180));
            }
        }
    }
}

// 15. handlePentaDrill - lines 726-753
export async function handlePentaDrill(ctx: AutoLoopContext): Promise<void> {
    if (ctx.busy === false && ConfigHelper.getHHScriptVars("isEnabledPentaDrill", false) && getStoredValue(HHStoredVarPrefixKey +SK.autoPentaDrill) === "true"
        && isAutoLoopActive() && ctx.canCollectCompetitionActive && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "pentaDrill"))
    {
        // Need 7 girls to do PentaDrill
        if (PentaDrill.isTimeToFight())
        {
            logHHAuto("Time to fight in PentaDrill.");
            PentaDrill.run();
            ctx.busy = true;
            ctx.lastActionPerformed = "pentaDrill";
        }
        else if (checkTimer('nextPentaDrillTime'))
        {
            if (getStoredValue(HHStoredVarPrefixKey +TK.PentaDrillHumanLikeRun) === "true") {
                // end run
                setStoredValue(HHStoredVarPrefixKey +TK.PentaDrillHumanLikeRun, "false");
            }
            if (getHHVars('Hero.energies.drill.next_refresh_ts') === 0)
            {
                setTimer('nextPentaDrillTime', randomInterval(15*60, 17*60));
            }
            else
            {
                const next_refresh = getHHVars('Hero.energies.drill.next_refresh_ts')
                setTimer('nextPentaDrillTime', randomInterval(next_refresh+10, next_refresh + 180));
            }
        }
    }
}

// 16. handlePantheon - lines 755-784
export async function handlePantheon(ctx: AutoLoopContext): Promise<void> {
    if(ctx.busy === false
        && (getStoredValue(HHStoredVarPrefixKey+SK.autoPantheon) === "true" || DailyGoals.isPantheonDailyGoal())
        && Pantheon.isEnabled() && isAutoLoopActive() && ctx.canCollectCompetitionActive && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "pantheon"))
    {
        if (Pantheon.isTimeToFight())
        {
            logHHAuto("Time to do Pantheon.");
            Pantheon.run();
            ctx.busy = true;
            ctx.lastActionPerformed = "pantheon";
        }
        else if (checkTimer('nextPantheonTime'))
        {
            if(getStoredValue(HHStoredVarPrefixKey+TK.PantheonHumanLikeRun) === "true") {
                // end run
                setStoredValue(HHStoredVarPrefixKey+TK.PantheonHumanLikeRun, "false");
            }
            if (getHHVars('Hero.energies.worship.next_refresh_ts') === 0)
            {
                setTimer('nextPantheonTime', randomInterval(15*60, 17*60));
            }
            else
            {
                const next_refresh = getHHVars('Hero.energies.worship.next_refresh_ts')
                setTimer('nextPantheonTime', randomInterval(next_refresh+10, next_refresh + 180));
            }
            //logHHAuto("reset lastActionPerformed from pantheon");
            ctx.lastActionPerformed = "none";
        }
    }
}

// 17. handleChampionTicket - lines 786-810 (includes the nested buyTicket function)
export async function handleChampionTicket(ctx: AutoLoopContext): Promise<void> {
    if (ctx.busy==false && ConfigHelper.getHHScriptVars("isEnabledChamps",false)
        && QuestHelper.getEnergy()>=ConfigHelper.getHHScriptVars("CHAMP_TICKET_PRICE") && QuestHelper.getEnergy() > Number(getStoredValue(HHStoredVarPrefixKey+SK.autoQuestThreshold))
        && getStoredValue(HHStoredVarPrefixKey+SK.autoChampsUseEne) ==="true" && isAutoLoopActive()
        && ctx.canCollectCompetitionActive && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "champion"))
    {
        const Hero = getHero();
        function buyTicket()
        {
            var params = {
                action: 'champion_buy_ticket',
                currency: 'energy_quest',
                amount: "1"
            };
            logHHAuto('Buying ticket with energy');
            getHHAjax()(params, function(data) {
                //anim_number($('.tickets_number_amount'), data.tokens - amount, amount);
                Hero.updates(data.hero_changes);
                location.reload();
            });
        }
        setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
        logHHAuto("setting autoloop to false");
        ctx.busy = true;
        setTimeout(buyTicket,randomInterval(800,1600));
        ctx.lastActionPerformed = "champion";
    }
}

// 18. handleChampion - lines 812-818
export async function handleChampion(ctx: AutoLoopContext): Promise<void> {
    await runStandardHandler(ctx, {
        name: "Time to check on champions!",
        action: "champion",
        isReady: () => ConfigHelper.getHHScriptVars("isEnabledChamps", false)
            && getStoredValue(HHStoredVarPrefixKey + SK.autoChamps) === "true"
            && checkTimer('nextChampionTime'),
        execute: () => Champion.doChampionStuff(),
    });
}

// 19. handleClubChampion - lines 820-826
export async function handleClubChampion(ctx: AutoLoopContext): Promise<void> {
    await runStandardHandler(ctx, {
        name: "Time to check on club champion!",
        action: "clubChampion",
        isReady: () => ConfigHelper.getHHScriptVars("isEnabledClubChamp", false)
            && getStoredValue(HHStoredVarPrefixKey + SK.autoClubChamp) === "true"
            && checkTimer('nextClubChampionTime'),
        execute: () => ClubChampion.doClubChampionStuff(),
    });
}

// 20. handleSeasonCollect - lines 828-841
export async function handleSeasonCollect(ctx: AutoLoopContext): Promise<void> {
    if (
        ctx.busy==false && ConfigHelper.getHHScriptVars("isEnabledSeason",false) && isAutoLoopActive() &&
        (
            checkTimer('nextSeasonCollectTime') && getStoredValue(HHStoredVarPrefixKey+SK.autoSeasonCollect) === "true" && ctx.canCollectCompetitionActive
            ||
            getStoredValue(HHStoredVarPrefixKey+SK.autoSeasonCollectAll) === "true" && checkTimer('nextSeasonCollectAllTime') && (getTimer('SeasonRemainingTime') == -1 || getSecondsLeft('SeasonRemainingTime') < getLimitTimeBeforeEnd())
        )  && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "season")
    )
    {
        logHHAuto("Time to go and check Season for collecting reward.");
        ctx.busy = true;
        ctx.busy = Season.goAndCollect();
        ctx.lastActionPerformed = "season";
    }
}

// 21. handlePentaDrillCollect - lines 843-855
export async function handlePentaDrillCollect(ctx: AutoLoopContext): Promise<void> {
    if (
        ctx.busy==false && ConfigHelper.getHHScriptVars("isEnabledPentaDrill",false) && isAutoLoopActive() &&
        (
            checkTimer('nextPentaDrillCollectTime') && getStoredValue(HHStoredVarPrefixKey+SK.autoPentaDrillCollect) === "true" && ctx.canCollectCompetitionActive
            ||
            getStoredValue(HHStoredVarPrefixKey+SK.autoPentaDrillCollectAll) === "true" && checkTimer('nextPentaDrillCollectAllTime') && (getTimer('pentaDrillRemainingTime') == -1 || getSecondsLeft('pentaDrillRemainingTime') < getLimitTimeBeforeEnd())
        ) && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "pentaDrill")
    )
    {
        logHHAuto("Time to go and check PentaDrill for collecting reward.");
        ctx.busy = PentaDrill.goAndCollect();
        ctx.lastActionPerformed = "pentaDrill";
    }
}

// 22. handleSeasonalFreeCard - lines 857-865
export async function handleSeasonalFreeCard(ctx: AutoLoopContext): Promise<void> {
    await runStandardHandler(ctx, {
        name: "Time to go and check SeasonalEvent to buy free card.",
        action: "seasonal",
        requiresCompetition: true,
        isReady: () => ConfigHelper.getHHScriptVars("isEnabledSeasonalEvent", false)
            && getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonalBuyFreeCard) === "true"
            && checkTimer('nextSeasonalCardCollectTime'),
        execute: () => SeasonalEvent.goAndCollectFreeCard(),
    });
}

// 23. handleSeasonalEventCollect - lines 867-879
export async function handleSeasonalEventCollect(ctx: AutoLoopContext): Promise<void> {
    if (
        ctx.busy==false && ConfigHelper.getHHScriptVars("isEnabledSeasonalEvent",false) && isAutoLoopActive() &&
        (
            checkTimer('nextSeasonalEventCollectTime') && getStoredValue(HHStoredVarPrefixKey+SK.autoSeasonalEventCollect) === "true" && ctx.canCollectCompetitionActive
            ||
            getStoredValue(HHStoredVarPrefixKey+SK.autoSeasonalEventCollectAll) === "true" && checkTimer('nextSeasonalEventCollectAllTime') && (getTimer('SeasonalEventRemainingTime') == -1 || getSecondsLeft('SeasonalEventRemainingTime') < getLimitTimeBeforeEnd())
        ) && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "seasonal")
    )
    {
        logHHAuto("Time to go and check SeasonalEvent for collecting reward.");
        ctx.busy = SeasonalEvent.goAndCollect();
        ctx.lastActionPerformed = "seasonal";
    }
}

// 24. handleSeasonalRankCollect - lines 881-890
export async function handleSeasonalRankCollect(ctx: AutoLoopContext): Promise<void> {
    await runStandardHandler(ctx, {
        name: "Time to go and check SeasonalEvent for collecting rank reward.",
        action: "seasonal",
        requiresCompetition: true,
        isReady: () => ConfigHelper.getHHScriptVars("isEnabledSeasonalEvent", false)
            && getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonalEventCollect) === "true"
            && checkTimer('nextMegaEventRankCollectTime'),
        execute: () => SeasonalEvent.goAndCollectMegaEventRankRewards(),
    });
}

// 25. handlePoVCollect - lines 892-905
export async function handlePoVCollect(ctx: AutoLoopContext): Promise<void> {
    if (
        ctx.busy==false && isAutoLoopActive() && PathOfValue.isEnabled() &&
        (
            checkTimer('nextPoVCollectTime') && getStoredValue(HHStoredVarPrefixKey+SK.autoPoVCollect) === "true" && ctx.canCollectCompetitionActive
            ||
            getStoredValue(HHStoredVarPrefixKey+SK.autoPoVCollectAll) === "true" && checkTimer('nextPoVCollectAllTime') && (getTimer('PoVRemainingTime') == -1 || getSecondsLeft('PoVRemainingTime') < getLimitTimeBeforeEnd())
        ) && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "pov")
    )
    {
        logHHAuto("Time to go and check Path of Valor for collecting reward.");
        ctx.busy = true;
        ctx.busy = PathOfValue.goAndCollect();
        ctx.lastActionPerformed = "pov";
    }
}

// 26. handlePoGCollect - lines 907-920
export async function handlePoGCollect(ctx: AutoLoopContext): Promise<void> {
    if (
        ctx.busy==false && isAutoLoopActive() && PathOfGlory.isEnabled() &&
        (
            checkTimer('nextPoGCollectTime') && getStoredValue(HHStoredVarPrefixKey+SK.autoPoGCollect) === "true" && ctx.canCollectCompetitionActive
            ||
            getStoredValue(HHStoredVarPrefixKey+SK.autoPoGCollectAll) === "true" && checkTimer('nextPoGCollectAllTime') && (getTimer('PoGRemainingTime') == -1 || getSecondsLeft('PoGRemainingTime') < getLimitTimeBeforeEnd())
        ) && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "pog")
    )
    {
        logHHAuto("Time to go and check Path of Glory for collecting reward.");
        ctx.busy = true;
        ctx.busy = PathOfGlory.goAndCollect();
        ctx.lastActionPerformed = "pog";
    }
}

// 27. handleFreeBundles - lines 922-930
export async function handleFreeBundles(ctx: AutoLoopContext): Promise<void> {
    await runStandardHandler(ctx, {
        name: "Time to go and check Free Bundles for collecting reward.",
        action: "bundle",
        requiresCompetition: true,
        isReady: () => ConfigHelper.getHHScriptVars("isEnabledFreeBundles", false)
            && getStoredValue(HHStoredVarPrefixKey + SK.autoFreeBundlesCollect) === "true"
            && checkTimer('nextFreeBundlesCollectTime'),
        execute: () => { Bundles.goAndCollectFreeBundles(); },
    });
}

// 28. handleDailyGoals - lines 932-939
export async function handleDailyGoals(ctx: AutoLoopContext): Promise<void> {
    await runStandardHandler(ctx, {
        name: "Time to go and check daily Goals for collecting reward.",
        action: "dailyGoals",
        requiresCompetition: true,
        isReady: () => ConfigHelper.getHHScriptVars("isEnabledDailyGoals", false)
            && getStoredValue(HHStoredVarPrefixKey + SK.autoDailyGoalsCollect) === "true"
            && checkTimer('nextDailyGoalsCollectTime'),
        execute: () => DailyGoals.goAndCollect(),
    });
}

// 29. handleLabyrinth - lines 941-946
export async function handleLabyrinth(ctx: AutoLoopContext): Promise<void> {
    await runStandardHandler(ctx, {
        name: "Time to check on labyrinth.",
        action: "labyrinth",
        requiresCompetition: true,
        isReady: () => getStoredValue(HHStoredVarPrefixKey + SK.autoLabyrinth) === "true"
            && Labyrinth.isEnabled()
            && checkTimer('nextLabyrinthTime'),
        execute: () => (new LabyrinthAuto).run(),
    });
}

// 30. handleSalary - lines 948-958
export async function handleSalary(ctx: AutoLoopContext): Promise<void> {
    if (ctx.busy === false && ConfigHelper.getHHScriptVars("isEnabledSalary",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoSalary) === "true"
        && ctx.currentPage === ConfigHelper.getHHScriptVars("pagesIDHome")
        && ( getStoredValue(HHStoredVarPrefixKey+SK.paranoia) !== "true" || !checkTimer("paranoiaSwitch") )
        && isAutoLoopActive() && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "salary"))
    {
        if (checkTimer("nextSalaryTime")) {
            //logHHAuto("Time to check salary.");
            ctx.busy = await HaremSalary.getSalary();
            // if(busy) lastActionPerformed = "salary"; // Removed from continuous actions for now
        }
    }
}

// 31. handleBossBangParse - lines 960-980
export async function handleBossBangParse(ctx: AutoLoopContext): Promise<void> {
    if(
        ctx.busy === false
        && ConfigHelper.getHHScriptVars("isEnabledBossBangEvent", false) && getStoredValue(HHStoredVarPrefixKey + SK.bossBangEvent) === "true"
        &&
        (
            (
                ctx.bossBangEventIDs.length > 0
                && ctx.currentPage !== ConfigHelper.getHHScriptVars("pagesIDEvent")
            )
            ||
            (
                ctx.currentPage===ConfigHelper.getHHScriptVars("pagesIDEvent")
                && $('#contains_all #events #boss_bang .completed-event').length === 0
            )
        ) && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "event")
    )
    {
        logHHAuto("Going to parse boss bang event.");
        ctx.busy = await EventModule.parseEventPage(ctx.bossBangEventIDs[0]);
        ctx.lastActionPerformed = "event";
    }
}

// 32. handleBossBangFight - lines 982-1002
export async function handleBossBangFight(ctx: AutoLoopContext): Promise<void> {
    if(
        ctx.busy === false
        && ConfigHelper.getHHScriptVars("isEnabledBossBangEvent", false) && getStoredValue(HHStoredVarPrefixKey + SK.bossBangEvent) === "true"
        &&
        (
            (
                ctx.bossBangEventIDs.length > 0
                && ctx.currentPage !== ConfigHelper.getHHScriptVars("pagesIDEvent")
            )
            ||
            (
                ctx.currentPage===ConfigHelper.getHHScriptVars("pagesIDEvent")
                && $('#contains_all #events #boss_bang .completed-event').length === 0
            )
        ) && isAutoLoopActive() && (ctx.lastActionPerformed === "none" || ctx.lastActionPerformed === "bossBang") && checkTimer('nextBossBangTime')
    )
    {
        logHHAuto("Going to fight boss bang.");
        ctx.busy = await BossBang.goToFightPage(ctx.bossBangEventIDs[0]);
        ctx.lastActionPerformed = "bossBang";
    }
}

// 33. handleGoHome - lines 1004-1016
export async function handleGoHome(ctx: AutoLoopContext): Promise<void> {
    const lastPageCalled = getStoredJSON(HHStoredVarPrefixKey+TK.LastPageCalled, {page:'', dateTime:0});
    if (
        ctx.busy === false
        && ctx.currentPage !== ConfigHelper.getHHScriptVars("pagesIDHome")
        && ctx.currentPage === lastPageCalled.page
        && (new Date().getTime() - lastPageCalled.dateTime) > ConfigHelper.getHHScriptVars("minSecsBeforeGoHomeAfterActions") * 1000
    )
    {
        //console.log("testingHome : GotoHome : "+getStoredValue(HHStoredVarPrefixKey+TK.LastPageCalled));
        logHHAuto("Back to home page at the end of actions");
        deleteStoredValue(HHStoredVarPrefixKey+TK.LastPageCalled);
        gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
    }
}
