// Bundles.ts -- Collects free daily and periodic bundles from the shop popup.
//
// The game periodically offers free bundle rewards in a popup. This module
// detects available bundles, navigates to the shop page, and claims them
// automatically on a timer-based schedule.
//
// Used by: Service/index.ts (main automation loop)
//
import { ConfigHelper } from "../Helper/ConfigHelper";
import { getPage } from "../Helper/PageHelper";
import { RewardHelper } from "../Helper/RewardHelper";
import { getStoredValue, setStoredValue } from "../Helper/StorageHelper";
import { TimeHelper, randomInterval, convertTimeToInt } from "../Helper/TimeHelper";
import { setTimer } from "../Helper/TimerHelper";
import { autoLoop } from "../Service/AutoLoop";
import { gotoPage } from "../Service/PageNavigationService";
import { logHHAuto } from "../Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK, TK } from "../config/StorageKeys";
import { classifyExpiryTime, decideExpiryTime, extractTimerText, minScrapedSeconds } from './Bundles.pure';

export class Bundles {
    static getExpiryTime(){
        // `.period_deal` names a *tab* in the payment-tabs bar, not an
        // ancestor of the timer -- the timer lives under whichever
        // `.content-container` is currently shown for the active tab
        // (mirrors the `:visible` pattern Labyrinth.getResetTime uses
        // for its own reset timer).
        const timerRequest = `#popup-payment-container .content-container:visible .shop-timer span[rel=expires]`

        let scrapedSeconds: number | null = null;
        const timerNodes = $(timerRequest);
        if (timerNodes.length > 0) {
            // The visible tab can show several bundle tiles at once
            // (each with its own countdown), so reduce every scraped
            // value to the soonest one.
            const scrapedValues = timerNodes.map((_i, el) => Number(convertTimeToInt(extractTimerText($(el).text())))).get();
            scrapedSeconds = minScrapedSeconds(scrapedValues);
            logHHAuto('freeBundleTimer', scrapedSeconds);
        }
        const fallbackSeconds = ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60, 180);
        const decision = decideExpiryTime({ scrapedSeconds, fallbackSeconds });
        switch (classifyExpiryTime(scrapedSeconds)) {
            case 'missing':
                logHHAuto('ERROR: can\'t get bundle expiry time, default to maxCollectionDelay');
                break;
            case 'capped':
                // Not an error: a real bundle timer was read, it's just
                // a long-running one (>= 24h). Cap to maxCollectionDelay
                // so the next check doesn't wait out the full duration.
                logHHAuto('Bundle timer ' + scrapedSeconds + 's is >= 24h, capping to maxCollectionDelay.');
                break;
        }
        return decision;
    }
    static goAndCollectFreeBundles()
    {
        if (getPage() === ConfigHelper.getHHScriptVars("pagesIDHome"))
        {
            try{
                if(getStoredValue(HHStoredVarPrefixKey+SK.autoFreeBundlesCollect) !== "true") {
                    logHHAuto("Error autoFreeBundlesCollect not activated.");
                    return;
                }
                const plusButton = $("header .currency .reversed_tooltip");
                if(plusButton.length > 0) {
                    logHHAuto("click button for popup.");
                    plusButton.trigger('click')
                }
                else
                {
                    logHHAuto("No button for popup. Try again in 5h.");
                    setTimer('nextFreeBundlesCollectTime', randomInterval(4*60*60,6*60*60));
                    return false;
                }
                logHHAuto("setting autoloop to false");
                setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
                const bundleTabsContainerQuery = "#common-popups .payments-wrapper .payment-tabs";
                const bundleTabsListQuery = '.starter_offers, .event_bundles, .special_offers, .period_deal';
                const subTabsQuery = "#common-popups .payments-wrapper .content-container .subtabs-container .card-container";
                const freeButtonBundleQuery = "#common-popups .payments-wrapper .bundle .bundle-offer-price .blue_button_L:enabled[price='0.00']";

                function collectFreeBundlesFinished(message: string, nextFreeBundlesCollectTime: number) {
                    logHHAuto(message);
                    setTimer('nextFreeBundlesCollectTime', nextFreeBundlesCollectTime);
                    $("#common-popups .close_cross").trigger('click'); // Close popup
                    setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "true");
                    logHHAuto("setting autoloop to true");
                    setTimeout(autoLoop, Number(getStoredValue(HHStoredVarPrefixKey+TK.autoLoopTimeMili)));
                }

                function parseAndCollectFreeBundles(){

                    const freeBundlesNumber=$(freeButtonBundleQuery).length;
                    if(freeBundlesNumber > 0)
                    {
                        logHHAuto("Free Bundles found: " + freeBundlesNumber);
                        const buttonsToCollect:HTMLElement[] = [];
                        for (let currentBundle = 0; currentBundle < freeBundlesNumber ; currentBundle++)
                        {
                            buttonsToCollect.push($(freeButtonBundleQuery)[currentBundle]);
                        }

                        function collectFreeBundle()
                        {
                            if (buttonsToCollect.length > 0)
                            {
                                logHHAuto("Collecting bundle n°"+ buttonsToCollect[0].getAttribute('product'));
                                buttonsToCollect[0].click();
                                buttonsToCollect.shift();
                                setTimeout(RewardHelper.closeRewardPopupIfAny, randomInterval(500,800));
                                setTimeout(switchToBundleTabs, randomInterval(1500,2500));
                            }
                        }
                        collectFreeBundle();
                        return true;
                    } else {
                        return false;
                    }
                }

                function switchToBundleTabs(): any {
                    const bundleTabs = $(bundleTabsListQuery, $(bundleTabsContainerQuery));
                    if(bundleTabs.length > 0) {
                        let freeBundleFound = false;
                        for(let bundleIndex = 0;bundleIndex < bundleTabs.length && !freeBundleFound;bundleIndex++)
                        {
                            bundleTabs[bundleIndex].click();
                            logHHAuto("Looking in tabs '" + $(bundleTabs[bundleIndex]).attr('type') + "'.");
                            freeBundleFound = parseAndCollectFreeBundles();
                            if (!freeBundleFound && $(subTabsQuery).length > 0) {
                                const subTabs = $(subTabsQuery);
                                logHHAuto("Sub tabs found, switching to next one");
                                for(let subTabIndex = 1;subTabIndex < subTabs.length && !freeBundleFound;subTabIndex++)
                                {
                                    subTabs[subTabIndex].click();
                                    logHHAuto("Looking in sub tabs '" + $(subTabs[subTabIndex]).attr('period_deal') + "'.");
                                    freeBundleFound = parseAndCollectFreeBundles();
                                }
                            }
                        }
                        if(!freeBundleFound) collectFreeBundlesFinished("Free bundle collection finished.", Bundles.getExpiryTime() + randomInterval(3600, 4000));
                    }
                    else
                    {
                        collectFreeBundlesFinished("No bundle tabs in popup, wait one hour.", 60 * 60);
                        return false;
                    }
                }

                // Wait popup is opened
                setTimeout(switchToBundleTabs,randomInterval(1400, 1800));

                return true;
            } catch ({ errName, message }: any) {
                logHHAuto(`ERROR during free bundles run: ${message}, retry in 1h`);
                setTimer('nextFreeBundlesCollectTime', randomInterval(3600, 4000));
                return false;
            }
        }
        else
        {
            logHHAuto("Navigating to home page.");
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
            // return busy
            return true;
        }
    }
}