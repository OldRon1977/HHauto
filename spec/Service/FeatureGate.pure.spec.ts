import {
    AccountState,
    GateObstacle,
    GateRequirement,
    decideUnlocked,
    knownValue,
} from "../../src/Service/FeatureGate.pure";

/**
 * The decision behind every "has this account unlocked X" in the script.
 *
 * Written as a table rather than one test per module on purpose: eight
 * modules used to carry their own copy of this cascade and they drifted
 * apart (ADR-012). A test file shaped like the old code would drift the
 * same way -- if a condition only exists in one module's spec, the next
 * module to grow that condition gets no test at all.
 *
 * Contract kept from every condition this replaced:
 *   - all comparisons are non-strict (>=)
 *   - the game-variant flag is asked first
 *   - a value that is not a positive finite number is "no answer", and no
 *     gate opens on one
 */
const state = (overrides: Partial<AccountState> = {}): AccountState => ({
    heroLevel: 0,
    girlCount: 0,
    world: 0,
    ...overrides,
});

const requirement = (overrides: Partial<GateRequirement> = {}): GateRequirement => ({
    gameHasFeature: true,
    ...overrides,
});

/**
 * One row per kind of condition. Every case below runs against all three,
 * so a fourth condition cannot be added with tests for only one of them.
 */
const conditions: Array<{
    obstacle: GateObstacle;
    requirementKey: 'minLevel' | 'minGirls' | 'minWorld';
    stateKey: keyof AccountState;
}> = [
    { obstacle: 'level', requirementKey: 'minLevel', stateKey: 'heroLevel' },
    { obstacle: 'girls', requirementKey: 'minGirls', stateKey: 'girlCount' },
    { obstacle: 'world', requirementKey: 'minWorld', stateKey: 'world' },
];

describe("decideUnlocked -- the shared unlock cascade", () => {

    it.each(conditions)("$obstacle: locked below the minimum", ({ requirementKey, stateKey, obstacle }) => {
        const verdict = decideUnlocked(
            requirement({ [requirementKey]: 10 }),
            state({ [stateKey]: 9 }),
        );
        expect(verdict.unlocked).toBe(false);
        expect(verdict.missing).toBe(obstacle);
        expect(verdict.needs).toBe(10);
        expect(verdict.has).toBe(9);
    });

    it.each(conditions)("$obstacle: open at exactly the minimum (non-strict >=)", ({ requirementKey, stateKey }) => {
        expect(decideUnlocked(
            requirement({ [requirementKey]: 10 }),
            state({ [stateKey]: 10 }),
        ).unlocked).toBe(true);
    });

    it.each(conditions)("$obstacle: open above the minimum", ({ requirementKey, stateKey }) => {
        expect(decideUnlocked(
            requirement({ [requirementKey]: 10 }),
            state({ [stateKey]: 500 }),
        ).unlocked).toBe(true);
    });

    it.each(conditions)("$obstacle: a condition nobody set is not checked", ({ stateKey }) => {
        // The state carries 0 for it -- which would fail any requirement, so
        // this also proves the 0 is never read when no requirement names it.
        expect(decideUnlocked(requirement(), state({ [stateKey]: 0 })).unlocked).toBe(true);
    });

    describe("a value that is no answer keeps the gate shut", () => {
        // The game hands these out unevenly: getLevel() is 0 before any page
        // was parsed, getGirlCount() is 0 for "no source on this page", and
        // id_world is undefined off the quest pages. Reading such a value as
        // a number is how v8.12.11 put 24 girls on an account owning 9.
        const noAnswers: Array<[string, unknown]> = [
            ['zero', 0],
            ['negative', -1],
            ['NaN', NaN],
            ['Infinity', Infinity],
            ['undefined', undefined],
            ['null', null],
            ['a string', '12' as unknown],
        ];

        it.each(conditions.flatMap(c => noAnswers.map(([label, value]) => ({ ...c, label, value }))))(
            "$obstacle: $label", ({ requirementKey, stateKey, value }) => {
                const verdict = decideUnlocked(
                    requirement({ [requirementKey]: 1 }),
                    state({ [stateKey]: value as number }),
                );
                expect(verdict.unlocked).toBe(false);
                expect(verdict.has).toBe(0);
            });
    });

    describe("the game-variant flag comes first", () => {
        it("stays shut however far the account has come", () => {
            const verdict = decideUnlocked(
                requirement({ gameHasFeature: false, minLevel: 1 }),
                state({ heroLevel: 500, girlCount: 500, world: 500 }),
            );
            expect(verdict.unlocked).toBe(false);
            expect(verdict.missing).toBe('game');
        });

        it("does not report a progress obstacle instead", () => {
            // Otherwise the log line would blame the account for a feature
            // this game does not have.
            expect(decideUnlocked(
                requirement({ gameHasFeature: false, minLevel: 30 }),
                state({ heroLevel: 1 }),
            ).missing).toBe('game');
        });
    });

    it("names the same obstacle every time when several are missing", () => {
        // The order is fixed so the log line does not flicker between two
        // equally true reasons on consecutive ticks.
        const verdict = decideUnlocked(
            requirement({ minLevel: 30, minGirls: 10, minWorld: 3 }),
            state({ heroLevel: 1, girlCount: 1, world: 1 }),
        );
        expect(verdict.missing).toBe('level');
    });

    it("moves on to the next obstacle once the first is met", () => {
        const verdict = decideUnlocked(
            requirement({ minLevel: 30, minGirls: 10, minWorld: 3 }),
            state({ heroLevel: 40, girlCount: 1, world: 1 }),
        );
        expect(verdict.missing).toBe('girls');
    });
});

describe("knownValue", () => {
    it("passes a positive finite number through", () => {
        expect(knownValue(1)).toBe(1);
        expect(knownValue(3.5)).toBe(3.5);
    });

    it("turns everything else into 0", () => {
        expect(knownValue(0)).toBe(0);
        expect(knownValue(-5)).toBe(0);
        expect(knownValue(NaN)).toBe(0);
        expect(knownValue(Infinity)).toBe(0);
        expect(knownValue(undefined)).toBe(0);
        expect(knownValue(null)).toBe(0);
    });
});
