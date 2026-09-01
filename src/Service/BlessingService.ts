// BlessingService.ts -- Loads and caches weekly blessing data.
//
// Blessings change weekly and affect girl stats. This service loads
// them via AJAX on the Home page and caches the result in localStorage.
// The team builder reads from cache to make blessing-aware decisions.
//
// Used by: AutoLoopPageHandlers.ts (Home page), TeamBuilderService.ts
//
import { getStoredValue, setStoredValue, getStoredJSON } from "../Helper/StorageHelper";
import { logHHAuto } from "../Utils/LogUtils";
import { getHHAjax } from "../Utils/Utils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { TK } from "../config/StorageKeys";

const CACHE_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Which battle mode a blessing lookup is for. The game maintains two
 * parallel blessing sets per girl (verified 2026-07-13 against the
 * hh-bless-cluster fixtures and a live dump):
 *   - 'league'    -> blessing_bonuses.pvp_v3: the two weekly league
 *                    blessings only. Mirrored by the game flag
 *                    can_be_blessed (GirlData: can_be_blessed_league).
 *   - 'labyrinth' -> blessing_bonuses.pvp_v4: the league blessings PLUS
 *                    the weekly Role blessing, which applies only in the
 *                    Love Labyrinth. Mirrored by can_be_blessed_pvp4
 *                    (GirlData: can_be_blessed_labyrinth).
 * There is deliberately NO fallback from one set to the other: a girl
 * carrying only the Role blessing is unblessed for league purposes.
 */
export type BlessingContext = 'league' | 'labyrinth';

export interface BlessingData {
    timestamp: number;
    raw: any;
    blessedTraits: string[];
    blessedValues: Record<string, string>;
    blessedElement?: string;
}

export class BlessingService {

    static loadIfExpired(): void {
        const cached = BlessingService.getCached();
        if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION_MS) {
            return;
        }
        BlessingService.fetchAndCache();
    }

    static fetchAndCache(): void {
        const ajax = getHHAjax();
        if (!ajax) {
            logHHAuto('BlessingService: hh_ajax not available');
            return;
        }

        logHHAuto('BlessingService: fetching blessings...');
        ajax({ action: 'get_girls_blessings' }, (response: any) => {
            if (!response || !response.success) {
                logHHAuto('BlessingService: fetch failed: ' + JSON.stringify(response));
                return;
            }

            logHHAuto('BlessingService: response keys: ' + Object.keys(response).join(', '));
            logHHAuto('BlessingService: raw (500 chars): ' + JSON.stringify(response).substring(0, 500));

            const blessingData: BlessingData = {
                timestamp: Date.now(),
                raw: response,
                blessedTraits: BlessingService.parseTraits(response),
                blessedValues: BlessingService.parseBlessedValues(response),
                blessedElement: BlessingService.parseElement(response),
            };

            setStoredValue(HHStoredVarPrefixKey + TK.blessingsCache, JSON.stringify(blessingData));
            logHHAuto('BlessingService: cached. Traits: ' + blessingData.blessedTraits.join(', ') + ', Element: ' + (blessingData.blessedElement || 'unknown'));
        });
    }

    static getCached(): BlessingData | null {
        try {
            return getStoredJSON(HHStoredVarPrefixKey + TK.blessingsCache, null);
        } catch {
            return null;
        }
    }

    static isCacheValid(): boolean {
        const cached = BlessingService.getCached();
        return cached !== null && (Date.now() - cached.timestamp) < CACHE_DURATION_MS;
    }

    /**
     * Context-specific percent list (carac1) from the girl's
     * blessing_bonuses. 'league' reads pvp_v3, 'labyrinth' reads pvp_v4;
     * never falls back across contexts (see BlessingContext). Accepts
     * raw API girls (blessing_bonuses) and GirlData (blessingBonuses).
     */
    private static getContextPercentList(
        girl: { blessing_bonuses?: any; blessingBonuses?: any },
        context: BlessingContext,
    ): number[] {
        const bb = (girl as any).blessing_bonuses ?? girl.blessingBonuses;
        if (!bb || typeof bb !== 'object' || Array.isArray(bb)) return [];
        const v = context === 'labyrinth' ? bb.pvp_v4 : bb.pvp_v3;
        if (!v || typeof v !== 'object') return [];
        const pcs = v.carac1;
        if (!Array.isArray(pcs)) return [];
        return pcs.map((p: any) => Number(p)).filter((n: number) => Number.isFinite(n) && n > 0);
    }

    /**
     * Authoritative per-girl blessing multiplier from the game's
     * blessing_bonuses field. This is the single source of truth for
     * 'is this girl currently blessed in this context and by how much'.
     *
     * Each set is shaped { caracN: number[] }; the list contains one
     * entry per active blessing affecting the girl, applied
     * multiplicatively. Examples (league):
     *   pvp_v3.carac1 = []         -> no blessing -> multiplier 1.0
     *   pvp_v3.carac1 = [25]       -> +25%        -> multiplier 1.25
     *   pvp_v3.carac1 = [40, 25]   -> +40% AND +25% -> multiplier 1.75
     *
     * The girl's caracs sub-object already contains the multiplied stat,
     * so the team builder does not need to multiply again. This helper
     * is for diagnostics: 'is girl X blessed?' and 'how much'.
     */
    static getEffectiveMultiplier(
        girl: { blessing_bonuses?: any; blessingBonuses?: any },
        context: BlessingContext = 'league',
    ): number {
        let mult = 1;
        for (const n of BlessingService.getContextPercentList(girl, context)) {
            mult *= 1 + n / 100;
        }
        return mult;
    }

    /**
     * List the blessing percentages currently active on this girl for
     * the given context, in the order the game returned them. Useful for
     * UI annotations like '(+25% blessing)' or '(+40%, +25% blessing)'.
     */
    static getActivePercents(
        girl: { blessing_bonuses?: any; blessingBonuses?: any },
        context: BlessingContext = 'league',
    ): number[] {
        return BlessingService.getContextPercentList(girl, context);
    }

    private static parseTraits(response: any): string[] {
        const traits: string[] = [];
        const active = response.active;
        if (!Array.isArray(active)) return traits;

        for (const blessing of active) {
            const desc = (blessing.description || '').toLowerCase();
            // Only count blessings that apply globally (not Love Labyrinth only)
            if (!desc.includes('bonus on all attributes') || desc.includes('labyrinth')) continue;

            if (desc.includes('eye color')) traits.push('eyeColor');
            if (desc.includes('hair color') || desc.includes('hair colour')) traits.push('hairColor');
            if (desc.includes('zodiac') || desc.includes('astrological') || (desc.includes('sign ') && !desc.includes('element'))) traits.push('zodiac');
            if (desc.includes('favourite position') || desc.includes('favorite position')) traits.push('position');
        }
        return traits;
    }

    /**
     * Parse the specific blessed trait values from the API response.
     * E.g. "Eye Color Golden" -> { eyeColor: "golden" }
     */
    static parseBlessedValues(response: any): Record<string, string> {
        const values: Record<string, string> = {};
        const active = response?.active || [];
        if (!Array.isArray(active)) return values;

        for (const blessing of active) {
            const desc = (blessing.description || '');
            if (!desc.toLowerCase().includes('bonus on all attributes') || desc.toLowerCase().includes('labyrinth')) continue;

            // Extract from: <span class="blessing-condition">Eye Color Golden</span>
            const match = desc.match(/blessing-condition[^>]*>([^<]+)/i);
            if (!match) continue;
            const condition = match[1].trim();

            if (condition.toLowerCase().startsWith('eye color')) {
                values['eyeColor'] = condition.replace(/eye color\s*/i, '').trim().toLowerCase();
            } else if (condition.toLowerCase().startsWith('hair color') || condition.toLowerCase().startsWith('hair colour')) {
                values['hairColor'] = condition.replace(/hair colou?r\s*/i, '').trim().toLowerCase();
            } else if (condition.toLowerCase().startsWith('zodiac') || condition.toLowerCase().startsWith('astrological') || condition.toLowerCase().startsWith('sign')) {
                values['zodiac'] = condition.replace(/(?:zodiac|astrological)\s*(?:sign)?\s*/i, '').replace(/^sign\s*/i, '').trim().toLowerCase();
            } else if (condition.toLowerCase().startsWith('favourite position') || condition.toLowerCase().startsWith('favorite position')) {
                values['position'] = condition.replace(/favou?rite? position\s*/i, '').trim().toLowerCase();
            } else if (condition.toLowerCase().startsWith('element')) {
                // Element blessing handled by parseElement
            }
        }
        return values;
    }

    private static parseElement(response: any): string | undefined {
        const active = response.active;
        if (!Array.isArray(active)) return undefined;

        const elementMap: Record<string, string> = {
            'eccentric': 'fire', 'sensual': 'water', 'exhibitionist': 'nature',
            'physical': 'stone', 'playful': 'sun', 'dominatrix': 'darkness',
            'submissive': 'psychic', 'voyeur': 'light',
        };

        for (const blessing of active) {
            const desc = (blessing.description || '').toLowerCase();
            if (!desc.includes('bonus on all attributes') || desc.includes('labyrinth')) continue;
            if (!desc.includes('element')) continue;

            for (const [className, element] of Object.entries(elementMap)) {
                if (desc.includes(className)) return element;
            }
        }
        return undefined;
    }

    /**
     * Resolve the hex code for a blessed trait by analyzing blessing_bonuses on girls.
     * 
     * Strategy: The Blessing API gives us names (e.g. "grey", "dolphin") but girl data
     * uses hex codes (e.g. "888") or filenames (e.g. "2.png"). This method finds the
     * mapping by looking at which girls have the blessing bonus and what trait value
     * they share uniformly.
     * 
     * @param girls - All available girls with their raw data
     * @param blessedCategory - The trait category (eyeColor, hairColor, position)
     * @param blessingPercent - The bonus percentage from the blessing (e.g. 30, 40)
     * @returns The hex code / filename that corresponds to the blessed value, or undefined
     */
    static resolveHexForBlessing(
        girls: Array<{ eye_color1?: string; hair_color1?: string; position_img?: string; blessing_bonuses?: any }>,
        blessedCategory: string,
        blessingPercent?: number
    ): string | undefined {
        // Find girls that have pvp_v3 blessing bonuses
        const blessedGirls = girls.filter(g => {
            if (!g.blessing_bonuses || typeof g.blessing_bonuses !== 'object') return false;
            if (Array.isArray(g.blessing_bonuses) && g.blessing_bonuses.length === 0) return false;
            return g.blessing_bonuses.pvp_v3 !== undefined;
        });

        if (blessedGirls.length === 0) return undefined;

        // Group blessed girls by their bonus percentage
        const byPercent = new Map<number, typeof blessedGirls>();
        for (const g of blessedGirls) {
            const pcts = g.blessing_bonuses.pvp_v3?.carac1;
            if (!Array.isArray(pcts)) continue;
            for (const pct of pcts) {
                if (!byPercent.has(pct)) byPercent.set(pct, []);
                byPercent.get(pct)!.push(g);
            }
        }

        // For each percentage group, check if the target trait has a uniform value
        const fieldMap: Record<string, string> = {
            eyeColor: 'eye_color1',
            hairColor: 'hair_color1',
            position: 'position_img',
            zodiac: 'zodiac',
        };
        const field = fieldMap[blessedCategory];
        if (!field) return undefined;

        // If we know the exact percentage, check that group first
        const groupsToCheck = blessingPercent
            ? [byPercent.get(blessingPercent), ...Array.from(byPercent.values())]
            : Array.from(byPercent.values());

        for (const group of groupsToCheck) {
            if (!group || group.length < 1) continue;

            // Count trait values in this group
            const valueCounts = new Map<string, number>();
            for (const g of group) {
                const val = (g as any)[field];
                if (val && val !== '') {
                    valueCounts.set(val, (valueCounts.get(val) || 0) + 1);
                }
            }

            // Pick the dominant value when it has >= 80% of the group
            // OR is at least 3x larger than the next contender. The
            // raw 90% threshold rejected legitimate dominants like
            // edge cases (e.g. 41/47, 87%) where a few girls happen
            // to have a different eye color but the SAME blessing
            // bonus (multiple blessings stacked on the same girl).
            const sorted = [...valueCounts.entries()].sort((a, b) => b[1] - a[1]);
            if (sorted.length > 0) {
                const [topVal, topCount] = sorted[0];
                const secondCount = sorted.length > 1 ? sorted[1][1] : 0;
                const ratio = topCount / group.length;
                const lead = secondCount === 0 ? Infinity : topCount / secondCount;
                if (ratio >= 0.8 || lead >= 3) {
                    logHHAuto('BlessingService: resolved ' + blessedCategory + ' -> hex="' + topVal + '" (' + topCount + '/' + group.length + ' girls, lead=' + (lead === Infinity ? 'inf' : lead.toFixed(1)) + ')');
                    return topVal;
                }
            }
        }

        return undefined;
    }

    /**
     * Resolve the currently blessed trait values to the hex codes / filenames
     * / glyph strings used in the girl-data fields. Combines the cached
     * blessing names (parseBlessedValues) with per-girl pool statistics
     * (resolveHexForBlessing) so the team builder can match on the actual
     * field values stored on each girl.
     *
     * Returns a per-category mapping like:
     *   { eyeColor: "F00", hairColor: "0F0" }
     *
     * For zodiac, the value is the full glyph+name string as it appears in
     * girl.zodiac (e.g. "GLYPH Capricorne"); the same string is what girls
     * carry, so direct equality matches.
     *
     * Categories with no resolvable value are omitted from the result. If
     * no blessing data is cached or no girls carry blessings, returns {}.
     */
    static getBlessedHexValues(
        girls: Array<{ eye_color1?: string; hair_color1?: string; position_img?: string; zodiac?: string; blessing_bonuses?: any }>
    ): Record<string, string> {
        const result: Record<string, string> = {};
        const cached = BlessingService.getCached();
        if (!cached || !cached.raw) return result;

        const named = cached.blessedValues || {};
        const categories = ['eyeColor', 'hairColor', 'zodiac', 'position'] as const;

        for (const cat of categories) {
            const namedValue = named[cat];
            if (!namedValue) continue;
            const pct = BlessingService.parseBlessingPercent(cached.raw, cat);
            const hex = BlessingService.resolveHexForBlessing(girls, cat, pct);
            if (hex) result[cat] = hex;
        }
        return result;
    }

    /**
     * Resolve a girl's value for a blessing trait kind, accepting both
     * raw API girls (snake_case: eye_color1, hair_color1, position_img)
     * and GirlData (camelCase: eyeColor, hairColor, position). Single
     * source of truth shared by detectActiveBlessings and the team
     * builder's blessing matcher, so a future game field rename is a
     * one-place change (see lesson mapping-fix-vollstaendig-pruefen).
     * position is normalised (the '.png' suffix is stripped).
     */
    static resolveTraitField(
        g: any,
        kind: 'eyeColor' | 'hairColor' | 'zodiac' | 'position' | 'element' | 'rarity',
    ): string | undefined {
        switch (kind) {
            case 'eyeColor':  return g.eye_color1 ?? g.eyeColor;
            case 'hairColor': return g.hair_color1 ?? g.hairColor;
            case 'zodiac':    return g.zodiac;
            case 'position': {
                const raw = g.position_img ?? g.position;
                if (raw === undefined || raw === null) return undefined;
                return String(raw).replace(/\.png$/i, '');
            }
            case 'element':   return g.element;
            case 'rarity':    return g.rarity;
            default:          return undefined;
        }
    }

    /**
     * Detect active blessings DIRECTLY from the girls in the pool, without
     * relying on String-Parsing of the API description (which is locale-
     * dependent: 'eye color' / 'couleur des yeux' / 'augenfarbe' ...).
     *
     * The game's blessing_bonuses field on each girl is the authoritative
     * source. The `context` picks the blessing set (league -> pvp_v3,
     * labyrinth -> pvp_v4 incl. the weekly Role blessing; see
     * BlessingContext). By cross-referencing the blessed girls with their
     * fields (element, rarity, eye_color1, hair_color1, zodiac,
     * position_img), we identify what each blessing targets WITHOUT
     * reading any localized description.
     *
     * Returns an array of detected blessings sorted by priority:
     *   1. blessings with the highest bonus percent (e.g. 40% > 25%)
     *   2. blessings with the largest blessed pool
     *
     * The percent comes from the context's carac1 list on a representative
     * blessed girl. When two blessings stack on the same girl, that girl's
     * carac1 list has multiple entries; we extract individual percents per
     * field (element/rarity/trait) by finding the field whose value is
     * uniformly shared by girls carrying a particular percent.
     */
    static detectActiveBlessings(
        girls: Array<any>,
        context: BlessingContext = 'league',
    ): Array<{
        kind: 'eyeColor' | 'hairColor' | 'zodiac' | 'position' | 'element' | 'rarity';
        value: string;
        percent: number;
        pool_size: number;
    }> {
        // Read fields tolerantly: callers pass either raw API girls
        // (snake_case: eye_color1, hair_color1, position_img,
        // blessing_bonuses, can_be_blessed) or GirlData objects (camelCase:
        // eyeColor, hairColor, position, blessingBonuses). For 'blessed'
        // status: prefer the context's explicit game flag (league:
        // can_be_blessed, labyrinth: can_be_blessed_pvp4 -- mapped to
        // can_be_blessed_league / can_be_blessed_labyrinth in GirlData).
        // The flag is authoritative in both directions: a girl carrying
        // only the labyrinth Role blessing has can_be_blessed === false
        // and must NOT count as league-blessed. Only when the flag is
        // absent is blessed-ness derived from the context's percent list.
        const flagOf = (g: any): boolean | undefined => {
            const flag = context === 'labyrinth'
                ? (g.can_be_blessed_labyrinth ?? g.can_be_blessed_pvp4)
                : (g.can_be_blessed_league ?? g.can_be_blessed);
            return typeof flag === 'boolean' ? flag : undefined;
        };
        const isBlessed = (g: any): boolean => {
            const flag = flagOf(g);
            if (flag !== undefined) return flag;
            return BlessingService.getContextPercentList(g, context).length > 0;
        };

        const blessed = girls.filter(g => isBlessed(g)
            && BlessingService.getContextPercentList(g, context).length > 0);
        if (blessed.length === 0) return [];

        // Collect distinct percents seen across the blessed pool.
        const percents = new Set<number>();
        for (const g of blessed) {
            for (const n of BlessingService.getContextPercentList(g, context)) {
                percents.add(n);
            }
        }

        type Cand = {
            kind: 'eyeColor' | 'hairColor' | 'zodiac' | 'position' | 'element' | 'rarity';
            value: string;
            percent: number;
            pool_size: number;
        };

        const candidates: Cand[] = [];

        // Read a girl's value for a given trait kind, accepting both
        // snake_case (raw API) and camelCase (GirlData) forms.
        const fieldOf = (g: any, kind: Cand['kind']): string | undefined =>
            BlessingService.resolveTraitField(g, kind);

        const kinds: Cand['kind'][] = ['eyeColor', 'hairColor', 'zodiac', 'position', 'element', 'rarity'];

        // For every (percent, kind), find the field+value that uniquely
        // identifies girls receiving that blessing percent. We need both:
        //   1. high dominance INSIDE the blessed pool (>= 80%)
        //   2. specificity: girls outside the blessed pool with that same
        //      value must not also receive the blessing -- otherwise we
        //      pick up correlations (e.g. "all 40%-blessed girls happen
        //      to be legendary" doesn't mean rarity=legendary IS the
        //      blessing condition).
        for (const percent of percents) {
            const carrying = blessed.filter(g =>
                BlessingService.getContextPercentList(g, context).includes(percent));
            if (carrying.length === 0) continue;

            for (const kind of kinds) {
                const valueCounts = new Map<string, number>();
                for (const g of carrying) {
                    const raw = fieldOf(g, kind);
                    if (raw === undefined || raw === null || raw === '') continue;
                    const key = String(raw);
                    valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
                }
                if (valueCounts.size === 0) continue;
                const sorted = [...valueCounts.entries()].sort((a, b) => b[1] - a[1]);
                const [topVal, topCount] = sorted[0];
                const second = sorted.length > 1 ? sorted[1][1] : 0;
                const ratio = topCount / carrying.length;
                const lead = second === 0 ? Infinity : topCount / second;
                // Dominance check.
                if (ratio < 0.8 && lead < 3) continue;

                // Specificity check.
                const samevalAll = girls.filter(g => String(fieldOf(g, kind) ?? '') === topVal);
                const samevalBlessed = samevalAll.filter(g => isBlessed(g));
                const specificity = samevalAll.length === 0 ? 0 : samevalBlessed.length / samevalAll.length;
                if (specificity < 0.8) continue;

                candidates.push({ kind, value: topVal, percent, pool_size: samevalAll.length });
            }
        }

        // De-duplicate: a single (kind, value) might appear with two different
        // percents from stacked blessings; keep the highest percent.
        const dedup = new Map<string, Cand>();
        for (const c of candidates) {
            const key = c.kind + '=' + c.value;
            const cur = dedup.get(key);
            if (!cur || c.percent > cur.percent) dedup.set(key, c);
        }

        // Sort by priority:
        //   1. higher bonus percent first
        //   2. larger pool size
        //   3. trait-kind tiebreaker (eyes > hair > zodiac > position).
        //      Element/rarity rank below the trait kinds.
        const kindPriority: Record<string, number> = {
            eyeColor: 5,
            hairColor: 4,
            zodiac: 3,
            position: 2,
            element: 1,
            rarity: 0,
        };
        return [...dedup.values()].sort((a, b) => {
            if (b.percent !== a.percent) return b.percent - a.percent;
            if (b.pool_size !== a.pool_size) return b.pool_size - a.pool_size;
            const pa = kindPriority[a.kind] ?? 0;
            const pb = kindPriority[b.kind] ?? 0;
            return pb - pa;
        });
    }

        /**
     * Parse the blessing bonus percentage for a given trait category.
     * E.g. "Eye Color Grey" with "+ 40%" -> 40
     */
    static parseBlessingPercent(response: any, category: string): number | undefined {
        const active = response?.active || [];
        if (!Array.isArray(active)) return undefined;

        const categoryKeywords: Record<string, string[]> = {
            eyeColor: ['eye color'],
            hairColor: ['hair color', 'hair colour'],
            position: ['favourite position', 'favorite position'],
            zodiac: ['zodiac', 'astrological', 'sign'],
        };

        const keywords = categoryKeywords[category];
        if (!keywords) return undefined;

        for (const blessing of active) {
            const desc = (blessing.description || '').toLowerCase();
            if (!desc.includes('bonus on all attributes') || desc.includes('labyrinth')) continue;

            if (keywords.some(kw => desc.includes(kw))) {
                const pctMatch = desc.match(/\+\s*(\d+)\s*%/);
                if (pctMatch) return Number(pctMatch[1]);
            }
        }
        return undefined;
    }

}
