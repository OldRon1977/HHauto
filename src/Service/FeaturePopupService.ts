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
//   - "Remind me later" (up to MAX_REMIND_COUNT times)
//   - "Close" (permanently dismiss for this version)
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

const MAX_REMIND_COUNT = 3;

/**
 * Set to a specific version (e.g. "7.34.2") to activate the feature popup
 * for that version. Set to "0" to deactivate (default).
 */
const FEATURE_POPUP_VERSION: string = "7.34.0";

/**
 * Title shown in the popup header.
 */
const FEATURE_POPUP_TITLE = "What's New in HHAuto";

/**
 * HTML content for the feature popup.
 * Update this each time you activate the popup for a new version.
 *
 * Example:
 * const FEATURE_POPUP_CONTENT = `
 *   <div style="padding:10px; max-width:500px; color:#333;">
 *     <h3 style="margin-top:0;">v7.34.2 Changes</h3>
 *     <ul>
 *       <li><b>Breaking:</b> Sandalwood settings have been reset to defaults
 *           to prevent unintended koban spending.</li>
 *       <li><b>New:</b> Love Raid grade filter now supports 6-star mythic girls.</li>
 *     </ul>
 *     <p style="font-size:11px; color:#666;">
 *       Please review your settings after this update.
 *     </p>
 *   </div>
 * `;
 */
const FEATURE_POPUP_CONTENT = `
  <div style="padding:10px; max-width:500px; color:#333;">
    <h3 style="margin-top:0;">v7.34.0 — Smarter Team Selection</h3>
    <p>The <b>"Current Best"</b> and <b>"Possible Best"</b> buttons now use an improved algorithm that considers <b>element synergies</b> and <b>leader skills</b> when building your team.</p>
    <ul style="padding-left:18px;">
      <li><b>Leader optimization:</b> The girl in position 1 is chosen for the best Tier-5 skill (Execute > Stun > Shield > Reflect), not just highest stats. This means the leader may have fewer points than other team members — that is intentional.</li>
      <li><b>Element synergies:</b> The algorithm considers how element bonuses (crit damage, crit chance, heal, etc.) stack across all 7 team members.</li>
      <li><b>Visual info:</b> Element icons and a synergy info panel now show why the algorithm chose each girl.</li>
    </ul>
    <p style="font-size:11px; color:#666;">
      For full details, see the
      <a href="https://github.com/Roukys/HHauto#v7340--smarter-team-selection" target="_blank" style="color:#3366cc;">changelog on GitHub</a>.
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
        if (dismissCount >= MAX_REMIND_COUNT) return false;

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
        logHHAuto(`Feature popup postponed (${count + 1}/${MAX_REMIND_COUNT}).`);
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
        const remainingReminders = MAX_REMIND_COUNT - dismissCount;

        return FEATURE_POPUP_CONTENT
            + '<div style="display:flex; justify-content:space-between; margin-top:15px; padding:0 10px 10px 10px; font-size:12px;">'
            +   (remainingReminders > 0
                    ? '<a id="featurePopupRemind" href="#" style="color:#666;">Remind me later (' + remainingReminders + ' left)</a>'
                    : '<span></span>')
            +   '<label class="myButton" id="featurePopupClose" style="cursor:pointer; padding:6px 16px;">Close</label>'
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
