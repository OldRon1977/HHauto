import {
    countDraws,
    EMPTY_LABY_DRAW_STATE,
    LABY_DRAW_LIMIT,
    LABY_DRAW_PAUSE_SECONDS,
    LabyDrawState,
    parseLabyDrawState,
    FindBetterState,
    LabyrinthOpponentLite,
    buildPathsFromMatrix,
    decideBetterOption,
    filterPathsWithTreasure,
    getNextIndices,
    sortPathsByDifficulty,
    findHeroPosition,
    isLabyPathStrategy,
    LABY_PATH_VALUES,
    LabyBoardHex,
    planLabyrinthPath,
    readHexTypeClasses,
} from "../../src/Module/Labyrinth.pure";

/**
 * Pure-function tests for the labyrinth path pipeline and the
 * findBetter selector. The path pipeline (build / filter / sort) is
 * tested with minimal records that carry only the two fields the
 * pipeline reads (`opponentDifficulty`, `isTreasure`); the option
 * ranker is tested with the full `LabyrinthOpponentLite` shape.
 *
 * Adjacency rules from the original code (preserved bit by bit):
 *   - nextLen === 1 (boss row): every cell -> [0]
 *   - currLen 1 -> nextLen 2: 0 -> [0, 1]
 *   - currLen 2 -> nextLen 3: 0 -> [0, 1], 1 -> [1, 2]
 *   - currLen 3 -> nextLen 2: 0 -> [0], 1 -> [0, 1], 2 -> [1]
 *   - any other shape: undefined
 */

type PathCell = { id: string; opponentDifficulty: number; isTreasure: boolean };

const cell = (
    id: string,
    overrides: Partial<PathCell> = {},
): PathCell => ({
    id,
    opponentDifficulty: 0,
    isTreasure: false,
    ...overrides,
});

describe("getNextIndices", () => {
    it("collapses to the single boss cell when nextLen === 1", () => {
        expect(getNextIndices(0, 2, 1)).toEqual([0]);
        expect(getNextIndices(1, 2, 1)).toEqual([0]);
        expect(getNextIndices(2, 3, 1)).toEqual([0]);
    });

    it("expands the start row (1) into both first-row cells (2)", () => {
        expect(getNextIndices(0, 1, 2)).toEqual([0, 1]);
    });

    it("expands a 2-row into a 3-row using the 0->[0,1], 1->[1,2] rule", () => {
        expect(getNextIndices(0, 2, 3)).toEqual([0, 1]);
        expect(getNextIndices(1, 2, 3)).toEqual([1, 2]);
    });

    it("contracts a 3-row into a 2-row using the 0->[0], 1->[0,1], 2->[1] rule", () => {
        expect(getNextIndices(0, 3, 2)).toEqual([0]);
        expect(getNextIndices(1, 3, 2)).toEqual([0, 1]);
        expect(getNextIndices(2, 3, 2)).toEqual([1]);
    });

    it("returns undefined for unknown shapes (matches the original fallback)", () => {
        expect(getNextIndices(0, 2, 2)).toBeUndefined();
        expect(getNextIndices(0, 4, 5)).toBeUndefined();
    });
});

describe("buildPathsFromMatrix", () => {
    it("returns no paths for an empty matrix", () => {
        expect(buildPathsFromMatrix([])).toEqual([]);
    });

    it("returns a single path for a one-row matrix (also the boss row)", () => {
        const a = cell("A");
        const paths = buildPathsFromMatrix([[a]]);
        expect(paths).toEqual([[a]]);
    });

    it("walks a 1-2-1 matrix and produces both branches", () => {
        const start = cell("S");
        const left = cell("L");
        const right = cell("R");
        const boss = cell("B");
        const paths = buildPathsFromMatrix([[start], [left, right], [boss]]);
        expect(paths.map((p) => p.map((c) => c.id))).toEqual([
            ["S", "L", "B"],
            ["S", "R", "B"],
        ]);
    });

    it("walks a 2-3-2-1 matrix preserving adjacency rules", () => {
        // 2 cells -> 3 cells: 0 -> [0,1], 1 -> [1,2]
        // 3 cells -> 2 cells: 0 -> [0], 1 -> [0,1], 2 -> [1]
        // 2 cells -> 1 cell:  every cell -> [0]
        const r0 = [cell("a"), cell("b")];
        const r1 = [cell("c"), cell("d"), cell("e")];
        const r2 = [cell("f"), cell("g")];
        const boss = cell("B");
        const paths = buildPathsFromMatrix([r0, r1, r2, [boss]]);
        // start a -> {c, d}; from c -> f; from d -> {f, g}
        // start b -> {d, e}; from d -> {f, g}; from e -> g
        const ids = paths.map((p) => p.map((c) => c.id).join(""));
        expect(ids).toEqual([
            "acfB",
            "adfB",
            "adgB",
            "bdfB",
            "bdgB",
            "begB",
        ]);
    });

    it("skips empty leading rows and starts from the first populated row", () => {
        const a = cell("A");
        const b = cell("B");
        const paths = buildPathsFromMatrix([[], [], [a], [b]]);
        expect(paths.map((p) => p.map((c) => c.id))).toEqual([["A", "B"]]);
    });
});

describe("filterPathsWithTreasure", () => {
    it("returns an empty list when no path has any treasure", () => {
        const paths = [
            [cell("a"), cell("b")],
            [cell("c"), cell("d")],
        ];
        expect(filterPathsWithTreasure(paths)).toEqual([]);
    });

    it("keeps only paths that contain at least one treasure", () => {
        const t = cell("t", { isTreasure: true });
        const a = cell("a");
        const b = cell("b");
        const paths = [
            [a, b],
            [a, t],
            [t, b],
        ];
        expect(filterPathsWithTreasure(paths)).toEqual([
            [a, t],
            [t, b],
        ]);
    });

    it("keeps paths that have multiple treasures", () => {
        const t1 = cell("t1", { isTreasure: true });
        const t2 = cell("t2", { isTreasure: true });
        const paths = [[t1, t2]];
        expect(filterPathsWithTreasure(paths)).toEqual([[t1, t2]]);
    });
});

describe("sortPathsByDifficulty", () => {
    it("sorts paths ascending by the sum of opponentDifficulty", () => {
        const easy = [cell("e1", { opponentDifficulty: 1 }), cell("e2", { opponentDifficulty: 1 })];
        const mid = [cell("m1", { opponentDifficulty: 2 }), cell("m2", { opponentDifficulty: 2 })];
        const hard = [cell("h1", { opponentDifficulty: 3 }), cell("h2", { opponentDifficulty: 3 })];
        const paths = [hard, easy, mid];
        sortPathsByDifficulty(paths);
        expect(paths.map((p) => p[0].id)).toEqual(["e1", "m1", "h1"]);
    });

    it("sorts a single-cell-per-path matrix by the lone difficulty value", () => {
        const easy = [cell("e", { opponentDifficulty: 1 })];
        const hard = [cell("h", { opponentDifficulty: 5 })];
        const mid = [cell("m", { opponentDifficulty: 3 })];
        const paths = [hard, mid, easy];
        sortPathsByDifficulty(paths);
        expect(paths.map((p) => p[0].id)).toEqual(["e", "m", "h"]);
    });
});

describe("decideBetterOption", () => {
    const opt = (
        overrides: Partial<LabyrinthOpponentLite> = {},
    ): LabyrinthOpponentLite => ({
        opponentDifficulty: 0,
        isTreasure: false,
        isShrine: false,
        isNext: true,
        isOpponent: true,
        power: 0,
        hasButton: true,
        ...overrides,
    });

    const buildState = (
        overrides: Partial<FindBetterState<LabyrinthOpponentLite>> = {},
    ): FindBetterState<LabyrinthOpponentLite> => ({
        options: [],
        chooseMoreReward: false,
        haveGirlWounded: false,
        floor: 1,
        ...overrides,
    });

    it("returns null on an empty options list", () => {
        expect(decideBetterOption(buildState())).toBeNull();
    });

    it("falls back to the FIRST original option when no eligible option survives the filter", () => {
        // Only shrines on floor 1 -> all filtered out; no eligible
        // option remains; first-original fallback kicks in.
        const a = opt({ isShrine: true, hasButton: false });
        const b = opt({ isShrine: true, hasButton: false });
        const chosen = decideBetterOption(buildState({ options: [a, b] }));
        expect(chosen).toBe(a);
    });

    it("ignores options with hasButton=false and falls back to firstOption", () => {
        const a = opt({ hasButton: false });
        expect(decideBetterOption(buildState({ options: [a] }))).toBe(a);
    });

    it("ignores options with isNext=false and falls back to firstOption", () => {
        const a = opt({ isNext: false });
        expect(decideBetterOption(buildState({ options: [a] }))).toBe(a);
    });

    it("drops shrines on floor < 3 even with wounded girls", () => {
        const shrine = opt({ isShrine: true, hasButton: false });
        const enemy = opt({ isOpponent: true, power: 50 });
        const chosen = decideBetterOption(
            buildState({
                options: [shrine, enemy],
                haveGirlWounded: true,
                floor: 2,
            }),
        );
        expect(chosen).toBe(enemy);
    });

    it("drops shrines on floor >= 3 when no girl is wounded", () => {
        const shrine = opt({ isShrine: true, hasButton: false });
        const enemy = opt({ isOpponent: true, power: 50 });
        const chosen = decideBetterOption(
            buildState({
                options: [shrine, enemy],
                haveGirlWounded: false,
                floor: 5,
            }),
        );
        expect(chosen).toBe(enemy);
    });

    it("keeps only shrines on floor >= 3 when at least one girl is wounded", () => {
        const shrine = opt({ isShrine: true, isOpponent: false });
        const enemy = opt({ isOpponent: true, power: 50 });
        const chosen = decideBetterOption(
            buildState({
                options: [enemy, shrine],
                haveGirlWounded: true,
                floor: 5,
            }),
        );
        expect(chosen).toBe(shrine);
    });

    it("keeps only treasures when at least one is present", () => {
        const treasure = opt({ isTreasure: true, isOpponent: false });
        const enemy = opt({ isOpponent: true, power: 50 });
        const chosen = decideBetterOption(
            buildState({ options: [enemy, treasure] }),
        );
        expect(chosen).toBe(treasure);
    });

    it("keeps only easy opponents on floor < 3 without chooseMoreReward", () => {
        const easy = opt({ opponentDifficulty: 1, power: 100 });
        const medium = opt({ opponentDifficulty: 2, power: 50 });
        const chosen = decideBetterOption(
            buildState({
                options: [medium, easy],
                chooseMoreReward: false,
                floor: 1,
            }),
        );
        // medium drops out; easy is the only survivor
        expect(chosen).toBe(easy);
    });

    it("chooseMoreReward picks higher difficulty over lower", () => {
        const easy = opt({ opponentDifficulty: 1, power: 50 });
        const hard = opt({ opponentDifficulty: 3, power: 100 });
        const chosen = decideBetterOption(
            buildState({
                options: [easy, hard],
                chooseMoreReward: true,
                floor: 5,
            }),
        );
        expect(chosen).toBe(hard);
    });

    it("chooseMoreReward picks lower power within tied difficulty", () => {
        const tougher = opt({ opponentDifficulty: 2, power: 200 });
        const weaker = opt({ opponentDifficulty: 2, power: 100 });
        const chosen = decideBetterOption(
            buildState({
                options: [tougher, weaker],
                chooseMoreReward: true,
                floor: 5,
            }),
        );
        expect(chosen).toBe(weaker);
    });

    it("default branch picks non-opponent over opponent", () => {
        const enemy = opt({ isOpponent: true, power: 50 });
        const npc = opt({ isOpponent: false, power: 200 });
        const chosen = decideBetterOption(
            buildState({
                options: [enemy, npc],
                chooseMoreReward: false,
                floor: 5,
            }),
        );
        expect(chosen).toBe(npc);
    });

    it("default branch picks lower power between two opponents", () => {
        const tougher = opt({ isOpponent: true, power: 200 });
        const weaker = opt({ isOpponent: true, power: 50 });
        const chosen = decideBetterOption(
            buildState({
                options: [tougher, weaker],
                chooseMoreReward: false,
                floor: 5,
            }),
        );
        expect(chosen).toBe(weaker);
    });
});
describe("countDraws (issue #1904)", () => {
    const boss = { target: "2/row_11/1", power: 16159915, squadEgo: 700 };
    const state = (over: Partial<LabyDrawState>): LabyDrawState => ({ ...EMPTY_LABY_DRAW_STATE, ...over });

    it("starts at 0 for a first pick", () => {
        expect(countDraws(state({}), boss)).toBe(0);
    });

    it("counts a fought draw: same hex, same power, same squad health", () => {
        expect(countDraws(state({ last: boss, fought: true, draws: 0 }), { ...boss })).toBe(1);
        expect(countDraws(state({ last: boss, fought: true, draws: 2 }), { ...boss })).toBe(3);
    });

    it("reads a change of the opponent's power as progress (a win)", () => {
        expect(countDraws(state({ last: boss, fought: true, draws: 2 }), { ...boss, power: 15000000 })).toBe(0);
    });

    it("reads a change of the squad's health as a loss", () => {
        expect(countDraws(state({ last: boss, fought: true, draws: 2 }), { ...boss, squadEgo: 640 })).toBe(0);
    });

    it("starts again for another hex", () => {
        expect(countDraws(state({ last: boss, fought: true, draws: 2 }), { ...boss, target: "3/row_2/1" })).toBe(0);
    });

    it("keeps the count when no fight happened since the last pick", () => {
        expect(countDraws(state({ last: boss, fought: false, draws: 2 }), { ...boss })).toBe(2);
    });

    it("pauses on the third draw in a row", () => {
        let s = state({});
        let draws = 0;
        for (let fight = 0; fight < 4 && draws < LABY_DRAW_LIMIT; fight++) {
            draws = countDraws(s, boss);
            s = state({ last: boss, fought: true, draws });
        }
        expect(draws).toBe(LABY_DRAW_LIMIT);
        expect(LABY_DRAW_LIMIT).toBe(3);
        expect(LABY_DRAW_PAUSE_SECONDS).toBe(3600);
    });
});

describe("parseLabyDrawState", () => {
    it("falls back to the empty state for missing or damaged values", () => {
        expect(parseLabyDrawState(null)).toEqual(EMPTY_LABY_DRAW_STATE);
        expect(parseLabyDrawState("x")).toEqual(EMPTY_LABY_DRAW_STATE);
        expect(parseLabyDrawState({ last: { target: 1 }, draws: -1 })).toEqual(EMPTY_LABY_DRAW_STATE);
    });

    it("keeps a valid state", () => {
        const s = { last: { target: "1/row_2/1", power: 5, squadEgo: 700 }, fought: true, draws: 2, pausedUntil: 9 };
        expect(parseLabyDrawState(JSON.parse(JSON.stringify(s)))).toEqual(s);
    });
});

// ---------------------------------------------------------------------------
//  Planned path (#1581). Boards as labyrinth.html showed them: `type`,
//  `/done` for completed-hex, `/<power>` for a selectable hex.
// ---------------------------------------------------------------------------

/** A fresh Easy floor 1, nothing walked yet. */
const FRESH_FLOOR = [
    ['hero'],
    ['o:super_easy/468338', 'o:super_easy/602046'],
    ['o:hard', 'treasure', 'o:easy'],
    ['o:easy', 'o:medium'],
    ['o:easy', 'shrine', 'o:hard'],
    ['shrine', 'o:medium'],
    ['o:easy', 'treasure', 'o:easy'],
    ['o:medium', 'o:easy'],
    ['o:easy', 'o:medium', 'shrine'],
    ['o:medium', 'treasure'],
    ['o:boss'],
];

/** A Hard floor 5 with only the boss left. */
const BOSS_LEFT = [
    ['hero/done'],
    ['o:hard/done', 'hero/done'],
    ['o:hard/done', 'o:medium/done', 'hero/done'],
    ['o:medium/done', 'hero/done'],
    ['shrine/done', 'hero/done', 'o:hard/done'],
    ['hero/done', 'o:hard/done'],
    ['o:hard/done', 'hero/done', 'o:hard/done'],
    ['hero/done', 'o:hard/done'],
    ['o:hard/done', 'hero/done', 'o:hard/done'],
    ['hero', 'o:hard/done'],
    ['o:boss/18851003'],
];

const board = (rows: string[][]): LabyBoardHex[][] => rows.map((row, r) => row.map((spec, i) => {
    const [name, ...flags] = spec.split('/');
    const power = Number(flags.find((f) => /^\d+$/.test(f)) || 0);
    return {
        row: r + 1,
        id: i + 1,
        type: name.replace('o:', 'opponent_'),
        done: flags.includes('done'),
        selectable: power > 0,
        power,
    };
}));

const ids = (path: LabyBoardHex[]) => path.map((h) => `${h.row}/${h.id}`);

describe("readHexTypeClasses", () => {
    it("reads the type and completed-hex from the class list", () => {
        expect(readHexTypeClasses('hex-type opponent_easy  upcoming-hex')).toEqual({ type: 'opponent_easy', done: false });
        expect(readHexTypeClasses('hex-type opponent_hard completed-hex upcoming-hex')).toEqual({ type: 'opponent_hard', done: true });
        expect(readHexTypeClasses('hex-type hero completed-hex ')).toEqual({ type: 'hero', done: true });
        expect(readHexTypeClasses('')).toEqual({ type: '', done: false });
    });
});

describe("findHeroPosition", () => {
    it("is the hero hex without completed-hex", () => {
        expect(findHeroPosition(board(FRESH_FLOOR))).toEqual({ row: 0, index: 0 });
        expect(findHeroPosition(board(BOSS_LEFT))).toEqual({ row: 9, index: 0 });
    });

    it("is null without a hero", () => {
        expect(findHeroPosition(board([['o:easy'], ['o:boss']]))).toBeNull();
    });
});

describe("planLabyrinthPath", () => {
    it("takes all three treasures of the fresh floor with the treasure table", () => {
        const path = planLabyrinthPath(board(FRESH_FLOOR), LABY_PATH_VALUES.treasure);
        expect(ids(path)).toEqual(['2/1', '3/2', '4/2', '5/3', '6/2', '7/2', '8/1', '9/2', '10/2', '11/1']);
        expect(path.filter((h) => h.type === 'treasure')).toHaveLength(3);
    });

    it("breaks a tie on the first step by the lower power", () => {
        const swapped = FRESH_FLOOR.map((r) => r.slice());
        swapped[1] = ['o:super_easy/602046', 'o:super_easy/468338'];
        expect(ids(planLabyrinthPath(board(swapped), LABY_PATH_VALUES.treasure))[0]).toBe('2/2');
    });

    it("goes around hard opponents with the safe table", () => {
        const path = planLabyrinthPath(board(FRESH_FLOOR), LABY_PATH_VALUES.safe);
        expect(path.some((h) => h.type === 'opponent_hard')).toBe(false);
        expect(path[path.length - 1].type).toBe('opponent_boss');
    });

    it("takes a hard opponent with the red table", () => {
        const path = planLabyrinthPath(board(FRESH_FLOOR), LABY_PATH_VALUES.red);
        expect(path.some((h) => h.type === 'opponent_hard')).toBe(true);
    });

    it("plans from the hero, never over walked or skipped hexes", () => {
        // Hero went 2/2 -> 3/3 -> 4/2 and left the treasure of row 3 behind.
        const rows = FRESH_FLOOR.map((r) => r.map((c) => c.replace(/\/\d+$/, '')));
        rows[0] = ['hero/done'];
        rows[1] = ['o:super_easy/done', 'hero/done'];
        rows[2] = ['o:hard/done', 'treasure/done', 'hero/done'];
        rows[3] = ['o:easy/done', 'hero'];
        rows[4] = ['o:easy', 'shrine/1', 'o:hard/2'];
        const path = planLabyrinthPath(board(rows), LABY_PATH_VALUES.treasure);
        expect(path[0].row).toBe(5);
        expect(['5/2', '5/3']).toContain(ids(path)[0]);
        expect(path.some((h) => h.done)).toBe(false);
        expect(path.filter((h) => h.type === 'treasure')).toHaveLength(2);
    });

    it("leaves only the boss when the boss is next", () => {
        expect(ids(planLabyrinthPath(board(BOSS_LEFT), LABY_PATH_VALUES.xp))).toEqual(['11/1']);
    });

    it("plans nothing the page does not offer", () => {
        const notClickable = FRESH_FLOOR.map((r) => r.map((c) => c.replace(/\/\d+$/, '')));
        expect(planLabyrinthPath(board(notClickable), LABY_PATH_VALUES.treasure)).toEqual([]);
        expect(planLabyrinthPath(board([['o:easy/done'], ['hero']]), LABY_PATH_VALUES.treasure)).toEqual([]);
        expect(planLabyrinthPath(board([['hero'], ['o:easy/5', 'o:easy/6', 'o:easy/7', 'o:easy/8'], ['o:boss']]),
            LABY_PATH_VALUES.treasure)).toEqual([]);
    });
});

describe("isLabyPathStrategy", () => {
    it("accepts the menu values only", () => {
        expect(isLabyPathStrategy('off')).toBe(true);
        expect(isLabyPathStrategy('treasure')).toBe(true);
        expect(isLabyPathStrategy('Treasure')).toBe(false);
        expect(isLabyPathStrategy(null)).toBe(false);
    });
});
