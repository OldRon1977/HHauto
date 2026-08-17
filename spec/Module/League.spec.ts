import { LeagueHelper } from "../../src/Module/League";
import { MockHelper } from "../testHelpers/MockHelpers";

/**
 * Spec triage (2026-08): the styles smoke, the getEnergy/getEnergyMax
 * pass-throughs and the isEnabled level gate were removed -- they asserted
 * the values the mock had just put in place. The nine isTimeToFight tests
 * were removed too: League.pure.spec covers the same scenarios without
 * spying on LeagueHelper's own statics, plus the humanLikeRun and
 * zero-energy-paranoia cases these could not reach.
 *
 * What remains is the UI injection, which is where League.ts still owns
 * behaviour of its own. Note that the DOM below is built by this file, so
 * these tests pin the placement rules, not the game's markup -- whether
 * #leagues and .league_content still exist is a live question.
 */
describe("League", function () {

    beforeEach(() => {
        MockHelper.mockDomain();
        MockHelper.mockHeroLevel(0);
    });

    describe("DOM injection anchors", function () {
        beforeEach(() => {
            document.body.innerHTML =
                '<div id="leagues">' +
                '<h3 class="page-title"></h3>' +
                '<div class="league_content hidden_girl">' +
                '<div class="league_table hh-scroll"><div class="data-list"></div></div>' +
                '</div>' +
                '</div>';
        });

        describe("moduleSimLeagueHideBeatenOppo", function () {
            it("mounts the header script container inside .league_content, above the opponent table", function () {
                LeagueHelper.moduleSimLeagueHideBeatenOppo();

                const header = document.querySelector(".league_content > .leagues_middle_header_script");
                expect(header).not.toBeNull();
                // Must land ahead of .league_table so the header renders
                // above the opponent list rather than inside its scroll area.
                expect(header!.nextElementSibling).toBe(document.querySelector(".league_table"));
                expect(document.getElementById("HideBeatenOppo")).not.toBeNull();
            });

            it("does not inject when the HH OCD script already added its beaten-opponents button", function () {
                document.getElementById("leagues")!.insertAdjacentHTML("beforeend", '<div id="beaten_opponents"></div>');

                LeagueHelper.moduleSimLeagueHideBeatenOppo();

                expect(document.querySelector(".leagues_middle_header_script")).toBeNull();
                expect(document.getElementById("HideBeatenOppo")).toBeNull();
            });

            it("does not inject when the HH OCD script already added its league_filter button", function () {
                document.getElementById("leagues")!.insertAdjacentHTML("beforeend", '<div id="league_filter"></div>');

                LeagueHelper.moduleSimLeagueHideBeatenOppo();

                expect(document.querySelector(".leagues_middle_header_script")).toBeNull();
                expect(document.getElementById("HideBeatenOppo")).toBeNull();
            });

            it("does not inject a second time when #HideBeatenOppo already exists", function () {
                document.getElementById("leagues")!.insertAdjacentHTML("beforeend", '<div id="HideBeatenOppo"></div>');

                LeagueHelper.moduleSimLeagueHideBeatenOppo();

                expect(document.querySelector(".leagues_middle_header_script")).toBeNull();
            });
        });

        describe("LeagueDisplayGetOpponentPopup / LeagueClearDisplayGetOpponentPopup", function () {
            it("mounts the opponent-list popup inside #leagues", function () {
                LeagueHelper.LeagueDisplayGetOpponentPopup(5, 10);

                const popup = document.getElementById("popup_message_league");
                expect(popup).not.toBeNull();
                expect(popup!.parentElement).toBe(document.getElementById("leagues"));
            });

            it("removes the popup again", function () {
                LeagueHelper.LeagueDisplayGetOpponentPopup(5, 10);
                LeagueHelper.LeagueClearDisplayGetOpponentPopup();

                expect(document.getElementById("popup_message_league")).toBeNull();
            });
        });
    });

});
