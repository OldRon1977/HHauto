// SeasonTarget.pure.ts -- The season target's decisions, without storage, DOM
// or clock: which opponent, whether a fight was won, whether to buy a kiss.
//
// The impure half (SeasonTarget.ts) reads the page and acts on the answers.
// Why the target exists and how it is shaped is told there.
//
// Used by: SeasonTarget.ts, SeasonTargetRun.ts, Season.ts

/** Count wins, or count every fight won or lost. */
export type SeasonTargetMode = 'wins' | 'fights';

/** A fight the target launched and has not counted yet. */
export interface SeasonTargetPending {
    opponentId: string;
    /** window.season_mojo_s on the arena before the fight. */
    mojoBefore: number;
    kissBefore: number;
    /** When the fight was launched -- only a page loaded after it may count it. */
    at: number;
}

/** What the target keeps in sessionStorage (Temp_seasonTarget). */
export interface SeasonTargetState {
    mode: SeasonTargetMode;
    target: number;
    buyKisses: boolean;
    wins: number;
    fights: number;
    since: number;
    pending?: SeasonTargetPending;
    /** Paranoia sent the script to rest: the way home is not the player's. */
    suspended?: boolean;
    /** The target has ended for a reason the player did not cause; what is
     *  left is its result, shown until the player dismisses it. */
    ended?: { reason: string; at: number };
}

export const SEASON_TARGET_MAX = 999;

export type FightOutcome = 'won' | 'lost' | 'unknown' | 'none';

/**
 * What became of the pending fight, read from the arena after it.
 *
 * Mojo is the measure: a won season fight adds mojo, a lost one takes some
 * away (measured: +20, +21 for wins, -7 for a loss). The fight response
 * would say it too, but the game sends it 50 ms after DOMContentLoaded --
 * before a userscript reliably listens -- and its `result` field reads
 * "won" for a lost fight as well; `battle_result` is the real one.
 *
 * Unchanged mojo with a kiss gone is a fight of unknown outcome: it counts
 * as a fight, not as a win, so a wins target fights once more rather than
 * once too few. Unchanged mojo and no kiss gone means the fight never ran.
 */
export function fightOutcome(pending: SeasonTargetPending, mojoNow: number, kissNow: number): FightOutcome {
    if (mojoNow > pending.mojoBefore) return 'won';
    if (mojoNow < pending.mojoBefore) return 'lost';
    return kissNow < pending.kissBefore ? 'unknown' : 'none';
}

/** The state after counting the pending fight; `pending` is gone either way. */
export function countFight(state: SeasonTargetState, outcome: FightOutcome): SeasonTargetState {
    const next: SeasonTargetState = { ...state };
    delete next.pending;
    if (outcome === 'none') return next;
    next.fights = state.fights + 1;
    if (outcome === 'won') next.wins = state.wins + 1;
    return next;
}

/** The number the target counts: wins, or all fights. */
export function targetProgress(state: SeasonTargetState): number {
    return state.mode === 'wins' ? state.wins : state.fights;
}

export function isTargetReached(state: SeasonTargetState): boolean {
    return targetProgress(state) >= state.target;
}

export interface TargetOpponent {
    /** Win probability from the simulation, 0..1. */
    win: number;
    mojo: number;
}

/**
 * The opponent with the best chance to win; among equal chances, the one
 * worth the most mojo. Chances are compared at the precision the arena shows
 * them (two decimals of a percent), so two opponents the player sees at
 * 100.00 % count as a tie. -1 for an empty list.
 */
export function chooseTargetOpponent(opponents: TargetOpponent[]): number {
    const shown = (win: number) => Math.round(win * 10_000);
    let chosen = -1;
    for (let i = 0; i < opponents.length; i++) {
        if (chosen === -1) { chosen = i; continue; }
        const a = shown(opponents[i].win);
        const b = shown(opponents[chosen].win);
        if (a > b || (a === b && opponents[i].mojo > opponents[chosen].mojo)) chosen = i;
    }
    return chosen;
}

export interface KissInput {
    kisses: number;
    buyKisses: boolean;
    /** Setting_spendKobans0, the security switch every koban spend sits behind. */
    spendAllowed: boolean;
    kobans: number;
    /** Setting_kobanBank: the kobans that must stay. */
    kobanBank: number;
    /** What one kiss costs. */
    price: number;
}

export type KissDecision =
    | { kind: 'fight' }
    | { kind: 'buy' }
    | { kind: 'end'; reason: 'noKisses' | 'spendOff' | 'reserve' };

/**
 * Fight with the kisses there are; with none left, buy one if the target
 * may and the koban reserve stays whole -- otherwise the target ends.
 * One kiss at a time: the target may be reached before a second is needed.
 */
export function decideKiss(input: KissInput): KissDecision {
    if (input.kisses > 0) return { kind: 'fight' };
    if (!input.buyKisses) return { kind: 'end', reason: 'noKisses' };
    if (!input.spendAllowed) return { kind: 'end', reason: 'spendOff' };
    if (input.kobans - input.price < input.kobanBank) return { kind: 'end', reason: 'reserve' };
    return { kind: 'buy' };
}

/** A target as typed into the popup, or null when it is not a usable number. */
export function parseTarget(value: string): number | null {
    const n = Number(String(value).trim());
    if (!Number.isInteger(n) || n < 1 || n > SEASON_TARGET_MAX) return null;
    return n;
}
