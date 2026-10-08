import * as LogUtils from '../../src/Utils/LogUtils';
import { Champion } from '../../src/Module/Champion';
import { MockHelper } from '../testHelpers/MockHelpers';
import { setMenuPorts } from '../../src/Helper/menu/MenuPorts';
import { buildTestPorts } from '../Helper/menu/menuTestPorts';

// The champion team draft logs one line per draft. It has to carry what the
// seven per-girl lines carried before: the planned team, which girls were
// already selected, which get clicked and unselected, and the counters.
describe('Champion draft log line', () => {
    const girls = [
        { id_girl: '11', figure: 1, damage: 100000, selected: true },
        { id_girl: '12', figure: 2, damage: 100000, selected: true },
        { id_girl: '13', figure: 3, damage: 100000, selected: false },
        { id_girl: '14', figure: 4, damage: 100000, selected: false },
        { id_girl: '15', figure: 5, damage: 10, selected: false },     // below minPower
        { id_girl: '16', figure: 9, damage: 100000, selected: true },  // not in the team
    ];

    beforeEach(() => {
        jest.useFakeTimers();
        setMenuPorts(buildTestPorts({ getTextForUI: (id: string) => id, getHHScriptVars: () => '' }));
        MockHelper.mockDomain('www.hentaiheroes.com', 'champions/3');
        unsafeWindow.championData = {
            team: girls.map(({ id_girl, figure, damage }) => ({ id_girl, figure, damage })),
            freeDrafts: 1,
            hero_damage: 0,
            champion: { poses: [1, 2, 3, 4, 5] },
        };
        document.body.innerHTML = '<div class="champions-top__inner-wrapper"></div>'
            + '<div class="champions-middle__girl-selection champions-animation">'
            + girls.map(g => `<div class="girl-selection__girl-box"><div class="girl-box__draggable${g.selected ? ' selected' : ''}" id_girl="${g.id_girl}"></div></div>`).join('')
            + '</div>';
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        unsafeWindow.championData = undefined;
        document.body.innerHTML = '';
        localStorage.clear();
        sessionStorage.clear();
    });

    it('writes one line with every girl and her state', async () => {
        const log = jest.spyOn(LogUtils, 'logHHAuto');
        Champion.moduleSimChampions();
        $('#updateChampTeamButton').trigger('click');
        jest.advanceTimersByTime(2000);
        await Promise.resolve();

        const lines = log.mock.calls.map(c => String(c[0]));
        const draft = lines.filter(l => l.startsWith('Champion draft '));
        expect(draft).toHaveLength(1);
        expect(draft[0]).toMatch(/^Champion draft 1\/\d+ on \S+:/);
        expect(draft[0]).toContain('team=11,12,13,14,-1');
        expect(draft[0]).toContain('selected=11,12');
        expect(draft[0]).toContain('click=13,14');
        expect(draft[0]).toContain('unselect=16');
        expect(draft[0]).toContain('offered=6');
        expect(draft[0]).toContain('minPower=50000');
        expect(draft[0]).toContain('freeDrafts=1');
        expect(lines.some(l => /Girl (already|not) selected|Team of girls|Free drafts remanings|Unselected as out/.test(l))).toBe(false);
    });
});
