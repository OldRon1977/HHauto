// Bundles.ts -- Collects free daily and periodic bundles from the shop popup.
//
// The game periodically offers free bundle rewards in a popup. This module
// detects available bundles, navigates to the shop page, and claims them
// automatically on a timer-based schedule.
//
// Used by: Service/index.ts (main automation loop)
//
import {
    RewardHelper,
    TimeHelper,
    ConfigHelper,
    getPage,
    getStoredValue,
    randomInterval,
    setStoredValue,
    setTimer,
    convertTimeToInt
} from '../Helper/index';
import { autoLoop, gotoPage } from "../Service/index";
import { logHHAuto } from '../Utils/index';
import { HHStoredVarPrefixKey, SK, TK } from '../config/index';

export class Bundles {
    static getExpiryTime(){
        const timerRequest = `#popup-payment-container .period_deal .shop-timer span[rel=expires]`

        if ($(timerRequest).length > 0) {
            const freeBundleTimer = Number(convertTimeToInt($(timerRequest).text()));
            logHHAuto('freeBundleTimer', freeBundleTimer);
            if (freeBundleTimer < (24 * 3600)) return freeBundleTimer;
        }
        logHHAuto('ERROR: can\'t get bundle expiry time, default to maxCollectionDelay');
        return ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(60, 180);
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
                        let buttonsToCollect:HTMLElement[] = [];
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

                function switchToBundleTabs() {
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
            } catch ({ errName, message }) {
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