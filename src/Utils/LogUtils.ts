/**
 * Logging and debug-export utilities for HHAuto.
 *
 * All log entries are persisted in the browser's storage (localStorage /
 * GM storage) as a JSON object keyed by timestamp + caller name. This
 * allows the user to review the automation history even after a page reload.
 *
 * The log is capped at MAX_LINES entries; older entries are pruned on each
 * write to keep storage usage bounded.
 *
 * Also provides a one-click debug log exporter that bundles all stored
 * settings, browser info, and log entries into a downloadable JSON file
 * for sharing in bug reports.
 */

import { deleteStoredValue, extractHHVars, getLocalStorageSize, getStoredValue, setStoredValue } from "../Helper/StorageHelper";
import { HHStoredVarPrefixKey, TK } from '../config/index';
import { getBrowserData } from "./BrowserUtils";
import { safeJsonParse } from './Utils';

/** Maximum number of log entries kept in storage before old ones are pruned. */
const MAX_LINES = 500

/**
 * Wipe all existing log entries from storage and record a single
 * "cleaned" marker with the storage size before the clean.
 * Also deletes the cached league opponent list which can grow large.
 */
export function cleanLogsInStorage() {
    var currentLoggingText: any = {};
    let currDate = new Date();
    var prefix = currDate.toLocaleString() + "." + currDate.getMilliseconds() + ":cleanLogsInStorage";
    currentLoggingText[prefix] = 'Cleaned logging, storage size before clean ' + getLocalStorageSize();
    setStoredValue(HHStoredVarPrefixKey + TK.Logging, JSON.stringify(currentLoggingText));

    // Delete big temp in storage
    deleteStoredValue(HHStoredVarPrefixKey + TK.LeagueOpponentList);
}

/**
 * Write a timestamped log entry to both the browser console and persistent
 * storage. Automatically detects the calling function name from the stack
 * trace and uses it as part of the log key.
 *
 * Accepts any number of arguments: a single string is stored as-is;
 * objects are JSON-serialized with circular-reference protection.
 *
 * When the stored log exceeds MAX_LINES, the oldest entries are removed.
 * Duplicate keys within the same millisecond get a numeric suffix.
 */
export function logHHAuto(...args)
{

    const stackTrace = (new Error()).stack || '';
    let match
    const regExps = [/at Object\.([\w_.]+) \((\S+)\)/, /\n([\w_.]+)@(\S+)/, /\)\n    at ([\w_.]+) \((\S+)\)/];
    regExps.forEach(element => {
        if(!(match && match.length >= 2)) match = stackTrace.match(element);
    });
    if(!(match && match.length >= 2)) match = ['Unknown','Unknown'];

    const callerName = match[1];

    let currDate = new Date();
    var prefix = currDate.toLocaleString()+"."+currDate.getMilliseconds()+":"+callerName;
    var text:any;
    var currentLoggingText:any;
    var nbLines:number;

    // JSON.stringify replacer that tracks seen objects to avoid
    // "Converting circular structure to JSON" errors.
    const getCircularReplacer = () => {
        const seen = new WeakSet();
        return (key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                    return;
                }
                seen.add(value);
            }
            return value;
        };
    };
    if (args.length === 1)
    {
        if (typeof args[0] === 'string' || args[0] instanceof String)
        {
            text = args[0];
        }
        else
        {
            text = JSON.stringify(args[0], getCircularReplacer(), 2);
        }
    }
    else
    {
        text = JSON.stringify(args, getCircularReplacer(), 2);
    }
    currentLoggingText = getStoredValue(HHStoredVarPrefixKey+TK.Logging) ?? "reset";
    //console.log("debug : ",currentLoggingText);
    if (!currentLoggingText.startsWith("{"))
    {
        //console.log("debug : delete currentLog");
        currentLoggingText={};
    }
    else
    {

        currentLoggingText = safeJsonParse(currentLoggingText, {});
    }
    nbLines = Object.keys(currentLoggingText).length;
    //console.log("Debug : Counting log lines : "+nbLines);
    if (nbLines > MAX_LINES)
    {
        var keys=Object.keys(currentLoggingText);
        //console.log("Debug : removing old lines");
        for (var i = 0; i < nbLines - MAX_LINES; i++)
        {
            //console.log("debug delete : "+currentLoggingText[keys[i]]);
            delete currentLoggingText[keys[i]];
        }
    }
    let count=1;
    let newPrefix = prefix;
    while (currentLoggingText.hasOwnProperty(newPrefix) && count < 10)
    {
        newPrefix = prefix + "-" + count;
        count++;
    }
    prefix=newPrefix;
    console.log(prefix+":"+text);
    currentLoggingText[prefix]=text;

    setStoredValue(HHStoredVarPrefixKey+TK.Logging, JSON.stringify(currentLoggingText));

}

/**
 * Bundle all HHAuto settings, browser info, script version, and the
 * stored log into a JSON file, then trigger a browser download.
 *
 * The resulting file can be attached to bug reports so developers
 * can reproduce issues without asking the user for each detail.
 */
export function saveHHDebugLog()
{
    var dataToSave={}

    var name='HH_DebugLog_'+Date.now()+'.log';
    dataToSave['HHAuto_browserVersion']=getBrowserData(window.navigator || navigator);
    dataToSave['HHAuto_scriptHandler']=GM_info.scriptHandler+' '+GM_info.version;
    dataToSave['HHAuto_version']=GM_info.script.version;
    dataToSave['HHAuto_HHSite']=window.location.origin;
    dataToSave['HHAuto_storageSize'] = getLocalStorageSize();
    extractHHVars(dataToSave,true);
    const a = document.createElement('a')
    a.download = name
    a.href = URL.createObjectURL(new Blob([JSON.stringify(dataToSave, null, 2)], {type: 'application/json'}))
    a.click()
}