import {
    BurstState,
    decideBurst,
    shouldRunStandardHandler,
    StandardHandlerGuard,
} from "../../src/Service/AutoLoop.pure";

describe("decideBurst", () => {
    const burstState = (overrides: Partial<BurstState> = {}): BurstState => ({
        sMenuVisible: false,
        navContentBlock: false,
        master: true,
        paranoia: false,
        burst: false,
        ...overrides,
    });

    it("returns false when the sMenu overlay is visible", () => {
        expect(decideBurst(burstState({ sMenuVisible: true }))).toBe(false);
    });

    it("returns false when the nav content overlay is showing block", () => {
        expect(decideBurst(burstState({ navContentBlock: true }))).toBe(false);
    });

    it("returns false when master is off, regardless of paranoia/burst", () => {
        expect(decideBurst(burstState({ master: false }))).toBe(false);
        expect(decideBurst(burstState({ master: false, burst: true }))).toBe(false);
    });

    it("returns true when master is on and paranoia is off", () => {
        expect(decideBurst(burstState({ master: true, paranoia: false }))).toBe(true);
    });

    it("returns false when master is on, paranoia is on, but burst is off", () => {
        expect(
            decideBurst(burstState({ master: true, paranoia: true, burst: false })),
        ).toBe(false);
    });

    it("returns true when master is on, paranoia is on, and burst is on", () => {
        expect(
            decideBurst(burstState({ master: true, paranoia: true, burst: true })),
        ).toBe(true);
    });

    it("UI overlays beat the master/paranoia/burst combination", () => {
        expect(
            decideBurst(burstState({ sMenuVisible: true, master: true, burst: true })),
        ).toBe(false);
    });
});

describe("shouldRunStandardHandler", () => {
    const guard = (overrides: Partial<StandardHandlerGuard> = {}): StandardHandlerGuard => ({
        ctxBusy: false,
        autoLoopActive: true,
        competitionActive: false,
        lastActionPerformed: "none",
        requiresAutoLoop: undefined,
        requiresCompetition: undefined,
        handlerAction: "myhandler",
        isReady: true,
        ...overrides,
    });

    it("returns true on a clean baseline (defaults)", () => {
        expect(shouldRunStandardHandler(guard())).toBe(true);
    });

    it("returns false when ctx is already busy", () => {
        expect(shouldRunStandardHandler(guard({ ctxBusy: true }))).toBe(false);
    });

    it("returns false when AutoLoop is inactive and the handler requires it (default)", () => {
        expect(shouldRunStandardHandler(guard({ autoLoopActive: false }))).toBe(false);
    });

    it("returns true when AutoLoop is inactive but the handler opts out via requiresAutoLoop=false", () => {
        expect(
            shouldRunStandardHandler(
                guard({ autoLoopActive: false, requiresAutoLoop: false }),
            ),
        ).toBe(true);
    });

    it("returns false when requiresCompetition is on but no competition is active", () => {
        expect(
            shouldRunStandardHandler(guard({ requiresCompetition: true })),
        ).toBe(false);
    });

    it("returns true when requiresCompetition is on and competition is active", () => {
        expect(
            shouldRunStandardHandler(
                guard({ requiresCompetition: true, competitionActive: true }),
            ),
        ).toBe(true);
    });

    it("returns false when another action is already in progress this loop", () => {
        expect(
            shouldRunStandardHandler(
                guard({ lastActionPerformed: "otherAction", handlerAction: "myhandler" }),
            ),
        ).toBe(false);
    });

    it("returns true when lastActionPerformed matches this handlers own action (loop continuation)", () => {
        expect(
            shouldRunStandardHandler(
                guard({ lastActionPerformed: "myhandler", handlerAction: "myhandler" }),
            ),
        ).toBe(true);
    });

    it("returns false when isReady is false (descriptor guard)", () => {
        expect(shouldRunStandardHandler(guard({ isReady: false }))).toBe(false);
    });

    it("evaluates guards in the original order: ctxBusy beats autoLoopActive", () => {
        // ctx.busy must short-circuit before any other check, including
        // requiresAutoLoop/autoLoopActive.
        expect(
            shouldRunStandardHandler(
                guard({ ctxBusy: true, autoLoopActive: false }),
            ),
        ).toBe(false);
    });

    it("requiresAutoLoop=true is equivalent to undefined (default behaviour)", () => {
        const explicit = shouldRunStandardHandler(
            guard({ requiresAutoLoop: true, autoLoopActive: false }),
        );
        const implicit = shouldRunStandardHandler(
            guard({ requiresAutoLoop: undefined, autoLoopActive: false }),
        );
        expect(explicit).toBe(false);
        expect(implicit).toBe(false);
    });
});
