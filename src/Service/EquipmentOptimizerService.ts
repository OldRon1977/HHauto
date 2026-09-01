// EquipmentOptimizerService.ts -- Pure ranking logic for the player's own
// equipment (the six armor slots of the hero, not girl equipment).
//
// Mechanics, data model, endpoints and the measurement traps behind all of
// this: docs-internal/equipment-resonance.md. The two decisions that shape
// this file and are NOT obvious from the code alone:
//
//   1. Items are ranked by PRIORITY TIERS, not by a computed stat score.
//      Two stat models were tried and both recommended trading mythics away
//      for legendaries; a crawl of all 99 players in the league settled it:
//      582 of 594 equipped slots are mythic, 576 of them at level 20, and
//      every player in the top 25 wears 6/6 mythic. The four players holding
//      legendaries sit at places 49, 60, 80 and 95. Any score that
//      contradicts that is wrong, however well it is argued.
//
//      A stat score cannot be made right here either: a mythic at level 20
//      pays out across all five caracs, and the theme resonance axis lands
//      on defense or chance in all 582 measured cases -- the two axes no
//      client-side measurement can weigh. The tiers encode what strong
//      players actually do instead of pricing what cannot be priced.
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
type ResonanceTarget = 'damage' | 'ego' | 'defense' | 'chance';

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

interface ArmorResonance {
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
     *  Measured on the live page: an item in `#equiped` carries *only*
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
    /** skin.identifier, e.g. "EA23". Stable across levels and equips, which is
     *  what makes a level-independent identity possible (EquipmentKeepService). */
    skin: string;
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

// Raw stat curves of a mythic player item, measured on the live page. carac1..3
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

interface SlotPick {
    slot: number;
    /** The item the button wants to wear. null when the slot has no
     *  candidate at all. */
    chosen: ArmorItem | null;
    /** What is worn right now, for the cost report. */
    current: ArmorItem | null;
    /** false when `chosen` is already equipped -- no ajax call needed. */
    changed: boolean;
    /** Which tier the chosen item landed in. See `gearTier`. */
    tier: number;
    /** Raw carac points the swap costs or gains *today*, summed over all
     *  five stats. Reported, never ranked on -- ranking on this is what
     *  produced the mythic-for-legendary recommendation. "Possible Best" is
     *  expected to go negative; that is the gap the upgrade step closes. */
    caracDelta: number;
    /** Active resonance percentage points gained today. */
    resonanceDelta: number;
    /** Possible Best only: resonance percentage points once the chosen item
     *  is at max level. */
    projectedResonanceDelta?: number;
    /** Set when the item's own caracs contradict the mythic curve, so the
     *  projection fell back to the measured values. */
    projectionUnreliable?: boolean;
}

export interface GearPlan {
    picks: SlotPick[];
    /** Slots that actually need an equip call. */
    changes: SlotPick[];
    /** Raw carac points the whole plan costs or gains today. */
    totalCaracDelta: number;
    totalResonanceDelta: number;
    /** Possible Best only: resonance once everything is at max level. */
    totalProjectedResonanceDelta?: number;
}

/** The item's class carac -- the one the game tracks as
 *  `primary_carac_amount`. The other two are off-class and feed defense. */
function classCarac(caracs: ArmorCaracs, playerClass: PlayerClass): number {
    return playerClass === 1 ? caracs.carac1
        : playerClass === 2 ? caracs.carac2
        : caracs.carac3;
}

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

/** Which button is asking. "current" judges an item as it is today;
 *  "possible" judges it as it will be once levelled to the cap. */
export type GearMode = 'current' | 'possible';

/** Sum of all five caracs. Reported as the cost of a swap, never used to
 *  rank -- see the note at the top of this file. */
export function caracSum(caracs: ArmorCaracs): number {
    return caracs.carac1 + caracs.carac2 + caracs.carac3
        + caracs.endurance + caracs.chance;
}

/** Total active resonance in percentage points, at the item's own level or
 *  projected to the cap. */
function resonancePoints(
    item: ArmorItem,
    playerClass: PlayerClass,
    theme: GearTheme,
    projected: boolean,
): number {
    return projected
        ? projectedResonance(item, playerClass, theme)
        : activeResonance(item, playerClass, theme);
}

/**
 * The priority ladder. Lower is better.
 *
 *   1  mythic at cap, class AND theme match
 *   2  mythic at cap, class match
 *   3  mythic at cap, theme match
 *   4  mythic at cap, no match
 *   5  everything else -- ranked on stats, then resonance
 *
 * Tiers 1..4 need the item to be at MYTHIC_MAX_LEVEL, but what counts as
 * "at cap" depends on the button. "Possible Best" projects, so an unlevelled
 * mythic already qualifies: at level 20 every mythic of a slot has exactly
 * the same caracs (measured across 576 equipped slots, all
 * 4000/4000/4000/4000/5000), which is why that button needs no stat maths at
 * all. "Current Best" judges today, so an unlevelled mythic drops to tier 5
 * and competes on its real stats -- otherwise it would put a level-1 mythic
 * worth 11,500 carac points over a legendary worth ~18,600 and leave the
 * player weaker, which is the one thing that button promises not to do.
 *
 * Tier 5 also holds every legendary and epic. Those carry no resonance at
 * all: of the 12 legendary slots in the league, none had a class or theme
 * bonus.
 */
export function gearTier(
    item: ArmorItem,
    playerClass: PlayerClass,
    theme: GearTheme,
    mode: GearMode,
): number {
    if (item.rarity !== 'mythic') return 5;
    if (mode === 'current' && item.level < MYTHIC_MAX_LEVEL) return 5;
    const c = classMatches(item, playerClass);
    const t = themeMatches(item, theme);
    if (c && t) return 1;
    if (c) return 2;
    if (t) return 3;
    return 4;
}

/**
 * Ordering inside tier 5 only -- the fallback tier, which the league says is
 * rare (582 of 594 equipped slots were a level-20 mythic).
 *
 * The geometric mean over the four axes an item can feed: the class carac
 * (damage), the two off-class caracs (defense), endurance (ego) and chance
 * (crit). A plain sum ranks a legendary carrying 43,301 endurance and zero
 * of everything else above a balanced one, which is exactly the pick the
 * league contradicts; a geometric mean sends any item with a hole in it to
 * the bottom.
 *
 * This is a heuristic and not a measurement. The weights that would settle
 * the four axes against each other are not obtainable client-side, so
 * rather than invent them this only encodes "balanced beats one-sided".
 */
export function fallbackScore(caracs: ArmorCaracs, playerClass: PlayerClass): number {
    const offClass = caracSum(caracs)
        - classCarac(caracs, playerClass) - caracs.endurance - caracs.chance;
    const axes = [
        classCarac(caracs, playerClass),
        offClass,
        caracs.endurance,
        caracs.chance,
    ].map(v => Math.max(0, v));
    if (axes.some(v => v === 0)) return 0;
    return Math.exp(axes.reduce((s, v) => s + Math.log(v), 0) / axes.length);
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
    mode: GearMode,
): SlotPick {
    const currentCaracs = current ? caracSum(current.caracs) : 0;
    const currentRes = current ? activeResonance(current, playerClass, theme) : 0;
    const pick: SlotPick = {
        slot,
        chosen,
        current,
        changed: chosen !== null && !chosen.equipped,
        tier: chosen ? gearTier(chosen, playerClass, theme, mode) : 0,
        caracDelta: chosen ? caracSum(chosen.caracs) - currentCaracs : 0,
        resonanceDelta: chosen ? activeResonance(chosen, playerClass, theme) - currentRes : 0,
    };
    if (mode === 'possible' && chosen) {
        pick.projectedResonanceDelta = projectedResonance(chosen, playerClass, theme)
            - (current ? projectedResonance(current, playerClass, theme) : 0);
    }
    return pick;
}

/** Rank candidates for one slot: tier first, then -- inside a tier -- the
 *  stats where they can still differ, then the size of the resonance.
 *
 *  The resonance tiebreak is not cosmetic: at level 20 the class axis is
 *  always worth 2pp, while the theme axis pays 4pp when it lands on chance
 *  and 2pp when it lands on defense (279 vs 297 of the 576 measured slots).
 *  Two tier-1 items can therefore be worth 6pp or 4pp. */
function rankForSlot(
    candidates: ArmorItem[],
    playerClass: PlayerClass,
    theme: GearTheme,
    mode: GearMode,
): ArmorItem[] {
    const projected = mode === 'possible';
    return [...candidates].sort((a, b) => {
        const tier = gearTier(a, playerClass, theme, mode) - gearTier(b, playerClass, theme, mode);
        if (tier !== 0) return tier;
        // Inside tiers 1..4 every item has identical caracs, so this only
        // ever separates tier-5 items.
        const stats = cmp(
            fallbackScore(a.caracs, playerClass),
            fallbackScore(b.caracs, playerClass),
        );
        if (stats !== 0) return stats;
        return cmp(
            resonancePoints(a, playerClass, theme, projected),
            resonancePoints(b, playerClass, theme, projected),
        );
    });
}

function plan(
    items: ArmorItem[],
    playerClass: PlayerClass,
    theme: GearTheme,
    mode: GearMode,
): GearPlan {
    const picks: SlotPick[] = [];
    for (const [slot, candidates] of bySlot(items)) {
        const current = candidates.find(i => i.equipped) ?? null;
        const ranked = rankForSlot(candidates, playerClass, theme, mode);
        picks.push(buildPick(slot, ranked[0] ?? null, current, playerClass, theme, mode));
    }
    const changes = picks.filter(p => p.changed);
    const out: GearPlan = {
        picks,
        changes,
        totalCaracDelta: changes.reduce((s, p) => s + p.caracDelta, 0),
        totalResonanceDelta: changes.reduce((s, p) => s + p.resonanceDelta, 0),
    };
    if (mode === 'possible') {
        out.totalProjectedResonanceDelta = changes.reduce(
            (s, p) => s + (p.projectedResonanceDelta ?? 0), 0);
    }
    return out;
}

/**
 * "Current Best Gear": per slot the best item the player owns *today*.
 *
 * Never leaves a slot empty and never makes the player weaker: an
 * unlevelled mythic is judged on its real stats, so it cannot displace a
 * stronger legendary just for being mythic.
 */
export function planCurrentBest(
    items: ArmorItem[],
    playerClass: PlayerClass,
    theme: GearTheme,
): GearPlan {
    return plan(items, playerClass, theme, 'current');
}

/**
 * "Possible Best Gear": per slot the item that will be strongest once it is
 * levelled to the cap.
 *
 * Only the tier matters here. Every mythic reaches the same caracs at level
 * 20, so the choice is purely which resonances it carries -- no projection
 * arithmetic, no stat comparison. It deliberately equips items that are
 * weaker today, the same way "Best Possible" on the team page fields a
 * level-1 girl; `caracDelta` says by how much, per slot and in total.
 */
export function planPossibleBest(
    items: ArmorItem[],
    playerClass: PlayerClass,
    theme: GearTheme,
): GearPlan {
    return plan(items, playerClass, theme, 'possible');
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
 * Measured on `teams.html?battle_type=leagues`: an entry carries
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
 * id fields (measured). An item read from `#equiped` has
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
        skin: String(raw?.skin?.identifier ?? ''),
        name: String(raw?.skin?.name ?? ''),
        caracs,
        classResonance: toResonance(res.class),
        themeResonance: toResonance(res.theme),
        equipped: isEquipped,
    };
}
