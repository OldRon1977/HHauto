// FeatureGate.ts -- One table of "what an account needs before a feature is
// usable", and one place that reads the numbers it is decided on.
//
// Before this, eight modules each wrote their own condition. They drifted:
// DoublePenetration named "And 10 girls" in a comment and checked only the
// level, LoveRaidManager kept its level check commented out, and the
// ten-girl threshold was a literal in two files. Worse, each condition read
// its own numbers, and those numbers are the part that goes wrong -- the
// girl count means something different on every page (v8.12.11) and its
// cache went stale for a day (v8.12.13/14). Two faults out of nine in that
// run were in a gate, not in the feature behind it.
//
// The decision itself lives in FeatureGate.pure.ts; this file resolves the
// table against ConfigHelper and reads the account state.
//
// Depends on: FeatureGate.pure.ts (the decision), Harem.ts (girl count)
// Used by: League.ts, Pantheon.ts, PathOfGlory.ts, PathOfValue.ts,
//   SultryMysteries.ts, DoublePenetration.ts, PlaceOfPower.ts,
//   PathOfAttraction.ts
//
// See docs/decisions/ADR-012-one-table-of-unlock-conditions.md
import { ConfigHelper } from "../Helper/ConfigHelper";
import { getHHVars } from "../Helper/HHHelper";
import { HeroHelper } from "../Helper/HeroHelper";
import { Harem } from "../Module/harem/Harem";
import { logHHAuto } from "../Utils/LogUtils";
import { AccountState, GateRequirement, GateVerdict, decideUnlocked } from "./FeatureGate.pure";

export type FeatureName =
    | 'league'
    | 'pantheon'
    | 'sultryMysteries'
    | 'pathOfGlory'
    | 'pathOfValor'
    | 'doublePenetration'
    | 'placeOfPower'
    | 'pathOfAttraction';

type GateSpec = {
    /** Name for the log line, in the game's own wording. */
    label: string;
    /**
     * The isEnabledX key in HHEnvVariables. Left out where the script has
     * never had such a flag for the feature; the gate then treats the game
     * as having it.
     */
    enabledVar?: string;
    /** The LEVEL_MIN_X key. Kept as a key, not a number: game variants override it. */
    levelVar?: string;
    /** The girl-count key. Only HaremSizeGate exists today. */
    girlsVar?: string;
    /**
     * The adventure world. A literal rather than a config key because no
     * variant has ever overridden it -- unlike the level and girl
     * thresholds, which HHEnvVariables sets per game.
     */
    minWorld?: number;
};

/**
 * Every unlock condition the script knows, in one place.
 *
 * Adding a module here is the whole of adding its gate. What is NOT here is
 * as important: a condition nobody has measured does not get an entry, it
 * gets a line in docs-internal. See `doublePenetration` below.
 */
const GATES: Record<FeatureName, GateSpec> = {
    league: { label: 'Leagues', enabledVar: 'isEnabledLeagues', levelVar: 'LEVEL_MIN_LEAGUE' },
    pantheon: { label: 'Pantheon', enabledVar: 'isEnabledPantheon', levelVar: 'LEVEL_MIN_PANTHEON' },
    // No isEnabledX flag has ever existed for Sultry Mysteries.
    sultryMysteries: { label: 'Sultry Mysteries', levelVar: 'LEVEL_MIN_EVENT_SM' },
    pathOfGlory: { label: 'Path of Glory', enabledVar: 'isEnabledPoG', levelVar: 'LEVEL_MIN_POG' },
    pathOfValor: { label: 'Path of Valor', enabledVar: 'isEnabledPoV', levelVar: 'LEVEL_MIN_POV' },
    // The old comment on DoublePenetration.isEnabled read "And 10 gilrs",
    // and the code checked only the level. Whether the game really wants ten
    // girls here is NOT measured -- docs-internal/adventure-quest-flow.md
    // says so plainly -- so the behaviour stays level-only and the open
    // question lives in that document rather than in a comment beside a
    // condition that does not implement it.
    doublePenetration: { label: 'Double Penetration', enabledVar: 'isEnabledDPEvent', levelVar: 'LEVEL_MIN_EVENT_DP' },
    // The game states this one on the locked page itself: ten girls and the
    // world beyond the second. `id_world > 2` is `>= 3`.
    placeOfPower: { label: 'Place of Power', enabledVar: 'isEnabledPowerPlaces', girlsVar: 'HaremSizeGate', minWorld: 3 },
    // "You need to be at least on the Second World of your adventure and
    // have at least 10 girls in your Harem" -- the event page's own text.
    pathOfAttraction: { label: 'Path of Attraction', girlsVar: 'HaremSizeGate', minWorld: 2 },
};

/**
 * The last verdict reported per feature, so a locked feature says why once
 * instead of on every pipeline tick. Measured before this existed: one such
 * line filled 692 of 2532 log lines in a twelve-minute run, 27 percent of
 * the log (v8.12.12). The memo lives as long as the document; a page load
 * repeats the line only if the answer has changed since.
 */
const lastReported = new Map<FeatureName, string>();

export class FeatureGate {

    /** The requirement for one feature, resolved against the current game variant. */
    static requirementFor(name: FeatureName): GateRequirement {
        const spec = GATES[name];
        return {
            gameHasFeature: spec.enabledVar === undefined
                ? true
                : ConfigHelper.getHHScriptVars(spec.enabledVar, false) === true,
            minLevel: spec.levelVar === undefined ? undefined : Number(ConfigHelper.getHHScriptVars(spec.levelVar)),
            minGirls: spec.girlsVar === undefined ? undefined : Number(ConfigHelper.getHHScriptVars(spec.girlsVar)),
            minWorld: spec.minWorld,
        };
    }

    /**
     * Read only the numbers this requirement is decided on. Reading the girl
     * count is not free -- it goes through storage and, without a cache, the
     * page globals -- and a level gate has no use for it.
     */
    static accountStateFor(requirement: GateRequirement): AccountState {
        return {
            heroLevel: requirement.minLevel === undefined ? 0 : HeroHelper.getLevel(),
            girlCount: requirement.minGirls === undefined ? 0 : Harem.getGirlCount(),
            world: requirement.minWorld === undefined ? 0 : Number(getHHVars('Hero.infos.questing.id_world', false)),
        };
    }

    /** The full verdict, without logging. */
    static verdict(name: FeatureName): GateVerdict {
        const requirement = FeatureGate.requirementFor(name);
        return decideUnlocked(requirement, FeatureGate.accountStateFor(requirement));
    }

    /**
     * The one question every caller asks. Reports a change of answer once,
     * never a repeat.
     */
    static isUnlocked(name: FeatureName): boolean {
        const verdict = FeatureGate.verdict(name);
        const signature = verdict.unlocked ? 'open' : `${verdict.missing}:${verdict.has}/${verdict.needs}`;
        if (lastReported.get(name) !== signature) {
            lastReported.set(name, signature);
            if (!verdict.unlocked && verdict.missing !== 'game') {
                logHHAuto(FeatureGate.describe(name, verdict));
            }
        }
        return verdict.unlocked;
    }

    /** The log line for a locked feature, in one wording for all of them. */
    static describe(name: FeatureName, verdict: GateVerdict): string {
        const label = GATES[name].label;
        switch (verdict.missing) {
            case 'level':
                return `${label} is locked: needs level ${verdict.needs}, the hero is ${verdict.has}.`;
            case 'girls':
                return `${label} is locked: needs ${verdict.needs} girls, the harem holds ${verdict.has}.`;
            case 'world':
                return `${label} is locked: needs world ${verdict.needs}, the adventure is in ${verdict.has}.`;
            case 'game':
                return `${label} is not part of this game.`;
            default:
                return `${label} is unlocked.`;
        }
    }

    /** Test seam: the memo outlives a document, and a test is not a document. */
    static forgetReportedState() {
        lastReported.clear();
    }
}
