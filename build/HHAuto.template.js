// ==UserScript==
// @name         HaremHeroes Automatic++
// @namespace    https://github.com/OldRon1977/HHauto
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
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @license      GPL-3.0
// @updateURL    https://github.com/OldRon1977/HHauto/raw/main/HHAuto.user.js
// @downloadURL  https://github.com/OldRon1977/HHauto/raw/main/HHAuto.user.js
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
GM_addStyle('#pInfo {padding-left:3px; padding-right:3px; z-index:1;white-space: pre;position: absolute;right: calc(5% + 50px); left:auto; width:30%; height:auto; top:11%; overflow: hidden; border: 1px solid #ffa23e; background-color: rgba(0,0,0,.5); border-radius: 5px; font-size:8pt; user-select: none; -webkit-user-select: none; -moz-user-select: none;}'
            // One column with the label left and the value flush right. Two
            // columns fitted more rows in but cut the longer ones off: the
            // value was part of the label's own text node, so there was
            // nothing to align and nothing to keep whole.
            + '#pInfo ul {margin:0; padding:0; columns:1; list-style-type: none;}'
            + '#pInfo ul li {margin:0; display:flex; align-items:baseline; justify-content:space-between; gap:12px;}'
            // The panel sets white-space:pre, which would hold a long label on
            // one clipped line. Only the label may wrap; the time must not.
            + '#pInfo .pInfoLabel {white-space:normal; overflow-wrap:anywhere;}'
            + '#pInfo .pInfoValue {flex:none; white-space:nowrap; text-align:right;}');
GM_addStyle('#pInfo.left {left:220px; right:auto; width:30%; top:12%;}'); // width, not a second pixel offset: right:250px made this variant span almost the whole window and outrank the base rule (and the block was never closed)
GM_addStyle('span.HHMenuItemName {padding-bottom:2px; line-height:120%;}');
GM_addStyle('div.optionsRow {display:flex; flex-direction:row; justify-content: space-between}'); //; padding:3px;
GM_addStyle('span.optionsBoxTitle {padding-left:5px}'); //; padding-bottom:2px
GM_addStyle('div.optionsColumn {display:flex; flex-direction:column}');
GM_addStyle('div.optionsBoxWithTitle {display:flex; flex-direction:column}');
GM_addStyle('div.optionsBoxWithTitleInline {display:flex; flex-direction:row; border:1px solid #ffa23e; border-radius:5px; margin:1px}');
GM_addStyle('div.optionsBoxWithTitleInline .optionsBox {border: none}');
GM_addStyle('img.iconImg {max-width:15px; height:15px}');
// Settings panel (8.10.0): a fixed-size panel with a tab rail instead of three
// fixed-width columns. Rows are a two-column grid so a long translation wraps
// in the label column and can never run under its control.
GM_addStyle('#sMenu {top: 5px; right: 52px; position:absolute; z-index:10000;'
            +' width:820px; height:540px; max-width:calc(100% - 56px); max-height:calc(100% - 10px);'
            +' flex-direction:column; overflow:hidden;'
            +' border-radius:4px; border:1px solid #ffa23e; background-color:#1e261e;'
            +' font-size:10px; text-align:left; scrollbar-width:thin;}');
GM_addStyle('#sMenu ::-webkit-scrollbar {width: 6px;height: 6px;background: #000;}');
GM_addStyle('#sMenu ::-webkit-scrollbar-thumb { background: #ffa23e; -webkit-border-radius: 1ex; -webkit-box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.75);}');
GM_addStyle('#sMenu ::-webkit-scrollbar-corner {background: #000;}');
GM_addStyle('#sMenu .HHMenuItemName {font-size:10px; padding-bottom:0; line-height:1.25;}');
// Header
GM_addStyle('#sMenu .menuHead {flex:none; display:flex; align-items:center; flex-wrap:wrap; gap:4px 10px; padding:6px 10px; border-bottom:1px solid #ffa23e;}');
GM_addStyle('#sMenu .menuName {font-weight:bold; font-size:13px;}');
GM_addStyle('#sMenu .menuVer {color:#98a191; margin-left:5px;}');
GM_addStyle('#sMenu .menuMaster {margin-left:auto;}');
GM_addStyle('#sMenu .menuMaster .labelAndButton {grid-template-columns:auto auto; gap:6px; padding:0;}');
GM_addStyle('#sMenu .menuWarn {flex-basis:100%; color:#ff8a80;}');
// Body: tab rail + panes
GM_addStyle('#sMenu .menuBody {flex:1; display:flex; min-height:0;}');
GM_addStyle('#sMenu .menuTabs {flex:none; width:158px; overflow-y:auto; padding:4px 0; border-right:1px solid #ffa23e; background:#0d120b;}');
GM_addStyle('#sMenu .menuTab {display:flex; align-items:center; gap:6px; padding:5px 8px; cursor:pointer; color:#98a191; font-size:12px; border-left:3px solid transparent;}');
GM_addStyle('#sMenu .menuTab:hover {color:#e9e7dd; background:rgba(255,162,62,.06);}');
GM_addStyle('#sMenu .menuTab.active {color:#e9e7dd; background:rgba(255,162,62,.12); border-left-color:#ffa23e; font-weight:bold;}');
GM_addStyle('#sMenu .menuTabBadge {margin-left:auto; padding:0 5px; border-radius:8px; font-size:10px; font-weight:normal;'
            +' line-height:15px; min-width:26px; text-align:center; background:rgba(255,162,62,.18); color:#ffa23e;}');
// 0/n stays legible but recedes: nothing running is a normal state, not a warning.
GM_addStyle('#sMenu .menuTabBadge.idle {background:rgba(152,161,145,.14); color:#98a191;}');
GM_addStyle('#sMenu.menuStacked .menuTabBadge {margin-left:8px;}');
// Compact density (#1834). The panel is a fixed 820x540 CSS px inside the
// game's transform, so a larger screen magnifies it instead of fitting more
// in. Trading row height and type size is the only way to raise the number of
// options on screen; it is opt-in so nobody has to live with the other camp's
// preference.
GM_addStyle('#sMenu.menuCompact {font-size:9px;}');
GM_addStyle('#sMenu.menuCompact .HHMenuItemName {font-size:9px; line-height:1.15;}');
GM_addStyle('#sMenu.menuCompact .labelAndButton {padding-top:1px; padding-bottom:1px;}');
GM_addStyle('#sMenu.menuCompact .menuTab {padding:3px 8px; font-size:11px;}');
GM_addStyle('#sMenu.menuCompact .menuPanes {padding:4px 6px;}');
GM_addStyle('#sMenu.menuCompact .menuPaneTitle {font-size:11px;}');
GM_addStyle('#sMenu.menuCompact .switch {width:28px; height:16px;}');
GM_addStyle('#sMenu.menuCompact .slider.round:before {height:11px; width:11px; left:2px; bottom:2.5px;}');
GM_addStyle('#sMenu.menuCompact input:checked + .slider:before {transform:translateX(11px);}');
GM_addStyle('#sMenu .menuPanes {flex:1; overflow-y:auto; padding:6px 8px;}');
GM_addStyle('#sMenu .menuPane {display:none;}');
GM_addStyle('#sMenu .menuPane.active {display:block;}');
// Stacked layout (#1834): no rail, every area below the previous one in the
// same scrolling column. One extra class on #sMenu switches it; the panes,
// groups and rows are the same nodes with the same ids in both layouts.
// The selector carries three classes so it outranks '.menuPane.active' above
// regardless of which rule comes first.
GM_addStyle('#sMenu.menuStacked .menuTabs {display:none;}');
GM_addStyle('#sMenu.menuStacked .menuPanes .menuPane {display:block;}');
GM_addStyle('#sMenu.menuStacked .menuPanes .menuPane + .menuPane {margin-top:12px;}');
// An area whose every group is hidden on this game (maskInactiveMenus) would
// otherwise show as a heading with nothing under it.
GM_addStyle('#sMenu .menuPanes .menuPane.menuPaneEmpty {display:none;}');
GM_addStyle('#sMenu .menuPaneTitle {font-size:14px; font-weight:bold; padding-bottom:4px; margin-bottom:6px; border-bottom:1px solid rgba(255,162,62,.3);}');
GM_addStyle('#sMenu .menuGroups {display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:5px; align-items:start;}');
GM_addStyle('#sMenu .menuGroup {border:1px solid rgba(255,162,62,.55); border-radius:4px; padding:4px 7px 5px;}');
GM_addStyle('#sMenu .menuGroup.wide {grid-column:1/-1;}');
GM_addStyle('#sMenu .menuGroup.wide > .menuGroupRows {display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); column-gap:18px;}');
GM_addStyle('#sMenu .menuGroupTitle {color:#ffa23e; font-weight:bold; text-transform:uppercase; letter-spacing:.06em; margin-bottom:2px;}');
// The row: flexible label column, fixed control column.
GM_addStyle('#sMenu .labelAndButton {display:grid; grid-template-columns:1fr auto; align-items:center; gap:8px; min-height:21px; padding:1px 0;}');
GM_addStyle('#sMenu .labelAndButton + .labelAndButton {border-top:1px solid rgba(255,162,62,.13);}');
GM_addStyle('#sMenu .menuGroup.wide .labelAndButton {border-top:1px solid rgba(255,162,62,.13);}');
GM_addStyle('#sMenu .menuPair {display:flex; align-items:center; gap:4px;}');
GM_addStyle('#sMenu select {max-width:100%;}');
// Number fields run to twelve digits plus thousands separators ("999.999.999.999",
// 15 characters). Smaller type in the fields buys the room; the width is given in
// ch so it keeps fitting that many characters whatever font the game applies.
GM_addStyle('#sMenu input[type=text] {font-size:8px; box-sizing:content-box; padding:0 2px;}');
GM_addStyle('#sMenu input.maxMoneyInputField {width:17ch; text-align:right;}');
// Booster lists hold up to five codes ("MB1;MB2;MB5;MB8;MB12", 20 characters) —
// the example the tooltip itself gives.
GM_addStyle('#sMenu input.menuListInput {width:21ch; text-align:center;}');
// The Places of Power filter holds one entry per place, so it needs roughly
// twice the room of a booster list.
GM_addStyle('#sMenu input.menuListInput.menuListWide {width:32ch;}');
// Footer
GM_addStyle('#sMenu .menuFoot {flex:none; display:flex; flex-wrap:wrap; align-items:center; gap:4px; padding:6px 10px; border-top:1px solid #ffa23e; background:#0d120b;}');
GM_addStyle('#sMenu .menuFootRight {margin-left:auto; display:flex; flex-wrap:wrap; gap:4px;}');
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

