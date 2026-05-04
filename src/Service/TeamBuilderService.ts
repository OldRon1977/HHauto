// TeamBuilderService.ts -- Builds optimal 7-girl teams using Tier 3
// trait-group optimization.
//
// Two modes (both filter Mythic + Legendary only):
//   Mode 1 "Current Best": current blessed stats
//   Mode 2 "Best Possible": projected stats at max level + grades
//
// Algorithm:
//   1. Filter to M+L, score all girls
//   2. Find best trait group (element pair + shared trait value)
//   3. Select Mythic leader (Shield/Stun priority)
//   4. Fill slots 2-7 from trait group, then by stats

import { BlessingService } from './BlessingService';
import {
    TeamScoringService,
    GirlData,
    ElementType,
    TraitCategory,
    TraitGroupResult,
} from './TeamScoringService';

export interface TeamResult {
    girls: GirlData[];          // 7 girls, index 0 = leader
    statScores: number[];       // individual stat scores
    synergyValue: number;       // total team synergy value
    leaderTier5: { id: number; name: string; priority: number };
    elements: ElementType[];    // team element composition
    traitCategory: TraitCategory;   // which trait was optimized
    traitValue: string;             // the matching trait value
    tier3Bonus: number;             // total Tier 3 bonus %
    traitMatchCount: number;        // how many girls match the trait
    blessedCategories: string[];   // currently blessed trait categories
    blessedGirlCount: number;      // how many girls have active blessings
    effectivePower: number;        // team stat sum * (1 + tier3Bonus)
    alternatives: Array<{ traitCategory: string; traitValue: string; effectivePower: number }>;
}

export type ScoringMode = 1 | 2;  // 1 = Current Best, 2 = Best Possible

const TEAM_SIZE = 7;
const CANDIDATE_POOL_SIZE = 50;

// Map trait category to its element pair for quick lookup
const ELEMENT_PAIRS_MAP: Record<string, ElementType[]> = {
    'eyeColor': ['darkness', 'fire'],
    'hairColor': ['light', 'nature'],
    'zodiac': ['stone', 'psychic'],
    'position': ['water', 'sun'],
};

// Default fallback trait when no good group is found
const FALLBACK_TRAIT_CATEGORY: TraitCategory = 'eyeColor';

export class TeamBuilderService {

    /**
     * Build the optimal team for the given mode.
     *
     * @param allGirls    - All available girls (from availableGirls)
     * @param mode        - 1 = Current Best, 2 = Best Possible
     * @param playerLevel - Player's current level (needed for mode 2)
     * @returns TeamResult with the selected 7 girls, or null if not enough girls
     */
    static buildTeam(
        allGirls: GirlData[],
        mode: ScoringMode,
        playerLevel: number
    ): TeamResult | null {
        // Phase 1: Filter to Mythic + Legendary only (both modes)
        const candidates = TeamScoringService.filterHighRarity(allGirls);

        if (candidates.length < TEAM_SIZE) {
            return null;
        }

        // Phase 2: Score all candidates
        const scoreMap = new Map<number, number>();
        for (const girl of candidates) {
            const score = mode === 1
                ? TeamScoringService.scoreCurrentBest(girl)
                : TeamScoringService.scoreBestPossible(girl, playerLevel);
            scoreMap.set(girl.id_girl, score);
        }

        // Pre-sort by score for pool selection
        const sorted = [...candidates].sort(
            (a, b) => (scoreMap.get(b.id_girl) || 0) - (scoreMap.get(a.id_girl) || 0)
        );
        const pool = sorted.slice(0, CANDIDATE_POOL_SIZE);

        const maxStat = scoreMap.get(pool[0].id_girl) || 1;

        // Phase 2b: Detect active blessings
        const { blessedCategories, blessedGirlCount } = TeamScoringService.detectBlessedTraits(candidates);

        // Phase 3: Build teams for multiple trait groups, pick highest effective power
        const blessedValues: Record<string, string> = (BlessingService.getCached()?.blessedValues) || {};
        const traitGroups = TeamScoringService.findTraitGroups(pool, blessedCategories, blessedValues);

        // Evaluate top groups + all blessed groups
        const groupsToEvaluate: TraitGroupResult[] = [];
        const seenKeys = new Set<string>();
        for (const g of traitGroups.slice(0, 5)) {
            const key = g.traitCategory + '=' + g.traitValue;
            if (!seenKeys.has(key)) { groupsToEvaluate.push(g); seenKeys.add(key); }
        }
        for (const g of traitGroups) {
            const key = g.traitCategory + '=' + g.traitValue;
            if (seenKeys.has(key)) continue;
            if (blessedCategories.has(g.traitCategory)) { groupsToEvaluate.push(g); seenKeys.add(key); }
        }
        if (groupsToEvaluate.length === 0 && traitGroups.length > 0) {
            groupsToEvaluate.push(traitGroups[0]);
        }

        // Build a team for each group and compare effective power
        let bestBuilt: { team: GirlData[], cat: TraitCategory, val: string, power: number } | null = null;
        const alternatives: Array<{ traitCategory: string; traitValue: string; effectivePower: number }> = [];

        for (const group of groupsToEvaluate) {
            const builtTeam = TeamBuilderService._buildTeamForGroup(group.traitCategory, group.traitValue, pool, scoreMap);
            if (!builtTeam || builtTeam.length < TEAM_SIZE) continue;
            const statSum = builtTeam.reduce((s, g) => s + (scoreMap.get(g.id_girl) || 0), 0);
            const t3 = TeamScoringService.calculateTier3TeamBonus(builtTeam);
            const power = Math.round(statSum * (1 + t3));
            alternatives.push({ traitCategory: group.traitCategory, traitValue: group.traitValue, effectivePower: power });
            if (!bestBuilt || power > bestBuilt.power) {
                bestBuilt = { team: builtTeam, cat: group.traitCategory, val: group.traitValue, power };
            }
        }

        if (!bestBuilt) return null;

        const team = bestBuilt.team;
        const teamElements: ElementType[] = team.map(g => g.element);
        const leader = team[0];
        const traitCategory = bestBuilt.cat;
        const traitValue = bestBuilt.val;

        // Phase 6: Build result
        const statScores = team.map(g => scoreMap.get(g.id_girl) || 0);
        const synergyValue = TeamScoringService.calculateSynergyValue(teamElements);
        const leaderTier5 = TeamScoringService.getTier5Skill(leader.element);
        const tier3Bonus = TeamScoringService.calculateTier3TeamBonus(team);

        // Count how many girls match the chosen trait
        let traitMatchCount = 0;
        for (const girl of team) {
            const girlCategory = TeamScoringService.getTraitCategory(girl.element);
            if (girlCategory === traitCategory) {
                const girlValue = TeamScoringService.getTraitValue(girl);
                if (girlValue === traitValue) {
                    traitMatchCount++;
                }
            }
        }

        return {
            girls: team,
            statScores,
            synergyValue,
            leaderTier5,
            elements: teamElements,
            traitCategory,
            traitValue,
            tier3Bonus,
            traitMatchCount,
            blessedCategories: Array.from(blessedCategories),
            blessedGirlCount,
            effectivePower: bestBuilt.power,
            alternatives,
        };
    }

    /** Build a team for a specific trait group. */
    private static _buildTeamForGroup(cat: TraitCategory, val: string, pool: GirlData[], scoreMap: Map<number, number>): GirlData[] | null {
        const elems = ELEMENT_PAIRS_MAP[cat] || [];
        const leaders = pool.filter(g => g.rarity === 'mythic' && elems.includes(g.element));
        const ranked = TeamScoringService.rankLeaderCandidates(leaders.length > 0 ? leaders : pool, scoreMap, cat, val);
        if (ranked.length === 0) return null;

        const team: GirlData[] = [ranked[0]];
        const used = new Set<number>([ranked[0].id_girl]);

        // Pass 1: matching trait value + correct element
        for (const g of pool.filter(g => !used.has(g.id_girl) && elems.includes(g.element) && TeamScoringService.getTraitValue(g) === val).sort((a, b) => (scoreMap.get(b.id_girl) || 0) - (scoreMap.get(a.id_girl) || 0))) {
            if (team.length >= TEAM_SIZE) break; team.push(g); used.add(g.id_girl);
        }
        // Pass 2: correct element, any trait
        if (team.length < TEAM_SIZE) {
            for (const g of pool.filter(g => !used.has(g.id_girl) && elems.includes(g.element)).sort((a, b) => (scoreMap.get(b.id_girl) || 0) - (scoreMap.get(a.id_girl) || 0))) {
                if (team.length >= TEAM_SIZE) break; team.push(g); used.add(g.id_girl);
            }
        }
        // Pass 3: any element by stats
        if (team.length < TEAM_SIZE) {
            for (const g of pool.filter(g => !used.has(g.id_girl)).sort((a, b) => (scoreMap.get(b.id_girl) || 0) - (scoreMap.get(a.id_girl) || 0))) {
                if (team.length >= TEAM_SIZE) break; team.push(g); used.add(g.id_girl);
            }
        }
        return team.length >= TEAM_SIZE ? team : null;
    }

    /**
     * Get a summary of element distribution in the team.
     */
    static getElementDistribution(team: TeamResult): Array<{ element: ElementType; count: number }> {
        const counts = new Map<ElementType, number>();
        for (const el of team.elements) {
            counts.set(el, (counts.get(el) || 0) + 1);
        }
        return Array.from(counts.entries())
            .map(([element, count]) => ({ element, count }))
            .sort((a, b) => b.count - a.count);
    }
}
