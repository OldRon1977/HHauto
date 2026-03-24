var $ = require("jquery");
global.$ = global.jQuery = $;
global.GM_addStyle=function(){};
global.GM_registerMenuCommand=function(){};
global.GM_unregisterMenuCommand=function(){};
global.GM = {}; 
global.unsafeWindow = window;
global.unsafeWindow.shared = { Hero: {}, general: {} };
global.unsafeWindow.server_now_ts = 1234; // Fixed value to help testing