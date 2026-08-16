import {
    ArmorItem,
    MYTHIC_MAX_LEVEL,
    activeResonance,
    caracSum,
    classMatches,
    fallbackScore,
    gearTier,
    parseArmorItem,
    parseTheme,
    planCurrentBest,
    planPossibleBest,
    projectCaracs,
    projectedResonance,
    themeFromElementCounts,
    themeFromTeamData,
    themeMatches,
} from '../../src/Service/EquipmentOptimizerService';
import type { PlayerClass } from '../../src/Service/TeamScoringService';

const KNOW_HOW: PlayerClass = 3;

/** Caracs a mythic really has at the given level (measured curve). At level
 *  20 this is 4000/4000/4000/4000/5000 -- the single tuple found on all 576
 *  capped mythic slots across the 99 crawled league players. */
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
    themeTarget?: 'defense' | 'chance';
    equipped?: boolean;
    name?: string;
}): ArmorItem {
    const level = opts.level;
    // The theme axis pays double on the chance track (measured: 4pp vs 2pp
    // at level 20).
    const themeTarget = opts.themeTarget ?? 'defense';
    return {
        id_member_armor: nextId++,
        id_member_armor_equipped: opts.equipped ? nextId++ : null,
        level,
        slot: opts.slot,
        rarity: 'mythic',
        name: opts.name ?? 'Mythic item',
        caracs: mythicCaracs(level),
        classResonance: opts.classId === undefined ? null : {
            identifier: opts.classId, resonance: 'damage', bonus: 0.1 * level,
        },
        themeResonance: opts.themeId === undefined ? null : {
            identifier: opts.themeId,
            resonance: themeTarget,
            bonus: (themeTarget === 'chance' ? 0.2 : 0.1) * level,
        },
        equipped: opts.equipped === true,
    };
}

/** A legendary at player level. Player items of this rarity carry no
 *  resonance at all -- none of the 12 legendary slots in the league did. */
function legendary(opts: {
    slot: number;
    equipped?: boolean;
    caracs?: Partial<ReturnType<typeof mythicCaracs>>;
    name?: string;
}): ArmorItem {
    return {
        id_member_armor: nextId++,
        id_member_armor_equipped: opts.equipped ? nextId++ : null,
        level: 660,
        slot: opts.slot,
        rarity: 'legendary',
        name: opts.name ?? 'Legendary item',
        caracs: {
            carac1: 3606, carac2: 3619, carac3: 3467,
            endurance: 3474, chance: 4634.57,
            ...opts.caracs,
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
        const item = mythic({ slot: 1, level: 20, classId: '3', themeId: 'sun', themeTarget: 'chance' });
        expect(activeResonance(item, KNOW_HOW, 'sun')).toBeCloseTo(6.0); // 2 + 4
    });
});

describe('gearTier', () => {
    const capped = (classId?: string, themeId?: string) =>
        mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId, themeId });

    it('orders class+theme, class, theme, bare mythic, then the rest', () => {
        expect(gearTier(capped('3', 'sun'), KNOW_HOW, 'sun', 'current')).toBe(1);
        expect(gearTier(capped('3', 'fire'), KNOW_HOW, 'sun', 'current')).toBe(2);
        expect(gearTier(capped('1', 'sun'), KNOW_HOW, 'sun', 'current')).toBe(3);
        expect(gearTier(capped('1', 'fire'), KNOW_HOW, 'sun', 'current')).toBe(4);
        expect(gearTier(legendary({ slot: 1 }), KNOW_HOW, 'sun', 'current')).toBe(5);
    });

    // The split that keeps "Current Best" honest: today an unlevelled mythic
    // is just a weak item, but it is still the better target.
    it('drops an unlevelled mythic to tier 5 for Current Best only', () => {
        const young = mythic({ slot: 1, level: 3, classId: '3', themeId: 'sun' });
        expect(gearTier(young, KNOW_HOW, 'sun', 'current')).toBe(5);
        expect(gearTier(young, KNOW_HOW, 'sun', 'possible')).toBe(1);
    });
});

describe('fallbackScore', () => {
    it('sends an item with a hole in it to the bottom', () => {
        // The legendary the first stat model picked: 43,301 endurance, zero
        // of everything else.
        const mono = legendary({ slot: 1, caracs: {
            carac1: 0, carac2: 0, carac3: 0, endurance: 43301, chance: 0,
        } });
        const balanced = legendary({ slot: 1 });
        expect(caracSum(mono.caracs)).toBeGreaterThan(caracSum(balanced.caracs));
        expect(fallbackScore(mono.caracs, KNOW_HOW)).toBe(0);
        expect(fallbackScore(balanced.caracs, KNOW_HOW)).toBeGreaterThan(0);
    });

    it('prefers the stronger of two balanced items', () => {
        const big = legendary({ slot: 1, caracs: { carac1: 5000, carac2: 5000, carac3: 5000, endurance: 5000, chance: 5000 } });
        const small = legendary({ slot: 1 });
        expect(fallbackScore(big.caracs, KNOW_HOW))
            .toBeGreaterThan(fallbackScore(small.caracs, KNOW_HOW));
    });
});

describe('planCurrentBest', () => {
    // The finding the whole model rests on: 582 of 594 equipped slots in the
    // league are mythic, and the four players wearing legendaries sit at
    // places 49, 60, 80 and 95.
    it('keeps a capped mythic rather than trading it for any legendary', () => {
        const worn = mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId: '3', themeId: 'nature', equipped: true });
        const monoEndurance = legendary({ slot: 1, caracs: {
            carac1: 0, carac2: 0, carac3: 0, endurance: 43301, chance: 0,
        } });
        const balancedLegendary = legendary({ slot: 1 });
        const plan = planCurrentBest([worn, monoEndurance, balancedLegendary], KNOW_HOW, 'nature');
        expect(plan.picks.find(p => p.slot === 1)!.chosen).toBe(worn);
        expect(plan.changes).toHaveLength(0);
    });

    it('walks up the ladder: class+theme beats class beats theme beats bare', () => {
        const bare = mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId: '1', themeId: 'fire', equipped: true });
        const themeOnly = mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId: '1', themeId: 'sun' });
        const classOnly = mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId: '3', themeId: 'fire' });
        const both = mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId: '3', themeId: 'sun' });

        const pick = (items: ArmorItem[]) =>
            planCurrentBest(items, KNOW_HOW, 'sun').picks.find(p => p.slot === 1)!.chosen;
        expect(pick([bare])).toBe(bare);
        expect(pick([bare, themeOnly])).toBe(themeOnly);
        expect(pick([bare, themeOnly, classOnly])).toBe(classOnly);
        expect(pick([bare, themeOnly, classOnly, both])).toBe(both);
    });

    // Two tier-1 items are carac-identical, so the only thing left is how
    // much resonance they carry: 4pp on the chance track against 2pp on
    // defense.
    it('prefers the larger bonus when two items share a tier', () => {
        const onDefense = mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId: '3', themeId: 'sun', themeTarget: 'defense', equipped: true });
        const onChance = mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId: '3', themeId: 'sun', themeTarget: 'chance' });
        const plan = planCurrentBest([onDefense, onChance], KNOW_HOW, 'sun');
        const slot1 = plan.picks.find(p => p.slot === 1)!;
        expect(slot1.chosen).toBe(onChance);
        expect(slot1.tier).toBe(1);
        expect(slot1.caracDelta).toBeCloseTo(0);
        expect(slot1.resonanceDelta).toBeCloseTo(2.0); // 6pp against 4pp
    });

    // Without this an unlevelled mythic would displace a working legendary
    // and leave the player ~40% weaker in that slot for 0.1pp of resonance.
    it('does not put a level-1 mythic over a legendary at player level', () => {
        const worn = legendary({ slot: 1, equipped: true });
        const fresh = mythic({ slot: 1, level: 1, classId: '3', themeId: 'nature' });
        const plan = planCurrentBest([worn, fresh], KNOW_HOW, 'nature');
        expect(plan.picks.find(p => p.slot === 1)!.chosen).toBe(worn);
        expect(plan.changes).toHaveLength(0);
    });

    it('reports one pick per slot and no change for empty slots', () => {
        const plan = planCurrentBest([legendary({ slot: 2, equipped: true })], KNOW_HOW, 'balanced');
        expect(plan.picks).toHaveLength(6);
        expect(plan.changes).toHaveLength(0);
        expect(plan.picks.find(p => p.slot === 5)!.chosen).toBeNull();
    });
});

describe('planPossibleBest', () => {
    it('takes the unlevelled mythic and says what it costs today', () => {
        const worn = mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId: '1', themeId: 'fire', equipped: true });
        const target = mythic({ slot: 1, level: 1, classId: '3', themeId: 'sun' });
        const plan = planPossibleBest([worn, target], KNOW_HOW, 'sun');
        const slot1 = plan.picks.find(p => p.slot === 1)!;

        expect(slot1.chosen).toBe(target);
        expect(slot1.tier).toBe(1);
        // 21,000 carac points today against 11,500.
        expect(slot1.caracDelta).toBeCloseTo(11500 - 21000);
        expect(plan.totalCaracDelta).toBeCloseTo(11500 - 21000);
        // ...and 4pp of resonance once it is levelled.
        expect(slot1.projectedResonanceDelta).toBeCloseTo(4.0);
        expect(plan.totalProjectedResonanceDelta).toBeCloseTo(4.0);
    });

    it('still prefers a capped mythic of the same tier over an unlevelled one', () => {
        const capped = mythic({ slot: 1, level: MYTHIC_MAX_LEVEL, classId: '3', themeId: 'sun' });
        const young = mythic({ slot: 1, level: 2, classId: '3', themeId: 'sun' });
        const plan = planPossibleBest([young, capped], KNOW_HOW, 'sun');
        expect(plan.picks.find(p => p.slot === 1)!.chosen).toBe(capped);
    });

    it('falls back to a legendary when the slot has no mythic at all', () => {
        const leg = legendary({ slot: 1, equipped: true });
        const plan = planPossibleBest([leg], KNOW_HOW, 'sun');
        const slot1 = plan.picks.find(p => p.slot === 1)!;
        expect(slot1.chosen).toBe(leg);
        expect(slot1.tier).toBe(5);
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

    it('flags itself when the curve no longer holds', () => {
        const odd = mythic({ slot: 1, level: 5, classId: '3' });
        odd.caracs.endurance = 99999;
        expect(projectCaracs(odd).unreliable).toBe(true);
    });

    it('scales resonance to the cap', () => {
        const young = mythic({ slot: 1, level: 1, classId: '3', themeId: 'sun' });
        expect(activeResonance(young, KNOW_HOW, 'sun')).toBeCloseTo(0.2);
        expect(projectedResonance(young, KNOW_HOW, 'sun')).toBeCloseTo(4.0);
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

    // 22 of the 30 team slots on the test account look like this.
    it('reads an empty team slot as no theme at all', () => {
        expect(themeFromTeamData({ id_team: null, theme: null, girls: [] })).toBeNull();
        expect(themeFromTeamData(null)).toBeNull();
        expect(themeFromTeamData(undefined)).toBeNull();
    });
});

describe('parseArmorItem', () => {
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
        expect(caracSum(item.caracs)).toBe(21000);
    });

    // An entry under #equiped carries id_member_armor_equipped and has no
    // id_member_armor key at all. Sniffing on the field instead of being
    // told dropped all six worn items.
    const equippedRaw = (() => {
        const { id_member_armor: _drop, ...rest } = raw;
        return { ...rest, id_member_armor_equipped: 2806061 };
    })();

    it('maps an equipped entry, which has no id_member_armor at all', () => {
        expect(parseArmorItem(equippedRaw)).toBeNull();
        const item = parseArmorItem(equippedRaw, true)!;
        expect(item.equipped).toBe(true);
        expect(item.id_member_armor).toBe(2806061);
        expect(item.slot).toBe(1);
    });

    it('accepts a chance value the game sends as a string', () => {
        const item = parseArmorItem({
            ...raw,
            caracs: { carac1: 3606, carac2: 3619, carac3: 3467, endurance: 3474, chance: '4634.57' },
        })!;
        expect(item.caracs.chance).toBeCloseTo(4634.57);
    });

    it('reads a legendary with no resonance at all', () => {
        const item = parseArmorItem({ ...raw, item: { rarity: 'legendary' }, resonance_bonuses: {} })!;
        expect(item.classResonance).toBeNull();
        expect(item.themeResonance).toBeNull();
        expect(gearTier(item, KNOW_HOW, 'sun', 'current')).toBe(5);
    });

    it('rejects girl equipment and anything without a hero slot', () => {
        expect(parseArmorItem({ ...raw, skin: { subtype: 1, wearer: 'girl', name: 'x' } })).toBeNull();
        expect(parseArmorItem({ ...raw, skin: { subtype: 9, wearer: 'hero', name: 'x' } })).toBeNull();
        expect(parseArmorItem({ ...raw, skin: {} })).toBeNull();
        expect(parseArmorItem(null)).toBeNull();
        expect(parseArmorItem('nope')).toBeNull();
    });
});
