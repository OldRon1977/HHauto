// TeamBuilderService.ts -- Spec-driven team builder.
//
// Implements docs-internal/REVIEW_TeamSelection.md verbatim.
//
// Public surface:
//   - buildTeam(allGirls, mode, playerLevel, playerClass): TeamResult | null
//   - getElementDistribution(team): summary helper for the UI panel
//
// All earlier Variants (cluster-first, mythic-first, EffectivePower
// comparator, Tier-5 Synergie boost, blessed-value boost on findTraitGroups)
// were removed in v7.35.39. The picker now follows the spec strictly.

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
    mainCarac: number;          // caracs_sum for Mode 1, projected sum for Mode 2
    blessingPercents: number[]; // active blessing pcts on this girl, e.g. [40] or [40,25]
    blessingMultiplier: number; // product of (1 + p/100)
    status: MythicAuditStatus;
    position?: number;          // 1..7 when status != 'excluded'
    reason?: string;            // human-readable reason when excluded
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
    currentMain: number;        // caracs_sum for the slot
    score: number;              // mode-aware score
    blessingPercents: number[];
    traitValue?: string;
    inCluster: boolean;         // does the girl belong to the team's element cluster?
}

export interface PoolStats {
    eligible: number;           // total Mythic + Legendary 5* in the harem
    ownClass: number;           // own-class count among eligible
    otherClass: { [c: number]: number };
    ownClassMythics: number;
    ownClassMythicsAtCap: number;
    ownClassMythicsBlessed: number;
}

export interface BlessingSummary {
    kind: string;     // 'eyeColor' | 'hairColor' | 'zodiac' | 'position' | 'element' | 'rarity'
    value: string;
    percent: number;
    pool_size: number;
}

export interface TeamResult {
    girls: GirlData[];          // up to 7 girls; index 0 is the leader
    elements: ElementType[];    // per-slot elements (parallel array)
    statScores: number[];       // mode-aware score per slot
    mainSum: number;            // sum of caracs_sum across the picked girls
    projectedSum: number;       // sum of Mode-2 projected scores across the picked girls
    leaderTier5: { id: number; name: string; priority: number };
    leaderInCluster: boolean;   // true when the leader shares the team-cluster element pair
    leaderReason?: string;      // explanation when the leader is not Mythic Shield
    traitCategory: TraitCategory; // dominant Tier-3 category in slots 2-7
    traitValue: string;         // dominant Tier-3 value in slots 2-7
    tier3Bonus: number;
    traitMatchCount: number;    // how many of the 7 girls share traitValue
    activeBlessings: BlessingSummary[]; // blessings the picker considered
    poolUsed: 'bless1+2' | 'bless1' | 'bless2' | 'unblessed' | 'no-blessings' | 'fallback';
    blessedGirlCount: number;   // pool girls with any active blessing multiplier
    fallbackReason?: string;    // populated when poolUsed === 'fallback'
    playerClass: PlayerClass;
    mythicAudit: MythicAuditEntry[];
    slotInfo: TeamSlotInfo[];
    poolStats: PoolStats;
}

const TEAM_SIZE = 7;
const POS_2_TO_7 = 6;

// Element pairs that share a Tier-3 category. Used to determine the
// 'team cluster' (the element pair from which the leader/Tier-3 chain
// is derived) and for trait-hierarchy categorisation.
const ELEMENT_PAIRS_BY_CATEGORY: Record<TraitCategory, ElementType[]> = {
    eyeColor:  ['darkness', 'fire'],
    hairColor: ['light', 'nature'],
    zodiac:    ['stone', 'psychic'],
    position:  ['water', 'sun'],
};

// Trait hierarchy used in Pos-2-7-Regel rule 1.
// Volle Hierarchie auch dann, wenn der Bless eine dieser Kategorien betrifft.
const TRAIT_HIERARCHY: TraitCategory[] = ['eyeColor', 'hairColor', 'zodiac', 'position'];

export class TeamBuilderService {

    /**
     * Spec entry point. Returns a 7-girl team or, in the fallback path,
     * an ungekuerzt team smaller than 7 when the eligible pool is short.
     * Returns null only when the harem is so small that no eligible
     * girl exists at all (filterEligible returns empty).
     */
    static buildTeam(
        allGirls: GirlData[],
        mode: ScoringMode,
        playerLevel: number,
        playerClass: PlayerClass,
    ): TeamResult | null {
        const eligible = TeamScoringService.filterEligible(allGirls, playerClass);
        if (eligible.length === 0) {
            return null;
        }

        const scoreFn = (g: GirlData) => mode === 1
            ? TeamScoringService.scoreCurrentBest(g, playerClass)
            : TeamScoringService.scoreBestPossible(g, playerClass);
        const scoreMap = new Map<number, number>();
        for (const g of eligible) scoreMap.set(g.id_girl, scoreFn(g));

        // Spec step 4 short-circuit: pool < 7 -> emergency fallback.
        if (eligible.length < TEAM_SIZE) {
            return TeamBuilderService.buildFallback(
                allGirls, eligible, scoreMap, playerClass,
                'Eligible pool has fewer than 7 girls.',
            );
        }

        // Detect active blessings authoritatively from the girl pool.
        // Returns [] when the week has no blessings the picker can act on.
        const blessings = BlessingService.detectActiveBlessings(allGirls as any);
        const summaries: BlessingSummary[] = blessings.map(b => ({
            kind: b.kind, value: b.value, percent: b.percent, pool_size: b.pool_size,
        }));

        let result: TeamResult | null = null;

        if (blessings.length >= 2) {
            // Spec step 2.1: bless1 = strongest, bless2 = second-strongest.
            // detectActiveBlessings already sorts by (percent desc, pool desc,
            // trait-kind tiebreaker eyes > hair > zodiac > position > element > rarity).
            const bless1 = blessings[0];
            const bless2 = blessings[1];

            // Spec step 2.2: girls with both bless1 AND bless2.
            const pool22 = eligible.filter(g => TeamBuilderService.classifyByBlessings(g, bless1, bless2) === 'both');
            result = TeamBuilderService.tryPool(
                pool22, eligible, scoreMap, playerClass,
                summaries, 'bless1+2',
            );

            // Spec step 2.3: only bless1.
            if (!result) {
                const pool23 = eligible.filter(g => TeamBuilderService.classifyByBlessings(g, bless1, bless2) === 'bless1');
                result = TeamBuilderService.tryPool(
                    pool23, eligible, scoreMap, playerClass,
                    summaries, 'bless1',
                );
            }

            // Spec step 2.4: girls without active blessing.
            if (!result) {
                const pool24 = eligible.filter(g => BlessingService.getEffectiveMultiplier(g as any) <= 1);
                result = TeamBuilderService.tryPool(
                    pool24, eligible, scoreMap, playerClass,
                    summaries, 'unblessed',
                );
            }
        } else if (blessings.length === 1) {
            // Spec step 2.1 note: 'Wenn nur 1 Bless aktiv: 2.2 ueberspringen,
            // direkt zu 2.3'. Pool 2.3 = girls with bless1.
            const bless1 = blessings[0];
            const pool23 = eligible.filter(g => TeamBuilderService.classifyByBlessings(g, bless1, undefined) === 'bless1');
            result = TeamBuilderService.tryPool(
                pool23, eligible, scoreMap, playerClass,
                summaries, 'bless1',
            );

            if (!result) {
                const pool24 = eligible.filter(g => BlessingService.getEffectiveMultiplier(g as any) <= 1);
                result = TeamBuilderService.tryPool(
                    pool24, eligible, scoreMap, playerClass,
                    summaries, 'unblessed',
                );
            }
        } else {
            // Spec step 1 / step 3: no blessings -> pool 3.1 = entire eligible set.
            result = TeamBuilderService.tryPool(
                eligible, eligible, scoreMap, playerClass,
                summaries, 'no-blessings',
            );
        }

        if (result) return result;

        // All blessing-related pools failed (or the pool was so small
        // that no team-cluster could be assembled). Fall through to the
        // emergency fallback (Spec step 4).
        return TeamBuilderService.buildFallback(
            allGirls, eligible, scoreMap, playerClass,
            'No bless/no-bless pool produced 7 girls; fell back to caracs_sum picks.',
        );
    }

    // ---- helpers --------------------------------------------------------

    /**
     * Classify a girl by which of the two strongest blessings she carries.
     *
     * Match is determined by (kind, value): does the girl's relevant
     * field equal the blessing's value AND does she also carry an active
     * blessing percent (any percent on her pvp_v3.carac1 list)? Matching
     * by percent alone is unsafe because two blessings can share the same
     * percent and would falsely classify every blessed girl as 'both'.
     *
     * Returns:
     *   'both'   when the girl matches both blessings AND is currently blessed
     *   'bless1' when she matches bless1 only
     *   'bless2' when she matches bless2 only (only meaningful when bless2 is provided)
     *   'none'   otherwise
     */
    private static classifyByBlessings(
        girl: GirlData,
        bless1: BlessingSummary,
        bless2: BlessingSummary | undefined,
    ): 'both' | 'bless1' | 'bless2' | 'none' {
        // The girl must currently carry an active blessing for her to fall
        // into pool 2.2 / 2.3 at all.
        const isBlessed = BlessingService.getEffectiveMultiplier(girl as any) > 1;
        if (!isBlessed) return 'none';
        const has1 = TeamBuilderService.matchesBlessingCondition(girl, bless1);
        const has2 = bless2 !== undefined && TeamBuilderService.matchesBlessingCondition(girl, bless2);
        if (has1 && has2) return 'both';
        if (has1) return 'bless1';
        if (has2) return 'bless2';
        return 'none';
    }

    /**
     * Does the girl satisfy the blessing's condition (her relevant field
     * equals the blessing's value)?
     */
    private static matchesBlessingCondition(girl: GirlData, bless: BlessingSummary): boolean {
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

    /**
     * Build a team from one specific pool. Returns null when the pool
     * cannot fill 7 slots even with cross-pool fallback for the leader.
     */
    private static tryPool(
        pool: GirlData[],
        eligibleAll: GirlData[],
        scoreMap: Map<number, number>,
        playerClass: PlayerClass,
        summaries: BlessingSummary[],
        poolUsed: TeamResult['poolUsed'],
    ): TeamResult | null {
        if (pool.length === 0) return null;

        // Pos-2-7-Regel: pick the team cluster (element pair derived from
        // the dominant trait-hierarchy bucket inside the pool).
        const cluster = TeamBuilderService.chooseTeamCluster(pool);
        if (!cluster) return null;

        // Spec sequence inside a pool: Sub-Cluster -> Leader -> Pos 2-7.
        // Pick the leader from the pool first (Spec 2.2.1 / 2.3.1 / 2.4.1
        // / 3.1.1) using the 8-step Leaderauswahl-Regel.
        let leader = TeamBuilderService.pickLeader(pool, cluster, scoreMap, playerClass);
        if (!leader) {
            // Spec fallback chain: if the local pool has no valid leader,
            // widen to the entire eligible set (one cohesive escalation
            // step instead of the 2.2.1.1/2.2.1.2 nested chain).
            leader = TeamBuilderService.pickLeader(eligibleAll, cluster, scoreMap, playerClass);
            if (!leader) return null;
        }

        // Pos 2-7: take cluster sub-groups in hierarchy order, sort each
        // by caracs_sum desc (Element-Coeff tiebreak), pick 6, never
        // re-using the leader.
        const reservedIds = new Set<number>([leader.id_girl]);
        const positions = TeamBuilderService.fillPositions2to7(cluster, pool, reservedIds, scoreMap);
        if (positions.length < POS_2_TO_7) return null;

        const team: GirlData[] = [leader, ...positions];
        return TeamBuilderService.buildResult(
            team, scoreMap, eligibleAll, playerClass,
            cluster, summaries, poolUsed,
        );
    }

    /**
     * Pos-2-7-Regel rule 1+3: bilde Sub-Gruppen passend zur Trait-Hierarchie
     * eyes > hair > zodiac > position > element > rarity, und bestimme das
     * dominante Sub-Cluster.
     *
     * Returns the team's element-pair cluster (which determines the
     * Tier-3 trait category, the leader's element-pair-match check, and
     * the Pos-2-7 filler) plus the dominant sub-trait value when the
     * hierarchy resolved inside the cluster.
     *
     * Mono-Element-Sonderfall: when the pool is dominated by a single
     * element, the Tier-3 category for that element wins ahead of the
     * trait hierarchy. Example: stone-bless pool -> zodiac wins before
     * eyeColor, because eye-color does not feed Tier-3 for stones.
     */
    private static chooseTeamCluster(pool: GirlData[]): TeamCluster | null {
        if (pool.length === 0) return null;

        // Element histogram inside the pool. Used both for the mono-element
        // detection and as a tiebreaker when the trait hierarchy resolves
        // to 'element'.
        const elementCounts = new Map<ElementType, number>();
        for (const g of pool) {
            elementCounts.set(g.element, (elementCounts.get(g.element) || 0) + 1);
        }

        // Mono-element detection: a pool is mono when one element holds
        // >= 80% of the pool. Element bless typically yields 100%
        // (every girl is the same element) but we keep some headroom
        // for mixed sub-pools.
        let monoElement: ElementType | null = null;
        for (const [el, count] of elementCounts) {
            if (count / pool.length >= 0.8) {
                monoElement = el;
                break;
            }
        }

        // Helper: given a TraitCategory, bucket the pool's eligible
        // members (those whose element pair matches the category) by
        // trait value, return the largest bucket above the minimum size.
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
            return { category, value: topVal, girls: topGirls, subset };
        };

        // Mono-element sonderfall: prefer the Tier-3 category of the pool
        // element. We still look at all four hierarchy categories so the
        // result includes the actual trait value, but with the mono category
        // bumped to the front of the list.
        const orderedCategories = monoElement
            ? [TeamScoringService.getTier3Category(monoElement),
               ...TRAIT_HIERARCHY.filter(c => c !== TeamScoringService.getTier3Category(monoElement!))]
            : [...TRAIT_HIERARCHY];

        // Walk the hierarchy and pick the first category that yields a
        // non-trivial bucket (>= 2 girls so the Tier-3 chain has bite).
        for (const category of orderedCategories) {
            const dominant = dominantBucketFor(category);
            if (dominant && dominant.girls.length >= 1) {
                return {
                    category,
                    value: dominant.value,
                    elements: ELEMENT_PAIRS_BY_CATEGORY[category],
                };
            }
        }

        // Fall through: trait hierarchy did not resolve. Use 'element' (Spec
        // rule 3 step). Pick the element with the highest count; tiebreak
        // by Element-Coeff. The team-cluster category becomes that
        // element's Tier-3 category, the trait value is the most common
        // value inside the chosen pair.
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
    /**
     * Pos-2-7-Regel rule 1+2+3+4: Sub-Gruppen bilden, sortieren, picken.
     *
     * - Bilde Sub-Gruppen passend zur Trait-Hierarchie. Pro Trait-Wert
     *   eine Sub-Gruppe.
     * - Innerhalb jeder Sub-Gruppe: caracs_sum desc, Element-Coeff
     *   tiebreak.
     * - Sub-Gruppen-Reihenfolge: Trait-Hierarchie zuerst, Pool-Groesse
     *   desc innerhalb. Bei 'element' Element-Coeff desc.
     * - Waehle 6 Maedchen aus dem Cluster.
     */
    private static fillPositions2to7(
        cluster: TeamCluster,
        pool: GirlData[],
        reservedIds: Set<number>,
        scoreMap: Map<number, number>,
    ): GirlData[] {
        // Working set: only girls whose element-pair matches the cluster.
        const clusterGirls = pool.filter(g => cluster.elements.includes(g.element) && !reservedIds.has(g.id_girl));
        if (clusterGirls.length === 0) return [];

        // Sort the cluster girls into ordered sub-groups. The primary
        // grouping uses the cluster's trait category; secondary slots are
        // filled from the next-largest sub-group with the same category
        // and from any cluster girl when sub-groups run out.

        const subGroupKeys: string[] = [];
        const subGroups = new Map<string, GirlData[]>();

        const groupKey = (g: GirlData): string => {
            const v = TeamScoringService.getTraitValue(g);
            return v ?? '__notrait__';
        };

        for (const g of clusterGirls) {
            const key = groupKey(g);
            if (!subGroups.has(key)) {
                subGroups.set(key, []);
                subGroupKeys.push(key);
            }
            subGroups.get(key)!.push(g);
        }

        // Sort sub-groups: primary group (matches cluster.value) first,
        // then by size desc, then by Element-Coeff of the dominant element
        // inside the sub-group.
        const sortedKeys = [...subGroupKeys].sort((a, b) => {
            if (a === cluster.value && b !== cluster.value) return -1;
            if (b === cluster.value && a !== cluster.value) return 1;
            const sizeDelta = subGroups.get(b)!.length - subGroups.get(a)!.length;
            if (sizeDelta !== 0) return sizeDelta;
            const aTop = TeamBuilderService.dominantElementCoeff(subGroups.get(a)!);
            const bTop = TeamBuilderService.dominantElementCoeff(subGroups.get(b)!);
            return bTop - aTop;
        });

        // Sort each sub-group by the mode-aware score desc, Element-Coeff
        // tiebreak. The map carries scoreCurrentBest in mode 1 and
        // scoreBestPossible (projected to level 750 + max grades) in
        // mode 2, so the same Pos-2-7-Regel runs against the right
        // numbers in each mode.
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

        // Spec 2.2.2.1 / 2.3.2.1 / 2.4.2.1 / 3.1.2.1: when the cluster
        // sub-groups did not yield 6 girls, fill from any cluster girl
        // not yet used. (We do not fall back to the entire pool here --
        // that escalation is the caller's job, Spec 2.2.2.2 / 2.3.2.2 /
        // 2.4.2.2 / 3.1.2.2.)
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

    /**
     * Leaderauswahl-Regel: 8 Sortier-Schluessel von oben nach unten.
     *
     *   1. Mythic vor Legendary
     *   2. Tier-5: Shield > Stun > Execute > Reflect
     *   3. Element-Pair-Match zum Team-Cluster
     *   4. Trait-Wert-Match zum Team-Cluster
     *   5. blessed vor unblessed
     *   6. own-class vor cross-class
     *   7. caracs_sum absteigend
     *   8. Element-Coeff hoeher zuerst
     *
     * Punkt 4 vor Punkt 6: gemaess Spec finalisiert. Eine Mythic-Stone-
     * Schild-Leaderin mit Bélier-Zodiac (Trait-Match) gewinnt vor einer
     * Mythic-Stone-Schild-Leaderin mit Balance-Zodiac (kein Trait-Match),
     * unabhaengig davon, ob letztere own-class ist.
     */
    private static pickLeader(
        candidates: GirlData[],
        cluster: TeamCluster,
        scoreMap: Map<number, number>,
        playerClass: PlayerClass,
    ): GirlData | undefined {
        if (candidates.length === 0) return undefined;
        const sorted = [...candidates].sort((a, b) => {
            // 1. Mythic vor Legendary
            const rA = a.rarity === 'mythic' ? 0 : 1;
            const rB = b.rarity === 'mythic' ? 0 : 1;
            if (rA !== rB) return rA - rB;

            // 2. Tier-5: Shield > Stun > Execute > Reflect
            const tA = TeamScoringService.getTier5Skill(a.element).priority;
            const tB = TeamScoringService.getTier5Skill(b.element).priority;
            if (tA !== tB) return tB - tA;

            // 3. Element-Pair-Match zum Team-Cluster
            const eA = cluster.elements.includes(a.element) ? 0 : 1;
            const eB = cluster.elements.includes(b.element) ? 0 : 1;
            if (eA !== eB) return eA - eB;

            // 4. Trait-Wert-Match zum Team-Cluster (only counts when the
            //    girl's own Tier-3 category equals the cluster category;
            //    a hairColor=0F0 light girl does NOT match an
            //    eyeColor=0F0 cluster).
            const matchA = TeamScoringService.getTier3Category(a.element) === cluster.category
                && TeamScoringService.getTraitValue(a) === cluster.value;
            const matchB = TeamScoringService.getTier3Category(b.element) === cluster.category
                && TeamScoringService.getTraitValue(b) === cluster.value;
            const vA = matchA ? 0 : 1;
            const vB = matchB ? 0 : 1;
            if (vA !== vB) return vA - vB;

            // 5. blessed vor unblessed
            const bA = BlessingService.getEffectiveMultiplier(a as any) > 1 ? 0 : 1;
            const bB = BlessingService.getEffectiveMultiplier(b as any) > 1 ? 0 : 1;
            if (bA !== bB) return bA - bB;

            // 6. own-class vor cross-class (no class field => own-class neutral)
            const ocA = (typeof a.class === 'number' && a.class !== playerClass) ? 1 : 0;
            const ocB = (typeof b.class === 'number' && b.class !== playerClass) ? 1 : 0;
            if (ocA !== ocB) return ocA - ocB;

            // 7. caracs_sum absteigend (mode-aware: scoreCurrentBest in
            //    mode 1, scoreBestPossible in mode 2).
            const sA = scoreMap.get(a.id_girl) ?? TeamScoringService.caracsSum(a);
            const sB = scoreMap.get(b.id_girl) ?? TeamScoringService.caracsSum(b);
            if (sA !== sB) return sB - sA;

            // 8. Element-Coeff hoeher zuerst
            const cA = TeamScoringService.getElementPowerCoeff(a.element);
            const cB = TeamScoringService.getElementPowerCoeff(b.element);
            if (cA !== cB) return cB - cA;

            return 0;
        });
        return sorted[0];
    }

    /**
     * Spec step 4: Notfall-Fallback bei Pool < 7. Alle vorhandenen Girls
     * nach caracs_sum absteigend sortieren, ungekuerzt als Team setzen.
     * Restslots bleiben leer.
     */
    private static buildFallback(
        allGirls: GirlData[],
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

        // Synthesize a team cluster from the team itself so the result
        // structure is consistent with the normal path.
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

    /**
     * Compose the TeamResult struct used by the UI panel and tests.
     * `team[0]` is the leader; later entries are positions 2..7. The
     * structure is identical for normal builds and the emergency
     * fallback (whose team may be smaller than 7).
     */
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

        // Score map may not contain every team girl when the eligible-pool
        // shortcut was bypassed. Fill missing entries on the fly.
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

interface TeamCluster {
    category: TraitCategory;
    value: string;
    elements: ElementType[];
}