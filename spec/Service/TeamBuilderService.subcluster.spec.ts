// Sanity check: does the new sub-cluster pref produce 7 stones with
// matching zodiac on the Frank75 element-bless pool?
import { readFileSync } from 'fs';
import { join } from 'path';

import { TeamBuilderService } from '../../src/Service/TeamBuilderService';
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
}

interface Fixture {
    hero: { id: number; name: string; class: number; level: number };
    girls: FixtureGirl[];
}

function loadFixture(file: string): Fixture {
    /* global __dirname */
    const fp = join(__dirname, '../fixtures/' + file);
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
        ...(typeof g.can_be_blessed === 'boolean' ? { can_be_blessed: g.can_be_blessed } : {}),
    } as GirlData;
}

describe('Issue 1679 phase 3: sub-cluster prefers same-zodiac stones', () => {
    let girls: GirlData[];
    let hero: Fixture['hero'];

    beforeEach(() => {
        const fix = loadFixture('issue1679-frank75-pool-element-bless.json');
        girls = fix.girls.map(toGirlData);
        hero = fix.hero;
    });

    it('builds Mono-Stone team with the dominant zodiac among stones', () => {
        const result = TeamBuilderService.buildTeam(girls, 1, hero.level, hero.class as PlayerClass);
        expect(result).not.toBeNull();
        if (!result) return;

        const stones = result.girls.filter(g => g.element === 'stone');
        expect(stones.length).toBe(7);

        // Count zodiacs in the team. The dominant zodiac in the team
        // should appear at least 3 times (Frank's expected sub-cluster
        // 'Bélier'/'Balance'/etc).
        const zodiacCounts: Record<string, number> = {};
        for (const g of result.girls) {
            const z = g.zodiac || '';
            zodiacCounts[z] = (zodiacCounts[z] || 0) + 1;
        }
        const max = Math.max(...Object.values(zodiacCounts));
        expect(max).toBeGreaterThanOrEqual(3);

        console.log('phase 3 zodiac distribution:', zodiacCounts);
        console.log('leader:', result.girls[0].name, result.girls[0].zodiac);
    });
});
