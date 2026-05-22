import { HHStoredVarPrefixKey } from '../../src/config/HHStoredVars';
import { TK } from '../../src/config/StorageKeys';

export class MockHelper{

    static mockDomain(domain: string = 'www.hentaiheroes.com', page: string = '', search:string = '') {
        if(search != '' && search.indexOf('?') < 0) {
            search = '?' + search;
        } 
        if (page != '' && page.indexOf('/') < 0) {
            page = '/' + page;
        } 
        // configurable: true allows the same test (or a follow-up beforeEach)
        // to redefine window.location without TypeError, and lets restoreLocation
        // put the original descriptor back in place.
        Object.defineProperty(window, 'location', {
            configurable: true,
            get() {
                return { 
                    hostname: domain,
                    href: 'https://' + domain + page + search,
                    origin: 'https://' + domain,
                    pathname: page,
                    search: search
                };
            },
        });
    }

    /**
     * Snapshot the current window.location descriptor so a test can restore it
     * after a mockDomain() call. Use in pairs:
     *
     *   const restore = MockHelper.snapshotLocation();
     *   MockHelper.mockDomain(...);
     *   // ... test body ...
     *   restore();
     *
     * Returns a thunk that puts the original descriptor back. If no descriptor
     * was present (jsdom default), the thunk deletes the override so the next
     * test starts from a clean slate.
     */
    static snapshotLocation(): () => void {
        const original = Object.getOwnPropertyDescriptor(window, 'location');
        return () => {
            if (original) {
                Object.defineProperty(window, 'location', original);
            } else {
                delete (window as any).location;
            }
        };
    }

    static mockPage(pageName: string, body:string = '') {
        document.body.innerHTML = `<!DOCTYPE html><div id="hh_hentai" page="${pageName}"><p>Hello world</p>${body}</div>`;
    }

    static mockHeroLevel(heroLevel: number) {
        if (!unsafeWindow.shared) unsafeWindow.shared = {} as any;
        unsafeWindow.shared.Hero = {
            name: "TOTO",
            infos: {
                level: heroLevel
            },
            energies: {}
        };
    }
    
    static mockEnergiesFight(amount: number, max: number) {
        unsafeWindow.shared.Hero.energies.fight = {
            amount: amount,
            max_regen_amount: max
        };
    }

    static mockEnergiesChallenge(amount: number, max: number) {
        unsafeWindow.shared.Hero.energies.challenge = {
            amount: amount,
            max_regen_amount: max
        };
    }

    static mockEnergiesKiss(amount: number, max: number) {
        unsafeWindow.shared.Hero.energies.kiss = {
            amount: amount,
            max_regen_amount: max
        };
    }

    static mockEnergiesQuest(amount: number, max: number) {
        unsafeWindow.shared.Hero.energies.quest = {
            amount: amount,
            max_regen_amount: max
        };
    }

    static mockEnergiesWorship(amount: number, max: number) {
        unsafeWindow.shared.Hero.energies.worship = {
            amount: amount,
            max_regen_amount: max
        };
    }

    static mockEnergiesDrill(amount: number, max: number) {
        unsafeWindow.shared.Hero.energies.drill = {
            amount: amount,
            max_regen_amount: max
        };
    }
    /**
     * Mocks the booster status in localStorage.
     * Two parallel inventories: 'normal' (timed, with item.identifier and endAt epoch ms)
     * and 'mythic' (untimed, only item.identifier).
     *
     * Example:
     *   MockHelper.mockBoosterInventory({
     *     normal: [{ identifier: 'GS3', secondsLeft: 3600 }],
     *     mythic: ['MGS5']
     *   });
     */
    static mockBoosterInventory(boosters: { normal?: Array<{ identifier: string; secondsLeft?: number }>; mythic?: string[] } = {}) {
        if (!unsafeWindow.shared) unsafeWindow.shared = {} as any;
        const serverNow = Math.floor(Date.now() / 1000);
        unsafeWindow.server_now_ts = serverNow;

        const normal = (boosters.normal || []).map(b => ({
            item: { identifier: b.identifier },
            endAt: serverNow + (b.secondsLeft ?? 3600)
        }));
        const mythic = (boosters.mythic || []).map(id => ({
            item: { identifier: id }
        }));

        const status = { normal, mythic };
        localStorage.setItem(HHStoredVarPrefixKey + TK.boosterStatus, JSON.stringify(status));
    }

    /**
     * Sets a single setting value in localStorage with the HHAuto_Setting_ prefix.
     * For Boolean-typed settings, pass 'true' or 'false' as a string (matching production storage format).
     *
     * Example:
     *   MockHelper.mockSetting('autoLeaguesBoostedOnly', 'true');
     */
    static mockSetting(key: string, value: string) {
        localStorage.setItem(HHStoredVarPrefixKey + 'Setting_' + key, value);
    }

    /**
     * Wraps setTimer for tests, expressing intent more clearly than direct setTimer calls.
     * secondsLeft <= 0 means the timer is expired (or never set).
     *
     * Example:
     *   MockHelper.mockTimer('nextLeaguesTime', 0);   // expired
     *   MockHelper.mockTimer('nextSeasonTime', 60);   // 60s remaining
     */
    static mockTimer(name: string, secondsLeft: number) {
        // Direct localStorage write instead of importing setTimer to avoid circular helper dependency.
        // Production setTimer stores future epoch ms in unsafeWindow Timers and persists JSON to storage.
        const raw = localStorage.getItem(HHStoredVarPrefixKey + TK.Timers);
        const timers = raw ? JSON.parse(raw) : {};
        if (secondsLeft <= 0) {
            delete timers[name];
        } else {
            timers[name] = Date.now() + secondsLeft * 1000;
        }
        localStorage.setItem(HHStoredVarPrefixKey + TK.Timers, JSON.stringify(timers));
    }

    /**
     * Mocks getHHAjax() to call the success callback with the supplied response.
     * Production signature: getHHAjax()(params, successCallback).
     *
     * Example:
     *   MockHelper.mockAjaxSuccess({ success: true, league_rewards: [] });
     */
    static mockAjaxSuccess(response: any) {
        if (!unsafeWindow.shared) unsafeWindow.shared = {} as any;
        if (!unsafeWindow.shared.general) unsafeWindow.shared.general = {} as any;
        unsafeWindow.shared.general.hh_ajax = (_params: any, successCb: (data: any) => void) => {
            successCb(response);
        };
    }

    /**
     * Mocks getHHAjax() to throw the given error from the synchronous call site.
     * Production code typically does not pass an error callback; modules wrap in try/catch.
     *
     * Example:
     *   MockHelper.mockAjaxError(new Error('network down'));
     */
    static mockAjaxError(error: Error) {
        if (!unsafeWindow.shared) unsafeWindow.shared = {} as any;
        if (!unsafeWindow.shared.general) unsafeWindow.shared.general = {} as any;
        unsafeWindow.shared.general.hh_ajax = () => {
            throw error;
        };
    }

    /**
     * One-shot world setup combining hero level, energies, and arbitrary settings.
     * Each parameter is optional; only provided fields are touched.
     *
     * Example:
     *   MockHelper.mockGameGlobals({
     *     heroLevel: 500,
     *     energies: { challenge: { amount: 16, max: 20 } },
     *     settings: { autoLeaguesThreshold: '5', autoLeaguesBoostedOnly: 'true' }
     *   });
     */
    static mockGameGlobals(globals: {
        heroLevel?: number;
        energies?: Partial<{
            fight: { amount: number; max: number };
            challenge: { amount: number; max: number };
            kiss: { amount: number; max: number };
            quest: { amount: number; max: number };
            worship: { amount: number; max: number };
            drill: { amount: number; max: number };
        }>;
        settings?: Record<string, string>;
    } = {}) {
        if (globals.heroLevel !== undefined) {
            MockHelper.mockHeroLevel(globals.heroLevel);
        } else if (!unsafeWindow.shared?.Hero) {
            // Ensure baseline structure so energy mocks do not NPE.
            MockHelper.mockHeroLevel(1);
        }

        const energyMockers = {
            fight: MockHelper.mockEnergiesFight,
            challenge: MockHelper.mockEnergiesChallenge,
            kiss: MockHelper.mockEnergiesKiss,
            quest: MockHelper.mockEnergiesQuest,
            worship: MockHelper.mockEnergiesWorship,
            drill: MockHelper.mockEnergiesDrill,
        };
        for (const [key, energy] of Object.entries(globals.energies || {})) {
            const mocker = (energyMockers as any)[key];
            if (mocker && energy) {
                mocker(energy.amount, energy.max);
            }
        }

        for (const [key, value] of Object.entries(globals.settings || {})) {
            MockHelper.mockSetting(key, value);
        }
    }
}