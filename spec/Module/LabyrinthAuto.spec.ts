import { LabyrinthAuto } from "../../src/Module/LabyrinthAuto";
import { RewardHelper } from "../../src/Helper/RewardHelper";
import { MockHelper } from "../testHelpers/MockHelpers";
import { Labyrinth } from "../../src/Module/Labyrinth";
import { getSecondsLeft } from "../../src/Helper/TimerHelper";
import * as PageNavigationService from "../../src/Service/PageNavigationService";
import * as PageHelper from "../../src/Helper/PageHelper";
import { ConfigHelper } from "../../src/Helper/ConfigHelper";
import { HHStoredVarPrefixKey } from "../../src/config/HHStoredVars";
import { SK } from "../../src/config/StorageKeys";

describe("LabyrinthAuto.closeRewards relic-choice guard (issue #1716)", () => {
    beforeEach(() => {
        MockHelper.mockDomain();
        // closeRewardPopupIfAny uses :visible which jsdom cannot evaluate; mock it
        // and assert WHICH popup id closeRewards tries to close instead.
        jest.spyOn(RewardHelper, "closeRewardPopupIfAny").mockReturnValue(false);
    });
    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = "";
    });

    it("does not close labyrinth_reward_popup while a relic choice is pending", () => {
        document.body.innerHTML =
            '<div id="labyrinth_reward_popup"><div class="relic-container">'
            + '<div class="relic-card-buttons"><button class="claim-relic-btn blue_button_L" relic-id="a">Claim</button></div>'
            + '</div></div>';
        const result = new LabyrinthAuto().closeRewards();
        expect(result).toBe(false);
        expect(RewardHelper.closeRewardPopupIfAny).not.toHaveBeenCalledWith(true, "labyrinth_reward_popup");
    });

    it("still closes labyrinth_reward_popup for a non-relic (sweep) reward", () => {
        document.body.innerHTML =
            '<div id="labyrinth_reward_popup"><button class="blue_button_L">OK</button></div>';
        new LabyrinthAuto().closeRewards();
        expect(RewardHelper.closeRewardPopupIfAny).toHaveBeenCalledWith(true, "labyrinth_reward_popup");
    });
});

describe("LabyrinthAuto.pauseAfterRepeatedDraws (issue #1904)", () => {
    // The labyrinth page as measured on labyrinth.html: the chosen hex carries
    // the green arrow (.labChosen) inside its .clickable-hex, the power in
    // .opponent-power-text[data-power], and the squad health in girl_squad.
    const page = (power: number) => {
        document.body.innerHTML =
            '<div id="row_11" class="row-hex-container"><div id="hex_1" class="hex-container">'
            + '<div class="clickable-hex" rel="labyrinth_hex_enter" hex_id="1" hex_type="opponent_boss">'
            + '<img class="labChosen"></div>'
            + '<img class="hex-type opponent_boss" hex_id="1">'
            + `<div class="opponent-power"><div class="opponent-power-text" data-power="${power}"></div></div>`
            + '</div></div>';
    };
    const fight = () => {
        const paused = LabyrinthAuto.pauseAfterRepeatedDraws();
        if (!paused) LabyrinthAuto.markFightLaunched();
        return paused;
    };

    beforeEach(() => {
        MockHelper.mockDomain();
        sessionStorage.clear();
        localStorage.clear();
        unsafeWindow.girl_squad = [{ remaining_ego_percent: 100 }, { remaining_ego_percent: 80 }];
    });
    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = "";
        unsafeWindow.girl_squad = undefined;
    });

    it("pauses the labyrinth for an hour after three draws in a row", () => {
        page(16159915);
        expect(fight()).toBe(false); // first fight
        expect(fight()).toBe(false); // draw 1
        expect(fight()).toBe(false); // draw 2
        expect(fight()).toBe(true);  // draw 3 -> pause
        expect(getSecondsLeft('nextLabyrinthTime')).toBeGreaterThan(3500);
        expect(Labyrinth.isPausedForDraws()).toBe(true);
        expect(Labyrinth.getPinfo()).toContain('color:yellow');
    });

    it("shows the labyrinth row without colour while no draw pause runs", () => {
        page(16159915);
        fight();
        expect(Labyrinth.getPinfo()).not.toContain('color:');
    });

    it("does not count a revisit without a fight", () => {
        page(16159915);
        for (let i = 0; i < 5; i++) expect(LabyrinthAuto.pauseAfterRepeatedDraws()).toBe(false);
        expect(Labyrinth.readDrawState().draws).toBe(0);
    });

    it("starts again when the squad lost health (a loss)", () => {
        page(16159915);
        fight(); fight(); fight(); // two draws
        unsafeWindow.girl_squad = [{ remaining_ego_percent: 40 }, { remaining_ego_percent: 80 }];
        expect(fight()).toBe(false);
        expect(Labyrinth.readDrawState().draws).toBe(0);
    });

    it("starts again when the opponent's power dropped (a win)", () => {
        page(18861500);
        fight(); fight(); fight();
        page(16159915);
        expect(fight()).toBe(false);
        expect(Labyrinth.readDrawState().draws).toBe(0);
    });
});

describe("LabyrinthAuto.validateTeam (stuck team editor)", () => {
    const editor = (disabled: boolean) => {
        document.body.innerHTML =
            '<div class="player-panel"><div class="team-hexagon">'
            + [0, 1, 2, 3, 4, 5, 6].map(p => `<div class="team-member-container" data-team-member-position="${p}" data-girl-id="${100 + p}"></div>`).join('')
            + `</div></div><button id="validate-team"${disabled ? ' disabled' : ''}></button>`;
    };
    let now = 1_000_000;

    beforeEach(() => {
        MockHelper.mockDomain();
        sessionStorage.clear();
        localStorage.clear();
        LabyrinthAuto._resetEditorStateForTests();
        now = 1_000_000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        jest.spyOn(PageNavigationService, 'safeReload').mockReturnValue(true);
        jest.spyOn(PageNavigationService, 'gotoPage').mockReturnValue(true);
    });
    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = "";
    });

    it("presses an enabled Validate", () => {
        editor(false);
        const clicked = jest.fn();
        $('#validate-team').on('click', clicked);
        expect(LabyrinthAuto.validateTeam()).toBe(true);
        expect(clicked).toHaveBeenCalled();
    });

    it("waits while Validate is disabled for a few seconds (a save in flight)", () => {
        editor(true);
        expect(LabyrinthAuto.validateTeam()).toBe(true);
        now += 10_000;
        expect(LabyrinthAuto.validateTeam()).toBe(true);
        expect(PageNavigationService.safeReload).not.toHaveBeenCalled();
    });

    it("reloads the editor once, then pauses the labyrinth for 30 minutes", () => {
        editor(true);
        LabyrinthAuto.validateTeam();
        now += 16_000;
        expect(LabyrinthAuto.validateTeam()).toBe(true);
        expect(PageNavigationService.safeReload).toHaveBeenCalledTimes(1);

        // The reload brings a fresh page: its own clock starts again.
        LabyrinthAuto._resetEditorStateForTests();
        now += 5_000;
        LabyrinthAuto.validateTeam();
        now += 16_000;
        expect(LabyrinthAuto.validateTeam()).toBe(false);
        expect(PageNavigationService.safeReload).toHaveBeenCalledTimes(1);
        expect(PageNavigationService.gotoPage).toHaveBeenCalled();
        expect(getSecondsLeft('nextLabyrinthTime')).toBeGreaterThan(29 * 60);
    });
});

describe("LabyrinthAuto sweep under a slow server (#1915)", () => {
    let savedRects: typeof HTMLElement.prototype.getClientRects;

    beforeEach(() => {
        MockHelper.mockDomain();
        jest.useFakeTimers();
        // jsdom lays nothing out; jQuery's :visible needs a client rect.
        savedRects = HTMLElement.prototype.getClientRects;
        HTMLElement.prototype.getClientRects = function () { return [{}] as unknown as DOMRectList; };
        jest.spyOn(PageHelper, "getPage").mockReturnValue(ConfigHelper.getHHScriptVars("pagesIDLabyrinth"));
        jest.spyOn(Labyrinth, "getResetTime").mockReturnValue(3600);
        localStorage.setItem(HHStoredVarPrefixKey + SK.autoLabySweep, "true");
    });
    afterEach(() => {
        HTMLElement.prototype.getClientRects = savedRects;
        jest.useRealTimers();
        jest.restoreAllMocks();
        localStorage.clear();
        sessionStorage.clear();
        document.body.innerHTML = "";
    });

    it("confirms the sweep once its preview has opened late", async () => {
        // Measured with the server answering after 3 s: the confirm was looked
        // for after a fixed 1-1.5 s, the preview opened later and stayed open.
        document.body.innerHTML = '<div class="labChosen"></div><button id="sweeping-floor">Sweep</button>';
        let confirms = 0;
        $("#sweeping-floor").on("click", () => {
            setTimeout(() => {
                $("body").append('<div id="labyrinth_sweeping_preview_popup"><button id="popup_confirm" class="blue_button_L">OK</button></div>');
                $("#popup_confirm").on("click", () => {
                    confirms++;
                    $("#labyrinth_sweeping_preview_popup, #sweeping-floor").remove();
                    setTimeout(() => {
                        $("body").append('<div id="labyrinth_reward_popup"><button class="blue_button_L">OK</button></div>'
                            + '<div class="cleared-labyrinth-container"></div>');
                        $("#labyrinth_reward_popup button").on("click", () => $("#labyrinth_reward_popup").remove());
                    }, 3000);
                });
            }, 3000);
        });

        const done = new LabyrinthAuto().run();
        await jest.advanceTimersByTimeAsync(30_000);
        await done;

        expect(confirms).toBe(1);
        expect($("#labyrinth_reward_popup").length).toBe(0);
    });
});
