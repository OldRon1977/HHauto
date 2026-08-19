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
const FEATURE_POPUP_VERSION: string = "8.10.5";

/**
 * Title shown in the popup header.
 */
const FEATURE_POPUP_TITLE = "HHAuto v8.10.5";

/**
 * HTML content for the feature popup.
 * Update this each time you activate the popup for a new version.
 */
const FEATURE_POPUP_CONTENT = `
  <div style="padding:10px; max-width:520px; color:#333;">
    <p style="font-size:15px; font-weight:bold; margin-bottom:6px; color:#090;">A settings menu that fits every language</p>
    <p style="margin-bottom:6px;">The three fixed columns are gone. Settings are grouped by <b>game area</b>, every group carries a heading, and a label may be as long as its translation needs &mdash; no more text running under a switch.</p>
    <ul style="margin-bottom:10px; font-size:12px;">
      <li><b>Single page menu</b> &mdash; prefer everything in one view? Turn it on under <i>Global</i> and the areas stack into one scrolling list, no tabs.</li>
      <li><b>Menu Order</b> &mdash; the button in the footer lets you drag the areas into your own order. Works in both layouts and travels with your settings export.</li>
      <li><b>The status panel</b> on the home page is a single column now, with the timer name on the left and its time flush right, so the longer rows are readable instead of cut off.</li>
    </ul>
    <p style="font-size:15px; font-weight:bold; margin-bottom:6px; color:#090;">Gear for your hero (8.9.0)</p>
    <p style="margin-bottom:6px;">Three new buttons on the <b>market page</b>, armor tab &mdash; laid out like the team workflow, so there is one mental model instead of two.</p>
    <ul style="margin-bottom:6px; font-size:12px;">
      <li><b>Current Best Gear</b> &mdash; puts on the best armor you own, as things stand today. It never makes you weaker.</li>
      <li><b>Possible Best Gear</b> &mdash; puts on the items worth developing, and tells you per slot what that costs you right now.</li>
      <li><b>Upgrade Gear</b> &mdash; levels the mythics you are wearing, best-matching slot first.</li>
    </ul>
    <p style="margin-bottom:6px; padding:6px 8px; border-left:3px solid #090; background:#f2faf2;">
      <b>No mythic is ever used as material.</b> Upgrade Gear consumes only <b>legendary and epic</b> items &mdash;
      never a mythic, with no exception for duplicates, for spares, or for a mythic you are not wearing.</p>
    <p style="margin-bottom:6px;">Items are ranked by <b>priority</b>, not by a stat score: a capped mythic matching your class <i>and</i> your team&rsquo;s theme first, then class, then theme, then any capped mythic. At the cap every mythic has the same stats, so the resonance is the whole difference.</p>
    <ul style="margin-bottom:10px; font-size:12px;">
      <li><b>Build your team first.</b> The theme of the team you field decides which resonances count. Without it the buttons do nothing and say so.</li>
      <li>Every button shows the <b>full plan before it touches anything</b>, and notes the id of each item it takes off so you can put it back.</li>
    </ul>
    <p style="font-size:15px; font-weight:bold; margin-bottom:6px; color:#090;">Better team selection (new in 8.7.0)</p>
    <p style="margin-bottom:10px;">The picker no longer chases the <b>Total Power</b> the game prints &mdash; it has the game calculate each candidate team and fields the one that actually wins fights. Measured on one account: <b>88.9% &rarr; 92.2%</b> average win chance at identical Total Power. Press <b>1 Unequip All</b> first, or the team already wearing the gear wins the selection for its items.</p>
    <p style="margin-bottom:10px;"><b>Deutsch:</b> Sprache Deutsch vervollst&auml;ndigt, Fehler gerne melden.</p>
    <p style="margin-bottom:0; font-size:11px; color:#888;">Nothing was removed and no settings are reset. The gear buttons need <b>Show market tools</b>. Full details in the CHANGELOG.</p>
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
