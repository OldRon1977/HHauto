// SeasonTarget.ts -- Fight in the season until a number of wins, or of
// fights, is reached, whatever the season settings say (#1801).
//
// Asked for to finish Path of Attraction and contest objectives that count
// season wins: the season settings ration kisses by thresholds, tiers and
// focus, and late in a season enough fights are lost that the player kept
// counting by hand.
//
// The player starts it from a button beside "Find Opponents" on the season
// page. While it runs, AutoLoop hands every tick to it instead of the
// pipeline: no other module fights, collects or navigates in between. It
// keeps to the master switch, the mouse pause, a work pause and paranoia --
// a paranoia rest sends the script home, and the target marks itself
// suspended so that the way home does not read as the player leaving; after
// the rest it goes back to the arena.
//
// It ends when
//   - the target is reached,
//   - no kiss is left and none may be bought (the option is off, Spend
//     Kobans is off, or a kiss would cut into the koban reserve),
//   - the arena offers no opponent,
//   - the player leaves the season pages, or fights a fight the target did
//     not start,
//   - the player presses Cancel on the notice.
//
// Wins are counted from the mojo on the arena page before and after each
// fight; why not from the fight response is told in SeasonTarget.pure.ts.
// The state lives in sessionStorage (Temp_seasonTarget) and outlives the
// page load of every fight.
//
// This file holds the state and what the player sees: the button, the
// popup, the notice and the info row. The fighting is SeasonTargetRun.ts --
// it imports Season, which reaches AutoLoop through ParanoiaService, and the
// page handlers and the info box must not close that cycle.
//
// Used by: SeasonTargetRun.ts, AutoLoopPageHandlers.ts (the button and the
//   result notice), InfoService.ts (the progress row), index.ts

import { ConfigHelper } from "../../Helper/ConfigHelper";
import { getHHVars } from "../../Helper/HHHelper";
import { getTextForUI } from "../../Helper/LanguageHelper";
import { getStoredJSON, getStoredValue, deleteStoredValue, setStoredValue } from "../../Helper/StorageHelper";
import { kickAutoLoop } from "../../Service/AutoLoopKick";
import { fillHHPopUp, maskHHPopUp } from "../../Utils/HHPopup";
import { logHHAuto } from "../../Utils/LogUtils";
import { pInfoRow } from "../../Utils/PInfoRow";
import { HHStoredVarPrefixKey } from "../../config/HHStoredVars";
import { SK, TK } from "../../config/StorageKeys";
import { SEASON_TARGET_MAX, SeasonTargetMode, SeasonTargetState, parseTarget, targetProgress } from "./SeasonTarget.pure";

let stylesAdded = false;

/** Built at call time: a top-level read of HHStoredVarPrefixKey can hit the
 *  temporal dead zone inside an import cycle (deps:toplevel-key). */
function stateKey(): string {
    return HHStoredVarPrefixKey + TK.seasonTarget;
}

/** What is stored: a running target, or the result of one that ended. */
function readStored(): SeasonTargetState | null {
    const state = getStoredJSON<SeasonTargetState | null>(stateKey(), null);
    if (!state || typeof state.target !== 'number') return null;
    return state;
}

/** The running target; null when none runs or the stored one has ended. */
export function readState(): SeasonTargetState | null {
    const state = readStored();
    return state && !state.ended ? state : null;
}

export function writeState(state: SeasonTargetState): void {
    setStoredValue(stateKey(), JSON.stringify(state));
}

export const page = (key: string): string => ConfigHelper.getHHScriptVars(key);

/**
 * The pages the target works on. pvp-arena is not one of them: measured on
 * 2026-10-05, season fights run on season-battle, and pvp-arena is the Lust
 * Arena hub the season page's close button leads to -- the player leaving.
 */
export function isTargetPage(current: string): boolean {
    return current === page('pagesIDSeason') || current === page('pagesIDSeasonArena') || current === page('pagesIDSeasonBattle');
}

/** What the game itself charges for one kiss in its recharge popup. */
export function kissPrice(): number {
    const kiss = getHHVars('Hero.energies.kiss');
    const perMinute = Number((unsafeWindow as any).hh_prices?.kiss_cost_per_minute);
    return Math.ceil(Number(kiss?.seconds_per_point) * (perMinute / 60));
}

function unitText(mode: SeasonTargetMode): string {
    return getTextForUI(mode === 'wins' ? 'seasonTargetWins' : 'seasonTargetFights', 'elementText');
}

export function progressText(state: SeasonTargetState): string {
    let text = `${targetProgress(state)}/${state.target} ${unitText(state.mode)}`;
    if (state.mode === 'fights') text += ` (${state.wins} ${getTextForUI('seasonTargetWins', 'elementText')})`;
    return text;
}

export type EndReason = 'reached' | 'noKisses' | 'spendOff' | 'reserve' | 'noOpponent' | 'unreadable'
    | 'left' | 'foreignFight' | 'cancelled';

const END_LOG: Record<EndReason, string> = {
    reached: 'target reached',
    noKisses: 'no kiss left',
    spendOff: 'no kiss left, and Spend Kobans is off',
    reserve: 'no kiss left, and buying one would cut into the koban reserve',
    noOpponent: 'the arena offers no opponent to choose',
    unreadable: 'the arena page could not be read (no season mojo or no fight button)',
    left: 'the season pages were left',
    foreignFight: 'a fight the target did not start',
    cancelled: 'cancelled by the player',
};

type ResultReason = Exclude<EndReason, 'left' | 'foreignFight' | 'cancelled'>;

/** The result notice's text for an end the player did not cause. */
const END_TEXT: Record<ResultReason, string> = {
    reached: 'seasonTargetEndReached',
    noKisses: 'seasonTargetEndNoKisses',
    spendOff: 'seasonTargetEndSpendOff',
    reserve: 'seasonTargetEndReserve',
    noOpponent: 'seasonTargetEndNoOpponent',
    unreadable: 'seasonTargetEndUnreadable',
};

/** How long a result stays up when nobody presses OK. */
const RESULT_SHOWN_MS = 30 * 60_000;

export class SeasonTarget {
    static isActive(): boolean {
        return readState() !== null;
    }

    /** Paranoia is about to flip: if it goes to rest, the way home is its own. */
    static suspendForRest(): void {
        const state = readState();
        if (state && !state.suspended) writeState({ ...state, suspended: true });
    }

    static start(mode: SeasonTargetMode, target: number, buyKisses: boolean): void {
        writeState({ mode, target, buyKisses, wins: 0, fights: 0, since: Date.now() });
        logHHAuto(`Season target: started -- ${target} ${mode}${buyKisses ? ', kisses may be bought' : ''}.`);
        maskHHPopUp();
        if (getStoredValue(HHStoredVarPrefixKey + SK.master) !== 'true') return;
        // A navigation switches the loop flag off; with it off no tick is
        // scheduled, so one has to be started.
        if (getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) !== 'true') kickAutoLoop(500);
    }

    /**
     * End the target. An end the player caused -- leaving, an own fight,
     * Cancel -- takes the notice away. Any other end leaves a result in its
     * place: the pipeline takes over on the next tick and navigates, so a
     * popup would be gone within a second (measured), while the result
     * notice follows the player from page to page until OK, or for
     * RESULT_SHOWN_MS.
     */
    static end(reason: EndReason): void {
        const state = readState();
        if (state === null) return;
        $('#hhSeasonTarget').remove();
        logHHAuto(`Season target: ended -- ${END_LOG[reason]}. ${progressText(state)}, ${state.fights} fights.`);
        if (reason === 'left' || reason === 'foreignFight' || reason === 'cancelled') {
            deleteStoredValue(stateKey());
            return;
        }
        const result: SeasonTargetState = { ...state, ended: { reason, at: Date.now() } };
        delete result.pending;
        writeState(result);
    }

    /** Asked every tick: puts up the result of an ended target, or retires it. */
    static showResult(): void {
        const state = readStored();
        if (!state?.ended) return;
        if (Date.now() - state.ended.at >= RESULT_SHOWN_MS) {
            SeasonTarget.dismissResult();
            return;
        }
        SeasonTarget.renderNotice('done', `${getTextForUI('seasonTarget', 'elementText')}: ${progressText(state)}. `
            + getTextForUI(END_TEXT[state.ended.reason as ResultReason] ?? 'seasonTargetEndReached', 'elementText'));
    }

    private static dismissResult(): void {
        if (readStored()?.ended) deleteStoredValue(stateKey());
        $('#hhSeasonTarget').remove();
    }

    /** The progress row in the info box, or the result of the last target. */
    static getPinfo(): string {
        const state = readStored();
        if (state === null) return '';
        const value = state.ended
            ? `${progressText(state)} -- ${getTextForUI(END_TEXT[state.ended.reason as ResultReason] ?? 'seasonTargetEndReached', 'elementText')}`
            : progressText(state);
        return pInfoRow(getTextForUI('seasonTarget', 'elementText'), value);
    }

    // ------------------------------------------------------------------ UI

    /**
     * The button beside "Find Opponents" on the season page. Beside, not
     * below: measured at 1440 px, the rewards recap (#HHSeasonRewards) lies
     * over everything under that button, and a block in the flow pushed the
     * mojo bar down. To its right are 122 px of the controls column free.
     * Placed from the game button's own box on every call, so a re-render
     * of the page takes it along.
     */
    static addButton(): void {
        const findOpponents = $('.seasons_controls_holder a[href*="season-arena"]').first();
        const blue = findOpponents.find('.blue_button_L').get(0) as HTMLElement | undefined;
        if (!blue) return;
        if (document.getElementById('hhSeasonTargetButton') === null) {
            SeasonTarget.addStyles();
            findOpponents.after(`<div class="tooltipHH" id="hhSeasonTargetButtonHolder">`
                + `<span class="tooltipHHtext">${getTextForUI('seasonTarget', 'tooltip')}</span>`
                + `<label class="myButton" id="hhSeasonTargetButton">${getTextForUI('seasonTarget', 'elementText')}</label></div>`);
            $('#hhSeasonTargetButton').on('click', () => SeasonTarget.showPopup());
        }
        $('#hhSeasonTargetButtonHolder').css({
            top: blue.offsetTop + 'px',
            left: (blue.offsetLeft + blue.offsetWidth + 8) + 'px',
            height: blue.offsetHeight + 'px',
        });
    }

    static showPopup(): void {
        const t = (key: string) => esc(getTextForUI(key, 'elementText'));
        const state = readState();
        let body: string;
        if (state !== null) {
            body = `<p><b>${esc(progressText(state))}</b></p>`
                + `<p class="hhstButtons"><label class="myButton" id="hhSeasonTargetCancel">${t('seasonTargetCancel')}</label></p>`;
        } else {
            const spendAllowed = getStoredValue(HHStoredVarPrefixKey + SK.spendKobans0) === 'true';
            const bank = Number(getStoredValue(HHStoredVarPrefixKey + SK.kobanBank)) || 0;
            const price = kissPrice();
            const notes: string[] = [];
            if (getStoredValue(HHStoredVarPrefixKey + SK.master) !== 'true') notes.push(t('seasonTargetMasterOff'));
            if (getStoredValue(HHStoredVarPrefixKey + SK.autoSeasonPassReds) === 'true') notes.push(t('seasonTargetPassReds'));
            body = `<p>${t('seasonTargetExplain')}</p>`
                + `<p><label><input type="radio" name="hhstMode" value="wins" checked> ${t('seasonTargetModeWins')}</label><br>`
                + `<label><input type="radio" name="hhstMode" value="fights"> ${t('seasonTargetModeFights')}</label></p>`
                + `<p><label>${t('seasonTargetCount')} <input type="number" id="hhstCount" min="1" max="${SEASON_TARGET_MAX}" value="10" style="width:70px;"></label></p>`
                + `<p><label><input type="checkbox" id="hhstBuy"${spendAllowed ? '' : ' disabled'}> ${t('seasonTargetBuy')}</label><br>`
                + `<span class="hhstNote">${spendAllowed
                    ? esc(getTextForUI('seasonTargetBuyNote', 'elementText').replace('{price}', String(Number.isFinite(price) ? price : '?')).replace('{bank}', String(bank)))
                    : t('seasonTargetBuyOff')}</span></p>`
                + notes.map(n => `<p class="hhstWarn">${n}</p>`).join('')
                + `<p class="hhstButtons"><label class="myButton" id="hhSeasonTargetStart">${t('seasonTargetStart')}</label></p>`;
        }
        fillHHPopUp('HHSeasonTarget', getTextForUI('seasonTarget', 'elementText'),
            `<div id="hhSeasonTargetPopup">${body}</div>`);
        $('#hhSeasonTargetStart').on('click', () => {
            const target = parseTarget(String($('#hhstCount').val()));
            if (target === null) {
                $('#hhstCount').css('border-color', 'red');
                return;
            }
            const mode = $('input[name=hhstMode]:checked').val() === 'fights' ? 'fights' : 'wins';
            SeasonTarget.start(mode, target, $('#hhstBuy').is(':checked'));
        });
        $('#hhSeasonTargetCancel').on('click', () => {
            maskHHPopUp();
            SeasonTarget.end('cancelled');
        });
    }

    /** The notice on every page the target works on, with Cancel. */
    static showNotice(state: SeasonTargetState): void {
        SeasonTarget.renderNotice('run', getTextForUI('seasonTargetNotice', 'elementText').replace('{progress}', progressText(state)));
    }

    /** One notice, two kinds: a running target (Cancel) or a result (OK). */
    private static renderNotice(kind: 'run' | 'done', text: string): void {
        SeasonTarget.addStyles();
        const notice = $('#hhSeasonTarget');
        if (notice.length === 0 || notice.attr('data-kind') !== kind) {
            notice.remove();
            const label = getTextForUI(kind === 'run' ? 'seasonTargetCancel' : 'seasonTargetOk', 'elementText');
            $('body').append(`<div id="hhSeasonTarget" data-kind="${kind}"><span class="hhSeasonTargetText"></span>`
                + `<label class="myButton" id="hhSeasonTargetNoticeButton">${label}</label></div>`);
            $('#hhSeasonTargetNoticeButton').on('click', () => {
                if (kind === 'run') SeasonTarget.end('cancelled');
                else SeasonTarget.dismissResult();
            });
        }
        $('#hhSeasonTarget .hhSeasonTargetText').text(text);
    }

    private static addStyles(): void {
        if (stylesAdded) return;
        stylesAdded = true;
        // Blue, where the work pause is red: both stop the pipeline, but this
        // one is working. White on #1a5fb4 is about 6.4:1.
        GM_addStyle('#hhSeasonTarget{position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:6000;'
            + 'display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;'
            + 'max-width:calc(100vw - 32px);box-sizing:border-box;padding:5px 12px;border-radius:6px;'
            + 'background:#1a5fb4;border:1px solid #cfe0ff;box-shadow:0 2px 8px rgba(0,0,0,0.5);'
            + 'color:#fff;font-size:13px;font-weight:600;}'
            // The result: green, white text about 5.9:1.
            + '#hhSeasonTarget[data-kind=done]{background:#26734d;border-color:#d4f5e2;}'
            + '#hhSeasonTarget .myButton{margin:0;padding:2px 10px;font-size:12px;font-weight:normal;}'
            + '#hhSeasonTargetButtonHolder{position:absolute;margin:0;padding:0;z-index:5;}'
            + '#hhSeasonTargetButtonHolder .myButton{display:flex;align-items:center;justify-content:center;'
            + 'box-sizing:border-box;width:106px;height:100%;margin:0;padding:2px 4px;'
            + 'font-size:11px;line-height:12px;text-align:center;}'
            + '#hhSeasonTargetPopup{padding:10px;max-width:480px;font-size:13px;}'
            + '#hhSeasonTargetPopup p{margin:0 0 10px 0;}'
            + '#hhSeasonTargetPopup .hhstNote{color:#555;font-size:12px;}'
            + '#hhSeasonTargetPopup .hhstWarn{color:#b3261e;}'
            + '#hhSeasonTargetPopup .hhstButtons{text-align:center;margin-top:14px;}'
            + '#hhSeasonTargetPopup .hhstButtons .myButton{font-size:14px;padding:6px 22px;}');
    }
}

function esc(value: string): string {
    return String(value).replace(/[&<>"]/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
