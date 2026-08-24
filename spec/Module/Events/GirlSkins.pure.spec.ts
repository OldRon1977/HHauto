import { hasSkinToWin, isStillWorthFighting } from '../../../src/Module/Events/GirlSkins.pure';

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
