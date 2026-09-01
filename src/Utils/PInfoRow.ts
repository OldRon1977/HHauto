// PInfoRow.ts
//
// One row of the pInfo status panel: label on the left, value on the right
// (#1834). A plain "<li>Label : value</li>" list cuts off the longer rows,
// because the value is part of the same text node and there is nothing to
// align.
//
// A row is a flex line with two children, so the value column stays flush right
// no matter how long the label gets, and the label may wrap instead of being
// clipped (see the #pInfo CSS in build/HHAuto.template.js).
//
// Escaping: `label` and `value` are treated as HTML, because callers pass
// markup (the watchdog row carries a [reactivate] span, others pass &lt;/&gt;
// entities). `title` is attribute-escaped here, so callers must not escape it
// themselves. This module imports nothing, so both InfoService and the feature
// modules can use it without creating an import cycle between them.

export interface PInfoRowAttrs {
    /** Inline style for the row, e.g. "color:red". */
    style?: string;
    /** Tooltip text. Escaped here -- pass it raw. */
    title?: string;
}

function attr(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function openTag(attrs: PInfoRowAttrs): string {
    let tag = "<li";
    if (attrs.style !== undefined && attrs.style !== "") tag += ' style="' + attr(attrs.style) + '"';
    if (attrs.title !== undefined && attrs.title !== "") tag += ' title="' + attr(attrs.title) + '"';
    return tag + ">";
}

/**
 * A label/value row. An empty `value` renders the label across the full width,
 * which is what the rows without a time of their own need (watchdog errors, the
 * troll energy line, debug output).
 */
export function pInfoRow(label: string, value = "", attrs: PInfoRowAttrs = {}): string {
    const left = '<span class="pInfoLabel">' + label + "</span>";
    const right = value === "" ? "" : '<span class="pInfoValue">' + value + "</span>";
    return openTag(attrs) + left + right + "</li>";
}
