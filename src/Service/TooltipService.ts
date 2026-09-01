// TooltipService.ts
//
// Controls the visibility and placement of help tooltips in the HHAuto settings
// menu. Each menu item carries a hidden span (.tooltipHHtext) holding its help
// text; hovering the surrounding .tooltipHH shows that text.
//
// Placement: the text is copied into a single floating box appended to <body>,
// placed vertically centred and to the left of the settings panel — the same
// spot every time, so the eye does not have to hunt for it.
//
// Two reasons the box has to live outside the panel rather than inside the
// hovered row:
//   - #sMenu is overflow:hidden and the pane scrolls, so a tooltip drawn inside
//     is cut off at the panel edge;
//   - drawn above its own row it would push the tooltips of the top rows off
//     the screen entirely.
// <body> is also outside the CSS transform the game puts on #contains_all, so
// position:fixed means viewport coordinates here, with no scaling to undo.
//
// Tooltips outside the panel (harem tools, team buttons, popups) use the same
// box, placed next to their anchor and clamped to the viewport.
//
// The `important` flag is kept for API compatibility with the callers in
// StartService; visibility is a plain flag, so no !important is needed.
//
// Used by: StartService (initial state), menu checkbox handler
import { getStoredValue } from "../Helper/StorageHelper";
import { logHHAuto } from "../Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../config/HHStoredVars";
import { SK } from "../config/StorageKeys";

const TOOLTIP_ID = 'HHAutoTooltip';
const GAP = 8;
/** Floor for the tooltip type; the game's zoom only ever scales it up. */
const BASE_FONT = 11;
const BASE_WIDTH = 240;
/** A long text may take up to twice the base width before the type shrinks. */
const MAX_WIDTH_FACTOR = 2;
/** Below this many characters the narrow box reads better than a wide one. */
const NARROW_UP_TO = 160;
/** From here on the text earns the full double width. */
const WIDE_FROM = 600;
/** Never squeeze the box below this, however short the window is. */
const MIN_BOX_HEIGHT = 120;

let tooltipsEnabled = false;
let handlersBound = false;

function styleOnce(): void {
    if (document.getElementById(TOOLTIP_ID + 'Style') !== null) return;
    const style = document.createElement('style');
    style.id = TOOLTIP_ID + 'Style';
    style.textContent = '#' + TOOLTIP_ID + ' {'
        + ' position:fixed; display:none; z-index:2147483000;'
        + ' width:' + BASE_WIDTH + 'px; overflow-y:auto;'
        + ' padding:6px 8px; border:1px solid #ffa23e; border-radius:5px;'
        + ' background:#fff; color:#000; opacity:.97;'
        + ' font-size:' + BASE_FONT + 'px; line-height:1.45; text-align:left;'
        + ' pointer-events:none;}';
    // Structure inside the box. Most tooltips are a single sentence and are
    // unaffected; the long ones use <p>/<ul> and would otherwise run together
    // as one block of <br>-separated lines.
    style.textContent += '#' + TOOLTIP_ID + ' p {margin:0 0 .6em 0;}'
        + '#' + TOOLTIP_ID + ' p:last-child {margin-bottom:0;}'
        + '#' + TOOLTIP_ID + ' ul {margin:.2em 0 .6em 0; padding-left:1.2em;}'
        + '#' + TOOLTIP_ID + ' li {margin:.2em 0;}'
        + '#' + TOOLTIP_ID + ' b, #' + TOOLTIP_ID + ' strong {color:#a04d00;}'
        + '#' + TOOLTIP_ID + ' code {background:rgba(0,0,0,.07); padding:0 3px; border-radius:3px;}'
        + '#' + TOOLTIP_ID + ' .tipHint {display:block; color:#555; font-style:italic; margin-bottom:.5em;}'
        // Pure code tables are many very short rows; one column would run them
        // down the whole box while the width sits unused.
        + '#' + TOOLTIP_ID + ' ul.tipCodes {columns:2; column-gap:1.2em; list-style:none; padding-left:0;}'
        + '#' + TOOLTIP_ID + ' ul.tipCodes li {break-inside:avoid;}';
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

/**
 * How much the game is zooming this element. #contains_all carries a CSS
 * transform, so everything inside it renders larger than its CSS pixels say.
 * getBoundingClientRect reports the zoomed size, offsetWidth the plain one.
 */
function gameScale(el: HTMLElement): number {
    if (el.offsetWidth <= 0) return 1;
    const s = el.getBoundingClientRect().width / el.offsetWidth;
    return (s > 0 && isFinite(s)) ? s : 1;
}

/**
 * Vertically centred beside the settings panel, on whichever side has room.
 *
 * Left is preferred so the box keeps one habitual place, but a wide box does
 * not always fit there -- and tucking it over the panel hides the very rows it
 * explains, so the right-hand gap is tried before falling back to that.
 */
function placeAgainstPanel(el: HTMLElement, panel: HTMLElement): void {
    const panelRect = panel.getBoundingClientRect();
    const tip = el.getBoundingClientRect();

    const roomLeft = panelRect.left - GAP;
    const roomRight = window.innerWidth - panelRect.right - GAP;
    let x: number;
    if (tip.width + GAP <= roomLeft) {
        x = panelRect.left - tip.width - GAP;
    } else if (tip.width + GAP <= roomRight) {
        x = panelRect.right + GAP;
    } else {
        // Neither gap takes it: sit on the roomier side and clamp on screen.
        x = roomLeft >= roomRight ? panelRect.left - tip.width - GAP : panelRect.right + GAP;
        x = Math.max(GAP, Math.min(x, window.innerWidth - tip.width - GAP));
    }

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

    const panel = anchor.closest('#sMenu') as HTMLElement | null;
    const el = box();
    el.innerHTML = html;
    el.style.display = 'block';
    el.style.left = '0px';
    el.style.top = '0px';                            // measure before placing

    // This box hangs off <body>, outside the transform the game applies to
    // #contains_all. Left at its CSS size it renders smaller than the menu it
    // explains, so match the zoom the menu is drawn at.
    const scale = gameScale(panel ?? anchor);

    // Width follows the amount of text. A one-line hint in a 480px box looks
    // broken, and a 900-character explanation in a 240px column turns into a
    // narrow ribbon that is genuinely hard to read -- so short stays narrow and
    // long earns up to double, before any type is sacrificed.
    const plain = (el.textContent ?? '').length;
    const span = WIDE_FROM - NARROW_UP_TO;
    const ratio = Math.min(1, Math.max(0, (plain - NARROW_UP_TO) / span));
    let widthFactor = 1 + (MAX_WIDTH_FACTOR - 1) * ratio;
    const applyWidth = () => {
        const room = window.innerWidth - 2 * GAP;
        const want = BASE_WIDTH * widthFactor * Math.max(1, scale);
        el.style.width = Math.round(Math.min(want, room)) + 'px';
    };
    applyWidth();

    // The box is centred vertically beside the panel, so the whole viewport
    // height minus the two gaps is available. A static max-height would not
    // follow the zoom while the type does, and overflow here is unreadable by
    // construction: the box is pointer-events:none, so its scrollbar cannot be
    // grabbed, and it hides as soon as the pointer leaves the row.
    const maxHeight = Math.max(MIN_BOX_HEIGHT, window.innerHeight - 2 * GAP);
    el.style.maxHeight = maxHeight + 'px';

    // Shrink to fit rather than clip. BASE_FONT is the floor, so the worst
    // case is a readable size and never a cut-off text.
    let font = Math.max(BASE_FONT, Math.round(BASE_FONT * scale));
    el.style.fontSize = font + 'px';

    // Widening costs nothing legible, shrinking does -- so spend the width
    // first and only then start taking the type down.
    if (el.scrollHeight > maxHeight && widthFactor < MAX_WIDTH_FACTOR) {
        widthFactor = MAX_WIDTH_FACTOR;
        applyWidth();
    }
    while (font > BASE_FONT && el.scrollHeight > maxHeight) {
        font -= 1;
        el.style.fontSize = font + 'px';
    }

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
