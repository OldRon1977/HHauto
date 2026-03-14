// ==UserScript==
// @name         HaremHeroes Automatic++
// @namespace    https://github.com/Roukys/HHauto
// @version      {{version}}
// @description  Open the menu in HaremHeroes(topright) to toggle AutoControlls. Supports AutoSalary, AutoContest, AutoMission, AutoQuest, AutoTrollBattle, AutoArenaBattle and AutoPachinko(Free), AutoLeagues, AutoChampions and AutoStatUpgrades. Messages are printed in local console.
// @author       JD and Dorten(a bit), Roukys, cossname, YotoTheOne, CLSchwab, deuxge, react31, PrimusVox, OldRon1977, tsokh, UncleBob800
// @match        http*://*.haremheroes.com/*
// @match        http*://*.hentaiheroes.com/*
// @match        http*://*.gayharem.com/*
// @match        http*://*.comixharem.com/*
// @match        http*://*.hornyheroes.com/*
// @match        http*://*.pornstarharem.com/*
// @match        http*://*.transpornstarharem.com/*
// @match        http*://*.gaypornstarharem.com/*
// @match        http*://*.mangarpg.com/*
// @match        http*://*.amouragent.com/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @license      MIT
// @updateURL    https://github.com/Roukys/HHauto/raw/main/HHAuto.user.js
// @downloadURL  https://github.com/Roukys/HHauto/raw/main/HHAuto.user.js
// ==/UserScript==

// WARNING: This file has been generated, DO NOT EDIT.

//CSS Region
GM_addStyle('.HHAutoScriptMenu .switch { position: relative; display: inline-block; width: 34px; height: 20px; top:0 }/* The switch - the box around the slider */ '
            +'.HHAutoScriptMenu .switch input { display:none } /* Hide default HTML checkbox */ '
            +'.HHAutoScriptMenu .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; -webkit-transition: .4s; transition: .4s; margin-right: 4px; } /* The slider */'
            +'.HHAutoScriptMenu .slider.round:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; -webkit-transition: .4s; transition: .4s; } '
            +'.HHAutoScriptMenu input:checked + .slider { background-color: #2196F3; } '
            +'.HHAutoScriptMenu input:checked + .slider.styling { background-color: #dba617; } '
            +'.HHAutoScriptMenu input:focus + .slider { box-shadow: 0 0 1px #2196F3; } '
            +'.HHAutoScriptMenu input:checked + .slider:before { -webkit-transform: translateX(10px); -ms-transform: translateX(10px); transform: translateX(10px); } '
            +'.HHAutoScriptMenu .slider.round { border-radius: 14px; }/* Rounded sliders */ '
            +'.HHAutoScriptMenu .slider.round:before { border-radius: 50%; }');
GM_addStyle('.HHAutoScriptMenu input:checked + .slider.kobans { background-color: red; }'
            +'.HHAutoScriptMenu input:not(:checked) + .slider.round.kobans:before { background-color: red }'
            +'.HHAutoScriptMenu input:checked + .slider.round.kobans:before { background-color: white }')
GM_addStyle('.HHAutoScriptMenu select option { font-size: medium; }')
GM_addStyle('#pInfo {padding-left:3px; z-index:1;white-space: pre;position: absolute;right: 5%; left:43%; height:auto; top:11%; overflow: hidden; border: 1px solid #ffa23e; background-color: rgba(0,0,0,.5); border-radius: 5px; font-size:9pt; user-select: none; -webkit-user-select: none; -moz-user-select: none;}'
            + '#pInfo ul {margin:0; padding:0; columns:2; list-style-type: none;}'
            + '#pInfo ul li {margin:0}');
GM_addStyle('#pInfo.left {right: 250px; left:220px; top:12%;');
GM_addStyle('span.HHMenuItemName {padding-bottom:2px; line-height:120%;}');
GM_addStyle('div.optionsRow {display:flex; flex-direction:row; justify-content: space-between}'); //; padding:3px;
GM_addStyle('span.optionsBoxTitle {padding-left:5px}'); //; padding-bottom:2px
GM_addStyle('div.optionsColumn {display:flex; flex-direction:column}');
GM_addStyle('div.optionsBoxWithTitle {display:flex; flex-direction:column}');
GM_addStyle('div.optionsBoxWithTitleInline {display:flex; flex-direction:row; border:1px solid #ffa23e; border-radius:5px; margin:1px}');
GM_addStyle('div.optionsBoxWithTitleInline .optionsBox {border: none}');
GM_addStyle('img.iconImg {max-width:15px; height:15px}');
GM_addStyle('#sMenu {top: 5px;right: 52px;padding: 1px;opacity: 1;border-radius: 4px;border: 1px solid #ffa23e;background-color: #1e261e;font-size:x-small; position:absolute; text-align:left; flex-direction:column; justify-content:space-between; z-index:10000; overflow:auto; max-height:calc(100% - 5px); scrollbar-width: thin;max-width: calc(100% - 52px);}');
GM_addStyle('#sMenu::-webkit-scrollbar {width: 6px;height: 6px;background: #000;}');
GM_addStyle('#sMenu::-webkit-scrollbar-thumb { background: #ffa23e; -webkit-border-radius: 1ex; -webkit-box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.75);}');
GM_addStyle('#sMenu::-webkit-scrollbar-corner {background: #000;}');
GM_addStyle('#sMenu .HHMenuItemName {font-size:8px;}');
GM_addStyle('div.optionsBoxTitle {height:12px; display:flex; flex-direction:row; justify-content:center; align-items:center;}'); //; padding:2px; padding-bottom:0px;
GM_addStyle('div.rowOptionsBox {margin:1px; padding:3px; font-size:smaller; display:flex; flex-direction:row; align-items:flex-start; border: 1px solid #ffa23e; border-radius: 5px}');
GM_addStyle('div.optionsBox {margin:1px; padding:3px; font-size:smaller; display:flex; flex-direction:column; border:1px solid #ffa23e; border-radius:5px}');
GM_addStyle('div.internalOptionsRow {display:flex; flex-direction:row; justify-content: space-between; align-items: flex-end}'); //; padding:3px;
GM_addStyle('div.internalOptionsRow.separator {border-top:1px solid #ffa23e}'); //; padding:3px;
GM_addStyle('div.imgAndObjectRow {display:flex; flex-direction:row; justify-content:flex-start; align-items:center}'); //; padding:3px;//class="internalOptionsRow" style="justify-content:flex-start; align-items:center"
GM_addStyle('div.labelAndButton {padding:3px; display:flex;flex-direction:column}');
GM_addStyle('div.HHMenuItemBox {padding:0.2em}');
GM_addStyle('div.HHMenuRow {display:flex; flex-direction:row; align-items:center; align-content:center; justify-content:flex-start}');
GM_addStyle('input.maxMoneyInputField  {text-align:right; width:70px}');
GM_addStyle('.myButton {box-shadow: 0px 0px 0px 2px #9fb4f2; background:linear-gradient(to bottom, #7892c2 5%, #476e9e 100%); background-color:#7892c2; border-radius:10px; border:1px solid #4e6096; display:inline-block; cursor:pointer; color:#ffffff; font-family:Arial; font-size:8px; padding:3px 7px; text-decoration:none; text-shadow:0px 1px 0px #283966;}'
            +'.myButton:hover { background:linear-gradient(to bottom, #476e9e 5%, #7892c2 100%); background-color:#476e9e; }'
            +'.myButton:active { position:relative; top:1px;}'
            +'.myButton:disabled, .myButton[disabled] { background: grey;}');
GM_addStyle('.HHEventPriority {position: absolute;z-index: 500;background-color: black}');
GM_addStyle('.HHPopIDs {background-color: black;z-index: 500;position: absolute;}');
GM_addStyle('.tooltipHH:hover { cursor: help; position: relative; }'
            +'.tooltipHH span.tooltipHHtext { display: none }');
GM_addStyle('.HHpopup_message { border: #666 2px dotted; padding: 5px 20px 5px 5px; display: block; z-index: 1000; background: #e3e3e3; left: 0px; margin: 15px; width: 500px; position: absolute; top: 15px; color: black}');
GM_addStyle(".HHpopup_message .close {   position: absolute;   top: 20px;   right: 30px;   transition: all 200ms;   font-size: 30px;   font-weight: bold;   text-decoration: none;   color: #333; } #popup_message_league_close:hover {   color: #06D85F; }");
GM_addStyle('#HHPovPogRewards { position: absolute; bottom: 0.2rem; left: -0.75rem; padding: 0.5rem; background: rgba(0,0,0,.5); border-radius: 10px; z-index: 1;}');
GM_addStyle('.HHRewardNotCollected { max-width: 17.9rem; transform: scale(0.8); }');
GM_addStyle('.HHRewardNotCollected .slot { margin: 1px 1px 0}'); 
GM_addStyle('.HHGirlMilestone { position: absolute; bottom: 0;  z-index: 1; font-size:smaller; width: 200px; text-align: center;}'); 
GM_addStyle('.HHGirlMilestone > div { background: rgba(0,0,0,.5); border-radius: 10px; margin:auto;  width: 140px; }'); 
// GM_addStyle('.HHGirlMilestone.green { border: solid 1px green }');
GM_addStyle('.HHGirlMilestone .nc-claimed-reward-check { width:20px; position:absolute; }'); 
GM_addStyle('#HHPentaDrillRewards { position: absolute; right: 7rem; top: 14.75rem; padding: 0.2rem; background: rgba(0,0,0,.5); border-radius: 10px; z-index: 1;}'); 
GM_addStyle('#HHSeasonRewards { position: absolute; right: 33.5rem; bottom: 13rem; padding: 0.5rem; background: rgba(0,0,0,.5); border-radius: 10px; z-index: 1;}'); 
GM_addStyle('#HHSeasonalRewards { position: absolute; left: 1.25rem; bottom: 1rem; padding: 0.5rem; background: rgba(0,0,0,.5); border-radius: 10px; z-index: 4;}'); 
GM_addStyle('#HHPoaRewards { position: absolute;left: 32rem; top: 13.5rem; padding: 0.2rem; background: rgba(0,0,0,.5); border-radius: 10px; z-index: 1;}'); 
GM_addStyle('#HHDpRewards { position: absolute; left: 0; top: 12rem; padding: 0.5rem; background: rgba(0,0,0,.5); border-radius: 10px; z-index: 1;}'); 
// copy CSS from HH OCD, to make it work on other game than HH
GM_addStyle('#pov_tab_container .potions-paths-first-row .potions-paths-title-panel { transform: scale(0.5);  position: relative; top: -37px; }');
GM_addStyle('img.eventCompleted { width: 10px; margin-left:2px }');
// Remove blur on pose preview
GM_addStyle('#girl_preview_popup .preview-locked_icn { display: none; }');
GM_addStyle('#girl_preview_popup #poses-tab_container .pose-preview_wrapper.locked img { filter: none !important; }');
//END CSS Region

