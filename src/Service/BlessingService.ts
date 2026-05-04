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
        const data = response.blessings || response.girls_blessings || response.data || response;
        if (typeof data !== 'object') return traits;
        const responseStr = JSON.stringify(data).toLowerCase();

        if (responseStr.includes('eye') || responseStr.includes('yeux')) traits.push('eyeColor');
        if (responseStr.includes('hair') || responseStr.includes('cheveu')) traits.push('hairColor');
        if (responseStr.includes('zodiac') || responseStr.includes('sign') || responseStr.includes('astro')) traits.push('zodiac');
        if (responseStr.includes('position') || responseStr.includes('pose') || responseStr.includes('favourite_position')) traits.push('position');

        return traits;
    }

    private static parseElement(response: any): string | undefined {
        const data = response.blessings || response.girls_blessings || response.data || response;
        const responseStr = JSON.stringify(data).toLowerCase();

        const elementMap: Record<string, string> = {
            'eccentric': 'fire', 'sensual': 'water', 'exhibitionist': 'nature',
            'physical': 'stone', 'playful': 'sun', 'dominatrix': 'darkness',
            'submissive': 'psychic', 'voyeur': 'light',
        };

        for (const [className, element] of Object.entries(elementMap)) {
            if (responseStr.includes(className)) return element;
        }
        return undefined;
    }
}
