import { RewardHelper } from "../../src/Helper/RewardHelper";
import * as AjaxTracker from "../../src/Service/AjaxTracker";

jest.mock("../../src/Utils/LogUtils", () => ({
    logHHAuto: jest.fn(),
}));

/**
 * #1931: the Seasonal event and Penta Drill looked for the reward popup at a
 * fixed 300-500 ms after each claim. On a slow server the popup came later,
 * the look found nothing, and the popup of the last claim stayed over the
 * page. claimInTurn waits for the claim's answer, then for the popup, and
 * closes it before the next claim.
 */
describe("RewardHelper.claimInTurn", () => {
    // jsdom has no layout, so jQuery's :visible never matches there.
    const pseudos = ($.expr as unknown as { pseudos: Record<string, unknown> }).pseudos;
    const visible = pseudos.visible;
    beforeAll(() => { pseudos.visible = () => true; });
    afterAll(() => { pseudos.visible = visible; });
    afterEach(() => {
        document.body.innerHTML = '';
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    /** A tier button whose claim the server answers after answerMs, with a popup 40 ms later. */
    function slowTiers(count: number, answerMs: number) {
        const log: string[] = [];
        let pending = false;
        const buttons = Array.from({ length: count }, (_v, i) => {
            const b = document.createElement('button');
            b.setAttribute('tier', String(i + 1));
            b.addEventListener('click', () => {
                if (pending || document.getElementById('rewards_popup')) { log.push(`ignored ${i + 1}`); return; }
                pending = true;
                log.push(`claim ${i + 1}`);
                setTimeout(() => {
                    pending = false;
                    setTimeout(() => {
                        const popup = document.createElement('div');
                        popup.id = 'rewards_popup';
                        popup.innerHTML = '<button class="blue_button_L">OK</button>';
                        popup.querySelector('button')!.addEventListener('click', () => {
                            log.push(`close ${i + 1}`);
                            popup.remove();
                        });
                        document.body.appendChild(popup);
                    }, 40);
                }, answerMs);
            });
            return b;
        });
        jest.spyOn(AjaxTracker, 'waitForGameAnswer').mockImplementation(async () => {
            while (pending) await new Promise(r => setTimeout(r, 50));
            return true;
        });
        return { buttons, log };
    }

    it("closes each popup before the next claim, the last one included", async () => {
        jest.useFakeTimers();
        const { buttons, log } = slowTiers(3, 3000);
        const done = jest.fn();

        RewardHelper.claimInTurn(buttons, done);
        await jest.advanceTimersByTimeAsync(20_000);

        expect(log).toEqual(['claim 1', 'close 1', 'claim 2', 'close 2', 'claim 3', 'close 3']);
        expect(document.getElementById('rewards_popup')).toBeNull();
        expect(done).toHaveBeenCalledTimes(1);
    });

    it("goes on after a claim that brings no popup", async () => {
        jest.useFakeTimers();
        const buttons = [1, 2].map((tier) => {
            const b = document.createElement('button');
            b.setAttribute('tier', String(tier));
            return b;
        });
        const clicks: string[] = [];
        buttons.forEach(b => b.addEventListener('click', () => clicks.push(b.getAttribute('tier')!)));
        jest.spyOn(AjaxTracker, 'waitForGameAnswer').mockResolvedValue(true);
        const done = jest.fn();

        RewardHelper.claimInTurn(buttons, done);
        await jest.advanceTimersByTimeAsync(10_000);

        expect(clicks).toEqual(['1', '2']);
        expect(done).toHaveBeenCalledTimes(1);
    });
});
