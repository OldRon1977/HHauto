// AutoLoopKick.ts -- The one seam a module uses to restart the auto-loop
// after it has switched it off for an action.
//
// A module that sets `Temp_autoLoop` to "false" for the length of an action
// has to start the loop again afterwards, and the obvious way to do that --
// `import { autoLoop } from "../Service/AutoLoop"` -- is what made seven
// modules members of the baseline import cycles. Measured 2026-09-09 by
// removing exactly those seven edges and re-running madge: **84 cycles with
// them, 52 without** (ADR-008 / ARCH-001).
//
// So the reference comes from the boot path instead, the same way
// `setPachinkoAutoLoopKick` and `setHeroAutoLoopKick` already worked. Those
// two keep their own setters: they are wired and tested, and moving them here
// would not remove a single cycle.
//
// This file imports nothing on purpose. A leaf cannot join a cycle, so the
// seam can never become the problem it was written to solve -- not even for
// the storage read that supplies the delay, which is why the delay is the
// caller's to pass.
//
// Used by: Bundles.ts, League.ts, PlaceOfPower.ts, Quest.ts,
//   DoublePenetration.ts, PathOfAttraction.ts; wired in index.ts

let kick: () => void = () => {};

/** Wired once from the boot path with the real autoLoop. */
export function setAutoLoopKick(fn: () => void) {
    kick = fn;
}

/**
 * Restart the auto-loop after `delayMs`.
 *
 * The reference is read when the timer fires, not when it is scheduled, so a
 * kick scheduled before the boot path wired one still runs the real loop.
 */
export function kickAutoLoop(delayMs: number) {
    setTimeout(() => kick(), delayMs);
}
