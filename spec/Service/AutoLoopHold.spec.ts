import { autoLoopHolder, holdAutoLoop, releaseAutoLoopHold } from '../../src/Service/AutoLoopHold';

describe('AutoLoopHold', () => {
    afterEach(() => releaseAutoLoopHold());

    it('is free until someone holds it', () => {
        expect(autoLoopHolder()).toBeNull();
    });

    it('names the holder while held and is free again after the release', () => {
        holdAutoLoop('team selection');
        expect(autoLoopHolder()).toBe('team selection');
        releaseAutoLoopHold();
        expect(autoLoopHolder()).toBeNull();
    });
});
