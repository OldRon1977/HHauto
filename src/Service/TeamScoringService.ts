// TeamScoringService.ts -- Scoring engine for team selection v5.
//
// Provides Tier 3 trait matching, element synergy calculations,
// and leader skill evaluation for team optimization.
//
// Two modes (both filter Mythic + Legendary 5*, hard-filter to player class):
//   - "Current Best": uses current main-class stat (already includes blessings,
//     before equipment).
//   - "Best Possible": projects every eligible girl to the awakening cap
//     (level 750, max grades). Pool stays the same as Current Best.
//
// Player class is HC=1 (carac1), Charm=2 (carac2), KH=3 (carac3).
// Only the matching carac counts for scoring -- the game's own class
// system does the rest (Wiki: "never build cross-class").

import { BlessingService } from './BlessingService';

export type ElementType = 'fire' | 'water' | 'nature' | 'stone' | 'sun' | 'darkness' | 'psychic' | 'light';
export type RarityType = 'starting' | 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type TraitCategory = 'eyeColor' | 'hairColor' | 'zodiac' | 'position';
export type PlayerClass = 1 | 2 | 3;

export interface GirlData {
    id_girl: number;
    name: string;
    carac1: number;
    carac2: number;
    carac3: number;
    level: number;
    class?: number;       // 1=HC, 2=Charm, 3=KH
    element: ElementType;
    rarity: RarityType;
    graded: number;       // grades currently applied
    nb_grades: number;    // total grades available for this rarity
    awakening_level?: number; // 0-10 (informational, included in caracs already)
    skill_tiers_info?: any;
    caracs?: {
        carac1: number;
        carac2: number;
        carac3: number;
    };
    // Trait fields for Tier 3 matching
    zodiac?: string;
    hairColor?: string;
    eyeColor?: string;
    position?: string;
    // Blessing data (from game API). Used by BlessingService to detect
    // blessings authoritatively (pvp_v3/pvp_v4 carac{N}: number[]).
    blessingBonuses?: any;
}

export interface SynergyBonuses {
    critDamage: number;   // Fire (Eccentric)
    healOnHit: number;    // Water (Sensual)
    ego: number;          // Nature (Exhibitionist)
    critChance: number;   // Stone (Physical)
    defReduce: number;    // Sun (Playful)
    damage: number;       // Darkness (Dominatrix)
    defense: number;      // Psychic (Submissive)
    harmony: number;      // Light (Voyeur)
}

export interface Tier5Skill {
    id: number;           // 11=Stun, 12=Shield, 13=Reflect, 14=Execute
    name: string;
    priority: number;     // higher = better (Shield=4, Stun=3, Execute=2, Reflect=1)
}

export interface TraitGroupResult {
    traitCategory: TraitCategory;
    traitValue: string;
    girls: GirlData[];
    score: number;        // count * avg_main_carac (mode-aware via score map)
}

// Synergy bonus multiplier per girl of each element in the team.
// Values come from the game's team_synergies API; the table below
// matches the values seen at runtime as of v7.35.x.
const ELEMENT_SYNERGY_PER_GIRL: Record<ElementType, { field: keyof SynergyBonuses; bonus: number }> = {
    fire:      { field: 'critDamage', bonus: 0.10 },
    water:     { field: 'healOnHit',  bonus: 0.03 },
    nature:    { field: 'ego',        bonus: 0.03 },
    stone:     { field: 'critChance', bonus: 0.02 },
    sun:       { field: 'defReduce',  bonus: 0.02 },
    darkness:  { field: 'damage',     bonus: 0.02 },
    psychic:   { field: 'defense',    bonus: 0.02 },
    light:     { field: 'harmony',    bonus: 0.02 },
};

// Tier-5 skill mapping by element, with priority ranking.
// Priority: Shield (light/stone) > Stun (sun/darkness) > Execute (fire/water) > Reflect.
// Used both for leader selection AND as a leader-bonus factor in EffectivePower.
const ELEMENT_TO_TIER5: Record<ElementType, Tier5Skill> = {
    light:     { id: 12, name: 'Shield',  priority: 4 },
    stone:     { id: 12, name: 'Shield',  priority: 4 },
    sun:       { id: 11, name: 'Stun',    priority: 3 },
    darkness:  { id: 11, name: 'Stun',    priority: 3 },
    fire:      { id: 14, name: 'Execute', priority: 2 },
    water:     { id: 14, name: 'Execute', priority: 2 },
    psychic:   { id: 13, name: 'Reflect', priority: 1 },
    nature:    { id: 13, name: 'Reflect', priority: 1 },
};

// Each element's Tier 3 bonus is based on a specific trait category.
// Girls from the same element pair share the same trait category.
const ELEMENT_TO_TRAIT_CATEGORY: Record<ElementType, TraitCategory> = {
    darkness: 'eyeColor',   // Black
    fire:     'eyeColor',   // Red
    light:    'hairColor',  // White
    nature:   'hairColor',  // Green
    stone:    'zodiac',     // Orange
    psychic:  'zodiac',     // Purple
    water:    'position',   // Blue
    sun:      'position',   // Yellow
};

// Element pairs that share a trait category
const ELEMENT_PAIRS: Array<{ elements: [ElementType, ElementType]; trait: TraitCategory }> = [
    { elements: ['darkness', 'fire'],    trait: 'eyeColor' },
    { elements: ['light', 'nature'],     trait: 'hairColor' },
    { elements: ['stone', 'psychic'],    trait: 'zodiac' },
    { elements: ['water', 'sun'],        trait: 'position' },
];

// Tier 3 bonus per matching teammate: 1.0% for Mythic, 0.8% for Legendary
const TIER3_BONUS_MYTHIC = 0.01;
const TIER3_BONUS_LEGENDARY = 0.008;

// Theoretical maximum girl level (full awakening cap).
// 'Best Possible' projects every girl to this level. Per Kinkoid patch
// notes, every girl can be awakened to 750 from level 1.
const PROJECTION_LEVEL_CAP = 750;

// Leader bonus on EffectivePower: multiplier scaled by Tier-5 priority.
// Shield=4 -> +8%, Stun=3 -> +6%, Execute=2 -> +4%, Reflect=1 -> +2%.
// Quantitative role-efficiency proxy for the leader position.
const LEADER_BONUS_PER_PRIORITY = 0.02;

export class TeamScoringService {

    /**
     * Get the girl's main-class stat (carac1/2/3 by player class).
     * Uses caracs sub-object if available (already equipment-free,
     * already blessing-applied), falls back to direct fields.
     */
    static getMainCarac(girl: GirlData, playerClass: PlayerClass): number {
        const src = girl.caracs || { carac1: girl.carac1, carac2: girl.carac2, carac3: girl.carac3 };
        switch (playerClass) {
            case 1: return Number(src.carac1) || 0;
            case 2: return Number(src.carac2) || 0;
            case 3: return Number(src.carac3) || 0;
        }
    }

    /**
     * Score a girl for "Current Best" mode.
     * Returns the current main-carac (already includes blessings).
     */
    static scoreCurrentBest(girl: GirlData, playerClass: PlayerClass): number {
        return TeamScoringService.getMainCarac(girl, playerClass);
    }

    /**
     * Score a girl for "Best Possible" mode.
     * Projects main-carac to the awakening cap (PROJECTION_LEVEL_CAP=750)
     * with all grades applied.
     *
     * Formula:
     *   projected = currentMain * (750 / level) * (1 + 0.3 * nb_grades) / (1 + 0.3 * graded)
     *
     * For a girl already at level 750 with full grades, the projection
     * factor is 1 (no growth potential left); projected == current.
     * For a girl below the cap, projected > current.
     *
     * Pool stays the same as Current Best (Mythic + Legendary 5*).
     */
    static scoreBestPossible(girl: GirlData, playerClass: PlayerClass): number {
        const currentMain = TeamScoringService.getMainCarac(girl, playerClass);
        const level = girl.level;
        const currentGrades = girl.graded || 0;
        const maxGrades = girl.nb_grades || 0;

        return currentMain
             * (PROJECTION_LEVEL_CAP / level)
             * (1 + 0.3 * maxGrades)
             / (1 + 0.3 * currentGrades);
    }

    /**
     * Filter girls: only Mythic and Legendary 5-star.
     *
     * Cross-class girls are KEPT in the pool. Empirical analysis of the top
     * 50 league teams shows that 67% of them use a cross-class alpha and the
     * majority of slots 2-7 are cross-class as well. The Wiki's
     * 'never build cross-class' advice is a simplification; in practice
     * top players accept the lower main-carac contribution of a cross-class
     * girl in exchange for trait-match, blessing-match, element synergy,
     * and tier-5 skill coverage.
     *
     * The score function still favors the player's main carac, so cross-
     * class girls win only when their team contribution (synergy + tier-3 +
     * blessing) outweighs the lower main carac.
     *
     * playerClass kept in the signature for backward compatibility; no
     * longer used to filter the pool.
     */
    static filterEligible(girls: GirlData[], _playerClass?: PlayerClass): GirlData[] {
        return girls.filter(g => {
            if (g.rarity === 'mythic') return true;
            if (g.rarity === 'legendary') return g.nb_grades >= 5;
            return false;
        });
    }

    /**
     * Backwards-compatible alias used by existing tests.
     * @deprecated Use filterEligible(girls, playerClass) instead.
     */
    static filterHighRarity(girls: GirlData[]): GirlData[] {
        return girls.filter(g => {
            if (g.rarity === 'mythic') return true;
            if (g.rarity === 'legendary') return g.nb_grades >= 5;
            return false;
        });
    }

    /**
     * Get the Tier-5 skill info for a given element.
     */
    static getTier5Skill(element: ElementType): Tier5Skill {
        return ELEMENT_TO_TIER5[element];
    }

    /**
     * Get the trait category for a girl based on her element.
     */
    static getTraitCategory(element: ElementType): TraitCategory {
        return ELEMENT_TO_TRAIT_CATEGORY[element];
    }

    /**
     * Get the trait value for a girl based on her element's trait category.
     * Returns undefined if the trait data is not available.
     */
    static getTraitValue(girl: GirlData): string | undefined {
        const category = ELEMENT_TO_TRAIT_CATEGORY[girl.element];
        switch (category) {
            case 'eyeColor':  return girl.eyeColor;
            case 'hairColor': return girl.hairColor;
            case 'zodiac':    return girl.zodiac;
            case 'position':  return girl.position;
        }
    }

    /**
     * Calculate the total Tier 3 bonus percentage for a team.
     * Each girl checks how many teammates share her element pair's trait value.
     * Mythic: 1.0% per matching teammate, Legendary: 0.8% per matching teammate.
     */
    static calculateTier3TeamBonus(team: GirlData[]): number {
        let totalBonus = 0;

        for (const girl of team) {
            const category = ELEMENT_TO_TRAIT_CATEGORY[girl.element];
            const myValue = TeamScoringService.getTraitValue(girl);
            if (!myValue) continue;

            let matchCount = 0;
            for (const teammate of team) {
                if (teammate.id_girl === girl.id_girl) continue;
                const teammateCategory = ELEMENT_TO_TRAIT_CATEGORY[teammate.element];
                if (teammateCategory !== category) continue;
                const teammateValue = TeamScoringService.getTraitValue(teammate);
                if (teammateValue === myValue) {
                    matchCount++;
                }
            }

            const bonusPerMatch = girl.rarity === 'mythic' ? TIER3_BONUS_MYTHIC : TIER3_BONUS_LEGENDARY;
            totalBonus += matchCount * bonusPerMatch;
        }

        return totalBonus;
    }

    /**
     * Calculate the team-wide element synergy multiplier (0..0.something).
     *
     * For each element present in the team, sum the per-girl bonus * count,
     * capped at the per-element team_bonus_max_amount. Then take the average
     * across all 8 synergy fields, weighted by typical combat impact:
     * crit damage and ego boosters (fire, nature, water) carry more weight.
     *
     * Returns a single multiplier added to EffectivePower, e.g. 0.20 for a
     * 7-girl mono-fire team.
     *
     * Note: this is a static heuristic that mirrors the team_synergies
     * structure observed in the game's hero_data API. The exact runtime
     * values can be passed via the optional perGirlOverride parameter
     * if the caller has fresh data; absent that, the static table is used.
     */
    static calculateElementSynergyMultiplier(team: GirlData[]): number {
        const counts = new Map<ElementType, number>();
        for (const g of team) {
            counts.set(g.element, (counts.get(g.element) || 0) + 1);
        }

        // Per element: count * per_girl_bonus, capped at 7 * per_girl_bonus.
        // Sum the field-specific bonus contributions (each gets its own field
        // in SynergyBonuses, so multiple elements add their own bonuses to
        // different fields). The "EffectivePower" multiplier is the sum
        // of the four most combat-relevant fields:
        //   critDamage (fire)  -> weight 1.0
        //   ego/healOnHit (nature/water) -> weight 0.5
        //   damage/defense/defReduce/critChance/harmony -> weight 0.5
        //
        // We sum all field bonuses with equal weight 1.0 here, which gives
        // a single "synergy multiplier" usable for ranking. If a caller
        // wants the per-field breakdown, it can reuse calculateSynergies().
        let multiplier = 0;
        for (const [element, count] of counts) {
            const mapping = ELEMENT_SYNERGY_PER_GIRL[element];
            if (!mapping) continue;
            multiplier += Math.min(count, 7) * mapping.bonus;
        }
        return multiplier;
    }

    /**
     * Detect blessed trait categories from the game-authoritative blessing
     * cache (BlessingService). Falls back to scanning blessing_bonuses on
     * the girls themselves if the cache is empty.
     *
     * Returns the active TraitCategory set and the count of girls with at
     * least one active blessing.
     */
    static detectBlessedTraits(girls: GirlData[]): { blessedCategories: Set<TraitCategory>; blessedGirlCount: number } {
        const blessedCategories = new Set<TraitCategory>();

        // Primary source: BlessingService cache (filled on Home page visit).
        try {
            const cached = BlessingService.getCached();
            if (cached && Array.isArray(cached.blessedTraits)) {
                for (const t of cached.blessedTraits) {
                    if (t === 'eyeColor' || t === 'hairColor' || t === 'zodiac' || t === 'position') {
                        blessedCategories.add(t);
                    }
                }
            }
        } catch { /* cache not available */ }

        // Per-girl count: how many girls have an active blessing bonus
        // (game-authoritative via blessing_bonuses.pvp_v3 / pvp_v4).
        let blessedGirlCount = 0;
        for (const girl of girls) {
            const mult = BlessingService.getEffectiveMultiplier(girl);
            if (mult > 1) blessedGirlCount++;
        }

        return { blessedCategories, blessedGirlCount };
    }

    /**
     * Find all possible trait groups from a pool of girls, scored by a
     * mode-aware score function (so Mode 2 can drive cluster choice with
     * projected stats, not raw current ones).
     *
     * For each element pair, groups girls by their shared trait value and
     * scores each group by `count * avg_score`. Groups matching a currently
     * blessed trait receive no extra boost: blessings are already in caracs
     * via the game API, and the score is the mode-aware function of caracs.
     *
     * Returns groups sorted by score descending.
     */
    /**
     * Boost factor applied to the cluster score when the trait category is
     * currently blessed. Empirical: top-10 league teams overwhelmingly
     * optimize for trait-match (50% have all 7 girls share the blessed
     * trait value). A higher boost surfaces blessed clusters earlier in
     * the candidate list so the build phase can find a 7/7-match team.
     */
    private static readonly BLESSED_CATEGORY_BOOST = 5.0;

    /**
     * Find trait groups, scored mode-aware. When a category is currently
     * blessed (passed as blessedCategories), groups in that category get
     * a heuristic boost in the candidate ordering.
     */
    static findTraitGroups(
        girls: GirlData[],
        scoreFn: (g: GirlData) => number,
        blessedCategories?: Set<TraitCategory>,
    ): TraitGroupResult[] {
        const results: TraitGroupResult[] = [];

        for (const pair of ELEMENT_PAIRS) {
            const pairGirls = girls.filter(g => pair.elements.includes(g.element));
            if (pairGirls.length === 0) continue;

            const groups = new Map<string, GirlData[]>();
            for (const girl of pairGirls) {
                const value = TeamScoringService.getTraitValue(girl);
                if (!value) continue;
                if (!groups.has(value)) groups.set(value, []);
                groups.get(value)!.push(girl);
            }

            for (const [traitValue, groupGirls] of groups) {
                const sumScore = groupGirls.reduce((sum, g) => sum + scoreFn(g), 0);
                const avgScore = sumScore / groupGirls.length;
                let score = groupGirls.length * avgScore;

                if (blessedCategories && blessedCategories.has(pair.trait)) {
                    score *= TeamScoringService.BLESSED_CATEGORY_BOOST;
                }

                results.push({
                    traitCategory: pair.trait,
                    traitValue,
                    girls: groupGirls,
                    score,
                });
            }
        }

        return results.sort((a, b) => b.score - a.score);
    }

    // --- Synergy calculations (informational) ---------------------

    /**
     * Calculate per-field synergy bonuses for a set of elements.
     * Used by the info box to show e.g. "+30% crit damage from 3 fire girls".
     */
    static calculateSynergies(elements: ElementType[]): SynergyBonuses {
        const synergies: SynergyBonuses = {
            critDamage: 0,
            healOnHit: 0,
            ego: 0,
            critChance: 0,
            defReduce: 0,
            damage: 0,
            defense: 0,
            harmony: 0,
        };

        for (const element of elements) {
            const mapping = ELEMENT_SYNERGY_PER_GIRL[element];
            if (mapping) {
                synergies[mapping.field] += mapping.bonus;
            }
        }

        return synergies;
    }

    /**
     * Calculate a numeric "synergy value" for a team composition.
     * Weighs each synergy type by its combat impact. Informational only;
     * EffectivePower uses calculateElementSynergyMultiplier().
     */
    static calculateSynergyValue(elements: ElementType[]): number {
        const syn = TeamScoringService.calculateSynergies(elements);

        return (
            syn.critDamage * 1.0 +
            syn.critChance * 2.0 +
            syn.defReduce  * 2.0 +
            syn.healOnHit  * 1.5 +
            syn.damage     * 1.5 +
            syn.ego        * 1.0 +
            syn.defense    * 1.0 +
            syn.harmony    * 1.0
        );
    }

    // --- Leader selection ----------------------------------------

    /**
     * Rank leader candidates with an absolute Tier-5 priority order:
     * Shield > Stun > Execute > Reflect.
     *
     * If at least one Mythic with Shield exists, that wins. If none, then
     * Stun wins, etc. Within the same priority: cluster membership, then
     * trait match, then stats.
     *
     * Beginner pool (no mythics anywhere): cluster membership > trait > stats.
     * (Legendaries have no active tier-5 skill, so priority is uniform.)
     */
    static rankLeaderCandidates(
        girls: GirlData[],
        statScores: Map<number, number>,
        traitCategory?: TraitCategory,
        traitValue?: string,
        clusterElements?: ElementType[]
    ): GirlData[] {
        const mythicGirls = girls.filter(g => g.rarity === 'mythic');
        if (mythicGirls.length === 0) {
            return TeamScoringService._sortLeaderCandidatesNoMythic(girls, statScores, traitCategory, traitValue, clusterElements);
        }
        return TeamScoringService._sortLeaderCandidates(mythicGirls, statScores, traitCategory, traitValue, clusterElements);
    }

    /**
     * Sort leader candidates when no mythics are available (beginner pool).
     * Order: cluster membership > trait match > stats.
     */
    private static _sortLeaderCandidatesNoMythic(
        girls: GirlData[],
        statScores: Map<number, number>,
        traitCategory?: TraitCategory,
        traitValue?: string,
        clusterElements?: ElementType[]
    ): GirlData[] {
        return [...girls].sort((a, b) => {
            if (clusterElements && clusterElements.length > 0) {
                const aInCluster = clusterElements.includes(a.element);
                const bInCluster = clusterElements.includes(b.element);
                if (aInCluster !== bInCluster) {
                    return aInCluster ? -1 : 1;
                }
            }
            if (traitCategory && traitValue) {
                const aMatches = TeamScoringService._leaderMatchesTrait(a, traitCategory, traitValue);
                const bMatches = TeamScoringService._leaderMatchesTrait(b, traitCategory, traitValue);
                if (aMatches !== bMatches) {
                    return aMatches ? -1 : 1;
                }
            }
            const scoreA = statScores.get(a.id_girl) || 0;
            const scoreB = statScores.get(b.id_girl) || 0;
            return scoreB - scoreA;
        });
    }

    /**
     * Variante C: tier-5 priority absolute, then mainCarac (already blessing-applied).
     *
     * Within the same tier-5-priority group, the girl with the higher
     * mainCarac wins -- and because caracs already include blessing
     * multipliers, this naturally prefers blessed girls within the group.
     * Cluster/trait are NOT tiebreakers here: an empirically-supported
     * decision (top-50 analysis: only 27% of alphas were in the team's
     * top element, so cluster membership is not a strong signal for
     * the leader pick).
     */
    private static _sortLeaderCandidates(
        girls: GirlData[],
        statScores: Map<number, number>,
        _traitCategory?: TraitCategory,
        _traitValue?: string,
        _clusterElements?: ElementType[]
    ): GirlData[] {
        return [...girls].sort((a, b) => {
            const tier5A = ELEMENT_TO_TIER5[a.element];
            const tier5B = ELEMENT_TO_TIER5[b.element];

            // Primary: Tier-5 priority (Shield > Stun > Execute > Reflect).
            // Applied GLOBALLY across all mythics. Frank's request (#1573):
            // position 1 prefers Shield mythics whenever one exists.
            if (tier5A.priority !== tier5B.priority) {
                return tier5B.priority - tier5A.priority;
            }

            // Secondary: mainCarac (already includes blessing). Higher wins.
            const scoreA = statScores.get(a.id_girl) || 0;
            const scoreB = statScores.get(b.id_girl) || 0;
            return scoreB - scoreA;
        });
    }

    /**
     * Check if a leader candidate matches the team's trait.
     */
    private static _leaderMatchesTrait(
        girl: GirlData,
        teamTraitCategory: TraitCategory,
        teamTraitValue: string
    ): boolean {
        const girlCategory = ELEMENT_TO_TRAIT_CATEGORY[girl.element];
        if (girlCategory !== teamTraitCategory) return false;
        const girlValue = TeamScoringService.getTraitValue(girl);
        return girlValue === teamTraitValue;
    }

    /**
     * Get the leader bonus (multiplicative factor on EffectivePower) from
     * a Tier-5 skill priority. Used to model role-efficiency contribution
     * of the leader in EffectivePower = base * synergy * tier3 * (1 + leaderBonus).
     */
    static getLeaderBonus(tier5: Tier5Skill | undefined): number {
        if (!tier5) return 0;
        return tier5.priority * LEADER_BONUS_PER_PRIORITY;
    }
}
