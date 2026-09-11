import { QuestHelper } from '../../src/Module/Quest';
import { HHStoredVarPrefixKey } from '../../src/config/HHStoredVars';
import { SK, TK } from '../../src/config/StorageKeys';
import { MockHelper } from '../testHelpers/MockHelpers';
import * as PageHelper from '../../src/Helper/PageHelper';
import type { KKHero } from '../../src/model/KK/KKHero';
import { getStoredValue } from '../../src/Helper/StorageHelper';
import { checkTimer, getSecondsLeft, setTimers } from '../../src/Helper/TimerHelper';

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

/**
 * The skip button as the game builds it. Measured from quest.js on
 * 2026-09-09: it lives inside `#controls` beside the next button, the game
 * adds it only while the step reports `skippable` and removes it otherwise,
 * and its click handler reads `skip_cost.hard_currency` and opens
 * `hc_confirm`. It is a koban price, never a way forward.
 */
const SKIP_BUTTON = `
  <button id="skip-quest" class="blue_text_button">
    <div class="skip-quest-label">Skip Quest</div>
    <div class="energy-cost-container"><div class="hc-cost">30</div></div>
  </button>`;
const NEXT_BUTTON = `
  <button id="free" class="next-button green_text_button">Continue</button>`;
// The order inside #controls is the game's to choose, and both orders hurt in
// a different way, so both are covered below.
const SKIP_FIRST = `<div id="controls">${SKIP_BUTTON}${NEXT_BUTTON}</div>`;
const SKIP_SECOND = `<div id="controls">${NEXT_BUTTON}${SKIP_BUTTON}</div>`;

describe('QuestHelper.run: the skip button is not a way forward', function () {

    beforeEach(() => {
        // run() clicks the resume button from a setTimeout, so the clicking
        // tests below need a clock they can advance.
        jest.useFakeTimers();
        MockHelper.mockDomain('www.hentaiheroes.com', '/quest/205');
        unsafeWindow.shared!.Hero = {
            infos: {
                level: 9,
                questing: { id_world: 2, id_quest: 205, current_url: '/quest/205' },
            },
            currencies: { soft_currency: 1000, hard_currency: 750 },
        } as unknown as KKHero;
        localStorage.setItem(HHStoredVarPrefixKey + SK.autoQuest, 'true');
        jest.spyOn(PageHelper, 'getPage').mockReturnValue('quest');
        document.body.innerHTML = '';
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        document.body.innerHTML = '';
        localStorage.clear();
        sessionStorage.clear();
        jest.restoreAllMocks();
    });

    it('reads the real next button when the skip button comes first', function () {
        document.body.innerHTML = SKIP_FIRST;
        const proceeded = jest.fn();
        document.querySelector('#free')!.addEventListener('click', proceeded);

        QuestHelper.run();
        jest.advanceTimersByTime(5000);

        // attr("id") takes the first match: with the skip button in the set
        // the type reads "skip-quest", which lands in the unknown branch and
        // switches autoQuest off instead of proceeding.
        expect(sessionStorage.getItem(HHStoredVarPrefixKey + TK.questRequirement))
            .not.toBe('unknownQuestButton');
        expect(proceeded).toHaveBeenCalled();
    });

    it('does not press the skip button along with the next one', function () {
        // The click at the end of run() fires on the whole matched set, so a
        // skip button standing behind the next one used to be pressed too --
        // and its handler opens the koban confirmation over the quest.
        document.body.innerHTML = SKIP_SECOND;
        const skipped = jest.fn();
        const proceeded = jest.fn();
        document.querySelector('#skip-quest')!.addEventListener('click', skipped);
        document.querySelector('#free')!.addEventListener('click', proceeded);

        QuestHelper.run();
        jest.advanceTimersByTime(5000);

        expect(proceeded).toHaveBeenCalled();
        expect(skipped).not.toHaveBeenCalled();
    });

    it('still finds the next button when no skip button is offered', function () {
        document.body.innerHTML = `
          <div id="controls">
            <button id="free" class="next-button green_text_button">Continue</button>
          </div>`;
        const proceeded = jest.fn();
        document.querySelector('#free')!.addEventListener('click', proceeded);

        QuestHelper.run();
        jest.advanceTimersByTime(5000);

        expect(proceeded).toHaveBeenCalled();
    });
});

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

// The popup and the pay step as the game builds them, measured on a live quest
// page on 2026-09-11. The popup came from calling
// shared.general.notEnoughSoftCurrency(5928), which is what quest.js calls when
// the balance falls short of the step's cost. #controls is the pay step of the
// same quest, reduced to the button the script reads.
const NO_MONEY_POPUP = `
<div id="common-popups" class="fixed_scaled"><div class="popup_wrapper">
<div id="not_enough_SC_popup" class="popup"> <div rel="money">You lack <span rel="money">5,928</span><span class="soft_currency_icn"></span> to complete this action! <br><br>You can collect from the harem, do missions, battles and contests - the city is ripe with opportunity. <br> <a href="/harem.html" class="orange_text_button">Harem</a> </div> <close class="closable"></close></div>
</div></div>`;
const PAY_STEP = `
<div id="controls" type="quest" class="transitioned"><button id="pay" class="next-button green_text_button big-intro-button-angel"><div class="action-label">Use</div><div class="action-cost"><span class="soft_currency_icn"></span><span class="price">12.0K</span></div></button></div>`;

describe('QuestHelper.run: the game refuses a step for money', function () {

    beforeEach(() => {
        jest.useFakeTimers();
        MockHelper.mockDomain('www.hentaiheroes.com', '/quest/205');
        unsafeWindow.shared!.Hero = {
            infos: {
                level: 9,
                questing: { id_world: 2, id_quest: 205, current_url: '/quest/205' },
            },
            // Enough on paper -- which is how the click got through in the
            // reported case, and why the popup must not be read as "retry".
            currencies: { soft_currency: 51926, hard_currency: 750 },
        } as unknown as KKHero;
        localStorage.setItem(HHStoredVarPrefixKey + SK.autoQuest, 'true');
        jest.spyOn(PageHelper, 'getPage').mockReturnValue('quest');
        setTimers({});
        document.body.innerHTML = '';
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        document.body.innerHTML = '';
        localStorage.clear();
        sessionStorage.clear();
        setTimers({});
        jest.restoreAllMocks();
    });

    it('closes the popup through its close control', function () {
        document.body.innerHTML = PAY_STEP + NO_MONEY_POPUP;
        const clicked = jest.fn();
        document.querySelector('#not_enough_SC_popup close')!.addEventListener('click', clicked);

        QuestHelper.run();

        expect(clicked).toHaveBeenCalled();
    });

    it('waits for the whole step cost, read from the pay button', function () {
        document.body.innerHTML = PAY_STEP + NO_MONEY_POPUP;

        QuestHelper.run();

        expect(getStoredValue(HHStoredVarPrefixKey + TK.questRequirement)).toBe('$12000');
    });

    it('does not try again for 20 minutes', function () {
        document.body.innerHTML = PAY_STEP + NO_MONEY_POPUP;

        QuestHelper.run();

        expect(QuestHelper.NO_MONEY_BACKOFF_SECS).toBe(1200);
        expect(checkTimer(QuestHelper.NO_MONEY_TIMER)).toBe(false);
        expect(getSecondsLeft(QuestHelper.NO_MONEY_TIMER)).toBeGreaterThan(1190);
        expect(getSecondsLeft(QuestHelper.NO_MONEY_TIMER)).toBeLessThanOrEqual(1200);
    });

    it('returns not-busy and presses nothing, so the pipeline can take the bot home', function () {
        document.body.innerHTML = PAY_STEP + NO_MONEY_POPUP;
        const pressed = jest.fn();
        document.querySelector('#controls button#pay')!.addEventListener('click', pressed);

        const busy = QuestHelper.run();
        jest.runOnlyPendingTimers();

        expect(busy).toBe(false);
        expect(pressed).not.toHaveBeenCalled();
    });

    it('without a readable pay button it waits for the balance plus the shortfall', function () {
        document.body.innerHTML = NO_MONEY_POPUP;

        QuestHelper.run();

        expect(getStoredValue(HHStoredVarPrefixKey + TK.questRequirement)).toBe('$' + (51926 + 5928));
    });

    it('leaves a pay step without the popup to the normal money check', function () {
        document.body.innerHTML = PAY_STEP;
        const pressed = jest.fn();
        document.querySelector('#controls button#pay')!.addEventListener('click', pressed);

        QuestHelper.run();
        jest.runOnlyPendingTimers();

        expect(pressed).toHaveBeenCalled();
        expect(checkTimer(QuestHelper.NO_MONEY_TIMER)).toBe(true);
    });
});
