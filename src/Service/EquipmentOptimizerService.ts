// EquipmentOptimizerService.ts -- Pure ranking logic for the player's own
// equipment (the six armor slots of the hero, not girl equipment).
//
// Mechanics, data model, endpoints and the measurement traps behind all of
// this: docs-internal/equipment-resonance.md. The two decisions that shape
// this file and are NOT obvious from the code alone:
//
//   1. Items are ranked by one number, `pricedValue`: the hero's primary
//      carac times the hero's endurance, multiplied by whatever resonance
//      lands on damage or ego. Everything in it is measured. What is NOT in
//      it -- the off-class caracs (defense) and chance (crit), and the
//      resonance aimed at them -- is tracked separately as "unpriced" and
//      only ever breaks a tie. The model states its blind spot instead of
//      hiding it behind a made-up weight.
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

/**
 * The hero's own stat totals, as the equip response reports them.
 *
 * `primary_carac_amount` and `secondary_caracs_sum` are the game's own
 * split: the class carac on one side, the other two summed on the other.
 * The names do not appear in shared.js, so this bucketing is decided
 * server-side -- it is the game's judgement, not ours.
 */
export interface HeroTotals {
    /** primary_carac_amount -- carac[class]. */
    primary: number;
    /** secondary_caracs_sum -- the two off-class caracs. */
    secondary: number;
    endurance: number;
    chance: number;
}

// How much of an item's carac reaches the hero. Measured 2026-08-16 by
// swapping two items of known caracs into slot 1 and reading the equip
// response: +5783 item carac3 moved primary by +6362, and -43301 item
// endurance moved endurance by -24401.
const CLASS_CARAC_TO_HERO = 1.100;
const ENDURANCE_TO_HERO = 0.5636;

/**
 * Stand-in totals for the first run, before any equip response has been
 * seen. One account (hero 1, level 663, class 3) on 2026-08-16, with
 * its own gear on. Only the *ratio* endurance/primary matters for the
 * ordering, and that ratio is a property of the account -- so a plan built
 * on these numbers is flagged as uncalibrated rather than presented as
 * measured.
 */
export const FALLBACK_HERO_TOTALS: HeroTotals = {
    primary: 54843, secondary: 96509, endurance: 331530, chance: 86218,
};

export interface SlotPick {
    slot: number;
    /** The item the button wants to wear. null when the slot has no
     *  candidate at all. */
    chosen: ArmorItem | null;
    /** What is worn right now, for the cost report. */
    current: ArmorItem | null;
    /** false when `chosen` is already equipped -- no ajax call needed. */
    changed: boolean;
    /** Change in battle value as a percentage, *today*, with the resonance
     *  that lands on damage or ego already included. "Possible Best" is
     *  expected to go negative here; that is the gap the upgrade step
     *  closes. */
    valuePct: number;
    /** Hero-level carac points the swap adds to the class carac and to
     *  endurance. The concrete numbers behind valuePct. */
    primaryDelta: number;
    enduranceDelta: number;
    /** Active resonance percentage points gained today, all axes. Shown for
     *  information; the damage/ego part is already inside valuePct. */
    resonanceDelta: number;
    /** The part of that which the value cannot price: percentage points on
     *  defense and chance. Ranked only as a tiebreak. */
    unpricedResonanceDelta: number;
    /** Possible Best only: 1 = mythic matching class AND theme,
     *  2 = mythic matching class only, 3 = strongest by battle value. */
    tier?: number;
    /** Possible Best only: battle value once both items sit at max level.
     *  What the swap buys after the upgrade step. */
    projectedValuePct?: number;
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
    /** Battle-value change of the whole plan, in percent. Negative means
     *  weaker today. */
    totalValuePct: number;
    totalResonanceDelta: number;
    /** Percentage points of defense/chance resonance the plan gives up or
     *  gains without that showing in totalValuePct. */
    totalUnpricedResonanceDelta: number;
    /** Possible Best only: what the plan is worth once everything is at max
     *  level. */
    totalProjectedValuePct?: number;
    totalProjectedResonanceDelta?: number;
    /** True when the plan was ranked on FALLBACK_HERO_TOTALS because no
     *  equip response had been seen yet. */
    uncalibrated?: boolean;
}

/** The item's class carac -- the one the game tracks as
 *  `primary_carac_amount`. The other two are off-class and feed defense. */
export function classCarac(caracs: ArmorCaracs, playerClass: PlayerClass): number {
    return playerClass === 1 ? caracs.carac1
        : playerClass === 2 ? caracs.carac2
        : caracs.carac3;
}

/** What this item adds to the hero's primary carac and endurance. */
function contribution(caracs: ArmorCaracs, playerClass: PlayerClass) {
    return {
        primary: CLASS_CARAC_TO_HERO * classCarac(caracs, playerClass),
        endurance: ENDURANCE_TO_HERO * caracs.endurance,
    };
}

/**
 * Battle value of wearing `caracs` in a slot that currently holds
 * `inSlot`: the hero's primary carac times the hero's endurance.
 *
 * Why a product and not a weighted sum. Damage is proportional to the
 * primary carac and ego to endurance, so damage x ego is
 * (a x primary) x (b x endurance) = ab x primary x endurance. The two
 * conversion constants are unknown -- and they cancel, because they scale
 * every candidate equally and cannot change the ordering. That is the whole
 * point: this ranking needs no exchange rate between "a point of damage"
 * and "a point of ego", and no such rate is measurable client-side.
 *
 * Why it is computed on hero totals rather than on the item alone: on the
 * item alone a pure-endurance item scores carac x endurance = 0, and a
 * pure-carac item scores 0 as well. Against the hero's totals both are
 * ranked by what they actually move.
 *
 * What this deliberately leaves out: the off-class caracs (defense) and
 * chance (crit). Neither moved in the calibration run, so neither has a
 * measured factor. An item that only carries those is valued at its effect
 * on damage and ego, which is nothing -- the known blind spot of this
 * model.
 */
export function battleValue(
    caracs: ArmorCaracs,
    inSlot: ArmorCaracs | null,
    playerClass: PlayerClass,
    hero: HeroTotals,
): number {
    const cand = contribution(caracs, playerClass);
    const cur = inSlot
        ? contribution(inSlot, playerClass)
        : { primary: 0, endurance: 0 };
    const primary = hero.primary - cur.primary + cand.primary;
    const endurance = hero.endurance - cur.endurance + cand.endurance;
    return Math.max(0, primary) * Math.max(0, endurance);
}

/**
 * Battle value with the resonance that lands on damage or ego folded in.
 *
 * The earlier ordering put value first and used resonance only to break
 * ties. That was justified while value was measured in raw carac points and
 * resonance in percentage points -- thousands against a handful. Once value
 * became a percentage the two ended up the same size: the first live run
 * showed +2.87% value against -4.0pp resonance per slot, and a lexicographic
 * order compared them by not comparing them.
 *
 * Resonance is applied on top of everything (official), so it multiplies:
 * a bonus on damage scales the first term of the product, one on ego the
 * second. Bonuses on defense and chance stay outside and are ranked
 * separately, because nothing here can price them.
 */
export function pricedValue(
    caracs: ArmorCaracs,
    inSlot: ArmorCaracs | null,
    playerClass: PlayerClass,
    hero: HeroTotals,
    split: ResonanceSplit,
): number {
    return battleValue(caracs, inSlot, playerClass, hero)
        * (1 + split.damage / 100)
        * (1 + split.ego / 100);
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

/**
 * An item's active resonance split by whether `battleValue` can price it.
 *
 * `damage` and `ego` multiply the two terms of the product, so they belong
 * inside the value. `defense` and `chance` do not appear in it at all -- they
 * are real bonuses this model cannot weigh, so they are kept apart instead of
 * being silently folded in or silently dropped.
 */
export interface ResonanceSplit {
    /** Percentage points landing on damage. */
    damage: number;
    /** Percentage points landing on ego. */
    ego: number;
    /** Percentage points landing on defense or chance -- outside the model. */
    unpriced: number;
}

export function resonanceSplit(
    item: ArmorItem,
    playerClass: PlayerClass,
    theme: GearTheme,
    projected = false,
): ResonanceSplit {
    const out: ResonanceSplit = { damage: 0, ego: 0, unpriced: 0 };
    const level = isUpgradable(item) ? MYTHIC_MAX_LEVEL : item.level;
    const add = (res: ArmorResonance) => {
        const pp = projected ? resonanceAtLevel(res, level) : res.bonus;
        if (res.resonance === 'damage') out.damage += pp;
        else if (res.resonance === 'ego') out.ego += pp;
        else out.unpriced += pp;
    };
    if (classMatches(item, playerClass)) add(item.classResonance!);
    if (themeMatches(item, theme)) add(item.themeResonance!);
    return out;
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

/** Descending compare with a relative tolerance, so two items that are
 *  equal by construction (two mythics of the same slot and level) really do
 *  tie and let the resonance decide. The tolerance is relative because
 *  battle values run into the tens of billions. */
function cmp(a: number, b: number): number {
    const scale = Math.max(Math.abs(a), Math.abs(b), 1);
    if (Math.abs(a - b) / scale < 1e-9) return 0;
    return a < b ? 1 : -1; // descending
}

function buildPick(
    slot: number,
    chosen: ArmorItem | null,
    current: ArmorItem | null,
    playerClass: PlayerClass,
    theme: GearTheme,
    hero: HeroTotals,
): SlotPick {
    const base = current ? current.caracs : null;
    const currentSplit = current
        ? resonanceSplit(current, playerClass, theme)
        : { damage: 0, ego: 0, unpriced: 0 };
    const currentValue = pricedValue(base ?? ZERO_CARACS, base, playerClass, hero, currentSplit);
    const currentRes = current ? activeResonance(current, playerClass, theme) : 0;
    const chosenSplit = chosen
        ? resonanceSplit(chosen, playerClass, theme)
        : { damage: 0, ego: 0, unpriced: 0 };
    const chosenContribution = chosen ? contribution(chosen.caracs, playerClass) : null;
    const currentContribution = current ? contribution(current.caracs, playerClass) : null;
    return {
        slot,
        chosen,
        current,
        changed: chosen !== null && !chosen.equipped,
        valuePct: chosen
            ? pctChange(pricedValue(chosen.caracs, base, playerClass, hero, chosenSplit), currentValue)
            : 0,
        primaryDelta: (chosenContribution?.primary ?? 0) - (currentContribution?.primary ?? 0),
        enduranceDelta: (chosenContribution?.endurance ?? 0) - (currentContribution?.endurance ?? 0),
        resonanceDelta: chosen ? activeResonance(chosen, playerClass, theme) - currentRes : 0,
        unpricedResonanceDelta: chosen ? chosenSplit.unpriced - currentSplit.unpriced : 0,
    };
}

const ZERO_CARACS: ArmorCaracs = {
    carac1: 0, carac2: 0, carac3: 0, endurance: 0, chance: 0,
};

function pctChange(next: number, base: number): number {
    if (base <= 0) return 0;
    return (next / base - 1) * 100;
}

function summarise(picks: SlotPick[], projected: boolean, uncalibrated: boolean): GearPlan {
    const changes = picks.filter(p => p.changed);
    // Percentages of the same hero total add up closely enough at these
    // magnitudes; the alternative is re-ranking every slot against a moving
    // base, which would make each slot's number depend on the order.
    const plan: GearPlan = {
        picks,
        changes,
        totalValuePct: changes.reduce((s, p) => s + p.valuePct, 0),
        totalResonanceDelta: changes.reduce((s, p) => s + p.resonanceDelta, 0),
        totalUnpricedResonanceDelta: changes.reduce((s, p) => s + p.unpricedResonanceDelta, 0),
    };
    if (uncalibrated) plan.uncalibrated = true;
    if (projected) {
        plan.totalProjectedValuePct = changes.reduce((s, p) => s + (p.projectedValuePct ?? 0), 0);
        plan.totalProjectedResonanceDelta = changes.reduce((s, p) => s + (p.projectedResonanceDelta ?? 0), 0);
    }
    return plan;
}

/**
 * "Current Best Gear": per slot the item with the highest value *today*.
 *
 * Ordering is battle value first, active resonance second. This never makes
 * the player weaker and never leaves a slot empty.
 *
 * The earlier version of this ranked on the plain sum of an item's five
 * caracs, which valued a point of endurance exactly like a point of damage.
 * Run against the real inventory it wanted to strip all six mythics for
 * legendaries carrying 43,301 endurance and nothing else -- items that add
 * zero damage and zero crit. Hence `battleValue`.
 */
export function planCurrentBest(
    items: ArmorItem[],
    playerClass: PlayerClass,
    theme: GearTheme,
    hero: HeroTotals | null,
): GearPlan {
    const totals = hero ?? FALLBACK_HERO_TOTALS;
    const picks: SlotPick[] = [];
    for (const [slot, candidates] of bySlot(items)) {
        const current = candidates.find(i => i.equipped) ?? null;
        const base = current ? current.caracs : null;
        const ranked = [...candidates].sort((a, b) => {
            const value = cmp(
                pricedValue(a.caracs, base, playerClass, totals, resonanceSplit(a, playerClass, theme)),
                pricedValue(b.caracs, base, playerClass, totals, resonanceSplit(b, playerClass, theme)),
            );
            if (value !== 0) return value;
            // Only the bonuses the value could not price are left to decide.
            return cmp(
                resonanceSplit(a, playerClass, theme).unpriced,
                resonanceSplit(b, playerClass, theme).unpriced,
            );
        });
        picks.push(buildPick(slot, ranked[0] ?? null, current, playerClass, theme, totals));
    }
    return summarise(picks, false, hero === null);
}

/**
 * "Possible Best Gear": per slot the item that would be strongest once
 * everything sits at max level.
 *
 * This deliberately equips items that are weaker *today* -- the same
 * behaviour as "Best Possible" on the team page, which fields a level-1
 * girl because she is the better target. The cost of that choice is
 * reported per slot (`valuePct`) and in the summary, so the player sees the
 * gap instead of only having it.
 *
 * A mythic with the right theme but the wrong class is not a hit and lands
 * in tier 3, where it competes on battle value like anything else. It can
 * still win that tier -- if it is the only mythic for its slot, wearing it
 * really is the strongest projected option -- and the upgrade step then
 * simply may not consume it, because it is equipped.
 */
export function planPossibleBest(
    items: ArmorItem[],
    playerClass: PlayerClass,
    theme: GearTheme,
    hero: HeroTotals | null,
): GearPlan {
    const totals = hero ?? FALLBACK_HERO_TOTALS;
    const picks: SlotPick[] = [];
    for (const [slot, candidates] of bySlot(items)) {
        const current = candidates.find(i => i.equipped) ?? null;
        const projections = new Map<ArmorItem, { caracs: ArmorCaracs; unreliable: boolean }>();
        for (const item of candidates) projections.set(item, projectCaracs(item));
        // Both sides projected: the slot's own item will be levelled too, so
        // comparing a projected candidate against today's worn item would
        // overstate every swap.
        const currentProj = current ? projectCaracs(current) : null;
        const base = currentProj ? currentProj.caracs : null;

        const ranked = [...candidates].sort((a, b) => {
            const tier = possibleBestTier(a, playerClass, theme) - possibleBestTier(b, playerClass, theme);
            if (tier !== 0) return tier;
            const value = cmp(
                pricedValue(projections.get(a)!.caracs, base, playerClass, totals,
                    resonanceSplit(a, playerClass, theme, true)),
                pricedValue(projections.get(b)!.caracs, base, playerClass, totals,
                    resonanceSplit(b, playerClass, theme, true)),
            );
            if (value !== 0) return value;
            return cmp(
                resonanceSplit(a, playerClass, theme, true).unpriced,
                resonanceSplit(b, playerClass, theme, true).unpriced,
            );
        });

        const chosen = ranked[0] ?? null;
        const pick = buildPick(slot, chosen, current, playerClass, theme, totals);
        if (chosen) {
            const chosenProj = projections.get(chosen)!;
            pick.tier = possibleBestTier(chosen, playerClass, theme);
            pick.projectedValuePct = pctChange(
                pricedValue(chosenProj.caracs, base, playerClass, totals,
                    resonanceSplit(chosen, playerClass, theme, true)),
                pricedValue(base ?? ZERO_CARACS, base, playerClass, totals,
                    current ? resonanceSplit(current, playerClass, theme, true)
                            : { damage: 0, ego: 0, unpriced: 0 }),
            );
            pick.projectedResonanceDelta = projectedResonance(chosen, playerClass, theme)
                - (current ? projectedResonance(current, playerClass, theme) : 0);
            if (chosenProj.unreliable || currentProj?.unreliable) {
                pick.projectionUnreliable = true;
            }
        }
        picks.push(pick);
    }
    return summarise(picks, true, hero === null);
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

/**
 * Hero totals out of an equip response's `caracs` block, or out of the
 * cached copy of one. Returns null unless both fields the ranking needs are
 * present and positive -- a half-read total would silently reshape every
 * ranking instead of falling back visibly.
 */
export function parseHeroTotals(raw: any): HeroTotals | null {
    if (!raw || typeof raw !== 'object') return null;
    const primary = Number(raw.primary_carac_amount ?? raw.primary);
    const endurance = Number(raw.endurance);
    if (!Number.isFinite(primary) || primary <= 0) return null;
    if (!Number.isFinite(endurance) || endurance <= 0) return null;
    return {
        primary,
        secondary: Number(raw.secondary_caracs_sum ?? raw.secondary) || 0,
        endurance,
        chance: Number(raw.chance) || 0,
    };
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
