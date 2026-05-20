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
        expect(ConfigHelper.getHHScriptVars('lastQuestId')).toBe(2404);
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

  describe("Multi-domain smoke", function() {
    /**
     * Stage 4 task 4.3: per supported domain clone, one smoke test
     * covering ConfigHelper domain detection and the corresponding
     * gameID lookup. The full set of hostnames is the registry built
     * from `src/config/game/*Vars.ts:getEnv()` plus the manual entry
     * for `www.hornyheroes.com` in HHEnvVariables.ts. PSH detection
     * (`isPshEnvironnement`) is asserted alongside per Plan.
     *
     * Plan deviation (documented): the plan listed `domain.includes()`
     * checks as one of the things to assert. The HHAuto codebase does
     * not use `domain.includes()` for environment detection -- it uses
     * exact-match against `HHKnownEnvironnements[hostname]`. The smoke
     * tests use exact hostnames accordingly.
     */
    beforeEach(() => {
        document.body.innerHTML = `<!DOCTYPE html><p>Hello world</p>`;
    });

    interface DomainCase {
        hostname: string;
        envName: string;
        gameId: string;
        psh: boolean;
    }

    const DOMAIN_CASES: DomainCase[] = [
        // Hentai Heroes (HentaiHeroesVars.ts)
        { hostname: "www.hentaiheroes.com",       envName: "HH_prod",   gameId: "hh_hentai",    psh: false },
        { hostname: "test.hentaiheroes.com",      envName: "HH_test",   gameId: "hh_hentai",    psh: false },
        { hostname: "nutaku.haremheroes.com",     envName: "NHH_prod",  gameId: "hh_hentai",    psh: false },
        { hostname: "thrix.hentaiheroes.com",     envName: "THH_prod",  gameId: "hh_hentai",    psh: false },
        { hostname: "eroges.hentaiheroes.com",    envName: "EHH_prod",  gameId: "hh_hentai",    psh: false },
        { hostname: "esprit.hentaiheroes.com",    envName: "OGHH_prod", gameId: "hh_hentai",    psh: false },
        // Comix Harem (ComixHaremVars.ts)
        { hostname: "www.comixharem.com",         envName: "CH_prod",   gameId: "hh_comix",     psh: false },
        { hostname: "nutaku.comixharem.com",      envName: "NCH_prod",  gameId: "hh_comix",     psh: false },
        // Gay Harem (GayHaremVars.ts)
        { hostname: "www.gayharem.com",           envName: "GH_prod",   gameId: "hh_gay",       psh: false },
        { hostname: "nutaku.gayharem.com",        envName: "NGH_prod",  gameId: "hh_gay",       psh: false },
        { hostname: "eroges.gayharem.com",        envName: "EGH_prod",  gameId: "hh_gay",       psh: false },
        // Pornstar Harem (PornstarHaremVars.ts) -- PSH
        { hostname: "www.pornstarharem.com",      envName: "PH_prod",   gameId: "hh_star",      psh: true  },
        { hostname: "nutaku.pornstarharem.com",   envName: "NPH_prod",  gameId: "hh_star",      psh: true  },
        // Trans Pornstar Harem (TransPornstarHaremVars.ts)
        { hostname: "www.transpornstarharem.com", envName: "TPH_prod",  gameId: "hh_startrans", psh: false },
        { hostname: "nutaku.transpornstarharem.com", envName: "NTPH_prod", gameId: "hh_startrans", psh: false },
        // Gay Pornstar Harem (GayPornstarHaremVars.ts)
        { hostname: "www.gaypornstarharem.com",   envName: "GPSH_prod",  gameId: "hh_stargay", psh: false },
        { hostname: "nutaku.gaypornstarharem.com", envName: "NGPSH_prod", gameId: "hh_stargay", psh: false },
        // Manga RPG (MangaRpgVars.ts)
        { hostname: "www.mangarpg.com",           envName: "MRPG_prod",  gameId: "hh_mangarpg", psh: false },
        { hostname: "nutaku.mangarpg.com",        envName: "NMRPG_prod", gameId: "hh_mangarpg", psh: false },
        // Amour Agent (AmourAgentVars.ts)
        { hostname: "www.amouragent.com",         envName: "AA_prod",    gameId: "hh_amour",   psh: false },
        // Sexy Heroes (manual entry in HHEnvVariables.ts)
        { hostname: "www.hornyheroes.com",        envName: "SH_prod",    gameId: "hh_sexy",    psh: false },
    ];

    it.each(DOMAIN_CASES)(
        "$hostname -> env=$envName, gameID=$gameId, psh=$psh",
        ({ hostname, envName, gameId, psh }) => {
            MockHelper.mockDomain(hostname);
            expect(ConfigHelper.getEnvironnement()).toBe(envName);
            expect(ConfigHelper.getHHScriptVars("gameID")).toBe(gameId);
            expect(ConfigHelper.isPshEnvironnement()).toBe(psh);
        }
    );

    it("DOMAIN_CASES covers all hostnames in HHKnownEnvironnements", () => {
        // Sanity: if a new hostname is added to a getEnv() block, this
        // assertion fails until the smoke table is extended.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { HHKnownEnvironnements } = require("../../src/config/HHEnvVariables");
        const registryHosts = Object.keys(HHKnownEnvironnements);
        const tableHosts = DOMAIN_CASES.map((c) => c.hostname);
        const missing = registryHosts.filter((h) => !tableHosts.includes(h));
        expect(missing).toEqual([]);
    });
  });
});