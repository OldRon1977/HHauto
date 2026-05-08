import {
    CollectTriggerState,
    PuzzlePieceLite,
    SelectClaimableState,
    decideCollectTrigger,
    selectClaimablePieces,
} from "../../../src/Module/Events/LivelyScene.pure";

/**
 * Pure-function tests for the Lively Scene event.
 *
 * decideCollectTrigger covers the three-branch OR cascade in
 * LivelyScene.parse (autoCollect / manualCollectAll /
 * end-of-event sweep). selectClaimablePieces covers the puzzle-piece
 * filter in LivelyScene.parseClaimableRewards (unlock-and-not-claimed
 * gate plus the per-piece eligibility cascade).
 *
 * Threshold contracts preserved from the original code:
 *   - end-of-event branch is strict (<): remainingTime exactly equal
 *     to limitBeforeEnd does NOT trigger autoCollectAll
 *   - && binds tighter than || in both decisions
 */
describe("decideCollectTrigger", () => {
    const buildState = (
        overrides: Partial<CollectTriggerState> = {},
    ): CollectTriggerState => ({
        autoCollect: false,
        manualCollectAll: false,
        autoCollectAll: false,
        remainingTime: 9999,
        limitBeforeEnd: 1000,
        ...overrides,
    });

    it("returns false when every flag is off", () => {
        expect(decideCollectTrigger(buildState())).toBe(false);
    });

    it("returns true when only autoCollect is on", () => {
        expect(decideCollectTrigger(buildState({ autoCollect: true }))).toBe(true);
    });

    it("returns true when only manualCollectAll is on", () => {
        expect(
            decideCollectTrigger(buildState({ manualCollectAll: true })),
        ).toBe(true);
    });

    it("returns true when autoCollectAll is on AND remainingTime is below the limit", () => {
        expect(
            decideCollectTrigger(
                buildState({
                    autoCollectAll: true,
                    remainingTime: 500,
                    limitBeforeEnd: 1000,
                }),
            ),
        ).toBe(true);
    });

    it("returns false when remainingTime exactly equals the limit (strict <)", () => {
        expect(
            decideCollectTrigger(
                buildState({
                    autoCollectAll: true,
                    remainingTime: 1000,
                    limitBeforeEnd: 1000,
                }),
            ),
        ).toBe(false);
    });

    it("returns false when autoCollectAll is on but the event is far from over", () => {
        expect(
            decideCollectTrigger(
                buildState({
                    autoCollectAll: true,
                    remainingTime: 9999,
                    limitBeforeEnd: 1000,
                }),
            ),
        ).toBe(false);
    });
});

type TestPiece = PuzzlePieceLite & { id: string };

describe("selectClaimablePieces", () => {
    const piece = (
        id: string,
        overrides: Partial<TestPiece> = {},
    ): TestPiece => ({
        id,
        reward_unlocked: true,
        reward_claimed: false,
        rewardType: "money",
        ...overrides,
    });

    const buildState = (
        overrides: Partial<SelectClaimableState> = {},
    ): SelectClaimableState => ({
        rewardsToCollect: [],
        needToCollect: false,
        needToCollectAll: false,
        manualCollectAll: false,
        ...overrides,
    });

    it("returns an empty list when the input is empty", () => {
        expect(selectClaimablePieces<TestPiece>([], buildState())).toEqual([]);
    });

    it("drops every locked piece regardless of the cascade flags", () => {
        const pieces = [
            piece("a", { reward_unlocked: false }),
            piece("b", { reward_unlocked: false }),
        ];
        expect(
            selectClaimablePieces(
                pieces,
                buildState({ manualCollectAll: true }),
            ),
        ).toEqual([]);
    });

    it("drops every already-claimed piece regardless of the cascade flags", () => {
        const pieces = [
            piece("a", { reward_claimed: true }),
            piece("b", { reward_claimed: true }),
        ];
        expect(
            selectClaimablePieces(
                pieces,
                buildState({ manualCollectAll: true }),
            ),
        ).toEqual([]);
    });

    it("returns nothing when no eligibility flag is set, even with rewardsToCollect populated", () => {
        const pieces = [piece("a", { rewardType: "money" })];
        expect(
            selectClaimablePieces(
                pieces,
                buildState({
                    rewardsToCollect: ["money"],
                    needToCollect: false,
                }),
            ),
        ).toEqual([]);
    });

    it("keeps only pieces whose rewardType is on the allowlist when needToCollect is on", () => {
        const pieces = [
            piece("money", { rewardType: "money" }),
            piece("xp", { rewardType: "xp" }),
            piece("shards", { rewardType: "girl_shards" }),
        ];
        const result = selectClaimablePieces(
            pieces,
            buildState({
                rewardsToCollect: ["money", "girl_shards"],
                needToCollect: true,
            }),
        );
        expect(result.map((p) => p.id)).toEqual(["money", "shards"]);
    });

    it("manualCollectAll keeps every unlocked-and-unclaimed piece (allowlist ignored)", () => {
        const pieces = [
            piece("money", { rewardType: "money" }),
            piece("xp", { rewardType: "xp" }),
            piece("locked", { reward_unlocked: false }),
            piece("done", { reward_claimed: true }),
        ];
        const result = selectClaimablePieces(
            pieces,
            buildState({ manualCollectAll: true }),
        );
        expect(result.map((p) => p.id)).toEqual(["money", "xp"]);
    });

    it("needToCollectAll behaves like manualCollectAll for the eligibility cascade", () => {
        const pieces = [
            piece("money", { rewardType: "money" }),
            piece("xp", { rewardType: "xp" }),
        ];
        const result = selectClaimablePieces(
            pieces,
            buildState({ needToCollectAll: true }),
        );
        expect(result.map((p) => p.id)).toEqual(["money", "xp"]);
    });
});