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
        // Philosophy B (candidate matrix): the strongest fully-blessed
        // team wins. With two active blessings (hair=0F0 +40%, eye=F00
        // +25%) the default-flat candidate -- top 7 blessed girls across
        // both blessing axes -- outscores the single-axis clustered teams.
        // Still 7/7 blessed; the display cluster keys on eyeColor=0F0.
        expect(['bless1', 'bless1-flat', 'default-flat']).toContain(r!.poolUsed);
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

    it('fields a fully-blessed team (7/7 carry an active blessing)', () => {
        const r = TeamBuilderService.buildTeam(girls, 1, fixture.hero.level, fixture.hero.class as PlayerClass)!;
        // Philosophy B optimises across BOTH active blessings (hair=0F0
        // and eye=F00), so all 7 picks are blessed even if not all share
        // the same hair value (one is blessed via the eye axis).
        const blessed = r.girls.filter(g => BlessingService.getEffectiveMultiplier(g as any) > 1).length;
        expect(blessed).toBe(7);
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
        // Fix C: flat candidate wins (sum 223056 vs 196361, +13.6%);
        // still an all-stone team, stronger individual picks.
        expect(['bless1', 'bless1-flat']).toContain(r.poolUsed);
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

    it('picks a Stone Mythic Shield as leader (Tier-5 Shield, strongest team)', () => {
        const r = TeamBuilderService.buildTeam(girls, 1, fixture.hero.level, fixture.hero.class as PlayerClass)!;
        // Philosophy B: the strongest all-stone team wins. Leader is a
        // Stone Mythic (Tier-5 Shield); the trait-match leader bias (old
        // key 4) no longer forces a specific girl -- the leader is now the
        // one belonging to the strongest fielded team.
        expect(r.girls[0].element).toBe('stone');
        expect(r.girls[0].rarity).toBe('mythic');
        expect(r.leaderTier5.name).toBe('Shield');
    });
});

describe('TB-A regression -- HH hairColor=FF0 +40% week (bless-aware cluster)', () => {
    // The HH accounts have a hairColor=FF0 (blond) +40% blessing plus a
    // weaker zodiac=Balance +20%. The eligible pool contains a strong
    // eyeColor=00F (blue) cluster among darkness/fire girls. Before the
    // Fix B/C, the static trait hierarchy (eyeColor first) made the
    // builder cluster on eye=00F and fill the last two slots with
    // UNBLESSED girls (5/7 blessed), dropping the 40% blond bonus on
    // two slots. After the fix the builder must surface an all-blond
    // candidate (7/7 hairColor=FF0).
    const cases = [
        { file: 'hh-bless-cluster-frank.json', label: 'Frank' },
        { file: 'hh-bless-cluster-julien.json', label: 'Julien' },
    ];

    for (const c of cases) {
        describe(c.label, () => {
            let girls: GirlData[];
            beforeEach(() => { girls = load(c.file).girls.map(toGirlData); });

            it('detects the hairColor=FF0 blessing as bless1', () => {
                const r = TeamBuilderService.buildTeam(girls, 1, 0, 1)!;
                expect(r).not.toBeNull();
                const b1 = r.activeBlessings[0];
                expect(b1.kind).toBe('hairColor');
                expect(b1.value).toBe('FF0');
            });

            it('builds an all-blond team (7/7 hairColor=FF0) in mode 1', () => {
                const r = TeamBuilderService.buildTeam(girls, 1, 0, 1)!;
                const blond = r.girls.filter(g => g.hairColor === 'FF0').length;
                expect(blond).toBe(7);
            });

            it('uses a bless1-derived pool, not the default pool', () => {
                const r = TeamBuilderService.buildTeam(girls, 1, 0, 1)!;
                expect(['bless1', 'bless1-flat']).toContain(r.poolUsed);
            });
        });
    }
});
