import { setMenuPorts } from '../../../src/Helper/menu/MenuPorts';
import { buildTabbedBody, initMenuTabs } from '../../../src/Helper/menu/MenuTabs';
import { buildTestPorts } from './menuTestPorts';

const TAB_KEY = 'HHAuto_Temp_menuTab';

describe('initMenuTabs', () => {
    let stored: Record<string, string>;

    beforeEach(() => {
        (global as { GM?: unknown }).GM = { info: { script: { version: '0.0.0-test' } } };
        stored = {};
        setMenuPorts(buildTestPorts({
            getStoredValue: (name: string) => stored[name] ?? null,
            setStoredValue: (name: string, value: unknown) => { stored[name] = String(value); },
            storedVarPrefix: 'HHAuto_',
        }));
        document.body.innerHTML = `<div id="sMenu">${buildTabbedBody(false)}</div>`;
    });

    const activeTab = () =>
        (document.querySelector('.menuTab.active') as HTMLElement | null)?.dataset.tab ?? null;
    const activePane = () =>
        (document.querySelector('.menuPane.active') as HTMLElement | null)?.dataset.pane ?? null;
    const tabEl = (id: string) =>
        document.querySelector(`.menuTab[data-tab="${id}"]`) as HTMLElement;

    /** What maskInactiveMenus() does: hide the groups of a feature this game lacks. */
    const maskPane = (paneId: string) => {
        for (const g of Array.from(document.querySelectorAll(`.menuPane[data-pane="${paneId}"] .menuGroup`))) {
            (g as HTMLElement).style.display = 'none';
        }
    };

    it('opens the first area when nothing was remembered', () => {
        initMenuTabs();
        expect(activeTab()).toBe('global');
        expect(activePane()).toBe('global');
    });

    it('reopens the area that was open before', () => {
        stored[TAB_KEY] = 'leagues';
        initMenuTabs();
        expect(activeTab()).toBe('leagues');
        expect(activePane()).toBe('leagues');
    });

    it('remembers the area when one is clicked', () => {
        initMenuTabs();
        tabEl('shop').click();
        expect(stored[TAB_KEY]).toBe('shop');
        expect(activePane()).toBe('shop');
    });

    it('shows exactly one pane at a time', () => {
        initMenuTabs();
        tabEl('season').click();
        expect(document.querySelectorAll('.menuPane.active')).toHaveLength(1);
        expect(document.querySelectorAll('.menuTab.active')).toHaveLength(1);
    });

    it('drops the tab of an area this game does not offer', () => {
        maskPane('labyrinth');
        initMenuTabs();
        expect(tabEl('labyrinth').style.display).toBe('none');
        expect(tabEl('season').style.display).not.toBe('none');
    });

    it('falls back to a visible area when the remembered one is gone', () => {
        stored[TAB_KEY] = 'labyrinth';
        maskPane('labyrinth');
        initMenuTabs();
        expect(activeTab()).toBe('global');
    });

    it('does nothing when the menu is not in the document', () => {
        document.body.innerHTML = '';
        expect(() => initMenuTabs()).not.toThrow();
    });
});
