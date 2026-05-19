// ==UserScript==
// @name         HHAuto Issue 1598 Network Sniffer
// @namespace    https://github.com/OldRon1977/HHauto
// @version      1.1.0
// @description  Maximum-coverage network sniffer for diagnosing PoP "Access forbidden" on accounts with very large rosters (issue #1598). Captures XHR, fetch, sendBeacon, WebSocket, EventSource, and PerformanceObserver resource entries. Live overlay + console API.
// @author       HHAuto
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
// @grant        GM_setClipboard
// @run-at       document-start
// @noframes
// ==/UserScript==

// HHAuto Network Sniffer for Issue #1598
// =======================================
//
// Purpose
// -------
// Diagnose "Access forbidden" on accounts with 2400+ girls when the
// HHAuto script opens the Place of Power tab. The hypothesis is that
// the game performs a roster-hydration burst (XHR or fetch) that the
// HHAuto AjaxTracker (XHR-only) does not see, so the script sends the
// next request before the server has finished serving the roster.
//
// This bonus script answers two questions with data:
//
//   1. Does the game use fetch() for any of the roster-load requests?
//   2. How long does the longest pre-Forbidden request take?
//
// To do that without relying on a single transport, this script hooks
// every web-platform request channel a userscript can practically
// reach: XHR, fetch, sendBeacon, WebSocket, EventSource. On top of
// that, a PerformanceObserver of type "resource" runs as a catch-all
// for anything that bypasses the prototype hooks (e.g. dynamic <img>
// pixels, dynamic <script> inserts, internal browser fetches).
//
// Privacy
// -------
// All data stays in the browser tab. The console API exposes the
// captured events and a CSV exporter. Before sharing, the user is
// expected to redact session tokens (sess=...) themselves.
//
// Usage
// -----
//   1. Install this userscript in Tampermonkey.
//   2. Disable the main HHAuto userscript (master switch off or the
//      whole script disabled in Tampermonkey).
//   3. Open the game in a fresh tab. Wait until the home page is
//      rendered and idle.
//   4. In DevTools console, run __x1598.clear() to drop the boot noise.
//   5. Click the Place of Power tab manually. Observe whether the page
//      lands on the activities/?tab=pop view or shows "Access forbidden".
//   6. In the console, run __x1598.stats() to read the verdict.
//
// Public API on unsafeWindow.__x1598:
//   stats()      -> compact summary {xhrCount, fetchCount, ...}
//   dump()       -> console.table of game-relevant events (filtered)
//   dumpAll()    -> console.table of every captured event
//   csv()        -> CSV string of game-relevant events
//   csvAll()     -> CSV string of every captured event
//   json()       -> JSON.stringify of every captured event
//   copy(kind)   -> GM_setClipboard with kind = "csv" | "csvAll" | "json"
//   setFilter(rx)-> override the relevance regex (default below)
//   clear()      -> reset event store
//   events       -> raw array (read at your own risk, can be large)
//
// The DEFAULT_FILTER targets HHAuto-relevant URLs only (ajax.php,
// roster, harem, PoP, etc.) so dump() and csv() stay small. Use
// __x1598.dumpAll() / csvAll() for the full picture.
//
// Reference: docs-internal/REVIEW_issue_1598_pop_forbidden.md
//            docs-internal/VERIFY_issue_1598_pop_network_capture.md
//

(function () {
    'use strict';

    const VERSION = '1.1.0';
    const LOG_PREFIX = '[1598-NET v' + VERSION + ']';

    // The performance.now() origin we anchor every event to. Subtracting
    // it gives a millisecond timeline relative to the moment this hook
    // installed (document-start), which is the earliest a userscript
    // can run.
    const T0 = (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : 0;
    function nowRel() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now() - T0;
        }
        return Date.now() - T0;
    }

    // Resolve the page-context window. Userscripts in Tampermonkey run
    // in a sandbox by default; unsafeWindow is the page-side window
    // where the game JS lives. Hooking that window covers the game's
    // own XHR/fetch calls. We also hook our own sandbox window for
    // completeness (some Tampermonkey configurations route fetch
    // through the sandbox).
    const pageWin = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    const sandboxWin = window;

    const events = [];
    let nextId = 0;

    // Caps. Capturing without limits would eventually OOM the tab.
    // 5000 events is enough for several minutes of game activity at
    // typical request rates and stays well under any reasonable
    // memory budget.
    const MAX_EVENTS = 5000;
    const MAX_BODY_LEN = 1024;

    // Default relevance filter. Game endpoints all hit /ajax.php or
    // include a small number of well-known segments; static assets
    // (CSS, JS, images, fonts) are filtered out so the default dump
    // stays focused on what matters for issue #1598. The user can
    // override via __x1598.setFilter(/.*/) to see everything.
    const DEFAULT_FILTER = /(\/ajax\.php|hh_ajax|girls|harem|salary|pop|battle|hero|league|champion|reward|event|season|pantheon|labyrinth|penta|raid|troll|bossbang|club)/i;
    let relevanceFilter = DEFAULT_FILTER;

    function record(kind, phase, fields) {
        if (events.length >= MAX_EVENTS) {
            // Drop oldest to keep the cap a sliding window. Avoids
            // silent loss in a long session and means the user always
            // sees the latest events when they hit Forbidden.
            events.shift();
        }
        const ev = {
            id: ++nextId,
            tRel: Math.round(nowRel()),
            kind: kind,
            phase: phase,
            method: fields && fields.method ? fields.method : '',
            url: fields && fields.url ? String(fields.url) : '',
            status: (fields && typeof fields.status !== 'undefined') ? fields.status : '',
            duration: (fields && typeof fields.duration === 'number') ? Math.round(fields.duration) : '',
            bodyLen: (fields && typeof fields.bodyLen === 'number') ? fields.bodyLen : '',
            note: fields && fields.note ? String(fields.note) : '',
        };
        events.push(ev);

        // Console output uses CSS coloring so the user can spot
        // important events (403, fetch, WS) at a glance without
        // having to call dump() repeatedly.
        const color = consoleColor(kind, ev.status);
        const head = LOG_PREFIX + ' +' + ev.tRel + 'ms #' + ev.id + ' ' + kind + ' ' + phase;
        const url = (ev.url || '').slice(0, 160);
        if (typeof console !== 'undefined' && console.log) {
            if (color) {
                console.log('%c' + head + '%c ' + (ev.method || '') + ' ' + url
                    + (ev.status !== '' ? ' [' + ev.status + ']' : '')
                    + (ev.duration !== '' ? ' ' + ev.duration + 'ms' : '')
                    + (ev.note ? ' (' + ev.note + ')' : ''),
                    'color:' + color + ';font-weight:bold', '');
            } else {
                console.log(head + ' ' + (ev.method || '') + ' ' + url
                    + (ev.status !== '' ? ' [' + ev.status + ']' : '')
                    + (ev.duration !== '' ? ' ' + ev.duration + 'ms' : '')
                    + (ev.note ? ' (' + ev.note + ')' : ''));
            }
        }

        updateOverlay();
    }

    function consoleColor(kind, status) {
        if (status === 403) return '#ff3030';
        if (status === 500 || status === 502 || status === 503) return '#ff8080';
        switch (kind) {
            case 'XHR':      return '#22c1c3';
            case 'FETCH':    return '#e7b416';
            case 'BEACON':   return '#cb6ce6';
            case 'WS':       return '#5cb85c';
            case 'EVENTSRC': return '#5cb85c';
            case 'RES':      return '#888';
            case 'NAV':      return '#888';
            case 'PAGE':     return '#888';
            case 'NET':      return '#888';
            default:         return '';
        }
    }

    // ---- XHR hook -----------------------------------------------------
    function patchXHR(targetWin) {
        try {
            const Xhr = targetWin && targetWin.XMLHttpRequest;
            if (!Xhr || !Xhr.prototype) return false;
            if (Xhr.prototype.__x1598_hooked) return false;
            Xhr.prototype.__x1598_hooked = true;

            const origOpen = Xhr.prototype.open;
            const origSend = Xhr.prototype.send;

            Xhr.prototype.open = function (method, url) {
                this.__x1598_method = method;
                this.__x1598_url = url;
                return origOpen.apply(this, arguments);
            };

            Xhr.prototype.send = function (body) {
                const start = nowRel();
                const bodyLen = (typeof body === 'string') ? body.length
                    : (body && typeof body.byteLength === 'number') ? body.byteLength
                    : 0;
                record('XHR', 'start', {
                    method: this.__x1598_method || '?',
                    url: this.__x1598_url || '?',
                    bodyLen: bodyLen,
                });
                const xhr = this;
                this.addEventListener('loadend', function () {
                    record('XHR', 'end', {
                        method: xhr.__x1598_method || '?',
                        url: xhr.__x1598_url || '?',
                        status: xhr.status,
                        duration: nowRel() - start,
                    });
                }, { once: true });
                return origSend.apply(this, arguments);
            };
            return true;
        } catch (e) {
            return false;
        }
    }

    // ---- fetch hook ---------------------------------------------------
    function patchFetch(targetWin) {
        try {
            if (!targetWin || typeof targetWin.fetch !== 'function') return false;
            if (targetWin.__x1598_fetch_hooked) return false;
            targetWin.__x1598_fetch_hooked = true;

            const origFetch = targetWin.fetch;
            targetWin.fetch = function (input, init) {
                const start = nowRel();
                const url = (typeof input === 'string')
                    ? input
                    : (input && input.url) ? input.url : '?';
                const method = (init && init.method)
                    || (input && input.method)
                    || 'GET';
                record('FETCH', 'start', {
                    method: method,
                    url: url,
                });
                let p;
                try {
                    p = origFetch.apply(this, arguments);
                } catch (syncErr) {
                    record('FETCH', 'error', {
                        method: method,
                        url: url,
                        status: -1,
                        duration: nowRel() - start,
                        note: 'sync throw: ' + (syncErr && syncErr.message || syncErr),
                    });
                    throw syncErr;
                }
                p.then(function (resp) {
                    record('FETCH', 'end', {
                        method: method,
                        url: url,
                        status: resp && typeof resp.status === 'number' ? resp.status : '',
                        duration: nowRel() - start,
                    });
                }, function (err) {
                    record('FETCH', 'error', {
                        method: method,
                        url: url,
                        status: -1,
                        duration: nowRel() - start,
                        note: err && err.message || String(err),
                    });
                });
                return p;
            };
            return true;
        } catch (e) {
            return false;
        }
    }

    // ---- sendBeacon hook ---------------------------------------------
    // Beacon is fire-and-forget POST used for analytics. Captured here
    // so we know when the page sends telemetry (which can in theory
    // race with our requests).
    function patchBeacon(targetWin) {
        try {
            if (!targetWin || !targetWin.navigator || typeof targetWin.navigator.sendBeacon !== 'function') return false;
            if (targetWin.navigator.__x1598_beacon_hooked) return false;
            targetWin.navigator.__x1598_beacon_hooked = true;

            const origBeacon = targetWin.navigator.sendBeacon.bind(targetWin.navigator);
            targetWin.navigator.sendBeacon = function (url, data) {
                const bodyLen = (typeof data === 'string') ? data.length
                    : (data && typeof data.byteLength === 'number') ? data.byteLength
                    : 0;
                record('BEACON', 'send', {
                    method: 'POST',
                    url: url,
                    bodyLen: bodyLen,
                });
                return origBeacon(url, data);
            };
            return true;
        } catch (e) {
            return false;
        }
    }

    // ---- WebSocket hook ----------------------------------------------
    function patchWebSocket(targetWin) {
        try {
            if (!targetWin || typeof targetWin.WebSocket !== 'function') return false;
            if (targetWin.__x1598_ws_hooked) return false;
            targetWin.__x1598_ws_hooked = true;

            const OrigWS = targetWin.WebSocket;
            function HookedWS(url, protocols) {
                record('WS', 'open', { method: 'WS', url: url });
                let ws;
                try {
                    ws = (typeof protocols === 'undefined')
                        ? new OrigWS(url)
                        : new OrigWS(url, protocols);
                } catch (e) {
                    record('WS', 'error', { method: 'WS', url: url, note: e && e.message || String(e) });
                    throw e;
                }
                ws.addEventListener('message', function (evt) {
                    const len = evt && evt.data && (evt.data.length || evt.data.byteLength) || 0;
                    record('WS', 'message', { method: 'WS', url: url, bodyLen: len });
                });
                ws.addEventListener('close', function (evt) {
                    record('WS', 'close', { method: 'WS', url: url, status: evt && evt.code, note: evt && evt.reason });
                });
                ws.addEventListener('error', function () {
                    record('WS', 'error', { method: 'WS', url: url });
                });
                const origSend = ws.send;
                ws.send = function (data) {
                    const len = (typeof data === 'string') ? data.length
                        : (data && typeof data.byteLength === 'number') ? data.byteLength
                        : 0;
                    record('WS', 'send', { method: 'WS', url: url, bodyLen: len });
                    return origSend.apply(ws, arguments);
                };
                return ws;
            }
            HookedWS.prototype = OrigWS.prototype;
            HookedWS.CONNECTING = OrigWS.CONNECTING;
            HookedWS.OPEN = OrigWS.OPEN;
            HookedWS.CLOSING = OrigWS.CLOSING;
            HookedWS.CLOSED = OrigWS.CLOSED;
            targetWin.WebSocket = HookedWS;
            return true;
        } catch (e) {
            return false;
        }
    }

    // ---- EventSource hook --------------------------------------------
    function patchEventSource(targetWin) {
        try {
            if (!targetWin || typeof targetWin.EventSource !== 'function') return false;
            if (targetWin.__x1598_es_hooked) return false;
            targetWin.__x1598_es_hooked = true;

            const OrigES = targetWin.EventSource;
            function HookedES(url, init) {
                record('EVENTSRC', 'open', { method: 'GET', url: url });
                const es = new OrigES(url, init);
                es.addEventListener('message', function (evt) {
                    const len = evt && evt.data && evt.data.length || 0;
                    record('EVENTSRC', 'message', { method: 'GET', url: url, bodyLen: len });
                });
                es.addEventListener('error', function () {
                    record('EVENTSRC', 'error', { method: 'GET', url: url });
                });
                return es;
            }
            HookedES.prototype = OrigES.prototype;
            targetWin.EventSource = HookedES;
            return true;
        } catch (e) {
            return false;
        }
    }

    // ---- PerformanceObserver: resource timing ------------------------
    // Catch-all for any HTTP request that the prototype hooks miss
    // (image pixels via <img>, dynamic <script> inserts, browser-
    // initiated requests). Resource entries do not include status, so
    // we cannot detect 403s here, but we get URL and timing.
    function installResourceObserver(targetWin) {
        try {
            const PO = targetWin && targetWin.PerformanceObserver;
            if (typeof PO !== 'function') return false;
            const obs = new PO(function (list) {
                const entries = list.getEntries();
                for (let i = 0; i < entries.length; i++) {
                    const e = entries[i];
                    if (!e || !e.name) continue;
                    record('RES', 'res', {
                        method: e.initiatorType || '?',
                        url: e.name,
                        duration: e.duration,
                        note: 'transferSize=' + (e.transferSize || 0),
                    });
                }
            });
            obs.observe({ entryTypes: ['resource', 'navigation'] });
            return true;
        } catch (e) {
            return false;
        }
    }

    // ---- Forbidden detector -------------------------------------------
    // Even if the response status is missing (e.g. captured only via
    // resource observer), the game renders <body>Forbidden</body> on
    // hard 403. We log that explicitly so the timeline shows the moment
    // the user sees the error.
    function installForbiddenDetector(targetWin) {
        const check = function () {
            try {
                const body = targetWin && targetWin.document && targetWin.document.body;
                if (!body) return;
                const text = (body.innerText || '').trim();
                if (text === 'Forbidden') {
                    record('PAGE', 'forbidden', {
                        url: targetWin.location && targetWin.location.href,
                        status: 403,
                        note: 'document body is the literal string "Forbidden"',
                    });
                }
            } catch (e) { /* ignore */ }
        };
        if (targetWin.document && targetWin.document.readyState === 'complete') {
            check();
        } else {
            try {
                targetWin.addEventListener('DOMContentLoaded', check, { once: true });
                targetWin.addEventListener('load', check, { once: true });
            } catch (e) { /* ignore */ }
        }
    }

    // ---- Public API ---------------------------------------------------
    function statsObj() {
        const ends = events.filter(function (e) {
            return e.phase === 'end' || e.phase === 'error' || e.phase === 'res';
        });
        const xhr = events.filter(function (e) { return e.kind === 'XHR' && e.phase === 'end'; });
        const fetchEnds = events.filter(function (e) { return e.kind === 'FETCH' && (e.phase === 'end' || e.phase === 'error'); });
        const beacons = events.filter(function (e) { return e.kind === 'BEACON'; });
        const wsMsgs = events.filter(function (e) { return e.kind === 'WS'; });
        const resCount = events.filter(function (e) { return e.kind === 'RES'; }).length;
        const forbids = events.filter(function (e) { return e.status === 403; });
        const longest = ends.slice().sort(function (a, b) {
            const ad = typeof a.duration === 'number' ? a.duration : 0;
            const bd = typeof b.duration === 'number' ? b.duration : 0;
            return bd - ad;
        })[0];
        return {
            totalEvents: events.length,
            xhrCount: xhr.length,
            fetchCount: fetchEnds.length,
            beaconCount: beacons.length,
            wsEventCount: wsMsgs.length,
            resourceCount: resCount,
            forbiddenCount: forbids.length,
            longest: longest ? {
                kind: longest.kind,
                durMs: longest.duration,
                method: longest.method,
                url: (longest.url || '').slice(0, 200),
            } : null,
            forbiddens: forbids.map(function (e) {
                return {
                    tRel_ms: e.tRel,
                    kind: e.kind,
                    method: e.method,
                    url: (e.url || '').slice(0, 200),
                };
            }),
        };
    }

    function tableRows(filter) {
        const rx = filter || relevanceFilter;
        return events
            .filter(function (e) {
                // Always keep our own meta events and forbidden-page markers.
                if (e.kind === 'NET' || e.kind === 'PAGE') return true;
                return rx.test(e.url || '');
            })
            .map(function (e) {
                return {
                    id: e.id,
                    tRel_ms: e.tRel,
                    kind: e.kind,
                    phase: e.phase,
                    method: e.method,
                    status: e.status,
                    dur_ms: e.duration,
                    bodyLen: e.bodyLen,
                    url: (e.url || '').slice(0, 140),
                    note: e.note,
                };
            });
    }

    function csvFromRows(rows) {
        const head = 'id;tRel_ms;kind;phase;method;status;dur_ms;bodyLen;url;note';
        const lines = rows.map(function (r) {
            return [
                r.id, r.tRel_ms, r.kind, r.phase, r.method, r.status,
                r.dur_ms, r.bodyLen,
                String(r.url || '').replace(/[;\n\r]/g, ' '),
                String(r.note || '').replace(/[;\n\r]/g, ' '),
            ].join(';');
        });
        return head + '\n' + lines.join('\n');
    }

    const api = {
        version: VERSION,
        events: events,
        T0: T0,
        stats: function () { return statsObj(); },
        dump: function () {
            if (typeof console !== 'undefined' && console.table) console.table(tableRows());
        },
        dumpAll: function () {
            if (typeof console !== 'undefined' && console.table) console.table(tableRows(/.*/));
        },
        csv: function () { return csvFromRows(tableRows()); },
        csvAll: function () { return csvFromRows(tableRows(/.*/)); },
        json: function () { return JSON.stringify(events); },
        copy: function (kind) {
            let payload;
            if (kind === 'csvAll') payload = csvFromRows(tableRows(/.*/));
            else if (kind === 'json') payload = JSON.stringify(events);
            else payload = csvFromRows(tableRows());
            try {
                if (typeof GM_setClipboard === 'function') {
                    GM_setClipboard(payload, 'text');
                    console.log(LOG_PREFIX + ' copied ' + (kind || 'csv') + ' to clipboard (' + payload.length + ' chars)');
                    return true;
                }
            } catch (e) { /* fallthrough */ }
            try {
                if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(payload);
                    console.log(LOG_PREFIX + ' copied ' + (kind || 'csv') + ' to clipboard (' + payload.length + ' chars)');
                    return true;
                }
            } catch (e) { /* fallthrough */ }
            console.warn(LOG_PREFIX + ' clipboard API unavailable, returning payload as string');
            return payload;
        },
        setFilter: function (rx) {
            if (rx instanceof RegExp) {
                relevanceFilter = rx;
                console.log(LOG_PREFIX + ' filter set to ' + rx);
            } else {
                console.warn(LOG_PREFIX + ' setFilter expects a RegExp');
            }
        },
        clear: function () {
            events.length = 0;
            updateOverlay();
            console.log(LOG_PREFIX + ' cleared');
        },
    };

    // Expose on both windows so the user can call __x1598 from any
    // context (DevTools console attaches to the page-context by
    // default in modern browsers, but Tampermonkey console may differ).
    try { pageWin.__x1598 = api; } catch (e) { /* ignore */ }
    try { sandboxWin.__x1598 = api; } catch (e) { /* ignore */ }

    // ---- Mini overlay -------------------------------------------------
    let overlayEl = null;
    let countersEl = null;

    function buildOverlay() {
        try {
            if (!sandboxWin.document || !sandboxWin.document.body) return;
            if (overlayEl) return;
            overlayEl = sandboxWin.document.createElement('div');
            overlayEl.id = 'x1598-overlay';
            overlayEl.style.cssText = [
                'position:fixed', 'bottom:8px', 'right:8px', 'z-index:2147483647',
                'background:rgba(0,0,0,0.8)', 'color:#0f0', 'padding:6px 8px',
                'font:12px/1.3 monospace', 'border:1px solid #0f0', 'border-radius:4px',
                'pointer-events:auto', 'user-select:text',
            ].join(';');

            const title = sandboxWin.document.createElement('div');
            title.textContent = '1598-NET v' + VERSION;
            title.style.cssText = 'color:#0ff;margin-bottom:4px;font-weight:bold';
            overlayEl.appendChild(title);

            countersEl = sandboxWin.document.createElement('pre');
            countersEl.style.cssText = 'margin:0;color:#0f0;background:transparent;border:none;font:12px/1.3 monospace';
            overlayEl.appendChild(countersEl);

            const btnRow = sandboxWin.document.createElement('div');
            btnRow.style.cssText = 'margin-top:6px;display:flex;gap:4px;flex-wrap:wrap';

            function addBtn(label, handler, color) {
                const b = sandboxWin.document.createElement('button');
                b.textContent = label;
                b.style.cssText = 'padding:2px 6px;font:11px monospace;background:' + (color || '#222')
                    + ';color:#fff;border:1px solid #555;cursor:pointer;border-radius:2px';
                b.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    try { handler(); } catch (e) { console.warn(LOG_PREFIX + ' button error', e); }
                });
                btnRow.appendChild(b);
            }
            addBtn('STATS', function () { console.log(LOG_PREFIX, api.stats()); });
            addBtn('DUMP',  function () { api.dump(); });
            addBtn('ALL',   function () { api.dumpAll(); });
            addBtn('CSV',   function () { api.copy('csv'); }, '#246');
            addBtn('JSON',  function () { api.copy('json'); }, '#246');
            addBtn('CLEAR', function () { api.clear(); }, '#622');
            overlayEl.appendChild(btnRow);

            sandboxWin.document.body.appendChild(overlayEl);
            updateOverlay();
        } catch (e) {
            console.warn(LOG_PREFIX + ' overlay build failed', e);
        }
    }

    function updateOverlay() {
        if (!countersEl) return;
        const s = statsObj();
        countersEl.textContent =
              'XHR    : ' + s.xhrCount + '\n'
            + 'FETCH  : ' + s.fetchCount + '\n'
            + 'BEACON : ' + s.beaconCount + '\n'
            + 'WS     : ' + s.wsEventCount + '\n'
            + 'RES    : ' + s.resourceCount + '\n'
            + '403    : ' + s.forbiddenCount + '\n'
            + 'TOTAL  : ' + s.totalEvents;
        if (s.forbiddenCount > 0) {
            overlayEl.style.borderColor = '#f33';
            overlayEl.style.color = '#fdd';
            countersEl.style.color = '#fdd';
        }
    }

    // ---- Bring it all up ---------------------------------------------
    const installed = {
        pageXHR: patchXHR(pageWin),
        pageFetch: patchFetch(pageWin),
        pageBeacon: patchBeacon(pageWin),
        pageWS: patchWebSocket(pageWin),
        pageEventSource: patchEventSource(pageWin),
        sandboxXHR: patchXHR(sandboxWin),
        sandboxFetch: patchFetch(sandboxWin),
        resourceObserver: installResourceObserver(pageWin) || installResourceObserver(sandboxWin),
    };
    record('NET', 'install', {
        url: 'hooks-installed',
        note: JSON.stringify(installed),
    });
    installForbiddenDetector(pageWin);

    if (sandboxWin.document && sandboxWin.document.readyState === 'loading') {
        sandboxWin.document.addEventListener('DOMContentLoaded', buildOverlay, { once: true });
    } else {
        buildOverlay();
    }

    console.log(LOG_PREFIX + ' installed at document-start. API: __x1598.stats() / .dump() / .dumpAll() / .csv() / .copy("csv"|"json") / .clear() / .setFilter(/regex/). Hooks:', installed);
})();