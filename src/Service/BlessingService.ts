// BlessingService.ts -- Loads and caches weekly blessing data.
//
// Blessings change weekly and affect girl stats. This service loads
// them via AJAX on the Home page and caches the result in localStorage.
// The team builder reads from cache to make blessing-aware decisions.
//
// Used by: AutoLoopPageHandlers.ts (Home page), TeamModule.ts (team build)
//
import { getStoredValue, setStoredValue, getStoredJSON } from "../Helper/StorageHelper";
import { logHHAuto } from "../Utils/LogUtils";
import { getHHAjax } from "../Utils/Utils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { TK } from "../config/StorageKeys";

const CACHE_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

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
     * Authoritative per-girl blessing multiplier from the game's
     * blessing_bonuses field. This is the single source of truth for
     * 'is this girl currently blessed and by how much'.
     *
     * The game writes the active per-class blessing percentages into
     * blessing_bonuses.pvp_v3 (current league) and pvp_v4 (next league
     * version). Each is shaped { caracN: number[] }; the list contains
     * one entry per active blessing affecting the girl, applied
     * multiplicatively. Examples:
     *   pvp_v3.carac1 = []         -> no blessing -> multiplier 1.0
     *   pvp_v3.carac1 = [25]       -> +25%        -> multiplier 1.25
     *   pvp_v3.carac1 = [40, 25]   -> +40% AND +25% -> multiplier 1.75
     *
     * The girl's caracs sub-object already contains the multiplied stat,
     * so the team builder does not need to multiply again. This helper
     * is for diagnostics: 'is girl X blessed?' and 'how much'.
     *
     * Falls back from pvp_v4 to pvp_v3 (forwards-compatible with a future
     * league version cutover).
     */
    static getEffectiveMultiplier(girl: { blessing_bonuses?: any; blessingBonuses?: any }): number {
        const bb = (girl as any).blessing_bonuses ?? girl.blessingBonuses;
        if (!bb || typeof bb !== 'object' || Array.isArray(bb)) return 1;
        const v = bb.pvp_v4 ?? bb.pvp_v3;
        if (!v || typeof v !== 'object') return 1;
        const pcs = v.carac1;
        if (!Array.isArray(pcs) || pcs.length === 0) return 1;
        let mult = 1;
        for (const p of pcs) {
            const n = Number(p);
            if (Number.isFinite(n) && n > 0) {
                mult *= 1 + n / 100;
            }
        }
        return mult;
    }

    /**
     * List the blessing percentages currently active on this girl, in
     * the order the game returned them. Useful for UI annotations like
     * '(+25% blessing)' or '(+40%, +25% blessing)'.
     */
    static getActivePercents(girl: { blessing_bonuses?: any; blessingBonuses?: any }): number[] {
        const bb = (girl as any).blessing_bonuses ?? girl.blessingBonuses;
        if (!bb || typeof bb !== 'object' || Array.isArray(bb)) return [];
        const v = bb.pvp_v4 ?? bb.pvp_v3;
        if (!v || typeof v !== 'object') return [];
        const pcs = v.carac1;
        if (!Array.isArray(pcs)) return [];
        return pcs.filter((p: any) => Number.isFinite(Number(p)) && Number(p) > 0).map((p: any) => Number(p));
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

            // Check if one value dominates (>90% of the group)
            for (const [val, count] of valueCounts) {
                if (count / group.length >= 0.9) {
                    logHHAuto('BlessingService: resolved ' + blessedCategory + ' -> hex="' + val + '" (' + count + '/' + group.length + ' girls)');
                    return val;
                }
            }
        }

        return undefined;
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
