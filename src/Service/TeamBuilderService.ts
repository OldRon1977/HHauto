// TeamBuilderService.ts -- Spec-driven team builder.
//
// Implements docs-internal/REVIEW_TeamSelection.md.
//
// Public surface:
//   - buildTeam(allGirls, mode, playerLevel, playerClass): TeamResult | null
//   - getElementDistribution(team): summary helper for the UI panel
//
// Picker semantics:
//   1. Detect Bless 1 and Bless 2 (BlessingService.detectActiveBlessings).
//   2. Build up to three candidate teams in parallel:
//      - Team A from "girls with Bless 1" (only when Bless 1 active).
//      - Team B from "girls with Bless 2" (only when Bless 2 active).
//      - Team C from the entire eligible pool (always, no Bless filter).
//   3. Best candidate by caracs_sum-of-7 wins. Mode-aware: scoreCurrentBest
//      in mode 1, scoreBestPossible in mode 2.
//   4. Tie-break: Bless 1 > Bless 2 > Default.
//   5. If no candidate fills 7 slots, emergency fallback (top-N by caracs_sum).

import { BlessingService } from './BlessingService';
import {
    TeamScoringService,
    GirlData,
    ElementType,
    TraitCategory,
    PlayerClass,
} from './TeamScoringService';

export type ScoringMode = 1 | 2;

export type MythicAuditStatus = 'leader' | 'pos2to7' | 'excluded';

export interface MythicAuditEntry {
    id_girl: number;
    name: string;
    element: ElementType;
    mainCarac: number;
    blessingPercents: number[];
    blessingMultiplier: number;
    status: MythicAuditStatus;
    position?: number;
    reason?: string;
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
    score: number;
    blessingPercents: number[];
    traitValue?: string;
    inCluster: boolean;
}

export interface PoolStats {
    eligible: number;
    ownClass: number;
    otherClass: { [c: number]: number };
    ownClassMythics: number;
    ownClassMythicsAtCap: number;
    ownClassMythicsBlessed: number;
}

export interface BlessingSummary {
    kind: string;
    value: string;
    percent: number;
    pool_size: number;
}

export interface TeamResult {
    girls: GirlData[];
    elements: ElementType[];
    statScores: number[];
    mainSum: number;
    projectedSum: number;
    leaderTier5: { id: number; name: string; priority: number };
    leaderInCluster: boolean;
    leaderReason?: string;
    traitCategory: TraitCategory;
    traitValue: string;
    tier3Bonus: number;
    traitMatchCount: number;
    activeBlessings: BlessingSummary[];
    poolUsed: 'bless1' | 'bless2' | 'default' | 'fallback';
    blessedGirlCount: number;
    fallbackReason?: string;
    playerClass: PlayerClass;
    mythicAudit: MythicAuditEntry[];
    slotInfo: TeamSlotInfo[];
    poolStats: PoolStats;
}

const TEAM_SIZE = 7;
const POS_2_TO_7 = 6;

// Element pairs that share a Tier-3 category.
const ELEMENT_PAIRS_BY_CATEGORY: Record<TraitCategory, ElementType[]> = {
    eyeColor:  ['darkness', 'fire'],
    hairColor: ['light', 'nature'],
    zodiac:    ['stone', 'psychic'],
    position:  ['water', 'sun'],
};

// Trait hierarchy used in cluster selection and Pos-2-7 fill.
const TRAIT_HIERARCHY: TraitCategory[] = ['eyeColor', 'hairColor', 'zodiac', 'position'];

interface TeamCluster {
    category: TraitCategory;
    value: string;
    elements: ElementType[];
}

interface CandidateTeam {
    team: GirlData[];
    cluster: TeamCluster;
    poolUsed: 'bless1' | 'bless2' | 'default';
    score: number; // mode-aware caracs_sum across all 7 picks
}

export class TeamBuilderService {

    /**
     * Spec entry point.
     */
    static buildTeam(
        allGirls: GirlData[],
        mode: ScoringMode,
        _playerLevel: number,
        playerClass: PlayerClass,
    ): TeamResult | null {
        const eligible = TeamScoringService.filterEligible(allGirls, playerClass);
        if (eligible.length === 0) return null;

        const scoreFn = (g: GirlData) => mode === 1
            ? TeamScoringService.scoreCurrentBest(g, playerClass)
            : TeamScoringService.scoreBestPossible(g, playerClass);
        const scoreMap = new Map<number, number>();
        for (const g of eligible) scoreMap.set(g.id_girl, scoreFn(g));

        // Pool too small for any cluster to form: emergency fallback.
        if (eligible.length < TEAM_SIZE) {
            return TeamBuilderService.buildFallback(
                eligible, scoreMap, playerClass,
                'Eligible pool has fewer than 7 girls.',
            );
        }

        const blessings = BlessingService.detectActiveBlessings(allGirls as any);
        const summaries: BlessingSummary[] = blessings.map(b => ({
            kind: b.kind, value: b.value, percent: b.percent, pool_size: b.pool_size,
        }));

        // Build up to three candidates in parallel.
        const candidates: CandidateTeam[] = [];
        const bless1 = blessings[0];
        const bless2 = blessings[1];

        if (bless1) {
            const pool = eligible.filter(g => TeamBuilderService.matchesBlessing(g, bless1));
            const built = TeamBuilderService.buildFromPool(pool, eligible, scoreMap);
            if (built) candidates.push({ ...built, poolUsed: 'bless1' });
        }
        if (bless2) {
            const pool = eligible.filter(g => TeamBuilderService.matchesBlessing(g, bless2));
            const built = TeamBuilderService.buildFromPool(pool, eligible, scoreMap);
            if (built) candidates.push({ ...built, poolUsed: 'bless2' });
        }
        // Default team: full eligible pool, no Bless filter, cluster from
        // the trait hierarchy.
        {
            const built = TeamBuilderService.buildFromPool(eligible, eligible, scoreMap);
            if (built) candidates.push({ ...built, poolUsed: 'default' });
        }

        // Score each candidate and pick the best by mode-aware sum.
        for (const c of candidates) {
            c.score = c.team.reduce(
                (s, g) => s + (scoreMap.get(g.id_girl) ?? TeamScoringService.caracsSum(g)),
                0,
            );
        }

        if (candidates.length === 0) {
            return TeamBuilderService.buildFallback(
                eligible, scoreMap, playerClass,
                'No candidate pool produced 7 girls; fell back to caracs_sum picks.',
            );
        }

        // Tiebreak: bless1 > bless2 > default. Stable sort already preserves
        // this since we appended in that order. We just take the highest score.
        // For ties, keep the first occurrence (already in priority order).
        let best = candidates[0];
        for (let i = 1; i < candidates.length; i++) {
            if (candidates[i].score > best.score) best = candidates[i];
        }

        return TeamBuilderService.buildResult(
            best.team, scoreMap, eligible, playerClass,
            best.cluster, summaries, best.poolUsed,
        );
    }

    // ---- Bless classification ------------------------------------------

    /**
     * Does the girl satisfy a single blessing's condition?
     *
     * Match is by (kind, value): the girl's relevant field equals the
     * blessing's value AND her current effective multiplier is greater
     * than 1 (so she is actually blessed by something).
     */
    private static matchesBlessing(girl: GirlData, bless: BlessingSummary): boolean {
        if (BlessingService.getEffectiveMultiplier(girl as any) <= 1) return false;
        const raw: any = girl;
        const valueOf = (kind: string): string | undefined => {
            switch (kind) {
                case 'eyeColor':  return raw.eyeColor ?? raw.eye_color1;
                case 'hairColor': return raw.hairColor ?? raw.hair_color1;
                case 'zodiac':    return raw.zodiac;
                case 'position': {
                    const v = raw.position ?? raw.position_img;
                    if (v === undefined || v === null) return undefined;
                    return String(v).replace(/\.png$/i, '');
                }
                case 'element':   return raw.element;
                case 'rarity':    return raw.rarity;
                default:          return undefined;
            }
        };
        return String(valueOf(bless.kind) ?? '') === bless.value;
    }

    // ---- One pool -> one team ------------------------------------------

    /**
     * Build a single team from one pool (Spec step 2). Sequence:
     *   A. Choose cluster from the trait hierarchy.
     *   B. Pick leader from the FULL eligible pool (the leader does
     *      not have to satisfy the bless filter, it just has to fit
     *      the chosen cluster -- a strong Mythic Shield from outside
     *      the bless pool wins over a weaker bless-pool mythic).
     *   C. Fill positions 2..7 from the local pool, minus the leader.
     * Returns null if the pool cannot fill 7 slots.
     */
    private static buildFromPool(
        pool: GirlData[],
        eligibleAll: GirlData[],
        scoreMap: Map<number, number>,
    ): { team: GirlData[]; cluster: TeamCluster; score: number } | null {
        if (pool.length < TEAM_SIZE) return null;

        const cluster = TeamBuilderService.chooseTeamCluster(pool);
        if (!cluster) return null;

        // Leader-Kandidaten = gesamter eligible Pool. Die 7-key sort
        // (Mythic > Tier-5 > Element-Pair > Trait-Match > blessed >
        // caracs_sum > Element-Coeff) bevorzugt automatisch eine
        // Mythic Shield mit Trait-Match, faellt zu Mythic Shield ohne
        // Trait-Match wenn keine vorhanden, und erst dann zu Mythic
        // Stun/Execute/Reflect.
        const leader = TeamBuilderService.pickLeader(eligibleAll, cluster, scoreMap);
        if (!leader) return null;

        const reservedIds = new Set<number>([leader.id_girl]);
        const positions = TeamBuilderService.fillPositions2to7(cluster, pool, reservedIds, scoreMap);
        if (positions.length < POS_2_TO_7) return null;

        return { team: [leader, ...positions], cluster, score: 0 };
    }

    // ---- Cluster choice ------------------------------------------------

    /**
     * Walk the trait hierarchy eyes -> hair -> zodiac -> position. The
     * first hierarchy step that yields any sub-group inside the matching
     * element-pair wins. Within the step, the largest sub-group is the
     * primary cluster value. Falls through to the dominant element with
     * Element-Coeff tiebreak when no trait category resolves.
     */
    private static chooseTeamCluster(pool: GirlData[]): TeamCluster | null {
        if (pool.length === 0) return null;

        const dominantBucketFor = (category: TraitCategory) => {
            const pair = ELEMENT_PAIRS_BY_CATEGORY[category];
            const subset = pool.filter(g => pair.includes(g.element));
            if (subset.length === 0) return null;
            const buckets = new Map<string, GirlData[]>();
            for (const g of subset) {
                const v = TeamScoringService.getTraitValue(g);
                if (!v) continue;
                if (!buckets.has(v)) buckets.set(v, []);
                buckets.get(v)!.push(g);
            }
            if (buckets.size === 0) return null;
            const sorted = [...buckets.entries()]
                .sort((a, b) => b[1].length - a[1].length);
            const [topVal, topGirls] = sorted[0];
            return { category, value: topVal, girls: topGirls };
        };

        for (const category of TRAIT_HIERARCHY) {
            const dominant = dominantBucketFor(category);
            if (dominant && dominant.girls.length >= 1) {
                return {
                    category,
                    value: dominant.value,
                    elements: ELEMENT_PAIRS_BY_CATEGORY[category],
                };
            }
        }

        // Trait hierarchy did not resolve. Fall back on element with the
        // highest Element-Coeff (Pos-2-7 rule 3 last sentence).
        const elementCounts = new Map<ElementType, number>();
        for (const g of pool) {
            elementCounts.set(g.element, (elementCounts.get(g.element) || 0) + 1);
        }
        const sortedByCount = [...elementCounts.entries()]
            .sort((a, b) => {
                if (b[1] !== a[1]) return b[1] - a[1];
                return TeamScoringService.getElementPowerCoeff(b[0])
                     - TeamScoringService.getElementPowerCoeff(a[0]);
            });
        const winnerElement = sortedByCount[0][0];
        const winnerCategory = TeamScoringService.getTier3Category(winnerElement);
        const winnerPair = ELEMENT_PAIRS_BY_CATEGORY[winnerCategory];
        const subset = pool.filter(g => winnerPair.includes(g.element));
        const buckets = new Map<string, number>();
        for (const g of subset) {
            const v = TeamScoringService.getTraitValue(g);
            if (!v) continue;
            buckets.set(v, (buckets.get(v) || 0) + 1);
        }
        const topValue = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
            ?? TeamScoringService.getTraitValue(subset[0]) ?? '';

        return { category: winnerCategory, value: topValue, elements: winnerPair };
    }

    // ---- Pos 2..7 fill -------------------------------------------------

    private static fillPositions2to7(
        cluster: TeamCluster,
        pool: GirlData[],
        reservedIds: Set<number>,
        scoreMap: Map<number, number>,
    ): GirlData[] {
        const clusterGirls = pool.filter(g => cluster.elements.includes(g.element) && !reservedIds.has(g.id_girl));
        if (clusterGirls.length === 0) return [];

        const subGroupKeys: string[] = [];
        const subGroups = new Map<string, GirlData[]>();
        const groupKey = (g: GirlData): string => TeamScoringService.getTraitValue(g) ?? '__notrait__';

        for (const g of clusterGirls) {
            const key = groupKey(g);
            if (!subGroups.has(key)) {
                subGroups.set(key, []);
                subGroupKeys.push(key);
            }
            subGroups.get(key)!.push(g);
        }

        const sortedKeys = [...subGroupKeys].sort((a, b) => {
            if (a === cluster.value && b !== cluster.value) return -1;
            if (b === cluster.value && a !== cluster.value) return 1;
            const sizeDelta = subGroups.get(b)!.length - subGroups.get(a)!.length;
            if (sizeDelta !== 0) return sizeDelta;
            const aTop = TeamBuilderService.dominantElementCoeff(subGroups.get(a)!);
            const bTop = TeamBuilderService.dominantElementCoeff(subGroups.get(b)!);
            return bTop - aTop;
        });

        const scoreOf = (g: GirlData): number =>
            scoreMap.get(g.id_girl) ?? TeamScoringService.caracsSum(g);
        const compareScore = (a: GirlData, b: GirlData): number => {
            const sa = scoreOf(a);
            const sb = scoreOf(b);
            if (sb !== sa) return sb - sa;
            return TeamScoringService.getElementPowerCoeff(b.element)
                 - TeamScoringService.getElementPowerCoeff(a.element);
        };

        const picks: GirlData[] = [];
        const used = new Set<number>();
        for (const key of sortedKeys) {
            const group = [...subGroups.get(key)!].sort(compareScore);
            for (const g of group) {
                if (picks.length >= POS_2_TO_7) break;
                if (used.has(g.id_girl)) continue;
                picks.push(g);
                used.add(g.id_girl);
            }
            if (picks.length >= POS_2_TO_7) break;
        }

        if (picks.length < POS_2_TO_7) {
            const remaining = clusterGirls
                .filter(g => !used.has(g.id_girl))
                .sort(compareScore);
            for (const g of remaining) {
                if (picks.length >= POS_2_TO_7) break;
                picks.push(g);
                used.add(g.id_girl);
            }
        }

        return picks;
    }

    /** Highest Element-Coeff observed inside a sub-group. */
    private static dominantElementCoeff(girls: GirlData[]): number {
        let max = 0;
        for (const g of girls) {
            const c = TeamScoringService.getElementPowerCoeff(g.element);
            if (c > max) max = c;
        }
        return max;
    }

    // ---- Leader pick ---------------------------------------------------

    /**
     * Leaderauswahl-Regel: 7 sort keys, top-down.
     *
     *   1. Mythic before Legendary
     *   2. Tier-5: Shield > Stun > Execute > Reflect
     *   3. Element-pair match to the team cluster
     *   4. Trait-value match to the team cluster
     *   5. Blessed before unblessed
     *   6. caracs_sum descending (mode-aware)
     *   7. Element-Coeff higher first
     *
     * Player class plays no role in the leader tiebreaker.
     */
    private static pickLeader(
        candidates: GirlData[],
        cluster: TeamCluster,
        scoreMap: Map<number, number>,
    ): GirlData | undefined {
        if (candidates.length === 0) return undefined;
        const sorted = [...candidates].sort((a, b) => {
            // 1. Mythic before Legendary
            const rA = a.rarity === 'mythic' ? 0 : 1;
            const rB = b.rarity === 'mythic' ? 0 : 1;
            if (rA !== rB) return rA - rB;

            // 2. Tier-5 priority
            const tA = TeamScoringService.getTier5Skill(a.element).priority;
            const tB = TeamScoringService.getTier5Skill(b.element).priority;
            if (tA !== tB) return tB - tA;

            // 3. Element-pair match to cluster
            const eA = cluster.elements.includes(a.element) ? 0 : 1;
            const eB = cluster.elements.includes(b.element) ? 0 : 1;
            if (eA !== eB) return eA - eB;

            // 4. Trait-value match to cluster (only when girl's own
            //    Tier-3 category equals the cluster category).
            const matchA = TeamScoringService.getTier3Category(a.element) === cluster.category
                && TeamScoringService.getTraitValue(a) === cluster.value;
            const matchB = TeamScoringService.getTier3Category(b.element) === cluster.category
                && TeamScoringService.getTraitValue(b) === cluster.value;
            const vA = matchA ? 0 : 1;
            const vB = matchB ? 0 : 1;
            if (vA !== vB) return vA - vB;

            // 5. Blessed vs unblessed
            const bA = BlessingService.getEffectiveMultiplier(a as any) > 1 ? 0 : 1;
            const bB = BlessingService.getEffectiveMultiplier(b as any) > 1 ? 0 : 1;
            if (bA !== bB) return bA - bB;

            // 6. caracs_sum descending (mode-aware)
            const sA = scoreMap.get(a.id_girl) ?? TeamScoringService.caracsSum(a);
            const sB = scoreMap.get(b.id_girl) ?? TeamScoringService.caracsSum(b);
            if (sA !== sB) return sB - sA;

            // 7. Element-Coeff higher first
            const cA = TeamScoringService.getElementPowerCoeff(a.element);
            const cB = TeamScoringService.getElementPowerCoeff(b.element);
            if (cA !== cB) return cB - cA;

            return 0;
        });
        return sorted[0];
    }

    // ---- Emergency fallback (Spec step 4) ------------------------------

    private static buildFallback(
        eligible: GirlData[],
        scoreMap: Map<number, number>,
        playerClass: PlayerClass,
        reason: string,
    ): TeamResult {
        const sorted = [...eligible].sort((a, b) => {
            const sA = scoreMap.get(a.id_girl) ?? TeamScoringService.caracsSum(a);
            const sB = scoreMap.get(b.id_girl) ?? TeamScoringService.caracsSum(b);
            if (sA !== sB) return sB - sA;
            return TeamScoringService.getElementPowerCoeff(b.element)
                 - TeamScoringService.getElementPowerCoeff(a.element);
        });
        const team = sorted.slice(0, TEAM_SIZE);

        const fallbackCluster: TeamCluster | null = team.length > 0
            ? (() => {
                const elementCounts = new Map<ElementType, number>();
                for (const g of team) {
                    elementCounts.set(g.element, (elementCounts.get(g.element) || 0) + 1);
                }
                const winner = [...elementCounts.entries()]
                    .sort((a, b) => b[1] - a[1])[0][0];
                const cat = TeamScoringService.getTier3Category(winner);
                const trait = TeamScoringService.getTraitValue(team[0]) ?? '';
                return { category: cat, value: trait, elements: ELEMENT_PAIRS_BY_CATEGORY[cat] };
            })()
            : null;

        return TeamBuilderService.buildResult(
            team, scoreMap, eligible, playerClass,
            fallbackCluster, [], 'fallback', reason,
        );
    }

    // ---- Result composition --------------------------------------------

    private static buildResult(
        team: GirlData[],
        scoreMap: Map<number, number>,
        eligible: GirlData[],
        playerClass: PlayerClass,
        cluster: TeamCluster | null,
        summaries: BlessingSummary[],
        poolUsed: TeamResult['poolUsed'],
        fallbackReason?: string,
    ): TeamResult {
        const leader = team[0];
        const elements = team.map(g => g.element);

        const slotScore = (g: GirlData): number => scoreMap.get(g.id_girl)
            ?? TeamScoringService.scoreCurrentBest(g, playerClass);
        const statScores = team.map(slotScore);

        const mainSum = team.reduce((s, g) => s + TeamScoringService.caracsSum(g), 0);
        const projectedSum = team.reduce(
            (s, g) => s + TeamScoringService.scoreBestPossible(g, playerClass),
            0,
        );

        const leaderTier5 = TeamScoringService.getTier5Skill(leader.element);
        const traitCategory = cluster?.category ?? TeamScoringService.getTier3Category(leader.element);
        const traitValue = cluster?.value ?? TeamScoringService.getTraitValue(leader) ?? '';
        const clusterElements = cluster?.elements ?? ELEMENT_PAIRS_BY_CATEGORY[traitCategory];
        const leaderInCluster = clusterElements.includes(leader.element);
        const tier3Bonus = TeamScoringService.calculateTier3TeamBonus(team);
        const traitMatchCount = team.filter(g =>
            TeamScoringService.getTier3Category(g.element) === traitCategory
            && TeamScoringService.getTraitValue(g) === traitValue,
        ).length;

        const leaderReason = TeamBuilderService.buildLeaderReason(
            leader, leaderTier5, eligible, traitCategory, traitValue,
        );

        const blessedGirlCount = eligible.filter(g => BlessingService.getEffectiveMultiplier(g as any) > 1).length;

        const slotInfo: TeamSlotInfo[] = team.map(g => ({
            id_girl: g.id_girl,
            name: g.name,
            rarity: g.rarity,
            element: g.element,
            level: g.level,
            awakening_level: g.awakening_level,
            graded: g.graded,
            nb_grades: g.nb_grades,
            currentMain: TeamScoringService.caracsSum(g),
            score: slotScore(g),
            blessingPercents: BlessingService.getActivePercents(g as any),
            traitValue: TeamScoringService.getTraitValue(g),
            inCluster: clusterElements.includes(g.element),
        }));

        const mythicAudit = TeamBuilderService.buildMythicAudit(
            eligible, team, traitCategory, traitValue, clusterElements, playerClass,
        );

        const poolStats = TeamBuilderService.buildPoolStats(eligible, playerClass);

        return {
            girls: team,
            elements,
            statScores,
            mainSum,
            projectedSum,
            leaderTier5,
            leaderInCluster,
            leaderReason,
            traitCategory,
            traitValue,
            tier3Bonus,
            traitMatchCount,
            activeBlessings: summaries,
            poolUsed,
            blessedGirlCount,
            fallbackReason,
            playerClass,
            mythicAudit,
            slotInfo,
            poolStats,
        };
    }

    private static buildLeaderReason(
        leader: GirlData,
        tier5: { name: string; priority: number },
        eligible: GirlData[],
        traitCategory: TraitCategory,
        traitValue: string,
    ): string | undefined {
        if (leader.rarity === 'mythic' && tier5.name === 'Shield') return undefined;
        const mythics = eligible.filter(g => g.rarity === 'mythic');
        const shieldMythics = mythics.filter(g => TeamScoringService.getTier5Skill(g.element).name === 'Shield').length;
        const stunMythics = mythics.filter(g => TeamScoringService.getTier5Skill(g.element).name === 'Stun').length;
        const executeMythics = mythics.filter(g => TeamScoringService.getTier5Skill(g.element).name === 'Execute').length;
        const parts: string[] = [];
        if (shieldMythics === 0) parts.push('no Mythic Shield in pool');
        else parts.push('Mythic Shield available but did not pass leader rule');
        if (leader.rarity === 'mythic') {
            if (tier5.name === 'Stun')    parts.push('picked Mythic Stun');
            if (tier5.name === 'Execute') parts.push('picked Mythic Execute (Stun mythics: ' + stunMythics + ')');
            if (tier5.name === 'Reflect') parts.push('picked Mythic Reflect (Stun: ' + stunMythics + ', Execute: ' + executeMythics + ')');
        } else {
            parts.push('fell back to Legendary 5* (' + tier5.name + ')');
        }
        const traitMatch = TeamScoringService.getTier3Category(leader.element) === traitCategory
            && TeamScoringService.getTraitValue(leader) === traitValue;
        if (!traitMatch) parts.push('leader does not match team trait ' + traitCategory + '=' + traitValue);
        return parts.join('; ');
    }

    private static buildMythicAudit(
        eligible: GirlData[],
        team: GirlData[],
        traitCategory: TraitCategory,
        traitValue: string,
        clusterElements: ElementType[],
        playerClass: PlayerClass,
    ): MythicAuditEntry[] {
        const teamPositions = new Map<number, number>();
        team.forEach((g, idx) => teamPositions.set(g.id_girl, idx + 1));

        const entries: MythicAuditEntry[] = [];
        for (const girl of eligible) {
            if (girl.rarity !== 'mythic') continue;
            const mainCarac = TeamScoringService.caracsSum(girl);
            const blessingPercents = BlessingService.getActivePercents(girl as any);
            const blessingMultiplier = BlessingService.getEffectiveMultiplier(girl as any);
            const pos = teamPositions.get(girl.id_girl);
            if (pos === 1) {
                entries.push({ id_girl: girl.id_girl, name: girl.name, element: girl.element,
                    mainCarac, blessingPercents, blessingMultiplier, status: 'leader', position: 1 });
                continue;
            }
            if (pos !== undefined) {
                entries.push({ id_girl: girl.id_girl, name: girl.name, element: girl.element,
                    mainCarac, blessingPercents, blessingMultiplier, status: 'pos2to7', position: pos });
                continue;
            }
            const isCrossClass = typeof girl.class === 'number' && girl.class !== playerClass;
            const prefix = isCrossClass ? 'cross-class, ' : '';
            const myCategory = TeamScoringService.getTier3Category(girl.element);
            const myValue = TeamScoringService.getTraitValue(girl);
            let reason: string;
            if (myCategory === traitCategory && myValue === traitValue) {
                reason = prefix + 'same trait, lower stats than team picks';
            } else if (clusterElements.includes(girl.element)) {
                reason = prefix + 'cluster element, different trait value: '
                    + myCategory + '=' + (myValue || '?');
            } else {
                reason = prefix + 'other cluster: ' + myCategory + '=' + (myValue || '?');
            }
            entries.push({ id_girl: girl.id_girl, name: girl.name, element: girl.element,
                mainCarac, blessingPercents, blessingMultiplier, status: 'excluded', reason });
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

    private static buildPoolStats(eligible: GirlData[], playerClass: PlayerClass): PoolStats {
        const ownClassGirls = eligible.filter(g => typeof g.class !== 'number' || g.class === playerClass);
        const ownMythics = ownClassGirls.filter(g => g.rarity === 'mythic');
        const ownMythicsAtCap = ownMythics.filter(g => (g.level || 0) >= 750).length;
        const ownMythicsBlessed = ownMythics.filter(g => BlessingService.getEffectiveMultiplier(g as any) > 1).length;
        const otherClass: { [c: number]: number } = {};
        for (const g of eligible) {
            if (typeof g.class !== 'number' || g.class === playerClass) continue;
            otherClass[g.class] = (otherClass[g.class] || 0) + 1;
        }
        return {
            eligible: eligible.length,
            ownClass: ownClassGirls.length,
            otherClass,
            ownClassMythics: ownMythics.length,
            ownClassMythicsAtCap: ownMythicsAtCap,
            ownClassMythicsBlessed: ownMythicsBlessed,
        };
    }

    static getElementDistribution(team: TeamResult): Array<{ element: ElementType; count: number }> {
        const counts = new Map<ElementType, number>();
        for (const el of team.elements) counts.set(el, (counts.get(el) || 0) + 1);
        return [...counts.entries()]
            .map(([element, count]) => ({ element, count }))
            .sort((a, b) => b.count - a.count);
    }
}