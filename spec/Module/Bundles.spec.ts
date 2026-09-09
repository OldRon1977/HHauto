import { Bundles } from '../../src/Module/Bundles';
import { ConfigHelper } from '../../src/Helper/ConfigHelper';
import { MockHelper } from '../testHelpers/MockHelpers';
import * as PageHelper from '../../src/Helper/PageHelper';
import { HHStoredVarPrefixKey } from '../../src/config/HHStoredVars';
import { SK } from '../../src/config/StorageKeys';

// Keep the collector's tail out of the test: the finish path schedules
// autoLoop, which would pull the whole pipeline into a selector test.
jest.mock('../../src/Service/AutoLoop', () => ({ autoLoop: jest.fn() }));

/**
 * The shop popup as measured on a live account, 2026-09-09.
 *
 * Two things the collector got wrong show up here:
 *
 *  - The tab bar carries nine tabs. `Step-Up Offers` (`.stepup_offers`)
 *    is one of them and its ladder's first rung is a claimable free
 *    reward; the old tab list did not name the class, so the tab was
 *    never clicked.
 *  - Under that tab the free button is `purple_button_L`, not
 *    `blue_button_L` as under special_offers and period_deal. Both
 *    carry `free-buy-button-shop`.
 *
 * jsdom does not swap `.content-container`s when a tab is clicked, so
 * every tab's content sits in the DOM at once. That is fine for what
 * these tests check -- which buttons the queries reach.
 */
const STEPUP_TAB = `
  <div class="stepup_offers switch-tab" type="stepup_offers"></div>`;
const SPECIAL_TAB = `
  <div class="special_offers switch-tab" type="special_offers"></div>`;

const STEPUP_CONTENT = `
  <div class="content-container stepup_offers">
    <div class="bundle-container hh-scroll"><div class="bundle">
      <div class="stepup-wrapper"><div class="stepup-container"><div class="stepup-row">
        <div class="bundle-offer-container default-bg"><div class="bundle-offer-price">
          <button id="free-reward" class="free-buy-button-shop purple_button_L claim-first-purchase-gift"
                  price="0.00" product="70678">Claim</button>
        </div></div>
        <div class="bundle-offer-container default-bg"><div class="bundle-offer-price">
          <button id="free-reward" class="free-buy-button-shop purple_button_L claim-first-purchase-gift"
                  price="0.00" product="70723" disabled>Claim</button>
        </div></div>
        <div class="bundle-offer-container default-bg"><div class="bundle-offer-price">
          <button class="paid-buy-button-shop orange_button_L" price="9.99" product="70693">9.99 &euro;</button>
        </div></div>
      </div></div></div>
    </div></div>
  </div>`;

const SPECIAL_CONTENT = `
  <div class="content-container special_offers">
    <div class="bundle-container hh-scroll"><div class="bundle">
      <div class="bundle-offer-container single-row"><div class="bundle-offer-price">
        <button class="free-buy-button-shop blue_button_L" price="0.00" product="71788">Claim Reward</button>
      </div></div>
    </div></div>
  </div>`;

function shopPopup(tabs: string, content: string): string {
    return `
      <header><div class="currency"><div class="reversed_tooltip">+</div></div></header>
      <div id="common-popups"><div class="payments-wrapper">
        <div class="payment-tabs">
          <div class="starter_offers switch-tab" type="starter_offers"></div>
          ${tabs}
          <div class="period_deal switch-tab" type="period_deal"></div>
          <div class="monthly_card switch-tab" type="monthly_card"></div>
        </div>
        ${content}
      </div><div class="close_cross"></div></div>`;
}

describe('Bundles.goAndCollectFreeBundles: which free claims it reaches', function () {

    beforeEach(() => {
        jest.useFakeTimers();
        MockHelper.mockDomain('www.hentaiheroes.com', '/home.html');
        jest.spyOn(PageHelper, 'getPage')
            .mockReturnValue(ConfigHelper.getHHScriptVars('pagesIDHome'));
        localStorage.setItem(HHStoredVarPrefixKey + SK.autoFreeBundlesCollect, 'true');
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

    it('claims the step-up rung, whose button is purple and not blue', function () {
        document.body.innerHTML = shopPopup(STEPUP_TAB, STEPUP_CONTENT);
        const claimed = jest.fn();
        document.querySelector<HTMLButtonElement>('button[product="70678"]')!
            .addEventListener('click', claimed);

        Bundles.goAndCollectFreeBundles();
        jest.advanceTimersByTime(2000);

        expect(claimed).toHaveBeenCalled();
    });

    it('the old colour-keyed query would have found nothing there', function () {
        document.body.innerHTML = shopPopup(STEPUP_TAB, STEPUP_CONTENT);
        const container = '#common-popups .payments-wrapper .bundle .bundle-offer-price ';

        expect($(container + ".blue_button_L:enabled[price='0.00']").length).toBe(0);
        expect($(container + ".free-buy-button-shop:enabled[price='0.00']").length).toBe(1);
    });

    it('clicks the step-up tab, which the old tab list did not name', function () {
        // No free claim anywhere, so the tab walk runs to the end instead of
        // stopping at the first tab that yields one. In jsdom every tab's
        // content sits in the DOM at once, so a fixture with a claim would
        // break the loop before the step-up tab is reached -- in the browser
        // the game swaps `.content-container` per tab and that does not happen.
        document.body.innerHTML = shopPopup(STEPUP_TAB, '');
        const opened = jest.fn();
        document.querySelector('.payment-tabs .stepup_offers')!
            .addEventListener('click', opened);

        Bundles.goAndCollectFreeBundles();
        jest.advanceTimersByTime(2000);

        expect(opened).toHaveBeenCalled();
    });

    it('leaves the already-claimed rung and the paid button alone', function () {
        document.body.innerHTML = shopPopup(STEPUP_TAB, STEPUP_CONTENT);
        const disabled = jest.fn();
        const paid = jest.fn();
        document.querySelector('button[product="70723"]')!.addEventListener('click', disabled);
        document.querySelector('button[product="70693"]')!.addEventListener('click', paid);

        Bundles.goAndCollectFreeBundles();
        jest.advanceTimersByTime(2000);

        expect(disabled).not.toHaveBeenCalled();
        expect(paid).not.toHaveBeenCalled();
    });

    it('still reaches the blue free claim under special offers', function () {
        document.body.innerHTML = shopPopup(SPECIAL_TAB, SPECIAL_CONTENT);
        const claimed = jest.fn();
        document.querySelector('button[product="71788"]')!.addEventListener('click', claimed);

        Bundles.goAndCollectFreeBundles();
        jest.advanceTimersByTime(2000);

        expect(claimed).toHaveBeenCalled();
    });
});
