// SultryMysteries.ts -- Sultry Mysteries event: shop refresh and grid automation.
//
// Sultry Mysteries is a time-limited event featuring a special event shop
// and a 6x5 grid of 30 squares. Each square hides a reward and costs one
// key to open; once at least 15 squares are open the grid can be
// regenerated. This module monitors the event shop for refresh timers and
// automates opening grid squares ("Auto-Mystery").
//
// Depends on: SultryMysteries.pure.ts (shop logic), PageNavigationService
// Used by: EventModule.ts (called when Sultry Mysteries event is active)
//
import { ConfigHelper } from "../../Helper/ConfigHelper";
import { getHHVars } from "../../Helper/HHHelper";
import { HeroHelper } from "../../Helper/HeroHelper";
import { getPage } from "../../Helper/PageHelper";
import { getStoredArray, getStoredValue } from "../../Helper/StorageHelper";
import { convertTimeToInt, randomInterval } from "../../Helper/TimeHelper";
import { checkTimer, setTimer } from "../../Helper/TimerHelper";
import { gotoPage, safeReload } from "../../Service/PageNavigationService";
import { logHHAuto } from "../../Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../../config/HHStoredVars";
import { SK } from "../../config/StorageKeys";
import { HHEvent, HHEventData, HHEventList } from "../../model/HHEvent";
import {
    SmGridSquare,
    SmRewardsList,
    resolveSultryMysteriesSecondsLeft,
    smNextAction,
    smOpenedCount,
    smSelectedTypesProgress,
} from "./SultryMysteries.pure";

// How long to wait before looking for keys again once the grid ran dry.
// Keys are not granted passively -- they drop from the last Daily Goals
// chest and from villains -- so there is no point in checking more often,
// and the script should not sprint off the moment a single key appears.
const SM_NO_KEYS_RETRY_SECONDS = 3600;

export class SultryMysteries {
    /**
     * True while a grid run is clicking its way through the board. Guards
     * against the pipeline starting a second, parallel run on the same page
     * load (see autoOpenGrid). Reset by every page load.
     */
    static autoOpenRunning = false;

    static isEnabled(){
        return HeroHelper.getLevel()>=ConfigHelper.getHHScriptVars("LEVEL_MIN_EVENT_SM");
    }

    static isAutoOpenEnabled(): boolean {
        return getStoredValue(HHStoredVarPrefixKey + SK.sultryMysteriesAutoOpen) === "true" && SultryMysteries.isEnabled();
    }

    static parse(hhEvent: HHEvent, eventList: HHEventList, hhEventData: HHEventData) {
        const eventID = hhEvent.eventId;
        const refreshTimer = randomInterval(3600, 4000);

        // Grid tab (shown by default on /event.html) doesn't render this
        // timer -- it only appears after switching to the shop tab -- so
        // sm_event_data.seconds_until_event_end (available on either tab)
        // is tried first; the DOM reading is a fallback for when that
        // global isn't there.
        const timeLeft = $('#contains_all #events .nc-panel .timer span[rel="expires"]').text();
        const domSecondsLeft = timeLeft !== undefined && timeLeft.length ? Number(convertTimeToInt(timeLeft)) : null;
        const hhVarSecondsLeft = getHHVars('sm_event_data.seconds_until_event_end', false);
        const secondsLeft = resolveSultryMysteriesSecondsLeft(hhVarSecondsLeft, domSecondsLeft, 3600);

        setTimer('eventSultryMysteryGoing', secondsLeft);

        eventList[eventID] = {};
        eventList[eventID]["id"] = eventID;
        eventList[eventID]["type"] = hhEvent.eventType;
        eventList[eventID]["seconds_before_end"] = new Date().getTime() + secondsLeft * 1000;
        eventList[eventID]["next_refresh"] = new Date().getTime() + refreshTimer * 1000;
        eventList[eventID]["isCompleted"] = false;

        // The grid automation is a pipeline block of its own
        // (handleSultryMysteries) and is deliberately NOT started from here:
        // parse runs on every tick that re-parses the event page, which used
        // to spawn one click chain per tick.
        if (getStoredValue(HHStoredVarPrefixKey + SK.sultryMysteriesEventRefreshShop) === "true" && checkTimer("eventSultryMysteryShopRefresh")) {
            logHHAuto("Refresh sultry mysteries shop content.");

            const shopButton = $('#shop_tab');
            const gridButton = $('#grid_tab');
            shopButton.trigger('click');

            setTimeout(function () { // Wait tab switch and timer init
                const shopTimeLeft = $('#contains_all #events #shop_tab_container .shop-section .shop-timer span[rel="expires"]').text();
                setTimer('eventSultryMysteryShopRefresh', Number(convertTimeToInt(shopTimeLeft)) + randomInterval(60, 180));
                eventList[eventID]["next_shop_refresh"] = new Date().getTime() + Number(shopTimeLeft) * 1000;

                setTimeout(function () { gridButton.trigger('click'); }, randomInterval(800, 1200));
            }, randomInterval(300, 500));
        }
    }

    // -----------------------------------------------------------------
    // Auto-Mystery
    // -----------------------------------------------------------------

    /**
     * Keys currently in hand.
     *
     * sm_event_data.event_data.progression.key_amount goes stale as soon as
     * a square is opened -- the game keeps the running count in a module
     * closure and only writes it to the sidebar -- so the sidebar is the
     * authoritative reading, with the global as a fallback for the very
     * first pass.
     */
    static getKeyAmount(): number {
        const sidebarText = $('#contains_all #events .get-more-keys-section > p').text();
        const fromSidebar = Number((sidebarText || '').trim());
        if (Number.isFinite(fromSidebar) && sidebarText.trim() !== '') return fromSidebar;
        const fromVars = Number(getHHVars('sm_event_data.event_data.progression.key_amount', false));
        return Number.isFinite(fromVars) ? fromVars : 0;
    }

    static getGrid(): SmGridSquare[] {
        const grid = getHHVars('sm_event_data.event_data.progression.grid', false);
        return Array.isArray(grid) ? grid : [];
    }

    static getRewardsList(): SmRewardsList {
        const rewards = getHHVars('sm_event_data.event_data.rewards_list', false);
        return rewards && typeof rewards === 'object' ? rewards : {};
    }

    static getSquaresRequiredForRefresh(): number {
        const required = Number(getHHVars('sm_event_data.event_data.grid_refresh_squares_required', false));
        return Number.isFinite(required) && required > 0 ? required : 15;
    }

    static getSelectedRewardTypes(): string[] {
        return getStoredArray<string>(HHStoredVarPrefixKey + SK.sultryMysteriesAutoOpenCollectablesList);
    }

    /**
     * Close the reward popup the game shows after each opened square.
     *
     * Deliberately not RewardHelper.closeRewardPopupIfAny: RewardHelper
     * imports EventModule, which imports this module, so using it here
     * would add an import cycle (ARCH-001).
     */
    static closeSquareRewardPopup(): boolean {
        const rewardQuery = 'div#rewards_popup button.blue_button_L:not([disabled]):visible';
        if ($(rewardQuery).length > 0) {
            logHHAuto("Sultry Mysteries: closing square reward popup.");
            $(rewardQuery).trigger('click');
            return true;
        }
        return false;
    }

    /** Park the automation until keys can plausibly have been earned again. */
    static scheduleKeyCheck(reason: string) {
        const retryIn = SM_NO_KEYS_RETRY_SECONDS + randomInterval(60, 300);
        logHHAuto(`Sultry Mysteries auto-open paused (${reason}), checking for keys again later.`);
        setTimer('eventSultryMysteryAutoOpen', retryIn);
    }

    static logProgress(grid: SmGridSquare[], rewardsList: SmRewardsList, selectedTypes: string[]) {
        const opened = smOpenedCount(grid);
        const required = SultryMysteries.getSquaresRequiredForRefresh();
        const progress = smSelectedTypesProgress(rewardsList, grid, selectedTypes)
            .map((entry) => `${entry.type} ${entry.found}/${entry.total}`)
            .join(', ');
        logHHAuto(`Sultry Mysteries grid: ${opened}/${required} squares opened, keys: ${SultryMysteries.getKeyAmount()}${progress ? `, goal: ${progress}` : ', no reward goal set'}.`);
    }

    /**
     * Work the grid: open squares in checkerboard order while keys last,
     * and regenerate the grid once it is allowed and the selected rewards
     * have all been found. Returns true while it is busy.
     *
     * Keys won from the grid itself are spent right away -- the key count
     * is re-read from the sidebar before every click, so a `progressions`
     * square simply extends the current run.
     */
    static autoOpenGrid(eventID: string): boolean {
        // parseEventPage is re-entered on every pipeline tick for as long as
        // the auto-open timer sits expired. Without this guard every entry
        // starts its own click chain: squares open in parallel with requests
        // still in flight, "Generate new grid" fires repeatedly, and the retry
        // timer is written several times. One run at a time.
        if (SultryMysteries.autoOpenRunning) return true;

        if (getPage() !== ConfigHelper.getHHScriptVars("pagesIDEvent")) {
            logHHAuto("Switching to Sultry Mysteries screen.");
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDEvent"), { tab: eventID });
            return true;
        }

        if ($('#contains_all #events .grid-slots').length <= 0) {
            // Shop tab is showing (or the page is still building the grid).
            if ($('#grid_tab').length > 0) {
                logHHAuto("Switching to Sultry Mysteries grid tab.");
                $('#grid_tab').trigger('click');
                return true;
            }
            SultryMysteries.scheduleKeyCheck("grid not available");
            return false;
        }

        const rewardsList = SultryMysteries.getRewardsList();
        const selectedTypes = SultryMysteries.getSelectedRewardTypes();
        SultryMysteries.logProgress(SultryMysteries.getGrid(), rewardsList, selectedTypes);
        SultryMysteries.autoOpenRunning = true;

        // End the run and hand the page back. Not called on the regenerate
        // path: there the reload discards the flag along with the page.
        function stopRun(reason: string) {
            SultryMysteries.autoOpenRunning = false;
            SultryMysteries.scheduleKeyCheck(reason);
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
        }

        function step() {
            const grid = SultryMysteries.getGrid();
            const action = smNextAction({
                grid,
                rewardsList,
                selectedTypes,
                keys: SultryMysteries.getKeyAmount(),
                squaresRequiredForRefresh: SultryMysteries.getSquaresRequiredForRefresh(),
            });

            if (action.kind === 'wait') {
                stopRun(action.reason === 'no_keys' ? 'out of keys' : 'grid fully opened');
                return;
            }

            if (action.kind === 'regenerate') {
                logHHAuto("Sultry Mysteries: generating a new grid.");
                $('#contains_all #events .generate-new-grid').trigger('click');

                // The game rebuilds the grid from the ajax response into a
                // module-local variable and leaves
                // sm_event_data.event_data.progression.grid pointing at the
                // old board, so the only way to keep reading a truthful
                // state is to reload the page. Confirm the board actually
                // reset first: reloading on a click that did nothing would
                // land on the same state and ask for a new grid again.
                let regenAttempts = 0;
                function afterRegenerate() {
                    if ($('#contains_all #events .grid-slots .grid-slot.unlocked').length <= 0) {
                        safeReload();
                        return;
                    }
                    if (regenAttempts < 10) {
                        regenAttempts++;
                        setTimeout(afterRegenerate, randomInterval(300, 500));
                        return;
                    }
                    logHHAuto("Sultry Mysteries: the grid was not regenerated, stopping.");
                    stopRun("grid not regenerated");
                }
                setTimeout(afterRegenerate, randomInterval(800, 1200));
                return;
            }

            const idSquare = action.idSquare;
            const squareQuery = `#contains_all #events .grid-slots .grid-slot.locked[id_square="${idSquare}"]`;
            if ($(squareQuery).length <= 0) {
                logHHAuto(`Sultry Mysteries: square ${idSquare} is no longer clickable, stopping.`);
                stopRun("square not clickable");
                return;
            }

            logHHAuto(`Sultry Mysteries: opening square ${idSquare}.`);
            $(squareQuery).trigger('click');

            // Wait for the game to swap the square to "unlocked" before the
            // next click; the open request is in flight until then and the
            // delegated handler would happily fire twice.
            let attempts = 0;
            function afterOpen() {
                const stillLocked = $(squareQuery).length > 0;
                if (stillLocked && attempts < 20) {
                    attempts++;
                    setTimeout(afterOpen, randomInterval(300, 500));
                    return;
                }
                if (stillLocked) {
                    logHHAuto(`Sultry Mysteries: square ${idSquare} did not open, stopping.`);
                    stopRun("square did not open");
                    return;
                }
                SultryMysteries.closeSquareRewardPopup();
                setTimeout(step, randomInterval(600, 1000));
            }
            setTimeout(afterOpen, randomInterval(500, 800));
        }

        step();
        return true;
    }
}
