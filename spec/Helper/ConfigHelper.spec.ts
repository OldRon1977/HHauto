import { ConfigHelper } from '../../src/Helper/ConfigHelper';
import { MockHelper } from '../testHelpers/MockHelpers';

describe("ConfigHelper", function() {

  describe("Environnement", function() {
    beforeEach(() => {
        document.body.innerHTML = `<!DOCTYPE html><p>Hello world</p>`;
    })

    it("HH", function() {
        MockHelper.mockDomain('www.hentaiheroes.com');
        expect(ConfigHelper.getEnvironnement()).toBe("HH_prod");
        MockHelper.mockDomain('test.hentaiheroes.com');
        expect(ConfigHelper.getEnvironnement()).toBe("HH_test");
        expect(ConfigHelper.isPshEnvironnement()).toBeFalsy();
    });

    it("CX", function() {
        MockHelper.mockDomain('www.comixharem.com');
        expect(ConfigHelper.getEnvironnement()).toBe("CH_prod");
        MockHelper.mockDomain('nutaku.comixharem.com');
        expect(ConfigHelper.getEnvironnement()).toBe("NCH_prod");
        expect(ConfigHelper.isPshEnvironnement()).toBeFalsy();
    });

    it("PH", function() {
        MockHelper.mockDomain('www.pornstarharem.com');
        expect(ConfigHelper.getEnvironnement()).toBe("PH_prod");
        expect(ConfigHelper.isPshEnvironnement()).toBeTruthy();
    });

    it("TPH", function() {
        MockHelper.mockDomain('www.transpornstarharem.com');
        expect(ConfigHelper.getEnvironnement()).toBe("TPH_prod");
        expect(ConfigHelper.isPshEnvironnement()).toBeFalsy();
    });

    it("unkown", function() {
        MockHelper.mockDomain('localhost');
        expect(ConfigHelper.getEnvironnement()).toBe("global");
        expect(ConfigHelper.isPshEnvironnement()).toBeFalsy();
    });
  });

  describe("Variables", function() {

    it("HH", function() {
        MockHelper.mockDomain('www.hentaiheroes.com');
        expect(ConfigHelper.getHHScriptVars('eventIDReg')).toBe("event_");
        expect(ConfigHelper.getHHScriptVars('lastQuestId')).toBe(2116);
        expect(ConfigHelper.getHHScriptVars('isEnabledSideQuest')).toBeTruthy();

        expect(ConfigHelper.getHHScriptVars('UNKNOWN')).toBeNull();
    });

    it("CX", function() {
        MockHelper.mockDomain('www.comixharem.com');
        expect(ConfigHelper.getHHScriptVars('eventIDReg')).toBe("event_");
         // Unknown, need someone who is at the end of the game
        expect(ConfigHelper.getHHScriptVars('lastQuestId')).toBe(-1);
    });

    it("PH", function() {
        MockHelper.mockDomain('www.pornstarharem.com');
        expect(ConfigHelper.getHHScriptVars('eventIDReg')).toBe("event_");
        // Probably not the latest anymore
        expect(ConfigHelper.getHHScriptVars('lastQuestId')).toBe(16100);
        expect(ConfigHelper.getHHScriptVars('isEnabledSideQuest')).toBeTruthy();
    });

    it("TPH", function() {
        MockHelper.mockDomain('www.transpornstarharem.com');
        expect(ConfigHelper.getHHScriptVars('isEnabledLabyrinth')).toBeTruthy();
        expect(ConfigHelper.getHHScriptVars('isEnabledSideQuest')).toBeTruthy();
    });

    it("Sandalwood booster", function() {
        MockHelper.mockDomain('www.hentaiheroes.com');
        expect(ConfigHelper.getHHScriptVars('boosterId_MB1')).toBe(632);
        MockHelper.mockDomain('www.comixharem.com');
        expect(ConfigHelper.getHHScriptVars('boosterId_MB1')).toBe(2619);
        MockHelper.mockDomain('www.pornstarharem.com');
        expect(ConfigHelper.getHHScriptVars('boosterId_MB1')).toBe(2619);
    });
  });
});