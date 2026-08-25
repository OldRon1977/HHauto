// GirlSkins.pure.ts
//
// "Does this event girl still have a skin to win?" -- the question that decides
// whether the script keeps fighting a villain for a girl it already owns
// (#1842). Pure and dependency-free so it can be unit-tested without the game.
//
// Measured on a live mythic event (event.html?tab=mythic_event_528, girl fully
// owned with shards=100): the game ships the answer with the girl.
//
//   girl.preview.grade_skins_data = [{
//       id_girl_grade_skin: 305, grade_skin_name: "White Dominatrix Ananke",
//       is_released: true, is_owned: false, shards_count: 0, is_selected: false }]
//
// `is_owned` is the event-side equivalent of LoveRaid.skin_to_win, which is why
// the raid path could already do this and the event paths could not. The "0/33"
// the game draws is `shards_count` against a target that is NOT in the payload
// -- and is not needed: is_owned answers it outright.
//
// Unreleased skins are ignored: a skin the game has not published yet cannot be
// farmed, and treating it as outstanding would keep the script fighting for
// something nobody can win.

/** One entry of `girl.preview.grade_skins_data`, as the game sends it. */
export interface GradeSkin {
    is_released?: boolean;
    is_owned?: boolean;
    shards_count?: number;
    grade_skin_name?: string;
}

/** The part of an event girl this question needs. Loose on purpose: the raw
 *  game object carries ~60 fields and is typed as a bag elsewhere. */
export interface GirlWithSkins {
    preview?: { grade_skins_data?: GradeSkin[] } | null;
}

/**
 * Whether a released skin of this girl is still unowned.
 *
 * Absent data reads as "nothing to win" -- an event without skins, or a build
 * of the game that does not send them, must not turn into endless fighting.
 */
export function hasSkinToWin(girl: GirlWithSkins | null | undefined): boolean {
    const skins = girl?.preview?.grade_skins_data;
    if (!Array.isArray(skins)) return false;
    return skins.some(skin => skin?.is_released === true && skin?.is_owned !== true);
}

/**
 * Whether this girl is still worth fighting for.
 *
 * Shards below 100 means the girl herself is not won yet. Above that it is only
 * worth it when the user asked for skins AND one is actually outstanding.
 */
export function isStillWorthFighting(
    shards: number,
    wantsSkins: boolean,
    girl: GirlWithSkins | null | undefined,
): boolean {
    return shards < 100 || (wantsSkins && hasSkinToWin(girl));
}

/** One entry of `rewards.data.shards` in a battle response. */
export interface ShardDrop {
    previous_value?: number;
    value?: number;
}

/**
 * The girl's new shard total after a fight, or null when the response says
 * nothing about her (#1843).
 *
 * A response can carry several shard entries -- a normal event girl and a
 * mythic one drop in the same batch. Attribution is by the value the girl had
 * before the fight: the entry whose `previous_value` matches is hers. With a
 * single entry and no match we take it anyway, which is the ordinary case of
 * one girl and a stale stored count.
 */
export function shardTotalAfterFight(
    drops: readonly ShardDrop[] | null | undefined,
    shardsBefore: number,
): number | null {
    if (!Array.isArray(drops) || drops.length === 0) return null;
    const matched = drops.find(d => d?.previous_value === shardsBefore);
    const entry = matched ?? (drops.length === 1 ? drops[0] : undefined);
    const value = entry?.value;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Whether the only thing left to win here is a skin: the girl is complete and
 * the user asked to keep going for skins.
 *
 * This is the state in which the fighting continues but the Sandalwood
 * automation must not put a fresh perfume on -- that is what the separate
 * switch in "Shards & skins" is for (#1843).
 */
export function isSkinPhase(shards: number, wantsSkins: boolean): boolean {
    return shards >= 100 && wantsSkins;
}
