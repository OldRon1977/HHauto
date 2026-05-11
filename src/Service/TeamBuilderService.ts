// TeamBuilderService.ts -- Builds optimal 7-girl teams using Tier 3
// trait-group optimization (v5).
//
// Algorithm:
//   1. Hard-filter to Mythic + Legendary 5-star, player class only
//   2. Score by mode-aware function:
//        Mode 1 (Current Best):  current main carac
//        Mode 2 (Best Possible): projected to awakening cap (level 750, max grades)
//   3. Find best trait group, evaluated as full team via EffectivePower
//   4. Fill positions 2-7, then pick Shield-priority leader (slot-swap if needed)
//   5. EffectivePower scoring: BaseStats * (1+ElementSynergy) * (1+Tier3) * (1+LeaderBonus)
//
// EffectivePower captures four contributors to win probability:
//   BaseStats     -- raw main carac sum (already includes blessings via game API)
//   ElementSynergy -- team element stack bonus (mono-theme reward)
//   Tier3         -- trait-match bonus (eye/hair/zodiac/position chain)
//   LeaderBonus   -- role-efficiency proxy via Tier-5 priority
//                    (Shield > Stun > Execute > Reflect)
//
// Issue refs: #1573 (Shield-first leader, audit), #1603 (mode semantics, blessings).

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
    blessingPercents: number[];     // active blessing pcts on this girl, e.g. [40] or [40, 25]
    blessingMultiplier: number;     // product of (1 + p/100), e.g. 1.40 or 1.75
    status: MythicAuditStatus;
    position?: number;          // 1..7 if status != 'excluded'
    reason?: string;            // human-readable reason if excluded
}

export interface PoolStats {
    ownClass: number;
    otherClass: { [c: number]: number };
    ownClassMythics: number;
    ownClassMythicsAtCap: number;       // level == 750
    ownClassMythicsBlessed: number;     // any pvp_v3/v4 bonus active
}

export interface TeamSlotInfo {
    id_girl: number;
    name: string;
    rarity: string;
    element: ElementType;
    level: number;
    awakening_level?: number;
    graded: number;
    nb_grades: number;
    currentMain: number;
    score: number;                  // mode-aware score (Mode 1 = current, Mode 2 = projected)
    blessingPercents: number[];
    traitValue?: string;
    inCluster: boolean;
}

export interface TeamResult {
    girls: GirlData[];          // 7 girls, index 0 = leader
    leaderReason?: string;      // why this leader was picked (when not Mythic-Shield)
    statScores: number[];       // mode-aware score per slot
    synergyValue: number;       // legacy weighted synergy (informational)
    elementSynergyMultiplier: number;  // sum of per-element bonuses (used in EffectivePower)
    leaderTier5: { id: number; name: string; priority: number };
    leaderBonus: number;        // = priority * 0.02 (used in EffectivePower)
    elements: ElementType[];
    traitCategory: TraitCategory;
    traitValue: string;
    tier3Bonus: number;
    traitMatchCount: number;
    blessedCategories: string[];
    blessedGirlCount: number;
    effectivePower: number;     // mainSum * (1+synergy) * (1+tier3) * (1+leaderBonus)
    alternatives: Array<{ traitCategory: string; traitValue: string; effectivePower: number }>;
    playerClass: PlayerClass;
    leaderInCluster: boolean;
    mainSum: number;            // sum of CURRENT main caracs (mode-independent reference)
    projectedSum: number;       // sum of mode-2 projected scores (informational)
    mythicAudit: MythicAuditEntry[];
    slotInfo: TeamSlotInfo[];   // per-slot diagnostic detail (for log + UI)
    poolStats: PoolStats;
}

export type ScoringMode = 1 | 2;

const TEAM_SIZE = 7;
const POS_2_TO_7 = 6;

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
     * @param playerLevel - kept for legacy callers; unused in scoring
     * @param playerClass - 1=HC, 2=Charm, 3=KH
     */
    static buildTeam(
        allGirls: GirlData[],
        mode: ScoringMode,
        playerLevel: number,
        playerClass: PlayerClass
    ): TeamResult | null {
        const candidates = TeamScoringService.filterEligible(allGirls, playerClass);
        if (candidates.length < TEAM_SIZE) {
            return null;
        }

        // Mode-aware score function.
        const scoreFn = (g: GirlData): number => mode === 1
            ? TeamScoringService.scoreCurrentBest(g, playerClass)
            : TeamScoringService.scoreBestPossible(g, playerClass);

        // Score map for fast lookups during build/leader-rank.
        const scoreMap = new Map<number, number>();
        for (const girl of candidates) {
            scoreMap.set(girl.id_girl, scoreFn(girl));
        }

        // Sort pool by mode score (descending). No cap.
        const pool = [...candidates].sort(
            (a, b) => (scoreMap.get(b.id_girl) || 0) - (scoreMap.get(a.id_girl) || 0)
        );

        // Detect blessed categories (informational, surfaced in audit/UI).
        const { blessedCategories, blessedGirlCount } = TeamScoringService.detectBlessedTraits(candidates);

        // Find candidate trait groups, scored mode-aware. Blessed
        // categories get a boost so the build phase tries them first.
        const traitGroups = TeamScoringService.findTraitGroups(pool, scoreFn, blessedCategories);

        // Evaluate top groups + any blessed-category groups not in the top.
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

        let bestBuilt: { team: GirlData[]; cat: TraitCategory; val: string; power: number } | null = null;
        const alternatives: Array<{ traitCategory: string; traitValue: string; effectivePower: number }> = [];

        for (const group of groupsToEvaluate) {
            const builtTeam = TeamBuilderService._buildTeamForGroup(group.traitCategory, group.traitValue, pool, scoreMap);
            if (!builtTeam || builtTeam.length < TEAM_SIZE) continue;
            const power = Math.round(TeamBuilderService._effectivePower(builtTeam, scoreMap));
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
        const elementSynergyMultiplier = TeamScoringService.calculateElementSynergyMultiplier(team);
        const leaderTier5 = TeamScoringService.getTier5Skill(leader.element);
        const leaderBonus = TeamScoringService.getLeaderBonus(leaderTier5);
        const tier3Bonus = TeamScoringService.calculateTier3TeamBonus(team);

        // leaderReason: explain the pick when it's not a Mythic Shield.
        // Variante C precedence is: Mythic Shield (best) > Mythic Stun >
        // Mythic Execute > Mythic Reflect > Legendary fallback. The reason
        // text states which step was taken and why.
        const leaderReason = TeamBuilderService._buildLeaderReason(leader, leaderTier5, candidates);

        let traitMatchCount = 0;
        for (const girl of team) {
            const girlCategory = TeamScoringService.getTraitCategory(girl.element);
            if (girlCategory === traitCategory) {
                const girlValue = TeamScoringService.getTraitValue(girl);
                if (girlValue === traitValue) traitMatchCount++;
            }
        }

        const clusterElements = ELEMENT_PAIRS_MAP[traitCategory] || [];
        const leaderInCluster = clusterElements.includes(leader.element);

        const mythicAudit = TeamBuilderService._buildMythicAudit(
            allGirls, team, scoreMap, traitCategory, traitValue, clusterElements, playerClass
        );

        // mainSum: current carac sum across the 7 picked girls (mode-independent
        // reference number visible in the info box headline).
        const mainSum = team.reduce(
            (acc, g) => acc + TeamScoringService.getMainCarac(g, playerClass),
            0
        );

        // projectedSum: mode-2 projection sum for the same 7 girls. Useful in
        // mode 1 too: 'these girls would be worth X if fully developed'.
        const projectedSum = team.reduce(
            (acc, g) => acc + TeamScoringService.scoreBestPossible(g, playerClass),
            0
        );

        // Per-slot diagnostic detail (for log + audit UI).
        const slotInfo: TeamSlotInfo[] = team.map(g => ({
            id_girl: g.id_girl,
            name: g.name,
            rarity: g.rarity,
            element: g.element,
            level: g.level,
            awakening_level: g.awakening_level,
            graded: g.graded,
            nb_grades: g.nb_grades,
            currentMain: TeamScoringService.getMainCarac(g, playerClass),
            score: scoreMap.get(g.id_girl) || 0,
            blessingPercents: BlessingService.getActivePercents(g as any),
            traitValue: TeamScoringService.getTraitValue(g),
            inCluster: clusterElements.includes(g.element),
        }));

        // Pool stats (mythic-at-cap and blessed counts help diagnose
        // "modes identical because every Top-7 is fully developed").
        const poolStats = TeamBuilderService._poolStats(allGirls, playerClass);

        return {
            girls: team,
            leaderReason,
            statScores,
            synergyValue,
            elementSynergyMultiplier,
            leaderTier5,
            leaderBonus,
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
            mainSum,
            projectedSum,
            mythicAudit,
            slotInfo,
            poolStats,
        };
    }

    /**
     * Build a team for a specific trait group.
     * Two strategies (cluster-first / mythic-first) are scored on Effective
     * Power and the higher one wins.
     */
    private static _buildTeamForGroup(cat: TraitCategory, val: string, pool: GirlData[], scoreMap: Map<number, number>): GirlData[] | null {
        const elems = ELEMENT_PAIRS_MAP[cat] || [];
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
     * Build one variant: fill slots 2-7, pick Shield-priority leader,
     * slot-swap if needed.
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

        // Leader picked from remaining mythics first; if none, slot-swap a
        // mythic (Shield-preferred) out of slots 2-7 to free the leader pos.
        const remainingMythic = remaining.find(g => g.rarity === 'mythic');
        let leaderCandidates: GirlData[] = remaining;
        let workingSlots = slots;

        if (!remainingMythic) {
            const slotMythics = slots.filter(g => g.rarity === 'mythic');
            const remainingLegendary = remaining.find(g => g.rarity === 'legendary');
            if (slotMythics.length > 0 && remainingLegendary) {
                // Pick the BEST Tier-5 priority mythic out of slots first
                // (so a slot Shield mythic becomes leader, not the weakest one),
                // matching Frank's #1573 'always Shield first' request.
                const sortedSlotMythics = [...slotMythics].sort((a, b) => {
                    const pa = TeamScoringService.getTier5Skill(a.element).priority;
                    const pb = TeamScoringService.getTier5Skill(b.element).priority;
                    if (pa !== pb) return pb - pa;
                    return (scoreMap.get(a.id_girl) || 0) - (scoreMap.get(b.id_girl) || 0);
                });
                const leaderFromSlots = sortedSlotMythics[0];
                const strongestRemainingLegendary = remaining
                    .filter(g => g.rarity === 'legendary')
                    .sort((a, b) => (scoreMap.get(b.id_girl) || 0) - (scoreMap.get(a.id_girl) || 0))[0];
                workingSlots = slots.map(g =>
                    g.id_girl === leaderFromSlots.id_girl ? strongestRemainingLegendary : g
                );
                leaderCandidates = [leaderFromSlots];
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
     * Compute EffectivePower for a built team:
     *   mainSum * (1 + synergy) * (1 + tier3) * (1 + leaderBonus)
     *
     * Uses the score map (mode-aware) for stat sum so the team-builder
     * compares modes-at-this-level rather than mode-1-at-each-level.
     */
    private static _effectivePower(team: GirlData[], scoreMap: Map<number, number>): number {
        const sum = team.reduce((s, g) => s + (scoreMap.get(g.id_girl) || 0), 0);
        const synergy = TeamScoringService.calculateElementSynergyMultiplier(team);
        const tier3 = TeamScoringService.calculateTier3TeamBonus(team);
        const leaderTier5 = TeamScoringService.getTier5Skill(team[0].element);
        const leaderBonus = TeamScoringService.getLeaderBonus(leaderTier5);
        return sum * (1 + synergy) * (1 + tier3) * (1 + leaderBonus);
    }

    /**
     * Fill positions 2-7 (6 slots) using a pass-based strategy.
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

        // Pass 1: Mythic + cluster element + trait match (ideal case).
        fillPass(g => g.rarity === 'mythic'
            && elems.includes(g.element)
            && TeamScoringService.getTraitValue(g) === val);

        if (strategy === 'mythic-first') {
            // Mythic-first: prioritize mythic coverage even if it costs trait match.
            // Pass 2: Mythic + cluster element (any trait).
            if (team.length < POS_2_TO_7) fillPass(g => g.rarity === 'mythic' && elems.includes(g.element));
            // Pass 3: Mythic outside cluster (cross-cluster mythic injection).
            if (team.length < POS_2_TO_7) fillPass(g => g.rarity === 'mythic');
            // Pass 4: Legendary + cluster + trait match.
            if (team.length < POS_2_TO_7) fillPass(g => elems.includes(g.element)
                && TeamScoringService.getTraitValue(g) === val);
            // Pass 5: Legendary + cluster (any trait).
            if (team.length < POS_2_TO_7) fillPass(g => elems.includes(g.element));
        } else {
            // Cluster-first: prioritize trait-match chain (Tier-3 bonus) and
            // cross-rarity matching before falling back to any-trait fillers.
            //
            // Pass 2 (NEW v7.35.34): Legendary 5* + cluster + trait match,
            // BEFORE we drop the trait-match constraint to mythic-only-cluster.
            // Empirical: in pools where Legendary 5* girls carry the right
            // trait value but Mythics in the same pair don't, keeping the
            // trait chain pays off more than forcing a Mythic into the slot.
            if (team.length < POS_2_TO_7) fillPass(g => g.rarity === 'legendary'
                && elems.includes(g.element)
                && TeamScoringService.getTraitValue(g) === val);
            // Pass 3: Mythic + cluster (any trait).
            if (team.length < POS_2_TO_7) fillPass(g => g.rarity === 'mythic' && elems.includes(g.element));
            // Pass 4: Legendary + cluster (any trait).
            if (team.length < POS_2_TO_7) fillPass(g => elems.includes(g.element));
            // Pass 5: Mythic outside cluster.
            if (team.length < POS_2_TO_7) fillPass(g => g.rarity === 'mythic');
        }

        // Final pass: anything to fill remaining slots.
        if (team.length < POS_2_TO_7) fillPass(() => true);
        return team;
    }

    /**
     * Pool-Health-Snapshot for the info box.
     */
    private static _poolStats(allGirls: GirlData[], playerClass: PlayerClass): PoolStats {
        const isHighRarity = (g: GirlData): boolean =>
            g.rarity === 'mythic' || (g.rarity === 'legendary' && (g.nb_grades || 0) >= 5);
        const ownClass = allGirls.filter(g => isHighRarity(g) && (typeof g.class !== 'number' || g.class === playerClass));
        const ownClassMythics = ownClass.filter(g => g.rarity === 'mythic');
        const ownClassMythicsAtCap = ownClassMythics.filter(g => (g.level || 0) >= 750).length;
        const ownClassMythicsBlessed = ownClassMythics.filter(g => BlessingService.getEffectiveMultiplier(g as any) > 1).length;
        const otherClass: { [c: number]: number } = {};
        for (const g of allGirls) {
            if (!isHighRarity(g)) continue;
            if (typeof g.class !== 'number' || g.class === playerClass) continue;
            otherClass[g.class] = (otherClass[g.class] || 0) + 1;
        }
        return {
            ownClass: ownClass.length,
            otherClass,
            ownClassMythics: ownClassMythics.length,
            ownClassMythicsAtCap,
            ownClassMythicsBlessed,
        };
    }

    /**
     * Build a human-readable explanation of why this leader was picked.
     *
     * Variante C precedence (issue #1603):
     *   Mythic Shield > Mythic Stun > Mythic Execute > Mythic Reflect
     *   > Legendary 5* (any tier-5 / no tier-5).
     *
     * If the leader is not a Mythic Shield, the reason explains which
     * higher-priority candidate was missing or why the selected pick
     * still made it through the slot-swap fallback.
     */
    private static _buildLeaderReason(
        leader: GirlData,
        leaderTier5: { id: number; name: string; priority: number },
        candidates: GirlData[]
    ): string | undefined {
        const isMythicShield = leader.rarity === 'mythic' && leaderTier5.name === 'Shield';
        if (isMythicShield) return undefined; // ideal case, no reason needed

        const mythics = candidates.filter(g => g.rarity === 'mythic');
        const mythicShieldCount = mythics.filter(g => TeamScoringService.getTier5Skill(g.element).name === 'Shield').length;
        const mythicStunCount   = mythics.filter(g => TeamScoringService.getTier5Skill(g.element).name === 'Stun').length;
        const mythicExecCount   = mythics.filter(g => TeamScoringService.getTier5Skill(g.element).name === 'Execute').length;

        const parts: string[] = [];
        if (mythicShieldCount === 0) parts.push('no Mythic Shield in pool');
        else parts.push('Mythic Shield needed for slot 2-7 cluster fill, no swap candidate');
        if (leader.rarity === 'mythic') {
            if (leaderTier5.name === 'Stun')    parts.push('fallback to Mythic Stun (tier-5 priority 3)');
            if (leaderTier5.name === 'Execute') parts.push(`fallback to Mythic Execute (no Mythic Stun: ${mythicStunCount === 0 ? 'pool empty' : 'all swapped to slots'})`);
            if (leaderTier5.name === 'Reflect') parts.push(`fallback to Mythic Reflect (no Mythic Stun/Execute: stun=${mythicStunCount}, execute=${mythicExecCount} available)`);
        } else {
            parts.push(`fallback to Legendary 5* (${leaderTier5.name}, no Mythic available)`);
        }
        return parts.join('; ');
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
            const blessingPercents = BlessingService.getActivePercents(girl as any);
            const blessingMultiplier = BlessingService.getEffectiveMultiplier(girl as any);
            const pos = teamIds.get(girl.id_girl);

            if (pos === 1) {
                entries.push({
                    id_girl: girl.id_girl, name: girl.name, element: girl.element,
                    mainCarac, blessingPercents, blessingMultiplier,
                    status: 'leader', position: 1,
                });
                continue;
            }
            if (pos !== undefined) {
                entries.push({
                    id_girl: girl.id_girl, name: girl.name, element: girl.element,
                    mainCarac, blessingPercents, blessingMultiplier,
                    status: 'pos2to7', position: pos,
                });
                continue;
            }

            const isCrossClass = typeof girl.class === 'number' && girl.class !== playerClass;
            const crossClassPrefix = isCrossClass ? 'cross-class, ' : '';
            const girlCategory = TeamScoringService.getTraitCategory(girl.element);
            const girlValue = TeamScoringService.getTraitValue(girl);
            let reason: string;
            if (girlCategory === traitCategory && girlValue === traitValue) {
                reason = crossClassPrefix + 'same trait, lower stats than top picks';
            } else if (clusterElements.includes(girl.element)) {
                reason = crossClassPrefix + 'cluster element, different trait value: '
                    + girlCategory + '=' + (girlValue || '?');
            } else {
                reason = crossClassPrefix + 'other cluster: ' + girlCategory + '=' + (girlValue || '?');
            }
            entries.push({
                id_girl: girl.id_girl, name: girl.name, element: girl.element,
                mainCarac, blessingPercents, blessingMultiplier,
                status: 'excluded', reason,
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
