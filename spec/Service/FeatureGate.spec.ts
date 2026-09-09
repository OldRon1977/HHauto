import { FeatureGate, FeatureName } from "../../src/Service/FeatureGate";
import { Harem } from "../../src/Module/harem/Harem";
import { HeroHelper } from "../../src/Helper/HeroHelper";
import { ConfigHelper } from "../../src/Helper/ConfigHelper";
import * as HHHelper from "../../src/Helper/HHHelper";
import * as LogUtils from "../../src/Utils/LogUtils";
import { MockHelper } from "../testHelpers/MockHelpers";

/**
 * The table side of the gate: which module needs what, and what the adapter
 * reads to decide it.
 *
 * The decision itself is covered in FeatureGate.pure.spec.ts. What matters
 * here is the part a pure test cannot reach -- that every feature has a row,
 * that the rows carry the numbers the game actually enforces, and that a
 * locked feature does not fill the log (v8.12.12: one such line was 692 of
 * 2532 lines in a twelve-minute run).
 */

/** Every name the table is expected to answer for. */
const ALL_FEATURES: FeatureName[] = [
    'league', 'pantheon', 'sultryMysteries', 'pathOfGlory', 'pathOfValor',
    'doublePenetration', 'placeOfPower', 'pathOfAttraction',
];

describe("FeatureGate -- the table", () => {
    beforeEach(() => {
        MockHelper.mockDomain('www.hentaiheroes.com', '/home.html');
        FeatureGate.forgetReportedState();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        FeatureGate.forgetReportedState();
    });

    it.each(ALL_FEATURES)("%s has a row that resolves", (name) => {
        // A feature added to FeatureName without a row in GATES fails here
        // instead of returning undefined at runtime.
        const requirement = FeatureGate.requirementFor(name);
        expect(typeof requirement.gameHasFeature).toBe('boolean');
        const named = [requirement.minLevel, requirement.minGirls, requirement.minWorld]
            .filter(v => v !== undefined);
        expect(named.length).toBeGreaterThan(0);
        for (const value of named) expect(Number.isFinite(value)).toBe(true);
    });

    // The numbers the game enforces, as measured or read off its own locked
    // pages. If a game update moves one, this is the single place to change.
    it.each<[FeatureName, 'minLevel' | 'minGirls' | 'minWorld', number]>([
        ['league', 'minLevel', 20],
        ['pantheon', 'minLevel', 15],
        ['sultryMysteries', 'minLevel', 15],
        ['pathOfGlory', 'minLevel', 30],
        ['pathOfValor', 'minLevel', 30],
        ['doublePenetration', 'minLevel', 40],
        ['placeOfPower', 'minGirls', 10],
        ['placeOfPower', 'minWorld', 3],
        ['pathOfAttraction', 'minGirls', 10],
        ['pathOfAttraction', 'minWorld', 2],
    ])("%s requires %s %i", (name, key, expected) => {
        expect(FeatureGate.requirementFor(name)[key]).toBe(expected);
    });

    it("does not require girls for Double Penetration", () => {
        // The old comment there claimed ten girls and the code never checked
        // it. The claim is unmeasured, so it stays an open question in
        // docs-internal rather than a condition -- and this test says so out
        // loud, in case someone adds it from the comment alone.
        expect(FeatureGate.requirementFor('doublePenetration').minGirls).toBeUndefined();
    });
});

describe("FeatureGate -- what it reads", () => {
    beforeEach(() => {
        MockHelper.mockDomain('www.hentaiheroes.com', '/home.html');
        FeatureGate.forgetReportedState();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        FeatureGate.forgetReportedState();
    });

    it("does not fetch the girl count for a gate that is only about level", () => {
        // getGirlCount goes through storage and, without a cache, the page
        // globals. A level gate has no use for it.
        const girls = jest.spyOn(Harem, 'getGirlCount').mockReturnValue(0);
        jest.spyOn(HeroHelper, 'getLevel').mockReturnValue(50);

        expect(FeatureGate.isUnlocked('league')).toBe(true);
        expect(girls).not.toHaveBeenCalled();
    });

    it("does not fetch the hero level for a gate that is only about girls and world", () => {
        const level = jest.spyOn(HeroHelper, 'getLevel').mockReturnValue(1);
        jest.spyOn(Harem, 'getGirlCount').mockReturnValue(13);
        jest.spyOn(HHHelper, 'getHHVars').mockReturnValue(4);

        expect(FeatureGate.isUnlocked('pathOfAttraction')).toBe(true);
        expect(level).not.toHaveBeenCalled();
    });

    it("keeps Place of Power shut on an account with too few girls", () => {
        jest.spyOn(Harem, 'getGirlCount').mockReturnValue(9);
        jest.spyOn(HHHelper, 'getHHVars').mockReturnValue(4);

        expect(FeatureGate.isUnlocked('placeOfPower')).toBe(false);
    });

    it("keeps Place of Power shut in world 2 with girls to spare", () => {
        jest.spyOn(Harem, 'getGirlCount').mockReturnValue(50);
        jest.spyOn(HHHelper, 'getHHVars').mockReturnValue(2);

        expect(FeatureGate.isUnlocked('placeOfPower')).toBe(false);
    });
});

describe("FeatureGate -- what it says about a locked feature", () => {
    let logged: string[];

    beforeEach(() => {
        MockHelper.mockDomain('www.hentaiheroes.com', '/home.html');
        FeatureGate.forgetReportedState();
        logged = [];
        jest.spyOn(LogUtils, 'logHHAuto').mockImplementation((...args: unknown[]) => {
            logged.push(String(args[0]));
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        FeatureGate.forgetReportedState();
    });

    it("names the count it saw, once, however often it is asked", () => {
        jest.spyOn(Harem, 'getGirlCount').mockReturnValue(9);
        jest.spyOn(HHHelper, 'getHHVars').mockReturnValue(4);

        FeatureGate.isUnlocked('placeOfPower');
        FeatureGate.isUnlocked('placeOfPower');
        FeatureGate.isUnlocked('placeOfPower');

        const notices = logged.filter(l => l.includes('Place of Power is locked'));
        expect(notices).toHaveLength(1);
        expect(notices[0]).toContain('needs 10 girls, the harem holds 9');
    });

    it("says it again once the answer has changed", () => {
        const girls = jest.spyOn(Harem, 'getGirlCount').mockReturnValue(7);
        jest.spyOn(HHHelper, 'getHHVars').mockReturnValue(4);

        FeatureGate.isUnlocked('placeOfPower');
        girls.mockReturnValue(8);
        FeatureGate.isUnlocked('placeOfPower');

        expect(logged.filter(l => l.includes('Place of Power is locked'))).toHaveLength(2);
    });

    it("says nothing once the feature is open", () => {
        jest.spyOn(Harem, 'getGirlCount').mockReturnValue(13);
        jest.spyOn(HHHelper, 'getHHVars').mockReturnValue(4);

        expect(FeatureGate.isUnlocked('placeOfPower')).toBe(true);
        expect(logged.filter(l => l.includes('is locked'))).toHaveLength(0);
    });

    it("stays quiet about a feature this game does not have", () => {
        // Not the account's doing, and constant on that variant -- a line
        // per tick about it would be pure noise.
        jest.spyOn(ConfigHelper, 'getHHScriptVars').mockImplementation(
            (key: string) => (key === 'isEnabledLeagues' ? false : 20));
        jest.spyOn(HeroHelper, 'getLevel').mockReturnValue(500);

        expect(FeatureGate.isUnlocked('league')).toBe(false);
        expect(logged.filter(l => l.includes('locked'))).toHaveLength(0);
    });
});
