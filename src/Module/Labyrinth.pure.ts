// Labyrinth.pure.ts -- Pure decision logic for the labyrinth path pipeline,
// the "find better option" selector and the count of repeated draws.
//
// Behind Labyrinth.createPathFromMatrix, Labyrinth.keepPathsWithTreasure,
// Labyrinth.sortPathsByDifficulty and Labyrinth.findBetter, so the
// path-building DFS, the treasure filter, the difficulty sort and the
// option ranker can be unit-tested without DOM access, jQuery, globals or
// storage.
//
// The functions are generic over the opponent record so the impure
// adapter can keep its DOM-bound `LabyrinthOpponent` shape (with
// jQuery `button` / `cell` handles) while the pure layer only needs
// the deterministic decision fields.

/**
 * Minimal subset of fields the path pipeline reads (build / filter /
 * sort). The impure adapter's `LabyrinthOpponent` already carries these
 * two fields, so the pipeline can be invoked with the DOM-bound type
 * directly without a projection step.
 */
export interface LabyrinthPathOpponent {
    opponentDifficulty: number;
    isTreasure: boolean;
}

/**
 * Field set the option ranker reads. The impure adapter projects its
 * DOM-bound `LabyrinthOpponent` onto this shape (mapping the jQuery
 * `button` handle onto the `hasButton` boolean) before delegating.
 */
export interface LabyrinthOpponentLite {
    opponentDifficulty: number;
    isTreasure: boolean;
    isShrine: boolean;
    isNext: boolean;
    isOpponent: boolean;
    power: number;
    /**
     * In the impure code this is `option.button` (a jQuery handle)
     * used as a truthiness check inside findBetter. The pure pipeline
     * sees the same condition as a boolean.
     */
    hasButton: boolean;
}

/**
 * The indices in the next row that the cell at (currIdx, currLen) can
 * reach.
 *
 * Adjacency rules:
 *   - nextLen === 1 (boss row): every cell maps to [0]
 *   - currLen 1 -> nextLen 2: 0 -> [0, 1]
 *   - currLen 2 -> nextLen 3: 0 -> [0, 1], 1 -> [1, 2]
 *   - currLen 3 -> nextLen 2: 0 -> [0], 1 -> [0, 1], 2 -> [1]
 *   - any other shape returns undefined
 */
export function getNextIndices(
    currIdx: number,
    currLen: number,
    nextLen: number,
): number[] | undefined {
    if (nextLen === 1) return [0];
    if (currLen === 1 && nextLen === 2) return [0, 1];
    if (currLen === 2 && nextLen === 3) return currIdx === 0 ? [0, 1] : [1, 2];
    if (currLen === 3 && nextLen === 2) {
        if (currIdx === 0) return [0];
        if (currIdx === 1) return [0, 1];
        return [1];
    }
    return undefined;
}

/**
 * Every path through the labyrinth: DFS over a row-of-cells matrix using
 * the adjacency rules in getNextIndices.
 *
 * Empty leading rows are skipped (`while !matrix[startRow] ||
 * length === 0`): the matrix may carry empty rows ahead of the first real
 * row.
 */
export function buildPathsFromMatrix<T extends LabyrinthPathOpponent>(
    matrix: T[][],
): T[][] {
    const rows = matrix.length;
    const paths: T[][] = [];
    if (rows === 0) return paths;

    const lastRow = rows - 1;

    const dfs = (row: number, idx: number, acc: T[]) => {
        acc.push(matrix[row][idx]);

        if (row === lastRow) {
            paths.push(acc.slice());
            acc.pop();
            return;
        }

        const nextRow = row + 1;
        const currLen = matrix[row].length;
        const nextLen = matrix[nextRow].length;

        const nextIndices = getNextIndices(idx, currLen, nextLen);
        if (nextIndices === undefined) {
            // An unrecognised row pair: no further descent from here,
            // instead of iterating an undefined list below.
            acc.pop();
            return;
        }

        for (const ni of nextIndices) {
            if (ni >= 0 && ni < nextLen) dfs(nextRow, ni, acc);
        }

        acc.pop();
    };

    let startRow = 0;
    while (startRow < rows && (!matrix[startRow] || matrix[startRow].length === 0)) {
        startRow++;
    }
    if (startRow >= rows) return paths;

    for (let i = 0; i < matrix[startRow].length; i++) {
        dfs(startRow, i, []);
    }

    return paths;
}

/**
 * Keep only paths that contain at least one treasure cell (behind
 * Labyrinth.keepPathsWithTreasure).
 */
export function filterPathsWithTreasure<T extends LabyrinthPathOpponent>(
    paths: T[][],
): T[][] {
    return paths.filter((path) =>
        path.filter((opponent) => opponent.isTreasure).length > 0,
    );
}

/**
 * Sort paths ascending by the sum of their opponent difficulties. The
 * sort mutates: the input array is sorted in place and returned.
 */
export function sortPathsByDifficulty<T extends LabyrinthPathOpponent>(
    paths: T[][],
): T[][] {
    return paths.sort((pathA, pathB) => {
        let difficultyA = 0;
        let difficultyB = 0;
        pathA.forEach((opponent) => {
            difficultyA += opponent.opponentDifficulty;
        });
        pathB.forEach((opponent) => {
            difficultyB += opponent.opponentDifficulty;
        });
        return difficultyA - difficultyB;
    });
}

export type FindBetterState<T extends LabyrinthOpponentLite> = {
    options: T[];
    /**
     * Setting_autoLabyHard. When true, prefer harder opponents and
     * lower-power within the same difficulty band.
     */
    chooseMoreReward: boolean;
    /**
     * `unsafeWindow.girl_squad.filter(g => g.remaining_ego_percent < 100)`
     * has at least one entry. Wounded squad members trigger the
     * shrine-keeping branch from floor 3 onwards.
     */
    haveGirlWounded: boolean;
    /**
     * Labyrinth.getCurrentFloorNumber(). Floor < 3 forbids shrines and
     * (without chooseMoreReward) prefers easy opponents.
     */
    floor: number;
};

/**
 * The option ranker behind Labyrinth.findBetter. Filter cascade:
 *
 *   1. shrines: drop unless (haveGirlWounded AND floor >= 3)
 *      else if floor >= 3 AND any shrine present: keep only shrines
 *   2. treasures: if any treasure present, keep only treasures
 *   3. easy bias: !chooseMoreReward AND floor < 3 AND any
 *      opponentDifficulty == 1 present: keep only those
 *
 * Then iterate the filtered list and pick the best:
 *
 *   - Only options with hasButton AND isNext are eligible.
 *   - First eligible option becomes the seed.
 *   - chooseMoreReward branch:
 *       * higher opponentDifficulty wins
 *       * tied difficulty: lower power wins
 *   - else (default) branch:
 *       * non-opponent beats opponent
 *       * two opponents: lower power wins
 *
 * If no eligible option survives, fall back to the FIRST element of
 * the ORIGINAL options array (before any filter ran).
 */
export function decideBetterOption<T extends LabyrinthOpponentLite>(
    state: FindBetterState<T>,
): T | null {
    let { options } = state;
    const { chooseMoreReward, haveGirlWounded, floor } = state;

    let firstOption: T | null = null;
    if (options.length > 0) {
        firstOption = options[0];
    }

    if (!haveGirlWounded || floor < 3) {
        options = options.filter((option) => !option.isShrine);
    } else if (floor >= 3 && options.filter((option) => option.isShrine).length > 0) {
        options = options.filter((option) => option.isShrine);
    }

    if (options.filter((option) => option.isTreasure).length > 0) {
        options = options.filter((option) => option.isTreasure);
    }

    if (
        !chooseMoreReward
        && floor < 3
        && options.filter((option) => option.opponentDifficulty === 1).length > 0
    ) {
        options = options.filter((option) => option.opponentDifficulty === 1);
    }

    let chosenOption: T | null = null;
    options.forEach((option) => {
        let isBetter = false;
        if (option.hasButton && option.isNext) {
            if (chosenOption == null) {
                isBetter = true;
            } else if (chooseMoreReward) {
                if (chosenOption.opponentDifficulty < option.opponentDifficulty) {
                    isBetter = true;
                } else if (
                    chosenOption.opponentDifficulty === option.opponentDifficulty
                    && chosenOption.power > option.power
                ) {
                    isBetter = true;
                }
            } else {
                if (chosenOption.isOpponent && !option.isOpponent) {
                    isBetter = true;
                } else if (
                    chosenOption.isOpponent
                    && option.isOpponent
                    && chosenOption.power > option.power
                ) {
                    isBetter = true;
                }
            }
        }

        if (isBetter) {
            chosenOption = option;
        }
    });

    if (chosenOption == null && firstOption != null) {
        chosenOption = firstOption;
    }
    return chosenOption;
}

// ---------------------------------------------------------------------------
//  Repeated draws (#1904)
//
// A fight the server calls a draw changes nothing the labyrinth page shows:
// the same opponent hex stays next with the same power, and the squad keeps
// its health. The block then picks that hex again on every tick and never
// releases the pipeline. What a draw does to the squad's health is not
// measured; one that lowers it reads as a loss here, and the next fights
// against the weakened squad end the loop anyway.
//
// A loss shows in the squad's health, a win in the opponent's power or in the
// hex being gone, so "nothing changed" is read as a draw. The page shows the
// opponent's power only, not its health: measured on labyrinth.html, a hex
// carries `opponent_data.power_display` and nothing else. A fight that only
// wounds the opponent without knocking out a girl may therefore leave the power
// unchanged; that costs at most one pause too many and is accepted.
//
// Only a fight the script launched itself counts (`fought`), so a revisit of
// the labyrinth page without a fight in between -- a reload, the Forbidden
// recovery, a trip to the team editor -- is not taken for a draw.
// ---------------------------------------------------------------------------

/** Draws in a row before the labyrinth pauses. */
export const LABY_DRAW_LIMIT = 3;
/** The pause after LABY_DRAW_LIMIT draws, in seconds. */
export const LABY_DRAW_PAUSE_SECONDS = 60 * 60;

/** What the labyrinth page shows about the next fight. */
export interface LabyFightSnapshot {
    /** Floor, row and hex of the chosen opponent, e.g. "2/11/1". */
    target: string;
    power: number;
    /** Sum of remaining_ego_percent over the whole squad. */
    squadEgo: number;
}

export interface LabyDrawState {
    /** The opponent picked last time, or null. */
    last: LabyFightSnapshot | null;
    /** True once the script pressed the fight button against `last`. */
    fought: boolean;
    /** Draws in a row against `last`. */
    draws: number;
    /** Epoch ms until which the labyrinth pauses for draws, 0 = none. */
    pausedUntil: number;
}

export const EMPTY_LABY_DRAW_STATE: LabyDrawState = { last: null, fought: false, draws: 0, pausedUntil: 0 };

/**
 * Draws in a row once `next` is about to be fought. A fight against the same
 * hex that left its power and the squad's health as they were is one more
 * draw; any change, or another hex, starts again at 0. Without a fight since
 * the last pick the count stays as it is for the same hex.
 */
export function countDraws(state: LabyDrawState, next: LabyFightSnapshot): number {
    const last = state.last;
    if (last === null || last.target !== next.target) return 0;
    if (!state.fought) return state.draws;
    const unchanged = last.power === next.power && last.squadEgo === next.squadEgo;
    return unchanged ? state.draws + 1 : 0;
}

/** Reads a stored draw state, tolerating a missing or damaged value. */
export function parseLabyDrawState(raw: unknown): LabyDrawState {
    if (raw === null || typeof raw !== 'object') return { ...EMPTY_LABY_DRAW_STATE };
    const o = raw as Partial<LabyDrawState>;
    const last = o.last && typeof o.last === 'object'
        && typeof o.last.target === 'string'
        && typeof o.last.power === 'number'
        && typeof o.last.squadEgo === 'number'
        ? { target: o.last.target, power: o.last.power, squadEgo: o.last.squadEgo }
        : null;
    return {
        last,
        fought: o.fought === true,
        draws: typeof o.draws === 'number' && o.draws >= 0 ? o.draws : 0,
        pausedUntil: typeof o.pausedUntil === 'number' ? o.pausedUntil : 0,
    };
}

// ---------------------------------------------------------------------------
//  Planned path (#1581)
//
// Every floor has the same board, whatever the difficulty: 11 rows of widths
// 1-2-3-2-3-2-3-2-3-2-1, the start in row 1, the boss in row 11. Only the
// number of floors differs (Easy 3, Normal 4, Hard 5). The plan therefore
// runs per floor and knows nothing of the difficulty.
//
// The board is read from the page, not from `labyrinth_grid`: after a treasure
// or a shrine the game redraws the board from the answer's `grid_model`
// without assigning `labyrinth_grid` again, so the JSON is a step behind
// until the page reloads.
//
// What the page shows (measured on labyrinth.html): every hex type of the
// current floor from the start; the power only on the selectable hexes; a
// walked or skipped hex carries `completed-hex`, a walked one turns into type
// `hero`. So the plan can only weigh types. Power breaks a tie on the next
// step, the only one where it is known.
//
// The plan is a backward sum from the boss over the hexes still ahead of the
// hero, the same as HH-suckless (xnh0x, GPL-3.0); the value tables of xp,
// kisses and fists, and the one behind `treasure`, are its own. Recomputed on
// every visit, nothing is stored, so a reload or a detour changes nothing.
// ---------------------------------------------------------------------------

/** The menu choices; 'off' keeps the step-by-step choice of decideBetterOption. */
export const LABY_PATH_STRATEGIES = ['off', 'treasure', 'red', 'safe', 'xp', 'kisses'] as const;
export type LabyPathStrategy = typeof LABY_PATH_STRATEGIES[number];

/**
 * Value of a hex per strategy; a type that is missing counts 0 (the boss, the
 * hero). The numbers only matter relative to each other inside one table:
 *   treasure  every treasure the floor allows, then the hardest fights
 *   red       the most hard opponents, a treasure worth less than one of them
 *   safe      around hard opponents, treasures and shrines taken on the way
 *   xp        harder opponents give more experience, treasures nearly nothing
 *   kisses    medium and hard opponents
 */
export const LABY_PATH_VALUES: Record<Exclude<LabyPathStrategy, 'off'>, Record<string, number>> = {
    treasure: { opponent_super_easy: 1, opponent_easy: 2, opponent_medium: 3, opponent_hard: 4, treasure: 100, shrine: 0 },
    red: { opponent_super_easy: 1, opponent_easy: 1, opponent_medium: 5, opponent_hard: 25, treasure: 10, shrine: 0 },
    safe: { opponent_super_easy: 4, opponent_easy: 3, opponent_medium: 1, opponent_hard: -20, treasure: 10, shrine: 2 },
    xp: { opponent_super_easy: 10, opponent_easy: 15, opponent_medium: 20, opponent_hard: 25, treasure: 1, shrine: 0 },
    kisses: { opponent_super_easy: 1, opponent_easy: 1, opponent_medium: 10, opponent_hard: 12, treasure: 3, shrine: 0 },
};

export function isLabyPathStrategy(value: unknown): value is LabyPathStrategy {
    return typeof value === 'string' && (LABY_PATH_STRATEGIES as readonly string[]).includes(value);
}

/** One hex as the page shows it. */
export interface LabyBoardHex {
    /** The `key` of its row (1 = start, 11 = boss). */
    row: number;
    /** The number in `hex_<id>`, 1 = leftmost. */
    id: number;
    /** `opponent_*`, `treasure`, `shrine` or `hero`. */
    type: string;
    /** `completed-hex`: walked or skipped. */
    done: boolean;
    /** Carries `.clickable-hex`. */
    selectable: boolean;
    /** `data-power`, 0 where the page shows none. */
    power: number;
}

/** Type and state from the class list of a hex's `.hex-type` image. */
export function readHexTypeClasses(classList: string): { type: string; done: boolean } {
    const tokens = classList.split(/\s+/).filter((t) => t.length > 0);
    const type = tokens.find((t) => t !== 'hex-type' && t !== 'completed-hex' && t !== 'upcoming-hex') || '';
    return { type, done: tokens.includes('completed-hex') };
}

/** Row index and hex index of the hero: the hex of type hero that is not completed. */
export function findHeroPosition(board: LabyBoardHex[][]): { row: number; index: number } | null {
    for (let r = board.length - 1; r >= 0; r--) {
        const index = board[r].findIndex((h) => h.type === 'hero' && !h.done);
        if (index >= 0) return { row: r, index };
    }
    return null;
}

/**
 * The best path from the hero to the boss, hero excluded. Empty when there is
 * none to follow: no hero on the board, the hero on the last row, a row shape
 * getNextIndices does not know, or a first step the page does not offer.
 *
 * Ties: on the first step the opponent with the lower power, then the left
 * hex; further down the left hex.
 */
export function planLabyrinthPath(board: LabyBoardHex[][], values: Record<string, number>): LabyBoardHex[] {
    const hero = findHeroPosition(board);
    if (hero === null || hero.row >= board.length - 1) return [];

    const last = board.length - 1;
    const best: number[][] = board.map((row) => row.map(() => -Infinity));
    const next: number[][] = board.map((row) => row.map(() => -1));
    const worth = (h: LabyBoardHex) => (h.done ? -Infinity : (values[h.type] ?? 0));

    board[last].forEach((h, j) => { best[last][j] = worth(h); });
    for (let r = last - 1; r > hero.row; r--) {
        for (let j = 0; j < board[r].length; j++) {
            const reach = getNextIndices(j, board[r].length, board[r + 1].length);
            if (reach === undefined) return [];
            let ahead = -Infinity;
            for (const k of reach) {
                // Strictly greater: on a tie the left hex stays.
                if (k < board[r + 1].length && best[r + 1][k] > ahead) {
                    ahead = best[r + 1][k];
                    next[r][j] = k;
                }
            }
            best[r][j] = worth(board[r][j]) + ahead;
        }
    }

    const first = getNextIndices(hero.index, board[hero.row].length, board[hero.row + 1].length);
    if (first === undefined) return [];
    const candidates = first.filter((k) => k < board[hero.row + 1].length && best[hero.row + 1][k] > -Infinity);
    if (candidates.length === 0) return [];
    candidates.sort((a, b) => {
        const diff = best[hero.row + 1][b] - best[hero.row + 1][a];
        if (diff !== 0) return diff;
        const pa = board[hero.row + 1][a].power, pb = board[hero.row + 1][b].power;
        if (pa > 0 && pb > 0 && pa !== pb) return pa - pb;
        return a - b;
    });

    const path: LabyBoardHex[] = [];
    let k = candidates[0];
    for (let r = hero.row + 1; r <= last && k >= 0; r++) {
        path.push(board[r][k]);
        k = next[r][k];
    }
    if (!path[0].selectable) return [];
    return path;
}
