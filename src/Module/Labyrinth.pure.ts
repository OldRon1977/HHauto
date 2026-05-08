// Labyrinth.pure.ts -- Pure decision logic for the labyrinth path pipeline
// and the "find better option" selector.
//
// Extracted from Labyrinth.createPathFromMatrix,
// Labyrinth.filterPathWithNoTreasue, Labyrinth.sortPathsByDifficulty,
// and Labyrinth.findBetter so the path-building DFS, the treasure
// filter, the difficulty sort, and the option ranker can be unit-
// tested without DOM access, jQuery, globals, or storage.
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
 * Reproduce the inner `getNextIndices` closure of
 * createPathFromMatrix bit by bit. Returns the indices in the next
 * row that the cell at (currIdx, currLen) can reach.
 *
 * Adjacency rules from the original code:
 *   - nextLen === 1 (boss row): every cell maps to [0]
 *   - currLen 1 -> nextLen 2: 0 -> [0, 1]
 *   - currLen 2 -> nextLen 3: 0 -> [0, 1], 1 -> [1, 2]
 *   - currLen 3 -> nextLen 2: 0 -> [0], 1 -> [0, 1], 2 -> [1]
 *   - any other shape returns undefined (matches the original
 *     fallback where the function exits without a return value)
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
 * Reproduce createPathFromMatrix bit by bit. DFS over a
 * row-of-cells matrix using the adjacency rules in
 * getNextIndices.
 *
 * Empty leading rows are skipped (`while !matrix[startRow] ||
 * length === 0`) -- this preserves the original quirk that the
 * matrix may carry empty rows ahead of the first real row.
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
            // Original fallback path: function returns undefined and
            // the for-of below would throw. The impure adapter logged
            // an error before the (commented-out) fallback. Pure
            // version keeps the same shape: no further descent on an
            // unrecognised row pair.
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
 * Reproduce filterPathWithNoTreasue (typo preserved at the adapter
 * boundary). Keep only paths that contain at least one treasure cell.
 */
export function filterPathsWithTreasure<T extends LabyrinthPathOpponent>(
    paths: T[][],
): T[][] {
    return paths.filter((path) =>
        path.filter((opponent) => opponent.isTreasure).length > 0,
    );
}

/**
 * Reproduce sortPathsByDifficulty. Sort paths ascending by the sum
 * of their opponent difficulties. The original used a mutating
 * .sort() and returned the same array; the pure version mirrors that
 * (callers must accept that the input array is sorted in place).
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
 * Reproduce Labyrinth.findBetter bit by bit. Filter cascade:
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
        && options.filter((option) => option.opponentDifficulty == 1).length > 0
    ) {
        options = options.filter((option) => option.opponentDifficulty == 1);
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
                    chosenOption.opponentDifficulty == option.opponentDifficulty
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