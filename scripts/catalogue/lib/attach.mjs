/**
 * Attaches to a browser you are already using, over the DevTools protocol.
 *
 * This is the whole reason `observe` and `snapshot` can see states that only
 * exist while you play -- battle pages, open popups, mid-flow dialogs. A
 * second Playwright session would have to fight an actual battle to reach
 * them, and would evict your own session doing it: the game allows one per
 * account.
 *
 * Start your browser with the port open, log in, play as usual:
 *
 *   chromium --remote-debugging-port=9222
 *
 * Nothing here writes, clicks or navigates. It reads.
 */

import { createRequire } from 'node:module';

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
        console.error('Start the browser with the debugging port open, then log in:');
        console.error(`  chromium --remote-debugging-port=${port}`);
        console.error('');
        console.error('An already-running Chrome will not pick the flag up -- it has to be');
        console.error('started with it. Use a separate profile if you do not want to close');
        console.error('the one you have open:');
        console.error(`  chromium --remote-debugging-port=${port} --user-data-dir=$HOME/.config/hhauto-catalogue`);
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
