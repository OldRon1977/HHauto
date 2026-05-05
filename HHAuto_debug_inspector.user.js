// ==UserScript==
// @name         HHAuto Debug - Full Data Inspector
// @namespace    HHAuto_Debug
// @version      3.11.1
// @description  Auto-tour through all relevant pages, dump everything (girls, hero, teams, league, blessings, synergies, opponents, boosters, market, all globals). iframe-aware.
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
                inspectorVersion: '3.11.1',
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

    function mkBtn(text, color, onclick) {
        const b = document.createElement('button');
        b.textContent = text;
        b.style.cssText = 'padding:12px 24px;font-size:16px;cursor:pointer;background:' + color + ';color:white;border:none;border-radius:4px;font-weight:bold;';
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
        const safeSuffix = (suffix || 'all').replace(/[^a-z0-9_]/gi, '_');
        a.download = 'hhauto_dump_' + host + '_' + safeSuffix + '_' + stamp + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function runSingleDump() {
        const dump = dumpEverything();
        fetchBlessings(function(blessings) {
            dump.live_blessings_api = blessings;
            const text = safeStringify(dump);
            showSingleDumpOverlay(text, pageNameForFile());
        });
    }

    // ---------- AUTO TOUR ----------
    //
    // Tour-list: paths to navigate the iframe through. 7s wait per page.
    // Order chosen so that data-richest pages come first (in case of early abort).

    const TOUR = [
        { path: '/home.html',                  label: 'Home' },
        { path: '/leagues.html',               label: 'League (opponents_list)' },
        { path: '/season-arena.html',          label: 'SeasonArena (opponents)' },
        { path: '/penta-drill-arena.html',     label: 'PentaDrillArena (opponents_list)' },
        { path: '/penta-drill.html',           label: 'PentaDrill' },
        { path: '/labyrinth.html',             label: 'Labyrinth (girl_squad)' },
        { path: '/labyrinth-entrance.html',    label: 'LabyrinthEntrance' },
        { path: '/club-champion.html',         label: 'ClubChampion (championData)' },
        { path: '/champions-map.html',         label: 'ChampionsMap' },
        { path: '/shop.html',                  label: 'Shop (items DOM)' },
        { path: '/clubs.html',                 label: 'Clubs (Chat_vars)' },
        { path: '/pantheon.html',              label: 'Pantheon' },
        { path: '/season.html',                label: 'Season' },
        { path: '/event.html',                 label: 'Event (event_data)' },
        { path: '/seasonal.html',              label: 'Seasonal Event' },
        { path: '/path-of-glory.html',         label: 'Path of Glory' },
        { path: '/path-of-valor.html',         label: 'Path of Valor' },
        { path: '/pachinko.html',              label: 'Pachinko' },
        { path: '/waifu.html',                 label: 'Waifu' },
        { path: '/map.html',                   label: 'Map' },
        { path: '/activities.html',            label: 'Activities' },
        { path: '/activities.html?tab=contests',     label: 'Activities/Contests' },
        { path: '/activities.html?tab=missions',     label: 'Activities/Missions' },
        { path: '/activities.html?tab=daily_goals',  label: 'Activities/DailyGoals' },
        { path: '/activities.html?tab=pop',          label: 'Activities/PoP' },
        { path: '/hero/profile.html',          label: 'Hero Profile' },
        { path: '/member-progression.html',    label: 'Member Progression' }
    ];

    // Pages that the auto-tour cannot reach reliably. The user navigates manually.
    // This list is processed by the separate MANUAL TOUR button.
    const MANUAL_PAGES = [
        { path: '/teams.html',              label: 'BattleTeams (teams_data)',  expected: 'teams' },
        { path: '/edit-team.html',          label: 'EditTeam (availableGirls)', expected: 'edit-team' },
        { path: '/characters.html',         label: 'Harem',                     expected: 'harem' },
        { path: '/path-of-attraction.html', label: 'PathOfAttraction',          expected: 'path_of_attraction' },
        { path: '/sex-god-path.html',       label: 'SexGodPath',                expected: 'sex-god-path' },
        { path: '/love-raids.html',         label: 'LoveRaids',                 expected: 'love_raids' }
    ];

    const WAIT_PER_PAGE_MS = 7000;
    const POST_DUMP_PAUSE_MS = 500;

    let tourState = {
        running: false,
        index: 0,
        results: [],
        startedAt: null,
        statusEl: null,
        progressEl: null,
        cancelRequested: false
    };

    function buildStatusOverlay() {
        const old = document.getElementById('hhauto_tour_overlay');
        if (old) old.remove();
        const ov = document.createElement('div');
        ov.id = 'hhauto_tour_overlay';
        ov.style.cssText = 'position:fixed;top:80px;right:10px;width:380px;background:rgba(0,0,0,0.92);color:#0f0;font:12px monospace;padding:12px;border-radius:6px;z-index:999998;box-shadow:0 4px 16px rgba(0,0,0,0.6);';
        const title = document.createElement('div');
        title.style.cssText = 'font-weight:bold;color:#ffb827;font-size:14px;margin-bottom:6px;';
        title.textContent = 'HHAuto Auto-Tour';
        const status = document.createElement('div');
        status.id = 'hhauto_tour_status';
        status.style.cssText = 'margin-bottom:6px;line-height:1.5;';
        const progress = document.createElement('div');
        progress.id = 'hhauto_tour_progress';
        progress.style.cssText = 'max-height:300px;overflow-y:auto;font-size:11px;color:#aaa;border-top:1px solid #333;padding-top:6px;margin-bottom:8px;';
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:6px;';
        const cancel = mkBtn('CANCEL', '#f44336', function() {
            tourState.cancelRequested = true;
            status.innerHTML += '<br/><span style="color:#ff8888">Cancel requested - finishing current page...</span>';
        });
        cancel.style.padding = '6px 12px';
        cancel.style.fontSize = '12px';
        btnRow.appendChild(cancel);
        ov.appendChild(title);
        ov.appendChild(status);
        ov.appendChild(progress);
        ov.appendChild(btnRow);
        document.body.appendChild(ov);
        tourState.statusEl = status;
        tourState.progressEl = progress;
    }

    function updateStatus(text) {
        if (tourState.statusEl) tourState.statusEl.innerHTML = text;
    }

    function logProgress(text) {
        if (tourState.progressEl) {
            const line = document.createElement('div');
            line.textContent = text;
            tourState.progressEl.appendChild(line);
            tourState.progressEl.scrollTop = tourState.progressEl.scrollHeight;
        }
    }

    function navigateIframeTo(path) {
        const iframe = findGameIframe();
        if (!iframe) return false;
        try {
            // Build absolute URL so the browser does not fight over relative paths.
            const target = location.origin + path;
            iframe.src = target;
            return true;
        } catch (e) { return false; }
    }

    function dumpCurrent(label, path) {
        return new Promise(function(resolve) {
            refreshCtx();
            const dump = dumpEverything();
            dump.tour_meta = { label: label, requested_path: path };
            fetchBlessings(function(blessings) {
                dump.live_blessings_api = blessings;
                resolve(dump);
            });
        });
    }

    function sleep(ms) {
        return new Promise(function(r) { setTimeout(r, ms); });
    }

    async function runTour() {
        if (tourState.running) {
            alert('Tour already running');
            return;
        }
        tourState = {
            running: true,
            index: 0,
            results: [],
            startedAt: Date.now(),
            statusEl: null,
            progressEl: null,
            cancelRequested: false
        };
        buildStatusOverlay();
        updateStatus('Starting tour ' + TOUR.length + ' pages, ' + (WAIT_PER_PAGE_MS/1000) + 's per page...');


        for (let i = 0; i < TOUR.length; i++) {
            if (tourState.cancelRequested) {
                logProgress('-- Cancelled at step ' + (i+1) + '/' + TOUR.length);
                break;
            }
            tourState.index = i;
            const step = TOUR[i];
            const stepStart = Date.now();
            updateStatus('Step ' + (i+1) + '/' + TOUR.length + ': <b>' + step.label + '</b><br/>' + step.path + '<br/>Loading + waiting ' + (WAIT_PER_PAGE_MS/1000) + 's...');
            const navOk = navigateIframeTo(step.path);
            if (!navOk) {
                logProgress((i+1).toString().padStart(2,'0') + '. ' + step.label + ' SKIPPED (iframe nav failed)');
                continue;
            }
            await sleep(WAIT_PER_PAGE_MS);
            if (tourState.cancelRequested) break;
            try {
                const dump = await dumpCurrent(step.label, step.path);
                const sizeKb = Math.round(safeStringify(dump).length / 1024);
                tourState.results.push(dump);
                const stepDur = Math.round((Date.now() - stepStart)/1000);
                const ctxNow = (dump.meta && dump.meta.ctx) || '?';
                const bodyPage = (dump.game_context && dump.game_context.body_page) || '?';
                logProgress((i+1).toString().padStart(2,'0') + '. ' + step.label + ' OK | ' + sizeKb + ' KB | ctx=' + ctxNow + ' | body_page=' + bodyPage + ' | ' + stepDur + 's');
            } catch (e) {
                logProgress((i+1).toString().padStart(2,'0') + '. ' + step.label + ' ERROR: ' + e.message);
            }
            await sleep(POST_DUMP_PAUSE_MS);
        }

        const totalDur = Math.round((Date.now() - tourState.startedAt) / 1000);
        const bundle = {
            meta: {
                timestamp: new Date().toISOString(),
                host: location.hostname,
                href: location.href,
                userAgent: navigator.userAgent,
                inspectorVersion: '3.11.1',
                tour_pages: TOUR.length,
                tour_duration_sec: totalDur,
                wait_per_page_ms: WAIT_PER_PAGE_MS,
                cancelled: tourState.cancelRequested
            },
            pages: tourState.results
        };
        const text = safeStringify(bundle);
        const sizeKb = Math.round(text.length / 1024);
        updateStatus('Tour finished. ' + tourState.results.length + '/' + TOUR.length + ' pages dumped. ' + sizeKb + ' KB total. ' + totalDur + 's. Downloading bundle...');
        downloadJson(text, 'tour');
        // Also keep a reference in localStorage for one-shot inspection (size-aware)
        try {
            if (text.length < 4 * 1024 * 1024) {
                localStorage.setItem('hhauto_last_tour', text);
            } else {
                localStorage.setItem('hhauto_last_tour', '[too large for localStorage - check downloaded file]');
            }
        } catch (e) { /* quota */ }
        tourState.running = false;

        // Add a "show last result" button
        if (tourState.statusEl) {
            const showBtn = mkBtn('SHOW IN OVERLAY', '#2196F3', function() {
                showSingleDumpOverlay(text, 'tour');
            });
            showBtn.style.padding = '6px 12px';
            showBtn.style.fontSize = '12px';
            showBtn.style.marginTop = '6px';
            tourState.statusEl.parentElement.appendChild(showBtn);
        }
    }

    // ---------- buttons ----------


    // ---------- MANUAL TOUR ----------

    function showManualPrompt(step) {
        return new Promise(function(resolve) {
            const old = document.getElementById('hhauto_manual_prompt');
            if (old) old.remove();
            const cur = (function() {
                refreshCtx();
                const d = gameDoc();
                if (d) {
                    const body = d.querySelector('body[page]');
                    if (body) return body.getAttribute('page');
                }
                return '?';
            })();
            const ov = document.createElement('div');
            ov.id = 'hhauto_manual_prompt';
            ov.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#1a1a1a;color:#0f0;font:13px monospace;padding:8px 14px;z-index:1000000;box-shadow:0 4px 14px rgba(0,0,0,0.7);border-bottom:3px solid #ffb827;display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
            const msg = document.createElement('div');
            msg.style.cssText = 'flex:1;min-width:240px';
            msg.innerHTML = '<span style="color:#ffb827;font-weight:bold">Open in game:</span> '
                + '<b style="color:#fff;font-size:14px">' + step.label + '</b> '
                + '<span style="color:#888;font-size:11px">(want body[page]=' + step.expected + ', currently=' + cur + ')</span>';
            const dumpBtn = mkBtn('DUMP NOW', '#4CAF50', function() { ov.remove(); resolve('dump'); });
            const skipBtn = mkBtn('SKIP', '#ff9800', function() { ov.remove(); resolve('skip'); });
            const abortBtn = mkBtn('ABORT', '#f44336', function() { ov.remove(); resolve('abort'); });
            for (const b of [dumpBtn, skipBtn, abortBtn]) {
                b.style.padding = '6px 12px';
                b.style.fontSize = '12px';
            }
            ov.appendChild(msg);
            ov.appendChild(dumpBtn);
            ov.appendChild(skipBtn);
            ov.appendChild(abortBtn);
            document.body.appendChild(ov);
        });
    }

    function getCurrentBodyPageSafe() {
        try {
            refreshCtx();
            const d = gameDoc();
            if (d) {
                const body = d.querySelector('body[page]');
                if (body) return body.getAttribute('page');
            }
        } catch (e) {}
        return null;
    }

    async function runManualTour() {
        const results = [];
        const startedAt = Date.now();
        // Build a small status overlay (progress only)
        const old = document.getElementById('hhauto_manual_overlay');
        if (old) old.remove();
        const ov = document.createElement('div');
        ov.id = 'hhauto_manual_overlay';
        ov.style.cssText = 'position:fixed;top:80px;right:10px;width:380px;background:rgba(0,0,0,0.92);color:#0f0;font:12px monospace;padding:12px;border-radius:6px;z-index:999998;box-shadow:0 4px 16px rgba(0,0,0,0.6);';
        const title = document.createElement('div');
        title.style.cssText = 'font-weight:bold;color:#ffb827;font-size:14px;margin-bottom:6px;';
        title.textContent = 'HHAuto Manual Tour';
        const status = document.createElement('div');
        status.style.cssText = 'margin-bottom:6px;line-height:1.5;';
        const log = document.createElement('div');
        log.style.cssText = 'max-height:300px;overflow-y:auto;font-size:11px;color:#aaa;border-top:1px solid #333;padding-top:6px;';
        ov.appendChild(title); ov.appendChild(status); ov.appendChild(log);
        document.body.appendChild(ov);

        for (let i = 0; i < MANUAL_PAGES.length; i++) {
            const step = MANUAL_PAGES[i];
            status.innerHTML = 'Page ' + (i+1) + '/' + MANUAL_PAGES.length + ': <b>' + step.label + '</b><br/>Open in game UI then click DUMP NOW';
            const choice = await showManualPrompt(step);
            if (choice === 'abort') {
                const line = document.createElement('div'); line.textContent = 'ABORTED at ' + (i+1); log.appendChild(line);
                break;
            }
            if (choice === 'skip') {
                const line = document.createElement('div'); line.textContent = (i+1) + '. ' + step.label + ' SKIPPED'; log.appendChild(line);
                continue;
            }
            // dump current page
            try {
                const dump = dumpEverything();
                await new Promise(function(resolve) {
                    fetchBlessings(function(blessings) { dump.live_blessings_api = blessings; resolve(); });
                });
                const actualPage = getCurrentBodyPageSafe();
                dump.tour_meta = {
                    label: step.label,
                    requested_path: step.path,
                    expected_page: step.expected,
                    actual_page: actualPage,
                    match: actualPage === step.expected,
                    manual: true
                };
                results.push(dump);
                const sizeKb = Math.round(safeStringify(dump).length / 1024);
                const matchTag = dump.tour_meta.match ? 'OK' : ('mismatch want=' + step.expected + ' got=' + actualPage);
                const line = document.createElement('div');
                line.textContent = (i+1) + '. ' + step.label + ' ' + matchTag + ' | ' + sizeKb + ' KB';
                log.appendChild(line);
                log.scrollTop = log.scrollHeight;
            } catch (e) {
                const line = document.createElement('div');
                line.textContent = (i+1) + '. ' + step.label + ' ERROR: ' + e.message;
                log.appendChild(line);
            }
        }

        const totalDur = Math.round((Date.now() - startedAt) / 1000);
        const bundle = {
            meta: {
                timestamp: new Date().toISOString(),
                host: location.hostname,
                href: location.href,
                userAgent: navigator.userAgent,
                inspectorVersion: '3.11.1',
                tour_pages: MANUAL_PAGES.length,
                tour_completed_pages: results.length,
                tour_duration_sec: totalDur,
                manual: true
            },
            pages: results
        };
        const text = safeStringify(bundle);
        status.innerHTML = 'Manual tour finished: ' + results.length + '/' + MANUAL_PAGES.length + ' pages, ' + Math.round(text.length/1024) + ' KB';
        downloadJson(text, 'manual_tour');
    }

    function makeButtons() {
        refreshCtx();
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;display:flex;flex-direction:column;gap:6px;font-family:monospace;';

        const single = document.createElement('div');
        single.textContent = 'DUMP THIS PAGE';
        single.style.cssText = 'background:#ff4444;color:white;padding:14px 20px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,0.5);text-align:center;';
        single.onclick = runSingleDump;
        single.title = 'Dump current page only (' + CTX.where + ')';

        const tour = document.createElement('div');
        tour.textContent = 'AUTO TOUR';
        tour.style.cssText = 'background:#2196F3;color:white;padding:14px 20px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,0.5);text-align:center;';
        tour.onclick = runTour;
        tour.title = 'Auto-tour through ' + TOUR.length + ' pages that work via iframe nav';

        const manual = document.createElement('div');
        manual.textContent = 'MANUAL TOUR';
        manual.style.cssText = 'background:#9C27B0;color:white;padding:14px 20px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,0.5);text-align:center;';
        manual.onclick = runManualTour;
        manual.title = 'Walk through ' + MANUAL_PAGES.length + ' pages that need manual navigation';

        wrap.appendChild(single);
        wrap.appendChild(tour);
        wrap.appendChild(manual);
        document.body.appendChild(wrap);
    }

    setTimeout(makeButtons, 2000);

})();
