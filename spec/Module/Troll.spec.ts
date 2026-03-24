import { getSecondsLeft, setTimer, clearTimer } from '../../src/Helper/TimerHelper';
import { Troll } from '../../src/Module/Troll';
import { HHStoredVarPrefixKey, SK, TK } from '../../src/config/index';
import { EventGirl } from '../../src/model/EventGirl';
import { LoveRaid } from '../../src/model/LoveRaid';
import { EventModule, LoveRaidManager } from '../../src/Module/Events/index';
import { MockHelper } from '../testHelpers/MockHelpers';

describe("Troll module", function () {

    beforeEach(() => {
        MockHelper.mockDomain('www.hentaiheroes.com');
        unsafeWindow.shared.Hero = {
            name: "TOTO",
            infos: {
                level: 500,
                questing: { id_world: 5, choices_adventure: 0 },
                hc_confirm: false
            },
            energies: {
                fight: {
                    amount: 15,
                    max_regen_amount: 20,
                    max_amount: 200,
                    next_refresh_ts: 1019,
                    seconds_per_point: 1800
                }
            },
            currencies: { hard_currency: 500 }
        };
        unsafeWindow.hh_prices = {
            fight_cost_per_minute: 0.36
        };
    });

    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        jest.restoreAllMocks();
    });

    describe("canBuyFight", function () {
        it("default", function () {
            const canBuy = Troll.canBuyFight({} as EventGirl);
            expect(canBuy.canBuy).toBeFalsy();
            expect(canBuy.event_mythic).toBe("false");
            expect(canBuy.type).toBe("fight");
        });
        describe("Event girl", function () {
            it("allows buying 20 fights when event buy settings are enabled", function () {
                localStorage.setItem(HHStoredVarPrefixKey + SK.spendKobans0, 'true');
                localStorage.setItem(HHStoredVarPrefixKey + SK.buyCombat, 'true');
                localStorage.setItem(HHStoredVarPrefixKey + SK.plusEvent, 'true');
                localStorage.setItem(HHStoredVarPrefixKey + SK.buyCombTimer, '1');
                localStorage.setItem(HHStoredVarPrefixKey + SK.kobanBank, '0');
                setTimer('eventGoing', 1000);
                unsafeWindow.shared.Hero.currencies = { hard_currency: 1000 };
                unsafeWindow.shared.Hero.energies.fight.amount = 0;

                const eventGirl = { girl_id: 1, is_mythic: false, shards: 90, troll_id: 1 } as EventGirl;
                const canBuy = Troll.canBuyFight(eventGirl, false);

                expect(canBuy.canBuy).toBeTruthy();
                expect(canBuy.event_mythic).toBe("false");
                expect(canBuy.max).toBe(20);
                expect(canBuy.toBuy).toBe(20);
            });

            it("allows buying 50 fights when min shards and x50 settings are enabled", function () {
                localStorage.setItem(HHStoredVarPrefixKey + SK.spendKobans0, 'true');
                localStorage.setItem(HHStoredVarPrefixKey + SK.buyCombat, 'true');
                localStorage.setItem(HHStoredVarPrefixKey + SK.plusEvent, 'true');
                localStorage.setItem(HHStoredVarPrefixKey + SK.buyCombTimer, '1');
                localStorage.setItem(HHStoredVarPrefixKey + SK.useX50Fights, 'true');
                localStorage.setItem(HHStoredVarPrefixKey + SK.minShardsX50, '20');
                localStorage.setItem(HHStoredVarPrefixKey + SK.useX50FightsAllowNormalEvent, 'true');
                localStorage.setItem(HHStoredVarPrefixKey + SK.kobanBank, '0');
                setTimer('eventGoing', 1000);
                unsafeWindow.shared.Hero.currencies = { hard_currency: 1000 };
                unsafeWindow.shared.Hero.energies.fight.amount = 0;

                const eventGirl = { girl_id: 1, is_mythic: false, shards: 0, troll_id: 1 } as EventGirl;
                const canBuy = Troll.canBuyFight(eventGirl);

                expect(canBuy.canBuy).toBeTruthy();
                expect(canBuy.max).toBe(50);
                expect(canBuy.toBuy).toBe(50);
            });
        });
        describe("Mythic event girl", function () {
            it("allows buying 20 fights for mythic event girl", function () {
                localStorage.setItem(HHStoredVarPrefixKey + SK.spendKobans0, 'true');
                localStorage.setItem(HHStoredVarPrefixKey + SK.plusEventMythic, 'true');
                localStorage.setItem(HHStoredVarPrefixKey + SK.buyMythicCombat, 'true');
                localStorage.setItem(HHStoredVarPrefixKey + SK.buyMythicCombTimer, '1');
                localStorage.setItem(HHStoredVarPrefixKey + SK.kobanBank, '0');
                setTimer('eventMythicGoing', 1000);
                unsafeWindow.shared.Hero.currencies = { hard_currency: 1000 };
                unsafeWindow.shared.Hero.energies.fight.amount = 0;

                const eventGirl = { girl_id: 1, is_mythic: true, shards: 50, troll_id: 3 } as EventGirl;
                const canBuy = Troll.canBuyFight(eventGirl);

                expect(canBuy.canBuy).toBeTruthy();
                expect(canBuy.event_mythic).toBe("true");
                expect(canBuy.max).toBe(20);
                expect(canBuy.toBuy).toBe(20);
            });
        });
        describe("Mythic + event girl", function () {
            it("does not allow buying when kobans are insufficient", function () {
                localStorage.setItem(HHStoredVarPrefixKey + SK.buyCombat, 'true');
                localStorage.setItem(HHStoredVarPrefixKey + SK.plusEvent, 'true');
                localStorage.setItem(HHStoredVarPrefixKey + SK.buyCombTimer, '1');
                localStorage.setItem(HHStoredVarPrefixKey + SK.kobanBank, '9999');
                setTimer('eventGoing', 1000);
                unsafeWindow.shared.Hero.currencies = { hard_currency: 1 };
                MockHelper.mockEnergiesFight(0, 15);

                const eventGirl = { girl_id: 1, is_mythic: false, shards: 50, troll_id: 1 } as EventGirl;
                const canBuy = Troll.canBuyFight(eventGirl);

                expect(canBuy.canBuy).toBeFalsy();
            });
        });
    });

    describe("canBuyFightForRaid", function () {
        it("default", function () {
            const canBuy = Troll.canBuyFightForRaid({} as LoveRaid);
            expect(canBuy.canBuy).toBeFalsy();
            expect(canBuy.type).toBe("fight");
        });
    });

    describe("get Fight", function () {
        beforeEach(() => {
            MockHelper.mockHeroLevel(500);
            MockHelper.mockEnergiesFight(0, 0);
        });

        it("default", function () {
            expect(Troll.getEnergy()).toBe(0);
            expect(Troll.getEnergyMax()).toBe(0);
        });

        it("5kiss over 10", function () {
            MockHelper.mockEnergiesFight(5, 10);
            expect(Troll.getEnergy()).toBe(5);
            expect(Troll.getEnergyMax()).toBe(10);
        });

        it("15kiss over 20", function () {
            MockHelper.mockEnergiesFight(15, 20);
            expect(Troll.getEnergy()).toBe(15);
            expect(Troll.getEnergyMax()).toBe(20);
        });
    });

    describe("getLastTrollIdAvailable", function () {
        it("returns world - 1 for main adventure when no mapping", function () {
            unsafeWindow.shared.Hero.infos = {
                level: 500,
                questing: { id_world: 5, choices_adventure: 0 },
                hc_confirm: false
            };
            const result = Troll.getLastTrollIdAvailable(false);
            expect(result).toBe(4);
        });

        it("returns world - 1 for different world levels", function () {
            unsafeWindow.shared.Hero.infos = {
                level: 500,
                questing: { id_world: 10, choices_adventure: 0 },
                hc_confirm: false
            };
            const result = Troll.getLastTrollIdAvailable(false);
            expect(result).toBe(9);
        });

        it("returns 0 for world 1", function () {
            unsafeWindow.shared.Hero.infos = {
                level: 500,
                questing: { id_world: 1, choices_adventure: 0 },
                hc_confirm: false
            };
            const result = Troll.getLastTrollIdAvailable(false);
            expect(result).toBe(0);
        });

        it("uses explicit id_world parameter when provided", function () {
            const result = Troll.getLastTrollIdAvailable(false, 8);
            expect(result).toBe(7);
        });

        it("falls back to Hero id_world when explicit id_world is 0 or negative", function () {
            unsafeWindow.shared.Hero.infos = {
                level: 500,
                questing: { id_world: 6, choices_adventure: 0 },
                hc_confirm: false
            };
            const result = Troll.getLastTrollIdAvailable(false, 0);
            expect(result).toBe(5);
        });
    });

    describe("getTrollSelectedIndex", function () {
        it("returns -1 when no setting is stored", function () {
            const result = Troll.getTrollSelectedIndex();
            expect(result).toBe(-1);
        });

        it("returns the numeric value when a valid index is stored", function () {
            localStorage.setItem(HHStoredVarPrefixKey + SK.autoTrollSelectedIndex, '5');
            const result = Troll.getTrollSelectedIndex();
            expect(result).toBe(5);
        });

        it("returns -1 for NaN stored value", function () {
            localStorage.setItem(HHStoredVarPrefixKey + SK.autoTrollSelectedIndex, 'abc');
            const result = Troll.getTrollSelectedIndex();
            expect(result).toBe(-1);
        });
    });

    describe("isEnabled", function () {
        it("returns true when isEnabledTrollBattle is true and id_world > 0", function () {
            unsafeWindow.shared.Hero.infos = {
                level: 500,
                questing: { id_world: 5, choices_adventure: 0 },
                hc_confirm: false
            };
            // ConfigHelper.getHHScriptVars("isEnabledTrollBattle") returns true for HH domain
            expect(Troll.isEnabled()).toBeTruthy();
        });

        it("returns false when id_world is 0", function () {
            unsafeWindow.shared.Hero.infos = {
                level: 500,
                questing: { id_world: 0, choices_adventure: 0 },
                hc_confirm: false
            };
            expect(Troll.isEnabled()).toBeFalsy();
        });
    });

    describe("isTrollFightActivated", function () {
        it("returns false when no battle settings are enabled", function () {
            unsafeWindow.shared.Hero.infos = {
                level: 500,
                questing: { id_world: 5, choices_adventure: 0 },
                hc_confirm: false
            };
            expect(Troll.isTrollFightActivated()).toBeFalsy();
        });

        it("returns true when autoTrollBattle is enabled", function () {
            unsafeWindow.shared.Hero.infos = {
                level: 500,
                questing: { id_world: 5, choices_adventure: 0 },
                hc_confirm: false
            };
            localStorage.setItem(HHStoredVarPrefixKey + SK.autoTrollBattle, 'true');
            expect(Troll.isTrollFightActivated()).toBeTruthy();
        });

        it("returns true when plusEvent is enabled", function () {
            unsafeWindow.shared.Hero.infos = {
                level: 500,
                questing: { id_world: 5, choices_adventure: 0 },
                hc_confirm: false
            };
            localStorage.setItem(HHStoredVarPrefixKey + SK.plusEvent, 'true');
            expect(Troll.isTrollFightActivated()).toBeTruthy();
        });

        it("returns true when plusEventMythic is enabled", function () {
            unsafeWindow.shared.Hero.infos = {
                level: 500,
                questing: { id_world: 5, choices_adventure: 0 },
                hc_confirm: false
            };
            localStorage.setItem(HHStoredVarPrefixKey + SK.plusEventMythic, 'true');
            expect(Troll.isTrollFightActivated()).toBeTruthy();
        });
    });

    describe("getTrollIdToFight", function () {
        beforeEach(() => {
            unsafeWindow.shared.Hero.infos = {
                level: 500,
                questing: { id_world: 5, choices_adventure: 0 },
                hc_confirm: false
            };
            // Mock event functions to return empty/no-event defaults
            jest.spyOn(EventModule, 'getEventGirl').mockReturnValue({} as EventGirl);
            jest.spyOn(EventModule, 'getEventMythicGirl').mockReturnValue({} as EventGirl);
            jest.spyOn(LoveRaidManager, 'isAnyActivated').mockReturnValue(false);
            jest.spyOn(LoveRaidManager, 'isActivated').mockReturnValue(false);
            jest.spyOn(LoveRaidManager, 'getMinRaidStars').mockReturnValue(0);
        });

        it("returns last troll when autoTrollBattle enabled and no events", function () {
            localStorage.setItem(HHStoredVarPrefixKey + SK.autoTrollBattle, 'true');
            const TTF = Troll.getTrollIdToFight(false);
            // lastTrollIdAvailable = id_world - 1 = 4
            expect(TTF).toBe(4);
        });

        it("returns custom troll index when autoTrollSelectedIndex set (1-97)", function () {
            localStorage.setItem(HHStoredVarPrefixKey + SK.autoTrollBattle, 'true');
            localStorage.setItem(HHStoredVarPrefixKey + SK.autoTrollSelectedIndex, '3');
            const TTF = Troll.getTrollIdToFight(false);
            expect(TTF).toBe(3);
        });

        it("returns 0 when no troll battle enabled and no events active", function () {
            // All settings off
            const TTF = Troll.getTrollIdToFight(false);
            expect(TTF).toBe(0);
        });

        it("returns event troll when plusEvent enabled and event active", function () {
            const eventGirl = {
                girl_id: 123, is_mythic: false, shards: 50,
                troll_id: 3, event_id: 'event_123'
            } as EventGirl;
            jest.spyOn(EventModule, 'getEventGirl').mockReturnValue(eventGirl);
            jest.spyOn(EventModule, 'isEventActive').mockReturnValue(true);

            localStorage.setItem(HHStoredVarPrefixKey + SK.plusEvent, 'true');
            // Timer eventGoing must exist and not be expired (!checkTimer returns true)
            setTimer('eventGoing', 5000);

            const TTF = Troll.getTrollIdToFight(false);
            expect(TTF).toBe(3);
        });

        it("mythic event has priority over normal event", function () {
            const eventGirl = {
                girl_id: 123, is_mythic: false, shards: 50,
                troll_id: 3, event_id: 'event_123'
            } as EventGirl;
            const mythicGirl = {
                girl_id: 456, is_mythic: true, shards: 30,
                troll_id: 2, event_id: 'event_456'
            } as EventGirl;
            jest.spyOn(EventModule, 'getEventGirl').mockReturnValue(eventGirl);
            jest.spyOn(EventModule, 'getEventMythicGirl').mockReturnValue(mythicGirl);
            jest.spyOn(EventModule, 'isEventActive').mockReturnValue(true);

            localStorage.setItem(HHStoredVarPrefixKey + SK.plusEvent, 'true');
            localStorage.setItem(HHStoredVarPrefixKey + SK.plusEventMythic, 'true');
            setTimer('eventGoing', 5000);
            setTimer('eventMythicGoing', 5000);

            const TTF = Troll.getTrollIdToFight(false);
            // Mythic has higher priority in the if-chain
            expect(TTF).toBe(2);
        });

        it("falls back to last troll when TTF exceeds lastTrollIdAvailable", function () {
            // Simulate a raid returning a locked troll
            jest.spyOn(LoveRaidManager, 'isAnyActivated').mockReturnValue(true);
            jest.spyOn(LoveRaidManager, 'isActivated').mockReturnValue(true);
            jest.spyOn(LoveRaidManager, 'getTrollRaids').mockReturnValue([
                { trollId: 99, id_girl: 888, girl_shards: 50, girlGrade: 3 } as LoveRaid
            ]);
            jest.spyOn(LoveRaidManager, 'getRaidToFight').mockReturnValue(
                { trollId: 99, id_girl: 888, girl_shards: 50, girlGrade: 3 } as LoveRaid
            );

            // Don't set autoTrollBattle — events/raids only mode
            // TTF=99 > lastTrollIdAvailable=4, so it resets and returns 0
            const TTF = Troll.getTrollIdToFight(false);
            expect(TTF).toBe(0);
        });

        it("returns last troll when autoTrollBattle enabled and selected index is -1 (default)", function () {
            localStorage.setItem(HHStoredVarPrefixKey + SK.autoTrollBattle, 'true');
            // autoTrollSelectedIndex defaults to -1 (not set)
            const TTF = Troll.getTrollIdToFight(false);
            expect(TTF).toBe(4);
        });

        it("uses autoTrollBattleSaveQuest to force last troll", function () {
            localStorage.setItem(HHStoredVarPrefixKey + SK.autoTrollBattle, 'true');
            localStorage.setItem(HHStoredVarPrefixKey + SK.autoTrollSelectedIndex, '2');
            sessionStorage.setItem(HHStoredVarPrefixKey + TK.autoTrollBattleSaveQuest, 'true');

            // With logging=true, autoTrollBattleSaveQuest overrides to lastTrollIdAvailable
            const TTF = Troll.getTrollIdToFight(true);
            expect(TTF).toBe(4);
        });

        it("falls back to 1 when autoTrollBattle enabled but troll not in trollzList", function () {
            localStorage.setItem(HHStoredVarPrefixKey + SK.autoTrollBattle, 'true');
            // Set world very high so troll index won't be in trollzList
            unsafeWindow.shared.Hero.infos.questing.id_world = 999;
            const TTF = Troll.getTrollIdToFight(false);
            // Should fallback to 1 because troll 998 is not in trollzList
            expect(TTF).toBe(1);
        });
    });
});
