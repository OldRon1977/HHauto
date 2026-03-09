/**
 * Type declarations for game-specific global properties
 * accessed via unsafeWindow (Tampermonkey/Greasemonkey)
 */

interface HHSharedObject {
    Hero?: any;
    general?: {
        hh_ajax?: (...args: any[]) => any;
        is_cheat_click?: (...args: any[]) => any;
        [key: string]: any;
    };
    animations?: {
        loadingAnimation?: {
            start: () => void;
            stop: () => void;
        };
        [key: string]: any;
    };
    [key: string]: any;
}

/**
 * Extend the Window interface with game-specific properties
 * so that unsafeWindow.<property> doesn't cause TS errors.
 */
// Window interface is declared in src/index.ts — do not duplicate here.
// This file only provides the HHSharedObject interface for tests.
