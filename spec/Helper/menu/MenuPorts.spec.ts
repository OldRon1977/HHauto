import { MenuPorts, setMenuPorts } from '../../../src/Helper/menu/MenuPorts';
import { buildTestPorts } from './menuTestPorts';

describe('MenuPorts', () => {
    it('throws a descriptive error when a port is used before wiring', () => {
        // Use an isolated module registry so the singleton is in its pristine,
        // un-wired state regardless of what other tests in this file did.
        jest.isolateModules(() => {
            const fresh = require('../../../src/Helper/menu/MenuPorts');
            expect(() => fresh.MenuPorts.getTextForUI('a', 'b'))
                .toThrow(/getTextForUI used before setMenuPorts/);
            expect(() => fresh.MenuPorts.getHHScriptVars('a'))
                .toThrow(/getHHScriptVars used before setMenuPorts/);
            expect(() => fresh.MenuPorts.logHHAuto('x'))
                .toThrow(/logHHAuto used before setMenuPorts/);
        });
    });

    it('setMenuPorts replaces the guard implementations', () => {
        setMenuPorts(buildTestPorts({ storedVarPrefix: 'Pfx_' }));
        expect(MenuPorts.getTextForUI('master', 'elementText')).toBe('master:elementText');
        expect(MenuPorts.getHHScriptVars('baseImgPath')).toBe('[baseImgPath]');
        expect(MenuPorts.storedVarPrefix).toBe('Pfx_');
    });
});
