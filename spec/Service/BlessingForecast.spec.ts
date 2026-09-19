import { BlessingForecast, GameTables } from '../../src/Service/BlessingForecast';

// Excerpts of window.GT as the game served them on 2026-09-19 (game content,
// no player data), in English and German.
const GT_EN: GameTables = {
    colors: { 'FD0': 'Golden', '321': 'Dark', 'B06': 'Dark Pink', '0F0': 'Green', 'F00': 'Red' },
    zodiac: { pisces: 'Pisces', libra: 'Libra' },
    figures: ['fig0', 'Doggie style', 'Dolphin'],
    design: {
        haremdex_eye_color: 'Eye Color', haremdex_hair_color: 'Hair Color', haremdex_zodiac_sign: 'Zodiac sign',
        selectors_Rarity: 'Rarity', girls_rarity_rare: 'Rare', girls_rarity_legendary: 'Legendary',
        element: 'Element', stone_flavor_element: 'Physical', sun_flavor_element: 'Playful',
        girl_role: 'Role', girl_role_1_name: 'Masochist', girl_role_6_name: 'Bugger', girl_role_11_name: '!!HH_design:girl_role_11_name!!',
    },
};
const GT_DE: GameTables = {
    colors: { 'FD0': 'Gold', '0F0': 'Grün' },
    zodiac: { pisces: 'Fische' },
    figures: ['fig0', 'Doggy-Style'],
    design: { haremdex_eye_color: 'Augenfarbe', haremdex_hair_color: 'Haarfarbe', haremdex_zodiac_sign: 'Sternzeichen',
        selectors_Rarity: 'Seltenheit', girls_rarity_rare: 'Selten', girl_role: 'Rolle', girl_role_1_name: 'Masochistin' },
};

const entry = (cond: string, pct: number, labyrinth = false) => ({
    description: `All girls with <span class="blessing-condition">${cond}</span> gain <span class="blessing-bonus">+ ${pct}%</span> bonus on all attributes${labyrinth ? ' in Love Labyrinth' : ''}.`,
});

describe('BlessingForecast.resolve', () => {
    it('maps each condition kind onto the girl-side code', () => {
        expect(BlessingForecast.resolve('Eye Color Golden', 30, GT_EN)).toMatchObject({ kind: 'eyeColor', code: 'FD0' });
        expect(BlessingForecast.resolve('Hair Color Green', 40, GT_EN)).toMatchObject({ kind: 'hairColor', code: '0F0' });
        expect(BlessingForecast.resolve('Zodiac sign Pisces', 20, GT_EN)).toMatchObject({ kind: 'zodiac', code: 'pisces' });
        expect(BlessingForecast.resolve('Favorite position Doggie style', 30, GT_EN)).toMatchObject({ kind: 'position', code: '1' });
        expect(BlessingForecast.resolve('Rarity Rare', 20, GT_EN)).toMatchObject({ kind: 'rarity', code: 'rare' });
        expect(BlessingForecast.resolve('Element Physical', 40, GT_EN)).toMatchObject({ kind: 'element', code: 'stone' });
        expect(BlessingForecast.resolve('Role Masochist', 30, GT_EN)).toMatchObject({ kind: 'role', code: '1' });
    });

    it('takes the longest name, so "Dark Pink" is not read as "Dark"', () => {
        expect(BlessingForecast.resolve('Hair Color Dark Pink', 25, GT_EN)).toMatchObject({ code: 'B06' });
    });

    it('works in the page language (German)', () => {
        expect(BlessingForecast.resolve('Augenfarbe Gold', 30, GT_DE)).toMatchObject({ kind: 'eyeColor', code: 'FD0' });
        expect(BlessingForecast.resolve('Sternzeichen Fische', 20, GT_DE)).toMatchObject({ kind: 'zodiac', code: 'pisces' });
        expect(BlessingForecast.resolve('Lieblingsstellung Doggy-Style', 30, GT_DE)).toMatchObject({ kind: 'position', code: '1' });
        expect(BlessingForecast.resolve('Seltenheit Selten', 20, GT_DE)).toMatchObject({ kind: 'rarity', code: 'rare' });
    });

    it('answers null for text it cannot place', () => {
        expect(BlessingForecast.resolve('Something new', 10, GT_EN)).toBeNull();
    });
});

describe('BlessingForecast.upcomingLeagueConditions', () => {
    it('keeps the league blessings and drops the labyrinth Role', () => {
        const res = { upcoming: [entry('Favorite position Doggie style', 30), entry('Rarity Rare', 20), entry('Role Masochist', 30, true)] };
        const { conditions, unresolved } = BlessingForecast.upcomingLeagueConditions(res, GT_EN);
        expect(conditions.map(c => c.kind)).toEqual(['position', 'rarity']);
        expect(unresolved).toEqual([]);
    });

    it('reports what it could not read', () => {
        const { unresolved } = BlessingForecast.upcomingLeagueConditions({ upcoming: [entry('Mood Grumpy', 10)] }, GT_EN);
        expect(unresolved).toEqual(['Mood Grumpy']);
    });
});

describe('BlessingForecast.girlMatches / projectGirl', () => {
    const golden = BlessingForecast.resolve('Eye Color Golden', 30, GT_EN)!;
    const pisces = BlessingForecast.resolve('Zodiac sign Pisces', 20, GT_EN)!;
    const doggy = BlessingForecast.resolve('Favorite position Doggie style', 30, GT_EN)!;

    it('counts a colour blessing on colour 1 or colour 2', () => {
        expect(BlessingForecast.girlMatches({ eye_color1: 'FD0', eye_color2: '' }, golden)).toBe(true);
        expect(BlessingForecast.girlMatches({ eye_color1: '00F', eye_color2: 'FD0' }, golden)).toBe(true);
        expect(BlessingForecast.girlMatches({ eye_color1: '00F', eye_color2: '' }, golden)).toBe(false);
    });

    it('matches the zodiac on the name after the glyph, and the position on figure', () => {
        expect(BlessingForecast.girlMatches({ zodiac: '♓︎ Pisces' }, pisces)).toBe(true);
        expect(BlessingForecast.girlMatches({ figure: 1 }, doggy)).toBe(true);
        expect(BlessingForecast.girlMatches({ position_img: '1.png' }, doggy)).toBe(true);
        expect(BlessingForecast.girlMatches({ figure: 2 }, doggy)).toBe(false);
    });

    it("takes today's league blessing out and puts next week's in", () => {
        const girl = {
            figure: 1, eye_color1: 'FD0',
            caracs: { carac1: 1300, carac2: 1300, carac3: 1300 },
            blessing_bonuses: { pvp_v3: { carac1: [30], carac2: [30], carac3: [30] }, pvp_v4: { carac1: [30, 40] } },
        };
        const next = BlessingForecast.projectGirl(girl, [doggy]);
        expect(next.caracs?.carac1).toBeCloseTo(1300); // 1300 / 1.3 * 1.3
        expect((next.blessing_bonuses as { pvp_v3: { carac1: number[] } }).pvp_v3.carac1).toEqual([30]);
        const none = BlessingForecast.projectGirl({ ...girl, figure: 2 }, [doggy]);
        expect(none.caracs?.carac1).toBeCloseTo(1000);
        expect(none.can_be_blessed).toBe(false);
    });
});
