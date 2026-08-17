import { ConfigHelper } from '../../src/Helper/ConfigHelper';
import { MockHelper } from '../testHelpers/MockHelpers';

/**
 * What is left here is the resolution logic: a known hostname resolves to
 * its environment, an unknown one falls back to "global", and PSH detection
 * is derived rather than looked up.
 *
 * The per-domain smoke table and the getHHScriptVars value assertions were
 * removed in the spec triage (2026-08): they queried the registry in
 * src/config/game/*Vars.ts backwards and asserted the same literals it
 * defines, so a stale entry (lastQuestId, boosterId_MB1, a renamed host)
 * stayed green by construction. Those values are only provable against the
 * running game and belong in the live check.
 */
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
});
