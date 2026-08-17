import {
    MAX_LEVELUPS_PER_PAGE,
    countMaterialStock,
    decideNextLevelUp,
    parseRequirement,
    pickUpgradeTargets,
    upgradePageUrl,
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

    it('judges the tier by what the item will be, not what it is', () => {
        // A level-1 mythic is tier 5 today but tier 1 once levelled, and
        // levelling it is the whole point.
        const young = item({ rarity: 'mythic', level: 1, equipped: true, classId: '3', themeId: 'sun' });
        expect(pickUpgradeTargets([young], KNOW_HOW, 'sun')[0].tier).toBe(1);
    });
});

// The bug that made the whole button look dead: a worn item reports only
// id_member_armor_equipped, and the upgrade page wants that under a
// different query parameter. Sent under the inventory one the page simply
// bounced back to the market, so the run "did nothing" with no error.
describe('upgradePageUrl', () => {
    it('addresses a worn item by the equipped parameter', () => {
        expect(upgradePageUrl({ id_member_armor: 2806615 }))
            .toBe('/mythic-equipment-upgrade.html?id_member_item_equipped=2806615');
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

    it('returns nulls rather than guesses when the page says nothing', () => {
        expect(parseRequirement('nothing here')).toEqual({ toNextLevel: null, toMaxLevel: null });
    });
});

describe('decideNextLevelUp', () => {
    it('goes while the game says it can', () => {
        expect(decideNextLevelUp({ currentLevel: 5, levelUpEnabled: true, performed: 0 }))
            .toEqual({ go: true });
    });

    // The button staying disabled after Auto Select is the game's own
    // verdict that the stock is spent -- nothing here counts material.
    it('stops when the button stays disabled', () => {
        const d = decideNextLevelUp({ currentLevel: 5, levelUpEnabled: false, performed: 2 });
        expect(d.go).toBe(false);
        expect(d).toMatchObject({ done: false });
        expect((d as any).reason).toMatch(/material/);
    });

    it('stops, and counts it as finished, at the cap', () => {
        const d = decideNextLevelUp({ currentLevel: MYTHIC_MAX_LEVEL, levelUpEnabled: true, performed: 4 });
        expect(d).toMatchObject({ go: false, done: true });
    });

    // Each level costs money and material, so a misread response must not be
    // able to spend an inventory.
    it('stops at the per-run cap', () => {
        const d = decideNextLevelUp({
            currentLevel: 5, levelUpEnabled: true, performed: MAX_LEVELUPS_PER_PAGE,
        });
        expect(d).toMatchObject({ go: false, done: false });
    });
});
