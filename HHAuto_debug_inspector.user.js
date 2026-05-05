// ==UserScript==
// @name         HHAuto Debug - Full Data Inspector
// @namespace    HHAuto_Debug
// @version      3.0.0
// @description  Dumps EVERYTHING the game exposes: girls, hero, teams, league, blessings, synergies, opponents, boosters, market, all globals.
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
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ---------- helpers ----------

    function safeStringify(obj) {
        const seen = new WeakSet();
        function replacer(key, value) {
            if (typeof value === 'function') return '[function]';
            if (typeof value === 'undefined') return '[undefined]';
            if (value instanceof Error) return '[Error: ' + value.message + ']';
            if (value && typeof value === 'object') {
                if (seen.has(value)) return '[circular]';
                seen.add(value);
                if (value.nodeType !== undefined && value.nodeName !== undefined) {
                    return '[DOM:' + value.nodeName + ']';
                }
                if (typeof Window !== 'undefined' && value instanceof Window) return '[Window]';
                if (typeof Document !== 'undefined' && value instanceof Document) return '[Document]';
            }
            return value;
        }
        try {
            return JSON.stringify(obj, replacer, 2);
        } catch (e) {
            return '[stringify error: ' + e.message + ']';
        }
    }

    function tryGet(fn, fallback) {
        try { return fn(); } catch (e) { return fallback === undefined ? ('[error: ' + e.message + ']') : fallback; }
    }

    function isPlainObject(v) {
        return v && typeof v === 'object' && !Array.isArray(v);
    }

    function findGameGlobals() {
        const builtins = new Set([
            'window','self','document','location','navigator','history','localStorage','sessionStorage',
            'console','screen','performance','crypto','caches','indexedDB','fetch','XMLHttpRequest','WebSocket',
            'setTimeout','setInterval','clearTimeout','clearInterval','requestAnimationFrame','cancelAnimationFrame',
            'alert','confirm','prompt','open','close','print','focus','blur','scroll','scrollTo','scrollBy',
            'addEventListener','removeEventListener','dispatchEvent','postMessage','atob','btoa',
            'innerWidth','innerHeight','outerWidth','outerHeight','scrollX','scrollY','pageXOffset','pageYOffset',
            'devicePixelRatio','screenX','screenY','screenLeft','screenTop','origin','name','status','frames',
            'parent','top','opener','frameElement','length','closed','locationbar','menubar','personalbar',
            'scrollbars','statusbar','toolbar','external','applicationCache','sidebar','speechSynthesis',
            'Worker','SharedWorker','Notification','File','FileReader','Blob','FormData','URL','URLSearchParams',
            'Image','Audio','Video','HTMLElement','Element','Node','Event','CustomEvent','MouseEvent','KeyboardEvent',
            'Promise','Symbol','Proxy','Reflect','Map','Set','WeakMap','WeakSet','ArrayBuffer','DataView',
            'Int8Array','Uint8Array','Int16Array','Uint16Array','Int32Array','Uint32Array','Float32Array','Float64Array',
            'Array','Object','String','Number','Boolean','Date','RegExp','Math','JSON','Function','Error','TypeError',
            'RangeError','SyntaxError','ReferenceError','EvalError','URIError','encodeURIComponent','decodeURIComponent',
            'encodeURI','decodeURI','escape','unescape','isNaN','isFinite','parseInt','parseFloat','NaN','Infinity',
            'globalThis','undefined','null','true','false','eval','arguments',
            '_','moment','ga','gtag','dataLayer','fbq','_fbq','google_tag_manager','__cfWaitingOnAnchor',
            'regeneratorRuntime','webpackChunk','webpackJsonp','__REACT_DEVTOOLS_GLOBAL_HOOK__','__VUE_DEVTOOLS_GLOBAL_HOOK__'
        ]);
        const result = [];
        try {
            const win = unsafeWindow;
            const keys = Object.getOwnPropertyNames(win);
            for (const k of keys) {
                if (builtins.has(k)) continue;
                if (k.startsWith('webkit') || k.startsWith('moz') || k.startsWith('ms')) continue;
                if (k.startsWith('on')) continue;
                try {
                    const v = win[k];
                    if (v === null || v === undefined) continue;
                    if (typeof v === 'function') continue;
                    if (typeof v === 'string' && v.length < 2) continue;
                    if (typeof v === 'number' || typeof v === 'boolean') {
                        result.push({ name: k, type: typeof v, sample: v });
                        continue;
                    }
                    if (typeof v === 'object') {
                        const isArr = Array.isArray(v);
                        const len = isArr ? v.length : Object.keys(v).length;
                        result.push({ name: k, type: isArr ? 'array' : 'object', len: len });
                    }
                } catch (e) { /* getter throws */ }
            }
        } catch (e) {}
        return result;
    }

    function findGirlSources() {
        const sources = [];
        const visited = new WeakSet();

        function isGirlLike(obj) {
            if (!obj || typeof obj !== 'object') return false;
            return (obj.id_girl !== undefined) || (obj.carac1 !== undefined && obj.name !== undefined);
        }

        function scan(root, path, depth) {
            if (depth > 4) return;
            if (!root || typeof root !== 'object') return;
            if (visited.has(root)) return;
            visited.add(root);
            try {
                const keys = Array.isArray(root) ? [] : Object.keys(root);
                for (const k of keys) {
                    let v;
                    try { v = root[k]; } catch (e) { continue; }
                    if (v === null || v === undefined) continue;
                    if (Array.isArray(v) && v.length > 0 && isGirlLike(v[0])) {
                        sources.push({ path: path + '.' + k, count: v.length, ref: v });
                    } else if (isPlainObject(v) && depth < 3) {
                        const innerKeys = Object.keys(v);
                        if (innerKeys.length > 0) {
                            const sample = v[innerKeys[0]];
                            if (isGirlLike(sample)) {
                                sources.push({ path: path + '.' + k, count: innerKeys.length, ref: v, isMap: true });
                            } else {
                                scan(v, path + '.' + k, depth + 1);
                            }
                        }
                    }
                }
            } catch (e) {}
        }

        scan(unsafeWindow, 'window', 0);
        if (unsafeWindow.shared) scan(unsafeWindow.shared, 'shared', 0);
        if (unsafeWindow.hh_nutaku) scan(unsafeWindow.hh_nutaku, 'hh_nutaku', 0);
        if (unsafeWindow.hero_data) scan(unsafeWindow.hero_data, 'hero_data', 0);
        return sources;
    }

    function dumpHeroData() {
        const out = {};
        const keys = ['hero','Hero','hero_data','heroData','player_data','PlayerData','playerStats','Hero_data'];
        for (const k of keys) {
            try {
                if (unsafeWindow[k] !== undefined) out[k] = unsafeWindow[k];
            } catch (e) {}
        }
        try {
            if (unsafeWindow.shared && unsafeWindow.shared.Hero) out['shared.Hero'] = unsafeWindow.shared.Hero;
        } catch (e) {}
        return out;
    }

    function dumpTeamsData() {
        const out = {};
        const keys = [
            'teams_data','teamsData','teams','selected_team','selectedTeam',
            'team_data','teamData','battle_team','battleTeam',
            'availableGirls','girlsDataList','girls_data_list',
            'leaguesPlayersData','leagues_players_data','opponents_list','opponentsList',
            'season_opponents','seasonOpponents','penta_opponents','tower_opponents'
        ];
        for (const k of keys) {
            try {
                if (unsafeWindow[k] !== undefined) out[k] = unsafeWindow[k];
            } catch (e) {}
        }
        return out;
    }

    function dumpBattleData() {
        const out = {};
        const keys = [
            'battle_data','battleData','fight_data','fightData',
            'current_battle','currentBattle','battle_result','battleResult',
            'synergies','element_synergies','theme_elements',
            'boosters_data','boostersData','boosters','mythicBoosters','equippedBoosters',
            'league_data','leagueData','season_data','seasonData',
            'tower_data','towerData','champion_data','championData',
            'labyrinth_data','labyrinthData','penta_drill','pentaDrill',
            'club_data','clubData','arena_data','arenaData',
            'fight_modules','fightModules','game_data','gameData'
        ];
        for (const k of keys) {
            try {
                if (unsafeWindow[k] !== undefined) out[k] = unsafeWindow[k];
            } catch (e) {}
        }
        return out;
    }

    function dumpMarketEquipment() {
        const out = {};
        const keys = [
            'market_data','marketData','shop_data','shopData','items','items_data',
            'girl_armor','girlArmor','equipment','inventory','girl_skills','girlSkills',
            'skill_tiers','skillTiers','awakening_data','awakeningData',
            'mythic_boosters','classBoosters','specialBoosters'
        ];
        for (const k of keys) {
            try {
                if (unsafeWindow[k] !== undefined) out[k] = unsafeWindow[k];
            } catch (e) {}
        }
        return out;
    }

    function dumpHHVars() {
        const out = {};
        try {
            const keys = Object.getOwnPropertyNames(unsafeWindow);
            for (const k of keys) {
                if (k.startsWith('HH_') || k.startsWith('hh_') || k.startsWith('Hh_')) {
                    try {
                        const v = unsafeWindow[k];
                        if (v !== null && v !== undefined && typeof v !== 'function') {
                            out[k] = v;
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}
        return out;
    }

    function dumpShared() {
        const out = {};
        try {
            if (unsafeWindow.shared) {
                for (const k of Object.keys(unsafeWindow.shared)) {
                    try {
                        const v = unsafeWindow.shared[k];
                        if (v !== null && v !== undefined && typeof v !== 'function') {
                            out[k] = v;
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}
        return out;
    }

    function dumpLocalStorage() {
        const out = {};
        try {
            for (const key of Object.keys(localStorage)) {
                const lk = key.toLowerCase();
                if (lk.includes('hhauto') || lk.includes('hh_') || lk.includes('hentai') ||
                    lk.includes('harem') || lk.includes('comix') || lk.includes('pornstar') ||
                    lk.includes('blessing') || lk.includes('girl') || lk.includes('team') ||
                    lk.includes('league') || lk.includes('season') || lk.includes('kinkoid') ||
                    lk.includes('ocd') || lk.includes('trainer') || lk.includes('hero') ||
                    lk.includes('booster') || lk.includes('market')) {
                    try {
                        const raw = localStorage.getItem(key);
                        try { out[key] = JSON.parse(raw); }
                        catch (e) { out[key] = raw; }
                    } catch (e) {}
                }
            }
        } catch (e) {}
        return out;
    }

    function dumpDataAttributes() {
        const out = [];
        try {
            const candidates = document.querySelectorAll(
                '[data-new-girl-tooltip], [data-team], [data-girl-id], [data-blessing], [data-opponent], [data-team-index], [data-team-member-position], [data-id-girl-armor], [data-id-skill]'
            );
            for (let i = 0; i < candidates.length && i < 500; i++) {
                const el = candidates[i];
                const entry = { tag: el.tagName, id: el.id || null, class: el.className || null, attrs: {} };
                for (const a of el.attributes) {
                    if (a.name.startsWith('data-')) {
                        entry.attrs[a.name] = a.value;
                    }
                }
                out.push(entry);
            }
        } catch (e) {}
        return out;
    }

    function dumpEverything() {
        const t0 = Date.now();
        const dump = {
            meta: {
                timestamp: new Date().toISOString(),
                host: location.hostname,
                pathname: location.pathname,
                search: location.search,
                href: location.href,
                userAgent: navigator.userAgent,
                inspectorVersion: '3.0.0'
            },
            globals_overview: tryGet(findGameGlobals, []),
            girl_sources: tryGet(function() {
                const srcs = findGirlSources();
                return srcs.map(function(s) { return { path: s.path, count: s.count, isMap: !!s.isMap }; });
            }, []),
            girls_full: {},
            hero: tryGet(dumpHeroData, {}),
            teams: tryGet(dumpTeamsData, {}),
            battle: tryGet(dumpBattleData, {}),
            market_equipment: tryGet(dumpMarketEquipment, {}),
            hh_namespace: tryGet(dumpHHVars, {}),
            shared_namespace: tryGet(dumpShared, {}),
            local_storage: tryGet(dumpLocalStorage, {}),
            dom_data_attributes: tryGet(dumpDataAttributes, [])
        };

        try {
            const srcs = findGirlSources();
            for (const s of srcs) {
                try {
                    if (s.isMap) {
                        dump.girls_full[s.path] = Object.values(s.ref);
                    } else {
                        dump.girls_full[s.path] = s.ref;
                    }
                } catch (e) {
                    dump.girls_full[s.path] = '[error: ' + e.message + ']';
                }
            }
        } catch (e) {}

        dump.meta.dump_duration_ms = Date.now() - t0;
        return dump;
    }

    function fetchBlessings(callback) {
        try {
            const ajax = unsafeWindow.hh_ajax || unsafeWindow.ajax || (unsafeWindow.shared && unsafeWindow.shared.ajax);
            if (typeof ajax === 'function') {
                let done = false;
                const timer = setTimeout(function() { if (!done) { done = true; callback({ live: null, error: 'timeout' }); } }, 3000);
                ajax({ action: 'get_girls_blessings' }, function(response) {
                    if (done) return;
                    done = true;
                    clearTimeout(timer);
                    callback({ live: response, error: null });
                });
                return;
            }
        } catch (e) {}
        callback({ live: null, error: 'ajax not available' });
    }

    function show(text, fileSuffix) {
        console.log('[HHAuto Inspector] Dump size: ' + text.length + ' chars');
        // Remove any previous overlay
        const old = document.getElementById('hhauto_inspector_overlay');
        if (old) old.remove();

        const ov = document.createElement('div');
        ov.id = 'hhauto_inspector_overlay';
        ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
        const info = document.createElement('div');
        info.style.cssText = 'color:#0f0;font:14px monospace;margin-bottom:10px;';
        info.textContent = 'Dump: ' + text.length.toLocaleString() + ' chars (' + Math.round(text.length/1024) + ' KB) | ' + (fileSuffix || '');
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'width:100%;flex:1;font:11px monospace;padding:10px;border-radius:5px;background:#1a1a1a;color:#0f0;resize:none;';
        const row = document.createElement('div');
        row.style.cssText = 'margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;';

        const cp = document.createElement('button');
        cp.textContent = 'COPY ALL';
        cp.style.cssText = 'padding:12px 24px;font-size:16px;cursor:pointer;background:#4CAF50;color:white;border:none;border-radius:4px;font-weight:bold;';
        cp.onclick = function() {
            ta.select();
            try {
                navigator.clipboard.writeText(text).then(function() { cp.textContent = 'COPIED!'; });
            } catch (e) {
                document.execCommand('copy');
                cp.textContent = 'COPIED!';
            }
        };

        const dl = document.createElement('button');
        dl.textContent = 'DOWNLOAD JSON';
        dl.style.cssText = 'padding:12px 24px;font-size:16px;cursor:pointer;background:#2196F3;color:white;border:none;border-radius:4px;font-weight:bold;';
        dl.onclick = function() {
            const blob = new Blob([text], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const host = location.hostname.replace(/[^a-z0-9]/gi, '_');
            a.download = 'hhauto_dump_' + host + '_' + (fileSuffix || 'all') + '_' + stamp + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

        const cl = document.createElement('button');
        cl.textContent = 'CLOSE';
        cl.style.cssText = 'padding:12px 24px;font-size:16px;cursor:pointer;background:#f44336;color:white;border:none;border-radius:4px;font-weight:bold;';
        cl.onclick = function() { ov.remove(); };

        row.appendChild(cp);
        row.appendChild(dl);
        row.appendChild(cl);
        ov.appendChild(info);
        ov.appendChild(ta);
        ov.appendChild(row);
        document.body.appendChild(ov);
        ta.select();
    }

    function runFullDump() {
        const dump = dumpEverything();
        fetchBlessings(function(blessings) {
            dump.live_blessings_api = blessings;
            const text = safeStringify(dump);
            const page = location.pathname.replace(/[^a-z0-9]/gi, '_') || 'root';
            show(text, page);
        });
    }

    function makeButton() {
        const b = document.createElement('div');
        b.textContent = 'DUMP ALL';
        b.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:#ff4444;color:white;padding:14px 20px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:16px;box-shadow:0 2px 10px rgba(0,0,0,0.5);font-family:monospace;';
        b.onclick = runFullDump;
        b.title = 'Dumps every game variable found on this page';
        document.body.appendChild(b);
    }

    setTimeout(makeButton, 2000);

})();
