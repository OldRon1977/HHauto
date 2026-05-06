// ==UserScript==
// @name         HHAuto Debug - Full Data Inspector
// @namespace    HHAuto_Debug
// @version      4.5.0
// @description  Full game data dumper. Works in both iframe and top-window mode. Auto-tour with persistent state across page reloads. Manual phase for protected pages.
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
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    const VERSION = '4.5.0';
    const LOG_PREFIX = '[Inspector v' + VERSION + ']';

    // ==================== CONFIGURATION ====================

    const AUTO_TOUR = [
        { path: '/home.html',               label: 'Home',              expected: 'home' },
        { path: '/leagues.html',            label: 'League',            expected: 'leaderboard' },
        { path: '/season-arena.html',       label: 'SeasonArena',       expected: 'season_arena' },
        { path: '/penta-drill-arena.html',  label: 'PentaDrillArena',   expected: 'penta_drill_arena' },
        { path: '/penta-drill.html',        label: 'PentaDrill',        expected: 'penta_drill' },
        { path: '/labyrinth.html',          label: 'Labyrinth',         expected: 'labyrinth' },
        { path: '/labyrinth-entrance.html', label: 'LabyrinthEntrance', expected: 'labyrinth-entrance' },
        { path: '/club-champion.html',      label: 'ClubChampion',      expected: 'club_champion' },
        { path: '/champions-map.html',      label: 'ChampionsMap',      expected: 'champions_map' },
        { path: '/shop.html',               label: 'Shop',              expected: 'shop' },
        { path: '/clubs.html',              label: 'Clubs',             expected: 'clubs' },
        { path: '/pantheon.html',           label: 'Pantheon',          expected: 'pantheon' },
        { path: '/season.html',             label: 'Season',            expected: 'season' },
        { path: '/event.html',              label: 'Event',             expected: 'event' },
        { path: '/seasonal.html',           label: 'Seasonal',          expected: 'seasonal' },
        { path: '/path-of-glory.html',      label: 'PathOfGlory',       expected: 'path-of-glory' },
        { path: '/path-of-valor.html',      label: 'PathOfValor',       expected: 'path-of-valor' },
        { path: '/pachinko.html',           label: 'Pachinko',          expected: 'pachinko' },
        { path: '/map.html',                label: 'Map',               expected: 'map' },
        { path: '/waifu.html',              label: 'Waifu',             expected: 'waifu' },
        { path: '/activities.html',                  label: 'Activities',          expected: 'activities' },
        { path: '/activities.html?tab=contests',     label: 'ActContests',         expected: 'activities' },
        { path: '/activities.html?tab=missions',     label: 'ActMissions',         expected: 'activities' },
        { path: '/activities.html?tab=daily_goals',  label: 'ActDailyGoals',       expected: 'activities' },
        { path: '/activities.html?tab=pop',          label: 'ActPoP',              expected: 'activities' },
        { path: '/hero/profile.html',       label: 'HeroProfile',       expected: 'hero_pages' },
        { path: '/member-progression.html', label: 'MemberProgression', expected: 'member-progression' }
    ];

    const MANUAL_TOUR = [
        { path: '/teams.html',              label: 'BattleTeams',       expected: 'teams' },
        { path: '/edit-team.html',          label: 'EditTeam',          expected: 'edit-team' },
        { path: '/characters.html',         label: 'Harem',             expected: 'harem' },
        { path: '/path-of-attraction.html', label: 'PathOfAttraction',  expected: 'path_of_attraction' },
        { path: '/sex-god-path.html',       label: 'SexGodPath',        expected: 'sex-god-path' },
        { path: '/love-raids.html',         label: 'LoveRaids',         expected: 'love_raids' }
    ];

    const STATE_KEY = 'hhauto_inspector_state';
    const RESULT_KEY_PREFIX = 'hhauto_inspector_result_';
    const PAGE_LOAD_WAIT_MS = 8000;     // wait for body[page] to match
    const POST_LOAD_SETTLE_MS = 1500;   // extra wait after match for late-binding JS
    const PAGE_TRANSITION_DELAY_MS = 800;

    // ==================== STORAGE ====================

    function saveState(state) {
        try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
        catch (e) { console.error(LOG_PREFIX, 'saveState failed:', e); }
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STATE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function clearState() {
        // Remove inspector state and any leftover result entries (including from old versions
        // that stored full dumps in localStorage - they can fill up the quota).
        try { localStorage.removeItem(STATE_KEY); } catch (e) {}
        // Clean up by prefix to also remove orphaned keys from previous tour runs
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (k.startsWith(RESULT_KEY_PREFIX) || k === 'hhauto_last_tour' || k === 'hhauto_inspector_overlay')) {
                    keysToRemove.push(k);
                }
            }
            for (const k of keysToRemove) {
                try { localStorage.removeItem(k); } catch (e) {}
            }
            console.log(LOG_PREFIX, 'Cleared', keysToRemove.length, 'inspector storage keys');
        } catch (e) { console.warn(LOG_PREFIX, 'clearState scan failed:', e); }
    }

    // No localStorage results - each step downloads its own file immediately.
    // Only the tour state (current index, started timestamp) is persisted.
    async function saveResult(idx, dump, step) {
        try {
            // Serialize through safeStringify (drops DOM/Window/circular refs) so that
            // IndexedDB's structured clone never sees an unsupported object.
            const text = safeStringify(dump);
            const cleanDump = JSON.parse(text);
            await idbPut(idx, cleanDump);
            return { ok: true, size: text.length };
        } catch (e) {
            console.error(LOG_PREFIX, 'idbPut failed at idx ' + idx + ':', e);
            return { ok: false, size: 0, error: e.message || String(e) };
        }
    }

    function loadAllResults() {
        return [];
    }

    // ==================== IndexedDB result store ====================
    // Each step writes its dump to IndexedDB. Quota is per-origin and ~50% of free disk
    // space - effectively unlimited for our 5-50 MB tour bundles.

    const IDB_NAME = 'hhauto_inspector';
    const IDB_VERSION = 1;
    const IDB_STORE = 'tour_results';

    function idbOpen() {
        return new Promise(function(resolve, reject) {
            try {
                const req = indexedDB.open(IDB_NAME, IDB_VERSION);
                req.onupgradeneeded = function(e) {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(IDB_STORE)) {
                        db.createObjectStore(IDB_STORE, { keyPath: 'idx' });
                    }
                };
                req.onsuccess = function(e) { resolve(e.target.result); };
                req.onerror = function(e) { reject(e.target.error); };
            } catch (e) { reject(e); }
        });
    }

    function idbPut(idx, dump) {
        return idbOpen().then(function(db) {
            return new Promise(function(resolve, reject) {
                const tx = db.transaction(IDB_STORE, 'readwrite');
                const store = tx.objectStore(IDB_STORE);
                const req = store.put({ idx: idx, dump: dump });
                req.onsuccess = function() { resolve(); };
                req.onerror = function(e) { reject(e.target.error); };
            }).finally(function() { db.close(); });
        });
    }

    function idbGetAll() {
        return idbOpen().then(function(db) {
            return new Promise(function(resolve, reject) {
                const tx = db.transaction(IDB_STORE, 'readonly');
                const store = tx.objectStore(IDB_STORE);
                const req = store.getAll();
                req.onsuccess = function(e) {
                    const rows = e.target.result || [];
                    rows.sort(function(a, b) { return a.idx - b.idx; });
                    resolve(rows);
                };
                req.onerror = function(e) { reject(e.target.error); };
            }).finally(function() { db.close(); });
        });
    }

    function idbClear() {
        return idbOpen().then(function(db) {
            return new Promise(function(resolve, reject) {
                const tx = db.transaction(IDB_STORE, 'readwrite');
                const store = tx.objectStore(IDB_STORE);
                const req = store.clear();
                req.onsuccess = function() { resolve(); };
                req.onerror = function(e) { reject(e.target.error); };
            }).finally(function() { db.close(); });
        });
    }

        // ==================== HELPERS ====================

    function safeStringify(obj) {
        const seen = new WeakSet();
        function replacer(key, value) {
            if (typeof value === 'function') return '[function]';
            if (typeof value === 'undefined') return '[undefined]';
            if (value instanceof Error) return '[Error: ' + value.message + ']';
            if (value && typeof value === 'object') {
                if (seen.has(value)) return '[circular]';
                seen.add(value);
                if (value.nodeType !== undefined && value.nodeName !== undefined) return '[DOM:' + value.nodeName + ']';
                try {
                    if (typeof Window !== 'undefined' && value instanceof Window) return '[Window]';
                    if (typeof Document !== 'undefined' && value instanceof Document) return '[Document]';
                } catch (e) {}
            }
            return value;
        }
        try { return JSON.stringify(obj, replacer, 2); }
        catch (e) { return '[stringify error: ' + e.message + ']'; }
    }

    function tryGet(fn, fallback) {
        try { return fn(); } catch (e) { return fallback === undefined ? null : fallback; }
    }

    function isPlainObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

    function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

    // ==================== GAME CONTEXT (iframe or top-window) ====================

    function findGameIframe() {
        const knownIds = ['hh_hentai','hh_comix','hh_star','hh_stargay','hh_startrans','hh_gay','hh_amour','hh_mangarpg','hh_sexy','hh_game'];
        for (const id of knownIds) {
            try {
                const f = document.getElementById(id);
                if (f && f.tagName === 'IFRAME') return f;
            } catch (e) {}
        }
        // Generic scan: any iframe with same-origin contentWindow exposing game globals
        try {
            const frames = document.querySelectorAll('iframe');
            for (const f of frames) {
                try {
                    const w = f.contentWindow;
                    if (!w) continue;
                    if (w.shared || w.Hero || w.availableGirls || w.hh_ajax) return f;
                } catch (e) { /* cross-origin */ }
            }
        } catch (e) {}
        return null;
    }

    function detectMode() {
        // top-window mode: game globals directly on unsafeWindow
        try {
            if (unsafeWindow.shared || unsafeWindow.Hero || unsafeWindow.availableGirls || unsafeWindow.hh_ajax) {
                return { mode: 'top-window', win: unsafeWindow, doc: document, iframe: null };
            }
        } catch (e) {}
        // iframe mode
        const iframe = findGameIframe();
        if (iframe) {
            try {
                const w = iframe.contentWindow;
                const d = iframe.contentDocument || (w && w.document);
                if (w) return { mode: 'iframe', win: w, doc: d, iframe: iframe };
            } catch (e) {}
        }
        // Nothing found - default to top-window (game might still be loading)
        return { mode: 'unknown', win: unsafeWindow, doc: document, iframe: null };
    }

    function getCurrentBodyPage(ctx) {
        try {
            const d = ctx.doc || document;
            const body = d.querySelector('body[page]');
            return body ? body.getAttribute('page') : null;
        } catch (e) { return null; }
    }

    async function waitForBodyPage(expected, maxWaitMs) {
        const interval = 250;
        const deadline = Date.now() + maxWaitMs;
        while (Date.now() < deadline) {
            const ctx = detectMode();
            const cur = getCurrentBodyPage(ctx);
            if (cur === expected) return { matched: true, actual: cur, ctx: ctx };
            await sleep(interval);
        }
        const ctx = detectMode();
        return { matched: false, actual: getCurrentBodyPage(ctx), ctx: ctx };
    }

    function navigateTo(path, ctx) {
        const target = location.origin + path;
        if (ctx.iframe) {
            // iframe mode: change src - script keeps running
            try { ctx.iframe.src = target; return 'iframe'; }
            catch (e) {}
        }
        // top-window mode: full reload
        location.href = target;
        return 'top-window';
    }

    // ==================== DATA COLLECTION ====================

    function findGameGlobals(ctx) {
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
            const win = ctx.win;
            for (const k of Object.getOwnPropertyNames(win)) {
                if (builtins.has(k)) continue;
                if (k.startsWith('webkit') || k.startsWith('moz') || k.startsWith('ms') || k.startsWith('on')) continue;
                try {
                    const v = win[k];
                    if (v === null || v === undefined || typeof v === 'function') continue;
                    if (typeof v === 'string' && v.length < 2) continue;
                    if (typeof v === 'number' || typeof v === 'boolean') {
                        result.push({ name: k, type: typeof v, sample: v });
                        continue;
                    }
                    if (typeof v === 'object') {
                        const isArr = Array.isArray(v);
                        result.push({ name: k, type: isArr ? 'array' : 'object', len: isArr ? v.length : Object.keys(v).length });
                    }
                } catch (e) {}
            }
        } catch (e) {}
        return result;
    }

    function findGirlSources(ctx) {
        const sources = [];
        const visited = new WeakSet();
        function isGirlLike(obj) {
            if (!obj || typeof obj !== 'object') return false;
            return (obj.id_girl !== undefined) || (obj.carac1 !== undefined && obj.name !== undefined);
        }
        function scan(root, path, depth) {
            if (depth > 4) return;
            if (!root || typeof root !== 'object' || visited.has(root)) return;
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
                            if (isGirlLike(sample)) sources.push({ path: path + '.' + k, count: innerKeys.length, ref: v, isMap: true });
                            else scan(v, path + '.' + k, depth + 1);
                        }
                    }
                }
            } catch (e) {}
        }
        const w = ctx.win;
        scan(w, 'game', 0);
        try { if (w.shared) scan(w.shared, 'game.shared', 0); } catch (e) {}
        try { if (w.hh_nutaku) scan(w.hh_nutaku, 'game.hh_nutaku', 0); } catch (e) {}
        try { if (w.hero_data) scan(w.hero_data, 'game.hero_data', 0); } catch (e) {}
        return sources;
    }

    // Extract primitive (non-DOM, non-circular) fields from a possibly-circular object.
    function extractPrimitives(obj, depth, seen) {
        if (depth === undefined) depth = 0;
        if (!seen) seen = new WeakSet();
        if (obj === null || obj === undefined) return obj;
        const t = typeof obj;
        if (t === 'number' || t === 'string' || t === 'boolean') return obj;
        if (t === 'function') return undefined;
        if (depth > 4) return '[depth-limit]';
        if (t === 'object') {
            if (seen.has(obj)) return '[circular]';
            seen.add(obj);
        }
        if (Array.isArray(obj)) {
            const out = [];
            for (let i = 0; i < obj.length && i < 100; i++) {
                try {
                    const v = obj[i];
                    if (v && typeof v === 'object' && v.nodeType !== undefined) continue;
                    out.push(extractPrimitives(v, depth + 1, seen));
                } catch (e) {}
            }
            return out;
        }
        if (t === 'object') {
            const out = {};
            try {
                for (const k of Object.keys(obj)) {
                    try {
                        const v = obj[k];
                        if (v === null || v === undefined) { out[k] = v; continue; }
                        const vt = typeof v;
                        if (vt === 'function') continue;
                        if (vt === 'number' || vt === 'string' || vt === 'boolean') { out[k] = v; continue; }
                        if (v instanceof Date) { out[k] = v.toISOString(); continue; }
                        if (v.nodeType !== undefined && v.nodeName !== undefined) continue;
                        try { if (typeof Window !== 'undefined' && v instanceof Window) continue; } catch (e) {}
                        try { if (typeof Document !== 'undefined' && v instanceof Document) continue; } catch (e) {}
                        out[k] = extractPrimitives(v, depth + 1, seen);
                    } catch (e) {}
                }
            } catch (e) {}
            return out;
        }
        return undefined;
    }

    function dumpHeroInfos(ctx) {
        const out = {};
        try {
            const w = ctx.win;
            const h = w.shared && w.shared.Hero;
            if (!h) return out;
            for (const key of ['infos', 'caracs', 'currencies', 'energies', 'club', 'mc_level']) {
                try {
                    if (h[key] !== undefined) {
                        out[key] = extractPrimitives(h[key], 0, new WeakSet());
                    }
                } catch (e) {}
            }
        } catch (e) {}
        return out;
    }

    function dumpEverything(ctx) {
        const t0 = Date.now();
        const w = ctx.win;
        const d = ctx.doc;

        const heroData = {};
        for (const k of ['hero','Hero','hero_data','heroData','player_data','PlayerData','playerStats']) {
            try { if (w[k] !== undefined) heroData[k] = w[k]; } catch (e) {}
        }
        try { if (w.shared && w.shared.Hero) heroData['shared.Hero'] = w.shared.Hero; } catch (e) {}
        try { if (w.shared && w.shared.general) heroData['shared.general'] = w.shared.general; } catch (e) {}

        const teamsData = {};
        for (const k of [
            'teams_data','teamsData','teams','selected_team','selectedTeam',
            'team_data','teamData','battle_team','battleTeam',
            'availableGirls','girlsDataList','girls_data_list',
            'leaguesPlayersData','leagues_players_data','opponents_list','opponentsList',
            'season_opponents','seasonOpponents','penta_opponents','tower_opponents',
            'girl_squad','teamGirls','opponents','season_girls'
        ]) {
            try { if (w[k] !== undefined) teamsData[k] = w[k]; } catch (e) {}
        }

        const battleData = {};
        for (const k of [
            'battle_data','fight_data','current_battle','battle_result',
            'synergies','element_synergies','theme_elements',
            'boosters_data','boosters','mythicBoosters','equippedBoosters',
            'league_data','season_data','league_rewards',
            'tower_data','champion_data','championData',
            'labyrinth_data','penta_drill','penta_drill_data',
            'club_data','arena_data','game_data',
            'current_tier_number','league_tag','event_data','current_event',
            'seasonal_event_active','mega_event_active','mega_event_data',
            'season_sec_untill_event_end','seasonal_time_remaining','mega_event_time_remaining',
            'has_contests_datas','contests_timer','daily_goals_list',
            'love_raids','pop_list','pop_index','player_gems_amount'
        ]) {
            try { if (w[k] !== undefined) battleData[k] = w[k]; } catch (e) {}
        }

        const marketData = {};
        for (const k of [
            'market_data','shop_data','items','items_data','shop',
            'girl_armor','equipment','inventory','girl_skills',
            'skill_tiers','awakening_data',
            'mythic_boosters','classBoosters','specialBoosters','hh_prices'
        ]) {
            try { if (w[k] !== undefined) marketData[k] = w[k]; } catch (e) {}
        }

        const hhNamespace = {};
        try {
            for (const k of Object.getOwnPropertyNames(w)) {
                if (k.startsWith('HH_') || k.startsWith('hh_') || k.startsWith('Hh_')) {
                    try {
                        const v = w[k];
                        if (v !== null && v !== undefined && typeof v !== 'function') hhNamespace[k] = v;
                    } catch (e) {}
                }
            }
        } catch (e) {}

        const sharedNs = {};
        try {
            if (w.shared) {
                for (const k of Object.keys(w.shared)) {
                    try {
                        const v = w.shared[k];
                        if (v !== null && v !== undefined && typeof v !== 'function') sharedNs[k] = v;
                    } catch (e) {}
                }
            }
        } catch (e) {}

        const localStorageData = { top: {}, game: {} };
        function scanStorage(storage, target) {
            if (!storage) return;
            try {
                for (const key of Object.keys(storage)) {
                    const lk = key.toLowerCase();
                    if (lk.includes('hhauto') || lk.includes('hh_') || lk.includes('hentai') ||
                        lk.includes('harem') || lk.includes('comix') || lk.includes('pornstar') ||
                        lk.includes('blessing') || lk.includes('girl') || lk.includes('team') ||
                        lk.includes('league') || lk.includes('season') || lk.includes('kinkoid') ||
                        lk.includes('ocd') || lk.includes('trainer') || lk.includes('hero') ||
                        lk.includes('booster') || lk.includes('market')) {
                        try {
                            const raw = storage.getItem(key);
                            try { target[key] = JSON.parse(raw); }
                            catch (e) { target[key] = raw; }
                        } catch (e) {}
                    }
                }
            } catch (e) {}
        }
        scanStorage(localStorage, localStorageData.top);
        try {
            if (ctx.win !== unsafeWindow && ctx.win.localStorage) scanStorage(ctx.win.localStorage, localStorageData.game);
        } catch (e) {}

        const domAttrs = [];
        try {
            const candidates = (d || document).querySelectorAll(
                '[data-new-girl-tooltip], [data-team], [data-girl-id], [data-blessing], [data-opponent], ' +
                '[data-team-index], [data-team-member-position], [data-id-girl-armor], [data-id-skill], ' +
                '[data-d], [data-rewards], [data-power], [data-time-stamp], [data-nc-reward-id], ' +
                '[data-pantheon-id], [data-battles], [data-tab], [data-href], [data-select-girl-id]'
            );
            for (let i = 0; i < candidates.length && i < 1000; i++) {
                const el = candidates[i];
                const entry = { tag: el.tagName, id: el.id || null, class: el.className || null, attrs: {} };
                for (const a of el.attributes) {
                    if (a.name.startsWith('data-')) entry.attrs[a.name] = a.value;
                }
                domAttrs.push(entry);
            }
        } catch (e) {}

        const gameContext = { mode: ctx.mode };
        try {
            const body = (d || document).querySelector('body[page]');
            if (body) {
                gameContext.body_id = body.id || null;
                gameContext.body_page = body.getAttribute('page');
            }
            gameContext.location = {
                href: (w.location && w.location.href) || null,
                pathname: (w.location && w.location.pathname) || null,
                search: (w.location && w.location.search) || null
            };
        } catch (e) {}

        const dump = {
            meta: {
                timestamp: new Date().toISOString(),
                host: location.hostname,
                pathname: location.pathname,
                search: location.search,
                href: location.href,
                inspectorVersion: VERSION,
                mode: ctx.mode
            },
            game_context: gameContext,
            globals_overview: tryGet(function() { return findGameGlobals(ctx); }, []),
            girl_sources: tryGet(function() {
                return findGirlSources(ctx).map(function(s) { return { path: s.path, count: s.count, isMap: !!s.isMap }; });
            }, []),
            girls_full: {},
            hero: heroData,
            hero_infos: tryGet(function() { return dumpHeroInfos(ctx); }, {}),
            teams: teamsData,
            battle: battleData,
            market_equipment: marketData,
            hh_namespace: hhNamespace,
            shared_namespace: sharedNs,
            local_storage: localStorageData,
            dom_data_attributes: domAttrs
        };

        try {
            const sources = findGirlSources(ctx);
            for (const s of sources) {
                try {
                    if (s.isMap) dump.girls_full[s.path] = Object.values(s.ref);
                    else dump.girls_full[s.path] = s.ref;
                } catch (e) { dump.girls_full[s.path] = '[error: ' + e.message + ']'; }
            }
        } catch (e) {}

        dump.meta.dump_duration_ms = Date.now() - t0;
        return dump;
    }

    function fetchBlessings(ctx, callback) {
        try {
            const w = ctx.win;
            const ajax = (w.shared && w.shared.general && w.shared.general.hh_ajax) || w.hh_ajax || w.ajax;
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

    // ==================== UI ====================

    function mkBtn(text, color, onclick) {
        const b = document.createElement('button');
        b.textContent = text;
        b.style.cssText = 'padding:6px 14px;font-size:12px;cursor:pointer;background:' + color + ';color:white;border:none;border-radius:4px;font-weight:bold;';
        b.onclick = onclick;
        return b;
    }

    function downloadJson(text, suffix) {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const host = location.hostname.replace(/[^a-z0-9]/gi, '_');
        a.download = 'hhauto_dump_' + host + '_' + (suffix || 'all') + '_' + stamp + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function ensureStatusBar() {
        let bar = document.getElementById('hhauto_status_bar');
        if (bar) return bar;
        bar = document.createElement('div');
        bar.id = 'hhauto_status_bar';
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#1a1a1a;color:#0f0;font:13px monospace;padding:8px 14px;z-index:1000000;box-shadow:0 4px 14px rgba(0,0,0,0.7);border-bottom:3px solid #ffb827;display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-height:24px;';
        document.body.appendChild(bar);
        return bar;
    }

    function setStatusBar(html, buttons) {
        const bar = ensureStatusBar();
        bar.innerHTML = '';
        const msg = document.createElement('div');
        msg.style.cssText = 'flex:1;min-width:240px';
        msg.innerHTML = html;
        bar.appendChild(msg);
        if (buttons) {
            for (const btn of buttons) bar.appendChild(btn);
        }
    }

    function clearStatusBar() {
        const bar = document.getElementById('hhauto_status_bar');
        if (bar) bar.remove();
    }

    function showSingleDumpOverlay(text, suffix) {
        const old = document.getElementById('hhauto_overlay');
        if (old) old.remove();
        const ov = document.createElement('div');
        ov.id = 'hhauto_overlay';
        ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
        const info = document.createElement('div');
        info.style.cssText = 'color:#0f0;font:14px monospace;margin-bottom:10px;';
        info.textContent = 'Dump: ' + text.length.toLocaleString() + ' chars (' + Math.round(text.length/1024) + ' KB) | ' + (suffix || '');
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'width:100%;flex:1;font:11px monospace;padding:10px;border-radius:5px;background:#1a1a1a;color:#0f0;resize:none;';
        const row = document.createElement('div');
        row.style.cssText = 'margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;';
        const cp = mkBtn('COPY ALL', '#4CAF50', function() {
            ta.select();
            try { navigator.clipboard.writeText(text).then(function() { cp.textContent = 'COPIED!'; }); }
            catch (e) { document.execCommand('copy'); cp.textContent = 'COPIED!'; }
        });
        const dl = mkBtn('DOWNLOAD JSON', '#2196F3', function() { downloadJson(text, suffix); });
        const cl = mkBtn('CLOSE', '#f44336', function() { ov.remove(); });
        row.appendChild(cp); row.appendChild(dl); row.appendChild(cl);
        ov.appendChild(info); ov.appendChild(ta); ov.appendChild(row);
        document.body.appendChild(ov);
        ta.select();
    }

    // ==================== TOUR DRIVER ====================

    async function performStep(globalIdx, step, isManual) {
        console.log(LOG_PREFIX, 'Step', globalIdx + 1, ':', step.label, 'expected=' + step.expected);
        let waited;
        if (!isManual) {
            // Auto step - wait for body[page] to match expected
            setStatusBar('<b style=\"color:#ffb827\">' + (globalIdx+1) + '. ' + step.label + '</b> &mdash; waiting for page to load...');
            waited = await waitForBodyPage(step.expected, PAGE_LOAD_WAIT_MS);
        } else {
            waited = { matched: true, actual: getCurrentBodyPage(detectMode()), ctx: detectMode() };
        }
        await sleep(POST_LOAD_SETTLE_MS);

        const ctx = detectMode();
        setStatusBar('<b style=\"color:#ffb827\">' + (globalIdx+1) + '. ' + step.label + '</b> &mdash; dumping data...');
        const dump = dumpEverything(ctx);

        await new Promise(function(resolve) {
            fetchBlessings(ctx, function(blessings) {
                dump.live_blessings_api = blessings;
                resolve();
            });
        });

        const actualPage = getCurrentBodyPage(ctx);
        dump.tour_meta = {
            label: step.label,
            requested_path: step.path,
            expected_page: step.expected,
            actual_page: actualPage,
            match: actualPage === step.expected,
            manual: !!isManual,
            global_index: globalIdx
        };

        const saveInfo = await saveResult(globalIdx, dump, step);
        console.log(LOG_PREFIX, 'Step', globalIdx + 1, 'done:', step.label, 'match=' + dump.tour_meta.match, 'size=' + Math.round(saveInfo.size/1024) + 'KB');
        return { dump: dump, saveInfo: saveInfo };
    }

    async function continueAutoTour(state) {
        const totalAuto = AUTO_TOUR.length;
        const totalManual = MANUAL_TOUR.length;
        // Current step:
        const idx = state.index;
        if (idx < totalAuto) {
            // Auto phase
            const step = AUTO_TOUR[idx];
            let stepOk = false;
            try {
                const res = await performStep(idx, step, false);
                stepOk = !!(res && res.saveInfo && res.saveInfo.ok);
            } catch (e) {
                console.error(LOG_PREFIX, 'Step error at auto idx', idx, ':', e);
            }
            // Advance
            state.index = idx + 1;
            if (stepOk) state.completedSteps = (state.completedSteps || 0) + 1;
            saveState(state);
            if (state.index >= totalAuto) {
                // Auto phase done, switch to manual
                setStatusBar('<b style=\"color:#4CAF50\">Auto phase done.</b> &mdash; Manual phase: navigate via game UI then click DUMP NOW.', []);
                console.log(LOG_PREFIX, 'Auto phase done, entering manual phase.');
                await sleep(1500);
                await showManualPrompt(state);
                return;
            }
            // Navigate to next auto step
            const next = AUTO_TOUR[state.index];
            const ctx = detectMode();
            setStatusBar('<b style=\"color:#ffb827\">Step ' + (state.index+1) + '/' + (totalAuto+totalManual) + ': ' + next.label + '</b> &mdash; navigating...');
            await sleep(PAGE_TRANSITION_DELAY_MS);
            navigateTo(next.path, ctx);
            // If iframe mode: continue running. If top-window: page reloads, init() resumes.
            if (ctx.mode === 'iframe' || ctx.mode === 'unknown') {
                // wait a bit then loop
                await sleep(500);
                await continueAutoTour(loadState());
            }
            return;
        }
        // Should not reach here in auto phase
    }

    async function showManualPrompt(state) {
        const totalAuto = AUTO_TOUR.length;
        const manualIdx = state.index - totalAuto;
        if (manualIdx >= MANUAL_TOUR.length) {
            await finishTour(state);
            return;
        }
        const step = MANUAL_TOUR[manualIdx];
        const ctx = detectMode();
        const cur = getCurrentBodyPage(ctx) || '?';

        // If user already navigated to expected page, give them a quick dump button
        const dumpBtn = mkBtn('DUMP NOW', '#4CAF50', async function() {
            dumpBtn.disabled = true;
            let stepOk = false;
            try {
                const res = await performStep(state.index, step, true);
                stepOk = !!(res && res.saveInfo && res.saveInfo.ok);
            } catch (e) {
                console.error(LOG_PREFIX, 'Manual step failed:', e);
            }
            state.index++;
            if (stepOk) state.completedSteps = (state.completedSteps || 0) + 1;
            saveState(state);
            if (state.index >= totalAuto + MANUAL_TOUR.length) {
                await finishTour(state);
            } else {
                await showManualPrompt(state);
            }
        });
        const skipBtn = mkBtn('SKIP', '#ff9800', async function() {
            console.log(LOG_PREFIX, 'Manual skip:', step.label);
            state.index++;
            saveState(state);
            if (state.index >= totalAuto + MANUAL_TOUR.length) await finishTour(state);
            else await showManualPrompt(state);
        });
        const abortBtn = mkBtn('ABORT', '#f44336', async function() {
            console.log(LOG_PREFIX, 'Manual abort');
            await finishTour(state);
        });

        setStatusBar(
            'Manual ' + (manualIdx+1) + '/' + MANUAL_TOUR.length + ': open <b style=\"color:#ffb827\">' + step.label + '</b> in game ' +
            '<span style=\"color:#888\">(want body[page]=' + step.expected + ', currently=' + cur + ')</span>',
            [dumpBtn, skipBtn, abortBtn]
        );
    }

    async function finishTour(state) {
        const totalDur = state.startedAt ? Math.round((Date.now() - state.startedAt) / 1000) : 0;
        const completed = state.completedSteps || 0;
        const total = AUTO_TOUR.length + MANUAL_TOUR.length;

        setStatusBar('Tour finished. Assembling bundle from IndexedDB...', []);
        let rows = [];
        try {
            rows = await idbGetAll();
        } catch (e) {
            console.error(LOG_PREFIX, 'idbGetAll failed:', e);
        }
        const pages = rows.map(function(r) { return r.dump; });
        const bundle = {
            meta: {
                timestamp: new Date().toISOString(),
                host: location.hostname,
                href: location.href,
                inspectorVersion: VERSION,
                tour_pages: total,
                tour_completed_pages: pages.length,
                tour_duration_sec: totalDur
            },
            pages: pages
        };
        const text = safeStringify(bundle);
        const sizeKb = Math.round(text.length / 1024);
        downloadJson(text, 'tour');
        try { await idbClear(); } catch (e) {}
        clearState();
        setStatusBar(
            'Tour finished: ' + pages.length + '/' + total + ' pages, ' + sizeKb + ' KB, ' + totalDur + 's. Bundle downloaded.',
            [
                mkBtn('REVIEW BUNDLE', '#2196F3', function() { showSingleDumpOverlay(text, 'tour'); }),
                mkBtn('CLOSE', '#888', function() { clearStatusBar(); makeButtons(); })
            ]
        );
        console.log(LOG_PREFIX, 'Tour finished:', pages.length, 'pages,', sizeKb, 'KB,', totalDur, 's');
    }

        async function startTour() {
        if (loadState()) {
            if (!confirm('A tour is already in progress. Restart from scratch?')) return;
        }
        clearState();
        try { await idbClear(); } catch (e) { console.warn(LOG_PREFIX, 'idbClear before start failed:', e); }
        const state = {
            running: true,
            index: 0,
            startedAt: Date.now()
        };
        saveState(state);
        console.log(LOG_PREFIX, 'Tour started.');
        const ctx = detectMode();
        navigateTo(AUTO_TOUR[0].path, ctx);
        if (ctx.mode === 'iframe' || ctx.mode === 'unknown') {
            // iframe mode: stay in same JS run, drive tour from here
            (async function() {
                await sleep(PAGE_TRANSITION_DELAY_MS);
                await continueAutoTour(loadState());
            })();
        }
        // top-window mode: page reloads, init() picks up state and continues
    }

    function abortTour() {
        if (!loadState()) return;
        if (!confirm('Abort current tour?')) return;
        const state = loadState();
        finishTour(state);
    }

    // ==================== INIT ====================

    function makeButtons() {
        const old = document.getElementById('hhauto_buttons');
        if (old) old.remove();
        const wrap = document.createElement('div');
        wrap.id = 'hhauto_buttons';
        wrap.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;display:flex;flex-direction:column;gap:6px;font-family:monospace;';

        const single = document.createElement('div');
        single.textContent = 'DUMP THIS PAGE';
        single.style.cssText = 'background:#ff4444;color:white;padding:14px 20px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,0.5);text-align:center;';
        single.onclick = function() {
            const ctx = detectMode();
            const dump = dumpEverything(ctx);
            fetchBlessings(ctx, function(blessings) {
                dump.live_blessings_api = blessings;
                const text = safeStringify(dump);
                const body = (ctx.doc || document).querySelector('body[page]');
                const suffix = body ? body.getAttribute('page').replace(/[^a-z0-9]/gi, '_') : 'page';
                showSingleDumpOverlay(text, suffix);
            });
        };

        const tour = document.createElement('div');
        tour.textContent = 'AUTO TOUR';
        tour.style.cssText = 'background:#2196F3;color:white;padding:14px 20px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,0.5);text-align:center;';
        tour.onclick = function() { startTour(); };
        tour.title = AUTO_TOUR.length + ' auto pages, then ' + MANUAL_TOUR.length + ' manual pages, then bundle download.';

        wrap.appendChild(single);
        wrap.appendChild(tour);
        document.body.appendChild(wrap);
    }

    function startupCleanup() {
        // Clean any orphaned result entries from prior runs/versions BEFORE we check tour state.
        // This frees localStorage quota that may have been blocking saves.
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(RESULT_KEY_PREFIX)) {
                    keysToRemove.push(k);
                }
            }
            for (const k of keysToRemove) {
                try { localStorage.removeItem(k); } catch (e) {}
            }
            // Also remove the legacy bundle key if present.
            try { localStorage.removeItem('hhauto_last_tour'); } catch (e) {}
            if (keysToRemove.length > 0) {
                console.log(LOG_PREFIX, 'Startup cleanup removed', keysToRemove.length, 'orphaned result keys');
            }
        } catch (e) { console.warn(LOG_PREFIX, 'startupCleanup failed:', e); }
    }

    function init() {
        console.log(LOG_PREFIX, 'init, location:', location.href);
        startupCleanup();
        const state = loadState();
        if (state && state.running) {
            console.log(LOG_PREFIX, 'Resuming tour at index', state.index);
            const totalAuto = AUTO_TOUR.length;
            const totalManual = MANUAL_TOUR.length;
            // Add abort button to overlay
            const abortBtn = mkBtn('ABORT TOUR', '#f44336', abortTour);
            setStatusBar('Resuming tour at step ' + (state.index+1) + '/' + (totalAuto+totalManual) + '...', [abortBtn]);
            (async function() {
                await sleep(1000); // give game JS time to settle
                if (state.index < totalAuto) {
                    await continueAutoTour(state);
                } else {
                    await showManualPrompt(state);
                }
            })();
        } else {
            makeButtons();
        }
    }

    setTimeout(init, 2000);

})();
