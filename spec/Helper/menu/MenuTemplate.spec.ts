import { setMenuPorts } from '../../../src/Helper/menu/MenuPorts';
import { getMenu } from '../../../src/Helper/menu/MenuTemplate';
import { buildMiddleColumn } from '../../../src/Helper/menu/MenuColumnMiddle';
import { buildTestPorts } from './menuTestPorts';

describe('MenuTemplate', () => {
    let storedValues: Record<string, string>;

    beforeEach(() => {
        // setup-jest.js provides `global.GM = {}`; give it the shape
        // MenuColumnLeft reads (GM.info.script.version).
        (global as { GM?: unknown }).GM = { info: { script: { version: '0.0.0-test' } } };
        storedValues = {};
        setMenuPorts(buildTestPorts({
            getTextForUI: (id: string, type: string) => `${id}:${type}`,
            getHHScriptVars: (id: string) => (id === 'baseImgPath' ? 'https://img.example' : ''),
            getStoredValue: (name: string) => storedValues[name] ?? null,
            storedVarPrefix: 'HHAuto_',
        }));
    });

    const parse = (html: string): HTMLElement => {
        const container = document.createElement('div');
        container.innerHTML = html;
        expect(container.children).toHaveLength(1);
        return container.firstElementChild as HTMLElement;
    };

    describe('getMenu', () => {
        it('produces parse-stable markup (no dangling elements)', () => {
            const menu = parse(getMenu());
            // Every input must have a unique id: duplicates would break get/setMenuValues.
            const ids = Array.from(menu.querySelectorAll('input, select')).map((el) => el.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('hides survey-hidden rows unless debug is enabled', () => {
            const hidden = parse(getMenu());
            expect(hidden.querySelector('#useX10Fights')!.closest('div[style*="display:none"]'))
                .not.toBeNull();

            storedValues['HHAuto_' + 'Temp_Debug'] = 'true'; // TK.Debug
            const debug = parse(getMenu());
            expect(debug.querySelector('#useX10Fights')!.closest('div[style*="display:none"]'))
                .toBeNull();
        });
    });

    describe('column builders', () => {
        it('buildMiddleColumn gates debug-only rows on its parameter', () => {
            const noDebug = parse(buildMiddleColumn(false));
            expect(noDebug.innerHTML).toContain('display:none');
            const withDebug = parse(buildMiddleColumn(true));
            const x10 = withDebug.querySelector('#useX10Fights')!.closest('div[style*="display:none"]');
            expect(x10).toBeNull();
            expect(withDebug.querySelector('#autoLeaguesSelector')).not.toBeNull();
        });
    });
});
