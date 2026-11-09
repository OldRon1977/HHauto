import { TraitMappings } from '../../src/Service/TraitMappings';

const labels = { eyes: 'Eyes', hair: 'Hair' };

describe('TraitMappings.traitLine', () => {

    it('lists eyes, hair, zodiac and position in that order', () => {
        const line = TraitMappings.traitLine(
            { eyeColor: '00F', hairColor: 'FF0', zodiac: '♏︎ Scorpio', position: '6' },
            labels,
        );
        expect(line).toBe('Eyes Blue &middot; Hair Blond &middot; Scorpio &middot; Pose 6');
    });

    it('leaves out a trait the girl does not carry', () => {
        expect(TraitMappings.traitLine({ hairColor: 'FF0', zodiac: '♏︎ Scorpio' }, labels))
            .toBe('Hair Blond &middot; Scorpio');
        expect(TraitMappings.traitLine({}, labels)).toBe('');
    });

    it('takes the colour and position names of the game when it has them', () => {
        (window as any).GT = { colors: { FF0: 'Blond (game)' }, figures: ['', '', '', '', '', '', 'Doggy'] };
        try {
            expect(TraitMappings.traitLine({ hairColor: 'ff0', position: '6' }, labels))
                .toBe('Hair Blond (game) &middot; Doggy');
        } finally {
            delete (window as any).GT;
        }
    });

    it('shows an unknown colour as its code', () => {
        expect(TraitMappings.traitLine({ eyeColor: 'ABC' }, labels)).toBe('Eyes #ABC');
    });
});
