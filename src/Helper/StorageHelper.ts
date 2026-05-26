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
// External callers MUST use getStoredValue / setStoredValue /
// deleteStoredValue / getStoredJSON. Direct access to localStorage or
// sessionStorage is reserved for the storage adapter itself, the
// ForbiddenBackoff backoff path (see _lessons/zirkulaerer-import-tdz-
// crash.md -- it must not import HHStoredVars to keep the dependency
// graph cycle-free), and game-side state that the script does not own
// (e.g. localStorage.sort_by, set by the game's harem UI). Anything
// else is a bypass that defeats the registry, kobanUsing master-switch,
// and quota-retry contracts.
//
// Used by: Every module and helper in the project.
import { setDefaults } from "../Service/StartService";
import { fillHHPopUp } from "../Utils/HHPopup";
import { cleanLogsInStorage, logHHAuto } from "../Utils/LogUtils";
import { safeJsonParse } from "../Utils/Utils";
import { HHStoredVarPrefixKey, HHStoredVars } from "../config/HHStoredVars";
import { SK, TK } from "../config/StorageKeys";
import { ConfigHelper } from "./ConfigHelper";
import { getMenuValues } from "./HHMenuHelper";
import { getTextForUI } from "./LanguageHelper";

export function getStoredJSON<T>(key: string, defaultValue: T, reviver?: (key: string, value: any) => any): T {
    const val = getStoredValue(key);
    if (val === undefined || val === null) return defaultValue;
    return safeJsonParse(val, defaultValue, reviver);
}

/**
 * Returns the active "default" storage based on the settPerTab toggle.
 * When settPerTab is "true", per-tab isolation is on: every Storage()
 * key lives in sessionStorage and is therefore tab-local.
 *
 * IMPORTANT side-effect of toggling settPerTab at runtime: existing
 * Storage()-typed values do NOT migrate between localStorage and
 * sessionStorage. Settings recorded under one mode become invisible
 * (defaults take over) when the user flips to the other mode and
 * reappear when they flip back. This is intentional -- per-tab mode
 * is supposed to start fresh -- but it is not currently surfaced to
 * the user in the menu UI.
 */
export function getStorage()
{
    return getStoredValue(HHStoredVarPrefixKey+SK.settPerTab) === "true" ? sessionStorage : localStorage;
}

export function getStoredValue(inVarName: string)
{
    if (!HHStoredVars.hasOwnProperty(inVarName)) return undefined;
    const storedValue = getStorageItem(HHStoredVars[inVarName].storage)[inVarName];
    if (!HHStoredVars[inVarName].kobanUsing) return storedValue;
    // Check main switch for spending Koban via a direct storage read,
    // NOT recursion via getStoredValue, to avoid an infinite call stack
    // if Setting_spendKobans0 itself were ever (accidentally) registered
    // with kobanUsing: true. The master switch is itself a Storage()
    // entry so we route through getStorageItem with its registered type.
    const masterKey = HHStoredVarPrefixKey + SK.spendKobans0;
    const masterEntry = HHStoredVars[masterKey];
    const masterValue = masterEntry ? getStorageItem(masterEntry.storage)[masterKey] : undefined;
    return masterValue === "true" ? storedValue : "false";
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
    if (!HHStoredVars.hasOwnProperty(inVarName)) return;
    try {
        getStorageItem(HHStoredVars[inVarName].storage)[inVarName] = inValue;
    } catch (e) {
        // Robust catch: destructuring `{ errName, message }` from a
        // non-Error throw (primitive, plain object missing those keys)
        // would throw a TypeError out of setStoredValue itself --
        // catastrophic in the AutoLoop hot-loop where this runs >100x
        // per tick. Coerce to a string message instead.
        const message = (e instanceof Error) ? e.message : String(e);
        cleanLogsInStorage();
        logHHAuto(`ERROR: Can't save value in storage for ${inVarName} (${message}), ${retry?'user storage need to be cleaned':'retry...'}`);
        if (!retry) setStoredValue(inVarName, inValue, true);
    }
}


export function extractHHVars(dataToSave,extractLog = false,extractTemp=true,extractSettings=true)
{
    const currentStorageName = getStoredValue(HHStoredVarPrefixKey+SK.settPerTab) === "true" ? "sessionStorage" : "localStorage";
    for (const i of Object.keys(HHStoredVars))
    {
        const varType = HHStoredVars[i].HHType;
        if (!((varType === "Setting" && extractSettings) || (varType === "Temp" && extractTemp))) continue;
        const storageType = HHStoredVars[i].storage;
        const storageName = storageType === 'Storage()' ? currentStorageName : storageType;
        if (i !== HHStoredVarPrefixKey + TK.Logging)
        {
            dataToSave[storageName + "." + i] = getStoredValue(i);
        }
    }
    if (extractLog)
    {
        dataToSave[HHStoredVarPrefixKey+TK.Logging] = safeJsonParse(sessionStorage.getItem(HHStoredVarPrefixKey+'Temp_Logging'), {});
    }
    return dataToSave;
}

export function saveHHVarsSettingsAsJSON() {
    const dataToSave = {};
    extractHHVars(dataToSave, false, false, true);
    const name = 'HH_SaveSettings_' + Date.now() + '.json';
    const a = document.createElement('a');
    a.download = name;
    a.href = URL.createObjectURL(new Blob([JSON.stringify(dataToSave)], { type: 'application/json' }));
    a.click();
}

export function getStorageItem(inStorageType)
{
    switch (inStorageType)
    {
        case 'localStorage':
            return localStorage;
        case 'sessionStorage':
            return sessionStorage;
        case 'Storage()':
            return getStorage();
    }
}

export function migrateHHVars()
{
    // Custom-prefix migration: when the user runs a forked build with a
    // non-default HHStoredVarPrefixKey and old "HHAuto_"-prefixed
    // settings are still in storage, copy each registered key over from
    // the legacy slot to the active prefix.
    //
    // Status (2026-05-26): the active HHStoredVarPrefixKey is hardcoded
    // to "HHAuto_" in src/config/HHStoredVars.ts, so the body of this
    // function is dormant in production. The function and its call
    // site (StartService.ts: migrateHHVars()) are intentionally kept
    // because:
    //   - Flipping the prefix is the documented mechanism for
    //     multi-account isolation (no current PR, but on the roadmap).
    //   - The cost of keeping the migration around is negligible
    //     (one early-return check per script start).
    //   - If a future patch enables the custom prefix without re-
    //     introducing the migration, every user who upgrades loses
    //     their settings on the next reload, which is unrecoverable.
    // Remove together with the multi-account feature, not before.
    if(HHStoredVarPrefixKey === 'HHAuto_' || !haveHHAutoSettings()) return;
    for (const newKey of Object.keys(HHStoredVars))
    {
        const oldKeys = newKey.replace(HHStoredVarPrefixKey, 'HHAuto_');
        const storageItem = getStorageItem(HHStoredVars[newKey].storage);
        const itemValue = storageItem[oldKeys];
        storageItem.removeItem(oldKeys);
        // Preserve the value if it is set at all -- including the empty
        // string and "0" (falsy in JS but legitimate stored-string
        // values for some toggles). Only skip when the legacy slot was
        // never populated.
        if (itemValue !== undefined && itemValue !== null) {
            setStoredValue(newKey, itemValue);
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
    const dataToSave = {};
    getMenuValues();
    extractHHVars(dataToSave, false, false, true);
    const savedHHStoredVars = {};
    for (const i of Object.keys(dataToSave))
    {
        const variableName = i.split(".")[1];
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
    const entry = HHStoredVars[inVarName];
    if (entry === undefined)
    {
        logHHAuto("HHStoredVar "+inVarName+" doesn't exist.");
        return;
    }
    if (entry.default === undefined || entry.storage === undefined)
    {
        logHHAuto("HHStoredVar "+inVarName+" either have no storage or default defined.");
        return;
    }
    const storageItem = getStorageItem(entry.storage);
    const userDefinedDefault = getUserHHStoredVarDefault(inVarName);
    // Null-check first, then validate: avoids running a regex against
    // the literal string "null" (JavaScript coerces null to "null"
    // when fed to RegExp.test). The previous implementation worked by
    // accident through the userDefinedDefault !== null guard, but the
    // ordering was fragile -- a refactor that simplified the guard
    // could re-introduce the issue.
    if (userDefinedDefault !== null
        && (entry.isValid === undefined || entry.isValid.test(userDefinedDefault)))
    {
        logHHAuto("HHStoredVar "+inVarName+" set to user default value : "+userDefinedDefault);
        storageItem[inVarName] = userDefinedDefault;
    }
    else
    {
        logHHAuto("HHStoredVar "+inVarName+" set to default value : "+entry.default);
        storageItem[inVarName] = entry.default;
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
    // Iterate the registry instead of duplicating the "Setting_" /
    // "Temp_" prefix convention here. Routing through deleteStoredValue
    // keeps the cleanup honest: any key that getStoredValue/setStored
    // Value would honour is in scope, anything else is intentionally
    // out of scope (e.g. game-side localStorage entries the script
    // does not own). TK.Logging stays so a fresh log buffer is
    // available when the user presses the debug-delete button.
    const loggingKey = HHStoredVarPrefixKey + TK.Logging;
    for (const key of Object.keys(HHStoredVars))
    {
        if (key === loggingKey) continue;
        deleteStoredValue(key);
    }
    logHHAuto('Deleted all script vars.');
}


export function debugDeleteTempVars()
{
    // Snapshot Settings BEFORE wiping. extractHHVars serialises each
    // key as "<currentStorageName>.<varName>" using the active
    // settPerTab value. After debugDeleteAllVars + setDefaults(true)
    // settPerTab is back to its registry default, which may not match
    // the user's preference. Rather than restoring into the snapshot's
    // bucket (which would write into the wrong storage), we restore
    // each value via setStoredValue, which routes through the registry
    // and respects the post-reset settPerTab automatically.
    const dataToSave = {};
    extractHHVars(dataToSave, false, false, true);

    debugDeleteAllVars();
    setDefaults(true);

    for (const compoundKey of Object.keys(dataToSave))
    {
        const variableName = compoundKey.split(".")[1];
        logHHAuto(compoundKey + ':' + dataToSave[compoundKey]);
        setStoredValue(variableName, dataToSave[compoundKey]);
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
        for (const currentItem of Object.keys(possibleRewards))
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
        const collectablesList: string[] = [];
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
    // Approximate size in KB. The factor (16 / 8) converts JavaScript
    // string length (UTF-16 code units) to bytes (16 bits per code
    // unit / 8 bits per byte = 2 bytes). The "+3" is a small constant
    // header allowance carried over from the original implementation;
    // kept as-is because the value is informational only.
    let allStrings = '';
    for (const key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
            allStrings += localStorage[key];
        }
    }
    for (const key in sessionStorage) {
        if (Object.prototype.hasOwnProperty.call(sessionStorage, key)) {
            allStrings += sessionStorage[key];
        }
    }
    return allStrings ? 3 + ((allStrings.length * 16) / (8 * 1024)) + ' KB' : 'Empty (0 KB)';
}