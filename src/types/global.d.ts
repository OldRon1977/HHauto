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
interface Window {
    Hero?: any;
    shared?: HHSharedObject;
    hh_ajax?: (...args: any[]) => any;
    hh_nutaku?: any;
    hh_prices?: Record<string, number>;
    server_now_ts?: number;
    current_tier_number?: number;
    has_contests_datas?: any;
    contests_timer?: {
        next_contest: number;
        duration: number;
        remaining_time: number;
        [key: string]: any;
    };
    daily_goals_list?: any[];
    seasonal_event_active?: boolean;
    seasonal_time_remaining?: number;
    mega_event_active?: boolean;
    mega_event_time_remaining?: number;
    season_sec_untill_event_end?: number;
    hero_data?: any;
    opponents?: any;
    opponents_list?: any[];
    event_data?: any;
    current_event?: any;
    teams_data?: any;
    girl_squad?: any[];
    girl?: any;
    id_girl?: any;
    player_gems_amount?: Record<string, { amount: number; [key: string]: any }>;
    pop_list?: any;
    pop_index?: any;
    penta_drill_data?: any;

    [key: string]: any;
}
