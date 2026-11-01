// RewardPopup.ts -- Close the game's reward popup.
//
// The game shows a claimed reward in `#rewards_popup` (or a popup of the
// page's own, passed as popupId) with a blue OK button; a won girl brings a
// purple button beside a blue `#redirect-to-harem`, and the blue one would
// leave the page for the harem.
//
// These two functions live apart from RewardHelper on purpose. RewardHelper
// imports EventModule and LoveRaidManager, so a module that EventModule
// reaches cannot import it without closing an import cycle (ADR-008); this
// file imports only the log. RewardHelper keeps its static methods and hands
// over to these, so the specs that spy on RewardHelper still see every call.
//
// Three modules close the popup with code of their own, and each does
// something these functions do not: Quest clicks the first blue or purple
// button, Sultry Mysteries clicks a blue redirect-to-harem as well, Boss Bang
// takes any `.blue_button_L`, not only a button. Moving them here would
// change what they click.
//
// Depends on: LogUtils
// Used by: RewardHelper.ts
import { logHHAuto } from "../Utils/LogUtils";

export function closeRewardPopupIfAny(logging = true, popupId = ''): boolean {
    const rewardQuery = `div#${popupId != '' ? popupId : 'rewards_popup'} button.blue_button_L:not([disabled]):visible`;
    if ($(rewardQuery).length > 0) {
        if ($(rewardQuery).attr('id') === 'redirect-to-harem') {
            logHHAuto("Redirect to harem button detected.");
            return closeGirlRewardPopupIfAny(logging, popupId);
        }
        if (logging) logHHAuto(`Close reward popup ${popupId != '' ? popupId : 'rewards_popup'}.`);
        $(rewardQuery).trigger('click');
        return true;
    }
    return false;
}

export function closeGirlRewardPopupIfAny(logging = true, popupId = ''): boolean {
    const rewardQuery = `div#${popupId != '' ? popupId : 'rewards_popup'} button.purple_button_L:not([disabled]):visible`;
    if ($(rewardQuery).length > 0) {
        if (logging) logHHAuto(`Close girl reward popup ${popupId != '' ? popupId : 'rewards_popup'}.`);
        $(rewardQuery).trigger('click');
        return true;
    }
    return false;
}
