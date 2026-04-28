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

import {
    getStoredValue,
    setStoredValue
} from '../Helper/index';
import {
    fillHHPopUp,
    logHHAuto,
    maskHHPopUp
} from '../Utils/index';
import {
    HHStoredVarPrefixKey,
    TK
} from '../config/index';

/**
 * Maximum number of "Remind me later" clicks before the popup is suppressed
 * for the current version. Default: 3 for normal "What's New" popups. Set to
 * Number.MAX_SAFE_INTEGER to disable the limit (popup keeps reappearing until
 * the user clicks the close button).
 */
const FEATURE_POPUP_MAX_REMINDERS: number = Number.MAX_SAFE_INTEGER;

/**
 * Label of the close button. Default: "Close" for normal "What's New" popups.
 */
const FEATURE_POPUP_CLOSE_LABEL: string = "OK";

/**
 * Set to a specific version (e.g. "7.34.2") to activate the feature popup
 * for that version. Set to "0" to deactivate (default).
 */
const FEATURE_POPUP_VERSION: string = "7.35.14";

/**
 * Title shown in the popup header.
 */
const FEATURE_POPUP_TITLE = "HHAuto repository is moving";

/**
 * HTML content for the feature popup.
 * Update this each time you activate the popup for a new version.
 */
const FEATURE_POPUP_CONTENT = `
  <div style="padding:10px; max-width:520px; color:#333;">
    <p style="font-size:15px; font-weight:bold; margin-bottom:10px;">HHAuto repository is moving</p>
    <p style="margin-bottom:10px;">The HHAuto GitHub repository is being transferred to a new owner in the coming days:</p>
    <ul style="margin-bottom:10px;">
      <li>Old: <code>github.com/Roukys/HHauto</code></li>
      <li>New: <b style="color:#d00;">github.com/OldRon1977/HHauto</b></li>
    </ul>
    <p style="margin-bottom:6px;"><b>What this means for you:</b></p>
    <ul style="margin-bottom:10px; font-size:12px;">
      <li>GitHub redirects old URLs to the new owner automatically — no action needed in most cases.</li>
      <li>Tampermonkey will pick up future updates from the new URL on its next auto-update cycle.</li>
      <li>Your settings and data are stored locally in Tampermonkey and remain untouched.</li>
    </ul>
    <p style="margin-bottom:10px; font-size:12px;">If updates ever stop arriving after the transfer, reinstall HHAuto from the new URL above.</p>
    <p style="margin-bottom:15px; font-size:13px;">
      Big thanks to <b>Roukys</b> for providing the home of HHAuto for so many years.<br>
      Special thanks to <b>deuxge</b>, the main maintainer in recent years, who continues to keep HHAuto alive!
    </p>
    <p style="margin-bottom:10px; font-size:11px; color:#888; font-style:italic;">
      This reminder will reappear with future versions until the transfer is complete. Click "OK" to dismiss it for the current version.
    </p>
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
