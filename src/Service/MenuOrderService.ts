// MenuOrderService.ts -- "Menu Order" reorder popup for the settings areas
// (#1834).
//
// A footer button opens a popup where the user drags (or uses the up/down
// arrows) to put the settings areas in the order they want. Unlike the pipeline
// "Block Order" popup this has no constraints -- areas are independent, so every
// row is movable and no order can be invalid.
//
// Two more differences to PipelineOrderService, both deliberate:
//   - no reload on save. The pipeline order is read once at boot by the
//     scheduler; the menu order is just DOM sequence, so applyMenuOrder moves
//     the existing nodes and the user sees the result immediately, with every
//     input still bound and still holding its value.
//   - the labels are translated (the areas are named in the menu the user is
//     looking at, so an English-only popup would be a step back from the i18n
//     work this branch is about).
//
// The order is written to TK.menuOrder (localStorage, HHType "Setting"), so it
// survives "delete temp vars" and is included in the JSON settings export.
import { fillHHPopUp, maskHHPopUp } from "../Utils/HHPopup";
import { setStoredValue, deleteStoredValue } from "../Helper/StorageHelper";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { TK } from "../config/StorageKeys";
import { getTextForUI } from "../Helper/LanguageHelper";
import { logHHAuto } from "../Utils/LogUtils";
import { isDefaultMenuOrder, resolveMenuOrder } from "../Helper/menu/MenuOrder";
import { applyMenuOrder, menuAreaIds, visibleMenuAreas } from "../Helper/menu/MenuTabs";

const POPUP_ID = "menuOrderPopup";

function label(key: string): string {
    return getTextForUI(key, "elementText");
}

export class MenuOrderService {
    /** Open the reorder popup for the areas currently on screen. */
    static showPopup(): void {
        const rows = visibleMenuAreas();
        if (rows.length === 0) {
            logHHAuto("Menu order: the settings menu is not built yet.");
            return;
        }
        fillHHPopUp(POPUP_ID, label("menuOrder"), MenuOrderService.buildContent(rows));
        MenuOrderService.bindEvents();
    }

    // -- private --

    private static buildContent(rows: { id: string; label: string }[]): string {
        const list = rows.map((row) =>
            '<div class="menuOrderRow" data-area-id="' + row.id + '" draggable="true"'
            + ' style="display:flex; align-items:center; gap:6px; padding:5px 7px; margin:2px 0;'
            + ' background:#f4f4f4; border:1px solid #ccc; border-radius:4px; cursor:grab;">'
            + '<span style="flex:0 0 14px; color:#999;">&#x2630;</span>'
            + '<span style="flex:1 1 auto;">' + row.label + '</span>'
            + '<span class="menuOrderUp" style="cursor:pointer; padding:0 5px; user-select:none;">&#x25B2;</span>'
            + '<span class="menuOrderDown" style="cursor:pointer; padding:0 5px; user-select:none;">&#x25BC;</span>'
            + '</div>').join("");

        return '<div style="padding:10px; max-width:440px; color:#333;">'
            + '<p style="margin:0 0 10px; font-size:12px;">' + label("menuOrderHint") + '</p>'
            + '<div id="menuOrderList" style="max-height:340px; overflow-y:auto; padding-right:4px;">' + list + '</div>'
            + '<div style="display:flex; justify-content:space-between; gap:8px; margin-top:14px;">'
            +   '<label class="myButton" id="menuOrderReset" style="cursor:pointer; padding:6px 12px;">' + label("menuOrderReset") + '</label>'
            +   '<span style="flex:1 1 auto;"></span>'
            +   '<label class="myButton" id="menuOrderCancel" style="cursor:pointer; padding:6px 12px;">' + label("menuOrderCancel") + '</label>'
            +   '<label class="myButton" id="menuOrderSave" style="cursor:pointer; padding:6px 14px; font-weight:bold;">' + label("menuOrderSave") + '</label>'
            + '</div>'
            + '</div>';
    }

    private static readSequence(): string[] {
        const out: string[] = [];
        $('#menuOrderList .menuOrderRow').each(function () {
            const id = $(this).attr("data-area-id");
            if (id) out.push(id);
        });
        return out;
    }

    private static bindEvents(): void {
        const list = $('#menuOrderList');

        list.off('click', '.menuOrderUp').on('click', '.menuOrderUp', function () {
            const row = $(this).closest('.menuOrderRow');
            const prev = row.prev('.menuOrderRow');
            if (prev.length) row.insertBefore(prev);
        });
        list.off('click', '.menuOrderDown').on('click', '.menuOrderDown', function () {
            const row = $(this).closest('.menuOrderRow');
            const next = row.next('.menuOrderRow');
            if (next.length) row.insertAfter(next);
        });

        // HTML5 drag-and-drop, same handling as the Block Order popup.
        let dragged: HTMLElement | null = null;
        list.off('dragstart', '.menuOrderRow').on('dragstart', '.menuOrderRow', function (e) {
            dragged = this as HTMLElement;
            const dt = (e.originalEvent as DragEvent).dataTransfer;
            if (dt) dt.effectAllowed = "move";
        });
        list.off('dragover', '.menuOrderRow').on('dragover', '.menuOrderRow', function (e) {
            e.preventDefault();
            const target = this as HTMLElement;
            if (!dragged || dragged === target) return;
            const rect = target.getBoundingClientRect();
            const after = (e.originalEvent as DragEvent).clientY > rect.top + rect.height / 2;
            if (after) $(target).after(dragged); else $(target).before(dragged);
        });
        list.off('drop', '.menuOrderRow').on('drop', '.menuOrderRow', function (e) {
            e.preventDefault();
            dragged = null;
        });

        $('#menuOrderCancel').off('click').on('click', function () { maskHHPopUp(); });

        $('#menuOrderReset').off('click').on('click', function () {
            deleteStoredValue(HHStoredVarPrefixKey + TK.menuOrder);
            applyMenuOrder(menuAreaIds());
            logHHAuto("Menu order reset to default.");
            maskHHPopUp();
        });

        $('#menuOrderSave').off('click').on('click', function () {
            const defaultIds = menuAreaIds();
            // The popup only lists the visible areas, so resolve puts the hidden
            // ones back at their default positions before anything is stored.
            const proposed = resolveMenuOrder(MenuOrderService.readSequence(), defaultIds);
            if (isDefaultMenuOrder(proposed, defaultIds)) {
                deleteStoredValue(HHStoredVarPrefixKey + TK.menuOrder);
            } else {
                setStoredValue(HHStoredVarPrefixKey + TK.menuOrder, JSON.stringify(proposed));
            }
            applyMenuOrder(proposed);
            logHHAuto("Menu order saved.");
            maskHHPopUp();
        });
    }
}
