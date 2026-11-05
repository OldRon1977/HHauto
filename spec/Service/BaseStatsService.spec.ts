import { BaseStatsService } from '../../src/Service/BaseStatsService';

const tiers = (...points: number[]) => Object.fromEntries(points.map((p, i) => [String(i + 1), { tier: i + 1, skill_points_used: p }]));
const blessed = (...p: number[]) => ({ pvp_v3: { carac1: p, carac2: p, carac3: p } });

// Definition 55/40/20 at level 750, grade 5, blessed 25 % twice:
// 750 x (1 + 0.3 x 5) / 10 x 1.5625 = 292.96875 per definition point.
const F = 750 * 2.5 / 10 * 1.5625;
const raw = (extra: Record<string, unknown> = {}) => ({
    id_girl: 1, level: 750, graded: 5, nb_grades: 5,
    caracs: { carac1: 55 * F, carac2: 40 * F, carac3: 20 * F },
    armor: [], skill_tiers_info: tiers(0, 0, 0, 0, 0), blessing_bonuses: blessed(25, 25),
    ...extra,
});

describe('BaseStatsService', () => {
    it('reads a girl without gear and Tier 2 back to her definition', () => {
        const def = BaseStatsService.definitionFromCaracs(raw())!;
        expect(def[0]).toBeCloseTo(55, 9);
        expect(def[1]).toBeCloseTo(40, 9);
        expect(def[2]).toBeCloseTo(20, 9);
    });

    it('counts a girl as bare unless she wears gear or holds Tier 2', () => {
        expect(BaseStatsService.isBare(raw({ skill_tiers_info: tiers(6, 0, 4, 4, 4) }))).toBe(true);
        expect(BaseStatsService.isBare(raw({ skill_tiers_info: tiers(6, 9, 0, 0, 0) }))).toBe(false);
        expect(BaseStatsService.isBare(raw({ armor: [{}] }))).toBe(false);
        expect(BaseStatsService.needingDefinition([raw(), raw({ id_girl: 2, armor: [{}] })])).toEqual([2]);
    });

    it('strips gear and skills: caracs from the definition, every skill point at 0', () => {
        const worn = raw({ caracs: { carac1: 99999, carac2: 99999, carac3: 99999 }, armor: [{}], skill_tiers_info: tiers(6, 9, 4, 4, 4) });
        const out = BaseStatsService.strip(worn, [55, 40, 20], 'now');
        expect(out.caracs.carac1).toBeCloseTo(55 * F, 6);
        expect(out.caracs.carac3).toBeCloseTo(20 * F, 6);
        expect(out.armor).toEqual([]);
        expect(Object.values(out.skill_tiers_info as Record<string, { skill_points_used: number }>).map(t => t.skill_points_used)).toEqual([0, 0, 0, 0, 0]);
    });

    it('develops to level 750 and every grade for the full horizon', () => {
        const young = raw({ level: 300, graded: 2, caracs: { carac1: 55 * 300 * 1.6 / 10 * 1.5625, carac2: 40 * 300 * 1.6 / 10 * 1.5625, carac3: 20 * 300 * 1.6 / 10 * 1.5625 } });
        const out = BaseStatsService.strip(young, null, 'full');
        expect(out.caracs.carac1).toBeCloseTo(55 * F, 6);
    });

    it('leaves a girl with gear and no definition as she is', () => {
        const worn = raw({ armor: [{}] });
        expect(BaseStatsService.strip(worn, undefined, 'now')).toBe(worn);
    });
});
