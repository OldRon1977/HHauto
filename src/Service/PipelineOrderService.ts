// PipelineOrderService.ts -- "Block Order" reorder popup (v7.37.0 pipeline-block
// architecture, ADR-001, Roadmap step 17 task 15).
//
// A single menu button ("Block Order") opens a popup where the user drags (or
// uses up/down arrows) to reorder the user-movable blocks. Infra blocks
// (EventParsing, GoHome -- userMovable:false) are shown greyed and pinned. On
// save the proposed order is validated against the hard constraints
// (OrderResolver.validateOrder); an illegal order is rejected with a message
// and NOT persisted. A valid order is written to TK.pipelineOrder (localStorage,
// persistent) and a reload applies it (the scheduler rebuilds the order at boot
// via resolveOrder).
//
// Enable/disable of a block is NOT done here -- that stays the feature switches
// in the main menu (a block whose feature is off never runs, regardless of
// position). This popup only reorders.
import { fillHHPopUp, maskHHPopUp } from "../Utils/HHPopup";
import { getStoredJSON, setStoredValue, deleteStoredValue } from "../Helper/StorageHelper";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { TK } from "../config/StorageKeys";
import { logHHAuto } from "../Utils/LogUtils";
import { resolveOrder, validateOrder } from "./OrderResolver";
import { safeReload } from "./PageNavigationService";
import { BlockOrder, BlockRegistry } from "./BlockTypes";

// Registry provider injected at boot (index.ts) instead of a static import of
// BlockPipeline -- a static import would pull Pipeline.config (all 33 handlers)
// into StartService's module subtree and create a large import cycle / TDZ risk
// (same decoupling as AutoLoop's setBlockTick, lesson zirkulaerer-import-tdz-crash).
type RegistryProvider = () => { registry: BlockRegistry; defaultOrder: BlockOrder };
let registryProvider: RegistryProvider | null = null;
export function setPipelineRegistryProvider(p: RegistryProvider): void { registryProvider = p; }

const POPUP_ID = "pipelineOrderPopup";
const POPUP_TITLE = "Block Order";

/** Human label from a block id: "handleSeasonCollect" -> "Season Collect". */
export function blockLabel(id: string): string {
  const base = id.startsWith("handle") ? id.slice("handle".length) : id;
  return base.replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim() || id;
}

/**
 * Rebuild a full block order from a new sequence of the MOVABLE blocks, keeping
 * every non-movable (pinned/infra) block at its current index. Movable slots
 * are filled in order from newMovableSeq. Pure + unit-tested.
 */
export function rebuildOrder(effective: BlockOrder, registry: BlockRegistry, newMovableSeq: string[]): BlockOrder {
  const seq = [...newMovableSeq];
  const out: string[] = [];
  for (const id of effective) {
    const b = registry[id];
    if (b && b.userMovable) out.push(seq.shift() ?? id);
    else out.push(id);
  }
  return out;
}

export class PipelineOrderService {
  /** Open the reorder popup with the current effective order. */
  static showPopup(): void {
    if (!registryProvider) { logHHAuto("Block order: registry provider not wired yet."); return; }
    const { registry, defaultOrder } = registryProvider();
    const stored = getStoredJSON(HHStoredVarPrefixKey + TK.pipelineOrder, null) as BlockOrder | null;
    const effective = resolveOrder(stored, registry, defaultOrder).order;
    fillHHPopUp(POPUP_ID, POPUP_TITLE, PipelineOrderService.buildContent(effective, registry));
    PipelineOrderService.bindEvents(effective, registry, defaultOrder);
  }

  // -- private --

  private static buildContent(effective: BlockOrder, registry: BlockRegistry): string {
    const rows = effective.map((id) => {
      const movable = !!(registry[id] && registry[id].userMovable);
      const label = blockLabel(id);
      if (movable) {
        return '<div class="pipeOrderRow" data-block-id="' + id + '" data-movable="1" draggable="true"'
          + ' style="display:flex; align-items:center; gap:6px; padding:5px 7px; margin:2px 0; background:#f4f4f4; border:1px solid #ccc; border-radius:4px; cursor:grab;">'
          + '<span style="flex:0 0 14px; color:#999;">&#x2630;</span>'
          + '<span style="flex:1 1 auto;">' + label + '</span>'
          + '<span class="pipeUp" title="Up" style="cursor:pointer; padding:0 5px; user-select:none;">&#x25B2;</span>'
          + '<span class="pipeDown" title="Down" style="cursor:pointer; padding:0 5px; user-select:none;">&#x25BC;</span>'
          + '</div>';
      }
      return '<div class="pipeOrderRow" data-block-id="' + id + '" data-movable="0"'
        + ' style="display:flex; align-items:center; gap:6px; padding:5px 7px; margin:2px 0; background:#e8e8e8; border:1px dashed #bbb; border-radius:4px; color:#999;">'
        + '<span style="flex:0 0 14px;">&#x1f512;</span>'
        + '<span style="flex:1 1 auto;">' + label + '</span>'
        + '</div>';
    }).join("");

    return '<div style="padding:10px; max-width:440px; color:#333;">'
      + '<p style="margin:0 0 8px; font-size:12px;">Drag a row, or use the &#x25B2;/&#x25BC; arrows, to change the order in which the script runs its blocks.</p>'
      + '<p style="margin:0 0 10px; font-size:11px; color:#888;">Greyed-out rows (&#x1f512;) are fixed and cannot be moved. Turn a block on/off in the main menu, not here.</p>'
      + '<div id="pipelineOrderList" style="max-height:340px; overflow-y:auto; padding-right:4px;">' + rows + '</div>'
      + '<div id="pipeOrderError" style="display:none; margin-top:8px; padding:6px; font-size:11px; color:#a00; background:#fdecea; border:1px solid #f5c6cb; border-radius:4px;"></div>'
      + '<div style="display:flex; justify-content:space-between; gap:8px; margin-top:14px;">'
      +   '<label class="myButton" id="pipeOrderReset" style="cursor:pointer; padding:6px 12px;">Restore default</label>'
      +   '<span style="flex:1 1 auto;"></span>'
      +   '<label class="myButton" id="pipeOrderCancel" style="cursor:pointer; padding:6px 12px;">Cancel</label>'
      +   '<label class="myButton" id="pipeOrderSave" style="cursor:pointer; padding:6px 14px; font-weight:bold;">Save</label>'
      + '</div>'
      + '</div>';
  }

  private static readMovableSeq(): string[] {
    const out: string[] = [];
    $('#pipelineOrderList .pipeOrderRow[data-movable="1"]').each(function () {
      const id = $(this).attr("data-block-id");
      if (id) out.push(id);
    });
    return out;
  }

  private static bindEvents(effective: BlockOrder, registry: BlockRegistry, defaultOrder: BlockOrder): void {
    const list = $('#pipelineOrderList');

    // Up/down arrows: swap with the nearest movable neighbour (skip pinned).
    list.off('click', '.pipeUp').on('click', '.pipeUp', function () {
      const row = $(this).closest('.pipeOrderRow');
      const prev = row.prevAll('.pipeOrderRow[data-movable="1"]').first();
      if (prev.length) row.insertBefore(prev);
    });
    list.off('click', '.pipeDown').on('click', '.pipeDown', function () {
      const row = $(this).closest('.pipeOrderRow');
      const next = row.nextAll('.pipeOrderRow[data-movable="1"]').first();
      if (next.length) row.insertAfter(next);
    });

    // HTML5 drag-and-drop among movable rows.
    let dragged: HTMLElement | null = null;
    list.off('dragstart', '.pipeOrderRow[data-movable="1"]').on('dragstart', '.pipeOrderRow[data-movable="1"]', function (e) {
      dragged = this as HTMLElement;
      const dt = (e.originalEvent as DragEvent).dataTransfer;
      if (dt) dt.effectAllowed = "move";
    });
    list.off('dragover', '.pipeOrderRow[data-movable="1"]').on('dragover', '.pipeOrderRow[data-movable="1"]', function (e) {
      e.preventDefault();
      const target = this as HTMLElement;
      if (!dragged || dragged === target) return;
      const rect = target.getBoundingClientRect();
      const after = (e.originalEvent as DragEvent).clientY > rect.top + rect.height / 2;
      if (after) $(target).after(dragged); else $(target).before(dragged);
    });
    list.off('drop', '.pipeOrderRow[data-movable="1"]').on('drop', '.pipeOrderRow[data-movable="1"]', function (e) {
      e.preventDefault();
      dragged = null;
    });

    $('#pipeOrderCancel').off('click').on('click', function () { maskHHPopUp(); });

    $('#pipeOrderReset').off('click').on('click', function () {
      deleteStoredValue(HHStoredVarPrefixKey + TK.pipelineOrder);
      logHHAuto("Block order reset to default.");
      maskHHPopUp();
      safeReload();
    });

    $('#pipeOrderSave').off('click').on('click', function () {
      const proposed = rebuildOrder(effective, registry, PipelineOrderService.readMovableSeq());
      const res = validateOrder(proposed, registry);
      if (!res.valid) {
        $('#pipeOrderError').css('display', 'block').html(
          'This order is not allowed:<br>' + res.errors.map((x) => '&bull; ' + x).join('<br>')
        );
        return;
      }
      // No-op if identical to the code default: store nothing, clear any override.
      const isDefault = proposed.length === defaultOrder.length && proposed.every((id, i) => id === defaultOrder[i]);
      if (isDefault) deleteStoredValue(HHStoredVarPrefixKey + TK.pipelineOrder);
      else setStoredValue(HHStoredVarPrefixKey + TK.pipelineOrder, JSON.stringify(proposed));
      logHHAuto("Block order saved.");
      maskHHPopUp();
      safeReload();
    });
  }
}
