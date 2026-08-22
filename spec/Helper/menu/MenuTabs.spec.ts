import { setMenuPorts } from '../../../src/Helper/menu/MenuPorts';
import { bindMenuStateUpdates, buildTabbedBody, initMenuTabs, refreshMenuState } from '../../../src/Helper/menu/MenuTabs';
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

describe('refreshMenuState', () => {
    beforeEach(() => {
        (global as { GM?: unknown }).GM = { info: { script: { version: '0.0.0-test' } } };
        setMenuPorts(buildTestPorts());
        document.body.innerHTML = `<div id="sMenu">${buildTabbedBody(false)}</div>`;
    });

    const set = (id: string, on: boolean) => {
        (document.getElementById(id) as HTMLInputElement).checked = on;
    };
    const blockOf = (master: string) =>
        document.querySelector(`.menuGroup[data-block^="${master}"]`) as HTMLElement;
    const badgeOf = (area: string) =>
        document.querySelector(`[data-badge="${area}"]`) as HTMLElement;

    it('marks a block whose acting switch is on', () => {
        set('autoSalary', true);
        refreshMenuState();
        expect(blockOf('autoSalary').getAttribute('data-state')).toBe('on');
    });

    it('marks a block nobody switched on as off', () => {
        refreshMenuState();
        expect(blockOf('autoSalary').getAttribute('data-state')).toBe('off');
    });

    it('marks a block that is set up but cannot run as a conflict', () => {
        // +Event without the switch that starts the fighting.
        set('plusEvent', true);
        set('autoTrollBattle', false);
        refreshMenuState();
        expect(blockOf('plusEvent').getAttribute('data-state')).toBe('conflict');
    });

    it('leaves a group that cannot act unmarked', () => {
        refreshMenuState();
        const thresholds = document.querySelector('.menuPane[data-pane="leagues"] .menuGroup:last-child') as HTMLElement;
        expect(thresholds.hasAttribute('data-state')).toBe(false);
        expect(thresholds.querySelector('.menuBlockDot')).toBeNull();
    });

    it('counts the blocks of an area, not its switches', () => {
        // Two acting switches in one block still make that one block.
        set('autoPoVCollect', true);
        set('autoPoVCollectAll', true);
        set('autoSalary', true);
        refreshMenuState();
        expect(badgeOf('daily').textContent).toBe('2/9');
    });

    it('leaves a block this game does not have out of both numbers', () => {
        // maskInactiveMenus() hides the group but keeps its switches in the
        // DOM: counting them would put a block the player cannot see in the
        // denominator.
        (document.getElementById('isEnabledSalary') as HTMLElement).style.display = 'none';
        refreshMenuState();
        expect(badgeOf('daily').textContent).toBe('0/8');
        expect(blockOf('autoSalary').hasAttribute('data-state')).toBe(false);
    });

    it('colours the area by what is running', () => {
        set('autoSalary', true);
        refreshMenuState();
        expect(badgeOf('daily').getAttribute('data-state')).toBe('on');
    });

    it('shows a conflict on the rail even while the area runs', () => {
        set('autoTrollBattle', false);
        set('plusLoveRaid', true);
        refreshMenuState();
        expect(badgeOf('adventure').getAttribute('data-state')).toBe('conflict');
    });

    it('leaves the badge of a display-only area empty', () => {
        refreshMenuState();
        expect(badgeOf('harem').textContent).toBe('');
        expect(badgeOf('harem').getAttribute('data-state')).toBe('none');
    });

    it('follows a click before the value is stored', () => {
        refreshMenuState();
        bindMenuStateUpdates();
        (document.getElementById('autoSalary') as HTMLInputElement).click();
        expect(blockOf('autoSalary').getAttribute('data-state')).toBe('on');
        expect(badgeOf('daily').textContent).toBe('1/9');
    });

    it('fills the count on the area heading too, for the stacked layout', () => {
        // The stacked layout hides the rail; without this the count would be
        // invisible to exactly the users who asked for one long page.
        set('autoSalary', true);
        refreshMenuState();
        const onTitle = document.querySelector('.menuPane[data-pane="daily"] .menuPaneBadge') as HTMLElement;
        expect(onTitle.textContent).toBe('1/9');
        expect(onTitle.getAttribute('data-state')).toBe('on');
    });

    it('does nothing when the menu is not in the document', () => {
        document.body.innerHTML = '';
        expect(() => refreshMenuState()).not.toThrow();
    });
});
