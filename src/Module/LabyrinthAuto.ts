// LabyrinthAuto.ts -- Auto-battle logic for the labyrinth dungeon.
//
// Handles the automated fighting within labyrinth floors: selects difficulty
// levels, initiates fights against enemies, processes battle results, and
// manages relic selection after completing rooms. Works in tandem with
// Labyrinth.ts which handles the higher-level floor navigation.
//
// After LABY_DRAW_LIMIT fights in a row that change nothing (a draw), the
// labyrinth pauses for LABY_DRAW_PAUSE_SECONDS and releases the pipeline;
// the reasoning is in Labyrinth.pure.ts (#1904).
//
// Depends on: RelicManager.ts (relic selection after fights), Labyrinth.pure.ts (draw counting)
// Used by: Pipeline.config.ts (the labyrinth block)
//
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK, TK } from "../config/StorageKeys";
import { ConfigHelper } from "../Helper/ConfigHelper";
import { RewardHelper } from "../Helper/RewardHelper";
import { deleteStoredValue, getStoredJSON, getStoredValue, setStoredValue } from "../Helper/StorageHelper";
import { randomInterval, TimeHelper } from "../Helper/TimeHelper";
import { setTimer } from "../Helper/TimerHelper";
import { queryStringGetParam } from "../Helper/UrlHelper";
import { getPage } from "../Helper/PageHelper";
import { gotoPage, safeReload } from "../Service/PageNavigationService";
import {
    logHHAuto
} from "../Utils/LogUtils";
import { Labyrinth } from "./Labyrinth";
import { LABY_DIFFICULTY } from "./LabyrinthDifficulty";
import {
    countDraws,
    EMPTY_LABY_DRAW_STATE,
    LABY_DRAW_LIMIT,
    LABY_DRAW_PAUSE_SECONDS,
    LabyFightSnapshot,
} from "./Labyrinth.pure";
import { RelicManager } from "./RelicManager";

export class LabyrinthAuto {
    static EASY: string = LABY_DIFFICULTY.EASY;
    static NORMAL: string = LABY_DIFFICULTY.NORMAL;
    static HARD: string = LABY_DIFFICULTY.HARD;
    static LABYRINTH_SELECTOR: string[] = ['easy', 'normal', 'hard'];
    debugEnabled: boolean;

    constructor() {
        this.debugEnabled = getStoredValue(HHStoredVarPrefixKey + TK.Debug) === 'true';
    }

    async run(depth: number = 0): Promise<boolean> {
        // run() recurses (reward-popup loops, edit-team retry). A degenerate
        // DOM (popup never closes / team never reaches 7) could recurse
        // without bound. Cap the depth so a pathological tick backs off
        // instead of overflowing the stack.
        if (depth > 10) {
            logHHAuto('Labyrinth: max recursion depth reached this tick, backing off.');
            setTimer('nextLabyrinthTime', randomInterval(60, 120));
            return false;
        }
        const page = getPage();
        if (page === ConfigHelper.getHHScriptVars("pagesIDLabyrinthEntrance")) {
            const difficultyButton = $('.difficulty-button:not([disabled])');
            if (difficultyButton.length === 1) {
                logHHAuto(`On Labyrinth entrance page, only one difficulty available, ${difficultyButton.text().trim()}, select it.`);
                difficultyButton.trigger('click');
                await TimeHelper.sleep(randomInterval(200, 400));
                $('#labyrinth_confirm_difficulty button.blue_button_L').trigger('click');
                await TimeHelper.sleep(randomInterval(2000, 4000));
                return true;
            } else {
                const chooseDifficulty = getStoredValue(HHStoredVarPrefixKey + SK.autoLabyDifficultyIndex) || LabyrinthAuto.EASY;
                const difficultyToSelect = LabyrinthAuto.LABYRINTH_SELECTOR[parseInt(chooseDifficulty)];
                const buttonToSelect = $(`.difficulty-button.difficulty-${difficultyToSelect}:not([disabled])`);

                if (buttonToSelect.length === 1) {
                    logHHAuto(`On Labyrinth entrance page, selecting ${difficultyToSelect} difficulty.`);
                    buttonToSelect.trigger('click');
                    await TimeHelper.sleep(randomInterval(200, 400));
                    $('#labyrinth_confirm_difficulty button.blue_button_L').trigger('click');
                    await TimeHelper.sleep(randomInterval(2000, 4000));
                    return true;
                } else {
                    logHHAuto(`On Labyrinth entrance page, ${difficultyToSelect} difficulty not available, manual selection needed.`);
                }
            }

            setTimer('nextLabyrinthTime', randomInterval(600, 700));
            return false;
        }
        else if (page === ConfigHelper.getHHScriptVars("pagesIDLabyrinthPoolSelect")) {
            logHHAuto("On Labyrinthpool select.");
            $('button.blue_button_L[rel="labyrinth_auto_assign"]').trigger('click');
            await TimeHelper.sleep(randomInterval(200, 400));
            $('button.blue_button_L[rel="labyrinth_team_confirmation"]').trigger('click');
            return true;
        }
        else if (page === ConfigHelper.getHHScriptVars("pagesIDLabyrinth")) {
            logHHAuto("On Labyrinth page.");
            // Back on the labyrinth: the team editor let us through.
            deleteStoredValue(HHStoredVarPrefixKey + TK.labyrinthEditorStuck);
            await TimeHelper.sleep(randomInterval(500, 800));
            if (this.closeRewards()) {
                if (this.debugEnabled) logHHAuto('Some rewards popup closed');
            }

            if ($('.cleared-labyrinth-container:visible').length > 0) {
                logHHAuto("Labyrinth ended.");
                setTimer('nextLabyrinthTime', Labyrinth.getResetTime() + randomInterval(7200, 8000));
                return false;
            }

            if ($('#labyrinth_reward_popup .relic-container').length > 0) {
                /* Reward to be selected */
                const relicManager = new RelicManager();
                await relicManager.selectRelic();
            }
            await TimeHelper.sleep(randomInterval(500, 800));
            if ($('.labChosen').length <= 0) {
                Labyrinth.sim();
                await TimeHelper.sleep(randomInterval(200, 400));
                if ($('.labChosen').length <= 0) {
                    logHHAuto("Issue to find labyrinth next step button, retry in 60secs.");
                    setTimer('nextLabyrinthTime', randomInterval(60, 70));
                    return true;
                }
            }

            const autoLabySweep = getStoredValue(HHStoredVarPrefixKey + SK.autoLabySweep) === "true";
            const sweepFloorButton = $('#sweeping-floor:not([disabled])');
            const sweeping = autoLabySweep && sweepFloorButton.length > 0;
            if (!sweeping && LabyrinthAuto.pauseAfterRepeatedDraws()) return false;

            setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
            if (this.debugEnabled) logHHAuto("setting autoloop to false");

            if (sweeping) {
                logHHAuto("Auto laby sweep enabled, triggering sweep.");
                sweepFloorButton.trigger('click');
                await TimeHelper.sleep(randomInterval(1000, 1500));
                if (this.debugEnabled) logHHAuto("Confirm sweep.");
                $("#labyrinth_sweeping_preview_popup #popup_confirm.blue_button_L").trigger('click');
                await TimeHelper.sleep(randomInterval(1500, 2000));
                // Close reward popup or wait until it opens
                for (let i = 0; i < 3; i++) {
                    if (this.debugEnabled) logHHAuto("Close seep reward popup.");
                    const popupOpened = this.closeRewards();
                    await TimeHelper.sleep(randomInterval(800, 1300));
                    if (popupOpened) return this.run(depth + 1);
                }
            }else {
                $('.labChosen').trigger('click');
                await TimeHelper.sleep(randomInterval(500, 800));
                // Close reward popup or wait until it opens
                for (let i = 0; i < 3; i++) {
                    const popupOpened = this.closeRewards();
                    await TimeHelper.sleep(randomInterval(800, 1300));
                    if (popupOpened) return this.run(depth + 1);
                }
            }
            return true;
        }
        else if (page === ConfigHelper.getHHScriptVars("pagesIDLabyrinthPreBattle")) {
            logHHAuto("On labyrinth-pre-battle page.");
            if (this.getNumberSelectedGirl() === 7) {
                const templeID = queryStringGetParam(window.location.search, 'id_opponent');
                logHHAuto("Go and fight labyrinth :" + templeID);
                const labyrinthBattleButton = $("#pre-battle .buttons-container .blue_button_L");
                if (labyrinthBattleButton.length > 0) {
                    setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
                    logHHAuto("setting autoloop to false");
                    LabyrinthAuto.markFightLaunched();
                    labyrinthBattleButton[0].click();
                }
                else {
                    logHHAuto("Issue to find labyrinth battle button retry in 60secs.");
                    setTimer('nextLabyrinthTime', randomInterval(60, 70));
                }
            } else if (this.getNumberSelectedGirl() < 7) {
                logHHAuto("Not enough girls, Edit team.");
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDEditLabyrinthTeam"));
            } else {
                logHHAuto("Error in parsing, disable laby.");
                setStoredValue(HHStoredVarPrefixKey + SK.autoLabyrinth, "false");
            }
            return true;
        }
        else if (page === ConfigHelper.getHHScriptVars("pagesIDEditLabyrinthTeam")) {
            logHHAuto("Fill team.");
            const numberOfGirlsRemaining = Labyrinth.getRemainingNumberOfGirl();
            logHHAuto(`Number of girls remaining: ${numberOfGirlsRemaining}`);
            if (numberOfGirlsRemaining >= 7) {
                const customTeamBuilder = getStoredValue(HHStoredVarPrefixKey + SK.autoLabyCustomTeamBuilder) === "true";
                if (customTeamBuilder) {
                    Labyrinth.moduleBuildTeam();
                    await TimeHelper.sleep(randomInterval(200, 400));

                    await Labyrinth._buildTeam();
                    await TimeHelper.sleep(randomInterval(200, 400));
                } else {
                    $('#clear-team:enabled').trigger('click');
                    await TimeHelper.sleep(randomInterval(200, 400));
                    $('#auto-fill-team:enabled').trigger('click');
                    await TimeHelper.sleep(randomInterval(400, 800));
                }

                if (this.getNumberSelectedGirl() === 7) {
                    return LabyrinthAuto.validateTeam();
                } else {
                    if (this.debugEnabled) logHHAuto('Not enough girl selected, retry...');
                    return this.run(depth + 1);
                }
            } else {
                logHHAuto('Not enough girl to continue. Stopping');
                setTimer('nextLabyrinthTime', randomInterval(5 * 60 * 60, 7 * 60 * 60));
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                return true;
            }
        }
        else {
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDLabyrinth"));
            return true;
        }
    }

    // ------------------------------------------------- team editor (Validate)
    //
    // The game ships #validate-team disabled, enables it once the team holds
    // MIN_TEAM_SIZE girls (1 in the labyrinth editor, measured), and disables
    // it again on the click while it saves the team (action=edit_team). Only
    // a successful save navigates on; a failed one leaves the button disabled
    // for good (edit_team.js). The script clicked `#validate-team:enabled`
    // and returned, so a disabled button meant clicking nothing every tick:
    // measured on a user log, 114 rounds in four minutes until the player
    // left the page by hand. Now a button that stays disabled for
    // VALIDATE_GRACE_MS reloads the editor once and, if that does not help,
    // pauses the labyrinth for EDITOR_STUCK_PAUSE_SECONDS. The game's answer
    // to a failed save is logged, so the cause can be read from the log.

    /** How long Validate may stay disabled -- a save and its navigation take a few seconds. */
    static VALIDATE_GRACE_MS = 15_000;
    /** A reload this recent counts as tried already. */
    static EDITOR_RELOAD_WINDOW_MS = 10 * 60 * 1000;
    static EDITOR_STUCK_PAUSE_SECONDS = 30 * 60;

    /** Since when Validate is seen disabled on this page; reset by every page load. */
    private static validateBlockedSince = 0;
    private static saveWatchInstalled = false;
    private static lastTeamSaveAnswer = "none";

    /** Log the game's answer when it refuses to save the team. */
    private static watchTeamSave(): void {
        if (LabyrinthAuto.saveWatchInstalled) return;
        LabyrinthAuto.saveWatchInstalled = true;
        $(document).on('ajaxComplete', (_event: unknown, xhr: JQuery.jqXHR, settings: JQuery.AjaxSettings) => {
            if (String(settings?.data ?? '').indexOf('action=edit_team') < 0) return;
            const body = xhr?.responseJSON ?? xhr?.responseText;
            const ok = xhr?.status === 200 && (body as { success?: unknown })?.success !== false;
            LabyrinthAuto.lastTeamSaveAnswer = `HTTP ${xhr?.status} ${JSON.stringify(body ?? null).slice(0, 200)}`;
            if (!ok) logHHAuto(`Labyrinth team save refused: ${LabyrinthAuto.lastTeamSaveAnswer}`);
        });
    }

    /** "pos:id" for every team slot, for the log. */
    private static describeSlots(): string {
        return $('.player-panel .team-hexagon .team-member-container').map((_i, el) =>
            `${$(el).attr('data-team-member-position')}:${$(el).attr('data-girl-id') ?? '-'}`).get().join(',');
    }

    /**
     * Press Validate on a full team, or get out of an editor whose Validate
     * stays disabled. True keeps the labyrinth block, false releases it.
     */
    static validateTeam(): boolean {
        LabyrinthAuto.watchTeamSave();
        const validate = $('#validate-team');
        if (validate.length > 0 && !validate.prop('disabled')) {
            LabyrinthAuto.validateBlockedSince = 0;
            validate.trigger('click');
            return true;
        }
        const now = Date.now();
        if (LabyrinthAuto.validateBlockedSince === 0) LabyrinthAuto.validateBlockedSince = now;
        if (now - LabyrinthAuto.validateBlockedSince < LabyrinthAuto.VALIDATE_GRACE_MS) return true;

        const state = getStoredJSON<{ reloadedAt?: number } | null>(HHStoredVarPrefixKey + TK.labyrinthEditorStuck, null);
        const detail = `slots ${LabyrinthAuto.describeSlots()}, button ${validate.length > 0 ? 'disabled' : 'missing'},`
            + ` last save answer ${LabyrinthAuto.lastTeamSaveAnswer}`;
        const reloadedAt = state?.reloadedAt ?? 0;
        if (now - reloadedAt > LabyrinthAuto.EDITOR_RELOAD_WINDOW_MS) {
            logHHAuto(`Labyrinth team editor: Validate stays disabled on a full team (${detail}). Reloading the editor once.`);
            setStoredValue(HHStoredVarPrefixKey + TK.labyrinthEditorStuck, JSON.stringify({ reloadedAt: now }));
            safeReload();
            return true;
        }
        logHHAuto(`Labyrinth team editor: Validate still disabled after a reload (${detail}).`
            + ` Pausing the labyrinth for ${LabyrinthAuto.EDITOR_STUCK_PAUSE_SECONDS / 60} minutes.`);
        deleteStoredValue(HHStoredVarPrefixKey + TK.labyrinthEditorStuck);
        setTimer('nextLabyrinthTime', LabyrinthAuto.EDITOR_STUCK_PAUSE_SECONDS);
        gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
        return false;
    }

    /** Tests only. */
    static _resetEditorStateForTests(): void {
        LabyrinthAuto.validateBlockedSince = 0;
        LabyrinthAuto.lastTeamSaveAnswer = "none";
    }

    // ------------------------------------------------------ repeated draws

    /** The opponent the green arrow marks, as the labyrinth page shows it; null if the mark is not on an opponent. */
    static readChosenFight(): LabyFightSnapshot | null {
        const hex = $('.labChosen').first().closest('.hex-container');
        const clickable = $('.clickable-hex', hex).first();
        const hexType = clickable.attr('hex_type') || '';
        if (hex.length === 0 || hexType.indexOf('opponent_') < 0) return null;
        const row = hex.closest('.row-hex-container').attr('id') || '';
        const squad = unsafeWindow.girl_squad || [];
        return {
            target: `${Labyrinth.getCurrentFloorNumber()}/${row}/${clickable.attr('hex_id') || ''}`,
            power: Number($('.opponent-power .opponent-power-text', hex).attr('data-power')) || 0,
            squadEgo: squad.reduce((sum, girl) => sum + (Number(girl.remaining_ego_percent) || 0), 0),
        };
    }

    /**
     * Counts the draws against the opponent about to be fought (#1904) and,
     * after LABY_DRAW_LIMIT of them in a row, sets the labyrinth timer to
     * LABY_DRAW_PAUSE_SECONDS. True means paused: the caller releases the
     * pipeline instead of fighting.
     */
    static pauseAfterRepeatedDraws(): boolean {
        const state = Labyrinth.readDrawState();
        const next = LabyrinthAuto.readChosenFight();
        if (next === null) {
            if (state.last !== null || state.draws > 0) {
                Labyrinth.saveDrawState({ ...EMPTY_LABY_DRAW_STATE, pausedUntil: state.pausedUntil });
            }
            return false;
        }
        const draws = countDraws(state, next);
        if (draws >= LABY_DRAW_LIMIT) {
            logHHAuto(`Labyrinth: ${draws} fights in a row against ${next.target} changed nothing (draw), pausing ${LABY_DRAW_PAUSE_SECONDS / 60} minutes.`);
            setTimer('nextLabyrinthTime', LABY_DRAW_PAUSE_SECONDS);
            Labyrinth.saveDrawState({ ...EMPTY_LABY_DRAW_STATE, pausedUntil: Date.now() + LABY_DRAW_PAUSE_SECONDS * 1000 });
            return true;
        }
        if (draws > 0) logHHAuto(`Labyrinth: draw ${draws}/${LABY_DRAW_LIMIT} against ${next.target}.`);
        Labyrinth.saveDrawState({ last: next, fought: false, draws, pausedUntil: state.pausedUntil });
        return false;
    }

    /** The script pressed the fight button: the next pick compares against this fight. */
    static markFightLaunched(): void {
        const state = Labyrinth.readDrawState();
        if (state.last !== null) Labyrinth.saveDrawState({ ...state, fought: true });
    }

    closeRewards(): boolean{
        // Issue #1716: the relic-choice popup reuses the #labyrinth_reward_popup
        // id and its claim buttons carry blue_button_L, so closeRewardPopupIfAny
        // would click the leftmost claim button (claiming the wrong relic) before
        // selectRelic runs. Skip closing it while a relic choice is pending; the
        // relic picker (selectRelic) owns that popup and closes it after the
        // correct card has been claimed.
        const isRelicChoice = $('#labyrinth_reward_popup .relic-container .claim-relic-btn').length > 0;
        return RewardHelper.closeRewardPopupIfAny() // laby coin
            || (isRelicChoice ? false : RewardHelper.closeRewardPopupIfAny(true, 'labyrinth_reward_popup')) //sweep floor (relic choice handled by selectRelic)
            || RewardHelper.closeRewardPopupIfAny(true, 'confirmation_popup') // no girl to heal
            || RewardHelper.closeRewardPopupIfAny(true, 'heal_girl_labyrinth_popup')
    }


    /** In the left part */
    getNumberSelectedGirl() {
        return $('.player-panel .team-hexagon .team-member-container[data-girl-id]').length;
    }
}