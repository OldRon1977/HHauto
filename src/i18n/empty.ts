export const HHAuto_ToolTips: Record<string, Record<string, any>> = {en:{}, fr:{}, es:{}, de:{}, it:{}};

const w = (typeof unsafeWindow == 'undefined') ?  window : unsafeWindow;

export var hhTimerLocale = (w as any).Phoenix ? (w as any).Phoenix.language : null;
export var timerDefinitions: any;
if ((w as any).Phoenix && (hhTimerLocale !== undefined || hhTimerLocale !== null || hhTimerLocale.length > 0)) {
    timerDefinitions = {
    [hhTimerLocale]: {
        days: (w as any).Phoenix.__.DateTime.time_short_days,
        hours: (w as any).Phoenix.__.DateTime.time_short_hours,
        minutes: (w as any).Phoenix.__.DateTime.time_short_min,
        seconds: (w as any).Phoenix.__.DateTime.time_short_sec
        }
    }
} else {
    hhTimerLocale = 'en';
    timerDefinitions = {'en':{days: "d", hours: "h", minutes: "m", seconds: "s"}};
}
