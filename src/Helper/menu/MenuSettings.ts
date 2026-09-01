// MenuSettings.ts
//
// Settings binding: moves values between the DOM menu inputs and persistent
// storage. `setMenuValues` writes stored settings into the inputs, `getMenuValues`
// reads inputs back into storage, and `addEventsOnMenuItems` wires the change/keyup
// listeners declared on each HHStoredVars entry. `preventKobanUsingSwitchUnauthorized`
// is the guard used by koban-spending toggles.
//
// Split out of HHMenuHelper as part of WART-002 (behavior-neutral). Reads its
// SCC-bound dependencies (storage, HHStoredVars, popup/default helpers) from
// MenuPorts so this file stays a graph leaf (see MenuPorts.ts). NumberHelper is
// a dependency-free leaf module, so it is imported directly.

import { NumberHelper, add1000sSeparator1 } from "../NumberHelper";
import { MenuPorts } from "./MenuPorts";

export function setMenuValues()
{
    const { setDefaults, getStorageItem, HHStoredVars, storedVarPrefix, logHHAuto } = MenuPorts;
    if (document.getElementById("sMenu") === null)
    {
        return;
    }
    setDefaults();

    for (const i of Object.keys(HHStoredVars))
    {
        if (HHStoredVars[i].storage !== undefined && HHStoredVars[i].HHType !== undefined)
        {
            const storageItem = getStorageItem(HHStoredVars[i].storage);
            const menuID:string = HHStoredVars[i].customMenuID !== undefined?HHStoredVars[i].customMenuID:i.replace(storedVarPrefix+HHStoredVars[i].HHType+"_","");
            const menuElement = document.getElementById(menuID);
            if (
                HHStoredVars[i].setMenu !== undefined
                && storageItem[i] !== undefined
                && HHStoredVars[i].setMenu
                && HHStoredVars[i].valueType !== undefined
                && HHStoredVars[i].menuType !== undefined
                && menuElement != null
            )
            {
                let itemValue = storageItem[i];
                switch (HHStoredVars[i].valueType)
                {
                    case "Long Integer":
                        itemValue = NumberHelper.add1000sSeparator(itemValue);
                        break;
                    case "Boolean":
                        itemValue = itemValue === "true";
                        break;
                }
                (menuElement as any)[HHStoredVars[i].menuType] = itemValue;
            }
        }
        else
        {
            logHHAuto("HHStoredVar "+i+" has no storage or type defined.");
        }
    }
}


export function getMenuValues()
{
    const { setDefaults, getStorageItem, HHStoredVars, storedVarPrefix, logHHAuto, isDisplayedHHPopUp } = MenuPorts;
    if (document.getElementById("sMenu") === null)
    {
        return;
    }
    if (isDisplayedHHPopUp() === 'loadConfig') {return}

    for (const i of Object.keys(HHStoredVars))
    {
        if (HHStoredVars[i].storage !== undefined && HHStoredVars[i].HHType !== undefined)
        {
            const storageItem = getStorageItem(HHStoredVars[i].storage);
            const menuID = HHStoredVars[i].customMenuID !== undefined?HHStoredVars[i].customMenuID:i.replace(storedVarPrefix+HHStoredVars[i].HHType+"_","");
            const menuElement = document.getElementById(menuID);
            if (
                HHStoredVars[i].getMenu !== undefined
                && document.getElementById(menuID) !== null
                && HHStoredVars[i].getMenu
                && HHStoredVars[i].valueType !== undefined
                && HHStoredVars[i].menuType !== undefined
                && menuElement != null
            )
            {
                const currentValue = storageItem[i];
                let menuValue = String((menuElement as any)[HHStoredVars[i].menuType]);
                switch (HHStoredVars[i].valueType)
                {
                    case "Long Integer":
                        menuValue = String(NumberHelper.remove1000sSeparator(menuValue));
                        break;
                }
                storageItem[i] = menuValue;
                if (currentValue !== menuValue && HHStoredVars[i].newValueFunction !== undefined)
                {
                    HHStoredVars[i].newValueFunction.apply();
                }
            }
        }
        else
        {
            logHHAuto("HHStoredVar "+i+" has no storage or type defined.");
        }
    }
    setDefaults();
}


export function preventKobanUsingSwitchUnauthorized(this: any)
{

    if (this.checked && !(<HTMLInputElement>document.getElementById("spendKobans0")).checked)
    {
        const idToDisable = this.id;
        setTimeout(function(){(<HTMLInputElement>document.getElementById(idToDisable)).checked = false;},500);
    }
}

export function addEventsOnMenuItems()
{
    const { HHStoredVars, storedVarPrefix, setStoredValue } = MenuPorts;
    for (const i of Object.keys(HHStoredVars))
    {
        if (HHStoredVars[i].HHType !== undefined )
        {
            const menuID = HHStoredVars[i].customMenuID !== undefined?HHStoredVars[i].customMenuID:i.replace(storedVarPrefix+HHStoredVars[i].HHType+"_","");
            const menuElement = document.getElementById(menuID);
            if(menuElement != null) {
                if ( HHStoredVars[i].valueType === "Long Integer")
                {
                    menuElement.addEventListener("keyup",add1000sSeparator1);
                }
                if (HHStoredVars[i].events !== undefined )
                {
                    for (const event of Object.keys(HHStoredVars[i].events))
                    {
                        menuElement.addEventListener(event,HHStoredVars[i].events[event]);
                    }
                }
                if (HHStoredVars[i].kobanUsing !== undefined && HHStoredVars[i].kobanUsing)
                {
                    menuElement.addEventListener("change", preventKobanUsingSwitchUnauthorized);
                }
                if (HHStoredVars[i].menuType !== undefined && HHStoredVars[i].menuType === "checked")
                {
                    menuElement.addEventListener("change",function ()
                                                                    {
                        if (HHStoredVars[i].newValueFunction !== undefined)
                        {
                            HHStoredVars[i].newValueFunction.apply();
                        }
                        setStoredValue(i,(<HTMLInputElement>this).checked)
                    });
                }
            }
        }
    }
}
