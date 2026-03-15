/**
 * Custom popup/modal system for the HHAuto userscript.
 *
 * Provides a reusable overlay popup that the script uses for its settings
 * menu, debug information, and user notifications. The popup is injected
 * into the game's DOM and styled independently so it doesn't conflict
 * with the game's own modals.
 *
 * The popup is lazily created on first use (createHHPopUp) and then
 * shown/hidden via display toggling on subsequent calls.
 *
 * Also includes a helper to auto-dismiss the game's own popup messages
 * so they don't block automation.
 */

import { isFocused } from "./Utils";

/**
 * Internal helper that targets the popup's DOM elements by well-known IDs
 * to update content, title, and CSS classes without re-creating the popup.
 */
class HHPopup {
    static fillContent(content:string) {
        const elem = document.getElementById("HHAutoPopupGlobalContent");
        if(elem != null) elem.innerHTML=content;
    }
    static fillTitle(title:string) {
        const elem = document.getElementById("HHAutoPopupGlobalTitle");
        if(elem != null) elem.innerHTML=title;
    }
    static fillClasses(inClass:string) {
        const elem = document.getElementById("HHAutoPopupGlobalPopup");
        if(elem != null) elem.className=inClass;
    }
}

/**
 * Show the HHAuto popup with the given CSS class, title, and HTML content.
 * Creates the popup on first call; on subsequent calls it just makes the
 * existing popup visible again and updates its contents.
 */
export function fillHHPopUp(inClass:string,inTitle:string, inContent:string)
{
    if (document.getElementById("HHAutoPopupGlobal") === null)
    {
        createHHPopUp();
    }
    else
    {
        displayHHPopUp();
    }
    HHPopup.fillContent(inContent);
    HHPopup.fillTitle(inTitle);
    HHPopup.fillClasses(inClass);
}

/**
 * Build and inject the popup's HTML structure and CSS into the game page.
 * Registers a click handler on the close button and an Escape key listener
 * to hide the popup. Called once; after creation the popup is reused.
 */
export function createHHPopUp()
{
    GM_addStyle('#HHAutoPopupGlobal.HHAutoOverlay { overflow: auto;  z-index:1000;   position: fixed;   top: 0;   bottom: 0;   left: 0;   right: 0;   background: rgba(0, 0, 0, 0.7);   transition: opacity 500ms;     display: flex;   align-items: center; }  '
    + '#HHAutoPopupGlobalPopup {   margin: auto;   padding: 20px;   background: #fff;   border-radius: 5px;   position: relative;   transition: all 5s ease-in-out; }  '
    + '#HHAutoPopupGlobalTitle {   margin-top: 0;   color: #333;   font-size: larger; } '
    + '#HHAutoPopupGlobalClose {   position: absolute;   top: 0;   right: 30px;   transition: all 200ms;   font-size: 50px;   font-weight: bold;   text-decoration: none;   color: #333; } '
    + '#HHAutoPopupGlobalClose:hover {   color: #06D85F; } '
    + '#HHAutoPopupGlobalContent .HHAutoScriptMenu .rowLine { display:flex;flex-direction:row;align-items:center;column-gap:20px;justify-content: center; } '
    + '#HHAutoPopupGlobalContent {   max-height: 30%;   overflow: auto;   color: #333;   font-size: x-small; }'
    + '#HHAutoPopupGlobalContent .HHAutoScriptMenu .switch {  width: 55px; height: 32px; }'
    + '#HHAutoPopupGlobalContent .HHAutoScriptMenu input:checked + .slider:before { -webkit-transform: translateX(20px); -ms-transform: translateX(20px); transform: translateX(20px); } '
    + '#HHAutoPopupGlobalContent .HHAutoScriptMenu .slider.round::before {  width: 22px; height: 22px; bottom: 5px; }'
    + '.PachinkoPlay {margin-top: 20px !important; }');

    let popUp = '<div id="HHAutoPopupGlobal" class="HHAutoOverlay">'
    +' <div id="HHAutoPopupGlobalPopup">'
    +'   <h2 id="HHAutoPopupGlobalTitle">Here i am</h2>'
    +'   <a id="HHAutoPopupGlobalClose">&times;</a>'
    +'   <div id="HHAutoPopupGlobalContent" class="content">'
    +'      Thank to pop me out of that button, but now im done so you can close this window.'
    +'   </div>'
    +' </div>'
    +'</div>';
    $('body').prepend(popUp);
    $("#HHAutoPopupGlobalClose").on("click", function(){
        maskHHPopUp();
    });
    document.addEventListener('keyup', evt => {
        if (evt.key === 'Escape')
        {
            maskHHPopUp();
        }
    });
}

/**
 * Check whether the HHAuto popup is currently visible.
 *
 * @returns The popup's CSS class name string if visible, or `false` if
 *          the popup doesn't exist or is hidden.
 */
export function isDisplayedHHPopUp()
{
    const popupGlobal = document.getElementById("HHAutoPopupGlobal");
    const popupGlobalPopup = document.getElementById("HHAutoPopupGlobalPopup");
    if (popupGlobal === null || popupGlobalPopup === null)
    {
        return false;
    }
    if (popupGlobal.style.display === "none")
    {
        return false;
    }
    return popupGlobalPopup.className;
}

/** Make the HHAuto popup visible (un-hide it). */
export function displayHHPopUp()
{
    const popupGlobal = document.getElementById("HHAutoPopupGlobal");
    if (popupGlobal === null)
    {
        return false;
    }
    popupGlobal.style.display = "";
    popupGlobal.style.opacity = '1';
}

/** Hide the HHAuto popup without destroying it, so it can be shown again. */
export function maskHHPopUp()
{
    const popupGlobal = document.getElementById("HHAutoPopupGlobal");
    if (popupGlobal !== null)
    {
        popupGlobal.style.display = "none";
        popupGlobal.style.opacity = '0';
    }
}

/**
 * Auto-dismiss the game's own popup messages so they don't block automation.
 *
 * Only clicks the close button when the browser tab is focused (or when
 * `inBurst` is true), to avoid interfering when the user is on another tab.
 *
 * @param inBurst - If true, close the popup even when the tab is not focused.
 */
export function checkAndClosePopup(inBurst)
{
    const popUp = $('#popup_message[style*="display: block"]');
    if ((inBurst || isFocused()) && popUp.length > 0)
    {
        $('close', popUp).click();
    }
}