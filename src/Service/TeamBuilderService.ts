// TeamBuilderService.ts -- Builds optimal 7-girl teams using Tier 3
// trait-group optimization (v4).
//
// Algorithm (since v7.35.25):
//   1. Hard-filter to Mythic + Legendary 5-star, player class only
//   2. Score by player main-carac (current or projected)
//   3. Find best trait group (element pair + shared trait value)
//      compared by main_sum * (1 + tier3Bonus)
//   4. Fill positions 2-7 first (6 slots), in this order:
//        Pass 1  cluster element-pair + matching trait value
//        Pass 2  cluster element-pair, any trait value
//        Pass 2a all remaining MYTHICS outside the cluster
//                (so strong mythics are never ignored, issue #1603)
//        Pass 3  legendaries outside the cluster (last resort)
//   5. Pick the leader from the remaining pool (issue #1573):
//        Mythic preferred, tier-5 priority Shield > Stun > Execute > Reflect,
//        cluster membership and trait match as tiebreakers, stats last.
//   6. Audit every mythic in the player's class for the UI: position
//      in the team, or the reason why it was excluded (other cluster,
//      lower stats than top picks, ...).

import { BlessingService } from './BlessingService';
import {
    TeamScoringService,
    GirlData,
    ElementType,
    TraitCategory,
    TraitGroupResult,
    PlayerClass,
} from './TeamScoringService';

export type MythicAuditStatus =
    | 'leader'      // picked as position 1
    | 'pos2to7'     // picked into positions 2-7
    | 'excluded';   // not in the team

export interface MythicAuditEntry {
    id_girl: number;
    name: string;
    element: ElementType;
    mainCarac: number;
    status: MythicAuditStatus;
    position?: number;          // 1..7 if status != 'excluded'
    reason?: string;            // human-readable reason if excluded
}

export interface TeamResult {
    girls: GirlData[];          // 7 girls, index 0 = leader
    statScores: number[];       // individual main-carac scores
    synergyValue: number;       // total team synergy value (informational)
    leaderTier5: { id: number; name: string; priority: number };
    elements: ElementType[];    // team element composition
    traitCategory: TraitCategory;   // which trait was optimized
    traitValue: string;             // the matching trait value
    tier3Bonus: number;             // total Tier 3 bonus %
    traitMatchCount: number;        // how many girls match the trait
    blessedCategories: string[];   // currently blessed trait categories
    blessedGirlCount: number;      // how many girls have active blessings
    effectivePower: number;        // main_sum * (1 + tier3Bonus)
    alternatives: Array<{ traitCategory: string; traitValue: string; effectivePower: number }>;
    playerClass: PlayerClass;       // 1=HC, 2=Charm, 3=KH (for UI display)
    leaderInCluster: boolean;       // true if leader element belongs to the cluster pair
    mythicAudit: MythicAuditEntry[]; // every player-class mythic with status (issue #1573, #1603)
}

export type ScoringMode = 1 | 2;  // 1 = Current Best, 2 = Best Possible

const TEAM_SIZE = 7;
const POS_2_TO_7 = 6;   // slots filled before the leader

// Map trait category to its element pair for quick lookup
const ELEMENT_PAIRS_MAP: Record<string, ElementType[]> = {
    'eyeColor': ['darkness', 'fire'],
    'hairColor': ['light', 'nature'],
    'zodiac': ['stone', 'psychic'],
    'position': ['water', 'sun'],
};

export class TeamBuilderService {

    /**
     * Build the optimal team for the given mode.
     *
     * @param allGirls    - All available girls (from availableGirls)
     * @param mode        - 1 = Current Best, 2 = Best Possible
     * @param playerLevel - Player's current level (kept for legacy callers; not used in scoring)
     * @param playerClass - Player's class (1=HC, 2=Charm, 3=KH)
     * @returns TeamResult with the selected 7 girls, or null if not enough girls
     */
    static buildTeam(
        allGirls: GirlData[],
        mode: ScoringMode,
        playerLevel: number,
        playerClass: PlayerClass
    ): TeamResult | null {
        // Phase 1: Hard filter -- Mythic/Legendary AND own class
        const candidates = TeamScoringService.filterEligible(allGirls, playerClass);

        if (candidates.length < TEAM_SIZE) {
            return null;
        }

        // Phase 2: Score all candidates by main-carac
        const scoreMap = new Map<number, number>();
        for (const girl of candidates) {
            const score = mode === 1
                ? TeamScoringService.scoreCurrentBest(girl, playerClass)
                : TeamScoringService.scoreBestPossible(girl, playerClass, playerLevel);
            scoreMap.set(girl.id_girl, score);
        }

        // Sort by score; no cap -- evaluate every eligible girl.
        const pool = [...candidates].sort(
            (a, b) => (scoreMap.get(b.id_girl) || 0) - (scoreMap.get(a.id_girl) || 0)
        );

        // Phase 2b: Detect active blessings (informational + heuristic)
        const { blessedCategories, blessedGirlCount } = TeamScoringService.detectBlessedTraits(candidates);

        // Phase 3: Build teams for multiple trait groups, pick highest effective power
        const traitGroups = TeamScoringService.findTraitGroups(pool, playerClass, blessedCategories);

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

        const statScores = team.map(g => scoreMap.get(g.id_girl) || 0);
        const synergyValue = TeamScoringService.calculateSynergyValue(teamElements);
        const leaderTier5 = TeamScoringService.getTier5Skill(leader.element);
        const tier3Bonus = TeamScoringService.calculateTier3TeamBonus(team);

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

        const clusterElements = ELEMENT_PAIRS_MAP[traitCategory] || [];
        const leaderInCluster = clusterElements.includes(leader.element);

        const mythicAudit = TeamBuilderService._buildMythicAudit(
            allGirls, team, scoreMap, traitCategory, traitValue, clusterElements, playerClass
        );

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
            playerClass,
            leaderInCluster,
            mythicAudit,
        };
    }

    /**
     * Build a team for a specific trait group.
     *
     * Order changed in v7.35.25 (issue #1573, Frank's request):
     *   1. Fill positions 2-7 first (6 slots) using the four-pass logic.
     *   2. Pick the leader from the remaining pool.
     *
     * Pass logic for positions 2-7:
     *   Pass 1  cluster element-pair AND matching trait value (max tier-3)
     *   Pass 2  cluster element-pair (any trait value, keeps mono-element)
     *   Pass 2a all remaining MYTHICS outside the cluster (NEW, issue #1603)
     *   Pass 3  any remaining girls by score (legendary fillers)
     *
     * Leader (position 1): mythic preferred, tier-5 priority
     * (Shield > Stun > Execute > Reflect), cluster membership and trait
     * match as tiebreakers.
     */
    private static _buildTeamForGroup(cat: TraitCategory, val: string, pool: GirlData[], scoreMap: Map<number, number>): GirlData[] | null {
        const elems = ELEMENT_PAIRS_MAP[cat] || [];

        // Build BOTH strategies, score them, pick the higher Effective Power.
        // Avoids rainbow teams when cluster-only fill gives a better
        // tier-3 chain than mythic-priority fill (and vice versa).
        const variantA = TeamBuilderService._buildVariant(elems, cat, val, pool, scoreMap, 'cluster-first');
        const variantB = TeamBuilderService._buildVariant(elems, cat, val, pool, scoreMap, 'mythic-first');

        if (!variantA && !variantB) return null;
        if (!variantA) return variantB;
        if (!variantB) return variantA;

        const epA = TeamBuilderService._effectivePower(variantA, scoreMap);
        const epB = TeamBuilderService._effectivePower(variantB, scoreMap);
        return epA >= epB ? variantA : variantB;
    }

    /**
     * Build one variant (slot-fill strategy + leader swap).
     */
    private static _buildVariant(
        elems: ElementType[],
        cat: TraitCategory,
        val: string,
        pool: GirlData[],
        scoreMap: Map<number, number>,
        strategy: 'mythic-first' | 'cluster-first'
    ): GirlData[] | null {
        const slots = TeamBuilderService._fillSlotsTwoToSeven(elems, val, pool, scoreMap, strategy);
        if (slots.length < POS_2_TO_7) return null;

        const usedIds = new Set(slots.map(g => g.id_girl));
        const remaining = pool.filter(g => !usedIds.has(g.id_girl));
        if (remaining.length === 0) return null;

        // Leader swap: if no mythic is left in the pool but slots contain
        // mythics AND legendaries are available, swap the weakest slot
        // mythic out and use it as leader. Guarantees a mythic leader
        // whenever any mythic exists (Frank's request).
        const remainingMythic = remaining.find(g => g.rarity === 'mythic');
        let leaderCandidates: GirlData[] = remaining;
        let workingSlots = slots;
        if (!remainingMythic) {
            const slotMythics = slots.filter(g => g.rarity === 'mythic');
            const remainingLegendary = remaining.find(g => g.rarity === 'legendary');
            if (slotMythics.length > 0 && remainingLegendary) {
                const weakestSlotMythic = slotMythics
                    .slice()
                    .sort((a, b) => (scoreMap.get(a.id_girl) || 0) - (scoreMap.get(b.id_girl) || 0))[0];
                const strongestRemainingLegendary = remaining
                    .filter(g => g.rarity === 'legendary')
                    .sort((a, b) => (scoreMap.get(b.id_girl) || 0) - (scoreMap.get(a.id_girl) || 0))[0];
                workingSlots = slots.map(g =>
                    g.id_girl === weakestSlotMythic.id_girl ? strongestRemainingLegendary : g
                );
                leaderCandidates = [weakestSlotMythic];
            } else {
                leaderCandidates = remaining;
            }
        } else {
            leaderCandidates = remaining.filter(g => g.rarity === 'mythic');
        }
        const ranked = TeamScoringService.rankLeaderCandidates(leaderCandidates, scoreMap, cat, val, elems);
        if (ranked.length === 0) return null;

        return [ranked[0], ...workingSlots];
    }

    /**
     * Compute Effective Power = main_sum * (1 + tier3Bonus) for a built team.
     */
    private static _effectivePower(team: GirlData[], scoreMap: Map<number, number>): number {
        const sum = team.reduce((s, g) => s + (scoreMap.get(g.id_girl) || 0), 0);
        const t3 = TeamScoringService.calculateTier3TeamBonus(team);
        return sum * (1 + t3);
    }

    /**
     * Fill positions 2-7 (6 slots) using a pass-based strategy.
     *
     * Two variants are produced and the caller compares Effective Power.
     *
     * mythic-first: cluster mythics, then cross-cluster mythics, then
     *               cluster legendaries, then any. Prefers mythic
     *               coverage even at the cost of Tier-3 bonus.
     * cluster-first: cluster mythics, then cluster legendaries, then
     *                cross-cluster mythics, then any. Prefers Tier-3
     *                bonus even if some mythics are skipped.
     *
     * The caller (see _buildTeamForGroup) computes Effective Power
     * (main_sum * (1 + tier3Bonus)) for both variants and keeps the
     * better one. That way rainbow teams only happen when they
     * actually beat the cluster team on raw effective power.
     */
    private static _fillSlotsTwoToSeven(
        elems: ElementType[],
        val: string,
        pool: GirlData[],
        scoreMap: Map<number, number>,
        strategy: 'mythic-first' | 'cluster-first' = 'cluster-first'
    ): GirlData[] {
        const team: GirlData[] = [];
        const used = new Set<number>();
        const byScoreDesc = (a: GirlData, b: GirlData): number =>
            (scoreMap.get(b.id_girl) || 0) - (scoreMap.get(a.id_girl) || 0);

        const fillPass = (predicate: (g: GirlData) => boolean): void => {
            const candidates = pool
                .filter(g => !used.has(g.id_girl) && predicate(g))
                .sort(byScoreDesc);
            for (const g of candidates) {
                if (team.length >= POS_2_TO_7) break;
                team.push(g); used.add(g.id_girl);
            }
        };

        // Step 1 (both strategies): cluster mythics with trait match.
        // These are the strongest contributors and never hurt either way.
        fillPass(g => g.rarity === 'mythic'
            && elems.includes(g.element)
            && TeamScoringService.getTraitValue(g) === val);

        // Step 2 (both): cluster mythics with any trait value.
        if (team.length < POS_2_TO_7) {
            fillPass(g => g.rarity === 'mythic' && elems.includes(g.element));
        }

        if (strategy === 'mythic-first') {
            // Step 3a: cross-cluster mythics before any legendary.
            if (team.length < POS_2_TO_7) {
                fillPass(g => g.rarity === 'mythic');
            }
            // Step 4a: cluster legendaries with trait match.
            if (team.length < POS_2_TO_7) {
                fillPass(g => elems.includes(g.element)
                    && TeamScoringService.getTraitValue(g) === val);
            }
            // Step 5a: cluster legendaries any trait.
            if (team.length < POS_2_TO_7) {
                fillPass(g => elems.includes(g.element));
            }
        } else {
            // Cluster-first: keep Tier-3 chain intact before mixing in
            // cross-cluster mythics.
            // Step 3b: cluster legendaries with trait match.
            if (team.length < POS_2_TO_7) {
                fillPass(g => elems.includes(g.element)
                    && TeamScoringService.getTraitValue(g) === val);
            }
            // Step 4b: cluster legendaries any trait.
            if (team.length < POS_2_TO_7) {
                fillPass(g => elems.includes(g.element));
            }
            // Step 5b: cross-cluster mythics.
            if (team.length < POS_2_TO_7) {
                fillPass(g => g.rarity === 'mythic');
            }
        }

        // Step 6 (both): any remaining girls by score.
        if (team.length < POS_2_TO_7) {
            fillPass(() => true);
        }

        return team;
    }

    /**
     * Build the mythic audit list shown in the UI.
     */
    private static _buildMythicAudit(
        allGirls: GirlData[],
        team: GirlData[],
        scoreMap: Map<number, number>,
        traitCategory: TraitCategory,
        traitValue: string,
        clusterElements: ElementType[],
        playerClass: PlayerClass
    ): MythicAuditEntry[] {
        const teamIds = new Map<number, number>();
        team.forEach((g, idx) => teamIds.set(g.id_girl, idx + 1));

        const entries: MythicAuditEntry[] = [];
        for (const girl of allGirls) {
            if (girl.rarity !== 'mythic') continue;

            const mainCarac = TeamScoringService.getMainCarac(girl, playerClass);
            const pos = teamIds.get(girl.id_girl);

            if (pos === 1) {
                entries.push({
                    id_girl: girl.id_girl, name: girl.name, element: girl.element,
                    mainCarac, status: 'leader', position: 1,
                });
                continue;
            }
            if (pos !== undefined) {
                entries.push({
                    id_girl: girl.id_girl, name: girl.name, element: girl.element,
                    mainCarac, status: 'pos2to7', position: pos,
                });
                continue;
            }

            let reason: string;
            if (typeof girl.class === 'number' && girl.class !== playerClass) {
                reason = 'wrong class (filtered out)';
            } else {
                const girlCategory = TeamScoringService.getTraitCategory(girl.element);
                const girlValue = TeamScoringService.getTraitValue(girl);
                if (girlCategory === traitCategory && girlValue === traitValue) {
                    reason = 'same trait, lower stats than top picks';
                } else if (clusterElements.includes(girl.element)) {
                    reason = 'cluster element, different trait value: '
                        + girlCategory + '=' + (girlValue || '?');
                } else {
                    reason = 'other cluster: ' + girlCategory + '=' + (girlValue || '?');
                }
            }
            entries.push({
                id_girl: girl.id_girl, name: girl.name, element: girl.element,
                mainCarac, status: 'excluded', reason,
            });
        }

        entries.sort((a, b) => {
            const aIn = a.status !== 'excluded';
            const bIn = b.status !== 'excluded';
            if (aIn !== bIn) return aIn ? -1 : 1;
            if (aIn && bIn) return (a.position || 99) - (b.position || 99);
            return b.mainCarac - a.mainCarac;
        });

        return entries;
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
