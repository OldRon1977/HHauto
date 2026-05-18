// Issue 1679 regression: Frank75 dump (FR account) - verify the
// blessing-VALUE boost picks an actually blessed cluster, not an
// unblessed value that happens to share a blessed CATEGORY.
//
// Background: TeamScoringService.findTraitGroups previously applied
// a 5x boost to every value in a blessed CATEGORY. With Hair Green +40%
// and Eye Red +25% active, the boost landed equally on eye=Green
// (unblessed, 22 girls) and eye=Red (blessed, 15 girls), and the
// larger pool won. Frank's issue 1679 documented this misranking.
//
// Fix (this file's regression target): boost only when (category, value)
// matches an active blessing.
//
// Note on this specific pool: Frank75 has only 5 hair=0F0 girls in
// the light+nature element cluster, not enough for a 7-girl team.
// So the algorithm correctly falls back to eye=F00 here. The test
// asserts that the picked cluster is one of the actually blessed
// values, NOT an unblessed-with-larger-pool value (eye=0F0, eye=00F,
// hair=FF0 etc).

/* global __dirname */
import { readFileSync } from 'fs';
import { join } from 'path';

import { TeamBuilderService } from '../../src/Service/TeamBuilderService';
import { BlessingService } from '../../src/Service/BlessingService';
import {
    TeamScoringService,
    GirlData,
    ElementType,
    PlayerClass,
} from '../../src/Service/TeamScoringService';

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
}

interface Fixture {
    hero: { id: number; name: string; class: number; level: number };
    active_blessings: Array<{ title: string; description: string }>;
    girls: FixtureGirl[];
}

function loadFixture(): Fixture {
    const fp = join(__dirname, '../fixtures/issue1679-frank75-pool.json');
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

describe('Issue 1679: Frank75 pool blessing-value boost', () => {
    let fixture: Fixture;
    let girls: GirlData[];

    beforeEach(() => {
        fixture = loadFixture();
        girls = fixture.girls.map(toGirlData);
        // resolveHexForBlessing reads raw fields; copy them onto each girl.
        for (let i = 0; i < girls.length; i++) {
            (girls[i] as any).blessing_bonuses = fixture.girls[i].blessing_bonuses;
            (girls[i] as any).eye_color1 = fixture.girls[i].eye_color1;
            (girls[i] as any).hair_color1 = fixture.girls[i].hair_color1;
            (girls[i] as any).position_img = fixture.girls[i].position_img;
        }
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('resolves hair-color blessing to hex 0F0 (green) via girl pool stats', () => {
        const rawGirls = fixture.girls;
        const hex = BlessingService.resolveHexForBlessing(rawGirls as any, 'hairColor', 40);
        expect(hex).toBe('0F0');
    });

    it('resolves eye-color blessing to hex F00 (red) via girl pool stats', () => {
        const rawGirls = fixture.girls;
        const hex = BlessingService.resolveHexForBlessing(rawGirls as any, 'eyeColor', 25);
        expect(hex).toBe('F00');
    });

    it('builds team in a blessed cluster (eye=F00 or hair=0F0), NOT an unblessed value', () => {
        // Mock the cache + hex resolution so detectBlessedTraits sees:
        //   blessedCategories = {hairColor, eyeColor}
        //   blessedValues     = {hairColor: '0F0', eyeColor: 'F00'}
        // matching the live blessings on the dump.
        jest.spyOn(BlessingService, 'getCached').mockReturnValue({
            timestamp: Date.now(),
            raw: {},
            blessedTraits: ['hairColor', 'eyeColor'],
            blessedValues: { hairColor: 'green', eyeColor: 'red' },
        } as any);
        jest.spyOn(BlessingService, 'getBlessedHexValues').mockReturnValue({
            hairColor: '0F0',
            eyeColor: 'F00',
        });

        const hero = fixture.hero;
        const pclass = hero.class as PlayerClass;
        const result = TeamBuilderService.buildTeam(girls, 1, hero.level, pclass);
        expect(result).not.toBeNull();
        if (!result) return;

        // Pre-fix: picked eye=0F0 (green eyes, unblessed, 22 girls).
        // Post-fix: picks one of the actually-blessed values.
        const isBlessed =
            (result.traitCategory === 'eyeColor' && result.traitValue === 'F00') ||
            (result.traitCategory === 'hairColor' && result.traitValue === '0F0');
        expect(isBlessed).toBe(true);
        expect(result.girls).toHaveLength(7);
    });

    it('ranks blessed value above an equally-sized unblessed value of the same category', () => {
        // Direct findTraitGroups test: with blessedValues={eyeColor: 'F00'},
        // eye=F00 must outrank eye=0F0 even though the latter has more girls.
        const scoreFn = (g: GirlData) => TeamScoringService.getMainCarac(g, 2);
        const groups = TeamScoringService.findTraitGroups(girls, scoreFn, {
            eyeColor: 'F00',
            hairColor: '0F0',
        });

        // Find the rank of eye=F00 vs eye=0F0
        const f00Idx = groups.findIndex(g => g.traitCategory === 'eyeColor' && g.traitValue === 'F00');
        const g0F0Idx = groups.findIndex(g => g.traitCategory === 'eyeColor' && g.traitValue === '0F0');
        expect(f00Idx).toBeGreaterThanOrEqual(0);
        expect(g0F0Idx).toBeGreaterThanOrEqual(0);
        // Blessed F00 must come before unblessed 0F0.
        expect(f00Idx).toBeLessThan(g0F0Idx);
    });

    it('does not boost an unblessed value that shares a blessed category', () => {
        // Sanity: with blessedValues={eyeColor: 'F00'}, eye=0F0 must NOT
        // get the blessing boost. We verify by comparing the score of the
        // same group with and without the blessed-value record.
        const scoreFn = (g: GirlData) => TeamScoringService.getMainCarac(g, 2);
        const groupsBlessed = TeamScoringService.findTraitGroups(girls, scoreFn, {
            eyeColor: 'F00',
        });
        const groupsUnblessed = TeamScoringService.findTraitGroups(girls, scoreFn);

        const blessedG = groupsBlessed.find(g => g.traitCategory === 'eyeColor' && g.traitValue === '0F0');
        const unblessedG = groupsUnblessed.find(g => g.traitCategory === 'eyeColor' && g.traitValue === '0F0');
        expect(blessedG).toBeDefined();
        expect(unblessedG).toBeDefined();
        // eye=0F0 is NOT the blessed value, so its score should be identical
        // in both runs (no boost applied).
        expect(blessedG!.score).toBeCloseTo(unblessedG!.score, 5);
    });
});
