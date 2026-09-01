// SultryMysteries.pure.ts -- Pure remaining-time resolution for the Sultry
// Mysteries event.
//
// Extracted from SultryMysteries.parse so the "where does the event's
// remaining time come from" decision can be unit-tested without DOM
// access or game globals.
//
// On /event.html the grid tab is shown by default, and the countdown
// selector ('#contains_all #events .nc-panel .timer span[rel="expires"]')
// only matches an element after the user switches to the shop tab. Read
// before that switch, it yields an empty string/null -- and computing
// seconds_before_end from that made the event look already expired.
//
// The game exposes the same remaining time on
// window.sm_event_data.seconds_until_event_end (a numeric string)
// regardless of which tab is active, so that is tried first. The DOM
// value is kept as a fallback for older/other game variants, and a
// caller-supplied default covers the case where neither source is
// available -- resolveSultryMysteriesSecondsLeft never returns a value
// derived from an empty/missing reading.

export function resolveSultryMysteriesSecondsLeft(
    hhVarSecondsUntilEnd: unknown,
    domSecondsLeft: number | null,
    defaultSeconds: number,
): number {
    const parsedHHVar = Number(hhVarSecondsUntilEnd);
    if (hhVarSecondsUntilEnd !== null && hhVarSecondsUntilEnd !== undefined && Number.isFinite(parsedHHVar) && parsedHHVar >= 0) {
        return parsedHHVar;
    }
    if (domSecondsLeft !== null && Number.isFinite(domSecondsLeft) && domSecondsLeft >= 0) {
        return domSecondsLeft;
    }
    return defaultSeconds;
}

// ---------------------------------------------------------------------------
// Grid automation ("Auto-Mystery")
//
// The grid is a 6-column, 5-row board of 30 squares numbered 1..30 in
// reading order. Opening a square costs one key; after
// grid_refresh_squares_required (15) squares are opened, "Generate new
// grid" becomes available and resets the board.
//
// Opening order is a checkerboard so the first wave spreads over the whole
// board instead of clustering in the top rows:
//
//     X O X O X O        squares  1  3  5
//     O X O X O X                 8 10 12
//     X O X O X O                13 15 17
//     O X O X O X                20 22 24
//     X O X O X O                25 27 29
//
// That is exactly 15 squares -- the refresh threshold -- so the first wave
// alone unlocks a regenerate. The remaining "O" squares follow in
// ascending order when the reward goal has not been met yet.

const SM_GRID_COLUMNS = 6;

export interface SmGridSquare {
    id_square: number;
    is_opened?: boolean;
    reward_index?: number | string;
}

interface SmRewardEntry {
    rewards?: Array<{ type?: string }>;
}

/** rewards_list: reward index (1-based, as a string key) -> reward entry. */
export type SmRewardsList = Record<string, SmRewardEntry>;

export type SmAction =
    | { kind: "regenerate" }
    | { kind: "open"; idSquare: number }
    | { kind: "wait"; reason: "no_keys" | "grid_complete" };

export interface SmState {
    grid: SmGridSquare[];
    rewardsList: SmRewardsList;
    /** Reward types the user ticked in the collectables popup. Empty = no goal. */
    selectedTypes: string[];
    keys: number;
    squaresRequiredForRefresh: number;
}

/** True for the "X" squares of the checkerboard (first wave). */
export function isFirstWaveSquare(idSquare: number, columns: number = SM_GRID_COLUMNS): boolean {
    const row = Math.ceil(idSquare / columns);
    const column = ((idSquare - 1) % columns) + 1;
    return (row + column) % 2 === 0;
}

/**
 * Ids of the still-locked squares in the order they should be opened:
 * checkerboard squares first (ascending), then the rest (ascending).
 * Already-opened squares are skipped, so a half-played grid is picked up
 * where it was left.
 */
export function smOpeningOrder(grid: SmGridSquare[], columns: number = SM_GRID_COLUMNS): number[] {
    const locked = (grid || [])
        .filter((square) => square && !square.is_opened && Number.isFinite(Number(square.id_square)))
        .map((square) => Number(square.id_square))
        .sort((a, b) => a - b);
    return [
        ...locked.filter((id) => isFirstWaveSquare(id, columns)),
        ...locked.filter((id) => !isFirstWaveSquare(id, columns)),
    ];
}

/** Reward indexes revealed so far, as numbers. */
function openedRewardIndexes(grid: SmGridSquare[]): Set<number> {
    const opened = new Set<number>();
    for (const square of grid || []) {
        if (square && square.is_opened) {
            const index = Number(square.reward_index);
            if (Number.isFinite(index)) opened.add(index);
        }
    }
    return opened;
}

export interface SmTypeProgress {
    type: string;
    total: number;
    found: number;
}

/**
 * Per selected reward type: how many squares of the current grid hold it and
 * how many of those are already open. Counts come from the live rewards_list
 * rather than fixed numbers, because a regenerated grid may be composed
 * differently.
 */
export function smSelectedTypesProgress(
    rewardsList: SmRewardsList,
    grid: SmGridSquare[],
    selectedTypes: string[],
): SmTypeProgress[] {
    const opened = openedRewardIndexes(grid);
    return (selectedTypes || []).map((type) => {
        let total = 0;
        let found = 0;
        for (const rewardIndex of Object.keys(rewardsList || {})) {
            if (rewardsList[rewardIndex]?.rewards?.[0]?.type !== type) continue;
            total++;
            if (opened.has(Number(rewardIndex))) found++;
        }
        return { type, total, found };
    });
}

/**
 * Whether every selected reward type has been fully revealed. An empty
 * selection is complete by definition -- the user then only gets the
 * "open 15, regenerate, repeat until out of keys" behaviour.
 */
export function smSelectionComplete(
    rewardsList: SmRewardsList,
    grid: SmGridSquare[],
    selectedTypes: string[],
): boolean {
    return smSelectedTypesProgress(rewardsList, grid, selectedTypes).every((progress) => progress.found >= progress.total);
}

export function smOpenedCount(grid: SmGridSquare[]): number {
    return (grid || []).filter((square) => square && square.is_opened).length;
}

/**
 * The single next step for the grid.
 *
 * Regenerating is checked first and does not require keys: it costs
 * nothing, and a fresh board is worth more than the leftovers of a board
 * whose interesting squares are already open.
 *
 * Opening is only ever proposed with keys in hand. Clicking a locked
 * square with zero keys makes the game open its "get more keys" popup
 * (koban purchase), so the caller must never click on a "no_keys" wait.
 */
export function smNextAction(state: SmState): SmAction {
    const grid = state.grid || [];
    const canRegenerate = smOpenedCount(grid) >= state.squaresRequiredForRefresh;
    if (canRegenerate && smSelectionComplete(state.rewardsList, grid, state.selectedTypes)) {
        return { kind: "regenerate" };
    }

    const nextSquare = smOpeningOrder(grid)[0];
    if (nextSquare === undefined) {
        // Whole board open but the goal still unmet: nothing left to do here.
        return canRegenerate ? { kind: "regenerate" } : { kind: "wait", reason: "grid_complete" };
    }
    if (!Number.isFinite(state.keys) || state.keys <= 0) {
        return { kind: "wait", reason: "no_keys" };
    }
    return { kind: "open", idSquare: nextSquare };
}
