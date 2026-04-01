// TeamScoringService.ts -- Scoring engine for team selection v3.
//
// Provides Tier 3 trait matching, element synergy calculations,
// and leader skill evaluation for team optimization.
//
// Two modes (both filter Mythic + Legendary only):
//   - "Current Best": uses current stats (blessed)
//   - "Best Possible": projects stats to max level + full grades

export type ElementType = 'fire' | 'water' | 'nature' | 'stone' | 'sun' | 'darkness' | 'psychic' | 'light';
export type RarityType = 'starting' | 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type TraitCategory = 'eyeColor' | 'hairColor' | 'zodiac' | 'position';

export interface GirlData {
    id_girl: number;
    name: string;
    carac1: number;
    carac2: number;
    carac3: number;
    level: number;
    element: ElementType;
    rarity: RarityType;
    graded: number;       // grades currently applied
    nb_grades: number;    // total grades available for this rarity
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
    score: number;        // count × avg_stats, with position penalty
}

// Synergy bonus multiplier per girl of each element in the team
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

// Tier-5 skill mapping by element, with priority ranking
// Priority: Shield (light/stone) > Stun (sun/darkness) > Execute (fire/water) > Reflect
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

// Position penalty factor (position trait reduces attack stats via equipment)
const POSITION_TRAIT_PENALTY = 0.80;

// Rarities allowed for team selection (both modes)
const HIGH_RARITIES: Set<RarityType> = new Set(['mythic', 'legendary']);

// Tier 3 bonus per matching teammate: 1.0% for Mythic, 0.8% for Legendary
const TIER3_BONUS_MYTHIC = 0.01;
const TIER3_BONUS_LEGENDARY = 0.008;

export class TeamScoringService {

    /**
     * Get the raw stat sum for a girl (carac1 + carac2 + carac3).
     * Uses caracs sub-object if available, falls back to direct fields.
     */
    static getStatSum(girl: GirlData): number {
        if (girl.caracs) {
            return girl.caracs.carac1 + girl.caracs.carac2 + girl.caracs.carac3;
        }
        return girl.carac1 + girl.carac2 + girl.carac3;
    }

    /**
     * Score a girl for "Current Best" mode.
     * Simply returns the current stat sum (already includes blessings).
     */
    static scoreCurrentBest(girl: GirlData): number {
        return TeamScoringService.getStatSum(girl);
    }

    /**
     * Score a girl for "Best Possible" mode.
     * Projects stats to max level and full grades.
     *
     * Formula:
     *   potential = currentStats / level × playerLevel / (1 + 0.3 × currentGrades) × (1 + 0.3 × maxGrades)
     */
    static scoreBestPossible(girl: GirlData, playerLevel: number): number {
        const currentStats = TeamScoringService.getStatSum(girl);
        const level = girl.level || 1;
        const currentGrades = girl.graded || 0;
        const maxGrades = girl.nb_grades || 0;

        const levelFactor = playerLevel / Math.max(level, 1);
        const gradeDeflator = 1 + 0.3 * currentGrades;
        const gradeInflator = 1 + 0.3 * maxGrades;

        return (currentStats * levelFactor / gradeDeflator) * gradeInflator;
    }

    /**
     * Filter girls: only Mythic and Legendary (both modes).
     */
    static filterHighRarity(girls: GirlData[]): GirlData[] {
        return girls.filter(g => HIGH_RARITIES.has(g.rarity));
    }

    /**
     * Get the Tier-5 skill info for a given element.
     */
    static getTier5Skill(element: ElementType): Tier5Skill {
        return ELEMENT_TO_TIER5[element];
    }

    // ─── Trait / Tier 3 Logic ─────────────────────────────────────────

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
     *
     * Each girl checks how many teammates share her element pair's trait value.
     * Mythic: 1.0% per matching teammate, Legendary: 0.8% per matching teammate.
     * The bonus is calculated per girl and summed for the team total.
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
     * Find all possible trait groups from a pool of girls.
     *
     * For each element pair, groups girls by their shared trait value
     * and scores each group. Position groups receive a penalty.
     *
     * Returns groups sorted by score descending.
     */
    static findTraitGroups(girls: GirlData[]): TraitGroupResult[] {
        const results: TraitGroupResult[] = [];

        for (const pair of ELEMENT_PAIRS) {
            const pairGirls = girls.filter(g => pair.elements.includes(g.element));
            if (pairGirls.length === 0) continue;

            // Group by trait value
            const groups = new Map<string, GirlData[]>();
            for (const girl of pairGirls) {
                const value = TeamScoringService.getTraitValue(girl);
                if (!value) continue;
                if (!groups.has(value)) groups.set(value, []);
                groups.get(value)!.push(girl);
            }

            for (const [traitValue, groupGirls] of groups) {
                const avgStats = groupGirls.reduce((sum, g) => sum + TeamScoringService.getStatSum(g), 0) / groupGirls.length;
                let score = groupGirls.length * avgStats;

                // Position trait penalty (reduces attack stats via equipment)
                if (pair.trait === 'position') {
                    score *= POSITION_TRAIT_PENALTY;
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

    // ─── Synergy Calculations (secondary factor) ─────────────────────

    /**
     * Calculate synergy bonuses for a set of elements (one per team member).
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
     * Weighs each synergy type by its combat impact.
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

    /**
     * Score a girl's contribution to a team, considering both stats and
     * the synergy bonus she adds. Used as tiebreaker when filling remaining slots.
     */
    static scoreWithSynergy(
        girl: GirlData,
        teamElements: ElementType[],
        statScore: number,
        maxStatInPool: number,
        synergyWeight: number = 0.05
    ): number {
        const currentSynergyValue = TeamScoringService.calculateSynergyValue(teamElements);
        const newSynergyValue = TeamScoringService.calculateSynergyValue([...teamElements, girl.element]);
        const synergyDelta = newSynergyValue - currentSynergyValue;

        const normalizedSynergyBonus = maxStatInPool > 0
            ? (synergyDelta / maxStatInPool) * maxStatInPool
            : 0;

        return statScore + synergyWeight * normalizedSynergyBonus;
    }

    // ─── Leader Selection ────────────────────────────────────────────

    /**
     * Rank leader candidates by element priority (Shield > Stun > Execute > Reflect).
     * Leader must be Mythic. Among same priority: prefer trait match, then highest stats.
     *
     * @param traitCategory - The team's chosen trait category
     * @param traitValue    - The team's chosen trait value
     */
    static rankLeaderCandidates(
        girls: GirlData[],
        statScores: Map<number, number>,
        traitCategory?: TraitCategory,
        traitValue?: string
    ): GirlData[] {
        // Only Mythic girls can be leaders
        const mythicGirls = girls.filter(g => g.rarity === 'mythic');
        if (mythicGirls.length === 0) {
            // Fallback: allow all girls if no mythics available
            return TeamScoringService._sortLeaderCandidates(girls, statScores, traitCategory, traitValue);
        }
        return TeamScoringService._sortLeaderCandidates(mythicGirls, statScores, traitCategory, traitValue);
    }

    private static _sortLeaderCandidates(
        girls: GirlData[],
        statScores: Map<number, number>,
        traitCategory?: TraitCategory,
        traitValue?: string
    ): GirlData[] {
        return [...girls].sort((a, b) => {
            const tier5A = ELEMENT_TO_TIER5[a.element];
            const tier5B = ELEMENT_TO_TIER5[b.element];

            // Primary: Tier-5 priority (Shield > Stun > Execute > Reflect)
            if (tier5A.priority !== tier5B.priority) {
                return tier5B.priority - tier5A.priority;
            }

            // Secondary: trait match bonus (does the leader match the team's trait?)
            if (traitCategory && traitValue) {
                const aMatches = TeamScoringService._leaderMatchesTrait(a, traitCategory, traitValue);
                const bMatches = TeamScoringService._leaderMatchesTrait(b, traitCategory, traitValue);
                if (aMatches !== bMatches) {
                    return aMatches ? -1 : 1;
                }
            }

            // Tertiary: stat score
            const scoreA = statScores.get(a.id_girl) || 0;
            const scoreB = statScores.get(b.id_girl) || 0;
            return scoreB - scoreA;
        });
    }

    /**
     * Check if a leader candidate matches the team's trait.
     * The leader's own element determines her trait category —
     * she only matches if her element uses the same trait category as the team.
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
}
