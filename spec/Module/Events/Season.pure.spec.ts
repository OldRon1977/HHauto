import { isBlockedOnlyByMissingBooster, BoosterWaitState, seasonGirlReward } from "../../../src/Module/Events/Season.pure";

describe("Season.pure isBlockedOnlyByMissingBooster", function () {
    function baseState(overrides: Partial<BoosterWaitState> = {}): BoosterWaitState {
        return {
            timerExpired: true,
            energyAboveThreshold: true,
            needBoosterToFight: true,
            haveBoosterEquipped: false,
            autoEquipBoostersEnabled: true,
            ...overrides,
        };
    }

    it("is true when the only blocker is a missing booster and auto-equip is on", function () {
        expect(isBlockedOnlyByMissingBooster(baseState())).toBe(true);
    });

    it("is false when the season timer has not expired yet", function () {
        expect(isBlockedOnlyByMissingBooster(baseState({ timerExpired: false }))).toBe(false);
    });

    it("is false when energy is not above the threshold", function () {
        expect(isBlockedOnlyByMissingBooster(baseState({ energyAboveThreshold: false }))).toBe(false);
    });

    it("is false when boosters are not required to fight", function () {
        expect(isBlockedOnlyByMissingBooster(baseState({ needBoosterToFight: false }))).toBe(false);
    });

    it("is false once a booster is equipped", function () {
        expect(isBlockedOnlyByMissingBooster(baseState({ haveBoosterEquipped: true }))).toBe(false);
    });

    it("is false when auto-equip is off, even if a booster is missing", function () {
        expect(isBlockedOnlyByMissingBooster(baseState({ autoEquipBoostersEnabled: false }))).toBe(false);
    });
});

describe("Season.pure seasonGirlReward (#1926)", function () {
    it("is unknown without opponent rewards or a shard list", function () {
        expect(seasonGirlReward(undefined)).toBe("unknown");
        expect(seasonGirlReward(null)).toBe("unknown");
        expect(seasonGirlReward({})).toBe("unknown");
        expect(seasonGirlReward({ shards: [] })).toBe("unknown");
    });

    it("is a girl while one reward girl is not owned", function () {
        expect(seasonGirlReward({ shards: [{ is_girl_owned: false }], grade_skins: [{}] })).toBe("girl");
        expect(seasonGirlReward({ shards: [{ is_girl_owned: true }, { is_girl_owned: false }] })).toBe("girl");
    });

    it("counts an entry without is_girl_owned as not owned, as the game does", function () {
        expect(seasonGirlReward({ shards: [{}], grade_skins: [{}] })).toBe("girl");
    });

    it("is skin only when every reward girl is owned and a skin is listed", function () {
        expect(seasonGirlReward({ shards: [{ is_girl_owned: true }], grade_skins: [{}] })).toBe("skinOnly");
    });

    it("is none when every reward girl is owned and no skin is listed", function () {
        expect(seasonGirlReward({ shards: [{ is_girl_owned: true }] })).toBe("none");
        expect(seasonGirlReward({ shards: [{ is_girl_owned: true }], grade_skins: [] })).toBe("none");
    });
});
