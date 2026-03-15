// index.ts - HHAuto entry point
//
// This is the Tampermonkey userscript entry point. It augments the
// global Window interface with game-specific properties that the script
// reads from the page context (via unsafeWindow), then kicks off
// initialization in two ways:
//
//   1. An IIFE that calls hardened_start() immediately on script load
//   2. A setTimeout fallback that retries after 5 seconds in case the
//      game's JS hasn't finished loading yet
//
// hardened_start() verifies jQuery is available, checks for "Forbidden"
// error pages, and delegates to start() which sets up the full menu,
// timers, and auto-loop.

import { hardened_start } from "./Service/index";
import { KKDailyGoal, KKHero, KKLoveRaid, KKPentaDrillOpponents } from "./model/index";

declare global {
    var love_raids: KKLoveRaid[] | undefined;
    interface Window {
        // Below just informs IDE and/or TS-compiler (it's set in `.js` file).
        championData: any;
        contests_timer?: {
            next_contest: number;
            duration: number;
            remaining_time: number;
            [key: string]: any;
        };
        Collect: any;
        current_tier_number?: number;
        daily_goals_list?: KKDailyGoal[];
        event_data?: any;
        current_event?: any;
        girl?: any;
        // GirlSalaryManager: any;
        harem: any;
        has_contests_datas?: any;
        hero_data?: any;
        shared?: {
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
        // Hero: any;
        // hh_ajax: any;
        hh_nutaku?: any;
        hh_prices?: any;
        HHTimers: any;
        is_cheat_click: any;
        league_tag: any;
        // loadingAnimation: any;
        opponents: any;
        player_gems_amount: any;
        season_sec_untill_event_end: any;
        seasonal_event_active: any;
        seasonal_time_remaining: any;
        mega_event_data: any;
        penta_drill_data: any;
        opponents_list: KKPentaDrillOpponents[] | undefined;
        mega_event_active: any;
        mega_event_time_remaining: any;
        server_now_ts?: any;
        id_girl?: any;
        girl_squad?: any;
        teams_data?: any;
        //pop
        pop_list?:boolean;
        pop_index?:number;
        love_raids:KKLoveRaid[]|undefined;
    }
}

setTimeout(hardened_start,5000);

(function () {
    hardened_start();
})();