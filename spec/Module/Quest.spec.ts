import { QuestHelper } from '../../src/Module/Quest';
import { HHStoredVarPrefixKey } from '../../src/config/HHStoredVars';
import { SK } from '../../src/config/StorageKeys';
import { MockHelper } from '../testHelpers/MockHelpers';
import * as PageHelper from '../../src/Helper/PageHelper';
import type { KKHero } from '../../src/model/KK/KKHero';

// The level-up popup measured on a live account, 2026-09-09. It carries no
// `close` element -- hidden ones included -- so the selector the script used
// matched nothing and the popup stayed up. Its only control is the Ok button.
const LEVEL_UP_POPUP = `
<div id="level_up" class="popup hero_leveling">
  <div class="flex-container">
    <div id="reward_holder" class="rewards">
      <div class="text-container">
        <div class="congratulation">Congratulations!</div>
        <div class="reached">You've reached</div>
        <div class="level">Level 9</div>
      </div>
    </div>
    <button class="blue_button_L">Ok</button>
  </div>
</div>`;

describe('QuestHelper.run: popups that block the quest', function () {

    beforeEach(() => {
        // The second argument is the page path. run() leaves early unless the
        // browser is already on the quest the hero is currently at.
        // Leading slash on purpose: mockDomain only prepends one when the
        // argument contains no slash at all, and run() compares the path
        // against "/quest/<id_quest>".
        MockHelper.mockDomain('www.hentaiheroes.com', '/quest/205');
        unsafeWindow.shared!.Hero = {
            infos: {
                level: 9,
                // id_quest matters: getMainQuestUrl builds "/quest/<id_quest>"
                // and run() compares that against the browser path.
                questing: { id_world: 2, id_quest: 205, current_url: '/quest/205' },
            },
            currencies: { soft_currency: 1000, hard_currency: 750 },
        } as unknown as KKHero;
        localStorage.setItem(HHStoredVarPrefixKey + SK.autoQuest, 'true');
        jest.spyOn(PageHelper, 'getPage').mockReturnValue('quest');
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
        sessionStorage.clear();
        jest.restoreAllMocks();
    });

    it('confirms the level-up popup with its Ok button', function () {
        document.body.innerHTML = LEVEL_UP_POPUP;
        const ok = document.querySelector('#level_up button.blue_button_L') as HTMLButtonElement;
        const clicked = jest.fn();
        ok.addEventListener('click', clicked);

        QuestHelper.run();

        expect(clicked).toHaveBeenCalled();
    });

    it('the popup really has no close element to click instead', function () {
        document.body.innerHTML = LEVEL_UP_POPUP;

        expect(document.querySelectorAll('#level_up close').length).toBe(0);
        expect(document.querySelectorAll('#level_up button').length).toBe(1);
    });

    it('does not throw when no level-up popup is on the page', function () {
        document.body.innerHTML = '<div id="controls"></div>';

        expect(() => QuestHelper.run()).not.toThrow();
    });
});
