/**
 * Interface hierarchy for game modules.
 *
 * Since all modules use static-only classes, these interfaces describe
 * the static (constructor) side of module classes. Use the type-check
 * helpers at the bottom to verify conformance at compile time.
 */

// ---------------------------------------------------------------------------
//  Static interface types (describe the class constructor, not instances)
// ---------------------------------------------------------------------------

/** Base module – optional enable-check and run method */
interface IModuleStatic {
    isEnabled?(): boolean;
    isActivated?(): boolean;
}

/** Module with a run() entry-point */
interface IRunnableModuleStatic extends IModuleStatic {
    run(): boolean | void | Promise<boolean | void>;
}

// ---------------------------------------------------------------------------
//  AutoLoop handler descriptor – used to register simple modules
// ---------------------------------------------------------------------------

/** Describes a standard AutoLoop handler that can be executed by runStandardHandler */
export interface ModuleHandlerDescriptor {
    /** Display name for log output */
    name: string;
    /** Value for ctx.lastActionPerformed when this handler runs */
    action: string;
    /** Guard: all conditions that must be true for this handler to execute */
    isReady(): boolean;
    /** The actual module call */
    execute(): boolean | void | Promise<boolean | void>;
    /** Whether isAutoLoopActive() must be true (default: true) */
    requiresAutoLoop?: boolean;
    /** Whether canCollectCompetitionActive must be true (default: false) */
    requiresCompetition?: boolean;
}
