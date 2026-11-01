import { RewardHelper } from "../../src/Helper/RewardHelper";

// Holds what closing the game's reward popup does today: which button is
// clicked, when the girl variant takes over, and what is returned.
describe("closing the reward popup", () => {
    // jsdom has no layout, so jQuery's :visible never matches there.
    const pseudos = ($.expr as unknown as { pseudos: Record<string, unknown> }).pseudos;
    const visible = pseudos.visible;
    beforeAll(() => { pseudos.visible = () => true; });
    afterAll(() => { pseudos.visible = visible; });
    afterEach(() => { document.body.innerHTML = ''; });

    function popup(id: string, buttons: string): { clicks: string[] } {
        document.body.innerHTML = `<div id="${id}">${buttons}</div>`;
        const clicks: string[] = [];
        $(`#${id} button`).each((_i, b) => { $(b).on('click', () => clicks.push(b.id || b.className)); });
        return { clicks };
    }

    it("clicks the enabled blue button of #rewards_popup and returns true", () => {
        const p = popup('rewards_popup', '<button id="ok" class="blue_button_L">OK</button>');
        expect(RewardHelper.closeRewardPopupIfAny()).toBe(true);
        expect(p.clicks).toEqual(['ok']);
    });

    it("clicks every matching blue button, not just the first", () => {
        const p = popup('rewards_popup', '<button id="a" class="blue_button_L"></button><button id="b" class="blue_button_L"></button>');
        expect(RewardHelper.closeRewardPopupIfAny(false)).toBe(true);
        expect(p.clicks).toEqual(['a', 'b']);
    });

    it("ignores a disabled button and returns false", () => {
        const p = popup('rewards_popup', '<button id="ok" class="blue_button_L" disabled></button>');
        expect(RewardHelper.closeRewardPopupIfAny()).toBe(false);
        expect(p.clicks).toEqual([]);
    });

    it("returns false without a popup", () => {
        expect(RewardHelper.closeRewardPopupIfAny()).toBe(false);
    });

    it("reads the popup id it is given", () => {
        const p = popup('labyrinth_reward_popup', '<button id="ok" class="blue_button_L"></button>');
        expect(RewardHelper.closeRewardPopupIfAny(true)).toBe(false);
        expect(RewardHelper.closeRewardPopupIfAny(true, 'labyrinth_reward_popup')).toBe(true);
        expect(p.clicks).toEqual(['ok']);
    });

    it("a blue redirect-to-harem button hands over to the purple one", () => {
        const p = popup('rewards_popup', '<button id="redirect-to-harem" class="blue_button_L"></button><button id="girl" class="purple_button_L"></button>');
        expect(RewardHelper.closeRewardPopupIfAny()).toBe(true);
        expect(p.clicks).toEqual(['girl']);
    });

    it("redirect-to-harem without a purple button returns false and clicks nothing", () => {
        const p = popup('rewards_popup', '<button id="redirect-to-harem" class="blue_button_L"></button>');
        expect(RewardHelper.closeRewardPopupIfAny()).toBe(false);
        expect(p.clicks).toEqual([]);
    });

    it("closeGirlRewardPopupIfAny clicks the purple button", () => {
        const p = popup('rewards_popup', '<button id="girl" class="purple_button_L"></button><button id="ok" class="blue_button_L"></button>');
        expect(RewardHelper.closeGirlRewardPopupIfAny()).toBe(true);
        expect(p.clicks).toEqual(['girl']);
    });
});
