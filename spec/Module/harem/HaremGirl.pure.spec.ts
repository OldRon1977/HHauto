import { KKHaremGirl } from '../../../src/model/KK/KKHaremGirl';
import {
    EquipmentItem,
    findBestItem,
    isBetter,
    scoreItem,
} from "../../../src/Module/harem/HaremGirl.pure";

/**
 * Pure-function tests for the equipment scoring trio.
 *
 * The original implementation lived as three private static methods on
 * HaremGirl. They were not unit-tested at all; this spec is the first
 * coverage of the resonance-bonus and tiebreaker logic.
 */
describe("HaremGirl pure equipment helpers", () => {
    const girl = (overrides: Partial<KKHaremGirl> = {}): KKHaremGirl =>
        ({
            class: 1,
            element: "fire",
            figure: "slim",
            ...overrides,
        } as any);

    const item = (caracs: EquipmentItem["caracs"], extra: Partial<EquipmentItem> = {}): EquipmentItem => ({
        caracs,
        ...extra,
    });

    describe("scoreItem", () => {
        it("sums every stat field, treating missing keys as zero", () => {
            const result = scoreItem(item({ carac1: 10, carac2: 20, carac3: 30, damage: 5 }), girl());
            expect(result).toEqual({ caracSum: 65, resonanceMatches: 0 });
        });

        it("ignores resonance_bonuses when present as an array (game shape for no bonuses)", () => {
            const result = scoreItem(
                item({ carac1: 1, carac2: 2, carac3: 3 }, { resonance_bonuses: [] }),
                girl(),
            );
            expect(result).toEqual({ caracSum: 6, resonanceMatches: 0 });
        });

        it("counts class, element, and figure matches independently", () => {
            const result = scoreItem(
                item(
                    { carac1: 1 },
                    {
                        resonance_bonuses: {
                            class: { identifier: 1 },
                            element: { identifier: "fire" },
                            figure: { identifier: "slim" },
                        },
                    },
                ),
                girl(),
            );
            expect(result).toEqual({ caracSum: 1, resonanceMatches: 3 });
        });

        it("compares identifiers as strings (numeric girl class vs. string identifier)", () => {
            const result = scoreItem(
                item({}, { resonance_bonuses: { class: { identifier: "1" } } }),
                girl({ class: 1 }),
            );
            expect(result.resonanceMatches).toBe(1);
        });

        it("does not count partial misses", () => {
            const result = scoreItem(
                item(
                    { carac1: 1 },
                    {
                        resonance_bonuses: {
                            class: { identifier: 1 },
                            element: { identifier: "water" },
                            figure: { identifier: "curvy" },
                        },
                    },
                ),
                girl(),
            );
            expect(result.resonanceMatches).toBe(1);
        });
    });

    describe("findBestItem", () => {
        it("returns null on an empty list", () => {
            expect(findBestItem([], girl())).toBeNull();
        });

        it("picks the highest caracSum first", () => {
            const a = item({ carac1: 100 });
            const b = item({ carac1: 200 });
            const c = item({ carac1: 50 });
            expect(findBestItem([a, b, c], girl())).toBe(b);
        });

        it("breaks caracSum ties with resonance matches", () => {
            const noResonance = item({ carac1: 100 }, { resonance_bonuses: [] });
            const withResonance = item(
                { carac1: 100 },
                {
                    resonance_bonuses: {
                        class: { identifier: 1 },
                    },
                },
            );
            expect(findBestItem([noResonance, withResonance], girl())).toBe(withResonance);
        });

        it("breaks resonance ties with carac1+carac2+carac3 (excluding damage/defense/ego)", () => {
            // Same caracSum, no resonance, but different carac1/2/3 split.
            const heavyArmor = item({ carac1: 10, carac2: 10, carac3: 10, damage: 70 }); // 30 carac, sum 100
            const balancedItem = item({ carac1: 30, carac2: 35, carac3: 35 }); // 100 carac, sum 100
            expect(findBestItem([heavyArmor, balancedItem], girl())).toBe(balancedItem);
        });

        it("does not mutate the input list", () => {
            const a = item({ carac1: 50 });
            const b = item({ carac1: 100 });
            const list = [a, b];
            findBestItem(list, girl());
            expect(list).toEqual([a, b]);
        });
    });

    describe("isBetter", () => {
        it("returns true when nothing is currently equipped", () => {
            expect(isBetter(item({ carac1: 1 }), null, girl())).toBe(true);
            expect(isBetter(item({ carac1: 1 }), undefined, girl())).toBe(true);
        });

        it("returns true when the current item has no caracs", () => {
            expect(isBetter(item({ carac1: 1 }), { caracs: undefined as any }, girl())).toBe(true);
        });

        it("returns true when caracSum strictly improves", () => {
            const equipped = item({ carac1: 10 });
            const candidate = item({ carac1: 11 });
            expect(isBetter(candidate, equipped, girl())).toBe(true);
        });

        it("returns false when caracSum strictly worsens", () => {
            const equipped = item({ carac1: 100 });
            const candidate = item({ carac1: 99 });
            expect(isBetter(candidate, equipped, girl())).toBe(false);
        });

        it("returns true on caracSum tie when resonance improves", () => {
            const equipped = item({ carac1: 50 }, { resonance_bonuses: [] });
            const candidate = item(
                { carac1: 50 },
                { resonance_bonuses: { class: { identifier: 1 } } },
            );
            expect(isBetter(candidate, equipped, girl())).toBe(true);
        });

        it("returns false on full tie (caracSum and resonance)", () => {
            const equipped = item({ carac1: 50 }, { resonance_bonuses: [] });
            const candidate = item({ carac1: 50 }, { resonance_bonuses: [] });
            expect(isBetter(candidate, equipped, girl())).toBe(false);
        });
    });
});
