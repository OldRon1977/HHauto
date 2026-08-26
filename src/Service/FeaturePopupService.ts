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
// Set to the version this branch will be RELEASED as, not to the version being
// built. main is on 8.9.0, so the merge lands as 8.10.0; the branch's own
// 8.10.x build numbers therefore never match and the popup stays quiet during
// development. If the release number changes, change it here too -- a
// mismatch means the popup silently never appears.
const FEATURE_POPUP_VERSION: string = "8.10.0";

/**
 * Title shown in the popup header.
 */
const FEATURE_POPUP_TITLE = "HHAuto v8.10.0";

/**
 * HTML content for the feature popup.
 * Update this each time you activate the popup for a new version.
 */
const FEATURE_POPUP_CONTENT = `
  <div style="padding:10px; max-width:520px; color:#333;">

    <p style="font-size:15px; font-weight:bold; margin-bottom:6px; color:#090;">One activity at a time</p>
    <p style="margin-bottom:10px;">The script used to hop: one troll fight, one season fight, one pantheon fight, round and round. It now stays on an activity until that activity is done &mdash; out of energy, threshold reached, timer set &mdash; and only then moves on. Collecting still cuts in whenever it is due, so nothing expires while a fight is running.</p>

    <p style="font-size:15px; font-weight:bold; margin-bottom:6px; color:#090;">The menu says what is running</p>
    <p style="margin-bottom:6px;">Every block in the settings menu now carries a coloured dot on its heading, and each area a count on the left.</p>
    <ul style="margin-bottom:10px; font-size:12px;">
      <li><b style="color:#090;">Green</b> &mdash; this block runs.</li>
      <li><b style="color:#d90;">Amber</b> &mdash; set up but it will not run: something here is configured while the switch that starts it is off. This is the forgotten toggle.</li>
      <li><b style="color:#c33;">Red</b> &mdash; nothing here is switched on.</li>
    </ul>

    <p style="font-size:15px; font-weight:bold; margin-bottom:6px; color:#090;">+Girl Skins now covers event villains</p>
    <p style="margin-bottom:10px;">It worked for love raids but stopped at event villains, mythic ones included. With the switch on, an event girl you already own stays a target while one of her skins is still missing.</p>

    <p style="font-size:15px; font-weight:bold; margin-bottom:6px; color:#090;">A Sandalwood for a skin &mdash; only if you say so</p>
    <p style="margin-bottom:10px;">Once a girl is won and only her skin is left, the script kept putting a fresh Sandalwood on, and with +Girl Skins <b>off</b> it kept fighting her at all &mdash; the shard count was only refreshed on the next visit to the event page. Both are fixed: the count is read after every fight, a finished girl is dropped as a target straight away, and a new switch <b>Equip Sandalwood</b> under <i>Shards &amp; skins</i> decides whether a perfume may be spent on a skin. It is off by default &mdash; a Sandalwood is a mythic booster. The three Equip Sandalwood switches next to +Event, +Mythic Event and +Raid keep their meaning: they are for winning the girl.</p>

    <p style="font-size:15px; font-weight:bold; margin-bottom:6px; color:#090;">The debug log now holds a whole night</p>
    <p style="margin-bottom:10px;">The log kept the last 5000 lines, which in a busy session is about half an hour &mdash; too short for anything that only shows itself overnight. It is written differently now and keeps six hours and more, using as much room as your browser allows. Saving it works exactly as before and the file looks the same. If you report a bug that takes a while to appear, the log will have it.</p>

    <p style="font-size:15px; font-weight:bold; margin-bottom:6px; color:#090;">Espa&ntilde;ol &middot; Fran&ccedil;ais &middot; Deutsch</p>
    <p style="margin-bottom:10px; padding:8px 10px; border-left:3px solid #090; background:#f2faf2;">
      All three menu languages have been reworked and are now complete &mdash; every setting, every tooltip.
      Spanish and French were about a third translated before.<br>
      <b>Corrections are very welcome.</b> If a term is wrong or reads oddly in your language, open an issue
      or comment &mdash; a native speaker&rsquo;s eye is the one thing this cannot be done without.</p>

    <p style="margin-bottom:0; font-size:11px; color:#888;">No settings are reset and nothing was removed from the menu. Full details in the CHANGELOG.</p>
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
