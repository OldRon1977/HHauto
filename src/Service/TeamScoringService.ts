// TeamScoringService.ts -- Pure scoring helpers for the Spec-driven team builder.
//
// Public surface (everything else is gone after the v7.35.39 refactor):
//   - Types:    ElementType, RarityType, TraitCategory, PlayerClass, GirlData,
//               Tier5Skill
//   - Scoring:  caracsSum (raw), scoreCurrentBest (mode 1), scoreBestPossible
//               (mode 2 -- projected to level 750 + max grades)
//   - Filters:  filterEligible (Mythic + Legendary 5*)
//   - Tier-3 :  getTier3Category, getTraitValue, calculateTier3TeamBonus
//   - Tier-5 :  getTier5Skill
//   - Element:  getElementPowerCoeff
//
// Spec: docs-internal/REVIEW_TeamSelection.md.

export type ElementType =
    | 'fire' | 'water' | 'nature' | 'stone'
    | 'sun' | 'darkness' | 'psychic' | 'light';
export type RarityType =
    | 'starting' | 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type TraitCategory = 'eyeColor' | 'hairColor' | 'zodiac' | 'position';
export type PlayerClass = 1 | 2 | 3;

export interface Tier5Skill {
    id: number;       // 11=Stun, 12=Shield, 13=Reflect, 14=Execute
    name: string;
    priority: number; // Shield=4, Stun=3, Execute=2, Reflect=1
}

export interface GirlData {
    id_girl: number;
    name: string;
    carac1: number;
    carac2: number;
    carac3: number;
    level: number;
    class?: number;            // 1=HC, 2=Charm, 3=KH (when missing: cross-class neutral)
    element: ElementType;
    rarity: RarityType;
    graded: number;            // grades currently applied
    nb_grades: number;         // total grades available for the rarity
    awakening_level?: number;  // 0..10 (informational, already in caracs)
    skill_tiers_info?: any;
    caracs?: { carac1: number; carac2: number; carac3: number };
    // Tier-3 trait fields
    zodiac?: string;
    hairColor?: string;
    eyeColor?: string;
    position?: string;
    // Blessing data (game API). The team builder reads it via BlessingService.
    blessingBonuses?: any;
}

// Tier-5 mapping. Priority controls the leader pick (Shield > Stun > Execute > Reflect).
const ELEMENT_TO_TIER5: Record<ElementType, Tier5Skill> = {
    light:    { id: 12, name: 'Shield',  priority: 4 },
    stone:    { id: 12, name: 'Shield',  priority: 4 },
    sun:      { id: 11, name: 'Stun',    priority: 3 },
    darkness: { id: 11, name: 'Stun',    priority: 3 },
    fire:     { id: 14, name: 'Execute', priority: 2 },
    water:    { id: 14, name: 'Execute', priority: 2 },
    psychic:  { id: 13, name: 'Reflect', priority: 1 },
    nature:   { id: 13, name: 'Reflect', priority: 1 },
};

// Element -> Tier-3 trait category. Pairs share a category.
const ELEMENT_TO_TIER3_CATEGORY: Record<ElementType, TraitCategory> = {
    darkness: 'eyeColor',
    fire:     'eyeColor',
    light:    'hairColor',
    nature:   'hairColor',
    stone:    'zodiac',
    psychic:  'zodiac',
    water:    'position',
    sun:      'position',
};

// Per-element power coefficient (empirical strength table).
// Used as a tiebreaker in the leader rule (key 7), in Pos-2-7-Regel
// sub-group ordering and score comparison, and in Cluster-Wahl-Regel
// step 2 when no trait category resolves.
const ELEMENT_POWER_COEFF: Record<ElementType, number> = {
    darkness: 1.20,   // Dominatrice
    fire:     1.12,   // Excentrique
    stone:    1.12,   // Physique
    nature:   1.10,   // Exhibitionniste
    water:    1.08,   // Sensuelle
    psychic:  1.025,  // Soumise
    light:    1.00,   // Voyeuse
    sun:      1.00,   // Joueuse
};

// Tier-3 bonus per matching teammate.
const TIER3_BONUS_MYTHIC = 0.01;
const TIER3_BONUS_LEGENDARY = 0.008;

// Spec step 0: 'Best Possible' projects every girl to the awakening cap.
const PROJECTION_LEVEL_CAP = 750;

export class TeamScoringService {

    /**
     * Sum of all three carac fields. Game-authoritative (caracs sub-object
     * already includes blessings; equipment is excluded). Falls back to
     * carac1/2/3 when caracs is absent.
     */
    static caracsSum(girl: GirlData): number {
        const src = girl.caracs ?? { carac1: girl.carac1, carac2: girl.carac2, carac3: girl.carac3 };
        return (Number(src.carac1) || 0)
             + (Number(src.carac2) || 0)
             + (Number(src.carac3) || 0);
    }

    /**
     * Spec step 0, mode 1. caracs_sum = carac1 + carac2 + carac3.
     * Player class is irrelevant for ranking (Mythic/Legendary 5* differ
     * uniformly across all three caracs).
     */
    static scoreCurrentBest(girl: GirlData, _playerClass?: PlayerClass): number {
        return TeamScoringService.caracsSum(girl);
    }

    /**
     * Spec step 0, mode 2. Projects caracs_sum to level 750 + max grades.
     *
     *   projected = current * (750 / level) * (1 + 0.3 * nb_grades) / (1 + 0.3 * graded)
     *
     * For voll-awakte girls (level 750, graded == nb_grades), projected == current.
     */
    static scoreBestPossible(girl: GirlData, _playerClass?: PlayerClass): number {
        const current = TeamScoringService.caracsSum(girl);
        const level = girl.level || 1;
        const currentGrades = girl.graded || 0;
        const maxGrades = girl.nb_grades || 0;
        return current
             * (PROJECTION_LEVEL_CAP / level)
             * (1 + 0.3 * maxGrades)
             / (1 + 0.3 * currentGrades);
    }

    /**
     * Spec eligible-pool filter: Mythic + Legendary 5*.
     *
     * Cross-class girls are kept; the leader rule does not consider player
     * class as a tiebreaker.
     *
     * playerClass is ignored; kept in the signature for backwards compat.
     */
    static filterEligible(girls: GirlData[], _playerClass?: PlayerClass): GirlData[] {
        return girls.filter(g => {
            if (g.rarity === 'mythic') return true;
            if (g.rarity === 'legendary') return (g.nb_grades || 0) >= 5;
            return false;
        });
    }

    static getTier5Skill(element: ElementType): Tier5Skill {
        return ELEMENT_TO_TIER5[element];
    }

    static getTier3Category(element: ElementType): TraitCategory {
        return ELEMENT_TO_TIER3_CATEGORY[element];
    }

    /**
     * Trait value for a girl based on her element-pair Tier-3 category.
     * Returns undefined when the field is missing.
     */
    static getTraitValue(girl: GirlData): string | undefined {
        const category = ELEMENT_TO_TIER3_CATEGORY[girl.element];
        switch (category) {
            case 'eyeColor':  return girl.eyeColor;
            case 'hairColor': return girl.hairColor;
            case 'zodiac':    return girl.zodiac;
            case 'position':  return girl.position;
        }
    }

    /**
     * Per-element power coefficient. Tiebreaker in the leader pick (key 7),
     * in Pos-2-7-Regel sub-group ordering and score comparison, and in
     * Cluster-Wahl-Regel step 2 when no trait category resolves.
     */
    static getElementPowerCoeff(element: ElementType): number {
        return ELEMENT_POWER_COEFF[element] ?? 1.0;
    }

    /**
     * Total Tier-3 bonus for a built team. Each girl scans her teammates;
     * matches inside the same element-pair trait category yield 1.0%
     * (Mythic) or 0.8% (Legendary).
     */
    static calculateTier3TeamBonus(team: GirlData[]): number {
        let totalBonus = 0;
        for (const girl of team) {
            const cat = ELEMENT_TO_TIER3_CATEGORY[girl.element];
            const value = TeamScoringService.getTraitValue(girl);
            if (!value) continue;
            let matches = 0;
            for (const other of team) {
                if (other.id_girl === girl.id_girl) continue;
                if (ELEMENT_TO_TIER3_CATEGORY[other.element] !== cat) continue;
                if (TeamScoringService.getTraitValue(other) === value) matches++;
            }
            const bonus = girl.rarity === 'mythic' ? TIER3_BONUS_MYTHIC : TIER3_BONUS_LEGENDARY;
            totalBonus += matches * bonus;
        }
        return totalBonus;
    }
}