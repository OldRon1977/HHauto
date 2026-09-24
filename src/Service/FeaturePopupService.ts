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
 * Label of the close button.
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
const FEATURE_POPUP_VERSION: string = "8.15.0";

/**
 * Title shown in the popup header.
 */
const FEATURE_POPUP_TITLE = "HHAuto v8.15.0";

/**
 * HTML content for the feature popup.
 * Update this each time you activate the popup for a new version.
 */
const FEATURE_POPUP_CONTENT = `
  <div style="padding:10px; max-width:520px; color:#333;">

    <p style="font-size:15px; font-weight:bold; margin-bottom:6px; color:#c60;">Please check your collect settings</p>
    <p style="margin:0 0 10px 0;">Mythic boosters, books and light bulbs used to be collected under <i>Mythic Equipment</i>. They now count as what they are. If you collect those, tick <b>Boosters</b>, <b>Potions</b> and <b>Light Bulbs</b>.</p>

    <p style="font-size:15px; font-weight:bold; margin-bottom:6px; color:#090;">What changed</p>
    <ul style="margin:0 0 10px 18px; padding:0;">
      <li style="margin-bottom:6px;"><b>Unclaimed rewards:</b> the box under <i>Claim All</i> now lists every reward still to claim &mdash; shards, gems, orbs, items, bulbs, equipment and more &mdash; not only energies, XP and currencies.</li>
      <li style="margin-bottom:6px;"><b>Collect popup:</b> plain checkboxes, one click each. New buttons: <b>All but XP</b>, and <b>Copy to all</b>, which copies your selection to every other collect list.</li>
      <li style="margin-bottom:6px;"><b>Three new collect types:</b> Equipment, Event resource and Lively scene. Tiers with them were never collected before. They start unticked.</li>
      <li style="margin-bottom:6px;"><b>Event switches stay on:</b> Double Penetration, Lively Scene, Seasonal event and Boss Bang no longer switch themselves off between events.</li>
      <li><b>Timer list:</b> events that are not running no longer show &quot;Time's up!&quot;.</li>
    </ul>

    <p style="margin-bottom:0; font-size:11px; color:#888;">Full details in the <a href="https://github.com/OldRon1977/HHauto/blob/main/CHANGELOG.md" target="_blank" rel="noopener">CHANGELOG</a>.</p>
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
