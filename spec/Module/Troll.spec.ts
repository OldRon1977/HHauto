import { getSecondsLeft, setTimer } from '../../src/Helper/TimerHelper';
import { Troll } from '../../src/Module/Troll';
import { HHStoredVarPrefixKey } from '../../src/config/HHStoredVars';
import { EventGirl } from '../../src/model/EventGirl';
import { LoveRaid } from '../../src/model/LoveRaid';
import { MockHelper } from '../testHelpers/MockHelpers';

describe("Troll module", function () {

    beforeEach(() => {
        MockHelper.mockDomain('www.hentaiheroes.com');
        // MockHelper.mockPage('champions_map');
        // sessionStorage.setItem(HHStoredVarPrefixKey + 'Setting_autoChampsFilter', '1;2;3;4;5;6');
        // setTimer('nextChampionTime',-1);
        unsafeWindow.shared.Hero = {
            name: "TOTO",
            energies: {
                fight: { 
                    amount: 0,
                    max_regen_amount: 15,
                    max_amount: 200,
                    next_refresh_ts: 1019,
                    seconds_per_point: 1800
                }
            }
        };
        unsafeWindow.hh_prices = {
            fight_cost_per_minute: 0.36
        }
    });

    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    describe("canBuyFight", function () {
        it("default", function () {
            const canBuy = Troll.canBuyFight({} as EventGirl);
            expect(canBuy.canBuy).toBeFalsy();
            expect(canBuy.event_mythic).toBe("false");
            expect(canBuy.type).toBe("fight");
        });
        describe("Event girl", function () {
            xit("allows buying 20 fights when event buy settings are enabled", function () {
                localStorage.setItem(HHStoredVarPrefixKey + 'Setting_buyCombat', 'true');
                localStorage.setItem(HHStoredVarPrefixKey + 'Setting_plusEvent', 'true');
                localStorage.setItem(HHStoredVarPrefixKey + 'Setting_buyCombTimer', '1');
                setTimer('eventGoing', 1000);
                unsafeWindow.shared.Hero.currencies = { hard_currency: 1000 };
                MockHelper.mockEnergiesFight(0, 15);

                const eventGirl = { girl_id: 1, is_mythic: false, shards: 90, troll_id: 1 } as EventGirl;
                const canBuy = Troll.canBuyFight(eventGirl);

                expect(canBuy.canBuy).toBeTruthy();
                expect(canBuy.event_mythic).toBe("false");
                expect(canBuy.max).toBe(20);
                expect(canBuy.toBuy).toBe(20);
            });

            xit("allows buying 50 fights when min shards and x50 settings are enabled", function () {
                localStorage.setItem(HHStoredVarPrefixKey + 'Setting_buyCombat', 'true');
                localStorage.setItem(HHStoredVarPrefixKey + 'Setting_plusEvent', 'true');
                localStorage.setItem(HHStoredVarPrefixKey + 'Setting_buyCombTimer', '1');
                localStorage.setItem(HHStoredVarPrefixKey + 'Setting_useX50Fights', 'true');
                localStorage.setItem(HHStoredVarPrefixKey + 'Setting_minShardsX50', '20');
                localStorage.setItem(HHStoredVarPrefixKey + 'Setting_useX50FightsAllowNormalEvent', 'true');
                setTimer('eventGoing', 1000);
                unsafeWindow.shared.Hero.currencies = { hard_currency: 1000 };
                MockHelper.mockEnergiesFight(0, 15);

                const eventGirl = { girl_id: 1, is_mythic: false, shards: 0, troll_id: 1 } as EventGirl;
                const canBuy = Troll.canBuyFight(eventGirl);

                expect(canBuy.canBuy).toBeTruthy();
                expect(canBuy.max).toBe(50);
                expect(canBuy.toBuy).toBe(50);
            });
        });
        describe("Mythic event girl", function () {
            xit("default", function () {
                
            });
        });
        describe("Mythic + event girl", function () {
            xit("default", function () {
                
            });
        });
    });

    describe("canBuyFightForRaid", function () {
        it("default", function () {
            const canBuy = Troll.canBuyFightForRaid({} as LoveRaid);
            expect(canBuy.canBuy).toBeFalsy();
            expect(canBuy.type).toBe("fight");
        });
        describe("Event girl", function () {
            xit("default", function () {
                
            });
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
});