import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The pInfo panel must not label a row with a menu switch's key.
 *
 * MenuTabs.ts gives every group a visible heading on purpose: 23 label texts
 * are reused across the menu, and the heading is what tells them apart. Since
 * 8.10.42 that goes further -- a switch that turns a block on reads "Enabled",
 * one that collects reads "Collect", and only the heading above it says which
 * area is meant.
 *
 * The pInfo panel has no headings. A row is a label and a time, nothing else.
 * Five rows pointed at switch keys and so read "Enabled" and "Collect" with
 * no area name anywhere (#1869, Cirkulis) -- Salary, Club champion, Missions,
 * Free Pachinko and the contest rewards. Three more pointed at switch keys
 * while still reading plausibly, which is the same defect one wording round
 * away from showing.
 *
 * Panel rows now carry their own keys. This test keeps the two vocabularies
 * apart by reading both files: it does not care what the labels say, only
 * that no key is shared.
 */
const SRC = join(__dirname, '..', '..', 'src');

function read(...parts: string[]): string {
    return readFileSync(join(SRC, ...parts), 'utf-8');
}

/** Keys MenuTabs passes to a widget -- the texts that follow the label rule. */
function menuSwitchKeys(): Set<string> {
    const src = read('Helper', 'menu', 'MenuTabs.ts');
    const widget = /(?:hhMenuSwitchWithImg|hhMenuSwitch|hhMenuInputWithImg|hhMenuInput|hhMenuSelect|switchWithInput)\(\s*'([A-Za-z0-9_]+)'/g;
    return new Set(Array.from(src.matchAll(widget), (m) => m[1]));
}

/** Keys InfoService uses as the left-hand text of a pInfo row. */
function panelLabelKeys(): Set<string> {
    const src = read('Service', 'InfoService.ts');
    const row = /pInfoRow\(\s*getTextForUI\(\s*"([A-Za-z0-9_]+)"/g;
    return new Set(Array.from(src.matchAll(row), (m) => m[1]));
}

describe('pInfo row labels', () => {
    it('shares no i18n key with a menu switch', () => {
        const switches = menuSwitchKeys();
        const shared = [...panelLabelKeys()].filter((key) => switches.has(key));
        expect(shared).toEqual([]);
    });

    it('still finds both vocabularies', () => {
        // Guards the regexes themselves: a rename in either file that made
        // them match nothing would turn the test above into a green no-op.
        expect(menuSwitchKeys().size).toBeGreaterThan(100);
        expect(panelLabelKeys().size).toBeGreaterThan(20);
    });
});
