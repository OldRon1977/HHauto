/**
 * Shared context for AutoLoop action handlers.
 * Passed through all handlers so they can read/modify the loop state.
 */
export interface AutoLoopContext {
    /** Whether the loop is currently busy (an action has been started) */
    busy: boolean;
    /** The last action that was performed in this loop iteration */
    lastActionPerformed: string;
    /** The event ID that was parsed in this iteration (if any) */
    eventParsed: string | null;
    /** Current troll fight energy */
    currentPower: number;
    /** Whether competition collection is currently allowed */
    canCollectCompetitionActive: boolean;
    /** Detected event IDs on the page */
    eventIDs: string[];
    /** Detected boss bang event IDs on the page */
    bossBangEventIDs: string[];
    /** The current page the user is on */
    currentPage: string;
}
