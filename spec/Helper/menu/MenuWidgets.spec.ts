import { setMenuPorts } from '../../../src/Helper/menu/MenuPorts';
import {
    hhMenuInput,
    hhMenuInputWithImg,
    hhMenuSwitch,
    hhMenuSwitchWithImg,
} from '../../../src/Helper/menu/MenuWidgets';
import { buildTestPorts } from './menuTestPorts';

/**
 * What is left here are the widget branches: the flags that change the
 * rendered markup and the two image-path rules.
 *
 * The plain markup assertions (hhButton, hhMenuSelect, the unflagged
 * switch and input) were removed in the spec triage (2026-08). They held a
 * template string against a copy of itself -- useful as a net during the
 * menu refactor, frozen since.
 */
describe('MenuWidgets', () => {
    beforeEach(() => {
        setMenuPorts(buildTestPorts({
            getTextForUI: (id: string, type: string) => `${id}:${type}`,
            getHHScriptVars: (id: string) => (id === 'baseImgPath' ? 'https://img.example' : ''),
        }));
    });

    const parse = (html: string): HTMLElement => {
        const container = document.createElement('div');
        container.innerHTML = html;
        expect(container.children).toHaveLength(1);
        return container.firstElementChild as HTMLElement;
    };

    describe('hhMenuSwitch', () => {
        it('supports enabling div id, koban and styling flags', () => {
            const el = parse(hhMenuSwitch('autoSeason', 'isEnabledSeason', true, true));
            expect(el.id).toBe('isEnabledSeason');
            const slider = el.querySelector('span.slider') as HTMLSpanElement;
            expect(slider.classList.contains('kobans')).toBe(true);
            expect(slider.classList.contains('styling')).toBe(true);
        });
    });

    describe('hhMenuSwitchWithImg', () => {
        it('prefixes the image with baseImgPath and renders the switch', () => {
            const el = parse(hhMenuSwitchWithImg('spendKobans0', 'design/menu/affil_prog.svg', true));
            const img = el.querySelector('img.iconImg') as HTMLImageElement;
            expect(img.getAttribute('src')).toBe('https://img.example/design/menu/affil_prog.svg');
            const input = el.querySelector('input') as HTMLInputElement;
            expect(input.id).toBe('spendKobans0');
            expect(el.querySelector('span.slider')!.classList.contains('kobans')).toBe(true);
        });
    });

    describe('hhMenuInput', () => {
        it('defaults inputMode to text', () => {
            const el = parse(hhMenuInput('x', '.*'));
            expect(el.querySelector('input')!.getAttribute('inputMode')).toBe('text');
        });
    });

    describe('hhMenuInputWithImg', () => {
        it('uses a root-absolute src for paths containing images/', () => {
            const el = parse(hhMenuInputWithImg('t', '.*', '', 'images/penta_drill/penta_drill.png'));
            expect(el.querySelector('img')!.getAttribute('src')).toBe('/images/penta_drill/penta_drill.png');
        });

        it('prefixes other paths with baseImgPath', () => {
            const el = parse(hhMenuInputWithImg('t', '.*', '', 'pictures/design/ic_kiss.png'));
            expect(el.querySelector('img')!.getAttribute('src')).toBe('https://img.example/pictures/design/ic_kiss.png');
        });
    });
});
