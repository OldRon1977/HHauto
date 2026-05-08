import {
    FindBetterState,
    LabyrinthOpponentLite,
    buildPathsFromMatrix,
    decideBetterOption,
    filterPathsWithTreasure,
    getNextIndices,
    sortPathsByDifficulty,
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