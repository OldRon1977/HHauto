// Guards the wiring between the block markers (#1834) and the rest of the
// script: the marks are only worth anything while the switch names they name
// are the switches the panel actually renders and the storage layer knows.
//
// Nothing here re-tests blockState -- that is MenuBadge.spec. This asks the
// narrower question the pure unit test cannot: are these the right names?

import { HHStoredVarPrefixKey, HHStoredVars } from '../../../src/config/HHStoredVars';
import { SK } from '../../../src/config/StorageKeys';
import { setMenuPorts } from '../../../src/Helper/menu/MenuPorts';
import { buildTabbedBody } from '../../../src/Helper/menu/MenuTabs';
import { buildTestPorts } from './menuTestPorts';

describe('menu block definitions', () => {
    let root: HTMLElement;

    beforeEach(() => {
        (global as { GM?: unknown }).GM = { info: { script: { version: '0.0.0-test' } } };
        setMenuPorts(buildTestPorts());
        document.body.innerHTML = `<div id="sMenu">${buildTabbedBody(true)}</div>`;
        root = document.getElementById('sMenu') as HTMLElement;
    });

    const blocks = () => Array.from(root.querySelectorAll('.menuGroup[data-block]')) as HTMLElement[];
    const keysOf = (attr: string) => blocks().flatMap(el => {
        const raw = el.getAttribute(attr);
        return raw === null || raw === '' ? [] : raw.split(',');
    });
    const allKeys = () => [...keysOf('data-block'), ...keysOf('data-requires'), ...keysOf('data-options')];
    /** The registry entry behind a switch id; the ids are the setting names. */
    const entryFor = (key: string) =>
        HHStoredVars[HHStoredVarPrefixKey + (SK as Record<string, string>)[key]];

    it('has blocks to mark at all', () => {
        // A refactor that silently dropped every data-block would leave the
        // panel unmarked and every other test in here vacuously green.
        expect(blocks().length).toBeGreaterThan(25);
    });

    it('names only switches this panel renders', () => {
        const missing = allKeys().filter(key => {
            const el = document.getElementById(key) as HTMLInputElement | null;
            return el === null || el.type !== 'checkbox';
        });
        expect(missing).toEqual([]);
    });

    it('names each switch in at most one block', () => {
        // Two blocks claiming the same master would count one setting twice in
        // the area badge.
        const masters = keysOf('data-block');
        expect(masters).toEqual(Array.from(new Set(masters)));
    });

    it('gives every acting switch a heading to colour', () => {
        for (const el of blocks()) {
            expect(el.querySelector('.menuGroupTitle .menuBlockDot')).not.toBeNull();
        }
    });

    it('marks no group that has nothing to act with', () => {
        for (const el of blocks()) {
            expect(el.getAttribute('data-block')).not.toBe('');
        }
    });

    it('knows every named switch as a stored Boolean setting', () => {
        const unknown = allKeys().filter(key => {
            const entry = entryFor(key);
            return entry === undefined || entry.valueType !== 'Boolean';
        });
        expect(unknown).toEqual([]);
    });

    it('lists only switches that are off by default as steering options', () => {
        // "A steering option is on" is read as "the user set this up on
        // purpose". That inference only holds while the factory default is
        // off -- a default-on option would mark half the panel as configured.
        const wrong = keysOf('data-options').filter(key => entryFor(key)?.default !== 'false');
        expect(wrong).toEqual([]);
    });

    it('requires only switches that live in another block', () => {
        // A prerequisite is by definition somewhere else: if it were in this
        // block it would be one of its masters.
        for (const el of blocks()) {
            const raw = el.getAttribute('data-requires');
            if (raw === null) continue;
            const own = (el.getAttribute('data-block') ?? '').split(',');
            for (const key of raw.split(',')) expect(own).not.toContain(key);
        }
    });
});
