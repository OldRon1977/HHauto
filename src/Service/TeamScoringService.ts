// TeamScoringService.ts -- Scoring engine for team selection v4.
//
// Provides Tier 3 trait matching, element synergy calculations,
// and leader skill evaluation for team optimization.
//
// Two modes (both filter Mythic + Legendary only, hard-filter to player class):
//   - "Current Best": uses current main-class stat (blessed, equipment-free)
//   - "Best Possible": projects main-class stat to player level + max grades
//
// Player class is HC=1 (carac1), Charm=2 (carac2), KH=3 (carac3).
// Only the matching carac counts for scoring -- the game's own class
// system does the rest (Wiki: "never build cross-class").

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
    // Blessing data (from game API)
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
    score: number;        // count * avg_main_carac, blessed-category boost applied
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

// Rarities allowed for team selection (both modes)
const HIGH_RARITIES: Set<RarityType> = new Set(['mythic', 'legendary']);

// Tier 3 bonus per matching teammate: 1.0% for Mythic, 0.8% for Legendary
const TIER3_BONUS_MYTHIC = 0.01;
const TIER3_BONUS_LEGENDARY = 0.008;

// Blessed-category boost when scoring trait groups (heuristic only;
// the actual stat impact already lives inside girl.caracs once the
// game applies the weekly blessing).
const BLESSED_CATEGORY_BOOST = 1.5;

export class TeamScoringService {

    /**
     * Get the girl's main-class stat (carac1/2/3 by player class).
     * Uses caracs sub-object if available (already equipment-free),
     * falls back to direct fields.
     *
     * Player class -> stat field:
     *   1 (Hardcore) -> carac1
     *   2 (Charm)    -> carac2
     *   3 (Know-how) -> carac3
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
     * Projects main-carac to player level and full grades.
     *
     * Formula:
     *   potential = currentMainCarac / level * playerLevel
     *               / (1 + 0.3 * currentGrades) * (1 + 0.3 * maxGrades)
     *
     * Returns max(projected, current) so blessing-inflated current
     * stats never get demoted by the projection.
     */
    static scoreBestPossible(girl: GirlData, playerClass: PlayerClass, playerLevel: number): number {
        const currentMain = TeamScoringService.getMainCarac(girl, playerClass);
        const level = girl.level || 1;
        const currentGrades = girl.graded || 0;
        const maxGrades = girl.nb_grades || 0;

        const levelFactor = playerLevel / Math.max(level, 1);
        const gradeDeflator = 1 + 0.3 * currentGrades;
        const gradeInflator = 1 + 0.3 * maxGrades;

        const projected = (currentMain * levelFactor / gradeDeflator) * gradeInflator;
        return Math.max(projected, currentMain);
    }

    /**
     * Filter girls: only Mythic and Legendary 5-star, plus hard class match.
     * Cross-class girls always lose because their main-carac is the
     * non-matching one; filtering them out up-front keeps the pool small.
     */
    static filterEligible(girls: GirlData[], playerClass: PlayerClass): GirlData[] {
        return girls.filter(g => {
            // Class filter (hard)
            if (typeof g.class === 'number' && g.class !== playerClass) return false;
            // Rarity filter
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

    // --- Trait / Tier 3 logic --------------------------------------

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
     * Detect which trait categories are currently blessed by analyzing
     * blessing_bonuses across all girls. Returns a set of blessed TraitCategories.
     */
    static detectBlessedTraits(girls: GirlData[]): { blessedCategories: Set<TraitCategory>; blessedGirlCount: number } {
        const blessedCategories = new Set<TraitCategory>();
        let blessedGirlCount = 0;

        for (const girl of girls) {
            if (!girl.blessingBonuses) continue;
            const bonuses = girl.blessingBonuses;
            if (typeof bonuses !== 'object') continue;

            let hasBlessing = false;
            for (const key of Object.keys(bonuses)) {
                const lk = key.toLowerCase();
                if (lk.includes('zodiac') || lk.includes('sign') || lk.includes('astro')) {
                    blessedCategories.add('zodiac');
                    hasBlessing = true;
                }
                if (lk.includes('hair') || lk.includes('cheveu')) {
                    blessedCategories.add('hairColor');
                    hasBlessing = true;
                }
                if (lk.includes('eye') || lk.includes('yeux') || lk.includes('oeil')) {
                    blessedCategories.add('eyeColor');
                    hasBlessing = true;
                }
                if (lk.includes('position') || lk.includes('pose') || lk.includes('favourite_position')) {
                    blessedCategories.add('position');
                    hasBlessing = true;
                }
            }
            if (!hasBlessing) {
                for (const val of Object.values(bonuses)) {
                    if (typeof val === 'number' && val > 0) {
                        hasBlessing = true;
                        break;
                    }
                }
            }
            if (hasBlessing) blessedGirlCount++;
        }

        return { blessedCategories, blessedGirlCount };
    }

    /**
     * Find all possible trait groups from a pool of girls.
     *
     * For each element pair, groups girls by their shared trait value
     * and scores each group by `count * avg_main_carac`.
     * Groups matching a currently blessed trait receive a heuristic
     * boost to surface them in early evaluation; the actual stat
     * impact is already in the girl's caracs from the game API.
     *
     * Returns groups sorted by score descending.
     */
    static findTraitGroups(
        girls: GirlData[],
        playerClass: PlayerClass,
        blessedCategories?: Set<TraitCategory>
    ): TraitGroupResult[] {
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
                const avgMain = groupGirls.reduce((sum, g) => sum + TeamScoringService.getMainCarac(g, playerClass), 0) / groupGirls.length;
                let score = groupGirls.length * avgMain;

                // Heuristic boost for blessed trait categories
                if (blessedCategories && blessedCategories.has(pair.trait)) {
                    score *= BLESSED_CATEGORY_BOOST;
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

    // --- Leader selection ----------------------------------------

    /**
     * Rank leader candidates by element priority (Shield > Stun > Execute > Reflect).
     * Leader must be Mythic. Among same priority: prefer trait match, then highest stats.
     */
    static rankLeaderCandidates(
        girls: GirlData[],
        statScores: Map<number, number>,
        traitCategory?: TraitCategory,
        traitValue?: string
    ): GirlData[] {
        const mythicGirls = girls.filter(g => g.rarity === 'mythic');
        if (mythicGirls.length === 0) {
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

            // Secondary: trait match bonus
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