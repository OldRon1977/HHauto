import { kickAutoLoop, setAutoLoopKick } from "../../src/Service/AutoLoopKick";

/**
 * The seam that keeps seven modules out of the import cycles: they used to
 * `import { autoLoop }` just to restart the loop after an action, and those
 * seven edges were the difference between 84 and 52 baseline cycles
 * (ADR-008 / ARCH-001).
 *
 * Two properties are worth holding: an unwired seam must not throw, and the
 * reference must be read when the timer fires rather than when it is
 * scheduled -- a kick scheduled during boot would otherwise run the noop
 * forever.
 */
describe("AutoLoopKick", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        setAutoLoopKick(() => {});
    });

    afterEach(() => {
        jest.useRealTimers();
        setAutoLoopKick(() => {});
    });

    it("runs the wired loop after the delay the caller asked for", () => {
        const loop = jest.fn();
        setAutoLoopKick(loop);

        kickAutoLoop(1500);

        jest.advanceTimersByTime(1499);
        expect(loop).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        expect(loop).toHaveBeenCalledTimes(1);
    });

    it("does not throw while nothing is wired", () => {
        kickAutoLoop(10);

        expect(() => jest.advanceTimersByTime(10)).not.toThrow();
    });

    it("uses the reference wired after the kick was scheduled", () => {
        // The boot path wires the seam once; a module that kicked before that
        // must still reach the real loop, not the noop it was scheduled with.
        const loop = jest.fn();

        kickAutoLoop(1000);
        setAutoLoopKick(loop);
        jest.advanceTimersByTime(1000);

        expect(loop).toHaveBeenCalledTimes(1);
    });

    it("kicks once per call, not once per wiring", () => {
        const loop = jest.fn();
        setAutoLoopKick(loop);

        kickAutoLoop(100);
        kickAutoLoop(100);
        jest.advanceTimersByTime(100);

        expect(loop).toHaveBeenCalledTimes(2);
    });
});
