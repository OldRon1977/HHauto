// TabHelper.ts -- Open a tab of the game and wait until it shows its data.
//
// The game loads a tab's content with a request of its own when the tab is
// activated, and keeps asking on every activation until the first answer is
// in. Measured on the girl page (#1915): a click on a tab that is shown but
// still loading made the game render its data twice. So a shown tab is not
// clicked again, and the wait is for the rendered data, not for a pause.
//
// The caller says what "shown" and "loaded" mean on its page. Anything to do
// after the data is there (the girl page lets follow-up requests settle)
// stays with the caller.
//
// Places that open a tab differently, and why they are not on this:
// docs/reference/mechanics-catalogue.md, section 4.
//
// Depends on: TimeHelper, LogUtils
// Used by: HaremGirl.ts
import { logHHAuto } from "../Utils/LogUtils";
import { TimeHelper } from "./TimeHelper";

/**
 * Click the tab unless it is shown, then wait up to `timeoutMs` for its data.
 * False, with a log line, when the data does not arrive.
 */
export async function openTab(
    label: string,
    isShown: () => boolean,
    click: () => void,
    isLoaded: () => boolean,
    timeoutMs: number,
): Promise<boolean> {
    if (!isShown()) click();
    const loaded = await TimeHelper.waitFor(isLoaded, timeoutMs);
    if (!loaded) {
        logHHAuto(`Tab ${label} still loading after ${timeoutMs}ms`);
        return false;
    }
    return true;
}
