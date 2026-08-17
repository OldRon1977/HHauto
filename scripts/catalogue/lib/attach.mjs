/**
 * Attaches to a browser you are already using, over the DevTools protocol.
 *
 * This is the whole reason `observe` and `snapshot` can see states that only
 * exist while you play -- battle pages, open popups, mid-flow dialogs. A
 * second Playwright session would have to fight an actual battle to reach
 * them, and would evict your own session doing it: the game allows one per
 * account.
 *
 * Start a browser with the port open, log in, play as usual:
 *
 *   node scripts/catalogue/run.mjs browser
 *
 * Nothing here writes, clicks or navigates. It reads.
 */

import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const require = createRequire(import.meta.url);

export const DEFAULT_PORT = 9222;

export function loadPlaywright() {
    try {
        return require('playwright');
    } catch {
        console.error('playwright is not installed. It is deliberately not a devDependency:');
        console.error('CI has no account and must never download a browser for this.');
        console.error('  npm i --no-save playwright');
        process.exit(2);
    }
}

/** Connects and returns { browser, close }. Exits with a usable message on failure. */
export async function attach(port = DEFAULT_PORT) {
    const { chromium } = loadPlaywright();
    const endpoint = `http://127.0.0.1:${port}`;
    try {
        const browser = await chromium.connectOverCDP(endpoint);
        return { browser, close: () => browser.close() };
    } catch (e) {
        console.error(`Could not attach to a browser on ${endpoint}.`);
        console.error('');
        console.error('Start one with the debugging port open, then log in:');
        console.error(`  node scripts/catalogue/run.mjs browser${port === DEFAULT_PORT ? '' : ' --port=' + port}`);
        console.error('');
        console.error('An already-running browser will not pick the flag up -- it has to be');
        console.error('started with it. That command uses its own profile, so nothing you');
        console.error('have open is disturbed.');
        console.error('');
        console.error(String(e).split('\n')[0]);
        process.exit(2);
    }
}

/** Every open page across all contexts, newest last. */
export function allPages(browser) {
    return browser.contexts().flatMap((c) => c.pages());
}

/**
 * The pages that are actually the game.
 *
 * Falls back to every page when nothing matches, so the tools stay usable
 * against a stand-in during development -- but says which case it took, so a
 * run against the wrong tab is visible rather than silent.
 */
export function gamePages(browser, hostPattern = /haremheroes|hentaiheroes|comixharem|gayharem|pornstarharem|mangarpg|amouragent|hornyheroes/i) {
    const pages = allPages(browser);
    const game = pages.filter((p) => hostPattern.test(p.url()));
    return { pages: game.length ? game : pages, matched: game.length > 0, total: pages.length };
}

/** The logged-in guard from live-verification-lessons.md, as a function. */
export async function sessionState(page) {
    return page.evaluate(() => ({
        heroId: window.shared?.Hero?.infos?.id ?? null,
        loginAnchors: document.querySelectorAll("a[rel='phoenix_member_login']").length,
    })).catch(() => ({ heroId: null, loginAnchors: -1 }));
}

/**
 * Finds a Chromium-based browser that can speak the DevTools protocol.
 *
 * Firefox cannot: Playwright's CDP connection is Chromium-only. On a machine
 * with only Firefox installed the browser Playwright ships is the answer, and
 * it is a normal Chromium build -- it takes the same flags.
 */
export function findChromium() {
    const env = process.env.HHAUTO_CHROMIUM;
    if (env) {
        if (!existsSync(env)) throw new Error(`HHAUTO_CHROMIUM points at ${env}, which does not exist`);
        return { path: env, source: 'HHAUTO_CHROMIUM' };
    }
    try {
        const { chromium } = loadPlaywright();
        const p = chromium.executablePath();
        if (p && existsSync(p)) return { path: p, source: "playwright's bundled chromium" };
    } catch { /* fall through */ }
    // executablePath() names the revision this playwright version wants, which
    // is not always the one that got installed -- 1.62.1 asks for chromium-1234
    // on a machine carrying chromium-1208. Any of them speaks CDP, so take what
    // is actually on disk.
    try {
        const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), '.cache', 'ms-playwright');
        const dirs = readdirSync(cache)
            .filter((d) => /^chromium-\d+$/.test(d))
            .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
        for (const d of dirs) {
            const p = join(cache, d, 'chrome-linux64', 'chrome');
            if (existsSync(p)) return { path: p, source: `playwright cache (${d})` };
        }
    } catch { /* no cache directory */ }
    const candidates = [
        '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable', '/usr/bin/brave-browser', '/usr/bin/microsoft-edge',
        '/opt/google/chrome/chrome',
    ];
    for (const c of candidates) if (existsSync(c)) return { path: c, source: 'system' };
    throw new Error('No Chromium-based browser found. Install one, or set HHAUTO_CHROMIUM to its path.\n'
        + 'Playwright ships one: npm i --no-save playwright && npx playwright install chromium');
}
