// StorageHelper.ts
//
// Abstraction layer over browser localStorage and sessionStorage for
// persisting all HHAuto settings and temporary state. Every stored
// variable is registered in HHStoredVars (config/HHStoredVars.ts) with
// a storage type, default value, and optional validation regex.
//
// IMPORTANT: getStoredValue / setStoredValue / deleteStoredValue ONLY
// work for keys that are registered in HHStoredVars. Unregistered keys
// are silently dropped on write and return undefined on read — no error,
// no log, just a no-op. When adding a new SK/TK entry in StorageKeys.ts,
// you MUST also register it in HHStoredVars.ts (with its storage type
// "localStorage" | "sessionStorage" | "Storage()" and HHType
// "Setting" | "Temp"), otherwise nothing will be persisted.
//
// Key design decisions:
//   - Settings use localStorage (survive tab close); temp vars use
//     sessionStorage (reset per session) unless the user enables
//     per-tab isolation (settPerTab), which puts everything in session.
//   - All keys are prefixed (HHStoredVarPrefixKey) to avoid collisions
//     with game data in the same storage.
//   - Write errors (storage full) trigger a log cleanup and one retry.
//   - Migration logic (migrateHHVars) handles key prefix changes
//     between script versions.
//
// Also provides export/import of settings as JSON files and a popup
// for selecting which reward types to auto-collect.
//
// Used by: Every module and helper in the project.

import { setDefaults } from '../Service/index';
import { cleanLogsInStorage, fillHHPopUp, isJSON, logHHAuto, safeJsonParse } from '../Utils/index';
import { HHStoredVarPrefixKey, HHStoredVars, SK, TK } from '../config/index';
import { ConfigHelper } from "./ConfigHelper";
import { getMenuValues } from "./HHMenuHelper";
import { getTextForUI } from "./LanguageHelper";

export function getStoredJSON<T>(key: string, defaultValue: T, reviver?: (key: string, value: any) => any): T {
    const val = getStoredValue(key);
    if (val === undefined || val === null) return defaultValue;
    return safeJsonParse(val, defaultValue, reviver);
}

export function getStorage()
{
    return getStoredValue(HHStoredVarPrefixKey+SK.settPerTab) === "true"?sessionStorage:localStorage;
}

export function getStoredValue(inVarName: string)
{
    if (HHStoredVars.hasOwnProperty(inVarName))
    {
        const storedValue = getStorageItem(HHStoredVars[inVarName].storage)[inVarName];
        if(HHStoredVars[inVarName].kobanUsing) {
            // Check main switch for spenind Koban
            return getStoredValue(HHStoredVarPrefixKey+'Setting_spendKobans0') === "true" ? storedValue : "false";
        }
        return storedValue
    }
    return undefined;
}

export function deleteStoredValue(inVarName: string)
{
    if (HHStoredVars.hasOwnProperty(inVarName))
    {
        getStorageItem(HHStoredVars[inVarName].storage).removeItem(inVarName);
    }
}

export function setStoredValue(inVarName: string, inValue: any, retry: boolean=false)
{
    if (HHStoredVars.hasOwnProperty(inVarName))
    {
        try {
            getStorageItem(HHStoredVars[inVarName].storage)[inVarName] = inValue;
        } catch ({ errName, message }) {
            cleanLogsInStorage();
            logHHAuto(`ERROR: Can't save value in storage for ${inVarName} (${message}), ${retry?'user storage need to be cleaned':'retry...'}`);
            if (!retry) setStoredValue(inVarName, inValue, true);
        }
    }
}


export function extractHHVars(dataToSave,extractLog = false,extractTemp=true,extractSettings=true)
{
    let storageType;
    let storageName;
    let currentStorageName = getStoredValue(HHStoredVarPrefixKey+SK.settPerTab) ==="true"?"sessionStorage":"localStorage";
    let variableName;
    let storageItem;
    let varType;
    for (let i of Object.keys(HHStoredVars))
    {
        varType = HHStoredVars[i].HHType;
        if (varType === "Setting" && extractSettings || varType === "Temp" && extractTemp)
        {
            storageType = HHStoredVars[i].storage;
            variableName = i;
            storageName = storageType;
            storageItem = getStorageItem(storageType);
            if (storageType === 'Storage()')
            {
                storageName = currentStorageName;
            }
            if (variableName !== HHStoredVarPrefixKey + TK.Logging)
            {
                dataToSave[storageName+"."+variableName] = getStoredValue(variableName);
            }
        }
    }
    if (extractLog)
    {
        dataToSave[HHStoredVarPrefixKey+TK.Logging] = safeJsonParse(sessionStorage.getItem(HHStoredVarPrefixKey+'Temp_Logging'), {});
    }
    return dataToSave;
}

export function saveHHVarsSettingsAsJSON() {
    var dataToSave={};
    extractHHVars(dataToSave,false,false,true);
    var name='HH_SaveSettings_'+Date.now()+'.json';
    const a = document.createElement('a')
    a.download = name
    a.href = URL.createObjectURL(new Blob([JSON.stringify(dataToSave)], {type: 'application/json'}))
    a.click()
}

export function getStorageItem(inStorageType)
{
    switch (inStorageType)
    {
        case 'localStorage' :
            return localStorage;
            break;
        case 'sessionStorage' :
            return sessionStorage;
            break;
        case 'Storage()' :
            return getStorage();
            break;
    }
}

export function migrateHHVars()
{
    /*
    const varReplacement =
          [
              {from:"HHAuto_Setting_MaxAff", to:"HHAuto_Setting_maxAff"},
              {from:"HHAuto_Setting_MaxExp", to:"HHAuto_Setting_maxExp"},
              {from:"HHAuto_Setting_autoMissionC", to:"HHAuto_Setting_autoMissionCollect"},
          ];
    for(let replacement of varReplacement)
    {
        const oldVar = replacement.from;
        const newVar = replacement.to;
        if (sessionStorage[oldVar] !== undefined)
        {
            sessionStorage[newVar] = sessionStorage[oldVar];
            sessionStorage.removeItem(oldVar);
        }
        if (localStorage[oldVar] !== undefined)
        {
            localStorage[newVar] = localStorage[oldVar];
            localStorage.removeItem(oldVar);
        }
    }*/

    if(HHStoredVarPrefixKey !== 'HHAuto_' && haveHHAutoSettings()) {
        // Migrate from default to custom keys
        for (const newKey of Object.keys(HHStoredVars))
        {
            const oldKeys = newKey.replace(HHStoredVarPrefixKey,'HHAuto_');
            const storageItem = getStorageItem(HHStoredVars[newKey].storage);
            const itemValue = storageItem[oldKeys];

            storageItem.removeItem(oldKeys);
            if (itemValue) {
                setStoredValue(newKey, itemValue);
            }
        }
    }
}

function haveHHAutoSettings() {
    let have = false;
    have = have || Object.keys(localStorage).some((key) => key.startsWith("HHAuto_"));
    have = have || Object.keys(sessionStorage).some((key) => key.startsWith("HHAuto_"));
    return have;
}

export function getUserHHStoredVarDefault(inVarName)
{
    const currentDefaults = getStoredJSON(HHStoredVarPrefixKey+SK.saveDefaults, null);
    if (currentDefaults !== null && currentDefaults[inVarName] !== undefined)
    {
        return currentDefaults[inVarName];
    }
    return null;
}

export function saveHHStoredVarsDefaults()
{
    var dataToSave={};
    getMenuValues();
    extractHHVars(dataToSave,false,false,true);
    let savedHHStoredVars={};
    for(var i of Object.keys(dataToSave))
    {
        let variableName = i.split(".")[1];
        if (variableName !== HHStoredVarPrefixKey+SK.saveDefaults && HHStoredVars[variableName].default !== dataToSave[i])
        {
            savedHHStoredVars[variableName] = dataToSave[i];
        }
    }
    setStoredValue(HHStoredVarPrefixKey+SK.saveDefaults, JSON.stringify(savedHHStoredVars));
    logHHAuto("HHStoredVar defaults saved !");
}

export function setHHStoredVarToDefault(inVarName)
{
    if (HHStoredVars[inVarName] !== undefined)
    {
        if (HHStoredVars[inVarName].default !== undefined && HHStoredVars[inVarName].storage !== undefined)
        {
            let storageItem;
            storageItem = getStorageItem(HHStoredVars[inVarName].storage);

            let userDefinedDefault = getUserHHStoredVarDefault(inVarName);
            let isValid = HHStoredVars[inVarName].isValid===undefined?true:HHStoredVars[inVarName].isValid.test(userDefinedDefault);
            if (userDefinedDefault !== null && isValid)
            {
                logHHAuto("HHStoredVar "+inVarName+" set to user default value : "+userDefinedDefault);
                storageItem[inVarName] = userDefinedDefault;
            }
            else
            {
                logHHAuto("HHStoredVar "+inVarName+" set to default value : "+HHStoredVars[inVarName].default);
                storageItem[inVarName] = HHStoredVars[inVarName].default;
            }
        }
        else
        {
            logHHAuto("HHStoredVar "+inVarName+" either have no storage or default defined.");
        }
    }
    else
    {
        logHHAuto("HHStoredVar "+inVarName+" doesn't exist.");
    }
}

export function getHHStoredVarDefault(inVarName)
{
    if (HHStoredVars[inVarName] !== undefined)
    {
        if (HHStoredVars[inVarName].default !== undefined)
        {
            return HHStoredVars[inVarName].default;
        }
        else
        {
            logHHAuto("HHStoredVar "+inVarName+" have no default defined.");
        }
    }
    else
    {
        logHHAuto("HHStoredVar "+inVarName+" doesn't exist.");
    }
}

export function debugDeleteAllVars()
{
    Object.keys(localStorage).forEach((key) =>
                                      {
        if (key.startsWith(HHStoredVarPrefixKey+"Setting_"))
        {
            localStorage.removeItem(key);
        }
    });
    Object.keys(sessionStorage).forEach((key) =>
                                        {
        if (key.startsWith(HHStoredVarPrefixKey+"Setting_"))
        {
            sessionStorage.removeItem(key);
        }
    });
    Object.keys(localStorage).forEach((key) =>
                                      {
        if (key.startsWith(HHStoredVarPrefixKey+"Temp_"))
        {
            localStorage.removeItem(key);
        }
    });
    Object.keys(sessionStorage).forEach((key) =>
                                        {
        if (key.startsWith(HHStoredVarPrefixKey+"Temp_") && key !== HHStoredVarPrefixKey+TK.Logging)
        {
            sessionStorage.removeItem(key);
        }
    });
    logHHAuto('Deleted all script vars.');
}


export function debugDeleteTempVars()
{
    var dataToSave={};
    extractHHVars(dataToSave,false,false,true);
    var storageType;
    var variableName;
    var storageItem;

    debugDeleteAllVars();
    setDefaults(true);
    var keys=Object.keys(dataToSave);
    for(var i of keys)
    {
        storageType=i.split(".")[0];
        variableName=i.split(".")[1];
        storageItem = getStorageItem(storageType);
        logHHAuto(i+':'+ dataToSave[i]);
        storageItem[variableName] = dataToSave[i];
    }
}


export function getAndStoreCollectPreferences(inVarName, inPopUpText = getTextForUI("menuCollectableText","elementText"))
{
    createPopUpCollectables();
    function createPopUpCollectables()
    {
        let menuCollectables = '<div class="HHAutoScriptMenu" style="padding:10px; display:flex;flex-direction:column">'
        +    '<p>'+inPopUpText+'</p>'
        +    '<div style="display:flex;">'
        let count = 0;
        const possibleRewards = ConfigHelper.getHHScriptVars("possibleRewardsList");
        const rewardsToCollect = getStoredJSON(inVarName, []);
        for (let currentItem of Object.keys(possibleRewards))
        {
            //console.log(currentItem,possibleRewards[currentItem]);
            if (count === 4)
            {
                count = 0;
                menuCollectables+='</div>';
                menuCollectables+='<div style="display:flex;">';
            }
            const checkedBox = rewardsToCollect.includes(currentItem)?"checked":"";
            menuCollectables+='<div style="display:flex; width:25%">';
            menuCollectables+='<div class="labelAndButton" style=""><label class="switch"><input id="'+currentItem+'" class="menuCollectablesItem" type="checkbox" '+checkedBox+'><span class="slider round"></span></label><span class="HHMenuItemName">'+possibleRewards[currentItem]+'</span></div>'
            menuCollectables+='</div>';
            count++;
        }
        menuCollectables+='</div>';
        menuCollectables+='<div style="display:flex;">';
        menuCollectables+='<div style="display:flex;width:25%">';
        menuCollectables+='<div class="labelAndButton" style=""><span class="HHMenuItemName">Toggle All</span><label class="button">';
        menuCollectables+='<input id="toggleCollectables" class="menuCollectablesItem" type="button" value="Click!"';
        menuCollectables+='onclick="let allInputs = window.document.querySelectorAll(\'#HHAutoPopupGlobalPopup.menuCollectable .menuCollectablesItem\'); ';
        menuCollectables+='allInputs.forEach((currentInput) \=\> {currentInput.checked = !currentInput.checked;}); ';
        menuCollectables+='evt = document.createEvent(\'HTMLevents\'); evt.initEvent(\'change\',true,true); ';
        menuCollectables+='allInputs[0].dispatchEvent(evt);"><span class="button"></span></label></div>';
        menuCollectables +=    '</div>'
            +  '</div>';
        fillHHPopUp("menuCollectable",getTextForUI("menuCollectable","elementText"),menuCollectables);
        document.querySelectorAll("#HHAutoPopupGlobalPopup.menuCollectable .menuCollectablesItem").forEach(currentInput =>
                                                                                                           {
            currentInput.addEventListener("change",getSelectedCollectables);
        });
    }

    function getSelectedCollectables()
    {
        let collectablesList:string[] = [];
        document.querySelectorAll("#HHAutoPopupGlobalPopup.menuCollectable .menuCollectablesItem").forEach(currentInputElement =>
                                                                                                           {
            const currentInput = <HTMLInputElement> currentInputElement;
            if (currentInput.checked)
            {
                //console.log(currentInput.id);
                collectablesList.push(currentInput.id);
            }
        });
        setStoredValue(inVarName, JSON.stringify(collectablesList));
    }
}

export function getLocalStorageSize() {
    var allStrings = '';
    for (var key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            allStrings += localStorage[key];
        }
    }
    for (var key in sessionStorage) {
        if (sessionStorage.hasOwnProperty(key)) {
            allStrings += sessionStorage[key];
        }
    }
    return allStrings ? 3 + ((allStrings.length * 16) / (8 * 1024)) + ' KB' : 'Empty (0 KB)';
}