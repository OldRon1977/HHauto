import { HHAuto_ToolTips } from '../../src/i18n/empty';
import '../../src/i18n/en';
import '../../src/i18n/de';
import '../../src/i18n/fr';
import '../../src/i18n/es';

/**
 * getTextForUI falls back to English when a translation's `version` is older
 * than the English one -- the field means "this translation matches the
 * English text of version X". The trap: changing an English label without
 * touching the three translations silently reverts them to English, and
 * nothing in the menu, the tests or the type system says so.
 *
 * That is what happened in 8.10.42. The label round bumped eighteen English
 * entries to the new "Enabled"/"Collect" wording; the translations were
 * rewritten in the same round but kept their old version numbers, so all
 * three languages showed English for those eighteen settings. It took a
 * user's screenshots to notice (#1834, bjaume).
 *
 * The three menu languages are complete, so this is a hard rule now: a
 * translation may be newer than the English text, never older.
 */
const LANGS = ['de', 'fr', 'es'] as const;

const toParts = (v: string): number[] => (v ?? '0').split('.').map((p) => Number(p) || 0);

function isOlder(a: string, b: string): boolean {
    const [x, y] = [toParts(a), toParts(b)];
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const d = (x[i] ?? 0) - (y[i] ?? 0);
        if (d !== 0) return d < 0;
    }
    return false;
}

describe('i18n versions', () => {
    it.each(LANGS)('%s has no entry older than its English original', (lang) => {
        const en = HHAuto_ToolTips.en;
        const loc = HHAuto_ToolTips[lang];
        const stale = Object.keys(en)
            .filter((key) => loc[key] !== undefined && isOlder(loc[key].version, en[key].version))
            .map((key) => `${key} (${lang}=${loc[key].version} < en=${en[key].version})`);
        // Each of these would show its English text in a menu set to this language.
        expect(stale).toEqual([]);
    });

    it('compares version numbers, not strings', () => {
        // "8.10.42" vs "8.9.0" is the case a string comparison gets wrong.
        expect(isOlder('8.9.0', '8.10.42')).toBe(true);
        expect(isOlder('8.10.42', '8.9.0')).toBe(false);
        expect(isOlder('8.10.42', '8.10.42')).toBe(false);
    });
});
