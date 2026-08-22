// MenuBadge.ts
//
// The run-state of one settings block, and the roll-up of an area's blocks for
// the badge on the tab rail (#1834). No DOM, no storage, no imports: the caller
// supplies a reader, so this stays fully unit-testable and a graph leaf.
//
// What the three states mean, and why not simply "a checkbox is ticked":
//
//   - "at least one switch is ticked" is not the same as "this block does
//     something". Measured against the factory defaults, 7 of the 11 areas
//     would light up out of the box -- through `showInfo`, `showRewardsRecap`,
//     `showClubButtonInPoa`, `hideOwnedGirls` and friends, which are pure
//     display options. Only a block's *acting* switches (`masters`) count.
//   - The reverse case is the one testers actually run into: `plusEvent` on,
//     `autoTrollBattle` off. The event-troll block is configured in every
//     detail and still never runs, because the switch that starts the fighting
//     is off. A plain on/off marker reports "off" there, which reads as a
//     deliberate choice rather than the forgotten toggle it is. That case gets
//     its own state, `conflict`.
//   - A block that cannot act at all -- thresholds, opponent filters, team
//     settings, anything display-only -- gets `none` and no marker. Colouring
//     it would claim it can be on or off when it cannot.
//
// So: `on` the block runs, `conflict` it is set up but will not run, `off`
// nothing is set, `none` there is nothing to be on about.

export type BlockState = 'on' | 'conflict' | 'off' | 'none';

/**
 * One settings block, as far as its run-state is concerned.
 *
 * Curated per block, never derived by a name rule -- `autoLeagues` and
 * `autoSeasonSkipLowMojo` both start with "auto" and only one of them does
 * anything on its own. Seeded from the settings the pipeline actually gates its
 * blocks on (`SK.` reads in Pipeline.config.ts, plus the market gates in
 * Market.ts) and then split three ways:
 */
export interface BlockDef {
    /**
     * Switches that make the script *act*. Any one of them is enough: a block
     * with `autoSeason`, `autoSeasonCollect` and `autoSeasonCollectAll` runs
     * when only the collector is on -- the pipeline gates those independently.
     */
    masters: readonly string[];
    /**
     * Switches elsewhere that must ALSO be on or nothing happens here. The
     * event-troll, mythic and love-raid blocks all need `autoTrollBattle`:
     * they only steer a run that switch starts.
     */
    requires?: readonly string[];
    /**
     * Switches that only steer this block. On while the block is off is the
     * forgotten-toggle signal. All of these default to "false", so on means
     * the user set it on purpose -- display options are deliberately not in
     * here, or a ticked "show club button" would flag a club-champion block
     * nobody ever meant to run.
     */
    options?: readonly string[];
}

/**
 * The state of one block.
 *
 * `isOn` returns `undefined` for a switch that is not in the DOM at all --
 * debug-only rows, or a switch a later version dropped. A block whose masters
 * are all missing is `none` rather than `off`, so the marker never claims a
 * capability the panel does not show. A missing *prerequisite* does not block:
 * a build without that row cannot have the user turn it on.
 */
export function blockState(def: BlockDef, isOn: (key: string) => boolean | undefined): BlockState {
    const present = def.masters.filter(key => isOn(key) !== undefined);
    if (present.length === 0) return 'none';

    const mastersOn = present.some(key => isOn(key) === true);
    const blocked = (def.requires ?? []).some(key => isOn(key) === false);
    if (mastersOn) return blocked ? 'conflict' : 'on';

    const configured = (def.options ?? []).some(key => isOn(key) === true);
    return configured ? 'conflict' : 'off';
}

export interface AreaCount {
    /** Blocks that run. */
    on: number;
    /** Blocks that can run at all -- `none` is not counted, neither number moves. */
    total: number;
    /** Blocks that are set up but will not run. */
    conflicts: number;
}

/** Roll one area's block states up into the numbers behind its badge. */
export function countBlocks(states: readonly BlockState[]): AreaCount {
    let on = 0;
    let total = 0;
    let conflicts = 0;
    for (const state of states) {
        if (state === 'none') continue;
        total++;
        if (state === 'on') on++;
        else if (state === 'conflict') conflicts++;
    }
    return { on, total, conflicts };
}

/**
 * The colour of the whole area, in the same vocabulary as a single block.
 *
 * A conflict wins over everything else: it is the only state that asks the user
 * to do something, and it has to be visible on the rail, or the point of having
 * it -- spotting the forgotten toggle without opening the area first -- is
 * lost. Otherwise anything running makes the area `on`; the count next to it
 * says how much.
 */
export function areaState(count: AreaCount): BlockState {
    if (count.total === 0) return 'none';
    if (count.conflicts > 0) return 'conflict';
    return count.on > 0 ? 'on' : 'off';
}

/** `2/6`, or an empty string for an area with nothing to count (e.g. Harem). */
export function formatBadge(count: AreaCount): string {
    return count.total === 0 ? '' : count.on + '/' + count.total;
}
