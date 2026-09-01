// LivelyScene.ts -- Lively Scene event: scene progress and rewards.
//
// Lively Scene is a time-limited event where the player progresses through
// scenes to earn rewards. This module tracks scene progression, manages
// event energy, and collects available rewards automatically.
//
// Depends on: LivelyScene.pure.ts (piece selection), RewardHelper, EventRegistry.ts
// Used by: EventModule.ts (parse), AutoLoopPageHandlers.ts (run, on every
//          event-page load)
//
import { ConfigHelper } from "../../Helper/ConfigHelper";
import { getHHVars } from "../../Helper/HHHelper";
import { getTextForUI } from "../../Helper/LanguageHelper";
import { RewardHelper } from "../../Helper/RewardHelper";
import { getStoredValue, getStoredArray, setStoredValue } from "../../Helper/StorageHelper";
import { randomInterval, convertTimeToInt, getLimitTimeBeforeEnd, TimeHelper } from "../../Helper/TimeHelper";
import { setTimer, checkTimer } from "../../Helper/TimerHelper";
import { autoLoop } from "../../Service/AutoLoop";
import { gotoPage } from "../../Service/PageNavigationService";
import { logHHAuto } from "../../Utils/LogUtils";
import { isJSON } from "../../Utils/Utils";
import { HHStoredVarPrefixKey } from "../../config/HHStoredVars";
import { SK, TK } from "../../config/StorageKeys";
import { queryStringGetParam } from "../../Helper/UrlHelper";
import { HHEvent, HHEventData, HHEventList } from "../../model/HHEvent";
import { KKPuzzlePieces } from "../../model/KK/KKPuzzlePieces";
import { markEventStale } from "./EventRegistry";
import {
    PuzzlePieceLite,
    decideCollectTrigger,
    selectClaimablePieces,
} from "./LivelyScene.pure";

export class LivelyScene {

    /** One collect sweep at a time per page load, see goAndCollect. */
    static collecting = false;

    static isEnabled() {
        return ConfigHelper.getHHScriptVars("isEnabledLivelySceneEvent", false); // And 10 girls 3*
    }

    static parse(hhEvent: HHEvent, eventList: HHEventList, hhEventData: HHEventData) {
        const eventID = hhEvent.eventId;
        const remainingTime = LivelyScene.readRemainingTime();
        // An event that ends before its own next_refresh is never looked at
        // again: pruneExpiredEvents drops the entry as expired first. Keep the
        // next visit inside the event, so rewards that unlock in the last hour
        // are still reachable (#1857).
        const refreshTimer = Math.min(randomInterval(3600, 4000), Math.max(Math.floor(remainingTime / 2), 60));
        setTimer('eventLivelySceneGoing', remainingTime);

        eventList[eventID] = {};
        eventList[eventID]["id"] = eventID;
        eventList[eventID]["type"] = hhEvent.eventType;
        eventList[eventID]["seconds_before_end"] = new Date().getTime() + remainingTime * 1000;
        eventList[eventID]["next_refresh"] = new Date().getTime() + refreshTimer * 1000;
        eventList[eventID]["isCompleted"] = $(".puzzle_piece.locked:visible,.puzzle_piece.claimable").length == 0;

        const manualCollectAll = getStoredValue(HHStoredVarPrefixKey + TK.lseManualCollectAll) === 'true';

        const shouldTrigger = decideCollectTrigger({
            autoCollect: getStoredValue(HHStoredVarPrefixKey + SK.autoLivelySceneEventCollect) === "true",
            manualCollectAll,
            autoCollectAll: getStoredValue(HHStoredVarPrefixKey + SK.autoLivelySceneEventCollectAll) === "true",
            remainingTime,
            limitBeforeEnd: getLimitTimeBeforeEnd(),
        });
        if (shouldTrigger) {
            LivelyScene.goAndCollect(remainingTime, manualCollectAll);
        }

    }

    /**
     * Seconds left on the event, read from the page.
     *
     * 3600 when the timer is not on the page -- the value parse() has always
     * defaulted to. Note that this is fail-open for the end-of-event sweep
     * (3600 is below every collectAllTimer setting); it is kept as it was
     * because no measurement says the element can be missing here.
     */
    static readRemainingTime(): number {
        const timeLeft = $('#contains_all #events .nc-panel .timer span[rel="expires"]').text();
        if (timeLeft === undefined || !timeLeft.length) return 3600;
        return Number(convertTimeToInt(timeLeft));
    }

    /**
     * Pick the sweep up again on every event-page load.
     *
     * A claim ends in closeRewardPopupIfAny, which reloads the page, so one
     * loaded DOM yields at most one reward. Continuing therefore has to happen
     * after the reload -- and parse() cannot do it: it runs only when the
     * pipeline visits the event page (handleEventParsing) or when plusEvent is
     * on, because AutoLoopPageHandlers gates parseEventPage on that setting.
     * run() runs on every event-page load, which is where Path of Attraction
     * resumes its own sweep as well (#1816, #1857).
     */
    static async collectOnPageLoad() {
        const manualCollectAll = getStoredValue(HHStoredVarPrefixKey + TK.lseManualCollectAll) === 'true';
        const remainingTime = LivelyScene.readRemainingTime();
        const shouldTrigger = decideCollectTrigger({
            autoCollect: getStoredValue(HHStoredVarPrefixKey + SK.autoLivelySceneEventCollect) === "true",
            manualCollectAll,
            autoCollectAll: getStoredValue(HHStoredVarPrefixKey + SK.autoLivelySceneEventCollectAll) === "true",
            remainingTime,
            limitBeforeEnd: getLimitTimeBeforeEnd(),
        });
        if (shouldTrigger) {
            await LivelyScene.goAndCollect(remainingTime, manualCollectAll);
        }
    }

    static parseClaimableRewards(remainingTime: number, manualCollectAll = false) {
        const puzzlePieces: KKPuzzlePieces[] = getHHVars('current_event.event_data.puzzle_pieces');
        const rewardsToCollect = getStoredArray<string>(HHStoredVarPrefixKey + SK.autoLivelySceneEventCollectablesList);
        const needToCollectAll = remainingTime < getLimitTimeBeforeEnd() && getStoredValue(HHStoredVarPrefixKey + SK.autoLivelySceneEventCollectAll) === "true";
        const needToCollect = (checkTimer('nextLivelySceneEventCollectTime') && getStoredValue(HHStoredVarPrefixKey + SK.autoLivelySceneEventCollect) === "true");

        const projected: (PuzzlePieceLite & { __orig: KKPuzzlePieces })[] = puzzlePieces.map((piece) => ({
            reward_unlocked: piece.reward_unlocked,
            reward_claimed: piece.reward_claimed,
            rewardType: piece?.reward?.shards ? 'girl_shards' : piece?.reward?.rewards[0].type,
            __orig: piece,
        }));

        const claimablePieces = selectClaimablePieces(projected, {
            rewardsToCollect,
            needToCollect,
            needToCollectAll,
            manualCollectAll,
        }).map((p) => p.__orig);

        logHHAuto('claimablePieces', claimablePieces);
        return claimablePieces;
    }

    static async goAndCollect(remainingTime: number, manualCollectAll = false)
    {
        // parse() and run() can both fire on the same page load -- the
        // pipeline parses the event page the page handler has just drawn --
        // and two sweeps would click the same puzzle pieces. The flag lives
        // for one page load; the reload after a claim clears it.
        if (LivelyScene.collecting) {
            logHHAuto("LivelyScene collect already running on this page.");
            return false;
        }
        LivelyScene.collecting = true;
        let claimed = false;
        try {
            const rewards = LivelyScene.parseClaimableRewards(remainingTime, manualCollectAll);
            if (manualCollectAll) setStoredValue(HHStoredVarPrefixKey + TK.lseManualCollectAll, 'true');

            if (rewards.length > 0) {
                logHHAuto("Going to collect rewards.");
                logHHAuto("setting autoloop to false");
                setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");

                for (let currentReward = 0; currentReward < rewards.length; currentReward++) {
                    const reward = rewards[currentReward];
                    const puzzlePiece = $(`#puzzle_template #puzzle_piece_${reward.id_piece}.claimable`);

                    if (puzzlePiece.length > 0) {
                        puzzlePiece.trigger('click');
                        await TimeHelper.sleep(randomInterval(200, 400));

                        const currentCollectButton = $('.lse_side_panel button.purple_button_L.claimable');
                        if (currentCollectButton.length > 0) {
                            currentCollectButton.trigger('click');
                            await TimeHelper.sleep(randomInterval(400, 700));
                            // Closing the popup reloads the page, so this DOM
                            // yields no second claim. parse() has just booked
                            // the event for an hour from now, which is what
                            // kept the pipeline from coming back to finish the
                            // sweep (#1857). Only on a claim that happened, so
                            // the extra visits stay bounded by the number of
                            // pieces and cannot become a reload loop (#1738).
                            markEventStale(queryStringGetParam(window.location.search, 'tab') || '');
                            claimed = true;
                            RewardHelper.closeRewardPopupIfAny() // refresh;
                            await TimeHelper.sleep(randomInterval(400, 700));
                            return true;
                        }
                    }

                }
            }
            else {
                logHHAuto("No (more) LivelyScene reward to collect .");
                setTimer('nextLivelySceneEventCollectTime', ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60, 180));
                setStoredValue(HHStoredVarPrefixKey + TK.lseManualCollectAll, 'false');
                return false;
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logHHAuto(`ERROR during collect LivelyScene rewards: ${message}`);
            setStoredValue(HHStoredVarPrefixKey + TK.lseManualCollectAll, 'false');
        } finally {
            // After a claim the flag stays set: this DOM is spent, and the
            // reload that the popup close starts clears it.
            if (!claimed) LivelyScene.collecting = false;
        }
        return false;
    }

    static _makeSVG(tag: string, attrs: any) {
        var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (var k in attrs)
            el.setAttribute(k, attrs[k]);
        return el;
    }
    static _makeSVGImage($puzzlePiece: any, iconHref: any) {
        const tresorImage = $('image', $puzzlePiece);
        return LivelyScene._makeSVG('image', {
            height: 18,
            width: 18,
            visibility: 'visible',
            href: iconHref,
            x: Number(tresorImage.attr('x')) + 45,
            y: tresorImage.attr('y')
        });
    }

    static async run(){
        LivelyScene.displayCollectAllButton();

        if (getStoredValue(HHStoredVarPrefixKey + SK.showRewardsRecap) === "true") {
            const puzzlePieces: KKPuzzlePieces[] = getHHVars('current_event.event_data.puzzle_pieces');
            if (puzzlePieces.length > 0) {

                for (let currentReward = 0; currentReward < puzzlePieces.length; currentReward++) {
                    const puzzlePiece = puzzlePieces[currentReward];
                    if (puzzlePiece.reward_unlocked && !puzzlePiece.reward_claimed) {
                        const rewardType = puzzlePiece?.reward?.shards ? 'girl_shards' : puzzlePiece?.reward?.rewards[0].type;

                        const $puzzlePiece = $(`#puzzle_template #puzzle_piece_${puzzlePiece.id_piece}.claimable`);
                        const iconHref = RewardHelper.getRewardsIconHref(rewardType);

                        if ($puzzlePiece.length > 0 && iconHref) {
                            const image = LivelyScene._makeSVGImage($puzzlePiece, iconHref);
                            document.getElementById(`puzzle_piece_${puzzlePiece.id_piece}`)!.appendChild(image);
                            
                            logHHAuto(`Add icon for ${rewardType} to #puzzle_piece_${puzzlePiece.id_piece}`);
                        }
                    }
                }
            }
        }

        await LivelyScene.collectOnPageLoad();
    }

    static hasUnclaimedRewards(): boolean {
        return $(".puzzle_piece.claimable:visible").length > 0
    }

    static displayCollectAllButton() {
        if (LivelyScene.hasUnclaimedRewards() && $('#LivelySceneCollectAll').length == 0) {

            const button = $(`<button class="purple_button_L" style="padding:0px 5px" id="LivelySceneCollectAll">${getTextForUI("collectAllButton", "elementText")}</button>`);
            const divTooltip = $(`<div class="tooltipHH" style="position: absolute;top: 0px;right: 45px;font-size: small; z-index:5"><span class="tooltipHHtext">${getTextForUI("collectAllButton", "tooltip")}</span></div>`);
            divTooltip.append(button);
            $('#lse_content').append(divTooltip);
            button.one('click', () => {
                LivelyScene.goAndCollect(Infinity,true);
            });
        }
    }
}
