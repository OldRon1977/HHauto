// TraitMappings.ts -- Maps internal hex / image / unicode codes to
// human-readable trait names.
//
// The game stores girl traits as compact codes:
//   - eye_color1 / hair_color1: 3-character hex like "00F", "888", "F90"
//   - position_img: numbered image like "1.png" .. "12.png"
//   - zodiac: unicode glyph + name like "GLYPH Aries"
//
// At runtime, the game UI translates these via window.GT.design.colors
// and window.GT.design.figures. We try the runtime lookup first
// (covers patches that add new colors) and fall back to hardcoded
// English values from Tom-208's userscript reference.
//
// Used by: TeamModule UI box (cluster name, blessing match indicator)

// Hardcoded English fallback. Mirrors the Tom-208 userscript (gist
// a5c7065866fe1de5032aabbbd1ed9eff) which itself is reverse-engineered
// from window.GT.design.colors.
const COLOR_FALLBACK_EN: Record<string, string> = {
    'F99': 'Pink',
    'B06': 'Dark Pink',
    'F00': 'Red',
    'B62': 'Dark blond',
    'FFF': 'White',
    '321': 'Dark',
    '00F': 'Blue',
    'FF0': 'Blond',
    '0F0': 'Green',
    'XXX': 'Unknown',
    'A55': 'Brown',
    '000': 'Black',
    'CCC': 'Silver',
    'F0F': 'Purple',
    'F90': 'Orange',
    'EB8': 'Strawberry blonde',
    '888': 'Grey',
    'FD0': 'Golden',
    'D83': 'Bronze',
    '765': 'Ash brown',
};

// Position images don't have human-readable names server-side.
// The game presents them via window.GT.design.figures[1..12], which
// returns localized labels (e.g. "Doggy", "69", "Cowgirl"). When the
// runtime lookup fails we keep the bare number which is always accurate.
const POSITION_FALLBACK_PREFIX = 'Pose ';

export interface TraitMappingResult {
    /** The display name of the trait value. */
    label: string;
    /** True when label came from window.GT, false when fallback was used. */
    fromRuntime: boolean;
}

export class TraitMappings {

    /**
     * Look up the runtime color map from window.GT.design.colors.
     * Returns null if the structure is not available (e.g. spec tests).
     */
    private static getRuntimeColorMap(): Record<string, string> | null {
        try {
            const w: any = typeof unsafeWindow !== 'undefined' ? unsafeWindow : (typeof window !== 'undefined' ? window : null);
            if (!w) return null;
            const map = w.GT?.design?.colors;
            return (map && typeof map === 'object') ? map : null;
        } catch {
            return null;
        }
    }

    /**
     * Look up the runtime figure map from window.GT.design.figures.
     */
    private static getRuntimeFigureMap(): Record<string, string> | null {
        try {
            const w: any = typeof unsafeWindow !== 'undefined' ? unsafeWindow : (typeof window !== 'undefined' ? window : null);
            if (!w) return null;
            const map = w.GT?.design?.figures;
            return (map && typeof map === 'object') ? map : null;
        } catch {
            return null;
        }
    }

    /**
     * Resolve a hex color code (eye or hair) to its readable name.
     * Tries window.GT.design.colors first, falls back to English.
     */
    static resolveColor(hex: string | undefined | null): TraitMappingResult {
        if (!hex) return { label: '?', fromRuntime: false };
        const upper = String(hex).toUpperCase();
        const runtime = TraitMappings.getRuntimeColorMap();
        if (runtime && typeof runtime[upper] === 'string') {
            return { label: runtime[upper], fromRuntime: true };
        }
        if (COLOR_FALLBACK_EN[upper]) {
            return { label: COLOR_FALLBACK_EN[upper], fromRuntime: false };
        }
        return { label: '#' + upper, fromRuntime: false };
    }

    /**
     * Resolve a position image (e.g. "2.png" or "2") to a readable label.
     * Falls back to "Pose N" when runtime map is unavailable.
     */
    static resolvePosition(value: string | undefined | null): TraitMappingResult {
        if (!value) return { label: '?', fromRuntime: false };
        const num = String(value).replace(/\.png$/i, '').trim();
        const runtime = TraitMappings.getRuntimeFigureMap();
        if (runtime && typeof runtime[num] === 'string') {
            return { label: runtime[num], fromRuntime: true };
        }
        return { label: POSITION_FALLBACK_PREFIX + num, fromRuntime: false };
    }

    /**
     * Resolve a zodiac string (e.g. unicode-glyph + " Aries") to a readable name.
     * Strips the unicode glyph prefix and returns just the English name.
     */
    static resolveZodiac(value: string | undefined | null): TraitMappingResult {
        if (!value) return { label: '?', fromRuntime: false };
        // Strip leading non-letter characters (glyph + variation selector + space)
        const cleaned = String(value).replace(/^[^A-Za-z]+/, '').trim();
        return { label: cleaned || String(value), fromRuntime: false };
    }

    /**
     * Generic resolver: dispatch by trait category.
     */
    static resolve(category: 'eyeColor' | 'hairColor' | 'zodiac' | 'position', value: string | undefined | null): TraitMappingResult {
        switch (category) {
            case 'eyeColor':
            case 'hairColor':
                return TraitMappings.resolveColor(value);
            case 'zodiac':
                return TraitMappings.resolveZodiac(value);
            case 'position':
                return TraitMappings.resolvePosition(value);
        }
    }
}