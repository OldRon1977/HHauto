// EquipmentGear.ts -- The gear buttons on the market page: pick the best
// armor for the hero's six slots and put it on.
//
// Deliberately built like the team workflow so the player needs one mental
// model, not two:
//
//   Team page                Market page
//   2a Current Best     ->   Current Best Gear
//   2b Possible Best    ->   Possible Best Gear
//   3  Stuff Team       ->   Upgrade Gear (not implemented -- the upgrade
//                            endpoint is still unknown, see below)
//
// The ranking itself lives in Service/EquipmentOptimizerService.ts and is
// pure. This file only does the impure half: read the game's globals and
// DOM, page through the inventory, show the preview, and fire the equip
// calls.
//
// Background, data model and the measurement traps:
// docs-internal/equipment-resonance.md.
//
// Used by: Service/AutoLoopPageHandlers.ts (shop page)

import { ConfigHelper } from "../Helper/ConfigHelper";
import { HeroHelper } from "../Helper/HeroHelper";
import { getTextForUI } from "../Helper/LanguageHelper";
import { getPage } from "../Helper/PageHelper";
import { getStoredValue, getStoredJSON, setStoredValue } from "../Helper/StorageHelper";
import { randomInterval } from "../Helper/TimeHelper";
import {
    ArmorItem,
    GearPlan,
    GearTheme,
    parseArmorItem,
    parseTheme,
    planCurrentBest,
    planPossibleBest,
    themeFromTeamData,
} from "../Service/EquipmentOptimizerService";
import type { PlayerClass } from "../Service/TeamScoringService";
import { fillHHPopUp } from "../Utils/HHPopup";
import { logHHAuto } from "../Utils/LogUtils";
import { getHHAjax, safeJsonParse } from "../Utils/Utils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { TK } from "../config/StorageKeys";

/** Hard stop for the inventory walk. The test account held 1614 armors; at
 *  the page sizes the game uses that is well under 100 requests. A cap this
 *  side of infinity keeps a changed response shape from looping forever. */
const MAX_INVENTORY_PAGES = 120;

const SLOT_NAMES: Record<number, string> = {
    1: 'Head', 2: 'Body', 3: 'Legs', 4: 'Flag', 5: 'Pet', 6: 'Weapon',
};

type GearMode = 'current' | 'possible';

export class EquipmentGear {

    /** Guards against a second injection when the page handler runs again. */
    private static running = false;

    /**
     * Inject the two gear buttons next to the armor inventory, or take them
     * away again when the player is on one of the other market tabs. Called
     * from the shop page handler and re-entered on every tab switch.
     */
    static moduleGearActions(): void {
        if (getPage() !== ConfigHelper.getHHScriptVars("pagesIDShop")) return;

        EquipmentGear.watchTabSwitch();

        // The player's own inventory has its own tab strip
        // (.my-hero-switch-tab: booster / armor / player-stats), separate
        // from the merchant's five .market-menu-switch-tab tabs that Shop.ts
        // reads. The tab type is the gate.
        if ($('.my-hero-switch-tab.active[type="armor"]').length === 0) {
            $('#HHGearButtons').remove();
            return;
        }

        // Measured 2026-08-16: shop.html carries two separate equipment UIs.
        // The merchant tree (#shops .shop-container #equipement-tab-container)
        // holds `#player-inventory.armor` with every owned item -- and is not
        // rendered at all, every node in it measures 0x0. The visible one is
        // the My Hero tree, `#my-hero-equipement-tab-container`, whose
        // `.bottom-container` already hosts the game's own Level-up and Equip
        // buttons. Anchoring to the inventory container put the buttons in
        // the dead tree, where they existed but could never be clicked.
        const host = $('#my-hero-equipement-tab-container .bottom-container');
        if (host.length === 0) return;
        if (document.getElementById("HHGearCurrentBest") !== null) return;

        GM_addStyle('#HHGearButtons{display:flex;flex-direction:column;gap:4px;'
            + 'margin-left:10px;justify-content:center;}'
            + '#HHGearButtons .tooltipHH{width:100%;margin:0;padding:0;}'
            + '#HHGearButtons .myButton{display:flex;align-items:center;justify-content:center;'
            + 'box-sizing:border-box;width:150px;height:32px;margin:0;padding:2px 6px;'
            + 'font-size:11px;line-height:13px;text-align:center;overflow:hidden;}'
            + '#HHGearPreview table{width:100%;border-collapse:collapse;font-size:12px;}'
            + '#HHGearPreview th,#HHGearPreview td{padding:2px 6px;text-align:left;'
            + 'border-bottom:1px solid rgba(255,255,255,0.15);}'
            + '#HHGearPreview td.num{text-align:right;font-variant-numeric:tabular-nums;}');

        host.append('<div id="HHGearButtons">'
            + gearButton('HHGearCurrentBest')
            + gearButton('HHGearPossibleBest')
            + '</div>');

        $("#HHGearCurrentBest").on("click", () => { void EquipmentGear.preview('current'); });
        $("#HHGearPossibleBest").on("click", () => { void EquipmentGear.preview('possible'); });
    }

    private static tabWatcherBound = false;

    /** Re-run the injection after a tab switch. The market swaps tabs without
     *  a page load, and it opens on Boosters -- so a one-shot injection from
     *  the page handler would never see the armor tab at all. */
    private static watchTabSwitch(): void {
        if (EquipmentGear.tabWatcherBound) return;
        EquipmentGear.tabWatcherBound = true;
        $(document).on('click', '.my-hero-switch-tab', () => {
            setTimeout(() => EquipmentGear.moduleGearActions(), 400);
        });
    }

    // ---------------------------------------------------------------- data

    /**
     * The theme the resonance is matched against.
     *
     * Primary source is what TeamModule stored when it last fielded a team.
     * The fallback recomputes it from `teams_data`, which the market page
     * does not have -- so it usually returns null there, and null means
     * "do nothing and say so". Acting on a guessed theme would equip the
     * wrong six items.
     */
    static resolveTheme(): GearTheme | null {
        const stored = parseTheme(getStoredValue(HHStoredVarPrefixKey + TK.teamTheme));
        if (stored) return stored;
        // `teams_data` does not exist on the market page (measured), so this
        // only ever fires if the game starts shipping it there.
        return EquipmentGear.readThemeFromTeamsData();
    }

    /**
     * Theme of the team the game has selected for battle, straight out of
     * `teams_data`. Runs on the teams page, where TeamModule's own writer
     * does not: a player who never presses HHauto's team buttons still ends
     * up with a usable theme.
     */
    static recordTeamTheme(): void {
        const theme = EquipmentGear.readThemeFromTeamsData();
        if (!theme) return;
        if (parseTheme(getStoredValue(HHStoredVarPrefixKey + TK.teamTheme)) === theme) return;
        setStoredValue(HHStoredVarPrefixKey + TK.teamTheme, theme);
        logHHAuto('Gear: team theme is "' + theme + '" (from teams_data); the gear buttons will match resonance against it.');
    }

    /** Prefers the team the game marks as fielded; falls back to the first
     *  team that actually holds girls. */
    private static readThemeFromTeamsData(): GearTheme | null {
        const teams = unsafeWindow.teams_data;
        if (!teams || typeof teams !== 'object') return null;
        const entries = Object.values(teams) as any[];
        const fielded = entries.find(t => Array.isArray(t?.selected_for_battle_type)
            && t.selected_for_battle_type.length > 0);
        return themeFromTeamData(fielded)
            ?? themeFromTeamData(entries.find(t => Array.isArray(t?.girls) && t.girls.length > 0));
    }

    /** The six items the hero is wearing, read from the equipped panel.
     *  Present and complete on every market tab, so this does not depend on
     *  the armor tab being open. */
    private static readEquipped(): ArmorItem[] {
        const items: ArmorItem[] = [];
        $('#equiped .armor div[id_item]').each(function () {
            const raw = safeJsonParse<any>((this as HTMLElement).dataset.d ?? '', null);
            // true: these objects carry id_member_armor_equipped and no
            // id_member_armor at all.
            const parsed = raw ? parseArmorItem(raw, true) : null;
            if (parsed) items.push(parsed);
        });
        return items;
    }

    /**
     * Every armor in the inventory.
     *
     * The first page arrives with the document as `player_inventory.armor`;
     * the rest come from `market_get_armor`, which takes the last id seen.
     *
     * The response is `{items: [...], success: true}` with an empty `items`
     * marking the end of the list -- the same contract Shop.ts's
     * `checkAjaxComplete` already relies on. Anything else aborts loudly:
     * an optimiser that silently sees a third of the inventory would
     * quietly equip the wrong items.
     */
    private static async fetchInventory(): Promise<ArmorItem[] | null> {
        const ajax = getHHAjax();
        if (!ajax) {
            logHHAuto('Gear: shared.general.hh_ajax is missing, aborting -- nothing was changed.');
            return null;
        }

        const seen = new Set<number>();
        const items: ArmorItem[] = [];
        // Returns the last id the page carried -- including entries that
        // parseArmorItem rejects (girl equipment shares the inventory), so
        // paging keeps advancing instead of asking for the same page again.
        const collect = (list: any[]): number => {
            let lastSeenId = 0;
            for (const raw of list) {
                const id = Number(raw?.id_member_armor);
                if (Number.isFinite(id)) lastSeenId = id;
                const parsed = parseArmorItem(raw);
                if (!parsed || seen.has(parsed.id_member_armor)) continue;
                seen.add(parsed.id_member_armor);
                items.push(parsed);
            }
            return lastSeenId;
        };

        const firstPage = unsafeWindow.player_inventory?.armor;
        if (!Array.isArray(firstPage)) {
            logHHAuto('Gear: player_inventory.armor is not an array on this page, aborting.');
            return null;
        }
        let lastId = collect(firstPage);
        let pages = 0;
        while (pages < MAX_INVENTORY_PAGES) {
            pages++;
            const data: any = await new Promise(resolve => {
                ajax({ action: 'market_get_armor', id_member_armor: lastId }, resolve);
            }).catch(() => null);

            if (!data) break;
            const list: any[] | null = Array.isArray(data.items) ? data.items : null;
            if (list === null) {
                logHHAuto('Gear: unexpected market_get_armor response, aborting after '
                    + items.length + ' items. Keys: ' + Object.keys(data).join(','));
                return null;
            }
            if (list.length === 0) break;
            const nextId = collect(list);
            // The game answers the same page when the cursor stops moving;
            // without this the loop would only end at the request cap.
            if (nextId === 0 || nextId === lastId) break;
            lastId = nextId;
        }
        if (pages >= MAX_INVENTORY_PAGES) {
            logHHAuto('Gear: stopped paging the inventory at the ' + MAX_INVENTORY_PAGES
                + '-request cap; the plan below only covers ' + items.length + ' items.');
        }

        logHHAuto('Gear: read ' + items.length + ' armors from the inventory in ' + pages + ' request(s).');
        return items;
    }

    // ------------------------------------------------------------- preview

    /** Gather everything, build the plan, and show it. Nothing is changed
     *  until the player presses the button in the preview. */
    private static async preview(mode: GearMode): Promise<void> {
        if (EquipmentGear.running) return;
        EquipmentGear.running = true;
        const modeName = mode === 'current' ? 'Current Best Gear' : 'Possible Best Gear';
        try {
            const theme = EquipmentGear.resolveTheme();
            if (!theme) {
                const msg = 'No team theme available. Build a team first (Current Best / Possible Best'
                    + ' on the team page) -- picking gear on a guessed theme would equip the wrong items.';
                logHHAuto('Gear: ' + msg + ' Nothing was changed.');
                EquipmentGear.showMessage(modeName, msg);
                return;
            }

            const rawClass = Number(HeroHelper.getClass());
            if (rawClass !== 1 && rawClass !== 2 && rawClass !== 3) {
                logHHAuto('Gear: hero class is ' + rawClass + ', aborting -- nothing was changed.');
                EquipmentGear.showMessage(modeName, 'Could not read the hero class.');
                return;
            }
            const playerClass = rawClass as PlayerClass;

            EquipmentGear.showMessage(modeName, 'Reading the inventory...');
            const inventory = await EquipmentGear.fetchInventory();
            if (inventory === null) {
                EquipmentGear.showMessage(modeName,
                    'Could not read the inventory. Nothing was changed -- see the log.');
                return;
            }

            const equipped = EquipmentGear.readEquipped();
            if (equipped.length === 0) {
                // Either the hero really wears nothing, or the equipped panel
                // moved. Both end with a plan whose "costs you today" column
                // is measured against an empty slot, so say so out loud.
                logHHAuto('Gear: read 0 equipped items from #equiped .armor div[id_item].'
                    + ' The per-slot cost below is measured against an empty slot.');
            }
            const byId = new Map<number, ArmorItem>();
            for (const item of [...equipped, ...inventory]) {
                if (!byId.has(item.id_member_armor)) byId.set(item.id_member_armor, item);
            }
            const all = [...byId.values()];

            const plan = mode === 'current'
                ? planCurrentBest(all, playerClass, theme)
                : planPossibleBest(all, playerClass, theme);

            EquipmentGear.logPlan(modeName, theme, plan, mode);
            EquipmentGear.showPlan(modeName, theme, plan, mode);
        } catch (err) {
            logHHAuto('Gear: ' + modeName + ' failed before any change was made: ' + err);
            EquipmentGear.showMessage(modeName, 'Failed, nothing was changed. See the log.');
        } finally {
            EquipmentGear.running = false;
        }
    }

    /** One log line per planned swap, plus the totals. Written before the
     *  player can execute, so the log holds the plan even if the run is
     *  abandoned halfway. */
    private static logPlan(modeName: string, theme: GearTheme, plan: GearPlan, mode: GearMode): void {
        logHHAuto(`Gear [${modeName}]: theme=${theme}, ${plan.changes.length} of 6 slots would change.`);
        for (const pick of plan.picks) {
            if (!pick.chosen) {
                logHHAuto(`  Slot ${pick.slot} (${SLOT_NAMES[pick.slot]}): no item owned.`);
                continue;
            }
            if (!pick.changed) {
                logHHAuto(`  Slot ${pick.slot} (${SLOT_NAMES[pick.slot]}): keeping ${EquipmentGear.describe(pick.chosen)}.`);
                continue;
            }
            const from = pick.current ? EquipmentGear.describe(pick.current) : 'an empty slot';
            const projected = mode === 'possible'
                ? ` After the upgrade: ${fmtSigned(pick.projectedRawDelta ?? 0)} raw,`
                  + ` ${fmtSignedPct(pick.projectedResonanceDelta ?? 0)} resonance.`
                : '';
            const warn = pick.projectionUnreliable
                ? ' (projection unreliable: the item does not follow the known mythic curve)'
                : '';
            logHHAuto(`  Slot ${pick.slot} (${SLOT_NAMES[pick.slot]}): ${EquipmentGear.describe(pick.chosen)}`
                + ` replaces ${from}, ${fmtSigned(pick.rawDelta)} carac points today,`
                + ` ${fmtSignedPct(pick.resonanceDelta)} active resonance.${projected}${warn}`);
        }
        if (mode === 'possible') {
            logHHAuto(`  Total: ${fmtSigned(plan.totalRawDelta)} carac points now,`
                + ` ${fmtSigned(plan.totalProjectedRawDelta ?? 0)} and`
                + ` ${fmtSignedPct(plan.totalProjectedResonanceDelta ?? 0)} resonance once everything is at max level.`);
        } else {
            logHHAuto(`  Total: ${fmtSigned(plan.totalRawDelta)} carac points,`
                + ` ${fmtSignedPct(plan.totalResonanceDelta)} active resonance.`);
        }
    }

    private static describe(item: ArmorItem): string {
        return `${item.name} (${item.rarity} lvl${item.level}, id ${item.id_member_armor})`;
    }

    private static showMessage(title: string, message: string): void {
        fillHHPopUp('HHGearPreview', title,
            `<div id="HHGearPreview" style="padding:10px;max-width:640px;font-size:13px;">${message}</div>`);
    }

    private static showPlan(modeName: string, theme: GearTheme, plan: GearPlan, mode: GearMode): void {
        const rows = plan.picks.map(pick => {
            const slot = `${pick.slot} ${SLOT_NAMES[pick.slot]}`;
            if (!pick.chosen) {
                return `<tr><td>${slot}</td><td colspan="4" style="color:#aaa;">no item owned</td></tr>`;
            }
            if (!pick.changed) {
                return `<tr style="color:#aaa;"><td>${slot}</td>`
                    + `<td>keep ${esc(pick.chosen.name)} (${pick.chosen.rarity} lvl${pick.chosen.level})</td>`
                    + `<td class="num">&mdash;</td><td class="num">&mdash;</td><td></td></tr>`;
            }
            const tier = pick.tier ? ` <span style="color:#aaa;">T${pick.tier}</span>` : '';
            const warn = pick.projectionUnreliable
                ? ' <span style="color:#fc6;" title="Item does not follow the known mythic curve">&#9888;</span>'
                : '';
            const projected = mode === 'possible'
                ? `<td class="num">${fmtSigned(pick.projectedRawDelta ?? 0)} / ${fmtSignedPct(pick.projectedResonanceDelta ?? 0)}</td>`
                : '<td></td>';
            return `<tr><td>${slot}${tier}</td>`
                + `<td>${esc(pick.chosen.name)} (${pick.chosen.rarity} lvl${pick.chosen.level})${warn}</td>`
                + `<td class="num" style="color:${pick.rawDelta < 0 ? '#f88' : '#7f7'};">${fmtSigned(pick.rawDelta)}</td>`
                + `<td class="num">${fmtSignedPct(pick.resonanceDelta)}</td>`
                + projected + '</tr>';
        }).join('');

        const summary = mode === 'possible'
            ? `<p><b>Today this costs ${fmtSigned(plan.totalRawDelta)} carac points.</b>`
              + ` Once every slot sits at max level it is worth ${fmtSigned(plan.totalProjectedRawDelta ?? 0)}`
              + ` carac points and ${fmtSignedPct(plan.totalProjectedResonanceDelta ?? 0)} resonance.`
              + ` The gap is deliberate &mdash; these are the better targets, not the better items today.</p>`
            : `<p><b>${fmtSigned(plan.totalRawDelta)} carac points, ${fmtSignedPct(plan.totalResonanceDelta)} active resonance.</b>`
              + ` This button never makes you weaker.</p>`;

        const projectedHead = mode === 'possible' ? '<th>at max level</th>' : '<th></th>';
        const button = plan.changes.length === 0
            ? '<p style="color:#7f7;">Nothing to change &mdash; every slot already holds the best item.</p>'
            : `<label class="myButton" id="HHGearExecute" style="font-size:14px;width:100%;text-align:center;">`
              + `Equip ${plan.changes.length} item(s)</label>`;

        fillHHPopUp('HHGearPreview', modeName, `
        <div id="HHGearPreview" style="padding:10px;max-width:720px;font-size:13px;">
            <p>Hero class <b>${HeroHelper.getClass()}</b>, team theme <b>${esc(theme)}</b>.
               Ranking: raw stats first, resonance as the tiebreak
               (a resonance bonus is never worth giving up raw stats for).</p>
            <table>
                <tr><th>Slot</th><th>Item</th><th>caracs now</th><th>resonance now</th>${projectedHead}</tr>
                ${rows}
            </table>
            ${summary}
            <p id="HHGearStatus" style="color:#ffb827;"></p>
            ${button}
        </div>`);

        $('#HHGearExecute').on('click', function () {
            $(this).attr('disabled', 'disabled').css('opacity', '0.5');
            void EquipmentGear.execute(plan);
        });
    }

    // ------------------------------------------------------------- execute

    /**
     * Put the planned items on, one call at a time.
     *
     * The inventory id of the item that comes off changes the moment it is
     * unequipped, so the only place a rollback id can come from is the
     * equip response itself (`unequipped_armor`). It is written to storage
     * as each swap lands.
     */
    private static async execute(plan: GearPlan): Promise<void> {
        const ajax = getHHAjax();
        if (!ajax) {
            logHHAuto('Gear: shared.general.hh_ajax disappeared, aborting -- nothing was changed.');
            $('#HHGearStatus').text('hh_ajax is unavailable. Nothing was changed.');
            return;
        }

        const swapLog = getStoredJSON<any[]>(HHStoredVarPrefixKey + TK.gearSwapLog, []);
        let done = 0;
        for (const pick of plan.changes) {
            const item = pick.chosen!;
            $('#HHGearStatus').text(`Equipping slot ${pick.slot} (${done + 1}/${plan.changes.length})...`);
            const data: any = await new Promise(resolve => {
                ajax({
                    action: 'market_equip_armor',
                    id_member_armor: item.id_member_armor,
                    rarity: item.rarity,
                }, resolve);
            }).catch(err => { logHHAuto('Gear: equip call failed: ' + err); return null; });

            if (!data || data.success === false) {
                logHHAuto(`Gear: slot ${pick.slot} refused by the game, stopping after ${done} swap(s).`);
                $('#HHGearStatus').text(`Stopped at slot ${pick.slot}: the game refused the swap.`
                    + ` ${done} of ${plan.changes.length} done.`);
                break;
            }

            const removedId = data?.unequipped_armor?.id_member_armor ?? null;
            swapLog.push({
                ts: Date.now(),
                slot: pick.slot,
                equipped: item.id_member_armor,
                equippedName: item.name,
                // The rollback id. Only valid from this response -- it is
                // not the id the item had while it was worn.
                unequipped: removedId,
                unequippedName: pick.current?.name ?? null,
            });
            setStoredValue(HHStoredVarPrefixKey + TK.gearSwapLog, JSON.stringify(swapLog.slice(-60)));
            logHHAuto(`Gear: slot ${pick.slot} now holds ${EquipmentGear.describe(item)};`
                + ` the item that came off is back in the inventory as id ${removedId ?? 'unknown'}.`);
            done++;

            if (done < plan.changes.length) {
                await new Promise(resolve => setTimeout(resolve, randomInterval(600, 1200)));
            }
        }

        if (done === plan.changes.length) {
            $('#HHGearStatus').text(`Done: ${done} slot(s) changed. Reload the page to see the new stats.`);
            logHHAuto(`Gear: finished, ${done} slot(s) changed.`);
        }
    }
}

/** Same markup hhButton produces, built here so this module does not have to
 *  import HHMenuHelper -- that import closes an AutoLoopPageHandlers cycle
 *  (ADR-002). Shop.ts inlines its market buttons for the same reason. */
function gearButton(id: string): string {
    return `<div class="tooltipHH">`
        + `<span class="tooltipHHtext">${getTextForUI(id, "tooltip")}</span>`
        + `<label class="myButton" id="${id}">${getTextForUI(id, "elementText")}</label>`
        + `</div>`;
}

function esc(value: string): string {
    return String(value).replace(/[&<>"]/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

function fmtSigned(value: number): string {
    const rounded = Math.round(value);
    return (rounded > 0 ? '+' : '') + rounded.toLocaleString();
}

function fmtSignedPct(value: number): string {
    return (value > 0 ? '+' : '') + value.toFixed(1) + 'pp';
}
