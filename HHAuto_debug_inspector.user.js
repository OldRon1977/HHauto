// ==UserScript==
// @name         HHAuto Debug - Full Data Inspector
// @namespace    HHAuto_Debug
// @version      3.4.0
// @description  Top-window auto-tour through all relevant pages with persistent state across reloads. iframe-aware data extraction.
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

    const TOUR_STATE_KEY = 'hhauto_inspector_tour_state';
    const TOUR_RESULTS_KEY = 'hhauto_inspector_tour_results';
    const WAIT_PER_PAGE_MS = 7000;
    const POST_LOAD_SETTLE_MS = 1500;

    const TOUR = [
        { path: '/home.html',               label: 'Home',                       expected: 'home' },
        { path: '/teams.html',              label: 'BattleTeams',                expected: 'teams' },
        { path: '/edit-team.html',          label: 'EditTeam',                   expected: 'edit-team' },
        { path: '/characters.html',         label: 'Harem',                      expected: 'harem' },
        { path: '/waifu.html',              label: 'Waifu',                      expected: 'waifu' },
        { path: '/leagues.html',            label: 'League',                     expected: 'leaderboard' },
        { path: '/season-arena.html',       label: 'SeasonArena',                expected: 'season_arena' },
        { path: '/penta-drill-arena.html',  label: 'PentaDrillArena',            expected: 'penta_drill_arena' },
        { path: '/penta-drill.html',        label: 'PentaDrill',                 expected: 'penta_drill' },
        { path: '/labyrinth.html',          label: 'Labyrinth',                  expected: 'labyrinth' },
        { path: '/labyrinth-entrance.html', label: 'LabyrinthEntrance',          expected: 'labyrinth-entrance' },
        { path: '/club-champion.html',      label: 'ClubChampion',               expected: 'club_champion' },
        { path: '/champions-map.html',      label: 'ChampionsMap',               expected: 'champions_map' },
        { path: '/shop.html',               label: 'Shop',                       expected: 'shop' },
        { path: '/clubs.html',              label: 'Clubs',                      expected: 'clubs' },
        { path: '/pantheon.html',           label: 'Pantheon',                   expected: 'pantheon' },
        { path: '/season.html',             label: 'Season',                     expected: 'season' },
        { path: '/event.html',              label: 'Event',                      expected: 'event' },
        { path: '/seasonal.html',           label: 'Seasonal',                   expected: 'seasonal' },
        { path: '/path-of-attraction.html', label: 'PathOfAttraction',           expected: 'path_of_attraction' },
        { path: '/path-of-glory.html',      label: 'PathOfGlory',                expected: 'path-of-glory' },
        { path: '/path-of-valor.html',      label: 'PathOfValor',                expected: 'path-of-valor' },
        { path: '/sex-god-path.html',       label: 'SexGodPath',                 expected: 'sex-god-path' },
        { path: '/love-raids.html',         label: 'LoveRaids',                  expected: 'love_raids' },
        { path: '/pachinko.html',           label: 'Pachinko',                   expected: 'pachinko' },
        { path: '/map.html',                label: 'Map',                        expected: 'map' },
        { path: '/activities.html',                  label: 'Activities',          expected: 'activities' },
        { path: '/activities.html?tab=contests',     label: 'Activities/Contests', expected: 'activities' },
        { path: '/activities.html?tab=missions',     label: 'Activities/Missions', expected: 'activities' },
        { path: '/activities.html?tab=daily_goals',  label: 'Activities/DailyGoals', expected: 'activities' },
        { path: '/activities.html?tab=pop',          label: 'Activities/PoP',      expected: 'activities' },
        { path: '/hero/profile.html',       label: 'HeroProfile',                expected: 'hero_pages' },
        { path: '/member-progression.html', label: 'MemberProgression',          expected: 'member-progression' }
    ];

    // ---------- iframe resolution ----------

    function findGameIframe() {
        const knownIds = ['hh_hentai','hh_comix','hh_star','hh_stargay','hh_startrans','hh_gay','hh_amour','hh_mangarpg','hh_sexy','hh_game'];
        for (const id of knownIds) {
            try {
                const f = document.getElementById(id);
                if (f && f.tagName === 'IFRAME') return f;
            } catch (e) {}
        }
        try {
            const frames = document.querySelectorAll('iframe');
            for (const f of frames) {
                try {
                    const w = f.contentWindow;
                    if (!w) continue;
                    if (w.shared || w.Hero || w.availableGirls || w.hh_ajax) return f;
                } catch (e) {}
            }
        } catch (e) {}
        return null;
    }

    function findGameWindow() {
        try {
            if (unsafeWindow.shared || unsafeWindow.Hero || unsafeWindow.availableGirls || unsafeWindow.hh_ajax) {
                return { win: unsafeWindow, doc: document, where: 'top-window', iframe: null };
            }
        } catch (e) {}
        const iframe = findGameIframe();
        if (iframe) {
            try {
                const w = iframe.contentWindow;
                const d = iframe.contentDocument || (w && w.document);
                return { win: w, doc: d, where: 'iframe#' + (iframe.id || 'noid'), iframe: iframe };
            } catch (e) {}
        }
        return { win: unsafeWindow, doc: document, where: 'top-window-fallback', iframe: null };
    }

    let CTX = findGameWindow();
    function gameWin() { return CTX.win; }
    function gameDoc() { return CTX.doc; }
    function refreshCtx() { CTX = findGameWindow(); return CTX; }

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
        try { return fn(); } catch (e) { return fallback === undefined ? ('[error: ' + e.message + ']') : fallback; }
    }

    function isPlainObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

    function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

    // ---------- collectors (read everything from the iframe context) ----------

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
            const win = gameWin();
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
                } catch (e) {}
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
                            if (isGirlLike(sample)) sources.push({ path: path + '.' + k, count: innerKeys.length, ref: v, isMap: true });
                            else scan(v, path + '.' + k, depth + 1);
                        }
                    }
                }
            } catch (e) {}
        }
        const w = gameWin();
        scan(w, 'game', 0);
        try { if (w.shared) scan(w.shared, 'game.shared', 0); } catch (e) {}
        try { if (w.hh_nutaku) scan(w.hh_nutaku, 'game.hh_nutaku', 0); } catch (e) {}
        try { if (w.hero_data) scan(w.hero_data, 'game.hero_data', 0); } catch (e) {}
        return sources;
    }

    function dumpHeroData() {
        const out = {};
        const w = gameWin();
        const keys = ['hero','Hero','hero_data','heroData','player_data','PlayerData','playerStats','Hero_data'];
        for (const k of keys) { try { if (w[k] !== undefined) out[k] = w[k]; } catch (e) {} }
        try { if (w.shared && w.shared.Hero) out['shared.Hero'] = w.shared.Hero; } catch (e) {}
        try { if (w.shared && w.shared.general) out['shared.general'] = w.shared.general; } catch (e) {}
        return out;
    }

    function dumpTeamsData() {
        const out = {};
        const w = gameWin();
        const keys = [
            'teams_data','teamsData','teams','selected_team','selectedTeam',
            'team_data','teamData','battle_team','battleTeam',
            'availableGirls','girlsDataList','girls_data_list',
            'leaguesPlayersData','leagues_players_data','opponents_list','opponentsList',
            'season_opponents','seasonOpponents','penta_opponents','tower_opponents',
            'girl_squad','teamGirls','opponents','season_girls'
        ];
        for (const k of keys) { try { if (w[k] !== undefined) out[k] = w[k]; } catch (e) {} }
        return out;
    }

    function dumpBattleData() {
        const out = {};
        const w = gameWin();
        const keys = [
            'battle_data','battleData','fight_data','fightData',
            'current_battle','currentBattle','battle_result','battleResult',
            'synergies','element_synergies','theme_elements',
            'boosters_data','boostersData','boosters','mythicBoosters','equippedBoosters',
            'league_data','leagueData','season_data','seasonData','league_rewards',
            'tower_data','towerData','champion_data','championData',
            'labyrinth_data','labyrinthData','penta_drill','pentaDrill','penta_drill_data',
            'club_data','clubData','arena_data','arenaData',
            'fight_modules','fightModules','game_data','gameData',
            'current_tier_number','league_tag','event_data','current_event',
            'seasonal_event_active','mega_event_active','mega_event_data',
            'season_sec_untill_event_end','seasonal_time_remaining','mega_event_time_remaining',
            'has_contests_datas','contests_timer','daily_goals_list',
            'love_raids','pop_list','pop_index','player_gems_amount'
        ];
        for (const k of keys) { try { if (w[k] !== undefined) out[k] = w[k]; } catch (e) {} }
        return out;
    }

    function dumpMarketEquipment() {
        const out = {};
        const w = gameWin();
        const keys = [
            'market_data','marketData','shop_data','shopData','items','items_data','shop',
            'girl_armor','girlArmor','equipment','inventory','girl_skills','girlSkills',
            'skill_tiers','skillTiers','awakening_data','awakeningData',
            'mythic_boosters','classBoosters','specialBoosters','hh_prices'
        ];
        for (const k of keys) { try { if (w[k] !== undefined) out[k] = w[k]; } catch (e) {} }
        return out;
    }

    function dumpHHVars() {
        const out = {};
        const w = gameWin();
        try {
            const keys = Object.getOwnPropertyNames(w);
            for (const k of keys) {
                if (k.startsWith('HH_') || k.startsWith('hh_') || k.startsWith('Hh_')) {
                    try {
                        const v = w[k];
                        if (v !== null && v !== undefined && typeof v !== 'function') out[k] = v;
                    } catch (e) {}
                }
            }
        } catch (e) {}
        return out;
    }

    function dumpShared() {
        const out = {};
        const w = gameWin();
        try {
            if (w.shared) {
                for (const k of Object.keys(w.shared)) {
                    try {
                        const v = w.shared[k];
                        if (v !== null && v !== undefined && typeof v !== 'function') out[k] = v;
                    } catch (e) {}
                }
            }
        } catch (e) {}
        return out;
    }

    function dumpLocalStorage() {
        const out = { top: {}, game: {} };
        function scan(storage, target) {
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
                            try { target[key] = JSON.parse(raw); } catch (e) { target[key] = raw; }
                        } catch (e) {}
                    }
                }
            } catch (e) {}
        }
        scan(localStorage, out.top);
        try {
            const w = gameWin();
            if (w !== unsafeWindow && w.localStorage) scan(w.localStorage, out.game);
        } catch (e) {}
        return out;
    }

    function dumpDataAttributes() {
        const out = [];
        try {
            const d = gameDoc() || document;
            const candidates = d.querySelectorAll(
                '[data-new-girl-tooltip], [data-team], [data-girl-id], [data-blessing], [data-opponent], [data-team-index], [data-team-member-position], [data-id-girl-armor], [data-id-skill], [data-d], [data-rewards], [data-power], [data-time-stamp], [data-nc-reward-id], [data-pantheon-id], [data-battles], [data-tab], [data-href], [data-select-girl-id]'
            );
            for (let i = 0; i < candidates.length && i < 1000; i++) {
                const el = candidates[i];
                const entry = { tag: el.tagName, id: el.id || null, class: el.className || null, attrs: {} };
                for (const a of el.attributes) {
                    if (a.name.startsWith('data-')) entry.attrs[a.name] = a.value;
                }
                out.push(entry);
            }
        } catch (e) {}
        return out;
    }

    function dumpGameContext() {
        const out = { context: CTX.where };
        try {
            const d = gameDoc() || document;
            const body = d.querySelector('body[page]');
            if (body) {
                out.body_id = body.id || null;
                out.body_page = body.getAttribute('page');
                out.body_classes = body.className || null;
            }
            try {
                const w = gameWin();
                out.location = {
                    href: (w.location && w.location.href) || null,
                    pathname: (w.location && w.location.pathname) || null,
                    search: (w.location && w.location.search) || null
                };
            } catch (e) { out.location_error = e.message; }
        } catch (e) { out.error = e.message; }
        return out;
    }

    function dumpEverything() {
        const t0 = Date.now();
        refreshCtx();
        const dump = {
            meta: {
                timestamp: new Date().toISOString(),
                host: location.hostname,
                pathname: location.pathname,
                search: location.search,
                href: location.href,
                userAgent: navigator.userAgent,
                inspectorVersion: '3.4.0',
                ctx: CTX.where
            },
            game_context: tryGet(dumpGameContext, {}),
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
                    if (s.isMap) dump.girls_full[s.path] = Object.values(s.ref);
                    else dump.girls_full[s.path] = s.ref;
                } catch (e) { dump.girls_full[s.path] = '[error: ' + e.message + ']'; }
            }
        } catch (e) {}
        dump.meta.dump_duration_ms = Date.now() - t0;
        return dump;
    }

    function fetchBlessings(callback) {
        try {
            const w = gameWin();
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

    // ---------- persistent tour state (across reloads) ----------

    function getTourState() {
        try {
            const raw = localStorage.getItem(TOUR_STATE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function setTourState(state) {
        try { localStorage.setItem(TOUR_STATE_KEY, JSON.stringify(state)); } catch (e) {}
    }

    function clearTourState() {
        try {
            localStorage.removeItem(TOUR_STATE_KEY);
            localStorage.removeItem(TOUR_RESULTS_KEY);
        } catch (e) {}
    }

    // Results stored separately because they grow large
    function appendTourResult(result) {
        try {
            const raw = localStorage.getItem(TOUR_RESULTS_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            arr.push(result);
            const text = JSON.stringify(arr);
            // If localStorage gets too big, downgrade detail to keep going
            if (text.length > 5 * 1024 * 1024) {
                console.warn('[HHAuto Inspector] Tour results approaching localStorage limit. Storing slim copy.');
                // Remove girls_full from already-stored results (keep only most recent full)
                for (let i = 0; i < arr.length - 1; i++) {
                    if (arr[i].girls_full) {
                        arr[i].girls_full_keys = Object.keys(arr[i].girls_full);
                        arr[i].girls_full = '[stripped to fit localStorage - check downloaded bundle]';
                    }
                }
                localStorage.setItem(TOUR_RESULTS_KEY, JSON.stringify(arr));
            } else {
                localStorage.setItem(TOUR_RESULTS_KEY, text);
            }
        } catch (e) {
            console.error('[HHAuto Inspector] Failed to append tour result:', e);
        }
    }

    function getTourResults() {
        try {
            const raw = localStorage.getItem(TOUR_RESULTS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    // ---------- single-page dump (manual) ----------

    function pageNameForFile() {
        try {
            const d = gameDoc() || document;
            const body = d.querySelector('body[page]');
            if (body) {
                const id = body.id || '';
                const page = body.getAttribute('page') || '';
                if (id || page) return (page || id).replace(/[^a-z0-9]/gi, '_');
            }
        } catch (e) {}
        try {
            const w = gameWin();
            const p = (w.location && w.location.pathname) || location.pathname;
            return p.replace(/[^a-z0-9]/gi, '_') || 'root';
        } catch (e) {}
        return 'root';
    }

    function downloadJson(text, suffix) {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const host = location.hostname.replace(/[^a-z0-9]/gi, '_');
        const safeSuffix = (suffix || 'all').replace(/[^a-z0-9_]/gi, '_');
        a.download = 'hhauto_dump_' + host + '_' + safeSuffix + '_' + stamp + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function mkBtn(text, color, onclick) {
        const b = document.createElement('button');
        b.textContent = text;
        b.style.cssText = 'padding:12px 24px;font-size:16px;cursor:pointer;background:' + color + ';color:white;border:none;border-radius:4px;font-weight:bold;';
        b.onclick = onclick;
        return b;
    }

    function showSingleDumpOverlay(text, fileSuffix) {
        const old = document.getElementById('hhauto_inspector_overlay');
        if (old) old.remove();
        const ov = document.createElement('div');
        ov.id = 'hhauto_inspector_overlay';
        ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
        const info = document.createElement('div');
        info.style.cssText = 'color:#0f0;font:14px monospace;margin-bottom:10px;';
        info.textContent = 'Dump: ' + text.length.toLocaleString() + ' chars (' + Math.round(text.length/1024) + ' KB) | source: ' + CTX.where + ' | ' + (fileSuffix || '');
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
        const dl = mkBtn('DOWNLOAD JSON', '#2196F3', function() {
            downloadJson(text, fileSuffix || 'all');
        });
        const cl = mkBtn('CLOSE', '#f44336', function() { ov.remove(); });
        row.appendChild(cp); row.appendChild(dl); row.appendChild(cl);
        ov.appendChild(info); ov.appendChild(ta); ov.appendChild(row);
        document.body.appendChild(ov);
        ta.select();
    }

    function runSingleDump() {
        const dump = dumpEverything();
        fetchBlessings(function(blessings) {
            dump.live_blessings_api = blessings;
            const text = safeStringify(dump);
            showSingleDumpOverlay(text, pageNameForFile());
        });
    }

    // ---------- TOUR (top-window navigation, persistent state) ----------

    function startTour() {
        if (getTourState()) {
            if (!confirm('A tour is already running. Cancel and restart?')) return;
            clearTourState();
        }
        const state = {
            startedAt: Date.now(),
            index: 0,
            tour: TOUR,
            host: location.hostname,
            origin: location.origin
        };
        setTourState(state);
        // Reset results
        try { localStorage.removeItem(TOUR_RESULTS_KEY); } catch (e) {}
        // Navigate to first page
        navigateTopTo(TOUR[0].path);
    }

    function navigateTopTo(path) {
        // Use top-window navigation so the game's session/wrapper loading kicks in fully.
        location.href = location.origin + path;
    }

    async function continueTour() {
        const state = getTourState();
        if (!state) return;

        const idx = state.index;
        const step = state.tour[idx];

        // Show status
        showTourStatus('Tour step ' + (idx+1) + '/' + state.tour.length + ': <b>' + step.label + '</b><br/>Waiting ' + (WAIT_PER_PAGE_MS/1000) + 's for game to load...');

        // Wait for game iframe + body[page] to settle
        await waitForBodyPage(step.expected, WAIT_PER_PAGE_MS);
        await sleep(POST_LOAD_SETTLE_MS);

        // Dump everything
        showTourStatus('Tour step ' + (idx+1) + '/' + state.tour.length + ': <b>' + step.label + '</b><br/>Dumping data...');
        const dump = dumpEverything();
        await new Promise(function(resolve) {
            fetchBlessings(function(blessings) { dump.live_blessings_api = blessings; resolve(); });
        });

        const actualPage = (dump.game_context && dump.game_context.body_page) || null;
        dump.tour_meta = {
            label: step.label,
            requested_path: step.path,
            expected_page: step.expected,
            actual_page: actualPage,
            match: actualPage === step.expected,
            step_index: idx
        };

        appendTourResult(dump);

        // Advance
        const nextIdx = idx + 1;
        if (nextIdx >= state.tour.length) {
            // Done
            finishTour();
            return;
        }
        state.index = nextIdx;
        setTourState(state);

        const nextStep = state.tour[nextIdx];
        showTourStatus('Tour step ' + (idx+1) + '/' + state.tour.length + ' DONE (' + (dump.tour_meta.match ? 'OK' : 'mismatch') + ')<br/>Navigating to next: ' + nextStep.label);

        // Small delay so user sees the status, then navigate
        setTimeout(function() { navigateTopTo(nextStep.path); }, 800);
    }

    function finishTour() {
        const results = getTourResults();
        const state = getTourState();
        const totalDur = state ? Math.round((Date.now() - state.startedAt) / 1000) : 0;
        clearTourState();

        const bundle = {
            meta: {
                timestamp: new Date().toISOString(),
                host: location.hostname,
                href: location.href,
                userAgent: navigator.userAgent,
                inspectorVersion: '3.4.0',
                tour_pages: TOUR.length,
                tour_completed_pages: results.length,
                tour_duration_sec: totalDur,
                wait_per_page_ms: WAIT_PER_PAGE_MS
            },
            pages: results
        };
        const text = safeStringify(bundle);
        const sizeKb = Math.round(text.length / 1024);

        showTourStatus(
            'Tour finished! ' + results.length + '/' + TOUR.length + ' pages, ' +
            sizeKb + ' KB, ' + totalDur + 's total<br/>Downloading bundle...'
        );

        downloadJson(text, 'tour');

        // Add overlay with full bundle for inspection
        setTimeout(function() {
            const overlay = document.getElementById('hhauto_tour_status');
            if (overlay) {
                const reviewBtn = mkBtn('REVIEW BUNDLE', '#2196F3', function() {
                    showSingleDumpOverlay(text, 'tour');
                });
                reviewBtn.style.padding = '8px 14px';
                reviewBtn.style.fontSize = '13px';
                reviewBtn.style.marginTop = '8px';
                overlay.appendChild(reviewBtn);
            }
        }, 1500);
    }

    function abortTour() {
        if (!getTourState()) return;
        if (!confirm('Abort current tour? Progress will be saved.')) return;
        finishTour();
    }

    async function waitForBodyPage(expected, maxWaitMs) {
        const interval = 250;
        const deadline = Date.now() + maxWaitMs;
        while (Date.now() < deadline) {
            try {
                refreshCtx();
                const d = gameDoc();
                if (d) {
                    const body = d.querySelector('body[page]');
                    if (body && body.getAttribute('page') === expected) return true;
                }
            } catch (e) {}
            await sleep(interval);
        }
        return false;
    }

    function showTourStatus(html) {
        let el = document.getElementById('hhauto_tour_status');
        if (!el) {
            el = document.createElement('div');
            el.id = 'hhauto_tour_status';
            el.style.cssText = 'position:fixed;top:80px;right:10px;width:400px;background:rgba(0,0,0,0.92);color:#0f0;font:12px monospace;padding:12px;border-radius:6px;z-index:999998;box-shadow:0 4px 16px rgba(0,0,0,0.6);';
            document.body.appendChild(el);
        }
        const state = getTourState();
        const stateInfo = state ? ('<div style=\"color:#888;font-size:10px;margin-top:6px\">Tour started: ' + new Date(state.startedAt).toLocaleTimeString() + '</div>') : '';
        el.innerHTML = '<div style=\"font-weight:bold;color:#ffb827;font-size:14px;margin-bottom:6px\">HHAuto Auto-Tour v3.4.0</div>' +
                       '<div>' + html + '</div>' + stateInfo;

        // Add abort button if tour active
        if (state && !document.getElementById('hhauto_abort_btn')) {
            const btn = mkBtn('ABORT TOUR', '#f44336', abortTour);
            btn.id = 'hhauto_abort_btn';
            btn.style.padding = '6px 12px';
            btn.style.fontSize = '11px';
            btn.style.marginTop = '8px';
            el.appendChild(btn);
        }
    }

    // ---------- buttons ----------

    function makeButtons() {
        refreshCtx();

        // Check if tour is active
        const tourActive = getTourState() !== null;
        if (tourActive) {
            // Auto-continue tour after a moment
            showTourStatus('Tour is active - resuming...');
            setTimeout(continueTour, 1000);
            return;
        }

        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;display:flex;flex-direction:column;gap:6px;font-family:monospace;';

        const single = document.createElement('div');
        single.textContent = 'DUMP THIS PAGE';
        single.style.cssText = 'background:#ff4444;color:white;padding:14px 20px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,0.5);text-align:center;';
        single.onclick = runSingleDump;
        single.title = 'Dump current page only (' + CTX.where + ')';

        const tour = document.createElement('div');
        tour.textContent = 'AUTO DUMP ALL';
        tour.style.cssText = 'background:#2196F3;color:white;padding:14px 20px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,0.5);text-align:center;';
        tour.onclick = startTour;
        tour.title = 'Auto-tour all ' + TOUR.length + ' pages via top-window navigation. Persists across reloads.';

        wrap.appendChild(single);
        wrap.appendChild(tour);
        document.body.appendChild(wrap);
    }

    setTimeout(makeButtons, 2000);

})();
