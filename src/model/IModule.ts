/**
 * ModuleHandlerDescriptor -- the uniform shape a simple module is registered
 * with, read by `fromDescriptor` in Service/Pipeline.config.ts.
 *
 * The file used to open with two interfaces describing the static side of
 * module classes, IModuleStatic and IRunnableModuleStatic, and a promise of
 * "type-check helpers at the bottom" that were never written. Neither
 * interface was exported or referenced anywhere, so nothing was ever checked
 * against them.
 */

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
