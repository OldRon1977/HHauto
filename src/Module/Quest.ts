// Quest.ts -- Automates questing: accepts quests, handles quest steps, and buys
// energy if configured.
//
// Quests are the main PvE progression system. This module accepts available
// quests, advances through multi-step quest chains, and optionally purchases
// quest energy when configured to do so. Tracks quest completion and manages
// the quest page navigation.
//
// Used by: Module/Champion.ts, Module/ClubChampion.ts, Module/MonthlyCard.ts, Service/AutoLoop.ts and others
//
import { ConfigHelper } from "../Helper/ConfigHelper";
import { HeroHelper } from "../Helper/HeroHelper";
import { getHHVars } from "../Helper/HHHelper";
import { getPage } from "../Helper/PageHelper";
import { parsePrice } from "../Helper/PriceHelper";
import { deleteStoredValue, getStoredJSON, getStoredValue, setStoredValue } from "../Helper/StorageHelper";
import { randomInterval } from "../Helper/TimeHelper";
import { checkTimer, clearTimer, getSecondsLeft, setTimer } from "../Helper/TimerHelper";
import { kickAutoLoop } from "../Service/AutoLoopKick";
import { gotoPage } from "../Service/PageNavigationService";
import { logHHAuto } from "../Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK, TK } from "../config/StorageKeys";

export class QuestHelper {
    static SITE_QUEST_PAGE = '/side-quests.html';
    /** Set when the game refuses a step for money; handleQuest's '$' branch
     *  does not retry before it runs out. The money is usually back within
     *  about 20 minutes. */
    static NO_MONEY_TIMER = 'nextQuestMoneyAttempt';
    static NO_MONEY_BACKOFF_SECS = 1200;

    static getEnergy() {
        return Number(getHHVars('Hero.energies.quest.amount'));
    }

    static getEnergyMax() {
        return Number(getHHVars('Hero.energies.quest.max_regen_amount'));
    }

    /*
     * The end of the released quests (#1909).
     *
     * The game releases new main and side quests now and then. When the
     * released ones are done, each kind pauses on its own timer and checks
     * again after END_PAUSE_SECS. The pause used to be a week and shared by
     * both kinds: a player who had finished the side quests waited a week for
     * a main quest the game had released the day after, and only clearing the
     * temp storage brought the quests back.
     *
     * The end is read off the quest page itself, not off a quest id kept in
     * the code. The main quest is always opened as /quest/<id_quest>; a quest
     * that is finished shows the game's archive view (`#archive-back` /
     * `#archive-next`, built by quest.js buildArchiveNavigation) and no
     * `.next-button`. Every step quest.js getButtonDetails knows -- next,
     * use, fight, use item, claim reward, finish, outfit -- is rendered by
     * buildButtonHtml with that class. `current_url` is not trusted on its own: it comes from
     * the server only, and in #921 it named the world while a quest was open.
     */
    static END_PAUSE_SECS = 86400;
    static MAIN_TIMER = 'nextMainQuestAttempt';
    static SIDE_TIMER = 'nextSideQuestAttempt';

    static isMainQuestEnabled(): boolean {
        return getStoredValue(HHStoredVarPrefixKey+SK.autoQuest) === "true";
    }

    static isSideQuestEnabled(): boolean {
        return ConfigHelper.getHHScriptVars("isEnabledSideQuest",false) && getStoredValue(HHStoredVarPrefixKey+SK.autoSideQuest) === "true";
    }

    /** The game's own record of the main adventure, or null where the page carries none. */
    static readMainQuestState(): {id_quest: number, current_url: string} | null {
        const id_quest = Number(getHHVars('Hero.infos.questing.id_quest', false));
        const current_url = getHHVars('Hero.infos.questing.current_url', false);
        if (!id_quest || typeof current_url !== 'string') return null;
        return {id_quest, current_url};
    }

    /**
     * Whether the game has moved past the end that was seen. Only changes in
     * one direction count -- a higher quest id, or a world URL turned into a
     * quest URL -- so a value that differs between pages cannot end the pause
     * on every tick.
     */
    static hasNewMainQuest(seen: {id_quest: number, current_url: string}, now: {id_quest: number, current_url: string}): boolean {
        return now.id_quest > seen.id_quest
            || (seen.current_url.includes("world") && now.current_url.startsWith("/quest/"));
    }

    /** A pause longer than END_PAUSE_SECS comes from a build that paused for a week. */
    static dropWeekLongPause(timer: string) {
        if (getSecondsLeft(timer) > QuestHelper.END_PAUSE_SECS) {
            logHHAuto(`${timer} was set for a week by an older version, checking quests again now.`);
            clearTimer(timer);
        }
    }

    static isMainQuestDue(): boolean {
        if (!QuestHelper.isMainQuestEnabled()) return false;
        QuestHelper.dropWeekLongPause(QuestHelper.MAIN_TIMER);
        if (checkTimer(QuestHelper.MAIN_TIMER)) return true;
        const seen = getStoredJSON<{id_quest: number, current_url: string} | null>(HHStoredVarPrefixKey+TK.questEndSeen, null);
        const now = QuestHelper.readMainQuestState();
        if (seen && now && QuestHelper.hasNewMainQuest(seen, now)) {
            logHHAuto(`New main quest released (quest ${seen.id_quest} -> ${now.id_quest}, ${now.current_url}), ending the pause.`);
            clearTimer(QuestHelper.MAIN_TIMER);
            deleteStoredValue(HHStoredVarPrefixKey+TK.questEndSeen);
            return true;
        }
        return false;
    }

    static isSideQuestDue(): boolean {
        if (!QuestHelper.isSideQuestEnabled()) return false;
        QuestHelper.dropWeekLongPause(QuestHelper.SIDE_TIMER);
        return checkTimer(QuestHelper.SIDE_TIMER);
    }

    /** Main quests have reached the end of what is released. */
    static pauseMainQuests() {
        logHHAuto(`Main quest ${window.location.pathname} is finished and no next one is released, checking again in ${QuestHelper.END_PAUSE_SECS / 3600} h.`);
        setTimer(QuestHelper.MAIN_TIMER, QuestHelper.END_PAUSE_SECS);
        const now = QuestHelper.readMainQuestState();
        if (now) setStoredValue(HHStoredVarPrefixKey+TK.questEndSeen, JSON.stringify(now));
    }

    /** The game's view of a finished quest: archive arrows, no step button. */
    static isArchiveView(): boolean {
        return $('#controls #archive-back, #controls #archive-next').length > 0
            && $('#controls button.next-button').length === 0;
    }

    static getNextQuestLink():string|undefined {
        if (QuestHelper.isMainQuestDue()) return QuestHelper.getMainQuestUrl();
        if (QuestHelper.isSideQuestDue()) return QuestHelper.SITE_QUEST_PAGE;
        return undefined;
    }

    static getMainQuestUrl():string {
        return "/quest/" + getHHVars('Hero.infos.questing.id_quest');
    }
    static gotoNextQuestOrHome(): boolean {
        const nextQuestUrl = QuestHelper.getNextQuestLink();
        if (nextQuestUrl !== undefined) return gotoPage(nextQuestUrl);
        return gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
    }

    static run(): boolean {
        // Check if at correct page.
        const page = getPage();
        const mainQuestUrl = QuestHelper.getMainQuestUrl();
        const doMainQuest = QuestHelper.isMainQuestDue();
        if (!doMainQuest && page === 'side-quests' && QuestHelper.isSideQuestDue()) {
            var quests = $('.side-quest:has(.slot) .side-quest-button');
            let navOk: boolean;
            if (quests.length > 0) {
                logHHAuto("Navigating to side quest.");
                navOk = gotoPage(quests.attr('href')!);
            }
            else {
                logHHAuto(`All released side quests are done, checking again in ${QuestHelper.END_PAUSE_SECS / 3600} h.`);
                setTimer(QuestHelper.SIDE_TIMER, QuestHelper.END_PAUSE_SECS);
                // Navigate away from /side-quests.html instead of reloading the
                // same URL: the page id `side-quests` is not in the script's
                // pagesKnownList, so subsequent autoLoop iterations would keep
                // running handlers (e.g. handleChampionTicket) on the
                // unrecognized page and cause issue #1672's energy-burn loop.
                navOk = gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
            }
            return navOk;
        }
        if (page !== ConfigHelper.getHHScriptVars("pagesIDQuest") || (doMainQuest && mainQuestUrl.split("?")[0] != window.location.pathname)) {
            // Resolve the next quest URL here; the navigation service does
            // not know about the Quest module.
            return QuestHelper.gotoNextQuestOrHome();
        }
        $("#popup_message close").trigger('click');
        // The level-up popup carries no `close` element at all. Measured
        // 2026-09-09 on a live account: `#level_up.popup.hero_leveling`
        // contains exactly one control, `button.blue_button_L` ("Ok"), and
        // querying it for `close` returns nothing, hidden ones included. Like
        // the rewards popup below it overlays the quest UI, so the proceed
        // button underneath never advances while it is open -- a measured run
        // held it open for six ticks with the level and XP unchanged. The
        // `close` line stays: other popups in this game do use that element
        // (`#no_HC > close.closable`), and a skin that gives the level-up one
        // costs nothing here.
        $("#level_up close").trigger('click');
        // No `:visible` here: the popup is created when it is shown and gone
        // from the DOM otherwise (measured -- `#level_up` does not exist on
        // home.html), so its presence is the signal. `:visible` would also
        // make this untestable, since jsdom reports zero size for everything.
        $("#level_up button.blue_button_L:not([disabled])").first().trigger('click');
        // A rewards popup (e.g. a girl earned at the end of a quest) overlays
        // the quest UI; the proceed button underneath then never advances the
        // quest and the loop repeats forever. Claim/close it before looking
        // for a proceed button. Selectors mirror RewardHelper.closeRewardPopupIfAny
        // / closeGirlRewardPopupIfAny; importing RewardHelper here would add
        // new import cycles (RewardHelper -> EventModule -> ... -> Quest).
        const rewardConfirm = $('div#rewards_popup button.blue_button_L:not([disabled]):visible, div#rewards_popup button.purple_button_L:not([disabled]):visible');
        if (rewardConfirm.length > 0) {
            logHHAuto("Close reward popup blocking the quest.");
            rewardConfirm.first().trigger('click');
            return true;
        }
        // The game's "not enough money" popup (#not_enough_SC_popup, measured).
        // The pay check below reads the same balance the game does, so the
        // popup means that reading was wrong -- a stale hero snapshot can do
        // that. Close it, remember the step cost, wait NO_MONEY_BACKOFF_SECS and
        // let handleQuest's idle guard take the bot home. Must run before the
        // disabled-button check, which would otherwise wait on the greyed button.
        const noMoneyPopup = $('#not_enough_SC_popup');
        if (noMoneyPopup.length > 0) {
            const missing = parsePrice($('span[rel="money"]', noMoneyPopup).first().text());
            const stepCost = parsePrice($('#controls button#pay .action-cost .price').first().text());
            const needed = stepCost > 0 ? stepCost : HeroHelper.getMoney() + missing;
            logHHAuto(`Quest step refused for money: ${missing} missing, need ${needed}.`
                + ` Not trying again for ${QuestHelper.NO_MONEY_BACKOFF_SECS / 60} minutes.`);
            $('close.closable', noMoneyPopup).trigger('click');
            setStoredValue(HHStoredVarPrefixKey + TK.questRequirement, '$' + needed);
            setTimer(QuestHelper.NO_MONEY_TIMER, QuestHelper.NO_MONEY_BACKOFF_SECS);
            return false;
        }
        // `#skip-quest` is not a way forward. The game's own quest.js puts it
        // inside `#controls` beside the next button, adds it only while the
        // step reports `skippable`, and removes it again otherwise
        // (`!this.is_skippable && $("#skip-quest").remove()`). Its click
        // handler reads `this.skip_cost.hard_currency` and opens
        // `shared.general.hc_confirm(n, ...)` -- a koban price, behind a
        // confirmation.
        //
        // Two things follow for the selector below. `proceedButtonMatch.attr("id")`
        // takes the first match, and a world-1 run with this very selector
        // read `skip-quest` as the type; that falls into the unknown-button
        // branch, which switches autoQuest off and asks the player to continue
        // by hand. And `proceedButtonMatch.click()` at the end of this function
        // triggers every element of the set, so the skip button would be
        // pressed alongside the real one and leave its koban confirmation
        // sitting over the quest.
        // Before the button search: the archive arrows are buttons too, and
        // read as an unknown proceed button they switch auto quest off (#1773).
        if (QuestHelper.isArchiveView()) {
            if (doMainQuest && window.location.pathname === mainQuestUrl) {
                QuestHelper.pauseMainQuests();
            } else {
                logHHAuto("Quest page shows a finished quest, leaving it.");
            }
            return QuestHelper.gotoNextQuestOrHome();
        }
        const notSkip = ":not(#skip-quest)";
        const notAdOrHidden = ":not([class*='ad_']):not([style*='display:none']):not([style*='display: none'])";
        var proceedButtonMatch = $("#controls button" + notAdOrHidden + notSkip);
        if (proceedButtonMatch.length === 0)
        {
            // Choice button 
            logHHAuto("Search for choice buttons");
            proceedButtonMatch = $(".buttons-container button" + notAdOrHidden + notSkip).first();
        }
        if (proceedButtonMatch.length === 0)
        {
            proceedButtonMatch = $("#controls button#free");
        }
        var proceedType = proceedButtonMatch.attr("id");
        if (proceedButtonMatch.length === 0)
        {
            logHHAuto("Could not find resume button.");
            return true;
        }
        else if(proceedButtonMatch.attr('disabled') && proceedType != "end_play") {
            logHHAuto("Button is disabled for animation wait a bit.");
            return true;
        }
        
        if (proceedType === "free") {
            logHHAuto("Proceeding for free.");
        }
        else if (proceedType === "pay") {
            var proceedButtonCost = $(".action-cost .price", proceedButtonMatch);
            // .text(), not innerText: same read as the refusal check above, and
            // jsdom has no innerText.
            var proceedCost = parsePrice(proceedButtonCost.first().text());
            var payTypeNRJ = $(".action-cost .energy_quest_icn", proceedButtonMatch).length>0;
            var energyCurrent = QuestHelper.getEnergy();
            var moneyCurrent = HeroHelper.getMoney();
            if (payTypeNRJ)
            {
                if(proceedCost <= energyCurrent)
                {
                    // We have energy.
                    logHHAuto("Spending "+proceedCost+" Energy to proceed.");
                }
                else
                {
                    logHHAuto("Quest requires "+proceedCost+" Energy to proceed.");
                    setStoredValue(HHStoredVarPrefixKey+TK.questRequirement, "*"+proceedCost);
                    return true;
                }
            }
            else
            {
                console.log("DebugQuest MONEY for : "+proceedCost);
                if(proceedCost <= moneyCurrent)
                {
                    // We have money.
                    logHHAuto("Spending "+proceedCost+" Money to proceed.");
                }
                else
                {
                    logHHAuto("Need "+proceedCost+" Money to proceed.");
                    setStoredValue(HHStoredVarPrefixKey+TK.questRequirement, "$"+proceedCost);
                    return true;
                }
            }
        }
        else if (proceedType === "use_item") {
            logHHAuto("Proceeding by using X" + Number($("#controls .item span").text()) + " of the required item.");
        }
        else if (proceedType === "battle") {
            logHHAuto("Quest need battle...");
            setStoredValue(HHStoredVarPrefixKey+TK.questRequirement, "battle");
            // Proceed to battle troll.
        }
        else if (proceedType === "finish") {
            logHHAuto("Reached end of current side quest. Proceeding to next.");
        }
        else if (proceedType === "end_archive") {
            logHHAuto("Reached end of current archive. Proceeding to next archive.");
        }
        else if (proceedType === "end_play") {
            const rewards = $('#popups[style="display: block;"]>#rewards_popup[style="display: block;"] button.blue_button_L[confirm_blue_button]');
            if (proceedButtonMatch.attr('disabled') && rewards.length>0){
                logHHAuto("Reached end of current archive. Claim reward.");
                rewards.click();
                return true;
            }
            logHHAuto("Reached end of current play. Proceeding to next play.");
        }
        else if (proceedType === "outfit") {
            logHHAuto("Change outfit needed.");
            // TODO manage ?
            setStoredValue(HHStoredVarPrefixKey + TK.questRequirement, "outfit");
        }
        else {
            logHHAuto("Could not identify given resume button: " + proceedType + ", #controls buttons: "
                + $('#controls button').map((_i, b) => b.id || b.className).get().join(', '));
            setStoredValue(HHStoredVarPrefixKey+TK.questRequirement, "unknownQuestButton");
            return true;
        }
        setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
        logHHAuto("setting autoloop to false");
        setTimeout(function ()
                    {
            proceedButtonMatch.click();
            setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "true");
            logHHAuto("setting autoloop to true");
            kickAutoLoop(randomInterval(800,1200));
        },randomInterval(500,800));
        return true;
    }
}