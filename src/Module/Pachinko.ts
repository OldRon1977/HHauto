// Pachinko.ts -- Automates free pachinko (gacha) pulls: regular, mythic, and equipment.
//
// Pachinko is the game's gacha system with free pulls on a timer. This module
// tracks cooldowns for each pachinko type (regular, mythic, equipment), navigates
// to the correct tab, and executes free pulls when available. Does not spend
// premium currency -- only claims free pulls.
//
// Used by: Service/index.ts (main automation loop)
//
import {
    RewardHelper,
    convertTimeToInt,
    ConfigHelper,
    getPage,
    getStoredValue,
    getTextForUI,
    hhMenuSwitch,
    randomInterval,
    setStoredValue,
    setTimer,
    TimeHelper
} from '../Helper/index';
import { autoLoop, gotoPage } from '../Service/index';
import { isDisplayedHHPopUp, fillHHPopUp, logHHAuto, maskHHPopUp, safeJsonParse } from '../Utils/index';
import { HHAuto_inputPattern, HHStoredVarPrefixKey, TK } from '../config/index';

export class Pachinko {
    static ajaxBindingDone = false;
    static orbLeftOnAutoStart = 0;
    static orbsToGo = 0;
    static autoPachinkoRunning = false;
    static failureTimeoutId = undefined;
    static pachinkoSelector = undefined;
    static ByPassNoGirlChecked: boolean;
    static stopFirstGirlChecked: boolean;
    static debugEnabled: boolean;
    static retry: number = 0;

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
                if ($(equipementSection).attr('type-panel') != pachinkoType) {
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
                    setTimeout(autoLoop,randomInterval(500,800));
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
            } catch (exp) { }
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
        let PachinkoMenu = '<div style="padding:50px; display:flex;flex-direction:column;font-size:15px;" class="HHAutoScriptMenu">'
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

        function updateOrbsNumber(orbsLeft) {
            let fillAllOrbs = (<HTMLInputElement>document.getElementById("PachinkoFillOrbs")).checked;

            if (fillAllOrbs && orbsLeft.length > 0) {
                (<HTMLInputElement>document.getElementById("PachinkoXTimes")).value = orbsLeft[0].innerText;
            }
            else {
                (<HTMLInputElement>document.getElementById("PachinkoXTimes")).value = '1';
            }
        }

        $("#PachinkoPlayX").on("click", Pachinko.pachinkoPlayXTimes);
        $(document).on('change', "#PachinkoSelector", function () {
            let pachinkoSelector: HTMLSelectElement = <HTMLSelectElement>document.getElementById("PachinkoSelector");
            let selectorText = pachinkoSelector.options[pachinkoSelector.selectedIndex].text;
            if (selectorText === getTextForUI("PachinkoSelectorNoButtons", "elementText")) {
                $("#PachinkoLeft").text("");
                return;
            }
            let orbsLeft = $("div.playing-zone div.btns-section button.blue_button_L[orb_name=" + pachinkoSelector.options[pachinkoSelector.selectedIndex].value + "] span[total_orbs]");

            if (orbsLeft.length > 0) {
                $("#PachinkoLeft").text(orbsLeft[0].innerText + getTextForUI("PachinkoOrbsLeft", "elementText"));
            }
            else {
                $("#PachinkoLeft").text('0');
            }
            updateOrbsNumber(orbsLeft);
        });
        $(document).on('change', "#PachinkoFillOrbs", function () {
            let timerSelector = <HTMLSelectElement>document.getElementById("PachinkoSelector");
            let orbsLeft = $("div.playing-zone div.btns-section button.blue_button_L[orb_name=" + timerSelector.options[timerSelector.selectedIndex].value + "] span[total_orbs]");

            updateOrbsNumber(orbsLeft);
        });

        // Add options //changed
        let pachinkoOptions = <HTMLSelectElement>document.getElementById("PachinkoSelector");
        let countTimers = 0;
        let PachinkoType = $("div.playing-zone #playzone-replace-info div.cover h2")[0].innerText;

        $("div.playing-zone div.btns-section button.blue_button_L").each(function () {
            let optionElement = <HTMLOptionElement>document.createElement("option");
            let orbName = $(this).attr('orb_name') || '';
            optionElement.value = orbName;
            countTimers++;
            optionElement.text = `${PachinkoType} x${Pachinko.getHumanPachinkoFromOrbName(orbName)}`;
            pachinkoOptions.add(optionElement);

            if (countTimers === 1) {
                let orbsLeft = $("div.playing-zone div.btns-section button.blue_button_L[orb_name=" + orbName + "] span[total_orbs]")[0];
                $("#PachinkoLeft").text(orbsLeft.innerText + getTextForUI("PachinkoOrbsLeft", "elementText"));
            }
        });

        let numberOfGirlsToWin = Pachinko.getNumberOfGirlToWinPatchinko();
        $("#girls_to_win").text(numberOfGirlsToWin + " girls to win"); // TODO translate
        $('#PachinkoStopFirstGirl').parent().parent().parent().toggle(numberOfGirlsToWin > 0);


        if (countTimers === 0) {
            let optionElement = <HTMLOptionElement>document.createElement("option");
            optionElement.value = countTimers + '';
            optionElement.text = getTextForUI("PachinkoSelectorNoButtons", "elementText");
            pachinkoOptions.add(optionElement);
        }
    }

    static modulePachinko() {
        Pachinko.debugEnabled = getStoredValue(HHStoredVarPrefixKey + TK.Debug) === 'true';
        const menuID = "PachinkoButton";
        let PachinkoButton = '<div style="position: absolute;left: 52%;top: 100px;width:60px;z-index:10" class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("PachinkoButton","tooltip")+'</span><label style="font-size:small" class="myButton" id="PachinkoButton">'+getTextForUI("PachinkoButton","elementText")+'</label></div>'
    
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
        const selectedOption = Pachinko.pachinkoSelector.options[Pachinko.pachinkoSelector.selectedIndex];
        return "div.playing-zone div.btns-section button.blue_button_L[orb_name=" + selectedOption.value + "]";
    }

    static pachinkoPlayXTimes() {
        setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
        logHHAuto("setting autoloop to false");
        Pachinko.pachinkoSelector = <HTMLSelectElement>document.getElementById("PachinkoSelector");
        Pachinko.ByPassNoGirlChecked = (<HTMLInputElement>document.getElementById("PachinkoByPassNoGirls")).checked;
        Pachinko.stopFirstGirlChecked = (<HTMLInputElement>document.getElementById("PachinkoStopFirstGirl")).checked;
        const selectedOption = Pachinko.pachinkoSelector.options[Pachinko.pachinkoSelector.selectedIndex];
        let buttonSelector = Pachinko.getSelectedOptionButtonSelector();
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
        let PachinkoPlay = '<div style="padding:20px 50px; display:flex;flex-direction:column">'
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
        let buttonSelector = Pachinko.getSelectedOptionButtonSelector();
        const buttonContinueSelector = '.popup_buttons #play_again:visible';
        if (!isDisplayedHHPopUp()) {
            Pachinko.autoPachinkoRunning = false;
            logHHAuto("PopUp closed, cancelling interval, restart autoloop.");
            setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "true");
            setTimeout(autoLoop, Number(getStoredValue(HHStoredVarPrefixKey + TK.autoLoopTimeMili)));
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

        const currentOrbsLeft = Pachinko.getNumberOfOrbsLeft(buttonSelector);
        const spendedOrbs = Number(Pachinko.orbLeftOnAutoStart - currentOrbsLeft);
        //if (debugEnabled) logHHAuto('orbsLeft: ' + Pachinko.orbLeftOnAutoStart + ", currentOrbsLeft: " + currentOrbsLeft + ', spendedOrbs: ' + spendedOrbs + '/orbsToGo: ' + orbsToGo);
        if (Pachinko.stopFirstGirlChecked && $('#rewards_popup #reward_holder .shards_wrapper:visible').length > 0) {
            logHHAuto("Girl in reward, stopping...");
            maskHHPopUp();
            Pachinko.buildPachinkoSelectPopUp(spendedOrbs);
            return;
        }
        const pachinkoSelectedButton = $(buttonSelector)[0];
        const continuePachinkoSelectedButton = $(buttonContinueSelector);
        $("#PachinkoPlayedTimes").text(spendedOrbs + "/" + Pachinko.orbsToGo);
        if (spendedOrbs < Pachinko.orbsToGo && currentOrbsLeft > 0) {
            if (continuePachinkoSelectedButton.length > 0) {
                continuePachinkoSelectedButton.trigger('click');
            }
            else {
                if(RewardHelper.closeRewardPopupIfAny(false)) {
                    await TimeHelper.sleep(randomInterval(500, 1000));
                    RewardHelper.closeGirlRewardPopupIfAny(true);
                }
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
            logHHAuto("All spent, going back to Selector.");
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
            if (searchParams.get('action') == 'play' && searchParams.get('class') == 'Pachinko') {

                const response = safeJsonParse(xhr.responseText, null);

                if (!response || !response.success) {
                    if (Pachinko.debugEnabled) logHHAuto("Not response success");
                    Pachinko.stopXPachinkoFailure();
                    return;
                }

                if (response.rewards?.heroChangesUpdate?.orbs) {
                    //const orbs = response.rewards?.heroChangesUpdate?.orbs;
                    // o_g10 / o_g1 / o_eq2
                    //const orbLeftFromResponse = orbs.o_g10;
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