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
import { loadFixture } from '../testHelpers/Fixtures';

/** The raw shape the game serves under equipped_armor / player_inventory.armor.
 *  Optional where the game itself is optional: a worn entry has no
 *  id_member_armor, a legendary has no resonance_bonuses key. */
interface RawArmor {
    id_member_armor?: number;
    id_member_armor_equipped?: number;
    level: number;
    skin: { subtype: number; wearer: string; name?: string };
    item: { rarity: string; type?: string };
    caracs: {
        carac1: number; carac2: number; carac3: number;
        endurance: number; chance: number | string; ego?: number;
    };
    resonance_bonuses?: {
        class?: { identifier: string; resonance: string; bonus: number };
        theme?: { identifier: string; resonance: string; bonus: number };
    };
}

interface HeroArmorFixture {
    equipped: RawArmor;
    inventoryMythic: RawArmor;
    inventoryLegendary: RawArmor;
}

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
        skin: 'TEST1',
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
        skin: 'TEST2',
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
    // Two real entries off /teams.html teams_data: a fielded themed team and
    // one of the empty slots (24 of the 30 slots on the test account are).
    const teams = loadFixture('teams', 'teams-data') as {
        themed: { theme: string; theme_elements: Array<{ type: string }>; girls: unknown[] };
        emptySlot: { id_team: number | null; theme: string | null; girls: unknown[] };
    };

    it('takes the theme the game declares', () => {
        expect(themeFromTeamData(teams.themed)).toBe(teams.themed.theme);
    });

    it('falls back to theme_elements when theme is absent', () => {
        const { theme: _drop, ...withoutTheme } = teams.themed;
        expect(themeFromTeamData(withoutTheme)).toBe(teams.themed.theme_elements[0].type);
    });

    it('reads a themeless but manned team as Balanced', () => {
        // No real example: every fielded team on the test account carries a
        // theme. The shape is the fixture's, only theme/theme_elements are
        // emptied.
        expect(themeFromTeamData({ ...teams.themed, theme: null, theme_elements: [] }))
            .toBe('balanced');
    });

    it('reads an empty team slot as no theme at all', () => {
        expect(teams.emptySlot.girls).toHaveLength(0);
        expect(themeFromTeamData(teams.emptySlot)).toBeNull();
        expect(themeFromTeamData(null)).toBeNull();
        expect(themeFromTeamData(undefined)).toBeNull();
    });
});

describe('the model against the capture', () => {
    // The two claims the whole optimiser rests on used to be asserted against
    // the test builder that encoded them -- deleted in the spec triage as
    // tautological. They come back here measured against a real capped
    // mythic, so a rebalance in the game fires the test instead of passing
    // it. Source: /shop.html equipped_armor, 2026-08-17.
    const hero = loadFixture('equipment', 'hero-armor') as HeroArmorFixture;

    it('a capped mythic really carries the caracs the projection assumes', () => {
        expect(hero.equipped.level).toBe(MYTHIC_MAX_LEVEL);
        // Through the parser, so this is the tuple the optimiser works with.
        const item = parseArmorItem(hero.equipped, true)!;
        expect(item.caracs).toEqual(mythicCaracs(MYTHIC_MAX_LEVEL));
        // 21,000 points -- the figure every tier comparison is scaled against.
        expect(caracSum(item.caracs)).toBe(21000);
    });

    it('resonance really grows at 0.1 per level, doubled on the chance track', () => {
        const { level, resonance_bonuses: res } = hero.equipped;
        expect(res!.class!.bonus).toBeCloseTo(0.1 * level);
        // The theme axis pays double where it lands on chance rather than
        // defense. This is the asymmetry the tier tie-break depends on.
        const perLevel = res!.theme!.resonance === 'chance' ? 0.2 : 0.1;
        expect(res!.theme!.bonus).toBeCloseTo(perLevel * level);
    });
});

describe('parseArmorItem', () => {
    // Real entries off /shop.html, captured 2026-08-17 with inspector v4.9.0:
    // one worn item out of `equipped_armor`, one mythic and one legendary out
    // of `player_inventory.armor` (6 worn, 204 in stock, 104 mythic).
    const hero = loadFixture('equipment', 'hero-armor') as HeroArmorFixture;

    it('maps a real inventory entry', () => {
        const src = hero.inventoryMythic;
        const item = parseArmorItem(src)!;
        expect(item.slot).toBe(src.skin.subtype);
        expect(item.rarity).toBe(src.item.rarity);
        expect(item.equipped).toBe(false);
        expect(item.id_member_armor).toBe(src.id_member_armor);
        expect(item.id_member_armor_equipped).toBeNull();
        expect(item.classResonance).toEqual(src.resonance_bonuses!.class);
        expect(item.themeResonance).toEqual(src.resonance_bonuses!.theme);
    });

    // The capture settles what the August bug was about: an entry under
    // `equipped_armor` carries id_member_armor_equipped and has no
    // id_member_armor key at all. Sniffing on the field instead of being told
    // dropped all six worn items.
    it('maps a real equipped entry, which has no id_member_armor at all', () => {
        const src = hero.equipped;
        expect('id_member_armor' in src).toBe(false);
        expect(typeof src.id_member_armor_equipped).toBe('number');

        expect(parseArmorItem(src)).toBeNull();
        const item = parseArmorItem(src, true)!;
        expect(item.equipped).toBe(true);
        expect(item.id_member_armor).toBe(src.id_member_armor_equipped);
        expect(item.slot).toBe(src.skin.subtype);
    });

    it('accepts the chance value the game sends as a string', () => {
        const src = hero.inventoryLegendary;
        expect(typeof src.caracs.chance).toBe('string');
        const item = parseArmorItem(src)!;
        expect(item.caracs.chance).toBeCloseTo(Number(src.caracs.chance));
    });

    // 100 of the 204 stocked items look like this: `resonance_bonuses` is not
    // an empty object, it is absent.
    it('reads a real legendary, which carries no resonance key at all', () => {
        const src = hero.inventoryLegendary;
        expect(src.resonance_bonuses).toBeUndefined();
        const item = parseArmorItem(src)!;
        expect(item.classResonance).toBeNull();
        expect(item.themeResonance).toBeNull();
        expect(gearTier(item, KNOW_HOW, 'sun', 'current')).toBe(5);
    });

    const raw = hero.inventoryMythic;

    it('rejects a real girl armor entry', () => {
        const girlArmor = loadFixture('equipment', 'girl-armor') as { skin: { wearer: string } };
        expect(girlArmor.skin.wearer).toBe('girl');
        expect(parseArmorItem(girlArmor)).toBeNull();
        expect(parseArmorItem(girlArmor, true)).toBeNull();
    });

    it('rejects anything without a hero slot', () => {
        expect(parseArmorItem({ ...raw, skin: { subtype: 9, wearer: 'hero', name: 'x' } })).toBeNull();
        expect(parseArmorItem({ ...raw, skin: {} })).toBeNull();
        expect(parseArmorItem(null)).toBeNull();
        expect(parseArmorItem('nope')).toBeNull();
    });
});
