import { hasSkinToWin, isSkinPhase, isStillWorthFighting, shardTotalAfterFight } from '../../../src/Module/Events/GirlSkins.pure';

// Shapes taken from a live mythic event (#1842): the girl was fully owned
// (shards 100) and the game still listed an unowned, released skin.
describe('hasSkinToWin', () => {
    const skin = (over = {}) => ({ is_released: true, is_owned: false, shards_count: 0, ...over });

    it('sees a released skin that is not owned yet', () => {
        expect(hasSkinToWin({ preview: { grade_skins_data: [skin()] } })).toBe(true);
    });

    it('is done once every released skin is owned', () => {
        expect(hasSkinToWin({ preview: { grade_skins_data: [skin({ is_owned: true })] } })).toBe(false);
    });

    it('ignores a skin the game has not released', () => {
        // Farming something nobody can win would never end.
        expect(hasSkinToWin({ preview: { grade_skins_data: [skin({ is_released: false })] } })).toBe(false);
    });

    it('finds the outstanding one among several', () => {
        expect(hasSkinToWin({ preview: { grade_skins_data: [skin({ is_owned: true }), skin()] } })).toBe(true);
    });

    it('reads missing data as nothing to win', () => {
        expect(hasSkinToWin(undefined)).toBe(false);
        expect(hasSkinToWin({})).toBe(false);
        expect(hasSkinToWin({ preview: null })).toBe(false);
        expect(hasSkinToWin({ preview: { grade_skins_data: [] } })).toBe(false);
        expect(hasSkinToWin({ preview: { grade_skins_data: 'nope' as never } })).toBe(false);
    });
});

describe('isStillWorthFighting', () => {
    const withSkin = { preview: { grade_skins_data: [{ is_released: true, is_owned: false }] } };
    const noSkin = { preview: { grade_skins_data: [{ is_released: true, is_owned: true }] } };

    it('fights for a girl that is not won yet, skins or not', () => {
        expect(isStillWorthFighting(40, false, noSkin)).toBe(true);
        expect(isStillWorthFighting(99, true, noSkin)).toBe(true);
    });

    it('keeps fighting an owned girl while a skin is outstanding and wanted', () => {
        expect(isStillWorthFighting(100, true, withSkin)).toBe(true);
    });

    it('stops at an owned girl when the user does not want skins', () => {
        expect(isStillWorthFighting(100, false, withSkin)).toBe(false);
    });

    it('stops once the skin is owned too', () => {
        expect(isStillWorthFighting(100, true, noSkin)).toBe(false);
    });
});

// #1843: the script kept fighting a girl it had already completed, because the
// stored shard count was only refreshed by parsing the event page. The battle
// response carries the new count -- these pin how it is read.
describe('shardTotalAfterFight', () => {
    it('takes the entry that starts where the stored count is', () => {
        const drops = [{ previous_value: 40, value: 42 }, { previous_value: 98, value: 100 }];
        expect(shardTotalAfterFight(drops, 98)).toBe(100);
        expect(shardTotalAfterFight(drops, 40)).toBe(42);
    });

    it('takes a lone entry even when the stored count has drifted', () => {
        // The ordinary case: one girl, and the stored number is behind.
        expect(shardTotalAfterFight([{ previous_value: 96, value: 100 }], 90)).toBe(100);
    });

    it('reports the completed girl the reporter saw', () => {
        // previous=100, value=100 -- the fight that produced nothing.
        expect(shardTotalAfterFight([{ previous_value: 100, value: 100 }], 100)).toBe(100);
    });

    it('says nothing rather than guessing when several entries and none match', () => {
        const drops = [{ previous_value: 10, value: 12 }, { previous_value: 50, value: 52 }];
        expect(shardTotalAfterFight(drops, 90)).toBeNull();
    });

    it('reads missing or malformed data as no answer', () => {
        expect(shardTotalAfterFight(undefined, 10)).toBeNull();
        expect(shardTotalAfterFight([], 10)).toBeNull();
        expect(shardTotalAfterFight([{}], 10)).toBeNull();
        expect(shardTotalAfterFight('nope' as never, 10)).toBeNull();
    });
});

describe('isSkinPhase', () => {
    it('is the state where only the skin is left and the user wants it', () => {
        expect(isSkinPhase(100, true)).toBe(true);
    });

    it('is not the state while the girl is incomplete', () => {
        expect(isSkinPhase(99, true)).toBe(false);
    });

    it('is not the state when skins are switched off', () => {
        expect(isSkinPhase(100, false)).toBe(false);
    });
});
