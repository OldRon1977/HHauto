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
// Equipping is girl_equipment_equip, one call per changed slot. Every call
// hands out new ids: the item put on gets a new id_girl_armor_equipped, the
// one taken off a new id_girl_armor (measured). An item that moves from one
// team girl to another is therefore put on with the id from the answer that
// freed it, not the one it had in the plan (see execute). After the run the
// page reloads, so the hexagons -- and Level-up gear, which reads the worn
// ids from them -- see the new state.
//
// Used by: Module/TeamModule.ts

import { getStoredValue, setStoredValue } from '../Helper/StorageHelper';
import { getTextForUI } from '../Helper/LanguageHelper';
import { TimeHelper, randomInterval } from '../Helper/TimeHelper';
import { holdAutoLoop, releaseAutoLoopHold } from '../Service/AutoLoopHold';
import { touchWorkPause } from '../Service/WorkPause';
import { kickAutoLoop } from '../Service/AutoLoopKick';
import { safeReload } from '../Service/PageNavigationService';
import {
    GIRL_GEAR_SLOTS,
    GearSource,
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
        const names = new Map(plan.map(g => [g.id_girl, `${g.position + 1}. ${g.name}`] as [number, string]));
        const rows = plan.map(g => {
            const head = `<tr class="tgGirl"><td colspan="5">${g.position + 1}. ${esc(g.name)}</td></tr>`;
            return head + g.slots.map(s => TeamGear.slotRow(s, names)).join('');
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

    private static slotRow(s: SlotPlan, names: Map<number, string>): string {
        const t = (key: string) => TeamGear.text(key);
        const score = (sc: SlotPlan['currentScore']) => sc ? `${Math.round(sc.caracSum)} &middot; ${sc.resonanceMatches}` : '';
        const now = s.current ? esc(TeamGear.describe(s.current)) : '&ndash;';
        let next = '=';
        if (s.change) {
            const from = s.source?.kind === 'worn' ? ` <span class="tgFrom">(${esc(names.get(s.source.fromGirl) ?? '')})</span>` : '';
            next = s.chosen ? `<b>${esc(TeamGear.describe(s.chosen))}</b>${from}` : '<b>&ndash;</b>';
        }
        return `<tr${s.change ? ' class="tgChange"' : ''}><td>${s.slot} ${t(SLOT_KEYS[s.slot])}</td>`
            + `<td>${now}</td><td class="num">${score(s.currentScore)}</td>`
            + `<td>${next}</td><td class="num">${s.change ? score(s.chosenScore) : ''}</td></tr>`;
    }

    /**
     * Put the plan on.
     *
     * An item from the inventory goes on at once. An item a team girl wears
     * can only go on once she has let go of it: when she puts on her own new
     * item the game hands the old one back with a new inventory id
     * (unequipped_armor), and that id is what the next girl equips. When no
     * change can go ahead -- two girls swapping, or a girl whose item goes to
     * an earlier girl while nothing is left for her -- the item is taken off
     * with girl_equipment_unequip, which also answers with its new id
     * (measured). Stops at the first call the game refuses; what was changed
     * until then stays changed.
     */
    private static async execute(plan: GirlPlan[], changes: number): Promise<void> {
        if (!getHHAjax()) {
            $('#HHTeamGearStatus').text(getTextForUI('HHGearAjaxMissing', 'elementText'));
            return;
        }
        TeamGear.busy = true;
        let equipped = 0;
        let takenOff = 0;
        let stopped: string | null = null;
        const key = (girl: number, slot: number) => `${girl}:${slot}`;
        const nameOf = new Map(plan.map(g => [g.id_girl, g.name] as [number, string]));
        const status = (text: string) => $('#HHTeamGearStatus').text(text);
        const idOf = (off: GirlGearItem | GirlGearItem[] | null | undefined) => {
            const item = Array.isArray(off) ? off[0] : off;
            return item && item.id_girl_armor !== undefined ? Number(item.id_girl_armor) : undefined;
        };
        try {
            await TeamGear.withLoopHeld(async () => {
                // What each girl still wears from before the run, and the
                // inventory id of what she has let go of.
                const stillWorn = new Map<string, number>();
                const released = new Map<string, number>();
                for (const g of plan) {
                    for (const s of g.slots) {
                        if (s.current?.id_girl_armor_equipped !== undefined) {
                            stillWorn.set(key(g.id_girl, s.slot), Number(s.current.id_girl_armor_equipped));
                        }
                    }
                }
                const pending: { g: GirlPlan; s: SlotPlan }[] = [];
                for (const g of plan) for (const s of g.slots) if (s.change && s.chosen && s.source) pending.push({ g, s });

                while (pending.length > 0) {
                    let progressed = false;
                    for (let i = 0; i < pending.length;) {
                        const { g, s } = pending[i];
                        const src = s.source!;
                        const id = src.kind === 'inventory' ? src.id : released.get(key(src.fromGirl, s.slot));
                        if (id === undefined) { i++; continue; }
                        status(`${equipped + 1}/${pending.length + equipped}: ${g.name}, ${getTextForUI(SLOT_KEYS[s.slot], 'elementText')}`);
                        const answer = await TeamGear.call<EquipAnswer>({
                            action: 'girl_equipment_equip', id_girl: g.id_girl, id_girl_armor: id,
                            sort_by: 'rarity', sorting_order: 'desc',
                        });
                        if (!answer || answer.success === false || !answer.equipped_armor) {
                            stopped = `${g.name}, slot ${s.slot}: the game refused the item`;
                            return;
                        }
                        const mine = key(g.id_girl, s.slot);
                        const offId = idOf(answer.unequipped_armor);
                        if (stillWorn.has(mine) && offId !== undefined) {
                            released.set(mine, offId);
                            stillWorn.delete(mine);
                        }
                        pending.splice(i, 1);
                        equipped++;
                        progressed = true;
                        logHHAuto(`Team gear: ${g.name}, slot ${s.slot} now wears ${TeamGear.describe(s.chosen)}.`);
                        await TimeHelper.sleep(randomInterval(500, 900));
                    }
                    if (progressed || pending.length === 0) continue;

                    // Nothing can go ahead: take off the first item a waiting
                    // girl needs.
                    const src = pending.map(p => p.s.source!).find(x => x.kind === 'worn') as Extract<GearSource, { kind: 'worn' }> | undefined;
                    const owner = src ? key(src.fromGirl, src.slot) : '';
                    const idEquipped = stillWorn.get(owner);
                    if (!src || idEquipped === undefined) {
                        stopped = 'a planned item is neither in the inventory nor still worn';
                        return;
                    }
                    const answer = await TeamGear.call<EquipAnswer>({
                        action: 'girl_equipment_unequip', id_girl_armor_equipped: idEquipped,
                        sort_by: 'rarity', sorting_order: 'desc',
                    });
                    const offId = answer && answer.success !== false ? idOf(answer.unequipped_armor) : undefined;
                    if (offId === undefined) {
                        stopped = `slot ${src.slot}: the game did not take the item off`;
                        return;
                    }
                    released.set(owner, offId);
                    stillWorn.delete(owner);
                    takenOff++;
                    logHHAuto(`Team gear: took slot ${src.slot} off ${nameOf.get(src.fromGirl) ?? src.fromGirl} to hand it on.`);
                    await TimeHelper.sleep(randomInterval(500, 900));
                }
            });
        } catch (err) {
            stopped = String(err);
        } finally {
            TeamGear.busy = false;
        }
        if (stopped !== null) {
            logHHAuto(`Team gear: stopped after ${equipped} item(s) put on, ${takenOff} taken off -- ${stopped}.`);
            status(`${getTextForUI('HHTeamGearStopped', 'elementText')} ${equipped}/${changes}`);
            return;
        }
        logHHAuto(`Team gear: ${equipped} item(s) put on, ${takenOff} taken off; reloading.`);
        status(`${getTextForUI('HHTeamGearDone', 'elementText')} ${equipped}`);
        safeReload(randomInterval(1200, 1800));
    }

    /**
     * Run `work` with the auto-loop kept out, as the team selection rubrics
     * do (TeamSelectionPopup.run): the flag stops new ticks, the hold keeps
     * a tick that runs anyway from navigating away in the middle.
     */
    private static async withLoopHeld<T>(work: () => Promise<T>): Promise<T> {
        const loopWasOn = getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) === 'true';
        if (loopWasOn) setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, 'false');
        holdAutoLoop('team gear');
        try {
            return await work();
        } finally {
            releaseAutoLoopHold();
            touchWorkPause();
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
                + '#HHTeamGear .tgFrom{color:#555;font-weight:normal;}'
                + '#HHTeamGear .tgDisabled{opacity:0.45;pointer-events:none;}');
        }
        fillHHPopUp('HHTeamGearPopup', title, `<div id="HHTeamGear">${html}</div>`);
    }
}

function esc(value: string): string {
    return String(value).replace(/[&<>"]/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
