// WindowHelper.ts
//
// Provides a safe accessor for the correct global window object.
// In Tampermonkey/Greasemonkey, `unsafeWindow` gives access to the
// page's actual window (with game globals), while `window` is the
// sandboxed userscript scope. This helper returns whichever is
// available, so callers don't need to check the environment.
//
// Used by: Modules that need direct access to game globals.

export class WindowHelper {
    /** Returns `unsafeWindow` (page scope) if available, otherwise `window`. */
    static getWindow() {
        return (typeof unsafeWindow == 'undefined') ?  window : unsafeWindow;
    }
}