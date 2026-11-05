import { RESET_COST_PER_POINT, SkillModelService } from '../../src/Service/SkillModelService';
import { ElementType, GirlData, RarityType } from '../../src/Service/TeamScoringService';

const tiers = (...points: number[]) => Object.fromEntries(points.map((p, i) => [String(i + 1), { tier: i + 1, skill_points_used: p }]));

const girl = (id: number, extra: Partial<GirlData> = {}): GirlData => ({
    id_girl: id, name: 'G' + id, carac1: 0, carac2: 0, carac3: 0,
    caracs: { carac1: 3500, carac2: 3500, carac3: 11550 },
    level: 750, class: 3, element: 'stone' as ElementType, rarity: 'mythic' as RarityType, graded: 6, nb_grades: 6,
    skill_tiers_info: tiers(0, 0, 0, 0, 0), ...extra,
} as GirlData);

describe('SkillModelService unlocks', () => {
    it('needs grade t and the tier level today', () => {
        const g = girl(1, { level: 499, graded: 6 });
        expect(SkillModelService.isUnlocked(g, 3, 'now')).toBe(true);
        expect(SkillModelService.isUnlocked(g, 4, 'now')).toBe(false);
        expect(SkillModelService.isUnlocked(girl(2, { graded: 2 }), 3, 'now')).toBe(false);
    });

    it('opens every tier the grades allow at full development', () => {
        const g = girl(1, { level: 100, graded: 0 });
        expect(SkillModelService.targetPoints(g, 5, 'full')).toBe(5);
        const legendary3 = girl(2, { rarity: 'legendary', nb_grades: 3, graded: 3 });
        expect(SkillModelService.targetPoints(legendary3, 4, 'full')).toBe(0);
    });

    it('takes the maximum per rarity', () => {
        expect([1, 2, 3, 4, 5].map(t => SkillModelService.maxPoints('mythic', t as 1))).toEqual([6, 10, 5, 5, 5]);
        expect([1, 2, 3, 4, 5].map(t => SkillModelService.maxPoints('legendary', t as 1))).toEqual([6, 9, 4, 4, 4]);
    });
});

describe('SkillModelService.withTier2', () => {
    it('adds +5 % of the class carac and +350 on the two others for a mythic (measured)', () => {
        const out = SkillModelService.withTier2(girl(1), 'now', 1);
        expect(out.caracs!.carac3).toBeCloseTo(11550 * 1.05);
        expect(out.caracs!.carac1).toBeCloseTo(3850);
        expect(out.caracs!.carac2).toBeCloseTo(3850);
    });

    it('adds +4 % for a legendary', () => {
        const out = SkillModelService.withTier2(girl(1, { rarity: 'legendary', class: 2, caracs: { carac1: 4000, carac2: 10312.5, carac3: 4000 } }), 'now', 1);
        expect(out.caracs!.carac2).toBeCloseTo(10725);
    });

    it('scales the flat part with the blessing', () => {
        const out = SkillModelService.withTier2(girl(1), 'now', 1.4);
        expect(out.caracs!.carac1).toBeCloseTo(3500 + 350 * 1.4);
    });

    it('adds nothing to a girl who holds full Tier 2', () => {
        const g = girl(1, { skill_tiers_info: tiers(6, 10, 0, 0, 0) });
        expect(SkillModelService.withTier2(g, 'now', 1)).toBe(g);
    });

    it('adds only the missing points, flat node first', () => {
        const out = SkillModelService.withTier2(girl(1, { skill_tiers_info: tiers(6, 3, 0, 0, 0) }), 'now', 1);
        expect(out.caracs!.carac1).toBeCloseTo(3500 + 2 * 70);
        expect(out.caracs!.carac3).toBeCloseTo(11550 * 1.05);
    });

    it('adds nothing before grade 2 and level 200', () => {
        const g = girl(1, { level: 150 });
        expect(SkillModelService.withTier2(g, 'now', 1)).toBe(g);
        expect(SkillModelService.withTier2(g, 'full', 1)).not.toBe(g);
    });
});

describe('SkillModelService Tier 3', () => {
    const black = (id: number, element: ElementType, rarity: RarityType, t3: number) =>
        girl(id, { element, rarity, hairColor: '000', skill_tiers_info: tiers(6, 10, t3, 0, 0) });

    it('counts teammates of any element that share the trait value', () => {
        const team = [black(1, 'nature', 'mythic', 5), black(2, 'darkness', 'legendary', 0), black(3, 'water', 'legendary', 0),
            girl(4, { element: 'darkness', hairColor: 'FFF' })];
        expect(SkillModelService.traitMatches(team[0], team)).toBe(2);
    });

    it('counts every girl with the trait, herself included, and applies the sum once', () => {
        const team = [black(1, 'nature', 'mythic', 5), black(2, 'nature', 'mythic', 5), black(3, 'nature', 'legendary', 4), black(4, 'nature', 'legendary', 4),
            black(5, 'darkness', 'legendary', 0), black(6, 'water', 'legendary', 0), black(7, 'darkness', 'legendary', 0)];
        // (5 + 5 + 4 + 4) points x 7 girls with black hair x 0.2 %
        expect(SkillModelService.tier3Bonus(team, g => SkillModelService.currentPoints(g, 3))).toBeCloseTo(0.252);
    });

    it('gives a skilled girl her bonus without any match (measured: 1 % for a full mythic)', () => {
        const team = [black(1, 'nature', 'mythic', 5), girl(2, { element: 'nature', hairColor: 'FFF' })];
        expect(SkillModelService.tier3Bonus(team, g => SkillModelService.currentPoints(g, 3))).toBeCloseTo(0.01);
    });

    it('adds the Tier 3 a girl without bulbs will get after Stuff Team', () => {
        const team = [black(1, 'nature', 'mythic', 5), black(2, 'nature', 'mythic', 0), black(3, 'darkness', 'legendary', 0)];
        // Each nature mythic: 5 points x 3 girls with black hair x 0.2 % = 3 %;
        // the darkness legendary: 4 points on her own eye colour x 0.2 % = 0.8 %.
        expect(SkillModelService.tier3Bonus(team, g => SkillModelService.targetPoints(g, 3, 'now'))).toBeCloseTo(0.068);
    });

    it('gives a team without skills no Tier-3 bonus', () => {
        const team = [1, 2, 3].map(id => girl(id, { element: 'nature', hairColor: String(id), skill_tiers_info: tiers(0, 0, 0, 0, 0), level: 100 }));
        expect(SkillModelService.tier3Bonus(team, g => SkillModelService.targetPoints(g, 3, 'now'))).toBe(0);
    });
});

describe('SkillModelService.fightSkillTiers', () => {
    it('gives every girl full Tier 4 and only the leader full Tier 5', () => {
        const team = [girl(1), girl(2), girl(3, { rarity: 'legendary' })];
        const out = SkillModelService.fightSkillTiers(team, 'now');
        expect(out.map(t => t['4'].skill_points_used)).toEqual([5, 5, 4]);
        expect(out[0]['5'].skill_points_used).toBe(5);
        expect(out[1]['5'].skill_points_used).toBe(0);
    });

    it('leaves Tier 5 at 0 below level 650 today', () => {
        const out = SkillModelService.fightSkillTiers([girl(1, { level: 600 })], 'now');
        expect(out[0]['5'].skill_points_used).toBe(0);
        expect(out[0]['4'].skill_points_used).toBe(5);
    });
});

describe('SkillModelService.prepareSummary', () => {
    it('counts gear and skills and sorts by points', () => {
        const s = SkillModelService.prepareSummary([
            { id_girl: 1, armor: [{}], skill_tiers_info: tiers(6, 10, 5, 5, 5) },
            { id_girl: 2, armor: [], skill_tiers_info: tiers(0, 0, 0) },
            { id_girl: 3, armor: [{}, {}], skill_tiers_info: tiers(6, 9, 4, 4) },
        ]);
        expect(s).toMatchObject({ withGear: 2, withSkills: 2, points: 54 });
        expect(s.skilled.map(g => g.id)).toEqual([1, 3]);
        expect(31 * RESET_COST_PER_POINT).toBe(155000000);
    });
});
