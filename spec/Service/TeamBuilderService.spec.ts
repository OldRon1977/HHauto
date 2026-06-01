// Spec-driven team builder tests.
// Spec: docs-internal/REVIEW_TeamSelection.md.

import { TeamBuilderService } from '../../src/Service/TeamBuilderService';
import { GirlData, ElementType, RarityType } from '../../src/Service/TeamScoringService';

let nextId = 1;

function girl(overrides: Partial<GirlData> & Record<string, any> = {}): GirlData {
    const id = overrides.id_girl ?? nextId++;
    return {
        id_girl: id,
        name: 'Girl_' + id,
        carac1: 1000,
        carac2: 1000,
        carac3: 1000,
        level: 750,
        graded: 5,
        nb_grades: 5,
        class: 1,
        element: 'fire' as ElementType,
        rarity: 'mythic' as RarityType,
        eyeColor: 'F00',
        ...overrides,
    } as GirlData;
}

beforeEach(() => { nextId = 1; });

// Helper to attach a blessing percent list to a girl in a way that
// BlessingService.getActivePercents / detectActiveBlessings will see.
function setBlessing(g: GirlData, percents: number[]): GirlData {
    (g as any).can_be_blessed = true;
    (g as any).blessing_bonuses = {
        pvp_v3: { carac1: percents, carac2: percents, carac3: percents },
    };
    return g;
}

describe('TeamBuilderService -- spec entry contract', () => {

    it('returns null when no eligible girls exist at all', () => {
        const girls = [girl({ rarity: 'epic' })];
        expect(TeamBuilderService.buildTeam(girls, 1, 100, 1)).toBeNull();
    });

    it('returns a 7-girl team when the eligible pool is large enough', () => {
        const girls = Array.from({ length: 10 }, (_, i) => girl({
            id_girl: 100 + i,
            element: i % 2 === 0 ? 'fire' : 'darkness',
            eyeColor: 'F00',
            carac3: 5000 - i,
        }));
        const r = TeamBuilderService.buildTeam(girls, 1, 100, 3)!;
        expect(r).not.toBeNull();
        expect(r.girls).toHaveLength(7);
        expect(r.poolUsed).toBe('default');
    });
});

describe('TeamBuilderService -- spec step 4 emergency fallback (pool < 7)', () => {

    it('returns a team smaller than 7 sorted by caracs_sum desc when pool < 7', () => {
        const girls = [
            girl({ id_girl: 1, carac3: 5000 }),
            girl({ id_girl: 2, carac3: 6000 }),
            girl({ id_girl: 3, carac3: 4000 }),
            girl({ id_girl: 4, carac3: 7000 }),
        ];
        const r = TeamBuilderService.buildTeam(girls, 1, 100, 1)!;
        expect(r).not.toBeNull();
        expect(r.poolUsed).toBe('fallback');
        expect(r.fallbackReason).toBeDefined();
        expect(r.girls).toHaveLength(4);
        // Sorted by caracs_sum desc: 4 (8000) > 2 (7000) > 1 (6000) > 3 (5000)
        expect(r.girls.map(g => g.id_girl)).toEqual([4, 2, 1, 3]);
    });

    it('keeps the eligibility filter (no epic in fallback team)', () => {
        const girls = [
            girl({ id_girl: 1, rarity: 'mythic', carac3: 5000 }),
            girl({ id_girl: 2, rarity: 'epic', carac3: 99999 }),
        ];
        const r = TeamBuilderService.buildTeam(girls, 1, 100, 1)!;
        expect(r.poolUsed).toBe('fallback');
        expect(r.girls.map(g => g.id_girl)).toEqual([1]);
    });
});

describe('TeamBuilderService -- spec step 3.1 (no blessings)', () => {

    it('builds the cluster from the dominant trait sub-group', () => {
        // 7 girls in eyeColor=F00 cluster, all fire/darkness.
        const blueEyes = Array.from({ length: 7 }, (_, i) => girl({
            id_girl: 200 + i,
            element: i % 2 === 0 ? 'fire' : 'darkness',
            eyeColor: 'F00',
            carac3: 5000,
        }));
        // Some hairColor=blonde noise that should NOT win.
        const blondes = Array.from({ length: 4 }, (_, i) => girl({
            id_girl: 300 + i,
            element: 'light',
            hairColor: 'FFF',
            carac3: 4000,
        }));
        const r = TeamBuilderService.buildTeam([...blueEyes, ...blondes], 1, 100, 3)!;
        expect(r).not.toBeNull();
        expect(r.poolUsed).toBe('default');
        expect(r.traitCategory).toBe('eyeColor');
        expect(r.traitValue).toBe('F00');
    });
});

describe('TeamBuilderService -- best of three candidate teams', () => {

    // Helpers below mix Mythic and Legendary 5* so detectActiveBlessings
    // does not synthesise a rarity-as-blessing candidate (which fires
    // when 100% of the blessed pool happens to share a rarity, an
    // artifact of small synthetic pools).
    const NOISE_TRAITS = ['NOISE_A', 'NOISE_B', 'NOISE_C', 'NOISE_D', 'NOISE_E', 'NOISE_F', 'NOISE_G', 'NOISE_H'];
    const NOISE_ZODIAC = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7', 'z8'];
    const NOISE_POSITION = ['1', '2', '3', '4', '5'];

    function asBless1(g: GirlData, idx: number): GirlData {
        if (idx % 2 === 1) {
            (g as any).rarity = 'legendary';
            (g as any).nb_grades = 5;
        }
        (g as any).eyeColor = 'F00';
        (g as any).eye_color1 = 'F00';
        const noiseHair = NOISE_TRAITS[idx % NOISE_TRAITS.length];
        (g as any).hairColor = noiseHair;
        (g as any).hair_color1 = noiseHair;
        (g as any).zodiac = NOISE_ZODIAC[idx % NOISE_ZODIAC.length];
        (g as any).position = NOISE_POSITION[idx % NOISE_POSITION.length];
        (g as any).position_img = NOISE_POSITION[idx % NOISE_POSITION.length] + '.png';
        return setBlessing(g, [40]);
    }
    function asBless2(g: GirlData, idx: number): GirlData {
        if (idx % 2 === 1) {
            (g as any).rarity = 'legendary';
            (g as any).nb_grades = 5;
        }
        (g as any).hairColor = '0F0';
        (g as any).hair_color1 = '0F0';
        const noiseEye = NOISE_TRAITS[idx % NOISE_TRAITS.length];
        (g as any).eyeColor = noiseEye;
        (g as any).eye_color1 = noiseEye;
        (g as any).zodiac = NOISE_ZODIAC[idx % NOISE_ZODIAC.length];
        (g as any).position = NOISE_POSITION[idx % NOISE_POSITION.length];
        (g as any).position_img = NOISE_POSITION[idx % NOISE_POSITION.length] + '.png';
        return setBlessing(g, [25]);
    }

    it('picks the bless1 team when bless1 carriers have the strongest sum', () => {
        // 7 strong bless1 girls (eye=F00, +40%) vs 7 weaker bless2 girls.
        const bless1 = Array.from({ length: 7 }, (_, i) => asBless1(girl({
            id_girl: 100 + i,
            element: i % 2 === 0 ? 'fire' : 'darkness',
            carac3: 6000,
        }), i));
        const bless2 = Array.from({ length: 7 }, (_, i) => asBless2(girl({
            id_girl: 200 + i,
            element: 'light',
            carac3: 4000,
        }), i));
        const r = TeamBuilderService.buildTeam([...bless1, ...bless2], 1, 100, 3)!;
        expect(r.poolUsed).toBe('bless1');
    });

    it('picks the bless2 team when bless2 carriers outscore bless1 and the default pool', () => {
        // 7 weaker bless1 girls vs 7 strong bless2 girls.
        const bless1 = Array.from({ length: 7 }, (_, i) => asBless1(girl({
            id_girl: 100 + i,
            element: i % 2 === 0 ? 'fire' : 'darkness',
            carac3: 4000,
        }), i));
        const bless2 = Array.from({ length: 7 }, (_, i) => asBless2(girl({
            id_girl: 200 + i,
            element: i % 2 === 0 ? 'light' : 'nature',
            carac3: 7000,
        }), i));
        const r = TeamBuilderService.buildTeam([...bless1, ...bless2], 1, 100, 3)!;
        expect(r.poolUsed).toBe('bless2');
    });

    it('picks the default team when no blessing pool can build 7 girls', () => {
        // Only 3 bless1 girls (cannot fill 7), no bless2 girls. Default
        // pool has 8 unblessed girls.
        const tooFew = Array.from({ length: 3 }, (_, i) => asBless1(girl({
            id_girl: 100 + i,
            element: 'fire',
            carac3: 4000,
        }), i));
        const unblessed = Array.from({ length: 8 }, (_, i) => girl({
            id_girl: 200 + i,
            element: i % 2 === 0 ? 'fire' : 'darkness',
            eyeColor: 'F00',
            carac3: 4000,
        }));
        const r = TeamBuilderService.buildTeam([...tooFew, ...unblessed], 1, 100, 3)!;
        expect(r.poolUsed).toBe('default');
    });

    it('prefers bless1 when bless1 and bless2 teams tie on sum', () => {
        // Identical strengths -> stable tiebreak: bless1 wins.
        const bless1 = Array.from({ length: 7 }, (_, i) => asBless1(girl({
            id_girl: 100 + i,
            element: i % 2 === 0 ? 'fire' : 'darkness',
            carac3: 5000,
        }), i));
        const bless2 = Array.from({ length: 7 }, (_, i) => asBless2(girl({
            id_girl: 200 + i,
            element: i % 2 === 0 ? 'light' : 'nature',
            carac3: 5000,
        }), i));
        const r = TeamBuilderService.buildTeam([...bless1, ...bless2], 1, 100, 3)!;
        expect(r.poolUsed).toBe('bless1');
    });
});

describe('TeamBuilderService -- Leaderauswahl-Regel 7 keys', () => {

    function leaderOf(candidates: GirlData[]): GirlData {
        const r = TeamBuilderService.buildTeam(candidates, 1, 100, 3)!;
        return r.girls[0];
    }

    it('1: Mythic vor Legendary', () => {
        const team = [
            girl({ id_girl: 1, rarity: 'legendary', nb_grades: 5, element: 'light', hairColor: 'FFF' }),
            ...Array.from({ length: 7 }, (_, i) => girl({
                id_girl: 100 + i, rarity: 'mythic', element: 'fire', eyeColor: 'F00',
            })),
        ];
        // Legendary cannot lead while a Mythic is available.
        expect(leaderOf(team).rarity).toBe('mythic');
    });

    it('2: Tier-5 Shield > Stun > Execute > Reflect', () => {
        // Build a flat eyeColor cluster but also include one stone-Shield mythic
        // outside the cluster. Spec key 2 must beat key 3 (Element-Pair-Match).
        const shield = girl({ id_girl: 1, rarity: 'mythic', element: 'stone', zodiac: 'Bélier', carac3: 4000 });
        const eyeCluster = Array.from({ length: 8 }, (_, i) => girl({
            id_girl: 100 + i, rarity: 'mythic', element: 'darkness', eyeColor: 'F00', carac3: 5000,
        }));
        // The stone Shield must lead (Tier-5 priority 4 > Stun priority 3).
        // Spec keys: 1 Mythic-Mythic tie, 2 Shield wins.
        expect(leaderOf([shield, ...eyeCluster]).element).toBe('stone');
    });

    it('3: Element-Pair-Match zum Team-Cluster', () => {
        // Two stone Shields (priority 4): one Bélier-zodiac (matches),
        // one Balance-zodiac. Both have the same caracs_sum. Trait-Match
        // (key 4) must decide; Bélier wins.
        const shieldA = girl({ id_girl: 1, rarity: 'mythic', element: 'stone', zodiac: 'Bélier', carac3: 5000 });
        const shieldB = girl({ id_girl: 2, rarity: 'mythic', element: 'stone', zodiac: 'Balance', carac3: 5000 });
        const beliers = Array.from({ length: 6 }, (_, i) => girl({
            id_girl: 100 + i, rarity: 'mythic', element: 'stone', zodiac: 'Bélier', carac3: 4000,
        }));
        // Cluster forms around zodiac=Bélier (8 vs 1). Both Shields are
        // Element-Pair-Match for stone, so key 3 ties; key 4 decides.
        const r = TeamBuilderService.buildTeam([shieldA, shieldB, ...beliers], 1, 100, 3)!;
        expect(r.traitValue).toBe('Bélier');
        expect(r.girls[0].id_girl).toBe(1); // shieldA
    });

    it('4: cluster forms on the dominant trait value (Belier), leader is a Stone Shield', () => {
        // Cluster is zodiac=Belier (7 of 8 stones). Two Shield mythics
        // with identical caracs_sum: id1 zodiac=Balance, id2 zodiac=Belier.
        //
        // Philosophy B (candidate matrix): the strongest fielded team
        // wins. The flat candidate fields the 7 strongest stones (which
        // includes BOTH shields, since they outscore the weaker fillers)
        // and outscores any cluster-constrained team that has to drop one
        // shield. The old key-4 trait-match leader bias no longer forces a
        // specific girl; the cluster value is still reported as Belier and
        // the leader is a Stone Mythic Shield. Which of the two equal-stat
        // shields leads is decided by candidate/append order, not by
        // trait-match, so we assert the invariants, not the exact id.
        const shieldBalance = girl({
            id_girl: 1, rarity: 'mythic', element: 'stone',
            zodiac: 'Balance', carac3: 5000,
        });
        const shieldBelier = girl({
            id_girl: 2, rarity: 'mythic', element: 'stone',
            zodiac: 'Bélier', carac3: 5000,
        });
        const filler = Array.from({ length: 6 }, (_, i) => girl({
            id_girl: 100 + i, rarity: 'mythic', element: 'stone',
            zodiac: 'Bélier', carac3: 3000 - i,
        }));
        const r = TeamBuilderService.buildTeam([shieldBalance, shieldBelier, ...filler], 1, 100, 3)!;
        expect(r.traitValue).toBe('Bélier');
        expect(r.girls[0].element).toBe('stone');
        expect(r.leaderTier5.name).toBe('Shield');
        // Both equal-stat shields are fielded somewhere in the team.
        const ids = r.girls.map(g => g.id_girl);
        expect(ids).toContain(1);
        expect(ids).toContain(2);
    });

    it('5: blessed vor unblessed', () => {
        // Two Mythic Stone Shield mythics with identical caracs_sum and
        // identical zodiac=Bélier. blessedOne carries a residual blessing
        // multiplier (>1), unblessedTie does not. Keys 1-4 tie, key 5
        // decides; blessedOne wins.
        //
        // Filler carries the same blessing percent on a noise zodiac, so
        // detectActiveBlessings cannot anchor a (zodiac=Bélier, +40) bless;
        // no candidate pool produces 7 girls and the run lands on the
        // default pool, which exposes the leader contest cleanly.
        const blessedOne = setBlessing(girl({
            id_girl: 1, rarity: 'mythic', element: 'stone',
            zodiac: 'Bélier', carac3: 5000,
        }), [40]);
        const NOISE = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6'];
        const otherBlessed = Array.from({ length: 6 }, (_, i) => setBlessing(girl({
            id_girl: 100 + i, rarity: 'mythic', element: 'stone',
            zodiac: NOISE[i % NOISE.length], carac3: 5000,
        }), [40]));
        const unblessedTie = girl({
            id_girl: 2, rarity: 'mythic', element: 'stone',
            zodiac: 'Bélier', carac3: 5000,
        });
        const r = TeamBuilderService.buildTeam([blessedOne, unblessedTie, ...otherBlessed], 1, 100, 3)!;
        expect(['default', 'bless1', 'bless2', 'fallback']).toContain(r.poolUsed);
        expect(r.girls[0].id_girl).toBe(1);
    });

    it('6: caracs_sum absteigend (mode-aware)', () => {
        // Both Mythic Stone Shield, both Bélier, both unblessed -> caracs_sum decides.
        const stronger = girl({
            id_girl: 1, rarity: 'mythic', element: 'stone',
            class: 3, zodiac: 'Bélier', carac1: 8000, carac2: 8000, carac3: 8000,
        });
        const weaker = girl({
            id_girl: 2, rarity: 'mythic', element: 'stone',
            class: 3, zodiac: 'Bélier', carac1: 4000, carac2: 4000, carac3: 4000,
        });
        const filler = Array.from({ length: 6 }, (_, i) => girl({
            id_girl: 100 + i, rarity: 'mythic', element: 'stone',
            zodiac: 'Bélier', class: 3, carac3: 4000,
        }));
        const r = TeamBuilderService.buildTeam([stronger, weaker, ...filler], 1, 100, 3)!;
        expect(r.girls[0].id_girl).toBe(1);
    });

    it('7: Element-Coeff hoeher zuerst (final tie-break)', () => {
        // Cluster forms around eyeColor=F00 (6 fire mythics). Stone and
        // Light are both out-of-pair (key 3 fail), both Shield (key 2
        // tie), both unblessed, same caracs. Key 7 (Element-Coeff)
        // decides: stone=1.12 > light=1.00.
        const stoneOut = girl({
            id_girl: 4, rarity: 'mythic', element: 'stone',
            zodiac: 'Capricorne', carac3: 5000,
        });
        const lightOut = girl({
            id_girl: 5, rarity: 'mythic', element: 'light',
            hairColor: 'FFF', carac3: 5000,
        });
        const fillCluster = Array.from({ length: 6 }, (_, i) => girl({
            id_girl: 200 + i, rarity: 'mythic', element: 'fire',
            eyeColor: 'F00', carac3: 5500,
        }));
        const r = TeamBuilderService.buildTeam([stoneOut, lightOut, ...fillCluster], 1, 100, 3)!;
        expect(r.traitCategory).toBe('eyeColor');
        expect(r.girls[0].id_girl).toBe(4);
    });
});

describe('TeamBuilderService -- Pos-2-7-Regel sub-cluster ordering', () => {

    it('builds the cluster around the largest sub-group in the cluster element pair', () => {
        // Pool: 5 stone-Bélier + 3 stone-Balance, all mythic.
        // Cluster-Wahl-Regel: stone -> zodiac Tier-3 category, sub-group
        // Bélier wins on size.
        const beliers = Array.from({ length: 5 }, (_, i) => girl({
            id_girl: 100 + i, rarity: 'mythic', element: 'stone',
            class: 3, zodiac: 'Bélier', carac3: 5000,
        }));
        const balances = Array.from({ length: 3 }, (_, i) => girl({
            id_girl: 200 + i, rarity: 'mythic', element: 'stone',
            class: 3, zodiac: 'Balance', carac3: 4000,
        }));
        const r = TeamBuilderService.buildTeam([...beliers, ...balances], 1, 100, 3)!;
        expect(r.traitCategory).toBe('zodiac');
        expect(r.traitValue).toBe('Bélier');
        // 5 Béliers in the eligible pool. Leader is one of them (key 4
        // trait match), so positions 2-7 contain the remaining 4 Béliers
        // plus 2 Balance fillers from the next-largest sub-group.
        const beliersInTeam = r.girls.slice(1).filter(g => g.zodiac === 'Bélier').length;
        expect(beliersInTeam).toBe(4);
        const balancesInTeam = r.girls.slice(1).filter(g => g.zodiac === 'Balance').length;
        expect(balancesInTeam).toBe(2);
    });
});

describe('TeamBuilderService -- mode 2 ranks under-developed mythics higher', () => {

    it('places a low-level mythic above a fully-developed one in mode 2 only', () => {
        // Two stone-Belier mythics:
        //   strongFully: lvl 750, max grades, carac3 = 5000  -> caracs_sum = 15000
        //   weakLowLevel: lvl 100, no grades, carac3 = 700   -> caracs_sum = 2100
        //                                            projected = 2100 * 7.5 * 2.5 = 39375
        // Mode 1 picks strongFully as leader (caracs_sum 15000 vs 2100).
        // Mode 2 picks weakLowLevel (projected 39375 vs 15000).
        const strongFully = girl({
            id_girl: 1, rarity: 'mythic', element: 'stone',
            class: 3, zodiac: 'Belier',
            level: 750, graded: 6, nb_grades: 6,
            carac1: 5000, carac2: 5000, carac3: 5000,
        });
        const weakLowLevel = girl({
            id_girl: 2, rarity: 'mythic', element: 'stone',
            class: 3, zodiac: 'Belier',
            level: 100, graded: 0, nb_grades: 6,
            carac1: 700, carac2: 700, carac3: 700,
        });
        const filler = Array.from({ length: 6 }, (_, i) => girl({
            id_girl: 100 + i, rarity: 'mythic', element: 'stone',
            class: 3, zodiac: 'Belier',
            level: 750, graded: 6, nb_grades: 6,
            carac1: 1000, carac2: 1000, carac3: 1000,
        }));
        const pool = [strongFully, weakLowLevel, ...filler];

        const m1 = TeamBuilderService.buildTeam(pool, 1, 100, 3)!;
        const m2 = TeamBuilderService.buildTeam(pool, 2, 100, 3)!;

        // Mode 1: strongFully wins on caracs_sum (15000 > 2100 > filler).
        expect(m1.girls[0].id_girl).toBe(1);
        // Mode 2: weakLowLevel wins on projected score (39375 > 15000 > filler).
        expect(m2.girls[0].id_girl).toBe(2);
    });
});

describe('TeamBuilderService -- leader from eligible pool', () => {

    it('picks a Mythic Shield from outside the bless pool when the bless pool has none', () => {
        // Bless 2 (element nature +20%, hair=FF0 cluster) -- 6 strong
        // nature legendaries with hair=FF0, no Mythic Shield among them.
        const blessPool = [
            // Pos 2-7 candidates
            ...Array.from({ length: 6 }, (_, i) => setBlessing(girl({
                id_girl: 200 + i,
                element: 'nature',
                rarity: 'legendary',
                nb_grades: 5,
                hairColor: 'FF0',
                eyeColor: 'XYZ',
                zodiac: 'BalanceX',
                carac3: 5000 - i,
                class: 1,
            }), [20])),
            // One nature Mythic Reflect inside the bless pool. Without
            // the fix she'd win as leader (Mythic, blessed, +20%).
            setBlessing(girl({
                id_girl: 300,
                element: 'nature',
                rarity: 'mythic',
                hairColor: 'FF0',
                eyeColor: 'F90',
                zodiac: 'NatureX',
                carac3: 5500,
                class: 3,
            }), [20]),
        ];
        // Mythic Light Shield in the eligible pool but NOT in the bless
        // pool (no [20] bless). She has hair=FF0 -> matches the cluster.
        const lightShield = girl({
            id_girl: 1,
            element: 'light',
            rarity: 'mythic',
            hairColor: 'FF0',
            eyeColor: 'A55',
            zodiac: 'CancerX',
            carac3: 4000,
            class: 3,
        });

        const r = TeamBuilderService.buildTeam([lightShield, ...blessPool], 1, 100, 3)!;
        expect(r).not.toBeNull();
        // Leader must be the light Mythic Shield from outside the bless pool.
        expect(r.girls[0].id_girl).toBe(1);
        expect(r.girls[0].element).toBe('light');
        expect(r.leaderTier5.name).toBe('Shield');
    });

    it('falls back to a Mythic Shield without trait match when no matching Shield exists', () => {
        // Bless pool of 6 nature legendaries with hair=FF0 + 1 nature
        // Mythic Reflect. Eligible pool also has a stone Mythic Shield
        // but with zodiac=Belier (no hairColor at all -- her trait is
        // zodiac, which does not match the hairColor cluster).
        const blessPool = [
            ...Array.from({ length: 6 }, (_, i) => setBlessing(girl({
                id_girl: 200 + i,
                element: 'nature',
                rarity: 'legendary',
                nb_grades: 5,
                hairColor: 'FF0',
                eyeColor: 'XYZ',
                zodiac: 'BalanceX',
                carac3: 5000 - i,
                class: 1,
            }), [20])),
            setBlessing(girl({
                id_girl: 300,
                element: 'nature',
                rarity: 'mythic',
                hairColor: 'FF0',
                carac3: 5500,
                class: 3,
            }), [20]),
        ];
        const stoneShield = girl({
            id_girl: 1,
            element: 'stone',
            rarity: 'mythic',
            zodiac: 'Belier',
            hairColor: 'XXX',
            carac3: 4000,
            class: 3,
        });

        const r = TeamBuilderService.buildTeam([stoneShield, ...blessPool], 1, 100, 3)!;
        expect(r).not.toBeNull();
        // No Mythic Shield with trait-match exists. The leader is the
        // stone Mythic Shield even though her trait does not match.
        // Tier-5 priority (Shield) trumps trait match.
        expect(r.girls[0].id_girl).toBe(1);
        expect(r.leaderTier5.name).toBe('Shield');
    });
});
