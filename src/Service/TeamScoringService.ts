// TeamScoringService.ts -- Scoring engine for team selection v2.
//
// Provides element synergy calculations, Tier-5 leader skill evaluation,
// and stat scoring for two modes:
//   - "Current Best": uses current stats (blessed), filters Mythic + Legendary only
//   - "Best Possible": projects stats to max level + full grades for ALL girls

export type ElementType = 'fire' | 'water' | 'nature' | 'stone' | 'sun' | 'darkness' | 'psychic' | 'light';
export type RarityType = 'starting' | 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

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
    priority: number;     // higher = better (Execute=4, Stun=3, Shield=2, Reflect=1)
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
const ELEMENT_TO_TIER5: Record<ElementType, Tier5Skill> = {
    fire:      { id: 14, name: 'Execute', priority: 4 },
    water:     { id: 14, name: 'Execute', priority: 4 },
    sun:       { id: 11, name: 'Stun',    priority: 3 },
    darkness:  { id: 11, name: 'Stun',    priority: 3 },
    stone:     { id: 12, name: 'Shield',  priority: 2 },
    light:     { id: 12, name: 'Shield',  priority: 2 },
    psychic:   { id: 13, name: 'Reflect', priority: 1 },
    nature:    { id: 13, name: 'Reflect', priority: 1 },
};

// Rarities allowed for "Current Best" mode
const HIGH_RARITIES: Set<RarityType> = new Set(['mythic', 'legendary']);

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

        // Avoid division by zero; a level-1 girl still gets projected
        const levelFactor = playerLevel / Math.max(level, 1);
        const gradeDeflator = 1 + 0.3 * currentGrades;
        const gradeInflator = 1 + 0.3 * maxGrades;

        return (currentStats * levelFactor / gradeDeflator) * gradeInflator;
    }

    /**
     * Filter girls for "Current Best" mode: only Mythic and Legendary.
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
     *
     * Fire (critDamage) weighs highest because +10% per girl is 5× the
     * per-girl bonus of other elements.
     */
    static calculateSynergyValue(elements: ElementType[]): number {
        const syn = TeamScoringService.calculateSynergies(elements);

        // Weights reflect relative combat impact
        // Fire critDamage is already 5× higher per girl, so weight=1 is sufficient
        return (
            syn.critDamage * 1.0 +     // Fire: 10% per girl
            syn.critChance * 2.0 +      // Stone: 2% per girl, but crit chance is valuable
            syn.defReduce  * 2.0 +      // Sun: 2% per girl, reduces enemy defense
            syn.healOnHit  * 1.5 +      // Water: 3% per girl
            syn.damage     * 1.5 +      // Darkness: 2% per girl
            syn.ego        * 1.0 +      // Nature: 3% per girl
            syn.defense    * 1.0 +      // Psychic: 2% per girl
            syn.harmony    * 1.0        // Light: 2% per girl
        );
    }

    /**
     * Score a girl's contribution to a team, considering both stats and
     * the synergy bonus she adds.
     *
     * @param girl        - The girl to score
     * @param teamElements - Elements already in the team (before adding this girl)
     * @param statScore   - Pre-calculated stat score (from scoreCurrentBest or scoreBestPossible)
     * @param maxStatInPool - The highest stat score in the entire girl pool (for normalization)
     * @param synergyWeight - How much synergy counts vs raw stats (0-1, default 0.05 = 5%)
     */
    static scoreWithSynergy(
        girl: GirlData,
        teamElements: ElementType[],
        statScore: number,
        maxStatInPool: number,
        synergyWeight: number = 0.05
    ): number {
        // Synergy delta: how much adding this girl improves team synergy
        const currentSynergyValue = TeamScoringService.calculateSynergyValue(teamElements);
        const newSynergyValue = TeamScoringService.calculateSynergyValue([...teamElements, girl.element]);
        const synergyDelta = newSynergyValue - currentSynergyValue;

        // Normalize synergy delta relative to max stat so they're comparable
        const normalizedSynergyBonus = maxStatInPool > 0
            ? (synergyDelta / maxStatInPool) * maxStatInPool
            : 0;

        return statScore + synergyWeight * normalizedSynergyBonus;
    }

    /**
     * Rank leader candidates by Tier-5 skill priority.
     * Among girls with equal Tier-5 priority, pick the one with highest stats.
     */
    static rankLeaderCandidates(
        girls: GirlData[],
        statScores: Map<number, number>
    ): GirlData[] {
        return [...girls].sort((a, b) => {
            const tier5A = TeamScoringService.getTier5Skill(a.element);
            const tier5B = TeamScoringService.getTier5Skill(b.element);

            // Primary: Tier-5 priority (Execute > Stun > Shield > Reflect)
            if (tier5A.priority !== tier5B.priority) {
                return tier5B.priority - tier5A.priority;
            }

            // Secondary: stat score
            const scoreA = statScores.get(a.id_girl) || 0;
            const scoreB = statScores.get(b.id_girl) || 0;
            return scoreB - scoreA;
        });
    }
}
