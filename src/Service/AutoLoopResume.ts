// AutoLoopResume.ts -- Switch the auto-loop back on after an action and start it.
//
// Setting Temp_autoLoop to "false" stops autoLoop() from scheduling its next
// tick; it reads the flag only at its end (AutoLoopHold.ts). Setting it back
// to "true" therefore restarts nothing once that tick has ended -- the loop
// stays dead until a reload (#1908). Switching it on and kicking it belong
// together, which is what this does, with the player's loop interval.
//
// Not every place that switches the loop back on uses this. Some kick with a
// delay of their own, some only when no tick is scheduled, some rely on the
// navigation that follows: docs/reference/mechanics-catalogue.md, section 8.
//
// Depends on: StorageHelper, AutoLoopKick
// Used by: Bundles.ts, PathOfAttraction.ts, DoublePenetration.ts,
//   RewardHelper.ts, PlaceOfPower.ts
import { getStoredValue, setStoredValue } from "../Helper/StorageHelper";
import { HHStoredVarPrefixKey, TK } from "../config/StorageKeys";
import { kickAutoLoop } from "./AutoLoopKick";

/** Temp_autoLoop on, and a tick after the player's loop interval. */
export function resumeAutoLoop(): void {
    setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "true");
    kickAutoLoop(Number(getStoredValue(HHStoredVarPrefixKey + TK.autoLoopTimeMili)));
}
