import { hardened_start } from "./Service/index";
import { KKDailyGoal, KKHero, KKLoveRaid, KKPentaDrillOpponents } from "./model/index";

declare global {
    var love_raids: KKLoveRaid[] | undefined;
    interface Window {
        // Below just informs IDE and/or TS-compiler (it's set in `.js` file).
        championData: any;
        contests_timer: {
            duration: any;
            next_contest: any;
            remaining_time: any;
        };
        Collect: any;
        current_tier_number: any;
        daily_goals_list: KKDailyGoal[];
        event_data: any;
        current_event: any;
        girl: any;
        // GirlSalaryManager: any;
        harem: any;
        has_contests_datas: any;
        hero_data: any;
        shared?: {
            GirlSalaryManager: any;
            Hero: KKHero;
            animations: any;
            general: {
                is_cheat_click: any;
                hh_ajax: any;
            };
        };
        Hero: any;
        hh_ajax: any;
        hh_nutaku: any;
        hh_prices: any;
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
        server_now_ts: any;
        id_girl: any;
        girl_squad: any;
        teams_data: any;
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