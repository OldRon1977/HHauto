// ==UserScript==
// @name         HHAuto Debug - Full Data Inspector
// @namespace    HHAuto_Debug
// @version      4.8.1
// @description  Full game data dumper. DUMP THIS PAGE / DUMP FOR SHARING / AUTO TOUR. Persistent XHR + fetch hooks. Optional PII share-mode pipeline anonymises dumps for public bug reports.
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
// @updateURL    https://github.com/OldRon1977/HHauto/raw/main/bonus-scripts/HHAuto_debug_inspector.user.js
// @downloadURL  https://github.com/OldRon1977/HHauto/raw/main/bonus-scripts/HHAuto_debug_inspector.user.js
// ==/UserScript==

(function() {
    //
    // PII share-mode (since v4.8.0)
    // ----------------------------
    // The inspector can produce two kinds of dumps:
    //
    //   * Default (PII_MODE = "off", DUMP THIS PAGE / AUTO TOUR):
    //     full local-only dump with hero nickname, chat_token, full
    //     HHAuto settings export, opponent nicknames etc. Suitable
    //     for private maintainer review only.
    //
    //   * Share mode (PII_MODE = "share" or DUMP FOR SHARING button):
    //     dump goes through an anonymisation pipeline with five steps
    //     (top-level whitelist, plain-text strip, settings whitelist,
    //     id hashing + pseudonymisation with per-dump shuffle, time
    //     rounding) plus an audit block at meta.pii. A fresh random
    //     salt is generated per dump and never persisted, so two
    //     consecutive share-mode dumps from the same player produce
    //     decorrelated id hashes and a different harem permutation.
    //     Suitable for public bug reports.
    //
    // The DUMP FOR SHARING button forces share mode for a single click
    // regardless of PII_MODE, so the user does not need to edit the
    // script to file a bug. AUTO TOUR honours PII_MODE.
    //
    // Reference: docs-internal/inspector-pii-share-mode.md
    //
    'use strict';

    const VERSION = '4.8.0';
    const LOG_PREFIX = '[Inspector v' + VERSION + ']';

    // PII share-mode toggle. Single source of truth for the share pipeline.
    //   "off"   -> dumps are not anonymised (default, byte-identical to v4.7.0).
    //   "share" -> share pipeline runs after dumpEverything+fetchBlessings and
    //              before safeStringify+downloadJson. The DUMP FOR SHARING button
    //              forces share mode regardless of this constant.
    const PII_MODE = "off"; // "off" | "share"

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

    // Passive AJAX-response capture (Game-API only, observed via XHR hook).
    const AJAX_CAPTURE_PER_STEP_LIMIT = 50;            // max responses per step
    const AJAX_CAPTURE_RESPONSE_BYTE_LIMIT = 100 * 1024; // truncate larger responses
    const AJAX_CAPTURE_SETTLE_EXTRA_MS = 1500;         // additional wait while observer is active

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

    // ==================== AJAX OBSERVER (persistent XHR + fetch capture) ====================
    // Patches XMLHttpRequest.prototype and window.fetch on the target window(s).
    // Hooks install once per window (idempotent via __hh_inspector_hooked) and run
    // for the full inspector lifetime; the per-step buffer is sliced via marker
    // indices. Read-only: no requests are issued by the observer itself.

    const __hh_ajax_buffer = [];

    function looksLikeGameAjax(url, body) {
        try {
            if (!url) return false;
            // Same-origin or relative paths win
            if (typeof url === 'string' && url.charAt(0) === '/' && url.charAt(1) !== '/') return true;
            try {
                const u = new URL(url, location.href);
                if (u.host === location.host) {
                    if (/[?&](action|class)=/.test(u.search)) return true;
                    if (u.pathname.indexOf('/phoenix-') === 0) return true;
                    if (u.pathname.indexOf('/ajax.php') >= 0) return true;
                    if (u.pathname.indexOf('/api') >= 0) return true;
                    return true; // same-origin -> assume game
                }
            } catch (e) {}
            // body-based check
            if (typeof body === 'string' && /(^|&)(action|class)=/.test(body)) return true;
        } catch (e) {}
        return false;
    }

    function extractRequestActionClass(url, body) {
        let action = null;
        let class_ = null;
        try {
            const u = new URL(url, location.href);
            action = u.searchParams.get('action');
            class_ = u.searchParams.get('class');
        } catch (e) {}
        if ((!action || !class_) && typeof body === 'string') {
            try {
                const p = new URLSearchParams(body);
                if (!action) action = p.get('action');
                if (!class_) class_ = p.get('class');
            } catch (e) {}
        }
        return { action: action, class_: class_ };
    }

    function recordCaptured(meta) {
        try {
            // Soft cap to keep memory bounded across very long tours.
            if (__hh_ajax_buffer.length > 5000) __hh_ajax_buffer.shift();
            __hh_ajax_buffer.push(meta);
        } catch (e) {}
    }

    function buildResponseSlot(text) {
        const fullSize = (text && text.length) || 0;
        const truncated = fullSize > AJAX_CAPTURE_RESPONSE_BYTE_LIMIT;
        const out = truncated ? text.substring(0, AJAX_CAPTURE_RESPONSE_BYTE_LIMIT) : (text || '');
        let json = null;
        if (!truncated && out) {
            try { json = JSON.parse(out); } catch (e) {}
        }
        return {
            truncated: truncated,
            text_size: fullSize,
            json: json,
            text: json !== null ? null : out
        };
    }

    function patchXHR(targetWin) {
        try {
            const XHR = targetWin && targetWin.XMLHttpRequest;
            if (!XHR || !XHR.prototype) return false;
            if (XHR.prototype.__hh_inspector_hooked) return false;
            XHR.prototype.__hh_inspector_hooked = true;

            const origOpen = XHR.prototype.open;
            const origSend = XHR.prototype.send;

            XHR.prototype.open = function(method, url) {
                try {
                    this.__hh_inspector_method = (method || 'GET').toUpperCase();
                    this.__hh_inspector_url = url || '';
                    this.__hh_inspector_t0 = Date.now();
                } catch (e) {}
                return origOpen.apply(this, arguments);
            };

            XHR.prototype.send = function(body) {
                try {
                    const xhr = this;
                    const url = xhr.__hh_inspector_url || '';
                    const bodyStr = typeof body === 'string' ? body : null;
                    if (looksLikeGameAjax(url, bodyStr)) {
                        const reqInfo = extractRequestActionClass(url, bodyStr);
                        xhr.addEventListener('readystatechange', function() {
                            try {
                                if (xhr.readyState !== 4) return;
                                let text = '';
                                try { text = xhr.responseText || ''; } catch (e) {}
                                recordCaptured({
                                    transport: 'xhr',
                                    url: url,
                                    method: xhr.__hh_inspector_method || 'GET',
                                    status: xhr.status || 0,
                                    duration_ms: Date.now() - (xhr.__hh_inspector_t0 || Date.now()),
                                    timestamp_ms: Date.now(),
                                    request: { action: reqInfo.action, class_: reqInfo.class_ },
                                    response: buildResponseSlot(text)
                                });
                            } catch (e) {}
                        });
                    }
                } catch (e) {}
                return origSend.apply(this, arguments);
            };
            return true;
        } catch (e) {
            console.warn(LOG_PREFIX, 'patchXHR failed:', e);
            return false;
        }
    }

    function patchFetch(targetWin) {
        try {
            if (!targetWin || typeof targetWin.fetch !== 'function') return false;
            if (targetWin.__hh_inspector_fetch_hooked) return false;
            targetWin.__hh_inspector_fetch_hooked = true;

            const origFetch = targetWin.fetch;

            targetWin.fetch = function(input, init) {
                let url = '';
                let method = 'GET';
                let body = null;
                try {
                    if (typeof input === 'string') {
                        url = input;
                    } else if (input && typeof input === 'object') {
                        if (typeof input.url === 'string') url = input.url;
                        if (typeof input.method === 'string') method = input.method.toUpperCase();
                    }
                    if (init) {
                        if (typeof init.method === 'string') method = init.method.toUpperCase();
                        if (init.body !== undefined && init.body !== null) {
                            if (typeof init.body === 'string') body = init.body;
                            else if (init.body && typeof URLSearchParams !== 'undefined' && init.body instanceof URLSearchParams) {
                                body = init.body.toString();
                            }
                        }
                    }
                } catch (e) {}

                const t0 = Date.now();
                const isGame = looksLikeGameAjax(url, body);
                const reqInfo = isGame ? extractRequestActionClass(url, body) : null;
                const promise = origFetch.apply(this, arguments);

                if (!isGame) return promise;

                return promise.then(function(resp) {
                    try {
                        const cloned = (resp && typeof resp.clone === 'function') ? resp.clone() : null;
                        if (cloned && typeof cloned.text === 'function') {
                            cloned.text().then(function(text) {
                                try {
                                    recordCaptured({
                                        transport: 'fetch',
                                        url: url,
                                        method: method,
                                        status: resp.status || 0,
                                        duration_ms: Date.now() - t0,
                                        timestamp_ms: Date.now(),
                                        request: { action: reqInfo.action, class_: reqInfo.class_ },
                                        response: buildResponseSlot(text)
                                    });
                                } catch (e) {}
                            }).catch(function() {});
                        }
                    } catch (e) {}
                    return resp;
                }, function(err) {
                    try {
                        recordCaptured({
                            transport: 'fetch',
                            url: url,
                            method: method,
                            status: 0,
                            duration_ms: Date.now() - t0,
                            timestamp_ms: Date.now(),
                            request: { action: reqInfo ? reqInfo.action : null, class_: reqInfo ? reqInfo.class_ : null },
                            response: { truncated: false, text_size: 0, json: null, text: null, error: String(err && err.message || err) }
                        });
                    } catch (e) {}
                    throw err;
                });
            };
            return true;
        } catch (e) {
            console.warn(LOG_PREFIX, 'patchFetch failed:', e);
            return false;
        }
    }

    function installAjaxHooks(targetWin) {
        if (!targetWin) return { xhr: false, fetch: false };
        return { xhr: patchXHR(targetWin), fetch: patchFetch(targetWin) };
    }

    // Polling sweep: pick up new iframe contentWindows that appear after page reloads.
    let __hh_hook_sweep_started = false;
    function startHookSweep() {
        if (__hh_hook_sweep_started) return;
        __hh_hook_sweep_started = true;
        try { installAjaxHooks(unsafeWindow); } catch (e) {}
        setInterval(function() {
            try {
                const ctx = detectMode();
                if (ctx && ctx.win && ctx.win !== unsafeWindow) {
                    installAjaxHooks(ctx.win);
                }
            } catch (e) {}
        }, 250);
    }

    function ajaxBufferMark() { return __hh_ajax_buffer.length; }
    function ajaxBufferSliceFrom(markerIdx, perStepLimit) {
        const slice = __hh_ajax_buffer.slice(markerIdx);
        if (slice.length > perStepLimit) return slice.slice(slice.length - perStepLimit);
        return slice;
    }

    // ==================== PII SHARE-MODE PIPELINE ====================
    //
    // Optional anonymisation pipeline. Activated by:
    //   1. Setting PII_MODE = "share" at the top of this script (single source
    //      of truth for the AUTO TOUR and DUMP THIS PAGE entry points).
    //   2. Clicking the dedicated DUMP FOR SHARING button (forces share mode
    //      for that one click regardless of PII_MODE).
    // Both routes feed the same pure pipeline. Off-mode dumps are byte-identical
    // to v4.7.0 except for the inspector VERSION string.
    //
    // Pipeline shape: (bundle) -> bundle, where bundle is { meta, pages: [...] }.
    // The single-dump handler wraps a single page into a 1-page bundle, runs
    // the pipeline, then unwraps the page. The audit block lives in:
    //   - bundle.meta.pii  for tour dumps
    //   - dump.meta.pii    for single-page dumps
    //
    // Steps implemented in v4.8.0-share-2:
    //   Step 0 - top-level whitelist
    //   Step 1 - plain-text + token strip (defence in depth)
    //   Step 2 - settings whitelist
    //   Step 3 - id hashing + pseudonyms + per-dump shuffle
    //   Step 4 - audit block
    //   Step 5 - time / counter rounding
    //
    // Order inside applyShareModePipeline (per page):
    //   snapshot hero nickname  ->  Step 3 (raw page; reads id_member etc.
    //   before the whitelist drops them)  ->  Step 5 (raw page)  ->  Step 0
    //   (top-level whitelist)  ->  Step 2 (local_storage filter)  ->  Step 1
    //   (recursive plain-text strip as a backstop)  ->  Step 4 audit block.

    const SHARE_PIPELINE_VERSION = 2;
    const SHARE_PII_WARNING = "Dump went through anonymisation. Suitable for public bug reports.";

    // ---------- Per-dump context (salt + id map). Salt never leaves the dump. ----------

    function shareHexRandom(byteCount) {
        const out = new Array(byteCount);
        try {
            const arr = new Uint8Array(byteCount);
            (typeof crypto !== 'undefined' ? crypto : (typeof window !== 'undefined' ? window.crypto : null)).getRandomValues(arr);
            for (let i = 0; i < byteCount; i++) {
                out[i] = (arr[i] < 16 ? '0' : '') + arr[i].toString(16);
            }
        } catch (e) {
            // Fallback (only if crypto.getRandomValues is unavailable for some reason).
            for (let i = 0; i < byteCount; i++) {
                const r = Math.floor(Math.random() * 256);
                out[i] = (r < 16 ? '0' : '') + r.toString(16);
            }
        }
        return out.join('');
    }

    // FNV-1a 64-bit using BigInt (ES2020, available in all modern userscript
    // engines). Output is the first 12 hex chars of the 16-hex digest.
    // This is a non-cryptographic hash. It is sufficient against statistical
    // re-correlation across dumps because the salt is fresh per dump and not
    // persisted; it is not a defence against an attacker with salt access.
    const SHARE_FNV_OFFSET = 0xcbf29ce484222325n;
    const SHARE_FNV_PRIME = 0x100000001b3n;
    const SHARE_FNV_MASK = 0xffffffffffffffffn;
    function shareFnv1a64Hex(s) {
        let h = SHARE_FNV_OFFSET;
        for (let i = 0; i < s.length; i++) {
            h = (h ^ BigInt(s.charCodeAt(i) & 0xff)) & SHARE_FNV_MASK;
            h = (h * SHARE_FNV_PRIME) & SHARE_FNV_MASK;
        }
        const hex = h.toString(16);
        const padded = ('0000000000000000' + hex).slice(-16);
        return padded.substring(0, 12);
    }

    function shareInitContext() {
        return {
            salt: shareHexRandom(16),
            idMap: new Map(),
            seqHarem: 0,
            seqEvent: 0,
            seqTeam: 0,
            seqOppAnon: 0,
            counters: null
        };
    }

    function shareHashId(rawId, ctx) {
        if (rawId === undefined || rawId === null || rawId === '') return rawId;
        const key = String(rawId);
        if (ctx.idMap.has(key)) return ctx.idMap.get(key);
        const hash = shareFnv1a64Hex(ctx.salt + ':' + key);
        ctx.idMap.set(key, hash);
        if (ctx.counters) ctx.counters.ids_hashed += 1;
        return hash;
    }

    // ---------- Salt-seeded PRNG (xmur3 + mulberry32) for deterministic shuffle. ----------

    function shareXmur3(str) {
        let h = 1779033703 ^ str.length;
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
            h = (h << 13) | (h >>> 19);
        }
        return function() {
            h = Math.imul(h ^ (h >>> 16), 2246822507);
            h = Math.imul(h ^ (h >>> 13), 3266489909);
            h ^= h >>> 16;
            return h >>> 0;
        };
    }

    function shareMulberry32(seed) {
        let t = seed >>> 0;
        return function() {
            t = (t + 0x6D2B79F5) >>> 0;
            let r = Math.imul(t ^ (t >>> 15), 1 | t);
            r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
            return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
        };
    }

    function sharePrng(salt) {
        const seed = shareXmur3('shuffle:' + salt)();
        return shareMulberry32(seed);
    }

    function shareShuffleInPlace(arr, prng) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(prng() * (i + 1));
            const tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
        return arr;
    }

    function sharePadSeq(n) {
        const s = String(n);
        return s.length >= 4 ? s : ('0000' + s).slice(-4);
    }

    // ---------- Step 0 / 2 / 1 whitelists and patterns. ----------

    // Step 0 - per-page top-level whitelist.
    const SHARE_PAGE_KEYS = new Set([
        'tour_meta', 'meta', 'hero_infos', 'girls_full', 'battle', 'teams',
        'ajax_observed', 'local_storage'
    ]);

    // Step 0 - hero_infos sub-whitelist
    const SHARE_HERO_INFOS_INFOS_KEYS = new Set(['level', 'class', 'caracs', 'questing']);
    const SHARE_HERO_INFOS_QUESTING_KEYS = new Set(['id_world']);

    // Step 0 - battle sub-whitelist
    const SHARE_BATTLE_KEYS = new Set([
        'daily_goals_list', 'contests_timer', 'event_data', 'current_event',
        'mega_event_active', 'mega_event_time_remaining', 'labyrinth_data',
        'penta_drill_data', 'synergies', 'love_raids', 'championData',
        'league_rewards', 'current_tier_number'
    ]);

    // Step 0 - teams.opponents_list[*] keep set. Slice 2 keeps nickname /
    // id_member so Step 3 (run before the whitelist) can replace them with
    // pseudonyms that survive into the final dump.
    const SHARE_OPP_KEYS = new Set([
        'level', 'power', 'place', 'country', 'can_fight',
        'current_season_mojo', 'boosters', 'player', 'nickname',
        'id_member', 'id_fighter'
    ]);
    const SHARE_OPP_PLAYER_KEYS = new Set([
        'level', 'power', 'place', 'country', 'can_fight',
        'current_season_mojo', 'boosters', 'nickname', 'id_member'
    ]);

    // Step 2 - localStorage settings whitelist (HHAuto_Setting_* / HHAuto_Temp_*).
    const SHARE_SETTINGS_WHITELIST = new Set([
        'HHAuto_Setting_paranoia',
        'HHAuto_Setting_paranoiaSettings',
        'HHAuto_Setting_paranoiaSpendsBefore',
        'HHAuto_Setting_safeSecondsForContest',
        'HHAuto_Setting_collectAllTimer',
        'HHAuto_Setting_buyCombat',
        'HHAuto_Setting_buyCombTimer',
        'HHAuto_Setting_buyMythicCombat',
        'HHAuto_Setting_buyMythicCombTimer',
        'HHAuto_Setting_autoLeagues',
        'HHAuto_Setting_autoLeaguesCollect',
        'HHAuto_Setting_autoLeaguesAllowWinCurrent',
        'HHAuto_Setting_autoLeaguesBoostedOnly',
        'HHAuto_Setting_autoLeaguesRunThreshold',
        'HHAuto_Setting_autoLeaguesForceOneFight',
        'HHAuto_Setting_autoLeaguesSelectedIndex',
        'HHAuto_Setting_autoLeaguesSortIndex',
        'HHAuto_Setting_autoLeaguesThreshold',
        'HHAuto_Setting_autoLeaguesSecurityThreshold',
        'HHAuto_Setting_autoSeason',
        'HHAuto_Setting_autoSeasonCollect',
        'HHAuto_Setting_autoSeasonCollectAll',
        'HHAuto_Setting_autoSeasonIgnoreNoGirls',
        'HHAuto_Setting_autoSeasonPassReds',
        'HHAuto_Setting_autoSeasonThreshold',
        'HHAuto_Setting_autoSeasonRunThreshold',
        'HHAuto_Setting_autoSeasonMaxTier',
        'HHAuto_Setting_autoSeasonMaxTierNb',
        'HHAuto_Setting_autoSeasonBoostedOnly',
        'HHAuto_Setting_autoSeasonSkipLowMojo',
        'HHAuto_Setting_autoPentaDrill',
        'HHAuto_Setting_autoPentaDrillCollect',
        'HHAuto_Setting_autoPentaDrillCollectAll',
        'HHAuto_Setting_autoPentaDrillThreshold',
        'HHAuto_Setting_autoPentaDrillRunThreshold',
        'HHAuto_Setting_autoPentaDrillBoostedOnly',
        'HHAuto_Setting_autoChamps',
        'HHAuto_Setting_autoChampAlignTimer',
        'HHAuto_Setting_autoChampsForceStart',
        'HHAuto_Setting_autoChampsFilter',
        'HHAuto_Setting_autoChampsTeamLoop',
        'HHAuto_Setting_autoChampsGirlThreshold',
        'HHAuto_Setting_autoChampsTeamKeepSecondLine',
        'HHAuto_Setting_autoChampsUseEne',
        'HHAuto_Setting_autoBuildChampsTeam',
        'HHAuto_Setting_autoChampsForceStartEventGirl',
        'HHAuto_Setting_autoClubChamp',
        'HHAuto_Setting_autoClubChampMax',
        'HHAuto_Setting_autoClubForceStart',
        'HHAuto_Setting_autoTrollBattle',
        'HHAuto_Setting_autoTrollMythicByPassParanoia',
        'HHAuto_Setting_autoTrollSelectedIndex',
        'HHAuto_Setting_autoTrollThreshold',
        'HHAuto_Setting_autoTrollRunThreshold',
        'HHAuto_Setting_autoTrollLoveRaidByPassThreshold',
        'HHAuto_Setting_eventTrollOrder',
        'HHAuto_Setting_autoBuyTrollNumber',
        'HHAuto_Setting_autoBuyMythicTrollNumber',
        'HHAuto_Setting_autoLoveRaidMythicOnly',
        'HHAuto_Setting_plusLoveRaid',
        'HHAuto_Setting_autoLoveRaidSelectedIndex',
        'HHAuto_Setting_buyLoveRaidCombat',
        'HHAuto_Setting_autoBuyLoveRaidTrollNumber',
        'HHAuto_Setting_autoFreeBundlesCollect',
        'HHAuto_Setting_autoFreeBundlesCollectablesList',
        'HHAuto_Setting_plusEventSandalWood',
        'HHAuto_Setting_plusEventMythicSandalWood',
        'HHAuto_Setting_plusEventLoveRaidSandalWood',
        'HHAuto_Setting_plusGirlSkins',
        'HHAuto_Setting_autoPantheonBoostedOnly',
        'HHAuto_Setting_autoFreePachinko',
        'HHAuto_Setting_autoBuyBoosters',
        'HHAuto_Setting_autoBuyBoostersFilter',
        'HHAuto_Setting_autoEquipBoosters',
        'HHAuto_Setting_autoEquipBoostersSlots',
        'HHAuto_Setting_maxBooster',
        'HHAuto_Setting_minShardsX10',
        'HHAuto_Setting_minShardsX50',
        'HHAuto_Setting_sandalwoodMinShardsThreshold',
        'HHAuto_Setting_useX10Fights',
        'HHAuto_Setting_useX50Fights',
        'HHAuto_Setting_autoSalary',
        'HHAuto_Setting_autoSalaryMinSalary',
        'HHAuto_Setting_autoStats',
        'HHAuto_Setting_autoStatsSwitch',
        'HHAuto_Setting_mousePause',
        'HHAuto_Setting_mousePauseTimeout',
        'HHAuto_Setting_waitforContest',
        'HHAuto_Setting_master',
        'HHAuto_Setting_updateMarket',
        'HHAuto_Temp_sandalwoodMaxUsages',
        'HHAuto_Temp_boosterStatus'
    ]);

    // Step 1 - patterns to redact in plain text (defence in depth).
    const SHARE_TOKEN_KEY_PATTERN = /(token|secret|csrf|cookie)/i;
    // JWT-shaped: 3 base64url-ish segments, first >= 20 chars, others >= 10.
    const SHARE_JWT_PATTERN = /[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
    // Personalised CDN asset paths: /<32 hex>.<image-ext>
    const SHARE_CDN_HASH_PATTERN = /\/[a-f0-9]{32}\.(?:png|jpg|jpeg|webp|gif)\b/gi;

    // Field-name sets recognised by Step 3 walks.
    const SHARE_ID_FIELDS = new Set(['id_girl', 'id_girl_ref', 'id_member', 'id_fighter', 'id_team']);

    // ---------- Helpers ----------

    function shareReadHeroNickname(page) {
        try {
            const v = page && page.hero_infos && page.hero_infos.infos && page.hero_infos.infos.name;
            if (typeof v === 'string' && v.length > 0) return v;
        } catch (e) {}
        return null;
    }

    function sharePickKeys(obj, allowed) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
        const out = {};
        for (const k of Object.keys(obj)) {
            if (allowed.has(k)) out[k] = obj[k];
        }
        return out;
    }

    // ---------- Step 3: pseudonyms + id hashing on the raw page. ----------

    function sharePseudonymiseGirlList(list, ctx, prefix) {
        if (!Array.isArray(list)) return list;
        // Map index field for stable counter selection.
        let counterRef;
        if (prefix === 'Girl') counterRef = 'seqHarem';
        else if (prefix === 'EventGirl') counterRef = 'seqEvent';
        else counterRef = 'seqTeam';

        const prng = sharePrng(ctx.salt + ':' + prefix);
        const indices = list.map(function(_, i) { return i; });
        shareShuffleInPlace(indices, prng);

        const reordered = new Array(list.length);
        for (let i = 0; i < indices.length; i++) {
            reordered[i] = list[indices[i]];
        }

        for (let i = 0; i < reordered.length; i++) {
            const item = reordered[i];
            ctx[counterRef] += 1;
            const pseudonym = prefix + sharePadSeq(ctx[counterRef]);
            if (item && typeof item === 'object') {
                if ('name' in item) item.name = pseudonym;
                if ('Name' in item) item.Name = pseudonym;
                if ('nickname' in item) item.nickname = pseudonym;
                if ('id_girl' in item) item.id_girl = shareHashId(item.id_girl, ctx);
                if ('id_girl_ref' in item) item.id_girl_ref = shareHashId(item.id_girl_ref, ctx);
            }
            if (ctx.counters) ctx.counters.girls_pseudonymised += 1;
        }
        return reordered;
    }

    function sharePseudonymiseOpponent(opp, ctx) {
        if (!opp || typeof opp !== 'object') return opp;
        let token;
        const rawIdMember = opp.id_member !== undefined ? opp.id_member
            : (opp.player && opp.player.id_member !== undefined ? opp.player.id_member : null);
        if (rawIdMember !== null && rawIdMember !== undefined && rawIdMember !== 0 && rawIdMember !== '0') {
            token = shareHashId(rawIdMember, ctx);
        } else {
            ctx.seqOppAnon += 1;
            token = 'anon' + sharePadSeq(ctx.seqOppAnon);
        }
        const pseudo = 'Opponent_' + token;
        if ('nickname' in opp) opp.nickname = pseudo;
        if (opp.player && typeof opp.player === 'object') {
            if ('nickname' in opp.player) opp.player.nickname = pseudo;
            if ('club' in opp.player) delete opp.player.club;
            if ('id_member' in opp.player) opp.player.id_member = token;
        }
        if ('id_member' in opp) opp.id_member = token;
        if ('id_fighter' in opp) opp.id_fighter = shareHashId(opp.id_fighter, ctx);
        return opp;
    }

    function sharePseudonymiseParticipant(p, ctx) {
        if (!p || typeof p !== 'object') return p;
        const token = (p.id_member !== undefined && p.id_member !== null && p.id_member !== 0)
            ? shareHashId(p.id_member, ctx)
            : (function() { ctx.seqOppAnon += 1; return 'anon' + sharePadSeq(ctx.seqOppAnon); })();
        if ('nickname' in p) p.nickname = 'Participant_' + token;
        if ('avatar' in p) delete p.avatar;
        if ('id_member' in p) p.id_member = token;
        if ('id_fighter' in p) p.id_fighter = shareHashId(p.id_fighter, ctx);
        return p;
    }

    function shareApplyPseudonyms(page, ctx) {
        if (!page || typeof page !== 'object') return page;

        // Harem girls: page.girls_full is an object keyed by source path with
        // arrays of girls. Shuffle each list independently.
        const gf = page.girls_full;
        if (gf && typeof gf === 'object') {
            for (const k of Object.keys(gf)) {
                if (Array.isArray(gf[k])) {
                    gf[k] = sharePseudonymiseGirlList(gf[k], ctx, 'Girl');
                }
            }
        }

        // Event girls: battle.event_data.girls and battle.current_event.girls.
        const battle = page.battle;
        if (battle && typeof battle === 'object') {
            if (battle.event_data && Array.isArray(battle.event_data.girls)) {
                battle.event_data.girls = sharePseudonymiseGirlList(battle.event_data.girls, ctx, 'EventGirl');
            }
            if (battle.current_event && Array.isArray(battle.current_event.girls)) {
                battle.current_event.girls = sharePseudonymiseGirlList(battle.current_event.girls, ctx, 'EventGirl');
            }

            // Champion participants -- shuffle, then pseudonymise each.
            const cd = battle.championData;
            if (cd && cd.fight && Array.isArray(cd.fight.participants)) {
                const prng = sharePrng(ctx.salt + ':Participant');
                shareShuffleInPlace(cd.fight.participants, prng);
                cd.fight.participants = cd.fight.participants.map(function(p) {
                    return sharePseudonymiseParticipant(p, ctx);
                });
            }
        }

        // Opponents in teams.opponents_list.
        const teams = page.teams;
        if (teams && typeof teams === 'object' && Array.isArray(teams.opponents_list)) {
            teams.opponents_list = teams.opponents_list.map(function(o) {
                return sharePseudonymiseOpponent(o, ctx);
            });
        }

        // Final id-only sweep across the whole page for any id_* still raw.
        shareWalkHashIds(page, ctx, new WeakSet());
        return page;
    }

    function shareWalkHashIds(node, ctx, seen) {
        if (node === null || node === undefined) return node;
        if (typeof node !== 'object') return node;
        if (seen.has(node)) return node;
        seen.add(node);
        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) shareWalkHashIds(node[i], ctx, seen);
            return node;
        }
        for (const k of Object.keys(node)) {
            const v = node[k];
            if (SHARE_ID_FIELDS.has(k)) {
                if (typeof v === 'number' || (typeof v === 'string' && /^[0-9]+$/.test(v))) {
                    node[k] = shareHashId(v, ctx);
                    continue;
                }
            }
            if (v && typeof v === 'object') shareWalkHashIds(v, ctx, seen);
        }
        return node;
    }

    // ---------- Step 5: rounding. ----------

    function shareRoundIsoToHour(iso) {
        if (typeof iso !== 'string') return iso;
        // Expect ISO 8601 like "2026-05-08T14:23:45.678Z" -> "2026-05-08T14:00:00.000Z".
        const m = iso.match(/^(\d{4}-\d{2}-\d{2}T\d{2}):\d{2}:\d{2}(\.\d+)?Z$/);
        if (!m) return iso;
        return m[1] + ':00:00.000Z';
    }

    function shareApplyRounding(page, ctx) {
        if (!page || typeof page !== 'object') return page;
        if (page.meta && typeof page.meta.timestamp === 'string') {
            const before = page.meta.timestamp;
            const after = shareRoundIsoToHour(before);
            if (after !== before) {
                page.meta.timestamp = after;
                if (ctx.counters) ctx.counters.timestamps_rounded += 1;
            }
        }
        if (page.battle && typeof page.battle === 'object') {
            const v = page.battle.mega_event_time_remaining;
            if (typeof v === 'number' && isFinite(v)) {
                page.battle.mega_event_time_remaining = Math.floor(v / 60) * 60;
                if (ctx.counters) ctx.counters.timestamps_rounded += 1;
            }
        }
        if (Array.isArray(page.ajax_observed)) {
            for (const entry of page.ajax_observed) {
                if (!entry || typeof entry !== 'object') continue;
                if ('timestamp_ms' in entry) {
                    entry.timestamp_ms = null;
                    if (ctx.counters) ctx.counters.timestamps_rounded += 1;
                }
                if ('duration_ms' in entry) {
                    entry.duration_ms = null;
                    if (ctx.counters) ctx.counters.timestamps_rounded += 1;
                }
            }
        }
        return page;
    }

    // ---------- Step 0: top-level whitelist (slice 1, refined). ----------

    function shareApplyTopLevelWhitelist(page, ctx) {
        if (!page || typeof page !== 'object') return page;
        const out = {};
        let droppedCount = 0;
        for (const k of Object.keys(page)) {
            if (k === 'game_context' || SHARE_PAGE_KEYS.has(k)) continue;
            droppedCount += 1;
        }
        if ('meta' in page) out.meta = page.meta;
        if ('tour_meta' in page) out.tour_meta = page.tour_meta;
        if ('game_context' in page) {
            const gc = page.game_context || {};
            const slim = {};
            if ('body_page' in gc) slim.body_page = gc.body_page;
            out.game_context = slim;
        }
        if ('hero_infos' in page) {
            const hi = page.hero_infos || {};
            const slim = {};
            if (hi.infos && typeof hi.infos === 'object') {
                const infosOut = {};
                for (const ik of Object.keys(hi.infos)) {
                    if (!SHARE_HERO_INFOS_INFOS_KEYS.has(ik)) continue;
                    if (ik === 'questing' && hi.infos.questing && typeof hi.infos.questing === 'object') {
                        const qOut = {};
                        for (const qk of Object.keys(hi.infos.questing)) {
                            if (SHARE_HERO_INFOS_QUESTING_KEYS.has(qk)) qOut[qk] = hi.infos.questing[qk];
                        }
                        infosOut.questing = qOut;
                    } else {
                        infosOut[ik] = hi.infos[ik];
                    }
                }
                slim.infos = infosOut;
            }
            out.hero_infos = slim;
        }
        if ('girls_full' in page) out.girls_full = page.girls_full;
        if ('battle' in page) {
            out.battle = sharePickKeys(page.battle, SHARE_BATTLE_KEYS);
        }
        if ('teams' in page) {
            const teams = page.teams || {};
            const teamsOut = {};
            for (const tk of Object.keys(teams)) {
                const tv = teams[tk];
                if (Array.isArray(tv) && tk === 'opponents_list') {
                    teamsOut[tk] = tv.map(function(opp) {
                        if (!opp || typeof opp !== 'object') return opp;
                        const slim = sharePickKeys(opp, SHARE_OPP_KEYS);
                        if (slim.player && typeof slim.player === 'object') {
                            slim.player = sharePickKeys(slim.player, SHARE_OPP_PLAYER_KEYS);
                        }
                        return slim;
                    });
                } else {
                    teamsOut[tk] = tv;
                }
            }
            out.teams = teamsOut;
        }
        if ('ajax_observed' in page) out.ajax_observed = page.ajax_observed;
        if ('local_storage' in page) out.local_storage = page.local_storage;

        if (ctx.counters) ctx.counters.top_level_keys_dropped += droppedCount;
        return out;
    }

    // ---------- Step 1: plain-text walk (backstop). ----------

    function shareWalkPlainText(node, nickname, counters, seen) {
        if (node === null || node === undefined) return node;
        const t = typeof node;
        if (t === 'string') {
            let s = node;
            let changed = false;
            if (nickname && s.indexOf(nickname) !== -1) {
                s = s.split(nickname).join('[redacted]');
                changed = true;
            }
            if (s.match(SHARE_JWT_PATTERN)) {
                s = s.replace(SHARE_JWT_PATTERN, '[redacted]');
                changed = true;
            }
            if (s.match(SHARE_CDN_HASH_PATTERN)) {
                s = s.replace(SHARE_CDN_HASH_PATTERN, '/[redacted]');
                changed = true;
            }
            if (changed && counters) counters.plain_text_replacements += 1;
            return s;
        }
        if (t !== 'object') return node;
        if (seen.has(node)) return node;
        seen.add(node);
        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                node[i] = shareWalkPlainText(node[i], nickname, counters, seen);
            }
            return node;
        }
        for (const k of Object.keys(node)) {
            if (SHARE_TOKEN_KEY_PATTERN.test(k)) {
                delete node[k];
                if (counters) counters.token_keys_dropped += 1;
                continue;
            }
            node[k] = shareWalkPlainText(node[k], nickname, counters, seen);
        }
        return node;
    }

    // ---------- Step 2: settings whitelist. ----------

    function shareFilterLocalStorage(localStorageObj, counters) {
        if (!localStorageObj || typeof localStorageObj !== 'object') return localStorageObj;
        const out = {};
        for (const bucketKey of Object.keys(localStorageObj)) {
            const bucket = localStorageObj[bucketKey];
            if (!bucket || typeof bucket !== 'object') {
                out[bucketKey] = bucket;
                continue;
            }
            const slim = {};
            for (const k of Object.keys(bucket)) {
                if (SHARE_SETTINGS_WHITELIST.has(k)) {
                    slim[k] = bucket[k];
                    if (counters) counters.storage_keys_kept += 1;
                } else {
                    if (counters) counters.storage_keys_dropped += 1;
                }
            }
            out[bucketKey] = slim;
        }
        return out;
    }

    // ---------- Top-level pipeline runner. ----------

    function applyShareModePipeline(bundle) {
        if (!bundle || typeof bundle !== 'object') return bundle;
        const ctx = shareInitContext();
        const counters = {
            top_level_keys_dropped: 0,
            plain_text_replacements: 0,
            token_keys_dropped: 0,
            storage_keys_kept: 0,
            storage_keys_dropped: 0,
            ids_hashed: 0,
            girls_pseudonymised: 0,
            timestamps_rounded: 0
        };
        ctx.counters = counters;

        const pages = Array.isArray(bundle.pages) ? bundle.pages : [];
        // Snapshot the hero nickname before whitelist/pseudonymise drop or rewrite it.
        let nickname = null;
        for (let i = 0; i < pages.length; i++) {
            const n = shareReadHeroNickname(pages[i]);
            if (n) { nickname = n; break; }
        }

        for (let i = 0; i < pages.length; i++) {
            let page = pages[i];
            // Step 3 first -- must read raw page (id_member etc.) before whitelist drops them.
            shareApplyPseudonyms(page, ctx);
            // Step 5 next -- works on raw page too (mega_event_time_remaining etc.).
            shareApplyRounding(page, ctx);
            // Step 0 - whitelist now (drops everything else).
            page = shareApplyTopLevelWhitelist(page, ctx);
            // Step 2 - settings whitelist on local_storage.
            if (page && page.local_storage) {
                page.local_storage = shareFilterLocalStorage(page.local_storage, counters);
            }
            // Step 1 - plain-text strip as backstop.
            shareWalkPlainText(page, nickname, counters, new WeakSet());
            pages[i] = page;
        }

        // Round bundle-level timestamp too (tour bundles).
        if (bundle.meta && typeof bundle.meta.timestamp === 'string') {
            const before = bundle.meta.timestamp;
            const after = shareRoundIsoToHour(before);
            if (after !== before) {
                bundle.meta.timestamp = after;
                counters.timestamps_rounded += 1;
            }
        }

        if (!bundle.meta || typeof bundle.meta !== 'object') bundle.meta = {};
        bundle.meta.pii = {
            mode: "share",
            pipeline_version: SHARE_PIPELINE_VERSION,
            inspector_version: VERSION,
            pages_processed: pages.length,
            layers_applied: [
                "top_level_whitelist",
                "plain_text_strip",
                "settings_whitelist",
                "id_hash_and_pseudonymise",
                "rounding"
            ],
            layer_counts: {
                top_level_keys_dropped: counters.top_level_keys_dropped,
                plain_text_replacements: counters.plain_text_replacements,
                token_keys_dropped: counters.token_keys_dropped,
                storage_keys_kept: counters.storage_keys_kept,
                storage_keys_dropped: counters.storage_keys_dropped,
                ids_hashed: counters.ids_hashed,
                girls_pseudonymised: counters.girls_pseudonymised,
                timestamps_rounded: counters.timestamps_rounded
            },
            warning_for_user: SHARE_PII_WARNING,
            salt_present: true
        };
        return bundle;
    }

    function applyShareModeToSingleDump(dump) {
        const wrapper = { meta: {}, pages: [dump] };
        applyShareModePipeline(wrapper);
        const out = wrapper.pages[0] || {};
        if (!out.meta || typeof out.meta !== 'object') out.meta = {};
        out.meta.pii = wrapper.meta.pii;
        return out;
    }

    function runSingleDump(forceShare) {
        const ctx = detectMode();
        try { installAjaxHooks(ctx && ctx.win); } catch (e) {}
        const markerIdx = ajaxBufferMark();
        // Brief capture window so any in-flight or auto-fired Game-AJAX is recorded.
        setTimeout(function() {
            const dump = dumpEverything(ctx);
            fetchBlessings(ctx, function(blessings) {
                dump.live_blessings_api = blessings;
                dump.ajax_observed = ajaxBufferSliceFrom(markerIdx, AJAX_CAPTURE_PER_STEP_LIMIT);
                const useShare = !!forceShare || PII_MODE === "share";
                const finalDump = useShare ? applyShareModeToSingleDump(dump) : dump;
                const text = safeStringify(finalDump);
                const body = (ctx.doc || document).querySelector('body[page]');
                const baseSuffix = body ? body.getAttribute('page').replace(/[^a-z0-9]/gi, '_') : 'page';
                const suffix = useShare ? baseSuffix + '_share' : baseSuffix;
                showSingleDumpOverlay(text, suffix);
            });
        }, AJAX_CAPTURE_SETTLE_EXTRA_MS);
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
        // Status bar lives at the bottom of the viewport so it does not
        // overlap the regular DUMP / SHARE / AUTO TOUR buttons that sit
        // at the top right.
        bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1a1a1a;color:#0f0;font:13px monospace;padding:8px 14px;z-index:1000000;box-shadow:0 -4px 14px rgba(0,0,0,0.7);border-top:3px solid #ffb827;display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-height:24px;';
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
        const stepMarkerIdx = ajaxBufferMark();
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
        // Hooks were installed at script start and re-applied to any new iframe via
        // startHookSweep(); we only need a marker here.
        try { installAjaxHooks(ctx && ctx.win); } catch (e) {}
        setStatusBar('<b style=\"color:#ffb827\">' + (globalIdx+1) + '. ' + step.label + '</b> &mdash; dumping data...');

        // Give the page a window to issue its natural Game-AJAX calls.
        await sleep(AJAX_CAPTURE_SETTLE_EXTRA_MS);

        const dump = dumpEverything(ctx);

        await new Promise(function(resolve) {
            fetchBlessings(ctx, function(blessings) {
                dump.live_blessings_api = blessings;
                resolve();
            });
        });

        dump.ajax_observed = ajaxBufferSliceFrom(stepMarkerIdx, AJAX_CAPTURE_PER_STEP_LIMIT);

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
        if (PII_MODE === "share") {
            try { applyShareModePipeline(bundle); }
            catch (e) { console.error(LOG_PREFIX, 'share pipeline failed:', e); }
        }
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
        single.onclick = function() { runSingleDump(false); };

        const share = document.createElement('div');
        share.textContent = 'DUMP FOR SHARING';
        share.style.cssText = 'background:#ff9800;color:white;padding:14px 20px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,0.5);text-align:center;';
        share.title = 'Forces PII share-mode pipeline (anonymises hero nickname, drops chat_token, settings whitelist).';
        share.onclick = function() { runSingleDump(true); };

        const tour = document.createElement('div');
        tour.textContent = 'AUTO TOUR';
        tour.style.cssText = 'background:#2196F3;color:white;padding:14px 20px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,0.5);text-align:center;';
        tour.onclick = function() { startTour(); };
        tour.title = AUTO_TOUR.length + ' auto pages, then ' + MANUAL_TOUR.length + ' manual pages, then bundle download.';

        wrap.appendChild(single);
        wrap.appendChild(share);
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
        startHookSweep();
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
