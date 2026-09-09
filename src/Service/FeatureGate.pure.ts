// FeatureGate.pure.ts -- Pure decision logic for "has this account unlocked
// feature X yet".
//
// Extracted so the decision can be unit-tested without ConfigHelper, the
// Hero globals, storage or the DOM. Input = data, output = a verdict.
// The impure adapter FeatureGate.ts holds the table of requirements, reads
// the account state and delegates here.
//
// Why this exists at all: eight modules answered the same question with
// eight hand-written conditions, and they drifted. DoublePenetration named
// "And 10 girls" in a comment and checked only the level; LoveRaidManager
// carried its level check commented out; the ten-girl condition was written
// as a literal in two places until v8.12.14 gave it a name. Two of the fixes
// in the 8.12.9-8.12.18 run were faults in such a condition, not in the
// feature behind it (ADR-012).
//
// Used by: FeatureGate.ts

/**
 * What a feature needs before an account can use it.
 *
 * A field left undefined is not part of this feature's condition and is
 * never read -- the adapter does not even fetch the value for it.
 */
export type GateRequirement = {
    /**
     * The game variant advertises the feature at all (the isEnabledX flags
     * in HHEnvVariables). This is a different question from "has the account
     * unlocked it", and it is asked first because a feature the game does
     * not have cannot be unlocked by any amount of progress.
     */
    gameHasFeature: boolean;
    minLevel?: number;
    minGirls?: number;
    minWorld?: number;
};

/**
 * The three numbers every gate is decided on. Fields the requirement does
 * not name are left at 0 by the adapter and never read.
 */
export type AccountState = {
    heroLevel: number;
    girlCount: number;
    world: number;
};

export type GateObstacle = 'game' | 'level' | 'girls' | 'world';

export type GateVerdict = {
    unlocked: boolean;
    /** What stands in the way. Absent when unlocked. */
    missing?: GateObstacle;
    /** The requirement and the account's value, for the log line. */
    needs?: number;
    has?: number;
};

/**
 * A value the account state does not carry is not a low value -- it is no
 * answer, and a gate must not open on one.
 *
 * The game hands these numbers out unevenly: `HeroHelper.getLevel()` reads 0
 * before any page has been parsed, `Harem.getGirlCount()` returns 0 both for
 * "no girls" and for "no source on this page", and `id_world` is undefined
 * off the quest pages. Every one of those becomes 0 here, and 0 fails every
 * positive requirement. Measured cost of the opposite: with the girl count
 * read off the harem page it came out 24 on an account owning 9 (v8.12.11),
 * which would have sent the run onto a page it cannot use.
 */
export function knownValue(value: number | undefined | null): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Decide one gate.
 *
 * The conditions are checked in a fixed order -- game, level, girls, world --
 * so the verdict names the same obstacle every time for the same state, and
 * the log line the adapter builds from it does not flicker between two
 * equally true reasons.
 *
 * All comparisons are non-strict (`>=`), matching every condition this
 * replaced.
 */
export function decideUnlocked(requirement: GateRequirement, state: AccountState): GateVerdict {
    if (!requirement.gameHasFeature) {
        return { unlocked: false, missing: 'game' };
    }
    const checks: Array<[GateObstacle, number | undefined, number]> = [
        ['level', requirement.minLevel, state.heroLevel],
        ['girls', requirement.minGirls, state.girlCount],
        ['world', requirement.minWorld, state.world],
    ];
    for (const [obstacle, needs, raw] of checks) {
        if (needs === undefined) continue;
        const has = knownValue(raw);
        if (has < needs) {
            return { unlocked: false, missing: obstacle, needs, has };
        }
    }
    return { unlocked: true };
}
