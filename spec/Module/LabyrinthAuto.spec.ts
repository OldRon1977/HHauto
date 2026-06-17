import { LabyrinthAuto } from "../../src/Module/LabyrinthAuto";
import { RewardHelper } from "../../src/Helper/RewardHelper";
import { MockHelper } from "../testHelpers/MockHelpers";

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
