// SkillModelService.ts -- The girls' skill tiers as the team calculation
// counts them: every candidate is scored as if Stuff Team had filled her
// skills, whatever she holds today.
//
// Why: bulbs move between girls (Stuff Team resets other girls and spends
// them on the team), so a girl who holds bulbs today must not beat one who
// does not. "Prepare for Calculation" resets everyone; this model then adds
// back what Stuff Team would give the team. A girl who still holds her
// skills gets only what she is missing, so the model also works without
// the reset.
//
// Measured on a live account (team_calculate_caracs, girl_skills_list):
// - Tier 1 (income) does not touch the stats.
// - Tier 2 is in the girl's caracs: per point up to five +70 on each of the
//   two caracs that are not her class carac (node 5, which Stuff Team takes
//   first), then +1 % of her class carac per point (node 4). The league
//   blessing multiplies both (factor 14.831 = 10.593 x 1.4).
// - Tier 3 is NOT in the girl's caracs but in the team's damage: per point
//   +0.2 % for every teammate who shares her trait value, from the first
//   match on (no threshold), the bonuses of all girls summed and applied
//   once: damage x (1 + sum). Model against measurement within 0.7 % over
//   six teams and three skill states. The trait is the one of her element
//   pair; teammates of any element count.
// - Tier 4 and 5 act in the fight only; BDSMHelper reads their points
//   (tier 4 of all girls, tier 5 of the leader).
// - Points per tier: mythic 6/10/5/5/5, legendary 6/9/4/4/4. A tier needs
//   grade t and the level of TIER_LEVEL.
//
// Depends on: TeamScoringService.ts (GirlData, Tier-3 category)
// Used by: TeamSelectionPopup.ts, TeamModule.ts

import { GirlData, RarityType, TeamScoringService, TraitCategory } from './TeamScoringService';

/** 'now': only the tiers the girl has unlocked today; 'full': level 750 and every grade. */
export type SkillHorizon = 'now' | 'full';

type Tier = 1 | 2 | 3 | 4 | 5;

const MAX_POINTS: Partial<Record<RarityType, Record<Tier, number>>> = {
    mythic:    { 1: 6, 2: 10, 3: 5, 4: 5, 5: 5 },
    legendary: { 1: 6, 2: 9,  3: 4, 4: 4, 5: 4 },
};

const TIER_LEVEL: Record<Tier, number> = { 1: 10, 2: 200, 3: 350, 4: 500, 5: 650 };

const FULL_LEVEL = 750;

/** Tier 2: the flat node first (5 points, +70 per point), then the percent node. */
const T2_FLAT_POINTS = 5;
const T2_FLAT_PER_POINT = 70;
const T2_PERCENT_PER_POINT = 0.01;

/** Tier 3, attack node: per point and per matching teammate. */
const T3_PER_POINT = 0.002;

/** The game charges this much money per skill point for a reset (155M for a full mythic). */
export const RESET_COST_PER_POINT = 5000000;

/** What "Prepare for Calculation" finds on the page: availableGirls entries. */
export interface PrepareSummary {
    withGear: number;
    withSkills: number;
    /** Girls with skill points, most points first. */
    skilled: { id: number; points: number }[];
    points: number;
}

export type SkillTierInfo = Record<string, { skill_points_used?: number } & Record<string, unknown>>;

export class SkillModelService {

    static prepareSummary(raw: Record<string, unknown>[]): PrepareSummary {
        let withGear = 0;
        const skilled: { id: number; points: number }[] = [];
        for (const g of raw) {
            const armor = g.armor;
            if (Array.isArray(armor) ? armor.length > 0 : !!armor && Object.keys(armor as object).length > 0) withGear++;
            const tiers = Object.values((g.skill_tiers_info ?? {}) as Record<string, { skill_points_used?: number } | null>);
            const points = tiers.reduce((sum, t) => sum + (Number(t?.skill_points_used) || 0), 0);
            if (points > 0) skilled.push({ id: Number(g.id_girl), points });
        }
        skilled.sort((a, b) => b.points - a.points);
        return { withGear, withSkills: skilled.length, skilled, points: skilled.reduce((s, g) => s + g.points, 0) };
    }

    static maxPoints(rarity: RarityType, tier: Tier): number {
        return MAX_POINTS[rarity]?.[tier] ?? 0;
    }

    static isUnlocked(girl: GirlData, tier: Tier, horizon: SkillHorizon): boolean {
        if (SkillModelService.maxPoints(girl.rarity, tier) === 0) return false;
        const level = horizon === 'full' ? FULL_LEVEL : Number(girl.level) || 0;
        const grades = horizon === 'full' ? Number(girl.nb_grades) || 0 : Number(girl.graded) || 0;
        return level >= TIER_LEVEL[tier] && grades >= tier;
    }

    static currentPoints(girl: GirlData, tier: Tier): number {
        const info = girl.skill_tiers_info as SkillTierInfo | undefined;
        return Number(info?.[tier]?.skill_points_used) || 0;
    }

    /** Points the girl holds after Stuff Team: the maximum of every unlocked tier. */
    static targetPoints(girl: GirlData, tier: Tier, horizon: SkillHorizon): number {
        const current = SkillModelService.currentPoints(girl, tier);
        const target = SkillModelService.isUnlocked(girl, tier, horizon) ? SkillModelService.maxPoints(girl.rarity, tier) : 0;
        return Math.max(current, target);
    }

    /**
     * The girl with the Tier-2 stats she is missing added to her caracs.
     * `blessing` is the multiplier her league blessing gives in the week the
     * caracs belong to (1 without blessing).
     */
    static withTier2(girl: GirlData, horizon: SkillHorizon, blessing: number): GirlData {
        const cls = Number(girl.class);
        if (cls !== 1 && cls !== 2 && cls !== 3) return girl;
        const current = SkillModelService.currentPoints(girl, 2);
        const target = SkillModelService.targetPoints(girl, 2, horizon);
        if (target <= current) return girl;
        const flatPoints = Math.min(target, T2_FLAT_POINTS) - Math.min(current, T2_FLAT_POINTS);
        const percentPoints = Math.max(0, target - T2_FLAT_POINTS) - Math.max(0, current - T2_FLAT_POINTS);
        const src = girl.caracs ?? { carac1: girl.carac1, carac2: girl.carac2, carac3: girl.carac3 };
        const caracs = { carac1: Number(src.carac1) || 0, carac2: Number(src.carac2) || 0, carac3: Number(src.carac3) || 0 };
        const mult = blessing > 0 ? blessing : 1;
        const own = ('carac' + cls) as keyof typeof caracs;
        for (const key of ['carac1', 'carac2', 'carac3'] as const) {
            if (key === own) caracs[key] *= 1 + percentPoints * T2_PERCENT_PER_POINT;
            else caracs[key] += flatPoints * T2_FLAT_PER_POINT * mult;
        }
        return { ...girl, caracs, carac1: caracs.carac1, carac2: caracs.carac2, carac3: caracs.carac3 };
    }

    static traitValue(girl: GirlData, category: TraitCategory): string | undefined {
        switch (category) {
            case 'eyeColor':  return girl.eyeColor;
            case 'hairColor': return girl.hairColor;
            case 'zodiac':    return girl.zodiac;
            case 'position':  return girl.position;
        }
    }

    /** Teammates sharing the girl's own Tier-3 trait value. */
    static traitMatches(girl: GirlData, team: GirlData[]): number {
        const category = TeamScoringService.getTier3Category(girl.element);
        const value = SkillModelService.traitValue(girl, category);
        if (!value) return 0;
        return team.filter(o => o.id_girl !== girl.id_girl && SkillModelService.traitValue(o, category) === value).length;
    }

    /** Sum of the team's Tier-3 damage bonuses for the given points. */
    static tier3Bonus(team: GirlData[], points: (g: GirlData) => number): number {
        return team.reduce((sum, g) => sum + points(g) * T3_PER_POINT * SkillModelService.traitMatches(g, team), 0);
    }

    /**
     * Factor from the damage the game measured (the Tier-3 points held
     * today) to the damage after Stuff Team.
     */
    static tier3DamageFactor(team: GirlData[], horizon: SkillHorizon): number {
        const today = SkillModelService.tier3Bonus(team, g => SkillModelService.currentPoints(g, 3));
        const after = SkillModelService.tier3Bonus(team, g => SkillModelService.targetPoints(g, 3, horizon));
        return (1 + after) / (1 + today);
    }

    /**
     * The skill tiers the fight simulation reads, as after Stuff Team:
     * Tier 4 for every girl, Tier 5 for the leader (position 0).
     */
    static fightSkillTiers(team: GirlData[], horizon: SkillHorizon): SkillTierInfo[] {
        return team.map((g, index) => {
            const info: SkillTierInfo = { ...((g.skill_tiers_info as SkillTierInfo | undefined) ?? {}) };
            const tiers: Tier[] = index === 0 ? [4, 5] : [4];
            for (const tier of tiers) {
                info[tier] = { ...(info[tier] ?? {}), skill_points_used: SkillModelService.targetPoints(g, tier, horizon) };
            }
            return info;
        });
    }
}
