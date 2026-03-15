// HaremSalary.ts -- Salary collection: auto-collects earnings from harem girls.
//
// Harem girls generate soft currency (salary) over time. This module
// periodically navigates to the harem page and collects accumulated salary
// earnings, tracking collection timers to avoid unnecessary page loads.
//
// Used by: Service/index.ts (main automation loop)
//
import {
    ConfigHelper,
    getPage,
    getStoredValue,
    setTimer,
    randomInterval,
    getHHVars,
    TimeHelper
} from '../../Helper/index';
import { logHHAuto } from '../../Utils/index';
import { HHStoredVarPrefixKey, SK, TK } from '../../config/index';

export class HaremSalary {
    static getSalaryButton() {
        return $("#collect_all_container button[id='collect_all']");
    }

    static getSalarySumTag(): number {
        const salaryButton = HaremSalary.getSalaryButton();
        let salarySumTag = NaN;
        if (getPage() === ConfigHelper.getHHScriptVars("pagesIDHarem")) {
            salarySumTag = Number($('[rel="next_salary"]', salaryButton)[0].innerText.replace(/[^0-9]/gi, ''));
        }
        else if (getPage() === ConfigHelper.getHHScriptVars("pagesIDHome")) {
            salarySumTag = Number(getHHVars("salary_collect"));
        }
        return salarySumTag;
    }

    static async getSalary(): Promise<boolean> {
        try {
            if(getPage() === ConfigHelper.getHHScriptVars("pagesIDHome"))
            {
                const salaryButton = HaremSalary.getSalaryButton();
                const salaryToCollect = !(salaryButton.prop('disabled') || salaryButton.attr("style")==="display: none;");
                if (!salaryToCollect) {
                    //logHHAuto("No salary to collect");
                    setTimer('nextSalaryTime', randomInterval(60, 180));
                }
                else
                {
                    const salarySumTag = HaremSalary.getSalarySumTag();
                    const enoughSalaryToCollect = Number.isNaN(salarySumTag) ? true : salarySumTag > Number(getStoredValue(HHStoredVarPrefixKey + SK.autoSalaryMinSalary) || 20000);
                    if (enoughSalaryToCollect) {
                        const getButtonClass: string = salaryButton.attr("class") || '';
                        if (getButtonClass.indexOf("blue_button_L") !== -1 || getButtonClass.indexOf("round_blue_button") !== -1)
                        {
                            logHHAuto('Collected all salary');
                            salaryButton.trigger('click');
                            await TimeHelper.sleep(randomInterval(200, 400));

                            setTimer('nextSalaryTime', randomInterval(60, 180));
                            return false;
                        }
                        else
                        {
                            logHHAuto("Unknown salary button color : "+getButtonClass);
                            setTimer('nextSalaryTime', randomInterval(60, 180));
                        }
                    }
                    else 
                    {
                        logHHAuto("Not enough salary to collect, wait");
                        setTimer('nextSalaryTime', randomInterval(60, 180));
                    }
                }
            }
        }
        catch (ex) {
            logHHAuto("Catched error : Could not collect salary... " + ex);
            setTimer('nextSalaryTime', randomInterval(60, 180));
            // return not busy
            return false;
        }
        return false;
    }
}