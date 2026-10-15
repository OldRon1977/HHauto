import { BossBang } from '../../../src/Module/Events/BossBang';
import * as PageNavigationService from '../../../src/Service/PageNavigationService';
import { HHStoredVarPrefixKey } from "../../../src/config/HHStoredVars";
import { SK, TK } from "../../../src/config/StorageKeys";
import { MockHelper } from "../../testHelpers/MockHelpers";

// The event page markup below follows the Boss Bang tab as the game serves it
// (measured 2026-10-15): empty slots link to the team page, built ones show
// the first girl and the ego bar, a tired one carries a tired-girl marker.
type Slot = 'empty' | 'ready' | 'tired';

function slotHtml(state: Slot, index: number): string {
    if (state === 'empty') {
        return `<div class="boss-bang-team-slot" data-slot-index="${index + 1}"><a href="/add-boss-bang-team.html"><i class="hudPlus_mix_icn"></i></a></div>`;
    }
    return `<div class="boss-bang-team-slot" data-slot-index="${index}">`
        + `<img class="boss-bang-team-first-girl legendary">`
        + (state === 'tired' ? `<div class="boss-bang-team-tired-girl"></div>` : ``)
        + `<div class="boss-bang-team-ego"><span>100.0%</span></div></div>`;
}

function eventPage(slots: Slot[], extra = '', claims = 0): void {
    const claimButtons = Array.from({ length: claims }, (_, i) =>
        `<button rel="claim" class="purple_button_L progress-bar-claim-reward" tier="${i + 1}">Claim</button>`).join('');
    document.body.innerHTML = `<div id="hh_hentai" page="event"></div>`
        + `<div id="contains_all"><div id="events"><div class="events-list">`
        + `<a class="event-title active" href="/event.html?tab=boss_bang_event_7">Boss Bang</a></div>`
        + `<div id="boss_bang">${claimButtons}`
        + `<a class="blue_button_L" id="start-bang-button" href="/boss-bang-battle.html?number_of_battles=1&amp;bb_team_index=0">Bang</a>`
        + `<div class="boss-bang-teams-container">${slots.map((s, i) => slotHtml(s, i)).join('')}</div>`
        + `${extra}</div></div></div>`;
    // The game's own slot handler (event bundle): a built, not tired slot
    // points the Bang button at its team.
    $('.boss-bang-team-slot').on('click', function () {
        const slot = $(this);
        if (slot.children('.boss-bang-team-first-girl').length && !slot.children('.boss-bang-team-tired-girl').length) {
            $('#start-bang-button').attr('href', '/boss-bang-battle.html?number_of_battles=1&bb_team_index=' + slot.data('slot-index'));
        }
    });
}

describe("BossBang", function () {
    // jsdom has no layout, so jQuery's :visible never matches there.
    const pseudos = ($.expr as unknown as { pseudos: Record<string, unknown> }).pseudos;
    const visible = pseudos.visible;
    beforeAll(() => {
        pseudos.visible = () => true;
    });
    afterAll(() => {
        pseudos.visible = visible;
    });

    beforeEach(() => {
        MockHelper.mockDomain();
        localStorage.setItem(HHStoredVarPrefixKey + SK.bossBangMinTeam, '5');
        sessionStorage.removeItem(HHStoredVarPrefixKey + TK.eventsList);
        sessionStorage.removeItem(HHStoredVarPrefixKey + TK.bossBangTeamBuild);
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("teamOrder", function () {
        it("goes down from team 5", function () {
            expect(BossBang.teamOrder(5)).toEqual([4, 3, 2, 1, 0]);
        });
        it("goes up from team 1", function () {
            expect(BossBang.teamOrder(1)).toEqual([0, 1, 2, 3, 4]);
        });
        it("goes down from a middle team, then on from the last one", function () {
            expect(BossBang.teamOrder(3)).toEqual([2, 1, 0, 4, 3]);
        });
        it("reads a missing or out-of-range setting as team 5", function () {
            expect(BossBang.teamOrder(NaN)).toEqual([4, 3, 2, 1, 0]);
            expect(BossBang.teamOrder(9)).toEqual([4, 3, 2, 1, 0]);
        });
    });

    describe("pickTeam", function () {
        it("takes the first team of the order that can fight", function () {
            eventPage(['ready', 'ready', 'ready', 'ready', 'tired']);
            expect(BossBang.pickTeam(5)).toBe(3);
            expect(BossBang.pickTeam(1)).toBe(0);
        });
        it("finds none when every team is tired", function () {
            eventPage(['tired', 'tired', 'tired', 'tired', 'tired']);
            expect(BossBang.pickTeam(5)).toBe(-1);
        });
    });

    describe("nextStep", function () {
        it("builds while a slot is empty", function () {
            eventPage(['ready', 'ready', 'empty', 'empty', 'empty']);
            expect(BossBang.nextStep()).toBe('build');
        });
        it("fights once the five teams stand", function () {
            eventPage(['ready', 'ready', 'ready', 'ready', 'ready']);
            expect(BossBang.nextStep()).toBe('fight');
        });
        it("claims a waiting chest before anything else", function () {
            eventPage(['ready', 'empty', 'empty', 'empty', 'empty'], '', 1);
            expect(BossBang.nextStep()).toBe('claim');
        });
        it("is done when every team is tired, without reviving one", function () {
            eventPage(['tired', 'tired', 'tired', 'tired', 'tired']);
            expect(BossBang.nextStep()).toBe('done');
        });
        it("is done at 100 potions once the chests are claimed", function () {
            document.body.innerHTML = `<div id="hh_hentai" page="event"></div><div id="contains_all"><div id="events"><div id="boss_bang">`
                + `<div class="boss-bang-event-info completed-event"><a class="blue_button_L">Go to Harem</a></div></div></div></div>`;
            expect(BossBang.nextStep()).toBe('done');
        });
        it("is blocked below the requirements", function () {
            document.body.innerHTML = `<div id="hh_hentai" page="event"></div><div id="contains_all"><div id="events"><div id="boss_bang">`
                + `<div class="boss-bang-row boss-bang-requirements-row"></div></div></div></div>`;
            expect(BossBang.nextStep()).toBe('blocked');
        });
    });

    describe("startFight", function () {
        it("selects the team the setting asks for and opens its battle", function () {
            const navigate = jest.spyOn(PageNavigationService, 'safeNavigateHref').mockReturnValue(true);
            eventPage(['ready', 'ready', 'ready', 'ready', 'ready']);
            expect(BossBang.startFight()).toBe(true);
            expect(navigate).toHaveBeenCalledWith(expect.stringContaining('bb_team_index=4'));
        });
        it("starts with team 1 when the setting says 1", function () {
            localStorage.setItem(HHStoredVarPrefixKey + SK.bossBangMinTeam, '1');
            const navigate = jest.spyOn(PageNavigationService, 'safeNavigateHref').mockReturnValue(true);
            eventPage(['ready', 'ready', 'ready', 'ready', 'ready']);
            BossBang.startFight();
            expect(navigate).toHaveBeenCalledWith(expect.stringContaining('bb_team_index=0'));
        });
    });

    describe("goToAddTeam", function () {
        it("opens the team page and remembers that the run opened it", function () {
            const navigate = jest.spyOn(PageNavigationService, 'safeNavigateHref').mockReturnValue(true);
            eventPage(['ready', 'empty', 'empty', 'empty', 'empty']);
            expect(BossBang.isBuildingTeam()).toBe(false);
            expect(BossBang.goToAddTeam()).toBe(true);
            expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/add-boss-bang-team.html'));
            expect(BossBang.isBuildingTeam()).toBe(true);
        });
    });

    describe("markCompleted", function () {
        it("records the event as finished, so the run does not come back", function () {
            BossBang.markCompleted('boss_bang_event_7');
            expect(BossBang.isMarkedCompleted('boss_bang_event_7')).toBe(true);
        });
    });
});
