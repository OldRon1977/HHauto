// General-purpose utility functions for HHAuto.
// Provides callItOnce (ensures a function executes only once), safeJsonParse,
// AJAX response interception helpers, and other shared convenience methods.
import { getStorageItem } from "../Helper/StorageHelper";
import { safeReload } from "../Service/PageNavigationService";
import { logHHAuto } from "./LogUtils";

export function callItOnce(fn: () => any) {
    var called = false;
    return function() {
        if (!called) {
            called = true;
            return fn();
        }
        return;
    }
}

export function getHHAjax() {
    return unsafeWindow.shared?.general?.hh_ajax;
}
export function getLoadingAnimation() {
    return window.shared?.animations?.loadingAnimation || { start: () => { }, stop: ()=>{}};
}

export function onAjaxResponse(pattern: any, callback: (response: any, opt: any, xhr: any, evt: any) => any) {
    $(document).ajaxComplete((evt, xhr, opt) => {
        if (opt && opt.data && opt.data.search && ~opt.data.search(pattern)) {
            if (!xhr || !xhr.responseText || !xhr.responseText.length) {
                return
            }
            const responseData = JSON.parse(xhr.responseText)
            if (!responseData || !responseData.success) {
                return
            }
            return callback(responseData, opt, xhr, evt)
        }
    })
}

export function getCallerFunction()
{
    var stackTrace = (new Error()).stack || ''; // Only tested in latest FF and Chrome
    var callerName = stackTrace.replace(/^Error\s+/, ''); // Sanitize Chrome
    callerName = callerName.split("\n")[1]; // 1st item is this, 2nd item is caller
    callerName = callerName.replace(/^\s+at Object./, ''); // Sanitize Chrome
    callerName = callerName.replace(/ \(.+\)$/, ''); // Sanitize Chrome
    callerName = callerName.replace(/\@.+/, ''); // Sanitize Firefox
    return callerName;
}

export function getCallerCallerFunction()
{

    const stackTrace = (new Error()).stack || ''; // Only tested in latest FF and Chrome
    let match
    try {
        match = stackTrace.match(/at Object\.(\w+) \((\S+)\)/);
        match![1] // throw error if match is null
    } catch {
        // Firefox
        match = stackTrace.match(/\n(\w+)@(\S+)/);
    }
    const [callerName, callerPlace] = [match![1], match![2]]

    try{
    console.log('Function ' + match![3] + ' at ' + match![4])
    }catch(err){}
    return callerName;
    //return getCallerCallerFunction.caller.caller.name
}
export function isFocused()
{
    //let isFoc = false;
    const docFoc = document.hasFocus();
    //const iFrameFoc = $('iframe').length===0?false:$('iframe')[0].contentWindow.document.hasFocus();
    //isFoc = docFoc || iFrameFoc;
    return docFoc;
}
export function isJSON(str: any)
{
    if (str === undefined || str === null || /^\s*$/.test(str) ) return false;
    str = str.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@');
    str = str.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']');
    str = str.replace(/(?:^|:|,)(?:\s*\[)+/g, '');
    return (/^[\],:{}\s]*$/).test(str);
}

export function safeJsonParse<T>(json: string | undefined | null, defaultValue: T, reviver?: (key: string, value: any) => any): T {
    if (json === undefined || json === null) return defaultValue;
    try {
        return reviver ? JSON.parse(json, reviver) : JSON.parse(json);
    } catch (e) {
        return defaultValue;
    }
}


export function replaceCheatClick()
{
    // unsafeWindow.is_cheat_click=function(e) {
    //     return false;
    // };
    // unsafeWindow.shared.general.is_cheat_click =function(e) {
    //     return false;
    // };
}

export function getCurrentSorting()
{
    return localStorage.sort_by;
}


export function myfileLoad_onChange(event: any)
{
    $('#LoadConfError')[0].innerText =' ';
    if (event.target.files.length == 0) {return}
    var reader = new FileReader();
    reader.onload = myfileLoad_onReaderLoad;
    reader.readAsText(event.target.files[0]);
}



export function myfileLoad_onReaderLoad(event: any){
    var text = event.target.result;
    var storageType;
    var storageItem;
    var variableName;

    //Json validation
    if (isJSON(text))
    {
        logHHAuto('the json is ok');
        var jsonNewSettings = JSON.parse(event.target.result);
        //Assign new values to Storage();
        for (const [key, value] of Object.entries(jsonNewSettings))
        {
            storageType=key.split(".")[0];
            variableName=key.split(".")[1];
            storageItem = getStorageItem(storageType);
            // extractHHVars serialises a never-written key as null on purpose,
            // so a saved config carries null for every setting the user never
            // touched. Writing that back through Web Storage stringifies it to
            // the text "null", which JSON.parse then happily returns as null --
            // and the next .includes() on a reward filter throws (#1846).
            // Skipping the key leaves it unset, and setDefaults fills in the
            // registry default on the next start.
            if (value === null || value === undefined)
            {
                logHHAuto(key+': not set in the file, keeping the default');
                continue;
            }
            logHHAuto(key+':'+ value);
            storageItem[variableName] = value;
        }
        // C1: safeReload waits for any in-flight game AJAX before the
        // reload, so user-imported settings cannot cancel an open POST
        // (issue #1598).
        safeReload();
    }else{
        $('#LoadConfError')[0].innerText ='Selected file broken!';
        logHHAuto('the json is Not ok');
    }
}