// TeamBuilderService.ts -- Builds optimal 7-girl teams using greedy
// synergy-aware selection.
//
// Two modes:
//   Mode 1 "Current Best": Mythic+Legendary only, current blessed stats
//   Mode 2 "Best Possible": All girls, projected stats at max level+grades
//
// Algorithm:
//   1. Score all girls individually
//   2. Pre-filter to top 50 candidates
//   3. Select Leader from top 25 by Tier-5 skill priority
//   4. Fill slots 2-7 greedily, maximizing (stat + synergy bonus)

import {
    TeamScoringService,
    GirlData,
    ElementType,
} from './TeamScoringService';

export interface TeamResult {
    girls: GirlData[];          // 7 girls, index 0 = leader
    statScores: number[];       // individual stat scores
    synergyValue: number;       // total team synergy value
    leaderTier5: { id: number; name: string; priority: number };
    elements: ElementType[];    // team element composition
}

export type ScoringMode = 1 | 2;  // 1 = Current Best, 2 = Best Possible

const TEAM_SIZE = 7;
const CANDIDATE_POOL_SIZE = 50;
const LEADER_POOL_SIZE = 25;

export class TeamBuilderService {

    /**
     * Build the optimal team for the given mode.
     *
     * @param allGirls    - All available girls (from availableGirls or tooltip)
     * @param mode        - 1 = Current Best, 2 = Best Possible
     * @param playerLevel - Player's current level (needed for mode 2)
     * @param synergyWeight - How much synergy affects selection (0-1, default 0.05)
     * @returns TeamResult with the selected 7 girls, or null if not enough girls
     */
    static buildTeam(
        allGirls: GirlData[],
        mode: ScoringMode,
        playerLevel: number,
        synergyWeight: number = 0.05
    ): TeamResult | null {
        // Phase 1: Filter by mode
        const candidates = mode === 1
            ? TeamScoringService.filterHighRarity(allGirls)
            : allGirls;

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

        // Phase 3: Sort by score descending, take top pool
        const sorted = [...candidates].sort(
            (a, b) => (scoreMap.get(b.id_girl) || 0) - (scoreMap.get(a.id_girl) || 0)
        );
        const pool = sorted.slice(0, CANDIDATE_POOL_SIZE);

        // Find max stat for normalization in synergy scoring
        const maxStat = scoreMap.get(pool[0].id_girl) || 1;

        // Phase 4: Select Leader from top 25
        const leaderCandidates = pool.slice(0, LEADER_POOL_SIZE);
        const rankedLeaders = TeamScoringService.rankLeaderCandidates(leaderCandidates, scoreMap);
        const leader = rankedLeaders[0];

        // Phase 5: Greedy fill slots 2-7
        const team: GirlData[] = [leader];
        const teamElements: ElementType[] = [leader.element];
        const used = new Set<number>([leader.id_girl]);

        for (let slot = 1; slot < TEAM_SIZE; slot++) {
            let bestGirl: GirlData | null = null;
            let bestCombinedScore = -Infinity;

            for (const candidate of pool) {
                if (used.has(candidate.id_girl)) continue;

                const statScore = scoreMap.get(candidate.id_girl) || 0;
                const combinedScore = TeamScoringService.scoreWithSynergy(
                    candidate,
                    teamElements,
                    statScore,
                    maxStat,
                    synergyWeight
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

        if (team.length < TEAM_SIZE) {
            return null;
        }

        // Build result
        const statScores = team.map(g => scoreMap.get(g.id_girl) || 0);
        const synergyValue = TeamScoringService.calculateSynergyValue(teamElements);
        const leaderTier5 = TeamScoringService.getTier5Skill(leader.element);

        return {
            girls: team,
            statScores,
            synergyValue,
            leaderTier5,
            elements: teamElements,
        };
    }

    /**
     * Get a summary of element distribution in the team.
     * Returns a map of element -> count, sorted by count descending.
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
