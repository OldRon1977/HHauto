import { TeamModule } from "../../src/Module/TeamModule";
import { loadFixture } from "../testHelpers/Fixtures";

describe("TeamModule.getSelectedGirlsId -- I1 regression (return type)", () => {
    afterEach(() => {
        document.body.innerHTML = "";
        localStorage.clear();
        sessionStorage.clear();
    });

    it("returns [] (not undefined) when no team is selected", () => {
        // No .team-slot-container.selected-team in the DOM -> first guard hits.
        document.body.innerHTML = "<div id=\"hh_hentai\" page=\"edit-team\"></div>";
        const result = TeamModule.getSelectedGirlsId();
        // Regression: a bare `return;` yields undefined and the consumer
        // crashes on `.length`. It must be an empty array.
        expect(Array.isArray(result)).toBe(true);
        expect(result).toEqual([]);
        // The exact crash path: equipAllGirls does `if (girlIds.length == 0)`.
        expect(() => result.length).not.toThrow();
        expect(result.length).toBe(0);
    });

    it("returns [] when the selected team does not have 7 members", () => {
        document.body.innerHTML =
            "<div id=\"hh_hentai\" page=\"edit-team\">" +
            "<div class=\"team-slot-container selected-team\" data-team-index=\"0\"></div>" +
            "</div>";
        unsafeWindow.teams_data = { 0: { girls_ids: [1, 2, 3] } } as unknown as typeof unsafeWindow.teams_data;
        const result = TeamModule.getSelectedGirlsId();
        expect(result).toEqual([]);
    });

    it("returns the 7 girl ids on a valid selected team", () => {
        document.body.innerHTML =
            "<div id=\"hh_hentai\" page=\"edit-team\">" +
            "<div class=\"team-slot-container selected-team\" data-team-index=\"2\"></div>" +
            "</div>";
        unsafeWindow.teams_data = { 2: { girls_ids: [11, 22, 33, 44, 55, 66, 77] } } as unknown as typeof unsafeWindow.teams_data;
        const result = TeamModule.getSelectedGirlsId();
        expect(result).toEqual([11, 22, 33, 44, 55, 66, 77]);
    });
});

describe('TeamModule.mapAvailableGirl -- raw availableGirls -> GirlData', () => {
    // Three real entries off /edit-team.html availableGirls, reduced to the
    // fields this mapper reads. A renamed field in the game shows up here as
    // a missing key instead of passing against a hand-written object.
    const raw = loadFixture('teams', 'available-girls') as any[];

    it('maps a real entry field for field', () => {
        const src = raw[0];
        const g = TeamModule.mapAvailableGirl(src);

        expect(g.id_girl).toBe(Number(src.id_girl));
        expect(g.name).toBe(src.name);
        expect(g.carac1).toBe(Number(src.carac1));
        expect(g.carac2).toBe(Number(src.carac2));
        expect(g.carac3).toBe(Number(src.carac3));
        expect(g.rarity).toBe(src.rarity);
        expect(g.nb_grades).toBe(Number(src.nb_grades));
        expect(g.element).toBe(src.element_data?.type ?? src.element);
        expect(g.hairColor).toBe(src.hair_color1);
        expect(g.eyeColor).toBe(src.eye_color1);
        expect(g.zodiac).toBe(src.zodiac);
    });

    it('strips the .png the game appends to the position', () => {
        const src = raw.find((g) => typeof g.position_img === 'string');
        expect(src).toBeDefined();
        expect(src.position_img).toMatch(/\.png$/);
        expect(TeamModule.mapAvailableGirl(src).position)
            .toBe(String(src.position_img).replace('.png', ''));
    });

    it('carries the blessing flags across under their per-context names', () => {
        const src = raw.find((g) => typeof g.can_be_blessed === 'boolean');
        expect(src).toBeDefined();
        const g = TeamModule.mapAvailableGirl(src);
        expect(g.can_be_blessed_league).toBe(src.can_be_blessed);
        if (typeof src.can_be_blessed_pvp4 === 'boolean') {
            expect(g.can_be_blessed_labyrinth).toBe(src.can_be_blessed_pvp4);
        }
        expect(g.blessingBonuses).toEqual(src.blessing_bonuses);
    });

    it('prefers element_data.type over element, falls back to fire', () => {
        const src = raw.find((g) => g.element_data?.type);
        expect(src).toBeDefined();
        // The game sends both; element_data wins because it is the one that
        // follows an element change.
        expect(TeamModule.mapAvailableGirl({ ...src, element: 'psychic' }).element)
            .toBe(src.element_data.type);
        expect(TeamModule.mapAvailableGirl({ id_girl: 1, element: 'light' }).element).toBe('light');
        expect(TeamModule.mapAvailableGirl({ id_girl: 1 }).element).toBe('fire');
    });

    it('defaults missing numerics and rarity safely', () => {
        const g = TeamModule.mapAvailableGirl({ id_girl: 7 });
        expect(g.carac1).toBe(0);
        expect(g.level).toBe(1);
        expect(g.graded).toBe(0);
        expect(g.rarity).toBe('common');
        expect(g.caracs).toBeUndefined();
        expect(g.class).toBeUndefined();
        expect(g.position).toBeUndefined();
    });

    it('omits can_be_blessed flags when not boolean', () => {
        const g = TeamModule.mapAvailableGirl({ id_girl: 9, can_be_blessed: 'yes' as any });
        expect('can_be_blessed_league' in g).toBe(false);
    });
});

describe('TeamModule -- edit-team workflow (unequip -> pick -> assign -> stuff)', () => {

    function editTeamPage(positions: Array<number | null>) {
        const hexes = positions.map((id, i) => id === null
            ? `<div class="team-member-container" data-team-member-position="${i}"></div>`
            : `<div class="team-member-container" data-team-member-position="${i}" data-girl-id="${id}"></div>`).join('');
        document.body.innerHTML =
            '<div id="hh_hentai" page="edit-team">'
            + '<div class="team-hexagon">' + hexes + '</div>'
            + '</div>';
    }

    function availableGirls(ids: number[]) {
        (unsafeWindow as any).availableGirls = ids.map(id => ({
            id_girl: id, name: 'Girl_' + id, rarity: 'mythic', nb_grades: 6,
            skill_tiers_info: { 5: { skill_points_used: 0 } },
        }));
    }

    afterEach(() => {
        document.body.innerHTML = '';
        delete (unsafeWindow as any).availableGirls;
        delete (unsafeWindow as any).battle_type;
        delete (unsafeWindow as any).teamId;
        if (unsafeWindow.shared?.general) delete (unsafeWindow.shared.general as any).hh_ajax;
        localStorage.clear();
        sessionStorage.clear();
    });

    it('reads the girl ids from the hexagons in position order', () => {
        editTeamPage([11, 22, 33, 44, 55, 66, 77]);
        expect(TeamModule.getEditTeamGirlIds()).toEqual([11, 22, 33, 44, 55, 66, 77]);
    });

    it('skips empty hexagon slots', () => {
        editTeamPage([11, null, 33, null, null, null, null]);
        expect(TeamModule.getEditTeamGirlIds()).toEqual([11, 33]);
    });

    it('builds team girls from availableGirls on the edit page', () => {
        const ids = [11, 22, 33, 44, 55, 66, 77];
        editTeamPage(ids);
        availableGirls(ids);
        const girls = TeamModule.getSelectedGirls();
        expect(girls).toHaveLength(7);
        expect(girls[0].id_girl).toBe(11);
        expect(girls[0].girl.name).toBe('Girl_11');
        expect(girls[0].girl.rarity).toBe('mythic');
        expect(girls[0].skill_tiers_info).toBeDefined();
    });

    it('returns [] on the edit page when availableGirls is missing', () => {
        editTeamPage([11, 22, 33, 44, 55, 66, 77]);
        expect(TeamModule.getSelectedGirls()).toEqual([]);
    });

    it('returns [] on the edit page when a hexagon girl is unknown', () => {
        editTeamPage([11, 22, 33, 44, 55, 66, 999]);
        availableGirls([11, 22, 33, 44, 55, 66, 77]);
        expect(TeamModule.getSelectedGirls()).toEqual([]);
    });

    // The full edit_team payload assertion was removed in the spec triage
    // (2026-08): it named class/action/girls/battle_type against a copy of
    // the call it asserted. Whether the game accepts that shape is checked
    // in scripts/live-check. The id_team and incomplete-team branches below
    // are our own conditions and stay.

    it('omits id_team when the page has none', () => {
        editTeamPage([11, 22, 33, 44, 55, 66, 77]);
        const sent: any[] = [];
        if (!unsafeWindow.shared!.general) (unsafeWindow.shared as any).general = {};
        (unsafeWindow.shared!.general as any).hh_ajax = (params: any, cb: (d: any) => void) => {
            sent.push(params); cb({ success: true });
        };
        TeamModule.saveTeamInPlace();
        expect(sent[0].id_team).toBeUndefined();
        expect(sent[0].battle_type).toBe('leagues');
    });

    it('does not save an incomplete team', () => {
        editTeamPage([11, 22, 33, null, null, null, null]);
        const sent: any[] = [];
        if (!unsafeWindow.shared!.general) (unsafeWindow.shared as any).general = {};
        (unsafeWindow.shared!.general as any).hh_ajax = (params: any) => { sent.push(params); };
        TeamModule.saveTeamInPlace();
        expect(sent).toHaveLength(0);
    });

    it('does not throw when hh_ajax is unavailable', () => {
        editTeamPage([11, 22, 33, 44, 55, 66, 77]);
        expect(() => TeamModule.saveTeamInPlace()).not.toThrow();
    });
});

describe('TeamModule -- collapsible team summary', () => {
    const KEY = 'HHAuto_Temp_teamInfoCollapsed';

    function teamResult(): any {
        const girl = (i: number) => ({
            id_girl: i, name: 'Girl_' + i, element: 'stone', rarity: 'mythic',
            level: 750, graded: 6, nb_grades: 6, carac1: 1, carac2: 1, carac3: 1,
        });
        const girls = [1, 2, 3, 4, 5, 6, 7].map(girl);
        return {
            girls, elements: girls.map(g => g.element), statScores: girls.map(() => 1),
            mainSum: 282488, projectedSum: 282488,
            leaderTier5: { id: 12, name: 'Shield', priority: 4 },
            leaderInCluster: true, traitCategory: 'zodiac', traitValue: 'Taurus',
            tier3Bonus: 0.036, traitMatchCount: 2, activeBlessings: [],
            poolUsed: 'default-flat', blessedGirlCount: 0, playerClass: 3,
            mythicAudit: [], slotInfo: [],
            poolStats: { eligible: 263, ownClass: 89, otherClass: {}, ownClassMythics: 20, ownClassMythicsAtCap: 20, ownClassMythicsBlessed: 2 },
            currentModeName: 'Current Best',
        };
    }

    const render = () => (TeamModule as any).renderTeamInfoPanel(teamResult());

    beforeEach(() => {
        document.body.innerHTML = '<div id="contains_all"><section></section></div>';
        localStorage.clear();
    });
    afterEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

    it('renders the summary expanded by default, with a clickable header', () => {
        render();
        expect(document.querySelectorAll('.hhTeamSynergyInfo').length).toBe(1);
        expect(document.querySelectorAll('.hhTeamSynergyInfoHeader').length).toBe(1);
        expect($('.hhTeamSynergyInfoBody').css('display')).not.toBe('none');
    });

    it('keeps the mode and the stat sum visible in the header', () => {
        render();
        const header = document.querySelector('.hhTeamSynergyInfoHeader') as HTMLElement;
        expect(header.textContent).toContain('Current Best');
        expect(header.textContent).toContain('282');
    });

    it('collapses on click and remembers it', () => {
        render();
        $('.hhTeamSynergyInfoHeader').trigger('click');
        expect($('.hhTeamSynergyInfoBody').css('display')).toBe('none');
        expect(localStorage.getItem(KEY)).toBe('true');
    });

    it('expands again on a second click and clears the flag', () => {
        render();
        $('.hhTeamSynergyInfoHeader').trigger('click');
        $('.hhTeamSynergyInfoHeader').trigger('click');
        expect($('.hhTeamSynergyInfoBody').css('display')).toBe('block');
        expect(localStorage.getItem(KEY)).toBe('false');
    });

    it('renders collapsed when the stored state says so', () => {
        localStorage.setItem(KEY, 'true');
        render();
        expect($('.hhTeamSynergyInfoBody').css('display')).toBe('none');
        // The header stays visible so it can be opened again.
        expect(document.querySelectorAll('.hhTeamSynergyInfoHeader').length).toBe(1);
    });

    it('does not swallow clicks meant for the buttons underneath', () => {
        render();
        const panel = document.querySelector('.hhTeamSynergyInfo') as HTMLElement;
        const header = document.querySelector('.hhTeamSynergyInfoHeader') as HTMLElement;
        expect(panel.style.pointerEvents).toBe('none');
        expect(header.style.pointerEvents).toBe('auto');
    });
});
