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
}

export type ScoringMode = 1 | 2;  // 1 = Current Best, 2 = Best Possible

const TEAM_SIZE = 7;
const CANDIDATE_POOL_SIZE = 50;

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

        // Phase 3: Find best trait group
        const traitGroups = TeamScoringService.findTraitGroups(pool);
        let bestGroup: TraitGroupResult | null = null;

        if (traitGroups.length > 0 && traitGroups[0].girls.length >= 3) {
            bestGroup = traitGroups[0];
        }

        // Fallback: use eyeColor category, pick the largest group
        if (!bestGroup) {
            const eyeGroups = traitGroups.filter(g => g.traitCategory === FALLBACK_TRAIT_CATEGORY);
            if (eyeGroups.length > 0) {
                bestGroup = eyeGroups[0];
            }
        }

        // If still no group found, use first available or create a dummy
        const traitCategory = bestGroup?.traitCategory || FALLBACK_TRAIT_CATEGORY;
        const traitValue = bestGroup?.traitValue || '';
        const traitGroupGirls = bestGroup?.girls || [];

        // Phase 4: Select Leader
        const rankedLeaders = TeamScoringService.rankLeaderCandidates(
            pool, scoreMap, traitCategory, traitValue
        );
        const leader = rankedLeaders[0];

        // Phase 5: Fill slots 2-7
        const team: GirlData[] = [leader];
        const teamElements: ElementType[] = [leader.element];
        const used = new Set<number>([leader.id_girl]);

        // First: add girls from the best trait group (sorted by stats)
        const traitGroupSorted = [...traitGroupGirls].sort(
            (a, b) => (scoreMap.get(b.id_girl) || 0) - (scoreMap.get(a.id_girl) || 0)
        );

        for (const girl of traitGroupSorted) {
            if (team.length >= TEAM_SIZE) break;
            if (used.has(girl.id_girl)) continue;
            team.push(girl);
            teamElements.push(girl.element);
            used.add(girl.id_girl);
        }

        // Then: fill remaining slots from pool by stats (with synergy as tiebreaker)
        if (team.length < TEAM_SIZE) {
            for (let slot = team.length; slot < TEAM_SIZE; slot++) {
                let bestGirl: GirlData | null = null;
                let bestCombinedScore = -Infinity;

                for (const candidate of pool) {
                    if (used.has(candidate.id_girl)) continue;

                    const statScore = scoreMap.get(candidate.id_girl) || 0;
                    const combinedScore = TeamScoringService.scoreWithSynergy(
                        candidate, teamElements, statScore, maxStat, 0.05
                    );

                    if (combinedScore > bestCombinedScore) {
                        bestCombinedScore = combinedScore;
                        bestGirl = candidate;
                    }
                }

                if (!bestGirl) break;

                team.push(bestGirl);
                teamElements.push(bestGirl.element);
                used.add(bestGirl.id_girl);
            }
        }

        if (team.length < TEAM_SIZE) {
            return null;
        }

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
        };
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
