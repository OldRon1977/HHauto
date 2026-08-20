// EquipmentGear.ts -- The gear buttons on the market page: pick the best
// armor for the hero's six slots and put it on.
//
// Deliberately built like the team workflow so the player needs one mental
// model, not two:
//
//   Team page                Market page
//   2a Current Best     ->   Current Best Gear
//   2b Possible Best    ->   Possible Best Gear
//   3  Stuff Team       ->   Upgrade Gear
//
// The ranking itself lives in Service/EquipmentOptimizerService.ts and is
// pure. This file only does the impure half: read the game's globals and
// DOM, page through the inventory, show the preview, and fire the equip
// calls.
//
// Background, data model and the measurement traps:
// docs-internal/equipment-resonance.md.
//
// Used by: Service/AutoLoopPageHandlers.ts (market page, and the upgrade
// page the Level-up button navigates to)

import { ConfigHelper } from "../Helper/ConfigHelper";
import { keepKey, keepKeyFromRaw, pickKeepers } from "../Service/EquipmentKeepService";
import { HeroHelper } from "../Helper/HeroHelper";
import { getTextForUI } from "../Helper/LanguageHelper";
import { getPage } from "../Helper/PageHelper";
import { getStoredValue, getStoredJSON, setStoredValue } from "../Helper/StorageHelper";
import { randomInterval } from "../Helper/TimeHelper";
import { addNutakuSession } from "../Service/PageNavigationService";
import {
    ArmorItem,
    GearPlan,
    GearTheme,
    parseArmorItem,
    parseTheme,
    GearMode,
    planCurrentBest,
    planPossibleBest,
    MYTHIC_MAX_LEVEL,
    themeFromTeamData,
} from "../Service/EquipmentOptimizerService";
import {
    UPGRADE_PATH,
    UpgradeTarget,
    countMaterialStock,
    decideNextLevelUp,
    parseRequirement,
    pickUpgradeTargets,
    upgradePageUrl,
} from "../Service/EquipmentUpgradeService";
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

interface UpgradeQueueEntry { id: number; name: string; slot: number; startedAt?: number }

/** How long a queue may sit untouched before the market page forgets it.
 *  Long enough to survive the navigation the Start button triggers. */
const STALE_QUEUE_MS = 90_000;

const SLOT_NAMES: Record<number, string> = {
    1: 'Head', 2: 'Body', 3: 'Legs', 4: 'Flag', 5: 'Pet', 6: 'Weapon',
};

/** What each priority tier means, for the log and the preview. */
const TIER_NAMES: Record<number, string> = {
    1: 'mythic, class + theme',
    2: 'mythic, class',
    3: 'mythic, theme',
    4: 'mythic',
    5: 'no capped mythic for this slot',
};

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

        EquipmentGear.dropStaleUpgradeQueue();
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
        // Already injected? Then stop -- and clear any extra copies first.
        //
        // This used to test for #HHGearCurrentBest, an id that stopped existing
        // when the four buttons became one menu. The check silently never fired
        // again, so every tab switch appended another block and the row filled
        // up with copies. Testing for the container itself cannot go stale the
        // same way, and sweeping the extras means a page that already collected
        // some repairs itself instead of needing a reload.
        const existing = document.querySelectorAll('#HHGearButtons');
        if (existing.length > 0) {
            for (let i = 1; i < existing.length; i++) existing[i].remove();
            return;
        }

        // One narrow button: measured on the live page there are only 150
        // device px of width and 115 of height left in this row beside the
        // game's own buttons, so the actions live in a menu (see showMenu).
        GM_addStyle('#HHGearButtons{display:flex;margin-left:10px;align-items:center;}'
            + '#HHGearButtons .tooltipHH{margin:0;padding:0;}'
            + '#HHGearButtons .myButton{display:flex;align-items:center;justify-content:center;'
            + 'box-sizing:border-box;width:90px;height:34px;margin:0;padding:2px 4px;'
            + 'font-size:11px;line-height:12px;text-align:center;overflow:hidden;}'
            + '#HHGearMenuList{list-style:none;margin:0;padding:0;}'
            + '#HHGearMenuList li{padding:0;margin:0 0 6px 0;}'
            + '#HHGearMenuList a{display:block;padding:7px 10px;border:1px solid #ffa23e;'
            + 'border-radius:4px;color:#e9e7dd;text-decoration:none;cursor:pointer;}'
            + '#HHGearMenuList a:hover{background:rgba(255,162,62,.15);}'
            + '#HHGearMenuList .sub{display:block;color:#98a191;font-size:11px;margin-top:2px;}'
            + '#HHGearPreview table{width:100%;border-collapse:collapse;font-size:12px;}'
            + '#HHGearPreview th,#HHGearPreview td{padding:2px 6px;text-align:left;'
            + 'border-bottom:1px solid rgba(255,255,255,0.15);}'
            + '#HHGearPreview td.num{text-align:right;font-variant-numeric:tabular-nums;}'
            // The keep marker. Anchored to the slot itself so it rides along
            // when the inventory re-renders a row.
            + '#player-inventory-armor .slot{position:relative;}'
            + '.HHKeepMark{position:absolute;top:0;right:0;width:22px;height:22px;z-index:5;'
            + 'pointer-events:none;background-repeat:no-repeat;background-size:22px 22px;}');

        // One button, not four. Measured on the live page: between the game's
        // own Level-up/Equip buttons and the right edge of .bottom-container
        // there are 150 device px (~98 CSS px) of width and 115 (~75) of
        // height -- room for two buttons, not four, and the fourth was drawn
        // over the Equipped Items panel where it could not be clicked. The
        // actions moved into a menu, which also means the next one costs no
        // space at all.
        host.append('<div id="HHGearButtons">' + gearButton('HHGearMenu') + '</div>');
        $("#HHGearMenu").on("click", () => { EquipmentGear.showMenu(); });

        // Delegated: the entries live in the popup, which is rebuilt each time.
        $(document).off('click.hhgear').on('click.hhgear', '#HHGearPreview [data-gear-action]', function () {
            const action = (this as HTMLElement).dataset.gearAction;
            if (action === 'current') void EquipmentGear.preview('current');
            else if (action === 'possible') void EquipmentGear.preview('possible');
            else if (action === 'upgrade') void EquipmentGear.previewUpgrade();
            else if (action === 'keep') void EquipmentGear.markKeepers();
        });
    }

    /**
     * Forget an upgrade queue that is no longer being worked on.
     *
     * At the cap the game redirects off the upgrade page by itself, so the
     * loop never reaches its own clean-up and the queue would sit in storage
     * until the player happened to open an upgrade page again. Being back on
     * the market with an old queue means the run is over one way or another.
     * The age check is what keeps this from eating the queue the Start button
     * just wrote, one navigation earlier.
     */
    private static dropStaleUpgradeQueue(): void {
        const queue = getStoredJSON<UpgradeQueueEntry[]>(HHStoredVarPrefixKey + TK.gearUpgradeQueue, []);
        if (!Array.isArray(queue) || queue.length === 0) return;
        const startedAt = Number(queue[0]?.startedAt) || 0;
        if (Date.now() - startedAt < STALE_QUEUE_MS) return;
        setStoredValue(HHStoredVarPrefixKey + TK.gearUpgradeQueue, '[]');
        EquipmentGear.releaseAutoLoop();
        logHHAuto(`Gear: dropping a stale upgrade queue (${queue.length} item(s) left);`
            + ' the run is no longer on the upgrade page.');
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
            // Keyed by source as well as id. The worn panel and the
            // inventory draw their ids from two different spaces that
            // overlap in range (measured: inventory 567,162..2,136,163,515,
            // worn 464,128..2,806,648), so a bare numeric key can collide
            // and silently drop whichever item lost the merge -- taking a
            // candidate out of the running with no error anywhere.
            const byKey = new Map<string, ArmorItem>();
            for (const item of [...equipped, ...inventory]) {
                const key = `${item.equipped ? 'eq' : 'inv'}:${item.id_member_armor}`;
                if (!byKey.has(key)) byKey.set(key, item);
            }
            const all = [...byKey.values()];

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
            const where = `  Slot ${pick.slot} (${SLOT_NAMES[pick.slot]})`;
            if (!pick.chosen) { logHHAuto(`${where}: no item owned.`); continue; }
            if (!pick.changed) {
                logHHAuto(`${where}: keeping ${EquipmentGear.describe(pick.chosen)}`
                    + ` -- ${TIER_NAMES[pick.tier]}.`);
                continue;
            }
            const from = pick.current ? EquipmentGear.describe(pick.current) : 'an empty slot';
            const projected = mode === 'possible'
                ? ` Once levelled: ${fmtSignedPct(pick.projectedResonanceDelta ?? 0)} resonance.`
                : '';
            const warn = pick.projectionUnreliable
                ? ' (this item does not follow the known mythic curve)'
                : '';
            logHHAuto(`${where}: ${EquipmentGear.describe(pick.chosen)} [${TIER_NAMES[pick.tier]}]`
                + ` replaces ${from}, ${fmtSigned(pick.caracDelta)} carac points today,`
                + ` ${fmtSignedPct(pick.resonanceDelta)} active resonance.${projected}${warn}`);
        }
        if (mode === 'possible') {
            logHHAuto(`  Total: ${fmtSigned(plan.totalCaracDelta)} carac points today,`
                + ` ${fmtSignedPct(plan.totalProjectedResonanceDelta ?? 0)} resonance once everything is levelled.`);
        } else {
            logHHAuto(`  Total: ${fmtSigned(plan.totalCaracDelta)} carac points,`
                + ` ${fmtSignedPct(plan.totalResonanceDelta)} active resonance.`);
        }
    }

    private static describe(item: ArmorItem): string {
        return `${item.name} (${item.rarity} lvl${item.level}, id ${item.id_member_armor})`;
    }

    /** The four gear actions as a list, since they no longer fit as buttons. */
    private static showMenu(): void {
        const entry = (action: string, key: string) =>
            `<li><a data-gear-action="${action}">${esc(getTextForUI(key, 'elementText'))}`
            + `<span class="sub">${esc(stripTags(getTextForUI(key, 'tooltip')))}</span></a></li>`;
        EquipmentGear.showMessage(getTextForUI('HHGearMenu', 'elementText'),
            '<ul id="HHGearMenuList">'
            + entry('current', 'HHGearCurrentBest')
            + entry('possible', 'HHGearPossibleBest')
            + entry('upgrade', 'HHGearUpgrade')
            + entry('keep', 'HHGearMarkKeep')
            + '</ul>');
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
            const label = `${esc(pick.chosen.name)} (${pick.chosen.rarity} lvl${pick.chosen.level})`;
            const tier = `<span style="color:#aaa;">${esc(TIER_NAMES[pick.tier])}</span>`;
            if (!pick.changed) {
                return `<tr style="color:#aaa;"><td>${slot}</td><td>keep ${label}</td>`
                    + `<td>${tier}</td><td class="num">&mdash;</td><td class="num">&mdash;</td></tr>`;
            }
            const warn = pick.projectionUnreliable
                ? ' <span style="color:#fc6;" title="Item does not follow the known mythic curve">&#9888;</span>'
                : '';
            const resonance = mode === 'possible'
                ? `${fmtSignedPct(pick.projectedResonanceDelta ?? 0)}`
                  + `<br/><span style="color:#aaa;font-size:10px;">now ${fmtSignedPct(pick.resonanceDelta)}</span>`
                : fmtSignedPct(pick.resonanceDelta);
            return `<tr><td>${slot}</td><td>${label}${warn}</td><td>${tier}</td>`
                + `<td class="num" style="color:${pick.caracDelta < 0 ? '#f88' : '#7f7'};">${fmtSigned(pick.caracDelta)}</td>`
                + `<td class="num">${resonance}</td></tr>`;
        }).join('');

        const summary = mode === 'possible'
            ? `<p><b>Today this costs ${fmtSigned(plan.totalCaracDelta)} carac points.</b>`
              + ` Levelled to the cap it is worth ${fmtSignedPct(plan.totalProjectedResonanceDelta ?? 0)} of resonance,`
              + ` and every mythic reaches the same stats there. The gap is deliberate &mdash;`
              + ` these are the better targets, not the better items today.</p>`
            : `<p><b>${fmtSigned(plan.totalCaracDelta)} carac points, ${fmtSignedPct(plan.totalResonanceDelta)} active resonance.</b></p>`;

        const resonanceHead = mode === 'possible' ? 'resonance at cap' : 'resonance';
        const button = plan.changes.length === 0
            ? '<p style="color:#7f7;">Nothing to change &mdash; every slot already holds the best item.</p>'
            : `<label class="myButton" id="HHGearExecute" style="font-size:14px;width:100%;text-align:center;">`
              + `Equip ${plan.changes.length} item(s)</label>`;

        fillHHPopUp('HHGearPreview', modeName, `
        <div id="HHGearPreview" style="padding:10px;max-width:760px;font-size:13px;">
            <p>Hero class <b>${HeroHelper.getClass()}</b>, team theme <b>${esc(theme)}</b>.
               Ranked by priority, not by a stat score: a capped mythic matching your class
               and your team's theme first, then class, then theme, then any capped mythic,
               and only then everything else. At the cap every mythic has the same stats,
               so the resonance is the whole difference.</p>
            <table>
                <tr><th>Slot</th><th>Item</th><th>why</th><th>caracs</th><th>${resonanceHead}</th></tr>
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

    // ------------------------------------------------------------- upgrade

    /**
     * "Upgrade Gear": level the mythics the hero is wearing towards the cap.
     *
     * The plan is deliberately thin. How much material a level costs is not
     * derivable (see EquipmentUpgradeService) and the upgrade page states it
     * per item, so the preview lists the targets and the stock behind them
     * and leaves the arithmetic to the page that knows it.
     */
    /**
     * Mark the mythics worth keeping, so everything unmarked is safe to spend
     * by hand as upgrade material.
     *
     * Display only: nothing is equipped, sold or consumed here, and the
     * automation never feeds mythics to anything either. The rule lives in
     * EquipmentKeepService -- one piece per slot and element.
     */
    private static async markKeepers(): Promise<void> {
        if (EquipmentGear.running) return;
        EquipmentGear.running = true;
        try {
            const rawClass = Number(HeroHelper.getClass());
            if (rawClass !== 1 && rawClass !== 2 && rawClass !== 3) {
                EquipmentGear.showMessage('Mark Keepers', 'Could not read the hero class.');
                return;
            }

            EquipmentGear.showMessage('Mark Keepers', 'Reading the inventory...');
            const inventory = await EquipmentGear.fetchInventory();
            if (inventory === null) {
                EquipmentGear.showMessage('Mark Keepers',
                    'Could not read the inventory. Nothing was marked -- see the log.');
                return;
            }

            const decision = pickKeepers(inventory, rawClass as PlayerClass);
            // Stored as level-independent keys, not ids: ids change when a
            // piece is unequipped, and the marks have to survive both the walk
            // to the upgrade page and the levelling itself.
            const keys = inventory
                .filter(i => decision.keep.has(i.id_member_armor))
                .map(keepKey);
            setStoredValue(HHStoredVarPrefixKey + TK.gearKeepKeys, JSON.stringify(keys));
            const painted = EquipmentGear.paintKeepMarks(decision.keep);
            const freed = inventory.filter(i =>
                !i.equipped && i.rarity === 'mythic' && !decision.keep.has(i.id_member_armor)).length;

            logHHAuto(`Gear [Mark Keepers]: ${decision.keep.size} mythic(s) marked to keep,`
                + ` ${freed} free as material; ${painted} marker(s) drawn.`);
            for (const g of decision.groups) {
                if (g.freed > 0) {
                    logHHAuto(`  slot ${g.slot} ${g.element}: keeping ${g.keptId}, ${g.freed} free`);
                }
            }

            const rows = decision.groups
                .map(g => `<tr><td>${g.slot}</td><td>${g.element}</td><td class="num">${g.freed}</td></tr>`)
                .join('');
            EquipmentGear.showMessage('Mark Keepers',
                `<p>${decision.keep.size} marked, ${freed} free to use as material by hand.</p>`
                + '<p>A marked piece is the one to keep for that slot and element.'
                + ' Nothing was changed in the game.</p>'
                + '<table id="HHGearPreview"><tr><th>Slot</th><th>Element</th><th>Free</th></tr>'
                + rows + '</table>');
        } catch (err) {
            logHHAuto('Gear: Mark Keepers failed -- ' + String(err));
        } finally {
            EquipmentGear.running = false;
        }
    }

    /** The stored keep keys, or an empty set when nothing was marked yet. */
    private static storedKeepKeys(): Set<string> {
        const raw = getStoredJSON<string[]>(HHStoredVarPrefixKey + TK.gearKeepKeys, []);
        return new Set(Array.isArray(raw) ? raw.map(String) : []);
    }

    /**
     * Redraw the keep marks in the upgrade page's material list.
     *
     * This is the page where the material is actually chosen by hand, so it is
     * where the marks matter most -- and it is a different document, so the
     * ones painted on the market are gone. Matching is by key rather than by
     * id: the two pages hand out different id spaces, and a levelled piece
     * keeps its key but changes everything else.
     *
     * The list loads lazily while scrolling (measured: 100 slots on arrival,
     * 299 after scrolling to the end), so this observes the container instead
     * of running once.
     */
    static markKeepersOnUpgradePage(): void {
        const keys = EquipmentGear.storedKeepKeys();
        if (keys.size === 0) return;

        const paint = () => {
            let painted = 0;
            document.querySelectorAll('.slot[data-d]').forEach(el => {
                if (el.querySelector('.HHKeepMark') !== null) return;
                const raw = safeJsonParse<unknown>((el as HTMLElement).dataset.d ?? '', null);
                const key = raw ? keepKeyFromRaw(raw) : null;
                if (key === null || !keys.has(key)) return;
                const star = document.createElement('div');
                star.className = 'HHKeepMark';
                star.style.backgroundImage =
                    `url("${ConfigHelper.getHHScriptVars('baseImgPath')}/design/ic_star_orange.svg")`;
                el.appendChild(star);
                painted++;
            });
            return painted;
        };

        GM_addStyle('.slot{position:relative;}'
            + '.HHKeepMark{position:absolute;top:0;right:0;width:22px;height:22px;z-index:5;'
            + 'pointer-events:none;background-repeat:no-repeat;background-size:22px 22px;}');

        paint();
        // The page handler runs on every AutoLoop tick, so this says its piece
        // once. It deliberately reports no count: the material list arrives
        // lazily (measured: 100 slots on load, 299 after scrolling to the end),
        // so any number taken here would be the number of pieces that happened
        // to be rendered in the first second, not the number that will be
        // marked.
        if (!EquipmentGear.upgradeMarksLogged) {
            EquipmentGear.upgradeMarksLogged = true;
            logHHAuto(`Gear: ${keys.size} piece(s) marked to keep; the material list`
                + ' loads while you scroll and gets its markers as it does.');
        }

        const list = document.querySelector('.items-container');
        if (list === null || EquipmentGear.upgradeObserver !== null) return;
        EquipmentGear.upgradeObserver = new MutationObserver(() => { paint(); });
        EquipmentGear.upgradeObserver.observe(list, { childList: true, subtree: true });
    }

    private static upgradeObserver: MutationObserver | null = null;
    private static upgradeMarksLogged = false;

    /**
     * Draw the marker on every kept piece and clear it everywhere else.
     * Returns how many markers ended up on screen, which is what tells the log
     * whether the ids actually matched the rendered slots.
     */
    private static paintKeepMarks(keep: Set<number>): number {
        $('.HHKeepMark').remove();
        let painted = 0;
        $('#player-inventory-armor .slot[id_item]').each(function () {
            const id = Number((this as HTMLElement).getAttribute('id_item'));
            if (!keep.has(id)) return;
            const star = document.createElement('div');
            star.className = 'HHKeepMark';
            // The game's own star, same asset the market UI uses.
            star.style.backgroundImage =
                `url("${ConfigHelper.getHHScriptVars('baseImgPath')}/design/ic_star_orange.svg")`;
            this.appendChild(star);
            painted++;
        });
        return painted;
    }

    private static async previewUpgrade(): Promise<void> {
        if (EquipmentGear.running) return;
        EquipmentGear.running = true;
        try {
            const theme = EquipmentGear.resolveTheme();
            if (!theme) {
                EquipmentGear.showMessage('Upgrade Gear',
                    'No team theme available. Build a team first -- without it the tiers'
                    + ' below would be guesses, and material spent on the wrong slot is gone.');
                logHHAuto('Gear: Upgrade Gear aborted, no team theme. Nothing was changed.');
                return;
            }
            const rawClass = Number(HeroHelper.getClass());
            if (rawClass !== 1 && rawClass !== 2 && rawClass !== 3) {
                EquipmentGear.showMessage('Upgrade Gear', 'Could not read the hero class.');
                return;
            }

            EquipmentGear.showMessage('Upgrade Gear', 'Reading the inventory...');
            const inventory = await EquipmentGear.fetchInventory();
            if (inventory === null) {
                EquipmentGear.showMessage('Upgrade Gear',
                    'Could not read the inventory. Nothing was changed -- see the log.');
                return;
            }
            const all = [...EquipmentGear.readEquipped(), ...inventory];
            const targets = pickUpgradeTargets(all, rawClass as PlayerClass, theme);
            const stock = countMaterialStock(all);

            logHHAuto(`Gear [Upgrade Gear]: ${targets.length} worn mythic(s) below level ${MYTHIC_MAX_LEVEL},`
                + ` material stock ${stock.legendary} legendary + ${stock.epic} epic.`);
            for (const t of targets) {
                logHHAuto(`  Slot ${t.slot} (${SLOT_NAMES[t.slot]}): ${t.name} at level ${t.level}`
                    + ` [${TIER_NAMES[t.tier]}]`);
            }

            EquipmentGear.showUpgradePlan(targets, stock);
        } catch (err) {
            logHHAuto('Gear: Upgrade Gear failed before any change was made: ' + err);
            EquipmentGear.showMessage('Upgrade Gear', 'Failed, nothing was changed. See the log.');
        } finally {
            EquipmentGear.running = false;
        }
    }

    private static showUpgradePlan(
        targets: UpgradeTarget[],
        stock: { legendary: number; epic: number; other: number },
    ): void {
        if (targets.length === 0) {
            EquipmentGear.showMessage('Upgrade Gear',
                `<p>Every mythic you are wearing is already at level ${MYTHIC_MAX_LEVEL}.</p>`
                + '<p style="color:#aaa;">Put the items you want to develop on first'
                + ' &mdash; "Possible Best Gear" does exactly that.</p>');
            return;
        }
        const rows = targets.map(t =>
            `<tr><td>${t.slot} ${SLOT_NAMES[t.slot]}</td><td>${esc(t.name)}</td>`
            + `<td class="num">lvl ${t.level}</td>`
            + `<td style="color:#aaa;">${esc(TIER_NAMES[t.tier])}</td></tr>`).join('');

        fillHHPopUp('HHGearPreview', 'Upgrade Gear', `
        <div id="HHGearPreview" style="padding:10px;max-width:720px;font-size:13px;">
            <p>Worn mythics below level ${MYTHIC_MAX_LEVEL}, best-matching first &mdash;
               material goes where it grows the most resonance.</p>
            <table>
                <tr><th>Slot</th><th>Item</th><th>level</th><th>why it is worth it</th></tr>
                ${rows}
            </table>
            <p><b>Material:</b> ${stock.legendary.toLocaleString()} legendary and
               ${stock.epic.toLocaleString()} epic items. Mythics are never consumed.</p>
            <p style="color:#aaa;font-size:11px;">The upgrade page shows each item's exact
               requirement, and the run stops by itself once the material is spent.</p>
            <p id="HHGearStatus" style="color:#ffb827;"></p>
            <label class="myButton" id="HHGearUpgradeStart" style="font-size:14px;width:100%;text-align:center;">
                Start with ${esc(targets[0].name)} (slot ${targets[0].slot})</label>
        </div>`);

        $('#HHGearUpgradeStart').on('click', function () {
            $(this).attr('disabled', 'disabled').css('opacity', '0.5');
            const queue = targets.map(t => ({
                id: t.id_member_armor, name: t.name, slot: t.slot, startedAt: Date.now(),
            }));
            setStoredValue(HHStoredVarPrefixKey + TK.gearUpgradeQueue, JSON.stringify(queue));
            logHHAuto(`Gear: queued ${queue.length} item(s) for upgrade; going to the upgrade page.`);
            EquipmentGear.gotoUpgradePage(queue[0].id);
        });
    }

    /**
     * Go to an item's upgrade page.
     *
     * Parking the autoloop first is not optional. It issues its own
     * navigations (the market refresh alone sends you back to shop.html),
     * and a bare `location.href` assignment loses that race: the queue was
     * written, the log said "going to the upgrade page", and the browser
     * ended up back on the market with nothing done. gotoPage() sets the
     * same flag for the same reason.
     */
    private static gotoUpgradePage(id: number): void {
        const target = addNutakuSession(upgradePageUrl({ id_member_armor: id })) as string;
        setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
        logHHAuto('Gear: navigating to ' + target);
        window.location.href = target;
    }

    /** Let the autoloop run again once the upgrade work is over. */
    private static releaseAutoLoop(): void {
        setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "true");
    }

    // --------------------------------------------------- the upgrade page

    /** True on /mythic-equipment-upgrade.html. That page carries no `page`
     *  attribute, so getPage() cannot identify it -- the path is the only
     *  handle. */
    static isUpgradePage(): boolean {
        return window.location.pathname.indexOf(UPGRADE_PATH) !== -1;
    }

    /**
     * Work the queue on the upgrade page: Auto Select, then Level-up, until
     * the item is capped or the material runs out.
     *
     * Auto Select is the game's own material picker, and the Level-up button
     * only lights up once it has covered the requirement -- so a button that
     * stays disabled is the game telling us the stock is spent. Nothing here
     * counts material or reimplements the cost curve.
     *
     * Does nothing at all while the queue is empty, which is the state
     * unless the player pressed the button.
     */
    static async runUpgradePage(): Promise<void> {
        if (!EquipmentGear.isUpgradePage()) return;
        const queue = getStoredJSON<UpgradeQueueEntry[]>(
            HHStoredVarPrefixKey + TK.gearUpgradeQueue, []);
        if (!Array.isArray(queue) || queue.length === 0) return;
        if (EquipmentGear.running) return;
        EquipmentGear.running = true;

        const finish = (msg: string) => {
            setStoredValue(HHStoredVarPrefixKey + TK.gearUpgradeQueue, '[]');
            EquipmentGear.releaseAutoLoop();
            logHHAuto('Gear: upgrade run finished -- ' + msg);
        };

        try {
            const head = queue[0];
            // A worn item reports its id under id_member_armor_equipped, and
            // the game sends it back as a string.
            const onPage = Number(unsafeWindow.item_to_upgrade?.id_member_armor_equipped
                ?? unsafeWindow.item_to_upgrade?.id_member_armor);
            if (onPage !== head.id) {
                // Someone navigated by hand, or the queue is stale. Acting
                // here would spend material on an item nobody asked for.
                finish(`the page shows item ${onPage}, the queue expects ${head.id}. Stopped without spending anything.`);
                return;
            }

            const req = parseRequirement(document.body.innerText);
            logHHAuto(`Gear: upgrading ${head.name} (slot ${head.slot}), level`
                + ` ${unsafeWindow.item_to_upgrade?.level}. Game asks ${req.toNextLevel ?? '?'}`
                + ` material for the next level, ${req.toMaxLevel ?? '?'} to reach the cap.`);

            // `item_to_upgrade.level` is a snapshot from page load and does
            // NOT move as levels are bought -- measured: it still read 1
            // after nineteen successful level-ups. Counting from the load
            // value is the only reliable level here. Over-counting a failed
            // call only makes this stop early, which is the safe direction.
            const startLevel = Number(unsafeWindow.item_to_upgrade?.level) || 0;
            let performed = 0;
            for (;;) {
                $('#auto-select').trigger('click');
                await new Promise(r => setTimeout(r, randomInterval(700, 1200)));

                const enabled = $('#level-up').length > 0
                    && !(document.getElementById('level-up') as HTMLButtonElement).disabled;
                const verdict = decideNextLevelUp({
                    currentLevel: startLevel + performed, levelUpEnabled: enabled,
                });
                if (!verdict.go) {
                    logHHAuto(`Gear: stopping on ${head.name} after ${performed} level(s) -- ${verdict.reason}.`);
                    if (!verdict.done) { finish(verdict.reason); return; }
                    break;
                }

                $('#level-up').trigger('click');
                performed++;
                await new Promise(r => setTimeout(r, randomInterval(1500, 2500)));
                logHHAuto(`Gear: ${head.name} is now level ${startLevel + performed}`
                    + ` (${performed} level(s) this run).`);
            }

            const rest = queue.slice(1);
            if (rest.length === 0) { finish('every queued item is done.'); return; }
            setStoredValue(HHStoredVarPrefixKey + TK.gearUpgradeQueue,
                JSON.stringify(rest.map(r => ({ ...r, startedAt: Date.now() }))));
            logHHAuto(`Gear: moving on to ${rest[0].name} (slot ${rest[0].slot}).`);
            EquipmentGear.gotoUpgradePage(rest[0].id);
        } catch (err) {
            setStoredValue(HHStoredVarPrefixKey + TK.gearUpgradeQueue, '[]');
            EquipmentGear.releaseAutoLoop();
            logHHAuto('Gear: upgrade run aborted: ' + err);
        } finally {
            EquipmentGear.running = false;
        }
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

/** Tooltips carry markup now; the menu wants a one-line plain summary. */
function stripTags(value: string): string {
    return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
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
