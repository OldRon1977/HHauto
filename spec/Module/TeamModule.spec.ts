import { TeamModule } from "../../src/Module/TeamModule";

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
        // Regression: previously returned undefined (bare `return;`), which made
        // the consumer crash on `.length`. Must be an empty array now.
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
        unsafeWindow.teams_data = { 0: { girls_ids: [1, 2, 3] } };
        const result = TeamModule.getSelectedGirlsId();
        expect(result).toEqual([]);
    });

    it("returns the 7 girl ids on a valid selected team", () => {
        document.body.innerHTML =
            "<div id=\"hh_hentai\" page=\"edit-team\">" +
            "<div class=\"team-slot-container selected-team\" data-team-index=\"2\"></div>" +
            "</div>";
        unsafeWindow.teams_data = { 2: { girls_ids: [11, 22, 33, 44, 55, 66, 77] } };
        const result = TeamModule.getSelectedGirlsId();
        expect(result).toEqual([11, 22, 33, 44, 55, 66, 77]);
    });
});

describe('TeamModule.mapAvailableGirl -- TM-C raw->GirlData mapping', () => {
    it('maps the core fields and coerces numerics', () => {
        const g = TeamModule.mapAvailableGirl({
            id_girl: '42', name: 'Ada', carac1: '10', carac2: 20, carac3: '30',
            level: '750', class: 3, rarity: 'mythic', graded: '6', nb_grades: 6,
            element_data: { type: 'stone' },
            caracs: { carac1: '11', carac2: 22, carac3: '33' },
            hair_color1: 'FF0', eye_color1: '00F', zodiac: 'GLYPH Belier',
            position_img: '5.png', blessing_bonuses: { pvp_v3: { carac1: [40] } },
            can_be_blessed: true,
        });
        expect(g.id_girl).toBe(42);
        expect(g.name).toBe('Ada');
        expect(g.carac1).toBe(10);
        expect(g.carac3).toBe(30);
        expect(g.level).toBe(750);
        expect(g.class).toBe(3);
        expect(g.element).toBe('stone');
        expect(g.rarity).toBe('mythic');
        expect(g.nb_grades).toBe(6);
        expect(g.caracs).toEqual({ carac1: 11, carac2: 22, carac3: 33 });
        expect(g.hairColor).toBe('FF0');
        expect(g.eyeColor).toBe('00F');
        expect(g.zodiac).toBe('GLYPH Belier');
        expect(g.position).toBe('5'); // .png stripped
        expect((g as any).can_be_blessed).toBe(true);
    });

    it('prefers element_data.type over element, falls back to fire', () => {
        expect(TeamModule.mapAvailableGirl({ id_girl: 1, element_data: { type: 'water' }, element: 'fire' }).element).toBe('water');
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
        expect('can_be_blessed' in (g as any)).toBe(false);
    });
});
