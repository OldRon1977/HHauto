// EquipmentUpgradeService.ts -- Pure helpers for "Upgrade Gear": which worn
// items are worth levelling, and when to stop.
//
// The deliberate non-decision in here: this file does not compute how much
// material a level costs, and does not pick the material. Both are left to
// the game.
//
// Measured 2026-08-17 on the upgrade page: material is counted by weight,
// not by piece -- seven epics covered a stated requirement of 20 -- and the
// cost curve is not derivable (20 for level 1->2, 23 for 2->3, but 1555 in
// total from level 1, which no arithmetic series through those two points
// produces). Guessing it would either waste material or send calls the
// server rejects. The upgrade page states the requirement outright and ships
// an "Auto Select" that fills the material slots by the game's own rules, so
// the automation reads that number and presses that button instead of
// re-deriving either.
//
// Used by: Module/EquipmentGear.ts

import { ArmorItem, GearTheme, MYTHIC_MAX_LEVEL, gearTier } from './EquipmentOptimizerService';
import type { PlayerClass } from './TeamScoringService';

export interface UpgradeTarget {
    id_member_armor: number;
    name: string;
    slot: number;
    level: number;
    /** Priority tier of the item, so the log can say why it is worth the
     *  material. */
    tier: number;
}

/** The upgrade flow lives on its own page. Which query parameter it wants
 *  depends on where the item sits (measured 2026-08-17):
 *
 *    inventory item : ?id_member_item=<id_member_armor>
 *    worn item      : ?id_member_item_equipped=<id_member_armor_equipped>
 *
 *  The two id spaces are disjoint, so passing an equipped id under the
 *  inventory parameter does not fail loudly -- the page just bounces back to
 *  the market and the run looks like it did nothing. Upgrade Gear only ever
 *  targets worn items, so it always uses the second form. */
export const UPGRADE_PATH = '/mythic-equipment-upgrade.html';

export function upgradePageUrl(target: { id_member_armor: number }): string {
    return `${UPGRADE_PATH}?id_member_item_equipped=${target.id_member_armor}`;
}

/** Hard stop on level-ups per page load, so a misread response cannot spend
 *  an inventory. Each one costs money and material. */
export const MAX_LEVELUPS_PER_PAGE = 30;

/**
 * The worn items worth spending material on: mythics that are not yet at
 * the cap.
 *
 * Only equipped items qualify. Levelling a mythic that is not being worn
 * buys nothing today, and "Possible Best Gear" exists precisely to put the
 * right ones on first -- the intended order is equip, then upgrade.
 *
 * Ordered by priority tier so the material goes into the slot that gains
 * the most from it: a mythic matching class and theme grows both bonuses,
 * one matching nothing grows nothing that counts.
 */
export function pickUpgradeTargets(
    items: ArmorItem[],
    playerClass: PlayerClass,
    theme: GearTheme,
): UpgradeTarget[] {
    return items
        .filter(i => i.equipped && i.rarity === 'mythic' && i.level < MYTHIC_MAX_LEVEL)
        .map(i => ({
            id_member_armor: i.id_member_armor,
            name: i.name,
            slot: i.slot,
            level: i.level,
            // 'possible' so an unlevelled mythic is judged by the resonance
            // it will have, which is the whole point of upgrading it.
            tier: gearTier(i, playerClass, theme, 'possible'),
        }))
        .sort((a, b) => a.tier - b.tier || a.slot - b.slot);
}

/**
 * Items the game may consume. Mythics are never material -- no exception for
 * duplicates or for a theme match on the wrong class.
 *
 * Nothing here is passed to the game; the count only tells the player how
 * much stock stands behind the plan. The actual picking is Auto Select's.
 */
export function countMaterialStock(items: ArmorItem[]): { legendary: number; epic: number; other: number } {
    const out = { legendary: 0, epic: 0, other: 0 };
    for (const i of items) {
        if (i.equipped || i.rarity === 'mythic') continue;
        if (i.rarity === 'legendary') out.legendary++;
        else if (i.rarity === 'epic') out.epic++;
        else out.other++;
    }
    return out;
}

/** The "Until lvl.N: X" lines the upgrade page prints. Both numbers come
 *  from the game; nothing here recomputes them. */
export interface UpgradeRequirement {
    /** Material needed for the next single level. */
    toNextLevel: number | null;
    /** Material needed to reach the cap from here. */
    toMaxLevel: number | null;
}

export function parseRequirement(pageText: string): UpgradeRequirement {
    const out: UpgradeRequirement = { toNextLevel: null, toMaxLevel: null };
    // "Until lvl.3: 23" / "Until lvl.20: 1,535"
    const re = /Until\s+lvl\.(\d+):\s*([\d.,]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(pageText)) !== null) {
        const level = Number(m[1]);
        const amount = Number(m[2].replace(/[.,]/g, ''));
        if (!Number.isFinite(amount)) continue;
        if (level >= MYTHIC_MAX_LEVEL) out.toMaxLevel = amount;
        else if (out.toNextLevel === null) out.toNextLevel = amount;
    }
    return out;
}

export type UpgradeStop =
    | { go: true }
    | { go: false; reason: string; done: boolean };

/**
 * Whether to press Level-up once more.
 *
 * `levelUpEnabled` is the game's own verdict: the button only lights up once
 * Auto Select has managed to cover the requirement, so a disabled button
 * after Auto Select means the stock is spent. That is the signal this stops
 * on -- not an estimate of remaining material.
 */
export function decideNextLevelUp(state: {
    currentLevel: number;
    levelUpEnabled: boolean;
    performed: number;
}): UpgradeStop {
    if (state.currentLevel >= MYTHIC_MAX_LEVEL) {
        return { go: false, reason: 'item is at max level', done: true };
    }
    if (state.performed >= MAX_LEVELUPS_PER_PAGE) {
        return { go: false, reason: `hit the ${MAX_LEVELUPS_PER_PAGE}-level cap for one run`, done: false };
    }
    if (!state.levelUpEnabled) {
        return { go: false, reason: 'not enough material left for another level', done: false };
    }
    return { go: true };
}
