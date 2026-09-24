// AutoLoop.pure.ts -- Pure decision logic for the auto-loop scheduler.
//
// Two helpers:
//   - decideBurst: the guard of getBurst() (AutoLoop.ts) without its DOM
//     reads (sMenu visibility, nav content visibility), which stay in the
//     adapter; this function takes booleans.
//   - shouldRunStandardHandler: the precondition of every block built by
//     fromDescriptor (Pipeline.config.ts). The handler invocation and the
//     ctx mutation stay in the step.

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
 * The decision of getBurst(), which reads the DOM and storage and hands
 * the result in here.
 *
 * Returns false if either UI overlay is showing (sMenu or nav content),
 * otherwise:
 *     master AND (NOT paranoia OR burst)
 */
export function decideBurst(state: BurstState): boolean {
    if (state.sMenuVisible) return false;
    if (state.navContentBlock) return false;
    return state.master && (!state.paranoia || state.burst);
}

/**
 * The precondition of a descriptor block: true if the handler should fire,
 * false if any guard rejects.
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
