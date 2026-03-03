import { getStoredValue } from '../Helper/index';
import { HHStoredVarPrefixKey, SK } from '../config/index';

export let mouseBusy:boolean = false;
export let mouseBusyTimeout:ReturnType<typeof setTimeout> | number = 0;
export function makeMouseBusy(ms) {
    clearTimeout(mouseBusyTimeout);
    //logHHAuto('mouseBusy' + mouseBusy + ' ' + ms);
    mouseBusy = true;
    mouseBusyTimeout = setTimeout(function(){mouseBusy = false;}, ms);
};

export function bindMouseEvents(){
    const mouseTimeoutVal = Number.isInteger(Number(getStoredValue(HHStoredVarPrefixKey+SK.mousePauseTimeout))) ? Number(getStoredValue(HHStoredVarPrefixKey+SK.mousePauseTimeout)) : 5000;
        document.onmousemove = function() { makeMouseBusy(mouseTimeoutVal); };
        document.onscroll = function() { makeMouseBusy(mouseTimeoutVal); };
        document.onmouseup = function() { makeMouseBusy(mouseTimeoutVal); };
}