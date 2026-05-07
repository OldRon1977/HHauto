// AutoLoop.pure.ts -- Pure decision logic for the auto-loop scheduler.
//
// Two helpers:
//   - decideBurst: replicates the storage/DOM-reading guard at the top
//     of getBurst(). The DOM reads (sMenu visibility, nav content
//     visibility) stay in the adapter; this function takes booleans.
//   - shouldRunStandardHandler: replicates the pre-condition cascade
//     at the top of runStandardHandler. The actual handler invocation
//     and ctx mutation stay impure.
//
// Both are extracted byte-for-byte. Refactor, not a behaviour change.

export type BurstState = {
    /** sMenu element exists AND is visible (display !== "none"). */
    sMenuVisible: boolean;
    /** #contains_all>nav>[rel=content] exists AND its first match has display === "block". */
    navContentBlock: boolean;
    /** Setting_master === "true". */
    master: boolean;
    /** Setting_paranoia === "true". */
    paranoia: boolean;
    /** Temp_burst === "true". */
    burst: boolean;
};

/**
 * Replicates getBurst() except the DOM reads.
 *
 * Returns false if either UI overlay is showing (sMenu or nav content),
 * otherwise:
 *     master AND (NOT paranoia OR burst)
 *
 * Bit-for-bit equivalent to the original short-circuit.
 */
export function decideBurst(state: BurstState): boolean {
    if (state.sMenuVisible) return false;
    if (state.navContentBlock) return false;
    return state.master && (!state.paranoia || state.burst);
}

/**
 * The pre-condition cascade from runStandardHandler. Returns true if
 * the handler should fire, false if any guard rejects.
 *
 * Original cascade order is preserved so logging order in the impure
 * adapter stays unchanged when this function is wired in.
 */
export type StandardHandlerGuard = {
    /** ctx.busy at the moment the handler is evaluated. */
    ctxBusy: boolean;
    /** Result of isAutoLoopActive(). */
    autoLoopActive: boolean;
    /** ctx.canCollectCompetitionActive. */
    competitionActive: boolean;
    /** ctx.lastActionPerformed. */
    lastActionPerformed: string;
    /** Descriptor.requiresAutoLoop -- undefined defaults to true. */
    requiresAutoLoop: boolean | undefined;
    /** Descriptor.requiresCompetition -- undefined defaults to false. */
    requiresCompetition: boolean | undefined;
    /** Descriptor.action. */
    handlerAction: string;
    /** Descriptor.isReady() result. */
    isReady: boolean;
};

export function shouldRunStandardHandler(g: StandardHandlerGuard): boolean {
    if (g.ctxBusy) return false;
    if (g.requiresAutoLoop !== false && !g.autoLoopActive) return false;
    if (g.requiresCompetition && !g.competitionActive) return false;
    if (g.lastActionPerformed !== "none" && g.lastActionPerformed !== g.handlerAction) return false;
    if (!g.isReady) return false;
    return true;
}
