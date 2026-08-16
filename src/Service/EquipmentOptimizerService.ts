// EquipmentOptimizerService.ts -- Pure ranking logic for the player's own
// equipment (the six armor slots of the hero, not girl equipment).
//
// Mechanics, data model, endpoints and the measurement traps behind all of
// this: docs-internal/equipment-resonance.md. The two decisions that shape
// this file and are NOT obvious from the code alone:
//
//   1. Raw stats dominate, resonance is the tiebreak. A resonance bonus is
//      worth at most 2 percentage points (4 on the chance track) while a
//      level-1 item costs ~1900 raw points per carac against a level-20 one.
//      So the ordering is lexicographic (raw, then resonance) rather than a
//      weighted sum -- a weighted sum would need an exchange rate between
//      "percentage points of a hero stat" and "carac points of an item",
//      and that rate is not measurable client-side (see section 4 of the
//      doc: the resonance is applied after the end calculation of stats and
//      shows up in no client-visible number).
//
//   2. Nothing here measures itself. Every value is derived from the
//      declared `resonance_bonuses` and the item's own `caracs`. The
//      optimiser must not try a before/after comparison; the doc records
//      three measurement paths that all read 0.00% even for a
//      level-20-vs-level-1 swap.
//
// Used by: Module/EquipmentGear.ts (UI + ajax). This file stays free of DOM
// and game globals so it can be unit-tested (ARCH-001: Service must not
// import Module).

import type { ElementType, PlayerClass } from './TeamScoringService';

/** Which hero stat a resonance bonus lands on. Read per item, never derived
 *  from the axis -- for player items `class` was seen on both `damage` and
 *  `ego`, `theme` on both `defense` and `chance`. */
export type ResonanceTarget = 'damage' | 'ego' | 'defense' | 'chance';

/** The team's theme. "balanced" is a full theme, not the absence of one:
 *  items resonate on it with `identifier: null`. */
export type GearTheme = ElementType | 'balanced';

export interface ArmorCaracs {
    carac1: number;
    carac2: number;
    carac3: number;
    endurance: number;
    chance: number;
}

export interface ArmorResonance {
    /** class axis: the class number as a string ("1".."3").
     *  theme axis: the element name, or null for Balanced. */
    identifier: string | null;
    resonance: ResonanceTarget;
    /** Percentage points, at the item's current level. */
    bonus: number;
}

export interface ArmorItem {
    /** Inventory id, and what `market_equip_armor` is called with. Changes
     *  every time the item is unequipped -- never cache it across an equip
     *  call, and never look an item up by name.
     *
     *  Measured 2026-08-16: an item in `#equiped` carries *only*
     *  `id_member_armor_equipped` and no `id_member_armor` at all, while an
     *  inventory entry carries only the latter. The two id spaces are
     *  disjoint, so this field holds whichever one the source provided and
     *  `equipped` says which. */
    id_member_armor: number;
    /** Set while the item is worn, null in the inventory. */
    id_member_armor_equipped: number | null;
    level: number;
    /** skin.subtype, 1..6. An item only fits its own slot. */
    slot: number;
    rarity: string;
    name: string;
    caracs: ArmorCaracs;
    classResonance: ArmorResonance | null;
    themeResonance: ArmorResonance | null;
    equipped: boolean;
}

/** Max level of a mythic player item; also the level "Possible Best"
 *  projects to. */
export const MYTHIC_MAX_LEVEL = 20;

const GEAR_SLOTS = [1, 2, 3, 4, 5, 6] as const;

// Raw stat curves of a mythic player item (measured 2026-08-17). carac1..3
// are equal to each other, so the per-carac value is a third of the sum the
// doc records. Only mythics level; everything else is fixed at the value the
// game hands out.
const MYTHIC_CARAC_SUM_BASE = 6000;
const MYTHIC_CARAC_SUM_PER_LEVEL = 300;
const MYTHIC_ENDURANCE_BASE = 2000;
const MYTHIC_ENDURANCE_PER_LEVEL = 100;
const MYTHIC_CHANCE_BASE = 3000;
const MYTHIC_CHANCE_PER_LEVEL = 100;

// Resonance grows 0.1 percentage points per item level, doubled on the
// chance track.
const RESONANCE_PER_LEVEL = 0.1;
const RESONANCE_PER_LEVEL_CHANCE = 0.2;

/** How far a measured carac may drift from the mythic curve before the
 *  projection is treated as unreliable. Guards against a game rebalance
 *  silently turning "Possible Best" into nonsense. */
const PROJECTION_TOLERANCE = 0.05;

export interface SlotPick {
    slot: number;
    /** The item the button wants to wear. null when the slot has no
     *  candidate at all. */
    chosen: ArmorItem | null;
    /** What is worn right now, for the cost report. */
    current: ArmorItem | null;
    /** false when `chosen` is already equipped -- no ajax call needed. */
    changed: boolean;
    /** Raw carac points gained (positive) or given up (negative) *today*.
     *  "Possible Best" is expected to go negative here; that is the gap the
     *  upgrade step closes. */
    rawDelta: number;
    /** Active resonance percentage points gained today. */
    resonanceDelta: number;
    /** Possible Best only: 1 = mythic matching class AND theme,
     *  2 = mythic matching class only, 3 = strongest by raw stats. */
    tier?: number;
    /** Possible Best only: raw carac points once both items sit at max
     *  level. What the swap buys after the upgrade step. */
    projectedRawDelta?: number;
    /** Possible Best only: resonance percentage points at max level. */
    projectedResonanceDelta?: number;
    /** Set when the item's own caracs contradict the mythic curve, so the
     *  projection fell back to the measured values. */
    projectionUnreliable?: boolean;
}

export interface GearPlan {
    picks: SlotPick[];
    /** Slots that actually need an equip call. */
    changes: SlotPick[];
    /** Sum of rawDelta over the changes -- negative means weaker today. */
    totalRawDelta: number;
    totalResonanceDelta: number;
    /** Possible Best only: what the plan is worth once everything is at max
     *  level. */
    totalProjectedRawDelta?: number;
    totalProjectedResonanceDelta?: number;
}

/** Sum of the five stats an armor item carries. The single raw number every
 *  comparison in this file is built on. */
export function rawScore(caracs: ArmorCaracs): number {
    return caracs.carac1 + caracs.carac2 + caracs.carac3
        + caracs.endurance + caracs.chance;
}

/** Is this item's class axis active for the given hero class? */
export function classMatches(item: ArmorItem, playerClass: PlayerClass): boolean {
    const res = item.classResonance;
    if (!res || res.identifier === null) return false;
    return String(res.identifier) === String(playerClass);
}

/** Is this item's theme axis active for the given team theme?
 *  `identifier: null` is Balanced, not "no theme". */
export function themeMatches(item: ArmorItem, theme: GearTheme): boolean {
    const res = item.themeResonance;
    if (!res) return false;
    if (res.identifier === null) return theme === 'balanced';
    return res.identifier === theme;
}

function resonanceAtLevel(res: ArmorResonance, level: number): number {
    const perLevel = res.resonance === 'chance'
        ? RESONANCE_PER_LEVEL_CHANCE
        : RESONANCE_PER_LEVEL;
    return perLevel * level;
}

/** Percentage points this item contributes right now: the sum of whichever
 *  of its two axes currently match. */
export function activeResonance(
    item: ArmorItem,
    playerClass: PlayerClass,
    theme: GearTheme,
): number {
    let total = 0;
    if (classMatches(item, playerClass)) total += item.classResonance!.bonus;
    if (themeMatches(item, theme)) total += item.themeResonance!.bonus;
    return total;
}

/** The same sum, but with both axes scaled to max level. Used by Possible
 *  Best, which ranks items by what they will be worth, not what they are. */
export function projectedResonance(
    item: ArmorItem,
    playerClass: PlayerClass,
    theme: GearTheme,
): number {
    const level = isUpgradable(item) ? MYTHIC_MAX_LEVEL : item.level;
    let total = 0;
    if (classMatches(item, playerClass)) {
        total += resonanceAtLevel(item.classResonance!, level);
    }
    if (themeMatches(item, theme)) {
        total += resonanceAtLevel(item.themeResonance!, level);
    }
    return total;
}

/** Only mythics level up; every other rarity is handed out at a fixed value
 *  tied to the player level. */
function isUpgradable(item: ArmorItem): boolean {
    return item.rarity === 'mythic' && item.level < MYTHIC_MAX_LEVEL;
}

function withinTolerance(measured: number, expected: number): boolean {
    if (expected === 0) return measured === 0;
    return Math.abs(measured - expected) / expected <= PROJECTION_TOLERANCE;
}

/**
 * Caracs this item would have at max level.
 *
 * Non-mythics and already-maxed mythics return their measured caracs
 * unchanged. For everything else the curve is applied -- but only after
 * checking it against the item's *current* caracs. If the game ever
 * rebalances the curve, the check fails and the measured values are
 * returned instead, with `unreliable` set, so the caller can say so rather
 * than rank on invented numbers.
 */
export function projectCaracs(item: ArmorItem): { caracs: ArmorCaracs; unreliable: boolean } {
    if (!isUpgradable(item)) {
        return { caracs: item.caracs, unreliable: false };
    }
    const lvl = item.level;
    const expectedCaracSum = MYTHIC_CARAC_SUM_BASE + MYTHIC_CARAC_SUM_PER_LEVEL * lvl;
    const expectedEndurance = MYTHIC_ENDURANCE_BASE + MYTHIC_ENDURANCE_PER_LEVEL * lvl;
    const expectedChance = MYTHIC_CHANCE_BASE + MYTHIC_CHANCE_PER_LEVEL * lvl;
    const measuredCaracSum = item.caracs.carac1 + item.caracs.carac2 + item.caracs.carac3;

    const curveHolds = withinTolerance(measuredCaracSum, expectedCaracSum)
        && withinTolerance(item.caracs.endurance, expectedEndurance)
        && withinTolerance(item.caracs.chance, expectedChance);

    if (!curveHolds) {
        return { caracs: item.caracs, unreliable: true };
    }

    const maxCaracSum = MYTHIC_CARAC_SUM_BASE + MYTHIC_CARAC_SUM_PER_LEVEL * MYTHIC_MAX_LEVEL;
    const perCarac = maxCaracSum / 3;
    return {
        caracs: {
            carac1: perCarac,
            carac2: perCarac,
            carac3: perCarac,
            endurance: MYTHIC_ENDURANCE_BASE + MYTHIC_ENDURANCE_PER_LEVEL * MYTHIC_MAX_LEVEL,
            chance: MYTHIC_CHANCE_BASE + MYTHIC_CHANCE_PER_LEVEL * MYTHIC_MAX_LEVEL,
        },
        unreliable: false,
    };
}

/** Possible Best ranking tier -- lower is better. See the doc's ordering:
 *  a mythic carrying the wrong class is not a hit even if its theme fits. */
export function possibleBestTier(
    item: ArmorItem,
    playerClass: PlayerClass,
    theme: GearTheme,
): 1 | 2 | 3 {
    if (item.rarity !== 'mythic') return 3;
    if (!classMatches(item, playerClass)) return 3;
    return themeMatches(item, theme) ? 1 : 2;
}

function bySlot(items: ArmorItem[]): Map<number, ArmorItem[]> {
    const map = new Map<number, ArmorItem[]>();
    for (const slot of GEAR_SLOTS) map.set(slot, []);
    for (const item of items) {
        const bucket = map.get(item.slot);
        if (bucket) bucket.push(item);
    }
    return map;
}

/** Compare two numbers with a tolerance, so equal-by-construction raw sums
 *  (two mythics of the same slot and level) really do tie and let the
 *  resonance decide. */
function cmp(a: number, b: number): number {
    if (Math.abs(a - b) < 0.5) return 0;
    return a < b ? 1 : -1; // descending
}

function buildPick(
    slot: number,
    chosen: ArmorItem | null,
    current: ArmorItem | null,
    playerClass: PlayerClass,
    theme: GearTheme,
): SlotPick {
    const currentRaw = current ? rawScore(current.caracs) : 0;
    const currentRes = current ? activeResonance(current, playerClass, theme) : 0;
    return {
        slot,
        chosen,
        current,
        changed: chosen !== null && !chosen.equipped,
        rawDelta: chosen ? rawScore(chosen.caracs) - currentRaw : 0,
        resonanceDelta: chosen ? activeResonance(chosen, playerClass, theme) - currentRes : 0,
    };
}

function summarise(picks: SlotPick[], projected: boolean): GearPlan {
    const changes = picks.filter(p => p.changed);
    const plan: GearPlan = {
        picks,
        changes,
        totalRawDelta: changes.reduce((s, p) => s + p.rawDelta, 0),
        totalResonanceDelta: changes.reduce((s, p) => s + p.resonanceDelta, 0),
    };
    if (projected) {
        plan.totalProjectedRawDelta = changes.reduce((s, p) => s + (p.projectedRawDelta ?? 0), 0);
        plan.totalProjectedResonanceDelta = changes.reduce((s, p) => s + (p.projectedResonanceDelta ?? 0), 0);
    }
    return plan;
}

/**
 * "Current Best Gear": per slot the item with the highest value *today*.
 *
 * Ordering is raw stats first, active resonance second. This never makes the
 * player weaker and never leaves a slot empty -- a mythic below roughly
 * level 15 loses to a legendary at player level because its raw stats are
 * lower, and that is the correct answer for this button.
 */
export function planCurrentBest(
    items: ArmorItem[],
    playerClass: PlayerClass,
    theme: GearTheme,
): GearPlan {
    const picks: SlotPick[] = [];
    for (const [slot, candidates] of bySlot(items)) {
        const current = candidates.find(i => i.equipped) ?? null;
        const ranked = [...candidates].sort((a, b) => {
            const raw = cmp(rawScore(a.caracs), rawScore(b.caracs));
            if (raw !== 0) return raw;
            return cmp(
                activeResonance(a, playerClass, theme),
                activeResonance(b, playerClass, theme),
            );
        });
        picks.push(buildPick(slot, ranked[0] ?? null, current, playerClass, theme));
    }
    return summarise(picks, false);
}

/**
 * "Possible Best Gear": per slot the item that would be strongest once
 * everything sits at max level.
 *
 * This deliberately equips items that are weaker *today* -- the same
 * behaviour as "Best Possible" on the team page, which fields a level-1
 * girl because she is the better target. The cost of that choice is
 * reported per slot (`rawDelta`) and in the summary, so the player sees the
 * gap instead of only having it.
 *
 * A mythic with the right theme but the wrong class is not a hit and lands
 * in tier 3, where it competes on raw stats like anything else. It can
 * still win that tier -- if it is the only mythic for its slot, wearing it
 * really is the strongest projected option -- and the upgrade step then
 * simply may not consume it, because it is equipped.
 */
export function planPossibleBest(
    items: ArmorItem[],
    playerClass: PlayerClass,
    theme: GearTheme,
): GearPlan {
    const picks: SlotPick[] = [];
    for (const [slot, candidates] of bySlot(items)) {
        const current = candidates.find(i => i.equipped) ?? null;
        const projections = new Map<ArmorItem, { caracs: ArmorCaracs; unreliable: boolean }>();
        for (const item of candidates) projections.set(item, projectCaracs(item));

        const ranked = [...candidates].sort((a, b) => {
            const tier = possibleBestTier(a, playerClass, theme) - possibleBestTier(b, playerClass, theme);
            if (tier !== 0) return tier;
            const raw = cmp(
                rawScore(projections.get(a)!.caracs),
                rawScore(projections.get(b)!.caracs),
            );
            if (raw !== 0) return raw;
            return cmp(
                projectedResonance(a, playerClass, theme),
                projectedResonance(b, playerClass, theme),
            );
        });

        const chosen = ranked[0] ?? null;
        const pick = buildPick(slot, chosen, current, playerClass, theme);
        if (chosen) {
            const chosenProj = projections.get(chosen)!;
            const currentProj = current ? projectCaracs(current) : null;
            pick.tier = possibleBestTier(chosen, playerClass, theme);
            pick.projectedRawDelta = rawScore(chosenProj.caracs)
                - (currentProj ? rawScore(currentProj.caracs) : 0);
            pick.projectedResonanceDelta = projectedResonance(chosen, playerClass, theme)
                - (current ? projectedResonance(current, playerClass, theme) : 0);
            if (chosenProj.unreliable || currentProj?.unreliable) {
                pick.projectionUnreliable = true;
            }
        }
        picks.push(pick);
    }
    return summarise(picks, true);
}

/**
 * Team theme from the element distribution of the fielded team. Three girls
 * of one element set the theme; anything else is Balanced.
 *
 * Caveat recorded in the doc: the 3-girl threshold is measured for
 * `theme_elements` / the domination bonus and is only *plausible* for the
 * resonance axis, not confirmed.
 */
export function themeFromElementCounts(counts: Record<string, number>): GearTheme {
    let best: GearTheme = 'balanced';
    let bestCount = 0;
    for (const [element, count] of Object.entries(counts)) {
        if (count >= 3 && count > bestCount) {
            best = element as ElementType;
            bestCount = count;
        }
    }
    return best;
}

/**
 * Theme of one `teams_data` entry, as the game itself reports it.
 *
 * Measured 2026-08-16 on `teams.html?battle_type=leagues`: an entry carries
 * `theme: "nature"` and `theme_elements: [{type: "nature", ...}]` outright,
 * so nothing has to be counted. Two things this has to keep apart:
 *
 *   - `theme: null` on a team that *has* girls is Balanced.
 *   - `theme: null` on an empty slot (`girls: []`, `id_team: null`) is not a
 *     theme at all -- 22 of the 30 entries on the test account look like
 *     that, and treating them as Balanced would hand the optimiser a theme
 *     for a team that does not exist.
 *
 * The girls in this payload carry `element: null`, so counting elements the
 * way TeamModule does is not an option here.
 */
export function themeFromTeamData(team: any): GearTheme | null {
    if (!team || typeof team !== 'object') return null;
    const girls = Array.isArray(team.girls) ? team.girls : [];
    if (girls.length === 0) return null;
    const declared = parseTheme(team.theme)
        ?? parseTheme(team?.theme_elements?.[0]?.type);
    return declared ?? 'balanced';
}

/** Narrow an arbitrary stored string back to a theme, or null when it is
 *  not one. Callers must treat null as "do nothing and log it" -- acting on
 *  a guessed theme is worse than not acting. */
export function parseTheme(value: unknown): GearTheme | null {
    const known: GearTheme[] = [
        'balanced', 'fire', 'water', 'nature', 'stone',
        'sun', 'darkness', 'psychic', 'light',
    ];
    return known.includes(value as GearTheme) ? value as GearTheme : null;
}

function toResonance(raw: any): ArmorResonance | null {
    if (!raw || typeof raw !== 'object') return null;
    const bonus = Number(raw.bonus);
    if (!Number.isFinite(bonus)) return null;
    const identifier = raw.identifier === null || raw.identifier === undefined
        ? null
        : String(raw.identifier);
    return { identifier, resonance: raw.resonance as ResonanceTarget, bonus };
}

/**
 * Map one raw game object onto ArmorItem.
 *
 * `isEquipped` has to be told, not sniffed: the two sources carry disjoint
 * id fields (measured 2026-08-16). An item read from `#equiped` has
 * `id_member_armor_equipped` and no `id_member_armor`; an entry from
 * `player_inventory.armor` / `market_get_armor` has it the other way round.
 * Sniffing on the presence of a field silently dropped all six worn items.
 *
 * Returns null for anything that is not a wearable hero armor with a usable
 * slot -- girl equipment shares the inventory shape, and a silent
 * mis-classification here would equip the wrong thing.
 */
export function parseArmorItem(raw: any, isEquipped = false): ArmorItem | null {
    if (!raw || typeof raw !== 'object') return null;
    const slot = Number(raw?.skin?.subtype);
    if (!Number.isInteger(slot) || slot < 1 || slot > 6) return null;
    if (raw?.skin?.wearer && raw.skin.wearer !== 'hero') return null;

    const id = Number(isEquipped ? raw.id_member_armor_equipped : raw.id_member_armor);
    if (!Number.isFinite(id)) return null;

    const c = raw.caracs ?? {};
    const caracs: ArmorCaracs = {
        carac1: Number(c.carac1) || 0,
        carac2: Number(c.carac2) || 0,
        carac3: Number(c.carac3) || 0,
        endurance: Number(c.endurance) || 0,
        chance: Number(c.chance) || 0,
    };

    const res = raw.resonance_bonuses ?? {};
    return {
        id_member_armor: id,
        id_member_armor_equipped: isEquipped ? id : null,
        level: Number(raw.level) || 0,
        slot,
        rarity: String(raw?.item?.rarity ?? ''),
        name: String(raw?.skin?.name ?? ''),
        caracs,
        classResonance: toResonance(res.class),
        themeResonance: toResonance(res.theme),
        equipped: isEquipped,
    };
}
