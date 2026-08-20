// MenuBadge.ts
//
// Counts how many of an area's *acting* switches are on, for the badge on the
// tab rail (#1834). No DOM, no storage, no imports: the caller supplies a
// reader, so this stays fully unit-testable and a graph leaf.
//
// Why a count and not the red/green tab colour that was proposed:
//
//   - "at least one switch is ticked" is not the same as "this area does
//     something". Measured against the factory defaults, 7 of the 11 areas
//     would light up green out of the box -- through `showInfo`,
//     `showRewardsRecap`, `showClubButtonInPoa`, `hideOwnedGirls` and friends,
//     which are pure display options. Green would mean "some checkbox is set".
//   - The reverse case is worse and realistic: `adventure` has 17 switches of
//     which exactly one, `autoTrollBattle`, makes the script act. With
//     `plusEvent` ticked and `autoTrollBattle` off, a binary marker reports
//     green while nothing runs -- precisely the forgotten-toggle case it was
//     meant to catch.
//   - A number says *how much* is on, which is what you need when comparing
//     the same area across several accounts.
//   - Red/green as the only channel fails for red-green colour deficiency.
//     A count works without colour; colour can tint the badge on top.

export interface BadgeCount {
    /** Acting switches currently on. */
    on: number;
    /** Acting switches that exist in this build's markup. */
    total: number;
}

/**
 * Count the acting switches of one area.
 *
 * `isOn` returns `undefined` for a switch that is not in the DOM at all --
 * debug-only rows, or a switch a later version dropped. Those are left out of
 * both numbers rather than counted as off, so the badge never claims a
 * capability the panel does not show.
 */
export function countActive(
    masters: readonly string[],
    isOn: (key: string) => boolean | undefined,
): BadgeCount {
    let on = 0;
    let total = 0;
    for (const key of masters) {
        const state = isOn(key);
        if (state === undefined) continue;
        total++;
        if (state) on++;
    }
    return { on, total };
}

/** `2/6`, or an empty string for an area with nothing to count (e.g. Harem). */
export function formatBadge(count: BadgeCount): string {
    return count.total === 0 ? '' : count.on + '/' + count.total;
}
