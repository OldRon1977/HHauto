// TeamGear.ts -- "Best gear" and "Possibly best gear" on the edit-team
// page: read the girl inventory, plan who wears what (TeamGearService), show
// the plan, and put it on when the player presses Equip.
//
// Where the data comes from (measured on a live account): the hexagon girls
// and what they wear from availableGirls, which TeamModule hands in; the
// inventory from girl_equipment_list, one slot at a time and paged
// ({items, items_count}). The list does not depend on id_girl -- two girls
// got the same items in the same order -- so it is read once per slot.
//
// Equipping is girl_equipment_equip, one call per changed slot, in plan
// order. Every call hands out new ids: the item put on gets a new
// id_girl_armor_equipped, the one taken off a new id_girl_armor (measured).
// An item one girl trades in and a later girl gets is therefore put on with
// the id from the answer to the trade, not the one it had in the plan. After
// the run the page reloads, so the hexagons -- and Level-up gear, which reads
// the worn ids from them -- see the new state.
//
// Used by: Module/TeamModule.ts

import { getStoredValue, setStoredValue } from '../Helper/StorageHelper';
import { getTextForUI } from '../Helper/LanguageHelper';
import { TimeHelper, randomInterval } from '../Helper/TimeHelper';
import { holdAutoLoop, releaseAutoLoopHold } from '../Service/AutoLoopHold';
import { kickAutoLoop } from '../Service/AutoLoopKick';
import { safeReload } from '../Service/PageNavigationService';
import {
    GIRL_GEAR_SLOTS,
    GirlGearItem,
    GirlPlan,
    SlotPlan,
    TeamGearGirl,
    TeamGearMode,
    countChanges,
    planTeamGear,
} from '../Service/TeamGearService';
import { fillHHPopUp } from '../Utils/HHPopup';
import { logHHAuto } from '../Utils/LogUtils';
import { getHHAjax } from '../Utils/Utils';
import { HHStoredVarPrefixKey } from '../config/HHStoredVars';
import { TK } from '../config/StorageKeys';

/** Pages per slot before giving up. A cap this side of infinity keeps a
 *  changed response shape from paging forever; the page size is not known
 *  (the test account's whole inventory fit on the first page). */
const MAX_PAGES_PER_SLOT = 200;

const SLOT_KEYS: Record<number, string> = {
    1: 'HHGearSlotHead', 2: 'HHGearSlotBody', 3: 'HHGearSlotLegs',
    4: 'HHGearSlotFlag', 5: 'HHGearSlotPet', 6: 'HHGearSlotWeapon',
};

interface ListAnswer {
    items?: GirlGearItem[];
    items_count?: number | string;
    success?: boolean;
}

interface EquipAnswer {
    success?: boolean;
    equipped_armor?: GirlGearItem;
    unequipped_armor?: GirlGearItem | GirlGearItem[] | null;
}

export class TeamGear {

    private static busy = false;

    /**
     * Read the inventory, plan, and show the plan with an Equip button.
     * `girls` in team order, leader first, with what they wear now.
     */
    static async preview(mode: TeamGearMode, girls: TeamGearGirl[]): Promise<void> {
        if (TeamGear.busy) return;
        const title = TeamGear.title(mode);
        if (girls.length === 0) {
            TeamGear.show(title, `<p>${TeamGear.text('HHTeamGearNoGirls')}</p>`);
            return;
        }
        TeamGear.busy = true;
        TeamGear.show(title, `<p>${TeamGear.text('HHTeamGearReading')}</p><p id="HHTeamGearStatus"></p>`);
        let inventory: GirlGearItem[] | null = null;
        try {
            inventory = await TeamGear.withLoopHeld(() => TeamGear.fetchInventory(girls[0].id_girl));
        } catch (err) {
            logHHAuto('Team gear: reading the inventory failed: ' + err);
        } finally {
            TeamGear.busy = false;
        }
        if (inventory === null) {
            TeamGear.show(title, `<p>${TeamGear.text('HHTeamGearReadFailed')}</p>`);
            return;
        }

        const plan = planTeamGear(girls, inventory, mode);
        const changes = countChanges(plan);
        logHHAuto(`Team gear [${mode}]: ${inventory.length} item(s) in the inventory, ${changes} change(s)`
            + ` for ${girls.length} girl(s).`);
        for (const g of plan) {
            for (const s of g.slots.filter(x => x.change)) {
                logHHAuto(`  ${g.position + 1}. ${g.name}, slot ${s.slot}: ${TeamGear.describe(s.current)}`
                    + ` -> ${TeamGear.describe(s.chosen)}`);
            }
        }
        TeamGear.showPlan(mode, plan, changes);
    }

    /** Every item not worn by anyone, all six slots. Null when an answer
     *  does not have the expected shape. */
    private static async fetchInventory(idGirl: number): Promise<GirlGearItem[] | null> {
        const byId = new Map<number, GirlGearItem>();
        for (const slot of GIRL_GEAR_SLOTS) {
            let got = 0;
            for (let page = 1; page <= MAX_PAGES_PER_SLOT; page++) {
                const answer = await TeamGear.call<ListAnswer>({
                    action: 'girl_equipment_list', slot_index: slot, sort_by: 'rarity',
                    sorting_order: 'desc', page, id_girl: idGirl,
                });
                if (!answer || !Array.isArray(answer.items)) {
                    logHHAuto(`Team gear: girl_equipment_list gave no item list for slot ${slot}, page ${page}.`);
                    return null;
                }
                for (const item of answer.items) byId.set(Number(item.id_girl_armor), item);
                got += answer.items.length;
                $('#HHTeamGearStatus').text(`${getTextForUI(SLOT_KEYS[slot], 'elementText')}: ${got}`);
                if (answer.items.length === 0 || got >= Number(answer.items_count || 0)) break;
                await TimeHelper.sleep(randomInterval(250, 450));
            }
        }
        return [...byId.values()];
    }

    private static showPlan(mode: TeamGearMode, plan: GirlPlan[], changes: number): void {
        const t = (key: string) => TeamGear.text(key);
        const rows = plan.map(g => {
            const head = `<tr class="tgGirl"><td colspan="5">${g.position + 1}. ${esc(g.name)}</td></tr>`;
            return head + g.slots.map(s => TeamGear.slotRow(s)).join('');
        }).join('');
        const body = changes === 0
            ? `<p>${t('HHTeamGearNoChange')}</p>`
            : `<label class="myButton" id="HHTeamGearApply" style="font-size:14px;width:100%;text-align:center;">`
                + `${t('HHTeamGearApply')} (${changes})</label>`;
        TeamGear.show(TeamGear.title(mode), `
            <p>${t(mode === 'possible' ? 'HHTeamGearIntroPossible' : 'HHTeamGearIntroBest')}</p>
            <table>
                <tr><th>${t('HHGearColSlot')}</th><th>${t('HHTeamGearColNow')}</th><th class="num">${t('HHTeamGearColScore')}</th>`
                + `<th>${t('HHTeamGearColNew')}</th><th class="num">${t('HHTeamGearColScore')}</th></tr>
                ${rows}
            </table>
            <p id="HHTeamGearStatus"></p>
            ${body}`);
        $('#HHTeamGearApply').on('click', function () {
            if (TeamGear.busy) return;
            $(this).addClass('tgDisabled');
            void TeamGear.execute(plan, changes);
        });
    }

    private static slotRow(s: SlotPlan): string {
        const t = (key: string) => TeamGear.text(key);
        const score = (sc: SlotPlan['currentScore']) => sc ? `${Math.round(sc.caracSum)} &middot; ${sc.resonanceMatches}` : '';
        const now = s.current ? esc(TeamGear.describe(s.current)) : '&ndash;';
        const next = s.change ? `<b>${esc(TeamGear.describe(s.chosen))}</b>` : '=';
        return `<tr${s.change ? ' class="tgChange"' : ''}><td>${s.slot} ${t(SLOT_KEYS[s.slot])}</td>`
            + `<td>${now}</td><td class="num">${score(s.currentScore)}</td>`
            + `<td>${next}</td><td class="num">${s.change ? score(s.chosenScore) : ''}</td></tr>`;
    }

    /**
     * Put the plan on, one call per changed slot, in plan order -- the order
     * the trades in the plan depend on. Stops at the first call the game
     * refuses; what was put on until then stays on.
     */
    private static async execute(plan: GirlPlan[], changes: number): Promise<void> {
        if (!getHHAjax()) {
            $('#HHTeamGearStatus').text(getTextForUI('HHGearAjaxMissing', 'elementText'));
            return;
        }
        TeamGear.busy = true;
        let done = 0;
        let stopped: string | null = null;
        try {
            await TeamGear.withLoopHeld(async () => {
                // Inventory id of what each girl traded in, by girl and slot.
                const traded = new Map<string, number>();
                for (const g of plan) {
                    for (const s of g.slots) {
                        if (!s.change || !s.source) continue;
                        const id = s.source.kind === 'inventory' ? s.source.id
                            : traded.get(`${s.source.fromGirl}:${s.source.slot}`);
                        if (id === undefined || !Number.isFinite(id)) {
                            stopped = `${g.name}, slot ${s.slot}: the item traded in earlier has no inventory id`;
                            return;
                        }
                        $('#HHTeamGearStatus').text(`${done + 1}/${changes}: ${g.name}, ${getTextForUI(SLOT_KEYS[s.slot], 'elementText')}`);
                        const answer = await TeamGear.call<EquipAnswer>({
                            action: 'girl_equipment_equip', id_girl: g.id_girl, id_girl_armor: id,
                            sort_by: 'rarity', sorting_order: 'desc',
                        });
                        if (!answer || answer.success === false || !answer.equipped_armor) {
                            stopped = `${g.name}, slot ${s.slot}: the game refused the item`;
                            return;
                        }
                        const off = Array.isArray(answer.unequipped_armor) ? answer.unequipped_armor[0] : answer.unequipped_armor;
                        if (off && off.id_girl_armor !== undefined) traded.set(`${g.id_girl}:${s.slot}`, Number(off.id_girl_armor));
                        done++;
                        logHHAuto(`Team gear: ${g.name}, slot ${s.slot} now wears ${TeamGear.describe(s.chosen)}.`);
                        if (done < changes) await TimeHelper.sleep(randomInterval(500, 900));
                    }
                }
            });
        } catch (err) {
            stopped = String(err);
        } finally {
            TeamGear.busy = false;
        }
        if (stopped !== null) {
            logHHAuto(`Team gear: stopped after ${done} of ${changes} change(s) -- ${stopped}.`);
            $('#HHTeamGearStatus').text(`${getTextForUI('HHTeamGearStopped', 'elementText')} ${done}/${changes}`);
            return;
        }
        logHHAuto(`Team gear: ${done} change(s) put on; reloading.`);
        $('#HHTeamGearStatus').text(`${getTextForUI('HHTeamGearDone', 'elementText')} ${done}/${changes}`);
        safeReload(randomInterval(1200, 1800));
    }

    /**
     * Run `work` with the auto-loop kept out, as the team selection does: the
     * flag stops new ticks, the hold keeps a tick that runs anyway from
     * navigating away in the middle.
     */
    private static async withLoopHeld<T>(work: () => Promise<T>): Promise<T> {
        const loopWasOn = getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) === 'true';
        if (loopWasOn) setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, 'false');
        holdAutoLoop('team gear');
        try {
            return await work();
        } finally {
            releaseAutoLoopHold();
            if (loopWasOn) {
                setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, 'true');
                kickAutoLoop(Number(getStoredValue(HHStoredVarPrefixKey + TK.autoLoopTimeMili)) || 1000);
            }
        }
    }

    /** One game call as a promise; null on an error or after 20 s. */
    private static call<T>(params: Record<string, unknown>): Promise<T | null> {
        const ajax = getHHAjax();
        if (!ajax) return Promise.resolve(null);
        return new Promise(resolve => {
            let settled = false;
            const settle = (value: T | null) => { if (!settled) { settled = true; resolve(value); } };
            try {
                ajax(params, (data: T) => settle(data), () => settle(null));
            } catch {
                settle(null);
            }
            setTimeout(() => settle(null), 20_000);
        });
    }

    private static describe(item: GirlGearItem | null): string {
        if (!item) return '-';
        return `${item.rarity} L${item.level} ${item.skin?.name ?? ''}`.trim();
    }

    private static title(mode: TeamGearMode): string {
        return getTextForUI(mode === 'possible' ? 'HHTeamGearPossible' : 'HHTeamGearBest', 'elementText');
    }

    private static text(key: string): string {
        return esc(getTextForUI(key, 'elementText'));
    }

    private static stylesAdded = false;

    private static show(title: string, html: string): void {
        if (!TeamGear.stylesAdded) {
            TeamGear.stylesAdded = true;
            // The popup sits on white, so everything in here is dark on light.
            GM_addStyle('#HHTeamGear{color:#000;padding:10px;max-width:900px;font-size:13px;}'
                + '#HHTeamGear table{width:100%;border-collapse:collapse;font-size:12px;}'
                + '#HHTeamGear th,#HHTeamGear td{padding:2px 6px;text-align:left;color:#000;'
                + 'border-bottom:1px solid rgba(0,0,0,0.15);}'
                + '#HHTeamGear td.num,#HHTeamGear th.num{text-align:right;font-variant-numeric:tabular-nums;}'
                + '#HHTeamGear tr.tgGirl td{font-weight:bold;background:rgba(0,0,0,0.06);}'
                + '#HHTeamGear tr.tgChange td{background:rgba(27,110,42,0.08);}'
                + '#HHTeamGear .tgDisabled{opacity:0.45;pointer-events:none;}');
        }
        fillHHPopUp('HHTeamGearPopup', title, `<div id="HHTeamGear">${html}</div>`);
    }
}

function esc(value: string): string {
    return String(value).replace(/[&<>"]/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
