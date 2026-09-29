import {
    GIRL_GEAR_MAX_LEVEL,
    type RawGirlArmor,
    countMaterialStock,
    decideNextLevelUp,
    girlUpgradePageUrl,
    parseRequirement,
    pickGirlUpgradeTargets,
    pickUpgradeTargets,
    summariseNoTargets,
} from '../../src/Service/EquipmentUpgradeService';
import { ArmorItem, MYTHIC_MAX_LEVEL } from '../../src/Service/EquipmentOptimizerService';
import type { PlayerClass } from '../../src/Service/TeamScoringService';

const KNOW_HOW: PlayerClass = 3;
let nextId = 1;
beforeEach(() => { nextId = 1; });

function item(opts: {
    rarity: string;
    level: number;
    slot?: number;
    equipped?: boolean;
    classId?: string;
    themeId?: string;
    name?: string;
}): ArmorItem {
    return {
        id_member_armor: nextId++,
        id_member_armor_equipped: opts.equipped ? nextId++ : null,
        level: opts.level,
        slot: opts.slot ?? 1,
        rarity: opts.rarity,
        skin: 'TEST1',
        name: opts.name ?? `${opts.rarity} item`,
        caracs: { carac1: 100, carac2: 100, carac3: 100, endurance: 100, chance: 100 },
        classResonance: opts.classId === undefined ? null
            : { identifier: opts.classId, resonance: 'damage', bonus: 0.1 * opts.level },
        themeResonance: opts.themeId === undefined ? null
            : { identifier: opts.themeId, resonance: 'defense', bonus: 0.1 * opts.level },
        equipped: opts.equipped === true,
    };
}

describe('pickUpgradeTargets', () => {
    it('takes only worn mythics that are below the cap', () => {
        const wornYoung = item({ rarity: 'mythic', level: 3, equipped: true, slot: 1, classId: '3' });
        const wornCapped = item({ rarity: 'mythic', level: MYTHIC_MAX_LEVEL, equipped: true, slot: 2, classId: '3' });
        const benchYoung = item({ rarity: 'mythic', level: 3, slot: 3, classId: '3' });
        const wornLegendary = item({ rarity: 'legendary', level: 600, equipped: true, slot: 4 });

        const targets = pickUpgradeTargets(
            [wornYoung, wornCapped, benchYoung, wornLegendary], KNOW_HOW, 'sun');
        expect(targets.map(t => t.id_member_armor)).toEqual([wornYoung.id_member_armor]);
    });

    // Material is scarce -- 1,555 points for one item -- so it goes where it
    // grows the most resonance.
    it('puts the best-matching item first', () => {
        const bare = item({ rarity: 'mythic', level: 5, equipped: true, slot: 1, classId: '1', themeId: 'fire', name: 'bare' });
        const both = item({ rarity: 'mythic', level: 5, equipped: true, slot: 2, classId: '3', themeId: 'sun', name: 'both' });
        const classOnly = item({ rarity: 'mythic', level: 5, equipped: true, slot: 3, classId: '3', themeId: 'fire', name: 'class' });

        const targets = pickUpgradeTargets([bare, both, classOnly], KNOW_HOW, 'sun');
        expect(targets.map(t => t.name)).toEqual(['both', 'class', 'bare']);
        expect(targets.map(t => t.tier)).toEqual([1, 2, 4]);
    });

    // Upgrading is about the items the player already wears, and those are
    // known without a team. A missing theme may only coarsen the order.
    it('still returns every worn mythic when no team theme is known', () => {
        const both = item({ rarity: 'mythic', level: 5, equipped: true, slot: 1, classId: '3', themeId: 'sun', name: 'both' });
        const themeOnly = item({ rarity: 'mythic', level: 5, equipped: true, slot: 2, classId: '1', themeId: 'sun', name: 'theme' });
        const classOnly = item({ rarity: 'mythic', level: 5, equipped: true, slot: 3, classId: '3', themeId: 'fire', name: 'class' });

        const targets = pickUpgradeTargets([both, themeOnly, classOnly], KNOW_HOW, null);

        // Without a theme the scale collapses to "matches my class" and
        // "does not"; nothing claims a theme match it cannot know.
        expect(targets.map(t => t.name)).toEqual(['both', 'class', 'theme']);
        expect(targets.map(t => t.tier)).toEqual([2, 2, 4]);
    });

    it('judges the tier by what the item will be, not what it is', () => {
        // A level-1 mythic is tier 5 today but tier 1 once levelled, and
        // levelling it is the whole point.
        const young = item({ rarity: 'mythic', level: 1, equipped: true, classId: '3', themeId: 'sun' });
        expect(pickUpgradeTargets([young], KNOW_HOW, 'sun')[0].tier).toBe(1);
    });
});

// upgradePageUrl: the test that stood here compared the built URL against a
// copy of the same string. The bug it documented -- the upgrade page wants a
// worn item under id_member_item_equipped, and bounced back to the market
// when sent the inventory parameter -- is a claim about the page, so it is
// checked in scripts/live-check instead (spec triage 2026-08).

describe('summariseNoTargets', () => {
    // An empty target list has three causes and the popup used to name only
    // one of them, telling a player wearing no mythic at all that every mythic
    // they wear is at the cap.
    it('separates an account that owns no mythic at all', () => {
        const worn = [
            item({ rarity: 'legendary', level: 68, equipped: true, slot: 1 }),
            item({ rarity: 'epic', level: 61, equipped: true, slot: 2 }),
        ];

        expect(summariseNoTargets(worn)).toEqual({
            reason: 'no-mythic-owned', inInventory: 0, wornMythics: 0,
        });
    });

    it('separates mythics that are owned but not worn', () => {
        const items = [
            item({ rarity: 'legendary', level: 68, equipped: true, slot: 1 }),
            item({ rarity: 'mythic', level: 4, slot: 2 }),
            item({ rarity: 'mythic', level: MYTHIC_MAX_LEVEL, slot: 3 }),
        ];

        expect(summariseNoTargets(items)).toEqual({
            reason: 'none-equipped', inInventory: 2, wornMythics: 0,
        });
    });

    it('keeps "done" for worn mythics at the cap', () => {
        const items = [
            item({ rarity: 'mythic', level: MYTHIC_MAX_LEVEL, equipped: true, slot: 1 }),
            item({ rarity: 'mythic', level: 7, slot: 2 }),
        ];

        expect(summariseNoTargets(items)).toEqual({
            reason: 'all-at-cap', inInventory: 1, wornMythics: 1,
        });
    });

    // The three reasons are exhaustive only for a list pickUpgradeTargets
    // came back empty on. This ties the two together so the pairing cannot
    // drift apart: whenever there is nothing to upgrade, a summary exists.
    it('covers every list pickUpgradeTargets rejects', () => {
        const listen: ArmorItem[][] = [
            [],
            [item({ rarity: 'legendary', level: 68, equipped: true, slot: 1 })],
            [item({ rarity: 'mythic', level: 4, slot: 1 })],
            [item({ rarity: 'mythic', level: MYTHIC_MAX_LEVEL, equipped: true, slot: 1 })],
        ];

        for (const liste of listen) {
            expect(pickUpgradeTargets(liste, KNOW_HOW, null)).toHaveLength(0);
            expect(['no-mythic-owned', 'none-equipped', 'all-at-cap'])
                .toContain(summariseNoTargets(liste).reason);
        }
    });
});

describe('countMaterialStock', () => {
    it('counts legendaries and epics, never mythics, never worn items', () => {
        const stock = countMaterialStock([
            item({ rarity: 'legendary', level: 600 }),
            item({ rarity: 'legendary', level: 600 }),
            item({ rarity: 'epic', level: 600 }),
            item({ rarity: 'mythic', level: 4 }),
            item({ rarity: 'mythic', level: MYTHIC_MAX_LEVEL, equipped: true }),
            item({ rarity: 'legendary', level: 600, equipped: true }),
            item({ rarity: 'rare', level: 600 }),
        ]);
        expect(stock).toEqual({ legendary: 2, epic: 1, other: 1 });
    });
});

describe('parseRequirement', () => {
    it('reads both numbers the upgrade page prints', () => {
        expect(parseRequirement('Materials LVL. 1 Until lvl.2: 20 Until lvl.20: 1555'))
            .toEqual({ toNextLevel: 20, toMaxLevel: 1555 });
    });

    it('handles thousands separators', () => {
        expect(parseRequirement('Until lvl.3: 23 Until lvl.20: 1,535'))
            .toEqual({ toNextLevel: 23, toMaxLevel: 1535 });
    });

    // At level 19 the page prints "Until lvl.20: 204" twice, because the next
    // level and the cap are the same one. Reading only the cap out of that
    // left the next-level figure null and the log saying "?".
    it('reads a doubled line one level below the cap as both figures', () => {
        expect(parseRequirement('Until lvl.20: 204 Until lvl.20: 204'))
            .toEqual({ toNextLevel: 204, toMaxLevel: 204 });
    });

    it('returns nulls rather than guesses when the page says nothing', () => {
        expect(parseRequirement('nothing here')).toEqual({ toNextLevel: null, toMaxLevel: null });
    });
});

describe('decideNextLevelUp', () => {
    it('goes while the game says it can', () => {
        expect(decideNextLevelUp({ currentLevel: 5, levelUpEnabled: true }))
            .toEqual({ go: true });
    });

    // The button staying disabled after Auto Select is the game's own
    // verdict that the stock is spent -- nothing here counts material.
    it('stops when the button stays disabled', () => {
        const d = decideNextLevelUp({ currentLevel: 5, levelUpEnabled: false });
        expect(d.go).toBe(false);
        expect(d).toMatchObject({ done: false });
        expect((d as any).reason).toMatch(/material/);
    });

    it('stops, and counts it as finished, at the cap', () => {
        const d = decideNextLevelUp({ currentLevel: MYTHIC_MAX_LEVEL, levelUpEnabled: true });
        expect(d).toMatchObject({ go: false, done: true });
    });

    // The loop is bounded by the level itself: the caller raises currentLevel
    // on every pass, so 1 -> 20 ends it after at most 19 of them.
    it('stops one pass after the last legal level', () => {
        expect(decideNextLevelUp({ currentLevel: MYTHIC_MAX_LEVEL - 1, levelUpEnabled: true }))
            .toEqual({ go: true });
        expect(decideNextLevelUp({ currentLevel: MYTHIC_MAX_LEVEL, levelUpEnabled: true }))
            .toMatchObject({ go: false, done: true });
    });
});

describe('decideNextLevelUp on the girl page', () => {
    it('stops at level 10', () => {
        expect(decideNextLevelUp({ currentLevel: 9, levelUpEnabled: true, maxLevel: GIRL_GEAR_MAX_LEVEL }))
            .toEqual({ go: true });
        expect(decideNextLevelUp({ currentLevel: 10, levelUpEnabled: true, maxLevel: GIRL_GEAR_MAX_LEVEL }))
            .toMatchObject({ go: false, done: true });
    });

    it('buys a level that leaves exactly the money to keep', () => {
        expect(decideNextLevelUp({ currentLevel: 3, levelUpEnabled: true, maxLevel: 10,
            money: { available: 1_080_000, cost: 80_000, keep: 1_000_000 } })).toEqual({ go: true });
    });

    it('stops, not finished, before a level that would go below the money to keep', () => {
        const d = decideNextLevelUp({ currentLevel: 3, levelUpEnabled: true, maxLevel: 10,
            money: { available: 1_079_999, cost: 80_000, keep: 1_000_000 } });
        expect(d).toMatchObject({ go: false, done: false, reason: expect.stringMatching(/money/) });
    });

    it('reports missing material before money', () => {
        const d = decideNextLevelUp({ currentLevel: 3, levelUpEnabled: false, maxLevel: 10,
            money: { available: 0, cost: 80_000, keep: 1_000_000 } });
        expect(d).toMatchObject({ reason: expect.stringMatching(/material/) });
    });
});

describe('parseRequirement on the girl page', () => {
    // Measured on /girl-equipment-upgrade.html, a level 1 item.
    it('takes the level 10 line as the cap', () => {
        expect(parseRequirement('Until lvl.2: 8 Until lvl.10: 216', GIRL_GEAR_MAX_LEVEL))
            .toEqual({ toNextLevel: 8, toMaxLevel: 216 });
    });
});

describe('pickGirlUpgradeTargets', () => {
    let id = 100;
    const armor = (slot: number, rarity: string, level: number): RawGirlArmor =>
        ({ id_girl_armor_equipped: id++, slot_index: slot, rarity, level, skin: { name: `item${slot}` } });

    it('takes only worn mythics below level 10', () => {
        const t = pickGirlUpgradeTargets([{ id_girl: 1, armor: [
            armor(1, 'mythic', 3), armor(2, 'legendary', 1), armor(3, 'mythic', 10), armor(4, 'epic', 1),
        ] }]);
        expect(t.map(x => x.slot)).toEqual([1]);
    });

    it('orders girls by team position, leader first', () => {
        const t = pickGirlUpgradeTargets([
            { id_girl: 7, armor: [armor(1, 'mythic', 1)] },
            { id_girl: 3, armor: [armor(1, 'mythic', 9)] },
        ]);
        expect(t.map(x => [x.girlId, x.position])).toEqual([[7, 0], [3, 1]]);
    });

    it('within one girl, the highest level first, then by slot', () => {
        const t = pickGirlUpgradeTargets([{ id_girl: 1, armor: [
            armor(4, 'mythic', 2), armor(2, 'mythic', 7), armor(6, 'mythic', 7), armor(1, 'mythic', 1),
        ] }]);
        expect(t.map(x => [x.slot, x.level])).toEqual([[2, 7], [6, 7], [4, 2], [1, 1]]);
    });

    it('keeps the position of a girl without gear', () => {
        const t = pickGirlUpgradeTargets([
            { id_girl: 1, armor: [] },
            { id_girl: 2, armor: [armor(1, 'mythic', 1)] },
        ]);
        expect(t[0].position).toBe(1);
    });

    it('reads the levels the game sends as strings', () => {
        const t = pickGirlUpgradeTargets([{ id_girl: 1, armor: [
            { ...armor(1, 'mythic', 0), level: '10' as unknown as number },
            { ...armor(2, 'mythic', 0), level: '4' as unknown as number },
        ] }]);
        expect(t.map(x => [x.slot, x.level])).toEqual([[2, 4]]);
    });
});

describe('girlUpgradePageUrl', () => {
    it('uses the parameter the game uses for a worn girl item', () => {
        expect(girlUpgradePageUrl(42)).toBe('/girl-equipment-upgrade.html?id_girl_armor_equipped=42');
    });
});
