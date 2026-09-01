// HeroBootRecovery.ts
//
// Self-heal for the boot path when a game page loads but never
// populates the game data object (window.shared.Hero). When a target page
// fails to build its game data, start() exhausts its Hero retry loop; without
// this recovery the script only logs "give up, reload manually" and the
// automation stays frozen until the user reloads by hand (#1788).
//
// This module holds the pure decision + counter math so it can be
// unit-tested in isolation. The side effects (reading the counter from
// sessionStorage, calling safeReload) stay in StartService.
//
// The counter lives in sessionStorage so it survives location.reload()
// but resets when the tab is closed. It is also cleared the moment a
// boot succeeds (Hero found), so a single slow load does not eat into
// the reload budget of a later, unrelated slow load.
//
// NOTE: the sessionStorage key is built at call time in StartService,
// never at module top level, to keep this module free of the
// HHStoredVars TDZ/import-cycle hazard (lesson zirkulaerer-import-tdz-crash)
// and the top-level-storage-key CI gate.

// How many automatic reloads to attempt before giving up for real and
// asking the user to reload manually. Each reload costs one full Hero
// retry window (~75s) before it fires, so a small cap keeps the total
// self-heal time bounded to a few minutes.
export const HERO_GIVEUP_MAX_RELOADS = 3;

/**
 * Sanitise a raw stored reload count into a non-negative integer.
 * Non-numeric / negative / fractional inputs collapse to 0.
 */
export function sanitizeHeroGiveupReloadCount(raw: number | string | null | undefined): number {
    const n = typeof raw === "string" ? parseInt(raw, 10) : raw;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
}

/**
 * Decide whether the boot path should auto-reload after the Hero retry
 * loop has been exhausted.
 *
 * @param prevReloadCount  how many auto-reloads already happened in this
 *                         tab session (>= 0 after sanitising)
 * @param max              reload budget (defaults to HERO_GIVEUP_MAX_RELOADS)
 * @returns true if another reload is within budget, false if the budget
 *          is spent and the script should give up until manual reload.
 */
export function shouldReloadAfterHeroGiveup(
    prevReloadCount: number,
    max: number = HERO_GIVEUP_MAX_RELOADS,
): boolean {
    return sanitizeHeroGiveupReloadCount(prevReloadCount) < max;
}

/**
 * Next counter value to store before triggering an auto-reload.
 */
export function nextHeroGiveupReloadCount(prevReloadCount: number | string | null | undefined): number {
    return sanitizeHeroGiveupReloadCount(prevReloadCount) + 1;
}
