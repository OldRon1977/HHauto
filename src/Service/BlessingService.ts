// BlessingService.ts -- Loads and caches weekly blessing data.
//
// Blessings change weekly and affect girl stats. This service loads
// them via AJAX on the Home page and caches the result in localStorage.
// The team builder reads from cache to make blessing-aware decisions.
//
// Used by: AutoLoopPageHandlers.ts (Home page), TeamModule.ts (team build)
//
import { getStoredValue, setStoredValue, getStoredJSON } from '../Helper/index';
import { getHHAjax, logHHAuto } from '../Utils/index';
import { HHStoredVarPrefixKey, TK } from '../config/index';

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
            if (desc.includes('zodiac') || desc.includes('astrological')) traits.push('zodiac');
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
            } else if (condition.toLowerCase().startsWith('zodiac') || condition.toLowerCase().startsWith('astrological')) {
                values['zodiac'] = condition.replace(/(?:zodiac|astrological)\s*/i, '').trim().toLowerCase();
            } else if (condition.toLowerCase().startsWith('favourite position') || condition.toLowerCase().startsWith('favorite position')) {
                values['position'] = condition.replace(/favourit?e position\s*/i, '').trim().toLowerCase();
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
}
