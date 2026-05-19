import {
    TeamScoringService,
    GirlData,
    ElementType,
    RarityType,
} from '../../src/Service/TeamScoringService';

let nextId = 1;

function girl(overrides: Partial<GirlData> = {}): GirlData {
    const id = overrides.id_girl ?? nextId++;
    return {
        id_girl: id,
        name: 'Girl_' + id,
        carac1: 1000,
        carac2: 2000,
        carac3: 3000,
        level: 100,
        class: 1,
        element: 'fire' as ElementType,
        rarity: 'mythic' as RarityType,
        graded: 0,
        nb_grades: 5,
        ...overrides,
    };
}

beforeEach(() => { nextId = 1; });

describe('TeamScoringService', () => {

    describe('caracsSum', () => {
        it('reads carac1+carac2+carac3 directly when caracs sub-object is missing', () => {
            const g = girl({ carac1: 100, carac2: 200, carac3: 300 });
            expect(TeamScoringService.caracsSum(g)).toBe(600);
        });

        it('prefers caracs sub-object when both are present (game-authoritative path)', () => {
            const g = girl({
                carac1: 100, carac2: 200, carac3: 300,
                caracs: { carac1: 500, carac2: 600, carac3: 700 },
            });
            expect(TeamScoringService.caracsSum(g)).toBe(1800);
        });
    });

    describe('scoreCurrentBest', () => {
        it('returns the caracs_sum regardless of player class', () => {
            const g = girl({ carac1: 1000, carac2: 2000, carac3: 5000 });
            expect(TeamScoringService.scoreCurrentBest(g, 1)).toBe(8000);
            expect(TeamScoringService.scoreCurrentBest(g, 2)).toBe(8000);
            expect(TeamScoringService.scoreCurrentBest(g, 3)).toBe(8000);
        });
    });

    describe('scoreBestPossible', () => {
        it('projects under-developed girls upward', () => {
            // sum = 6000, level 50, no grades, max grades 5
            // projected = 6000 * (750/50) * (1 + 1.5) / 1 = 6000 * 15 * 2.5 = 225000
            const g = girl({ carac1: 1000, carac2: 2000, carac3: 3000, level: 50, graded: 0, nb_grades: 5 });
            expect(TeamScoringService.scoreBestPossible(g)).toBe(225000);
        });

        it('returns the current sum when the girl is voll-awakt', () => {
            const g = girl({ carac1: 4000, carac2: 4000, carac3: 4000, level: 750, graded: 5, nb_grades: 5 });
            expect(TeamScoringService.scoreBestPossible(g)).toBeCloseTo(12000, 5);
        });
    });

    describe('filterEligible', () => {
        it('keeps mythic and 5-star legendary, drops anything else', () => {
            const pool = [
                girl({ id_girl: 1, rarity: 'mythic', nb_grades: 6 }),
                girl({ id_girl: 2, rarity: 'legendary', nb_grades: 5 }),
                girl({ id_girl: 3, rarity: 'legendary', nb_grades: 3 }),
                girl({ id_girl: 4, rarity: 'epic' }),
                girl({ id_girl: 5, rarity: 'common' }),
            ];
            const out = TeamScoringService.filterEligible(pool);
            expect(out.map(g => g.id_girl).sort()).toEqual([1, 2]);
        });

        it('keeps cross-class girls (the leader rule has no own-class tiebreaker)', () => {
            const pool = [
                girl({ id_girl: 1, rarity: 'mythic', nb_grades: 6, class: 1 }),
                girl({ id_girl: 2, rarity: 'mythic', nb_grades: 6, class: 2 }),
                girl({ id_girl: 3, rarity: 'mythic', nb_grades: 6, class: 3 }),
            ];
            expect(TeamScoringService.filterEligible(pool, 3)).toHaveLength(3);
        });
    });

    describe('getTier3Category', () => {
        it('maps element pairs to their shared trait category', () => {
            expect(TeamScoringService.getTier3Category('darkness')).toBe('eyeColor');
            expect(TeamScoringService.getTier3Category('fire')).toBe('eyeColor');
            expect(TeamScoringService.getTier3Category('light')).toBe('hairColor');
            expect(TeamScoringService.getTier3Category('nature')).toBe('hairColor');
            expect(TeamScoringService.getTier3Category('stone')).toBe('zodiac');
            expect(TeamScoringService.getTier3Category('psychic')).toBe('zodiac');
            expect(TeamScoringService.getTier3Category('water')).toBe('position');
            expect(TeamScoringService.getTier3Category('sun')).toBe('position');
        });
    });

    describe('getTier5Skill priority order Shield > Stun > Execute > Reflect', () => {
        it('returns Shield (priority 4) for light and stone', () => {
            expect(TeamScoringService.getTier5Skill('light').priority).toBe(4);
            expect(TeamScoringService.getTier5Skill('stone').priority).toBe(4);
        });
        it('returns Stun (priority 3) for sun and darkness', () => {
            expect(TeamScoringService.getTier5Skill('sun').priority).toBe(3);
            expect(TeamScoringService.getTier5Skill('darkness').priority).toBe(3);
        });
        it('returns Execute (priority 2) for fire and water', () => {
            expect(TeamScoringService.getTier5Skill('fire').priority).toBe(2);
            expect(TeamScoringService.getTier5Skill('water').priority).toBe(2);
        });
        it('returns Reflect (priority 1) for psychic and nature', () => {
            expect(TeamScoringService.getTier5Skill('psychic').priority).toBe(1);
            expect(TeamScoringService.getTier5Skill('nature').priority).toBe(1);
        });
    });

    describe('getElementPowerCoeff', () => {
        it('returns the empirical per-element strength values', () => {
            expect(TeamScoringService.getElementPowerCoeff('darkness')).toBe(1.20);
            expect(TeamScoringService.getElementPowerCoeff('fire')).toBe(1.12);
            expect(TeamScoringService.getElementPowerCoeff('stone')).toBe(1.12);
            expect(TeamScoringService.getElementPowerCoeff('light')).toBe(1.00);
            expect(TeamScoringService.getElementPowerCoeff('sun')).toBe(1.00);
        });
    });

    describe('calculateTier3TeamBonus', () => {
        it('returns 0 for empty team', () => {
            expect(TeamScoringService.calculateTier3TeamBonus([])).toBe(0);
        });

        it('counts within-pair trait matches at 1% per Mythic match', () => {
            const team = [
                girl({ id_girl: 1, element: 'fire', eyeColor: 'F00', rarity: 'mythic' }),
                girl({ id_girl: 2, element: 'fire', eyeColor: 'F00', rarity: 'mythic' }),
                girl({ id_girl: 3, element: 'darkness', eyeColor: 'F00', rarity: 'mythic' }),
            ];
            expect(TeamScoringService.calculateTier3TeamBonus(team)).toBeCloseTo(0.06, 5);
        });

        it('discounts legendary matches to 0.8%', () => {
            const team = [
                girl({ id_girl: 1, element: 'fire', eyeColor: 'F00', rarity: 'legendary' }),
                girl({ id_girl: 2, element: 'fire', eyeColor: 'F00', rarity: 'legendary' }),
            ];
            expect(TeamScoringService.calculateTier3TeamBonus(team)).toBeCloseTo(0.016, 5);
        });

        it('does not count cross-pair matches', () => {
            const team = [
                girl({ id_girl: 1, element: 'fire', eyeColor: 'F00' }),
                girl({ id_girl: 2, element: 'light', hairColor: 'F00' }),
            ];
            expect(TeamScoringService.calculateTier3TeamBonus(team)).toBe(0);
        });
    });
});