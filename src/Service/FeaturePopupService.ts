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
const FEATURE_POPUP_VERSION: string = "8.28.0";

/**
 * Title shown in the popup header.
 */
const FEATURE_POPUP_TITLE = "HHAuto v8.28.0";

/**
 * HTML content for the feature popup.
 * Update this each time you activate the popup for a new version.
 */
const FEATURE_POPUP_CONTENT = `
  <div style="padding:10px; max-width:520px; color:#333;">

    <p style="font-size:15px; font-weight:bold; margin-bottom:6px; color:#c60;">Labyrinth: plan the whole floor</p>
    <p style="margin:0 0 10px 0;">In the <b>Labyrinth</b> tab, a new <b>Path</b> setting sits below the difficulty. Choose what the floor should give you, and the script plans the way from your hero to the boss instead of looking at the next hex only.</p>

    <p style="font-size:15px; font-weight:bold; margin-bottom:6px; color:#090;">The strategies</p>
    <ul style="margin:0 0 10px 18px; padding:0;">
      <li style="margin-bottom:6px;"><b>Treasures first</b> &mdash; every treasure the floor allows, then the hardest opponents.</li>
      <li style="margin-bottom:6px;"><b>Most red</b> &mdash; as many hard opponents as possible.</li>
      <li style="margin-bottom:6px;"><b>Avoid red</b> &mdash; around hard opponents, picking up treasures and shrines on the way.</li>
      <li style="margin-bottom:6px;"><b>XP</b> / <b>Kisses</b> &mdash; opponents weighed by that reward.</li>
      <li><b>Step by step</b> &mdash; the previous behaviour, and the default.</li>
    </ul>

    <p style="font-size:15px; font-weight:bold; margin-bottom:6px; color:#090;">How it works</p>
    <ul style="margin:0 0 10px 18px; padding:0;">
      <li style="margin-bottom:6px;">After every step the script plans again from where the hero stands. The planned way is drawn in green on the board.</li>
      <li style="margin-bottom:6px;">Opponent power is shown for the next step only, so the plan weighs the hex types; between two equal next steps it takes the weaker opponent.</li>
      <li style="margin-bottom:6px;">It works the same on every floor; only the number of floors depends on the difficulty.</li>
      <li>The <b>Hard mode</b> switch is gone. If it was on, <b>Path</b> is now <b>Most red</b>.</li>
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
