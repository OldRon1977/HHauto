import {
    ArmorItem,
    HeroTotals,
    battleValue,
    classCarac,
    parseHeroTotals,
    MYTHIC_MAX_LEVEL,
    activeResonance,
    classMatches,
    parseArmorItem,
    parseTheme,
    planCurrentBest,
    planPossibleBest,
    possibleBestTier,
    projectCaracs,
    projectedResonance,
    themeFromElementCounts,
    themeFromTeamData,
    themeMatches,
} from '../../src/Service/EquipmentOptimizerService';
import type { PlayerClass } from '../../src/Service/TeamScoringService';

const KNOW_HOW: PlayerClass = 3;

// The account the model was calibrated on: hero 1, class 3, wearing its
// own six mythics. Measured 2026-08-16 from the equip response.
const HERO: HeroTotals = {
    primary: 54843, secondary: 96509, endurance: 331530, chance: 86218,
};

/** Caracs a mythic really has at the given level (measured curve). */
function mythicCaracs(level: number) {
    const caracSum = 6000 + 300 * level;
    return {
        carac1: caracSum / 3,
        carac2: caracSum / 3,
        carac3: caracSum / 3,
        endurance: 2000 + 100 * level,
        chance: 3000 + 100 * level,
    };
}

let nextId = 1;

function mythic(opts: {
    slot: number;
    level: number;
    classId?: string | null;
    themeId?: string | null;
    equipped?: boolean;
    name?: string;
}): ArmorItem {
    const level = opts.level;
    return {
        id_member_armor: nextId++,
        id_member_armor_equipped: opts.equipped ? nextId++ : null,
        level,
        slot: opts.slot,
        rarity: 'mythic',
        name: opts.name ?? 'Mythic item',
        caracs: mythicCaracs(level),
        classResonance: opts.classId === undefined ? null : {
            identifier: opts.classId,
            resonance: 'damage',
            bonus: 0.1 * level,
        },
        themeResonance: opts.themeId === undefined ? null : {
            identifier: opts.themeId,
            resonance: 'defense',
            bonus: 0.1 * level,
        },
        equipped: opts.equipped === true,
    };
}

/** A legendary at player level: higher raw stats than a low-level mythic,
 *  and no resonance at all. */
function legendary(opts: { slot: number; equipped?: boolean; caracSum?: number }): ArmorItem {
    const caracSum = opts.caracSum ?? 10500;
    return {
        id_member_armor: nextId++,
        id_member_armor_equipped: opts.equipped ? nextId++ : null,
        level: 1,
        slot: opts.slot,
        rarity: 'legendary',
        name: 'Legendary item',
        caracs: {
            carac1: caracSum / 3,
            carac2: caracSum / 3,
            carac3: caracSum / 3,
            endurance: 3500,
            chance: 4500,
        },
        classResonance: null,
        themeResonance: null,
        equipped: opts.equipped === true,
    };
}

beforeEach(() => { nextId = 1; });

describe('resonance matching', () => {
    it('matches the class axis against the hero class number as a string', () => {
        const item = mythic({ slot: 1, level: 20, classId: '3', themeId: 'sun' });
        expect(classMatches(item, KNOW_HOW)).toBe(true);
        expect(classMatches(item, 1)).toBe(false);
    });

    it('treats identifier null as the Balanced theme, not as "no theme"', () => {
        const balanced = mythic({ slot: 1, level: 20, classId: '3', themeId: null });
        expect(themeMatches(balanced, 'balanced')).toBe(true);
        expect(themeMatches(balanced, 'sun')).toBe(false);

        const sun = mythic({ slot: 1, level: 20, classId: '3', themeId: 'sun' });
        expect(themeMatches(sun, 'balanced')).toBe(false);
        expect(themeMatches(sun, 'sun')).toBe(true);
    });

    it('sums both axes independently when both match', () => {
        const both = mythic({ slot: 1, level: 20, classId: '3', themeId: 'sun' });
        expect(activeResonance(both, KNOW_HOW, 'sun')).toBeCloseTo(4.0);
        expect(activeResonance(both, KNOW_HOW, 'fire')).toBeCloseTo(2.0);
        expect(activeResonance(both, 1, 'fire')).toBeCloseTo(0);
    });

    it('doubles the per-level growth on the chance track', () => {
        const item = mythic({ slot: 1, level: 1, classId: '3' });
        item.classResonance!.resonance = 'chance';
        expect(projectedResonance(item, KNOW_HOW, 'balanced')).toBeCloseTo(4.0);
    });
});

describe('projection to max level', () => {
    it('projects a mythic onto the measured curve', () => {
        const lvl1 = mythic({ slot: 1, level: 1, classId: '3' });
        const { caracs, unreliable } = projectCaracs(lvl1);
        expect(unreliable).toBe(false);
        expect(caracs).toEqual(mythicCaracs(MYTHIC_MAX_LEVEL));
    });

    it('leaves non-mythics and maxed mythics untouched', () => {
        const leg = legendary({ slot: 1 });
        expect(projectCaracs(leg).caracs).toBe(leg.caracs);
        const maxed = mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId: '3' });
        expect(projectCaracs(maxed).caracs).toBe(maxed.caracs);
    });

    it('falls back to measured caracs and flags itself when the curve no longer holds', () => {
        const odd = mythic({ slot: 1, level: 5, classId: '3' });
        odd.caracs.endurance = 99999; // game rebalanced the curve
        const { caracs, unreliable } = projectCaracs(odd);
        expect(unreliable).toBe(true);
        expect(caracs).toBe(odd.caracs);
    });
});

// The one number the whole ranking rests on. Both sides measured on the
// live account 2026-08-16: a mythic at level 20 carries 4000/4000/4000
// caracs plus 4000 endurance and 5000 chance; a legendary at player level
// 661 carried 3606/3619/3467 + 3474 + 4634.57.
describe('mythic-vs-legendary break-even', () => {
    const realLegendary = legendary({ slot: 1 });
    realLegendary.caracs = {
        carac1: 3606, carac2: 3619, carac3: 3467, endurance: 3474, chance: 4634.57,
    };

    it('puts the break-even between mythic level 14 and 15', () => {
        const base = realLegendary.caracs;
        const legValue = battleValue(base, base, KNOW_HOW, HERO);
        const mythicValue = (lvl: number) => battleValue(mythicCaracs(lvl), base, KNOW_HOW, HERO);
        expect(mythicValue(14)).toBeLessThan(legValue);
        expect(mythicValue(15)).toBeGreaterThan(legValue);
    });

    // Without resonance the crossing is pure stats. mythic() puts no class
    // resonance on the item when classId is left out.
    it('keeps a level-14 mythic on the bench and fields a level-15 one when neither resonates', () => {
        for (const [level, expected] of [[14, 'Legendary item'], [15, 'Mythic item']] as const) {
            const m = mythic({ slot: 1, level });
            const worn = { ...realLegendary, equipped: true, id_member_armor_equipped: 999 };
            const plan = planCurrentBest([worn, m], KNOW_HOW, 'nature', HERO);
            expect(plan.picks.find(p => p.slot === 1)!.chosen!.name).toBe(expected);
        }
    });

    // Resonance on damage is inside the value now, so a matching mythic
    // wins earlier than a dead one. This is the behaviour the lexicographic
    // ordering could not express: it would have taken the legendary at 14
    // regardless of how much resonance the mythic carried.
    it('fields a level-14 mythic once its damage resonance is counted', () => {
        const m = mythic({ slot: 1, level: 14, classId: '3', themeId: 'nature' });
        const worn = { ...realLegendary, equipped: true, id_member_armor_equipped: 999 };
        const plan = planCurrentBest([worn, m], KNOW_HOW, 'nature', HERO);
        const pick = plan.picks.find(p => p.slot === 1)!;
        expect(pick.chosen!.name).toBe('Mythic item');
        // 1.4pp of the 2.8pp lands on defense and stays outside the value.
        expect(pick.unpricedResonanceDelta).toBeCloseTo(1.4);
    });
});

// The calibration run itself, replayed as a test. Slot 1 held a level-20
// mythic; two probe items were equipped in turn and the hero totals read
// straight out of the equip response. If the transfer factors or the model
// ever drift, this is what notices.
describe('battleValue reproduces the measured hero totals', () => {
    const wornMythic = mythicCaracs(20);
    const zero = { carac1: 0, carac2: 0, carac3: 0, endurance: 0, chance: 0 };

    // The two factors are not asserted directly -- they are only meaningful
    // through the totals they predict.
    const predict = (caracs: typeof zero) => {
        const value = battleValue(caracs, wornMythic, KNOW_HOW, HERO);
        // battleValue returns primary x endurance; recover the pair via the
        // endurance term so both can be checked against the measurement.
        const endurance = HERO.endurance - 0.5636 * wornMythic.endurance + 0.5636 * caracs.endurance;
        return { primary: value / endurance, endurance };
    };

    it('predicts the pure-endurance probe (0 carac, 43301 endurance)', () => {
        const p = predict({ ...zero, endurance: 43301 });
        expect(p.primary).toBeCloseTo(50442, -1);   // measured 50442
        expect(p.endurance).toBeCloseTo(353677, -1); // measured 353677
    });

    it('predicts the pure-carac probe (5783 carac3, 0 endurance)', () => {
        const p = predict({ ...zero, carac3: 5783 });
        expect(p.primary).toBeCloseTo(56804, -1);   // measured 56804
        expect(p.endurance).toBeCloseTo(329276, -1); // measured 329276
    });

    it('ranks the pure-carac probe above the mythic above the pure-endurance one', () => {
        const mono = battleValue({ ...zero, endurance: 43301 }, wornMythic, KNOW_HOW, HERO);
        const carac = battleValue({ ...zero, carac3: 5783 }, wornMythic, KNOW_HOW, HERO);
        const worn = battleValue(wornMythic, wornMythic, KNOW_HOW, HERO);
        expect(carac).toBeGreaterThan(worn);
        expect(worn).toBeGreaterThan(mono);
    });
});

describe('parseHeroTotals', () => {
    it('reads the equip response block', () => {
        expect(parseHeroTotals({
            carac1: 47525, carac2: 48984, carac3: 50442, endurance: 353677,
            chance: 86218, primary_carac_amount: 50442, secondary_caracs_sum: 96509,
        })).toEqual({ primary: 50442, secondary: 96509, endurance: 353677, chance: 86218 });
    });

    it('refuses a block missing either field the ranking needs', () => {
        expect(parseHeroTotals({ endurance: 353677 })).toBeNull();
        expect(parseHeroTotals({ primary_carac_amount: 50442 })).toBeNull();
        expect(parseHeroTotals({ primary_carac_amount: 0, endurance: 1 })).toBeNull();
        expect(parseHeroTotals(null)).toBeNull();
    });
});

describe('planCurrentBest', () => {
    it('keeps the legendary when the mythic is below the raw break-even', () => {
        const worn = legendary({ slot: 1, equipped: true });
        const weakMythic = mythic({ slot: 1, level: 1, classId: '3', themeId: 'sun' });
        const plan = planCurrentBest([worn, weakMythic], KNOW_HOW, 'sun', HERO);
        const slot1 = plan.picks.find(p => p.slot === 1)!;
        expect(slot1.chosen).toBe(worn);
        expect(slot1.changed).toBe(false);
    });

    it('takes the mythic once its raw stats overtake the legendary', () => {
        const worn = legendary({ slot: 1, equipped: true });
        const strongMythic = mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId: '3', themeId: 'sun' });
        const plan = planCurrentBest([worn, strongMythic], KNOW_HOW, 'sun', HERO);
        const slot1 = plan.picks.find(p => p.slot === 1)!;
        expect(slot1.chosen).toBe(strongMythic);
        expect(slot1.changed).toBe(true);
        expect(slot1.valuePct).toBeGreaterThan(0);
    });

    it('never gives up raw stats for resonance', () => {
        const bigNoResonance = mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId: '1', themeId: 'fire', equipped: true });
        const smallPerfectResonance = mythic({ slot: 1, level: 1, classId: '3', themeId: 'sun' });
        const plan = planCurrentBest([bigNoResonance, smallPerfectResonance], KNOW_HOW, 'sun', HERO);
        expect(plan.picks.find(p => p.slot === 1)!.chosen).toBe(bigNoResonance);
        expect(plan.changes).toHaveLength(0);
    });

    it('prices the damage half of the resonance and leaves the defense half outside', () => {
        const dull = mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId: '1', themeId: 'fire', equipped: true });
        const resonant = mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId: '3', themeId: 'sun' });
        const plan = planCurrentBest([dull, resonant], KNOW_HOW, 'sun', HERO);
        const slot1 = plan.picks.find(p => p.slot === 1)!;
        expect(slot1.chosen).toBe(resonant);
        // Identical caracs, so the whole gain is the 2pp on damage.
        expect(slot1.valuePct).toBeCloseTo(2.0);
        expect(slot1.resonanceDelta).toBeCloseTo(4.0);
        expect(slot1.unpricedResonanceDelta).toBeCloseTo(2.0);
    });

    // The bug the flat carac sum shipped with: a legendary carrying 43,301
    // endurance and nothing else outscored every mythic, so the plan wanted
    // to strip all six slots for items that add no damage and no crit.
    it('does not trade a mythic for a legendary that carries only endurance', () => {
        const worn = mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId: '3', themeId: 'nature', equipped: true });
        const monoEndurance = legendary({ slot: 1 });
        monoEndurance.caracs = { carac1: 0, carac2: 0, carac3: 0, endurance: 43301, chance: 0 };
        const plan = planCurrentBest([worn, monoEndurance], KNOW_HOW, 'nature', HERO);
        expect(plan.picks.find(p => p.slot === 1)!.chosen).toBe(worn);
        expect(plan.changes).toHaveLength(0);
    });

    it('reports one pick per slot and no change for empty slots', () => {
        const plan = planCurrentBest([legendary({ slot: 2, equipped: true })], KNOW_HOW, 'balanced', HERO);
        expect(plan.picks).toHaveLength(6);
        expect(plan.changes).toHaveLength(0);
        expect(plan.picks.find(p => p.slot === 5)!.chosen).toBeNull();
    });
});

describe('planPossibleBest', () => {
    it('prefers class+theme over class-only over everything else', () => {
        const both = mythic({ slot: 1, level: 1, classId: '3', themeId: 'sun' });
        const classOnly = mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId: '3', themeId: 'fire' });
        const themeOnly = mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId: '1', themeId: 'sun' });
        expect(possibleBestTier(both, KNOW_HOW, 'sun')).toBe(1);
        expect(possibleBestTier(classOnly, KNOW_HOW, 'sun')).toBe(2);
        expect(possibleBestTier(themeOnly, KNOW_HOW, 'sun')).toBe(3);

        const plan = planPossibleBest([classOnly, themeOnly, both], KNOW_HOW, 'sun', HERO);
        expect(plan.picks.find(p => p.slot === 1)!.chosen).toBe(both);
    });

    it('equips the weaker item today and quantifies the gap it opens', () => {
        const worn = mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId: '1', themeId: 'fire', equipped: true });
        const target = mythic({ slot: 1, level: 1, classId: '3', themeId: 'sun' });
        const plan = planPossibleBest([worn, target], KNOW_HOW, 'sun', HERO);
        const slot1 = plan.picks.find(p => p.slot === 1)!;

        expect(slot1.chosen).toBe(target);
        expect(slot1.tier).toBe(1);
        // Costs raw points now...
        expect(slot1.valuePct).toBeLessThan(0);
        expect(plan.totalValuePct).toBeLessThan(0);
        // ...and is a pure resonance gain once both sit at max level.
        // Same caracs at max level, so the projected gain is exactly the
        // 2pp of damage resonance the target carries and the worn item does not.
        expect(slot1.projectedValuePct).toBeCloseTo(2.0);
        expect(slot1.projectedResonanceDelta).toBeCloseTo(4.0);
        expect(plan.totalProjectedResonanceDelta).toBeCloseTo(4.0);
    });

    it('does not count a theme match on the wrong class as a hit', () => {
        const themeOnly = mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId: '1', themeId: 'sun' });
        const classOnly = mythic({ slot: 1, level: 1, classId: '3', themeId: 'fire' });
        const plan = planPossibleBest([themeOnly, classOnly], KNOW_HOW, 'sun', HERO);
        expect(plan.picks.find(p => p.slot === 1)!.chosen).toBe(classOnly);
    });

    it('still equips a theme-only mythic when it is the only mythic for the slot', () => {
        const themeOnly = mythic({ slot: 1, level: 10, classId: '1', themeId: 'sun' });
        const leg = legendary({ slot: 1, equipped: true });
        const plan = planPossibleBest([themeOnly, leg], KNOW_HOW, 'sun', HERO);
        const slot1 = plan.picks.find(p => p.slot === 1)!;
        expect(slot1.chosen).toBe(themeOnly);
        expect(slot1.tier).toBe(3);
    });

    it('marks the pick when a projection could not be trusted', () => {
        const odd = mythic({ slot: 1, level: 5, classId: '3', themeId: 'sun' });
        odd.caracs.chance = 1;
        const plan = planPossibleBest([odd], KNOW_HOW, 'sun', HERO);
        expect(plan.picks.find(p => p.slot === 1)!.projectionUnreliable).toBe(true);
    });
});

describe('theme derivation', () => {
    it('needs three girls of one element, otherwise Balanced', () => {
        expect(themeFromElementCounts({ sun: 2, fire: 2, water: 3 })).toBe('water');
        expect(themeFromElementCounts({ sun: 2, fire: 2, water: 2 })).toBe('balanced');
        expect(themeFromElementCounts({})).toBe('balanced');
    });

    it('picks the larger stack when two elements clear the threshold', () => {
        expect(themeFromElementCounts({ sun: 3, fire: 4 })).toBe('fire');
    });

    it('rejects anything that is not a known theme', () => {
        expect(parseTheme('sun')).toBe('sun');
        expect(parseTheme('balanced')).toBe('balanced');
        expect(parseTheme('')).toBeNull();
        expect(parseTheme(undefined)).toBeNull();
        expect(parseTheme('elemental')).toBeNull();
    });
});

describe('themeFromTeamData', () => {
    const girls = [{}, {}, {}, {}, {}, {}, {}];

    it('takes the theme the game declares', () => {
        expect(themeFromTeamData({ theme: 'nature', girls })).toBe('nature');
    });

    it('falls back to theme_elements when theme is absent', () => {
        expect(themeFromTeamData({ theme_elements: [{ type: 'darkness' }], girls })).toBe('darkness');
    });

    it('reads a themeless but manned team as Balanced', () => {
        expect(themeFromTeamData({ theme: null, theme_elements: [], girls })).toBe('balanced');
    });

    // 22 of the 30 team slots on the test account look like this. Calling
    // them Balanced would hand the optimiser a theme for a team that does
    // not exist.
    it('reads an empty team slot as no theme at all', () => {
        expect(themeFromTeamData({ id_team: null, theme: null, girls: [] })).toBeNull();
        expect(themeFromTeamData(null)).toBeNull();
        expect(themeFromTeamData(undefined)).toBeNull();
    });
});

describe('parseArmorItem', () => {
    // Shape of a `player_inventory.armor` / `market_get_armor` entry as
    // measured on 2026-08-16: it carries id_member_armor and never
    // id_member_armor_equipped.
    const raw = {
        id_member_armor: 6602031,
        level: 20,
        skin: { subtype: 1, wearer: 'hero', name: 'Dragon Helmet' },
        item: { rarity: 'mythic', type: 'armor' },
        caracs: { carac1: 4000, carac2: 4000, carac3: 4000, endurance: 4000, chance: 5000 },
        resonance_bonuses: {
            class: { identifier: '1', resonance: 'damage', bonus: 2 },
            theme: { identifier: 'stone', resonance: 'defense', bonus: 2 },
        },
    };

    it('maps an inventory entry', () => {
        const item = parseArmorItem(raw)!;
        expect(item.slot).toBe(1);
        expect(item.rarity).toBe('mythic');
        expect(item.equipped).toBe(false);
        expect(item.id_member_armor).toBe(6602031);
        expect(item.id_member_armor_equipped).toBeNull();
        expect(item.classResonance).toEqual({ identifier: '1', resonance: 'damage', bonus: 2 });
        expect(item.themeResonance!.identifier).toBe('stone');
        expect(classCarac(item.caracs, KNOW_HOW)).toBe(4000);
        expect(item.caracs.endurance).toBe(4000);
    });

    // An entry under #equiped carries id_member_armor_equipped and has no
    // id_member_armor key at all. Sniffing on the field instead of being
    // told dropped all six worn items and made every plan compare against
    // an empty slot.
    const equippedRaw = (() => {
        const { id_member_armor: _drop, ...rest } = raw;
        return { ...rest, id_member_armor_equipped: 2806061 };
    })();

    it('maps an equipped entry, which has no id_member_armor at all', () => {
        expect(parseArmorItem(equippedRaw)).toBeNull();

        const item = parseArmorItem(equippedRaw, true)!;
        expect(item.equipped).toBe(true);
        expect(item.id_member_armor).toBe(2806061);
        expect(item.id_member_armor_equipped).toBe(2806061);
        expect(item.slot).toBe(1);
    });

    it('accepts a chance value the game sends as a string', () => {
        const item = parseArmorItem({
            ...raw,
            caracs: { carac1: 3606, carac2: 3619, carac3: 3467, endurance: 3474, chance: '4634.57' },
        })!;
        expect(item.caracs.chance).toBeCloseTo(4634.57);
    });

    it('keeps a Balanced theme as null rather than the string "null"', () => {
        const item = parseArmorItem({
            ...raw,
            resonance_bonuses: {
                class: { identifier: '3', resonance: 'ego', bonus: 2 },
                theme: { identifier: null, resonance: 'chance', bonus: 4 },
            },
        })!;
        expect(item.themeResonance!.identifier).toBeNull();
        expect(themeMatches(item, 'balanced')).toBe(true);
    });

    it('rejects girl equipment and anything without a hero slot', () => {
        expect(parseArmorItem({ ...raw, skin: { subtype: 1, wearer: 'girl', name: 'x' } })).toBeNull();
        expect(parseArmorItem({ ...raw, skin: { subtype: 9, wearer: 'hero', name: 'x' } })).toBeNull();
        expect(parseArmorItem({ ...raw, skin: {} })).toBeNull();
        expect(parseArmorItem(null)).toBeNull();
        expect(parseArmorItem('nope')).toBeNull();
    });
});
