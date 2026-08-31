// FeaturePopupService.ts
//
// Version-gated "What's New" popup to inform users about important changes
// such as breaking changes, reset settings, or new features that require
// attention.
//
// Activation: Set FEATURE_POPUP_VERSION to a specific version string
// (e.g. "7.34.2") to show the popup for that version. Set to "0" to
// deactivate (default). The popup only appears when the current script
// version matches FEATURE_POPUP_VERSION exactly.
//
// Users can:
//   - "Remind me later" (up to FEATURE_POPUP_MAX_REMINDERS times)
//   - Close button (permanently dismiss for this version)
//
// When activated for a new version, dismiss counters reset automatically.
import { getStoredValue, setStoredValue } from "../Helper/StorageHelper";
import { fillHHPopUp, maskHHPopUp } from "../Utils/HHPopup";
import { logHHAuto } from "../Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { TK } from "../config/StorageKeys";

/**
 * Maximum number of "Remind me later" clicks before the popup is suppressed
 * for the current version. Default: 3 for normal "What's New" popups. Set to
 * Number.MAX_SAFE_INTEGER to disable the limit (popup keeps reappearing until
 * the user clicks the close button).
 */
const FEATURE_POPUP_MAX_REMINDERS: number = 3;

/**
 * Label of the close button. Default: "Close" for normal "What's New" popups.
 */
const FEATURE_POPUP_CLOSE_LABEL: string = "OK";

/**
 * Set to a specific version (e.g. "7.34.2") to activate the feature popup
 * for that version. Set to "0" to deactivate (default).
 */
// Must equal the released version EXACTLY -- shouldShowPopup compares with
// ===, so a mismatch means the popup silently never appears, and adding a
// paragraph without moving this number changes nothing on screen. If the
// release number changes, change it here and in the title too.
const FEATURE_POPUP_VERSION: string = "8.11.0";

/**
 * Title shown in the popup header.
 */
const FEATURE_POPUP_TITLE = "HHAuto v8.11.0";

/**
 * HTML content for the feature popup.
 * Update this each time you activate the popup for a new version.
 */
const FEATURE_POPUP_CONTENT = `
  <div style="padding:10px; max-width:520px; color:#333;">

    <p style="font-size:15px; font-weight:bold; margin-bottom:6px; color:#090;">Boosters to buy: one field, one amount each</p>
    <p style="margin-bottom:10px;">The <i>Filter</i> and <i>Max Booster</i> settings are now a single field. Each booster carries the number you want to keep, written after a colon: <code>MB1:5;B4:50;MB6:2</code> &mdash; no spaces, and each booster only once. Equipped boosters do not count towards it, <code>0</code> means no limit as before, and a booster you do not list is never bought.</p>
    <p style="margin-bottom:10px;"><b>Your existing setting was carried over</b> &mdash; the old filter and the old number were combined for you, so nothing changes about what gets bought.</p>
    <p style="margin-bottom:10px;">One thing is new: if the field turns <b style="color:#c33;">red</b>, buying boosters stops until you correct it. A list that cannot be read would otherwise have to guess, and guessing here spends kobans. Everything else, equipping included, carries on.</p>

    <p style="margin-bottom:0; font-size:11px; color:#888;">The <i>Max Booster</i> field is gone from the menu &mdash; its number lives in the list now. No other setting was changed. Full details in the CHANGELOG.</p>
  </div>
`;

export class FeaturePopupService {

    /**
     * Check whether the feature popup should be shown.
     * Only active when FEATURE_POPUP_VERSION matches the current script version.
     * Dismiss counters reset automatically when activated for a new version.
     */
    static shouldShowPopup(): boolean {
        if (FEATURE_POPUP_VERSION === "0") return false;

        const currentVersion = GM.info.script.version;
        if (currentVersion !== FEATURE_POPUP_VERSION) return false;

        // Reset dismiss state when activated for a new version
        const shownForVersion = getStoredValue(HHStoredVarPrefixKey + TK.featurePopupShown);
        if (shownForVersion !== "0" && shownForVersion !== FEATURE_POPUP_VERSION) {
            setStoredValue(HHStoredVarPrefixKey + TK.featurePopupShown, "0");
            setStoredValue(HHStoredVarPrefixKey + TK.featurePopupDismissCount, "0");
        }

        if (shownForVersion === FEATURE_POPUP_VERSION) return false;

        const dismissCount = Number(getStoredValue(HHStoredVarPrefixKey + TK.featurePopupDismissCount) || "0");
        if (dismissCount >= FEATURE_POPUP_MAX_REMINDERS) return false;

        return true;
    }

    /**
     * Show the feature popup.
     */
    static showPopup(): void {
        const content = FeaturePopupService.buildPopupContent();
        fillHHPopUp("featurePopup", FEATURE_POPUP_TITLE, content);
        FeaturePopupService.bindPopupEvents();
    }

    /**
     * Mark popup as shown for the current active version.
     */
    static markAsShown(): void {
        setStoredValue(HHStoredVarPrefixKey + TK.featurePopupShown, FEATURE_POPUP_VERSION);
    }

    /**
     * Increment dismiss counter for "Remind me later".
     */
    static remindLater(): void {
        const count = Number(getStoredValue(HHStoredVarPrefixKey + TK.featurePopupDismissCount) || "0");
        setStoredValue(HHStoredVarPrefixKey + TK.featurePopupDismissCount, String(count + 1));
        const limitDisplay = FEATURE_POPUP_MAX_REMINDERS >= Number.MAX_SAFE_INTEGER ? '∞' : String(FEATURE_POPUP_MAX_REMINDERS);
        logHHAuto(`Feature popup postponed (${count + 1}/${limitDisplay}).`);
        maskHHPopUp();
    }

    /**
     * Permanently dismiss the popup for this version.
     */
    static dismiss(): void {
        FeaturePopupService.markAsShown();
        logHHAuto("Feature popup dismissed for version " + FEATURE_POPUP_VERSION + ".");
        maskHHPopUp();
    }

    // ── Private helpers ──

    private static buildPopupContent(): string {
        const dismissCount = Number(getStoredValue(HHStoredVarPrefixKey + TK.featurePopupDismissCount) || "0");
        const isUnlimited = FEATURE_POPUP_MAX_REMINDERS >= Number.MAX_SAFE_INTEGER;
        const remainingReminders = FEATURE_POPUP_MAX_REMINDERS - dismissCount;
        const showRemind = isUnlimited || remainingReminders > 0;
        const remindLabel = isUnlimited
            ? 'Remind me later'
            : 'Remind me later (' + remainingReminders + ' left)';

        return FEATURE_POPUP_CONTENT
            + '<div style="display:flex; justify-content:space-between; margin-top:15px; padding:0 10px 10px 10px; font-size:12px;">'
            +   (showRemind
                    ? '<a id="featurePopupRemind" href="#" style="color:#666;">' + remindLabel + '</a>'
                    : '<span></span>')
            +   '<label class="myButton" id="featurePopupClose" style="cursor:pointer; padding:6px 16px;">' + FEATURE_POPUP_CLOSE_LABEL + '</label>'
            + '</div>';
    }

    private static bindPopupEvents(): void {
        $('#featurePopupRemind').off('click').on('click', function(e) {
            e.preventDefault();
            FeaturePopupService.remindLater();
        });
        $('#featurePopupClose').off('click').on('click', function() {
            FeaturePopupService.dismiss();
        });
    }
}
