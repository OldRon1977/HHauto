// WorkPause.pure.ts -- Whether the player's work on the team holds the
// pipeline: the decision, without storage, DOM or clock.
//
// The impure half (WorkPause.ts) gathers the input every tick and acts on the
// answer. Why the pause exists and why it is shaped this way is told there.
//
// Used by: WorkPause.ts

/** How long the pause outlives the last sign of work. */
export const WORK_PAUSE_IDLE_MS = 15 * 60_000;

/** What the pause keeps in sessionStorage (Temp_workPause). */
export interface WorkPauseState {
    /** When the player started -- for the log only. */
    since: number;
    /** The last sign of work: a click, a calculation, a step of a run. */
    lastActivity: number;
    /** The edit-team page the work started on; a finished run goes back there. */
    teamUrl?: string;
    /** A run finished and is on its way back to the team page. */
    returnToTeam?: boolean;
}

export interface WorkPauseInput {
    state: WorkPauseState | null;
    now: number;
    /** The edit-team page or the team list. */
    onTeamPage: boolean;
    /** Stuff Team, Level-up gear or Upgrade Gear has work stored. */
    runActive: boolean;
    idleMs: number;
}

export type WorkPauseDecision =
    | { kind: 'none' }
    | { kind: 'hold'; remainingMs: number; goToTeam: boolean; arrived: boolean }
    | { kind: 'end'; reason: 'idle' | 'left' };

/**
 * Hold, end, or there is no pause at all.
 *
 * The idle limit comes first and applies to runs too: a run that stops
 * making progress -- a queue left behind by a closed tab, a step that
 * never comes -- must not keep the script parked for good. Every step of
 * a run counts as work, so a run that moves never reaches the limit.
 *
 * Off the team pages, with no run going and none on its way back, the
 * player has left by their own hand: the pause ends.
 */
export function decideWorkPause(input: WorkPauseInput): WorkPauseDecision {
    const { state, now, onTeamPage, runActive, idleMs } = input;
    if (state === null) return { kind: 'none' };
    const idle = Math.max(0, now - state.lastActivity);
    if (idle >= idleMs) return { kind: 'end', reason: 'idle' };
    const remainingMs = idleMs - idle;
    if (runActive) return { kind: 'hold', remainingMs, goToTeam: false, arrived: false };
    if (state.returnToTeam) {
        return { kind: 'hold', remainingMs, goToTeam: !onTeamPage, arrived: onTeamPage };
    }
    if (onTeamPage) return { kind: 'hold', remainingMs, goToTeam: false, arrived: false };
    return { kind: 'end', reason: 'left' };
}
