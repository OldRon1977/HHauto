// Pachinko.ts -- Automates free pachinko (gacha) pulls: regular, mythic, and equipment.
//
// Pachinko is the game's gacha system with free pulls on a timer. This module
// tracks cooldowns for each pachinko type (regular, mythic, equipment), navigates
// to the correct tab, and executes free pulls when available. Does not spend
// premium currency -- only claims free pulls.
//
// Used by: Service/index.ts (main automation loop)
//
import { ConfigHelper } from "../Helper/ConfigHelper";
import { hhMenuSwitch } from "../Helper/HHMenuHelper";
import { getTextForUI } from "../Helper/LanguageHelper";
import { getPage } from "../Helper/PageHelper";
import { RewardHelper } from "../Helper/RewardHelper";
import { getStoredValue, setStoredValue } from "../Helper/StorageHelper";
import { convertTimeToInt, randomInterval, TimeHelper } from "../Helper/TimeHelper";
import { setTimer } from "../Helper/TimerHelper";
import { gotoPage } from "../Service/PageNavigationService";
import { isDisplayedHHPopUp, fillHHPopUp, maskHHPopUp } from "../Utils/HHPopup";
import { logHHAuto } from "../Utils/LogUtils";
import { safeJsonParse } from "../Utils/Utils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { HHAuto_inputPattern } from "../config/InputPattern";
import { TK } from "../config/StorageKeys";

// Decoupled autoLoop kick (see lesson zirkulaerer-import-tdz-crash). Pachinko
// must restart the loop after a run -- it sets autoLoop="false" during the
// pulls, which stops AutoLoop's self-reschedule. Importing autoLoop directly
// put Pachinko in a Module->Service import cycle; the entry point (index.ts)
// injects it via setPachinkoAutoLoopKick instead.
let autoLoopKick: (() => void) | null = null;
export function setPachinkoAutoLoopKick(cb: (() => void) | null): void {
    autoLoopKick = cb;
}

export class Pachinko {
    static ajaxBindingDone = false;
    static orbLeftOnAutoStart = 0;
    static orbsToGo = 0;
    static autoPachinkoRunning = false;
    static failureTimeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
    static pachinkoSelector: HTMLSelectElement | undefined = undefined;
    static ByPassNoGirlChecked: boolean;
    static stopFirstGirlChecked: boolean;
    static debugEnabled: boolean;
    static retry: number = 0;
    // Authoritative remaining orb count for the selected type, taken from the
    // server play-response. Preferred over the DOM counter, which can lag during
    // fast runs and cause over-consumption past the requested amount (issue 1745).
    static serverOrbsLeft: number | undefined = undefined;

    static getGreatPachinko(): Promise<boolean> {
        return Pachinko.getFreePachinko('great','nextPachinkoTime','great-timer');
    }
    static getMythicPachinko(): Promise<boolean> {
        return Pachinko.getFreePachinko('mythic','nextPachinko2Time', 'mythic-timer');
    }
    static getEquipmentPachinko(): Promise<boolean> {
        return Pachinko.getFreePachinko('equipment','nextPachinkoEquipTime', 'equipment-timer');
    }

    static async getFreePachinko(pachinkoType: string, pachinkoTimer: string, timerClass: string):Promise<boolean> {
        if(!pachinkoType || !pachinkoTimer){
            return false;
        }

        try {
            if(getPage() !== ConfigHelper.getHHScriptVars("pagesIDPachinko"))
            {
                logHHAuto("Navigating to Pachinko window.");
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDPachinko"));
                return true;
            }
            else {
                logHHAuto("Detected Pachinko Screen. Fetching Pachinko, setting autoloop to false");
                setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
                logHHAuto('switch to ' + pachinkoType);
                const equipementSection = '#pachinko_whole .playing-zone';
                const freeButtonQuery = '#playzone-replace-info button[data-free="true"].blue_button_L';

                async function selectPachinko(pachinkoType:string)
                {
                    $('.game-simple-block[type-pachinko=' + pachinkoType + ']').trigger('click');
                    await TimeHelper.sleep(randomInterval(400,600));
                }
                await selectPachinko(pachinkoType);
                if ($(equipementSection).attr('type-panel') !== pachinkoType) {
                    logHHAuto(`Error pachinko ${pachinkoType} not loaded after click, retry`);
                    await selectPachinko(pachinkoType);
                }

                if ($(freeButtonQuery).length === 0)
                {
                    logHHAuto('Not ready yet');
                }
                else
                {
                    $(freeButtonQuery).trigger('click');
                }
                await TimeHelper.sleep(randomInterval(100, 200));

                var npach = $('.'+timerClass+' span[rel="expires"]').text();
                if(npach !== undefined && npach !== null && npach.length > 0)
                {
                    setTimer(pachinkoTimer,Number(convertTimeToInt(npach)) + randomInterval(1,5));
                }
                else
                {
                    logHHAuto("Unable to find "+pachinkoType+" Pachinko time, wait 4h.");
                    setTimer(pachinkoTimer, ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(1,10));
                }

                setTimeout( function() {
                    RewardHelper.closeRewardPopupIfAny();
                    setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "true");
                    logHHAuto("setting autoloop to true");
                    if (autoLoopKick) setTimeout(autoLoopKick,randomInterval(500,800));
                },randomInterval(300,600));
            }
            return true;
        }
        catch (ex) {
            logHHAuto("Catched error : Could not collect "+pachinkoType+" Pachinko... " + ex);
            setTimer(pachinkoTimer, ConfigHelper.getHHScriptVars("maxCollectionDelay") + randomInterval(1,10));
            return false;
        }
    }

    static getNumberOfGirlToWinPatchinko() {
        const girlsRewards = $("div.playing-zone .game-rewards .list-prizes .girl_shards");
        let numberOfGirlsToWin = 0;
        if (girlsRewards.length > 0) {
            try {
                numberOfGirlsToWin = safeJsonParse(girlsRewards.attr("data-rewards"), []).length;
            } catch (exp) { logHHAuto('Could not count pachinko girls to win: ' + exp); }
        }
        return numberOfGirlsToWin;
    }
    
    static getNumberOfOrbsLeft(buttonSelector: string): number {
        let orbsLeft = 0;
        if ($(buttonSelector + " span[total_orbs]").length > 0) {
            orbsLeft = Number($(buttonSelector + " span[total_orbs]").first().text());
        }
        if (isNaN(orbsLeft)) {
            orbsLeft = 0;
            logHHAuto("ERROR getting orbs left");
        }
        return orbsLeft;
    }

    static buildPachinkoSelectPopUp(orbsPlayed: number = -1) {
        Pachinko.autoPachinkoRunning = false;
        if (Pachinko.failureTimeoutId) clearTimeout(Pachinko.failureTimeoutId); // cancel safe mode
        const PachinkoMenu = '<div style="padding:50px; display:flex;flex-direction:column;font-size:15px;" class="HHAutoScriptMenu">'
            + '<div style="display:flex;flex-direction:row">'
            + '<div style="padding:10px" class="tooltipHH"><span class="tooltipHHtext">' + getTextForUI("PachinkoSelector", "tooltip") + '</span><select id="PachinkoSelector"></select></div>'
            + '<div style="padding:10px" class="tooltipHH"><span class="tooltipHHtext">' + getTextForUI("PachinkoLeft", "tooltip") + '</span><span id="PachinkoLeft"></span></div>'
            + '</div>'
            + '<div class="rowLine">'
            + '<p id="girls_to_win"></p>'
            + '</div>'
            + '<div class="rowLine">'
            + hhMenuSwitch('PachinkoFillOrbs')
            + hhMenuSwitch('PachinkoByPassNoGirls')
            + hhMenuSwitch('PachinkoStopFirstGirl')
            + '</div>'
            + '<div class="rowLine">'
            + '<div style="padding:10px;" class="tooltipHH"><span class="tooltipHHtext">' + getTextForUI("PachinkoXTimes", "tooltip") + '</span><input id="PachinkoXTimes" style="width:50px;height:20px" required pattern="' + HHAuto_inputPattern.menuExpLevel + '" type="text" value="1"></div>'
            + '</div>'
            + '<div class="rowLine">'
            + '<div style="padding:10px;width:50%" class="tooltipHH"><span class="tooltipHHtext">' + getTextForUI("Launch", "tooltip") + '</span><label class="myButton" id="PachinkoPlayX" style="font-size:15px; width:100%;text-align:center">' + getTextForUI("Launch", "elementText") + '</label></div>'
            + '</div>'
            + '<p style="color: red;" id="PachinkoError"></p>'
            + `<p id="PachinkoOrbsSpent">${orbsPlayed >= 0 ? getTextForUI("PachinkoOrbsSpent", "elementText") + ' ' + orbsPlayed : ''}</p>`
            + '</div>'
        fillHHPopUp("PachinkoMenu", getTextForUI("PachinkoButton", "elementText"), PachinkoMenu);

        function updateOrbsNumber(orbsLeft: JQuery<HTMLElement>) {
            const fillAllOrbs = (<HTMLInputElement>document.getElementById("PachinkoFillOrbs")).checked;

            if (fillAllOrbs && orbsLeft.length > 0) {
                (<HTMLInputElement>document.getElementById("PachinkoXTimes")).value = orbsLeft[0].innerText;
            }
            else {
                (<HTMLInputElement>document.getElementById("PachinkoXTimes")).value = '1';
            }
        }

        $("#PachinkoPlayX").on("click", Pachinko.pachinkoPlayXTimes);
        $(document).on('change', "#PachinkoSelector", function () {
            const pachinkoSelector: HTMLSelectElement = <HTMLSelectElement>document.getElementById("PachinkoSelector");
            const selectorText = pachinkoSelector.options[pachinkoSelector.selectedIndex].text;
            if (selectorText === getTextForUI("PachinkoSelectorNoButtons", "elementText")) {
                $("#PachinkoLeft").text("");
                return;
            }
            const orbsLeft = $("div.playing-zone div.btns-section button.blue_button_L[orb_name=" + pachinkoSelector.options[pachinkoSelector.selectedIndex].value + "] span[total_orbs]");

            if (orbsLeft.length > 0) {
                $("#PachinkoLeft").text(orbsLeft[0].innerText + getTextForUI("PachinkoOrbsLeft", "elementText"));
            }
            else {
                $("#PachinkoLeft").text('0');
            }
            updateOrbsNumber(orbsLeft);
        });
        $(document).on('change', "#PachinkoFillOrbs", function () {
            const timerSelector = <HTMLSelectElement>document.getElementById("PachinkoSelector");
            const orbsLeft = $("div.playing-zone div.btns-section button.blue_button_L[orb_name=" + timerSelector.options[timerSelector.selectedIndex].value + "] span[total_orbs]");

            updateOrbsNumber(orbsLeft);
        });

        // Add options //changed
        const pachinkoOptions = <HTMLSelectElement>document.getElementById("PachinkoSelector");
        let countTimers = 0;
        const pachinkoTypeEl = $("div.playing-zone #playzone-replace-info div.cover h2")[0];
        const PachinkoType = pachinkoTypeEl ? pachinkoTypeEl.innerText : '';

        $("div.playing-zone div.btns-section button.blue_button_L").each(function () {
            const optionElement = <HTMLOptionElement>document.createElement("option");
            const orbName = $(this).attr('orb_name') || '';
            optionElement.value = orbName;
            countTimers++;
            optionElement.text = `${PachinkoType} x${Pachinko.getHumanPachinkoFromOrbName(orbName)}`;
            pachinkoOptions.add(optionElement);

            if (countTimers === 1) {
                const orbsLeft = $("div.playing-zone div.btns-section button.blue_button_L[orb_name=" + orbName + "] span[total_orbs]")[0];
                if (orbsLeft) $("#PachinkoLeft").text(orbsLeft.innerText + getTextForUI("PachinkoOrbsLeft", "elementText"));
            }
        });

        const numberOfGirlsToWin = Pachinko.getNumberOfGirlToWinPatchinko();
        $("#girls_to_win").text(numberOfGirlsToWin + " girls to win"); // TODO translate
        $('#PachinkoStopFirstGirl').parent().parent().parent().toggle(numberOfGirlsToWin > 0);


        if (countTimers === 0) {
            const optionElement = <HTMLOptionElement>document.createElement("option");
            optionElement.value = countTimers + '';
            optionElement.text = getTextForUI("PachinkoSelectorNoButtons", "elementText");
            pachinkoOptions.add(optionElement);
        }
    }

    static modulePachinko() {
        Pachinko.debugEnabled = getStoredValue(HHStoredVarPrefixKey + TK.Debug) === 'true';
        const menuID = "PachinkoButton";
        const PachinkoButton = '<div style="position: absolute;left: 52%;top: 100px;width:60px;z-index:10" class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("PachinkoButton","tooltip")+'</span><label style="font-size:small" class="myButton" id="PachinkoButton">'+getTextForUI("PachinkoButton","elementText")+'</label></div>'
    
        if (document.getElementById(menuID) === null)
        {
            $("#contains_all section").prepend(PachinkoButton);
            $("#PachinkoButton").on("click", () => { Pachinko.buildPachinkoSelectPopUp(-1)});
            GM_registerMenuCommand(getTextForUI(menuID, "elementText"), () => { Pachinko.buildPachinkoSelectPopUp(-1) });
        }
        else
        {
            return;
        }
    
    }

    static getSelectedOptionButtonSelector() {
        const selectedOption = Pachinko.pachinkoSelector!.options[Pachinko.pachinkoSelector!.selectedIndex];
        return "div.playing-zone div.btns-section button.blue_button_L[orb_name=" + selectedOption.value + "]";
    }

    static pachinkoPlayXTimes() {
        setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
        logHHAuto("setting autoloop to false");
        Pachinko.pachinkoSelector = <HTMLSelectElement>document.getElementById("PachinkoSelector");
        Pachinko.ByPassNoGirlChecked = (<HTMLInputElement>document.getElementById("PachinkoByPassNoGirls")).checked;
        Pachinko.stopFirstGirlChecked = (<HTMLInputElement>document.getElementById("PachinkoStopFirstGirl")).checked;
        const selectedOption = Pachinko.pachinkoSelector.options[Pachinko.pachinkoSelector.selectedIndex];
        const buttonSelector = Pachinko.getSelectedOptionButtonSelector();
        Pachinko.orbsToGo = Number((<HTMLInputElement>document.getElementById("PachinkoXTimes")).value);

        Pachinko.orbLeftOnAutoStart = Pachinko.getNumberOfOrbsLeft(buttonSelector);
        if (Pachinko.orbLeftOnAutoStart <= 0) {
            logHHAuto('No Orbs left for : ' + selectedOption.text);
            $("#PachinkoError").text(getTextForUI("PachinkoSelectorNoButtons", "elementText"));
            return;
        }

        if (Number.isNaN(Number(Pachinko.orbsToGo)) || Pachinko.orbsToGo < 1 || Pachinko.orbsToGo > Pachinko.orbLeftOnAutoStart) {
            logHHAuto('Invalid orbs number ' + Pachinko.orbsToGo);
            $("#PachinkoError").text(getTextForUI("PachinkoInvalidOrbsNb", "elementText") + " : " + Pachinko.orbsToGo);
            return;
        }
        const PachinkoPlay = '<div style="padding:20px 50px; display:flex;flex-direction:column">'
            + '<p>' + selectedOption.text + ' : </p>'
            + '<p id="PachinkoPlayedTimes" style="padding:0 10px">0/' + Pachinko.orbsToGo + '</p>'
            + '<label style="width:80px" class="myButton" id="PachinkoPlayCancel">' + getTextForUI("OptionCancel", "elementText") + '</label>'
            + '</div>';
        fillHHPopUp("PachinkoPlay", getTextForUI("PachinkoButton", "elementText"), PachinkoPlay);
        $("#PachinkoPlayCancel").on("click", () => {
            maskHHPopUp();
            logHHAuto("Cancel clicked, closing popUp.");
            Pachinko.autoPachinkoRunning = false;
            if (Pachinko.failureTimeoutId) clearTimeout(Pachinko.failureTimeoutId); // cancel safe mode
        });

        if (!Pachinko.ajaxBindingDone) {
            Pachinko.bindPachinkoAjaxReturn();
        }

        // Reset per-run state so the run is self-contained: no stale server count
        // from a previous run, and a fresh retry budget.
        Pachinko.serverOrbsLeft = undefined;
        Pachinko.retry = 0;
        logHHAuto(`Pachinko run starting: ${selectedOption.text}, target ${Pachinko.orbsToGo}, available ${Pachinko.orbLeftOnAutoStart}.`);

        Pachinko.autoPachinkoRunning = true;
        setTimeout(Pachinko.playXPachinko_func, randomInterval(500, 1500));
    }
    
    static stopXPachinkoNoGirl() {
        logHHAuto("No more girl on Pachinko, cancelling.");
        maskHHPopUp();
        Pachinko.buildPachinkoSelectPopUp();
        $("#PachinkoError").text(getTextForUI("PachinkoNoGirls", "elementText"));
    }
    static stopXPachinkoFailure() {
        if (Pachinko.retry <= 2) {
            logHHAuto("Pachinko failure, retry once.");
            Pachinko.retry++;
            setTimeout(Pachinko.playXPachinko_func, randomInterval(100, 300));
        } else {
            logHHAuto("Pachinko failure, cancelling.");
            maskHHPopUp();
            Pachinko.buildPachinkoSelectPopUp();
            $("#PachinkoError").text(getTextForUI("PachinkoFailure", "elementText"));
        }
    }

    static async playXPachinko_func() {
        const buttonSelector = Pachinko.getSelectedOptionButtonSelector();
        const buttonContinueSelector = '.popup_buttons #play_again:visible';
        if (!isDisplayedHHPopUp()) {
            Pachinko.autoPachinkoRunning = false;
            logHHAuto("PopUp closed, cancelling interval, restart autoloop.");
            setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "true");
            if (autoLoopKick) setTimeout(autoLoopKick, Number(getStoredValue(HHStoredVarPrefixKey + TK.autoLoopTimeMili)));
            return;
        }
        const confirmPachinko = document.getElementById("confirm_pachinko");
        if (confirmPachinko !== null) {
            if (Pachinko.ByPassNoGirlChecked && confirmPachinko.querySelector("#popup_confirm.blue_button_L") !== null) {
                (<HTMLElement>confirmPachinko.querySelector("#popup_confirm.blue_button_L")).click();
                logHHAuto('By pass no girl popup closed');
            }
            else {
                Pachinko.stopXPachinkoNoGirl();
                return;
            }
        }

        const domOrbsLeft = Pachinko.getNumberOfOrbsLeft(buttonSelector);
        // Prefer the server-reported remaining count over the DOM. The DOM value
        // (span[total_orbs]) can lag behind the server during fast runs, which made
        // the run continue past orbsToGo and over-consume orbs (issue 1745).
        const currentOrbsLeft = Pachinko.resolveStopOrbsLeft(Pachinko.serverOrbsLeft, domOrbsLeft);
        const spendedOrbs = Number(Pachinko.orbLeftOnAutoStart - currentOrbsLeft);
        if (Pachinko.debugEnabled) logHHAuto(`Pachinko progress: spent ${spendedOrbs}/${Pachinko.orbsToGo} (orbsLeft server=${Pachinko.serverOrbsLeft ?? 'n/a'} dom=${domOrbsLeft}).`);
        if (Pachinko.stopFirstGirlChecked && $('#rewards_popup #reward_holder .shards_wrapper:visible').length > 0) {
            logHHAuto("Girl in reward, stopping...");
            maskHHPopUp();
            Pachinko.buildPachinkoSelectPopUp(spendedOrbs);
            return;
        }
        const pachinkoSelectedButton = $(buttonSelector)[0];
        const continuePachinkoSelectedButton = $(buttonContinueSelector);
        $("#PachinkoPlayedTimes").text(spendedOrbs + "/" + Pachinko.orbsToGo);
        if (Pachinko.shouldContinuePachinkoRun(Pachinko.orbLeftOnAutoStart, currentOrbsLeft, Pachinko.orbsToGo)) {
            if (continuePachinkoSelectedButton.length > 0) {
                continuePachinkoSelectedButton.trigger('click');
            }
            else {
                // Close any reward popup before the next pull. When a girl is won the
                // game shows a popup whose purple Claim button (#ok_button_pachinko)
                // can appear a moment after the popup opens. The previous single-shot
                // check raced that animation: if the button was not yet :visible the
                // popup stayed open and the run hung (issue 1745). Poll briefly instead.
                await Pachinko.closePachinkoRewardPopup();
                pachinkoSelectedButton.click();

                Pachinko.failureTimeoutId = setTimeout(() => {
                    // Safe mode
                    logHHAuto("ERROR: No reply from server after more than 5s.");
                    Pachinko.stopXPachinkoFailure();
                }, randomInterval(5000, 8000));

                // Nothing to do here, will be done by ajaxComplete handler above.
            }
        }
        else {
            RewardHelper.closeRewardPopupIfAny(false);
            logHHAuto(`Pachinko run finished: spent ${spendedOrbs}/${Pachinko.orbsToGo} orbs, ${currentOrbsLeft} left.`);
            maskHHPopUp();
            Pachinko.buildPachinkoSelectPopUp(spendedOrbs);
            return;
        }
    }

    static bindPachinkoAjaxReturn() {
        Pachinko.ajaxBindingDone = true;
        $(document).ajaxComplete(function (evt, xhr, opt) {
            if (!opt.data) return;
            if (!xhr.responseText.length) return;

            const searchParams = new URLSearchParams(opt.data)
            if (searchParams.get('action') === 'play' && searchParams.get('class') === 'Pachinko') {

                const response = safeJsonParse<any>(xhr.responseText, null);

                if (!response || !response.success) {
                    if (Pachinko.debugEnabled) logHHAuto("Not response success");
                    Pachinko.stopXPachinkoFailure();
                    return;
                }

                const orbs = response.rewards?.heroChangesUpdate?.orbs;
                if (orbs) {
                    // The play-response carries the authoritative remaining count for
                    // the selected orb type (e.g. orbs.o_g10). Capture it so the stop
                    // logic no longer depends on the lag-prone DOM counter (issue 1745).
                    const selectedOrbName = Pachinko.getSelectedOrbName();
                    const remaining = orbs[selectedOrbName];
                    if (typeof remaining === 'number') {
                        Pachinko.serverOrbsLeft = remaining;
                    }
                    if (Pachinko.failureTimeoutId) clearTimeout(Pachinko.failureTimeoutId); // cancel safe mode
                    if (Pachinko.autoPachinkoRunning) {
                        setTimeout(Pachinko.playXPachinko_func, randomInterval(200, 500));
                    } else if (Pachinko.debugEnabled) {
                        logHHAuto('Ajax catched, do nothing');
                    }
                }
                else Pachinko.stopXPachinkoFailure();
            }
        });
    }

    // Resolves the orb_name of the currently selected pachinko option (e.g. "o_g10").
    // Used to read the matching remaining count from the server play-response.
    static getSelectedOrbName(): string {
        try {
            if (!Pachinko.pachinkoSelector) return 'unknown';
            const opt = Pachinko.pachinkoSelector.options[Pachinko.pachinkoSelector.selectedIndex];
            return opt?.value ?? 'unknown';
        } catch {
            return 'unknown';
        }
    }

    // Closes any reward popup shown between pulls (a normal reward, or the
    // popup shown after winning a girl). The won-girl popup exposes a blue
    // "redirect-to-harem" button; the actual dismiss action is the purple Claim
    // button (#ok_button_pachinko) inside #rewards_popup, which can become
    // :visible a moment after the popup opens. RewardHelper.closeRewardPopupIfAny
    // checks once and returns false while the button is still animating in, which
    // left the run hanging (issue 1745). This retries for a short window: each
    // iteration delegates to the shared close helpers, and only keeps waiting
    // while a popup is actually open but not yet closeable.
    static async closePachinkoRewardPopup(maxWaitMs: number = 3000): Promise<void> {
        const popupButtonsVisible = () =>
            $('#rewards_popup button.blue_button_L:visible, #rewards_popup button.purple_button_L:visible').length > 0;
        const deadline = Date.now() + maxWaitMs;
        while (true) {
            if (RewardHelper.closeRewardPopupIfAny(false)) {
                // A reward (or the girl redirect) was handled. A girl popup can
                // follow a normal reward, so give it a moment and claim it too.
                await TimeHelper.sleep(randomInterval(500, 1000));
                RewardHelper.closeGirlRewardPopupIfAny(true);
                return;
            }
            // Nothing was closeable this tick. Either there is no popup (the common
            // case, proceed immediately) or a won-girl popup is still animating in
            // and its purple Claim button is not :visible yet (the race).
            if (!popupButtonsVisible() || Date.now() >= deadline) {
                return;
            }
            await TimeHelper.sleep(randomInterval(150, 300));
        }
    }

    // Chooses which remaining-orb count drives the stop decision. The server value
    // (from the play-response) is authoritative and lag-free; the DOM value is only
    // a fallback for the first tick (before any pull) or when the server key is
    // missing. See issue 1745 for the over-consumption this prevents.
    static resolveStopOrbsLeft(serverOrbsLeft: number | undefined, domOrbsLeft: number): number {
        if (typeof serverOrbsLeft === 'number' && serverOrbsLeft >= 0) {
            return serverOrbsLeft;
        }
        return domOrbsLeft;
    }

    // Decides whether the X-times pachinko run should fire another pull. Pure
    // counterpart to the stop logic in playXPachinko_func (issue 1745): the run
    // continues only while fewer than orbsToGo orbs have been spent AND at least
    // one orb remains. currentOrbsLeft is the resolveStopOrbsLeft() result
    // (server-authoritative when available). Extracted to unit-test the
    // over-consumption boundary (Pachinko review I4, Option A).
    static shouldContinuePachinkoRun(orbLeftOnAutoStart: number, currentOrbsLeft: number, orbsToGo: number): boolean {
        const spendedOrbs = Number(orbLeftOnAutoStart - currentOrbsLeft);
        return spendedOrbs < orbsToGo && currentOrbsLeft > 0;
    }

    static getHumanPachinkoFromOrbName(orb_name: string): string
    {
        switch (orb_name) {
            case 'o_v4': return '4';
            case 'o_e1':
            case 'o_eq1':
            case 'o_g1':
            case 'o_m1': return '1';
            case 'o_eq2': return '2';
            case 'o_m3': return '3';
            case 'o_m6': return '6';
            case 'o_eq10':
            case 'o_g10':
            case 'o_e10': return '10';
            case 'o_ed': return 'Draft';
            default: return 'Unknown';
        }
    }
}