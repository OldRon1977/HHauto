// TooltipService.ts
//
// Controls the visibility and placement of help tooltips in the HHAuto settings
// menu. Each menu item carries a hidden span (.tooltipHHtext) holding its help
// text; hovering the surrounding .tooltipHH shows that text.
//
// Placement (8.10.0): the text is no longer shown inside the hovered element.
// It is copied into a single floating box appended to <body>, which is placed
// vertically centred and to the left of the settings panel — the same spot
// every time, so the eye does not have to hunt for it.
//
// Two reasons it has to live outside the panel rather than inside the hovered
// row, which is where it used to be drawn:
//   - #sMenu is overflow:hidden and the pane scrolls, so a tooltip drawn inside
//     was cut off at the panel edge;
//   - it used to sit above its own row, which pushed the tooltips of the top
//     rows off the screen entirely.
// <body> is also outside the CSS transform the game puts on #contains_all, so
// position:fixed means viewport coordinates here, with no scaling to undo.
//
// Tooltips outside the panel (harem tools, team buttons, popups) use the same
// box, placed next to their anchor and clamped to the viewport.
//
// The `important` flag is kept for API compatibility with the callers in
// StartService; visibility is now a plain flag, so no !important is needed.
//
// Used by: StartService (initial state), menu checkbox handler
import { getStoredValue } from "../Helper/StorageHelper";
import { logHHAuto } from "../Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK } from "../config/StorageKeys";

const TOOLTIP_ID = 'HHAutoTooltip';
const GAP = 8;

let tooltipsEnabled = false;
let handlersBound = false;

function styleOnce(): void {
    if (document.getElementById(TOOLTIP_ID + 'Style') !== null) return;
    const style = document.createElement('style');
    style.id = TOOLTIP_ID + 'Style';
    style.textContent = '#' + TOOLTIP_ID + ' {'
        + ' position:fixed; display:none; z-index:2147483000;'
        + ' width:240px; max-height:60vh; overflow-y:auto;'
        + ' padding:6px 8px; border:1px solid #ffa23e; border-radius:5px;'
        + ' background:#fff; color:#000; opacity:.97;'
        + ' font-size:11px; line-height:1.35; text-align:left;'
        + ' pointer-events:none;}';
    (document.head || document.documentElement).appendChild(style);
}

function box(): HTMLElement {
    let el = document.getElementById(TOOLTIP_ID);
    if (el === null) {
        styleOnce();
        el = document.createElement('div');
        el.id = TOOLTIP_ID;
        document.body.appendChild(el);
    }
    return el;
}

function hide(): void {
    const el = document.getElementById(TOOLTIP_ID);
    if (el !== null) el.style.display = 'none';
}

/** Same spot every time: vertically centred, just left of the settings panel. */
function placeAgainstPanel(el: HTMLElement, panel: HTMLElement): void {
    const panelRect = panel.getBoundingClientRect();
    const tip = el.getBoundingClientRect();

    let x = panelRect.left - tip.width - GAP;
    if (x < GAP) x = panelRect.left + GAP;          // no room outside: tuck inside
    let y = panelRect.top + (panelRect.height - tip.height) / 2;
    y = Math.max(GAP, Math.min(y, window.innerHeight - tip.height - GAP));

    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
}

/** Outside the panel: beside the anchor, flipped or pulled back to stay on screen. */
function placeNearAnchor(el: HTMLElement, anchor: HTMLElement): void {
    const a = anchor.getBoundingClientRect();
    const tip = el.getBoundingClientRect();

    let x = Math.min(a.left, window.innerWidth - tip.width - GAP);
    x = Math.max(GAP, x);
    let y = a.bottom + GAP;
    if (y + tip.height > window.innerHeight - GAP) y = a.top - tip.height - GAP;
    y = Math.max(GAP, y);

    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
}

function show(anchor: HTMLElement): void {
    const source = anchor.querySelector('.tooltipHHtext');
    const html = source === null ? '' : source.innerHTML.trim();
    if (html === '') { hide(); return; }

    const el = box();
    el.innerHTML = html;
    el.style.display = 'block';
    el.style.left = '0px';
    el.style.top = '0px';                            // measure before placing

    const panel = anchor.closest('#sMenu') as HTMLElement | null;
    if (panel !== null) {
        placeAgainstPanel(el, panel);
    } else {
        placeNearAnchor(el, anchor);
    }
}

function bindOnce(): void {
    if (handlersBound) return;
    handlersBound = true;
    // Delegated, so rows injected later are covered and nothing binds twice.
    $(document).on('mouseenter', '.tooltipHH', (event) => {
        if (!tooltipsEnabled) return;
        try {
            show(event.currentTarget as HTMLElement);
        } catch (err) {
            logHHAuto('Error in tooltip construction');
        }
    });
    $(document).on('mouseleave', '.tooltipHH', hide);
    // The panel scrolls under a pinned tooltip, and closing it would strand one.
    $(document).on('scroll', '#sMenuPanes', hide);
    $(document).on('click', '#sMenuButton', hide);
}

export function manageToolTipsDisplay(important=false)
{

    if(getStoredValue(HHStoredVarPrefixKey+SK.showTooltips) === "true")
    {
        enableToolTipsDisplay(important);
    }
    else
    {
        disableToolTipsDisplay(important);
    }
}

export function enableToolTipsDisplay(important=false)
{
    void important;
    tooltipsEnabled = true;
    bindOnce();
}

export function disableToolTipsDisplay(important=false)
{
    void important;
    tooltipsEnabled = false;
    bindOnce();
    hide();
}
