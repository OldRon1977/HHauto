#!/usr/bin/env node
/**
 * Game catalogue -- what the game calls things, and what it sends.
 *
 *   node scripts/catalogue/run.mjs bundle     what the game's own source declares
 *   node scripts/catalogue/run.mjs observe    what it actually sends, while you play
 *   node scripts/catalogue/run.mjs snapshot   what is on the page right now
 *
 * `bundle` needs nothing: the game's script is served without a login.
 * `observe` and `snapshot` attach to a browser you are already using; they
 * read and never write. See lib/attach.mjs for how to open the port.
 *
 * Output goes to scripts/catalogue/out/ (gitignored) and a summary to stdout.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attach, gamePages, sessionState, findChromium, DEFAULT_PORT } from './lib/attach.mjs';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { shapeOf, mergeShapes, shapeLines } from './lib/shape.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const OUT = process.env.HHAUTO_CATALOGUE_OUT || join(HERE, 'out');

const BASE = process.env.HHAUTO_BASE_URL || 'https://www.hentaiheroes.com';
const BUNDLE_PATH = '/build/build/shared.js';

const write = (name, data) => {
    mkdirSync(OUT, { recursive: true });
    const p = join(OUT, name);
    writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n');
    console.log(`  wrote ${relative(REPO, p)} (${(statSync(p).size / 1024).toFixed(1)} kB)`);
};

// ==================================================================== bundle

/** Every `action:"…"` the game's source declares as a literal. */
const RE_ACTION = /action:"([a-z_0-9]+)"/g;
/** The `class:"…"` that rides along on those calls (HHauto sends class: 'Hero'). */
const RE_CLASS = /class:"([A-Za-z]+)"/g;
/** The game's own namespace, which survives minification. */
const RE_SHARED = /\bshared\.([A-Za-z_$][A-Za-z_$0-9]*(?:\.[A-Za-z_$][A-Za-z_$0-9]*){0,3})/g;
/** Page globals the game hangs off window under its own prefix. */
const RE_HH_GLOBAL = /\b(hh_[a-z_0-9]{2,40})\b/g;

const tally = (text, re) => {
    const counts = new Map();
    for (const m of text.matchAll(re)) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

/** What HHauto itself sends, so the index can mark what is already addressed. */
function hhautoActions() {
    const found = new Set();
    const walk = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const p = join(dir, entry.name);
            if (entry.isDirectory()) { walk(p); continue; }
            if (!entry.name.endsWith('.ts')) continue;
            const src = readFileSync(p, 'utf8');
            // Only inside an object that also mentions a class or is handed to
            // hh_ajax; a bare `action:` in a pipeline descriptor is not a call.
            for (const m of src.matchAll(/action\s*:\s*['"]([a-z_0-9]+)['"]/g)) found.add(m[1]);
        }
    };
    walk(join(REPO, 'src'));
    return found;
}

async function cmdBundle() {
    const url = BASE + BUNDLE_PATH;
    console.log(`fetching ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
        console.error(`  HTTP ${res.status} -- the bundle path moved. Look for the script tag on the`);
        console.error('  game page and update BUNDLE_PATH.');
        process.exit(1);
    }
    const text = await res.text();
    console.log(`  ${(text.length / 1024 / 1024).toFixed(2)} MB, no login needed`);
    console.log('');

    const actions = tally(text, RE_ACTION);
    const classes = tally(text, RE_CLASS);
    const shared = tally(text, RE_SHARED);
    const globals = tally(text, RE_HH_GLOBAL);
    const used = hhautoActions();

    const cheats = actions.filter(([a]) => a.startsWith('cheat_'));
    const real = actions.filter(([a]) => !a.startsWith('cheat_'));
    const unused = real.filter(([a]) => !used.has(a));
    // The number that matters more than any of the above: how much of what
    // HHauto sends is visible in here at all.
    const usedList = [...used].sort();
    const usedVisible = usedList.filter((a) => actions.some(([n]) => n === a));

    const index = {
        source: { url, bytes: text.length, fetchedAt: new Date().toISOString() },
        caveats: [
            'Only literal `action:"…"` occurrences are visible. Names the game assembles at runtime are not in here -- do_battles_trolls and do_battles_seasons are known examples, both found through observed traffic rather than static reading.',
            'The `hhautoUses` flag is a grep over src/ for action:"…" and over-reports: pipeline handler descriptors use the same key without being calls.',
            'Counts are occurrences in the source, not importance.',
        ],
        actions: {
            total: actions.length,
            live: real.map(([name, count]) => ({ name, count, hhautoUses: used.has(name) })),
            cheat: cheats.map(([name]) => name),
        },
        ajaxClasses: classes.map(([name, count]) => ({ name, count })),
        sharedApi: shared.map(([path, count]) => ({ path: 'shared.' + path, count })),
        hhGlobals: globals.map(([name, count]) => ({ name, count })),
    };
    write('bundle-index.json', index);

    const report = [
        `# Game catalogue -- from the game's own source`,
        ``,
        `${url}`,
        `${(text.length / 1024 / 1024).toFixed(2)} MB, fetched ${index.source.fetchedAt}, no login required.`,
        ``,
        `## AJAX actions (${real.length} live, ${cheats.length} cheat/dev)`,
        ``,
        `| action | in source | HHauto sends it |`,
        `|---|---:|---|`,
        ...real.map(([n, c]) => `| \`${n}\` | ${c} | ${used.has(n) ? 'yes' : '—'} |`),
        ``,
        `## The blind spot, measured`,
        ``,
        `HHauto sends ${usedList.length} action names. Only **${usedVisible.length}** of them appear as a`,
        `literal in this file: ${usedVisible.map((a) => '`' + a + '`').join(', ') || '(none)'}.`,
        ``,
        `That ratio is the point. Static reading finds what the source spells out and`,
        `nothing else -- the game assembles many action names at runtime, and some of`,
        `the ${usedList.length} are not AJAX calls at all but handler names that happen to use the`,
        `same key. So read the ${unused.length} actions above as *candidates worth looking at*, not`,
        `as capability HHauto is leaving unused. \`observe\` is what settles it: it records`,
        `what actually goes over the wire, assembled names included.`,
        ``,
        `## AJAX classes`,
        ``,
        ...classes.map(([n, c]) => `- \`${n}\` (${c})`),
        ``,
        `## shared.* -- the game's own API surface`,
        ``,
        `Not minified, so these are the real names. Top 80 by occurrence:`,
        ``,
        ...shared.slice(0, 80).map(([p, c]) => `- \`shared.${p}\` (${c})`),
        ``,
        `## hh_* page globals`,
        ``,
        ...globals.slice(0, 60).map(([n, c]) => `- \`${n}\` (${c})`),
        ``,
        `## What this cannot tell you`,
        ``,
        ...index.caveats.map((c) => `- ${c}`),
        ``,
    ].join('\n');
    write('bundle-index.md', report);

    console.log('');
    console.log(`  ${real.length} live actions, ${cheats.length} cheat/dev`);
    console.log(`  ${usedVisible.length} of the ${usedList.length} action names HHauto sends are literals here`
        + ` -- the rest are assembled at runtime or are not ajax calls`);
    console.log(`  ${classes.length} ajax classes, ${shared.length} shared.* paths, ${globals.length} hh_* globals`);
}

// =================================================================== observe

async function cmdObserve(port, seconds) {
    const { browser, close } = await attach(port);
    const { pages, matched, total } = gamePages(browser);
    console.log(`attached on port ${port}: ${total} open page(s), ${matched ? pages.length + ' on the game' : 'none on the game -- watching all'}`);

    for (const p of pages) {
        const s = await sessionState(p);
        if (s.heroId) console.log(`  logged in on ${new URL(p.url()).pathname} (id=${s.heroId})`);
    }
    console.log('');
    console.log(seconds
        ? `Recording for ${seconds}s. Play normally -- battle pages, popups, anything.`
        : 'Recording. Play normally -- battle pages, popups, anything. Ctrl-C to write.');
    console.log('');

    const byAction = new Map();
    const record = (action, cls, reqShape, resShape, url) => {
        const key = cls ? `${cls}.${action}` : action;
        const prev = byAction.get(key) || { action, class: cls || null, calls: 0, url, request: undefined, response: undefined };
        prev.calls += 1;
        prev.request = mergeShapes(prev.request, reqShape);
        prev.response = mergeShapes(prev.response, resShape);
        byAction.set(key, prev);
        return prev;
    };

    const parseBody = (body) => {
        if (!body) return {};
        try { return JSON.parse(body); } catch { /* form encoded */ }
        const out = {};
        for (const [k, v] of new URLSearchParams(body)) out[k] = v;
        return out;
    };

    const onResponse = async (response) => {
        const req = response.request();
        const url = response.url();
        if (!/\/ajax\.php/.test(url)) return;
        let params = {};
        try { params = parseBody(req.postData()); } catch { /* opaque */ }
        const action = params.action || new URL(url).searchParams.get('action') || '(unknown)';
        const cls = params.class || null;
        let payload;
        try { payload = await response.json(); } catch { payload = undefined; }
        const entry = record(action, cls, shapeOf(params), payload === undefined ? 'unparsed' : shapeOf(payload), url);
        const size = (await response.body().catch(() => Buffer.alloc(0))).length;
        console.log(`  ${String(entry.calls).padStart(3)}x  ${(cls ? cls + '.' : '') + action}`.padEnd(48)
            + `${response.status()}  ${size} B`);
    };

    for (const p of pages) p.on('response', onResponse);
    // Pages opened while recording count too -- that is how a battle page arrives.
    for (const ctx of browser.contexts()) ctx.on('page', (p) => p.on('response', onResponse));

    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        const entries = [...byAction.values()].sort((a, b) => b.calls - a.calls);
        console.log('');
        if (!entries.length) {
            console.log('Nothing observed. Was any game traffic made while this ran?');
        } else {
            write('observed-actions.json', {
                recordedAt: new Date().toISOString(),
                note: 'Shapes only: keys and types, never values. Nothing here carries account data.',
                actions: entries,
            });
            const md = ['# Observed AJAX traffic', '', `Recorded ${new Date().toISOString()}. Shapes only -- keys and types, no values.`, ''];
            for (const e of entries) {
                md.push(`## ${(e.class ? e.class + '.' : '') + e.action}`, '', `${e.calls} call(s)`, '', '**Request**', '', '```',
                    ...shapeLines(e.request), '```', '', '**Response**', '', '```', ...shapeLines(e.response), '```', '');
            }
            write('observed-actions.md', md.join('\n'));
            console.log(`  ${entries.length} distinct action(s) observed`);
        }
        // Detach before exiting: leaving the CDP socket open makes the
        // browser hold a listener that never fires again.
        close().catch(() => {});
        process.exit(0);
    };
    process.on('SIGINT', finish);
    process.on('SIGTERM', finish);
    if (seconds) setTimeout(finish, seconds * 1000);
    await new Promise(() => {});
}

// ================================================================== snapshot

/**
 * Reads the page's own globals, in the page.
 *
 * The baseline comes from a same-origin blank iframe rather than a separate
 * tab: `about:blank` in its own tab is an opaque origin and is missing APIs a
 * real page has, so subtracting it leaves 200 entries of browser inventory
 * behind. An iframe of the same origin has exactly the same feature set and
 * none of the game's script, which makes the subtraction exact.
 */
const WALK = () => {
    const BUILTINS = new Set(Object.getOwnPropertyNames(Object.getPrototypeOf(window)));
    let baselineFrom = 'prototype only';
    try {
        const probe = document.createElement('iframe');
        probe.style.display = 'none';
        probe.src = 'about:blank';
        document.documentElement.appendChild(probe);
        const w = probe.contentWindow;
        if (w) {
            for (const k of Object.getOwnPropertyNames(w)) BUILTINS.add(k);
            baselineFrom = 'same-origin blank iframe';
        }
        probe.remove();
    } catch (e) { /* cross-origin or no DOM: fall back to the prototype set */ }

    // Circularity is a property of a path, not of the whole traversal: the
    // same object legitimately appears under two different keys.
    const describe = (v, depth, ancestors) => {
        if (v === null) return 'null';
        const t = typeof v;
        if (t === 'function') return 'function/' + (v.name || 'anonymous') + '(' + v.length + ')';
        if (t !== 'object') return t;
        if (ancestors.indexOf(v) !== -1) return '[circular]';
        const next = ancestors.concat([v]);
        if (Array.isArray(v)) return depth <= 0 ? 'array[' + v.length + ']'
            : { '[]': v.length, sample: v.length ? describe(v[0], depth - 1, next) : null };
        if (depth <= 0) return '{' + Object.keys(v).slice(0, 12).join(',') + '}';
        const out = {};
        for (const k of Object.keys(v).slice(0, 80)) {
            try { out[k] = describe(v[k], depth - 1, next); } catch (e) { out[k] = '[throws]'; }
        }
        return out;
    };

    const globals = {};
    for (const k of Object.getOwnPropertyNames(window)) {
        if (BUILTINS.has(k)) continue;
        try {
            const v = window[k];
            if (v === undefined) continue;
            globals[k] = describe(v, 1, []);
        } catch (e) { globals[k] = '[throws]'; }
    }
    return {
        url: location.href,
        baselineFrom: baselineFrom,
        baselineSubtracted: BUILTINS.size,
        page: document.body ? document.body.getAttribute('page') : null,
        rootId: document.body && document.body.firstElementChild ? document.body.firstElementChild.id : null,
        shared: window.shared ? describe(window.shared, 3, []) : null,
        globals: globals,
    };
};

async function cmdSnapshot(port) {
    const { browser, close } = await attach(port);
    const { pages, matched } = gamePages(browser);
    if (!pages.length) { console.error('No open page to snapshot.'); process.exit(1); }
    if (!matched) console.log('No game page found -- snapshotting what is open.');

    const out = [];
    for (const page of pages) {
        const s = await sessionState(page);
        const data = await page.evaluate(WALK).catch((e) => ({ error: String(e).split('\n')[0] }));
        out.push({ session: s, ...data });
        console.log(`  ${data.url || page.url()}`);
        console.log(`     page=${data.page ?? '?'}  globals=${data.globals ? Object.keys(data.globals).length : 0}`
            + `  hero=${s.heroId ?? 'none'}${s.loginAnchors > 0 ? '  LOGIN ANCHOR PRESENT -- placeholder state' : ''}`);
    }
    write(`snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, {
        takenAt: new Date().toISOString(), pages: out,
    });
    await close();
}

// =================================================================== browser

async function cmdBrowser(port, headless) {
    let found;
    try { found = findChromium(); }
    catch (e) { console.error(String(e.message)); process.exit(2); }

    const profile = process.env.HHAUTO_CATALOGUE_PROFILE || join(homedir(), '.config', 'hhauto-catalogue');
    const args = [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profile}`,
        '--no-first-run',
        '--no-default-browser-check',
        ...(headless ? ['--headless=new'] : []),
    ];
    console.log(`launching ${found.path}`);
    console.log(`  (${found.source})`);
    console.log(`  profile: ${profile}`);
    console.log(`  debugging port: ${port}`);

    const child = spawn(found.path, args, { detached: true, stdio: 'ignore' });
    child.unref();

    // Confirm the port answers rather than claiming success on a spawn.
    const endpoint = `http://127.0.0.1:${port}/json/version`;
    for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 500));
        try {
            const res = await fetch(endpoint);
            if (res.ok) {
                const v = await res.json();
                console.log('');
                console.log(`  up: ${v.Browser}`);
                console.log('');
                console.log('Log into the game in that window, then in another terminal:');
                console.log(`  node scripts/catalogue/run.mjs observe --seconds=600`);
                console.log(`  node scripts/catalogue/run.mjs snapshot`);
                return;
            }
        } catch { /* not up yet */ }
    }
    console.error('');
    console.error(`The browser started but ${endpoint} never answered.`);
    console.error('If a browser with this profile was already running, it took the launch over');
    console.error('without opening the port. Close it and try again.');
    process.exit(2);
}

// ====================================================================== main

const [cmd, ...rest] = process.argv.slice(2);
const portArg = rest.find((a) => /^--port=/.test(a));
const port = portArg ? Number(portArg.split('=')[1]) : DEFAULT_PORT;

const secondsArg = rest.find((a) => /^--seconds=/.test(a));
const seconds = secondsArg ? Number(secondsArg.split('=')[1]) : 0;

const headless = rest.includes('--headless');

const commands = {
    bundle: () => cmdBundle(),
    browser: () => cmdBrowser(port, headless),
    observe: () => cmdObserve(port, seconds),
    snapshot: () => cmdSnapshot(port),
};

if (!commands[cmd]) {
    console.log('usage: node scripts/catalogue/run.mjs <bundle|browser|observe|snapshot> [--port=9222]');
    console.log('');
    console.log('  bundle    read the game\'s own source: action names, shared.* API, hh_* globals');
    console.log('            needs no login and touches nothing');
    console.log('  browser   start a Chromium with the debugging port open, so observe and');
    console.log('            snapshot have something to attach to');
    console.log('  observe   attach to your browser and record ajax traffic as shapes while you play');
    console.log('            --seconds=N records for a fixed time instead of until Ctrl-C');
    console.log('  snapshot  attach and dump the globals of the page you are on');
    process.exit(cmd ? 1 : 0);
}
await commands[cmd]();
