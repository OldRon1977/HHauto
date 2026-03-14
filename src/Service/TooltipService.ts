// TooltipService.ts
//
// Controls the visibility of help tooltips in the HHAuto settings
// menu. Each menu item has a hidden tooltip span (.tooltipHHtext)
// that becomes visible on hover when tooltips are enabled.
//
// The tooltip positioning logic prevents overflow: if a tooltip would
// render above the viewport, it shifts down and to the right; if it
// would extend past the menu's right edge, it shifts left.
//
// The `important` flag forces !important CSS when toggling tooltips
// mid-session (vs. initial page load) to override previously injected
// styles.
//
// Used by: StartService (initial state), menu checkbox handler

import { getStoredValue } from '../Helper/index';
import { logHHAuto } from '../Utils/index';
import { HHStoredVarPrefixKey, SK } from '../config/index';

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
    const importantAddendum = important?'; !important':'';
    GM_addStyle('.tooltipHH:hover span.tooltipHHtext { '
        + 'border:1px solid #ffa23e; border-radius:5px; padding:5px; display:block; z-index: 100; position: absolute; width: 150px; color:black; '
        +'text-align:center; background:white;  opacity:0.9; transform: translateY(-100%)'+importantAddendum+'}');

    $(".tooltipHH").on('mouseover', (event) => {
        try{
            const tooltip = $('.tooltipHHtext', event.currentTarget);
            let tipX = 0;
            let tipY = -15;
            tooltip.css({ top: tipY, left: tipX });
            const tooltip_rect = tooltip[0].getBoundingClientRect();
            if (tooltip_rect.y < 0) {// Out on the top
                tipY = -tooltip_rect.y;
                tipX = $(event.currentTarget).outerWidth() + 5;
            }
            if ((tooltip_rect.x + tooltip_rect.width) > $('#sMenu')[0].getBoundingClientRect().width) // Out on the right
                tipX = -150;
            tooltip.css({ top: tipY, left: tipX });
        }catch(err) {
            logHHAuto('Error in tooltip construction');
        }
    });
}

export function disableToolTipsDisplay(important=false)
{
    const importantAddendum = important?'; !important':'';
    GM_addStyle('.tooltipHH:hover span.tooltipHHtext { display: none'+importantAddendum+'}');
}