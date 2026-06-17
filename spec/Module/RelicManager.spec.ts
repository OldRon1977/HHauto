import { QuestHelper } from "../../src/Module/Quest";
import { LabyrinthRelic, RelicManager } from "../../src/Module/RelicManager";
import { RewardHelper } from "../../src/Helper/RewardHelper";
import { TimeHelper } from "../../src/Helper/TimeHelper";
import { MockHelper } from "../testHelpers/MockHelpers";

describe("RelicManager", function () {

    beforeEach(() => {
        MockHelper.mockDomain();
        MockHelper.mockHeroLevel(0);
    });

    const MYTHIC_RELIC = new LabyrinthRelic(1, $('<div class="mythic-relic"/>'));
    const LEGENDARY_RELIC = new LabyrinthRelic(1, $('<div class="legendary-relic"/>'));
    const EPIC_RELIC = new LabyrinthRelic(1, $('<div class="epic-relic"/>'));
    const RARE_RELIC = new LabyrinthRelic(1, $('<div class="rare-relic"/>'));
    const COMMON_RELIC = new LabyrinthRelic(1, $('<div class="common-relic"/>'));

    const MYTHIC_RELIC_GIRL = new LabyrinthRelic(1, $('<div class="mythic-relic large-card"/>'));
    const LEGENDARY_RELIC_GIRL = new LabyrinthRelic(1, $('<div class="legendary-relic large-card"/>'));
    const EPIC_RELIC_GIRL = new LabyrinthRelic(1, $('<div class="epic-relic large-card"/>'));
    const RARE_RELIC_GIRL = new LabyrinthRelic(1, $('<div class="rare-relic large-card"/>'));
    const COMMON_RELIC_GIRL = new LabyrinthRelic(1, $('<div class="common-relic large-card"/>'));

    const MYTHIC_RELIC_ELEMENT = new LabyrinthRelic(1, $('<div class="mythic-relic large-card"><div class="team-relic-icon"><div class="toto_element_relic_icn" /></div>'));
    const LEGENDARY_RELIC_ELEMENT = new LabyrinthRelic(1, $('<div class="legendary-relic large-card"><div class="team-relic-icon"><div class="toto_element_relic_icn" /></div>'));
    const EPIC_RELIC_ELEMENT = new LabyrinthRelic(1, $('<div class="epic-relic large-card"><div class="team-relic-icon"><div class="toto_element_relic_icn" /></div>'));
    const RARE_RELIC_ELEMENT = new LabyrinthRelic(1, $('<div class="rare-relic large-card"><div class="team-relic-icon"><div class="toto_element_relic_icn" /></div>'));
    const COMMON_RELIC_ELEMENT = new LabyrinthRelic(1, $('<div class="common-relic large-card"><div class="team-relic-icon"><div class="toto_element_relic_icn" /></div>'));

    describe("relic chose best no girl", function () {
        let relicManager: RelicManager;

        beforeEach(() => {
            relicManager = new RelicManager();
        });

        it("default", function () {
            expect(relicManager.chooseRelic([])).toBeUndefined();
        });

        it("relic constructor", function () {
            expect(COMMON_RELIC.type).toBe(1);
            expect(RARE_RELIC.type).toBe(2);
            expect(EPIC_RELIC.type).toBe(3);
            expect(LEGENDARY_RELIC.type).toBe(4);
            expect(MYTHIC_RELIC.type).toBe(5);
        });

        it("All common", function () {
            expect(relicManager.chooseRelic([COMMON_RELIC, COMMON_RELIC, COMMON_RELIC])).toBe(COMMON_RELIC);
        });

        it("one Rare", function () {
            expect(relicManager.chooseRelic([COMMON_RELIC, RARE_RELIC, COMMON_RELIC])).toBe(RARE_RELIC);
            expect(relicManager.chooseRelic([COMMON_RELIC, COMMON_RELIC, RARE_RELIC])).toBe(RARE_RELIC);
            expect(relicManager.chooseRelic([RARE_RELIC, COMMON_RELIC, COMMON_RELIC])).toBe(RARE_RELIC);
        });

        it("one legendary", function () {
            expect(relicManager.chooseRelic([COMMON_RELIC, LEGENDARY_RELIC, COMMON_RELIC])).toBe(LEGENDARY_RELIC);
            expect(relicManager.chooseRelic([COMMON_RELIC, COMMON_RELIC, LEGENDARY_RELIC])).toBe(LEGENDARY_RELIC);
            expect(relicManager.chooseRelic([RARE_RELIC, COMMON_RELIC, LEGENDARY_RELIC])).toBe(LEGENDARY_RELIC);
        });

        it("one mythic", function () {
            expect(relicManager.chooseRelic([COMMON_RELIC, COMMON_RELIC, MYTHIC_RELIC])).toBe(MYTHIC_RELIC);
            expect(relicManager.chooseRelic([MYTHIC_RELIC, COMMON_RELIC, COMMON_RELIC])).toBe(MYTHIC_RELIC);
            expect(relicManager.chooseRelic([MYTHIC_RELIC, EPIC_RELIC, EPIC_RELIC])).toBe(MYTHIC_RELIC);
            expect(relicManager.chooseRelic([MYTHIC_RELIC, LEGENDARY_RELIC, LEGENDARY_RELIC])).toBe(MYTHIC_RELIC);
            expect(relicManager.chooseRelic([COMMON_RELIC, RARE_RELIC, EPIC_RELIC, LEGENDARY_RELIC, MYTHIC_RELIC])).toBe(MYTHIC_RELIC);
        });
    });

    describe("relic chose best only girl", function () {
        let relicManager: RelicManager;

        beforeEach(() => {
            relicManager = new RelicManager();
        });

        it("relic constructor", function () {
            expect(COMMON_RELIC_GIRL.type).toBe(1);
            expect(COMMON_RELIC_GIRL.isGirl).toBeTruthy();
            expect(RARE_RELIC_GIRL.type).toBe(2);
            expect(RARE_RELIC_GIRL.isGirl).toBeTruthy();
            expect(EPIC_RELIC_GIRL.type).toBe(3);
            expect(EPIC_RELIC_GIRL.isGirl).toBeTruthy();
            expect(LEGENDARY_RELIC_GIRL.type).toBe(4);
            expect(LEGENDARY_RELIC_GIRL.isGirl).toBeTruthy();
            expect(MYTHIC_RELIC_GIRL.type).toBe(5);
            expect(MYTHIC_RELIC_GIRL.isGirl).toBeTruthy();
        });

        it("All common girl", function () {
            expect(relicManager.chooseRelic([COMMON_RELIC_GIRL, COMMON_RELIC_GIRL, COMMON_RELIC_GIRL])).toBe(COMMON_RELIC_GIRL);
        });

        it("one rare", function () {
            expect(relicManager.chooseRelic([COMMON_RELIC_GIRL, COMMON_RELIC_GIRL, RARE_RELIC_GIRL])).toBe(RARE_RELIC_GIRL);
            expect(relicManager.chooseRelic([COMMON_RELIC_GIRL, RARE_RELIC_GIRL, COMMON_RELIC_GIRL])).toBe(RARE_RELIC_GIRL);
            expect(relicManager.chooseRelic([RARE_RELIC_GIRL, COMMON_RELIC_GIRL, COMMON_RELIC_GIRL])).toBe(RARE_RELIC_GIRL);
        });

        it("one mythic", function () {
            expect(relicManager.chooseRelic([COMMON_RELIC_GIRL, COMMON_RELIC_GIRL, MYTHIC_RELIC_GIRL])).toBe(MYTHIC_RELIC_GIRL);
            expect(relicManager.chooseRelic([MYTHIC_RELIC_GIRL, COMMON_RELIC_GIRL, COMMON_RELIC_GIRL])).toBe(MYTHIC_RELIC_GIRL);
            expect(relicManager.chooseRelic([MYTHIC_RELIC_GIRL, EPIC_RELIC_GIRL, EPIC_RELIC_GIRL])).toBe(MYTHIC_RELIC_GIRL);
            expect(relicManager.chooseRelic([MYTHIC_RELIC_GIRL, LEGENDARY_RELIC_GIRL, LEGENDARY_RELIC_GIRL])).toBe(MYTHIC_RELIC_GIRL);
            expect(relicManager.chooseRelic([COMMON_RELIC_GIRL, RARE_RELIC_GIRL, EPIC_RELIC_GIRL, LEGENDARY_RELIC_GIRL, MYTHIC_RELIC_GIRL])).toBe(MYTHIC_RELIC_GIRL);
        });
    });

    describe("relic chose best mix with girl", function () {
        let relicManager: RelicManager;

        beforeEach(() => {
            relicManager = new RelicManager();
        });

        it("All common girl", function () {
            expect(relicManager.chooseRelic([COMMON_RELIC_GIRL, COMMON_RELIC_GIRL, COMMON_RELIC_GIRL])).toBe(COMMON_RELIC_GIRL);
        });

        it("one rare and girls", function () {
            expect(relicManager.chooseRelic([COMMON_RELIC, COMMON_RELIC_GIRL, RARE_RELIC])).toBe(RARE_RELIC);
            expect(relicManager.chooseRelic([COMMON_RELIC_GIRL, COMMON_RELIC, RARE_RELIC])).toBe(RARE_RELIC);
            expect(relicManager.chooseRelic([COMMON_RELIC_GIRL, COMMON_RELIC, RARE_RELIC])).toBe(RARE_RELIC);
            expect(relicManager.chooseRelic([COMMON_RELIC_GIRL, COMMON_RELIC, RARE_RELIC])).toBe(RARE_RELIC);
        });

        it("one rare and mythics girls", function () {
            expect(relicManager.chooseRelic([COMMON_RELIC, MYTHIC_RELIC_GIRL, MYTHIC_RELIC_GIRL])).toBe(COMMON_RELIC);
            expect(relicManager.chooseRelic([MYTHIC_RELIC_GIRL, MYTHIC_RELIC_GIRL, RARE_RELIC])).toBe(RARE_RELIC);
            expect(relicManager.chooseRelic([MYTHIC_RELIC_GIRL, RARE_RELIC, MYTHIC_RELIC_GIRL])).toBe(RARE_RELIC);
            expect(relicManager.chooseRelic([RARE_RELIC, MYTHIC_RELIC_GIRL, MYTHIC_RELIC_GIRL])).toBe(RARE_RELIC);
        });
    });

    describe("relic chose best element", function () {
        let relicManager: RelicManager;

        beforeEach(() => {
            relicManager = new RelicManager();
        });

        it("default", function () {
            expect(COMMON_RELIC_ELEMENT.element).toBe('toto');
            expect(RARE_RELIC_ELEMENT.element).toBe('toto');
            expect(EPIC_RELIC_ELEMENT.element).toBe('toto');
            expect(LEGENDARY_RELIC_ELEMENT.element).toBe('toto');
            expect(MYTHIC_RELIC_ELEMENT.element).toBe('toto');
        });

        it("All common element", function () {
            expect(relicManager.chooseRelic([COMMON_RELIC_ELEMENT, COMMON_RELIC_ELEMENT, COMMON_RELIC_ELEMENT])).toBe(COMMON_RELIC_ELEMENT);
        });

        it("one rare element", function () {
            expect(relicManager.chooseRelic([COMMON_RELIC_ELEMENT, RARE_RELIC_ELEMENT, COMMON_RELIC_ELEMENT])).toBe(RARE_RELIC_ELEMENT);
        });

        it("one mythic", function () {
            expect(relicManager.chooseRelic([COMMON_RELIC_ELEMENT, COMMON_RELIC_ELEMENT, MYTHIC_RELIC_ELEMENT])).toBe(MYTHIC_RELIC_ELEMENT);
            expect(relicManager.chooseRelic([MYTHIC_RELIC_ELEMENT, COMMON_RELIC_ELEMENT, COMMON_RELIC_ELEMENT])).toBe(MYTHIC_RELIC_ELEMENT);
            expect(relicManager.chooseRelic([MYTHIC_RELIC_ELEMENT, EPIC_RELIC_ELEMENT, EPIC_RELIC_ELEMENT])).toBe(MYTHIC_RELIC_ELEMENT);
            expect(relicManager.chooseRelic([MYTHIC_RELIC_ELEMENT, LEGENDARY_RELIC_ELEMENT, LEGENDARY_RELIC_ELEMENT])).toBe(MYTHIC_RELIC_ELEMENT);
            expect(relicManager.chooseRelic([COMMON_RELIC_ELEMENT, RARE_RELIC_ELEMENT, EPIC_RELIC_ELEMENT, LEGENDARY_RELIC_ELEMENT, MYTHIC_RELIC_ELEMENT])).toBe(MYTHIC_RELIC_ELEMENT);
        });
    });

    describe("relic chose best mix of all", function () {
        let relicManager: RelicManager;

        beforeEach(() => {
            relicManager = new RelicManager();
        });

        it("Only common", function () {
            expect(relicManager.chooseRelic([COMMON_RELIC, COMMON_RELIC_ELEMENT, COMMON_RELIC_GIRL])).toBe(COMMON_RELIC);
            expect(relicManager.chooseRelic([RARE_RELIC, COMMON_RELIC_ELEMENT, COMMON_RELIC_GIRL])).toBe(RARE_RELIC);
        });

        it("rare girls and elements", function () {
            expect(relicManager.chooseRelic([RARE_RELIC, RARE_RELIC_GIRL, RARE_RELIC_ELEMENT])).toBe(RARE_RELIC);
            expect(relicManager.chooseRelic([RARE_RELIC_GIRL, RARE_RELIC_GIRL, RARE_RELIC_ELEMENT])).toBe(RARE_RELIC_ELEMENT);
            expect(relicManager.chooseRelic([RARE_RELIC_GIRL, RARE_RELIC_ELEMENT, RARE_RELIC_GIRL])).toBe(RARE_RELIC_ELEMENT);
            expect(relicManager.chooseRelic([RARE_RELIC_ELEMENT, RARE_RELIC_GIRL, RARE_RELIC_GIRL])).toBe(RARE_RELIC_ELEMENT);
        });
    });

    describe("selectRelic clicks the marked card (issue #1716)", function () {
        beforeEach(() => {
            jest.spyOn(TimeHelper, "sleep").mockResolvedValue(undefined as never);
            jest.spyOn(RewardHelper, "closeRewardPopupIfAny").mockReturnValue(true);
        });
        afterEach(() => jest.restoreAllMocks());

        function buildPopup(markedIndex: number) {
            const cards = [0, 1, 2].map(i =>
                `<div class="relic-container common-relic">`
                + `<div class="relic-card-buttons"><button class="claim-relic-btn" relic-id="id-${i}">Claim</button></div>`
                + (i === markedIndex ? `<img class="relicChosen">` : ``)
                + `</div>`).join("");
            document.body.innerHTML =
                `<div id="labyrinth_reward_popup"><div id="reward_holder"><div class="cards-container">${cards}</div></div></div>`;
        }

        function captureClicks(): string[] {
            const clicked: string[] = [];
            $("#labyrinth_reward_popup .claim-relic-btn").each(function () {
                const id = this.getAttribute("relic-id");
                $(this).on("click", () => clicked.push(id as string));
            });
            return clicked;
        }

        it("clicks the third card when the green arrow is on the third", async () => {
            buildPopup(2);
            const clicked = captureClicks();
            await new RelicManager().selectRelic();
            expect(clicked).toEqual(["id-2"]);
        });

        it("clicks the middle card when the green arrow is on the middle", async () => {
            buildPopup(1);
            const clicked = captureClicks();
            await new RelicManager().selectRelic();
            expect(clicked).toEqual(["id-1"]);
        });

        it("falls back to chooseRelic and claims the best card when no marker is set yet", async () => {
            // Production path on the Labyrinth tick: selectRelic runs before
            // Labyrinth.sim sets .relicChosen, so no marker exists. The fallback
            // must claim the chooseRelic winner (the mythic), not the leftmost.
            document.body.innerHTML =
                `<div id="labyrinth_reward_popup"><div id="reward_holder"><div class="cards-container">`
                + `<div class="relic-container common-relic"><div class="relic-card-buttons"><button class="claim-relic-btn" relic-id="id-0">Claim</button></div></div>`
                + `<div class="relic-container mythic-relic"><div class="relic-card-buttons"><button class="claim-relic-btn" relic-id="id-1">Claim</button></div></div>`
                + `<div class="relic-container common-relic"><div class="relic-card-buttons"><button class="claim-relic-btn" relic-id="id-2">Claim</button></div></div>`
                + `</div></div></div>`;
            const clicked = captureClicks();
            await new RelicManager().selectRelic();
            expect(clicked).toEqual(["id-1"]);
        });
    });

});