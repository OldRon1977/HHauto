// PassHelper.ts -- whether the player owns the pass of a reward track, and
// which slots of a tier are still to claim.
//
// Reward tracks with a pass: a free row and a pass row. Every track
// reads pass ownership the same way and names its open halves with one
// selector pair, used both for the rewards recap and for picking tiers.
//
// The pass row's state class cannot stand for ownership: measured on the
// test account without any pass, the pass half reads "claimable" on the
// Seasonal event (paid-unclaimed), the Season and Penta Drill
// (reward_is_claimable); only PoV/PoG lock it (paid-locked). So a pass half
// counts as open only when the pass is owned AND its state says open.
//
// Ownership comes from the game's own global (measured on the test
// account: hero_has_mega_pass 0, owned_passes {pass,passplus} false,
// season_has_pass false, penta_drill_data.progression.has_pass 0). Only
// where it is missing does the purchase element decide: the game renders
// it only while the pass is not owned (seasonal.js, season.js,
// penta_drill.js, the PoA chunk), and after a purchase on the page it
// hides or removes it -- so absent means owned, and a hidden one does not
// count. PoA's bonus_rewards_unlocked is read from the game's script, not
// measured (no PoA ran). Double Penetration has no global of its own in
// the game's script that could be checked, so only its blocker decides.
// The PoA/DP blocker is a class (nc-poa-tape-blocker); no element carries
// it as an id.
//
// Depends on: HHHelper (the game's globals)
// Used by: RewardHelper, Seasonal, PathOfValue, PathOfGlory, Season,
//          PentaDrill, PathOfAttraction, DoublePenetration, EventModule
import { getHHVars } from "./HHHelper";

export class PassHelper {
    static readonly PASS_SOURCES = {
        seasonalEvent:     { globals: ['hero_has_mega_pass'], purchase: '#get_mega_pass_kobans_btn' },
        potionsPath:       { globals: ['owned_passes.pass', 'owned_passes.passplus'], purchase: '.potions-paths-second-row .purchase-pass' },
        season:            { globals: ['season_has_pass'], purchase: '#gsp_btn_holder' },
        pentaDrill:        { globals: ['penta_drill_data.progression.has_pass'], purchase: '#get_penta_pass_btn' },
        pathOfAttraction:  { globals: ['bonus_rewards_unlocked'], purchase: '.scroll-area.poa .nc-poa-tape-blocker' },
        doublePenetration: { globals: [] as string[], purchase: '#dp-content .nc-poa-tape-blocker' },
    } as const;

    // Slots of the halves still to claim, inside one tier. The pass half
    // still needs ownsPass() on top (see above). Double Penetration: its
    // claimed-state classes are not in any script the game served while no
    // DP event ran, so its halves carry no state filter.
    static readonly TRACK_HALVES = {
        seasonalEvent: { free: ".free-slot:not(.claimed-slot) .slot", paid: ".pass-slot.paid-unclaimed .slot" },
        potionsPath: {
            free: ".free-slot:not(.claimed-slot) .slot,.free-slot:not(.claimed-slot) .shards_girl_ico",
            paid: ".paid-slots.paid-unclaimed .slot,.paid-slots.paid-unclaimed .shards_girl_ico",
        },
        pentaDrill: { free: ".free_reward.reward_is_claimable .slot", paid: ".pass_reward.reward_is_claimable .slot" },
        season: { free: ".free_reward.reward_is_claimable .slot", paid: ".pass_reward.reward_is_claimable .slot" },
        doublePenetration: { free: ".free-slot .slot,.free-slot .slot_girl_shards", paid: ".paid-slot .slot,.paid-slot .slot_girl_shards" },
    } as const;

    static ownsPass(source: keyof typeof PassHelper.PASS_SOURCES): boolean {
        const { globals, purchase } = PassHelper.PASS_SOURCES[source];
        let known = false;
        for (const name of globals) {
            const value = getHHVars(name, false);
            if (value === null || value === undefined) continue;
            known = true;
            if (value === true || Number(value) === 1) return true;
        }
        if (known) return false;
        // The game hides it with .hide(), an inline display:none.
        return $(purchase).filter((_, e) => (e as HTMLElement).style.display !== 'none').length === 0;
    }
}
