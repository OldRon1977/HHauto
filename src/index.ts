import { hardened_start } from "./Service/index";
import { HHEventData, KKDailyGoal, KKHaremGirl, KKHero, KKLoveRaid, KKPentaDrillOpponents, KKTeamGirl } from "./model/index";

declare global {
    var love_raids: KKLoveRaid[] | undefined;
    interface Window {
        // Below just informs IDE and/or TS-compiler (it's set in `.js` file).
        championData: Record<string, unknown>;
        contests_timer: {
            duration: number;
            next_contest: number;
            remaining_time: number;
        };
        Collect: Record<string, unknown>;
        current_tier_number: number | undefined;
        daily_goals_list: KKDailyGoal[];
        event_data: HHEventData;
        current_event: HHEventData;
        girl: KKHaremGirl;
        // GirlSalaryManager: any;
        harem: Record<string, unknown>;
        has_contests_datas: boolean;
        hero_data: any; // complex structure used by BDSMHelper
        shared: {
            GirlSalaryManager: Record<string, unknown>;
            Hero: KKHero;
            animations: any; // deep optional chaining with .loadingAnimation.start/stop
            general: {
                is_cheat_click: boolean;
                hh_ajax: (...args: unknown[]) => unknown;
            };
        };
        // Hero: any;
        // hh_ajax: any;
        hh_nutaku: Record<string, unknown>;
        hh_prices: Record<string, number>;
        HHTimers: Record<string, unknown>;
        is_cheat_click: boolean;
        league_tag: string;
        // loadingAnimation: any;
        opponents: any; // array-like with .player objects, used by Season
        player_gems_amount: Record<string, { amount: number; [key: string]: unknown }>;
        season_sec_untill_event_end: number;
        seasonal_event_active: boolean;
        seasonal_time_remaining: number;
        mega_event_data: Record<string, unknown>;
        penta_drill_data: { cycle_data?: { seconds_until_event_end: number; [key: string]: unknown }; [key: string]: unknown };
        opponents_list: KKPentaDrillOpponents[] | undefined;
        mega_event_active: boolean;
        mega_event_time_remaining: number;
        server_now_ts: number;
        id_girl: number | string;
        girl_squad: Array<{ remaining_ego_percent: number; [key: string]: unknown }>;
        teams_data: Record<string, { girls_ids: number[]; girls: KKTeamGirl[]; [key: string]: unknown }>;
        //pop
        pop_list:boolean;
        pop_index:number;
        love_raids:KKLoveRaid[]|undefined;
    }
}

setTimeout(hardened_start,5000);

(function () {
    hardened_start();
})();
