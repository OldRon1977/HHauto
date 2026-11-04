import { PassHelper } from '../../src/Helper/PassHelper';
import { RewardHelper } from '../../src/Helper/RewardHelper';
import { logHHAuto } from '../../src/Utils/LogUtils';

jest.mock("../../src/Utils/LogUtils", () => ({
    logHHAuto: jest.fn(),
}));

const win = unsafeWindow as unknown as Record<string, unknown>;
const GLOBALS = ['hero_has_mega_pass', 'owned_passes', 'season_has_pass', 'penta_drill_data', 'bonus_rewards_unlocked'];

describe("PassHelper.ownsPass", function () {
    afterEach(() => {
        document.body.innerHTML = '';
        GLOBALS.forEach(name => { delete win[name]; });
    });

    it("reads the game's global first, whatever the purchase element says", function () {
        document.body.innerHTML = '<button id="get_mega_pass_kobans_btn"></button>';
        win.hero_has_mega_pass = 1;
        expect(PassHelper.ownsPass('seasonalEvent')).toBe(true);
        document.body.innerHTML = '';
        win.hero_has_mega_pass = 0;
        expect(PassHelper.ownsPass('seasonalEvent')).toBe(false);
    });

    it("takes a boolean global as well as 0/1", function () {
        win.season_has_pass = true;
        expect(PassHelper.ownsPass('season')).toBe(true);
        win.season_has_pass = false;
        expect(PassHelper.ownsPass('season')).toBe(false);
    });

    it("reads a nested global", function () {
        win.penta_drill_data = { progression: { has_pass: 0 } };
        expect(PassHelper.ownsPass('pentaDrill')).toBe(false);
        win.penta_drill_data = { progression: { has_pass: 1 } };
        expect(PassHelper.ownsPass('pentaDrill')).toBe(true);
    });

    it("owns the PoV/PoG pass with either the pass or the pass+", function () {
        win.owned_passes = { pass: false, passplus: false };
        expect(PassHelper.ownsPass('potionsPath')).toBe(false);
        win.owned_passes = { pass: true, passplus: false };
        expect(PassHelper.ownsPass('potionsPath')).toBe(true);
        win.owned_passes = { pass: false, passplus: true };
        expect(PassHelper.ownsPass('potionsPath')).toBe(true);
    });

    it("without the global, a shown purchase element means no pass", function () {
        document.body.innerHTML = '<div id="gsp_btn_holder"></div>';
        expect(PassHelper.ownsPass('season')).toBe(false);
    });

    it("without the global, a hidden or missing purchase element means the pass", function () {
        document.body.innerHTML = '<div id="gsp_btn_holder" style="display: none;"></div>';
        expect(PassHelper.ownsPass('season')).toBe(true);
        document.body.innerHTML = '';
        expect(PassHelper.ownsPass('season')).toBe(true);
    });

    it("finds the PoA and DP blocker by its class", function () {
        document.body.innerHTML = '<div class="scroll-area poa"><div class="nc-poa-tape-blocker poa-event"></div></div>';
        expect(PassHelper.ownsPass('pathOfAttraction')).toBe(false);
        document.body.innerHTML = '<div id="dp-content"><div class="nc-poa-tape-blocker"></div></div>';
        expect(PassHelper.ownsPass('doublePenetration')).toBe(false);
        document.body.innerHTML = '<div id="dp-content"></div>';
        expect(PassHelper.ownsPass('doublePenetration')).toBe(true);
    });
});

describe("RewardHelper.pickTier", function () {
    const halves = { free: ".free.open .slot", paid: ".paid.open .slot" };
    function tier(free: string, paid: string[]): HTMLElement {
        const el = document.createElement('div');
        el.innerHTML = `<div class="free ${free ? "open" : ""}"><div class="slot slot_${free || "gems"}"></div></div>`
            + `<div class="paid open">${paid.map(t => `<div class="slot slot_${t}"></div>`).join("")}</div>`;
        return el;
    }
    beforeEach(() => (logHHAuto as jest.Mock).mockClear());

    it("takes a tier when every slot of every open half is on the list", function () {
        expect(RewardHelper.pickTier(tier("gems", ["orbs"]), halves, true, ["gems", "orbs"], false, "1")).toBe(true);
    });

    it("leaves it when one slot of an open half is not on the list", function () {
        expect(RewardHelper.pickTier(tier("gems", ["orbs"]), halves, true, ["gems"], false, "1")).toBe(false);
        expect(RewardHelper.pickTier(tier("gems", ["orbs", "scrolls_rare"]), halves, true, ["gems", "orbs"], false, "1")).toBe(false);
    });

    it("ignores the pass half without the pass", function () {
        expect(RewardHelper.pickTier(tier("gems", ["orbs"]), halves, false, ["gems"], false, "1")).toBe(true);
    });

    it("decides on the pass half alone once the free half is claimed", function () {
        expect(RewardHelper.pickTier(tier("", ["orbs"]), halves, true, ["orbs"], false, "1")).toBe(true);
        expect(RewardHelper.pickTier(tier("", ["orbs"]), halves, true, ["gems"], false, "1")).toBe(false);
    });

    it("leaves a tier with no open half it can read", function () {
        expect(RewardHelper.pickTier(tier("", ["orbs"]), halves, false, ["gems", "orbs"], false, "1")).toBe(false);
    });

    it("takes every tier when collecting all", function () {
        expect(RewardHelper.pickTier(tier("gems", ["orbs"]), halves, true, [], true, "1")).toBe(true);
    });
});
