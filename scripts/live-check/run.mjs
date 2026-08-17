#!/usr/bin/env node
// Live check: verifies the claims about the running game that jsdom cannot hold.
//
// Read-only. It navigates, counts elements and reads page globals. It does not
// click, does not submit, and does not touch HHAuto's own storage keys.
//
//   HHAUTO_PROFILE   required, path to a logged-in browser profile (never in this repo)
//   HHAUTO_CHROMIUM  optional, executablePath for the browser
//   HHAUTO_BASE_URL  optional, overrides the base url from checks.json
//   HHAUTO_HEADED    optional, set to 1 to watch it work
//
// Exit codes: 0 all clear, 1 at least one DRIFT, 2 could not measure at all.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let chromium;
try {
    ({ chromium } = require('playwright'));
} catch {
    console.error('playwright is not installed. It is deliberately not a devDependency of this');
    console.error('repo -- CI must never download a browser for it. Install it locally:');
    console.error('  npm i --no-save playwright && npx playwright install chromium');
    process.exit(2);
}

const PROFILE = process.env.HHAUTO_PROFILE;
if (!PROFILE) {
    console.error('HHAUTO_PROFILE is not set. Point it at a browser profile that is logged into');
    console.error('the game. The profile must live outside this repository.');
    process.exit(2);
}

const config = JSON.parse(readFileSync(join(HERE, 'checks.json'), 'utf8'));
const BASE = process.env.HHAUTO_BASE_URL || config.baseUrl;

const results = [];
const record = (state, id, detail) => {
    results.push({ state, id, detail });
    const pad = { OK: '  OK   ', DRIFT: '  DRIFT', SKIP: '  SKIP ', ERROR: '  ERROR' }[state];
    console.log(`${pad} ${id.padEnd(24)} ${detail}`);
};

/** Reads a dotted path off the page window, tolerating a missing segment. */
const READ_GLOBAL = `(path) => {
    const parts = path.split('.');
    let cur = window;
    for (const p of parts) {
        if (cur === null || cur === undefined) return { found: false };
        cur = cur[p];
    }
    return { found: cur !== undefined, type: typeof cur, sample: (() => {
        try { return JSON.stringify(cur)?.slice(0, 120); } catch { return '[unserialisable]'; }
    })() };
}`;

async function countAll(page, selector) {
    // No :visible here on purpose: on shop.html the tree that carries the data
    // is the hidden one, and filtering by visibility is how that was missed.
    return page.evaluate((sel) => document.querySelectorAll(sel).length, selector);
}

async function checkSession(page) {
    await page.goto(`${BASE}/home.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const state = await page.evaluate(() => ({
        heroId: window.shared?.Hero?.infos?.id ?? null,
        loginAnchors: document.querySelectorAll("a[rel='phoenix_member_login']").length,
        kobans: window.shared?.Hero?.currencies?.hard_currency ?? null,
    }));
    if (!state.heroId || state.loginAnchors > 0) {
        console.error('');
        console.error('ABORT: this session is not logged in.');
        console.error(`  shared.Hero.infos.id = ${state.heroId}, login anchors = ${state.loginAnchors}`);
        console.error('  The logged-out page serves a placeholder hero (600 kobans, full energies).');
        console.error('  Every number measured against it looks valid and is garbage.');
        console.error('  The game allows one session per account: close the game in your own browser,');
        console.error('  or run this check there instead.');
        return null;
    }
    record('OK', 'session', `logged in (id=${state.heroId}, ${state.kobans} kobans, 0 login anchors)`);
    return state;
}

async function runSelector(page, check) {
    const misses = [];
    for (const a of check.assert) {
        const n = await countAll(page, a.selector);
        const min = a.min ?? 1;
        if (n < min) misses.push(`${a.selector} -> ${n} (expected >= ${min})`);
    }
    if (misses.length) record('DRIFT', check.id, misses.join(' | '));
    else record('OK', check.id, `${check.assert.length} selectors present`);
}

async function runGlobal(page, check) {
    const misses = [];
    for (const path of check.globals) {
        const r = await page.evaluate(new Function('path', `return (${READ_GLOBAL})(path);`), path);
        if (!r.found) misses.push(`${path} missing`);
    }
    if (misses.length) record('DRIFT', check.id, misses.join(' | '));
    else record('OK', check.id, `${check.globals.length} globals present`);
}

async function runHarvest(page, check) {
    const values = await page.evaluate(
        ({ sel, attr }) => [...document.querySelectorAll(sel)].map((e) => e.getAttribute(attr)).filter(Boolean),
        { sel: check.selector, attr: check.attribute },
    );
    if (values.length === 0) {
        record('SKIP', check.id, `${check.selector} matched nothing on this page state`);
        return;
    }
    if (check.extract === 'value') {
        const allow = (check.allow || []).map((r) => new RegExp(r));
        const unknown = [...new Set(values)].filter((v) => !allow.some((r) => r.test(v)));
        if (unknown.length) record('DRIFT', check.id, `unknown values: ${unknown.join(', ')}`);
        else record('OK', check.id, `${new Set(values).size} distinct values, all known`);
        return;
    }
    if (check.extract === 'keys') {
        const missing = new Set();
        let parsed = 0;
        for (const raw of values) {
            let obj;
            try { obj = JSON.parse(raw); } catch { continue; }
            parsed += 1;
            const flat = JSON.stringify(obj);
            for (const key of check.expectKeys) {
                if (!flat.includes(`"${key}"`)) missing.add(key);
            }
        }
        if (parsed === 0) record('DRIFT', check.id, `${values.length} payloads, none parsed as JSON`);
        else if (missing.size) record('DRIFT', check.id, `missing keys: ${[...missing].join(', ')} (in ${parsed} payloads)`);
        else record('OK', check.id, `${parsed} payloads carry ${check.expectKeys.join(', ')}`);
        return;
    }
    record('ERROR', check.id, `unknown extract mode ${check.extract}`);
}

(async () => {
    const context = await chromium.launchPersistentContext(PROFILE, {
        executablePath: process.env.HHAUTO_CHROMIUM || undefined,
        headless: process.env.HHAUTO_HEADED !== '1',
        viewport: { width: 1440, height: 900 },
    });
    const page = context.pages()[0] || (await context.newPage());

    try {
        console.log(`live check against ${BASE}`);
        console.log('');
        if (!(await checkSession(page))) {
            await context.close();
            process.exit(2);
        }

        const auto = config.checks.filter((c) => c.kind !== 'manual');
        const manual = config.checks.filter((c) => c.kind === 'manual');
        let currentPage = null;

        for (const check of auto) {
            try {
                if (check.page !== currentPage) {
                    await page.goto(BASE + check.page, { waitUntil: 'domcontentloaded' });
                    await page.waitForTimeout(1500);
                    currentPage = check.page;
                }
                if (check.kind === 'selector') await runSelector(page, check);
                else if (check.kind === 'global') await runGlobal(page, check);
                else if (check.kind === 'harvest') await runHarvest(page, check);
                else record('ERROR', check.id, `unknown kind ${check.kind}`);
            } catch (e) {
                record('ERROR', check.id, String(e).split('\n')[0]);
            }
        }

        if (manual.length) {
            console.log('');
            console.log('by hand -- these need a popup, a specific girl, or a write:');
            for (const check of manual) {
                record('SKIP', check.id, check.claim);
                for (const line of check.instructions) console.log(`         ${line}`);
            }
        }

        const drift = results.filter((r) => r.state === 'DRIFT');
        const errors = results.filter((r) => r.state === 'ERROR');
        console.log('');
        console.log(`${results.filter((r) => r.state === 'OK').length} OK, ${drift.length} DRIFT, ` +
            `${errors.length} ERROR, ${results.filter((r) => r.state === 'SKIP').length} SKIP`);
        if (drift.length) {
            console.log('');
            console.log('A DRIFT is a claim the code still makes and the page no longer honours.');
            console.log('Find the call site before changing anything -- a count of 0 without a stated');
            console.log('page and sub-state is an unfinished measurement, not a finding.');
        }
        await context.close();
        process.exit(drift.length || errors.length ? 1 : 0);
    } catch (e) {
        console.error('live check failed:', e);
        await context.close();
        process.exit(2);
    }
})();
