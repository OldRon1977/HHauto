// SurveyService.ts
//
// One-time settings survey that asks users to anonymously share which
// settings they actually use. Data is collected to identify unused
// features that can be removed to reduce complexity.
//
// Triggered once after a version upgrade. Users can:
//   - Share anonymously via Google Form (POST with GM_xmlhttpRequest)
//   - Share on GitHub Discussion (opens pre-filled URL)
//   - Copy to clipboard
//   - Dismiss (permanently) or "Remind me later" (up to 3 times)
//
// Only boolean ON/OFF/DEFAULT categories are sent, plus the script
// version and site hostname. No personal data is collected.

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
    HHStoredVars,
    SK,
    TK
} from '../config/index';

const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSe1_iM197Xfq2kEKR2jBA64_r28BpOerTlMywVfMEmsvXvDMQ/formResponse';
const GOOGLE_FORM_ENTRY = 'entry.875507092';
const MAX_REMIND_COUNT = 3;

export class SurveyService {

    /**
     * Check whether the survey popup should be shown.
     * Called from StartService after a version upgrade is detected.
     */
    static shouldShowSurvey(): boolean {
        const alreadyShown = getStoredValue(HHStoredVarPrefixKey + TK.surveyShown);
        if (alreadyShown === "true") return false;

        const dismissCount = Number(getStoredValue(HHStoredVarPrefixKey + TK.surveyDismissCount) || "0");
        if (dismissCount >= MAX_REMIND_COUNT) return false;

        return true;
    }

    /**
     * Show the survey popup.
     */
    static showSurveyPopup(): void {
        const content = SurveyService.buildPopupContent();
        fillHHPopUp("settingsSurvey", "HHAuto Settings Survey", content);
        SurveyService.bindPopupEvents();
    }

    /**
     * Build the anonymized settings export string.
     * Format: one line per setting with key name and status.
     * Status: ON / OFF / DEFAULT / value (for non-booleans)
     */
    static buildSettingsExport(): string {
        const lines: string[] = [];
        const version = GM.info.script.version;
        const site = window.location.hostname;

        lines.push(`HHAuto Settings Survey`);
        lines.push(`Version: ${version}`);
        lines.push(`Site: ${site}`);
        lines.push(`Date: ${new Date().toISOString().split('T')[0]}`);
        lines.push(`---`);

        // Iterate all SK keys (user settings only)
        for (const keyName of Object.keys(SK)) {
            const storageKey = HHStoredVarPrefixKey + (SK as Record<string, string>)[keyName];
            const varDef = HHStoredVars[storageKey];
            if (!varDef || varDef.HHType !== "Setting") continue;

            const currentValue = getStoredValue(storageKey);
            const defaultValue = varDef.default;
            let status: string;

            if (varDef.valueType === "Boolean") {
                if (currentValue === defaultValue) {
                    status = `DEFAULT (${currentValue === "true" ? "ON" : "OFF"})`;
                } else {
                    status = currentValue === "true" ? "ON" : "OFF";
                }
            } else {
                if (currentValue === defaultValue) {
                    status = "DEFAULT";
                } else {
                    status = "CHANGED";
                }
            }

            lines.push(`${keyName}: ${status}`);
        }

        return lines.join('\n');
    }

    /**
     * Send the export to Google Forms via GM_xmlhttpRequest (bypasses CORS).
     */
    static sendToGoogleForm(data: string): void {
        const formData = `${GOOGLE_FORM_ENTRY}=${encodeURIComponent(data)}`;

        GM_xmlhttpRequest({
            method: 'POST',
            url: GOOGLE_FORM_URL,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: formData,
            onload: function(response: { status: number }) {
                if (response.status === 200) {
                    logHHAuto("Settings survey submitted successfully via Google Form.");
                    SurveyService.markAsShown();
                    SurveyService.showThankYou();
                } else {
                    logHHAuto("Settings survey submission failed: " + response.status);
                    SurveyService.showError();
                }
            },
            onerror: function() {
                logHHAuto("Settings survey submission error.");
                SurveyService.showError();
            }
        });
    }


    /**
     * Copy the export to clipboard.
     */
    static copyToClipboard(data: string, silent = false): void {
        GM_setClipboard(data, 'text');
        logHHAuto("Settings survey data copied to clipboard.");
        if (!silent) {
            SurveyService.markAsShown();
            SurveyService.showCopied();
        }
    }

    /**
     * Mark survey as permanently shown (won't appear again).
     */
    static markAsShown(): void {
        setStoredValue(HHStoredVarPrefixKey + TK.surveyShown, "true");
    }

    /**
     * Increment dismiss counter for "Remind me later".
     */
    static remindLater(): void {
        const count = Number(getStoredValue(HHStoredVarPrefixKey + TK.surveyDismissCount) || "0");
        setStoredValue(HHStoredVarPrefixKey + TK.surveyDismissCount, String(count + 1));
        logHHAuto(`Settings survey postponed (${count + 1}/${MAX_REMIND_COUNT}).`);
        maskHHPopUp();
    }

    /**
     * Permanently dismiss the survey.
     */
    static dismiss(): void {
        SurveyService.markAsShown();
        logHHAuto("Settings survey permanently dismissed.");
        maskHHPopUp();
    }

    // ── Private helpers ──

    private static buildPopupContent(): string {
        const dismissCount = Number(getStoredValue(HHStoredVarPrefixKey + TK.surveyDismissCount) || "0");
        const remainingReminders = MAX_REMIND_COUNT - dismissCount;

        return '<div style="padding:10px; max-width:500px; color:#333;">'
            + '<p style="margin-bottom:10px;">Help us improve HHAuto! We\'d like to know which settings you actually use so we can simplify the script.</p>'
            + '<p style="margin-bottom:10px; font-size:11px;">This is <b>completely anonymous</b> — we only collect ON/OFF status of settings, your script version, and site name. No personal data.</p>'
            + '<p style="margin-bottom:10px; font-size:11px; padding:6px; background:#fff3cd; border:1px solid #ffc107; border-radius:4px;"><b>Note:</b> Tampermonkey may ask for permission to send data. Select <b>"Temporarily allow"</b> to proceed.</p>'
            + '<div style="display:flex; flex-direction:column; gap:8px; margin-top:15px;">'
            +   '<label class="myButton" id="surveyShareAnon" style="text-align:center; cursor:pointer; padding:8px;">&#x1f4e4; Share anonymously (Google Form)</label>'
            +   '<label class="myButton" id="surveyCopy" style="text-align:center; cursor:pointer; padding:8px;">&#x1f4cb; Copy to clipboard</label>'
            + '</div>'
            + '<div style="display:flex; justify-content:space-between; margin-top:15px; font-size:11px;">'
            +   (remainingReminders > 0
                    ? '<a id="surveyRemind" href="#" style="color:#666;">Remind me later (' + remainingReminders + ' left)</a>'
                    : '<span></span>')
            +   '<a id="surveyDismiss" href="#" style="color:#999;">Don\'t ask again</a>'
            + '</div>'
            + '</div>';
    }

    private static bindPopupEvents(): void {
        const data = SurveyService.buildSettingsExport();

        $('#surveyShareAnon').off('click').on('click', function() {
            SurveyService.sendToGoogleForm(data);
        });
        $('#surveyCopy').off('click').on('click', function() {
            SurveyService.copyToClipboard(data);
        });
        $('#surveyRemind').off('click').on('click', function(e) {
            e.preventDefault();
            SurveyService.remindLater();
        });
        $('#surveyDismiss').off('click').on('click', function(e) {
            e.preventDefault();
            SurveyService.dismiss();
        });
    }

    private static showThankYou(): void {
        fillHHPopUp("settingsSurvey", "HHAuto Settings Survey",
            '<div style="padding:10px; color:#333; text-align:center;">'
            + '<p style="font-size:16px; margin-bottom:10px;">&#x2705; Thank you!</p>'
            + '<p>Your settings have been submitted anonymously. This helps us make HHAuto better!</p>'
            + '</div>'
        );
    }

    private static showCopied(): void {
        fillHHPopUp("settingsSurvey", "HHAuto Settings Survey",
            '<div style="padding:10px; color:#333; text-align:center;">'
            + '<p style="font-size:16px; margin-bottom:10px;">&#x1f4cb; Copied!</p>'
            + '<p>Your settings data has been copied to the clipboard. You can paste it anywhere you like (e.g. a GitHub issue or discussion).</p>'
            + '</div>'
        );
    }

    private static showError(): void {
        fillHHPopUp("settingsSurvey", "HHAuto Settings Survey",
            '<div style="padding:10px; color:#333; text-align:center;">'
            + '<p style="font-size:16px; margin-bottom:10px;">&#x274c; Submission failed</p>'
            + '<p>Something went wrong. Please try the clipboard option instead.</p>'
            + '<div style="margin-top:10px;">'
            +   '<label class="myButton" id="surveyErrorCopy" style="text-align:center; cursor:pointer; padding:8px;">&#x1f4cb; Copy to clipboard</label>'
            + '</div>'
            + '</div>'
        );
        const data = SurveyService.buildSettingsExport();
        $('#surveyErrorCopy').off('click').on('click', function() {
            SurveyService.copyToClipboard(data);
        });
    }
}
