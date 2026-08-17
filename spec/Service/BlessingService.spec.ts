// BlessingService context tests: league (pvp_v3) vs labyrinth (pvp_v4).
//
// Verified game semantics (2026-07-13, hh-bless-cluster fixtures + live
// dump): pvp_v3 holds the two weekly league blessings, pvp_v4 holds the
// same PLUS the weekly Role blessing which only applies in the Love
// Labyrinth. The game flags mirror this: can_be_blessed == "has league
// blessings", can_be_blessed_pvp4 == "has labyrinth blessings". A girl
// carrying only the Role blessing must NOT count as league-blessed.

import { BlessingService } from '../../src/Service/BlessingService';
import { loadFixture } from '../testHelpers/Fixtures';

// Three real girls off /edit-team.html availableGirls, one per case the
// context split has to tell apart. Captured 2026-08-17; the percents are
// whatever that week's blessings were, which is the point -- the flags and
// the pvp_v3 / pvp_v4 keys come from the game, not from this file.
const REAL = loadFixture('blessings', 'blessed-girls') as {
    leagueBlessed: any;
    roleOnly: any;
    unblessed: any;
};

// Raw API shape (snake_case), as delivered by availableGirls. The trait
// fields are taken from a real entry so a renamed key shows up here; only the
// blessing percents are varied, because the arithmetic cases below need
// values the captured week does not happen to contain.
function rawGirl(overrides: Record<string, any> = {}): any {
    const { blessing_bonuses: _b, can_be_blessed: _c, can_be_blessed_pvp4: _p, ...traits } =
        REAL.leagueBlessed;
    return {
        ...traits,
        id_girl: overrides.id_girl ?? Math.floor(Math.random() * 1e9),
        ...overrides,
    };
}

function bonuses(v3: number[] | null, v4: number[] | null): any {
    const mk = (l: number[]) => ({ carac1: l, carac2: l, carac3: l });
    const bb: any = {};
    if (v3 !== null) bb.pvp_v3 = mk(v3);
    if (v4 !== null) bb.pvp_v4 = mk(v4);
    return bb;
}

// League-blessed girl: v3 percents present, flag true.
function leagueBlessed(v3: number[], v4: number[], overrides: Record<string, any> = {}): any {
    return rawGirl({
        blessing_bonuses: bonuses(v3, v4),
        can_be_blessed: true,
        can_be_blessed_pvp4: true,
        ...overrides,
    });
}

// Role-only girl: no pvp_v3 key at all, flag false (as in real dumps).
function roleOnly(v4: number[], overrides: Record<string, any> = {}): any {
    return rawGirl({
        blessing_bonuses: bonuses(null, v4),
        can_be_blessed: false,
        can_be_blessed_pvp4: true,
        ...overrides,
    });
}

describe('BlessingService.getEffectiveMultiplier -- context split', () => {

    it('league multiplier reads pvp_v3 only', () => {
        const g = leagueBlessed([25], [25, 25]);
        expect(BlessingService.getEffectiveMultiplier(g)).toBeCloseTo(1.25);
        expect(BlessingService.getEffectiveMultiplier(g, 'league')).toBeCloseTo(1.25);
    });

    it('labyrinth multiplier reads pvp_v4 (league + Role stacked)', () => {
        const g = leagueBlessed([25], [25, 25]);
        expect(BlessingService.getEffectiveMultiplier(g, 'labyrinth')).toBeCloseTo(1.5625);
    });

    it('a Role-only girl is unblessed for the league but blessed in the labyrinth', () => {
        const g = roleOnly([25]);
        expect(BlessingService.getEffectiveMultiplier(g)).toBe(1);
        expect(BlessingService.getEffectiveMultiplier(g, 'labyrinth')).toBeCloseTo(1.25);
    });

    it('never falls back across contexts when one set is missing', () => {
        expect(BlessingService.getEffectiveMultiplier(roleOnly([30]), 'league')).toBe(1);
        const v3only = rawGirl({ blessing_bonuses: bonuses([40], null) });
        expect(BlessingService.getEffectiveMultiplier(v3only, 'labyrinth')).toBe(1);
    });

    it('accepts GirlData camelCase blessingBonuses', () => {
        const g = { blessingBonuses: bonuses([40], [40, 25]) };
        expect(BlessingService.getEffectiveMultiplier(g)).toBeCloseTo(1.4);
        expect(BlessingService.getEffectiveMultiplier(g, 'labyrinth')).toBeCloseTo(1.75);
    });
});

describe('BlessingService.getActivePercents -- context split', () => {

    it('returns the context-specific percent list', () => {
        const g = leagueBlessed([40], [40, 25]);
        expect(BlessingService.getActivePercents(g)).toEqual([40]);
        expect(BlessingService.getActivePercents(g, 'labyrinth')).toEqual([40, 25]);
    });

    it('returns [] for a Role-only girl in league context', () => {
        expect(BlessingService.getActivePercents(roleOnly([25]))).toEqual([]);
    });
});

describe('BlessingService.detectActiveBlessings -- context split', () => {

    // Pool modelled after the verified 2026-07 live week: hair Dark blond
    // +40% and position Column (here: "3") +25% as league blessings, plus
    // a Role +25% cohort that only exists in pvp_v4. The Role girls share
    // an eye color to make the old bug observable: with the pre-fix
    // cross-context fallback they produced a spurious eyeColor blessing.
    function buildPool(): any[] {
        const pool: any[] = [];
        for (let i = 0; i < 10; i++) {
            pool.push(leagueBlessed([40], [40], {
                id_girl: 100 + i, hair_color1: 'B62', eye_color1: i % 2 ? '00F' : 'F00',
                position_img: (1 + (i % 2)) + '.png',
            }));
        }
        const scatterHair = ['FFF', '000', 'F99', '0F0'];
        for (let i = 0; i < 8; i++) {
            pool.push(leagueBlessed([25], [25], {
                id_girl: 200 + i, hair_color1: scatterHair[i % 4], eye_color1: i % 2 ? '0F0' : '888',
                position_img: '3.png',
            }));
        }
        for (let i = 0; i < 12; i++) {
            pool.push(roleOnly([25], {
                id_girl: 300 + i, hair_color1: '000', eye_color1: 'A55',
                position_img: (4 + (i % 3)) + '.png',
            }));
        }
        for (let i = 0; i < 30; i++) {
            pool.push(rawGirl({
                id_girl: 400 + i, blessing_bonuses: {},
                can_be_blessed: false, can_be_blessed_pvp4: false,
                hair_color1: 'F99', eye_color1: '321', position_img: (7 + (i % 5)) + '.png',
            }));
        }
        return pool;
    }

    it('league context detects exactly the two league blessings', () => {
        const found = BlessingService.detectActiveBlessings(buildPool());
        expect(found.map(b => `${b.kind}=${b.value}+${b.percent}`)).toEqual([
            'hairColor=B62+40',
            'position=3+25',
        ]);
    });

    it('league context ignores the Role-only cohort (pre-fix: spurious eyeColor blessing)', () => {
        const found = BlessingService.detectActiveBlessings(buildPool());
        expect(found.some(b => b.kind === 'eyeColor' && b.value === 'A55')).toBe(false);
    });

    it('labyrinth context sees the Role cohort as blessed (their shared trait surfaces)', () => {
        const found = BlessingService.detectActiveBlessings(buildPool(), 'labyrinth');
        expect(found.some(b => b.kind === 'eyeColor' && b.value === 'A55' && b.percent === 25)).toBe(true);
    });

    it('respects an explicit can_be_blessed=false even when percents are present', () => {
        // Drifted/inconsistent data: flag says unblessed, list says +25.
        // The game flag is authoritative.
        const odd = leagueBlessed([25], [25], { can_be_blessed: false });
        const pool = [odd, ...buildPool()];
        const found = BlessingService.detectActiveBlessings(pool);
        // The girl must not contribute to any percent group as a carrier.
        const posBless = found.find(b => b.kind === 'position' && b.percent === 25);
        expect(posBless).toBeDefined();
    });

    it('accepts mapped GirlData naming (can_be_blessed_league / blessingBonuses)', () => {
        const pool = buildPool().map(g => ({
            id_girl: g.id_girl,
            eyeColor: g.eye_color1,
            hairColor: g.hair_color1,
            zodiac: g.zodiac,
            position: String(g.position_img).replace('.png', ''),
            element: g.element,
            rarity: g.rarity,
            blessingBonuses: g.blessing_bonuses,
            can_be_blessed_league: g.can_be_blessed,
            can_be_blessed_labyrinth: g.can_be_blessed_pvp4,
        }));
        const found = BlessingService.detectActiveBlessings(pool);
        expect(found.map(b => `${b.kind}=${b.value}+${b.percent}`)).toEqual([
            'hairColor=B62+40',
            'position=3+25',
        ]);
    });
});

describe('BlessingService -- the three real cases, unmodified', () => {
    // No builders here: the girls go in exactly as the game sent them. This is
    // the test that fails when the game renames a key or flips the meaning of
    // a flag; everything above varies the percents on purpose.
    const { leagueBlessed, roleOnly, unblessed } = REAL;

    it('the captured week really does have the three cases in it', () => {
        expect(leagueBlessed.blessing_bonuses.pvp_v3).toBeDefined();
        expect(leagueBlessed.can_be_blessed).toBe(true);
        // A Role-only girl carries no pvp_v3 key at all -- not an empty one.
        expect('pvp_v3' in roleOnly.blessing_bonuses).toBe(false);
        expect(roleOnly.blessing_bonuses.pvp_v4).toBeDefined();
        expect(roleOnly.can_be_blessed).toBe(false);
        expect(roleOnly.can_be_blessed_pvp4).toBe(true);
        expect(unblessed.can_be_blessed).toBe(false);
        expect(unblessed.can_be_blessed_pvp4).toBe(false);
    });

    it('gives the league-blessed girl her percents in both contexts', () => {
        const v3 = leagueBlessed.blessing_bonuses.pvp_v3.carac1 as number[];
        const v4 = leagueBlessed.blessing_bonuses.pvp_v4.carac1 as number[];
        // Blessings multiply, they do not add: two +40% make 1.96, not 1.8.
        const stacked = (l: number[]) => l.reduce((acc, p) => acc * (1 + p / 100), 1);
        expect(BlessingService.getEffectiveMultiplier(leagueBlessed, 'league')).toBeCloseTo(stacked(v3));
        expect(BlessingService.getEffectiveMultiplier(leagueBlessed, 'labyrinth')).toBeCloseTo(stacked(v4));
    });

    it('leaves the Role-only girl unblessed for the league and blessed in the labyrinth', () => {
        const v4 = roleOnly.blessing_bonuses.pvp_v4.carac1 as number[];
        expect(BlessingService.getEffectiveMultiplier(roleOnly, 'league')).toBeCloseTo(1);
        expect(BlessingService.getActivePercents(roleOnly, 'league')).toEqual([]);
        expect(BlessingService.getEffectiveMultiplier(roleOnly, 'labyrinth'))
            .toBeCloseTo(v4.reduce((acc, p) => acc * (1 + p / 100), 1));
    });

    it('leaves the unblessed girl at 1 in both contexts', () => {
        expect(BlessingService.getEffectiveMultiplier(unblessed, 'league')).toBeCloseTo(1);
        expect(BlessingService.getEffectiveMultiplier(unblessed, 'labyrinth')).toBeCloseTo(1);
    });
});
