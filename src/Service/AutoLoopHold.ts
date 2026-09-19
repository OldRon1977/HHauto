// AutoLoopHold.ts -- Keep the auto-loop's actions out of a long calculation.
//
// Setting `Temp_autoLoop` to "false" stops the loop from scheduling its next
// tick, and nothing more: autoLoop() reads the flag only at its end. The tick
// that was already scheduled when a player clicked, and every tick a module
// starts through kickAutoLoop, still runs the action pipeline -- and an
// action that navigates takes a running team calculation with it. Players
// reported exactly that: the team selection interrupted again and again, the
// last time shortly before it finished.
//
// A holder takes the hold for the length of its work; while it is held,
// autoLoop() skips the action pipeline and the paranoia switch. It lives in
// memory only, so a reload -- the page is gone anyway -- ends it.
//
// This file imports nothing, for the reason AutoLoopKick.ts gives: a leaf
// cannot join an import cycle.
//
// Used by: AutoLoop.ts (reads it), TeamSelectionPopup.ts (holds it)

let holder: string | null = null;

/** Take the hold. */
export function holdAutoLoop(name: string): void {
    holder = name;
}

/** Give the hold back. */
export function releaseAutoLoopHold(): void {
    holder = null;
}

/** Who holds the loop's actions, or null. */
export function autoLoopHolder(): string | null {
    return holder;
}
