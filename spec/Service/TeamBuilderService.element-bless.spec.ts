// Issue 1679 phase 2: Element-Bless ('Element Physique +40%') must
// produce a Mono-Stone team for Frank75. Pre-fix the team builder
// could not see Element-Bless and fell back to position-cluster.
//
// Fixture 'frank75-pool-element-bless.json' captures the post-bless
// change state on Frank's account: hair-Green / eye-Red are gone,
// element-stone +40% is active.


/* global __dirname */

import { readFileSync } from 'fs';
import { join } from 'path';

import { TeamBuilderService } from '../../src/Service/TeamBuilderService';
import { BlessingService } from '../../src/Service/BlessingService';
import { GirlData, ElementType, PlayerClass } from '../../src/Service/TeamScoringService';

interface FixtureGirl {
    id_girl: number;
    name: string;
    class?: number;
    rarity: string;
    element: string;
    level: number;
    graded?: number;
    nb_grades: number;
    carac1: number;
    carac2: number;
    carac3: number;
    eye_color1?: string;
    hair_color1?: string;
    zodiac?: string;
    position_img?: string;
    blessing_bonuses?: any;
    caracs?: { carac1: number; carac2: number; carac3: number };
    can_be_blessed?: boolean;
    can_be_blessed_pvp4?: boolean;
}

interface Fixture {
    hero: { id: number; name: string; class: number; level: number };
    active_blessings: Array<{ title: string; description: string }>;
    girls: FixtureGirl[];
}

function loadFixture(): Fixture {
    const fp = join(__dirname, '../fixtures/issue1679-frank75-pool-element-bless.json');
    return JSON.parse(readFileSync(fp, 'utf-8'));
}

function toGirlData(g: FixtureGirl): GirlData {
    return {
        id_girl: g.id_girl,
        name: g.name,
        class: g.class,
        rarity: g.rarity as any,
        element: g.element as ElementType,
        level: g.level,
        graded: g.graded ?? 0,
        nb_grades: g.nb_grades,
        carac1: g.carac1,
        carac2: g.carac2,
        carac3: g.carac3,
        caracs: g.caracs,
        eyeColor: g.eye_color1,
        hairColor: g.hair_color1,
        zodiac: g.zodiac,
        position: g.position_img ? g.position_img.replace('.png', '') : undefined,
        blessingBonuses: g.blessing_bonuses,
    } as GirlData;
}

describe('Issue 1679 phase 2: Element-Stone blessing -> Mono-Stone team', () => {
    let fixture: Fixture;
    let girls: GirlData[];

    beforeEach(() => {
        fixture = loadFixture();
        girls = fixture.girls.map(toGirlData);
        // detectActiveBlessings reads raw fields from each girl, so we copy
        // the raw blessing-relevant attributes onto each GirlData.
        for (let i = 0; i < girls.length; i++) {
            (girls[i] as any).blessing_bonuses = fixture.girls[i].blessing_bonuses;
            (girls[i] as any).can_be_blessed = fixture.girls[i].can_be_blessed;
            (girls[i] as any).eye_color1 = fixture.girls[i].eye_color1;
            (girls[i] as any).hair_color1 = fixture.girls[i].hair_color1;
            (girls[i] as any).position_img = fixture.girls[i].position_img;
        }
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('detects element-stone +40% as the dominant active blessing', () => {
        const blessings = BlessingService.detectActiveBlessings(girls as any);
        // Top blessing must be element=stone with 40% (rare blessing on
        // legendary+ pool is invisible because there are no rare girls in
        // the eligible pool).
        expect(blessings.length).toBeGreaterThan(0);
        const top = blessings[0];
        expect(top.kind).toBe('element');
        expect(top.value).toBe('stone');
        expect(top.percent).toBe(40);
    });

    it('builds a Mono-Stone team with Mythic Stone as leader (Current Best)', () => {
        const hero = fixture.hero;
        const pclass = hero.class as PlayerClass;
        const result = TeamBuilderService.buildTeam(girls, 1, hero.level, pclass);
        expect(result).not.toBeNull();
        if (!result) return;
        expect(result.girls).toHaveLength(7);

        // Leader must be a Mythic Stone (Shield + blessed + own-class).
        const leader = result.girls[0];
        expect(leader.element).toBe('stone');
        expect(leader.rarity).toBe('mythic');
        // Frank's expectation: Mère de Bunny Lunaire as leader (highest
        // own-class Stone-Mythic mainCarac).
        expect(leader.name).toBe('Mère de Bunny Lunaire');

        // All 7 girls must be Stone (mono-element).
        const stoneCount = result.girls.filter(g => g.element === 'stone').length;
        expect(stoneCount).toBe(7);
    });

    it('builds a Mono-Stone team in Best Possible mode too', () => {
        const hero = fixture.hero;
        const pclass = hero.class as PlayerClass;
        const result = TeamBuilderService.buildTeam(girls, 2, hero.level, pclass);
        expect(result).not.toBeNull();
        if (!result) return;

        const stoneCount = result.girls.filter(g => g.element === 'stone').length;
        expect(stoneCount).toBeGreaterThanOrEqual(6);
        expect(result.girls[0].element).toBe('stone');
        expect(result.girls[0].rarity).toBe('mythic');
    });
});


describe('Issue 1679 phase 2: TeamModule mapping path (live runtime simulation)', () => {
    let fixture: any;

    beforeEach(() => {
            const fp = join(__dirname, '../fixtures/issue1679-frank75-pool-element-bless.json');
        fixture = JSON.parse(readFileSync(fp, 'utf-8'));
    });

    it('maps raw availableGirls fields into GirlData and still detects element-stone blessing', () => {
        // Reproduce the EXACT mapping that TeamModule.setTopTeamV2 does.
        // If detectActiveBlessings cannot read these GirlData objects, the
        // build will silently fall back to trait-cluster logic (which
        // produced the wrong picks reported by the user).
        const girls: GirlData[] = fixture.girls.map((g: any) => ({
            id_girl: Number(g.id_girl),
            name: g.name || '',
            carac1: Number(g.carac1 || 0),
            carac2: Number(g.carac2 || 0),
            carac3: Number(g.carac3 || 0),
            level: Number(g.level || 1),
            class: typeof g.class === 'number' ? g.class : undefined,
            element: g.element as ElementType,
            rarity: g.rarity as any,
            graded: Number(g.graded || 0),
            nb_grades: Number(g.nb_grades || 0),
            caracs: g.caracs ? {
                carac1: Number(g.caracs.carac1 || 0),
                carac2: Number(g.caracs.carac2 || 0),
                carac3: Number(g.caracs.carac3 || 0),
            } : undefined,
            zodiac: g.zodiac || undefined,
            hairColor: g.hair_color1 || undefined,
            eyeColor: g.eye_color1 || undefined,
            position: g.position_img ? String(g.position_img).replace('.png', '') : undefined,
            blessingBonuses: g.blessing_bonuses || undefined,
            ...(typeof g.can_be_blessed === 'boolean' ? { can_be_blessed: g.can_be_blessed } : {}),
        } as GirlData));

        // Verify detectActiveBlessings sees the camelCase girls.
        const blessings = BlessingService.detectActiveBlessings(girls as any);
        expect(blessings.length).toBeGreaterThan(0);
        const top = blessings[0];
        expect(top.kind).toBe('element');
        expect(top.value).toBe('stone');
        expect(top.percent).toBe(40);
    });

    it('end-to-end: builds Mono-Stone team via TeamModule-style mapping', () => {
        const girls: GirlData[] = fixture.girls.map((g: any) => ({
            id_girl: Number(g.id_girl),
            name: g.name || '',
            carac1: Number(g.carac1 || 0),
            carac2: Number(g.carac2 || 0),
            carac3: Number(g.carac3 || 0),
            level: Number(g.level || 1),
            class: typeof g.class === 'number' ? g.class : undefined,
            element: g.element as ElementType,
            rarity: g.rarity as any,
            graded: Number(g.graded || 0),
            nb_grades: Number(g.nb_grades || 0),
            caracs: g.caracs ? {
                carac1: Number(g.caracs.carac1 || 0),
                carac2: Number(g.caracs.carac2 || 0),
                carac3: Number(g.caracs.carac3 || 0),
            } : undefined,
            zodiac: g.zodiac || undefined,
            hairColor: g.hair_color1 || undefined,
            eyeColor: g.eye_color1 || undefined,
            position: g.position_img ? String(g.position_img).replace('.png', '') : undefined,
            blessingBonuses: g.blessing_bonuses || undefined,
            ...(typeof g.can_be_blessed === 'boolean' ? { can_be_blessed: g.can_be_blessed } : {}),
        } as GirlData));

        const hero = fixture.hero;
        const result = TeamBuilderService.buildTeam(girls, 1, hero.level, hero.class as PlayerClass);
        expect(result).not.toBeNull();
        if (!result) return;
        const stoneCount = result.girls.filter(g => g.element === 'stone').length;
        expect(stoneCount).toBe(7);
        expect(result.girls[0].name).toBe('Mère de Bunny Lunaire');
    });
});
