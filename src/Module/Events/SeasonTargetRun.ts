// SeasonTargetRun.ts -- The season target's fighting: one tick in place of
// the pipeline, on the season page, the arena and the battle page.
//
// What the season target is, when it ends and why it is split from
// SeasonTarget.ts is told there; the decisions are SeasonTarget.pure.ts.
//
// Used by: index.ts (hands it to AutoLoop through setSeasonTarget)

import { getHero, HeroHelper } from "../../Helper/HeroHelper";
import { getHHVars, setHHVars } from "../../Helper/HHHelper";
import { getStoredValue, setStoredValue } from "../../Helper/StorageHelper";
import { randomInterval } from "../../Helper/TimeHelper";
import { queryStringGetParam } from "../../Helper/UrlHelper";
import { AutoLoopContext } from "../../Service/AutoLoopContext";
import { addNutakuSession, gotoPage, safeNavigateHref } from "../../Service/PageNavigationService";
import { logHHAuto } from "../../Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../../config/HHStoredVars";
import { SK, TK } from "../../config/StorageKeys";
import { Season } from "./Season";
import { SeasonTarget, isTargetPage, kissPrice, page, progressText, readState, writeState } from "./SeasonTarget";
import { SeasonTargetState, countFight, decideKiss, fightOutcome, isTargetReached, mayCountFight } from "./SeasonTarget.pure";

/** A bought kiss shows up in Hero.energies once the answer is in; until
 *  then the next tick must not buy a second one. */
const BUY_SETTLE_MS = 15_000;

/** Set once this page is on its way out: the ticks until the load do nothing. */
let leaving = false;
let lastBuyAt = 0;

/** The season mojo the arena page is served with; NaN when it is missing. */
function readMojo(): number {
    const fromPage = Number((unsafeWindow as any).season_mojo_s);
    if (Number.isFinite(fromPage)) return fromPage;
    return Number((unsafeWindow as any).hero_data?.current_season_mojo);
}

export class SeasonTargetRun {
    static isActive(): boolean {
        return SeasonTarget.isActive();
    }

    static suspendForRest(): void {
        SeasonTarget.suspendForRest();
    }

    /**
     * One tick, in place of the pipeline. Returns true while the target ran
     * this tick -- AutoLoop then leaves the pipeline out.
     */
    static async tick(ctx: AutoLoopContext): Promise<boolean> {
        let state = readState();
        if (state === null) return false;
        const current = ctx.currentPage;
        if (leaving) {
            ctx.busy = true;
            return true;
        }

        if (state.suspended) {
            state = { ...state, suspended: false };
            writeState(state);
            if (!isTargetPage(current)) {
                logHHAuto('Season target: back from the rest, going to the arena.');
                SeasonTargetRun.leaveFor(ctx, () => gotoPage(page('pagesIDSeasonArena')));
                return true;
            }
        }
        if (!isTargetPage(current)) {
            SeasonTarget.end('left');
            return false;
        }
        SeasonTarget.showNotice(state);
        ctx.lastActionPerformed = 'season';

        if (current === page('pagesIDSeason')) {
            SeasonTargetRun.leaveFor(ctx, () => gotoPage(page('pagesIDSeasonArena')));
            return true;
        }
        if (current === page('pagesIDSeasonBattle')) {
            const opponent = queryStringGetParam(window.location.search, 'id_opponent');
            if (!state.pending || (opponent !== null && String(opponent) !== state.pending.opponentId)) {
                SeasonTarget.end('foreignFight');
                return false;
            }
            if (!state.pending.fought) writeState({ ...state, pending: { ...state.pending, fought: true } });
            logHHAuto('Season target: back to the arena after the fight.');
            SeasonTargetRun.leaveFor(ctx, () => gotoPage(page('pagesIDSeasonArena'), {}, randomInterval(2000, 4000)));
            return true;
        }
        return SeasonTargetRun.onArena(ctx, state);
    }

    private static async onArena(ctx: AutoLoopContext, state: SeasonTargetState): Promise<boolean> {
        const mojo = readMojo();
        if (!Number.isFinite(mojo)) {
            SeasonTarget.end('unreadable');
            return false;
        }
        if (state.pending && mayCountFight(state.pending)) {
            const outcome = fightOutcome(state.pending, mojo, Season.getEnergy());
            state = countFight(state, outcome);
            writeState(state);
            logHHAuto(outcome === 'none'
                ? 'Season target: the fight did not take place (no kiss spent, mojo unchanged).'
                : `Season target: fight ${outcome} (mojo ${mojo}) -- ${progressText(state)}.`);
        }
        if (isTargetReached(state)) {
            SeasonTarget.end('reached');
            return false;
        }
        SeasonTarget.showNotice(state);

        const price = kissPrice();
        const kiss = decideKiss({
            kisses: Season.getEnergy(),
            buyKisses: state.buyKisses,
            spendAllowed: getStoredValue(HHStoredVarPrefixKey + SK.spendKobans0) === 'true',
            kobans: HeroHelper.getKoban(),
            kobanBank: Number(getStoredValue(HHStoredVarPrefixKey + SK.kobanBank)) || 0,
            price: Number.isFinite(price) ? price : Infinity,
        });
        if (kiss.kind === 'end') {
            SeasonTarget.end(kiss.reason);
            return false;
        }
        if (kiss.kind === 'buy') {
            if (Date.now() - lastBuyAt >= BUY_SETTLE_MS) {
                lastBuyAt = Date.now();
                SeasonTargetRun.buyKiss(price);
            }
            ctx.busy = true;
            return true;
        }

        Season.stylesBattle();
        const chosen = await Season.moduleSimSeasonBattle(true, true);
        if (chosen === -2) {
            SeasonTargetRun.leaveFor(ctx, () => {
                setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, 'false');
                setTimeout(Season.payForNewOpponents, randomInterval(800, 1600));
                return true;
            });
            return true;
        }
        if (typeof chosen !== 'number' && typeof chosen !== 'string' || chosen === -1) {
            SeasonTarget.end('noOpponent');
            return false;
        }
        const opponentBlock = $('.season_arena_opponent_container[data-opponent=' + chosen + ']');
        const href = $('.opponent_perform_button_container :first-child', opponentBlock).first().attr('href') || '';
        if (href === '') {
            SeasonTarget.end('unreadable');
            return false;
        }
        writeState({ ...state, pending: { opponentId: String(chosen), mojoBefore: mojo, kissBefore: Season.getEnergy(), at: Date.now() } });
        logHHAuto(`Season target: fighting ${$('.personal_info div.player-name', opponentBlock).text()} (${chosen}).`);
        SeasonTargetRun.leaveFor(ctx, () => safeNavigateHref(addNutakuSession(href) as string));
        return true;
    }

    /**
     * Navigate once and let the ticks rest until the page goes. A navigation
     * that was refused (another one is in flight) leaves the next tick to try
     * again -- and takes back a pending fight that never left.
     */
    private static leaveFor(ctx: AutoLoopContext, navigate: () => boolean): void {
        ctx.busy = true;
        if (navigate()) {
            leaving = true;
            return;
        }
        const state = readState();
        if (state?.pending && !state.pending.fought) {
            const rest = { ...state };
            delete rest.pending;
            writeState(rest);
        }
    }

    /** One kiss, through the game's own recharge, as Troll buys fights. */
    private static buyKiss(price: number): void {
        logHHAuto(`Season target: no kiss left, buying one for ${price} kobans.`);
        const hcConfirmValue = getHHVars('Hero.infos.hc_confirm');
        setHHVars('Hero.infos.hc_confirm', true);
        getHero().recharge($('<button>'), 'kiss', 1, price);
        setHHVars('Hero.infos.hc_confirm', hcConfirmValue);
    }
}
