// Live-pool tests using anonymised league fixture data.
//
// Two snapshots:
//   1. Trait-bless week (hair-Green +40%, eye-Red +25%) -- fixture
//      issue1679-pool.json. The expected leader is Ankyo Impact
//      (Mythic Light Shield, hair=0F0).
//   2. Element-bless week (Stone +40%) -- fixture
//      issue1679-pool-element-bless.json. The expected leader is
//      a Mythic Stone Shield with the dominant zodiac (Bélier in this
//      pool: Kira Navel or Andra Palpitante, both class=3 Bélier-Stones
//      with caracs_sum 31777).
//
// Note: the leader rule has no own-class tiebreaker. Mère de Bunny
// Lunaire (Stone Shield, zodiac=Balance) does NOT match the team trait
// (Bélier), so she cannot lead. Kira and Andra match the trait, so one
// of them must lead.

/* global __dirname */
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
    can_be_blessed_pvp4?: boolean;
}

interface Fixture {
    hero: { id: number; name: string; class: number; level: number };
    active_blessings: Array<{ title: string; description: string }>;
    girls: FixtureGirl[];
}

function load(name: string): Fixture {
    const fp = join(__dirname, '../fixtures/' + name);
    return JSON.parse(readFileSync(fp, 'utf-8'));
}

/**
 * Map a raw fixture girl onto GirlData using the same shape that
 * TeamModule.setTopTeamV2 produces from availableGirls. We additionally
 * copy the snake_case raw fields so detectActiveBlessings (which reads
 * either form) sees identical values.
 */
function toGirlData(g: FixtureGirl): GirlData {
    const out: any = {
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
        // Mirror raw fields for detectActiveBlessings.
        eye_color1: g.eye_color1,
        hair_color1: g.hair_color1,
        position_img: g.position_img,
        blessing_bonuses: g.blessing_bonuses,
        can_be_blessed: g.can_be_blessed,
    };
    return out as GirlData;
}

describe('Issue 1679 pool -- Trait-bless week (hair-Green +40%, eye-Red +25%)', () => {
    let fixture: Fixture;
    let girls: GirlData[];

    beforeEach(() => {
        fixture = load('issue1679-pool.json');
        girls = fixture.girls.map(toGirlData);
    });

    it('builds the team in the bless1 pool around the eyeColor sub-cluster', () => {
        // Spec rule for Pos 2-7: trait-hierarchy eyes > hair > zodiac > position.
        // The bless1 pool (hair=0F0+40%) contains 24 girls. The eye-color
        // sub-group is the strongest non-trivial bucket inside the
        // hierarchy (eye=0F0 has 13 girls), so the cluster forms there.
        // The hair=0F0 blessing still benefits every team girl through
        // the multiplier on caracs, but the Tier-3 chain now keys on
        // eyeColor as per spec.
        const r = TeamBuilderService.buildTeam(girls, 1, fixture.hero.level, fixture.hero.class as PlayerClass);
        expect(r).not.toBeNull();
        expect(r!.poolUsed).toBe('bless1');
        expect(r!.traitCategory).toBe('eyeColor');
        expect(r!.traitValue).toBe('0F0');
    });

    it('picks Ankyo Impact (Mythic Light Shield) as leader (Tier-5 priority wins)', () => {
        // Two mythics in the bless1 pool: Ankyo (light/Shield) and Atina
        // Déesse (psychic/Reflect). Spec leader keys 1+2 already settle:
        // Mythic-Mythic tie, Shield (4) beats Reflect (1).
        const r = TeamBuilderService.buildTeam(girls, 1, fixture.hero.level, fixture.hero.class as PlayerClass)!;
        expect(r.girls[0].name).toBe('Ankyo Impact');
        expect(r.girls[0].element).toBe('light');
        expect(r.girls[0].rarity).toBe('mythic');
    });

    it('every team girl carries the blessed hair value (multiplier still applies)', () => {
        const r = TeamBuilderService.buildTeam(girls, 1, fixture.hero.level, fixture.hero.class as PlayerClass)!;
        // All 7 girls come from the hair=0F0 bless1 pool.
        const hairMatches = r.girls.filter(g => g.hairColor === '0F0').length;
        expect(hairMatches).toBe(7);
    });
});

describe('Issue 1679 pool -- Element-bless week (Stone +40%)', () => {
    let fixture: Fixture;
    let girls: GirlData[];

    beforeEach(() => {
        fixture = load('issue1679-pool-element-bless.json');
        girls = fixture.girls.map(toGirlData);
    });

    it('builds a Mono-Stone team in the bless1 pool', () => {
        const r = TeamBuilderService.buildTeam(girls, 1, fixture.hero.level, fixture.hero.class as PlayerClass)!;
        expect(r).not.toBeNull();
        expect(r.poolUsed).toBe('bless1');
        const stoneCount = r.girls.filter(g => g.element === 'stone').length;
        expect(stoneCount).toBe(7);
    });

    it('picks the Bélier sub-cluster (largest stone zodiac group)', () => {
        const r = TeamBuilderService.buildTeam(girls, 1, fixture.hero.level, fixture.hero.class as PlayerClass)!;
        expect(r.traitCategory).toBe('zodiac');
        // Spec sub-cluster preference for stone = zodiac. Bélier has 8
        // eligible stones, the largest sub-group.
        expect(r.traitValue).toBe('\u2648\ufe0e B\u00e9lier');
    });

    it('picks a Bélier-Stone Mythic Shield as leader (Kira Navel or Andra Palpitante)', () => {
        const r = TeamBuilderService.buildTeam(girls, 1, fixture.hero.level, fixture.hero.class as PlayerClass)!;
        expect(r.girls[0].element).toBe('stone');
        expect(r.girls[0].rarity).toBe('mythic');
        // Both candidates carry the Trait-Wert-Match (zodiac=Bélier) which
        // beats other Stone Shield candidates that lack the trait per
        // spec key 4.
        expect(['Kira Navel', 'Andra Palpitante']).toContain(r.girls[0].name);
    });
});