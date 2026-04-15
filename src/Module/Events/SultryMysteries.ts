// SultryMysteries.ts -- Sultry Mysteries event: shop refresh and auto-play grid.
//
// Sultry Mysteries is a time-limited event with a grid of 30 squares hiding
// a fixed pool of rewards. Each click costs one key. The goal (for most players)
// is to maximise Sultry Coins gained per key spent; the board holds a fixed
// pool of coins (1+3+5+7+10 = 26) scattered among the 30 squares.
//
// Auto-play uses an expected-value heuristic:
//   baseline EV/tile    = 26 / 30 ≈ 0.867 coins/click on a fresh grid
//   remaining EV/tile   = sum(remaining coin rewards) / remaining tiles
// A new grid is generated when:
//   - a user-defined hard cap of opened squares is reached, or
//   - 15+ squares are opened and EV/tile drops below baseline, or
//   - 15+ squares are opened and the three top coin rewards (10, 7, 5) are
//     all already claimed (the rest of the board is no longer attractive).
//
// Depends on: EventModule.ts (event detection and routing)
// Used by: EventModule.ts (called when Sultry Mysteries event is active)
//
import { checkTimer, clearTimer, ConfigHelper, convertTimeToInt, getStoredValue, HeroHelper, randomInterval, setTimer } from "../../Helper/index";
import { logHHAuto } from "../../Utils/LogUtils";
import { HHEvent, HHEventData, HHEventList } from "../../model/index";
import { HHStoredVarPrefixKey, SK } from "../../config/index";

const SULTRY_COIN_POOL = 26;       // 1 + 3 + 5 + 7 + 10
const SULTRY_GRID_SIZE = 30;
const SULTRY_BASELINE_EV = SULTRY_COIN_POOL / SULTRY_GRID_SIZE; // ≈ 0.8667
const SULTRY_TOP_COINS = [10, 7, 5];
const SULTRY_REFRESH_MIN_SQUARES = 15; // Game minimum: "generate new grid" unlocks at 15 squares opened

export type SultryDecision =
    | { action: 'click'; squareId: number }
    | { action: 'reset' }
    | { action: 'wait'; reason: string };

export interface SultryProgression {
    key_amount?: number;
    squares_opened_list?: string[] | number[];
    grid?: Array<{ id_square: number; is_opened: boolean; reward_index: number; reward?: any }>;
    grid_refresh_squares_required?: number;
}

export class SultryMysteries {
    static isEnabled(){
        return HeroHelper.getLevel()>=ConfigHelper.getHHScriptVars("LEVEL_MIN_EVENT_SM");
    }

    static isAutoPlayEnabled(): boolean {
        return getStoredValue(HHStoredVarPrefixKey + SK.sultryMysteriesAutoPlay) === "true";
    }

    static isRefreshShopEnabled(): boolean {
        return getStoredValue(HHStoredVarPrefixKey + SK.sultryMysteriesEventRefreshShop) === "true";
    }

    static getResetAfterKeysSetting(): number {
        const raw = getStoredValue(HHStoredVarPrefixKey + SK.sultryMysteriesResetAfterKeys);
        const n = parseInt(raw as any, 10);
        if (isNaN(n) || n < 0) return 0;
        return Math.min(n, SULTRY_GRID_SIZE);
    }

    /**
     * Pure decision function. Given the current progression snapshot and the
     * user setting, return whether to click a square, reset the grid, or wait.
     */
    static decide(prog: SultryProgression, resetAfterKeys: number): SultryDecision {
        if (!prog || !Array.isArray(prog.grid) || prog.grid.length === 0) {
            return { action: 'wait', reason: 'no grid data' };
        }
        if ((prog.key_amount ?? 0) <= 0) {
            return { action: 'wait', reason: 'no keys' };
        }

        const openedSquares = prog.grid.filter(s => s.is_opened);
        const closedSquares = prog.grid.filter(s => !s.is_opened);
        const openedCount = openedSquares.length;

        if (closedSquares.length === 0) {
            // Board fully opened — regenerate if possible.
            return { action: 'reset' };
        }

        const minForReset = prog.grid_refresh_squares_required ?? SULTRY_REFRESH_MIN_SQUARES;

        // Rule A: user-forced hard cap (clamped to game minimum).
        if (resetAfterKeys > 0) {
            const effectiveCap = Math.max(resetAfterKeys, minForReset);
            if (openedCount >= effectiveCap) {
                return { action: 'reset' };
            }
        }

        if (openedCount >= minForReset) {
            const foundCoins = SultryMysteries.extractFoundCoins(openedSquares);

            // Rule C: all three top coins already claimed.
            const topAllFound = SULTRY_TOP_COINS.every(v => foundCoins.includes(v));
            if (topAllFound) {
                return { action: 'reset' };
            }

            // Rule B: remaining EV per tile below baseline.
            const foundCoinSum = foundCoins.reduce((a, b) => a + b, 0);
            const remainingCoins = SULTRY_COIN_POOL - foundCoinSum;
            const ev = remainingCoins / closedSquares.length;
            if (ev < SULTRY_BASELINE_EV) {
                return { action: 'reset' };
            }
        }

        // Otherwise: click the first still-locked square (order is not game-relevant).
        return { action: 'click', squareId: closedSquares[0].id_square };
    }

    /**
     * Extract the sultry-coin amounts from opened squares' rewards.
     * Expects the game's reward shape: reward.rewards[].type === 'sultry_coins'.
     */
    static extractFoundCoins(openedSquares: Array<{ reward?: any }>): number[] {
        const coins: number[] = [];
        for (const sq of openedSquares) {
            const rewards = sq?.reward?.rewards;
            if (!Array.isArray(rewards)) continue;
            for (const r of rewards) {
                if (r && r.type === 'sultry_coins') {
                    const v = parseInt(r.value, 10);
                    if (!isNaN(v)) coins.push(v);
                }
            }
        }
        return coins;
    }

    static parse(hhEvent: HHEvent, eventList: HHEventList, hhEventData: HHEventData) {
        const eventID = hhEvent.eventId;
        let refreshTimer = randomInterval(3600, 4000);

        let timeLeft = $('#contains_all #events .nc-panel .timer span[rel="expires"]').text();
        if (timeLeft !== undefined && timeLeft.length) {
            setTimer('eventSultryMysteryGoing', Number(convertTimeToInt(timeLeft)));
        } else setTimer('eventSultryMysteryGoing', 3600);

        eventList[eventID] = {};
        eventList[eventID]["id"] = eventID;
        eventList[eventID]["type"] = hhEvent.eventType;
        eventList[eventID]["seconds_before_end"] = new Date().getTime() + Number(convertTimeToInt(timeLeft)) * 1000;
        eventList[eventID]["next_refresh"] = new Date().getTime() + refreshTimer * 1000;
        eventList[eventID]["isCompleted"] = false;

        if (SultryMysteries.isRefreshShopEnabled() && checkTimer("eventSultryMysteryShopRefresh")) {
            logHHAuto("Refresh sultry mysteries shop content.");

            const shopButton = $('#shop_tab');
            const gridButton = $('#grid_tab');
            shopButton.trigger('click');

            setTimeout(function () { // Wait tab switch and timer init
                let shopTimeLeft = $('#contains_all #events #shop_tab_container .shop-section .shop-timer span[rel="expires"]').text();
                setTimer('eventSultryMysteryShopRefresh', Number(convertTimeToInt(shopTimeLeft)) + randomInterval(60, 180));
                eventList[eventID]["next_shop_refresh"] = new Date().getTime() + Number(shopTimeLeft) * 1000;

                setTimeout(function () {
                    gridButton.trigger('click');
                    setTimeout(() => SultryMysteries.autoPlayGrid(), randomInterval(400, 700));
                }, randomInterval(800, 1200));
            }, randomInterval(300, 500));
        } else {
            SultryMysteries.autoPlayGrid();
        }
    }

    /**
     * Execute one auto-play step on the grid: click one square, or click
     * "generate new grid", or back off until keys regenerate (via daily goals
     * or shop; there is no automatic regen).
     */
    static autoPlayGrid(): void {
        if (!SultryMysteries.isAutoPlayEnabled()) return;

        const prog = SultryMysteries.readProgression();
        if (!prog) {
            logHHAuto("SultryMysteries: no progression data, skipping auto-play.");
            return;
        }

        // Make sure the grid tab is visible — the DOM actions below only work there.
        const $gridTab = $('#grid_tab');
        if ($gridTab.length && !$gridTab.hasClass('tab-switcher-fade-in')) {
            $gridTab.trigger('click');
        }

        const decision = SultryMysteries.decide(prog, SultryMysteries.getResetAfterKeysSetting());
        switch (decision.action) {
            case 'click':
                clearTimer('eventSultryMysteryNoKeys');
                SultryMysteries.clickSquare(decision.squareId);
                break;
            case 'reset':
                clearTimer('eventSultryMysteryNoKeys');
                SultryMysteries.clickGenerateNewGrid();
                break;
            case 'wait':
                if (decision.reason === 'no keys') {
                    logHHAuto("SultryMysteries: no keys available, cooling down for ~1h.");
                    setTimer('eventSultryMysteryNoKeys', randomInterval(3600, 4200));
                } else {
                    logHHAuto("SultryMysteries: auto-play wait — " + decision.reason);
                }
                break;
        }
    }

    static readProgression(): SultryProgression | null {
        const ce: any = (typeof unsafeWindow !== 'undefined' ? (unsafeWindow as any) : (window as any)).current_event;
        if (!ce || !ce.event_data || !ce.event_data.progression) return null;
        return ce.event_data.progression as SultryProgression;
    }

    static clickSquare(squareId: number): void {
        const $slot = $(`#contains_all #events .grid-slot.locked[id_square="${squareId}"]`);
        if ($slot.length === 0) {
            logHHAuto(`SultryMysteries: square #${squareId} not clickable.`);
            return;
        }
        logHHAuto(`SultryMysteries: opening square #${squareId}.`);
        $slot.trigger('click');
    }

    static clickGenerateNewGrid(): void {
        const $btn = $('#contains_all #events button.generate-new-grid');
        if ($btn.length === 0 || $btn.is(':disabled') || $btn.prop('disabled')) {
            logHHAuto("SultryMysteries: generate-new-grid button not available yet.");
            return;
        }
        logHHAuto("SultryMysteries: generating new grid.");
        $btn.trigger('click');
    }
}
